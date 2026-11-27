import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { ortalamaMaliyet, sonOrtalama } from "../services/ticari/maliyetHesap.js";
import { yuvarla2 } from "../services/ticari/ticariHesap.js";
import { STOK_BELGE, TicariStokSqlRepository } from "./ticariStokSql.repository.js";
/**
 * Ticari ortalama maliyet + kâr raporu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA15). Maliyet hareket geçmişinden hesaplanır (maliyetHesap.ts):
 * satış satırının maliyeti satış anındaki hareketli ortalamadır; iade o anki ortalamayla geri alınır; fire ve sayım farkı ayrıca gösterilir.
 * Gelir: satış satırının matrahı (KDV hariç, satır + fiş iskontosu düşülmüş); iade satırı gelirden düşer.
 */
const temiz = (v) => String(v ?? "").trim();
const y4 = (n) => Math.round(n * 10000) / 10000;
const gunMu = (s) => /^\d{4}-\d{2}-\d{2}$/.test(temiz(s)) && !Number.isNaN(Date.parse(`${temiz(s)}T00:00:00Z`));
/** Maliyetli giriş türleri: stok giriş fişi (1), parçalama çıktısı (6) */
export const MALIYETLI_GIRIS = [STOK_BELGE.GIRIS, 6];
async function hareketleriOku(r, kosul) {
    const req = new sql.Request(r);
    const k = [];
    if (kosul.kartIdler) {
        if (!kosul.kartIdler.length)
            return [];
        k.push(`H.STOK_KART_ID IN (${kosul.kartIdler.map(Number).join(",")})`);
    }
    if (kosul.stokKartId) {
        req.input("KART", sql.Int, kosul.stokKartId);
        k.push("H.STOK_KART_ID = @KART");
    }
    if (kosul.grupId) {
        req.input("GRUP", sql.Int, kosul.grupId);
        k.push("K.STOK_GRUP_ID = @GRUP");
    }
    if (kosul.bitisGunu) {
        req.input("BIT", sql.VarChar(10), kosul.bitisGunu);
        k.push("CAST(DATEADD(hour, 3, H.TARIH) AS date) <= CAST(@BIT AS date)");
    }
    if (kosul.tarihSonu instanceof Date) {
        req.input("TS", sql.DateTime, kosul.tarihSonu);
        k.push("H.TARIH <= @TS");
    }
    else if (kosul.tarihSonu && kosul.tarihSonu.sayimId) {
        req.input("SID", sql.Int, kosul.tarihSonu.sayimId);
        k.push("H.TARIH <= (SELECT TARIH FROM dbo.TODVZ_STOK_SAYIM WHERE SAYIM_ID = @SID)");
    }
    const q = await req.query(`
    SELECT H.STOK_HAREKET_ID, H.STOK_KART_ID, H.TARIH, CONVERT(char(10), DATEADD(hour, 3, H.TARIH), 23) AS GUN, H.BELGE_TURU, ISNULL(H.GIRIS, 0) AS GIRIS, ISNULL(H.CIKIS, 0) AS CIKIS,
      ISNULL(H.BIRIM_FIYAT, 0) AS BF, F.FATURA_TIPI, ISNULL(S.TUTAR, 0) - ISNULL(S.SATIR_ISKONTO_TUTARI, 0) AS MATRAH
    FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = H.STOK_KART_ID
    LEFT JOIN dbo.TODVZ_FATURA F ON H.BELGE_TURU = 2 AND F.FATURA_ID = H.BELGE_ID
    LEFT JOIN dbo.TODVZ_FATURA_SATIRI S ON H.BELGE_TURU = 2 AND S.FATURA_ID = H.BELGE_ID AND S.SATIR_NO = H.SATIR_NO
    ${k.length ? `WHERE ${k.join(" AND ")}` : ""}
    ORDER BY H.STOK_KART_ID, H.TARIH, H.STOK_HAREKET_ID`);
    return q.recordset.map((x) => ({ id: Number(x.STOK_HAREKET_ID), kartId: Number(x.STOK_KART_ID), tarih: new Date(x.TARIH), gun: temiz(x.GUN), tur: Number(x.BELGE_TURU),
        giris: Number(x.GIRIS) || 0, cikis: Number(x.CIKIS) || 0, bf: Number(x.BF) || 0, faturaTipi: x.FATURA_TIPI === null || x.FATURA_TIPI === undefined ? null : Number(x.FATURA_TIPI), matrah: Number(x.MATRAH) || 0 }));
}
/** Hareketleri kart başına gruplar (sıra korunur) */
const kartaGore = (hr) => {
    const m = new Map();
    for (const h of hr) {
        const l = m.get(h.kartId);
        if (l)
            l.push(h);
        else
            m.set(h.kartId, [h]);
    }
    return m;
};
const maliyetGirdisi = (h) => ({ id: h.id, tarih: h.tarih.getTime(), giris: h.giris, cikis: h.cikis, maliyetliFiyat: h.giris > 0 && MALIYETLI_GIRIS.includes(h.tur) ? h.bf : null,
    // T5: tedarikçiye iade iade fiyatıyla çıkar, kalanın ortalaması yeniden hesaplanır
    cikisFiyati: h.cikis > 0 && h.tur === STOK_BELGE.TEDARIKCI_IADE ? h.bf : null });
export class TicariKarSqlRepository {
    /** Kartların başlangıç ortalaması (hiç maliyetli giriş yokken): alış fiyatı, yoksa son alış */
    static async baslangiclar(r, kartIdler) {
        const m = new Map();
        if (!kartIdler.length)
            return m;
        const q = await new sql.Request(r).query(`SELECT STOK_KART_ID, COALESCE(NULLIF(ALIS_FIYATI, 0), SON_ALIS_FIYATI, 0) AS B FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${[...new Set(kartIdler)].map(Number).join(",")})`);
        for (const x of q.recordset)
            m.set(Number(x.STOK_KART_ID), Number(x.B) || 0);
        return m;
    }
    /** Kartların verilen ana kadarki hareketli ortalama maliyeti (fire / sayım satırına yazılır). İşlem içinden çağrılabilir. */
    static async ortalamalar(r, kartIdler, tarihSonu = null) {
        const ids = [...new Set(kartIdler.filter((x) => x > 0))];
        const sonuc = new Map();
        if (!ids.length)
            return sonuc;
        const [hr, bas] = [kartaGore(await hareketleriOku(r, { kartIdler: ids, tarihSonu })), await this.baslangiclar(r, ids)];
        for (const id of ids) {
            const liste = (hr.get(id) || []).map(maliyetGirdisi);
            sonuc.set(id, sonOrtalama(ortalamaMaliyet(liste, bas.get(id) || 0), bas.get(id) || 0));
        }
        return sonuc;
    }
    /**
     * Reçeteli ürünler (TA18): kendisi stok hareketi yazmaz; gelir satış / iade satırından, maliyet o satırın tür 7 malzeme hareketlerinin
     * satış anındaki ortalama maliyetinden. İadede malzeme stoğa dönmediği için iade satırı maliyeti geri almaz. "Ort. maliyet" = reçetenin
     * bugünkü maliyeti (malzeme miktarı × malzemenin son ortalaması).
     */
    static async receteliSatirlar(pool, f, gunler) {
        const req = pool.request().input("BAS", sql.VarChar(10), f.baslangic).input("BIT", sql.VarChar(10), f.bitis);
        const k = [];
        if (f.grupId) {
            req.input("GRUP", sql.Int, f.grupId);
            k.push("K.STOK_GRUP_ID = @GRUP");
        }
        if (f.stokKartId) {
            req.input("KART", sql.Int, f.stokKartId);
            k.push("K.STOK_KART_ID = @KART");
        }
        const r = await req.query(`
      SELECT S.FATURA_ID, S.SATIR_NO, S.STOK_KART_ID, ISNULL(F.FATURA_TIPI, 1) AS FATURA_TIPI, ISNULL(S.MIKTAR, 0) AS MIKTAR,
        ISNULL(S.TUTAR, 0) - ISNULL(S.SATIR_ISKONTO_TUTARI, 0) AS MATRAH, CONVERT(char(10), DATEADD(hour, 3, F.TARIH), 23) AS GUN,
        RTRIM(K.KOD) AS KOD, K.AD, RTRIM(ISNULL(K.BIRIM, 'Adet')) AS BIRIM, RTRIM(ISNULL(G.AD, '')) AS GRUP
      FROM dbo.TODVZ_FATURA_SATIRI S JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID = S.FATURA_ID JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID
        LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID
      WHERE CAST(DATEADD(hour, 3, F.TARIH) AS date) BETWEEN CAST(@BAS AS date) AND CAST(@BIT AS date)
        AND (ISNULL(K.RECETELI, 0) = 1 OR EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_HAREKET H WHERE H.BELGE_TURU = 7 AND H.BELGE_ID = S.FATURA_ID AND H.SATIR_NO = S.SATIR_NO))
        ${k.length ? `AND ${k.join(" AND ")}` : ""}`);
        if (!r.recordset.length)
            return [];
        const faturalar = [...new Set(r.recordset.map((x) => Number(x.FATURA_ID)))];
        const tuketim = [];
        for (let i = 0; i < faturalar.length; i += 1000) {
            const q = await pool.request().query(`SELECT STOK_HAREKET_ID, BELGE_ID, SATIR_NO, STOK_KART_ID, ISNULL(CIKIS, 0) - ISNULL(GIRIS, 0) AS M FROM dbo.TODVZ_STOK_HAREKET
        WHERE BELGE_TURU = 7 AND BELGE_ID IN (${faturalar.slice(i, i + 1000).join(",")})`);
            tuketim.push(...q.recordset);
        }
        const urunIdler = [...new Set(r.recordset.map((x) => Number(x.STOK_KART_ID)))];
        const receteQ = await pool.request().query(`SELECT STOK_KART_ID, MALZEME_KART_ID, MIKTAR FROM dbo.TODVZ_STOK_RECETE WHERE STOK_KART_ID IN (${urunIdler.join(",")})`);
        const malzemeler = [...new Set([...tuketim.map((x) => Number(x.STOK_KART_ID)), ...receteQ.recordset.map((x) => Number(x.MALZEME_KART_ID))])];
        // Malzeme hareketlerinin birim maliyeti (bütün geçmiş, bitiş gününe kadar) ve son ortalamalar
        const birim = new Map();
        const sonOrt = new Map();
        if (malzemeler.length) {
            const mh = kartaGore(await hareketleriOku(pool, { kartIdler: malzemeler, bitisGunu: f.bitis }));
            const mb = await this.baslangiclar(pool, malzemeler);
            for (const id of malzemeler) {
                const son = ortalamaMaliyet((mh.get(id) || []).map(maliyetGirdisi), mb.get(id) || 0);
                for (const x of son)
                    birim.set(x.id, x.birimMaliyet);
                sonOrt.set(id, sonOrtalama(son, mb.get(id) || 0));
            }
        }
        const satirMaliyeti = new Map();
        for (const t of tuketim) {
            const anahtar = `${t.BELGE_ID}:${t.SATIR_NO}`;
            const b = birim.get(Number(t.STOK_HAREKET_ID)) || 0;
            const o = satirMaliyeti.get(anahtar) || { maliyet: 0, bilinmeyen: false };
            o.maliyet += Number(t.M) * b;
            if (!(b > 0))
                o.bilinmeyen = true;
            satirMaliyeti.set(anahtar, o);
        }
        const receteMaliyeti = new Map();
        for (const x of receteQ.recordset)
            receteMaliyeti.set(Number(x.STOK_KART_ID), (receteMaliyeti.get(Number(x.STOK_KART_ID)) || 0) + Number(x.MIKTAR) * (sonOrt.get(Number(x.MALZEME_KART_ID)) || 0));
        const sonuc = new Map();
        for (const x of r.recordset) {
            const id = Number(x.STOK_KART_ID);
            const s = sonuc.get(id) || { stokKartId: id, kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM), grup: temiz(x.GRUP) || "Grupsuz", satisMiktar: 0, iadeMiktar: 0, netMiktar: 0,
                gelir: 0, maliyet: 0, kar: 0, karYuzde: null, fireMiktar: 0, fireMaliyet: 0, sayimFarkMaliyet: 0, ortMaliyet: Math.round((receteMaliyeti.get(id) || 0) * 1_000_000) / 1_000_000,
                sonAlis: null, maliyetsizMiktar: 0, donemSonuMiktar: 0, receteli: true };
            const iade = Number(x.FATURA_TIPI) === 2, isaret = iade ? -1 : 1, q = Number(x.MIKTAR) || 0;
            const sm = iade ? { maliyet: 0, bilinmeyen: false } : satirMaliyeti.get(`${x.FATURA_ID}:${x.SATIR_NO}`) || { maliyet: 0, bilinmeyen: true };
            if (iade)
                s.iadeMiktar += q;
            else
                s.satisMiktar += q;
            s.gelir += isaret * Number(x.MATRAH);
            s.maliyet += sm.maliyet;
            if (!iade && sm.bilinmeyen)
                s.maliyetsizMiktar += q;
            const g = gunler.get(temiz(x.GUN)) || { gun: temiz(x.GUN), gelir: 0, maliyet: 0 };
            g.gelir += isaret * Number(x.MATRAH);
            g.maliyet += sm.maliyet;
            gunler.set(temiz(x.GUN), g);
            sonuc.set(id, s);
        }
        return [...sonuc.values()].map((s) => {
            s.satisMiktar = y4(s.satisMiktar);
            s.iadeMiktar = y4(s.iadeMiktar);
            s.netMiktar = y4(s.satisMiktar - s.iadeMiktar);
            s.gelir = yuvarla2(s.gelir);
            s.maliyet = yuvarla2(s.maliyet);
            s.kar = yuvarla2(s.gelir - s.maliyet);
            s.karYuzde = s.gelir ? Math.round((s.kar / s.gelir) * 10000) / 100 : null;
            s.maliyetsizMiktar = y4(s.maliyetsizMiktar);
            return s;
        });
    }
    static async rapor(f, ctx) {
        if (!gunMu(f.baslangic) || !gunMu(f.bitis))
            throw ApiError.badRequest("Başlangıç ve bitiş günü YYYY-AA-GG biçiminde olmalı.");
        if (f.baslangic > f.bitis)
            throw ApiError.badRequest("Başlangıç günü bitişten sonra olamaz.");
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const hr = await hareketleriOku(pool, { grupId: f.grupId, stokKartId: f.stokKartId, bitisGunu: f.bitis });
        const grup = kartaGore(hr);
        const kartIdler = [...grup.keys()];
        const bas = await this.baslangiclar(pool, kartIdler);
        const kq = kartIdler.length ? (await pool.request().query(`SELECT K.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, RTRIM(ISNULL(K.BIRIM,'Adet')) AS BIRIM, RTRIM(ISNULL(G.AD,'')) AS GRUP, K.SON_ALIS_FIYATI
      FROM dbo.TODVZ_STOK_KART K LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID WHERE K.STOK_KART_ID IN (${kartIdler.join(",")})`)).recordset : [];
        const kart = new Map(kq.map((x) => [Number(x.STOK_KART_ID), x]));
        const urunler = [];
        const gunler = new Map();
        // T14 (26.11.2026 denetimi): parçalamada girdinin maliyeti (ortalamayla) − çıktılara yazılan maliyet. Maliyet tam dağıtılınca 0;
        // dağıtılmayan kısım (fire, eksik pay) eskiden raporda hiç görünmüyordu — net kârdan düşülür
        let parcalamaFarki = 0;
        for (const id of kartIdler) {
            const liste = grup.get(id) || [];
            const sonuc = ortalamaMaliyet(liste.map(maliyetGirdisi), bas.get(id) || 0);
            const byId = new Map(sonuc.map((s) => [s.id, s]));
            const k = kart.get(id) || {};
            const s = { stokKartId: id, kod: temiz(k.KOD), ad: temiz(k.AD), birim: temiz(k.BIRIM), grup: temiz(k.GRUP) || "Grupsuz", satisMiktar: 0, iadeMiktar: 0, netMiktar: 0, gelir: 0, maliyet: 0, kar: 0, karYuzde: null,
                fireMiktar: 0, fireMaliyet: 0, sayimFarkMaliyet: 0, ortMaliyet: sonOrtalama(sonuc, bas.get(id) || 0), sonAlis: k.SON_ALIS_FIYATI === null || k.SON_ALIS_FIYATI === undefined ? null : Number(k.SON_ALIS_FIYATI),
                maliyetsizMiktar: 0, donemSonuMiktar: sonuc.length ? sonuc[sonuc.length - 1].miktarSonra : 0 };
            let donemde = false;
            for (const h of liste) {
                if (h.gun < f.baslangic)
                    continue;
                const m = byId.get(h.id);
                if (h.tur === STOK_BELGE.SATIS) {
                    donemde = true;
                    const iade = h.faturaTipi === 2, q = iade ? h.giris : h.cikis, isaret = iade ? -1 : 1, mal = q * m.birimMaliyet;
                    if (iade)
                        s.iadeMiktar += q;
                    else
                        s.satisMiktar += q;
                    s.gelir += isaret * h.matrah;
                    s.maliyet += isaret * mal;
                    if (!iade && !(m.birimMaliyet > 0))
                        s.maliyetsizMiktar += q;
                    const g = gunler.get(h.gun) || { gun: h.gun, gelir: 0, maliyet: 0 };
                    g.gelir += isaret * h.matrah;
                    g.maliyet += isaret * mal;
                    gunler.set(h.gun, g);
                }
                else if (h.tur === STOK_BELGE.FIRE) {
                    donemde = true;
                    s.fireMiktar += h.cikis;
                    s.fireMaliyet += h.cikis * m.birimMaliyet;
                }
                else if (h.tur === STOK_BELGE.SAYIM) {
                    donemde = true;
                    s.sayimFarkMaliyet += (h.giris - h.cikis) * m.birimMaliyet;
                }
                else if (h.tur === STOK_BELGE.PARCALAMA)
                    parcalamaFarki += h.cikis * m.birimMaliyet - h.giris * h.bf;
            }
            if (!donemde)
                continue;
            s.satisMiktar = y4(s.satisMiktar);
            s.iadeMiktar = y4(s.iadeMiktar);
            s.netMiktar = y4(s.satisMiktar - s.iadeMiktar);
            s.gelir = yuvarla2(s.gelir);
            s.maliyet = yuvarla2(s.maliyet);
            s.kar = yuvarla2(s.gelir - s.maliyet);
            s.karYuzde = s.gelir ? Math.round((s.kar / s.gelir) * 10000) / 100 : null;
            s.fireMiktar = y4(s.fireMiktar);
            s.fireMaliyet = yuvarla2(s.fireMaliyet);
            s.sayimFarkMaliyet = yuvarla2(s.sayimFarkMaliyet);
            s.maliyetsizMiktar = y4(s.maliyetsizMiktar);
            urunler.push(s);
        }
        // Reçeteli satışlar; kart sonradan reçetesiz yapıldıysa aynı kartın satırıyla birleşir
        for (const s of (await this.receteliSatirlar(pool, f, gunler))) {
            const v = urunler.find((u) => u.stokKartId === s.stokKartId);
            if (!v) {
                urunler.push(s);
                continue;
            }
            v.satisMiktar = y4(v.satisMiktar + s.satisMiktar);
            v.iadeMiktar = y4(v.iadeMiktar + s.iadeMiktar);
            v.netMiktar = y4(v.satisMiktar - v.iadeMiktar);
            v.gelir = yuvarla2(v.gelir + s.gelir);
            v.maliyet = yuvarla2(v.maliyet + s.maliyet);
            v.kar = yuvarla2(v.gelir - v.maliyet);
            v.karYuzde = v.gelir ? Math.round((v.kar / v.gelir) * 10000) / 100 : null;
            v.maliyetsizMiktar = y4(v.maliyetsizMiktar + s.maliyetsizMiktar);
        }
        urunler.sort((a, b) => b.kar - a.kar || a.ad.localeCompare(b.ad, "tr"));
        const grupMap = new Map();
        for (const u of urunler) {
            const g = grupMap.get(u.grup) || { grup: u.grup, gelir: 0, maliyet: 0, kar: 0, fireMaliyet: 0 };
            g.gelir = yuvarla2(g.gelir + u.gelir);
            g.maliyet = yuvarla2(g.maliyet + u.maliyet);
            g.kar = yuvarla2(g.gelir - g.maliyet);
            g.fireMaliyet = yuvarla2(g.fireMaliyet + u.fireMaliyet);
            grupMap.set(u.grup, g);
        }
        const top = (k) => yuvarla2(urunler.reduce((t, u) => t + (Number(u[k]) || 0), 0));
        const toplam = { gelir: top("gelir"), maliyet: top("maliyet"), brutKar: 0, fireMaliyet: top("fireMaliyet"), sayimFarkMaliyet: top("sayimFarkMaliyet"), parcalamaFarki: yuvarla2(parcalamaFarki), netKar: 0, karYuzde: null, maliyetsizKalem: urunler.filter((u) => u.maliyetsizMiktar > 0).length };
        toplam.brutKar = yuvarla2(toplam.gelir - toplam.maliyet);
        toplam.netKar = yuvarla2(toplam.brutKar - toplam.fireMaliyet + toplam.sayimFarkMaliyet - toplam.parcalamaFarki);
        toplam.karYuzde = toplam.gelir ? Math.round((toplam.brutKar / toplam.gelir) * 10000) / 100 : null;
        return {
            suzgec: { baslangic: f.baslangic, bitis: f.bitis },
            toplam, urunler, gruplar: [...grupMap.values()].sort((a, b) => b.kar - a.kar),
            gunler: [...gunler.values()].filter((g) => g.gun >= f.baslangic).sort((a, b) => (a.gun < b.gun ? -1 : 1)).map((g) => ({ gun: g.gun, gelir: yuvarla2(g.gelir), maliyet: yuvarla2(g.maliyet), kar: yuvarla2(g.gelir - g.maliyet) })),
        };
    }
}

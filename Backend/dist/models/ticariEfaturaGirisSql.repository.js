import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { GECERLI_KDV_ORANLARI, girisSatirHesapla, yuvarla2 } from "../services/ticari/ticariHesap.js";
import { adNormal, birimCarpani, eslesmeAnahtarlari, efaturaGirisSatiri, kalemEslestir, ublFaturaOku } from "../services/ticari/efaturaKalem.js";
import { TicariStokSqlRepository, stokIslemKilidi } from "./ticariStokSql.repository.js";
import { TicariGirisSqlRepository } from "./ticariGirisSql.repository.js";
const temiz = (v) => String(v ?? "").trim();
const sadeNo = (v) => String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");
const sayi = (v) => { if (typeof v === "string")
    v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v; return Number(v); };
/** UBL birim kodu → kart birim adı (yeni kart için) */
const birimAdi = (kod) => ({ KGM: "Kg", GRM: "Gr", LTR: "Lt", MTR: "Mt", MTK: "M2" }[String(kod).toUpperCase()] || "Adet");
async function adaylariOku(r, vkn) {
    const q = await new sql.Request(r).input("V", sql.VarChar(11), vkn).query(`
    SELECT ANAHTAR, STOK_KART_ID, CARPAN FROM dbo.TODVZ_STOK_EFATURA_ESLESME WHERE SATICI_VKN = @V;
    SELECT B.BARKOD, B.STOK_KART_ID, ISNULL(U.CARPAN, 1) AS CARPAN FROM dbo.TODVZ_STOK_BARKOD B LEFT JOIN dbo.TODVZ_STOK_BIRIM U ON U.STOK_BIRIM_ID = B.STOK_BIRIM_ID;
    SELECT STOK_KART_ID, UPPER(RTRIM(KOD)) AS KOD, AD, RTRIM(ISNULL(BIRIM, 'Adet')) AS BIRIM FROM dbo.TODVZ_STOK_KART WHERE ISNULL(AKTIF, 1) = 1;`);
    const rs = q.recordsets;
    const a = { hatirlanan: new Map(), barkod: new Map(), kod: new Map(), ad: new Map(), birim: new Map() };
    for (const x of rs[0])
        a.hatirlanan.set(String(x.ANAHTAR), { stokKartId: Number(x.STOK_KART_ID), carpan: Number(x.CARPAN) });
    for (const x of rs[1])
        a.barkod.set(temiz(x.BARKOD), { stokKartId: Number(x.STOK_KART_ID), carpan: Number(x.CARPAN) || 1 });
    const adSay = new Map();
    for (const x of rs[2]) {
        const id = Number(x.STOK_KART_ID);
        a.kod.set(temiz(x.KOD), id);
        a.birim.set(id, temiz(x.BIRIM));
        const n = adNormal(x.AD);
        adSay.set(n, [...(adSay.get(n) || []), id]);
    }
    // Ad yalnız tek karta çıkıyorsa eşleşir (aynı adlı iki kart belirsizdir)
    for (const [n, ids] of adSay)
        if (ids.length === 1)
            a.ad.set(n, ids[0]);
    return a;
}
export class TicariEfaturaGirisSqlRepository {
    /** UBL'yi okur, tedarikçiyi ve kalem eşleşmelerini önerir; alınmışsa giriş fişini söyler */
    static async onizle(xml, ctx) {
        let f;
        try {
            f = ublFaturaOku(xml);
        }
        catch (e) {
            throw ApiError.badRequest(`Fatura okunamadı: ${e?.message || e}`);
        }
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const vkn = sadeNo(f.saticiVkn);
        const c = vkn ? (await pool.request().input("V", sql.VarChar(20), vkn).query(`SELECT TOP 2 CARI_KART_ID, RTRIM(KOD) AS KOD, RTRIM(AD) AS AD FROM dbo.TODVZ_CARI_KART
      WHERE REPLACE(LTRIM(RTRIM(ISNULL(VERGI_KIMLIK_NO, ''))), ' ', '') <> '' AND CAST(TRY_CAST(REPLACE(LTRIM(RTRIM(VERGI_KIMLIK_NO)), ' ', '') AS BIGINT) AS VARCHAR(20)) = @V ORDER BY CARI_KART_ID`)).recordset : [];
        const alinan = (await pool.request().input("E", sql.VarChar(40), f.ettn).query(`SELECT A.STOK_GIRIS_ID, G.FIS_NO FROM dbo.TODVZ_STOK_EFATURA_ALIM A LEFT JOIN dbo.TODVZ_STOK_GIRIS G ON G.STOK_GIRIS_ID = A.STOK_GIRIS_ID WHERE A.ETTN = @E`)).recordset[0];
        const a = await adaylariOku(pool, vkn);
        const kartAd = new Map();
        const k = await pool.request().query(`SELECT STOK_KART_ID, RTRIM(KOD) AS KOD, AD, RTRIM(ISNULL(BIRIM,'Adet')) AS BIRIM, ISNULL(SKT_TAKIBI, 0) AS SKT FROM dbo.TODVZ_STOK_KART`);
        for (const x of k.recordset)
            kartAd.set(Number(x.STOK_KART_ID), { kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM), sktTakibi: !!x.SKT });
        return {
            fatura: { ettn: f.ettn, faturaNo: f.faturaNo, tarih: f.tarih, faturaTipi: f.faturaTipi, paraBirimi: f.paraBirimi, saticiVkn: f.saticiVkn, saticiUnvan: f.saticiUnvan, matrah: f.matrah, odenecek: f.odenecek },
            cari: c.length === 1 ? { cariKartId: Number(c[0].CARI_KART_ID), kod: temiz(c[0].KOD), ad: temiz(c[0].AD) } : null,
            cariBirdenFazla: c.length > 1,
            alindi: alinan ? { stokGirisId: Number(alinan.STOK_GIRIS_ID), fisNo: temiz(alinan.FIS_NO) } : null,
            engel: f.faturaTipi === "IADE" || f.faturaTipi === "TEVKIFATIADE" ? "İade faturası stok girişine alınmaz." : f.paraBirimi !== "TRY" ? `Dövizli fatura (${f.paraBirimi}) bu sürümde stoğa alınmaz.` : null,
            satirlar: f.kalemler.map((x) => {
                const o = kalemEslestir(x, a);
                return { ...x, oneri: { ...o, kart: o.stokKartId ? kartAd.get(o.stokKartId) || null : null }, yeniKartBirimi: birimAdi(x.birimKodu) };
            }),
        };
    }
    /** Faturayı stoğa alır (Stok Giriş Fişi). Yeni kartlar işlemden önce açılır; ETTN işlem içinde kilitlenip denetlenir. */
    static async al(xml, g, kullaniciId, vezneId, ctx) {
        const o = await this.onizle(xml, ctx);
        if (o.engel)
            throw ApiError.badRequest(o.engel);
        if (o.alindi)
            throw ApiError.conflict(`Bu fatura (ETTN ${o.fatura.ettn}) zaten stoğa alındı: ${o.alindi.fisNo}.`);
        const cariKartId = Number(g.cariKartId) || o.cari?.cariKartId || 0;
        if (!cariKartId)
            throw ApiError.badRequest(`Tedarikçi (${o.fatura.saticiUnvan}, ${o.fatura.saticiVkn}) cari kartlarda bulunamadı; cari seçin.`);
        const secim = new Map((g.satirlar || []).map((s) => [Number(s.sira), s]));
        // Elle seçilen kartların birimi: çarpan verilmezse birimlerden bulunur (adet → adet 1, kg → gr 1000 …)
        const secilenIdler = [...new Set((g.satirlar || []).map((s) => Number(s.stokKartId)).filter((x) => x > 0))];
        const kartBirim = new Map();
        if (secilenIdler.length) {
            const pool0 = await TicariStokSqlRepository.havuz(ctx);
            const kb = await pool0.request().query(`SELECT STOK_KART_ID, RTRIM(ISNULL(BIRIM,'Adet')) AS BIRIM FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${secilenIdler.join(",")})`);
            for (const x of kb.recordset)
                kartBirim.set(Number(x.STOK_KART_ID), temiz(x.BIRIM));
            const yok = secilenIdler.find((x) => !kartBirim.has(x));
            if (yok)
                throw ApiError.badRequest(`Stok kartı bulunamadı (#${yok}).`);
        }
        const plan = [];
        for (const kalem of o.satirlar) {
            const s = secim.get(kalem.sira);
            if (s?.atla)
                continue;
            const stokKartId = Number(s?.stokKartId) || (s?.yeniKart ? null : kalem.oneri.stokKartId);
            if (!stokKartId && !s?.yeniKart)
                throw ApiError.badRequest(`${kalem.sira}. kalem (${kalem.ad}) bir karta eşlenmedi: kart seçin, yeni kart açın ya da atlayın.`);
            const verilen = s?.carpan !== undefined && s?.carpan !== null && s?.carpan !== "";
            const carpan = verilen ? sayi(s.carpan)
                : stokKartId && stokKartId === kalem.oneri.stokKartId ? kalem.oneri.carpan ?? NaN
                    : stokKartId ? birimCarpani(kalem.birimKodu, kartBirim.get(stokKartId) || "") ?? NaN
                        // Yeni kart faturanın birimiyle açılıyorsa 1; başka birim seçildi ve çeviri bilinmiyorsa çarpan sorulur (eskiden sessizce 1: koli → adet)
                        : s?.yeniKart ? birimCarpani(kalem.birimKodu, temiz(s.yeniKart.birim) || kalem.yeniKartBirimi) ?? ((temiz(s.yeniKart.birim) || kalem.yeniKartBirimi) === kalem.yeniKartBirimi ? 1 : NaN) : NaN;
            if (!(carpan > 0))
                throw ApiError.badRequest(`${kalem.sira}. kalem (${kalem.ad}): birim çarpanı yazılmalı (1 ${kalem.birimKodu} = kaç kart birimi).`);
            if (!GECERLI_KDV_ORANLARI.includes(kalem.kdvOrani))
                throw ApiError.badRequest(`${kalem.sira}. kalem (${kalem.ad}): KDV oranı %${kalem.kdvOrani} geçersiz.`);
            const skt = s && s.skt !== undefined ? temiz(s.skt) || null : kalem.skt;
            const partiNo = s && s.partiNo !== undefined ? temiz(s.partiNo) || null : kalem.partiNo;
            plan.push({ kalem, stokKartId, yeni: s?.yeniKart ?? null, carpan, hatirla: s?.hatirla !== false, skt, partiNo });
        }
        if (!plan.length)
            throw ApiError.badRequest("Stoğa alınacak kalem kalmadı.");
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tarih = g.tarih ? new Date(String(g.tarih)) : new Date(`${o.fatura.tarih}T09:00:00+03:00`);
        if (Number.isNaN(tarih.getTime()))
            throw ApiError.badRequest("Giriş tarihi okunamadı.");
        const tx = new sql.Transaction(pool);
        await tx.begin();
        await stokIslemKilidi(tx);
        let girisId = 0;
        let uyari = null;
        let satirlar = [];
        try {
            // ETTN kilidi önce: aynı faturaya eşzamanlı ikinci alım burada bekler ve "zaten alındı" alır (yeni kart da açmaz)
            const var_ = await new sql.Request(tx).input("E", sql.VarChar(40), o.fatura.ettn).query(`SELECT A.ALIM_ID, G.FIS_NO FROM dbo.TODVZ_STOK_EFATURA_ALIM A WITH (UPDLOCK, HOLDLOCK)
        LEFT JOIN dbo.TODVZ_STOK_GIRIS G ON G.STOK_GIRIS_ID = A.STOK_GIRIS_ID WHERE A.ETTN = @E`);
            if (var_.recordset.length)
                throw ApiError.conflict(`Bu fatura (ETTN ${o.fatura.ettn}) zaten stoğa alındı: ${temiz(var_.recordset[0].FIS_NO)}.`);
            // Yeni kartlar (fatura adı, birimi, KDV'si; satış fiyatı verilmezse 0) aynı işlemde: alım geri dönerse kart da kalmaz
            for (const p of plan.filter((x) => !x.stokKartId)) {
                const y = p.yeni || {};
                p.stokKartId = await TicariStokSqlRepository.kartYaz(tx, { ad: temiz(y.ad) || p.kalem.ad, birim: temiz(y.birim) || p.kalem.yeniKartBirimi, kdvOrani: y.kdvOrani ?? p.kalem.kdvOrani,
                    satisFiyati: Number(y.satisFiyati) || 0, stokGrupId: y.stokGrupId ?? null }, kullaniciId);
            }
            satirlar = plan.map((p) => ({ stokKartId: p.stokKartId, ...efaturaGirisSatiri(p.kalem, p.carpan), skt: p.skt, partiNo: p.partiNo }));
            const y = await TicariGirisSqlRepository.yaz(tx, { tarih: tarih.toISOString(), cariKartId, belgeNo: o.fatura.faturaNo, aciklama: `e-Fatura ${o.fatura.faturaNo} · ${o.fatura.saticiUnvan}`.slice(0, 250),
                vezneId, satirlar, eksiStokOnay: true }, kullaniciId, { sktZorunlu: true });
            girisId = y.id;
            uyari = y.uyari;
            await new sql.Request(tx).input("E", sql.VarChar(40), o.fatura.ettn).input("N", sql.VarChar(30), o.fatura.faturaNo.slice(0, 30)).input("V", sql.VarChar(11), sadeNo(o.fatura.saticiVkn).slice(0, 11) || null)
                .input("C", sql.Int, cariKartId).input("G", sql.Int, girisId).input("T", sql.Decimal(18, 2), o.fatura.odenecek).input("K", sql.Int, kullaniciId || null)
                .query(`INSERT INTO dbo.TODVZ_STOK_EFATURA_ALIM (ETTN, FATURA_NO, SATICI_VKN, CARI_KART_ID, STOK_GIRIS_ID, FATURA_TUTARI, EKLEYEN_ID) VALUES (@E, @N, @V, @C, @G, @T, @K)`);
            const vkn = sadeNo(o.fatura.saticiVkn).slice(0, 11);
            if (vkn) {
                for (const p of plan.filter((x) => x.hatirla)) {
                    // Anahtar birimlidir (T6): hatırlanan çarpan yalnız aynı birimle gelen faturada kullanılır
                    const anahtar = eslesmeAnahtarlari(p.kalem)[0].birimli;
                    await new sql.Request(tx).input("V", sql.VarChar(11), vkn).input("A", sql.NVarChar(260), anahtar).input("K", sql.Int, p.stokKartId).input("C", sql.Decimal(18, 6), p.carpan).query(`
            MERGE dbo.TODVZ_STOK_EFATURA_ESLESME AS H USING (SELECT @V AS V, @A AS A) AS S ON H.SATICI_VKN = S.V AND H.ANAHTAR = S.A
            WHEN MATCHED THEN UPDATE SET STOK_KART_ID = @K, CARPAN = @C, GUNCELLEME_ZAMANI = GETDATE()
            WHEN NOT MATCHED THEN INSERT (SATICI_VKN, ANAHTAR, STOK_KART_ID, CARPAN) VALUES (@V, @A, @K, @C);`);
                }
            }
            await tx.commit();
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            if (err?.number === 2627 || err?.number === 2601 || /UQ_TODVZ_STOK_EFATURA_ALIM_ETTN/.test(String(err?.message)))
                throw ApiError.conflict(`Bu fatura (ETTN ${o.fatura.ettn}) zaten stoğa alındı.`);
            throw err;
        }
        if (g.gelenUuid) {
            const { EbelgeSqlRepository } = await import("./ebelgeSql.repository.js");
            await EbelgeSqlRepository.setGelenOkunmaDurumu(String(g.gelenUuid), { islendiMi: true }, ctx).catch((e) => logger.warn("Gelen belge işlendi işareti yazılamadı:", e?.message || e));
        }
        const fis = await TicariGirisSqlRepository.getir(girisId, ctx);
        // Fatura toplamıyla karşılaştırma (atlanan kalem, KDV dışı vergi ya da yuvarlama farkı)
        const girisToplam = yuvarla2(satirlar.reduce((t, s) => t + girisSatirHesapla(s.miktar, s.birimFiyat, s.kdvOrani).toplamTutar, 0));
        return { fis, uyari, fatura: o.fatura, girisToplam, fark: yuvarla2(o.fatura.odenecek - girisToplam), yeniKartSayisi: plan.filter((x) => !!x.yeni).length };
    }
    /** Gelen kutusundaki e-Faturalar (yerel kayıt) + stoğa alındıysa giriş fişi */
    static async gelenListe(f = {}, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const var_ = (await pool.request().query(`SELECT OBJECT_ID('dbo.TODVZ_EBELGE_GELEN','U') AS V`)).recordset[0]?.V;
        if (!var_)
            return [];
        const req = pool.request();
        const k = ["ISNULL(G.FATURA_TIPI,'') NOT IN ('IADE','TEVKIFATIADE')"];
        if (f.baslangic) {
            req.input("B", sql.VarChar(10), temiz(f.baslangic).slice(0, 10));
            k.push("CAST(G.DUZENLEME_TARIHI AS date) >= CAST(@B AS date)");
        }
        if (f.bitis) {
            req.input("E", sql.VarChar(10), temiz(f.bitis).slice(0, 10));
            k.push("CAST(G.DUZENLEME_TARIHI AS date) <= CAST(@E AS date)");
        }
        if (temiz(f.arama)) {
            req.input("A", sql.NVarChar(120), `%${temiz(f.arama)}%`);
            k.push("(G.BELGE_NO LIKE @A OR G.SUPPLIER LIKE @A OR G.SENDER LIKE @A)");
        }
        const r = await req.query(`SELECT TOP 500 G.UUID, G.BELGE_NO, G.SENDER, G.SUPPLIER, G.DUZENLEME_TARIHI, G.TUTAR, G.PARA_BIRIMI, G.FATURA_TIPI, A.STOK_GIRIS_ID, SG.FIS_NO
      FROM dbo.TODVZ_EBELGE_GELEN G LEFT JOIN dbo.TODVZ_STOK_EFATURA_ALIM A ON A.ETTN = LOWER(G.UUID) LEFT JOIN dbo.TODVZ_STOK_GIRIS SG ON SG.STOK_GIRIS_ID = A.STOK_GIRIS_ID
      WHERE ${k.join(" AND ")} ORDER BY G.DUZENLEME_TARIHI DESC`);
        return r.recordset.map((x) => ({ uuid: temiz(x.UUID), belgeNo: temiz(x.BELGE_NO), saticiVkn: temiz(x.SENDER), saticiUnvan: temiz(x.SUPPLIER), tarih: x.DUZENLEME_TARIHI ? new Date(x.DUZENLEME_TARIHI).toISOString() : null,
            tutar: x.TUTAR === null ? null : Number(x.TUTAR), paraBirimi: temiz(x.PARA_BIRIMI) || "TRY", faturaTipi: temiz(x.FATURA_TIPI), alindi: x.STOK_GIRIS_ID ? { stokGirisId: Number(x.STOK_GIRIS_ID), fisNo: temiz(x.FIS_NO) } : null }));
    }
    /** Gelen faturanın UBL'si ICE'den (yalnız okuma) */
    static async iceUbl(uuid, ctx) {
        const { EbelgeSqlRepository } = await import("./ebelgeSql.repository.js");
        const { getInvoices, contentToXml } = await import("../services/ice/ice.efatura.js");
        const config = await EbelgeSqlRepository.getConnectionConfig(ctx);
        const { faturalar } = await getInvoices(config, { uuid, yon: "IN", limit: 1, okunmuslarDahil: true, islenmislerDahil: true }, false);
        const c = faturalar[0]?.CONTENT;
        if (!c)
            throw ApiError.notFound("Faturanın içeriği ICE'den alınamadı.");
        return contentToXml(String(c));
    }
}

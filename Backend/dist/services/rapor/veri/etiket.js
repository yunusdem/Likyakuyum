import sql from "mssql";
import { aralikOzeti, filtreler, kurCoz, kurTarihte, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";
import { YEREL_GUN, saatTr } from "../kaynak.js";
/** Fatura satırı (S) ↔ altın ürün (U) eşleşmesi */
const SATIR_URUN = `(S.ALTIN_URUN_ID=U.ALTIN_URUN_ID OR (ISNULL(S.ALTIN_URUN_ID,0)=0 AND LEN(LTRIM(RTRIM(ISNULL(S.BARKOD,''))))>0 AND S.BARKOD=U.BARKOD))`;
/** Ürünün fiş hareketleri (satış FATURA_TIPI=1; alış / iade stoğa geri alır) — iptal hariç */
const URUN_FISLERI = `dbo.TODVZ_FATURA_SATIRI S JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID=S.FATURA_ID WHERE ${SATIR_URUN} AND ISNULL(F.E_BELGE_DURUMU,0)<>4`;
/**
 * Ürün @gun sonunda satılmış mı: o güne kadarki son fiş satırı satışsa evet; o güne kadar fiş satırı yoksa hayır —
 * yalnız hiç fiş satırı olmayan ve SATILDI=1 işaretli ürün (kaydı olmayan satış) satılmış sayılır. @gun NULL → bugünkü durum.
 */
const SATILMIS = `(ISNULL((SELECT TOP 1 CASE WHEN F.FATURA_TIPI=1 THEN 1 ELSE 0 END FROM ${URUN_FISLERI} AND (@gun IS NULL OR ${YEREL_GUN("F.TARIH")}<=@gun) ORDER BY F.TARIH DESC, S.FATURA_SATIR_ID DESC),
  CASE WHEN ISNULL(U.SATILDI,0)=1 AND NOT EXISTS (SELECT 1 FROM ${URUN_FISLERI}) THEN 1 ELSE 0 END)=1)`;
async function tablolar(pool) {
    const r = (await pool.request().query(`SELECT
    CASE WHEN OBJECT_ID('dbo.TODVZ_ALTIN_URUN','U') IS NULL THEN 0 ELSE 1 END urun,
    CASE WHEN OBJECT_ID('dbo.TODVZ_FATURA_SATIRI','U') IS NULL OR OBJECT_ID('dbo.TODVZ_FATURA','U') IS NULL THEN 0 ELSE 1 END fatura,
    CASE WHEN OBJECT_ID('dbo.TODVZ_FATURA_ODEME','U') IS NULL THEN 0 ELSE 1 END odeme,
    (SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD))='HAS' ORDER BY PARA_ID) hasId`)).recordset[0];
    return { urun: !!r.urun, fatura: !!r.fatura, odeme: !!r.odeme, hasId: Number(r.hasId) || 0 };
}
/** Ürün kartı süzgeçleri: ayar, grup kodu, üretici firma, banko, serbest arama (barkod / model / orijinal kod / grup-no) */
function urunSuzgeci(req, p) {
    const f = [];
    if (p.urunAyar) {
        req.input("uAyar", sql.VarChar(50), p.urunAyar.trim());
        f.push("RTRIM(U.AYAR)=@uAyar");
    }
    if (p.urunGrup) {
        req.input("uGrup", sql.VarChar(50), p.urunGrup.trim().toUpperCase());
        f.push("UPPER(RTRIM(U.GRUP_KODU))=@uGrup");
    }
    if (p.urunUretici) {
        req.input("uUretici", sql.VarChar(150), p.urunUretici.trim());
        f.push("RTRIM(U.URETICI_FIRMA)=@uUretici");
    }
    if (p.urunBanko) {
        req.input("uBanko", sql.VarChar(50), p.urunBanko.trim());
        f.push("RTRIM(U.BANKO)=@uBanko");
    }
    if (p.arama?.trim()) {
        req.input("uAra", sql.NVarChar(120), `%${p.arama.trim()}%`);
        f.push("(U.BARKOD LIKE @uAra OR U.MODEL LIKE @uAra OR U.ORJINAL_KOD LIKE @uAra OR RTRIM(U.GRUP_KODU)+'-'+CAST(U.URUN_NO AS varchar(12)) LIKE @uAra)");
    }
    return f.map(x => ` AND ${x}`).join("");
}
const urunOzeti = (p) => [
    p.urunAyar ? `Ayar: ${p.urunAyar}` : "", p.urunGrup ? `Grup: ${p.urunGrup}` : "", p.urunUretici ? `Üretici: ${p.urunUretici}` : "",
    p.urunBanko ? `Banko: ${p.urunBanko}` : "", p.arama?.trim() ? `Arama: ${p.arama.trim()}` : "",
].filter(Boolean).map(x => ` · ${x}`).join("");
const y2 = (n) => Math.round(n * 100) / 100;
const y4 = (n) => Math.round(n * 10000) / 10000;
const grupNo = (r) => (r.urunNo == null ? String(r.grupKodu || "").trim() : `${String(r.grupKodu || "").trim()}-${r.urunNo}`);
const gunMetni = (v) => (v ? new Date(v).toISOString().slice(0, 10) : "");
/** Ürün kartı kolonları (üretim ve stok raporu ortak) */
const URUN_KOLONLARI = `U.ALTIN_URUN_ID urunId, ${YEREL_GUN("U.TARIH")} tarih, RTRIM(ISNULL(U.GRUP_KODU,'')) grupKodu, U.URUN_NO urunNo, RTRIM(ISNULL(U.BARKOD,'')) barkod,
  RTRIM(ISNULL(U.AYAR,'')) ayar, RTRIM(ISNULL(U.MODEL,'')) model, RTRIM(ISNULL(U.URETICI_FIRMA,'')) uretici, RTRIM(ISNULL(U.BANKO,'')) banko,
  RTRIM(ISNULL(U.ORJINAL_KOD,'')) orjinalKod, ISNULL(U.MIKTAR,0) gram, ISNULL(U.HAS_GRAM,0) hasGram,
  ISNULL(U.MALIYET_ISCILIK_TUTARI,0) iscilikMaliyet, ISNULL(U.SATIS_ISCILIK_TUTARI,0) satisIscilik, ISNULL(U.MALIYET,0) maliyet, ISNULL(U.SATIS_FIYATI,0) satisFiyati,
  ISNULL(RTRIM(V.KOD)+' '+RTRIM(V.AD),'') vezne, RTRIM(ISNULL(K.AD,'')) kaydeden`;
const URUN_KAYNAGI = `dbo.TODVZ_ALTIN_URUN U LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=U.VEZNE_ID LEFT JOIN dbo.TODVZ_KULLANICI K ON K.KULLANICI_ID=U.EKLEYEN_ID`;
/** Seçilen kurla HAS → TL (alış / satış; "ikisi" seçilince satış kuruyla ek kolonlar) */
async function hasKurlari(pool, p, hasId) {
    const kur = await kurCoz(pool, p);
    return { alis: hasId ? kur.kurlar.get(hasId) || 0 : 0, satis: hasId ? kur.satisKurlari.get(hasId) || 0 : 0, ikisi: kur.ikisi, aciklama: kur.aciklama };
}
/** Grup anahtarı / başlığı (siralama parametresi) */
function grupla(r, kip) {
    switch (kip) {
        case "gun": return { grup: gunMetni(r.tarih), grupBaslik: tarihTr(gunMetni(r.tarih)) };
        case "uretici": return { grup: r.uretici, grupBaslik: `Üretici: ${r.uretici || "(boş)"}` };
        case "banko": return { grup: r.banko, grupBaslik: `Banko: ${r.banko || "(boş)"}` };
        case "grup": return { grup: r.grupKodu, grupBaslik: `Grup kodu: ${r.grupKodu || "(boş)"}` };
        default: return { grup: r.ayar, grupBaslik: `Ayar: ${r.ayar || "(boş)"}` };
    }
}
const sirala = (a, b) => String(a.grup).localeCompare(String(b.grup), "tr") || gunMetni(a.tarih).localeCompare(gunMetni(b.tarih)) || String(a.grupNo).localeCompare(String(b.grupNo), "tr", { numeric: true });
/** Ayar bazında özet (rapor sonundaki tablo): sayısal alanlar toplanır, sonda Toplam satırı */
function ayarOzeti(satirlar, alanlar, ondalik) {
    const m = new Map();
    const toplam = { ayar: "Toplam", adet: 0 };
    for (const s of satirlar) {
        const o = m.get(s.ayar) || { ayar: s.ayar || "(boş)", adet: 0 };
        o.adet += Number(s.adet ?? 1);
        toplam.adet += Number(s.adet ?? 1);
        for (const a of alanlar) {
            o[a] = (o[a] || 0) + (Number(s[a]) || 0);
            toplam[a] = (toplam[a] || 0) + (Number(s[a]) || 0);
        }
        m.set(s.ayar, o);
    }
    const yuvarla = (o) => { for (const a of alanlar)
        o[a] = (ondalik[a] === 2 ? y2 : y4)(o[a] || 0); return o; };
    const liste = [...m.values()].sort((a, b) => String(a.ayar).localeCompare(String(b.ayar), "tr")).map(yuvarla);
    return liste.length ? [...liste, yuvarla(toplam)] : [];
}
/** Tahsilat şekli metni: "Nakit 2,5000 HAS · POS 1.000,00 TL" (ödeme satırları kendi parasında) */
const ODEME_ARACI = { 0: "Nakit", 1: "Cari", 2: "POS", 3: "Havale" };
function miktarMetni(miktar, kod) {
    const tl = ["TL", "TRY"].includes(kod.toUpperCase());
    return `${Number(miktar || 0).toLocaleString("tr-TR", { minimumFractionDigits: tl ? 2 : 0, maximumFractionDigits: tl ? 2 : 4 })} ${kod}`;
}
export const ETIKET_SORGULARI = {
    /** Barkodlu Altın Üretim Raporu: kayıt tarihi aralıkta barkodlanan altın ürünler; durum bugünkü (stokta / satıldı) */
    BALURE1: async (pool, p, t) => {
        const d = await tablolar(pool);
        const ozet = `${aralikOzeti(p)}${ozetEk(p)}${urunOzeti(p)}`;
        if (!d.urun)
            return sinirla([], t, ozet, "Barkodlu altın ürün tablosu bulunamadı.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("gun", sql.Date, null);
        const f = filtreler(req, p, { vezne: "V" }) + urunSuzgeci(req, p);
        const ham = (await req.query(`
      SELECT ${URUN_KOLONLARI}, CASE WHEN ${d.fatura ? SATILMIS : "ISNULL(U.SATILDI,0)=1"} THEN 1 ELSE 0 END satildi
      FROM ${URUN_KAYNAGI}
      WHERE ${YEREL_GUN("U.TARIH")} BETWEEN @bas AND @bit${f}`)).recordset;
        const kur = await hasKurlari(pool, p, d.hasId);
        const kip = p.siralama || "ayar";
        const satirlar = ham.map((r) => ({
            ...r, ...grupla(r, kip), grupNo: grupNo(r), adet: 1,
            gram: y4(Number(r.gram)), hasGram: y4(Number(r.hasGram)), iscilikMaliyet: y4(Number(r.iscilikMaliyet)), satisIscilik: y4(Number(r.satisIscilik)),
            maliyet: y4(Number(r.maliyet)), satisFiyati: y4(Number(r.satisFiyati)),
            hasKuru: kur.alis, maliyetTl: y2(Number(r.maliyet) * kur.alis), satisFiyatiTl: y2(Number(r.satisFiyati) * kur.alis),
            ...(kur.ikisi ? { kurSatis: kur.satis, maliyetTlSatis: y2(Number(r.maliyet) * kur.satis), satisFiyatiTlSatis: y2(Number(r.satisFiyati) * kur.satis) } : {}),
            durum: r.satildi ? "Satıldı" : "Stokta",
        })).sort(sirala);
        const alanlar = ["gram", "hasGram", "iscilikMaliyet", "satisIscilik", "maliyet", "maliyetTl", "satisFiyati", "satisFiyatiTl"];
        return sinirla(satirlar, t, `${ozet} · ${kur.aciklama}`, "Seçilen aralıkta barkodlanan altın ürün yok.", ayarOzeti(satirlar, alanlar, { maliyetTl: 2, satisFiyatiTl: 2 }));
    },
    /**
     * Barkodlu Altın Satış Raporu: perakende fişiyle satılan barkodlu altınlar (fatura tarihi). Alış / iade fişiyle geri alınan ürün eksi satır.
     * Tutarlar fişte yazıldığı gibi (fişin parası; yanında TL). Maliyet ürün kartından (HAS); HAS ↔ TL çevrimi fatura günü kuruyla.
     * Tahsilat şekli faturanın ilk satırında: ödeme satırları kendi para birimi ve miktarıyla.
     */
    BALSAT1: async (pool, p, t) => {
        const d = await tablolar(pool);
        const ozet = `${aralikOzeti(p)}${ozetEk(p)}${urunOzeti(p)}`;
        if (!d.urun || !d.fatura)
            return sinirla([], t, ozet, "Barkodlu altın veya perakende fişi tablosu bulunamadı.");
        const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
        const f = filtreler(req, p, { vezne: "V", cari: "C" }) + urunSuzgeci(req, p);
        const ham = (await req.query(`
      SELECT F.FATURA_ID faturaId, S.FATURA_SATIR_ID satirId, ${YEREL_GUN("F.TARIH")} tarih, F.TARIH zaman, RTRIM(ISNULL(F.FATURA_NO,'')) faturaNo,
        COALESCE(NULLIF(RTRIM(C.AD),''), RTRIM(F.ALICI_UNVAN), '') musteri, CASE WHEN F.FATURA_TIPI=1 THEN 1 ELSE -1 END isaret,
        U.ALTIN_URUN_ID urunId, RTRIM(ISNULL(U.GRUP_KODU,'')) grupKodu, U.URUN_NO urunNo, RTRIM(COALESCE(NULLIF(U.BARKOD,''), S.BARKOD, '')) barkod,
        RTRIM(COALESCE(NULLIF(U.MODEL,''), S.URUN_ADI, '')) model, RTRIM(COALESCE(NULLIF(U.AYAR,''), S.AYAR, '')) ayar,
        RTRIM(ISNULL(U.URETICI_FIRMA,'')) uretici, RTRIM(ISNULL(U.BANKO,'')) banko,
        COALESCE(NULLIF(S.GRAM,0), U.MIKTAR, 0) gram, COALESCE(NULLIF(S.HAS_GRAM,0), U.HAS_GRAM, 0) hasGram, ISNULL(U.MALIYET,0) maliyet,
        ISNULL(S.TUTAR,0) tutar, ISNULL(S.KDV_TUTARI,0) kdv, ISNULL(S.TOPLAM_TUTAR,0) toplamTutar,
        F.PARA_ID faturaParaId, RTRIM(ISNULL(FP.KOD,'TL')) para, ISNULL(F.KUR,1) faturaKur, ISNULL(RTRIM(V.KOD)+' '+RTRIM(V.AD),'') vezne
      FROM dbo.TODVZ_FATURA_SATIRI S JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID=S.FATURA_ID
        JOIN dbo.TODVZ_ALTIN_URUN U ON ${SATIR_URUN}
        LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=F.CARI_KART_ID
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
        LEFT JOIN dbo.TODVZ_PARA FP ON FP.PARA_ID=F.PARA_ID
      WHERE ISNULL(F.E_BELGE_DURUMU,0)<>4 AND ${YEREL_GUN("F.TARIH")} BETWEEN @bas AND @bit${f}
      ORDER BY F.TARIH, F.FATURA_ID, S.SATIR_NO, S.FATURA_SATIR_ID`)).recordset;
        // Tahsilat: faturaların ödeme satırları (kendi parasında)
        const tahsilat = new Map();
        const faturaIdler = [...new Set(ham.map((r) => Number(r.faturaId)))];
        if (d.odeme && faturaIdler.length) {
            for (let i = 0; i < faturaIdler.length; i += 500) {
                const parca = faturaIdler.slice(i, i + 500);
                const r = await pool.request().query(`
          SELECT O.FATURA_ID id, ISNULL(O.ODEME_ARACI_TURU,0) arac, RTRIM(COALESCE(NULLIF(P.KOD,''), O.PARA_KODU, 'TL')) kod,
            SUM(ISNULL(NULLIF(O.MIKTAR,0), O.TUTAR/NULLIF(O.KUR,0))) miktar
          FROM dbo.TODVZ_FATURA_ODEME O LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=O.PARA_ID
          WHERE O.FATURA_ID IN (${parca.join(",")})
          GROUP BY O.FATURA_ID, ISNULL(O.ODEME_ARACI_TURU,0), RTRIM(COALESCE(NULLIF(P.KOD,''), O.PARA_KODU, 'TL'))
          ORDER BY O.FATURA_ID, MIN(O.SATIR_NO)`);
                for (const o of r.recordset) {
                    if (!Number(o.miktar))
                        continue;
                    const parca2 = `${ODEME_ARACI[Number(o.arac)] || "Diğer"} ${miktarMetni(Number(o.miktar), String(o.kod))}`;
                    tahsilat.set(Number(o.id), tahsilat.has(Number(o.id)) ? `${tahsilat.get(Number(o.id))} · ${parca2}` : parca2);
                }
            }
        }
        // Fatura günü HAS kuru (gün başına tek sorgu)
        const gunKuru = new Map();
        for (const g of new Set(ham.map((r) => gunMetni(r.tarih))))
            gunKuru.set(g, d.hasId ? (await kurTarihte(pool, g)).get(d.hasId) || 0 : 0);
        const tlId = Number((await pool.request().query(`SELECT TOP 1 PARA_ID id FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID`)).recordset[0]?.id || 1);
        let oncekiFatura = -1;
        const satirlar = ham.map((r) => {
            const s = Number(r.isaret);
            const hasKuru = gunKuru.get(gunMetni(r.tarih)) || 0;
            const faturaTl = r.faturaParaId == null || Number(r.faturaParaId) === tlId || !Number(r.faturaKur) ? 1 : Number(r.faturaKur);
            const tutar = s * Number(r.tutar), satisTl = tutar * faturaTl;
            const maliyet = s * Number(r.maliyet), maliyetTl = maliyet * hasKuru;
            const satisHas = hasKuru > 0 ? satisTl / hasKuru : 0;
            const ilk = Number(r.faturaId) !== oncekiFatura;
            oncekiFatura = Number(r.faturaId);
            return {
                tarih: r.tarih, saat: saatTr(r.zaman), faturaNo: r.faturaNo, musteri: r.musteri, islem: s > 0 ? "Satış" : "İade",
                barkod: r.barkod, grupNo: grupNo(r), model: r.model, ayar: r.ayar, uretici: r.uretici, banko: r.banko, vezne: r.vezne,
                adet: s, gram: y4(s * Number(r.gram)), hasGram: y4(s * Number(r.hasGram)),
                tutar: y2(tutar), kdv: y2(s * Number(r.kdv)), toplamTutar: y2(s * Number(r.toplamTutar)), para: r.para || "TL",
                satisTl: y2(satisTl), satisHas: y4(satisHas), hasKuru,
                maliyet: y4(maliyet), maliyetTl: y2(maliyetTl), kar: y4(satisHas - maliyet), karTl: y2(satisTl - maliyetTl),
                karYuzde: maliyetTl ? y2(((satisTl - maliyetTl) / Math.abs(maliyetTl)) * 100) : null,
                tahsilat: ilk ? tahsilat.get(Number(r.faturaId)) || "" : "",
            };
        });
        const alanlar = ["gram", "hasGram", "tutar", "kdv", "satisTl", "satisHas", "maliyet", "maliyetTl", "kar", "karTl"];
        return sinirla(satirlar, t, ozet, "Seçilen aralıkta perakende fişiyle satılan barkodlu altın yok.", ayarOzeti(satirlar, alanlar, { tutar: 2, kdv: 2, satisTl: 2, maliyetTl: 2, karTl: 2 }));
    },
    /** Barkodlu Altın Stok Raporu: seçilen gün sonunda stokta olan barkodlu altınlar (o güne kadar barkodlanmış, satılmamış) */
    BALSTK1: async (pool, p, t) => {
        const d = await tablolar(pool);
        const gun = p.tarih || new Date().toISOString().slice(0, 10);
        const ozet = `${tarihTr(gun)} itibarıyla${ozetEk(p)}${urunOzeti(p)}`;
        if (!d.urun)
            return sinirla([], t, ozet, "Barkodlu altın ürün tablosu bulunamadı.");
        const req = pool.request().input("gun", sql.Date, gun);
        const f = filtreler(req, p, { vezne: "V" }) + urunSuzgeci(req, p);
        const ham = (await req.query(`
      SELECT ${URUN_KOLONLARI}, DATEDIFF(day, ${YEREL_GUN("U.TARIH")}, @gun) bekleme
      FROM ${URUN_KAYNAGI}
      WHERE ${YEREL_GUN("U.TARIH")}<=@gun AND NOT ${d.fatura ? SATILMIS : "(ISNULL(U.SATILDI,0)=1)"}${f}`)).recordset;
        const kur = await hasKurlari(pool, { ...p, kurTarihi: p.kurTarihi || gun }, d.hasId);
        const kip = p.siralama || "ayar";
        const satirlar = ham.map((r) => ({
            ...r, ...grupla(r, kip), grupNo: grupNo(r), adet: 1,
            gram: y4(Number(r.gram)), hasGram: y4(Number(r.hasGram)), iscilikMaliyet: y4(Number(r.iscilikMaliyet)), satisIscilik: y4(Number(r.satisIscilik)),
            maliyet: y4(Number(r.maliyet)), satisFiyati: y4(Number(r.satisFiyati)),
            hasKuru: kur.alis, maliyetTl: y2(Number(r.maliyet) * kur.alis), satisFiyatiTl: y2(Number(r.satisFiyati) * kur.alis),
            ...(kur.ikisi ? { kurSatis: kur.satis, maliyetTlSatis: y2(Number(r.maliyet) * kur.satis), satisFiyatiTlSatis: y2(Number(r.satisFiyati) * kur.satis) } : {}),
        })).sort(sirala);
        const alanlar = ["gram", "hasGram", "iscilikMaliyet", "maliyet", "maliyetTl", "satisFiyati", "satisFiyatiTl"];
        return sinirla(satirlar, t, `${ozet} · ${kur.aciklama}`, "Seçilen tarihte stokta barkodlu altın yok.", ayarOzeti(satirlar, alanlar, { maliyetTl: 2, satisFiyatiTl: 2 }));
    },
};

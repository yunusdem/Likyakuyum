import { TL_PARA_SQL } from "./raporOrtak.js";
import { PERAKENDE_SATIR_PARASI, belgeTablolari } from "./kaynak.js";
/**
 * Sektör bölümleri için birleşik fiş kaynağı (docs/SEKTORLU_RAPORLAR_YOL_HARITASI.md K1 / K10 / B22, docs/RAPOR_ESITLEME_UYGULAMA.md 1.7).
 * Fiş okuyan raporlar `dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S` yerine buradaki `F` ve `S` türetilmiş tablolarını kullanır; kolon adları
 * TODVZ_FIS / TODVZ_FIS_SATIRI ile aynıdır, ek olarak `BOLUM` (1 Döviz fişi, 2 Sarraf fişi, 3 Perakende fişi, 4 Ticari fiş) gelir.
 * Bölümler firmanın lisansına göre süzülür. Yalnızca SELECT.
 *
 * Eşlemeler:
 *  - Sarraf fişi: FIS_NO → BELGE_NO, SAAT → ZAMAN, ürün → PARA_ID; miktar ürün tipine göre gram ya da adet (Kâr/Zarar ile aynı kural); işçilik → ISCILIK (TL).
 *  - Perakende / ticari fiş (TODVZ_FATURA): FATURA_NO → BELGE_NO, ALICI_UNVAN → UNVAN, ALICI_VKN_TCKN → VERGI_KIMLIK_NO, saat UTC → İstanbul (+3),
 *    FATURA_TIPI 1 → satış, E_BELGE_DURUMU 4 → IPTAL; tutarlar fatura kuruyla TL. Perakende barkodsuz satır: stok parası ve miktarı; barkodlu satır: HAS gramı
 *    (para = HAS); ticari satır: fatura parası (yoksa TL), miktar = adet. Kimlik alanları (meslek, doğum tarihi, uyruk, pasaport …) bu fişlerde yoktur → NULL.
 *  - Komisyon, BSMV, KMV yalnız döviz fişinde vardır; diğer bölümlerde 0.
 * FIS_ID kaynaklar arasında tekildir (sarraf +500.000.000, perakende +1.000.000.000, ticari +1.500.000.000) → `S.FIS_ID=F.FIS_ID` aynen çalışır.
 */
export const BOLUM_ADI = { 1: "Döviz fişi", 2: "Sarraf fişi", 3: "Perakende fişi", 4: "Ticari fiş" };
export const FIS_ID_KAYMASI = { 1: 0, 2: 500000000, 3: 1000000000, 4: 1500000000 };
/** Lisansa göre bölümler (K10): modül listesi null = kısıt yok; tablo yoksa bölüm zaten yok */
export function acikBolumler(moduller, d) {
    const acik = (kod) => moduller == null || moduller.includes(kod);
    const b = new Set();
    if (acik("vezne:vezne/doviz-fisi-kayit"))
        b.add(1);
    if (d.sarraf && acik("vezne:vezne/sarraf-fisi-kayit"))
        b.add(2);
    if (d.perakende && acik("vezne:vezne/perakende-fisi-kayit"))
        b.add(3);
    if (d.ticariSatir && (moduller == null || moduller.some(m => m === "ticari" || m.startsWith("ticari:"))))
        b.add(4);
    return b;
}
const F_KOLONLARI = `FIS_ID, BOLUM, VEZNE_ID, TIP, TARIH, ZAMAN, SERI_NO, BELGE_NO, ISTATISTIK_ID, CARI_KART_ID, UNVAN, KISILIK_TIPI, UYRUK_ID, ULKE_ID, VERGI_DAIRESI_ID,
    VERGI_KIMLIK_NO, BABA_ADI, ADRES, PASAPORT_NO, TOPLAM_TUTAR, ODEME_TUTARI, EKLEYEN_ID, EKLEME_ZAMANI, GISE_USD_KURU, IPTAL, IPTAL_TARIHI, DOGUM_TARIHI, DOGUM_YERI,
    KIMLIK_SERI_NO, ANNE_ADI, MASAK_LISTESINDE_VAR, MESLEK_ID, SUPHELI_ISLEMLER_YETKILI_ID, BELGE_TURU, TELEFON_NO`;
const S_KOLONLARI = `FIS_ID, BOLUM, SATIR_NO, PARA_ID, MIKTAR, KUR, GISE_KURU, TUTAR, KOMISYON_ORANI, KOMISYON, BMV_ORANI, BMV, ISCILIK, KDV_ORANI, KDV, KMV_ORANI, KMV`;
/**
 * Birleşik fiş kaynağı. `yalniz`: yalnız bu bölümler (lisansla kesişimi alınır) — döviz fişine özgü raporlar için [1].
 * Tek bölüm Döviz ise türetilmiş tablo TODVZ_FIS'in kendisidir (tüm kolonlar, aynı sorgu planı).
 */
export async function fisKaynagi(pool, p, secenek) {
    const d = await belgeTablolari(pool);
    let bolumler = acikBolumler(p.acikModuller, d);
    if (secenek?.yalniz)
        bolumler = new Set([...bolumler].filter(b => secenek.yalniz.includes(b)));
    const bolumAd = (b) => BOLUM_ADI[Number(b)] || "";
    const dovizF = `(SELECT F0.*, CAST(1 AS int) BOLUM FROM dbo.TODVZ_FIS F0) F`, dovizS = `(SELECT S0.*, CAST(1 AS int) BOLUM FROM dbo.TODVZ_FIS_SATIRI S0) S`;
    if (!bolumler.size || (bolumler.size === 1 && bolumler.has(1))) {
        // Hiç bölüm açık değilse boş sonuç dönsün diye döviz kaynağı 1=0 ile kısılır
        return bolumler.size ? { F: dovizF, S: dovizS, bolumler, d, bolumAd }
            : { F: `(SELECT F0.*, CAST(1 AS int) BOLUM FROM dbo.TODVZ_FIS F0 WHERE 1=0) F`, S: dovizS, bolumler, d, bolumAd };
    }
    const k = (await pool.request().query(`SELECT
    CASE WHEN COL_LENGTH('dbo.TODVZ_FATURA','FIS_KAYNAGI') IS NULL THEN 0 ELSE 1 END fisKaynagi,
    CASE WHEN COL_LENGTH('dbo.TODVZ_FATURA','ISTATISTIK_ID') IS NULL THEN 0 ELSE 1 END faturaIstatistik,
    CASE WHEN COL_LENGTH('dbo.TODVZ_SARRAF_FISI','ISTATISTIK_ID') IS NULL THEN 0 ELSE 1 END sarrafIstatistik,
    CASE WHEN COL_LENGTH('dbo.TODVZ_SARRAF_FISI','ALTIN_HAS_KURU') IS NULL THEN 0 ELSE 1 END hasKuru,
    CASE WHEN COL_LENGTH('dbo.TODVZ_SARRAF_FISI_SATIRI','ISCILIK_TUTARI') IS NULL THEN 0 ELSE 1 END iscilikTutari,
    CASE WHEN COL_LENGTH('dbo.TODVZ_SARRAF_FISI_SATIRI','URUN_TIPI') IS NULL THEN 0 ELSE 1 END satirUrunTipi,
    CASE WHEN COL_LENGTH('dbo.TODVZ_PARA','URUN_TIPI') IS NULL THEN 0 ELSE 1 END paraUrunTipi,
    ${TL_PARA_SQL} tlId, (SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD))='HAS' ORDER BY PARA_ID) hasId`)).recordset[0] || {};
    const tlId = Number(k.tlId) || 1, hasId = Number(k.hasId) || tlId;
    const fParcalar = [], sParcalar = [];
    if (bolumler.has(1)) {
        fParcalar.push(`SELECT F0.FIS_ID, CAST(1 AS int), F0.VEZNE_ID, CAST(F0.TIP AS int), F0.TARIH, F0.ZAMAN, F0.SERI_NO, F0.BELGE_NO, F0.ISTATISTIK_ID, F0.CARI_KART_ID, F0.UNVAN, F0.KISILIK_TIPI,
      F0.UYRUK_ID, F0.ULKE_ID, F0.VERGI_DAIRESI_ID, F0.VERGI_KIMLIK_NO, F0.BABA_ADI, F0.ADRES, F0.PASAPORT_NO, F0.TOPLAM_TUTAR, F0.ODEME_TUTARI, F0.EKLEYEN_ID, F0.EKLEME_ZAMANI,
      F0.GISE_USD_KURU, F0.IPTAL, F0.IPTAL_TARIHI, F0.DOGUM_TARIHI, F0.DOGUM_YERI, F0.KIMLIK_SERI_NO, F0.ANNE_ADI, F0.MASAK_LISTESINDE_VAR, F0.MESLEK_ID, F0.SUPHELI_ISLEMLER_YETKILI_ID,
      F0.BELGE_TURU, F0.TELEFON_NO
      FROM dbo.TODVZ_FIS F0`);
        sParcalar.push(`SELECT S0.FIS_ID, CAST(1 AS int), S0.SATIR_NO, S0.PARA_ID, S0.MIKTAR, S0.KUR, S0.GISE_KURU, S0.TUTAR, S0.KOMISYON_ORANI, S0.KOMISYON, S0.BMV_ORANI, S0.BMV, S0.ISCILIK,
      S0.KDV_ORANI, S0.KDV, S0.KMV_ORANI, S0.KMV FROM dbo.TODVZ_FIS_SATIRI S0`);
    }
    if (bolumler.has(2)) {
        const kayma = FIS_ID_KAYMASI[2];
        fParcalar.push(`SELECT ${kayma}+SF.SARRAF_FISI_ID, CAST(2 AS int), SF.VEZNE_ID, CAST(SF.TIP AS int), SF.TARIH, ISNULL(SF.SAAT, SF.TARIH), CAST('' AS char(20)), SF.FIS_NO,
      ${k.sarrafIstatistik ? "SF.ISTATISTIK_ID" : "CAST(NULL AS int)"}, SF.CARI_KART_ID, SF.UNVAN, SF.KISILIK_TIPI,
      SF.UYRUK_ID, SF.ULKE_ID, SF.VERGI_DAIRESI_ID, SF.VERGI_KIMLIK_NO, SF.BABA_ADI, SF.ADRES, SF.PASAPORT_NO, ISNULL(ST.tutar,0), ISNULL(ST.tutar,0), SF.EKLEYEN_ID, SF.EKLEME_ZAMANI,
      CAST(0 AS float), CAST(0 AS bit), CAST(NULL AS datetime), SF.DOGUM_TARIHI, SF.DOGUM_YERI, SF.KIMLIK_SERI_NO, SF.ANNE_ADI, SF.MASAK_LISTESINDE_VAR, SF.MESLEK_ID, SF.SUPHELI_ISLEMLER_YETKILI_ID,
      SF.BELGE_TURU, SF.TELEFON_NO
      FROM dbo.TODVZ_SARRAF_FISI SF
        OUTER APPLY (SELECT SUM(ISNULL(SX.TUTAR,0)) tutar FROM dbo.TODVZ_SARRAF_FISI_SATIRI SX WHERE SX.SARRAF_FISI_ID=SF.SARRAF_FISI_ID AND SX.URUN_ID IS NOT NULL) ST`);
        const urunTipi = k.satirUrunTipi && k.paraUrunTipi ? "ISNULL(SS.URUN_TIPI, PX.URUN_TIPI)" : k.satirUrunTipi ? "SS.URUN_TIPI" : k.paraUrunTipi ? "PX.URUN_TIPI" : "NULL";
        const hasKuru = k.hasKuru ? "ISNULL(SF.ALTIN_HAS_KURU,0)" : "0";
        sParcalar.push(`SELECT ${kayma}+SS.SARRAF_FISI_ID, CAST(2 AS int), SS.SATIR_NO, SS.URUN_ID,
      CASE WHEN ${urunTipi} IN (1,2) THEN ISNULL(SS.MIKTAR,0)
           WHEN ${urunTipi} IN (0,3) THEN CASE WHEN ISNULL(SS.ADET,0)>0 THEN SS.ADET ELSE CASE WHEN ISNULL(SS.MIKTAR,0)>0 THEN SS.MIKTAR ELSE 1 END END
           ELSE ISNULL(SS.MIKTAR,0) END,
      ISNULL(SS.KUR,0), CAST(0 AS float), ISNULL(SS.TUTAR,0), CAST(0 AS float), CAST(0 AS float), CAST(0 AS float), CAST(0 AS float),
      CASE ${k.iscilikTutari ? "WHEN ISNULL(SS.ISCILIK_TUTARI,0)>0 THEN SS.ISCILIK_TUTARI " : ""}WHEN ISNULL(SS.ISCILIK_HAS_GRAM,0)>0 THEN SS.ISCILIK_HAS_GRAM*${hasKuru}
           WHEN ISNULL(SS.ISCILIK_MIKTARI,0)>0 THEN SS.ISCILIK_MIKTARI ELSE 0 END,
      CAST(0 AS float), CAST(0 AS float), CAST(0 AS float), CAST(0 AS float)
      FROM dbo.TODVZ_SARRAF_FISI_SATIRI SS JOIN dbo.TODVZ_SARRAF_FISI SF ON SF.SARRAF_FISI_ID=SS.SARRAF_FISI_ID LEFT JOIN dbo.TODVZ_PARA PX ON PX.PARA_ID=SS.URUN_ID
      WHERE SS.URUN_ID IS NOT NULL`);
    }
    if (bolumler.has(3) || bolumler.has(4)) {
        // Ticari fiş = FIS_KAYNAGI 1 (kolon yoksa hepsi perakende)
        const ticari = k.fisKaynagi ? "CASE WHEN ISNULL(FA.FIS_KAYNAGI,0)=1 THEN 1 ELSE 0 END" : "0";
        const bolum = `CASE WHEN ${ticari}=1 THEN 4 ELSE 3 END`, kayma = `CASE WHEN ${ticari}=1 THEN ${FIS_ID_KAYMASI[4]} ELSE ${FIS_ID_KAYMASI[3]} END`;
        const kosul = bolumler.has(3) && bolumler.has(4) ? "1=1" : bolumler.has(4) ? `${ticari}=1` : `${ticari}=0`;
        const kur = `CASE WHEN FA.PARA_ID IS NULL OR FA.PARA_ID=${tlId} OR ISNULL(FA.KUR,0)=0 THEN 1 ELSE FA.KUR END`;
        const yerel = `DATEADD(hour, 3, FA.TARIH)`;
        fParcalar.push(`SELECT ${kayma}+FA.FATURA_ID, ${bolum}, FA.VEZNE_ID, CASE WHEN FA.FATURA_TIPI=1 THEN 1 ELSE 0 END, CAST(CAST(${yerel} AS date) AS datetime), FA.TARIH, CAST('' AS char(20)), FA.FATURA_NO,
      ${k.faturaIstatistik ? "FA.ISTATISTIK_ID" : "CAST(NULL AS int)"}, FA.CARI_KART_ID, FA.ALICI_UNVAN, CAST(NULL AS tinyint),
      CAST(NULL AS int), CAST(NULL AS int), CAST(NULL AS int), FA.ALICI_VKN_TCKN, CAST(NULL AS varchar(200)), FA.ADRES, CAST(NULL AS char(20)),
      ISNULL(FA.GENEL_TOPLAM,0)*${kur}, ISNULL(FA.GENEL_TOPLAM,0)*${kur}, FA.EKLEYEN_ID, FA.EKLEME_ZAMANI,
      CAST(0 AS float), CAST(CASE WHEN ISNULL(FA.E_BELGE_DURUMU,0)=4 THEN 1 ELSE 0 END AS bit), CAST(NULL AS datetime), CAST(NULL AS datetime), CAST(NULL AS varchar(100)), CAST(NULL AS char(20)),
      CAST(NULL AS varchar(200)), CAST(0 AS bit), CAST(NULL AS int), CAST(NULL AS int), CAST(NULL AS tinyint), FA.TELEFON
      FROM dbo.TODVZ_FATURA FA WHERE ${kosul}`);
        // Satır parası ve miktarı: ticari → fatura parası + adet; perakende barkodlu → HAS + has gramı; perakende barkodsuz → stok parası + stok miktarı
        const barkodlu = `(ISNULL(FS.ALTIN_URUN_ID,0)>0 OR LEN(LTRIM(RTRIM(ISNULL(FS.BARKOD,''))))>0)`;
        const stokKart = d.ticariSatir ? "FS.STOK_KART_ID IS NOT NULL" : "1=0";
        // Stok parası bulunamayan barkodsuz satır (aksesuar vb.): TL tutarı olarak girer (miktar = TL tutar, kur 1); gram TL'ye yazılmaz
        const stokParaHam = `COALESCE(${d.perakendeStok ? "FS.STOK_PARA_ID, " : ""}P1.PARA_ID, P2.PARA_ID)`;
        const stokPara = `ISNULL(${stokParaHam}, ${tlId})`;
        const stokMiktar = `COALESCE(${d.perakendeStok ? "FS.STOK_MIKTAR, " : ""}CASE WHEN ISNULL(FS.GRAM,0)>0 THEN FS.GRAM ELSE FS.MIKTAR END)`;
        sParcalar.push(`SELECT ${kayma}+FA.FATURA_ID, ${bolum}, FS.SATIR_NO,
      CASE WHEN ${ticari}=1 OR ${stokKart} THEN ISNULL(FA.PARA_ID, ${tlId}) WHEN ${barkodlu} THEN ${hasId} ELSE ${stokPara} END,
      CASE WHEN ${ticari}=1 OR ${stokKart} THEN ISNULL(FS.TUTAR,0) WHEN ${barkodlu} THEN ISNULL(NULLIF(FS.HAS_GRAM,0), ISNULL(FS.MIKTAR,0))
           WHEN ${stokParaHam} IS NULL THEN ISNULL(FS.TUTAR,0)*${kur} ELSE ISNULL(${stokMiktar},0) END,
      ISNULL(FS.BIRIM_FIYAT,0)*${kur}, CAST(0 AS float), ISNULL(FS.TUTAR,0)*${kur}, CAST(0 AS float), CAST(0 AS float), CAST(0 AS float), CAST(0 AS float), CAST(0 AS float),
      ISNULL(FS.KDV_ORANI,0), ISNULL(FS.KDV_TUTARI,0)*${kur}, CAST(0 AS float), CAST(0 AS float)
      FROM dbo.TODVZ_FATURA_SATIRI FS JOIN dbo.TODVZ_FATURA FA ON FA.FATURA_ID=FS.FATURA_ID ${PERAKENDE_SATIR_PARASI("FS")}
      WHERE ${kosul}`);
    }
    return {
        F: `(SELECT * FROM (\n${fParcalar.join("\n      UNION ALL\n")}\n) FX (${F_KOLONLARI})) F`,
        // Kur = satırın birim TL değeri: sarraf / perakende / ticari satırında tutar ÷ miktar (fişteki kur alanı has gramı ya da birim fiyatıdır, miktarla tutmaz)
        S: `(SELECT FIS_ID, BOLUM, SATIR_NO, PARA_ID, MIKTAR, CASE WHEN BOLUM>1 AND ISNULL(MIKTAR,0)<>0 THEN TUTAR/MIKTAR ELSE KUR END KUR, GISE_KURU, TUTAR,
      KOMISYON_ORANI, KOMISYON, BMV_ORANI, BMV, ISCILIK, KDV_ORANI, KDV, KMV_ORANI, KMV FROM (\n${sParcalar.join("\n      UNION ALL\n")}\n) SX2 (${S_KOLONLARI})) S`,
        bolumler, d, bolumAd,
    };
}

import sql from "mssql";
import { TL_PARA_SQL } from "./raporOrtak.js";

/**
 * Raporların ortak hareket kaynakları — eski programın birleşik görünümleriyle aynı kapsam (test veritabanında eski şifreli görünümler
 * çalıştırılarak doğrulandı, 01.10.2026; bkz. docs/rapor-denetim.md):
 *  - vezne hareketleri  = VODVZ_00_VEZNE_HAREKETI  (fiş, transfer, nakit cari, kasa hesap + KDV, emanet dekontu, sarraf fişi)
 *  - cari hareketleri   = VODVZ_00_CARI_HAREKET    (cari hareket, virman dekontu, bankadan ödenen döviz fişi, sarraf fişi cari ödemesi)
 *  - POS hareketleri    = VODVZR_POS_EKSTRESI      (cihaz devri, POS'lu cari hareket, sarraf fişi kartlı tahsilatı)
 * Her biri tek bir SELECT (UNION ALL) metnidir; raporlar bunu CTE olarak kullanır. Yalnızca SELECT.
 */

export interface BelgeTablolari {
  kasa: boolean; transfer: boolean; dekont: boolean; sarraf: boolean; odemeCari: boolean; pos: boolean;
  /** Uygulamaya özgü belgeler (eski programda yok): perakende fişi (TODVZ_FATURA*), barkodlu altın / özel ürün tanımı; saklanan stok kolonları ve TODVZ_AYAR */
  perakende: boolean; perakendeStok: boolean; altinUrun: boolean; altinStok: boolean; ozelUrun: boolean; ozelStok: boolean; ayar: boolean;
}

export async function belgeTablolari(pool: sql.ConnectionPool): Promise<BelgeTablolari> {
  const r = (await pool.request().query(`SELECT
    CASE WHEN OBJECT_ID('dbo.TODVZ_HESAP_HAREKETI','U') IS NULL THEN 0 ELSE 1 END kasa,
    CASE WHEN OBJECT_ID('dbo.TODVZ_VEZNE_TRANSFERI','U') IS NULL OR OBJECT_ID('dbo.TODVZ_VEZNE_TRANSFERI_SATIRI','U') IS NULL THEN 0 ELSE 1 END transfer,
    CASE WHEN OBJECT_ID('dbo.TODVZ_CARI_DEKONT','U') IS NULL OR OBJECT_ID('dbo.TODVZ_CARI_DEKONT_SATIRI','U') IS NULL THEN 0 ELSE 1 END dekont,
    CASE WHEN OBJECT_ID('dbo.TODVZ_SARRAF_FISI','U') IS NULL OR OBJECT_ID('dbo.TODVZ_SARRAF_FISI_SATIRI','U') IS NULL OR OBJECT_ID('dbo.TODVZ_ODEME_SATIRI','U') IS NULL THEN 0 ELSE 1 END sarraf,
    CASE WHEN COL_LENGTH('dbo.TODVZ_ODEME_SATIRI','CARI_KART_ID') IS NULL THEN 0 ELSE 1 END odemeCari,
    CASE WHEN OBJECT_ID('dbo.TODVZ_POS_CIHAZI','U') IS NULL THEN 0 ELSE 1 END pos,
    CASE WHEN OBJECT_ID('dbo.TODVZ_FATURA','U') IS NULL OR OBJECT_ID('dbo.TODVZ_FATURA_SATIRI','U') IS NULL OR OBJECT_ID('dbo.TODVZ_FATURA_ODEME','U') IS NULL THEN 0 ELSE 1 END perakende,
    CASE WHEN COL_LENGTH('dbo.TODVZ_FATURA_SATIRI','STOK_PARA_ID') IS NULL OR COL_LENGTH('dbo.TODVZ_FATURA_SATIRI','STOK_MIKTAR') IS NULL THEN 0 ELSE 1 END perakendeStok,
    CASE WHEN OBJECT_ID('dbo.TODVZ_ALTIN_URUN','U') IS NULL THEN 0 ELSE 1 END altinUrun,
    CASE WHEN COL_LENGTH('dbo.TODVZ_ALTIN_URUN','STOK_PARA_ID') IS NULL THEN 0 ELSE 1 END altinStok,
    CASE WHEN OBJECT_ID('dbo.TODVZ_OZEL_URUN','U') IS NULL THEN 0 ELSE 1 END ozelUrun,
    CASE WHEN COL_LENGTH('dbo.TODVZ_OZEL_URUN','STOK_PARA_ID') IS NULL THEN 0 ELSE 1 END ozelStok,
    CASE WHEN OBJECT_ID('dbo.TODVZ_AYAR','U') IS NULL THEN 0 ELSE 1 END ayar`)).recordset[0] || {};
  return { kasa: !!r.kasa, transfer: !!r.transfer, dekont: !!r.dekont, sarraf: !!r.sarraf, odemeCari: !!r.sarraf && !!r.odemeCari, pos: !!r.pos,
    perakende: !!r.perakende, perakendeStok: !!r.perakende && !!r.perakendeStok, altinUrun: !!r.altinUrun, altinStok: !!r.altinUrun && !!r.altinStok,
    ozelUrun: !!r.ozelUrun, ozelStok: !!r.ozelUrun && !!r.ozelStok, ayar: !!r.ayar };
}

/**
 * Döviz / sarraf / perakende fişinin işçiliği için uygulamanın işçilik hesabına doğrudan yazdığı kasa hareketi (ör. "Sarraf Fişi İşçilik - Fiş No: …").
 * Gelir kaydıdır, nakit değildir: parası fişin ödemesiyle zaten vezneye girer ve vezne bakiyesi güncellenmez. Vezne hareketlerine ve kasa defterine
 * girmez (çift sayılmasın); hesabın kendi raporlarında (hareket listesi, ekstre, bakiye) görünür. `a` = TODVZ_HESAP_HAREKETI takma adı.
 */
export const ISCILIK_KAYDI = (a: string) =>
  `(${a}.ACIKLAMA LIKE 'Sarraf Fişi İşçilik - %' OR ${a}.ACIKLAMA LIKE 'Döviz Fişi İşçilik - %' OR ${a}.ACIKLAMA LIKE 'Perakende Fişi İşçilik - %')`;

/** Vezne hareketi belge tipleri — eski BELGE_TIPI kodlarıyla aynı */
export const VEZNE_BELGE: Record<number, string> = { 0: "Fiş", 1: "Transfer", 2: "Cari", 3: "Hesap", 4: "Dekont", 5: "Sarraf", 6: "Perakende", 7: "Ürün tanımı" };

/**
 * Perakende fişi / ürün tanımı tarihleri ekrandan saatli gelir ve uygulama bunları UTC olarak yazar (Türkiye saatinin 3 saat gerisi);
 * iş günü İstanbul saatine göre alınır. `a` = TARIH kolonu.
 */
export const YEREL_GUN = (a: string) => `CAST(DATEADD(hour, 3, ${a}) AS date)`;

/** Perakende ödeme satırının miktarı (miktar yoksa tutar ÷ kur) */
const FATURA_ODEME_MIKTARI = `ISNULL(NULLIF(O.MIKTAR, 0), O.TUTAR / NULLIF(O.KUR, 0))`;

/** 01.10.2026 öncesi perakende satırlarının stok parası: kaydetme anındaki eşleştirmeyle aynı (ayar / ürün adı → TODVZ_PARA). `s` = TODVZ_FATURA_SATIRI */
const PERAKENDE_SATIR_PARASI = (s: string) => `
       OUTER APPLY (SELECT UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(${s}.AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', '')))) C) PA
       OUTER APPLY (SELECT TOP 1 P.PARA_ID FROM dbo.TODVZ_PARA P WHERE UPPER(LTRIM(RTRIM(P.KOD))) = UPPER(LTRIM(RTRIM(${s}.AYAR))) OR UPPER(LTRIM(RTRIM(P.KOD))) = PA.C
         OR UPPER(LTRIM(RTRIM(P.KOD))) = UPPER(LTRIM(RTRIM(ISNULL(${s}.URUN_ADI, '')))) OR UPPER(LTRIM(RTRIM(P.AD))) = UPPER(LTRIM(RTRIM(ISNULL(${s}.URUN_ADI, ''))))) P1
       OUTER APPLY (SELECT TOP 1 P.PARA_ID FROM dbo.TODVZ_PARA P WHERE P1.PARA_ID IS NULL AND UPPER(LTRIM(RTRIM(P.AD))) IN (PA.C + ' AYAR', PA.C + ' AYAR ALTIN', PA.C)) P2`;

/**
 * Barkodlu ürün tanımının stok parası (01.10.2026 öncesi kayıtlar için; sonrakiler STOK_PARA_ID'de saklı) — SODVZ_ALTIN / OZEL_URUN_KAYDET ile aynı sıra:
 * kod = ayar, ad eşleşmesi (sikke kodları hariç), TODVZ_AYAR standart ayarı, sayısal ayar, son çare HAS / 24. `u` = ürün tablosu takma adı.
 */
const URUN_AYAR_PARASI = (u: string, ayarTablosu: boolean) => {
  const sikke = `UPPER(LTRIM(RTRIM(P.KOD))) NOT IN ('ÇEY', 'CEY', 'TAM', 'YAR', 'ATA', 'CUM')`;
  const ayarli = (x: string) => `(UPPER(LTRIM(RTRIM(P.KOD))) IN (${x}, ${x} + ' AYAR') OR UPPER(LTRIM(RTRIM(P.AD))) IN (${x} + ' AYAR ALTIN', ${x} + ' AYAR'))`;
  return `
       OUTER APPLY (SELECT UPPER(LTRIM(RTRIM(ISNULL(${u}.AYAR, '')))) A, UPPER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(${u}.AYAR, ''), ' AYAR', ''), 'AYAR', ''), ' ', '')))) C) UA
       OUTER APPLY (SELECT TOP 1 P.PARA_ID FROM dbo.TODVZ_PARA P WHERE UPPER(LTRIM(RTRIM(P.KOD))) = UA.A OR UPPER(LTRIM(RTRIM(P.KOD))) = UA.C) U1
       OUTER APPLY (SELECT TOP 1 P.PARA_ID FROM dbo.TODVZ_PARA P WHERE U1.PARA_ID IS NULL AND UPPER(LTRIM(RTRIM(P.AD))) IN (UA.A, UA.C + ' AYAR', UA.C + ' AYAR ALTIN', UA.C) AND ${sikke}) U2
       ${ayarTablosu ? `OUTER APPLY (SELECT TOP 1 CAST(AY.STANDART_AYAR AS varchar(10)) S FROM dbo.TODVZ_AYAR AY WHERE U1.PARA_ID IS NULL AND U2.PARA_ID IS NULL
         AND (UPPER(LTRIM(RTRIM(AY.AYAR_KODU))) = UA.A OR UPPER(LTRIM(RTRIM(AY.AYAR_ADI))) = UA.A OR UPPER(LTRIM(RTRIM(AY.AYAR_KODU))) = UA.C)) U3S
       OUTER APPLY (SELECT TOP 1 P.PARA_ID FROM dbo.TODVZ_PARA P WHERE U3S.S IS NOT NULL AND ${ayarli("U3S.S")} AND ${sikke}) U3` : `OUTER APPLY (SELECT CAST(NULL AS int) PARA_ID) U3`}
       OUTER APPLY (SELECT TOP 1 P.PARA_ID FROM dbo.TODVZ_PARA P WHERE U1.PARA_ID IS NULL AND U2.PARA_ID IS NULL AND U3.PARA_ID IS NULL AND TRY_CAST(UA.C AS int) IS NOT NULL
         AND ${ayarli("CAST(TRY_CAST(UA.C AS int) AS varchar(10))")} AND ${sikke}) U4
       OUTER APPLY (SELECT TOP 1 P.PARA_ID FROM dbo.TODVZ_PARA P WHERE U1.PARA_ID IS NULL AND U2.PARA_ID IS NULL AND U3.PARA_ID IS NULL AND U4.PARA_ID IS NULL
         AND UPPER(LTRIM(RTRIM(P.KOD))) IN ('HAS', '24', '24 AYAR') ORDER BY P.PARA_ID) U5`;
};
const URUN_PARASI = `COALESCE(U1.PARA_ID, U2.PARA_ID, U3.PARA_ID, U4.PARA_ID, U5.PARA_ID)`;

/**
 * Vezne hareketleri: her satır bir vezne × para hareketi (giriş / çıkış miktarı). Kolonlar:
 * belgeTipi, belgeId, satirNo, ayak (0 normal, 1 fişin TL ödeme ayağı, 2 KDV), vezneId, tarih (iş günü), zaman (saatin okunacağı an; yoksa NULL),
 * paraId, giris, cikis, kur, aciklama, bankaHesabiId, fisTip (0 alış / 1 satış; fiş ve sarraf), belgeNo, unvan, tutar, komisyon, bmv.
 * Kurallar (eski görünümle ve uygulamanın vezne bakiyesi güncellemesiyle aynı):
 *  - Döviz fişi: iptal edilmemiş; satırda banka hesabı varsa satır vezneye girmez; başlıkta banka hesabı varsa TL ödeme ayağı vezneye girmez.
 *  - Nakit cari hareket (HAREKET_TIPI 0): alacak giriş, borç çıkış. Kasa hesap hareketi: giriş / çıkış + KDV her zaman TL'ye ayrı satır
 *    (fişlerin işçilik kayıtları hariç — ISCILIK_KAYDI).
 *  - Emanet dekontu (TIP 0 alma / 1 verme): yalnız satır tipi dekont tipiyle aynı olan satırlar; alma giriş, verme çıkış. Virman dekontunun (TIP 2) iki satırı
 *    eski listedeki gibi "E.A." giriş + "E.V." çıkış olarak görünür; net etkisi sıfırdır.
 *  - Sarraf fişi: ürün satırı — ürün birimi Adet (BIRIM 0) ise ADET, değilse MİKTAR; alışta giriş, satışta çıkış. Vezneden yapılan ödeme satırı
 *    (ISLEME_YERI 0) ters yönde. Cari / POS / banka ödemeleri vezneyi etkilemez.
 *  - Perakende fişi (uygulamaya özgü; kullanıcı kararı 01.10.2026): barkodsuz satır satışta çıkış, alışta giriş — satırda saklanan stok parası / miktarı
 *    (STOK_PARA_ID / STOK_MIKTAR), 01.10.2026 öncesi satırlarda kaydetmedeki kural (gram varsa gram, yoksa miktar; ayar / ad eşleştirmesi). Barkodlu satır vezne
 *    stoğunu değiştirmez (ürün tanımında düşülmüştür). Vezneden tahsilat satışta giriş, alışta çıkış (belgeden; 01.10.2026 öncesi tahsilatlar vezne bakiyesine işlenmemişti).
 *  - Ürün tanımı (barkodlu altın / özel ürün): ürünün veznesinden ayar parası çıkış (STOK_* saklıysa o; yoksa kayıttaki eşleştirme). Silinen ürün düşer.
 * `tipFiltresi` true ise yalnızca döviz, sarraf ve perakende fişi satırları (`@tip` parametresine göre alış / satış) döner.
 */
export function vezneHareketleriSql(d: BelgeTablolari, tipFiltresi = false): string {
  const tip = (kolon: string) => (tipFiltresi ? ` AND (@tip IS NULL OR ${kolon}=@tip)` : "");
  const bos = `CAST(NULL AS int), '', '', 0, 0, 0`; // fisTip, belgeNo, unvan, tutar, komisyon, bmv
  const seri = `COALESCE(NULLIF(RTRIM(F.SERI_NO),''), RTRIM(ISNULL(F.BELGE_NO,'')))`;
  const parcalar: string[] = [
    `SELECT 0, F.FIS_ID, S.SATIR_NO, 0, F.VEZNE_ID, F.TARIH, F.ZAMAN, S.PARA_ID, CASE WHEN F.TIP=0 THEN S.MIKTAR ELSE 0 END, CASE WHEN F.TIP=0 THEN 0 ELSE S.MIKTAR END,
       S.KUR, ${seri}, F.BANKA_HESABI_ID, CAST(F.TIP AS int), RTRIM(ISNULL(F.BELGE_NO,'')), RTRIM(ISNULL(F.UNVAN,'')), ISNULL(S.TUTAR,0), ISNULL(S.KOMISYON,0), ISNULL(S.BMV,0)
     FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID WHERE ISNULL(F.IPTAL,0)=0 AND S.BANKA_HESABI_ID IS NULL${tip("F.TIP")}`,
    `SELECT 0, F.FIS_ID, 0, 1, F.VEZNE_ID, F.TARIH, F.ZAMAN, ${TL_PARA_SQL}, CASE WHEN F.TIP=1 THEN F.ODEME_TUTARI ELSE 0 END, CASE WHEN F.TIP=1 THEN 0 ELSE F.ODEME_TUTARI END,
       1, ${seri}, NULL, CAST(F.TIP AS int), RTRIM(ISNULL(F.BELGE_NO,'')), RTRIM(ISNULL(F.UNVAN,'')), 0, 0, 0
     FROM dbo.TODVZ_FIS F WHERE ISNULL(F.IPTAL,0)=0 AND F.BANKA_HESABI_ID IS NULL AND ISNULL(F.ODEME_TUTARI,0)<>0${tip("F.TIP")}`,
  ];
  if (d.sarraf) parcalar.push(
    `SELECT 5, SF.SARRAF_FISI_ID, SS.SATIR_NO, 0, SF.VEZNE_ID, SF.TARIH, SF.SAAT, SS.URUN_ID,
       CASE WHEN SF.TIP=0 THEN CASE WHEN SP.BIRIM=0 THEN ISNULL(SS.ADET,0) ELSE SS.MIKTAR END ELSE 0 END,
       CASE WHEN SF.TIP=0 THEN 0 ELSE CASE WHEN SP.BIRIM=0 THEN ISNULL(SS.ADET,0) ELSE SS.MIKTAR END END,
       SS.KUR, RTRIM(ISNULL(SF.FIS_NO,'')), NULL, CAST(SF.TIP AS int), RTRIM(ISNULL(SF.IRSALIYE_NO,'')), RTRIM(ISNULL(SF.UNVAN,'')), ISNULL(SS.TUTAR,0), 0, 0
     FROM dbo.TODVZ_SARRAF_FISI SF JOIN dbo.TODVZ_SARRAF_FISI_SATIRI SS ON SS.SARRAF_FISI_ID=SF.SARRAF_FISI_ID LEFT JOIN dbo.TODVZ_PARA SP ON SP.PARA_ID=SS.URUN_ID
     WHERE SS.URUN_ID IS NOT NULL${tip("SF.TIP")}`,
    `SELECT 5, SF.SARRAF_FISI_ID, OS.SATIR_NO, 1, SF.VEZNE_ID, SF.TARIH, SF.SAAT, OS.PARA_ID, CASE WHEN SF.TIP=1 THEN OS.MIKTAR ELSE 0 END, CASE WHEN SF.TIP=1 THEN 0 ELSE OS.MIKTAR END,
       OS.KUR, RTRIM(ISNULL(SF.FIS_NO,'')), NULL, CAST(SF.TIP AS int), RTRIM(ISNULL(SF.IRSALIYE_NO,'')), RTRIM(ISNULL(SF.UNVAN,'')), ISNULL(OS.TUTAR,0), 0, 0
     FROM dbo.TODVZ_SARRAF_FISI SF JOIN dbo.TODVZ_ODEME_SATIRI OS ON OS.SARRAF_FISI_ID=SF.SARRAF_FISI_ID WHERE OS.ISLEME_YERI=0 AND OS.PARA_ID IS NOT NULL${tip("SF.TIP")}`);
  if (d.perakende) {
    const fTip = `CASE WHEN F.FATURA_TIPI=1 THEN 1 ELSE 0 END`;
    const q = `COALESCE(${d.perakendeStok ? "S.STOK_MIKTAR" : "NULL"}, CASE WHEN S.GRAM > 0 THEN S.GRAM ELSE S.MIKTAR END)`;
    parcalar.push(
      `SELECT 6, F.FATURA_ID, S.SATIR_NO, 0, F.VEZNE_ID, ${YEREL_GUN("F.TARIH")}, F.TARIH, COALESCE(${d.perakendeStok ? "S.STOK_PARA_ID, " : ""}P1.PARA_ID, P2.PARA_ID),
         CASE WHEN F.FATURA_TIPI=1 THEN 0 ELSE ${q} END, CASE WHEN F.FATURA_TIPI=1 THEN ${q} ELSE 0 END, ISNULL(S.BIRIM_FIYAT,0), RTRIM(ISNULL(F.FATURA_NO,'')), NULL, ${fTip},
         RTRIM(ISNULL(F.FATURA_NO,'')), RTRIM(ISNULL(F.ALICI_UNVAN,'')), ISNULL(S.TUTAR,0), 0, 0
       FROM dbo.TODVZ_FATURA F JOIN dbo.TODVZ_FATURA_SATIRI S ON S.FATURA_ID=F.FATURA_ID ${PERAKENDE_SATIR_PARASI("S")}
       WHERE ISNULL(F.VEZNE_ID,0)>0 AND ISNULL(S.ALTIN_URUN_ID,0)=0 AND LEN(LTRIM(RTRIM(ISNULL(S.BARKOD,''))))=0 AND ${q}>0${tip(fTip)}`,
      `SELECT 6, F.FATURA_ID, O.SATIR_NO, 1, F.VEZNE_ID, ${YEREL_GUN("F.TARIH")}, F.TARIH, O.PARA_ID,
         CASE WHEN F.FATURA_TIPI=1 THEN ${FATURA_ODEME_MIKTARI} ELSE 0 END, CASE WHEN F.FATURA_TIPI=1 THEN 0 ELSE ${FATURA_ODEME_MIKTARI} END, ISNULL(O.KUR,1),
         RTRIM(ISNULL(F.FATURA_NO,'')), NULL, ${fTip}, RTRIM(ISNULL(F.FATURA_NO,'')), RTRIM(ISNULL(F.ALICI_UNVAN,'')), ISNULL(O.TUTAR,0), 0, 0
       FROM dbo.TODVZ_FATURA F JOIN dbo.TODVZ_FATURA_ODEME O ON O.FATURA_ID=F.FATURA_ID JOIN dbo.TODVZ_PARA OP ON OP.PARA_ID=O.PARA_ID
       WHERE ISNULL(F.VEZNE_ID,0)>0 AND ISNULL(O.ODEME_ARACI_TURU,0)=0 AND ISNULL(O.ISLEME_YERI,0)=0${tip(fTip)}`);
  }
  if (!tipFiltresi) {
    parcalar.push(`SELECT 2, CH.CARI_HAREKET_ID, CS.SATIR_NO, 0, CH.VEZNE_ID, CH.TARIH, NULL, CS.PARA_ID, CASE WHEN CH.TIP=1 THEN CS.MEBLAG ELSE 0 END, CASE WHEN CH.TIP=1 THEN 0 ELSE CS.MEBLAG END,
       0, RTRIM(ISNULL(CK.AD,''))+CASE WHEN NULLIF(RTRIM(CH.ACIKLAMA),'') IS NULL THEN '' ELSE ' / '+RTRIM(CH.ACIKLAMA) END, NULL, ${bos}
     FROM dbo.TODVZ_CARI_HAREKET CH JOIN dbo.TODVZ_CARI_HAREKET_SATIRI CS ON CS.CARI_HAREKET_ID=CH.CARI_HAREKET_ID LEFT JOIN dbo.TODVZ_CARI_KART CK ON CK.CARI_KART_ID=CH.CARI_KART_ID
     WHERE CH.HAREKET_TIPI=0`);
    if (d.transfer) parcalar.push(
      `SELECT 1, T.VEZNE_TRANSFERI_ID, TS.SATIR_NO, 0, T.ALAN_VEZNE_ID, T.TARIH, NULL, TS.PARA_ID, TS.MIKTAR, 0, 0, LTRIM(RTRIM(ISNULL(T.REF_NO,''))+' '+RTRIM(ISNULL(T.ACIKLAMA,''))), NULL, ${bos}
       FROM dbo.TODVZ_VEZNE_TRANSFERI T JOIN dbo.TODVZ_VEZNE_TRANSFERI_SATIRI TS ON TS.VEZNE_TRANSFERI_ID=T.VEZNE_TRANSFERI_ID`,
      `SELECT 1, T.VEZNE_TRANSFERI_ID, TS.SATIR_NO, 0, T.VEREN_VEZNE_ID, T.TARIH, NULL, TS.PARA_ID, 0, TS.MIKTAR, 0, LTRIM(RTRIM(ISNULL(T.REF_NO,''))+' '+RTRIM(ISNULL(T.ACIKLAMA,''))), NULL, ${bos}
       FROM dbo.TODVZ_VEZNE_TRANSFERI T JOIN dbo.TODVZ_VEZNE_TRANSFERI_SATIRI TS ON TS.VEZNE_TRANSFERI_ID=T.VEZNE_TRANSFERI_ID`);
    if (d.kasa) parcalar.push(
      `SELECT 3, KH.HESAP_HAREKETI_ID, 0, 0, KH.VEZNE_ID, KH.TARIH, NULL, KH.PARA_ID, CASE WHEN KH.TIP=0 THEN KH.MEBLAG ELSE 0 END, CASE WHEN KH.TIP=0 THEN 0 ELSE KH.MEBLAG END, 0, RTRIM(ISNULL(KH.ACIKLAMA,'')), NULL, ${bos}
       FROM dbo.TODVZ_HESAP_HAREKETI KH WHERE NOT ${ISCILIK_KAYDI("KH")}`,
      `SELECT 3, KH.HESAP_HAREKETI_ID, 0, 2, KH.VEZNE_ID, KH.TARIH, NULL, ${TL_PARA_SQL}, CASE WHEN KH.TIP=0 THEN KH.KDV ELSE 0 END, CASE WHEN KH.TIP=0 THEN 0 ELSE KH.KDV END, 0, 'KDV — '+RTRIM(ISNULL(KH.ACIKLAMA,'')), NULL, ${bos}
       FROM dbo.TODVZ_HESAP_HAREKETI KH WHERE ISNULL(KH.KDV,0)>0 AND NOT ${ISCILIK_KAYDI("KH")}`);
    if (d.dekont) parcalar.push(
      `SELECT 4, D.CARI_DEKONT_ID, DS.SATIR_NO, 0, D.VEZNE_ID, D.TARIH, NULL, DS.PARA_ID, CASE WHEN DS.TIP=0 THEN DS.MEBLAG ELSE 0 END, CASE WHEN DS.TIP=1 THEN DS.MEBLAG ELSE 0 END,
         DS.KUR, CASE WHEN DS.TIP=0 THEN 'E.A. ' ELSE 'E.V. ' END+RTRIM(ISNULL(DC.AD,'')), NULL, ${bos}
       FROM dbo.TODVZ_CARI_DEKONT D JOIN dbo.TODVZ_CARI_DEKONT_SATIRI DS ON DS.CARI_DEKONT_ID=D.CARI_DEKONT_ID LEFT JOIN dbo.TODVZ_CARI_KART DC ON DC.CARI_KART_ID=D.BORCLU_ID
       WHERE (D.TIP IN (0,1) AND DS.TIP=D.TIP) OR D.TIP=2`);
    for (const [T, ad, stok] of [["ALTIN", "Altın ürün", d.altinStok], ["OZEL", "Özel ürün", d.ozelStok]] as [string, string, boolean][]) {
      if (!(T === "ALTIN" ? d.altinUrun : d.ozelUrun)) continue;
      const v = stok ? "COALESCE(U.STOK_VEZNE_ID, U.VEZNE_ID)" : "U.VEZNE_ID", m = stok ? "COALESCE(U.STOK_MIKTAR, U.MIKTAR)" : "U.MIKTAR";
      parcalar.push(`SELECT 7, U.${T}_URUN_ID, 0, 0, ${v}, ${YEREL_GUN("U.TARIH")}, U.TARIH, ${stok ? `COALESCE(U.STOK_PARA_ID, ${URUN_PARASI})` : URUN_PARASI}, 0, ${m}, 0,
         '${ad} '+RTRIM(ISNULL(U.GRUP_KODU,''))+'-'+CAST(U.URUN_NO AS varchar(20))+CASE WHEN NULLIF(RTRIM(U.BARKOD),'') IS NULL THEN '' ELSE ' ('+RTRIM(U.BARKOD)+')' END, NULL, ${bos}
       FROM dbo.TODVZ_${T}_URUN U ${URUN_AYAR_PARASI("U", d.ayar)}
       WHERE ${v} IS NOT NULL AND ${m}>0 AND ${stok ? `COALESCE(U.STOK_PARA_ID, ${URUN_PARASI})` : URUN_PARASI} IS NOT NULL`);
    }
  }
  return parcalar.join("\n     UNION ALL\n     ");
}
/** vezneHareketleriSql kolon listesi — CTE tanımında kullanılır */
export const VEZNE_HAREKET_KOLONLARI = "belgeTipi, belgeId, satirNo, ayak, vezneId, tarih, zaman, paraId, giris, cikis, kur, aciklama, bankaHesabiId, fisTip, belgeNo, unvan, tutar, komisyon, bmv";

/** Cari hareket evrak tipleri — eski EVRAK_TIPI kodlarıyla aynı */
export const CARI_EVRAK: Record<number, string> = { 1: "Virman dekontu", 2: "Döviz fişi (banka)", 3: "Sarraf fişi", 4: "Perakende fişi" };

/**
 * Cari hareketleri: her satır bir cari × para borç / alacak kaydı. Kolonlar: evrakTipi, hareketId, satirNo, cariKartId, tarih, eklemeZamani, vezneId, paraId,
 * hareketTipi (cari hareket için HAREKET_TIPI; belgelerde eski görünümdeki gibi 0), tip (0 borç / 1 alacak), meblag, aciklama, belgeNo.
 * Kurallar (eski görünümle aynı):
 *  - Virman dekontu (TIP 2, iptal edilmemiş): satır tipi 0 → borçlu cari borç, 1 → alacaklı cari alacak. Emanet alma / verme cariyi etkilemez.
 *  - Döviz fişi bankadan ödendiyse (başlıkta banka hesabı = bir cari kart): TL ödeme tutarı o cariye — alışta alacak, satışta borç.
 *    Satırda banka hesabı varsa satırın dövizi o cariye — alışta borç, satışta alacak. Fişin müşteri carisi bakiyeyi etkilemez.
 *  - Sarraf fişi cari ödemesi (ISLEME_YERI 1): satışta borç, alışta alacak; meblağ ödeme satırının parası ve miktarıdır.
 *  - Perakende fişi cari ödemesi (ödeme aracı cari, uygulamaya özgü): satışta borç, alışta alacak; ödeme satırındaki cari, para ve miktar.
 */
export function cariHareketleriSql(d: BelgeTablolari): string {
  const parcalar: string[] = [
    `SELECT 0, H.CARI_HAREKET_ID, S.SATIR_NO, H.CARI_KART_ID, H.TARIH, H.EKLEME_ZAMANI, H.VEZNE_ID, S.PARA_ID, H.HAREKET_TIPI, H.TIP, S.MEBLAG, RTRIM(ISNULL(H.ACIKLAMA,'')), CAST(H.CARI_HAREKET_ID AS varchar(20))
     FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID`,
    `SELECT 2, F.FIS_ID, 0, F.BANKA_HESABI_ID, F.TARIH, F.EKLEME_ZAMANI, F.VEZNE_ID, ${TL_PARA_SQL}, 0, CASE WHEN F.TIP=0 THEN 1 ELSE 0 END, F.ODEME_TUTARI,
       RTRIM(ISNULL(F.UNVAN,'')), COALESCE(NULLIF(RTRIM(F.SERI_NO),''), RTRIM(ISNULL(F.BELGE_NO,'')))
     FROM dbo.TODVZ_FIS F WHERE ISNULL(F.IPTAL,0)=0 AND F.BANKA_HESABI_ID IS NOT NULL AND ISNULL(F.ODEME_TUTARI,0)<>0`,
    `SELECT 2, F.FIS_ID, S.SATIR_NO, S.BANKA_HESABI_ID, F.TARIH, F.EKLEME_ZAMANI, F.VEZNE_ID, S.PARA_ID, 0, CASE WHEN F.TIP=0 THEN 0 ELSE 1 END, S.MIKTAR,
       RTRIM(ISNULL(F.UNVAN,'')), COALESCE(NULLIF(RTRIM(F.SERI_NO),''), RTRIM(ISNULL(F.BELGE_NO,'')))
     FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID WHERE ISNULL(F.IPTAL,0)=0 AND S.BANKA_HESABI_ID IS NOT NULL`,
  ];
  if (d.dekont) parcalar.push(
    `SELECT 1, D.CARI_DEKONT_ID, DS.SATIR_NO, CASE WHEN DS.TIP=0 THEN D.BORCLU_ID ELSE D.ALACAKLI_ID END, D.TARIH, D.EKLEME_ZAMANI, D.VEZNE_ID, DS.PARA_ID, 0, CASE WHEN DS.TIP=0 THEN 0 ELSE 1 END, DS.MEBLAG,
       RTRIM(ISNULL(D.ACIKLAMA,'')), CAST(D.CARI_DEKONT_ID AS varchar(20))
     FROM dbo.TODVZ_CARI_DEKONT D JOIN dbo.TODVZ_CARI_DEKONT_SATIRI DS ON DS.CARI_DEKONT_ID=D.CARI_DEKONT_ID WHERE D.TIP=2 AND D.IPTAL_TARIHI IS NULL`);
  if (d.sarraf) parcalar.push(
    `SELECT 3, SF.SARRAF_FISI_ID, OS.SATIR_NO, ${d.odemeCari ? "COALESCE(OS.CARI_KART_ID, SF.CARI_KART_ID)" : "SF.CARI_KART_ID"}, SF.TARIH, SF.EKLEME_ZAMANI, SF.VEZNE_ID, OS.PARA_ID, 0,
       CASE WHEN SF.TIP=1 THEN 0 ELSE 1 END, OS.MIKTAR, RTRIM(ISNULL(SF.UNVAN,'')), RTRIM(ISNULL(SF.FIS_NO,''))
     FROM dbo.TODVZ_SARRAF_FISI SF JOIN dbo.TODVZ_ODEME_SATIRI OS ON OS.SARRAF_FISI_ID=SF.SARRAF_FISI_ID
     WHERE OS.ISLEME_YERI=1 AND OS.PARA_ID IS NOT NULL AND ${d.odemeCari ? "COALESCE(OS.CARI_KART_ID, SF.CARI_KART_ID)" : "SF.CARI_KART_ID"} IS NOT NULL`);
  if (d.perakende) parcalar.push(
    `SELECT 4, F.FATURA_ID, O.SATIR_NO, O.CARI_KART_ID, ${YEREL_GUN("F.TARIH")}, F.EKLEME_ZAMANI, F.VEZNE_ID, O.PARA_ID, 0, CASE WHEN F.FATURA_TIPI=1 THEN 0 ELSE 1 END,
       ${FATURA_ODEME_MIKTARI}, RTRIM(ISNULL(F.ALICI_UNVAN,'')), RTRIM(ISNULL(F.FATURA_NO,''))
     FROM dbo.TODVZ_FATURA F JOIN dbo.TODVZ_FATURA_ODEME O ON O.FATURA_ID=F.FATURA_ID JOIN dbo.TODVZ_PARA OP ON OP.PARA_ID=O.PARA_ID
     WHERE O.ODEME_ARACI_TURU=1 AND O.CARI_KART_ID IS NOT NULL`);
  return parcalar.join("\n     UNION ALL\n     ");
}
export const CARI_HAREKET_KOLONLARI = "evrakTipi, hareketId, satirNo, cariKartId, tarih, eklemeZamani, vezneId, paraId, hareketTipi, tip, meblag, aciklama, belgeNo";

/**
 * POS hareketleri (eski VODVZR_POS_EKSTRESI + perakende fişi kartlı tahsilatı): borç = POS cihazından tahsil edilecek (cari tahsilat, fiş tahsilatı, cihaz devri),
 * alacak = POS'tan bankaya aktarılan (POS'lu cari hareketin borç kaydı). Kolonlar: posCihaziId, tarih, borc, alacak, islem, aciklama, cariKartId, vezneId, paraId, hareketNo, devir.
 */
export function posHareketleriSql(d: BelgeTablolari): string {
  const parcalar: string[] = [
    `SELECT H.POS_CIHAZI_ID, H.TARIH, CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE 0 END, CASE WHEN H.TIP=1 THEN 0 ELSE S.MEBLAG END,
       CASE WHEN H.TIP=1 THEN 'Cari tahsilat' ELSE 'Banka hesabına aktarım' END, RTRIM(ISNULL(C.AD,''))+'/'+RTRIM(ISNULL(H.ACIKLAMA,'')), H.CARI_KART_ID, H.VEZNE_ID, S.PARA_ID,
       CAST(H.CARI_HAREKET_ID AS varchar(20)), 0
     FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID
     WHERE H.HAREKET_TIPI=2`,
  ];
  if (d.pos) parcalar.push(
    `SELECT PC.POS_CIHAZI_ID, CAST('1800-01-01' AS datetime), CASE WHEN PC.DEVIR>0 THEN PC.DEVIR ELSE 0 END, CASE WHEN PC.DEVIR<0 THEN -PC.DEVIR ELSE 0 END, 'Devir', 'POS Devir', NULL, NULL, ${TL_PARA_SQL}, '', 1
     FROM dbo.TODVZ_POS_CIHAZI PC WHERE ISNULL(PC.DEVIR,0)<>0`);
  if (d.sarraf) parcalar.push(
    `SELECT OS.POS_CIHAZI_ID, SF.TARIH, OS.MIKTAR, 0, 'Fiş tahsilat', LTRIM(RTRIM(ISNULL(SF.FIS_NO,''))+' '+RTRIM(ISNULL(SF.UNVAN,''))), SF.CARI_KART_ID, SF.VEZNE_ID, ${TL_PARA_SQL},
       RTRIM(ISNULL(SF.FIS_NO,'')), 0
     FROM dbo.TODVZ_SARRAF_FISI SF JOIN dbo.TODVZ_ODEME_SATIRI OS ON OS.SARRAF_FISI_ID=SF.SARRAF_FISI_ID WHERE OS.ISLEME_YERI=3 AND OS.POS_CIHAZI_ID IS NOT NULL`);
  if (d.perakende) parcalar.push(
    `SELECT O.POS_CIHAZI_ID, ${YEREL_GUN("F.TARIH")}, ${FATURA_ODEME_MIKTARI.replace(/O\./g, "O.")}, 0, 'Fiş tahsilat', LTRIM(RTRIM(ISNULL(F.FATURA_NO,''))+' '+RTRIM(ISNULL(F.ALICI_UNVAN,''))),
       F.CARI_KART_ID, F.VEZNE_ID, COALESCE((SELECT PARA_ID FROM dbo.TODVZ_PARA WHERE PARA_ID=O.PARA_ID), ${TL_PARA_SQL}), RTRIM(ISNULL(F.FATURA_NO,'')), 0
     FROM dbo.TODVZ_FATURA F JOIN dbo.TODVZ_FATURA_ODEME O ON O.FATURA_ID=F.FATURA_ID WHERE O.ODEME_ARACI_TURU=2 AND O.POS_CIHAZI_ID IS NOT NULL`);
  return parcalar.join("\n     UNION ALL\n     ");
}
export const POS_HAREKET_KOLONLARI = "posCihaziId, tarih, borc, alacak, islem, aciklama, cariKartId, vezneId, paraId, hareketNo, devir";

/** Saat metni (SS:DD) — uygulama fiş saatini sunucunun UTC saatiyle yazar; gösterim ve saat süzgeci İstanbul saatine göredir. Saat bilgisi yoksa boş. */
export function saatTr(v: any): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false });
}

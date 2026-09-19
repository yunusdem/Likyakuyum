import sql from "mssql";
import { RAPOR_UST_SINIR, type RaporSonucVeri, type RaporTanim } from "./raporTanim.js";

/**
 * Rapor sorgularının ortak yardımcıları (parametre tipi, filtre parçaları, kur çözümü, vezne bakiyesi, üst sınır).
 * Alan dosyaları (veri/*.ts) ve raporVeri.ts buradan alır. Yalnızca SELECT.
 */

export interface RaporParametreler {
  tarih?: string; baslangic?: string; bitis?: string; baslangicSaat?: string; bitisSaat?: string;
  vezneId?: number; paraId?: number; cariKartId?: number; fisTipi?: number;
  /** Aralık ve çoklu seçim (yönetici kararı 12.09.2026): cari/vezne KOD aralığı, para listesi */
  cariBaslangic?: string; cariBitis?: string; vezneBaslangic?: string; vezneBitis?: string; paraIdler?: number[];
  /** Seçim listeleri (yönetici kararı 14.09.2026): boş = tümü. "İlk kod" listesi; "Son kod" seçilmişse ilk listedeki ilk kayıttan son kayda KOD aralığı */
  cariIdler?: number[]; vezneIdler?: number[];
  cariSonId?: number; vezneSonId?: number; paraSonId?: number;
  kurTuru?: number; kurTarihi?: string; kurAlani?: "alis" | "satis" | "ikisi";
  arama?: string; kmt?: string;
  /** Cari hareket tipi filtresi (0 nakit, 1 banka, 2 POS, 3 dekont, 4 virman, 5 devir); hareketTipleri: çoklu seçim (boş = tümü) */
  hareketTipi?: number; hareketTipleri?: number[];
  /** 2. dalga (docs/raporlar-faz2.md): genel seçim listeleri, sıralama/durum seçimleri, sayısal eşikler, ikinci tarih aralığı (vade) */
  hesapIdler?: number[]; istatistikIdler?: number[]; meslekIdler?: number[]; sektorIdler?: number[]; kullaniciIdler?: number[]; bankaIdler?: number[];
  siralama?: string; durum?: string; birlestir?: string; kasaTipi?: number;
  esik?: number; sapma?: number; adet?: number;
  /** MASAK yaş raporu: "yaşından küçük" / "yaşından büyük" sınırları (eski rapor parametreleri) */
  yasKucuk?: number; yasBuyuk?: number;
  vadeBaslangic?: string; vadeBitis?: string;
  /** Karşılıkların çevrileceği para (eski raporlardaki "seçilen para"); boş = TL */
  hedefParaId?: number;
}

/** Seçim listesi filtresi: `kolon IN (…)`; liste boşsa boş metin. `onek` parametre adlarının çakışmaması içindir. */
export function idFiltre(req: sql.Request, idler: number[] | undefined, kolon: string, onek: string): string {
  const ids = (idler || []).filter(n => Number.isInteger(n) && n > 0);
  if (!ids.length) return "";
  ids.forEach((id, i) => req.input(`${onek}${i}`, sql.Int, id));
  return ` AND ${kolon} IN (${ids.map((_, i) => `@${onek}${i}`).join(",")})`;
}
/** Filtre özetine eklenecek "· 3 hesap" parçası */
export const adetOzeti = (idler: number[] | undefined, ad: string) => (idler?.length ? ` · ${idler.length} ${ad}` : "");

export const tarihTr = (v?: string) => (v ? v.split("-").reverse().join(".") : "");
export const HAREKET_TIPI: Record<number, string> = { 0: "Nakit", 1: "Banka / Havale", 2: "POS / Kredi Kartı", 3: "Dekont", 4: "Virman", 5: "Devir" };
/** KISILIK_TIPI kodları — eski programın kodlaması (canlıda doğrulandı 19.09.2026: eski kart listesi 0 → "Ş", 1 → "ŞF", 2 → "F" basıyor). */
export const KISILIK: Record<number, string> = { 0: "Şahıs", 1: "Şahıs firması", 2: "Tüzel kişi", 3: "Yetkili Müessese", 4: "Banka" };

/** TL para kaydı: KOD 'TL' / 'TRY'; yoksa fiş SP'sinin kullandığı PARA_ID=1. */
export const TL_PARA_SQL = `ISNULL((SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID), 1)`;

/** USD para kaydı (KOD 'USD'); yoksa NULL → karşılıklar 0 çıkar. */
export const USD_PARA_SQL = `(SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD))='USD' ORDER BY PARA_ID)`;
/**
 * Fişin USD kuru (F = TODVZ_FIS takma adı) — "USD karşılığı" hesabının böleni. Fiş kaydı GISE_USD_KURU'na gerçek kur yazmadığında (0 / 1) sırayla:
 * 1) fişteki USD satırının kuru (fiş o kurla kesilmiştir), 2) fiş tarihine eşit/önceki en yakın kur tablosundaki USD kuru (alışta alış, satışta satış; efektif yoksa döviz kuru). Bulunamazsa 0.
 */
export const FIS_USD_KURU_SQL = `(CASE WHEN ISNULL(F.GISE_USD_KURU,0) NOT IN (0,1) THEN F.GISE_USD_KURU ELSE ISNULL(COALESCE(
    (SELECT TOP 1 US.KUR FROM dbo.TODVZ_FIS_SATIRI US WHERE US.FIS_ID=F.FIS_ID AND US.PARA_ID=${USD_PARA_SQL} AND ISNULL(US.KUR,0)>0 ORDER BY US.SATIR_NO),
    (SELECT TOP 1 CASE WHEN F.TIP=0 THEN COALESCE(NULLIF(UK.EFEKTIF_ALIS,0),UK.DOVIZ_ALIS) ELSE COALESCE(NULLIF(UK.EFEKTIF_SATIS,0),UK.DOVIZ_SATIS) END
      FROM dbo.TODVZ_KUR UK JOIN dbo.TODVZ_KUR_TABLOSU UT ON UT.KUR_TABLOSU_ID=UK.KUR_TABLOSU_ID
      WHERE UK.PARA_ID=${USD_PARA_SQL} AND CAST(UT.TARIH AS date)<=CAST(F.TARIH AS date)
        AND (CASE WHEN F.TIP=0 THEN COALESCE(NULLIF(UK.EFEKTIF_ALIS,0),UK.DOVIZ_ALIS) ELSE COALESCE(NULLIF(UK.EFEKTIF_SATIS,0),UK.DOVIZ_SATIS) END)>0
      ORDER BY UT.TARIH DESC, UT.KUR_TABLOSU_ID DESC)),0) END)`;

/** Kur tablosu: kurTuru 0 = anlık gişe (en son), 2 = saklanan (kurTarihi'ne eşit/önceki en yakın gün). */
export async function kurCoz(pool: sql.ConnectionPool, p: RaporParametreler) {
  const tur = p.kurTuru === 2 ? 2 : 0;
  const ikisi = p.kurAlani === "ikisi";
  // Eski raporlar efektif kuru kullanır (SODVZCR_* yordamları EFEKTIF_ALIS / EFEKTIF_SATIS döndürür); efektif girilmemişse döviz kuruna düşülür
  const alan = p.kurAlani === "satis" ? "COALESCE(NULLIF(EFEKTIF_SATIS,0),DOVIZ_SATIS)" : "COALESCE(NULLIF(EFEKTIF_ALIS,0),DOVIZ_ALIS)";
  const req = pool.request().input("tur", sql.TinyInt, tur).input("t", sql.Date, p.kurTarihi || p.tarih || null);
  const res = await req.query(`
    SELECT TOP 1 T.KUR_TABLOSU_ID id, T.TARIH tarih FROM dbo.TODVZ_KUR_TABLOSU T
    WHERE T.TUR=@tur AND (@tur=0 OR @t IS NULL OR CAST(T.TARIH AS date)<=@t)
    ORDER BY T.TARIH DESC, T.KUR_TABLOSU_ID DESC;`);
  const tablo = res.recordset[0];
  const kurlar = new Map<number, number>(), satisKurlari = new Map<number, number>();
  if (tablo) {
    const k = await pool.request().input("id", sql.Int, tablo.id).query(`SELECT PARA_ID, ${alan} kur, COALESCE(NULLIF(EFEKTIF_SATIS,0),DOVIZ_SATIS) satis, PARITE FROM dbo.TODVZ_KUR WHERE KUR_TABLOSU_ID=@id`);
    for (const r of k.recordset) { kurlar.set(Number(r.PARA_ID), Number(r.kur) || 0); satisKurlari.set(Number(r.PARA_ID), Number(r.satis) || 0); }
  }
  const tlId = Number((await pool.request().query(`SELECT ${TL_PARA_SQL} id`)).recordset[0]?.id || 1);
  kurlar.set(tlId, 1); satisKurlari.set(tlId, 1);
  const aciklama = tablo
    ? `Kur: ${tur === 0 ? "anlık gişe kuru" : "saklanan kur"} (${ikisi ? "efektif alış + satış" : p.kurAlani === "satis" ? "efektif satış" : "efektif alış"}, tablo tarihi ${new Date(tablo.tarih).toLocaleDateString("tr-TR")})`
    : "Kur tablosu bulunamadı; TL karşılıkları 0 gösterildi.";
  /** kurlar: seçilen alan (ikisi → alış); satisKurlari: satış kuru (ikisi seçilince ek kolonlar) */
  return { kurlar, satisKurlari, ikisi, tlId, aciklama };
}

/** Bir önceki gün (YYYY-AA-GG) — "devir" = dönem başından önceki günün kapanışı */
export const gunOnce = (gun: string) => { const d = new Date(`${gun}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };
/** Verilen tarihe eşit/önceki en yakın kur tablosundaki efektif alış kurları (efektif yoksa döviz alış); TL = 1. Devir / kapanış değerlemeleri için (eski yordamlardaki DEVIR_* / MEVCUT_* / KAPANIS kurları). */
export async function kurTarihte(pool: sql.ConnectionPool, tarih: string) {
  const r = await pool.request().input("t", sql.Date, tarih).query(`
    SELECT K.PARA_ID id, COALESCE(NULLIF(K.EFEKTIF_ALIS,0),K.DOVIZ_ALIS) kur FROM dbo.TODVZ_KUR K
    WHERE K.KUR_TABLOSU_ID=(SELECT TOP 1 T.KUR_TABLOSU_ID FROM dbo.TODVZ_KUR_TABLOSU T WHERE CAST(T.TARIH AS date)<=@t ORDER BY T.TARIH DESC, T.KUR_TABLOSU_ID DESC)`);
  const m = new Map<number, number>(r.recordset.map((x: any) => [Number(x.id), Number(x.kur) || 0]));
  m.set(Number((await pool.request().query(`SELECT ${TL_PARA_SQL} id`)).recordset[0]?.id || 1), 1);
  return m;
}

/** Seçilen (hedef) paraya çevrim: TL karşılığı ÷ hedef paranın kuru; hedef boş ya da TL ise TL karşılığının kendisi. Eski raporlardaki SECILEN_* alanlarının karşılığı. */
export async function hedefPara(pool: sql.ConnectionPool, p: RaporParametreler, kur: { kurlar: Map<number, number>; tlId: number }) {
  const id = p.hedefParaId && p.hedefParaId !== kur.tlId ? p.hedefParaId : kur.tlId;
  const kod = String((await pool.request().input("id", sql.Int, id).query(`SELECT RTRIM(KOD) kod FROM dbo.TODVZ_PARA WHERE PARA_ID=@id`)).recordset[0]?.kod || "TL");
  const bolen = id === kur.tlId ? 1 : kur.kurlar.get(id) ?? 0;
  return { id, kod, cevir: (tl: number) => (bolen > 0 ? tl / bolen : 0), aciklama: `Karşılık parası: ${kod}` };
}

export function sinirla(satirlar: any[], tanim: RaporTanim, filtreOzeti: string, ekDipnot?: string, ozetSatirlar?: Record<string, any>[]): RaporSonucVeri {
  const sinir = tanim.ustSinir || RAPOR_UST_SINIR;
  if (satirlar.length > sinir) return { satirlar: [], filtreOzeti, ekDipnot, sinirAsildi: true, toplamKayit: satirlar.length };
  // Hesap açıklamaları basılmaz (kullanıcı kararı 19.09.2026: eski raporlardaki gibi sade çıktı); not yalnızca rapor boşken, nedenini söylemek için gösterilir
  return { satirlar, filtreOzeti, ekDipnot: satirlar.length ? undefined : ekDipnot, toplamKayit: satirlar.length, ...(ozetSatirlar?.length ? { ozetSatirlar } : {}) };
}

export const aralikOzeti = (p: RaporParametreler) => `${tarihTr(p.baslangic)} – ${tarihTr(p.bitis)}`;

/** Ortak filtre parçaları: cari kod aralığı, vezne kod aralığı, para listesi. Parametreler request'e eklenir, SQL parçası döner. */
export function filtreler(req: sql.Request, p: RaporParametreler, alias: { cari?: string; vezne?: string; para?: string }) {
  const parcalar: string[] = [];
  if (alias.cari) {
    req.input("cbas", sql.VarChar(50), p.cariBaslangic?.trim() || null).input("cbit", sql.VarChar(50), p.cariBitis?.trim() || null).input("cari", sql.Int, p.cariKartId || null);
    parcalar.push(`(@cari IS NULL OR ${alias.cari}.CARI_KART_ID=@cari)`, `(@cbas IS NULL OR RTRIM(${alias.cari}.KOD)>=@cbas)`, `(@cbit IS NULL OR RTRIM(${alias.cari}.KOD)<=@cbit)`);
    const cids = (p.cariIdler || []).filter(n => Number.isInteger(n) && n > 0);
    if (p.cariSonId) {
      // Son kod seçili: ilk koddaki seçimin en küçük kodundan son koda kadar aralık; ilk kod boşsa baştan son koda kadar
      req.input("cson", sql.Int, p.cariSonId);
      cids.forEach((id, i) => req.input(`ci${i}`, sql.Int, id));
      const ilkKod = cids.length ? `(SELECT MIN(RTRIM(KOD)) FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID IN (${cids.map((_, i) => `@ci${i}`).join(",")}))` : "''";
      parcalar.push(`RTRIM(${alias.cari}.KOD) BETWEEN ${ilkKod} AND (SELECT RTRIM(KOD) FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID=@cson)`);
    } else {
      cids.forEach((id, i) => req.input(`cl${i}`, sql.Int, id));
      if (cids.length) parcalar.push(`${alias.cari}.CARI_KART_ID IN (${cids.map((_, i) => `@cl${i}`).join(",")})`);
    }
  }
  if (alias.vezne) {
    req.input("vbas", sql.VarChar(50), p.vezneBaslangic?.trim() || null).input("vbit", sql.VarChar(50), p.vezneBitis?.trim() || null).input("v", sql.Int, p.vezneId || null);
    parcalar.push(`(@v IS NULL OR ${alias.vezne}.VEZNE_ID=@v)`, `(@vbas IS NULL OR RTRIM(${alias.vezne}.KOD)>=@vbas)`, `(@vbit IS NULL OR RTRIM(${alias.vezne}.KOD)<=@vbit)`);
    const vids = (p.vezneIdler || []).filter(n => Number.isInteger(n) && n > 0);
    if (vids.length && p.vezneSonId) {
      req.input("vilk", sql.Int, vids[0]).input("vson", sql.Int, p.vezneSonId);
      parcalar.push(`RTRIM(${alias.vezne}.KOD) BETWEEN (SELECT RTRIM(KOD) FROM dbo.TODVZ_VEZNE WHERE VEZNE_ID=@vilk) AND (SELECT RTRIM(KOD) FROM dbo.TODVZ_VEZNE WHERE VEZNE_ID=@vson)`);
    } else {
      vids.forEach((id, i) => req.input(`vl${i}`, sql.Int, id));
      if (vids.length) parcalar.push(`${alias.vezne}.VEZNE_ID IN (${vids.map((_, i) => `@vl${i}`).join(",")})`);
    }
  }
  if (alias.para) {
    req.input("para", sql.Int, p.paraId || null);
    const ids = (p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0);
    parcalar.push(`(@para IS NULL OR ${alias.para}=@para)`);
    if (ids.length && p.paraSonId) {
      req.input("pilk", sql.Int, ids[0]).input("pson", sql.Int, p.paraSonId);
      parcalar.push(`${alias.para} IN (SELECT PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(KOD) BETWEEN (SELECT RTRIM(KOD) FROM dbo.TODVZ_PARA WHERE PARA_ID=@pilk) AND (SELECT RTRIM(KOD) FROM dbo.TODVZ_PARA WHERE PARA_ID=@pson))`);
    } else {
      ids.forEach((id, i) => req.input(`pl${i}`, sql.Int, id));
      if (ids.length) parcalar.push(`${alias.para} IN (${ids.map((_, i) => `@pl${i}`).join(",")})`);
    }
  }
  return parcalar.length ? " AND " + parcalar.join(" AND ") : "";
}
/** Para seçimi kümesi (paraIdler; paraSonId varsa ilk → son KOD aralığı). null = tümü. FIRVAR1/VEZBAK1 JS süzmesi için. */
export async function paraKumesi(pool: sql.ConnectionPool, p: RaporParametreler): Promise<Set<number> | null> {
  const ids = (p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0);
  if (!ids.length) return null;
  if (!p.paraSonId) return new Set(ids);
  const r = await pool.request().input("pilk", sql.Int, ids[0]).input("pson", sql.Int, p.paraSonId).query(
    `SELECT PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(KOD) BETWEEN (SELECT RTRIM(KOD) FROM dbo.TODVZ_PARA WHERE PARA_ID=@pilk) AND (SELECT RTRIM(KOD) FROM dbo.TODVZ_PARA WHERE PARA_ID=@pson)`);
  return new Set(r.recordset.map((x: any) => Number(x.PARA_ID)));
}
export const ozetEk = (p: RaporParametreler) => [
  p.cariKartId ? "Seçili cari" : p.cariIdler?.length ? (p.cariSonId ? "Cari aralığı" : `${p.cariIdler.length} cari`) : p.cariBaslangic || p.cariBitis ? `Cari ${p.cariBaslangic || "…"} → ${p.cariBitis || "…"}` : "",
  p.vezneId ? "Seçili vezne" : p.vezneIdler?.length ? (p.vezneSonId ? "Vezne aralığı" : `${p.vezneIdler.length} vezne`) : p.vezneBaslangic || p.vezneBitis ? `Vezne ${p.vezneBaslangic || "…"} → ${p.vezneBitis || "…"}` : "",
  p.paraId ? "Seçili para" : p.paraIdler?.length ? (p.paraSonId ? "Para aralığı" : `${p.paraIdler.length} para`) : "",
].filter(Boolean).map(x => " · " + x).join("");

/** Vezne bakiyeleri (tarih dahil) — fiş + nakit cari hareket. Bkz. docs/raporlar.md karar E7. */
export async function vezneBakiyeleri(pool: sql.ConnectionPool, tarih: string, p?: RaporParametreler) {
  // Kasa hareketleri ve vezne transferleri de TODVZ_VEZNE_BAKIYE'yi günceller (SODVZ_HESAP_HAREKETI_KAYDET, SODVZ_VEZNE_TRANSFERI_KAYDET);
  // tarih bazlı hesap anlık bakiye tablosuyla tutsun diye eklenir. Tablolar bazı veritabanlarında henüz yoksa atlanır.
  const var_ = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_HESAP_HAREKETI','U') IS NULL THEN 0 ELSE 1 END kasa,
    CASE WHEN OBJECT_ID('dbo.TODVZ_VEZNE_TRANSFERI','U') IS NULL OR OBJECT_ID('dbo.TODVZ_VEZNE_TRANSFERI_SATIRI','U') IS NULL THEN 0 ELSE 1 END transfer`)).recordset[0] || {};
  const kasaSql = var_.kasa ? `
      UNION ALL
      SELECT KH.VEZNE_ID, KH.PARA_ID, SUM(CASE WHEN KH.TIP=0 THEN KH.MEBLAG ELSE -KH.MEBLAG END)
      FROM dbo.TODVZ_HESAP_HAREKETI KH WHERE CAST(KH.TARIH AS date)<=@t GROUP BY KH.VEZNE_ID, KH.PARA_ID
      UNION ALL
      SELECT KH.VEZNE_ID, ${TL_PARA_SQL}, SUM(CASE WHEN KH.TIP=0 THEN KH.KDV ELSE -KH.KDV END)
      FROM dbo.TODVZ_HESAP_HAREKETI KH WHERE ISNULL(KH.KDV,0)>0 AND CAST(KH.TARIH AS date)<=@t GROUP BY KH.VEZNE_ID` : "";
  const transferSql = var_.transfer ? `
      UNION ALL
      SELECT T.ALAN_VEZNE_ID, TS.PARA_ID, SUM(TS.MIKTAR)
      FROM dbo.TODVZ_VEZNE_TRANSFERI T JOIN dbo.TODVZ_VEZNE_TRANSFERI_SATIRI TS ON TS.VEZNE_TRANSFERI_ID=T.VEZNE_TRANSFERI_ID
      WHERE CAST(T.TARIH AS date)<=@t GROUP BY T.ALAN_VEZNE_ID, TS.PARA_ID
      UNION ALL
      SELECT T.VEREN_VEZNE_ID, TS.PARA_ID, -SUM(TS.MIKTAR)
      FROM dbo.TODVZ_VEZNE_TRANSFERI T JOIN dbo.TODVZ_VEZNE_TRANSFERI_SATIRI TS ON TS.VEZNE_TRANSFERI_ID=T.VEZNE_TRANSFERI_ID
      WHERE CAST(T.TARIH AS date)<=@t GROUP BY T.VEREN_VEZNE_ID, TS.PARA_ID` : "";
  const req = pool.request().input("t", sql.Date, tarih);
  const f = p ? filtreler(req, p, { vezne: "V" }) : "";
  const res = await req.query(`
    ;WITH H AS (
      SELECT F.VEZNE_ID vezneId, S.PARA_ID paraId, SUM(CASE WHEN F.TIP=0 THEN S.MIKTAR ELSE -S.MIKTAR END) miktar
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@t GROUP BY F.VEZNE_ID, S.PARA_ID
      UNION ALL
      SELECT F.VEZNE_ID, ${TL_PARA_SQL}, SUM(CASE WHEN F.TIP=1 THEN F.ODEME_TUTARI ELSE -F.ODEME_TUTARI END)
      FROM dbo.TODVZ_FIS F WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@t GROUP BY F.VEZNE_ID
      UNION ALL
      SELECT CH.VEZNE_ID, CS.PARA_ID, SUM(CASE WHEN CH.TIP=1 THEN CS.MEBLAG ELSE -CS.MEBLAG END)
      FROM dbo.TODVZ_CARI_HAREKET CH JOIN dbo.TODVZ_CARI_HAREKET_SATIRI CS ON CS.CARI_HAREKET_ID=CH.CARI_HAREKET_ID
      WHERE CH.HAREKET_TIPI=0 AND CAST(CH.TARIH AS date)<=@t GROUP BY CH.VEZNE_ID, CS.PARA_ID${kasaSql}${transferSql}
    )
    SELECT H.vezneId, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, H.paraId,
      RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo, SUM(H.miktar) miktar
    FROM H LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.vezneId LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=H.paraId
    WHERE 1=1 ${f}
    GROUP BY H.vezneId, V.KOD, V.AD, H.paraId, P.KOD, P.AD, P.SIRA_NO
    ORDER BY V.KOD, ISNULL(P.SIRA_NO,99), P.KOD;`);
  return res.recordset as { vezneId: number; vezneKod: string; vezneAd: string; paraId: number; paraKod: string; paraAd: string; miktar: number }[];
}
export const VEZNE_BAKIYE_DIPNOT = "Bakiye hesabı: iptal edilmemiş alış fişleri döviz miktarını artırır ve ödeme tutarını TL'den düşer, satış fişleri tersini yapar; nakit türündeki cari hareketlerde alacak vezneye giriş, borç çıkış sayılır. Kasa hesap hareketleri (giriş +, çıkış −; KDV TL'ye) ve vezne transferleri (alan +, veren −) de dahildir. Gün sonu kapanış tablosu kullanılmaz; seçilen tarihe kadar tüm hareketler toplanır.";


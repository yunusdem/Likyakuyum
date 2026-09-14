import sql from "mssql";
import { ApiError } from "../../utils/ApiError.js";
import { RAPOR_UST_SINIR, type RaporSonucVeri, type RaporTanim } from "./raporTanim.js";

/**
 * Rapor veri katmanı — yalnızca SELECT. Hiçbir tabloya yazılmaz, SP çağrılmaz.
 * Tablolar: TODVZ_CARI_KART, TODVZ_CARI_HAREKET(+_SATIRI), TODVZ_FIS(+_SATIRI), TODVZ_VEZNE, TODVZ_PARA,
 * TODVZ_KUR_TABLOSU / TODVZ_KUR. Kolon adları mevcut repository'lerden alındı (bkz. docs/raporlar.md Bölüm 2).
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
}

const tarihTr = (v?: string) => (v ? v.split("-").reverse().join(".") : "");
const HAREKET_TIPI: Record<number, string> = { 0: "Nakit", 1: "Banka / Havale", 2: "POS / Kredi Kartı", 3: "Dekont", 4: "Virman", 5: "Devir" };
const KISILIK: Record<number, string> = { 0: "Gerçek kişi", 1: "Tüzel kişi" };

/** TL para kaydı: KOD 'TL' / 'TRY'; yoksa fiş SP'sinin kullandığı PARA_ID=1. */
const TL_PARA_SQL = `ISNULL((SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID), 1)`;

/** Kur tablosu: kurTuru 0 = anlık gişe (en son), 2 = saklanan (kurTarihi'ne eşit/önceki en yakın gün). */
async function kurCoz(pool: sql.ConnectionPool, p: RaporParametreler) {
  const tur = p.kurTuru === 2 ? 2 : 0;
  const ikisi = p.kurAlani === "ikisi";
  const alan = p.kurAlani === "satis" ? "DOVIZ_SATIS" : "DOVIZ_ALIS";
  const req = pool.request().input("tur", sql.TinyInt, tur).input("t", sql.Date, p.kurTarihi || p.tarih || null);
  const res = await req.query(`
    SELECT TOP 1 T.KUR_TABLOSU_ID id, T.TARIH tarih FROM dbo.TODVZ_KUR_TABLOSU T
    WHERE T.TUR=@tur AND (@tur=0 OR @t IS NULL OR CAST(T.TARIH AS date)<=@t)
    ORDER BY T.TARIH DESC, T.KUR_TABLOSU_ID DESC;`);
  const tablo = res.recordset[0];
  const kurlar = new Map<number, number>(), satisKurlari = new Map<number, number>();
  if (tablo) {
    const k = await pool.request().input("id", sql.Int, tablo.id).query(`SELECT PARA_ID, ${alan} kur, DOVIZ_SATIS satis, PARITE FROM dbo.TODVZ_KUR WHERE KUR_TABLOSU_ID=@id`);
    for (const r of k.recordset) { kurlar.set(Number(r.PARA_ID), Number(r.kur) || 0); satisKurlari.set(Number(r.PARA_ID), Number(r.satis) || 0); }
  }
  const tlId = Number((await pool.request().query(`SELECT ${TL_PARA_SQL} id`)).recordset[0]?.id || 1);
  kurlar.set(tlId, 1); satisKurlari.set(tlId, 1);
  const aciklama = tablo
    ? `Kur: ${tur === 0 ? "anlık gişe kuru" : "saklanan kur"} (${ikisi ? "döviz alış + satış" : alan === "DOVIZ_ALIS" ? "döviz alış" : "döviz satış"}, tablo tarihi ${new Date(tablo.tarih).toLocaleDateString("tr-TR")})`
    : "Kur tablosu bulunamadı; TL karşılıkları 0 gösterildi.";
  /** kurlar: seçilen alan (ikisi → alış); satisKurlari: satış kuru (ikisi seçilince ek kolonlar) */
  return { kurlar, satisKurlari, ikisi, tlId, aciklama };
}

function sinirla(satirlar: any[], tanim: RaporTanim, filtreOzeti: string, ekDipnot?: string): RaporSonucVeri {
  const sinir = tanim.ustSinir || RAPOR_UST_SINIR;
  if (satirlar.length > sinir) return { satirlar: [], filtreOzeti, ekDipnot, sinirAsildi: true, toplamKayit: satirlar.length };
  return { satirlar, filtreOzeti, ekDipnot, toplamKayit: satirlar.length };
}

const aralikOzeti = (p: RaporParametreler) => `${tarihTr(p.baslangic)} – ${tarihTr(p.bitis)}`;

/** Ortak filtre parçaları: cari kod aralığı, vezne kod aralığı, para listesi. Parametreler request'e eklenir, SQL parçası döner. */
function filtreler(req: sql.Request, p: RaporParametreler, alias: { cari?: string; vezne?: string; para?: string }) {
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
async function paraKumesi(pool: sql.ConnectionPool, p: RaporParametreler): Promise<Set<number> | null> {
  const ids = (p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0);
  if (!ids.length) return null;
  if (!p.paraSonId) return new Set(ids);
  const r = await pool.request().input("pilk", sql.Int, ids[0]).input("pson", sql.Int, p.paraSonId).query(
    `SELECT PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(KOD) BETWEEN (SELECT RTRIM(KOD) FROM dbo.TODVZ_PARA WHERE PARA_ID=@pilk) AND (SELECT RTRIM(KOD) FROM dbo.TODVZ_PARA WHERE PARA_ID=@pson)`);
  return new Set(r.recordset.map((x: any) => Number(x.PARA_ID)));
}
const ozetEk = (p: RaporParametreler) => [
  p.cariKartId ? "Seçili cari" : p.cariIdler?.length ? (p.cariSonId ? "Cari aralığı" : `${p.cariIdler.length} cari`) : p.cariBaslangic || p.cariBitis ? `Cari ${p.cariBaslangic || "…"} → ${p.cariBitis || "…"}` : "",
  p.vezneId ? "Seçili vezne" : p.vezneIdler?.length ? (p.vezneSonId ? "Vezne aralığı" : `${p.vezneIdler.length} vezne`) : p.vezneBaslangic || p.vezneBitis ? `Vezne ${p.vezneBaslangic || "…"} → ${p.vezneBitis || "…"}` : "",
  p.paraId ? "Seçili para" : p.paraIdler?.length ? (p.paraSonId ? "Para aralığı" : `${p.paraIdler.length} para`) : "",
].filter(Boolean).map(x => " · " + x).join("");

/** Vezne bakiyeleri (tarih dahil) — fiş + nakit cari hareket. Bkz. docs/raporlar.md karar E7. */
async function vezneBakiyeleri(pool: sql.ConnectionPool, tarih: string, p?: RaporParametreler) {
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
      WHERE CH.HAREKET_TIPI=0 AND CAST(CH.TARIH AS date)<=@t GROUP BY CH.VEZNE_ID, CS.PARA_ID
    )
    SELECT H.vezneId, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, H.paraId,
      RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo, SUM(H.miktar) miktar
    FROM H LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.vezneId LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=H.paraId
    WHERE 1=1 ${f}
    GROUP BY H.vezneId, V.KOD, V.AD, H.paraId, P.KOD, P.AD, P.SIRA_NO
    ORDER BY V.KOD, ISNULL(P.SIRA_NO,99), P.KOD;`);
  return res.recordset as { vezneId: number; vezneKod: string; vezneAd: string; paraId: number; paraKod: string; paraAd: string; miktar: number }[];
}
const VEZNE_BAKIYE_DIPNOT = "Bakiye hesabı: iptal edilmemiş alış fişleri döviz miktarını artırır ve ödeme tutarını TL'den düşer, satış fişleri tersini yapar; nakit türündeki cari hareketlerde alacak vezneye giriş, borç çıkış sayılır. Gün sonu kapanış tablosu kullanılmaz; seçilen tarihe kadar tüm hareketler toplanır.";

export const RAPOR_SORGULARI: Record<string, (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>> = {

  /** R1 Cari bakiye raporu — tarih aralığı (yönetici 14.09.2026): borç/alacak aralıktaki hareketler, bakiye bitiş tarihi itibarıyla; para ve has bazında, sıfır bakiyeli cariler dahil */
  async CARBAK1(pool, p, t) {
    const bas = p.baslangic || p.tarih, bit = p.bitis || p.tarih;
    if (!bas || !bit) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, bas).input("t", sql.Date, bit);
    const f = filtreler(req, p, { cari: "C", para: "B.PARA_ID" });
    const res = await req.query(`
      ;WITH B AS (
        SELECT H.CARI_KART_ID, S.PARA_ID,
          SUM(CASE WHEN H.TIP=0 AND CAST(H.TARIH AS date)>=@bas THEN S.MEBLAG ELSE 0 END) BORC, SUM(CASE WHEN H.TIP=1 AND CAST(H.TARIH AS date)>=@bas THEN S.MEBLAG ELSE 0 END) ALACAK,
          SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE -S.MEBLAG END) BAKIYE
        FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
        WHERE CAST(H.TARIH AS date)<=@t GROUP BY H.CARI_KART_ID, S.PARA_ID)
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd,
        ISNULL(RTRIM(P.KOD),'-') paraKod, ISNULL(B.BORC,0) borc, ISNULL(B.ALACAK,0) alacak,
        ISNULL(B.BAKIYE,0) bakiye, ISNULL(P.HAS_ORANI,0) hasOrani
      FROM dbo.TODVZ_CARI_KART C
      LEFT JOIN B ON B.CARI_KART_ID=C.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=B.PARA_ID
      WHERE 1=1 ${f}
      ORDER BY C.KOD, ISNULL(P.SIRA_NO,99), P.KOD;`);
    const satirlar = res.recordset.map((r: any) => {
      const bakiye = Number(r.bakiye) || 0;
      return { ...r, borc: Number(r.borc), alacak: Number(r.alacak), bakiye: Math.abs(bakiye),
        yon: bakiye > 0 ? "Alacak" : bakiye < 0 ? "Borç" : "-",
        hasKarsiligi: Math.abs(bakiye) * (Number(r.hasOrani) || 0), cariBaslik: `${r.cariKod} — ${r.cariAd}` };
    });
    return sinirla(satirlar, t, `${tarihTr(bas)} – ${tarihTr(bit)}${ozetEk(p) || " · Tüm cariler"}`,
      "Borç ve alacak seçilen tarih aralığındaki hareketlerin toplamıdır; bakiye bitiş tarihi itibarıyla tüm hareketlerden hesaplanır. Yön: Alacak = carinin bizden alacağı, Borç = carinin bize borcu. Has karşılığı = bakiye × para tanımındaki has oranı. Sıfır bakiyeli cariler de listelenir.");
  },

  /** R2 Cari ekstre — cari aralığı (Ahmet -> Mehmet), tarih aralığı, para (çoklu); cari × para grubu, cari başlık bilgisi, devir + yürüyen bakiye, fiş no, has karşılığı */
  async CAREKS1(pool, p, t) {
    if (!p.cariKartId && !p.cariIdler?.length && !p.cariSonId && !p.cariBaslangic && !p.cariBitis) throw ApiError.badRequest("En az bir cari seçilmelidir.");
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { cari: "C", para: "S.PARA_ID" });
    const cariAlan = `RTRIM(ISNULL(C.ADRES,'')) cariAdres, RTRIM(ISNULL(C.TELEFON,'')) cariTelefon, RTRIM(ISNULL(C.VERGI_KIMLIK_NO,'')) cariVergiNo`;
    const res = await req.query(`
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, ${cariAlan}, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(P.HAS_ORANI,0) hasOrani,
        SUM(CASE WHEN H.TIP=0 THEN S.MEBLAG ELSE 0 END) borc, SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE 0 END) alacak
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
      JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID
      WHERE CAST(H.TARIH AS date)<@bas ${f} GROUP BY C.CARI_KART_ID, C.KOD, C.AD, C.ADRES, C.TELEFON, C.VERGI_KIMLIK_NO, S.PARA_ID, P.KOD, P.SIRA_NO, P.HAS_ORANI;
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, ${cariAlan}, H.CARI_HAREKET_ID fisNo, H.TARIH tarih, H.HAREKET_TIPI hareketTipi, H.TIP tip,
        RTRIM(ISNULL(H.ACIKLAMA,'')) aciklama, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(P.HAS_ORANI,0) hasOrani, S.MEBLAG meblag, RTRIM(ISNULL(V.KOD,'')) vezneKod
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
      JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.VEZNE_ID
      WHERE CAST(H.TARIH AS date) BETWEEN @bas AND @bit ${f}
      ORDER BY C.KOD, ISNULL(P.SIRA_NO,99), P.KOD, H.TARIH, H.CARI_HAREKET_ID, S.SATIR_NO;`);
    const sets = res.recordsets as any[];
    const anahtar = (r: any) => `${r.cariKod}|${r.paraKod}`;
    type Grup = { cariKod: string; cariAd: string; cariAdres: string; cariTelefon: string; cariVergiNo: string; paraKod: string; siraNo: number; hasOrani: number; devir: number; hareketler: any[] };
    const gruplar = new Map<string, Grup>();
    const ekle = (r: any) => { const k = anahtar(r); if (!gruplar.has(k)) gruplar.set(k, { cariKod: r.cariKod, cariAd: r.cariAd, cariAdres: r.cariAdres || "", cariTelefon: r.cariTelefon || "", cariVergiNo: r.cariVergiNo || "",
      paraKod: r.paraKod, siraNo: Number(r.siraNo), hasOrani: Number(r.hasOrani) || 0, devir: 0, hareketler: [] }); return gruplar.get(k)!; };
    for (const d of sets[0]) ekle(d).devir = Number(d.alacak) - Number(d.borc);
    for (const h of sets[1]) ekle(h).hareketler.push(h);
    const satirlar: any[] = [];
    for (const g of [...gruplar.values()].sort((x, y) => x.cariKod.localeCompare(y.cariKod) || x.siraNo - y.siraNo || x.paraKod.localeCompare(y.paraKod))) {
      let bakiye = g.devir;
      const altBaslik = [g.cariAdres, g.cariTelefon ? `Tel: ${g.cariTelefon}` : "", g.cariVergiNo ? `${g.cariVergiNo.length === 11 ? "TCKN" : "VKN"}: ${g.cariVergiNo}` : ""].filter(Boolean).join(" · ");
      const ortak = { grupAnahtar: `${g.cariKod}|${g.paraKod}`, grupBaslik: `${g.cariKod} — ${g.cariAd} · ${g.paraKod}`, grupAltBaslik: altBaslik,
        cariKod: g.cariKod, cariAd: g.cariAd, cariAdres: g.cariAdres, cariTelefon: g.cariTelefon, cariVergiNo: g.cariVergiNo, paraKod: g.paraKod, hasOrani: g.hasOrani };
      const satir = (ek: Record<string, any>) => ({ ...ortak, ...ek, bakiye: Math.abs(bakiye), yon: bakiye > 0 ? "A" : bakiye < 0 ? "B" : "", hasKarsiligi: Math.abs(bakiye) * g.hasOrani });
      satirlar.push(satir({ fisNo: "", tarih: p.baslangic, hareketTipi: "Devir", aciklama: `${tarihTr(p.baslangic)} öncesi devir`, vezneKod: "",
        borc: bakiye < 0 ? -bakiye : 0, alacak: bakiye > 0 ? bakiye : 0 }));
      for (const h of g.hareketler) {
        const meblag = Number(h.meblag) || 0;
        bakiye += Number(h.tip) === 1 ? meblag : -meblag;
        satirlar.push(satir({ fisNo: String(h.fisNo ?? ""), tarih: h.tarih, hareketTipi: HAREKET_TIPI[Number(h.hareketTipi)] || "Diğer", aciklama: h.aciklama, vezneKod: h.vezneKod,
          borc: Number(h.tip) === 0 ? meblag : 0, alacak: Number(h.tip) === 1 ? meblag : 0 }));
      }
    }
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p)}`,
      "Yön: A = cari alacaklı (bizden alacağı var), B = cari borçlu. Her cari ve para birimi ayrı gruplanır; ilk satır başlangıç tarihinden önceki devirdir. Has karşılığı = yürüyen bakiye × para tanımındaki has oranı.");
  },

  /** R3 Cari hareket listesi */
  async CARHAR1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
      .input("ht", sql.Int, Number.isInteger(p.hareketTipi) ? p.hareketTipi : null);
    const htler = (p.hareketTipleri || []).filter(n => Number.isInteger(n) && n >= 0 && n <= 5);
    htler.forEach((h, i) => req.input(`htl${i}`, sql.Int, h));
    const f = filtreler(req, p, { cari: "C", vezne: "V", para: "S.PARA_ID" }) + (htler.length ? ` AND H.HAREKET_TIPI IN (${htler.map((_, i) => `@htl${i}`).join(",")})` : "");
    const res = await req.query(`
      SELECT H.CARI_HAREKET_ID fisNo, H.TARIH tarih, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, H.HAREKET_TIPI hareketTipiKod, H.TIP tipKod,
        RTRIM(ISNULL(H.ACIKLAMA,'')) aciklama, RTRIM(P.KOD) paraKod, S.MEBLAG meblag, RTRIM(ISNULL(V.KOD,'')) vezneKod
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
      JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.VEZNE_ID
      WHERE CAST(H.TARIH AS date) BETWEEN @bas AND @bit AND (@ht IS NULL OR H.HAREKET_TIPI=@ht) ${f}
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, H.TARIH, H.CARI_HAREKET_ID, S.SATIR_NO;`);
    const satirlar = res.recordset.map((r: any) => ({ ...r, fisNo: String(r.fisNo ?? ""), meblag: Number(r.meblag), hareketTipi: HAREKET_TIPI[Number(r.hareketTipiKod)] || "Diğer",
      tip: Number(r.tipKod) === 1 ? "Alacak" : "Borç", borc: Number(r.tipKod) === 0 ? Number(r.meblag) : 0, alacak: Number(r.tipKod) === 1 ? Number(r.meblag) : 0 }));
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p)}${Number.isInteger(p.hareketTipi) ? ` · ${HAREKET_TIPI[p.hareketTipi!] || "Diğer"}` : htler.length ? ` · ${htler.map(h => HAREKET_TIPI[h]).join(", ")}` : ""}`);
  },

  /** R4 Cari kart listesi */
  async CARKRT1(pool, p, t) {
    const res = await pool.request().input("arama", sql.NVarChar(100), p.arama?.trim() ? `%${p.arama.trim()}%` : null).query(`
      SELECT RTRIM(ISNULL(C.KOD,'')) kod, RTRIM(ISNULL(C.AD,'')) ad, C.KISILIK_TIPI kisilikKod, RTRIM(ISNULL(C.VERGI_KIMLIK_NO,'')) vergiNo,
        RTRIM(ISNULL(C.PASAPORT_NO,'')) pasaportNo, RTRIM(ISNULL(C.TELEFON,'')) telefon, RTRIM(ISNULL(C.EPOSTA,'')) eposta, RTRIM(ISNULL(C.ADRES,'')) adres,
        ISNULL(C.KARA_LISTEDE,0) karaListe, RTRIM(ISNULL(C.YETKILI_KISI,'')) yetkili
      FROM dbo.TODVZ_CARI_KART C
      WHERE (@arama IS NULL OR C.KOD LIKE @arama OR C.AD LIKE @arama OR C.VERGI_KIMLIK_NO LIKE @arama)
      ORDER BY C.KOD;`);
    const satirlar = res.recordset.map((r: any) => ({ ...r, kisilik: KISILIK[Number(r.kisilikKod)] || "-", karaListe: r.karaListe ? "EVET" : "" }));
    return sinirla(satirlar, t, p.arama?.trim() ? `Arama: "${p.arama.trim()}"` : "Tüm cari kartlar");
  },

  /** R5 Firma varlıkları — vezne bakiyeleri + cari alacak/borç, seçilen kurla TL */
  async FIRVAR1(pool, p, t) {
    if (!p.tarih) throw ApiError.badRequest("Tarih zorunludur.");
    const kur = await kurCoz(pool, p);
    const vezneler = await vezneBakiyeleri(pool, p.tarih, p);
    const paraSet = await paraKumesi(pool, p);
    const paraUygun = (id: number) => (!p.paraId || id === p.paraId) && (!paraSet || paraSet.has(id));
    const satirlar: any[] = vezneler.filter(v => Math.abs(v.miktar) > 0.000001 && paraUygun(Number(v.paraId))).map(v => ({
      kaynak: `Vezne ${v.vezneKod} — ${v.vezneAd}`, grup: "1-Vezneler", paraKod: v.paraKod, miktar: Number(v.miktar), kur: kur.kurlar.get(v.paraId) ?? 0,
      tlKarsiligi: Number(v.miktar) * (kur.kurlar.get(v.paraId) ?? 0), kurSatis: kur.satisKurlari.get(v.paraId) ?? 0, tlSatis: Number(v.miktar) * (kur.satisKurlari.get(v.paraId) ?? 0) }));
    const cari = await pool.request().input("t", sql.Date, p.tarih).query(`
      SELECT S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        SUM(CASE WHEN H.TIP=0 THEN S.MEBLAG ELSE 0 END) borc, SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE 0 END) alacak
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
      WHERE CAST(H.TARIH AS date)<=@t GROUP BY S.PARA_ID, P.KOD, P.SIRA_NO ORDER BY ISNULL(P.SIRA_NO,99), P.KOD;`);
    for (const r of cari.recordset) {
      if (!paraUygun(Number(r.paraId))) continue;
      const k = kur.kurlar.get(Number(r.paraId)) ?? 0, ks = kur.satisKurlari.get(Number(r.paraId)) ?? 0;
      if (Number(r.borc)) satirlar.push({ kaynak: "Cari alacaklarımız (carilerin bize borcu)", grup: "2-Cari alacaklar", paraKod: r.paraKod, miktar: Number(r.borc), kur: k, tlKarsiligi: Number(r.borc) * k, kurSatis: ks, tlSatis: Number(r.borc) * ks });
      if (Number(r.alacak)) satirlar.push({ kaynak: "Cari borçlarımız (carilerin bizden alacağı)", grup: "3-Cari borçlar", paraKod: r.paraKod, miktar: -Number(r.alacak), kur: k, tlKarsiligi: -Number(r.alacak) * k, kurSatis: ks, tlSatis: -Number(r.alacak) * ks });
    }
    return sinirla(satirlar, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p)} · ${kur.aciklama}`,
      `${VEZNE_BAKIYE_DIPNOT} Cari borçlarımız eksi işaretle düşülür; banka hesapları kapsam dışıdır (yönetici kararı). ${kur.aciklama}.`);
  },

  /** R6 Kâr/zarar faaliyet analizi — ağırlıklı ortalama maliyet */
  async KARZAR1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
    const res = await req.query(`
      SELECT F.FIS_ID fisId, F.TARIH tarih, F.TIP tip, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo,
        S.MIKTAR miktar, S.KUR kur, S.TUTAR tutar, S.KOMISYON komisyon, S.BMV bmv, S.KMV kmv, S.KDV kdv
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@bit ${f}
        AND RTRIM(UPPER(P.KOD)) NOT IN ('TL','TRY')
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, F.TARIH, F.FIS_ID, S.SATIR_NO;`);
    const bas = new Date(p.baslangic);
    const ozet = new Map<number, any>();
    const stok = new Map<number, { miktar: number; maliyet: number; sonOrt: number }>();
    for (const r of res.recordset) {
      const id = Number(r.paraId);
      if (!ozet.has(id)) ozet.set(id, { paraKod: r.paraKod, paraAd: r.paraAd, alisMiktar: 0, alisTutar: 0, satisMiktar: 0, satisTutar: 0, satisMaliyeti: 0, brutKar: 0, komisyon: 0, vergiler: 0, netKar: 0, ortMaliyet: 0, kalanMiktar: 0 });
      const o = ozet.get(id), s = stok.get(id) || { miktar: 0, maliyet: 0, sonOrt: 0 };
      const miktar = Number(r.miktar) || 0, tutar = Number(r.tutar) || 0, kur = Number(r.kur) || 0;
      const donemde = new Date(r.tarih) >= bas;
      if (Number(r.tip) === 0) { // alış: stoka maliyetiyle girer
        s.miktar += miktar; s.maliyet += tutar; if (s.miktar > 0) s.sonOrt = s.maliyet / s.miktar;
        if (donemde) { o.alisMiktar += miktar; o.alisTutar += tutar; }
      } else { // satış: ağırlıklı ortalama maliyetle stoktan düşer
        const ort = s.miktar > 0 ? s.maliyet / s.miktar : (s.sonOrt || kur);
        const maliyet = miktar * ort;
        s.miktar -= miktar; s.maliyet -= maliyet; if (s.miktar <= 0.0000001) { s.miktar = Math.max(s.miktar, 0); s.maliyet = s.miktar * ort; } s.sonOrt = ort;
        if (donemde) { o.satisMiktar += miktar; o.satisTutar += tutar; o.satisMaliyeti += maliyet; o.brutKar += tutar - maliyet; }
      }
      if (donemde) { o.komisyon += Number(r.komisyon) || 0; o.vergiler += (Number(r.bmv) || 0) + (Number(r.kmv) || 0) + (Number(r.kdv) || 0); }
      stok.set(id, s);
    }
    const satirlar = [...ozet.entries()].map(([id, o]) => { const s = stok.get(id)!; return { ...o, ortMaliyet: s.miktar > 0 ? s.maliyet / s.miktar : s.sonOrt, kalanMiktar: s.miktar, netKar: o.brutKar + o.komisyon - o.vergiler,
      ortAlisKuru: o.alisMiktar > 0 ? o.alisTutar / o.alisMiktar : 0, ortSatisKuru: o.satisMiktar > 0 ? o.satisTutar / o.satisMiktar : 0 }; })
      .filter(o => o.alisMiktar || o.satisMiktar || o.komisyon);
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm dövizler"}`);
  },

  /** R7 Vergiler ve komisyon — vezne → gün → para, iptal fişler hariç */
  async VERKOM1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
      .input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
    const res = await req.query(`
      SELECT RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, CAST(F.TARIH AS date) gun, RTRIM(P.KOD) paraKod,
        COUNT(DISTINCT F.FIS_ID) adet, SUM(S.MIKTAR) miktar, SUM(S.TUTAR) tutar, SUM(S.KOMISYON) komisyon, SUM(S.BMV) bmv, SUM(S.KMV) kmv, SUM(S.KDV) kdv
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      GROUP BY V.KOD, V.AD, CAST(F.TARIH AS date), P.KOD, P.SIRA_NO
      ORDER BY V.KOD, CAST(F.TARIH AS date), ISNULL(P.SIRA_NO,99), P.KOD;`);
    const satirlar = res.recordset.map((r: any) => ({ ...r, adet: Number(r.adet), miktar: Number(r.miktar), tutar: Number(r.tutar), komisyon: Number(r.komisyon), bmv: Number(r.bmv), kmv: Number(r.kmv), kdv: Number(r.kdv),
      toplamVergi: (Number(r.bmv) || 0) + (Number(r.kmv) || 0) + (Number(r.kdv) || 0), vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` }));
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : ""}`);
  },

  /** R8 Vezne bakiye raporu (tarih bazlı) */
  async VEZBAK1(pool, p, t) {
    if (!p.tarih) throw ApiError.badRequest("Tarih zorunludur.");
    const kur = await kurCoz(pool, p);
    const rows = await vezneBakiyeleri(pool, p.tarih, p);
    const paraSet = await paraKumesi(pool, p);
    const satirlar = rows.filter(r => (!p.paraId || r.paraId === p.paraId) && (!paraSet || paraSet.has(Number(r.paraId)))).map(r => ({ ...r, miktar: Number(r.miktar), kur: kur.kurlar.get(r.paraId) ?? 0,
      tlKarsiligi: Number(r.miktar) * (kur.kurlar.get(r.paraId) ?? 0), kurSatis: kur.satisKurlari.get(r.paraId) ?? 0, tlSatis: Number(r.miktar) * (kur.satisKurlari.get(r.paraId) ?? 0), vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` }));
    return sinirla(satirlar, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p) || " · Tüm vezneler"} · ${kur.aciklama}`, VEZNE_BAKIYE_DIPNOT);
  },

  /** R9 Vezne hareket listesi — tarih + saat aralığı; seçilen kurla TL karşılığı (.rpt "Kur" parametresi) */
  async VEZHAR1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const kur = await kurCoz(pool, { ...p, kurTarihi: p.kurTarihi || p.bitis });
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
      .input("sbas", sql.VarChar(8), p.baslangicSaat || "00:00:00").input("sbit", sql.VarChar(8), p.bitisSaat || "23:59:59")
      .input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
    const res = await req.query(`
      SELECT F.FIS_ID fisId, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, ISNULL(F.ZAMAN,F.TARIH) zaman, F.TIP tipKod,
        RTRIM(ISNULL(F.SERI_NO,''))+RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan, S.PARA_ID paraId, RTRIM(P.KOD) paraKod,
        S.MIKTAR miktar, S.KUR kur, S.TUTAR tutar, S.KOMISYON komisyon, S.BMV bmv
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit
        AND CAST(ISNULL(F.ZAMAN,F.TARIH) AS time) BETWEEN CAST(@sbas AS time) AND CAST(@sbit AS time)
        AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY V.KOD, ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
    const satirlar = res.recordset.map((r: any) => { const secilenKur = kur.kurlar.get(Number(r.paraId)) ?? 0, ks = kur.satisKurlari.get(Number(r.paraId)) ?? 0; return { ...r, tip: Number(r.tipKod) === 1 ? "Satış" : "Alış", miktar: Number(r.miktar), kur: Number(r.kur), tutar: Number(r.tutar), komisyon: Number(r.komisyon), bmv: Number(r.bmv),
      secilenKur, secilenTl: Number(r.miktar) * secilenKur, kurSatis: ks, tlSatis: Number(r.miktar) * ks, vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` }; });
    return sinirla(satirlar, t, `${aralikOzeti(p)} · ${(p.baslangicSaat || "00:00").slice(0, 5)}–${(p.bitisSaat || "23:59").slice(0, 5)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : ""} · ${kur.aciklama}`,
      `İptal edilmiş fişler listelenmez. "Seçilen kur / TL" kolonları fiş kurundan bağımsız, parametrede seçilen kurla hesaplanır (${kur.aciklama}).`);
  },
};

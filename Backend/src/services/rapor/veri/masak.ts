import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, FIS_USD_KURU_SQL, adetOzeti, aralikOzeti, filtreler, idFiltre, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";

/**
 * MASAK raporları (docs/raporlar-faz2.md, Faz R2-M) — yalnızca SELECT, fiş bazında (TODVZ_FIS; iptal fişler hariç).
 * Meslek ve doğum tarihi fişten; sektör fişte tutulmadığı için cari kartından (carisiz fişler "Sektör yok").
 * MASAK modülünün (liste güncelleme / sorgu) dosyalarına dokunulmaz; yalnızca fişteki işaretler okunur.
 */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

export interface MasakFisi {
  fisId: number; zaman: any; gun: string; belgeNo: string; unvan: string; kimlikNo: string; tip: string; tutar: number; usdKarsiligi: number;
  meslekId: number; meslek: string; sektor: string; dogumTarihi: any; masakListesinde: boolean; supheliYetkili: string; kaydeden: string; vezneKod: string; paralar: string;
}
/** Fiş satırı düzeyi: `tutar` satır tutarı, `fisTutar` fişin TL toplamı */
export interface MasakSatiri extends MasakFisi { satirNo: number; seriNo: string; fisTutar: number; miktar: number; kur: number; paraKod: string }

const YAS_ARALIKLARI: [number, number, string][] = [[0, 17, "0 – 17"], [18, 25, "18 – 25"], [26, 35, "26 – 35"], [36, 50, "36 – 50"], [51, 65, "51 – 65"], [66, 200, "66 ve üzeri"]];
/** İşlem tarihindeki yaş (doğum günü henüz gelmediyse bir eksik) ve yaş aralığı. Saf fonksiyon. */
export function yasAraligi(dogum: any, islem: any): { yas: number | null; aralik: string; sira: number } {
  const d = dogum ? new Date(dogum) : null, i = new Date(islem);
  if (!d || Number.isNaN(d.getTime()) || Number.isNaN(i.getTime()) || d > i) return { yas: null, aralik: "Doğum tarihi yok", sira: 99 };
  let yas = i.getFullYear() - d.getFullYear();
  if (i.getMonth() < d.getMonth() || (i.getMonth() === d.getMonth() && i.getDate() < d.getDate())) yas--;
  const k = YAS_ARALIKLARI.findIndex(([a, b]) => yas >= a && yas <= b);
  return { yas, aralik: k >= 0 ? YAS_ARALIKLARI[k][2] : "Doğum tarihi yok", sira: k >= 0 ? k : 99 };
}

/**
 * Fiş kontrolü — şüpheli işlem bildirimi öncesi gözden geçirilecek fişler ve nedenleri. Saf fonksiyon.
 *  1) fiş MASAK listesinde eşleşme işaretli; 2) tutar ≥ eşik ama kimlik no / doğum tarihi / meslek eksik;
 *  3) aynı kimlikle aynı gün en az `n` fiş, her biri eşiğin altında ama toplamı eşiği aşıyor (parçalı işlem).
 */
export function masakKontrol(fisler: Pick<MasakFisi, "fisId" | "gun" | "kimlikNo" | "tutar" | "meslekId" | "dogumTarihi" | "masakListesinde">[], esik: number, n: number): Map<number, string[]> {
  const neden = new Map<number, string[]>();
  const ekle = (id: number, m: string) => { if (!neden.has(id)) neden.set(id, []); neden.get(id)!.push(m); };
  const gunluk = new Map<string, typeof fisler>();
  for (const f of fisler) {
    if (f.masakListesinde) ekle(f.fisId, "MASAK listesinde eşleşme");
    if (esik > 0 && f.tutar >= esik) {
      const eksik = [!f.kimlikNo ? "kimlik no" : "", !f.dogumTarihi ? "doğum tarihi" : "", !f.meslekId ? "meslek" : ""].filter(Boolean);
      if (eksik.length) ekle(f.fisId, `Eşik üstü, eksik bilgi: ${eksik.join(", ")}`);
    }
    if (f.kimlikNo) { const k = `${f.kimlikNo}|${f.gun}`; if (!gunluk.has(k)) gunluk.set(k, []); gunluk.get(k)!.push(f); }
  }
  if (esik > 0) for (const grup of gunluk.values()) {
    const alti = grup.filter(f => f.tutar < esik), toplam = alti.reduce((a, f) => a + f.tutar, 0);
    if (alti.length >= n && toplam >= esik) for (const f of alti) ekle(f.fisId, `Parçalı işlem: aynı gün ${alti.length} fiş, toplam ${toplam.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} TL`);
  }
  return neden;
}

/** Grup özeti (alt rapor karşılığı): grup, fiş adedi, tutar, pay %. Saf fonksiyon. */
export function grupOzeti(satirlar: { grupBaslik: string; tutar: number; usdKarsiligi: number }[]) {
  const m = new Map<string, { grup: string; adet: number; tutar: number; usdKarsiligi: number }>();
  for (const s of satirlar) { if (!m.has(s.grupBaslik)) m.set(s.grupBaslik, { grup: s.grupBaslik, adet: 0, tutar: 0, usdKarsiligi: 0 });
    const o = m.get(s.grupBaslik)!; o.adet++; o.tutar += s.tutar; o.usdKarsiligi += s.usdKarsiligi; }
  const genel = [...m.values()].reduce((a, o) => a + o.tutar, 0);
  return [...m.values()].map(o => ({ ...o, pay: genel ? (o.tutar / genel) * 100 : 0 }));
}

/**
 * Ortak sorgu: tarih aralığı + fiş tipi + vezne (+ ek koşul). Satır = fiş satırı (eski MASAK raporlarının alt listeleri gibi: miktar, para, kur, satır tutarı).
 * `tutar` satır tutarı (TL), `fisTutar` fişin TL toplamı; USD karşılığı = satır tutarı ÷ fişin USD kuru, USD satırında miktarın kendisi (`FIS_USD_KURU_SQL`).
 */
async function masakSatirlari(pool: sql.ConnectionPool, p: RaporParametreler, ek: (req: sql.Request) => string = () => ""): Promise<MasakSatiri[]> {
  if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
  const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
  const f = filtreler(req, p, { vezne: "V" }) + ek(req);
  // Şüpheli işlem bildirim formu (eski VODVZR_FIS_MASAK_SUPELI_ISLEMLER.BILDIRIM_FORMU_VAR); tablo bu veritabanında yoksa 0
  const var_ = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_MASAK_ISLEM_BILDIRIMI','U') IS NULL THEN 0 ELSE 1 END bildirim, CASE WHEN OBJECT_ID('dbo.TODVZ_ULKE','U') IS NULL THEN 0 ELSE 1 END ulke`)).recordset[0] || {};
  const bildirimSql = var_.bildirim ? "CASE WHEN EXISTS (SELECT 1 FROM dbo.TODVZ_MASAK_ISLEM_BILDIRIMI B WHERE B.FIS_ID=F.FIS_ID) THEN 1 ELSE 0 END" : "0";
  const res = await req.query(`
    SELECT F.FIS_ID fisId, S.SATIR_NO satirNo, ISNULL(F.ZAMAN,F.TARIH) zaman, CONVERT(varchar(10), F.TARIH, 120) gun, RTRIM(ISNULL(F.SERI_NO,''))+RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.SERI_NO,'')) seriNo,
      RTRIM(ISNULL(F.UNVAN,'')) unvan, COALESCE(NULLIF(RTRIM(F.VERGI_KIMLIK_NO),''), NULLIF(RTRIM(F.PASAPORT_NO),''), '') kimlikNo, F.TIP tipKod,
      ISNULL(F.TOPLAM_TUTAR,0) fisTutar, ISNULL(S.TUTAR,0) tutar, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, RTRIM(ISNULL(P.KOD,'')) paraKod, ${FIS_USD_KURU_SQL} usdKuru,
      RTRIM(ISNULL(F.PASAPORT_NO,'')) pasaportNo, RTRIM(ISNULL(F.BABA_ADI,'')) babaAdi, RTRIM(ISNULL(F.ANNE_ADI,'')) anneAdi, RTRIM(ISNULL(F.KIMLIK_SERI_NO,'')) kimlikSeriNo,
      RTRIM(ISNULL(F.ADRES,'')) adres, ${bildirimSql} bildirimFormu, RTRIM(ISNULL(VD.AD,'')) vergiDairesi, ${var_.ulke ? "RTRIM(ISNULL(UY.AD,''))" : "''"} uyruk,
      ISNULL(F.MESLEK_ID,0) meslekId, RTRIM(ISNULL(M.AD,'')) meslek, RTRIM(ISNULL(SK.AD,'')) sektor, F.DOGUM_TARIHI dogumTarihi,
      ISNULL(F.MASAK_LISTESINDE_VAR,0) masakListesinde, RTRIM(ISNULL(SY.AD,'')) supheliYetkili, RTRIM(ISNULL(U.AD,'')) kaydeden, RTRIM(ISNULL(V.KOD,'')) vezneKod,
      ISNULL(STUFF((SELECT DISTINCT ', '+RTRIM(P2.KOD) FROM dbo.TODVZ_FIS_SATIRI S2 JOIN dbo.TODVZ_PARA P2 ON P2.PARA_ID=S2.PARA_ID WHERE S2.FIS_ID=F.FIS_ID FOR XML PATH('')),1,2,''),'') paralar
    FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
      LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=F.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI M ON M.TABLO_MADDESI_ID=F.MESLEK_ID LEFT JOIN dbo.TODVZ_TABLO_MADDESI SK ON SK.TABLO_MADDESI_ID=C.SEKTOR_ID
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI VD ON VD.TABLO_MADDESI_ID=F.VERGI_DAIRESI_ID AND VD.TUR=0 ${var_.ulke ? "LEFT JOIN dbo.TODVZ_ULKE UY ON UY.ULKE_ID=F.UYRUK_ID" : ""}
      LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID LEFT JOIN dbo.TODVZ_KULLANICI SY ON SY.KULLANICI_ID=F.SUPHELI_ISLEMLER_YETKILI_ID
    WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
    ORDER BY ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
  return res.recordset.map((r: any) => { const tutar = Number(r.tutar) || 0, miktar = Number(r.miktar) || 0, usdKuru = Number(r.usdKuru) || 0;
    return { ...r, tip: Number(r.tipKod) === 1 ? "Satış" : "Alış", tutar, fisTutar: Number(r.fisTutar) || 0, miktar, kur: Number(r.kur) || 0,
      usdKarsiligi: String(r.paraKod).toUpperCase() === "USD" ? miktar : usdKuru > 0 ? tutar / usdKuru : 0,
      meslekId: Number(r.meslekId) || 0, masakListesinde: !!r.masakListesinde, masakListesindeMetin: r.masakListesinde ? "EVET" : "", bildirimFormuMetin: r.bildirimFormu ? "VAR" : "" }; });
}
/** Satırlardan fiş listesi: tutar = fişin TL toplamı, USD karşılığı = satır karşılıklarının toplamı (kural ve eşik değerlendirmeleri fiş bazındadır). */
function fislereIndir(satirlar: MasakSatiri[]): MasakFisi[] {
  const m = new Map<number, MasakFisi>();
  for (const s of satirlar) { if (!m.has(s.fisId)) m.set(s.fisId, { ...s, tutar: s.fisTutar, usdKarsiligi: 0 }); m.get(s.fisId)!.usdKarsiligi += s.usdKarsiligi; }
  return [...m.values()];
}
/** Müşteri anahtarı: kimlik no (yoksa ünvan); ikisi de yoksa fiş tek başına müşteri sayılır. */
const musteriAnahtari = (s: { kimlikNo: string; unvan: string; fisId: number }) => s.kimlikNo || (s.unvan ? `~${s.unvan}` : `#${s.fisId}`);
/**
 * Eski meslek / sektör / yaş / yüksek tutar raporlarının yapısı: müşteri özet satırı (işlem sayısı + tutar) ve altında fiş satırları + müşteri TOPLAM'ı.
 * Tek seviyeli grup = müşteri; grup başlığı özet satırının karşılığıdır, grup alt toplamı müşteri TOPLAM'ıdır. `ustGrup` (meslek, sektör …) başlığın başına yazılır ve sıralamayı belirler.
 * `sec` müşteri düzeyinde süzer (işlem sayısı / tutar alt limiti, yaş sınırı, eşik). Saf fonksiyon.
 */
export function musteriGruplari<T extends MasakSatiri>(satirlar: T[], ustGrup: (s: T) => string, sec: (m: { islemSayisi: number; tutar: number; ilk: T }) => boolean = () => true, ekBaslik: (ilk: T) => string = () => "") {
  const m = new Map<string, { ust: string; ilk: T; fisler: Map<number, number>; usd: number; satirlar: T[] }>();
  for (const s of satirlar) { const ust = ustGrup(s), k = `${ust}|${musteriAnahtari(s)}`;
    if (!m.has(k)) m.set(k, { ust, ilk: s, fisler: new Map(), usd: 0, satirlar: [] });
    const o = m.get(k)!; o.fisler.set(s.fisId, s.fisTutar); o.usd += s.usdKarsiligi; o.satirlar.push(s); }
  const musteriler = [...m.entries()].map(([k, o]) => ({ k, ...o, islemSayisi: o.fisler.size, tutar: [...o.fisler.values()].reduce((a, b) => a + b, 0) }))
    .filter(o => sec({ islemSayisi: o.islemSayisi, tutar: o.tutar, ilk: o.ilk }))
    .sort((a, b) => a.ust.localeCompare(b.ust, "tr") || (a.ilk.unvan || "").localeCompare(b.ilk.unvan || "", "tr"));
  const cikti = musteriler.flatMap(o => o.satirlar.map(s => ({ ...s, ustGrup: o.ust, grupAnahtar: o.k, musteriIslemSayisi: o.islemSayisi, musteriTutar: o.tutar,
    grupBaslik: `${o.ust ? o.ust + " · " : ""}${o.ilk.unvan || "Ünvan yok"}${o.ilk.kimlikNo ? ` (${o.ilk.kimlikNo})` : ""}${ekBaslik(o.ilk)} — İşlem sayısı: ${o.islemSayisi} · Tutar: ${tl(o.tutar)} TL` })));
  // Üst grup özeti (meslek / sektör / yaş): müşteri sayısı, işlem (fiş) sayısı, tutar, USD karşılığı, pay %
  const oz = new Map<string, { grup: string; musteri: number; adet: number; tutar: number; usdKarsiligi: number }>();
  for (const o of musteriler) { const g = oz.get(o.ust) || { grup: o.ust || "Tümü", musteri: 0, adet: 0, tutar: 0, usdKarsiligi: 0 }; g.musteri++; g.adet += o.islemSayisi; g.tutar += o.tutar; g.usdKarsiligi += o.usd; oz.set(o.ust, g); }
  const genel = [...oz.values()].reduce((a, g) => a + g.tutar, 0);
  const ozet = [...oz.values()].map(g => ({ ...g, pay: genel ? (g.tutar / genel) * 100 : 0 }));
  if (ozet.length > 1) ozet.push({ grup: "GENEL TOPLAM", musteri: musteriler.length, adet: ozet.reduce((a, g) => a + g.adet, 0), tutar: genel, usdKarsiligi: ozet.reduce((a, g) => a + g.usdKarsiligi, 0), pay: genel ? 100 : 0 });
  return { satirlar: cikti, ozet };
}
/** İşlem sayısı / tutar alt limiti (eski @Gecerli formülü): girilen limitlerin hepsi sağlanmalı; girilmeyen limit uygulanmaz. */
const limitler = (p: RaporParametreler) => (m: { islemSayisi: number; tutar: number }) => (!(p.adet! > 0) || m.islemSayisi >= p.adet!) && (!(p.esik! > 0) || m.tutar >= p.esik!);
const limitOzeti = (p: RaporParametreler) => `${p.adet! > 0 ? ` · İşlem sayısı alt limiti: ${Math.round(p.adet!)}` : ""}${p.esik! > 0 ? ` · Tutar alt limiti: ${tl(p.esik!)} TL` : ""}`;
const MUSTERI_DIPNOT = "Her grup bir müşteridir (kimlik numarasına, yoksa ünvana göre); grup başlığındaki işlem sayısı ve tutar müşterinin dönemdeki fiş adedi ve fişlerinin TL toplamıdır. Satırlar fiş satırlarıdır; grup alt toplamı müşterinin satır tutarları toplamıdır. USD karşılığı = satır tutarı ÷ fişin USD kuru (USD satırında miktarın kendisi). İptal fişler hariçtir.";

/** Varsayılan yüksek tutar eşiği: firma tanımındaki TL vergi sınırı (yoksa 0 → kullanıcı girmeli) */
async function varsayilanEsik(pool: sql.ConnectionPool): Promise<number> {
  try { return Number((await pool.request().query(`SELECT TOP 1 ISNULL(TL_VERGI_SINIRI,0) e FROM dbo.TODVZ_TANIM`)).recordset[0]?.e) || 0; } catch { return 0; }
}
const tipOzeti = (p: RaporParametreler) => (p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : "");
const tl = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
/** Gruplu rapor: gruba göre (sıra, ad) dizer, grup içinde zaman sırası korunur */
const grupla = <T extends MasakFisi>(fisler: T[], grupAdi: (f: T) => string, grupSirasi: (f: T) => number | string = grupAdi) =>
  fisler.map(f => ({ ...f, grupBaslik: grupAdi(f), _s: grupSirasi(f) })).sort((a, b) => (typeof a._s === "number" && typeof b._s === "number" ? a._s - b._s : String(a._s).localeCompare(String(b._s), "tr")));

/** KNSK özeti: toplam / başarılı / başarısız / kara listede çıkan sorgu sayıları (eski rapordaki alt kutuların karşılığı). Saf fonksiyon. */
export function knskOzeti(satirlar: { basarili: boolean; karaListede: boolean }[]) {
  const say = (f: (s: { basarili: boolean; karaListede: boolean }) => boolean) => satirlar.filter(f).length;
  return [{ olcu: "Toplam sorgu", adet: satirlar.length }, { olcu: "Başarılı sorgu", adet: say(s => s.basarili) },
    { olcu: "Başarısız sorgu", adet: say(s => !s.basarili) }, { olcu: "Kara listede çıkan", adet: say(s => s.karaListede) }];
}

/** SORGULANAN_KISILIK_TURU kodları — eski rapordaki @CariTipi formülüyle birebir; tanımsız kod boş basılır. */
const KNSK_CARI_TIPI: Record<number, string> = { 0: "Şahıs", 1: "Şahıs firması", 2: "Tüzel kişi", 3: "Yetkili Müessese", 4: "Banka" };
/** 19.09.2026 öncesi bizim sorgu ekranı tüzel kişiyi 2 yerine 1 koduyla logladı; o kayıtlar ekranın sabit açıklama ifadelerinden tanınır ve "Tüzel kişi" basılır. */
const BIZIM_ESKI_KNSK_LOGU = /Eşleşme yok|olası eşleşme|MASAK liste ekranı araması|tamamlanamadı/;

export const MASAK_SORGULARI: Record<string, Sorgu> = {

  /**
   * KNSK sorgulama log listesi — müşterinin ad + doğum tarihi + kişilik türüyle yapılan kara liste sorgularının logu.
   * Kaynak: TODVZ_LOG_KNSK_SORGULAMA (canlıda doğrulandı 17.09.2026; kolonlar: ZAMAN, KULLANICI_ID, SORGULANAN_ADI, SORGULANAN_DOGUM_TARIHI,
   * SORGULANAN_KISILIK_TURU, SORGULAMA_BASARILI, KARA_LISTEDE, KARA_LISTE_ADI, ACIKLAMA). Eski rapor görünümü VODVZR_KNSK_SORGULAMA_LOG_LISTESI
   * aynı tabloya kullanıcı adı ve kullanıcının veznesini ekler; burada da öyle. Tablo yoksa boş rapor döner.
   */
  async KNSKLOG1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const durumAd: Record<string, string> = { basarili: "Başarılı sorgular", basarisiz: "Başarısız sorgular", karaliste: "Kara listede çıkanlar" };
    const ozet = `${aralikOzeti(p)}${ozetEk(p)}${adetOzeti(p.kullaniciIdler, "personel")}${durumAd[p.durum || ""] ? ` · ${durumAd[p.durum!]}` : ""}${p.arama?.trim() ? ` · Arama: "${p.arama.trim()}"` : ""}`;
    const var_ = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_LOG_KNSK_SORGULAMA','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
    if (!var_) return sinirla([], t, ozet, "Bu veritabanında KNSK sorgulama log tablosu (TODVZ_LOG_KNSK_SORGULAMA) bulunmuyor.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("arama", sql.NVarChar(100), p.arama?.trim() ? `%${p.arama.trim()}%` : null);
    const f = filtreler(req, p, { vezne: "V" }) + idFiltre(req, p.kullaniciIdler, "L.KULLANICI_ID", "ku")
      + (p.durum === "basarili" ? " AND ISNULL(L.SORGULAMA_BASARILI,0)=1" : p.durum === "basarisiz" ? " AND ISNULL(L.SORGULAMA_BASARILI,0)=0" : p.durum === "karaliste" ? " AND ISNULL(L.KARA_LISTEDE,0)=1" : "");
    const res = await req.query(`
      SELECT L.ZAMAN zaman, RTRIM(ISNULL(U.AD,'')) kullanici, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(L.SORGULANAN_ADI,'')) sorgulananAd, L.SORGULANAN_DOGUM_TARIHI dogumTarihi,
        L.SORGULANAN_KISILIK_TURU kisilikKod, ISNULL(L.SORGULAMA_BASARILI,0) basarili, ISNULL(L.KARA_LISTEDE,0) karaListede, RTRIM(ISNULL(L.KARA_LISTE_ADI,'')) karaListeAdi, RTRIM(ISNULL(L.ACIKLAMA,'')) aciklama
      FROM dbo.TODVZ_LOG_KNSK_SORGULAMA L LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=L.KULLANICI_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=U.VEZNE_ID
      WHERE CAST(L.ZAMAN AS date) BETWEEN @bas AND @bit AND (@arama IS NULL OR L.SORGULANAN_ADI LIKE @arama OR L.KARA_LISTE_ADI LIKE @arama) ${f}
      ORDER BY L.ZAMAN;`);
    const satirlar = res.recordset.map((r: any) => ({ ...r, basarili: !!r.basarili, karaListede: !!r.karaListede, kisilik: Number(r.kisilikKod) === 1 && BIZIM_ESKI_KNSK_LOGU.test(r.aciklama) ? KNSK_CARI_TIPI[2] : KNSK_CARI_TIPI[Number(r.kisilikKod)] ?? "",
      sonuc: r.basarili ? "Başarılı" : "BAŞARISIZ", karaListe: r.karaListede ? "EVET" : "" }));
    return sinirla(satirlar, t, ozet, undefined, knskOzeti(satirlar));
  },

  /** Meslek bazında işlem listesi — meslek · müşteri grubu (işlem sayısı + tutar), altında fiş satırları; işlem sayısı / tutar alt limiti (eski rapordaki gibi) */
  async MSKMES1(pool, p, t) {
    const s = await masakSatirlari(pool, p, req => idFiltre(req, p.meslekIdler, "F.MESLEK_ID", "ms"));
    const g = musteriGruplari(s, x => x.meslek || "Meslek belirtilmemiş", limitler(p));
    return sinirla(g.satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}${adetOzeti(p.meslekIdler, "meslek")}${limitOzeti(p)}`, MUSTERI_DIPNOT, g.ozet);
  },

  /** Sektör bazında işlem listesi — sektör cari kartından; yapı meslek raporuyla aynı */
  async MSKSEK1(pool, p, t) {
    const s = await masakSatirlari(pool, p, req => idFiltre(req, p.sektorIdler, "C.SEKTOR_ID", "sk"));
    const g = musteriGruplari(s, x => x.sektor || "Sektör yok (carisiz fiş veya sektörü girilmemiş cari)", limitler(p));
    return sinirla(g.satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}${adetOzeti(p.sektorIdler, "sektör")}${limitOzeti(p)}`, MUSTERI_DIPNOT, g.ozet);
  },

  /**
   * Yaş bazında işlem listesi — yaş işlem tarihine göre; müşteri grubu başlığında doğum tarihi, yaş ve meslek. Eski rapordaki "Yaşından küçük / Yaşından büyük" sınırları
   * (eski @Gecerli: yaş ≤ küçük sınır VEYA yaş ≥ büyük sınır) ve işlem sayısı / tutar alt limitleri; sınır girilmezse tüm müşteriler yaş aralığına göre listelenir.
   */
  async MSKYAS1(pool, p, t) {
    const s = (await masakSatirlari(pool, p)).map(x => { const y = yasAraligi(x.dogumTarihi, x.zaman); return { ...x, yas: y.yas, yasAraligi: y.aralik, yasSira: y.sira }; });
    const kucuk = p.yasKucuk! > 0 ? p.yasKucuk! : 0, buyuk = p.yasBuyuk! > 0 ? p.yasBuyuk! : 0, lim = limitler(p);
    const yasUygun = (yas: number | null) => (!kucuk && !buyuk) || (yas !== null && ((kucuk > 0 && yas <= kucuk) || (buyuk > 0 && yas >= buyuk)));
    const g = musteriGruplari(s, x => `${String(x.yasSira).padStart(2, "0")}|${x.yasSira === 99 ? x.yasAraligi : `${x.yasAraligi} yaş`}`, m => lim(m) && yasUygun((m.ilk as any).yas),
      ilk => ` · Doğum: ${ilk.dogumTarihi ? tarihTr(new Date(ilk.dogumTarihi).toISOString().slice(0, 10)) : "-"} · Yaş: ${(ilk as any).yas ?? "-"} · Meslek: ${ilk.meslek || "-"}`);
    const temiz = (x: string) => x.replace(/^\d\d\|/, "");
    return sinirla(g.satirlar.map(x => ({ ...x, grupBaslik: temiz(x.grupBaslik), ustGrup: temiz(x.ustGrup) })), t,
      `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)}${kucuk ? ` · ${kucuk} yaşından küçük` : ""}${buyuk ? ` · ${buyuk} yaşından büyük` : ""}${limitOzeti(p)}`, MUSTERI_DIPNOT, g.ozet.map(o => ({ ...o, grup: temiz(o.grup) })));
  },

  /**
   * Yüksek tutarda işlem listesi — eşik değerlendirmesi: "donem" (varsayılan, eski rapordaki gibi müşterinin dönem toplamı ≥ eşik), "gunluk" (aynı kimliğin günlük toplamı)
   * veya "fis" (tek fiş). Müşteri grubu başlığında yaş, sektör ve meslek; altında fiş satırları.
   */
  async MSKYUK1(pool, p, t) {
    const esik = p.esik ?? await varsayilanEsik(pool);
    if (!(esik > 0)) throw ApiError.badRequest("Eşik tutarı girilmelidir (firma tanımında TL vergi sınırı tanımlı değil).");
    const tum = (await masakSatirlari(pool, p)).map(x => ({ ...x, yas: yasAraligi(x.dogumTarihi, x.zaman).yas }));
    const kip = p.birlestir === "gunluk" ? "gunluk" : p.birlestir === "fis" ? "fis" : "donem";
    let secili = tum;
    if (kip !== "donem") { // fiş ya da kimlik × gün toplamı eşiği aşan fişlerin satırları
      const fisler = fislereIndir(tum), gecen = new Set<number>();
      if (kip === "fis") fisler.filter(f => f.tutar >= esik).forEach(f => gecen.add(f.fisId));
      else { const m = new Map<string, MasakFisi[]>(); for (const f of fisler) { const k = f.kimlikNo ? `${f.kimlikNo}|${f.gun}` : `#${f.fisId}`; m.set(k, [...(m.get(k) || []), f]); }
        for (const gr of m.values()) if (gr.reduce((a, f) => a + f.tutar, 0) >= esik) gr.forEach(f => gecen.add(f.fisId)); }
      secili = tum.filter(x => gecen.has(x.fisId));
    }
    const g = musteriGruplari(secili, () => "", m => kip !== "donem" || m.tutar >= esik, ilk => ` · Yaş: ${(ilk as any).yas ?? "-"} · Sektör: ${ilk.sektor || "-"} · Meslek: ${ilk.meslek || "-"}`);
    const kipAdi = { donem: "müşterinin dönem toplamı", gunluk: "aynı kimliğin günlük toplamı", fis: "fiş bazında" }[kip];
    return sinirla(g.satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)} · Tutar alt limiti ${tl(esik)} TL · ${kipAdi}`, MUSTERI_DIPNOT, g.ozet);
  },

  /** Şüpheli işlem listesi — şüpheli işlemler yetkilisince işaretlenmiş fişlerin satırları (eski rapordaki gibi satır bazında miktar + para, uyruk) */
  async MSKSUP1(pool, p, t) {
    const s = await masakSatirlari(pool, p, () => " AND F.SUPHELI_ISLEMLER_YETKILI_ID IS NOT NULL");
    const gorulen = new Set<number>();
    const satirlar = s.map(x => { const ilk = !gorulen.has(x.fisId); gorulen.add(x.fisId); return { ...x, fisTutar: ilk ? x.fisTutar : 0 }; });
    return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)} · ${gorulen.size} fiş, ${satirlar.length} satır`,
      "Her satır bir fiş satırıdır; fiş toplamı fişin ilk satırında gösterilir. USD karşılığı = satır tutarı ÷ fişin USD kuru (USD satırında miktarın kendisi). İptal fişler hariçtir.");
  },

  /**
   * Şüpheli işlemler fiş kontrol listesi. Kapsam (`durum`): "kural" (varsayılan) otomatik kontrol kurallarına takılan fişler; "sinirUstu" eski rapordaki
   * "TL vergi sınırını dikkate al" (satır tutarı > TL vergi sınırı); "tumu" tarih aralığındaki tüm fiş satırları (eski raporda kutu işaretsizken). Satır = fiş satırı.
   */
  async MSKKON1(pool, p, t) {
    const esik = p.esik ?? await varsayilanEsik(pool), n = Math.max(2, Math.round(p.adet ?? 2));
    const s = await masakSatirlari(pool, p);
    const neden = masakKontrol(fislereIndir(s), esik, n);
    const kapsam = p.durum === "tumu" ? "tumu" : p.durum === "sinirUstu" ? "sinirUstu" : "kural";
    const satirlar = s.filter(x => kapsam === "tumu" || (kapsam === "sinirUstu" ? esik > 0 && x.tutar > esik : neden.has(x.fisId)))
      .map(x => ({ ...x, neden: (neden.get(x.fisId) || []).join("; "), isaretli: x.supheliYetkili ? "EVET" : "" }));
    const kapsamAdi = { kural: `Kontrol kuralları · Parça sayısı ≥ ${n}`, sinirUstu: "Satır tutarı TL vergi sınırının üstünde", tumu: "Tüm fiş satırları" }[kapsam];
    return sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p)} · Eşik ${esik > 0 ? tl(esik) + " TL" : "yok"} · ${kapsamAdi}`,
      esik > 0 ? undefined : "Eşik tutarı girilmediği ve firma tanımında TL vergi sınırı olmadığı için yalnızca MASAK listesi eşleşmeleri kontrol edildi.");
  },
};

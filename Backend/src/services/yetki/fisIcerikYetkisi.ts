import { Request } from "express";
import { getDbPool } from "../../config/mssql.config.js";
import { ApiError } from "../../utils/ApiError.js";
import { HizliSatisSqlRepository } from "../../models/hizliSatisSql.repository.js";
import { logger } from "../../utils/logger.js";
import { KullaniciYetkisi, KurSatiri, caprazKurDenetle, dovizGiseKuru, kurDenetle, milyemDenetle, sarrafGiseKuru } from "./kullaniciYetkiKural.js";

/**
 * Fiş içeriğinde kullanıcı yetkileri (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2): banka hesabı seçme, komisyon alma,
 * Ticari'de fiyat değiştirme, Döviz/Sarraf'ta kur yetkisi ve gişe kuru aralığı. Sistem yöneticisinde kısıt yok.
 */

/** Ekranın yüklediği kur ile kayıt anındaki kur arasındaki canlı güncelleme farkı için pay (yüzde) */
const SUNUCU_KUR_PAYI = 0.5;

const baglam = (req: Request) => ({ dbServer: req.user?.dbServer, dbName: req.user?.dbName });
const sayi = (v: unknown): number => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Ödeme satırlarında banka hesabı (odemeAraciTuru 3) ya da fişte banka hesabı varsa "Fiş banka hesabı seçme" yetkisi */
export function bankaHesabiDenetle(y: KullaniciYetkisi, odemeler: unknown, ...hesaplar: unknown[]): void {
  if (y.yonetici || y.bankaHesabiSecme) return;
  const banka = (Array.isArray(odemeler) ? odemeler : []).some((o: any) => Number(o?.odemeAraciTuru) === 3);
  if (banka || hesaplar.some((h) => Number(h) > 0)) {
    throw ApiError.forbidden('Fişte banka hesabı seçmek için "Fiş banka hesabı seçme" yetkisi gerekir.');
  }
}

/** Döviz fişi satırlarında komisyon: yetkisizde komisyon alınmaz (K7) */
export function komisyonDenetle(y: KullaniciYetkisi, satirlar: unknown): void {
  if (y.yonetici || y.komisyonAlma) return;
  const var_ = (Array.isArray(satirlar) ? satirlar : []).some((s: any) => Math.abs(sayi(s?.komisyon)) > 0.004 || Math.abs(sayi(s?.komisyonOrani)) > 1e-9);
  if (var_) throw ApiError.forbidden('Komisyon almak için "Komisyon alma yetkisi" gerekir; yetkisiz kullanıcının fişinde komisyon alınmaz.');
}

/** Güncel kur satırları: Anlık Fiyat Listesi (TUR 0), boş alanlar Günlük (TUR 1) listeden — ön yüzdeki gibi */
export async function guncelKurlar(req: Request): Promise<KurSatiri[]> {
  const { dbServer, dbName } = baglam(req);
  const pool = await getDbPool(dbServer, dbName);
  const r = await pool.request().query(`
    IF OBJECT_ID('dbo.TODVZ_KUR_TABLOSU') IS NULL OR OBJECT_ID('dbo.TODVZ_KUR') IS NULL
      SELECT TOP 0 0 AS PARA_ID
    ELSE
      SELECT P.PARA_ID, RTRIM(P.KOD) AS KOD, P.AD, P.URUN_TIPI, T.TUR, K.EFEKTIF_ALIS, K.EFEKTIF_SATIS, K.DOVIZ_ALIS, K.DOVIZ_SATIS
      FROM dbo.TODVZ_PARA P
      CROSS JOIN (SELECT TUR, MAX(KUR_TABLOSU_ID) AS ID FROM dbo.TODVZ_KUR_TABLOSU WHERE TUR IN (0, 1) GROUP BY TUR) T
      LEFT JOIN dbo.TODVZ_KUR K ON K.PARA_ID = P.PARA_ID AND K.KUR_TABLOSU_ID = T.ID`);
  const harita = new Map<number, KurSatiri>();
  const alanlar = [["efektifAlis", "EFEKTIF_ALIS"], ["efektifSatis", "EFEKTIF_SATIS"], ["dovizAlis", "DOVIZ_ALIS"], ["dovizSatis", "DOVIZ_SATIS"]] as const;
  // Önce günlük (TUR 1), sonra anlık (TUR 0) yazılır: anlıkta olan değer önceliklidir
  const satirlar = [...(r.recordset as any[])].sort((a, b) => Number(b.TUR) - Number(a.TUR));
  for (const s of satirlar) {
    const k = harita.get(s.PARA_ID) ?? { paraId: s.PARA_ID, kod: s.KOD, ad: s.AD, urunTipi: s.URUN_TIPI };
    for (const [alan, kolon] of alanlar) if (sayi(s[kolon]) > 0) (k as any)[alan] = sayi(s[kolon]);
    harita.set(s.PARA_ID, k);
  }
  return [...harita.values()];
}

// ───────────── Kur sınıra çekilince tutarın yeniden hesabı (ortak alan denetimi 19.11.2026, #6) ─────────────
// Kullanıcı kararı (19.11.2026): "Sınıra çek, tutarı yeniden hesapla." Önceden yalnız s.kur değişiyor, satır tutarı ve fiş
// toplamları eski kurla kalıyordu (ekran 41,00 / sunucu 41,02 → 100 USD satırda kur 41,02, tutar 4.100).

const iki = (n: number): number => parseFloat(n.toFixed(2));
const dolu = (v: unknown): boolean => v !== undefined && v !== null && String(v).trim() !== "";
const kurYazi = (n: number): string => n.toLocaleString("tr-TR", { maximumFractionDigits: 4 });
const TL_KODLARI = ["TL", "TRY", "TRL"];
const tlMi = (kod: unknown): boolean => TL_KODLARI.includes(String(kod ?? "").trim().toUpperCase());

type DovizFarki = { tutar: number; komisyon: number; bmv: number; kmv: number };

/**
 * Kur yetkisi döviz satırının kurunu değiştirince satırın tutarı ve masrafları yeni kurla yeniden hesaplanır
 * (DovizFisiPage calculateRowValues ile aynı hesap; depo bu alanları istekten olduğu gibi yazar):
 *  - tutar = miktar × kur (2 hane); miktarı olmayan satırda tutar yeni kur / eski kur oranında ölçeklenir.
 *  - komisyon = tutar × komisyon oranı / 100 ve BSMV (bmv) = tutar × BMV oranı / 100 — yalnız oranı olan satırda; oransız
 *    elle yazılmış tutar aynen kalır.
 *  - KMV = tutar × KMV oranı (oran 1–10 arasıysa binde, değilse yüzde: ekrandaki effectiveKmvFactor). KMV'si 0 olan satır
 *    (firma ayarı "uygulanmasın") 0 kalır. Alış fişinde BMV / KMV'ye dokunulmaz (depo alışta ikisini de sıfırlar).
 * Dönen: satırın eski → yeni farkları (fiş toplamlarını aynı farkla güncellemek için).
 */
function dovizSatiriniYenidenHesapla(s: any, eskiKur: number, yeniKur: number, alis: boolean): DovizFarki {
  const miktar = sayi(s?.miktar);
  // Depo da boş tutarı miktar × kur sayar (dovizFisSql saveFis)
  const eskiTutar = sayi(s?.tutar) > 0 ? sayi(s.tutar) : miktar * eskiKur;
  const yeniTutar = miktar > 0 ? iki(miktar * yeniKur) : eskiKur > 0 ? iki((eskiTutar * yeniKur) / eskiKur) : eskiTutar;
  const fark: DovizFarki = { tutar: yeniTutar - eskiTutar, komisyon: 0, bmv: 0, kmv: 0 };
  s.tutar = yeniTutar;
  const oranla = (alan: "komisyon" | "bmv" | "kmv", carpan: number) => {
    const yeni = iki(yeniTutar * carpan);
    fark[alan] = yeni - sayi(s?.[alan]);
    s[alan] = yeni;
  };
  const komisyonOrani = sayi(s?.komisyonOrani);
  if (komisyonOrani > 0) oranla("komisyon", komisyonOrani / 100);
  if (!alis) {
    const bmvOrani = sayi(s?.bmvOrani);
    if (bmvOrani > 0) oranla("bmv", bmvOrani / 100);
    const kmvOrani = sayi(s?.kmvOrani);
    if (kmvOrani > 0 && sayi(s?.kmv) > 0) oranla("kmv", kmvOrani >= 1 && kmvOrani <= 10 ? kmvOrani / 1000 : kmvOrani / 100);
  }
  return fark;
}

/**
 * Fişin KMV uygulama şekli (DovizFisiPage getEffectiveKmvMode): istekte yoksa firma tanımı (TODVZ_TANIM, eski şemada kolon
 * olmayabilir), o da yoksa 3. 1 uygulanmasın, 2 kura dahil (masrafa eklenmez), 3 kurdan hariç (masrafa eklenir).
 */
async function kmvUygulamaSekli(req: Request, dto: any): Promise<number> {
  const istek = Number(dto?.kmvUygulamaSekli);
  if (istek === 1 || istek === 2 || istek === 3) return istek;
  try {
    const { dbServer, dbName } = baglam(req);
    const pool = await getDbPool(dbServer, dbName);
    const r = await pool.request().query(`
      IF COL_LENGTH('dbo.TODVZ_TANIM', 'KMV_UYGULAMA_SEKLI') IS NULL SELECT CAST(NULL AS INT) AS M
      ELSE EXEC('SELECT TOP 1 KMV_UYGULAMA_SEKLI AS M FROM dbo.TODVZ_TANIM')`);
    const m = Number(r.recordset?.[0]?.M);
    return m === 1 || m === 2 || m === 3 ? m : 3;
  } catch {
    return 3;
  }
}

/**
 * Döviz fişi satır kurları kur yetkisine göre geçerli mi; geçerliyse satırların gişe kuru kur tablosundan yazılır
 * (önceden girilen kur gişe kuru diye saklandığı için Kur Sapma raporu döviz fişlerinde fark göremiyordu).
 * Kur sınıra çekilen satırın tutar / komisyon / BSMV / KMV'si yeni kurla yeniden hesaplanır ve fiş toplamları (toplamTutar,
 * odemeTutari) aynı farkla güncellenir. Dönen: yapılan kur değişikliklerinin açıklaması (yanıtta kullanıcıya gösterilebilir;
 * şimdilik kayıt günlüğüne yazılır). (ortak alan denetimi 19.11.2026, #6)
 */
export async function dovizKurDenetle(req: Request, y: KullaniciYetkisi, dto: any): Promise<string[]> {
  const satirlar: any[] = Array.isArray(dto?.satirlar) ? dto.satirlar : [];
  if (!satirlar.length) return [];
  const kurlar = await guncelKurlar(req);
  const kurTuru = Number(dto?.kurTuru) || 0;
  const tip = Number(dto?.tip);
  const degisiklikler: string[] = [];
  const toplam: DovizFarki = { tutar: 0, komisyon: 0, bmv: 0, kmv: 0 };
  satirlar.forEach((s, i) => {
    const k = kurlar.find((x) => x.paraId === Number(s?.paraId));
    const gise = dovizGiseKuru(k, tip, kurTuru);
    if (!gise) return;
    s.giseKuru = gise.kur;
    const eskiKur = sayi(s?.kur);
    const d = kurDenetle(y, gise, eskiKur, `${i + 1}. satırın kuru`, SUNUCU_KUR_PAYI);
    if (d.hata) throw ApiError.forbidden(d.hata);
    if (!d.sinirKur || Math.abs(d.sinirKur - eskiKur) < 1e-9) return;
    s.kur = d.sinirKur;
    // TL satırının tutarı miktarın kendisidir (kur çarpılmaz); kura bağlı bir şey değişmez
    if (tlMi(s?.paraKodu || k?.kod)) return;
    const eskiTutar = sayi(s?.tutar);
    const f = dovizSatiriniYenidenHesapla(s, eskiKur, d.sinirKur, tip !== 1);
    (Object.keys(toplam) as (keyof DovizFarki)[]).forEach((a) => (toplam[a] += f[a]));
    degisiklikler.push(`${i + 1}. satır kuru ${kurYazi(eskiKur)} → ${kurYazi(d.sinirKur)}, tutar ${kurYazi(eskiTutar)} → ${kurYazi(sayi(s.tutar))}`);
  });

  if (degisiklikler.length) {
    // Fiş toplamları istemcinin gönderdiği değere satırlardaki fark eklenerek yeniden kurulur (DovizFisiPage: toplamTutar = Σ satır
    // tutarı; odemeTutari = satışta toplam + masraf, alışta toplam − masraf; masraf = komisyon + BSMV + yalnız "kurdan hariç"te
    // KMV). Ekranın toplamları satırlardan geldiği için bu, satırlardan baştan hesapla aynı sonucu verir; ayrıca odemeTutari'nin
    // banka dağıtımında (F10) yalnız vezne nakit kısmı olduğu fişte banka kısmı korunur, fark nakde yansır.
    const kmvFarki = tip === 1 && toplam.kmv !== 0 && (await kmvUygulamaSekli(req, dto)) === 3 ? toplam.kmv : 0;
    const masrafFarki = tip === 1 ? toplam.komisyon + toplam.bmv + kmvFarki : toplam.komisyon;
    const odemeFarki = tip === 1 ? toplam.tutar + masrafFarki : toplam.tutar - masrafFarki;
    if (dolu(dto.toplamTutar)) dto.toplamTutar = iki(sayi(dto.toplamTutar) + toplam.tutar);
    if (dolu(dto.odemeTutari)) dto.odemeTutari = iki(sayi(dto.odemeTutari) + odemeFarki);
    logger.info(`[KUR YETKİSİ] Döviz fişi ${dto?.fisId || "(yeni)"} kullanıcı ${req.user?.userId ?? "?"}: kur sınıra çekildi — ${degisiklikler.join("; ")}`);
  }
  return degisiklikler;
}

/**
 * Sarraf satırının / ödeme satırının kura bağlı tutarı yeni kurla ölçeklenir. Satır TUTAR'ı = kur × has (ya da miktar / adet)
 * + işçilik toplamıdır (SarrafFisiPage recomputeRow: tutar = tlTutar + iscilikToplam; işçilik ISCILIK_TUTARI / ISCILIK_KDV
 * kolonlarında ayrıca durur): istekteki TL işçilik (net işçilik + işçilik KDV'si) ayrılır, kalan kura bağlı kısım yeni kur /
 * eski kur oranında ölçeklenir, işçilik aynen geri eklenir; işçilik kolonlarına dokunulmaz. Hızlı Satış işçiliği has olarak
 * gönderir (TL işçilik yok, tutar = (has + işçilik has) × kur): orada tutarın tamamı kura bağlıdır. Ödeme satırında işçilik
 * yoktur. Tutarı boş satır değişmez (depo ödeme satırında boş tutarı miktar × kur sayar, ürün satırında boş yazar).
 */
function sarrafTutariniOlcekle(s: any, eskiKur: number, yeniKur: number): { eski: number; yeni: number } | null {
  const tutar = sayi(s?.tutar);
  if (!(tutar > 0) || !(eskiKur > 0)) return null;
  const iscilik = Math.max(0, sayi(s?.iscilikTutari)) + Math.max(0, sayi(s?.iscilikKdvTutari));
  const kuraBagli = tutar - iscilik;
  if (!(kuraBagli > 0)) return null;
  const yeni = iki((kuraBagli * yeniKur) / eskiKur + iscilik);
  s.tutar = yeni;
  return { eski: tutar, yeni };
}

/**
 * Sarraf fişi satır kurları kur yetkisine göre geçerli mi. Kur sınıra çekilen satırın ve ödeme satırının tutarı yeni kurla
 * yeniden hesaplanır (sarrafTutariniOlcekle). Sarraf isteğinde ayrı fiş toplamı alanı yoktur (fiş tutarı satır TUTAR toplamı;
 * KDV yalnız işçilikten ve başlık has kurundan hesaplanır, kur sınırı başlık kurunu değiştirmez): yeniden kurulacak toplam yok.
 * Ödeme satırları ürün satırlarına göre yeniden dağıtılmaz (hangi ödemenin değişeceği bilinemez); değişiklik kayıt günlüğüne
 * yazılır. Dönen: yapılan kur değişikliklerinin açıklaması. (ortak alan denetimi 19.11.2026, #6)
 */
export async function sarrafKurDenetle(req: Request, y: KullaniciYetkisi, dto: any): Promise<string[]> {
  // Var yetkisinde yalnız "Gişe kuru dışında olabilir" işaretsizken gişe aralığı denetlenir (#21)
  if (y.kurYetkisi === "Var" && (y.yonetici || y.giseKuruDisinda)) return [];
  const satirlar: any[] = Array.isArray(dto?.satirlar) ? dto.satirlar : [];
  const odemeSatirlari: any[] = Array.isArray(dto?.odemeSatirlari) ? dto.odemeSatirlari : [];
  if (!satirlar.length && !odemeSatirlari.length) return [];
  const kurlar = await guncelKurlar(req);
  const fiHasKuru = sayi(dto?.altinHasKuru);
  const fiGumusKuru = sayi(dto?.gumusHasKuru);
  const degisiklikler: string[] = [];
  const yaz = (ad: string, eskiKur: number, yeniKur: number, t: { eski: number; yeni: number } | null) =>
    degisiklikler.push(`${ad} kuru ${kurYazi(eskiKur)} → ${kurYazi(yeniKur)}${t ? `, tutar ${kurYazi(t.eski)} → ${kurYazi(t.yeni)}` : ""}`);

  satirlar.forEach((s, i) => {
    const urun = kurlar.find((x) => x.paraId === Number(s?.urunId));
    // Hızlı Satış iskontosu satır kurundan düşülür (H24): iskontosuz kur gönderildiyse ve kur ondan büyük değilse o denetlenir
    const eskiKur = sayi(s?.kur);
    const iskontosuz = sayi(s?.iskontosuzKur);
    const iskontolu = iskontosuz > 0 && eskiKur <= iskontosuz + 1e-9;
    const kur = iskontolu ? iskontosuz : eskiKur;
    const gise = sarrafGiseKuru(kurlar, urun, Number(dto?.tip), fiHasKuru, fiGumusKuru, kur);
    const d = kurDenetle(y, gise, kur, `${i + 1}. satırın kuru`, SUNUCU_KUR_PAYI);
    if (d.hata) throw ApiError.forbidden(d.hata);
    if (!d.sinirKur || Math.abs(d.sinirKur - kur) < 1e-9) return;
    // İskontolu satırda iskonto oranı korunur: iskontolu kur, iskontosuz kurla aynı oranda kayar (önceden iskonto siliniyordu)
    const yeniKur = iskontolu ? Number(((eskiKur * d.sinirKur) / iskontosuz).toFixed(4)) : d.sinirKur;
    if (iskontolu) s.iskontosuzKur = d.sinirKur;
    s.kur = yeniKur;
    yaz(`${i + 1}. satır`, eskiKur, yeniKur, sarrafTutariniOlcekle(s, eskiKur, yeniKur));
  });

  const tip = Number(dto?.tip) || 0;
  const odemeTip = tip === 0 ? 1 : 0;
  odemeSatirlari.forEach((o, i) => {
    const pk = (o?.paraKodu || "").trim().toUpperCase();
    if (pk === "TL" || pk === "TRY" || pk === "TRL" || o?.iskontoId || o?.odemeAraciTuru === 2) return;
    const urun = kurlar.find((x) => (o?.paraId && x.paraId === Number(o.paraId)) || (pk && String(x.kod || "").toUpperCase().trim() === pk));
    const kur = sayi(o?.kur);
    if (kur > 0) {
      const gise = sarrafGiseKuru(kurlar, urun, odemeTip, fiHasKuru, fiGumusKuru, kur);
      const d = kurDenetle(y, gise, kur, `Ödeme ${i + 1}. satırın kuru`, SUNUCU_KUR_PAYI);
      if (d.hata) throw ApiError.forbidden(d.hata);
      if (!d.sinirKur || Math.abs(d.sinirKur - kur) < 1e-9) return;
      o.kur = d.sinirKur;
      yaz(`Ödeme ${i + 1}. satır`, kur, d.sinirKur, sarrafTutariniOlcekle(o, kur, d.sinirKur));
    }
  });

  if (degisiklikler.length) {
    logger.info(`[KUR YETKİSİ] Sarraf fişi ${dto?.sarrafFisiId || "(yeni)"} kullanıcı ${req.user?.userId ?? "?"}: kur sınıra çekildi — ${degisiklikler.join("; ")}`);
  }
  return degisiklikler;
}

/** Sarraf fişi satır milyemleri milyem yetkisine göre geçerli mi */
export async function sarrafMilyemDenetle(req: Request, y: KullaniciYetkisi, dto: any): Promise<void> {
  if (y.milyemYetkisi === "Var") return;
  const satirlar: any[] = Array.isArray(dto?.satirlar) ? dto.satirlar : [];
  const odemeSatirlari: any[] = Array.isArray(dto?.odemeSatirlari) ? dto.odemeSatirlari : [];
  if (!satirlar.length && !odemeSatirlari.length) return;

  const { dbServer, dbName } = baglam(req);
  const pool = await getDbPool(dbServer, dbName);
  const r = await pool.request().query(`
    SELECT PARA_ID, RTRIM(KOD) AS KOD, AD, ISNULL(URUN_TIPI, 0) AS URUN_TIPI,
           ISNULL(HAS_ORANI, 0) AS HAS_ORANI,
           ISNULL(HAS_ALIS_KATSAYISI, 0) AS HAS_ALIS_KATSAYISI,
           ISNULL(HAS_SATIS_KATSAYISI, 0) AS HAS_SATIS_KATSAYISI
    FROM dbo.TODVZ_PARA WITH (NOLOCK)
  `);
  const urunler = new Map<number, any>((r.recordset || []).map((x: any) => [Number(x.PARA_ID), x]));

  const tip = Number(dto?.tip) || 0; // 0: Alış, 1: Satış
  const odemeTip = tip === 0 ? 1 : 0;

  // Kalemler
  satirlar.forEach((s, i) => {
    const urun = urunler.get(Number(s?.urunId));
    if (!urun) return;
    const urunTipi = Number(urun.URUN_TIPI);
    if (urunTipi === 3) return; // Ziynette milyem denetlenmez
    const refMilyem = tip === 0
      ? (Number(urun.HAS_ALIS_KATSAYISI) > 0 ? Number(urun.HAS_ALIS_KATSAYISI) : Number(urun.HAS_ORANI))
      : (Number(urun.HAS_SATIS_KATSAYISI) > 0 ? Number(urun.HAS_SATIS_KATSAYISI) : Number(urun.HAS_ORANI));
    if (!(refMilyem > 0)) return;
    const m = sayi(s?.milyem);
    if (!(m > 0)) return;
    const d = milyemDenetle(y, refMilyem, m, `${i + 1}. satırın milyemi`);
    if (d.hata) throw ApiError.forbidden(d.hata);
  });

  // Ödeme satırları
  odemeSatirlari.forEach((s, i) => {
    const urun = urunler.get(Number(s?.paraId));
    if (!urun) return;
    const urunTipi = Number(urun.URUN_TIPI);
    if (urunTipi === 3) return; // Ziynette milyem denetlenmez
    const refMilyem = odemeTip === 0
      ? (Number(urun.HAS_ALIS_KATSAYISI) > 0 ? Number(urun.HAS_ALIS_KATSAYISI) : Number(urun.HAS_ORANI))
      : (Number(urun.HAS_SATIS_KATSAYISI) > 0 ? Number(urun.HAS_SATIS_KATSAYISI) : Number(urun.HAS_ORANI));
    if (!(refMilyem > 0)) return;
    const m = sayi(s?.milyem);
    if (!(m > 0)) return;
    const d = milyemDenetle(y, refMilyem, m, `Ödeme ${i + 1}. satırın milyemi`);
    if (d.hata) throw ApiError.forbidden(d.hata);
  });
}

/**
 * Ticari satış: stok kartı fiyatından farklı fiyat "Fişte tutar değiştirme" yetkisi (ya da Hızlı Satış'ın kendi Fiyat/İndirim
 * yetkisi) ister. TL kartlarda; dövizli kart fiyatı kura bağlı olduğundan denetlenmez.
 */
export async function ticariFiyatDenetle(req: Request, y: KullaniciYetkisi, satirlar: unknown): Promise<void> {
  if (y.yonetici || y.tutarDegistirme) return;
  // Kimlik SQL'e metin olarak girer: yalnız INT aralığındaki tamsayı ("Infinity", 1e21 gibi değerler sorguyu bozuyordu)
  const kartKimligi = (v: unknown): number | null => {
    const n = Math.trunc(Number(v));
    return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : null;
  };
  const liste = (Array.isArray(satirlar) ? satirlar : []).filter((s: any) => kartKimligi(s?.stokKartId) !== null && s?.kdvDahilFiyat !== null && s?.kdvDahilFiyat !== undefined && String(s.kdvDahilFiyat).trim() !== "");
  if (!liste.length) return;
  const idler = [...new Set(liste.map((s: any) => kartKimligi(s.stokKartId)!))];
  const { dbServer, dbName } = baglam(req);
  const pool = await getDbPool(dbServer, dbName);
  const r = await pool.request().query(`
    SELECT K.STOK_KART_ID, K.SATIS_FIYATI, K.KDV_ORANI, K.FIYAT_KDV_DAHIL, RTRIM(P.KOD) AS PARA_KODU
    FROM dbo.TODVZ_STOK_KART K LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID = K.PARA_ID
    WHERE K.STOK_KART_ID IN (${idler.join(",")})`);
  const kartlar = new Map<number, any>(r.recordset.map((k: any) => [k.STOK_KART_ID, k]));
  for (const s of liste as any[]) {
    const k = kartlar.get(kartKimligi(s.stokKartId)!);
    if (!k) continue;
    const para = String(k.PARA_KODU || "TL").toUpperCase();
    if (!["", "TL", "TRY", "TRL"].includes(para)) continue;
    const f = sayi(k.SATIS_FIYATI);
    const dahil = k.FIYAT_KDV_DAHIL === true || k.FIYAT_KDV_DAHIL === 1 ? f : f * (1 + sayi(k.KDV_ORANI) / 100);
    if (Math.abs(Math.round(dahil * 100) / 100 - sayi(s.kdvDahilFiyat)) > 0.011) {
      const kullaniciId = Number(req.user?.userId);
      const hizliFiyat = await HizliSatisSqlRepository.fiyatYetkisi(kullaniciId > 0 ? kullaniciId : undefined, false, baglam(req)).catch(() => false);
      if (hizliFiyat) return;
      throw ApiError.forbidden('Stok kartı fiyatını değiştirmek için "Fişte tutar değiştirme yetkisi" gerekir.');
    }
  }
}

/** Emanet dekont çapraz kur kontrolü (firma toleransı Firma Tanımları › CARI_TL_TOLERANSI / CARI_USD_TOLERANSI) */
export async function caprazKurDenetleSunucu(req: Request, y: KullaniciYetkisi, dto: any): Promise<void> {
  if (y.yonetici || y.caprazKurKontroluYok) return;
  const { dbServer, dbName } = baglam(req);
  const pool = await getDbPool(dbServer, dbName);
  const t = await pool
    .request()
    .query(`SELECT TOP 1 CARI_TL_TOLERANSI, CARI_USD_TOLERANSI FROM dbo.TODVZ_TANIM`)
    .then((r) => r.recordset[0] || {})
    .catch(() => ({} as any));
  // kurCinsi 2: TL karşılığı (TL toleransı), diğerleri döviz bazlı (USD toleransı)
  const tolerans = Number(dto?.kurCinsi) === 2 ? sayi(t.CARI_TL_TOLERANSI) : sayi(t.CARI_USD_TOLERANSI);
  const hata = caprazKurDenetle(y, Array.isArray(dto?.satirlar) ? dto.satirlar : [], dto?.kurCinsi, tolerans);
  if (hata) throw ApiError.forbidden(hata);
}

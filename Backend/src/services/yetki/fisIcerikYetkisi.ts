import { Request } from "express";
import { getDbPool } from "../../config/mssql.config.js";
import { ApiError } from "../../utils/ApiError.js";
import { HizliSatisSqlRepository } from "../../models/hizliSatisSql.repository.js";
import { KullaniciYetkisi, KurSatiri, caprazKurDenetle, dovizGiseKuru, kurDenetle, sarrafGiseKuru } from "./kullaniciYetkiKural.js";

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

/**
 * Döviz fişi satır kurları kur yetkisine göre geçerli mi; geçerliyse satırların gişe kuru kur tablosundan yazılır
 * (önceden girilen kur gişe kuru diye saklandığı için Kur Sapma raporu döviz fişlerinde fark göremiyordu).
 */
export async function dovizKurDenetle(req: Request, y: KullaniciYetkisi, dto: any): Promise<void> {
  const satirlar: any[] = Array.isArray(dto?.satirlar) ? dto.satirlar : [];
  if (!satirlar.length) return;
  const kurlar = await guncelKurlar(req);
  const kurTuru = Number(dto?.kurTuru) || 0;
  satirlar.forEach((s, i) => {
    const k = kurlar.find((x) => x.paraId === Number(s?.paraId));
    const gise = dovizGiseKuru(k, Number(dto?.tip), kurTuru);
    if (!gise) return;
    s.giseKuru = gise.kur;
    const d = kurDenetle(y, gise, sayi(s?.kur), `${i + 1}. satırın kuru`, SUNUCU_KUR_PAYI);
    if (d.hata) throw ApiError.forbidden(d.hata);
  });
}

/** Sarraf fişi satır kurları kur yetkisine göre geçerli mi */
export async function sarrafKurDenetle(req: Request, y: KullaniciYetkisi, dto: any): Promise<void> {
  if (y.kurYetkisi === "Var") return;
  const satirlar: any[] = Array.isArray(dto?.satirlar) ? dto.satirlar : [];
  if (!satirlar.length) return;
  const kurlar = await guncelKurlar(req);
  satirlar.forEach((s, i) => {
    const urun = kurlar.find((x) => x.paraId === Number(s?.urunId));
    const gise = sarrafGiseKuru(kurlar, urun, Number(dto?.tip));
    // Hızlı Satış iskontosu satır kurundan düşülür (H24): iskontosuz kur gönderildiyse ve kur ondan büyük değilse o denetlenir
    const iskontosuz = sayi(s?.iskontosuzKur);
    const kur = iskontosuz > 0 && sayi(s?.kur) <= iskontosuz + 1e-9 ? iskontosuz : sayi(s?.kur);
    const d = kurDenetle(y, gise, kur, `${i + 1}. satırın kuru`, SUNUCU_KUR_PAYI);
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

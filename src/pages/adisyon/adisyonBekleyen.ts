/**
 * Gönderilmemiş sipariş (TA39): masa başına tarayıcıda saklanır; bağlantı koparsa kaybolmaz. Gönderimde istek kimliği önce
 * saklanır: cevap gelmezse (sonuç belirsiz) aynı kimlikle tekrar gönderilir, sunucu çift kalem yazmaz.
 */
export interface BekleyenKalem {
  anahtar: string;
  stokKartId: number;
  ad: string;
  miktar: number;
  birim: string;
  tartili: boolean;
  porsiyonId: number | null;
  porsiyonAd: string | null;
  secenekIdler: number[];
  secimMetni: string;
  notu: string;
  /** Önizleme fiyatı (KDV dahil); asıl fiyatı sunucu hesaplar */
  birimFiyat: number;
}
export interface BekleyenSepet {
  istekId: string | null;
  /** Gönderildi ama cevap gelmedi: liste kilitli, aynı kimlikle yeniden gönderilir */
  belirsiz: boolean;
  kalemler: BekleyenKalem[];
  /** İlk gönderim denemesinin zamanı (ms) ve o andaki adisyon: eski / başka adisyona ait belirsiz sepet kendiliğinden gönderilmez */
  zaman?: number | null;
  adisyonId?: number | null;
  /**
   * Yeni paket / gel-al (O12, 26.11.2026 denetimi): ilk gönderimin müşteri bilgisi sepetle saklanır. Belirsiz kalan yeni paket
   * yeniden gönderilirken o anki pencerenin müşterisi değil, ilk denemedeki müşteri kullanılır (aksi hâlde ilk istek ulaşmadıysa
   * sipariş başka müşteri adına açılırdı); ekranda kimin siparişi olduğu gösterilir.
   */
  paket?: { tur: 2 | 3; ad: string; tel: string | null; adres: string | null; not: string | null } | null;
}

/** Sonucu belirsiz sepet bu süreden eskiyse kendiliğinden yeniden gönderilmez; kullanıcıya sorulur (26.11.2026 denetimi) */
export const BELIRSIZ_OTOMATIK_MS = 3 * 60 * 1000;
/**
 * Belirsiz sepet kendiliğinden yeniden gönderilsin mi (saf; test edilir): yalnız taze (3 dk) ve aynı adisyon içinse.
 * Dün gönderimi belirsiz kalan sipariş, bugün aynı masada oturan başka müşterinin adisyonuna sessizce yazılmasın.
 */
export function belirsizOtomatikMi(s: BekleyenSepet, simdi: number, adisyonId: number | null): boolean {
  if (!s.belirsiz || !s.kalemler.length) return false;
  if (!s.zaman || simdi - s.zaman > BELIRSIZ_OTOMATIK_MS || simdi < s.zaman) return false;
  return (s.adisyonId ?? null) === (adisyonId ?? null);
}
/** Yeniden deneme beklemesi (ms): 5 sn'den başlayıp ikiye katlanır, en çok 60 sn (sunucu hata verirken 5 sn'de bir yüklenmesin) */
export const belirsizBeklemesi = (deneme: number): number => Math.min(60000, 5000 * 2 ** Math.max(0, Math.min(deneme, 6)));

const dbAdi = () => localStorage.getItem("kuyumcu_erp_last_db") || localStorage.getItem("kuyumcu_erp_active_db") || "";
const anahtar = (masaId: number, onEk = "pc") => `likya_adisyon_bekleyen_${onEk}_${dbAdi()}_${masaId}`;
const BOS: BekleyenSepet = { istekId: null, belirsiz: false, kalemler: [] };

export function bekleyenOku(masaId: number, onEk?: string): BekleyenSepet {
  try {
    const s = JSON.parse(localStorage.getItem(anahtar(masaId, onEk)) || "null");
    if (s && Array.isArray(s.kalemler)) return { istekId: typeof s.istekId === "string" ? s.istekId : null, belirsiz: !!s.belirsiz, kalemler: s.kalemler,
      zaman: Number(s.zaman) > 0 ? Number(s.zaman) : null, adisyonId: Number(s.adisyonId) > 0 ? Number(s.adisyonId) : null };
  } catch { /* bozuk kayıt */ }
  return { ...BOS, kalemler: [] };
}
export function bekleyenYaz(masaId: number, s: BekleyenSepet, onEk?: string) {
  if (!s.kalemler.length && !s.istekId) localStorage.removeItem(anahtar(masaId, onEk));
  else localStorage.setItem(anahtar(masaId, onEk), JSON.stringify(s));
}

export const yeniIstekId = (): string => {
  const c: any = typeof crypto !== "undefined" ? crypto : null;
  if (c?.randomUUID) return c.randomUUID();
  return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
};

/** Aynı ürün + porsiyon + seçenek + not tartısız satırda miktar artar; tartılı ürün her tartım ayrı satır */
export function bekleyeneEkle(liste: BekleyenKalem[], k: Omit<BekleyenKalem, "anahtar">): BekleyenKalem[] {
  const imza = (x: Omit<BekleyenKalem, "anahtar">) => `${x.stokKartId}|${x.porsiyonId ?? ""}|${[...x.secenekIdler].sort((a, b) => a - b).join(",")}|${x.notu.trim()}`;
  if (!k.tartili) {
    const i = liste.findIndex((x) => !x.tartili && imza(x) === imza(k));
    if (i >= 0) return liste.map((x, j) => (j === i ? { ...x, miktar: Math.min(999, x.miktar + k.miktar) } : x));
  }
  return [...liste, { ...k, anahtar: yeniIstekId() }];
}

/** Gönderim hatası kesin ret mi (sunucu cevap verdi, kayıt yok) yoksa sonuç belirsiz mi (ağ / zaman aşımı / 5xx) */
export const kesinRetMi = (e: any): boolean => [400, 401, 403, 404, 409, 422, 423].includes(Number(e?.status));

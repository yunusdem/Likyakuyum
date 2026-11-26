import { getEffectiveApiUrl } from "./apiClient";
import type { AdisyonAyrinti, AdisyonMenu, HesapDurumu, KalemSecimi, MasaDurumu, MusteriGirdi, OdemeGirdi, SiparisGirdi, TahsilatSonucu, UrunTasimaSonucu } from "./adisyonService";

/**
 * Garson adresi istemcisi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA23, D4). Personel oturumundan bağımsız: kendi jetonu,
 * veritabanı başlığı göndermez (sunucu veritabanını jetondan bulur). Giriş: müşteri no + kullanıcı adı + şifre (§11 G1–G4; PIN kalktı).
 */
const JETON = "likya_garson_jeton";

export interface GarsonBilgisi { garsonId: number; ad: string; seviye: number; yetkiler: string[]; kullaniciAdi?: string }
export interface GarsonGirisYaniti { token: string; garson: GarsonBilgisi; kisaAd: string }

export const garsonJeton = {
  oku: (): string | null => localStorage.getItem(JETON),
  yaz: (t: string) => localStorage.setItem(JETON, t),
  sil: () => localStorage.removeItem(JETON),
};
/** Eski sürümden kalan hatırlanan cihaz kaydı (PIN girişi kalktı): açılışta silinir */
export const eskiCihazKaydiniSil = () => { try { localStorage.removeItem("likya_garson_cihaz"); } catch { /* yok */ } };

/** Oturum düştü (401): sayfa giriş ekranına döner */
export const GARSON_OTURUM_DUSTU = "likya_garson_oturum_dustu";

async function istek<T>(yol: string, method = "GET", govde?: unknown, jetonlu = true): Promise<T> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (govde !== undefined) h["Content-Type"] = "application/json";
  const t = garsonJeton.oku();
  if (jetonlu && t) h.Authorization = `Bearer ${t}`;
  let r: Response;
  // Zaman aşımı: zayıf Wi-Fi'da istek dakikalarca asılı kalmasın (garson "gönderildi mi?" diye beklemesin; sipariş sepeti belirsiz
  // sayılır ve aynı kimlikle yeniden denenir). Tahsilat gibi uzun sürebilen işlemlere daha uzun süre.
  const ctrl = new AbortController();
  const sure = setTimeout(() => ctrl.abort(), /\/(kapat|odeme|urun-ode)$/.test(yol) ? 45000 : 20000);
  try {
    r = await fetch(`${getEffectiveApiUrl()}/garson${yol}`, { method, headers: h, body: govde === undefined ? undefined : JSON.stringify(govde), cache: "no-store", signal: ctrl.signal });
  } catch {
    throw new Error("Sunucuya ulaşılamadı. Bağlantınızı kontrol edin.");
  } finally {
    clearTimeout(sure);
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j?.message || `Hata ${r.status}`) as Error & { status?: number; kod?: string };
    e.status = r.status;
    e.kod = j?.errors?.kod;
    if (r.status === 401 && jetonlu) { garsonJeton.sil(); window.dispatchEvent(new CustomEvent(GARSON_OTURUM_DUSTU, { detail: { mesaj: e.message } })); }
    throw e;
  }
  return j.data as T;
}

export const GarsonService = {
  bilgi: (musteriNo: string) => istek<{ musteriNo: string; kisaAd: string }>(`/bilgi?musteriNo=${encodeURIComponent(musteriNo)}`, "GET", undefined, false),
  giris: (g: { musteriNo: string; kullaniciAdi: string; sifre: string }) => istek<GarsonGirisYaniti>("/giris", "POST", g, false),
  ben: () => istek<{ garson: GarsonBilgisi }>("/ben"),
  cikis: () => istek<{ cikti: boolean }>("/cikis", "POST", {}),
  masalar: () => istek<MasaDurumu>("/masalar"),
  menu: (bolgeId: number | null) => istek<AdisyonMenu>(`/menu${bolgeId ? `?bolgeId=${bolgeId}` : ""}`),
  getir: (adisyonId: number) => istek<AdisyonAyrinti>(`/kayit/${adisyonId}`),
  siparis: (g: SiparisGirdi) => istek<AdisyonAyrinti & { tekrar: boolean }>("/siparis", "POST", g),
  kisi: (adisyonId: number, kisi: number) => istek<AdisyonAyrinti>(`/kayit/${adisyonId}/kisi`, "PUT", { kisi }),
  servis: (kalemIdler: number[]) => istek<{ degisen: number }>("/kalem/servis", "POST", { kalemIdler }),
  ikram: (adisyonId: number, kalemler: KalemSecimi[], g: { ikram?: boolean; neden?: string; aciklama?: string; istekId?: string }) => istek<AdisyonAyrinti>(`/kayit/${adisyonId}/ikram`, "POST", { kalemler, ...g }),
  iptal: (adisyonId: number, kalemler: KalemSecimi[], g: { neden: string; aciklama?: string; istekId?: string }) => istek<AdisyonAyrinti>(`/kayit/${adisyonId}/iptal`, "POST", { kalemler, ...g }),
  adisyonIptal: (adisyonId: number, g: { neden: string; aciklama?: string; istekId?: string }) => istek<AdisyonAyrinti>(`/kayit/${adisyonId}/adisyon-iptal`, "POST", g),
  masaTasi: (adisyonId: number, masaId: number) => istek<AdisyonAyrinti>(`/kayit/${adisyonId}/masa-tasi`, "POST", { masaId }),
  birlestir: (adisyonId: number, hedefAdisyonId: number) => istek<AdisyonAyrinti>(`/kayit/${adisyonId}/birlestir`, "POST", { hedefAdisyonId }),
  urunTasi: (adisyonId: number, kalemler: KalemSecimi[], hedef: { masaId?: number; adisyonId?: number; istekId?: string }) => istek<UrunTasimaSonucu>(`/kayit/${adisyonId}/urun-tasi`, "POST", { kalemler, ...hedef }),
  // Hesap / tahsilat (D7): garson yalnız nakit / kart
  hesap: (adisyonId: number) => istek<HesapDurumu>(`/kayit/${adisyonId}/hesap`),
  hesapIste: (adisyonId: number) => istek<TahsilatSonucu>(`/kayit/${adisyonId}/hesap-iste`, "POST", {}),
  misafirPin: (adisyonId: number, yenile = false) => istek<{ pin: string; masa: string; musteriNo: string | null }>(`/kayit/${adisyonId}/misafir-pin`, "POST", { yenile }),
  odemeEkle: (adisyonId: number, g: OdemeGirdi & { istekId: string; musteri?: MusteriGirdi | null }) => istek<TahsilatSonucu>(`/kayit/${adisyonId}/odeme`, "POST", g),
  odemeSil: (odemeId: number) => istek<TahsilatSonucu>(`/odeme/${odemeId}`, "DELETE"),
  kapat: (adisyonId: number, g: { istekId: string; odemeler: OdemeGirdi[]; musteri?: MusteriGirdi | null }) => istek<TahsilatSonucu>(`/kayit/${adisyonId}/kapat`, "POST", g),
  urunleOde: (adisyonId: number, g: { istekId: string; kalemler: KalemSecimi[]; odemeler: OdemeGirdi[]; musteri?: MusteriGirdi | null }) => istek<TahsilatSonucu>(`/kayit/${adisyonId}/urun-ode`, "POST", g),
  // İndirim / kalem fiyatı (K1): garsonun ek yetkisiyle
  indirim: (adisyonId: number, g: { tur: number; deger?: number; neden?: string }) => istek<TahsilatSonucu>(`/kayit/${adisyonId}/indirim`, "POST", g),
  fiyatDegistir: (adisyonId: number, g: { kalemId: number; fiyat: number; neden: string }) => istek<AdisyonAyrinti>(`/kayit/${adisyonId}/fiyat`, "POST", g),
};

import { getEffectiveApiUrl } from "./apiClient";
import type { AdisyonMenu } from "./adisyonService";

/**
 * Masadaki misafir istemcisi (docs/TICARI_ADISYON_YOL_HARITASI.md §11, M1–M8). Personel / garson oturumundan bağımsız: kendi jetonu
 * (masa PIN'iyle alınır), sekme kapanınca biter (sessionStorage). Veritabanı başlığı göndermez (sunucu jetondan bulur).
 */
const JETON = "likya_misafir_jeton";
export const misafirJeton = {
  oku: (): string | null => { try { return sessionStorage.getItem(JETON); } catch { return null; } },
  yaz: (t: string) => { try { sessionStorage.setItem(JETON, t); } catch { /* gizli kip */ } },
  sil: () => { try { sessionStorage.removeItem(JETON); } catch { /* yok */ } },
};
export const MISAFIR_OTURUM_DUSTU = "likya_misafir_oturum_dustu";

export interface MisafirKalemi { ad: string; porsiyon: string | null; secim: string | null; miktar: number; tutar: number; ikram: boolean; durum: number }
export interface MisafirOzeti { kisaAd: string; masa: string; hesapIstendi: boolean; kalemler: MisafirKalemi[]; toplam: number; servis: number }
export interface MisafirSiparisKalemi { stokKartId: number; miktar: number; porsiyonId: number | null; secenekIdler: number[]; notu: string | null }

async function istek<T>(yol: string, method = "GET", govde?: unknown, jetonlu = true): Promise<T> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (govde !== undefined) h["Content-Type"] = "application/json";
  const t = misafirJeton.oku();
  if (jetonlu && t) h.Authorization = `Bearer ${t}`;
  const ctrl = new AbortController();
  const sure = setTimeout(() => ctrl.abort(), 20000);
  let r: Response;
  try { r = await fetch(`${getEffectiveApiUrl()}/misafir${yol}`, { method, headers: h, body: govde === undefined ? undefined : JSON.stringify(govde), cache: "no-store", signal: ctrl.signal }); }
  catch { throw new Error("Bağlantı kurulamadı. İnternetinizi kontrol edin."); }
  finally { clearTimeout(sure); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j?.message || `Hata ${r.status}`) as Error & { status?: number; kod?: string };
    e.status = r.status; e.kod = j?.errors?.kod;
    if (r.status === 401 && jetonlu) { misafirJeton.sil(); window.dispatchEvent(new CustomEvent(MISAFIR_OTURUM_DUSTU, { detail: { mesaj: e.message } })); }
    throw e;
  }
  return j.data as T;
}

export const MisafirService = {
  qr: (musteriNo: string, q: string) => istek<{ kisaAd: string; masa: string; masaAcik: boolean }>(`/qr?musteriNo=${encodeURIComponent(musteriNo)}&q=${encodeURIComponent(q)}`, "GET", undefined, false),
  giris: (g: { musteriNo: string; pin: string; qr?: string | null }) => istek<MisafirOzeti & { token: string }>("/giris", "POST", g, false),
  ben: () => istek<MisafirOzeti>("/ben"),
  menu: () => istek<AdisyonMenu>("/menu"),
  siparis: (g: { istekId: string; kalemler: MisafirSiparisKalemi[] }) => istek<MisafirOzeti>("/siparis", "POST", g),
  hesapIste: () => istek<MisafirOzeti>("/hesap-iste", "POST", {}),
  garsonCagir: () => istek<{ cagrildi: boolean }>("/garson-cagir", "POST", {}),
};

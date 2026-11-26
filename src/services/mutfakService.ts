import { getEffectiveApiUrl } from "./apiClient";
import type { MutfakSiparisleri } from "./adisyonService";

/**
 * Mutfak ekranı (KDS) bağlantısı istemcisi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA30, D5): /mutfak?m=<müşteri no>#k=<anahtar>.
 * Anahtar adres satırının # kısmında (sunucuya ve kayıtlara gitmez); girişten sonra jeton bu tarayıcıda saklanır.
 */
const JETON = "likya_mutfak_jeton";
export const mutfakJeton = { oku: () => localStorage.getItem(JETON), yaz: (t: string) => localStorage.setItem(JETON, t), sil: () => localStorage.removeItem(JETON) };

async function istek<T>(yol: string, method = "GET", govde?: unknown, jetonlu = true): Promise<T> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (govde !== undefined) h["Content-Type"] = "application/json";
  const t = mutfakJeton.oku();
  if (jetonlu && t) h.Authorization = `Bearer ${t}`;
  let r: Response;
  try { r = await fetch(`${getEffectiveApiUrl()}/mutfak${yol}`, { method, headers: h, body: govde === undefined ? undefined : JSON.stringify(govde), cache: "no-store" }); }
  catch { throw new Error("Sunucuya ulaşılamadı."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j?.message || `Hata ${r.status}`) as Error & { status?: number }; e.status = r.status; if (r.status === 401 && jetonlu) mutfakJeton.sil(); throw e; }
  return j.data as T;
}

export const MutfakService = {
  giris: (musteriNo: string, anahtar: string) => istek<{ token: string; yer: string; yerId: number; kisaAd: string }>("/giris", "POST", { musteriNo, anahtar }, false),
  ben: () => istek<{ yer: string; yerId: number; kisaAd: string }>("/ben"),
  siparisler: () => istek<MutfakSiparisleri>("/siparisler"),
  hazir: (kalemIdler: number[], hazir: boolean) => istek<{ degisen: number }>("/hazir", "POST", { kalemIdler, hazir }),
};

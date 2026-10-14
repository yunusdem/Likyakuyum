/**
 * Hızlı Satış ortak kuralları (docs/HIZLI_SATIS_YOL_HARITASI.md). Saf işlevler; ön yüz de içe aktarır.
 */
import { noTemizle, noTuru } from "../../utils/vknKontrol.js";

export const HIZLI_SATIS_MODULLERI = ["perakende", "ticari", "sarraf", "doviz"] as const;
export type HizliSatisModul = (typeof HIZLI_SATIS_MODULLERI)[number];

export const MODUL_ADI: Record<HizliSatisModul, string> = {
  perakende: "Perakende",
  ticari: "Ticari",
  sarraf: "Sarraf",
  doviz: "Döviz",
};

/** Buton ürün türü: 1 Ürün Tanımı / para birimi (TODVZ_PARA), 2 stok kartı, 3 serbest ürün */
export const URUN_TURU = { PARA: 1, STOK: 2, SERBEST: 3 } as const;

/** Hangi modülde hangi tür buton konabilir (H7, H9) */
export const MODUL_URUN_TURLERI: Record<HizliSatisModul, number[]> = {
  perakende: [URUN_TURU.PARA, URUN_TURU.SERBEST],
  ticari: [URUN_TURU.STOK, URUN_TURU.SERBEST],
  sarraf: [URUN_TURU.PARA],
  doviz: [URUN_TURU.PARA],
};

/** 12.000 TL kuralı yalnız mal satışında (H12) */
export const FATURA_SINIRI_MODULLERI: HizliSatisModul[] = ["perakende", "ticari"];
export const VARSAYILAN_FATURA_SINIRI = 12000;

/** TODVZ_URUN_RESIM.TIP: hızlı satış butonu resmi (0 altın, 1 özel, 2 stok kartı) */
export const BUTON_RESIM_TIPI = 4;
/** Küçültülmüş buton resminin en büyük boyutu (data URL karakteri); tarayıcı ~300 px'e küçültür */
export const BUTON_RESIM_AZAMI = 400_000;

export const SERBEST_KDV_ORANLARI = [0, 1, 10, 20];

export const modulGecerliMi = (m: unknown): m is HizliSatisModul => HIZLI_SATIS_MODULLERI.includes(m as HizliSatisModul);

export const renkGecerliMi = (r: unknown): boolean => typeof r === "string" && /^#[0-9a-fA-F]{6}$/.test(r);

/** Fiş toplamı (KDV dahil) sınıra eşit ya da üstündeyse alıcı bilgisi zorunlu */
export const faturaSiniriAsildiMi = (modul: HizliSatisModul, toplam: number, sinir: number): boolean =>
  FATURA_SINIRI_MODULLERI.includes(modul) && sinir > 0 && Math.round(toplam * 100) >= Math.round(sinir * 100);

export const sinirOku = (deger: unknown): number => {
  const s = typeof deger === "string" ? (deger.includes(",") ? deger.replace(/\./g, "").replace(",", ".") : deger) : deger;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : VARSAYILAN_FATURA_SINIRI;
};

export interface AliciBilgisi {
  unvan: string;
  vknTckn: string;
  adres: string;
  il: string;
  ilce: string;
  vergiDairesi?: string;
  telefon?: string;
  eposta?: string;
}

/** Sınır aşıldığında alıcı bilgisinde eksikler (H13). Boş dizi = tamam. */
export function aliciEksikleri(a: Partial<AliciBilgisi> | null | undefined): string[] {
  const eksik: string[] = [];
  const t = (v: unknown) => String(v ?? "").trim();
  const unvan = t(a?.unvan);
  // Fiş ekranlarındaki anonim adlar (isAnonymousCustomerName): nihai tüketici, "isim beyan edilmemiştir/edilmedi"
  const anonim = /^n[iİı]ha[iİı]\s+t[üu]ket[iİı]c[iİı]$/i.test(unvan) || /beyan\s+ed[iİı]lme/i.test(unvan.toLocaleLowerCase("tr-TR"));
  if (!unvan || anonim) eksik.push("Ad Soyad / Ünvan");
  const no = noTemizle(t(a?.vknTckn));
  if (!no) eksik.push("TCKN / VKN");
  else if (/^1{10,11}$/.test(no) || !noTuru(no)) eksik.push("Geçerli TCKN / VKN");
  if (!t(a?.adres)) eksik.push("Adres");
  if (!t(a?.il)) eksik.push("İl");
  if (!t(a?.ilce)) eksik.push("İlçe");
  return eksik;
}

/** Ürün Tanımı (TODVZ_PARA) bu modülün butonu olabilir mi (H7). urunTipi: 0 döviz, 1 altın, 2 gümüş, 3 ziynet, 99 iskonto */
export function paraUygunMu(modul: HizliSatisModul, p: { kod?: string | null; urunTipi?: number | null }): boolean {
  const kod = String(p.kod ?? "").trim().toLocaleUpperCase("tr-TR");
  const tip = Number(p.urunTipi) || 0;
  if (!kod || ["TL", "TRY", "TRL", "YTL", "POS", "HAVALE"].includes(kod) || tip === 99) return false;
  if (modul === "doviz") return tip === 0;
  if (modul === "perakende") return tip === 1 || tip === 2 || tip === 3;
  if (modul === "sarraf") return tip >= 0 && tip <= 3;
  return false;
}

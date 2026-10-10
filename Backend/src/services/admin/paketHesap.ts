import { ModulKaydi } from "../../types/admin.types.js";
import { modulleriDuzenle } from "./modulAgaci.js";

/**
 * Lisans ürün paketleri — saf hesap (docs/LISANS_URUN_PAKETLERI.md, 3.2). Veritabanına dokunmaz.
 *   firma açık modülleri = ağaç kuralı( (çekirdek ∪ seçili paketler) + EK − CIKAR )
 * HEPSI paketi (ERP) katalogun tamamıdır.
 */

export interface PaketIcerigi {
  paketKodu: string;
  cekirdek: boolean;
  hepsi: boolean;
  moduller: string[];
}

export interface Istisnalar {
  ek: string[];
  cikar: string[];
}

/** Açılan kodun tüm üstlerini ekler (ağaç kuralı üstü kapalı olanı kapattığı için). */
export const ustleriyle = (katalog: ModulKaydi[], kodlar: Iterable<string>): Set<string> => {
  const ust = new Map(katalog.map((m) => [m.modulKodu, m.ustKodu]));
  const sonuc = new Set<string>();
  for (const k of kodlar) {
    if (!ust.has(k)) continue;
    for (let u: string | null | undefined = k; u; u = ust.get(u)) sonuc.add(u);
  }
  return sonuc;
};

/** Seçili ürünlerin taban listesi (çekirdek dahil, ağaç kuralı uygulanmış). urunler boşsa boş liste. */
export const paketTabani = (katalog: ModulKaydi[], paketler: PaketIcerigi[], urunler: string[]): string[] => {
  if (urunler.length === 0) return [];
  const secili = paketler.filter((p) => p.cekirdek || urunler.includes(p.paketKodu));
  if (secili.some((p) => p.hepsi && urunler.includes(p.paketKodu))) return katalog.map((m) => m.modulKodu);
  return modulleriDuzenle(katalog, [...ustleriyle(katalog, secili.flatMap((p) => p.moduller))]);
};

/** Taban + istisnalar → firmanın açık modülleri. */
export const firmaModulleriHesapla = (katalog: ModulKaydi[], taban: string[], istisna: Istisnalar): string[] => {
  const kume = new Set(taban);
  istisna.ek.forEach((k) => kume.add(k));
  istisna.cikar.forEach((k) => kume.delete(k));
  return modulleriDuzenle(katalog, [...ustleriyle(katalog, kume)]);
};

/**
 * İstenen son listeyi tabana göre istisnaya çevirir: tabanda olmayan açık → EK, tabanda olup kapalı → CIKAR.
 * firmaModulleriHesapla(katalog, taban, istisnaCikar(katalog, taban, istenen)) === ağaç kuralı(istenen).
 */
export const istisnaCikar = (katalog: ModulKaydi[], taban: string[], istenen: string[]): Istisnalar => {
  const t = new Set(modulleriDuzenle(katalog, taban));
  const i = new Set(modulleriDuzenle(katalog, istenen));
  return { ek: [...i].filter((k) => !t.has(k)), cikar: [...t].filter((k) => !i.has(k)) };
};

/** İki liste arasındaki fark (önizleme): yalnız yaprak sayfalar, katalog sırasıyla. */
export const farkHesapla = (
  katalog: ModulKaydi[],
  eski: string[] | null,
  yeni: string[]
): { acilacak: ModulKaydi[]; kapanacak: ModulKaydi[] } => {
  const altVar = new Set(katalog.map((m) => m.ustKodu).filter((u): u is string => !!u));
  const yapraklar = katalog.filter((m) => !altVar.has(m.modulKodu));
  const e = new Set(eski ?? katalog.map((m) => m.modulKodu)); // null = kısıtsız, her şey açık
  const y = new Set(yeni);
  return {
    acilacak: yapraklar.filter((m) => y.has(m.modulKodu) && !e.has(m.modulKodu)),
    kapanacak: yapraklar.filter((m) => e.has(m.modulKodu) && !y.has(m.modulKodu)),
  };
};

/** "kuyum,connector" ↔ dizi. Bilinmeyen / yinelenen kod atılır, sıra korunur. */
export const urunleriOku = (metin: string | null | undefined): string[] =>
  [...new Set((metin || "").split(",").map((s) => s.trim()).filter(Boolean))];
export const urunleriYaz = (urunler: string[]): string | null => (urunler.length ? [...new Set(urunler)].join(",") : null);

export const ayniUrunler = (a: string[], b: string[]): boolean => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((k) => y.has(k));
};

/**
 * e-Banka'dan açılan sarraf fişinde satır dengesi (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M10–M14). Saf; tsx ile sınanır.
 *
 * Satırın Toplam Tutar'ı banka tutarına sabittir. İşçilik Toplam KDV dahildir (net + KDV). Altın kısmı = Toplam − İşçilik Toplam;
 * kur sabit kalır, gram = altın ÷ (milyem × kur). İşçilik gram başına yazıldıysa (İşçilik/M, gram usulü) işçilik de grama bağlıdır:
 *   Toplam = gram × milyem × kur + gram × gramBaşıNet × (1 + KDV)  →  gram = Toplam ÷ (milyem × kur + gramBaşıNet × (1 + KDV)).
 */

/** İşçilik KDV oranının e-Banka fişindeki varsayılanı (M12) */
export const EB_VARSAYILAN_KDV = 20;

const yuvarla = (n: number, hane: number) => {
  const k = 10 ** hane;
  return Math.round((n + Number.EPSILON) * k) / k;
};

/** Milyem giriş biçimleri (916 · 91,6 · 0,916) → oran; Sarraf fişindeki recomputeRow ile aynı kural. 0 → 1 (has = gram). */
export const etkinMilyem = (ham: number): number => {
  const m = ham > 1 ? (ham <= 100 ? ham / 100 : ham / 1000) : ham;
  return m > 0 ? m : 1;
};

export interface EbGramGirdisi {
  /** Satırın sabit Toplam Tutar'ı (banka tutarı ya da düzenlemede açılıştaki tutar) */
  hedef: number;
  /** Etkin milyem (etkinMilyem ile) */
  milyem: number;
  /** Satır kuru: TL Tutar = has × kur */
  kur: number;
  /** İşçilik KDV oranı (%); KDV'siz istatistikte 0 */
  kdvOrani: number;
  /** İşçilik Toplam (KDV dahil) girdi olduğunda */
  iscilikToplam?: number;
  /** Gram usulü işçilikte gram başına net işçilik (TL) girdi olduğunda */
  gramBasiNetIscilik?: number;
}

/** Sabit toplamı tutturan gram (3 hane). Çözülemezse (kur yok, işçilik toplamı aşıyor) null: satır olduğu gibi kalır. */
export function ebGramCoz(g: EbGramGirdisi): number | null {
  if (!(g.hedef > 0) || !(g.kur > 0)) return null;
  const mil = g.milyem > 0 ? g.milyem : 1;
  const kdvCarpani = 1 + Math.max(0, g.kdvOrani || 0) / 100;
  let gram: number;
  if (g.gramBasiNetIscilik !== undefined && g.gramBasiNetIscilik > 0) {
    gram = g.hedef / (mil * g.kur + g.gramBasiNetIscilik * kdvCarpani);
  } else {
    const x = Math.max(0, g.iscilikToplam || 0);
    if (x >= g.hedef) return null;
    gram = (g.hedef - x) / (mil * g.kur);
  }
  const sonuc = yuvarla(gram, 3);
  return sonuc > 0 ? sonuc : null;
}

/** KDV dahil işçilik toplamının net / KDV ayrışımı (Sarraf fişindeki "İşçilik Toplam" hesabıyla aynı yuvarlama) */
export function iscilikAyristir(toplam: number, kdvOrani: number): { net: number; kdv: number } {
  if (!(toplam > 0)) return { net: 0, kdv: 0 };
  if (!(kdvOrani > 0)) return { net: yuvarla(toplam, 2), kdv: 0 };
  const net = yuvarla(toplam / (1 + kdvOrani / 100), 2);
  return { net, kdv: yuvarla(toplam - net, 2) };
}

/** Kuruş artığı TL Tutar'da kapanır: TL Tutar + İşçilik Toplam = Toplam (M11) */
export const altinTutari = (hedef: number, iscilikToplam: number): number => yuvarla(hedef - Math.max(0, iscilikToplam || 0), 2);

/** Fişin alt kutusundaki özet (M15): işçilik toplamı (KDV dahil), KDV tutarı, ortak oran (satırlarda farklıysa null) */
export function iscilikOzeti(satirlar: { iscilikToplam?: unknown; iscilikKdvTutari?: unknown; iscilikKdvOrani?: unknown }[], sayi: (v: unknown) => number) {
  let toplam = 0;
  let kdv = 0;
  const oranlar = new Set<number>();
  for (const s of satirlar) {
    const t = sayi(s.iscilikToplam);
    if (!(t > 0)) continue;
    toplam += t;
    kdv += sayi(s.iscilikKdvTutari) || 0;
    const o = sayi(s.iscilikKdvOrani);
    if (o > 0) oranlar.add(o);
  }
  return { toplam: yuvarla(toplam, 2), kdv: yuvarla(kdv, 2), net: yuvarla(toplam - kdv, 2), oran: oranlar.size === 1 ? [...oranlar][0] : null, var: toplam > 0 };
}

import type { StatisticItem } from "../../services/statisticService";
import type { IndirimGirdisi, SepetOdemesi, SepetSatiri } from "../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import type { HizliMusteri } from "./kaydet/tipler";
import { ModulVerisi, satiriYenidenFiyatla } from "./modulVerisi";

/**
 * Bekleyen sepet (H25–H28): beklemeye alınırken saklanan içerik ve geri çağırınca hazırlık. Geri çağırınca kurla fiyatlanan
 * satırlar güncel kurdan yenilenir (elle verilen fiyat korunur), satılmış barkodlu ürün ve pasif / silinmiş stok kartı çıkarılır.
 */
export const BEKLEYEN_SURUM = 1;

export interface BekleyenIcerik {
  surum: number;
  tip: 0 | 1;
  sepet: SepetSatiri[];
  odemeler: SepetOdemesi[];
  musteri: HizliMusteri;
  indirim: IndirimGirdisi | null;
}

export interface GeriCagirmaSonucu {
  tip: 0 | 1;
  sepet: SepetSatiri[];
  odemeler: SepetOdemesi[];
  musteri: HizliMusteri | null;
  indirim: IndirimGirdisi | null;
  /** Güncel kurla fiyatı değişen satır sayısı */
  degisen: number;
  uyarilar: string[];
}

export const icerikHazirla = (tip: 0 | 1, sepet: SepetSatiri[], odemeler: SepetOdemesi[], musteri: HizliMusteri, indirim: IndirimGirdisi | null): BekleyenIcerik => ({
  surum: BEKLEYEN_SURUM,
  tip,
  // İşaretler bir sonraki geri çağırmada yeniden hesaplanır
  sepet: sepet.map(({ fiyatDegisti: _f, ...s }) => s),
  odemeler,
  musteri,
  indirim,
});

/**
 * Saf kısım: kurla fiyatlanan satırları yeniden fiyatlar, stok kartı satırlarını denetler. Barkodlu satır denetimi `satildiMi` ile
 * (Perakende ürün sorgusu) dışarıdan verilir; true dönen satır çıkarılır.
 */
export async function geriCagir(
  ic: Partial<BekleyenIcerik> | null | undefined,
  v: ModulVerisi,
  istatistik: (tip: 0 | 1) => StatisticItem | null,
  satildiMi: (barkod: string) => Promise<boolean> = async () => false
): Promise<GeriCagirmaSonucu> {
  if (!ic || !Array.isArray(ic.sepet)) throw new Error("Bekleyen sepet okunamadı.");
  const tip: 0 | 1 = ic.tip === 0 ? 0 : 1;
  const ist = istatistik(tip);
  const uyarilar: string[] = [];
  const sepet: SepetSatiri[] = [];
  let degisen = 0;
  for (const s of ic.sepet) {
    if (s.tur === "stok") {
      const kart = s.urunId ? v.kartlar.get(Number(s.urunId)) : undefined;
      if (!kart || !kart.aktif) {
        uyarilar.push(`"${s.ad}" stok kartı bulunamadı ya da pasif; sepetten çıkarıldı.`);
        continue;
      }
      sepet.push({ ...s, fiyatDegisti: false });
      continue;
    }
    if (s.tur === "barkod") {
      const bk = String(s.ek?.barkod || s.kod || "");
      if (bk && (await satildiMi(bk).catch(() => false))) {
        uyarilar.push(`"${s.ad}" (${bk}) bu arada satılmış; sepetten çıkarıldı.`);
        continue;
      }
      sepet.push({ ...s, fiyatDegisti: false });
      continue;
    }
    if (s.tur === "para") {
      if (!v.paralar.some((p) => p.paraId === s.urunId)) {
        uyarilar.push(`"${s.ad}" ürün tanımı bulunamadı; sepetten çıkarıldı.`);
        continue;
      }
      const y = satiriYenidenFiyatla(s, v, tip, ist);
      const degisti = !s.fiyatElle && y.birimFiyat > 0 && Math.abs(y.birimFiyat - s.birimFiyat) > 0.00001;
      if (degisti) degisen++;
      // Güncel kur bulunamadıysa eski fiyat kalır
      sepet.push({ ...y, birimFiyat: y.birimFiyat > 0 ? y.birimFiyat : s.birimFiyat, fiyatDegisti: degisti });
      continue;
    }
    sepet.push({ ...s, fiyatDegisti: false });
  }
  return {
    tip,
    sepet,
    odemeler: Array.isArray(ic.odemeler) ? ic.odemeler : [],
    musteri: ic.musteri ?? null,
    indirim: tip === 1 ? ic.indirim ?? null : null,
    degisen,
    uyarilar,
  };
}

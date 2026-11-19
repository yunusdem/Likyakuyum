/**
 * Fiş dürbünü gelişmiş filtresi — saf mantık (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D1–D4).
 * Tarih aralığı yerel saatle hesaplanır (UTC günü 00:00–03:00 arası dünü verirdi).
 */
import { yerelGun } from "./fisTarihi";

export interface FisDurbunFiltreDegeri {
  baslangic: string;
  bitis: string;
  vezneId: string;
  urunId: string;
  /** Ürün adı / kodu metni (kimlik listesi olmayan ekran) */
  urun: string;
  tip: string;
  cari: string;
  tutarMin: string;
  tutarMax: string;
  belgeNo: string;
}

export type TarihKisayolu = "bugun" | "dun" | "buHafta" | "buAy" | "tumu";

/** Hızlı düğme → yerel gün aralığı. Hafta pazartesi başlar. */
export function tarihAraligi(kisayol: TarihKisayolu, simdi: Date = new Date()): { baslangic: string; bitis: string } {
  if (kisayol === "tumu") return { baslangic: "", bitis: "" };
  const bugun = new Date(simdi.getFullYear(), simdi.getMonth(), simdi.getDate());
  if (kisayol === "bugun") return { baslangic: yerelGun(bugun), bitis: yerelGun(bugun) };
  if (kisayol === "dun") {
    const dun = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate() - 1);
    return { baslangic: yerelGun(dun), bitis: yerelGun(dun) };
  }
  if (kisayol === "buHafta") {
    const fark = (bugun.getDay() + 6) % 7; // pazartesi 0 … pazar 6
    const pzt = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate() - fark);
    return { baslangic: yerelGun(pzt), bitis: yerelGun(bugun) };
  }
  return { baslangic: yerelGun(new Date(bugun.getFullYear(), bugun.getMonth(), 1)), bitis: yerelGun(bugun) };
}

/** Seçili aralık hangi hızlı düğmeye denk geliyor (düğmeyi vurgulamak için) */
export function hangiKisayol(baslangic: string, bitis: string, simdi: Date = new Date()): TarihKisayolu | null {
  if (!baslangic && !bitis) return "tumu";
  for (const k of ["bugun", "dun", "buHafta", "buAy"] as TarihKisayolu[]) {
    const a = tarihAraligi(k, simdi);
    if (a.baslangic === baslangic && a.bitis === bitis) return k;
  }
  return null;
}

/** Dürbün açılışındaki filtre: bu ay (ayın 1'i – bugün), diğerleri boş (D4) */
export function varsayilanDurbunFiltresi(simdi: Date = new Date()): FisDurbunFiltreDegeri {
  const { baslangic, bitis } = tarihAraligi("buAy", simdi);
  return { baslangic, bitis, vezneId: "", urunId: "", urun: "", tip: "", cari: "", tutarMin: "", tutarMax: "", belgeNo: "" };
}

/** "1.234,50" / "1234.5" / "1234,5" → 1234.5; geçersizse undefined */
export function tutarMetniOku(v: string): number | undefined {
  let s = (v || "").trim().replace(/\s/g, "");
  if (!s) return undefined;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const GUN_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Filtre → sunucu sorgu parametreleri (yalnız dolu alanlar; adlar drb önekli, Backend/src/utils/fisDurbunFiltre.ts okur).
 * Başlangıç bitişten sonraysa ikisi yer değiştirir.
 */
export function durbunSorguParametreleri(f: FisDurbunFiltreDegeri, arama?: string): Record<string, string | number> {
  const p: Record<string, string | number> = {};
  let bas = GUN_RE.test(f.baslangic) ? f.baslangic : "";
  let bit = GUN_RE.test(f.bitis) ? f.bitis : "";
  if (bas && bit && bas > bit) [bas, bit] = [bit, bas];
  if (bas) p.drbBas = bas;
  if (bit) p.drbBit = bit;
  if (/^\d+$/.test(f.vezneId) && Number(f.vezneId) > 0) p.drbVezne = Number(f.vezneId);
  if (/^\d+$/.test(f.urunId) && Number(f.urunId) > 0) p.drbUrunId = Number(f.urunId);
  if (f.urun.trim()) p.drbUrun = f.urun.trim();
  if (f.tip !== "" && /^[A-Za-z0-9_-]+$/.test(f.tip)) p.drbTip = f.tip;
  if (f.cari.trim()) p.drbCari = f.cari.trim();
  const tmin = tutarMetniOku(f.tutarMin);
  const tmax = tutarMetniOku(f.tutarMax);
  if (tmin !== undefined) p.drbTutarMin = tmin;
  if (tmax !== undefined) p.drbTutarMax = tmax;
  if (f.belgeNo.trim()) p.drbBelge = f.belgeNo.trim();
  if (arama && arama.trim()) p.search = arama.trim();
  return p;
}

/** Sunucu sınırı: bu kadar kayıt gösterilir, bir fazlası istenir; fazlası gelirse "daraltın" bilgisi verilir */
export const DURBUN_SINIRI = 1000;

export function sinirUygula<T>(liste: T[], sinir: number = DURBUN_SINIRI): { liste: T[]; tasti: boolean } {
  return liste.length > sinir ? { liste: liste.slice(0, sinir), tasti: true } : { liste, tasti: false };
}

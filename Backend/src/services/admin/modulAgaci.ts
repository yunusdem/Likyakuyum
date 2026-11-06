import type { ModulKaydi } from "../../types/admin.types.js";

/**
 * Yalnız açıkça açılan ana modüller (docs/MOBIL_CARI_YOL_HARITASI.md, K11): firmaya dışarıdan erişim verdikleri için
 * modül ayarı yapılmamış (kısıtsız) firmada ve ERP ("hepsi") paketinde KAPALI sayılır; panelden tek tek açılır.
 */
export const ACIKCA_ACILAN_MODULLER = ["mobil"] as const;

/** Kod (ana modül ya da altındaki sayfa) açıkça açılan bir modüle mi ait */
export const acikcaAcilanMi = (kod: string): boolean =>
  ACIKCA_ACILAN_MODULLER.some((a) => kod === a || kod.startsWith(`${a}:`));

/**
 * Açıkça açılan modül firmaya açık mı: acik === null (kısıtsız) iken de KAPALI. Diğer modüllerde null "her şey açık"tır.
 */
export const acikcaAcikMi = (acik: string[] | null | undefined, kod: string): boolean => !!acik && acik.includes(kod);

/**
 * Ağaç kuralları: ana modül kapalıysa altındakiler de kapalıdır; alt öğesi olan bir ana modülün hiçbir alt öğesi
 * açık değilse ana modül de kapalıdır. Katalogda olmayan kodlar atılır.
 */
export const modulleriDuzenle = (katalog: ModulKaydi[], istenen: string[]): string[] => {
  const gecerli = new Set(katalog.map((m) => m.modulKodu));
  const acik = new Set(istenen.filter((k) => gecerli.has(k)));
  const ust = new Map(katalog.map((m) => [m.modulKodu, m.ustKodu]));

  // Üstü kapalı olanı kapat (ağaç derinliği kadar tekrarla)
  for (let degisti = true; degisti; ) {
    degisti = false;
    for (const kod of [...acik]) {
      const u = ust.get(kod);
      if (u && !acik.has(u)) {
        acik.delete(kod);
        degisti = true;
      }
    }
  }
  // Alt öğesi olup hiçbiri açık olmayan düğümü kapat (yapraklardan yukarı)
  for (let degisti = true; degisti; ) {
    degisti = false;
    for (const m of katalog) {
      if (!acik.has(m.modulKodu)) continue;
      const cocuklar = katalog.filter((c) => c.ustKodu === m.modulKodu);
      if (cocuklar.length > 0 && !cocuklar.some((c) => acik.has(c.modulKodu))) {
        acik.delete(m.modulKodu);
        degisti = true;
      }
    }
  }
  return [...acik];
};

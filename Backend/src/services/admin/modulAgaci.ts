import { ModulKaydi } from "../../types/admin.types.js";

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

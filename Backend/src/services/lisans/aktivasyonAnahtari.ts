import crypto from "crypto";

/**
 * Aktivasyon anahtarı (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md 16, A1–A2): panel her lisansa rastgele anahtar verir,
 * müşteri programa yazar, merkez makineyi lisansa bağlar. Biçim LKY-XXXXX-XXXXX-XXXXX; karışan harfler (0/O, 1/I/L, U) yok.
 */

const ALFABE = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const GOVDE = 15;
const BICIM = new RegExp(`^LKY[${ALFABE}]{${GOVDE}}$`);

const bicimle = (govde: string): string => `LKY-${govde.slice(0, 5)}-${govde.slice(5, 10)}-${govde.slice(10, 15)}`;

/** Rastgele anahtar (kriptografik; modülo sapması olmadan) */
export const aktivasyonAnahtariUret = (): string => {
  let govde = "";
  while (govde.length < GOVDE) {
    for (const b of crypto.randomBytes(GOVDE)) {
      if (b < 240 && govde.length < GOVDE) govde += ALFABE[b % ALFABE.length];
    }
  }
  return bicimle(govde);
};

/** Yazılan metin anahtarsa düzgün biçimini döner (küçük harf, boşluk, tiresiz yazım kabul); değilse null. */
export const aktivasyonAnahtariCoz = (metin: string): string | null => {
  const sade = String(metin || "").toUpperCase().replace(/[\s-]+/g, "");
  return BICIM.test(sade) ? bicimle(sade.slice(3)) : null;
};

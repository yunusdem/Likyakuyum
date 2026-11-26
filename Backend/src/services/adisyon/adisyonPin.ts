import crypto from "node:crypto";

/**
 * Garson PIN'i ve cihaz anahtarı özeti (docs/TICARI_ADISYON_YOL_HARITASI.md, TA23). PIN düz saklanmaz: scrypt + rastgele tuz.
 * Biçim: "s1$<tuz hex>$<özet hex>". Karşılaştırma sabit sürede (timingSafeEqual).
 */
const N = 16384, UZUNLUK = 32;

export function pinOzeti(pin: string): string {
  const tuz = crypto.randomBytes(16);
  const ozet = crypto.scryptSync(String(pin), tuz, UZUNLUK, { N });
  return `s1$${tuz.toString("hex")}$${ozet.toString("hex")}`;
}

export function pinDogrula(pin: string, kayit: string | null | undefined): boolean {
  const p = String(kayit || "").split("$");
  if (p.length !== 3 || p[0] !== "s1") return false;
  const tuz = Buffer.from(p[1], "hex"), beklenen = Buffer.from(p[2], "hex");
  if (!tuz.length || beklenen.length !== UZUNLUK) return false;
  const ozet = crypto.scryptSync(String(pin), tuz, UZUNLUK, { N });
  return crypto.timingSafeEqual(ozet, beklenen);
}

/** Cihaz anahtarı: rastgele 32 bayt (istemcide saklanır); sunucuda yalnız SHA-256 özeti tutulur */
export const yeniCihazAnahtari = (): string => crypto.randomBytes(32).toString("base64url");
export const cihazOzeti = (anahtar: string): string => crypto.createHash("sha256").update(String(anahtar)).digest("hex");

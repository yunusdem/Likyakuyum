import crypto from "crypto";
import { env } from "../config/env.config.js";
/**
 * Firma veritabanı şifrelerinin LIKYA_ADMIN içinde şifreli saklanması (AES-256-GCM).
 * Anahtar yalnızca sunucudaki .env'dedir (ADMIN_DB_ENC_KEY); veritabanı tek başına ele geçse şifreler okunamaz.
 * Biçim: v1:<iv>:<etiket>:<şifreli metin> (hepsi base64).
 */
const SURUM = "v1";
const anahtar = () => crypto.createHash("sha256").update(env.ADMIN_DB_ENC_KEY, "utf8").digest();
export const sifrele = (duzMetin) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", anahtar(), iv);
    const sifreli = Buffer.concat([cipher.update(duzMetin, "utf8"), cipher.final()]);
    return [SURUM, iv.toString("base64"), cipher.getAuthTag().toString("base64"), sifreli.toString("base64")].join(":");
};
/** Çözülemezse (anahtar değişmiş, veri bozulmuş) null döner. */
export const sifreCoz = (saklanan) => {
    if (!saklanan)
        return null;
    const [surum, iv, etiket, sifreli] = saklanan.split(":");
    if (surum !== SURUM || !iv || !etiket || sifreli === undefined)
        return null;
    try {
        const decipher = crypto.createDecipheriv("aes-256-gcm", anahtar(), Buffer.from(iv, "base64"));
        decipher.setAuthTag(Buffer.from(etiket, "base64"));
        return Buffer.concat([decipher.update(Buffer.from(sifreli, "base64")), decipher.final()]).toString("utf8");
    }
    catch {
        return null;
    }
};

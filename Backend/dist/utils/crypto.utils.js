import crypto from "crypto";
import { ApiError } from "./ApiError.js";
/**
 * AES-256-GCM ile hassas bilgi (entegratör şifresi vb.) şifreleme yardımcıları.
 *
 * Anahtar `EBELGE_ENC_KEY` ortam değişkeninden okunur; 32 baytlık bir anahtar
 * (64 karakter hex ya da base64) olmalıdır. Anahtar tanımlı değilse şifreleme
 * yapılmaz ve anlaşılır bir hata döner — düz metin saklamaya asla düşülmez.
 *
 * Yeni anahtar üretmek için:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
const KEY_ENV_NAME = "EBELGE_ENC_KEY";
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bit
const IV_LENGTH = 12; // GCM için önerilen uzunluk
/**
 * Ortam değişkenindeki anahtarı okuyup 32 baytlık Buffer'a çevirir.
 */
const readKey = () => {
    const raw = (process.env[KEY_ENV_NAME] || "").trim();
    if (!raw)
        return null;
    let key = null;
    // 64 karakter hex
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
        key = Buffer.from(raw, "hex");
    }
    else {
        // base64 denemesi
        try {
            const decoded = Buffer.from(raw, "base64");
            if (decoded.length === KEY_LENGTH) {
                key = decoded;
            }
        }
        catch {
            key = null;
        }
    }
    if (!key || key.length !== KEY_LENGTH) {
        return null;
    }
    return key;
};
/**
 * Şifreleme anahtarı tanımlı ve geçerli mi?
 */
export const isEncryptionConfigured = () => readKey() !== null;
const requireKey = () => {
    const key = readKey();
    if (!key) {
        throw ApiError.internal(`${KEY_ENV_NAME} ortam değişkeni tanımlı değil veya geçersiz. ` +
            `32 baytlık bir anahtar (64 karakter hex) tanımlanmadan entegratör şifresi saklanamaz.`);
    }
    return key;
};
/**
 * Düz metni AES-256-GCM ile şifreler.
 */
export const encryptSecret = (plainText) => {
    const key = requireKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipherer = crypto.createCipheriv(ALGORITHM, key, iv);
    const cipher = Buffer.concat([cipherer.update(plainText, "utf8"), cipherer.final()]);
    const tag = cipherer.getAuthTag();
    return { cipher, iv, tag };
};
/**
 * AES-256-GCM ile şifrelenmiş veriyi çözer.
 * Doğrulama etiketi (tag) tutmazsa hata fırlatır — veri kurcalanmışsa sessizce geçilmez.
 */
export const decryptSecret = (cipher, iv, tag) => {
    const key = requireKey();
    try {
        const decipherer = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipherer.setAuthTag(tag);
        return Buffer.concat([decipherer.update(cipher), decipherer.final()]).toString("utf8");
    }
    catch {
        throw ApiError.internal("Kayıtlı entegratör şifresi çözülemedi. Şifreleme anahtarı değişmiş olabilir; " +
            "ayarlar ekranından şifreyi yeniden giriniz.");
    }
};

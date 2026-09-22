import crypto from "crypto";
import bcrypt from "bcryptjs";
/**
 * Merkezi admin veritabanındaki hesapların (adminler ve firma kullanıcıları) şifre yardımcıları.
 * Firma DB'sindeki eski TODVZ_KULLANICI.SIFRE mantığından (password.utils.ts) bağımsızdır.
 */
const BCRYPT_TUR = 12;
export const SIFRE_MIN_UZUNLUK = 8;
export const SIFRE_MAX_UZUNLUK = 72; // bcrypt 72 bayttan sonrasını yok sayar
/** Kural: en az 8 karakter, en az bir harf ve bir rakam. Uygunsa null, değilse hata metni döner. */
export const sifreKuralHatasi = (sifre) => {
    if (typeof sifre !== "string" || sifre.length < SIFRE_MIN_UZUNLUK) {
        return `Şifre en az ${SIFRE_MIN_UZUNLUK} karakter olmalıdır.`;
    }
    if (Buffer.byteLength(sifre, "utf8") > SIFRE_MAX_UZUNLUK) {
        return `Şifre en fazla ${SIFRE_MAX_UZUNLUK} karakter olabilir.`;
    }
    if (!/\p{L}/u.test(sifre))
        return "Şifre en az bir harf içermelidir.";
    if (!/\d/.test(sifre))
        return "Şifre en az bir rakam içermelidir.";
    return null;
};
export const sifreHashle = (sifre) => bcrypt.hash(sifre, BCRYPT_TUR);
export const sifreDogrula = async (sifre, hash) => {
    if (!sifre || !hash)
        return false;
    try {
        return await bcrypt.compare(sifre, hash);
    }
    catch {
        return false;
    }
};
// Kullanıcı bulunamadığında da aynı süre harcansın diye karşılaştırılan sahte hash
const SAHTE_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), BCRYPT_TUR);
export const sahteSifreDogrula = async (sifre) => {
    await sifreDogrula(sifre || "x", SAHTE_HASH);
};
/**
 * Bir kez gösterilecek geçici şifre üretir (12 karakter; karışan 0/O, 1/l/I harfleri yok).
 * Kurala uyması için en az bir harf ve bir rakam içermesi garanti edilir.
 */
export const geciciSifreUret = (uzunluk = 12) => {
    const harfler = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ";
    const rakamlar = "23456789";
    const hepsi = harfler + rakamlar;
    const sec = (kume) => kume[crypto.randomInt(kume.length)];
    const karakterler = [sec(harfler), sec(rakamlar)];
    while (karakterler.length < uzunluk)
        karakterler.push(sec(hepsi));
    // Fisher-Yates
    for (let i = karakterler.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [karakterler[i], karakterler[j]] = [karakterler[j], karakterler[i]];
    }
    return karakterler.join("");
};

import crypto from "crypto";
import { LISANS_ACIK_ANAHTAR } from "../../constants/lisansAcikAnahtar.js";
/**
 * Çevrimdışı lisans kodu: LKY1.<base64url(JSON)>.<base64url(Ed25519 imzası)>
 * docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 7.3 · K8, K14, K17.
 * Kodu yalnızca özel anahtarı bilen merkez sunucu üretebilir; kurulum, koda gömülü açık anahtarla doğrular.
 */
export const LISANS_ONEKI = "LKY1";
export class LisansKoduGecersiz extends Error {
    neden;
    constructor(neden, mesaj) {
        super(mesaj);
        this.neden = neden;
    }
}
const b64u = (b) => b.toString("base64url");
/** Testler ve merkez sunucu için: koda gömülü değeri geçersiz kılar (ortam değişkeninden asla okunmaz). */
let acikAnahtarB64 = LISANS_ACIK_ANAHTAR;
export const lisansAcikAnahtariniAyarla = (b64) => {
    acikAnahtarB64 = b64;
};
export const lisansAcikAnahtari = () => acikAnahtarB64;
export const ozelAnahtarOku = (b64) => {
    const k = crypto.createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" });
    if (k.asymmetricKeyType !== "ed25519")
        throw new Error("Lisans özel anahtarı Ed25519 değil.");
    return k;
};
export const acikAnahtarOku = (b64) => {
    const k = crypto.createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" });
    if (k.asymmetricKeyType !== "ed25519")
        throw new Error("Lisans açık anahtarı Ed25519 değil.");
    return k;
};
/** Özel anahtardan açık anahtar (base64 SPKI). */
export const acikAnahtarTuret = (ozelB64) => crypto.createPublicKey(ozelAnahtarOku(ozelB64)).export({ format: "der", type: "spki" }).toString("base64");
/** Herhangi bir veriyi imzalı metne çevirir (lisans kodu ve firma.lky aynı biçimi kullanır). */
export const imzaliMetinUret = (onek, veri, ozelB64) => {
    const govde = b64u(Buffer.from(JSON.stringify(veri), "utf8"));
    const imza = crypto.sign(null, Buffer.from(`${onek}.${govde}`, "utf8"), ozelAnahtarOku(ozelB64));
    return `${onek}.${govde}.${b64u(imza)}`;
};
export const imzaliMetinCoz = (onek, metin, acikB64 = acikAnahtarB64) => {
    if (!acikB64)
        throw new LisansKoduGecersiz("ANAHTAR_YOK", "Programda lisans doğrulama anahtarı tanımlı değil.");
    const temiz = String(metin || "").replace(/\s+/g, "");
    const parca = temiz.split(".");
    if (parca.length !== 3 || parca[0] !== onek || !parca[1] || !parca[2]) {
        throw new LisansKoduGecersiz("BICIM", "Kod biçimi hatalı. Kodu eksiksiz yapıştırdığınızdan emin olun.");
    }
    let dogru = false;
    try {
        dogru = crypto.verify(null, Buffer.from(`${parca[0]}.${parca[1]}`, "utf8"), acikAnahtarOku(acikB64), Buffer.from(parca[2], "base64url"));
    }
    catch {
        dogru = false;
    }
    if (!dogru)
        throw new LisansKoduGecersiz("IMZA", "Kod doğrulanamadı (geçersiz veya değiştirilmiş).");
    try {
        return JSON.parse(Buffer.from(parca[1], "base64url").toString("utf8"));
    }
    catch {
        throw new LisansKoduGecersiz("BICIM", "Kod içeriği okunamadı.");
    }
};
const GUN = /^\d{4}-\d{2}-\d{2}$/;
export const lisansKoduUret = (veri, ozelB64) => imzaliMetinUret(LISANS_ONEKI, veri, ozelB64);
/** İmzayı ve alanların biçimini doğrular; içerik kurallarını (makine, tarih) kurulum servisi denetler. */
export const lisansKoduCoz = (kod, acikB64) => {
    const v = imzaliMetinCoz(LISANS_ONEKI, kod, acikB64);
    const alanlarDogru = v &&
        v.v === 1 &&
        typeof v.firmaKodu === "string" &&
        Number.isInteger(v.firmaId) &&
        Number.isInteger(v.lisansId) &&
        Number.isInteger(v.seri) &&
        (v.makine === null || typeof v.makine === "string") &&
        GUN.test(v.baslangic) &&
        GUN.test(v.bitis) &&
        Number.isInteger(v.kullaniciLimiti) &&
        v.kullaniciLimiti > 0 &&
        (v.moduller === null || Array.isArray(v.moduller)) &&
        !!v.iletisim;
    if (!alanlarDogru)
        throw new LisansKoduGecersiz("BICIM", "Kod içeriği eksik veya hatalı.");
    return v;
};

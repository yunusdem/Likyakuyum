/**
 * Çevrimdışı lisans imza anahtarı — sunucuda elle, BİR KEZ çalıştırılan komut.
 * docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 7.3
 *
 *   npm run lisans-anahtar
 *
 * Ed25519 anahtar çifti üretir:
 * - Özel anahtar ekrana YAZILMAZ; doğrudan Backend/.env.local dosyasına LISANS_OZEL_ANAHTAR olarak eklenir.
 *   Lisans kodlarını yalnızca bu anahtarı bilen sunucu üretebilir.
 * - Açık anahtar ekrana yazılır; gizli değildir, programa (ve kurulum paketine) gömülür.
 *
 * .env.local'de LISANS_OZEL_ANAHTAR zaten varsa yeni anahtar ÜRETMEZ (verilmiş tüm lisanslar geçersiz kalırdı);
 * yalnızca mevcut anahtarın açık anahtarını yeniden gösterir.
 */
import crypto from "crypto";
import fs from "fs";
import path from "path";
const ANAHTAR_ADI = "LISANS_OZEL_ANAHTAR";
const envYolu = () => {
    const adaylar = [process.cwd(), path.resolve(process.cwd(), "Backend")];
    for (const klasor of adaylar) {
        if (fs.existsSync(path.join(klasor, "package.json")) && fs.existsSync(path.join(klasor, "src", "app.ts"))) {
            return path.join(klasor, ".env.local");
        }
    }
    throw new Error("Backend klasörü bulunamadı. Komutu Backend klasöründe çalıştırın: npm run lisans-anahtar");
};
const mevcutDeger = (icerik) => {
    for (const satir of icerik.split(/\r?\n/)) {
        const m = satir.match(/^\s*LISANS_OZEL_ANAHTAR\s*=\s*(.*)\s*$/);
        if (m && m[1].trim())
            return m[1].trim();
    }
    return null;
};
const acikAnahtariYaz = (ozelBase64, yeni) => {
    const ozel = crypto.createPrivateKey({ key: Buffer.from(ozelBase64, "base64"), format: "der", type: "pkcs8" });
    if (ozel.asymmetricKeyType !== "ed25519")
        throw new Error(`${ANAHTAR_ADI} bir Ed25519 anahtarı değil.`);
    const acik = crypto.createPublicKey(ozel).export({ format: "der", type: "spki" }).toString("base64");
    const parmakIzi = crypto.createHash("sha256").update(acik).digest("hex").slice(0, 16).toUpperCase();
    console.log("");
    console.log(yeni ? "  Yeni lisans anahtarı üretildi ve .env.local dosyasına yazıldı." : "  Mevcut lisans anahtarı kullanılıyor (yeni anahtar üretilmedi).");
    console.log("");
    console.log("  AÇIK ANAHTAR (gizli değil, geliştiriciye iletin):");
    console.log("  " + acik);
    console.log("");
    console.log("  Parmak izi: " + parmakIzi);
    console.log("");
    if (yeni) {
        console.log("  ÖNEMLİ: Backend\\.env.local dosyasının bir yedeğini güvenli bir yere alın.");
        console.log("  Özel anahtar kaybolursa verilmiş lisanslar uzatılamaz; tüm kurulumlara yeni sürüm gerekir.");
        console.log("");
    }
};
const main = () => {
    const yol = envYolu();
    const icerik = fs.existsSync(yol) ? fs.readFileSync(yol, "utf8").replace(/^\uFEFF/, "") : "";
    const mevcut = mevcutDeger(icerik);
    if (mevcut) {
        acikAnahtariYaz(mevcut, false);
        return;
    }
    const { privateKey } = crypto.generateKeyPairSync("ed25519");
    const ozelBase64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
    const ek = (icerik.length > 0 && !icerik.endsWith("\n") ? "\r\n" : "") +
        "# Cevrimdisi lisans imza anahtari (npm run lisans-anahtar). DEGISTIRMEYIN, SILMEYIN; yedegini alin.\r\n" +
        `${ANAHTAR_ADI}=${ozelBase64}\r\n`;
    // BOM'suz yazılır: dotenv ilk satırdaki BOM'u anahtar adına katıyor.
    fs.writeFileSync(yol, icerik + ek, { encoding: "utf8" });
    // Yazılanı geri okuyup doğrula
    const kontrol = mevcutDeger(fs.readFileSync(yol, "utf8"));
    if (kontrol !== ozelBase64)
        throw new Error(".env.local dosyasına yazılan anahtar doğrulanamadı.");
    acikAnahtariYaz(ozelBase64, true);
};
try {
    main();
}
catch (err) {
    console.error("");
    console.error("  HATA: " + (err?.message || err));
    console.error("");
    process.exit(1);
}

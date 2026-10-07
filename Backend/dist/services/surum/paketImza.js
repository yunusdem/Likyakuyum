import crypto from "crypto";
import fs from "fs";
import path from "path";
import { acikAnahtarOku, lisansAcikAnahtari, ozelAnahtarOku } from "../lisans/lisansKodu.js";
/**
 * Sürüm paketi ve bütünlük listesi imzaları (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, K10, K19).
 * İmzalar lisans koduyla aynı Ed25519 anahtar çiftiyle atılır: özel anahtar yalnız merkezde, açık anahtar programa gömülü.
 */
export const sha256Dosya = async (dosya) => {
    // Küçük dosyalar tek seferde okunur (binlerce küçük dosyada akış açmak çok yavaş)
    const st = fs.statSync(dosya);
    if (st.size <= 1024 * 1024)
        return crypto.createHash("sha256").update(fs.readFileSync(dosya)).digest("hex");
    const h = crypto.createHash("sha256");
    for await (const p of fs.createReadStream(dosya, { highWaterMark: 1024 * 1024 }))
        h.update(p);
    return h.digest("hex");
};
export const sha256Metin = (m) => crypto.createHash("sha256").update(m).digest("hex");
const imzala = (metin, ozelB64) => crypto.sign(null, Buffer.from(metin, "utf8"), ozelAnahtarOku(ozelB64)).toString("base64");
const dogrula = (metin, imza, acikB64) => {
    try {
        return crypto.verify(null, Buffer.from(metin, "utf8"), acikAnahtarOku(acikB64), Buffer.from(imza, "base64"));
    }
    catch {
        return false;
    }
};
/** Paket imzası: "<sürüm>|<zip sha256>" */
export const paketImzala = (surum, sha256, ozelB64) => imzala(`${surum}|${sha256}`, ozelB64);
export const paketImzasiDogru = (surum, sha256, imza, acikB64 = lisansAcikAnahtari()) => !!acikB64 && dogrula(`${surum}|${sha256}`, imza, acikB64);
/** Bütünlüğe dahil klasörler (uygulama kökü = backend klasörü) */
export const BUTUNLUK_KLASORLERI = ["dist", "migrations", "node_modules"];
export const BUTUNLUK_DOSYALARI = ["package.json", "SURUM"];
const listeOzeti = (surum, dosyalar) => sha256Metin(JSON.stringify({ v: 1, surum, dosyalar }));
export const dosyalariTopla = (kok) => {
    const sonuc = [];
    const gez = (alt) => {
        let girdiler;
        try {
            girdiler = fs.readdirSync(path.join(kok, alt), { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const g of girdiler) {
            const gorece = `${alt}/${g.name}`.replace(/^\/+/, "");
            if (g.isDirectory())
                gez(gorece);
            else if (g.isFile())
                sonuc.push(gorece);
        }
    };
    for (const k of BUTUNLUK_KLASORLERI)
        gez(k);
    for (const d of BUTUNLUK_DOSYALARI)
        if (fs.existsSync(path.join(kok, d)))
            sonuc.push(d);
    return sonuc.sort();
};
export const butunlukListesiUret = async (kok, surum, ozelB64) => {
    const dosyalar = [];
    for (const d of dosyalariTopla(kok))
        dosyalar.push([d, await sha256Dosya(path.join(kok, d))]);
    return { v: 1, surum, dosyalar, imza: imzala(listeOzeti(surum, dosyalar), ozelB64) };
};
/**
 * Uygulama klasörünü listeye göre denetler. Hata varsa nedenini döndürür, sağlamsa null.
 * Listede olmayan fazladan bir dosya (ör. araya konmuş .js) de bozukluk sayılır.
 */
export const butunlukDenetle = async (kok, acikB64 = lisansAcikAnahtari(), 
/** Yalnız bu yolları denetle (ör. hızlı denetimde node_modules hariç); verilmezse hepsi */
kapsam = () => true) => {
    let liste;
    try {
        liste = JSON.parse(fs.readFileSync(path.join(kok, "BUTUNLUK.json"), "utf8"));
    }
    catch {
        return "BUTUNLUK.json bulunamadı veya okunamadı";
    }
    if (!liste || liste.v !== 1 || !Array.isArray(liste.dosyalar) || !liste.imza)
        return "BUTUNLUK.json hatalı";
    if (!acikB64 || !dogrula(listeOzeti(liste.surum, liste.dosyalar), liste.imza, acikB64))
        return "bütünlük listesinin imzası tutmuyor";
    const beklenen = new Map(liste.dosyalar.filter(([d]) => kapsam(d)));
    for (const d of dosyalariTopla(kok).filter(kapsam)) {
        const ozet = beklenen.get(d);
        if (!ozet)
            return `listede olmayan dosya: ${d}`;
        if ((await sha256Dosya(path.join(kok, d))) !== ozet)
            return `değiştirilmiş dosya: ${d}`;
        beklenen.delete(d);
    }
    if (beklenen.size > 0)
        return `eksik dosya: ${[...beklenen.keys()][0]}`;
    return null;
};

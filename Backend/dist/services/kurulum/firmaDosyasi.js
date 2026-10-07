import fs from "fs";
import path from "path";
import { env } from "../../config/env.config.js";
import { imzaliMetinCoz, imzaliMetinUret } from "../lisans/lisansKodu.js";
/**
 * firma.lky: kurulum paketine firmaya özel konan, merkezin imzaladığı kimlik dosyası (K14, K21).
 * Kurulum hangi firmaya ait olduğunu, merkez adresini ve merkeze kendini tanıtacağı anahtarı buradan öğrenir.
 * İmzalı olduğu için müşteri başka bir firmanın koduna çeviremez.
 */
export const FIRMA_DOSYASI_ONEKI = "LKYF";
export const firmaDosyasiUret = (veri, ozelB64) => imzaliMetinUret(FIRMA_DOSYASI_ONEKI, veri, ozelB64);
export const firmaDosyasiCoz = (metin, acikB64) => {
    const v = imzaliMetinCoz(FIRMA_DOSYASI_ONEKI, metin, acikB64);
    if (!v || v.v !== 1 || !v.firmaKodu || !Number.isInteger(v.firmaId) || !v.kurulumAnahtari) {
        throw new Error("firma.lky içeriği hatalı.");
    }
    return v;
};
export const veriYolu = (dosya) => path.join(env.VERI_KLASORU, dosya);
let onbellek = null;
/** Kurulumun firma bilgisi; dosya yoksa veya imzası tutmuyorsa null (hata nedeni `firmaDosyasiHatasi`). */
export const kurulumFirmasi = () => {
    if (onbellek && Date.now() - onbellek.zaman < 60_000)
        return onbellek.veri;
    let veri = null;
    let hata = null;
    try {
        veri = firmaDosyasiCoz(fs.readFileSync(veriYolu("firma.lky"), "utf8"));
    }
    catch (err) {
        hata = err?.code === "ENOENT" ? "firma.lky bulunamadı" : String(err?.message || err);
    }
    onbellek = { zaman: Date.now(), veri, hata };
    return veri;
};
export const firmaDosyasiHatasi = () => {
    kurulumFirmasi();
    return onbellek?.hata ?? null;
};
export const firmaDosyasiOnbelleginiTemizle = () => {
    onbellek = null;
};

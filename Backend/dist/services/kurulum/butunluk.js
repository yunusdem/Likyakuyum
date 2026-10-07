import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../../utils/logger.js";
import { butunlukDenetle } from "../surum/paketImza.js";
/**
 * Kurulum (exe) modunda program dosyalarının bütünlüğü (K19): dist, migrations, node_modules ve package.json,
 * merkezin imzaladığı BUTUNLUK.json listesiyle karşılaştırılır. Bir dosya değiştirilmiş, silinmiş ya da araya yeni
 * dosya eklenmişse lisans durumu KILITLI (BUTUNLUK_BOZUK) olur. Program güncellenince / yeniden kurulunca düzelir.
 */
const DENETIM_ARALIGI_MS = 60 * 60 * 1000;
const nodeModuluMu = (d) => d.startsWith("node_modules/");
/** Uygulama kökü: dist/services/kurulum (ya da src/services/kurulum) → backend klasörü */
export const uygulamaKoku = () => process.env.UYGULAMA_KOKU || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
/**
 * İki aşama: (1) program kodu (dist, migrations, package.json, SURUM) — birkaç yüz dosya, istek bunu bekler;
 * (2) node_modules — binlerce dosya, arka planda; bozukluk bulunursa sonraki istekte kilit.
 * Açılışta hiçbir istek dakikalarca beklemesin diye ikinci aşama istekleri bekletmez.
 */
let hizli = null;
let hizliSuruyor = null;
let tam = null;
let tamSuruyor = null;
let testKancasi = null;
/** Yalnız testler: bütünlük sonucunu sabitler (kaynak koddan çalışırken BUTUNLUK.json yoktur). */
export const butunlukTestKancasi = (fn) => {
    testKancasi = fn;
    hizli = null;
    tam = null;
};
const kaydet = (hata, tur) => {
    if (hata)
        logger.error(`[BUTUNLUK] Program dosyaları bozuk (${tur}): ${hata}`);
    return hata;
};
const tamDenetimiBaslat = () => {
    if (tamSuruyor || (tam && Date.now() - tam.zaman < DENETIM_ARALIGI_MS))
        return;
    tamSuruyor = butunlukDenetle(uygulamaKoku(), undefined, nodeModuluMu)
        .catch((err) => `bütünlük denetlenemedi: ${err?.message || err}`)
        .then((hata) => {
        tam = { zaman: Date.now(), hata };
        tamSuruyor = null;
        return kaydet(hata, "node_modules");
    });
};
export const butunlukHatasi = async () => {
    if (testKancasi)
        return testKancasi();
    if (!hizli || Date.now() - hizli.zaman >= DENETIM_ARALIGI_MS) {
        if (!hizliSuruyor) {
            hizliSuruyor = butunlukDenetle(uygulamaKoku(), undefined, (d) => !nodeModuluMu(d))
                .catch((err) => `bütünlük denetlenemedi: ${err?.message || err}`)
                .then((hata) => {
                hizli = { zaman: Date.now(), hata };
                hizliSuruyor = null;
                return kaydet(hata, "program");
            });
        }
        await hizliSuruyor;
    }
    tamDenetimiBaslat();
    return hizli.hata ?? tam?.hata ?? null;
};

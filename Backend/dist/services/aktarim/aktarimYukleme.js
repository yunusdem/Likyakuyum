import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { ApiError } from "../../utils/ApiError.js";
/**
 * Veri aktarımı — yedek dosyasının parça parça yüklenmesi (docs/VERITABANI_TASIMA_YOL_HARITASI.md, Faz 1, K5, K11).
 *
 * Klasör düzeni: <kök>\<yuklemeId>\
 *   durum.json        — yükleme bilgisi (dosya adı, boyut, alınan parçalar, sonuç)
 *   parcalar\000001   — gelen parçalar (birleştirilince silinir)
 *   kaynak.bak        — birleştirilmiş (zip ise içinden çıkarılmış) SQL Server yedeği
 *   rapor.json        — aktarım / doğrulama raporu (sonraki fazlar)
 * Yüklemeler 7 gün tutulur; sonra her yeni yüklemede ve açılışta silinir.
 */
export const PARCA_BOYUTU = 8 * 1024 * 1024;
export const EN_BUYUK_DOSYA = 5 * 1024 * 1024 * 1024;
export const SAKLAMA_GUN = 7;
const ID_KURALI = /^[a-f0-9]{24}$/;
/** SQL Server yedek dosyası (Microsoft Tape Format) "TAPE" ile başlar */
const YEDEK_IMZASI = Buffer.from("TAPE", "ascii");
const ZIP_IMZASI = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const simdi = () => new Date().toISOString();
const altiHane = (n) => String(n).padStart(6, "0");
export const dosyaAdiTemizle = (ad) => path.win32.basename(String(ad || "")).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 150) || "yedek.bak";
export const uzantiGecerli = (ad) => {
    const u = path.win32.extname(ad).toLowerCase();
    return u === ".bak" ? "bak" : u === ".zip" ? "zip" : null;
};
const ilkBaytlar = (dosya, n) => {
    const fd = fs.openSync(dosya, "r");
    try {
        const b = Buffer.alloc(n);
        const okunan = fs.readSync(fd, b, 0, n, 0);
        return b.subarray(0, okunan);
    }
    finally {
        fs.closeSync(fd);
    }
};
export const yedekImzasiVarMi = (dosya) => ilkBaytlar(dosya, 4).equals(YEDEK_IMZASI);
export const zipImzasiVarMi = (dosya) => ilkBaytlar(dosya, 4).equals(ZIP_IMZASI);
/** Windows 10+ ile gelen bsdtar zip (zip64 dahil) açar; ek kütüphane gerekmez. */
const zipAc = (zip, hedefKlasor) => new Promise((tamam, hata) => {
    const tar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
    execFile(tar, ["-xf", zip, "-C", hedefKlasor], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, _o, stderr) => err ? hata(new Error(`Zip açılamadı: ${String(stderr || err.message).slice(0, 300)}`)) : tamam());
});
const klasordekiBaklar = (kok) => {
    const sonuc = [];
    const gez = (k, derinlik) => {
        if (derinlik > 4)
            return;
        for (const g of fs.readdirSync(k, { withFileTypes: true })) {
            const tam = path.join(k, g.name);
            if (g.isDirectory())
                gez(tam, derinlik + 1);
            else if (g.isFile() && g.name.toLowerCase().endsWith(".bak"))
                sonuc.push(tam);
        }
    };
    gez(kok, 0);
    return sonuc;
};
export class AktarimYukleme {
    kok;
    constructor(kok) {
        this.kok = kok;
    }
    klasor(yuklemeId) {
        if (!ID_KURALI.test(yuklemeId))
            throw ApiError.badRequest("Geçersiz yükleme kimliği.");
        return path.join(this.kok, yuklemeId);
    }
    durumYaz(b) {
        const k = this.klasor(b.yuklemeId);
        const gecici = path.join(k, "durum.json.yeni");
        fs.writeFileSync(gecici, JSON.stringify(b, null, 2), "utf8");
        fs.renameSync(gecici, path.join(k, "durum.json"));
    }
    oku(yuklemeId) {
        const dosya = path.join(this.klasor(yuklemeId), "durum.json");
        if (!fs.existsSync(dosya))
            throw ApiError.notFound("Yükleme bulunamadı; süresi dolmuş olabilir.");
        return JSON.parse(fs.readFileSync(dosya, "utf8"));
    }
    /** Yeni yükleme açar. Önce süresi dolmuş yüklemeleri temizler. */
    baslat(girdi) {
        const dosyaAdi = dosyaAdiTemizle(girdi.dosyaAdi);
        if (!uzantiGecerli(dosyaAdi))
            throw ApiError.badRequest("Yalnız .bak (SQL Server yedeği) veya içinde .bak bulunan .zip yüklenebilir.");
        const boyut = Number(girdi.boyut);
        if (!Number.isFinite(boyut) || boyut <= 0)
            throw ApiError.badRequest("Dosya boyutu geçersiz.");
        if (boyut > EN_BUYUK_DOSYA)
            throw ApiError.badRequest("Dosya 5 GB'tan büyük olamaz.");
        fs.mkdirSync(this.kok, { recursive: true });
        this.eskileriTemizle();
        const yuklemeId = crypto.randomBytes(12).toString("hex");
        const k = path.join(this.kok, yuklemeId);
        fs.mkdirSync(path.join(k, "parcalar"), { recursive: true });
        const b = {
            yuklemeId,
            firmaId: girdi.firmaId,
            dosyaAdi,
            boyut,
            parcaBoyutu: PARCA_BOYUTU,
            parcaSayisi: Math.ceil(boyut / PARCA_BOYUTU),
            alinan: [],
            durum: "YUKLENIYOR",
            hata: null,
            yedekYolu: null,
            yedekBoyutu: null,
            baslangic: simdi(),
            bitis: null,
        };
        this.durumYaz(b);
        return b;
    }
    /** Bir parçayı yazar. sha256 verilirse parçanın bütünlüğü denetlenir. Aynı parça tekrar gelirse üstüne yazılır. */
    parcaYaz(yuklemeId, sira, veri, sha256) {
        const b = this.oku(yuklemeId);
        if (b.durum !== "YUKLENIYOR")
            throw ApiError.badRequest("Bu yükleme tamamlanmış ya da hatalı; yeniden başlatın.");
        if (!Number.isInteger(sira) || sira < 1 || sira > b.parcaSayisi)
            throw ApiError.badRequest("Parça sırası geçersiz.");
        if (!Buffer.isBuffer(veri) || veri.length === 0)
            throw ApiError.badRequest("Parça boş geldi.");
        const beklenen = sira < b.parcaSayisi ? b.parcaBoyutu : b.boyut - b.parcaBoyutu * (b.parcaSayisi - 1);
        if (veri.length !== beklenen)
            throw ApiError.badRequest(`Parça ${sira} boyutu hatalı (${veri.length}, beklenen ${beklenen}).`);
        if (sha256) {
            const ozet = crypto.createHash("sha256").update(veri).digest("hex");
            if (ozet.toLowerCase() !== String(sha256).toLowerCase())
                throw ApiError.badRequest(`Parça ${sira} bozuk geldi (özet uyuşmuyor); yeniden gönderilecek.`);
        }
        const dosya = path.join(this.klasor(yuklemeId), "parcalar", altiHane(sira));
        fs.writeFileSync(dosya + ".yeni", veri);
        fs.renameSync(dosya + ".yeni", dosya);
        // durum.json'u yeniden oku (paralel parçalar birbirini ezmesin): alınanlar diskteki parçalardan hesaplanır
        const guncel = this.oku(yuklemeId);
        guncel.alinan = this.diskteParcalar(yuklemeId);
        this.durumYaz(guncel);
        return guncel;
    }
    diskteParcalar(yuklemeId) {
        const k = path.join(this.klasor(yuklemeId), "parcalar");
        if (!fs.existsSync(k))
            return [];
        return fs
            .readdirSync(k)
            .filter((a) => /^\d{6}$/.test(a))
            .map(Number)
            .sort((x, y) => x - y);
    }
    /** Parçaları birleştirir, zip ise içinden .bak'ı çıkarır, yedek imzasını denetler. */
    async bitir(yuklemeId) {
        const b = this.oku(yuklemeId);
        if (b.durum === "HAZIR")
            return b;
        if (b.durum !== "YUKLENIYOR")
            throw ApiError.badRequest(b.hata || "Yükleme hatalı.");
        const k = this.klasor(yuklemeId);
        const parcalar = this.diskteParcalar(yuklemeId);
        const eksik = [];
        for (let i = 1; i <= b.parcaSayisi; i++)
            if (!parcalar.includes(i))
                eksik.push(i);
        if (eksik.length)
            throw ApiError.badRequest(`Eksik parça var: ${eksik.slice(0, 10).join(", ")}${eksik.length > 10 ? "…" : ""}`);
        const tur = uzantiGecerli(b.dosyaAdi);
        const birlesik = path.join(k, tur === "zip" ? "kaynak.zip" : "kaynak.bak");
        try {
            const fd = fs.openSync(birlesik, "w");
            try {
                for (let i = 1; i <= b.parcaSayisi; i++) {
                    const p = path.join(k, "parcalar", altiHane(i));
                    fs.writeSync(fd, fs.readFileSync(p));
                }
            }
            finally {
                fs.closeSync(fd);
            }
            const boyut = fs.statSync(birlesik).size;
            if (boyut !== b.boyut)
                throw new Error(`Birleşen dosya boyutu tutmuyor (${boyut} / ${b.boyut}).`);
            fs.rmSync(path.join(k, "parcalar"), { recursive: true, force: true });
            let yedek = birlesik;
            if (tur === "zip") {
                if (!zipImzasiVarMi(birlesik))
                    throw new Error("Dosya geçerli bir zip değil.");
                const acilan = path.join(k, "zip");
                fs.mkdirSync(acilan, { recursive: true });
                await zipAc(birlesik, acilan);
                const baklar = klasordekiBaklar(acilan);
                if (baklar.length === 0)
                    throw new Error("Zip içinde .bak dosyası yok.");
                if (baklar.length > 1)
                    throw new Error(`Zip içinde birden çok .bak var (${baklar.map((x) => path.basename(x)).join(", ")}); her yedeği ayrı yükleyin.`);
                yedek = path.join(k, "kaynak.bak");
                fs.renameSync(baklar[0], yedek);
                fs.rmSync(acilan, { recursive: true, force: true });
                fs.rmSync(birlesik, { force: true });
            }
            if (!yedekImzasiVarMi(yedek))
                throw new Error("Dosya bir SQL Server yedeği (.bak) değil.");
            b.alinan = parcalar;
            b.durum = "HAZIR";
            b.yedekYolu = yedek;
            b.yedekBoyutu = fs.statSync(yedek).size;
            b.bitis = simdi();
            this.durumYaz(b);
            return b;
        }
        catch (err) {
            b.durum = "HATA";
            b.hata = String(err?.message || err).slice(0, 500);
            b.bitis = simdi();
            this.durumYaz(b);
            throw ApiError.badRequest(b.hata);
        }
    }
    /** Verilen yüklemeye rapor/ek dosya yazar (aktarım raporu vb.). */
    dosyaYaz(yuklemeId, ad, icerik) {
        if (!/^[a-z0-9_.-]{1,60}$/i.test(ad))
            throw new Error("Geçersiz dosya adı.");
        const dosya = path.join(this.klasor(yuklemeId), ad);
        fs.writeFileSync(dosya, icerik, "utf8");
        return dosya;
    }
    dosyaOku(yuklemeId, ad) {
        if (!/^[a-z0-9_.-]{1,60}$/i.test(ad))
            return null;
        const dosya = path.join(this.klasor(yuklemeId), ad);
        return fs.existsSync(dosya) ? fs.readFileSync(dosya, "utf8") : null;
    }
    sil(yuklemeId) {
        fs.rmSync(this.klasor(yuklemeId), { recursive: true, force: true });
    }
    /** Firmanın yüklemeleri (en yeni önce). */
    listele(firmaId) {
        if (!fs.existsSync(this.kok))
            return [];
        const sonuc = [];
        for (const ad of fs.readdirSync(this.kok)) {
            if (!ID_KURALI.test(ad))
                continue;
            try {
                const b = this.oku(ad);
                if (firmaId === undefined || firmaId === null || b.firmaId === firmaId)
                    sonuc.push(b);
            }
            catch {
                /* bozuk durum dosyası: temizlikte gider */
            }
        }
        return sonuc.sort((x, y) => (x.baslangic < y.baslangic ? 1 : -1));
    }
    /** SAKLAMA_GUN'den eski yüklemeleri siler; silinen kimlikleri döndürür. */
    eskileriTemizle(simdiMs = Date.now()) {
        if (!fs.existsSync(this.kok))
            return [];
        const sinir = simdiMs - SAKLAMA_GUN * 24 * 3600 * 1000;
        const silinen = [];
        for (const ad of fs.readdirSync(this.kok)) {
            if (!ID_KURALI.test(ad))
                continue;
            const k = path.join(this.kok, ad);
            let zaman;
            try {
                const b = JSON.parse(fs.readFileSync(path.join(k, "durum.json"), "utf8"));
                zaman = Date.parse(b.bitis || b.baslangic);
            }
            catch {
                try {
                    zaman = fs.statSync(k).mtimeMs;
                }
                catch {
                    continue;
                }
            }
            if (Number.isFinite(zaman) && zaman < sinir) {
                fs.rmSync(k, { recursive: true, force: true });
                silinen.push(ad);
            }
        }
        return silinen;
    }
}

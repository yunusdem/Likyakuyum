import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { env } from "../../config/env.config.js";
import { logger } from "../../utils/logger.js";
import { calisanSurum } from "../../utils/surum.js";
import { paketImzasiDogru, sha256Dosya } from "../surum/paketImza.js";
import { KurulumBildirim } from "./kurulumBildirim.js";
import { kurulumFirmasi, veriYolu } from "./firmaDosyasi.js";
import { uygulamaKoku } from "./butunluk.js";
const klasor = () => veriYolu("guncelleme");
const bekleyenYolu = () => path.join(klasor(), "bekleyen.json");
/** Kurulum kökü: {app}\uygulama\backend → {app} */
export const kurulumKoku = () => process.env.KURULUM_KOKU || path.resolve(uygulamaKoku(), "..", "..");
let suruyor = false;
let planlayici = async (zip, surum, hemen) => {
    const betik = path.join(kurulumKoku(), "araclar", "guncelleme-planla.ps1");
    await new Promise((tamam, hata) => {
        const p = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", betik, "-Zip", zip, "-Surum", surum, ...(hemen ? ["-Hemen"] : [])], {
            windowsHide: true,
        });
        let cikti = "";
        p.stdout.on("data", (d) => (cikti += d));
        p.stderr.on("data", (d) => (cikti += d));
        p.on("error", hata);
        p.on("close", (kod) => (kod === 0 ? tamam() : hata(new Error(`Güncelleme planlanamadı (${kod}): ${cikti.slice(-400)}`))));
    });
};
/** Yalnız testler: planlama adımını değiştirir (Görev Zamanlayıcı yerine). */
export const guncelleyiciTestKancasi = (fn) => {
    planlayici = fn;
};
export const bekleyenGuncelleme = () => {
    try {
        const b = JSON.parse(fs.readFileSync(bekleyenYolu(), "utf8"));
        return fs.existsSync(b.dosya) ? b : null;
    }
    catch {
        return null;
    }
};
export const sonGuncellemeSonucu = () => {
    try {
        return JSON.parse(fs.readFileSync(path.join(klasor(), "sonuc.json"), "utf8").replace(/^\uFEFF/, ""));
    }
    catch {
        return null;
    }
};
/** Güncelleme betiği çalışıyor mu (guncelle.ps1 başta yazar, sonda siler; 2 saatten eskisi yarım kalmış sayılır) */
const ISARET_GECERLILIK_MS = 2 * 60 * 60 * 1000;
export const guncellemeSuruyor = (simdi = new Date()) => {
    try {
        const st = fs.statSync(path.join(klasor(), "uygulaniyor.json"));
        return simdi.getTime() - st.mtimeMs < ISARET_GECERLILIK_MS;
    }
    catch {
        return false;
    }
};
/** Kaçan gece güncellemesi şimdi uygulanmalı mı (bkz. Guncelleyici.kacanGuncellemeyiUygula) */
const kacanUygulanabilir = (simdi) => {
    const b = bekleyenGuncelleme();
    if (!b || guncellemeSuruyor(simdi))
        return false;
    const s = sonGuncellemeSonucu();
    if (s && s.surum === b.surum && !s.basarili)
        return false;
    const plan = new Date(b.zaman);
    if (Number.isNaN(plan.getTime()))
        return false;
    const gece = new Date(plan);
    gece.setHours(3, 0, 0, 0);
    if (gece <= plan)
        gece.setDate(gece.getDate() + 1);
    return simdi >= gece;
};
export class Guncelleyici {
    /** Yeni sürümü indirir, doğrular ve gece güncellemesini planlar. Aynı sürüm zaten bekliyorsa yalnız planı yeniler. */
    static async hazirla(g, merkez, fetchFn = fetch) {
        if (!g?.surum || g.surum === calisanSurum())
            return null;
        if (suruyor)
            return null;
        suruyor = true;
        try {
            fs.mkdirSync(klasor(), { recursive: true });
            const mevcut = bekleyenGuncelleme();
            if (mevcut && mevcut.surum === g.surum && mevcut.sha256 === g.sha256) {
                await planlayici(mevcut.dosya, mevcut.surum, false);
                return mevcut;
            }
            if (!paketImzasiDogru(g.surum, g.sha256, g.imza))
                throw new Error("Güncelleme bilgisinin imzası tutmuyor.");
            const firma = kurulumFirmasi();
            if (!firma)
                throw new Error("firma.lky yok.");
            const gecici = path.join(klasor(), "indiriliyor.zip");
            const r = await fetchFn(`${merkez.replace(/\/+$/, "")}/api/v1${g.yol}`, {
                headers: { "x-likya-firma": firma.firmaKodu, "x-likya-anahtar": firma.kurulumAnahtari },
            });
            if (!r.ok || !r.body)
                throw new Error(`Paket indirilemedi (HTTP ${r.status}).`);
            const yaz = fs.createWriteStream(gecici);
            for await (const parca of r.body) {
                if (!yaz.write(Buffer.from(parca)))
                    await new Promise((t) => yaz.once("drain", () => t()));
            }
            await new Promise((t, h) => yaz.end((e) => (e ? h(e) : t())));
            const sha = await sha256Dosya(gecici);
            if (sha !== g.sha256 || fs.statSync(gecici).size !== g.boyut) {
                fs.rmSync(gecici, { force: true });
                throw new Error("İndirilen paketin özeti tutmuyor.");
            }
            const dosya = path.join(klasor(), `${g.surum.replace(/[^A-Za-z0-9.+-]/g, "_")}.zip`);
            for (const f of fs.readdirSync(klasor()))
                if (f.endsWith(".zip") && path.join(klasor(), f) !== gecici)
                    fs.rmSync(path.join(klasor(), f), { force: true });
            fs.renameSync(gecici, dosya);
            const b = { surum: g.surum, dosya, sha256: sha, zaman: new Date().toISOString() };
            fs.writeFileSync(bekleyenYolu(), JSON.stringify(b), "utf8");
            await planlayici(dosya, g.surum, false);
            logger.info(`[GUNCELLEME] ${g.surum} indirildi; gece 03:00'te uygulanacak.`);
            return b;
        }
        catch (err) {
            logger.error(`[GUNCELLEME] ${g?.surum} hazırlanamadı: ${err?.message}`);
            throw err;
        }
        finally {
            suruyor = false;
        }
    }
    /** Bekleyen güncellemeyi hemen uygular (program yeniden başlar). */
    static async simdiUygula() {
        const b = bekleyenGuncelleme();
        if (!b)
            throw new Error("Bekleyen güncelleme yok.");
        if (guncellemeSuruyor())
            throw new Error("Güncelleme şu an uygulanıyor.");
        await planlayici(b.dosya, b.surum, true);
        return b;
    }
    /**
     * Sürüm paketindeki kurulum betikleri ({app}\uygulama\araclar) kurulumun araclar klasörüne yazılır. Güncelleyici ve
     * planlayıcı oradan çalışır; paket yalnız uygulama klasörünü değiştirdiği için betik düzeltmeleri yeniden kurulum
     * olmadan ulaşmıyordu. Yalnız farklı olan .ps1 dosyaları yazılır; hata programı durdurmaz.
     */
    static betikleriEsitle() {
        try {
            const kaynak = path.join(uygulamaKoku(), "..", "araclar");
            const hedef = path.join(kurulumKoku(), "araclar");
            if (!fs.existsSync(kaynak) || !fs.existsSync(hedef))
                return;
            for (const ad of fs.readdirSync(kaynak)) {
                if (!ad.toLowerCase().endsWith(".ps1"))
                    continue;
                const yeni = fs.readFileSync(path.join(kaynak, ad));
                const yol = path.join(hedef, ad);
                if (fs.existsSync(yol) && fs.readFileSync(yol).equals(yeni))
                    continue;
                fs.writeFileSync(yol, yeni);
                logger.info(`[GUNCELLEME] Kurulum betiği yenilendi: ${ad}`);
            }
        }
        catch (err) {
            logger.warn(`[GUNCELLEME] Kurulum betikleri yenilenemedi: ${err?.message}`);
        }
    }
    /**
     * Gece 03:00 kaçtıysa (bilgisayar kapalıydı) bekleyen güncelleme program açılır açılmaz uygulanır: bu an kimse programı
     * kullanmıyordur. Görev Zamanlayıcı'nın "kaçırınca çalıştır" seçeneği gün içinde rastgele bir anda programı
     * kapatıyordu. Uygulanmaz: aynı sürümün son denemesi başarısızsa (eski sürüme dönülmüşse) ya da güncelleme betiği şu an
     * çalışıyorsa (programı o başlattı; geri dönüşte eski süreç sonuç yazılmadan açılıp aynı sürümü yeniden uygulatıyor,
     * güncelle/geri dön döngüsü kuruyordu). 15 sn sonra uygulamadan önce aynı denetim yinelenir.
     */
    static kacanGuncellemeyiUygula(simdi = new Date()) {
        if (!kacanUygulanabilir(simdi))
            return false;
        logger.info(`[GUNCELLEME] ${bekleyenGuncelleme().surum} gece uygulanamamış (bilgisayar kapalıydı); açılışta uygulanıyor.`);
        setTimeout(() => {
            if (!kacanUygulanabilir(new Date()))
                return;
            void this.simdiUygula().catch((err) => logger.error(`[GUNCELLEME] Açılışta uygulanamadı: ${err?.message}`));
        }, 15_000).unref();
        return true;
    }
    static baslat() {
        if (!env.KURULUM_MODU)
            return;
        this.betikleriEsitle();
        this.kacanGuncellemeyiUygula();
        KurulumBildirim.guncellemeDinle((g, merkez) => void this.hazirla(g, merkez).catch(() => undefined));
        const s = sonGuncellemeSonucu();
        if (s)
            logger.info(`[GUNCELLEME] Son güncelleme: ${s.surum} ${s.basarili ? "başarılı" : "BAŞARISIZ"} — ${s.mesaj}`);
    }
}

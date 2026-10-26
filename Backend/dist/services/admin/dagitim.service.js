import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { env } from "../../config/env.config.js";
import { adminYapilandirildiMi } from "../../config/adminDb.config.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { DagitimSqlRepository } from "../../models/admin/dagitimSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { gitCommit } from "../../utils/surum.js";
import { mailGonder, mailYapilandirildiMi } from "../mail.service.js";
const KILIT_DAKIKA = 60;
const klasor = () => env.DAGITIM_KLASORU;
export const dagitimAyariOku = () => {
    try {
        const a = JSON.parse(fs.readFileSync(path.join(klasor(), "ayar.json"), "utf8"));
        if (!a?.canli?.kok || !a?.test?.kok)
            return null;
        return a;
    }
    catch {
        return null;
    }
};
const durumDosyasiOku = () => {
    try {
        return JSON.parse(fs.readFileSync(path.join(klasor(), "durum.json"), "utf8"));
    }
    catch {
        return null;
    }
};
const git = (ayar, kok, args, saniye = 30) => new Promise((resolve, reject) => {
    execFile(ayar.git || "git", ["-C", kok, ...args], { timeout: saniye * 1000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err)
            return reject(new Error((stderr || err.message || "git hatası").toString().trim().slice(0, 400)));
        resolve(stdout.toString());
    });
});
const commitListesi = (metin) => metin
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
    const [commit, kisa, yazar, tarih, ...baslik] = l.split("\u001f");
    return { commit, kisa, yazar, tarih, baslik: baslik.join("\u001f") };
});
const LOG_BICIM = "--format=%H%x1f%h%x1f%an%x1f%cs%x1f%s";
const ozet = async (ayar, kok, commit) => {
    if (!commit)
        return null;
    try {
        return commitListesi(await git(ayar, kok, ["log", "-n", "1", LOG_BICIM, commit], 15))[0] ?? null;
    }
    catch {
        return null;
    }
};
/** Ortamın ÇALIŞAN backend'inin commit'i (sağlık ucu); ulaşılamazsa null */
const calisanCommitiOku = async (port) => {
    try {
        const r = await fetch(`http://127.0.0.1:${port}/api/v1/health`, { signal: AbortSignal.timeout(4000) });
        const j = await r.json();
        const c = String(j?.data?.commit || "");
        return /^[0-9a-f]{40}$/.test(c) ? c : null;
    }
    catch {
        return null;
    }
};
/**
 * Kart çalışan sürümü gösterir (yarım kalmış bir kurulumda diskteki HEAD ileride olabilir; o zaman "disk" ayrıca verilir).
 * Backend kapalıysa diskteki HEAD gösterilir, "calismiyor" işaretlenir.
 */
const ortamDurumu = async (ayar, o) => {
    const disk = gitCommit(o.kok);
    const calisan = await calisanCommitiOku(o.port);
    const commit = calisan || disk;
    return {
        commit,
        kisa: commit ? commit.slice(0, 9) : null,
        ozet: await ozet(ayar, o.kok, commit),
        diskCommit: disk && calisan && disk !== calisan ? disk : null,
        calismiyor: !calisan,
    };
};
const pidYasiyorMu = (pid) => {
    if (!pid)
        return false;
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
};
export class DagitimService {
    static izleyici = null;
    static async durum(uzagiYenile = true) {
        const ayar = dagitimAyariOku();
        const bos = { commit: null, kisa: null, ozet: null };
        const tabloVar = adminYapilandirildiMi() && (await DagitimSqlRepository.kuruluMu());
        const d = {
            ortam: env.ORTAM,
            kurulu: !!ayar && tabloVar,
            kurulumNotu: !ayar
                ? `${path.join(klasor(), "ayar.json")} bulunamadı ya da eksik (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md §7).`
                : !tabloVar
                    ? "ADM_DAGITIM tablosu yok (docs/sql/LIKYA_ADMIN_DAGITIM.sql)."
                    : null,
            canli: bos,
            test: bos,
            uzak: bos,
            canliyaGidecek: [],
            testeGidecek: [],
            uzakHata: null,
            calisan: null,
            gecmis: [],
        };
        if (tabloVar) {
            d.calisan = await DagitimSqlRepository.calisan();
            d.gecmis = await DagitimSqlRepository.gecmis(30);
        }
        if (!ayar)
            return d;
        d.canli = await ortamDurumu(ayar, ayar.canli);
        d.test = await ortamDurumu(ayar, ayar.test);
        try {
            if (uzagiYenile)
                await git(ayar, ayar.test.kok, ["fetch", "origin", "--quiet"], 60);
            const uzakCommit = (await git(ayar, ayar.test.kok, ["rev-parse", "origin/main"], 15)).trim() || null;
            d.uzak = { commit: uzakCommit, kisa: uzakCommit ? uzakCommit.slice(0, 9) : null, ozet: await ozet(ayar, ayar.test.kok, uzakCommit) };
            if (d.test.commit && uzakCommit && d.test.commit !== uzakCommit)
                d.testeGidecek = commitListesi(await git(ayar, ayar.test.kok, ["log", "-n", "100", LOG_BICIM, `${d.test.commit}..${uzakCommit}`], 20));
            if (d.canli.commit && d.test.commit && d.canli.commit !== d.test.commit)
                d.canliyaGidecek = commitListesi(await git(ayar, ayar.test.kok, ["log", "-n", "100", LOG_BICIM, `${d.canli.commit}..${d.test.commit}`], 20));
        }
        catch (err) {
            d.uzakHata = String(err?.message || err);
        }
        return d;
    }
    static async baslat(admin, hedef) {
        const ayar = dagitimAyariOku();
        if (!ayar)
            throw new ApiError(400, "Dağıtım ayarı yok: sunucuda ayar.json yazılmalı (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md §7).");
        if (!(await DagitimSqlRepository.kuruluMu()))
            throw new ApiError(400, "ADM_DAGITIM tablosu yok (docs/sql/LIKYA_ADMIN_DAGITIM.sql).");
        // Aynı anda tek dağıtım: tabloda CALISIYOR kayıt ya da betiğin canlı süreci varsa beklenir
        const calisan = await DagitimSqlRepository.calisan();
        if (calisan) {
            const dakika = (Date.now() - new Date(calisan.baslangic).getTime()) / 60000;
            const dosya = durumDosyasiOku();
            const yasiyor = dosya?.id === calisan.dagitimId && dosya?.durum === "CALISIYOR" && pidYasiyorMu(dosya.pid);
            if (yasiyor || dakika < KILIT_DAKIKA)
                throw new ApiError(409, `Dağıtım #${calisan.dagitimId} (${calisan.hedef}) hâlâ çalışıyor; bitmesini bekleyin.`);
            await DagitimSqlRepository.bitir(calisan.dagitimId, "HATA", "Betikten sonuç gelmedi (zaman aşımı); kayıt kapatıldı.", null, null);
        }
        // Önceki = hedefin ÇALIŞAN sürümü (yarım kalmış kurulumda diskteki ileride olabilir)
        const hedefOrtam = hedef === "canli" ? ayar.canli : ayar.test;
        const oncekiCommit = (await calisanCommitiOku(hedefOrtam.port)) || gitCommit(hedefOrtam.kok);
        let hedefCommit;
        if (hedef === "canli") {
            // Canlıya testte ÇALIŞAN sürüm gider; test backend kapalıysa test kopyasındaki kod
            const testCommit = (await calisanCommitiOku(ayar.test.port)) || gitCommit(ayar.test.kok);
            if (!testCommit)
                throw new ApiError(400, "Test kopyasının commit'i okunamadı.");
            if (testCommit === oncekiCommit)
                throw new ApiError(400, "Canlı zaten testteki sürümde.");
            hedefCommit = testCommit;
        }
        else {
            hedefCommit = "origin/main";
        }
        const logKlasoru = path.join(klasor(), "log");
        fs.mkdirSync(logKlasoru, { recursive: true });
        const id = await DagitimSqlRepository.ekle({
            hedef,
            hedefCommit: hedef === "canli" ? hedefCommit : null,
            oncekiCommit,
            baslatanAdminId: admin.adminId,
            baslatan: admin.adSoyad || admin.kullaniciAdi,
            logDosyasi: path.join(logKlasoru, `${hedef}-${id_ad()}.log`),
        });
        const kayit = (await DagitimSqlRepository.getir(id));
        const logDosyasi = kayit.logDosyasi || path.join(logKlasoru, `${id}.log`);
        const istek = { id, hedef, commit: hedefCommit, baslatan: kayit.baslatan, logDosyasi, zaman: new Date().toISOString() };
        fs.writeFileSync(path.join(klasor(), "istek.json"), JSON.stringify(istek, null, 2), "utf8");
        // Eski durum.json yeni isteğin sonucu sanılmasın
        try {
            fs.unlinkSync(path.join(klasor(), "durum.json"));
        }
        catch {
            /* yok */
        }
        try {
            await new Promise((resolve, reject) => {
                execFile("schtasks.exe", ["/Run", "/TN", ayar.gorev || "LikyaDagitim"], { timeout: 20000, windowsHide: true }, (err, _o, stderr) => err ? reject(new Error((stderr || err.message).toString().trim().slice(0, 300))) : resolve());
            });
        }
        catch (err) {
            await DagitimSqlRepository.bitir(id, "HATA", `Görev başlatılamadı: ${err?.message}`, null, null);
            throw new ApiError(500, `Görev Zamanlayıcı görevi (${ayar.gorev || "LikyaDagitim"}) başlatılamadı: ${err?.message}`);
        }
        await AdminLogSqlRepository.islemLogu({ adminId: admin.adminId, islem: "DAGITIM_BASLATILDI", hedefTur: "DAGITIM", hedefId: id, yeni: { hedef, hedefCommit, oncekiCommit } });
        logger.info(`[DAGITIM] #${id} ${hedef} başlatıldı (${admin.kullaniciAdi}); hedef ${hedefCommit}`);
        DagitimService.izlemeyeBasla();
        return kayit;
    }
    static async log(id) {
        const kayit = await DagitimSqlRepository.getir(id);
        if (!kayit)
            throw new ApiError(404, "Dağıtım kaydı bulunamadı.");
        let log = "";
        if (kayit.logDosyasi) {
            try {
                log = fs.readFileSync(kayit.logDosyasi, "utf8");
            }
            catch {
                log = "";
            }
        }
        return { kayit, log };
    }
    static async ozet() {
        if (!adminYapilandirildiMi() || !(await DagitimSqlRepository.kuruluMu()))
            return { calisan: false, gorulmemisHata: 0 };
        return { calisan: !!(await DagitimSqlRepository.calisan()), gorulmemisHata: await DagitimSqlRepository.gorulmemisHata() };
    }
    static async goruldu() {
        if (await DagitimSqlRepository.kuruluMu())
            await DagitimSqlRepository.goruldu();
    }
    /** Açılışta ve her başlatmada: CALISIYOR kayıt varken durum.json 3 sn'de bir okunur, bitince tablo ve mail. */
    static izlemeyeBasla() {
        if (DagitimService.izleyici)
            return;
        DagitimService.izleyici = setInterval(() => void DagitimService.yokla(), 3000);
        DagitimService.izleyici.unref?.();
    }
    static baslat_acilis() {
        if (env.KURULUM_MODU || !adminYapilandirildiMi())
            return;
        void (async () => {
            try {
                if ((await DagitimSqlRepository.kuruluMu()) && (await DagitimSqlRepository.calisan()))
                    DagitimService.izlemeyeBasla();
            }
            catch (err) {
                logger.warn(`[DAGITIM] Açılış kontrolü yapılamadı: ${err?.message}`);
            }
        })();
    }
    static async yokla() {
        try {
            const calisan = await DagitimSqlRepository.calisan();
            if (!calisan) {
                if (DagitimService.izleyici)
                    clearInterval(DagitimService.izleyici);
                DagitimService.izleyici = null;
                return;
            }
            const d = durumDosyasiOku();
            if (!d || d.id !== calisan.dagitimId) {
                // Betik hiç başlamadıysa ya da çok uzun sürdüyse kayıt kapatılır
                const dakika = (Date.now() - new Date(calisan.baslangic).getTime()) / 60000;
                if (dakika > KILIT_DAKIKA)
                    await DagitimService.bitir(calisan, "HATA", "Betikten sonuç gelmedi (zaman aşımı).", null, null);
                return;
            }
            if (d.durum === "CALISIYOR" || !d.durum) {
                if (d.adim && d.adim !== calisan.adim)
                    await DagitimSqlRepository.ilerle(calisan.dagitimId, d.adim, d.mesaj || null);
                if (!pidYasiyorMu(d.pid) && d.bitis === undefined) {
                    const dakika = (Date.now() - new Date(calisan.baslangic).getTime()) / 60000;
                    if (dakika > 2)
                        await DagitimService.bitir(calisan, "HATA", `Betik beklenmedik şekilde kapandı (son adım: ${d.adim || "-"}).`, d.oncekiCommit || null, null);
                }
                return;
            }
            const durum = ["BASARILI", "HATA", "GERI_DONDU", "GERI_DONUS_HATASI"].includes(d.durum)
                ? d.durum
                : "HATA";
            await DagitimService.bitir(calisan, durum, d.mesaj || null, d.oncekiCommit || null, d.yeniCommit || null);
        }
        catch (err) {
            logger.warn(`[DAGITIM] İzleme hatası: ${err?.message}`);
        }
    }
    static async bitir(k, durum, mesaj, onceki, yeni) {
        await DagitimSqlRepository.bitir(k.dagitimId, durum, mesaj, onceki, yeni);
        logger[durum === "BASARILI" ? "info" : "error"](`[DAGITIM] #${k.dagitimId} ${k.hedef}: ${durum} — ${mesaj || ""}`);
        await AdminLogSqlRepository.islemLogu({ adminId: null, islem: "DAGITIM_BITTI", hedefTur: "DAGITIM", hedefId: k.dagitimId, yeni: { hedef: k.hedef, durum, mesaj } });
        await DagitimService.mailAt(k, durum, mesaj, yeni);
    }
    static async mailAt(k, durum, mesaj, yeni) {
        if (!mailYapilandirildiMi())
            return;
        const kime = env.DAGITIM_EPOSTA || env.ILETISIM_ALICI;
        if (!kime)
            return;
        const hedefAd = k.hedef === "canli" ? "CANLI (likyaerp.com, likyakuyum.com)" : "TEST (developer.likyakuyum.com)";
        const basarili = durum === "BASARILI";
        const durumMetni = {
            CALISIYOR: "Çalışıyor",
            BASARILI: "Başarılı",
            HATA: "HATA — kurulum yapılamadı",
            GERI_DONDU: "HATA — önceki sürüme geri dönüldü",
            GERI_DONUS_HATASI: "HATA — geri dönüş de başarısız, ELLE MÜDAHALE GEREKİR",
        };
        const konu = `${basarili ? "Dağıtım tamam" : "DAĞITIM HATASI"}: ${hedefAd} #${k.dagitimId}`;
        const satirlar = [
            `Hedef: ${hedefAd}`,
            `Durum: ${durumMetni[durum]}`,
            `Başlatan: ${k.baslatan || "-"}`,
            `Önceki commit: ${k.oncekiCommit || "-"}`,
            `Yeni commit: ${yeni || k.hedefCommit || "-"}`,
            mesaj ? `Mesaj: ${mesaj}` : null,
            `Log: ${k.logDosyasi || "-"}`,
            `Panel: ${env.ADMIN_PANEL_URL}/dagitim`,
        ].filter(Boolean);
        const metin = satirlar.join("\n");
        const html = `<div style="font-family:Arial,sans-serif;font-size:14px"><h3 style="color:${basarili ? "#198754" : "#dc3545"}">${konu}</h3>${satirlar
            .map((s) => `<div>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`)
            .join("")}</div>`;
        try {
            await mailGonder({ kime, konu, html, metin });
        }
        catch (err) {
            logger.warn(`[DAGITIM] Bildirim maili gönderilemedi: ${err?.message}`);
        }
    }
}
const id_ad = () => {
    const t = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}-${p(t.getHours())}${p(t.getMinutes())}${p(t.getSeconds())}`;
};

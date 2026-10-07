import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import sql from "mssql";
import { env } from "../../config/env.config.js";
import { getAdminPool } from "../../config/adminDb.config.js";
import { AyarSqlRepository } from "../../models/admin/ayarSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { trZaman } from "../../utils/zaman.utils.js";
import { ZipYazici, klasorEkle } from "../../utils/zip.js";
import { klasorKopyala } from "../../utils/dosya.utils.js";
import { enYuksekGoc, gocDosyalari, semaGocUygula } from "../semaGoc.service.js";
import { kd, klonIle, klonYapilandirildiMi } from "../admin/klon.service.js";
import { butunlukListesiUret, paketImzala, sha256Dosya } from "./paketImza.js";
import { DestekService } from "../destek/destek.service.js";
/** 1.0.0+20261006.153012 (Türkiye saati; aynı dakikada iki yayın çakışmasın diye saniyeli) */
export const surumAdi = (pkgSurum, an = new Date()) => {
    const z = trZaman(an);
    const sn = String(an.getUTCSeconds()).padStart(2, "0");
    return `${pkgSurum}+${z.gun.replace(/-/g, "")}.${String(z.saat).padStart(2, "0")}${String(z.dakika).padStart(2, "0")}${sn}`;
};
// fs.cpSync yerine (bkz. utils/dosya.utils.ts); bağlantı klasörlerinin içeriği alınır
const kopyala = (kaynak, hedef) => klasorKopyala(kaynak, hedef);
export const surumYayinla = async (s) => {
    const log = s.log ?? (() => undefined);
    if (!env.LISANS_OZEL_ANAHTAR)
        throw new Error("LISANS_OZEL_ANAHTAR tanımlı değil (npm run lisans-anahtar).");
    if (!fs.existsSync(path.join(s.backendKok, "dist", "server.js")))
        throw new Error("Backend derlenmemiş: önce npm run build.");
    if (!fs.existsSync(path.join(s.webKok, "index.html")))
        throw new Error(`Arayüz derlenmemiş: ${s.webKok}\\index.html yok (kökte npm run build).`);
    const pkg = JSON.parse(fs.readFileSync(path.join(s.backendKok, "package.json"), "utf8"));
    const surum = surumAdi(String(pkg.version || "1.0.0"));
    const klasor = s.surumKlasoru || (await AyarSqlRepository.oku("SURUM_KLASORU"));
    const hazirlik = path.join(klasor, "hazirlik", surum.replace(/[^A-Za-z0-9.+-]/g, "_"));
    const be = path.join(hazirlik, "backend");
    fs.rmSync(hazirlik, { recursive: true, force: true });
    fs.mkdirSync(be, { recursive: true });
    try {
        log(`Sürüm ${surum} hazırlanıyor…`);
        kopyala(path.join(s.backendKok, "dist"), path.join(be, "dist"));
        kopyala(path.join(s.backendKok, "migrations"), path.join(be, "migrations"));
        // Belge ve rapor şablonları çalışma anında okunur (services/belge/belgeMotor.ts)
        for (const k of ["belge", "rapor"]) {
            if (fs.existsSync(path.join(s.backendKok, k))) {
                klasorKopyala(path.join(s.backendKok, k), path.join(be, k), (f) => !f.toLowerCase().endsWith(".md"));
            }
        }
        fs.copyFileSync(path.join(s.backendKok, "package.json"), path.join(be, "package.json"));
        fs.writeFileSync(path.join(be, "SURUM"), surum, "utf8");
        if (s.mevcutModuller) {
            log("node_modules kopyalanıyor (mevcut)…");
            kopyala(path.join(s.backendKok, "node_modules"), path.join(be, "node_modules"));
        }
        else {
            log("Üretim bağımlılıkları kuruluyor (npm ci --omit=dev)…");
            fs.copyFileSync(path.join(s.backendKok, "package-lock.json"), path.join(be, "package-lock.json"));
            const r = spawnSync("npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], {
                cwd: be,
                shell: true,
                encoding: "utf8",
                maxBuffer: 64 * 1024 * 1024,
            });
            if (r.status !== 0)
                throw new Error(`npm ci başarısız: ${(r.stderr || r.stdout || "").slice(-800)}`);
            fs.rmSync(path.join(be, "package-lock.json"), { force: true });
        }
        log("Bütünlük listesi imzalanıyor…");
        const liste = await butunlukListesiUret(be, surum, env.LISANS_OZEL_ANAHTAR);
        fs.writeFileSync(path.join(be, "BUTUNLUK.json"), JSON.stringify(liste), "utf8");
        fs.mkdirSync(klasor, { recursive: true });
        const zipYolu = path.join(klasor, `${surum}.zip`);
        log("ZIP yazılıyor…");
        const zip = new ZipYazici(zipYolu);
        let adet = await klasorEkle(zip, be, "backend");
        adet += await klasorEkle(zip, s.webKok, "web", (g) => g.toLowerCase() === "web.config");
        await zip.bitir();
        const sha256 = await sha256Dosya(zipYolu);
        const imza = paketImzala(surum, sha256, env.LISANS_OZEL_ANAHTAR);
        const boyut = fs.statSync(zipYolu).size;
        const sonuc = { surum, zip: zipYolu, boyut, sha256, imza, dosyaSayisi: adet, sema: { hedef: enYuksekGoc(), firmalar: [] } };
        if (!s.kuru && !s.semaAtla)
            sonuc.sema = await semaYay(log);
        if (!s.kuru) {
            const pool = await getAdminPool();
            await pool
                .request()
                .input("surum", sql.VarChar(30), surum)
                .input("yol", sql.NVarChar(400), zipYolu)
                .input("boyut", sql.BigInt, boyut)
                .input("sha", sql.Char(64), sha256)
                .input("imza", sql.VarChar(200), imza)
                .input("sema", sql.Int, enYuksekGoc())
                .input("not", sql.NVarChar(2000), s.not ?? null)
                .query(`INSERT INTO dbo.ADM_SURUM (SURUM, DOSYA_YOLU, BOYUT, SHA256, IMZA, SEMA_SURUMU, NOTLAR) VALUES (@surum, @yol, @boyut, @sha, @imza, @sema, @not)`);
            await AdminLogSqlRepository.islemLogu({ adminId: null, islem: "SURUM_YAYINLANDI", hedefTur: "SURUM", hedefId: surum, yeni: { boyut, dosya: adet, sema: sonuc.sema } });
            await DestekService.surumTaslagi(surum, s.not ?? null); // K10: admin panelinde taslak bildirim
        }
        return sonuc;
    }
    finally {
        fs.rmSync(hazirlik, { recursive: true, force: true });
    }
};
/** Göçleri şablona ve bulut firmalarına uygular, şablon yedeğini yeniler. Bir firmadaki hata diğerlerini durdurmaz. */
export const semaYay = async (log = () => undefined) => {
    const dosyalar = gocDosyalari();
    const sonuc = { hedef: enYuksekGoc(dosyalar), firmalar: [] };
    if (!klonYapilandirildiMi()) {
        sonuc.sablon = "atlandı (klonlama hesabı yok)";
        return sonuc;
    }
    try {
        const r = await klonIle("LIKYA_SABLON", (pool) => semaGocUygula(pool, dosyalar));
        if (r.uygulanan.length) {
            const yedek = await AyarSqlRepository.oku("SABLON_YEDEK_DOSYASI");
            await klonIle("master", (pool) => pool.request().input("yol", sql.NVarChar(400), yedek).query(`BACKUP DATABASE ${kd("LIKYA_SABLON")} TO DISK = @yol WITH INIT, FORMAT, CHECKSUM`));
        }
        sonuc.sablon = r.uygulanan.length ? `güncellendi (${r.uygulanan.join(", ")}), yedek yenilendi` : "güncel";
    }
    catch (err) {
        sonuc.sablon = `HATA: ${err?.message}`;
    }
    log(`Şablon: ${sonuc.sablon}`);
    const pool = await getAdminPool();
    const firmalar = (await pool.request().query(`SELECT FIRMA_ID, FIRMA_KODU, DB_NAME FROM dbo.ADM_FIRMA WHERE BAGLANTI_MODU = 'cloud' AND DURUM IN ('AKTIF','DONDURULMUS','PASIF','SILINECEK')`)).recordset;
    for (const f of firmalar) {
        try {
            const r = await klonIle(f.DB_NAME, (p) => semaGocUygula(p, dosyalar));
            await pool.request().input("id", sql.Int, f.FIRMA_ID).input("s", sql.Int, r.sonraki).query(`UPDATE dbo.ADM_FIRMA SET SEMA_SURUMU = @s WHERE FIRMA_ID = @id`);
            sonuc.firmalar.push({ firmaKodu: f.FIRMA_KODU, sonuc: r.uygulanan.length ? `güncellendi: ${r.uygulanan.join(", ")}` : "güncel" });
        }
        catch (err) {
            sonuc.firmalar.push({ firmaKodu: f.FIRMA_KODU, sonuc: `HATA: ${String(err?.message || err).slice(0, 200)}` });
        }
        log(`${f.FIRMA_KODU}: ${sonuc.firmalar[sonuc.firmalar.length - 1].sonuc}`);
    }
    return sonuc;
};

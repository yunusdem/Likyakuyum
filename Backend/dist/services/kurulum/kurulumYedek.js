import fs from "fs";
import path from "path";
import sql from "mssql";
import { env } from "../../config/env.config.js";
import { logger } from "../../utils/logger.js";
import { trZaman } from "../../utils/zaman.utils.js";
import { ZipYazici, klasorEkle } from "../../utils/zip.js";
import { uygulamaKoku } from "./butunluk.js";
import { veriYolu } from "./firmaDosyasi.js";
import { kurulumDbContext, kurulumHavuzu } from "./kurulumDb.js";
/**
 * Kurulumda (exe) firma veritabanının yedeği (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md 15.1, Y1–Y5).
 *
 * Her gün bir tam yedek: Türkiye saatiyle 02:00'den sonra o gün yedek yoksa alınır (bilgisayar gece kapalıysa açıldıktan
 * ~2 dk sonra). SQL Server yedeği kendi yedek klasörüne yazar (veri klasörüne yazma yetkisi yok), program (SYSTEM)
 * dosyayı `<veri>\yedek`'e taşır; yanına Belgeler klasörünün zip'i konur. Son 7 gün tutulur. Firma Tanımları'ndaki
 * Yedek Klasörü / İkinci Yedek Klasörü doluysa iki dosya oraya da kopyalanır; yazılamazsa yedek yine alınmış sayılır.
 */
export const SAKLANAN_GUN = 7;
/** SQL Server Express'te veritabanı başına veri dosyası sınırı (MB) */
export const VT_SINIR_MB = 10 * 1024;
export const VT_UYARI_MB = Math.round(VT_SINIR_MB * 0.8);
const YEDEK_SAATI = 2;
const ILK_DENETIM_MS = 2 * 60 * 1000;
const DENETIM_ARALIGI_MS = 10 * 60 * 1000;
const HATA_BEKLEME_MS = 60 * 60 * 1000;
const YEDEK_ZAMAN_ASIMI_MS = 30 * 60 * 1000;
const BOS_DURUM = {
    sonYedek: null,
    sonGun: null,
    dosya: null,
    boyut: null,
    belgeler: null,
    hedefler: [],
    hata: null,
    hataZamani: null,
    vtBoyutMb: null,
};
export const yedekKlasoru = () => veriYolu("yedek");
const durumYolu = () => path.join(yedekKlasoru(), "durum.json");
/** Kurulum kökü ({app}); guncelleyici.ts'deki kurulumKoku ile aynı (döngüsel içe aktarma olmasın diye burada) */
const belgelerKlasoru = () => path.join(process.env.KURULUM_KOKU || path.resolve(uygulamaKoku(), "..", ".."), "Belgeler");
let testSqlKlasoru = null;
let testBelgeler = null;
/** Yalnız testler: SQL yedek klasörünü ve Belgeler kökünü değiştirir. */
export const yedekTestKancasi = (k) => {
    if (k.sqlKlasoru !== undefined)
        testSqlKlasoru = k.sqlKlasoru;
    if (k.belgeler !== undefined)
        testBelgeler = k.belgeler;
};
/** Uzun süren SQL komutları için zaman aşımı (havuzun varsayılanı 30 sn; tip tanımında ikinci parametre yok) */
const uzunIstek = (pool, ms) => new sql.Request(pool, { requestTimeout: ms });
export const yedekDurumu = () => {
    try {
        return { ...BOS_DURUM, ...JSON.parse(fs.readFileSync(durumYolu(), "utf8").replace(/^\uFEFF/, "")) };
    }
    catch {
        return { ...BOS_DURUM };
    }
};
const durumYaz = (d) => {
    fs.mkdirSync(yedekKlasoru(), { recursive: true });
    const gecici = `${durumYolu()}.yeni`;
    fs.writeFileSync(gecici, JSON.stringify(d), "utf8");
    fs.renameSync(gecici, durumYolu());
};
/** Firma veritabanının veri dosyası boyutu (MB); Express sınırı bu boyuta uygulanır. */
export const vtBoyutuMb = async () => {
    try {
        const pool = await kurulumHavuzu();
        const r = await pool.request().query(`SELECT CAST(SUM(CAST(size AS bigint)) * 8 / 1024 AS int) AS MB FROM sys.database_files WHERE type_desc = 'ROWS'`);
        const mb = r.recordset[0]?.MB;
        return mb === null || mb === undefined ? null : Number(mb);
    }
    catch {
        return null;
    }
};
/** Yedek dosyaları (yeniden eskiye): `<VT>_YYYY-MM-DD.bak`, `Belgeler_YYYY-MM-DD.zip`, güncelleme öncesi `once-*.bak` */
export const yedekDosyalari = (klasor = yedekKlasoru()) => {
    try {
        return fs
            .readdirSync(klasor, { withFileTypes: true })
            .filter((g) => g.isFile() && /\.(bak|zip)$/i.test(g.name))
            .map((g) => {
            const st = fs.statSync(path.join(klasor, g.name));
            return { ad: g.name, boyut: st.size, zaman: st.mtime.toISOString() };
        })
            .sort((a, b) => b.zaman.localeCompare(a.zaman));
    }
    catch {
        return [];
    }
};
const desenler = () => {
    const vt = dosyaAdiParcasi(env.KURULUM_DB_NAME || "LIKYA");
    return [new RegExp(`^${vt}_\\d{4}-\\d{2}-\\d{2}\\.bak$`, "i"), /^Belgeler_\d{4}-\d{2}-\d{2}\.zip$/i];
};
const dosyaAdiParcasi = (s) => s.replace(/[^A-Za-z0-9_-]/g, "_");
/** Klasörde her desen için en yeni `SAKLANAN_GUN` dosya kalır (adlar tarihli; ada göre sıralanır). */
const eskileriSil = async (klasor) => {
    let adlar = [];
    try {
        adlar = await fs.promises.readdir(klasor);
    }
    catch {
        return;
    }
    for (const d of desenler()) {
        const eski = adlar.filter((a) => d.test(a)).sort().reverse().slice(SAKLANAN_GUN);
        for (const a of eski)
            await fs.promises.rm(path.join(klasor, a), { force: true }).catch(() => undefined);
    }
};
const tasi = async (kaynak, hedef) => {
    try {
        await fs.promises.rename(kaynak, hedef);
    }
    catch (err) {
        if (err?.code !== "EXDEV" && err?.code !== "EPERM")
            throw err;
        await fs.promises.copyFile(kaynak, hedef);
        await fs.promises.rm(kaynak, { force: true });
    }
};
/** Firma Tanımları'ndaki ek yedek klasörleri (boş olmayan, mutlak yol: C:\… ya da \\sunucu\paylaşım\…) */
const ekHedefler = async () => {
    try {
        const pool = await kurulumHavuzu();
        const r = await pool.request().query(`SELECT TOP 1 YEDEK_KLASORU AS K1, IKINCI_YEDEK_KLASORU AS K2 FROM dbo.TODVZ_TANIM`);
        const satir = r.recordset[0] || {};
        const ana = path.resolve(yedekKlasoru()).toLowerCase();
        const sonuc = [];
        for (const k of [satir.K1, satir.K2].map((x) => String(x ?? "").trim()).filter(Boolean)) {
            if (!/^[A-Za-z]:\\/.test(k) && !/^\\\\[^\\]+\\[^\\]+/.test(k))
                continue;
            const tam = path.resolve(k);
            if (tam.toLowerCase() === ana || sonuc.some((s) => s.toLowerCase() === tam.toLowerCase()))
                continue;
            sonuc.push(tam);
        }
        return sonuc;
    }
    catch {
        return [];
    }
};
/** Ek hedefe yazılamama nedeni (ekranda görünür; ham "ENOENT … mkdir" yerine) */
const hedefHatasi = (err) => {
    switch (err?.code) {
        case "ENOENT":
        case "ENOTDIR":
            return "Klasöre ulaşılamadı (USB bellek takılı değil ya da yol yok).";
        case "EPERM":
        case "EACCES":
            return "Klasöre yazma izni yok.";
        case "ENOSPC":
            return "Diskte yer kalmadı.";
        case "EBUSY":
            return "Dosya kullanımda.";
        default:
            return String(err?.message || err);
    }
};
let suruyor = null;
export class KurulumYedek {
    static suruyorMu() {
        return !!suruyor;
    }
    /** Yedeği alır (aynı anda tek). Hata durum dosyasına yazılır ve fırlatılır. */
    static yedekAl(neden = "elle") {
        if (suruyor)
            return suruyor;
        suruyor = this.calistir(neden).finally(() => {
            suruyor = null;
        });
        return suruyor;
    }
    static async calistir(neden) {
        const onceki = yedekDurumu();
        const simdi = new Date();
        const gun = trZaman(simdi).gun;
        const vt = env.KURULUM_DB_NAME || kurulumDbContext().dbName;
        const klasor = yedekKlasoru();
        try {
            await fs.promises.mkdir(klasor, { recursive: true });
            const pool = await kurulumHavuzu();
            let sqlKlasor = testSqlKlasoru;
            if (!sqlKlasor) {
                const r = await pool.request().query(`SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(400)) AS K`);
                sqlKlasor = String(r.recordset[0]?.K || "").trim();
            }
            if (!sqlKlasor)
                throw new Error("SQL Server'ın yedek klasörü bulunamadı.");
            const gecici = path.join(sqlKlasor, "likya_gunluk.bak");
            await uzunIstek(pool, YEDEK_ZAMAN_ASIMI_MS)
                .input("vt", sql.NVarChar(128), vt)
                .input("yol", sql.NVarChar(400), gecici)
                .query(`BACKUP DATABASE @vt TO DISK = @yol WITH COPY_ONLY, INIT, CHECKSUM`);
            const dosya = `${dosyaAdiParcasi(vt)}_${gun}.bak`;
            const hedef = path.join(klasor, dosya);
            await tasi(gecici, hedef);
            const boyut = (await fs.promises.stat(hedef)).size;
            // Belgeler (PDF arşivi, resimler, fiş şablonları): veritabanıyla aynı diskte; yedeğe girer
            let belgeler = null;
            const belgeKok = testBelgeler || belgelerKlasoru();
            if (fs.existsSync(belgeKok)) {
                const zipAd = `Belgeler_${gun}.zip`;
                const zipYol = path.join(klasor, zipAd);
                try {
                    const zip = new ZipYazici(`${zipYol}.yeni`);
                    await klasorEkle(zip, belgeKok, "Belgeler");
                    await zip.bitir();
                    await fs.promises.rename(`${zipYol}.yeni`, zipYol);
                    belgeler = { dosya: zipAd, boyut: (await fs.promises.stat(zipYol)).size, hata: null };
                }
                catch (err) {
                    await fs.promises.rm(`${zipYol}.yeni`, { force: true }).catch(() => undefined);
                    belgeler = { dosya: null, boyut: null, hata: String(err?.message || err) };
                    logger.warn(`[YEDEK] Belgeler klasörü arşivlenemedi: ${err?.message}`);
                }
            }
            await eskileriSil(klasor);
            // Ek hedefler (USB / ağ): yazılamazsa uyarı
            const hedefler = [];
            for (const ek of await ekHedefler()) {
                try {
                    await fs.promises.mkdir(ek, { recursive: true });
                    await fs.promises.copyFile(hedef, path.join(ek, dosya));
                    if (belgeler?.dosya)
                        await fs.promises.copyFile(path.join(klasor, belgeler.dosya), path.join(ek, belgeler.dosya));
                    await eskileriSil(ek);
                    hedefler.push({ klasor: ek, basarili: true, mesaj: null });
                }
                catch (err) {
                    hedefler.push({ klasor: ek, basarili: false, mesaj: hedefHatasi(err) });
                    logger.warn(`[YEDEK] Ek yedek klasörüne yazılamadı (${ek}): ${err?.message}`);
                }
            }
            const d = {
                sonYedek: simdi.toISOString(),
                sonGun: gun,
                dosya,
                boyut,
                belgeler,
                hedefler,
                hata: null,
                hataZamani: null,
                vtBoyutMb: await vtBoyutuMb(),
            };
            durumYaz(d);
            logger.info(`[YEDEK] Yedek alındı (${neden}): ${dosya} (${Math.round(boyut / 1024 / 1024)} MB)`);
            return d;
        }
        catch (err) {
            const mesaj = String(err?.message || err);
            const d = { ...onceki, hata: mesaj, hataZamani: simdi.toISOString(), vtBoyutMb: (await vtBoyutuMb()) ?? onceki.vtBoyutMb };
            try {
                durumYaz(d);
            }
            catch {
                /* durum yazılamasa da hata bildirilir */
            }
            logger.error(`[YEDEK] Yedek alınamadı (${neden}): ${mesaj}`);
            throw err;
        }
    }
    /** Bugünün yedeği gerekli mi: 02:00'den sonra, bugün yedek yok, son hatanın üstünden 1 saat geçmiş. */
    static yedekGerekli(an = new Date(), d = yedekDurumu()) {
        const z = trZaman(an);
        if (z.saat < YEDEK_SAATI || d.sonGun === z.gun)
            return false;
        if (d.hataZamani && an.getTime() - Date.parse(d.hataZamani) < HATA_BEKLEME_MS && an.getTime() >= Date.parse(d.hataZamani))
            return false;
        return true;
    }
    static baslat() {
        if (!env.KURULUM_MODU)
            return;
        const denetle = () => {
            if (suruyor || !this.yedekGerekli())
                return;
            void this.yedekAl("gece").catch(() => undefined);
        };
        setTimeout(denetle, ILK_DENETIM_MS).unref();
        setInterval(denetle, DENETIM_ARALIGI_MS).unref();
    }
}

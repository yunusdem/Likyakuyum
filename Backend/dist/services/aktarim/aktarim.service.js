import crypto from "crypto";
import path from "path";
import sql from "mssql";
import { AyarSqlRepository } from "../../models/admin/ayarSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { KullaniciSqlRepository } from "../../models/admin/kullaniciSql.repository.js";
import { IzlemeSqlRepository } from "../../models/admin/izlemeSql.repository.js";
import { veritabaniHavuzlariniKapat } from "../../config/mssql.config.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { FirmaService } from "../admin/firma.service.js";
import { klonHavuzu, klonYapilandirildiMi } from "../admin/klon.service.js";
import { AktarimYukleme } from "./aktarimYukleme.js";
import { geciciAc, geciciHazirMi, geciciSil, geciciVarMi, incele, setSec, sunucuAnaSurumu, yedekBasligi, yedekEngelleri } from "./aktarimInceleme.js";
import { AktarimDogrulamaHatasi, AktarimEngeli, aktar, planHazirla } from "./aktarimMotoru.js";
import { DOKUNULMAZ_TABLOLAR, SABLON_KALIR_TABLOLARI } from "./aktarimPlani.js";
import { n, q } from "./aktarimSema.js";
import { dogrula } from "./aktarimDogrulama.js";
import { ciftKontrolleri, digerVeritabaniKurali } from "./aktarimCift.js";
import { aktarimBildirimi, sonKontrol, sonKontrolOzeti } from "./aktarimSonKontrol.js";
import { firmaDbIleCalistir } from "../admin/firmaBaglanti.service.js";
import { ciftSecenekleri, standartEkAdimlar } from "./aktarimCli.js";
import { BOS_GECMIS, canliFirmaEngelleri, eBelgeGonderimi, izYenile, sonradanKullanim } from "./aktarimIzi.js";
/**
 * Admin paneli: firmanın içinden eski programın yedeğini yükleyip aktarma (docs/VERITABANI_TASIMA_YOL_HARITASI.md, K6).
 * Yüklemeler <YEDEK_KLASORU>\Aktarim altında tutulur (SQL Server bu klasörü okuyabilmeli, bölüm 6).
 * İnceleme, aktarım ve doğrulama arka planda iş olarak çalışır; panel işin durumunu sorar. Bir firmada aynı anda tek iş.
 * Sonuçlar yükleme klasöründe JSON (inceleme.json, rapor.json, dogrulama.json) ve işlem kaydında tutulur.
 */
export const aktarimKoku = async () => path.win32.join(await AyarSqlRepository.oku("YEDEK_KLASORU"), "Aktarim");
const yukleyici = async () => new AktarimYukleme(await aktarimKoku());
/** Aktarım yalnız sunucumuzdaki (bulut) ve silinmemiş firmaya yapılır. */
export const aktarilabilirFirma = async (firmaId) => {
    const firma = await FirmaService.getir(firmaId);
    if (firma.baglantiModu !== "cloud") {
        throw ApiError.badRequest("Panelden veri aktarımı yalnız sunucumuzdaki (bulut) firmalara yapılır. Kurulum (exe) firmalarında programın Kurulum ekranı kullanılır.");
    }
    if (firma.durum === "SILINECEK" || firma.durum === "SILINDI")
        throw ApiError.badRequest("Firma silinmiş ya da silinmek üzere.");
    return firma;
};
const yuklemeFirmaDenetimi = (b, firmaId) => {
    if (b.firmaId !== firmaId)
        throw ApiError.notFound("Yükleme bu firmaya ait değil.");
    return b;
};
export const geciciDbAdi = (yuklemeId) => `LKY_AKTARIM_${yuklemeId}`;
const isler = new Map();
const calisanFirmalar = new Set();
const AKTARIM_ZAMAN_ASIMI_MS = 4 * 60 * 60 * 1000;
/**
 * ekKilit: çift aktarımında eş firma. Aktarım eşin veritabanına da yazar (yetki, fiş eşlemesi, tetikler); iki taraf aynı anda
 * çalışırsa kilitlenip biri geri alınırdı. Eş de iş bitene kadar meşgul sayılır.
 */
const isBaslat = (firmaId, yuklemeId, tur, calis, ekKilit = []) => {
    if (calisanFirmalar.has(firmaId))
        throw ApiError.conflict("Bu firmada şu anda bir aktarım işi çalışıyor; bitmesini bekleyin.");
    if (ekKilit.some((f) => calisanFirmalar.has(f)))
        throw ApiError.conflict("Eş firmada şu anda bir aktarım işi çalışıyor; bitmesini bekleyin.");
    for (const f of [firmaId, ...ekKilit])
        calisanFirmalar.add(f);
    const is = {
        isId: crypto.randomBytes(8).toString("hex"),
        firmaId,
        yuklemeId,
        tur,
        durum: "CALISIYOR",
        adim: "BASLA",
        yuzde: 0,
        mesaj: "Başlatıldı",
        baslangic: new Date().toISOString(),
        bitis: null,
        hata: null,
    };
    isler.set(is.isId, is);
    void (async () => {
        try {
            await calis(is);
            is.durum = "BITTI";
            is.yuzde = 100;
        }
        catch (err) {
            is.durum = "HATA";
            is.hata = String(err?.message || err).slice(0, 1000);
            logger.error(`[AKTARIM] ${tur} firma ${firmaId} / ${yuklemeId}: ${is.hata}`);
        }
        finally {
            is.bitis = new Date().toISOString();
            for (const f of [firmaId, ...ekKilit])
                calisanFirmalar.delete(f);
            // Eski işleri bellekten at (son 50)
            if (isler.size > 50)
                for (const k of [...isler.keys()].slice(0, isler.size - 50))
                    isler.delete(k);
        }
    })();
    return is;
};
const ilerle = (is, adim, yuzde, mesaj) => Object.assign(is, { adim, yuzde, mesaj });
/** Hazır yüklemenin yedeğini geçici veritabanı olarak açar (zaten açıksa dokunmaz). */
const geciciHazirla = async (pool, b, is) => {
    if (b.durum !== "HAZIR" || !b.yedekYolu)
        throw ApiError.badRequest("Yükleme tamamlanmamış.");
    await sahipsizGecicileriSil(pool, await yukleyici());
    ilerle(is, "BASLIK", 3, "Yedek başlığı okunuyor");
    const setler = await yedekBasligi(pool, b.yedekYolu);
    const engeller = yedekEngelleri(setler, await sunucuAnaSurumu(pool));
    const set = setSec(setler);
    const gecici = geciciDbAdi(b.yuklemeId);
    if (!set || engeller.some((e) => e.seviye === "ENGEL"))
        return { set: set ?? setler[0], engeller, gecici };
    // Yarım açılmış (giremediğimiz ya da salt okunur olmayan) geçici veritabanı kaldırılıp yeniden açılır
    if ((await geciciVarMi(pool, gecici)) && !(await geciciHazirMi(pool, gecici))) {
        ilerle(is, "AC", 6, "Yarım kalmış geçici veritabanı kaldırılıyor");
        await geciciSil(pool, gecici);
    }
    if (!(await geciciVarMi(pool, gecici))) {
        ilerle(is, "AC", 8, "Yedek geçici olarak açılıyor");
        await geciciAc(pool, b.yedekYolu, gecici, set.position);
    }
    return { set, engeller, gecici };
};
const havuz = () => klonHavuzu("master", { requestTimeoutMs: AKTARIM_ZAMAN_ASIMI_MS });
/** Yüklemesi silinmiş / süresi dolmuş yüklemelerin geçici veritabanlarını kaldırır (işlerin başında, hata yutulur). */
const sahipsizGecicileriSil = async (pool, y) => {
    const silinen = [];
    try {
        y.eskileriTemizle();
        const adlar = (await new sql.Request(pool).query(`SELECT name AS N FROM sys.databases WHERE name LIKE 'LKY[_]AKTARIM[_]%'`)).recordset.map((x) => String(x.N));
        const calisan = new Set([...isler.values()].filter((i) => i.durum === "CALISIYOR").map((i) => i.yuklemeId));
        for (const ad of adlar) {
            const id = ad.slice("LKY_AKTARIM_".length);
            if (!/^[a-f0-9]{24}$/.test(id) || calisan.has(id))
                continue;
            let var_ = true;
            try {
                y.oku(id);
            }
            catch {
                var_ = false;
            }
            if (!var_) {
                await geciciSil(pool, ad);
                silinen.push(ad);
            }
        }
    }
    catch (err) {
        logger.warn(`[AKTARIM] sahipsiz geçici veritabanı temizliği: ${err?.message}`);
    }
    return silinen;
};
const jsonOku = (y, yuklemeId, ad) => {
    const m = y.dosyaOku(yuklemeId, ad);
    return m ? JSON.parse(m) : null;
};
/**
 * Başarılı aktarımın raporu ayrıca rapor_basarili.json'a yazılır: aynı yüklemede sonradan başarısız (ya da kilide takılan) bir deneme
 * rapor.json'ın üstüne yazar; canlı firma kilidinin (K24) iz tutmayan önceki sürüm için dayandığı satır sayıları kaybolmasın.
 */
const BASARILI_RAPOR = "rapor_basarili.json";
/** Önceki sürümün yazdığı başarılı rapor.json'ı, üstüne yazılmadan önce rapor_basarili.json olarak saklar. */
const basariliRaporuSakla = (y, yuklemeId) => {
    if (y.dosyaOku(yuklemeId, BASARILI_RAPOR))
        return;
    const r = jsonOku(y, yuklemeId, "rapor.json");
    if (r?.basarili && r.aktarim)
        y.dosyaYaz(yuklemeId, BASARILI_RAPOR, JSON.stringify(r));
};
/** Firmaya yapılmış son başarılı aktarımın izleri (K24): yükleme raporları, yoksa merkez işlem kaydı. */
const aktarimGecmisi = async (y, firmaId) => {
    let son = null;
    for (const b of y.listele(firmaId)) {
        for (const ad of [BASARILI_RAPOR, "rapor.json"]) {
            const r = jsonOku(y, b.yuklemeId, ad);
            if (r?.basarili && r.aktarim && (!son || String(r.aktarim.bitis) > String(son.aktarim.bitis)))
                son = r;
        }
    }
    if (son?.aktarim) {
        return {
            zaman: son.aktarim.bitis,
            iz: son.aktarim.iz ?? null,
            tablolar: son.aktarim.tablolar,
            korunanKullanici: son.aktarim.korunanKullanicilar?.length ?? 0,
            kayitVar: true,
        };
    }
    // Yükleme silinmiş / 7 günlük saklama dolmuş: merkez kaydı okunamazsa kilit iz ve e-belge denetimiyle sürer
    const zaman = await AktarimService.aktarimKaydi(firmaId).catch((err) => {
        logger.warn(`[AKTARIM] firma ${firmaId}: merkez işlem kaydı okunamadı: ${err?.message}`);
        return null;
    });
    return { ...BOS_GECMIS, zaman, kayitVar: !!zaman };
};
/**
 * Yanlış firmaya yedek koruması (simülasyonda bulundu, 17.11.2026): R'nin yedeği A firmasına bırakılınca yalnız genel
 * "firmada fiş var" uyarısı çıkıyordu. Şimdi:
 *  - firmanın VKN'si ile yedekteki VKN farklıysa,
 *  - bu firmaya daha önce FARKLI bir eski veritabanı başarıyla aktarıldıysa,
 *  - bu yedek (aynı eski veritabanı + VKN) daha önce BAŞKA bir firmaya aktarıldıysa
 * YANLIS_FIRMA engeli verilir; yönetici "bu yedeğin bu firmaya ait olduğunu kontrol ettim" (firmaOnay) ile geçebilir.
 */
export const yanlisFirmaSuphesi = (y, firma, ozet, yuklemeId, firmaKodlari) => {
    const e = [];
    const db = ozet.yedek.dbAdi.trim().toUpperCase();
    const vkn = (ozet.firma.vkn || "").trim();
    if (firma.vknTckn && vkn && firma.vknTckn.trim() !== vkn) {
        e.push({ kod: "YANLIS_FIRMA", seviye: "ENGEL", mesaj: `Firmanın VKN'si (${firma.vknTckn}) yedekteki VKN'den (${vkn}) farklı. Yedek bu firmaya ait olmayabilir.` });
    }
    for (const b of y.listele()) {
        if (b.yuklemeId === yuklemeId || b.durum !== "HAZIR")
            continue;
        const r = jsonOku(y, b.yuklemeId, "rapor.json");
        if (!r?.basarili)
            continue;
        const ins = jsonOku(y, b.yuklemeId, "inceleme.json");
        const eskiDb = (ins?.ozet?.yedek.dbAdi || "").trim().toUpperCase();
        if (!eskiDb)
            continue;
        const zaman = new Date(r.zaman).toLocaleString("tr-TR");
        if (b.firmaId === firma.firmaId && eskiDb !== db) {
            e.push({
                kod: "YANLIS_FIRMA",
                seviye: "ENGEL",
                mesaj: `Bu firmaya ${zaman} tarihinde ${ins.ozet.yedek.dbAdi} aktarıldı; bu yedek ${ozet.yedek.dbAdi}. Yanlış firmaya yüklüyor olabilirsiniz.`,
            });
        }
        if (b.firmaId !== firma.firmaId && eskiDb === db && (ins.ozet.firma.vkn || "").trim() === vkn) {
            e.push({
                kod: "YANLIS_FIRMA",
                seviye: "ENGEL",
                mesaj: `Bu yedek (${ozet.yedek.dbAdi}) ${zaman} tarihinde ${firmaKodlari.get(b.firmaId ?? 0) || `#${b.firmaId}`} firmasına aktarıldı. Aynı yedek iki firmaya aktarılmamalı.`,
            });
        }
    }
    return e.filter((x, i) => e.findIndex((z) => z.mesaj === x.mesaj) === i);
};
/**
 * Firma bizim sistemde kullanılmış mı (K22, 17.11.2026 senaryo denetimi). Aktarım firmadaki verileri yedektekilerle DEĞİŞTİRİR:
 *  - CANLI_FIRMA (ENGEL, onayla geçilmez): firmadan bizim sistemle e-belge gönderilmiş → firma canlı; aktarım bizim sistemde girilen
 *    bütün fişleri silerdi. Aktarım işinin başında da yeniden denetlenir.
 *  - FIRMADA_KAYIT (UYARI): yalnız bizim şemada olan tablolarda (perakende fişi, bakiye düzeltme, hızlı satış …) kayıt var. Yeniden
 *    aktarım bu tablolara dokunmaz; silinen fişlere / bakiyeye bağlı olanlar tutarsız kalabilir (geçiş günü kuralı ayrıca kararlaştırılacak).
 */
export const firmaKullanimi = async (pool, firmaDb, plan) => {
    const e = [...(await eBelgeGonderimi(pool, firmaDb))];
    const tam = (tablo) => `${q(firmaDb)}.dbo.${q(tablo)}`;
    const var_ = async (tablo) => (await new sql.Request(pool).query(`SELECT OBJECT_ID(${n(`${firmaDb}.dbo.${tablo}`)}) AS L`)).recordset[0].L !== null;
    const say = async (sorgu) => Number((await new sql.Request(pool).query(sorgu)).recordset[0].N) || 0;
    if (plan) {
        const haric = new Set([...SABLON_KALIR_TABLOLARI, ...DOKUNULMAZ_TABLOLAR, "TODVZ_EBELGE_KAYNAK"]);
        const kayitlar = plan.tablolar
            .filter((t) => t.islem === "SABLON_KORU" && t.hedefSatir > 0 && !haric.has(t.tablo.toUpperCase()) && !/^(LKY_DESTEK_|YWS_)/i.test(t.tablo))
            .map((t) => ({ tablo: t.tablo, satir: t.hedefSatir }));
        // e-Belge kaynak işaretleri: önceki aktarımın "eski programla gönderildi" kayıtları sayılmaz (onları aktarım kendisi yazar)
        if (await var_("TODVZ_EBELGE_KAYNAK")) {
            const bizim = await say(`SELECT COUNT_BIG(*) AS N FROM ${tam("TODVZ_EBELGE_KAYNAK")} WHERE NOT (DURUM = 'GONDERILDI' AND HATA LIKE N'Eski programla gönderildi%')`);
            if (bizim > 0)
                kayitlar.push({ tablo: "TODVZ_EBELGE_KAYNAK", satir: bizim });
        }
        if (kayitlar.length) {
            e.push({
                kod: "FIRMADA_KAYIT",
                seviye: "UYARI",
                mesaj: `Firmada bizim sistemde girilmiş kayıtlar var (${kayitlar.map((k) => `${k.tablo} ${k.satir}`).join(", ")}). Aktarım bu tablolara dokunmaz; silinen fişlere ya da bakiyeye bağlı olanlar tutarsız kalabilir. Geçiş gününde yeniden aktarmadan önce bu kayıtlar temizlenmeli.`,
            });
        }
    }
    return e;
};
const firmaKodlari = async () => new Map((await FirmaService.listele()).map((f) => [f.firmaId, f.firmaKodu]));
export class AktarimService {
    /** Firmanın kendi SQL girişiyle (uygulamanın o firma için kullandığı bağlantı) sorgu; aktarım sonrası "doğru yer" kontrolü kullanır. */
    static firmaIleOku = firmaDbIleCalistir;
    /** Merkez işlem kaydındaki son başarılı aktarımın zamanı (canlı firma kilidi, rapor dosyası kalmamışsa). */
    static aktarimKaydi = (firmaId) => AdminLogSqlRepository.sonIslemZamani("VERI_AKTARILDI", "FIRMA", firmaId);
    // ---------------------------------------------------------------- yükleme (Faz 1)
    static async yuklemeBaslat(firmaId, girdi) {
        await aktarilabilirFirma(firmaId);
        return (await yukleyici()).baslat({ ...girdi, firmaId });
    }
    static async parca(firmaId, yuklemeId, sira, veri, sha256) {
        const y = await yukleyici();
        yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
        const b = y.parcaYaz(yuklemeId, sira, veri, sha256);
        return { alinan: b.alinan.length, parcaSayisi: b.parcaSayisi };
    }
    static async yuklemeBitir(yapan, firmaId, yuklemeId) {
        const y = await yukleyici();
        yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
        const b = await y.bitir(yuklemeId);
        await AdminLogSqlRepository.islemLogu({
            adminId: yapan.adminId,
            islem: "VERI_AKTARIM_YUKLENDI",
            hedefTur: "FIRMA",
            hedefId: firmaId,
            yeni: { yuklemeId, dosyaAdi: b.dosyaAdi, boyut: b.boyut, yedekBoyutu: b.yedekBoyutu },
        });
        return b;
    }
    static async yuklemeler(firmaId) {
        await FirmaService.getir(firmaId);
        const y = await yukleyici();
        return y.listele(firmaId).map((b) => ({
            ...b,
            incelendi: !!y.dosyaOku(b.yuklemeId, "inceleme.json"),
            aktarildi: jsonOku(y, b.yuklemeId, "rapor.json")?.basarili ?? null,
            dogrulandi: jsonOku(y, b.yuklemeId, "dogrulama.json")?.basarili ?? null,
        }));
    }
    static async yuklemeSil(firmaId, yuklemeId) {
        const y = await yukleyici();
        yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
        if (calisanFirmalar.has(firmaId))
            throw ApiError.conflict("Firmada çalışan bir aktarım işi var.");
        // Geçici veritabanı kaldırılamazsa (SQL'e o an ulaşılamadı) yükleme yine silinir: sahipsiz kalan geçici
        // veritabanını sonraki işin başındaki temizlik (sahipsizGecicileriSil) kaldırır
        if (klonYapilandirildiMi()) {
            try {
                const pool = await havuz();
                try {
                    await geciciSil(pool, geciciDbAdi(yuklemeId));
                }
                finally {
                    await pool.close().catch(() => undefined);
                }
            }
            catch (err) {
                logger.warn(`[AKTARIM] ${yuklemeId} geçici veritabanı kaldırılamadı (sonraki işte temizlenir): ${err?.message}`);
            }
        }
        y.sil(yuklemeId);
    }
    // ---------------------------------------------------------------- işler
    static isDurumu(firmaId, isId) {
        const is = isler.get(isId);
        if (!is || is.firmaId !== firmaId)
            throw ApiError.notFound("İş bulunamadı (sunucu yeniden başlamış olabilir); raporu yükleme listesinden açın.");
        return is;
    }
    static async raporlar(firmaId, yuklemeId) {
        const y = await yukleyici();
        yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
        return {
            inceleme: jsonOku(y, yuklemeId, "inceleme.json"),
            rapor: jsonOku(y, yuklemeId, "rapor.json"),
            dogrulama: jsonOku(y, yuklemeId, "dogrulama.json"),
        };
    }
    /** Yedeği açar ve inceler; geçici veritabanı aktarım için açık kalır. */
    static async inceleBaslat(firmaId, yuklemeId) {
        if (!klonYapilandirildiMi())
            throw ApiError.badRequest("Bu sunucuda veritabanı işlemleri kapalı (klonlama hesabı tanımlı değil).");
        const firma = await aktarilabilirFirma(firmaId);
        const y = await yukleyici();
        const b = yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
        return isBaslat(firmaId, yuklemeId, "INCELE", async (is) => {
            const pool = await havuz();
            try {
                const { set, engeller, gecici } = await geciciHazirla(pool, b, is);
                const sonuc = { ozet: null, engeller: [...engeller], plan: null, firmaDolu: null, esAdaylari: [], onerilenRol: null, zaman: new Date().toISOString() };
                if (!engeller.some((e) => e.seviye === "ENGEL")) {
                    ilerle(is, "INCELE", 40, "Yedek inceleniyor");
                    const ozet = await incele(pool, gecici, set);
                    sonuc.ozet = ozet;
                    sonuc.engeller.push(...ozet.engeller);
                    sonuc.engeller.push(...yanlisFirmaSuphesi(y, firma, ozet, yuklemeId, await firmaKodlari()));
                    if (ozet.eskiProgram) {
                        ilerle(is, "PLAN", 70, "Bizim şemayla eşleme ve kayıp denetimi");
                        const { plan, engeller: planEngel } = await planHazirla(pool, gecici, firma.dbName, { degerKurallari: [digerVeritabaniKurali(null)] });
                        sonuc.engeller.push(...planEngel);
                        sonuc.engeller.push(...(await firmaKullanimi(pool, firma.dbName, plan)));
                        // Canlı firma kilidi (K24): son aktarımdan sonra firmada kayıt girildiyse aktarım yapılamaz
                        sonuc.engeller.push(...(await sonradanKullanim(pool, firma.dbName, await aktarimGecmisi(y, firmaId))));
                        sonuc.plan = {
                            kopyalanacak: plan.tablolar.filter((t) => t.islem === "KOPYALA").length,
                            sablonTemizlenecek: plan.tablolar.filter((t) => t.islem === "SABLON_TEMIZLE").map((t) => t.tablo),
                            kurallar: plan.kurallar,
                            bosBirakilan: plan.bosBirakilan.length,
                        };
                        const [d] = (await new sql.Request(pool).query(`
              SELECT (SELECT COUNT_BIG(*) FROM [${firma.dbName.replace(/]/g, "]]")}].dbo.TODVZ_FIS) AS F,
                     (SELECT COUNT_BIG(*) FROM [${firma.dbName.replace(/]/g, "]]")}].dbo.TODVZ_SARRAF_FISI) AS S,
                     (SELECT COUNT_BIG(*) FROM [${firma.dbName.replace(/]/g, "]]")}].dbo.TODVZ_KULLANICI) AS K`)).recordset;
                        sonuc.firmaDolu = { fis: Number(d.F), sarrafFisi: Number(d.S), kullanici: Number(d.K) };
                        if (ozet.bagliVeritabanlari.length) {
                            const tum = await FirmaService.listele();
                            sonuc.esAdaylari = tum
                                .filter((f) => f.firmaId !== firmaId && f.baglantiModu === "cloud" && f.durum !== "SILINDI" && (!firma.musteriNo || f.musteriNo === firma.musteriNo))
                                .map((f) => ({ firmaId: f.firmaId, firmaKodu: f.firmaKodu, unvan: f.unvan, dbName: f.dbName }));
                            sonuc.onerilenRol = ozet.alan.fisleriAktarilacak === true ? "CALISMA" : ozet.alan.fisleriAktarilacak === false ? "RESMI" : ozet.eDoviz.logVar ? "RESMI" : "CALISMA";
                        }
                    }
                }
                y.dosyaYaz(yuklemeId, "inceleme.json", JSON.stringify(sonuc));
                ilerle(is, "BITTI", 100, sonuc.engeller.some((e) => e.seviye === "ENGEL") ? "İnceleme bitti: aktarımı engelleyen durum var" : "İnceleme bitti");
            }
            finally {
                await pool.close().catch(() => undefined);
            }
        });
    }
    /** Aktarımı başlatır (onay: firma kodu). Firma veritabanındaki veriler yedektekilerle değişir; önce COPY_ONLY yedek alınır. */
    static async aktarBaslat(yapan, firmaId, yuklemeId, girdi) {
        if (!klonYapilandirildiMi())
            throw ApiError.badRequest("Bu sunucuda veritabanı işlemleri kapalı (klonlama hesabı tanımlı değil).");
        const firma = await aktarilabilirFirma(firmaId);
        if (String(girdi.onay || "").trim().toUpperCase() !== firma.firmaKodu.toUpperCase()) {
            throw ApiError.badRequest("Onay için firma kodunu doğru yazın.");
        }
        const y = await yukleyici();
        const b = yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
        const inceleme = jsonOku(y, yuklemeId, "inceleme.json");
        if (!inceleme)
            throw ApiError.badRequest("Önce yedeği inceleyin.");
        // Yanlış firmaya yedek: incelemeden sonra başka aktarım olmuş olabilir, yeniden denetlenir
        if (inceleme.ozet) {
            const supheler = yanlisFirmaSuphesi(y, firma, inceleme.ozet, yuklemeId, await firmaKodlari());
            if (supheler.length && !girdi.firmaOnay) {
                throw ApiError.badRequest(`Yedek bu firmaya ait görünmüyor: ${supheler.map((x) => x.mesaj).join(" ")} Kontrol ettiyseniz onay kutusunu işaretleyin.`);
            }
        }
        let esFirma = null;
        if (girdi.esFirmaId) {
            if (girdi.esFirmaId === firmaId)
                throw ApiError.badRequest("Firma kendisinin eşi olamaz.");
            esFirma = await aktarilabilirFirma(girdi.esFirmaId);
            // K2: R ve A aynı müşteri numarasıyla açılır; başka müşterinin veritabanına tetik/yetki kurulmasın
            if ((firma.musteriNo || "") !== (esFirma.musteriNo || ""))
                throw ApiError.badRequest("Eş firma aynı müşteri numarasında olmalı.");
        }
        // Bu yüklemenin önceki başarılı raporu (iz tutmayan sürümden kalmış olabilir) iş rapor.json'ın üstüne yazmadan saklanır
        basariliRaporuSakla(y, yuklemeId);
        return isBaslat(firmaId, yuklemeId, "AKTAR", async (is) => {
            const pool = await havuz();
            const rapor = {
                basarili: false,
                hata: null,
                engeller: [],
                aktarim: null,
                dogrulama: null,
                cift: null,
                kullaniciEslemesi: 0,
                yapan: yapan.kullaniciAdi,
                zaman: new Date().toISOString(),
            };
            try {
                const { set, engeller, gecici } = await geciciHazirla(pool, b, is);
                rapor.engeller.push(...engeller);
                if (engeller.some((e) => e.seviye === "ENGEL"))
                    throw new Error("Yedek aktarılamaz (engel var).");
                // Canlı firma koruması: inceleme eski olabilir, aktarım anında yeniden bakılır. e-belge gönderilmişse ya da son aktarımdan
                // sonra firmada kayıt girildiyse (K24) aktarım yapılamaz. Çiftte aktarım eşin veritabanına da yazar: eş de aynı kilide bakılır.
                const canli = await canliFirmaEngelleri(pool, firma.dbName, await aktarimGecmisi(y, firmaId));
                if (esFirma) {
                    for (const e of await canliFirmaEngelleri(pool, esFirma.dbName, await aktarimGecmisi(y, esFirma.firmaId))) {
                        canli.push({ ...e, mesaj: `Eş firma ${esFirma.firmaKodu}: ${e.mesaj}` });
                    }
                }
                if (canli.length) {
                    rapor.engeller.push(...canli);
                    throw new Error(canli.map((e) => e.mesaj).join(" "));
                }
                ilerle(is, "INCELE", 10, "Yedek özeti");
                const ozet = await incele(pool, gecici, set);
                const cift = esFirma
                    ? ciftSecenekleri(ozet, gecici, firma.dbName, { esHedefDb: esFirma.dbName, rol: girdi.rol ?? null, hedefGirisi: firma.dbUser, esGirisi: esFirma.dbUser })
                    : null;
                if (cift && esFirma)
                    rapor.cift = { hedefDb: cift.hedefDb, esHedefDb: cift.esHedefDb, esEskiAdi: cift.esEskiAdi, rol: cift.rol, hedefGirisi: cift.hedefGirisi, esGirisi: cift.esGirisi, esFirmaId: esFirma.firmaId };
                // Firmadaki oturumlar kapatılır, uygulamanın bağlantı havuzları bırakılır. Çiftte eşin de: aktarım eşin veritabanına yazar
                // ve sonunda eşin izi yenilenir; aktarım sürerken eşte girilen kayıt izin içine karışmasın.
                for (const f of [firma, ...(esFirma ? [esFirma] : [])]) {
                    await IzlemeSqlRepository.oturumlariIptalEt({ firmaId: f.firmaId }, yapan.adminId).catch(() => 0);
                    await veritabaniHavuzlariniKapat(f.dbServer, f.dbName).catch(() => undefined);
                }
                const dogrulamaTutucu = { r: null };
                const d = new Date();
                const iki = (x) => String(x).padStart(2, "0");
                const damga = `${d.getFullYear()}${iki(d.getMonth() + 1)}${iki(d.getDate())}_${iki(d.getHours())}${iki(d.getMinutes())}${iki(d.getSeconds())}`;
                const onYedek = path.win32.join(await aktarimKoku(), yuklemeId, `once_${damga}.bak`);
                rapor.aktarim = await aktar({
                    pool,
                    kaynakDb: gecici,
                    hedefDb: firma.dbName,
                    onYedekYolu: onYedek,
                    ilerleme: (a) => ilerle(is, a.adim, 10 + Math.round(a.yuzde * 0.85), a.mesaj),
                    planSecenekleri: { degerKurallari: [digerVeritabaniKurali(cift)], taslakOnay: !!girdi.taslakOnay },
                    ekAdimlar: (tx) => standartEkAdimlar(tx, gecici, firma.dbName, cift),
                    dogrula: async (tx, plan) => {
                        dogrulamaTutucu.r = await dogrula(tx, plan, { ekKontroller: (bg) => ciftKontrolleri(bg, { kaynakDb: gecici, hedefDb: firma.dbName, cift }) });
                        return dogrulamaTutucu.r;
                    },
                });
                rapor.dogrulama = dogrulamaTutucu.r;
                rapor.basarili = true;
                // Buradan sonrası COMMIT'ten SONRA çalışır: veri yazıldı ve doğrulandı. Aşağıdaki yan adımlardan biri hata verirse
                // iş "hatalı" görünmemeli (yönetici başarılı aktarımı başarısız sanıp yeniden denerdi); hata günlüğe yazılır.
                y.dosyaYaz(yuklemeId, "rapor.json", JSON.stringify(rapor));
                y.dosyaYaz(yuklemeId, BASARILI_RAPOR, JSON.stringify(rapor));
                // Çift: aktarım eşin veritabanına da yazdı (fiş eşlemesi, tetikler, yetki). Eşin izi (varsa) yeni hâliyle yenilenir;
                // yoksa eşin bir sonraki aktarımı kendi değişikliğimizi "firmada kayıt girilmiş" sanardı. Eş başta kilide bakıldı (kullanılmamış).
                if (esFirma) {
                    try {
                        if (await izYenile(pool, esFirma.dbName))
                            rapor.aktarim.notlar.push(`Eş firmanın (${esFirma.firmaKodu}) aktarım izi yenilendi.`);
                    }
                    catch (err) {
                        logger.warn(`[AKTARIM] firma ${firmaId}: eş firmanın aktarım izi yenilenemedi: ${err?.message}`);
                        rapor.aktarim.notlar.push(`Eş firmanın (${esFirma.firmaKodu}) aktarım izi yenilenemedi: ${String(err?.message || err).slice(0, 200)}`);
                    }
                }
                // Merkez kullanıcılarının firma veritabanı kimlikleri ada göre yeniden bağlanır
                ilerle(is, "ESLEME", 97, "Merkez kullanıcı eşlemesi");
                try {
                    const kullanicilar = (await new sql.Request(pool).query(`SELECT KULLANICI_ID AS I, RTRIM(AD) AS AD FROM [${firma.dbName.replace(/]/g, "]]")}].dbo.TODVZ_KULLANICI`)).recordset;
                    for (const k of kullanicilar)
                        rapor.kullaniciEslemesi += await KullaniciSqlRepository.firmaDbKimligiGuncelle(firmaId, String(k.AD), Number(k.I)).catch(() => 0);
                }
                catch (err) {
                    logger.warn(`[AKTARIM] firma ${firmaId}: aktarım tamamlandı, merkez kullanıcı eşlemesi yapılamadı: ${err?.message}`);
                }
                // AKTARIM SONRASI KONTROL — COMMIT'ten sonra, işlem dışında: yedekle baştan sona yeniden karşılaştırma (yazılan kalıcı mı)
                // + doğru yer (firma kimliği, firmanın kendi girişiyle okuma). Sonuç dogrulama.json'a ("Aktarım sonrası kontrol") yazılır.
                ilerle(is, "SON_KONTROL", 97, "Aktarım sonrası kontrol: yedekle yeniden karşılaştırma ve doğru firma");
                try {
                    const son = await sonKontrol(pool, {
                        kaynakDb: gecici,
                        hedefDb: firma.dbName,
                        cift,
                        firma: { firmaKodu: firma.firmaKodu, unvan: firma.unvan, vknTckn: firma.vknTckn ?? null },
                        firmaIleOku: (f) => AktarimService.firmaIleOku(firmaId, f),
                    });
                    y.dosyaYaz(yuklemeId, "dogrulama.json", JSON.stringify(son));
                    rapor.sonKontrol = sonKontrolOzeti(son);
                    rapor.bildirim = await aktarimBildirimi({
                        firmaId, firmaKodu: firma.firmaKodu, unvan: firma.unvan, hedefDb: firma.dbName, dosyaAdi: b.dosyaAdi, eskiDb: ozet.yedek.dbAdi, yapan: yapan.kullaniciAdi,
                        ozet: rapor.sonKontrol,
                        notlar: rapor.aktarim.notlar.slice(0, 8),
                        farklar: son.kontroller.filter((k) => k.durum === "FARK").slice(0, 10).map((k) => `${k.tablo ? k.tablo + ": " : ""}${k.ad}${k.ayrinti ? " — " + k.ayrinti : ""}`),
                    });
                }
                catch (err) {
                    logger.warn(`[AKTARIM] firma ${firmaId}: aktarım tamamlandı, aktarım sonrası kontrol çalıştırılamadı: ${err?.message}`);
                }
                y.dosyaYaz(yuklemeId, "rapor.json", JSON.stringify(rapor));
                y.dosyaYaz(yuklemeId, BASARILI_RAPOR, JSON.stringify(rapor));
                await AdminLogSqlRepository.islemLogu({
                    adminId: yapan.adminId,
                    islem: "VERI_AKTARILDI",
                    hedefTur: "FIRMA",
                    hedefId: firmaId,
                    yeni: {
                        yuklemeId,
                        dosyaAdi: b.dosyaAdi,
                        eskiDb: ozet.yedek.dbAdi,
                        satir: rapor.aktarim.tablolar.reduce((x, t) => x + t.yazilan, 0),
                        dogrulamaFark: rapor.dogrulama?.ozet.fark ?? null,
                        sonKontrol: rapor.sonKontrol?.metin ?? null,
                        cift: rapor.cift ? { es: rapor.cift.esHedefDb, rol: rapor.cift.rol } : null,
                        onYedek,
                    },
                }).catch(() => undefined);
                ilerle(is, "BITTI", 100, rapor.sonKontrol ? `Aktarım tamamlandı — aktarım sonrası kontrol: ${rapor.sonKontrol.metin}` : rapor.dogrulama?.basarili ? "Aktarım tamamlandı; doğrulama: kaynakla birebir aynı" : "Aktarım tamamlandı");
            }
            catch (err) {
                if (rapor.basarili) {
                    // COMMIT'ten sonraki bir yan adım: aktarım geçerli, iş başarılı kalır
                    logger.warn(`[AKTARIM] firma ${firmaId}: aktarım tamamlandı, son adımda uyarı: ${err?.message}`);
                    ilerle(is, "BITTI", 100, "Aktarım tamamlandı");
                    return;
                }
                rapor.hata = String(err?.message || err).slice(0, 1000);
                if (err instanceof AktarimEngeli)
                    rapor.engeller.push(...err.engeller);
                if (err instanceof AktarimDogrulamaHatasi)
                    rapor.dogrulama = err.dogrulama;
                rapor.bildirim = await aktarimBildirimi({ firmaId, firmaKodu: firma.firmaKodu, unvan: firma.unvan, hedefDb: firma.dbName, dosyaAdi: b.dosyaAdi, yapan: yapan.kullaniciAdi, hata: rapor.hata }).catch(() => false);
                await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "VERI_AKTARIM_HATA", hedefTur: "FIRMA", hedefId: firmaId, yeni: { yuklemeId, hata: rapor.hata } }).catch(() => undefined);
                throw err;
            }
            finally {
                y.dosyaYaz(yuklemeId, "rapor.json", JSON.stringify(rapor));
                await geciciSil(pool, geciciDbAdi(yuklemeId)).catch(() => undefined);
                await pool.close().catch(() => undefined);
            }
        }, esFirma ? [esFirma.firmaId] : []);
    }
    /** Aktarımdan bağımsız doğrulama: yüklenen yedek ile firma veritabanını yeniden karşılaştırır. */
    static async dogrulaBaslat(yapan, firmaId, yuklemeId) {
        if (!klonYapilandirildiMi())
            throw ApiError.badRequest("Bu sunucuda veritabanı işlemleri kapalı (klonlama hesabı tanımlı değil).");
        const firma = await aktarilabilirFirma(firmaId);
        const y = await yukleyici();
        const b = yuklemeFirmaDenetimi(y.oku(yuklemeId), firmaId);
        return isBaslat(firmaId, yuklemeId, "DOGRULA", async (is) => {
            const pool = await havuz();
            try {
                const { engeller, gecici } = await geciciHazirla(pool, b, is);
                if (engeller.some((e) => e.seviye === "ENGEL"))
                    throw new Error(engeller.map((e) => e.mesaj).join(" | "));
                ilerle(is, "DOGRULA", 30, "Kaynak ile firma veritabanı karşılaştırılıyor");
                const r = await sonKontrol(pool, {
                    kaynakDb: gecici,
                    hedefDb: firma.dbName,
                    cift: null,
                    firma: { firmaKodu: firma.firmaKodu, unvan: firma.unvan, vknTckn: firma.vknTckn ?? null },
                    firmaIleOku: (f) => AktarimService.firmaIleOku(firmaId, f),
                });
                // Firma aktarımdan sonra kullanıldıysa (canlıya geçtiyse) yedekle farklar beklenir: sebebi rapora ve iş mesajına yazılır.
                // Doğrula yalnız okur; firma verisine dokunmaz.
                const kullanim = (await sonradanKullanim(pool, firma.dbName, await aktarimGecmisi(y, firmaId)).catch(() => [])).filter((e) => e.seviye === "ENGEL");
                const kullanimNotu = kullanim.length
                    ? `Firma aktarımdan sonra kullanılmış: ${kullanim.map((e) => e.mesaj.replace(/\. Firma kullanımda:[\s\S]*$/, "")).join(" ")}. Yedekle farklar bu yüzden; Doğrula yalnız okur, firma verisine dokunmadı.`
                    : null;
                if (kullanimNotu) {
                    r.kontroller.unshift({ grup: "EK", tablo: null, ad: "Firma aktarımdan sonra kullanılmış (canlı)", durum: "UYARI", ayrinti: kullanimNotu });
                    r.ozet.uyari += 1;
                }
                y.dosyaYaz(yuklemeId, "dogrulama.json", JSON.stringify(r));
                await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "VERI_AKTARIM_DOGRULANDI", hedefTur: "FIRMA", hedefId: firmaId, yeni: { yuklemeId, basarili: r.basarili, fark: r.ozet.fark } });
                ilerle(is, "BITTI", 100, `Aktarım sonrası kontrol: ${sonKontrolOzeti(r).metin}${kullanimNotu ? ` | Not: ${kullanimNotu}` : ""}`);
            }
            finally {
                await geciciSil(pool, geciciDbAdi(yuklemeId)).catch(() => undefined);
                await pool.close().catch(() => undefined);
            }
        });
    }
}

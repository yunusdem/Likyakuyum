import crypto from "crypto";
import fs from "fs";
import sql from "mssql";
import { ApiError } from "../../utils/ApiError.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { logger } from "../../utils/logger.js";
import { bugunTr, gunFarki } from "../../utils/zaman.utils.js";
import { LisansKoduGecersiz, lisansKoduCoz } from "../lisans/lisansKodu.js";
import { makineKimligi } from "../lisans/makineKimligi.js";
import { kurulumFirmasi, firmaDosyasiHatasi, veriYolu } from "./firmaDosyasi.js";
import { kurulumHavuzu } from "./kurulumDb.js";
import { butunlukHatasi } from "./butunluk.js";
export const KILIT_MESAJI = {
    LISANS_YOK: "Bu kurulum için lisans yüklenmemiş.",
    LISANS_GECERSIZ: "Yüklü lisans doğrulanamadı.",
    FIRMA_UYUSMUYOR: "Yüklü lisans bu firmaya ait değil.",
    MAKINE_UYUSMUYOR: "Lisans başka bir bilgisayara verilmiş. Bilgisayar değiştiyse yeni lisans almanız gerekir.",
    SAAT_GERI_ALINDI: "Bilgisayarın tarihi/saati geri alındığı için program kilitlendi.",
    LISANS_DOLDU: "Lisans süreniz doldu.",
    DURUM_BOZUK: "Lisans kayıtları değiştirilmiş veya silinmiş olduğu için program kilitlendi.",
    FIRMA_DOSYASI_YOK: "Kurulumun firma dosyası (firma.lky) bulunamadı veya bozuk. Programı yeniden kurun.",
    BUTUNLUK_BOZUK: "Program dosyaları değiştirilmiş veya bozulmuş. Programı yeniden kurun ya da bizimle iletişime geçin.",
};
export const UYARI_GUN = 30;
const SAAT_TOLERANS_MS = 5 * 60 * 1000;
const KAYIT_TOLERANS_MS = 24 * 60 * 60 * 1000;
const MERKEZ_SAAT_TOLERANS_MS = 2 * 24 * 60 * 60 * 1000;
const ONBELLEK_MS = 60 * 1000;
const KAYIT_ONBELLEK_MS = 10 * 60 * 1000;
const VARSAYILAN_ILETISIM = {
    telefon: "",
    eposta: "",
    metin: "Programı kullanmaya devam etmek için lütfen bizimle iletişime geçin.",
};
/** Durum kopyalarındaki izinli kullanıcı sınırı (en büyüğü); hiçbirinde yoksa undefined */
const izinliSinir = (kopyalar) => {
    const d = kopyalar.map((x) => x?.izinliKullaniciId).filter((x) => Number.isInteger(x));
    return d.length ? Math.max(...d) : undefined;
};
/** En yeni saat onayı */
const saatOnayiSec = (kopyalar) => kopyalar
    .map((x) => x.saatOnayi)
    .filter((x) => !!x && Number.isFinite(x.zaman))
    .sort((a, b) => b.zaman - a.zaman)[0];
/** Çözülebilen kopyaların birleşimi: en ileri zaman, en büyük seri, ilk kilit, en büyük sınır, en yeni saat onayı */
const durumBirlestir = (kopyalar) => ({
    sonGorulen: Math.max(...kopyalar.map((x) => x.sonGorulen)),
    seri: Math.max(...kopyalar.map((x) => x.seri)),
    kilit: kopyalar.map((x) => x.kilit).find((k) => !!k) ?? null,
    izinliKullaniciId: izinliSinir(kopyalar),
    saatOnayi: saatOnayiSec(kopyalar),
});
// ------------------------------------------------------------------ test kancaları ---
let saat = () => Date.now();
let makine = makineKimligi;
/** Yalnız testler: saat ve makine kimliği kaynağını değiştirir. */
export const kurulumTestKancalari = (k) => {
    if (k.saat)
        saat = k.saat;
    if (k.makine)
        makine = k.makine;
    onbellek = null;
    kayitOnbellek = null;
};
// ------------------------------------------------------------------ şifreleme ---
const durumAnahtari = () => crypto.createHash("sha256").update(`likya-durum|${makine()}`).digest();
export const durumSifrele = (d) => {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", durumAnahtari(), iv);
    const govde = Buffer.concat([c.update(JSON.stringify(d), "utf8"), c.final()]);
    return `LKD1.${iv.toString("base64url")}.${govde.toString("base64url")}.${c.getAuthTag().toString("base64url")}`;
};
/** Çözülemezse null (değiştirilmiş ya da başka makinenin dosyası). */
export const durumCoz = (metin) => {
    try {
        const [onek, iv, govde, etiket] = metin.trim().split(".");
        if (onek !== "LKD1")
            return null;
        const d = crypto.createDecipheriv("aes-256-gcm", durumAnahtari(), Buffer.from(iv, "base64url"));
        d.setAuthTag(Buffer.from(etiket, "base64url"));
        const acik = Buffer.concat([d.update(Buffer.from(govde, "base64url")), d.final()]).toString("utf8");
        const v = JSON.parse(acik);
        if (typeof v.sonGorulen !== "number" || typeof v.seri !== "number")
            return null;
        return v;
    }
    catch {
        return null;
    }
};
// ------------------------------------------------------------------ depolama ---
const dosyaOku = (ad) => {
    try {
        return fs.readFileSync(veriYolu(ad), "utf8");
    }
    catch {
        return null;
    }
};
const dosyaYaz = (ad, icerik) => {
    fs.mkdirSync(veriYolu(""), { recursive: true });
    const gecici = veriYolu(`${ad}.yeni`);
    // İçerik diske yazılmadan ad değiştirilmez: elektrik kesintisinde boş / yarım dosya kalıp kilit koyuyordu (E8)
    const fd = fs.openSync(gecici, "w");
    try {
        fs.writeSync(fd, icerik, null, "utf8");
        fs.fsyncSync(fd);
    }
    finally {
        fs.closeSync(fd);
    }
    fs.renameSync(gecici, veriYolu(ad));
};
const tabloHazirla = async (pool) => {
    await pool.request().batch(`
    IF OBJECT_ID('dbo.LKY_DURUM') IS NULL
      CREATE TABLE dbo.LKY_DURUM (ANAHTAR varchar(50) NOT NULL PRIMARY KEY, DEGER nvarchar(max) NULL, TARIH datetime NOT NULL DEFAULT GETDATE());`);
};
const dbOku = async () => {
    const pool = await kurulumHavuzu();
    await tabloHazirla(pool);
    const res = await pool.request().query(`SELECT ANAHTAR, DEGER FROM dbo.LKY_DURUM WHERE ANAHTAR IN ('LISANS', 'DURUM')`);
    const m = new Map(res.recordset.map((r) => [r.ANAHTAR, r.DEGER]));
    return { lisans: m.get("LISANS") ?? null, durum: m.get("DURUM") ?? null };
};
const dbYaz = async (anahtar, deger) => {
    const pool = await kurulumHavuzu();
    await tabloHazirla(pool);
    await pool
        .request()
        .input("a", sql.VarChar(50), anahtar)
        .input("d", sql.NVarChar(sql.MAX), deger)
        .query(`
      MERGE dbo.LKY_DURUM WITH (HOLDLOCK) AS h USING (SELECT @a AS ANAHTAR) AS k ON h.ANAHTAR = k.ANAHTAR
      WHEN MATCHED THEN UPDATE SET DEGER = @d, TARIH = GETDATE()
      WHEN NOT MATCHED THEN INSERT (ANAHTAR, DEGER) VALUES (@a, @d);`);
};
/** Dosya ve veritabanındaki durum kopyalarından çözülebilenler */
const durumKopyalari = async () => {
    const db = await dbOku();
    return [dosyaOku("durum.lky"), db.durum]
        .filter((x) => !!x && !!x.trim())
        .map(durumCoz)
        .filter((x) => !!x);
};
const durumuKaydet = async (d) => {
    const metin = durumSifrele(d);
    dosyaYaz("durum.lky", metin);
    await dbYaz("DURUM", metin);
};
/** Veritabanındaki en son kaydın zamanı (saat geri alma denetimi için). */
let kayitOnbellek = null;
const enSonKayitZamani = async () => {
    if (kayitOnbellek && saat() - kayitOnbellek.zaman < KAYIT_ONBELLEK_MS && saat() >= kayitOnbellek.zaman)
        return kayitOnbellek.deger;
    let deger = null;
    try {
        const pool = await kurulumHavuzu();
        const parcalar = ["TODVZ_FIS", "TODVZ_SARRAF_FISI", "TODVZ_CARI_HAREKET", "TODVZ_HESAP_HAREKETI"]
            .map((t) => `SELECT MAX(EKLEME_ZAMANI) AS Z FROM dbo.${t} WHERE COL_LENGTH('dbo.${t}', 'EKLEME_ZAMANI') IS NOT NULL`)
            .join(" UNION ALL ");
        const res = await pool.request().query(`SELECT MAX(Z) AS Z FROM (${parcalar}) x`);
        const z = res.recordset[0]?.Z;
        deger = z ? new Date(z).getTime() : null;
    }
    catch (err) {
        logger.warn(`[LISANS] Son kayıt zamanı okunamadı: ${err?.message}`);
    }
    kayitOnbellek = { zaman: saat(), deger };
    return deger;
};
// ------------------------------------------------------------------ servis ---
let onbellek = null;
const kalanGunHesapla = (bitis) => gunFarki(bugunTr(new Date(saat())), bitis);
let kayitSirasi = Promise.resolve();
export class KurulumLisansService {
    static onbellegiTemizle() {
        onbellek = null;
    }
    /** Geçerli lisans durumu (60 sn önbellekli). Her çağrıda saat ilerlemesini kaydeder, geri alınmışsa kilitler. */
    static async durum(zorla = false) {
        const simdi = saat();
        if (!zorla && onbellek && simdi - onbellek.zaman < ONBELLEK_MS && simdi >= onbellek.zaman)
            return onbellek.deger;
        const deger = await this.hesapla(simdi);
        onbellek = { zaman: simdi, deger };
        return deger;
    }
    static async hesapla(simdi) {
        const firma = kurulumFirmasi();
        let mk = "";
        try {
            mk = makine();
        }
        catch {
            mk = "";
        }
        const taban = (v = {}) => ({
            durum: "KILITLI",
            neden: null,
            mesaj: null,
            makineKimligi: mk,
            firmaKodu: firma?.firmaKodu ?? null,
            firmaUnvan: firma?.unvan ?? null,
            musteriNo: firma?.musteriNo ?? null,
            bitis: null,
            kalanGun: null,
            kullaniciLimiti: null,
            moduller: null,
            urunler: null,
            seri: null,
            iletisim: VARSAYILAN_ILETISIM,
            ...v,
        });
        const kilit = (neden, v = {}) => taban({ ...v, durum: "KILITLI", neden, mesaj: KILIT_MESAJI[neden] });
        if (!firma)
            return kilit("FIRMA_DOSYASI_YOK", { mesaj: `${KILIT_MESAJI.FIRMA_DOSYASI_YOK} (${firmaDosyasiHatasi()})` });
        const bozukluk = await butunlukHatasi();
        if (bozukluk)
            return kilit("BUTUNLUK_BOZUK");
        // Lisans kodu: dosya ve veritabanı; serisi büyük olan geçerlidir
        const db = await dbOku();
        const adaylar = [dosyaOku("lisans.lky"), db.lisans].filter((x) => !!x && !!x.trim());
        if (adaylar.length === 0)
            return kilit("LISANS_YOK");
        let lisans = null;
        for (const a of adaylar) {
            try {
                const v = lisansKoduCoz(a);
                if (!lisans || v.seri > lisans.seri)
                    lisans = v;
            }
            catch {
                // geçersiz aday atlanır
            }
        }
        if (!lisans)
            return kilit("LISANS_GECERSIZ");
        const bilgi = {
            bitis: lisans.bitis,
            kalanGun: kalanGunHesapla(lisans.bitis),
            kullaniciLimiti: lisans.kullaniciLimiti,
            moduller: lisans.moduller,
            urunler: lisans.urunler ?? null,
            seri: lisans.seri,
            iletisim: lisans.iletisim || VARSAYILAN_ILETISIM,
        };
        if (lisans.firmaKodu !== firma.firmaKodu)
            return kilit("FIRMA_UYUSMUYOR", bilgi);
        if (!mk || lisans.makine !== mk)
            return kilit("MAKINE_UYUSMUYOR", bilgi);
        // Durum: iki kopya birleştirilir. Hiçbiri çözülemiyorsa kilit; çözülemeyen bir kopya (ör. elektrik kesintisinde yarım
        // kalmış dosya) sağlam kopya varsa yok sayılır ve yeniden yazılır — dosyanın silinmesi de kilit sayılmıyordu (E8)
        const kopyalar = [dosyaOku("durum.lky"), db.durum].filter((x) => !!x && !!x.trim());
        const gecerli = kopyalar.map(durumCoz).filter((x) => !!x);
        if (gecerli.length === 0) {
            const d = { sonGorulen: simdi, seri: lisans.seri, kilit: { neden: "DURUM_BOZUK", zaman: simdi, seri: lisans.seri } };
            await durumuKaydet(d).catch(() => undefined);
            return kilit("DURUM_BOZUK", bilgi);
        }
        const bozukKopya = gecerli.length < kopyalar.length;
        if (bozukKopya)
            logger.warn("[LISANS] Durum kopyalarından biri okunamadı; sağlam kopyadan yeniden yazılıyor.");
        const d = durumBirlestir(gecerli);
        if (d.kilit)
            return kilit(d.kilit.neden, bilgi);
        // Saat denetimi (merkezin onayladığı andaki en son kayda kadar ileri tarihli kayıtlar sayılmaz)
        const sonKayit = await enSonKayitZamani();
        const onayliKayit = d.saatOnayi?.sonKayit ?? null;
        const kayitIleride = sonKayit !== null && !(onayliKayit !== null && sonKayit <= onayliKayit) && simdi < sonKayit - KAYIT_TOLERANS_MS;
        if (simdi < d.sonGorulen - SAAT_TOLERANS_MS || kayitIleride) {
            d.kilit = { neden: "SAAT_GERI_ALINDI", zaman: simdi, seri: lisans.seri };
            await durumuKaydet(d);
            logger.warn("[LISANS] Saat geri alınmış; program kilitlendi.");
            return kilit("SAAT_GERI_ALINDI", bilgi);
        }
        if (simdi - d.sonGorulen > 60_000 || kopyalar.length < 2 || bozukKopya) {
            d.sonGorulen = Math.max(d.sonGorulen, simdi);
            await durumuKaydet(d);
        }
        const kalan = bilgi.kalanGun;
        if (kalan < 0)
            return kilit("LISANS_DOLDU", bilgi);
        return taban({ ...bilgi, durum: kalan <= UYARI_GUN ? "UYARI" : "GECERLI" });
    }
    /** "Lisans Yükle": kod doğrulanır, bu firma ve bu makine için olmalı, eskisinden yeni olmalı. */
    static async yukle(kod) {
        const firma = kurulumFirmasi();
        if (!firma)
            throw ApiError.badRequest(KILIT_MESAJI.FIRMA_DOSYASI_YOK);
        let v;
        try {
            v = lisansKoduCoz(kod);
        }
        catch (err) {
            throw ApiError.badRequest(err instanceof LisansKoduGecersiz ? err.message : "Lisans kodu doğrulanamadı.");
        }
        const mk = makine();
        if (v.firmaKodu !== firma.firmaKodu)
            throw ApiError.badRequest("Bu lisans kodu başka bir firmaya ait.");
        if (v.makine !== mk) {
            throw ApiError.badRequest(`Bu lisans kodu başka bir bilgisayar için üretilmiş. Bu bilgisayarın kimliği: ${mk}`);
        }
        const simdi = saat();
        const verilme = Date.parse(v.verilme);
        if (Number.isFinite(verilme) && verilme > simdi + KAYIT_TOLERANS_MS) {
            throw ApiError.badRequest("Bilgisayarın tarihi/saati yanlış (lisans kodundan daha eski). Saati düzeltip tekrar deneyin.");
        }
        if (gunFarki(bugunTr(new Date(simdi)), v.bitis) < 0)
            throw ApiError.badRequest("Bu lisans kodunun süresi dolmuş.");
        // Mevcut durum
        const db = await dbOku();
        const eskiKodlar = [dosyaOku("lisans.lky"), db.lisans].filter((x) => !!x);
        let eskiSeri = 0;
        for (const k of eskiKodlar) {
            try {
                const e = lisansKoduCoz(k);
                if (e.firmaKodu === firma.firmaKodu)
                    eskiSeri = Math.max(eskiSeri, e.seri);
            }
            catch {
                /* yok say */
            }
        }
        if (v.seri < eskiSeri)
            throw ApiError.badRequest("Bu kod, yüklü lisanstan daha eski. En son verilen kodu yükleyin.");
        const kopyalar = [dosyaOku("durum.lky"), db.durum].filter((x) => !!x && !!x.trim()).map(durumCoz);
        const gecerli = kopyalar.filter((x) => !!x);
        // Hiçbir kopya çözülemiyorsa (hesapla DURUM_BOZUK kilidi koyar) kilit sayılır; biri sağlamsa o geçerlidir (E8)
        const eskiKilit = gecerli.map((x) => x.kilit).find((k) => !!k) ??
            (kopyalar.length > 0 && gecerli.length === 0 ? { neden: "DURUM_BOZUK", zaman: simdi, seri: eskiSeri } : null);
        // Kilit (saat / bozuk durum) yalnız kilitlendiği andaki seriden YENİ bir kodla açılır; süre dolması yeni bitişle açılır
        if (eskiKilit && eskiKilit.neden !== "LISANS_DOLDU" && v.seri <= eskiKilit.seri) {
            throw ApiError.badRequest("Program kilitli. Kilidi açmak için merkezden YENİ bir lisans kodu almanız gerekir.");
        }
        const sonGorulen = Math.max(simdi, Number.isFinite(verilme) ? verilme : 0, ...gecerli.map((x) => x.sonGorulen));
        const temizKod = kod.replace(/\s+/g, "");
        dosyaYaz("lisans.lky", temizKod);
        await dbYaz("LISANS", temizKod);
        // İzinli kullanıcı sınırı: sayı yeni limitin içindeyse bugünkü en büyük kimlik; aşımdaysa önceki sınır korunur
        // (lisans düşürüldüğünde mevcut kullanıcılar girer, limit dışında sonradan eklenenler yeni kodla meşrulaşmaz)
        const eskiSinir = izinliSinir(gecerli);
        let izinliKullaniciId = eskiSinir;
        try {
            const pool = await kurulumHavuzu();
            const r = (await pool.request().query(`SELECT COUNT(*) AS N, ISNULL(MAX(KULLANICI_ID), 0) AS M FROM dbo.TODVZ_KULLANICI`)).recordset[0];
            if (Number(r.N) <= v.kullaniciLimiti || eskiSinir === undefined)
                izinliKullaniciId = Number(r.M);
        }
        catch (err) {
            logger.warn(`[LISANS] Kullanıcı sayısı okunamadı: ${err?.message}`);
        }
        await durumuKaydet({ sonGorulen, seri: v.seri, kilit: null, izinliKullaniciId, saatOnayi: gecerli.length ? saatOnayiSec(gecerli) : undefined });
        this.onbellegiTemizle();
        kayitOnbellek = null;
        return this.durum(true);
    }
    /**
     * Girişte kullanıcı limiti (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md 6.5, §14 D9): sayı limiti aşmamışsa ya da aşım
     * lisans düşürülmesinden geliyorsa giriş serbesttir. Aşımda yalnız izinli sınırdaki (kod yüklenirken var olan) ve
     * kimliği en küçük `limit` kullanıcı girer; limit dışında (ör. doğrudan SQL ile) eklenen kullanıcı reddedilir.
     */
    static async girisLimitiDenetle(kullaniciId) {
        const d = await this.durum();
        if (d.durum === "KILITLI" || d.kullaniciLimiti === null)
            return;
        const pool = await kurulumHavuzu();
        const idler = (await pool.request().query(`SELECT KULLANICI_ID FROM dbo.TODVZ_KULLANICI ORDER BY KULLANICI_ID`)).recordset.map((x) => Number(x.KULLANICI_ID));
        if (idler.length <= d.kullaniciLimiti)
            return;
        const db = await dbOku();
        const sinir = izinliSinir([dosyaOku("durum.lky"), db.durum].filter((x) => !!x).map(durumCoz));
        if (sinir === undefined || kullaniciId <= sinir || idler.slice(0, d.kullaniciLimiti).includes(kullaniciId))
            return;
        throw ApiError.forbidden(`Lisanstaki kullanıcı limiti (${d.kullaniciLimiti}) aşılmış (${idler.length} kullanıcı); bu kullanıcı limit dışında eklenmiş. Bizimle iletişime geçin.`);
    }
    /**
     * Merkezden alınan saatle karşılaştırma (internet varken): bilgisayarın saati merkezden 2 günden fazla gerideyse
     * program kilitlenir (çevrimdışı denetimden kaçmak için saat geri alınmış olabilir).
     */
    static async merkezSaatiniDenetle(sunucuMs) {
        if (!Number.isFinite(sunucuMs))
            return false;
        const simdi = saat();
        if (simdi >= sunucuMs - MERKEZ_SAAT_TOLERANS_MS)
            return false;
        const db = await dbOku();
        let seri = 0;
        for (const k of [dosyaOku("lisans.lky"), db.lisans]) {
            if (!k)
                continue;
            try {
                seri = Math.max(seri, lisansKoduCoz(k).seri);
            }
            catch {
                /* yok say */
            }
        }
        const eski = [dosyaOku("durum.lky"), db.durum].filter((x) => !!x).map(durumCoz).filter((x) => !!x);
        await durumuKaydet({
            sonGorulen: Math.max(sunucuMs, ...eski.map((x) => x.sonGorulen)),
            seri: Math.max(seri, ...eski.map((x) => x.seri)),
            kilit: { neden: "SAAT_GERI_ALINDI", zaman: simdi, seri },
            izinliKullaniciId: izinliSinir(eski),
            saatOnayi: eski.length ? saatOnayiSec(eski) : undefined,
        });
        this.onbellegiTemizle();
        logger.warn("[LISANS] Bilgisayar saati merkez saatinden geride; program kilitlendi.");
        return true;
    }
    /**
     * Merkezin imzalı saati bilgisayar saatini doğruluyorsa (en çok 5 dk fark) SAAT_GERI_ALINDI kilidi kalkar (docs 15.2,
     * E28): saat yanlışlıkla ileri kurulup düzeltildiğinde yeni kod gerekmesin. Son görülen zaman şimdiye çekilir, o anki
     * en son kayıt zamanı onaylı yazılır (ileri saatle girilmiş kayıtlar yeniden kilitlemez). Başka nedenli kilit kalkmaz.
     * İmza ve tek kullanımlık soru KurulumBildirim'de denetlenir (sahte merkez / eski yanıt saati onaylayamaz).
     */
    static async saatKilidiniMerkezleAc(sunucuMs) {
        if (!Number.isFinite(sunucuMs))
            return false;
        const simdi = saat();
        if (Math.abs(simdi - sunucuMs) > SAAT_TOLERANS_MS)
            return false;
        const gecerli = await durumKopyalari();
        const kilitler = gecerli.map((x) => x.kilit).filter((k) => !!k);
        if (!kilitler.length || kilitler.some((k) => k.neden !== "SAAT_GERI_ALINDI"))
            return false;
        kayitOnbellek = null;
        const sonKayit = await enSonKayitZamani();
        await durumuKaydet({ ...durumBirlestir(gecerli), sonGorulen: simdi, kilit: null, saatOnayi: { zaman: simdi, sonKayit } });
        this.onbellegiTemizle();
        logger.info("[LISANS] Bilgisayar saati merkez saatiyle doğrulandı; saat kilidi kaldırıldı.");
        return true;
    }
    /**
     * Programdan açılan kullanıcı izinli sınıra yazılır (E9): kod kullanıcılardan önce yüklendiğinde sınır 0 kalıyor,
     * lisans düşürülünce programdan meşru açılmış kullanıcılar "limit dışında eklenmiş" diye giremiyordu.
     */
    static async kullaniciEklendi(kullaniciId) {
        if (!Number.isInteger(kullaniciId) || kullaniciId <= 0)
            return;
        const gecerli = await durumKopyalari();
        if (!gecerli.length)
            return;
        const b = durumBirlestir(gecerli);
        if (b.izinliKullaniciId !== undefined && b.izinliKullaniciId >= kullaniciId)
            return;
        await durumuKaydet({ ...b, izinliKullaniciId: kullaniciId });
        this.onbellegiTemizle();
    }
    /**
     * Kullanıcı açma işlemlerini (limit denetimi + kayıt, ilk yönetici) sıraya koyar: aynı anda gelen iki istek ikisi de
     * "limit dolmadı" görüp limiti aşabiliyor, iki ilk yönetici açılabiliyordu. Kurulum tek süreçtir; bellek içi sıra yeter.
     */
    static kullaniciKaydiSirasi(is) {
        const p = kayitSirasi.then(is, is);
        kayitSirasi = p.catch(() => undefined);
        return p;
    }
    /** Kullanıcı limitine göre yeni kullanıcı açılabilir mi (kurulum modunda Kullanıcı Tanımları). */
    static async kullaniciAcilabilirMi() {
        const d = await this.durum();
        if (d.durum === "KILITLI")
            throw new ApiError(HttpStatus.LOCKED, d.mesaj || "Program kilitli.", { kod: "LISANS_KILIT", neden: d.neden });
        const pool = await kurulumHavuzu();
        const res = await pool.request().query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_KULLANICI`);
        const sayi = res.recordset[0].N;
        if (d.kullaniciLimiti !== null && sayi >= d.kullaniciLimiti) {
            throw ApiError.conflict(sayi > d.kullaniciLimiti
                ? `Lisansınızdaki kullanıcı limiti aşılmış (${sayi} / ${d.kullaniciLimiti}); yeni kullanıcı açılamaz. Ek kullanıcı için bizimle iletişime geçin.`
                : `Lisansınızdaki kullanıcı limiti (${d.kullaniciLimiti}) dolu. Ek kullanıcı için bizimle iletişime geçin.`);
        }
    }
}

import crypto from "crypto";
import sql from "mssql";
import { env } from "../../config/env.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { UserSqlRepository } from "../../models/userSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { kurulumFirmasi } from "../kurulum/firmaDosyasi.js";
import { merkezAdresi } from "../kurulum/kurulumBildirim.js";
import { kurulumDbContext, kurulumHavuzu } from "../kurulum/kurulumDb.js";
class CevrimdisiHatasi extends Error {
}
const LISTE_ONBELLEK_MS = 60_000;
const KUYRUK_ARALIGI_MS = 5 * 60 * 1000;
const ISTEK_ZAMAN_ASIMI_MS = 15_000;
const kullaniciOnbellek = new Map();
const listeOnbellek = new Map();
let kuyrukCalisiyor = false;
let zamanlayici = null;
const tablolarVarMi = async (pool) => (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.LKY_DESTEK_OKUMA') IS NULL THEN 0 ELSE 1 END AS V`)).recordset[0].V === 1;
export class DestekKurulumService {
    // ------------------------------------------------------------------ Kimlik ---
    /** Bellek önbelleğini boşaltır (testler ve merkezden gelen değişiklikleri hemen görmek için). */
    static onbellekTemizle() {
        listeOnbellek.clear();
        kullaniciOnbellek.clear();
    }
    static async kullanici(u) {
        const eski = kullaniciOnbellek.get(u.username);
        if (eski && Date.now() - eski.zaman < 60_000)
            return eski.k;
        let k = { kullaniciAdi: u.username, adSoyad: null, yonetici: false };
        try {
            const user = await UserSqlRepository.findByUsername(u.username, kurulumDbContext());
            if (user)
                k = { kullaniciAdi: u.username, adSoyad: user.fullName || null, yonetici: !!user.isSysAdmin };
        }
        catch {
            /* veritabanı yoksa yalnız adıyla */
        }
        kullaniciOnbellek.set(u.username, { k, zaman: Date.now() });
        return k;
    }
    static basliklar(k, jsonGovde) {
        const firma = kurulumFirmasi();
        if (!firma)
            throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Kurulum firma dosyası (firma.lky) bulunamadı.");
        return {
            ...(jsonGovde ? { "Content-Type": "application/json" } : {}),
            "x-likya-firma": firma.firmaKodu,
            "x-likya-anahtar": firma.kurulumAnahtari,
            "x-likya-kullanici": Buffer.from(JSON.stringify(k), "utf8").toString("base64"),
        };
    }
    /** Merkeze istek; ağ hatası CevrimdisiHatasi, sunucu reddi ApiError (aynı mesajla) olarak gelir. */
    static async merkez(k, yol, secenek = {}) {
        let r;
        const ctrl = new AbortController();
        const zaman = setTimeout(() => ctrl.abort(), ISTEK_ZAMAN_ASIMI_MS);
        try {
            r = await fetch(`${merkezAdresi()}/api/v1/merkez/destek${yol}`, {
                method: secenek.method || "GET",
                headers: this.basliklar(k, secenek.govde !== undefined),
                body: secenek.govde !== undefined ? JSON.stringify(secenek.govde) : undefined,
                signal: ctrl.signal,
            });
        }
        catch (err) {
            throw new CevrimdisiHatasi(String(err?.message || err));
        }
        finally {
            clearTimeout(zaman);
        }
        const json = await r.json().catch(() => null);
        if (!r.ok) {
            if (r.status >= 500 || r.status === 429)
                throw new CevrimdisiHatasi(json?.message || `Merkez ${r.status}`);
            throw new ApiError(r.status, json?.message || `Merkez isteği reddedildi (${r.status}).`);
        }
        return json?.data;
    }
    // ------------------------------------------------------------- Yerel saklama ---
    static async onbellekYaz(anahtar, deger) {
        try {
            const pool = await kurulumHavuzu();
            if (!(await tablolarVarMi(pool)))
                return;
            await pool
                .request()
                .input("a", sql.VarChar(100), anahtar)
                .input("d", sql.NVarChar(sql.MAX), JSON.stringify(deger)).query(`
          MERGE dbo.LKY_DESTEK_ONBELLEK AS h USING (SELECT @a AS ANAHTAR) AS y ON h.ANAHTAR = y.ANAHTAR
          WHEN MATCHED THEN UPDATE SET DEGER = @d, TARIH = GETDATE()
          WHEN NOT MATCHED THEN INSERT (ANAHTAR, DEGER) VALUES (@a, @d);`);
        }
        catch (err) {
            logger.warn(`[DESTEK] Önbellek yazılamadı (${anahtar}): ${err?.message}`);
        }
    }
    static async onbellekOku(anahtar) {
        try {
            const pool = await kurulumHavuzu();
            if (!(await tablolarVarMi(pool)))
                return null;
            const r = await pool.request().input("a", sql.VarChar(100), anahtar).query(`SELECT DEGER FROM dbo.LKY_DESTEK_ONBELLEK WHERE ANAHTAR = @a`);
            return r.recordset[0] ? JSON.parse(r.recordset[0].DEGER) : null;
        }
        catch {
            return null;
        }
    }
    static async okumaDurumlari(kullaniciAdi) {
        const m = new Map();
        try {
            const pool = await kurulumHavuzu();
            if (!(await tablolarVarMi(pool)))
                return m;
            const r = await pool.request().input("k", sql.NVarChar(50), kullaniciAdi).query(`SELECT KONU_ID, SON_OKUNAN_MESAJ_ID, ARSIV, ONEMLI_OKUNDU FROM dbo.LKY_DESTEK_OKUMA WHERE KULLANICI_ADI = @k`);
            for (const x of r.recordset)
                m.set(x.KONU_ID, { son: x.SON_OKUNAN_MESAJ_ID, arsiv: !!x.ARSIV, onemliOkundu: !!x.ONEMLI_OKUNDU });
        }
        catch {
            /* tablolar yoksa okunmamış sayılır */
        }
        return m;
    }
    static async okumaYaz(kullaniciAdi, konuId, alan, deger) {
        try {
            const pool = await kurulumHavuzu();
            if (!(await tablolarVarMi(pool)))
                return;
            const req = pool.request().input("id", sql.Int, konuId).input("k", sql.NVarChar(50), kullaniciAdi);
            if (alan === "SON_OKUNAN_MESAJ_ID")
                req.input("d", sql.Int, Number(deger));
            else
                req.input("d", sql.Bit, !!deger);
            const guncelle = alan === "SON_OKUNAN_MESAJ_ID" ? `SON_OKUNAN_MESAJ_ID = CASE WHEN @d > h.SON_OKUNAN_MESAJ_ID THEN @d ELSE h.SON_OKUNAN_MESAJ_ID END` : `${alan} = @d`;
            await req.query(`
        MERGE dbo.LKY_DESTEK_OKUMA AS h USING (SELECT @id AS KONU_ID, @k AS KULLANICI_ADI) AS y ON h.KONU_ID = y.KONU_ID AND h.KULLANICI_ADI = y.KULLANICI_ADI
        WHEN MATCHED THEN UPDATE SET ${guncelle}
        WHEN NOT MATCHED THEN INSERT (KONU_ID, KULLANICI_ADI, ${alan}) VALUES (@id, @k, @d);`);
        }
        catch (err) {
            logger.warn(`[DESTEK] Okuma durumu yazılamadı: ${err?.message}`);
        }
    }
    static yerelDurumUygula(liste, durumlar) {
        return liste.map((k) => {
            const d = durumlar.get(k.konuId);
            const karsi = k.karsiSonMesajId ?? null;
            return { ...k, okunmamis: karsi !== null && (!d || d.son < karsi), arsiv: !!d?.arsiv, onemliOkundu: !!d?.onemliOkundu };
        });
    }
    // ------------------------------------------------------------------ Kuyruk ---
    static async kuyrukEkle(k, satir) {
        const pool = await kurulumHavuzu();
        if (!(await tablolarVarMi(pool)))
            throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Merkeze ulaşılamıyor ve yerel kuyruk tabloları henüz kurulmamış (program yeniden başlatılınca kurulur).");
        const r = await pool
            .request()
            .input("tur", sql.VarChar(10), satir.tur)
            .input("mk", sql.Int, satir.merkezKonuId ?? null)
            .input("yk", sql.VarChar(60), satir.yerelKonuAnahtar ?? null)
            .input("ya", sql.VarChar(60), satir.yerelAnahtar)
            .input("k", sql.NVarChar(50), k.kullaniciAdi)
            .input("kj", sql.NVarChar(400), JSON.stringify(k))
            .input("g", sql.NVarChar(sql.MAX), JSON.stringify(satir.govde)).query(`
        INSERT INTO dbo.LKY_DESTEK_KUYRUK (TUR, MERKEZ_KONU_ID, YEREL_KONU_ANAHTAR, YEREL_ANAHTAR, KULLANICI_ADI, KULLANICI_JSON, GOVDE)
        OUTPUT INSERTED.ID VALUES (@tur, @mk, @yk, @ya, @k, @kj, @g)`);
        return r.recordset[0].ID;
    }
    static async kuyrukSatirlari(kosul, girdi = (r) => r) {
        const pool = await kurulumHavuzu();
        if (!(await tablolarVarMi(pool)))
            return [];
        const r = await girdi(pool.request()).query(`SELECT ID, TUR, MERKEZ_KONU_ID, YEREL_KONU_ANAHTAR, YEREL_ANAHTAR, KULLANICI_ADI, KULLANICI_JSON, GOVDE, DURUM, OLUSTURMA, SON_HATA FROM dbo.LKY_DESTEK_KUYRUK WHERE ${kosul} ORDER BY ID`);
        return r.recordset;
    }
    static bekleyenTalepKonusu(r) {
        const g = JSON.parse(r.GOVDE);
        const firma = kurulumFirmasi();
        const k = JSON.parse(r.KULLANICI_JSON);
        return {
            konuId: -r.ID,
            tur: "TALEP",
            baslik: g.baslik,
            durum: "ACIK",
            talepTuru: g.talepTuru ?? "SORU",
            oncelik: g.oncelik ?? "NORMAL",
            ekran: g.ekran ?? null,
            bildirimTuru: null,
            onemli: false,
            cevapAlir: true,
            hedef: null,
            surum: null,
            sistemOlay: null,
            kaynakKonuId: null,
            firmaId: firma?.firmaId ?? null,
            firmaKodu: firma?.firmaKodu ?? null,
            firmaUnvan: firma?.unvan ?? null,
            kullaniciId: null,
            kullaniciAdi: k.adSoyad || k.kullaniciAdi,
            atananAdminId: null,
            atananAdmin: null,
            olusturmaTarihi: r.OLUSTURMA,
            sonMesajTarihi: r.OLUSTURMA,
            sonMesajTaraf: "KULLANICI",
            gonderimTarihi: null,
            kapanisTarihi: null,
            sonMesaj: (g.metin || "").slice(0, 160),
            mesajSayisi: 1,
            okunmamis: false,
            arsiv: false,
            onemliOkundu: false,
            karsiSonMesajId: null,
            hedefSayisi: null,
            ...{ bekliyor: true },
        };
    }
    static bekleyenMesaj(r) {
        const g = JSON.parse(r.GOVDE);
        const k = JSON.parse(r.KULLANICI_JSON);
        return {
            mesajId: -r.ID,
            gonderenTur: "KULLANICI",
            gonderenAd: k.adSoyad || k.kullaniciAdi,
            adminId: null,
            kullaniciId: null,
            metin: g.metin,
            icNot: false,
            tarih: r.OLUSTURMA,
            ekler: (g.ekler || []).map((e, i) => ({ ekId: -(r.ID * 10 + i), dosyaAdi: e.dosyaAdi, mime: e.mime, boyut: 0, silindi: false })),
            ...{ bekliyor: true },
        };
    }
    /** Bekleyen satırları sırayla merkeze gönderir. Ağ hatasında durur; merkezin açık reddinde satır HATA olur. */
    static async kuyruguBosalt() {
        if (kuyrukCalisiyor)
            return { gonderilen: 0, hata: 0 };
        kuyrukCalisiyor = true;
        let gonderilen = 0;
        let hata = 0;
        try {
            const satirlar = await this.kuyrukSatirlari(`DURUM = 'BEKLIYOR'`);
            if (satirlar.length === 0)
                return { gonderilen, hata };
            const pool = await kurulumHavuzu();
            const yaz = (id, durum, merkezKonuId, sonHata) => pool
                .request()
                .input("id", sql.Int, id)
                .input("d", sql.VarChar(10), durum)
                .input("mk", sql.Int, merkezKonuId)
                .input("h", sql.NVarChar(400), sonHata ? sonHata.slice(0, 400) : null)
                .query(`UPDATE dbo.LKY_DESTEK_KUYRUK SET DURUM = @d, MERKEZ_KONU_ID = ISNULL(@mk, MERKEZ_KONU_ID), SON_HATA = @h, DENEME = DENEME + 1, GONDERIM = CASE WHEN @d = 'GONDERILDI' THEN GETDATE() ELSE GONDERIM END WHERE ID = @id`);
            for (const r of satirlar) {
                const k = JSON.parse(r.KULLANICI_JSON);
                const govde = JSON.parse(r.GOVDE);
                try {
                    if (r.TUR === "TALEP") {
                        const d = await this.merkez(k, "/talepler", { method: "POST", govde: { ...govde, yerelAnahtar: r.YEREL_ANAHTAR } });
                        await yaz(r.ID, "GONDERILDI", d.konu.konuId, null);
                    }
                    else {
                        let hedef = r.MERKEZ_KONU_ID ?? null;
                        if (!hedef && r.YEREL_KONU_ANAHTAR) {
                            const t = await this.kuyrukSatirlari(`TUR = 'TALEP' AND YEREL_ANAHTAR = @ya`, (q) => q.input("ya", sql.VarChar(60), r.YEREL_KONU_ANAHTAR));
                            hedef = t[0]?.MERKEZ_KONU_ID ?? null;
                        }
                        if (!hedef)
                            continue; // bağlı talep henüz gitmedi
                        await this.merkez(k, `/konular/${hedef}/mesajlar`, { method: "POST", govde: { ...govde, yerelAnahtar: r.YEREL_ANAHTAR } });
                        await yaz(r.ID, "GONDERILDI", hedef, null);
                    }
                    gonderilen++;
                }
                catch (err) {
                    if (err instanceof CevrimdisiHatasi)
                        break;
                    hata++;
                    await yaz(r.ID, "HATA", null, String(err?.message || err));
                    logger.warn(`[DESTEK] Kuyruk satırı ${r.ID} merkez tarafından reddedildi: ${err?.message}`);
                }
            }
            if (gonderilen) {
                listeOnbellek.clear();
                logger.info(`[DESTEK] Çevrimdışı kuyruk: ${gonderilen} kayıt merkeze gönderildi.`);
            }
            return { gonderilen, hata };
        }
        catch (err) {
            logger.warn(`[DESTEK] Kuyruk boşaltılamadı: ${err?.message}`);
            return { gonderilen, hata };
        }
        finally {
            kuyrukCalisiyor = false;
        }
    }
    static baslat() {
        if (!env.KURULUM_MODU || zamanlayici)
            return;
        setTimeout(() => void this.kuyruguBosalt(), 60_000).unref();
        zamanlayici = setInterval(() => void this.kuyruguBosalt(), KUYRUK_ARALIGI_MS);
        zamanlayici.unref();
    }
    // ------------------------------------------------------------------- Okuma ---
    /** Merkezden liste (60 sn önbellek); ulaşılamazsa diskteki son liste. Bekleyen talepler listeye eklenir. */
    static async tumListe(k) {
        const anahtar = `liste:${k.kullaniciAdi}`;
        const bellek = listeOnbellek.get(k.kullaniciAdi);
        let liste = bellek && Date.now() - bellek.zaman < LISTE_ONBELLEK_MS ? bellek.liste : null;
        let cevrimdisi = false;
        if (!liste) {
            try {
                liste = (await this.merkez(k, "/konular")).konular;
                listeOnbellek.set(k.kullaniciAdi, { liste, zaman: Date.now() });
                void this.onbellekYaz(anahtar, liste);
                void this.kuyruguBosalt();
            }
            catch (err) {
                if (!(err instanceof CevrimdisiHatasi))
                    throw err;
                cevrimdisi = true;
                liste = (await this.onbellekOku(anahtar)) ?? [];
            }
        }
        const durumlar = await this.okumaDurumlari(k.kullaniciAdi);
        const bekleyenler = (await this.kuyrukSatirlari(`DURUM = 'BEKLIYOR' AND TUR = 'TALEP' AND KULLANICI_ADI = @k`, (q) => q.input("k", sql.NVarChar(50), k.kullaniciAdi))).map((r) => this.bekleyenTalepKonusu(r));
        return { liste: [...bekleyenler, ...this.yerelDurumUygula(liste, durumlar)], cevrimdisi };
    }
    static async ozet(u) {
        const k = await this.kullanici(u);
        try {
            const { liste, cevrimdisi } = await this.tumListe(k);
            return {
                okunmamis: liste.filter((x) => x.okunmamis && !x.arsiv).length,
                onemli: liste.filter((x) => x.tur === "BILDIRIM" && x.onemli && !x.onemliOkundu),
                kurulu: true,
                cevrimdisi,
            };
        }
        catch {
            return { okunmamis: 0, onemli: [], kurulu: false, cevrimdisi: true };
        }
    }
    static async konular(u, sekme) {
        const k = await this.kullanici(u);
        const { liste, cevrimdisi } = await this.tumListe(k);
        const konular = liste.filter((x) => sekme === "arsiv" ? x.arsiv : sekme === "talepler" ? !x.arsiv && x.tur === "TALEP" : sekme === "bildirimler" ? !x.arsiv && x.tur !== "TALEP" : !x.arsiv);
        return { konular, cevrimdisi };
    }
    static async konu(u, id) {
        const k = await this.kullanici(u);
        if (id < 0) {
            const r = (await this.kuyrukSatirlari(`ID = @id AND TUR = 'TALEP'`, (q) => q.input("id", sql.Int, -id)))[0];
            if (!r)
                throw ApiError.notFound("Kayıt bulunamadı.");
            const konu = this.bekleyenTalepKonusu(r);
            const ilk = this.bekleyenMesaj(r);
            ilk.ekler = (JSON.parse(r.GOVDE).ekler || []).map((e, i) => ({ ekId: -(r.ID * 10 + i), dosyaAdi: e.dosyaAdi, mime: e.mime, boyut: 0, silindi: false }));
            const mesajlar = (await this.kuyrukSatirlari(`DURUM = 'BEKLIYOR' AND TUR = 'MESAJ' AND YEREL_KONU_ANAHTAR = @ya`, (q) => q.input("ya", sql.VarChar(60), r.YEREL_ANAHTAR))).map((m) => this.bekleyenMesaj(m));
            if (r.DURUM === "GONDERILDI" && r.MERKEZ_KONU_ID)
                return this.konu(u, r.MERKEZ_KONU_ID);
            return { konu, mesajlar: [ilk, ...mesajlar], cevrimdisi: true };
        }
        let detay;
        let cevrimdisi = false;
        try {
            detay = await this.merkez(k, `/konular/${id}`);
            void this.onbellekYaz(`konu:${id}`, detay);
        }
        catch (err) {
            if (!(err instanceof CevrimdisiHatasi))
                throw err;
            const eski = await this.onbellekOku(`konu:${id}`);
            if (!eski)
                throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Merkeze ulaşılamıyor; bu kayıt daha önce indirilmemiş.");
            detay = eski;
            cevrimdisi = true;
        }
        const durumlar = await this.okumaDurumlari(k.kullaniciAdi);
        detay.konu = this.yerelDurumUygula([detay.konu], durumlar)[0];
        if (detay.konu.okunmamis && detay.konu.karsiSonMesajId) {
            await this.okumaYaz(k.kullaniciAdi, id, "SON_OKUNAN_MESAJ_ID", detay.konu.karsiSonMesajId);
            detay.konu.okunmamis = false;
            listeOnbellek.delete(k.kullaniciAdi);
        }
        const bekleyenler = (await this.kuyrukSatirlari(`DURUM = 'BEKLIYOR' AND TUR = 'MESAJ' AND MERKEZ_KONU_ID = @id`, (q) => q.input("id", sql.Int, id))).map((m) => this.bekleyenMesaj(m));
        return { ...detay, mesajlar: [...detay.mesajlar, ...bekleyenler], cevrimdisi };
    }
    // ------------------------------------------------------------------- Yazma ---
    static async talepAc(u, g) {
        const k = await this.kullanici(u);
        const yerelAnahtar = crypto.randomUUID();
        try {
            const d = await this.merkez(k, "/talepler", { method: "POST", govde: { ...g, yerelAnahtar } });
            listeOnbellek.delete(k.kullaniciAdi);
            return d;
        }
        catch (err) {
            if (!(err instanceof CevrimdisiHatasi))
                throw err;
            const id = await this.kuyrukEkle(k, { tur: "TALEP", yerelAnahtar, govde: g });
            return this.konu(u, -id);
        }
    }
    static async mesajYaz(u, id, g) {
        const k = await this.kullanici(u);
        const yerelAnahtar = crypto.randomUUID();
        if (id < 0) {
            const r = (await this.kuyrukSatirlari(`ID = @id AND TUR = 'TALEP'`, (q) => q.input("id", sql.Int, -id)))[0];
            if (!r)
                throw ApiError.notFound("Kayıt bulunamadı.");
            if (r.DURUM === "GONDERILDI" && r.MERKEZ_KONU_ID)
                return this.mesajYaz(u, r.MERKEZ_KONU_ID, g);
            await this.kuyrukEkle(k, { tur: "MESAJ", yerelKonuAnahtar: r.YEREL_ANAHTAR, yerelAnahtar, govde: g });
            return this.konu(u, id);
        }
        try {
            const d = await this.merkez(k, `/konular/${id}/mesajlar`, { method: "POST", govde: { ...g, yerelAnahtar } });
            listeOnbellek.delete(k.kullaniciAdi);
            void this.onbellekYaz(`konu:${d.konu.konuId}`, d);
            return d;
        }
        catch (err) {
            if (!(err instanceof CevrimdisiHatasi))
                throw err;
            await this.kuyrukEkle(k, { tur: "MESAJ", merkezKonuId: id, yerelAnahtar, govde: g });
            return this.konu(u, id);
        }
    }
    static async okundu(u, konuId) {
        const k = await this.kullanici(u);
        if (konuId) {
            if (konuId < 0)
                return;
            const bellek = listeOnbellek.get(k.kullaniciAdi)?.liste.find((x) => x.konuId === konuId);
            await this.okumaYaz(k.kullaniciAdi, konuId, "SON_OKUNAN_MESAJ_ID", bellek?.karsiSonMesajId ?? 2_000_000_000);
        }
        else {
            const { liste } = await this.tumListe(k);
            for (const x of liste)
                if (x.konuId > 0 && x.karsiSonMesajId)
                    await this.okumaYaz(k.kullaniciAdi, x.konuId, "SON_OKUNAN_MESAJ_ID", x.karsiSonMesajId);
        }
        listeOnbellek.delete(k.kullaniciAdi);
    }
    static async bayrak(u, id, alan, deger) {
        if (id < 0)
            return;
        const k = await this.kullanici(u);
        await this.okumaYaz(k.kullaniciAdi, id, alan, deger);
        listeOnbellek.delete(k.kullaniciAdi);
    }
    /** Ek görsel merkezden akıtılır (yerelde saklanmaz). */
    static async ek(u, id, res) {
        if (id < 0)
            throw ApiError.notFound("Görsel henüz merkeze gönderilmedi.");
        const k = await this.kullanici(u);
        let r;
        try {
            r = await fetch(`${merkezAdresi()}/api/v1/merkez/destek/ek/${id}`, { headers: this.basliklar(k, false) });
        }
        catch {
            throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "Merkeze ulaşılamıyor; görsel şu an açılamıyor.");
        }
        if (!r.ok)
            throw new ApiError(r.status === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY, "Görsel alınamadı.");
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.type(r.headers.get("content-type") || "application/octet-stream");
        res.end(Buffer.from(await r.arrayBuffer()));
    }
}

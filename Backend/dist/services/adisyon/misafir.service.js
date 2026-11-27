import crypto from "node:crypto";
import sql from "mssql";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { ApiError } from "../../utils/ApiError.js";
import { AdisyonTanimSqlRepository } from "../../models/adisyonTanimSql.repository.js";
import { AdisyonSqlRepository as A } from "../../models/adisyonSql.repository.js";
import { AdisyonHesapSqlRepository as HS } from "../../models/adisyonHesapSql.repository.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { firmaDbAnahtari } from "../admin/firmaBaglanti.service.js";
import { KurulumLisansService } from "../kurulum/kurulumLisans.service.js";
import { musteriNoTemizle } from "../merkezGiris.service.js";
import { PIN_IP_KILIT_MS, pinKilidi } from "./girisSiniri.js";
import { GarsonAuthService } from "./garsonAuth.service.js";
import { olayYaz } from "./adisyonOlay.service.js";
/**
 * Masadaki misafir (docs/TICARI_ADISYON_YOL_HARITASI.md §11, M1–M8): restorana gelen müşteri kendi masasına QR kodu ve / veya
 * adisyona özel 6 haneli PIN ile girer, menüyü görür, sipariş verir, adisyonunu görür, hesap ister. Ödeme / iptal / ikram yok.
 *  - Masa açık değilse (adisyon yok) misafir giremez: masayı garson / kasa açar ve PIN'i misafire söyler (M2).
 *  - PIN adisyona özeldir; adisyon kapanınca / iptalde ya da PIN yenilenince eski PIN ve misafir oturumları geçersizdir (M3).
 *  - QR yalnız masayı tanıtır (PIN olmadan sipariş verilmez, evden QR fotoğrafıyla sipariş olmaz); QR ile girilince PIN o masanın
 *    adisyonunun PIN'i olmalı (M4).
 *  - Firmada "Masadan misafir siparişi" ayarı kapalıysa (varsayılan) hiçbir misafir ucu çalışmaz (M5).
 *  - Kötüye kullanım sınırları: IP başına 5 hatalı PIN → 15 dk (aynı ileti), siparişte en çok 20 satır / satırda 20 adet,
 *    misafir oturumu başına 5 dakikada en çok 10 sipariş (M6).
 */
export const MISAFIR_PIN_UZUNLUK = 6;
export const MISAFIR_EN_COK_SATIR = 20;
export const MISAFIR_EN_COK_ADET = 20;
export const MISAFIR_SIPARIS_SINIRI = 10; // 5 dakikada
const GIRIS_HATASI = "Masa PIN'i hatalı ya da masa kapanmış. PIN'i garsonunuzdan isteyin.";
const KILIT_ILETISI = `Çok fazla hatalı deneme. ${PIN_IP_KILIT_MS / 60000} dakika sonra tekrar deneyin ya da garsonunuzu çağırın.`;
const KAPALI = "Bu restoranda masadan sipariş kapalı. Lütfen garsonunuzu çağırın.";
const JETON_SURESI = "6h";
const ACIK = "A.TUR = 1 AND A.DURUM IN (0, 1)";
const gizi = () => crypto.createHmac("sha256", env.ADMIN_JWT_SECRET || env.JWT_ACCESS_SECRET).update("likya-adisyon-misafir").digest("hex");
const parmak = (v) => crypto.createHash("sha256").update(v).digest("hex").slice(0, 16);
const temiz = (v) => String(v ?? "").trim();
const kilitli = () => new ApiError(423, KILIT_ILETISI, { kod: "KILITLI" });
/** PIN biçimi: tam 6 rakam (saf) */
export const misafirPinGecerli = (pin) => new RegExp(`^\\d{${MISAFIR_PIN_UZUNLUK}}$`).test(String(pin ?? ""));
/** QR anahtarı biçimi: 24–40 karakter base64url (saf) */
export const qrGecerli = (q) => /^[A-Za-z0-9_-]{24,40}$/.test(String(q ?? ""));
/** Rastgele 6 haneli PIN (100000–999999; baştaki sıfır karışıklık çıkarmasın) */
export const yeniMisafirPini = () => String(crypto.randomInt(100000, 1000000));
export const yeniQrAnahtari = () => crypto.randomBytes(18).toString("base64url"); // 24 karakter
/** Misafir siparişinin satırları (saf; test edilir): yalnız ürün / miktar / porsiyon / seçenek / not; fiyat, ikram vb. alınmaz */
export function misafirKalemleri(kalemler) {
    if (!Array.isArray(kalemler) || !kalemler.length)
        return { hata: "Sepet boş." };
    if (kalemler.length > MISAFIR_EN_COK_SATIR)
        return { hata: `Bir siparişte en çok ${MISAFIR_EN_COK_SATIR} satır gönderilebilir.` };
    const l = [];
    for (const k of kalemler) {
        const miktar = Number(k?.miktar);
        if (!Number.isInteger(miktar) || miktar < 1 || miktar > MISAFIR_EN_COK_ADET)
            return { hata: `Adet 1 ile ${MISAFIR_EN_COK_ADET} arasında tam sayı olmalı.` };
        const stokKartId = Number(k?.stokKartId);
        if (!Number.isInteger(stokKartId) || stokKartId <= 0)
            return { hata: "Geçersiz ürün." };
        l.push({ stokKartId, miktar, porsiyonId: k?.porsiyonId == null ? null : Number(k.porsiyonId), secenekIdler: Array.isArray(k?.secenekIdler) ? k.secenekIdler.map(Number).slice(0, 20) : [],
            notu: k?.notu ? temiz(k.notu).slice(0, 100) : null });
    }
    return l;
}
const siparisSayaci = new Map();
/** Misafir oturumu başına sipariş sınırı (saf, bellek içi): izin varsa true */
export function misafirSiparisIzni(sid, simdi = Date.now()) {
    const l = (siparisSayaci.get(sid) || []).filter((t) => simdi - t < 5 * 60_000);
    if (l.length >= MISAFIR_SIPARIS_SINIRI) {
        siparisSayaci.set(sid, l);
        return false;
    }
    l.push(simdi);
    siparisSayaci.set(sid, l);
    if (siparisSayaci.size > 5000)
        for (const [k, v] of siparisSayaci)
            if (!v.length || simdi - v[v.length - 1] > 5 * 60_000)
                siparisSayaci.delete(k);
    return true;
}
export const misafirSayaclariSifirla = () => siparisSayaci.clear();
async function havuz(ctx) { return AdisyonTanimSqlRepository.havuz(ctx); }
async function acikMi(ctx) { return (await AdisyonTanimSqlRepository.ayarlar(ctx)).misafirSiparis; }
export const MisafirService = {
    // ───────────── Personel tarafı (kasa / garson) ─────────────
    /** Firmanın müşteri no'su (QR adresine yazılır); bilinmiyorsa null (istemci kendi bildiğini kullanır) */
    async musteriNo(ctx) {
        try {
            if (env.KURULUM_MODU)
                return (await KurulumLisansService.durum()).musteriNo || null;
            if (!ctx?.dbServer || !ctx?.dbName)
                return null;
            const f = await FirmaSqlRepository.anahtarIleBul(firmaDbAnahtari(ctx.dbServer, ctx.dbName).anahtar);
            return f?.musteriNo || null;
        }
        catch {
            return null;
        }
    },
    /**
     * Adisyonun misafir PIN'i: yoksa üretilir; yenile = yeni PIN (eski PIN ve misafir oturumları düşer). Yalnız açık masa adisyonu.
     * PIN açık öbür adisyonlarınkiyle çakışmaz (kilitli denetim).
     */
    async pin(ctx, adisyonId, yenile = false) {
        if (!(await acikMi(ctx)))
            throw ApiError.badRequest("Masadan misafir siparişi kapalı (Restorant › Ayarlar).");
        const pool = await havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const a = (await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT A.TUR, A.DURUM, A.MISAFIR_PIN, RTRIM(M.AD) AS MASA, RTRIM(B.AD) AS BOLGE FROM dbo.TODVZ_ADISYON A WITH (UPDLOCK, ROWLOCK)
        LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID LEFT JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID WHERE A.ADISYON_ID = @A`)).recordset[0];
            if (!a)
                throw ApiError.notFound("Adisyon bulunamadı.");
            if (Number(a.TUR) !== 1)
                throw ApiError.badRequest("Misafir PIN'i yalnız masa adisyonunda verilir.");
            if (![0, 1].includes(Number(a.DURUM)))
                throw ApiError.conflict("Adisyon kapanmış.");
            let pin = a.MISAFIR_PIN ? temiz(a.MISAFIR_PIN) : "";
            if (!pin || yenile) {
                pin = "";
                for (let i = 0; i < 30 && !pin; i++) {
                    const aday = yeniMisafirPini();
                    const r = await new sql.Request(tx).input("P", sql.Char(6), aday).input("A", sql.Int, adisyonId)
                        .query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_ADISYON A WITH (UPDLOCK, HOLDLOCK) WHERE A.MISAFIR_PIN = @P AND ${ACIK} AND A.ADISYON_ID <> @A`);
                    if (!Number(r.recordset[0].N) && aday !== temiz(a.MISAFIR_PIN))
                        pin = aday;
                }
                if (!pin)
                    throw new ApiError(HttpStatus.SERVICE_UNAVAILABLE, "PIN üretilemedi; yeniden deneyin.");
                await new sql.Request(tx).input("P", sql.Char(6), pin).input("A", sql.Int, adisyonId).query(`UPDATE dbo.TODVZ_ADISYON SET MISAFIR_PIN = @P WHERE ADISYON_ID = @A`);
            }
            await tx.commit();
            return { pin, masa: [temiz(a.BOLGE), temiz(a.MASA)].filter(Boolean).join(" › "), musteriNo: await this.musteriNo(ctx) };
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
    },
    /** Masaların QR anahtarları (eksik olanlar üretilir); masaId + yenile verilirse o masanın anahtarı yenilenir (eski QR çalışmaz) */
    async qrListesi(ctx, yenileMasaId) {
        const pool = await havuz(ctx);
        if (yenileMasaId) {
            const r = await pool.request().input("M", sql.Int, yenileMasaId).input("Q", sql.VarChar(40), yeniQrAnahtari()).query(`UPDATE dbo.TODVZ_ADISYON_MASA SET QR_ANAHTAR = @Q WHERE MASA_ID = @M; SELECT @@ROWCOUNT AS N;`);
            if (!Number(r.recordset[0].N))
                throw ApiError.notFound("Masa bulunamadı.");
        }
        const eksik = (await pool.request().query(`SELECT MASA_ID FROM dbo.TODVZ_ADISYON_MASA WHERE QR_ANAHTAR IS NULL`)).recordset;
        for (const m of eksik)
            await pool.request().input("M", sql.Int, m.MASA_ID).input("Q", sql.VarChar(40), yeniQrAnahtari()).query(`UPDATE dbo.TODVZ_ADISYON_MASA SET QR_ANAHTAR = @Q WHERE MASA_ID = @M AND QR_ANAHTAR IS NULL`);
        const l = (await pool.request().query(`SELECT M.MASA_ID, RTRIM(M.AD) AS AD, M.QR_ANAHTAR, M.AKTIF, B.BOLGE_ID, RTRIM(B.AD) AS BOLGE FROM dbo.TODVZ_ADISYON_MASA M
      JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID ORDER BY B.SIRA, B.AD, M.SIRA, M.MASA_ID`)).recordset;
        return { musteriNo: await this.musteriNo(ctx), acik: await acikMi(ctx),
            masalar: l.map((x) => ({ masaId: Number(x.MASA_ID), ad: temiz(x.AD), bolgeId: Number(x.BOLGE_ID), bolge: temiz(x.BOLGE), aktif: !!x.AKTIF, anahtar: temiz(x.QR_ANAHTAR) })) };
    },
    // ───────────── Misafir tarafı ─────────────
    /** QR okutulunca: masa adı + açık mı (PIN sorulmadan önce; adisyon içeriği dönmez) */
    async qr(musteriNo, q) {
        const fl = await GarsonAuthService.firmalar(musteriNo);
        if (!fl.length)
            throw ApiError.notFound("Restoran bulunamadı.");
        if (!qrGecerli(q))
            throw ApiError.notFound("Masa kodu geçersiz. Masadaki kodu yeniden okutun.");
        for (const f of fl) {
            const r = (await (await havuz(f.ctx)).request().input("Q", sql.VarChar(40), q).query(`SELECT M.MASA_ID, RTRIM(M.AD) AS AD, RTRIM(B.AD) AS BOLGE, M.AKTIF,
          (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON A WHERE A.MASA_ID = M.MASA_ID AND ${ACIK}) AS ACIK
        FROM dbo.TODVZ_ADISYON_MASA M JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID WHERE M.QR_ANAHTAR = @Q`)).recordset[0];
            if (!r || !r.AKTIF)
                continue;
            if (!(await acikMi(f.ctx)))
                throw new ApiError(HttpStatus.FORBIDDEN, KAPALI, { kod: "KAPALI" });
            return { kisaAd: f.kisaAd, masa: [temiz(r.BOLGE), temiz(r.AD)].filter(Boolean).join(" › "), masaAcik: Number(r.ACIK) > 0 };
        }
        throw ApiError.notFound("Masa kodu geçersiz ya da yenilenmiş. Garsonunuzdan PIN'i isteyin.");
    },
    jeton(p) {
        return jwt.sign({ tur: "MISAFIR", ...p }, gizi(), { expiresIn: JETON_SURESI });
    },
    /** Giriş: müşteri no + PIN (+ QR: PIN o masanın adisyonunun olmalı). Bütün hatalarda aynı ileti; IP başına 5 hatada 15 dk kilit */
    async giris(g, istemci) {
        const no = musteriNoTemizle(String(g.musteriNo || "")), pin = temiz(g.pin), qr = g.qr ? temiz(g.qr) : null;
        const anahtar = `m|${no}|${istemci.ip}`;
        if (pinKilidi.kilitliMi(anahtar))
            throw kilitli();
        const hata = () => { if (pinKilidi.hata(anahtar))
            return kilitli(); return ApiError.unauthorized(GIRIS_HATASI); };
        const tumu = await GarsonAuthService.firmalar(no);
        if (!tumu.length)
            throw hata();
        const fl = [];
        for (const f of tumu)
            if (await acikMi(f.ctx))
                fl.push(f);
        if (!fl.length)
            throw new ApiError(HttpStatus.FORBIDDEN, KAPALI, { kod: "KAPALI" });
        if (!misafirPinGecerli(pin) || (qr !== null && !qrGecerli(qr)))
            throw hata();
        for (const f of fl) {
            const r = (await (await havuz(f.ctx)).request().input("P", sql.Char(6), pin).input("Q", sql.VarChar(40), qr).query(`SELECT A.ADISYON_ID FROM dbo.TODVZ_ADISYON A
        JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID WHERE A.MISAFIR_PIN = @P AND ${ACIK} AND (@Q IS NULL OR M.QR_ANAHTAR = @Q)`)).recordset;
            if (r.length !== 1)
                continue;
            pinKilidi.temizle(anahtar);
            const adisyonId = Number(r[0].ADISYON_ID);
            const token = this.jeton({ fid: f.firmaId, aid: adisyonId, pv: parmak(`${adisyonId}|${pin}`) });
            return { token, ...(await this.ozet(await this.baglam(token))) };
        }
        throw hata();
    },
    /** Her istekte: jeton, firma (Restorant açık), ayar açık, adisyon hâlâ açık ve PIN değişmemiş */
    async baglam(token) {
        let p;
        try {
            p = jwt.verify(token, gizi());
        }
        catch {
            throw ApiError.unauthorized("Oturum süresi doldu. Masa PIN'iyle yeniden girin.");
        }
        if (p?.tur !== "MISAFIR" || !Number.isInteger(p.aid))
            throw ApiError.unauthorized("Geçersiz oturum.");
        const f = await GarsonAuthService.firma(Number(p.fid));
        if (!f)
            throw ApiError.unauthorized("Restoran şu an hizmet vermiyor.");
        if (!(await acikMi(f.ctx)))
            throw new ApiError(HttpStatus.UNAUTHORIZED, KAPALI, { kod: "KAPALI" });
        const a = (await (await havuz(f.ctx)).request().input("A", sql.Int, p.aid).query(`SELECT A.MISAFIR_PIN, A.TUR, A.DURUM, A.MASA_ID, RTRIM(M.AD) AS MASA, RTRIM(B.AD) AS BOLGE, M.BOLGE_ID
      FROM dbo.TODVZ_ADISYON A LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID LEFT JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID WHERE A.ADISYON_ID = @A`)).recordset[0];
        if (!a || Number(a.TUR) !== 1 || ![0, 1].includes(Number(a.DURUM)))
            throw ApiError.unauthorized("Masanın hesabı kapandı. İyi günler dileriz.");
        if (!a.MISAFIR_PIN || parmak(`${p.aid}|${temiz(a.MISAFIR_PIN)}`) !== p.pv)
            throw ApiError.unauthorized("Masa PIN'i değişti. Yeni PIN'i garsonunuzdan isteyin.");
        return { firmaId: f.firmaId, ctx: f.ctx, adisyonId: p.aid, masaId: a.MASA_ID ?? null, masa: [temiz(a.BOLGE), temiz(a.MASA)].filter(Boolean).join(" › "),
            bolgeId: a.BOLGE_ID ?? null, kisaAd: f.kisaAd, sid: `${p.fid}|${p.aid}|${p.pv}` };
    },
    /** Misafirin gördüğü adisyon: ürün, adet, tutar, mutfak durumu, toplam (personel adları, nedenler, ödemeler dönmez) */
    async ozet(b) {
        const d = await A.getir(b.ctx, b.adisyonId);
        return {
            kisaAd: b.kisaAd, masa: b.masa, hesapIstendi: Number(d.durum) === 1,
            kalemler: (d.kalemler || []).filter((k) => !k.iptal).map((k) => ({ ad: k.ad, porsiyon: k.porsiyonAd, secim: k.secimMetni || null, miktar: k.miktar, tutar: k.tutar, ikram: !!k.ikram, durum: k.durum })),
            toplam: d.toplam?.toplam ?? 0, servis: d.toplam?.servis ?? 0,
        };
    },
    /** Misafir menüsü: tartılı / fiyatsız ürün yok; barkod, ürün kodu, reçete bilgisi dönmez */
    async menu(b) {
        const m = await A.menu(b.ctx, b.bolgeId);
        return { ...m, urunler: (m.urunler || []).filter((u) => !u.tartili && u.fiyat !== null).map((u) => ({ ...u, kod: "", barkodlar: [], receteli: false })) };
    },
    async siparis(b, g) {
        const kalemler = misafirKalemleri(g.kalemler);
        if ("hata" in kalemler)
            throw ApiError.badRequest(kalemler.hata);
        if (!misafirSiparisIzni(b.sid))
            throw new ApiError(429, "Kısa sürede çok fazla sipariş gönderildi. Lütfen garsonunuzu çağırın.");
        const kim = { garsonId: null, kullaniciId: null, ad: `Misafir (${b.masa})`.slice(0, 60), yetkiler: ["siparis"] };
        await A.siparis(b.ctx, { istekId: String(g.istekId || ""), adisyonId: b.adisyonId, masaId: b.masaId, kalemler }, kim);
        return this.ozet(b);
    },
    async hesapIste(b) {
        await HS.hesapIste(b.ctx, b.adisyonId, { garsonId: null, kullaniciId: null, ad: `Misafir (${b.masa})`.slice(0, 60), yetkiler: ["hesap-iste"] });
        return this.ozet(b);
    },
    /** Garson çağır: garson / kasa ekranlarına olay düşer (masa adıyla) */
    async garsonCagir(b) {
        if (!misafirSiparisIzni(`c|${b.sid}`))
            throw new ApiError(429, "Garsonunuz çağrıldı; birazdan gelecek.");
        const pool = await havuz(b.ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await olayYaz(tx, "cagri", { adisyonId: b.adisyonId, masaId: b.masaId, veri: { masa: b.masa } });
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        return { cagrildi: true };
    },
};

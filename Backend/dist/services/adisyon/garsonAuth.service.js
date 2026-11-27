import crypto from "node:crypto";
import sql from "mssql";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { SureliOnbellek } from "../../utils/sureliOnbellek.js";
import { PIN_IP_KILIT_MS, pinKilidi } from "./girisSiniri.js";
import { AdisyonTanimSqlRepository } from "../../models/adisyonTanimSql.repository.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { firmaDbContextHazirla } from "../admin/firmaBaglanti.service.js";
import { firmaEngeli, musteriNoTemizle } from "../merkezGiris.service.js";
import { KurulumLisansService } from "../kurulum/kurulumLisans.service.js";
import { kurulumBaglantisiniKaydet, kurulumDbContext } from "../kurulum/kurulumDb.js";
import { kisaAdUret } from "../mobil/mobilKural.js";
import { yetkiKumesi } from "./adisyonHesap.js";
import { GarsonSifre } from "./garsonSifre.js";
/**
 * Garson girişi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA23–TA25, D4; 26.11.2026 §11 G1–G4): ayrı adres (/garson), müşteri no +
 * kullanıcı adı + şifre. Garson kartı Kullanıcı Tanımları'ndaki bir kullanıcıya bağlıdır; şifre o kullanıcınınkidir (normal girişle aynı),
 * garson yetkileri (seviye, ek yetkiler) garson kartından gelir. PIN ve "bu cihazı hatırla" kalktı (G4). Normal giriş ekranına / oturum
 * tablosuna dokunmaz. Jeton ayrı gizle imzalanır (personel / mobil jetonu buraya, garson jetonu onlara geçmez); şifre sürümünün parmak
 * izini taşır: şifre değişince, kullanıcı pasif olunca ya da kart başka kullanıcıya bağlanınca eski jetonlar düşer.
 * Kilit: aynı IP'den aynı hesaba 5 hata → o IP 15 dk; farklı IP'lerden toplam 20 hata → hesap 15 dk (Y5).
 */
/** Hesabın tamamının kilitlendiği hata sayısı (farklı IP'lerden; aynı IP 5 hatada kilitlenir — girisSiniri.ts pinKilidi, Y5) */
export const GARSON_HATALI_ESIK = 20;
export const GARSON_KILIT_DAKIKA = 15;
const GIRIS_HATASI = "Müşteri no, kullanıcı adı ya da şifre hatalı.";
/** Kilit iletisi — IP / hesap kilidinde, var olan ve olmayan adda aynı (ad tahmini yapılamasın) */
const KILIT_ILETISI = `Çok fazla hatalı deneme. ${PIN_IP_KILIT_MS / 60000} dakika sonra tekrar deneyin.`;
const JETON_SURESI = "16h";
const gizi = () => crypto.createHmac("sha256", env.ADMIN_JWT_SECRET || env.JWT_ACCESS_SECRET).update("likya-adisyon-garson-2").digest("hex");
const temiz = (v) => String(v ?? "").trim();
const durumOnbellegi = new SureliOnbellek(30_000, 500);
const kilitli = () => new ApiError(423, KILIT_ILETISI, { kod: "KILITLI" });
/** Firmada Restorant (adisyon) açık mı (null = kısıtsız) */
const adisyonAcik = (moduller) => !moduller || moduller.includes("adisyon");
/** Garson kartı + bağlı kullanıcı (firma veritabanı). Kullanıcı adı büyük / küçük harf duyarsız (veritabanı harmanlaması) */
const secim = (kilit = false, ek = "") => `SELECT ${ek}G.GARSON_ID, G.AD, G.SEVIYE, G.EK_YETKI, G.AKTIF, CASE WHEN G.KILIT_BITIS > GETDATE() THEN 1 ELSE 0 END AS KILITLI,
    U.KULLANICI_ID, RTRIM(U.AD) AS KULLANICI_AD, U.SIFRE
  FROM dbo.TODVZ_ADISYON_GARSON G${kilit ? " WITH (UPDLOCK, ROWLOCK)" : ""} JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID = G.KULLANICI_ID`;
const bagli = (x) => ({ kullaniciId: Number(x.KULLANICI_ID), ad: temiz(x.KULLANICI_AD), sifre: x.SIFRE == null ? null : String(x.SIFRE) });
export const GarsonAuthService = {
    /**
     * Müşteri no → Restorant'ı açık, kullanılabilir firmalar (aynı müşteri noda birden çok veritabanı olabilir). Kurulumda (exe) tek
     * yerel veritabanı (lisanstaki müşteri no ile). Test sunucusu bu işlevi yerel veritabanına bağlamak için değiştirebilir.
     */
    async firmalar(musteriNo) {
        const no = musteriNoTemizle(musteriNo);
        if (!no)
            return [];
        if (env.KURULUM_MODU) {
            const d = await KurulumLisansService.durum();
            if ((d.musteriNo && musteriNoTemizle(d.musteriNo) !== no) || !adisyonAcik(d.moduller))
                return [];
            kurulumBaglantisiniKaydet();
            return [{ firmaId: 0, kisaAd: "Likya", ctx: kurulumDbContext() }];
        }
        const liste = (await FirmaSqlRepository.musteriNoIleListele(no)).sort((a, b) => a.firmaId - b.firmaId);
        const sonuc = [];
        for (const f of liste) {
            const g = await this.firma(f.firmaId);
            if (g)
                sonuc.push(g);
        }
        return sonuc;
    },
    /** Kimlikten firma (jeton doğrulaması her istekte; 30 sn önbellek) */
    async firma(firmaId) {
        if (env.KURULUM_MODU && firmaId === 0) {
            kurulumBaglantisiniKaydet();
            return { firmaId: 0, kisaAd: "Likya", ctx: kurulumDbContext() };
        }
        return durumOnbellegi.al(String(firmaId), async () => {
            const f = await FirmaSqlRepository.idIleBul(firmaId);
            if (!f || firmaEngeli(f) || f.baglantiModu === "setup")
                return null;
            if (!adisyonAcik(await ModulSqlRepository.firmaAcikModulleri(firmaId)))
                return null;
            return { firmaId, kisaAd: kisaAdUret(f.unvan, null), ctx: await firmaDbContextHazirla(firmaId) };
        }, () => true);
    },
    onbellekTemizle() { durumOnbellegi.temizle(); },
    /** Giriş ekranı: müşteri no geçerli ve Restorant açık mı; kısa ad (marka) */
    async bilgi(musteriNo) {
        const f = (await this.firmalar(musteriNo))[0];
        if (!f)
            throw ApiError.notFound("Müşteri no bulunamadı ya da Restorant'a açık değil.");
        return { musteriNo: musteriNoTemizle(musteriNo), kisaAd: f.kisaAd };
    },
    jeton(p) {
        // jti (Y10): çıkışta bu jeton süresi dolana kadar geçersiz yazılır
        return jwt.sign({ tur: "GARSON", ...p, jti: crypto.randomBytes(12).toString("hex") }, gizi(), { expiresIn: JETON_SURESI });
    },
    /** Hatalı deneme sayacı reddedilen girişte de kalmalı: hata "kalici" ise işlem yine de onaylanır */
    async islem(ctx, f) {
        const pool = await AdisyonTanimSqlRepository.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const r = await f(tx);
            await tx.commit();
            return r;
        }
        catch (e) {
            if (e?.kalici)
                await tx.commit().catch(() => undefined);
            else
                await tx.rollback().catch(() => undefined);
            throw e;
        }
    },
    async logla(firmaId, ad, basarili, istemci, neden) {
        if (env.KURULUM_MODU)
            return;
        try {
            await AdminLogSqlRepository.girisLogu({ tur: "GARSON", firmaId: firmaId || null, kullaniciAdi: ad.slice(0, 100), basarili, redNedeni: neden, ...istemci });
        }
        catch (e) {
            logger.warn(`[Adisyon] Garson giriş kaydı yazılamadı: ${e.message}`);
        }
    },
    /**
     * Lisanstaki garson sınırı girişte de denetlenir (Y11, 26.11.2026 denetimi): sınır yalnız garson etkinleştirilirken bakılıyordu;
     * lisans düşürülünce fazla etkin garsonlar girmeye devam ediyordu. Sınır N ise kimlik sırasıyla ilk N etkin garson girer.
     * Lisans bilgisi okunamazsa (lisans sunucusu yanıt vermiyor) giriş engellenmez — restoran çalışmaya devam eder; uyarı günlüğe yazılır.
     */
    async sinirDenetle(ctx, tx, garsonId) {
        const limit = await AdisyonTanimSqlRepository.garsonLimiti(ctx);
        if (limit === null)
            return;
        const r = await new sql.Request(tx).input("G", sql.Int, garsonId).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_ADISYON_GARSON WHERE AKTIF = 1 AND GARSON_ID < @G`);
        if (Number(r.recordset[0]?.N) >= limit)
            throw new ApiError(HttpStatus.FORBIDDEN, `Lisanstaki garson sınırı (${limit}) aşıldı; bu garson giriş yapamaz. Yöneticiniz bir garsonu pasif yapmalı ya da lisansı yükseltmeli.`, { kod: "SINIR" });
    },
    /**
     * Şifre denetimi + kilit (işlem içinde, garson satırı kilitli: aynı hesaba eşzamanlı denemeler sırayla sayılır). Şifre doğru olsa
     * bile kilitliyken girilmez. Yanlış şifrede IP sayacı (5 → 15 dk) ve hesap sayacı (20 → 15 dk) artar.
     */
    async sifreDenetle(tx, f, garsonId, sifre, ip) {
        const g = (await new sql.Request(tx).input("G", sql.Int, garsonId).query(`${secim(true)} WHERE G.GARSON_ID = @G`)).recordset[0];
        if (!g) {
            await GarsonSifre.denetle(f.firmaId, null, sifre);
            throw ApiError.unauthorized(GIRIS_HATASI);
        }
        const k = bagli(g);
        const ipAnahtari = `g|${f.firmaId}|${garsonId}|${k.kullaniciId}|${ip}`;
        if (g.KILITLI || pinKilidi.kilitliMi(ipAnahtari)) {
            await GarsonSifre.denetle(f.firmaId, null, sifre);
            throw kilitli();
        }
        const s = await GarsonSifre.denetle(f.firmaId, k, sifre);
        if (!s.dogru && s.hata)
            throw s.hata; // şifre doğru ama hesap pasif / şifre geçici
        if (!s.dogru) {
            if (pinKilidi.hata(ipAnahtari)) {
                await new sql.Request(tx).input("G", sql.Int, garsonId).query(`UPDATE dbo.TODVZ_ADISYON_GARSON SET HATALI_DENEME = HATALI_DENEME + 1 WHERE GARSON_ID = @G`);
                throw Object.assign(kilitli(), { kalici: true });
            }
            const r = await new sql.Request(tx).input("G", sql.Int, garsonId).input("E", sql.Int, GARSON_HATALI_ESIK).input("D", sql.Int, GARSON_KILIT_DAKIKA).query(`
        UPDATE dbo.TODVZ_ADISYON_GARSON SET HATALI_DENEME = HATALI_DENEME + 1,
          KILIT_BITIS = CASE WHEN HATALI_DENEME + 1 >= @E THEN DATEADD(minute, @D, GETDATE()) ELSE KILIT_BITIS END
        OUTPUT INSERTED.HATALI_DENEME WHERE GARSON_ID = @G`);
            if ((Number(r.recordset[0]?.HATALI_DENEME) || 0) >= GARSON_HATALI_ESIK) {
                await new sql.Request(tx).input("G", sql.Int, garsonId).query(`UPDATE dbo.TODVZ_ADISYON_GARSON SET HATALI_DENEME = 0 WHERE GARSON_ID = @G`);
                throw Object.assign(kilitli(), { kalici: true });
            }
            throw Object.assign(ApiError.unauthorized(GIRIS_HATASI), { kalici: true });
        }
        if (!g.AKTIF)
            throw new ApiError(HttpStatus.FORBIDDEN, "Garson kartınız pasif. Yöneticinizle görüşün.", { kod: "PASIF" });
        await new sql.Request(tx).input("G", sql.Int, garsonId).query(`UPDATE dbo.TODVZ_ADISYON_GARSON SET HATALI_DENEME = 0, KILIT_BITIS = NULL, SON_GIRIS = GETDATE() WHERE GARSON_ID = @G`);
        pinKilidi.temizle(ipAnahtari);
        return { ad: temiz(g.AD), seviye: Number(g.SEVIYE), ekYetki: g.EK_YETKI ?? null, kullanici: k, surum: s.surum };
    },
    /** Giriş: müşteri no + kullanıcı adı + şifre (kullanıcı bir garson kartına bağlı olmalı) */
    async giris(g, istemci) {
        const ad = temiz(g.kullaniciAdi).slice(0, 50), sifre = String(g.sifre ?? "");
        const kayit = `${musteriNoTemizle(g.musteriNo)}/${ad}`;
        if (!ad || !sifre)
            throw ApiError.badRequest("Kullanıcı adı ve şifre yazılmalı.");
        for (const f of await this.firmalar(g.musteriNo)) {
            const pool = await AdisyonTanimSqlRepository.havuz(f.ctx);
            const r = await pool.request().input("AD", sql.NVarChar(50), ad).query(`${secim()} WHERE RTRIM(U.AD) = @AD`);
            if (r.recordset.length !== 1)
                continue;
            const garsonId = Number(r.recordset[0].GARSON_ID);
            try {
                return await this.islem(f.ctx, async (tx) => {
                    const k = await this.sifreDenetle(tx, f, garsonId, sifre, istemci.ip);
                    await this.sinirDenetle(f.ctx, tx, garsonId);
                    await this.logla(f.firmaId, kayit, true, istemci);
                    return {
                        token: this.jeton({ fid: f.firmaId, gid: garsonId, uid: k.kullanici.kullaniciId, pv: k.surum }),
                        garson: { garsonId, ad: k.ad, seviye: k.seviye, yetkiler: [...yetkiKumesi(k.seviye, k.ekYetki)], kullaniciAdi: k.kullanici.ad },
                        kisaAd: f.kisaAd,
                    };
                });
            }
            catch (e) {
                await this.logla(f.firmaId, kayit, false, istemci, String(e?.message || e).slice(0, 200));
                throw e;
            }
        }
        await GarsonSifre.denetle(0, null, sifre);
        await this.logla(0, kayit, false, istemci, "Garson kartına bağlı kullanıcı / müşteri no bulunamadı");
        // Y5: var olmayan ad / müşteri no da aynı eşikte aynı kilit iletisini alır (423 adın var olduğunu ele vermesin)
        const yok = `y|${kayit.toLocaleLowerCase("tr-TR")}|${istemci.ip}`;
        if (pinKilidi.kilitliMi(yok) || pinKilidi.hata(yok))
            throw kilitli();
        throw ApiError.unauthorized(GIRIS_HATASI);
    },
    /** Her istekte: jeton, firma (Restorant açık), garson etkin, aynı kullanıcıya bağlı ve şifresi değişmemiş, oturum kapatılmamış */
    async baglam(token) {
        let p;
        try {
            p = jwt.verify(token, gizi());
        }
        catch {
            throw ApiError.unauthorized("Oturum süresi doldu. Yeniden giriş yapın.");
        }
        if (p?.tur !== "GARSON" || !Number.isInteger(p.gid) || !Number.isInteger(p.uid))
            throw ApiError.unauthorized("Geçersiz oturum.");
        const f = await this.firma(Number(p.fid));
        if (!f)
            throw new ApiError(HttpStatus.FORBIDDEN, "Firma Restorant'a açık değil.", { kod: "MODUL_KAPALI" });
        const pool = await AdisyonTanimSqlRepository.havuz(f.ctx);
        const jti = typeof p.jti === "string" ? p.jti.slice(0, 32) : null;
        const r = await pool.request().input("G", sql.Int, p.gid).input("J", sql.VarChar(32), jti).query(`${secim(false, "CASE WHEN @J IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.TODVZ_ADISYON_OTURUM_IPTAL WHERE JTI = @J) THEN 1 ELSE 0 END AS IPTAL, ")} WHERE G.GARSON_ID = @G`);
        const g = r.recordset[0];
        if (!g || !g.AKTIF)
            throw ApiError.unauthorized("Garson kartı pasif, silinmiş ya da kullanıcısı kaldırılmış.");
        if (Number(g.KULLANICI_ID) !== p.uid)
            throw ApiError.unauthorized("Garson kartı başka kullanıcıya bağlandı. Yeniden giriş yapın.");
        if (g.IPTAL)
            throw ApiError.unauthorized("Oturum kapatıldı. Yeniden giriş yapın.");
        const k = bagli(g);
        const surum = await GarsonSifre.guncelSurum(f.firmaId, k);
        if (!surum || surum !== p.pv)
            throw ApiError.unauthorized("Şifreniz değişti ya da hesabınız kapatıldı. Yeniden giriş yapın.");
        return { firmaId: f.firmaId, ctx: f.ctx, jti, exp: p.exp ?? null, garson: { garsonId: p.gid, ad: temiz(g.AD), seviye: Number(g.SEVIYE), yetkiler: [...yetkiKumesi(Number(g.SEVIYE), g.EK_YETKI)], kullaniciAdi: k.ad } };
    },
    /** Çıkış (Y10): bu jeton süresi dolana kadar geçersiz yazılır; süresi dolanlar silinir */
    async cikis(b) {
        if (!b.jti)
            return { cikti: true };
        const pool = await AdisyonTanimSqlRepository.havuz(b.ctx);
        const bitis = new Date(((Number(b.exp) || Math.floor(Date.now() / 1000) + 16 * 3600)) * 1000);
        await pool.request().input("J", sql.VarChar(32), b.jti).input("B", sql.DateTime, bitis).query(`
      DELETE FROM dbo.TODVZ_ADISYON_OTURUM_IPTAL WHERE BITIS < DATEADD(hour, -1, GETUTCDATE());
      IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_ADISYON_OTURUM_IPTAL WHERE JTI = @J) INSERT INTO dbo.TODVZ_ADISYON_OTURUM_IPTAL (JTI, BITIS) VALUES (@J, @B);`);
        return { cikti: true };
    },
};

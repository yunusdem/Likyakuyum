import { adminYapilandirildiMi } from "../config/adminDb.config.js";
import { setDbCredentials } from "../config/mssql.config.js";
import { PosAdminSqlRepository } from "../models/admin/posAdminSql.repository.js";
import { MerkezGirisService } from "../services/merkezGiris.service.js";
import { PosService } from "../services/pos/pos.service.js";
import { PosMerkezService } from "../services/pos/posMerkez.service.js";
import { inposSonucuCoz, inposWebhookYetkili } from "../services/pos/inpos.surucu.js";
import { tokenSonucuCoz } from "../services/pos/token.surucu.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";
// POS cihazı entegrasyonu — docs/POS_ENTEGRASYON_YOL_HARITASI.md
export class PosController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.headers["x-db-server"],
            dbName: req.user?.dbName || req.headers["x-db-name"],
        };
    }
    static oturum(req) {
        return { firmaId: req.user?.firmaId, ...PosController.getDbContext(req) };
    }
    static kullaniciId(req) {
        const u = req.user;
        return Number(u?.userId || u?.id) || null;
    }
    static durum = asyncHandler(async (req, res) => {
        const vezneId = Number(req.query.vezneId) || null;
        return ApiResponse.ok(res, "POS durumu getirildi.", await PosService.durum(PosController.oturum(req), vezneId, PosController.getDbContext(req)));
    });
    // ─── Cihaz tanımları ───────────────────────────────────────────────────────
    static tanimlar = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "POS cihazları getirildi.", await PosService.tanimlar(PosController.oturum(req), PosController.getDbContext(req)));
    });
    static terminalKaydet = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "POS cihazı kaydedildi.", await PosService.terminalKaydet(req.body || {}, PosController.getDbContext(req)));
    });
    static terminalSil = asyncHandler(async (req, res) => {
        await PosService.terminalSil(Number(req.params.id), PosController.getDbContext(req));
        return ApiResponse.ok(res, "POS cihazı silindi.");
    });
    static baglantiTesti = asyncHandler(async (req, res) => {
        const data = await PosService.baglantiTesti(Number(req.params.id), PosController.oturum(req), PosController.getDbContext(req));
        return ApiResponse.ok(res, "Bağlantı denendi.", data);
    });
    static gunSonu = asyncHandler(async (req, res) => {
        const data = await PosService.gunSonu(Number(req.params.id), PosController.oturum(req), PosController.getDbContext(req));
        return ApiResponse.ok(res, "Gün sonu istendi.", data);
    });
    static bankaEslemeleriniYaz = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Banka eşlemeleri kaydedildi.", await PosService.bankaEslemeleriniYaz(req.body?.eslemeler, PosController.getDbContext(req)));
    });
    // ─── Tahsilat ──────────────────────────────────────────────────────────────
    static baslat = asyncHandler(async (req, res) => {
        const data = await PosService.baslat(req.body || {}, PosController.oturum(req), PosController.kullaniciId(req), PosController.getDbContext(req));
        return ApiResponse.ok(res, "Tahsilat cihaza gönderildi.", data);
    });
    /** Fiş başına tek sipariş (Inpos bulut): aynı fişin bütün POS satırları birlikte gönderilir. */
    static baslatToplu = asyncHandler(async (req, res) => {
        const data = await PosService.baslatToplu(req.body || {}, PosController.oturum(req), PosController.kullaniciId(req), PosController.getDbContext(req));
        return ApiResponse.ok(res, "Tahsilat cihaza gönderildi.", data);
    });
    static elleAlindi = asyncHandler(async (req, res) => {
        const data = await PosService.elleAlindi(req.body || {}, PosController.oturum(req), PosController.kullaniciId(req), PosController.getDbContext(req));
        return ApiResponse.ok(res, "Tahsilat alındı olarak işaretlendi.", data);
    });
    static getir = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "POS işlemi getirildi.", await PosService.getir(Number(req.params.id), PosController.getDbContext(req)));
    });
    static iptal = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "POS işlemi iptal edildi.", await PosService.iptal(Number(req.params.id), PosController.getDbContext(req)));
    });
    static elleIsaretle = asyncHandler(async (req, res) => {
        const data = await PosService.elleIsaretle(Number(req.params.id), req.body?.alindi === true, PosController.kullaniciId(req), PosController.getDbContext(req));
        return ApiResponse.ok(res, "İşaret kaydedildi.", data);
    });
    static iadeIsaretle = asyncHandler(async (req, res) => {
        const data = await PosService.iadeIsaretle(Number(req.params.id), req.body?.iadeDurumu, PosController.kullaniciId(req), PosController.getDbContext(req));
        return ApiResponse.ok(res, "İade işareti kaydedildi.", data);
    });
    static belgeyeBagla = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Tahsilatlar fişe bağlandı.", await PosService.belgeyeBagla(req.body || {}, PosController.getDbContext(req)));
    });
    static belgeIslemleri = asyncHandler(async (req, res) => {
        const data = await PosService.belgeIslemleri(String(req.query.belgeTuru || ""), Number(req.query.belgeId), PosController.getDbContext(req));
        return ApiResponse.ok(res, "Fişin POS işlemleri getirildi.", data);
    });
    static liste = asyncHandler(async (req, res) => {
        const yaz = (v) => (v ? String(v) : undefined);
        const data = await PosService.liste({
            baslangic: yaz(req.query.baslangic),
            bitis: yaz(req.query.bitis),
            durum: yaz(req.query.durum),
            posTerminalId: Number(req.query.posTerminalId) || undefined,
            arama: yaz(req.query.arama)?.trim().slice(0, 100),
            sayfa: Number(req.query.sayfa) || 1,
            sayfaBoyutu: Number(req.query.sayfaBoyutu) || 100,
        }, PosController.oturum(req), PosController.getDbContext(req));
        return ApiResponse.ok(res, "POS işlemleri listelendi.", data);
    });
    /**
     * Token'ın sonuç bildirimi (oturumsuz). Adres her işlem için imzalıdır: imza tutmazsa hiçbir kayda dokunulmaz.
     * Token yeniden denemesin diye, işlenemeyen bildirimde de 200 dönülür; ayrıntı merkezdeki POS günlüğündedir.
     */
    static tokenDonus = asyncHandler(async (req, res) => {
        const firmaId = Number(req.params.firmaId);
        const posIslemId = Number(req.params.islemId);
        // Admin veritabanı yapılandırılmamış sunucuda imza anahtarı da yoktur: bildirim hiç kabul edilmez
        const gecerli = adminYapilandirildiMi() && Number.isInteger(firmaId) && Number.isInteger(posIslemId) && PosMerkezService.donusImzasiGecerli(firmaId, posIslemId, String(req.params.imza));
        if (!gecerli) {
            await PosAdminSqlRepository.logYaz({ tur: "DONUS", ozet: "Token bildirimi: imza geçersiz, yok sayıldı", yanit: req.body, basarili: false });
            return res.status(404).json({ success: false, message: "Bulunamadı." });
        }
        let ozet = `Token bildirimi: ${req.body?.operation || "?"} (işlem ${posIslemId})`;
        let basarili = true;
        try {
            const sonuc = tokenSonucuCoz(req.body);
            if (sonuc) {
                const b = await MerkezGirisService.firmaBaglantisi(firmaId);
                setDbCredentials(b.dbServer, b.dbName, b.dbUser, b.dbSifre);
                await PosService.disaridanSonuc(posIslemId, sonuc, { dbServer: b.dbServer, dbName: b.dbName });
                ozet += ` → ${sonuc.fisIptali ? "FİŞ İPTALİ" : sonuc.durum}`;
            }
        }
        catch (err) {
            basarili = false;
            ozet += ` → işlenemedi: ${err?.message || err}`;
            logger.error(`[POS] ${ozet}`);
        }
        await PosAdminSqlRepository.logYaz({ tur: "DONUS", firmaId, ozet, yanit: req.body, basarili });
        return res.status(200).json({ success: true });
    });
    /**
     * Inpos'un sipariş durum bildirimi (oturumsuz; Basic Auth, kullanıcı adı / şifre yönetim panelinde). Adres tektir:
     * siparişin firması merkezdeki sipariş kaydından bulunur. Bilinmeyen sipariş ya da işlenemeyen bildirimde kayda
     * dokunulmaz; Inpos yeniden denemesin diye 200 dönülür, ayrıntı merkezdeki POS günlüğündedir.
     */
    static inposDonus = asyncHandler(async (req, res) => {
        if (!adminYapilandirildiMi() || !(await inposWebhookYetkili(req.headers.authorization))) {
            await PosAdminSqlRepository.logYaz({ tur: "DONUS", ozet: "Inpos bildirimi: kimlik geçersiz, yok sayıldı", yanit: req.body, basarili: false });
            res.setHeader("WWW-Authenticate", 'Basic realm="pos-donus"');
            return res.status(401).json({ success: false, message: "Yetkisiz." });
        }
        const govde = req.body || {};
        const ref = govde.id ? String(govde.id) : "";
        const durum = String(govde.status || "?");
        let ozet = `Inpos bildirimi: ${durum} (sipariş ${ref || "?"})`;
        let basarili = true;
        let firmaId = null;
        try {
            firmaId = ref ? await PosAdminSqlRepository.sepetFirmasi("inpos", ref) : null;
            if (!firmaId) {
                ozet += " → sipariş bilinmiyor, yok sayıldı";
            }
            else {
                const sonuc = inposSonucuCoz(govde);
                if (sonuc) {
                    const b = await MerkezGirisService.firmaBaglantisi(firmaId);
                    setDbCredentials(b.dbServer, b.dbName, b.dbUser, b.dbSifre);
                    const n = await PosService.disaridanGrupSonuc(ref, sonuc, { dbServer: b.dbServer, dbName: b.dbName });
                    ozet += ` → ${sonuc.durum} (${n} satır)`;
                }
            }
        }
        catch (err) {
            basarili = false;
            ozet += ` → işlenemedi: ${err?.message || err}`;
            logger.error(`[POS] ${ozet}`);
        }
        await PosAdminSqlRepository.logYaz({ tur: "DONUS", firmaId, ozet, yanit: govde, basarili });
        // Inpos "Sipariş Durum Güncelleme" cevabında sipariş detayını bekler; elimizdekini yankılarız
        return res.status(200).json({ id: ref, no: Number(govde.no) || 0, name: "", status: govde.status || "", createdAt: new Date().toISOString() });
    });
}

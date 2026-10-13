import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";
import { BelgeSqlRepository } from "../models/belgeSql.repository.js";
import { FIS_TURLERI, FIS_TURU_KODLARI } from "../services/belge/belgeTurleri.js";
import { ALAN_ACIKLAMALARI, alanKatalogu, ornekVeri } from "../services/belge/alanKatalogu.js";
import { firmaKimlikOku } from "../services/belge/fisCiktiVeri.js";
import { sablonGorselleri } from "../services/belge/fisCikti.service.js";
import { BelgeGorselService } from "../services/belge/belgeGorsel.service.js";
import { BelgeGorselSqlRepository } from "../models/belgeGorselSql.repository.js";
import { ornekler, ornekUygula } from "../services/belge/ornekSablonlar.js";
import { sablonDenetle } from "../services/belge/sablonDenetim.js";
import { etkinSablon, sablonKaydet, sablonVarMi, surumeDon, surumler, varsayilanaDon, varsayilanSablon, } from "../services/belge/sablonDeposu.js";
/**
 * Fiş şablonu yönetimi (docs/FIS_TASARIM_YOL_HARITASI.md, Faz 3): firmanın sistem yöneticisi kendi fiş düzenini
 * görür, indirir, yükler (denetimden geçerse), varsayılana / önceki sürüme döner.
 */
const ctxAl = (req) => ({
    dbServer: req.user?.dbServer || req.query.dbServer || req.body?.dbServer,
    dbName: req.user?.dbName || req.query.dbName || req.body?.dbName,
});
const kim = (req) => req.user?.username || "?";
function turAl(req) {
    const tur = String(req.params.tur || "").toUpperCase();
    if (!FIS_TURU_KODLARI.includes(tur))
        throw ApiError.badRequest(`Bilinmeyen belge türü: ${req.params.tur}`);
    return tur;
}
/** Gövdeden şablon: { sablon: {...} } ya da yüklenen dosyanın metni { icerik: "..." } */
function govdeSablonu(req) {
    const b = req.body || {};
    if (typeof b.icerik === "string")
        return b.icerik;
    if (b.sablon !== undefined)
        return b.sablon;
    throw ApiError.badRequest("Şablon gönderilmedi ({ sablon } ya da { icerik }).");
}
export class BelgeSablonController {
    /** GET /belge/sablon-turleri */
    static turler = asyncHandler(async (req, res) => {
        const ctx = ctxAl(req);
        const liste = await Promise.all(FIS_TURU_KODLARI.map(async (tur) => {
            const [durum, sl] = await Promise.all([sablonVarMi(tur, ctx), surumler(tur, ctx)]);
            const t = FIS_TURLERI[tur];
            return { tur, ad: t.ad, grup: t.grup, bicim: t.bicim, firmaSablonu: durum.var, guncelleme: durum.tarih, surumSayisi: sl.length };
        }));
        return ApiResponse.ok(res, "Belge türleri listelendi.", liste);
    });
    /** GET /belge/sablon/:tur — etkin şablon, kaynağı ve sürümler */
    static getir = asyncHandler(async (req, res) => {
        const tur = turAl(req), ctx = ctxAl(req);
        const [e, sl] = await Promise.all([etkinSablon(tur, ctx), surumler(tur, ctx)]);
        return ApiResponse.ok(res, "Şablon getirildi.", { tur, ad: FIS_TURLERI[tur].ad, ...e, surumler: sl });
    });
    /** GET /belge/sablon/:tur/indir — etkin şablon JSON dosyası */
    static indir = asyncHandler(async (req, res) => {
        const tur = turAl(req);
        const { sablon } = await etkinSablon(tur, ctxAl(req));
        const govde = JSON.stringify(sablon, null, 2);
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${tur}.json"`);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(govde);
    });
    /** GET /belge/sablon/:tur/alanlar — kullanılabilir {{alan}} adları ve örnek değerleri */
    static alanlar = asyncHandler(async (req, res) => {
        const tur = turAl(req);
        const k = alanKatalogu(tur);
        return ApiResponse.ok(res, "Alanlar listelendi.", { alanlar: k.alanlar, listeler: k.listeler, ornek: k.ornek, aciklamalar: ALAN_ACIKLAMALARI });
    });
    /** POST /belge/sablon/:tur/denetle — kaydetmeden denetler */
    static denetle = asyncHandler(async (req, res) => {
        const tur = turAl(req);
        const d = sablonDenetle(govdeSablonu(req), tur, varsayilanSablon(tur), await BelgeGorselService.adlar(ctxAl(req)));
        return ApiResponse.ok(res, d.gecerli ? "Şablon geçerli." : "Şablonda hata var.", d);
    });
    /** PUT /belge/sablon/:tur — denetler ve kaydeder (önceki sürüm saklanır) */
    static kaydet = asyncHandler(async (req, res) => {
        const tur = turAl(req), ctx = ctxAl(req);
        const d = sablonDenetle(govdeSablonu(req), tur, varsayilanSablon(tur), await BelgeGorselService.adlar(ctx));
        if (!d.gecerli || !d.sablon)
            throw ApiError.badRequest(`Şablon kaydedilmedi: ${d.hatalar.length} hata.`, { hatalar: d.hatalar });
        const s = await sablonKaydet(tur, d.sablon, ctx);
        logger.info(`Şablon kaydedildi: ${tur} [${ctx.dbName || "-"}] (${kim(req)})${s.oncekiSurum ? ` · önceki: ${s.oncekiSurum}` : ""}`);
        return ApiResponse.ok(res, "Şablon kaydedildi.", { sablon: d.sablon, oncekiSurum: s.oncekiSurum });
    });
    /** POST /belge/sablon/:tur/varsayilan — firmanın şablonunu sürüme taşır, varsayılan etkin olur */
    static varsayilan = asyncHandler(async (req, res) => {
        const tur = turAl(req), ctx = ctxAl(req);
        const s = await varsayilanaDon(tur, ctx);
        logger.info(`Şablon varsayılana döndü: ${tur} [${ctx.dbName || "-"}] (${kim(req)})`);
        return ApiResponse.ok(res, s.oncekiSurum ? "Varsayılan şablona dönüldü." : "Zaten varsayılan şablon kullanılıyor.", s);
    });
    /** GET /belge/sablon/:tur/surumler */
    static surumListesi = asyncHandler(async (req, res) => {
        const tur = turAl(req);
        return ApiResponse.ok(res, "Sürümler listelendi.", await surumler(tur, ctxAl(req)));
    });
    /** POST /belge/sablon/:tur/geri-al { surum? } — verilen (yoksa en yeni) sürüm etkin olur */
    static geriAl = asyncHandler(async (req, res) => {
        const tur = turAl(req), ctx = ctxAl(req);
        const surum = typeof req.body?.surum === "string" && req.body.surum ? String(req.body.surum) : undefined;
        if (surum && !/^[A-Z0-9_]+_\d{8}_\d{6}(_\d+)?\.json$/.test(surum))
            throw ApiError.badRequest("Sürüm adı geçersiz.");
        const s = await surumeDon(tur, surum, ctx);
        logger.info(`Şablon önceki sürüme döndü: ${tur} ← ${s.surum} [${ctx.dbName || "-"}] (${kim(req)})`);
        return ApiResponse.ok(res, "Önceki sürüme dönüldü.", s);
    });
    /**
     * POST /belge/sablon/:tur/onizle { sablon?, icerik?, satim? } — kaydedilmemiş (ya da etkin) şablonu örnek veriyle
     * çizmek için şablon + veri + görseller. Şablon geçersizse hatalar döner, çizim yapılmaz.
     */
    static onizle = asyncHandler(async (req, res) => {
        const tur = turAl(req), ctx = ctxAl(req);
        const b = req.body || {};
        let sablon;
        if (b.sablon !== undefined || typeof b.icerik === "string") {
            const d = sablonDenetle(govdeSablonu(req), tur, varsayilanSablon(tur), await BelgeGorselService.adlar(ctx));
            if (!d.gecerli || !d.sablon)
                return ApiResponse.ok(res, "Şablonda hata var.", { gecerli: false, hatalar: d.hatalar });
            sablon = d.sablon;
        }
        else
            sablon = (await etkinSablon(tur, ctx)).sablon;
        const firma = firmaKimlikOku(await BelgeSqlRepository.firmaKimlikSatiri(ctx));
        const veri = ornekVeri(tur, firma.unvan ? firma : undefined, b.satim !== false);
        const gorseller = { ...sablonGorselleri(sablon), ...(await BelgeGorselService.harita(sablon, ctx)) };
        return ApiResponse.ok(res, "Önizleme hazırlandı.", { gecerli: true, hatalar: [], tur, sablon, veri, gorseller });
    });
    // ── Hazır örnek şablonlar (Faz 7) ──
    /** GET /belge/sablon/:tur/ornekler */
    static ornekListesi = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Örnekler listelendi.", ornekler(turAl(req)));
    });
    /** GET /belge/sablon/:tur/ornek/:kod — firmanın görselleriyle doldurulmuş, denetimden geçmiş örnek (kaydetmez) */
    static ornekGetir = asyncHandler(async (req, res) => {
        const tur = turAl(req), ctx = ctxAl(req);
        const gorseller = await BelgeGorselSqlRepository.listele(false, ctx).catch(() => []);
        const s = ornekUygula(tur, String(req.params.kod || "").toUpperCase(), gorseller);
        const d = sablonDenetle(s, tur, varsayilanSablon(tur), gorseller.map((g) => g.ad));
        if (!d.gecerli || !d.sablon)
            throw ApiError.badRequest("Örnek şablon bu firmada geçerli değil.", { hatalar: d.hatalar });
        return ApiResponse.ok(res, "Örnek hazırlandı.", { sablon: d.sablon });
    });
    // ── Logo ve imza / kaşe görselleri (Faz 4) ──
    /** GET /belge/gorseller — görseller (küçük resim için data URL) ve kullanıldıkları belgeler */
    static gorseller = asyncHandler(async (req, res) => {
        return ApiResponse.ok(res, "Görseller listelendi.", await BelgeGorselService.listele(ctxAl(req)));
    });
    /** POST /belge/gorseller { ad, tur: "LOGO" | "IMZA", dataUrl } */
    static gorselEkle = asyncHandler(async (req, res) => {
        const ctx = ctxAl(req);
        const kullaniciId = Number(req.user?.userId) || null;
        const g = await BelgeGorselService.ekle({ ad: req.body?.ad, tur: req.body?.tur, dataUrl: req.body?.dataUrl }, kullaniciId, ctx);
        logger.info(`Belge görseli eklendi: ${g.tur} "${g.ad}" (${g.boyut} bayt) [${ctx.dbName || "-"}] (${kim(req)})`);
        return ApiResponse.ok(res, `"${g.ad}" yüklendi.`, g);
    });
    /** DELETE /belge/gorseller/:id?zorla=1 — şablonda kullanılıyorsa zorla olmadan 409 */
    static gorselSil = asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0)
            throw ApiError.badRequest("Görsel numarası geçersiz.");
        const ctx = ctxAl(req);
        const zorla = ["1", "true", "evet"].includes(String(req.query.zorla || "").toLowerCase());
        const s = await BelgeGorselService.sil(id, zorla, ctx);
        logger.info(`Belge görseli silindi: "${s.ad}" [${ctx.dbName || "-"}] (${kim(req)})${s.kullanan.length ? ` · kullanan: ${s.kullanan.join(", ")}` : ""}`);
        return ApiResponse.ok(res, `"${s.ad}" silindi.`, s);
    });
}

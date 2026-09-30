import { UrunStokService } from "../services/urunStok.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
/** I- Etiket İşlemleri › Altın Ürün Stoğu / Özel Ürün Stoğu — /api/v1/etiket/{altin|ozel}-urun-stogu */
export class UrunStokController {
    static getDbContext(req) {
        return {
            dbServer: req.user?.dbServer || req.headers["x-db-server"] || req.query.dbServer,
            dbName: req.user?.dbName || req.headers["x-db-name"] || req.query.dbName,
        };
    }
    static kullanici(req) { return req.user?.username || "rapor"; }
    static tip(req) {
        const t = String(req.params.tip || "");
        if (t !== "altin" && t !== "ozel")
            throw ApiError.badRequest("Ürün tipi geçersiz (altin | ozel).");
        return t;
    }
    static filtre(req) {
        const q = req.query;
        const s = (k) => (q[k] === undefined || q[k] === null || q[k] === "" ? undefined : String(q[k]).trim());
        const tarih = (k) => { const v = s(k); if (!v)
            return undefined; if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
            throw ApiError.badRequest(`${k} tarihi YYYY-AA-GG olmalı.`); return v; };
        const durum = s("durum");
        const tarihTuru = s("tarihTuru");
        const cari = Number(s("cariKartId") || 0);
        const limit = Number(s("limit") || 0);
        return {
            baslangic: tarih("baslangic"),
            bitis: tarih("bitis"),
            tarihTuru: tarihTuru === "kayit" ? "kayit" : "satis",
            durum: durum === "stokta" || durum === "satildi" ? durum : "tumu",
            ayar: s("ayar"),
            grupKodu: s("grupKodu"),
            ureticiFirma: s("ureticiFirma"),
            banko: s("banko"),
            search: s("search"),
            cariKartId: cari > 0 ? cari : undefined,
            limit: limit > 0 ? limit : undefined,
        };
    }
    /** GET /:tip-urun-stogu */
    static veri = asyncHandler(async (req, res) => {
        const v = await UrunStokService.veri(UrunStokController.tip(req), UrunStokController.filtre(req), UrunStokController.getDbContext(req));
        return ApiResponse.ok(res, "Ürün stoğu listelendi.", v);
    });
    /** GET /:tip-urun-stogu/secenekler — ayar / grup / üretici / banko listeleri */
    static secenekler = asyncHandler(async (req, res) => ApiResponse.ok(res, "Filtre seçenekleri.", await UrunStokService.secenekler(UrunStokController.tip(req), UrunStokController.getDbContext(req))));
    /** GET /:tip-urun-stogu/pdf[?indir=1] */
    static pdf = asyncHandler(async (req, res) => {
        const { pdf, kod } = await UrunStokService.pdf(UrunStokController.tip(req), UrunStokController.filtre(req), UrunStokController.kullanici(req), UrunStokController.getDbContext(req));
        const indir = ["1", "true"].includes(String(req.query.indir || ""));
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `${indir ? "attachment" : "inline"}; filename="${kod}.pdf"`);
        res.setHeader("Content-Length", String(pdf.length));
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).end(pdf);
    });
    /** GET /:tip-urun-stogu/excel */
    static excel = asyncHandler(async (req, res) => {
        const { xlsx, kod } = await UrunStokService.excel(UrunStokController.tip(req), UrunStokController.filtre(req), UrunStokController.kullanici(req), UrunStokController.getDbContext(req));
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${kod}.xlsx"`);
        res.setHeader("Content-Length", String(xlsx.length));
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).end(xlsx);
    });
}

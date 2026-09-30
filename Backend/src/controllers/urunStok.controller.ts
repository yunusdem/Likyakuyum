import { Request, Response } from "express";
import { UrunStokService } from "../services/urunStok.service.js";
import type { UrunStokFiltre, UrunStokTipi } from "../models/urunStokSql.repository.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/** I- Etiket İşlemleri › Altın Ürün Stoğu / Özel Ürün Stoğu — /api/v1/etiket/{altin|ozel}-urun-stogu */
export class UrunStokController {
  private static getDbContext(req: Request) {
    return {
      dbServer: req.user?.dbServer || (req.headers["x-db-server"] as string) || (req.query.dbServer as string),
      dbName: req.user?.dbName || (req.headers["x-db-name"] as string) || (req.query.dbName as string),
    };
  }
  private static kullanici(req: Request) { return req.user?.username || "rapor"; }

  private static tip(req: Request): UrunStokTipi {
    const t = String(req.params.tip || "");
    if (t !== "altin" && t !== "ozel") throw ApiError.badRequest("Ürün tipi geçersiz (altin | ozel).");
    return t;
  }

  private static filtre(req: Request): UrunStokFiltre {
    const q = req.query;
    const s = (k: string) => (q[k] === undefined || q[k] === null || q[k] === "" ? undefined : String(q[k]).trim());
    const tarih = (k: string) => { const v = s(k); if (!v) return undefined; if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw ApiError.badRequest(`${k} tarihi YYYY-AA-GG olmalı.`); return v; };
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
  public static veri = asyncHandler(async (req: Request, res: Response) => {
    const v = await UrunStokService.veri(UrunStokController.tip(req), UrunStokController.filtre(req), UrunStokController.getDbContext(req));
    return ApiResponse.ok(res, "Ürün stoğu listelendi.", v);
  });

  /** GET /:tip-urun-stogu/secenekler — ayar / grup / üretici / banko listeleri */
  public static secenekler = asyncHandler(async (req: Request, res: Response) =>
    ApiResponse.ok(res, "Filtre seçenekleri.", await UrunStokService.secenekler(UrunStokController.tip(req), UrunStokController.getDbContext(req))));

  /** GET /:tip-urun-stogu/pdf[?indir=1] */
  public static pdf = asyncHandler(async (req: Request, res: Response) => {
    const { pdf, kod } = await UrunStokService.pdf(UrunStokController.tip(req), UrunStokController.filtre(req), UrunStokController.kullanici(req), UrunStokController.getDbContext(req));
    const indir = ["1", "true"].includes(String(req.query.indir || ""));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${indir ? "attachment" : "inline"}; filename="${kod}.pdf"`);
    res.setHeader("Content-Length", String(pdf.length));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).end(pdf);
  });

  /** GET /:tip-urun-stogu/excel */
  public static excel = asyncHandler(async (req: Request, res: Response) => {
    const { xlsx, kod } = await UrunStokService.excel(UrunStokController.tip(req), UrunStokController.filtre(req), UrunStokController.kullanici(req), UrunStokController.getDbContext(req));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${kod}.xlsx"`);
    res.setHeader("Content-Length", String(xlsx.length));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).end(xlsx);
  });
}

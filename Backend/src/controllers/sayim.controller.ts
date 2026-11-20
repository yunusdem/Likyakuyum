import { Request, Response, NextFunction } from "express";
import { SayimSqlRepository } from "../models/sayimSql.repository.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

/** Oturumdaki firmanın veritabanı (jeton / firma kaydı; eski jetonda auth ara katmanının da okuduğu başlık) */
const baglam = (req: Request) => ({
  dbServer: req.user?.dbServer || (req.headers["x-db-server"] as string) || undefined,
  dbName: req.user?.dbName || (req.headers["x-db-name"] as string) || undefined,
});

export class SayimController {
  static async getNextFisNo(req: Request, res: Response, next: NextFunction) {
    try {
      const fisNo = await SayimSqlRepository.getNextFisNo(baglam(req));
      return ApiResponse.ok(res, "Sonraki fiş numarası üretildi.", { fisNo });
    } catch (err) {
      next(err);
    }
  }

  static async saveSayimFisi(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const payload = {
        ...req.body,
        kullaniciId: user?.userId || req.body.kullaniciId || null,
      };

      const result = await SayimSqlRepository.saveSayimFisi(payload, baglam(req));
      return ApiResponse.created(res, "Sayım fişi başarıyla kaydedildi.", result);
    } catch (err) {
      next(err);
    }
  }

  static async listSayimFisleri(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit || 100);
      const list = await SayimSqlRepository.listSayimFisleri(limit, baglam(req));
      return ApiResponse.ok(res, "Sayım fişleri listelendi.", list);
    } catch (err) {
      next(err);
    }
  }

  static async getSayimFisiById(req: Request, res: Response, next: NextFunction) {
    try {
      const idOrNo = req.params.id;
      const slip = await SayimSqlRepository.getSayimFisiById(idOrNo, baglam(req));
      if (!slip) {
        throw new ApiError(404, "Sayım fişi bulunamadı.");
      }
      return ApiResponse.ok(res, "Sayım fişi detayları getirildi.", slip);
    } catch (err) {
      next(err);
    }
  }

  static async deleteSayimFisi(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      await SayimSqlRepository.deleteSayimFisi(id, baglam(req));
      return ApiResponse.ok(res, "Sayım fişi başarıyla silindi.", { deleted: true });
    } catch (err) {
      next(err);
    }
  }
}

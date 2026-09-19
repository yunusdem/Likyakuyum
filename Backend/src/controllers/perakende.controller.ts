import { Request, Response, NextFunction } from "express";
import { PerakendeService } from "../services/perakende.service.js";
import { logger } from "../utils/logger.js";

export const PerakendeController = {
  getDbContext(req: Request) {
    return {
      dbServer:
        req.user?.dbServer ||
        (req.headers["x-db-server"] as string) ||
        (req.query.dbServer as string) ||
        (req.body?.dbServer as string),
      dbName:
        req.user?.dbName ||
        (req.headers["x-db-name"] as string) ||
        (req.query.dbName as string) ||
        (req.body?.dbName as string),
    };
  },

  async createInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = PerakendeController.getDbContext(req);
      const user = req.user as any;
      const userId = user?.userId || user?.id || req.body?.KULLANICI_ID;
      const result = await PerakendeService.createInvoice(req.body, userId ? Number(userId) : undefined, dbContext);
      res.status(201).json({
        success: true,
        message: "Fatura ve satış başarıyla kaydedildi",
        data: result,
      });
    } catch (err: any) {
      logger.error("PerakendeController.createInvoice error", { error: err.message, stack: err.stack });
      const errorMessage = err.originalError?.info?.message || err.message || "Fatura kaydedilemedi";
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }
  },

  async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = PerakendeController.getDbContext(req);
      const {
        baslangicTarihi,
        bitisTarihi,
        aliciVknTckn,
        eBelgeDurumu,
        search,
        limit,
      } = req.query;

      const data = await PerakendeService.listInvoices({
        baslangicTarihi: baslangicTarihi as string,
        bitisTarihi: bitisTarihi as string,
        aliciVknTckn: aliciVknTckn as string,
        eBelgeDurumu: eBelgeDurumu !== undefined ? Number(eBelgeDurumu) : undefined,
        search: search as string,
        limit: limit ? Number(limit) : 200,
      }, dbContext);

      res.json({ success: true, data });
    } catch (err: any) {
      next(err);
    }
  },

  async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = PerakendeController.getDbContext(req);
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        return res.status(400).json({ success: false, message: "Geçersiz fatura ID" });
      }
      const data = await PerakendeService.getInvoiceById(id, dbContext);
      if (!data) {
        return res.status(404).json({ success: false, message: "Fatura bulunamadı" });
      }
      res.json({ success: true, data });
    } catch (err: any) {
      next(err);
    }
  },

  async deleteInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = PerakendeController.getDbContext(req);
      const id = Number(req.params.id);
      if (!id || isNaN(id)) {
        return res.status(400).json({ success: false, message: "Geçersiz fatura ID" });
      }
      await PerakendeService.deleteInvoice(id, dbContext);
      res.json({
        success: true,
        message: "Fatura başarıyla silindi ve ürünler stoğa iade edildi",
      });
    } catch (err: any) {
      logger.error("PerakendeController.deleteInvoice error", { error: err.message });
      const errorMessage = err.originalError?.info?.message || err.message || "Fatura silinemedi";
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }
  },

  async getProductByBarcode(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = PerakendeController.getDbContext(req);
      const barkod = (req.params.barkod || req.query.barkod || "").toString().trim();
      if (!barkod) {
        return res.status(400).json({ success: false, message: "Barkod numarası belirtilmedi" });
      }
      const product = await PerakendeService.getProductByBarcode(barkod, dbContext);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `'${barkod}' barkodlu ürün stokta bulunamadı veya daha önce satılmış.`,
        });
      }
      res.json({
        success: true,
        data: product,
      });
    } catch (err: any) {
      logger.error("PerakendeController.getProductByBarcode error", { error: err.message });
      const errorMessage = err.originalError?.info?.message || err.message || "Ürün sorgulanamadı";
      res.status(400).json({
        success: false,
        message: errorMessage,
      });
    }
  },

  async getNextFaturaNo(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = PerakendeController.getDbContext(req);
      const prefix = (req.query.prefix as string) || "GIB";
      const nextNo = await PerakendeService.getNextFaturaNo(prefix, dbContext);
      res.json({ success: true, faturaNo: nextNo });
    } catch (err: any) {
      next(err);
    }
  },
};

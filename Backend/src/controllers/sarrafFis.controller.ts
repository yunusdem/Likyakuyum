import { Request, Response, NextFunction } from "express";
import { SarrafFisService } from "../services/sarrafFis.service.js";
import { logger } from "../utils/logger.js";

export const SarrafFisController = {
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

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = SarrafFisController.getDbContext(req);
      const { search, tip, vezneId, limit } = req.query;
      const data = await SarrafFisService.getFisList({
        search: search as string,
        tip: tip !== undefined ? Number(tip) : undefined,
        vezneId: vezneId ? Number(vezneId) : undefined,
        limit: limit ? Number(limit) : 200,
      }, dbContext);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = SarrafFisController.getDbContext(req);
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ success: false, message: "Geçersiz ID" });
      const data = await SarrafFisService.getFisById(id, dbContext);
      if (!data) return res.status(404).json({ success: false, message: "Fiş bulunamadı" });
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getUrunler(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = SarrafFisController.getDbContext(req);
      const data = await SarrafFisService.getUrunler(dbContext);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async getVezneBakiye(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = SarrafFisController.getDbContext(req);
      const vezneId = Number(req.query.vezneId || req.params.vezneId);
      if (!vezneId) return res.status(400).json({ success: false, message: "vezneId gerekli" });
      const data = await SarrafFisService.getVezneBakiye(vezneId, dbContext);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async save(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = SarrafFisController.getDbContext(req);
      const dto = req.body;
      if (!dto.vezneId || dto.tip === undefined) {
        return res.status(400).json({ success: false, message: "vezneId ve tip gerekli" });
      }
      if (!dto.kullaniciId && req.user?.userId) {
        dto.kullaniciId = Number(req.user.userId);
      }
      const result = await SarrafFisService.saveFis(dto, dbContext);
      res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = SarrafFisController.getDbContext(req);
      const id = Number(req.params.id);
      const kullaniciId = Number(req.body.kullaniciId || req.query.kullaniciId || req.user?.userId);
      if (!id) return res.status(400).json({ success: false, message: "Geçersiz ID" });
      await SarrafFisService.deleteFis(id, kullaniciId, dbContext);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async saveDetay(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = SarrafFisController.getDbContext(req);
      const sarrafFisiId = Number(req.params.id);
      const dto = {
        ...req.body,
        sarrafFisiId,
        kullaniciId: Number(req.body.kullaniciId || req.user?.userId) || 1,
      };
      await SarrafFisService.saveDetay(dto, dbContext);
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  async getUserVezne(req: Request, res: Response, next: NextFunction) {
    try {
      const dbContext = SarrafFisController.getDbContext(req);
      const kullaniciId = Number(req.query.kullaniciId || req.params.kullaniciId || req.user?.userId);
      if (!kullaniciId) return res.status(400).json({ success: false, message: "kullaniciId gerekli" });
      const vezneId = await SarrafFisService.getUserVezneId(kullaniciId, dbContext);
      res.json({ success: true, data: { vezneId } });
    } catch (err) { next(err); }
  },
};

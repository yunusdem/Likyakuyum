import { SarrafFisService } from "../services/sarrafFis.service.js";
import { fisVeznesi } from "../services/yetki/fisVeznesi.js";
import { fisKayitYetkisi, gunSiniri, kayitErisimi } from "../services/yetki/fisYetkileri.js";
import { bankaHesabiDenetle, sarrafKurDenetle } from "../services/yetki/fisIcerikYetkisi.js";
export const SarrafFisController = {
    getDbContext(req) {
        return {
            dbServer: req.user?.dbServer ||
                req.headers["x-db-server"] ||
                req.query.dbServer ||
                req.body?.dbServer,
            dbName: req.user?.dbName ||
                req.headers["x-db-name"] ||
                req.query.dbName ||
                req.body?.dbName,
        };
    },
    async list(req, res, next) {
        try {
            const dbContext = SarrafFisController.getDbContext(req);
            const { search, tip, vezneId, limit } = req.query;
            const data = await SarrafFisService.getFisList({
                search: search,
                tip: tip !== undefined ? Number(tip) : undefined,
                vezneId: vezneId ? Number(vezneId) : undefined,
                limit: limit ? Number(limit) : 200,
                baslangic: await gunSiniri(req),
            }, dbContext);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const dbContext = SarrafFisController.getDbContext(req);
            const id = Number(req.params.id);
            if (!id)
                return res.status(400).json({ success: false, message: "Geçersiz ID" });
            await kayitErisimi(req, "sarraf", id);
            const data = await SarrafFisService.getFisById(id, dbContext);
            if (!data)
                return res.status(404).json({ success: false, message: "Fiş bulunamadı" });
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
    async getUrunler(req, res, next) {
        try {
            const dbContext = SarrafFisController.getDbContext(req);
            const data = await SarrafFisService.getUrunler(dbContext);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
    async getVezneBakiye(req, res, next) {
        try {
            const dbContext = SarrafFisController.getDbContext(req);
            const vezneId = Number(req.query.vezneId || req.params.vezneId);
            if (!vezneId)
                return res.status(400).json({ success: false, message: "vezneId gerekli" });
            const data = await SarrafFisService.getVezneBakiye(vezneId, dbContext);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
    async save(req, res, next) {
        try {
            const dbContext = SarrafFisController.getDbContext(req);
            const dto = req.body;
            if (dto.tip === undefined) {
                return res.status(400).json({ success: false, message: "tip gerekli" });
            }
            // Fişi kaydeden oturumdaki kullanıcıdır (istekteki kullaniciId'ye bakılmaz)
            if (req.user?.userId)
                dto.kullaniciId = Number(req.user.userId);
            // Vezne kullanıcının kasası: yenide kart veznesi, düzeltmede kaydın veznesi (istekteki yok sayılır)
            dto.vezneId = await fisVeznesi(dto.kullaniciId, dbContext, { tur: "sarraf", id: dto.sarrafFisiId });
            // Gün sınırı, tarih ve fiş numarası yetkisi: numara yetkisi yoksa yenide numaratör, düzeltmede kaydın numarası
            const { nolar, yetki } = await fisKayitYetkisi(req, "sarraf", dto.sarrafFisiId, dto.tarih);
            // Banka hesabı ödemesi ve kur yetkisi (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2)
            bankaHesabiDenetle(yetki, dto.odemeSatirlari);
            await sarrafKurDenetle(req, yetki, dto);
            if (nolar) {
                dto.seriNo = nolar.FIS_NO ?? null;
                dto.fisNo = dto.belgeNo = dto.irsaliyeNo = nolar.IRSALIYE_NO ?? null;
            }
            const result = await SarrafFisService.saveFis(dto, dbContext);
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    },
    async delete(req, res, next) {
        try {
            const dbContext = SarrafFisController.getDbContext(req);
            const id = Number(req.params.id);
            const kullaniciId = Number(req.user?.userId || req.body.kullaniciId || req.query.kullaniciId);
            if (!id)
                return res.status(400).json({ success: false, message: "Geçersiz ID" });
            await kayitErisimi(req, "sarraf", id);
            await SarrafFisService.deleteFis(id, kullaniciId, dbContext);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    },
    async saveDetay(req, res, next) {
        try {
            const dbContext = SarrafFisController.getDbContext(req);
            const sarrafFisiId = Number(req.params.id);
            await kayitErisimi(req, "sarraf", sarrafFisiId);
            const dto = {
                ...req.body,
                sarrafFisiId,
                kullaniciId: Number(req.body.kullaniciId || req.user?.userId) || 1,
            };
            await SarrafFisService.saveDetay(dto, dbContext);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    },
    async getUserVezne(req, res, next) {
        try {
            const dbContext = SarrafFisController.getDbContext(req);
            const kullaniciId = Number(req.query.kullaniciId || req.params.kullaniciId || req.user?.userId);
            if (!kullaniciId)
                return res.status(400).json({ success: false, message: "kullaniciId gerekli" });
            const vezneId = await SarrafFisService.getUserVezneId(kullaniciId, dbContext);
            res.json({ success: true, data: { vezneId } });
        }
        catch (err) {
            next(err);
        }
    },
};

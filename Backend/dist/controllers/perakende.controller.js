import { PerakendeService } from "../services/perakende.service.js";
import { logger } from "../utils/logger.js";
import { fisVeznesi } from "../services/yetki/fisVeznesi.js";
import { fisKayitYetkisi, gunSiniri, kayitErisimi, sonrakiGun } from "../services/yetki/fisYetkileri.js";
import { bankaHesabiDenetle } from "../services/yetki/fisIcerikYetkisi.js";
export const PerakendeController = {
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
    async createInvoice(req, res, next) {
        try {
            const dbContext = PerakendeController.getDbContext(req);
            const user = req.user;
            const userId = user?.userId || user?.id || req.body?.KULLANICI_ID;
            // Vezne kullanıcının kasası: yenide kart veznesi, düzeltmede kaydın veznesi (istekteki yok sayılır)
            const vezneId = await fisVeznesi(userId, dbContext, { tur: "fatura", id: req.body?.faturaId });
            // Gün sınırı, tarih ve fatura numarası yetkisi: numara yetkisi yoksa yenide numaratör, düzeltmede kaydın numarası
            const { nolar, yetki } = await fisKayitYetkisi(req, "fatura", req.body?.faturaId, req.body?.tarih);
            bankaHesabiDenetle(yetki, req.body?.odemeler);
            const result = await PerakendeService.createInvoice({ ...req.body, vezneId, ...(nolar && { faturaNo: nolar.FATURA_NO ?? "" }) }, userId ? Number(userId) : undefined, dbContext);
            res.status(201).json({
                success: true,
                message: "Fatura ve satış başarıyla kaydedildi",
                data: result,
            });
        }
        catch (err) {
            logger.error("PerakendeController.createInvoice error", { error: err.message, stack: err.stack });
            const errorMessage = err.originalError?.info?.message || err.message || "Fatura kaydedilemedi";
            res.status(400).json({
                success: false,
                message: errorMessage,
            });
        }
    },
    async listInvoices(req, res, next) {
        try {
            const dbContext = PerakendeController.getDbContext(req);
            const { baslangicTarihi, bitisTarihi, aliciVknTckn, eBelgeDurumu, search, limit, } = req.query;
            const data = await PerakendeService.listInvoices({
                // Kullanıcının işlem gösterme sınırı istekteki başlangıçtan sonraysa o geçerli (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2)
                baslangicTarihi: (sonrakiGun(baslangicTarihi, await gunSiniri(req)) ?? undefined),
                bitisTarihi: bitisTarihi,
                aliciVknTckn: aliciVknTckn,
                eBelgeDurumu: eBelgeDurumu !== undefined ? Number(eBelgeDurumu) : undefined,
                search: search,
                limit: limit ? Number(limit) : 200,
            }, dbContext);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
    async getInvoiceById(req, res, next) {
        try {
            const dbContext = PerakendeController.getDbContext(req);
            const id = Number(req.params.id);
            if (!id || isNaN(id)) {
                return res.status(400).json({ success: false, message: "Geçersiz fatura ID" });
            }
            await kayitErisimi(req, "fatura", id);
            const data = await PerakendeService.getInvoiceById(id, dbContext);
            if (!data) {
                return res.status(404).json({ success: false, message: "Fatura bulunamadı" });
            }
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
    async deleteInvoice(req, res, next) {
        try {
            const dbContext = PerakendeController.getDbContext(req);
            const id = Number(req.params.id);
            if (!id || isNaN(id)) {
                return res.status(400).json({ success: false, message: "Geçersiz fatura ID" });
            }
            await kayitErisimi(req, "fatura", id);
            await PerakendeService.deleteInvoice(id, dbContext);
            res.json({
                success: true,
                message: "Fatura başarıyla silindi ve ürünler stoğa iade edildi",
            });
        }
        catch (err) {
            logger.error("PerakendeController.deleteInvoice error", { error: err.message });
            const errorMessage = err.originalError?.info?.message || err.message || "Fatura silinemedi";
            res.status(400).json({
                success: false,
                message: errorMessage,
            });
        }
    },
    async getProductByBarcode(req, res, next) {
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
        }
        catch (err) {
            logger.error("PerakendeController.getProductByBarcode error", { error: err.message });
            const errorMessage = err.originalError?.info?.message || err.message || "Ürün sorgulanamadı";
            res.status(400).json({
                success: false,
                message: errorMessage,
            });
        }
    },
    async getNextFaturaNo(req, res, next) {
        try {
            const dbContext = PerakendeController.getDbContext(req);
            const prefix = req.query.prefix || "GIB";
            const nextNo = await PerakendeService.getNextFaturaNo(prefix, dbContext);
            res.json({ success: true, faturaNo: nextNo });
        }
        catch (err) {
            next(err);
        }
    },
};

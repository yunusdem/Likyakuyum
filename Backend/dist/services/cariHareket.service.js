import { CariHareketSqlRepository, } from "../models/cariHareketSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { bellekteSuz, gunEkle } from "../utils/fisDurbunFiltre.js";
export class CariHareketService {
    static async list(filters, dbContext) {
        return CariHareketSqlRepository.findAll(filters, dbContext);
    }
    /**
     * Dürbün (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D1–D4, §5). Liste birden çok kaynağın (cari hareket, sarraf / döviz /
     * perakende fişi) birleşimi; tarih, vezne ve Borç / Alacak SQL'e gider, ürün (para), tutar (satır meblağı), cari ve belge no
     * (kayıt no / açıklamadaki fiş no) bellekte aynı filtreyle süzülür. Bitiş günü SQL'e bir gün geniş verilip bellekte kırpılır
     * (findAll bitişi yerel 23:59'a çeker, sürücü UTC gönderdiği için gün sonundaki kayıtlar kaçardı).
     */
    static async durbunListesi(filters, durbun, limit, dbContext) {
        const f = { ...filters };
        if (durbun.tarihBas)
            f.startDate = [f.startDate ? String(f.startDate).slice(0, 10) : "", durbun.tarihBas].filter(Boolean).sort().pop();
        if (durbun.tarihBit)
            f.endDate = gunEkle(durbun.tarihBit, 1);
        if (durbun.vezneId)
            f.vezneId = durbun.vezneId;
        if (durbun.tip === "0" || durbun.tip === "1")
            f.tip = Number(durbun.tip);
        const liste = await CariHareketSqlRepository.findAll(f, dbContext);
        const suzulmus = bellekteSuz(liste, durbun, {
            tarih: (x) => x.tarih,
            vezne: (x) => [x.vezneId],
            urunler: (x) => (x.satirlar || []).map((s) => s.paraId),
            tip: (x) => x.tip,
            cari: (x) => [x.cariKod, x.cariAd],
            tutarlar: (x) => (x.satirlar || []).map((s) => Math.abs(Number(s.meblag) || 0)),
            belgeNo: (x) => [x.id, x.aciklama],
        });
        return limit && limit > 0 ? suzulmus.slice(0, limit) : suzulmus;
    }
    static async getById(id, dbContext) {
        const item = await CariHareketSqlRepository.findById(id, dbContext);
        if (!item) {
            throw ApiError.notFound(`Cari hareket (ID: ${id}) bulunamadı.`);
        }
        return item;
    }
    static async create(input, userId = 1, dbContext) {
        if (!input.cariKartId) {
            throw ApiError.badRequest("Cari kart seçimi zorunludur.");
        }
        if (!input.vezneId) {
            throw ApiError.badRequest("Vezne seçimi zorunludur.");
        }
        if (!input.satirlar || input.satirlar.length === 0) {
            throw ApiError.badRequest("En az bir hareket satırı (para birimi ve meblağ) girilmelidir.");
        }
        const validLines = input.satirlar.filter((s) => s.paraId && Number(s.meblag) > 0);
        if (validLines.length === 0) {
            throw ApiError.badRequest("Geçerli bir para birimi ve pozitif bir meblağ girilmelidir.");
        }
        return CariHareketSqlRepository.create({
            ...input,
            satirlar: validLines,
        }, userId, dbContext);
    }
    static async update(id, input, userId = 1, dbContext) {
        const existing = await CariHareketSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Güncellenecek cari hareket (ID: ${id}) bulunamadı.`);
        }
        if (!input.cariKartId) {
            throw ApiError.badRequest("Cari kart seçimi zorunludur.");
        }
        if (!input.vezneId) {
            throw ApiError.badRequest("Vezne seçimi zorunludur.");
        }
        if (!input.satirlar || input.satirlar.length === 0) {
            throw ApiError.badRequest("En az bir hareket satırı girilmelidir.");
        }
        const validLines = input.satirlar.filter((s) => s.paraId && Number(s.meblag) > 0);
        if (validLines.length === 0) {
            throw ApiError.badRequest("Geçerli bir para birimi ve pozitif bir meblağ girilmelidir.");
        }
        return CariHareketSqlRepository.update(id, {
            ...input,
            satirlar: validLines,
        }, userId, dbContext);
    }
    static async delete(id, dbContext) {
        const existing = await CariHareketSqlRepository.findById(id, dbContext);
        if (!existing) {
            throw ApiError.notFound(`Silinecek cari hareket (ID: ${id}) bulunamadı.`);
        }
        return CariHareketSqlRepository.delete(id, dbContext);
    }
    static async getNavigation(currentId, dbContext, baslangic, userFilter) {
        return CariHareketSqlRepository.getNavigationIds(currentId, dbContext, baslangic, userFilter);
    }
    static async getCariBakiye(cariKartId, dbContext) {
        if (!cariKartId) {
            throw ApiError.badRequest("Cari kart ID belirtilmelidir.");
        }
        return CariHareketSqlRepository.getCariBakiye(cariKartId, dbContext);
    }
}

import { AltinUrunSqlRepository } from "../models/altinUrunSql.repository.js";
import { OzelUrunSqlRepository } from "../models/ozelUrunSql.repository.js";
import { EtiketSablonSqlRepository } from "../models/etiketSablonSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
export class EtiketService {
    // ─── Altın Ürün ────────────────────────────────────────────────────────────
    static listAltinUrun(filter, dbContext) {
        return AltinUrunSqlRepository.list(filter, dbContext);
    }
    static async getAltinUrunById(id, dbContext) {
        const item = await AltinUrunSqlRepository.getById(id, dbContext);
        if (!item)
            throw ApiError.notFound("Altın ürün bulunamadı.");
        return item;
    }
    static async getAltinUrunByBarkod(barkod, dbContext) {
        const item = await AltinUrunSqlRepository.getByBarkod(barkod, dbContext);
        if (!item)
            throw ApiError.notFound("Bu barkoda ait altın ürün bulunamadı.");
        return item;
    }
    static saveAltinUrun(dto, kullaniciId, dbContext) {
        if (!dto.grupKodu || !dto.grupKodu.trim()) {
            throw ApiError.badRequest("Grup kodu zorunludur.");
        }
        if (!dto.urunNo || Number(dto.urunNo) <= 0) {
            throw ApiError.badRequest("Ürün numarası zorunludur.");
        }
        if (!dto.ayar || !dto.ayar.trim()) {
            throw ApiError.badRequest("Ayar/Milyem bilgisi zorunludur.");
        }
        return AltinUrunSqlRepository.save(dto, kullaniciId, dbContext);
    }
    static removeAltinUrun(id, dbContext) {
        return AltinUrunSqlRepository.remove(id, dbContext);
    }
    static markAltinUrunYazdirildi(ids, yazdirildi, kullaniciId, dbContext) {
        return AltinUrunSqlRepository.markYazdirildi(ids, yazdirildi, kullaniciId, dbContext);
    }
    static getNextAltinUrunNo(grupKodu, uzunluk, dbContext) {
        return AltinUrunSqlRepository.getNextUrunNo(grupKodu, uzunluk, dbContext);
    }
    // ─── Özel Ürün ─────────────────────────────────────────────────────────────
    static listOzelUrun(filter, dbContext) {
        return OzelUrunSqlRepository.list(filter, dbContext);
    }
    static async getOzelUrunById(id, dbContext) {
        const item = await OzelUrunSqlRepository.getById(id, dbContext);
        if (!item)
            throw ApiError.notFound("Özel ürün bulunamadı.");
        return item;
    }
    static async getOzelUrunByBarkod(barkod, dbContext) {
        const item = await OzelUrunSqlRepository.getByBarkod(barkod, dbContext);
        if (!item)
            throw ApiError.notFound("Bu barkoda ait özel ürün bulunamadı.");
        return item;
    }
    static saveOzelUrun(dto, kullaniciId, dbContext) {
        if (!dto.grupKodu || !dto.grupKodu.trim()) {
            throw ApiError.badRequest("Grup kodu zorunludur.");
        }
        if (!dto.urunNo || Number(dto.urunNo) <= 0) {
            throw ApiError.badRequest("Ürün numarası zorunludur.");
        }
        return OzelUrunSqlRepository.save(dto, kullaniciId, dbContext);
    }
    static removeOzelUrun(id, dbContext) {
        return OzelUrunSqlRepository.remove(id, dbContext);
    }
    static markOzelUrunYazdirildi(ids, yazdirildi, kullaniciId, dbContext) {
        return OzelUrunSqlRepository.markYazdirildi(ids, yazdirildi, kullaniciId, dbContext);
    }
    static getNextOzelUrunNo(grupKodu, uzunluk, dbContext) {
        return OzelUrunSqlRepository.getNextUrunNo(grupKodu, uzunluk, dbContext);
    }
    // ─── Ortak Lookup'lar ──────────────────────────────────────────────────────
    static async getGrupKodlari(dbContext) {
        const [a, o] = await Promise.all([
            AltinUrunSqlRepository.getDistinctGrupKodlari(dbContext),
            OzelUrunSqlRepository.getDistinctGrupKodlari(dbContext),
        ]);
        return Array.from(new Set([...a, ...o])).sort();
    }
    static async getUreticiFirmalar(dbContext) {
        const [a, o] = await Promise.all([
            AltinUrunSqlRepository.getDistinctUreticiFirmalar(dbContext),
            OzelUrunSqlRepository.getDistinctUreticiFirmalar(dbContext),
        ]);
        return Array.from(new Set([...a, ...o])).sort();
    }
    // ─── Etiket Şablonları ─────────────────────────────────────────────────────
    static listSablon(filter, dbContext) {
        return EtiketSablonSqlRepository.list(filter, dbContext);
    }
    static async getSablonById(id, dbContext) {
        const item = await EtiketSablonSqlRepository.getById(id, dbContext);
        if (!item)
            throw ApiError.notFound("Etiket şablonu bulunamadı.");
        return item;
    }
    static saveSablon(dto, kullaniciId, dbContext) {
        if (!dto.ad || !dto.ad.trim()) {
            throw ApiError.badRequest("Şablon adı zorunludur.");
        }
        return EtiketSablonSqlRepository.save(dto, kullaniciId, dbContext);
    }
    static removeSablon(id, dbContext) {
        return EtiketSablonSqlRepository.remove(id, dbContext);
    }
}

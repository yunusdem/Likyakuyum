import { AltinUrunSqlRepository } from "../models/altinUrunSql.repository.js";
import { OzelUrunSqlRepository } from "../models/ozelUrunSql.repository.js";
import { EtiketSablonSqlRepository } from "../models/etiketSablonSql.repository.js";
import { EtiketNumeratorSqlRepository } from "../models/etiketNumeratorSql.repository.js";
import { UrunResimSqlRepository } from "../models/urunResimSql.repository.js";
import { BankoSqlRepository } from "../models/bankoSql.repository.js";
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
    // ─── Ortak Lookup'lar & Gruplar ───────────────────────────────────────────
    static listGruplar(tip, dbContext) {
        return EtiketNumeratorSqlRepository.listGruplar(tip, dbContext);
    }
    static saveGrup(tip, grupKodu, aciklama, baslangicNo, dbContext) {
        return EtiketNumeratorSqlRepository.saveGrup(tip, grupKodu, aciklama, baslangicNo, dbContext);
    }
    static deleteGrup(tip, grupKodu, dbContext) {
        return EtiketNumeratorSqlRepository.deleteGrup(tip, grupKodu, dbContext);
    }
    static async getGrupKodlari(dbContext) {
        const [a, o, g] = await Promise.all([
            AltinUrunSqlRepository.getDistinctGrupKodlari(dbContext),
            OzelUrunSqlRepository.getDistinctGrupKodlari(dbContext),
            EtiketNumeratorSqlRepository.listGruplar(undefined, dbContext),
        ]);
        const kodList = g.map((item) => item.grupKodu);
        return Array.from(new Set([...a, ...o, ...kodList])).sort();
    }
    static async getUreticiFirmalar(dbContext) {
        const [a, o] = await Promise.all([
            AltinUrunSqlRepository.getDistinctUreticiFirmalar(dbContext),
            OzelUrunSqlRepository.getDistinctUreticiFirmalar(dbContext),
        ]);
        return Array.from(new Set([...a, ...o])).sort();
    }
    // ─── Fotoğraf Yönetimi ─────────────────────────────────────────────────────
    static async uploadFoto(data, dbContext) {
        if (!data.base64)
            throw ApiError.badRequest("Fotoğraf verisi (base64) zorunludur.");
        return UrunResimSqlRepository.saveResimFile(data.base64, data.dosyaAdi || "urun.jpg", data.tip ?? 0, data.islemId || null, dbContext);
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
    // ─── Banko Yönetimi (TODVZ_BANKO) ──────────────────────────────────────────
    static listBankolar(filter, dbContext) {
        return BankoSqlRepository.list(filter, dbContext);
    }
    static getBankoById(id, dbContext) {
        return BankoSqlRepository.getById(id, dbContext);
    }
    static saveBanko(dto, kullaniciId, dbContext) {
        return BankoSqlRepository.save(dto, kullaniciId, dbContext);
    }
    static deleteBanko(id, dbContext) {
        return BankoSqlRepository.remove(id, dbContext);
    }
}

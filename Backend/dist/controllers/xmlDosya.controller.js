import { XmlDosyaService } from "../services/xmlDosya.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
const getDbContext = (req) => ({
    dbServer: req.user?.dbServer ||
        req.headers["x-db-server"] ||
        req.query.dbServer ||
        req.body?.dbServer,
    dbName: req.user?.dbName ||
        req.headers["x-db-name"] ||
        req.query.dbName ||
        req.body?.dbName,
});
export class XmlDosyaController {
    static async kontrolMerkezKur(req, res, next) {
        try {
            const { ilkTarih, sonTarih, belgeIslemNo, belgeIslemNoTuru } = req.query;
            if (!ilkTarih || !sonTarih) {
                throw ApiError.badRequest("İlk tarih ve son tarih gereklidir.");
            }
            const result = await XmlDosyaService.kontrolMerkezKur({
                ilkTarih: String(ilkTarih),
                sonTarih: String(sonTarih),
                belgeIslemNo: belgeIslemNo ? String(belgeIslemNo) : undefined,
                belgeIslemNoTuru: belgeIslemNoTuru,
            }, getDbContext(req));
            return ApiResponse.ok(res, "Merkez kur kontrolü tamamlandı.", result);
        }
        catch (error) {
            next(error);
        }
    }
    static async kontrolFirma(req, res, next) {
        try {
            const result = await XmlDosyaService.kontrolFirma(getDbContext(req));
            return ApiResponse.ok(res, "Firma bilgisi kontrolü tamamlandı.", result);
        }
        catch (error) {
            next(error);
        }
    }
    static async kontrolFis(req, res, next) {
        try {
            const { ilkTarih, sonTarih, belgeIslemNo, belgeIslemNoTuru } = req.query;
            if (!ilkTarih || !sonTarih) {
                throw ApiError.badRequest("İlk tarih ve son tarih gereklidir.");
            }
            const result = await XmlDosyaService.kontrolFis({
                ilkTarih: String(ilkTarih),
                sonTarih: String(sonTarih),
                belgeIslemNo: belgeIslemNo ? String(belgeIslemNo) : undefined,
                belgeIslemNoTuru: belgeIslemNoTuru,
            }, getDbContext(req));
            return ApiResponse.ok(res, "Fiş kontrolü tamamlandı.", result);
        }
        catch (error) {
            next(error);
        }
    }
    static async kontrolFisSatiri(req, res, next) {
        try {
            const { ilkTarih, sonTarih, belgeIslemNo, belgeIslemNoTuru } = req.query;
            if (!ilkTarih || !sonTarih) {
                throw ApiError.badRequest("İlk tarih ve son tarih gereklidir.");
            }
            const result = await XmlDosyaService.kontrolFisSatiri({
                ilkTarih: String(ilkTarih),
                sonTarih: String(sonTarih),
                belgeIslemNo: belgeIslemNo ? String(belgeIslemNo) : undefined,
                belgeIslemNoTuru: belgeIslemNoTuru,
            }, getDbContext(req));
            return ApiResponse.ok(res, "Fiş satırı kontrolü tamamlandı.", result);
        }
        catch (error) {
            next(error);
        }
    }
    static async olustur(req, res, next) {
        try {
            const { bildirimTuru, hazirlamaTarihi, dosyaNo, islemYok, aciklama, belgeIslemNoTuru, dosyaAdi, ilkTarih, sonTarih, } = req.body;
            if (!ilkTarih || !sonTarih) {
                throw ApiError.badRequest("İlk işlem tarihi ve son işlem tarihi gereklidir.");
            }
            const result = await XmlDosyaService.olusturXml({
                bildirimTuru,
                hazirlamaTarihi: hazirlamaTarihi || new Date().toISOString(),
                dosyaNo: dosyaNo || "0",
                islemYok: Boolean(islemYok),
                aciklama,
                belgeIslemNoTuru,
                dosyaAdi,
                ilkTarih,
                sonTarih,
            }, getDbContext(req));
            return ApiResponse.ok(res, "XML dosyası başarıyla oluşturuldu.", result);
        }
        catch (error) {
            next(error);
        }
    }
    static async birlestir(req, res, next) {
        try {
            const { kaynakXml, hedefXml, dosyaNo, hazirlamaTarihi } = req.body;
            if (!kaynakXml || !hedefXml) {
                throw ApiError.badRequest("Kaynak ve hedef XML içerikleri zorunludur.");
            }
            const result = XmlDosyaService.birlestirXml({
                kaynakXml,
                hedefXml,
                dosyaNo,
                hazirlamaTarihi,
            });
            return ApiResponse.ok(res, "XML dosyaları başarıyla birleştirildi.", result);
        }
        catch (error) {
            next(error);
        }
    }
}

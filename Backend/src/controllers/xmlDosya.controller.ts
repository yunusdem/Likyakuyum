import { Request, Response, NextFunction } from "express";
import { XmlDosyaService, DbContext } from "../services/xmlDosya.service.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";

const getDbContext = (req: Request): DbContext => ({
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
});

export class XmlDosyaController {
  public static async kontrolMerkezKur(req: Request, res: Response, next: NextFunction) {
    try {
      const { ilkTarih, sonTarih, belgeIslemNo, belgeIslemNoTuru, tlVergiSiniri, dovizVergiSiniri, detayDurumu } = req.query;
      if (!ilkTarih || !sonTarih) {
        throw ApiError.badRequest("İlk tarih ve son tarih gereklidir.");
      }

      const result = await XmlDosyaService.kontrolMerkezKur(
        {
          ilkTarih: String(ilkTarih),
          sonTarih: String(sonTarih),
          belgeIslemNo: belgeIslemNo ? String(belgeIslemNo) : undefined,
          belgeIslemNoTuru: belgeIslemNoTuru as any,
          tlVergiSiniri: tlVergiSiniri !== undefined && tlVergiSiniri !== "" ? Number(tlVergiSiniri) : undefined,
          dovizVergiSiniri: dovizVergiSiniri !== undefined && dovizVergiSiniri !== "" ? Number(dovizVergiSiniri) : undefined,
          detayDurumu: detayDurumu as any,
        },
        getDbContext(req)
      );

      return ApiResponse.ok(res, "Merkez kur kontrolü tamamlandı.", result);
    } catch (error) {
      next(error);
    }
  }

  public static async kontrolFirma(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await XmlDosyaService.kontrolFirma(getDbContext(req));
      return ApiResponse.ok(res, "Firma bilgisi kontrolü tamamlandı.", result);
    } catch (error) {
      next(error);
    }
  }

  public static async kontrolFis(req: Request, res: Response, next: NextFunction) {
    try {
      const { ilkTarih, sonTarih, belgeIslemNo, belgeIslemNoTuru, tlVergiSiniri, dovizVergiSiniri } = req.query;
      if (!ilkTarih || !sonTarih) {
        throw ApiError.badRequest("İlk tarih ve son tarih gereklidir.");
      }

      const result = await XmlDosyaService.kontrolFis(
        {
          ilkTarih: String(ilkTarih),
          sonTarih: String(sonTarih),
          belgeIslemNo: belgeIslemNo ? String(belgeIslemNo) : undefined,
          belgeIslemNoTuru: belgeIslemNoTuru as any,
          tlVergiSiniri: tlVergiSiniri !== undefined ? Number(tlVergiSiniri) : undefined,
          dovizVergiSiniri: dovizVergiSiniri !== undefined ? Number(dovizVergiSiniri) : undefined,
        },
        getDbContext(req)
      );

      return ApiResponse.ok(res, "Fiş kontrolü tamamlandı.", result);
    } catch (error) {
      next(error);
    }
  }

  public static async kontrolFisSatiri(req: Request, res: Response, next: NextFunction) {
    try {
      const { ilkTarih, sonTarih, belgeIslemNo, belgeIslemNoTuru, tlVergiSiniri, dovizVergiSiniri } = req.query;
      if (!ilkTarih || !sonTarih) {
        throw ApiError.badRequest("İlk tarih ve son tarih gereklidir.");
      }

      const result = await XmlDosyaService.kontrolFisSatiri(
        {
          ilkTarih: String(ilkTarih),
          sonTarih: String(sonTarih),
          belgeIslemNo: belgeIslemNo ? String(belgeIslemNo) : undefined,
          belgeIslemNoTuru: belgeIslemNoTuru as any,
          tlVergiSiniri: tlVergiSiniri !== undefined ? Number(tlVergiSiniri) : undefined,
          dovizVergiSiniri: dovizVergiSiniri !== undefined ? Number(dovizVergiSiniri) : undefined,
        },
        getDbContext(req)
      );

      return ApiResponse.ok(res, "Fiş satırı kontrolü tamamlandı.", result);
    } catch (error) {
      next(error);
    }
  }

  public static async olustur(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        bildirimTuru,
        hazirlamaTarihi,
        dosyaNo,
        islemYok,
        aciklama,
        belgeIslemNoTuru,
        dosyaAdi,
        ilkTarih,
        sonTarih,
        tlVergiSiniri,
        dovizVergiSiniri,
      } = req.body;

      if (!ilkTarih || !sonTarih) {
        throw ApiError.badRequest("İlk işlem tarihi ve son işlem tarihi gereklidir.");
      }

      const result = await XmlDosyaService.olusturXml(
        {
          bildirimTuru,
          hazirlamaTarihi: hazirlamaTarihi || new Date().toISOString(),
          dosyaNo: dosyaNo || "0",
          islemYok: Boolean(islemYok),
          aciklama,
          belgeIslemNoTuru,
          dosyaAdi,
          ilkTarih,
          sonTarih,
          tlVergiSiniri: tlVergiSiniri !== undefined ? Number(tlVergiSiniri) : undefined,
          dovizVergiSiniri: dovizVergiSiniri !== undefined ? Number(dovizVergiSiniri) : undefined,
        },
        getDbContext(req)
      );

      return ApiResponse.ok(res, "XML dosyası başarıyla oluşturuldu.", result);
    } catch (error) {
      next(error);
    }
  }

  public static async birlestir(req: Request, res: Response, next: NextFunction) {
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
    } catch (error) {
      next(error);
    }
  }
}

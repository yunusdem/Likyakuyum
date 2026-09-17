import { AltinUrunSqlRepository, AltinUrunModel, SaveAltinUrunDto } from "../models/altinUrunSql.repository.js";
import { OzelUrunSqlRepository, OzelUrunModel, SaveOzelUrunDto } from "../models/ozelUrunSql.repository.js";
import { EtiketSablonSqlRepository, EtiketSablonModel, SaveEtiketSablonDto } from "../models/etiketSablonSql.repository.js";
import { EtiketNumeratorSqlRepository, EtiketGrupNoResult } from "../models/etiketNumeratorSql.repository.js";
import { UrunResimSqlRepository } from "../models/urunResimSql.repository.js";
import { BankoSqlRepository, BankoModel, SaveBankoDto } from "../models/bankoSql.repository.js";
import { ApiError } from "../utils/ApiError.js";

type DbCtx = { dbServer?: string; dbName?: string };

export class EtiketService {
  // ─── Altın Ürün ────────────────────────────────────────────────────────────
  public static listAltinUrun(filter: any, dbContext?: DbCtx): Promise<AltinUrunModel[]> {
    return AltinUrunSqlRepository.list(filter, dbContext);
  }

  public static async getAltinUrunById(id: number, dbContext?: DbCtx): Promise<AltinUrunModel> {
    const item = await AltinUrunSqlRepository.getById(id, dbContext);
    if (!item) throw ApiError.notFound("Altın ürün bulunamadı.");
    return item;
  }

  public static async getAltinUrunByBarkod(barkod: string, dbContext?: DbCtx): Promise<AltinUrunModel> {
    const item = await AltinUrunSqlRepository.getByBarkod(barkod, dbContext);
    if (!item) throw ApiError.notFound("Bu barkoda ait altın ürün bulunamadı.");
    return item;
  }

  public static saveAltinUrun(dto: SaveAltinUrunDto, kullaniciId?: number, dbContext?: DbCtx): Promise<AltinUrunModel> {
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

  public static removeAltinUrun(id: number, dbContext?: DbCtx): Promise<boolean> {
    return AltinUrunSqlRepository.remove(id, dbContext);
  }

  public static markAltinUrunYazdirildi(ids: number[], yazdirildi: boolean, kullaniciId?: number, dbContext?: DbCtx): Promise<void> {
    return AltinUrunSqlRepository.markYazdirildi(ids, yazdirildi, kullaniciId, dbContext);
  }

  public static getNextAltinUrunNo(grupKodu: string, uzunluk: number, dbContext?: DbCtx): Promise<EtiketGrupNoResult> {
    return AltinUrunSqlRepository.getNextUrunNo(grupKodu, uzunluk, dbContext);
  }

  // ─── Özel Ürün ─────────────────────────────────────────────────────────────
  public static listOzelUrun(filter: any, dbContext?: DbCtx): Promise<OzelUrunModel[]> {
    return OzelUrunSqlRepository.list(filter, dbContext);
  }

  public static async getOzelUrunById(id: number, dbContext?: DbCtx): Promise<OzelUrunModel> {
    const item = await OzelUrunSqlRepository.getById(id, dbContext);
    if (!item) throw ApiError.notFound("Özel ürün bulunamadı.");
    return item;
  }

  public static async getOzelUrunByBarkod(barkod: string, dbContext?: DbCtx): Promise<OzelUrunModel> {
    const item = await OzelUrunSqlRepository.getByBarkod(barkod, dbContext);
    if (!item) throw ApiError.notFound("Bu barkoda ait özel ürün bulunamadı.");
    return item;
  }

  public static saveOzelUrun(dto: SaveOzelUrunDto, kullaniciId?: number, dbContext?: DbCtx): Promise<OzelUrunModel> {
    if (!dto.grupKodu || !dto.grupKodu.trim()) {
      throw ApiError.badRequest("Grup kodu zorunludur.");
    }
    if (!dto.urunNo || Number(dto.urunNo) <= 0) {
      throw ApiError.badRequest("Ürün numarası zorunludur.");
    }
    return OzelUrunSqlRepository.save(dto, kullaniciId, dbContext);
  }

  public static removeOzelUrun(id: number, dbContext?: DbCtx): Promise<boolean> {
    return OzelUrunSqlRepository.remove(id, dbContext);
  }

  public static markOzelUrunYazdirildi(ids: number[], yazdirildi: boolean, kullaniciId?: number, dbContext?: DbCtx): Promise<void> {
    return OzelUrunSqlRepository.markYazdirildi(ids, yazdirildi, kullaniciId, dbContext);
  }

  public static getNextOzelUrunNo(grupKodu: string, uzunluk: number, dbContext?: DbCtx): Promise<EtiketGrupNoResult> {
    return OzelUrunSqlRepository.getNextUrunNo(grupKodu, uzunluk, dbContext);
  }

  // ─── Ortak Lookup'lar & Gruplar ───────────────────────────────────────────
  public static listGruplar(tip?: number, dbContext?: DbCtx) {
    return EtiketNumeratorSqlRepository.listGruplar(tip, dbContext);
  }

  public static saveGrup(tip: number, grupKodu: string, aciklama?: string | null, baslangicNo?: number, dbContext?: DbCtx) {
    return EtiketNumeratorSqlRepository.saveGrup(tip, grupKodu, aciklama, baslangicNo, dbContext);
  }

  public static deleteGrup(tip: number, grupKodu: string, dbContext?: DbCtx) {
    return EtiketNumeratorSqlRepository.deleteGrup(tip, grupKodu, dbContext);
  }

  public static async getGrupKodlari(dbContext?: DbCtx): Promise<string[]> {
    const [a, o, g] = await Promise.all([
      AltinUrunSqlRepository.getDistinctGrupKodlari(dbContext),
      OzelUrunSqlRepository.getDistinctGrupKodlari(dbContext),
      EtiketNumeratorSqlRepository.listGruplar(undefined, dbContext),
    ]);
    const kodList = g.map((item) => item.grupKodu);
    return Array.from(new Set([...a, ...o, ...kodList])).sort();
  }

  public static async getUreticiFirmalar(dbContext?: DbCtx): Promise<string[]> {
    const [a, o] = await Promise.all([
      AltinUrunSqlRepository.getDistinctUreticiFirmalar(dbContext),
      OzelUrunSqlRepository.getDistinctUreticiFirmalar(dbContext),
    ]);
    return Array.from(new Set([...a, ...o])).sort();
  }

  // ─── Fotoğraf Yönetimi ─────────────────────────────────────────────────────
  public static async uploadFoto(
    data: { base64: string; dosyaAdi?: string; tip?: number; islemId?: number },
    dbContext?: DbCtx
  ) {
    if (!data.base64) throw ApiError.badRequest("Fotoğraf verisi (base64) zorunludur.");
    return UrunResimSqlRepository.saveResimFile(
      data.base64,
      data.dosyaAdi || "urun.jpg",
      data.tip ?? 0,
      data.islemId || null,
      dbContext
    );
  }

  // ─── Etiket Şablonları ─────────────────────────────────────────────────────
  public static listSablon(filter: any, dbContext?: DbCtx): Promise<EtiketSablonModel[]> {
    return EtiketSablonSqlRepository.list(filter, dbContext);
  }

  public static async getSablonById(id: number, dbContext?: DbCtx): Promise<EtiketSablonModel> {
    const item = await EtiketSablonSqlRepository.getById(id, dbContext);
    if (!item) throw ApiError.notFound("Etiket şablonu bulunamadı.");
    return item;
  }

  public static saveSablon(dto: SaveEtiketSablonDto, kullaniciId?: number, dbContext?: DbCtx): Promise<EtiketSablonModel> {
    if (!dto.ad || !dto.ad.trim()) {
      throw ApiError.badRequest("Şablon adı zorunludur.");
    }
    return EtiketSablonSqlRepository.save(dto, kullaniciId, dbContext);
  }

  public static removeSablon(id: number, dbContext?: DbCtx): Promise<boolean> {
    return EtiketSablonSqlRepository.remove(id, dbContext);
  }

  // ─── Banko Yönetimi (TODVZ_BANKO) ──────────────────────────────────────────
  public static listBankolar(filter?: { search?: string; aktif?: boolean }, dbContext?: DbCtx): Promise<BankoModel[]> {
    return BankoSqlRepository.list(filter, dbContext);
  }

  public static getBankoById(id: number, dbContext?: DbCtx): Promise<BankoModel | null> {
    return BankoSqlRepository.getById(id, dbContext);
  }

  public static saveBanko(dto: SaveBankoDto, kullaniciId?: number, dbContext?: DbCtx): Promise<BankoModel> {
    return BankoSqlRepository.save(dto, kullaniciId, dbContext);
  }

  public static deleteBanko(id: number, dbContext?: DbCtx): Promise<boolean> {
    return BankoSqlRepository.remove(id, dbContext);
  }
}

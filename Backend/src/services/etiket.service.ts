import { AltinUrunSqlRepository, AltinUrunModel, SaveAltinUrunDto } from "../models/altinUrunSql.repository.js";
import { OzelUrunSqlRepository, OzelUrunModel, SaveOzelUrunDto } from "../models/ozelUrunSql.repository.js";
import { EtiketSablonSqlRepository, EtiketSablonModel, SaveEtiketSablonDto } from "../models/etiketSablonSql.repository.js";
import { EtiketLogoSqlRepository, EtiketLogoModel } from "../models/etiketLogoSql.repository.js";
import { EtiketNumeratorSqlRepository, EtiketGrupNoResult } from "../models/etiketNumeratorSql.repository.js";
import { UrunResimSqlRepository } from "../models/urunResimSql.repository.js";
import { BankoSqlRepository, BankoModel, SaveBankoDto } from "../models/bankoSql.repository.js";
import { getDbPool } from "../config/mssql.config.js";
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

  public static getAltinUrunStok(vezneId: number, ayar: string, dbContext?: DbCtx) {
    return AltinUrunSqlRepository.getStok(vezneId, ayar, dbContext);
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

  // ─── Sektörel Logo & Damga Yönetimi (TODVZ_FOTOGRAF URUN_TIPI = 9) ─────────
  public static listLogolar(tip: number = 9, dbContext?: DbCtx) {
    return EtiketLogoSqlRepository.listLogos(tip, dbContext);
  }

  public static saveLogo(
    data: { base64: string; dosyaAdi?: string; mimeTipi?: string },
    kullaniciId?: number,
    tip: number = 9,
    dbContext?: DbCtx
  ) {
    return EtiketLogoSqlRepository.saveLogo(data, kullaniciId, tip, 0, dbContext);
  }

  public static deleteLogo(id: number, dbContext?: DbCtx) {
    return EtiketLogoSqlRepository.deleteLogo(id, dbContext);
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

  // ─── RFID EPC Kodlama & ZPL Termal Baskı Servisleri ───────────────────────
  public static generateEpcCode(id: number, tip: "altin" | "ozel", ayarStr?: string, grupKodu?: string): string {
    const ayarNum = (ayarStr || "14").replace(/[^0-9]/g, "") || "14";
    const ayarCode = ayarNum.padStart(2, "0").slice(-2);
    const tipCode = tip === "altin" ? "AL" : "OZ";
    const yearCode = new Date().getFullYear().toString().slice(-2);
    const idCode = Number(id || 1).toString().padStart(8, "0");
    const cleanGrup = (grupKodu || "LK").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2).padEnd(2, "K");
    
    const header = "E280";
    const body = `${cleanGrup}${ayarCode}${tipCode}${yearCode}${idCode}`.slice(0, 16);
    const hexBody = Buffer.from(body).toString("hex").toUpperCase().slice(0, 20);
    return `${header}${hexBody}`.slice(0, 24);
  }

  public static generateJewelryZpl(item: any, epc: string, designType = "kelebek"): string {
    const firma = "LIKYA KUYUMCULUK";
    const ayar = item.ayar ? `${item.ayar}K` : "14K";
    const gram = Number(item.brutGram || item.miktar || item.hasGram || 0).toFixed(2);
    const barkod = item.stokKodu || item.barkod || `${item.grupKodu || "LK"}-${item.urunNo || item.id || 1}`;
    const baslik = (item.urunAdi || item.model || item.mamulTipi || "Mücevher").slice(0, 18);
    const fiyat = item.satisFiyati ? `${Number(item.satisFiyati).toLocaleString("tr-TR")} ${item.satisParaKodu || "TL"}` : "";

    return `^XA
^PW600
^LL340
^LH0,0
^CI28
^FO30,25^A0N,22,22^FD${firma}^FS
^FO30,55^A0N,26,26^FD${baslik}^FS
^FO30,90^A0N,20,20^FDAyar: ${ayar} | Brüt: ${gram} g^FS
^FO30,118^A0N,18,18^FDFiyat: ${fiyat}^FS
^FO30,150^BY2,2,42^BCN,42,Y,N,N^FD${barkod}^FS
^RFW,H,1,2,6^FD${epc}^FS
^FO310,25^A0N,18,18^FD[RFID UHF ÇIP KODU]^FS
^FO310,50^A0N,16,16^FD${epc.slice(0, 12)}^FS
^FO310,70^A0N,16,16^FD${epc.slice(12)}^FS
^FO310,105^BQN,2,4^FDQA,${epc}^FS
^FO310,195^A0N,14,14^FDGen2 ISO18000-6C^FS
^XZ`;
  }

  public static async encodeAndPrintRfid(
    payload: { id: number; tip: "altin" | "ozel"; epc?: string; designType?: string },
    kullaniciId?: number,
    dbContext?: DbCtx
  ) {
    const { id, tip, designType } = payload;
    if (!id) throw ApiError.badRequest("Ürün ID zorunludur.");

    let productDetail: any = null;
    if (tip === "altin") {
      productDetail = await AltinUrunSqlRepository.getById(id, dbContext);
    } else {
      productDetail = await OzelUrunSqlRepository.getById(id, dbContext);
    }

    if (!productDetail) throw ApiError.notFound("Ürün bulunamadı.");

    const epc = payload.epc && payload.epc.trim().length >= 8
      ? payload.epc.trim().toUpperCase()
      : EtiketService.generateEpcCode(id, tip, productDetail.ayar, productDetail.grupKodu);

    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    const tableName = tip === "altin" ? "TODVZ_ALTIN_URUN" : "TODVZ_OZEL_URUN";
    const pkCol = tip === "altin" ? "ALTIN_URUN_ID" : "OZEL_URUN_ID";

    await pool.request()
      .input("EPC", (await import("mssql")).default.VarChar(100), epc)
      .input("ID", (await import("mssql")).default.Int, id)
      .query(`
        IF COL_LENGTH('dbo.${tableName}', 'RFID_STATUS') IS NULL ALTER TABLE dbo.${tableName} ADD [RFID_STATUS] TINYINT NULL DEFAULT 0;
        IF COL_LENGTH('dbo.${tableName}', 'ETIKET_BASIM_TARIHI') IS NULL ALTER TABLE dbo.${tableName} ADD [ETIKET_BASIM_TARIHI] DATETIME NULL;
        IF COL_LENGTH('dbo.${tableName}', 'RFID_EPC') IS NULL ALTER TABLE dbo.${tableName} ADD [RFID_EPC] VARCHAR(100) NULL;

        UPDATE dbo.${tableName}
        SET RFID_EPC = @EPC,
            RFID_STATUS = 1,
            ETIKET_BASIM_TARIHI = GETDATE(),
            YAZDIRILDI = 1,
            YAZDIRILDI_ZAMANI = GETDATE()
        WHERE ${pkCol} = @ID;
      `);

    const zpl = EtiketService.generateJewelryZpl(
      {
        ...productDetail,
        stokKodu: productDetail.barkod || `${productDetail.grupKodu}-${productDetail.urunNo}`,
        urunAdi: productDetail.model || productDetail.mamulTipi || productDetail.grupKodu,
        brutGram: productDetail.miktar || productDetail.hasGram,
      },
      epc,
      designType
    );

    return {
      success: true,
      id,
      tip,
      epc,
      zpl,
      message: "Ürün RFID çipine kodlandı ve ZPL termal baskı emri oluşturuldu.",
    };
  }

  public static async bulkEncodeRfid(
    payload: { items: Array<{ id: number; tip: "altin" | "ozel"; epc?: string; designType?: string }> },
    kullaniciId?: number,
    dbContext?: DbCtx
  ) {
    if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
      throw ApiError.badRequest("Kodlanacak ürün listesi boş olamaz.");
    }

    const results: any[] = [];
    const zplList: string[] = [];

    for (const item of payload.items) {
      try {
        const res = await EtiketService.encodeAndPrintRfid(item, kullaniciId, dbContext);
        results.push(res);
        zplList.push(res.zpl);
      } catch (err: any) {
        results.push({ id: item.id, tip: item.tip, success: false, error: err.message });
      }
    }

    return {
      success: true,
      totalCount: payload.items.length,
      successCount: results.filter((r) => r.success).length,
      results,
      combinedZpl: zplList.join("\n"),
    };
  }

  // ─── RFID EPC / Barkod Eşleştirme & Detay Servisi ─────────────────────────
  public static async getRfidProductDetail(epc: string, dbContext?: DbCtx) {
    const cleanEpc = String(epc || "").trim();
    if (!cleanEpc) throw ApiError.badRequest("EPC veya Barkod zorunludur.");

    // 1. Önce Altın Ürünlerde Ara
    let altin = await AltinUrunSqlRepository.getByBarkod(cleanEpc, dbContext).catch(() => null);
    if (!altin) {
      const altinList = await AltinUrunSqlRepository.list({ search: cleanEpc, limit: 1 }, dbContext).catch(() => []);
      if (altinList && altinList.length > 0) altin = altinList[0];
    }

    if (altin) {
      const ayarStr = (altin.ayar || "22").replace(/[^0-9.]/g, "");
      let milyem = 0.916;
      if (ayarStr === "24") milyem = 0.995;
      else if (ayarStr === "22") milyem = 0.916;
      else if (ayarStr === "18") milyem = 0.750;
      else if (ayarStr === "14") milyem = 0.585;
      else if (ayarStr === "8") milyem = 0.333;

      const brutGram = Number(altin.miktar || altin.hasGram || 0);
      const hasGram = altin.hasGram ? Number(altin.hasGram) : Number((brutGram * milyem).toFixed(3));

      return {
        tip: "altin",
        id: altin.altinUrunId,
        epc: altin.rfidEpc || cleanEpc,
        stokKodu: altin.barkod || `${altin.grupKodu}-${altin.urunNo}`,
        urunAdi: altin.model ? `${altin.grupKodu} - ${altin.model}` : `${altin.grupKodu} Altın Ürün (#${altin.urunNo})`,
        ayar: altin.ayar || "22",
        milyem,
        brutGram,
        hasGram,
        maliyetIscilik: altin.maliyetIscilik || 0,
        maliyetIscilikParaKodu: altin.maliyetIscilikParaKodu || "HAS",
        satisIscilik: altin.satisIscilik || 0,
        satisFiyati: altin.satisFiyati || 0,
        satisParaKodu: altin.satisParaKodu || "TL",
        banko: altin.banko || "Merkez Vitrin",
        resim: altin.resim,
        durum: "KAYITLI",
      };
    }

    // 2. Özel / Pırlanta Ürünlerde Ara
    let ozel = await OzelUrunSqlRepository.getByBarkod(cleanEpc, dbContext).catch(() => null);
    if (!ozel) {
      const ozelList = await OzelUrunSqlRepository.list({ search: cleanEpc, limit: 1 }, dbContext).catch(() => []);
      if (ozelList && ozelList.length > 0) ozel = ozelList[0];
    }

    if (ozel) {
      const ayarStr = (ozel.ayar || "18").replace(/[^0-9.]/g, "");
      let milyem = 0.750;
      if (ayarStr === "24") milyem = 0.995;
      else if (ayarStr === "22") milyem = 0.916;
      else if (ayarStr === "18") milyem = 0.750;
      else if (ayarStr === "14") milyem = 0.585;
      else if (ayarStr === "8") milyem = 0.333;

      const brutGram = Number(ozel.miktar || 0);
      const hasGram = Number((brutGram * milyem).toFixed(3));

      return {
        tip: "ozel",
        id: ozel.ozelUrunId,
        epc: ozel.rfidEpc || cleanEpc,
        stokKodu: ozel.barkod || `${ozel.grupKodu}-${ozel.urunNo}`,
        urunAdi: ozel.mamulTipi ? `${ozel.grupKodu} - ${ozel.mamulTipi}` : `${ozel.grupKodu} Özel Mücevher (#${ozel.urunNo})`,
        ayar: ozel.ayar || "18",
        milyem,
        brutGram,
        hasGram,
        maliyetIscilik: 0,
        maliyetIscilikParaKodu: "USD",
        satisIscilik: 0,
        satisFiyati: ozel.satisFiyati || 0,
        satisParaKodu: ozel.satisParaKodu || "USD",
        banko: ozel.banko || "Pırlanta Vitrini",
        resim: ozel.resim,
        durum: "KAYITLI",
      };
    }

    return {
      tip: "bilinmeyen",
      id: null,
      epc: cleanEpc,
      stokKodu: "TANIMSIZ",
      urunAdi: `Bilinmeyen RFID [${cleanEpc.slice(-8)}]`,
      ayar: "-",
      milyem: 0,
      brutGram: 0,
      hasGram: 0,
      satisFiyati: 0,
      satisParaKodu: "TL",
      banko: "Tanımsız",
      durum: "BILINMEYEN",
    };
  }
}


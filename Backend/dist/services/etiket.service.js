import { AltinUrunSqlRepository } from "../models/altinUrunSql.repository.js";
import { OzelUrunSqlRepository } from "../models/ozelUrunSql.repository.js";
import { EtiketSablonSqlRepository } from "../models/etiketSablonSql.repository.js";
import { EtiketLogoSqlRepository } from "../models/etiketLogoSql.repository.js";
import { EtiketNumeratorSqlRepository } from "../models/etiketNumeratorSql.repository.js";
import { UrunResimSqlRepository } from "../models/urunResimSql.repository.js";
import { BankoSqlRepository } from "../models/bankoSql.repository.js";
import { getDbPool } from "../config/mssql.config.js";
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
    static getAltinUrunStok(vezneId, ayar, dbContext) {
        return AltinUrunSqlRepository.getStok(vezneId, ayar, dbContext);
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
    // ─── Sektörel Logo & Damga Yönetimi (TODVZ_FOTOGRAF URUN_TIPI = 9) ─────────
    static listLogolar(tip = 9, dbContext) {
        return EtiketLogoSqlRepository.listLogos(tip, dbContext);
    }
    static saveLogo(data, kullaniciId, tip = 9, dbContext) {
        return EtiketLogoSqlRepository.saveLogo(data, kullaniciId, tip, 0, dbContext);
    }
    static deleteLogo(id, dbContext) {
        return EtiketLogoSqlRepository.deleteLogo(id, dbContext);
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
    // ─── RFID EPC Kodlama & ZPL Termal Baskı Servisleri ───────────────────────
    static generateEpcCode(id, tip, ayarStr, grupKodu) {
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
    static generateJewelryZpl(item, epc, designType = "kelebek") {
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
    static async encodeAndPrintRfid(payload, kullaniciId, dbContext) {
        const { id, tip, designType } = payload;
        if (!id)
            throw ApiError.badRequest("Ürün ID zorunludur.");
        let productDetail = null;
        if (tip === "altin") {
            productDetail = await AltinUrunSqlRepository.getById(id, dbContext);
        }
        else {
            productDetail = await OzelUrunSqlRepository.getById(id, dbContext);
        }
        if (!productDetail)
            throw ApiError.notFound("Ürün bulunamadı.");
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
        const zpl = EtiketService.generateJewelryZpl({
            ...productDetail,
            stokKodu: productDetail.barkod || `${productDetail.grupKodu}-${productDetail.urunNo}`,
            urunAdi: productDetail.model || productDetail.mamulTipi || productDetail.grupKodu,
            brutGram: productDetail.miktar || productDetail.hasGram,
        }, epc, designType);
        return {
            success: true,
            id,
            tip,
            epc,
            zpl,
            message: "Ürün RFID çipine kodlandı ve ZPL termal baskı emri oluşturuldu.",
        };
    }
    static async bulkEncodeRfid(payload, kullaniciId, dbContext) {
        if (!payload.items || !Array.isArray(payload.items) || payload.items.length === 0) {
            throw ApiError.badRequest("Kodlanacak ürün listesi boş olamaz.");
        }
        const results = [];
        const zplList = [];
        for (const item of payload.items) {
            try {
                const res = await EtiketService.encodeAndPrintRfid(item, kullaniciId, dbContext);
                results.push(res);
                zplList.push(res.zpl);
            }
            catch (err) {
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
    static async getRfidProductDetail(epc, dbContext) {
        const cleanEpc = String(epc || "").trim();
        if (!cleanEpc)
            throw ApiError.badRequest("EPC veya Barkod zorunludur.");
        // 1. Önce Altın Ürünlerde Ara
        let altin = await AltinUrunSqlRepository.getByBarkod(cleanEpc, dbContext).catch(() => null);
        if (!altin) {
            const altinList = await AltinUrunSqlRepository.list({ search: cleanEpc, limit: 1 }, dbContext).catch(() => []);
            if (altinList && altinList.length > 0)
                altin = altinList[0];
        }
        if (altin) {
            const ayarStr = (altin.ayar || "22").replace(/[^0-9.]/g, "");
            let milyem = 0.916;
            if (ayarStr === "24")
                milyem = 0.995;
            else if (ayarStr === "22")
                milyem = 0.916;
            else if (ayarStr === "18")
                milyem = 0.750;
            else if (ayarStr === "14")
                milyem = 0.585;
            else if (ayarStr === "8")
                milyem = 0.333;
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
            if (ozelList && ozelList.length > 0)
                ozel = ozelList[0];
        }
        if (ozel) {
            const ayarStr = (ozel.ayar || "18").replace(/[^0-9.]/g, "");
            let milyem = 0.750;
            if (ayarStr === "24")
                milyem = 0.995;
            else if (ayarStr === "22")
                milyem = 0.916;
            else if (ayarStr === "18")
                milyem = 0.750;
            else if (ayarStr === "14")
                milyem = 0.585;
            else if (ayarStr === "8")
                milyem = 0.333;
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

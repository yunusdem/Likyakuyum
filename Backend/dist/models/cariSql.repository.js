import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
const toInt = (val) => {
    if (val === undefined || val === null || val === "")
        return null;
    const p = parseInt(String(val), 10);
    return isNaN(p) ? null : p;
};
const toFloat = (val) => {
    if (val === undefined || val === null || val === "")
        return null;
    const p = parseFloat(String(val));
    return isNaN(p) ? null : p;
};
const toDateOrNull = (val) => {
    if (!val)
        return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};
const formatDateStr = (d) => {
    if (!d)
        return null;
    try {
        return new Date(d).toISOString().split("T")[0];
    }
    catch {
        return null;
    }
};
export class CariSqlRepository {
    static mapEntityToModel(entity) {
        return {
            id: entity.CARI_KART_ID,
            kod: (entity.KOD || "").trim(),
            ad: (entity.AD || "").trim(),
            kisilikTipi: entity.KISILIK_TIPI ?? 1,
            yetkiliKisi: entity.YETKILI_KISI ? entity.YETKILI_KISI.trim() : null,
            vergiDairesiId: entity.VERGI_DAIRESI_ID ?? null,
            vergiKimlikNo: entity.VERGI_KIMLIK_NO ? entity.VERGI_KIMLIK_NO.trim() : null,
            babaAdi: entity.BABA_ADI ? entity.BABA_ADI.trim() : null,
            adres: entity.ADRES ? entity.ADRES.trim() : null,
            postaKoduId: entity.POSTA_KODU_ID ?? null,
            ilceId: entity.ILCE_ID ?? null,
            ilId: entity.IL_ID ?? null,
            telefon: entity.TELEFON ? entity.TELEFON.trim() : null,
            uyrukId: entity.UYRUK_ID ?? null,
            ulkeId: entity.ULKE_ID ?? null,
            hukukiYapiId: entity.HUKUKI_YAPI_ID ?? null,
            vekilTuru: entity.VEKIL_TURU ?? null,
            vekilKisilikTipi: entity.VEKIL_KISILIK_TIPI ?? null,
            vekilAdi: entity.VEKIL_ADI ? entity.VEKIL_ADI.trim() : null,
            vekilKimlikNo: entity.VEKIL_KIMLIK_NO ? entity.VEKIL_KIMLIK_NO.trim() : null,
            pasaportNo: entity.PASAPORT_NO ? entity.PASAPORT_NO.trim() : null,
            alisIstatistikId: entity.ALIS_ISTATISTIK_ID ?? null,
            satisIstatistikId: entity.SATIS_ISTATISTIK_ID ?? null,
            arbitrajAlisIstatistikId: entity.ARBITRAJ_ALIS_ISTATISTIK_ID ?? null,
            arbitrajSatisIstatistikId: entity.ARBITRAJ_SATIS_ISTATISTIK_ID ?? null,
            eposta: entity.EPOSTA ? entity.EPOSTA.trim() : null,
            bankaHesabiId: entity.BANKA_HESABI_ID ?? null,
            anneAdi: entity.ANNE_ADI ? entity.ANNE_ADI.trim() : null,
            kimlikSeriNo: entity.KIMLIK_SERI_NO ? entity.KIMLIK_SERI_NO.trim() : null,
            dogumTarihi: formatDateStr(entity.DOGUM_TARIHI),
            dogumYeri: entity.DOGUM_YERI ? entity.DOGUM_YERI.trim() : null,
            karaListede: !!entity.KARA_LISTEDE,
            sektorId: entity.SEKTOR_ID ?? null,
            meslekId: entity.MESLEK_ID ?? null,
            kimlikGecerlilikTarihi: formatDateStr(entity.KIMLIK_GECERLILIK_TARIHI),
            faaliyetBelgesiAlindi: !!entity.FAALIYET_BELGESI_ALINDI,
            vergiLevhasiAlindi: !!entity.VERGI_LEVHASI_ALINDI,
            imzaSirkuleriAlindi: !!entity.IMZA_SIRKULERI_ALINDI,
            imzaSirkuGecerlilikTarihi: formatDateStr(entity.IMZA_SIRKU_GECERLILIK_TARIHI),
            yetkiliKimlikNo: entity.YETKILI_KIMLIK_NO ? entity.YETKILI_KIMLIK_NO.trim() : null,
            yetkiliKmlkGecerlikTarih: formatDateStr(entity.YETKILI_KMLK_GECERLIK_TARIH),
            filtre: entity.FILTRE ? entity.FILTRE.trim() : null,
            cariBakiyeSiniri: entity.CARI_BAKIYE_SINIRI ?? null,
            sirketTuru: entity.SIRKET_TURU ?? null,
            kimlikBelgeTuru: entity.KIMLIK_BELGE_TURU ?? null,
            dernekAmaci: entity.DERNEK_AMACI ? entity.DERNEK_AMACI.trim() : null,
            yetkiliKisiId: entity.YETKILI_KISI_ID ?? null,
            favoriParaId: entity.FAVORI_PARA_ID ?? null,
            whatsappAdi: entity.WHATSAPP_ADI ? entity.WHATSAPP_ADI.trim() : null,
            eFaturaPostaKutusu: entity.E_FATURA_POSTA_KUTUSU ? entity.E_FATURA_POSTA_KUTUSU.trim() : null,
            eIrsaliyePostaKutusu: entity.E_IRSALIYE_POSTA_KUTUSU ? entity.E_IRSALIYE_POSTA_KUTUSU.trim() : null,
        };
    }
    static async findAll(dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const query = `
        SELECT 
          [CARI_KART_ID], [KOD], [AD], [KISILIK_TIPI], [YETKILI_KISI], [VERGI_DAIRESI_ID],
          [VERGI_KIMLIK_NO], [BABA_ADI], [ADRES], [POSTA_KODU_ID], [ILCE_ID], [IL_ID],
          [TELEFON], [UYRUK_ID], [ULKE_ID], [HUKUKI_YAPI_ID], [VEKIL_TURU], [VEKIL_KISILIK_TIPI],
          [VEKIL_ADI], [VEKIL_KIMLIK_NO], [PASAPORT_NO], [ALIS_ISTATISTIK_ID], [SATIS_ISTATISTIK_ID],
          [ARBITRAJ_ALIS_ISTATISTIK_ID], [ARBITRAJ_SATIS_ISTATISTIK_ID], [EPOSTA], [BANKA_HESABI_ID],
          [ANNE_ADI], [KIMLIK_SERI_NO], [DOGUM_TARIHI], [DOGUM_YERI], [KARA_LISTEDE],
          [SEKTOR_ID], [MESLEK_ID], [KIMLIK_GECERLILIK_TARIHI], [FAALIYET_BELGESI_ALINDI],
          [VERGI_LEVHASI_ALINDI], [IMZA_SIRKULERI_ALINDI], [IMZA_SIRKU_GECERLILIK_TARIHI],
          [YETKILI_KIMLIK_NO], [YETKILI_KMLK_GECERLIK_TARIH], [FILTRE], [CARI_BAKIYE_SINIRI],
          [SIRKET_TURU], [KIMLIK_BELGE_TURU], [DERNEK_AMACI], [YETKILI_KISI_ID],
          [FAVORI_PARA_ID], [WHATSAPP_ADI], [E_FATURA_POSTA_KUTUSU], [E_IRSALIYE_POSTA_KUTUSU]
        FROM [dbo].[TODVZ_CARI_KART]
        ORDER BY [CARI_KART_ID] ASC;
      `;
            const result = await pool.request().query(query);
            return result.recordset.map(CariSqlRepository.mapEntityToModel);
        }
        catch (error) {
            logger.error("CariSqlRepository.findAll error:", error);
            throw error;
        }
    }
    static async findById(id, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            request.input("id", sql.Int, parseInt(String(id), 10));
            const query = `
        SELECT TOP 1
          [CARI_KART_ID], [KOD], [AD], [KISILIK_TIPI], [YETKILI_KISI], [VERGI_DAIRESI_ID],
          [VERGI_KIMLIK_NO], [BABA_ADI], [ADRES], [POSTA_KODU_ID], [ILCE_ID], [IL_ID],
          [TELEFON], [UYRUK_ID], [ULKE_ID], [HUKUKI_YAPI_ID], [VEKIL_TURU], [VEKIL_KISILIK_TIPI],
          [VEKIL_ADI], [VEKIL_KIMLIK_NO], [PASAPORT_NO], [ALIS_ISTATISTIK_ID], [SATIS_ISTATISTIK_ID],
          [ARBITRAJ_ALIS_ISTATISTIK_ID], [ARBITRAJ_SATIS_ISTATISTIK_ID], [EPOSTA], [BANKA_HESABI_ID],
          [ANNE_ADI], [KIMLIK_SERI_NO], [DOGUM_TARIHI], [DOGUM_YERI], [KARA_LISTEDE],
          [SEKTOR_ID], [MESLEK_ID], [KIMLIK_GECERLILIK_TARIHI], [FAALIYET_BELGESI_ALINDI],
          [VERGI_LEVHASI_ALINDI], [IMZA_SIRKULERI_ALINDI], [IMZA_SIRKU_GECERLILIK_TARIHI],
          [YETKILI_KIMLIK_NO], [YETKILI_KMLK_GECERLIK_TARIH], [FILTRE], [CARI_BAKIYE_SINIRI],
          [SIRKET_TURU], [KIMLIK_BELGE_TURU], [DERNEK_AMACI], [YETKILI_KISI_ID],
          [FAVORI_PARA_ID], [WHATSAPP_ADI], [E_FATURA_POSTA_KUTUSU], [E_IRSALIYE_POSTA_KUTUSU]
        FROM [dbo].[TODVZ_CARI_KART]
        WHERE [CARI_KART_ID] = @id;
      `;
            const result = await request.query(query);
            if (!result.recordset || result.recordset.length === 0)
                return null;
            return CariSqlRepository.mapEntityToModel(result.recordset[0]);
        }
        catch (error) {
            logger.error(`CariSqlRepository.findById(${id}) error:`, error);
            throw error;
        }
    }
    static async findByCode(kod, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            request.input("kod", sql.Char(20), (kod || "").trim());
            const query = `
        SELECT TOP 1
          [CARI_KART_ID], [KOD], [AD], [KISILIK_TIPI], [YETKILI_KISI], [VERGI_DAIRESI_ID],
          [VERGI_KIMLIK_NO], [BABA_ADI], [ADRES], [POSTA_KODU_ID], [ILCE_ID], [IL_ID],
          [TELEFON], [UYRUK_ID], [ULKE_ID], [HUKUKI_YAPI_ID], [VEKIL_TURU], [VEKIL_KISILIK_TIPI],
          [VEKIL_ADI], [VEKIL_KIMLIK_NO], [PASAPORT_NO], [ALIS_ISTATISTIK_ID], [SATIS_ISTATISTIK_ID],
          [ARBITRAJ_ALIS_ISTATISTIK_ID], [ARBITRAJ_SATIS_ISTATISTIK_ID], [EPOSTA], [BANKA_HESABI_ID],
          [ANNE_ADI], [KIMLIK_SERI_NO], [DOGUM_TARIHI], [DOGUM_YERI], [KARA_LISTEDE],
          [SEKTOR_ID], [MESLEK_ID], [KIMLIK_GECERLILIK_TARIHI], [FAALIYET_BELGESI_ALINDI],
          [VERGI_LEVHASI_ALINDI], [IMZA_SIRKULERI_ALINDI], [IMZA_SIRKU_GECERLILIK_TARIHI],
          [YETKILI_KIMLIK_NO], [YETKILI_KMLK_GECERLIK_TARIH], [FILTRE], [CARI_BAKIYE_SINIRI],
          [SIRKET_TURU], [KIMLIK_BELGE_TURU], [DERNEK_AMACI], [YETKILI_KISI_ID],
          [FAVORI_PARA_ID], [WHATSAPP_ADI], [E_FATURA_POSTA_KUTUSU], [E_IRSALIYE_POSTA_KUTUSU]
        FROM [dbo].[TODVZ_CARI_KART]
        WHERE UPPER(LTRIM(RTRIM([KOD]))) = UPPER(@kod);
      `;
            const result = await request.query(query);
            if (!result.recordset || result.recordset.length === 0)
                return null;
            return CariSqlRepository.mapEntityToModel(result.recordset[0]);
        }
        catch (error) {
            logger.error(`CariSqlRepository.findByCode(${kod}) error:`, error);
            throw error;
        }
    }
    static async getLookups(dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const [tabloMaddeleri, ulkeler, paralar, istatistikler] = await Promise.all([
                pool.request().query("SELECT TABLO_MADDESI_ID as id, TUR as tur, AD as ad, KOD as kod FROM [dbo].[TODVZ_TABLO_MADDESI] ORDER BY AD"),
                pool.request().query("SELECT ULKE_ID as id, AD as ad, KOD as kod FROM [dbo].[TODVZ_ULKE] ORDER BY AD"),
                pool.request().query("SELECT PARA_ID as id, KOD as kod, AD as ad FROM [dbo].[TODVZ_PARA] ORDER BY SIRA_NO ASC, KOD ASC"),
                pool.request().query("SELECT ISTATISTIK_ID as id, KOD as kod, ACIKLAMA as ad, FIS_TIPI as fisTipi FROM [dbo].[TODVZ_ISTATISTIK] ORDER BY KOD ASC"),
            ]);
            const items = tabloMaddeleri.recordset || [];
            return {
                vergiDairesiList: items.filter((x) => x.tur === 0),
                ilList: items.filter((x) => x.tur === 3),
                ilceList: items.filter((x) => x.tur === 1),
                postaKoduList: items.filter((x) => x.tur === 8),
                hukukiYapiList: items.filter((x) => x.tur === 5),
                sektorList: items.filter((x) => x.tur === 2),
                meslekList: items.filter((x) => x.tur === 9),
                ulkeList: ulkeler.recordset || [],
                paraList: paralar.recordset || [],
                istatistikList: istatistikler.recordset || [],
            };
        }
        catch (error) {
            logger.error("CariSqlRepository.getLookups error:", error);
            return {
                vergiDairesiList: [],
                ilList: [],
                ilceList: [],
                postaKoduList: [],
                hukukiYapiList: [],
                sektorList: [],
                meslekList: [],
                ulkeList: [],
                paraList: [],
                istatistikList: [],
            };
        }
    }
    static async sanitizeFkIds(data, pool) {
        const copy = { ...data };
        // 1. Check TABLO_MADDESI ids
        const tmIdsToCheck = [
            copy.vergiDairesiId,
            copy.postaKoduId,
            copy.ilceId,
            copy.ilId,
            copy.hukukiYapiId,
            copy.sektorId,
            copy.meslekId,
        ].filter((id) => id !== null && id !== undefined);
        if (tmIdsToCheck.length > 0) {
            const res = await pool.request().query(`
        SELECT [TABLO_MADDESI_ID] FROM [dbo].[TODVZ_TABLO_MADDESI] WHERE [TABLO_MADDESI_ID] IN (${tmIdsToCheck.join(",")})
      `);
            const validTmIds = new Set(res.recordset.map((r) => r.TABLO_MADDESI_ID));
            if (copy.vergiDairesiId && !validTmIds.has(Number(copy.vergiDairesiId)))
                copy.vergiDairesiId = null;
            if (copy.postaKoduId && !validTmIds.has(Number(copy.postaKoduId)))
                copy.postaKoduId = null;
            if (copy.ilceId && !validTmIds.has(Number(copy.ilceId)))
                copy.ilceId = null;
            if (copy.ilId && !validTmIds.has(Number(copy.ilId)))
                copy.ilId = null;
            if (copy.hukukiYapiId && !validTmIds.has(Number(copy.hukukiYapiId)))
                copy.hukukiYapiId = null;
            if (copy.sektorId && !validTmIds.has(Number(copy.sektorId)))
                copy.sektorId = null;
            if (copy.meslekId && !validTmIds.has(Number(copy.meslekId)))
                copy.meslekId = null;
        }
        // 2. Check ULKE ids
        const ulkeIdsToCheck = [copy.ulkeId, copy.uyrukId].filter((id) => id !== null && id !== undefined);
        if (ulkeIdsToCheck.length > 0) {
            const res = await pool.request().query(`
        SELECT [ULKE_ID] FROM [dbo].[TODVZ_ULKE] WHERE [ULKE_ID] IN (${ulkeIdsToCheck.join(",")})
      `);
            const validUlkeIds = new Set(res.recordset.map((r) => r.ULKE_ID));
            if (copy.ulkeId && !validUlkeIds.has(Number(copy.ulkeId)))
                copy.ulkeId = null;
            if (copy.uyrukId && !validUlkeIds.has(Number(copy.uyrukId)))
                copy.uyrukId = null;
        }
        // 3. Check PARA id
        if (copy.favoriParaId) {
            const res = await pool.request().query(`
        SELECT [PARA_ID] FROM [dbo].[TODVZ_PARA] WHERE [PARA_ID] = ${Number(copy.favoriParaId)}
      `);
            if (res.recordset.length === 0)
                copy.favoriParaId = null;
        }
        // 4. Check CARI_KART ids (for bankaHesabiId and yetkiliKisiId)
        const cariIdsToCheck = [copy.bankaHesabiId, copy.yetkiliKisiId].filter((id) => id !== null && id !== undefined);
        if (cariIdsToCheck.length > 0) {
            const res = await pool.request().query(`
        SELECT [CARI_KART_ID] FROM [dbo].[TODVZ_CARI_KART] WHERE [CARI_KART_ID] IN (${cariIdsToCheck.join(",")})
      `);
            const validCariIds = new Set(res.recordset.map((r) => r.CARI_KART_ID));
            if (copy.bankaHesabiId && !validCariIds.has(Number(copy.bankaHesabiId)))
                copy.bankaHesabiId = null;
            if (copy.yetkiliKisiId && !validCariIds.has(Number(copy.yetkiliKisiId)))
                copy.yetkiliKisiId = null;
        }
        // 5. Check ISTATISTIK ids
        const istIdsToCheck = [
            copy.alisIstatistikId,
            copy.satisIstatistikId,
            copy.arbitrajAlisIstatistikId,
            copy.arbitrajSatisIstatistikId,
        ].filter((id) => id !== null && id !== undefined);
        if (istIdsToCheck.length > 0) {
            const res = await pool.request().query(`
        SELECT [ISTATISTIK_ID] FROM [dbo].[TODVZ_ISTATISTIK] WHERE [ISTATISTIK_ID] IN (${istIdsToCheck.join(",")})
      `);
            const validIstIds = new Set(res.recordset.map((r) => r.ISTATISTIK_ID));
            if (copy.alisIstatistikId && !validIstIds.has(Number(copy.alisIstatistikId)))
                copy.alisIstatistikId = null;
            if (copy.satisIstatistikId && !validIstIds.has(Number(copy.satisIstatistikId)))
                copy.satisIstatistikId = null;
            if (copy.arbitrajAlisIstatistikId && !validIstIds.has(Number(copy.arbitrajAlisIstatistikId)))
                copy.arbitrajAlisIstatistikId = null;
            if (copy.arbitrajSatisIstatistikId && !validIstIds.has(Number(copy.arbitrajSatisIstatistikId)))
                copy.arbitrajSatisIstatistikId = null;
        }
        return copy;
    }
    static bindInputs(request, data) {
        const trimmedKod = (data.kod || "").trim().slice(0, 20);
        request.input("KOD", sql.VarChar(20), trimmedKod.length > 0 ? trimmedKod : null);
        request.input("AD", sql.VarChar(200), (data.ad || "").trim().slice(0, 200));
        request.input("KISILIK_TIPI", sql.TinyInt, toInt(data.kisilikTipi) ?? 1);
        request.input("YETKILI_KISI", sql.VarChar(200), data.yetkiliKisi ? data.yetkiliKisi.trim().slice(0, 200) : null);
        request.input("VERGI_DAIRESI_ID", sql.Int, toInt(data.vergiDairesiId));
        request.input("VERGI_KIMLIK_NO", sql.VarChar(20), data.vergiKimlikNo ? data.vergiKimlikNo.trim().slice(0, 20) : null);
        request.input("BABA_ADI", sql.VarChar(200), data.babaAdi ? data.babaAdi.trim().slice(0, 200) : null);
        request.input("ADRES", sql.VarChar(100), data.adres ? data.adres.trim().slice(0, 100) : null);
        request.input("POSTA_KODU_ID", sql.Int, toInt(data.postaKoduId));
        request.input("ILCE_ID", sql.Int, toInt(data.ilceId));
        request.input("IL_ID", sql.Int, toInt(data.ilId));
        request.input("TELEFON", sql.VarChar(20), data.telefon ? data.telefon.trim().slice(0, 20) : null);
        request.input("UYRUK_ID", sql.Int, toInt(data.uyrukId));
        request.input("ULKE_ID", sql.Int, toInt(data.ulkeId));
        request.input("HUKUKI_YAPI_ID", sql.Int, toInt(data.hukukiYapiId));
        request.input("PASAPORT_NO", sql.VarChar(20), data.pasaportNo ? data.pasaportNo.trim().slice(0, 20) : null);
        request.input("EPOSTA", sql.VarChar(100), data.eposta ? data.eposta.trim().slice(0, 100) : null);
        request.input("KIMLIK_GECERLILIK_TARIHI", sql.DateTime, toDateOrNull(data.kimlikGecerlilikTarihi));
        request.input("ANNE_ADI", sql.VarChar(200), data.anneAdi ? data.anneAdi.trim().slice(0, 200) : null);
        request.input("KIMLIK_SERI_NO", sql.VarChar(20), data.kimlikSeriNo ? data.kimlikSeriNo.trim().slice(0, 20) : null);
        request.input("DOGUM_TARIHI", sql.DateTime, toDateOrNull(data.dogumTarihi));
        request.input("DOGUM_YERI", sql.VarChar(100), data.dogumYeri ? data.dogumYeri.trim().slice(0, 100) : null);
        request.input("MESLEK_ID", sql.Int, toInt(data.meslekId));
        request.input("KARA_LISTEDE", sql.Bit, data.karaListede ? 1 : 0);
        request.input("SEKTOR_ID", sql.Int, toInt(data.sektorId));
        request.input("VEKIL_TURU", sql.TinyInt, toInt(data.vekilTuru));
        request.input("VEKIL_KISILIK_TIPI", sql.TinyInt, toInt(data.vekilKisilikTipi));
        request.input("VEKIL_ADI", sql.VarChar(200), data.vekilAdi ? data.vekilAdi.trim().slice(0, 200) : null);
        request.input("VEKIL_KIMLIK_NO", sql.VarChar(20), data.vekilKimlikNo ? data.vekilKimlikNo.trim().slice(0, 20) : null);
        request.input("BANKA_HESABI_ID", sql.Int, toInt(data.bankaHesabiId));
        request.input("FAALIYET_BELGESI_ALINDI", sql.Bit, data.faaliyetBelgesiAlindi ? 1 : 0);
        request.input("VERGI_LEVHASI_ALINDI", sql.Bit, data.vergiLevhasiAlindi ? 1 : 0);
        request.input("IMZA_SIRKULERI_ALINDI", sql.Bit, data.imzaSirkuleriAlindi ? 1 : 0);
        request.input("IMZA_SIRKU_GECERLILIK_TARIHI", sql.DateTime, toDateOrNull(data.imzaSirkuGecerlilikTarihi));
        request.input("YETKILI_KIMLIK_NO", sql.VarChar(20), data.yetkiliKimlikNo ? data.yetkiliKimlikNo.trim().slice(0, 20) : null);
        request.input("YETKILI_KMLK_GECERLIK_TARIH", sql.DateTime, toDateOrNull(data.yetkiliKmlkGecerlikTarih));
        request.input("ALIS_ISTATISTIK_ID", sql.Int, toInt(data.alisIstatistikId));
        request.input("SATIS_ISTATISTIK_ID", sql.Int, toInt(data.satisIstatistikId));
        request.input("ARBITRAJ_ALIS_ISTATISTIK_ID", sql.Int, toInt(data.arbitrajAlisIstatistikId));
        request.input("ARBITRAJ_SATIS_ISTATISTIK_ID", sql.Int, toInt(data.arbitrajSatisIstatistikId));
        request.input("FILTRE", sql.VarChar(200), data.filtre ? data.filtre.trim().slice(0, 200) : null);
        request.input("CARI_BAKIYE_SINIRI", sql.Float, toFloat(data.cariBakiyeSiniri) ?? 0.0);
        request.input("SIRKET_TURU", sql.TinyInt, toInt(data.sirketTuru));
        request.input("YETKILI_KISI_ID", sql.Int, toInt(data.yetkiliKisiId));
        request.input("KIMLIK_BELGE_TURU", sql.TinyInt, toInt(data.kimlikBelgeTuru));
        request.input("DERNEK_AMACI", sql.VarChar(200), data.dernekAmaci ? data.dernekAmaci.trim().slice(0, 200) : null);
        request.input("FAVORI_PARA_ID", sql.Int, toInt(data.favoriParaId));
        request.input("WHATSAPP_ADI", sql.VarChar(100), data.whatsappAdi ? data.whatsappAdi.trim().slice(0, 100) : null);
        request.input("E_FATURA_POSTA_KUTUSU", sql.VarChar(200), data.eFaturaPostaKutusu ? data.eFaturaPostaKutusu.trim().slice(0, 200) : null);
        request.input("E_IRSALIYE_POSTA_KUTUSU", sql.VarChar(200), data.eIrsaliyePostaKutusu ? data.eIrsaliyePostaKutusu.trim().slice(0, 200) : null);
    }
    static async saveViaProcedure(data, cariKartId, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const sanitized = await CariSqlRepository.sanitizeFkIds(data, pool);
            const request = pool.request();
            const idNum = cariKartId != null && !isNaN(Number(cariKartId)) ? Number(cariKartId) : null;
            request.input("CARI_KART_ID", sql.Int, idNum);
            CariSqlRepository.bindInputs(request, sanitized);
            logger.info(`[SODVZ_CARI_KART_KAYDET] Çağrılıyor: CARI_KART_ID=${idNum ?? "NULL (INSERT)"}, KOD='${(sanitized.kod || "").trim()}', AD='${(sanitized.ad || "").trim()}'`);
            const execQuery = `
        DECLARE @OUT_ID INT = @CARI_KART_ID;
        EXEC [dbo].[SODVZ_CARI_KART_KAYDET]
          @CARI_KART_ID = @OUT_ID OUTPUT,
          @KOD = @KOD,
          @AD = @AD,
          @KISILIK_TIPI = @KISILIK_TIPI,
          @YETKILI_KISI = @YETKILI_KISI,
          @VERGI_DAIRESI_ID = @VERGI_DAIRESI_ID,
          @VERGI_KIMLIK_NO = @VERGI_KIMLIK_NO,
          @BABA_ADI = @BABA_ADI,
          @ADRES = @ADRES,
          @POSTA_KODU_ID = @POSTA_KODU_ID,
          @ILCE_ID = @ILCE_ID,
          @IL_ID = @IL_ID,
          @TELEFON = @TELEFON,
          @UYRUK_ID = @UYRUK_ID,
          @ULKE_ID = @ULKE_ID,
          @HUKUKI_YAPI_ID = @HUKUKI_YAPI_ID,
          @PASAPORT_NO = @PASAPORT_NO,
          @EPOSTA = @EPOSTA,
          @KIMLIK_GECERLILIK_TARIHI = @KIMLIK_GECERLILIK_TARIHI,
          @ANNE_ADI = @ANNE_ADI,
          @KIMLIK_SERI_NO = @KIMLIK_SERI_NO,
          @DOGUM_TARIHI = @DOGUM_TARIHI,
          @DOGUM_YERI = @DOGUM_YERI,
          @MESLEK_ID = @MESLEK_ID,
          @KARA_LISTEDE = @KARA_LISTEDE,
          @SEKTOR_ID = @SEKTOR_ID,
          @VEKIL_TURU = @VEKIL_TURU,
          @VEKIL_KISILIK_TIPI = @VEKIL_KISILIK_TIPI,
          @VEKIL_ADI = @VEKIL_ADI,
          @VEKIL_KIMLIK_NO = @VEKIL_KIMLIK_NO,
          @BANKA_HESABI_ID = @BANKA_HESABI_ID,
          @FAALIYET_BELGESI_ALINDI = @FAALIYET_BELGESI_ALINDI,
          @VERGI_LEVHASI_ALINDI = @VERGI_LEVHASI_ALINDI,
          @IMZA_SIRKULERI_ALINDI = @IMZA_SIRKULERI_ALINDI,
          @IMZA_SIRKU_GECERLILIK_TARIHI = @IMZA_SIRKU_GECERLILIK_TARIHI,
          @YETKILI_KIMLIK_NO = @YETKILI_KIMLIK_NO,
          @YETKILI_KMLK_GECERLIK_TARIH = @YETKILI_KMLK_GECERLIK_TARIH,
          @ALIS_ISTATISTIK_ID = @ALIS_ISTATISTIK_ID,
          @SATIS_ISTATISTIK_ID = @SATIS_ISTATISTIK_ID,
          @ARBITRAJ_ALIS_ISTATISTIK_ID = @ARBITRAJ_ALIS_ISTATISTIK_ID,
          @ARBITRAJ_SATIS_ISTATISTIK_ID = @ARBITRAJ_SATIS_ISTATISTIK_ID,
          @FILTRE = @FILTRE,
          @CARI_BAKIYE_SINIRI = @CARI_BAKIYE_SINIRI,
          @SIRKET_TURU = @SIRKET_TURU,
          @YETKILI_KISI_ID = @YETKILI_KISI_ID,
          @KIMLIK_BELGE_TURU = @KIMLIK_BELGE_TURU,
          @DERNEK_AMACI = @DERNEK_AMACI,
          @FAVORI_PARA_ID = @FAVORI_PARA_ID,
          @WHATSAPP_ADI = @WHATSAPP_ADI,
          @E_FATURA_POSTA_KUTUSU = @E_FATURA_POSTA_KUTUSU,
          @E_IRSALIYE_POSTA_KUTUSU = @E_IRSALIYE_POSTA_KUTUSU;
        SELECT @OUT_ID AS [CARI_KART_ID];
      `;
            const result = await request.query(execQuery);
            const savedId = result.recordset?.[0]?.CARI_KART_ID || idNum;
            if (!savedId) {
                throw ApiError.internal("Cari kart kaydedildi fakat kimlik bilgisi alınamadı.");
            }
            const saved = await CariSqlRepository.findById(savedId, dbContext);
            if (!saved) {
                throw ApiError.internal("Cari kart kaydedildi fakat güncel veri okunamadı.");
            }
            return saved;
        }
        catch (error) {
            logger.error(`CariSqlRepository.saveViaProcedure(${cariKartId ?? "new"}) error:`, error);
            const msg = error?.message || "Cari kart kaydedilemedi.";
            throw ApiError.badRequest(msg);
        }
    }
    static async deleteViaProcedure(id, dbContext) {
        try {
            const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
            const request = pool.request();
            const idNum = parseInt(String(id), 10);
            request.input("CARI_KART_ID", sql.Int, idNum);
            logger.info(`[SODVZ_CARI_KART_SIL] Çağrılıyor: CARI_KART_ID=${idNum}`);
            const execQuery = `
        EXEC [dbo].[SODVZ_CARI_KART_SIL] @CARI_KART_ID = @CARI_KART_ID;
      `;
            await request.query(execQuery);
            return true;
        }
        catch (error) {
            logger.error(`CariSqlRepository.deleteViaProcedure(${id}) error:`, error);
            const msg = error?.message || "Cari kart silinemedi.";
            throw ApiError.badRequest(msg);
        }
    }
    static async create(data, dbContext) {
        return CariSqlRepository.saveViaProcedure(data, null, dbContext);
    }
    static async update(id, data, dbContext) {
        return CariSqlRepository.saveViaProcedure(data, id, dbContext);
    }
    static async delete(id, dbContext) {
        return CariSqlRepository.deleteViaProcedure(id, dbContext);
    }
}

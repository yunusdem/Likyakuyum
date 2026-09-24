import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";

export interface SarrafFisSatiriDto {
  satirId?: number | null;
  satirNo: number;
  urunId: number;
  miktar: number;
  milyem: number;
  hasGram: number;
  adet: number;
  iscilikiMiktari: number;
  iscilikHasGram: number;
  aciklama?: string | null;
  iscilikHesaplamaSekli?: number | null;
  kur: number;
  tutar: number;
  urunTipi: number;
  urunOgesiParaId?: number | null;
  karat?: number | null;
}

export interface OdemeSatiriDto {
  satirNo: number;
  islemeYeri: number;
  odemeAraciTuru: number;
  paraId?: number | null;
  posCihaziId?: number | null;
  miktar: number;
  milyem: number;
  hasGram: number;
  kur: number;
  tutar: number;
  degistirildi?: boolean;
}

export interface SaveSarrafFisDto {
  sarrafFisiId?: number | null;
  vezneId: number;
  cariKartId?: number | null;
  tarih: string;
  saat?: string | null;
  fisNo?: string | null;
  seriNo?: string | null;
  seri?: string | null;
  belgeNo?: string | null;
  tip: number;
  altinHasKuru: number;
  kdvOrani?: number | null;
  kdv?: number | null;
  eFaturaPosta?: string | null;
  eIrsaliyePosta?: string | null;
  irsaliyeNo?: string | null;
  irsaliyeZamani?: string | null;
  kisilikTipi?: number | null;
  uyrukId?: number | null;
  ulkeId?: number | null;
  pasaportNo?: string | null;
  hukukiYapiId?: number | null;
  vergiDairesiId?: number | null;
  vergiKimlikNo?: string | null;
  babaAdi?: string | null;
  adres?: string | null;
  ilceId?: number | null;
  postaKoduId?: number | null;
  ilId?: number | null;
  vekilTuru?: number | null;
  vekilKisilikTipi?: number | null;
  vekilAdi?: string | null;
  vekilKimlikNo?: string | null;
  eposta?: string | null;
  telefonNo?: string | null;
  meslekId?: number | null;
  dogumTarihi?: string | null;
  dogumYeri?: string | null;
  kimlikSeriNo?: string | null;
  anneAdi?: string | null;
  masakListesindeVar?: boolean;
  supheliIslemlerYetkiliId?: number | null;
  yetkiliKisiId?: number | null;
  sirketTuru?: number | null;
  kimlikGecerlilikTarihi?: string | null;
  kimlikBelgeTuru?: number | null;
  dernekAmaci?: string | null;
  yetkiliKisi?: string | null;
  belgeTuru?: number;
  soforId?: number | null;
  unvan?: string | null;
  favoriParaId?: number | null;
  alisKuru?: number;
  satisKuru?: number;
  gumusHasKuru?: number;
  kullaniciId: number;
  guid?: string | null;
  degisiklikTakipVar?: boolean;
  yazdirilanBelgeTipi?: number | null;
  satirlar: SarrafFisSatiriDto[];
  odemeSatirlari: OdemeSatiriDto[];
}

export interface SaveSarrafFisDetayDto {
  sarrafFisiId: number;
  unvan?: string | null;
  kisilikTipi?: number | null;
  uyrukId?: number | null;
  ulkeId?: number | null;
  pasaportNo?: string | null;
  hukukiYapiId?: number | null;
  vergiDairesiId?: number | null;
  vergiKimlikNo?: string | null;
  babaAdi?: string | null;
  adres?: string | null;
  ilceId?: number | null;
  postaKoduId?: number | null;
  ilId?: number | null;
  vekilTuru?: number | null;
  vekilKisilikTipi?: number | null;
  vekilAdi?: string | null;
  vekilKimlikNo?: string | null;
  eposta?: string | null;
  telefonNo?: string | null;
  meslekId?: number | null;
  dogumTarihi?: string | null;
  dogumYeri?: string | null;
  kimlikSeriNo?: string | null;
  anneAdi?: string | null;
  sirketTuru?: number | null;
  kimlikBelgeTuru?: number | null;
  dernekAmaci?: string | null;
  yetkiliKisiId?: number | null;
  kimlikGecerlilikTarihi?: string | null;
  kullaniciId: number;
}

export interface SarrafFisListItem {
  sarrafFisiId: number;
  fisNo: string;
  tarih: string;
  tip: number;
  tipLabel: string;
  unvan: string;
  altinHasKuru: number;
  vezneId: number;
  vezneKod?: string;
  eklemeZamani?: string;
}

export interface VezneBakiyeItem {
  paraId: number;
  paraKodu: string;
  miktar: number;
}

export interface UrunItem {
  paraId: number;
  id?: number;
  kod: string;
  ad: string;
  gramaj?: number;
  hasOrani?: number;
  alisMilyem?: number;
  satisMilyem?: number;
  iscilik?: number;
  birim?: number;
  urunTipi?: number;
}

export class SarrafFisSqlRepository {
  public static async getUserVezneId(kullaniciId: number, dbContext?: { dbServer?: string; dbName?: string }): Promise<number | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const result = await pool
        .request()
        .input("kullaniciId", sql.Int, kullaniciId)
        .query("SELECT VEZNE_ID FROM [dbo].[TODVZ_KULLANICI] WHERE KULLANICI_ID = @kullaniciId");
      if (result.recordset && result.recordset.length > 0) {
        return result.recordset[0].VEZNE_ID ?? null;
      }
      return null;
    } catch (err) {
      logger.warn("getUserVezneId error:", err);
      return null;
    }
  }

  public static async getUrunler(dbContext?: { dbServer?: string; dbName?: string }): Promise<UrunItem[]> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const result = await pool.request().query(`
        SELECT PARA_ID AS paraId, RTRIM(KOD) AS kod, AD AS ad,
               ISNULL(GRAMAJ,0) AS gramaj, ISNULL(HAS_ORANI,0) AS hasOrani,
               ISNULL(HAS_ALIS_KATSAYISI,0) AS hasAlisKatsayisi,
               ISNULL(HAS_SATIS_KATSAYISI,0) AS hasSatisKatsayisi,
               ISNULL(ISCILIK,0) AS iscilik, ISNULL(BIRIM,0) AS birim,
               ISNULL(URUN_TIPI,0) AS urunTipi
        FROM [dbo].[TODVZ_PARA] WITH (NOLOCK)
        ORDER BY PARA_ID ASC
      `);
      return (result.recordset || []).map((r: any) => ({
        paraId: Number(r.paraId),
        id: Number(r.paraId),
        kod: (r.kod || "").trim(),
        ad: (r.ad || "").trim(),
        gramaj: Number(r.gramaj) || 0,
        hasOrani: Number(r.hasOrani) || 0,
        alisMilyem: Number(r.hasAlisKatsayisi) > 0 ? Number(r.hasAlisKatsayisi) : (Number(r.hasOrani) || 0),
        satisMilyem: Number(r.hasSatisKatsayisi) > 0 ? Number(r.hasSatisKatsayisi) : (Number(r.hasOrani) || 0),
        iscilik: Number(r.iscilik) || 0,
        birim: Number(r.birim) || 0,
        urunTipi: Number(r.urunTipi) || 0,
      }));
    } catch (err) {
      logger.error("getUrunler error:", err);
      return [];
    }
  }

  public static async getVezneBakiye(vezneId: number, dbContext?: { dbServer?: string; dbName?: string }): Promise<VezneBakiyeItem[]> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const result = await pool.request()
        .input("vezneId", sql.Int, vezneId)
        .query(`
          SELECT B.PARA_ID AS paraId, RTRIM(P.KOD) AS paraKodu, B.MIKTAR AS miktar
          FROM [dbo].[TODVZ_VEZNE_BAKIYE] B WITH (NOLOCK)
            INNER JOIN [dbo].[TODVZ_PARA] P WITH (NOLOCK) ON P.PARA_ID = B.PARA_ID
          WHERE B.VEZNE_ID = @vezneId ORDER BY P.SIRA_NO
        `);
      return (result.recordset||[]).map((r: any) => ({
        paraId: Number(r.paraId), paraKodu: (r.paraKodu||"").trim(), miktar: Number(r.miktar)||0,
      }));
    } catch (err) {
      logger.warn("getVezneBakiye error:", err);
      return [];
    }
  }

  public static async getFisList(filters: { search?: string; tip?: number; vezneId?: number; limit?: number }, dbContext?: { dbServer?: string; dbName?: string }): Promise<SarrafFisListItem[]> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      let query = `
        SELECT TOP (@limit)
          SF.SARRAF_FISI_ID AS sarrafFisiId, ISNULL(RTRIM(SF.FIS_NO),'') AS fisNo,
          CONVERT(varchar(10),SF.TARIH,120) AS tarih, SF.TIP AS tip,
          CASE SF.TIP WHEN 0 THEN N'Alış' ELSE N'Satış' END AS tipLabel,
          ISNULL(SF.UNVAN,N'İsim beyan edilmemiştir') AS unvan,
          SF.ALTIN_HAS_KURU AS altinHasKuru, SF.VEZNE_ID AS vezneId,
          ISNULL(RTRIM(V.KOD),'') AS vezneKod, SF.EKLEME_ZAMANI AS eklemeZamani
        FROM [dbo].[TODVZ_SARRAF_FISI] SF WITH (NOLOCK)
          LEFT JOIN [dbo].[TODVZ_VEZNE] V WITH (NOLOCK) ON V.VEZNE_ID = SF.VEZNE_ID
        WHERE 1=1`;
      const req = pool.request().input("limit", sql.Int, filters.limit||200);
      if (filters.vezneId && filters.vezneId > 0) { query += " AND SF.VEZNE_ID = @vezneId"; req.input("vezneId", sql.Int, filters.vezneId); }
      if (filters.tip !== undefined && filters.tip !== null) { query += " AND SF.TIP = @tip"; req.input("tip", sql.TinyInt, filters.tip); }
      if (filters.search) { query += " AND (SF.FIS_NO LIKE @search OR SF.UNVAN LIKE @search)"; req.input("search", sql.VarChar(200), `%${filters.search}%`); }
      query += " ORDER BY SF.TARIH DESC, SF.SARRAF_FISI_ID DESC";
      const result = await req.query(query);
      return (result.recordset||[]).map((r: any) => ({
        sarrafFisiId: r.sarrafFisiId, fisNo: (r.fisNo||"").trim(), tarih: r.tarih||"",
        tip: r.tip, tipLabel: r.tipLabel||"", unvan: r.unvan||"",
        altinHasKuru: Number(r.altinHasKuru)||0, vezneId: r.vezneId,
        vezneKod: (r.vezneKod||"").trim(), eklemeZamani: r.eklemeZamani ? String(r.eklemeZamani) : undefined,
      }));
    } catch (err) {
      logger.error("getFisList error:", err);
      return [];
    }
  }

  public static async getFisById(sarrafFisiId: number, dbContext?: { dbServer?: string; dbName?: string }): Promise<any | null> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const h = (await pool.request().input("id", sql.Int, sarrafFisiId)
        .query("SELECT * FROM [dbo].[TODVZ_SARRAF_FISI] WITH (NOLOCK) WHERE SARRAF_FISI_ID = @id")).recordset[0];
      if (!h) return null;
      const satirlar = (await pool.request().input("id2", sql.Int, sarrafFisiId)
        .query(`SELECT SFS.*, ISNULL(RTRIM(P.KOD),'') AS URUN_KODU, ISNULL(P.AD,'') AS URUN_ADI, ISNULL(P.HAS_ORANI, 0) AS PARA_HAS_ORANI
                FROM [dbo].[TODVZ_SARRAF_FISI_SATIRI] SFS WITH (NOLOCK)
                  LEFT JOIN [dbo].[TODVZ_PARA] P WITH (NOLOCK) ON P.PARA_ID = SFS.URUN_ID
                WHERE SFS.SARRAF_FISI_ID = @id2 ORDER BY SFS.SATIR_NO`)).recordset;
      const odemeler = (await pool.request().input("id3", sql.Int, sarrafFisiId)
        .query(`SELECT OS.*, ISNULL(RTRIM(P.KOD),'') AS PARA_KODU, ISNULL(P.HAS_ORANI, 0) AS PARA_HAS_ORANI
                FROM [dbo].[TODVZ_ODEME_SATIRI] OS WITH (NOLOCK)
                  LEFT JOIN [dbo].[TODVZ_PARA] P WITH (NOLOCK) ON P.PARA_ID = OS.PARA_ID
                WHERE OS.SARRAF_FISI_ID = @id3 ORDER BY OS.SATIR_NO`)).recordset;
      const rawFisNo = (h.FIS_NO || "").trim();
      const rawIrsaliyeNo = (h.IRSALIYE_NO || "").trim();
      const seriNo = rawFisNo;
      const belgeNo = rawIrsaliyeNo;

      return {
        sarrafFisiId: h.SARRAF_FISI_ID,
        fisNo: rawFisNo,
        seriNo: seriNo,
        belgeNo: belgeNo,
        tarih: h.TARIH ? h.TARIH.toISOString().split("T")[0] : "",
        saat: h.SAAT ? h.SAAT.toISOString() : null,
        tip: h.TIP, altinHasKuru: Number(h.ALTIN_HAS_KURU)||0,
        alisKuru: Number(h.ALIS_KURU)||0, satisKuru: Number(h.SATIS_KURU)||0,
        gumusHasKuru: Number(h.GUMUS_HAS_KURU)||0, kdvOrani: h.KDV_ORANI??null, kdv: h.KDV??null,
        unvan: h.UNVAN||"", cariKartId: h.CARI_KART_ID??null, vezneId: h.VEZNE_ID??null,
        belgeTuru: h.BELGE_TURU??0, kisilikTipi: h.KISILIK_TIPI??null,
        uyrukId: h.UYRUK_ID??null, ulkeId: h.ULKE_ID??null,
        pasaportNo: h.PASAPORT_NO?(h.PASAPORT_NO as string).trim():null,
        hukukiYapiId: h.HUKUKI_YAPI_ID??null, vergiDairesiId: h.VERGI_DAIRESI_ID??null,
        vergiKimlikNo: h.VERGI_KIMLIK_NO?(h.VERGI_KIMLIK_NO as string).trim():null,
        babaAdi: h.BABA_ADI||null, adres: h.ADRES||null,
        ilceId: h.ILCE_ID??null, postaKoduId: h.POSTA_KODU_ID??null, ilId: h.IL_ID??null,
        vekilTuru: h.VEKIL_TURU??null, vekilKisilikTipi: h.VEKIL_KISILIK_TIPI??null,
        vekilAdi: h.VEKIL_ADI||null, vekilKimlikNo: h.VEKIL_KIMLIK_NO?(h.VEKIL_KIMLIK_NO as string).trim():null,
        eposta: h.EPOSTA||null, telefonNo: h.TELEFON_NO||null, meslekId: h.MESLEK_ID??null,
        dogumTarihi: h.DOGUM_TARIHI?h.DOGUM_TARIHI.toISOString().split("T")[0]:null,
        dogumYeri: h.DOGUM_YERI||null, kimlikSeriNo: h.KIMLIK_SERI_NO?(h.KIMLIK_SERI_NO as string).trim():null,
        anneAdi: h.ANNE_ADI||null, sirketTuru: h.SIRKET_TURU??null,
        kimlikBelgeTuru: h.KIMLIK_BELGE_TURU??null, dernekAmaci: h.DERNEK_AMACI||null,
        yetkiliKisiId: h.YETKILI_KISI_ID??null,
        kimlikGecerlilikTarihi: h.KIMLIK_GECERLILIK_TARIHI?h.KIMLIK_GECERLILIK_TARIHI.toISOString().split("T")[0]:null,
        masakListesindeVar: h.MASAK_LISTESINDE_VAR===true||h.MASAK_LISTESINDE_VAR===1,
        satirlar: satirlar.map((r: any) => {
          const mVal = (r.MILYEM !== null && r.MILYEM !== undefined && Number(r.MILYEM) !== 0)
            ? Number(r.MILYEM)
            : (r.HAS_ORANI !== null && r.HAS_ORANI !== undefined && Number(r.HAS_ORANI) !== 0
                ? Number(r.HAS_ORANI)
                : (r.PARA_HAS_ORANI !== null && r.PARA_HAS_ORANI !== undefined && Number(r.PARA_HAS_ORANI) !== 0
                    ? Number(r.PARA_HAS_ORANI)
                    : (Number(r.MILYEM) || 0)));
          return {
            satirNo: r.SATIR_NO, urunId: r.URUN_ID??0,
            urunKodu: (r.URUN_KODU||"").trim(), urunAdi: r.URUN_ADI||"",
            miktar: Number(r.MIKTAR)||0, milyem: mVal, hasGram: Number(r.HAS_GRAM)||0,
            adet: Number(r.ADET)||0, iscilikiMiktari: Number(r.ISCILIK_MIKTARI)||0,
            iscilikHasGram: Number(r.ISCILIK_HAS_GRAM)||0, aciklama: r.ACIKLAMA||null,
            iscilikHesaplamaSekli: r.ISCILIK_HESAPLAMA_SEKLI??null,
            kur: Number(r.KUR)||0, tutar: Number(r.TUTAR)||0, urunTipi: r.URUN_TIPI??0,
            karat: r.KARAT!=null?Number(r.KARAT):null, sarrafFisiSatiriId: r.SARRAF_FISI_SATIRI_ID,
          };
        }),
        odemeSatirlari: odemeler.map((r: any) => {
          const mVal = (r.MILYEM !== null && r.MILYEM !== undefined && Number(r.MILYEM) !== 0)
            ? Number(r.MILYEM)
            : (r.HAS_ORANI !== null && r.HAS_ORANI !== undefined && Number(r.HAS_ORANI) !== 0
                ? Number(r.HAS_ORANI)
                : (r.PARA_HAS_ORANI !== null && r.PARA_HAS_ORANI !== undefined && Number(r.PARA_HAS_ORANI) !== 0
                    ? Number(r.PARA_HAS_ORANI)
                    : (Number(r.MILYEM) || 0)));
          return {
            satirNo: r.SATIR_NO, islemeYeri: r.ISLEME_YERI, odemeAraciTuru: r.ODEME_ARACI_TURU,
            paraId: r.PARA_ID??null, paraKodu: (r.PARA_KODU||"").trim(),
            miktar: Number(r.MIKTAR)||0, milyem: mVal, hasGram: Number(r.HAS_GRAM)||0,
            kur: Number(r.KUR)||0, tutar: Number(r.TUTAR)||0,
          };
        }),
      };
    } catch (err: any) {
      logger.error("getFisById error:", err);
      throw ApiError.internal("Sarraf fişi yüklenemedi: "+(err?.message||""));
    }
  }

  public static async saveFis(dto: SaveSarrafFisDto, dbContext?: { dbServer?: string; dbName?: string }): Promise<{ sarrafFisiId: number; fisNo: string; seriNo?: string; belgeNo?: string; yeniKayit: boolean }> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    const req = pool.request();

    const safeDate = (val: any): Date | null => {
      if (!val) return null;
      if (val instanceof Date) {
        if (isNaN(val.getTime())) return null;
        const y = val.getFullYear();
        if (y <= 1900 || y > 9999) return null;
        return val;
      }
      const str = String(val).trim();
      if (
        !str ||
        str === "null" ||
        str === "undefined" ||
        str === "NaN" ||
        str === "0" ||
        str === "0000-00-00" ||
        str.startsWith("0001-01-01") ||
        str.startsWith("1899-12-30") ||
        str.startsWith("1900-01-01")
      ) {
        return null;
      }
      const dt = new Date(str);
      if (isNaN(dt.getTime())) return null;
      const y = dt.getFullYear();
      if (y <= 1900 || y > 9999) return null;
      return dt;
    };

    const parseDate = (d: any): Date => {
      const dt = safeDate(d);
      return dt || new Date();
    };

    const rawSeriNo = (dto.seriNo || "").trim();
    const rawBelgeNo = (dto.belgeNo || dto.irsaliyeNo || dto.fisNo || "").trim();

    let effectiveSeriNo: string | null = null;
    if (rawSeriNo && /\d/.test(rawSeriNo)) {
      effectiveSeriNo = rawSeriNo;
    } else {
      effectiveSeriNo = null;
    }

    let effectiveBelgeNo: string | null = null;
    if (rawBelgeNo && rawBelgeNo !== rawSeriNo) {
      effectiveBelgeNo = rawBelgeNo;
    } else {
      effectiveBelgeNo = null;
    }

    let effectiveKdv = dto.kdv != null && !isNaN(Number(dto.kdv)) ? Number(dto.kdv) : null;
    if (effectiveKdv === null) {
      if (dto.kdvOrani != null && Number(dto.kdvOrani) > 0) {
        const totIscilik = (dto.satirlar || []).reduce((s, r) => s + (Number(r.iscilikHasGram) || 0), 0);
        effectiveKdv = (Number(dto.kdvOrani) * (Number(dto.altinHasKuru) || 0) * totIscilik) / 100;
      } else {
        effectiveKdv = 0;
      }
    }

    req.input("IN_SARRAF_FISI_ID", sql.Int, dto.sarrafFisiId ?? null);
    req.input("IN_VEZNE_ID", sql.Int, dto.vezneId);
    req.input("IN_CARI_KART_ID", sql.Int, dto.cariKartId ?? null);
    req.input("IN_TARIH", sql.DateTime, parseDate(dto.tarih));
    req.input("IN_SAAT", sql.DateTime, dto.saat ? (safeDate(dto.saat) || parseDate(dto.tarih)) : new Date());
    req.input("IN_FIS_NO", sql.Char(20), effectiveSeriNo);
    req.input("IN_IRSALIYE_NO", sql.Char(20), effectiveBelgeNo);
    req.input("IN_TIP", sql.TinyInt, Number(dto.tip) || 0);
    req.input("IN_ALTIN_HAS_KURU", sql.Float, Number(dto.altinHasKuru) || 0);
    req.input("IN_KDV_ORANI", sql.Float, dto.kdvOrani != null && !isNaN(Number(dto.kdvOrani)) ? Number(dto.kdvOrani) : null);
    req.input("IN_KDV", sql.Float, Number(effectiveKdv) || 0);
    req.input("IN_E_FATURA_POSTA", sql.VarChar(200), dto.eFaturaPosta ?? null);
    req.input("IN_E_IRSALIYE_POSTA", sql.VarChar(200), dto.eIrsaliyePosta ?? null);
    req.input("IN_IRSALIYE_ZAMANI", sql.DateTime, safeDate(dto.irsaliyeZamani));
    req.input("IN_KISILIK_TIPI", sql.TinyInt, dto.kisilikTipi !== undefined && dto.kisilikTipi !== null ? Number(dto.kisilikTipi) : 0);
    req.input("IN_UYRUK_ID", sql.Int, dto.uyrukId ?? null);
    req.input("IN_ULKE_ID", sql.Int, dto.ulkeId ?? null);
    req.input("IN_PASAPORT_NO", sql.Char(20), dto.pasaportNo ?? null);
    req.input("IN_HUKUKI_YAPI_ID", sql.Int, dto.hukukiYapiId ?? null);
    req.input("IN_VERGI_DAIRESI_ID", sql.Int, dto.vergiDairesiId ?? null);
    req.input("IN_VERGI_KIMLIK_NO", sql.Char(20), dto.vergiKimlikNo ?? null);
    req.input("IN_BABA_ADI", sql.VarChar(200), dto.babaAdi ?? null);
    req.input("IN_ADRES", sql.VarChar(100), dto.adres ?? null);
    req.input("IN_ILCE_ID", sql.Int, dto.ilceId ?? null);
    req.input("IN_POSTA_KODU_ID", sql.Int, dto.postaKoduId ?? null);
    req.input("IN_IL_ID", sql.Int, dto.ilId ?? null);
    req.input("IN_VEKIL_TURU", sql.TinyInt, dto.vekilTuru ?? null);
    req.input("IN_VEKIL_KISILIK_TIPI", sql.TinyInt, dto.vekilKisilikTipi ?? null);
    req.input("IN_VEKIL_ADI", sql.VarChar(200), dto.vekilAdi ?? null);
    req.input("IN_VEKIL_KIMLIK_NO", sql.Char(20), dto.vekilKimlikNo ?? null);
    req.input("IN_EPOSTA", sql.VarChar(100), dto.eposta ?? null);
    req.input("IN_TELEFON_NO", sql.VarChar(20), dto.telefonNo ?? null);
    req.input("IN_MESLEK_ID", sql.Int, dto.meslekId ?? null);
    req.input("IN_DOGUM_TARIHI", sql.DateTime, safeDate(dto.dogumTarihi));
    req.input("IN_DOGUM_YERI", sql.VarChar(100), dto.dogumYeri ?? null);
    req.input("IN_KIMLIK_SERI_NO", sql.Char(20), dto.kimlikSeriNo ?? null);
    req.input("IN_ANNE_ADI", sql.VarChar(200), dto.anneAdi ?? null);
    req.input("IN_MASAK_LISTESINDE_VAR", sql.Bit, dto.masakListesindeVar ? 1 : 0);
    req.input("IN_SUPHELI_ISLEMLER_YETKILI_ID", sql.Int, dto.supheliIslemlerYetkiliId ?? null);
    req.input("IN_YETKILI_KISI_ID", sql.Int, dto.yetkiliKisiId ?? null);
    req.input("IN_SIRKET_TURU", sql.TinyInt, dto.sirketTuru ?? null);
    req.input("IN_KIMLIK_GECERLILIK_TARIHI", sql.DateTime, safeDate(dto.kimlikGecerlilikTarihi));
    req.input("IN_KIMLIK_BELGE_TURU", sql.TinyInt, dto.kimlikBelgeTuru ?? null);
    req.input("IN_DERNEK_AMACI", sql.VarChar(200), dto.dernekAmaci ?? null);
    req.input("IN_YETKILI_KISI", sql.VarChar(200), dto.yetkiliKisi ?? null);
    req.input("IN_BELGE_TURU", sql.TinyInt, dto.belgeTuru ?? 0);
    req.input("IN_SOFOR_ID", sql.Int, dto.soforId ?? null);
    const rawUnvan = (dto.unvan || "").trim();
    const finalUnvan = rawUnvan && rawUnvan.length > 0 ? rawUnvan : "İsim beyan edilmemiştir";
    req.input("IN_UNVAN", sql.VarChar(200), finalUnvan);
    req.input("IN_FAVORI_PARA_ID", sql.Int, dto.favoriParaId ?? null);
    req.input("IN_ALIS_KURU", sql.Float, Number(dto.alisKuru) || 0);
    req.input("IN_SATIS_KURU", sql.Float, Number(dto.satisKuru) || 0);
    req.input("IN_GUMUS_HAS_KURU", sql.Float, Number(dto.gumusHasKuru) || 0);
    req.input("IN_KULLANICI_ID", sql.Int, dto.kullaniciId || 1);
    req.input("IN_GUID", sql.VarChar(40), dto.guid ?? null);
    req.input("IN_DEGISIKLIK_TAKIP_VAR", sql.Bit, dto.degisiklikTakipVar ? 1 : 0);
    req.input("IN_YAZDIRILAN_BELGE_TIPI", sql.TinyInt, dto.yazdirilanBelgeTipi !== undefined && dto.yazdirilanBelgeTipi !== null ? dto.yazdirilanBelgeTipi : 0);

    const validLines = (dto.satirlar || []).filter((s) => s.urunId && s.urunId > 0);
    const lineValuesSql = validLines.map((s, idx) => {
      const p = `s_${idx}`;
      req.input(`${p}_sId`, sql.Int, s.satirId ?? null);
      req.input(`${p}_sNo`, sql.Int, s.satirNo || (idx + 1));
      req.input(`${p}_uId`, sql.Int, s.urunId);
      req.input(`${p}_mik`, sql.Float, Number(s.miktar) || 0);
      req.input(`${p}_mil`, sql.Float, Number(s.milyem) || 0);
      req.input(`${p}_hg`, sql.Float, Number(s.hasGram) || 0);
      req.input(`${p}_ad`, sql.Int, s.adet != null && !isNaN(Number(s.adet)) ? Number(s.adet) : 0);
      req.input(`${p}_im`, sql.Int, Number(s.iscilikiMiktari) || 0);
      req.input(`${p}_ihg`, sql.Float, Number(s.iscilikHasGram) || 0);
      req.input(`${p}_ac`, sql.VarChar(100), s.aciklama || null);
      req.input(`${p}_ihs`, sql.TinyInt, s.iscilikHesaplamaSekli != null ? Number(s.iscilikHesaplamaSekli) : 0);
      req.input(`${p}_kur`, sql.Float, Number(s.kur) || 0);
      req.input(`${p}_tut`, sql.Float, Number(s.tutar) || 0);
      req.input(`${p}_ut`, sql.TinyInt, Number(s.urunTipi) || 0);
      req.input(`${p}_uop`, sql.Int, s.urunOgesiParaId ?? null);
      req.input(`${p}_kar`, sql.Float, s.karat != null && !isNaN(Number(s.karat)) ? Number(s.karat) : null);
      return `(@${p}_sId, @${p}_sNo, @${p}_uId, @${p}_mik, @${p}_mil, @${p}_hg, @${p}_ad, @${p}_im, @${p}_ihg, @${p}_ac, @${p}_ihs, @${p}_kur, @${p}_tut, @${p}_ut, @${p}_uop, @${p}_kar)`;
    });

    let validOdemeler = (dto.odemeSatirlari || []).filter((o) => Number(o.miktar) > 0 || Number(o.tutar) > 0);
    if (validOdemeler.length === 0 && validLines.length > 0) {
      const totTutar = validLines.reduce((s, l) => s + (l.tutar || 0), 0);
      const totHas = validLines.reduce((s, l) => s + (l.hasGram || 0) + (l.iscilikHasGram || 0), 0);
      if (totTutar > 0) {
        validOdemeler.push({
          satirNo: 1,
          islemeYeri: 0,
          odemeAraciTuru: 0,
          paraId: null,
          miktar: totTutar,
          milyem: 0,
          hasGram: totHas,
          kur: 1,
          tutar: totTutar,
        });
      }
    }

    const odemeValuesSql = validOdemeler.map((o, idx) => {
      const p = `o_${idx}`;
      req.input(`${p}_sNo`, sql.Int, o.satirNo || (idx + 1));
      req.input(`${p}_iy`, sql.TinyInt, o.islemeYeri || 0);
      req.input(`${p}_oat`, sql.TinyInt, o.odemeAraciTuru || 0);
      req.input(`${p}_pid`, sql.Int, o.paraId ?? null);
      req.input(`${p}_pos`, sql.Int, o.posCihaziId ?? null);
      req.input(`${p}_mik`, sql.Float, Number(o.miktar) || 0);
      req.input(`${p}_mil`, sql.Float, Number(o.milyem) || 0);
      req.input(`${p}_hg`, sql.Float, Number(o.hasGram) || 0);
      req.input(`${p}_kur`, sql.Float, Number(o.kur) || 1);
      req.input(`${p}_tut`, sql.Float, Number(o.tutar) || 0);
      req.input(`${p}_dg`, sql.Bit, o.degistirildi ? 1 : 0);
      return `(@${p}_sNo, @${p}_iy, @${p}_oat, COALESCE(@${p}_pid, @DEFAULT_TL_PARA_ID, 1), @${p}_pos, @${p}_mik, @${p}_mil, @${p}_hg, @${p}_kur, @${p}_tut, @${p}_dg)`;
    });

    const batchQuery = `
      SET NOCOUNT ON;

      DECLARE @DEFAULT_TL_PARA_ID INT;
      SELECT TOP 1 @DEFAULT_TL_PARA_ID = PARA_ID FROM TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) IN ('TL','TRY','TL.','TRL','YTL') ORDER BY SIRA_NO, PARA_ID;
      IF @DEFAULT_TL_PARA_ID IS NULL
        SELECT TOP 1 @DEFAULT_TL_PARA_ID = PARA_ID FROM TODVZ_PARA WHERE UPPER(AD) LIKE '%LİRA%' OR UPPER(AD) LIKE '%LIRA%' ORDER BY SIRA_NO, PARA_ID;
      IF @DEFAULT_TL_PARA_ID IS NULL
        SELECT TOP 1 @DEFAULT_TL_PARA_ID = PARA_ID FROM TODVZ_PARA ORDER BY SIRA_NO, PARA_ID;

      IF OBJECT_ID('tempdb..#TODVZ_ISKELE_SARRAF_FISI_SATIRI') IS NOT NULL DROP TABLE #TODVZ_ISKELE_SARRAF_FISI_SATIRI;
      CREATE TABLE #TODVZ_ISKELE_SARRAF_FISI_SATIRI (
        SATIR_ID INT NULL, SATIR_NO INT NOT NULL, URUN_ID INT NULL,
        MIKTAR FLOAT NOT NULL DEFAULT 0, MILYEM FLOAT NOT NULL DEFAULT 0,
        HAS_GRAM FLOAT NOT NULL DEFAULT 0, ADET INT NOT NULL DEFAULT 0,
        ISCILIK_MIKTARI INT NOT NULL DEFAULT 0, ISCILIK_HAS_GRAM FLOAT NOT NULL DEFAULT 0,
        ACIKLAMA VARCHAR(100) NULL, ISCILIK_HESAPLAMA_SEKLI TINYINT NOT NULL DEFAULT 0,
        KUR FLOAT NOT NULL DEFAULT 1, TUTAR FLOAT NOT NULL DEFAULT 0,
        URUN_TIPI TINYINT NOT NULL DEFAULT 0, URUN_OGESI_PARA_ID INT NULL, KARAT FLOAT NULL
      );

      IF OBJECT_ID('tempdb..#TODVZ_ISKELE_ODEME_SATIRI') IS NOT NULL DROP TABLE #TODVZ_ISKELE_ODEME_SATIRI;
      CREATE TABLE #TODVZ_ISKELE_ODEME_SATIRI (
        SATIR_NO INT NOT NULL, ISLEME_YERI TINYINT NOT NULL DEFAULT 0,
        ODEME_ARACI_TURU TINYINT NOT NULL DEFAULT 0, PARA_ID INT NULL,
        POS_CIHAZI_ID INT NULL, MIKTAR FLOAT NOT NULL DEFAULT 0,
        MILYEM FLOAT NOT NULL DEFAULT 0, HAS_GRAM FLOAT NOT NULL DEFAULT 0,
        KUR FLOAT NOT NULL DEFAULT 1, TUTAR FLOAT NOT NULL DEFAULT 0, DEGISTIRILDI BIT NOT NULL DEFAULT 0
      );

      IF OBJECT_ID('tempdb..#TODVZ_ISKELE_URUN_OGESI_ISLEMI') IS NOT NULL DROP TABLE #TODVZ_ISKELE_URUN_OGESI_ISLEMI;
      CREATE TABLE #TODVZ_ISKELE_URUN_OGESI_ISLEMI (
        SATIR_NO INT NOT NULL, URUN_OGESI_ID INT NOT NULL,
        ADET INT NOT NULL DEFAULT 1, GRAMAJ FLOAT NULL, FIYAT FLOAT NULL
      );

      ${lineValuesSql.length > 0 ? `INSERT INTO #TODVZ_ISKELE_SARRAF_FISI_SATIRI (
        SATIR_ID, SATIR_NO, URUN_ID, MIKTAR, MILYEM, HAS_GRAM, ADET,
        ISCILIK_MIKTARI, ISCILIK_HAS_GRAM, ACIKLAMA, ISCILIK_HESAPLAMA_SEKLI,
        KUR, TUTAR, URUN_TIPI, URUN_OGESI_PARA_ID, KARAT
      ) VALUES ${lineValuesSql.join(",\n")};` : ""}

      ${odemeValuesSql.length > 0 ? `INSERT INTO #TODVZ_ISKELE_ODEME_SATIRI (
        SATIR_NO, ISLEME_YERI, ODEME_ARACI_TURU, PARA_ID, POS_CIHAZI_ID,
        MIKTAR, MILYEM, HAS_GRAM, KUR, TUTAR, DEGISTIRILDI
      ) VALUES ${odemeValuesSql.join(",\n")};` : ""}

      DECLARE @OUT_SARRAF_FISI_ID INT = @IN_SARRAF_FISI_ID;
      DECLARE @OUT_FIS_NO CHAR(20) = @IN_FIS_NO;
      DECLARE @OUT_IRSALIYE_NO CHAR(20) = @IN_IRSALIYE_NO;
      DECLARE @OUT_YENI_KAYIT BIT = 0;

      DECLARE @EFFECTIVE_FAVORI_PARA_ID INT = @IN_FAVORI_PARA_ID;
      IF @EFFECTIVE_FAVORI_PARA_ID IS NULL
      BEGIN
        SET @EFFECTIVE_FAVORI_PARA_ID = @DEFAULT_TL_PARA_ID;
      END;
      IF @EFFECTIVE_FAVORI_PARA_ID IS NULL
      BEGIN
        SELECT TOP 1 @EFFECTIVE_FAVORI_PARA_ID = PARA_ID FROM TODVZ_PARA ORDER BY SIRA_NO, PARA_ID;
      END;

      EXEC SODVZ_SARRAF_FISI_KAYDET
        @SARRAF_FISI_ID = @OUT_SARRAF_FISI_ID OUTPUT,
        @VEZNE_ID = @IN_VEZNE_ID,
        @CARI_KART_ID = @IN_CARI_KART_ID,
        @TARIH = @IN_TARIH,
        @SAAT = @IN_SAAT,
        @FIS_NO = @OUT_FIS_NO OUTPUT,
        @TIP = @IN_TIP,
        @ALTIN_HAS_KURU = @IN_ALTIN_HAS_KURU,
        @KDV_ORANI = @IN_KDV_ORANI,
        @KDV = @IN_KDV,
        @E_FATURA_POSTA_KUTUSU = @IN_E_FATURA_POSTA,
        @E_IRSALIYE_POSTA_KUTUSU = @IN_E_IRSALIYE_POSTA,
        @IRSALIYE_NO = @OUT_IRSALIYE_NO OUTPUT,
        @IRSALIYE_ZAMANI = @IN_IRSALIYE_ZAMANI,
        @KISILIK_TIPI = @IN_KISILIK_TIPI,
        @UYRUK_ID = @IN_UYRUK_ID,
        @ULKE_ID = @IN_ULKE_ID,
        @PASAPORT_NO = @IN_PASAPORT_NO,
        @HUKUKI_YAPI_ID = @IN_HUKUKI_YAPI_ID,
        @VERGI_DAIRESI_ID = @IN_VERGI_DAIRESI_ID,
        @VERGI_KIMLIK_NO = @IN_VERGI_KIMLIK_NO,
        @BABA_ADI = @IN_BABA_ADI,
        @ADRES = @IN_ADRES,
        @ILCE_ID = @IN_ILCE_ID,
        @POSTA_KODU_ID = @IN_POSTA_KODU_ID,
        @IL_ID = @IN_IL_ID,
        @VEKIL_TURU = @IN_VEKIL_TURU,
        @VEKIL_KISILIK_TIPI = @IN_VEKIL_KISILIK_TIPI,
        @VEKIL_ADI = @IN_VEKIL_ADI,
        @VEKIL_KIMLIK_NO = @IN_VEKIL_KIMLIK_NO,
        @EPOSTA = @IN_EPOSTA,
        @TELEFON_NO = @IN_TELEFON_NO,
        @MESLEK_ID = @IN_MESLEK_ID,
        @DOGUM_TARIHI = @IN_DOGUM_TARIHI,
        @DOGUM_YERI = @IN_DOGUM_YERI,
        @KIMLIK_SERI_NO = @IN_KIMLIK_SERI_NO,
        @ANNE_ADI = @IN_ANNE_ADI,
        @MASAK_LISTESINDE_VAR = @IN_MASAK_LISTESINDE_VAR,
        @SUPHELI_ISLEMLER_YETKILI_ID = @IN_SUPHELI_ISLEMLER_YETKILI_ID,
        @YETKILI_KISI_ID = @IN_YETKILI_KISI_ID,
        @SIRKET_TURU = @IN_SIRKET_TURU,
        @KIMLIK_GECERLILIK_TARIHI = @IN_KIMLIK_GECERLILIK_TARIHI,
        @KIMLIK_BELGE_TURU = @IN_KIMLIK_BELGE_TURU,
        @DERNEK_AMACI = @IN_DERNEK_AMACI,
        @YETKILI_KISI = @IN_YETKILI_KISI,
        @BELGE_TURU = @IN_BELGE_TURU,
        @SOFOR_ID = @IN_SOFOR_ID,
        @UNVAN = @IN_UNVAN,
        @FAVORI_PARA_ID = @EFFECTIVE_FAVORI_PARA_ID,
        @ALIS_KURU = @IN_ALIS_KURU,
        @SATIS_KURU = @IN_SATIS_KURU,
        @GUMUS_HAS_KURU = @IN_GUMUS_HAS_KURU,
        @KULLANICI_ID = @IN_KULLANICI_ID,
        @GUID = @IN_GUID,
        @DEGISIKLIK_TAKIP_VAR = @IN_DEGISIKLIK_TAKIP_VAR,
        @YAZDIRILAN_BELGE_TIPI = @IN_YAZDIRILAN_BELGE_TIPI,
        @YENI_KAYIT = @OUT_YENI_KAYIT OUTPUT;

      IF OBJECT_ID('tempdb..#TODVZ_ISKELE_SARRAF_FISI_SATIRI') IS NOT NULL DROP TABLE #TODVZ_ISKELE_SARRAF_FISI_SATIRI;
      IF OBJECT_ID('tempdb..#TODVZ_ISKELE_ODEME_SATIRI') IS NOT NULL DROP TABLE #TODVZ_ISKELE_ODEME_SATIRI;
      IF OBJECT_ID('tempdb..#TODVZ_ISKELE_URUN_OGESI_ISLEMI') IS NOT NULL DROP TABLE #TODVZ_ISKELE_URUN_OGESI_ISLEMI;

      IF (@OUT_FIS_NO IS NULL OR LEN(LTRIM(RTRIM(@OUT_FIS_NO))) = 0)
      BEGIN
        DECLARE @SARRAF_NUM_TUR INT = CASE @IN_TIP WHEN 0 THEN 0 ELSE 4 END;

        DECLARE @NUM_YAZICI_ID INT = NULL;
        IF OBJECT_ID('TODVZ_NUMERATOR') IS NOT NULL
        BEGIN
          SELECT TOP 1 @NUM_YAZICI_ID = YAZICI_ID
          FROM TODVZ_NUMERATOR
          WHERE TUR = @SARRAF_NUM_TUR
          ORDER BY CASE WHEN YAZICI_ID IS NOT NULL THEN 0 ELSE 1 END;
        END;

        DECLARE @GEN_FIS_NO VARCHAR(20) = NULL;
        DECLARE @GEN_ONEK VARCHAR(10) = NULL;
        DECLARE @GEN_SIFIR BIT = 1;
        DECLARE @GEN_RET INT = 0;

        IF OBJECT_ID('SODVZ_NUMERATOR_URET') IS NOT NULL
        BEGIN
          -- 1. Hedef yazıcı ID ile çağır
          BEGIN TRY
            EXEC @GEN_RET = SODVZ_NUMERATOR_URET @SARRAF_NUM_TUR, @GEN_FIS_NO OUTPUT, @NUM_YAZICI_ID, 1, @GEN_ONEK OUTPUT, @GEN_SIFIR OUTPUT;
          END TRY
          BEGIN CATCH
          END CATCH;

          -- 2. Eğer üretilemediyse ve @NUM_YAZICI_ID NULL değildiyse, NULL yazıcı ile dene
          IF (@GEN_FIS_NO IS NULL OR LEN(LTRIM(RTRIM(@GEN_FIS_NO))) = 0) AND @NUM_YAZICI_ID IS NOT NULL
          BEGIN
            BEGIN TRY
              EXEC @GEN_RET = SODVZ_NUMERATOR_URET @SARRAF_NUM_TUR, @GEN_FIS_NO OUTPUT, NULL, 1, @GEN_ONEK OUTPUT, @GEN_SIFIR OUTPUT;
            END TRY
            BEGIN CATCH
            END CATCH;
          END;

          -- 3. Temel TUR ile dene (0 veya 4)
          IF (@GEN_FIS_NO IS NULL OR LEN(LTRIM(RTRIM(@GEN_FIS_NO))) = 0)
          BEGIN
            DECLARE @BASE_TUR INT = CASE @IN_TIP WHEN 0 THEN 0 ELSE 4 END;
            BEGIN TRY
              EXEC @GEN_RET = SODVZ_NUMERATOR_URET @BASE_TUR, @GEN_FIS_NO OUTPUT, NULL, 1, @GEN_ONEK OUTPUT, @GEN_SIFIR OUTPUT;
            END TRY
            BEGIN CATCH
            END CATCH;
          END;
        END;

        -- 4. Eğer prosedürden üretilemediyse TODVZ_NUMERATOR tablosundan doğrudan üret ve sayacı artır
        IF (@GEN_FIS_NO IS NULL OR LEN(LTRIM(RTRIM(@GEN_FIS_NO))) = 0) AND OBJECT_ID('TODVZ_NUMERATOR') IS NOT NULL
        BEGIN
          DECLARE @N_ONEK VARCHAR(10) = NULL;
          DECLARE @N_BASLANGIC BIGINT = NULL;
          DECLARE @N_BITIS BIGINT = 0;
          DECLARE @N_UZUNLUK INT = 10;
          DECLARE @N_SIFIR BIT = 1;
          DECLARE @N_TUR INT = @SARRAF_NUM_TUR;

          SELECT TOP 1
            @N_ONEK = ONEK,
            @N_BASLANGIC = BASLANGIC,
            @N_BITIS = ISNULL(BITIS, 0),
            @N_UZUNLUK = ISNULL(UZUNLUK, 10),
            @N_SIFIR = ISNULL(ONUNE_SIFIR_KOY, 1)
          FROM TODVZ_NUMERATOR
          WHERE TUR = @SARRAF_NUM_TUR
          ORDER BY CASE WHEN YAZICI_ID IS NULL THEN 0 ELSE 1 END;

          IF @N_BASLANGIC IS NULL
          BEGIN
            SET @N_TUR = CASE @IN_TIP WHEN 0 THEN 0 ELSE 4 END;
            SELECT TOP 1
              @N_ONEK = ONEK,
              @N_BASLANGIC = BASLANGIC,
              @N_BITIS = ISNULL(BITIS, 0),
              @N_UZUNLUK = ISNULL(UZUNLUK, 10),
              @N_SIFIR = ISNULL(ONUNE_SIFIR_KOY, 1)
            FROM TODVZ_NUMERATOR
            WHERE TUR = @N_TUR
            ORDER BY CASE WHEN YAZICI_ID IS NULL THEN 0 ELSE 1 END;
          END;

          IF @N_BASLANGIC IS NOT NULL
          BEGIN
            UPDATE TODVZ_NUMERATOR
            SET BASLANGIC = @N_BASLANGIC + 1
            WHERE TUR = @N_TUR AND ((@NUM_YAZICI_ID IS NULL AND YAZICI_ID IS NULL) OR YAZICI_ID = @NUM_YAZICI_ID);

            DECLARE @N_PAD_LEN INT = @N_UZUNLUK;
            IF @N_ONEK IS NOT NULL
              SET @N_PAD_LEN = @N_PAD_LEN - LEN(RTRIM(@N_ONEK));
            IF @N_PAD_LEN < 1 SET @N_PAD_LEN = 1;

            DECLARE @N_NUM_STR VARCHAR(20) = CAST(@N_BASLANGIC AS VARCHAR(20));
            IF @N_SIFIR = 1 AND LEN(@N_NUM_STR) < @N_PAD_LEN
              SET @N_NUM_STR = REPLICATE('0', @N_PAD_LEN - LEN(@N_NUM_STR)) + @N_NUM_STR;

            IF @N_ONEK IS NOT NULL
              SET @GEN_FIS_NO = RTRIM(@N_ONEK) + @N_NUM_STR;
            ELSE
              SET @GEN_FIS_NO = @N_NUM_STR;
          END;
        END;

        -- 5. Numaratörde hiç yoksa son kayıttan türet
        IF (@GEN_FIS_NO IS NULL OR LEN(LTRIM(RTRIM(@GEN_FIS_NO))) = 0)
        BEGIN
          DECLARE @SON_FIS_NO VARCHAR(20) = NULL;
          SELECT TOP 1 @SON_FIS_NO = RTRIM(FIS_NO)
          FROM TODVZ_SARRAF_FISI
          WHERE TIP = @IN_TIP AND FIS_NO IS NOT NULL AND LEN(RTRIM(FIS_NO)) > 0
          ORDER BY SARRAF_FISI_ID DESC;

          DECLARE @DEF_ONEK VARCHAR(5) = CASE WHEN @IN_TIP = 0 THEN 'A' ELSE 'S' END;
          IF @SON_FIS_NO IS NOT NULL
          BEGIN
            DECLARE @DIGITS VARCHAR(30) = '';
            DECLARE @PREFIX VARCHAR(30) = '';
            DECLARE @P_IDX INT = 1;
            WHILE @P_IDX <= LEN(@SON_FIS_NO)
            BEGIN
              DECLARE @CH CHAR(1) = SUBSTRING(@SON_FIS_NO, @P_IDX, 1);
              IF @CH LIKE '[0-9]'
                SET @DIGITS = @DIGITS + @CH;
              ELSE IF LEN(@DIGITS) = 0
                SET @PREFIX = @PREFIX + @CH;
              SET @P_IDX = @P_IDX + 1;
            END;
            IF LEN(@DIGITS) > 0
            BEGIN
              DECLARE @NEXT_VAL BIGINT = CAST(@DIGITS AS BIGINT) + 1;
              DECLARE @NEXT_STR VARCHAR(30) = CAST(@NEXT_VAL AS VARCHAR(30));
              IF LEN(@NEXT_STR) < LEN(@DIGITS)
                SET @NEXT_STR = REPLICATE('0', LEN(@DIGITS) - LEN(@NEXT_STR)) + @NEXT_STR;
              SET @GEN_FIS_NO = (CASE WHEN LEN(@PREFIX) > 0 THEN @PREFIX ELSE @DEF_ONEK END) + @NEXT_STR;
            END
            ELSE
            BEGIN
              SET @GEN_FIS_NO = @DEF_ONEK + '0000000001';
            END;
          END
          ELSE
          BEGIN
            SET @GEN_FIS_NO = @DEF_ONEK + '0000000001';
          END;
        END;

        SET @OUT_FIS_NO = LTRIM(RTRIM(@GEN_FIS_NO));
        IF (@OUT_FIS_NO IS NOT NULL AND LEN(@OUT_FIS_NO) > 0 AND @OUT_SARRAF_FISI_ID IS NOT NULL)
        BEGIN
          UPDATE [dbo].[TODVZ_SARRAF_FISI] SET FIS_NO = @OUT_FIS_NO WHERE SARRAF_FISI_ID = @OUT_SARRAF_FISI_ID;
        END;
      END;

      -- Belge No / İrsaliye No Kontrolü & Üretimi
      IF (@OUT_IRSALIYE_NO IS NULL OR LEN(LTRIM(RTRIM(@OUT_IRSALIYE_NO))) = 0)
      BEGIN
        DECLARE @TARGET_BELGE_TUR INT = CASE WHEN @IN_TIP = 0 THEN 8 ELSE 9 END;
        DECLARE @GEN_BELGE_NO VARCHAR(20) = NULL;
        DECLARE @GEN_B_ONEK VARCHAR(10) = NULL;
        DECLARE @GEN_B_SIFIR BIT = 1;
        DECLARE @GEN_B_RET INT = 0;

        IF OBJECT_ID('SODVZ_NUMERATOR_URET') IS NOT NULL
        BEGIN
          BEGIN TRY
            EXEC @GEN_B_RET = SODVZ_NUMERATOR_URET @TARGET_BELGE_TUR, @GEN_BELGE_NO OUTPUT, NULL, 1, @GEN_B_ONEK OUTPUT, @GEN_B_SIFIR OUTPUT;
          END TRY
          BEGIN CATCH
          END CATCH;
        END;

        IF (@GEN_BELGE_NO IS NULL OR LEN(LTRIM(RTRIM(@GEN_BELGE_NO))) = 0) AND OBJECT_ID('TODVZ_NUMERATOR') IS NOT NULL
        BEGIN
          DECLARE @BN_ONEK VARCHAR(10) = NULL;
          DECLARE @BN_BASLANGIC BIGINT = NULL;
          DECLARE @BN_UZUNLUK INT = 10;
          DECLARE @BN_SIFIR BIT = 1;

          SELECT TOP 1
            @BN_ONEK = ONEK,
            @BN_BASLANGIC = BASLANGIC,
            @BN_UZUNLUK = ISNULL(UZUNLUK, 10),
            @BN_SIFIR = ISNULL(ONUNE_SIFIR_KOY, 1)
          FROM TODVZ_NUMERATOR
          WHERE TUR = @TARGET_BELGE_TUR
          ORDER BY CASE WHEN YAZICI_ID IS NULL THEN 0 ELSE 1 END;

          IF @BN_BASLANGIC IS NOT NULL
          BEGIN
            UPDATE TODVZ_NUMERATOR
            SET BASLANGIC = @BN_BASLANGIC + 1
            WHERE TUR = @TARGET_BELGE_TUR AND YAZICI_ID IS NULL;

            DECLARE @BN_PAD_LEN INT = @BN_UZUNLUK;
            IF @BN_ONEK IS NOT NULL
              SET @BN_PAD_LEN = @BN_PAD_LEN - LEN(RTRIM(@BN_ONEK));
            IF @BN_PAD_LEN < 1 SET @BN_PAD_LEN = 1;

            DECLARE @BN_NUM_STR VARCHAR(20) = CAST(@BN_BASLANGIC AS VARCHAR(20));
            IF @BN_SIFIR = 1 AND LEN(@BN_NUM_STR) < @BN_PAD_LEN
              SET @BN_NUM_STR = REPLICATE('0', @BN_PAD_LEN - LEN(@BN_NUM_STR)) + @BN_NUM_STR;

            IF @BN_ONEK IS NOT NULL
              SET @GEN_BELGE_NO = RTRIM(@BN_ONEK) + @BN_NUM_STR;
            ELSE
              SET @GEN_BELGE_NO = @BN_NUM_STR;
          END;
        END;

        IF (@GEN_BELGE_NO IS NULL OR LEN(LTRIM(RTRIM(@GEN_BELGE_NO))) = 0)
        BEGIN
          DECLARE @SON_IRSALIYE VARCHAR(20) = NULL;
          SELECT TOP 1 @SON_IRSALIYE = RTRIM(IRSALIYE_NO)
          FROM TODVZ_SARRAF_FISI
          WHERE TIP = @IN_TIP AND IRSALIYE_NO IS NOT NULL AND LEN(RTRIM(IRSALIYE_NO)) > 0
          ORDER BY SARRAF_FISI_ID DESC;

          DECLARE @DEF_B_ONEK VARCHAR(5) = 'B';
          IF @SON_IRSALIYE IS NOT NULL
          BEGIN
            DECLARE @B_DIGITS VARCHAR(30) = '';
            DECLARE @B_PREFIX VARCHAR(30) = '';
            DECLARE @BP_IDX INT = 1;
            WHILE @BP_IDX <= LEN(@SON_IRSALIYE)
            BEGIN
              DECLARE @BCH CHAR(1) = SUBSTRING(@SON_IRSALIYE, @BP_IDX, 1);
              IF @BCH LIKE '[0-9]'
                SET @B_DIGITS = @B_DIGITS + @BCH;
              ELSE IF LEN(@B_DIGITS) = 0
                SET @B_PREFIX = @B_PREFIX + @BCH;
              SET @BP_IDX = @BP_IDX + 1;
            END;
            IF LEN(@B_DIGITS) > 0
            BEGIN
              DECLARE @NEXT_BVAL BIGINT = CAST(@B_DIGITS AS BIGINT) + 1;
              DECLARE @NEXT_BSTR VARCHAR(30) = CAST(@NEXT_BVAL AS VARCHAR(30));
              IF LEN(@NEXT_BSTR) < LEN(@B_DIGITS)
                SET @NEXT_BSTR = REPLICATE('0', LEN(@B_DIGITS) - LEN(@NEXT_BSTR)) + @NEXT_BSTR;
              SET @GEN_BELGE_NO = (CASE WHEN LEN(@B_PREFIX) > 0 THEN @B_PREFIX ELSE @DEF_B_ONEK END) + @NEXT_BSTR;
            END
            ELSE
            BEGIN
              SET @GEN_BELGE_NO = @DEF_B_ONEK + '0000000001';
            END;
          END
          ELSE
          BEGIN
            SET @GEN_BELGE_NO = @DEF_B_ONEK + '0000000001';
          END;
        END;

        SET @OUT_IRSALIYE_NO = LTRIM(RTRIM(@GEN_BELGE_NO));
        IF (@OUT_IRSALIYE_NO IS NOT NULL AND LEN(@OUT_IRSALIYE_NO) > 0 AND @OUT_SARRAF_FISI_ID IS NOT NULL)
        BEGIN
          UPDATE [dbo].[TODVZ_SARRAF_FISI] SET IRSALIYE_NO = @OUT_IRSALIYE_NO WHERE SARRAF_FISI_ID = @OUT_SARRAF_FISI_ID;
        END;
      END
      ELSE IF (@OUT_IRSALIYE_NO IS NOT NULL AND LEN(LTRIM(RTRIM(@OUT_IRSALIYE_NO))) > 0 AND @OUT_SARRAF_FISI_ID IS NOT NULL)
      BEGIN
        UPDATE [dbo].[TODVZ_SARRAF_FISI] SET IRSALIYE_NO = @OUT_IRSALIYE_NO WHERE SARRAF_FISI_ID = @OUT_SARRAF_FISI_ID;
      END;

      SELECT 
        @OUT_SARRAF_FISI_ID AS OUT_SARRAF_FISI_ID,
        @OUT_FIS_NO AS OUT_FIS_NO,
        @OUT_IRSALIYE_NO AS OUT_IRSALIYE_NO,
        @OUT_YENI_KAYIT AS OUT_YENI_KAYIT;
    `;

    try {
      const result = await req.query(batchQuery);
      let outRecord: any = null;
      const rsets = result.recordsets as any[];
      if (Array.isArray(rsets) && rsets.length > 0) {
        for (const rs of rsets) {
          if (rs && rs.length > 0 && rs[0]?.OUT_SARRAF_FISI_ID !== undefined) {
            outRecord = rs[0];
            break;
          }
        }
      }
      if (!outRecord) {
        outRecord = result.recordset?.[0];
      }
      const sarrafFisiId = Number(outRecord?.OUT_SARRAF_FISI_ID || dto.sarrafFisiId || 0);
      const fullFisNo = String(outRecord?.OUT_FIS_NO || dto.fisNo || "").trim();
      const rawIrsaliye = String(outRecord?.OUT_IRSALIYE_NO || dto.irsaliyeNo || "").trim();
      const yeniKayit = outRecord?.OUT_YENI_KAYIT === 1 || outRecord?.OUT_YENI_KAYIT === true;
      return { sarrafFisiId, fisNo: fullFisNo, seriNo: fullFisNo, belgeNo: rawIrsaliye, yeniKayit };
    } catch (err: any) {
      const precedingMsgs = Array.isArray(err?.precedingErrors)
        ? err.precedingErrors.map((p: any) => p?.message).filter(Boolean).join(" | ")
        : "";
      const rawMsg = [err?.message, err?.originalError?.message, precedingMsgs, String(err)].filter(Boolean).join(" - ");
      logger.error("saveFis error:", {
        message: err?.message,
        precedingMsgs,
        original: err?.originalError?.message,
        number: err?.number,
        state: err?.state,
        lineNumber: err?.lineNumber,
        procName: err?.procName,
        rawMsg,
      });

      let userFriendlyMsg = err?.message || "Fiş kaydedilemedi.";
      if (precedingMsgs.includes("FOREIGN KEY") || rawMsg.includes("FOREIGN KEY")) {
        if (rawMsg.includes("CARI_KART")) {
          userFriendlyMsg = "Seçilen cari kart sistemde bulunamadı. Lütfen geçerli bir cari kart seçiniz veya boş bırakınız.";
        } else if (rawMsg.includes("VEZNE")) {
          userFriendlyMsg = "Seçilen vezne sistemde tanımlı değil veya bu vezneye yetkiniz bulunmuyor.";
        } else if (rawMsg.includes("PARA") || rawMsg.includes("URUN")) {
          userFriendlyMsg = "Seçilen ürün sistemde tanımlı değil. Lütfen geçerli bir ürün seçiniz.";
        } else {
          userFriendlyMsg = `Veritabanı ilişkisel kural hatası: ${precedingMsgs || err?.message || rawMsg}`;
        }
      } else if (rawMsg.includes("Cannot insert the value NULL")) {
        const colMatch = rawMsg.match(/column '([^']+)'/i);
        const tblMatch = rawMsg.match(/table '([^']+)'/i);
        const colName = colMatch ? colMatch[1] : "";
        const tblName = tblMatch ? tblMatch[1] : "";
        const fieldLabels: Record<string, string> = {
          "VEZNE_ID": "Vezne",
          "CARI_KART_ID": "Cari Kart",
          "FIS_NO": "Belge / Fiş No",
          "TARIH": "Tarih",
          "SAAT": "Saat",
          "TIP": "İşlem Tipi",
          "UNVAN": "Ünvan / Ad Soyad",
          "URUN_ID": "Ürün",
          "MIKTAR": "Miktar (Gram)",
          "MILYEM": "Milyem",
          "HAS_GRAM": "Has Gram",
          "ADET": "Adet",
          "ISCILIK_MIKTARI": "İşçilik Miktarı",
          "ISCILIK_HAS_GRAM": "İşçilik Has Gram",
          "ISCILIK_HESAPLAMA_SEKLI": "İşçilik Hesaplama Şekli",
          "KUR": "Kur",
          "TUTAR": "Tutar",
          "URUN_TIPI": "Ürün Tipi",
          "PARA_ID": "Ödeme Para Birimi",
          "FAVORI_PARA_ID": "Favori Para Birimi",
          "KDV_ORANI": "KDV Oranı",
          "KDV": "KDV Tutarı",
          "KISILIK_TIPI": "Kişilik Tipi",
          "KULLANICI_ID": "Kullanıcı",
          "SOFOR_ID": "Şoför",
          "MESLEK_ID": "Meslek",
          "IL_ID": "İl",
          "ILCE_ID": "İlçe",
          "ULKE_ID": "Ülke",
          "UYRUK_ID": "Uyruk"
        };
        const friendlyCol = colName ? (fieldLabels[colName.toUpperCase()] || colName) : "Zorunlu Alan";
        userFriendlyMsg = `Fiş kaydedilirken zorunlu alan eksik bırakıldı: [${friendlyCol}] (Kolon: ${colName || "?"} - Tablo: ${tblName || "?"}). Lütfen bu alanı kontrol ediniz.`;
      } else if (rawMsg.includes("zorunlu")) {
        userFriendlyMsg = `Fiş kaydedilirken zorunlu alan hatası: ${precedingMsgs || err?.message || rawMsg}`;
      } else if (rawMsg.includes("Numeratör bitiş sayısını geçmiş")) {
        userFriendlyMsg = "Vezne numeratör serisi dolmuştur. Lütfen Numaratör Tanımları menüsünden yeni bir seri aralığı belirleyiniz.";
      } else if (rawMsg.includes("Barkodlu ürünün toplam satış adedi")) {
        userFriendlyMsg = rawMsg;
      } else if (precedingMsgs) {
        userFriendlyMsg = `Fiş kaydedilemedi: ${precedingMsgs}`;
      }

      throw ApiError.badRequest(userFriendlyMsg);
    }
  }

  public static async deleteFis(sarrafFisiId: number, kullaniciId: number, dbContext?: { dbServer?: string; dbName?: string }): Promise<void> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const req = pool.request();
      req.output("SARRAF_FISI_ID", sql.Int, sarrafFisiId);
      req.input("KULLANICI_ID", sql.Int, kullaniciId);
      await req.execute("SODVZ_SARRAF_FISI_SIL");
    } catch (err: any) {
      logger.error("deleteFis error:", err);
      throw ApiError.internal("Sarraf fişi silinemedi: "+(err?.message||""));
    }
  }

  public static async saveDetay(dto: SaveSarrafFisDetayDto, dbContext?: { dbServer?: string; dbName?: string }): Promise<void> {
    try {
      const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
      const req = pool.request();
      req.input("SARRAF_FISI_ID", sql.Int, dto.sarrafFisiId);
      req.input("UNVAN", sql.VarChar(200), dto.unvan??null);
      req.input("KISILIK_TIPI", sql.TinyInt, dto.kisilikTipi??null);
      req.input("UYRUK_ID", sql.Int, dto.uyrukId??null);
      req.input("ULKE_ID", sql.Int, dto.ulkeId??null);
      req.input("PASAPORT_NO", sql.Char(20), dto.pasaportNo??null);
      req.input("HUKUKI_YAPI_ID", sql.Int, dto.hukukiYapiId??null);
      req.input("VERGI_DAIRESI_ID", sql.Int, dto.vergiDairesiId??null);
      req.input("VERGI_KIMLIK_NO", sql.Char(20), dto.vergiKimlikNo??null);
      req.input("BABA_ADI", sql.VarChar(200), dto.babaAdi??null);
      req.input("ADRES", sql.VarChar(100), dto.adres??null);
      req.input("ILCE_ID", sql.Int, dto.ilceId??null);
      req.input("POSTA_KODU_ID", sql.Int, dto.postaKoduId??null);
      req.input("IL_ID", sql.Int, dto.ilId??null);
      req.input("VEKIL_TURU", sql.TinyInt, dto.vekilTuru??null);
      req.input("VEKIL_KISILIK_TIPI", sql.TinyInt, dto.vekilKisilikTipi??null);
      req.input("VEKIL_ADI", sql.VarChar(200), dto.vekilAdi??null);
      req.input("VEKIL_KIMLIK_NO", sql.Char(20), dto.vekilKimlikNo??null);
      req.input("EPOSTA", sql.VarChar(100), dto.eposta??null);
      req.input("TELEFON_NO", sql.VarChar(20), dto.telefonNo??null);
      req.input("MESLEK_ID", sql.Int, dto.meslekId??null);
      req.input("DOGUM_TARIHI", sql.DateTime, dto.dogumTarihi?new Date(dto.dogumTarihi):null);
      req.input("DOGUM_YERI", sql.VarChar(100), dto.dogumYeri??null);
      req.input("KIMLIK_SERI_NO", sql.Char(20), dto.kimlikSeriNo??null);
      req.input("ANNE_ADI", sql.VarChar(200), dto.anneAdi??null);
      req.input("SIRKET_TURU", sql.TinyInt, dto.sirketTuru??null);
      req.input("KIMLIK_BELGE_TURU", sql.TinyInt, dto.kimlikBelgeTuru??null);
      req.input("DERNEK_AMACI", sql.VarChar(200), dto.dernekAmaci??null);
      req.input("YETKILI_KISI_ID", sql.Int, dto.yetkiliKisiId??null);
      req.input("KIMLIK_GECERLILIK_TARIHI", sql.DateTime, dto.kimlikGecerlilikTarihi?new Date(dto.kimlikGecerlilikTarihi):null);
      req.input("KULLANICI_ID", sql.Int, dto.kullaniciId);
      await req.execute("SODVZ_SARRAF_FISI_DETAYI_KAYDET");
    } catch (err: any) {
      logger.error("saveDetay error:", err);
      throw ApiError.internal("Müşteri detayı kaydedilemedi: "+(err?.message||""));
    }
  }
}

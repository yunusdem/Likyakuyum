import sql from "mssql";
import { EVRAK_TURU_PERAKENDE, gibeGonderildiyseEngelle } from "./ebelgeGonderimKilidi.js";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { ticariFisHesapla, IskontoTuru, GECERLI_KDV_ORANLARI, birimAdiDuzelt } from "../services/ticari/ticariHesap.js";
import { PerakendeSqlRepository } from "./perakendeSql.repository.js";
import { DbBaglam, STOK_BELGE, TicariStokSqlRepository } from "./ticariStokSql.repository.js";
import { bakiyeler, eksiStokDenetle } from "./ticariGirisSql.repository.js";
import { TicariKampanyaSqlRepository } from "./ticariKampanyaSql.repository.js";

/**
 * Ticari Satış Fişi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T12–T16). Perakende fişinin tablolarına (TODVZ_FATURA*)
 * FIS_KAYNAGI = 1 ile yazılır: numara serisi, e-Belge kaynağı, cari / POS / vezne tahsilatı Perakende ile aynı çalışır.
 * Farklar: satır yalnız stok kartı; fiyat KDV dahil, satır + fiş iskontosu; stok hareket defterine çıkış yazılır;
 * işçilik kasa kaydı yazılmaz; alış ve iade yok; e-Belge'ye iletilmiş fiş düzeltilip silinmez.
 */

export const FIS_KAYNAGI_TICARI = 1;

export interface TicariSatisSatirGirdi {
  stokKartId: number;
  miktar: number | string;
  /**
   * Serbest ürün (Hızlı Satış, docs/HIZLI_SATIS_YOL_HARITASI.md H9): stokKartId boş, ad + KDV + KDV dahil fiyat satırda.
   * Stok hareketi yazılmaz.
   */
  urunAdi?: string | null;
  birim?: string | null;
  kdvOrani?: number | string | null;
  /** KDV dahil birim fiyat (boşsa karttan) */
  kdvDahilFiyat?: number | string | null;
  iskontoTuru?: number | null;
  iskontoDegeri?: number | string | null;
  /** Satıra uygulanan kampanya (İş 11, G12); satır iskontosu kampanyanınki olmalı */
  kampanyaId?: number | null;
}

export interface TicariSatisOdemeGirdi {
  satirNo?: number;
  /** 0 vezne · 1 cari · 2 POS · 3 banka hesabı */
  odemeAraciTuru?: number;
  cariKartId?: number | null;
  posCihaziId?: number | null;
  cariKod?: string | null;
  cariUnvan?: string | null;
  paraId?: number | null;
  paraKodu?: string | null;
  paraAdi?: string | null;
  miktar?: number | null;
  kur?: number | null;
  tutar: number;
}

export interface TicariSatisGirdi {
  faturaId?: number | null;
  vezneId?: number | null;
  faturaNo?: string | null;
  tarih?: string | null;
  senaryo?: string | null;
  cariKartId?: number | null;
  aliciVknTckn?: string | null;
  aliciUnvan?: string | null;
  adres?: string | null;
  ilce?: string | null;
  il?: string | null;
  vergiDairesi?: string | null;
  eposta?: string | null;
  telefon?: string | null;
  /** Fiş iskontosu (TODVZ_ISKONTO seçimi ya da elle): tür 1 yüzde, 2 tutar (KDV dahil) */
  iskontoId?: number | null;
  iskontoKodu?: string | null;
  iskontoTuru?: number | null;
  iskontoDegeri?: number | string | null;
  satirlar: TicariSatisSatirGirdi[];
  odemeler?: TicariSatisOdemeGirdi[];
  eksiStokOnay?: boolean;
  /** Kullanılan fiyat listesi (İş 11, G7); fiyatı verilmeyen satır bu listedeki fiyattan, yoksa ana fiyattan */
  fiyatListesiId?: number | null;
}

const temiz = (v: unknown): string => String(v ?? "").trim();
const sayi = (v: unknown): number => {
  if (typeof v === "string") v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Ödemelerin vezne bakiyesine işlenmiş etkisini geri alır (Perakende'deki kuralın ödeme kısmı) */
const ODEME_VEZNE_GERI_AL = `
  DECLARE @GA_VEZNE INT, @GA_TIPI INT;
  SELECT @GA_VEZNE = VEZNE_ID, @GA_TIPI = FATURA_TIPI FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @FID;
  IF @GA_VEZNE IS NOT NULL AND @GA_VEZNE > 0
  BEGIN
    DECLARE @GA TABLE (PARA_ID INT, M FLOAT);
    INSERT INTO @GA (PARA_ID, M)
      SELECT O.PARA_ID, CASE WHEN @GA_TIPI = 1 THEN -1 ELSE 1 END * ISNULL(NULLIF(O.MIKTAR, 0), O.TUTAR / NULLIF(O.KUR, 0))
      FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID = @FID AND ISNULL(O.VEZNE_ISLENDI, 0) = 1;
    UPDATE B SET MIKTAR = B.MIKTAR + G.M
      FROM dbo.TODVZ_VEZNE_BAKIYE B JOIN (SELECT PARA_ID, SUM(M) M FROM @GA WHERE PARA_ID IS NOT NULL GROUP BY PARA_ID) G ON G.PARA_ID = B.PARA_ID
      WHERE B.VEZNE_ID = @GA_VEZNE;
    INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR)
      SELECT @GA_VEZNE, G.PARA_ID, G.M FROM (SELECT PARA_ID, SUM(M) M FROM @GA WHERE PARA_ID IS NOT NULL GROUP BY PARA_ID) G
      WHERE NOT EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE B WHERE B.VEZNE_ID = @GA_VEZNE AND B.PARA_ID = G.PARA_ID);
  END;`;

/** Perakende'nin numara üretimiyle aynı (aynı seri; fiş tablosu + giden kutusu çakışmasız) */
const NUMARA_URET = `
  DECLARE @CURRENT_FID INT = @IN_FATURA_ID;
  DECLARE @GEN_NO VARCHAR(50) = @IN_FATURA_NO;
  DECLARE @PREFIX_KEY VARCHAR(10) = @IN_PREFIX;
  DECLARE @TARGET_TUR INT = CASE WHEN @IN_SENARYO = 'EARSIVFATURA' THEN 26 ELSE 24 END;
  DECLARE @ONEK VARCHAR(20) = NULL;
  DECLARE @ONUNE_SIFIR BIT = 1;
  DECLARE @SAYAC INT = 1;
  DECLARE @UZUNLUK INT = 16;
  DECLARE @YAZICI_ID INT = NULL;
  IF OBJECT_ID('dbo.TODVZ_NUMERATOR') IS NOT NULL
    SELECT TOP 1 @TARGET_TUR = TUR, @YAZICI_ID = YAZICI_ID, @ONEK = ONEK, @SAYAC = BASLANGIC, @UZUNLUK = UZUNLUK, @ONUNE_SIFIR = ONUNE_SIFIR_KOY
    FROM dbo.TODVZ_NUMERATOR
    WHERE (ONEK LIKE @PREFIX_KEY + '%' OR TUR = @TARGET_TUR OR (@PREFIX_KEY = 'GIB' AND TUR IN (24, 25)) OR (@PREFIX_KEY = 'EAR' AND TUR = 26))
    ORDER BY CASE WHEN ONEK LIKE @PREFIX_KEY + '%' THEN 0 WHEN TUR = @TARGET_TUR THEN 1 ELSE 2 END, CASE WHEN YAZICI_ID IS NOT NULL THEN 0 ELSE 1 END;
  IF @ONEK IS NULL OR LEN(LTRIM(RTRIM(@ONEK))) = 0 OR @ONEK NOT LIKE @PREFIX_KEY + '%' SET @ONEK = @PREFIX_KEY + CAST(YEAR(GETDATE()) AS VARCHAR(4));
  IF @UZUNLUK IS NULL OR @UZUNLUK < 2 SET @UZUNLUK = 16;
  IF @SAYAC IS NULL OR @SAYAC < 1 SET @SAYAC = 1;
  DECLARE @SAYAC_BOYU INT = @UZUNLUK - LEN(@ONEK);
  IF @SAYAC_BOYU < 2 SET @SAYAC_BOYU = 2;
  DECLARE @IS_COLLISION BIT = 0;
  IF (@GEN_NO IS NULL OR LEN(LTRIM(RTRIM(@GEN_NO))) = 0) SET @IS_COLLISION = 1;
  ELSE IF EXISTS (SELECT 1 FROM dbo.TODVZ_FATURA WHERE FATURA_NO = @GEN_NO AND (@CURRENT_FID = 0 OR FATURA_ID <> @CURRENT_FID)) SET @IS_COLLISION = 1;
  IF @IS_COLLISION = 1
  BEGIN
    DECLARE @SON_SIRA INT = 0;
    SELECT @SON_SIRA = ISNULL(MAX(TRY_CAST(RIGHT(FATURA_NO, @SAYAC_BOYU) AS INT)), 0) FROM dbo.TODVZ_FATURA
      WHERE LEN(FATURA_NO) = @UZUNLUK AND LEFT(FATURA_NO, LEN(@ONEK)) = @ONEK AND (@CURRENT_FID = 0 OR FATURA_ID <> @CURRENT_FID);
    IF OBJECT_ID('dbo.TODVZ_EBELGE_GIDEN') IS NOT NULL
      EXEC sp_executesql N'SELECT @s = ISNULL(MAX(TRY_CAST(RIGHT(BELGE_NO, @b) AS INT)), @s) FROM dbo.TODVZ_EBELGE_GIDEN WHERE LEN(BELGE_NO) = @u AND LEFT(BELGE_NO, LEN(@o)) = @o AND TRY_CAST(RIGHT(BELGE_NO, @b) AS INT) > @s',
        N'@s INT OUTPUT, @b INT, @u INT, @o VARCHAR(20)', @s = @SON_SIRA OUTPUT, @b = @SAYAC_BOYU, @u = @UZUNLUK, @o = @ONEK;
    IF @SON_SIRA + 1 > @SAYAC SET @SAYAC = @SON_SIRA + 1;
    DECLARE @EXISTS BIT = 1;
    DECLARE @GIDEN_VAR BIT = 0;
    WHILE @EXISTS = 1
    BEGIN
      DECLARE @NUM_S VARCHAR(20) = STR(@SAYAC, @SAYAC_BOYU, 0);
      IF @ONUNE_SIFIR = 1 SET @NUM_S = REPLACE(@NUM_S, ' ', '0');
      SET @GEN_NO = RTRIM(@ONEK) + LTRIM(@NUM_S);
      SET @GIDEN_VAR = 0;
      IF OBJECT_ID('dbo.TODVZ_EBELGE_GIDEN') IS NOT NULL
        EXEC sp_executesql N'SELECT @v = CASE WHEN EXISTS (SELECT 1 FROM dbo.TODVZ_EBELGE_GIDEN WHERE BELGE_NO = @n) THEN 1 ELSE 0 END',
          N'@v BIT OUTPUT, @n VARCHAR(50)', @v = @GIDEN_VAR OUTPUT, @n = @GEN_NO;
      IF EXISTS (SELECT 1 FROM dbo.TODVZ_FATURA WHERE FATURA_NO = @GEN_NO AND (@CURRENT_FID = 0 OR FATURA_ID <> @CURRENT_FID)) OR @GIDEN_VAR = 1
        SET @SAYAC = @SAYAC + 1;
      ELSE SET @EXISTS = 0;
    END;
    IF OBJECT_ID('dbo.TODVZ_NUMERATOR') IS NOT NULL UPDATE dbo.TODVZ_NUMERATOR SET BASLANGIC = @SAYAC + 1 WHERE TUR = @TARGET_TUR;
  END
  ELSE IF OBJECT_ID('dbo.TODVZ_NUMERATOR') IS NOT NULL
    UPDATE dbo.TODVZ_NUMERATOR SET BASLANGIC = BASLANGIC + 1
    WHERE TUR = @TARGET_TUR AND @GEN_NO = RTRIM(@ONEK) + LTRIM(REPLACE(STR(@SAYAC, @SAYAC_BOYU, 0), ' ', '0'));
  SELECT @GEN_NO AS GENERATED_FATURA_NO;`;

export class TicariSatisSqlRepository {
  static async siradakiNo(senaryo: string | null | undefined, ctx?: DbBaglam): Promise<string> {
    const s = temiz(senaryo).toUpperCase() || "EARSIVFATURA";
    const onEk = await PerakendeSqlRepository.numaratorOnEki(1, s, ctx);
    return PerakendeSqlRepository.getNextFaturaNo(onEk, ctx);
  }

  /** Fişi düzeltilebilir / silinebilir mi: Ticari fişi olmalı, e-Belge'ye iletilmemiş olmalı */
  private static async duzeltilebilir(tx: sql.Transaction, id: number): Promise<void> {
    const r = await new sql.Request(tx).input("ID", sql.Int, id)
      .query(`SELECT ISNULL(FIS_KAYNAGI, 0) AS K, ISNULL(E_BELGE_DURUMU, 0) AS D, FATURA_NO FROM dbo.TODVZ_FATURA WITH (UPDLOCK) WHERE FATURA_ID = @ID`);
    const f = r.recordset[0];
    if (!f) throw ApiError.notFound("Satış fişi bulunamadı.");
    if (Number(f.K) !== FIS_KAYNAGI_TICARI) throw ApiError.badRequest("Bu fiş Ticari satış fişi değil; Perakende ekranından düzeltin.");
    if (Number(f.D) === 1 || Number(f.D) === 2) {
      throw ApiError.badRequest(`${temiz(f.FATURA_NO)} numaralı fiş e-Belge olarak iletildi; düzeltilemez ve silinemez (gerekirse e-Belge iptali yapılır).`);
    }
  }

  /** Fişin stok hareketlerini, ödemelerin vezne etkisini ve satır / ödemelerini kaldırır */
  private static async etkiyiKaldir(tx: sql.Transaction, id: number): Promise<void> {
    await new sql.Request(tx).input("FID", sql.Int, id).query(ODEME_VEZNE_GERI_AL);
    await new sql.Request(tx).input("ID", sql.Int, id).input("TUR", sql.TinyInt, STOK_BELGE.SATIS).query(`
      DELETE FROM dbo.TODVZ_STOK_HAREKET WHERE BELGE_TURU = @TUR AND BELGE_ID = @ID;
      DELETE FROM dbo.TODVZ_FATURA_ODEME WHERE FATURA_ID = @ID;
      DELETE FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @ID;`);
  }

  static async kaydet(girdi: TicariSatisGirdi, kullaniciId: number | undefined, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const serbestMi = (s: TicariSatisSatirGirdi) => !(Number(s.stokKartId) > 0);
    const satirGirdi = (girdi.satirlar || []).filter((s) => s && (Number(s.stokKartId) > 0 || temiz(s.urunAdi)));
    if (!satirGirdi.length) throw ApiError.badRequest("Fişte en az bir ürün satırı olmalı.");
    const tarih = girdi.tarih ? new Date(girdi.tarih) : new Date();
    if (Number.isNaN(tarih.getTime())) throw ApiError.badRequest("Fiş tarihi okunamadı.");
    const senaryo = temiz(girdi.senaryo).toUpperCase() || "EARSIVFATURA";
    const vkn = (temiz(girdi.aliciVknTckn) || "11111111111").replace(/\D/g, "");
    if (vkn.length !== 10 && vkn.length !== 11) throw ApiError.badRequest("Alıcı VKN (10 hane) ya da TCKN (11 hane) olmalı.");
    const unvan = temiz(girdi.aliciUnvan) || "NİHAİ TÜKETİCİ";
    const vezneId = Number(girdi.vezneId) || 1;
    const id0 = Number(girdi.faturaId) || 0;

    // Kartlar: ad, birim, KDV karttan; fiyat girilmemişse karttan (KDV dahile çevrilerek)
    const kartIdler = [...new Set(satirGirdi.filter((s) => !serbestMi(s)).map((s) => Number(s.stokKartId)))];
    const fiyatListesiId = Number(girdi.fiyatListesiId) || null;
    if (fiyatListesiId) {
      const l = await pool.request().input("L", sql.Int, fiyatListesiId).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_FIYAT_LISTESI WHERE FIYAT_LISTESI_ID = @L`);
      if (!l.recordset.length) throw ApiError.badRequest("Seçilen fiyat listesi bulunamadı.");
    }
    const kr = kartIdler.length
      ? await pool.request().input("LISTE", sql.Int, fiyatListesiId).query(`
          SELECT K.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, K.BIRIM, K.KDV_ORANI, COALESCE(LF.FIYAT, K.SATIS_FIYATI) AS SATIS_FIYATI, K.FIYAT_KDV_DAHIL, K.AKTIF, K.STOK_GRUP_ID
          FROM dbo.TODVZ_STOK_KART K LEFT JOIN dbo.TODVZ_STOK_KART_FIYAT LF ON LF.STOK_KART_ID = K.STOK_KART_ID AND LF.FIYAT_LISTESI_ID = @LISTE
          WHERE K.STOK_KART_ID IN (${kartIdler.join(",")})`)
      : { recordset: [] as any[] };
    const kartlar = new Map<number, any>(kr.recordset.map((x: any) => [x.STOK_KART_ID, x]));
    const hesapGirdisi = satirGirdi.map((s, i) => {
      if (serbestMi(s)) {
        const kdvOrani = sayi(s.kdvOrani);
        if (!GECERLI_KDV_ORANLARI.includes(kdvOrani)) throw ApiError.badRequest(`${i + 1}. satırdaki serbest ürünün KDV oranı geçersiz.`);
        const fiyat = sayi(s.kdvDahilFiyat);
        if (!(fiyat > 0)) throw ApiError.badRequest(`${i + 1}. satırdaki serbest ürünün fiyatı girilmeli.`);
        if (temiz(s.urunAdi).length > 200) throw ApiError.badRequest(`${i + 1}. satırdaki ürün adı en çok 200 karakter olabilir.`);
        return { miktar: sayi(s.miktar), kdvDahilFiyat: fiyat, kdvOrani, iskontoTuru: (Number(s.iskontoTuru) || 0) as IskontoTuru, iskontoDegeri: sayi(s.iskontoDegeri) };
      }
      const k = kartlar.get(Number(s.stokKartId));
      if (!k) throw ApiError.badRequest(`${i + 1}. satırdaki stok kartı bulunamadı.`);
      if (!(k.AKTIF === true || k.AKTIF === 1)) throw ApiError.badRequest(`${i + 1}. satırdaki "${temiz(k.AD)}" kartı pasif; satılamaz.`);
      const kdvOrani = Number(k.KDV_ORANI) || 0;
      const kartFiyati = Number(k.SATIS_FIYATI) || 0;
      const varsayilan = k.FIYAT_KDV_DAHIL === true || k.FIYAT_KDV_DAHIL === 1 ? kartFiyati : kartFiyati * (1 + kdvOrani / 100);
      const fiyat = s.kdvDahilFiyat === null || s.kdvDahilFiyat === undefined || temiz(s.kdvDahilFiyat) === "" ? varsayilan : sayi(s.kdvDahilFiyat);
      return { miktar: sayi(s.miktar), kdvDahilFiyat: fiyat, kdvOrani, iskontoTuru: (Number(s.iskontoTuru) || 0) as IskontoTuru, iskontoDegeri: sayi(s.iskontoDegeri) };
    });
    let hesap;
    try {
      hesap = ticariFisHesapla(hesapGirdisi, { turu: (Number(girdi.iskontoTuru) || 0) as IskontoTuru, deger: sayi(girdi.iskontoDegeri) });
    } catch (e: any) {
      throw ApiError.badRequest(e?.message || "Fiş hesaplanamadı.");
    }

    // Ödeme toplamı fazla olamaz (Perakende'deki kural)
    const odemeler = (girdi.odemeler || []).filter((o) => sayi(o.tutar) > 0 || o.cariKartId);
    const odemeToplami = Math.round(odemeler.reduce((a, o) => a + sayi(o.tutar), 0) * 100) / 100;
    if (odemeToplami - hesap.genelToplam > 0.05) {
      throw ApiError.badRequest(`Ödeme toplamı (${odemeToplami.toFixed(2)}) fiş toplamından (${hesap.genelToplam.toFixed(2)}) fazla.`);
    }
    for (const o of odemeler) {
      if (Number(o.odemeAraciTuru) === 1 && !o.cariKartId) throw ApiError.badRequest("Cari ödeme satırında cari seçilmeli.");
    }

    const onEk = await PerakendeSqlRepository.numaratorOnEki(1, senaryo, ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    let faturaId = id0;
    let uyari: string | null = null;
    try {
      let eskiKartlar: number[] = [];
      if (id0) {
        await this.duzeltilebilir(tx, id0);
        eskiKartlar = (await new sql.Request(tx).input("ID", sql.Int, id0).query(`SELECT DISTINCT STOK_KART_ID FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @ID AND STOK_KART_ID IS NOT NULL`)).recordset.map((x: any) => Number(x.STOK_KART_ID));
      }
      const onceki = await bakiyeler(tx, [...kartIdler, ...eskiKartlar]);

      const no = await new sql.Request(tx)
        .input("IN_FATURA_ID", sql.Int, id0)
        .input("IN_FATURA_NO", sql.VarChar(50), temiz(girdi.faturaNo) || null)
        .input("IN_SENARYO", sql.VarChar(50), senaryo)
        .input("IN_PREFIX", sql.VarChar(10), onEk)
        .query(NUMARA_URET);
      const faturaNo = temiz(no.recordset[0]?.GENERATED_FATURA_NO) || `${onEk}${tarih.getFullYear()}000000001`;

      if (id0) await this.etkiyiKaldir(tx, id0);

      const bas = new sql.Request(tx)
        .input("ID", sql.Int, id0)
        .input("VEZNE_ID", sql.Int, vezneId)
        .input("FATURA_NO", sql.VarChar(50), faturaNo)
        .input("TARIH", sql.DateTime, tarih)
        .input("SENARYO", sql.VarChar(50), senaryo)
        .input("CARI_KART_ID", sql.Int, Number(girdi.cariKartId) || null)
        .input("VKN", sql.VarChar(50), vkn)
        .input("UNVAN", sql.VarChar(250), unvan.slice(0, 250))
        .input("ADRES", sql.VarChar(500), temiz(girdi.adres).slice(0, 500) || null)
        .input("ILCE", sql.VarChar(100), temiz(girdi.ilce).slice(0, 100) || null)
        .input("IL", sql.VarChar(100), temiz(girdi.il).slice(0, 100) || null)
        .input("VD", sql.VarChar(100), temiz(girdi.vergiDairesi).slice(0, 100) || null)
        .input("EPOSTA", sql.VarChar(100), temiz(girdi.eposta).slice(0, 100) || null)
        .input("TELEFON", sql.VarChar(50), temiz(girdi.telefon).slice(0, 50) || null)
        .input("ARA", sql.Float, hesap.matrah)
        .input("KDV", sql.Float, hesap.toplamKdv)
        .input("ISK_ID", sql.Int, Number(girdi.iskontoId) || null)
        .input("ISK_KOD", sql.VarChar(50), temiz(girdi.iskontoKodu).slice(0, 50) || null)
        .input("ISK_ORAN", sql.Float, Number(girdi.iskontoTuru) === 1 ? sayi(girdi.iskontoDegeri) : 0)
        .input("ISK_TUTAR", sql.Float, hesap.baslikIskontoDahil)
        .input("GENEL", sql.Float, hesap.genelToplam)
        .input("KUL", sql.Int, kullaniciId || null)
        .input("KAYNAK", sql.TinyInt, FIS_KAYNAGI_TICARI)
        .input("LISTE", sql.Int, fiyatListesiId);
      if (id0) {
        await bas.query(`UPDATE dbo.TODVZ_FATURA SET VEZNE_ID = @VEZNE_ID, FATURA_NO = @FATURA_NO, TARIH = @TARIH, FATURA_TIPI = 1, SENARYO = @SENARYO,
          CARI_KART_ID = @CARI_KART_ID, ALICI_VKN_TCKN = @VKN, ALICI_UNVAN = @UNVAN, ADRES = @ADRES, ILCE = @ILCE, IL = @IL, VERGI_DAIRESI = @VD,
          EPOSTA = @EPOSTA, TELEFON = @TELEFON, PARA_ID = ISNULL((SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID), 1),
          KUR = 1, ARA_TOPLAM = @ARA, TOPLAM_KDV = @KDV, ISKONTO_ID = @ISK_ID, ISKONTO_KODU = @ISK_KOD, ISKONTO_ORANI = @ISK_ORAN, ISKONTO_TUTARI = @ISK_TUTAR,
          GENEL_TOPLAM = @GENEL, FIS_KAYNAGI = @KAYNAK, FIYAT_LISTESI_ID = @LISTE, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE()
          WHERE FATURA_ID = @ID`);
      } else {
        const r = await bas.query(`INSERT INTO dbo.TODVZ_FATURA (VEZNE_ID, FATURA_NO, ETTN, TARIH, FATURA_TIPI, SENARYO, CARI_KART_ID, ALICI_VKN_TCKN, ALICI_UNVAN,
            ADRES, ILCE, IL, VERGI_DAIRESI, EPOSTA, TELEFON, PARA_ID, KUR, ARA_TOPLAM, TOPLAM_KDV, ISKONTO_ID, ISKONTO_KODU, ISKONTO_ORANI, ISKONTO_TUTARI,
            GENEL_TOPLAM, E_BELGE_DURUMU, EKLEYEN_ID, EKLEME_ZAMANI, FIS_KAYNAGI, FIYAT_LISTESI_ID)
          OUTPUT INSERTED.FATURA_ID
          VALUES (@VEZNE_ID, @FATURA_NO, NEWID(), @TARIH, 1, @SENARYO, @CARI_KART_ID, @VKN, @UNVAN, @ADRES, @ILCE, @IL, @VD, @EPOSTA, @TELEFON,
            ISNULL((SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID), 1), 1, @ARA, @KDV,
            @ISK_ID, @ISK_KOD, @ISK_ORAN, @ISK_TUTAR, @GENEL, 0, @KUL, GETDATE(), @KAYNAK, @LISTE)`);
        faturaId = r.recordset[0].FATURA_ID;
      }

      for (let i = 0; i < hesap.satirlar.length; i++) {
        const h = hesap.satirlar[i];
        const serbest = serbestMi(satirGirdi[i]);
        const k = serbest ? null : kartlar.get(Number(satirGirdi[i].stokKartId));
        const ad = serbest ? temiz(satirGirdi[i].urunAdi) : temiz(k.AD);
        const birim = (serbest ? birimAdiDuzelt(satirGirdi[i].birim) : temiz(k.BIRIM)) || "Adet";
        // Kampanya (İş 11, G12): yürürlükte ve kartı kapsıyor olmalı; satır iskontosu kampanyanınkiyle aynı olmalı
        const kampanyaId = Number(satirGirdi[i].kampanyaId) || null;
        if (kampanyaId) {
          if (!k) throw ApiError.badRequest(`${i + 1}. satır: serbest ürüne kampanya uygulanmaz.`);
          const kmp = await TicariKampanyaSqlRepository.satirKampanyasiniDogrula(tx, kampanyaId, Number(k.STOK_KART_ID), k.STOK_GRUP_ID ?? null);
          if (Number(h.iskontoTuru) !== kmp.turu || Math.abs(Number(h.iskontoDegeri) - kmp.degeri) > 0.000001) throw ApiError.badRequest(`${i + 1}. satırdaki kampanya indirimi güncel değil; fişi yeniden fiyatlayın.`);
        }
        await new sql.Request(tx)
          .input("FID", sql.Int, faturaId).input("NO", sql.Int, i + 1).input("KART", sql.Int, k ? k.STOK_KART_ID : null).input("KMP", sql.Int, kampanyaId)
          .input("AD", sql.VarChar(200), ad.slice(0, 200)).input("M", sql.Float, h.miktar).input("BIRIM", sql.VarChar(20), birim)
          .input("BF", sql.Float, h.birimFiyat).input("T", sql.Float, h.tutar).input("KO", sql.Float, h.kdvOrani).input("KT", sql.Float, h.kdvTutari)
          .input("TT", sql.Float, h.toplamTutar).input("DF", sql.Float, h.kdvDahilFiyat)
          .input("IT", sql.TinyInt, h.iskontoTuru || null).input("ID", sql.Float, h.iskontoTuru ? h.iskontoDegeri : null).input("IST", sql.Float, h.iskontoTutari)
          .input("TARIH", sql.DateTime, tarih).input("TUR", sql.TinyInt, STOK_BELGE.SATIS).input("KUL", sql.Int, kullaniciId || null)
          .query(`INSERT INTO dbo.TODVZ_FATURA_SATIRI (FATURA_ID, SATIR_NO, ALTIN_URUN_ID, BARKOD, URUN_ADI, AYAR, MIKTAR, BIRIM, GRAM, HAS_GRAM, BIRIM_FIYAT, TUTAR,
              KDV_ORANI, KDV_TUTARI, TOPLAM_TUTAR, STOK_KART_ID, KDV_DAHIL_FIYAT, SATIR_ISKONTO_TURU, SATIR_ISKONTO_DEGERI, SATIR_ISKONTO_TUTARI, KAMPANYA_ID)
            VALUES (@FID, @NO, NULL, NULL, @AD, NULL, @M, @BIRIM, 0, 0, @BF, @T, @KO, @KT, @TT, @KART, @DF, @IT, @ID, @IST, @KMP);
            IF @KART IS NOT NULL
              INSERT INTO dbo.TODVZ_STOK_HAREKET (STOK_KART_ID, TARIH, BELGE_TURU, BELGE_ID, SATIR_NO, GIRIS, CIKIS, BIRIM_FIYAT, EKLEYEN_ID)
              VALUES (@KART, @TARIH, @TUR, @FID, @NO, 0, @M, @BF, @KUL);`);
      }

      const posTablosu = (await new sql.Request(tx).query(`SELECT OBJECT_ID('dbo.TODVZ_POS_CIHAZI', 'U') AS V`)).recordset[0]?.V != null;
      let sira = 1;
      for (const o of odemeler) {
        const oat = Number(o.odemeAraciTuru) || 0;
        const iy = oat === 1 ? 1 : oat === 2 ? 3 : oat === 3 ? 2 : 0;
        const tutar = sayi(o.tutar);
        const kur = sayi(o.kur) > 0 ? sayi(o.kur) : 1;
        await new sql.Request(tx)
          .input("FATURA_ID", sql.Int, faturaId).input("SATIR_NO", sql.Int, sira++).input("ODEME_ARACI_TURU", sql.TinyInt, oat).input("ISLEME_YERI", sql.TinyInt, iy)
          .input("CARI_KART_ID", sql.Int, oat === 1 || oat === 3 ? Number(o.cariKartId) || null : null)
          .input("POS_CIHAZI_ID", sql.Int, oat === 2 ? Number(o.posCihaziId) || null : null)
          .input("CARI_KOD", sql.VarChar(50), temiz(o.cariKod).slice(0, 50) || null)
          .input("CARI_UNVAN", sql.VarChar(250), temiz(o.cariUnvan).slice(0, 250) || null)
          .input("PARA_ID", sql.Int, Number(o.paraId) || null)
          .input("PARA_KODU", sql.VarChar(50), temiz(o.paraKodu) || "TL")
          .input("PARA_ADI", sql.VarChar(100), temiz(o.paraAdi).slice(0, 100))
          .input("MIKTAR", sql.Float, o.miktar === null || o.miktar === undefined ? (kur === 1 ? tutar : null) : sayi(o.miktar))
          .input("KUR", sql.Float, kur).input("TUTAR", sql.Float, tutar)
          .query(`INSERT INTO dbo.TODVZ_FATURA_ODEME (FATURA_ID, SATIR_NO, ODEME_ARACI_TURU, ISLEME_YERI, CARI_KART_ID, POS_CIHAZI_ID, CARI_KOD, CARI_UNVAN,
              PARA_ID, PARA_KODU, PARA_ADI, ADET, MIKTAR, MILYEM, HAS_GRAM, KUR, TUTAR)
            VALUES (@FATURA_ID, @SATIR_NO, @ODEME_ARACI_TURU, @ISLEME_YERI, @CARI_KART_ID,
              ${posTablosu ? "COALESCE(@POS_CIHAZI_ID, (SELECT TOP 1 POS_CIHAZI_ID FROM dbo.TODVZ_POS_CIHAZI WHERE @ODEME_ARACI_TURU = 2 AND UPPER(LTRIM(RTRIM(KOD))) = UPPER(@CARI_KOD)))" : "@POS_CIHAZI_ID"},
              @CARI_KOD, @CARI_UNVAN,
              COALESCE(@PARA_ID, (SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE UPPER(LTRIM(RTRIM(KOD))) = UPPER(@PARA_KODU)), 1),
              @PARA_KODU, @PARA_ADI, NULL, @MIKTAR, NULL, NULL, @KUR, @TUTAR)`);
      }

      // Vezneden tahsilat vezne bakiyesine işlenir (Perakende'deki kural)
      await new sql.Request(tx).input("FID", sql.Int, faturaId).query(`
        DECLARE @TV INT, @TT INT;
        SELECT @TV = VEZNE_ID, @TT = FATURA_TIPI FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @FID;
        IF @TV IS NOT NULL AND @TV > 0
        BEGIN
          UPDATE O SET VEZNE_ISLENDI = 1 FROM dbo.TODVZ_FATURA_ODEME O JOIN dbo.TODVZ_PARA P ON P.PARA_ID = O.PARA_ID
            WHERE O.FATURA_ID = @FID AND ISNULL(O.ODEME_ARACI_TURU, 0) = 0 AND ISNULL(O.ISLEME_YERI, 0) = 0 AND ISNULL(NULLIF(O.MIKTAR, 0), O.TUTAR / NULLIF(O.KUR, 0)) <> 0;
          DECLARE @TE TABLE (PARA_ID INT, M FLOAT);
          INSERT INTO @TE (PARA_ID, M)
            SELECT O.PARA_ID, SUM(CASE WHEN @TT = 1 THEN 1 ELSE -1 END * ISNULL(NULLIF(O.MIKTAR, 0), O.TUTAR / NULLIF(O.KUR, 0)))
            FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID = @FID AND ISNULL(O.VEZNE_ISLENDI, 0) = 1 GROUP BY O.PARA_ID;
          UPDATE B SET MIKTAR = B.MIKTAR + E.M FROM dbo.TODVZ_VEZNE_BAKIYE B JOIN @TE E ON E.PARA_ID = B.PARA_ID WHERE B.VEZNE_ID = @TV;
          INSERT INTO dbo.TODVZ_VEZNE_BAKIYE (VEZNE_ID, PARA_ID, MIKTAR)
            SELECT @TV, E.PARA_ID, E.M FROM @TE E WHERE NOT EXISTS (SELECT 1 FROM dbo.TODVZ_VEZNE_BAKIYE B WHERE B.VEZNE_ID = @TV AND B.PARA_ID = E.PARA_ID);
        END;`);

      const eksi = await eksiStokDenetle(tx, onceki, girdi.eksiStokOnay);
      if (eksi.length) uyari = `Eksiye düşen stok: ${eksi.map((k) => `${k.kod} ${k.ad} (${k.sonraki.toLocaleString("tr-TR")} ${k.birim})`).join(", ")}`;
      await tx.commit();
    } catch (e: any) {
      await tx.rollback().catch(() => undefined);
      if (!(e instanceof ApiError)) logger.error("TicariSatisSqlRepository.kaydet", { message: e?.message, stack: e?.stack });
      throw e;
    }
    return { fis: await this.getir(faturaId, ctx), uyari };
  }

  static async sil(id: number, ctx?: DbBaglam): Promise<void> {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    // GİB'e gönderilmiş (e-Belge giden kaydı gönderildi/kuyrukta) fiş hiçbir ekrandan silinemez — döviz fişiyle aynı kural
    await gibeGonderildiyseEngelle(pool, EVRAK_TURU_PERAKENDE, id, "ticari satış fişi");
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await this.duzeltilebilir(tx, id);
      await this.etkiyiKaldir(tx, id);
      await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @ID`);
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
  }

  static async getir(id: number, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    // Başlık ve ödemeler (Perakende'nin okumasıyla aynı alanlar; barkodlu ürün tablosuna bağlı değil)
    const posTablosu = (await pool.request().query(`SELECT OBJECT_ID('dbo.TODVZ_POS_CIHAZI', 'U') AS V`)).recordset[0]?.V != null;
    const b = await pool.request().input("ID", sql.Int, id).query(`
      SELECT F.*, RTRIM(V.KOD) AS VEZNE_KOD, V.AD AS VEZNE_AD, RTRIM(P.KOD) AS PARA_KODU, RTRIM(C.KOD) AS CARI_KOD, C.AD AS CARI_UNVAN
      FROM dbo.TODVZ_FATURA F LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID = F.VEZNE_ID LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID = F.PARA_ID
      LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = F.CARI_KART_ID
      WHERE F.FATURA_ID = @ID AND ISNULL(F.FIS_KAYNAGI, 0) = ${FIS_KAYNAGI_TICARI};
      SELECT O.FATURA_ODEME_ID, O.SATIR_NO, O.ODEME_ARACI_TURU, O.ISLEME_YERI, O.CARI_KART_ID, O.POS_CIHAZI_ID,
        ISNULL(NULLIF(RTRIM(O.CARI_KOD), ''), ISNULL(${posTablosu ? "RTRIM(PC.KOD)" : "NULL"}, ISNULL(RTRIM(C.KOD), ''))) AS CARI_KOD,
        ISNULL(NULLIF(RTRIM(O.CARI_UNVAN), ''), ISNULL(${posTablosu ? "RTRIM(PC.AD)" : "NULL"}, ISNULL(RTRIM(C.AD), ''))) AS CARI_UNVAN,
        O.PARA_ID, O.PARA_KODU, O.PARA_ADI, O.MIKTAR, O.KUR, O.TUTAR
      FROM dbo.TODVZ_FATURA_ODEME O
      LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = O.CARI_KART_ID
      ${posTablosu ? "LEFT JOIN dbo.TODVZ_POS_CIHAZI PC ON PC.POS_CIHAZI_ID = O.POS_CIHAZI_ID" : ""}
      WHERE O.FATURA_ID = @ID ORDER BY O.SATIR_NO;`);
    const bs = b.recordsets as any[];
    const f = bs[0]?.[0];
    if (!f) return null;
    const fis = {
      faturaId: f.FATURA_ID,
      vezneId: f.VEZNE_ID,
      vezneKod: f.VEZNE_KOD ? temiz(f.VEZNE_KOD) : null,
      vezneAd: f.VEZNE_AD ? temiz(f.VEZNE_AD) : null,
      faturaNo: temiz(f.FATURA_NO),
      ettn: String(f.ETTN || ""),
      tarih: new Date(f.TARIH).toISOString(),
      faturaTipi: Number(f.FATURA_TIPI) || 1,
      senaryo: temiz(f.SENARYO) || "EARSIVFATURA",
      cariKartId: f.CARI_KART_ID ?? null,
      cariKod: f.CARI_KOD ? temiz(f.CARI_KOD) : null,
      cariUnvan: f.CARI_UNVAN ? temiz(f.CARI_UNVAN) : null,
      aliciVknTckn: temiz(f.ALICI_VKN_TCKN),
      aliciUnvan: temiz(f.ALICI_UNVAN),
      adres: f.ADRES ? temiz(f.ADRES) : null,
      ilce: f.ILCE ? temiz(f.ILCE) : null,
      il: f.IL ? temiz(f.IL) : null,
      vergiDairesi: f.VERGI_DAIRESI ? temiz(f.VERGI_DAIRESI) : null,
      eposta: f.EPOSTA ? temiz(f.EPOSTA) : null,
      telefon: f.TELEFON ? temiz(f.TELEFON) : null,
      paraId: f.PARA_ID,
      paraKodu: f.PARA_KODU ? temiz(f.PARA_KODU) : "TL",
      fiyatListesiId: f.FIYAT_LISTESI_ID ?? null,
      kur: Number(f.KUR) || 1,
      araToplam: Number(f.ARA_TOPLAM) || 0,
      toplamKdv: Number(f.TOPLAM_KDV) || 0,
      iskontoId: f.ISKONTO_ID ?? null,
      iskontoKodu: f.ISKONTO_KODU ? temiz(f.ISKONTO_KODU) : null,
      iskontoOrani: Number(f.ISKONTO_ORANI) || 0,
      iskontoTutari: Number(f.ISKONTO_TUTARI) || 0,
      genelToplam: Number(f.GENEL_TOPLAM) || 0,
      eBelgeDurumu: Number(f.E_BELGE_DURUMU) || 0,
      gibStatuKodu: f.GIB_STATU_KODU ? temiz(f.GIB_STATU_KODU) : null,
      ekleyenId: f.EKLEYEN_ID ?? null,
      eklemeZamani: f.EKLEME_ZAMANI ? new Date(f.EKLEME_ZAMANI).toISOString() : null,
      odemeler: (bs[1] || []).map((o: any) => ({
        faturaOdemeId: o.FATURA_ODEME_ID,
        satirNo: o.SATIR_NO,
        odemeAraciTuru: Number(o.ODEME_ARACI_TURU) || 0,
        islemeYeri: Number(o.ISLEME_YERI) || 0,
        cariKartId: o.CARI_KART_ID ?? null,
        posCihaziId: o.POS_CIHAZI_ID ?? null,
        cariKod: temiz(o.CARI_KOD),
        cariUnvan: temiz(o.CARI_UNVAN),
        paraId: o.PARA_ID ?? null,
        paraKodu: temiz(o.PARA_KODU) || "TL",
        paraAdi: temiz(o.PARA_ADI),
        miktar: o.MIKTAR === null || o.MIKTAR === undefined ? null : Number(o.MIKTAR),
        kur: Number(o.KUR) || 1,
        tutar: Number(o.TUTAR) || 0,
      })),
    };
    const s = await pool.request().input("ID", sql.Int, id).query(`
      SELECT S.SATIR_NO, S.STOK_KART_ID, RTRIM(K.KOD) AS KOD, S.URUN_ADI, S.MIKTAR, S.BIRIM, S.BIRIM_FIYAT, S.TUTAR, S.KDV_ORANI, S.KDV_TUTARI, S.TOPLAM_TUTAR, S.KAMPANYA_ID,
        S.KDV_DAHIL_FIYAT, S.SATIR_ISKONTO_TURU, S.SATIR_ISKONTO_DEGERI, S.SATIR_ISKONTO_TUTARI,
        (SELECT TOP 1 B.BARKOD FROM dbo.TODVZ_STOK_BARKOD B WHERE B.STOK_KART_ID = S.STOK_KART_ID ORDER BY B.STOK_BARKOD_ID) AS BARKOD
      FROM dbo.TODVZ_FATURA_SATIRI S LEFT JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID
      WHERE S.FATURA_ID = @ID ORDER BY S.SATIR_NO`);
    const satirlar = s.recordset.map((x: any) => {
      const miktar = Number(x.MIKTAR) || 0;
      const dahil = Number(x.KDV_DAHIL_FIYAT) || 0;
      const brut = Math.round(miktar * dahil * 100) / 100;
      return {
        satirNo: x.SATIR_NO,
        stokKartId: x.STOK_KART_ID,
        kod: temiz(x.KOD),
        barkod: temiz(x.BARKOD),
        urunAdi: temiz(x.URUN_ADI),
        miktar,
        birim: temiz(x.BIRIM),
        kdvDahilFiyat: dahil,
        kdvOrani: Number(x.KDV_ORANI) || 0,
        iskontoTuru: Number(x.SATIR_ISKONTO_TURU) || 0,
        iskontoDegeri: x.SATIR_ISKONTO_DEGERI === null || x.SATIR_ISKONTO_DEGERI === undefined ? null : Number(x.SATIR_ISKONTO_DEGERI),
        birimFiyat: Number(x.BIRIM_FIYAT) || 0,
        tutar: Number(x.TUTAR) || 0,
        iskontoTutari: Number(x.SATIR_ISKONTO_TUTARI) || 0,
        matrah: Math.round(((Number(x.TUTAR) || 0) - (Number(x.SATIR_ISKONTO_TUTARI) || 0)) * 100) / 100,
        kdvTutari: Number(x.KDV_TUTARI) || 0,
        toplamTutar: Number(x.TOPLAM_TUTAR) || 0,
        brutDahil: brut,
        kampanyaId: x.KAMPANYA_ID ?? null,
      };
    });
    const iskontoTuru = Number(fis.iskontoOrani) > 0 ? 1 : Number(fis.iskontoTutari) > 0 ? 2 : 0;
    const brutDahil = Math.round(satirlar.reduce((a, x) => a + x.brutDahil, 0) * 100) / 100;
    return {
      ...fis,
      satirlar,
      iskontoTuru,
      iskontoDegeri: iskontoTuru === 1 ? Number(fis.iskontoOrani) : iskontoTuru === 2 ? Number(fis.iskontoTutari) : 0,
      brutDahil,
      toplamIskontoDahil: Math.round((brutDahil - Number(fis.genelToplam)) * 100) / 100,
    };
  }

  /** Ticari Satış Listesi (T16) */
  static async liste(f: { baslangic?: string | null; bitis?: string | null; arama?: string | null; eBelgeDurumu?: number | null; stokKartId?: number | null } = {}, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const req = pool.request();
    const kosul: string[] = [`ISNULL(F.FIS_KAYNAGI, 0) = ${FIS_KAYNAGI_TICARI}`];
    const gun = "CAST(DATEADD(hour, 3, F.TARIH) AS date)";
    if (f.baslangic) { req.input("BAS", sql.VarChar(10), temiz(f.baslangic).slice(0, 10)); kosul.push(`${gun} >= CAST(@BAS AS date)`); }
    if (f.bitis) { req.input("BIT", sql.VarChar(10), temiz(f.bitis).slice(0, 10)); kosul.push(`${gun} <= CAST(@BIT AS date)`); }
    if (f.eBelgeDurumu !== null && f.eBelgeDurumu !== undefined && !Number.isNaN(Number(f.eBelgeDurumu))) { req.input("D", sql.TinyInt, Number(f.eBelgeDurumu)); kosul.push("ISNULL(F.E_BELGE_DURUMU, 0) = @D"); }
    if (f.stokKartId) { req.input("KART", sql.Int, f.stokKartId); kosul.push("EXISTS (SELECT 1 FROM dbo.TODVZ_FATURA_SATIRI S WHERE S.FATURA_ID = F.FATURA_ID AND S.STOK_KART_ID = @KART)"); }
    if (f.arama && temiz(f.arama)) {
      req.input("ARA", sql.NVarChar(210), `%${temiz(f.arama)}%`);
      kosul.push(`(F.FATURA_NO LIKE @ARA OR F.ALICI_UNVAN LIKE @ARA OR F.ALICI_VKN_TCKN LIKE @ARA OR EXISTS (SELECT 1 FROM dbo.TODVZ_FATURA_SATIRI S WHERE S.FATURA_ID = F.FATURA_ID AND S.URUN_ADI LIKE @ARA))`);
    }
    const r = await req.query(`
      SELECT F.FATURA_ID, F.FATURA_NO, F.TARIH, F.SENARYO, F.ALICI_VKN_TCKN, F.ALICI_UNVAN, F.CARI_KART_ID, RTRIM(C.KOD) AS CARI_KOD,
        F.ARA_TOPLAM, F.TOPLAM_KDV, F.ISKONTO_TUTARI, F.GENEL_TOPLAM, ISNULL(F.E_BELGE_DURUMU, 0) AS E_BELGE_DURUMU, F.GIB_STATU_KODU,
        F.VEZNE_ID, RTRIM(V.KOD) AS VEZNE_KOD,
        (SELECT COUNT(*) FROM dbo.TODVZ_FATURA_SATIRI S WHERE S.FATURA_ID = F.FATURA_ID) AS SATIR_SAYISI,
        (SELECT ISNULL(SUM(ROUND(S.MIKTAR * ISNULL(S.KDV_DAHIL_FIYAT, 0), 2)), 0) FROM dbo.TODVZ_FATURA_SATIRI S WHERE S.FATURA_ID = F.FATURA_ID) AS BRUT,
        (SELECT ISNULL(SUM(O.TUTAR), 0) FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID = F.FATURA_ID AND ISNULL(O.ODEME_ARACI_TURU, 0) = 0) AS NAKIT,
        (SELECT ISNULL(SUM(O.TUTAR), 0) FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID = F.FATURA_ID AND O.ODEME_ARACI_TURU = 2) AS KART,
        (SELECT ISNULL(SUM(O.TUTAR), 0) FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID = F.FATURA_ID AND O.ODEME_ARACI_TURU = 1) AS CARI,
        (SELECT ISNULL(SUM(O.TUTAR), 0) FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID = F.FATURA_ID AND O.ODEME_ARACI_TURU = 3) AS HAVALE
      FROM dbo.TODVZ_FATURA F
      LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = F.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID = F.VEZNE_ID
      WHERE ${kosul.join(" AND ")}
      ORDER BY F.TARIH DESC, F.FATURA_ID DESC`);
    const p = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
    return r.recordset.map((x: any) => ({
      faturaId: x.FATURA_ID,
      faturaNo: temiz(x.FATURA_NO),
      tarih: new Date(x.TARIH).toISOString(),
      senaryo: temiz(x.SENARYO),
      aliciVknTckn: temiz(x.ALICI_VKN_TCKN),
      aliciUnvan: temiz(x.ALICI_UNVAN),
      cariKartId: x.CARI_KART_ID ?? null,
      cariKod: x.CARI_KOD ? temiz(x.CARI_KOD) : null,
      vezneId: x.VEZNE_ID ?? null,
      vezneKod: x.VEZNE_KOD ? temiz(x.VEZNE_KOD) : null,
      satirSayisi: Number(x.SATIR_SAYISI) || 0,
      brutDahil: p(x.BRUT),
      iskonto: p(Number(x.BRUT) - Number(x.GENEL_TOPLAM)),
      matrah: p(x.ARA_TOPLAM),
      toplamKdv: p(x.TOPLAM_KDV),
      genelToplam: p(x.GENEL_TOPLAM),
      nakit: p(x.NAKIT),
      kart: p(x.KART),
      cari: p(x.CARI),
      havale: p(x.HAVALE),
      eBelgeDurumu: Number(x.E_BELGE_DURUMU) || 0,
      gibStatuKodu: x.GIB_STATU_KODU ? temiz(x.GIB_STATU_KODU) : null,
    }));
  }

  /** Düzeltme ekranında ileri / geri gezinme için fiş kimlikleri (eskiden yeniye) */
  /** baslangic: kullanıcının işlem gösterme sınırı (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2) */
  static async kimlikler(ctx?: DbBaglam, baslangic?: string | null): Promise<{ faturaId: number; faturaNo: string }[]> {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const req = pool.request();
    let sinir = "";
    if (baslangic) {
      sinir = " AND TARIH >= CAST(@BAS AS date)";
      req.input("BAS", sql.VarChar(10), baslangic);
    }
    const r = await req.query(`SELECT FATURA_ID, FATURA_NO FROM dbo.TODVZ_FATURA WHERE ISNULL(FIS_KAYNAGI, 0) = ${FIS_KAYNAGI_TICARI}${sinir} ORDER BY FATURA_ID`);
    return r.recordset.map((x: any) => ({ faturaId: x.FATURA_ID, faturaNo: temiz(x.FATURA_NO) }));
  }
}

import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { logger } from "../../utils/logger.js";
import { PosMod } from "../../services/pos/pos.types.js";

// POS entegrasyonunun merkezi (LIKYA_ADMIN) kayıtları — docs/POS_ENTEGRASYON_YOL_HARITASI.md, 3.5
// Tablolar docs/sql/LIKYA_ADMIN_POS.sql ile elle kurulur (uygulama kullanıcısının tablo açma yetkisi yoktur).

/** Ham ayar satırı. Gizli alanlar şifreli haldedir; çözme işi servistedir. */
export interface PosMerkezAyarSatiri {
  tokenClientId: string | null;
  tokenClientSecretSifreli: string | null;
  tokenAuthUrl: string | null;
  tokenApiUrl: string | null;
  /** Bu sunucunun dışarıdan görünen adresi; cihaz sonuçları buraya bildirilir */
  donusKok: string | null;
  inposUygulamaNo: string | null;
  guncellemeTarihi: Date | null;
}

export interface PosMerkezAyarKaydet {
  tokenClientId: string | null;
  /** undefined → kayıtlı değer korunur */
  tokenClientSecretSifreli?: string | null;
  tokenAuthUrl: string | null;
  tokenApiUrl: string | null;
  donusKok: string | null;
  inposUygulamaNo: string | null;
}

export type DogrulamaSonucu = "GECTI" | "KALDI";

export interface PosDogrulamaSatiri {
  model: string;
  senaryoNo: number;
  sonuc: DogrulamaSonucu;
  notu: string | null;
  admin: string | null;
  tarih: Date;
}

export interface PosLogSatiri {
  logId: number;
  tarih: Date;
  tur: "ISTEK" | "DONUS";
  firmaId: number | null;
  firmaKodu: string | null;
  ozet: string;
  istek: string | null;
  yanit: string | null;
  basarili: boolean;
}

const metin = (v: unknown): string | null => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());

export class PosAdminSqlRepository {
  public static async ayarGetir(): Promise<PosMerkezAyarSatiri | null> {
    const pool = await getAdminPool();
    const r = (await pool.request().query(`SELECT TOP 1 * FROM dbo.ADM_POS_AYAR WHERE AYAR_ID = 1`)).recordset[0];
    if (!r) return null;
    return {
      tokenClientId: metin(r.TOKEN_CLIENT_ID),
      tokenClientSecretSifreli: r.TOKEN_CLIENT_SECRET_ENC || null,
      tokenAuthUrl: metin(r.TOKEN_AUTH_URL),
      tokenApiUrl: metin(r.TOKEN_API_URL),
      donusKok: metin(r.DONUS_KOK),
      inposUygulamaNo: metin(r.INPOS_UYGULAMA_NO),
      guncellemeTarihi: r.GUNCELLEME_TARIHI ?? null,
    };
  }

  public static async ayarKaydet(dto: PosMerkezAyarKaydet, adminId: number): Promise<void> {
    const pool = await getAdminPool();
    const req = pool.request();
    req.input("clientId", sql.VarChar(200), dto.tokenClientId);
    req.input("secretDegisti", sql.Bit, dto.tokenClientSecretSifreli !== undefined ? 1 : 0);
    req.input("secret", sql.VarChar(1000), dto.tokenClientSecretSifreli ?? null);
    req.input("authUrl", sql.VarChar(300), dto.tokenAuthUrl);
    req.input("apiUrl", sql.VarChar(300), dto.tokenApiUrl);
    req.input("donusKok", sql.VarChar(300), dto.donusKok);
    req.input("inposNo", sql.VarChar(50), dto.inposUygulamaNo);
    req.input("adminId", sql.Int, adminId);
    // Kimlik ya da adres değişince eski erişim anahtarı geçersizdir
    await req.query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.ADM_POS_AYAR WHERE AYAR_ID = 1) INSERT INTO dbo.ADM_POS_AYAR (AYAR_ID) VALUES (1);
      UPDATE dbo.ADM_POS_AYAR SET
        TOKEN_CLIENT_ID = @clientId,
        TOKEN_CLIENT_SECRET_ENC = CASE WHEN @secretDegisti = 1 THEN @secret ELSE TOKEN_CLIENT_SECRET_ENC END,
        TOKEN_AUTH_URL = @authUrl, TOKEN_API_URL = @apiUrl, DONUS_KOK = @donusKok, INPOS_UYGULAMA_NO = @inposNo,
        TOKEN_ERISIM_ENC = NULL, TOKEN_ERISIM_BITIS = NULL,
        GUNCELLEYEN_ADMIN_ID = @adminId, GUNCELLEME_TARIHI = GETDATE()
      WHERE AYAR_ID = 1;
    `);
  }

  /** Token'ın 24 saatlik erişim anahtarı (şifreli). Süresi veritabanı saatiyle denetlenir. */
  public static async erisimGetir(): Promise<string | null> {
    const pool = await getAdminPool();
    const r = (await pool.request().query(`SELECT TOKEN_ERISIM_ENC AS T FROM dbo.ADM_POS_AYAR WHERE AYAR_ID = 1 AND TOKEN_ERISIM_BITIS > GETDATE()`)).recordset[0];
    return r?.T || null;
  }

  public static async erisimYaz(sifreli: string | null, omurSaniye: number): Promise<void> {
    const pool = await getAdminPool();
    await pool
      .request()
      .input("t", sql.VarChar(sql.MAX), sifreli)
      .input("omur", sql.Int, omurSaniye)
      .query(`UPDATE dbo.ADM_POS_AYAR SET TOKEN_ERISIM_ENC = @t, TOKEN_ERISIM_BITIS = CASE WHEN @t IS NULL THEN NULL ELSE DATEADD(SECOND, @omur, GETDATE()) END WHERE AYAR_ID = 1`);
  }

  /** Firmanın POS modu; kaydı yoksa null (= kapalı, K19). */
  public static async firmaModu(firmaId: number): Promise<PosMod | null> {
    const pool = await getAdminPool();
    const r = (await pool.request().input("firmaId", sql.Int, firmaId).query(`SELECT [MOD] FROM dbo.ADM_POS_FIRMA WHERE FIRMA_ID = @firmaId`)).recordset[0];
    return r?.MOD === "test" || r?.MOD === "canli" ? r.MOD : r ? "kapali" : null;
  }

  public static async firmaModuYaz(firmaId: number, mod: PosMod, adminId: number): Promise<void> {
    const pool = await getAdminPool();
    await pool.request().input("firmaId", sql.Int, firmaId).input("mod", sql.VarChar(10), mod).input("adminId", sql.Int, adminId).query(`
      MERGE dbo.ADM_POS_FIRMA WITH (HOLDLOCK) AS hedef
      USING (SELECT @firmaId AS FIRMA_ID) AS kaynak ON hedef.FIRMA_ID = kaynak.FIRMA_ID
      WHEN MATCHED THEN UPDATE SET [MOD] = @mod, DEGISTIREN_ADMIN_ID = @adminId, DEGISTIRME_TARIHI = GETDATE()
      WHEN NOT MATCHED THEN INSERT (FIRMA_ID, [MOD], DEGISTIREN_ADMIN_ID) VALUES (@firmaId, @mod, @adminId);
    `);
  }

  /** POS modu Test ya da Canlı olan firmalar (test konsolunda seçmek için). */
  public static async acikFirmalar(): Promise<{ firmaId: number; firmaKodu: string; unvan: string; mod: PosMod }[]> {
    const pool = await getAdminPool();
    const rows = (
      await pool.request().query(`
        SELECT f.FIRMA_ID, f.FIRMA_KODU, f.UNVAN, p.[MOD]
        FROM dbo.ADM_POS_FIRMA p JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = p.FIRMA_ID
        WHERE p.[MOD] IN ('test', 'canli')
        ORDER BY f.UNVAN
      `)
    ).recordset;
    return rows.map((r: any) => ({ firmaId: r.FIRMA_ID, firmaKodu: r.FIRMA_KODU, unvan: r.UNVAN, mod: r.MOD }));
  }

  public static async dogrulamalar(): Promise<PosDogrulamaSatiri[]> {
    const pool = await getAdminPool();
    const rows = (
      await pool.request().query(`
        SELECT d.MODEL, d.SENARYO_NO, d.SONUC, d.NOTU, d.TARIH, a.AD_SOYAD
        FROM dbo.ADM_POS_DOGRULAMA d LEFT JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = d.ADMIN_ID
      `)
    ).recordset;
    return rows.map((r: any) => ({ model: r.MODEL, senaryoNo: r.SENARYO_NO, sonuc: r.SONUC, notu: metin(r.NOTU), admin: metin(r.AD_SOYAD), tarih: r.TARIH }));
  }

  /** sonuc null → işaret kaldırılır (senaryo yeniden denenmemiş sayılır). */
  public static async dogrulamaYaz(model: string, senaryoNo: number, sonuc: DogrulamaSonucu | null, notu: string | null, adminId: number): Promise<void> {
    const pool = await getAdminPool();
    const req = pool.request();
    req.input("model", sql.VarChar(20), model);
    req.input("no", sql.Int, senaryoNo);
    req.input("sonuc", sql.VarChar(10), sonuc);
    req.input("notu", sql.NVarChar(300), notu);
    req.input("adminId", sql.Int, adminId);
    await req.query(`
      DELETE FROM dbo.ADM_POS_DOGRULAMA WHERE MODEL = @model AND SENARYO_NO = @no;
      IF @sonuc IS NOT NULL
        INSERT INTO dbo.ADM_POS_DOGRULAMA (MODEL, SENARYO_NO, SONUC, NOTU, ADMIN_ID) VALUES (@model, @no, @sonuc, @notu, @adminId);
    `);
  }

  /** Cihaz servisine giden istekler ve cihazdan gelen bildirimler. Yazılamaması asıl işlemi bozmaz; kimlik bilgisi KOYMAYIN. */
  public static async logYaz(kayit: { tur: "ISTEK" | "DONUS"; firmaId?: number | null; ozet: string; istek?: unknown; yanit?: unknown; basarili: boolean }): Promise<void> {
    try {
      const pool = await getAdminPool();
      const yaz = (v: unknown) => (v === undefined || v === null ? null : typeof v === "string" ? v.slice(0, 20000) : JSON.stringify(v).slice(0, 20000));
      await pool
        .request()
        .input("tur", sql.VarChar(10), kayit.tur)
        .input("firmaId", sql.Int, kayit.firmaId ?? null)
        .input("ozet", sql.NVarChar(300), kayit.ozet.slice(0, 300))
        .input("istek", sql.NVarChar(sql.MAX), yaz(kayit.istek))
        .input("yanit", sql.NVarChar(sql.MAX), yaz(kayit.yanit))
        .input("basarili", sql.Bit, kayit.basarili ? 1 : 0)
        .query(`INSERT INTO dbo.ADM_POS_LOG (TUR, FIRMA_ID, OZET, ISTEK, YANIT, BASARILI) VALUES (@tur, @firmaId, @ozet, @istek, @yanit, @basarili)`);
    } catch (err: any) {
      logger.warn(`[POS] Günlük yazılamadı: ${err?.message}`);
    }
  }

  public static async logListele(limit: number): Promise<PosLogSatiri[]> {
    const pool = await getAdminPool();
    const rows = (
      await pool
        .request()
        .input("limit", sql.Int, Math.min(Math.max(limit || 50, 1), 300))
        .query(`
          SELECT TOP (@limit) l.*, f.FIRMA_KODU
          FROM dbo.ADM_POS_LOG l LEFT JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = l.FIRMA_ID
          ORDER BY l.LOG_ID DESC
        `)
    ).recordset;
    return rows.map((r: any) => ({
      logId: r.LOG_ID,
      tarih: r.TARIH,
      tur: r.TUR,
      firmaId: r.FIRMA_ID ?? null,
      firmaKodu: metin(r.FIRMA_KODU),
      ozet: r.OZET,
      istek: r.ISTEK ?? null,
      yanit: r.YANIT ?? null,
      basarili: Boolean(r.BASARILI),
    }));
  }
}

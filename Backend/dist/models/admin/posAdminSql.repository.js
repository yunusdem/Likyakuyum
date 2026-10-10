import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { logger } from "../../utils/logger.js";
const metin = (v) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());
export class PosAdminSqlRepository {
    static async ayarGetir() {
        const pool = await getAdminPool();
        const r = (await pool.request().query(`SELECT TOP 1 * FROM dbo.ADM_POS_AYAR WHERE AYAR_ID = 1`)).recordset[0];
        if (!r)
            return null;
        return {
            tokenClientId: metin(r.TOKEN_CLIENT_ID),
            tokenClientSecretSifreli: r.TOKEN_CLIENT_SECRET_ENC || null,
            tokenAuthUrl: metin(r.TOKEN_AUTH_URL),
            tokenApiUrl: metin(r.TOKEN_API_URL),
            donusKok: metin(r.DONUS_KOK),
            inposUygulamaNo: metin(r.INPOS_UYGULAMA_NO),
            inposApiUrl: metin(r.INPOS_API_URL),
            inposKullanici: metin(r.INPOS_KULLANICI),
            inposSifreSifreli: r.INPOS_SIFRE_ENC || null,
            inposWebhookKullanici: metin(r.INPOS_WEBHOOK_KULLANICI),
            inposWebhookSifreSifreli: r.INPOS_WEBHOOK_SIFRE_ENC || null,
            guncellemeTarihi: r.GUNCELLEME_TARIHI ?? null,
        };
    }
    static async ayarKaydet(dto, adminId) {
        const pool = await getAdminPool();
        const req = pool.request();
        req.input("clientId", sql.VarChar(200), dto.tokenClientId);
        req.input("secretDegisti", sql.Bit, dto.tokenClientSecretSifreli !== undefined ? 1 : 0);
        req.input("secret", sql.VarChar(1000), dto.tokenClientSecretSifreli ?? null);
        req.input("authUrl", sql.VarChar(300), dto.tokenAuthUrl);
        req.input("apiUrl", sql.VarChar(300), dto.tokenApiUrl);
        req.input("donusKok", sql.VarChar(300), dto.donusKok);
        req.input("inposNo", sql.VarChar(50), dto.inposUygulamaNo);
        req.input("inposApiUrl", sql.VarChar(300), dto.inposApiUrl);
        req.input("inposKullanici", sql.VarChar(200), dto.inposKullanici);
        req.input("inposSifreDegisti", sql.Bit, dto.inposSifreSifreli !== undefined ? 1 : 0);
        req.input("inposSifre", sql.VarChar(1000), dto.inposSifreSifreli ?? null);
        req.input("whKullanici", sql.VarChar(200), dto.inposWebhookKullanici);
        req.input("whSifreDegisti", sql.Bit, dto.inposWebhookSifreSifreli !== undefined ? 1 : 0);
        req.input("whSifre", sql.VarChar(1000), dto.inposWebhookSifreSifreli ?? null);
        req.input("adminId", sql.Int, adminId);
        // Kimlik ya da adres değişince eski erişim anahtarları geçersizdir
        await req.query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.ADM_POS_AYAR WHERE AYAR_ID = 1) INSERT INTO dbo.ADM_POS_AYAR (AYAR_ID) VALUES (1);
      UPDATE dbo.ADM_POS_AYAR SET
        TOKEN_CLIENT_ID = @clientId,
        TOKEN_CLIENT_SECRET_ENC = CASE WHEN @secretDegisti = 1 THEN @secret ELSE TOKEN_CLIENT_SECRET_ENC END,
        TOKEN_AUTH_URL = @authUrl, TOKEN_API_URL = @apiUrl, DONUS_KOK = @donusKok, INPOS_UYGULAMA_NO = @inposNo,
        INPOS_API_URL = @inposApiUrl, INPOS_KULLANICI = @inposKullanici,
        INPOS_SIFRE_ENC = CASE WHEN @inposSifreDegisti = 1 THEN @inposSifre ELSE INPOS_SIFRE_ENC END,
        INPOS_WEBHOOK_KULLANICI = @whKullanici,
        INPOS_WEBHOOK_SIFRE_ENC = CASE WHEN @whSifreDegisti = 1 THEN @whSifre ELSE INPOS_WEBHOOK_SIFRE_ENC END,
        TOKEN_ERISIM_ENC = NULL, TOKEN_ERISIM_BITIS = NULL, INPOS_ERISIM_ENC = NULL, INPOS_ERISIM_BITIS = NULL,
        GUNCELLEYEN_ADMIN_ID = @adminId, GUNCELLEME_TARIHI = GETDATE()
      WHERE AYAR_ID = 1;
    `);
    }
    /** Inpos TSM erişim anahtarı (JWT, şifreli). Süresi veritabanı saatiyle denetlenir. */
    static async inposErisimGetir() {
        const pool = await getAdminPool();
        const r = (await pool.request().query(`SELECT INPOS_ERISIM_ENC AS T FROM dbo.ADM_POS_AYAR WHERE AYAR_ID = 1 AND INPOS_ERISIM_BITIS > GETDATE()`)).recordset[0];
        return r?.T || null;
    }
    static async inposErisimYaz(sifreli, omurSaniye) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("t", sql.VarChar(sql.MAX), sifreli)
            .input("omur", sql.Int, omurSaniye)
            .query(`UPDATE dbo.ADM_POS_AYAR SET INPOS_ERISIM_ENC = @t, INPOS_ERISIM_BITIS = CASE WHEN @t IS NULL THEN NULL ELSE DATEADD(SECOND, @omur, GETDATE()) END WHERE AYAR_ID = 1`);
    }
    // ─── Sipariş / sepet → firma ───────────────────────────────────────────────
    static async sepetYaz(k) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("saglayici", sql.VarChar(10), k.saglayici)
            .input("kimlik", sql.VarChar(100), k.sepetKimlik)
            .input("firmaId", sql.Int, k.firmaId)
            .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.ADM_POS_SEPET WHERE SAGLAYICI = @saglayici AND SEPET_KIMLIK = @kimlik)
          INSERT INTO dbo.ADM_POS_SEPET (SAGLAYICI, SEPET_KIMLIK, FIRMA_ID) VALUES (@saglayici, @kimlik, @firmaId);
      `);
    }
    static async sepetFirmasi(saglayici, sepetKimlik) {
        const pool = await getAdminPool();
        const r = (await pool.request().input("saglayici", sql.VarChar(10), saglayici).input("kimlik", sql.VarChar(100), sepetKimlik).query(`SELECT FIRMA_ID FROM dbo.ADM_POS_SEPET WHERE SAGLAYICI = @saglayici AND SEPET_KIMLIK = @kimlik`)).recordset[0];
        return r?.FIRMA_ID ?? null;
    }
    /** Token'ın 24 saatlik erişim anahtarı (şifreli). Süresi veritabanı saatiyle denetlenir. */
    static async erisimGetir() {
        const pool = await getAdminPool();
        const r = (await pool.request().query(`SELECT TOKEN_ERISIM_ENC AS T FROM dbo.ADM_POS_AYAR WHERE AYAR_ID = 1 AND TOKEN_ERISIM_BITIS > GETDATE()`)).recordset[0];
        return r?.T || null;
    }
    static async erisimYaz(sifreli, omurSaniye) {
        const pool = await getAdminPool();
        await pool
            .request()
            .input("t", sql.VarChar(sql.MAX), sifreli)
            .input("omur", sql.Int, omurSaniye)
            .query(`UPDATE dbo.ADM_POS_AYAR SET TOKEN_ERISIM_ENC = @t, TOKEN_ERISIM_BITIS = CASE WHEN @t IS NULL THEN NULL ELSE DATEADD(SECOND, @omur, GETDATE()) END WHERE AYAR_ID = 1`);
    }
    /** Firmanın POS modu; kaydı yoksa null (= kapalı, K19). */
    static async firmaModu(firmaId) {
        const pool = await getAdminPool();
        const r = (await pool.request().input("firmaId", sql.Int, firmaId).query(`SELECT [MOD] FROM dbo.ADM_POS_FIRMA WHERE FIRMA_ID = @firmaId`)).recordset[0];
        return r?.MOD === "test" || r?.MOD === "canli" ? r.MOD : r ? "kapali" : null;
    }
    static async firmaModuYaz(firmaId, mod, adminId) {
        const pool = await getAdminPool();
        await pool.request().input("firmaId", sql.Int, firmaId).input("mod", sql.VarChar(10), mod).input("adminId", sql.Int, adminId).query(`
      MERGE dbo.ADM_POS_FIRMA WITH (HOLDLOCK) AS hedef
      USING (SELECT @firmaId AS FIRMA_ID) AS kaynak ON hedef.FIRMA_ID = kaynak.FIRMA_ID
      WHEN MATCHED THEN UPDATE SET [MOD] = @mod, DEGISTIREN_ADMIN_ID = @adminId, DEGISTIRME_TARIHI = GETDATE()
      WHEN NOT MATCHED THEN INSERT (FIRMA_ID, [MOD], DEGISTIREN_ADMIN_ID) VALUES (@firmaId, @mod, @adminId);
    `);
    }
    /** POS modu Test ya da Canlı olan firmalar (test konsolunda seçmek için). */
    static async acikFirmalar() {
        const pool = await getAdminPool();
        const rows = (await pool.request().query(`
        SELECT f.FIRMA_ID, f.FIRMA_KODU, f.UNVAN, p.[MOD]
        FROM dbo.ADM_POS_FIRMA p JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = p.FIRMA_ID
        WHERE p.[MOD] IN ('test', 'canli')
        ORDER BY f.UNVAN
      `)).recordset;
        return rows.map((r) => ({ firmaId: r.FIRMA_ID, firmaKodu: r.FIRMA_KODU, unvan: r.UNVAN, mod: r.MOD }));
    }
    static async dogrulamalar() {
        const pool = await getAdminPool();
        const rows = (await pool.request().query(`
        SELECT d.MODEL, d.SENARYO_NO, d.SONUC, d.NOTU, d.TARIH, a.AD_SOYAD
        FROM dbo.ADM_POS_DOGRULAMA d LEFT JOIN dbo.ADM_ADMIN a ON a.ADMIN_ID = d.ADMIN_ID
      `)).recordset;
        return rows.map((r) => ({ model: r.MODEL, senaryoNo: r.SENARYO_NO, sonuc: r.SONUC, notu: metin(r.NOTU), admin: metin(r.AD_SOYAD), tarih: r.TARIH }));
    }
    /** sonuc null → işaret kaldırılır (senaryo yeniden denenmemiş sayılır). */
    static async dogrulamaYaz(model, senaryoNo, sonuc, notu, adminId) {
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
    static async logYaz(kayit) {
        try {
            const pool = await getAdminPool();
            const yaz = (v) => (v === undefined || v === null ? null : typeof v === "string" ? v.slice(0, 20000) : JSON.stringify(v).slice(0, 20000));
            await pool
                .request()
                .input("tur", sql.VarChar(10), kayit.tur)
                .input("firmaId", sql.Int, kayit.firmaId ?? null)
                .input("ozet", sql.NVarChar(300), kayit.ozet.slice(0, 300))
                .input("istek", sql.NVarChar(sql.MAX), yaz(kayit.istek))
                .input("yanit", sql.NVarChar(sql.MAX), yaz(kayit.yanit))
                .input("basarili", sql.Bit, kayit.basarili ? 1 : 0)
                .query(`INSERT INTO dbo.ADM_POS_LOG (TUR, FIRMA_ID, OZET, ISTEK, YANIT, BASARILI) VALUES (@tur, @firmaId, @ozet, @istek, @yanit, @basarili)`);
        }
        catch (err) {
            logger.warn(`[POS] Günlük yazılamadı: ${err?.message}`);
        }
    }
    static async logListele(limit) {
        const pool = await getAdminPool();
        const rows = (await pool
            .request()
            .input("limit", sql.Int, Math.min(Math.max(limit || 50, 1), 300))
            .query(`
          SELECT TOP (@limit) l.*, f.FIRMA_KODU
          FROM dbo.ADM_POS_LOG l LEFT JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = l.FIRMA_ID
          ORDER BY l.LOG_ID DESC
        `)).recordset;
        return rows.map((r) => ({
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

import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Fiş GİB'e gönderilmiş mi: e-Belge › Kaynak ekranındaki "Gönderildi" rozetiyle aynı kural.
 * Giden kaydı (KAYNAK_FIS_ID = "<evrakTuru>:<belgeId>:…") gönderilmiş ya da sonucu beklenen (kuyrukta) ise,
 * ya da kaynak sonuç kaydı gönderilmedi/hata dışında bir durumdaysa fiş gönderilmiş sayılır ve silinemez.
 * Eski satır alanları (E_BELGE_DURUMU, E_FATURA_DURUMU) tek başına gönderildi sayılmaz (ekranda "Kontrol gerekli").
 * Sarraf evrakTuru 0, Perakende / Ticari 98, Döviz 99 (ebelgeKaynak.repository ile aynı).
 */
export async function gibeGonderildiMi(pool: sql.ConnectionPool, evrakTuru: number, belgeId: number): Promise<boolean> {
  try {
    const r = await pool.request().input("K", sql.VarChar(60), `${evrakTuru}:${belgeId}:%`).query(`
      DECLARE @G BIT = 0;
      IF OBJECT_ID('dbo.TODVZ_EBELGE_GIDEN', 'U') IS NOT NULL
      BEGIN
        EXEC sp_executesql N'SELECT @G = CASE WHEN EXISTS (SELECT 1 FROM [dbo].[TODVZ_EBELGE_GIDEN]
          WHERE KAYNAK_FIS_ID LIKE @K AND GONDERIM_DURUMU IN (''GONDERILDI'',''KUYRUKTA'',''GONDERILIYOR'',''BELIRSIZ'',''ONAYLANIYOR''))
          THEN 1 ELSE 0 END', N'@K VARCHAR(60), @G BIT OUTPUT', @K, @G OUTPUT;
      END;

      IF @G = 0 AND OBJECT_ID('dbo.TODVZ_EBELGE_KAYNAK', 'U') IS NOT NULL
      BEGIN
        EXEC sp_executesql N'SELECT @G = CASE WHEN EXISTS (SELECT 1 FROM [dbo].[TODVZ_EBELGE_KAYNAK]
          WHERE ANAHTAR LIKE @K AND DURUM NOT IN (''GONDERILMEDI'',''HATA''))
          THEN 1 ELSE 0 END', N'@K VARCHAR(60), @G BIT OUTPUT', @K, @G OUTPUT;
      END;

      SELECT @G AS G;
    `);
    return Number(r.recordset?.[0]?.G) === 1;
  } catch {
    return false;
  }
}

/** Gönderilmiş fişi silme girişiminde fırlatılır — her fiş türünde aynı mesaj. */
export async function gibeGonderildiyseEngelle(pool: sql.ConnectionPool, evrakTuru: number, belgeId: number, fisAdi: string): Promise<void> {
  if (await gibeGonderildiMi(pool, evrakTuru, belgeId)) throw ApiError.badRequest(`GİB'e gönderilmiş ${fisAdi} silinemez.`);
}

export const EVRAK_TURU_SARRAF = 0;
export const EVRAK_TURU_PERAKENDE = 98;
export const EVRAK_TURU_DOVIZ = 99;

export type KaynakSilTuru = "sarraf" | "doviz" | "perakende" | "ticari";
/** Kaynak kimliğinden silinecek fişin türü; Perakende ve Ticari aynı tabloda (FIS_KAYNAGI 1 = Ticari) */
export async function kaynakSilTuru(k: { evrakTuru: number; belgeId: number }, ctx?: { dbServer?: string; dbName?: string }): Promise<KaynakSilTuru> {
  const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
  const yok = ApiError.notFound("Fiş bulunamadı; daha önce silinmiş olabilir.");
  // Eski silme yordamları olmayan fişte hata vermez: kayıt burada denetlenir ki ekran "silindi" demesin
  if (k.evrakTuru === EVRAK_TURU_SARRAF) {
    if (!(await pool.request().input("ID", sql.Int, k.belgeId).query(`SELECT 1 AS V FROM dbo.TODVZ_SARRAF_FISI WHERE SARRAF_FISI_ID = @ID`)).recordset.length) throw yok;
    return "sarraf";
  }
  if (k.evrakTuru === EVRAK_TURU_DOVIZ) {
    if (!(await pool.request().input("ID", sql.Int, k.belgeId).query(`SELECT 1 AS V FROM dbo.TODVZ_FIS WHERE FIS_ID = @ID`)).recordset.length) throw yok;
    return "doviz";
  }
  if (k.evrakTuru !== EVRAK_TURU_PERAKENDE) throw ApiError.badRequest("Bilinmeyen kaynak belge türü.");
  const r = await pool.request().input("ID", sql.Int, k.belgeId)
    .query(`SELECT ISNULL(FIS_KAYNAGI, 0) AS K FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @ID`);
  if (!r.recordset.length) throw yok;
  return Number(r.recordset[0].K) === 1 ? "ticari" : "perakende";
}

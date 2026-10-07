import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { FirmaService } from "./firma.service.js";
export class SurumService {
    static async listele() {
        const pool = await getAdminPool();
        const res = await pool.request().query(`
      IF OBJECT_ID('dbo.ADM_SURUM') IS NULL SELECT TOP 0 1 AS YOK
      ELSE SELECT s.SURUM, s.YAYIN_TARIHI, s.BOYUT, s.SEMA_SURUMU, s.NOTLAR, s.AKTIF,
             (SELECT COUNT(*) FROM dbo.ADM_FIRMA f WHERE f.SURUM = s.SURUM) AS KURULUM,
             (SELECT COUNT(*) FROM dbo.ADM_FIRMA f WHERE f.HEDEF_SURUM = s.SURUM) AS SABIT
           FROM dbo.ADM_SURUM s ORDER BY s.YAYIN_TARIHI DESC, s.SURUM DESC`);
        return (res.recordset ?? [])
            .filter((r) => r.SURUM)
            .map((r) => ({
            surum: r.SURUM,
            yayinTarihi: r.YAYIN_TARIHI,
            boyut: Number(r.BOYUT),
            semaSurumu: r.SEMA_SURUMU ?? null,
            notlar: r.NOTLAR ?? null,
            aktif: !!r.AKTIF,
            kurulumSayisi: r.KURULUM,
            sabitFirmaSayisi: r.SABIT,
        }));
    }
    /** Aktif/pasif (pasif sürüm "en son" sayılmaz, kurulumlara önerilmez) ve not. */
    static async guncelle(yapan, surum, girdi) {
        const pool = await getAdminPool();
        const res = await pool
            .request()
            .input("s", sql.VarChar(30), surum)
            .input("aktif", sql.Bit, girdi.aktif ?? null)
            .input("not", sql.NVarChar(2000), girdi.notlar === undefined ? null : girdi.notlar)
            .input("notVar", sql.Bit, girdi.notlar !== undefined)
            .query(`UPDATE dbo.ADM_SURUM SET AKTIF = ISNULL(@aktif, AKTIF), NOTLAR = CASE WHEN @notVar = 1 THEN @not ELSE NOTLAR END WHERE SURUM = @s`);
        if ((res.rowsAffected[0] ?? 0) === 0)
            throw ApiError.notFound("Sürüm bulunamadı.");
        await AdminLogSqlRepository.islemLogu({ adminId: yapan.adminId, islem: "SURUM_GUNCELLENDI", hedefTur: "SURUM", hedefId: surum, yeni: girdi });
        return this.listele();
    }
    /** Firmayı belirli bir sürüme sabitler (geri alma dahil); null = en son sürümü izler. */
    static async hedefSurumAyarla(yapan, firmaId, surum) {
        const firma = await FirmaService.getir(firmaId);
        if (firma.baglantiModu !== "setup")
            throw ApiError.badRequest("Sürüm yalnız kurulum (exe) firmalarında sabitlenir.");
        const pool = await getAdminPool();
        if (surum) {
            const var_ = (await pool.request().input("s", sql.VarChar(30), surum).query(`SELECT COUNT(*) AS N FROM dbo.ADM_SURUM WHERE SURUM = @s`)).recordset[0].N;
            if (!var_)
                throw ApiError.notFound("Sürüm bulunamadı.");
        }
        await pool.request().input("id", sql.Int, firmaId).input("s", sql.VarChar(30), surum).query(`UPDATE dbo.ADM_FIRMA SET HEDEF_SURUM = @s WHERE FIRMA_ID = @id`);
        await AdminLogSqlRepository.islemLogu({
            adminId: yapan.adminId,
            islem: "HEDEF_SURUM_DEGISTI",
            hedefTur: "FIRMA",
            hedefId: firmaId,
            eski: { hedefSurum: firma.hedefSurum },
            yeni: { hedefSurum: surum },
        });
        return FirmaService.getir(firmaId);
    }
}

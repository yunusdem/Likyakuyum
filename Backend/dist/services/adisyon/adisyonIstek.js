import sql from "mssql";
import { ApiError } from "../../utils/ApiError.js";
export const istekKimligiGecerli = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(v);
/** Kimliği kilitler ve varsa önceki kaydı döner (yoksa null). Geçersiz kimlik 400. */
export async function istekOku(tx, istekId) {
    if (!istekKimligiGecerli(istekId))
        throw ApiError.badRequest("Geçersiz istek kimliği.");
    const k = await new sql.Request(tx).input("K", sql.NVarChar(255), `LIKYA_ADISYON_ISTEK_${istekId}`).query(`DECLARE @r INT;
    EXEC @r = sp_getapplock @Resource = @K, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 30000; SELECT @r AS R;`);
    if (Number(k.recordset[0]?.R) < 0)
        throw ApiError.conflict("Aynı istek hâlâ işleniyor; biraz sonra tekrar deneyin.");
    const r = await new sql.Request(tx).input("I", sql.VarChar(64), istekId).query(`SELECT SONUC FROM dbo.TODVZ_ADISYON_ISTEK WHERE ISTEK_KIMLIGI = @I`);
    if (!r.recordset.length)
        return null;
    try {
        const s = JSON.parse(String(r.recordset[0].SONUC || "{}"));
        return s && typeof s === "object" ? s : {};
    }
    catch {
        return {};
    }
}
export async function istekYaz(tx, istekId, kayit) {
    await new sql.Request(tx).input("I", sql.VarChar(64), istekId).input("S", sql.NVarChar(sql.MAX), JSON.stringify(kayit))
        .query(`INSERT INTO dbo.TODVZ_ADISYON_ISTEK (ISTEK_KIMLIGI, SONUC) VALUES (@I, @S)`);
}
/**
 * Masa işlemleri (ikram / iptal / ürün taşıma): kimlik verildiyse ve daha önce işlendiyse true (işlem atlanır); ilk kezse kayıt
 * yazılır ve false döner (işlem geri alınırsa kayıt da gider). Kimlik verilmediyse false (eski istemci: korumasız).
 */
export async function islemDahaOnceYapildiMi(tx, istekId, adisyonId, tur) {
    if (istekId === undefined || istekId === null || istekId === "")
        return false;
    const once = await istekOku(tx, istekId);
    if (once) {
        if (Number(once.adisyonId) !== Number(adisyonId) || once.tur !== tur)
            throw ApiError.conflict("Bu istek kimliği başka bir işlemde kullanılmış; ekranı yenileyip yeniden deneyin.");
        return true;
    }
    await istekYaz(tx, istekId, { adisyonId, tur });
    return false;
}

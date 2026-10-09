import sql from "mssql";
import { getAdminPool } from "../../config/adminDb.config.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { KullaniciSqlRepository } from "../../models/admin/kullaniciSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { firmaDbAnahtari } from "../admin/firmaBaglanti.service.js";
/**
 * İstek yapan kullanıcının merkezdeki (LIKYA_ADMIN) karşılığı — K2.
 * 1) Müşteri no ile açılmış oturum: token'daki sid → ADM_OTURUM → kullanıcı + firma.
 * 2) Eski usul oturum (sid yok): token'daki sunucu + veritabanı → firma; kullanıcı adı → ADM_KULLANICI
 *    (merkezde kullanıcı kaydı yoksa yalnız adıyla, yönetici sayılmadan).
 * Firma bulunamazsa 403: destek yalnız merkezde kayıtlı firmalara açık.
 */
const ONBELLEK_MS = 60_000;
const onbellek = new Map();
export class DestekKimlikService {
    static onbellegiTemizle() {
        onbellek.clear();
    }
    static async coz(u) {
        if (!u)
            throw ApiError.unauthorized();
        const anahtar = u.sid ? `sid:${u.sid}` : `db:${u.dbServer}|${u.dbName}|${u.username}`;
        const eski = onbellek.get(anahtar);
        if (eski && Date.now() - eski.zaman < ONBELLEK_MS)
            return eski.kimlik;
        const kimlik = (u.sid && u.firmaId ? await this.sidIle(u.sid, u.firmaId) : null) ?? (await this.veritabaniIle(u));
        onbellek.set(anahtar, { kimlik, zaman: Date.now() });
        if (onbellek.size > 5000)
            onbellek.clear();
        return kimlik;
    }
    static async sidIle(sid, firmaId) {
        if (!/^[0-9a-fA-F-]{36}$/.test(sid))
            return null;
        const pool = await getAdminPool();
        const r = await pool
            .request()
            .input("sid", sql.UniqueIdentifier, sid)
            .input("firmaId", sql.Int, firmaId).query(`
        SELECT k.KULLANICI_ID, k.KULLANICI_ADI, k.AD_SOYAD, k.FIRMA_YONETICISI, f.FIRMA_ID, f.FIRMA_KODU, f.UNVAN
        FROM dbo.ADM_OTURUM o
        INNER JOIN dbo.ADM_KULLANICI k ON k.KULLANICI_ID = o.KULLANICI_ID
        INNER JOIN dbo.ADM_FIRMA f ON f.FIRMA_ID = o.FIRMA_ID
        WHERE o.OTURUM_ID = @sid AND o.TUR = 'KULLANICI' AND o.FIRMA_ID = @firmaId`);
        const x = r.recordset[0];
        if (!x)
            return null;
        return {
            firmaId: x.FIRMA_ID,
            firmaKodu: x.FIRMA_KODU,
            firmaUnvan: x.UNVAN,
            kullaniciId: x.KULLANICI_ID,
            kullaniciAdi: x.KULLANICI_ADI,
            adSoyad: x.AD_SOYAD ?? null,
            yonetici: !!x.FIRMA_YONETICISI,
        };
    }
    static async veritabaniIle(u) {
        const firma = u.firmaId
            ? await FirmaSqlRepository.idIleBul(u.firmaId)
            : u.dbServer && u.dbName
                ? await FirmaSqlRepository.anahtarIleBul(firmaDbAnahtari(u.dbServer, u.dbName).anahtar)
                : null;
        if (!firma)
            throw ApiError.forbidden("Destek için firmanızın merkezde kayıtlı olması gerekir. Lütfen hizmet sağlayıcınızla iletişime geçiniz.");
        const kullanici = await KullaniciSqlRepository.adIleBul(firma.firmaId, u.username);
        return {
            firmaId: firma.firmaId,
            firmaKodu: firma.firmaKodu,
            firmaUnvan: firma.unvan,
            kullaniciId: kullanici?.kullaniciId ?? null,
            kullaniciAdi: kullanici?.kullaniciAdi ?? u.username,
            adSoyad: kullanici?.adSoyad ?? null,
            yonetici: !!kullanici?.firmaYoneticisi,
        };
    }
}

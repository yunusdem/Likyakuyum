import sql from "mssql";
import { getDbPool } from "../../config/mssql.config.js";
import { ApiError } from "../../utils/ApiError.js";
import { yetkiSatirdan } from "./kullaniciYetkiKural.js";
/**
 * Oturumdaki kullanıcının kart yetkileri (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4). Jeton yalnız kimliği taşır; yetkiler
 * kullanıcı kartından her istekte okunur (yönetici kartta değiştirince hemen geçerli olur). İstek başına bir kez okunur.
 */
const KOLONLAR = [
    "SISTEM_YONETICISI",
    "ANA_MENU_YETKISI",
    "VEZNE_ISLEMLERI_YETKISI",
    "KASA_ISLEMLERI_YETKISI",
    "KUR_ISLEMLERI_YETKISI",
    "CARI_ISLEMLER_YETKISI",
    "YONETICI_ISLEMLERI_YETKISI",
    "MUHASEBE_YETKISI",
    "RAPORLAR_YETKISI",
    "KONSOLIDE_RAPORLAR_YETKISI",
    "TEKNIK_ISLEMLER_YETKISI",
    "FIS_GOSTERME_GUN_SAYISI",
    "TARIH_DEGISTIRME_YETKISI",
    "FIS_NO_DEGISTIRME_YETKISI",
    "FIS_TUTAR_DEGISTIRME_YETKISI",
    "FIS_BANKA_HESABI_SECME_YETKISI",
    "KOMISYON_ALMA_YETKISI",
    "KOMISYON_ORANI",
    "CARI_BAKIYE_GOREBILIR",
    "ACIK_VADELI_ISLEM_GOREBILIR",
    "SUPHELI_ISLEMLER_YETKILISI",
    "CAPRAZ_KUR_KONTROLU_YOK",
    "KUR_YETKISI",
    "KUR_TOLERANS_ORANI",
    "GISE_KURU_DISINDA_OLABILIR",
    "SAPMA_UYARISI_VERILMESIN",
    "MASAK_UYARISI_VERSIN",
    "ALAN_ISLEMLERI_YETKISI",
];
const ONBELLEK = Symbol("kullaniciYetkisi");
/**
 * Veritabanı başına TODVZ_KULLANICI'da bulunan yetki kolonları. Süreli tutulur: sunucu açıkken bir göç / kolon ekleme
 * eklenen yetki kolonunu yeniden başlatmadan da okutsun (yoksa o yetki "yok" sayılıyordu).
 */
const KOLON_ONBELLEK_MS = 5 * 60 * 1000;
const kolonOnbellegi = new Map();
export async function kullaniciYetkisi(req) {
    const r = req;
    if (r[ONBELLEK])
        return r[ONBELLEK];
    const id = Number(req.user?.userId ?? req.user?.id);
    if (!Number.isInteger(id) || id <= 0)
        throw ApiError.unauthorized("Oturum kullanıcısı bulunamadı.");
    const pool = await getDbPool(req.user?.dbServer, req.user?.dbName);
    // Eski şemalarda bazı kolonlar olmayabilir: yalnız var olanlar okunur
    const anahtar = `${req.user?.dbServer || ""}|${req.user?.dbName || ""}`;
    let secilen = kolonOnbellegi.get(anahtar);
    if (!secilen || Date.now() - secilen.zaman > KOLON_ONBELLEK_MS) {
        const var_ = await pool
            .request()
            .query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.TODVZ_KULLANICI')`)
            .then((x) => new Set(x.recordset.map((c) => String(c.name).toUpperCase())));
        const kolonlar = KOLONLAR.filter((k) => var_.has(k));
        // Hiçbiri yoksa tablo yok ya da başka bir veritabanı: boş SELECT yerine anlaşılır hata (önbelleğe alınmaz)
        if (!kolonlar.length)
            throw ApiError.internal("Kullanıcı tablosunda (TODVZ_KULLANICI) yetki kolonları bulunamadı.");
        secilen = { zaman: Date.now(), kolonlar };
        kolonOnbellegi.set(anahtar, secilen);
    }
    const username = String(req.user?.username || "").trim();
    const sonuc = await pool
        .request()
        .input("K", sql.Int, id)
        .input("UN", sql.NVarChar(100), username)
        .query(`SELECT ${secilen.kolonlar.map((k) => `[${k}]`).join(", ")} FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = @K OR (ISNULL(@UN, '') <> '' AND LOWER(RTRIM(LTRIM([AD]))) = LOWER(@UN))`);
    const satir = sonuc.recordset[0];
    if (!satir) {
        if (req.user?.role === "admin") {
            const y = yetkiSatirdan({ SISTEM_YONETICISI: 1 });
            r[ONBELLEK] = y;
            return y;
        }
        throw ApiError.unauthorized("Kullanıcı kartı bulunamadı.");
    }
    const y = yetkiSatirdan(satir);
    r[ONBELLEK] = y;
    return y;
}
/** Koşul sağlanmıyorsa 403 */
export async function yetkiGerekli(req, kosul, mesaj) {
    const y = await kullaniciYetkisi(req);
    if (!kosul(y))
        throw ApiError.forbidden(mesaj);
    return y;
}

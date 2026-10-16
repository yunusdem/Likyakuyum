import sql from "mssql";
import { getDbPool } from "../../config/mssql.config.js";
import { ApiError } from "../../utils/ApiError.js";
import { kullaniciYetkisi } from "./kullaniciYetkisi.js";
import { gosterimBaslangici, gosterimIcinde, gunKismi, trGunu } from "./kullaniciYetkiKural.js";
export const KAYIT_TABLOLARI = {
    sarraf: { tablo: "TODVZ_SARRAF_FISI", id: "SARRAF_FISI_ID", tarih: "TARIH", nolar: ["FIS_NO", "IRSALIYE_NO"] },
    doviz: { tablo: "TODVZ_FIS", id: "FIS_ID", tarih: "TARIH", nolar: ["SERI_NO", "BELGE_NO"] },
    /** Perakende fişi ve Ticari satış fişi */
    fatura: { tablo: "TODVZ_FATURA", id: "FATURA_ID", tarih: "TARIH", nolar: ["FATURA_NO"] },
    stokGiris: { tablo: "TODVZ_STOK_GIRIS", id: "STOK_GIRIS_ID", tarih: "TARIH", nolar: [] },
    kasaHareket: { tablo: "TODVZ_HESAP_HAREKETI", id: "HESAP_HAREKETI_ID", tarih: "TARIH", nolar: [] },
    cariHareket: { tablo: "TODVZ_CARI_HAREKET", id: "CARI_HAREKET_ID", tarih: "TARIH", nolar: [] },
    cariDekont: { tablo: "TODVZ_CARI_DEKONT", id: "CARI_DEKONT_ID", tarih: "TARIH", nolar: [] },
    vezneTransferi: { tablo: "TODVZ_VEZNE_TRANSFERI", id: "VEZNE_TRANSFERI_ID", tarih: "TARIH", nolar: ["REF_NO"] },
    bankaHareket: { tablo: "TODVZ_BANKA_HAREKET", id: "BANKA_HAREKET_ID", tarih: "TARIH", nolar: ["BELGE_NO"] },
};
const baglam = (req) => ({ dbServer: req.user?.dbServer, dbName: req.user?.dbName });
const pozitif = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};
/**
 * Kayıtlı fişin tarihi ("YYYY-MM-DD", veritabanındaki duvar saati günü — sürücü DATETIME'ı UTC sayar, saat dilimine
 * çevrilmez) ve numaraları; kayıt yoksa null
 */
export async function kayitBilgisi(req, tur, id) {
    const k = pozitif(id);
    if (!k)
        return null;
    const t = KAYIT_TABLOLARI[tur];
    const { dbServer, dbName } = baglam(req);
    const pool = await getDbPool(dbServer, dbName);
    const kolonlar = [t.tarih, ...t.nolar].map((c) => `[${c}]`).join(", ");
    const r = await pool.request().input("I", sql.Int, k).query(`SELECT ${kolonlar} FROM dbo.${t.tablo} WHERE ${t.id} = @I`);
    const s = r.recordset[0];
    if (!s)
        return null;
    const nolar = {};
    for (const c of t.nolar)
        nolar[c] = s[c] === null || s[c] === undefined ? null : String(s[c]).trim();
    const d = s[t.tarih] instanceof Date ? s[t.tarih] : s[t.tarih] ? new Date(s[t.tarih]) : null;
    return { tarih: d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null, nolar };
}
/**
 * İstemcinin gönderdiği tarihin veritabanına yazılacağı gün: saat dilimsiz metin olduğu gibi, Date ya da saat dilimli
 * metin UTC günü (sürücü useUTC ile yazar). Düzeltmede kaydın günüyle bununla karşılaştırılır.
 */
const kayitGunu = (v) => {
    if (v === null || v === undefined || v === "")
        return null;
    if (v instanceof Date)
        return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
    const s = String(v).trim();
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
    if (m && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s.slice(10)))
        return m[1];
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
/** Kullanıcının işlem gösterme sınırının ilk günü ("YYYY-MM-DD"); sınır yoksa null. Liste uçları bununla süzer. */
export async function gunSiniri(req) {
    return gosterimBaslangici(await kullaniciYetkisi(req));
}
/** İki "YYYY-MM-DD" değerinden büyüğü (liste süzgecinde istekteki başlangıç ile gün sınırı) */
export const sonrakiGun = (a, b) => {
    const x = gunKismi(a);
    const y = gunKismi(b);
    if (!x)
        return y;
    if (!y)
        return x;
    return x > y ? x : y;
};
const sinirMesaji = (y) => `Bu kayıt işlem gösterme sınırınızın (son ${y.gosterimGunu} gün) dışında; açılamaz, düzeltilemez, silinemez.`;
/** Kayıtlı fişe erişim (aç / sil): gün sınırı dışındaysa 403 */
export async function kayitErisimi(req, tur, id) {
    const y = await kullaniciYetkisi(req);
    if (y.yonetici || !y.gosterimGunu)
        return;
    const k = await kayitBilgisi(req, tur, id);
    if (k && !gosterimIcinde(y, k.tarih))
        throw ApiError.forbidden(sinirMesaji(y));
}
/** Bugün (Türkiye) ya da gece yarısı geçişi için 15 dakika önceki gün */
const bugunMu = (gun) => {
    if (!gun)
        return true;
    const simdi = new Date();
    return gun === trGunu(simdi) || gun === trGunu(new Date(simdi.getTime() - 15 * 60_000));
};
/**
 * Kaydedilecek fişin tarih ve numara yetkisi. id: düzeltilen kaydın kimliği (yoksa yeni kayıt), tarih: istemcinin
 * gönderdiği fiş tarihi. Dönen `nolar` doluysa istekteki numaralar bu değerlerle değiştirilmeli: yeni kayıtta boş
 * (numaratör verir), düzeltmede kaydın kendi numarası. Yetkiliyse null döner (istek olduğu gibi).
 */
export async function fisKayitYetkisi(req, tur, id, tarih) {
    const y = await kullaniciYetkisi(req);
    if (y.yonetici)
        return { nolar: null, yetki: y };
    const kayit = await kayitBilgisi(req, tur, id);
    if (kayit) {
        if (!gosterimIcinde(y, kayit.tarih))
            throw ApiError.forbidden(sinirMesaji(y));
        const gun = kayitGunu(tarih);
        if (!y.tarihDegistirme && gun && kayit.tarih && gun !== kayit.tarih) {
            throw ApiError.forbidden("Fiş tarihini değiştirme yetkiniz yok.");
        }
    }
    else if (!y.tarihDegistirme && !bugunMu(gunKismi(tarih))) {
        throw ApiError.forbidden("Fiş tarihini değiştirme yetkiniz yok; yeni fiş bugünün tarihiyle kaydedilir.");
    }
    if (y.fisNoDegistirme)
        return { nolar: null, yetki: y };
    const t = KAYIT_TABLOLARI[tur];
    return { nolar: kayit ? kayit.nolar : Object.fromEntries(t.nolar.map((c) => [c, null])), yetki: y };
}

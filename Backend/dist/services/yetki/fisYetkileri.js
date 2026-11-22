import sql from "mssql";
import { getDbPool } from "../../config/mssql.config.js";
import { ApiError } from "../../utils/ApiError.js";
import { kullaniciYetkisi } from "./kullaniciYetkisi.js";
import { kullaniciKartVeznesi } from "./fisVeznesi.js";
import { gosterimBaslangici, gosterimIcinde, gunKismi } from "./kullaniciYetkiKural.js";
export const KAYIT_TABLOLARI = {
    sarraf: { tablo: "TODVZ_SARRAF_FISI", id: "SARRAF_FISI_ID", tarih: "TARIH", nolar: ["FIS_NO", "IRSALIYE_NO"], kullaniciKolon: "EKLEYEN_ID", vezneKolon: "VEZNE_ID", cariKolon: "CARI_KART_ID" },
    doviz: { tablo: "TODVZ_FIS", id: "FIS_ID", tarih: "TARIH", nolar: ["SERI_NO", "BELGE_NO"], kullaniciKolon: "EKLEYEN_ID", vezneKolon: "VEZNE_ID", cariKolon: "CARI_KART_ID" },
    /** Perakende fişi ve Ticari satış fişi */
    fatura: { tablo: "TODVZ_FATURA", id: "FATURA_ID", tarih: "TARIH", nolar: ["FATURA_NO"], kullaniciKolon: "EKLEYEN_ID", vezneKolon: "VEZNE_ID", cariKolon: "CARI_KART_ID" },
    stokGiris: { tablo: "TODVZ_STOK_GIRIS", id: "STOK_GIRIS_ID", tarih: "TARIH", nolar: [], kullaniciKolon: "KULLANICI_ID", vezneKolon: "VEZNE_ID" },
    kasaHareket: { tablo: "TODVZ_HESAP_HAREKETI", id: "HESAP_HAREKETI_ID", tarih: "TARIH", nolar: [], kullaniciKolon: "KULLANICI_ID", vezneKolon: "VEZNE_ID" },
    cariHareket: { tablo: "TODVZ_CARI_HAREKET", id: "CARI_HAREKET_ID", tarih: "TARIH", nolar: [], kullaniciKolon: "EKLEYEN_ID", vezneKolon: "VEZNE_ID", cariKolon: "CARI_KART_ID" },
    cariDekont: { tablo: "TODVZ_CARI_DEKONT", id: "CARI_DEKONT_ID", tarih: "TARIH", nolar: [], kullaniciKolon: "KULLANICI_ID", vezneKolon: "VEZNE_ID", cariKolon: "CARI_KART_ID" },
    vezneTransferi: { tablo: "TODVZ_VEZNE_TRANSFERI", id: "VEZNE_TRANSFERI_ID", tarih: "TARIH", nolar: ["REF_NO"], kullaniciKolon: "KULLANICI_ID", vezneKolon: "VEZNE_ID" },
    bankaHareket: { tablo: "TODVZ_BANKA_HAREKET", id: "BANKA_HAREKET_ID", tarih: "TARIH", nolar: ["BELGE_NO"], kullaniciKolon: "KULLANICI_ID", vezneKolon: "VEZNE_ID" },
};
/** Liste süzgeci: "kendi kayıtları" yetkisi olan kullanıcının kimliği ve kart veznesi; yetki yoksa null (ortak alan denetimi 19.11.2026) */
export async function kendiKayitSuzgeci(req) {
    const y = await kullaniciYetkisi(req);
    if (!y.kendiKayitlari)
        return null;
    const u = req.user;
    const id = Number(u?.userId ?? u?.id);
    if (!Number.isInteger(id) || id <= 0)
        return null;
    return { kullaniciId: id, vezneId: (await kullaniciKartVeznesi(id, { dbServer: req.user?.dbServer, dbName: req.user?.dbName })) || 0 };
}
const baglam = (req) => ({ dbServer: req.user?.dbServer, dbName: req.user?.dbName });
const pozitif = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
};
/**
 * Kayıtlı fişin tarihi ("YYYY-MM-DD", veritabanındaki duvar saati günü — sürücü DATETIME'ı UTC sayar, saat dilimine
 * çevrilmez), numaraları ve kullanıcı/vezne bilgisi; kayıt yoksa null
 */
export async function kayitBilgisi(req, tur, id) {
    const k = pozitif(id);
    if (!k)
        return null;
    const t = KAYIT_TABLOLARI[tur];
    const { dbServer, dbName } = baglam(req);
    const pool = await getDbPool(dbServer, dbName);
    const selectKolonlar = [t.tarih, ...t.nolar];
    if (t.kullaniciKolon && !selectKolonlar.includes(t.kullaniciKolon))
        selectKolonlar.push(t.kullaniciKolon);
    if (t.vezneKolon && !selectKolonlar.includes(t.vezneKolon))
        selectKolonlar.push(t.vezneKolon);
    if (t.cariKolon && !selectKolonlar.includes(t.cariKolon))
        selectKolonlar.push(t.cariKolon);
    // Güvenli kolon seçimi: tabloda KULLANICI_ID / EKLEYEN_ID kolonlarından hangisi varsa onu oku
    const checkColsSql = `
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = '${t.tablo}' AND COLUMN_NAME IN (${selectKolonlar.concat(['EKLEYEN_ID', 'KULLANICI_ID']).map(c => `'${c}'`).join(', ')})
  `;
    const existingColsRes = await pool.request().query(checkColsSql).catch(() => ({ recordset: [] }));
    const existingCols = new Set((existingColsRes.recordset || []).map((r) => String(r.COLUMN_NAME).toUpperCase()));
    const validSelectCols = [];
    for (const col of selectKolonlar) {
        if (existingCols.size === 0 || existingCols.has(col.toUpperCase())) {
            validSelectCols.push(`[${col}]`);
        }
        else if (col === "KULLANICI_ID" && existingCols.has("EKLEYEN_ID")) {
            validSelectCols.push(`[EKLEYEN_ID] AS [KULLANICI_ID]`);
        }
        else if (col === "EKLEYEN_ID" && existingCols.has("KULLANICI_ID")) {
            validSelectCols.push(`[KULLANICI_ID] AS [EKLEYEN_ID]`);
        }
    }
    if (existingCols.has("EKLEYEN_ID") && !validSelectCols.some(c => c.includes("EKLEYEN_ID"))) {
        validSelectCols.push(`[EKLEYEN_ID]`);
    }
    if (existingCols.has("KULLANICI_ID") && !validSelectCols.some(c => c.includes("KULLANICI_ID"))) {
        validSelectCols.push(`[KULLANICI_ID]`);
    }
    const kolonSql = (validSelectCols.length > 0 ? validSelectCols : [`*`]).join(", ");
    const r = await pool.request().input("I", sql.Int, k).query(`SELECT ${kolonSql} FROM dbo.${t.tablo} WHERE ${t.id} = @I`);
    const s = r.recordset[0];
    if (!s)
        return null;
    const nolar = {};
    for (const c of t.nolar)
        nolar[c] = s[c] === null || s[c] === undefined ? null : String(s[c]).trim();
    const d = s[t.tarih] instanceof Date ? s[t.tarih] : s[t.tarih] ? new Date(s[t.tarih]) : null;
    const rawKullanici = s[t.kullaniciKolon || ""] ?? s.KULLANICI_ID ?? s.EKLEYEN_ID;
    const kullaniciId = rawKullanici != null ? Number(rawKullanici) : null;
    const vezneId = t.vezneKolon && s[t.vezneKolon] != null ? Number(s[t.vezneKolon]) : null;
    const rawCari = t.cariKolon && s[t.cariKolon] != null ? Number(s[t.cariKolon]) : null;
    const cariKartId = rawCari && rawCari > 0 ? rawCari : null;
    return {
        tarih: d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null,
        nolar,
        kullaniciId,
        vezneId,
        cariKartId,
    };
}
/** Kullanıcının işlem gösterme sınırının ilk günü ("YYYY-MM-DD"); sınır yoksa null. Liste uçları bununla süzer. */
export async function gunSiniri(req) {
    return gosterimBaslangici(await kullaniciYetkisi(req));
}
/** Cari kartın kendi işlem gösterme sınırının ilk günü ("YYYY-MM-DD"); sınır yoksa null */
export async function cariGunSiniri(cariKartId, req) {
    if (!cariKartId || isNaN(Number(cariKartId)))
        return null;
    try {
        const { dbServer, dbName } = baglam(req);
        const pool = await getDbPool(dbServer, dbName);
        const res = await pool.request().input("CID", sql.Int, Number(cariKartId)).query(`
      SELECT [ISLEM_GOSTERME_GUN_SAYISI] FROM [dbo].[TODVZ_CARI_KART] WITH (NOLOCK) WHERE [CARI_KART_ID] = @CID
    `);
        const gunSayisi = Number(res.recordset?.[0]?.ISLEM_GOSTERME_GUN_SAYISI || 0);
        if (gunSayisi > 0) {
            return gosterimBaslangici({ yonetici: false, gosterimGunu: gunSayisi });
        }
    }
    catch (err) {
        // ignore
    }
    return null;
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
const kendiKayitlariMesaji = () => "Bu kayıt başka bir kullanıcıya aittir; yalnızca kendi kayıtlarınızı görüntüleyebilir veya düzeltebilirsiniz.";
/**
 * Kayıtlı fişe erişim (aç / sil): gün sınırı veya kullanıcı yetkisi dışındaysa 403. isDelete: silme (ve iptal) uçları —
 * "Kendi kayıtları" kullanıcısı mevcut kaydı silemez; bütün kayıt türlerinin silme uçları bu bayrakla çağırır (#24).
 */
export async function kayitErisimi(req, tur, id, options) {
    const y = await kullaniciYetkisi(req);
    if (y.yonetici)
        return;
    const k = await kayitBilgisi(req, tur, id);
    if (!k)
        return;
    // 1. Kullanıcı gün sınırı denetimi
    if (y.gosterimGunu && !gosterimIcinde(y, k.tarih)) {
        throw ApiError.forbidden(sinirMesaji(y));
    }
    // 2. Cari kartın kendi işlem gösterme gün sınırı denetimi
    if (k.cariKartId) {
        const cSinir = await cariGunSiniri(k.cariKartId, req);
        if (cSinir && k.tarih && k.tarih < cSinir) {
            throw ApiError.forbidden("Bu kayıt cari kartın işlem gösterme gün sınırının dışında; açılamaz, düzeltilemez, silinemez.");
        }
    }
    // 3. Kendi kayıtları yetkisi denetimi
    if (y.kendiKayitlari) {
        if (options?.isDelete) {
            throw ApiError.forbidden("Yetkiniz doğrultusunda mevcut kayıtları silme yetkiniz bulunmamaktadır.");
        }
        const u = req.user;
        const userId = u?.userId ? Number(u.userId) : (u?.id ? Number(u.id) : 0);
        // Kullanıcının veznesi kartından okunur (liste uçları da fisVeznesi ile kart veznesine göre süzer): jetonda vezneId yok,
        // listede görünen aynı vezne fişi açılınca 403 veriyordu (ortak alan denetimi 19.11.2026, #24)
        const userVezneId = (await kullaniciKartVeznesi(userId, baglam(req)).catch(() => null)) ?? 0;
        const kayitKullaniciId = k.kullaniciId ? Number(k.kullaniciId) : null;
        const kayitVezneId = k.vezneId ? Number(k.vezneId) : null;
        const ayniKullanici = kayitKullaniciId !== null && kayitKullaniciId === userId;
        const ayniVezne = userVezneId > 0 && kayitVezneId !== null && kayitVezneId === userVezneId;
        if (!ayniKullanici && !ayniVezne) {
            throw ApiError.forbidden(kendiKayitlariMesaji());
        }
    }
}
/** POS akışında yeniden kayıt süresi (dakika): K15 banka eşleme ve K29 ret sonrası düzeltme kayıttan hemen sonra olur */
const POS_YENIDEN_KAYIT_DK = 30;
/**
 * "Kendi kayıtları" (salt okunur) kullanıcısı için tek istisna: POS ödemeli Sarraf / Perakende / Ticari fişini kendisi az önce
 * (POS_YENIDEN_KAYIT_DK içinde) kaydettiyse POS akışının yeniden kaydı (K15 banka → POS kartı eşlemesi, K29 ret sonrası ödeme
 * düzeltmesi) yapılabilir. Silme ve başka kayıtların düzeltmesi yine kapalı (docs/POS_ENTEGRASYON_YOL_HARITASI.md K15, K29;
 * ortak alan denetimi 19.11.2026, #27). Süre sunucu saatiyle SQL'de ölçülür (sürücünün UTC çevrimine bağlı kalmaz).
 */
async function posAkisiYenidenKayit(req, tur, id) {
    if (tur !== "sarraf" && tur !== "fatura")
        return false;
    const k = pozitif(id);
    const u = req.user;
    const kullaniciId = pozitif(u?.userId ?? u?.id);
    if (!k || !kullaniciId)
        return false;
    const { dbServer, dbName } = baglam(req);
    const pool = await getDbPool(dbServer, dbName);
    const sorgu = tur === "sarraf"
        ? `SELECT 1 AS V FROM dbo.TODVZ_SARRAF_FISI F
       WHERE F.SARRAF_FISI_ID = @I AND F.EKLEYEN_ID = @U AND DATEDIFF(MINUTE, F.EKLEME_ZAMANI, GETDATE()) BETWEEN 0 AND @DK
         AND EXISTS (SELECT 1 FROM dbo.TODVZ_ODEME_SATIRI O WHERE O.SARRAF_FISI_ID = F.SARRAF_FISI_ID AND O.ODEME_ARACI_TURU = 2)`
        : `SELECT 1 AS V FROM dbo.TODVZ_FATURA F
       WHERE F.FATURA_ID = @I AND F.EKLEYEN_ID = @U AND DATEDIFF(MINUTE, F.EKLEME_ZAMANI, GETDATE()) BETWEEN 0 AND @DK
         AND EXISTS (SELECT 1 FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID = F.FATURA_ID AND O.ODEME_ARACI_TURU = 2)`;
    const r = await pool.request().input("I", sql.Int, k).input("U", sql.Int, kullaniciId).input("DK", sql.Int, POS_YENIDEN_KAYIT_DK)
        .query(sorgu).catch(() => ({ recordset: [] }));
    return (r.recordset || []).length > 0;
}
/**
 * Kaydedilecek fişin numara yetkisi. id: düzeltilen kaydın kimliği (yoksa yeni kayıt), tarih: istemcinin gönderdiği fiş
 * tarihi (T1'den beri denetlenmez; geçmiş / ileri gün serbest, çağıranlar değişmesin diye parametre kalır). Dönen `nolar`
 * doluysa istekteki numaralar bu değerlerle değiştirilmeli: yeni kayıtta boş (numaratör verir), düzeltmede kaydın kendi
 * numarası. Yetkiliyse null döner (istek olduğu gibi).
 */
export async function fisKayitYetkisi(req, tur, id, tarih) {
    const y = await kullaniciYetkisi(req);
    if (y.yonetici)
        return { nolar: null, yetki: y };
    const kayit = await kayitBilgisi(req, tur, id);
    if (kayit) {
        if (y.gosterimGunu && !gosterimIcinde(y, kayit.tarih))
            throw ApiError.forbidden(sinirMesaji(y));
        if (y.kendiKayitlari && !(await posAkisiYenidenKayit(req, tur, id))) {
            throw ApiError.forbidden("Yetkiniz doğrultusunda mevcut kayıtları düzeltme veya silme yetkiniz bulunmamaktadır (Salt Okunur).");
        }
    }
    if (y.fisNoDegistirme)
        return { nolar: null, yetki: y };
    const t = KAYIT_TABLOLARI[tur];
    return { nolar: kayit ? kayit.nolar : Object.fromEntries(t.nolar.map((c) => [c, null])), yetki: y };
}

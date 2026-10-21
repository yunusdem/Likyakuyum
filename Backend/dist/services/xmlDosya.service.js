import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { ApiError } from "../utils/ApiError.js";
// 17 karakterli sıfır dolgulu tutar formatlayıcı (örn: 0000128673725.35 veya 0000000010900.00)
export function formatTutarXml(val) {
    const n = isNaN(val) ? 0 : val;
    const fixed = (Math.round(n * 100) / 100).toFixed(2);
    return fixed.padStart(17, "0");
}
// 10 karakterli işlem sayısı formatlayıcı (örn: 0000000153)
export function formatSayiXml(val, uzunluk = 10) {
    const n = Math.floor(isNaN(val) ? 0 : val);
    return String(n).padStart(uzunluk, "0");
}
// YYYYMMDD formatlayıcı
export function formatTarihKisa(d) {
    if (!d)
        return "";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dt.getTime()))
        return "";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const day = String(dt.getDate()).padStart(2, "0");
    return `${y}${m}${day}`;
}
// YYYYMM formatlayıcı
export function formatDonemAy(d) {
    if (!d)
        return "";
    const dt = typeof d === "string" ? new Date(d) : d;
    if (isNaN(dt.getTime()))
        return "";
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    return `${y}${m}`;
}
export const TURKIYE_IL_PLAKA_KODLARI = {
    "ADANA": "01",
    "ADIYAMAN": "02",
    "AFYON": "03",
    "AFYONKARAHISAR": "03",
    "AFYONKARAHİSAR": "03",
    "AGRI": "04",
    "AĞRI": "04",
    "AMASYA": "05",
    "ANKARA": "06",
    "ANTALYA": "07",
    "ARTVIN": "08",
    "ARTVİN": "08",
    "AYDIN": "09",
    "BALIKESIR": "10",
    "BALIKESİR": "10",
    "BILECIK": "11",
    "BİLECİK": "11",
    "BINGOL": "12",
    "BİNGÖL": "12",
    "BITLIS": "13",
    "BİTLİS": "13",
    "BOLU": "14",
    "BURDUR": "15",
    "BURSA": "16",
    "CANAKKALE": "17",
    "ÇANAKKALE": "17",
    "CANKIRI": "18",
    "ÇANKIRI": "18",
    "CORUM": "19",
    "ÇORUM": "19",
    "DENIZLI": "20",
    "DENİZLİ": "20",
    "DIYARBAKIR": "21",
    "DİYARBAKIR": "21",
    "EDIRNE": "22",
    "EDİRNE": "22",
    "ELAZIG": "23",
    "ELAZIĞ": "23",
    "ERZINCAN": "24",
    "ERZİNCAN": "24",
    "ERZURUM": "25",
    "ESKISEHIR": "26",
    "ESKİŞEHİR": "26",
    "GAZIANTEP": "27",
    "GAZİANTEP": "27",
    "GIRESUN": "28",
    "GİRESUN": "28",
    "GUMUSHANE": "29",
    "GÜMÜŞHANE": "29",
    "HAKKARI": "30",
    "HAKKARİ": "30",
    "HATAY": "31",
    "ISPARTA": "32",
    "ICEL": "33",
    "İÇEL": "33",
    "MERSIN": "33",
    "MERSİN": "33",
    "ISTANBUL": "34",
    "İSTANBUL": "34",
    "IZMIR": "35",
    "İZMİR": "35",
    "KARS": "36",
    "KASTAMONU": "37",
    "KAYSERI": "38",
    "KAYSERİ": "38",
    "KIRKLARELI": "39",
    "KIRKLARELİ": "39",
    "KIRSEHIR": "40",
    "KIRŞEHİR": "40",
    "KOCAELI": "41",
    "KOCAELİ": "41",
    "KONYA": "42",
    "KUTAHYA": "43",
    "KÜTAHYA": "43",
    "MALATYA": "44",
    "MANISA": "45",
    "MANİSA": "45",
    "KAHRAMANMARAS": "46",
    "KAHRAMANMARAŞ": "46",
    "MARAS": "46",
    "MARAŞ": "46",
    "MARDIN": "47",
    "MARDİN": "47",
    "MUGLA": "48",
    "MUĞLA": "48",
    "MUS": "49",
    "MUŞ": "49",
    "NEVSEHIR": "50",
    "NEVŞEHİR": "50",
    "NIGDE": "51",
    "NİĞDE": "51",
    "ORDU": "52",
    "RIZE": "53",
    "RİZE": "53",
    "SAKARYA": "54",
    "SAMSUN": "55",
    "SIIRT": "56",
    "SİİRT": "56",
    "SINOP": "57",
    "SİNOP": "57",
    "SIVAS": "58",
    "SİVAS": "58",
    "TEKIRDAG": "59",
    "TEKİRDAĞ": "59",
    "TOKAT": "60",
    "TRABZON": "61",
    "TUNCELI": "62",
    "TUNCELİ": "62",
    "SANLIURFA": "63",
    "ŞANLIURFA": "63",
    "URFA": "63",
    "USAK": "64",
    "UŞAK": "64",
    "VAN": "65",
    "YOZGAT": "66",
    "ZONGULDAK": "67",
    "AKSARAY": "68",
    "BAYBURT": "69",
    "KARAMAN": "70",
    "KIRIKKALE": "71",
    "BATMAN": "72",
    "SIRNAK": "73",
    "ŞIRNAK": "73",
    "BARTIN": "74",
    "ARDAHAN": "75",
    "IGDIR": "76",
    "IĞDIR": "76",
    "YALOVA": "77",
    "KARABUK": "78",
    "KARABÜK": "78",
    "KILIS": "79",
    "KİLİS": "79",
    "OSMANIYE": "80",
    "OSMANİYE": "80",
    "DUZCE": "81",
    "DÜZCE": "81",
};
export const normalizeIlKodu = (ilAdi, mevcutIlKodu) => {
    if (mevcutIlKodu && /^\d{1,2}$/.test(mevcutIlKodu.trim())) {
        return mevcutIlKodu.trim().padStart(2, "0");
    }
    if (!ilAdi)
        return "20";
    const clean = ilAdi.trim().toLocaleUpperCase("tr-TR").replace(/[^A-ZÇĞİÖŞÜ]/g, "");
    if (TURKIYE_IL_PLAKA_KODLARI[clean]) {
        return TURKIYE_IL_PLAKA_KODLARI[clean];
    }
    const ascii = clean
        .replace(/İ/g, "I")
        .replace(/Ç/g, "C")
        .replace(/Ğ/g, "G")
        .replace(/Ö/g, "O")
        .replace(/Ş/g, "S")
        .replace(/Ü/g, "U");
    return TURKIYE_IL_PLAKA_KODLARI[ascii] || "20";
};
export class XmlDosyaService {
    static async getPool(ctx) {
        return getDbPool(ctx?.dbServer, ctx?.dbName);
    }
    /**
     * 1. Merkez Kur Kontrolü
     * Belirtilen tarih aralığındaki döviz fişlerinin işlem tarihlerinde Merkez Bankası kurlarının
     * (TODVZ_KUR_TABLOSU TUR IN (1, 3) veya fişteki MERKEZ_USD_KURU) mevcut olup olmadığını kontrol eder.
     */
    static async kontrolMerkezKur(filter, ctx) {
        const pool = await this.getPool(ctx);
        const baslangic = new Date(filter.ilkTarih);
        baslangic.setHours(0, 0, 0, 0);
        const bitis = new Date(filter.sonTarih);
        bitis.setHours(23, 59, 59, 999);
        const req = pool.request();
        req.input("baslangic", sql.DateTime, baslangic);
        req.input("bitis", sql.DateTime, bitis);
        let ekFiltre = "";
        if (filter.belgeIslemNo?.trim()) {
            req.input("belgeNo", sql.VarChar(50), filter.belgeIslemNo.trim());
            ekFiltre = " AND (F.SERI_NO = @belgeNo OR F.BELGE_NO = @belgeNo)";
        }
        const query = `
      SELECT 
        F.FIS_ID,
        CONVERT(varchar(10), F.TARIH, 104) AS TarihStr,
        F.TARIH AS IslemTarihi,
        ISNULL(F.SERI_NO, '') AS SeriNo,
        ISNULL(F.BELGE_NO, '') AS BelgeNo,
        ISNULL(F.MERKEZ_USD_KURU, 0) AS FisOnKur,
        (
          SELECT COUNT(*) 
          FROM dbo.TODVZ_KUR_TABLOSU KT
          WHERE KT.TUR IN (1, 3) 
            AND CAST(KT.TARIH AS DATE) = CAST(F.TARIH AS DATE)
        ) AS TcmbKurSayisi
      FROM dbo.TODVZ_FIS F
      WHERE ISNULL(F.IPTAL, 0) = 0
        AND F.TARIH >= @baslangic 
        AND F.TARIH <= @bitis
        ${ekFiltre}
      ORDER BY F.TARIH ASC, F.FIS_ID ASC
    `;
        const res = await req.query(query);
        const sonuclar = [];
        for (const row of res.recordset) {
            const seri = row.SeriNo || row.BelgeNo || `#${row.FIS_ID}`;
            const hasKur = Number(row.TcmbKurSayisi) > 0 || Number(row.FisOnKur) > 0;
            if (!hasKur) {
                sonuclar.push({
                    tarih: row.TarihStr,
                    seriNo: seri,
                    aciklama: "Merkez Bankası kuru bulunamadı",
                    durum: "hata",
                });
            }
            else {
                sonuclar.push({
                    tarih: row.TarihStr,
                    seriNo: seri,
                    aciklama: "Merkez Bankası kuru mevcut",
                    durum: "tamam",
                });
            }
        }
        return sonuclar;
    }
    /**
     * 2. Firma Kontrolü
     * TODVZ_TANIM tablosundaki firma bilgilerinin VİM XML standartlarına uygunluğunu denetler.
     */
    static async kontrolFirma(ctx) {
        const pool = await this.getPool(ctx);
        const query = `
      SELECT TOP 1
        LTRIM(RTRIM(ISNULL(T.VERGI_KIMLIK_NO, ''))) AS VergiNo,
        LTRIM(RTRIM(ISNULL(T.FIRMA_ADI, ''))) AS Unvan,
        LTRIM(RTRIM(ISNULL(T.SUBE_KODU, '1'))) AS SubeKodu,
        LTRIM(RTRIM(ISNULL(T.SUBE_ADI, ''))) AS SubeAdi,
        LTRIM(RTRIM(ISNULL(T.ADRES, ''))) AS Adres,
        LTRIM(RTRIM(ISNULL(ILC.AD, ''))) AS IlceAdi,
        LTRIM(RTRIM(ISNULL(NULLIF(LTRIM(RTRIM(PK.KOD)), ''), ISNULL(PK.AD, '')))) AS PostaKodu,
        LTRIM(RTRIM(ISNULL(IL.KOD, ''))) AS IlKodu,
        LTRIM(RTRIM(ISNULL(IL.AD, ''))) AS IlAdi
      FROM dbo.TODVZ_TANIM T
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI ILC ON ILC.TABLO_MADDESI_ID = T.ILCE_ID AND ILC.TUR = 2
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI PK ON PK.TABLO_MADDESI_ID = T.POSTA_KODU_ID AND PK.TUR IN (1, 4)
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI IL ON IL.TABLO_MADDESI_ID = T.IL_ID AND IL.TUR = 3
    `;
        const res = await pool.request().query(query);
        const row = res.recordset[0] || {};
        const eksikler = [];
        const vergiNo = String(row.VergiNo || "");
        const unvan = String(row.Unvan || "");
        const subeKodu = String(row.SubeKodu || "1");
        const subeAdi = String(row.SubeAdi || unvan.slice(0, 30));
        const adres = String(row.Adres || "");
        const ilceAdi = String(row.IlceAdi || "");
        const postaKodu = String(row.PostaKodu || "");
        const ilAdi = String(row.IlAdi || "ADANA");
        const ilKodu = normalizeIlKodu(ilAdi, String(row.IlKodu || ""));
        if (!vergiNo)
            eksikler.push("Vergi Kimlik Numarası (VKN) eksik.");
        else if (vergiNo.length < 10)
            eksikler.push("Vergi Kimlik Numarası en az 10 haneli olmalıdır.");
        if (!unvan)
            eksikler.push("Firma ünvanı eksik.");
        if (!adres)
            eksikler.push("Adres bilgisi eksik.");
        if (!ilceAdi)
            eksikler.push("İlçe adı eksik.");
        if (!ilAdi)
            eksikler.push("İl adı eksik.");
        if (!ilKodu)
            eksikler.push("İl plaka kodu eksik.");
        return {
            vergiNo,
            unvan,
            subeKodu,
            subeAdi,
            adres,
            ilceAdi,
            postaKodu,
            ilKodu,
            ilAdi,
            eksikler,
            gecerli: eksikler.length === 0,
        };
    }
    /**
     * 3. Fiş Kontrolü
     * Döviz fişlerinin başlık, kimlik ve adres bilgilerini denetler.
     */
    static async kontrolFis(filter, ctx) {
        const pool = await this.getPool(ctx);
        const baslangic = new Date(filter.ilkTarih);
        baslangic.setHours(0, 0, 0, 0);
        const bitis = new Date(filter.sonTarih);
        bitis.setHours(23, 59, 59, 999);
        const req = pool.request();
        req.input("baslangic", sql.DateTime, baslangic);
        req.input("bitis", sql.DateTime, bitis);
        let ekFiltre = "";
        if (filter.belgeIslemNo?.trim()) {
            req.input("belgeNo", sql.VarChar(50), filter.belgeIslemNo.trim());
            ekFiltre = " AND (F.SERI_NO = @belgeNo OR F.BELGE_NO = @belgeNo)";
        }
        const query = `
      SELECT 
        F.FIS_ID,
        CONVERT(varchar(10), F.TARIH, 104) AS TarihStr,
        ISNULL(F.SERI_NO, '') AS SeriNo,
        ISNULL(F.BELGE_NO, '') AS BelgeNo,
        COALESCE(NULLIF(LTRIM(RTRIM(F.UNVAN)), ''), NULLIF(LTRIM(RTRIM(C.AD)), ''), '') AS Unvan,
        COALESCE(NULLIF(LTRIM(RTRIM(F.BABA_ADI)), ''), NULLIF(LTRIM(RTRIM(C.BABA_ADI)), ''), '') AS BabaAdi,
        COALESCE(NULLIF(LTRIM(RTRIM(F.VERGI_KIMLIK_NO)), ''), NULLIF(LTRIM(RTRIM(C.VERGI_KIMLIK_NO)), ''), '') AS VergiKimlikNo,
        COALESCE(NULLIF(LTRIM(RTRIM(F.ADRES)), ''), NULLIF(LTRIM(RTRIM(C.ADRES)), ''), '') AS Adres,
        COALESCE(ILC.AD, '') AS IlceAdi,
        COALESCE(NULLIF(LTRIM(RTRIM(PK.KOD)), ''), LTRIM(RTRIM(PK.AD)), '') AS PostaKodu,
        COALESCE(IL.KOD, CIL.KOD, '') AS IlKodu,
        COALESCE(IL.AD, CIL.AD, '') AS IlAdi,
        COALESCE(ULK.KOD, 'TR') AS UyrukKodu,
        COALESCE(ULK.AD, 'TÜRKİYE') AS UlkeAdi,
        COALESCE(HY.KOD, CASE WHEN LEN(COALESCE(NULLIF(F.VERGI_KIMLIK_NO, ''), C.VERGI_KIMLIK_NO, '')) = 10 AND F.KISILIK_TIPI = 1 THEN '18' ELSE '01' END) AS HukukiYapiKodu,
        ISNULL(VD.AD, '') AS VergiDairesi,
        F.KISILIK_TIPI
      FROM dbo.TODVZ_FIS F
      LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = F.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI ILC ON ILC.TABLO_MADDESI_ID = COALESCE(F.ILCE_ID, C.ILCE_ID) AND ILC.TUR = 2
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI PK ON PK.TABLO_MADDESI_ID = COALESCE(F.POSTA_KODU_ID, C.POSTA_KODU_ID) AND PK.TUR IN (1, 4)
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI IL ON IL.TABLO_MADDESI_ID = F.IL_ID AND IL.TUR = 3
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI CIL ON CIL.TABLO_MADDESI_ID = C.IL_ID AND CIL.TUR = 3
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI HY ON HY.TABLO_MADDESI_ID = F.HUKUKI_YAPI_ID AND HY.TUR = 5
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI VD ON VD.TABLO_MADDESI_ID = F.VERGI_DAIRESI_ID AND VD.TUR = 0
      LEFT JOIN dbo.TODVZ_ULKE ULK ON ULK.ULKE_ID = COALESCE(F.UYRUK_ID, F.ULKE_ID)
      WHERE ISNULL(F.IPTAL, 0) = 0
        AND F.TARIH >= @baslangic 
        AND F.TARIH <= @bitis
        ${ekFiltre}
      ORDER BY F.TARIH ASC, F.FIS_ID ASC
    `;
        const res = await req.query(query);
        const sonuclar = [];
        for (const row of res.recordset) {
            const unvanTrim = String(row.Unvan || "").trim();
            // Ad & Soyad ayrıştırma
            const unvanParcalari = unvanTrim.split(/\s+/);
            let ad = "";
            let soyad = "";
            if (unvanParcalari.length === 1) {
                soyad = unvanParcalari[0];
            }
            else if (unvanParcalari.length > 1) {
                soyad = unvanParcalari[unvanParcalari.length - 1];
                ad = unvanParcalari.slice(0, -1).join(" ");
            }
            const vknVeyaTckn = String(row.VergiKimlikNo || "").trim();
            const isTckn = vknVeyaTckn.length === 11 && /^\d+$/.test(vknVeyaTckn);
            const isVkn = vknVeyaTckn.length === 10 && /^\d+$/.test(vknVeyaTckn);
            const tckn = isTckn ? vknVeyaTckn : "";
            const vkn = isVkn ? vknVeyaTckn : "";
            const ilKodu = normalizeIlKodu(row.IlAdi, row.IlKodu);
            // Fiş Kontrolünde Tüm Eksikleri Eksiksiz Tespit Etme
            const hatalar = [];
            // 1. Seri No / Belge No
            if (!row.SeriNo?.trim()) {
                hatalar.push("Seri No eksik");
            }
            if (!row.BelgeNo?.trim()) {
                hatalar.push("Belge No eksik");
            }
            // 2. Müşteri Adı / Ünvanı
            if (!unvanTrim) {
                hatalar.push("Müşteri adı/ünvanı eksik");
            }
            // 3. TCKN / VKN
            if (row.HukukiYapiKodu === "18") {
                if (!vknVeyaTckn) {
                    hatalar.push("VKN eksik");
                }
                else if (!isVkn) {
                    hatalar.push(`VKN 10 hane olmalı (${vknVeyaTckn.length} hane)`);
                }
            }
            else {
                if (!vknVeyaTckn) {
                    hatalar.push("TCKN eksik");
                }
                else if (!isTckn) {
                    hatalar.push(`TCKN 11 hane olmalı (${vknVeyaTckn.length} hane)`);
                }
            }
            // 4. Baba Adı (TR Vatandaşı Gerçek Kişi için)
            if (row.HukukiYapiKodu !== "18" && row.UyrukKodu === "TR" && !row.BabaAdi?.trim()) {
                hatalar.push("Baba adı eksik");
            }
            // 5. Adres Bilgisi
            if (!row.Adres?.trim()) {
                hatalar.push("Adres eksik");
            }
            // 6. İlçe Bilgisi
            if (!row.IlceAdi?.trim()) {
                hatalar.push("İlçe eksik");
            }
            // 7. İl Adı ve İl Kodu
            if (!row.IlAdi?.trim()) {
                hatalar.push("İl adı eksik");
            }
            if (!ilKodu || !/^\d{2}$/.test(ilKodu.trim())) {
                hatalar.push("İl kodu eksik");
            }
            // 8. Posta Kodu
            if (!row.PostaKodu?.trim()) {
                hatalar.push("Posta kodu eksik");
            }
            // 9. Vergi Dairesi (Kurumsal için)
            if (row.HukukiYapiKodu === "18" && !row.VergiDairesi?.trim()) {
                hatalar.push("Vergi dairesi eksik");
            }
            sonuclar.push({
                fisId: row.FIS_ID,
                tarih: row.TarihStr,
                seriNo: String(row.SeriNo || row.BelgeNo || `#${row.FIS_ID}`).trim(),
                vrgSoyad: soyad || vknVeyaTckn,
                ad,
                babaAdi: String(row.BabaAdi || "").trim(),
                belgeNo: String(row.BelgeNo || "").trim(),
                uyruk: row.UyrukKodu || "TR",
                hukukiYapi: row.HukukiYapiKodu || "01",
                tckn: tckn || vknVeyaTckn,
                vkn: vkn || (row.HukukiYapiKodu === "18" ? vknVeyaTckn : ""),
                adres: row.Adres || "",
                ilce: row.IlceAdi || "",
                postaKodu: row.PostaKodu || "",
                ilKodu,
                ilAdi: row.IlAdi || "",
                ulke: row.UlkeAdi || "TÜRKİYE",
                vergiNo: vknVeyaTckn,
                vergiDairesi: row.VergiDairesi || "",
                hatalar,
                gecerli: hatalar.length === 0,
            });
        }
        return sonuclar;
    }
    /**
     * 4. Fiş Satırı Kontrolü
     * Fiş satırlarının döviz cinsi, işlem tipi, miktar ve tutarlarını denetler.
     */
    static async kontrolFisSatiri(filter, ctx) {
        const pool = await this.getPool(ctx);
        const baslangic = new Date(filter.ilkTarih);
        baslangic.setHours(0, 0, 0, 0);
        const bitis = new Date(filter.sonTarih);
        bitis.setHours(23, 59, 59, 999);
        const req = pool.request();
        req.input("baslangic", sql.DateTime, baslangic);
        req.input("bitis", sql.DateTime, bitis);
        let ekFiltre = "";
        if (filter.belgeIslemNo?.trim()) {
            req.input("belgeNo", sql.VarChar(50), filter.belgeIslemNo.trim());
            ekFiltre = " AND (F.SERI_NO = @belgeNo OR F.BELGE_NO = @belgeNo)";
        }
        const query = `
      SELECT 
        F.FIS_ID,
        CONVERT(varchar(10), F.TARIH, 104) AS TarihStr,
        ISNULL(F.SERI_NO, '') AS SeriNo,
        ISNULL(F.BELGE_NO, '') AS BelgeNo,
        S.SATIR_NO AS SatirNo,
        P.KOD AS ParaKodu,
        F.TIP AS FisTipi,
        S.MIKTAR AS Miktar,
        S.TUTAR AS TutarTl,
        S.KUR AS Kur
      FROM dbo.TODVZ_FIS_SATIRI S
      JOIN dbo.TODVZ_FIS F ON F.FIS_ID = S.FIS_ID
      LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID = S.PARA_ID
      WHERE ISNULL(F.IPTAL, 0) = 0
        AND F.TARIH >= @baslangic 
        AND F.TARIH <= @bitis
        ${ekFiltre}
      ORDER BY F.TARIH ASC, F.FIS_ID ASC, S.SATIR_NO ASC
    `;
        const res = await req.query(query);
        const sonuclar = [];
        for (const row of res.recordset) {
            const hatalar = [];
            const paraKodu = String(row.ParaKodu || "").trim().toUpperCase();
            const miktar = Number(row.Miktar || 0);
            const tutarTl = Number(row.TutarTl || 0);
            const islemTipi = row.FisTipi === 0 ? "1 (Alış)" : "2 (Satış)";
            if (!paraKodu || paraKodu === "TL" || paraKodu === "TRY") {
                hatalar.push("Geçersiz veya eksik döviz cinsi kodu");
            }
            if (miktar <= 0) {
                hatalar.push("Miktar sıfır veya negatif olamaz");
            }
            if (tutarTl <= 0) {
                hatalar.push("TL tutarı sıfır veya negatif olamaz");
            }
            sonuclar.push({
                fisId: row.FIS_ID,
                satirId: row.SatirNo,
                tarih: row.TarihStr,
                seriNo: row.SeriNo || row.BelgeNo || `#${row.FIS_ID}`,
                satirNo: row.SatirNo,
                xmlParaKodu: paraKodu,
                islemTipi,
                miktar,
                tutarTl,
                hatalar,
                gecerli: hatalar.length === 0,
            });
        }
        return sonuclar;
    }
    /**
     * 5. XML Dosyası Oluşturma
     * Hazine / MASAK standart VİM Döviz İşlemleri Transfer XML çıktısı üretir.
     */
    static async olusturXml(params, ctx) {
        const pool = await this.getPool(ctx);
        // 1) Firma Tanımı oku
        const firmaRes = await pool.request().query(`
      SELECT TOP 1
        LTRIM(RTRIM(ISNULL(T.VERGI_KIMLIK_NO, ''))) AS VergiNo,
        LTRIM(RTRIM(ISNULL(T.FIRMA_ADI, ''))) AS Unvan,
        LTRIM(RTRIM(ISNULL(T.SUBE_KODU, '1'))) AS SubeKodu,
        LTRIM(RTRIM(ISNULL(T.SUBE_ADI, ''))) AS SubeAdi,
        LTRIM(RTRIM(ISNULL(T.ADRES, ''))) AS Adres,
        LTRIM(RTRIM(ISNULL(ILC.AD, ''))) AS IlceAdi,
        LTRIM(RTRIM(ISNULL(NULLIF(LTRIM(RTRIM(PK.KOD)), ''), ISNULL(PK.AD, '')))) AS PostaKodu,
        LTRIM(RTRIM(ISNULL(IL.KOD, ''))) AS IlKodu,
        LTRIM(RTRIM(ISNULL(IL.AD, ''))) AS IlAdi,
        LTRIM(RTRIM(ISNULL(T.DOSYA_NO, ''))) AS TanımDosyaNo
      FROM dbo.TODVZ_TANIM T
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI ILC ON ILC.TABLO_MADDESI_ID = T.ILCE_ID AND ILC.TUR = 2
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI PK ON PK.TABLO_MADDESI_ID = T.POSTA_KODU_ID AND PK.TUR IN (1, 4)
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI IL ON IL.TABLO_MADDESI_ID = T.IL_ID AND IL.TUR = 3
    `);
        const firma = firmaRes.recordset[0] || {};
        const vkn = firma.VergiNo || "0000000000";
        const unvan = firma.Unvan || "YETKİLİ MÜESSESE A.Ş.";
        const subeKodu = firma.SubeKodu || "1";
        const subeAdi = firma.SubeAdi || (unvan.split(/\s+/)[0] || "MERKEZ");
        const adres = firma.Adres || "";
        const ilceAdi = firma.IlceAdi || "";
        const postaKodu = firma.PostaKodu || "";
        const ilAdi = firma.IlAdi || "DENİZLİ";
        const ilKodu = normalizeIlKodu(ilAdi, firma.IlKodu);
        const donemBas = formatDonemAy(params.ilkTarih);
        const donemSon = formatDonemAy(params.sonTarih);
        const bilgidonem = `${donemBas}-${donemSon}`;
        const dosyaNoNumeric = parseInt(params.dosyaNo || firma.TanımDosyaNo || "0", 10) || 0;
        const dosyaNoStr = String(dosyaNoNumeric).padStart(3, "0");
        const bilgiTarihStr = formatTarihKisa(params.hazirlamaTarihi || new Date());
        let dosyaAdi = params.dosyaAdi?.trim() || "";
        if (!dosyaAdi) {
            dosyaAdi = `dov${donemBas.slice(2)}${dosyaNoStr}`;
        }
        if (!dosyaAdi.toLowerCase().endsWith(".xml")) {
            dosyaAdi += ".xml";
        }
        // Eğer "İşlem yok" seçilmişse boş XML döndür
        if (params.islemYok) {
            const bosXml = `<?xml version="1.0" encoding="UTF-8" ?>
<vimveritransferi xsi:noNamespaceSchemaLocation="doviz_islemleri.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
	<protokol>
		<genel kuruluskodu="12">
			<vkn>${escapeXml(vkn)}</vkn>
			<unvan>${escapeXml(unvan)}</unvan>
			<adres>
				<mahcadkapidaire>${escapeXml(adres)}</mahcadkapidaire>
				<ilceadi>${escapeXml(ilceAdi)}</ilceadi>
				${postaKodu ? `<pk>${escapeXml(postaKodu)}</pk>` : ""}
				<iladi>${escapeXml(ilAdi)}</iladi>
				<ilkodu>${escapeXml(ilKodu)}</ilkodu>
			</adres>
		</genel>
		<ozel>
			<bilgidonem>${bilgidonem}</bilgidonem>
			<dosyano>${dosyaNoStr}</dosyano>
			<bilgitarih>${bilgiTarihStr}</bilgitarih>
			<topislemsayisi>0000000000</topislemsayisi>
			<toptutar>0000000000000.00</toptutar>
		</ozel>
	</protokol>
</vimveritransferi>`;
            return {
                xmlContent: bosXml,
                dosyaAdi,
                topIslemSayisi: 0,
                topTutar: 0,
                bilgidonem,
            };
        }
        // 2) Fiş ve satır kayıtlarını getir
        const baslangic = new Date(params.ilkTarih);
        baslangic.setHours(0, 0, 0, 0);
        const bitis = new Date(params.sonTarih);
        bitis.setHours(23, 59, 59, 999);
        const req = pool.request();
        req.input("baslangic", sql.DateTime, baslangic);
        req.input("bitis", sql.DateTime, bitis);
        const query = `
      SELECT 
        F.FIS_ID,
        F.TARIH AS IslemTarihi,
        ISNULL(F.SERI_NO, '') AS SeriNo,
        ISNULL(F.BELGE_NO, '') AS BelgeNo,
        ISNULL(F.UNVAN, '') AS Unvan,
        ISNULL(F.BABA_ADI, '') AS BabaAdi,
        ISNULL(F.VERGI_KIMLIK_NO, '') AS VergiKimlikNo,
        ISNULL(F.ADRES, '') AS Adres,
        COALESCE(F.ILCE, ILC.AD, '') AS IlceAdi,
        COALESCE(NULLIF(LTRIM(RTRIM(F.POSTA_KODU)), ''), NULLIF(LTRIM(RTRIM(PK.KOD)), ''), LTRIM(RTRIM(PK.AD)), '') AS PostaKodu,
        COALESCE(IL.KOD, '') AS IlKodu,
        COALESCE(F.IL, IL.AD, '') AS IlAdi,
        COALESCE(ULK.KOD, 'TR') AS UyrukKodu,
        COALESCE(ULK.AD, 'TÜRKİYE') AS UlkeAdi,
        COALESCE(HY.KOD, CASE WHEN LEN(F.VERGI_KIMLIK_NO) = 10 AND F.KISILIK_TIPI = 1 THEN '18' ELSE '01' END) AS HukukiYapiKodu,
        F.TIP AS FisTipi,
        S.SATIR_NO AS SatirNo,
        P.KOD AS ParaKodu,
        S.MIKTAR AS Miktar,
        S.TUTAR AS TutarTl
      FROM dbo.TODVZ_FIS_SATIRI S
      JOIN dbo.TODVZ_FIS F ON F.FIS_ID = S.FIS_ID
      LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID = S.PARA_ID
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI ILC ON ILC.TABLO_MADDESI_ID = F.ILCE_ID AND ILC.TUR = 2
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI PK ON PK.TABLO_MADDESI_ID = F.POSTA_KODU_ID AND PK.TUR IN (1, 4)
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI IL ON IL.TABLO_MADDESI_ID = F.IL_ID AND IL.TUR = 3
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI HY ON HY.TABLO_MADDESI_ID = F.HUKUKI_YAPI_ID AND HY.TUR = 5
      LEFT JOIN dbo.TODVZ_ULKE ULK ON ULK.ULKE_ID = COALESCE(F.UYRUK_ID, F.ULKE_ID)
      WHERE ISNULL(F.IPTAL, 0) = 0
        AND F.TARIH >= @baslangic 
        AND F.TARIH <= @bitis
        AND P.KOD IS NOT NULL 
        AND P.KOD NOT IN ('TL', 'TRY')
      ORDER BY F.TARIH ASC, F.FIS_ID ASC, S.SATIR_NO ASC
    `;
        const res = await req.query(query);
        const rows = res.recordset;
        let topIslemSayisi = 0;
        let topTutar = 0;
        const islemlerXmlList = [];
        for (const row of rows) {
            topIslemSayisi++;
            const tutarTl = Number(row.TutarTl || 0);
            const miktar = Number(row.Miktar || 0);
            topTutar += tutarTl;
            const unvanTrim = String(row.Unvan || "").trim();
            const unvanParcalari = unvanTrim.split(/\s+/);
            let ad = "";
            let soyad = "";
            const hukukiYapi = String(row.HukukiYapiKodu || "01");
            const uyruk = String(row.UyrukKodu || "TR");
            const vknVeyaTckn = String(row.VergiKimlikNo || "").trim();
            let nodeVkn = "2222222222";
            let nodeTckn = "22222222222";
            if (hukukiYapi === "18") {
                // Tüzel kişi (Şirket / Banka)
                nodeVkn = vknVeyaTckn && vknVeyaTckn.length === 10 ? vknVeyaTckn : (vknVeyaTckn || "2222222222");
                nodeTckn = "22222222222";
                if (unvanParcalari.length > 1) {
                    soyad = unvanParcalari.slice(0, -1).join(" ");
                    ad = unvanParcalari[unvanParcalari.length - 1];
                }
                else {
                    soyad = unvanTrim;
                    ad = ".";
                }
            }
            else if (uyruk !== "TR" || hukukiYapi === "02") {
                // Yabancı şahıs
                nodeTckn = "99999999999";
                nodeVkn = vknVeyaTckn.length === 10 ? vknVeyaTckn : "2222222222";
                if (unvanParcalari.length > 1) {
                    soyad = unvanParcalari[unvanParcalari.length - 1];
                    ad = unvanParcalari.slice(0, -1).join(" ");
                }
                else {
                    soyad = unvanTrim;
                }
            }
            else {
                // Gerçek kişi (TR vatandaşı)
                nodeTckn = vknVeyaTckn.length === 11 ? vknVeyaTckn : "22222222222";
                nodeVkn = vknVeyaTckn.length === 10 ? vknVeyaTckn : "2222222222";
                if (unvanParcalari.length > 1) {
                    soyad = unvanParcalari[unvanParcalari.length - 1];
                    ad = unvanParcalari.slice(0, -1).join(" ");
                }
                else {
                    soyad = unvanTrim;
                }
            }
            const islemTipi = row.FisTipi === 0 ? "1" : "2"; // 1: Alış, 2: Satış
            const islemTarihi = formatTarihKisa(row.IslemTarihi);
            let belgeNo = "";
            if (params.belgeIslemNoTuru === "seri") {
                belgeNo = row.SeriNo || row.BelgeNo || String(row.FIS_ID);
            }
            else {
                belgeNo = row.BelgeNo || row.SeriNo || String(row.FIS_ID);
            }
            const dovizCinsi = String(row.ParaKodu || "USD").toUpperCase();
            const miktarStr = formatTutarXml(miktar);
            const tutarTlStr = formatTutarXml(tutarTl);
            const kisiAdres = row.Adres || adres;
            const kisiIlce = row.IlceAdi || ilceAdi;
            const kisiIl = row.IlAdi || ilAdi;
            const kisiIlKodu = row.IlKodu || ilKodu;
            const kisiPk = row.PostaKodu || "";
            const kisiUlkeKodu = uyruk === "TR" ? "052" : (uyruk === "DE" ? "004" : "052");
            const itemXml = `	<islemler islemturu="12042">
		<kisi uyruk="${escapeXml(uyruk)}" hukukiyapi="${escapeXml(hukukiYapi)}">
			<vkn>${escapeXml(nodeVkn)}</vkn>
			<tckn>${escapeXml(nodeTckn)}</tckn>
			<soyad>${escapeXml(soyad)}</soyad>
			<ad>${escapeXml(ad)}</ad>
			${row.BabaAdi?.trim() ? `<babaadi>${escapeXml(row.BabaAdi.trim())}</babaadi>` : ""}
			<adres>
				<mahcadkapidaire>${escapeXml(kisiAdres)}</mahcadkapidaire>
				<ilceadi>${escapeXml(kisiIlce)}</ilceadi>
				${kisiPk ? `<pk>${escapeXml(kisiPk)}</pk>` : ""}
				<ilkodu>${escapeXml(kisiIlKodu)}</ilkodu>
				<iladi>${escapeXml(kisiIl)}</iladi>
				<ulkekodu>${escapeXml(kisiUlkeKodu)}</ulkekodu>
			</adres>
		</kisi>
		<islem>
			<islemtipi>${islemTipi}</islemtipi>
			<subekodu>${escapeXml(subeKodu)}</subekodu>
			<subeadi>${escapeXml(subeAdi)}</subeadi>
			<islemtarihi>${islemTarihi}</islemtarihi>
			<belgeislemno>${escapeXml(belgeNo)}</belgeislemno>
			<dovizcinsi>${escapeXml(dovizCinsi)}</dovizcinsi>
			<miktar>${miktarStr}</miktar>
			<tutartl>${tutarTlStr}</tutartl>
		</islem>
	</islemler>`;
            islemlerXmlList.push(itemXml);
        }
        const topIslemSayisiStr = formatSayiXml(topIslemSayisi, 10);
        const topTutarStr = formatTutarXml(topTutar);
        const fullXml = `<?xml version="1.0" encoding="UTF-8" ?>
<vimveritransferi xsi:noNamespaceSchemaLocation="doviz_islemleri.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
	<protokol>
		<genel kuruluskodu="12">
			<vkn>${escapeXml(vkn)}</vkn>
			<unvan>${escapeXml(unvan)}</unvan>
			<adres>
				<mahcadkapidaire>${escapeXml(adres)}</mahcadkapidaire>
				<ilceadi>${escapeXml(ilceAdi)}</ilceadi>
				${postaKodu ? `<pk>${escapeXml(postaKodu)}</pk>` : ""}
				<iladi>${escapeXml(ilAdi)}</iladi>
				<ilkodu>${escapeXml(ilKodu)}</ilkodu>
			</adres>
		</genel>
		<ozel>
			<bilgidonem>${bilgidonem}</bilgidonem>
			<dosyano>${dosyaNoStr}</dosyano>
			<bilgitarih>${bilgiTarihStr}</bilgitarih>
			<topislemsayisi>${topIslemSayisiStr}</topislemsayisi>
			<toptutar>${topTutarStr}</toptutar>
		</ozel>
	</protokol>
${islemlerXmlList.join("\n")}
</vimveritransferi>`;
        return {
            xmlContent: fullXml,
            dosyaAdi,
            topIslemSayisi,
            topTutar,
            bilgidonem,
        };
    }
    /**
     * 6. Dosya Birleştirme
     * İki XML dosyasındaki (Kaynak ve Hedef) tüm <islemler> kayıtlarını birleştirir,
     * toplam işlem sayısı ve tutarı yeniden hesaplar.
     */
    static birlestirXml(params) {
        const { kaynakXml, hedefXml } = params;
        if (!kaynakXml?.trim() || !hedefXml?.trim()) {
            throw ApiError.badRequest("Kaynak dosya ve hedef dosya içerikleri zorunludur.");
        }
        // Regexp ile <islemler ...>...</islemler> bloklarını çıkar
        const islemRegex = /<islemler[\s\S]*?<\/islemler>/gi;
        const kaynakIslemler = kaynakXml.match(islemRegex) || [];
        const hedefIslemler = hedefXml.match(islemRegex) || [];
        const birlesikIslemler = [...kaynakIslemler, ...hedefIslemler];
        const topIslemSayisi = birlesikIslemler.length;
        // Tutarları topla
        let topTutar = 0;
        const tutarRegex = /<tutartl>([\d\.]+)<\/tutartl>/i;
        for (const islem of birlesikIslemler) {
            const match = islem.match(tutarRegex);
            if (match && match[1]) {
                topTutar += parseFloat(match[1]) || 0;
            }
        }
        const topIslemSayisiStr = formatSayiXml(topIslemSayisi, 10);
        const topTutarStr = formatTutarXml(topTutar);
        // Protokol kısmını kaynakXml'den al
        const protokolMatch = kaynakXml.match(/<protokol>[\s\S]*?<\/protokol>/i);
        let protokolXml = "";
        if (protokolMatch) {
            protokolXml = protokolMatch[0];
            // <topislemsayisi> ve <toptutar> güncelle
            protokolXml = protokolXml.replace(/<topislemsayisi>[\s\S]*?<\/topislemsayisi>/i, `<topislemsayisi>${topIslemSayisiStr}</topislemsayisi>`);
            protokolXml = protokolXml.replace(/<toptutar>[\s\S]*?<\/toptutar>/i, `<toptutar>${topTutarStr}</toptutar>`);
            if (params.dosyaNo?.trim()) {
                const dNo = String(parseInt(params.dosyaNo, 10) || 0).padStart(3, "0");
                protokolXml = protokolXml.replace(/<dosyano>[\s\S]*?<\/dosyano>/i, `<dosyano>${dNo}</dosyano>`);
            }
            if (params.hazirlamaTarihi?.trim()) {
                const bTarih = formatTarihKisa(params.hazirlamaTarihi);
                protokolXml = protokolXml.replace(/<bilgitarih>[\s\S]*?<\/bilgitarih>/i, `<bilgitarih>${bTarih}</bilgitarih>`);
            }
        }
        else {
            throw ApiError.badRequest("Kaynak XML dosyasında geçerli bir <protokol> bloğu bulunamadı.");
        }
        const mergedXml = `<?xml version="1.0" encoding="UTF-8" ?>
<vimveritransferi xsi:noNamespaceSchemaLocation="doviz_islemleri.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
	${protokolXml}
${birlesikIslemler.join("\n")}
</vimveritransferi>`;
        return {
            xmlContent: mergedXml,
            topIslemSayisi,
            topTutar,
            kaynakIslemSayisi: kaynakIslemler.length,
            hedefIslemSayisi: hedefIslemler.length,
        };
    }
}
function escapeXml(unsafe) {
    if (unsafe == null)
        return "";
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

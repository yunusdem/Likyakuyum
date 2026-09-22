import { env } from "../config/env.config.js";
import { EBankaPosSqlRepository } from "../models/ebankaPosSql.repository.js";
import { DbContext, EBankaSqlRepository } from "../models/ebankaSql.repository.js";
import { EBankaVeriSqlRepository } from "../models/ebankaVeriSql.repository.js";
import { EBankaVposSqlRepository } from "../models/ebankaVposSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { BankaService } from "./banka.service.js";

// F- e-Banka > Ayarlar > Sistem Denetimi (docs/EBANKA_VOMSIS_YOL_HARITASI.md)
// Vomsis hesabı olmadan, sunucunun GERÇEK veritabanında ve ağında sistemin çalışmaya hazır olduğunu doğrular.
// denetle() hiçbir şey yazmaz (e-Banka'nın kendi tablolarının ilk kullanımda oluşması dışında).
// denemeFisi() bilerek yazar: tek bir 0,01 TL'lik banka fişi açar ve hemen siler — fiş kesme zincirinin kanıtı.

export type DenetimDurumu = "tamam" | "uyari" | "hata" | "bilgi";
export interface DenetimSonucu {
  grup: string;
  ad: string;
  durum: DenetimDurumu;
  ayrinti: string;
}

const EBANKA_TABLOLARI = [
  "TODVZ_EBANKA_AYAR", "TODVZ_EBANKA_LOG", "TODVZ_EBANKA_BANKA", "TODVZ_EBANKA_HESAP", "TODVZ_EBANKA_HAREKET_TIPI", "TODVZ_EBANKA_HAREKET",
  "TODVZ_EBANKA_CARI_IBAN", "TODVZ_EBANKA_POS_TERMINAL", "TODVZ_EBANKA_POS_HAREKET", "TODVZ_EBANKA_VPOS_LINK", "TODVZ_EBANKA_VPOS_ISLEM",
];

// Banka fişi kaydının (bankaSql.repository saveHareket) INSERT'te doldurduğu kolonlar. Tabloda bunların dışında
// zorunlu (NOT NULL, varsayılansız) bir kolon varsa otomatik fiş kesilemez.
const FIS_KOLONLARI: Record<string, string[]> = {
  TODVZ_BANKA_HAREKET: ["BANKA_HAREKET_ID", "ISLEM_TIPI", "BANKA_ID", "CARI_KART_ID", "VEZNE_ID", "TARIH", "BELGE_NO", "ACIKLAMA", "IPTAL", "EKLEYEN_ID", "EKLEME_ZAMANI"],
  TODVZ_BANKA_HAREKET_SATIRI: ["BANKA_HAREKET_ID", "SATIR_NO", "PARA_ID", "MEBLAG", "KUR", "GISE_KURU", "TUTAR_TL", "ACIKLAMA"],
};

const VOMSIS_ADRESLERI: [string, string][] = [
  ["Hesap Hareketleri / POS Rapor", "https://developers.vomsis.com/api/v2/authenticate"],
  ["Sanal POS", "https://uygulama.vomsis.com/api/vpos/v3/auth/token"],
];

const DENEME_ACIKLAMASI = "e-Banka sistem denetimi - deneme fisi (otomatik silinir)";

export class EBankaDenetimService {
  public static async denetle(dbContext?: DbContext): Promise<{ zaman: string; sonuclar: DenetimSonucu[] }> {
    const sonuclar: DenetimSonucu[] = [];
    const ekle = (grup: string, ad: string, durum: DenetimDurumu, ayrinti: string) => sonuclar.push({ grup, ad, durum, ayrinti });
    /** Bir denetim patlarsa diğerleri yine çalışsın */
    const dene = async (grup: string, ad: string, is: () => Promise<void>) => {
      try {
        await is();
      } catch (err: any) {
        ekle(grup, ad, "hata", `Denetlenemedi: ${err?.message || err}`);
      }
    };

    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const sorgu = async (q: string) => (await pool.request().query(q)).recordset as any[];

    // ─── Veritabanı ──────────────────────────────────────────────────────────
    await dene("Veritabanı", "SQL Server sürümü", async () => {
      const r = (await sorgu(`SELECT CAST(SERVERPROPERTY('ProductVersion') AS varchar(40)) AS V, DB_NAME() AS DB, CONVERT(varchar(80), DATABASEPROPERTYEX(DB_NAME(), 'Collation')) AS C`))[0];
      const ana = Number(String(r.V).split(".")[0]);
      // Listeler OFFSET … FETCH kullanır (SQL Server 2012 = sürüm 11)
      ekle("Veritabanı", "SQL Server sürümü", ana >= 11 ? "tamam" : "hata", `${r.V} — veritabanı ${r.DB}, ${r.C}${ana >= 11 ? "" : " — en az SQL Server 2012 gerekir (liste sayfalaması çalışmaz)"}`);
    });

    await dene("Veritabanı", "e-Banka tabloları", async () => {
      // Tablolar ilk kullanımda oluşur; hepsi tetiklenir
      await EBankaSqlRepository.ayarGetir(dbContext);
      await EBankaPosSqlRepository.sonEsitleme(dbContext);
      await EBankaVposSqlRepository.fisliKayitYok(dbContext);
      const var_ = new Set((await sorgu(`SELECT name FROM sys.tables WHERE name LIKE 'TODVZ[_]EBANKA[_]%'`)).map((r) => String(r.name).toUpperCase()));
      const eksik = EBANKA_TABLOLARI.filter((t) => !var_.has(t));
      ekle("Veritabanı", "e-Banka tabloları", eksik.length ? "hata" : "tamam", eksik.length ? `Oluşturulamayan tablolar: ${eksik.join(", ")} (veritabanı kullanıcısının tablo oluşturma yetkisi olmayabilir)` : `${EBANKA_TABLOLARI.length} tablonun hepsi var`);
    });

    await dene("Veritabanı", "Hareket tipi kural kolonları", async () => {
      const r = (await sorgu(`SELECT COL_LENGTH('TODVZ_EBANKA_HAREKET_TIPI', 'KURAL') AS K, COL_LENGTH('TODVZ_EBANKA_HAREKET_TIPI', 'CARI_KART_ID') AS C, COL_LENGTH('TODVZ_EBANKA_AYAR', 'SON_POS_ESITLEME') AS P`))[0];
      const tamam = r.K !== null && r.C !== null && r.P !== null;
      ekle("Veritabanı", "Sonradan eklenen kolonlar", tamam ? "tamam" : "hata", tamam ? "KURAL, CARI_KART_ID, SON_POS_ESITLEME yerinde" : "Bazı kolonlar eklenemedi (ALTER TABLE yetkisi olmayabilir)");
    });

    // ─── Banka fişi altyapısı ────────────────────────────────────────────────
    for (const [tablo, doldurulan] of Object.entries(FIS_KOLONLARI)) {
      await dene("Banka fişi", tablo, async () => {
        const kolonlar = await sorgu(`
          SELECT c.name AS AD, c.is_nullable AS BOS, c.is_identity AS KIMLIK, c.is_computed AS HESAPLI, CASE WHEN c.default_object_id <> 0 THEN 1 ELSE 0 END AS VARSAYILAN
          FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.${tablo}')`);
        if (!kolonlar.length) return void ekle("Banka fişi", tablo, "hata", "Tablo yok. Banka Hesap Hareketleri ekranı bir kez açılınca oluşur.");
        const adlar = new Set(kolonlar.map((k) => String(k.AD).toUpperCase()));
        const eksik = doldurulan.filter((k) => !adlar.has(k));
        const engel = kolonlar.filter((k) => !k.BOS && !k.KIMLIK && !k.HESAPLI && !k.VARSAYILAN && !doldurulan.includes(String(k.AD).toUpperCase())).map((k) => k.AD);
        if (eksik.length) return void ekle("Banka fişi", tablo, "hata", `Fiş kaydının yazdığı kolonlar tabloda yok: ${eksik.join(", ")}`);
        if (engel.length) return void ekle("Banka fişi", tablo, "hata", `Tabloda fiş kaydının doldurmadığı zorunlu kolonlar var: ${engel.join(", ")} — otomatik fiş kesilemez`);
        ekle("Banka fişi", tablo, "tamam", `${kolonlar.length} kolon, fiş kaydıyla uyumlu${kolonlar.some((k) => k.KIMLIK) ? " (numara otomatik artan)" : ""}`);
      });
    }

    await dene("Banka fişi", "Tetikleyiciler", async () => {
      const t = await sorgu(`
        SELECT OBJECT_NAME(parent_id) AS TABLO, name AS AD, is_disabled AS KAPALI FROM sys.triggers
        WHERE parent_id IN (OBJECT_ID('dbo.TODVZ_BANKA'), OBJECT_ID('dbo.TODVZ_BANKA_HAREKET'), OBJECT_ID('dbo.TODVZ_BANKA_HAREKET_SATIRI'))`);
      const acik = t.filter((x) => !x.KAPALI);
      ekle("Banka fişi", "Tetikleyiciler", acik.length ? "uyari" : "tamam", acik.length ? `Banka tablolarında etkin tetikleyici var: ${acik.map((x) => `${x.TABLO}.${x.AD}`).join(", ")} — fiş kaydını etkileyebilir; deneme fişiyle doğrulayın` : "Banka tablolarında etkin tetikleyici yok");
    });

    await dene("Banka fişi", "Banka Hesap Kartları", async () => {
      const r = (await sorgu(`SELECT COUNT(*) AS N, SUM(CASE WHEN LEN(LTRIM(RTRIM(ISNULL(IBAN, '')))) >= 16 THEN 1 ELSE 0 END) AS IBANLI FROM TODVZ_BANKA`))[0];
      ekle("Banka fişi", "Banka Hesap Kartları", r.N > 0 ? (r.IBANLI > 0 ? "tamam" : "uyari") : "uyari", r.N > 0 ? `${r.N} kart, ${r.IBANLI || 0} tanesinde IBAN var${r.IBANLI > 0 ? "" : " — IBAN'ı olmayan kart banka hesabıyla kendiliğinden eşleşmez, elle eşlenir"}` : "Hiç Banka Hesap Kartı yok; banka hesapları eşlenemez");
    });

    // ─── Eşleşme verisi ──────────────────────────────────────────────────────
    await dene("Tanımlar", "Para tanımları", async () => {
      const kodlar = new Set((await sorgu(`SELECT RTRIM(UPPER(KOD)) AS K FROM TODVZ_PARA`)).map((r) => String(r.K)));
      const tl = kodlar.has("TL") || kodlar.has("TRY");
      const eksik = ["USD", "EUR"].filter((k) => !kodlar.has(k));
      ekle("Tanımlar", "Para tanımları", !tl ? "hata" : eksik.length ? "uyari" : "tamam", !tl ? "TL (ya da TRY) kodlu para tanımı yok; hiçbir hareket fişe dönemez" : eksik.length ? `TL var; ${eksik.join(", ")} kodlu para yok — o döviz cinsindeki hesapların hareketleri Bekleyenler'de kalır` : "TL, USD, EUR tanımlı");
    });

    await dene("Tanımlar", "Kur tablosu", async () => {
      const r = (await sorgu(`
        SELECT TOP 1 CONVERT(varchar(10), T.TARIH, 104) AS GUN, DATEDIFF(DAY, T.TARIH, GETDATE()) AS GUN_ONCE,
               (SELECT TOP 1 COALESCE(NULLIF(K.DOVIZ_ALIS, 0), K.EFEKTIF_ALIS) FROM dbo.TODVZ_KUR K JOIN dbo.TODVZ_PARA P ON P.PARA_ID = K.PARA_ID
                 WHERE K.KUR_TABLOSU_ID = T.KUR_TABLOSU_ID AND RTRIM(UPPER(P.KOD)) = 'USD') AS USD
        FROM dbo.TODVZ_KUR_TABLOSU T ORDER BY T.TARIH DESC, T.KUR_TABLOSU_ID DESC`))[0];
      if (!r) return void ekle("Tanımlar", "Kur tablosu", "uyari", "Kur tablosu boş; döviz hesaplarının hareketleri kur bulunamadığı için Bekleyenler'de kalır");
      const guncel = r.GUN_ONCE <= 7 && Number(r.USD) > 0;
      ekle("Tanımlar", "Kur tablosu", guncel ? "tamam" : "uyari", `Son kur ${r.GUN} (${r.GUN_ONCE} gün önce), USD alış ${Number(r.USD) || "yok"}${guncel ? "" : " — döviz fişlerinde hareket gününe en yakın ESKİ kur kullanılır; kurlar güncel değilse TL karşılıklar sapar"}`);
    });

    await dene("Tanımlar", "Cari eşleşme verisi", async () => {
      const r = (await sorgu(`
        SELECT COUNT(*) AS TOPLAM, SUM(CASE WHEN LEN(LTRIM(RTRIM(ISNULL(VERGI_KIMLIK_NO, '')))) >= 10 THEN 1 ELSE 0 END) AS VKNLI FROM TODVZ_CARI_KART`))[0];
      const cift = (await sorgu(`
        SELECT COUNT(*) AS N FROM (SELECT LTRIM(RTRIM(VERGI_KIMLIK_NO)) AS V FROM TODVZ_CARI_KART
          WHERE LEN(LTRIM(RTRIM(ISNULL(VERGI_KIMLIK_NO, '')))) >= 10 GROUP BY LTRIM(RTRIM(VERGI_KIMLIK_NO)) HAVING COUNT(*) > 1) x`))[0].N;
      ekle("Tanımlar", "Cari eşleşme verisi", r.VKNLI > 0 ? "tamam" : "uyari", `${r.TOPLAM} cari, ${r.VKNLI || 0} tanesinde vergi/TC kimlik no var${cift ? `; ${cift} numara birden çok caride (o numaradan gelen hareket otomatik aktarılmaz, Bekleyenler'e düşer)` : ""}`);
      const kolon = (await sorgu(`SELECT COL_LENGTH('TODVZ_CARI_KART', 'EPOSTA') AS E, COL_LENGTH('TODVZ_CARI_KART', 'TELEFON') AS T`))[0];
      ekle("Tanımlar", "Cari iletişim kolonları", kolon.T !== null ? (kolon.E !== null ? "tamam" : "uyari") : "uyari", `TELEFON ${kolon.T !== null ? "var" : "yok"}, EPOSTA ${kolon.E !== null ? "var" : "yok"} — ödeme linki formu bunlarla dolar; yoksa elle yazılır`);
    });

    // ─── Ayarlar ─────────────────────────────────────────────────────────────
    const ayar = await EBankaSqlRepository.ayarGetir(dbContext).catch(() => null);
    ekle("Ayarlar", "Çalışma modu", "bilgi", (ayar?.mod ?? "sahte") === "canli" ? "Canlı" : "Test (örnek veri) — banka servisine istek gitmez, fiş kesilmez");
    ekle("Ayarlar", "Şifreleme anahtarı", env.ADMIN_DB_ENC_KEY.length >= 32 ? "tamam" : "hata", env.ADMIN_DB_ENC_KEY.length >= 32 ? "ADMIN_DB_ENC_KEY tanımlı" : "Sunucuda ADMIN_DB_ENC_KEY yok ya da 32 karakterden kısa (Backend/.env.local) — API şifresi kaydedilemez");
    ekle("Ayarlar", "Servis API anahtarı", ayar?.appKey && ayar.appSecretSifreli ? "tamam" : "bilgi", ayar?.appKey && ayar.appSecretSifreli ? "Tanımlı" : "Henüz girilmemiş (Test modu için gerekmez)");
    ekle("Ayarlar", "Aktarım başlangıç tarihi", ayar?.aktarimBaslangic ? "tamam" : "uyari", ayar?.aktarimBaslangic ? ayar.aktarimBaslangic.split("-").reverse().join(".") : "Girilmemiş — girilene kadar hiçbir hareket fişe aktarılmaz");
    await dene("Ayarlar", "Sanal POS banka hesabı", async () => {
      if (!ayar?.vposBankaId) return void ekle("Ayarlar", "Sanal POS banka hesabı", "uyari", "Seçilmemiş — Sanal POS tahsilatları için fiş kesilemez");
      const k = await BankaService.getBankaById(ayar.vposBankaId, dbContext).catch(() => null);
      ekle("Ayarlar", "Sanal POS banka hesabı", k ? "tamam" : "hata", k ? `${k.hesapNo} - ${k.hesapAdi}` : "Seçili Banka Hesap Kartı artık yok; Ayarlar'dan yeniden seçin");
    });

    // ─── Ağ ──────────────────────────────────────────────────────────────────
    // Kimlik bilgisi gönderilmez: boş gövdeyle oturum ucuna gidilir. HTTP yanıtı gelmesi (401/422 dahil) sunucunun Vomsis'e ulaşabildiğini gösterir.
    for (const [ad, url] of VOMSIS_ADRESLERI) {
      const kontrol = new AbortController();
      const zamanlayici = setTimeout(() => kontrol.abort(), 10_000);
      const t0 = Date.now();
      try {
        const y = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: "{}", signal: kontrol.signal });
        ekle("Ağ", `Servis erişimi — ${ad}`, y.status < 500 ? "tamam" : "uyari", `Sunucudan ulaşılıyor (HTTP ${y.status}, ${Date.now() - t0} ms)${y.status >= 500 ? " — servis tarafında geçici sorun olabilir" : ""}`);
      } catch (err: any) {
        ekle("Ağ", `Servis erişimi — ${ad}`, "hata", `Sunucudan ${new URL(url).host} adresine ulaşılamıyor (${err?.name === "AbortError" ? "10 sn'de yanıt yok" : err?.cause?.code || err?.message}) — güvenlik duvarı / DNS / internet çıkışı denetlenmeli`);
      } finally {
        clearTimeout(zamanlayici);
      }
    }

    return { zaman: new Date().toISOString(), sonuclar };
  }

  /**
   * Fiş kesme zincirinin kanıtı: gerçek veritabanında 0,01 TL'lik carisiz bir "Havale Alma" fişi açar, okur ve HEMEN siler.
   * Otomatik aktarımın kullandığı aynı yoldan (BankaService.saveHareket / deleteHareket) geçer. Geriye kayıt kalmaz; yalnızca bir fiş numarası harcanır.
   */
  public static async denemeFisi(bankaId: number, kullaniciId?: number, dbContext?: DbContext): Promise<{ adimlar: DenetimSonucu[]; basarili: boolean }> {
    if (!(Number(bankaId) > 0)) throw ApiError.badRequest("Banka hesabı seçilmelidir.");
    await BankaService.getBankaById(Number(bankaId), dbContext); // yoksa 404 (mevcut fiş kaydı olmayan kart için sessizce yeni kart açıyor)

    const adimlar: DenetimSonucu[] = [];
    const ekle = (ad: string, durum: DenetimDurumu, ayrinti: string) => adimlar.push({ grup: "Deneme fişi", ad, durum, ayrinti });
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const tl = (await pool.request().query(`SELECT TOP 1 PARA_ID FROM TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL', 'TRY') ORDER BY PARA_ID`)).recordset[0]?.PARA_ID;
    if (!tl) throw ApiError.badRequest("TL para tanımı bulunamadı.");

    const bugun = new Date();
    const gun = `${bugun.getFullYear()}-${String(bugun.getMonth() + 1).padStart(2, "0")}-${String(bugun.getDate()).padStart(2, "0")}`;
    let fisId: number | null = null;
    try {
      const fis = await BankaService.saveHareket(
        {
          islemTipi: 0,
          bankaId: Number(bankaId),
          cariKartId: null,
          tarih: `${gun}T00:00:00Z`,
          belgeNo: "EBANKA-DENEME",
          aciklama: DENEME_ACIKLAMASI,
          satirlar: [{ satirNo: 1, paraId: tl, meblag: 0.01, kur: 1, giseKuru: 1, tutarTl: 0.01, aciklama: DENEME_ACIKLAMASI }],
        },
        kullaniciId,
        dbContext
      );
      fisId = fis.bankaHareketId;
      ekle("Fiş kesildi", "tamam", `Banka fişi #${fisId} — 0- Havale Alma, 0,01 TL`);

      const dogru = fis.bankaId === Number(bankaId) && fis.islemTipi === 0 && fis.satirlar.length === 1 && Math.abs(fis.satirlar[0].meblag - 0.01) < 0.0001 && String(fis.tarih).startsWith(gun);
      ekle("Fiş geri okundu", dogru ? "tamam" : "hata", dogru ? "Banka hesabı, işlem tipi, tarih ve satır tutarı yazıldığı gibi" : `Okunan kayıt beklenenden farklı: ${JSON.stringify({ bankaId: fis.bankaId, islemTipi: fis.islemTipi, tarih: fis.tarih, satir: fis.satirlar[0] })}`);
    } catch (err: any) {
      ekle("Fiş kesildi", "hata", `Banka fişi kaydedilemedi: ${err?.message || err}`);
    }

    if (fisId) {
      try {
        await BankaService.deleteHareket(fisId, kullaniciId, dbContext);
        const kalan = (await pool.request().query(`SELECT (SELECT COUNT(*) FROM TODVZ_BANKA_HAREKET WHERE BANKA_HAREKET_ID = ${fisId}) + (SELECT COUNT(*) FROM TODVZ_BANKA_HAREKET_SATIRI WHERE BANKA_HAREKET_ID = ${fisId}) AS N`)).recordset[0].N;
        ekle("Fiş silindi", kalan === 0 ? "tamam" : "hata", kalan === 0 ? `#${fisId} ve satırı silindi; geriye kayıt kalmadı` : `#${fisId} TAM SİLİNEMEDİ — Banka Hesap Hareketleri ekranından elle silin`);
      } catch (err: any) {
        ekle("Fiş silindi", "hata", `#${fisId} SİLİNEMEDİ (${err?.message || err}) — Banka Hesap Hareketleri ekranından elle silin`);
      }
    }

    const basarili = adimlar.length === 3 && adimlar.every((a) => a.durum === "tamam");
    await EBankaSqlRepository.logYaz(
      { islem: "denetim-deneme-fisi", mod: (await EBankaSqlRepository.ayarGetir(dbContext))?.mod ?? "sahte", basarili, mesaj: adimlar.map((a) => `${a.ad}: ${a.durum}`).join(", ") + (fisId ? ` (#${fisId})` : ""), kullaniciId },
      dbContext
    );
    return { adimlar, basarili };
  }
}

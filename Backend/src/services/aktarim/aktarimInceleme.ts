import sql from "mssql";
import { n, q } from "./aktarimSema.js";

/**
 * Veri aktarımı — yüklenen yedeğin incelenmesi (docs/VERITABANI_TASIMA_YOL_HARITASI.md, Faz 2).
 * Yedek başlığı okunur, yedek geçici adla (salt okunur) açılır ve özet çıkarılır: eski program sürümü, firma,
 * fiş sayıları, kullanıcılar, bağlı veritabanları (R/A çifti), e-Döviz serileri ve gönderim durumu, engeller.
 */

export interface YedekSeti {
  position: number;
  /** 1 tam veritabanı, 5 fark (differential), 2 günlük (log) … */
  tur: number;
  dbAdi: string;
  sqlAna: number;
  sqlSurumu: string;
  tarih: string | null;
  boyut: number;
  sifreli: boolean;
  hasarli: boolean;
  collation: string;
  uyumluluk: number;
}

export interface Engel {
  kod: string;
  seviye: "ENGEL" | "UYARI";
  mesaj: string;
}

export interface EDovizSerisi {
  seri: string;
  numaratorSiradaki: number | null;
  belgeSayisi: number;
  sonBelge: string | null;
  gonderilen: number;
  sonGonderilen: string | null;
  gonderilmeyen: number;
  ilkGonderilmeyenTarih: string | null;
  sonGonderilmeyenTarih: string | null;
}

export interface IncelemeOzeti {
  yedek: YedekSeti;
  sunucuSurumu: number;
  geciciDb: string;
  eskiProgram: boolean;
  programSurumu: string | null;
  firma: { ad: string | null; vkn: string | null; adres: string | null; telefon: string | null };
  /** Eski programın alan ayarları: fişleri karşıya aktarılan (çalışma) alan mı, Diğer veritabanı (eşin alan kodu) */
  alan: { fisleriAktarilacak: boolean | null; digerVeritabani: string | null };
  nesneler: { tablo: number; gorunum: number; yordam: number; sifreliYordam: number; tetik: number };
  toplamSatir: number;
  tablolar: { ad: string; satir: number }[];
  fis: {
    doviz: { adet: number; ilk: string | null; son: string | null };
    sarraf: { adet: number; ilk: string | null; son: string | null };
    cariKart: number;
    cariHareket: number;
    vezneTransferi: number;
  };
  kullanicilar: string[];
  bagliVeritabanlari: { db: string; nesneler: string[] }[];
  eDoviz: { logVar: boolean; seriler: EDovizSerisi[] };
  engeller: Engel[];
}

export const sqlSurumAdi = (ana: number, ara = 0): string => {
  const ad: Record<number, string> = { 9: "2005", 10: ara >= 50 ? "2008 R2" : "2008", 11: "2012", 12: "2014", 13: "2016", 14: "2017", 15: "2019", 16: "2022", 17: "2025" };
  return `SQL Server ${ad[ana] || `(sürüm ${ana})`}`;
};

const tarihMetni = (v: any): string | null => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

/** RESTORE / BACKUP hatalarını yöneticinin anlayacağı dile çevirir. */
export const yedekHataMetni = (err: any, yol?: string): string => {
  const no = Number(err?.number ?? err?.originalError?.info?.number);
  const msg = String(err?.message || err || "Bilinmeyen hata");
  if (no === 3201 && /5\(|Access is denied|Erişim engellendi/i.test(msg)) {
    return `SQL Server yedek dosyasını okuyamıyor (klasör izni yok${yol ? `: ${yol}` : ""}). Aktarım klasörüne SQL Server servis hesabı için okuma izni verilmeli (yol haritası bölüm 6).`;
  }
  if (no === 3201) return `Yedek dosyası açılamadı${yol ? ` (${yol})` : ""}: ${msg.slice(0, 200)}`;
  if (no === 3169) return "Yedek bu sunucudan daha yeni bir SQL Server sürümünde alınmış; bu sunucuya açılamaz.";
  if (no === 3241 || (no === 3013 && /media family|format/i.test(msg))) return "Dosya bozuk ya da geçerli bir SQL Server yedeği değil.";
  if (no === 1801) return "Geçici veritabanı zaten var; aynı yedek şu anda inceleniyor olabilir.";
  if (no === 1105 || no === 1101 || no === 3257) return "Sunucuda yeterli disk alanı yok.";
  return msg.slice(0, 300);
};

/** RESTORE HEADERONLY: dosyadaki yedek setleri */
export const yedekBasligi = async (pool: sql.ConnectionPool, yedekYolu: string): Promise<YedekSeti[]> => {
  try {
    const r = await new sql.Request(pool).input("yol", sql.NVarChar(400), yedekYolu).query(`RESTORE HEADERONLY FROM DISK = @yol`);
    return (r.recordset as any[]).map((h) => ({
      position: Number(h.Position),
      tur: Number(h.BackupType),
      dbAdi: String(h.DatabaseName || ""),
      sqlAna: Number(h.SoftwareVersionMajor),
      sqlSurumu: sqlSurumAdi(Number(h.SoftwareVersionMajor), Number(h.SoftwareVersionMinor)),
      tarih: tarihMetni(h.BackupFinishDate),
      boyut: Number(h.BackupSize) || 0,
      sifreli: !!(h.KeyAlgorithm && String(h.KeyAlgorithm).trim()) || !!(h.EncryptorThumbprint && String(h.EncryptorThumbprint).trim()),
      hasarli: !!h.IsDamaged && String(h.IsDamaged) !== "0" && String(h.IsDamaged).toLowerCase() !== "false",
      collation: String(h.Collation || ""),
      uyumluluk: Number(h.CompatibilityLevel) || 0,
    }));
  } catch (err: any) {
    throw new Error(yedekHataMetni(err, yedekYolu));
  }
};

/** Dosyada birden çok set varsa en son TAM veritabanı yedeği seçilir. */
export const setSec = (setler: YedekSeti[]): YedekSeti | null => {
  const tamlar = setler.filter((s) => s.tur === 1);
  if (!tamlar.length) return null;
  return tamlar.reduce((a, b) => ((b.tarih || "") > (a.tarih || "") || ((b.tarih || "") === (a.tarih || "") && b.position > a.position) ? b : a));
};

export const yedekEngelleri = (setler: YedekSeti[], sunucuAna: number): Engel[] => {
  const e: Engel[] = [];
  const s = setSec(setler);
  if (!setler.length) e.push({ kod: "YEDEK_BOS", seviye: "ENGEL", mesaj: "Dosyada yedek seti yok." });
  else if (!s) e.push({ kod: "TAM_YEDEK_DEGIL", seviye: "ENGEL", mesaj: "Dosyada tam veritabanı yedeği yok (yalnız fark ya da günlük yedeği). Eski programdan TAM yedek alınmalı." });
  if (s?.sifreli) e.push({ kod: "SIFRELI_YEDEK", seviye: "ENGEL", mesaj: "Yedek şifreli; şifresiz yedek alınmalı." });
  if (s?.hasarli) e.push({ kod: "HASARLI_YEDEK", seviye: "ENGEL", mesaj: "Yedek hasarlı olarak işaretli; yeniden yedek alınmalı." });
  if (s && s.sqlAna > sunucuAna) e.push({ kod: "YENI_SQL", seviye: "ENGEL", mesaj: `Yedek ${s.sqlSurumu} ile alınmış; sunucudaki SQL Server daha eski.` });
  if (s && s.collation && s.collation.toUpperCase() !== "TURKISH_CI_AS") {
    e.push({ kod: "HARF_DUZENI", seviye: "UYARI", mesaj: `Yedeğin harf düzeni ${s.collation} (bizde Turkish_CI_AS); Türkçe karakterler aktarımdan sonra kontrol edilmeli.` });
  }
  return e;
};

export const sunucuAnaSurumu = async (pool: sql.ConnectionPool): Promise<number> =>
  Number((await new sql.Request(pool).query(`SELECT CAST(SERVERPROPERTY('ProductMajorVersion') AS int) AS S`)).recordset[0].S);

/** Yedeği geçici adla açar (dosyalar sunucunun varsayılan veri klasörüne) ve salt okunur yapar. */
export const geciciAc = async (pool: sql.ConnectionPool, yedekYolu: string, geciciAd: string, position = 1): Promise<void> => {
  if (!/^LKY_AKTARIM_[A-Za-z0-9_]{1,80}$/.test(geciciAd)) throw new Error("Geçici veritabanı adı geçersiz.");
  if (await geciciVarMi(pool, geciciAd)) throw new Error(yedekHataMetni({ number: 1801, message: "exists" }));
  try {
    const yol = (await new sql.Request(pool).query(`SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(260)) AS VERI, CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(260)) AS LOG`)).recordset[0];
    const dosyalar = (await new sql.Request(pool).input("yol", sql.NVarChar(400), yedekYolu).input("p", sql.Int, position)
      .query(`RESTORE FILELISTONLY FROM DISK = @yol WITH FILE = @p`)).recordset as any[];
    let i = 0;
    const move = dosyalar
      .map((f) => {
        const log = String(f.Type).toUpperCase() === "L";
        const hedef = log ? `${yol.LOG}${geciciAd}_log.ldf` : `${yol.VERI}${geciciAd}${i++ === 0 ? ".mdf" : `_${i}.ndf`}`;
        return `MOVE ${n(String(f.LogicalName))} TO ${n(hedef)}`;
      })
      .join(", ");
    if (!move) throw new Error("Yedekte veri dosyası yok.");
    await new sql.Request(pool).input("yol", sql.NVarChar(400), yedekYolu).input("p", sql.Int, position)
      .query(`RESTORE DATABASE ${q(geciciAd)} FROM DISK = @yol WITH FILE = @p, RECOVERY, ${move}`);
    await new sql.Request(pool).batch(`ALTER DATABASE ${q(geciciAd)} SET RECOVERY SIMPLE WITH NO_WAIT; ALTER DATABASE ${q(geciciAd)} SET READ_ONLY WITH ROLLBACK IMMEDIATE;`);
  } catch (err: any) {
    await geciciSil(pool, geciciAd).catch(() => undefined);
    throw new Error(yedekHataMetni(err, yedekYolu));
  }
};

export const geciciSil = async (pool: sql.ConnectionPool, geciciAd: string): Promise<void> => {
  if (!/^LKY_AKTARIM_[A-Za-z0-9_]{1,80}$/.test(geciciAd)) throw new Error("Geçici veritabanı adı geçersiz.");
  await new sql.Request(pool).batch(
    `IF DB_ID(${n(geciciAd)}) IS NOT NULL BEGIN ALTER DATABASE ${q(geciciAd)} SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ${q(geciciAd)}; END`
  );
};

export const geciciVarMi = async (pool: sql.ConnectionPool, geciciAd: string): Promise<boolean> =>
  (await new sql.Request(pool).input("ad", sql.NVarChar(128), geciciAd).query(`SELECT DB_ID(@ad) AS I`)).recordset[0].I !== null;

/** Açılmış (geçici) veritabanından özet çıkarır. */
export const incele = async (pool: sql.ConnectionPool, geciciDb: string, yedek: YedekSeti): Promise<IncelemeOzeti> => {
  const D = q(geciciDb);
  const sorgu = async (metin: string) => (await new sql.Request(pool).query(metin)).recordsets as any[][];
  const engeller: Engel[] = [];
  const sunucuSurumu = await sunucuAnaSurumu(pool);

  const [[nesne]] = await sorgu(`
    SELECT (SELECT COUNT(*) FROM ${D}.sys.tables WHERE is_ms_shipped = 0) AS TABLO,
           (SELECT COUNT(*) FROM ${D}.sys.views WHERE is_ms_shipped = 0) AS GORUNUM,
           (SELECT COUNT(*) FROM ${D}.sys.procedures WHERE is_ms_shipped = 0) AS YORDAM,
           (SELECT COUNT(*) FROM ${D}.sys.procedures p LEFT JOIN ${D}.sys.sql_modules m ON m.object_id = p.object_id WHERE p.is_ms_shipped = 0 AND m.definition IS NULL) AS SIFRELI,
           (SELECT COUNT(*) FROM ${D}.sys.triggers WHERE parent_class = 1) AS TETIK,
           OBJECT_ID(${n(geciciDb + ".dbo.TODVZ_TANIM")}) AS TANIM_ID`);

  const tablolar = ((await sorgu(`
    SELECT t.name AS AD, SUM(p.rows) AS SATIR FROM ${D}.sys.tables t
    JOIN ${D}.sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
    WHERE t.is_ms_shipped = 0 GROUP BY t.name ORDER BY SUM(p.rows) DESC, t.name`))[0] || []).map((r: any) => ({ ad: String(r.AD), satir: Number(r.SATIR) || 0 }));
  const varMi = (ad: string) => tablolar.some((t) => t.ad.toUpperCase() === ad.toUpperCase());
  const kolonVar = async (tablo: string, kolon: string) =>
    (await sorgu(`SELECT COL_LENGTH(${n(geciciDb + ".dbo." + tablo)}, ${n(kolon)}) AS L`))[0][0].L !== null;

  const eskiProgram = nesne.TANIM_ID !== null && varMi("TODVZ_FIS") && varMi("TODVZ_PARA");
  if (!eskiProgram) engeller.push({ kod: "ESKI_PROGRAM_DEGIL", seviye: "ENGEL", mesaj: "Bu yedek eski döviz/kuyum programının veritabanı değil (TODVZ_TANIM / TODVZ_FIS / TODVZ_PARA yok)." });

  const ozet: IncelemeOzeti = {
    yedek,
    sunucuSurumu,
    geciciDb,
    eskiProgram,
    programSurumu: null,
    firma: { ad: null, vkn: null, adres: null, telefon: null },
    alan: { fisleriAktarilacak: null, digerVeritabani: null },
    nesneler: { tablo: Number(nesne.TABLO), gorunum: Number(nesne.GORUNUM), yordam: Number(nesne.YORDAM), sifreliYordam: Number(nesne.SIFRELI), tetik: Number(nesne.TETIK) },
    toplamSatir: tablolar.reduce((t, x) => t + x.satir, 0),
    tablolar,
    fis: { doviz: { adet: 0, ilk: null, son: null }, sarraf: { adet: 0, ilk: null, son: null }, cariKart: 0, cariHareket: 0, vezneTransferi: 0 },
    kullanicilar: [],
    bagliVeritabanlari: [],
    eDoviz: { logVar: false, seriler: [] },
    engeller,
  };
  if (!eskiProgram) return ozet;

  const sec = async (tablo: string, kolon: string) => ((await kolonVar(tablo, kolon)) ? `RTRIM(CAST(${q(kolon)} AS nvarchar(500)))` : "CAST(NULL AS nvarchar(500))");
  const [[tanim]] = await sorgu(`SELECT TOP 1 ${await sec("TODVZ_TANIM", "SURUM")} AS SURUM, ${await sec("TODVZ_TANIM", "FIRMA_ADI")} AS AD,
    ${await sec("TODVZ_TANIM", "VERGI_KIMLIK_NO")} AS VKN, ${await sec("TODVZ_TANIM", "ADRES")} AS ADRES, ${await sec("TODVZ_TANIM", "TELEFON")} AS TEL
    FROM ${D}.dbo.TODVZ_TANIM`);
  const bos = (v: any) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim());
  ozet.programSurumu = bos(tanim?.SURUM);
  ozet.firma = { ad: bos(tanim?.AD), vkn: bos(tanim?.VKN), adres: bos(tanim?.ADRES), telefon: bos(tanim?.TEL) };
  const [[alan]] = await sorgu(`SELECT TOP 1 ${await sec("TODVZ_TANIM", "FISLERI_AKTARILACAK_ALAN")} AS FA, ${await sec("TODVZ_TANIM", "DIGER_VERITABANI_ADI")} AS DV FROM ${D}.dbo.TODVZ_TANIM`);
  const fa = bos(alan?.FA);
  ozet.alan = { fisleriAktarilacak: fa === null ? null : fa === "1" || fa.toLowerCase() === "true", digerVeritabani: bos(alan?.DV) };

  const aralik = async (tablo: string) => {
    if (!varMi(tablo)) return { adet: 0, ilk: null, son: null };
    const [[r]] = await sorgu(`SELECT COUNT(*) AS N, MIN(TARIH) AS ILK, MAX(TARIH) AS SON FROM ${D}.dbo.${q(tablo)}`);
    return { adet: Number(r.N) || 0, ilk: tarihMetni(r.ILK), son: tarihMetni(r.SON) };
  };
  const sayi = (tablo: string) => tablolar.find((t) => t.ad.toUpperCase() === tablo)?.satir ?? 0;
  ozet.fis = {
    doviz: await aralik("TODVZ_FIS"),
    sarraf: await aralik("TODVZ_SARRAF_FISI"),
    cariKart: sayi("TODVZ_CARI_KART"),
    cariHareket: sayi("TODVZ_CARI_HAREKET"),
    vezneTransferi: sayi("TODVZ_VEZNE_TRANSFERI"),
  };
  if (varMi("TODVZ_KULLANICI")) {
    ozet.kullanicilar = ((await sorgu(`SELECT RTRIM(AD) AS AD FROM ${D}.dbo.TODVZ_KULLANICI ORDER BY KULLANICI_ID`))[0] || [])
      .map((r: any) => String(r.AD || "").trim())
      .filter(Boolean);
  }

  // Bağlı veritabanları: tetik/yordamların başka veritabanına başvurusu (R/A çifti)
  const bag = (await sorgu(`
    SELECT DISTINCT d.referenced_database_name AS DB, OBJECT_NAME(d.referencing_id, DB_ID(${n(geciciDb)})) AS NESNE
    FROM ${D}.sys.sql_expression_dependencies d
    WHERE d.referenced_database_name IS NOT NULL AND d.referenced_database_name NOT IN ('master', 'tempdb', 'msdb', 'model')`))[0] || [];
  const harita = new Map<string, string[]>();
  for (const r of bag) {
    const db = String(r.DB);
    if (db.toUpperCase() === yedek.dbAdi.toUpperCase()) continue;
    if (!harita.has(db)) harita.set(db, []);
    harita.get(db)!.push(String(r.NESNE));
  }
  ozet.bagliVeritabanlari = [...harita.entries()].map(([db, nesneler]) => ({ db, nesneler: nesneler.sort() }));
  for (const b of ozet.bagliVeritabanlari) {
    engeller.push({
      kod: "BAGLI_VERITABANI",
      seviye: "UYARI",
      mesaj: `Bu veritabanı ${b.db} ile bağlı (${b.nesneler.length} tetik/nesne; ortak numaratör ve tanımlar). İki yedek aynı müşteri numarasıyla, çift olarak aktarılmalı.`,
    });
  }

  // e-Döviz serileri: numaratör + fiş satırlarındaki belge numaraları + eski programın gönderim günlüğü
  // logVar: günlükte kayıt var mı (tablo boşsa eski programın gönderim bilgisi yok demektir)
  ozet.eDoviz.logVar = varMi("TODVZ_E_FATURA_LOG") && sayi("TODVZ_E_FATURA_LOG") > 0;
  const [numaratorler, belgeler, gonderilen, gonderilmeyen] = await sorgu(`
    SET NOCOUNT ON;
    SELECT RTRIM(ONEK) AS SERI, MAX(BASLANGIC) AS SIRADAKI FROM ${D}.dbo.TODVZ_NUMERATOR
      WHERE ONEK LIKE '[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]%' GROUP BY RTRIM(ONEK);
    IF OBJECT_ID('tempdb..#belge') IS NOT NULL DROP TABLE #belge;
    SELECT DISTINCT CAST(RTRIM(S.BELGE_NO) AS varchar(20)) AS BN, CAST(F.TARIH AS date) AS TARIH INTO #belge
      FROM ${D}.dbo.TODVZ_FIS_SATIRI S JOIN ${D}.dbo.TODVZ_FIS F ON F.FIS_ID = S.FIS_ID
      WHERE S.BELGE_NO LIKE '[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][0-9]%' AND LEN(RTRIM(S.BELGE_NO)) = 16 AND ISNULL(F.IPTAL, 0) = 0;
    IF OBJECT_ID('tempdb..#gonderilen') IS NOT NULL DROP TABLE #gonderilen;
    CREATE TABLE #gonderilen (BN varchar(20) PRIMARY KEY);
    ${ozet.eDoviz.logVar ? `INSERT #gonderilen SELECT DISTINCT CAST(LEFT(MESAJ, 16) AS varchar(20)) FROM ${D}.dbo.TODVZ_E_FATURA_LOG
      WHERE MESAJ LIKE '[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][0-9]%' AND MESAJ LIKE N'%başar%gönderildi%';` : ""}
    SELECT LEFT(BN, 7) AS SERI, COUNT(*) AS N, MAX(BN) AS SON FROM #belge GROUP BY LEFT(BN, 7);
    SELECT LEFT(b.BN, 7) AS SERI, COUNT(*) AS N, MAX(b.BN) AS SON FROM #belge b JOIN #gonderilen g ON g.BN = b.BN GROUP BY LEFT(b.BN, 7);
    SELECT LEFT(b.BN, 7) AS SERI, COUNT(*) AS N, MIN(b.TARIH) AS ILK, MAX(b.TARIH) AS SON FROM #belge b
      WHERE NOT EXISTS (SELECT 1 FROM #gonderilen g WHERE g.BN = b.BN) GROUP BY LEFT(b.BN, 7);
    DROP TABLE #belge; DROP TABLE #gonderilen;
    SET NOCOUNT OFF;`);
  const seriler = new Map<string, EDovizSerisi>();
  const seri = (ad: string) => {
    const k = ad.trim();
    if (!seriler.has(k)) {
      seriler.set(k, { seri: k, numaratorSiradaki: null, belgeSayisi: 0, sonBelge: null, gonderilen: 0, sonGonderilen: null, gonderilmeyen: 0, ilkGonderilmeyenTarih: null, sonGonderilmeyenTarih: null });
    }
    return seriler.get(k)!;
  };
  for (const r of numaratorler || []) seri(String(r.SERI)).numaratorSiradaki = Number(r.SIRADAKI);
  for (const r of belgeler || []) Object.assign(seri(String(r.SERI)), { belgeSayisi: Number(r.N), sonBelge: String(r.SON) });
  for (const r of gonderilen || []) Object.assign(seri(String(r.SERI)), { gonderilen: Number(r.N), sonGonderilen: String(r.SON) });
  for (const r of gonderilmeyen || []) {
    Object.assign(seri(String(r.SERI)), { gonderilmeyen: Number(r.N), ilkGonderilmeyenTarih: tarihMetni(r.ILK), sonGonderilmeyenTarih: tarihMetni(r.SON) });
  }
  ozet.eDoviz.seriler = [...seriler.values()].filter((s) => s.belgeSayisi > 0 || s.numaratorSiradaki !== null).sort((a, b) => a.seri.localeCompare(b.seri));

  if (ozet.fis.sarraf.adet > 0) {
    engeller.push({
      kod: "SARRAF_FISI_VAR",
      seviye: "UYARI",
      mesaj: `${ozet.fis.sarraf.adet} sarraf fişi var; eski sürümde sarraf fişi yapısı farklı. Önce deneme aktarımı yapılıp sonuç kontrol edilmeli.`,
    });
  }
  return ozet;
};

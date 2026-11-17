import sql from "mssql";
import { DogrulamaKontrolu } from "./aktarimDogrulama.js";
import { DegerKurali } from "./aktarimPlani.js";
import { n, q, tamAd } from "./aktarimSema.js";

/**
 * Veri aktarımı — R/A çifti ve e-Döviz işaretleme (docs/VERITABANI_TASIMA_YOL_HARITASI.md, K2, K3, Faz 5).
 *
 * Çift: eski programda iki veritabanı (ör. R = resmî/e-Döviz gönderen, A = çalışma) tetiklerle bağlı; numaratör ortak,
 * kur / para / banknot / yazıcı tanımları R'den A'ya akar, fişler A'dan R'ye aktarılır.
 *  - Müşterinin (şifresiz) çift tetikleri yeni veritabanı adlarıyla kurulur; şablondan gelen ve başka bir veritabanına
 *    (K2016_dvz …) yazan tetikler kaldırılır. Eski sunucuda "nested triggers" kapalı olduğu için tetikler birbirini
 *    sonsuz tetiklemiyordu; burada her tetiğin başına TRIGGER_NESTLEVEL koruması eklenir (aynı davranış, sunucu ayarına dokunmadan).
 *  - Çalışma tarafının Diğer veritabanı (Fiş Aktarma hedefi) resmî tarafa ayarlanır.
 *  - İki taraf da doluysa: çalışma tarafında resmî tarafta zaten bulunan fişler AKTARILDI = 1, resmî tarafta KAYNAK_FIS_ID
 *    çalışma tarafındaki fişe bağlanır → Fiş Aktarma bunları ikinci kez yazmaz.
 *  - Firma girişleri verilirse her girişe karşı veritabanında kullanıcı + db_owner (tetikler ve Fiş Aktarma çapraz yazar).
 * e-Döviz: eski programın günlüğünde "başarıyla gönderildi" olan belgeler TODVZ_EBELGE_KAYNAK'a GONDERILDI yazılır;
 * e-Belge listesinde "Gönderildi — Eski programla gönderildi" görünür, yeniden gönderilemez, fiş silinemez.
 */

export type CiftRolu = "RESMI" | "CALISMA";

export interface CiftSecenekleri {
  /** Bu aktarımın kaynağı (geçici açılmış müşteri yedeği) */
  kaynakDb: string;
  /** Bu aktarımın hedefi (firma veritabanı) */
  hedefDb: string;
  /** Eşin firma veritabanı (yeni ad) */
  esHedefDb: string;
  /** Eşin eski programdaki adı (tetiklerde geçen, ör. A2026_dvz) */
  esEskiAdi: string;
  rol: CiftRolu;
  /** Firma SQL girişleri (bulutta ADM_FIRMA.DB_USER); verilmezse çapraz yetki verilmez */
  hedefGirisi?: string | null;
  esGirisi?: string | null;
}

export const ESKI_GONDERIM_NOTU = "Eski programla gönderildi";
const KORUMA = "IF TRIGGER_NESTLEVEL() > 1 RETURN; -- LKY aktarım: çift tetik döngüsü (eski sunucuda nested triggers kapalı)";

const kacis = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Tetik tanımında eski eş adını yenisiyle değiştirir, döngü korumasını ekler (saf).
 * kimlikler (tablo → kimlik kolonu): tetik eşin tablosuna kimlik kolonunu açıkça yazıyorsa (PARA_ID, KUR_TABLOSU_ID …)
 * gövdenin başına o tablo için IDENTITY_INSERT eklenir (tetik bitince SQL Server eski haline döndürür).
 */
export const tetikYenidenYaz = (tanim: string, eskiAd: string, yeniAd: string, kimlikler: Record<string, string> = {}): string => {
  const adKalibi = new RegExp(`(?<![A-Za-z0-9_\\]])\\[?${kacis(eskiAd)}\\]?(?![A-Za-z0-9_])`, "gi");
  let t = tanim.replace(adKalibi, q(yeniAd));
  if (t.includes("TRIGGER_NESTLEVEL()")) return t;

  const ekler: string[] = [KORUMA];
  const ekle = new RegExp(`INSERT\\s+INTO\\s+${kacis(q(yeniAd))}\\.\\[?dbo\\]?\\.\\[?(\\w+)\\]?\\s*\\(([^)]*)\\)`, "gi");
  const kimlikTablolari = new Set<string>();
  for (const m of t.matchAll(ekle)) {
    const tablo = m[1];
    const kimlik = Object.entries(kimlikler).find(([k]) => k.toUpperCase() === tablo.toUpperCase())?.[1];
    if (kimlik && new RegExp(`(?<![\\w.])\\[?${kacis(kimlik)}\\]?(?![\\w])`, "i").test(m[2])) kimlikTablolari.add(tablo);
  }
  for (const tablo of kimlikTablolari) ekler.push(`SET IDENTITY_INSERT ${q(yeniAd)}.[dbo].${q(tablo)} ON;`);

  // İlk "AS … BEGIN" ya da tetik başlığından sonraki ilk AS
  const begin = /(\bFOR\b|\bAFTER\b|\bINSTEAD\s+OF\b)([\s\S]*?)\bAS\b(\s*)BEGIN\b/i;
  if (begin.test(t)) return t.replace(begin, (_m, a, b, c) => `${a}${b}AS${c}BEGIN\n\t${ekler.join("\n\t")}`);
  const as = /(\bFOR\b|\bAFTER\b|\bINSTEAD\s+OF\b)([\s\S]*?)\bAS\b/i;
  if (as.test(t)) return t.replace(as, (_m, a, b) => `${a}${b}AS\n${ekler.join("\n")}\n`);
  throw new Error("Tetik tanımında AS bulunamadı; koruma eklenemedi.");
};

/**
 * Eski sürüm tetiklerinde geçen ve bizim şemada değişen kolonlar (aktarimPlani KOLON_KURALLARI ile aynı farklar).
 * Çift tetikleri satırı eşe olduğu gibi kopyalar; kolon adı değiştiyse yeni kolon(lar) kopyalanır.
 */
export const TETIK_KOLON_DONUSUMLERI: { tablo: string; eski: string; yeni: string[] }[] = [
  { tablo: "TODVZ_PARA", eski: "KUYUM", yeni: ["URUN_TIPI", "BIRIM"] },
  { tablo: "TODVZ_TANIM", eski: "KMV_KURA_DAHIL", yeni: ["KMV_UYGULAMA_SEKLI"] },
  { tablo: "TODVZ_FIS", eski: "KMV_KURA_DAHIL", yeni: ["KMV_UYGULAMA_SEKLI"] },
];

/** Tetik gövdesindeki eski kolonları yeni karşılıklarıyla değiştirir (saf). */
export const tetikKolonlariniUyarla = (tanim: string, tablo: string): string => {
  let t = tanim;
  for (const d of TETIK_KOLON_DONUSUMLERI.filter((x) => x.tablo.toUpperCase() === tablo.toUpperCase())) {
    const e = kacis(d.eski);
    // 1) SET KUYUM = K.KUYUM  →  URUN_TIPI = K.URUN_TIPI, BIRIM = K.BIRIM
    t = t.replace(new RegExp(`(?<![\\w.\\]])\\[?${e}\\]?\\s*=\\s*(\\w+)\\.\\[?${e}\\]?(?![\\w])`, "gi"), (_m, al) => d.yeni.map((y) => `${y} = ${al}.${y}`).join(", "));
    // 2) K.KUYUM  →  K.URUN_TIPI, K.BIRIM
    t = t.replace(new RegExp(`(\\w+)\\.\\[?${e}\\]?(?![\\w])`, "gi"), (_m, al) => d.yeni.map((y) => `${al}.${y}`).join(", "));
    // 3) kolon listesi: KUYUM  →  URUN_TIPI, BIRIM
    t = t.replace(new RegExp(`(?<![\\w.\\]])\\[?${e}\\]?(?![\\w])`, "gi"), d.yeni.join(", "));
  }
  return t;
};

/**
 * TODVZ_TANIM.DIGER_VERITABANI_ADI kuralı. Eski program burada eşin alan kodunu tutar (A2026; veritabanı A2026_dvz);
 * bizim Fiş Aktarma tam veritabanı adı bekler. Çalışma tarafı: eşin yeni adı (K2). Resmî taraf: eski değer eşi
 * gösteriyorsa eşin yeni adı, değilse boş. Çift yoksa boş (eski ad bu sunucuda geçersiz, başka firmaya denk gelebilir).
 */
export const digerVeritabaniKurali = (cift: CiftSecenekleri | null): DegerKurali => ({
  tablo: "TODVZ_TANIM",
  kolon: "DIGER_VERITABANI_ADI",
  aciklama: !cift
    ? "Eski programın Diğer veritabanı bu sunucuda geçersiz; boşaltılır (çift olarak aktarılırsa eşin yeni veritabanı yazılır)"
    : cift.rol === "CALISMA"
      ? `Fiş Aktarma hedefi: eş ${cift.esHedefDb}`
      : `Eski eş adı (${cift.esEskiAdi}) → ${cift.esHedefDb}`,
  ifade: (k, kaynakta) => {
    if (!cift) return "CAST(NULL AS varchar(200))";
    if (cift.rol === "CALISMA") return n(cift.esHedefDb);
    if (!kaynakta("DIGER_VERITABANI_ADI")) return "CAST(NULL AS varchar(200))";
    const eski = [cift.esEskiAdi, cift.esEskiAdi.replace(/_dvz$/i, "")].map((x) => n(x.toUpperCase())).join(", ");
    return `CASE WHEN UPPER(RTRIM(${k("DIGER_VERITABANI_ADI")})) IN (${eski}) THEN ${n(cift.esHedefDb)} ELSE NULL END`;
  },
});

const istek = (tx: sql.Transaction) => new sql.Request(tx);
const dbIcinde = (db: string, komut: string) => `EXEC ${q(db)}.sys.sp_executesql ${n(komut)};`;

/** Eski programın günlüğünde gönderilmiş görünen e-Döviz belgelerini hedefte GONDERILDI olarak işaretler. */
export const eDovizIsaretle = async (tx: sql.Transaction, kaynakDb: string, hedefDb: string): Promise<{ isaretlenen: number; beklenen: number }> => {
  const var_ = (await istek(tx).query(`SELECT OBJECT_ID(${n(kaynakDb + ".dbo.TODVZ_E_FATURA_LOG")}) AS L`)).recordset[0].L;
  if (var_ === null) return { isaretlenen: 0, beklenen: 0 };
  await istek(tx).batch(dbIcinde(hedefDb, `
    IF OBJECT_ID('dbo.TODVZ_EBELGE_KAYNAK','U') IS NULL
      CREATE TABLE dbo.TODVZ_EBELGE_KAYNAK (
        ANAHTAR varchar(80) NOT NULL PRIMARY KEY, BELGE_NO varchar(40) NOT NULL,
        DURUM varchar(30) NOT NULL, HATA nvarchar(2000) NULL, TARIH datetime2 NOT NULL DEFAULT SYSDATETIME());`));
  const r = await istek(tx).query(`
    SET NOCOUNT ON;
    IF OBJECT_ID('tempdb..#gonderilen') IS NOT NULL DROP TABLE #gonderilen;
    SELECT CAST(LEFT(MESAJ, 16) AS varchar(20)) AS BN, MAX(ZAMAN) AS ZAMAN INTO #gonderilen
    FROM ${tamAd(kaynakDb, "TODVZ_E_FATURA_LOG")}
    WHERE MESAJ LIKE '[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][0-9]%' AND MESAJ LIKE N'%başar%gönderildi%'
    GROUP BY CAST(LEFT(MESAJ, 16) AS varchar(20));
    CREATE UNIQUE CLUSTERED INDEX IX ON #gonderilen (BN);
    IF OBJECT_ID('tempdb..#beklenen') IS NOT NULL DROP TABLE #beklenen;
    SELECT X.ANAHTAR, X.BN, X.ZAMAN INTO #beklenen
    FROM (
      SELECT CAST(CONCAT('99:', S.FIS_ID, ':', F.TIP, ':', RTRIM(S.BELGE_NO)) AS varchar(80)) COLLATE DATABASE_DEFAULT AS ANAHTAR,
             CAST(RTRIM(S.BELGE_NO) AS varchar(40)) AS BN, G.ZAMAN,
             ROW_NUMBER() OVER (PARTITION BY S.FIS_ID, F.TIP, RTRIM(S.BELGE_NO) ORDER BY S.SATIR_NO) AS SIRA
      FROM ${tamAd(hedefDb, "TODVZ_FIS_SATIRI")} S
      JOIN ${tamAd(hedefDb, "TODVZ_FIS")} F ON F.FIS_ID = S.FIS_ID
      JOIN #gonderilen G ON G.BN = CAST(RTRIM(S.BELGE_NO) AS varchar(20)) COLLATE DATABASE_DEFAULT
    ) X WHERE X.SIRA = 1;
    -- Yeniden aktarım: önceki aktarımın kendi işaretleri silinir (yeni yedekte silinmiş fişin işareti sahipsiz kalmasın).
    -- Bizim sistemde ICE ile gönderilmiş kayıtlara dokunulmaz.
    DELETE FROM ${tamAd(hedefDb, "TODVZ_EBELGE_KAYNAK")} WHERE DURUM = 'GONDERILDI' AND HATA LIKE ${n(ESKI_GONDERIM_NOTU + "%")};
    INSERT INTO ${tamAd(hedefDb, "TODVZ_EBELGE_KAYNAK")} (ANAHTAR, BELGE_NO, DURUM, HATA, TARIH)
    SELECT B.ANAHTAR, B.BN, 'GONDERILDI', ${n(ESKI_GONDERIM_NOTU + " (")} + CONVERT(nvarchar(16), B.ZAMAN, 104) + N' ' + CONVERT(nvarchar(5), B.ZAMAN, 108) + N')', B.ZAMAN
    FROM #beklenen B
    WHERE NOT EXISTS (SELECT 1 FROM ${tamAd(hedefDb, "TODVZ_EBELGE_KAYNAK")} R WHERE R.ANAHTAR COLLATE DATABASE_DEFAULT = B.ANAHTAR COLLATE DATABASE_DEFAULT);
    -- İşaretli = beklenen anahtarlardan gönderilmiş sayılan kaydı olanlar (eski işaret ya da bizim gerçek gönderimimiz)
    -- (geçici tablo ile firma tablosu: iki yanda açık harf düzeni — canlı sunucunun varsayılanı SQL_Latin1, firma Turkish_CI_AS)
    SELECT
      (SELECT COUNT(*) FROM #beklenen B JOIN ${tamAd(hedefDb, "TODVZ_EBELGE_KAYNAK")} R ON R.ANAHTAR COLLATE DATABASE_DEFAULT = B.ANAHTAR COLLATE DATABASE_DEFAULT AND R.DURUM NOT IN ('GONDERILMEDI', 'HATA')) AS ISARETLENEN,
      (SELECT COUNT(*) FROM #beklenen) AS BEKLENEN;
    DROP TABLE #gonderilen; DROP TABLE #beklenen;
    SET NOCOUNT OFF;`);
  const x = r.recordsets && (r.recordsets as any[]).length ? (r.recordsets as any[])[(r.recordsets as any[]).length - 1][0] : r.recordset[0];
  return { isaretlenen: Number(x.ISARETLENEN) || 0, beklenen: Number(x.BEKLENEN) || 0 };
};

/** Çalışma tarafında resmî tarafta bulunan fişleri AKTARILDI yapar, resmî tarafta KAYNAK_FIS_ID'yi bağlar. */
export const ciftEsle = async (tx: sql.Transaction, calismaDb: string, resmiDb: string): Promise<{ eslesen: number }> => {
  const kolonVar = async (db: string, tablo: string, kolon: string) =>
    (await istek(tx).query(`SELECT COL_LENGTH(${n(`${db}.dbo.${tablo}`)}, ${n(kolon)}) AS L`)).recordset[0].L !== null;
  // batch: #es sonraki komutlarda kullanılır. query() sürücüde sp_executesql ile çalışır ve içinde açılan geçici tablo komut bitince
  // silinir ("Invalid object name '#es'" — yerel köprüde görünmüyordu, gerçek sürücüyle Faz 9 testinde bulundu, 17.11.2026)
  const r = await istek(tx).batch(`
    SET NOCOUNT ON;
    IF OBJECT_ID('tempdb..#es') IS NOT NULL DROP TABLE #es;
    SELECT C.FIS_ID AS CALISMA_FIS_ID, MIN(R.FIS_ID) AS RESMI_FIS_ID INTO #es
    FROM ${tamAd(calismaDb, "TODVZ_FIS_SATIRI")} CS
    JOIN ${tamAd(calismaDb, "TODVZ_FIS")} C ON C.FIS_ID = CS.FIS_ID
    JOIN ${tamAd(resmiDb, "TODVZ_FIS_SATIRI")} RS ON RTRIM(RS.BELGE_NO) COLLATE DATABASE_DEFAULT = RTRIM(CS.BELGE_NO) COLLATE DATABASE_DEFAULT
    JOIN ${tamAd(resmiDb, "TODVZ_FIS")} R ON R.FIS_ID = RS.FIS_ID AND R.TIP = C.TIP AND CAST(R.TARIH AS date) = CAST(C.TARIH AS date)
    WHERE LEN(RTRIM(ISNULL(CS.BELGE_NO, ''))) > 0
    GROUP BY C.FIS_ID;
    SELECT COUNT(*) AS N FROM #es;`);
  const eslesen = Number(r.recordset[0]?.N) || 0;
  if (await kolonVar(calismaDb, "TODVZ_FIS", "AKTARILDI")) {
    const tarih = (await kolonVar(calismaDb, "TODVZ_FIS", "AKTARIM_TARIHI")) ? ", AKTARIM_TARIHI = ISNULL(C.AKTARIM_TARIHI, GETDATE())" : "";
    await istek(tx).batch(`UPDATE C SET AKTARILDI = 1${tarih} FROM ${tamAd(calismaDb, "TODVZ_FIS")} C JOIN #es E ON E.CALISMA_FIS_ID = C.FIS_ID;`);
  }
  if (await kolonVar(resmiDb, "TODVZ_FIS", "KAYNAK_FIS_ID")) {
    await istek(tx).batch(`
      UPDATE R SET KAYNAK_FIS_ID = E.CALISMA_FIS_ID FROM ${tamAd(resmiDb, "TODVZ_FIS")} R
      JOIN (SELECT RESMI_FIS_ID, MIN(CALISMA_FIS_ID) AS CALISMA_FIS_ID FROM #es GROUP BY RESMI_FIS_ID) E ON E.RESMI_FIS_ID = R.FIS_ID
      WHERE R.KAYNAK_FIS_ID IS NULL;`);
  }
  await istek(tx).batch(`DROP TABLE #es; SET NOCOUNT OFF;`);
  return { eslesen };
};

/** Çift adımları (aktarım işleminin içinde, kopyadan sonra). Not listesi döner. */
export const ciftAdimlari = async (tx: sql.Transaction, s: CiftSecenekleri): Promise<string[]> => {
  const notlar: string[] = [];
  if (s.esHedefDb.toUpperCase() === s.hedefDb.toUpperCase()) throw new Error("Çiftin iki tarafı aynı veritabanı olamaz.");
  const esVar = (await istek(tx).query(`SELECT DB_ID(${n(s.esHedefDb)}) AS I`)).recordset[0].I;
  if (esVar === null) throw new Error(`Eş veritabanı (${s.esHedefDb}) sunucuda yok; önce eş firma açılmalı.`);

  // 1) Tetikler: kaynakta eşe başvuran tetikler (şifresiz olmalı)
  const kaynakTetik = (await istek(tx).query(`
    SELECT tr.name AS AD, t.name AS TABLO, m.definition AS TANIM
    FROM ${q(s.kaynakDb)}.sys.triggers tr
    JOIN ${q(s.kaynakDb)}.sys.tables t ON t.object_id = tr.parent_id
    LEFT JOIN ${q(s.kaynakDb)}.sys.sql_modules m ON m.object_id = tr.object_id
    WHERE tr.parent_class = 1 AND EXISTS (
      SELECT 1 FROM ${q(s.kaynakDb)}.sys.sql_expression_dependencies d
      WHERE d.referencing_id = tr.object_id AND d.referenced_database_name = ${n(s.esEskiAdi)})`)).recordset as { AD: string; TABLO: string; TANIM: string | null }[];
  const sifreli = kaynakTetik.filter((x) => !x.TANIM);
  if (sifreli.length) throw new Error(`Eşe yazan tetikler şifreli, yeniden kurulamıyor: ${sifreli.map((x) => x.AD).join(", ")}`);

  // Hedefte başka bir veritabanına yazan tetikler (şablondan, K2016_dvz …) ve müşteri tetikleriyle aynı adlı olanlar kaldırılır
  const hedefDis = (await istek(tx).query(`
    SELECT DISTINCT tr.name AS AD FROM ${q(s.hedefDb)}.sys.triggers tr
    WHERE tr.parent_class = 1 AND EXISTS (
      SELECT 1 FROM ${q(s.hedefDb)}.sys.sql_expression_dependencies d
      WHERE d.referencing_id = tr.object_id AND d.referenced_database_name IS NOT NULL
        AND d.referenced_database_name NOT IN (${n(s.hedefDb)}, 'master', 'tempdb'))`)).recordset.map((x: any) => String(x.AD));
  const kaldirilacak = [...new Set([...hedefDis, ...kaynakTetik.map((x) => x.AD)])];
  for (const ad of kaldirilacak) {
    await istek(tx).batch(dbIcinde(s.hedefDb, `IF OBJECT_ID(N'dbo.${ad.replace(/'/g, "''")}', 'TR') IS NOT NULL DROP TRIGGER dbo.${q(ad)};`));
  }
  const kimlikler: Record<string, string> = Object.fromEntries(
    ((await istek(tx).query(`
      SELECT t.name AS TABLO, c.name AS KOLON FROM ${q(s.esHedefDb)}.sys.columns c JOIN ${q(s.esHedefDb)}.sys.tables t ON t.object_id = c.object_id
      WHERE c.is_identity = 1`)).recordset as any[]).map((x) => [String(x.TABLO), String(x.KOLON)])
  );
  for (const t of kaynakTetik) {
    const yeni = tetikYenidenYaz(tetikKolonlariniUyarla(t.TANIM!, t.TABLO), s.esEskiAdi, s.esHedefDb, kimlikler);
    try {
      await istek(tx).batch(dbIcinde(s.hedefDb, yeni));
    } catch (err: any) {
      throw new Error(`Çift tetiği ${t.AD} (${t.TABLO}) yeni şemada kurulamadı: ${String(err?.message || err).slice(0, 300)}`);
    }
  }
  const sablondan = hedefDis.filter((a) => !kaynakTetik.some((k) => k.AD.toUpperCase() === a.toUpperCase()));
  notlar.push(
    `Çift tetikleri kuruldu (${kaynakTetik.length} tetik, ${s.esEskiAdi} → ${s.esHedefDb}, döngü korumalı)` +
      (sablondan.length ? `; şablondan kalan ${sablondan.length} dış tetik kaldırıldı (${sablondan.join(", ")})` : "") + "."
  );

  // 2) Fiş Aktarma hedefi (Diğer veritabanı) kopyada plan kuralıyla yazılır (digerVeritabaniKurali); burada yalnız not
  const calisma = s.rol === "CALISMA" ? s.hedefDb : s.esHedefDb;
  const resmi = s.rol === "CALISMA" ? s.esHedefDb : s.hedefDb;
  if (s.rol === "CALISMA") notlar.push(`${calisma} firmasının Diğer veritabanı (Fiş Aktarma hedefi) ${resmi}.`);

  // 3) Çapraz yetki (tetikler ve Fiş Aktarma eş veritabanına yazar)
  const yetkiVer = async (db: string, giris: string) => {
    await istek(tx).batch(dbIcinde(db, `
      IF SUSER_ID(N'${giris.replace(/'/g, "''")}') IS NOT NULL
      BEGIN
        IF USER_ID(N'${giris.replace(/'/g, "''")}') IS NULL CREATE USER ${q(giris)} FOR LOGIN ${q(giris)};
        ALTER ROLE [db_owner] ADD MEMBER ${q(giris)};
      END`));
  };
  if (s.hedefGirisi) await yetkiVer(s.esHedefDb, s.hedefGirisi);
  if (s.esGirisi) await yetkiVer(s.hedefDb, s.esGirisi);
  if (s.hedefGirisi || s.esGirisi) notlar.push("Çift firmaların SQL girişlerine karşı veritabanında yetki verildi.");

  // 4) İki taraf da doluysa eşleme
  const dolu = async (db: string) => Number((await istek(tx).query(`SELECT COUNT_BIG(*) AS N FROM ${tamAd(db, "TODVZ_FIS")}`)).recordset[0].N) > 0;
  if ((await dolu(calisma)) && (await dolu(resmi))) {
    const { eslesen } = await ciftEsle(tx, calisma, resmi);
    notlar.push(`${calisma} tarafında ${resmi}'de zaten bulunan ${eslesen} fiş "aktarıldı" işaretlendi (Fiş Aktarma ikinci kez yazmaz).`);
  } else {
    notlar.push("Eş henüz aktarılmadı; fiş eşlemesi eşin aktarımında yapılacak.");
  }
  return notlar;
};

/** Doğrulama ek kontrolleri: tetikler eşe yönlü ve korumalı, dış tetik kalmadı, e-Döviz işaretleri, fiş eşlemesi. */
export const ciftKontrolleri = async (
  b: sql.ConnectionPool | sql.Transaction,
  g: { kaynakDb: string; hedefDb: string; cift?: CiftSecenekleri | null }
): Promise<DogrulamaKontrolu[]> => {
  const k: DogrulamaKontrolu[] = [];
  const sorgu = async (metin: string) => (await new sql.Request(b as any).query(metin)).recordset as any[];

  // e-Döviz işaretleri: günlükteki her gönderilmiş belge işaretli, gönderilmemiş hiçbiri işaretli değil
  const logVar = (await sorgu(`SELECT OBJECT_ID(${n(g.kaynakDb + ".dbo.TODVZ_E_FATURA_LOG")}) AS L`))[0].L !== null;
  const kaynakTablosu = (await sorgu(`SELECT OBJECT_ID(${n(g.hedefDb + ".dbo.TODVZ_EBELGE_KAYNAK")}) AS L`))[0].L !== null;
  if (logVar && kaynakTablosu) {
    const [x] = await sorgu(`
      WITH G AS (
        SELECT DISTINCT CAST(LEFT(MESAJ, 16) AS varchar(20)) COLLATE DATABASE_DEFAULT AS BN FROM ${tamAd(g.kaynakDb, "TODVZ_E_FATURA_LOG")}
        WHERE MESAJ LIKE '[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][0-9]%' AND MESAJ LIKE N'%başar%gönderildi%')
      SELECT
        (SELECT COUNT(*) FROM (SELECT DISTINCT S.FIS_ID, F.TIP, RTRIM(S.BELGE_NO) AS BN FROM ${tamAd(g.hedefDb, "TODVZ_FIS_SATIRI")} S
           JOIN ${tamAd(g.hedefDb, "TODVZ_FIS")} F ON F.FIS_ID = S.FIS_ID
           JOIN G ON G.BN = CAST(RTRIM(S.BELGE_NO) AS varchar(20)) COLLATE DATABASE_DEFAULT
           WHERE EXISTS (SELECT 1 FROM ${tamAd(g.hedefDb, "TODVZ_EBELGE_KAYNAK")} R
             WHERE R.ANAHTAR = CAST(CONCAT('99:', S.FIS_ID, ':', F.TIP, ':', RTRIM(S.BELGE_NO)) AS varchar(80)) COLLATE DATABASE_DEFAULT
               AND R.DURUM NOT IN ('GONDERILMEDI', 'HATA'))) Z) AS ISARETLI,
        (SELECT COUNT(*) FROM (SELECT DISTINCT S.FIS_ID, RTRIM(S.BELGE_NO) AS BN FROM ${tamAd(g.hedefDb, "TODVZ_FIS_SATIRI")} S
           JOIN G ON G.BN = CAST(RTRIM(S.BELGE_NO) AS varchar(20)) COLLATE DATABASE_DEFAULT) Z) AS BEKLENEN,
        (SELECT COUNT(*) FROM ${tamAd(g.hedefDb, "TODVZ_EBELGE_KAYNAK")} R WHERE R.HATA LIKE ${n(ESKI_GONDERIM_NOTU + "%")}
           AND NOT EXISTS (SELECT 1 FROM G WHERE G.BN = R.BELGE_NO COLLATE DATABASE_DEFAULT)) AS YANLIS`);
    k.push({ grup: "EK", tablo: "TODVZ_EBELGE_KAYNAK", ad: "Eski programla gönderilen e-Döviz belgeleri 'Gönderildi'", durum: Number(x.ISARETLI) === Number(x.BEKLENEN) ? "TAMAM" : "FARK", kaynak: Number(x.BEKLENEN), hedef: Number(x.ISARETLI) });
    k.push({ grup: "EK", tablo: "TODVZ_EBELGE_KAYNAK", ad: "Gönderilmemiş belge 'Gönderildi' işaretlenmemiş", durum: Number(x.YANLIS) === 0 ? "TAMAM" : "FARK", hedef: Number(x.YANLIS) });
  }

  if (g.cift) {
    const c = g.cift;
    const tetik = await sorgu(`
      SELECT tr.name AS AD, CAST(m.definition AS nvarchar(max)) AS TANIM,
        (SELECT COUNT(*) FROM ${q(c.hedefDb)}.sys.sql_expression_dependencies d WHERE d.referencing_id = tr.object_id AND d.referenced_database_name = ${n(c.esHedefDb)}) AS ES,
        (SELECT COUNT(*) FROM ${q(c.hedefDb)}.sys.sql_expression_dependencies d WHERE d.referencing_id = tr.object_id AND d.referenced_database_name IS NOT NULL
           AND d.referenced_database_name NOT IN (${n(c.hedefDb)}, ${n(c.esHedefDb)}, 'master', 'tempdb')) AS DIS
      FROM ${q(c.hedefDb)}.sys.triggers tr LEFT JOIN ${q(c.hedefDb)}.sys.sql_modules m ON m.object_id = tr.object_id WHERE tr.parent_class = 1`);
    const kaynakSayisi = Number((await sorgu(`
      SELECT COUNT(*) AS N FROM ${q(c.kaynakDb)}.sys.triggers tr WHERE tr.parent_class = 1 AND EXISTS (
        SELECT 1 FROM ${q(c.kaynakDb)}.sys.sql_expression_dependencies d WHERE d.referencing_id = tr.object_id AND d.referenced_database_name = ${n(c.esEskiAdi)})`))[0].N);
    const esli = tetik.filter((t) => Number(t.ES) > 0);
    k.push({ grup: "EK", tablo: null, ad: `Çift tetikleri eşe (${c.esHedefDb}) yönlü`, durum: esli.length === kaynakSayisi ? "TAMAM" : "FARK", kaynak: kaynakSayisi, hedef: esli.length });
    k.push({ grup: "EK", tablo: null, ad: "Çift tetiklerinde döngü koruması", durum: esli.every((t) => String(t.TANIM || "").includes("TRIGGER_NESTLEVEL()")) ? "TAMAM" : "FARK" });
    const dis = tetik.filter((t) => Number(t.DIS) > 0).map((t) => String(t.AD));
    k.push({ grup: "EK", tablo: null, ad: "Başka veritabanına (K2016_dvz, eski adlar) yazan tetik kalmadı", durum: dis.length ? "FARK" : "TAMAM", ornekler: dis });
    // Çalışma tarafı: e-Döviz yalnız resmî taraftan gider; burada e-Belge (ICE) ayarı olmamalı (K3)
    if (c.rol === "CALISMA") {
      const ayarVar = (await sorgu(`SELECT OBJECT_ID(${n(c.hedefDb + ".dbo.TODVZ_EBELGE_AYAR")}) AS L`))[0].L !== null;
      const ayarSayisi = ayarVar ? Number((await sorgu(`SELECT COUNT(*) AS N FROM ${tamAd(c.hedefDb, "TODVZ_EBELGE_AYAR")}`))[0].N) : 0;
      k.push({
        grup: "EK",
        tablo: "TODVZ_EBELGE_AYAR",
        ad: "Çalışma tarafında e-Belge (ICE) ayarı yok (e-Döviz yalnız resmî taraftan)",
        durum: ayarSayisi ? "UYARI" : "TAMAM",
        hedef: ayarSayisi,
        ayrinti: ayarSayisi ? "Bu firmadan da gönderim yapılabilir; aynı belge iki yerden gidebilir. Ayarı yalnız resmî firmada tutun." : undefined,
      });
    }
    // Çalışma tarafı: Fiş Aktarma hedefi eş (resmî) olmalı
    if (c.rol === "CALISMA") {
      const diger = (await sorgu(`SELECT CASE WHEN COL_LENGTH(${n(`${c.hedefDb}.dbo.TODVZ_TANIM`)}, 'DIGER_VERITABANI_ADI') IS NULL THEN NULL ELSE 1 END AS V`))[0].V;
      if (diger) {
        const [d] = await sorgu(`SELECT RTRIM(DIGER_VERITABANI_ADI) AS D FROM ${tamAd(c.hedefDb, "TODVZ_TANIM")}`);
        k.push({ grup: "EK", tablo: "TODVZ_TANIM", ad: `${c.hedefDb} Fiş Aktarma hedefi`, durum: String(d?.D || "").toUpperCase() === c.esHedefDb.toUpperCase() ? "TAMAM" : "FARK", kaynak: c.esHedefDb, hedef: d?.D ?? null });
      }
    }
  }
  return k;
};

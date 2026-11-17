import sql from "mssql";
import { AktarimPlani, KolonPlani, TabloPlani, planOlustur } from "./aktarimPlani.js";
import { KolonBilgisi, Sema, kolonBul, n, q, semaOku, tabloBul, tamAd, tipTanimi } from "./aktarimSema.js";

/**
 * Veri aktarımı — doğrulama sistemi (docs/VERITABANI_TASIMA_YOL_HARITASI.md, K10, Faz 4).
 *
 * Kaynak (eski programın yedeği) ile hedef (firma veritabanı) karşılaştırılır:
 *  1. SATIR_SAYISI   her tabloda kaynak = hedef
 *  2. ICERIK         birincil anahtara göre her satırın SHA-256 özeti; kaynak tarafı aktarımdaki kural ifadeleriyle,
 *                    hedef tipine çevrilerek hesaplanır (kurallar da doğrulanmış olur). Anahtarsız tabloda özet kümesi.
 *  3. DOLULUK        her çalıştırmada farklı üretilen kolonlar (yeni GUID) hedefte dolu mu
 *  4. SAYISAL_TOPLAM ondalıklı kolonların toplamları (okunabilir ikinci katman)
 *  5. E_DOVIZ        seri başına belge sayısı / son numara, numaratör
 *  6. KULLANICI      müşterinin bütün kullanıcıları hedefte var mı (firma açılışındaki kullanıcı bilgi olarak)
 *  7. KIMLIK         kimlik sayacı en büyük değerin altında değil (yeni kayıt çakışmaz)
 *  8. SEMA           hedefte kapalı / güvenilmeyen kısıt ve kapalı tetik (uyarı)
 * Aktarım motorunda COMMIT'ten önce aynı işlem içinde çalışır; komut satırından (aktarim-dogrula) ve panelden de çalışır.
 */

export type KontrolDurumu = "TAMAM" | "FARK" | "UYARI" | "BILGI";

export interface DogrulamaKontrolu {
  grup: "SATIR_SAYISI" | "ICERIK" | "DOLULUK" | "SAYISAL_TOPLAM" | "E_DOVIZ" | "KULLANICI" | "KIMLIK" | "SEMA" | "EK";
  tablo: string | null;
  ad: string;
  durum: KontrolDurumu;
  kaynak?: string | number | null;
  hedef?: string | number | null;
  ayrinti?: string;
  ornekler?: string[];
}

export interface DogrulamaRaporu {
  basarili: boolean;
  kaynakDb: string;
  hedefDb: string;
  zaman: string;
  sureMs: number;
  ozet: { tablo: number; satir: number; tamam: number; fark: number; uyari: number };
  kontroller: DogrulamaKontrolu[];
}

export interface DogrulamaSecenekleri {
  ornekSayisi?: number;
  /** Ek kontroller (ör. e-Döviz gönderildi işaretleri, R/A çifti) */
  ekKontroller?: (baglanti: sql.ConnectionPool | sql.Transaction, plan: AktarimPlani) => Promise<DogrulamaKontrolu[]>;
}

/** Hedefte, kaynakta adı olmayan satırlara (firma açılışındaki kullanıcılar) izin verilen tablolar: tablo → ad kolonu */
const FAZLA_IZINLI: Record<string, string> = { TODVZ_KULLANICI: "AD" };
const NULL_ISARETI = "N'∅'";
const AYRAC = "NCHAR(31)";

/** Değeri hedef tipine göre kararlı metne çevirir (özet için). */
export const normalIfade = (ifade: string, k: KolonBilgisi): string => {
  const t = k.tip;
  const c = `CAST(${ifade} AS ${tipTanimi(k)})`;
  if (t === "float" || t === "real") return `CONVERT(varchar(40), CAST(${c} AS float), 3)`;
  if (["decimal", "numeric", "money", "smallmoney", "tinyint", "smallint", "int", "bigint", "bit"].includes(t)) return `CONVERT(varchar(60), ${c})`;
  if (["datetime", "datetime2", "smalldatetime", "date"].includes(t)) return `CONVERT(varchar(40), CAST(${c} AS datetime2(7)), 126)`;
  if (t === "time") return `CONVERT(varchar(30), ${c})`;
  if (t === "datetimeoffset") return `CONVERT(varchar(50), ${c}, 127)`;
  if (["varbinary", "binary", "image"].includes(t)) return `CONVERT(varchar(max), CAST(${c} AS varbinary(max)), 2)`;
  if (t === "uniqueidentifier") return `CONVERT(varchar(36), ${c})`;
  return `CAST(${c} AS nvarchar(max))`;
};

const ozetIfadesi = (parcalar: string[]): string =>
  parcalar.length === 0 ? "CAST(0x00 AS varbinary(32))" : `HASHBYTES('SHA2_256', CONCAT(${parcalar.map((p) => `ISNULL(${p}, ${NULL_ISARETI})`).join(`, ${AYRAC}, `)}, N''))`;

const metinMi = (k: KolonBilgisi) => ["varchar", "char", "nvarchar", "nchar", "text", "ntext"].includes(k.tip);
const anahtarIfadesi = (ifade: string, k: KolonBilgisi) => (metinMi(k) ? `CAST(${ifade} AS nvarchar(450)) COLLATE DATABASE_DEFAULT` : ifade);

const tek = async (b: sql.ConnectionPool | sql.Transaction, sorgu: string): Promise<any> => (await new sql.Request(b as any).query(sorgu)).recordset[0] || {};
const coklu = async (b: sql.ConnectionPool | sql.Transaction, sorgu: string): Promise<any[]> => (await new sql.Request(b as any).query(sorgu)).recordset as any[];
const sayiMetni = (v: any): string | null => (v === null || v === undefined ? null : String(v));

export const dogrula = async (
  baglanti: sql.ConnectionPool | sql.Transaction,
  plan: AktarimPlani,
  secenek: DogrulamaSecenekleri = {}
): Promise<DogrulamaRaporu> => {
  const bas = Date.now();
  const ornekSayisi = secenek.ornekSayisi ?? 5;
  const kontroller: DogrulamaKontrolu[] = [];
  const ekle = (k: DogrulamaKontrolu) => kontroller.push(k);
  const hedefSema: Sema = await semaOku(baglanti, plan.hedefDb);
  const kaynakSema: Sema = await semaOku(baglanti, plan.kaynakDb);
  const kopyalanan = plan.tablolar.filter((t) => t.islem === "KOPYALA");
  let toplamSatir = 0;

  for (const tp of kopyalanan) {
    const ht = tabloBul(hedefSema, tp.tablo);
    const kt = tabloBul(kaynakSema, tp.tablo);
    if (!ht || !kt) {
      ekle({ grup: "SATIR_SAYISI", tablo: tp.tablo, ad: "Tablo", durum: "FARK", ayrinti: "Tablo kaynakta ya da hedefte bulunamadı." });
      continue;
    }
    const K = tamAd(plan.kaynakDb, tp.tablo);
    const H = tamAd(plan.hedefDb, tp.tablo);
    const fazlaKolon = FAZLA_IZINLI[tp.tablo.toUpperCase()];
    const fazlaKosulu = fazlaKolon && kolonBul(ht, fazlaKolon) && kolonBul(kt, fazlaKolon)
      ? `NOT EXISTS (SELECT 1 FROM ${K} KK WHERE UPPER(RTRIM(KK.${q(fazlaKolon)})) COLLATE DATABASE_DEFAULT = UPPER(RTRIM(H.${q(fazlaKolon)})) COLLATE DATABASE_DEFAULT)`
      : null;

    // 1) Satır sayısı
    const sayi = await tek(baglanti, `SELECT (SELECT COUNT_BIG(*) FROM ${K}) AS KS, (SELECT COUNT_BIG(*) FROM ${H}) AS HS${fazlaKosulu ? `, (SELECT COUNT_BIG(*) FROM ${H} H WHERE ${fazlaKosulu}) AS FZ` : ""}`);
    const ks = Number(sayi.KS), hs = Number(sayi.HS), fz = Number(sayi.FZ || 0);
    toplamSatir += ks;
    ekle({
      grup: "SATIR_SAYISI",
      tablo: tp.tablo,
      ad: "Satır sayısı",
      durum: ks === hs - fz ? "TAMAM" : "FARK",
      kaynak: ks,
      hedef: hs,
      ayrinti: fz ? `${fz} satır firma açılışından (kaynakta yok, korunuyor)` : undefined,
    });
    if (fz) ekle({ grup: "KULLANICI", tablo: tp.tablo, ad: "Firma açılışından korunan kayıt", durum: "BILGI", hedef: fz });
    if (ks === 0 && hs - fz === 0) continue;

    // 2) İçerik özeti
    const kolonlar = tp.kolonlar
      .filter((kp) => !kp.karsilastirmaDisi)
      .map((kp) => ({ kp, hk: kolonBul(ht, kp.hedef) }))
      .filter((x): x is { kp: KolonPlani; hk: KolonBilgisi } => !!x.hk);
    const det = kolonlar.filter((x) => x.kp.deterministik);
    const kaynakOzet = ozetIfadesi(det.map((x) => normalIfade(x.kp.ifade, x.hk)));
    const hedefOzet = ozetIfadesi(det.map((x) => normalIfade(`H.${q(x.hk.ad)}`, x.hk)));
    const hedefFiltre = fazlaKosulu ? `WHERE NOT (${fazlaKosulu})` : "";

    if (tp.anahtar.length) {
      const anahtarlar = tp.anahtar.map((a, i) => {
        const hk = kolonBul(ht, a)!;
        const kp = tp.kolonlar.find((x) => x.hedef.toUpperCase() === a.toUpperCase())!;
        return { ad: `A${i}`, kaynak: anahtarIfadesi(kp.ifade, hk), hedef: anahtarIfadesi(`H.${q(hk.ad)}`, hk) };
      });
      const r = await tek(baglanti, `
        SELECT SUM(CASE WHEN X.O IS NULL THEN 1 ELSE 0 END) AS FAZLA,
               SUM(CASE WHEN Y.O IS NULL THEN 1 ELSE 0 END) AS EKSIK,
               SUM(CASE WHEN X.O IS NOT NULL AND Y.O IS NOT NULL AND X.O <> Y.O THEN 1 ELSE 0 END) AS FARKLI
        FROM (SELECT ${anahtarlar.map((a) => `${a.kaynak} AS ${a.ad}`).join(", ")}, ${kaynakOzet} AS O FROM ${K} K) X
        FULL OUTER JOIN (SELECT ${anahtarlar.map((a) => `${a.hedef} AS ${a.ad}`).join(", ")}, ${hedefOzet} AS O FROM ${H} H ${hedefFiltre}) Y
          ON ${anahtarlar.map((a) => `X.${a.ad} = Y.${a.ad}`).join(" AND ")}`);
      const fazla = Number(r.FAZLA || 0), eksik = Number(r.EKSIK || 0), farkli = Number(r.FARKLI || 0);
      let ornekler: string[] | undefined;
      if (fazla + eksik + farkli > 0) {
        const o = await coklu(baglanti, `
          SELECT TOP (${ornekSayisi}) CASE WHEN X.O IS NULL THEN N'hedefte fazla' WHEN Y.O IS NULL THEN N'hedefte eksik' ELSE N'içerik farklı' END AS NEDEN,
                 CONCAT(${anahtarlar.map((a) => `N'${tp.anahtar[Number(a.ad.slice(1))]}=', CAST(COALESCE(X.${a.ad}, Y.${a.ad}) AS nvarchar(200))`).join(", N' ', ")}) AS ANAHTAR
          FROM (SELECT ${anahtarlar.map((a) => `${a.kaynak} AS ${a.ad}`).join(", ")}, ${kaynakOzet} AS O FROM ${K} K) X
          FULL OUTER JOIN (SELECT ${anahtarlar.map((a) => `${a.hedef} AS ${a.ad}`).join(", ")}, ${hedefOzet} AS O FROM ${H} H ${hedefFiltre}) Y
            ON ${anahtarlar.map((a) => `X.${a.ad} = Y.${a.ad}`).join(" AND ")}
          WHERE X.O IS NULL OR Y.O IS NULL OR X.O <> Y.O`);
        ornekler = o.map((x) => `${x.ANAHTAR}: ${x.NEDEN}`);
      }
      ekle({
        grup: "ICERIK",
        tablo: tp.tablo,
        ad: `Satır içerikleri (${det.length} kolon, anahtar ${tp.anahtar.join("+")})`,
        durum: fazla + eksik + farkli === 0 ? "TAMAM" : "FARK",
        kaynak: ks,
        hedef: hs - fz,
        ayrinti: fazla + eksik + farkli ? `${farkli} satır farklı, ${eksik} satır eksik, ${fazla} satır fazla` : undefined,
        ornekler,
      });
    } else {
      const r = await tek(baglanti, `
        SELECT SUM(ABS(ISNULL(X.C, 0) - ISNULL(Y.C, 0))) AS FARK, SUM(CASE WHEN X.C IS NULL OR Y.C IS NULL OR X.C <> Y.C THEN 1 ELSE 0 END) AS GRUP
        FROM (SELECT O, COUNT_BIG(*) AS C FROM (SELECT ${kaynakOzet} AS O FROM ${K} K) Z GROUP BY O) X
        FULL OUTER JOIN (SELECT O, COUNT_BIG(*) AS C FROM (SELECT ${hedefOzet} AS O FROM ${H} H ${hedefFiltre}) Z GROUP BY O) Y ON X.O = Y.O`);
      const fark = Number(r.FARK || 0);
      ekle({
        grup: "ICERIK",
        tablo: tp.tablo,
        ad: `Satır içerikleri (${det.length} kolon, anahtarsız: özet kümesi)`,
        durum: fark === 0 ? "TAMAM" : "FARK",
        kaynak: ks,
        hedef: hs - fz,
        ayrinti: fark ? `${fark} satırın özeti eşleşmiyor` : undefined,
      });
    }

    // 3) Doluluk (deterministik olmayan kolonlar)
    for (const x of kolonlar.filter((y) => !y.kp.deterministik)) {
      const r = await tek(baglanti, `SELECT COUNT_BIG(*) AS N FROM ${H} H WHERE H.${q(x.hk.ad)} IS NOT NULL ${fazlaKosulu ? `AND NOT (${fazlaKosulu})` : ""}`);
      ekle({ grup: "DOLULUK", tablo: tp.tablo, ad: `${x.hk.ad} dolu (${x.kp.kural || "yeni değer"})`, durum: Number(r.N) === ks ? "TAMAM" : "FARK", kaynak: ks, hedef: Number(r.N) });
    }

    // 4) Sayısal toplamlar (ondalıklı, doğrudan aktarılan kolonlar)
    const sayisal = kolonlar.filter((x) => x.kp.deterministik && ["float", "real", "decimal", "numeric", "money", "smallmoney"].includes(x.hk.tip));
    if (sayisal.length) {
      const sec = (on: string, ifade: (x: (typeof sayisal)[number]) => string, kaynakMi: boolean) =>
        sayisal.map((x, i) => `SUM(CAST(ROUND(CAST(${ifade(x)} AS float), 6) AS decimal(38, 6))) AS ${on}${i}`).join(", ") + (kaynakMi ? "" : "");
      const kr = await tek(baglanti, `SELECT ${sec("S", (x) => `CAST(${x.kp.ifade} AS ${tipTanimi(x.hk)})`, true)} FROM ${K} K`);
      const hr = await tek(baglanti, `SELECT ${sec("S", (x) => `H.${q(x.hk.ad)}`, false)} FROM ${H} H ${hedefFiltre}`);
      sayisal.forEach((x, i) => {
        const a = sayiMetni(kr[`S${i}`]), b = sayiMetni(hr[`S${i}`]);
        ekle({ grup: "SAYISAL_TOPLAM", tablo: tp.tablo, ad: `${x.hk.ad} toplamı`, durum: a === b ? "TAMAM" : "FARK", kaynak: a, hedef: b });
      });
    }
  }

  // 5) e-Döviz serileri ve numaratör
  if (tabloBul(kaynakSema, "TODVZ_FIS_SATIRI") && tabloBul(hedefSema, "TODVZ_FIS_SATIRI")) {
    const seri = (db: string) => coklu(baglanti, `
      SELECT LEFT(RTRIM(BELGE_NO), 7) AS SERI, COUNT_BIG(*) AS N, MAX(RTRIM(BELGE_NO)) AS SON FROM ${tamAd(db, "TODVZ_FIS_SATIRI")}
      WHERE BELGE_NO LIKE '[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9][0-9]%' AND LEN(RTRIM(BELGE_NO)) = 16 GROUP BY LEFT(RTRIM(BELGE_NO), 7)`);
    const ks = await seri(plan.kaynakDb), hs = await seri(plan.hedefDb);
    for (const k of ks) {
      const h = hs.find((x) => x.SERI === k.SERI);
      const ayni = !!h && Number(h.N) === Number(k.N) && h.SON === k.SON;
      ekle({ grup: "E_DOVIZ", tablo: "TODVZ_FIS_SATIRI", ad: `${k.SERI} belge sayısı / son numara`, durum: ayni ? "TAMAM" : "FARK", kaynak: `${k.N} / ${k.SON}`, hedef: h ? `${h.N} / ${h.SON}` : null });
    }
    for (const h of hs.filter((x) => !ks.some((k) => k.SERI === x.SERI))) {
      ekle({ grup: "E_DOVIZ", tablo: "TODVZ_FIS_SATIRI", ad: `${h.SERI} belge sayısı / son numara`, durum: "FARK", kaynak: null, hedef: `${h.N} / ${h.SON}` });
    }
  }
  if (tabloBul(kaynakSema, "TODVZ_NUMERATOR") && tabloBul(hedefSema, "TODVZ_NUMERATOR")) {
    const num = (db: string) => coklu(baglanti, `SELECT TUR, RTRIM(ONEK) AS ONEK, BASLANGIC FROM ${tamAd(db, "TODVZ_NUMERATOR")} WHERE ONEK LIKE '[A-Z][A-Z][A-Z][0-9][0-9][0-9][0-9]%'`);
    const kn = await num(plan.kaynakDb), hn = await num(plan.hedefDb);
    for (const k of kn) {
      const h = hn.find((x) => Number(x.TUR) === Number(k.TUR) && x.ONEK === k.ONEK);
      ekle({ grup: "E_DOVIZ", tablo: "TODVZ_NUMERATOR", ad: `${k.ONEK} sıradaki numara`, durum: h && Number(h.BASLANGIC) === Number(k.BASLANGIC) ? "TAMAM" : "FARK", kaynak: Number(k.BASLANGIC), hedef: h ? Number(h.BASLANGIC) : null });
    }
  }

  // 6) Kullanıcılar
  if (tabloBul(kaynakSema, "TODVZ_KULLANICI") && tabloBul(hedefSema, "TODVZ_KULLANICI")) {
    const eksik = await coklu(baglanti, `
      SELECT RTRIM(K.AD) AS AD FROM ${tamAd(plan.kaynakDb, "TODVZ_KULLANICI")} K
      WHERE NOT EXISTS (SELECT 1 FROM ${tamAd(plan.hedefDb, "TODVZ_KULLANICI")} H WHERE UPPER(RTRIM(H.AD)) COLLATE DATABASE_DEFAULT = UPPER(RTRIM(K.AD)) COLLATE DATABASE_DEFAULT)`);
    ekle({ grup: "KULLANICI", tablo: "TODVZ_KULLANICI", ad: "Müşterinin bütün kullanıcıları hedefte", durum: eksik.length ? "FARK" : "TAMAM", ornekler: eksik.map((x) => String(x.AD)) });
  }

  // 7) Kimlik sayaçları
  for (const tp of kopyalanan) {
    const ht = tabloBul(hedefSema, tp.tablo);
    if (!ht?.kimlikKolonu) continue;
    const r = await tek(baglanti, `SELECT IDENT_CURRENT(${n(`${plan.hedefDb}.dbo.${tp.tablo}`)}) AS C, (SELECT MAX(${q(ht.kimlikKolonu)}) FROM ${tamAd(plan.hedefDb, tp.tablo)}) AS M`);
    if (r.M === null || r.M === undefined) continue;
    const tamam = Number(r.C) >= Number(r.M);
    if (!tamam) ekle({ grup: "KIMLIK", tablo: tp.tablo, ad: "Kimlik sayacı", durum: "FARK", kaynak: Number(r.M), hedef: Number(r.C), ayrinti: "Sayaç en büyük kimliğin altında; yeni kayıt çakışır." });
  }
  ekle({ grup: "KIMLIK", tablo: null, ad: "Kimlik sayaçları en büyük değerin altında değil", durum: kontroller.some((k) => k.grup === "KIMLIK" && k.durum === "FARK") ? "FARK" : "TAMAM" });

  // 8) Şema sağlığı (uyarı)
  const H = q(plan.hedefDb);
  const guvensiz = await coklu(baglanti, `
    SELECT t.name + N'.' + c.name AS A FROM ${H}.sys.foreign_keys c JOIN ${H}.sys.tables t ON t.object_id = c.parent_object_id WHERE c.is_disabled = 1 OR c.is_not_trusted = 1
    UNION ALL SELECT t.name + N'.' + c.name FROM ${H}.sys.check_constraints c JOIN ${H}.sys.tables t ON t.object_id = c.parent_object_id WHERE c.is_disabled = 1 OR c.is_not_trusted = 1`);
  ekle({ grup: "SEMA", tablo: null, ad: "Kapalı / doğrulanmamış kısıt", durum: guvensiz.length ? "UYARI" : "TAMAM", hedef: guvensiz.length, ornekler: guvensiz.slice(0, 20).map((x) => String(x.A)) });
  const kapaliTetik = await coklu(baglanti, `SELECT t.name + N'.' + tr.name AS A FROM ${H}.sys.triggers tr JOIN ${H}.sys.tables t ON t.object_id = tr.parent_id WHERE tr.is_disabled = 1`);
  ekle({ grup: "SEMA", tablo: null, ad: "Kapalı tetik", durum: kapaliTetik.length ? "UYARI" : "TAMAM", hedef: kapaliTetik.length, ornekler: kapaliTetik.slice(0, 20).map((x) => String(x.A)) });

  if (secenek.ekKontroller) kontroller.push(...(await secenek.ekKontroller(baglanti, plan)));

  const fark = kontroller.filter((k) => k.durum === "FARK").length;
  return {
    basarili: fark === 0,
    kaynakDb: plan.kaynakDb,
    hedefDb: plan.hedefDb,
    zaman: new Date().toISOString(),
    sureMs: Date.now() - bas,
    ozet: {
      tablo: kopyalanan.length,
      satir: toplamSatir,
      tamam: kontroller.filter((k) => k.durum === "TAMAM").length,
      fark,
      uyari: kontroller.filter((k) => k.durum === "UYARI").length,
    },
    kontroller,
  };
};

/** Aktarımdan bağımsız doğrulama: planı iki veritabanının şemasından yeniden kurar (komut satırı / panel "Yeniden doğrula"). */
export const veritabanlariniDogrula = async (
  baglanti: sql.ConnectionPool | sql.Transaction,
  kaynakDb: string,
  hedefDb: string,
  secenek: DogrulamaSecenekleri = {}
): Promise<DogrulamaRaporu> => {
  // Aktarım bilgisi olmadan: ortama göre yeniden yazılan yapılandırma kolonları (Diğer veritabanı) karşılaştırılmaz
  const plan = planOlustur(kaynakDb, hedefDb, await semaOku(baglanti, kaynakDb), await semaOku(baglanti, hedefDb), { yapilandirmaKarsilastirmaDisi: true });
  return dogrula(baglanti, plan, secenek);
};

/** Raporun konsol / düz metin özeti */
export const raporMetni = (r: DogrulamaRaporu, yalnizSorunlar = true): string => {
  const satirlar = [
    `Doğrulama: ${r.basarili ? "BAŞARILI" : "FARK VAR"} — ${r.kaynakDb} → ${r.hedefDb}`,
    `${r.ozet.tablo} tablo, ${r.ozet.satir} satır; ${r.ozet.tamam} kontrol tamam, ${r.ozet.fark} fark, ${r.ozet.uyari} uyarı (${Math.round(r.sureMs / 100) / 10} sn)`,
  ];
  for (const k of r.kontroller) {
    if (yalnizSorunlar && (k.durum === "TAMAM" || k.durum === "BILGI")) continue;
    satirlar.push(
      `  [${k.durum}] ${k.grup}${k.tablo ? ` ${k.tablo}` : ""}: ${k.ad}` +
        (k.kaynak !== undefined || k.hedef !== undefined ? ` (kaynak ${k.kaynak ?? "-"}, hedef ${k.hedef ?? "-"})` : "") +
        (k.ayrinti ? ` — ${k.ayrinti}` : "") +
        (k.ornekler?.length ? `\n      ${k.ornekler.join("\n      ")}` : "")
    );
  }
  return satirlar.join("\n");
};

export type { TabloPlani };

import sql from "mssql";
import { Engel } from "./aktarimInceleme.js";
import { AktarimPlani, PlanSecenekleri, TabloPlani, kopyalamaKomutu, planOlustur } from "./aktarimPlani.js";
import { n, q, semaOku, tabloBul, tamAd } from "./aktarimSema.js";

/**
 * Veri aktarımı — motor (docs/VERITABANI_TASIMA_YOL_HARITASI.md, Faz 3, bölüm 3).
 * Kaynak: yedekten geçici adla açılmış (salt okunur) müşteri veritabanı. Hedef: şablondan açılmış firma veritabanı.
 * Bütün yazma TEK işlem (transaction) içinde ve tek bağlantıda yapılır; herhangi bir adım ya da doğrulama tutmazsa
 * işlem geri alınır, hedef aktarım öncesindeki haline döner. Ayrıca işlemden önce hedefin COPY_ONLY yedeği alınır.
 */

export interface AktarimAdimi {
  adim: string;
  yuzde: number;
  mesaj: string;
}

export interface TabloSonucu {
  tablo: string;
  islem: TabloPlani["islem"];
  kaynakSatir: number;
  silinen: number;
  yazilan: number;
}

export interface DogrulamaOzeti {
  basarili: boolean;
  [k: string]: unknown;
}

export interface AktarimSecenekleri {
  /** Tek bağlantılı ve uzun zaman aşımlı havuz (master ya da herhangi bir DB) */
  pool: sql.ConnectionPool;
  kaynakDb: string;
  hedefDb: string;
  /** Hedefin aktarım öncesi COPY_ONLY yedeği (SQL Server'ın yazabildiği yol); null = alınmaz */
  onYedekYolu?: string | null;
  ilerleme?: (a: AktarimAdimi) => void;
  /** Kopyadan sonra, kısıtlar açılmadan önce aynı işlemde çalışan ek adımlar (R/A çifti, e-Döviz işaretleme). Not listesi döner. */
  ekAdimlar?: (tx: sql.Transaction, plan: AktarimPlani) => Promise<string[]>;
  /** COMMIT'ten önce aynı işlemde çalışan doğrulama; basarili=false ise işlem geri alınır */
  dogrula?: (tx: sql.Transaction, plan: AktarimPlani) => Promise<DogrulamaOzeti>;
  /** Aktarıma özel değer kuralları (ör. Diğer veritabanı) */
  planSecenekleri?: PlanSecenekleri;
}

export interface AktarimSonucu {
  basarili: boolean;
  kaynakDb: string;
  hedefDb: string;
  baslangic: string;
  bitis: string;
  sureMs: number;
  onYedek: string | null;
  tablolar: TabloSonucu[];
  korunanKullanicilar: string[];
  cakisanKullanicilar: string[];
  notlar: string[];
  kurallar: AktarimPlani["kurallar"];
  dogrulama: DogrulamaOzeti | null;
}

export class AktarimEngeli extends Error {
  constructor(public readonly engeller: Engel[]) {
    super(`Aktarım başlamadı: ${engeller.filter((e) => e.seviye === "ENGEL").map((e) => e.mesaj).join(" | ")}`);
  }
}

export class AktarimDogrulamaHatasi extends Error {
  constructor(public readonly dogrulama: DogrulamaOzeti) {
    super("Doğrulama tutmadı; aktarım geri alındı.");
  }
}

/** Planı ve veri denetimlerini hazırlar; engel varsa AktarimEngeli fırlatır. İnceleme ekranı da bunu çağırır. */
export const planHazirla = async (
  pool: sql.ConnectionPool,
  kaynakDb: string,
  hedefDb: string,
  planSecenekleri: PlanSecenekleri = {}
): Promise<{ plan: AktarimPlani; engeller: Engel[] }> => {
  const plan = planOlustur(kaynakDb, hedefDb, await semaOku(pool, kaynakDb), await semaOku(pool, hedefDb), planSecenekleri);
  const engeller = [...plan.engeller];
  // Motor yalnız dbo şemasını okur: başka şemada dolu tablo varsa sessizce atlanmasın (19.11.2026 denetimi)
  const disSema = (await new sql.Request(pool).query(`
    SELECT s.name AS SEMA, t.name AS TABLO, SUM(p.rows) AS SATIR
    FROM ${q(kaynakDb)}.sys.tables t
    JOIN ${q(kaynakDb)}.sys.schemas s ON s.schema_id = t.schema_id
    JOIN ${q(kaynakDb)}.sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
    WHERE t.is_ms_shipped = 0 AND s.name <> 'dbo'
    GROUP BY s.name, t.name HAVING SUM(p.rows) > 0`)).recordset as { SEMA: string; TABLO: string; SATIR: number }[];
  for (const t of disSema) {
    engeller.push({
      kod: "KAYIP_TABLO",
      seviye: "ENGEL",
      mesaj: `${t.SEMA}.${t.TABLO} tablosu (${t.SATIR} satır) dbo şemasında değil; aktarım yalnız dbo tablolarını taşır, veri kaybolur. Bu tablo için kural eklenmeli.`,
    });
  }
  for (const d of plan.denetimler) {
    const nSatir = Number((await new sql.Request(pool).query(d.sorgu)).recordset[0]?.N) || 0;
    if (nSatir > 0) engeller.push({ kod: d.kod, seviye: d.seviye, mesaj: `${d.mesaj} (${nSatir} satır)` });
  }
  return { plan, engeller };
};

const toplam = (r: sql.IResult<any>): number => (r.rowsAffected || []).reduce((t, x) => t + (Number(x) || 0), 0);

export const aktar = async (s: AktarimSecenekleri): Promise<AktarimSonucu> => {
  const baslangic = new Date();
  const ilerle = (adim: string, yuzde: number, mesaj: string) => s.ilerleme?.({ adim, yuzde, mesaj });
  const H = q(s.hedefDb);

  // 1) Plan + denetimler (yazma yok)
  ilerle("PLAN", 2, "Tablo ve kolon eşlemesi hazırlanıyor");
  const { plan, engeller } = await planHazirla(s.pool, s.kaynakDb, s.hedefDb, s.planSecenekleri);
  if (engeller.some((e) => e.seviye === "ENGEL")) throw new AktarimEngeli(engeller);
  const notlar: string[] = engeller.filter((e) => e.seviye === "UYARI").map((e) => e.mesaj);
  const kopyalanan = plan.tablolar.filter((t) => t.islem === "KOPYALA");
  const silinecek = plan.tablolar.filter((t) => t.islem === "KOPYALA" || t.islem === "SABLON_TEMIZLE");

  // Kesin kaynak satır sayıları (sys.partitions yaklaşık olabilir)
  const kesin = new Map<string, number>();
  for (let i = 0; i < kopyalanan.length; i += 50) {
    const parca = kopyalanan.slice(i, i + 50);
    const r = await new sql.Request(s.pool).query(
      parca.map((t) => `SELECT ${n(t.tablo)} AS T, COUNT_BIG(*) AS N FROM ${tamAd(s.kaynakDb, t.tablo)}`).join(" UNION ALL ")
    );
    for (const x of r.recordset as any[]) kesin.set(String(x.T).toUpperCase(), Number(x.N));
  }

  // 2) Ön yedek (işlem dışında)
  let onYedek: string | null = null;
  if (s.onYedekYolu) {
    ilerle("ON_YEDEK", 8, "Firma veritabanının aktarım öncesi yedeği alınıyor");
    await new sql.Request(s.pool).input("yol", sql.NVarChar(400), s.onYedekYolu).query(`BACKUP DATABASE ${H} TO DISK = @yol WITH COPY_ONLY, INIT, FORMAT, CHECKSUM`);
    onYedek = s.onYedekYolu;
  }

  const tx = new sql.Transaction(s.pool);
  await tx.begin();
  const r = () => new sql.Request(tx);
  const tablolar: TabloSonucu[] = [];
  let korunanKullanicilar: string[] = [];
  let cakisanKullanicilar: string[] = [];
  let adim = "BASLA";
  try {
    // 3) Tetik ve kısıtların durumunu kaydet, kapat
    adim = "KISIT_KAPAT";
    ilerle(adim, 12, "Tetikler ve kısıtlar geçici kapatılıyor");
    const tetikler = (await r().query(`
      SELECT t.name AS TABLO, tr.name AS TETIK FROM ${H}.sys.triggers tr JOIN ${H}.sys.tables t ON t.object_id = tr.parent_id
      WHERE tr.parent_class = 1 AND tr.is_disabled = 0`)).recordset as { TABLO: string; TETIK: string }[];
    const kisitlar = (await r().query(`
      SELECT t.name AS TABLO, c.name AS AD, c.is_not_trusted AS GUVENSIZ FROM ${H}.sys.foreign_keys c JOIN ${H}.sys.tables t ON t.object_id = c.parent_object_id WHERE c.is_disabled = 0
      UNION ALL
      SELECT t.name, c.name, c.is_not_trusted FROM ${H}.sys.check_constraints c JOIN ${H}.sys.tables t ON t.object_id = c.parent_object_id WHERE c.is_disabled = 0`)).recordset as { TABLO: string; AD: string; GUVENSIZ: boolean }[];
    const tetikliTablolar = [...new Set(tetikler.map((x) => x.TABLO))];
    const kisitliTablolar = [...new Set(kisitlar.map((x) => x.TABLO))];
    for (const t of tetikliTablolar) await r().batch(`ALTER TABLE ${tamAd(s.hedefDb, t)} DISABLE TRIGGER ALL;`);
    for (const t of kisitliTablolar) await r().batch(`ALTER TABLE ${tamAd(s.hedefDb, t)} NOCHECK CONSTRAINT ALL;`);

    // 4) Firma açılırken oluşan kullanıcıları sakla (K11)
    const kullaniciKopyalaniyor = kopyalanan.some((t) => t.tablo.toUpperCase() === "TODVZ_KULLANICI");
    if (kullaniciKopyalaniyor) {
      await r().batch(`IF OBJECT_ID('tempdb..#yerelKullanici') IS NOT NULL DROP TABLE #yerelKullanici; SELECT * INTO #yerelKullanici FROM ${tamAd(s.hedefDb, "TODVZ_KULLANICI")};`);
    }

    // 5) Sil + kopyala
    adim = "SIL";
    ilerle(adim, 15, "Şablon satırları siliniyor");
    const silinen = new Map<string, number>();
    for (const t of silinecek) silinen.set(t.tablo.toUpperCase(), toplam(await r().batch(`SET NOCOUNT OFF; DELETE FROM ${tamAd(s.hedefDb, t.tablo)};`)));
    for (const t of plan.tablolar.filter((x) => x.islem === "SABLON_TEMIZLE")) {
      tablolar.push({ tablo: t.tablo, islem: t.islem, kaynakSatir: 0, silinen: silinen.get(t.tablo.toUpperCase()) || 0, yazilan: 0 });
    }

    adim = "KOPYALA";
    const toplamSatir = kopyalanan.reduce((x, t) => x + (kesin.get(t.tablo.toUpperCase()) || 0), 0) || 1;
    let biten = 0;
    for (const t of kopyalanan) {
      const beklenen = kesin.get(t.tablo.toUpperCase()) || 0;
      let yazilan = 0;
      if (beklenen > 0) {
        ilerle(adim, 15 + Math.round((biten / toplamSatir) * 65), `${t.tablo} kopyalanıyor (${beklenen} satır)`);
        yazilan = toplam(await r().batch(kopyalamaKomutu(plan, t)));
        if (yazilan !== beklenen) throw new Error(`${t.tablo}: ${beklenen} satırdan ${yazilan} satır yazıldı.`);
      }
      biten += beklenen;
      tablolar.push({ tablo: t.tablo, islem: t.islem, kaynakSatir: beklenen, silinen: silinen.get(t.tablo.toUpperCase()) || 0, yazilan });
    }

    // 6) Saklanan kullanıcıları yeni kimlikle geri yaz (adı müşterinin kullanıcılarıyla çakışmayanlar)
    if (kullaniciKopyalaniyor) {
      adim = "KULLANICI";
      const hk = tabloBul(await semaOku(tx, s.hedefDb), "TODVZ_KULLANICI")!;
      const kolon = hk.kolonlar.filter((k) => !k.kimlik && !k.hesaplanan && k.tip !== "timestamp").map((k) => q(k.ad)).join(", ");
      const yerel = (await r().query(`SELECT RTRIM(AD) AS AD FROM #yerelKullanici`)).recordset.map((x: any) => String(x.AD || "").trim()).filter(Boolean);
      const cakisan = (await r().query(`SELECT RTRIM(y.AD) AS AD FROM #yerelKullanici y WHERE EXISTS (SELECT 1 FROM ${tamAd(s.hedefDb, "TODVZ_KULLANICI")} h WHERE UPPER(RTRIM(h.AD)) = UPPER(RTRIM(y.AD)))`)).recordset.map((x: any) => String(x.AD).trim());
      if (yerel.length) {
        await r().batch(`
          INSERT INTO ${tamAd(s.hedefDb, "TODVZ_KULLANICI")} (${kolon})
          SELECT ${kolon} FROM #yerelKullanici y
          WHERE NOT EXISTS (SELECT 1 FROM ${tamAd(s.hedefDb, "TODVZ_KULLANICI")} h WHERE UPPER(RTRIM(h.AD)) = UPPER(RTRIM(y.AD)))
          ORDER BY y.KULLANICI_ID;`);
      }
      cakisanKullanicilar = cakisan;
      korunanKullanicilar = yerel.filter((a) => !cakisan.some((c) => c.toUpperCase() === a.toUpperCase()));
      await r().batch(`DROP TABLE #yerelKullanici;`);
      if (cakisan.length) notlar.push(`Firma açılışındaki kullanıcı(lar) müşterinin aynı adlı kullanıcısıyla eşleşti: ${cakisan.join(", ")}.`);
    }

    // 7) Ek adımlar (R/A çifti, e-Döviz işaretleme)
    if (s.ekAdimlar) {
      adim = "EK_ADIMLAR";
      ilerle(adim, 82, "Çift ve e-Döviz adımları");
      notlar.push(...(await s.ekAdimlar(tx, plan)));
    }

    // 8) Kimlik sayaçları, kısıtlar (doğrulayarak) ve tetikler
    adim = "KIMLIK";
    for (const t of kopyalanan.filter((x) => x.kimlikEkle)) {
      await r().batch(`DBCC CHECKIDENT (${n(`${H}.[dbo].${q(t.tablo)}`)}, RESEED) WITH NO_INFOMSGS;`);
    }
    adim = "KISIT_AC";
    ilerle(adim, 86, "Kısıtlar doğrulanarak açılıyor");
    for (const k of kisitlar) {
      try {
        await r().batch(`ALTER TABLE ${tamAd(s.hedefDb, k.TABLO)} ${k.GUVENSIZ ? "" : "WITH CHECK "}CHECK CONSTRAINT ${q(k.AD)};`);
      } catch (err: any) {
        throw new Error(`${k.TABLO}.${k.AD} kısıtı aktarılan veriyle tutmuyor: ${String(err?.message || err).slice(0, 300)}`);
      }
    }
    // Ek adımlar (çift) bazı şablon tetiklerini kaldırmış olabilir: yalnız hâlâ var olanlar açılır; yeni kurulanlar zaten açık
    for (const t of tetikler) {
      await r().batch(
        `IF OBJECT_ID(${n(`${s.hedefDb}.dbo.${t.TETIK}`)}, 'TR') IS NOT NULL ALTER TABLE ${tamAd(s.hedefDb, t.TABLO)} ENABLE TRIGGER ${q(t.TETIK)};`
      );
    }

    // 9) Doğrulama (aynı işlemde) — tutmazsa geri al
    let dogrulama: DogrulamaOzeti | null = null;
    if (s.dogrula) {
      adim = "DOGRULA";
      ilerle(adim, 90, "Aktarılan veri kaynakla karşılaştırılıyor");
      dogrulama = await s.dogrula(tx, plan);
      if (!dogrulama.basarili) throw new AktarimDogrulamaHatasi(dogrulama);
    }

    adim = "COMMIT";
    await tx.commit();
    ilerle("BITTI", 100, "Aktarım tamamlandı");
    const bitis = new Date();
    return {
      basarili: true,
      kaynakDb: s.kaynakDb,
      hedefDb: s.hedefDb,
      baslangic: baslangic.toISOString(),
      bitis: bitis.toISOString(),
      sureMs: bitis.getTime() - baslangic.getTime(),
      onYedek,
      tablolar,
      korunanKullanicilar,
      cakisanKullanicilar,
      notlar,
      kurallar: plan.kurallar,
      dogrulama,
    };
  } catch (err: any) {
    await tx.rollback().catch(() => undefined);
    if (err instanceof AktarimDogrulamaHatasi || err instanceof AktarimEngeli) throw err;
    const e = new Error(`Aktarım geri alındı (${adim}): ${String(err?.message || err).slice(0, 500)}`);
    (e as any).adim = adim;
    throw e;
  }
};

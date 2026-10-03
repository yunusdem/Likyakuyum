import sql from "mssql";
import { logger } from "../utils/logger.js";
import { AktarimAdayi, TipKurali } from "./ebankaAktarimSql.repository.js";
import { DbContext, ebankaOzetOnbellegi } from "./ebankaSql.repository.js";
import { EBankaVeriSqlRepository } from "./ebankaVeriSql.repository.js";

// F- e-Banka > Tahsilat / Ödeme Mutabakatı (docs/TAHSILAT_MUTABAKATI_YOL_HARITASI.md)
// Banka parası ↔ fiş (döviz / sarraf / perakende) eşleşmesi ve fişin faturalanma durumu.
// Fiş tabloları başka modüllerindir: yalnızca OKUNUR. Yazılan tek şey e-Banka'nın kendi eşleştirme tablolarıdır.

export type FisTuru = "doviz" | "sarraf" | "perakende";
/** Gelen para satış fişiyle, giden para alış fişiyle (perakendede iade) eşleşir. */
export type Yon = "gelen" | "giden";

export interface MutabakatHareketi extends AktarimAdayi {
  aktarilanCariId: number | null;
  /** Mutabakat ekranında kullanıcının onayladığı / seçtiği cari (M11) */
  onayliCariId: number | null;
  /** Fiş kesmede ödeme satırına yazılacak Banka Hesap Kartı: e-Banka hesabı kartla eşlenmemişse IBAN'ı tutan kart */
  fisBankaId: number | null;
  faturaGerekmez: boolean;
  not: string | null;
}

export interface MutabakatFisi {
  fisTuru: FisTuru;
  fisId: number;
  fisNo: string | null;
  tarih: string | null;
  cariKartId: number | null;
  cariAdi: string | null;
  yon: Yon;
  /** Bankadan geçmesi beklenen TL tutar (döviz fişinde ödenen tutar, sarrafta ödeme satırları, perakendede genel toplam) */
  tutar: number;
  /** Fişin kendi toplamı (döviz fişinde ödenen tutardan farklı olabilir) */
  fisToplami: number;
  faturali: boolean;
  faturaBilgisi: string | null;
}

export interface Eslesme {
  vomsisId: number;
  fisTuru: FisTuru;
  fisId: number;
  otomatik: boolean;
}

/** Aktarım durumu, fişin Hesap satırıyla karşılanma haline uymayan hareket (bkz. kapsamFarklari) */
export interface KapsamFarki {
  vomsisId: number;
  /** true: fişin Hesap satırı bankayı taşıyor ama durum henüz "fişle karşılandı" değil · false: durum öyle ama artık karşılanmıyor */
  karsilaniyor: boolean;
  bankaHareketId: number | null;
}

const zaman = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString().slice(0, 19).replace("T", " ") : null);
const gunTarihi = (g: string) => new Date(`${g}T00:00:00Z`);
/** Hareketin Banka Hesap Kartı: e-Banka hesabı kartla eşlenmemişse IBAN'ı tutan kart (h: TODVZ_EBANKA_HESAP, k: TODVZ_BANKA) */
const FIS_BANKA_ID = `COALESCE(k.BANKA_ID, (SELECT TOP 1 kb.BANKA_ID FROM TODVZ_BANKA kb
                 WHERE LEN(ISNULL(h.IBAN, '')) > 0 AND REPLACE(kb.IBAN, ' ', '') IN (REPLACE(h.IBAN, ' ', ''), REPLACE(ISNULL(h.OZEL_IBAN, ''), ' ', ''))))`;

export class EBankaMutabakatSqlRepository {
  private static readonly hazirHavuzlar = new WeakSet<sql.ConnectionPool>();
  /** Havuz başına hangi fiş tablolarının bulunduğu (sarraf tabloları uygulamaca oluşturulmaz, her veritabanında olmayabilir) */
  private static readonly tablolar = new WeakMap<sql.ConnectionPool, Set<string>>();

  private static async pool(dbContext?: DbContext): Promise<sql.ConnectionPool> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    if (!this.hazirHavuzlar.has(pool)) {
      try {
        await pool.request().batch(`
          IF OBJECT_ID('TODVZ_EBANKA_MUTABAKAT', 'U') IS NULL
          BEGIN
            CREATE TABLE [dbo].[TODVZ_EBANKA_MUTABAKAT] (
              [VOMSIS_ID] BIGINT NOT NULL,
              [FIS_TURU] VARCHAR(10) NOT NULL,
              [FIS_ID] INT NOT NULL,
              [OTOMATIK] BIT NOT NULL DEFAULT 0,
              -- 1: kullanıcı bu eşleşmeyi kaldırdı; otomatik eşleştirme bu fişi bu harekete bir daha önermez
              [RED] BIT NOT NULL DEFAULT 0,
              [EKLEYEN_ID] INT NULL,
              [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
              CONSTRAINT [PK_TODVZ_EBANKA_MUTABAKAT] PRIMARY KEY ([VOMSIS_ID], [FIS_TURU], [FIS_ID])
            );
            CREATE INDEX [IX_TODVZ_EBANKA_MUTABAKAT_FIS] ON [dbo].[TODVZ_EBANKA_MUTABAKAT] ([FIS_TURU], [FIS_ID]);
          END;

          IF OBJECT_ID('TODVZ_EBANKA_MUTABAKAT_ISARET', 'U') IS NULL
          BEGIN
            CREATE TABLE [dbo].[TODVZ_EBANKA_MUTABAKAT_ISARET] (
              [VOMSIS_ID] BIGINT NOT NULL PRIMARY KEY,
              [FATURA_GEREKMEZ] BIT NOT NULL DEFAULT 0,
              [NOTU] NVARCHAR(250) NULL,
              [CARI_KART_ID] INT NULL,
              [GUNCELLEYEN_ID] INT NULL,
              [GUNCELLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE()
            );
          END;

          IF COL_LENGTH('TODVZ_EBANKA_MUTABAKAT_ISARET', 'CARI_KART_ID') IS NULL
            ALTER TABLE [dbo].[TODVZ_EBANKA_MUTABAKAT_ISARET] ADD [CARI_KART_ID] INT NULL;
        `);
      } catch (err: any) {
        logger.warn(`[EBankaMutabakatSqlRepository.ensureTables] Warning: ${err.message}`);
      }
      const adlar = (
        await pool.request().query(`
          SELECT name FROM sys.tables WHERE name IN ('TODVZ_FIS','TODVZ_FIS_SATIRI','TODVZ_SARRAF_FISI','TODVZ_SARRAF_FISI_SATIRI','TODVZ_ODEME_SATIRI','TODVZ_FATURA','TODVZ_EBELGE_GIDEN','TODVZ_EBELGE_GELEN','TODVZ_CARI_KART')
        `)
      ).recordset.map((r: any) => String(r.name).toUpperCase());
      // Hesap satırı için üç kolon da gerekir (COL_LENGTH tablo ya da kolon yoksa NULL döner)
      const hesapKolonlari = (tablo: string) => ["ODEME_ARACI_TURU", "CARI_KART_ID", "POS_CIHAZI_ID"].map((k) => `COL_LENGTH('${tablo}','${k}')`).join(" + ");
      const kolonlar = (
        await pool.request().query(`
          SELECT COL_LENGTH('TODVZ_FIS','E_FATURA_ETTN') AS ETTN, COL_LENGTH('TODVZ_FIS','ODEME_TUTARI') AS ODEME,
                 ${hesapKolonlari("TODVZ_ODEME_SATIRI")} AS SARRAF_HESAP, ${hesapKolonlari("TODVZ_FATURA_ODEME")} AS PERAKENDE_HESAP
        `)
      ).recordset[0];
      const kume = new Set(adlar);
      if (kolonlar.ETTN !== null) kume.add("FIS.E_FATURA_ETTN");
      if (kolonlar.ODEME !== null) kume.add("FIS.ODEME_TUTARI");
      if (kolonlar.SARRAF_HESAP !== null && kume.has("TODVZ_SARRAF_FISI")) kume.add("ODEME_SATIRI.HESAP");
      if (kolonlar.PERAKENDE_HESAP !== null && kume.has("TODVZ_FATURA")) kume.add("FATURA_ODEME.HESAP");
      this.tablolar.set(pool, kume);
      this.hazirHavuzlar.add(pool);
    }
    return pool;
  }

  private static async var(pool: sql.ConnectionPool, ad: string): Promise<boolean> {
    return this.tablolar.get(pool)?.has(ad) ?? false;
  }

  // ─── Banka hareketleri ─────────────────────────────────────────────────────

  public static async hareketler(baslangic: string, bitis: string, dbContext?: DbContext): Promise<MutabakatHareketi[]> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("BAS", sql.DateTime, gunTarihi(baslangic));
    req.input("BIT", sql.DateTime, new Date(gunTarihi(bitis).getTime() + 86_400_000 - 1000));
    const rows = (
      await req.query(`
        SELECT t.*, k.BANKA_ID AS KART_BANKA_ID, h.HESAP_NO, b.BANKA_ADI, p.TIP_ADI, ISNULL(p.KURAL, 0) AS KURAL, p.CARI_KART_ID AS TIP_CARI_ID,
               i.FATURA_GEREKMEZ, i.NOTU, i.CARI_KART_ID AS ONAYLI_CARI_ID,
               ${FIS_BANKA_ID} AS FIS_BANKA_ID
        FROM TODVZ_EBANKA_HAREKET t
        LEFT JOIN TODVZ_EBANKA_HESAP h ON h.VOMSIS_HESAP_ID = t.VOMSIS_HESAP_ID
        LEFT JOIN TODVZ_BANKA k ON k.BANKA_ID = h.BANKA_ID
        LEFT JOIN TODVZ_EBANKA_BANKA b ON b.VOMSIS_BANKA_ID = h.VOMSIS_BANKA_ID
        LEFT JOIN TODVZ_EBANKA_HAREKET_TIPI p ON p.TIP_KODU = t.TIP_KODU
        LEFT JOIN TODVZ_EBANKA_MUTABAKAT_ISARET i ON i.VOMSIS_ID = t.VOMSIS_ID
        WHERE t.SISTEM_TARIHI BETWEEN @BAS AND @BIT AND t.TUTAR <> 0
        ORDER BY t.SISTEM_TARIHI DESC, t.VOMSIS_ID DESC
      `)
    ).recordset;
    return rows.map((r: any) => ({
      vomsisId: Number(r.VOMSIS_ID),
      vomsisHesapId: r.VOMSIS_HESAP_ID,
      bankaId: r.KART_BANKA_ID ?? null,
      bankaAdi: r.BANKA_ADI || "",
      hesapNo: r.HESAP_NO ?? null,
      tipKodu: r.TIP_KODU ?? null,
      tipAdi: r.TIP_ADI ?? null,
      tipKurali: (Number(r.KURAL) || 0) as TipKurali,
      tipCariId: r.TIP_CARI_ID ?? null,
      sistemTarihi: zaman(r.SISTEM_TARIHI),
      doviz: r.DOVIZ ?? null,
      tutar: Number(r.TUTAR) || 0,
      aciklama: r.ACIKLAMA ?? null,
      fisNo: r.FIS_NO ?? null,
      evrakNo: r.EVRAK_NO ?? null,
      karsiUnvan: r.KARSI_UNVAN ?? null,
      karsiIban: r.KARSI_IBAN ?? null,
      karsiVkn: r.KARSI_VKN ?? null,
      gonderenAd: r.GONDEREN_AD ?? null,
      gonderenUnvan: r.GONDEREN_UNVAN ?? null,
      gonderenTckn: r.GONDEREN_TCKN ?? null,
      gonderenVkn: r.GONDEREN_VKN ?? null,
      gonderenIban: r.GONDEREN_IBAN ?? null,
      aliciIban: r.ALICI_IBAN ?? null,
      odeyenVkn: r.ODEYEN_VKN ?? null,
      aktarilanCariId: r.CARI_KART_ID ?? null,
      onayliCariId: r.ONAYLI_CARI_ID ?? null,
      fisBankaId: r.FIS_BANKA_ID ?? null,
      faturaGerekmez: Boolean(r.FATURA_GEREKMEZ),
      not: r.NOTU ?? null,
    }));
  }

  // ─── Fişler ────────────────────────────────────────────────────────────────

  /**
   * Fişleri tek biçimde okur. Ya cari + tarih aralığıyla (aday arama) ya da tür/kimlik listesiyle (eşlenmiş fişler).
   * Faturalanma: döviz → satırda e-belge gönderilmiş ya da başlıkta ETTN ya da giden e-belge kaydı; sarraf → giden e-belge kaydı;
   * perakende → kendi e-belge durumu; alış (giden para) → carinin VKN'sinden ±30 gün içinde reddedilmemiş gelen e-fatura.
   */
  public static async fisler(
    secim: { cariIdler: number[]; baslangic: string; bitis: string } | { kimlikler: { fisTuru: FisTuru; fisId: number }[] },
    dbContext?: DbContext
  ): Promise<MutabakatFisi[]> {
    const pool = await this.pool(dbContext);
    const giden = await this.var(pool, "TODVZ_EBELGE_GIDEN");
    const gelen = (await this.var(pool, "TODVZ_EBELGE_GELEN")) && (await this.var(pool, "TODVZ_CARI_KART"));
    const cariVar = await this.var(pool, "TODVZ_CARI_KART");
    const temizId = (liste: number[]) => [...new Set(liste.filter((n) => Number.isSafeInteger(n) && n > 0))];

    const gidenGonderildi = (evrakTuru: number, idKolonu: string) =>
      giden ? `EXISTS (SELECT 1 FROM TODVZ_EBELGE_GIDEN g WHERE g.KAYNAK_FIS_ID LIKE CONCAT('${evrakTuru}:', ${idKolonu}, ':%') AND g.GONDERIM_DURUMU = 'GONDERILDI')` : "0 = 1";
    const gelenFatura = (tarihKolonu: string) =>
      gelen
        ? `EXISTS (SELECT 1 FROM TODVZ_EBELGE_GELEN e WHERE LEN(LTRIM(RTRIM(ISNULL(c.VERGI_KIMLIK_NO, '')))) >= 10
             AND e.SENDER LIKE '%' + LTRIM(RTRIM(c.VERGI_KIMLIK_NO)) + '%' AND ISNULL(e.RED_KABUL, '') <> 'RED'
             AND e.DUZENLEME_TARIHI BETWEEN DATEADD(DAY, -30, ${tarihKolonu}) AND DATEADD(DAY, 30, ${tarihKolonu}))`
        : "0 = 1";
    const cariJoin = (kolon: string) => (cariVar ? `LEFT JOIN TODVZ_CARI_KART c ON c.CARI_KART_ID = ${kolon}` : "");
    const cariAd = cariVar ? "LTRIM(RTRIM(c.AD))" : "NULL";

    const req = pool.request();
    let kosul: (tur: FisTuru, idKolonu: string, cariKolonu: string, tarihKolonu: string) => string;
    if ("cariIdler" in secim) {
      const idler = temizId(secim.cariIdler);
      if (!idler.length) return [];
      req.input("BAS", sql.DateTime, gunTarihi(secim.baslangic));
      req.input("BIT", sql.DateTime, new Date(gunTarihi(secim.bitis).getTime() + 86_400_000 - 1000));
      kosul = (_t, _i, cariKolonu, tarihKolonu) => `${cariKolonu} IN (${idler.join(",")}) AND ${tarihKolonu} BETWEEN @BAS AND @BIT`;
    } else {
      const grup = (t: FisTuru) => temizId(secim.kimlikler.filter((k) => k.fisTuru === t).map((k) => k.fisId));
      kosul = (t, idKolonu) => {
        const idler = grup(t);
        return idler.length ? `${idKolonu} IN (${idler.join(",")})` : "0 = 1";
      };
    }

    const parcalar: string[] = [];
    if ((await this.var(pool, "TODVZ_FIS")) && (await this.var(pool, "TODVZ_FIS_SATIRI"))) {
      const odenen = (await this.var(pool, "FIS.ODEME_TUTARI")) ? "ISNULL(NULLIF(f.ODEME_TUTARI, 0), f.TOPLAM_TUTAR)" : "f.TOPLAM_TUTAR";
      const ettn = (await this.var(pool, "FIS.E_FATURA_ETTN")) ? "LEN(ISNULL(f.E_FATURA_ETTN, '')) > 0 OR " : "";
      parcalar.push(`
        SELECT 'doviz' AS FIS_TURU, f.FIS_ID AS FIS_ID, LTRIM(RTRIM(CONCAT(f.SERI_NO, f.BELGE_NO))) AS FIS_NO, f.TARIH, f.CARI_KART_ID, ${cariAd} AS CARI_ADI,
               CASE WHEN f.TIP = 0 THEN 'giden' ELSE 'gelen' END AS YON,
               CAST(${odenen} AS DECIMAL(18,2)) AS TUTAR, CAST(f.TOPLAM_TUTAR AS DECIMAL(18,2)) AS FIS_TOPLAMI,
               CASE WHEN f.TIP = 0 THEN CASE WHEN ${gelenFatura("f.TARIH")} THEN 1 ELSE 0 END
                    ELSE CASE WHEN ${ettn}EXISTS (SELECT 1 FROM TODVZ_FIS_SATIRI s WHERE s.FIS_ID = f.FIS_ID AND s.E_BELGE_DURUMU = 1) OR ${gidenGonderildi(99, "f.FIS_ID")} THEN 1 ELSE 0 END END AS FATURALI
        FROM TODVZ_FIS f ${cariJoin("f.CARI_KART_ID")}
        WHERE ISNULL(f.IPTAL, 0) = 0 AND ${kosul("doviz", "f.FIS_ID", "f.CARI_KART_ID", "f.TARIH")}`);
    }
    if ((await this.var(pool, "TODVZ_SARRAF_FISI")) && (await this.var(pool, "TODVZ_ODEME_SATIRI")) && (await this.var(pool, "TODVZ_SARRAF_FISI_SATIRI"))) {
      parcalar.push(`
        SELECT 'sarraf' AS FIS_TURU, f.SARRAF_FISI_ID AS FIS_ID, LTRIM(RTRIM(CAST(f.FIS_NO AS VARCHAR(50)))) AS FIS_NO, f.TARIH, f.CARI_KART_ID, ${cariAd} AS CARI_ADI,
               CASE WHEN f.TIP = 0 THEN 'giden' ELSE 'gelen' END AS YON,
               CAST(ISNULL(NULLIF(os.TOPLAM, 0), ss.TOPLAM) AS DECIMAL(18,2)) AS TUTAR,
               CAST(ISNULL(ss.TOPLAM, 0) AS DECIMAL(18,2)) AS FIS_TOPLAMI,
               CASE WHEN f.TIP = 0 THEN CASE WHEN ${gelenFatura("f.TARIH")} THEN 1 ELSE 0 END
                    ELSE CASE WHEN ${gidenGonderildi(0, "f.SARRAF_FISI_ID")} THEN 1 ELSE 0 END END AS FATURALI
        FROM TODVZ_SARRAF_FISI f ${cariJoin("f.CARI_KART_ID")}
        -- Satır toplamı bir kez hesaplanır (TUTAR ve FIS_TOPLAMI ikisi de kullanır)
        OUTER APPLY (SELECT SUM(o.TUTAR) AS TOPLAM FROM TODVZ_ODEME_SATIRI o WHERE o.SARRAF_FISI_ID = f.SARRAF_FISI_ID) os
        OUTER APPLY (SELECT SUM(s.TUTAR) AS TOPLAM FROM TODVZ_SARRAF_FISI_SATIRI s WHERE s.SARRAF_FISI_ID = f.SARRAF_FISI_ID) ss
        WHERE ${kosul("sarraf", "f.SARRAF_FISI_ID", "f.CARI_KART_ID", "f.TARIH")}`);
    }
    if (await this.var(pool, "TODVZ_FATURA")) {
      parcalar.push(`
        SELECT 'perakende' AS FIS_TURU, f.FATURA_ID AS FIS_ID, LTRIM(RTRIM(CAST(f.FATURA_NO AS VARCHAR(50)))) AS FIS_NO, f.TARIH, f.CARI_KART_ID, ${cariAd} AS CARI_ADI,
               CASE WHEN f.FATURA_TIPI = 2 THEN 'giden' ELSE 'gelen' END AS YON,
               CAST(ISNULL(f.GENEL_TOPLAM, 0) * CASE WHEN ISNULL(f.PARA_ID, 1) = 1 OR ISNULL(f.KUR, 0) = 0 THEN 1 ELSE f.KUR END AS DECIMAL(18,2)) AS TUTAR,
               CAST(ISNULL(f.GENEL_TOPLAM, 0) * CASE WHEN ISNULL(f.PARA_ID, 1) = 1 OR ISNULL(f.KUR, 0) = 0 THEN 1 ELSE f.KUR END AS DECIMAL(18,2)) AS FIS_TOPLAMI,
               CASE WHEN f.E_BELGE_DURUMU IN (1, 2) THEN 1 ELSE 0 END AS FATURALI
        FROM TODVZ_FATURA f ${cariJoin("f.CARI_KART_ID")}
        WHERE ISNULL(f.E_BELGE_DURUMU, 0) <> 4 AND ${kosul("perakende", "f.FATURA_ID", "f.CARI_KART_ID", "f.TARIH")}`);
    }
    if (!parcalar.length) return [];

    const rows = (await req.query(parcalar.join("\nUNION ALL\n"))).recordset;
    return rows.map((r: any) => {
      const yon = r.YON as Yon;
      const faturali = Boolean(r.FATURALI);
      return {
        fisTuru: r.FIS_TURU as FisTuru,
        fisId: Number(r.FIS_ID),
        fisNo: r.FIS_NO || null,
        tarih: zaman(r.TARIH)?.slice(0, 10) ?? null,
        cariKartId: r.CARI_KART_ID ?? null,
        cariAdi: r.CARI_ADI ?? null,
        yon,
        tutar: Number(r.TUTAR) || 0,
        fisToplami: Number(r.FIS_TOPLAMI) || 0,
        faturali,
        faturaBilgisi: faturali ? (yon === "giden" && r.FIS_TURU !== "perakende" ? "Gelen e-fatura var" : "Faturası kesildi") : null,
      };
    });
  }

  // ─── Eşleşmeler ve işaretler ───────────────────────────────────────────────

  public static async eslesmeler(vomsisIdler: number[], dbContext?: DbContext): Promise<Eslesme[]> {
    const idler = vomsisIdler.filter((n) => Number.isSafeInteger(n) && n > 0);
    if (!idler.length) return [];
    const pool = await this.pool(dbContext);
    const rows = (await pool.request().query(`SELECT VOMSIS_ID, FIS_TURU, FIS_ID, OTOMATIK FROM TODVZ_EBANKA_MUTABAKAT WHERE RED = 0 AND VOMSIS_ID IN (${idler.join(",")})`)).recordset;
    return rows.map((r: any) => ({ vomsisId: Number(r.VOMSIS_ID), fisTuru: r.FIS_TURU as FisTuru, fisId: Number(r.FIS_ID), otomatik: Boolean(r.OTOMATIK) }));
  }

  /** Kullanıcının kaldırdığı (reddettiği) eşleşmeler: "vomsisId|fisTuru:fisId" */
  public static async reddedilenler(vomsisIdler: number[], dbContext?: DbContext): Promise<Set<string>> {
    const idler = vomsisIdler.filter((n) => Number.isSafeInteger(n) && n > 0);
    if (!idler.length) return new Set();
    const pool = await this.pool(dbContext);
    const rows = (await pool.request().query(`SELECT VOMSIS_ID, FIS_TURU, FIS_ID FROM TODVZ_EBANKA_MUTABAKAT WHERE RED = 1 AND VOMSIS_ID IN (${idler.join(",")})`)).recordset;
    return new Set(rows.map((r: any) => `${Number(r.VOMSIS_ID)}|${r.FIS_TURU}:${Number(r.FIS_ID)}`));
  }

  /** Verilen fişlerden herhangi bir banka hareketine (bu listenin dışındakiler dahil) eşlenmiş olanlar */
  public static async eslenmisFisler(fisler: { fisTuru: FisTuru; fisId: number }[], dbContext?: DbContext): Promise<Set<string>> {
    if (!fisler.length) return new Set();
    const pool = await this.pool(dbContext);
    const kosullar = (["doviz", "sarraf", "perakende"] as FisTuru[])
      .map((t) => {
        const idler = [...new Set(fisler.filter((f) => f.fisTuru === t).map((f) => f.fisId).filter((n) => Number.isSafeInteger(n) && n > 0))];
        return idler.length ? `(FIS_TURU = '${t}' AND FIS_ID IN (${idler.join(",")}))` : "";
      })
      .filter(Boolean);
    if (!kosullar.length) return new Set();
    const rows = (await pool.request().query(`SELECT DISTINCT FIS_TURU, FIS_ID FROM TODVZ_EBANKA_MUTABAKAT WHERE RED = 0 AND (${kosullar.join(" OR ")})`)).recordset;
    return new Set(rows.map((r: any) => `${r.FIS_TURU}:${r.FIS_ID}`));
  }

  public static async esle(e: Eslesme, kullaniciId?: number, dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("ID", sql.BigInt, e.vomsisId);
    req.input("TUR", sql.VarChar(10), e.fisTuru);
    req.input("FIS", sql.Int, e.fisId);
    req.input("OTO", sql.Bit, e.otomatik ? 1 : 0);
    req.input("KUL", sql.Int, kullaniciId ?? null);
    // Elle eşleme, daha önce reddedilmiş eşleşmeyi de geri açar; otomatik eşleme reddedileni asla açmaz
    await req.query(`
      UPDATE TODVZ_EBANKA_MUTABAKAT SET RED = 0, OTOMATIK = @OTO, EKLEYEN_ID = @KUL, EKLEME_ZAMANI = GETDATE()
      WHERE VOMSIS_ID = @ID AND FIS_TURU = @TUR AND FIS_ID = @FIS AND (RED = 1 AND @OTO = 0);
      IF NOT EXISTS (SELECT 1 FROM TODVZ_EBANKA_MUTABAKAT WHERE VOMSIS_ID = @ID AND FIS_TURU = @TUR AND FIS_ID = @FIS)
        INSERT INTO TODVZ_EBANKA_MUTABAKAT (VOMSIS_ID, FIS_TURU, FIS_ID, OTOMATIK, EKLEYEN_ID) VALUES (@ID, @TUR, @FIS, @OTO, @KUL);
    `);
  }

  /**
   * Otomatik eşleşmelerin toplu yazımı: esle(..., otomatik: true) ile aynı sonuç. Otomatik eşleme var olan (reddedilmiş dahil)
   * kaydı değiştirmez, yalnız olmayanı ekler.
   */
  public static async otomatikEsleToplu(eslesmeler: { vomsisId: number; fisTuru: FisTuru; fisId: number }[], kullaniciId?: number, dbContext?: DbContext): Promise<void> {
    if (!eslesmeler.length) return;
    const pool = await this.pool(dbContext);
    // 3 parametre x 600 = 1800 (sınır 2100)
    for (let i = 0; i < eslesmeler.length; i += 600) {
      const req = pool.request();
      req.input("KUL", sql.Int, kullaniciId ?? null);
      const satirlar = eslesmeler.slice(i, i + 600).map((e, j) => {
        req.input(`I${j}`, sql.BigInt, e.vomsisId);
        req.input(`T${j}`, sql.VarChar(10), e.fisTuru);
        req.input(`F${j}`, sql.Int, e.fisId);
        return `(@I${j}, @T${j}, @F${j})`;
      });
      await req.query(`
        INSERT INTO TODVZ_EBANKA_MUTABAKAT (VOMSIS_ID, FIS_TURU, FIS_ID, OTOMATIK, EKLEYEN_ID)
        SELECT DISTINCT v.ID, v.TUR, v.FIS, 1, @KUL FROM (VALUES ${satirlar.join(", ")}) v (ID, TUR, FIS)
        WHERE NOT EXISTS (SELECT 1 FROM TODVZ_EBANKA_MUTABAKAT m WHERE m.VOMSIS_ID = v.ID AND m.FIS_TURU = v.TUR AND m.FIS_ID = v.FIS)
      `);
    }
  }

  public static async eslemeyiKaldir(vomsisId: number, fisTuru: FisTuru, fisId: number, dbContext?: DbContext): Promise<number> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("ID", sql.BigInt, vomsisId);
    req.input("TUR", sql.VarChar(10), fisTuru);
    req.input("FIS", sql.Int, fisId);
    // Silinmez, reddedildi olarak işaretlenir: otomatik eşleştirme bir sonraki listelemede aynı fişi yeniden eşlemesin
    const r = await req.query(`UPDATE TODVZ_EBANKA_MUTABAKAT SET RED = 1 WHERE VOMSIS_ID = @ID AND FIS_TURU = @TUR AND FIS_ID = @FIS AND RED = 0`);
    return r.rowsAffected[0] || 0;
  }

  // ─── Fişle karşılanan hareketler (banka bakiyesinde çift sayım önlemi) ─────

  /**
   * Banka bakiyesi, sarraf / perakende fişindeki Hesap (ödeme aracı 3) satırını da sayar. Hareket, aynı Banka Hesap Kartına
   * Hesap satırı olan bir fişle eşlenmişse banka girişini o fiş taşır; ayrıca banka fişi olursa para iki kez sayılır.
   * Aktarım durumu bu hale uymayan hareketleri döner. vomsisIdler null: tüm hareketler.
   */
  public static async kapsamFarklari(vomsisIdler: number[] | null, dbContext?: DbContext): Promise<KapsamFarki[]> {
    const idler = vomsisIdler ? [...new Set(vomsisIdler.filter((n) => Number.isSafeInteger(n) && n > 0))] : null;
    if (idler && !idler.length) return [];
    const pool = await this.pool(dbContext);
    // Koşul, banka bakiyesi sorgusundakiyle aynı (bankaSql.repository > listBankalar)
    const hesapSatiri = (tablo: string, baslik: string, kolon: string) =>
      `EXISTS (SELECT 1 FROM ${tablo} o JOIN ${baslik} fb ON fb.${kolon} = o.${kolon}
               WHERE o.${kolon} = m.FIS_ID AND o.ODEME_ARACI_TURU = 3 AND bk.BANKA_ID IN (o.CARI_KART_ID, o.POS_CIHAZI_ID))`;
    const turler: string[] = [];
    if (await this.var(pool, "ODEME_SATIRI.HESAP")) turler.push(`(m.FIS_TURU = 'sarraf' AND ${hesapSatiri("TODVZ_ODEME_SATIRI", "TODVZ_SARRAF_FISI", "SARRAF_FISI_ID")})`);
    if (await this.var(pool, "FATURA_ODEME.HESAP")) turler.push(`(m.FIS_TURU = 'perakende' AND ${hesapSatiri("TODVZ_FATURA_ODEME", "TODVZ_FATURA", "FATURA_ID")})`);
    const karsilaniyor = turler.length
      ? `CASE WHEN bk.BANKA_ID IS NOT NULL AND EXISTS (SELECT 1 FROM TODVZ_EBANKA_MUTABAKAT m WHERE m.VOMSIS_ID = t.VOMSIS_ID AND m.RED = 0 AND (${turler.join(" OR ")})) THEN 1 ELSE 0 END`
      : "0";
    const rows = (
      await pool.request().query(`
        SELECT t.VOMSIS_ID, t.BANKA_HAREKET_ID, x.KARSILANIYOR
        FROM TODVZ_EBANKA_HAREKET t
        LEFT JOIN TODVZ_EBANKA_HESAP h ON h.VOMSIS_HESAP_ID = t.VOMSIS_HESAP_ID
        LEFT JOIN TODVZ_BANKA k ON k.BANKA_ID = h.BANKA_ID
        CROSS APPLY (SELECT ${FIS_BANKA_ID} AS BANKA_ID) bk
        CROSS APPLY (SELECT ${karsilaniyor} AS KARSILANIYOR) x
        WHERE ${idler ? `t.VOMSIS_ID IN (${idler.join(",")}) AND ` : ""}(
          -- Kilitlenmiş ama fişi henüz yazılmamış hareket (durum 1, fiş yok) aktarım bitince bir sonraki turda ele alınır
          (x.KARSILANIYOR = 1 AND ((t.AKTARIM_DURUMU = 0 AND t.BANKA_HAREKET_ID IS NULL) OR (t.AKTARIM_DURUMU = 1 AND t.BANKA_HAREKET_ID IS NOT NULL)))
          OR (x.KARSILANIYOR = 0 AND t.AKTARIM_DURUMU = 3)
        )
      `)
    ).recordset;
    return rows.map((r: any) => ({ vomsisId: Number(r.VOMSIS_ID), karsilaniyor: Boolean(r.KARSILANIYOR), bankaHareketId: r.BANKA_HAREKET_ID ?? null }));
  }

  /** Aktarım durumunu yalnız beklenen eski durumdaysa değiştirir: araya giren aktarım ya da kullanıcı işlemi ezilmez. */
  public static async kapsamDurumuYaz(vomsisId: number, eski: 0 | 2 | 3, yeni: 0 | 3, dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("ID", sql.BigInt, vomsisId);
    req.input("ESKI", sql.TinyInt, eski);
    req.input("YENI", sql.TinyInt, yeni);
    const r = await req.query(`
      UPDATE TODVZ_EBANKA_HAREKET SET AKTARIM_DURUMU = @YENI
      WHERE VOMSIS_ID = @ID AND AKTARIM_DURUMU = @ESKI AND (@ESKI = 2 OR BANKA_HAREKET_ID IS NULL)
    `);
    ebankaOzetOnbellegi.temizle(pool);
    return (r.rowsAffected[0] || 0) === 1;
  }

  /** Verilen hareketlerden banka girişi fişin Hesap satırında olanlar (aktarım durumu 3) */
  public static async fisleKarsilananlar(vomsisIdler: number[], dbContext?: DbContext): Promise<Set<number>> {
    const idler = vomsisIdler.filter((n) => Number.isSafeInteger(n) && n > 0);
    if (!idler.length) return new Set();
    const pool = await this.pool(dbContext);
    const rows = (await pool.request().query(`SELECT VOMSIS_ID FROM TODVZ_EBANKA_HAREKET WHERE AKTARIM_DURUMU = 3 AND VOMSIS_ID IN (${idler.join(",")})`)).recordset;
    return new Set(rows.map((r: any) => Number(r.VOMSIS_ID)));
  }

  public static async isaretle(vomsisId: number, faturaGerekmez: boolean, not: string | null, kullaniciId?: number, dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const var_ = pool.request();
    var_.input("ID", sql.BigInt, vomsisId);
    if (!(await var_.query(`SELECT 1 AS X FROM TODVZ_EBANKA_HAREKET WHERE VOMSIS_ID = @ID`)).recordset.length) return false;
    const req = pool.request();
    req.input("ID", sql.BigInt, vomsisId);
    req.input("GEREKMEZ", sql.Bit, faturaGerekmez ? 1 : 0);
    req.input("NOT", sql.NVarChar(250), not);
    req.input("KUL", sql.Int, kullaniciId ?? null);
    await req.query(`
      UPDATE TODVZ_EBANKA_MUTABAKAT_ISARET SET FATURA_GEREKMEZ = @GEREKMEZ, NOTU = @NOT, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() WHERE VOMSIS_ID = @ID;
      IF @@ROWCOUNT = 0 INSERT INTO TODVZ_EBANKA_MUTABAKAT_ISARET (VOMSIS_ID, FATURA_GEREKMEZ, NOTU, GUNCELLEYEN_ID) VALUES (@ID, @GEREKMEZ, @NOT, @KUL);
    `);
    return true;
  }

  /** Hareketin carisini onaylar / seçer (null: onayı kaldırır). Fatura gerektirmez işareti korunur. */
  public static async cariOnayla(vomsisId: number, cariKartId: number | null, kullaniciId?: number, dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const var_ = pool.request();
    var_.input("ID", sql.BigInt, vomsisId);
    if (!(await var_.query(`SELECT 1 AS X FROM TODVZ_EBANKA_HAREKET WHERE VOMSIS_ID = @ID`)).recordset.length) return false;
    const req = pool.request();
    req.input("ID", sql.BigInt, vomsisId);
    req.input("CARI", sql.Int, cariKartId);
    req.input("KUL", sql.Int, kullaniciId ?? null);
    await req.query(`
      UPDATE TODVZ_EBANKA_MUTABAKAT_ISARET SET CARI_KART_ID = @CARI, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() WHERE VOMSIS_ID = @ID;
      IF @@ROWCOUNT = 0 INSERT INTO TODVZ_EBANKA_MUTABAKAT_ISARET (VOMSIS_ID, FATURA_GEREKMEZ, CARI_KART_ID, GUNCELLEYEN_ID) VALUES (@ID, 0, @CARI, @KUL);
    `);
    return true;
  }
}

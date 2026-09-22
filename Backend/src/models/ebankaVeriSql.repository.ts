import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { logger } from "../utils/logger.js";
import { BankaSqlRepository } from "./bankaSql.repository.js";
import { DbContext, EBankaSqlRepository } from "./ebankaSql.repository.js";

// F- e-Banka (Vomsis) Faz 1 — Vomsis banka / hesap / hareket aynası (docs/EBANKA_VOMSIS_YOL_HARITASI.md)
// Tarihler Vomsis'ten geldiği duvar saatiyle saklanır; saat dilimi çevirisi yapılmaz.

// ─── Vomsis'ten gelen ham biçimler ───────────────────────────────────────────
export interface VomsisBanka {
  id: number;
  bank_name: string;
  bank_title: string;
  bank_code?: string | null;
  order?: number | null;
}

export interface VomsisHesap {
  id: number;
  bank_id?: number | null;
  branch_name?: string | null;
  fec_name?: string | null;
  account_number?: string | null;
  balance?: string | number | null;
  blocked_balance?: string | number | null;
  available_balance?: string | number | null;
  branch_id?: string | null;
  add_to_balance?: number | null;
  custom_iban?: string | null;
  iban?: string | null;
  status?: number | null;
  b_order?: number | null;
  product_code?: string | null;
  bank?: { id?: number } | null;
}

export interface VomsisHareket {
  id: number;
  vms_transaction_type?: string | null;
  bank_account_id: number;
  key?: string | null;
  transaction_type?: string | null;
  mt940transaction_type?: string | null;
  system_date?: string | null;
  accounting_date?: string | null;
  sender_identity_number?: string | null;
  sender_name?: string | null;
  sender_branch?: string | null;
  sender_title?: string | null;
  sender_iban?: string | null;
  sender_taxno?: string | null;
  // API yanıtında "reciever_iban", dokümandaki alan tablosunda "receiver_iban" yazıyor; ikisi de okunur
  reciever_iban?: string | null;
  receiver_iban?: string | null;
  opponent_title?: string | null;
  opponent_iban?: string | null;
  opponent_taxno?: string | null;
  fis_no?: string | null;
  payer_tax_no?: string | null;
  description?: string | null;
  fec_name?: string | null;
  amount?: string | number | null;
  current_balance?: string | number | null;
  resource_code?: string | null;
  type?: string | null;
  note?: string | null;
  order?: number | null;
  created_at?: string | null;
  tags?: unknown;
}

// ─── Ekrana dönen biçimler ───────────────────────────────────────────────────
export interface EBankaHesap {
  vomsisHesapId: number;
  bankaAdi: string;
  bankaKodu: string;
  subeAdi: string | null;
  subeKodu: string | null;
  doviz: string;
  hesapNo: string | null;
  iban: string | null;
  bakiye: number;
  blokeBakiye: number | null;
  kullanilabilirBakiye: number | null;
  bakiyeyeDahil: boolean;
  aktif: boolean;
  urunKodu: string | null;
  bankaId: number | null;
  bankaHesapNo: string | null;
  bankaHesapAdi: string | null;
  eslemeElle: boolean;
  guncellemeZamani: string | null;
}

/** 0 bekliyor · 1 aktarıldı · 2 aktarılmayacak (Faz 2'de kullanılır) */
export type AktarimDurumu = 0 | 1 | 2;

export interface EBankaHareket {
  vomsisId: number;
  vomsisHesapId: number;
  bankaAdi: string;
  hesapNo: string | null;
  hesapIban: string | null;
  tipKodu: string | null;
  tipAdi: string | null;
  bankaTipi: string | null;
  mt940Tipi: string | null;
  sistemTarihi: string | null;
  muhasebeTarihi: string | null;
  gonderenTckn: string | null;
  gonderenAd: string | null;
  gonderenSube: string | null;
  gonderenUnvan: string | null;
  gonderenIban: string | null;
  gonderenVkn: string | null;
  aliciIban: string | null;
  karsiUnvan: string | null;
  karsiIban: string | null;
  karsiVkn: string | null;
  fisNo: string | null;
  odeyenVkn: string | null;
  aciklama: string | null;
  doviz: string | null;
  tutar: number;
  bakiye: number | null;
  evrakNo: string | null;
  tur: string | null;
  notu: string | null;
  etiketler: string | null;
  aktarimDurumu: AktarimDurumu;
  bankaHareketId: number | null;
  cariKartId: number | null;
}

export interface HareketFiltre {
  baslangic?: string;
  bitis?: string;
  vomsisHesapId?: number;
  vomsisBankaId?: number;
  tipKodu?: string;
  tur?: string;
  aktarimDurumu?: number;
  arama?: string;
  sayfa?: number;
  sayfaBoyutu?: number;
}

// Yeni gelen hareket tipinin varsayılan kuralı. POS yatanlar aktarılmaz: tahsilat ödeme anında işlenir (E19).
// Nakit yatan/çekilen ve döviz alış/satış otomatik aktarılmaz, Bekleyenler'de kullanıcı karar verir (E27, E28).
const AKTARMA_TIPLERI = ["POSYAT", "POSBLG", "POSBLC", "POSYATIAD"];
const ELLE_TIPLERI = ["NAKYAT", "NAKCEK", "DOVAL", "DOVSAT"];
const VARSAYILAN_AKTARMA = AKTARMA_TIPLERI.map((t) => `'${t}'`).join(", ");
const VARSAYILAN_ELLE = ELLE_TIPLERI.map((t) => `'${t}'`).join(", ");
const varsayilanKural = (tipKodu: string): number => (AKTARMA_TIPLERI.includes(tipKodu) ? 2 : ELLE_TIPLERI.includes(tipKodu) ? 1 : 0);

const sayi = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const metin = (v: unknown, uzunluk: number): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, uzunluk) : null;
};

export const ibanTemizle = (v: unknown): string | null => {
  const s = String(v ?? "").replace(/\s+/g, "").toUpperCase();
  return s ? s.slice(0, 34) : null;
};

/** "YYYY-AA-GG SS:DD:ss" duvar saatini olduğu gibi saklamak için UTC kabul edilir (mssql useUTC). */
const vomsisTarihi = (v: unknown): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/.exec(String(v ?? ""));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
};

const tarihMetni = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString().slice(0, 19).replace("T", " ") : null);

/** tags: ["Fatura"] ya da [{tag:{name:"Virman"}}] biçiminde gelebilir */
const etiketMetni = (tags: unknown): string | null => {
  if (!Array.isArray(tags)) return null;
  const adlar = tags.map((t: any) => (typeof t === "string" ? t : t?.tag?.name || t?.name)).filter(Boolean);
  return adlar.length ? adlar.join(", ").slice(0, 500) : null;
};

export class EBankaVeriSqlRepository {
  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    await EBankaSqlRepository.ensureTables(pool);
    // Hesap eşlemesi TODVZ_BANKA'ya bakar; banka ekranı hiç açılmamış bir veritabanında tablo henüz olmayabilir
    await BankaSqlRepository.ensureTables(pool);
    try {
      const onceki = (await pool.request().query(`SELECT OBJECT_ID('TODVZ_EBANKA_HAREKET_TIPI', 'U') AS TABLO, COL_LENGTH('TODVZ_EBANKA_HAREKET_TIPI', 'KURAL') AS KOLON`)).recordset[0];
      const kuralKolonuYoktuMu = onceki.TABLO !== null && onceki.KOLON === null;
      await pool.request().batch(`
        IF OBJECT_ID('TODVZ_EBANKA_BANKA', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_BANKA] (
            [VOMSIS_BANKA_ID] INT NOT NULL PRIMARY KEY,
            [BANKA_KODU] VARCHAR(50) NOT NULL,
            [BANKA_ADI] NVARCHAR(150) NOT NULL,
            [EFT_KODU] VARCHAR(10) NULL,
            [SIRA] INT NULL
          );
        END;

        IF OBJECT_ID('TODVZ_EBANKA_HESAP', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_HESAP] (
            [VOMSIS_HESAP_ID] INT NOT NULL PRIMARY KEY,
            [VOMSIS_BANKA_ID] INT NULL,
            [SUBE_ADI] NVARCHAR(150) NULL,
            [SUBE_KODU] VARCHAR(20) NULL,
            [DOVIZ] VARCHAR(10) NOT NULL DEFAULT 'TL',
            [HESAP_NO] VARCHAR(50) NULL,
            [IBAN] VARCHAR(34) NULL,
            [OZEL_IBAN] VARCHAR(34) NULL,
            [BAKIYE] DECIMAL(18,2) NOT NULL DEFAULT 0,
            [BLOKE_BAKIYE] DECIMAL(18,2) NULL,
            [KULLANILABILIR_BAKIYE] DECIMAL(18,2) NULL,
            [BAKIYEYE_DAHIL] BIT NOT NULL DEFAULT 1,
            [DURUM] BIT NOT NULL DEFAULT 1,
            [URUN_KODU] VARCHAR(50) NULL,
            [SIRA] INT NULL,
            [BANKA_ID] INT NULL,
            [ESLEME_ELLE] BIT NOT NULL DEFAULT 0,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
        END;

        IF OBJECT_ID('TODVZ_EBANKA_HAREKET_TIPI', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_HAREKET_TIPI] (
            [TIP_KODU] VARCHAR(20) NOT NULL PRIMARY KEY,
            [TIP_ADI] NVARCHAR(100) NOT NULL
          );
        END;

        IF OBJECT_ID('TODVZ_EBANKA_HAREKET', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_HAREKET] (
            [VOMSIS_ID] BIGINT NOT NULL PRIMARY KEY,
            [VOMSIS_HESAP_ID] INT NOT NULL,
            [ANAHTAR] VARCHAR(64) NULL,
            [TIP_KODU] VARCHAR(50) NULL,
            [BANKA_TIPI] VARCHAR(50) NULL,
            [MT940_TIPI] VARCHAR(50) NULL,
            [SISTEM_TARIHI] DATETIME NULL,
            [MUHASEBE_TARIHI] DATETIME NULL,
            [GONDEREN_TCKN] VARCHAR(20) NULL,
            [GONDEREN_AD] NVARCHAR(200) NULL,
            [GONDEREN_SUBE] NVARCHAR(100) NULL,
            [GONDEREN_UNVAN] NVARCHAR(250) NULL,
            [GONDEREN_IBAN] VARCHAR(34) NULL,
            [GONDEREN_VKN] VARCHAR(20) NULL,
            [ALICI_IBAN] VARCHAR(34) NULL,
            [KARSI_UNVAN] NVARCHAR(250) NULL,
            [KARSI_IBAN] VARCHAR(34) NULL,
            [KARSI_VKN] VARCHAR(20) NULL,
            [FIS_NO] VARCHAR(50) NULL,
            [ODEYEN_VKN] VARCHAR(20) NULL,
            [ACIKLAMA] NVARCHAR(1000) NULL,
            [DOVIZ] VARCHAR(10) NULL,
            [TUTAR] DECIMAL(18,2) NOT NULL DEFAULT 0,
            [BAKIYE] DECIMAL(18,2) NULL,
            [EVRAK_NO] VARCHAR(50) NULL,
            [TUR] VARCHAR(10) NULL,
            [NOTU] NVARCHAR(500) NULL,
            [ETIKETLER] NVARCHAR(500) NULL,
            [SIRA] INT NULL,
            [VOMSIS_KAYIT_ZAMANI] DATETIME NULL,
            [AKTARIM_DURUMU] TINYINT NOT NULL DEFAULT 0,
            [BANKA_HAREKET_ID] INT NULL,
            [CARI_KART_ID] INT NULL,
            [CEKILME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE()
          );
          CREATE INDEX [IX_TODVZ_EBANKA_HAREKET_TARIH] ON [dbo].[TODVZ_EBANKA_HAREKET] ([SISTEM_TARIHI] DESC, [VOMSIS_ID] DESC);
          CREATE INDEX [IX_TODVZ_EBANKA_HAREKET_HESAP] ON [dbo].[TODVZ_EBANKA_HAREKET] ([VOMSIS_HESAP_ID], [SISTEM_TARIHI]);
        END;

        -- Faz 2: hareket tipi kuralı (0 otomatik aktar · 1 Bekleyenler'de kalsın · 2 aktarma) ve tipin varsayılan carisi (E14, E19, E27, E28)
        IF COL_LENGTH('TODVZ_EBANKA_HAREKET_TIPI', 'KURAL') IS NULL
          ALTER TABLE [dbo].[TODVZ_EBANKA_HAREKET_TIPI] ADD [KURAL] TINYINT NOT NULL CONSTRAINT [DF_TODVZ_EBANKA_HAREKET_TIPI_KURAL] DEFAULT 0, [CARI_KART_ID] INT NULL;

        -- Faz 2: elle aktarımda öğrenilen karşı IBAN → cari eşlemesi (E17). Cari kart tablosuna dokunulmaz.
        IF OBJECT_ID('TODVZ_EBANKA_CARI_IBAN', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_CARI_IBAN] (
            [IBAN] VARCHAR(34) NOT NULL PRIMARY KEY,
            [CARI_KART_ID] INT NOT NULL,
            [EKLEME_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE()
          );
        END;
      `);
      // Kolon bu açılışta eklendiyse (Faz 1'den kalan tablo) var olan tiplere varsayılan kurallar bir kez yazılır.
      // Ayrı batch: T-SQL, aynı batch'te eklenen kolonu derleme sırasında tanımaz.
      if (kuralKolonuYoktuMu) {
        await pool.request().batch(`
          UPDATE TODVZ_EBANKA_HAREKET_TIPI SET KURAL = 2 WHERE TIP_KODU IN (${VARSAYILAN_AKTARMA});
          UPDATE TODVZ_EBANKA_HAREKET_TIPI SET KURAL = 1 WHERE TIP_KODU IN (${VARSAYILAN_ELLE});
        `);
      }
    } catch (err: any) {
      logger.warn(`[EBankaVeriSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  // Tablo denetimi bağlantı havuzu başına bir kez yapılır
  private static readonly hazirHavuzlar = new WeakSet<sql.ConnectionPool>();

  public static async pool(dbContext?: DbContext): Promise<sql.ConnectionPool> {
    const pool = await getDbPool(dbContext?.dbServer, dbContext?.dbName);
    if (!this.hazirHavuzlar.has(pool)) {
      await this.ensureTables(pool);
      this.hazirHavuzlar.add(pool);
    }
    return pool;
  }

  // ─── Eşitleme yazımları ────────────────────────────────────────────────────

  public static async bankalariYaz(bankalar: VomsisBanka[], dbContext?: DbContext): Promise<number> {
    const pool = await this.pool(dbContext);
    for (const b of bankalar) {
      const req = pool.request();
      req.input("ID", sql.Int, b.id);
      req.input("KOD", sql.VarChar(50), metin(b.bank_name, 50) || String(b.id));
      req.input("AD", sql.NVarChar(150), metin(b.bank_title, 150) || metin(b.bank_name, 150) || String(b.id));
      req.input("EFT", sql.VarChar(10), metin(b.bank_code, 10));
      req.input("SIRA", sql.Int, b.order ?? null);
      await req.query(`
        UPDATE TODVZ_EBANKA_BANKA SET BANKA_KODU = @KOD, BANKA_ADI = @AD, EFT_KODU = @EFT, SIRA = @SIRA WHERE VOMSIS_BANKA_ID = @ID;
        IF @@ROWCOUNT = 0
          INSERT INTO TODVZ_EBANKA_BANKA (VOMSIS_BANKA_ID, BANKA_KODU, BANKA_ADI, EFT_KODU, SIRA) VALUES (@ID, @KOD, @AD, @EFT, @SIRA);
      `);
    }
    return bankalar.length;
  }

  public static async hesaplariYaz(hesaplar: VomsisHesap[], dbContext?: DbContext): Promise<number> {
    const pool = await this.pool(dbContext);
    for (const h of hesaplar) {
      const req = pool.request();
      req.input("ID", sql.Int, h.id);
      req.input("BANKA", sql.Int, h.bank_id ?? h.bank?.id ?? null);
      req.input("SUBE_ADI", sql.NVarChar(150), metin(h.branch_name, 150));
      req.input("SUBE_KODU", sql.VarChar(20), metin(h.branch_id, 20));
      req.input("DOVIZ", sql.VarChar(10), metin(h.fec_name, 10) || "TL");
      req.input("HESAP_NO", sql.VarChar(50), metin(h.account_number, 50));
      req.input("IBAN", sql.VarChar(34), ibanTemizle(h.iban));
      req.input("OZEL_IBAN", sql.VarChar(34), ibanTemizle(h.custom_iban));
      req.input("BAKIYE", sql.Decimal(18, 2), sayi(h.balance) ?? 0);
      req.input("BLOKE", sql.Decimal(18, 2), sayi(h.blocked_balance));
      req.input("KULLANILABILIR", sql.Decimal(18, 2), sayi(h.available_balance));
      req.input("DAHIL", sql.Bit, h.add_to_balance === 0 ? 0 : 1);
      req.input("DURUM", sql.Bit, h.status === 0 ? 0 : 1);
      req.input("URUN", sql.VarChar(50), metin(h.product_code, 50));
      req.input("SIRA", sql.Int, h.b_order ?? null);
      await req.query(`
        UPDATE TODVZ_EBANKA_HESAP SET
          VOMSIS_BANKA_ID = @BANKA, SUBE_ADI = @SUBE_ADI, SUBE_KODU = @SUBE_KODU, DOVIZ = @DOVIZ, HESAP_NO = @HESAP_NO,
          IBAN = @IBAN, OZEL_IBAN = @OZEL_IBAN, BAKIYE = @BAKIYE, BLOKE_BAKIYE = @BLOKE, KULLANILABILIR_BAKIYE = @KULLANILABILIR,
          BAKIYEYE_DAHIL = @DAHIL, DURUM = @DURUM, URUN_KODU = @URUN, SIRA = @SIRA, GUNCELLEME_ZAMANI = GETDATE()
        WHERE VOMSIS_HESAP_ID = @ID;
        IF @@ROWCOUNT = 0
          INSERT INTO TODVZ_EBANKA_HESAP (VOMSIS_HESAP_ID, VOMSIS_BANKA_ID, SUBE_ADI, SUBE_KODU, DOVIZ, HESAP_NO, IBAN, OZEL_IBAN, BAKIYE,
            BLOKE_BAKIYE, KULLANILABILIR_BAKIYE, BAKIYEYE_DAHIL, DURUM, URUN_KODU, SIRA, GUNCELLEME_ZAMANI)
          VALUES (@ID, @BANKA, @SUBE_ADI, @SUBE_KODU, @DOVIZ, @HESAP_NO, @IBAN, @OZEL_IBAN, @BAKIYE,
            @BLOKE, @KULLANILABILIR, @DAHIL, @DURUM, @URUN, @SIRA, GETDATE());
      `);
    }
    return hesaplar.length;
  }

  /**
   * E6: Banka Hesap Kartı ile IBAN üzerinden eşleşme. Yalnızca hiç eşlenmemiş ve kullanıcının elle dokunmadığı hesaplara uygulanır;
   * aynı IBAN birden çok kartta varsa eşleme yapılmaz (kullanıcı seçer).
   */
  public static async ibanIleEsle(dbContext?: DbContext): Promise<number> {
    const pool = await this.pool(dbContext);
    const r = await pool.request().query(`
      UPDATE h SET h.BANKA_ID = k.BANKA_ID
      FROM TODVZ_EBANKA_HESAP h
      CROSS APPLY (
        SELECT MIN(b.BANKA_ID) AS BANKA_ID, COUNT(*) AS ADET
        FROM TODVZ_BANKA b
        WHERE UPPER(REPLACE(ISNULL(b.IBAN, ''), ' ', '')) IN (h.IBAN, ISNULL(h.OZEL_IBAN, h.IBAN))
      ) k
      WHERE h.BANKA_ID IS NULL AND h.ESLEME_ELLE = 0 AND h.IBAN IS NOT NULL AND k.ADET = 1
        AND NOT EXISTS (SELECT 1 FROM TODVZ_EBANKA_HESAP d WHERE d.BANKA_ID = k.BANKA_ID);
    `);
    return r.rowsAffected[0] || 0;
  }

  public static async hareketTipleriniYaz(tipler: { type_no: string; type_name: string }[], dbContext?: DbContext): Promise<number> {
    const pool = await this.pool(dbContext);
    for (const t of tipler) {
      const kod = metin(t.type_no, 20);
      if (!kod) continue;
      const req = pool.request();
      req.input("KOD", sql.VarChar(20), kod);
      req.input("AD", sql.NVarChar(100), metin(t.type_name, 100) || kod);
      req.input("KURAL", sql.TinyInt, varsayilanKural(kod));
      // Var olan tipin kuralına dokunulmaz (kullanıcı değiştirmiş olabilir)
      await req.query(`
        UPDATE TODVZ_EBANKA_HAREKET_TIPI SET TIP_ADI = @AD WHERE TIP_KODU = @KOD;
        IF @@ROWCOUNT = 0 INSERT INTO TODVZ_EBANKA_HAREKET_TIPI (TIP_KODU, TIP_ADI, KURAL) VALUES (@KOD, @AD, @KURAL);
      `);
    }
    return tipler.length;
  }

  /** Vomsis id'si ile ekle/güncelle. Aktarım alanlarına (durum, fiş, cari) dokunmaz. */
  public static async hareketleriYaz(hareketler: VomsisHareket[], dbContext?: DbContext): Promise<{ yeni: number; guncellenen: number }> {
    const pool = await this.pool(dbContext);
    let yeni = 0;
    let guncellenen = 0;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const h of hareketler) {
        if (!h?.id || !h.bank_account_id) continue;
        const req = new sql.Request(tx);
        req.input("ID", sql.BigInt, h.id);
        req.input("HESAP", sql.Int, h.bank_account_id);
        req.input("ANAHTAR", sql.VarChar(64), metin(h.key, 64));
        req.input("TIP", sql.VarChar(50), metin(h.vms_transaction_type, 50));
        req.input("BANKA_TIPI", sql.VarChar(50), metin(h.transaction_type, 50));
        req.input("MT940", sql.VarChar(50), metin(h.mt940transaction_type, 50));
        req.input("SISTEM", sql.DateTime, vomsisTarihi(h.system_date));
        req.input("MUHASEBE", sql.DateTime, vomsisTarihi(h.accounting_date));
        req.input("G_TCKN", sql.VarChar(20), metin(h.sender_identity_number, 20));
        req.input("G_AD", sql.NVarChar(200), metin(h.sender_name, 200));
        req.input("G_SUBE", sql.NVarChar(100), metin(h.sender_branch, 100));
        req.input("G_UNVAN", sql.NVarChar(250), metin(h.sender_title, 250));
        req.input("G_IBAN", sql.VarChar(34), ibanTemizle(h.sender_iban));
        req.input("G_VKN", sql.VarChar(20), metin(h.sender_taxno, 20));
        req.input("A_IBAN", sql.VarChar(34), ibanTemizle(h.reciever_iban ?? h.receiver_iban));
        req.input("K_UNVAN", sql.NVarChar(250), metin(h.opponent_title, 250));
        req.input("K_IBAN", sql.VarChar(34), ibanTemizle(h.opponent_iban));
        req.input("K_VKN", sql.VarChar(20), metin(h.opponent_taxno, 20));
        req.input("FIS_NO", sql.VarChar(50), metin(h.fis_no, 50));
        req.input("ODEYEN_VKN", sql.VarChar(20), metin(h.payer_tax_no, 20));
        req.input("ACIKLAMA", sql.NVarChar(1000), metin(h.description, 1000));
        req.input("DOVIZ", sql.VarChar(10), metin(h.fec_name, 10));
        req.input("TUTAR", sql.Decimal(18, 2), sayi(h.amount) ?? 0);
        req.input("BAKIYE", sql.Decimal(18, 2), sayi(h.current_balance));
        req.input("EVRAK_NO", sql.VarChar(50), metin(h.resource_code, 50));
        req.input("TUR", sql.VarChar(10), metin(h.type, 10));
        req.input("NOTU", sql.NVarChar(500), metin(h.note, 500));
        req.input("ETIKETLER", sql.NVarChar(500), etiketMetni(h.tags));
        req.input("SIRA", sql.Int, h.order ?? null);
        req.input("KAYIT", sql.DateTime, vomsisTarihi(h.created_at));
        const r = await req.query(`
          UPDATE TODVZ_EBANKA_HAREKET SET
            VOMSIS_HESAP_ID = @HESAP, ANAHTAR = @ANAHTAR, TIP_KODU = @TIP, BANKA_TIPI = @BANKA_TIPI, MT940_TIPI = @MT940,
            SISTEM_TARIHI = @SISTEM, MUHASEBE_TARIHI = @MUHASEBE, GONDEREN_TCKN = @G_TCKN, GONDEREN_AD = @G_AD, GONDEREN_SUBE = @G_SUBE,
            GONDEREN_UNVAN = @G_UNVAN, GONDEREN_IBAN = @G_IBAN, GONDEREN_VKN = @G_VKN, ALICI_IBAN = @A_IBAN, KARSI_UNVAN = @K_UNVAN,
            KARSI_IBAN = @K_IBAN, KARSI_VKN = @K_VKN, FIS_NO = @FIS_NO, ODEYEN_VKN = @ODEYEN_VKN, ACIKLAMA = @ACIKLAMA, DOVIZ = @DOVIZ,
            TUTAR = @TUTAR, BAKIYE = @BAKIYE, EVRAK_NO = @EVRAK_NO, TUR = @TUR, NOTU = @NOTU, ETIKETLER = @ETIKETLER, SIRA = @SIRA,
            VOMSIS_KAYIT_ZAMANI = @KAYIT
          WHERE VOMSIS_ID = @ID;
          IF @@ROWCOUNT = 0
          BEGIN
            INSERT INTO TODVZ_EBANKA_HAREKET (VOMSIS_ID, VOMSIS_HESAP_ID, ANAHTAR, TIP_KODU, BANKA_TIPI, MT940_TIPI, SISTEM_TARIHI, MUHASEBE_TARIHI,
              GONDEREN_TCKN, GONDEREN_AD, GONDEREN_SUBE, GONDEREN_UNVAN, GONDEREN_IBAN, GONDEREN_VKN, ALICI_IBAN, KARSI_UNVAN, KARSI_IBAN, KARSI_VKN,
              FIS_NO, ODEYEN_VKN, ACIKLAMA, DOVIZ, TUTAR, BAKIYE, EVRAK_NO, TUR, NOTU, ETIKETLER, SIRA, VOMSIS_KAYIT_ZAMANI)
            VALUES (@ID, @HESAP, @ANAHTAR, @TIP, @BANKA_TIPI, @MT940, @SISTEM, @MUHASEBE,
              @G_TCKN, @G_AD, @G_SUBE, @G_UNVAN, @G_IBAN, @G_VKN, @A_IBAN, @K_UNVAN, @K_IBAN, @K_VKN,
              @FIS_NO, @ODEYEN_VKN, @ACIKLAMA, @DOVIZ, @TUTAR, @BAKIYE, @EVRAK_NO, @TUR, @NOTU, @ETIKETLER, @SIRA, @KAYIT);
            SELECT 1 AS YENI;
          END
          ELSE SELECT 0 AS YENI;
        `);
        if (r.recordset?.[0]?.YENI === 1) yeni++;
        else guncellenen++;
      }
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
    return { yeni, guncellenen };
  }

  public static async sonEsitlemeyiYaz(dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM TODVZ_EBANKA_AYAR WHERE AYAR_ID = 1) INSERT INTO TODVZ_EBANKA_AYAR (AYAR_ID) VALUES (1);
      UPDATE TODVZ_EBANKA_AYAR SET SON_ESITLEME = GETDATE(), SON_HAREKET_ID = (SELECT MAX(VOMSIS_ID) FROM TODVZ_EBANKA_HAREKET) WHERE AYAR_ID = 1;
    `);
  }

  /** Son eşitlemeden bu yana geçen saniye. Saat dilimine takılmamak için veritabanı saatiyle hesaplanır. */
  public static async sonEsitlemedenBeriSaniye(dbContext?: DbContext): Promise<number | null> {
    const pool = await this.pool(dbContext);
    const r = (await pool.request().query(`SELECT DATEDIFF(SECOND, SON_ESITLEME, GETDATE()) AS SN FROM TODVZ_EBANKA_AYAR WHERE AYAR_ID = 1`)).recordset[0];
    return r?.SN === null || r?.SN === undefined ? null : Number(r.SN);
  }

  /** Test verisi canlı veriyle karışmasın: mod değişince ayna tabloları boşaltılır. Fişe aktarılmış hareket varsa dokunulmaz. */
  public static async aynayiBosalt(dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const aktarilan = (await pool.request().query(`SELECT COUNT(*) AS N FROM TODVZ_EBANKA_HAREKET WHERE AKTARIM_DURUMU = 1`)).recordset[0].N;
    if (aktarilan > 0) return false;
    await pool.request().batch(`
      IF OBJECT_ID('TODVZ_EBANKA_MUTABAKAT', 'U') IS NOT NULL DELETE FROM TODVZ_EBANKA_MUTABAKAT;
      IF OBJECT_ID('TODVZ_EBANKA_MUTABAKAT_ISARET', 'U') IS NOT NULL DELETE FROM TODVZ_EBANKA_MUTABAKAT_ISARET;
      DELETE FROM TODVZ_EBANKA_HAREKET;
      DELETE FROM TODVZ_EBANKA_HESAP;
      DELETE FROM TODVZ_EBANKA_BANKA;
      UPDATE TODVZ_EBANKA_AYAR SET SON_ESITLEME = NULL, SON_HAREKET_ID = NULL WHERE AYAR_ID = 1;
    `);
    return true;
  }

  // ─── Okuma ─────────────────────────────────────────────────────────────────

  public static async hesaplariListele(dbContext?: DbContext): Promise<EBankaHesap[]> {
    const pool = await this.pool(dbContext);
    const rows = (
      await pool.request().query(`
        SELECT h.*, ISNULL(b.BANKA_ADI, '') AS BANKA_ADI, ISNULL(b.BANKA_KODU, '') AS BANKA_KODU,
               k.HESAP_NO AS KART_HESAP_NO, k.HESAP_ADI AS KART_HESAP_ADI
        FROM TODVZ_EBANKA_HESAP h
        LEFT JOIN TODVZ_EBANKA_BANKA b ON b.VOMSIS_BANKA_ID = h.VOMSIS_BANKA_ID
        LEFT JOIN TODVZ_BANKA k ON k.BANKA_ID = h.BANKA_ID
        ORDER BY ISNULL(b.SIRA, 9999), b.BANKA_ADI, ISNULL(h.SIRA, 9999), h.DOVIZ, h.HESAP_NO
      `)
    ).recordset;
    return rows.map((r: any) => ({
      vomsisHesapId: r.VOMSIS_HESAP_ID,
      bankaAdi: r.BANKA_ADI,
      bankaKodu: r.BANKA_KODU,
      subeAdi: r.SUBE_ADI ?? null,
      subeKodu: r.SUBE_KODU ?? null,
      doviz: r.DOVIZ,
      hesapNo: r.HESAP_NO ?? null,
      iban: r.OZEL_IBAN || r.IBAN || null,
      bakiye: Number(r.BAKIYE) || 0,
      blokeBakiye: r.BLOKE_BAKIYE === null ? null : Number(r.BLOKE_BAKIYE),
      kullanilabilirBakiye: r.KULLANILABILIR_BAKIYE === null ? null : Number(r.KULLANILABILIR_BAKIYE),
      bakiyeyeDahil: Boolean(r.BAKIYEYE_DAHIL),
      aktif: Boolean(r.DURUM),
      urunKodu: r.URUN_KODU ?? null,
      bankaId: r.BANKA_ID ?? null,
      bankaHesapNo: r.KART_HESAP_NO ? String(r.KART_HESAP_NO).trim() : null,
      bankaHesapAdi: r.KART_HESAP_ADI ? String(r.KART_HESAP_ADI).trim() : null,
      eslemeElle: Boolean(r.ESLEME_ELLE),
      guncellemeZamani: tarihMetni(r.GUNCELLEME_ZAMANI),
    }));
  }

  /** bankaId null → eşleme kaldırılır. Elle dokunulan hesaba IBAN eşlemesi bir daha karışmaz. */
  public static async hesapEsle(vomsisHesapId: number, bankaId: number | null, dbContext?: DbContext): Promise<"ok" | "hesap-yok" | "kart-yok" | "kart-dolu"> {
    const pool = await this.pool(dbContext);
    if (bankaId !== null) {
      const kart = pool.request();
      kart.input("BANKA_ID", sql.Int, bankaId);
      if (!(await kart.query(`SELECT 1 AS X FROM TODVZ_BANKA WHERE BANKA_ID = @BANKA_ID`)).recordset.length) return "kart-yok";
      // Bir Banka Hesap Kartı tek Vomsis hesabına bağlanır (aksi halde iki hesabın hareketi aynı karta fiş olur)
      const dolu = pool.request();
      dolu.input("BANKA_ID", sql.Int, bankaId);
      dolu.input("ID", sql.Int, vomsisHesapId);
      if ((await dolu.query(`SELECT 1 AS X FROM TODVZ_EBANKA_HESAP WHERE BANKA_ID = @BANKA_ID AND VOMSIS_HESAP_ID <> @ID`)).recordset.length) return "kart-dolu";
    }
    const req = pool.request();
    req.input("ID", sql.Int, vomsisHesapId);
    req.input("BANKA_ID", sql.Int, bankaId);
    const r = await req.query(`UPDATE TODVZ_EBANKA_HESAP SET BANKA_ID = @BANKA_ID, ESLEME_ELLE = 1 WHERE VOMSIS_HESAP_ID = @ID`);
    return r.rowsAffected[0] ? "ok" : "hesap-yok";
  }

  public static async hareketTipleriniListele(dbContext?: DbContext): Promise<{ tipKodu: string; tipAdi: string }[]> {
    const pool = await this.pool(dbContext);
    const rows = (await pool.request().query(`SELECT TIP_KODU, TIP_ADI FROM TODVZ_EBANKA_HAREKET_TIPI ORDER BY TIP_ADI`)).recordset;
    return rows.map((r: any) => ({ tipKodu: r.TIP_KODU, tipAdi: r.TIP_ADI }));
  }

  private static hareketSatiri(r: any): EBankaHareket {
    return {
      vomsisId: Number(r.VOMSIS_ID),
      vomsisHesapId: r.VOMSIS_HESAP_ID,
      bankaAdi: r.BANKA_ADI || "",
      hesapNo: r.HESAP_NO ?? null,
      hesapIban: r.HESAP_IBAN ?? null,
      tipKodu: r.TIP_KODU ?? null,
      tipAdi: r.TIP_ADI ?? null,
      bankaTipi: r.BANKA_TIPI ?? null,
      mt940Tipi: r.MT940_TIPI ?? null,
      sistemTarihi: tarihMetni(r.SISTEM_TARIHI),
      muhasebeTarihi: tarihMetni(r.MUHASEBE_TARIHI),
      gonderenTckn: r.GONDEREN_TCKN ?? null,
      gonderenAd: r.GONDEREN_AD ?? null,
      gonderenSube: r.GONDEREN_SUBE ?? null,
      gonderenUnvan: r.GONDEREN_UNVAN ?? null,
      gonderenIban: r.GONDEREN_IBAN ?? null,
      gonderenVkn: r.GONDEREN_VKN ?? null,
      aliciIban: r.ALICI_IBAN ?? null,
      karsiUnvan: r.KARSI_UNVAN ?? null,
      karsiIban: r.KARSI_IBAN ?? null,
      karsiVkn: r.KARSI_VKN ?? null,
      fisNo: r.FIS_NO ?? null,
      odeyenVkn: r.ODEYEN_VKN ?? null,
      aciklama: r.ACIKLAMA ?? null,
      doviz: r.DOVIZ ?? null,
      tutar: Number(r.TUTAR) || 0,
      bakiye: r.BAKIYE === null ? null : Number(r.BAKIYE),
      evrakNo: r.EVRAK_NO ?? null,
      tur: r.TUR ?? null,
      notu: r.NOTU ?? null,
      etiketler: r.ETIKETLER ?? null,
      aktarimDurumu: (Number(r.AKTARIM_DURUMU) || 0) as AktarimDurumu,
      bankaHareketId: r.BANKA_HAREKET_ID ?? null,
      cariKartId: r.CARI_KART_ID ?? null,
    };
  }

  private static readonly HAREKET_SECIMI = `
    FROM TODVZ_EBANKA_HAREKET t
    LEFT JOIN TODVZ_EBANKA_HESAP h ON h.VOMSIS_HESAP_ID = t.VOMSIS_HESAP_ID
    LEFT JOIN TODVZ_EBANKA_BANKA b ON b.VOMSIS_BANKA_ID = h.VOMSIS_BANKA_ID
    LEFT JOIN TODVZ_EBANKA_HAREKET_TIPI p ON p.TIP_KODU = t.TIP_KODU
  `;

  public static async hareketleriListele(
    f: HareketFiltre,
    dbContext?: DbContext
  ): Promise<{ satirlar: EBankaHareket[]; toplam: number; toplamlar: { doviz: string; giris: number; cikis: number; adet: number }[] }> {
    const pool = await this.pool(dbContext);
    const kosullar: string[] = ["1 = 1"];
    const girdiler: [string, any, any][] = [];

    if (f.baslangic) {
      kosullar.push("t.SISTEM_TARIHI >= @BAS");
      girdiler.push(["BAS", sql.DateTime, vomsisTarihi(`${f.baslangic} 00:00:00`)]);
    }
    if (f.bitis) {
      kosullar.push("t.SISTEM_TARIHI <= @BIT");
      girdiler.push(["BIT", sql.DateTime, vomsisTarihi(`${f.bitis} 23:59:59`)]);
    }
    if (f.vomsisHesapId) {
      kosullar.push("t.VOMSIS_HESAP_ID = @HESAP");
      girdiler.push(["HESAP", sql.Int, f.vomsisHesapId]);
    }
    if (f.vomsisBankaId) {
      kosullar.push("h.VOMSIS_BANKA_ID = @BANKA");
      girdiler.push(["BANKA", sql.Int, f.vomsisBankaId]);
    }
    if (f.tipKodu) {
      kosullar.push("t.TIP_KODU = @TIP");
      girdiler.push(["TIP", sql.VarChar(50), f.tipKodu]);
    }
    if (f.tur === "alacakli" || f.tur === "borclu") {
      kosullar.push("t.TUR = @TUR");
      girdiler.push(["TUR", sql.VarChar(10), f.tur]);
    }
    if (f.aktarimDurumu !== undefined && [0, 1, 2].includes(f.aktarimDurumu)) {
      kosullar.push("t.AKTARIM_DURUMU = @DURUM");
      girdiler.push(["DURUM", sql.TinyInt, f.aktarimDurumu]);
    }
    if (f.arama?.trim()) {
      kosullar.push(`(t.ACIKLAMA LIKE @ARA OR t.KARSI_UNVAN LIKE @ARA OR t.GONDEREN_AD LIKE @ARA OR t.GONDEREN_UNVAN LIKE @ARA
        OR t.KARSI_IBAN LIKE @ARA OR t.KARSI_VKN LIKE @ARA OR t.FIS_NO LIKE @ARA OR t.EVRAK_NO LIKE @ARA)`);
      girdiler.push(["ARA", sql.NVarChar(120), `%${f.arama.trim().slice(0, 100)}%`]);
    }

    const nerede = kosullar.join(" AND ");
    const boyut = Math.min(Math.max(f.sayfaBoyutu || 100, 10), 500);
    const sayfa = Math.max(f.sayfa || 1, 1);
    const istek = () => {
      const req = pool.request();
      for (const [ad, tip, deger] of girdiler) req.input(ad, tip, deger);
      return req;
    };

    const liste = istek();
    liste.input("ATLA", sql.Int, (sayfa - 1) * boyut);
    liste.input("AL", sql.Int, boyut);
    const rows = (
      await liste.query(`
        SELECT t.*, b.BANKA_ADI, h.HESAP_NO, ISNULL(h.OZEL_IBAN, h.IBAN) AS HESAP_IBAN, p.TIP_ADI
        ${this.HAREKET_SECIMI}
        WHERE ${nerede}
        ORDER BY t.SISTEM_TARIHI DESC, t.VOMSIS_ID DESC
        OFFSET @ATLA ROWS FETCH NEXT @AL ROWS ONLY
      `)
    ).recordset;

    const ozet = (
      await istek().query(`
        SELECT ISNULL(t.DOVIZ, '') AS DOVIZ, COUNT(*) AS ADET,
               SUM(CASE WHEN t.TUTAR > 0 THEN t.TUTAR ELSE 0 END) AS GIRIS,
               SUM(CASE WHEN t.TUTAR < 0 THEN -t.TUTAR ELSE 0 END) AS CIKIS
        ${this.HAREKET_SECIMI}
        WHERE ${nerede}
        GROUP BY ISNULL(t.DOVIZ, '')
        ORDER BY 1
      `)
    ).recordset;

    return {
      satirlar: rows.map((r: any) => this.hareketSatiri(r)),
      toplam: ozet.reduce((t: number, r: any) => t + Number(r.ADET), 0),
      toplamlar: ozet.map((r: any) => ({ doviz: r.DOVIZ, giris: Number(r.GIRIS) || 0, cikis: Number(r.CIKIS) || 0, adet: Number(r.ADET) })),
    };
  }

  public static async hareketGetir(vomsisId: number, dbContext?: DbContext): Promise<EBankaHareket | null> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("ID", sql.BigInt, vomsisId);
    const r = (
      await req.query(`
        SELECT t.*, b.BANKA_ADI, h.HESAP_NO, ISNULL(h.OZEL_IBAN, h.IBAN) AS HESAP_IBAN, p.TIP_ADI
        ${this.HAREKET_SECIMI}
        WHERE t.VOMSIS_ID = @ID
      `)
    ).recordset[0];
    return r ? this.hareketSatiri(r) : null;
  }

  public static async ozetSayilari(dbContext?: DbContext): Promise<{ hareketAdedi: number; bekleyen: number; ilkHareket: string | null; sonHareket: string | null }> {
    const pool = await this.pool(dbContext);
    const r = (
      await pool.request().query(`
        SELECT COUNT(*) AS ADET, SUM(CASE WHEN AKTARIM_DURUMU = 0 THEN 1 ELSE 0 END) AS BEKLEYEN,
               MIN(SISTEM_TARIHI) AS ILK, MAX(SISTEM_TARIHI) AS SON
        FROM TODVZ_EBANKA_HAREKET
      `)
    ).recordset[0];
    return { hareketAdedi: Number(r.ADET) || 0, bekleyen: Number(r.BEKLEYEN) || 0, ilkHareket: tarihMetni(r.ILK), sonHareket: tarihMetni(r.SON) };
  }
}

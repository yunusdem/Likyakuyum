import sql from "mssql";
import { logger } from "../utils/logger.js";
import { DbContext } from "./ebankaSql.repository.js";
import { EBankaVeriSqlRepository } from "./ebankaVeriSql.repository.js";

// F- e-Banka Faz 4 — Sanal POS: ödeme linkleri ve işlemler (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E10, E18, E20, E22, E25)

export interface VposLink {
  uid: string;
  cariKartId: number | null;
  cariKod: string | null;
  cariAdi: string | null;
  baslik: string | null;
  tutar: number;
  paraBirimi: string;
  sonGecerlilik: string | null;
  eposta: string | null;
  telefon: string | null;
  sms: boolean;
  mail: boolean;
  maxTaksit: number;
  aciklama: string | null;
  link: string | null;
  /** Vomsis'in döndürdüğü ham durum metni */
  durum: string | null;
  odendi: boolean;
  silindi: boolean;
  bankaHareketId: number | null;
  olusturmaZamani: string | null;
  guncellemeZamani: string | null;
}

export interface VposLinkKaydi {
  uid: string;
  cariKartId: number | null;
  baslik: string | null;
  tutar: number;
  paraBirimi: string;
  sonGecerlilik: string | null;
  eposta: string | null;
  telefon: string | null;
  sms: boolean;
  mail: boolean;
  maxTaksit: number;
  aciklama: string | null;
  link: string | null;
  durum: string | null;
  odendi: boolean;
}

export interface VposIslem {
  referansNo: string;
  vomsisIslemId: number | null;
  linkUid: string | null;
  cariKartId: number | null;
  cariKod: string | null;
  cariAdi: string | null;
  aciklama: string | null;
  islemTarihi: string | null;
  tutar: number;
  paraBirimi: string | null;
  taksit: number | null;
  kartNo: string | null;
  kartBanka: string | null;
  kartAilesi: string | null;
  posAdi: string | null;
  /** Vomsis "durum": 1 başarılı */
  durumKodu: number | null;
  /** Vomsis "tur": islem / iade / iptal */
  tur: string | null;
  hataKodu: string | null;
  hataMesaji: string | null;
  iadeTutar: number | null;
  musteri: string | null;
  bankaHareketId: number | null;
  iadeBankaHareketId: number | null;
}

const kirp = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
};
const sayi = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const zaman = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString().slice(0, 19).replace("T", " ") : null);
const gun = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString().slice(0, 10) : null);
/** "YYYY-AA-GG[ SS:DD:ss]" ya da "GG.AA.YYYY[ SS:DD:ss]" → duvar saati UTC kabul edilerek Date */
export const vposTarihi = (v: unknown): Date | null => {
  const s = String(v ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/.exec(s);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)));
  m = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/.exec(s);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))) : null;
};

export class EBankaVposSqlRepository {
  private static readonly hazirHavuzlar = new WeakSet<sql.ConnectionPool>();

  private static async pool(dbContext?: DbContext): Promise<sql.ConnectionPool> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    if (!this.hazirHavuzlar.has(pool)) {
      await this.ensureTables(pool);
      this.hazirHavuzlar.add(pool);
    }
    return pool;
  }

  public static async ensureTables(pool: sql.ConnectionPool): Promise<void> {
    try {
      await pool.request().batch(`
        IF OBJECT_ID('TODVZ_EBANKA_VPOS_LINK', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_VPOS_LINK] (
            [UID] VARCHAR(64) NOT NULL PRIMARY KEY,
            [CARI_KART_ID] INT NULL,
            [BASLIK] NVARCHAR(200) NULL,
            [TUTAR] DECIMAL(18,2) NOT NULL DEFAULT 0,
            [PARA_BIRIMI] VARCHAR(10) NOT NULL DEFAULT 'TRY',
            [SON_GECERLILIK] DATE NULL,
            [EPOSTA] NVARCHAR(200) NULL,
            [TELEFON] VARCHAR(30) NULL,
            [SMS] BIT NOT NULL DEFAULT 0,
            [MAIL] BIT NOT NULL DEFAULT 0,
            [MAX_TAKSIT] INT NOT NULL DEFAULT 0,
            [ACIKLAMA] NVARCHAR(500) NULL,
            [LINK] NVARCHAR(500) NULL,
            [DURUM] NVARCHAR(50) NULL,
            [ODENDI] BIT NOT NULL DEFAULT 0,
            [SILINDI] BIT NOT NULL DEFAULT 0,
            [BANKA_HAREKET_ID] INT NULL,
            [OLUSTURAN_ID] INT NULL,
            [OLUSTURMA_ZAMANI] DATETIME NOT NULL DEFAULT GETDATE(),
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
        END;

        IF OBJECT_ID('TODVZ_EBANKA_VPOS_ISLEM', 'U') IS NULL
        BEGIN
          CREATE TABLE [dbo].[TODVZ_EBANKA_VPOS_ISLEM] (
            [REFERANS_NO] VARCHAR(64) NOT NULL PRIMARY KEY,
            [VOMSIS_ISLEM_ID] INT NULL,
            [LINK_UID] VARCHAR(64) NULL,
            [CARI_KART_ID] INT NULL,
            [ACIKLAMA] NVARCHAR(500) NULL,
            [ISLEM_TARIHI] DATETIME NULL,
            [TUTAR] DECIMAL(18,2) NOT NULL DEFAULT 0,
            [PARA_BIRIMI] VARCHAR(10) NULL,
            [TAKSIT] INT NULL,
            [KART_NO] VARCHAR(30) NULL,
            [KART_BANKA] NVARCHAR(150) NULL,
            [KART_AILESI] NVARCHAR(50) NULL,
            [POS_ADI] NVARCHAR(150) NULL,
            [DURUM_KODU] INT NULL,
            [TUR] VARCHAR(20) NULL,
            [HATA_KODU] VARCHAR(50) NULL,
            [HATA_MESAJI] NVARCHAR(500) NULL,
            [IADE_TUTAR] DECIMAL(18,2) NULL,
            [MUSTERI] NVARCHAR(250) NULL,
            [HAM] NVARCHAR(MAX) NULL,
            [BANKA_HAREKET_ID] INT NULL,
            [IADE_BANKA_HAREKET_ID] INT NULL,
            [GUNCELLEME_ZAMANI] DATETIME NULL
          );
          CREATE INDEX [IX_TODVZ_EBANKA_VPOS_ISLEM_TARIH] ON [dbo].[TODVZ_EBANKA_VPOS_ISLEM] ([ISLEM_TARIHI] DESC);
        END;
      `);
    } catch (err: any) {
      logger.warn(`[EBankaVposSqlRepository.ensureTables] Warning: ${err.message}`);
    }
  }

  // ─── Ödeme linkleri ────────────────────────────────────────────────────────

  private static linkSatiri(r: any): VposLink {
    return {
      uid: r.UID,
      cariKartId: r.CARI_KART_ID ?? null,
      cariKod: kirp(r.CARI_KOD),
      cariAdi: kirp(r.CARI_ADI),
      baslik: r.BASLIK ?? null,
      tutar: Number(r.TUTAR) || 0,
      paraBirimi: r.PARA_BIRIMI,
      sonGecerlilik: gun(r.SON_GECERLILIK),
      eposta: r.EPOSTA ?? null,
      telefon: r.TELEFON ?? null,
      sms: Boolean(r.SMS),
      mail: Boolean(r.MAIL),
      maxTaksit: Number(r.MAX_TAKSIT) || 0,
      aciklama: r.ACIKLAMA ?? null,
      link: r.LINK ?? null,
      durum: r.DURUM ?? null,
      odendi: Boolean(r.ODENDI),
      silindi: Boolean(r.SILINDI),
      bankaHareketId: r.BANKA_HAREKET_ID ?? null,
      olusturmaZamani: zaman(r.OLUSTURMA_ZAMANI),
      guncellemeZamani: zaman(r.GUNCELLEME_ZAMANI),
    };
  }

  private static readonly LINK_SECIMI = `
    SELECT l.*, c.KOD AS CARI_KOD, c.AD AS CARI_ADI
    FROM TODVZ_EBANKA_VPOS_LINK l LEFT JOIN TODVZ_CARI_KART c ON c.CARI_KART_ID = l.CARI_KART_ID
  `;

  public static async linkleriListele(silinenlerDahil: boolean, dbContext?: DbContext): Promise<VposLink[]> {
    const pool = await this.pool(dbContext);
    const rows = (await pool.request().query(`${this.LINK_SECIMI} ${silinenlerDahil ? "" : "WHERE l.SILINDI = 0"} ORDER BY l.OLUSTURMA_ZAMANI DESC`)).recordset;
    return rows.map((r: any) => this.linkSatiri(r));
  }

  public static async linkGetir(uid: string, dbContext?: DbContext): Promise<VposLink | null> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("UID", sql.VarChar(64), uid);
    const r = (await req.query(`${this.LINK_SECIMI} WHERE l.UID = @UID`)).recordset[0];
    return r ? this.linkSatiri(r) : null;
  }

  public static async linkEkle(k: VposLinkKaydi, kullaniciId?: number, dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("UID", sql.VarChar(64), k.uid);
    req.input("CARI", sql.Int, k.cariKartId);
    req.input("BASLIK", sql.NVarChar(200), k.baslik);
    req.input("TUTAR", sql.Decimal(18, 2), k.tutar);
    req.input("PARA", sql.VarChar(10), k.paraBirimi);
    req.input("SON", sql.Date, k.sonGecerlilik ? vposTarihi(k.sonGecerlilik) : null);
    req.input("EPOSTA", sql.NVarChar(200), k.eposta);
    req.input("TELEFON", sql.VarChar(30), k.telefon);
    req.input("SMS", sql.Bit, k.sms ? 1 : 0);
    req.input("MAIL", sql.Bit, k.mail ? 1 : 0);
    req.input("TAKSIT", sql.Int, k.maxTaksit);
    req.input("ACIKLAMA", sql.NVarChar(500), k.aciklama);
    req.input("LINK", sql.NVarChar(500), k.link);
    req.input("DURUM", sql.NVarChar(50), k.durum);
    req.input("ODENDI", sql.Bit, k.odendi ? 1 : 0);
    req.input("KULLANICI", sql.Int, kullaniciId ?? null);
    await req.query(`
      INSERT INTO TODVZ_EBANKA_VPOS_LINK (UID, CARI_KART_ID, BASLIK, TUTAR, PARA_BIRIMI, SON_GECERLILIK, EPOSTA, TELEFON, SMS, MAIL, MAX_TAKSIT, ACIKLAMA, LINK, DURUM, ODENDI, OLUSTURAN_ID)
      VALUES (@UID, @CARI, @BASLIK, @TUTAR, @PARA, @SON, @EPOSTA, @TELEFON, @SMS, @MAIL, @TAKSIT, @ACIKLAMA, @LINK, @DURUM, @ODENDI, @KULLANICI)
    `);
  }

  /** Vomsis'ten okunan güncel durum. Bir kez "ödendi" olan link geri alınmaz. */
  public static async linkDurumuYaz(uid: string, durum: string | null, odendi: boolean, link: string | null, dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("UID", sql.VarChar(64), uid);
    req.input("DURUM", sql.NVarChar(50), durum);
    req.input("ODENDI", sql.Bit, odendi ? 1 : 0);
    req.input("LINK", sql.NVarChar(500), link);
    await req.query(`
      UPDATE TODVZ_EBANKA_VPOS_LINK SET DURUM = ISNULL(@DURUM, DURUM), ODENDI = CASE WHEN ODENDI = 1 THEN 1 ELSE @ODENDI END,
        LINK = ISNULL(@LINK, LINK), GUNCELLEME_ZAMANI = GETDATE()
      WHERE UID = @UID
    `);
  }

  public static async linkSilindiYaz(uid: string, dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("UID", sql.VarChar(64), uid);
    await req.query(`UPDATE TODVZ_EBANKA_VPOS_LINK SET SILINDI = 1, GUNCELLEME_ZAMANI = GETDATE() WHERE UID = @UID`);
  }

  /** Tahsilat fişi için kilit: -1. Yalnızca ödenmiş, fişi olmayan linkte başarılı olur. */
  public static async linkFisTalebi(uid: string, dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("UID", sql.VarChar(64), uid);
    const r = await req.query(`UPDATE TODVZ_EBANKA_VPOS_LINK SET BANKA_HAREKET_ID = -1 WHERE UID = @UID AND ODENDI = 1 AND BANKA_HAREKET_ID IS NULL`);
    return (r.rowsAffected[0] || 0) === 1;
  }

  public static async linkFisiYaz(uid: string, bankaHareketId: number | null, dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("UID", sql.VarChar(64), uid);
    req.input("FIS", sql.Int, bankaHareketId);
    await req.query(`UPDATE TODVZ_EBANKA_VPOS_LINK SET BANKA_HAREKET_ID = @FIS WHERE UID = @UID AND BANKA_HAREKET_ID = -1`);
  }

  // ─── İşlemler ──────────────────────────────────────────────────────────────

  /** Vomsis transactions-list satırı. Link / cari / fiş bağlarına dokunmadan ekle-güncelle. */
  public static async islemleriYaz(islemler: Record<string, any>[], dbContext?: DbContext): Promise<number> {
    const pool = await this.pool(dbContext);
    let adet = 0;
    for (const i of islemler) {
      const ref = kirp(i.referans_kodu) || kirp(i.order_id) || kirp(i.referanceNo);
      if (!ref) continue;
      const t = i.tahsilat || {};
      const req = pool.request();
      req.input("REF", sql.VarChar(64), ref.slice(0, 64));
      req.input("ID", sql.Int, sayi(i.id));
      // Ödeme linkiyle bağ: dokümanda "tahsilat" nesnesinin alanları yazmıyor; olası adlar denenir
      req.input("LINK_UID", sql.VarChar(64), kirp(t.uid) || kirp(t.tuid) || kirp(t.payment_uid) || kirp(i.tahsilat_uid));
      req.input("ACIKLAMA", sql.NVarChar(500), kirp(i.aciklama)?.slice(0, 500) ?? null);
      req.input("TARIH", sql.DateTime, vposTarihi(i.islem_tarihi) ?? vposTarihi(i.created_at));
      req.input("TUTAR", sql.Decimal(18, 2), sayi(i.tutar) ?? 0);
      req.input("PARA", sql.VarChar(10), kirp(i.para_birimi));
      req.input("TAKSIT", sql.Int, sayi(i.taksit));
      req.input("KART_NO", sql.VarChar(30), kirp(i.kredi_kart_no)?.slice(0, 30) ?? null);
      req.input("KART_BANKA", sql.NVarChar(150), kirp(i.kredi_kart_banka));
      req.input("KART_AILESI", sql.NVarChar(50), kirp(i.cc_family));
      req.input("POS_ADI", sql.NVarChar(150), kirp(i.pos_name));
      req.input("DURUM", sql.Int, sayi(i.durum));
      req.input("TUR", sql.VarChar(20), kirp(i.tur)?.slice(0, 20) ?? null);
      req.input("HATA_KODU", sql.VarChar(50), kirp(i.hata_kodu)?.slice(0, 50) ?? null);
      req.input("HATA_MESAJI", sql.NVarChar(500), kirp(i.hata_mesaji)?.slice(0, 500) ?? null);
      req.input("IADE", sql.Decimal(18, 2), sayi(i.iade_tutar));
      req.input("MUSTERI", sql.NVarChar(250), (kirp(i.invoiceTitle) || kirp(i.invoiceName) || kirp(i.invoiceEmail))?.slice(0, 250) ?? null);
      req.input("HAM", sql.NVarChar(sql.MAX), JSON.stringify(i));
      await req.query(`
        UPDATE TODVZ_EBANKA_VPOS_ISLEM SET VOMSIS_ISLEM_ID = @ID, LINK_UID = ISNULL(@LINK_UID, LINK_UID), ACIKLAMA = @ACIKLAMA, ISLEM_TARIHI = @TARIH, TUTAR = @TUTAR,
          PARA_BIRIMI = @PARA, TAKSIT = @TAKSIT, KART_NO = @KART_NO, KART_BANKA = @KART_BANKA, KART_AILESI = @KART_AILESI, POS_ADI = @POS_ADI, DURUM_KODU = @DURUM,
          TUR = @TUR, HATA_KODU = @HATA_KODU, HATA_MESAJI = @HATA_MESAJI, IADE_TUTAR = @IADE, MUSTERI = @MUSTERI, HAM = @HAM, GUNCELLEME_ZAMANI = GETDATE()
        WHERE REFERANS_NO = @REF;
        IF @@ROWCOUNT = 0
          INSERT INTO TODVZ_EBANKA_VPOS_ISLEM (REFERANS_NO, VOMSIS_ISLEM_ID, LINK_UID, ACIKLAMA, ISLEM_TARIHI, TUTAR, PARA_BIRIMI, TAKSIT, KART_NO, KART_BANKA, KART_AILESI,
            POS_ADI, DURUM_KODU, TUR, HATA_KODU, HATA_MESAJI, IADE_TUTAR, MUSTERI, HAM, GUNCELLEME_ZAMANI)
          VALUES (@REF, @ID, @LINK_UID, @ACIKLAMA, @TARIH, @TUTAR, @PARA, @TAKSIT, @KART_NO, @KART_BANKA, @KART_AILESI,
            @POS_ADI, @DURUM, @TUR, @HATA_KODU, @HATA_MESAJI, @IADE, @MUSTERI, @HAM, GETDATE());
      `);
      adet++;
    }
    // Linkten gelen işlem, linkin carisini ve tahsilat fişini devralır (iptal/iade fişi bulabilsin diye)
    await pool.request().query(`
      UPDATE i SET i.CARI_KART_ID = ISNULL(i.CARI_KART_ID, l.CARI_KART_ID),
                   i.BANKA_HAREKET_ID = CASE WHEN i.BANKA_HAREKET_ID IS NULL AND l.BANKA_HAREKET_ID > 0 THEN l.BANKA_HAREKET_ID ELSE i.BANKA_HAREKET_ID END
      FROM TODVZ_EBANKA_VPOS_ISLEM i JOIN TODVZ_EBANKA_VPOS_LINK l ON l.UID = i.LINK_UID
    `);
    return adet;
  }

  private static islemSatiri(r: any): VposIslem {
    return {
      referansNo: r.REFERANS_NO,
      vomsisIslemId: r.VOMSIS_ISLEM_ID ?? null,
      linkUid: r.LINK_UID ?? null,
      cariKartId: r.CARI_KART_ID ?? null,
      cariKod: kirp(r.CARI_KOD),
      cariAdi: kirp(r.CARI_ADI),
      aciklama: r.ACIKLAMA ?? null,
      islemTarihi: zaman(r.ISLEM_TARIHI),
      tutar: Number(r.TUTAR) || 0,
      paraBirimi: r.PARA_BIRIMI ?? null,
      taksit: r.TAKSIT ?? null,
      kartNo: r.KART_NO ?? null,
      kartBanka: r.KART_BANKA ?? null,
      kartAilesi: r.KART_AILESI ?? null,
      posAdi: r.POS_ADI ?? null,
      durumKodu: r.DURUM_KODU ?? null,
      tur: r.TUR ?? null,
      hataKodu: r.HATA_KODU ?? null,
      hataMesaji: r.HATA_MESAJI ?? null,
      iadeTutar: r.IADE_TUTAR === null ? null : Number(r.IADE_TUTAR),
      musteri: r.MUSTERI ?? null,
      bankaHareketId: r.BANKA_HAREKET_ID ?? null,
      iadeBankaHareketId: r.IADE_BANKA_HAREKET_ID ?? null,
    };
  }

  private static readonly ISLEM_SECIMI = `
    SELECT i.*, c.KOD AS CARI_KOD, c.AD AS CARI_ADI
    FROM TODVZ_EBANKA_VPOS_ISLEM i LEFT JOIN TODVZ_CARI_KART c ON c.CARI_KART_ID = i.CARI_KART_ID
  `;

  public static async islemleriListele(f: { baslangic?: string; bitis?: string; arama?: string }, dbContext?: DbContext): Promise<VposIslem[]> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    const kosullar = ["1 = 1"];
    if (f.baslangic) {
      kosullar.push("i.ISLEM_TARIHI >= @BAS");
      req.input("BAS", sql.DateTime, vposTarihi(`${f.baslangic} 00:00:00`));
    }
    if (f.bitis) {
      kosullar.push("i.ISLEM_TARIHI <= @BIT");
      req.input("BIT", sql.DateTime, vposTarihi(`${f.bitis} 23:59:59`));
    }
    if (f.arama?.trim()) {
      kosullar.push("(i.REFERANS_NO LIKE @ARA OR i.ACIKLAMA LIKE @ARA OR i.KART_NO LIKE @ARA OR i.MUSTERI LIKE @ARA OR c.AD LIKE @ARA)");
      req.input("ARA", sql.NVarChar(120), `%${f.arama.trim().slice(0, 100)}%`);
    }
    const rows = (await req.query(`${this.ISLEM_SECIMI} WHERE ${kosullar.join(" AND ")} ORDER BY i.ISLEM_TARIHI DESC, i.REFERANS_NO DESC`)).recordset;
    return rows.map((r: any) => this.islemSatiri(r));
  }

  public static async islemGetir(referansNo: string, dbContext?: DbContext): Promise<VposIslem | null> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("REF", sql.VarChar(64), referansNo);
    const r = (await req.query(`${this.ISLEM_SECIMI} WHERE i.REFERANS_NO = @REF`)).recordset[0];
    return r ? this.islemSatiri(r) : null;
  }

  // ─── Kartla ödeme (Faz 5) ──────────────────────────────────────────────────

  /**
   * Ödeme Vomsis'e gönderilmeden ÖNCE açılan kayıt: 3D dönüşünde işlemin hangi cariye ait olduğu buradan bilinir.
   * Kart verisi saklanmaz; yalnızca maskeli numara (ilk 6 + son 4).
   */
  public static async odemeBaslat(
    k: { referansNo: string; cariKartId: number; tutar: number; paraBirimi: string; taksit: number; maskeliKart: string; aciklama: string | null; musteri: string | null },
    dbContext?: DbContext
  ): Promise<void> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("REF", sql.VarChar(64), k.referansNo);
    req.input("CARI", sql.Int, k.cariKartId);
    req.input("TUTAR", sql.Decimal(18, 2), k.tutar);
    req.input("PARA", sql.VarChar(10), k.paraBirimi);
    req.input("TAKSIT", sql.Int, k.taksit);
    req.input("KART", sql.VarChar(30), k.maskeliKart);
    req.input("ACIKLAMA", sql.NVarChar(500), k.aciklama);
    req.input("MUSTERI", sql.NVarChar(250), k.musteri);
    await req.query(`
      INSERT INTO TODVZ_EBANKA_VPOS_ISLEM (REFERANS_NO, CARI_KART_ID, ACIKLAMA, ISLEM_TARIHI, TUTAR, PARA_BIRIMI, TAKSIT, KART_NO, TUR, MUSTERI, GUNCELLEME_ZAMANI)
      VALUES (@REF, @CARI, @ACIKLAMA, GETDATE(), @TUTAR, @PARA, @TAKSIT, @KART, 'bekliyor', @MUSTERI, GETDATE())
    `);
  }

  /** Vomsis transaction/find sonucunu yazar. basarili=false → tur 'basarisiz'. */
  public static async odemeSonucuYaz(referansNo: string, s: { basarili: boolean; hataKodu: string | null; hataMesaji: string | null; kartBanka: string | null; posAdi: string | null }, dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("REF", sql.VarChar(64), referansNo);
    req.input("DURUM", sql.Int, s.basarili ? 1 : 0);
    req.input("TUR", sql.VarChar(20), s.basarili ? "islem" : "basarisiz");
    req.input("HATA_KODU", sql.VarChar(50), s.hataKodu?.slice(0, 50) ?? null);
    req.input("HATA_MESAJI", sql.NVarChar(500), s.hataMesaji?.slice(0, 500) ?? null);
    req.input("KART_BANKA", sql.NVarChar(150), s.kartBanka);
    req.input("POS_ADI", sql.NVarChar(150), s.posAdi);
    // Daha önce iade/iptal olarak işaretlenmiş işlemin türü ezilmez
    await req.query(`
      UPDATE TODVZ_EBANKA_VPOS_ISLEM SET DURUM_KODU = @DURUM, TUR = CASE WHEN TUR IN ('iade', 'iptal') THEN TUR ELSE @TUR END, HATA_KODU = @HATA_KODU, HATA_MESAJI = @HATA_MESAJI,
        KART_BANKA = ISNULL(@KART_BANKA, KART_BANKA), POS_ADI = ISNULL(@POS_ADI, POS_ADI), GUNCELLEME_ZAMANI = GETDATE()
      WHERE REFERANS_NO = @REF
    `);
  }

  /** Tahsilat fişi kilidi (-1): yalnızca başarılı ve fişi olmayan işlemde tutar. Dönüş iki kez gelse de tek fiş kesilir. */
  public static async islemFisTalebi(referansNo: string, dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("REF", sql.VarChar(64), referansNo);
    const r = await req.query(`UPDATE TODVZ_EBANKA_VPOS_ISLEM SET BANKA_HAREKET_ID = -1 WHERE REFERANS_NO = @REF AND DURUM_KODU = 1 AND BANKA_HAREKET_ID IS NULL`);
    return (r.rowsAffected[0] || 0) === 1;
  }

  public static async islemFisiYaz(referansNo: string, bankaHareketId: number | null, dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("REF", sql.VarChar(64), referansNo);
    req.input("FIS", sql.Int, bankaHareketId);
    await req.query(`UPDATE TODVZ_EBANKA_VPOS_ISLEM SET BANKA_HAREKET_ID = @FIS WHERE REFERANS_NO = @REF AND BANKA_HAREKET_ID = -1`);
  }

  public static async iadeFisiYaz(referansNo: string, bankaHareketId: number, dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    const req = pool.request();
    req.input("REF", sql.VarChar(64), referansNo);
    req.input("FIS", sql.Int, bankaHareketId);
    await req.query(`UPDATE TODVZ_EBANKA_VPOS_ISLEM SET IADE_BANKA_HAREKET_ID = @FIS WHERE REFERANS_NO = @REF`);
  }

  public static async fisliKayitYok(dbContext?: DbContext): Promise<boolean> {
    const pool = await this.pool(dbContext);
    const r = (
      await pool.request().query(`
        SELECT (SELECT COUNT(*) FROM TODVZ_EBANKA_VPOS_LINK WHERE BANKA_HAREKET_ID IS NOT NULL)
             + (SELECT COUNT(*) FROM TODVZ_EBANKA_VPOS_ISLEM WHERE BANKA_HAREKET_ID IS NOT NULL OR IADE_BANKA_HAREKET_ID IS NOT NULL) AS N
      `)
    ).recordset[0];
    return Number(r.N) === 0;
  }

  public static async aynayiBosalt(dbContext?: DbContext): Promise<void> {
    const pool = await this.pool(dbContext);
    await pool.request().batch(`DELETE FROM TODVZ_EBANKA_VPOS_ISLEM; DELETE FROM TODVZ_EBANKA_VPOS_LINK;`);
  }
}

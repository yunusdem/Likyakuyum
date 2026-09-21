import sql from "mssql";
import { DbContext } from "./ebankaSql.repository.js";
import { EBankaVeriSqlRepository } from "./ebankaVeriSql.repository.js";

// F- e-Banka Faz 2 — Vomsis hareketinin banka fişine aktarımı için veri erişimi (docs/EBANKA_VOMSIS_YOL_HARITASI.md)

/** 0 otomatik aktar · 1 Bekleyenler'de kalsın (elle) · 2 aktarma */
export type TipKurali = 0 | 1 | 2;

export interface AktarimAdayi {
  vomsisId: number;
  vomsisHesapId: number;
  bankaId: number | null;
  bankaAdi: string;
  hesapNo: string | null;
  tipKodu: string | null;
  tipAdi: string | null;
  tipKurali: TipKurali;
  tipCariId: number | null;
  sistemTarihi: string | null;
  doviz: string | null;
  tutar: number;
  aciklama: string | null;
  fisNo: string | null;
  evrakNo: string | null;
  karsiUnvan: string | null;
  karsiIban: string | null;
  karsiVkn: string | null;
  gonderenAd: string | null;
  gonderenUnvan: string | null;
  gonderenTckn: string | null;
  gonderenVkn: string | null;
  gonderenIban: string | null;
  aliciIban: string | null;
  odeyenVkn: string | null;
}

export interface TipKuraliSatiri {
  tipKodu: string;
  tipAdi: string;
  kural: TipKurali;
  cariKartId: number | null;
  cariKod: string | null;
  cariAdi: string | null;
}

export interface CariOzeti {
  cariKartId: number;
  kod: string;
  ad: string;
}

const tarihMetni = (d: Date | null | undefined): string | null => (d ? new Date(d).toISOString().slice(0, 19).replace("T", " ") : null);
const kirp = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());

export class EBankaAktarimSqlRepository {
  private static adaySatiri(r: any): AktarimAdayi {
    return {
      vomsisId: Number(r.VOMSIS_ID),
      vomsisHesapId: r.VOMSIS_HESAP_ID,
      bankaId: r.BANKA_ID ?? null,
      bankaAdi: r.BANKA_ADI || "",
      hesapNo: r.HESAP_NO ?? null,
      tipKodu: r.TIP_KODU ?? null,
      tipAdi: r.TIP_ADI ?? null,
      tipKurali: (Number(r.KURAL) || 0) as TipKurali,
      tipCariId: r.TIP_CARI_ID ?? null,
      sistemTarihi: tarihMetni(r.SISTEM_TARIHI),
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
    };
  }

  private static readonly ADAY_SECIMI = `
    SELECT t.*, k.BANKA_ID, h.HESAP_NO, b.BANKA_ADI, p.TIP_ADI, ISNULL(p.KURAL, 0) AS KURAL, p.CARI_KART_ID AS TIP_CARI_ID
    FROM TODVZ_EBANKA_HAREKET t
    LEFT JOIN TODVZ_EBANKA_HESAP h ON h.VOMSIS_HESAP_ID = t.VOMSIS_HESAP_ID
    -- Eşlenen kart sonradan silinmişse eşleşmemiş sayılır (banka fişi kaydı, var olmayan kart için sessizce yeni kart açıyor)
    LEFT JOIN TODVZ_BANKA k ON k.BANKA_ID = h.BANKA_ID
    LEFT JOIN TODVZ_EBANKA_BANKA b ON b.VOMSIS_BANKA_ID = h.VOMSIS_BANKA_ID
    LEFT JOIN TODVZ_EBANKA_HAREKET_TIPI p ON p.TIP_KODU = t.TIP_KODU
  `;

  /** Aktarım başlangıç tarihinden itibaren, henüz karara bağlanmamış hareketler (eskiden yeniye: fişler tarih sırasıyla kesilsin). */
  public static async bekleyenler(baslangic: string, dbContext?: DbContext): Promise<AktarimAdayi[]> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("BAS", sql.DateTime, new Date(`${baslangic}T00:00:00Z`));
    const rows = (await req.query(`${this.ADAY_SECIMI} WHERE t.AKTARIM_DURUMU = 0 AND t.SISTEM_TARIHI >= @BAS ORDER BY t.SISTEM_TARIHI, t.VOMSIS_ID`)).recordset;
    return rows.map((r: any) => this.adaySatiri(r));
  }

  public static async adayGetir(vomsisId: number, dbContext?: DbContext): Promise<(AktarimAdayi & { aktarimDurumu: number }) | null> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("ID", sql.BigInt, vomsisId);
    const r = (await req.query(`${this.ADAY_SECIMI} WHERE t.VOMSIS_ID = @ID`)).recordset[0];
    return r ? { ...this.adaySatiri(r), aktarimDurumu: Number(r.AKTARIM_DURUMU) || 0 } : null;
  }

  // ─── Eşleme sözlükleri (bir çalıştırmada bir kez okunur) ───────────────────

  /** Vomsis'teki kendi hesaplarımızın IBAN'ları → hesap etiketi. Karşı IBAN bunlardan biriyse hareket hesaplar arası virmandır. */
  public static async bizimIbanlar(dbContext?: DbContext): Promise<Map<string, string>> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const rows = (
      await pool.request().query(`
        SELECT h.IBAN, h.OZEL_IBAN, ISNULL(b.BANKA_ADI, '') + ' ' + h.DOVIZ + ' ' + ISNULL(h.HESAP_NO, '') AS ETIKET
        FROM TODVZ_EBANKA_HESAP h LEFT JOIN TODVZ_EBANKA_BANKA b ON b.VOMSIS_BANKA_ID = h.VOMSIS_BANKA_ID
      `)
    ).recordset;
    const m = new Map<string, string>();
    for (const r of rows) for (const i of [r.IBAN, r.OZEL_IBAN]) if (i) m.set(String(i), kirp(r.ETIKET));
    return m;
  }

  /** Vergi / TC kimlik no → o numarayı taşıyan cariler. */
  public static async vknSozlugu(dbContext?: DbContext): Promise<Map<string, CariOzeti[]>> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const rows = (
      await pool.request().query(`
        SELECT CARI_KART_ID, KOD, AD, LTRIM(RTRIM(VERGI_KIMLIK_NO)) AS VKN
        FROM TODVZ_CARI_KART WHERE LEN(LTRIM(RTRIM(ISNULL(VERGI_KIMLIK_NO, '')))) >= 10
      `)
    ).recordset;
    const m = new Map<string, CariOzeti[]>();
    for (const r of rows) {
      const liste = m.get(r.VKN) || [];
      liste.push({ cariKartId: r.CARI_KART_ID, kod: kirp(r.KOD), ad: kirp(r.AD) });
      m.set(r.VKN, liste);
    }
    return m;
  }

  /** Elle aktarımlarda öğrenilen karşı IBAN → cari. */
  public static async ibanSozlugu(dbContext?: DbContext): Promise<Map<string, CariOzeti>> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const rows = (
      await pool.request().query(`
        SELECT i.IBAN, c.CARI_KART_ID, c.KOD, c.AD
        FROM TODVZ_EBANKA_CARI_IBAN i JOIN TODVZ_CARI_KART c ON c.CARI_KART_ID = i.CARI_KART_ID
      `)
    ).recordset;
    return new Map(rows.map((r: any) => [String(r.IBAN), { cariKartId: r.CARI_KART_ID, kod: kirp(r.KOD), ad: kirp(r.AD) }]));
  }

  public static async ibanOgren(iban: string, cariKartId: number, dbContext?: DbContext): Promise<void> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("IBAN", sql.VarChar(34), iban);
    req.input("CARI", sql.Int, cariKartId);
    await req.query(`
      UPDATE TODVZ_EBANKA_CARI_IBAN SET CARI_KART_ID = @CARI WHERE IBAN = @IBAN;
      IF @@ROWCOUNT = 0 INSERT INTO TODVZ_EBANKA_CARI_IBAN (IBAN, CARI_KART_ID) VALUES (@IBAN, @CARI);
    `);
  }

  public static async cariGetir(cariKartId: number, dbContext?: DbContext): Promise<CariOzeti | null> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("ID", sql.Int, cariKartId);
    const r = (await req.query(`SELECT CARI_KART_ID, KOD, AD FROM TODVZ_CARI_KART WHERE CARI_KART_ID = @ID`)).recordset[0];
    return r ? { cariKartId: r.CARI_KART_ID, kod: kirp(r.KOD), ad: kirp(r.AD) } : null;
  }

  /** Sanal POS ödeme/link formunu cariden doldurmak için (E10). EPOSTA kolonu olmayan eski şemada e-posta boş döner. */
  public static async cariIletisim(cariKartId: number, dbContext?: DbContext): Promise<(CariOzeti & { telefon: string | null; eposta: string | null; vergiNo: string | null; adres: string | null }) | null> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const oku = async (epostaKolonu: string) => {
      const req = pool.request();
      req.input("ID", sql.Int, cariKartId);
      return (await req.query(`SELECT CARI_KART_ID, KOD, AD, TELEFON, VERGI_KIMLIK_NO, ADRES, ${epostaKolonu} AS EPOSTA FROM TODVZ_CARI_KART WHERE CARI_KART_ID = @ID`)).recordset[0];
    };
    let r: any;
    try {
      r = await oku("EPOSTA");
    } catch {
      r = await oku("NULL");
    }
    if (!r) return null;
    return { cariKartId: r.CARI_KART_ID, kod: kirp(r.KOD), ad: kirp(r.AD), telefon: kirp(r.TELEFON) || null, eposta: kirp(r.EPOSTA) || null, vergiNo: kirp(r.VERGI_KIMLIK_NO) || null, adres: kirp(r.ADRES) || null };
  }

  public static async cariAra(arama: string, dbContext?: DbContext): Promise<(CariOzeti & { vergiNo: string | null })[]> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("ARA", sql.VarChar(120), `%${arama.trim().slice(0, 100)}%`);
    const rows = (
      await req.query(`
        SELECT TOP 50 CARI_KART_ID, KOD, AD, VERGI_KIMLIK_NO FROM TODVZ_CARI_KART
        WHERE KOD LIKE @ARA OR AD LIKE @ARA OR VERGI_KIMLIK_NO LIKE @ARA
        ORDER BY AD
      `)
    ).recordset;
    return rows.map((r: any) => ({ cariKartId: r.CARI_KART_ID, kod: kirp(r.KOD), ad: kirp(r.AD), vergiNo: kirp(r.VERGI_KIMLIK_NO) || null }));
  }

  /** Vomsis döviz kodu (TL, USD, EUR…) → TODVZ_PARA. */
  public static async paraSozlugu(dbContext?: DbContext): Promise<{ kodlar: Map<string, number>; tlId: number | null }> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const rows = (await pool.request().query(`SELECT PARA_ID, RTRIM(UPPER(KOD)) AS KOD FROM TODVZ_PARA ORDER BY PARA_ID DESC`)).recordset;
    const kodlar = new Map<string, number>(rows.map((r: any) => [String(r.KOD), Number(r.PARA_ID)]));
    const tlId = kodlar.get("TL") ?? kodlar.get("TRY") ?? null;
    if (tlId !== null) {
      kodlar.set("TL", tlId);
      kodlar.set("TRY", tlId);
    }
    return { kodlar, tlId };
  }

  /** Hareket gününe eşit/önceki en yakın kur tablosundaki döviz kuru: girişte alış, çıkışta satış (E16). Bulunamazsa 0. */
  public static async kurGetir(paraId: number, gun: string, giris: boolean, dbContext?: DbContext): Promise<number> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const alan = giris ? "COALESCE(NULLIF(K.DOVIZ_ALIS,0),K.EFEKTIF_ALIS)" : "COALESCE(NULLIF(K.DOVIZ_SATIS,0),K.EFEKTIF_SATIS)";
    const req = pool.request();
    req.input("PARA", sql.Int, paraId);
    req.input("GUN", sql.Date, new Date(`${gun}T00:00:00Z`));
    try {
      const r = (
        await req.query(`
          SELECT TOP 1 ${alan} AS KUR
          FROM dbo.TODVZ_KUR K JOIN dbo.TODVZ_KUR_TABLOSU T ON T.KUR_TABLOSU_ID = K.KUR_TABLOSU_ID
          WHERE K.PARA_ID = @PARA AND CAST(T.TARIH AS date) <= @GUN AND ${alan} > 0
          ORDER BY T.TARIH DESC, T.KUR_TABLOSU_ID DESC
        `)
      ).recordset[0];
      return Number(r?.KUR) || 0;
    } catch {
      return 0;
    }
  }

  // ─── Durum yazımları ───────────────────────────────────────────────────────

  /** Hareketi aktarım için kilitler. İki kullanıcı / iki çalıştırma aynı harekete fiş kesemesin diye fişten ÖNCE işaretlenir. */
  public static async talepEt(vomsisId: number, dbContext?: DbContext): Promise<boolean> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("ID", sql.BigInt, vomsisId);
    const r = await req.query(`UPDATE TODVZ_EBANKA_HAREKET SET AKTARIM_DURUMU = 1 WHERE VOMSIS_ID = @ID AND AKTARIM_DURUMU = 0 AND BANKA_HAREKET_ID IS NULL`);
    return (r.rowsAffected[0] || 0) === 1;
  }

  public static async aktarildiYaz(vomsisId: number, bankaHareketId: number, cariKartId: number | null, dbContext?: DbContext): Promise<void> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("ID", sql.BigInt, vomsisId);
    req.input("FIS", sql.Int, bankaHareketId);
    req.input("CARI", sql.Int, cariKartId);
    await req.query(`UPDATE TODVZ_EBANKA_HAREKET SET AKTARIM_DURUMU = 1, BANKA_HAREKET_ID = @FIS, CARI_KART_ID = @CARI WHERE VOMSIS_ID = @ID`);
  }

  /** Fiş kesilemediyse kilit geri alınır. */
  public static async talebiBirak(vomsisId: number, dbContext?: DbContext): Promise<void> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("ID", sql.BigInt, vomsisId);
    await req.query(`UPDATE TODVZ_EBANKA_HAREKET SET AKTARIM_DURUMU = 0 WHERE VOMSIS_ID = @ID AND BANKA_HAREKET_ID IS NULL`);
  }

  /** Bekliyor ↔ aktarılmayacak. Fişi olan (aktarılmış) harekete dokunmaz. */
  public static async durumYaz(vomsisIdler: number[], durum: 0 | 2, dbContext?: DbContext): Promise<number> {
    const idler = vomsisIdler.filter((n) => Number.isSafeInteger(n) && n > 0);
    if (!idler.length) return 0;
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("DURUM", sql.TinyInt, durum);
    const r = await req.query(`
      UPDATE TODVZ_EBANKA_HAREKET SET AKTARIM_DURUMU = @DURUM
      WHERE VOMSIS_ID IN (${idler.join(",")}) AND AKTARIM_DURUMU IN (0, 2) AND BANKA_HAREKET_ID IS NULL
    `);
    return r.rowsAffected[0] || 0;
  }

  /** Kuralı "aktarma" olan tiplerin bekleyen hareketleri topluca kapatılır. */
  public static async aktarilmayacaklariKapat(baslangic: string, dbContext?: DbContext): Promise<number> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("BAS", sql.DateTime, new Date(`${baslangic}T00:00:00Z`));
    const r = await req.query(`
      UPDATE t SET t.AKTARIM_DURUMU = 2
      FROM TODVZ_EBANKA_HAREKET t JOIN TODVZ_EBANKA_HAREKET_TIPI p ON p.TIP_KODU = t.TIP_KODU
      WHERE t.AKTARIM_DURUMU = 0 AND t.BANKA_HAREKET_ID IS NULL AND p.KURAL = 2 AND t.SISTEM_TARIHI >= @BAS
    `);
    return r.rowsAffected[0] || 0;
  }

  // ─── Hareket tipi kuralları ────────────────────────────────────────────────

  public static async tipKurallari(dbContext?: DbContext): Promise<TipKuraliSatiri[]> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const rows = (
      await pool.request().query(`
        SELECT p.TIP_KODU, p.TIP_ADI, p.KURAL, p.CARI_KART_ID, c.KOD AS CARI_KOD, c.AD AS CARI_ADI
        FROM TODVZ_EBANKA_HAREKET_TIPI p LEFT JOIN TODVZ_CARI_KART c ON c.CARI_KART_ID = p.CARI_KART_ID
        ORDER BY p.TIP_ADI
      `)
    ).recordset;
    return rows.map((r: any) => ({
      tipKodu: r.TIP_KODU,
      tipAdi: r.TIP_ADI,
      kural: (Number(r.KURAL) || 0) as TipKurali,
      cariKartId: r.CARI_KART_ID ?? null,
      cariKod: r.CARI_KOD ? kirp(r.CARI_KOD) : null,
      cariAdi: r.CARI_ADI ? kirp(r.CARI_ADI) : null,
    }));
  }

  public static async tipKuraliYaz(tipKodu: string, kural: TipKurali, cariKartId: number | null, dbContext?: DbContext): Promise<boolean> {
    const pool = await EBankaVeriSqlRepository.pool(dbContext);
    const req = pool.request();
    req.input("KOD", sql.VarChar(20), tipKodu);
    req.input("KURAL", sql.TinyInt, kural);
    req.input("CARI", sql.Int, cariKartId);
    const r = await req.query(`UPDATE TODVZ_EBANKA_HAREKET_TIPI SET KURAL = @KURAL, CARI_KART_ID = @CARI WHERE TIP_KODU = @KOD`);
    return (r.rowsAffected[0] || 0) === 1;
  }
}

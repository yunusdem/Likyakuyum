import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { DbBaglam, TicariStokSqlRepository } from "./ticariStokSql.repository.js";
import { FiyatIslemi, Yuvarlama, yeniFiyatHesapla } from "../services/ticari/ticariHesap.js";

/**
 * Toplu fiyat işlemleri (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 11, G11, G13, G14): hedef (grup / tedarikçi / seçili / tümü),
 * liste (ana ya da tanımlı), alan (satış / alış), işlem (yüzde, tutar, alış × kâr), yuvarlama. Önizleme → uygula (geçmişe yazar) → geri al.
 * Tutar işlemi yalnız seçilen para birimindeki kartlara uygulanır; diğerleri atlanır (G14).
 */

export interface FiyatIslemiGirdi {
  hedef: { tur: "grup" | "tedarikci" | "secili" | "tumu"; grupId?: number | null; cariId?: number | null; kartIdler?: number[] | null };
  /** null: ana satış fiyatı; sayı: tanımlı liste (alan satış olmalı) */
  fiyatListesiId?: number | null;
  alan: "satis" | "alis";
  islem: FiyatIslemi;
  yuvarlama: Yuvarlama;
  /** Tutar işleminde hedef para birimi: null = TL; yalnız bu para birimindeki kartlar değişir */
  paraId?: number | null;
  /** Pasif kartlar da dahil edilsin mi (varsayılan hayır) */
  pasifler?: boolean;
  aciklama?: string | null;
}

export interface FiyatIslemiSatiri {
  stokKartId: number;
  kod: string;
  ad: string;
  paraKodu: string;
  eski: number | null;
  yeni: number | null;
  /** Atlanma nedeni: para birimi farklı / alış fiyatı yok / fiyat yok */
  atlandi: "para" | "alisYok" | "fiyatYok" | null;
  /** Geçmişe yazılacak eski değer: listede kaydı olmayan kartta null (geri alınca liste satırı silinir, ana fiyat geçerli olur) */
  eskiKayit?: number | null;
}

export interface FiyatIslemiOnizleme {
  satirlar: FiyatIslemiSatiri[];
  toplam: number;
  degisecek: number;
  atlanan: number;
  kesildi: boolean;
}

const temiz = (v: unknown): string => String(v ?? "").trim();
const ONIZLEME_SINIRI = 5000;

export class TicariFiyatIslemiSqlRepository {
  static havuz(ctx?: DbBaglam) {
    return TicariStokSqlRepository.havuz(ctx);
  }

  /** Girdiyi denetler, SQL süzgeci ve parametreleri üretir */
  private static hazirla(req: sql.Request, g: FiyatIslemiGirdi): { kosul: string } {
    const alan = g.alan === "alis" ? "alis" : "satis";
    const liste = Number(g.fiyatListesiId) || null;
    if (alan === "alis" && liste) throw ApiError.badRequest("Alış fiyatı işlemi fiyat listesine uygulanmaz.");
    if (!g.islem || !["yuzde", "tutar", "alisKar"].includes(g.islem.tur)) throw ApiError.badRequest("İşlem türü yüzde, tutar ya da alış × kâr olmalı.");
    const deger = Number(typeof g.islem.deger === "string" ? String(g.islem.deger).replace(",", ".") : g.islem.deger);
    if (!Number.isFinite(deger)) throw ApiError.badRequest("İşlem değeri sayı olmalı.");
    if (g.islem.tur === "alisKar" && alan === "alis") throw ApiError.badRequest("Alış × kâr işlemi yalnız satış fiyatına uygulanır.");
    if (!["kurus", "tl", "99"].includes(g.yuvarlama)) throw ApiError.badRequest("Yuvarlama kuruş, TL ya da ,99 olmalı.");
    const h = g.hedef || ({} as FiyatIslemiGirdi["hedef"]);
    const kosul: string[] = [];
    if (!g.pasifler) kosul.push("K.AKTIF = 1");
    if (h.tur === "grup") { if (!Number(h.grupId)) throw ApiError.badRequest("Grup seçin."); req.input("GRUP", sql.Int, Number(h.grupId)); kosul.push("K.STOK_GRUP_ID = @GRUP"); }
    else if (h.tur === "tedarikci") { if (!Number(h.cariId)) throw ApiError.badRequest("Tedarikçi seçin."); req.input("CARI", sql.Int, Number(h.cariId)); kosul.push("K.TEDARIKCI_CARI_ID = @CARI"); }
    else if (h.tur === "secili") {
      const idler = [...new Set((h.kartIdler || []).map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 5000);
      if (!idler.length) throw ApiError.badRequest("Kart seçin.");
      kosul.push(`K.STOK_KART_ID IN (${idler.join(",")})`);
    } else if (h.tur !== "tumu") throw ApiError.badRequest("Hedef türü grup, tedarikçi, seçili ya da tümü olmalı.");
    req.input("LISTE", sql.Int, liste);
    return { kosul: kosul.length ? "WHERE " + kosul.join(" AND ") : "" };
  }

  /** Hedefteki kartlar ve mevcut fiyatları (eski = listede yoksa ana fiyat) */
  private static async kartlar(pool: sql.ConnectionPool | sql.Transaction, g: FiyatIslemiGirdi) {
    const req = new sql.Request(pool as any);
    const { kosul } = this.hazirla(req, g);
    const r = await req.query(`
      SELECT K.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, K.PARA_ID, RTRIM(P.KOD) AS PARA_KODU, K.SATIS_FIYATI, K.ALIS_FIYATI, LF.FIYAT AS LISTE_FIYATI
      FROM dbo.TODVZ_STOK_KART K
      LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID = K.PARA_ID
      LEFT JOIN dbo.TODVZ_STOK_KART_FIYAT LF ON LF.STOK_KART_ID = K.STOK_KART_ID AND LF.FIYAT_LISTESI_ID = @LISTE
      ${kosul} ORDER BY K.AD, K.KOD`);
    return r.recordset as any[];
  }

  static hesapla(g: FiyatIslemiGirdi, kartlar: any[]): FiyatIslemiSatiri[] {
    const alan = g.alan === "alis" ? "alis" : "satis";
    const liste = Number(g.fiyatListesiId) || null;
    const hedefPara = Number(g.paraId) || null;
    const tlMi = (kod: string) => ["", "TL", "TRY"].includes(temiz(kod).toUpperCase());
    return kartlar.map((k) => {
      const paraKodu = temiz(k.PARA_KODU) || "TL";
      const eski: number | null = alan === "alis"
        ? (k.ALIS_FIYATI === null ? null : Number(k.ALIS_FIYATI))
        : liste ? (k.LISTE_FIYATI === null ? (k.SATIS_FIYATI === null ? null : Number(k.SATIS_FIYATI)) : Number(k.LISTE_FIYATI)) : (k.SATIS_FIYATI === null ? null : Number(k.SATIS_FIYATI));
      const alis: number | null = k.ALIS_FIYATI === null ? null : Number(k.ALIS_FIYATI);
      let atlandi: FiyatIslemiSatiri["atlandi"] = null;
      // Tutar işlemi yalnız aynı para birimindeki kartlara (G14)
      if (g.islem.tur === "tutar") {
        const kartPara = tlMi(paraKodu) ? null : Number(k.PARA_ID) || null;
        if (kartPara !== hedefPara) atlandi = "para";
      }
      if (!atlandi && g.islem.tur === "alisKar" && alis === null) atlandi = "alisYok";
      if (!atlandi && g.islem.tur !== "alisKar" && eski === null) atlandi = "fiyatYok";
      const yeni = atlandi ? null : yeniFiyatHesapla(eski, alis, g.islem, g.yuvarlama);
      const eskiKayit = liste && alan === "satis" ? (k.LISTE_FIYATI === null || k.LISTE_FIYATI === undefined ? null : Number(k.LISTE_FIYATI)) : eski;
      return { stokKartId: Number(k.STOK_KART_ID), kod: temiz(k.KOD), ad: temiz(k.AD), paraKodu, eski, yeni, atlandi, eskiKayit };
    });
  }

  static async onizle(g: FiyatIslemiGirdi, ctx?: DbBaglam): Promise<FiyatIslemiOnizleme> {
    const pool = await this.havuz(ctx);
    const satirlar = this.hesapla(g, await this.kartlar(pool, g));
    const degisecek = satirlar.filter((s) => !s.atlandi && s.yeni !== s.eski).length;
    return { satirlar: satirlar.slice(0, ONIZLEME_SINIRI), toplam: satirlar.length, degisecek, atlanan: satirlar.filter((s) => s.atlandi).length, kesildi: satirlar.length > ONIZLEME_SINIRI };
  }

  /** Uygular: değişen her kart geçmişe (eski → yeni, işlem no) yazılır; fiyatlar küme bazlı güncellenir */
  static async uygula(g: FiyatIslemiGirdi, kullaniciId: number | undefined, ctx?: DbBaglam): Promise<{ islemNo: number; degisen: number; atlanan: number }> {
    const pool = await this.havuz(ctx);
    const alan = g.alan === "alis" ? "ALIS" : "SATIS";
    const liste = Number(g.fiyatListesiId) || null;
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const satirlar = this.hesapla(g, await this.kartlar(tx, g)).filter((s) => !s.atlandi && s.yeni !== null && s.yeni !== s.eski);
      const islemNo = Number((await new sql.Request(tx).query(`SELECT ISNULL(MAX(ISLEM_NO), 0) + 1 AS N FROM dbo.TODVZ_STOK_FIYAT_GECMISI WITH (UPDLOCK, HOLDLOCK)`)).recordset[0].N);
      if (!satirlar.length) { await tx.commit(); return { islemNo: 0, degisen: 0, atlanan: 0 }; }
      const aciklama = temiz(g.aciklama).slice(0, 300) || this.aciklamaUret(g);
      await this.yaz(tx, satirlar.map((s) => ({ stokKartId: s.stokKartId, eski: s.eskiKayit ?? null, yeni: s.yeni! })), { islemNo, alan, liste, aciklama, kullaniciId });
      await tx.commit();
      return { islemNo, degisen: satirlar.length, atlanan: 0 };
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
  }

  /** Geçmiş satırlarını yazar ve fiyatları günceller (uygula ve geri al ortak) */
  private static async yaz(tx: sql.Transaction, satirlar: { stokKartId: number; eski: number | null; yeni: number | null }[], b: { islemNo: number; alan: string; liste: number | null; aciklama: string; kullaniciId?: number }) {
    await new sql.Request(tx).batch(`IF OBJECT_ID('tempdb..#Y') IS NOT NULL DROP TABLE #Y; CREATE TABLE #Y (ID INT NOT NULL PRIMARY KEY, ESKI FLOAT NULL, YENI FLOAT NULL);`);
    for (let i = 0; i < satirlar.length; i += 600) {
      const paket = satirlar.slice(i, i + 600);
      const req = new sql.Request(tx);
      const degerler = paket.map((s, j) => { req.input(`I${j}`, sql.Int, s.stokKartId).input(`E${j}`, sql.Float, s.eski).input(`Y${j}`, sql.Float, s.yeni); return `(@I${j}, @E${j}, @Y${j})`; });
      await req.query(`INSERT INTO #Y (ID, ESKI, YENI) VALUES ${degerler.join(",")}`);
    }
    const req = new sql.Request(tx).input("NO", sql.Int, b.islemNo).input("ALAN", sql.VarChar(10), b.alan).input("LISTE", sql.Int, b.liste)
      .input("ACIKLAMA", sql.NVarChar(300), b.aciklama).input("KUL", sql.Int, b.kullaniciId || null);
    const guncelle = b.alan === "ALIS"
      ? `UPDATE K SET ALIS_FIYATI = Y.YENI, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() FROM dbo.TODVZ_STOK_KART K JOIN #Y Y ON Y.ID = K.STOK_KART_ID;`
      : b.liste
        ? `DELETE F FROM dbo.TODVZ_STOK_KART_FIYAT F JOIN #Y Y ON Y.ID = F.STOK_KART_ID WHERE F.FIYAT_LISTESI_ID = @LISTE AND Y.YENI IS NULL;
           UPDATE F SET FIYAT = Y.YENI, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() FROM dbo.TODVZ_STOK_KART_FIYAT F JOIN #Y Y ON Y.ID = F.STOK_KART_ID WHERE F.FIYAT_LISTESI_ID = @LISTE AND Y.YENI IS NOT NULL;
           INSERT INTO dbo.TODVZ_STOK_KART_FIYAT (STOK_KART_ID, FIYAT_LISTESI_ID, FIYAT, GUNCELLEYEN_ID)
           SELECT Y.ID, @LISTE, Y.YENI, @KUL FROM #Y Y WHERE Y.YENI IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_KART_FIYAT F WHERE F.STOK_KART_ID = Y.ID AND F.FIYAT_LISTESI_ID = @LISTE);`
        : `UPDATE K SET SATIS_FIYATI = Y.YENI, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() FROM dbo.TODVZ_STOK_KART K JOIN #Y Y ON Y.ID = K.STOK_KART_ID;`;
    await req.query(`
      INSERT INTO dbo.TODVZ_STOK_FIYAT_GECMISI (ISLEM_NO, STOK_KART_ID, FIYAT_LISTESI_ID, ALAN, ESKI_FIYAT, YENI_FIYAT, KULLANICI_ID, ACIKLAMA)
      SELECT @NO, Y.ID, @LISTE, @ALAN, Y.ESKI, Y.YENI, @KUL, @ACIKLAMA FROM #Y Y;
      ${guncelle}
      DROP TABLE #Y;`);
  }

  private static aciklamaUret(g: FiyatIslemiGirdi): string {
    const islem = g.islem.tur === "yuzde" ? `%${g.islem.deger}` : g.islem.tur === "tutar" ? `${g.islem.deger} tutar` : `alış × %${g.islem.deger} kâr`;
    const hedef = g.hedef.tur === "tumu" ? "tüm kartlar" : g.hedef.tur === "grup" ? "grup" : g.hedef.tur === "tedarikci" ? "tedarikçi" : "seçili kartlar";
    return `${g.alan === "alis" ? "Alış" : "Satış"} fiyatı ${islem} (${hedef}${g.fiyatListesiId ? ", liste" : ""})`;
  }

  /**
   * Geri alma: işlemin (geri alınmamış) satırlarında eski fiyat yazılır; işlem "geri alındı" işaretlenir ve geri alma
   * yeni bir işlem olarak geçmişe girer (o da geri alınabilir).
   */
  static async geriAl(islemNo: number, kullaniciId: number | undefined, ctx?: DbBaglam): Promise<{ islemNo: number; degisen: number }> {
    const pool = await this.havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const r = await new sql.Request(tx).input("NO", sql.Int, islemNo).query(`
        SELECT STOK_KART_ID, FIYAT_LISTESI_ID, ALAN, ESKI_FIYAT, YENI_FIYAT, GERI_ALINDI FROM dbo.TODVZ_STOK_FIYAT_GECMISI WITH (UPDLOCK) WHERE ISLEM_NO = @NO`);
      if (!r.recordset.length) throw ApiError.notFound("Fiyat işlemi bulunamadı.");
      if (r.recordset.every((x: any) => x.GERI_ALINDI === true || x.GERI_ALINDI === 1)) throw ApiError.badRequest("Bu işlem zaten geri alınmış.");
      const alan = String(r.recordset[0].ALAN);
      const liste = r.recordset[0].FIYAT_LISTESI_ID ?? null;
      const satirlar = r.recordset.map((x: any) => ({ stokKartId: Number(x.STOK_KART_ID), eski: x.YENI_FIYAT === null ? null : Number(x.YENI_FIYAT), yeni: x.ESKI_FIYAT === null ? null : Number(x.ESKI_FIYAT) }));
      const yeniNo = Number((await new sql.Request(tx).query(`SELECT ISNULL(MAX(ISLEM_NO), 0) + 1 AS N FROM dbo.TODVZ_STOK_FIYAT_GECMISI WITH (UPDLOCK, HOLDLOCK)`)).recordset[0].N);
      await this.yaz(tx, satirlar, { islemNo: yeniNo, alan, liste, aciklama: `Geri alma: ${islemNo}. işlem`, kullaniciId });
      await new sql.Request(tx).input("NO", sql.Int, islemNo).query(`UPDATE dbo.TODVZ_STOK_FIYAT_GECMISI SET GERI_ALINDI = 1 WHERE ISLEM_NO = @NO`);
      await tx.commit();
      return { islemNo: yeniNo, degisen: satirlar.length };
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
  }

  static async gecmis(ctx?: DbBaglam, limit = 100) {
    const pool = await this.havuz(ctx);
    const r = await pool.request().query(`
      SELECT TOP ${Math.min(Math.max(limit, 1), 500)} G.ISLEM_NO, MIN(G.TARIH) AS TARIH, MAX(G.ALAN) AS ALAN, MAX(G.FIYAT_LISTESI_ID) AS FIYAT_LISTESI_ID, MAX(L.AD) AS LISTE_ADI,
        MAX(G.ACIKLAMA) AS ACIKLAMA, COUNT(*) AS KART, MAX(G.KULLANICI_ID) AS KULLANICI_ID, MAX(RTRIM(U.AD)) AS KULLANICI_ADI, MIN(CAST(G.GERI_ALINDI AS INT)) AS GERI_ALINDI
      FROM dbo.TODVZ_STOK_FIYAT_GECMISI G
      LEFT JOIN dbo.TODVZ_STOK_FIYAT_LISTESI L ON L.FIYAT_LISTESI_ID = G.FIYAT_LISTESI_ID
      LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID = G.KULLANICI_ID
      GROUP BY G.ISLEM_NO ORDER BY G.ISLEM_NO DESC`);
    return r.recordset.map((x: any) => ({
      islemNo: Number(x.ISLEM_NO), tarih: x.TARIH ? new Date(x.TARIH).toISOString() : null, alan: temiz(x.ALAN), fiyatListesiId: x.FIYAT_LISTESI_ID ?? null,
      listeAdi: x.LISTE_ADI ? temiz(x.LISTE_ADI) : null, aciklama: temiz(x.ACIKLAMA), kart: Number(x.KART) || 0, kullaniciAdi: x.KULLANICI_ADI ? temiz(x.KULLANICI_ADI) : null,
      geriAlindi: Number(x.GERI_ALINDI) === 1,
    }));
  }
}

import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { ApiError } from "../utils/ApiError.js";
import { ticariSemaHazirla } from "../services/ticari/ticariSema.js";
import { GECERLI_KDV_ORANLARI, birimAdiDuzelt } from "../services/ticari/ticariHesap.js";
import { UrunResimSqlRepository } from "./urunResimSql.repository.js";

/**
 * Ticari İşlemler: stok kartı, ürün grubu, stok ayarları, yetki ve stok raporları
 * (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T5–T8, T19, T21). Bakiye her zaman hareket defterinden (TODVZ_STOK_HAREKET).
 */

export type DbBaglam = { dbServer?: string; dbName?: string };

/** Stok hareketi belge türleri */
export const STOK_BELGE = { GIRIS: 1, SATIS: 2 } as const;
export const STOK_BELGE_ADI: Record<number, string> = { 1: "Stok Giriş Fişi", 2: "Satış Fişi" };

/** Ürün resmi (TODVZ_URUN_RESIM.TIP): 0 altın, 1 özel ürün, 2 stok kartı */
export const STOK_RESIM_TIPI = 2;

export type EksiStokDavranisi = "UYAR" | "ENGELLE" | "SESSIZ";

export interface StokGrup {
  stokGrupId: number;
  ad: string;
  aktif: boolean;
  kartSayisi: number;
}

export interface StokKart {
  stokKartId: number;
  kod: string;
  ad: string;
  stokGrupId: number | null;
  grupAdi: string | null;
  birim: string;
  kdvOrani: number;
  satisFiyati: number | null;
  fiyatKdvDahil: boolean;
  paraId: number | null;
  paraKodu: string | null;
  alisFiyati: number | null;
  sonAlisFiyati: number | null;
  sonAlisTarihi: string | null;
  enAzStok: number | null;
  aktif: boolean;
  aciklama: string | null;
  barkodlar: string[];
  bakiye: number;
  resimVar: boolean;
  resim?: string | null;
}

export interface StokKartGirdi {
  stokKartId?: number | null;
  kod?: string | null;
  ad?: string | null;
  stokGrupId?: number | null;
  birim?: string | null;
  kdvOrani?: number | string | null;
  satisFiyati?: number | string | null;
  fiyatKdvDahil?: boolean | null;
  paraId?: number | null;
  alisFiyati?: number | string | null;
  enAzStok?: number | string | null;
  aktif?: boolean | null;
  aciklama?: string | null;
  barkodlar?: string[] | null;
  /** undefined: resme dokunma · null / "": resmi kaldır · data URL: yeni resim */
  resim?: string | null;
}

const temiz = (v: unknown): string => String(v ?? "").trim();
const sayiVeyaNull = (v: unknown): number | null => {
  if (v === null || v === undefined || temiz(v) === "") return null;
  const s = typeof v === "string" ? (v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) : v;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

/** Kart girdisini denetler ve kayda hazır hâle getirir (saf; Excel yüklemesi de kullanır). Hata listesi döner. */
export interface KartDegeri {
  kod: string;
  ad: string;
  stokGrupId: number | null;
  birim: string;
  kdvOrani: number;
  satisFiyati: number | null;
  fiyatKdvDahil: boolean;
  paraId: number | null;
  alisFiyati: number | null;
  enAzStok: number | null;
  aktif: boolean;
  aciklama: string | null;
  barkodlar: string[];
}

export type KartAlani = "kod" | "ad" | "birim" | "kdvOrani" | "satisFiyati" | "alisFiyati" | "enAzStok" | "barkodlar";

export function kartGirdisiDenetle(g: StokKartGirdi): { hatalar: string[]; alanHatalari: { alan: KartAlani; mesaj: string }[]; deger: KartDegeri } {
  const alanHatalari: { alan: KartAlani; mesaj: string }[] = [];
  const hatalar = { push: (alan: KartAlani, mesaj: string) => alanHatalari.push({ alan, mesaj }) };
  const ad = temiz(g.ad);
  if (!ad) hatalar.push("ad", "Ürün adı zorunlu.");
  if (ad.length > 200) hatalar.push("ad", "Ürün adı en çok 200 karakter olabilir.");
  const kod = temiz(g.kod).toLocaleUpperCase("tr-TR");
  if (kod.length > 30) hatalar.push("kod", "Kod en çok 30 karakter olabilir.");
  if (kod && !/^[0-9A-ZÇĞİÖŞÜ._\-/]+$/.test(kod)) hatalar.push("kod", "Kodda yalnız harf, rakam ve . _ - / kullanılabilir.");

  let birim = "Adet";
  if (temiz(g.birim)) {
    const b = birimAdiDuzelt(g.birim);
    if (!b) hatalar.push("birim", `Birim "${temiz(g.birim)}" tanınmadı; Adet, Kg, Gr, Lt, Metre, Paket ya da Kutu olmalı.`);
    else birim = b;
  }

  let kdvOrani = 20;
  const kdv = sayiVeyaNull(g.kdvOrani);
  if (kdv !== null) {
    if (Number.isNaN(kdv) || !GECERLI_KDV_ORANLARI.includes(kdv)) hatalar.push("kdvOrani", `KDV oranı ${temiz(g.kdvOrani)} olamaz; ${GECERLI_KDV_ORANLARI.join(", ")} olmalı.`);
    else kdvOrani = kdv;
  }

  const fiyat = (k: KartAlani, alan: string, v: unknown): number | null => {
    const n = sayiVeyaNull(v);
    if (n === null) return null;
    if (Number.isNaN(n)) { hatalar.push(k, `${alan} sayı olmalı ("${temiz(v)}").`); return null; }
    if (n < 0) { hatalar.push(k, `${alan} eksi olamaz.`); return null; }
    return n;
  };
  const satisFiyati = fiyat("satisFiyati", "Satış fiyatı", g.satisFiyati);
  const alisFiyati = fiyat("alisFiyati", "Alış fiyatı", g.alisFiyati);
  const enAzStok = fiyat("enAzStok", "En az stok", g.enAzStok);

  const barkodlar: string[] = [];
  for (const b of g.barkodlar || []) {
    const t = temiz(b);
    if (!t) continue;
    if (t.length > 50) hatalar.push("barkodlar", `Barkod "${t}" 50 karakterden uzun.`);
    else if (/\s/.test(t)) hatalar.push("barkodlar", `Barkod "${t}" boşluk içeremez.`);
    else if (!barkodlar.includes(t)) barkodlar.push(t);
  }

  return {
    hatalar: alanHatalari.map((h) => h.mesaj),
    alanHatalari,
    deger: {
      kod,
      ad,
      stokGrupId: g.stokGrupId ? Number(g.stokGrupId) : null,
      birim,
      kdvOrani,
      satisFiyati,
      fiyatKdvDahil: g.fiyatKdvDahil === undefined || g.fiyatKdvDahil === null ? true : !!g.fiyatKdvDahil,
      paraId: g.paraId ? Number(g.paraId) : null,
      alisFiyati,
      enAzStok,
      aktif: g.aktif === undefined || g.aktif === null ? true : !!g.aktif,
      aciklama: temiz(g.aciklama).slice(0, 500) || null,
      barkodlar,
    },
  };
}

const KART_SECIMI = `
  SELECT K.STOK_KART_ID, K.KOD, K.AD, K.STOK_GRUP_ID, G.AD AS GRUP_ADI, K.BIRIM, K.KDV_ORANI, K.SATIS_FIYATI, K.FIYAT_KDV_DAHIL,
    K.PARA_ID, RTRIM(P.KOD) AS PARA_KODU, K.ALIS_FIYATI, K.SON_ALIS_FIYATI, K.SON_ALIS_TARIHI, K.EN_AZ_STOK, K.AKTIF, K.ACIKLAMA,
    CASE WHEN K.RESIM IS NULL THEN 0 ELSE 1 END AS RESIM_VAR,
    ISNULL(H.BAKIYE, 0) AS BAKIYE,
    STUFF((SELECT '|' + B.BARKOD FROM dbo.TODVZ_STOK_BARKOD B WHERE B.STOK_KART_ID = K.STOK_KART_ID ORDER BY B.STOK_BARKOD_ID FOR XML PATH(''), TYPE).value('.', 'varchar(max)'), 1, 1, '') AS BARKODLAR
  FROM dbo.TODVZ_STOK_KART K
  LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID
  LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID = K.PARA_ID
  OUTER APPLY (SELECT SUM(X.GIRIS - X.CIKIS) AS BAKIYE FROM dbo.TODVZ_STOK_HAREKET X WHERE X.STOK_KART_ID = K.STOK_KART_ID) H`;

const kartModeli = (r: any): StokKart => ({
  stokKartId: r.STOK_KART_ID,
  kod: temiz(r.KOD),
  ad: temiz(r.AD),
  stokGrupId: r.STOK_GRUP_ID ?? null,
  grupAdi: r.GRUP_ADI ? temiz(r.GRUP_ADI) : null,
  birim: temiz(r.BIRIM) || "Adet",
  kdvOrani: Number(r.KDV_ORANI) || 0,
  satisFiyati: r.SATIS_FIYATI === null || r.SATIS_FIYATI === undefined ? null : Number(r.SATIS_FIYATI),
  fiyatKdvDahil: r.FIYAT_KDV_DAHIL === true || r.FIYAT_KDV_DAHIL === 1,
  paraId: r.PARA_ID ?? null,
  paraKodu: r.PARA_KODU ? temiz(r.PARA_KODU) : null,
  alisFiyati: r.ALIS_FIYATI === null || r.ALIS_FIYATI === undefined ? null : Number(r.ALIS_FIYATI),
  sonAlisFiyati: r.SON_ALIS_FIYATI === null || r.SON_ALIS_FIYATI === undefined ? null : Number(r.SON_ALIS_FIYATI),
  sonAlisTarihi: r.SON_ALIS_TARIHI ? new Date(r.SON_ALIS_TARIHI).toISOString() : null,
  enAzStok: r.EN_AZ_STOK === null || r.EN_AZ_STOK === undefined ? null : Number(r.EN_AZ_STOK),
  aktif: r.AKTIF === true || r.AKTIF === 1,
  aciklama: r.ACIKLAMA ? temiz(r.ACIKLAMA) : null,
  barkodlar: r.BARKODLAR ? String(r.BARKODLAR).split("|").filter(Boolean) : [],
  bakiye: Math.round((Number(r.BAKIYE) || 0) * 10000) / 10000,
  resimVar: Number(r.RESIM_VAR) === 1,
});

export class TicariStokSqlRepository {
  static async havuz(ctx?: DbBaglam): Promise<sql.ConnectionPool> {
    const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
    await ticariSemaHazirla(pool);
    return pool;
  }

  // ───────────── Yetki ve ayarlar ─────────────

  /** Stok kartı / grup / giriş / Excel / ayar ekranları: sistem yöneticisi ya da yetki verilen kullanıcı (T21) */
  static async yonetebilirMi(kullaniciId: number | undefined, yonetici: boolean, ctx?: DbBaglam): Promise<boolean> {
    if (yonetici) return true;
    if (!kullaniciId) return false;
    const pool = await this.havuz(ctx);
    const r = await pool.request().input("ID", sql.Int, kullaniciId).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_YETKI WHERE KULLANICI_ID = @ID`);
    return r.recordset.length > 0;
  }

  static async eksiStokDavranisi(ctx?: DbBaglam, pool?: sql.ConnectionPool | sql.Transaction): Promise<EksiStokDavranisi> {
    const p = pool || (await this.havuz(ctx));
    const r = await new sql.Request(p as any).query(`SELECT DEGER FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'EKSI_STOK'`);
    const d = temiz(r.recordset[0]?.DEGER).toUpperCase();
    return d === "ENGELLE" || d === "SESSIZ" ? d : "UYAR";
  }

  static async ayarlar(ctx?: DbBaglam) {
    const pool = await this.havuz(ctx);
    const kullanicilar = await pool.request().query(`
      SELECT U.KULLANICI_ID, RTRIM(U.AD) AS AD, CAST(ISNULL(U.SISTEM_YONETICISI, 0) AS INT) AS YONETICI,
        CASE WHEN Y.KULLANICI_ID IS NULL THEN 0 ELSE 1 END AS YETKILI
      FROM dbo.TODVZ_KULLANICI U LEFT JOIN dbo.TODVZ_STOK_YETKI Y ON Y.KULLANICI_ID = U.KULLANICI_ID
      ORDER BY U.AD`);
    return {
      eksiStok: await this.eksiStokDavranisi(ctx, pool),
      kullanicilar: kullanicilar.recordset.map((r: any) => ({
        kullaniciId: r.KULLANICI_ID,
        ad: temiz(r.AD),
        yonetici: Number(r.YONETICI) === 1,
        yetkili: Number(r.YETKILI) === 1,
      })),
    };
  }

  static async ayarKaydet(girdi: { eksiStok?: string; yetkiliKullanicilar?: number[] }, kullaniciId: number | undefined, ctx?: DbBaglam) {
    const pool = await this.havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      if (girdi.eksiStok !== undefined) {
        const d = temiz(girdi.eksiStok).toUpperCase();
        if (!["UYAR", "ENGELLE", "SESSIZ"].includes(d)) throw ApiError.badRequest("Eksi stok davranışı UYAR, ENGELLE ya da SESSIZ olmalı.");
        await new sql.Request(tx).input("D", sql.NVarChar(200), d).query(`
          IF EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'EKSI_STOK') UPDATE dbo.TODVZ_STOK_AYAR SET DEGER = @D WHERE ANAHTAR = 'EKSI_STOK'
          ELSE INSERT INTO dbo.TODVZ_STOK_AYAR (ANAHTAR, DEGER) VALUES ('EKSI_STOK', @D);`);
      }
      if (Array.isArray(girdi.yetkiliKullanicilar)) {
        await new sql.Request(tx).query(`DELETE FROM dbo.TODVZ_STOK_YETKI`);
        for (const id of [...new Set(girdi.yetkiliKullanicilar.map(Number).filter((x) => x > 0))]) {
          await new sql.Request(tx).input("ID", sql.Int, id).input("E", sql.Int, kullaniciId || null)
            .query(`IF EXISTS (SELECT 1 FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = @ID) INSERT INTO dbo.TODVZ_STOK_YETKI (KULLANICI_ID, EKLEYEN_ID) VALUES (@ID, @E)`);
        }
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
    return this.ayarlar(ctx);
  }

  // ───────────── Ürün grupları ─────────────

  static async gruplar(ctx?: DbBaglam): Promise<StokGrup[]> {
    const pool = await this.havuz(ctx);
    const r = await pool.request().query(`
      SELECT G.STOK_GRUP_ID, G.AD, G.AKTIF, (SELECT COUNT(*) FROM dbo.TODVZ_STOK_KART K WHERE K.STOK_GRUP_ID = G.STOK_GRUP_ID) AS KART_SAYISI
      FROM dbo.TODVZ_STOK_GRUP G ORDER BY G.AD`);
    return r.recordset.map((x: any) => ({ stokGrupId: x.STOK_GRUP_ID, ad: temiz(x.AD), aktif: x.AKTIF === true || x.AKTIF === 1, kartSayisi: Number(x.KART_SAYISI) || 0 }));
  }

  static async grupKaydet(g: { stokGrupId?: number | null; ad?: string; aktif?: boolean }, kullaniciId: number | undefined, ctx?: DbBaglam): Promise<StokGrup> {
    const ad = temiz(g.ad);
    if (!ad) throw ApiError.badRequest("Grup adı zorunlu.");
    if (ad.length > 100) throw ApiError.badRequest("Grup adı en çok 100 karakter olabilir.");
    const pool = await this.havuz(ctx);
    const ayni = await pool.request().input("AD", sql.NVarChar(100), ad).input("ID", sql.Int, g.stokGrupId || 0)
      .query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_GRUP WHERE AD = @AD AND STOK_GRUP_ID <> @ID`);
    if (ayni.recordset.length) throw ApiError.badRequest(`"${ad}" adlı grup zaten var.`);
    let id = Number(g.stokGrupId) || 0;
    if (id) {
      const r = await pool.request().input("ID", sql.Int, id).input("AD", sql.NVarChar(100), ad).input("AKTIF", sql.Bit, g.aktif === false ? 0 : 1)
        .query(`UPDATE dbo.TODVZ_STOK_GRUP SET AD = @AD, AKTIF = @AKTIF WHERE STOK_GRUP_ID = @ID; SELECT @@ROWCOUNT AS N`);
      if (!Number(r.recordset[0]?.N)) throw ApiError.notFound("Grup bulunamadı.");
    } else {
      const r = await pool.request().input("AD", sql.NVarChar(100), ad).input("AKTIF", sql.Bit, g.aktif === false ? 0 : 1).input("E", sql.Int, kullaniciId || null)
        .query(`INSERT INTO dbo.TODVZ_STOK_GRUP (AD, AKTIF, EKLEYEN_ID) OUTPUT INSERTED.STOK_GRUP_ID VALUES (@AD, @AKTIF, @E)`);
      id = r.recordset[0].STOK_GRUP_ID;
    }
    return (await this.gruplar(ctx)).find((x) => x.stokGrupId === id)!;
  }

  static async grupSil(id: number, ctx?: DbBaglam): Promise<void> {
    const pool = await this.havuz(ctx);
    const n = Number((await pool.request().input("ID", sql.Int, id).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_STOK_KART WHERE STOK_GRUP_ID = @ID`)).recordset[0]?.N);
    if (n > 0) throw ApiError.badRequest(`Bu gruba bağlı ${n} stok kartı var; önce kartların grubunu değiştirin ya da grubu pasif yapın.`);
    const r = await pool.request().input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_GRUP WHERE STOK_GRUP_ID = @ID; SELECT @@ROWCOUNT AS N`);
    if (!Number(r.recordset[0]?.N)) throw ApiError.notFound("Grup bulunamadı.");
  }

  /** Grup adına göre bulur, yoksa açar (Excel yüklemesi) */
  static async grupBulVeyaAc(tx: sql.Transaction, ad: string, kullaniciId?: number): Promise<number> {
    const r = await new sql.Request(tx).input("AD", sql.NVarChar(100), ad.slice(0, 100)).input("E", sql.Int, kullaniciId || null).query(`
      DECLARE @ID INT = (SELECT TOP 1 STOK_GRUP_ID FROM dbo.TODVZ_STOK_GRUP WHERE AD = @AD);
      IF @ID IS NULL BEGIN INSERT INTO dbo.TODVZ_STOK_GRUP (AD, EKLEYEN_ID) VALUES (@AD, @E); SET @ID = SCOPE_IDENTITY(); END;
      SELECT @ID AS ID;`);
    return Number(r.recordset[0].ID);
  }

  // ───────────── Stok kartları ─────────────

  static async kartlar(f: { arama?: string; grupId?: number | null; aktif?: boolean | null; limit?: number } = {}, ctx?: DbBaglam): Promise<StokKart[]> {
    const pool = await this.havuz(ctx);
    const req = pool.request();
    const kosul: string[] = [];
    if (f.arama && temiz(f.arama)) {
      req.input("ARA", sql.NVarChar(210), `%${temiz(f.arama)}%`);
      kosul.push(`(K.KOD LIKE @ARA OR K.AD LIKE @ARA OR EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_BARKOD B WHERE B.STOK_KART_ID = K.STOK_KART_ID AND B.BARKOD LIKE @ARA))`);
    }
    if (f.grupId) { req.input("GRUP", sql.Int, f.grupId); kosul.push("K.STOK_GRUP_ID = @GRUP"); }
    if (f.aktif === true || f.aktif === false) { req.input("AKTIF", sql.Bit, f.aktif ? 1 : 0); kosul.push("K.AKTIF = @AKTIF"); }
    const limit = Math.min(Math.max(Number(f.limit) || 5000, 1), 20000);
    const r = await req.query(`${KART_SECIMI.replace("SELECT K.STOK_KART_ID", `SELECT TOP ${limit} K.STOK_KART_ID`)}
      ${kosul.length ? "WHERE " + kosul.join(" AND ") : ""} ORDER BY K.AD, K.KOD`);
    return r.recordset.map(kartModeli);
  }

  static async kart(id: number, ctx?: DbBaglam, resimle = false): Promise<StokKart | null> {
    const pool = await this.havuz(ctx);
    const r = await pool.request().input("ID", sql.Int, id).query(`${KART_SECIMI} WHERE K.STOK_KART_ID = @ID`);
    if (!r.recordset.length) return null;
    const k = kartModeli(r.recordset[0]);
    if (resimle && k.resimVar) k.resim = (await UrunResimSqlRepository.getResimlerByIslemId(STOK_RESIM_TIPI, id, ctx))[0] || null;
    return k;
  }

  /** Barkod ya da kod ile tam eşleşen kart (satış / giriş fişi okutması) */
  static async kartBul(deger: string, ctx?: DbBaglam): Promise<StokKart | null> {
    const t = temiz(deger);
    if (!t) return null;
    const pool = await this.havuz(ctx);
    const r = await pool.request().input("D", sql.VarChar(50), t.slice(0, 50)).query(`${KART_SECIMI}
      WHERE K.STOK_KART_ID = COALESCE((SELECT TOP 1 B.STOK_KART_ID FROM dbo.TODVZ_STOK_BARKOD B WHERE B.BARKOD = @D),
                                      (SELECT TOP 1 K2.STOK_KART_ID FROM dbo.TODVZ_STOK_KART K2 WHERE K2.KOD = @D))`);
    return r.recordset.length ? kartModeli(r.recordset[0]) : null;
  }

  /** Bir sonraki otomatik kod: STK00001 */
  static async yeniKod(pool: sql.ConnectionPool | sql.Transaction): Promise<string> {
    const r = await new sql.Request(pool as any).query(`
      SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(KOD, 4, 27) AS INT)), 0) + 1 AS N FROM dbo.TODVZ_STOK_KART WITH (UPDLOCK, HOLDLOCK)
      WHERE KOD LIKE 'STK%' AND TRY_CAST(SUBSTRING(KOD, 4, 27) AS INT) IS NOT NULL`);
    return `STK${String(Number(r.recordset[0].N) || 1).padStart(5, "0")}`;
  }

  /**
   * Kartı kaydeder (yeni ya da düzeltme). Açık işlem verilirse onun içinde çalışır (Excel yüklemesi), yoksa kendi işlemini açar.
   * Döner: kart kimliği.
   */
  static async kartYaz(tx: sql.Transaction, g: StokKartGirdi, kullaniciId?: number): Promise<number> {
    const { hatalar, deger: d } = kartGirdisiDenetle(g);
    if (hatalar.length) throw ApiError.badRequest(hatalar.join(" "));
    const id = Number(g.stokKartId) || 0;
    const kod = d.kod || (await this.yeniKod(tx));

    const ayniKod = await new sql.Request(tx).input("KOD", sql.VarChar(30), kod).input("ID", sql.Int, id)
      .query(`SELECT TOP 1 AD FROM dbo.TODVZ_STOK_KART WHERE KOD = @KOD AND STOK_KART_ID <> @ID`);
    if (ayniKod.recordset.length) throw ApiError.badRequest(`"${kod}" kodu "${temiz(ayniKod.recordset[0].AD)}" kartında kullanılıyor.`);
    for (const b of d.barkodlar) {
      const r = await new sql.Request(tx).input("B", sql.VarChar(50), b).input("ID", sql.Int, id).query(`
        SELECT TOP 1 RTRIM(K.KOD) + ' ' + K.AD AS KART FROM dbo.TODVZ_STOK_BARKOD B JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = B.STOK_KART_ID
        WHERE B.BARKOD = @B AND B.STOK_KART_ID <> @ID`);
      if (r.recordset.length) throw ApiError.badRequest(`"${b}" barkodu "${temiz(r.recordset[0].KART)}" kartında kullanılıyor.`);
    }
    if (d.stokGrupId) {
      const r = await new sql.Request(tx).input("G", sql.Int, d.stokGrupId).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_GRUP WHERE STOK_GRUP_ID = @G`);
      if (!r.recordset.length) throw ApiError.badRequest("Seçilen ürün grubu bulunamadı.");
    }
    if (d.paraId) {
      const r = await new sql.Request(tx).input("P", sql.Int, d.paraId).query(`SELECT 1 AS V FROM dbo.TODVZ_PARA WHERE PARA_ID = @P`);
      if (!r.recordset.length) throw ApiError.badRequest("Seçilen para birimi bulunamadı.");
    }

    const req = new sql.Request(tx)
      .input("ID", sql.Int, id)
      .input("KOD", sql.VarChar(30), kod)
      .input("AD", sql.NVarChar(200), d.ad)
      .input("GRUP", sql.Int, d.stokGrupId)
      .input("BIRIM", sql.VarChar(20), d.birim)
      .input("KDV", sql.Float, d.kdvOrani)
      .input("SATIS", sql.Float, d.satisFiyati)
      .input("DAHIL", sql.Bit, d.fiyatKdvDahil ? 1 : 0)
      .input("PARA", sql.Int, d.paraId)
      .input("ALIS", sql.Float, d.alisFiyati)
      .input("ENAZ", sql.Float, d.enAzStok)
      .input("AKTIF", sql.Bit, d.aktif ? 1 : 0)
      .input("ACIKLAMA", sql.NVarChar(500), d.aciklama)
      .input("KUL", sql.Int, kullaniciId || null);
    let yeniId = id;
    if (id) {
      const r = await req.query(`
        UPDATE dbo.TODVZ_STOK_KART SET KOD = @KOD, AD = @AD, STOK_GRUP_ID = @GRUP, BIRIM = @BIRIM, KDV_ORANI = @KDV, SATIS_FIYATI = @SATIS,
          FIYAT_KDV_DAHIL = @DAHIL, PARA_ID = @PARA, ALIS_FIYATI = @ALIS, EN_AZ_STOK = @ENAZ, AKTIF = @AKTIF, ACIKLAMA = @ACIKLAMA,
          GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE()
        WHERE STOK_KART_ID = @ID;
        SELECT @@ROWCOUNT AS N;`);
      if (!Number(r.recordset[0]?.N)) throw ApiError.notFound("Stok kartı bulunamadı.");
      // Hareket görmüş kartın birimi değişmez: eski miktarlar başka birimde kalır
      const birimDegisti = await new sql.Request(tx).input("ID", sql.Int, id).input("BIRIM", sql.VarChar(20), d.birim).query(`
        SELECT TOP 1 1 AS V FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_STOK_GIRIS_SATIRI S ON H.BELGE_TURU = 1 AND S.STOK_GIRIS_ID = H.BELGE_ID AND S.SATIR_NO = H.SATIR_NO
        WHERE H.STOK_KART_ID = @ID AND S.BIRIM <> @BIRIM
        UNION ALL
        SELECT TOP 1 1 FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_FATURA_SATIRI S ON H.BELGE_TURU = 2 AND S.FATURA_ID = H.BELGE_ID AND S.SATIR_NO = H.SATIR_NO
        WHERE H.STOK_KART_ID = @ID AND S.BIRIM <> @BIRIM`);
      if (birimDegisti.recordset.length) throw ApiError.badRequest("Hareket görmüş kartın birimi değiştirilemez; yeni birim için yeni kart açın.");
    } else {
      const r = await req.query(`
        INSERT INTO dbo.TODVZ_STOK_KART (KOD, AD, STOK_GRUP_ID, BIRIM, KDV_ORANI, SATIS_FIYATI, FIYAT_KDV_DAHIL, PARA_ID, ALIS_FIYATI, EN_AZ_STOK, AKTIF, ACIKLAMA, EKLEYEN_ID)
        OUTPUT INSERTED.STOK_KART_ID
        VALUES (@KOD, @AD, @GRUP, @BIRIM, @KDV, @SATIS, @DAHIL, @PARA, @ALIS, @ENAZ, @AKTIF, @ACIKLAMA, @KUL);`);
      yeniId = r.recordset[0].STOK_KART_ID;
    }
    await new sql.Request(tx).input("ID", sql.Int, yeniId).query(`DELETE FROM dbo.TODVZ_STOK_BARKOD WHERE STOK_KART_ID = @ID`);
    for (const b of d.barkodlar) {
      await new sql.Request(tx).input("ID", sql.Int, yeniId).input("B", sql.VarChar(50), b)
        .query(`INSERT INTO dbo.TODVZ_STOK_BARKOD (STOK_KART_ID, BARKOD) VALUES (@ID, @B)`);
    }
    return yeniId;
  }

  static async kartKaydet(g: StokKartGirdi, kullaniciId: number | undefined, ctx?: DbBaglam): Promise<StokKart> {
    const pool = await this.havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    let id = 0;
    try {
      id = await this.kartYaz(tx, g, kullaniciId);
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
    if (g.resim !== undefined) await this.resimYaz(id, g.resim, ctx);
    return (await this.kart(id, ctx, true))!;
  }

  static async resimYaz(id: number, resim: string | null, ctx?: DbBaglam): Promise<void> {
    const pool = await this.havuz(ctx);
    const liste = resim ? [resim] : [];
    const yollar = await UrunResimSqlRepository.syncResimlerForIslem(STOK_RESIM_TIPI, id, liste, ctx);
    await pool.request().input("ID", sql.Int, id).input("R", sql.NVarChar(260), liste.length && yollar.length ? "1" : null)
      .query(`UPDATE dbo.TODVZ_STOK_KART SET RESIM = @R WHERE STOK_KART_ID = @ID`);
  }

  static async kartSil(id: number, ctx?: DbBaglam): Promise<void> {
    const pool = await this.havuz(ctx);
    const r = await pool.request().input("ID", sql.Int, id).query(`
      SELECT (SELECT COUNT(*) FROM dbo.TODVZ_STOK_HAREKET WHERE STOK_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_STOK_GIRIS_SATIRI WHERE STOK_KART_ID = @ID)
           + (SELECT COUNT(*) FROM dbo.TODVZ_FATURA_SATIRI WHERE STOK_KART_ID = @ID) AS N`);
    if (Number(r.recordset[0]?.N) > 0) throw ApiError.badRequest("Hareket görmüş stok kartı silinemez; kartı pasif yapın.");
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_BARKOD WHERE STOK_KART_ID = @ID`);
      const s = await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID = @ID; SELECT @@ROWCOUNT AS N`);
      if (!Number(s.recordset[0]?.N)) throw ApiError.notFound("Stok kartı bulunamadı.");
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
    await UrunResimSqlRepository.syncResimlerForIslem(STOK_RESIM_TIPI, id, [], ctx).catch(() => undefined);
  }

  // ───────────── Raporlar ─────────────

  /** Stok Durum Listesi: tarih itibarıyla giriş / çıkış / kalan, son alış fiyatıyla değer, en az stok uyarısı */
  static async stokDurum(f: { tarih?: string | null; grupId?: number | null; arama?: string | null; yalnizEksik?: boolean; pasifler?: boolean } = {}, ctx?: DbBaglam) {
    const pool = await this.havuz(ctx);
    const req = pool.request();
    const kosul: string[] = [];
    req.input("TARIH", sql.VarChar(10), f.tarih ? temiz(f.tarih).slice(0, 10) : null);
    if (!f.pasifler) kosul.push("K.AKTIF = 1");
    if (f.grupId) { req.input("GRUP", sql.Int, f.grupId); kosul.push("K.STOK_GRUP_ID = @GRUP"); }
    if (f.arama && temiz(f.arama)) {
      req.input("ARA", sql.NVarChar(210), `%${temiz(f.arama)}%`);
      kosul.push(`(K.KOD LIKE @ARA OR K.AD LIKE @ARA OR EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_BARKOD B WHERE B.STOK_KART_ID = K.STOK_KART_ID AND B.BARKOD LIKE @ARA))`);
    }
    const r = await req.query(`
      SELECT K.STOK_KART_ID, K.KOD, K.AD, G.AD AS GRUP_ADI, K.BIRIM, K.EN_AZ_STOK, K.AKTIF,
        ISNULL(H.GIRIS, 0) AS GIRIS, ISNULL(H.CIKIS, 0) AS CIKIS, ISNULL(H.GIRIS, 0) - ISNULL(H.CIKIS, 0) AS BAKIYE,
        COALESCE(K.SON_ALIS_FIYATI, K.ALIS_FIYATI) AS MALIYET, K.SATIS_FIYATI, K.FIYAT_KDV_DAHIL, K.KDV_ORANI, H.SON_HAREKET
      FROM dbo.TODVZ_STOK_KART K
      LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID
      OUTER APPLY (SELECT SUM(X.GIRIS) AS GIRIS, SUM(X.CIKIS) AS CIKIS, MAX(X.TARIH) AS SON_HAREKET FROM dbo.TODVZ_STOK_HAREKET X
                   WHERE X.STOK_KART_ID = K.STOK_KART_ID AND (@TARIH IS NULL OR CAST(DATEADD(hour, 3, X.TARIH) AS date) <= CAST(@TARIH AS date))) H
      ${kosul.length ? "WHERE " + kosul.join(" AND ") : ""}
      ORDER BY G.AD, K.AD`);
    const y4 = (n: unknown) => Math.round((Number(n) || 0) * 10000) / 10000;
    const satirlar = r.recordset
      .map((x: any) => {
        const bakiye = y4(x.BAKIYE);
        const maliyet = x.MALIYET === null || x.MALIYET === undefined ? null : Number(x.MALIYET);
        const enAz = x.EN_AZ_STOK === null || x.EN_AZ_STOK === undefined ? null : Number(x.EN_AZ_STOK);
        return {
          stokKartId: x.STOK_KART_ID,
          kod: temiz(x.KOD),
          ad: temiz(x.AD),
          grupAdi: x.GRUP_ADI ? temiz(x.GRUP_ADI) : "",
          birim: temiz(x.BIRIM),
          giris: y4(x.GIRIS),
          cikis: y4(x.CIKIS),
          bakiye,
          enAzStok: enAz,
          eksik: enAz !== null && bakiye < enAz,
          maliyet,
          deger: maliyet === null ? null : Math.round(bakiye * maliyet * 100) / 100,
          sonHareket: x.SON_HAREKET ? new Date(x.SON_HAREKET).toISOString() : null,
          aktif: x.AKTIF === true || x.AKTIF === 1,
        };
      })
      .filter((s: any) => !f.yalnizEksik || s.eksik || s.bakiye < 0);
    return {
      satirlar,
      toplam: {
        kart: satirlar.length,
        deger: Math.round(satirlar.reduce((a: number, s: any) => a + (s.deger || 0), 0) * 100) / 100,
        eksik: satirlar.filter((s: any) => s.eksik).length,
        eksiBakiye: satirlar.filter((s: any) => s.bakiye < 0).length,
      },
    };
  }

  /** Ürün Hareket Listesi: kartın (ya da tüm kartların) tarih aralığındaki giriş / çıkışları, devir ve yürüyen bakiye */
  static async hareketler(f: { stokKartId?: number | null; baslangic?: string | null; bitis?: string | null; belgeTuru?: number | null; grupId?: number | null } = {}, ctx?: DbBaglam) {
    const pool = await this.havuz(ctx);
    const req = pool.request();
    const bas = f.baslangic ? temiz(f.baslangic).slice(0, 10) : null;
    const bit = f.bitis ? temiz(f.bitis).slice(0, 10) : null;
    req.input("BAS", sql.VarChar(10), bas).input("BIT", sql.VarChar(10), bit);
    const kosul: string[] = [];
    if (f.stokKartId) { req.input("KART", sql.Int, f.stokKartId); kosul.push("H.STOK_KART_ID = @KART"); }
    if (f.grupId) { req.input("GRUP", sql.Int, f.grupId); kosul.push("K.STOK_GRUP_ID = @GRUP"); }
    const turKosulu = f.belgeTuru ? (req.input("TUR", sql.TinyInt, f.belgeTuru), " AND H.BELGE_TURU = @TUR") : "";
    const gun = "CAST(DATEADD(hour, 3, H.TARIH) AS date)";
    const r = await req.query(`
      ;WITH D AS (
        SELECT H.STOK_KART_ID, SUM(H.GIRIS - H.CIKIS) AS DEVIR FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = H.STOK_KART_ID
        WHERE @BAS IS NOT NULL AND ${gun} < CAST(@BAS AS date) ${kosul.length ? "AND " + kosul.join(" AND ") : ""}
        GROUP BY H.STOK_KART_ID
      )
      SELECT H.STOK_HAREKET_ID, H.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, K.BIRIM, H.TARIH, H.BELGE_TURU, H.BELGE_ID, H.SATIR_NO,
        H.GIRIS, H.CIKIS, H.BIRIM_FIYAT, ISNULL(D.DEVIR, 0) AS DEVIR,
        CASE H.BELGE_TURU WHEN 1 THEN SG.FIS_NO ELSE F.FATURA_NO END AS BELGE_NO,
        CASE H.BELGE_TURU WHEN 1 THEN COALESCE(C.AD, SG.ACIKLAMA) ELSE F.ALICI_UNVAN END AS KARSI_TARAF
      FROM dbo.TODVZ_STOK_HAREKET H
      JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = H.STOK_KART_ID
      LEFT JOIN D ON D.STOK_KART_ID = H.STOK_KART_ID
      LEFT JOIN dbo.TODVZ_STOK_GIRIS SG ON H.BELGE_TURU = 1 AND SG.STOK_GIRIS_ID = H.BELGE_ID
      LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = SG.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_FATURA F ON H.BELGE_TURU = 2 AND F.FATURA_ID = H.BELGE_ID
      WHERE (@BAS IS NULL OR ${gun} >= CAST(@BAS AS date)) AND (@BIT IS NULL OR ${gun} <= CAST(@BIT AS date))${turKosulu}
        ${kosul.length ? "AND " + kosul.join(" AND ") : ""}
      ORDER BY K.AD, K.STOK_KART_ID, H.TARIH, H.STOK_HAREKET_ID`);
    const y4 = (n: unknown) => Math.round((Number(n) || 0) * 10000) / 10000;
    const bakiyeler = new Map<number, number>();
    const satirlar = r.recordset.map((x: any) => {
      // Belge türü süzgecinde yürüyen bakiye anlamsızdır; yalnız süzgeçsizken hesaplanır
      const onceki = bakiyeler.has(x.STOK_KART_ID) ? bakiyeler.get(x.STOK_KART_ID)! : y4(x.DEVIR);
      const bakiye = y4(onceki + Number(x.GIRIS) - Number(x.CIKIS));
      bakiyeler.set(x.STOK_KART_ID, bakiye);
      return {
        stokHareketId: x.STOK_HAREKET_ID,
        stokKartId: x.STOK_KART_ID,
        kod: temiz(x.KOD),
        ad: temiz(x.AD),
        birim: temiz(x.BIRIM),
        tarih: new Date(x.TARIH).toISOString(),
        belgeTuru: Number(x.BELGE_TURU),
        belgeTuruAdi: STOK_BELGE_ADI[Number(x.BELGE_TURU)] || "",
        belgeId: x.BELGE_ID,
        belgeNo: temiz(x.BELGE_NO),
        karsiTaraf: temiz(x.KARSI_TARAF),
        giris: y4(x.GIRIS),
        cikis: y4(x.CIKIS),
        birimFiyat: x.BIRIM_FIYAT === null || x.BIRIM_FIYAT === undefined ? null : Number(x.BIRIM_FIYAT),
        bakiye: f.belgeTuru ? null : bakiye,
      };
    });
    const devirler = f.belgeTuru || !bas ? [] : (await (async () => {
      const q = pool.request().input("BAS", sql.VarChar(10), bas);
      const k2: string[] = [];
      if (f.stokKartId) { q.input("KART", sql.Int, f.stokKartId); k2.push("H.STOK_KART_ID = @KART"); }
      if (f.grupId) { q.input("GRUP", sql.Int, f.grupId); k2.push("K.STOK_GRUP_ID = @GRUP"); }
      const d = await q.query(`SELECT H.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, K.BIRIM, SUM(H.GIRIS - H.CIKIS) AS DEVIR
        FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = H.STOK_KART_ID
        WHERE ${gun} < CAST(@BAS AS date) ${k2.length ? "AND " + k2.join(" AND ") : ""} GROUP BY H.STOK_KART_ID, K.KOD, K.AD, K.BIRIM`);
      return d.recordset.map((x: any) => ({ stokKartId: x.STOK_KART_ID, kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM), devir: y4(x.DEVIR) }));
    })());
    return {
      satirlar,
      devirler,
      toplam: {
        giris: y4(satirlar.reduce((a: number, s: any) => a + s.giris, 0)),
        cikis: y4(satirlar.reduce((a: number, s: any) => a + s.cikis, 0)),
      },
    };
  }
}

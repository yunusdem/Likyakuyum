import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { DbBaglam } from "./ticariStokSql.repository.js";
import { AdisyonTanimSqlRepository } from "./adisyonTanimSql.repository.js";
import { SEVIYE, ekYetkiMetni, yetkiKumesi } from "../services/adisyon/adisyonHesap.js";

/**
 * Adisyon tanımları (docs/TICARI_ADISYON_YOL_HARITASI.md, D2): bölge + masa (TA26, TA31), hazırlık yeri + ürün grubu bağı (TA30),
 * seçenek grupları + karta bağlama, porsiyon (TA28), garson (TA23–TA25). Kullanılmış kayıt silinmez, pasif yapılır.
 */
const temiz = (v: unknown): string => String(v ?? "").trim();
const sayi = (v: unknown): number => { if (typeof v === "string") v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v; return Number(v); };
const havuz = (ctx?: DbBaglam) => AdisyonTanimSqlRepository.havuz(ctx);

async function islem<T>(ctx: DbBaglam | undefined, f: (tx: sql.Transaction) => Promise<T>): Promise<T> {
  const pool = await havuz(ctx);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const r = await f(tx);
    await tx.commit();
    return r;
  } catch (e) {
    await tx.rollback().catch(() => undefined);
    throw e;
  }
}
const tekilHatasi = (e: any, mesaj: string) => { if (/UQ_|UNIQUE|duplicate/i.test(String(e?.message || e))) throw ApiError.badRequest(mesaj); throw e; };

export interface MasaTanim { masaId: number; bolgeId: number; ad: string; sira: number; kisi: number | null; aktif: boolean }
export interface BolgeTanim { bolgeId: number; ad: string; sira: number; fiyatListesiId: number | null; fiyatListesiAd: string | null; aktif: boolean; masalar: MasaTanim[] }

/** Sıra: boş = düzeltmede eskisi korunur, yeni kayıtta sona eklenir */
const siraOku = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 99999) throw ApiError.badRequest("Sıra 0 ile 99999 arasında tam sayı olmalı.");
  return n;
};

export class AdisyonTanimlarSqlRepository {
  // ───────────── Bölge / masa ─────────────
  static async bolgeler(ctx?: DbBaglam, yalnizAktif = false): Promise<BolgeTanim[]> {
    const pool = await havuz(ctx);
    const r = await pool.request().query(`
      SELECT B.BOLGE_ID, B.AD, B.SIRA, B.FIYAT_LISTESI_ID, L.AD AS LISTE_AD, B.AKTIF FROM dbo.TODVZ_ADISYON_BOLGE B
        LEFT JOIN dbo.TODVZ_STOK_FIYAT_LISTESI L ON L.FIYAT_LISTESI_ID = B.FIYAT_LISTESI_ID ${yalnizAktif ? "WHERE B.AKTIF = 1" : ""} ORDER BY B.SIRA, B.AD;
      SELECT MASA_ID, BOLGE_ID, AD, SIRA, KISI, AKTIF FROM dbo.TODVZ_ADISYON_MASA ${yalnizAktif ? "WHERE AKTIF = 1" : ""} ORDER BY SIRA, MASA_ID;`);
    const rs = r.recordsets as any[];
    const masalar = rs[1].map((x: any): MasaTanim => ({ masaId: Number(x.MASA_ID), bolgeId: Number(x.BOLGE_ID), ad: temiz(x.AD), sira: Number(x.SIRA), kisi: x.KISI ?? null, aktif: !!x.AKTIF }));
    return rs[0].map((x: any): BolgeTanim => ({ bolgeId: Number(x.BOLGE_ID), ad: temiz(x.AD), sira: Number(x.SIRA), fiyatListesiId: x.FIYAT_LISTESI_ID ?? null, fiyatListesiAd: x.LISTE_AD ? temiz(x.LISTE_AD) : null,
      aktif: !!x.AKTIF, masalar: masalar.filter((m: MasaTanim) => m.bolgeId === Number(x.BOLGE_ID)) }));
  }

  static async bolgeKaydet(g: { bolgeId?: number | null; ad: string; sira?: number | null; fiyatListesiId?: number | null; aktif?: boolean }, ctx?: DbBaglam) {
    const ad = temiz(g.ad).slice(0, 50);
    if (!ad) throw ApiError.badRequest("Bölge adı yazılmalı.");
    const sira = siraOku(g.sira);
    return islem(ctx, async (tx) => {
      if (g.fiyatListesiId) {
        const l = await new sql.Request(tx).input("L", sql.Int, g.fiyatListesiId).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_FIYAT_LISTESI WHERE FIYAT_LISTESI_ID = @L`);
        if (!l.recordset.length) throw ApiError.badRequest("Seçilen fiyat listesi bulunamadı.");
      }
      const req = new sql.Request(tx).input("ID", sql.Int, Number(g.bolgeId) || 0).input("AD", sql.NVarChar(50), ad).input("S", sql.Int, sira)
        .input("L", sql.Int, Number(g.fiyatListesiId) || null).input("A", sql.Bit, g.aktif === false ? 0 : 1);
      try {
        if (g.bolgeId) {
          if (g.aktif === false) {
            const a = await new sql.Request(tx).input("ID", sql.Int, Number(g.bolgeId)).query(`SELECT TOP 1 RTRIM(A.ADISYON_NO) AS NO, RTRIM(M.AD) AS MASA FROM dbo.TODVZ_ADISYON A JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID WHERE M.BOLGE_ID = @ID AND A.DURUM IN (0, 1)`);
            if (a.recordset.length) throw ApiError.badRequest(`Bölgede açık adisyon var (masa ${temiz(a.recordset[0].MASA)}, ${temiz(a.recordset[0].NO)}); kapatmadan pasif yapılamaz.`);
          }
          const u = await req.query(`UPDATE dbo.TODVZ_ADISYON_BOLGE SET AD = @AD, SIRA = ISNULL(@S, SIRA), FIYAT_LISTESI_ID = @L, AKTIF = @A WHERE BOLGE_ID = @ID; SELECT @@ROWCOUNT AS N;`);
          if (!Number(u.recordset[0].N)) throw ApiError.notFound("Bölge bulunamadı.");
          return Number(g.bolgeId);
        }
        return Number((await req.query(`INSERT INTO dbo.TODVZ_ADISYON_BOLGE (AD, SIRA, FIYAT_LISTESI_ID, AKTIF) OUTPUT INSERTED.BOLGE_ID
          VALUES (@AD, ISNULL(@S, (SELECT ISNULL(MAX(SIRA), 0) + 1 FROM dbo.TODVZ_ADISYON_BOLGE WITH (UPDLOCK, HOLDLOCK))), @L, @A)`)).recordset[0].BOLGE_ID);
      } catch (e) { return tekilHatasi(e, `"${ad}" adında bir bölge zaten var.`); }
    });
  }

  /** Masası adisyon görmüş bölge silinmez (pasif yapılır); masasız ya da hiç kullanılmamış bölge silinir */
  static async bolgeSil(id: number, ctx?: DbBaglam): Promise<{ silindi: boolean }> {
    return islem(ctx, async (tx) => {
      const k = (await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_BOLGE WITH (UPDLOCK) WHERE BOLGE_ID = @ID) AS V,
        (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON A JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID WHERE M.BOLGE_ID = @ID) AS K`)).recordset[0];
      if (!Number(k.V)) throw ApiError.notFound("Bölge bulunamadı.");
      const acik = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT TOP 1 RTRIM(A.ADISYON_NO) AS NO, RTRIM(M.AD) AS MASA FROM dbo.TODVZ_ADISYON A JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID WHERE M.BOLGE_ID = @ID AND A.DURUM IN (0, 1)`);
      if (acik.recordset.length) throw ApiError.badRequest(`Bölgede açık adisyon var (masa ${temiz(acik.recordset[0].MASA)}, ${temiz(acik.recordset[0].NO)}); kapatmadan silinemez / pasif yapılamaz.`);
      if (Number(k.K) > 0) {
        await new sql.Request(tx).input("ID", sql.Int, id).query(`UPDATE dbo.TODVZ_ADISYON_BOLGE SET AKTIF = 0 WHERE BOLGE_ID = @ID; UPDATE dbo.TODVZ_ADISYON_MASA SET AKTIF = 0 WHERE BOLGE_ID = @ID;`);
        return { silindi: false };
      }
      await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_ADISYON_MASA WHERE BOLGE_ID = @ID; DELETE FROM dbo.TODVZ_ADISYON_BOLGE WHERE BOLGE_ID = @ID;`);
      return { silindi: true };
    });
  }

  static async masaKaydet(g: { masaId?: number | null; bolgeId: number; ad: string; sira?: number | null; kisi?: number | null; aktif?: boolean }, ctx?: DbBaglam) {
    const ad = temiz(g.ad).slice(0, 30);
    if (!ad) throw ApiError.badRequest("Masa adı / numarası yazılmalı.");
    const kisi = g.kisi === null || g.kisi === undefined || String(g.kisi) === "" ? null : Number(g.kisi);
    if (kisi !== null && (!Number.isInteger(kisi) || kisi < 1 || kisi > 100)) throw ApiError.badRequest("Kişi sayısı 1 ile 100 arasında tam sayı olmalı.");
    const sira = siraOku(g.sira);
    return islem(ctx, async (tx) => {
      const b = await new sql.Request(tx).input("B", sql.Int, g.bolgeId).query(`SELECT 1 AS V FROM dbo.TODVZ_ADISYON_BOLGE WHERE BOLGE_ID = @B`);
      if (!b.recordset.length) throw ApiError.badRequest("Bölge bulunamadı.");
      const req = new sql.Request(tx).input("ID", sql.Int, Number(g.masaId) || 0).input("B", sql.Int, g.bolgeId).input("AD", sql.NVarChar(30), ad).input("S", sql.Int, sira)
        .input("K", sql.Int, kisi).input("A", sql.Bit, g.aktif === false ? 0 : 1);
      try {
        if (g.masaId) {
          // Açık adisyonu olan masa pasif yapılamaz / bölgesi değişebilir (masa aynı kalır)
          if (g.aktif === false) {
            const a = await new sql.Request(tx).input("ID", sql.Int, g.masaId).query(`SELECT TOP 1 ADISYON_NO FROM dbo.TODVZ_ADISYON WHERE MASA_ID = @ID AND DURUM IN (0, 1)`);
            if (a.recordset.length) throw ApiError.badRequest(`Masada açık adisyon var (${temiz(a.recordset[0].ADISYON_NO)}); kapatmadan pasif yapılamaz.`);
          }
          const u = await req.query(`UPDATE dbo.TODVZ_ADISYON_MASA SET BOLGE_ID = @B, AD = @AD, SIRA = ISNULL(@S, SIRA), KISI = @K, AKTIF = @A WHERE MASA_ID = @ID; SELECT @@ROWCOUNT AS N;`);
          if (!Number(u.recordset[0].N)) throw ApiError.notFound("Masa bulunamadı.");
          return Number(g.masaId);
        }
        return Number((await req.query(`INSERT INTO dbo.TODVZ_ADISYON_MASA (BOLGE_ID, AD, SIRA, KISI, AKTIF) OUTPUT INSERTED.MASA_ID
          VALUES (@B, @AD, ISNULL(@S, (SELECT ISNULL(MAX(SIRA), 0) + 1 FROM dbo.TODVZ_ADISYON_MASA WITH (UPDLOCK, HOLDLOCK) WHERE BOLGE_ID = @B)), @K, @A)`)).recordset[0].MASA_ID);
      } catch (e) { return tekilHatasi(e, `Bu bölgede "${ad}" adında bir masa zaten var.`); }
    });
  }

  /** Toplu masa: "önek + numara" (1..n); bölgede var olan adlar atlanır */
  static async masaTopluEkle(g: { bolgeId: number; baslangic: number; bitis: number; onEk?: string | null; kisi?: number | null }, ctx?: DbBaglam) {
    const bas = Math.trunc(Number(g.baslangic)), bit = Math.trunc(Number(g.bitis));
    if (!(bas >= 1) || !(bit >= bas) || bit - bas > 199) throw ApiError.badRequest("Masa numaraları 1'den başlamalı, en çok 200 masa birden eklenir.");
    const onEk = temiz(g.onEk).slice(0, 20);
    return islem(ctx, async (tx) => {
      const b = await new sql.Request(tx).input("B", sql.Int, g.bolgeId).query(`SELECT 1 AS V FROM dbo.TODVZ_ADISYON_BOLGE WITH (UPDLOCK) WHERE BOLGE_ID = @B`);
      if (!b.recordset.length) throw ApiError.badRequest("Bölge bulunamadı.");
      const varOlan = new Set((await new sql.Request(tx).input("B", sql.Int, g.bolgeId).query(`SELECT AD FROM dbo.TODVZ_ADISYON_MASA WHERE BOLGE_ID = @B`)).recordset.map((x: any) => temiz(x.AD).toLocaleLowerCase("tr-TR")));
      let eklenen = 0;
      for (let n = bas; n <= bit; n++) {
        const ad = `${onEk}${onEk && !onEk.endsWith(" ") ? " " : ""}${n}`.trim();
        if (varOlan.has(ad.toLocaleLowerCase("tr-TR"))) continue;
        await new sql.Request(tx).input("B", sql.Int, g.bolgeId).input("AD", sql.NVarChar(30), ad).input("S", sql.Int, n).input("K", sql.Int, Number(g.kisi) || null)
          .query(`INSERT INTO dbo.TODVZ_ADISYON_MASA (BOLGE_ID, AD, SIRA, KISI) VALUES (@B, @AD, @S, @K)`);
        eklenen++;
      }
      return { eklenen, atlanan: bit - bas + 1 - eklenen };
    });
  }

  static async masaSil(id: number, ctx?: DbBaglam): Promise<{ silindi: boolean }> {
    return islem(ctx, async (tx) => {
      const k = (await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_MASA WITH (UPDLOCK) WHERE MASA_ID = @ID) AS V,
        (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON WHERE MASA_ID = @ID) AS K, (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON WHERE MASA_ID = @ID AND DURUM IN (0, 1)) AS ACIK`)).recordset[0];
      if (!Number(k.V)) throw ApiError.notFound("Masa bulunamadı.");
      if (Number(k.ACIK) > 0) throw ApiError.badRequest("Masada açık adisyon var; kapatmadan silinemez.");
      if (Number(k.K) > 0) { await new sql.Request(tx).input("ID", sql.Int, id).query(`UPDATE dbo.TODVZ_ADISYON_MASA SET AKTIF = 0 WHERE MASA_ID = @ID`); return { silindi: false }; }
      await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_ADISYON_MASA WHERE MASA_ID = @ID`);
      return { silindi: true };
    });
  }

  // ───────────── Hazırlık yeri ─────────────
  static async yerler(ctx?: DbBaglam) {
    const pool = await havuz(ctx);
    const r = await pool.request().query(`SELECT Y.YER_ID, Y.AD, Y.YAZICI, Y.EKRAN, Y.AKTIF, (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_GRUP_YER G WHERE G.YER_ID = Y.YER_ID) AS GRUP
      FROM dbo.TODVZ_ADISYON_HAZIRLIK Y ORDER BY Y.AD`);
    return r.recordset.map((x: any) => ({ yerId: Number(x.YER_ID), ad: temiz(x.AD), yazici: x.YAZICI ? temiz(x.YAZICI) : null, ekran: !!x.EKRAN, aktif: !!x.AKTIF, grupSayisi: Number(x.GRUP) }));
  }

  static async yerKaydet(g: { yerId?: number | null; ad: string; yazici?: string | null; ekran?: boolean; aktif?: boolean }, ctx?: DbBaglam) {
    const ad = temiz(g.ad).slice(0, 50);
    if (!ad) throw ApiError.badRequest("Hazırlık yeri adı yazılmalı.");
    const yazici = temiz(g.yazici).slice(0, 200) || null;
    if (!yazici && g.ekran === false) throw ApiError.badRequest("Hazırlık yerinde yazıcı ya da mutfak ekranından en az biri olmalı.");
    return islem(ctx, async (tx) => {
      const req = new sql.Request(tx).input("ID", sql.Int, Number(g.yerId) || 0).input("AD", sql.NVarChar(50), ad).input("Y", sql.NVarChar(200), yazici)
        .input("E", sql.Bit, g.ekran === false ? 0 : 1).input("A", sql.Bit, g.aktif === false ? 0 : 1);
      try {
        if (g.yerId) {
          const u = await req.query(`UPDATE dbo.TODVZ_ADISYON_HAZIRLIK SET AD = @AD, YAZICI = @Y, EKRAN = @E, AKTIF = @A WHERE YER_ID = @ID; SELECT @@ROWCOUNT AS N;`);
          if (!Number(u.recordset[0].N)) throw ApiError.notFound("Hazırlık yeri bulunamadı.");
          return Number(g.yerId);
        }
        return Number((await req.query(`INSERT INTO dbo.TODVZ_ADISYON_HAZIRLIK (AD, YAZICI, EKRAN, AKTIF) OUTPUT INSERTED.YER_ID VALUES (@AD, @Y, @E, @A)`)).recordset[0].YER_ID);
      } catch (e) { return tekilHatasi(e, `"${ad}" adında bir hazırlık yeri zaten var.`); }
    });
  }

  static async yerSil(id: number, ctx?: DbBaglam): Promise<{ silindi: boolean }> {
    return islem(ctx, async (tx) => {
      const k = (await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_HAZIRLIK WITH (UPDLOCK) WHERE YER_ID = @ID) AS V,
        (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_KALEM WHERE YER_ID = @ID) AS K`)).recordset[0];
      if (!Number(k.V)) throw ApiError.notFound("Hazırlık yeri bulunamadı.");
      await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_ADISYON_GRUP_YER WHERE YER_ID = @ID`);
      if (Number(k.K) > 0) { await new sql.Request(tx).input("ID", sql.Int, id).query(`UPDATE dbo.TODVZ_ADISYON_HAZIRLIK SET AKTIF = 0 WHERE YER_ID = @ID`); return { silindi: false }; }
      await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_ADISYON_HAZIRLIK WHERE YER_ID = @ID`);
      return { silindi: true };
    });
  }

  /** Ürün grupları ve hazırlık yerleri (grupsuz ürün: ayarda yer yoksa mutfağa gitmez, yalnız adisyonda kalır) */
  static async grupYerleri(ctx?: DbBaglam) {
    const pool = await havuz(ctx);
    const r = await pool.request().query(`SELECT G.STOK_GRUP_ID, RTRIM(G.AD) AS AD, GY.YER_ID FROM dbo.TODVZ_STOK_GRUP G LEFT JOIN dbo.TODVZ_ADISYON_GRUP_YER GY ON GY.STOK_GRUP_ID = G.STOK_GRUP_ID ORDER BY G.AD`);
    return r.recordset.map((x: any) => ({ stokGrupId: Number(x.STOK_GRUP_ID), ad: temiz(x.AD), yerId: x.YER_ID ?? null }));
  }

  static async grupYerKaydet(liste: { stokGrupId: number; yerId: number | null }[], ctx?: DbBaglam) {
    if (!Array.isArray(liste)) throw ApiError.badRequest("Grup listesi gönderilmeli.");
    await islem(ctx, async (tx) => {
      const yerler = new Set((await new sql.Request(tx).query(`SELECT YER_ID FROM dbo.TODVZ_ADISYON_HAZIRLIK`)).recordset.map((x: any) => Number(x.YER_ID)));
      const gruplar = new Set((await new sql.Request(tx).query(`SELECT STOK_GRUP_ID FROM dbo.TODVZ_STOK_GRUP`)).recordset.map((x: any) => Number(x.STOK_GRUP_ID)));
      for (const x of liste) {
        const g = Number(x.stokGrupId), y = x.yerId === null || x.yerId === undefined ? null : Number(x.yerId);
        if (!gruplar.has(g)) throw ApiError.badRequest(`Ürün grubu bulunamadı (#${g}).`);
        if (y !== null && !yerler.has(y)) throw ApiError.badRequest(`Hazırlık yeri bulunamadı (#${y}).`);
        await new sql.Request(tx).input("G", sql.Int, g).input("Y", sql.Int, y).query(`DELETE FROM dbo.TODVZ_ADISYON_GRUP_YER WHERE STOK_GRUP_ID = @G;
          IF @Y IS NOT NULL INSERT INTO dbo.TODVZ_ADISYON_GRUP_YER (STOK_GRUP_ID, YER_ID) VALUES (@G, @Y);`);
      }
    });
    return this.grupYerleri(ctx);
  }

  // ───────────── Seçenek grupları + karta bağlama ─────────────
  static async secenekGruplari(ctx?: DbBaglam) {
    const pool = await havuz(ctx);
    const r = await pool.request().query(`SELECT SG_ID, AD, ZORUNLU, COKLU, AKTIF, (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_KART_SECENEK K WHERE K.SG_ID = G.SG_ID) AS KART FROM dbo.TODVZ_ADISYON_SECENEK_GRUP G ORDER BY AD;
      SELECT SECENEK_ID, SG_ID, AD, EK_FIYAT, SIRA, AKTIF FROM dbo.TODVZ_ADISYON_SECENEK ORDER BY SG_ID, SIRA, SECENEK_ID;`);
    const rs = r.recordsets as any[];
    return rs[0].map((x: any) => ({ sgId: Number(x.SG_ID), ad: temiz(x.AD), zorunlu: !!x.ZORUNLU, coklu: !!x.COKLU, aktif: !!x.AKTIF, kartSayisi: Number(x.KART),
      secenekler: rs[1].filter((s: any) => Number(s.SG_ID) === Number(x.SG_ID)).map((s: any) => ({ secenekId: Number(s.SECENEK_ID), ad: temiz(s.AD), ekFiyat: Number(s.EK_FIYAT), sira: Number(s.SIRA), aktif: !!s.AKTIF })) }));
  }

  static async secenekGrupKaydet(g: { sgId?: number | null; ad: string; zorunlu?: boolean; coklu?: boolean; aktif?: boolean; secenekler: { secenekId?: number | null; ad: string; ekFiyat?: number | string | null; aktif?: boolean }[] }, ctx?: DbBaglam) {
    const ad = temiz(g.ad).slice(0, 60);
    if (!ad) throw ApiError.badRequest("Seçenek grubu adı yazılmalı.");
    const secenekler = (g.secenekler || []).map((s, i) => {
      const sad = temiz(s.ad).slice(0, 60);
      if (!sad) throw ApiError.badRequest(`${i + 1}. seçeneğin adı yazılmalı.`);
      const ek = s.ekFiyat === null || s.ekFiyat === undefined || String(s.ekFiyat).trim() === "" ? 0 : sayi(s.ekFiyat);
      if (!Number.isFinite(ek) || ek < 0 || ek > 1_000_000 || Math.round(ek * 100) !== Math.round(ek * 100 * 1e6) / 1e6) throw ApiError.badRequest(`${i + 1}. seçenek (${sad}): ek fiyat 0 ya da daha büyük, en çok 2 ondalık olmalı.`);
      return { secenekId: Number(s.secenekId) || 0, ad: sad, ekFiyat: Math.round(ek * 100) / 100, aktif: s.aktif !== false, sira: i + 1 };
    });
    if (!secenekler.filter((s) => s.aktif).length) throw ApiError.badRequest("Grupta en az bir etkin seçenek olmalı.");
    const adlar = secenekler.map((s) => s.ad.toLocaleLowerCase("tr-TR"));
    const tekrar = adlar.find((a, i) => adlar.indexOf(a) !== i);
    if (tekrar) throw ApiError.badRequest(`"${tekrar}" seçeneği iki kez yazılmış.`);
    return islem(ctx, async (tx) => {
      const req = new sql.Request(tx).input("ID", sql.Int, Number(g.sgId) || 0).input("AD", sql.NVarChar(60), ad).input("Z", sql.Bit, g.zorunlu ? 1 : 0).input("C", sql.Bit, g.coklu ? 1 : 0).input("A", sql.Bit, g.aktif === false ? 0 : 1);
      let id = Number(g.sgId) || 0;
      try {
        if (id) {
          const u = await req.query(`UPDATE dbo.TODVZ_ADISYON_SECENEK_GRUP SET AD = @AD, ZORUNLU = @Z, COKLU = @C, AKTIF = @A WHERE SG_ID = @ID; SELECT @@ROWCOUNT AS N;`);
          if (!Number(u.recordset[0].N)) throw ApiError.notFound("Seçenek grubu bulunamadı.");
        } else id = Number((await req.query(`INSERT INTO dbo.TODVZ_ADISYON_SECENEK_GRUP (AD, ZORUNLU, COKLU, AKTIF) OUTPUT INSERTED.SG_ID VALUES (@AD, @Z, @C, @A)`)).recordset[0].SG_ID);
      } catch (e) { return tekilHatasi(e, `"${ad}" adında bir seçenek grubu zaten var.`); }
      // Seçenekler: verilen kimlikler güncellenir, yeni olanlar eklenir, listede olmayanlar silinir (kalem geçmişi metin olarak saklıdır)
      const mevcut = new Set((await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT SECENEK_ID FROM dbo.TODVZ_ADISYON_SECENEK WHERE SG_ID = @ID`)).recordset.map((x: any) => Number(x.SECENEK_ID)));
      const tutulan = new Set<number>();
      // Ad çakışmasın diye önce silinecekler silinir
      const silinecek = [...mevcut].filter((x) => !secenekler.some((s) => s.secenekId === x));
      if (silinecek.length) await new sql.Request(tx).query(`DELETE FROM dbo.TODVZ_ADISYON_SECENEK WHERE SECENEK_ID IN (${silinecek.join(",")})`);
      for (const s of secenekler) {
        const r2 = new sql.Request(tx).input("SG", sql.Int, id).input("SID", sql.Int, s.secenekId).input("AD", sql.NVarChar(60), s.ad).input("EK", sql.Decimal(18, 2), s.ekFiyat).input("S", sql.Int, s.sira).input("A", sql.Bit, s.aktif ? 1 : 0);
        if (s.secenekId && mevcut.has(s.secenekId)) { await r2.query(`UPDATE dbo.TODVZ_ADISYON_SECENEK SET AD = @AD, EK_FIYAT = @EK, SIRA = @S, AKTIF = @A WHERE SECENEK_ID = @SID AND SG_ID = @SG`); tutulan.add(s.secenekId); }
        else await r2.query(`INSERT INTO dbo.TODVZ_ADISYON_SECENEK (SG_ID, AD, EK_FIYAT, SIRA, AKTIF) VALUES (@SG, @AD, @EK, @S, @A)`);
      }
      return id;
    });
  }

  static async secenekGrupSil(id: number, ctx?: DbBaglam) {
    return islem(ctx, async (tx) => {
      const k = (await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_SECENEK_GRUP WITH (UPDLOCK) WHERE SG_ID = @ID) AS V, (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_KART_SECENEK WHERE SG_ID = @ID) AS K`)).recordset[0];
      if (!Number(k.V)) throw ApiError.notFound("Seçenek grubu bulunamadı.");
      if (Number(k.K) > 0) throw ApiError.badRequest(`Seçenek grubu ${k.K} üründe kullanılıyor; önce ürünlerden kaldırın ya da pasif yapın.`);
      await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_ADISYON_SECENEK WHERE SG_ID = @ID; DELETE FROM dbo.TODVZ_ADISYON_SECENEK_GRUP WHERE SG_ID = @ID;`);
    });
  }

  /** Ürünün Adisyon ayrıntısı: seçenek grupları (sırayla) + porsiyonlar */
  static async kartAyrintisi(stokKartId: number, ctx?: DbBaglam) {
    const pool = await havuz(ctx);
    const r = await pool.request().input("K", sql.Int, stokKartId).query(`SELECT SG_ID FROM dbo.TODVZ_ADISYON_KART_SECENEK WHERE STOK_KART_ID = @K ORDER BY SIRA;
      SELECT PORSIYON_ID, AD, CARPAN, FIYAT, SIRA FROM dbo.TODVZ_ADISYON_PORSIYON WHERE STOK_KART_ID = @K ORDER BY SIRA, PORSIYON_ID;`);
    const rs = r.recordsets as any[];
    return { stokKartId, secenekGrupIdler: rs[0].map((x: any) => Number(x.SG_ID)),
      porsiyonlar: rs[1].map((x: any) => ({ porsiyonId: Number(x.PORSIYON_ID), ad: temiz(x.AD), carpan: Number(x.CARPAN), fiyat: x.FIYAT === null ? null : Number(x.FIYAT), sira: Number(x.SIRA) })) };
  }

  static async kartAyrintisiKaydet(stokKartId: number, g: { secenekGrupIdler?: number[]; porsiyonlar?: { ad: string; carpan: number | string; fiyat?: number | string | null }[] }, ctx?: DbBaglam) {
    const porsiyonlar = g.porsiyonlar === undefined ? undefined : (g.porsiyonlar || []).map((p, i) => {
      const ad = temiz(p.ad).slice(0, 30);
      if (!ad) throw ApiError.badRequest(`${i + 1}. porsiyonun adı yazılmalı.`);
      const c = sayi(p.carpan);
      if (!Number.isFinite(c) || c <= 0 || c > 10 || Math.abs(c * 10000 - Math.round(c * 10000)) > 1e-6) throw ApiError.badRequest(`${i + 1}. porsiyon (${ad}): çarpan 0'dan büyük, en çok 10, en çok 4 ondalık olmalı.`);
      const f = p.fiyat === null || p.fiyat === undefined || String(p.fiyat).trim() === "" ? null : sayi(p.fiyat);
      if (f !== null && (!Number.isFinite(f) || f <= 0)) throw ApiError.badRequest(`${i + 1}. porsiyon (${ad}): fiyat boş ya da 0'dan büyük olmalı.`);
      return { ad, carpan: Math.round(c * 10000) / 10000, fiyat: f === null ? null : Math.round(f * 10000) / 10000, sira: i + 1 };
    });
    if (porsiyonlar) {
      const adlar = porsiyonlar.map((p) => p.ad.toLocaleLowerCase("tr-TR"));
      const t = adlar.find((a, i) => adlar.indexOf(a) !== i);
      if (t) throw ApiError.badRequest(`"${t}" porsiyonu iki kez yazılmış.`);
    }
    const sgler = g.secenekGrupIdler === undefined ? undefined : [...new Set((g.secenekGrupIdler || []).map(Number).filter((x) => x > 0))];
    await islem(ctx, async (tx) => {
      const k = await new sql.Request(tx).input("K", sql.Int, stokKartId).query(`SELECT ISNULL(RECETELI, 0) AS R FROM dbo.TODVZ_STOK_KART WITH (UPDLOCK) WHERE STOK_KART_ID = @K`);
      if (!k.recordset.length) throw ApiError.notFound("Stok kartı bulunamadı.");
      if (sgler) {
        if (sgler.length) {
          const v = (await new sql.Request(tx).query(`SELECT SG_ID FROM dbo.TODVZ_ADISYON_SECENEK_GRUP WHERE SG_ID IN (${sgler.join(",")})`)).recordset.map((x: any) => Number(x.SG_ID));
          const yok = sgler.find((x) => !v.includes(x));
          if (yok) throw ApiError.badRequest(`Seçenek grubu bulunamadı (#${yok}).`);
        }
        const req = new sql.Request(tx).input("K", sql.Int, stokKartId);
        await req.query(`DELETE FROM dbo.TODVZ_ADISYON_KART_SECENEK WHERE STOK_KART_ID = @K${sgler.length ? `; INSERT INTO dbo.TODVZ_ADISYON_KART_SECENEK (STOK_KART_ID, SG_ID, SIRA) VALUES ${sgler.map((s, i) => `(@K, ${s}, ${i + 1})`).join(",")}` : ""}`);
      }
      if (porsiyonlar) {
        await new sql.Request(tx).input("K", sql.Int, stokKartId).query(`DELETE FROM dbo.TODVZ_ADISYON_PORSIYON WHERE STOK_KART_ID = @K`);
        for (const p of porsiyonlar) {
          await new sql.Request(tx).input("K", sql.Int, stokKartId).input("AD", sql.NVarChar(30), p.ad).input("C", sql.Decimal(9, 4), p.carpan).input("F", sql.Decimal(18, 4), p.fiyat).input("S", sql.Int, p.sira)
            .query(`INSERT INTO dbo.TODVZ_ADISYON_PORSIYON (STOK_KART_ID, AD, CARPAN, FIYAT, SIRA) VALUES (@K, @AD, @C, @F, @S)`);
        }
      }
    });
    return this.kartAyrintisi(stokKartId, ctx);
  }

  // ───────────── Garson (TA23–TA25; 26.11.2026 G1–G4: kart Kullanıcı Tanımları'ndaki bir kullanıcıya bağlı, PIN yok) ─────────────
  static async garsonlar(ctx?: DbBaglam) {
    const pool = await havuz(ctx);
    const r = await pool.request().query(`SELECT G.GARSON_ID, G.AD, G.SEVIYE, G.EK_YETKI, G.AKTIF, G.SON_GIRIS, G.KILIT_BITIS, G.KULLANICI_ID, RTRIM(U.AD) AS KULLANICI_AD
      FROM dbo.TODVZ_ADISYON_GARSON G LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID = G.KULLANICI_ID ORDER BY G.AKTIF DESC, G.AD`);
    const limit = await AdisyonTanimSqlRepository.garsonLimiti(ctx);
    const liste = r.recordset.map((x: any) => ({ garsonId: Number(x.GARSON_ID), ad: temiz(x.AD), seviye: Number(x.SEVIYE), ekYetki: temiz(x.EK_YETKI).split(",").filter(Boolean),
      yetkiler: [...yetkiKumesi(Number(x.SEVIYE), x.EK_YETKI)], aktif: !!x.AKTIF, sonGiris: x.SON_GIRIS ? new Date(x.SON_GIRIS).toISOString() : null,
      kilitli: !!(x.KILIT_BITIS && new Date(x.KILIT_BITIS).getTime() > Date.now()),
      // Kullanıcısı silinmiş kart: KULLANICI_ID dolu ama kullanıcı yok → bağlı sayılmaz (giriş yapamaz, kartta yeniden seçilmeli)
      kullaniciId: x.KULLANICI_AD == null ? null : Number(x.KULLANICI_ID), kullaniciAdi: x.KULLANICI_AD == null ? null : temiz(x.KULLANICI_AD) }));
    return { garsonlar: liste, limit, aktifSayi: liste.filter((x: any) => x.aktif).length };
  }

  /** Garson kartında seçilecek kullanıcılar (Kullanıcı Tanımları); başka bir garsona bağlı olan işaretli */
  static async garsonKullanicilari(ctx?: DbBaglam) {
    const pool = await havuz(ctx);
    const r = await pool.request().query(`SELECT U.KULLANICI_ID, RTRIM(U.AD) AS AD, G.GARSON_ID, RTRIM(G.AD) AS GARSON_AD
      FROM dbo.TODVZ_KULLANICI U LEFT JOIN dbo.TODVZ_ADISYON_GARSON G ON G.KULLANICI_ID = U.KULLANICI_ID
      WHERE LTRIM(RTRIM(ISNULL(U.AD, ''))) <> '' ORDER BY U.AD`);
    return r.recordset.map((x: any) => ({ kullaniciId: Number(x.KULLANICI_ID), ad: temiz(x.AD), garsonId: x.GARSON_ID == null ? null : Number(x.GARSON_ID), garsonAd: x.GARSON_AD == null ? null : temiz(x.GARSON_AD) }));
  }

  static async garsonKaydet(g: { garsonId?: number | null; ad?: string; kullaniciId?: number | null; seviye?: number; ekYetki?: string[]; aktif?: boolean }, ctx?: DbBaglam) {
    const kullaniciId = Number(g.kullaniciId);
    if (!Number.isInteger(kullaniciId) || kullaniciId <= 0) throw ApiError.badRequest("Garsonun gireceği kullanıcı seçilmeli (Kullanıcı Tanımları).");
    const seviye = Number(g.seviye) || SEVIYE.GARSON;
    if (![SEVIYE.GARSON, SEVIYE.KASIYER, SEVIYE.YETKILI].includes(seviye as any)) throw ApiError.badRequest("Yetki seviyesi Garson, Kasiyer ya da Yetkili olmalı.");
    const aktif = g.aktif !== false;
    const limit = aktif ? await AdisyonTanimSqlRepository.garsonLimiti(ctx) : null;
    return islem(ctx, async (tx) => {
      const u = (await new sql.Request(tx).input("U", sql.Int, kullaniciId).query(`SELECT RTRIM(AD) AS AD FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = @U`)).recordset[0];
      if (!u || !temiz(u.AD)) throw ApiError.badRequest("Seçilen kullanıcı bulunamadı (Kullanıcı Tanımları).");
      // Ad boşsa kullanıcı adı: adisyonda / mutfakta görünen garson adı
      const ad = (temiz(g.ad) || temiz(u.AD)).slice(0, 60);
      // Garson sınırı (TA24): etkin garson sayısı; sayım kilitli (eşzamanlı iki kayıt sınırı aşmasın)
      if (aktif && limit !== null) {
        const s = (await new sql.Request(tx).input("ID", sql.Int, Number(g.garsonId) || 0).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_ADISYON_GARSON WITH (UPDLOCK, HOLDLOCK) WHERE AKTIF = 1 AND GARSON_ID <> @ID`)).recordset[0];
        if (Number(s.N) >= limit) throw ApiError.badRequest(`Lisanstaki garson sınırına (${limit}) ulaşıldı; yeni garson için önce bir garsonu pasif yapın ya da lisansı yükseltin.`);
      }
      // Bir kullanıcı tek garson kartına bağlanır (giriş kullanıcı adıyla: hangi kart olduğu belirsiz kalmasın)
      const baska = (await new sql.Request(tx).input("U", sql.Int, kullaniciId).input("ID", sql.Int, Number(g.garsonId) || 0)
        .query(`SELECT RTRIM(AD) AS AD FROM dbo.TODVZ_ADISYON_GARSON WITH (UPDLOCK, HOLDLOCK) WHERE KULLANICI_ID = @U AND GARSON_ID <> @ID`)).recordset[0];
      if (baska) throw ApiError.badRequest(`"${temiz(u.AD)}" kullanıcısı zaten "${temiz(baska.AD)}" garson kartına bağlı.`);
      const req = new sql.Request(tx).input("ID", sql.Int, Number(g.garsonId) || 0).input("AD", sql.NVarChar(60), ad).input("S", sql.TinyInt, seviye)
        .input("E", sql.VarChar(200), ekYetkiMetni(g.ekYetki)).input("A", sql.Bit, aktif ? 1 : 0).input("U", sql.Int, kullaniciId);
      try {
        if (g.garsonId) {
          // Kullanıcı değişince hata sayacı / kilit sıfırlanır (yeni kullanıcı eskisinin kilidini devralmasın); oturumlar jetondaki kullanıcıyla düşer
          const v = await req.query(`UPDATE dbo.TODVZ_ADISYON_GARSON SET AD = @AD, SEVIYE = @S, EK_YETKI = @E, AKTIF = @A,
              HATALI_DENEME = CASE WHEN ISNULL(KULLANICI_ID, 0) = @U THEN HATALI_DENEME ELSE 0 END, KILIT_BITIS = CASE WHEN ISNULL(KULLANICI_ID, 0) = @U THEN KILIT_BITIS ELSE NULL END,
              KULLANICI_ID = @U, PIN_OZET = NULL WHERE GARSON_ID = @ID;
            SELECT @@ROWCOUNT AS V;`);
          if (!Number(v.recordset[0].V)) throw ApiError.notFound("Garson bulunamadı.");
          return Number(g.garsonId);
        }
        return Number((await req.query(`INSERT INTO dbo.TODVZ_ADISYON_GARSON (AD, KULLANICI_ID, SEVIYE, EK_YETKI, AKTIF) OUTPUT INSERTED.GARSON_ID VALUES (@AD, @U, @S, @E, @A)`)).recordset[0].GARSON_ID);
      } catch (e: any) {
        if (/UX_TODVZ_ADISYON_GARSON_KULLANICI/i.test(String(e?.message || e))) throw ApiError.badRequest(`"${temiz(u.AD)}" kullanıcısı zaten başka bir garson kartına bağlı.`);
        return tekilHatasi(e, `"${ad}" adında bir garson zaten var.`);
      }
    });
  }

  /** Adisyon geçmişi olan garson silinmez, pasif yapılır */
  static async garsonSil(id: number, ctx?: DbBaglam): Promise<{ silindi: boolean }> {
    return islem(ctx, async (tx) => {
      const k = (await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_GARSON WITH (UPDLOCK) WHERE GARSON_ID = @ID) AS V,
        (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON WHERE GARSON_ID = @ID OR ACAN_GARSON_ID = @ID) + (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_KALEM WHERE EKLEYEN_GARSON_ID = @ID) AS K`)).recordset[0];
      if (!Number(k.V)) throw ApiError.notFound("Garson bulunamadı.");
      if (Number(k.K) > 0) { await new sql.Request(tx).input("ID", sql.Int, id).query(`UPDATE dbo.TODVZ_ADISYON_GARSON SET AKTIF = 0 WHERE GARSON_ID = @ID`); return { silindi: false }; }
      await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_ADISYON_GARSON WHERE GARSON_ID = @ID`);
      return { silindi: true };
    });
  }
}

import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { maliyetDagit, parcalamaOzeti, stokMiktariDenetle, yuvarla2 } from "../services/ticari/ticariHesap.js";
import { DbBaglam, STOK_BELGE, TicariStokSqlRepository, receteliReddet, stokIslemKilidi } from "./ticariStokSql.repository.js";
import { bakiyeler, eksiStokDenetle } from "./ticariGirisSql.repository.js";
import { yeniNo } from "./ticariSayimFireSql.repository.js";
import { TicariKarSqlRepository } from "./ticariKarSql.repository.js";

/**
 * Parçalama fişi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA17 — kasap): girdi kartı + miktar stoktan çıkar (o anki hareketli ortalama
 * maliyetle; BELGE_TURU 6, SATIR_NO 0), çıktı kartları + miktar + elle girilen birim maliyet stoğa girer (SATIR_NO 1..; maliyetli giriş,
 * çıktının ortalamasını günceller). Fire = girdi − çıktılar (ağırlık birimleri aynı türdeyse önerilir, elle değiştirilebilir).
 * Çıktı maliyeti girdi maliyetinden sapınca uyarı döner (kayıt engellenmez); "maliyetDagit" girdi maliyetini paya / miktara göre dağıtır.
 * Şablon: girdi kartı + parça listesi (verim %, maliyet payı %), fişte seçilince satırlar dolar.
 */
const temiz = (v: unknown): string => String(v ?? "").trim();
const sayi = (v: unknown): number => {
  if (typeof v === "string") v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  return Number(v);
};
const y4 = (n: number) => Math.round(n * 10000) / 10000;

export interface ParcalamaGirdi {
  parcalamaId?: number | null;
  tarih?: string | null;
  girdiKartId: number;
  girdiMiktar: number | string;
  /** Boş: girdi − çıktılar (ağırlık birimleriyse), yoksa null */
  fireMiktar?: number | string | null;
  sablonId?: number | null;
  aciklama?: string | null;
  satirlar: { stokKartId: number; miktar: number | string; birimMaliyet: number | string }[];
  eksiStokOnay?: boolean;
}

export interface SablonGirdi {
  sablonId?: number | null;
  ad: string;
  girdiKartId: number;
  aciklama?: string | null;
  satirlar: { stokKartId: number; verimYuzde?: number | string | null; maliyetPayi?: number | string | null }[];
}

export class TicariParcalamaSqlRepository {
  /** Girdi kartının verilen andaki ortalama maliyeti (ekranda girdi maliyetini göstermek ve dağıtmak için) */
  static async girdiMaliyeti(stokKartId: number, tarih: string | null, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const an = tarih ? new Date(tarih) : new Date();
    if (Number.isNaN(an.getTime())) throw ApiError.badRequest("Tarih okunamadı.");
    const k = (await pool.request().input("K", sql.Int, stokKartId).query(`SELECT STOK_KART_ID, RTRIM(ISNULL(BIRIM, 'Adet')) AS BIRIM FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID = @K`)).recordset[0];
    if (!k) throw ApiError.notFound("Stok kartı bulunamadı.");
    const ort = await TicariKarSqlRepository.ortalamalar(pool, [stokKartId], an);
    const bak = (await pool.request().input("K", sql.Int, stokKartId).input("T", sql.DateTime, an).query(`SELECT ISNULL(SUM(GIRIS - CIKIS), 0) AS B FROM dbo.TODVZ_STOK_HAREKET WHERE STOK_KART_ID = @K AND TARIH <= @T`)).recordset[0];
    return { stokKartId, birim: temiz(k.BIRIM), birimMaliyet: ort.get(stokKartId) || 0, bakiye: y4(Number(bak?.B) || 0) };
  }

  static async kaydet(g: ParcalamaGirdi, kullaniciId: number | undefined, ctx?: DbBaglam) {
    const tarih = g.tarih ? new Date(String(g.tarih)) : new Date();
    if (Number.isNaN(tarih.getTime())) throw ApiError.badRequest("Fiş tarihi okunamadı.");
    const girdiKartId = Number(g.girdiKartId) || 0;
    if (!girdiKartId) throw ApiError.badRequest("Parçalanacak ürün (girdi) seçilmeli.");
    const gh = stokMiktariDenetle(g.girdiMiktar);
    if (gh) throw ApiError.badRequest(`Girdi miktarı: ${gh}`);
    const girdiMiktar = y4(sayi(g.girdiMiktar));
    const satirlar = (g.satirlar || []).filter((s) => s && Number(s.stokKartId) > 0);
    if (!satirlar.length) throw ApiError.badRequest("En az bir çıktı (parça) satırı olmalı.");
    for (const [i, s] of satirlar.entries()) {
      const h = stokMiktariDenetle(s.miktar);
      if (h) throw ApiError.badRequest(`${i + 1}. çıktı: ${h}`);
      const bm = sayi(s.birimMaliyet);
      if (s.birimMaliyet === null || s.birimMaliyet === undefined || String(s.birimMaliyet).trim() === "" || !Number.isFinite(bm) || bm < 0) throw ApiError.badRequest(`${i + 1}. çıktı: birim maliyet yazılmalı (0 ya da daha büyük).`);
      if (Number(s.stokKartId) === girdiKartId) throw ApiError.badRequest(`${i + 1}. çıktı: parçalanan ürünün kendisi çıktı olamaz.`);
    }
    const kartlar = [...new Set(satirlar.map((s) => Number(s.stokKartId)))];
    if (kartlar.length !== satirlar.length) throw ApiError.badRequest("Aynı çıktı kartı iki kez yazılmış; miktarları birleştirin.");
    let fire: number | null = null;
    if (g.fireMiktar !== null && g.fireMiktar !== undefined && String(g.fireMiktar).trim() !== "") {
      const fh = stokMiktariDenetle(g.fireMiktar, true);
      if (fh) throw ApiError.badRequest(`Fire miktarı: ${fh}`);
      fire = y4(sayi(g.fireMiktar));
      if (fire > girdiMiktar) throw ApiError.badRequest("Fire miktarı girdi miktarından büyük olamaz.");
    }

    const pool = await TicariStokSqlRepository.havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    await stokIslemKilidi(tx);
    let id = Number(g.parcalamaId) || 0;
    let uyari: string | null = null;
    try {
      const kq = await new sql.Request(tx).query(`SELECT STOK_KART_ID, RTRIM(ISNULL(BIRIM, 'Adet')) AS BIRIM, AD FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${[girdiKartId, ...kartlar].join(",")})`);
      const kart = new Map<number, { birim: string; ad: string }>(kq.recordset.map((x: any) => [Number(x.STOK_KART_ID), { birim: temiz(x.BIRIM), ad: temiz(x.AD) }]));
      const yok = [girdiKartId, ...kartlar].find((x) => !kart.has(x));
      if (yok) throw ApiError.badRequest(`Stok kartı bulunamadı (#${yok}).`);
      await receteliReddet(tx, [girdiKartId, ...kartlar], "parçalama");
      if (g.sablonId) {
        const sv = await new sql.Request(tx).input("S", sql.Int, Number(g.sablonId)).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_PARCALAMA_SABLON WHERE SABLON_ID = @S`);
        if (!sv.recordset.length) throw ApiError.badRequest("Seçilen parçalama şablonu bulunamadı.");
      }
      let eskiKartlar: number[] = [];
      if (id) {
        const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT GIRDI_KART_ID FROM dbo.TODVZ_STOK_PARCALAMA WITH (UPDLOCK) WHERE PARCALAMA_ID = @ID;
          SELECT STOK_KART_ID FROM dbo.TODVZ_STOK_PARCALAMA_SATIR WHERE PARCALAMA_ID = @ID;`);
        const rs = e.recordsets as any[];
        if (!rs[0].length) throw ApiError.notFound("Parçalama fişi bulunamadı.");
        eskiKartlar = [Number(rs[0][0].GIRDI_KART_ID), ...rs[1].map((x: any) => Number(x.STOK_KART_ID))];
        // Düzeltme: önce eski hareketler silinir, girdi ortalaması kendi eski hareketi olmadan okunur
        await new sql.Request(tx).input("ID", sql.Int, id).input("TUR", sql.TinyInt, STOK_BELGE.PARCALAMA).query(`DELETE FROM dbo.TODVZ_STOK_HAREKET WHERE BELGE_TURU = @TUR AND BELGE_ID = @ID`);
      }
      const onceki = await bakiyeler(tx, [girdiKartId, ...kartlar, ...eskiKartlar]);
      const girdiOrt = (await TicariKarSqlRepository.ortalamalar(tx, [girdiKartId], tarih)).get(girdiKartId) || 0;
      const girdiBirim = kart.get(girdiKartId)!.birim;
      const ozet = parcalamaOzeti({ miktar: girdiMiktar, birim: girdiBirim, birimMaliyet: girdiOrt },
        satirlar.map((s) => ({ miktar: y4(sayi(s.miktar)), birim: kart.get(Number(s.stokKartId))!.birim, birimMaliyet: sayi(s.birimMaliyet) })));
      if (ozet.fireOnerisi !== null && ozet.fireOnerisi < -0.00005) throw ApiError.badRequest("Çıktıların ağırlığı girdiden fazla; miktarları denetleyin.");
      const fireMiktar = fire !== null ? fire : ozet.fireOnerisi !== null ? Math.max(0, ozet.fireOnerisi) : null;
      const bas = new sql.Request(tx).input("ID", sql.Int, id).input("T", sql.DateTime, tarih).input("GK", sql.Int, girdiKartId).input("GB", sql.VarChar(20), girdiBirim)
        .input("GM", sql.Decimal(18, 4), girdiMiktar).input("GBM", sql.Decimal(18, 6), girdiOrt).input("FM", sql.Decimal(18, 4), fireMiktar)
        .input("SB", sql.Int, Number(g.sablonId) || null).input("A", sql.NVarChar(250), temiz(g.aciklama).slice(0, 250) || null).input("KUL", sql.Int, kullaniciId || null);
      if (id) {
        await bas.query(`DELETE FROM dbo.TODVZ_STOK_PARCALAMA_SATIR WHERE PARCALAMA_ID = @ID;
          UPDATE dbo.TODVZ_STOK_PARCALAMA SET TARIH = @T, GIRDI_KART_ID = @GK, GIRDI_BIRIM = @GB, GIRDI_MIKTAR = @GM, GIRDI_BIRIM_MALIYET = @GBM, FIRE_MIKTAR = @FM,
            SABLON_ID = @SB, ACIKLAMA = @A, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() WHERE PARCALAMA_ID = @ID;`);
      } else {
        bas.input("NO", sql.VarChar(20), await yeniNo(tx, "TODVZ_STOK_PARCALAMA", "PARCALAMA_NO", "PR", tarih));
        id = (await bas.query(`INSERT INTO dbo.TODVZ_STOK_PARCALAMA (PARCALAMA_NO, TARIH, GIRDI_KART_ID, GIRDI_BIRIM, GIRDI_MIKTAR, GIRDI_BIRIM_MALIYET, FIRE_MIKTAR, SABLON_ID, ACIKLAMA, EKLEYEN_ID)
          OUTPUT INSERTED.PARCALAMA_ID VALUES (@NO, @T, @GK, @GB, @GM, @GBM, @FM, @SB, @A, @KUL)`)).recordset[0].PARCALAMA_ID;
      }
      const req = new sql.Request(tx).input("ID", sql.Int, id);
      const v = satirlar.map((s, j) => {
        req.input(`N${j}`, sql.Int, j + 1).input(`K${j}`, sql.Int, Number(s.stokKartId)).input(`B${j}`, sql.VarChar(20), kart.get(Number(s.stokKartId))!.birim)
          .input(`M${j}`, sql.Decimal(18, 4), y4(sayi(s.miktar))).input(`C${j}`, sql.Decimal(18, 6), Math.round(sayi(s.birimMaliyet) * 1_000_000) / 1_000_000);
        return `(@ID, @N${j}, @K${j}, @B${j}, @M${j}, @C${j})`;
      });
      await req.query(`INSERT INTO dbo.TODVZ_STOK_PARCALAMA_SATIR (PARCALAMA_ID, SATIR_NO, STOK_KART_ID, BIRIM, MIKTAR, BIRIM_MALIYET) VALUES ${v.join(",")}`);
      // Hareketler: girdi (SATIR_NO 0, çıkış, ortalama maliyet), çıktılar (giriş, elle maliyet)
      await new sql.Request(tx).input("ID", sql.Int, id).input("T", sql.DateTime, tarih).input("TUR", sql.TinyInt, STOK_BELGE.PARCALAMA).input("KUL", sql.Int, kullaniciId || null).query(`
        INSERT INTO dbo.TODVZ_STOK_HAREKET (STOK_KART_ID, TARIH, BELGE_TURU, BELGE_ID, SATIR_NO, GIRIS, CIKIS, BIRIM_FIYAT, EKLEYEN_ID)
        SELECT GIRDI_KART_ID, @T, @TUR, @ID, 0, 0, GIRDI_MIKTAR, GIRDI_BIRIM_MALIYET, @KUL FROM dbo.TODVZ_STOK_PARCALAMA WHERE PARCALAMA_ID = @ID
        UNION ALL
        SELECT STOK_KART_ID, @T, @TUR, @ID, SATIR_NO, MIKTAR, 0, BIRIM_MALIYET, @KUL FROM dbo.TODVZ_STOK_PARCALAMA_SATIR WHERE PARCALAMA_ID = @ID;`);
      const eksi = await eksiStokDenetle(tx, onceki, g.eksiStokOnay);
      const uyarilar = [...ozet.uyarilar];
      if (eksi.length) uyarilar.push(`Eksiye düşen stok: ${eksi.map((x) => `${x.kod} ${x.ad} (${x.sonraki})`).join(", ")}`);
      uyari = uyarilar.length ? uyarilar.join(" ") : null;
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
    return { fis: await this.getir(id, ctx), uyari };
  }

  static async sil(id: number, onay: boolean | undefined, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    await stokIslemKilidi(tx);
    try {
      const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT GIRDI_KART_ID FROM dbo.TODVZ_STOK_PARCALAMA WITH (UPDLOCK) WHERE PARCALAMA_ID = @ID;
        SELECT STOK_KART_ID FROM dbo.TODVZ_STOK_PARCALAMA_SATIR WHERE PARCALAMA_ID = @ID;`);
      const rs = e.recordsets as any[];
      if (!rs[0].length) throw ApiError.notFound("Parçalama fişi bulunamadı.");
      const onceki = await bakiyeler(tx, [Number(rs[0][0].GIRDI_KART_ID), ...rs[1].map((x: any) => Number(x.STOK_KART_ID))]);
      await new sql.Request(tx).input("ID", sql.Int, id).input("TUR", sql.TinyInt, STOK_BELGE.PARCALAMA).query(`
        DELETE FROM dbo.TODVZ_STOK_HAREKET WHERE BELGE_TURU = @TUR AND BELGE_ID = @ID;
        DELETE FROM dbo.TODVZ_STOK_PARCALAMA_SATIR WHERE PARCALAMA_ID = @ID; DELETE FROM dbo.TODVZ_STOK_PARCALAMA WHERE PARCALAMA_ID = @ID;`);
      // Silmek çıktıların stoğunu düşürür (parçalar satılmışsa eksiye iner)
      await eksiStokDenetle(tx, onceki, onay);
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }

  static async getir(id: number, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const r = await pool.request().input("ID", sql.Int, id).query(`
      SELECT P.*, RTRIM(K.KOD) AS KOD, K.AD, RTRIM(ISNULL(U.AD, '')) AS EKLEYEN, SB.AD AS SABLON_AD FROM dbo.TODVZ_STOK_PARCALAMA P JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = P.GIRDI_KART_ID
        LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID = P.EKLEYEN_ID LEFT JOIN dbo.TODVZ_STOK_PARCALAMA_SABLON SB ON SB.SABLON_ID = P.SABLON_ID WHERE P.PARCALAMA_ID = @ID;
      SELECT S.*, RTRIM(K.KOD) AS KOD, K.AD FROM dbo.TODVZ_STOK_PARCALAMA_SATIR S JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID WHERE S.PARCALAMA_ID = @ID ORDER BY S.SATIR_NO;`);
    const rs = r.recordsets as any[];
    const p = rs[0][0];
    if (!p) throw ApiError.notFound("Parçalama fişi bulunamadı.");
    const satirlar = rs[1].map((x: any) => ({ satirNo: Number(x.SATIR_NO), stokKartId: Number(x.STOK_KART_ID), kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM),
      miktar: Number(x.MIKTAR), birimMaliyet: Number(x.BIRIM_MALIYET), maliyet: yuvarla2(Number(x.MIKTAR) * Number(x.BIRIM_MALIYET)) }));
    const girdi = { stokKartId: Number(p.GIRDI_KART_ID), kod: temiz(p.KOD), ad: temiz(p.AD), birim: temiz(p.GIRDI_BIRIM), miktar: Number(p.GIRDI_MIKTAR), birimMaliyet: Number(p.GIRDI_BIRIM_MALIYET) };
    const ozet = parcalamaOzeti(girdi, satirlar);
    return { parcalamaId: Number(p.PARCALAMA_ID), parcalamaNo: temiz(p.PARCALAMA_NO), tarih: new Date(p.TARIH).toISOString(), girdi,
      fireMiktar: p.FIRE_MIKTAR === null || p.FIRE_MIKTAR === undefined ? null : Number(p.FIRE_MIKTAR), sablonId: p.SABLON_ID ?? null, sablonAd: p.SABLON_AD ? temiz(p.SABLON_AD) : null,
      aciklama: p.ACIKLAMA ? temiz(p.ACIKLAMA) : null, ekleyen: temiz(p.EKLEYEN), satirlar, ozet };
  }

  static async liste(f: { baslangic?: string | null; bitis?: string | null; stokKartId?: number | null } = {}, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const req = pool.request();
    const k: string[] = [];
    const gun = "CAST(DATEADD(hour, 3, P.TARIH) AS date)";
    if (f.baslangic) { req.input("B", sql.VarChar(10), temiz(f.baslangic).slice(0, 10)); k.push(`${gun} >= CAST(@B AS date)`); }
    if (f.bitis) { req.input("E", sql.VarChar(10), temiz(f.bitis).slice(0, 10)); k.push(`${gun} <= CAST(@E AS date)`); }
    if (f.stokKartId) { req.input("K", sql.Int, f.stokKartId); k.push("(P.GIRDI_KART_ID = @K OR EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_PARCALAMA_SATIR X WHERE X.PARCALAMA_ID = P.PARCALAMA_ID AND X.STOK_KART_ID = @K))"); }
    const r = await req.query(`
      SELECT TOP 500 P.PARCALAMA_ID, P.PARCALAMA_NO, P.TARIH, K.AD, P.GIRDI_BIRIM, P.GIRDI_MIKTAR, P.GIRDI_BIRIM_MALIYET, P.FIRE_MIKTAR,
        (SELECT COUNT(*) FROM dbo.TODVZ_STOK_PARCALAMA_SATIR S WHERE S.PARCALAMA_ID = P.PARCALAMA_ID) AS PARCA,
        (SELECT ISNULL(SUM(S.MIKTAR * S.BIRIM_MALIYET), 0) FROM dbo.TODVZ_STOK_PARCALAMA_SATIR S WHERE S.PARCALAMA_ID = P.PARCALAMA_ID) AS CIKTI_MALIYET
      FROM dbo.TODVZ_STOK_PARCALAMA P JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = P.GIRDI_KART_ID
      ${k.length ? `WHERE ${k.join(" AND ")}` : ""} ORDER BY P.TARIH DESC, P.PARCALAMA_ID DESC`);
    return r.recordset.map((x: any) => ({ parcalamaId: Number(x.PARCALAMA_ID), parcalamaNo: temiz(x.PARCALAMA_NO), tarih: new Date(x.TARIH).toISOString(), girdiAd: temiz(x.AD),
      girdiBirim: temiz(x.GIRDI_BIRIM), girdiMiktar: Number(x.GIRDI_MIKTAR), girdiMaliyet: yuvarla2(Number(x.GIRDI_MIKTAR) * Number(x.GIRDI_BIRIM_MALIYET)),
      ciktiMaliyet: yuvarla2(Number(x.CIKTI_MALIYET)), fireMiktar: x.FIRE_MIKTAR === null ? null : Number(x.FIRE_MIKTAR), parcaSayisi: Number(x.PARCA) }));
  }

  /** Girdi maliyetini çıktılara dağıtır (ekrandaki "Maliyeti dağıt" düğmesi saf hesabı ön yüzde de kullanır; burada test ve uç için) */
  static dagit(girdiMaliyet: number, ciktilar: { miktar: number; pay?: number | null }[]) { return maliyetDagit(girdiMaliyet, ciktilar); }

  // ── Şablonlar ──
  static async sablonlar(ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const r = await pool.request().query(`
      SELECT S.SABLON_ID, S.AD, S.GIRDI_KART_ID, RTRIM(K.KOD) AS KOD, K.AD AS KART_AD, RTRIM(ISNULL(K.BIRIM, 'Adet')) AS BIRIM, S.ACIKLAMA FROM dbo.TODVZ_STOK_PARCALAMA_SABLON S
        JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.GIRDI_KART_ID ORDER BY S.AD;
      SELECT T.SABLON_ID, T.SATIR_NO, T.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, RTRIM(ISNULL(K.BIRIM, 'Adet')) AS BIRIM, T.VERIM_YUZDE, T.MALIYET_PAYI
        FROM dbo.TODVZ_STOK_PARCALAMA_SABLON_SATIR T JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = T.STOK_KART_ID ORDER BY T.SABLON_ID, T.SATIR_NO;`);
    const rs = r.recordsets as any[];
    const sat = new Map<number, any[]>();
    for (const x of rs[1]) {
      const l = sat.get(Number(x.SABLON_ID)) || [];
      l.push({ stokKartId: Number(x.STOK_KART_ID), kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM),
        verimYuzde: x.VERIM_YUZDE === null ? null : Number(x.VERIM_YUZDE), maliyetPayi: x.MALIYET_PAYI === null ? null : Number(x.MALIYET_PAYI) });
      sat.set(Number(x.SABLON_ID), l);
    }
    return rs[0].map((x: any) => ({ sablonId: Number(x.SABLON_ID), ad: temiz(x.AD), girdiKartId: Number(x.GIRDI_KART_ID), girdiKod: temiz(x.KOD), girdiAd: temiz(x.KART_AD),
      girdiBirim: temiz(x.BIRIM), aciklama: x.ACIKLAMA ? temiz(x.ACIKLAMA) : null, satirlar: sat.get(Number(x.SABLON_ID)) || [] }));
  }

  static async sablonKaydet(g: SablonGirdi, kullaniciId: number | undefined, ctx?: DbBaglam) {
    const ad = temiz(g.ad).slice(0, 100);
    if (!ad) throw ApiError.badRequest("Şablon adı yazılmalı.");
    const girdiKartId = Number(g.girdiKartId) || 0;
    if (!girdiKartId) throw ApiError.badRequest("Şablonda parçalanacak ürün seçilmeli.");
    const satirlar = (g.satirlar || []).filter((s) => s && Number(s.stokKartId) > 0);
    if (!satirlar.length) throw ApiError.badRequest("Şablonda en az bir parça olmalı.");
    const kartlar = satirlar.map((s) => Number(s.stokKartId));
    if (new Set(kartlar).size !== kartlar.length) throw ApiError.badRequest("Aynı parça şablonda iki kez yazılmış.");
    if (kartlar.includes(girdiKartId)) throw ApiError.badRequest("Parçalanan ürünün kendisi parça olamaz.");
    const yuzde = (v: unknown, ad2: string, i: number): number | null => {
      if (v === null || v === undefined || String(v).trim() === "") return null;
      const n = sayi(v);
      if (!Number.isFinite(n) || n < 0 || n > 100) throw ApiError.badRequest(`${i + 1}. parça: ${ad2} 0 ile 100 arasında olmalı.`);
      return Math.round(n * 10000) / 10000;
    };
    const temizSatir = satirlar.map((s, i) => ({ stokKartId: Number(s.stokKartId), verim: yuzde(s.verimYuzde, "verim %", i), pay: yuzde(s.maliyetPayi, "maliyet payı %", i) }));
    const verimTop = temizSatir.reduce((t, s) => t + (s.verim || 0), 0);
    if (verimTop > 100.0001) throw ApiError.badRequest(`Verim yüzdelerinin toplamı %100'ü aşıyor (%${Math.round(verimTop * 100) / 100}).`);
    const payTop = temizSatir.reduce((t, s) => t + (s.pay || 0), 0);
    if (temizSatir.some((s) => s.pay !== null) && Math.abs(payTop - 100) > 0.01) throw ApiError.badRequest(`Maliyet paylarının toplamı %100 olmalı (şu an %${Math.round(payTop * 100) / 100}).`);
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    let id = Number(g.sablonId) || 0;
    try {
      const kq = await new sql.Request(tx).query(`SELECT STOK_KART_ID FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${[girdiKartId, ...kartlar].join(",")})`);
      const var_ = new Set(kq.recordset.map((x: any) => Number(x.STOK_KART_ID)));
      const yok = [girdiKartId, ...kartlar].find((x) => !var_.has(x));
      if (yok) throw ApiError.badRequest(`Stok kartı bulunamadı (#${yok}).`);
      const ayni = await new sql.Request(tx).input("AD", sql.NVarChar(100), ad).input("ID", sql.Int, id).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_PARCALAMA_SABLON WITH (UPDLOCK, HOLDLOCK) WHERE AD = @AD AND SABLON_ID <> @ID`);
      if (ayni.recordset.length) throw ApiError.badRequest(`"${ad}" adında bir şablon zaten var.`);
      const req = new sql.Request(tx).input("ID", sql.Int, id).input("AD", sql.NVarChar(100), ad).input("GK", sql.Int, girdiKartId).input("A", sql.NVarChar(250), temiz(g.aciklama).slice(0, 250) || null).input("KUL", sql.Int, kullaniciId || null);
      if (id) {
        const u = await req.query(`UPDATE dbo.TODVZ_STOK_PARCALAMA_SABLON SET AD = @AD, GIRDI_KART_ID = @GK, ACIKLAMA = @A, GUNCELLEME_ZAMANI = GETDATE() WHERE SABLON_ID = @ID; SELECT @@ROWCOUNT AS N;`);
        if (!Number(u.recordset[0]?.N)) throw ApiError.notFound("Parçalama şablonu bulunamadı.");
        await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_PARCALAMA_SABLON_SATIR WHERE SABLON_ID = @ID`);
      } else {
        id = (await req.query(`INSERT INTO dbo.TODVZ_STOK_PARCALAMA_SABLON (AD, GIRDI_KART_ID, ACIKLAMA, EKLEYEN_ID) OUTPUT INSERTED.SABLON_ID VALUES (@AD, @GK, @A, @KUL)`)).recordset[0].SABLON_ID;
      }
      const r2 = new sql.Request(tx).input("ID", sql.Int, id);
      const v = temizSatir.map((s, j) => {
        r2.input(`N${j}`, sql.Int, j + 1).input(`K${j}`, sql.Int, s.stokKartId).input(`V${j}`, sql.Decimal(9, 4), s.verim).input(`P${j}`, sql.Decimal(9, 4), s.pay);
        return `(@ID, @N${j}, @K${j}, @V${j}, @P${j})`;
      });
      await r2.query(`INSERT INTO dbo.TODVZ_STOK_PARCALAMA_SABLON_SATIR (SABLON_ID, SATIR_NO, STOK_KART_ID, VERIM_YUZDE, MALIYET_PAYI) VALUES ${v.join(",")}`);
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
    return (await this.sablonlar(ctx)).find((x: any) => x.sablonId === id);
  }

  static async sablonSil(id: number, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_PARCALAMA_SABLON WITH (UPDLOCK) WHERE SABLON_ID = @ID`);
      if (!e.recordset.length) throw ApiError.notFound("Parçalama şablonu bulunamadı.");
      // Şablonla yazılmış fişler kalır; şablon bağı boşalır
      await new sql.Request(tx).input("ID", sql.Int, id).query(`UPDATE dbo.TODVZ_STOK_PARCALAMA SET SABLON_ID = NULL WHERE SABLON_ID = @ID;
        DELETE FROM dbo.TODVZ_STOK_PARCALAMA_SABLON_SATIR WHERE SABLON_ID = @ID; DELETE FROM dbo.TODVZ_STOK_PARCALAMA_SABLON WHERE SABLON_ID = @ID;`);
      await tx.commit();
    } catch (err) {
      await tx.rollback().catch(() => undefined);
      throw err;
    }
  }
}

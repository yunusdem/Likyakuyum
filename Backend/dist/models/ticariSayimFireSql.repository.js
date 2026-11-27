import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { FIRE_NEDENLERI, sayimFarki, stokMiktariDenetle } from "../services/ticari/ticariHesap.js";
import { STOK_BELGE, TicariStokSqlRepository, receteliReddet, stokIslemKilidi } from "./ticariStokSql.repository.js";
import { bakiyeler, eksiStokDenetle } from "./ticariGirisSql.repository.js";
import { TicariKarSqlRepository } from "./ticariKarSql.repository.js";
/**
 * Ticari sayım fişi (TA11) ve fire / zayi fişi (TA12) — docs/TICARI_ADISYON_YOL_HARITASI.md.
 * Sayım: taslak (sayılanlar yazılır, stok değişmez) → onay: her satırın sistem miktarı sayım anındaki bakiye (TARIH ≤ sayım
 *   anı; bu sayımın kendi hareketi hariç), fark stok hareketi (BELGE_TURU 3; fazla GİRİŞ, eksik ÇIKIŞ). "Sayılmayanlar sıfır"
 *   seçilirse süzgeçteki (grup ya da tümü) aktif kartlardan sayılmayıp bakiyesi sıfır olmayanlar 0 sayılmış kabul edilir.
 *   Daha sonraki tarihli onaylı bir sayımda aynı kart varsa onay / geri alma reddedilir (sonraki sayımın farkı bozulmasın).
 * Fire: neden + miktar; stok düşer (BELGE_TURU 4, ÇIKIŞ); satıra o anki birim maliyet yazılır; eksi stok kuralı uygulanır.
 */
const temiz = (v) => String(v ?? "").trim();
const sayi = (v) => {
    if (typeof v === "string")
        v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
    return Number(v);
};
const y4 = (n) => Math.round(n * 10000) / 10000;
const tarihOku = (v, ad) => {
    const t = v ? new Date(String(v)) : new Date();
    if (Number.isNaN(t.getTime()))
        throw ApiError.badRequest(`${ad} okunamadı.`);
    return t;
};
/** Ön ek + yıl + 6 hane (SY2026000001 / FR2026000001); en büyük + 1, işlem kilidiyle */
export async function yeniNo(tx, tablo, kolon, onEk, tarih) {
    const o = `${onEk}${tarih.getFullYear()}`;
    const r = await new sql.Request(tx).input("O", sql.VarChar(10), o).query(`
    SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(${kolon}, 7, 20) AS INT)), 0) + 1 AS N FROM dbo.${tablo} WITH (UPDLOCK, HOLDLOCK) WHERE ${kolon} LIKE @O + '%' AND LEN(${kolon}) = 12`);
    return `${o}${String(Number(r.recordset[0].N) || 1).padStart(6, "0")}`;
}
export class TicariSayimSqlRepository {
    /** Sayım listesi için kartlar: süzgeçteki aktif kartlar + sayım anındaki sistem miktarı (sayımın kendi hareketi hariç) */
    static async kartlar(f, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tarih = tarihOku(f.tarih, "Sayım tarihi");
        const r = await pool.request().input("G", sql.Int, f.stokGrupId || null).input("T", sql.DateTime, tarih).input("S", sql.Int, f.sayimId || 0).input("TUR", sql.TinyInt, STOK_BELGE.SAYIM)
            .query(`SELECT K.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, K.BIRIM, RTRIM(ISNULL(G.AD, '')) AS GRUP,
          ROUND(ISNULL((SELECT SUM(H.GIRIS - H.CIKIS) FROM dbo.TODVZ_STOK_HAREKET H WHERE H.STOK_KART_ID = K.STOK_KART_ID AND H.TARIH <= @T
            AND NOT (H.BELGE_TURU = @TUR AND H.BELGE_ID = @S)), 0), 4) AS SISTEM
        FROM dbo.TODVZ_STOK_KART K LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID
        WHERE ISNULL(K.AKTIF, 1) = 1 AND (@G IS NULL OR K.STOK_GRUP_ID = @G) ORDER BY G.AD, K.AD`);
        return r.recordset.map((x) => ({ stokKartId: Number(x.STOK_KART_ID), kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM), grup: temiz(x.GRUP), sistem: Number(x.SISTEM) || 0 }));
    }
    /** Taslağı yazar (yeni ya da düzeltme). Onaylı sayım düzeltilmez. */
    static async kaydet(g, kullaniciId, ctx) {
        const tarih = tarihOku(g.tarih, "Sayım tarihi");
        const satirlar = (g.satirlar || []).filter((s) => s && Number(s.stokKartId) > 0);
        const gorulen = new Set();
        for (const [i, s] of satirlar.entries()) {
            const h = stokMiktariDenetle(s.sayilan, true);
            if (h)
                throw ApiError.badRequest(`${i + 1}. satır: ${h}`);
            if (gorulen.has(Number(s.stokKartId)))
                throw ApiError.badRequest(`${i + 1}. satır: aynı kart sayımda iki kez var; miktarları tek satırda toplayın.`);
            gorulen.add(Number(s.stokKartId));
        }
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        await stokIslemKilidi(tx);
        let id = Number(g.sayimId) || 0;
        try {
            if (g.stokGrupId) {
                const gr = await new sql.Request(tx).input("G", sql.Int, g.stokGrupId).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_GRUP WHERE STOK_GRUP_ID = @G`);
                if (!gr.recordset.length)
                    throw ApiError.badRequest("Seçilen ürün grubu bulunamadı.");
            }
            const kartlar = new Map();
            if (satirlar.length) {
                const k = await new sql.Request(tx).query(`SELECT STOK_KART_ID, BIRIM FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${[...gorulen].join(",")})`);
                for (const x of k.recordset)
                    kartlar.set(Number(x.STOK_KART_ID), temiz(x.BIRIM) || "Adet");
                const yok = [...gorulen].find((x) => !kartlar.has(x));
                if (yok)
                    throw ApiError.badRequest(`Stok kartı bulunamadı (#${yok}).`);
                await receteliReddet(tx, [...gorulen], "sayım");
            }
            const bas = new sql.Request(tx).input("ID", sql.Int, id).input("T", sql.DateTime, tarih).input("G", sql.Int, g.stokGrupId || null)
                .input("A", sql.NVarChar(250), temiz(g.aciklama).slice(0, 250) || null).input("KUL", sql.Int, kullaniciId || null);
            if (id) {
                const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT DURUM FROM dbo.TODVZ_STOK_SAYIM WITH (UPDLOCK) WHERE SAYIM_ID = @ID`);
                if (!e.recordset.length)
                    throw ApiError.notFound("Sayım fişi bulunamadı.");
                if (Number(e.recordset[0].DURUM) === 1)
                    throw ApiError.badRequest("Onaylanmış sayım düzeltilemez; önce onayı geri alın.");
                await bas.query(`UPDATE dbo.TODVZ_STOK_SAYIM SET TARIH = @T, STOK_GRUP_ID = @G, ACIKLAMA = @A, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() WHERE SAYIM_ID = @ID;
          DELETE FROM dbo.TODVZ_STOK_SAYIM_SATIR WHERE SAYIM_ID = @ID;`);
            }
            else {
                bas.input("NO", sql.VarChar(20), await yeniNo(tx, "TODVZ_STOK_SAYIM", "SAYIM_NO", "SY", tarih));
                id = (await bas.query(`INSERT INTO dbo.TODVZ_STOK_SAYIM (SAYIM_NO, TARIH, STOK_GRUP_ID, ACIKLAMA, DURUM, EKLEYEN_ID) OUTPUT INSERTED.SAYIM_ID VALUES (@NO, @T, @G, @A, 0, @KUL)`)).recordset[0].SAYIM_ID;
            }
            for (let i = 0; i < satirlar.length; i += 300) {
                const req = new sql.Request(tx).input("ID", sql.Int, id);
                const v = satirlar.slice(i, i + 300).map((s, j) => {
                    req.input(`K${j}`, sql.Int, Number(s.stokKartId)).input(`N${j}`, sql.Int, i + j + 1).input(`B${j}`, sql.VarChar(20), kartlar.get(Number(s.stokKartId)) || "Adet")
                        .input(`M${j}`, sql.Decimal(18, 4), y4(sayi(s.sayilan)));
                    return `(@ID, @K${j}, @N${j}, @B${j}, @M${j})`;
                });
                await req.query(`INSERT INTO dbo.TODVZ_STOK_SAYIM_SATIR (SAYIM_ID, STOK_KART_ID, SATIR_NO, BIRIM, SAYILAN) VALUES ${v.join(",")}`);
            }
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        return this.getir(id, ctx);
    }
    /** Aynı kartı içeren, bu sayımdan sonraki tarihli onaylı sayım (varsa numarası) */
    static async sonrakiSayim(tx, id) {
        const r = await new sql.Request(tx).input("ID", sql.Int, id).query(`
      SELECT TOP 1 RTRIM(B.SAYIM_NO) AS NO FROM dbo.TODVZ_STOK_SAYIM A JOIN dbo.TODVZ_STOK_SAYIM B ON B.SAYIM_ID <> A.SAYIM_ID AND B.DURUM = 1
        AND (B.TARIH > A.TARIH OR (B.TARIH = A.TARIH AND B.SAYIM_ID > A.SAYIM_ID))
      WHERE A.SAYIM_ID = @ID AND EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_SAYIM_SATIR X JOIN dbo.TODVZ_STOK_SAYIM_SATIR Y ON Y.STOK_KART_ID = X.STOK_KART_ID
        WHERE X.SAYIM_ID = A.SAYIM_ID AND Y.SAYIM_ID = B.SAYIM_ID)
      ORDER BY B.TARIH`);
        return r.recordset[0]?.NO ? temiz(r.recordset[0].NO) : null;
    }
    /** Onay: sistem miktarı + fark hareketi. sayilmayanSifir: süzgeçte sayılmayan, bakiyesi sıfır olmayan aktif kartlar 0 sayılır. */
    static async onayla(id, o, kullaniciId, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        await stokIslemKilidi(tx);
        try {
            const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT DURUM, TARIH, STOK_GRUP_ID FROM dbo.TODVZ_STOK_SAYIM WITH (UPDLOCK, HOLDLOCK) WHERE SAYIM_ID = @ID`);
            if (!e.recordset.length)
                throw ApiError.notFound("Sayım fişi bulunamadı.");
            if (Number(e.recordset[0].DURUM) === 1)
                throw ApiError.badRequest("Sayım zaten onaylanmış.");
            const q = () => new sql.Request(tx).input("ID", sql.Int, id).input("TUR", sql.TinyInt, STOK_BELGE.SAYIM).input("KUL", sql.Int, kullaniciId || null);
            if (o.sayilmayanSifir) {
                await q().query(`
          DECLARE @T DATETIME, @G INT, @N INT;
          SELECT @T = TARIH, @G = STOK_GRUP_ID FROM dbo.TODVZ_STOK_SAYIM WHERE SAYIM_ID = @ID;
          SELECT @N = ISNULL(MAX(SATIR_NO), 0) FROM dbo.TODVZ_STOK_SAYIM_SATIR WHERE SAYIM_ID = @ID;
          INSERT INTO dbo.TODVZ_STOK_SAYIM_SATIR (SAYIM_ID, STOK_KART_ID, SATIR_NO, BIRIM, SAYILAN)
          SELECT @ID, K.STOK_KART_ID, @N + ROW_NUMBER() OVER (ORDER BY K.STOK_KART_ID), ISNULL(NULLIF(RTRIM(K.BIRIM), ''), 'Adet'), 0
          FROM dbo.TODVZ_STOK_KART K
          WHERE ISNULL(K.AKTIF, 1) = 1 AND (@G IS NULL OR K.STOK_GRUP_ID = @G)
            AND NOT EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_SAYIM_SATIR S WHERE S.SAYIM_ID = @ID AND S.STOK_KART_ID = K.STOK_KART_ID)
            AND ABS(ISNULL((SELECT SUM(H.GIRIS - H.CIKIS) FROM dbo.TODVZ_STOK_HAREKET H WHERE H.STOK_KART_ID = K.STOK_KART_ID AND H.TARIH <= @T), 0)) >= 0.00005;`);
            }
            const say = Number((await q().query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_STOK_SAYIM_SATIR WHERE SAYIM_ID = @ID`)).recordset[0].N);
            if (!say)
                throw ApiError.badRequest("Sayımda sayılmış kalem yok.");
            const sonraki = await this.sonrakiSayim(tx, id);
            if (sonraki)
                throw ApiError.badRequest(`Aynı ürünleri içeren daha sonraki tarihli onaylı sayım var (${sonraki}); önce onun onayını geri alın.`);
            // Sayım farkının birim maliyeti: sayım anındaki hareketli ortalama (TA15)
            const bilgi = (await q().query(`SELECT STOK_KART_ID FROM dbo.TODVZ_STOK_SAYIM_SATIR WHERE SAYIM_ID = @ID`)).recordset;
            const ort = await TicariKarSqlRepository.ortalamalar(tx, bilgi.map((x) => Number(x.STOK_KART_ID)), { sayimId: id });
            // Geçici tablo yok (parametreli sorgu sp_executesql içinde koşar, orada açılan #tablo sorgu bitince düşer); 2100 parametre sınırına takılmamak için
            // sayısal değerler (JS'te hesaplanmış, kullanıcı metni değil) sorguya sayı olarak yazılır
            const degerler = [...ort.entries()].map(([kid, v]) => `(${Math.trunc(Number(kid))}, CAST(${Number.isFinite(v) ? v : 0} AS FLOAT))`);
            await q().query(`
        DECLARE @T DATETIME = (SELECT TARIH FROM dbo.TODVZ_STOK_SAYIM WHERE SAYIM_ID = @ID);
        UPDATE S SET SISTEM = ROUND(ISNULL((SELECT SUM(H.GIRIS - H.CIKIS) FROM dbo.TODVZ_STOK_HAREKET H
          WHERE H.STOK_KART_ID = S.STOK_KART_ID AND H.TARIH <= @T AND NOT (H.BELGE_TURU = @TUR AND H.BELGE_ID = @ID)), 0), 4)
        FROM dbo.TODVZ_STOK_SAYIM_SATIR S WHERE S.SAYIM_ID = @ID;
        INSERT INTO dbo.TODVZ_STOK_HAREKET (STOK_KART_ID, TARIH, BELGE_TURU, BELGE_ID, SATIR_NO, GIRIS, CIKIS, BIRIM_FIYAT, EKLEYEN_ID)
        SELECT S.STOK_KART_ID, @T, @TUR, @ID, S.SATIR_NO,
          CASE WHEN S.SAYILAN > S.SISTEM THEN S.SAYILAN - S.SISTEM ELSE 0 END, CASE WHEN S.SAYILAN < S.SISTEM THEN S.SISTEM - S.SAYILAN ELSE 0 END,
          ISNULL(M.ORT, 0), @KUL
        FROM dbo.TODVZ_STOK_SAYIM_SATIR S JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID LEFT JOIN (VALUES ${degerler.length ? degerler.join(",") : "(0, CAST(0 AS FLOAT))"}) M(ID, ORT) ON M.ID = S.STOK_KART_ID
        WHERE S.SAYIM_ID = @ID AND ABS(S.SAYILAN - S.SISTEM) >= 0.00005 ORDER BY S.SATIR_NO;
        UPDATE dbo.TODVZ_STOK_SAYIM SET DURUM = 1, ONAYLAYAN_ID = @KUL, ONAY_ZAMANI = GETDATE() WHERE SAYIM_ID = @ID;`);
            await tx.commit();
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            throw err;
        }
        return this.getir(id, ctx);
    }
    /** Onayı geri alır: fark hareketleri silinir, sistem miktarları temizlenir, fiş taslağa döner */
    static async geriAl(id, onay, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        await stokIslemKilidi(tx);
        try {
            const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT DURUM FROM dbo.TODVZ_STOK_SAYIM WITH (UPDLOCK, HOLDLOCK) WHERE SAYIM_ID = @ID`);
            if (!e.recordset.length)
                throw ApiError.notFound("Sayım fişi bulunamadı.");
            if (Number(e.recordset[0].DURUM) !== 1)
                throw ApiError.badRequest("Sayım onaylı değil.");
            const sonraki = await this.sonrakiSayim(tx, id);
            if (sonraki)
                throw ApiError.badRequest(`Aynı ürünleri içeren daha sonraki tarihli onaylı sayım var (${sonraki}); önce onun onayını geri alın.`);
            const kartlar = (await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT STOK_KART_ID FROM dbo.TODVZ_STOK_SAYIM_SATIR WHERE SAYIM_ID = @ID`)).recordset.map((x) => Number(x.STOK_KART_ID));
            const onceki = await bakiyeler(tx, kartlar);
            await new sql.Request(tx).input("ID", sql.Int, id).input("TUR", sql.TinyInt, STOK_BELGE.SAYIM).query(`
        DELETE FROM dbo.TODVZ_STOK_HAREKET WHERE BELGE_TURU = @TUR AND BELGE_ID = @ID;
        UPDATE dbo.TODVZ_STOK_SAYIM_SATIR SET SISTEM = NULL WHERE SAYIM_ID = @ID;
        UPDATE dbo.TODVZ_STOK_SAYIM SET DURUM = 0, ONAYLAYAN_ID = NULL, ONAY_ZAMANI = NULL WHERE SAYIM_ID = @ID;`);
            // Sayım fazlası geri alınınca bakiye eksiye düşebilir (arada satış olduysa): eksi stok kuralı
            await eksiStokDenetle(tx, onceki, onay);
            await tx.commit();
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            throw err;
        }
        return this.getir(id, ctx);
    }
    /** Taslak silinir; onaylı sayım önce geri alınmalı */
    static async sil(id, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        await stokIslemKilidi(tx);
        try {
            const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT DURUM FROM dbo.TODVZ_STOK_SAYIM WITH (UPDLOCK) WHERE SAYIM_ID = @ID`);
            if (!e.recordset.length)
                throw ApiError.notFound("Sayım fişi bulunamadı.");
            if (Number(e.recordset[0].DURUM) === 1)
                throw ApiError.badRequest("Onaylanmış sayım silinmez; önce onayı geri alın.");
            await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_SAYIM_SATIR WHERE SAYIM_ID = @ID; DELETE FROM dbo.TODVZ_STOK_SAYIM WHERE SAYIM_ID = @ID;`);
            await tx.commit();
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            throw err;
        }
    }
    static async getir(id, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const r = await pool.request().input("ID", sql.Int, id).input("TUR", sql.TinyInt, STOK_BELGE.SAYIM).query(`
      SELECT S.*, RTRIM(ISNULL(G.AD, '')) AS GRUP, RTRIM(ISNULL(U.AD, '')) AS EKLEYEN, RTRIM(ISNULL(O.AD, '')) AS ONAYLAYAN
      FROM dbo.TODVZ_STOK_SAYIM S LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = S.STOK_GRUP_ID
      LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID = S.EKLEYEN_ID LEFT JOIN dbo.TODVZ_KULLANICI O ON O.KULLANICI_ID = S.ONAYLAYAN_ID WHERE S.SAYIM_ID = @ID;
      SELECT X.STOK_KART_ID, X.SATIR_NO, X.BIRIM, X.SAYILAN, X.SISTEM, RTRIM(K.KOD) AS KOD, K.AD, RTRIM(ISNULL(G.AD, '')) AS GRUP,
        ISNULL(H.GIRIS, 0) - ISNULL(H.CIKIS, 0) AS FARK
      FROM dbo.TODVZ_STOK_SAYIM_SATIR X JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = X.STOK_KART_ID LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID
      LEFT JOIN dbo.TODVZ_STOK_HAREKET H ON H.BELGE_TURU = @TUR AND H.BELGE_ID = X.SAYIM_ID AND H.SATIR_NO = X.SATIR_NO
      WHERE X.SAYIM_ID = @ID ORDER BY X.SATIR_NO;`);
        const rs = r.recordsets;
        const s = rs[0][0];
        if (!s)
            throw ApiError.notFound("Sayım fişi bulunamadı.");
        const satirlar = rs[1].map((x) => {
            const onayli = Number(s.DURUM) === 1;
            const sistem = x.SISTEM === null || x.SISTEM === undefined ? null : Number(x.SISTEM);
            return {
                stokKartId: Number(x.STOK_KART_ID), satirNo: Number(x.SATIR_NO), kod: temiz(x.KOD), ad: temiz(x.AD), grup: temiz(x.GRUP), birim: temiz(x.BIRIM),
                sayilan: Number(x.SAYILAN), sistem, fark: onayli ? y4(Number(x.FARK) || 0) : null,
            };
        });
        const fazla = satirlar.filter((x) => (x.fark || 0) > 0), eksik = satirlar.filter((x) => (x.fark || 0) < 0);
        return {
            sayimId: Number(s.SAYIM_ID), sayimNo: temiz(s.SAYIM_NO), tarih: new Date(s.TARIH).toISOString(), stokGrupId: s.STOK_GRUP_ID ?? null, grup: temiz(s.GRUP),
            aciklama: s.ACIKLAMA ? temiz(s.ACIKLAMA) : null, durum: Number(s.DURUM), ekleyen: temiz(s.EKLEYEN), onaylayan: temiz(s.ONAYLAYAN),
            onayZamani: s.ONAY_ZAMANI ? new Date(s.ONAY_ZAMANI).toISOString() : null,
            satirlar, ozet: { kalem: satirlar.length, fazlaKalem: fazla.length, eksikKalem: eksik.length },
        };
    }
    static async liste(f = {}, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const req = pool.request();
        const k = [];
        const gun = "CAST(DATEADD(hour, 3, S.TARIH) AS date)";
        if (f.baslangic) {
            req.input("B", sql.VarChar(10), temiz(f.baslangic).slice(0, 10));
            k.push(`${gun} >= CAST(@B AS date)`);
        }
        if (f.bitis) {
            req.input("E", sql.VarChar(10), temiz(f.bitis).slice(0, 10));
            k.push(`${gun} <= CAST(@E AS date)`);
        }
        if (f.durum === 0 || f.durum === 1) {
            req.input("D", sql.TinyInt, f.durum);
            k.push("S.DURUM = @D");
        }
        const r = await req.input("TUR", sql.TinyInt, STOK_BELGE.SAYIM).query(`
      SELECT TOP 500 S.SAYIM_ID, S.SAYIM_NO, S.TARIH, S.DURUM, S.ACIKLAMA, RTRIM(ISNULL(G.AD, '')) AS GRUP,
        (SELECT COUNT(*) FROM dbo.TODVZ_STOK_SAYIM_SATIR X WHERE X.SAYIM_ID = S.SAYIM_ID) AS KALEM,
        (SELECT COUNT(*) FROM dbo.TODVZ_STOK_HAREKET H WHERE H.BELGE_TURU = @TUR AND H.BELGE_ID = S.SAYIM_ID) AS FARKLI
      FROM dbo.TODVZ_STOK_SAYIM S LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = S.STOK_GRUP_ID
      ${k.length ? `WHERE ${k.join(" AND ")}` : ""} ORDER BY S.TARIH DESC, S.SAYIM_ID DESC`);
        return r.recordset.map((x) => ({ sayimId: Number(x.SAYIM_ID), sayimNo: temiz(x.SAYIM_NO), tarih: new Date(x.TARIH).toISOString(), durum: Number(x.DURUM),
            aciklama: x.ACIKLAMA ? temiz(x.ACIKLAMA) : null, grup: temiz(x.GRUP), kalem: Number(x.KALEM), farkliKalem: Number(x.FARKLI) }));
    }
}
export class TicariFireSqlRepository {
    static nedenler() { return [...FIRE_NEDENLERI]; }
    static async kaydet(g, kullaniciId, ctx) {
        const tarih = tarihOku(g.tarih, "Fiş tarihi");
        const satirlar = (g.satirlar || []).filter((s) => s && Number(s.stokKartId) > 0);
        if (!satirlar.length)
            throw ApiError.badRequest("Fişte en az bir ürün satırı olmalı.");
        for (const [i, s] of satirlar.entries()) {
            const h = stokMiktariDenetle(s.miktar);
            if (h)
                throw ApiError.badRequest(`${i + 1}. satır: ${h}`);
            if (!FIRE_NEDENLERI.includes(temiz(s.neden)))
                throw ApiError.badRequest(`${i + 1}. satır: fire nedeni seçilmeli (${FIRE_NEDENLERI.join(", ")}).`);
        }
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        await stokIslemKilidi(tx);
        let id = Number(g.fireId) || 0;
        let uyari = null;
        try {
            const kartIdler = [...new Set(satirlar.map((s) => Number(s.stokKartId)))];
            const k = await new sql.Request(tx).query(`SELECT STOK_KART_ID, BIRIM FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${kartIdler.join(",")})`);
            // Fire maliyeti: fire anındaki hareketli ortalama maliyet (TA15; düzeltmede bu fişin kendi hareketi ortalamayı etkilemez — çıkış)
            const ort = await TicariKarSqlRepository.ortalamalar(tx, kartIdler, tarih);
            const kart = new Map(k.recordset.map((x) => [Number(x.STOK_KART_ID), { birim: temiz(x.BIRIM) || "Adet", maliyet: ort.get(Number(x.STOK_KART_ID)) || 0 }]));
            const yok = kartIdler.find((x) => !kart.has(x));
            if (yok)
                throw ApiError.badRequest(`Stok kartı bulunamadı (#${yok}).`);
            await receteliReddet(tx, kartIdler, "fire");
            let eskiKartlar = [];
            if (id) {
                const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_FIRE WITH (UPDLOCK) WHERE FIRE_ID = @ID;
          SELECT DISTINCT STOK_KART_ID FROM dbo.TODVZ_STOK_FIRE_SATIR WHERE FIRE_ID = @ID;`);
                if (!e.recordsets[0].length)
                    throw ApiError.notFound("Fire fişi bulunamadı.");
                eskiKartlar = e.recordsets[1].map((x) => Number(x.STOK_KART_ID));
            }
            const onceki = await bakiyeler(tx, [...kartIdler, ...eskiKartlar]);
            const bas = new sql.Request(tx).input("ID", sql.Int, id).input("T", sql.DateTime, tarih).input("A", sql.NVarChar(250), temiz(g.aciklama).slice(0, 250) || null)
                .input("KUL", sql.Int, kullaniciId || null).input("TUR", sql.TinyInt, STOK_BELGE.FIRE);
            if (id) {
                await bas.query(`DELETE FROM dbo.TODVZ_STOK_HAREKET WHERE BELGE_TURU = @TUR AND BELGE_ID = @ID; DELETE FROM dbo.TODVZ_STOK_FIRE_SATIR WHERE FIRE_ID = @ID;
          UPDATE dbo.TODVZ_STOK_FIRE SET TARIH = @T, ACIKLAMA = @A, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE() WHERE FIRE_ID = @ID;`);
            }
            else {
                bas.input("NO", sql.VarChar(20), await yeniNo(tx, "TODVZ_STOK_FIRE", "FIRE_NO", "FR", tarih));
                id = (await bas.query(`INSERT INTO dbo.TODVZ_STOK_FIRE (FIRE_NO, TARIH, ACIKLAMA, EKLEYEN_ID) OUTPUT INSERTED.FIRE_ID VALUES (@NO, @T, @A, @KUL)`)).recordset[0].FIRE_ID;
            }
            const req = new sql.Request(tx).input("ID", sql.Int, id);
            const v = satirlar.map((s, j) => {
                const kt = kart.get(Number(s.stokKartId));
                req.input(`N${j}`, sql.Int, j + 1).input(`K${j}`, sql.Int, Number(s.stokKartId)).input(`B${j}`, sql.VarChar(20), kt.birim).input(`M${j}`, sql.Decimal(18, 4), y4(sayi(s.miktar)))
                    .input(`E${j}`, sql.NVarChar(50), temiz(s.neden)).input(`C${j}`, sql.Decimal(18, 6), kt.maliyet);
                return `(@ID, @N${j}, @K${j}, @B${j}, @M${j}, @E${j}, @C${j})`;
            });
            await req.query(`INSERT INTO dbo.TODVZ_STOK_FIRE_SATIR (FIRE_ID, SATIR_NO, STOK_KART_ID, BIRIM, MIKTAR, NEDEN, BIRIM_MALIYET) VALUES ${v.join(",")}`);
            await new sql.Request(tx).input("ID", sql.Int, id).input("T", sql.DateTime, tarih).input("TUR", sql.TinyInt, STOK_BELGE.FIRE).input("KUL", sql.Int, kullaniciId || null).query(`
        INSERT INTO dbo.TODVZ_STOK_HAREKET (STOK_KART_ID, TARIH, BELGE_TURU, BELGE_ID, SATIR_NO, GIRIS, CIKIS, BIRIM_FIYAT, EKLEYEN_ID)
        SELECT STOK_KART_ID, @T, @TUR, @ID, SATIR_NO, 0, MIKTAR, BIRIM_MALIYET, @KUL FROM dbo.TODVZ_STOK_FIRE_SATIR WHERE FIRE_ID = @ID ORDER BY SATIR_NO`);
            const eksi = await eksiStokDenetle(tx, onceki, g.eksiStokOnay);
            if (eksi.length)
                uyari = `Eksiye düşen stok: ${eksi.map((x) => `${x.kod} ${x.ad} (${x.sonraki})`).join(", ")}`;
            await tx.commit();
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            throw err;
        }
        return { fis: await this.getir(id, ctx), uyari };
    }
    static async sil(id, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        await stokIslemKilidi(tx);
        try {
            const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_FIRE WITH (UPDLOCK) WHERE FIRE_ID = @ID`);
            if (!e.recordset.length)
                throw ApiError.notFound("Fire fişi bulunamadı.");
            await new sql.Request(tx).input("ID", sql.Int, id).input("TUR", sql.TinyInt, STOK_BELGE.FIRE).query(`
        DELETE FROM dbo.TODVZ_STOK_HAREKET WHERE BELGE_TURU = @TUR AND BELGE_ID = @ID;
        DELETE FROM dbo.TODVZ_STOK_FIRE_SATIR WHERE FIRE_ID = @ID; DELETE FROM dbo.TODVZ_STOK_FIRE WHERE FIRE_ID = @ID;`);
            await tx.commit();
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            throw err;
        }
    }
    static async getir(id, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const r = await pool.request().input("ID", sql.Int, id).query(`
      SELECT F.*, RTRIM(ISNULL(U.AD, '')) AS EKLEYEN FROM dbo.TODVZ_STOK_FIRE F LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID = F.EKLEYEN_ID WHERE F.FIRE_ID = @ID;
      SELECT S.*, RTRIM(K.KOD) AS KOD, K.AD FROM dbo.TODVZ_STOK_FIRE_SATIR S JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID WHERE S.FIRE_ID = @ID ORDER BY S.SATIR_NO;`);
        const rs = r.recordsets;
        const f = rs[0][0];
        if (!f)
            throw ApiError.notFound("Fire fişi bulunamadı.");
        const satirlar = rs[1].map((x) => ({ satirNo: Number(x.SATIR_NO), stokKartId: Number(x.STOK_KART_ID), kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM),
            miktar: Number(x.MIKTAR), neden: temiz(x.NEDEN), birimMaliyet: Number(x.BIRIM_MALIYET), maliyet: Math.round(Number(x.MIKTAR) * Number(x.BIRIM_MALIYET) * 100) / 100 }));
        return { fireId: Number(f.FIRE_ID), fireNo: temiz(f.FIRE_NO), tarih: new Date(f.TARIH).toISOString(), aciklama: f.ACIKLAMA ? temiz(f.ACIKLAMA) : null, ekleyen: temiz(f.EKLEYEN),
            satirlar, toplamMaliyet: Math.round(satirlar.reduce((a, x) => a + x.maliyet, 0) * 100) / 100 };
    }
    /** Fire listesi (satır bazında; neden ve kart süzgeci) */
    static async liste(f = {}, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const req = pool.request();
        const k = [];
        const gun = "CAST(DATEADD(hour, 3, F.TARIH) AS date)";
        if (f.baslangic) {
            req.input("B", sql.VarChar(10), temiz(f.baslangic).slice(0, 10));
            k.push(`${gun} >= CAST(@B AS date)`);
        }
        if (f.bitis) {
            req.input("E", sql.VarChar(10), temiz(f.bitis).slice(0, 10));
            k.push(`${gun} <= CAST(@E AS date)`);
        }
        if (temiz(f.neden)) {
            req.input("N", sql.NVarChar(50), temiz(f.neden));
            k.push("S.NEDEN = @N");
        }
        if (f.stokKartId) {
            req.input("K", sql.Int, f.stokKartId);
            k.push("S.STOK_KART_ID = @K");
        }
        const r = await req.query(`
      SELECT TOP 2000 F.FIRE_ID, F.FIRE_NO, F.TARIH, S.SATIR_NO, S.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, S.BIRIM, S.MIKTAR, S.NEDEN, S.BIRIM_MALIYET
      FROM dbo.TODVZ_STOK_FIRE F JOIN dbo.TODVZ_STOK_FIRE_SATIR S ON S.FIRE_ID = F.FIRE_ID JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID
      ${k.length ? `WHERE ${k.join(" AND ")}` : ""} ORDER BY F.TARIH DESC, F.FIRE_ID DESC, S.SATIR_NO`);
        const satirlar = r.recordset.map((x) => ({ fireId: Number(x.FIRE_ID), fireNo: temiz(x.FIRE_NO), tarih: new Date(x.TARIH).toISOString(), satirNo: Number(x.SATIR_NO),
            stokKartId: Number(x.STOK_KART_ID), kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM), miktar: Number(x.MIKTAR), neden: temiz(x.NEDEN),
            maliyet: Math.round(Number(x.MIKTAR) * Number(x.BIRIM_MALIYET) * 100) / 100 }));
        const nedenler = new Map();
        for (const x of satirlar)
            nedenler.set(x.neden, Math.round(((nedenler.get(x.neden) || 0) + x.maliyet) * 100) / 100);
        return { satirlar, toplamMaliyet: Math.round(satirlar.reduce((a, x) => a + x.maliyet, 0) * 100) / 100, nedenler: [...nedenler.entries()].map(([neden, maliyet]) => ({ neden, maliyet })) };
    }
}
export { sayimFarki };

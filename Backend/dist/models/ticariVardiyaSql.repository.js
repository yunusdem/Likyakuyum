import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { TL_PARA_SQL } from "../services/rapor/raporOrtak.js";
import { VEZNE_BELGE, VEZNE_HAREKET_KOLONLARI, belgeTablolari, vezneHareketleriSql } from "../services/rapor/kaynak.js";
import { kupurDenetle, kupurToplami, odemeAraciAdi, vardiyaFarki, vardiyaNakdi, yuvarla2 } from "../services/ticari/ticariHesap.js";
import { TicariStokSqlRepository } from "./ticariStokSql.repository.js";
const temiz = (v) => String(v ?? "").trim();
const tutar = (v, ad) => {
    let s = v;
    if (typeof s === "string")
        s = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
    const n = Number(s);
    if (s === null || s === undefined || s === "" || !Number.isFinite(n))
        throw ApiError.badRequest(`${ad} yazılmalı.`);
    if (n < 0)
        throw ApiError.badRequest(`${ad} eksi olamaz.`);
    if (n > 999_999_999)
        throw ApiError.badRequest(`${ad} çok büyük.`);
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6)
        throw ApiError.badRequest(`${ad} en çok 2 ondalık hane olabilir.`);
    return yuvarla2(n);
};
/** Türkiye saati: GETDATE() saatindeki değeri sunucu saat diliminden bağımsız olarak Türkiye duvar saatine çevirir */
const TR = (kolon) => `CONVERT(varchar(16), DATEADD(MINUTE, DATEDIFF(MINUTE, GETDATE(), DATEADD(HOUR, 3, GETUTCDATE())), ${kolon}), 120)`;
const TR_DUZ = (kolon) => `CONVERT(varchar(16), ${kolon}, 120)`;
export class TicariVardiyaSqlRepository {
    static async havuz(ctx) {
        return TicariStokSqlRepository.havuz(ctx);
    }
    /** Stok Ayarları: satış için açık vardiya şartı */
    static async zorunluMu(ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().query(`SELECT TOP 1 DEGER FROM dbo.TODVZ_STOK_AYAR WHERE ANAHTAR = 'VARDIYA_ZORUNLU'`);
        return temiz(r.recordset[0]?.DEGER).toUpperCase() === "EVET";
    }
    /** Veznede açık vardiya kimliği (yoksa null) */
    static async acikVardiyaId(vezneId, ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().input("V", sql.Int, vezneId).query(`SELECT VARDIYA_ID FROM dbo.TODVZ_TICARI_VARDIYA WHERE VEZNE_ID = @V AND KAPANIS_ZAMANI IS NULL`);
        return r.recordset[0] ? Number(r.recordset[0].VARDIYA_ID) : null;
    }
    /** Satış / iade kaydından önce: ayar açıksa veznede açık vardiya şart */
    static async satisIcinDenetle(vezneId, ctx) {
        if (!(await this.zorunluMu(ctx)))
            return;
        if (!(await this.acikVardiyaId(vezneId, ctx)))
            throw ApiError.badRequest("Veznenizde açık vardiya yok. Önce Ticari › Vardiya ekranından kasayı açın (devir nakdini yazın).");
    }
    static async vezne(istek, vezneId) {
        const r = await istek().input("V", sql.Int, vezneId).query(`SELECT VEZNE_ID, RTRIM(ISNULL(KOD,'')) AS KOD, RTRIM(ISNULL(AD,'')) AS AD FROM dbo.TODVZ_VEZNE WHERE VEZNE_ID = @V`);
        const v = r.recordset[0];
        if (!v)
            throw ApiError.notFound("Vezne bulunamadı.");
        return { vezneId: Number(v.VEZNE_ID), kod: temiz(v.KOD), ad: temiz(v.AD) };
    }
    /**
     * Vardiya aralığının raporu: [ACILIS_ZAMANI, KAPANIS_ZAMANI ya da şimdi) aralığında veznenin hareketleri. Sınırlar kayıttan
     * SQL içinde okunur (tarih JS'ye gidip gelmez: saat dilimi / milisaniye kayması olmaz). Tablo yoksa o belge türü atlanır.
     */
    static async aralikOzeti(pool, istek, vezneId, vardiyaId) {
        const d = await belgeTablolari(pool);
        const ez = [
            `WHEN 0 THEN (SELECT EKLEME_ZAMANI FROM dbo.TODVZ_FIS WHERE FIS_ID = X.belgeId)`,
            `WHEN 2 THEN (SELECT EKLEME_ZAMANI FROM dbo.TODVZ_CARI_HAREKET WHERE CARI_HAREKET_ID = X.belgeId)`,
        ];
        if (d.sarraf)
            ez.push(`WHEN 5 THEN (SELECT EKLEME_ZAMANI FROM dbo.TODVZ_SARRAF_FISI WHERE SARRAF_FISI_ID = X.belgeId)`);
        if (d.perakende)
            ez.push(`WHEN 6 THEN (SELECT EKLEME_ZAMANI FROM dbo.TODVZ_FATURA WHERE FATURA_ID = X.belgeId)`, `WHEN 9 THEN (SELECT EKLEME_ZAMANI FROM dbo.TODVZ_FATURA WHERE FATURA_ID = X.belgeId)`);
        if (d.transfer)
            ez.push(`WHEN 1 THEN (SELECT EKLEME_ZAMANI FROM dbo.TODVZ_VEZNE_TRANSFERI WHERE VEZNE_TRANSFERI_ID = X.belgeId)`);
        if (d.kasa)
            ez.push(`WHEN 3 THEN (SELECT EKLEME_ZAMANI FROM dbo.TODVZ_HESAP_HAREKETI WHERE HESAP_HAREKETI_ID = X.belgeId)`);
        if (d.duzeltme)
            ez.push(`WHEN 8 THEN (SELECT EKLEME_ZAMANI FROM dbo.TODVZ_VEZNE_BAKIYE_DUZELTME WHERE VEZNE_BAKIYE_DUZELTME_ID = X.belgeId)`);
        // T11 (26.11.2026 denetimi): cari dekont kayıt saatiyle (eskiden belge tarihi = gün başı 00:00: öğleden sonra açılan vardiyanın
        // dekontu vardiya dışında, gece yarısını aşan vardiyada ertesi günün dekontu içeride sayılıyordu)
        if (d.dekont)
            ez.push(`WHEN 4 THEN (SELECT EKLEME_ZAMANI FROM dbo.TODVZ_CARI_DEKONT WHERE CARI_DEKONT_ID = X.belgeId)`);
        const SINIR = `DECLARE @A DATETIME, @K DATETIME;
      SELECT @A = ACILIS_ZAMANI, @K = ISNULL(KAPANIS_ZAMANI, GETDATE()) FROM dbo.TODVZ_TICARI_VARDIYA WHERE VARDIYA_ID = @W;`;
        const tlId = Number((await istek().query(`SELECT ${TL_PARA_SQL} AS ID`)).recordset[0]?.ID) || 1;
        const hareket = await istek().input("V", sql.Int, vezneId).input("W", sql.Int, vardiyaId).input("TL", sql.Int, tlId)
            .query(`${SINIR}
        ;WITH X (${VEZNE_HAREKET_KOLONLARI}) AS (
          ${vezneHareketleriSql(d)}
        )
        SELECT X.belgeTipi, X.belgeId, X.ayak, X.fisTip, X.giris, X.cikis, X.belgeNo, X.aciklama, X.unvan, X.paraId,
          CASE WHEN X.paraId = @TL THEN 1 ELSE 0 END AS TL, RTRIM(ISNULL(P.KOD,'')) AS PARA_KODU, ${TR("Z.EZ")} AS ZAMAN_TR
        FROM X
        CROSS APPLY (SELECT EZ = COALESCE(CASE X.belgeTipi ${ez.join(" ")} END, X.zaman, X.tarih)) Z
        LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID = X.paraId
        WHERE X.vezneId = @V AND Z.EZ >= @A AND Z.EZ < @K AND (ISNULL(X.giris,0) <> 0 OR ISNULL(X.cikis,0) <> 0)
        ORDER BY Z.EZ, X.belgeTipi, X.belgeId, X.ayak`);
        const satirlar = [];
        const digerHareketler = [];
        const paralar = new Map();
        for (const r of hareket.recordset) {
            const giris = Number(r.giris) || 0, cikis = Number(r.cikis) || 0, bt = Number(r.belgeTipi);
            if (Number(r.TL) !== 1) {
                const p = paralar.get(temiz(r.PARA_KODU)) || { paraKodu: temiz(r.PARA_KODU), giris: 0, cikis: 0 };
                p.giris += giris;
                p.cikis += cikis;
                paralar.set(p.paraKodu, p);
                continue;
            }
            // Ticari fişin ödeme ayağı (ayak 1): satış fişi (fisTip 1) nakit satış, iade fişi (fisTip 0) nakit iade
            const tur = bt === 9 && Number(r.ayak) === 1 ? (Number(r.fisTip) === 1 ? "SATIS" : "IADE") : "DIGER";
            satirlar.push({ tur, giris, cikis });
            if (tur === "DIGER") {
                const fisAdi = bt === 0 ? (Number(r.fisTip) === 1 ? "Döviz satış fişi" : "Döviz alış fişi") : bt === 5 ? (Number(r.fisTip) === 1 ? "Sarraf satış fişi" : "Sarraf alış fişi")
                    : bt === 6 ? (Number(r.fisTip) === 1 ? "Perakende satış fişi" : "Perakende alış fişi") : bt === 1 ? "Vezne transferi" : bt === 2 ? "Nakit cari hareket"
                        : bt === 3 ? "Kasa hesap hareketi" : bt === 4 ? "Cari dekont" : bt === 8 ? "Bakiye düzeltme" : VEZNE_BELGE[bt] || "Vezne hareketi";
                digerHareketler.push({ zaman: temiz(r.ZAMAN_TR), tur: fisAdi, belgeNo: temiz(r.belgeNo), aciklama: temiz(r.unvan) || temiz(r.aciklama), giris: yuvarla2(giris), cikis: yuvarla2(cikis) });
            }
        }
        // Önceki (kapanmış) vardiya fişlerinin yönetici düzeltmeleri (karar K7): nakit farkı bu vardiyanın beklenen nakdine girer
        const dz = await istek().input("W", sql.Int, vardiyaId).query(`IF OBJECT_ID('dbo.TODVZ_TICARI_VARDIYA_DUZELTME', 'U') IS NULL SELECT TOP 0 CAST(0 AS decimal(18,2)) AS TUTAR, N'' AS ACIKLAMA, GETDATE() AS ZAMAN_TR
      ELSE SELECT TUTAR, ACIKLAMA, ZAMAN_TR FROM dbo.TODVZ_TICARI_VARDIYA_DUZELTME WHERE VARDIYA_ID = @W ORDER BY DUZELTME_ID`);
        for (const x of dz.recordset) {
            const t = Number(x.TUTAR) || 0, giris = t > 0 ? t : 0, cikis = t < 0 ? -t : 0;
            satirlar.push({ tur: "DIGER", giris, cikis });
            digerHareketler.push({ zaman: new Date(x.ZAMAN_TR).toISOString().slice(0, 16).replace("T", " "), tur: "Önceki vardiya fişi düzeltmesi", belgeNo: "", aciklama: temiz(x.ACIKLAMA), giris: yuvarla2(giris), cikis: yuvarla2(cikis) });
        }
        // Ticari fişler: adet / toplam ve ödeme türü dökümü (satış − iade)
        const fis = await istek().input("V", sql.Int, vezneId).input("W", sql.Int, vardiyaId).query(`${SINIR}
      SELECT F.FATURA_TIPI AS T, COUNT(*) AS N, ISNULL(SUM(F.GENEL_TOPLAM),0) AS TOPLAM FROM dbo.TODVZ_FATURA F
      WHERE ISNULL(F.FIS_KAYNAGI,0) = 1 AND F.VEZNE_ID = @V AND F.EKLEME_ZAMANI >= @A AND F.EKLEME_ZAMANI < @K GROUP BY F.FATURA_TIPI;
      SELECT F.FATURA_TIPI AS T, ISNULL(O.ODEME_ARACI_TURU,0) AS OAT, RTRIM(ISNULL(O.PARA_KODU,'TL')) AS PK, ISNULL(SUM(O.TUTAR),0) AS TUTAR
      FROM dbo.TODVZ_FATURA F JOIN dbo.TODVZ_FATURA_ODEME O ON O.FATURA_ID = F.FATURA_ID
      WHERE ISNULL(F.FIS_KAYNAGI,0) = 1 AND F.VEZNE_ID = @V AND F.EKLEME_ZAMANI >= @A AND F.EKLEME_ZAMANI < @K
      GROUP BY F.FATURA_TIPI, ISNULL(O.ODEME_ARACI_TURU,0), RTRIM(ISNULL(O.PARA_KODU,'TL'))
      ORDER BY ISNULL(O.ODEME_ARACI_TURU,0), RTRIM(ISNULL(O.PARA_KODU,'TL'));`);
        const rs = fis.recordsets;
        const adet = (t) => rs[0].find((x) => Number(x.T) === t);
        const odemeler = new Map();
        for (const o of rs[1]) {
            const tur = odemeAraciAdi(Number(o.OAT)), pk = temiz(o.PK) || "TL", anahtar = `${tur}|${pk}`;
            const s = odemeler.get(anahtar) || { tur, paraKodu: pk, satis: 0, iade: 0, net: 0 };
            if (Number(o.T) === 2)
                s.iade = yuvarla2(s.iade + Number(o.TUTAR));
            else
                s.satis = yuvarla2(s.satis + Number(o.TUTAR));
            s.net = yuvarla2(s.satis - s.iade);
            odemeler.set(anahtar, s);
        }
        return {
            satirlar,
            digerHareketler,
            digerParalar: [...paralar.values()].map((p) => ({ paraKodu: p.paraKodu, giris: yuvarla2(p.giris), cikis: yuvarla2(p.cikis) })),
            fisler: {
                satisAdet: Number(adet(1)?.N || 0), satisToplam: yuvarla2(Number(adet(1)?.TOPLAM || 0)),
                iadeAdet: Number(adet(2)?.N || 0), iadeToplam: yuvarla2(Number(adet(2)?.TOPLAM || 0)),
            },
            odemeler: [...odemeler.values()],
        };
    }
    static async kayitOku(istek, filtre, kilit = false) {
        const q = istek();
        let kosul;
        if (filtre.vardiyaId) {
            q.input("ID", sql.Int, filtre.vardiyaId);
            kosul = "W.VARDIYA_ID = @ID";
        }
        else {
            q.input("V", sql.Int, filtre.acikVezneId);
            kosul = "W.VEZNE_ID = @V AND W.KAPANIS_ZAMANI IS NULL";
        }
        const r = await q.query(`SELECT W.*, ${TR_DUZ("W.ACILIS_TR")} AS ACILIS_TR_M, ${TR_DUZ("W.KAPANIS_TR")} AS KAPANIS_TR_M,
        RTRIM(ISNULL(UA.AD,'')) AS ACAN_AD, RTRIM(ISNULL(UK.AD,'')) AS KAPATAN_AD
      FROM dbo.TODVZ_TICARI_VARDIYA W ${kilit ? "WITH (UPDLOCK, HOLDLOCK)" : ""}
      LEFT JOIN dbo.TODVZ_KULLANICI UA ON UA.KULLANICI_ID = W.ACAN_ID LEFT JOIN dbo.TODVZ_KULLANICI UK ON UK.KULLANICI_ID = W.KAPATAN_ID
      WHERE ${kosul}`);
        return r.recordset[0] || null;
    }
    /** Kayıttan rapor: kapanmışsa OZET (kapanış anı), açıksa şimdiye kadarki hareketlerden */
    static async rapordan(pool, istek, w) {
        const acilis = { zaman: temiz(w.ACILIS_TR_M), kullanici: temiz(w.ACAN_AD), not: temiz(w.ACILIS_NOTU) || null };
        if (w.KAPANIS_ZAMANI && w.OZET) {
            const o = JSON.parse(w.OZET);
            return { ...o, vardiyaId: Number(w.VARDIYA_ID), acilis, kapanis: { zaman: temiz(w.KAPANIS_TR_M), kullanici: temiz(w.KAPATAN_AD), not: temiz(w.KAPANIS_NOTU) || null } };
        }
        const vezne = await this.vezne(istek, Number(w.VEZNE_ID));
        const a = await this.aralikOzeti(pool, istek, Number(w.VEZNE_ID), Number(w.VARDIYA_ID));
        const nakit = vardiyaNakdi(Number(w.DEVIR), a.satirlar);
        const sayilan = w.SAYILAN === null || w.SAYILAN === undefined ? null : Number(w.SAYILAN);
        const f = sayilan === null ? null : vardiyaFarki(nakit.beklenen, sayilan);
        return {
            vardiyaId: Number(w.VARDIYA_ID), vezne, acilis,
            kapanis: w.KAPANIS_ZAMANI ? { zaman: temiz(w.KAPANIS_TR_M), kullanici: temiz(w.KAPATAN_AD), not: temiz(w.KAPANIS_NOTU) || null } : null,
            nakit: { ...nakit, sayilan, fark: f?.fark ?? null, durum: f?.durum ?? null },
            kupur: w.KUPUR ? JSON.parse(w.KUPUR) : null,
            fisler: a.fisler, odemeler: a.odemeler, digerHareketler: a.digerHareketler, digerParalar: a.digerParalar,
        };
    }
    /** Veznenin vardiya durumu: açık vardiya + anlık rapor, ya da devir önerisi (son kapanışta sayılan) */
    static async durum(vezneId, ctx) {
        const pool = await this.havuz(ctx);
        const istek = () => pool.request();
        const vezne = await this.vezne(istek, vezneId);
        const w = await this.kayitOku(istek, { acikVezneId: vezneId });
        const son = await istek().input("V", sql.Int, vezneId)
            .query(`SELECT TOP 1 SAYILAN FROM dbo.TODVZ_TICARI_VARDIYA WHERE VEZNE_ID = @V AND KAPANIS_ZAMANI IS NOT NULL ORDER BY KAPANIS_ZAMANI DESC, VARDIYA_ID DESC`);
        return {
            vezne,
            zorunlu: await this.zorunluMu(ctx),
            acik: w ? await this.rapordan(pool, istek, w) : null,
            oneriDevir: son.recordset[0] ? yuvarla2(Number(son.recordset[0].SAYILAN) || 0) : 0,
        };
    }
    static async ac(girdi, kullaniciId, ctx) {
        const devir = tutar(girdi.devir, "Devir nakit");
        const pool = await this.havuz(ctx);
        await this.vezne(() => pool.request(), girdi.vezneId);
        const cakisma = () => ApiError.conflict("Bu vezne için açık bir vardiya var; önce onu kapatın.");
        if (await this.acikVardiyaId(girdi.vezneId, ctx))
            throw cakisma();
        try {
            const r = await pool.request().input("V", sql.Int, girdi.vezneId).input("K", sql.Int, kullaniciId || null).input("D", sql.Decimal(18, 2), devir)
                .input("N", sql.NVarChar(250), temiz(girdi.not).slice(0, 250) || null)
                .query(`INSERT INTO dbo.TODVZ_TICARI_VARDIYA (VEZNE_ID, ACAN_ID, DEVIR, ACILIS_NOTU) OUTPUT INSERTED.VARDIYA_ID VALUES (@V, @K, @D, @N)`);
            return this.durum(girdi.vezneId, ctx).then((d) => ({ ...d, vardiyaId: Number(r.recordset[0].VARDIYA_ID) }));
        }
        catch (e) {
            // Eşzamanlı iki açılış: tekil indeks ikincisini durdurur (sürücü hata numarasını vermezse indeks adından tanınır)
            if (e?.number === 2601 || e?.number === 2627 || /UX_TODVZ_TICARI_VARDIYA_ACIK/.test(String(e?.message)))
                throw cakisma();
            throw e;
        }
    }
    /**
     * Vardiyayı kapatır: sayılan nakit (ya da küpür dökümü) ile beklenen arasındaki fark yazılır, rapor OZET'e saklanır.
     * Kapanış anı işlem içinde alınır; aynı anda iki kapanış isteğinde ikincisi "açık vardiya yok" alır (UPDLOCK).
     */
    static async kapat(girdi, kullaniciId, ctx) {
        let kupur = null;
        let sayilan;
        if (girdi.kupur && typeof girdi.kupur === "object" && Object.keys(girdi.kupur).length) {
            const h = kupurDenetle(girdi.kupur);
            if (h)
                throw ApiError.badRequest(h);
            kupur = Object.fromEntries(Object.entries(girdi.kupur).filter(([, v]) => Number(v) > 0).map(([k, v]) => [String(Number(k)), Number(v)]));
            sayilan = kupurToplami(kupur);
            if (girdi.sayilan !== undefined && girdi.sayilan !== null && girdi.sayilan !== "" && tutar(girdi.sayilan, "Sayılan nakit") !== sayilan) {
                throw ApiError.badRequest(`Sayılan nakit (${girdi.sayilan}) küpür toplamıyla (${sayilan.toFixed(2)}) aynı değil.`);
            }
        }
        else
            sayilan = tutar(girdi.sayilan, "Sayılan nakit");
        const pool = await this.havuz(ctx);
        const tx = new sql.Transaction(pool);
        let kapananId = 0;
        await tx.begin();
        try {
            const istek = () => new sql.Request(tx);
            const w = await this.kayitOku(istek, { acikVezneId: girdi.vezneId }, true);
            if (!w)
                throw ApiError.badRequest("Bu vezne için açık vardiya yok.");
            kapananId = Number(w.VARDIYA_ID);
            // Kapanış anı önce yazılır (işlem içinde); aralık sınırları kayıttan okunur
            await istek().input("ID", sql.Int, kapananId).input("K", sql.Int, kullaniciId || null)
                .query(`UPDATE dbo.TODVZ_TICARI_VARDIYA SET KAPATAN_ID = @K, KAPANIS_ZAMANI = GETDATE(), KAPANIS_TR = DATEADD(HOUR, 3, GETUTCDATE())
          WHERE VARDIYA_ID = @ID AND KAPANIS_ZAMANI IS NULL`);
            const vezne = await this.vezne(istek, girdi.vezneId);
            const a = await this.aralikOzeti(pool, istek, girdi.vezneId, kapananId);
            const nakit = vardiyaNakdi(Number(w.DEVIR), a.satirlar);
            const f = vardiyaFarki(nakit.beklenen, sayilan);
            const not = temiz(girdi.not).slice(0, 250) || null;
            const ozet = {
                vardiyaId: Number(w.VARDIYA_ID), vezne,
                acilis: { zaman: temiz(w.ACILIS_TR_M), kullanici: temiz(w.ACAN_AD), not: temiz(w.ACILIS_NOTU) || null },
                kapanis: null,
                nakit: { ...nakit, sayilan, fark: f.fark, durum: f.durum }, kupur,
                fisler: a.fisler, odemeler: a.odemeler, digerHareketler: a.digerHareketler, digerParalar: a.digerParalar,
            };
            await istek().input("ID", sql.Int, kapananId)
                .input("S", sql.Decimal(18, 2), sayilan).input("B", sql.Decimal(18, 2), nakit.beklenen).input("F", sql.Decimal(18, 2), f.fark)
                .input("N", sql.NVarChar(250), not).input("KP", sql.NVarChar(1000), kupur ? JSON.stringify(kupur) : null).input("O", sql.NVarChar(sql.MAX), JSON.stringify(ozet))
                .query(`UPDATE dbo.TODVZ_TICARI_VARDIYA SET SAYILAN = @S, BEKLENEN = @B, FARK = @F, KAPANIS_NOTU = @N, KUPUR = @KP, OZET = @O WHERE VARDIYA_ID = @ID`);
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        return this.rapor(kapananId, ctx);
    }
    static async rapor(vardiyaId, ctx) {
        const pool = await this.havuz(ctx);
        const istek = () => pool.request();
        const w = await this.kayitOku(istek, { vardiyaId });
        if (!w)
            throw ApiError.notFound("Vardiya bulunamadı.");
        return this.rapordan(pool, istek, w);
    }
    /** Vardiyanın veznesi (yetki denetimi için) */
    static async vardiyaVeznesi(vardiyaId, ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().input("ID", sql.Int, vardiyaId).query(`SELECT VEZNE_ID FROM dbo.TODVZ_TICARI_VARDIYA WHERE VARDIYA_ID = @ID`);
        return r.recordset[0] ? Number(r.recordset[0].VEZNE_ID) : null;
    }
    /** Vardiya listesi (açılış gününe göre, Türkiye saati); vezneId verilirse yalnız o vezne */
    static async liste(f, ctx) {
        const pool = await this.havuz(ctx);
        const q = pool.request();
        const kosul = [];
        if (f.vezneId) {
            q.input("V", sql.Int, f.vezneId);
            kosul.push("W.VEZNE_ID = @V");
        }
        const gun = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(temiz(s)) ? temiz(s) : null);
        if (gun(f.baslangic)) {
            q.input("B", sql.VarChar(10), gun(f.baslangic));
            kosul.push("CAST(W.ACILIS_TR AS date) >= @B");
        }
        if (gun(f.bitis)) {
            q.input("S", sql.VarChar(10), gun(f.bitis));
            kosul.push("CAST(W.ACILIS_TR AS date) <= @S");
        }
        const limit = Math.min(Math.max(Number(f.limit) || 200, 1), 1000);
        const r = await q.query(`SELECT TOP (${limit}) W.VARDIYA_ID, W.VEZNE_ID, RTRIM(ISNULL(V.KOD,'')) + CASE WHEN NULLIF(RTRIM(V.AD),'') IS NULL THEN '' ELSE ' - ' + RTRIM(V.AD) END AS VEZNE,
        RTRIM(ISNULL(UA.AD,'')) AS ACAN, RTRIM(ISNULL(UK.AD,'')) AS KAPATAN, ${TR_DUZ("W.ACILIS_TR")} AS ACILIS, ${TR_DUZ("W.KAPANIS_TR")} AS KAPANIS,
        W.DEVIR, W.BEKLENEN, W.SAYILAN, W.FARK
      FROM dbo.TODVZ_TICARI_VARDIYA W LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID = W.VEZNE_ID
      LEFT JOIN dbo.TODVZ_KULLANICI UA ON UA.KULLANICI_ID = W.ACAN_ID LEFT JOIN dbo.TODVZ_KULLANICI UK ON UK.KULLANICI_ID = W.KAPATAN_ID
      ${kosul.length ? `WHERE ${kosul.join(" AND ")}` : ""}
      ORDER BY W.ACILIS_ZAMANI DESC, W.VARDIYA_ID DESC`);
        const n = (v) => (v === null || v === undefined ? null : Number(v));
        return r.recordset.map((x) => ({
            vardiyaId: Number(x.VARDIYA_ID), vezneId: Number(x.VEZNE_ID), vezne: temiz(x.VEZNE), acan: temiz(x.ACAN), kapatan: temiz(x.KAPATAN),
            acilis: temiz(x.ACILIS), kapanis: x.KAPANIS ? temiz(x.KAPANIS) : null,
            devir: Number(x.DEVIR) || 0, beklenen: n(x.BEKLENEN), sayilan: n(x.SAYILAN), fark: n(x.FARK),
        }));
    }
}

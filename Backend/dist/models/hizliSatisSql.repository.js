import sql from "mssql";
import { getDbPool } from "../config/mssql.config.js";
import { ApiError } from "../utils/ApiError.js";
import { hizliSatisSemaHazirla } from "../services/hizliSatis/hizliSatisSema.js";
import { BUTON_RESIM_AZAMI, BUTON_RESIM_TIPI, MODUL_URUN_TURLERI, SERBEST_KDV_ORANLARI, URUN_TURU, VARSAYILAN_FATURA_SINIRI, modulGecerliMi, renkGecerliMi, sinirOku, } from "../services/hizliSatis/hizliSatisKural.js";
import { UrunResimSqlRepository } from "./urunResimSql.repository.js";
/** Bekleyen sepet içeriğinin en büyük boyutu (karakter) ve "eski" sayılma günü (H28) */
export const BEKLEYEN_AZAMI = 500_000;
export const BEKLEYEN_ESKI_GUN = 7;
/** Yönetici her şeyi; diğerleri aynı vezne (vezne bilinmiyorsa kendi bıraktığı) */
export const bekleyenErisimi = (x, f) => {
    if (f.yonetici)
        return true;
    if (f.vezneId)
        return Number(x.VEZNE_ID) === Number(f.vezneId);
    return !!f.kullaniciId && Number(x.KULLANICI_ID) === Number(f.kullaniciId);
};
const temiz = (v) => String(v ?? "").trim();
const sayiVeyaNull = (v) => {
    if (v === null || v === undefined || temiz(v) === "")
        return null;
    const s = typeof v === "string" ? (v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v) : v;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};
const modulDogrula = (m) => {
    if (!modulGecerliMi(m))
        throw ApiError.badRequest("Geçersiz modül. perakende, ticari, sarraf ya da doviz olmalı.");
    return m;
};
export class HizliSatisSqlRepository {
    static async havuz(ctx) {
        const pool = await getDbPool(ctx?.dbServer, ctx?.dbName);
        await hizliSatisSemaHazirla(pool);
        return pool;
    }
    // ───────────── Ayarlar ve yetki ─────────────
    static async faturaSiniri(ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().query(`SELECT DEGER FROM dbo.TODVZ_HIZLI_SATIS_AYAR WHERE ANAHTAR = 'FATURA_SINIRI'`);
        return r.recordset.length ? sinirOku(r.recordset[0].DEGER) : VARSAYILAN_FATURA_SINIRI;
    }
    /** Fiyat Değiştir ve İndirim (H17): sistem yöneticisi her zaman, diğerleri yetki tablosundaysa */
    static async fiyatYetkisi(kullaniciId, yonetici, ctx) {
        if (yonetici)
            return true;
        if (!kullaniciId)
            return false;
        const pool = await this.havuz(ctx);
        const r = await pool.request().input("ID", sql.Int, kullaniciId).query(`SELECT 1 AS V FROM dbo.TODVZ_HIZLI_SATIS_YETKI WHERE KULLANICI_ID = @ID`);
        return r.recordset.length > 0;
    }
    static async ayarlar(ctx) {
        const pool = await this.havuz(ctx);
        const k = await pool.request().query(`
      SELECT U.KULLANICI_ID, RTRIM(U.AD) AS AD, CAST(ISNULL(U.SISTEM_YONETICISI, 0) AS INT) AS YONETICI,
        CASE WHEN Y.KULLANICI_ID IS NULL THEN 0 ELSE 1 END AS YETKILI
      FROM dbo.TODVZ_KULLANICI U LEFT JOIN dbo.TODVZ_HIZLI_SATIS_YETKI Y ON Y.KULLANICI_ID = U.KULLANICI_ID
      ORDER BY U.AD`);
        return {
            faturaSiniri: await this.faturaSiniri(ctx),
            kullanicilar: k.recordset.map((r) => ({
                kullaniciId: r.KULLANICI_ID,
                ad: temiz(r.AD),
                yonetici: Number(r.YONETICI) === 1,
                yetkili: Number(r.YETKILI) === 1,
            })),
        };
    }
    static async ayarKaydet(girdi, kullaniciId, ctx) {
        const pool = await this.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            if (girdi.faturaSiniri !== undefined) {
                const n = sayiVeyaNull(girdi.faturaSiniri);
                if (n === null || n < 0 || n > 1e9)
                    throw ApiError.badRequest("Fatura sınırı 0 ya da pozitif bir tutar olmalı.");
                await new sql.Request(tx).input("D", sql.NVarChar(200), String(Math.round(n * 100) / 100)).query(`
          IF EXISTS (SELECT 1 FROM dbo.TODVZ_HIZLI_SATIS_AYAR WHERE ANAHTAR = 'FATURA_SINIRI') UPDATE dbo.TODVZ_HIZLI_SATIS_AYAR SET DEGER = @D WHERE ANAHTAR = 'FATURA_SINIRI'
          ELSE INSERT INTO dbo.TODVZ_HIZLI_SATIS_AYAR (ANAHTAR, DEGER) VALUES ('FATURA_SINIRI', @D);`);
            }
            if (Array.isArray(girdi.yetkiliKullanicilar)) {
                await new sql.Request(tx).query(`DELETE FROM dbo.TODVZ_HIZLI_SATIS_YETKI`);
                for (const id of [...new Set(girdi.yetkiliKullanicilar.map(Number).filter((x) => Number.isInteger(x) && x > 0))]) {
                    await new sql.Request(tx).input("ID", sql.Int, id).input("E", sql.Int, kullaniciId || null)
                        .query(`IF EXISTS (SELECT 1 FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = @ID) INSERT INTO dbo.TODVZ_HIZLI_SATIS_YETKI (KULLANICI_ID, EKLEYEN_ID) VALUES (@ID, @E)`);
                }
            }
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        return this.ayarlar(ctx);
    }
    // ───────────── Buton düzeni ─────────────
    /** Modülün sekme ve butonları. resimli: küçültülmüş resimler data URL olarak gelir. */
    static async duzen(modul, ctx, resimli = true) {
        const m = modulDogrula(modul);
        const pool = await this.havuz(ctx);
        const sk = await pool.request().input("M", sql.VarChar(20), m)
            .query(`SELECT SEKME_ID, AD, SIRA FROM dbo.TODVZ_HIZLI_SATIS_SEKME WHERE MODUL = @M ORDER BY SIRA, SEKME_ID`);
        if (!sk.recordset.length)
            return [];
        const bt = await pool.request().input("M", sql.VarChar(20), m).query(`
      SELECT B.BUTON_ID, B.SEKME_ID, B.SIRA, B.URUN_TURU, B.URUN_ID, B.AD, B.RENK, B.FIYAT, B.KDV_ORANI, B.RESIM
      FROM dbo.TODVZ_HIZLI_SATIS_BUTON B JOIN dbo.TODVZ_HIZLI_SATIS_SEKME S ON S.SEKME_ID = B.SEKME_ID
      WHERE S.MODUL = @M ORDER BY B.SIRA, B.BUTON_ID`);
        const paraIdler = [...new Set(bt.recordset.filter((b) => b.URUN_TURU === URUN_TURU.PARA && b.URUN_ID).map((b) => Number(b.URUN_ID)))];
        const stokIdler = [...new Set(bt.recordset.filter((b) => b.URUN_TURU === URUN_TURU.STOK && b.URUN_ID).map((b) => Number(b.URUN_ID)))];
        const paralar = new Map();
        if (paraIdler.length) {
            const r = await pool.request().query(`SELECT PARA_ID, RTRIM(KOD) AS KOD, RTRIM(AD) AS AD, URUN_TIPI FROM dbo.TODVZ_PARA WHERE PARA_ID IN (${paraIdler.join(",")})`);
            for (const x of r.recordset)
                paralar.set(Number(x.PARA_ID), x);
        }
        const stoklar = new Map();
        if (stokIdler.length) {
            const var_ = await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_STOK_KART','U') IS NULL THEN 0 ELSE 1 END AS V`);
            if (Number(var_.recordset[0]?.V) === 1) {
                const r = await pool.request().query(`SELECT STOK_KART_ID, KOD, AD, BIRIM, KDV_ORANI, SATIS_FIYATI, AKTIF FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${stokIdler.join(",")})`);
                for (const x of r.recordset)
                    stoklar.set(Number(x.STOK_KART_ID), x);
            }
        }
        const resimler = new Map();
        if (resimli) {
            const r = await pool.request().input("T", sql.TinyInt, BUTON_RESIM_TIPI).input("M", sql.VarChar(20), m).query(`
        SELECT R.ISLEM_ID, R.DOSYA_TIPI, R.RESIM_DATA FROM dbo.TODVZ_URUN_RESIM R
        JOIN dbo.TODVZ_HIZLI_SATIS_BUTON B ON B.BUTON_ID = R.ISLEM_ID JOIN dbo.TODVZ_HIZLI_SATIS_SEKME S ON S.SEKME_ID = B.SEKME_ID
        WHERE R.TIP = @T AND S.MODUL = @M AND R.RESIM_DATA IS NOT NULL`);
            for (const x of r.recordset) {
                const tur = temiz(x.DOSYA_TIPI).toLowerCase();
                const mime = tur === "png" ? "image/png" : tur === "webp" ? "image/webp" : "image/jpeg";
                resimler.set(Number(x.ISLEM_ID), `data:${mime};base64,${Buffer.from(x.RESIM_DATA).toString("base64")}`);
            }
        }
        const butonlar = bt.recordset.map((b) => {
            const tur = Number(b.URUN_TURU);
            const ozelAd = temiz(b.AD) || null;
            let urunKodu = null, urunAdi = null, urunTipi = null, birim = null;
            const ozelFiyat = b.FIYAT === null || b.FIYAT === undefined ? null : Number(b.FIYAT);
            let fiyat = ozelFiyat;
            let kdv = b.KDV_ORANI === null || b.KDV_ORANI === undefined ? null : Number(b.KDV_ORANI);
            let gecersiz = false;
            if (tur === URUN_TURU.PARA) {
                const p = paralar.get(Number(b.URUN_ID));
                if (p) {
                    urunKodu = temiz(p.KOD);
                    urunAdi = temiz(p.AD);
                    urunTipi = Number(p.URUN_TIPI) || 0;
                }
                else
                    gecersiz = true;
            }
            else if (tur === URUN_TURU.STOK) {
                const s = stoklar.get(Number(b.URUN_ID));
                if (s && (s.AKTIF === true || s.AKTIF === 1)) {
                    urunKodu = temiz(s.KOD);
                    urunAdi = temiz(s.AD);
                    birim = temiz(s.BIRIM) || null;
                    if (fiyat === null && s.SATIS_FIYATI !== null)
                        fiyat = Number(s.SATIS_FIYATI);
                    if (kdv === null)
                        kdv = Number(s.KDV_ORANI);
                }
                else
                    gecersiz = true;
            }
            else if (tur === URUN_TURU.SERBEST) {
                if (!ozelAd)
                    gecersiz = true;
            }
            else
                gecersiz = true;
            return {
                sekmeId: Number(b.SEKME_ID),
                butonId: Number(b.BUTON_ID),
                sira: Number(b.SIRA) || 0,
                urunTuru: tur,
                urunId: b.URUN_ID === null ? null : Number(b.URUN_ID),
                ad: ozelAd || urunAdi || urunKodu || "",
                ozelAd,
                urunKodu,
                urunAdi,
                urunTipi,
                birim,
                renk: temiz(b.RENK) || null,
                fiyat,
                ozelFiyat,
                kdvOrani: kdv,
                gecersiz,
                resimVar: b.RESIM === true || b.RESIM === 1,
                ...(resimli ? { resim: resimler.get(Number(b.BUTON_ID)) ?? null } : {}),
            };
        });
        return sk.recordset.map((s) => ({
            sekmeId: Number(s.SEKME_ID),
            ad: temiz(s.AD),
            sira: Number(s.SIRA) || 0,
            butonlar: butonlar.filter((b) => b.sekmeId === Number(s.SEKME_ID)).map(({ sekmeId: _s, ...b }) => b),
        }));
    }
    /**
     * Düzeni olduğu gibi kaydeder: gelen sıra = ekrandaki sıra. Kimliği gelen sekme/buton güncellenir, gelmeyenler silinir,
     * kimliksizler eklenir. Resim: undefined dokunulmaz, null silinir, data URL yazılır.
     */
    static async duzenKaydet(modul, girdi, kullaniciId, ctx) {
        const m = modulDogrula(modul);
        const sekmeler = Array.isArray(girdi?.sekmeler) ? girdi.sekmeler : null;
        if (!sekmeler)
            throw ApiError.badRequest("Sekme listesi gelmedi.");
        if (sekmeler.length > 30)
            throw ApiError.badRequest("En çok 30 sekme olabilir.");
        const izinli = MODUL_URUN_TURLERI[m];
        // Önce doğrula (veritabanına dokunmadan)
        const temizSekmeler = sekmeler.map((s, si) => {
            const ad = temiz(s.ad);
            if (!ad)
                throw ApiError.badRequest(`${si + 1}. sekmenin adı boş.`);
            if (ad.length > 60)
                throw ApiError.badRequest(`"${ad}" sekme adı en çok 60 karakter olabilir.`);
            const butonlar = (Array.isArray(s.butonlar) ? s.butonlar : []).map((b, bi) => {
                const yer = `"${ad}" sekmesi ${bi + 1}. buton`;
                const tur = Number(b.urunTuru);
                if (!izinli.includes(tur))
                    throw ApiError.badRequest(`${yer}: bu modülde bu tür ürün konamaz.`);
                const urunId = tur === URUN_TURU.SERBEST ? null : sayiVeyaNull(b.urunId);
                if (tur !== URUN_TURU.SERBEST && (!urunId || urunId <= 0))
                    throw ApiError.badRequest(`${yer}: ürün seçilmedi.`);
                const bAd = temiz(b.ad) || null;
                if (bAd && bAd.length > 60)
                    throw ApiError.badRequest(`${yer}: ad en çok 60 karakter olabilir.`);
                if (tur === URUN_TURU.SERBEST && !bAd)
                    throw ApiError.badRequest(`${yer}: serbest ürünün adı zorunlu.`);
                const renk = b.renk ? temiz(b.renk) : null;
                if (renk && !renkGecerliMi(renk))
                    throw ApiError.badRequest(`${yer}: renk #RRGGBB biçiminde olmalı.`);
                const fiyat = sayiVeyaNull(b.fiyat);
                if (fiyat !== null && (fiyat < 0 || fiyat > 1e9))
                    throw ApiError.badRequest(`${yer}: fiyat geçersiz.`);
                const kdv = sayiVeyaNull(b.kdvOrani);
                if (kdv !== null && !SERBEST_KDV_ORANLARI.includes(kdv))
                    throw ApiError.badRequest(`${yer}: KDV oranı ${SERBEST_KDV_ORANLARI.join(", ")} olmalı.`);
                if (typeof b.resim === "string") {
                    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(b.resim))
                        throw ApiError.badRequest(`${yer}: resim PNG, JPEG ya da WEBP olmalı.`);
                    if (b.resim.length > BUTON_RESIM_AZAMI)
                        throw ApiError.badRequest(`${yer}: resim çok büyük; küçültülerek yüklenmeli.`);
                }
                return { butonId: sayiVeyaNull(b.butonId), tur, urunId, ad: bAd, renk, fiyat: tur === URUN_TURU.PARA ? null : fiyat, kdv: tur === URUN_TURU.SERBEST ? kdv ?? 20 : null, resim: b.resim };
            });
            if (butonlar.length > 200)
                throw ApiError.badRequest(`"${ad}" sekmesinde en çok 200 buton olabilir.`);
            return { sekmeId: sayiVeyaNull(s.sekmeId), ad, butonlar };
        });
        const pool = await this.havuz(ctx);
        const resimIsleri = [];
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const mevcutS = await new sql.Request(tx).input("M", sql.VarChar(20), m).query(`SELECT SEKME_ID FROM dbo.TODVZ_HIZLI_SATIS_SEKME WHERE MODUL = @M`);
            const sekmeVar = new Set(mevcutS.recordset.map((x) => Number(x.SEKME_ID)));
            const mevcutB = await new sql.Request(tx).input("M", sql.VarChar(20), m).query(`
        SELECT B.BUTON_ID FROM dbo.TODVZ_HIZLI_SATIS_BUTON B JOIN dbo.TODVZ_HIZLI_SATIS_SEKME S ON S.SEKME_ID = B.SEKME_ID WHERE S.MODUL = @M`);
            const butonVar = new Set(mevcutB.recordset.map((x) => Number(x.BUTON_ID)));
            const kalanS = new Set(), kalanB = new Set();
            for (let si = 0; si < temizSekmeler.length; si++) {
                const s = temizSekmeler[si];
                let sid = s.sekmeId && sekmeVar.has(s.sekmeId) ? s.sekmeId : 0;
                if (sid) {
                    await new sql.Request(tx).input("ID", sql.Int, sid).input("AD", sql.NVarChar(60), s.ad).input("S", sql.Int, si)
                        .query(`UPDATE dbo.TODVZ_HIZLI_SATIS_SEKME SET AD = @AD, SIRA = @S WHERE SEKME_ID = @ID`);
                }
                else {
                    const r = await new sql.Request(tx).input("M", sql.VarChar(20), m).input("AD", sql.NVarChar(60), s.ad).input("S", sql.Int, si).input("E", sql.Int, kullaniciId || null)
                        .query(`INSERT INTO dbo.TODVZ_HIZLI_SATIS_SEKME (MODUL, AD, SIRA, EKLEYEN_ID) OUTPUT INSERTED.SEKME_ID VALUES (@M, @AD, @S, @E)`);
                    sid = Number(r.recordset[0].SEKME_ID);
                }
                kalanS.add(sid);
                for (let bi = 0; bi < s.butonlar.length; bi++) {
                    const b = s.butonlar[bi];
                    const req = new sql.Request(tx)
                        .input("SK", sql.Int, sid).input("S", sql.Int, bi).input("T", sql.TinyInt, b.tur).input("U", sql.Int, b.urunId)
                        .input("AD", sql.NVarChar(60), b.ad).input("R", sql.VarChar(9), b.renk).input("F", sql.Float, b.fiyat).input("K", sql.Float, b.kdv);
                    let bid = b.butonId && butonVar.has(b.butonId) ? b.butonId : 0;
                    if (bid) {
                        await req.input("ID", sql.Int, bid).query(`UPDATE dbo.TODVZ_HIZLI_SATIS_BUTON SET SEKME_ID = @SK, SIRA = @S, URUN_TURU = @T, URUN_ID = @U, AD = @AD, RENK = @R, FIYAT = @F, KDV_ORANI = @K WHERE BUTON_ID = @ID`);
                    }
                    else {
                        const r = await req.input("E", sql.Int, kullaniciId || null).query(`
              INSERT INTO dbo.TODVZ_HIZLI_SATIS_BUTON (SEKME_ID, SIRA, URUN_TURU, URUN_ID, AD, RENK, FIYAT, KDV_ORANI, EKLEYEN_ID)
              OUTPUT INSERTED.BUTON_ID VALUES (@SK, @S, @T, @U, @AD, @R, @F, @K, @E)`);
                        bid = Number(r.recordset[0].BUTON_ID);
                    }
                    kalanB.add(bid);
                    if (b.resim !== undefined)
                        resimIsleri.push({ butonId: bid, resim: b.resim });
                }
            }
            const silB = [...butonVar].filter((x) => !kalanB.has(x));
            const silS = [...sekmeVar].filter((x) => !kalanS.has(x));
            if (silB.length) {
                await new sql.Request(tx).input("T", sql.TinyInt, BUTON_RESIM_TIPI).query(`DELETE FROM dbo.TODVZ_URUN_RESIM WHERE TIP = @T AND ISLEM_ID IN (${silB.join(",")})`);
                await new sql.Request(tx).query(`DELETE FROM dbo.TODVZ_HIZLI_SATIS_BUTON WHERE BUTON_ID IN (${silB.join(",")})`);
            }
            if (silS.length)
                await new sql.Request(tx).query(`DELETE FROM dbo.TODVZ_HIZLI_SATIS_SEKME WHERE SEKME_ID IN (${silS.join(",")})`);
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        // Resimler işlem dışında (firma klasörüne de dosya yazılıyor)
        for (const r of resimIsleri) {
            const yollar = await UrunResimSqlRepository.syncResimlerForIslem(BUTON_RESIM_TIPI, r.butonId, r.resim ? [r.resim] : [], ctx);
            await pool.request().input("ID", sql.Int, r.butonId).input("R", sql.Bit, r.resim && yollar.length ? 1 : 0)
                .query(`UPDATE dbo.TODVZ_HIZLI_SATIS_BUTON SET RESIM = @R WHERE BUTON_ID = @ID`);
        }
        return this.duzen(m, ctx, true);
    }
    // ───────────── Alıcı sorgusu (H13) ─────────────
    /**
     * TCKN/VKN ile daha önce kaydedilmiş alıcıyı bulur: cari kart → Perakende/Ticari faturaları → Sarraf fişleri → Döviz fişleri →
     * kayıtsız müşteriler. İl / ilçe / vergi dairesi eski tablolarda TODVZ_TABLO_MADDESI kimliğiyle durur; adıyla döner.
     */
    static async aliciBul(no, ctx) {
        const temizNo = String(no ?? "").replace(/\D/g, "");
        if (temizNo.length !== 10 && temizNo.length !== 11)
            return null;
        if (/^1{10,11}$/.test(temizNo))
            return null;
        const pool = await this.havuz(ctx);
        for (const k of this.aliciKaynaklari()) {
            try {
                // Tablo yoksa ya da eski şemada kolon eksikse atlanır (ertelenmiş ad çözümü için sp_executesql)
                const r = await pool.request().input("NO", sql.VarChar(20), temizNo).input("Q", sql.NVarChar(sql.MAX), k.sql).query(`
          IF OBJECT_ID('dbo.${k.tablo}', 'U') IS NOT NULL EXEC sp_executesql @Q, N'@NO varchar(20)', @NO = @NO;`);
                const x = r.recordset?.[0];
                if (x && temiz(x.UNVAN) && !/beyan edil/i.test(temiz(x.UNVAN))) {
                    return {
                        kaynak: k.kaynak,
                        cariKartId: k.kaynak === "cari" ? Number(x.CARI_KART_ID) || null : null,
                        cariKod: k.kaynak === "cari" ? temiz(x.KOD) || null : null,
                        unvan: temiz(x.UNVAN),
                        vknTckn: temizNo,
                        adres: temiz(x.ADRES),
                        il: temiz(x.IL),
                        ilce: temiz(x.ILCE),
                        vergiDairesi: temiz(x.VERGI_DAIRESI),
                        telefon: temiz(x.TELEFON),
                        eposta: temiz(x.EPOSTA),
                        mukellef: !!temiz(x.PK),
                    };
                }
            }
            catch {
                /* bu kaynak bu veritabanında kullanılamıyor: sıradakine geç */
            }
        }
        return null;
    }
    /** Alıcı arama kaynakları, öncelik sırasıyla (testte her sorgunun derlendiği ayrıca denenir) */
    static aliciKaynaklari() {
        const madde = (kolon, takma) => `(SELECT TOP 1 RTRIM(M.AD) FROM dbo.TODVZ_TABLO_MADDESI M WHERE M.TABLO_MADDESI_ID = ${takma}.${kolon})`;
        return [
            { kaynak: "cari", tablo: "TODVZ_CARI_KART", sql: `SELECT TOP 1 X.CARI_KART_ID AS CARI_KART_ID, RTRIM(X.KOD) AS KOD, RTRIM(X.AD) AS UNVAN, RTRIM(X.ADRES) AS ADRES,
          ${madde("IL_ID", "X")} AS IL, ${madde("ILCE_ID", "X")} AS ILCE, ${madde("VERGI_DAIRESI_ID", "X")} AS VERGI_DAIRESI,
          RTRIM(X.TELEFON) AS TELEFON, RTRIM(X.EPOSTA) AS EPOSTA, RTRIM(X.E_FATURA_POSTA_KUTUSU) AS PK
        FROM dbo.TODVZ_CARI_KART X WHERE REPLACE(REPLACE(RTRIM(X.VERGI_KIMLIK_NO), ' ', ''), '-', '') = @NO ORDER BY X.CARI_KART_ID DESC` },
            { kaynak: "fatura", tablo: "TODVZ_FATURA", sql: `SELECT TOP 1 X.CARI_KART_ID AS CARI_KART_ID, NULL AS KOD, RTRIM(X.ALICI_UNVAN) AS UNVAN, RTRIM(X.ADRES) AS ADRES, RTRIM(X.IL) AS IL, RTRIM(X.ILCE) AS ILCE,
          RTRIM(X.VERGI_DAIRESI) AS VERGI_DAIRESI, RTRIM(X.TELEFON) AS TELEFON, RTRIM(X.EPOSTA) AS EPOSTA, NULL AS PK
        FROM dbo.TODVZ_FATURA X WHERE X.ALICI_VKN_TCKN = @NO ORDER BY X.FATURA_ID DESC` },
            { kaynak: "sarraf", tablo: "TODVZ_SARRAF_FISI", sql: `SELECT TOP 1 NULL AS CARI_KART_ID, NULL AS KOD, RTRIM(X.UNVAN) AS UNVAN, RTRIM(X.ADRES) AS ADRES,
          ${madde("IL_ID", "X")} AS IL, ${madde("ILCE_ID", "X")} AS ILCE, ${madde("VERGI_DAIRESI_ID", "X")} AS VERGI_DAIRESI,
          RTRIM(X.TELEFON_NO) AS TELEFON, RTRIM(X.EPOSTA) AS EPOSTA, RTRIM(X.E_FATURA_POSTA_KUTUSU) AS PK
        FROM dbo.TODVZ_SARRAF_FISI X WHERE RTRIM(X.VERGI_KIMLIK_NO) = @NO ORDER BY X.SARRAF_FISI_ID DESC` },
            { kaynak: "doviz", tablo: "TODVZ_FIS", sql: `SELECT TOP 1 NULL AS CARI_KART_ID, NULL AS KOD, RTRIM(X.UNVAN) AS UNVAN, RTRIM(X.ADRES) AS ADRES,
          ${madde("IL_ID", "X")} AS IL, ${madde("ILCE_ID", "X")} AS ILCE, ${madde("VERGI_DAIRESI_ID", "X")} AS VERGI_DAIRESI,
          RTRIM(X.TELEFON_NO) AS TELEFON, RTRIM(X.EPOSTA) AS EPOSTA, RTRIM(X.E_FATURA_POSTA_KUTUSU) AS PK
        FROM dbo.TODVZ_FIS X WHERE RTRIM(X.VERGI_KIMLIK_NO) = @NO ORDER BY X.FIS_ID DESC` },
            { kaynak: "kayitsiz", tablo: "TODVZ_KAYITSIZ_MUSTERI", sql: `SELECT TOP 1 NULL AS CARI_KART_ID, NULL AS KOD, RTRIM(X.AD) AS UNVAN, RTRIM(X.ADRES) AS ADRES,
          ${madde("IL_ID", "X")} AS IL, ${madde("ILCE_ID", "X")} AS ILCE, ${madde("VERGI_DAIRESI_ID", "X")} AS VERGI_DAIRESI,
          RTRIM(X.TELEFON) AS TELEFON, RTRIM(X.EPOSTA) AS EPOSTA, RTRIM(X.E_FATURA_POSTA_KUTUSU) AS PK
        FROM dbo.TODVZ_KAYITSIZ_MUSTERI X WHERE RTRIM(X.VERGI_KIMLIK_NO) = @NO ORDER BY X.KAYITSIZ_MUSTERI_ID DESC` },
        ];
    }
    /**
     * Hızlı satıştan kaydedilen fişler (H20): modülün kendi fiş tablosundan numara, tarih, alıcı, tutar. Silinmiş fiş listelenmez.
     * gun: son kaç gün (varsayılan 1 = bugün), en çok 500 kayıt.
     */
    static async fisler(modul, gun, ctx) {
        const m = modulDogrula(modul);
        const g = Math.min(366, Math.max(1, Math.floor(Number(gun) || 1)));
        const pool = await this.havuz(ctx);
        const kul = `(SELECT TOP 1 RTRIM(U.AD) FROM dbo.TODVZ_KULLANICI U WHERE U.KULLANICI_ID = H.KULLANICI_ID)`;
        const sorgu = m === "perakende" || m === "ticari"
            ? `SELECT TOP 500 H.FIS_ID, RTRIM(F.FATURA_NO) AS NO, F.TARIH, RTRIM(F.ALICI_UNVAN) AS UNVAN, F.GENEL_TOPLAM AS TUTAR, CAST(1 AS int) AS TIP, ${kul} AS KULLANICI, H.EKLEME_ZAMANI
           FROM dbo.TODVZ_HIZLI_SATIS_FIS H JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID = H.FIS_ID
           WHERE H.MODUL = @M AND H.EKLEME_ZAMANI >= DATEADD(day, -(@G - 1), CAST(GETDATE() AS date)) ORDER BY H.EKLEME_ZAMANI DESC`
            : m === "sarraf"
                ? `SELECT TOP 500 H.FIS_ID, RTRIM(F.FIS_NO) AS NO, F.TARIH, RTRIM(F.UNVAN) AS UNVAN,
               (SELECT SUM(S.TUTAR) FROM dbo.TODVZ_SARRAF_FISI_SATIRI S WHERE S.SARRAF_FISI_ID = F.SARRAF_FISI_ID) AS TUTAR, CAST(F.TIP AS int) AS TIP, ${kul} AS KULLANICI, H.EKLEME_ZAMANI
             FROM dbo.TODVZ_HIZLI_SATIS_FIS H JOIN dbo.TODVZ_SARRAF_FISI F ON F.SARRAF_FISI_ID = H.FIS_ID
             WHERE H.MODUL = @M AND H.EKLEME_ZAMANI >= DATEADD(day, -(@G - 1), CAST(GETDATE() AS date)) ORDER BY H.EKLEME_ZAMANI DESC`
                : `SELECT TOP 500 H.FIS_ID, RTRIM(COALESCE(NULLIF(RTRIM(F.BELGE_NO), ''), F.SERI_NO)) AS NO, F.TARIH, RTRIM(F.UNVAN) AS UNVAN, F.ODEME_TUTARI AS TUTAR, CAST(F.TIP AS int) AS TIP, ${kul} AS KULLANICI, H.EKLEME_ZAMANI
             FROM dbo.TODVZ_HIZLI_SATIS_FIS H JOIN dbo.TODVZ_FIS F ON F.FIS_ID = H.FIS_ID
             WHERE H.MODUL = @M AND ISNULL(F.IPTAL, 0) = 0 AND H.EKLEME_ZAMANI >= DATEADD(day, -(@G - 1), CAST(GETDATE() AS date)) ORDER BY H.EKLEME_ZAMANI DESC`;
        const tablo = m === "perakende" || m === "ticari" ? "TODVZ_FATURA" : m === "sarraf" ? "TODVZ_SARRAF_FISI" : "TODVZ_FIS";
        const r = await pool.request().input("M", sql.VarChar(20), m).input("G", sql.Int, g).input("Q", sql.NVarChar(sql.MAX), sorgu)
            .query(`IF OBJECT_ID('dbo.${tablo}', 'U') IS NOT NULL EXEC sp_executesql @Q, N'@M varchar(20), @G int', @M = @M, @G = @G;`);
        return (r.recordset || []).map((x) => ({
            fisId: Number(x.FIS_ID),
            fisNo: temiz(x.NO),
            tarih: x.TARIH,
            unvan: temiz(x.UNVAN),
            tutar: Math.round((Number(x.TUTAR) || 0) * 100) / 100,
            tip: Number(x.TIP) === 0 ? 0 : 1,
            kullanici: temiz(x.KULLANICI) || null,
            zaman: x.EKLEME_ZAMANI,
        }));
    }
    // ───────────── Bekleyen sepetler (H25–H28) ─────────────
    /** Kullanıcı kartındaki vezne (TODVZ_KULLANICI.VEZNE_ID); tanımlıysa istekteki vezne yerine bu esas alınır */
    static async kullaniciVeznesi(kullaniciId, ctx) {
        if (!kullaniciId)
            return null;
        const pool = await this.havuz(ctx);
        const r = await pool.request().input("K", sql.Int, kullaniciId).query(`SELECT VEZNE_ID FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = @K`).catch(() => ({ recordset: [] }));
        const v = Number(r.recordset[0]?.VEZNE_ID);
        return v > 0 ? v : null;
    }
    /**
     * Bekleyen sepet listesi (içeriksiz). Yönetici `tumu` ile bütün vezneleri görür; diğerleri yalnız verilen veznenin
     * (vezne yoksa kendi bıraktıklarını) görür.
     */
    static async bekleyenler(modul, f, ctx) {
        const m = modulDogrula(modul);
        const pool = await this.havuz(ctx);
        const req = pool.request().input("M", sql.VarChar(20), m);
        let kosul = "B.MODUL = @M";
        if (!(f.yonetici && f.tumu)) {
            if (f.vezneId) {
                req.input("V", sql.Int, f.vezneId);
                kosul += " AND B.VEZNE_ID = @V";
            }
            else {
                req.input("K", sql.Int, f.kullaniciId || 0);
                kosul += " AND B.KULLANICI_ID = @K";
            }
        }
        const r = await req.query(`
      SELECT TOP 300 B.BEKLEYEN_ID, B.VEZNE_ID, B.KULLANICI_ID, B.TIP, B.MUSTERI, B.ACIKLAMA, B.KALEM, B.TOPLAM, B.EKLEME_ZAMANI,
        (SELECT TOP 1 RTRIM(U.AD) FROM dbo.TODVZ_KULLANICI U WHERE U.KULLANICI_ID = B.KULLANICI_ID) AS KULLANICI_ADI,
        DATEDIFF(day, B.EKLEME_ZAMANI, GETDATE()) AS GUN
      FROM dbo.TODVZ_HIZLI_SATIS_BEKLEYEN B WHERE ${kosul} ORDER BY B.EKLEME_ZAMANI DESC, B.BEKLEYEN_ID DESC`);
        return r.recordset.map((x) => ({
            bekleyenId: Number(x.BEKLEYEN_ID),
            vezneId: x.VEZNE_ID === null ? null : Number(x.VEZNE_ID),
            kullaniciId: x.KULLANICI_ID === null ? null : Number(x.KULLANICI_ID),
            kullaniciAdi: temiz(x.KULLANICI_ADI) || null,
            tip: Number(x.TIP) === 0 ? 0 : 1,
            musteri: temiz(x.MUSTERI) || null,
            aciklama: temiz(x.ACIKLAMA) || null,
            kalem: Number(x.KALEM) || 0,
            toplam: Math.round((Number(x.TOPLAM) || 0) * 100) / 100,
            zaman: x.EKLEME_ZAMANI,
            eski: Number(x.GUN) >= BEKLEYEN_ESKI_GUN,
        }));
    }
    static async bekleyenKaydet(g, kullaniciId, ctx) {
        const m = modulDogrula(g.modul);
        const icerik = typeof g.icerik === "string" ? g.icerik : JSON.stringify(g.icerik ?? null);
        if (!icerik || icerik === "null")
            throw ApiError.badRequest("Sepet içeriği gelmedi.");
        if (icerik.length > BEKLEYEN_AZAMI)
            throw ApiError.badRequest("Sepet çok büyük; beklemeye alınamaz.");
        let ic;
        try {
            ic = JSON.parse(icerik);
        }
        catch {
            throw ApiError.badRequest("Sepet içeriği okunamadı.");
        }
        if (!Array.isArray(ic?.sepet) || !ic.sepet.length)
            throw ApiError.badRequest("Boş sepet beklemeye alınamaz.");
        const pool = await this.havuz(ctx);
        const r = await pool.request()
            .input("M", sql.VarChar(20), m).input("V", sql.Int, sayiVeyaNull(g.vezneId)).input("K", sql.Int, kullaniciId || null)
            .input("T", sql.TinyInt, Number(g.tip) === 0 ? 0 : 1)
            .input("MU", sql.NVarChar(200), temiz(g.musteri).slice(0, 200) || null)
            .input("A", sql.NVarChar(200), temiz(g.aciklama).slice(0, 200) || null)
            .input("KA", sql.Int, Math.max(0, Math.floor(Number(g.kalem) || ic.sepet.length)))
            .input("TO", sql.Float, sayiVeyaNull(g.toplam) ?? 0)
            .input("I", sql.NVarChar(sql.MAX), icerik)
            .query(`INSERT INTO dbo.TODVZ_HIZLI_SATIS_BEKLEYEN (MODUL, VEZNE_ID, KULLANICI_ID, TIP, MUSTERI, ACIKLAMA, KALEM, TOPLAM, ICERIK)
        OUTPUT INSERTED.BEKLEYEN_ID VALUES (@M, @V, @K, @T, @MU, @A, @KA, @TO, @I)`);
        return { bekleyenId: Number(r.recordset[0].BEKLEYEN_ID) };
    }
    /** Bekleyen sepetin içeriği. Yönetici her şeyi; diğerleri aynı vezne (vezne yoksa kendi bıraktığı). */
    static async bekleyenGetir(id, f, ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().input("ID", sql.Int, id)
            .query(`SELECT BEKLEYEN_ID, MODUL, VEZNE_ID, KULLANICI_ID, TIP, ICERIK FROM dbo.TODVZ_HIZLI_SATIS_BEKLEYEN WHERE BEKLEYEN_ID = @ID`);
        const x = r.recordset[0];
        if (!x)
            throw ApiError.notFound("Bekleyen sepet bulunamadı (başka biri geri çağırmış ya da silmiş olabilir).");
        if (!bekleyenErisimi(x, f))
            throw ApiError.forbidden("Bu bekleyen sepet başka bir vezneye ait.");
        let icerik = null;
        try {
            icerik = JSON.parse(x.ICERIK);
        }
        catch { /* bozuk içerik: null döner */ }
        return { bekleyenId: Number(x.BEKLEYEN_ID), modul: temiz(x.MODUL), tip: Number(x.TIP) === 0 ? 0 : 1, icerik };
    }
    static async bekleyenSil(id, f, ctx) {
        const pool = await this.havuz(ctx);
        const r = await pool.request().input("ID", sql.Int, id).query(`SELECT VEZNE_ID, KULLANICI_ID FROM dbo.TODVZ_HIZLI_SATIS_BEKLEYEN WHERE BEKLEYEN_ID = @ID`);
        const x = r.recordset[0];
        if (!x)
            return;
        if (!bekleyenErisimi(x, f))
            throw ApiError.forbidden("Bu bekleyen sepet başka bir vezneye ait.");
        await pool.request().input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_HIZLI_SATIS_BEKLEYEN WHERE BEKLEYEN_ID = @ID`);
    }
    // ───────────── Fiş işareti (H20) ─────────────
    static async fisIsaretle(modul, fisId, kullaniciId, ctx) {
        const m = modulDogrula(modul);
        const id = Number(fisId);
        if (!Number.isInteger(id) || id <= 0)
            throw ApiError.badRequest("Geçersiz fiş numarası.");
        const pool = await this.havuz(ctx);
        await pool.request().input("M", sql.VarChar(20), m).input("ID", sql.Int, id).input("K", sql.Int, kullaniciId || null).query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.TODVZ_HIZLI_SATIS_FIS WHERE MODUL = @M AND FIS_ID = @ID)
        INSERT INTO dbo.TODVZ_HIZLI_SATIS_FIS (MODUL, FIS_ID, KULLANICI_ID) VALUES (@M, @ID, @K)`);
    }
    /** Verilen fişlerden hızlı satıştan gelenler */
    static async isaretliler(modul, fisIdler, ctx) {
        const m = modulDogrula(modul);
        const idler = [...new Set(fisIdler.map(Number).filter((x) => Number.isInteger(x) && x > 0))];
        if (!idler.length)
            return new Set();
        const pool = await this.havuz(ctx);
        const sonuc = new Set();
        for (let i = 0; i < idler.length; i += 1000) {
            const parca = idler.slice(i, i + 1000);
            const r = await pool.request().input("M", sql.VarChar(20), m)
                .query(`SELECT FIS_ID FROM dbo.TODVZ_HIZLI_SATIS_FIS WHERE MODUL = @M AND FIS_ID IN (${parca.join(",")})`);
            for (const x of r.recordset)
                sonuc.add(Number(x.FIS_ID));
        }
        return sonuc;
    }
}

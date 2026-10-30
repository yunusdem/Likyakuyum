import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";
import { GECERLI_KDV_ORANLARI, girisSatirHesapla, yuvarla2 } from "../services/ticari/ticariHesap.js";
import { STOK_BELGE, TicariStokSqlRepository, stokKontrolOku } from "./ticariStokSql.repository.js";
/**
 * Stok Giriş Fişi (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T9, T11): tedarikçiden ürün girişi. Her satır stok hareket
 * defterine giriş yazar, kartın son alış fiyatını günceller. Tedarikçi cari seçilirse genel toplam cariye ALACAK yazılır
 * (TODVZ_CARI_HAREKET, HAREKET_TIPI 6 "Stok Girişi"): kasa / vezneyi etkilemez, cari bakiyesi ve ekstrelerine girer.
 */
/** Cari hareketin türü: Stok giriş fişinden oluşan alacak kaydı (cari ekranlarından düzeltilmez) */
export const CARI_HAREKET_STOK_GIRISI = 6;
const temiz = (v) => String(v ?? "").trim();
const sayi = (v) => {
    if (typeof v === "string")
        v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
};
const y4 = (n) => Math.round(n * 10000) / 10000;
/** Kartların anlık bakiyesi (işlem içinden) */
export async function bakiyeler(tx, kartIdler) {
    const m = new Map();
    const idler = [...new Set(kartIdler.filter((x) => x > 0))];
    if (!idler.length)
        return m;
    const r = await new sql.Request(tx).query(`
    SELECT K.STOK_KART_ID, ISNULL(SUM(H.GIRIS - H.CIKIS), 0) AS B FROM dbo.TODVZ_STOK_KART K
    LEFT JOIN dbo.TODVZ_STOK_HAREKET H ON H.STOK_KART_ID = K.STOK_KART_ID
    WHERE K.STOK_KART_ID IN (${idler.map(Number).join(",")}) GROUP BY K.STOK_KART_ID`);
    for (const x of r.recordset)
        m.set(x.STOK_KART_ID, y4(Number(x.B) || 0));
    return m;
}
/**
 * İşlem sonunda eksi stok denetimi (T8, İş 9 G22): bu işlemle bakiyesi azalıp eksiye düşen kartlar. Davranış karta özel
 * (STOK_KONTROL), boşsa Stok Ayarları'ndaki genel davranış. ENGELLE kalemi varsa → 400 (hiçbiri yazılmaz); UYAR kalemi varsa ve
 * onay yoksa → 409 (EKSI_STOK, kalemler), ekran onay sorup yeniden gönderir; SESSIZ → geçer, uyarı da vermez.
 * Döner: yalnız UYAR davranışlı kalemler (kayıt sonrası uyarı metni için).
 */
export async function eksiStokDenetle(tx, onceki, onay) {
    const sonraki = await bakiyeler(tx, [...onceki.keys()]);
    const idler = [...onceki.keys()].filter((id) => (sonraki.get(id) ?? 0) < -0.00001 && (sonraki.get(id) ?? 0) < (onceki.get(id) ?? 0) - 0.00001);
    if (!idler.length)
        return [];
    const r = await new sql.Request(tx).query(`SELECT STOK_KART_ID, RTRIM(KOD) AS KOD, AD, BIRIM, STOK_KONTROL FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${idler.join(",")})`);
    const genel = await TicariStokSqlRepository.eksiStokDavranisi(undefined, tx);
    const kalemler = r.recordset.map((x) => {
        const ozel = stokKontrolOku(x.STOK_KONTROL);
        return {
            stokKartId: x.STOK_KART_ID, kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM),
            onceki: onceki.get(x.STOK_KART_ID) ?? 0, sonraki: sonraki.get(x.STOK_KART_ID) ?? 0,
            davranis: ozel && ozel !== "hata" ? ozel : genel,
        };
    });
    const yaz = (l) => l.map((k) => `${k.kod} ${k.ad}: ${k.sonraki.toLocaleString("tr-TR")} ${k.birim}`).join(", ");
    const sade = (l) => l.map(({ davranis: _d, ...k }) => k);
    const engel = kalemler.filter((k) => k.davranis === "ENGELLE");
    if (engel.length) {
        throw new ApiError(HttpStatus.BAD_REQUEST, `Stok yetersiz, işlem yapılmadı (eksi stoğa izin yok). Kalacak bakiye: ${yaz(engel)}`, { kod: "EKSI_STOK_ENGEL", kalemler: sade(engel) });
    }
    const uyar = kalemler.filter((k) => k.davranis === "UYAR");
    if (uyar.length && !onay) {
        throw new ApiError(HttpStatus.CONFLICT, `Stok eksiye düşecek: ${yaz(uyar)}. Yine de devam edilsin mi?`, { kod: "EKSI_STOK", kalemler: sade(uyar) });
    }
    return sade(uyar);
}
/** Kartların son alış fiyatını giriş fişlerinden yeniden hesaplar (en son tarihli, fiyatı olan satır) */
export async function sonAlisGuncelle(tx, kartIdler) {
    const idler = [...new Set(kartIdler.filter((x) => x > 0))];
    if (!idler.length)
        return;
    await new sql.Request(tx).query(`
    UPDATE K SET SON_ALIS_FIYATI = S.BIRIM_FIYAT, SON_ALIS_TARIHI = S.TARIH
    FROM dbo.TODVZ_STOK_KART K
    OUTER APPLY (SELECT TOP 1 X.BIRIM_FIYAT, G.TARIH FROM dbo.TODVZ_STOK_GIRIS_SATIRI X JOIN dbo.TODVZ_STOK_GIRIS G ON G.STOK_GIRIS_ID = X.STOK_GIRIS_ID
                 WHERE X.STOK_KART_ID = K.STOK_KART_ID AND X.BIRIM_FIYAT > 0 ORDER BY G.TARIH DESC, G.STOK_GIRIS_ID DESC, X.SATIR_NO DESC) S
    WHERE K.STOK_KART_ID IN (${idler.map(Number).join(",")})`);
}
export class TicariGirisSqlRepository {
    /** SG + yıl + 6 hane (SG2026000001) */
    static async yeniFisNo(tx, tarih) {
        const onEk = `SG${tarih.getFullYear()}`;
        const r = await new sql.Request(tx).input("O", sql.VarChar(10), onEk).query(`
      SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(FIS_NO, 7, 20) AS INT)), 0) + 1 AS N FROM dbo.TODVZ_STOK_GIRIS WITH (UPDLOCK, HOLDLOCK)
      WHERE FIS_NO LIKE @O + '%' AND LEN(FIS_NO) = 12`);
        return `${onEk}${String(Number(r.recordset[0].N) || 1).padStart(6, "0")}`;
    }
    static async siradakiNo(ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        return this.yeniFisNo(pool, new Date());
    }
    /** Fişin stok, cari ve son alış etkisini kaldırır (düzeltme / silme). Etkilenen kart kimliklerini döner. */
    static async etkiyiKaldir(tx, id) {
        const r = await new sql.Request(tx).input("ID", sql.Int, id).query(`
      SELECT CARI_HAREKET_ID FROM dbo.TODVZ_STOK_GIRIS WHERE STOK_GIRIS_ID = @ID;
      SELECT DISTINCT STOK_KART_ID FROM dbo.TODVZ_STOK_GIRIS_SATIRI WHERE STOK_GIRIS_ID = @ID;`);
        const rs = r.recordsets;
        const ch = rs[0]?.[0]?.CARI_HAREKET_ID;
        const kartlar = (rs[1] || []).map((x) => Number(x.STOK_KART_ID));
        await new sql.Request(tx).input("ID", sql.Int, id).input("TUR", sql.TinyInt, STOK_BELGE.GIRIS).query(`
      DELETE FROM dbo.TODVZ_STOK_HAREKET WHERE BELGE_TURU = @TUR AND BELGE_ID = @ID;
      DELETE FROM dbo.TODVZ_STOK_GIRIS_SATIRI WHERE STOK_GIRIS_ID = @ID;`);
        if (ch) {
            await new sql.Request(tx).input("CH", sql.Int, ch).query(`
        DELETE FROM dbo.TODVZ_CARI_HAREKET_SATIRI WHERE CARI_HAREKET_ID = @CH;
        DELETE FROM dbo.TODVZ_CARI_HAREKET WHERE CARI_HAREKET_ID = @CH;`);
        }
        return kartlar;
    }
    /** Girdiyi denetler; kartları okur. Hata metni kullanıcıya gösterilir. */
    static async satirlariHazirla(tx, girdi) {
        const satirlar = (girdi.satirlar || []).filter((s) => s && Number(s.stokKartId) > 0);
        if (!satirlar.length)
            throw ApiError.badRequest("Fişte en az bir ürün satırı olmalı.");
        const idler = [...new Set(satirlar.map((s) => Number(s.stokKartId)))];
        const r = await new sql.Request(tx).query(`SELECT STOK_KART_ID, RTRIM(KOD) AS KOD, AD, BIRIM, KDV_ORANI, AKTIF FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${idler.join(",")})`);
        const kartlar = new Map(r.recordset.map((x) => [x.STOK_KART_ID, x]));
        return satirlar.map((s, i) => {
            const k = kartlar.get(Number(s.stokKartId));
            if (!k)
                throw ApiError.badRequest(`${i + 1}. satırdaki stok kartı bulunamadı.`);
            const miktar = sayi(s.miktar);
            if (!(miktar > 0))
                throw ApiError.badRequest(`${i + 1}. satırda (${temiz(k.AD)}) miktar sıfırdan büyük olmalı.`);
            const birimFiyat = s.birimFiyat === null || s.birimFiyat === undefined || temiz(s.birimFiyat) === "" ? 0 : sayi(s.birimFiyat);
            if (!Number.isFinite(birimFiyat) || birimFiyat < 0)
                throw ApiError.badRequest(`${i + 1}. satırda (${temiz(k.AD)}) alış fiyatı geçersiz.`);
            const kdvOrani = s.kdvOrani === null || s.kdvOrani === undefined || temiz(s.kdvOrani) === "" ? Number(k.KDV_ORANI) || 0 : sayi(s.kdvOrani);
            if (!GECERLI_KDV_ORANLARI.includes(kdvOrani))
                throw ApiError.badRequest(`${i + 1}. satırda KDV oranı ${kdvOrani} olamaz.`);
            return { satirNo: i + 1, stokKartId: Number(k.STOK_KART_ID), birim: temiz(k.BIRIM), miktar: y4(miktar), birimFiyat: y4(birimFiyat), kdvOrani, ...girisSatirHesapla(miktar, birimFiyat, kdvOrani) };
        });
    }
    static async kaydet(girdi, kullaniciId, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        let sonuc;
        try {
            sonuc = await this.yaz(tx, girdi, kullaniciId);
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        return { fis: await this.getir(sonuc.id, ctx), uyari: sonuc.uyari };
    }
    /** Fişi açık işlemin içinde yazar (Excel açılış girişi de kullanır) */
    static async yaz(tx, girdi, kullaniciId) {
        const tarih = girdi.tarih ? new Date(girdi.tarih) : new Date();
        if (Number.isNaN(tarih.getTime()))
            throw ApiError.badRequest("Fiş tarihi okunamadı.");
        const id0 = Number(girdi.stokGirisId) || 0;
        let id = id0;
        let uyari = null;
        {
            let eskiKartlar = [];
            let fisNo = "";
            if (id0) {
                const e = await new sql.Request(tx).input("ID", sql.Int, id0).query(`SELECT FIS_NO FROM dbo.TODVZ_STOK_GIRIS WITH (UPDLOCK) WHERE STOK_GIRIS_ID = @ID`);
                if (!e.recordset.length)
                    throw ApiError.notFound("Stok giriş fişi bulunamadı.");
                fisNo = temiz(e.recordset[0].FIS_NO);
            }
            const satirlar = await this.satirlariHazirla(tx, girdi);
            const tumKartlar = [...new Set([...satirlar.map((s) => s.stokKartId)])];
            if (id0)
                eskiKartlar = (await new sql.Request(tx).input("ID", sql.Int, id0).query(`SELECT DISTINCT STOK_KART_ID FROM dbo.TODVZ_STOK_GIRIS_SATIRI WHERE STOK_GIRIS_ID = @ID`)).recordset.map((x) => Number(x.STOK_KART_ID));
            const onceki = await bakiyeler(tx, [...tumKartlar, ...eskiKartlar]);
            if (id0)
                await this.etkiyiKaldir(tx, id0);
            let cariKartId = Number(girdi.cariKartId) || null;
            if (cariKartId) {
                const c = await new sql.Request(tx).input("C", sql.Int, cariKartId).query(`SELECT 1 AS V FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID = @C`);
                if (!c.recordset.length)
                    throw ApiError.badRequest("Seçilen tedarikçi cari bulunamadı.");
            }
            const araToplam = yuvarla2(satirlar.reduce((a, s) => a + s.tutar, 0));
            const toplamKdv = yuvarla2(satirlar.reduce((a, s) => a + s.kdvTutari, 0));
            const genelToplam = yuvarla2(satirlar.reduce((a, s) => a + s.toplamTutar, 0));
            const vezneId = Number(girdi.vezneId) || 1;
            const bas = new sql.Request(tx)
                .input("ID", sql.Int, id0)
                .input("TARIH", sql.DateTime, tarih)
                .input("CARI", sql.Int, cariKartId)
                .input("BELGE", sql.VarChar(50), temiz(girdi.belgeNo).slice(0, 50) || null)
                .input("ACIKLAMA", sql.NVarChar(250), temiz(girdi.aciklama).slice(0, 250) || null)
                .input("ARA", sql.Float, araToplam)
                .input("KDV", sql.Float, toplamKdv)
                .input("GENEL", sql.Float, genelToplam)
                .input("VEZNE", sql.Int, vezneId)
                .input("KUL", sql.Int, kullaniciId || null);
            if (id0) {
                await bas.query(`UPDATE dbo.TODVZ_STOK_GIRIS SET TARIH = @TARIH, CARI_KART_ID = @CARI, BELGE_NO = @BELGE, ACIKLAMA = @ACIKLAMA, ARA_TOPLAM = @ARA,
          TOPLAM_KDV = @KDV, GENEL_TOPLAM = @GENEL, CARI_HAREKET_ID = NULL, VEZNE_ID = @VEZNE, GUNCELLEYEN_ID = @KUL, GUNCELLEME_ZAMANI = GETDATE()
          WHERE STOK_GIRIS_ID = @ID`);
            }
            else {
                fisNo = await this.yeniFisNo(tx, tarih);
                bas.input("NO", sql.VarChar(30), fisNo);
                const r = await bas.query(`INSERT INTO dbo.TODVZ_STOK_GIRIS (FIS_NO, TARIH, CARI_KART_ID, BELGE_NO, ACIKLAMA, ARA_TOPLAM, TOPLAM_KDV, GENEL_TOPLAM, VEZNE_ID, EKLEYEN_ID)
          OUTPUT INSERTED.STOK_GIRIS_ID VALUES (@NO, @TARIH, @CARI, @BELGE, @ACIKLAMA, @ARA, @KDV, @GENEL, @VEZNE, @KUL)`);
                id = r.recordset[0].STOK_GIRIS_ID;
            }
            // Satırlar 10 parametre / satır → 200 satır / paket (Excel açılışında binlerce satır olabilir); hareketler satırlardan tek sorguyla
            for (let i = 0; i < satirlar.length; i += 200) {
                const paket = satirlar.slice(i, i + 200);
                const req = new sql.Request(tx).input("ID", sql.Int, id);
                const degerler = paket.map((s, j) => {
                    req.input(`N${j}`, sql.Int, s.satirNo).input(`K${j}`, sql.Int, s.stokKartId).input(`M${j}`, sql.Float, s.miktar).input(`B${j}`, sql.VarChar(20), s.birim)
                        .input(`F${j}`, sql.Float, s.birimFiyat).input(`V${j}`, sql.Float, s.kdvOrani).input(`T${j}`, sql.Float, s.tutar).input(`KT${j}`, sql.Float, s.kdvTutari).input(`TT${j}`, sql.Float, s.toplamTutar);
                    return `(@ID, @N${j}, @K${j}, @M${j}, @B${j}, @F${j}, @V${j}, @T${j}, @KT${j}, @TT${j})`;
                });
                await req.query(`INSERT INTO dbo.TODVZ_STOK_GIRIS_SATIRI (STOK_GIRIS_ID, SATIR_NO, STOK_KART_ID, MIKTAR, BIRIM, BIRIM_FIYAT, KDV_ORANI, TUTAR, KDV_TUTARI, TOPLAM_TUTAR) VALUES ${degerler.join(",")}`);
            }
            await new sql.Request(tx).input("ID", sql.Int, id).input("TARIH", sql.DateTime, tarih).input("TUR", sql.TinyInt, STOK_BELGE.GIRIS).input("KUL", sql.Int, kullaniciId || null).query(`
        INSERT INTO dbo.TODVZ_STOK_HAREKET (STOK_KART_ID, TARIH, BELGE_TURU, BELGE_ID, SATIR_NO, GIRIS, CIKIS, BIRIM_FIYAT, EKLEYEN_ID)
        SELECT S.STOK_KART_ID, @TARIH, @TUR, @ID, S.SATIR_NO, S.MIKTAR, 0, S.BIRIM_FIYAT, @KUL FROM dbo.TODVZ_STOK_GIRIS_SATIRI S WHERE S.STOK_GIRIS_ID = @ID ORDER BY S.SATIR_NO`);
            if (cariKartId && genelToplam > 0) {
                const aciklama = `Stok Giriş Fişi No: ${fisNo}${temiz(girdi.belgeNo) ? ` / ${temiz(girdi.belgeNo)}` : ""}`.slice(0, 100);
                const ch = await new sql.Request(tx)
                    .input("C", sql.Int, cariKartId).input("TARIH", sql.DateTime, tarih).input("HT", sql.TinyInt, CARI_HAREKET_STOK_GIRISI)
                    .input("A", sql.VarChar(100), aciklama).input("KUL", sql.Int, kullaniciId || 1).input("V", sql.Int, vezneId).input("M", sql.Float, genelToplam)
                    .query(`INSERT INTO dbo.TODVZ_CARI_HAREKET (CARI_KART_ID, TARIH, HAREKET_TIPI, ACIKLAMA, TIP, EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI, VEZNE_ID, POS_CIHAZI_ID)
                  VALUES (@C, @TARIH, @HT, @A, 1, @KUL, GETDATE(), @KUL, GETDATE(), @V, NULL);
                  DECLARE @CH INT = CAST(SCOPE_IDENTITY() AS INT);
                  INSERT INTO dbo.TODVZ_CARI_HAREKET_SATIRI (CARI_HAREKET_ID, SATIR_NO, PARA_ID, MEBLAG)
                  VALUES (@CH, 1, ISNULL((SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID), 1), @M);
                  SELECT @CH AS CH;`);
                await new sql.Request(tx).input("ID", sql.Int, id).input("CH", sql.Int, ch.recordset[0].CH)
                    .query(`UPDATE dbo.TODVZ_STOK_GIRIS SET CARI_HAREKET_ID = @CH WHERE STOK_GIRIS_ID = @ID`);
            }
            await sonAlisGuncelle(tx, [...tumKartlar, ...eskiKartlar]);
            // Tedarikçi (İş 11, G10): fişteki cari satır kartlarının tedarikçisi olur (son giriş)
            if (cariKartId && tumKartlar.length) {
                await new sql.Request(tx).input("C", sql.Int, cariKartId).query(`UPDATE dbo.TODVZ_STOK_KART SET TEDARIKCI_CARI_ID = @C WHERE STOK_KART_ID IN (${tumKartlar.join(",")})`);
            }
            const eksi = await eksiStokDenetle(tx, onceki, girdi.eksiStokOnay);
            if (eksi.length)
                uyari = `Eksiye düşen stok: ${eksi.map((k) => `${k.kod} ${k.ad} (${k.sonraki})`).join(", ")}`;
        }
        return { id, uyari };
    }
    static async sil(id, onay, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT 1 AS V FROM dbo.TODVZ_STOK_GIRIS WITH (UPDLOCK) WHERE STOK_GIRIS_ID = @ID`);
            if (!e.recordset.length)
                throw ApiError.notFound("Stok giriş fişi bulunamadı.");
            const kartlar = (await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT DISTINCT STOK_KART_ID FROM dbo.TODVZ_STOK_GIRIS_SATIRI WHERE STOK_GIRIS_ID = @ID`)).recordset.map((x) => Number(x.STOK_KART_ID));
            const onceki = await bakiyeler(tx, kartlar);
            await this.etkiyiKaldir(tx, id);
            await new sql.Request(tx).input("ID", sql.Int, id).query(`DELETE FROM dbo.TODVZ_STOK_GIRIS WHERE STOK_GIRIS_ID = @ID`);
            await sonAlisGuncelle(tx, kartlar);
            await eksiStokDenetle(tx, onceki, onay);
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
    }
    static async getir(id, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const r = await pool.request().input("ID", sql.Int, id).query(`
      SELECT G.*, RTRIM(C.KOD) AS CARI_KOD, C.AD AS CARI_AD FROM dbo.TODVZ_STOK_GIRIS G LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = G.CARI_KART_ID WHERE G.STOK_GIRIS_ID = @ID;
      SELECT S.*, RTRIM(K.KOD) AS KOD, K.AD FROM dbo.TODVZ_STOK_GIRIS_SATIRI S JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID
      WHERE S.STOK_GIRIS_ID = @ID ORDER BY S.SATIR_NO;`);
        const rs = r.recordsets;
        const b = rs[0]?.[0];
        if (!b)
            return null;
        return {
            stokGirisId: b.STOK_GIRIS_ID,
            fisNo: temiz(b.FIS_NO),
            tarih: new Date(b.TARIH).toISOString(),
            cariKartId: b.CARI_KART_ID ?? null,
            cariKod: b.CARI_KOD ? temiz(b.CARI_KOD) : null,
            cariAd: b.CARI_AD ? temiz(b.CARI_AD) : null,
            belgeNo: b.BELGE_NO ? temiz(b.BELGE_NO) : null,
            aciklama: b.ACIKLAMA ? temiz(b.ACIKLAMA) : null,
            araToplam: Number(b.ARA_TOPLAM) || 0,
            toplamKdv: Number(b.TOPLAM_KDV) || 0,
            genelToplam: Number(b.GENEL_TOPLAM) || 0,
            cariHareketId: b.CARI_HAREKET_ID ?? null,
            vezneId: b.VEZNE_ID ?? null,
            satirlar: (rs[1] || []).map((s) => ({
                satirNo: s.SATIR_NO,
                stokKartId: s.STOK_KART_ID,
                kod: temiz(s.KOD),
                ad: temiz(s.AD),
                birim: temiz(s.BIRIM),
                miktar: Number(s.MIKTAR),
                birimFiyat: Number(s.BIRIM_FIYAT),
                kdvOrani: Number(s.KDV_ORANI),
                tutar: Number(s.TUTAR),
                kdvTutari: Number(s.KDV_TUTARI),
                toplamTutar: Number(s.TOPLAM_TUTAR),
            })),
        };
    }
    /** Stok Giriş Listesi (T19) */
    static async liste(f = {}, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const req = pool.request();
        const kosul = [];
        const gun = "CAST(DATEADD(hour, 3, G.TARIH) AS date)";
        if (f.baslangic) {
            req.input("BAS", sql.VarChar(10), temiz(f.baslangic).slice(0, 10));
            kosul.push(`${gun} >= CAST(@BAS AS date)`);
        }
        if (f.bitis) {
            req.input("BIT", sql.VarChar(10), temiz(f.bitis).slice(0, 10));
            kosul.push(`${gun} <= CAST(@BIT AS date)`);
        }
        if (f.cariKartId) {
            req.input("CARI", sql.Int, f.cariKartId);
            kosul.push("G.CARI_KART_ID = @CARI");
        }
        if (f.arama && temiz(f.arama)) {
            req.input("ARA", sql.NVarChar(210), `%${temiz(f.arama)}%`);
            kosul.push(`(G.FIS_NO LIKE @ARA OR G.BELGE_NO LIKE @ARA OR G.ACIKLAMA LIKE @ARA OR C.AD LIKE @ARA OR EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_GIRIS_SATIRI S JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID WHERE S.STOK_GIRIS_ID = G.STOK_GIRIS_ID AND (K.AD LIKE @ARA OR K.KOD LIKE @ARA)))`);
        }
        const r = await req.query(`
      SELECT G.STOK_GIRIS_ID, G.FIS_NO, G.TARIH, G.CARI_KART_ID, RTRIM(C.KOD) AS CARI_KOD, C.AD AS CARI_AD, G.BELGE_NO, G.ACIKLAMA,
        G.ARA_TOPLAM, G.TOPLAM_KDV, G.GENEL_TOPLAM, (SELECT COUNT(*) FROM dbo.TODVZ_STOK_GIRIS_SATIRI S WHERE S.STOK_GIRIS_ID = G.STOK_GIRIS_ID) AS SATIR_SAYISI,
        (SELECT SUM(S.MIKTAR) FROM dbo.TODVZ_STOK_GIRIS_SATIRI S WHERE S.STOK_GIRIS_ID = G.STOK_GIRIS_ID) AS TOPLAM_MIKTAR
      FROM dbo.TODVZ_STOK_GIRIS G LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = G.CARI_KART_ID
      ${kosul.length ? "WHERE " + kosul.join(" AND ") : ""}
      ORDER BY G.TARIH DESC, G.STOK_GIRIS_ID DESC`);
        return r.recordset.map((b) => ({
            stokGirisId: b.STOK_GIRIS_ID,
            fisNo: temiz(b.FIS_NO),
            tarih: new Date(b.TARIH).toISOString(),
            cariKartId: b.CARI_KART_ID ?? null,
            cariKod: b.CARI_KOD ? temiz(b.CARI_KOD) : null,
            cariAd: b.CARI_AD ? temiz(b.CARI_AD) : null,
            belgeNo: b.BELGE_NO ? temiz(b.BELGE_NO) : null,
            aciklama: b.ACIKLAMA ? temiz(b.ACIKLAMA) : null,
            araToplam: Number(b.ARA_TOPLAM) || 0,
            toplamKdv: Number(b.TOPLAM_KDV) || 0,
            genelToplam: Number(b.GENEL_TOPLAM) || 0,
            satirSayisi: Number(b.SATIR_SAYISI) || 0,
            toplamMiktar: y4(Number(b.TOPLAM_MIKTAR) || 0),
        }));
    }
}

import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { GECERLI_KDV_ORANLARI, birimKoduTicari, girisSatirHesapla, stokMiktariDenetle, yuvarla2 } from "../services/ticari/ticariHesap.js";
import { STOK_BELGE, TicariStokSqlRepository, receteliReddet, stokIslemKilidi } from "./ticariStokSql.repository.js";
import { bakiyeler, eksiStokDenetle } from "./ticariGirisSql.repository.js";
/**
 * Ticari tedarikçiye iade (docs/TICARI_ADISYON_YOL_HARITASI.md, TA13).
 *   - Stok giriş fişinden: satır başına iade ≤ alınan − önceki iadeler (giriş fişi kilitlenir); fiyat / KDV giriş satırınınki.
 *   - Serbest: tedarikçi carisi + kartlar; fiyat verilmezse kartın son alış fiyatı, KDV kartınki.
 *   - Stok düşer (BELGE_TURU 5, ÇIKIŞ, birim fiyat iade fiyatı); tedarikçiye borç (CARI_HAREKET HAREKET_TIPI 7, TIP 0) = KDV dahil toplam;
 *     eksi stok kuralı uygulanır. Düzeltme yok: silinip yeniden kesilir. İadesi olan giriş fişi düzeltilmez / silinmez.
 *   - İade faturası: e-Belge yerel taslağı içeriği (fatura tipi IADE, alıcı tedarikçi, iade edilen fatura = giriş fişinin belge no / tarihi).
 */
export const CARI_HAREKET_TEDARIKCI_IADE = 7;
const temiz = (v) => String(v ?? "").trim();
const sayi = (v) => {
    if (typeof v === "string")
        v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
    return Number(v);
};
const y4 = (n) => Math.round(n * 10000) / 10000;
async function kaynakOku(r, girisId, kilit = false) {
    const q = await new sql.Request(r).input("ID", sql.Int, girisId).query(`
    SELECT G.STOK_GIRIS_ID, G.FIS_NO, G.TARIH, G.BELGE_NO, G.CARI_KART_ID, RTRIM(ISNULL(C.KOD,'')) AS CARI_KOD, RTRIM(ISNULL(C.AD,'')) AS CARI_AD
    FROM dbo.TODVZ_STOK_GIRIS G ${kilit ? "WITH (UPDLOCK, HOLDLOCK)" : ""} LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = G.CARI_KART_ID WHERE G.STOK_GIRIS_ID = @ID;
    SELECT S.SATIR_NO, S.STOK_KART_ID, RTRIM(K.KOD) AS KOD, K.AD, S.BIRIM, S.MIKTAR, S.BIRIM_FIYAT, S.KDV_ORANI,
      ISNULL((SELECT SUM(X.MIKTAR) FROM dbo.TODVZ_STOK_TEDARIKCI_IADE_SATIR X JOIN dbo.TODVZ_STOK_TEDARIKCI_IADE I ON I.IADE_ID = X.IADE_ID
        WHERE I.STOK_GIRIS_ID = S.STOK_GIRIS_ID AND X.GIRIS_SATIR_NO = S.SATIR_NO), 0) AS IADE
    FROM dbo.TODVZ_STOK_GIRIS_SATIRI S JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID WHERE S.STOK_GIRIS_ID = @ID ORDER BY S.SATIR_NO;`);
    const rs = q.recordsets;
    const g = rs[0][0];
    if (!g)
        throw ApiError.notFound("Stok giriş fişi bulunamadı.");
    return {
        fis: { stokGirisId: Number(g.STOK_GIRIS_ID), fisNo: temiz(g.FIS_NO), tarih: new Date(g.TARIH).toISOString(), belgeNo: temiz(g.BELGE_NO) || null,
            cariKartId: g.CARI_KART_ID ?? null, cariKod: temiz(g.CARI_KOD), cariAd: temiz(g.CARI_AD) },
        satirlar: rs[1].map((x) => {
            const alinan = Number(x.MIKTAR) || 0, iade = y4(Number(x.IADE) || 0);
            return { satirNo: Number(x.SATIR_NO), stokKartId: Number(x.STOK_KART_ID), kod: temiz(x.KOD), ad: temiz(x.AD), birim: temiz(x.BIRIM) || "Adet",
                alinan, iadeEdilen: iade, kalan: Math.max(0, y4(alinan - iade)), birimFiyat: Number(x.BIRIM_FIYAT) || 0, kdvOrani: Number(x.KDV_ORANI) || 0 };
        }),
    };
}
export class TicariTedarikciIadeSqlRepository {
    static async kaynak(girisId, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        return kaynakOku(pool, girisId);
    }
    /** Bu giriş fişinin iadesi var mı (giriş düzeltme / silme engeli) */
    static async girisIadesiVar(tx, girisId) {
        const r = await new sql.Request(tx).input("ID", sql.Int, girisId).query(`SELECT TOP 1 RTRIM(IADE_NO) AS NO FROM dbo.TODVZ_STOK_TEDARIKCI_IADE WHERE STOK_GIRIS_ID = @ID`);
        return r.recordset[0]?.NO ? temiz(r.recordset[0].NO) : null;
    }
    static async kaydet(g, kullaniciId, ctx) {
        const tarih = g.tarih ? new Date(String(g.tarih)) : new Date();
        if (Number.isNaN(tarih.getTime()))
            throw ApiError.badRequest("İade tarihi okunamadı.");
        const istek = (g.satirlar || []).filter((s) => s && sayi(s.miktar) > 0);
        if (!istek.length)
            throw ApiError.badRequest("İade edilecek en az bir satır ve miktar girilmeli.");
        for (const [i, s] of istek.entries()) {
            const h = stokMiktariDenetle(s.miktar);
            if (h)
                throw ApiError.badRequest(`${i + 1}. satır: ${h}`);
        }
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        await stokIslemKilidi(tx);
        let id = 0;
        let uyari = null;
        try {
            const girisId = Number(g.stokGirisId) || 0;
            let cariKartId = Number(g.cariKartId) || 0;
            const hazir = [];
            if (girisId) {
                const k = await kaynakOku(tx, girisId, true);
                if (!k.fis.cariKartId)
                    throw ApiError.badRequest(`${k.fis.fisNo} giriş fişinde tedarikçi yok; serbest iade yapın.`);
                cariKartId = Number(k.fis.cariKartId);
                const gorulen = new Set();
                for (const s of istek) {
                    const no = Number(s.girisSatirNo);
                    const ks = k.satirlar.find((x) => x.satirNo === no);
                    if (!ks)
                        throw ApiError.badRequest(`Giriş fişinde ${no}. satır yok.`);
                    if (gorulen.has(no))
                        throw ApiError.badRequest(`${ks.ad}: aynı satır iki kez iade edilemez.`);
                    gorulen.add(no);
                    const m = y4(sayi(s.miktar));
                    if (m - ks.kalan > 0.00005)
                        throw ApiError.badRequest(`${ks.ad}: iade edilebilecek kalan ${ks.kalan} ${ks.birim} (alınan ${ks.alinan}, önceki iadeler ${ks.iadeEdilen}).`);
                    hazir.push({ stokKartId: ks.stokKartId, girisSatirNo: no, birim: ks.birim, miktar: m, birimFiyat: ks.birimFiyat, kdvOrani: ks.kdvOrani });
                }
            }
            else {
                if (!cariKartId)
                    throw ApiError.badRequest("Serbest iadede tedarikçi cari seçilmeli.");
                const ids = [...new Set(istek.map((s) => Number(s.stokKartId)).filter((x) => x > 0))];
                if (ids.length !== istek.length)
                    throw ApiError.badRequest("Her satırda tek bir stok kartı olmalı (aynı kart iki kez olmaz).");
                await receteliReddet(tx, ids, "tedarikçiye iade");
                const kr = await new sql.Request(tx).query(`SELECT STOK_KART_ID, BIRIM, KDV_ORANI, COALESCE(NULLIF(SON_ALIS_FIYATI, 0), ALIS_FIYATI, 0) AS ALIS FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID IN (${ids.join(",")})`);
                const km = new Map(kr.recordset.map((x) => [Number(x.STOK_KART_ID), x]));
                for (const s of istek) {
                    const x = km.get(Number(s.stokKartId));
                    if (!x)
                        throw ApiError.badRequest(`Stok kartı bulunamadı (#${s.stokKartId}).`);
                    const bf = s.birimFiyat === undefined || s.birimFiyat === null || s.birimFiyat === "" ? Number(x.ALIS) || 0 : sayi(s.birimFiyat);
                    const kdv = s.kdvOrani === undefined || s.kdvOrani === null || s.kdvOrani === "" ? Number(x.KDV_ORANI) || 0 : sayi(s.kdvOrani);
                    if (!Number.isFinite(bf) || bf < 0)
                        throw ApiError.badRequest("Birim fiyat eksi olamaz.");
                    if (!GECERLI_KDV_ORANLARI.includes(kdv))
                        throw ApiError.badRequest(`KDV oranı geçersiz (%${kdv}).`);
                    hazir.push({ stokKartId: Number(s.stokKartId), girisSatirNo: null, birim: temiz(x.BIRIM) || "Adet", miktar: y4(sayi(s.miktar)), birimFiyat: bf, kdvOrani: kdv });
                }
            }
            const c = await new sql.Request(tx).input("C", sql.Int, cariKartId).query(`SELECT 1 AS V FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID = @C`);
            if (!c.recordset.length)
                throw ApiError.badRequest("Tedarikçi cari bulunamadı.");
            // Cari hareketin veznesi zorunlu (TODVZ_CARI_HAREKET.VEZNE_ID NOT NULL): Stok Giriş Fişi gibi verilmezse 1
            const vezneId = Number(g.vezneId) || 1;
            const hesap = hazir.map((h) => ({ ...h, ...girisSatirHesapla(h.miktar, h.birimFiyat, h.kdvOrani) }));
            const ara = yuvarla2(hesap.reduce((a, x) => a + x.tutar, 0)), kdv = yuvarla2(hesap.reduce((a, x) => a + x.kdvTutari, 0)), genel = yuvarla2(hesap.reduce((a, x) => a + x.toplamTutar, 0));
            const onceki = await bakiyeler(tx, hesap.map((x) => x.stokKartId));
            const o = `TI${tarih.getFullYear()}`;
            const no = `${o}${String(Number((await new sql.Request(tx).input("O", sql.VarChar(10), o).query(`SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(IADE_NO, 7, 20) AS INT)), 0) + 1 AS N
        FROM dbo.TODVZ_STOK_TEDARIKCI_IADE WITH (UPDLOCK, HOLDLOCK) WHERE IADE_NO LIKE @O + '%' AND LEN(IADE_NO) = 12`)).recordset[0].N) || 1).padStart(6, "0")}`;
            id = (await new sql.Request(tx).input("NO", sql.VarChar(20), no).input("T", sql.DateTime, tarih).input("C", sql.Int, cariKartId).input("G", sql.Int, girisId || null)
                .input("B", sql.VarChar(50), temiz(g.belgeNo).slice(0, 50) || null).input("A", sql.NVarChar(250), temiz(g.aciklama).slice(0, 250) || null)
                .input("ARA", sql.Decimal(18, 2), ara).input("KDV", sql.Decimal(18, 2), kdv).input("GENEL", sql.Decimal(18, 2), genel).input("V", sql.Int, vezneId).input("KUL", sql.Int, kullaniciId || null)
                .query(`INSERT INTO dbo.TODVZ_STOK_TEDARIKCI_IADE (IADE_NO, TARIH, CARI_KART_ID, STOK_GIRIS_ID, BELGE_NO, ACIKLAMA, ARA_TOPLAM, TOPLAM_KDV, GENEL_TOPLAM, VEZNE_ID, EKLEYEN_ID)
          OUTPUT INSERTED.IADE_ID VALUES (@NO, @T, @C, @G, @B, @A, @ARA, @KDV, @GENEL, @V, @KUL)`)).recordset[0].IADE_ID;
            const req = new sql.Request(tx).input("ID", sql.Int, id);
            const v = hesap.map((h, j) => {
                req.input(`N${j}`, sql.Int, j + 1).input(`K${j}`, sql.Int, h.stokKartId).input(`GS${j}`, sql.Int, h.girisSatirNo).input(`B${j}`, sql.VarChar(20), h.birim)
                    .input(`M${j}`, sql.Decimal(18, 4), h.miktar).input(`F${j}`, sql.Decimal(18, 6), h.birimFiyat).input(`V${j}`, sql.Decimal(5, 2), h.kdvOrani)
                    .input(`T${j}`, sql.Decimal(18, 2), h.tutar).input(`KT${j}`, sql.Decimal(18, 2), h.kdvTutari).input(`TT${j}`, sql.Decimal(18, 2), h.toplamTutar);
                return `(@ID, @N${j}, @K${j}, @GS${j}, @B${j}, @M${j}, @F${j}, @V${j}, @T${j}, @KT${j}, @TT${j})`;
            });
            await req.query(`INSERT INTO dbo.TODVZ_STOK_TEDARIKCI_IADE_SATIR (IADE_ID, SATIR_NO, STOK_KART_ID, GIRIS_SATIR_NO, BIRIM, MIKTAR, BIRIM_FIYAT, KDV_ORANI, TUTAR, KDV_TUTARI, TOPLAM_TUTAR) VALUES ${v.join(",")}`);
            await new sql.Request(tx).input("ID", sql.Int, id).input("T", sql.DateTime, tarih).input("TUR", sql.TinyInt, STOK_BELGE.TEDARIKCI_IADE).input("KUL", sql.Int, kullaniciId || null).query(`
        INSERT INTO dbo.TODVZ_STOK_HAREKET (STOK_KART_ID, TARIH, BELGE_TURU, BELGE_ID, SATIR_NO, GIRIS, CIKIS, BIRIM_FIYAT, EKLEYEN_ID)
        SELECT STOK_KART_ID, @T, @TUR, @ID, SATIR_NO, 0, MIKTAR, BIRIM_FIYAT, @KUL FROM dbo.TODVZ_STOK_TEDARIKCI_IADE_SATIR WHERE IADE_ID = @ID ORDER BY SATIR_NO`);
            if (genel > 0) {
                const aciklama = `Tedarikçiye İade No: ${no}${temiz(g.belgeNo) ? ` / ${temiz(g.belgeNo)}` : ""}`.slice(0, 100);
                const ch = await new sql.Request(tx).input("C", sql.Int, cariKartId).input("T", sql.DateTime, tarih).input("HT", sql.TinyInt, CARI_HAREKET_TEDARIKCI_IADE)
                    .input("A", sql.VarChar(100), aciklama).input("KUL", sql.Int, kullaniciId || 1).input("V", sql.Int, vezneId).input("M", sql.Float, genel)
                    .query(`INSERT INTO dbo.TODVZ_CARI_HAREKET (CARI_KART_ID, TARIH, HAREKET_TIPI, ACIKLAMA, TIP, EKLEYEN_ID, EKLEME_ZAMANI, GUNCELLEYEN_ID, GUNCELLEME_ZAMANI, VEZNE_ID, POS_CIHAZI_ID)
                  VALUES (@C, @T, @HT, @A, 0, @KUL, GETDATE(), @KUL, GETDATE(), @V, NULL);
                  DECLARE @CH INT = CAST(SCOPE_IDENTITY() AS INT);
                  INSERT INTO dbo.TODVZ_CARI_HAREKET_SATIRI (CARI_HAREKET_ID, SATIR_NO, PARA_ID, MEBLAG)
                  VALUES (@CH, 1, ISNULL((SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID), 1), @M);
                  SELECT @CH AS CH;`);
                await new sql.Request(tx).input("ID", sql.Int, id).input("CH", sql.Int, ch.recordset[0].CH).query(`UPDATE dbo.TODVZ_STOK_TEDARIKCI_IADE SET CARI_HAREKET_ID = @CH WHERE IADE_ID = @ID`);
            }
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
            const e = await new sql.Request(tx).input("ID", sql.Int, id).query(`SELECT CARI_HAREKET_ID FROM dbo.TODVZ_STOK_TEDARIKCI_IADE WITH (UPDLOCK) WHERE IADE_ID = @ID`);
            if (!e.recordset.length)
                throw ApiError.notFound("Tedarikçi iadesi bulunamadı.");
            const ch = e.recordset[0].CARI_HAREKET_ID;
            await new sql.Request(tx).input("ID", sql.Int, id).input("TUR", sql.TinyInt, STOK_BELGE.TEDARIKCI_IADE).input("CH", sql.Int, ch ?? null).query(`
        DELETE FROM dbo.TODVZ_STOK_HAREKET WHERE BELGE_TURU = @TUR AND BELGE_ID = @ID;
        DELETE FROM dbo.TODVZ_STOK_TEDARIKCI_IADE_SATIR WHERE IADE_ID = @ID;
        DELETE FROM dbo.TODVZ_STOK_TEDARIKCI_IADE WHERE IADE_ID = @ID;
        IF @CH IS NOT NULL BEGIN DELETE FROM dbo.TODVZ_CARI_HAREKET_SATIRI WHERE CARI_HAREKET_ID = @CH; DELETE FROM dbo.TODVZ_CARI_HAREKET WHERE CARI_HAREKET_ID = @CH; END;`);
            await tx.commit();
        }
        catch (err) {
            await tx.rollback().catch(() => undefined);
            throw err;
        }
    }
    /** e-Belge yerel taslağı bağlantısı (frontend taslağı kaydedince yazar) */
    static async taslakBagla(id, taslakId, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        await pool.request().input("ID", sql.Int, id).input("T", sql.Int, taslakId).query(`UPDATE dbo.TODVZ_STOK_TEDARIKCI_IADE SET EBELGE_TASLAK_ID = @T WHERE IADE_ID = @ID`);
    }
    static async getir(id, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const r = await pool.request().input("ID", sql.Int, id).query(`
      SELECT I.*, RTRIM(ISNULL(C.KOD,'')) AS CARI_KOD, RTRIM(ISNULL(C.AD,'')) AS CARI_AD, G.FIS_NO AS GIRIS_NO, G.BELGE_NO AS GIRIS_BELGE_NO, G.TARIH AS GIRIS_TARIH
      FROM dbo.TODVZ_STOK_TEDARIKCI_IADE I LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = I.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_STOK_GIRIS G ON G.STOK_GIRIS_ID = I.STOK_GIRIS_ID WHERE I.IADE_ID = @ID;
      SELECT S.*, RTRIM(K.KOD) AS KOD, K.AD FROM dbo.TODVZ_STOK_TEDARIKCI_IADE_SATIR S JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID WHERE S.IADE_ID = @ID ORDER BY S.SATIR_NO;`);
        const rs = r.recordsets;
        const f = rs[0][0];
        if (!f)
            throw ApiError.notFound("Tedarikçi iadesi bulunamadı.");
        return {
            iadeId: Number(f.IADE_ID), iadeNo: temiz(f.IADE_NO), tarih: new Date(f.TARIH).toISOString(), cariKartId: Number(f.CARI_KART_ID), cariKod: temiz(f.CARI_KOD), cariAd: temiz(f.CARI_AD),
            stokGirisId: f.STOK_GIRIS_ID ?? null, girisNo: f.GIRIS_NO ? temiz(f.GIRIS_NO) : null, girisBelgeNo: f.GIRIS_BELGE_NO ? temiz(f.GIRIS_BELGE_NO) : null,
            girisTarihi: f.GIRIS_TARIH ? new Date(f.GIRIS_TARIH).toISOString() : null, belgeNo: f.BELGE_NO ? temiz(f.BELGE_NO) : null, aciklama: f.ACIKLAMA ? temiz(f.ACIKLAMA) : null,
            araToplam: Number(f.ARA_TOPLAM), toplamKdv: Number(f.TOPLAM_KDV), genelToplam: Number(f.GENEL_TOPLAM), cariHareketId: f.CARI_HAREKET_ID ?? null, ebelgeTaslakId: f.EBELGE_TASLAK_ID ?? null,
            satirlar: rs[1].map((x) => ({ satirNo: Number(x.SATIR_NO), stokKartId: Number(x.STOK_KART_ID), kod: temiz(x.KOD), ad: temiz(x.AD), girisSatirNo: x.GIRIS_SATIR_NO ?? null,
                birim: temiz(x.BIRIM), miktar: Number(x.MIKTAR), birimFiyat: Number(x.BIRIM_FIYAT), kdvOrani: Number(x.KDV_ORANI), tutar: Number(x.TUTAR), kdvTutari: Number(x.KDV_TUTARI), toplamTutar: Number(x.TOPLAM_TUTAR) })),
        };
    }
    static async liste(f = {}, ctx) {
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const req = pool.request();
        const k = [];
        const gun = "CAST(DATEADD(hour, 3, I.TARIH) AS date)";
        if (f.baslangic) {
            req.input("B", sql.VarChar(10), temiz(f.baslangic).slice(0, 10));
            k.push(`${gun} >= CAST(@B AS date)`);
        }
        if (f.bitis) {
            req.input("E", sql.VarChar(10), temiz(f.bitis).slice(0, 10));
            k.push(`${gun} <= CAST(@E AS date)`);
        }
        if (f.cariKartId) {
            req.input("C", sql.Int, f.cariKartId);
            k.push("I.CARI_KART_ID = @C");
        }
        const r = await req.query(`SELECT TOP 500 I.IADE_ID, I.IADE_NO, I.TARIH, I.GENEL_TOPLAM, I.BELGE_NO, RTRIM(ISNULL(C.AD,'')) AS CARI_AD, G.FIS_NO AS GIRIS_NO
      FROM dbo.TODVZ_STOK_TEDARIKCI_IADE I LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = I.CARI_KART_ID LEFT JOIN dbo.TODVZ_STOK_GIRIS G ON G.STOK_GIRIS_ID = I.STOK_GIRIS_ID
      ${k.length ? `WHERE ${k.join(" AND ")}` : ""} ORDER BY I.TARIH DESC, I.IADE_ID DESC`);
        return r.recordset.map((x) => ({ iadeId: Number(x.IADE_ID), iadeNo: temiz(x.IADE_NO), tarih: new Date(x.TARIH).toISOString(), genelToplam: Number(x.GENEL_TOPLAM),
            belgeNo: x.BELGE_NO ? temiz(x.BELGE_NO) : null, cariAd: temiz(x.CARI_AD), girisNo: x.GIRIS_NO ? temiz(x.GIRIS_NO) : null }));
    }
    /**
     * İade faturası için e-Belge yerel taslak içeriği (EBelgeDogrulaPage `?taslak=` biçimi): fatura tipi IADE, alıcı tedarikçi,
     * satırlar KDV hariç fiyatla, iade edilen fatura = giriş fişinin belge no + tarihi (serbest iadede boş: kullanıcı yazar).
     * Senaryo: tedarikçinin e-Fatura posta kutusu varsa TICARIFATURA, yoksa EARSIVFATURA.
     */
    static async ebelgeTaslagi(id, ctx) {
        const f = await this.getir(id, ctx);
        const pool = await TicariStokSqlRepository.havuz(ctx);
        const c = (await pool.request().input("C", sql.Int, f.cariKartId).query(`
      SELECT RTRIM(ISNULL(C.VERGI_KIMLIK_NO,'')) AS VKN, RTRIM(ISNULL(C.AD,'')) AS AD, RTRIM(ISNULL(C.ADRES,'')) AS ADRES, RTRIM(ISNULL(C.EPOSTA,'')) AS EPOSTA,
        RTRIM(ISNULL(C.TELEFON,'')) AS TEL, RTRIM(ISNULL(C.E_FATURA_POSTA_KUTUSU,'')) AS PK, RTRIM(ISNULL(VD.AD,'')) AS VD, RTRIM(ISNULL(IL.AD,'')) AS IL, RTRIM(ISNULL(ILCE.AD,'')) AS ILCE
      FROM dbo.TODVZ_CARI_KART C LEFT JOIN dbo.TODVZ_TABLO_MADDESI VD ON VD.TABLO_MADDESI_ID = C.VERGI_DAIRESI_ID AND VD.TUR = 0
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI IL ON IL.TABLO_MADDESI_ID = C.IL_ID LEFT JOIN dbo.TODVZ_TABLO_MADDESI ILCE ON ILCE.TABLO_MADDESI_ID = C.ILCE_ID
      WHERE C.CARI_KART_ID = @C`)).recordset[0] || {};
        const gun = (t) => (t ? new Date(new Date(t).getTime() + 3 * 3600_000).toISOString().slice(0, 10) : "");
        return {
            iadeNo: f.iadeNo, genelToplam: f.genelToplam,
            icerik: {
                senaryo: c.PK ? "TICARIFATURA" : "EARSIVFATURA", faturaTipi: "IADE", paraBirimi: "TRY", tarih: gun(f.tarih),
                not: `Tedarikçiye iade ${f.iadeNo}${f.girisNo ? ` (stok giriş ${f.girisNo})` : ""}`,
                aliciVkn: temiz(c.VKN), aliciUnvan: temiz(c.AD) || f.cariAd, aliciVd: temiz(c.VD), aliciIl: temiz(c.IL), aliciIlce: temiz(c.ILCE), aliciAdres: temiz(c.ADRES),
                aliciEposta: temiz(c.EPOSTA), aliciTel: temiz(c.TEL), aliciPk: temiz(c.PK),
                satirlar: f.satirlar.map((s) => ({ ad: s.ad, hizmetKodu: s.kod, miktar: s.miktar, birimKodu: birimKoduTicari(s.birim), birimFiyat: s.birimFiyat, iskontoOrani: 0, kdvOrani: s.kdvOrani })),
                iadeFaturalar: f.girisBelgeNo ? [{ belgeNo: f.girisBelgeNo, tarih: gun(f.girisTarihi) }] : [],
            },
            eksik: [!temiz(c.VKN) && "tedarikçinin VKN / TCKN'si", !f.girisBelgeNo && "iade edilen faturanın numarası ve tarihi"].filter(Boolean),
        };
    }
}

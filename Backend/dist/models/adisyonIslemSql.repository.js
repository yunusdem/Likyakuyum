import { islemDahaOnceYapildiMi, istekOku, istekYaz } from "../services/adisyon/adisyonIstek.js";
import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { AdisyonTanimSqlRepository } from "./adisyonTanimSql.repository.js";
import { AdisyonSqlRepository } from "./adisyonSql.repository.js";
import { AdisyonMutfakSqlRepository, MUTFAK_FIS_TUR } from "./adisyonMutfakSql.repository.js";
import { ADISYON_DURUM, ADISYON_TUR, IKRAM_NEDENLERI, IPTAL_NEDENLERI, YETKI_ADI, kismiMiktar, nedenMetni } from "../services/adisyon/adisyonHesap.js";
import { tartiBirimi } from "../services/ticari/ticariHesap.js";
import { olayTetikle, olayYaz } from "../services/adisyon/adisyonOlay.service.js";
import { odemeAsimiDenetle, odendiyseKapat } from "./adisyonHesapSql.repository.js";
/**
 * Masa işlemleri (docs/TICARI_ADISYON_YOL_HARITASI.md, TA25, TA27, D6): masa taşıma, birleştirme, ürün taşıma (ayırma), ikram,
 * iptal (kalem / adisyon). Her işlem tek veritabanı işleminde: adisyon satırı kilitlenir (birleştirmede iki adisyon kimlik
 * sırasıyla), hedef masa için masa kilidi; kalemin bir kısmına işlemde kalem bölünür. İkram / iptal neden ister ve işlemi yapanı
 * yazar (rapor); mutfakta hazırlanan kalemin iptalinde yazıcılı yere iptal fişi. Mutfak ekranları ve kasa olayla yenilenir.
 */
const temiz = (v) => String(v ?? "").trim();
const havuz = (ctx) => AdisyonTanimSqlRepository.havuz(ctx);
async function islem(ctx, f) {
    const pool = await havuz(ctx);
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
        const r = await f(tx);
        await tx.commit();
        olayTetikle(ctx ?? {});
        return r;
    }
    catch (e) {
        await tx.rollback().catch(() => undefined);
        throw e;
    }
}
const yetki = (kim, y) => { if (!kim.yetkiler?.includes(y))
    throw ApiError.forbidden(`Bu işlem için "${YETKI_ADI[y]}" yetkisi gerekli.`); };
/** Açık adisyonu kilitler (UPDLOCK); kapanmış / yoksa 409 / 404 */
async function adisyonKilitle(tx, adisyonId) {
    const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT ADISYON_ID, RTRIM(ADISYON_NO) AS NO, DURUM, MASA_ID, TUR, KISI_SAYISI FROM dbo.TODVZ_ADISYON WITH (UPDLOCK, ROWLOCK) WHERE ADISYON_ID = @A`);
    const a = r.recordset[0];
    if (!a)
        throw ApiError.notFound("Adisyon bulunamadı.");
    if (![ADISYON_DURUM.ACIK, ADISYON_DURUM.HESAP_ISTENDI].includes(a.DURUM))
        throw ApiError.conflict(`Adisyon ${temiz(a.NO)} kapanmış; işlem yapılamaz (ekranı yenileyin).`);
    return { adisyonId: Number(a.ADISYON_ID), no: temiz(a.NO), durum: Number(a.DURUM), masaId: a.MASA_ID ?? null, tur: Number(a.TUR), kisi: a.KISI_SAYISI ?? null };
}
/**
 * İki masayı ilgilendiren işlemlerde (taşıma, birleştirme, ürün taşıma) önce masa kilitleri masa kimliği sırasıyla alınır:
 * A→B ve B→A aynı anda gelirse biri öbürünü bekler, kilitlenme (deadlock) olmaz. Kilit işlem sahiplidir, tekrar alınabilir.
 */
async function masalariSiraylaKilitle(tx, masaIdler) {
    for (const m of [...new Set(masaIdler.map(Number).filter((x) => Number.isInteger(x) && x > 0))].sort((a, b) => a - b)) {
        const k = await new sql.Request(tx).input("K", sql.NVarChar(255), `LIKYA_ADISYON_MASA_${m}`).query(`DECLARE @r INT;
      EXEC @r = sp_getapplock @Resource = @K, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; SELECT @r AS R;`);
        if (Number(k.recordset[0].R) < 0)
            throw ApiError.conflict("Masa başka bir cihazda işlemde; biraz sonra tekrar deneyin.");
    }
}
const adisyonMasasi = async (tx, adisyonId) => (await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT MASA_ID FROM dbo.TODVZ_ADISYON WHERE ADISYON_ID = @A`)).recordset[0]?.MASA_ID ?? null;
async function masaKilidi(tx, masaId) {
    const k = await new sql.Request(tx).input("K", sql.NVarChar(255), `LIKYA_ADISYON_MASA_${masaId}`).query(`DECLARE @r INT;
    EXEC @r = sp_getapplock @Resource = @K, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; SELECT @r AS R;`);
    if (Number(k.recordset[0].R) < 0)
        throw ApiError.conflict("Masa başka bir cihazda işlemde; biraz sonra tekrar deneyin.");
    const m = await new sql.Request(tx).input("M", sql.Int, masaId).query(`SELECT M.AKTIF, B.AKTIF AS BA, RTRIM(M.AD) AS AD,
    (SELECT TOP 1 ADISYON_ID FROM dbo.TODVZ_ADISYON WHERE MASA_ID = @M AND DURUM IN (0, 1)) AS ACIK
    FROM dbo.TODVZ_ADISYON_MASA M JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID WHERE M.MASA_ID = @M`);
    const x = m.recordset[0];
    if (!x)
        throw ApiError.notFound("Hedef masa bulunamadı.");
    if (!x.AKTIF || !x.BA)
        throw ApiError.badRequest("Hedef masa pasif.");
    return { ad: temiz(x.AD), acikAdisyonId: x.ACIK ?? null };
}
/** Seçilen kalemler (adisyonun, iptal olmayan) — kısmi miktarda kalem bölünür; işlem görecek kalem kimlikleri döner */
async function kalemleriHazirla(tx, adisyonId, secim, kosul) {
    const liste = (Array.isArray(secim) ? secim : []).filter((s) => Number(s?.kalemId) > 0);
    if (!liste.length)
        throw ApiError.badRequest("Kalem seçilmeli.");
    if (new Set(liste.map((s) => Number(s.kalemId))).size !== liste.length)
        throw ApiError.badRequest("Aynı kalem iki kez seçilmiş.");
    const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT KALEM_ID, AD, MIKTAR, BIRIM, IKRAM, IPTAL, DURUM, YER_ID, FATURA_ID FROM dbo.TODVZ_ADISYON_KALEM WITH (UPDLOCK, ROWLOCK)
    WHERE ADISYON_ID = @A AND KALEM_ID IN (${liste.map((s) => Number(s.kalemId)).join(",")})`);
    const sonuc = [];
    for (const s of liste) {
        const k = r.recordset.find((x) => Number(x.KALEM_ID) === Number(s.kalemId));
        if (!k)
            throw ApiError.badRequest("Seçilen kalem bu adisyonda değil (ekranı yenileyin).");
        const ad = temiz(k.AD);
        // D7: ödenmiş (satış fişine yazılmış) kalem değiştirilemez / taşınamaz
        if (k.FATURA_ID)
            throw ApiError.badRequest(`${ad}: ödenmiş (fişe yazılmış); işlem yapılamaz.`);
        const engel = kosul(k);
        if (engel)
            throw ApiError.badRequest(`${ad}: ${engel}`);
        const km = kismiMiktar(Number(k.MIKTAR), s.miktar, !!tartiBirimi(k.BIRIM));
        if ("hata" in km)
            throw ApiError.badRequest(`${ad}: ${km.hata}`);
        let id = Number(k.KALEM_ID);
        if (!km.tamami) {
            // Bölme: asıl kalemden miktar düşer, aynı özelliklerle yeni kalem açılır (işlem yenisine uygulanır)
            await new sql.Request(tx).input("K", sql.Int, id).input("M", sql.Decimal(18, 4), km.miktar).query(`UPDATE dbo.TODVZ_ADISYON_KALEM SET MIKTAR = MIKTAR - @M WHERE KALEM_ID = @K`);
            id = Number((await new sql.Request(tx).input("K", sql.Int, id).input("M", sql.Decimal(18, 4), km.miktar).query(`
        INSERT INTO dbo.TODVZ_ADISYON_KALEM (ADISYON_ID, STOK_KART_ID, AD, MIKTAR, BIRIM, PORSIYON_AD, PORSIYON_CARPAN, BIRIM_FIYAT, KDV_ORANI, SECENEKLER, NOTU, YER_ID, DURUM,
          IKRAM, IPTAL, NEDEN, ISLEM_YAPAN, EKLEYEN_GARSON_ID, EKLEYEN_KULLANICI_ID, EKLEYEN_AD, EKLEME_ZAMANI, GONDERIM_ZAMANI, HAZIR_ZAMANI)
        OUTPUT INSERTED.KALEM_ID
        SELECT ADISYON_ID, STOK_KART_ID, AD, @M, BIRIM, PORSIYON_AD, PORSIYON_CARPAN, BIRIM_FIYAT, KDV_ORANI, SECENEKLER, NOTU, YER_ID, DURUM,
          IKRAM, IPTAL, NEDEN, ISLEM_YAPAN, EKLEYEN_GARSON_ID, EKLEYEN_KULLANICI_ID, EKLEYEN_AD, EKLEME_ZAMANI, GONDERIM_ZAMANI, HAZIR_ZAMANI
        FROM dbo.TODVZ_ADISYON_KALEM WHERE KALEM_ID = @K`)).recordset[0].KALEM_ID);
        }
        sonuc.push({ id, durum: Number(k.DURUM), yerId: k.YER_ID ?? null });
    }
    return sonuc;
}
/** Adisyonların mutfakta süren kalemleri için ekranlı yerlere "mutfak" olayı (KDS masa adını / listesini yeniler) */
async function kdsBildir(tx, adisyonIdler) {
    const r = await new sql.Request(tx).query(`SELECT DISTINCT K.YER_ID FROM dbo.TODVZ_ADISYON_KALEM K JOIN dbo.TODVZ_ADISYON_HAZIRLIK H ON H.YER_ID = K.YER_ID AND H.EKRAN = 1
    WHERE K.ADISYON_ID IN (${adisyonIdler.map(Number).join(",")}) AND K.DURUM IN (1, 2) AND K.IPTAL = 0`);
    for (const x of r.recordset)
        await olayYaz(tx, "mutfak", { adisyonId: adisyonIdler[0], yerId: Number(x.YER_ID), veri: { degisti: true } });
}
const surum = (tx, adisyonId) => new sql.Request(tx).input("A", sql.Int, adisyonId).query(`UPDATE dbo.TODVZ_ADISYON SET SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
/** Ödenmemiş (iptal dışı, fişsiz) kalemi kalmayan adisyon kapanır (masa boşalır): fiş yazılmışsa "ödendi", yoksa iptal kapanışı */
async function bosaldiysaKapat(tx, adisyonId, aciklama, masaId = null) {
    if (await odendiyseKapat(tx, adisyonId, masaId))
        return true;
    const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_ADISYON_KALEM WHERE ADISYON_ID = @A AND IPTAL = 0 AND FATURA_ID IS NULL`);
    if (Number(r.recordset[0].N) > 0)
        return false;
    const f = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_FIS WHERE ADISYON_ID = @A) AS F, (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_ODEME WHERE ADISYON_ID = @A AND FATURA_ID IS NULL) AS O`);
    if (Number(f.recordset[0].F) || Number(f.recordset[0].O))
        return false;
    await new sql.Request(tx).input("A", sql.Int, adisyonId).input("AC", sql.NVarChar(250), aciklama.slice(0, 250))
        .query(`UPDATE dbo.TODVZ_ADISYON SET DURUM = 9, KAPANIS_ZAMANI = GETDATE(), ACIKLAMA = @AC, SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
    return true;
}
export class AdisyonIslemSqlRepository {
    /** İkram (ya da ikramı geri al): yetki "ikram"; ikramda neden zorunlu */
    static async ikram(ctx, adisyonId, secim, g, kim) {
        yetki(kim, "ikram");
        const ikram = g.ikram !== false;
        let neden = null;
        if (ikram) {
            const n = nedenMetni(IKRAM_NEDENLERI, g.neden, g.aciklama);
            if ("hata" in n)
                throw ApiError.badRequest(n.hata);
            neden = n.metin;
        }
        await islem(ctx, async (tx) => {
            // Kısmi miktarlı ikram yeniden gönderilirse (cevap kayboldu / çift dokunuş) ikinci kez uygulanmaz
            if (await islemDahaOnceYapildiMi(tx, g.istekId, adisyonId, ikram ? "ikram" : "ikram-geri"))
                return;
            const a = await adisyonKilitle(tx, adisyonId);
            const kalemler = await kalemleriHazirla(tx, adisyonId, ikram ? secim : secim.map((s) => ({ kalemId: s.kalemId })), (k) => (k.IPTAL ? "iptal edilmiş." : ikram && k.IKRAM ? "zaten ikram." : !ikram && !k.IKRAM ? "ikram değil." : null));
            await new sql.Request(tx).input("I", sql.Bit, ikram ? 1 : 0).input("N", sql.NVarChar(200), neden).input("Y", sql.NVarChar(60), temiz(kim.ad).slice(0, 60))
                .query(`UPDATE dbo.TODVZ_ADISYON_KALEM SET IKRAM = @I, NEDEN = @N, ISLEM_YAPAN = @Y WHERE KALEM_ID IN (${kalemler.map((k) => k.id).join(",")})`);
            await odemeAsimiDenetle(tx, adisyonId, ctx);
            await surum(tx, adisyonId);
            await olayYaz(tx, ikram ? "ikram" : "ikram-geri", { adisyonId, masaId: a.masaId, veri: { kalem: kalemler.length } });
        });
        return AdisyonSqlRepository.getir(ctx, adisyonId);
    }
    /**
     * Kalem fiyatı değiştirme (karar K1, TA25): yetki "fiyat", neden zorunlu. Açık adisyonda ödenmemiş, iptal / ikram olmayan kalemin
     * birim fiyatı (KDV dahil) değişir; ilk fiyat, değiştiren ve neden saklanır. Bekleyen ara ödemeler yeni tutarı aşamaz.
     */
    static async fiyatDegistir(ctx, adisyonId, g, kim) {
        yetki(kim, "fiyat");
        const kalemId = Number(g.kalemId);
        if (!Number.isInteger(kalemId) || kalemId <= 0)
            throw ApiError.badRequest("Kalem seçilmeli.");
        const fiyat = Number(String(g.fiyat ?? "").replace(",", "."));
        if (!Number.isFinite(fiyat) || fiyat < 0 || fiyat > 9_999_999)
            throw ApiError.badRequest("Fiyat 0 ile 9.999.999 arasında olmalı.");
        if (Math.abs(Math.round(fiyat * 100) / 100 - fiyat) > 0.0000001)
            throw ApiError.badRequest("Fiyat en çok 2 ondalık olmalı.");
        const neden = temiz(g.neden).slice(0, 100);
        if (neden.length < 3)
            throw ApiError.badRequest("Fiyat değişikliğinin nedeni yazılmalı (en az 3 harf).");
        await islem(ctx, async (tx) => {
            const a = await adisyonKilitle(tx, adisyonId);
            const k = (await new sql.Request(tx).input("A", sql.Int, adisyonId).input("K", sql.Int, kalemId).query(`SELECT KALEM_ID, AD, BIRIM_FIYAT, IKRAM, IPTAL, FATURA_ID FROM dbo.TODVZ_ADISYON_KALEM WITH (UPDLOCK)
        WHERE KALEM_ID = @K AND ADISYON_ID = @A`)).recordset[0];
            if (!k)
                throw ApiError.badRequest("Kalem bu adisyonda değil (ekranı yenileyin).");
            if (k.IPTAL)
                throw ApiError.badRequest(`${temiz(k.AD)}: iptal edilmiş.`);
            if (k.FATURA_ID)
                throw ApiError.badRequest(`${temiz(k.AD)}: ödenmiş (fişe yazılmış); fiyatı değişmez.`);
            if (k.IKRAM)
                throw ApiError.badRequest(`${temiz(k.AD)}: ikram; önce ikram geri alınmalı.`);
            if (Math.abs(Number(k.BIRIM_FIYAT) - fiyat) < 0.00005)
                throw ApiError.badRequest("Fiyat zaten bu.");
            await new sql.Request(tx).input("K", sql.Int, kalemId).input("F", sql.Decimal(18, 4), fiyat).input("N", sql.NVarChar(100), neden).input("Y", sql.NVarChar(60), temiz(kim.ad).slice(0, 60))
                .query(`UPDATE dbo.TODVZ_ADISYON_KALEM SET ILK_FIYAT = ISNULL(ILK_FIYAT, BIRIM_FIYAT), BIRIM_FIYAT = @F, FIYAT_NEDEN = @N, FIYAT_DEGISTIREN = @Y WHERE KALEM_ID = @K`);
            await odemeAsimiDenetle(tx, adisyonId, ctx);
            await surum(tx, adisyonId);
            await olayYaz(tx, "fiyat", { adisyonId, masaId: a.masaId, veri: { kalemId, ad: temiz(k.AD), eski: Number(k.BIRIM_FIYAT), yeni: fiyat, yapan: temiz(kim.ad) } });
        });
        return AdisyonSqlRepository.getir(ctx, adisyonId);
    }
    /** Kalem iptali: yetki "iptal", neden zorunlu; mutfakta hazırlanan / hazır kalemde iptal fişi (yazıcılı yer) */
    static async iptal(ctx, adisyonId, secim, g, kim) {
        yetki(kim, "iptal");
        const n = nedenMetni(IPTAL_NEDENLERI, g.neden, g.aciklama);
        if ("hata" in n)
            throw ApiError.badRequest(n.hata);
        let kapandi = false, tekrar = false;
        await islem(ctx, async (tx) => {
            // "3 çaydan 1'ini iptal et" yeniden gönderilirse bir çay daha iptal edilmez (ikinci iptal fişi de basılmaz)
            if (await islemDahaOnceYapildiMi(tx, g.istekId, adisyonId, "iptal")) {
                tekrar = true;
                return;
            }
            const a = await adisyonKilitle(tx, adisyonId);
            const kalemler = await kalemleriHazirla(tx, adisyonId, secim, (k) => (k.IPTAL ? "zaten iptal." : null));
            await this.iptalUygula(tx, adisyonId, kalemler, n.metin, kim);
            await odemeAsimiDenetle(tx, adisyonId, ctx);
            await olayYaz(tx, "iptal", { adisyonId, masaId: a.masaId, veri: { kalem: kalemler.length } });
            // Kalem iptalinde adisyon açık kalır (masa yanlış açıldıysa adisyon iptali kullanılır); yalnız ürünlerin bir kısmı ödenmiş ve
            // ödenmemiş kalem kalmadıysa adisyon "ödendi" kapanır (D7)
            kapandi = await odendiyseKapat(tx, adisyonId, a.masaId);
        });
        const sonuc = await AdisyonSqlRepository.getir(ctx, adisyonId);
        return { ...sonuc, kapandi: tekrar ? ![ADISYON_DURUM.ACIK, ADISYON_DURUM.HESAP_ISTENDI].includes(sonuc.durum) : kapandi };
    }
    static async iptalUygula(tx, adisyonId, kalemler, neden, kim) {
        if (!kalemler.length)
            return;
        await new sql.Request(tx).input("N", sql.NVarChar(200), neden).input("Y", sql.NVarChar(60), temiz(kim.ad).slice(0, 60))
            .query(`UPDATE dbo.TODVZ_ADISYON_KALEM SET IPTAL = 1, NEDEN = @N, ISLEM_YAPAN = @Y WHERE KALEM_ID IN (${kalemler.map((k) => k.id).join(",")})`);
        // Mutfakta hazırlanan / hazır kalem: iptal fişi (yazıcılı yer) + KDS olayı (ekranlı yer; iptal kalem ekrandan düşer)
        const mutfakta = kalemler.filter((k) => k.yerId && (k.durum === 1 || k.durum === 2)).map((k) => k.id);
        if (mutfakta.length)
            await AdisyonMutfakSqlRepository.fisleriYaz(tx, adisyonId, mutfakta, MUTFAK_FIS_TUR.IPTAL);
        await surum(tx, adisyonId);
    }
    /** Adisyonun tamamını iptal (yanlış açılan masa): yetki "iptal"; bütün kalemler iptal, adisyon kapanır, masa boşalır */
    static async adisyonIptal(ctx, adisyonId, g, kim) {
        yetki(kim, "iptal");
        const n = nedenMetni(IPTAL_NEDENLERI, g.neden, g.aciklama);
        if ("hata" in n)
            throw ApiError.badRequest(n.hata);
        await islem(ctx, async (tx) => {
            const a = await adisyonKilitle(tx, adisyonId);
            const od = (await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_ODEME WHERE ADISYON_ID = @A AND FATURA_ID IS NULL) AS O,
        (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_FIS WHERE ADISYON_ID = @A) AS F`)).recordset[0];
            if (Number(od.O))
                throw ApiError.badRequest("Bu adisyonda alınmış ara ödeme var; adisyon iptalinden önce ödemeleri silin.");
            if (Number(od.F))
                throw ApiError.badRequest("Bu adisyonun ödenmiş ürünleri var (satış fişi yazıldı); kalan ürünleri kalem iptaliyle iptal edin.");
            const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT KALEM_ID, DURUM, YER_ID FROM dbo.TODVZ_ADISYON_KALEM WITH (UPDLOCK) WHERE ADISYON_ID = @A AND IPTAL = 0`);
            await this.iptalUygula(tx, adisyonId, r.recordset.map((k) => ({ id: Number(k.KALEM_ID), durum: Number(k.DURUM), yerId: k.YER_ID ?? null })), n.metin, kim);
            await new sql.Request(tx).input("A", sql.Int, adisyonId).input("AC", sql.NVarChar(250), `İptal: ${n.metin}`.slice(0, 250)).input("Y", sql.NVarChar(60), temiz(kim.ad).slice(0, 60))
                .query(`UPDATE dbo.TODVZ_ADISYON SET DURUM = 9, KAPANIS_ZAMANI = GETDATE(), ACIKLAMA = @AC, SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
            await olayYaz(tx, "kapandi", { adisyonId, masaId: a.masaId, veri: { iptal: true } });
        });
        return AdisyonSqlRepository.getir(ctx, adisyonId);
    }
    /** Masa taşıma: yetki "masa-tasi"; hedef masa etkin ve boş olmalı (masa kilidi altında) */
    static async masaTasi(ctx, adisyonId, hedefMasaId, kim) {
        yetki(kim, "masa-tasi");
        if (!Number.isInteger(Number(hedefMasaId)) || Number(hedefMasaId) <= 0)
            throw ApiError.badRequest("Hedef masa seçilmeli.");
        await islem(ctx, async (tx) => {
            await masalariSiraylaKilitle(tx, [await adisyonMasasi(tx, adisyonId), Number(hedefMasaId)]);
            const a = await adisyonKilitle(tx, adisyonId);
            if (a.tur !== ADISYON_TUR.MASA || !a.masaId)
                throw ApiError.badRequest("Yalnız masa adisyonu taşınır.");
            if (Number(a.masaId) === Number(hedefMasaId))
                throw ApiError.badRequest("Adisyon zaten bu masada.");
            const h = await masaKilidi(tx, Number(hedefMasaId));
            if (h.acikAdisyonId)
                throw ApiError.conflict(`Masa ${h.ad} dolu; dolu masaya "Birleştir" kullanın.`);
            await new sql.Request(tx).input("A", sql.Int, adisyonId).input("M", sql.Int, hedefMasaId).query(`UPDATE dbo.TODVZ_ADISYON SET MASA_ID = @M, SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
            await olayYaz(tx, "tasindi", { adisyonId, masaId: a.masaId, veri: { hedefMasaId: Number(hedefMasaId) } });
            await olayYaz(tx, "tasindi", { adisyonId, masaId: Number(hedefMasaId), veri: { kaynakMasaId: a.masaId } });
            await kdsBildir(tx, [adisyonId]);
        });
        return AdisyonSqlRepository.getir(ctx, adisyonId);
    }
    /** Birleştirme: kaynağın bütün kalemleri hedefe geçer, kaynak kapanır (BIRLESTIGI_ADISYON_ID); yetki "birlestir" */
    static async birlestir(ctx, kaynakId, hedefId, kim) {
        yetki(kim, "birlestir");
        if (Number(kaynakId) === Number(hedefId))
            throw ApiError.badRequest("Adisyon kendisiyle birleştirilemez.");
        await islem(ctx, async (tx) => {
            // Kilitlenme olmasın diye önce iki masa (kimlik sırasıyla), sonra iki adisyon kimlik sırasıyla kilitlenir
            await masalariSiraylaKilitle(tx, [await adisyonMasasi(tx, Number(kaynakId)), await adisyonMasasi(tx, Number(hedefId))]);
            const [ilk, ikinci] = [Number(kaynakId), Number(hedefId)].sort((x, y) => x - y);
            const x1 = await adisyonKilitle(tx, ilk), x2 = await adisyonKilitle(tx, ikinci);
            const k = ilk === Number(kaynakId) ? x1 : x2, h = ilk === Number(kaynakId) ? x2 : x1;
            if (k.tur !== ADISYON_TUR.MASA || h.tur !== ADISYON_TUR.MASA)
                throw ApiError.badRequest("Yalnız masa adisyonları birleştirilir.");
            // Kalemler, ara ödemeler ve (ürün seçerek ödenmiş) fiş bağları hedefe geçer; kaynak boş kabuk olarak kapanır
            await new sql.Request(tx).input("K", sql.Int, k.adisyonId).input("H", sql.Int, h.adisyonId).query(`UPDATE dbo.TODVZ_ADISYON_KALEM SET ADISYON_ID = @H WHERE ADISYON_ID = @K;
        UPDATE dbo.TODVZ_ADISYON_ODEME SET ADISYON_ID = @H WHERE ADISYON_ID = @K;
        UPDATE dbo.TODVZ_ADISYON_FIS SET ADISYON_ID = @H WHERE ADISYON_ID = @K;`);
            await odemeAsimiDenetle(tx, h.adisyonId, ctx);
            const nv = await new sql.Request(tx).input("H", sql.Int, h.adisyonId).query(`SELECT COUNT(DISTINCT VEZNE_ID) AS N FROM dbo.TODVZ_ADISYON_ODEME WHERE ADISYON_ID = @H AND FATURA_ID IS NULL AND ARAC = 0 AND VEZNE_ID IS NOT NULL`);
            if (Number(nv.recordset[0].N) > 1)
                throw ApiError.badRequest("İki adisyonun nakit ara ödemeleri farklı veznelerde alınmış; birleştirmeden önce birinin ara ödemesini silin.");
            const kisi = k.kisi === null && h.kisi === null ? null : (Number(k.kisi) || 0) + (Number(h.kisi) || 0);
            await new sql.Request(tx).input("H", sql.Int, h.adisyonId).input("KISI", sql.Int, kisi)
                .query(`UPDATE dbo.TODVZ_ADISYON SET KISI_SAYISI = @KISI, DURUM = 0, SURUM = SURUM + 1 WHERE ADISYON_ID = @H`);
            await new sql.Request(tx).input("K", sql.Int, k.adisyonId).input("H", sql.Int, h.adisyonId).input("AC", sql.NVarChar(250), `Birleştirildi: ${h.no}`)
                .query(`UPDATE dbo.TODVZ_ADISYON SET DURUM = 9, KAPANIS_ZAMANI = GETDATE(), BIRLESTIGI_ADISYON_ID = @H, ACIKLAMA = @AC, SURUM = SURUM + 1 WHERE ADISYON_ID = @K`);
            await olayYaz(tx, "birlesti", { adisyonId: k.adisyonId, masaId: k.masaId, veri: { hedefAdisyonId: h.adisyonId } });
            await olayYaz(tx, "birlesti", { adisyonId: h.adisyonId, masaId: h.masaId, veri: { kaynakAdisyonId: k.adisyonId } });
            await kdsBildir(tx, [h.adisyonId]);
        });
        return AdisyonSqlRepository.getir(ctx, Number(hedefId));
    }
    /**
     * Ürün taşıma / ayırma: seçilen kalemler (kısmi miktarla) başka masaya (açık adisyonuna; boşsa yeni adisyon açılır — "masa-ac"
     * da gerekir) ya da verilen açık adisyona geçer; yetki "masa-tasi". Kaynakta kalem kalmazsa kaynak kapanır.
     */
    static async urunTasi(ctx, adisyonId, secim, hedef, kim) {
        yetki(kim, "masa-tasi");
        if (!hedef?.masaId && !hedef?.adisyonId)
            throw ApiError.badRequest("Hedef masa seçilmeli.");
        const ayar = await AdisyonTanimSqlRepository.ayarlar(ctx);
        let hedefId = 0, kaynakKapandi = false, tekrar = false;
        await islem(ctx, async (tx) => {
            // Kısmi ürün taşıma yeniden gönderilirse ikinci kez taşınmaz: ilk taşımanın hedef adisyonu kayıttan okunur
            if (hedef.istekId !== undefined && hedef.istekId !== null && hedef.istekId !== "") {
                const once = await istekOku(tx, hedef.istekId);
                if (once) {
                    if (Number(once.adisyonId) !== Number(adisyonId) || once.tur !== "urun-tasi" || !(Number(once.hedefId) > 0))
                        throw ApiError.conflict("Bu istek kimliği başka bir işlemde kullanılmış; ekranı yenileyip yeniden deneyin.");
                    hedefId = Number(once.hedefId);
                    tekrar = true;
                    return;
                }
            }
            await masalariSiraylaKilitle(tx, [await adisyonMasasi(tx, adisyonId), hedef.adisyonId ? await adisyonMasasi(tx, Number(hedef.adisyonId)) : Number(hedef.masaId)]);
            if (hedef.adisyonId && Number(hedef.adisyonId) === adisyonId)
                throw ApiError.badRequest("Hedef aynı adisyon.");
            // E13 (26.11.2026 denetimi): iki adisyon kimlik sırasıyla kilitlenir — masasız iki paket adisyonu arasında A→B ve B→A aynı anda
            // gelirse masa kilidi yoktur; ters sırada satır kilidi kilitlenme (deadlock) veriyordu
            let a;
            if (hedef.adisyonId) {
                const hid = Number(hedef.adisyonId);
                let h;
                if (hid < adisyonId) {
                    h = await adisyonKilitle(tx, hid);
                    a = await adisyonKilitle(tx, adisyonId);
                }
                else {
                    a = await adisyonKilitle(tx, adisyonId);
                    h = await adisyonKilitle(tx, hid);
                }
                // P14: masadan paket / gel-al / tezgah adisyonuna taşıma yok — servis ücreti sessizce düşerdi (tersi serbest: müşteri masaya oturdu)
                if (a.tur === ADISYON_TUR.MASA && h.tur !== ADISYON_TUR.MASA)
                    throw ApiError.badRequest("Masadaki ürün paket / gel-al adisyonuna taşınmaz (servis ücreti düşerdi); masaya taşıyın.");
                hedefId = h.adisyonId;
            }
            else {
                a = await adisyonKilitle(tx, adisyonId);
                if (Number(hedef.masaId) === Number(a.masaId))
                    throw ApiError.badRequest("Hedef masa aynı masa.");
                const m = await masaKilidi(tx, Number(hedef.masaId));
                if (m.acikAdisyonId)
                    hedefId = (await adisyonKilitle(tx, Number(m.acikAdisyonId))).adisyonId;
                else {
                    yetki(kim, "masa-ac");
                    hedefId = await AdisyonSqlRepository.yeniAdisyon(tx, { tur: ADISYON_TUR.MASA, masaId: Number(hedef.masaId), kisi: null, servisOrani: ayar.servisAcik ? ayar.servisOrani : null, birimKodu: ayar.birimKodu }, kim);
                }
            }
            const kalemler = await kalemleriHazirla(tx, adisyonId, secim, (k) => (k.IPTAL ? "iptal edilmiş kalem taşınmaz." : null));
            await new sql.Request(tx).input("H", sql.Int, hedefId).query(`UPDATE dbo.TODVZ_ADISYON_KALEM SET ADISYON_ID = @H WHERE KALEM_ID IN (${kalemler.map((k) => k.id).join(",")})`);
            await new sql.Request(tx).input("H", sql.Int, hedefId).query(`UPDATE dbo.TODVZ_ADISYON SET DURUM = 0, SURUM = SURUM + 1 WHERE ADISYON_ID = @H`);
            await surum(tx, adisyonId);
            const hm = (await new sql.Request(tx).input("H", sql.Int, hedefId).query(`SELECT MASA_ID, RTRIM(ADISYON_NO) AS NO FROM dbo.TODVZ_ADISYON WHERE ADISYON_ID = @H`)).recordset[0];
            await odemeAsimiDenetle(tx, adisyonId, ctx);
            kaynakKapandi = await bosaldiysaKapat(tx, adisyonId, `Ürünleri taşındı: ${temiz(hm.NO)}`, a.masaId);
            await olayYaz(tx, "urun-tasindi", { adisyonId, masaId: a.masaId, veri: { hedefAdisyonId: hedefId, kalem: kalemler.length, kapandi: kaynakKapandi } });
            await olayYaz(tx, "urun-tasindi", { adisyonId: hedefId, masaId: hm.MASA_ID ?? null, veri: { kaynakAdisyonId: adisyonId } });
            await kdsBildir(tx, [hedefId]);
            if (hedef.istekId)
                await istekYaz(tx, hedef.istekId, { adisyonId, tur: "urun-tasi", hedefId });
        });
        const kaynak = await AdisyonSqlRepository.getir(ctx, adisyonId);
        return { kaynak, hedef: await AdisyonSqlRepository.getir(ctx, hedefId), kaynakKapandi: tekrar ? ![ADISYON_DURUM.ACIK, ADISYON_DURUM.HESAP_ISTENDI].includes(kaynak.durum) : kaynakKapandi };
    }
}

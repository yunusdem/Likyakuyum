import { noTemizle, noTuru } from "../utils/vknKontrol.js";
import { AdisyonMutfakSqlRepository } from "./adisyonMutfakSql.repository.js";
import { istekOku, istekYaz as istekKaydet } from "../services/adisyon/adisyonIstek.js";
import { stokIslemKilidi } from "./ticariStokSql.repository.js";
import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { AdisyonTanimSqlRepository } from "./adisyonTanimSql.repository.js";
import { AdisyonSqlRepository } from "./adisyonSql.repository.js";
import { TicariSatisSqlRepository } from "./ticariSatisSql.repository.js";
import { ADISYON_DURUM, YETKI_ADI, kismiMiktar } from "../services/adisyon/adisyonHesap.js";
import { GECERLI_KDV_ORANLARI, tartiBirimi, ticariFisHesapla } from "../services/ticari/ticariHesap.js";
import { olayTetikle, olayYaz } from "../services/adisyon/adisyonOlay.service.js";
import { PosService } from "../services/pos/pos.service.js";
import { TicariVardiyaSqlRepository } from "./ticariVardiyaSql.repository.js";
/**
 * Hesap ve tahsilat (docs/TICARI_ADISYON_YOL_HARITASI.md, TA21, TA29, TA34–TA38, D7):
 * - hesap iste: bilgi amaçlı hesap fişi, masa "hesap istendi";
 * - ara ödeme (eşit / tutar bölme): kişi kişi alınır, toplam kalana ulaşınca tek satış fişi + çoklu ödeme yazılır, adisyon kapanır;
 * - toplu tahsilat: kalanın tamamı (+ bekleyen ara ödemeler) tek fişle;
 * - ürün seçerek ödeme / fatura isteyen müşteri: seçilen kalemler (kısmi miktarla bölünerek) ayrı fiş.
 * Satış fişi Ticari satış fişidir (FIS_KAYNAGI 1; e-Belge kaynağı, vezne, stok, reçete porsiyonu) ve adisyonun işlemi içinde
 * yazılır: ödeme ya da fiş yarım kalmaz. İkram kalemi %100 iskontolu satırdır (stok düşer, tutar 0); servis ücreti ayrı satır.
 * Her tahsilat isteği tek kullanımlık istek kimliği taşır (çift tıklamada çift ödeme olmaz).
 */
const temiz = (v) => String(v ?? "").trim();
const y2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const havuz = (ctx) => AdisyonTanimSqlRepository.havuz(ctx);
export const ODEME_ARACI = { NAKIT: 0, CARI: 1, KART: 2, BANKA: 3 };
export const ODEME_ARACI_ADI = { 0: "Nakit", 1: "Cari (veresiye)", 2: "Kredi kartı", 3: "Havale / EFT" };
/**
 * Tahsilat veznesi (U37): PC'de kullanıcının kart veznesi (istekte gelen yok sayılır, denetleyici verir), yoksa Adisyon ayarındaki
 * tahsilat veznesi, o da yoksa ana vezne (1). Ticari vardiyası zorunluysa veznede açık vardiya şart (TA8; ara ödemede de).
 */
async function tahsilatVeznesi(ctx, istenen, ayar) {
    const v = Number(istenen) || Number(ayar?.vezneId) || 1;
    await TicariVardiyaSqlRepository.satisIcinDenetle(v, ctx);
    return v;
}
/**
 * Ödemelerin veritabanı denetimi ve tamamlanması (26.11.2026 denetimi):
 *  - Kart: POS hesabı seçilmemişse (garson telefonu, ara ödeme) Adisyon ayarındaki varsayılan, o da yoksa tanımlı tek POS hesabı
 *    yazılır. POS hesabı tanımlı firmada hesapsız kart ödemesi kabul edilmez: tutar hiçbir POS hesabına düşmüyordu (K4).
 *  - Cari: kart var olmalı (olmayan cariye veresiye yazılmaz).
 */
async function odemeleriTamamla(tx, odemeler, ayar) {
    if (!odemeler.length)
        return odemeler;
    if (odemeler.some((o) => o.arac === ODEME_ARACI.KART)) {
        const var_ = (await new sql.Request(tx).query(`SELECT OBJECT_ID('dbo.TODVZ_POS_CIHAZI', 'U') AS V`)).recordset[0]?.V != null;
        const cihazlar = var_ ? (await new sql.Request(tx).query(`SELECT POS_CIHAZI_ID FROM dbo.TODVZ_POS_CIHAZI`)).recordset.map((x) => Number(x.POS_CIHAZI_ID)) : [];
        for (const o of odemeler.filter((x) => x.arac === ODEME_ARACI.KART)) {
            if (o.posCihaziId) {
                if (!cihazlar.includes(o.posCihaziId))
                    throw ApiError.badRequest("Seçilen POS hesabı bulunamadı.");
                continue;
            }
            const varsayilan = Number(ayar?.posCihaziId) || null;
            if (varsayilan && cihazlar.includes(varsayilan))
                o.posCihaziId = varsayilan;
            else if (cihazlar.length === 1)
                o.posCihaziId = cihazlar[0];
            else if (cihazlar.length > 1)
                throw ApiError.badRequest("Kart ödemesi için POS hesabı seçilmeli (ya da Adisyon › Ayarlar'da varsayılan POS hesabı belirlenmeli).");
        }
    }
    const cariler = [...new Set(odemeler.filter((o) => o.arac === ODEME_ARACI.CARI).map((o) => Number(o.cariKartId)))];
    if (cariler.length) {
        const r = await new sql.Request(tx).query(`SELECT CARI_KART_ID FROM dbo.TODVZ_CARI_KART WHERE CARI_KART_ID IN (${cariler.join(",")})`);
        if (r.recordset.length !== cariler.length)
            throw ApiError.badRequest("Seçilen cari bulunamadı.");
    }
    return odemeler;
}
/**
 * Nakit tek veznede toplanır (karar K3): ara ödeme alındığı veznede kalır ve fiş o vezneye yazılır. Ticari fişinde vezne başlıkta
 * olduğundan bir adisyonun nakdi iki ayrı vezneye bölünemez; başka vezne bu adisyondan nakit alamaz (kart / havale alabilir).
 */
async function nakitVeznesiDenetle(tx, adisyonId, vezne) {
    const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).input("V", sql.Int, vezne).query(`SELECT TOP 1 O.VEZNE_ID, RTRIM(V.AD) AS AD FROM dbo.TODVZ_ADISYON_ODEME O
    LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID = O.VEZNE_ID WHERE O.ADISYON_ID = @A AND O.FATURA_ID IS NULL AND O.ARAC = 0 AND O.VEZNE_ID IS NOT NULL AND O.VEZNE_ID <> @V`);
    if (r.recordset.length)
        throw ApiError.badRequest(`Bu adisyonun nakit ara ödemesi "${temiz(r.recordset[0].AD) || `vezne ${r.recordset[0].VEZNE_ID}`}" veznesinde alındı; nakit tahsilat o kasadan yapılır (kart / havale buradan alınabilir).`);
}
const yetki = (kim, ...y) => { for (const x of y)
    if (!kim.yetkiler?.includes(x))
        throw ApiError.forbidden(`Bu işlem için "${YETKI_ADI[x]}" yetkisi gerekli.`); };
function odemeDenetle(o, i) {
    const tutar = y2(Number(String(o?.tutar ?? "").replace(",", ".")));
    if (!Number.isFinite(tutar) || tutar <= 0)
        throw ApiError.badRequest(`${i + 1}. ödeme: tutar 0'dan büyük olmalı.`);
    const arac = Number(o.arac);
    if (![0, 1, 2, 3].includes(arac))
        throw ApiError.badRequest(`${i + 1}. ödeme: ödeme türü geçersiz.`);
    if (arac === ODEME_ARACI.CARI && !Number(o.cariKartId))
        throw ApiError.badRequest(`${i + 1}. ödeme: cari seçilmeli.`);
    if (arac === ODEME_ARACI.BANKA && !Number(o.cariKartId))
        throw ApiError.badRequest(`${i + 1}. ödeme: banka hesabı seçilmeli.`);
    return { tutar, arac, posCihaziId: arac === 2 ? Number(o.posCihaziId) || null : null, cariKartId: arac === 1 || arac === 3 ? Number(o.cariKartId) : null,
        aciklama: temiz(o.aciklama).slice(0, 100) || null, posIslemId: arac === 2 ? Number(o.posIslemId) || null : null };
}
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
/** İstek kimliği: işlendiyse önceki sonuç (adisyonId) */
async function istekOnce(tx, istekId, adisyonId, tur) {
    const s = await istekOku(tx, istekId);
    if (!s)
        return null;
    // Kimlik yalnız aynı işlemin yeniden gönderimi için geçerli; başka adisyonda / başka işlemde kullanılmışsa sessizce "oldu" dönmez
    if (Number(s.adisyonId) !== Number(adisyonId) || s.tur !== tur)
        throw ApiError.conflict("Bu istek kimliği başka bir işlemde kullanılmış; ekranı yenileyip yeniden deneyin.");
    // Yanıtı kaybolan isteğin tekrarı: fiş kimliği / numarası geri verilir (ön yüz kart tahsilatını ve fiş baskısını buna göre sürdürür)
    return { faturaId: Number(s.faturaId) || null, faturaNo: s.faturaNo ? String(s.faturaNo) : null };
}
const istekYaz = (tx, istekId, adisyonId, tur, fis) => istekKaydet(tx, istekId, { adisyonId, tur, faturaId: fis?.faturaId ?? null, faturaNo: fis?.faturaNo ?? null });
/** Açık adisyonu kilitler; durum, servis oranı, masa */
async function kilitle(tx, adisyonId) {
    const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT A.ADISYON_ID, RTRIM(A.ADISYON_NO) AS NO, A.DURUM, A.MASA_ID, A.SERVIS_ORANI, RTRIM(M.AD) AS MASA
    FROM dbo.TODVZ_ADISYON A WITH (UPDLOCK, ROWLOCK) LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID WHERE A.ADISYON_ID = @A`);
    const a = r.recordset[0];
    if (!a)
        throw ApiError.notFound("Adisyon bulunamadı.");
    if (![ADISYON_DURUM.ACIK, ADISYON_DURUM.HESAP_ISTENDI].includes(a.DURUM))
        throw ApiError.conflict(`Adisyon ${temiz(a.NO)} kapanmış (ekranı yenileyin).`);
    return { adisyonId: Number(a.ADISYON_ID), no: temiz(a.NO), durum: Number(a.DURUM), masaId: a.MASA_ID ?? null, masa: a.MASA ? temiz(a.MASA) : null, servisOrani: a.SERVIS_ORANI === null ? null : Number(a.SERVIS_ORANI) };
}
/** Servis satırının KDV'si: Adisyon ayarındaki masa KDV varsayılanı (geçerliyse), yoksa %10 */
const servisKdvi = (ayar) => (GECERLI_KDV_ORANLARI.includes(Number(ayar?.kdvVarsayilan)) ? Number(ayar.kdvVarsayilan) : 10);
/**
 * Ödenecek tutar = satış fişinin tutarı (U37): fiş, KDV dahil fiyattan matrah ve KDV'yi e-Belge kuralıyla ayırır (KDV yuvarlanmış
 * matrahtan); bu, nadiren satır toplamını 1 kuruş kaydırır. Tahsilat her zaman fişle birebir olsun diye ödenecek tutar Ticari'nin
 * aynı hesabıyla bulunur (ikram %100 iskontolu, servis ayrı satır).
 */
function fisToplami(kalemler, servis, servisKdv, baslik) {
    if (!kalemler.length && !(servis > 0))
        return 0;
    const satirlar = kalemler.map((k) => ({ miktar: k.miktar, kdvDahilFiyat: k.birimFiyat, kdvOrani: k.kdv, iskontoTuru: (k.ikram ? 1 : 0), iskontoDegeri: k.ikram ? 100 : 0 }));
    if (servis > 0)
        satirlar.push({ miktar: 1, kdvDahilFiyat: servis, kdvOrani: servisKdv, iskontoTuru: 0, iskontoDegeri: 0 });
    return ticariFisHesapla(satirlar, baslik && baslik.turu ? { turu: baslik.turu, deger: baslik.deger } : null).genelToplam;
}
/**
 * Adisyon indirimi (karar K1, TA25): tür 1 yüzde, 2 tutar; hesabın tamamına (ürünler + servis) fiş iskontosu olarak uygulanır.
 * Tutar indirimi brüt tutarı aşamaz. Kısmi fişte (ürün seçerek ödeme) yüzde aynen, tutar brüt payı oranında uygulanır; son fiş
 * kalan indirimi alır — fişlerin indirim toplamı adisyon indirimine eşit olur.
 */
function indirimBasligi(turu, deger, brut, tumBrut = brut, sonFis = true) {
    const t = Number(turu) || 0, d = Number(deger) || 0;
    if (!t || !(d > 0) || !(brut > 0))
        return null;
    if (t === 1)
        return { turu: 1, deger: Math.min(100, d) };
    const pay = sonFis ? d : y2((d * brut) / (tumBrut > 0 ? tumBrut : brut));
    return { turu: 2, deger: Math.min(brut, y2(pay)) };
}
/**
 * Fatura isteyen müşteri (P9, 26.11.2026 denetimi): numara yazıldıysa VKN (10) / TCKN (11) kontrol hanesi tutmalı ve unvan
 * zorunlu; yanlış numarayla kesilen e-Belge GİB'de reddedilir ya da başkasının adına düşer. Boş / 11111111111 nihai tüketicidir.
 */
export function musteriDenetle(musteri) {
    const m = { ...(musteri || {}) };
    const no = noTemizle(temiz(m.vknTckn));
    if (!no || no === "11111111111")
        return { ...m, vknTckn: no || null };
    if (!noTuru(no))
        throw ApiError.badRequest(no.length === 10 || no.length === 11
            ? `Vergi / TC kimlik numarası hatalı (${no}): kontrol hanesi tutmuyor.` : "Vergi numarası 10, TC kimlik numarası 11 hane olmalı.");
    if (!temiz(m.unvan))
        throw ApiError.badRequest("Fatura için müşteri unvanı / adı soyadı yazılmalı.");
    return { ...m, vknTckn: no };
}
/**
 * Ara ödemede cihazdan çekilen kart (TA37, 26.11.2026): POS işlemi onaylı, tutarı ödemeyle aynı, hiçbir belgeye ve başka bir adisyon
 * ödemesine bağlı olmamalı (başka fişin ya da başka masanın çekimi bu ödemeye yazılamasın). Satır kilitlenir: aynı işlem iki ödemeye
 * aynı anda bağlanamaz. Dönüş: işlemin POS kartı (cihazdan dönen banka), yoksa seçilen.
 */
async function araPosIslemi(tx, posIslemId, tutar, posCihaziId) {
    const r = await new sql.Request(tx).input("P", sql.Int, posIslemId).query(`IF OBJECT_ID('dbo.TODVZ_POS_ISLEM', 'U') IS NULL SELECT CAST(NULL AS int) AS ID
    ELSE SELECT I.POS_ISLEM_ID AS ID, I.DURUM, I.TUTAR, I.BELGE_ID, RTRIM(I.BELGE_TURU) AS BELGE_TURU, I.POS_CIHAZI_ID,
      (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_ODEME O WHERE O.POS_ISLEM_ID = I.POS_ISLEM_ID) AS KULLANILDI
    FROM dbo.TODVZ_POS_ISLEM I WITH (UPDLOCK, ROWLOCK) WHERE I.POS_ISLEM_ID = @P`);
    const x = r.recordset[0];
    if (!x || !x.ID)
        throw ApiError.badRequest("POS işlemi bulunamadı.");
    if (temiz(x.DURUM) !== "ONAY")
        throw ApiError.badRequest("POS işlemi onaylanmamış; ara ödeme kartla alınamadı.");
    if (x.BELGE_ID)
        throw ApiError.badRequest("Bu POS işlemi başka bir fişe bağlı.");
    if (Number(x.KULLANILDI) > 0)
        throw ApiError.conflict("Bu POS işlemi başka bir ara ödemeye bağlı.");
    if (Math.abs(Number(x.TUTAR) - tutar) > 0.005)
        throw ApiError.badRequest(`POS işleminin tutarı (${Number(x.TUTAR).toFixed(2)}) ara ödemeyle (${tutar.toFixed(2)}) aynı değil.`);
    return x.POS_CIHAZI_ID ?? posCihaziId;
}
/** Fişlenmemiş kalemler, bekleyen ara ödemeler ve kalan (işlem içinde) */
async function durumOku(tx, adisyonId, servisOrani, servisKdv) {
    const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`
    SELECT KALEM_ID, STOK_KART_ID, AD, MIKTAR, RTRIM(BIRIM) AS BIRIM, PORSIYON_AD, PORSIYON_CARPAN, BIRIM_FIYAT, KDV_ORANI, IKRAM FROM dbo.TODVZ_ADISYON_KALEM
      WHERE ADISYON_ID = @A AND IPTAL = 0 AND FATURA_ID IS NULL ORDER BY KALEM_ID;
    SELECT ODEME_ID, TUTAR, ARAC, POS_CIHAZI_ID, CARI_KART_ID, POS_ISLEM_ID, ACIKLAMA, EKLEYEN_AD, ZAMAN, VEZNE_ID FROM dbo.TODVZ_ADISYON_ODEME WHERE ADISYON_ID = @A AND FATURA_ID IS NULL ORDER BY ODEME_ID;
    SELECT INDIRIM_TURU, INDIRIM_DEGERI, INDIRIM_NEDEN, INDIRIM_YAPAN FROM dbo.TODVZ_ADISYON WHERE ADISYON_ID = @A;
    SELECT FATURA_ID, MIKTAR, BIRIM_FIYAT FROM dbo.TODVZ_ADISYON_KALEM WHERE ADISYON_ID = @A AND IPTAL = 0 AND IKRAM = 0 AND FATURA_ID IS NOT NULL;`);
    const rs = r.recordsets;
    const kalemler = rs[0].map((k) => ({ kalemId: Number(k.KALEM_ID), stokKartId: k.STOK_KART_ID ?? null, ad: temiz(k.AD), miktar: Number(k.MIKTAR), birim: temiz(k.BIRIM), porsiyonAd: k.PORSIYON_AD ? temiz(k.PORSIYON_AD) : null,
        carpan: Number(k.PORSIYON_CARPAN) || 1, birimFiyat: Number(k.BIRIM_FIYAT), kdv: Number(k.KDV_ORANI), ikram: !!k.IKRAM }));
    const ara = y2(kalemler.filter((k) => !k.ikram).reduce((t, k) => t + y2(k.miktar * k.birimFiyat), 0));
    const servis = kalanServis(ara, rs[3] || [], servisOrani);
    const odemeler = rs[1].map((o) => ({ odemeId: Number(o.ODEME_ID), tutar: Number(o.TUTAR), arac: Number(o.ARAC), posCihaziId: o.POS_CIHAZI_ID ?? null, cariKartId: o.CARI_KART_ID ?? null,
        posIslemId: o.POS_ISLEM_ID ?? null, aciklama: o.ACIKLAMA ? temiz(o.ACIKLAMA) : null, ekleyen: o.EKLEYEN_AD ? temiz(o.EKLEYEN_AD) : null, vezneId: o.VEZNE_ID ?? null }));
    const odenen = y2(odemeler.reduce((t, o) => t + o.tutar, 0));
    const brut = fisToplami(kalemler, servis, servisKdv);
    const ind = rs[2][0] || {};
    const baslik = indirimBasligi(ind.INDIRIM_TURU ?? null, ind.INDIRIM_DEGERI === null || ind.INDIRIM_DEGERI === undefined ? null : Number(ind.INDIRIM_DEGERI), brut);
    const toplam = baslik ? fisToplami(kalemler, servis, servisKdv, baslik) : brut;
    // Gösterilen indirim, verilen indirimin kendisidir (50 TL / %10'un karşılığı); fiş hesabının kuruş yuvarlaması ayrı gösterilir
    const indirimTutari = !baslik ? 0 : baslik.turu === 2 ? y2(baslik.deger) : y2(((ara + servis) * baslik.deger) / 100);
    return { kalemler, ara, servis, servisKdv, brut, baslik, indirim: indirimTutari, indirimTuru: baslik ? baslik.turu : 0, indirimDegeri: baslik ? Number(ind.INDIRIM_DEGERI) : 0,
        indirimNeden: baslik && ind.INDIRIM_NEDEN ? temiz(ind.INDIRIM_NEDEN) : null, indirimYapan: baslik && ind.INDIRIM_YAPAN ? temiz(ind.INDIRIM_YAPAN) : null,
        toplam, yuvarlama: y2(toplam - ara - servis + indirimTutari), odemeler, odenen, kalan: y2(toplam - odenen) };
}
/**
 * Kalan kalemlerin servisi (P5, 26.11.2026 denetimi): ürün seçerek ödenmiş fişlerin her biri servisi kendi tutarından yuvarlar;
 * parçaların toplamı adisyonun servisinden 1-2 kuruş sapabilir (3 x 3,33 TL %10: 0,33 x 3 = 0,99, bütün 1,00). Kalan kısım
 * "adisyonun bütün servisi − önceki fişlerde kesilen servis" olarak alınır; böylece fişlerin toplamı müşteriye söylenen hesaba eşit olur.
 */
function kalanServis(ara, fislenmis, servisOrani) {
    if (!servisOrani || servisOrani <= 0)
        return 0;
    const yalin = y2((ara * servisOrani) / 100);
    if (!fislenmis.length)
        return yalin;
    const fisAra = new Map();
    for (const k of fislenmis)
        fisAra.set(Number(k.FATURA_ID), y2((fisAra.get(Number(k.FATURA_ID)) || 0) + y2(Number(k.MIKTAR) * Number(k.BIRIM_FIYAT))));
    let onceki = 0, tumAra = ara;
    for (const a of fisAra.values()) {
        onceki = y2(onceki + y2((a * servisOrani) / 100));
        tumAra = y2(tumAra + a);
    }
    const fark = y2(y2((tumAra * servisOrani) / 100) - onceki);
    // Yalnız kuruş düzeltmesi: oran sonradan değiştiyse ya da fark büyükse yalın hesap kalır
    return Math.abs(fark - yalin) <= 0.01 * fisAra.size + 0.001 ? Math.max(0, fark) : yalin;
}
/** Seçilen kalemlerin fişi (ürün seçerek ödeme): oransal servis + indirim payı + fiş toplamı */
function secimHesabi(d, secilen, servisOrani, servisKdv) {
    const ara = y2(secilen.filter((k) => !k.ikram).reduce((t, k) => t + y2(k.miktar * k.birimFiyat), 0));
    // Fişlenmemiş bütün kalemler seçildiyse bu son fiştir: kalan indirimin tamamı, servis kuruş düzeltmeli kalan (P5)
    const hepsi = secilen.length === d.kalemler.length && secilen.every((k) => { const o = d.kalemler.find((x) => x.kalemId === k.kalemId); return !!o && Math.abs(o.miktar - k.miktar) < 0.00005; });
    const servis = hepsi ? d.servis : servisOrani && servisOrani > 0 ? y2((ara * servisOrani) / 100) : 0;
    const brut = fisToplami(secilen, servis, servisKdv);
    const baslik = d.indirimTuru ? indirimBasligi(d.indirimTuru, d.indirimDegeri, brut, d.brut, hepsi) : null;
    return { servis, baslik, brut, toplam: baslik ? fisToplami(secilen, servis, servisKdv, baslik) : brut };
}
/**
 * Masa işlemlerinden (ikram, iptal, ürün taşıma, birleştirme) sonra: bekleyen ara ödemeler yeni ödenecek tutarı aşamaz
 * (ör. 4 kişiden 2'si ödedikten sonra ürün iptali). Aşarsa işlem geri alınır; önce ara ödeme silinmeli.
 */
export async function odemeAsimiDenetle(tx, adisyonId, ctx) {
    const a = (await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT SERVIS_ORANI FROM dbo.TODVZ_ADISYON WHERE ADISYON_ID = @A`)).recordset[0];
    if (!a)
        return;
    const d = await durumOku(tx, adisyonId, a.SERVIS_ORANI === null ? null : Number(a.SERVIS_ORANI), servisKdvi(await AdisyonTanimSqlRepository.ayarlar(ctx, tx)));
    if (d.odenen - d.toplam > 0.005)
        throw ApiError.badRequest(`Alınan ara ödemeler (${d.odenen.toFixed(2)}) işlemden sonraki ödenecek tutarı (${d.toplam.toFixed(2)}) aşıyor; önce ara ödemeyi silin.`);
}
/** Ödenmemiş (fişsiz, iptal dışı) kalem ve bekleyen ödeme kalmadıysa ve fiş yazılmışsa adisyon "ödendi" kapanır */
export async function odendiyseKapat(tx, adisyonId, masaId) {
    const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT
    (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_KALEM WHERE ADISYON_ID = @A AND IPTAL = 0 AND FATURA_ID IS NULL) AS KALEM,
    (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_ODEME WHERE ADISYON_ID = @A AND FATURA_ID IS NULL) AS ODEME,
    (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_FIS WHERE ADISYON_ID = @A) AS FIS`);
    const x = r.recordset[0];
    if (Number(x.KALEM) || Number(x.ODEME) || !Number(x.FIS))
        return false;
    await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`UPDATE dbo.TODVZ_ADISYON SET DURUM = 2, KAPANIS_ZAMANI = GETDATE(), SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
    await olayYaz(tx, "kapandi", { adisyonId, masaId, veri: { odendi: true } });
    return true;
}
export class AdisyonHesapSqlRepository {
    /** Hesap durumu: fişlenmemiş tutar, servis, bekleyen ödemeler, kalan; yazılmış fişler */
    static async hesap(ctx, adisyonId) {
        const pool = await havuz(ctx);
        const a = (await pool.request().input("A", sql.Int, adisyonId).query(`SELECT SERVIS_ORANI FROM dbo.TODVZ_ADISYON WHERE ADISYON_ID = @A`)).recordset[0];
        if (!a)
            throw ApiError.notFound("Adisyon bulunamadı.");
        const d = await durumOku(pool, adisyonId, a.SERVIS_ORANI === null ? null : Number(a.SERVIS_ORANI), servisKdvi(await AdisyonTanimSqlRepository.ayarlar(ctx, pool)));
        const fisler = (await pool.request().input("A", sql.Int, adisyonId).query(`SELECT F.FATURA_ID, RTRIM(F.FATURA_NO) AS NO, F.ETTN, F.GENEL_TOPLAM, F.TARIH FROM dbo.TODVZ_ADISYON_FIS AF
      JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID = AF.FATURA_ID WHERE AF.ADISYON_ID = @A ORDER BY F.FATURA_ID`)).recordset
            .map((f) => ({ faturaId: Number(f.FATURA_ID), faturaNo: temiz(f.NO), ettn: String(f.ETTN || "").toLowerCase(), toplam: Number(f.GENEL_TOPLAM) }));
        // Y8: silinen ara ödemeler (iz) — ödeme penceresinde gösterilir
        const silinenOdemeler = (await pool.request().input("A", sql.Int, adisyonId).query(`SELECT TOP 20 TUTAR, ARAC, EKLEYEN_AD, SILEN_AD, SILME_ZAMANI FROM dbo.TODVZ_ADISYON_ODEME_SILINEN
      WHERE ADISYON_ID = @A ORDER BY SILME_ZAMANI DESC, ODEME_ID DESC`).catch(() => ({ recordset: [] }))).recordset
            .map((o) => ({ tutar: Number(o.TUTAR), arac: Number(o.ARAC), ekleyen: o.EKLEYEN_AD ? temiz(o.EKLEYEN_AD) : null, silen: o.SILEN_AD ? temiz(o.SILEN_AD) : null, zaman: o.SILME_ZAMANI }));
        return { ...d, kalemler: undefined, baslik: undefined, kalemSayisi: d.kalemler.length, fisler, silinenOdemeler };
    }
    /**
     * İndirimli açık adisyonların ödenecek kalanı (masa kutusu, rapor, gün sonu): indirim fiş iskontosu olarak satırlara dağıtılınca
     * KDV yuvarlaması 1 kuruş fark verebilir; kutu "200" derken ödeme ekranı "200,01" istemesin diye kalan fiş hesabıyla bulunur.
     * Yalnız indirimli adisyonlar için çağrılır (az sayıda); en çok 100 adisyon, sırayla.
     */
    static async indirimliKalanlar(ctx, idler) {
        const sonuc = new Map();
        if (!idler.length)
            return sonuc;
        const pool = await havuz(ctx);
        const kdv = servisKdvi(await AdisyonTanimSqlRepository.ayarlar(ctx, pool));
        for (const id of idler.slice(0, 100)) {
            try {
                const a = (await pool.request().input("A", sql.Int, id).query(`SELECT SERVIS_ORANI FROM dbo.TODVZ_ADISYON WHERE ADISYON_ID = @A`)).recordset[0];
                if (!a)
                    continue;
                sonuc.set(id, Math.max(0, (await durumOku(pool, id, a.SERVIS_ORANI === null ? null : Number(a.SERVIS_ORANI), kdv)).kalan));
            }
            catch { /* okunamayan adisyon yaklaşık tutarla kalır */ }
        }
        return sonuc;
    }
    /**
     * Seçilen ürünlerin ödenecek tutarı (yalnız okuma): ürün seçerek ödemede ekran, indirimli adisyonda tutarı sunucudan alır
     * (indirim payı ve kuruş yuvarlaması fişle birebir olsun).
     */
    static async secimTutari(ctx, adisyonId, secim) {
        const pool = await havuz(ctx);
        const a = (await pool.request().input("A", sql.Int, adisyonId).query(`SELECT SERVIS_ORANI FROM dbo.TODVZ_ADISYON WHERE ADISYON_ID = @A`)).recordset[0];
        if (!a)
            throw ApiError.notFound("Adisyon bulunamadı.");
        const servisOrani = a.SERVIS_ORANI === null ? null : Number(a.SERVIS_ORANI);
        const kdv = servisKdvi(await AdisyonTanimSqlRepository.ayarlar(ctx, pool));
        const d = await durumOku(pool, adisyonId, servisOrani, kdv);
        const secilen = [];
        for (const s of (Array.isArray(secim) ? secim : []).slice(0, 300)) {
            const k = d.kalemler.find((x) => x.kalemId === Number(s?.kalemId));
            if (!k)
                continue;
            const km = kismiMiktar(k.miktar, s.miktar, !!tartiBirimi(k.birim));
            if ("hata" in km)
                throw ApiError.badRequest(`${k.ad}: ${km.hata}`);
            secilen.push({ ...k, miktar: km.tamami ? k.miktar : km.miktar });
        }
        if (!secilen.length)
            return { toplam: 0, servis: 0, indirim: 0 };
        const h = secimHesabi(d, secilen, servisOrani, kdv);
        return { toplam: h.toplam, servis: h.servis, indirim: y2(h.brut - h.toplam) };
    }
    /**
     * Adisyon indirimi (karar K1, TA25): yetki "indirim", neden zorunlu. Tür 1 yüzde (0–100], 2 tutar (brütü aşamaz), 0 kaldır.
     * İndirim fişe fiş iskontosu olarak yansır. Bekleyen ara ödemeler indirimli tutarı aşamaz.
     */
    static async indirim(ctx, adisyonId, g, kim) {
        yetki(kim, "indirim");
        const tur = Number(g.tur) || 0;
        if (![0, 1, 2].includes(tur))
            throw ApiError.badRequest("İndirim türü geçersiz.");
        const deger = tur ? Number(String(g.deger ?? "").replace(",", ".")) : 0;
        const neden = temiz(g.neden).slice(0, 100);
        if (tur) {
            if (!Number.isFinite(deger) || !(deger > 0))
                throw ApiError.badRequest("İndirim 0'dan büyük olmalı.");
            if (tur === 1 && deger > 100)
                throw ApiError.badRequest("İndirim yüzdesi 100'ü geçemez.");
            if (Math.round(deger * 100) !== Math.round(deger * 10000) / 100)
                throw ApiError.badRequest("İndirim en çok 2 ondalık olmalı.");
            if (neden.length < 3)
                throw ApiError.badRequest("İndirim nedeni yazılmalı (en az 3 harf).");
        }
        const ayar = await AdisyonTanimSqlRepository.ayarlar(ctx);
        await islem(ctx, async (tx) => {
            const a = await kilitle(tx, adisyonId);
            if (tur === 2) {
                // Tutar indirimi, indirimsiz brüt tutarı aşamaz
                await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`UPDATE dbo.TODVZ_ADISYON SET INDIRIM_TURU = NULL, INDIRIM_DEGERI = NULL WHERE ADISYON_ID = @A`);
                const d0 = await durumOku(tx, adisyonId, a.servisOrani, servisKdvi(ayar));
                if (!(d0.brut > 0))
                    throw ApiError.badRequest("Adisyonda indirim yapılacak tutar yok.");
                if (deger - d0.brut > 0.005)
                    throw ApiError.badRequest(`İndirim hesabı (${d0.brut.toFixed(2)}) aşamaz.`);
            }
            await new sql.Request(tx).input("A", sql.Int, adisyonId).input("T", sql.TinyInt, tur || null).input("D", sql.Decimal(18, 4), tur ? deger : null)
                .input("N", sql.NVarChar(100), tur ? neden : null).input("Y", sql.NVarChar(60), tur ? temiz(kim.ad).slice(0, 60) : null)
                .query(`UPDATE dbo.TODVZ_ADISYON SET INDIRIM_TURU = @T, INDIRIM_DEGERI = @D, INDIRIM_NEDEN = @N, INDIRIM_YAPAN = @Y, SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
            await odemeAsimiDenetle(tx, adisyonId, ctx);
            await olayYaz(tx, tur ? "indirim" : "indirim-kalkti", { adisyonId, masaId: a.masaId, veri: { tur, deger, yapan: temiz(kim.ad) } });
        });
        return { ...(await AdisyonSqlRepository.getir(ctx, adisyonId)), hesap: await this.hesap(ctx, adisyonId) };
    }
    /**
     * Kapanmış adisyonu yeniden açma (karar K1, TA25): yetki "duzelt", neden zorunlu. Adisyonun bütün satış fişleri geri alınır
     * (stok ve vezne etkisiyle; e-Belge'ye iletilmiş ya da iadesi olan fiş varsa açılamaz), kalemler yeniden "ödenmemiş" olur,
     * alınmış ödemeler bekleyen ara ödeme olarak kalır (para iade edildiyse ara ödeme silinir). Masa adisyonunda masa boş olmalı.
     */
    static async yenidenAc(ctx, adisyonId, g, kim) {
        yetki(kim, "duzelt");
        const neden = temiz(g?.neden).slice(0, 100);
        if (neden.length < 3)
            throw ApiError.badRequest("Yeniden açma nedeni yazılmalı (en az 3 harf).");
        await islem(ctx, async (tx) => {
            const on = (await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT MASA_ID FROM dbo.TODVZ_ADISYON WHERE ADISYON_ID = @A`)).recordset[0];
            if (!on)
                throw ApiError.notFound("Adisyon bulunamadı.");
            // Kilit sırası: masa kilidi → adisyon satırı → stok kilidi (öbür yollarla aynı)
            if (on.MASA_ID) {
                const kl = await new sql.Request(tx).input("K", sql.NVarChar(255), `LIKYA_ADISYON_MASA_${Number(on.MASA_ID)}`).query(`DECLARE @r INT;
          EXEC @r = sp_getapplock @Resource = @K, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; SELECT @r AS R;`);
                if (Number(kl.recordset[0].R) < 0)
                    throw ApiError.conflict("Masa başka bir cihazda işlemde; biraz sonra tekrar deneyin.");
            }
            const a = (await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT A.ADISYON_ID, RTRIM(A.ADISYON_NO) AS NO, A.DURUM, A.MASA_ID, A.TUR, A.INDIRIM_TURU, RTRIM(M.AD) AS MASA, M.AKTIF AS MAKTIF
        FROM dbo.TODVZ_ADISYON A WITH (UPDLOCK, ROWLOCK) LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID WHERE A.ADISYON_ID = @A`)).recordset[0];
            if (Number(a.DURUM) !== ADISYON_DURUM.KAPANDI)
                throw ApiError.conflict(Number(a.DURUM) === 9 ? "İptal edilmiş adisyon yeniden açılamaz." : "Adisyon zaten açık.");
            if (a.MASA_ID) {
                if (a.MAKTIF === false || a.MAKTIF === 0)
                    throw ApiError.badRequest("Adisyonun masası pasif; yeniden açılamaz.");
                const dolu = await new sql.Request(tx).input("M", sql.Int, a.MASA_ID).query(`SELECT TOP 1 RTRIM(ADISYON_NO) AS NO FROM dbo.TODVZ_ADISYON WHERE MASA_ID = @M AND DURUM IN (0, 1)`);
                if (dolu.recordset.length)
                    throw ApiError.conflict(`Masa ${temiz(a.MASA)} şu an dolu (${temiz(dolu.recordset[0].NO)}); önce o adisyon kapatılmalı ya da taşınmalı.`);
            }
            const fisler = (await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT FATURA_ID FROM dbo.TODVZ_ADISYON_FIS WHERE ADISYON_ID = @A ORDER BY FATURA_ID`)).recordset.map((x) => Number(x.FATURA_ID));
            if (!fisler.length)
                throw ApiError.badRequest("Adisyonun satış fişi yok; yeniden açılacak bir şey bulunamadı.");
            await stokIslemKilidi(tx);
            // Bağlar önce çözülür (fiş silinirken kalem / ödeme bağı boşta kalmasın), sonra fişler geri alınır
            await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`UPDATE dbo.TODVZ_ADISYON_KALEM SET FATURA_ID = NULL, FATURA_SATIR_NO = NULL WHERE ADISYON_ID = @A AND FATURA_ID IS NOT NULL;
        UPDATE dbo.TODVZ_ADISYON_ODEME SET FATURA_ID = NULL WHERE ADISYON_ID = @A AND FATURA_ID IS NOT NULL;
        DELETE FROM dbo.TODVZ_ADISYON_FIS WHERE ADISYON_ID = @A;`);
            for (const f of fisler)
                await TicariSatisSqlRepository.silIslemde(tx, f, ctx);
            await new sql.Request(tx).input("A", sql.Int, adisyonId).input("Y", sql.NVarChar(60), temiz(kim.ad).slice(0, 60)).input("N", sql.NVarChar(100), neden)
                .query(`UPDATE dbo.TODVZ_ADISYON SET DURUM = 0, KAPANIS_ZAMANI = NULL, HESAP_ISTEME_ZAMANI = NULL, MISAFIR_PIN = NULL /* M3: eski misafir PIN'i yeniden açılan adisyonda çalışmaz */, SURUM = SURUM + 1, YENIDEN_ACILDI = YENIDEN_ACILDI + 1, YENIDEN_ACAN = @Y, YENIDEN_NEDEN = @N,
          INDIRIM_DEGERI = CASE WHEN INDIRIM_TURU = 2 THEN ISNULL(INDIRIM_DEGERI, 0) + INDIRIM_UYGULANAN ELSE INDIRIM_DEGERI END, INDIRIM_UYGULANAN = 0,
          PAKET_DURUM = CASE WHEN TUR <> 1 AND PAKET_DURUM = 3 THEN 1 ELSE PAKET_DURUM END WHERE ADISYON_ID = @A`);
            await olayYaz(tx, "yeniden-acildi", { adisyonId, masaId: a.MASA_ID ?? null, veri: { no: temiz(a.NO), yapan: temiz(kim.ad), neden, fis: fisler.length } });
        });
        return { ...(await AdisyonSqlRepository.getir(ctx, adisyonId)), hesap: await this.hesap(ctx, adisyonId) };
    }
    /** Hesap iste (TA34): masa "hesap istendi"; yetki "hesap-iste" */
    static async hesapIste(ctx, adisyonId, kim) {
        yetki(kim, "hesap-iste");
        await islem(ctx, async (tx) => {
            const a = await kilitle(tx, adisyonId);
            await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`UPDATE dbo.TODVZ_ADISYON SET DURUM = 1, HESAP_ISTEME_ZAMANI = ISNULL(HESAP_ISTEME_ZAMANI, GETDATE()), SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
            // Hesap fişi kasadaki yazıcıdan kendiliğinden çıkar (TA34): fiş basan bilgisayar etkinse kuyruğa yazılır
            const fisKuyrukta = await AdisyonMutfakSqlRepository.hesapFisiKuyrugu(tx, { adisyonId, no: a.no, masa: a.masa }, temiz(kim.ad));
            await olayYaz(tx, "hesap", { adisyonId, masaId: a.masaId, veri: { masa: a.masa, isteyen: temiz(kim.ad), fisKuyrukta } });
        });
        return { ...(await AdisyonSqlRepository.getir(ctx, adisyonId)), hesap: await this.hesap(ctx, adisyonId) };
    }
    /** Ara ödeme (eşit / tutar bölme): yetki "tahsilat"; kalan aşılamaz; kalan sıfırlanırsa tek fiş yazılıp adisyon kapanır */
    static async odemeEkle(ctx, adisyonId, g, kim) {
        yetki(kim, "tahsilat");
        const o = odemeDenetle(g, 0);
        const ayar = await AdisyonTanimSqlRepository.ayarlar(ctx);
        const vezne = await tahsilatVeznesi(ctx, g.vezneId, ayar);
        let sonuc = { kapandi: false, faturaId: null, faturaNo: null, posBagla: [] };
        await islem(ctx, async (tx) => {
            const once = await istekOnce(tx, temiz(g.istekId), adisyonId, "odeme");
            if (once) {
                sonuc = { kapandi: false, faturaId: once.faturaId, faturaNo: once.faturaNo, posBagla: [] };
                return;
            }
            const a = await kilitle(tx, adisyonId);
            const d = await durumOku(tx, adisyonId, a.servisOrani, servisKdvi(ayar));
            if (d.kalan <= 0)
                throw ApiError.badRequest("Ödenecek tutar kalmadı.");
            if (o.tutar - d.kalan > 0.005)
                throw ApiError.badRequest(`Ödeme kalan tutardan (${d.kalan.toFixed(2)}) fazla olamaz.`);
            await odemeleriTamamla(tx, [o], ayar);
            if (o.posIslemId)
                o.posCihaziId = await araPosIslemi(tx, o.posIslemId, o.tutar, o.posCihaziId);
            if (o.arac === ODEME_ARACI.NAKIT)
                await nakitVeznesiDenetle(tx, adisyonId, vezne);
            await new sql.Request(tx).input("A", sql.Int, adisyonId).input("T", sql.Decimal(18, 2), o.tutar).input("R", sql.TinyInt, o.arac).input("P", sql.Int, o.posCihaziId).input("C", sql.Int, o.cariKartId)
                .input("PI", sql.Int, o.posIslemId).input("AC", sql.NVarChar(100), o.aciklama).input("E", sql.NVarChar(60), temiz(kim.ad).slice(0, 60)).input("VZ", sql.Int, vezne)
                .query(`INSERT INTO dbo.TODVZ_ADISYON_ODEME (ADISYON_ID, TUTAR, ARAC, POS_CIHAZI_ID, CARI_KART_ID, POS_ISLEM_ID, ACIKLAMA, EKLEYEN_AD, VEZNE_ID) VALUES (@A, @T, @R, @P, @C, @PI, @AC, @E, @VZ)`);
            await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`UPDATE dbo.TODVZ_ADISYON SET SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
            await olayYaz(tx, "odeme", { adisyonId, masaId: a.masaId, veri: { tutar: o.tutar } });
            if (d.kalan - o.tutar <= 0.005)
                sonuc = await this.fisYazVeKapat(tx, a, ayar, vezne, g.musteri ?? null, kim, ctx);
            await istekYaz(tx, temiz(g.istekId), adisyonId, "odeme", sonuc);
        });
        await this.posBagla(sonuc, ctx);
        return this.sonuc(ctx, adisyonId, sonuc);
    }
    /** Bekleyen ara ödemeyi sil (fişe yazılmadan): yetki "tahsilat"; kartla cihazdan çekilmiş ödeme silinmez */
    static async odemeSil(ctx, odemeId, kim) {
        yetki(kim, "tahsilat");
        let adisyonId = 0;
        await islem(ctx, async (tx) => {
            // Kilit sırası her yerde adisyon → ödeme (tersi kapat / birleştir ile kilitlenme verir): önce kilitsiz oku, adisyonu kilitle, sonra yeniden oku
            const on = (await new sql.Request(tx).input("O", sql.Int, odemeId).query(`SELECT ADISYON_ID FROM dbo.TODVZ_ADISYON_ODEME WHERE ODEME_ID = @O`)).recordset[0];
            if (!on)
                throw ApiError.notFound("Ödeme bulunamadı.");
            adisyonId = Number(on.ADISYON_ID);
            const a = await kilitle(tx, adisyonId);
            const o = (await new sql.Request(tx).input("O", sql.Int, odemeId).input("A", sql.Int, adisyonId).query(`SELECT ADISYON_ID, FATURA_ID, POS_ISLEM_ID FROM dbo.TODVZ_ADISYON_ODEME WITH (UPDLOCK) WHERE ODEME_ID = @O AND ADISYON_ID = @A`)).recordset[0];
            if (!o)
                throw ApiError.conflict("Ödeme başka bir adisyona taşınmış ya da silinmiş; ekranı yenileyin.");
            if (o.FATURA_ID)
                throw ApiError.conflict("Ödeme fişe yazılmış; silinemez.");
            if (o.POS_ISLEM_ID)
                throw ApiError.badRequest("Kartla cihazdan çekilmiş ödeme silinemez; Banka › POS İşlemleri'nden iade edin.");
            // Y8: silinen ara ödeme iz bırakır (kim, ne zaman); rapor / denetim için silinenler tablosunda kalır
            await new sql.Request(tx).input("O", sql.Int, odemeId).input("SA", sql.NVarChar(60), temiz(kim.ad).slice(0, 60) || null)
                .input("SK", sql.Int, kim.kullaniciId ?? null).input("SG", sql.Int, kim.garsonId ?? null).query(`
        INSERT INTO dbo.TODVZ_ADISYON_ODEME_SILINEN (ODEME_ID, ADISYON_ID, TUTAR, ARAC, POS_CIHAZI_ID, CARI_KART_ID, VEZNE_ID, ACIKLAMA, EKLEYEN_AD, ZAMAN, SILEN_AD, SILEN_KULLANICI_ID, SILEN_GARSON_ID)
          SELECT ODEME_ID, ADISYON_ID, TUTAR, ARAC, POS_CIHAZI_ID, CARI_KART_ID, VEZNE_ID, ACIKLAMA, EKLEYEN_AD, ZAMAN, @SA, @SK, @SG FROM dbo.TODVZ_ADISYON_ODEME WHERE ODEME_ID = @O;
        DELETE FROM dbo.TODVZ_ADISYON_ODEME WHERE ODEME_ID = @O;`);
            await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`UPDATE dbo.TODVZ_ADISYON SET SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
            await olayYaz(tx, "odeme-silindi", { adisyonId, masaId: a.masaId });
        });
        return { ...(await AdisyonSqlRepository.getir(ctx, adisyonId)), hesap: await this.hesap(ctx, adisyonId) };
    }
    /** Toplu tahsilat (TA35): kalanın tamamı verilen ödemelerle (+ bekleyen ara ödemeler); tek fiş + çoklu ödeme, adisyon kapanır */
    static async kapat(ctx, adisyonId, g, kim) {
        yetki(kim, "tahsilat");
        const yeni = (Array.isArray(g.odemeler) ? g.odemeler : []).map(odemeDenetle);
        const ayar = await AdisyonTanimSqlRepository.ayarlar(ctx);
        const vezne = await tahsilatVeznesi(ctx, g.vezneId, ayar);
        let sonuc = { kapandi: false, faturaId: null, faturaNo: null, posBagla: [] };
        await islem(ctx, async (tx) => {
            const once = await istekOnce(tx, temiz(g.istekId), adisyonId, "kapat");
            if (once) {
                sonuc = { kapandi: false, faturaId: once.faturaId, faturaNo: once.faturaNo, posBagla: [] };
                return;
            }
            const a = await kilitle(tx, adisyonId);
            const d = await durumOku(tx, adisyonId, a.servisOrani, servisKdvi(ayar));
            const yeniToplam = y2(yeni.reduce((t, o) => t + o.tutar, 0));
            if (Math.abs(yeniToplam - d.kalan) > 0.005)
                throw ApiError.badRequest(`Ödemeler (${yeniToplam.toFixed(2)}) kalan tutara (${d.kalan.toFixed(2)}) eşit olmalı.`);
            await odemeleriTamamla(tx, yeni, ayar);
            if (yeni.some((o) => o.arac === ODEME_ARACI.NAKIT))
                await nakitVeznesiDenetle(tx, adisyonId, vezne);
            for (const o of yeni) {
                await new sql.Request(tx).input("A", sql.Int, adisyonId).input("T", sql.Decimal(18, 2), o.tutar).input("R", sql.TinyInt, o.arac).input("P", sql.Int, o.posCihaziId).input("C", sql.Int, o.cariKartId)
                    .input("PI", sql.Int, o.posIslemId).input("AC", sql.NVarChar(100), o.aciklama).input("E", sql.NVarChar(60), temiz(kim.ad).slice(0, 60)).input("VZ", sql.Int, vezne)
                    .query(`INSERT INTO dbo.TODVZ_ADISYON_ODEME (ADISYON_ID, TUTAR, ARAC, POS_CIHAZI_ID, CARI_KART_ID, POS_ISLEM_ID, ACIKLAMA, EKLEYEN_AD, VEZNE_ID) VALUES (@A, @T, @R, @P, @C, @PI, @AC, @E, @VZ)`);
            }
            sonuc = await this.fisYazVeKapat(tx, a, ayar, vezne, g.musteri ?? null, kim, ctx);
            await istekYaz(tx, temiz(g.istekId), adisyonId, "kapat", sonuc);
        });
        await this.posBagla(sonuc, ctx);
        return this.sonuc(ctx, adisyonId, sonuc);
    }
    /**
     * Ürün seçerek ödeme / fatura isteyen müşteri (TA35, TA36): seçilen kalemler (kısmi miktarla bölünerek) + oransal servis ayrı fiş;
     * ödemeler o fişin toplamına eşit. Yetki "tahsilat" + "bolme". Fişlenmemiş kalem kalmaz ve bekleyen ödeme yoksa adisyon kapanır.
     */
    static async urunleOde(ctx, adisyonId, g, kim) {
        yetki(kim, "tahsilat", "bolme");
        const odemeler = (Array.isArray(g.odemeler) ? g.odemeler : []).map(odemeDenetle);
        if (!odemeler.length)
            throw ApiError.badRequest("Ödeme girilmeli.");
        const ayar = await AdisyonTanimSqlRepository.ayarlar(ctx);
        const vezne = await tahsilatVeznesi(ctx, g.vezneId, ayar);
        let sonuc = { kapandi: false, faturaId: null, faturaNo: null, posBagla: [] };
        await islem(ctx, async (tx) => {
            const once = await istekOnce(tx, temiz(g.istekId), adisyonId, "urun");
            if (once) {
                sonuc = { kapandi: false, faturaId: once.faturaId, faturaNo: once.faturaNo, posBagla: [] };
                return;
            }
            const a = await kilitle(tx, adisyonId);
            const secim = (Array.isArray(g.kalemler) ? g.kalemler : []).filter((s) => Number(s?.kalemId) > 0);
            if (!secim.length)
                throw ApiError.badRequest("Ödenecek kalem seçilmeli.");
            if (new Set(secim.map((s) => Number(s.kalemId))).size !== secim.length)
                throw ApiError.badRequest("Aynı kalem iki kez seçilmiş.");
            const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`SELECT KALEM_ID, AD, MIKTAR, RTRIM(BIRIM) AS BIRIM, IPTAL, FATURA_ID FROM dbo.TODVZ_ADISYON_KALEM WITH (UPDLOCK)
        WHERE ADISYON_ID = @A AND KALEM_ID IN (${secim.map((s) => Number(s.kalemId)).join(",")})`);
            const idler = [];
            for (const s of secim) {
                const k = r.recordset.find((x) => Number(x.KALEM_ID) === Number(s.kalemId));
                if (!k)
                    throw ApiError.badRequest("Seçilen kalem bu adisyonda değil (ekranı yenileyin).");
                if (k.IPTAL)
                    throw ApiError.badRequest(`${temiz(k.AD)}: iptal edilmiş.`);
                if (k.FATURA_ID)
                    throw ApiError.badRequest(`${temiz(k.AD)}: zaten ödenmiş.`);
                const km = kismiMiktar(Number(k.MIKTAR), s.miktar, !!tartiBirimi(k.BIRIM));
                if ("hata" in km)
                    throw ApiError.badRequest(`${temiz(k.AD)}: ${km.hata}`);
                let id = Number(k.KALEM_ID);
                if (!km.tamami) {
                    await new sql.Request(tx).input("K", sql.Int, id).input("M", sql.Decimal(18, 4), km.miktar).query(`UPDATE dbo.TODVZ_ADISYON_KALEM SET MIKTAR = MIKTAR - @M WHERE KALEM_ID = @K`);
                    id = Number((await new sql.Request(tx).input("K", sql.Int, id).input("M", sql.Decimal(18, 4), km.miktar).query(`
            INSERT INTO dbo.TODVZ_ADISYON_KALEM (ADISYON_ID, STOK_KART_ID, AD, MIKTAR, BIRIM, PORSIYON_AD, PORSIYON_CARPAN, BIRIM_FIYAT, KDV_ORANI, SECENEKLER, NOTU, YER_ID, DURUM,
              IKRAM, IPTAL, NEDEN, ISLEM_YAPAN, EKLEYEN_GARSON_ID, EKLEYEN_KULLANICI_ID, EKLEYEN_AD, EKLEME_ZAMANI, GONDERIM_ZAMANI, HAZIR_ZAMANI)
            OUTPUT INSERTED.KALEM_ID
            SELECT ADISYON_ID, STOK_KART_ID, AD, @M, BIRIM, PORSIYON_AD, PORSIYON_CARPAN, BIRIM_FIYAT, KDV_ORANI, SECENEKLER, NOTU, YER_ID, DURUM,
              IKRAM, IPTAL, NEDEN, ISLEM_YAPAN, EKLEYEN_GARSON_ID, EKLEYEN_KULLANICI_ID, EKLEYEN_AD, EKLEME_ZAMANI, GONDERIM_ZAMANI, HAZIR_ZAMANI
            FROM dbo.TODVZ_ADISYON_KALEM WHERE KALEM_ID = @K`)).recordset[0].KALEM_ID);
                }
                idler.push(id);
            }
            const d = await durumOku(tx, adisyonId, a.servisOrani, servisKdvi(ayar));
            const secilen = d.kalemler.filter((k) => idler.includes(k.kalemId));
            const { servis, baslik, toplam } = secimHesabi(d, secilen, a.servisOrani, servisKdvi(ayar));
            const odenen = y2(odemeler.reduce((t, o) => t + o.tutar, 0));
            if (Math.abs(odenen - toplam) > 0.005)
                throw ApiError.badRequest(`Ödemeler (${odenen.toFixed(2)}) seçilen ürünlerin tutarına (${toplam.toFixed(2)}) eşit olmalı.`);
            await odemeleriTamamla(tx, odemeler, ayar);
            // Kalanı aşan bekleyen ara ödeme kalmasın
            if (d.odenen - (d.toplam - toplam) > 0.005)
                throw ApiError.badRequest("Bekleyen ara ödemeler kalan tutarı aşıyor; önce ara ödemeleri düzeltin.");
            const f = await this.fisYaz(tx, a, ayar, secilen, servis, odemeler, vezne, g.musteri ?? null, kim, ctx, [], baslik);
            sonuc = { kapandi: false, faturaId: f.faturaId, faturaNo: f.faturaNo, posBagla: odemeler.map((o) => o.posIslemId).filter((x) => !!x) };
            // Fişlenmemiş kalem kalmadıysa: bekleyen ödeme yoksa kapanır; varsa (eşitse) onlarla kapanış fişi zaten gerekmez — kalan 0
            const son = await durumOku(tx, adisyonId, a.servisOrani, servisKdvi(ayar));
            if (!son.kalemler.length && !son.odemeler.length) {
                await this.kapanis(tx, a);
                sonuc.kapandi = true;
            }
            else if (son.kalemler.length && son.odemeler.length && son.kalan <= 0.005) {
                // Kalan kalemlerin tutarı bekleyen ara ödemelere eşit: kapanış fişi (kalanlar + ara ödemeler) ve kapanış
                const k = await this.fisYazVeKapat(tx, a, ayar, vezne, null, kim, ctx);
                sonuc = { kapandi: true, faturaId: sonuc.faturaId, faturaNo: sonuc.faturaNo, posBagla: [...sonuc.posBagla, ...k.posBagla] };
            }
            await istekYaz(tx, temiz(g.istekId), adisyonId, "urun", sonuc);
        });
        await this.posBagla(sonuc, ctx);
        return this.sonuc(ctx, adisyonId, sonuc);
    }
    /** Tahsilat cevabı: adisyon + hesap; aynı istek kimliği yeniden geldiyse (ilk istek işlenmiş) kapanış adisyonun durumundan okunur */
    static async sonuc(ctx, adisyonId, s) {
        const a = await AdisyonSqlRepository.getir(ctx, adisyonId);
        return { ...a, hesap: await this.hesap(ctx, adisyonId), kapandi: s.kapandi || ![ADISYON_DURUM.ACIK, ADISYON_DURUM.HESAP_ISTENDI].includes(a.durum), faturaId: s.faturaId, faturaNo: s.faturaNo };
    }
    /** Kalan kalemler + servis + bekleyen ödemelerle tek fiş, adisyon kapanır */
    static async fisYazVeKapat(tx, a, ayar, vezneId, musteri, kim, ctx) {
        const d = await durumOku(tx, a.adisyonId, a.servisOrani, servisKdvi(ayar));
        let faturaId = null, faturaNo = null;
        if (d.kalemler.length) {
            // Fiş veznesi (K3): nakit ara ödeme hangi veznede alındıysa fiş oraya yazılır (nakit o kasanın çekmecesinde); nakit yoksa kapatanın veznesi
            const nakitVeznesi = d.odemeler.find((o) => o.arac === ODEME_ARACI.NAKIT && Number(o.vezneId) > 0)?.vezneId ?? null;
            const f = await this.fisYaz(tx, a, ayar, d.kalemler, d.servis, d.odemeler, Number(nakitVeznesi) || vezneId, musteri, kim, ctx, d.odemeler.map((o) => o.odemeId), d.baslik);
            faturaId = f.faturaId;
            faturaNo = f.faturaNo;
        }
        else if (d.odemeler.length)
            throw ApiError.badRequest("Fişe yazılacak kalem yok ama bekleyen ödeme var; ödemeleri silin.");
        await this.kapanis(tx, a);
        return { kapandi: true, faturaId, faturaNo, posBagla: d.odemeler.map((o) => o.posIslemId).filter((x) => !!x) };
    }
    static async kapanis(tx, a) {
        // Hiç fiş yazılmadıysa (bütün ürünler tek tek iptal edilmiş) satış sayılmaz: iptal kapanışı (durum 9)
        const fis = Number((await new sql.Request(tx).input("A", sql.Int, a.adisyonId).query(`SELECT COUNT(*) AS N FROM dbo.TODVZ_ADISYON_FIS WHERE ADISYON_ID = @A`)).recordset[0].N);
        if (!fis) {
            await new sql.Request(tx).input("A", sql.Int, a.adisyonId).query(`UPDATE dbo.TODVZ_ADISYON SET DURUM = 9, KAPANIS_ZAMANI = GETDATE(), ACIKLAMA = ISNULL(ACIKLAMA, N'Ürünsüz kapatıldı'), SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
            await olayYaz(tx, "kapandi", { adisyonId: a.adisyonId, masaId: a.masaId, veri: { iptal: true } });
            return;
        }
        await new sql.Request(tx).input("A", sql.Int, a.adisyonId).query(`UPDATE dbo.TODVZ_ADISYON SET DURUM = 2, KAPANIS_ZAMANI = GETDATE(), SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
        await olayYaz(tx, "kapandi", { adisyonId: a.adisyonId, masaId: a.masaId, veri: { odendi: true } });
    }
    /** Satış fişi (Ticari, işlem içinde) + kalem / ödeme / adisyon bağları */
    static async fisYaz(tx, a, ayar, kalemler, servis, odemeler, vezneId, musteri, kim, ctx, bekleyenOdemeIdler = [], baslik = null) {
        const servisKdv = servisKdvi(ayar);
        const satirlar = kalemler.map((k) => ({
            stokKartId: k.stokKartId, miktar: k.miktar, kdvDahilFiyat: k.birimFiyat, kdvOrani: k.kdv, stokCarpani: k.carpan,
            urunAdi: `${k.ad}${k.porsiyonAd ? ` (${k.porsiyonAd})` : ""}`.slice(0, 200),
            ...(k.ikram ? { iskontoTuru: 1, iskontoDegeri: 100 } : {}),
        }));
        if (servis > 0)
            satirlar.push({ stokKartId: null, urunAdi: `Servis ücreti (%${String(a.servisOrani).replace(".", ",")})`, birim: "Adet", kdvOrani: servisKdv, miktar: 1, kdvDahilFiyat: servis });
        const tl = (await new sql.Request(tx).query(`SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID`)).recordset[0]?.PARA_ID ?? null;
        const odemeGirdi = odemeler.map((o, i) => {
            const ortak = { satirNo: i + 1, odemeAraciTuru: o.arac, miktar: o.tutar, kur: 1, tutar: o.tutar, paraKodu: "TL" };
            if (o.arac === 1)
                return { ...ortak, cariKartId: o.cariKartId, paraId: null, paraAdi: "VERESİYE" };
            if (o.arac === 2)
                return { ...ortak, cariKartId: null, posCihaziId: o.posCihaziId, paraId: null, paraAdi: "KREDİ KARTI / POS" };
            if (o.arac === 3)
                return { ...ortak, cariKartId: o.cariKartId, paraId: null, paraAdi: "BANKA HAVALE / EFT" };
            return { ...ortak, paraId: tl, paraAdi: "TÜRK LİRASI" };
        });
        const m = musteriDenetle(musteri);
        const r = await TicariSatisSqlRepository.kaydetIslemde({
            // Fatura isteyen müşteri e-Fatura mükellefiyse Ticari fatura (Hızlı Satış ile aynı), öbür hâlde e-Arşiv
            vezneId: Number(vezneId) || ayar.vezneId || 1, tarih: new Date().toISOString(), senaryo: m.mukellef && temiz(m.vknTckn).length === 10 ? "TICARIFATURA" : "EARSIVFATURA",
            cariKartId: Number(m.cariKartId) || null, aliciVknTckn: temiz(m.vknTckn) || "11111111111", aliciUnvan: temiz(m.unvan) || "NİHAİ TÜKETİCİ",
            adres: m.adres ?? null, il: m.il ?? null, ilce: m.ilce ?? null, vergiDairesi: m.vergiDairesi ?? null, eposta: m.eposta ?? null, telefon: m.telefon ?? null,
            satirlar, odemeler: odemeGirdi, eksiStokOnay: true,
            ...(baslik ? { iskontoTuru: baslik.turu, iskontoDegeri: baslik.deger } : {}),
        }, kim.kullaniciId ?? undefined, ctx, { tx, satirKdv: true, satirAdi: true, stokYazma: ayar.stokTakibi, pasifKart: true, eksiStokSerbest: true });
        // Fiş toplamı ile adisyon tutarı birebir (kuruş farkı olmasın)
        const beklenen = fisToplami(kalemler, servis, servisKdv, baslik);
        if (baslik) {
            // Uygulanan indirim adisyonda birikir; tutar indiriminde kalan indirim düşer (sonraki fiş kalanını alır)
            const uygulanan = y2(fisToplami(kalemler, servis, servisKdv) - beklenen);
            await new sql.Request(tx).input("A", sql.Int, a.adisyonId).input("U", sql.Decimal(18, 2), uygulanan).input("T", sql.TinyInt, baslik.turu)
                .query(`UPDATE dbo.TODVZ_ADISYON SET INDIRIM_UYGULANAN = INDIRIM_UYGULANAN + @U,
          INDIRIM_DEGERI = CASE WHEN @T = 2 THEN CASE WHEN INDIRIM_DEGERI - @U < 0 THEN 0 ELSE INDIRIM_DEGERI - @U END ELSE INDIRIM_DEGERI END WHERE ADISYON_ID = @A`);
        }
        if (Math.abs(Number(r.genelToplam) - beklenen) > 0.005)
            throw ApiError.badRequest(`Fiş toplamı (${Number(r.genelToplam).toFixed(2)}) adisyon tutarıyla (${beklenen.toFixed(2)}) uyuşmuyor; işlem yapılmadı.`);
        for (let i = 0; i < kalemler.length; i++) {
            await new sql.Request(tx).input("K", sql.Int, kalemler[i].kalemId).input("F", sql.Int, r.faturaId).input("N", sql.Int, i + 1)
                .query(`UPDATE dbo.TODVZ_ADISYON_KALEM SET FATURA_ID = @F, FATURA_SATIR_NO = @N WHERE KALEM_ID = @K AND FATURA_ID IS NULL`);
        }
        await new sql.Request(tx).input("A", sql.Int, a.adisyonId).input("F", sql.Int, r.faturaId).query(`INSERT INTO dbo.TODVZ_ADISYON_FIS (ADISYON_ID, FATURA_ID) VALUES (@A, @F)`);
        if (bekleyenOdemeIdler.length)
            await new sql.Request(tx).input("F", sql.Int, r.faturaId).query(`UPDATE dbo.TODVZ_ADISYON_ODEME SET FATURA_ID = @F WHERE ODEME_ID IN (${bekleyenOdemeIdler.join(",")})`);
        else {
            // Ürün seçerek ödeme: ödemeler fiş anında yazılır (ara ödeme kaydı olarak, fişe bağlı)
            for (const o of odemeler) {
                await new sql.Request(tx).input("A", sql.Int, a.adisyonId).input("T", sql.Decimal(18, 2), o.tutar).input("R", sql.TinyInt, o.arac).input("P", sql.Int, o.posCihaziId).input("C", sql.Int, o.cariKartId)
                    .input("PI", sql.Int, o.posIslemId ?? null).input("E", sql.NVarChar(60), temiz(kim.ad).slice(0, 60)).input("F", sql.Int, r.faturaId).input("VZ", sql.Int, Number(vezneId) || null)
                    .query(`INSERT INTO dbo.TODVZ_ADISYON_ODEME (ADISYON_ID, TUTAR, ARAC, POS_CIHAZI_ID, CARI_KART_ID, POS_ISLEM_ID, EKLEYEN_AD, FATURA_ID, VEZNE_ID) VALUES (@A, @T, @R, @P, @C, @PI, @E, @F, @VZ)`);
            }
        }
        await olayYaz(tx, "fis", { adisyonId: a.adisyonId, masaId: a.masaId, veri: { faturaNo: r.faturaNo, toplam: r.genelToplam } });
        return { faturaId: r.faturaId, faturaNo: r.faturaNo };
    }
    /** Cihazdan çekilmiş kart ödemelerini fişe bağla (işlemden sonra; hata vermez) */
    static async posBagla(s, ctx) {
        if (!s.faturaId || !s.posBagla.length)
            return;
        try {
            await PosService.belgeyeBagla({ posIslemIdler: s.posBagla, belgeTuru: "perakende", belgeId: s.faturaId, belgeNo: s.faturaNo }, ctx);
        }
        catch (e) {
            logger.warn(`[Adisyon] POS tahsilatı fişe bağlanamadı: ${e.message}`);
        }
    }
}

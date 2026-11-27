import { istekOku, istekYaz } from "../services/adisyon/adisyonIstek.js";
import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { AdisyonTanimSqlRepository } from "./adisyonTanimSql.repository.js";
import { ADISYON_DURUM, ADISYON_TUR, KALEM_DURUM, adisyonNo, adisyonToplami, kalemBirimFiyati, kalemTutari, masaKdvOrani, masaTabanFiyati, paketMusteriDenetle, secimDenetle, secimMetni, siparisMiktariDenetle, } from "../services/adisyon/adisyonHesap.js";
import { tartiBirimi } from "../services/ticari/ticariHesap.js";
import { olayTetikle, olayYaz } from "../services/adisyon/adisyonOlay.service.js";
import { AdisyonMutfakSqlRepository } from "./adisyonMutfakSql.repository.js";
/**
 * Adisyon işlemleri (docs/TICARI_ADISYON_YOL_HARITASI.md, D3): menü (bölge fiyat listesiyle), masa durumu, adisyon ayrıntısı,
 * sipariş gönderme. Masa başına tek açık adisyon (masa kilidi + filtreli tekil indeks); sipariş tek kullanımlık istek kimliğiyle
 * (TA39: bağlantı kopup tekrar gönderilse de çift kayıt olmaz). Stok ve satış fişi adisyon kapanınca yazılır (D7).
 */
const temiz = (v) => String(v ?? "").trim();
const havuz = (ctx) => AdisyonTanimSqlRepository.havuz(ctx);
const secimOku = (v) => { if (!v)
    return []; try {
    const x = JSON.parse(String(v));
    return Array.isArray(x) ? x : [];
}
catch {
    return [];
} };
/** Ürünlerin bağlı seçenek grupları (etkin gruplar, bütün seçenekleriyle) */
async function secenekGruplari(r) {
    const q = await new sql.Request(r).query(`SELECT SG_ID, AD, ZORUNLU, COKLU, AKTIF FROM dbo.TODVZ_ADISYON_SECENEK_GRUP;
    SELECT SECENEK_ID, SG_ID, AD, EK_FIYAT, AKTIF FROM dbo.TODVZ_ADISYON_SECENEK ORDER BY SG_ID, SIRA, SECENEK_ID;`);
    const rs = q.recordsets;
    return rs[0].map((g) => ({ sgId: Number(g.SG_ID), ad: temiz(g.AD), zorunlu: !!g.ZORUNLU, coklu: !!g.COKLU, aktif: !!g.AKTIF,
        secenekler: rs[1].filter((s) => Number(s.SG_ID) === Number(g.SG_ID)).map((s) => ({ secenekId: Number(s.SECENEK_ID), ad: temiz(s.AD), ekFiyat: Number(s.EK_FIYAT), aktif: !!s.AKTIF })) }));
}
/** Kart satırları (menü ve sipariş aynı fiyat kuralını kullanır); TL dışı para birimli kart masada satılmaz */
const KART_SORGUSU = (kosul) => `
  SELECT K.STOK_KART_ID, RTRIM(K.KOD) AS KOD, RTRIM(K.AD) AS AD, K.STOK_GRUP_ID, RTRIM(G.AD) AS GRUP_AD, RTRIM(K.BIRIM) AS BIRIM, K.KDV_ORANI, K.SATIS_FIYATI,
    K.FIYAT_KDV_DAHIL, K.AKTIF, RTRIM(P.KOD) AS PARA_KODU, K.ADISYON_KDV_ORANI, ISNULL(K.RECETELI, 0) AS RECETELI, LF.FIYAT AS LISTE_FIYATI, GY.YER_ID,
    STUFF((SELECT '|' + B.BARKOD FROM dbo.TODVZ_STOK_BARKOD B WHERE B.STOK_KART_ID = K.STOK_KART_ID AND B.STOK_BIRIM_ID IS NULL ORDER BY B.STOK_BARKOD_ID FOR XML PATH(''), TYPE).value('.', 'varchar(max)'), 1, 1, '') AS BARKODLAR
  FROM dbo.TODVZ_STOK_KART K
  LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID
  LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID = K.PARA_ID
  LEFT JOIN dbo.TODVZ_STOK_KART_FIYAT LF ON LF.STOK_KART_ID = K.STOK_KART_ID AND LF.FIYAT_LISTESI_ID = @LISTE
  LEFT JOIN dbo.TODVZ_ADISYON_GRUP_YER GY ON GY.STOK_GRUP_ID = K.STOK_GRUP_ID
    AND EXISTS (SELECT 1 FROM dbo.TODVZ_ADISYON_HAZIRLIK H WHERE H.YER_ID = GY.YER_ID AND H.AKTIF = 1)
  WHERE ${kosul}`;
const tlMi = (paraKodu) => { const p = temiz(paraKodu).toUpperCase(); return !p || p === "TL" || p === "TRY"; };
export class AdisyonSqlRepository {
    // ───────────── Menü ─────────────
    /** Bölgenin menüsü: etkin TL kartları, masa fiyatı (bölge listesi → kart), masa KDV'si, porsiyonlar, seçenek bağları */
    static async menu(ctx, bolgeId) {
        const pool = await havuz(ctx);
        const ayar = await AdisyonTanimSqlRepository.ayarlar(ctx, pool);
        let liste = null;
        if (bolgeId) {
            const b = await pool.request().input("B", sql.Int, bolgeId).query(`SELECT FIYAT_LISTESI_ID FROM dbo.TODVZ_ADISYON_BOLGE WHERE BOLGE_ID = @B`);
            if (!b.recordset.length)
                throw ApiError.notFound("Bölge bulunamadı.");
            liste = b.recordset[0].FIYAT_LISTESI_ID ?? null;
        }
        const r = await pool.request().input("LISTE", sql.Int, liste).query(`${KART_SORGUSU("K.AKTIF = 1")} ORDER BY G.AD, K.AD;
      SELECT PORSIYON_ID, STOK_KART_ID, AD, CARPAN, FIYAT FROM dbo.TODVZ_ADISYON_PORSIYON ORDER BY STOK_KART_ID, SIRA, PORSIYON_ID;
      SELECT STOK_KART_ID, SG_ID FROM dbo.TODVZ_ADISYON_KART_SECENEK ORDER BY STOK_KART_ID, SIRA;`);
        const rs = r.recordsets;
        const porsiyon = new Map();
        for (const p of rs[1])
            porsiyon.set(Number(p.STOK_KART_ID), [...(porsiyon.get(Number(p.STOK_KART_ID)) || []), { porsiyonId: Number(p.PORSIYON_ID), ad: temiz(p.AD), carpan: Number(p.CARPAN), fiyat: p.FIYAT === null ? null : Number(p.FIYAT) }]);
        const bag = new Map();
        for (const b of rs[2])
            bag.set(Number(b.STOK_KART_ID), [...(bag.get(Number(b.STOK_KART_ID)) || []), Number(b.SG_ID)]);
        const gruplar = await secenekGruplari(pool);
        const etkinGrup = new Set(gruplar.filter((g) => g.aktif).map((g) => g.sgId));
        const grupAdlari = new Map();
        const urunler = [];
        for (const k of rs[0]) {
            if (!tlMi(k.PARA_KODU))
                continue;
            const kdv = masaKdvOrani(k.ADISYON_KDV_ORANI, ayar.kdvVarsayilan, Number(k.KDV_ORANI));
            const id = Number(k.STOK_KART_ID);
            grupAdlari.set(k.STOK_GRUP_ID ?? null, k.STOK_GRUP_ID ? temiz(k.GRUP_AD) : "Grupsuz");
            urunler.push({ stokKartId: id, kod: temiz(k.KOD), ad: temiz(k.AD), stokGrupId: k.STOK_GRUP_ID ?? null, birim: temiz(k.BIRIM) || "Adet", tartili: !!tartiBirimi(k.BIRIM),
                fiyat: masaTabanFiyati({ satisFiyati: k.SATIS_FIYATI === null ? null : Number(k.SATIS_FIYATI), listeFiyati: k.LISTE_FIYATI === null ? null : Number(k.LISTE_FIYATI), fiyatKdvDahil: !!k.FIYAT_KDV_DAHIL }, kdv),
                kdvOrani: kdv, barkodlar: k.BARKODLAR ? String(k.BARKODLAR).split("|").filter(Boolean) : [], receteli: !!k.RECETELI,
                porsiyonlar: porsiyon.get(id) || [], secenekGrupIdler: (bag.get(id) || []).filter((g) => etkinGrup.has(g)) });
        }
        return {
            bolgeId: bolgeId ?? null, fiyatListesiId: liste,
            gruplar: [...grupAdlari].map(([stokGrupId, ad]) => ({ stokGrupId, ad })).sort((a, b) => (a.stokGrupId === null ? 1 : b.stokGrupId === null ? -1 : a.ad.localeCompare(b.ad, "tr"))),
            urunler,
            secenekGruplari: gruplar.filter((g) => g.aktif).map((g) => ({ ...g, secenekler: g.secenekler.filter((s) => s.aktif !== false) })),
        };
    }
    // ───────────── Masa durumu ─────────────
    /** Etkin bölgeler + masalar + masadaki açık adisyonun özeti (tutar, açık kalma süresi sunucu saatiyle) */
    static async masalar(ctx) {
        const pool = await havuz(ctx);
        const r = await pool.request().query(`
      SELECT BOLGE_ID, RTRIM(AD) AS AD, SIRA, FIYAT_LISTESI_ID FROM dbo.TODVZ_ADISYON_BOLGE WHERE AKTIF = 1 ORDER BY SIRA, AD;
      SELECT M.MASA_ID, M.BOLGE_ID, RTRIM(M.AD) AS AD, M.KISI, A.ADISYON_ID, RTRIM(A.ADISYON_NO) AS ADISYON_NO, A.DURUM, A.KISI_SAYISI, A.SURUM, A.SERVIS_ORANI, A.INDIRIM_TURU, A.INDIRIM_DEGERI,
        DATEDIFF(SECOND, A.ACILIS_ZAMANI, GETDATE()) / 60 AS DAKIKA, RTRIM(G.AD) AS GARSON, T.ARA, T.KALEM, T.HAZIR,
        (SELECT SUM(O.TUTAR) FROM dbo.TODVZ_ADISYON_ODEME O WHERE O.ADISYON_ID = A.ADISYON_ID AND O.FATURA_ID IS NULL) AS ODENEN
      FROM dbo.TODVZ_ADISYON_MASA M
      JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID AND B.AKTIF = 1
      LEFT JOIN dbo.TODVZ_ADISYON A ON A.MASA_ID = M.MASA_ID AND A.DURUM IN (0, 1)
      LEFT JOIN dbo.TODVZ_ADISYON_GARSON G ON G.GARSON_ID = A.GARSON_ID
      OUTER APPLY (SELECT SUM(CASE WHEN K.IKRAM = 0 AND K.IPTAL = 0 AND K.FATURA_ID IS NULL THEN ROUND(K.MIKTAR * K.BIRIM_FIYAT, 2) ELSE 0 END) AS ARA, SUM(CASE WHEN K.IPTAL = 0 THEN 1 ELSE 0 END) AS KALEM,
          SUM(CASE WHEN K.IPTAL = 0 AND K.DURUM = 2 THEN 1 ELSE 0 END) AS HAZIR
        FROM dbo.TODVZ_ADISYON_KALEM K WHERE K.ADISYON_ID = A.ADISYON_ID) T
      WHERE M.AKTIF = 1 ORDER BY M.SIRA, M.MASA_ID;`);
        const rs = r.recordsets;
        const masalar = rs[1].map((m) => {
            const ara = Math.round((Number(m.ARA) || 0) * 100) / 100;
            const servis = m.SERVIS_ORANI ? Math.round(((ara * Number(m.SERVIS_ORANI)) / 100 + Number.EPSILON) * 100) / 100 : 0; // hesap ekranıyla aynı yuvarlama
            // Adisyon indirimi (K1): kutudaki tutar ödenecek kalandır
            const brut = ara + servis;
            const indirim = Number(m.INDIRIM_TURU) === 1 ? Math.round(((brut * Number(m.INDIRIM_DEGERI)) / 100) * 100) / 100 : Number(m.INDIRIM_TURU) === 2 ? Math.min(brut, Number(m.INDIRIM_DEGERI) || 0) : 0;
            return { masaId: Number(m.MASA_ID), bolgeId: Number(m.BOLGE_ID), ad: temiz(m.AD), kisi: m.KISI ?? null,
                adisyon: m.ADISYON_ID ? { adisyonId: Number(m.ADISYON_ID), adisyonNo: temiz(m.ADISYON_NO), durum: Number(m.DURUM), kisiSayisi: m.KISI_SAYISI ?? null, surum: Number(m.SURUM),
                    toplam: Math.max(0, Math.round((brut - indirim - (Number(m.ODENEN) || 0)) * 100) / 100), kalemSayisi: Number(m.KALEM) || 0, hazirSayisi: Number(m.HAZIR) || 0, acikDakika: Math.max(0, Number(m.DAKIKA) || 0), garson: m.GARSON ? temiz(m.GARSON) : null } : null };
        });
        // İndirimli adisyonlarda kutu, ödeme ekranının istediği tutarın kendisi (fiş hesabı; KDV dağıtımı kuruşu dahil)
        const indirimliler = rs[1].filter((m) => m.ADISYON_ID && m.INDIRIM_TURU).map((m) => Number(m.ADISYON_ID));
        if (indirimliler.length) {
            const { AdisyonHesapSqlRepository } = await import("./adisyonHesapSql.repository.js");
            const kalan = await AdisyonHesapSqlRepository.indirimliKalanlar(ctx, indirimliler);
            for (const m of masalar)
                if (m.adisyon && kalan.has(m.adisyon.adisyonId))
                    m.adisyon.toplam = kalan.get(m.adisyon.adisyonId);
        }
        // Mutfak fişi kuyruğunun özeti: basılamayan / eskiyen fiş ya da fiş basan bilgisayar yoksa ekranlar uyarı gösterir
        const mutfakFis = await AdisyonMutfakSqlRepository.fisDurumu(ctx, pool).catch(() => ({ durdu: 0, eskidi: 0, sirada: 0, istasyonYok: false }));
        return { bolgeler: rs[0].map((b) => ({ bolgeId: Number(b.BOLGE_ID), ad: temiz(b.AD), fiyatListesiId: b.FIYAT_LISTESI_ID ?? null, masalar: masalar.filter((m) => m.bolgeId === Number(b.BOLGE_ID)) })), mutfakFis };
    }
    // ───────────── Adisyon ayrıntısı ─────────────
    static async getir(ctx, adisyonId, havuzVeyaIslem) {
        const r0 = havuzVeyaIslem ?? (await havuz(ctx));
        const r = await new sql.Request(r0).input("A", sql.Int, adisyonId).query(`
      SELECT A.ADISYON_ID, RTRIM(A.ADISYON_NO) AS ADISYON_NO, A.ETTN, A.TUR, A.MASA_ID, RTRIM(M.AD) AS MASA_AD, M.BOLGE_ID, RTRIM(B.AD) AS BOLGE_AD, A.DURUM, A.KISI_SAYISI,
        A.ACILIS_ZAMANI, A.HESAP_ISTEME_ZAMANI, A.KAPANIS_ZAMANI, DATEDIFF(SECOND, A.ACILIS_ZAMANI, ISNULL(A.KAPANIS_ZAMANI, GETDATE())) / 60 AS DAKIKA,
        A.GARSON_ID, RTRIM(G.AD) AS GARSON, A.ACIKLAMA, A.SERVIS_ORANI, A.SURUM, A.MUSTERI_AD, A.MUSTERI_TEL, A.MUSTERI_ADRES, A.PAKET_DURUM,
        A.INDIRIM_TURU, A.INDIRIM_DEGERI, A.INDIRIM_NEDEN, A.INDIRIM_YAPAN, A.YENIDEN_ACILDI, A.YENIDEN_ACAN, A.YENIDEN_NEDEN
      FROM dbo.TODVZ_ADISYON A LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID LEFT JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID
      LEFT JOIN dbo.TODVZ_ADISYON_GARSON G ON G.GARSON_ID = A.GARSON_ID WHERE A.ADISYON_ID = @A;
      SELECT K.KALEM_ID, K.STOK_KART_ID, K.AD, K.MIKTAR, RTRIM(K.BIRIM) AS BIRIM, K.PORSIYON_AD, K.PORSIYON_CARPAN, K.BIRIM_FIYAT, K.KDV_ORANI, K.SECENEKLER, K.NOTU,
        K.YER_ID, RTRIM(H.AD) AS YER_AD, K.DURUM, K.IKRAM, K.IPTAL, K.NEDEN, K.ISLEM_YAPAN, K.EKLEYEN_AD, K.EKLEYEN_GARSON_ID, K.EKLEYEN_KULLANICI_ID,
        DATEDIFF(SECOND, K.EKLEME_ZAMANI, GETDATE()) / 60 AS DAKIKA, K.EKLEME_ZAMANI, K.FATURA_ID, K.ILK_FIYAT, K.FIYAT_NEDEN, K.FIYAT_DEGISTIREN
      FROM dbo.TODVZ_ADISYON_KALEM K LEFT JOIN dbo.TODVZ_ADISYON_HAZIRLIK H ON H.YER_ID = K.YER_ID WHERE K.ADISYON_ID = @A ORDER BY K.KALEM_ID;`);
        const rs = r.recordsets;
        const a = rs[0][0];
        if (!a)
            throw ApiError.notFound("Adisyon bulunamadı.");
        const kalemler = rs[1].map((k) => {
            const secimler = secimOku(k.SECENEKLER);
            const g = { miktar: Number(k.MIKTAR), birimFiyat: Number(k.BIRIM_FIYAT), ikram: !!k.IKRAM, iptal: !!k.IPTAL };
            return { kalemId: Number(k.KALEM_ID), stokKartId: k.STOK_KART_ID ?? null, ad: temiz(k.AD), miktar: g.miktar, birim: temiz(k.BIRIM), porsiyonAd: k.PORSIYON_AD ? temiz(k.PORSIYON_AD) : null,
                porsiyonCarpan: Number(k.PORSIYON_CARPAN), birimFiyat: g.birimFiyat, kdvOrani: Number(k.KDV_ORANI), secimler, secimMetni: secimMetni(secimler), notu: k.NOTU ? temiz(k.NOTU) : null,
                yerId: k.YER_ID ?? null, yerAd: k.YER_AD ? temiz(k.YER_AD) : null, durum: Number(k.DURUM), ikram: g.ikram, iptal: g.iptal, neden: k.NEDEN ? temiz(k.NEDEN) : null,
                islemYapan: k.ISLEM_YAPAN ? temiz(k.ISLEM_YAPAN) : null, ekleyen: k.EKLEYEN_AD ? temiz(k.EKLEYEN_AD) : null, ekleyenGarsonId: k.EKLEYEN_GARSON_ID ?? null,
                dakika: Math.max(0, Number(k.DAKIKA) || 0), tutar: kalemTutari(g), faturaId: k.FATURA_ID ?? null,
                ilkFiyat: k.ILK_FIYAT === null || k.ILK_FIYAT === undefined ? null : Number(k.ILK_FIYAT), fiyatNeden: k.FIYAT_NEDEN ? temiz(k.FIYAT_NEDEN) : null, fiyatDegistiren: k.FIYAT_DEGISTIREN ? temiz(k.FIYAT_DEGISTIREN) : null };
        });
        return {
            adisyonId: Number(a.ADISYON_ID), adisyonNo: temiz(a.ADISYON_NO), ettn: String(a.ETTN).toLowerCase(), tur: Number(a.TUR), masaId: a.MASA_ID ?? null, masaAd: a.MASA_AD ? temiz(a.MASA_AD) : null,
            bolgeId: a.BOLGE_ID ?? null, bolgeAd: a.BOLGE_AD ? temiz(a.BOLGE_AD) : null, durum: Number(a.DURUM), kisiSayisi: a.KISI_SAYISI ?? null, acikDakika: Math.max(0, Number(a.DAKIKA) || 0),
            garsonId: a.GARSON_ID ?? null, garson: a.GARSON ? temiz(a.GARSON) : null, aciklama: a.ACIKLAMA ? temiz(a.ACIKLAMA) : null, servisOrani: a.SERVIS_ORANI === null ? null : Number(a.SERVIS_ORANI),
            surum: Number(a.SURUM), kalemler, toplam: adisyonToplami(kalemler, a.SERVIS_ORANI === null ? null : Number(a.SERVIS_ORANI)),
            // Paket / gel-al (D8)
            musteriAd: a.MUSTERI_AD ? temiz(a.MUSTERI_AD) : null, musteriTel: a.MUSTERI_TEL ? temiz(a.MUSTERI_TEL) : null, musteriAdres: a.MUSTERI_ADRES ? temiz(a.MUSTERI_ADRES) : null,
            paketDurum: a.PAKET_DURUM ?? null,
            // İndirim / yeniden açma (K1)
            indirimTuru: Number(a.INDIRIM_TURU) || 0, indirimDegeri: a.INDIRIM_DEGERI === null || a.INDIRIM_DEGERI === undefined ? 0 : Number(a.INDIRIM_DEGERI),
            indirimNeden: a.INDIRIM_NEDEN ? temiz(a.INDIRIM_NEDEN) : null, indirimYapan: a.INDIRIM_YAPAN ? temiz(a.INDIRIM_YAPAN) : null,
            yenidenAcildi: Number(a.YENIDEN_ACILDI) || 0, yenidenAcan: a.YENIDEN_ACAN ? temiz(a.YENIDEN_ACAN) : null, yenidenNeden: a.YENIDEN_NEDEN ? temiz(a.YENIDEN_NEDEN) : null,
        };
    }
    // ───────────── Sipariş ─────────────
    /**
     * Sipariş gönderme: masada açık adisyon yoksa açılır (masa kilidi altında; iki cihaz aynı anda açsa da tek adisyon), kalemler
     * fiyatı / KDV'si / seçenekleri sunucuda hesaplanarak eklenir. Aynı istek kimliği tekrar gelirse yeni kalem eklenmez, aynı adisyon döner.
     */
    static async siparis(ctx, g, kim) {
        const istekId = temiz(g.istekId);
        if (!/^[A-Za-z0-9_-]{8,64}$/.test(istekId))
            throw ApiError.badRequest("Geçersiz istek kimliği.");
        const kalemler = Array.isArray(g.kalemler) ? g.kalemler : [];
        if (!kalemler.length)
            throw ApiError.badRequest("Sipariş boş.");
        if (kalemler.length > 100)
            throw ApiError.badRequest("Bir siparişte en çok 100 kalem gönderilebilir.");
        if (!g.masaId && !g.adisyonId && !g.paket)
            throw ApiError.badRequest("Masa ya da adisyon seçilmeli.");
        if (g.masaId && g.paket)
            throw ApiError.badRequest("Paket siparişinde masa seçilmez.");
        const paket = !g.masaId && !g.adisyonId && g.paket ? paketMusteriDenetle(g.paket) : null;
        if (paket && "hata" in paket)
            throw ApiError.badRequest(paket.hata);
        if (!kim.yetkiler?.includes("siparis"))
            throw ApiError.forbidden("Sipariş girme yetkiniz yok.");
        const kisi = g.kisi === null || g.kisi === undefined || String(g.kisi) === "" ? null : Number(g.kisi);
        if (kisi !== null && (!Number.isInteger(kisi) || kisi < 1 || kisi > 99))
            throw ApiError.badRequest("Kişi sayısı 1 ile 99 arasında olmalı.");
        const pool = await havuz(ctx);
        const ayar = await AdisyonTanimSqlRepository.ayarlar(ctx, pool);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        let adisyonId;
        let tekrar = false;
        try {
            // 1) Aynı istek daha önce işlendiyse sonucu döner
            const once = await istekOku(tx, istekId);
            if (once) {
                const s = once;
                // Kimlik yalnız AYNI siparişin yeniden gönderimi için geçerli: başka işlemde / başka adisyonda / başka masada kullanılmışsa sessizce "oldu" dönmez
                const ayniHedef = g.adisyonId ? Number(g.adisyonId) === Number(s.adisyonId) : paket ? s.masaId === null || s.masaId === undefined : s.masaId === undefined || Number(s.masaId) === Number(g.masaId);
                if (!s.adisyonId || (s.tur && s.tur !== "siparis") || !ayniHedef)
                    throw ApiError.conflict("Bu istek kimliği başka bir işlemde kullanılmış; ekranı yenileyip yeniden deneyin.");
                adisyonId = Number(s.adisyonId);
                tekrar = true;
            }
            else {
                // 2) Adisyon: verilen kimlik ya da masanın açık adisyonu (yoksa açılır)
                let masaId = null, bolgeListesi = null;
                if (g.adisyonId) {
                    const a = await new sql.Request(tx).input("A", sql.Int, g.adisyonId).query(`SELECT A.ADISYON_ID, A.DURUM, A.MASA_ID, B.FIYAT_LISTESI_ID FROM dbo.TODVZ_ADISYON A WITH (UPDLOCK)
            LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID LEFT JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID WHERE A.ADISYON_ID = @A`);
                    if (!a.recordset.length)
                        throw ApiError.notFound("Adisyon bulunamadı.");
                    if (![ADISYON_DURUM.ACIK, ADISYON_DURUM.HESAP_ISTENDI].includes(a.recordset[0].DURUM))
                        throw ApiError.conflict("Adisyon kapanmış; yeni sipariş eklenemez.");
                    if (g.masaId && Number(a.recordset[0].MASA_ID) !== Number(g.masaId))
                        throw ApiError.conflict("Adisyon bu masaya ait değil (masa taşınmış olabilir); ekranı yenileyin.");
                    adisyonId = Number(g.adisyonId);
                    masaId = a.recordset[0].MASA_ID ?? null;
                    bolgeListesi = a.recordset[0].FIYAT_LISTESI_ID ?? null;
                }
                else if (paket && !("hata" in paket)) {
                    // Paket / gel-al (D8): masa yok, ana fiyat, servis ücreti yok; müşteri bilgisi adisyonda
                    if (!kim.yetkiler?.includes("masa-ac"))
                        throw ApiError.forbidden("Paket / gel-al açma yetkiniz yok.");
                    adisyonId = await this.yeniAdisyon(tx, { tur: paket.tur, masaId: null, kisi: null, servisOrani: null, birimKodu: ayar.birimKodu,
                        musteri: { ad: paket.ad, tel: paket.tel, adres: paket.adres, not: paket.not } }, kim);
                }
                else {
                    masaId = Number(g.masaId);
                    const m = await new sql.Request(tx).input("M", sql.Int, masaId).query(`SELECT M.AKTIF, B.AKTIF AS BAKTIF, B.FIYAT_LISTESI_ID FROM dbo.TODVZ_ADISYON_MASA M JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID WHERE M.MASA_ID = @M`);
                    if (!m.recordset.length)
                        throw ApiError.notFound("Masa bulunamadı.");
                    if (!m.recordset[0].AKTIF || !m.recordset[0].BAKTIF)
                        throw ApiError.badRequest("Masa pasif.");
                    bolgeListesi = m.recordset[0].FIYAT_LISTESI_ID ?? null;
                    // Masa kilidi: iki cihaz aynı boş masaya aynı anda sipariş girse de tek adisyon açılır
                    const kilit = await new sql.Request(tx).input("K", sql.NVarChar(255), `LIKYA_ADISYON_MASA_${masaId}`).query(`DECLARE @r INT;
            EXEC @r = sp_getapplock @Resource = @K, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; SELECT @r AS R;`);
                    if (Number(kilit.recordset[0].R) < 0)
                        throw ApiError.conflict("Masa başka bir cihazda işlemde; biraz sonra tekrar deneyin.");
                    // Masanın açık adisyonu: önce kilitsiz bulunur, sonra YALNIZ o satır kimliğiyle kilitlenip durumu yeniden denetlenir.
                    // (Masa numarasıyla kilitli arama tabloyu tarayıp başka masaların satırına da değer: bir masanın uzun süren tahsilatı
                    // bütün masaların siparişini bekletir. Kimlikle kilit yalnız bu adisyonu bekler; o sırada kapanıyorsa yenisi açılır.)
                    const aday = await new sql.Request(tx).input("M", sql.Int, masaId).query(`SELECT ADISYON_ID FROM dbo.TODVZ_ADISYON WHERE MASA_ID = @M AND DURUM IN (0, 1)`);
                    const acik = aday.recordset.length
                        ? await new sql.Request(tx).input("A", sql.Int, Number(aday.recordset[0].ADISYON_ID)).input("M", sql.Int, masaId)
                            .query(`SELECT ADISYON_ID FROM dbo.TODVZ_ADISYON WITH (UPDLOCK, ROWLOCK) WHERE ADISYON_ID = @A AND MASA_ID = @M AND DURUM IN (0, 1)`)
                        : aday;
                    if (acik.recordset.length)
                        adisyonId = Number(acik.recordset[0].ADISYON_ID);
                    else {
                        if (!kim.yetkiler?.includes("masa-ac"))
                            throw ApiError.forbidden("Masa açma yetkiniz yok; masayı yetkili biri açmalı.");
                        adisyonId = await this.yeniAdisyon(tx, { tur: ADISYON_TUR.MASA, masaId, kisi, servisOrani: ayar.servisAcik ? ayar.servisOrani : null, birimKodu: ayar.birimKodu }, kim);
                    }
                }
                // 3) Kalemler: kartlar, porsiyonlar, seçenek bağları tek seferde okunur
                const kartIdler = [...new Set(kalemler.map((k) => Number(k.stokKartId)).filter((x) => Number.isInteger(x) && x > 0))];
                if (kartIdler.length !== new Set(kalemler.map((k) => Number(k.stokKartId))).size)
                    throw ApiError.badRequest("Siparişte geçersiz ürün var.");
                const kr = await new sql.Request(tx).input("LISTE", sql.Int, bolgeListesi).query(`${KART_SORGUSU(`K.STOK_KART_ID IN (${kartIdler.join(",")})`)};
          SELECT PORSIYON_ID, STOK_KART_ID, AD, CARPAN, FIYAT FROM dbo.TODVZ_ADISYON_PORSIYON WHERE STOK_KART_ID IN (${kartIdler.join(",")});
          SELECT STOK_KART_ID, SG_ID FROM dbo.TODVZ_ADISYON_KART_SECENEK WHERE STOK_KART_ID IN (${kartIdler.join(",")}) ORDER BY STOK_KART_ID, SIRA;`);
                const krs = kr.recordsets;
                const kartlar = new Map(krs[0].map((k) => [Number(k.STOK_KART_ID), k]));
                const tumGruplar = await secenekGruplari(tx);
                const yeniKalemler = [];
                let sira = 0;
                for (const k of kalemler) {
                    sira++;
                    const kart = kartlar.get(Number(k.stokKartId));
                    if (!kart)
                        throw ApiError.badRequest(`${sira}. kalem: ürün bulunamadı.`);
                    const ad = temiz(kart.AD);
                    if (!kart.AKTIF)
                        throw ApiError.badRequest(`${ad}: ürün pasif.`);
                    if (!tlMi(kart.PARA_KODU))
                        throw ApiError.badRequest(`${ad}: adisyonda yalnız TL fiyatlı ürün satılır.`);
                    const tartili = !!tartiBirimi(kart.BIRIM);
                    const mh = siparisMiktariDenetle(k.miktar, tartili);
                    if (mh)
                        throw ApiError.badRequest(`${ad}: ${mh}`);
                    const miktar = Number(String(k.miktar).replace(",", "."));
                    const porsiyonlar = krs[1].filter((p) => Number(p.STOK_KART_ID) === Number(kart.STOK_KART_ID));
                    let porsiyon = null;
                    if (k.porsiyonId) {
                        porsiyon = porsiyonlar.find((p) => Number(p.PORSIYON_ID) === Number(k.porsiyonId));
                        if (!porsiyon)
                            throw ApiError.badRequest(`${ad}: seçilen porsiyon bu ürünün değil (tanım değişmiş olabilir; ekranı yenileyin).`);
                    }
                    else if (porsiyonlar.length)
                        throw ApiError.badRequest(`${ad}: porsiyon seçilmeli.`);
                    const bagli = krs[2].filter((b) => Number(b.STOK_KART_ID) === Number(kart.STOK_KART_ID)).map((b) => Number(b.SG_ID));
                    const secim = secimDenetle(bagli.map((id) => tumGruplar.find((x) => x.sgId === id)).filter(Boolean), k.secenekIdler);
                    if ("hata" in secim)
                        throw ApiError.badRequest(`${ad}: ${secim.hata}`);
                    const kdv = masaKdvOrani(kart.ADISYON_KDV_ORANI, ayar.kdvVarsayilan, Number(kart.KDV_ORANI));
                    const taban = masaTabanFiyati({ satisFiyati: kart.SATIS_FIYATI === null ? null : Number(kart.SATIS_FIYATI), listeFiyati: kart.LISTE_FIYATI === null ? null : Number(kart.LISTE_FIYATI), fiyatKdvDahil: !!kart.FIYAT_KDV_DAHIL }, kdv);
                    if (taban === null)
                        throw ApiError.badRequest(`${ad}: satış fiyatı yok.`);
                    const carpan = porsiyon ? Number(porsiyon.CARPAN) : 1;
                    const birimFiyat = kalemBirimFiyati(taban, carpan, porsiyon && porsiyon.FIYAT !== null ? Number(porsiyon.FIYAT) : null, secim.ekFiyat);
                    const notu = temiz(k.notu).slice(0, 200) || null;
                    const secimJson = secim.secimler.length ? JSON.stringify(secim.secimler) : null;
                    if (secimJson && secimJson.length > 1000)
                        throw ApiError.badRequest(`${ad}: seçenekler çok uzun.`);
                    const yerId = kart.YER_ID ?? null;
                    const ek = await new sql.Request(tx).input("A", sql.Int, adisyonId).input("K", sql.Int, Number(kart.STOK_KART_ID)).input("AD", sql.NVarChar(200), ad.slice(0, 200))
                        .input("M", sql.Decimal(18, 4), miktar).input("B", sql.VarChar(20), (temiz(kart.BIRIM) || "Adet").slice(0, 20))
                        .input("PA", sql.NVarChar(30), porsiyon ? temiz(porsiyon.AD) : null).input("PC", sql.Decimal(9, 4), carpan).input("F", sql.Decimal(18, 4), birimFiyat).input("KDV", sql.Decimal(5, 2), kdv)
                        .input("S", sql.NVarChar(1000), secimJson).input("N", sql.NVarChar(200), notu).input("Y", sql.Int, yerId).input("D", sql.TinyInt, yerId ? KALEM_DURUM.HAZIRLANIYOR : KALEM_DURUM.SERVIS)
                        .input("EG", sql.Int, kim.garsonId ?? null).input("EK", sql.Int, kim.kullaniciId ?? null).input("EA", sql.NVarChar(60), temiz(kim.ad).slice(0, 60) || null)
                        .query(`INSERT INTO dbo.TODVZ_ADISYON_KALEM (ADISYON_ID, STOK_KART_ID, AD, MIKTAR, BIRIM, PORSIYON_AD, PORSIYON_CARPAN, BIRIM_FIYAT, KDV_ORANI, SECENEKLER, NOTU, YER_ID, DURUM,
                EKLEYEN_GARSON_ID, EKLEYEN_KULLANICI_ID, EKLEYEN_AD, GONDERIM_ZAMANI)
              OUTPUT INSERTED.KALEM_ID VALUES (@A, @K, @AD, @M, @B, @PA, @PC, @F, @KDV, @S, @N, @Y, @D, @EG, @EK, @EA, GETDATE())`);
                    yeniKalemler.push(Number(ek.recordset[0].KALEM_ID));
                }
                // Mutfak fişleri (yazıcısı olan yerler) ve mutfak ekranı olayları (TA30, D5) — aynı işlemde: sipariş geri alınırsa fiş de yok
                await AdisyonMutfakSqlRepository.fisleriYaz(tx, adisyonId, yeniKalemler);
                // 4) Adisyon sürümü, kişi sayısı, garson (ilk garson sahiplenir), hesap istendiyse yeniden açık; olay; istek kaydı
                const gun = await new sql.Request(tx).input("A", sql.Int, adisyonId).input("KISI", sql.Int, kisi).input("G", sql.Int, kim.garsonId ?? null)
                    .query(`UPDATE dbo.TODVZ_ADISYON SET SURUM = SURUM + 1, KISI_SAYISI = ISNULL(@KISI, KISI_SAYISI), GARSON_ID = ISNULL(GARSON_ID, @G),
            DURUM = CASE WHEN DURUM = 1 THEN 0 ELSE DURUM END OUTPUT INSERTED.ADISYON_ID WHERE ADISYON_ID = @A AND DURUM IN (0, 1)`);
                // Son güvence: adisyon bu arada kapandıysa / iptal edildiyse kalemler yazılmaz (kapanmış adisyonda fişlenmemiş kalem kalmasın)
                if (!gun.recordset?.length)
                    throw ApiError.conflict("Adisyon bu sırada kapandı; sipariş yazılmadı. Ekranı yenileyip yeniden gönderin."); // hesap istenmişken yeni sipariş: hesap fişi eskidi, masa yeniden açık
                await olayYaz(tx, "siparis", { adisyonId, masaId, veri: { kalem: kalemler.length } });
                await istekYaz(tx, istekId, { adisyonId, tur: "siparis", masaId: g.adisyonId || paket ? null : masaId });
            }
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        if (!tekrar)
            olayTetikle(ctx ?? {});
        return { ...(await this.getir(ctx, adisyonId)), tekrar };
    }
    /** Yeni adisyon (işlem içinde): numara yıl + ön ek başına sıralı (numara kilidi altında), ETTN veritabanında üretilir */
    static async yeniAdisyon(tx, a, kim) {
        const kilit = await new sql.Request(tx).query(`DECLARE @r INT; EXEC @r = sp_getapplock @Resource = 'LIKYA_ADISYON_NO', @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000; SELECT @r AS R;`);
        if (Number(kilit.recordset[0].R) < 0)
            throw ApiError.conflict("Adisyon numarası alınamadı; tekrar deneyin.");
        const yil = Number((await new sql.Request(tx).query(`SELECT YEAR(DATEADD(hour, 3, GETUTCDATE())) AS Y`)).recordset[0].Y);
        const onEk = adisyonNo(a.birimKodu, yil, 1).slice(0, -9);
        const son = await new sql.Request(tx).input("O", sql.VarChar(24), onEk).query(`SELECT MAX(CAST(RIGHT(ADISYON_NO, 9) AS BIGINT)) AS S FROM dbo.TODVZ_ADISYON
      WHERE ADISYON_NO LIKE @O + '%' AND LEN(ADISYON_NO) = LEN(@O) + 9 AND RIGHT(ADISYON_NO, 9) NOT LIKE '%[^0-9]%'`);
        const no = adisyonNo(a.birimKodu, yil, (Number(son.recordset[0].S) || 0) + 1);
        const r = await new sql.Request(tx).input("NO", sql.VarChar(24), no).input("T", sql.TinyInt, a.tur).input("M", sql.Int, a.masaId).input("KISI", sql.Int, a.kisi)
            .input("G", sql.Int, kim.garsonId ?? null).input("K", sql.Int, kim.kullaniciId ?? null).input("S", sql.Decimal(5, 2), a.servisOrani)
            .input("MA", sql.NVarChar(100), a.musteri?.ad ?? null).input("MT", sql.VarChar(30), a.musteri?.tel ?? null).input("MD", sql.NVarChar(400), a.musteri?.adres ?? null)
            .input("PD", sql.TinyInt, a.musteri ? 1 : null).input("AC", sql.NVarChar(250), a.musteri?.not ?? null)
            .query(`INSERT INTO dbo.TODVZ_ADISYON (ADISYON_NO, TUR, MASA_ID, DURUM, KISI_SAYISI, ACAN_GARSON_ID, ACAN_KULLANICI_ID, GARSON_ID, SERVIS_ORANI, MUSTERI_AD, MUSTERI_TEL, MUSTERI_ADRES, PAKET_DURUM, ACIKLAMA)
        OUTPUT INSERTED.ADISYON_ID VALUES (@NO, @T, @M, 0, @KISI, @G, @K, @G, @S, @MA, @MT, @MD, @PD, @AC)`);
        const id = Number(r.recordset[0].ADISYON_ID);
        await olayYaz(tx, "acildi", { adisyonId: id, masaId: a.masaId, veri: a.musteri ? { tur: a.tur, musteri: a.musteri.ad } : undefined });
        return id;
    }
    /** Kişi sayısı (masa açıkken) */
    static async kisiGuncelle(ctx, adisyonId, kisi) {
        const k = Number(kisi);
        if (!Number.isInteger(k) || k < 1 || k > 99)
            throw ApiError.badRequest("Kişi sayısı 1 ile 99 arasında olmalı.");
        const pool = await havuz(ctx);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            const a = await new sql.Request(tx).input("A", sql.Int, adisyonId).input("K", sql.Int, k).query(`UPDATE dbo.TODVZ_ADISYON SET KISI_SAYISI = @K, SURUM = SURUM + 1
        OUTPUT INSERTED.MASA_ID WHERE ADISYON_ID = @A AND DURUM IN (0, 1)`);
            if (!a.recordset.length)
                throw ApiError.conflict("Adisyon bulunamadı ya da kapanmış.");
            await olayYaz(tx, "guncelle", { adisyonId, masaId: a.recordset[0].MASA_ID ?? null });
            await tx.commit();
        }
        catch (e) {
            await tx.rollback().catch(() => undefined);
            throw e;
        }
        olayTetikle(ctx ?? {});
        return this.getir(ctx, adisyonId);
    }
}

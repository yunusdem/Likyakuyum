import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { DbBaglam } from "./ticariStokSql.repository.js";
import { AdisyonTanimSqlRepository } from "./adisyonTanimSql.repository.js";

/**
 * Adisyon raporu / gün sonu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA40, D10). Para tarafı adisyon fişlerinden (TODVZ_ADISYON_FIS →
 * Ticari satış fişi) ve Ticari gün sonuyla aynı gün kuralıyla: Türkiye günü = CAST(DATEADD(hour, 3, F.TARIH) AS date). Ciro = Σ fiş;
 * ürün satışı + servis ücreti + e-Belge yuvarlaması = ciro. İkram / iptal ve iptal edilen adisyonlar adisyonun kapanış gününe
 * (sunucu saati UTC'ye çevrilip +3) göre; açık adisyonlar o anki durum (gün sonu uyarısı).
 */
const temiz = (v: unknown) => String(v ?? "").trim();
const y2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const havuz = (ctx?: DbBaglam) => AdisyonTanimSqlRepository.havuz(ctx);
/**
 * Gün sınırları (M9, 26.11.2026 denetimi): sütuna fonksiyon uygulanınca (CAST(DATEADD(.. F.TARIH))) indeks kullanılamıyor, bütün fiş
 * tablosu taranıyordu. Türkiye günü [@BAS, @BIT] → fiş saatiyle (UTC) [@FB, @FS), sunucu saatiyle yazılmış zamanlar için [@SB, @SS).
 */
const SINIRLAR = `DECLARE @FB DATETIME = DATEADD(hour, -3, CAST(CAST(@BAS AS date) AS datetime)), @FS DATETIME = DATEADD(hour, -3, DATEADD(day, 1, CAST(CAST(@BIT AS date) AS datetime)));
      DECLARE @OFS INT = DATEDIFF(minute, GETUTCDATE(), GETDATE());
      DECLARE @SB DATETIME = DATEADD(minute, @OFS, @FB), @SS DATETIME = DATEADD(minute, @OFS, @FS);`;
/**
 * Açık adisyonun ödenecek kalanı (P12): masa kutusuyla aynı — fişlenmemiş ürünler + servis − indirim − bekleyen ara ödemeler.
 * (Eskiden servis, indirim ve ara ödeme hesaba katılmadan yalnız ürün toplamı yazılıyordu.)
 */
const ACIK_KALAN = `OUTER APPLY (SELECT SUM(CASE WHEN K.IKRAM = 0 AND K.IPTAL = 0 AND K.FATURA_ID IS NULL THEN ROUND(K.MIKTAR * K.BIRIM_FIYAT, 2) ELSE 0 END) AS ARA,
          SUM(CASE WHEN K.IPTAL = 0 THEN 1 ELSE 0 END) AS KALEM FROM dbo.TODVZ_ADISYON_KALEM K WHERE K.ADISYON_ID = A.ADISYON_ID) T
      OUTER APPLY (SELECT ISNULL(SUM(O.TUTAR), 0) AS ODENEN FROM dbo.TODVZ_ADISYON_ODEME O WHERE O.ADISYON_ID = A.ADISYON_ID AND O.FATURA_ID IS NULL) OD`;
const ACIK_KOLON = `ISNULL(T.ARA, 0) AS ARA, A.SERVIS_ORANI, A.INDIRIM_TURU, A.INDIRIM_DEGERI, OD.ODENEN`;
/** masalar() kutusundaki hesapla aynı */
const acikKalan = (x: any) => {
  const ara = y2(Number(x.ARA) || 0);
  const servis = Number(x.SERVIS_ORANI) > 0 ? y2((ara * Number(x.SERVIS_ORANI)) / 100) : 0;
  const brut = y2(ara + servis);
  const indirim = Number(x.INDIRIM_TURU) === 1 ? y2((brut * Number(x.INDIRIM_DEGERI)) / 100) : Number(x.INDIRIM_TURU) === 2 ? Math.min(brut, Number(x.INDIRIM_DEGERI) || 0) : 0;
  return Math.max(0, y2(brut - indirim - (Number(x.ODENEN) || 0)));
};
const TUR_ADI: Record<number, string> = { 1: "Masa", 2: "Paket", 3: "Gel-al", 4: "Tezgah" };
const ARAC_ADI: Record<number, string> = { 0: "Nakit", 1: "Cari (veresiye)", 2: "Kredi kartı", 3: "Havale / EFT" };
/** Gerçek bir takvim günü mü (M15: "2026-13-45" biçime uyuyordu, SQL'de CAST hatası → 500) */
const gunMu = (v: unknown) => {
  const t = String(v ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return false;
  const d = new Date(`${t}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === t && t >= "2000-01-01" && t <= "2099-12-31";
};
const yerAdi = (tur: number, masa: unknown, musteri: unknown) => (tur === 1 ? `Masa ${temiz(masa)}` : `${TUR_ADI[tur] || "Paket"}${musteri ? ` · ${temiz(musteri)}` : ""}`);

export class AdisyonRaporSqlRepository {
  static async rapor(ctx: DbBaglam | undefined, g: { baslangic?: unknown; bitis?: unknown }) {
    if (!gunMu(g.baslangic) || !gunMu(g.bitis)) throw ApiError.badRequest("Tarih aralığı YYYY-AA-GG biçiminde olmalı.");
    if (String(g.baslangic) > String(g.bitis)) throw ApiError.badRequest("Başlangıç bitişten sonra olamaz.");
    const gun = (Date.parse(String(g.bitis)) - Date.parse(String(g.baslangic))) / 86400000;
    if (gun > 370) throw ApiError.badRequest("Rapor en çok bir yıllık olabilir.");
    const pool = await havuz(ctx);
    const r = await pool.request().input("BAS", sql.VarChar(10), String(g.baslangic)).input("BIT", sql.VarChar(10), String(g.bitis)).query(`
      ${SINIRLAR}
      -- Dönemin adisyon fişleri
      DECLARE @F TABLE (FATURA_ID INT PRIMARY KEY, ADISYON_ID INT, GENEL_TOPLAM DECIMAL(19, 4));
      INSERT @F SELECT F.FATURA_ID, AF.ADISYON_ID, F.GENEL_TOPLAM FROM dbo.TODVZ_ADISYON_FIS AF JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID = AF.FATURA_ID
        WHERE F.TARIH >= @FB AND F.TARIH < @FS;
      -- 0) adisyon bazında: ciro, servis (fişin kartsız "Servis ücreti" satırları; tek gruplamayla — eskiden adisyon başına bütün @F taranıyordu), tür, garson, kişi, süre
      SELECT A.ADISYON_ID, A.TUR, A.KISI_SAYISI, A.GARSON_ID, RTRIM(G.AD) AS GARSON, A.DURUM,
        DATEDIFF(SECOND, A.ACILIS_ZAMANI, A.KAPANIS_ZAMANI) / 60 AS SURE, X.CIRO, X.FIS, ISNULL(S.SERVIS, 0) AS SERVIS
      FROM (SELECT ADISYON_ID, SUM(GENEL_TOPLAM) AS CIRO, COUNT(*) AS FIS FROM @F GROUP BY ADISYON_ID) X
      JOIN dbo.TODVZ_ADISYON A ON A.ADISYON_ID = X.ADISYON_ID
      LEFT JOIN dbo.TODVZ_ADISYON_GARSON G ON G.GARSON_ID = A.GARSON_ID
      LEFT JOIN (SELECT F2.ADISYON_ID, SUM(FS.TOPLAM_TUTAR) AS SERVIS FROM @F F2 JOIN dbo.TODVZ_FATURA_SATIRI FS ON FS.FATURA_ID = F2.FATURA_ID
        WHERE FS.STOK_KART_ID IS NULL AND FS.URUN_ADI LIKE N'Servis ücreti%' GROUP BY F2.ADISYON_ID) S ON S.ADISYON_ID = A.ADISYON_ID;
      -- 1) ödeme türleri
      SELECT O.ODEME_ARACI_TURU AS ARAC, SUM(O.TUTAR) AS TUTAR FROM dbo.TODVZ_FATURA_ODEME O JOIN @F F ON F.FATURA_ID = O.FATURA_ID GROUP BY O.ODEME_ARACI_TURU;
      -- 2) ürünler (fişlenmiş kalemler; ikram ayrı)
      SELECT K.STOK_KART_ID, RTRIM(K.AD) AS AD, K.PORSIYON_AD, RTRIM(K.BIRIM) AS BIRIM,
        SUM(CASE WHEN K.IKRAM = 0 THEN K.MIKTAR ELSE 0 END) AS MIKTAR, SUM(CASE WHEN K.IKRAM = 0 THEN ROUND(K.MIKTAR * K.BIRIM_FIYAT, 2) ELSE 0 END) AS TUTAR,
        SUM(CASE WHEN K.IKRAM = 1 THEN K.MIKTAR ELSE 0 END) AS IKRAM_MIKTAR, SUM(CASE WHEN K.IKRAM = 1 THEN ROUND(K.MIKTAR * K.BIRIM_FIYAT, 2) ELSE 0 END) AS IKRAM_DEGER
      FROM dbo.TODVZ_ADISYON_KALEM K JOIN @F F ON F.FATURA_ID = K.FATURA_ID WHERE K.IPTAL = 0
      GROUP BY K.STOK_KART_ID, RTRIM(K.AD), K.PORSIYON_AD, RTRIM(K.BIRIM) ORDER BY SUM(CASE WHEN K.IKRAM = 0 THEN ROUND(K.MIKTAR * K.BIRIM_FIYAT, 2) ELSE 0 END) DESC, RTRIM(K.AD);
      -- 3) ikram / iptal kalemleri: dönemde kapanan (ödendi / iptal) adisyonların
      SELECT K.KALEM_ID, K.IKRAM, K.IPTAL, RTRIM(K.AD) AS AD, K.PORSIYON_AD, K.MIKTAR, RTRIM(K.BIRIM) AS BIRIM, ROUND(K.MIKTAR * K.BIRIM_FIYAT, 2) AS DEGER, K.NEDEN, K.ISLEM_YAPAN, K.EKLEYEN_AD,
        RTRIM(A.ADISYON_NO) AS ADISYON_NO, A.TUR, RTRIM(M.AD) AS MASA, A.MUSTERI_AD, A.GARSON_ID, CONVERT(varchar(16), A.KAPANIS_ZAMANI, 120) AS ZAMAN
      FROM dbo.TODVZ_ADISYON_KALEM K JOIN dbo.TODVZ_ADISYON A ON A.ADISYON_ID = K.ADISYON_ID LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID
      WHERE (K.IKRAM = 1 OR K.IPTAL = 1) AND A.DURUM IN (2, 9) AND A.KAPANIS_ZAMANI >= @SB AND A.KAPANIS_ZAMANI < @SS
      ORDER BY A.KAPANIS_ZAMANI, K.KALEM_ID;
      -- 4) iptal edilen (birleşme dışı) adisyonlar
      SELECT COUNT(*) AS SAYI FROM dbo.TODVZ_ADISYON A WHERE A.DURUM = 9 AND A.BIRLESTIGI_ADISYON_ID IS NULL
        AND A.KAPANIS_ZAMANI >= @SB AND A.KAPANIS_ZAMANI < @SS;
      -- 5) açık adisyonlar (o an)
      SELECT A.ADISYON_ID, RTRIM(A.ADISYON_NO) AS NO, A.TUR, RTRIM(M.AD) AS MASA, A.MUSTERI_AD, RTRIM(G.AD) AS GARSON, A.DURUM,
        DATEDIFF(SECOND, A.ACILIS_ZAMANI, GETDATE()) / 60 AS DAKIKA, T.KALEM, ${ACIK_KOLON}
      FROM dbo.TODVZ_ADISYON A LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID LEFT JOIN dbo.TODVZ_ADISYON_GARSON G ON G.GARSON_ID = A.GARSON_ID
      ${ACIK_KALAN}
      WHERE A.DURUM IN (0, 1) ORDER BY A.ACILIS_ZAMANI;
      -- 6) garson adları (ikram / iptal tablosu ve servis dağıtımı için) ve etkin garson sayısı
      SELECT GARSON_ID, RTRIM(AD) AS AD, AKTIF FROM dbo.TODVZ_ADISYON_GARSON;
      -- 7) P11: dönemde kesilen satış iadeleri (asıl fişi adisyon fişi olanlar) — ciro ve ödeme türlerinden düşülür
      DECLARE @I TABLE (FATURA_ID INT PRIMARY KEY, GENEL_TOPLAM DECIMAL(19, 4));
      IF OBJECT_ID('dbo.TODVZ_TICARI_IADE', 'U') IS NOT NULL
        INSERT @I SELECT F.FATURA_ID, F.GENEL_TOPLAM FROM dbo.TODVZ_TICARI_IADE TI JOIN dbo.TODVZ_ADISYON_FIS AF ON AF.FATURA_ID = TI.ASIL_FATURA_ID
          JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID = TI.IADE_FATURA_ID WHERE F.TARIH >= @FB AND F.TARIH < @FS;
      SELECT COUNT(*) AS SAYI, ISNULL(SUM(GENEL_TOPLAM), 0) AS TUTAR FROM @I;
      SELECT O.ODEME_ARACI_TURU AS ARAC, SUM(O.TUTAR) AS TUTAR FROM dbo.TODVZ_FATURA_ODEME O JOIN @I I ON I.FATURA_ID = O.FATURA_ID GROUP BY O.ODEME_ARACI_TURU;`);
    const rs = r.recordsets as any[];
    const adisyonlar = rs[0].map((x: any) => ({ id: Number(x.ADISYON_ID), tur: Number(x.TUR), kisi: x.KISI_SAYISI ?? null, garsonId: x.GARSON_ID ?? null, garson: x.GARSON ? temiz(x.GARSON) : null,
      durum: Number(x.DURUM), sure: x.SURE === null ? null : Number(x.SURE), ciro: y2(Number(x.CIRO)), fis: Number(x.FIS), servis: y2(Number(x.SERVIS)) }));
    const ciro = y2(adisyonlar.reduce((t: number, a: any) => t + a.ciro, 0));
    const servis = y2(adisyonlar.reduce((t: number, a: any) => t + a.servis, 0));
    const urunler = rs[2].map((x: any) => ({ stokKartId: x.STOK_KART_ID ?? null, ad: `${temiz(x.AD)}${x.PORSIYON_AD ? ` (${temiz(x.PORSIYON_AD)})` : ""}`, birim: temiz(x.BIRIM) || "Adet",
      miktar: Math.round(Number(x.MIKTAR) * 10000) / 10000, tutar: y2(Number(x.TUTAR)), ikramMiktar: Math.round(Number(x.IKRAM_MIKTAR) * 10000) / 10000, ikramDeger: y2(Number(x.IKRAM_DEGER)) }));
    const urunSatis = y2(urunler.reduce((t: number, u: any) => t + u.tutar, 0));
    const ikramlar = rs[3].map((x: any) => ({ tur: x.IPTAL ? "iptal" as const : "ikram" as const, ad: `${temiz(x.AD)}${x.PORSIYON_AD ? ` (${temiz(x.PORSIYON_AD)})` : ""}`,
      miktar: Number(x.MIKTAR), birim: temiz(x.BIRIM), deger: y2(Number(x.DEGER)), neden: x.NEDEN ? temiz(x.NEDEN) : "", yapan: x.ISLEM_YAPAN ? temiz(x.ISLEM_YAPAN) : null,
      ekleyen: x.EKLEYEN_AD ? temiz(x.EKLEYEN_AD) : null, adisyonNo: temiz(x.ADISYON_NO), yer: yerAdi(Number(x.TUR), x.MASA, x.MUSTERI_AD), zaman: temiz(x.ZAMAN), garsonId: x.GARSON_ID ?? null }));
    // Neden: "Müşteri vazgeçti: açıklama" → listedeki neden ("Diğer: …" → Diğer)
    const nedenAnahtari = (n: string) => (n.includes(":") ? n.slice(0, n.indexOf(":")).trim() : n) || "—";
    const nedenler = new Map<string, { tur: "ikram" | "iptal"; neden: string; adet: number; deger: number }>();
    for (const k of ikramlar) {
      const a = `${k.tur}|${nedenAnahtari(k.neden)}`;
      const v = nedenler.get(a) || { tur: k.tur, neden: nedenAnahtari(k.neden), adet: 0, deger: 0 };
      v.adet++; v.deger = y2(v.deger + k.deger); nedenler.set(a, v);
    }
    const garsonAdi = new Map<number, string>(rs[6].map((x: any) => [Number(x.GARSON_ID), temiz(x.AD)]));
    const garsonlar = new Map<string, { garsonId: number | null; ad: string; adisyon: number; ciro: number; servis: number; ikram: number; iptal: number }>();
    const gk = (id: number | null) => { const k = id ? String(id) : "kasa"; if (!garsonlar.has(k)) garsonlar.set(k, { garsonId: id, ad: id ? garsonAdi.get(id) || `Garson ${id}` : "Kasa", adisyon: 0, ciro: 0, servis: 0, ikram: 0, iptal: 0 }); return garsonlar.get(k)!; };
    for (const a of adisyonlar) { const v = gk(a.garsonId); v.adisyon++; v.ciro = y2(v.ciro + a.ciro); v.servis = y2(v.servis + a.servis); }
    for (const k of ikramlar) { const v = gk(k.garsonId); if (k.tur === "ikram") v.ikram++; else v.iptal++; }
    const masalar = adisyonlar.filter((a: any) => a.tur === 1);
    const kisi = masalar.reduce((t: number, a: any) => t + (Number(a.kisi) || 0), 0);
    const kisiCirosu = y2(masalar.filter((a: any) => Number(a.kisi) > 0).reduce((t: number, a: any) => t + a.ciro, 0));
    const sureler = masalar.filter((a: any) => a.durum === 2 && a.sure !== null).map((a: any) => a.sure as number);
    const acik = rs[5].map((x: any) => ({ adisyonId: Number(x.ADISYON_ID), adisyonNo: temiz(x.NO), tur: Number(x.TUR), yer: yerAdi(Number(x.TUR), x.MASA, x.MUSTERI_AD), garson: x.GARSON ? temiz(x.GARSON) : null,
      hesapIstendi: Number(x.DURUM) === 1, dakika: Math.max(0, Number(x.DAKIKA) || 0), tutar: acikKalan(x), kalem: Number(x.KALEM) || 0 }));
    // İndirimli açık adisyonlarda ödeme ekranıyla birebir kalan (masa kutusuyla aynı)
    const indirimliler = rs[5].filter((x: any) => x.INDIRIM_TURU).map((x: any) => Number(x.ADISYON_ID));
    if (indirimliler.length) {
      const { AdisyonHesapSqlRepository } = await import("./adisyonHesapSql.repository.js");
      const kalan = await AdisyonHesapSqlRepository.indirimliKalanlar(ctx, indirimliler);
      for (const a of acik) if (kalan.has(a.adisyonId)) a.tutar = kalan.get(a.adisyonId)!;
    }
    // P11: iadeler (asıl fişi adisyon fişi) — tutarı mutlak değerle düşülür
    const iadeSayi = Number(rs[7]?.[0]?.SAYI) || 0, iade = y2(Math.abs(Number(rs[7]?.[0]?.TUTAR) || 0));
    const iadeArac = new Map<number, number>((rs[8] || []).map((x: any) => [Number(x.ARAC), y2(Math.abs(Number(x.TUTAR) || 0))]));
    const odemeTurleri = new Map<number, number>();
    for (const x of rs[1]) odemeTurleri.set(Number(x.ARAC), y2(Number(x.TUTAR)));
    for (const [a, t] of iadeArac) odemeTurleri.set(a, y2((odemeTurleri.get(a) || 0) - t));
    const turler = [1, 2, 3, 4].map((t) => { const l = adisyonlar.filter((a: any) => a.tur === t); return { tur: t, ad: TUR_ADI[t], adisyon: l.length, ciro: y2(l.reduce((s: number, a: any) => s + a.ciro, 0)) }; }).filter((x) => x.adisyon > 0);
    return {
      donem: { baslangic: String(g.baslangic), bitis: String(g.bitis) },
      ozet: {
        adisyon: adisyonlar.length, fis: adisyonlar.reduce((t: number, a: any) => t + a.fis, 0), iptalAdisyon: Number(rs[4][0]?.SAYI) || 0, ciro, urunSatis, servis, yuvarlama: y2(ciro - urunSatis - servis),
        iade, iadeSayi, netCiro: y2(ciro - iade),
        ortalama: adisyonlar.length ? y2(ciro / adisyonlar.length) : 0, kisi, kisiBasi: kisi ? y2(kisiCirosu / kisi) : 0,
        ortalamaSure: sureler.length ? Math.round(sureler.reduce((t: number, s: number) => t + s, 0) / sureler.length) : null,
        ikramDegeri: y2(ikramlar.filter((k: any) => k.tur === "ikram").reduce((t: number, k: any) => t + k.deger, 0)),
        iptalDegeri: y2(ikramlar.filter((k: any) => k.tur === "iptal").reduce((t: number, k: any) => t + k.deger, 0)),
      },
      turler,
      // Ödeme türleri iadeler düşülmüş (net): kasadan çıkan para ödeme türünden düşer
      odemeler: [...odemeTurleri.entries()].map(([arac, tutar]) => ({ arac, ad: ARAC_ADI[arac] || `Tür ${arac}`, tutar })).sort((a: any, b: any) => a.arac - b.arac),
      urunler,
      garsonlar: [...garsonlar.values()].sort((a, b) => b.ciro - a.ciro || a.ad.localeCompare(b.ad, "tr")),
      ikramIptal: { satirlar: ikramlar.map(({ garsonId, ...k }: any) => k), nedenler: [...nedenler.values()].sort((a, b) => (a.tur === b.tur ? b.deger - a.deger : a.tur === "ikram" ? -1 : 1)) },
      // İş K. 51: servis ücreti çalışanlara eşit dağıtılır — toplam ve etkin garson sayısı (ekranda çalışan sayısı değiştirilebilir)
      servisDagitimi: { toplam: servis, etkinGarson: rs[6].filter((x: any) => !!x.AKTIF).length, toplayan: [...garsonlar.values()].filter((v) => v.servis > 0).map((v) => ({ ad: v.ad, toplanan: v.servis })) },
      acik: { sayi: acik.length, tutar: y2(acik.reduce((t: number, a: any) => t + a.tutar, 0)), liste: acik },
    };
  }

  /** Gün sonu uyarısı için açık adisyon özeti (Ticari gün sonu ekranı da kullanır) */
  static async acikOzet(ctx?: DbBaglam) {
    const pool = await havuz(ctx);
    const r = await pool.request().query(`SELECT A.ADISYON_ID, ${ACIK_KOLON} FROM dbo.TODVZ_ADISYON A
      ${ACIK_KALAN}
      WHERE A.DURUM IN (0, 1)`);
    const indirimliler = r.recordset.filter((x: any) => x.INDIRIM_TURU).map((x: any) => Number(x.ADISYON_ID));
    const kalan = indirimliler.length ? await (await import("./adisyonHesapSql.repository.js")).AdisyonHesapSqlRepository.indirimliKalanlar(ctx, indirimliler) : new Map<number, number>();
    return { sayi: r.recordset.length, tutar: y2(r.recordset.reduce((t: number, x: any) => t + (kalan.get(Number(x.ADISYON_ID)) ?? acikKalan(x)), 0)) };
  }

  /** Bir günün kapanan (ödenmiş) adisyonları — "Yeniden aç" için (yönetici); en çok 300 */
  static async kapananlar(ctx: DbBaglam | undefined, gun: unknown) {
    const g = gunMu(gun) ? String(gun) : new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
    const pool = await AdisyonTanimSqlRepository.havuz(ctx);
    // Gün, raporla aynı kuralla Türkiye günüdür (eskiden sunucu saatinin günü: rapor ile liste farklı günleri gösterebiliyordu)
    const r = await pool.request().input("BAS", sql.VarChar(10), g).input("BIT", sql.VarChar(10), g).query(`${SINIRLAR}
      SELECT TOP 300 A.ADISYON_ID, RTRIM(A.ADISYON_NO) AS NO, A.TUR, RTRIM(M.AD) AS MASA, A.MUSTERI_AD, A.KAPANIS_ZAMANI, A.YENIDEN_ACILDI, RTRIM(G.AD) AS GARSON,
        (SELECT ISNULL(SUM(F.GENEL_TOPLAM), 0) FROM dbo.TODVZ_ADISYON_FIS AF JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID = AF.FATURA_ID WHERE AF.ADISYON_ID = A.ADISYON_ID) AS TOPLAM,
        (SELECT COUNT(*) FROM dbo.TODVZ_ADISYON_FIS AF JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID = AF.FATURA_ID WHERE AF.ADISYON_ID = A.ADISYON_ID AND ISNULL(F.E_BELGE_DURUMU, 0) IN (1, 2)) AS GONDERILEN
      FROM dbo.TODVZ_ADISYON A LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID LEFT JOIN dbo.TODVZ_ADISYON_GARSON G ON G.GARSON_ID = A.GARSON_ID
      WHERE A.DURUM = 2 AND A.KAPANIS_ZAMANI >= @SB AND A.KAPANIS_ZAMANI < @SS ORDER BY A.KAPANIS_ZAMANI DESC`);
    return { gun: g, adisyonlar: r.recordset.map((x: any) => ({ adisyonId: Number(x.ADISYON_ID), adisyonNo: String(x.NO || "").trim(), tur: Number(x.TUR), masa: x.MASA ? String(x.MASA).trim() : null,
      musteri: x.MUSTERI_AD ? String(x.MUSTERI_AD).trim() : null, kapanis: x.KAPANIS_ZAMANI, garson: x.GARSON ? String(x.GARSON).trim() : null, toplam: Number(x.TOPLAM) || 0,
      yenidenAcildi: Number(x.YENIDEN_ACILDI) || 0, acilabilir: !Number(x.GONDERILEN) })) };
  }
}

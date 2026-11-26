import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { birimKoduTicari, iadeSatirTutari } from "../services/ticari/ticariHesap.js";
import { DbBaglam, STOK_BELGE, TicariStokSqlRepository, stokIslemKilidi } from "./ticariStokSql.repository.js";
import { EVRAK_TURU_PERAKENDE, gibeGonderildiyseEngelle } from "./ebelgeGonderimKilidi.js";
import { FIS_KAYNAGI_TICARI, ODEME_VEZNE_GERI_AL, TicariSatisOdemeGirdi, TicariSatisSqlRepository, odemeleriYaz, vezneyeIsle } from "./ticariSatisSql.repository.js";

/**
 * Ticari satış iadesi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA6). İade fişi asıl satış fişinden seçilerek kesilir:
 *   - TODVZ_FATURA'ya FIS_KAYNAGI = 1, FATURA_TIPI = 2 (vezne / cari / POS rapor kaynakları tip 2'yi iade yönünde sayar);
 *   - satır başına iade miktarı ≤ satılan − önceki iadeler (TODVZ_TICARI_IADE_SATIR bağıyla);
 *   - iade tutarı asıl satırın saklı matrah / KDV'sinden miktarla orantılı; satırın son iadesi kalanı alır (iadelerin toplamı
 *     müşterinin ödediğine kuruşu kuruşuna eşit; iskontolar dahil);
 *   - stok hareket defterine GİRİŞ (BELGE_TURU 2, belge fatura); para iadesi nakit / cari / banka / POS (kayıt);
 *   - numara ayrı seriden (IAD + yıl + 9 hane): e-Arşiv serisinde boşluk açılmaz;
 *   - e-Belge Kaynak listesine düşmez; asıl fiş e-Arşiv gitmişse e-Gider Pusulası (iade) taslağı verilir (gönderim elle).
 */

export interface TicariIadeGirdi {
  asilFaturaId: number;
  vezneId?: number | null;
  tarih?: string | null;
  neden?: string | null;
  satirlar: { asilSatirNo: number; miktar: number | string }[];
  odemeler?: TicariSatisOdemeGirdi[];
}

const temiz = (v: unknown): string => String(v ?? "").trim();
const sayi = (v: unknown): number => {
  if (typeof v === "string") v = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const yuvarla = (n: number, h: number) => Math.round((n + Number.EPSILON) * 10 ** h) / 10 ** h;
const istanbulGunu = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

/** Asıl fişin başlığı + satırları (iade edilmiş miktarlarıyla) */
async function kaynakOku(r: sql.ConnectionPool | sql.Transaction, asilId: number, kilit = false) {
  const b = await new sql.Request(r as any).input("ID", sql.Int, asilId).query(`
    SELECT F.FATURA_ID, RTRIM(F.FATURA_NO) AS FATURA_NO, F.TARIH, ISNULL(F.FATURA_TIPI, 1) AS FATURA_TIPI, ISNULL(F.FIS_KAYNAGI, 0) AS K,
      F.ALICI_VKN_TCKN, F.ALICI_UNVAN, F.CARI_KART_ID, RTRIM(C.KOD) AS CARI_KOD, C.AD AS CARI_AD, F.VEZNE_ID, ISNULL(F.E_BELGE_DURUMU, 0) AS D,
      CAST(F.ETTN AS varchar(50)) AS ETTN, F.GENEL_TOPLAM, F.SENARYO, F.ADRES, F.IL, F.ILCE, F.VERGI_DAIRESI, F.EPOSTA, F.TELEFON
    FROM dbo.TODVZ_FATURA F ${kilit ? "WITH (UPDLOCK, HOLDLOCK)" : ""} LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID = F.CARI_KART_ID
    WHERE F.FATURA_ID = @ID`);
  const f = b.recordset[0];
  if (!f) throw ApiError.notFound("Satış fişi bulunamadı.");
  if (Number(f.K) !== FIS_KAYNAGI_TICARI) throw ApiError.badRequest("Bu fiş Ticari satış fişi değil.");
  if (Number(f.FATURA_TIPI) !== 1) throw ApiError.badRequest(`${temiz(f.FATURA_NO)} bir iade fişidir; iadesi alınamaz.`);
  const s = await new sql.Request(r as any).input("ID", sql.Int, asilId).query(`
    SELECT S.SATIR_NO, S.STOK_KART_ID, RTRIM(K.KOD) AS KOD, S.URUN_ADI, S.BIRIM, S.KDV_ORANI, S.MIKTAR, S.TOPLAM_TUTAR,
      S.BIRIM_FIYAT, ISNULL(S.TUTAR, 0) - ISNULL(S.SATIR_ISKONTO_TUTARI, 0) AS MATRAH, ISNULL(S.KDV_TUTARI, 0) AS KDV,
      ISNULL(P.M, 0) AS IADE, ISNULL(P.MT, 0) AS IADE_MATRAH, ISNULL(P.KD, 0) AS IADE_KDV
    FROM dbo.TODVZ_FATURA_SATIRI S LEFT JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = S.STOK_KART_ID
    OUTER APPLY (SELECT SUM(IS2.MIKTAR) AS M, SUM(ISNULL(IS2.TUTAR, 0) - ISNULL(IS2.SATIR_ISKONTO_TUTARI, 0)) AS MT, SUM(ISNULL(IS2.KDV_TUTARI, 0)) AS KD
      FROM dbo.TODVZ_TICARI_IADE_SATIR X
      JOIN dbo.TODVZ_TICARI_IADE I ON I.IADE_FATURA_ID = X.IADE_FATURA_ID
      JOIN dbo.TODVZ_FATURA_SATIRI IS2 ON IS2.FATURA_ID = X.IADE_FATURA_ID AND IS2.SATIR_NO = X.IADE_SATIR_NO
      WHERE I.ASIL_FATURA_ID = @ID AND X.ASIL_SATIR_NO = S.SATIR_NO) P
    WHERE S.FATURA_ID = @ID ORDER BY S.SATIR_NO`);
  const satirlar = s.recordset.map((x: any) => {
    const satilan = Number(x.MIKTAR) || 0;
    const iade = yuvarla(Number(x.IADE) || 0, 4);
    return {
      satirNo: Number(x.SATIR_NO),
      stokKartId: x.STOK_KART_ID ?? null,
      kod: x.KOD ? temiz(x.KOD) : null,
      ad: temiz(x.URUN_ADI),
      birim: temiz(x.BIRIM) || "Adet",
      kdvOrani: Number(x.KDV_ORANI) || 0,
      satilan,
      iadeEdilen: iade,
      kalan: Math.max(0, yuvarla(satilan - iade, 4)),
      /** Müşterinin ödediği net KDV dahil birim fiyat (satır + fiş iskontosu düşülmüş; ekranda gösterim) */
      netBirimFiyat: satilan > 0 ? yuvarla((Number(x.TOPLAM_TUTAR) || 0) / satilan, 6) : 0,
      /** İade tutarı paylaştırması için (iadeSatirTutari): asıl satırın saklı tutarları ve önceki iadelerin toplamı */
      asil: { miktar: satilan, matrah: Number(x.MATRAH) || 0, kdv: Number(x.KDV) || 0, birimFiyat: Number(x.BIRIM_FIYAT) || 0, kdvOrani: Number(x.KDV_ORANI) || 0 },
      onceki: { miktar: iade, matrah: Number(x.IADE_MATRAH) || 0, kdv: Number(x.IADE_KDV) || 0 },
    };
  });
  return { f, satirlar };
}

export class TicariIadeSqlRepository {
  /** İade penceresi: asıl fiş + satırlar (satılan / iade edilen / kalan / net fiyat) + önceki iadeler */
  static async kaynak(asilId: number, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const { f, satirlar } = await kaynakOku(pool, asilId);
    const onceki = await pool.request().input("ID", sql.Int, asilId).query(`
      SELECT I.IADE_FATURA_ID, RTRIM(F.FATURA_NO) AS FATURA_NO, F.TARIH, F.GENEL_TOPLAM FROM dbo.TODVZ_TICARI_IADE I
      JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID = I.IADE_FATURA_ID WHERE I.ASIL_FATURA_ID = @ID ORDER BY F.TARIH, I.IADE_FATURA_ID;
      -- F11: asıl fişin ödemeleri (tür / POS) ve o türle yapılmış önceki iadeler — ekran asıl ödemeyi gösterir, varsayılan türü ona göre seçer
      SELECT O.ODEME_ARACI_TURU AS T, O.POS_CIHAZI_ID AS P, SUM(O.TUTAR) AS TUTAR FROM dbo.TODVZ_FATURA_ODEME O WHERE O.FATURA_ID = @ID GROUP BY O.ODEME_ARACI_TURU, O.POS_CIHAZI_ID;
      SELECT O.ODEME_ARACI_TURU AS T, SUM(O.TUTAR) AS TUTAR FROM dbo.TODVZ_TICARI_IADE I JOIN dbo.TODVZ_FATURA_ODEME O ON O.FATURA_ID = I.IADE_FATURA_ID
        WHERE I.ASIL_FATURA_ID = @ID GROUP BY O.ODEME_ARACI_TURU`);
    const ors = onceki.recordsets as any[];
    const oncekiTur = (t: number) => Number((ors[2] || []).find((x: any) => Number(x.T) === t)?.TUTAR) || 0;
    const asilOdemeler = (ors[1] || []).map((x: any) => ({ odemeAraciTuru: Number(x.T) || 0, posCihaziId: x.P ?? null, tutar: yuvarla(Number(x.TUTAR) || 0, 2) }));
    const kartOdenen = asilOdemeler.filter((o: any) => o.odemeAraciTuru === 2).reduce((t: number, o: any) => t + o.tutar, 0);
    return {
      fis: {
        faturaId: f.FATURA_ID, faturaNo: temiz(f.FATURA_NO), tarih: new Date(f.TARIH).toISOString(), aliciVknTckn: temiz(f.ALICI_VKN_TCKN),
        aliciUnvan: temiz(f.ALICI_UNVAN), cariKartId: f.CARI_KART_ID ?? null, cariKod: f.CARI_KOD ? temiz(f.CARI_KOD) : null, cariAd: f.CARI_AD ? temiz(f.CARI_AD) : null,
        genelToplam: Number(f.GENEL_TOPLAM) || 0, eBelgeDurumu: Number(f.D) || 0, ettn: temiz(f.ETTN),
      },
      satirlar,
      oncekiIadeler: onceki.recordset.map((x: any) => ({ faturaId: x.IADE_FATURA_ID, faturaNo: temiz(x.FATURA_NO), tarih: new Date(x.TARIH).toISOString(), tutar: Number(x.GENEL_TOPLAM) || 0 })),
      asilOdemeler,
      /** Karta en çok iade edilebilecek (T9): kartla ödenen − önceki kart iadeleri */
      kartaIadeSiniri: yuvarla(Math.max(0, kartOdenen - oncekiTur(2)), 2),
    };
  }

  static async kaydet(g: TicariIadeGirdi, kullaniciId: number | undefined, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const asilId = Number(g.asilFaturaId) || 0;
    if (!asilId) throw ApiError.badRequest("İadesi alınacak satış fişi seçilmeli.");
    const istek = (g.satirlar || []).filter((s) => sayi(s.miktar) > 0);
    if (!istek.length) throw ApiError.badRequest("İade edilecek en az bir satır ve miktar girilmeli.");
    const tarih = g.tarih ? new Date(g.tarih) : new Date();
    if (Number.isNaN(tarih.getTime())) throw ApiError.badRequest("İade tarihi okunamadı.");
    const neden = temiz(g.neden).slice(0, 200) || null;

    const tx = new sql.Transaction(pool);
    await tx.begin();
    await stokIslemKilidi(tx);
    let iadeId = 0;
    try {
      // Asıl fiş kilitlenir: aynı fişe eşzamanlı iki iade kalanı aşamasın
      const { f, satirlar } = await kaynakOku(tx, asilId, true);
      const tekrar = istek.map((s) => Number(s.asilSatirNo)).find((n, i, a) => a.indexOf(n) !== i);
      if (tekrar) throw ApiError.badRequest(`${tekrar}. satır iade listesinde iki kez var.`);
      const secim = istek.map((s) => {
        const a = satirlar.find((x) => x.satirNo === Number(s.asilSatirNo));
        if (!a) throw ApiError.badRequest(`Asıl fişte ${s.asilSatirNo}. satır yok.`);
        const miktar = yuvarla(sayi(s.miktar), 4);
        if (miktar - a.kalan > 0.00001) throw ApiError.badRequest(`"${a.ad}": iade miktarı (${miktar}) kalan miktardan (${a.kalan}) fazla.`);
        return { a, miktar };
      });
      // Tutar asıl satırdan orantılı (son iade kalanı alır)
      const satirHesap = secim.map(({ a, miktar }) => iadeSatirTutari(a.asil, a.onceki, miktar));
      const topla = (f: (h: (typeof satirHesap)[number]) => number) => yuvarla(satirHesap.reduce((t, h) => t + f(h), 0), 2);
      const hesap = { satirlar: satirHesap, matrah: topla((h) => h.matrah), toplamKdv: topla((h) => h.kdvTutari), genelToplam: topla((h) => h.toplamTutar) };

      // Para iadesi: girilmezse tamamı veznede nakit; girildiyse toplam iade tutarına eşit olmalı
      let odemeler = (g.odemeler || []).filter((o) => sayi(o.tutar) > 0);
      if (!odemeler.length) odemeler = [{ odemeAraciTuru: 0, paraKodu: "TL", tutar: hesap.genelToplam }];
      const odemeToplami = yuvarla(odemeler.reduce((t, o) => t + sayi(o.tutar), 0), 2);
      // T9 (26.11.2026 denetimi): kuruşu kuruşuna (eskiden ±0,05: her iadede 5 kuruşa kadar fazla para çıkabiliyordu)
      if (Math.abs(odemeToplami - hesap.genelToplam) > 0.005) {
        throw ApiError.badRequest(`İade ödemeleri (${odemeToplami.toFixed(2)}) iade tutarına (${hesap.genelToplam.toFixed(2)}) eşit olmalı.`);
      }
      // T9: karta (POS) iade, asıl fişte kartla ödenenden (önceki kart iadeleri düşülerek) fazla olamaz — nakit satışın parası karta
      // gönderilemez. Nakit / cariye alacak / havale serbest (iade tutarının kendisi zaten satırların kalanıyla sınırlı).
      const turOdenen = await new sql.Request(tx).input("A", sql.Int, asilId).query(`
        SELECT ODEME_ARACI_TURU AS T, SUM(TUTAR) AS ODENEN FROM dbo.TODVZ_FATURA_ODEME WHERE FATURA_ID = @A GROUP BY ODEME_ARACI_TURU;
        SELECT O.ODEME_ARACI_TURU AS T, SUM(O.TUTAR) AS IADE FROM dbo.TODVZ_TICARI_IADE I JOIN dbo.TODVZ_FATURA_ODEME O ON O.FATURA_ID = I.IADE_FATURA_ID
          WHERE I.ASIL_FATURA_ID = @A GROUP BY O.ODEME_ARACI_TURU;`);
      const trs = turOdenen.recordsets as any[];
      const TUR_ADI: Record<number, string> = { 1: "cariye", 2: "karta (POS)", 3: "havale ile" };
      for (const tur of [2]) {
        const istenen = yuvarla(odemeler.filter((o) => Number(o.odemeAraciTuru) === tur).reduce((t, o) => t + sayi(o.tutar), 0), 2);
        if (!(istenen > 0)) continue;
        const odenen = Number(trs[0].find((x: any) => Number(x.T) === tur)?.ODENEN) || 0;
        const onceki = Number(trs[1].find((x: any) => Number(x.T) === tur)?.IADE) || 0;
        const sinir = yuvarla(Math.max(0, odenen - onceki), 2);
        if (istenen - sinir > 0.005) throw ApiError.badRequest(`${TUR_ADI[tur]} iade ${istenen.toFixed(2)} TL olamaz: asıl fişte bu türle ödenen${onceki > 0 ? ` (önceki iadeler düşülünce)` : ""} ${sinir.toFixed(2)} TL. Kalanı nakit iade edin.`);
      }
      for (const o of odemeler) {
        if (Number(o.odemeAraciTuru) === 1) {
          o.cariKartId = Number(o.cariKartId) || f.CARI_KART_ID || null;
          if (!o.cariKartId) throw ApiError.badRequest("Cariye iade için cari seçilmeli (asıl fişte cari yok).");
        }
      }

      // Numara: IAD + yıl + 9 hane (kendi serisi)
      const onEk = `IAD${tarih.getFullYear()}`;
      const n = await new sql.Request(tx).input("ON", sql.VarChar(10), onEk).query(`
        SELECT ISNULL(MAX(TRY_CAST(SUBSTRING(FATURA_NO, 8, 9) AS INT)), 0) + 1 AS N FROM dbo.TODVZ_FATURA WITH (UPDLOCK, HOLDLOCK)
        WHERE FATURA_NO LIKE @ON + '%' AND LEN(RTRIM(FATURA_NO)) = 16`);
      const faturaNo = `${onEk}${String(Number(n.recordset[0].N) || 1).padStart(9, "0")}`;

      const r = await new sql.Request(tx)
        .input("VEZNE_ID", sql.Int, Number(g.vezneId) || Number(f.VEZNE_ID) || 1)
        .input("FATURA_NO", sql.VarChar(50), faturaNo)
        .input("TARIH", sql.DateTime, tarih)
        .input("SENARYO", sql.VarChar(50), temiz(f.SENARYO) || "EARSIVFATURA")
        .input("CARI_KART_ID", sql.Int, f.CARI_KART_ID ?? null)
        .input("VKN", sql.VarChar(50), temiz(f.ALICI_VKN_TCKN) || "11111111111")
        .input("UNVAN", sql.VarChar(250), (temiz(f.ALICI_UNVAN) || "NİHAİ TÜKETİCİ").slice(0, 250))
        .input("ADRES", sql.VarChar(500), temiz(f.ADRES).slice(0, 500) || null)
        .input("ILCE", sql.VarChar(100), temiz(f.ILCE).slice(0, 100) || null)
        .input("IL", sql.VarChar(100), temiz(f.IL).slice(0, 100) || null)
        .input("VD", sql.VarChar(100), temiz(f.VERGI_DAIRESI).slice(0, 100) || null)
        .input("EPOSTA", sql.VarChar(100), temiz(f.EPOSTA).slice(0, 100) || null)
        .input("TELEFON", sql.VarChar(50), temiz(f.TELEFON).slice(0, 50) || null)
        .input("ARA", sql.Float, hesap.matrah).input("KDV", sql.Float, hesap.toplamKdv).input("GENEL", sql.Float, hesap.genelToplam)
        .input("KUL", sql.Int, kullaniciId || null).input("KAYNAK", sql.TinyInt, FIS_KAYNAGI_TICARI)
        .query(`INSERT INTO dbo.TODVZ_FATURA (VEZNE_ID, FATURA_NO, ETTN, TARIH, FATURA_TIPI, SENARYO, CARI_KART_ID, ALICI_VKN_TCKN, ALICI_UNVAN,
            ADRES, ILCE, IL, VERGI_DAIRESI, EPOSTA, TELEFON, PARA_ID, KUR, ARA_TOPLAM, TOPLAM_KDV, ISKONTO_ORANI, ISKONTO_TUTARI,
            GENEL_TOPLAM, E_BELGE_DURUMU, EKLEYEN_ID, EKLEME_ZAMANI, FIS_KAYNAGI)
          OUTPUT INSERTED.FATURA_ID
          VALUES (@VEZNE_ID, @FATURA_NO, NEWID(), @TARIH, 2, @SENARYO, @CARI_KART_ID, @VKN, @UNVAN, @ADRES, @ILCE, @IL, @VD, @EPOSTA, @TELEFON,
            ISNULL((SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD)) IN ('TL','TRY') ORDER BY PARA_ID), 1), 1, @ARA, @KDV, 0, 0,
            @GENEL, 0, @KUL, GETDATE(), @KAYNAK)`);
      iadeId = r.recordset[0].FATURA_ID;

      for (let i = 0; i < hesap.satirlar.length; i++) {
        const h = hesap.satirlar[i];
        const { a } = secim[i];
        await new sql.Request(tx)
          .input("FID", sql.Int, iadeId).input("NO", sql.Int, i + 1).input("KART", sql.Int, a.stokKartId)
          .input("AD", sql.VarChar(200), a.ad.slice(0, 200)).input("M", sql.Float, h.miktar).input("BIRIM", sql.VarChar(20), a.birim)
          .input("BF", sql.Float, h.birimFiyat).input("T", sql.Float, h.tutar).input("KO", sql.Float, h.kdvOrani).input("KT", sql.Float, h.kdvTutari)
          .input("TT", sql.Float, h.toplamTutar).input("DF", sql.Float, h.kdvDahilFiyat).input("IST", sql.Float, h.iskontoTutari)
          .input("TARIH", sql.DateTime, tarih).input("TUR", sql.TinyInt, STOK_BELGE.SATIS).input("KUL", sql.Int, kullaniciId || null)
          .input("ASIL", sql.Int, a.satirNo).input("ASILF", sql.Int, asilId)
          .query(`INSERT INTO dbo.TODVZ_FATURA_SATIRI (FATURA_ID, SATIR_NO, ALTIN_URUN_ID, BARKOD, URUN_ADI, AYAR, MIKTAR, BIRIM, GRAM, HAS_GRAM, BIRIM_FIYAT, TUTAR,
              KDV_ORANI, KDV_TUTARI, TOPLAM_TUTAR, STOK_KART_ID, KDV_DAHIL_FIYAT, SATIR_ISKONTO_TURU, SATIR_ISKONTO_DEGERI, SATIR_ISKONTO_TUTARI)
            VALUES (@FID, @NO, NULL, NULL, @AD, NULL, @M, @BIRIM, 0, 0, @BF, @T, @KO, @KT, @TT, @KART, @DF, NULL, NULL, @IST);
            -- Stoğa, satışta ÇIKAN kadar girer (26.11.2026 denetimi): asıl satırın stok çıkışı × (iade miktarı / satış miktarı).
            -- Yarım porsiyon (çarpan 0,5) satışın iadesi 0,5 girer; stok takibi kapalıyken ya da reçeteli olarak satılmış satırın
            -- stok çıkışı yoktur, iadesi de stoğa girmez (reçetede malzemeler dönmez: hazırlanmış ürün yeniden satılamaz, TA18).
            DECLARE @ASIL_C FLOAT = (SELECT SUM(H.CIKIS) FROM dbo.TODVZ_STOK_HAREKET H WHERE H.BELGE_TURU = @TUR AND H.BELGE_ID = @ASILF AND H.SATIR_NO = @ASIL AND H.STOK_KART_ID = @KART AND H.CIKIS > 0);
            DECLARE @ASIL_M FLOAT = (SELECT TOP 1 MIKTAR FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @ASILF AND SATIR_NO = @ASIL);
            IF @KART IS NOT NULL AND ISNULL(@ASIL_C, 0) > 0 AND ISNULL(@ASIL_M, 0) > 0
              AND ISNULL((SELECT RECETELI FROM dbo.TODVZ_STOK_KART WHERE STOK_KART_ID = @KART), 0) = 0
              INSERT INTO dbo.TODVZ_STOK_HAREKET (STOK_KART_ID, TARIH, BELGE_TURU, BELGE_ID, SATIR_NO, GIRIS, CIKIS, BIRIM_FIYAT, EKLEYEN_ID)
              VALUES (@KART, @TARIH, @TUR, @FID, @NO, ROUND(@ASIL_C * @M / @ASIL_M, 4), 0, @BF, @KUL);
            INSERT INTO dbo.TODVZ_TICARI_IADE_SATIR (IADE_FATURA_ID, IADE_SATIR_NO, ASIL_SATIR_NO) VALUES (@FID, @NO, @ASIL);`);
      }
      await new sql.Request(tx).input("FID", sql.Int, iadeId).input("ASIL", sql.Int, asilId).input("N", sql.NVarChar(200), neden).input("KUL", sql.Int, kullaniciId || null)
        .query(`INSERT INTO dbo.TODVZ_TICARI_IADE (IADE_FATURA_ID, ASIL_FATURA_ID, NEDEN, EKLEYEN_ID) VALUES (@FID, @ASIL, @N, @KUL)`);
      await odemeleriYaz(tx, iadeId, odemeler);
      // Nakit iade vezneden çıkış (vezneyeIsle FATURA_TIPI 2'yi eksi işler)
      await vezneyeIsle(tx, iadeId);
      await tx.commit();
    } catch (e: any) {
      await tx.rollback().catch(() => undefined);
      if (!(e instanceof ApiError)) logger.error("TicariIadeSqlRepository.kaydet", { message: e?.message, stack: e?.stack });
      throw e;
    }
    return this.getir(iadeId, ctx);
  }

  /** İade fişi + asıl fiş bağı */
  static async getir(iadeId: number, ctx?: DbBaglam) {
    const fis = await TicariSatisSqlRepository.getir(iadeId, ctx);
    if (!fis || Number(fis.faturaTipi) !== 2) throw ApiError.notFound("İade fişi bulunamadı.");
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const b = await pool.request().input("ID", sql.Int, iadeId).query(`
      SELECT I.ASIL_FATURA_ID, I.NEDEN, RTRIM(F.FATURA_NO) AS ASIL_NO, F.TARIH AS ASIL_TARIH, ISNULL(F.E_BELGE_DURUMU, 0) AS ASIL_D, CAST(F.ETTN AS varchar(50)) AS ASIL_ETTN
      FROM dbo.TODVZ_TICARI_IADE I JOIN dbo.TODVZ_FATURA F ON F.FATURA_ID = I.ASIL_FATURA_ID WHERE I.IADE_FATURA_ID = @ID`);
    const x = b.recordset[0];
    return {
      ...fis,
      asil: x ? { faturaId: x.ASIL_FATURA_ID, faturaNo: temiz(x.ASIL_NO), tarih: new Date(x.ASIL_TARIH).toISOString(), eBelgeDurumu: Number(x.ASIL_D) || 0, ettn: temiz(x.ASIL_ETTN) } : null,
      neden: x?.NEDEN ? temiz(x.NEDEN) : null,
    };
  }

  /** İade fişini siler: stok girişi, vezne çıkışı, ödemeler, bağ kaldırılır */
  static async sil(iadeId: number, ctx?: DbBaglam): Promise<void> {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    // T12 (26.11.2026 denetimi): e-Belge'si kesilmiş / GİB kuyruğuna girmiş iade silinmez (satış fişiyle aynı kural)
    await gibeGonderildiyseEngelle(pool, EVRAK_TURU_PERAKENDE, iadeId, "iade fişi");
    const tx = new sql.Transaction(pool);
    await tx.begin();
    await stokIslemKilidi(tx);
    try {
      const r = await new sql.Request(tx).input("ID", sql.Int, iadeId)
        .query(`SELECT ISNULL(FIS_KAYNAGI, 0) AS K, ISNULL(FATURA_TIPI, 1) AS T, ISNULL(E_BELGE_DURUMU, 0) AS D, RTRIM(FATURA_NO) AS NO FROM dbo.TODVZ_FATURA WITH (UPDLOCK) WHERE FATURA_ID = @ID`);
      const f = r.recordset[0];
      if (!f || Number(f.K) !== FIS_KAYNAGI_TICARI || Number(f.T) !== 2) throw ApiError.notFound("İade fişi bulunamadı.");
      if (Number(f.D) === 1 || Number(f.D) === 2) throw ApiError.badRequest(`${temiz(f.NO)} numaralı iade e-Belge olarak iletildi; silinemez (gerekirse e-Belge iptali yapılır).`);
      await new sql.Request(tx).input("FID", sql.Int, iadeId).query(ODEME_VEZNE_GERI_AL);
      await new sql.Request(tx).input("ID", sql.Int, iadeId).input("TUR", sql.TinyInt, STOK_BELGE.SATIS).query(`
        DELETE FROM dbo.TODVZ_STOK_HAREKET WHERE BELGE_TURU = @TUR AND BELGE_ID = @ID;
        DELETE FROM dbo.TODVZ_FATURA_ODEME WHERE FATURA_ID = @ID;
        DELETE FROM dbo.TODVZ_FATURA_SATIRI WHERE FATURA_ID = @ID;
        DELETE FROM dbo.TODVZ_TICARI_IADE_SATIR WHERE IADE_FATURA_ID = @ID;
        DELETE FROM dbo.TODVZ_TICARI_IADE WHERE IADE_FATURA_ID = @ID;
        DELETE FROM dbo.TODVZ_FATURA WHERE FATURA_ID = @ID;`);
      await tx.commit();
    } catch (e) {
      await tx.rollback().catch(() => undefined);
      throw e;
    }
  }

  /**
   * e-Gider Pusulası (iade) taslağı: e-Belge › e-Gider › Genel formunu doldurur (gönderim elle). Malı iade eden müşteri;
   * dayanak asıl fiş e-Arşiv gönderildiyse "e-Arşiv fatura", değilse "Satış fişi"; satırlar KDV hariç birim fiyat + KDV oranı.
   */
  static async giderTaslagi(iadeId: number, ctx?: DbBaglam) {
    const fis = await this.getir(iadeId, ctx);
    // Anonim müşteri (11111111111 / NİHAİ TÜKETİCİ): iade gider pusulası malı iade eden gerçek kişiyi ister → kimlik boş bırakılır
    const anonim = /^1{10,11}$/.test(fis.aliciVknTckn.replace(/\D/g, "")) || /NİHAİ TÜKETİCİ|İSİM BEYAN/i.test(fis.aliciUnvan);
    const vkn = anonim ? "" : fis.aliciVknTckn.replace(/\D/g, "");
    const parcalar = anonim ? [] : fis.aliciUnvan.split(/\s+/).filter(Boolean);
    const sahis = anonim || vkn.length === 11;
    return {
      belgeNo: "",
      tarih: istanbulGunu(new Date()),
      belgeTipi: "IADE" as const,
      paraBirimi: "TRY" as const,
      alici: {
        vknTckn: vkn.length === 10 || vkn.length === 11 ? vkn : "",
        ad: sahis ? parcalar.slice(0, -1).join(" ") || parcalar[0] || "" : "",
        soyad: sahis ? (parcalar.length > 1 ? parcalar[parcalar.length - 1] : "") : "",
        unvan: sahis ? "" : fis.aliciUnvan,
        il: fis.il || "",
        ilce: fis.ilce || "",
      },
      // İade gider pusulası KDV ile (yüz yüze iade); kod formda değiştirilebilir
      vergiTuruKodu: "0015",
      satirlar: fis.satirlar.map((s: any) => ({
        ad: s.urunAdi,
        miktar: Number(s.miktar) || 0,
        birimKodu: birimKoduTicari(s.birim),
        birimFiyat: Number(s.miktar) > 0 ? yuvarla((Number(s.toplamTutar) - Number(s.kdvTutari)) / Number(s.miktar), 2) : 0,
        vergiOrani: Number(s.kdvOrani) || 0,
      })),
      iadeDayanak: fis.asil
        ? { belgeTipi: (fis.asil.eBelgeDurumu === 1 || fis.asil.eBelgeDurumu === 2 ? "EARSIV_FATURA" : "SATIS_FISI") as "EARSIV_FATURA" | "SATIS_FISI", belgeNo: fis.asil.faturaNo, belgeTarihi: istanbulGunu(new Date(fis.asil.tarih)) }
        : { belgeTipi: "BELGESIZ" as const, belgeTarihi: istanbulGunu(new Date()) },
      notlar: [`Ticari iade fişi ${fis.faturaNo}`],
      /** Ekran uyarısı: anonim müşteride kimlik elle yazılmalı */
      kimlikGerekli: anonim,
    };
  }
}

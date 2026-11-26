import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { DbBaglam } from "./ticariStokSql.repository.js";
import { AdisyonTanimSqlRepository } from "./adisyonTanimSql.repository.js";
import { KALEM_DURUM, secimMetni } from "../services/adisyon/adisyonHesap.js";
import { olayTetikle, olayYaz } from "../services/adisyon/adisyonOlay.service.js";
import { cihazOzeti, yeniCihazAnahtari } from "../services/adisyon/adisyonPin.js";

/**
 * Mutfak (docs/TICARI_ADISYON_YOL_HARITASI.md, TA30, D5): hazırlık yeri yazıcısına fiş kuyruğu (kasa PC'deki istasyon atomik
 * olarak kiralar → iki PC aynı fişi basmaz; basamazsa 30 sn sonra yeniden dağıtılır, 10 denemede durur) ve mutfak ekranı (KDS):
 * hazırlanan kalemler, "Hazır" (garsona bildirim), geri alma, servis. KDS hazırlık yeri başına anahtarlı bağlantıyla açılır.
 */
const temiz = (v: unknown) => String(v ?? "").trim();
const havuz = (ctx?: DbBaglam) => AdisyonTanimSqlRepository.havuz(ctx);
export const MUTFAK_FIS_TUR = { SIPARIS: 1, IPTAL: 2, HESAP: 3 } as const;
/** Fiş basan bilgisayarın (istasyon) son kiralama zamanı ayarda tutulur; dakikada en çok bir kez yazılır */
const ISTASYON_AYARI = "ISTASYON_SON";
const istasyonYazildi = new Map<string, number>();
/** Hesap fişi yalnız son bu kadar dakikada fiş kiralamış bir istasyon varsa kuyruğa girer (yazıcısız işletmede boşuna birikmesin) */
export const ISTASYON_ETKIN_DK = 10;
export const KIRALAMA_SN = 30;
export const EN_COK_DENEME = 10;
/** Bu kadar dakikadan eski fiş kendiliğinden basılmaz (karar K5, 26.11.2026): kasa PC kapalıyken biriken dünkü siparişler açılışta
 *  topluca mutfağa dökülmesin. "Eskidi" olarak listede kalır; istenirse elle yeniden kuyruğa alınır. */
export const FIS_ESKIME_DK = 30;
/** Basılabilir bir fiş bu kadar saniyedir bekliyorsa "fiş basan bilgisayar yok" uyarısı verilir */
export const ISTASYON_UYARI_SN = 90;

export interface MutfakFisIcerigi {
  tur: number; adisyonId: number; adisyonNo: string; masa: string | null; bolge: string | null; ekleyen: string | null; zaman: string; yer: string; yazici: string;
  /** Adisyon türü (1 masa, 2 paket, 3 gel-al) ve paket / gel-al müşterisi (D8); eski fişlerde yok */
  adisyonTuru?: number; musteri?: string | null;
  kalemler: { kalemId: number; ad: string; miktar: number; birim: string; porsiyon: string | null; secim: string; notu: string | null }[];
}

async function islem<T>(ctx: DbBaglam | undefined, f: (tx: sql.Transaction) => Promise<T>): Promise<T> {
  const pool = await havuz(ctx);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try { const r = await f(tx); await tx.commit(); return r; } catch (e) { await tx.rollback().catch(() => undefined); throw e; }
}

/**
 * Kilit sırası her yerde adisyon → kalem (tahsilat / ikram / iptal böyle alır; tersi kilitlenme verir). Kalemlerin adisyonları
 * kilitsiz okunur, sonra tek tek ve kimlik sırasıyla (birincil anahtar araması) kilitlenir: tarama yapan tek sorgu başka
 * adisyonların satırına da dokunup sırayı bozabilir.
 */
async function adisyonlariKilitle(tx: sql.Transaction, kalemIdler: number[]) {
  const r = await new sql.Request(tx).query(`SELECT DISTINCT ADISYON_ID FROM dbo.TODVZ_ADISYON_KALEM WITH (NOLOCK) WHERE KALEM_ID IN (${kalemIdler.join(",")})`);
  for (const a of r.recordset.map((x: any) => Number(x.ADISYON_ID)).sort((x: number, y: number) => x - y))
    await new sql.Request(tx).input("A", sql.Int, a).query(`SELECT ADISYON_ID FROM dbo.TODVZ_ADISYON WITH (UPDLOCK, ROWLOCK) WHERE ADISYON_ID = @A`);
}

export class AdisyonMutfakSqlRepository {
  /**
   * Siparişin (ya da iptalin, D6) mutfak fişleri ve olayları — çağıranın işlemi içinde: yazıcısı olan her etkin hazırlık yeri
   * için bir fiş; ekranı olan her yer için "mutfak" olayı (KDS yenilenir).
   */
  static async fisleriYaz(tx: sql.Transaction, adisyonId: number, kalemIdler: number[], tur: number = MUTFAK_FIS_TUR.SIPARIS): Promise<number> {
    if (!kalemIdler.length) return 0;
    const r = await new sql.Request(tx).input("A", sql.Int, adisyonId).query(`
      SELECT A.ADISYON_NO, A.TUR AS ATUR, A.MUSTERI_AD, RTRIM(M.AD) AS MASA, RTRIM(B.AD) AS BOLGE, K.KALEM_ID, K.AD, K.MIKTAR, RTRIM(K.BIRIM) AS BIRIM, K.PORSIYON_AD, K.SECENEKLER, K.NOTU, K.EKLEYEN_AD,
        H.YER_ID, RTRIM(H.AD) AS YER, H.YAZICI, H.EKRAN
      FROM dbo.TODVZ_ADISYON_KALEM K JOIN dbo.TODVZ_ADISYON A ON A.ADISYON_ID = K.ADISYON_ID
      JOIN dbo.TODVZ_ADISYON_HAZIRLIK H ON H.YER_ID = K.YER_ID AND H.AKTIF = 1
      LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID LEFT JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID
      WHERE K.ADISYON_ID = @A AND K.KALEM_ID IN (${kalemIdler.map(Number).filter((x) => x > 0).join(",")}) ORDER BY H.YER_ID, K.KALEM_ID`);
    const yerler = new Map<number, any[]>();
    for (const x of r.recordset) yerler.set(Number(x.YER_ID), [...(yerler.get(Number(x.YER_ID)) || []), x]);
    let fis = 0;
    for (const [yerId, satirlar] of yerler) {
      const ilk = satirlar[0];
      if (ilk.YAZICI) {
        const secimler = (v: unknown) => { try { return secimMetni(JSON.parse(String(v || "[]"))); } catch { return ""; } };
        const icerik: MutfakFisIcerigi = { tur, adisyonId, adisyonNo: temiz(ilk.ADISYON_NO), masa: ilk.MASA ? temiz(ilk.MASA) : null, bolge: ilk.BOLGE ? temiz(ilk.BOLGE) : null,
          adisyonTuru: Number(ilk.ATUR) || 1, musteri: ilk.MUSTERI_AD ? temiz(ilk.MUSTERI_AD) : null,
          ekleyen: ilk.EKLEYEN_AD ? temiz(ilk.EKLEYEN_AD) : null, zaman: new Date().toISOString(), yer: temiz(ilk.YER), yazici: temiz(ilk.YAZICI),
          kalemler: satirlar.map((k) => ({ kalemId: Number(k.KALEM_ID), ad: temiz(k.AD), miktar: Number(k.MIKTAR), birim: temiz(k.BIRIM), porsiyon: k.PORSIYON_AD ? temiz(k.PORSIYON_AD) : null, secim: secimler(k.SECENEKLER), notu: k.NOTU ? temiz(k.NOTU) : null })) };
        await new sql.Request(tx).input("A", sql.Int, adisyonId).input("Y", sql.Int, yerId).input("T", sql.TinyInt, tur).input("I", sql.NVarChar(sql.MAX), JSON.stringify(icerik))
          .query(`INSERT INTO dbo.TODVZ_ADISYON_MUTFAK_FIS (ADISYON_ID, YER_ID, TUR, ICERIK) VALUES (@A, @Y, @T, @I)`);
        fis++;
      }
      if (ilk.EKRAN) await olayYaz(tx, "mutfak", { adisyonId, yerId, veri: { tur, kalem: satirlar.length } });
    }
    if (fis) await olayYaz(tx, "mutfak-fis", { adisyonId, veri: { fis } });
    return fis;
  }

  // ───────────── Yazıcı istasyonu (kasa PC) ─────────────
  /** Basılacak fişleri kiralar (atomik): kiralanan fiş 30 sn başka istasyona verilmez; 10 denemede durur */
  /**
   * İstasyon fiş kiralar (26.11.2026 denetimiyle yeniden düzenlendi):
   *  - Tek tek kiralanır (varsayılan 1): 5 fiş birden alınıp sırayla basılırken sondakilerin kirası dolup başka istasyona da
   *    veriliyordu (çift baskı).
   *  - FIS_ESKIME_DK'dan eski fiş verilmez (K5).
   *  - Aynı adisyon + yerde basılmamış daha eski fiş varken sonraki verilmez: "İPTAL" fişi sipariş fişinden önce çıkmaz.
   *  - Dönen `deneme`, kiranın belgesidir; sonuç bildirimi onu taşır (başkasının kirasını bırakamaz).
   */
  static async fisleriAl(ctx: DbBaglam | undefined, adet = 1) {
    const pool = await havuz(ctx);
    const r = await pool.request().input("N", sql.Int, Math.min(Math.max(Number(adet) || 1, 1), 5)).input("K", sql.Int, KIRALAMA_SN).input("D", sql.Int, EN_COK_DENEME).input("E", sql.Int, FIS_ESKIME_DK).query(`
      ;WITH S AS (SELECT TOP (@N) * FROM dbo.TODVZ_ADISYON_MUTFAK_FIS F WITH (UPDLOCK, READPAST, ROWLOCK)
        WHERE F.YAZDIRILDI = 0 AND F.DENEME < @D AND F.ZAMAN > DATEADD(minute, -@E, GETDATE())
          AND (F.YAZDIRMA_ZAMANI IS NULL OR F.YAZDIRMA_ZAMANI < DATEADD(second, -@K, GETDATE()))
          AND NOT EXISTS (SELECT 1 FROM dbo.TODVZ_ADISYON_MUTFAK_FIS O WITH (NOLOCK) WHERE O.ADISYON_ID = F.ADISYON_ID AND O.YER_ID = F.YER_ID AND O.MUTFAK_FIS_ID < F.MUTFAK_FIS_ID
            AND O.YAZDIRILDI = 0 AND O.DENEME < @D AND O.ZAMAN > DATEADD(minute, -@E, GETDATE()))
        ORDER BY F.MUTFAK_FIS_ID)
      UPDATE S SET DENEME = DENEME + 1, YAZDIRMA_ZAMANI = GETDATE()
      OUTPUT INSERTED.MUTFAK_FIS_ID, INSERTED.TUR, INSERTED.ICERIK, INSERTED.DENEME;`);
    // İstasyon nabzı: bu veritabanında fiş basan bir bilgisayar çalışıyor (hesap fişi kuyruğu buna bakar)
    const anahtar = `${String(ctx?.dbServer || "").toLowerCase()}|${String(ctx?.dbName || "").toLowerCase()}`;
    if (Date.now() - (istasyonYazildi.get(anahtar) || 0) > 60_000) {
      istasyonYazildi.set(anahtar, Date.now());
      await pool.request().input("K", sql.VarChar(50), ISTASYON_AYARI).query(`
        IF EXISTS (SELECT 1 FROM dbo.TODVZ_ADISYON_AYAR WHERE ANAHTAR = @K) UPDATE dbo.TODVZ_ADISYON_AYAR SET DEGER = CONVERT(varchar(19), GETDATE(), 120) WHERE ANAHTAR = @K
        ELSE INSERT INTO dbo.TODVZ_ADISYON_AYAR (ANAHTAR, DEGER) VALUES (@K, CONVERT(varchar(19), GETDATE(), 120));`).catch(() => undefined);
    }
    return r.recordset.map((x: any) => ({ fisId: Number(x.MUTFAK_FIS_ID), tur: Number(x.TUR), deneme: Number(x.DENEME), icerik: JSON.parse(String(x.ICERIK)) as MutfakFisIcerigi }))
      .sort((a: any, b: any) => a.fisId - b.fisId);
  }

  /**
   * Hesap fişi kuyruğu (TA34): "Hesap iste" denince, fiş basan bir bilgisayar etkinse (son ISTASYON_ETKIN_DK dakikada kiralama
   * yapmış) adisyon için bir hesap fişi işi yazılır; istasyon adisyonu okuyup kasadaki yazıcıdan basar. Aynı adisyonun basılmamış
   * hesap fişi varken yenisi yazılmaz. Çağıranın işlemi içinde çalışır.
   */
  static async hesapFisiKuyrugu(tx: sql.Transaction, a: { adisyonId: number; no: string; masa: string | null }, isteyen: string): Promise<boolean> {
    const icerik: MutfakFisIcerigi = { tur: MUTFAK_FIS_TUR.HESAP, adisyonId: a.adisyonId, adisyonNo: a.no, masa: a.masa, bolge: null, ekleyen: isteyen || null, zaman: new Date().toISOString(), yer: "Hesap", yazici: "", kalemler: [] };
    const r = await new sql.Request(tx).input("A", sql.Int, a.adisyonId).input("K", sql.VarChar(50), ISTASYON_AYARI).input("D", sql.Int, ISTASYON_ETKIN_DK).input("E", sql.Int, FIS_ESKIME_DK)
      .input("I", sql.NVarChar(sql.MAX), JSON.stringify(icerik)).query(`
      IF EXISTS (SELECT 1 FROM dbo.TODVZ_ADISYON_AYAR WHERE ANAHTAR = @K AND TRY_CONVERT(datetime, DEGER, 120) > DATEADD(minute, -@D, GETDATE()))
        AND NOT EXISTS (SELECT 1 FROM dbo.TODVZ_ADISYON_MUTFAK_FIS WHERE ADISYON_ID = @A AND TUR = 3 AND YAZDIRILDI = 0 AND ZAMAN > DATEADD(minute, -@E, GETDATE()))
      BEGIN
        INSERT INTO dbo.TODVZ_ADISYON_MUTFAK_FIS (ADISYON_ID, YER_ID, TUR, ICERIK) VALUES (@A, 0, 3, @I);
        SELECT 1 AS V;
      END
      ELSE SELECT 0 AS V;`);
    const yazildi = Number(r.recordset[0]?.V) === 1;
    if (yazildi) await olayYaz(tx, "mutfak-fis", { adisyonId: a.adisyonId, veri: { fis: 1, hesap: true } });
    return yazildi;
  }

  /**
   * Basım sonucu. `deneme` verildiyse yalnız o kiranın sahibi sonucu yazabilir (geç gelen eski sonuç, fişi o sırada basan
   * başka istasyonun kirasını bozmaz). Başarısızlıkta kira BIRAKILMAZ: fiş KIRALAMA_SN sonra yeniden denenir (ajan kapalıyken
   * 3 sn'de bir deneyip bir dakikada 10 hakkı bitirmesin). "Ajan yok" bir basım denemesi değildir, hak sayılmaz: ajan geri
   * gelince fiş kendiliğinden basılır (eskimediyse).
   */
  static async fisSonucu(ctx: DbBaglam | undefined, fisId: number, basarili: boolean, hata?: string | null, ek?: { deneme?: number | null; ajanYok?: boolean }) {
    const pool = await havuz(ctx);
    const deneme = Number(ek?.deneme) > 0 ? Number(ek?.deneme) : null;
    const r = await pool.request().input("F", sql.Int, fisId).input("B", sql.Bit, basarili ? 1 : 0).input("H", sql.NVarChar(300), basarili ? null : temiz(hata).slice(0, 300) || "Basılamadı")
      .input("DN", sql.Int, deneme).input("AY", sql.Bit, !basarili && ek?.ajanYok ? 1 : 0)
      .query(`UPDATE dbo.TODVZ_ADISYON_MUTFAK_FIS SET YAZDIRILDI = @B, YAZDIRMA_ZAMANI = GETDATE(), HATA = @H,
          DENEME = CASE WHEN @AY = 1 AND DENEME > 0 THEN DENEME - 1 ELSE DENEME END
        OUTPUT INSERTED.YAZDIRILDI WHERE MUTFAK_FIS_ID = @F AND YAZDIRILDI = 0 AND (@DN IS NULL OR DENEME = @DN)`);
    return { guncellendi: r.recordset.length > 0 };
  }

  /** Kuyruk özeti (Masalar ekranındaki uyarı şeridi): basılamayan / eskiyen fiş sayısı ve "fiş basan bilgisayar yok" işareti */
  static async fisDurumu(ctx: DbBaglam | undefined, havuzu?: sql.ConnectionPool) {
    const pool = havuzu ?? (await havuz(ctx));
    const r = await pool.request().input("D", sql.Int, EN_COK_DENEME).input("E", sql.Int, FIS_ESKIME_DK).query(`SELECT
        SUM(CASE WHEN DENEME >= @D THEN 1 ELSE 0 END) AS DURDU,
        SUM(CASE WHEN DENEME < @D AND ZAMAN <= DATEADD(minute, -@E, GETDATE()) THEN 1 ELSE 0 END) AS ESKIDI,
        SUM(CASE WHEN DENEME < @D AND ZAMAN > DATEADD(minute, -@E, GETDATE()) THEN 1 ELSE 0 END) AS SIRADA,
        MAX(CASE WHEN DENEME < @D AND ZAMAN > DATEADD(minute, -@E, GETDATE()) THEN DATEDIFF(second, ZAMAN, GETDATE()) ELSE 0 END) AS BEKLEME
      FROM dbo.TODVZ_ADISYON_MUTFAK_FIS WHERE YAZDIRILDI = 0`);
    const x = r.recordset[0] || {};
    const sirada = Number(x.SIRADA) || 0;
    return { durdu: Number(x.DURDU) || 0, eskidi: Number(x.ESKIDI) || 0, sirada, istasyonYok: sirada > 0 && (Number(x.BEKLEME) || 0) > ISTASYON_UYARI_SN };
  }

  /** Basılmamış fişler (ayarlar ekranı: kuyruk, takılanlar) */
  static async bekleyenFisler(ctx?: DbBaglam) {
    const pool = await havuz(ctx);
    const r = await pool.request().input("D", sql.Int, EN_COK_DENEME).query(`SELECT TOP 200 F.MUTFAK_FIS_ID, F.TUR, F.ZAMAN, F.DENEME, F.HATA, F.ICERIK, RTRIM(H.AD) AS YER,
        CASE WHEN F.DENEME >= @D THEN 1 ELSE 0 END AS DURDU, CASE WHEN F.ZAMAN <= DATEADD(minute, -${FIS_ESKIME_DK}, GETDATE()) THEN 1 ELSE 0 END AS ESKIDI FROM dbo.TODVZ_ADISYON_MUTFAK_FIS F LEFT JOIN dbo.TODVZ_ADISYON_HAZIRLIK H ON H.YER_ID = F.YER_ID
      WHERE F.YAZDIRILDI = 0 ORDER BY F.MUTFAK_FIS_ID`);
    return r.recordset.map((x: any) => { const i = JSON.parse(String(x.ICERIK)); return { fisId: Number(x.MUTFAK_FIS_ID), tur: Number(x.TUR), deneme: Number(x.DENEME), hata: x.HATA ? temiz(x.HATA) : null, durdu: !!x.DURDU, eskidi: !!x.ESKIDI && !x.DURDU, yer: x.YER ? temiz(x.YER) : null, masa: i.masa, adisyonNo: i.adisyonNo, kalem: i.kalemler?.length || 0 }; });
  }

  /** Takılan fişi yeniden kuyruğa al (deneme sıfırlanır) ya da basıldı say */
  static async fisYeniden(ctx: DbBaglam | undefined, fisId: number, basildiSay = false) {
    const pool = await havuz(ctx);
    const r = await pool.request().input("F", sql.Int, fisId).input("B", sql.Bit, basildiSay ? 1 : 0)
      .query(`UPDATE dbo.TODVZ_ADISYON_MUTFAK_FIS SET DENEME = 0, YAZDIRMA_ZAMANI = CASE WHEN @B = 1 THEN GETDATE() ELSE NULL END, HATA = NULL, YAZDIRILDI = @B,
          ZAMAN = CASE WHEN @B = 1 THEN ZAMAN ELSE GETDATE() END
        OUTPUT INSERTED.MUTFAK_FIS_ID WHERE MUTFAK_FIS_ID = @F AND YAZDIRILDI = 0`);
    if (!r.recordset.length) throw ApiError.notFound("Fiş bulunamadı ya da basılmış.");
    return { tamam: true };
  }

  // ───────────── Mutfak ekranı (KDS) ─────────────
  /** Hazırlanan (ve son 30 dk'da hazır olan) kalemler, gönderim grubuna göre; yer verilmezse ekranı olan bütün yerler */
  static async siparisler(ctx: DbBaglam | undefined, yerId: number | null) {
    const pool = await havuz(ctx);
    const r = await pool.request().input("Y", sql.Int, yerId).query(`
      SELECT K.KALEM_ID, K.ADISYON_ID, RTRIM(A.ADISYON_NO) AS ADISYON_NO, RTRIM(M.AD) AS MASA, RTRIM(B.AD) AS BOLGE, A.TUR AS ATUR, A.MUSTERI_AD, RTRIM(G.AD) AS GARSON,
        K.AD, K.MIKTAR, RTRIM(K.BIRIM) AS BIRIM, K.PORSIYON_AD, K.SECENEKLER, K.NOTU, K.DURUM, K.YER_ID, RTRIM(H.AD) AS YER, K.EKLEYEN_AD,
        CONVERT(varchar(19), K.GONDERIM_ZAMANI, 120) AS GRUP, DATEDIFF(SECOND, K.GONDERIM_ZAMANI, GETDATE()) / 60 AS DAKIKA,
        DATEDIFF(SECOND, K.HAZIR_ZAMANI, GETDATE()) / 60 AS HAZIR_DAKIKA
      FROM dbo.TODVZ_ADISYON_KALEM K JOIN dbo.TODVZ_ADISYON A ON A.ADISYON_ID = K.ADISYON_ID
      JOIN dbo.TODVZ_ADISYON_HAZIRLIK H ON H.YER_ID = K.YER_ID AND H.EKRAN = 1
      LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID LEFT JOIN dbo.TODVZ_ADISYON_BOLGE B ON B.BOLGE_ID = M.BOLGE_ID
      LEFT JOIN dbo.TODVZ_ADISYON_GARSON G ON G.GARSON_ID = A.GARSON_ID
      WHERE K.IPTAL = 0 AND (@Y IS NULL OR K.YER_ID = @Y)
        AND K.GONDERIM_ZAMANI > DATEADD(hour, -24, GETDATE())
        AND (A.DURUM IN (0, 1) OR (A.DURUM = 2 AND A.TUR <> 1 AND ISNULL(A.PAKET_DURUM, 1) <> 3))
        AND (K.DURUM = 1 OR (K.DURUM = 2 AND K.HAZIR_ZAMANI > DATEADD(minute, -30, GETDATE())))
      ORDER BY K.GONDERIM_ZAMANI, K.ADISYON_ID, K.KALEM_ID`);
    const gruplar = new Map<string, any>();
    for (const k of r.recordset) {
      const anahtar = `${k.ADISYON_ID}|${k.GRUP}|${k.YER_ID}`;
      let g = gruplar.get(anahtar);
      if (!g) {
        g = { anahtar, adisyonId: Number(k.ADISYON_ID), adisyonNo: temiz(k.ADISYON_NO), masa: k.MASA ? temiz(k.MASA) : null, bolge: k.BOLGE ? temiz(k.BOLGE) : null,
          musteri: k.MUSTERI_AD ? temiz(k.MUSTERI_AD) : null, adisyonTuru: Number(k.ATUR) || 1, garson: k.GARSON ? temiz(k.GARSON) : k.EKLEYEN_AD ? temiz(k.EKLEYEN_AD) : null, yerId: Number(k.YER_ID), yer: temiz(k.YER),
          dakika: Math.max(0, Number(k.DAKIKA) || 0), kalemler: [] as any[] };
        gruplar.set(anahtar, g);
      }
      let secim = "";
      try { secim = secimMetni(JSON.parse(String(k.SECENEKLER || "[]"))); } catch { /* bozuk */ }
      g.kalemler.push({ kalemId: Number(k.KALEM_ID), ad: temiz(k.AD), miktar: Number(k.MIKTAR), birim: temiz(k.BIRIM), porsiyon: k.PORSIYON_AD ? temiz(k.PORSIYON_AD) : null, secim,
        notu: k.NOTU ? temiz(k.NOTU) : null, durum: Number(k.DURUM), hazirDakika: k.HAZIR_DAKIKA === null ? null : Math.max(0, Number(k.HAZIR_DAKIKA) || 0) });
    }
    const liste = [...gruplar.values()];
    return { bekleyen: liste.filter((g) => g.kalemler.some((k: any) => k.durum === KALEM_DURUM.HAZIRLANIYOR)), hazir: liste.filter((g) => g.kalemler.every((k: any) => k.durum === KALEM_DURUM.HAZIR)) };
  }

  /**
   * Kalemleri hazır yap (ya da geri al): yalnız Hazırlanıyor ↔ Hazır; yer verildiyse yalnız o yerin kalemleri (KDS bağlantısı
   * başka yerin kalemini değiştiremez). Garsona bildirim için "hazir" olayı (masa, garson, ürün adları).
   */
  static async hazir(ctx: DbBaglam | undefined, kalemIdler: number[], hazir: boolean, yerId: number | null = null) {
    const idler = [...new Set((kalemIdler || []).map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 200);
    if (!idler.length) throw ApiError.badRequest("Kalem seçilmeli.");
    const sonuc = await islem(ctx, async (tx) => {
      await adisyonlariKilitle(tx, idler);
      const r = await new sql.Request(tx).input("Y", sql.Int, yerId).input("ESKI", sql.TinyInt, hazir ? KALEM_DURUM.HAZIRLANIYOR : KALEM_DURUM.HAZIR)
        .input("YENI", sql.TinyInt, hazir ? KALEM_DURUM.HAZIR : KALEM_DURUM.HAZIRLANIYOR).query(`
        UPDATE K SET DURUM = @YENI, HAZIR_ZAMANI = CASE WHEN @YENI = 2 THEN GETDATE() ELSE NULL END
        OUTPUT INSERTED.KALEM_ID, INSERTED.ADISYON_ID, INSERTED.AD, INSERTED.YER_ID
        FROM dbo.TODVZ_ADISYON_KALEM K WHERE K.KALEM_ID IN (${idler.join(",")}) AND K.DURUM = @ESKI AND K.IPTAL = 0 AND (@Y IS NULL OR K.YER_ID = @Y)`);
      const degisen = r.recordset as any[];
      const adisyonlar = [...new Set(degisen.map((x) => Number(x.ADISYON_ID)))];
      for (const a of adisyonlar) {
        const bilgi = (await new sql.Request(tx).input("A", sql.Int, a).query(`SELECT A.MASA_ID, RTRIM(M.AD) AS MASA, A.GARSON_ID FROM dbo.TODVZ_ADISYON A LEFT JOIN dbo.TODVZ_ADISYON_MASA M ON M.MASA_ID = A.MASA_ID WHERE A.ADISYON_ID = @A`)).recordset[0];
        const urunler = degisen.filter((x) => Number(x.ADISYON_ID) === a).map((x) => temiz(x.AD));
        await new sql.Request(tx).input("A", sql.Int, a).query(`UPDATE dbo.TODVZ_ADISYON SET SURUM = SURUM + 1 WHERE ADISYON_ID = @A`);
        await olayYaz(tx, hazir ? "hazir" : "hazir-geri", { adisyonId: a, masaId: bilgi?.MASA_ID ?? null, yerId: Number(degisen.find((x) => Number(x.ADISYON_ID) === a).YER_ID),
          veri: { masa: bilgi?.MASA ? temiz(bilgi.MASA) : null, garsonId: bilgi?.GARSON_ID ?? null, urunler: urunler.slice(0, 10), adet: urunler.length } });
      }
      return { degisen: degisen.length, istenen: idler.length };
    });
    olayTetikle(ctx ?? {});
    return sonuc;
  }

  /** Servis edildi (garson / kasa): Hazır ya da Hazırlanıyor → Serviste */
  static async servis(ctx: DbBaglam | undefined, kalemIdler: number[]) {
    const idler = [...new Set((kalemIdler || []).map(Number).filter((x) => Number.isInteger(x) && x > 0))].slice(0, 200);
    if (!idler.length) throw ApiError.badRequest("Kalem seçilmeli.");
    const n = await islem(ctx, async (tx) => {
      await adisyonlariKilitle(tx, idler);
      const r = await new sql.Request(tx).query(`UPDATE dbo.TODVZ_ADISYON_KALEM SET DURUM = 3 OUTPUT INSERTED.ADISYON_ID, INSERTED.YER_ID
        WHERE KALEM_ID IN (${idler.join(",")}) AND DURUM IN (1, 2) AND IPTAL = 0`);
      for (const a of [...new Set(r.recordset.map((x: any) => Number(x.ADISYON_ID)))]) {
        const m = (await new sql.Request(tx).input("A", sql.Int, a).query(`UPDATE dbo.TODVZ_ADISYON SET SURUM = SURUM + 1 OUTPUT INSERTED.MASA_ID WHERE ADISYON_ID = @A`)).recordset[0];
        // Yer başına bir olay: mutfak ekranı yalnız kendi yerinin olaylarını alır (servis edilen kalem ekrandan düşsün)
        const yerler = [...new Set(r.recordset.filter((x: any) => Number(x.ADISYON_ID) === a).map((x: any) => (x.YER_ID === null || x.YER_ID === undefined ? null : Number(x.YER_ID))))];
        for (const y of yerler.length ? yerler : [null]) await olayYaz(tx, "servis", { adisyonId: a, masaId: m?.MASA_ID ?? null, yerId: y });
      }
      return r.recordset.length;
    });
    olayTetikle(ctx ?? {});
    return { degisen: n };
  }

  // ───────────── KDS bağlantı anahtarı ─────────────
  /** Hazırlık yerine mutfak ekranı anahtarı üretir (eskisini geçersiz kılar); anahtar bir kez gösterilir */
  static async ekranAnahtari(ctx: DbBaglam | undefined, yerId: number) {
    const anahtar = yeniCihazAnahtari();
    const pool = await havuz(ctx);
    const r = await pool.request().input("Y", sql.Int, yerId).input("O", sql.VarChar(100), cihazOzeti(anahtar))
      .query(`UPDATE dbo.TODVZ_ADISYON_HAZIRLIK SET EKRAN_ANAHTAR_OZET = @O, EKRAN = 1 OUTPUT INSERTED.AD WHERE YER_ID = @Y AND AKTIF = 1`);
    if (!r.recordset.length) throw ApiError.notFound("Hazırlık yeri bulunamadı ya da pasif.");
    return { yerId, yer: temiz(r.recordset[0].AD), anahtar };
  }

  static async ekranAnahtariSil(ctx: DbBaglam | undefined, yerId: number) {
    const pool = await havuz(ctx);
    await pool.request().input("Y", sql.Int, yerId).query(`UPDATE dbo.TODVZ_ADISYON_HAZIRLIK SET EKRAN_ANAHTAR_OZET = NULL WHERE YER_ID = @Y`);
    return { silindi: true };
  }

  /** Anahtardan hazırlık yeri (KDS girişi / her istek) */
  static async anahtarYeri(ctx: DbBaglam, anahtarOzeti: string): Promise<{ yerId: number; ad: string } | null> {
    const pool = await havuz(ctx);
    const r = await pool.request().input("O", sql.VarChar(100), anahtarOzeti).query(`SELECT YER_ID, RTRIM(AD) AS AD FROM dbo.TODVZ_ADISYON_HAZIRLIK WHERE EKRAN_ANAHTAR_OZET = @O AND AKTIF = 1 AND EKRAN = 1`);
    return r.recordset.length ? { yerId: Number(r.recordset[0].YER_ID), ad: temiz(r.recordset[0].AD) } : null;
  }
}

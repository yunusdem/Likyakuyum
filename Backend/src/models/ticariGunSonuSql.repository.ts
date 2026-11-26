import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { kendiKayitKosulu, type KendiKayit } from "../utils/kendiKayit.js";
import { odemeAraciAdi, yuvarla2 } from "../services/ticari/ticariHesap.js";
import { DbBaglam, TicariStokSqlRepository } from "./ticariStokSql.repository.js";

/**
 * Ticari gün sonu satış raporu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA7). Kaynak Ticari fişleri (FIS_KAYNAGI 1): satış (FATURA_TIPI 1)
 * ve iade (FATURA_TIPI 2). Gün Satış Listesi'yle aynı kuralla seçilir: Türkiye günü = CAST(DATEADD(hour, 3, TARIH) AS date).
 * Süzgeçler: tarih aralığı, kasiyer (fişi ekleyen), vezne; "kendi kayıtları" yetkisi Satış Listesi'ndeki gibi uygulanır.
 * Tutarlar KDV dahil (müşterinin ödediği); matrah / KDV ayrıca. Ürün satırlarının toplamı fiş toplamına kuruşu kuruşuna eşittir
 * (fiş iskontosu satırlara dağıtılmış saklanır).
 */

export interface GunSonuSuzgec {
  baslangic: string;
  bitis: string;
  kasiyerId?: number | null;
  vezneId?: number | null;
  kendi?: KendiKayit | null;
}

export interface GunSonuTutar { adet: number; brut: number; iskonto: number; fisIskontosu: number; net: number; matrah: number; kdv: number }

export interface GunSonuRaporu {
  suzgec: { baslangic: string; bitis: string; kasiyer: string | null; vezne: string | null };
  satis: GunSonuTutar;
  iade: GunSonuTutar;
  /** satış − iade */
  net: { net: number; matrah: number; kdv: number };
  odemeler: { tur: string; paraKodu: string; satis: number; iade: number; net: number; dovizMiktar: number | null }[];
  /** Ödemesi fiş toplamından az kalan (açık) tutar: satış − iade − ödemeler */
  odemesiz: number;
  kdvOranlari: { oran: number; matrah: number; kdv: number; toplam: number }[];
  urunler: { stokKartId: number | null; kod: string; ad: string; birim: string; grup: string; satisMiktar: number; iadeMiktar: number; netMiktar: number; satis: number; iade: number; net: number }[];
  gruplar: { grup: string; kalem: number; satis: number; iade: number; net: number }[];
  kasiyerler: { kullaniciId: number | null; ad: string; satisAdet: number; iadeAdet: number; net: number }[];
  saatler: { saat: number; adet: number; net: number }[];
  /** Süzgeçte seçilebilecek kasiyerler (tarih aralığında fişi olanlar; kasiyer süzgecinden bağımsız) */
  kasiyerSecenekleri: { kullaniciId: number; ad: string }[];
}

const temiz = (v: unknown): string => String(v ?? "").trim();
const GUN = (a: string) => `CAST(DATEADD(hour, 3, ${a}.TARIH) AS date)`;
const gunMu = (s: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(temiz(s)) && !Number.isNaN(Date.parse(`${temiz(s)}T00:00:00Z`));
const n2 = (v: unknown) => yuvarla2(Number(v) || 0);

export class TicariGunSonuSqlRepository {
  static async rapor(f: GunSonuSuzgec, ctx?: DbBaglam): Promise<GunSonuRaporu> {
    if (!gunMu(f.baslangic) || !gunMu(f.bitis)) throw ApiError.badRequest("Başlangıç ve bitiş günü YYYY-AA-GG biçiminde olmalı.");
    if (f.baslangic > f.bitis) throw ApiError.badRequest("Başlangıç günü bitişten sonra olamaz.");
    if ((Date.parse(f.bitis) - Date.parse(f.baslangic)) / 86_400_000 > 366) throw ApiError.badRequest("Rapor aralığı en çok bir yıl olabilir.");
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const req = pool.request().input("BAS", sql.VarChar(10), f.baslangic).input("BIT", sql.VarChar(10), f.bitis);
    const temel = [`ISNULL(F.FIS_KAYNAGI, 0) = 1`, `ISNULL(F.FATURA_TIPI, 1) IN (1, 2)`, `${GUN("F")} >= CAST(@BAS AS date)`, `${GUN("F")} <= CAST(@BIT AS date)`];
    const kk = kendiKayitKosulu(req, "F", f.kendi);
    if (kk) temel.push(kk);
    const suz = [...temel];
    if (f.kasiyerId) { req.input("KAS", sql.Int, f.kasiyerId); suz.push("F.EKLEYEN_ID = @KAS"); }
    if (f.vezneId) { req.input("VEZ", sql.Int, f.vezneId); suz.push("F.VEZNE_ID = @VEZ"); }
    const r = await req.query(`
      SET NOCOUNT ON;
      DECLARE @F TABLE (FATURA_ID INT PRIMARY KEY, T TINYINT NOT NULL, EKLEYEN_ID INT NULL, SAAT INT NOT NULL, FIS_ISK FLOAT NOT NULL, GENEL FLOAT NOT NULL);
      INSERT INTO @F (FATURA_ID, T, EKLEYEN_ID, SAAT, FIS_ISK, GENEL)
        SELECT F.FATURA_ID, ISNULL(F.FATURA_TIPI, 1), F.EKLEYEN_ID, DATEPART(hour, DATEADD(hour, 3, F.TARIH)),
          CASE WHEN ISNULL(F.FATURA_TIPI, 1) = 1 THEN ISNULL(F.ISKONTO_TUTARI, 0) ELSE 0 END, ISNULL(F.GENEL_TOPLAM, 0)
        FROM dbo.TODVZ_FATURA F WHERE ${suz.join(" AND ")};
      DECLARE @S TABLE (FATURA_ID INT, T TINYINT, STOK_KART_ID INT NULL, URUN_ADI NVARCHAR(200), BIRIM NVARCHAR(20), MIKTAR FLOAT, KDV_ORANI FLOAT,
        BRUT FLOAT, MATRAH FLOAT, KDV FLOAT, TOPLAM FLOAT);
      INSERT INTO @S
        SELECT S.FATURA_ID, X.T, S.STOK_KART_ID, RTRIM(ISNULL(S.URUN_ADI, '')), RTRIM(ISNULL(S.BIRIM, '')), ISNULL(S.MIKTAR, 0), ISNULL(S.KDV_ORANI, 0),
          ROUND(ISNULL(S.MIKTAR, 0) * ISNULL(S.KDV_DAHIL_FIYAT, 0), 2), ISNULL(S.TUTAR, 0) - ISNULL(S.SATIR_ISKONTO_TUTARI, 0), ISNULL(S.KDV_TUTARI, 0), ISNULL(S.TOPLAM_TUTAR, 0)
        FROM @F X JOIN dbo.TODVZ_FATURA_SATIRI S ON S.FATURA_ID = X.FATURA_ID;
      -- 0 fiş adet / toplam / fiş iskontosu
      SELECT T, COUNT(*) AS N, SUM(GENEL) AS GENEL, SUM(FIS_ISK) AS FIS_ISK FROM @F GROUP BY T;
      -- 1 satır toplamları
      SELECT T, SUM(BRUT) AS BRUT, SUM(TOPLAM) AS TOPLAM, SUM(MATRAH) AS MATRAH, SUM(KDV) AS KDV FROM @S GROUP BY T;
      -- 2 KDV oranları (satış − iade)
      SELECT KDV_ORANI AS ORAN, SUM(CASE WHEN T = 2 THEN -MATRAH ELSE MATRAH END) AS MATRAH, SUM(CASE WHEN T = 2 THEN -KDV ELSE KDV END) AS KDV,
        SUM(CASE WHEN T = 2 THEN -TOPLAM ELSE TOPLAM END) AS TOPLAM FROM @S GROUP BY KDV_ORANI ORDER BY KDV_ORANI;
      -- 3 ürünler (serbest satır ada göre)
      SELECT Y.STOK_KART_ID, MAX(RTRIM(ISNULL(K.KOD, ''))) AS KOD, MAX(COALESCE(NULLIF(RTRIM(K.AD), ''), Y.URUN_ADI)) AS AD,
        MAX(COALESCE(NULLIF(RTRIM(K.BIRIM), ''), Y.BIRIM)) AS BIRIM, MAX(RTRIM(ISNULL(G.AD, ''))) AS GRUP,
        SUM(CASE WHEN Y.T = 1 THEN Y.MIKTAR ELSE 0 END) AS SM, SUM(CASE WHEN Y.T = 2 THEN Y.MIKTAR ELSE 0 END) AS IM,
        SUM(CASE WHEN Y.T = 1 THEN Y.TOPLAM ELSE 0 END) AS ST, SUM(CASE WHEN Y.T = 2 THEN Y.TOPLAM ELSE 0 END) AS IT
      FROM @S Y LEFT JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID = Y.STOK_KART_ID LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID
      GROUP BY Y.STOK_KART_ID, CASE WHEN Y.STOK_KART_ID IS NULL THEN Y.URUN_ADI END;
      -- 4 ödemeler
      SELECT X.T, ISNULL(O.ODEME_ARACI_TURU, 0) AS OAT, UPPER(RTRIM(ISNULL(NULLIF(O.PARA_KODU, ''), 'TL'))) AS PK, SUM(ISNULL(O.TUTAR, 0)) AS TUTAR,
        SUM(ISNULL(NULLIF(O.MIKTAR, 0), ISNULL(O.TUTAR, 0) / NULLIF(O.KUR, 0))) AS MIKTAR
      FROM @F X JOIN dbo.TODVZ_FATURA_ODEME O ON O.FATURA_ID = X.FATURA_ID
      GROUP BY X.T, ISNULL(O.ODEME_ARACI_TURU, 0), UPPER(RTRIM(ISNULL(NULLIF(O.PARA_KODU, ''), 'TL')));
      -- 5 kasiyerler
      SELECT X.EKLEYEN_ID, RTRIM(ISNULL(U.AD, '')) AS AD, SUM(CASE WHEN X.T = 1 THEN 1 ELSE 0 END) AS SA, SUM(CASE WHEN X.T = 2 THEN 1 ELSE 0 END) AS IA,
        SUM(CASE WHEN X.T = 2 THEN -X.GENEL ELSE X.GENEL END) AS NET
      FROM @F X LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID = X.EKLEYEN_ID GROUP BY X.EKLEYEN_ID, U.AD;
      -- 6 saatler (Türkiye saati)
      SELECT SAAT, SUM(CASE WHEN T = 1 THEN 1 ELSE 0 END) AS N, SUM(CASE WHEN T = 2 THEN -GENEL ELSE GENEL END) AS NET FROM @F GROUP BY SAAT ORDER BY SAAT;
      -- 7 kasiyer seçenekleri (kasiyer / vezne süzgeci olmadan)
      SELECT DISTINCT F.EKLEYEN_ID AS ID, RTRIM(ISNULL(U.AD, '')) AS AD FROM dbo.TODVZ_FATURA F LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID = F.EKLEYEN_ID
      WHERE ${temel.join(" AND ")} AND F.EKLEYEN_ID IS NOT NULL;
      -- 8 süzgeç adları
      SELECT (SELECT RTRIM(AD) FROM dbo.TODVZ_KULLANICI WHERE KULLANICI_ID = ${f.kasiyerId ? "@KAS" : "NULL"}) AS KASIYER,
        (SELECT RTRIM(ISNULL(KOD,'')) + CASE WHEN NULLIF(RTRIM(AD),'') IS NULL THEN '' ELSE ' - ' + RTRIM(AD) END FROM dbo.TODVZ_VEZNE WHERE VEZNE_ID = ${f.vezneId ? "@VEZ" : "NULL"}) AS VEZNE;`);
    const rs = r.recordsets as any[];
    const tutar = (t: number): GunSonuTutar => {
      const a = rs[0].find((x: any) => Number(x.T) === t), s = rs[1].find((x: any) => Number(x.T) === t);
      const brut = n2(s?.BRUT), net = n2(s?.TOPLAM), fisIskontosu = n2(a?.FIS_ISK);
      return { adet: Number(a?.N || 0), brut, iskonto: yuvarla2(brut - net), fisIskontosu, net, matrah: n2(s?.MATRAH), kdv: n2(s?.KDV) };
    };
    const satis = tutar(1), iade = tutar(2);
    const odemeHarita = new Map<string, GunSonuRaporu["odemeler"][number]>();
    let odenen = 0;
    for (const o of rs[4]) {
      const tur = odemeAraciAdi(Number(o.OAT)), pk = temiz(o.PK) === "TRY" ? "TL" : temiz(o.PK) || "TL";
      const k = `${Number(o.OAT)}|${pk}`;
      const s = odemeHarita.get(k) || { tur, paraKodu: pk, satis: 0, iade: 0, net: 0, dovizMiktar: pk === "TL" ? null : 0 };
      const isaret = Number(o.T) === 2 ? -1 : 1;
      if (isaret < 0) s.iade = yuvarla2(s.iade + Number(o.TUTAR)); else s.satis = yuvarla2(s.satis + Number(o.TUTAR));
      s.net = yuvarla2(s.satis - s.iade);
      if (s.dovizMiktar !== null) s.dovizMiktar = Math.round((s.dovizMiktar + isaret * (Number(o.MIKTAR) || 0)) * 10000) / 10000;
      odenen += isaret * (Number(o.TUTAR) || 0);
      odemeHarita.set(k, s);
    }
    const sira = (t: string) => ["Nakit", "POS / Kart", "Cari (veresiye)", "Banka"].indexOf(t);
    const urunler = rs[3].map((u: any) => ({
      stokKartId: u.STOK_KART_ID === null ? null : Number(u.STOK_KART_ID), kod: temiz(u.KOD), ad: temiz(u.AD), birim: temiz(u.BIRIM), grup: temiz(u.GRUP) || "Grupsuz",
      satisMiktar: Math.round(Number(u.SM) * 10000) / 10000, iadeMiktar: Math.round(Number(u.IM) * 10000) / 10000, netMiktar: Math.round((Number(u.SM) - Number(u.IM)) * 10000) / 10000,
      satis: n2(u.ST), iade: n2(u.IT), net: yuvarla2(n2(u.ST) - n2(u.IT)),
    })).sort((a: any, b: any) => b.net - a.net || a.ad.localeCompare(b.ad, "tr"));
    const grupHarita = new Map<string, GunSonuRaporu["gruplar"][number]>();
    for (const u of urunler) {
      const g = grupHarita.get(u.grup) || { grup: u.grup, kalem: 0, satis: 0, iade: 0, net: 0 };
      g.kalem += 1; g.satis = yuvarla2(g.satis + u.satis); g.iade = yuvarla2(g.iade + u.iade); g.net = yuvarla2(g.satis - g.iade);
      grupHarita.set(u.grup, g);
    }
    const ad = rs[8][0] || {};
    return {
      suzgec: { baslangic: f.baslangic, bitis: f.bitis, kasiyer: f.kasiyerId ? temiz(ad.KASIYER) || `#${f.kasiyerId}` : null, vezne: f.vezneId ? temiz(ad.VEZNE) || `#${f.vezneId}` : null },
      satis, iade,
      net: { net: yuvarla2(satis.net - iade.net), matrah: yuvarla2(satis.matrah - iade.matrah), kdv: yuvarla2(satis.kdv - iade.kdv) },
      odemeler: [...odemeHarita.values()].sort((a, b) => sira(a.tur) - sira(b.tur) || a.paraKodu.localeCompare(b.paraKodu)),
      odemesiz: yuvarla2(satis.net - iade.net - odenen),
      kdvOranlari: rs[2].map((k: any) => ({ oran: Number(k.ORAN), matrah: n2(k.MATRAH), kdv: n2(k.KDV), toplam: n2(k.TOPLAM) })),
      urunler,
      gruplar: [...grupHarita.values()].sort((a, b) => b.net - a.net || a.grup.localeCompare(b.grup, "tr")),
      kasiyerler: rs[5].map((k: any) => ({ kullaniciId: k.EKLEYEN_ID === null ? null : Number(k.EKLEYEN_ID), ad: temiz(k.AD) || (k.EKLEYEN_ID ? `#${k.EKLEYEN_ID}` : "Bilinmiyor"), satisAdet: Number(k.SA), iadeAdet: Number(k.IA), net: n2(k.NET) }))
        .sort((a: any, b: any) => b.net - a.net),
      saatler: rs[6].map((s: any) => ({ saat: Number(s.SAAT), adet: Number(s.N), net: n2(s.NET) })),
      kasiyerSecenekleri: rs[7].map((k: any) => ({ kullaniciId: Number(k.ID), ad: temiz(k.AD) || `#${k.ID}` })).sort((a: any, b: any) => a.ad.localeCompare(b.ad, "tr")),
    };
  }
}

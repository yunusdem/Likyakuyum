import sql from "mssql";
import { ApiError } from "../utils/ApiError.js";
import { bugunTr } from "../utils/zaman.utils.js";
import { gecerliGun, sktDurumu, sktPartiDagit, yuvarla2 } from "../services/ticari/ticariHesap.js";
import { DbBaglam, TicariStokSqlRepository } from "./ticariStokSql.repository.js";

/**
 * SKT yaklaşanlar raporu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA16). SKT yalnız girişte yazılır, satışta parti seçilmez: eldeki stok
 * en yeni girişlerden geriye doğru partilere dağıtılır (ilk giren ilk çıkar varsayımı, sktPartiDagit). Partinin miktarından o giriş
 * satırından tedarikçiye iade edilen düşülür. Stokta kalan tahmini > 0 olan ve SKT'si bugün + eşik içinde (ya da geçmiş) partiler listelenir.
 */
const temiz = (v: unknown): string => String(v ?? "").trim();
const y4 = (n: number) => Math.round(n * 10000) / 10000;

export interface SktSatiri {
  stokKartId: number; kod: string; ad: string; birim: string; grup: string;
  stokGirisId: number; fisNo: string; girisGunu: string; partiNo: string | null; skt: string; kalanGun: number; durum: "gecti" | "bugun" | "yaklasiyor" | "uzak";
  partiMiktar: number; kalan: number; birimFiyat: number; deger: number; kartBakiye: number;
}

export class TicariSktSqlRepository {
  static async yaklasanlar(f: { gun?: number | null; grupId?: number | null; arama?: string | null; bugun?: string | null; tumu?: boolean } = {}, ctx?: DbBaglam) {
    const pool = await TicariStokSqlRepository.havuz(ctx);
    const esik = f.gun === null || f.gun === undefined || String(f.gun) === "" ? await TicariStokSqlRepository.sktUyariGun(pool) : Number(f.gun);
    if (!Number.isInteger(esik) || esik < 0 || esik > 3650) throw ApiError.badRequest("Gün eşiği 0 ile 3650 arasında tam sayı olmalı.");
    const bugun = temiz(f.bugun) || bugunTr();
    if (!gecerliGun(bugun)) throw ApiError.badRequest("Gün YYYY-AA-GG biçiminde olmalı.");
    const req = pool.request();
    const k: string[] = ["EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_GIRIS_SATIRI X WHERE X.STOK_KART_ID = K.STOK_KART_ID AND X.SKT IS NOT NULL)"];
    if (f.grupId) { req.input("GRUP", sql.Int, f.grupId); k.push("K.STOK_GRUP_ID = @GRUP"); }
    const ara = temiz(f.arama).slice(0, 100);
    if (ara) { req.input("ARA", sql.NVarChar(110), `%${ara}%`); k.push("(K.KOD LIKE @ARA OR K.AD LIKE @ARA OR EXISTS (SELECT 1 FROM dbo.TODVZ_STOK_BARKOD B WHERE B.STOK_KART_ID = K.STOK_KART_ID AND B.BARKOD LIKE @ARA))"); }
    // 1) Kartlar ve bakiyeleri; 2) bu kartların bütün giriş satırları (SKT'siz girişler de stoğun parçası) − giriş satırından tedarikçiye iade
    const r = await req.query(`
      DECLARE @KR TABLE (ID INT PRIMARY KEY, KOD VARCHAR(30), AD NVARCHAR(200), BIRIM VARCHAR(20), GRUP NVARCHAR(100), BAKIYE FLOAT);
      INSERT INTO @KR
      SELECT K.STOK_KART_ID, RTRIM(K.KOD), K.AD, RTRIM(ISNULL(K.BIRIM, 'Adet')), RTRIM(ISNULL(G.AD, '')),
        ISNULL((SELECT SUM(H.GIRIS - H.CIKIS) FROM dbo.TODVZ_STOK_HAREKET H WHERE H.STOK_KART_ID = K.STOK_KART_ID), 0)
      FROM dbo.TODVZ_STOK_KART K LEFT JOIN dbo.TODVZ_STOK_GRUP G ON G.STOK_GRUP_ID = K.STOK_GRUP_ID
      WHERE ${k.join(" AND ")};
      SELECT * FROM @KR WHERE BAKIYE > 0.00005 ORDER BY ID;
      SELECT S.STOK_KART_ID, S.STOK_GIRIS_ID, S.SATIR_NO, RTRIM(GI.FIS_NO) AS FIS_NO, GI.TARIH, CONVERT(char(10), DATEADD(hour, 3, GI.TARIH), 23) AS GIRIS_GUNU,
        S.MIKTAR - ISNULL((SELECT SUM(TS.MIKTAR) FROM dbo.TODVZ_STOK_TEDARIKCI_IADE_SATIR TS JOIN dbo.TODVZ_STOK_TEDARIKCI_IADE T ON T.IADE_ID = TS.IADE_ID
          WHERE T.STOK_GIRIS_ID = S.STOK_GIRIS_ID AND TS.GIRIS_SATIR_NO = S.SATIR_NO), 0) AS MIKTAR,
        CONVERT(char(10), S.SKT, 23) AS SKT, S.PARTI_NO, S.BIRIM_FIYAT
      FROM dbo.TODVZ_STOK_GIRIS_SATIRI S JOIN dbo.TODVZ_STOK_GIRIS GI ON GI.STOK_GIRIS_ID = S.STOK_GIRIS_ID
      WHERE S.STOK_KART_ID IN (SELECT ID FROM @KR WHERE BAKIYE > 0.00005)
      UNION ALL
      -- Parçalama çıktıları (TA17) da stoğa girer: SKT'siz parti olarak dağıtıma katılır (sıra anahtarı giriş satırlarından ayrışsın diye eksi)
      SELECT PS.STOK_KART_ID, -P.PARCALAMA_ID, PS.SATIR_NO, RTRIM(P.PARCALAMA_NO), P.TARIH, CONVERT(char(10), DATEADD(hour, 3, P.TARIH), 23), PS.MIKTAR, NULL, NULL, PS.BIRIM_MALIYET
      FROM dbo.TODVZ_STOK_PARCALAMA_SATIR PS JOIN dbo.TODVZ_STOK_PARCALAMA P ON P.PARCALAMA_ID = PS.PARCALAMA_ID
      WHERE PS.STOK_KART_ID IN (SELECT ID FROM @KR WHERE BAKIYE > 0.00005);`);
    const rs = r.recordsets as any[];
    const kartlar = new Map<number, any>((rs[0] || []).map((x: any) => [Number(x.ID), x]));
    const partiler = new Map<number, any[]>();
    for (const p of rs[1] || []) {
      const id = Number(p.STOK_KART_ID);
      const l = partiler.get(id) || [];
      l.push({ zaman: new Date(p.TARIH).getTime(), sira: Number(p.STOK_GIRIS_ID) * 10000 + Number(p.SATIR_NO), miktar: Number(p.MIKTAR) || 0, skt: p.SKT ? temiz(p.SKT) : null, ham: p });
      partiler.set(id, l);
    }
    const satirlar: SktSatiri[] = [];
    for (const [id, kr] of kartlar) {
      const bakiye = y4(Number(kr.BAKIYE) || 0);
      for (const p of sktPartiDagit(partiler.get(id) || [], bakiye)) {
        if (!p.skt || !(p.kalan > 0)) continue;
        const d = sktDurumu(p.skt, bugun, esik);
        if (!f.tumu && d.durum === "uzak") continue;
        const bf = Number(p.ham.BIRIM_FIYAT) || 0;
        satirlar.push({ stokKartId: id, kod: temiz(kr.KOD), ad: temiz(kr.AD), birim: temiz(kr.BIRIM), grup: temiz(kr.GRUP) || "Grupsuz",
          stokGirisId: Number(p.ham.STOK_GIRIS_ID), fisNo: temiz(p.ham.FIS_NO), girisGunu: temiz(p.ham.GIRIS_GUNU), partiNo: p.ham.PARTI_NO ? temiz(p.ham.PARTI_NO) : null,
          skt: p.skt, kalanGun: d.kalanGun, durum: d.durum, partiMiktar: y4(p.miktar), kalan: p.kalan, birimFiyat: bf, deger: yuvarla2(p.kalan * bf), kartBakiye: bakiye });
      }
    }
    satirlar.sort((a, b) => (a.skt < b.skt ? -1 : a.skt > b.skt ? 1 : a.ad.localeCompare(b.ad, "tr") || a.stokGirisId - b.stokGirisId));
    const say = (d: SktSatiri["durum"]) => { const l = satirlar.filter((x) => x.durum === d); return { parti: l.length, kart: new Set(l.map((x) => x.stokKartId)).size, deger: yuvarla2(l.reduce((t, x) => t + x.deger, 0)) }; };
    return { esikGun: esik, bugun, satirlar, ozet: { gecti: say("gecti"), bugun: say("bugun"), yaklasiyor: say("yaklasiyor"), uzak: say("uzak") } };
  }
}

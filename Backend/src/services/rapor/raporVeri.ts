import sql from "mssql";
import { ApiError } from "../../utils/ApiError.js";
import { RAPOR_UST_SINIR, type RaporSonucVeri, type RaporTanim } from "./raporTanim.js";
import {
  type RaporParametreler, tarihTr, HAREKET_TIPI, KISILIK, kurCoz, hedefPara, gunOnce, kurTarihte, sinirla, TL_PARA_SQL, aralikOzeti, filtreler, paraKumesi, ozetEk,
  vezneBakiyeleri, VEZNE_BAKIYE_DIPNOT,
} from "./raporOrtak.js";
export type { RaporParametreler } from "./raporOrtak.js";
import { KASA_SORGULARI } from "./veri/kasa.js";
import { VEZNE_SORGULARI } from "./veri/vezne.js";
import { CARI2_SORGULARI } from "./veri/cari.js";
import { FIS_SORGULARI } from "./veri/fis.js";
import { ANALIZ_SORGULARI } from "./veri/analiz.js";
import { MASAK_SORGULARI } from "./veri/masak.js";
import { YONETICI_SORGULARI } from "./veri/yonetici.js";

/**
 * Rapor veri katmanı — yalnızca SELECT. Hiçbir tabloya yazılmaz, SP çağrılmaz.
 * Tablolar: TODVZ_CARI_KART, TODVZ_CARI_HAREKET(+_SATIRI), TODVZ_FIS(+_SATIRI), TODVZ_VEZNE, TODVZ_PARA,
 * TODVZ_KUR_TABLOSU / TODVZ_KUR. Kolon adları mevcut repository'lerden alındı (bkz. docs/raporlar.md Bölüm 2).
 */

export const RAPOR_SORGULARI: Record<string, (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>> = {
  // 2. dalga raporları alan dosyalarında (veri/*.ts) — docs/raporlar-faz2.md
  ...KASA_SORGULARI,
  ...VEZNE_SORGULARI,
  ...CARI2_SORGULARI,
  ...FIS_SORGULARI,
  ...ANALIZ_SORGULARI,
  ...MASAK_SORGULARI,
  ...YONETICI_SORGULARI,

  /** R1 Cari bakiye raporu — tarih aralığı (yönetici 14.09.2026): borç/alacak aralıktaki hareketler, bakiye bitiş tarihi itibarıyla; para ve has bazında; sıfır bakiyeliler hariç (kullanıcı kararı 19.09.2026) */
  async CARBAK1(pool, p, t) {
    const bas = p.baslangic || p.tarih, bit = p.bitis || p.tarih;
    if (!bas || !bit) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    // Kur seçimi (eski VODVZR_CARI_BAKIYE_RAPORU'daki kur karşılığı; yönetici kararı 17.09.2026: has ve TL karşılığı birlikte görünür)
    const kur = await kurCoz(pool, { ...p, kurTarihi: p.kurTarihi || bit });
    const req = pool.request().input("bas", sql.Date, bas).input("t", sql.Date, bit);
    const f = filtreler(req, p, { cari: "C", para: "B.PARA_ID" });
    const res = await req.query(`
      ;WITH B AS (
        SELECT H.CARI_KART_ID, S.PARA_ID,
          SUM(CASE WHEN H.TIP=0 AND CAST(H.TARIH AS date)>=@bas THEN S.MEBLAG ELSE 0 END) BORC, SUM(CASE WHEN H.TIP=1 AND CAST(H.TARIH AS date)>=@bas THEN S.MEBLAG ELSE 0 END) ALACAK,
          SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE -S.MEBLAG END) BAKIYE
        FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
        WHERE CAST(H.TARIH AS date)<=@t GROUP BY H.CARI_KART_ID, S.PARA_ID)
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd,
        B.PARA_ID paraId, ISNULL(RTRIM(P.KOD),'-') paraKod, ISNULL(B.BORC,0) borc, ISNULL(B.ALACAK,0) alacak,
        ISNULL(B.BAKIYE,0) bakiye, ISNULL(P.HAS_ORANI,0) hasOrani
      FROM dbo.TODVZ_CARI_KART C
      LEFT JOIN B ON B.CARI_KART_ID=C.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=B.PARA_ID
      WHERE 1=1 ${f}
      ORDER BY C.KOD, ISNULL(P.SIRA_NO,99), P.KOD;`);
    // Eski "CARİ BAKİYE RAPORU" metrikleri: net = borç − alacak; Borç bakiye = net > 0, Alacak bakiye = net < 0 (mutlak). Sıfır bakiyeli satırlar listelenmez (eski rapor: BAKIYE <> 0).
    const satirlar = res.recordset.map((r: any) => {
      const bakiye = Number(r.bakiye) || 0, net = -bakiye;
      return { ...r, borc: Number(r.borc), alacak: Number(r.alacak), bakiye: Math.abs(bakiye), net,
        borcBakiye: net > 0 ? net : 0, alacakBakiye: net < 0 ? -net : 0,
        yon: bakiye > 0 ? "Alacak" : bakiye < 0 ? "Borç" : "-",
        hasKarsiligi: Math.abs(bakiye) * (Number(r.hasOrani) || 0),
        kur: kur.kurlar.get(Number(r.paraId)) ?? 0, tlKarsiligi: -bakiye * (kur.kurlar.get(Number(r.paraId)) ?? 0),
        kurSatis: kur.satisKurlari.get(Number(r.paraId)) ?? 0, tlSatis: -bakiye * (kur.satisKurlari.get(Number(r.paraId)) ?? 0), cariBaslik: `${r.cariKod} — ${r.cariAd}` };
    }).filter((s: any) => Math.abs(s.net) > 1e-9);
    // Para bazında "Toplam :" (borç / alacak bakiye toplamları) ve "Bakiye :" (net, B/A) — eski rapordaki grup altlıklarının karşılığı
    const pt = new Map<string, { paraKod: string; borcBakiye: number; alacakBakiye: number }>();
    for (const x of satirlar) { if (!pt.has(x.paraKod)) pt.set(x.paraKod, { paraKod: x.paraKod, borcBakiye: 0, alacakBakiye: 0 }); const o = pt.get(x.paraKod)!; o.borcBakiye += x.borcBakiye; o.alacakBakiye += x.alacakBakiye; }
    const paraToplamlari = [...pt.values()].map(o => { const n = o.borcBakiye - o.alacakBakiye; return { ...o, netBakiye: Math.abs(n), bakiyeTipi: n > 0 ? "B" : n < 0 ? "A" : "" }; });
    return sinirla(satirlar, t, `${tarihTr(bas)} – ${tarihTr(bit)}${ozetEk(p) || " · Tüm cariler"} · ${kur.aciklama}`,
      "Borç bakiye / Alacak bakiye bitiş tarihi itibarıyla tüm hareketlerden hesaplanan net bakiyenin yönüdür (Borç = carinin bize borcu, Alacak = carinin bizden alacağı); sıfır bakiyeli satırlar listelenmez. Dönem borç ve dönem alacak seçilen tarih aralığındaki hareket toplamlarıdır. Has karşılığı = bakiye × para tanımındaki has oranı.",
      paraToplamlari);
  },

  /** R2 Cari ekstre — cari aralığı (Ahmet -> Mehmet), tarih aralığı, para (çoklu); cari × para grubu, cari başlık bilgisi, devir + yürüyen bakiye, fiş no, has karşılığı */
  async CAREKS1(pool, p, t) {
    if (!p.cariKartId && !p.cariIdler?.length && !p.cariSonId && !p.cariBaslangic && !p.cariBitis) throw ApiError.badRequest("En az bir cari seçilmelidir.");
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { cari: "C", para: "S.PARA_ID" });
    const cariAlan = `RTRIM(ISNULL(C.ADRES,'')) cariAdres, RTRIM(ISNULL(C.TELEFON,'')) cariTelefon, RTRIM(ISNULL(C.VERGI_KIMLIK_NO,'')) cariVergiNo`;
    const res = await req.query(`
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, ${cariAlan}, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(P.HAS_ORANI,0) hasOrani,
        SUM(CASE WHEN H.TIP=0 THEN S.MEBLAG ELSE 0 END) borc, SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE 0 END) alacak
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
      JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID
      WHERE CAST(H.TARIH AS date)<@bas ${f} GROUP BY C.CARI_KART_ID, C.KOD, C.AD, C.ADRES, C.TELEFON, C.VERGI_KIMLIK_NO, S.PARA_ID, P.KOD, P.SIRA_NO, P.HAS_ORANI;
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, ${cariAlan}, H.CARI_HAREKET_ID fisNo, H.TARIH tarih, H.HAREKET_TIPI hareketTipi, H.TIP tip,
        CONVERT(varchar(5), CASE WHEN CAST(H.TARIH AS time)='00:00' THEN CAST(H.EKLEME_ZAMANI AS time) ELSE CAST(H.TARIH AS time) END, 108) saat,
        RTRIM(ISNULL(H.ACIKLAMA,'')) aciklama, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(P.HAS_ORANI,0) hasOrani, S.MEBLAG meblag, RTRIM(ISNULL(V.KOD,'')) vezneKod
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
      JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.VEZNE_ID
      WHERE CAST(H.TARIH AS date) BETWEEN @bas AND @bit ${f}
      ORDER BY C.KOD, ISNULL(P.SIRA_NO,99), P.KOD, H.TARIH, H.CARI_HAREKET_ID, S.SATIR_NO;`);
    const sets = res.recordsets as any[];
    const anahtar = (r: any) => `${r.cariKod}|${r.paraKod}`;
    type Grup = { cariKod: string; cariAd: string; cariAdres: string; cariTelefon: string; cariVergiNo: string; paraKod: string; siraNo: number; hasOrani: number; devir: number; hareketler: any[] };
    const gruplar = new Map<string, Grup>();
    const ekle = (r: any) => { const k = anahtar(r); if (!gruplar.has(k)) gruplar.set(k, { cariKod: r.cariKod, cariAd: r.cariAd, cariAdres: r.cariAdres || "", cariTelefon: r.cariTelefon || "", cariVergiNo: r.cariVergiNo || "",
      paraKod: r.paraKod, siraNo: Number(r.siraNo), hasOrani: Number(r.hasOrani) || 0, devir: 0, hareketler: [] }); return gruplar.get(k)!; };
    for (const d of sets[0]) ekle(d).devir = Number(d.alacak) - Number(d.borc);
    for (const h of sets[1]) ekle(h).hareketler.push(h);
    const satirlar: any[] = [], paraToplamlari: Record<string, any>[] = [];
    const genel = new Map<string, { borc: number; alacak: number }>();
    const bakiyeOzeti = (b: number) => ({ bakiye: Math.abs(b), yon: b > 0 ? "A" : b < 0 ? "B" : "" });
    for (const g of [...gruplar.values()].sort((x, y) => x.cariKod.localeCompare(y.cariKod) || x.siraNo - y.siraNo || x.paraKod.localeCompare(y.paraKod))) {
      let bakiye = g.devir;
      const altBaslik = [g.cariAdres, g.cariTelefon ? `Tel: ${g.cariTelefon}` : "", g.cariVergiNo ? `${g.cariVergiNo.length === 11 ? "TCKN" : "VKN"}: ${g.cariVergiNo}` : ""].filter(Boolean).join(" · ");
      const ortak = { grupAnahtar: `${g.cariKod}|${g.paraKod}`, grupBaslik: `${g.cariKod} — ${g.cariAd} · ${g.paraKod}`, grupAltBaslik: altBaslik,
        cariKod: g.cariKod, cariAd: g.cariAd, cariAdres: g.cariAdres, cariTelefon: g.cariTelefon, cariVergiNo: g.cariVergiNo, paraKod: g.paraKod, hasOrani: g.hasOrani };
      const satir = (ek: Record<string, any>) => ({ ...ortak, ...ek, bakiye: Math.abs(bakiye), yon: bakiye > 0 ? "A" : bakiye < 0 ? "B" : "", hasKarsiligi: Math.abs(bakiye) * g.hasOrani });
      let tBorc = bakiye < 0 ? -bakiye : 0, tAlacak = bakiye > 0 ? bakiye : 0;
      satirlar.push(satir({ fisNo: "", tarih: p.baslangic, saat: "", hareketTipi: "Devir", aciklama: `${tarihTr(p.baslangic)} öncesi devir`, vezneKod: "",
        borc: bakiye < 0 ? -bakiye : 0, alacak: bakiye > 0 ? bakiye : 0 }));
      for (const h of g.hareketler) {
        const meblag = Number(h.meblag) || 0;
        bakiye += Number(h.tip) === 1 ? meblag : -meblag;
        if (Number(h.tip) === 0) tBorc += meblag; else tAlacak += meblag;
        satirlar.push(satir({ fisNo: String(h.fisNo ?? ""), tarih: h.tarih, saat: h.saat || "", hareketTipi: HAREKET_TIPI[Number(h.hareketTipi)] || "Diğer", aciklama: h.aciklama, vezneKod: h.vezneKod,
          borc: Number(h.tip) === 0 ? meblag : 0, alacak: Number(h.tip) === 1 ? meblag : 0 }));
      }
      // Eski "Para toplamı" alt raporunun karşılığı: cari × para toplamı + kapanış bakiyesi + B/A (devir dahil)
      paraToplamlari.push({ cari: `${g.cariKod} — ${g.cariAd}`, paraKod: g.paraKod, borc: tBorc, alacak: tAlacak, ...bakiyeOzeti(bakiye) });
      const gp = genel.get(g.paraKod) || { borc: 0, alacak: 0 }; gp.borc += tBorc; gp.alacak += tAlacak; genel.set(g.paraKod, gp);
    }
    // GENEL TOPLAM + genel bakiye + B/A — para birimleri karışmasın diye para başına bir satır
    if (gruplar.size > 1) for (const [paraKod, gp] of genel) paraToplamlari.push({ cari: "GENEL TOPLAM", paraKod, borc: gp.borc, alacak: gp.alacak, ...bakiyeOzeti(gp.alacak - gp.borc) });
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p)}`,
      "Yön: A = cari alacaklı (bizden alacağı var), B = cari borçlu. Her cari ve para birimi ayrı gruplanır; ilk satır başlangıç tarihinden önceki devirdir. Has karşılığı = yürüyen bakiye × para tanımındaki has oranı.",
      paraToplamlari);
  },

  /** R3 Cari hareket listesi */
  async CARHAR1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
      .input("ht", sql.Int, Number.isInteger(p.hareketTipi) ? p.hareketTipi : null);
    const htler = (p.hareketTipleri || []).filter(n => Number.isInteger(n) && n >= 0 && n <= 5);
    htler.forEach((h, i) => req.input(`htl${i}`, sql.Int, h));
    // Sıralama (.rpt parametresi: Ad / Kod); para grubu içinde uygulanır — yalnızca sabit listeden SQL parçası
    const siraSql = p.siralama === "ad" ? "C.AD, " : p.siralama === "kod" ? "C.KOD, " : "";
    const f = filtreler(req, p, { cari: "C", vezne: "V", para: "S.PARA_ID" }) + (htler.length ? ` AND H.HAREKET_TIPI IN (${htler.map((_, i) => `@htl${i}`).join(",")})` : "");
    const res = await req.query(`
      SELECT H.CARI_HAREKET_ID fisNo, H.TARIH tarih, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, H.HAREKET_TIPI hareketTipiKod, H.TIP tipKod,
        RTRIM(ISNULL(H.ACIKLAMA,'')) aciklama, RTRIM(P.KOD) paraKod, S.MEBLAG meblag, RTRIM(ISNULL(V.KOD,'')) vezneKod
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID
      JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=H.CARI_KART_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=H.VEZNE_ID
      WHERE CAST(H.TARIH AS date) BETWEEN @bas AND @bit AND (@ht IS NULL OR H.HAREKET_TIPI=@ht) ${f}
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, ${siraSql}H.TARIH, H.CARI_HAREKET_ID, S.SATIR_NO;`);
    const satirlar = res.recordset.map((r: any) => ({ ...r, fisNo: String(r.fisNo ?? ""), meblag: Number(r.meblag), hareketTipi: HAREKET_TIPI[Number(r.hareketTipiKod)] || "Diğer",
      tip: Number(r.tipKod) === 1 ? "Alacak" : "Borç", borc: Number(r.tipKod) === 0 ? Number(r.meblag) : 0, alacak: Number(r.tipKod) === 1 ? Number(r.meblag) : 0 }));
    // Eski "CARİ HAREKET LİSTESİ" metrikleri: S.No (grup içinde sıfırlanır) ve net toplam = |Σ(borç − alacak)| + B/A (eski @GrupToplam / @GenelToplam). Net toplam para bazında verilir.
    const sayac = new Map<string, number>(), net = new Map<string, { paraKod: string; borc: number; alacak: number }>();
    for (const x of satirlar as any[]) { sayac.set(x.paraKod, (sayac.get(x.paraKod) || 0) + 1); x.siraNo = sayac.get(x.paraKod);
      const o = net.get(x.paraKod) || { paraKod: x.paraKod, borc: 0, alacak: 0 }; o.borc += x.borc; o.alacak += x.alacak; net.set(x.paraKod, o); }
    const netToplamlar = [...net.values()].map(o => { const n = o.borc - o.alacak; return { ...o, adet: sayac.get(o.paraKod) || 0, netToplam: Math.abs(n), netTipi: n > 0 ? "B" : n < 0 ? "A" : "" }; });
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p)}${Number.isInteger(p.hareketTipi) ? ` · ${HAREKET_TIPI[p.hareketTipi!] || "Diğer"}` : htler.length ? ` · ${htler.map(h => HAREKET_TIPI[h]).join(", ")}` : ""}`,
      undefined, netToplamlar);
  },

  /** R4 Cari kart listesi */
  async CARKRT1(pool, p, t) {
    const res = await pool.request().input("arama", sql.NVarChar(100), p.arama?.trim() ? `%${p.arama.trim()}%` : null).query(`
      SELECT RTRIM(ISNULL(C.KOD,'')) kod, RTRIM(ISNULL(C.AD,'')) ad, C.KISILIK_TIPI kisilikKod, RTRIM(ISNULL(C.VERGI_KIMLIK_NO,'')) vergiNo,
        RTRIM(ISNULL(C.PASAPORT_NO,'')) pasaportNo, RTRIM(ISNULL(C.TELEFON,'')) telefon, RTRIM(ISNULL(C.EPOSTA,'')) eposta, RTRIM(ISNULL(C.ADRES,'')) adres,
        ISNULL(C.KARA_LISTEDE,0) karaListe, RTRIM(ISNULL(C.YETKILI_KISI,'')) yetkili, RTRIM(ISNULL(C.BABA_ADI,'')) babaAdi,
        RTRIM(ISNULL(VD.AD,'')) vergiDairesi, RTRIM(ISNULL(ILC.AD,'')) ilce, RTRIM(ISNULL(PK.AD,'')) postaKodu, RTRIM(ISNULL(IL.AD,'')) il,
        RTRIM(ISNULL(NULLIF(RTRIM(UL.KOD),''),UL.AD)) ulke, RTRIM(ISNULL(UY.AD,'')) uyruk, RTRIM(ISNULL(HY.AD,'')) hukukiYapi
      FROM dbo.TODVZ_CARI_KART C
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI VD ON VD.TABLO_MADDESI_ID=C.VERGI_DAIRESI_ID AND VD.TUR=0 LEFT JOIN dbo.TODVZ_TABLO_MADDESI ILC ON ILC.TABLO_MADDESI_ID=C.ILCE_ID AND ILC.TUR=2
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI PK ON PK.TABLO_MADDESI_ID=C.POSTA_KODU_ID AND PK.TUR=4 LEFT JOIN dbo.TODVZ_TABLO_MADDESI IL ON IL.TABLO_MADDESI_ID=C.IL_ID AND IL.TUR=3
      LEFT JOIN dbo.TODVZ_ULKE UL ON UL.ULKE_ID=C.ULKE_ID LEFT JOIN dbo.TODVZ_ULKE UY ON UY.ULKE_ID=C.UYRUK_ID
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI HY ON HY.TABLO_MADDESI_ID=C.HUKUKI_YAPI_ID AND HY.TUR=5
      WHERE (@arama IS NULL OR C.KOD LIKE @arama OR C.AD LIKE @arama OR C.VERGI_KIMLIK_NO LIKE @arama)
      ORDER BY C.KOD;`);
    const satirlar = res.recordset.map((r: any, i: number) => ({ ...r, siraNo: i + 1, kisilik: KISILIK[Number(r.kisilikKod)] || "-", karaListe: r.karaListe ? "EVET" : "" }));
    return sinirla(satirlar, t, p.arama?.trim() ? `Arama: "${p.arama.trim()}"` : "Tüm cari kartlar");
  },

  /** R5 Firma varlıkları — vezne bakiyeleri + cari alacak/borç, seçilen kurla TL */
  async FIRVAR1(pool, p, t) {
    if (!p.tarih) throw ApiError.badRequest("Tarih zorunludur.");
    const kur = await kurCoz(pool, p);
    const vezneler = await vezneBakiyeleri(pool, p.tarih, p);
    const paraSet = await paraKumesi(pool, p);
    const paraUygun = (id: number) => (!p.paraId || id === p.paraId) && (!paraSet || paraSet.has(id));
    const satirlar: any[] = vezneler.filter(v => Math.abs(v.miktar) > 0.000001 && paraUygun(Number(v.paraId))).map(v => ({
      kaynak: `Vezne ${v.vezneKod} — ${v.vezneAd}`, grup: "1-Vezneler", paraKod: v.paraKod, miktar: Number(v.miktar), kur: kur.kurlar.get(v.paraId) ?? 0,
      tlKarsiligi: Number(v.miktar) * (kur.kurlar.get(v.paraId) ?? 0), kurSatis: kur.satisKurlari.get(v.paraId) ?? 0, tlSatis: Number(v.miktar) * (kur.satisKurlari.get(v.paraId) ?? 0) }));
    const cari = await pool.request().input("t", sql.Date, p.tarih).query(`
      SELECT S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        SUM(CASE WHEN H.TIP=0 THEN S.MEBLAG ELSE 0 END) borc, SUM(CASE WHEN H.TIP=1 THEN S.MEBLAG ELSE 0 END) alacak
      FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
      WHERE CAST(H.TARIH AS date)<=@t GROUP BY S.PARA_ID, P.KOD, P.SIRA_NO ORDER BY ISNULL(P.SIRA_NO,99), P.KOD;`);
    for (const r of cari.recordset) {
      if (!paraUygun(Number(r.paraId))) continue;
      const k = kur.kurlar.get(Number(r.paraId)) ?? 0, ks = kur.satisKurlari.get(Number(r.paraId)) ?? 0;
      if (Number(r.borc)) satirlar.push({ kaynak: "Cari alacaklarımız (carilerin bize borcu)", grup: "2-Cari alacaklar", paraKod: r.paraKod, miktar: Number(r.borc), kur: k, tlKarsiligi: Number(r.borc) * k, kurSatis: ks, tlSatis: Number(r.borc) * ks });
      if (Number(r.alacak)) satirlar.push({ kaynak: "Cari borçlarımız (carilerin bizden alacağı)", grup: "3-Cari borçlar", paraKod: r.paraKod, miktar: -Number(r.alacak), kur: k, tlKarsiligi: -Number(r.alacak) * k, kurSatis: ks, tlSatis: -Number(r.alacak) * ks });
    }
    // Eski "FİRMA VARLIKLARI" metrikleri: para başına Devir (önceki günün kapanışı) → Borç / Alacak (seçilen günün net hareketi) → Devreden; rapor altında
    // devir değeri (devir günü kuruyla), kapanış / açılış evalüasyonu (aynı devrin bugünkü kurla değeri − devir günü kuruyla değeri), devreden değeri ve toplam net kâr / zarar.
    // Varlık = vezne mevcudu + cari alacaklarımız − cari borçlarımız. Borç / alacak net harekettir (eski yordam brüt veriyor olabilir — canlıda karşılaştırılacak).
    const net = async (gun: string) => { const m = new Map<string, { paraId: number; paraKod: string; miktar: number }>();
      for (const v of await vezneBakiyeleri(pool, gun, p)) { if (!paraUygun(Number(v.paraId))) continue; const o = m.get(v.paraKod) || { paraId: Number(v.paraId), paraKod: v.paraKod, miktar: 0 }; o.miktar += Number(v.miktar) || 0; m.set(v.paraKod, o); }
      const c = await pool.request().input("t", sql.Date, gun).query(`SELECT S.PARA_ID paraId, RTRIM(P.KOD) paraKod, SUM(CASE WHEN H.TIP=0 THEN S.MEBLAG ELSE -S.MEBLAG END) net
        FROM dbo.TODVZ_CARI_HAREKET H JOIN dbo.TODVZ_CARI_HAREKET_SATIRI S ON S.CARI_HAREKET_ID=H.CARI_HAREKET_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID WHERE CAST(H.TARIH AS date)<=@t GROUP BY S.PARA_ID, P.KOD`);
      for (const r of c.recordset) { if (!paraUygun(Number(r.paraId))) continue; const o = m.get(r.paraKod) || { paraId: Number(r.paraId), paraKod: r.paraKod, miktar: 0 }; o.miktar += Number(r.net) || 0; m.set(r.paraKod, o); }
      return m; };
    const devirGun = gunOnce(p.tarih), devirler = await net(devirGun), devredenler = await net(p.tarih), devirKur = await kurTarihte(pool, devirGun), hedef = await hedefPara(pool, p, kur);
    const hd = hedef.id === kur.tlId ? 1 : devirKur.get(hedef.id) ?? 0, bol = (x: number, y: number) => (y > 0 ? x / y : 0);
    const varlikOzeti: Record<string, any>[] = []; let dDeger = 0, dBugun = 0, vDeger = 0;
    for (const kod of new Set([...devirler.keys(), ...devredenler.keys()])) { const d0 = devirler.get(kod)?.miktar ?? 0, d1 = devredenler.get(kod)?.miktar ?? 0, id = (devredenler.get(kod) || devirler.get(kod))!.paraId, h = d1 - d0;
      if (Math.abs(d0) < 0.000001 && Math.abs(d1) < 0.000001) continue;
      varlikOzeti.push({ kalem: kod, devir: d0, borc: h > 0 ? h : 0, alacak: h < 0 ? -h : 0, devreden: d1, deger: hedef.cevir(d1 * (kur.kurlar.get(id) ?? 0)) });
      dDeger += bol(d0 * (devirKur.get(id) ?? 0), hd); dBugun += hedef.cevir(d0 * (kur.kurlar.get(id) ?? 0)); vDeger += hedef.cevir(d1 * (kur.kurlar.get(id) ?? 0)); }
    const bos = { devir: null, borc: null, alacak: null, devreden: null };
    varlikOzeti.push({ kalem: `Devir değeri (${hedef.kod}, ${tarihTr(devirGun)} kuruyla)`, ...bos, deger: dDeger }, { kalem: `Kapanış / açılış evalüasyonu (${hedef.kod})`, ...bos, deger: dBugun - dDeger },
      { kalem: `Devreden değeri (${hedef.kod})`, ...bos, deger: vDeger }, { kalem: `${vDeger - dDeger < 0 ? "Toplam Net Zarar" : "Toplam Net Kâr"} (${hedef.kod})`, ...bos, deger: Math.abs(vDeger - dDeger) });
    return sinirla(satirlar, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p)} · ${kur.aciklama} · ${hedef.aciklama}`,
      `${VEZNE_BAKIYE_DIPNOT} Cari borçlarımız eksi işaretle düşülür; banka hesapları kapsam dışıdır (yönetici kararı). ${kur.aciklama}. Rapor altı: Devir = önceki günün kapanış varlığı, Borç / Alacak = seçilen günün net hareketi, Devreden = gün sonu varlığı; evalüasyon = devrin bugünkü kurla değeri − devir günü kuruyla değeri; toplam net kâr / zarar = devreden değeri − devir değeri.`,
      varlikOzeti);
  },

  /** R6 Kâr/zarar faaliyet analizi — ağırlıklı ortalama maliyet */
  async KARZAR1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
    const res = await req.query(`
      SELECT F.FIS_ID fisId, F.TARIH tarih, F.TIP tip, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo,
        S.MIKTAR miktar, S.KUR kur, S.TUTAR tutar, S.KOMISYON komisyon, S.BMV bmv, S.KMV kmv, S.KDV kdv
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@bit ${f}
        AND RTRIM(UPPER(P.KOD)) NOT IN ('TL','TRY')
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, F.TARIH, F.FIS_ID, S.SATIR_NO;`);
    const bas = new Date(p.baslangic);
    const ozet = new Map<number, any>();
    const stok = new Map<number, { miktar: number; maliyet: number; sonOrt: number }>();
    for (const r of res.recordset) {
      const id = Number(r.paraId);
      if (!ozet.has(id)) ozet.set(id, { paraId: id, paraKod: r.paraKod, paraAd: r.paraAd, devirMiktar: 0, alisMiktar: 0, alisTutar: 0, satisMiktar: 0, satisTutar: 0, satisMaliyeti: 0, brutKar: 0, komisyon: 0, vergiler: 0, netKar: 0, ortMaliyet: 0, kalanMiktar: 0 });
      const o = ozet.get(id), s = stok.get(id) || { miktar: 0, maliyet: 0, sonOrt: 0 };
      const miktar = Number(r.miktar) || 0, tutar = Number(r.tutar) || 0, kur = Number(r.kur) || 0;
      const donemde = new Date(r.tarih) >= bas;
      if (!donemde) o.devirMiktar += Number(r.tip) === 0 ? miktar : -miktar; // devir = dönem öncesi alışlar − satışlar
      if (Number(r.tip) === 0) { // alış: stoka maliyetiyle girer
        s.miktar += miktar; s.maliyet += tutar; if (s.miktar > 0) s.sonOrt = s.maliyet / s.miktar;
        if (donemde) { o.alisMiktar += miktar; o.alisTutar += tutar; }
      } else { // satış: ağırlıklı ortalama maliyetle stoktan düşer
        const ort = s.miktar > 0 ? s.maliyet / s.miktar : (s.sonOrt || kur);
        const maliyet = miktar * ort;
        s.miktar -= miktar; s.maliyet -= maliyet; if (s.miktar <= 0.0000001) { s.miktar = Math.max(s.miktar, 0); s.maliyet = s.miktar * ort; } s.sonOrt = ort;
        if (donemde) { o.satisMiktar += miktar; o.satisTutar += tutar; o.satisMaliyeti += maliyet; o.brutKar += tutar - maliyet; }
      }
      if (donemde) { o.komisyon += Number(r.komisyon) || 0; o.vergiler += (Number(r.bmv) || 0) + (Number(r.kmv) || 0) + (Number(r.kdv) || 0); }
      stok.set(id, s);
    }
    const satirlar = [...ozet.entries()].map(([id, o]) => { const s = stok.get(id)!; return { ...o, ortMaliyet: s.miktar > 0 ? s.maliyet / s.miktar : s.sonOrt, kalanMiktar: s.miktar, netKar: o.brutKar + o.komisyon - o.vergiler,
      ortAlisKuru: o.alisMiktar > 0 ? o.alisTutar / o.alisMiktar : 0, ortSatisKuru: o.satisMiktar > 0 ? o.satisTutar / o.satisMiktar : 0 }; })
      .filter(o => o.alisMiktar || o.satisMiktar || o.komisyon || Math.abs(o.devirMiktar) > 0.000001);
    // Eski "KÂR / ZARAR FAALİYET ANALİZİ" — para başına K (kur) / M (miktar) / T (TL) satırları × Devir, Alış, Satış, Kapanış ve E / F / T (Evalüasyon, Faaliyet, Toplam).
    // Formüller eski rapordan birebir: @OrtalamaAlisKuru (alış yoksa devir kuru), @OrtalamaSatisKuru, @DevirTutar, @KapanisTutar, @Evaluasyon, @Faaliyet, @EvaluasyonFaaliyetToplami.
    // Devir kuru = dönem başından önceki günün, kapanış kuru = son tarihin kur tablosundaki efektif alış kuru; mevcut = devir + alış − satış (fişlerden).
    const devirKur = await kurTarihte(pool, gunOnce(p.baslangic)), kapanisKur = await kurTarihte(pool, p.bitis);
    const kmt: Record<string, any>[] = []; let tE = 0, tF = 0, tDevir = 0, tAlis = 0, tSatis = 0, tKapanis = 0;
    for (const o of satirlar as any[]) { const dk = devirKur.get(o.paraId) ?? 0, kk = kapanisKur.get(o.paraId) ?? 0, mevcut = o.devirMiktar + o.alisMiktar - o.satisMiktar;
      const ortAlis = !o.alisMiktar || !o.alisTutar ? dk : o.alisTutar / o.alisMiktar, ortSatis = o.satisMiktar ? o.satisTutar / o.satisMiktar : 0;
      const E = !o.alisMiktar ? o.devirMiktar * (kk - dk) : o.devirMiktar * (ortAlis - dk) + mevcut * (kk - ortAlis), F = o.satisMiktar * (ortSatis - ortAlis);
      kmt.push({ para: o.paraKod, kmt: "K", devir: dk, alis: ortAlis, satis: ortSatis, kapanis: kk, eft: "E", sonuc: E },
        { para: "", kmt: "M", devir: o.devirMiktar, alis: o.alisMiktar, satis: o.satisMiktar, kapanis: mevcut, eft: "F", sonuc: F },
        { para: "", kmt: "T", devir: o.devirMiktar * dk, alis: o.alisTutar, satis: o.satisTutar, kapanis: mevcut * kk, eft: "T", sonuc: E + F });
      tE += E; tF += F; tDevir += o.devirMiktar * dk; tAlis += o.alisTutar; tSatis += o.satisTutar; tKapanis += mevcut * kk; }
    if (kmt.length) kmt.push({ para: "TOPLAM (TL)", kmt: "T", devir: tDevir, alis: tAlis, satis: tSatis, kapanis: tKapanis, eft: "E", sonuc: tE },
      { para: "", kmt: "", devir: null, alis: null, satis: null, kapanis: null, eft: "F", sonuc: tF }, { para: "", kmt: "", devir: null, alis: null, satis: null, kapanis: null, eft: "T", sonuc: tE + tF });
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm dövizler"}`,
      "Rapor altındaki tablo — KMT: Kur, Miktar, TL · EFT: Evalüasyon, Faaliyet, Toplam. Faaliyet = satış miktarı × (ortalama satış − ortalama alış); evalüasyon = devrin ve mevcudun kur farkı (alış yoksa devir × (kapanış − devir kuru)). Üstteki satırlar ağırlıklı ortalama maliyet yöntemini kullanır; iki yöntemin kârı farklı olabilir.",
      kmt);
  },

  /**
   * R7 Vergiler ve komisyon — eski "VERGİLER VE KOMİSYON RAPORU" metrikleri. Rapor tipi (`birlestir`): "detay" (varsayılan) fiş satırı — tarih, seri no, vezne, belge no,
   * para, tutar, KMV, komisyon %, komisyon, BSMV, tip (A / S); "toplam" gün × para özeti (önceki düzen). Gruplama (`siralama`): vezne / para (eski "Döviz bazında") / gün
   * (eski "Tarih ara toplamı"). İptal fişler hariç.
   */
  async VERKOM1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const toplam = p.birlestir === "toplam", grupTuru = p.siralama === "para" ? "para" : p.siralama === "gun" ? "gun" : "vezne";
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
      .input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
    const sira = grupTuru === "para" ? "ISNULL(P.SIRA_NO,99), P.KOD, " : grupTuru === "gun" ? "" : "V.KOD, ";
    const res = await req.query(`
      SELECT F.FIS_ID fisId, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, CAST(F.TARIH AS date) gun, ISNULL(F.ZAMAN,F.TARIH) zaman, F.TIP tipKod,
        RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KOMISYON_ORANI,0) komisyonOrani, ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KDV,0) kdv
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY ${sira}CAST(F.TARIH AS date), ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
    const gunTr = (g: any) => tarihTr(new Date(g).toISOString().slice(0, 10));
    const ham = res.recordset.map((r: any) => { const bmv = Number(r.bmv) || 0, kmv = Number(r.kmv) || 0, kdv = Number(r.kdv) || 0;
      const grupBaslik = grupTuru === "para" ? `Para birimi: ${r.paraKod}` : grupTuru === "gun" ? gunTr(r.gun) : `Vezne ${r.vezneKod} — ${r.vezneAd}`;
      return { ...r, tip: Number(r.tipKod) === 1 ? "S" : "A", miktar: Number(r.miktar) || 0, tutar: Number(r.tutar) || 0, komisyonOrani: Number(r.komisyonOrani) || 0, komisyon: Number(r.komisyon) || 0, bmv, kmv, kdv,
        toplamVergi: bmv + kmv + kdv, adet: 1, vezneBaslik: `${r.vezneKod} — ${r.vezneAd}`, grupAnahtar: grupBaslik, grupBaslik }; });
    let satirlar: any[] = ham;
    if (toplam) { const m = new Map<string, any>();
      for (const x of ham) { const k = `${x.grupAnahtar}|${new Date(x.gun).toISOString().slice(0, 10)}|${x.paraKod}`;
        if (!m.has(k)) m.set(k, { ...x, zaman: x.gun, seriNo: "", belgeNo: "", tip: "", komisyonOrani: 0, fisler: new Set<number>(), miktar: 0, tutar: 0, komisyon: 0, bmv: 0, kmv: 0, kdv: 0, toplamVergi: 0 });
        const o = m.get(k); o.fisler.add(x.fisId); for (const a_ of ["miktar", "tutar", "komisyon", "bmv", "kmv", "kdv", "toplamVergi"]) o[a_] += x[a_]; }
      satirlar = [...m.values()].map(({ fisler, ...o }) => ({ ...o, adet: fisler.size })); }
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : ""} · ${toplam ? "Toplam" : "Detaylı"}`);
  },

  /** R8 Vezne bakiye raporu (tarih bazlı) */
  async VEZBAK1(pool, p, t) {
    if (!p.tarih) throw ApiError.badRequest("Tarih zorunludur.");
    const kur = await kurCoz(pool, p);
    const rows = await vezneBakiyeleri(pool, p.tarih, p);
    const paraSet = await paraKumesi(pool, p);
    const hedef = await hedefPara(pool, p, kur);
    const satirlar = rows.filter(r => (!p.paraId || r.paraId === p.paraId) && (!paraSet || paraSet.has(Number(r.paraId)))).map(r => ({ ...r, miktar: Number(r.miktar), kur: kur.kurlar.get(r.paraId) ?? 0,
      tlKarsiligi: Number(r.miktar) * (kur.kurlar.get(r.paraId) ?? 0), hedefKarsiligi: hedef.cevir(Number(r.miktar) * (kur.kurlar.get(r.paraId) ?? 0)), hedefParaKod: hedef.kod, kurSatis: kur.satisKurlari.get(r.paraId) ?? 0, tlSatis: Number(r.miktar) * (kur.satisKurlari.get(r.paraId) ?? 0), vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` }));
    return sinirla(satirlar, t, `${tarihTr(p.tarih)} itibarıyla${ozetEk(p) || " · Tüm vezneler"} · ${kur.aciklama} · ${hedef.aciklama}`, VEZNE_BAKIYE_DIPNOT);
  },

  /**
   * R9 Vezne hareket listesi — eski "VEZNE HAREKET LİSTESİ" gibi tam vezne defteri: fiş (döviz ayağı + TL ödeme ayağı), vezne transferi, nakit cari hareket ve
   * kasa hesap hareketi (KDV TL'ye); her satırda Giriş / Çıkış miktarı. Kapsam `vezneBakiyeleri` ile aynıdır (vezne bakiyesini değiştiren her hareket).
   * Fiş satırlarında önceki kolonlar (belge no, ünvan, TL tutar, komisyon, BSMV, seçilen kurla TL) korunur. Fiş tipi seçilirse yalnızca o tipteki fişler listelenir.
   */
  async VEZHAR1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const kur = await kurCoz(pool, { ...p, kurTarihi: p.kurTarihi || p.bitis });
    const var_ = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_HESAP_HAREKETI','U') IS NULL THEN 0 ELSE 1 END kasa, CASE WHEN OBJECT_ID('dbo.TODVZ_BANKA','U') IS NULL THEN 0 ELSE 1 END banka,
      CASE WHEN OBJECT_ID('dbo.TODVZ_VEZNE_TRANSFERI','U') IS NULL OR OBJECT_ID('dbo.TODVZ_VEZNE_TRANSFERI_SATIRI','U') IS NULL THEN 0 ELSE 1 END transfer`)).recordset[0] || {};
    const yalnizFis = p.fisTipi === 0 || p.fisTipi === 1;
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
      .input("sbas", sql.VarChar(8), p.baslangicSaat || "00:00:00").input("sbit", sql.VarChar(8), p.bitisSaat || "23:59:59")
      .input("tip", sql.Int, yalnizFis ? p.fisTipi : null);
    const f = filtreler(req, p, { vezne: "V", para: "X.paraId" });
    const bos = `CAST(NULL AS int), '', '', CAST(NULL AS int), 0, 0, 0, 0, ''`;
    const bankaAd = var_.banka ? `RTRIM(ISNULL((SELECT TOP 1 BN.HESAP_ADI FROM dbo.TODVZ_BANKA BN WHERE BN.BANKA_ID=F.BANKA_HESABI_ID),''))` : `''`;
    const transferSql = var_.transfer ? `
        UNION ALL
        SELECT 1, T.ALAN_VEZNE_ID, T.TARIH, TS.PARA_ID, TS.MIKTAR, 0, RTRIM(ISNULL(T.REF_NO,''))+' '+RTRIM(ISNULL(T.ACIKLAMA,'')), ${bos}
        FROM dbo.TODVZ_VEZNE_TRANSFERI T JOIN dbo.TODVZ_VEZNE_TRANSFERI_SATIRI TS ON TS.VEZNE_TRANSFERI_ID=T.VEZNE_TRANSFERI_ID
        UNION ALL
        SELECT 1, T.VEREN_VEZNE_ID, T.TARIH, TS.PARA_ID, 0, TS.MIKTAR, RTRIM(ISNULL(T.REF_NO,''))+' '+RTRIM(ISNULL(T.ACIKLAMA,'')), ${bos}
        FROM dbo.TODVZ_VEZNE_TRANSFERI T JOIN dbo.TODVZ_VEZNE_TRANSFERI_SATIRI TS ON TS.VEZNE_TRANSFERI_ID=T.VEZNE_TRANSFERI_ID` : "";
    const kasaSql = var_.kasa ? `
        UNION ALL
        SELECT 3, KH.VEZNE_ID, KH.TARIH, KH.PARA_ID, CASE WHEN KH.TIP=0 THEN KH.MEBLAG ELSE 0 END, CASE WHEN KH.TIP=0 THEN 0 ELSE KH.MEBLAG END, RTRIM(ISNULL(KH.ACIKLAMA,'')), ${bos}
        FROM dbo.TODVZ_HESAP_HAREKETI KH
        UNION ALL
        SELECT 3, KH.VEZNE_ID, KH.TARIH, ${TL_PARA_SQL}, CASE WHEN KH.TIP=0 THEN KH.KDV ELSE 0 END, CASE WHEN KH.TIP=0 THEN 0 ELSE KH.KDV END, 'KDV — '+RTRIM(ISNULL(KH.ACIKLAMA,'')), ${bos}
        FROM dbo.TODVZ_HESAP_HAREKETI KH WHERE ISNULL(KH.KDV,0)>0` : "";
    const digerleri = yalnizFis ? "" : `
        UNION ALL
        SELECT 2, CH.VEZNE_ID, CH.TARIH, CS.PARA_ID, CASE WHEN CH.TIP=1 THEN CS.MEBLAG ELSE 0 END, CASE WHEN CH.TIP=1 THEN 0 ELSE CS.MEBLAG END, RTRIM(ISNULL(CH.ACIKLAMA,'')), ${bos}
        FROM dbo.TODVZ_CARI_HAREKET CH JOIN dbo.TODVZ_CARI_HAREKET_SATIRI CS ON CS.CARI_HAREKET_ID=CH.CARI_HAREKET_ID WHERE CH.HAREKET_TIPI=0${transferSql}${kasaSql}`;
    const belge = `RTRIM(ISNULL(F.SERI_NO,''))+RTRIM(ISNULL(F.BELGE_NO,''))`;
    const res = await req.query(`
      ;WITH X (belgeTipi, vezneId, zaman, paraId, giris, cikis, aciklama, fisId, belgeNo, unvan, fisTip, kur, tutar, komisyon, bmv, bankaHesabi) AS (
        SELECT 0, F.VEZNE_ID, ISNULL(F.ZAMAN,F.TARIH), S.PARA_ID, CASE WHEN F.TIP=0 THEN S.MIKTAR ELSE 0 END, CASE WHEN F.TIP=0 THEN 0 ELSE S.MIKTAR END,
          ${belge}, F.FIS_ID, ${belge}, RTRIM(ISNULL(F.UNVAN,'')), CAST(F.TIP AS int), S.KUR, S.TUTAR, S.KOMISYON, S.BMV, ${bankaAd}
        FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID WHERE ISNULL(F.IPTAL,0)=0 AND (@tip IS NULL OR F.TIP=@tip)
        UNION ALL
        SELECT 0, F.VEZNE_ID, ISNULL(F.ZAMAN,F.TARIH), ${TL_PARA_SQL}, CASE WHEN F.TIP=1 THEN F.ODEME_TUTARI ELSE 0 END, CASE WHEN F.TIP=1 THEN 0 ELSE F.ODEME_TUTARI END,
          ${belge}+' — ödeme', F.FIS_ID, ${belge}, RTRIM(ISNULL(F.UNVAN,'')), CAST(F.TIP AS int), 0, 0, 0, 0, ${bankaAd}
        FROM dbo.TODVZ_FIS F WHERE ISNULL(F.IPTAL,0)=0 AND (@tip IS NULL OR F.TIP=@tip) AND ISNULL(F.ODEME_TUTARI,0)<>0${digerleri}
      )
      SELECT X.*, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, RTRIM(ISNULL(P.KOD,'')) paraKod, CASE WHEN X.paraId=${TL_PARA_SQL} THEN 9999999 ELSE ISNULL(P.SIRA_NO,99) END paraSira
      FROM X LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=X.vezneId LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=X.paraId
      WHERE CAST(X.zaman AS date) BETWEEN @bas AND @bit AND CAST(X.zaman AS time) BETWEEN CAST(@sbas AS time) AND CAST(@sbit AS time) ${f}
      ORDER BY V.KOD, X.zaman, X.belgeTipi, paraSira, X.aciklama;`);
    const BELGE = ["Fiş", "Transfer", "Cari", "Hesap"];
    const satirlar = res.recordset.map((r: any) => { const id = Number(r.paraId), giris = Number(r.giris) || 0, cikis = Number(r.cikis) || 0, miktar = giris || cikis;
      const secilenKur = kur.kurlar.get(id) ?? 0, ks = kur.satisKurlari.get(id) ?? 0, fis = Number(r.belgeTipi) === 0;
      // Fişin TL ödeme ayağı: döviz satırının karşılığıdır; miktar ve "seçilen kurla TL" kolonlarına yazılırsa aynı fiş iki kez toplanır
      const odeme = fis && String(r.aciklama || "").endsWith("— ödeme");
      if (odeme) return { ...r, belgeTipi: BELGE[0], yon: giris ? "<<" : ">>", tip: Number(r.fisTip) === 1 ? "Satış" : "Alış", giris, cikis, miktar: null, kur: null, tutar: 0, komisyon: 0, bmv: 0,
        secilenKur: null, secilenTl: 0, kurSatis: null, tlSatis: 0, vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` };
      return { ...r, belgeTipi: BELGE[Number(r.belgeTipi)] || "", yon: giris ? "<<" : ">>", tip: fis ? (Number(r.fisTip) === 1 ? "Satış" : "Alış") : "", giris, cikis, miktar,
        kur: Number(r.kur) || 0, tutar: Number(r.tutar) || 0, komisyon: Number(r.komisyon) || 0, bmv: Number(r.bmv) || 0,
        secilenKur, secilenTl: miktar * secilenKur, kurSatis: ks, tlSatis: miktar * ks, vezneBaslik: `${r.vezneKod} — ${r.vezneAd}` }; });
    // Vezne × para giriş / çıkış toplamı (eski raporda gizli genel toplam; paralar karışmasın diye para başına)
    const oz = new Map<string, any>();
    for (const x of satirlar) { const k = `${x.vezneKod}|${x.paraKod}`; const o = oz.get(k) || { vezne: x.vezneBaslik, paraKod: x.paraKod, giris: 0, cikis: 0 }; o.giris += x.giris; o.cikis += x.cikis; oz.set(k, o); }
    const ozet = [...oz.values()].map(o => ({ ...o, net: o.giris - o.cikis }));
    return sinirla(satirlar, t, `${aralikOzeti(p)} · ${(p.baslangicSaat || "00:00").slice(0, 5)}–${(p.bitisSaat || "23:59").slice(0, 5)}${ozetEk(p) || " · Tüm vezneler"}${p.fisTipi === 0 ? " · Yalnız alış fişleri" : p.fisTipi === 1 ? " · Yalnız satış fişleri" : ""} · ${kur.aciklama}`,
      `Vezne bakiyesini değiştiren tüm hareketler listelenir: fişler (döviz ayağı ve TL ödeme ayağı ayrı satır), vezne transferleri, nakit cari hareketler ve kasa hesap hareketleri (KDV TL'ye). << giriş, >> çıkış. İptal edilmiş fişler listelenmez. "Seçilen kur / TL" kolonları parametrede seçilen kurla hesaplanır (${kur.aciklama}).`,
      ozet);
  },
};

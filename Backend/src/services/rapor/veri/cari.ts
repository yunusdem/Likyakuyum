import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporGrup, RaporNet, RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, aralikOzeti, filtreler, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";
import { POS_HAREKET_KOLONLARI, belgeTablolari, posHareketleriSql } from "../kaynak.js";
import { type ParaGrubu, paraBasliklariEkle, paraGrubunaGoreSirala, paraGrupBilgisi } from "../paraGrup.js";
import { hesapTipiKodu, hesapTipiOku, hesapTipiOzeti, metinAraligi, metinAraligiOzeti, onay, prm, secim } from "./cariTemel.js";

/**
 * Cari raporları — 2. dalga (docs/raporlar-faz2.md, Faz R2-C): POS ekstre, vadeli işlem listesi. Eski Crystal raporlarıyla eşitlendi
 * (05.11.2026, docs/RAPOR_ESITLEME_UYGULAMA.md). Saf mantık dışa açık fonksiyonlardadır (scripts/rapor-test-cari.ts). Yalnızca SELECT.
 */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

const DEKONT_TIPI: Record<number, string> = { 0: "Emanet alma", 1: "Emanet verme", 2: "Dekont (virman)" };

/** Vadeye kalan gün (negatif = vadesi geçmiş). Tarihler YYYY-AA-GG gün başı olarak karşılaştırılır. Saf fonksiyon. */
export function kalanGun(vade: string | Date, bugun: string | Date): number {
  const gun = (v: string | Date) => { const d = new Date(v); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); };
  return Math.round((gun(vade) - gun(bugun)) / 86400000);
}

// ───────────────────────── POSEKS1 ─────────────────────────

/** POS ekstresinde dönem öncesi kayıtlar: "toplu" tek "POS Devir" satırı (varsayılan) · "satir" eski rapordaki gibi tek tek · "yok" devir olmadan */
export type PosDevir = "toplu" | "satir" | "yok";

/**
 * POS ekstre gövdesi (saf): cihaz × para grupları, yürüyen bakiye (Σborç − Σalacak), grup başına son bakiye özeti.
 * Kayıtlar grup ve tarih sırasıyla gelir; `onceki` = dönem öncesi, `devirKaydi` = cihaz tanımındaki devir.
 */
export function posEkstreKur(kayitlar: any[], o: { baslangic?: string; devir: PosDevir }) {
  const gruplar = new Map<string, { ortak: Record<string, any>; devirBorc: number; devirAlacak: number; oncekiler: any[]; hareketler: any[] }>();
  for (const r of kayitlar) {
    const k = `${r.posId}|${r.paraKod}`, borc = Number(r.borc) || 0, alacak = Number(r.alacak) || 0;
    const pos = Number(r.posId) ? [r.cihazKod, r.cihazAd].filter(Boolean).join(" — ") || `POS cihazı ${r.posId}` : "POS cihazı belirtilmemiş";
    if (!gruplar.has(k)) gruplar.set(k, { devirBorc: 0, devirAlacak: 0, oncekiler: [], hareketler: [], ortak: { grupAnahtar: k, grupBaslik: `CİHAZ: ${pos} · ${r.paraKod}`, posCihazi: Number(r.posId) ? (r.cihazKod || String(r.posId)) : "-", paraKod: r.paraKod } });
    const g = gruplar.get(k)!;
    const satir = { ...r, fisNo: String(r.fisNo ?? ""), aciklama: r.aciklama || r.islem, borc, alacak };
    if (r.onceki) { if (o.devir === "yok") continue; g.devirBorc += borc; g.devirAlacak += alacak; g.oncekiler.push(satir); }
    else g.hareketler.push(satir);
  }
  const satirlar: Record<string, any>[] = [], sonBakiyeler: Record<string, any>[] = [];
  for (const g of gruplar.values()) {
    let bakiye = 0, borc = g.devirBorc, alacak = g.devirAlacak;
    if (o.devir === "satir") {
      // Eski düzen: dönem öncesi her kayıt kendi tarihiyle, "POS Devir" açıklamasıyla (cihaz devrinin tarihi yoktur)
      for (const h of g.oncekiler) { bakiye += h.borc - h.alacak; satirlar.push({ ...g.ortak, ...h, tarih: h.devirKaydi ? null : h.tarih, aciklama: "POS Devir", bakiye, devirSatiri: true }); }
    } else {
      bakiye = g.devirBorc - g.devirAlacak;
      if (g.devirBorc || g.devirAlacak) satirlar.push({ ...g.ortak, fisNo: "", tarih: o.baslangic, cariKod: "", cariAd: "", aciklama: "POS Devir", vezneKod: "", borc: g.devirBorc, alacak: g.devirAlacak, bakiye, devirSatiri: true });
    }
    for (const h of g.hareketler) { bakiye += h.borc - h.alacak; borc += h.borc; alacak += h.alacak; satirlar.push({ ...g.ortak, ...h, bakiye }); }
    if (g.hareketler.length || g.devirBorc || g.devirAlacak) sonBakiyeler.push({ cihaz: g.ortak.grupBaslik, posAnahtar: g.ortak.posCihazi, paraKod: g.ortak.paraKod, borc, alacak, sonBakiye: bakiye });
  }
  return { satirlar, sonBakiyeler };
}

// ───────────────────────── VADISL1 ─────────────────────────

/** Eski @islemTipi harfi: İK iptal + kapandı, İ iptal, K kapandı, V vadeli (geçerli) */
export function islemDurumu(iptal: any, kapandi: any): string {
  return iptal && kapandi ? "İK" : iptal ? "İ" : kapandi ? "K" : "V";
}

export const VADELI_SIRALAMALARI = ["vade", "tarih", "ad", "kod"] as const;
export type VadeliSiralama = typeof VADELI_SIRALAMALARI[number];
const VADELI_NET: RaporNet = { arti: "borcMeblag", eksi: "alacakMeblag", etiket: "Net toplam" };

/**
 * Vadeli işlem listesi düzeni — sıralama grubu da belirler (eski @SiralamaTarih): "vade" → para grubu, vade sırası (bizim düzen, varsayılan);
 * "tarih" → işlem günü grubu, "ad" / "kod" → cari grubu. Genel toplam hiçbir düzende basılmaz (para birimleri karışır). `sira` yalnız sabit SQL parçalarıdır.
 */
export function vadeliIslemDuzeni(siralama?: string): { kip: VadeliSiralama; sira: string; gruplar: RaporGrup[] } {
  const kip = (VADELI_SIRALAMALARI as readonly string[]).includes(siralama || "") ? siralama as VadeliSiralama : "vade";
  const son = "D.VADE, D.CARI_DEKONT_ID, S.SATIR_NO";
  const grup = (anahtar: string, baslik: string): RaporGrup[] => [{ anahtar, baslik, altToplam: true, genelToplam: false, net: VADELI_NET }];
  switch (kip) {
    case "tarih": return { kip, gruplar: grup("gun", "{{gunBaslik}}"), sira: `CAST(D.TARIH AS date), cariAd, cariKod, ${son}` };
    case "ad": return { kip, gruplar: grup("cariKod", "{{cariAd}} — {{cariKod}}"), sira: `cariAd, cariKod, D.TARIH, ${son}` };
    case "kod": return { kip, gruplar: grup("cariKod", "{{cariKod}} — {{cariAd}}"), sira: `cariKod, D.TARIH, ${son}` };
    default: return { kip, gruplar: grup("paraKod", "Para birimi: {{paraKod}}"), sira: `ISNULL(P.SIRA_NO,99), P.KOD, ${son}` };
  }
}

/** Vadeli işlem satırını tamamlar (saf): tür adı, kalan gün, B/A harfi (satır tipi 0 borç / 1 alacak), net için borç / alacak meblağı, işlem durumu harfi */
export function vadeliIslemSatiri(r: any): Record<string, any> {
  const m = Number(r.meblag) || 0, borcMu = Number(r.satirTip) === 0;
  return { ...r, dekontNo: String(r.dekontNo ?? ""), tip: DEKONT_TIPI[Number(r.tipKod)] || "Diğer", kalanGun: kalanGun(r.vade, r.bugun), meblag: m, kur: Number(r.kur) || 0,
    borclu: `${r.borcluKod} — ${r.borcluAd}`.replace(/^ — $/, ""), alacakli: `${r.alacakliKod} — ${r.alacakliAd}`.replace(/^ — $/, ""), hasKarsiligi: m * (Number(r.hasOrani) || 0),
    tipHarf: borcMu ? "B" : "A", borcMeblag: borcMu ? m : 0, alacakMeblag: borcMu ? 0 : m, islemDurumu: islemDurumu(r.iptal, r.kapandi), gunBaslik: tarihTr(String(r.gun ?? "")) };
}

export const CARI2_SORGULARI: Record<string, Sorgu> = {

  /**
   * POS ekstre — eski "POS EKSTRE RAPORU" (VODVZR_POS_EKSTRESI) kapsamı, POS cihazı × para bazında (kaynak.ts posHareketleriSql):
   * cihaz tanımındaki devir, POS'lu cari hareketler (cari alacak → POS borç "Cari tahsilat", cari borç → POS alacak "Banka hesabına aktarım") ve
   * sarraf fişinin kartlı tahsilatı ("Fiş tahsilat", POS borç). Eski @BORC / @ALACAK / @Bakiye formülleri: bakiye = Σborç − Σalacak (yürüyen);
   * başlangıç öncesi hareketler ve cihaz devri "POS Devir" satırında (borç ve alacak brüt — grup toplamına dahil), grup altında son bakiye.
   * Eski parametreler: ilk – son POS kodu / adı, "Devir olmadan göster"; "Devir satırı = Satır satır" eski rapordaki gibi dönem öncesi kayıtları tek tek listeler.
   * Doğrulama: test veritabanında eski görünümle karşılaştırıldı (01.10.2026, docs/rapor-denetim.md).
   */
  async POSEKS1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const devir: PosDevir = onay(p, "devirsiz") ? "yok" : secim(p, "devirSekli", ["toplu", "satir"]);
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
    // Cari süzgeci cihaz devrine uygulanmaz (devrin carisi yoktur); vezne ve para süzgeçleri satırlara uygulanır
    const cariSecili = !!(p.cariKartId || p.cariIdler?.length || p.cariSonId || p.cariBaslangic || p.cariBitis);
    const fCariVezne = filtreler(req, p, { cari: "C", vezne: "V" }), fPara = filtreler(req, p, { para: "X.paraId" });
    const fPos = metinAraligi(req, p, "PC.KOD", "posKod") + metinAraligi(req, p, "PC.AD", "posAd");
    const fx = ` AND (${cariSecili ? "" : "X.devir=1 OR "}(1=1${fCariVezne}))${fPara}${fPos}`;
    const res = await req.query(`
      ;WITH X (${POS_HAREKET_KOLONLARI}) AS (
       ${posHareketleriSql(await belgeTablolari(pool))}
      )
      SELECT X.hareketNo fisNo, X.tarih, ISNULL(X.posCihaziId,0) posId, RTRIM(ISNULL(PC.KOD,'')) cihazKod, RTRIM(ISNULL(PC.AD,'')) cihazAd,
        RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, X.islem, X.aciklama, RTRIM(ISNULL(P.KOD,'')) paraKod, ISNULL(X.borc,0) borc, ISNULL(X.alacak,0) alacak,
        RTRIM(ISNULL(V.KOD,'')) vezneKod, CASE WHEN CAST(X.tarih AS date)<@bas THEN 1 ELSE 0 END onceki, X.devir devirKaydi
      FROM X LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=X.paraId LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=X.cariKartId LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=X.vezneId
      LEFT JOIN dbo.TODVZ_POS_CIHAZI PC ON PC.POS_CIHAZI_ID=X.posCihaziId
      WHERE CAST(X.tarih AS date)<=@bit${devir === "yok" ? " AND CAST(X.tarih AS date)>=@bas" : ""} ${fx}
      ORDER BY ISNULL(PC.KOD,''), ISNULL(X.posCihaziId,0), ISNULL(P.SIRA_NO,99), P.KOD, X.tarih, X.devir DESC, X.hareketNo;`);
    const { satirlar, sonBakiyeler } = posEkstreKur(res.recordset as any[], { baslangic: p.baslangic, devir });
    // Cihaz × para özetinde paralar cihaz içinde Döviz / Kuyum başlıkları altında (K11)
    const pg = await paraGrupBilgisi(pool);
    const ozetSatirlar = paraBasliklariEkle(sonBakiyeler, { grupla: (s): ParaGrubu => pg.grup(s), alan: "cihaz", bolumle: ["posAnahtar"] });
    const posOzeti = metinAraligiOzeti(p, "posKod", "POS kodu") + metinAraligiOzeti(p, "posAd", "POS adı");
    return sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm cariler"}${posOzeti}${devir === "yok" ? " · Devirsiz" : devir === "satir" ? " · Devir satır satır" : ""}`,
      "Seçilen aralıkta POS hareketi yok. POS ekstresi POS'lu cari hareketleri, sarraf fişlerinin kartlı tahsilatlarını ve cihaz devrini kapsar; borç = POS'tan tahsil edilecek, alacak = bankaya aktarılan.",
      ozetSatirlar);
  },

  /**
   * Vadeli işlem listesi — vadesi olan cari dekontlar (emanet alma / verme, virman); iptal edilenler hariç ("İptal edilenler" işaretliyse yalnız iptaller).
   * Eski parametreler: hesap tipi (satır tipi: borç / alacak), vezne, ilk – son ad, sıralama (grubu da belirler). Satırın carisi: borç satırında borçlu,
   * alacak satırında alacaklı. Şemada KAPANDI alanı yok → "Kapananlar" kutusu yok (alan varsa durum harfi K olur).
   */
  async VADISL1(pool, p, t) {
    if ((!!p.baslangic) !== (!!p.bitis) || (!!p.vadeBaslangic) !== (!!p.vadeBitis)) throw ApiError.badRequest("Tarih aralıklarında ilk ve son tarih birlikte girilmelidir.");
    const duzen = vadeliIslemDuzeni(prm(p, "siralama")), hesapTipi = hesapTipiOku(p), iptaller = onay(p, "iptaller");
    const durumAdi = p.durum === "gecmis" ? "Vadesi geçmiş" : p.durum === "tumu" ? "Tüm vadeler" : "Açık (vadesi gelmemiş)";
    const ozet = [durumAdi, p.vadeBaslangic ? `Vade ${tarihTr(p.vadeBaslangic)} – ${tarihTr(p.vadeBitis)}` : "", p.baslangic ? `İşlem ${aralikOzeti(p)}` : ""].filter(Boolean).join(" · ")
      + `${ozetEk(p)}${metinAraligiOzeti(p, "cariAd", "Ad")}${hesapTipiOzeti(hesapTipi)}${iptaller ? " · İptal edilenler" : ""}`;
    const bosNot = `Vadesi girilmiş cari dekontlar (emanet alma, emanet verme, virman) listelenir; ${iptaller ? "yalnız iptal edilenler gösterilir" : "iptal edilenler hariçtir"}. Kalan gün = vade − bugün (eksi değer vadesi geçmiş demektir). Has karşılığı = meblağ × has oranı. Cari seçimi dekontun borçlu ve alacaklı tarafına birlikte uygulanır.`;
    // Şema koruması: dekont tabloları, satırdaki HAS_ORANI (uygulamaya özgü) ve KAPANDI (eski görünümde var, tabloda yok) her veritabanında bulunmaz
    const sema = (await pool.request().query(`SELECT
      CASE WHEN OBJECT_ID('dbo.TODVZ_CARI_DEKONT','U') IS NULL OR OBJECT_ID('dbo.TODVZ_CARI_DEKONT_SATIRI','U') IS NULL THEN 0 ELSE 1 END dekont,
      CASE WHEN COL_LENGTH('dbo.TODVZ_CARI_DEKONT_SATIRI','HAS_ORANI') IS NULL THEN 0 ELSE 1 END hasOrani,
      CASE WHEN COL_LENGTH('dbo.TODVZ_CARI_DEKONT','KAPANDI') IS NULL THEN 0 ELSE 1 END kapandi`)).recordset[0] || {};
    if (!sema.dekont) return sinirla([], t, ozet, bosNot);
    const pg = await paraGrupBilgisi(pool);
    const req = pool.request().input("bas", sql.Date, p.baslangic || null).input("bit", sql.Date, p.bitis || null)
      .input("vdbas", sql.Date, p.vadeBaslangic || null).input("vdbit", sql.Date, p.vadeBitis || null).input("htip", sql.Int, hesapTipiKodu(hesapTipi));
    // Cari seçimi ve ad aralığı dekontun iki tarafına da uygulanır (borçlu veya alacaklı seçilenlerden biriyse)
    const cf = filtreler(req, p, { cari: "CK" }) + metinAraligi(req, p, "CK.AD", "cariAd");
    const cariKosulu = cf ? ` AND (D.BORCLU_ID IN (SELECT CK.CARI_KART_ID FROM dbo.TODVZ_CARI_KART CK WHERE 1=1 ${cf}) OR D.ALACAKLI_ID IN (SELECT CK.CARI_KART_ID FROM dbo.TODVZ_CARI_KART CK WHERE 1=1 ${cf}))` : "";
    const vezneKosulu = filtreler(req, p, { vezne: "V" });
    const pids = (p.paraIdler || []).filter(n => Number.isInteger(n) && n > 0); pids.forEach((id, i) => req.input(`vp${i}`, sql.Int, id));
    const paraKosulu = pids.length ? ` AND S.PARA_ID IN (${pids.map((_, i) => `@vp${i}`).join(",")})` : "";
    const durum = p.durum === "gecmis" ? " AND CAST(D.VADE AS date)<CAST(GETDATE() AS date)" : p.durum === "tumu" ? "" : " AND CAST(D.VADE AS date)>=CAST(GETDATE() AS date)";
    const res = await req.query(`
      SELECT D.CARI_DEKONT_ID dekontNo, D.TIP tipKod, S.TIP satirTip, D.TARIH tarih, CONVERT(char(10), CAST(D.TARIH AS date), 23) gun, D.VADE vade, CAST(GETDATE() AS date) bugun, RTRIM(ISNULL(D.ACIKLAMA,'')) aciklama,
        RTRIM(ISNULL(B.KOD,'')) borcluKod, RTRIM(ISNULL(B.AD,'')) borcluAd, RTRIM(ISNULL(A.KOD,'')) alacakliKod, RTRIM(ISNULL(A.AD,'')) alacakliAd,
        CASE WHEN D.TIP=0 THEN RTRIM(ISNULL(A.AD,'')) ELSE RTRIM(ISNULL(B.AD,'')) END ilgiliAd, CASE WHEN D.TIP=0 THEN RTRIM(ISNULL(A.KOD,'')) ELSE RTRIM(ISNULL(B.KOD,'')) END ilgiliKod,
        RTRIM(ISNULL(CASE WHEN S.TIP=0 THEN COALESCE(B.KOD, A.KOD) ELSE COALESCE(A.KOD, B.KOD) END,'')) cariKod, RTRIM(ISNULL(CASE WHEN S.TIP=0 THEN COALESCE(B.AD, A.AD) ELSE COALESCE(A.AD, B.AD) END,'')) cariAd,
        RTRIM(ISNULL(V.KOD,'')) vezneKod, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(S.MEBLAG,0) meblag, ISNULL(S.KUR,0) kur,
        ${sema.hasOrani ? "ISNULL(NULLIF(S.HAS_ORANI,0),ISNULL(P.HAS_ORANI,0))" : "ISNULL(P.HAS_ORANI,0)"} hasOrani,
        CASE WHEN D.IPTAL_TARIHI IS NULL THEN 0 ELSE 1 END iptal, ${sema.kapandi ? "CASE WHEN ISNULL(D.KAPANDI,0)=0 THEN 0 ELSE 1 END" : "0"} kapandi
      FROM dbo.TODVZ_CARI_DEKONT D JOIN dbo.TODVZ_CARI_DEKONT_SATIRI S ON S.CARI_DEKONT_ID=D.CARI_DEKONT_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
        LEFT JOIN dbo.TODVZ_CARI_KART B ON B.CARI_KART_ID=D.BORCLU_ID LEFT JOIN dbo.TODVZ_CARI_KART A ON A.CARI_KART_ID=D.ALACAKLI_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=D.VEZNE_ID
      WHERE D.VADE IS NOT NULL AND D.IPTAL_TARIHI IS ${iptaller ? "NOT NULL" : "NULL"} AND (@htip IS NULL OR S.TIP=@htip)
        AND (@bas IS NULL OR CAST(D.TARIH AS date) BETWEEN @bas AND @bit) AND (@vdbas IS NULL OR CAST(D.VADE AS date) BETWEEN @vdbas AND @vdbit)
        ${durum}${cariKosulu}${vezneKosulu}${paraKosulu}
      ORDER BY ${duzen.sira};`);
    // Grup para iken paralar Döviz → Kuyum bölümlerine dizilir (K11; docs 1.6)
    const kayitlar = duzen.kip === "vade" ? paraGrubunaGoreSirala(res.recordset as any[], s => pg.grup(s)) : res.recordset as any[];
    return { ...sinirla(kayitlar.map(vadeliIslemSatiri), t, ozet, bosNot), gruplar: duzen.gruplar };
  },
};

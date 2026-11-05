import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, TL_PARA_SQL, aralikOzeti, filtreler, gunOnce, kurTarihlerde, kurTarihte, ozetEk, sinirla, vezneBakiyeleri } from "../raporOrtak.js";
import { PERAKENDE_SATIR_PARASI, YEREL_GUN, belgeTablolari } from "../kaynak.js";

/**
 * Sektörlü Kâr / Zarar Faaliyet Analizi (KARZAR1) — docs/SEKTORLU_RAPORLAR_YOL_HARITASI.md bölüm A (K1–K10). Yalnızca SELECT.
 * Bölüm = fiş türü: 1 Döviz fişi, 2 Sarraf fişi, 3 Perakende fişi, 4 Ticari fiş (K1). Bölümler firmanın lisansına göre süzülür (K10);
 * tek bölüm kaldığında motor bölüm başlığı ve bölüm toplamı basmaz.
 * Maliyet havuzu para başına ve bölümler arası ortaktır (ağırlıklı ortalama, `maliyetYurut` kuralı): sarraf fişiyle alınan 22 ayar perakende fişiyle
 * satılabilir; bölüm yalnızca satışın hangi fişle yapıldığını ayırır. Havuza girmeyen satırlar kendi maliyetini taşır (`maliyetSabit`):
 * barkodlu ürün = ürün kartındaki maliyet (K7), ticari mal = stok kartı son alış fiyatı (K6).
 * Rapor altı: eski rpt'nin K/M/T × Devir/Alış/Satış/Kapanış + E/F/T tablosu (para bazında, havuz), "TL" satırı ve seçilen para (karşılık parası) bloğu (K3).
 */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

export const BOLUM_ADI: Record<number, string> = { 1: "Döviz fişi", 2: "Sarraf fişi", 3: "Perakende fişi", 4: "Ticari fiş" };

/** Rapor altı KMT tablosunun grup başlıkları (kullanıcı kararı 05.11.2026): paralar Döviz / Kuyum diye ayrılır, ticari mallar Ticari'de kalır */
export const KMT_GRUP_ADI = { doviz: "Döviz", kuyum: "Kuyum", ticari: "Ticari", toplam: "Toplam" } as const;

/**
 * Para kuyum (altın / gümüş / ziynet) parası mı? Para kartındaki ürün tipi altın ayarlarında 0 kalabildiği için (22 / 14 / 18 ayar kartları)
 * has oranı, kod ve ad da okunur. Saf fonksiyon.
 */
export function kuyumParasiMi(x: { kod: string; ad: string; hasOrani?: number; urunTipi?: number | null }): boolean {
  const kod = String(x.kod || "").trim().toLocaleUpperCase("tr"), metin = `${kod} ${String(x.ad || "").toLocaleUpperCase("tr")}`;
  const ut = x.urunTipi == null ? 0 : Number(x.urunTipi);
  return ut === 1 || ut === 2 || ut === 3 || (Number(x.hasOrani) || 0) > 0 || kod === "HAS"
    || /ALTIN|AYAR|G[ÜU]M[ÜU][ŞS]|[ÇC]EYREK|YARIM|Z[İI]YNET|CUMHUR|RE[ŞS]AT|B[İI]LEZ[İI]K/.test(metin);
}

/** Tek alış / satış satırı (dört fiş türünden ortak biçim) */
export interface KzHareket {
  bolum: 1 | 2 | 3 | 4;
  /** Para kimliği; ticari malda −STOK_KART_ID (paralarla çakışmaz) */
  paraId: number; paraKod: string; paraAd: string; siraNo: number;
  /** YYYY-AA-GG (iş günü) ve gün içi sıra (ms; yoksa 0) */
  gun: string; zamanMs: number;
  /** 0 alış, 1 satış */
  tip: number;
  miktar: number;
  /** TL, KDV hariç */
  tutar: number;
  kur: number;
  komisyon: number; vergiler: number;
  /** İşçilik geliri TL (K5): satışta +, alışta − (sarraf fişi); perakende işçiliği tanımlı değil → 0 */
  iscilik: number;
  /** Satırın kendi maliyeti (TL): havuzdan düşülmez, havuza girmez (barkodlu ürün, ticari mal) */
  maliyetSabit?: number;
}

export interface KzAyarlar {
  baslangic: string;
  /** Devir günü ve kapanış günü kurları (para → efektif alış; TL = 1) */
  devirKur: Map<number, number>; kapanisKur: Map<number, number>;
  tlId: number;
  /** Karşılık parası (eski rpt "seçilen para"); TL ise id = tlId */
  hedef: { id: number; kod: string };
  /** Dönem başındaki TL mevcudu (eski "TL" satırının devri) */
  tlDevir: number;
  /** Ticari malların K/M/T toplamı (stok hareketlerinden; yoksa yok) */
  ticari?: { devirTutar: number; alisTutar: number; satisTutar: number; satisMaliyeti: number; kapanisTutar: number };
  /** Gösterilecek bölümler (lisans, K10); boş = hepsi */
  bolumler?: Set<number>;
  /** Kuyum paraları (altın / gümüş / ziynet): KMT tablosunda "Kuyum" başlığı altına girer; listede olmayan para "Döviz" sayılır */
  kuyumParalar?: Set<number>;
}

const y2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Saf hesap: hareketlerden bölüm × para satırları ve rapor altı KMT/EFT tablosu. Veritabanı gerekmez (test: scripts/rapor-motor-test.ts).
 * Havuz kuralı maliyetYurut ile aynı: alış stoka maliyetiyle girer, satış o andaki ortalama maliyetle düşer; stok yokken son ortalama, o da yoksa satış kuru.
 */
export function karZararHesapla(hareketler: KzHareket[], a: KzAyarlar) {
  const sirali = [...hareketler].sort((x, y) => x.gun.localeCompare(y.gun) || x.zamanMs - y.zamanMs || x.bolum - y.bolum);
  const havuz = new Map<number, { miktar: number; maliyet: number; sonOrt: number }>();
  type Satir = { bolum: number; bolumAd: string; paraId: number; paraKod: string; paraAd: string; siraNo: number; alisMiktar: number; alisTutar: number; satisMiktar: number; satisTutar: number;
    satisMaliyeti: number; brutKar: number; iscilik: number; komisyon: number; vergiler: number; netKar: number; ortMaliyet: number; kalanMiktar: number; ortAlisKuru: number; ortSatisKuru: number; brutKarHedef: number; netKarHedef: number };
  const satirlar = new Map<string, Satir>();
  // Para bazında havuz özeti (KMT/EFT): devir = dönem öncesi alış − satış; alış/satış dönem içi; barkodlu / ticari (sabit maliyetli) satırlar girmez
  type ParaOzet = { paraId: number; paraKod: string; siraNo: number; devirMiktar: number; alisMiktar: number; alisTutar: number; satisMiktar: number; satisTutar: number };
  const paralar = new Map<number, ParaOzet>();
  const satirAl = (h: KzHareket) => {
    const k = `${h.bolum}|${h.paraId}`;
    let s = satirlar.get(k);
    if (!s) { s = { bolum: h.bolum, bolumAd: BOLUM_ADI[h.bolum], paraId: h.paraId, paraKod: h.paraKod, paraAd: h.paraAd, siraNo: h.siraNo, alisMiktar: 0, alisTutar: 0, satisMiktar: 0, satisTutar: 0,
      satisMaliyeti: 0, brutKar: 0, iscilik: 0, komisyon: 0, vergiler: 0, netKar: 0, ortMaliyet: 0, kalanMiktar: 0, ortAlisKuru: 0, ortSatisKuru: 0, brutKarHedef: 0, netKarHedef: 0 }; satirlar.set(k, s); }
    return s;
  };
  for (const h of sirali) {
    const donemde = h.gun >= a.baslangic;
    const miktar = Number(h.miktar) || 0, tutar = Number(h.tutar) || 0;
    let maliyet = 0;
    if (h.maliyetSabit == null) {
      const s = havuz.get(h.paraId) || { miktar: 0, maliyet: 0, sonOrt: 0 };
      if (!paralar.has(h.paraId)) paralar.set(h.paraId, { paraId: h.paraId, paraKod: h.paraKod, siraNo: h.siraNo, devirMiktar: 0, alisMiktar: 0, alisTutar: 0, satisMiktar: 0, satisTutar: 0 });
      const po = paralar.get(h.paraId)!;
      if (h.tip === 0) { s.miktar += miktar; s.maliyet += tutar; if (s.miktar > 0) s.sonOrt = s.maliyet / s.miktar; if (!donemde) po.devirMiktar += miktar; else { po.alisMiktar += miktar; po.alisTutar += tutar; } }
      else {
        const ort = s.miktar > 0 ? s.maliyet / s.miktar : (s.sonOrt || Number(h.kur) || 0);
        maliyet = miktar * ort;
        s.miktar -= miktar; s.maliyet -= maliyet; if (s.miktar <= 0.0000001) { s.miktar = Math.max(s.miktar, 0); s.maliyet = s.miktar * ort; } s.sonOrt = ort;
        if (!donemde) po.devirMiktar -= miktar; else { po.satisMiktar += miktar; po.satisTutar += tutar; }
      }
      havuz.set(h.paraId, s);
    } else maliyet = h.tip === 1 ? Number(h.maliyetSabit) || 0 : 0;
    if (!donemde) continue;
    const r = satirAl(h);
    if (h.tip === 0) { r.alisMiktar += miktar; r.alisTutar += tutar; }
    else { r.satisMiktar += miktar; r.satisTutar += tutar; r.satisMaliyeti += maliyet; r.brutKar += tutar - maliyet; }
    r.iscilik += Number(h.iscilik) || 0; r.komisyon += Number(h.komisyon) || 0; r.vergiler += Number(h.vergiler) || 0;
  }
  const hedefKur = a.hedef.id === a.tlId ? 1 : a.kapanisKur.get(a.hedef.id) ?? 0;
  const cevir = (tl: number) => (hedefKur > 0 ? tl / hedefKur : 0);
  const cikti = [...satirlar.values()]
    .filter(r => !a.bolumler || a.bolumler.has(r.bolum))
    .filter(r => r.alisMiktar || r.satisMiktar || r.komisyon || r.iscilik)
    .map(r => { const s = havuz.get(r.paraId);
      const netKar = r.brutKar + r.iscilik + r.komisyon - r.vergiler;
      return { ...r, netKar, ortMaliyet: s ? (s.miktar > 0 ? s.maliyet / s.miktar : s.sonOrt) : 0, kalanMiktar: s ? s.miktar : 0,
        ortAlisKuru: r.alisMiktar > 0 ? r.alisTutar / r.alisMiktar : 0, ortSatisKuru: r.satisMiktar > 0 ? r.satisTutar / r.satisMiktar : 0,
        brutKarHedef: y2(cevir(r.brutKar)), netKarHedef: y2(cevir(netKar)) }; })
    .sort((x, y) => x.bolum - y.bolum || x.siraNo - y.siraNo || x.paraKod.localeCompare(y.paraKod, "tr"));

  // Eski "KÂR / ZARAR FAALİYET ANALİZİ" rapor altı — formüller rpt'den birebir (@OrtalamaAlisKuru, @OrtalamaSatisKuru, @DevirTutar, @KapanisTutar, @Evaluasyon, @Faaliyet,
  // @DevirTLMiktari, @MevcutTLMiktari, @KapanisToplamTL, @SecilenPara*, @ToplamKar, @ToplamEvaluasyon). Para satırları havuzdan (bölümler toplamı).
  const kmt: Record<string, any>[] = [];
  let tDevir = 0, tAlis = 0, tSatis = 0, tKapanis = 0, tF = 0;
  // Para kolonu gruplara ayrılır (kullanıcı kararı 05.11.2026): önce Döviz paraları, sonra Kuyum paraları, sonra Ticari; her grup bir başlık satırıyla
  // başlar (`_stil: "baslik"`, motor kalın ve bantlı basar). Para blokları ve formüller değişmez.
  const baslikSatiri = (ad: string) => ({ para: ad, kmt: "", devir: null, alis: null, satis: null, kapanis: null, eft: "", sonuc: null, _stil: "baslik" });
  const kuyum = (id: number) => (a.kuyumParalar?.has(id) ? 1 : 0);
  const paraListesi = [...paralar.values()].filter(o => o.paraId !== a.tlId && (o.alisMiktar || o.satisMiktar || Math.abs(o.devirMiktar) > 0.000001))
    .sort((x, y) => kuyum(x.paraId) - kuyum(y.paraId) || x.siraNo - y.siraNo || x.paraKod.localeCompare(y.paraKod, "tr"));
  let acikGrup = -1;
  for (const o of paraListesi) {
    if (kuyum(o.paraId) !== acikGrup) { acikGrup = kuyum(o.paraId); kmt.push(baslikSatiri(acikGrup ? KMT_GRUP_ADI.kuyum : KMT_GRUP_ADI.doviz)); }
    const dk = a.devirKur.get(o.paraId) ?? 0, kk = a.kapanisKur.get(o.paraId) ?? 0, mevcut = o.devirMiktar + o.alisMiktar - o.satisMiktar;
    const ortAlis = !o.alisMiktar || !o.alisTutar ? dk : o.alisTutar / o.alisMiktar, ortSatis = o.satisMiktar ? o.satisTutar / o.satisMiktar : 0;
    const E = !o.alisMiktar ? o.devirMiktar * (kk - dk) : o.devirMiktar * (ortAlis - dk) + mevcut * (kk - ortAlis), F = o.satisMiktar * (ortSatis - ortAlis);
    kmt.push({ para: o.paraKod, kmt: "K", devir: dk, alis: ortAlis, satis: ortSatis, kapanis: kk, eft: "E", sonuc: E },
      { para: "", kmt: "M", devir: o.devirMiktar, alis: o.alisMiktar, satis: o.satisMiktar, kapanis: mevcut, eft: "F", sonuc: F },
      { para: "", kmt: "T", devir: o.devirMiktar * dk, alis: o.alisTutar, satis: o.satisTutar, kapanis: mevcut * kk, eft: "T", sonuc: E + F });
    tDevir += o.devirMiktar * dk; tAlis += o.alisTutar; tSatis += o.satisTutar; tKapanis += mevcut * kk; tF += F;
  }
  if (a.ticari && (a.ticari.alisTutar || a.ticari.satisTutar || a.ticari.devirTutar || a.ticari.kapanisTutar)) {
    // Ticari mallar: stok kartı son alış fiyatıyla değerlenir (K6/K8); kur kavramı olmadığından yalnız T satırı, F = satış − satış maliyeti, E = 0
    const F = a.ticari.satisTutar - a.ticari.satisMaliyeti;
    kmt.push(baslikSatiri(KMT_GRUP_ADI.ticari));
    kmt.push({ para: "TİCARİ (TL)", kmt: "T", devir: a.ticari.devirTutar, alis: a.ticari.alisTutar, satis: a.ticari.satisTutar, kapanis: a.ticari.kapanisTutar, eft: "F", sonuc: F });
    tDevir += a.ticari.devirTutar; tAlis += a.ticari.alisTutar; tSatis += a.ticari.satisTutar; tKapanis += a.ticari.kapanisTutar; tF += F;
  }
  if (kmt.length || a.tlDevir) {
    const mevcutTL = a.tlDevir + tSatis - tAlis; // @MevcutTLMiktari
    kmt.push(baslikSatiri(KMT_GRUP_ADI.toplam));
    kmt.push({ para: "TL", kmt: "M", devir: a.tlDevir, alis: null, satis: null, kapanis: mevcutTL, eft: "", sonuc: null });
    // Seçilen para bloğu: kurlar devir / kapanış günü; alış ve satış kuru seçilen paranın dönem ortalaması (yoksa devir / kapanış kuru). TL seçiliyse hepsi 1.
    const sp = paralar.get(a.hedef.id), tl = a.hedef.id === a.tlId;
    const sDevirK = tl ? 1 : a.devirKur.get(a.hedef.id) ?? 0, sKapanisK = tl ? 1 : a.kapanisKur.get(a.hedef.id) ?? 0;
    const sAlisK = tl ? 1 : sp && sp.alisMiktar && sp.alisTutar ? sp.alisTutar / sp.alisMiktar : sDevirK;
    const sSatisK = tl ? 1 : sp && sp.satisMiktar ? sp.satisTutar / sp.satisMiktar : sKapanisK;
    const kapanisToplamTL = tKapanis + mevcutTL; // @KapanisToplamTL
    const sDevir = sDevirK ? tDevir / sDevirK : tDevir; // @SecilenParaDevirMiktar
    const sAlis = !sAlisK || !sDevirK ? 0 : tAlis / sDevirK; // @SecilenParaAlisMiktar (rpt'de devir kuruna bölünür)
    const sSatis = sSatisK ? tSatis / sSatisK : 0; // @SecilenParaSatisMiktar
    const sMevcut = sKapanisK ? kapanisToplamTL / sKapanisK : kapanisToplamTL; // @SecilenParaMevcutMiktar
    const sF = sKapanisK ? tF / sKapanisK : 0; // @SecilenParaFaaliyetKari
    const toplamKar = sMevcut - sDevir, toplamE = toplamKar - sF; // @ToplamKar, @ToplamEvaluasyon
    kmt.push({ para: a.hedef.kod, kmt: "K", devir: sDevirK, alis: sAlisK, satis: sSatisK, kapanis: sKapanisK, eft: "E", sonuc: toplamE },
      { para: "", kmt: "M", devir: sDevir, alis: sAlis, satis: sSatis, kapanis: sMevcut, eft: "F", sonuc: sF },
      { para: "", kmt: "T", devir: tDevir, alis: tAlis, satis: tSatis, kapanis: kapanisToplamTL, eft: "T", sonuc: toplamKar });
  }
  return { satirlar: cikti, kmt };
}

/** Lisansa göre bölümler (K10): modül listesi null = kısıt yok; tablo yoksa bölüm zaten yok */
export function acikBolumler(moduller: string[] | null | undefined, d: { sarraf: boolean; perakende: boolean; ticariSatir: boolean }): Set<number> {
  const acik = (kod: string) => moduller == null || moduller.includes(kod);
  const b = new Set<number>();
  if (acik("vezne:vezne/doviz-fisi-kayit")) b.add(1);
  if (d.sarraf && acik("vezne:vezne/sarraf-fisi-kayit")) b.add(2);
  if (d.perakende && acik("vezne:vezne/perakende-fisi-kayit")) b.add(3);
  if (d.ticariSatir && (moduller == null || moduller.some(m => m === "ticari" || m.startsWith("ticari:")))) b.add(4);
  return b;
}

const zamanMs = (v: any) => { if (!v) return 0; const d = new Date(v); return Number.isNaN(d.getTime()) ? 0 : d.getTime() % 86400000; };
const gunMetni = (v: any) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || "").slice(0, 10));

export const KARZAR_SORGULARI: Record<string, Sorgu> = {
  async KARZAR1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const d = await belgeTablolari(pool);
    const kolon = (await pool.request().query(`SELECT
      CASE WHEN COL_LENGTH('dbo.TODVZ_FATURA','FIS_KAYNAGI') IS NULL THEN 0 ELSE 1 END fisKaynagi,
      CASE WHEN COL_LENGTH('dbo.TODVZ_SARRAF_FISI','ALTIN_HAS_KURU') IS NULL THEN 0 ELSE 1 END hasKuru,
      CASE WHEN COL_LENGTH('dbo.TODVZ_ALTIN_URUN','MALIYET_PARA_KODU') IS NULL THEN 0 ELSE 1 END altinMaliyetPara,
      CASE WHEN COL_LENGTH('dbo.TODVZ_ALTIN_URUN','MALIYET_ISCILIK_TUTARI') IS NULL THEN 0 ELSE 1 END altinIscilik,
      CASE WHEN COL_LENGTH('dbo.TODVZ_OZEL_URUN','MALIYET_PARA_KODU') IS NULL THEN 0 ELSE 1 END ozelMaliyetPara,
      CASE WHEN OBJECT_ID('dbo.TODVZ_STOK_HAREKET','U') IS NULL OR OBJECT_ID('dbo.TODVZ_STOK_KART','U') IS NULL THEN 0 ELSE 1 END stok,
      CASE WHEN COL_LENGTH('dbo.TODVZ_PARA','HAS_ORANI') IS NULL THEN 0 ELSE 1 END paraHasOrani,
      CASE WHEN COL_LENGTH('dbo.TODVZ_PARA','URUN_TIPI') IS NULL THEN 0 ELSE 1 END paraUrunTipi,
      ${TL_PARA_SQL} tlId, (SELECT TOP 1 PARA_ID FROM dbo.TODVZ_PARA WHERE RTRIM(UPPER(KOD))='HAS' ORDER BY PARA_ID) hasId`)).recordset[0] || {};
    const tlId = Number(kolon.tlId) || 1, hasId = Number(kolon.hasId) || 0;
    const paraSuzgeci = !!(p.paraId || p.paraIdler?.length);
    const bolumler = acikBolumler(p.acikModuller, d);
    const hareketler: KzHareket[] = [];
    // Kuyum paraları (KMT tablosunun "Kuyum" başlığı): para kartından (has oranı / ürün tipi / ad) ve sarraf fişinde altın / gümüş / ziynet olarak işlem görenler
    const kuyumParalar = new Set<number>();
    for (const x of (await pool.request().query(`SELECT PARA_ID id, RTRIM(ISNULL(KOD,'')) kod, RTRIM(ISNULL(AD,'')) ad,
      ${kolon.paraHasOrani ? "ISNULL(HAS_ORANI,0)" : "0"} hasOrani, ${kolon.paraUrunTipi ? "URUN_TIPI" : "NULL"} urunTipi FROM dbo.TODVZ_PARA`)).recordset)
      if (kuyumParasiMi({ kod: String(x.kod), ad: String(x.ad), hasOrani: Number(x.hasOrani) || 0, urunTipi: x.urunTipi })) kuyumParalar.add(Number(x.id));
    const paraKolonlari = `RTRIM(P.KOD) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo`;
    const tlDegil = `RTRIM(UPPER(P.KOD)) NOT IN ('TL','TRY')`;

    // 1) Döviz fişi satırları (tüm geçmiş ≤ bitiş: havuz)
    {
      const req = pool.request().input("bit", sql.Date, p.bitis);
      const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
      const r = await req.query(`
        SELECT CONVERT(char(10), CAST(F.TARIH AS date), 23) gun, F.ZAMAN zaman, CAST(F.TIP AS int) tip, S.PARA_ID paraId, ${paraKolonlari},
          ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0)+ISNULL(S.KMV,0)+ISNULL(S.KDV,0) vergiler
        FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
        WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@bit AND ${tlDegil} ${f}
        ORDER BY F.TARIH, F.FIS_ID, S.SATIR_NO;`);
      for (const x of r.recordset) hareketler.push({ bolum: 1, paraId: Number(x.paraId), paraKod: x.paraKod, paraAd: x.paraAd, siraNo: Number(x.siraNo), gun: gunMetni(x.gun), zamanMs: zamanMs(x.zaman),
        tip: Number(x.tip) === 0 ? 0 : 1, miktar: Number(x.miktar), tutar: Number(x.tutar), kur: Number(x.kur), komisyon: Number(x.komisyon), vergiler: Number(x.vergiler), iscilik: 0 });
    }

    // 2) Sarraf fişi ürün satırları: ürün birimi Adet ise ADET, değilse MİKTAR (kaynak.ts ile aynı); TUTAR TL; işçilik = tutar / has gram × has kuru / miktar (SP kuralı)
    if (d.sarraf) {
      const req = pool.request().input("bit", sql.Date, p.bitis);
      const f = filtreler(req, p, { vezne: "V", para: "SS.URUN_ID" });
      const hasKuru = kolon.hasKuru ? "ISNULL(SF.ALTIN_HAS_KURU,0)" : "0";
      const r = await req.query(`
        SELECT CONVERT(char(10), CAST(SF.TARIH AS date), 23) gun, SF.SAAT zaman, CAST(SF.TIP AS int) tip, SS.URUN_ID paraId, ${paraKolonlari},
          CASE WHEN ISNULL(SS.URUN_TIPI, P.URUN_TIPI) IN (1,2) THEN ISNULL(SS.MIKTAR,0)
               WHEN ISNULL(SS.URUN_TIPI, P.URUN_TIPI) IN (0,3) THEN CASE WHEN ISNULL(SS.ADET,0)>0 THEN SS.ADET ELSE CASE WHEN ISNULL(SS.MIKTAR,0)>0 THEN SS.MIKTAR ELSE 1 END END
               ELSE ISNULL(SS.MIKTAR,0) END miktar, ISNULL(SS.URUN_TIPI, P.URUN_TIPI) urunTipi,
          ISNULL(SS.KUR,0) kur, ISNULL(SS.TUTAR,0) tutar,
          CASE WHEN ISNULL(SS.ISCILIK_TUTARI,0)>0 THEN SS.ISCILIK_TUTARI WHEN ISNULL(SS.ISCILIK_HAS_GRAM,0)>0 THEN SS.ISCILIK_HAS_GRAM*${hasKuru}
               WHEN ISNULL(SS.ISCILIK_MIKTARI,0)>0 THEN SS.ISCILIK_MIKTARI ELSE 0 END iscilik
        FROM dbo.TODVZ_SARRAF_FISI SF JOIN dbo.TODVZ_SARRAF_FISI_SATIRI SS ON SS.SARRAF_FISI_ID=SF.SARRAF_FISI_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=SS.URUN_ID
          LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=SF.VEZNE_ID
        WHERE SS.URUN_ID IS NOT NULL AND CAST(SF.TARIH AS date)<=@bit AND ${tlDegil} ${f}
        ORDER BY SF.TARIH, SF.SARRAF_FISI_ID, SS.SATIR_NO;`);
      for (const x of r.recordset) { const tip = Number(x.tip) === 0 ? 0 : 1, isc = Number(x.iscilik) || 0;
        if ([1, 2, 3].includes(Number(x.urunTipi))) kuyumParalar.add(Number(x.paraId));
        hareketler.push({ bolum: 2, paraId: Number(x.paraId), paraKod: x.paraKod, paraAd: x.paraAd, siraNo: Number(x.siraNo), gun: gunMetni(x.gun), zamanMs: zamanMs(x.zaman),
          tip, miktar: Number(x.miktar), tutar: Number(x.tutar), kur: Number(x.kur), komisyon: 0, vergiler: 0, iscilik: tip === 1 ? isc : -isc }); }
    }

    // 3) Perakende fişi (FIS_KAYNAGI 0) ve 4) Ticari fiş (FIS_KAYNAGI 1); fatura parası TL değilse tutarlar fatura kuruyla TL'ye; iptal (E_BELGE_DURUMU 4) hariç
    if (d.perakende) {
      const kaynak = kolon.fisKaynagi ? "ISNULL(F.FIS_KAYNAGI,0)" : "0";
      const faturaKur = `CASE WHEN F.PARA_ID IS NULL OR F.PARA_ID=${TL_PARA_SQL} OR ISNULL(F.KUR,0)=0 THEN 1 ELSE F.KUR END`;
      const ortak = `CONVERT(char(10), ${YEREL_GUN("F.TARIH")}, 23) gun, F.TARIH zaman, CASE WHEN F.FATURA_TIPI=1 THEN 1 ELSE 0 END tip, ISNULL(S.TUTAR,0)*${faturaKur} tutar, ISNULL(S.BIRIM_FIYAT,0) kur`;
      const fWhere = `ISNULL(F.E_BELGE_DURUMU,0)<>4 AND ${YEREL_GUN("F.TARIH")}<=@bit`;
      // 3a) Barkodsuz gram / adet satırı: stok parası ve miktarı (01.10.2026 öncesi satırlarda kaydetmedeki eşleştirme) — havuza girer
      {
        const req = pool.request().input("bit", sql.Date, p.bitis);
        const paraIfade = `COALESCE(${d.perakendeStok ? "S.STOK_PARA_ID, " : ""}P1.PARA_ID, P2.PARA_ID)`;
        const q = `COALESCE(${d.perakendeStok ? "S.STOK_MIKTAR" : "NULL"}, CASE WHEN S.GRAM > 0 THEN S.GRAM ELSE S.MIKTAR END)`;
        const f = filtreler(req, p, { vezne: "V", para: "P.PARA_ID" });
        const r = await req.query(`
          SELECT X.*, ${paraKolonlari} FROM (
            SELECT ${ortak}, ${paraIfade} paraId, ${q} miktar, F.VEZNE_ID vezneId
            FROM dbo.TODVZ_FATURA F JOIN dbo.TODVZ_FATURA_SATIRI S ON S.FATURA_ID=F.FATURA_ID ${PERAKENDE_SATIR_PARASI("S")}
            WHERE ${fWhere} AND ${kaynak}=0 AND ISNULL(S.ALTIN_URUN_ID,0)=0 AND LEN(LTRIM(RTRIM(ISNULL(S.BARKOD,''))))=0${d.ticariSatir ? " AND S.STOK_KART_ID IS NULL" : ""}
              AND ISNULL(F.VEZNE_ID,0)>0 AND ${q}>0
          ) X JOIN dbo.TODVZ_PARA P ON P.PARA_ID=X.paraId LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=X.vezneId
          WHERE ${tlDegil} ${f}
          ORDER BY X.gun, X.zaman`);
        for (const x of r.recordset) hareketler.push({ bolum: 3, paraId: Number(x.paraId), paraKod: x.paraKod, paraAd: x.paraAd, siraNo: Number(x.siraNo), gun: gunMetni(x.gun), zamanMs: zamanMs(x.zaman),
          tip: Number(x.tip), miktar: Number(x.miktar), tutar: Number(x.tutar), kur: Number(x.kur), komisyon: 0, vergiler: 0, iscilik: 0 });
      }
      // 3b) Barkodlu ürün satırı: HAS gramı üzerinden, maliyet ürün kartından (K7) — satış günü kuruyla TL; havuza girmez
      if (d.altinUrun || d.ozelUrun) {
        const req = pool.request().input("bit", sql.Date, p.bitis);
        const f = filtreler(req, p, { vezne: "V" });
        const altin = d.altinUrun ? `LEFT JOIN dbo.TODVZ_ALTIN_URUN U ON (S.ALTIN_URUN_ID=U.ALTIN_URUN_ID OR (ISNULL(S.ALTIN_URUN_ID,0)=0 AND LEN(LTRIM(RTRIM(ISNULL(S.BARKOD,''))))>0 AND S.BARKOD=U.BARKOD))` : "";
        const ozel = d.ozelUrun ? `LEFT JOIN dbo.TODVZ_OZEL_URUN OU ON ${d.altinUrun ? "U.ALTIN_URUN_ID IS NULL AND " : ""}LEN(LTRIM(RTRIM(ISNULL(S.BARKOD,''))))>0 AND (OU.BARKOD=S.BARKOD OR CAST(OU.OZEL_URUN_ID AS varchar(50))=S.BARKOD)` : "";
        const r = await req.query(`
          SELECT ${ortak}, COALESCE(NULLIF(S.HAS_GRAM,0)${d.altinUrun ? ", U.HAS_GRAM" : ""}, 0) hasGram,
            ${d.altinUrun ? "ISNULL(U.MALIYET,0)" : "0"} altinMaliyet, ${d.altinUrun && kolon.altinMaliyetPara ? "RTRIM(ISNULL(U.MALIYET_PARA_KODU,'HAS'))" : "'HAS'"} altinMaliyetPara,
            ${d.altinUrun && kolon.altinIscilik ? "ISNULL(U.MALIYET_ISCILIK_TUTARI,0)" : "0"} altinIscilikMaliyet, ${d.altinUrun && kolon.altinIscilik ? "RTRIM(ISNULL(U.MALIYET_ISCILIK_PARA_KODU,'HAS'))" : "'HAS'"} altinIscilikPara,
            ${d.ozelUrun ? "ISNULL(OU.MALIYET,0)" : "0"} ozelMaliyet, ${d.ozelUrun && kolon.ozelMaliyetPara ? "RTRIM(ISNULL(OU.MALIYET_PARA_KODU,'USD'))" : "'USD'"} ozelMaliyetPara,
            ${d.altinUrun ? "CASE WHEN U.ALTIN_URUN_ID IS NULL THEN 0 ELSE 1 END" : "0"} altinMi, ${d.ozelUrun ? "CASE WHEN OU.OZEL_URUN_ID IS NULL THEN 0 ELSE 1 END" : "0"} ozelMi
          FROM dbo.TODVZ_FATURA F JOIN dbo.TODVZ_FATURA_SATIRI S ON S.FATURA_ID=F.FATURA_ID ${altin} ${ozel} LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
          WHERE ${fWhere} AND ${kaynak}=0 AND (ISNULL(S.ALTIN_URUN_ID,0)>0 OR LEN(LTRIM(RTRIM(ISNULL(S.BARKOD,''))))>0)${d.ticariSatir ? " AND S.STOK_KART_ID IS NULL" : ""} ${f}
          ORDER BY F.TARIH, F.FATURA_ID, S.SATIR_NO`);
        if (r.recordset.length && (!paraSuzgeci || (p.paraIdler || []).includes(hasId) || p.paraId === hasId)) {
          // Maliyet parası kodları → günün kuru (HAS / USD / TL …)
          const kodlar = new Set<string>(); const gunler = new Set<string>();
          for (const x of r.recordset) { kodlar.add(String(x.altinMi ? x.altinMaliyetPara : x.ozelMaliyetPara).toUpperCase()); if (x.altinMi) kodlar.add(String(x.altinIscilikPara).toUpperCase()); gunler.add(gunMetni(x.gun)); }
          const paraIdleri = new Map<string, number>();
          const pr = await pool.request().query(`SELECT PARA_ID id, RTRIM(UPPER(KOD)) kod FROM dbo.TODVZ_PARA`);
          for (const x of pr.recordset) paraIdleri.set(String(x.kod), Number(x.id));
          const kurlar = await kurTarihlerde(pool, gunler);
          const kuru = (gun: string, kod: string) => { const u = kod.toUpperCase(); if (u === "TL" || u === "TRY") return 1; const id = paraIdleri.get(u); return id ? kurlar.get(gun)?.get(id) ?? 0 : 0; };
          const hasKod = hasId ? "HAS" : "BARKOD";
          for (const x of r.recordset) {
            const gun = gunMetni(x.gun);
            const maliyet = x.altinMi
              ? Number(x.altinMaliyet) * kuru(gun, String(x.altinMaliyetPara)) + Number(x.altinIscilikMaliyet) * kuru(gun, String(x.altinIscilikPara))
              : x.ozelMi ? Number(x.ozelMaliyet) * kuru(gun, String(x.ozelMaliyetPara)) : 0;
            hareketler.push({ bolum: 3, paraId: hasId || 0, paraKod: hasKod, paraAd: hasId ? "Has altın (barkodlu ürün)" : "Barkodlu ürün", siraNo: 0, gun, zamanMs: zamanMs(x.zaman),
              tip: Number(x.tip), miktar: Number(x.hasGram) || 0, tutar: Number(x.tutar), kur: Number(x.kur), komisyon: 0, vergiler: 0, iscilik: 0, maliyetSabit: maliyet });
          }
        }
      }
      // 4) Ticari fiş satırları (stok kartlı): maliyet stok kartı son alış fiyatı (K6), kart parası TL değilse satış günü kuruyla
      if (d.ticariSatir && kolon.fisKaynagi && !paraSuzgeci) {
        const req = pool.request().input("bit", sql.Date, p.bitis);
        const f = filtreler(req, p, { vezne: "V" });
        const r = await req.query(`
          SELECT ${ortak}, S.STOK_KART_ID kartId, RTRIM(ISNULL(K.KOD,'')) kartKod, RTRIM(ISNULL(K.AD,'')) kartAd, ISNULL(S.MIKTAR,0) miktar,
            COALESCE(NULLIF(K.SON_ALIS_FIYATI,0), K.ALIS_FIYATI, 0) birimMaliyet, RTRIM(ISNULL(KP.KOD,'TL')) kartPara
          FROM dbo.TODVZ_FATURA F JOIN dbo.TODVZ_FATURA_SATIRI S ON S.FATURA_ID=F.FATURA_ID
            LEFT JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID=S.STOK_KART_ID LEFT JOIN dbo.TODVZ_PARA KP ON KP.PARA_ID=K.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
          WHERE ${fWhere} AND ${kaynak}=1 AND S.STOK_KART_ID IS NOT NULL ${f}
          ORDER BY F.TARIH, F.FATURA_ID, S.SATIR_NO`);
        if (r.recordset.length) {
          const gunler = new Set<string>(r.recordset.map((x: any) => gunMetni(x.gun)));
          const paraIdleri = new Map<string, number>();
          for (const x of (await pool.request().query(`SELECT PARA_ID id, RTRIM(UPPER(KOD)) kod FROM dbo.TODVZ_PARA`)).recordset) paraIdleri.set(String(x.kod), Number(x.id));
          const kurlar = r.recordset.some((x: any) => !["TL", "TRY"].includes(String(x.kartPara).toUpperCase())) ? await kurTarihlerde(pool, gunler) : null;
          for (const x of r.recordset) {
            const gun = gunMetni(x.gun), kod = String(x.kartPara).toUpperCase();
            const kur = kod === "TL" || kod === "TRY" ? 1 : (kurlar?.get(gun)?.get(paraIdleri.get(kod) || 0) ?? 0);
            hareketler.push({ bolum: 4, paraId: -Number(x.kartId), paraKod: x.kartKod, paraAd: x.kartAd, siraNo: 999, gun, zamanMs: zamanMs(x.zaman), tip: Number(x.tip),
              miktar: Number(x.miktar), tutar: Number(x.tutar), kur: Number(x.kur), komisyon: 0, vergiler: 0, iscilik: 0, maliyetSabit: Number(x.miktar) * Number(x.birimMaliyet) * kur });
          }
        }
      }
    }

    // Ticari malların K/M/T toplamı (stok hareketleri: devir = dönem öncesi giriş − çıkış, alış = dönem girişleri, kapanış = mevcut × son alış); vezne süzgeci uygulanmaz
    let ticari: KzAyarlar["ticari"];
    if (d.ticariSatir && kolon.stok && kolon.fisKaynagi && !paraSuzgeci && bolumler.has(4)) {
      const r = await pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).query(`
        SELECT K.STOK_KART_ID id, COALESCE(NULLIF(K.SON_ALIS_FIYATI,0), K.ALIS_FIYATI, 0) birimMaliyet, RTRIM(ISNULL(KP.KOD,'TL')) kartPara,
          SUM(CASE WHEN ${YEREL_GUN("H.TARIH")}<@bas THEN ISNULL(H.GIRIS,0)-ISNULL(H.CIKIS,0) ELSE 0 END) devir,
          SUM(CASE WHEN ${YEREL_GUN("H.TARIH")} BETWEEN @bas AND @bit AND ISNULL(H.GIRIS,0)>0 THEN H.GIRIS ELSE 0 END) alisMiktar,
          SUM(CASE WHEN ${YEREL_GUN("H.TARIH")} BETWEEN @bas AND @bit AND ISNULL(H.GIRIS,0)>0 THEN H.GIRIS*ISNULL(H.BIRIM_FIYAT,0) ELSE 0 END) alisTutar,
          SUM(CASE WHEN ${YEREL_GUN("H.TARIH")}<=@bit THEN ISNULL(H.GIRIS,0)-ISNULL(H.CIKIS,0) ELSE 0 END) mevcut
        FROM dbo.TODVZ_STOK_HAREKET H JOIN dbo.TODVZ_STOK_KART K ON K.STOK_KART_ID=H.STOK_KART_ID LEFT JOIN dbo.TODVZ_PARA KP ON KP.PARA_ID=K.PARA_ID
        GROUP BY K.STOK_KART_ID, K.SON_ALIS_FIYATI, K.ALIS_FIYATI, KP.KOD`);
      const kurBit = await kurTarihte(pool, p.bitis), kurBas = await kurTarihte(pool, gunOnce(p.baslangic));
      const paraIdleri = new Map<string, number>();
      for (const x of (await pool.request().query(`SELECT PARA_ID id, RTRIM(UPPER(KOD)) kod FROM dbo.TODVZ_PARA`)).recordset) paraIdleri.set(String(x.kod), Number(x.id));
      const kurOf = (m: Map<number, number>, kod: string) => (["TL", "TRY"].includes(kod.toUpperCase()) ? 1 : m.get(paraIdleri.get(kod.toUpperCase()) || 0) ?? 0);
      const tc = { devirTutar: 0, alisTutar: 0, satisTutar: 0, satisMaliyeti: 0, kapanisTutar: 0 };
      for (const x of r.recordset) { const bm = Number(x.birimMaliyet) || 0, kod = String(x.kartPara);
        tc.devirTutar += Number(x.devir) * bm * kurOf(kurBas, kod); tc.alisTutar += Number(x.alisTutar) * kurOf(kurBit, kod); tc.kapanisTutar += Number(x.mevcut) * bm * kurOf(kurBit, kod); }
      for (const h of hareketler) if (h.bolum === 4 && h.gun >= p.baslangic && h.tip === 1) { tc.satisTutar += h.tutar; tc.satisMaliyeti += h.maliyetSabit || 0; }
      ticari = tc;
    }

    // Kurlar ve seçilen para
    const devirKur = await kurTarihte(pool, gunOnce(p.baslangic)), kapanisKur = await kurTarihte(pool, p.bitis);
    const hedefId = p.hedefParaId && p.hedefParaId !== tlId ? p.hedefParaId : tlId;
    const hedefKod = hedefId === tlId ? "TL" : String((await pool.request().input("id", sql.Int, hedefId).query(`SELECT RTRIM(KOD) kod FROM dbo.TODVZ_PARA WHERE PARA_ID=@id`)).recordset[0]?.kod || "TL");
    // Dönem başındaki TL mevcudu (eski "TL" satırı): vezne bakiyesi (vezne süzgeciyle)
    const tlDevir = (await vezneBakiyeleri(pool, gunOnce(p.baslangic), p)).filter(v => Number(v.paraId) === tlId).reduce((s, v) => s + (Number(v.miktar) || 0), 0);

    const { satirlar, kmt } = karZararHesapla(hareketler, { baslangic: p.baslangic, devirKur, kapanisKur, tlId, hedef: { id: hedefId, kod: hedefKod }, tlDevir, ticari, bolumler, kuyumParalar });
    const hedefSecili = hedefId !== tlId;
    const bolumOzeti = [...bolumler].sort().map(b => BOLUM_ADI[b]).join(" / ");
    return {
      ...sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm paralar"} · Karşılık parası: ${hedefKod}${bolumOzeti ? ` · ${bolumOzeti}` : ""}`,
        "Seçilen aralıkta hiçbir fiş türünde alış / satış yok.", kmt),
      ...(hedefSecili ? { kolonBasliklari: { brutKarHedef: `Brüt kâr (${hedefKod})`, netKarHedef: `Net kâr (${hedefKod})` } } : { kolonCikar: ["brutKarHedef", "netKarHedef"] }),
    };
  },
};

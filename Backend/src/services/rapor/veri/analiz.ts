import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, adetOzeti, aralikOzeti, filtreler, idFiltre, ozetEk, sinirla } from "../raporOrtak.js";
import { BOLUM_ADI, acikBolumler, fisKaynagi } from "../fisKaynak.js";
import { PARA_GRUP_ADI, type ParaGrubu, paraBasliklariEkle, paraGrubunaGoreSirala, paraGrupBilgisi } from "../paraGrup.js";

/**
 * Analiz raporları (docs/raporlar-faz2.md, Faz R2-A): kârlılık (işlem bazlı), altın işçilik, personel değerlendirme. Yalnızca SELECT.
 * Eski raporlarla eşitleme (docs/RAPOR_ESITLEME_UYGULAMA.md, G2): sektör bölümleri (ALTISC1, PERDEG1), para ayrımı (ALTISC1, KARLIL1), toplam kuralları.
 */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

export interface MaliyetHareketi { paraId: number; tip: number; miktar: number; tutar: number; kur: number }
/**
 * Ağırlıklı ortalama maliyet yürütücüsü — Kâr/Zarar Faaliyet Analizi (KARZAR1) ile aynı kural (yönetici kararı E6):
 * alış stoka maliyetiyle girer; satış o andaki ortalama maliyetle düşer. Stok yokken satışta son bilinen ortalama, o da yoksa satış kuru maliyet sayılır.
 * Hareketler para içinde kronolojik sırada verilmelidir. Her hareket için { ortMaliyet, maliyet } döner (alışta maliyet = 0). Saf fonksiyon.
 */
export function maliyetYurut<T extends MaliyetHareketi>(hareketler: T[]): (T & { ortMaliyet: number; maliyet: number })[] {
  const stok = new Map<number, { miktar: number; maliyet: number; sonOrt: number }>();
  return hareketler.map(h => {
    const s = stok.get(h.paraId) || { miktar: 0, maliyet: 0, sonOrt: 0 };
    const miktar = Number(h.miktar) || 0, tutar = Number(h.tutar) || 0;
    let ort = 0, maliyet = 0;
    if (Number(h.tip) === 0) { s.miktar += miktar; s.maliyet += tutar; if (s.miktar > 0) s.sonOrt = s.maliyet / s.miktar; ort = s.sonOrt; }
    else {
      ort = s.miktar > 0 ? s.maliyet / s.miktar : (s.sonOrt || Number(h.kur) || 0);
      maliyet = miktar * ort;
      s.miktar -= miktar; s.maliyet -= maliyet;
      if (s.miktar <= 0.0000001) { s.miktar = Math.max(s.miktar, 0); s.maliyet = s.miktar * ort; }
      s.sonOrt = ort;
    }
    stok.set(h.paraId, s);
    return { ...h, ortMaliyet: ort, maliyet };
  });
}

/** Sarraf fişi ISCILIK_HESAPLAMA_SEKLI: 0 Gram, 1 Adet, 2 Toplam (kaydeden ekran: src/pages/vezne/SarrafFisiPage.tsx satır hesabı ve seçenek listesi) */
export const ISCILIK_SEKLI: Record<number, string> = { 0: "Gram başına", 1: "Adet başına", 2: "Toplam" };
const PARA_GRUP_SIRASI: Record<ParaGrubu, number> = { doviz: 0, kuyum: 1, ticari: 2 };

/* ------------------------------------------------------------------ Kârlılık (KARLIL1) — saf hesaplar */

export interface KarlilikHareketi { paraId: number; paraKod: string; paraAd: string; tip: number; miktar: number; tutar: number;
  /** Fişin iş günü (YYYY-AA-GG; SQL CAST(F.TARIH AS date) ile aynı) */
  gun: string; ortMaliyet: number }
export interface KarlilikParaSatiri { para: string; paraId: number | null; paraKod: string; alisMiktar: number | null; ortAlis: number | null; ortSatis: number | null; satisMiktar: number | null;
  satisTutar: number; brutKar: number; karYuzde: number }

/**
 * Eski "KARLILIK RAPORU" (para başına tek satır): alış miktarı, ortalama alış, ortalama satış, satış miktarı, satış tutarı, brüt kâr, kâr %.
 * Eski @BrutKar = satış tutarı − satış miktarı × ortalama alış kuru; @YuzdeKar = brüt kâr ÷ satış tutarı × 100.
 * Dönemde hareketi olan her para satır alır (yalnız alış ya da yalnız satış da). Ortalama alış = dönem içi alışların ortalaması; dönemde alış yoksa boş,
 * brüt kâr o zaman yürüyen ortalama maliyetle hesaplanır (eski yordam şifreli — canlıda karşılaştırılacak). Dönemde satış yoksa satış kolonları 0.
 * `yurutulen`: maliyetYurut çıktısı (kayıtların başından); iş günü `bas`tan (YYYY-AA-GG) önceki hareketler yalnız maliyeti oluşturur, tabloya girmez. Saf fonksiyon.
 */
export function karlilikParaOzeti(yurutulen: KarlilikHareketi[], bas: string): KarlilikParaSatiri[] {
  const pz = new Map<string, { paraId: number; paraKod: string; paraAd: string; alisMiktar: number; alisTutar: number; satisMiktar: number; satisTutar: number; sonOrt: number }>();
  for (const h of yurutulen) {
    if (String(h.gun) < bas) continue;
    if (!pz.has(h.paraKod)) pz.set(h.paraKod, { paraId: h.paraId, paraKod: h.paraKod, paraAd: h.paraAd, alisMiktar: 0, alisTutar: 0, satisMiktar: 0, satisTutar: 0, sonOrt: 0 });
    const o = pz.get(h.paraKod)!;
    if (h.tip === 0) { o.alisMiktar += h.miktar; o.alisTutar += h.tutar; } else { o.satisMiktar += h.miktar; o.satisTutar += h.tutar; }
    o.sonOrt = h.ortMaliyet || o.sonOrt;
  }
  return [...pz.values()].map(o => {
    const ortAlis = o.alisMiktar ? o.alisTutar / o.alisMiktar : null, brut = o.satisMiktar ? o.satisTutar - o.satisMiktar * (ortAlis ?? o.sonOrt) : 0;
    return { para: `${o.paraKod} — ${o.paraAd}`, paraId: o.paraId, paraKod: o.paraKod, alisMiktar: o.alisMiktar, ortAlis, ortSatis: o.satisMiktar ? o.satisTutar / o.satisMiktar : 0, satisMiktar: o.satisMiktar,
      satisTutar: o.satisTutar, brutKar: brut, karYuzde: o.satisTutar ? (brut / o.satisTutar) * 100 : 0 };
  });
}

/**
 * Eski raporun GENEL TOPLAM satırı: Σ satış tutarı, Σ brüt kâr, @ToplamYuzdeKar = Σ brüt kâr ÷ Σ satış tutarı × 100.
 * Eskide her zaman basılır (karar B16) → tek para olsa da döner; hiç para satırı yoksa null. Saf fonksiyon.
 */
export function karlilikGenelToplam(paraSatirlari: KarlilikParaSatiri[]): KarlilikParaSatiri | null {
  if (!paraSatirlari.length) return null;
  const st = paraSatirlari.reduce((a, o) => a + o.satisTutar, 0), bk = paraSatirlari.reduce((a, o) => a + o.brutKar, 0);
  return { para: "GENEL TOPLAM", paraId: null, paraKod: "", alisMiktar: null, ortAlis: null, ortSatis: null, satisMiktar: null, satisTutar: st, brutKar: bk, karYuzde: st ? (bk / st) * 100 : 0 };
}

/**
 * Rapor sonundaki "Toplam" tablosu: para satırları Döviz / Kuyum başlıkları altında (K11; yalnız başlık), sonda GENEL TOPLAM.
 * `paraSatirlari` verilmezse (para bazında kip: para satırları ana tablodadır) yalnız GENEL TOPLAM döner. Saf fonksiyon.
 */
export function karlilikToplamTablosu(paraSatirlari: KarlilikParaSatiri[], genel: KarlilikParaSatiri | null, grupla: (s: KarlilikParaSatiri) => ParaGrubu): Record<string, any>[] {
  return [...paraBasliklariEkle(paraSatirlari, { grupla, alan: "para" }), ...(genel ? [genel] : [])];
}

/* ------------------------------------------------------------------ Altın işçilik (ALTISC1) — saf hesaplar */

/**
 * İşçiliğin bölüneceği taban (sarraf fişi ekranındaki kural): Gram (0) → gram, gram yoksa adet; Adet (1) → adet, adet yoksa 1; Toplam (2) → 1. Bilinmeyen kod → 0. Saf fonksiyon.
 */
export function iscilikTabani(sekilKod: any, miktar: any, adet: any): number {
  const m = Number(miktar) || 0, a = Number(adet) || 0, k = Number(sekilKod) || 0;
  return k === 0 ? (m > 0 ? m : a > 0 ? a : 0) : k === 1 ? (a > 0 ? a : 1) : k === 2 ? 1 : 0;
}

/**
 * Sarraf fişi işçilik satırı: işçilik (TL) = satırın işçilik tutarı (ISCILIK_TUTARI, varsa ve doluysa), yoksa işçilik has gramı × fişteki altın has kuru.
 * İşçilik / birim fiyatı = işçilik (TL) ÷ taban (iscilikTabani); hesaplanamıyorsa boş. İşçilik (milyem) = birim işçilik has gramı × 1000
 * (has gram yoksa işçilik TL ÷ has kuru); o da yoksa satırda girilen ISCILIK_MIKTARI. KDV sarraf fişinde fiş düzeyinde tutulur: yalnız fişin
 * listelenen ilk satırında gösterilir (`ilkSatir`; toplamlar iki kez sayılmasın); KDV matrahı = KDV ÷ oran. Saf fonksiyon.
 */
export function sarrafIscilikSatiri(r: Record<string, any>, ilkSatir: boolean): Record<string, any> {
  const ihg = Number(r.iscilikHasGram) || 0, hk = Number(r.hasKuru) || 0, oran = Number(r.kdvOrani) || 0, kdv = ilkSatir ? Number(r.fisKdv) || 0 : 0;
  const kayitTl = Number(r.iscilikTutariKayit) || 0, tl = kayitTl > 0 ? kayitTl : ihg * hk, taban = iscilikTabani(r.sekilKod, r.miktar, r.adet);
  const birimHas = (ihg > 0 ? ihg : tl > 0 && hk > 0 ? tl / hk : 0) / (taban || 1);
  const { iscilikTutariKayit: _k, ...kalan } = r;
  return { ...kalan, bolum: 2, bolumAd: BOLUM_ADI[2], belge: "Sarraf fişi", cins: r.paraKod, kdvOrani: oran, kdv, kdvMatrahi: oran > 0 ? kdv / (oran / 100) : 0, tip: Number(r.tipKod) === 1 ? "Satış" : "Alış",
    adet: Number(r.adet), miktar: Number(r.miktar), milyem: Number(r.milyem), hasGram: Number(r.hasGram), sekil: ISCILIK_SEKLI[Number(r.sekilKod)] || "-",
    iscilikMiktari: taban > 0 && birimHas > 0 ? birimHas * 1000 : Number(r.iscilikMiktari) || 0, iscilikHasGram: ihg, hasKuru: hk, iscilikTutari: tl,
    iscilikBirimFiyati: tl > 0 && taban > 0 ? tl / taban : null, tutar: Number(r.tutar), paraBaslik: `${r.paraKod} — ${r.paraAd}` };
}

/**
 * Döviz fişi işçilik satırı — eski "İŞÇİLİK VE KDV RAPORU" (SODVZCR_ALTIN_ISCILIK_RAPORU; test veritabanında doğrulandı 01.10.2026):
 * İşçilik / birim fiyatı = satırın ISCILIK alanı, KDV = satırın KDV'si, KDV matrahı = işçilik × miktar − KDV, Tutar = satır tutarı. Saf fonksiyon.
 */
export function dovizIscilikSatiri(r: Record<string, any>): Record<string, any> {
  const miktar = Number(r.miktar) || 0, isc = Number(r.iscilik) || 0, kdv = Number(r.kdv) || 0;
  return { ...r, bolum: 1, bolumAd: BOLUM_ADI[1], belge: "Döviz fişi", cins: r.paraAd || r.paraKod, tip: Number(r.tipKod) === 1 ? "Satış" : "Alış", adet: null, miktar, milyem: null, hasGram: null, sekil: "",
    iscilikMiktari: null, iscilikHasGram: null, hasKuru: null, iscilikBirimFiyati: isc, iscilikTutari: isc * miktar, kdvOrani: Number(r.kdvOrani) || 0, kdv, kdvMatrahi: isc * miktar - kdv, tutar: Number(r.tutar) || 0,
    paraBaslik: `${r.paraKod} — ${r.paraAd}` };
}

/**
 * Altın işçilik satırlarının düzeni: sektör bölümü (Döviz fişi → Sarraf fişi; B22) → para grubu (Döviz → Kuyum; K11) → para (sıra no, kod) → tarih;
 * eşitlikte gelen sıra korunur. Satıra `paraGrupAd` yazılır (tanımdaki dış grup: yalnız başlık, toplamsız). Rakamlara dokunmaz. Saf fonksiyon.
 */
export function altinIscilikDuzenle<T extends Record<string, any>>(satirlar: T[], grupla: (s: T) => ParaGrubu): (T & { paraGrupAd: string })[] {
  return satirlar.map((s, n) => ({ s, n, g: grupla(s) }))
    .sort((x, y) => Number(x.s.bolum) - Number(y.s.bolum) || PARA_GRUP_SIRASI[x.g] - PARA_GRUP_SIRASI[y.g] || Number(x.s.siraNo) - Number(y.s.siraNo)
      || String(x.s.paraKod).localeCompare(String(y.s.paraKod)) || new Date(x.s.tarih).getTime() - new Date(y.s.tarih).getTime() || x.n - y.n)
    .map(x => ({ ...x.s, paraGrupAd: PARA_GRUP_ADI[x.g] }));
}

/* ------------------------------------------------------------------ Personel değerlendirme (PERDEG1) — saf hesaplar */

export interface PersonelFisi { bolum: number; fisId: number; kullaniciId: number; personel: string; tip: number; iptal: any; tutar: number; gun: string; komisyon: number; sapma: number }
/**
 * Fişlerden bölüm × personel toplamları. Hareket = FARKLI fiş (FIS_ID): aynı fiş birden çok kez gelse de (çok satırlı sarraf / perakende fişi)
 * bir hareket sayılır, tutarı / komisyonu / sapması bir kez eklenir. Alış / satış adedi iptal edilmemiş fiş sayısı; iptal fiş yalnız "İptal"de sayılır.
 * Gün = iptal edilmemiş fiş kesilen farklı iş günü. Sıra: kayıtların ilk göründüğü sıra. Saf fonksiyon.
 */
export function personelOzetle(fisler: PersonelFisi[]): Record<string, any>[] {
  const m = new Map<string, { bolum: number; kullaniciId: number; personel: string; alisAdet: number; alisTutar: number; satisAdet: number; satisTutar: number; iptalAdet: number;
    komisyon: number; sapmaAdet: number; fisler: Set<number>; gunler: Set<string> }>();
  for (const f of fisler) {
    const a = `${Number(f.bolum) || 1}|${Number(f.kullaniciId) || 0}`;
    let o = m.get(a);
    if (!o) m.set(a, o = { bolum: Number(f.bolum) || 1, kullaniciId: Number(f.kullaniciId) || 0, personel: f.personel, alisAdet: 0, alisTutar: 0, satisAdet: 0, satisTutar: 0, iptalAdet: 0,
      komisyon: 0, sapmaAdet: 0, fisler: new Set(), gunler: new Set() });
    if (o.fisler.has(Number(f.fisId))) continue;
    o.fisler.add(Number(f.fisId));
    if (Number(f.iptal)) { o.iptalAdet++; continue; }
    if (Number(f.tip) === 0) { o.alisAdet++; o.alisTutar += Number(f.tutar) || 0; } else { o.satisAdet++; o.satisTutar += Number(f.tutar) || 0; }
    o.komisyon += Number(f.komisyon) || 0; o.sapmaAdet += Number(f.sapma) || 0; o.gunler.add(String(f.gun));
  }
  return [...m.values()].map(({ fisler: _f, gunler, ...o }) => ({ ...o, gunSayisi: gunler.size }));
}

/**
 * Personel satırı (bölüm × kullanıcı): ciro = alış + satış TL toplamı, hareket = alış + satış fiş adedi.
 * Eski "PERSONEL DEĞERLENDİRME": @Ciro/Gun ve @Hareket/Gun (gün sayısı 0 ise 0). Saf fonksiyon.
 */
export function personelSatiri(r: Record<string, any>): Record<string, any> {
  const a = Number(r.alisAdet) || 0, s = Number(r.satisAdet) || 0, hacim = (Number(r.alisTutar) || 0) + (Number(r.satisTutar) || 0), gun = Number(r.gunSayisi) || 0, bolum = Number(r.bolum) || 1;
  return { ...r, bolum, bolumAd: BOLUM_ADI[bolum] || "", personel: r.personel || `Kullanıcı ${r.kullaniciId || "?"}`, alisAdet: a, alisTutar: Number(r.alisTutar) || 0, satisAdet: s, satisTutar: Number(r.satisTutar) || 0,
    toplamAdet: a + s, toplamTutar: hacim, ortIslem: a + s ? hacim / (a + s) : 0, komisyon: Number(r.komisyon) || 0, iptalAdet: Number(r.iptalAdet) || 0, sapmaAdet: Number(r.sapmaAdet) || 0, gunSayisi: gun,
    ciroGun: gun ? hacim / gun : 0, hareketGun: gun ? (a + s) / gun : 0 };
}

/**
 * Eski rapordaki sıralama, sektör bölümünün içinde: ciro ya da hareket sayısına göre azalan; "ad" seçilirse gelen sıra (sorgu personel adına göre dizer).
 * Bölümler 1 → 4 sırasında kalır; eşitlikte gelen sıra korunur. Saf fonksiyon.
 */
export function personelSirala<T extends Record<string, any>>(satirlar: T[], siralama?: string): T[] {
  return satirlar.map((s, n) => ({ s, n }))
    .sort((x, y) => Number(x.s.bolum) - Number(y.s.bolum)
      || (siralama === "ad" ? 0 : siralama === "hareket" ? Number(y.s.toplamAdet) - Number(x.s.toplamAdet) : Number(y.s.toplamTutar) - Number(x.s.toplamTutar)) || x.n - y.n)
    .map(x => x.s);
}

export const ANALIZ_SORGULARI: Record<string, Sorgu> = {

  /**
   * Kârlılık raporu — her satış satırının ağırlıklı ortalama maliyete göre kârı (KARZAR1'in işlem bazlı hâli).
   * Kaynak yalnız döviz fişi: sektör bölümü bu raporda yapılmadı (karar K2 / B22 "sonra").
   */
  async KARLIL1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const req = pool.request().input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
    // Maliyet kayıtların başından yürütülür (dönem öncesi alışlar stoku oluşturur); yalnız dönemdeki satışlar listelenir
    const res = await req.query(`
      SELECT F.FIS_ID fisId, F.TARIH zaman, ISNULL(F.ZAMAN,F.TARIH) saatZaman, F.ZAMAN saat, F.TARIH tarih, CONVERT(char(10), CAST(F.TARIH AS date), 23) gun, F.TIP tip, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan,
        RTRIM(ISNULL(V.KOD,'')) vezneKod, S.PARA_ID paraId, RTRIM(P.KOD) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0)+ISNULL(S.KMV,0)+ISNULL(S.KDV,0) vergiler
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date)<=@bit AND RTRIM(UPPER(P.KOD)) NOT IN ('TL','TRY') ${f}
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, F.TARIH, F.FIS_ID, S.SATIR_NO;`);
    const bas = String(p.baslangic).slice(0, 10);
    const yurutulen = maliyetYurut(res.recordset.map((r: any) => ({ ...r, paraId: Number(r.paraId), tip: Number(r.tip), miktar: Number(r.miktar), tutar: Number(r.tutar), kur: Number(r.kur) })));
    const satirlar = yurutulen.filter(h => h.tip === 1 && String((h as any).gun) >= bas).map((h: any) => {
      const brut = h.tutar - h.maliyet, net = brut + (Number(h.komisyon) || 0) - (Number(h.vergiler) || 0);
      return { ...h, satisKuru: h.kur, maliyetKuru: h.ortMaliyet, satisTutari: h.tutar, maliyetTutari: h.maliyet, brutKar: brut, komisyon: Number(h.komisyon) || 0, vergiler: Number(h.vergiler) || 0,
        netKar: net, karYuzde: h.tutar ? (brut / h.tutar) * 100 : 0, paraBaslik: `${h.paraKod} — ${h.paraAd}` }; });
    if (p.siralama === "kar") { // para grupları korunur, grup içinde net kâra göre büyükten küçüğe
      const sira = new Map<string, number>(); satirlar.forEach(s => { if (!sira.has(s.paraBaslik)) sira.set(s.paraBaslik, sira.size); });
      satirlar.sort((a, b) => sira.get(a.paraBaslik)! - sira.get(b.paraBaslik)! || b.netKar - a.netKar);
    }
    const paraSatirlari = karlilikParaOzeti(yurutulen as any[], bas);
    const genel = karlilikGenelToplam(paraSatirlari);
    // Para ayrımı (K11): paralar Döviz / Kuyum başlıkları altında — ana tabloda bölüm (`paraGrupAd`; yalnız başlık), "Toplam" tablosunda başlık satırı
    const pg = await paraGrupBilgisi(pool);
    const grupla = (s: { paraId?: any; paraKod?: any }) => pg.grup({ paraId: s.paraId, paraKod: s.paraKod });
    const ozet = `${aralikOzeti(p)}${ozetEk(p) || " · Tüm dövizler"}`;
    // Varsayılan düzen para başına tek satır + genel toplam (kâr % = Σ brüt kâr ÷ Σ satış tutarı); "detay" seçilirse işlem bazlı satırlar, para tablosu rapor sonunda
    if (p.birlestir !== "detay") return sinirla(paraGrubunaGoreSirala(paraSatirlari, grupla), t, ozet, undefined, karlilikToplamTablosu([], genel, grupla));
    return sinirla(paraGrubunaGoreSirala(satirlar, grupla), t, ozet,
      "Satırlardaki maliyet kayıtların başından yürütülen ağırlıklı ortalama maliyettir; kâr % = brüt kâr ÷ satış tutarı. Rapor sonundaki para bazındaki tabloda brüt kâr = satış tutarı − satış miktarı × dönemin ortalama alış kuru (dönemde alış yoksa yürüyen ortalama maliyet); bu yüzden iki brüt kâr farklı olabilir.",
      karlilikToplamTablosu(paraSatirlari, genel, grupla));
  },

  /**
   * Altın işçilik raporu — sarraf fişi satırlarındaki işçilik (has gram × fişteki altın has kuru) ve eski "İşçilik ve KDV Raporu"ndaki döviz fişi işçilik satırları.
   * Sektör bölümleri (B22 / K10): Döviz fişi ve Sarraf fişi, firmanın lisansında açık olanlar. Perakende fişi işçiliği (B25 a) eklenmedi: TODVZ_FATURA_SATIRI'nda
   * işçilik alanı yok; faturanın işçilik hesabına yazılan kasa kaydı ("Perakende Fişi İşçilik - Fatura No: …") işçiliği değil faturanın ara toplamının tamamını taşır.
   * Sarraf fişinde iptal alanı yoktur (silinen fiş tamamen gider) → iptal süzgeci yalnız döviz fişinde.
   */
  async ALTISC1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const ozet = `${aralikOzeti(p)}${p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : ""}${ozetEk(p) || " · Tüm vezneler"}`;
    const var_ = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_SARRAF_FISI','U') IS NULL OR OBJECT_ID('dbo.TODVZ_SARRAF_FISI_SATIRI','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
    const bolumler = acikBolumler(p.acikModuller, { sarraf: !!var_, perakende: false, ticariSatir: false });
    // ISCILIK_TUTARI uygulamaya özgü; her veritabanında yok
    const itVar = !!var_ && !!(await pool.request().query(`SELECT CASE WHEN COL_LENGTH('dbo.TODVZ_SARRAF_FISI_SATIRI','ISCILIK_TUTARI') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
    const f = filtreler(req, p, { vezne: "V", para: "S.URUN_ID" });
    const res = !bolumler.has(2) ? { recordset: [] as any[] } : await req.query(`
      SELECT F.SARRAF_FISI_ID fisId, ISNULL(P.SIRA_NO,99) siraNo, F.TARIH tarih, '' seriNo, RTRIM(ISNULL(F.FIS_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan, F.TIP tipKod, RTRIM(ISNULL(V.KOD,'')) vezneKod,
        ISNULL(F.ALTIN_HAS_KURU,0) hasKuru, ISNULL(F.KDV_ORANI,0) kdvOrani, ISNULL(F.KDV,0) fisKdv, S.URUN_ID paraId, RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(S.ADET,0) adet, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.MILYEM,0) milyem,
        ISNULL(S.HAS_GRAM,0) hasGram, ISNULL(S.ISCILIK_HESAPLAMA_SEKLI,0) sekilKod, ISNULL(S.ISCILIK_MIKTARI,0) iscilikMiktari, ISNULL(S.ISCILIK_HAS_GRAM,0) iscilikHasGram, ${itVar ? "ISNULL(S.ISCILIK_TUTARI,0)" : "0"} iscilikTutariKayit, ISNULL(S.TUTAR,0) tutar
      FROM dbo.TODVZ_SARRAF_FISI F JOIN dbo.TODVZ_SARRAF_FISI_SATIRI S ON S.SARRAF_FISI_ID=F.SARRAF_FISI_ID
        LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.URUN_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) AND (ISNULL(S.ISCILIK_HAS_GRAM,0)<>0 OR ISNULL(S.ISCILIK_MIKTARI,0)<>0${itVar ? " OR ISNULL(S.ISCILIK_TUTARI,0)<>0" : ""}) ${f}
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, F.TARIH, F.SARRAF_FISI_ID, S.SATIR_NO;`);
    // KDV sarraf fişinde fiş düzeyinde tutulur: fişin listelenen ilk satırında gösterilir (toplamlar iki kez sayılmasın)
    const kdvGorulen = new Set<number>();
    const satirlar: Record<string, any>[] = res.recordset.map((r: any) => { const ilk = !kdvGorulen.has(Number(r.fisId)); kdvGorulen.add(Number(r.fisId)); return sarrafIscilikSatiri(r, ilk); });
    // Eski "İŞÇİLİK VE KDV RAPORU" döviz fişi satırlarındaki işçiliği listeler; seri no ve belge no eskideki gibi ayrı kolonlardadır
    const dreq = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);
    const df = filtreler(dreq, p, { vezne: "V", para: "S.PARA_ID" });
    const dres = !bolumler.has(1) ? { recordset: [] as any[] } : await dreq.query(`
      SELECT F.FIS_ID fisId, F.TARIH tarih, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan, F.TIP tipKod,
        RTRIM(ISNULL(V.KOD,'')) vezneKod, S.PARA_ID paraId, RTRIM(ISNULL(P.KOD,'')) paraKod, RTRIM(ISNULL(P.AD,'')) paraAd, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.ISCILIK,0) iscilik,
        ISNULL(S.KDV_ORANI,0) kdvOrani, ISNULL(S.KDV,0) kdv, ISNULL(S.TUTAR,0) tutar
      FROM dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
      WHERE ISNULL(F.IPTAL,0)=0 AND ISNULL(S.ISCILIK,0)<>0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${df}
      ORDER BY ISNULL(P.SIRA_NO,99), P.KOD, F.TARIH, F.FIS_ID, S.SATIR_NO;`);
    for (const r of dres.recordset) satirlar.push(dovizIscilikSatiri(r));
    // Para ayrımı (K11): bölüm sektöre ayrıldığı için para grubu (Döviz / Kuyum) tanımdaki dış grup seviyesidir — yalnız başlık, toplam satırı yok
    const pg = satirlar.length ? await paraGrupBilgisi(pool) : null;
    const sonuc = sinirla(altinIscilikDuzenle(satirlar, s => pg!.grup({ paraId: s.paraId, paraKod: s.paraKod })), t, ozet,
      "Seçilen aralıkta işçilikli sarraf fişi ya da döviz fişi satırı yok.");
    // İşçilik / birim fiyatı hiçbir satırda hesaplanamıyorsa kolon gösterilmez
    return satirlar.length && !satirlar.some(s => s.iscilikBirimFiyati != null) ? { ...sonuc, kolonCikar: ["iscilikBirimFiyati"] } : sonuc;
  },

  /**
   * Personel değerlendirme — fişi kaydeden kullanıcı (F.EKLEYEN_ID) bazında işlem adedi, hacim, komisyon, iptal ve kur sapması.
   * Sektör bölümleri (B22 / K10): birleşik fiş kaynağı (döviz / sarraf / perakende / ticari fiş; lisansta açık olanlar); satır = bölüm × personel.
   * Komisyon ve kur sapması yalnız döviz fişi satırında vardır (diğer bölümlerde 0) → döviz fişi satır tablosundan okunur (döviz bölümünde FIS_ID kaymasızdır).
   */
  async PERDEG1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const k = await fisKaynagi(pool, p);
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis);
    const f = filtreler(req, p, { vezne: "V" }) + idFiltre(req, p.kullaniciIdler, "F.EKLEYEN_ID", "ku");
    const res = await req.query(`
      SELECT F.BOLUM bolum, F.FIS_ID fisId, ISNULL(F.EKLEYEN_ID,0) kullaniciId, RTRIM(ISNULL(U.AD,'')) personel, CAST(F.TIP AS int) tip, CAST(ISNULL(F.IPTAL,0) AS int) iptal,
        ISNULL(F.TOPLAM_TUTAR,0) tutar, CONVERT(char(10), CAST(F.TARIH AS date), 23) gun, ISNULL(X.komisyon,0) komisyon, ISNULL(X.sapmaliSatir,0) sapma
      FROM ${k.F} LEFT JOIN dbo.TODVZ_KULLANICI U ON U.KULLANICI_ID=F.EKLEYEN_ID LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID
        OUTER APPLY (SELECT SUM(S.KOMISYON) komisyon, SUM(CASE WHEN ISNULL(S.GISE_KURU,0)>0 AND ABS(S.KUR-S.GISE_KURU)>0.0000001 THEN 1 ELSE 0 END) sapmaliSatir
          FROM dbo.TODVZ_FIS_SATIRI S WHERE F.BOLUM=1 AND S.FIS_ID=F.FIS_ID) X
      WHERE CAST(F.TARIH AS date) BETWEEN @bas AND @bit ${f}
      ORDER BY F.BOLUM, U.AD, F.EKLEYEN_ID, F.FIS_ID;`);
    // Hareket = farklı fiş (FIS_ID); toplama personelOzetle ile — aynı fiş birden çok kez gelse de bir kez sayılır
    return sinirla(personelSirala(personelOzetle(res.recordset as PersonelFisi[]).map(r => personelSatiri(r)), p.siralama), t, `${aralikOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.kullaniciIdler, "personel")}`,
      "Personel = fişi kaydeden kullanıcı. Tutarlar fişlerin TL toplam tutarıdır; iptal fişler adet ve tutarlara girmez, yalnızca \"İptal\" kolonunda sayılır. Kur sapması = kuru kayıt anındaki gişe kurundan farklı girilmiş fiş satırı sayısı. Çalışılan gün = fiş kesilen farklı gün sayısı.");
  },
};

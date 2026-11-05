import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporGrup, RaporNet, RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, tarihTr, HAREKET_TIPI, KISILIK, kurCoz, sinirla, aralikOzeti, filtreler, ozetEk, ek, ekSayi } from "../raporOrtak.js";
import { CARI_EVRAK, CARI_HAREKET_KOLONLARI, belgeTablolari, cariHareketleriSql } from "../kaynak.js";
import { type ParaGrubu, paraBasliklariEkle, paraGrubunaGoreSirala, paraGrupBilgisi } from "../paraGrup.js";

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

/**
 * Cari raporları: CARBAK1, CAREKS1, CARHAR1, CARKRT1 — eski Crystal raporlarıyla eşitlendi (05.11.2026, docs/RAPOR_ESITLEME_UYGULAMA.md).
 * Saf mantık (süzgeç, gruplama seçimi, yürüyen bakiye) dışa açık fonksiyonlardadır; scripts/rapor-test-cari.ts bunları veritabanısız sınar. Yalnızca SELECT.
 */

/**
 * Cari satırının hareket tipi adı: cari hareketlerde HAREKET_TIPI, belgelerden gelenlerde belge türü
 * (1 virman dekontu, 2 döviz fişi, 3 sarraf fişi, 4 perakende fişi, 5 ticari fiş — kaynak.ts CARI_EVRAK)
 */
export const hareketAdi = (r: { evrakTipi?: any; hareketTipi?: any }) => (Number(r.evrakTipi) ? CARI_EVRAK[Number(r.evrakTipi)] : HAREKET_TIPI[Number(r.hareketTipi)]) || "Diğer";

/** Eski listedeki hareket tipi harfi (@HareketTipi): 0 N(akit), 1 F(atura), 2 Ç(ek), 3 S(enet), diğer A(çık). Belgelerden gelen satırlar eski görünümdeki gibi 0 sayılır. */
export const hareketHarfi = (hareketTipiKod: any): string => (["N", "F", "Ç", "S"] as const)[Number(hareketTipiKod) || 0] ?? "A";

/** Parametre değeri: ek parametre → düz alan (sabit şemadaki `siralama` gibi); yoksa "" */
export const prm = (p: RaporParametreler, ad: string): string => ek(p, ad) || String((p as any)[ad] ?? "").trim();
/** Seçim parametresi: geçerli değerlerden biri değilse ilki (varsayılan) */
export const secim = <T extends string>(p: RaporParametreler, ad: string, gecerli: readonly T[]): T => { const v = prm(p, ad) as T; return gecerli.includes(v) ? v : gecerli[0]; };
/** Onay kutusu ("1" / "true" / "evet") */
export const onay = (p: RaporParametreler, ad: string): boolean => ["1", "true", "evet"].includes(prm(p, ad).toLowerCase());
/** Sayısal ek parametre (yoksa undefined) */
const sayi = (p: RaporParametreler, ad: string): number | undefined => ekSayi(p, ad) ?? ekSayi({ ek: { [ad]: String((p as any)[ad] ?? "") } }, ad);

/** Hesap tipi (eski pCB_HesapTipi): Hepsi / Borç / Alacak */
export type HesapTipi = "hepsi" | "borc" | "alacak";
export const HESAP_TIPLERI = ["hepsi", "borc", "alacak"] as const;
export const hesapTipiOku = (p: RaporParametreler): HesapTipi => secim(p, "hesapTipi", HESAP_TIPLERI);
/** Satır tipi kodu (0 borç / 1 alacak) — Hepsi'de null (süzme yok) */
export const hesapTipiKodu = (h: HesapTipi): number | null => (h === "borc" ? 0 : h === "alacak" ? 1 : null);
export const hesapTipiOzeti = (h: HesapTipi) => (h === "borc" ? " · Hesap tipi: Borç" : h === "alacak" ? " · Hesap tipi: Alacak" : "");

interface GirdiAlan { input(ad: string, ...kalan: any[]): any }
/**
 * İlk – son metin aralığı (eski "İlk ad / Son ad", "İlk / Son POS kodu"): `<ad>Ilk` ≤ kolon ≤ `<ad>Son` (uçlar dahil, veritabanı sıralamasıyla).
 * Parametreler isteğe eklenir; SQL parçası döner (boşsa ""). Aynı istekte bir ad için bir kez çağrılır, parça birden fazla yerde kullanılabilir.
 */
export function metinAraligi(req: GirdiAlan, p: RaporParametreler, kolon: string, ad: string): string {
  const ilk = prm(p, `${ad}Ilk`), son = prm(p, `${ad}Son`);
  let s = "";
  if (ilk) { req.input(`${ad}Ilk`, sql.NVarChar(100), ilk); s += ` AND RTRIM(ISNULL(${kolon},''))>=@${ad}Ilk`; }
  if (son) { req.input(`${ad}Son`, sql.NVarChar(100), son); s += ` AND RTRIM(ISNULL(${kolon},''))<=@${ad}Son`; }
  return s;
}
/** Filtre özetine " · Ad A → M" parçası */
export const metinAraligiOzeti = (p: RaporParametreler, ad: string, etiket: string) => {
  const ilk = prm(p, `${ad}Ilk`), son = prm(p, `${ad}Son`);
  return ilk || son ? ` · ${etiket} ${ilk || "…"} → ${son || "…"}` : "";
};

const NET_BAKIYE: RaporNet = { arti: "borc", eksi: "alacak" };

// ───────────────────────── CARBAK1 ─────────────────────────

/**
 * Cari bakiye satırı listelenir mi (eski kayıt seçimi): sıfır bakiye hiçbir zaman; Borç → borç bakiyeliler, Alacak → alacak bakiyeliler;
 * alt / üst limit |bakiye| aralığıdır (uçlar dahil; verilmeyen uç sınırsız).
 */
export function bakiyeSuzgeci(s: { borcBakiye: number; alacakBakiye: number }, o: { hesapTipi: HesapTipi; alt?: number; ust?: number }): boolean {
  const mutlak = Math.max(Number(s.borcBakiye) || 0, Number(s.alacakBakiye) || 0);
  if (mutlak <= 1e-9) return false;
  if (o.hesapTipi === "borc" && !(s.borcBakiye > 0)) return false;
  if (o.hesapTipi === "alacak" && !(s.alacakBakiye > 0)) return false;
  if (o.alt !== undefined && mutlak < o.alt) return false;
  if (o.ust !== undefined && mutlak > o.ust) return false;
  return true;
}

/**
 * Cari bakiye düzeni (eski "Liste şekli" × "Sıralama"): Kart bazında → grup cari, satırlar para; Para bazında → grup para (altında "Toplam" ve net
 * "Bakiye" satırı), satırlar cari. Sıralama (Kod / Ad) carileri dizer. `sira` yalnız sabit SQL parçalarıdır.
 */
export function cariBakiyeDuzeni(listeSekli: string, siralama: string): { para: boolean; ad: boolean; sira: string; gruplar: RaporGrup[] } {
  const para = listeSekli === "para", ad = siralama === "ad";
  const cari = ad ? "C.AD, C.KOD" : "C.KOD", paraSira = "ISNULL(P.SIRA_NO,99), P.KOD";
  return para
    ? { para, ad, sira: `${paraSira}, ${cari}`,
      gruplar: [{ anahtar: "paraKod", baslik: "Para birimi: {{paraKod}}", altToplam: true, toplamEtiketi: "Toplam", net: { arti: "borcBakiye", eksi: "alacakBakiye" }, genelToplam: false }] }
    : { para, ad, sira: `${cari}, ${paraSira}`, gruplar: [{ anahtar: "cariKod", baslik: "{{cariBaslik}}", altToplam: false }] };
}

/** Para bazında "Toplam" (borç / alacak bakiye toplamları) ve net "Bakiye" + B/A — eski rapordaki grup altlıklarının karşılığı (özet tablosu) */
export function paraBakiyeToplamlari(satirlar: { paraId?: any; paraKod: string; borcBakiye: number; alacakBakiye: number }[]) {
  const pt = new Map<string, { paraId: any; paraKod: string; borcBakiye: number; alacakBakiye: number }>();
  for (const x of satirlar) {
    if (!pt.has(x.paraKod)) pt.set(x.paraKod, { paraId: x.paraId, paraKod: x.paraKod, borcBakiye: 0, alacakBakiye: 0 });
    const o = pt.get(x.paraKod)!; o.borcBakiye += x.borcBakiye; o.alacakBakiye += x.alacakBakiye;
  }
  return [...pt.values()].map(o => { const n = o.borcBakiye - o.alacakBakiye; return { ...o, netBakiye: Math.abs(n), bakiyeTipi: n > 0 ? "B" : n < 0 ? "A" : "" }; });
}

// ───────────────────────── CAREKS1 ─────────────────────────

const EMANET_ADI: Record<number, string> = { 0: "Emanet alma (bilgi)", 1: "Emanet verme (bilgi)" };
const zaman = (v: any) => { const t = v ? new Date(v).getTime() : 0; return Number.isNaN(t) ? 0 : t; };

/**
 * Cari ekstre gövdesi (saf): cari × para grupları, devir + yürüyen bakiye, "para toplamı" (cari altı tablo ve rapor sonu özet).
 *  - `devirler`: grup başına dönem öncesi borç / alacak toplamı (Devir = Değil). Devir = Dahil'de boş gelir; dönem öncesi kayıtlar `hareketler`in içindedir
 *    ve satır satır listelenir (`devirSatiri: false` → toplu devir satırı basılmaz).
 *  - `bilgiler`: emanet alma / verme dekont satırları — bakiyeyi ve toplamları etkilemez; tutar `emanet` kolonunda, borç / alacak boş (B25c).
 *  - Sıralama: cari koduna ya da adına göre; cari içinde para sırası.
 */
export function ekstreKur(devirler: any[], hareketler: any[], bilgiler: any[], o: { baslangic?: string; bitis?: string; adaGore?: boolean; devirSatiri?: boolean }) {
  type Grup = { cariKod: string; cariAd: string; cariAdres: string; cariTelefon: string; cariVergiNo: string; paraId: any; paraKod: string; siraNo: number; hasOrani: number;
    devir: number; gercek: boolean; hareketler: any[] };
  const gruplar = new Map<string, Grup>();
  const ekle = (r: any) => {
    const k = `${r.cariKod}|${r.paraKod}`;
    if (!gruplar.has(k)) gruplar.set(k, { cariKod: r.cariKod, cariAd: r.cariAd, cariAdres: r.cariAdres || "", cariTelefon: r.cariTelefon || "", cariVergiNo: r.cariVergiNo || "",
      paraId: r.paraId, paraKod: r.paraKod, siraNo: Number(r.siraNo), hasOrani: Number(r.hasOrani) || 0, devir: 0, gercek: false, hareketler: [] });
    return gruplar.get(k)!;
  };
  for (const d of devirler) { const g = ekle(d); g.devir = Number(d.alacak) - Number(d.borc); g.gercek = true; }
  for (const h of hareketler) { const g = ekle(h); g.hareketler.push(h); g.gercek = true; }
  // Bilgi satırları grubun hareketleri arasına tarih (sonra kayıt zamanı) sırasıyla girer; gerçek hareketlerin kendi sırası değişmez, aynı anda gerçek hareket önce gelir
  const bilgiGruplari = new Map<Grup, any[]>();
  for (const b of bilgiler) { const g = ekle(b); bilgiGruplari.set(g, [...(bilgiGruplari.get(g) || []), { ...b, bilgi: true }]); }
  const sonra = (h: any, b: any) => zaman(h.tarih) > zaman(b.tarih) || (zaman(h.tarih) === zaman(b.tarih) && zaman(h.eklemeZamani) > zaman(b.eklemeZamani));
  for (const [g, bilgi] of bilgiGruplari) {
    const birlesik: any[] = []; let i = 0;
    for (const b of bilgi) { while (i < g.hareketler.length && !sonra(g.hareketler[i], b)) birlesik.push(g.hareketler[i++]); birlesik.push(b); }
    g.hareketler = [...birlesik, ...g.hareketler.slice(i)];
  }

  const satirlar: Record<string, any>[] = [], paraToplamlari: Record<string, any>[] = [], grupAltSatirlar: Record<string, Record<string, any>[]> = {};
  const genel = new Map<string, { paraId: any; borc: number; alacak: number }>();
  const bakiyeOzeti = (b: number) => ({ bakiye: Math.abs(b), yon: b > 0 ? "A" : b < 0 ? "B" : "" });
  const sirali = [...gruplar.values()].sort((x, y) => (o.adaGore ? x.cariAd.localeCompare(y.cariAd, "tr") : 0) || x.cariKod.localeCompare(y.cariKod) || x.siraNo - y.siraNo || x.paraKod.localeCompare(y.paraKod));
  let gercekGrup = 0;
  for (const g of sirali) {
    let bakiye = g.devir;
    const altBaslik = [g.cariAdres, g.cariTelefon ? `Tel: ${g.cariTelefon}` : "", g.cariVergiNo ? `${g.cariVergiNo.length === 11 ? "TCKN" : "VKN"}: ${g.cariVergiNo}` : ""].filter(Boolean).join(" · ");
    const cariBaslik = o.adaGore ? `${g.cariAd} — ${g.cariKod}` : `${g.cariKod} — ${g.cariAd}`;
    const ortak = { cariAnahtar: g.cariKod, cariBaslik, grupAnahtar: `${g.cariKod}|${g.paraKod}`, grupBaslik: `${g.cariKod} — ${g.cariAd} · ${g.paraKod}`, grupAltBaslik: altBaslik,
      cariKod: g.cariKod, cariAd: g.cariAd, cariAdres: g.cariAdres, cariTelefon: g.cariTelefon, cariVergiNo: g.cariVergiNo, paraKod: g.paraKod, hasOrani: g.hasOrani };
    // Dönem grubu (eski @Donem; yalnız Devir = Dahil'de gruplanır): 0 = dönem öncesi ("Devir" toplamı), 1 = dönem içi
    const donem = (onceki: boolean) => (onceki
      ? { donem: "0", donemBaslik: `${tarihTr(o.baslangic)} öncesi`, donemToplam: "Devir" }
      : { donem: "1", donemBaslik: o.bitis ? `${tarihTr(o.baslangic)} – ${tarihTr(o.bitis)}` : `${tarihTr(o.baslangic)} sonrası`, donemToplam: "Dönem toplamı" });
    const satir = (ekAlan: Record<string, any>) => ({ ...ortak, ...donem(false), ...ekAlan, bakiye: Math.abs(bakiye), yon: bakiye > 0 ? "A" : bakiye < 0 ? "B" : "", hasKarsiligi: Math.abs(bakiye) * g.hasOrani });
    let tBorc = bakiye < 0 ? -bakiye : 0, tAlacak = bakiye > 0 ? bakiye : 0;
    if (o.devirSatiri !== false) satirlar.push(satir({ fisNo: "", tarih: o.baslangic, saat: "", hareketTipi: "Devir", hareketHarf: "", aciklama: `${tarihTr(o.baslangic)} öncesi devir`, vezneKod: "",
      borc: bakiye < 0 ? -bakiye : 0, alacak: bakiye > 0 ? bakiye : 0 }));
    for (const h of g.hareketler) {
      const meblag = Number(h.meblag) || 0;
      if (h.bilgi) {
        satirlar.push(satir({ fisNo: String(h.fisNo ?? ""), tarih: h.tarih, saat: h.saat || "", hareketTipi: EMANET_ADI[Number(h.dekontTip)] || "Emanet (bilgi)", hareketHarf: "", aciklama: h.aciklama, vezneKod: h.vezneKod,
          borc: null, alacak: null, emanet: meblag, bilgiSatiri: true }));
        continue;
      }
      bakiye += Number(h.tip) === 1 ? meblag : -meblag;
      if (Number(h.tip) === 0) tBorc += meblag; else tAlacak += meblag;
      satirlar.push(satir({ fisNo: String(h.fisNo ?? ""), tarih: h.tarih, saat: h.saat || "", hareketTipi: hareketAdi(h), hareketHarf: hareketHarfi(h.hareketTipi), ...donem(!!Number(h.onceki)), aciklama: h.aciklama, vezneKod: h.vezneKod,
        borc: Number(h.tip) === 0 ? meblag : 0, alacak: Number(h.tip) === 1 ? meblag : 0 }));
    }
    // Yalnız bilgi satırı taşıyan grubun toplamı yoktur: özet ve para toplamı tablolarına girmez
    if (!g.gercek) continue;
    gercekGrup++;
    // Eski "Para toplamı" alt raporunun karşılığı: cari × para toplamı + kapanış bakiyesi + B/A (devir dahil) — cari grubunun altında ve rapor sonu özetinde
    const toplam = { paraId: g.paraId, paraKod: g.paraKod, borc: tBorc, alacak: tAlacak, ...bakiyeOzeti(bakiye) };
    paraToplamlari.push({ cari: cariBaslik, ...toplam });
    (grupAltSatirlar[g.cariKod] ||= []).push(toplam);
    const gp = genel.get(g.paraKod) || { paraId: g.paraId, borc: 0, alacak: 0 }; gp.borc += tBorc; gp.alacak += tAlacak; genel.set(g.paraKod, gp);
  }
  // GENEL TOPLAM + genel bakiye + B/A — para birimleri karışmasın diye para başına bir satır
  if (gercekGrup > 1) for (const [paraKod, gp] of genel) paraToplamlari.push({ cari: "GENEL TOPLAM", paraId: gp.paraId, paraKod, borc: gp.borc, alacak: gp.alacak, ...bakiyeOzeti(gp.alacak - gp.borc) });
  return { satirlar, paraToplamlari, grupAltSatirlar, bilgiVar: satirlar.some(s => s.bilgiSatiri) };
}

/** CAREKS1 Devir = Dahil: para grubunun içinde üçüncü seviye dönem grubu (eski @Donem): "… öncesi" altında "Devir" toplamı, sonra dönem içi */
export const EKSTRE_DONEM_GRUBU: RaporGrup = { anahtar: "donem", baslik: "{{donemBaslik}}", altToplam: true, toplamEtiketi: "{{donemToplam}}" };
export function ekstreGruplari(tanimGruplari: RaporGrup[] | undefined, dahil: boolean): RaporGrup[] | undefined {
  return dahil ? [...(tanimGruplari || []), EKSTRE_DONEM_GRUBU] : undefined;
}

/** Grup altı tablolarına (anahtar → satırlar) Döviz / Kuyum / Ticari başlık satırları (K11) */
export function grupAltBasliklari(g: Record<string, Record<string, any>[]>, grupla: (s: any) => ParaGrubu): Record<string, Record<string, any>[]> {
  return Object.fromEntries(Object.entries(g).map(([a, ss]) => [a, paraBasliklariEkle(ss, { grupla, alan: "paraKod" })]));
}

// ───────────────────────── CARHAR1 ─────────────────────────

export const CARHAR_SIRALAMALARI = ["tarih", "sondan", "bastan", "ad", "kod"] as const;
export type CarharSiralama = typeof CARHAR_SIRALAMALARI[number];
const NET_TOPLAM: RaporNet = { ...NET_BAKIYE, etiket: "Net toplam" };

/**
 * Cari hareket listesi düzeni — sıralama grubu da belirler (eski @SiralamaTarih): "tarih" → para grubu, tarih sırası (bizim düzen, varsayılan);
 * "sondan" / "bastan" → gün grubu (azalan / artan), "ad" / "kod" → cari grubu. `sira` yalnız sabit SQL parçalarıdır; `grupAlani` S.No'nun sıfırlandığı alandır.
 */
export function cariHareketDuzeni(siralama?: string): { kip: CarharSiralama; sira: string; grupAlani: string; gruplar: RaporGrup[] } {
  const kip = (CARHAR_SIRALAMALARI as readonly string[]).includes(siralama || "") ? siralama as CarharSiralama : "tarih";
  const para = "ISNULL(P.SIRA_NO,99), P.KOD", belge = "CH.evrakTipi, CH.hareketId, CH.satirNo";
  const grup = (anahtar: string, baslik: string): RaporGrup[] => [{ anahtar, baslik, altToplam: true, net: NET_TOPLAM }];
  switch (kip) {
    case "sondan": return { kip, grupAlani: "gun", gruplar: grup("gun", "{{gunBaslik}}"), sira: `CAST(CH.tarih AS date) DESC, CH.tarih DESC, CH.eklemeZamani DESC, CH.tip, ${para}, ${belge}` };
    case "bastan": return { kip, grupAlani: "gun", gruplar: grup("gun", "{{gunBaslik}}"), sira: `CAST(CH.tarih AS date), CH.tarih, CH.eklemeZamani, CH.tip, ${para}, ${belge}` };
    case "ad": return { kip, grupAlani: "cariKod", gruplar: grup("cariKod", "{{cariAd}} — {{cariKod}}"), sira: `C.AD, C.KOD, CH.tarih, CH.eklemeZamani, CH.tip, ${para}, ${belge}` };
    case "kod": return { kip, grupAlani: "cariKod", gruplar: grup("cariKod", "{{cariKod}} — {{cariAd}}"), sira: `C.KOD, CH.tarih, CH.eklemeZamani, CH.tip, ${para}, ${belge}` };
    default: return { kip, grupAlani: "paraKod", gruplar: grup("paraKod", "Para birimi: {{paraKod}}"), sira: `${para}, CH.tarih, CH.eklemeZamani, ${belge}` };
  }
}

/**
 * Cari hareket satırlarını tamamlar (saf): hareket adı + harfi, B/A, borç / alacak, S.No (grup değişince sıfırlanır) ve para bazında net toplam
 * (|Σborç − Σalacak| + B/A; eski @GrupToplam / @GenelToplam para bazında).
 */
export function cariHareketSatirlari(kayitlar: any[], grupAlani: string) {
  const net = new Map<string, { paraId: any; paraKod: string; borc: number; alacak: number; adet: number }>();
  let onceki: unknown, sira = 0;
  const satirlar = kayitlar.map((r, i) => {
    const meblag = Number(r.meblag), alacakMi = Number(r.tipKod) === 1;
    if (i === 0 || r[grupAlani] !== onceki) { sira = 0; onceki = r[grupAlani]; }
    const s = { ...r, fisNo: String(r.fisNo ?? ""), meblag, hareketTipi: hareketAdi(r), hareketHarf: hareketHarfi(r.hareketTipiKod), tip: alacakMi ? "Alacak" : "Borç",
      borc: Number(r.tipKod) === 0 ? meblag : 0, alacak: alacakMi ? meblag : 0, siraNo: ++sira, gunBaslik: tarihTr(String(r.gun ?? "")) };
    const o = net.get(s.paraKod) || { paraId: r.paraId, paraKod: s.paraKod, borc: 0, alacak: 0, adet: 0 };
    o.borc += s.borc; o.alacak += s.alacak; o.adet++; net.set(s.paraKod, o);
    return s;
  });
  const netToplamlar = [...net.values()].map(o => { const n = o.borc - o.alacak; return { paraId: o.paraId, paraKod: o.paraKod, borc: o.borc, alacak: o.alacak, adet: o.adet, netToplam: Math.abs(n), netTipi: n > 0 ? "B" : n < 0 ? "A" : "" }; });
  return { satirlar, netToplamlar };
}

const CARHAR_SIRA_ADI: Record<CarharSiralama, string> = { tarih: "", sondan: " · Sondan başa", bastan: " · Baştan sona", ad: " · Ada göre", kod: " · Koda göre" };

export const CARI_SORGULARI: Record<string, Sorgu> = {
  /**
   * R1 Cari bakiye raporu — tarih aralığı (yönetici 14.09.2026): borç/alacak aralıktaki hareketler, bakiye bitiş tarihi itibarıyla; para ve has bazında;
   * sıfır bakiyeliler hariç (kullanıcı kararı 19.09.2026). Eski parametreler: liste şekli, sıralama, hesap tipi, alt / üst limit, ilk – son ad.
   */
  async CARBAK1(pool, p, t) {
    const bas = p.baslangic || p.tarih, bit = p.bitis || p.tarih;
    if (!bas || !bit) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const duzen = cariBakiyeDuzeni(secim(p, "listeSekli", ["kart", "para"]), secim(p, "siralama", ["kod", "ad"]));
    const hesapTipi = hesapTipiOku(p), alt = sayi(p, "limitAlt"), ust = sayi(p, "limitUst");
    // Kur seçimi (eski VODVZR_CARI_BAKIYE_RAPORU'daki kur karşılığı; yönetici kararı 17.09.2026: has ve TL karşılığı birlikte görünür)
    const kur = await kurCoz(pool, { ...p, kurTarihi: p.kurTarihi || bit });
    const pg = await paraGrupBilgisi(pool);
    const req = pool.request().input("bas", sql.Date, bas).input("t", sql.Date, bit);
    const f = filtreler(req, p, { cari: "C", para: "B.PARA_ID" }) + metinAraligi(req, p, "C.AD", "cariAd");
    // Kaynak: cari hareketler + virman dekontu + bankadan ödenen döviz fişi + sarraf fişi cari ödemesi (eski VODVZR_CARI_BAKIYE_RAPORU kapsamı; kaynak.ts)
    const res = await req.query(`
      ;WITH CH (${CARI_HAREKET_KOLONLARI}) AS (
       ${cariHareketleriSql(await belgeTablolari(pool))}
      ), B AS (
        SELECT CH.cariKartId CARI_KART_ID, CH.paraId PARA_ID,
          SUM(CASE WHEN CH.tip=0 AND CAST(CH.tarih AS date)>=@bas THEN CH.meblag ELSE 0 END) BORC, SUM(CASE WHEN CH.tip=1 AND CAST(CH.tarih AS date)>=@bas THEN CH.meblag ELSE 0 END) ALACAK,
          SUM(CASE WHEN CH.tip=1 THEN CH.meblag ELSE -CH.meblag END) BAKIYE
        FROM CH WHERE CAST(CH.tarih AS date)<=@t GROUP BY CH.cariKartId, CH.paraId)
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd,
        B.PARA_ID paraId, ISNULL(RTRIM(P.KOD),'-') paraKod, ISNULL(B.BORC,0) borc, ISNULL(B.ALACAK,0) alacak,
        ISNULL(B.BAKIYE,0) bakiye, ISNULL(P.HAS_ORANI,0) hasOrani
      FROM dbo.TODVZ_CARI_KART C
      LEFT JOIN B ON B.CARI_KART_ID=C.CARI_KART_ID
      LEFT JOIN dbo.TODVZ_PARA P ON P.PARA_ID=B.PARA_ID
      WHERE 1=1 ${f}
      ORDER BY ${duzen.sira};`);
    // Eski "CARİ BAKİYE RAPORU" metrikleri: net = borç − alacak; Borç bakiye = net > 0, Alacak bakiye = net < 0 (mutlak). Sıfır bakiyeli satırlar listelenmez (eski rapor: BAKIYE <> 0).
    // Hesap tipi bakiye yönünü, alt / üst limit |bakiye| aralığını süzer (eski kayıt seçimi).
    const satirlar: Record<string, any>[] = res.recordset.map((r: any) => {
      const bakiye = Number(r.bakiye) || 0, net = -bakiye;
      return { ...r, borc: Number(r.borc), alacak: Number(r.alacak), bakiye: Math.abs(bakiye), net,
        borcBakiye: net > 0 ? net : 0, alacakBakiye: net < 0 ? -net : 0,
        yon: bakiye > 0 ? "Alacak" : bakiye < 0 ? "Borç" : "-",
        hasKarsiligi: Math.abs(bakiye) * (Number(r.hasOrani) || 0),
        kur: kur.kurlar.get(Number(r.paraId)) ?? 0, tlKarsiligi: -bakiye * (kur.kurlar.get(Number(r.paraId)) ?? 0),
        kurSatis: kur.satisKurlari.get(Number(r.paraId)) ?? 0, tlSatis: -bakiye * (kur.satisKurlari.get(Number(r.paraId)) ?? 0), cariBaslik: `${r.cariKod} — ${r.cariAd}` };
    }).filter((s: any) => bakiyeSuzgeci(s, { hesapTipi, alt, ust }));
    // Para bazında listede her para ayrı gruptur: paralar Döviz → Kuyum bölümlerine dizilir (K11; docs 1.6)
    // Kart bazında her carinin para satırları Döviz / Kuyum başlıkları altında (K11; başlık satırı toplamlara girmez); para bazında paralar bölümlere dizilir
    const grupluSatirlar = duzen.para ? paraGrubunaGoreSirala(satirlar, s => pg.grup(s)) : paraBasliklariEkle(satirlar, { grupla: (s): ParaGrubu => pg.grup(s), alan: "paraKod", bolumle: ["cariKod"] });
    // Para bazında "Toplam :" ve "Bakiye :" (net, B/A) — eski rapordaki grup altlıklarının karşılığı; Döviz / Kuyum başlıklarıyla (K11)
    const paraToplamlari = paraBasliklariEkle(paraBakiyeToplamlari(satirlar as any), { grupla: (s): ParaGrubu => pg.grup(s), alan: "paraKod" });
    const adOzeti = metinAraligiOzeti(p, "cariAd", "Ad");
    const limitOzeti = alt !== undefined || ust !== undefined ? ` · Bakiye ${alt ?? "…"} – ${ust ?? "…"}` : "";
    return { ...sinirla(grupluSatirlar, t, `${tarihTr(bas)} – ${tarihTr(bit)}${ozetEk(p) || (adOzeti ? "" : " · Tüm cariler")}${adOzeti}${hesapTipiOzeti(hesapTipi)}${limitOzeti}${duzen.para ? " · Para bazında" : ""} · ${kur.aciklama}`,
      "Borç bakiye / Alacak bakiye bitiş tarihi itibarıyla tüm hareketlerden hesaplanan net bakiyenin yönüdür (Borç = carinin bize borcu, Alacak = carinin bizden alacağı); sıfır bakiyeli satırlar listelenmez. Dönem borç ve dönem alacak seçilen tarih aralığındaki hareket toplamlarıdır. Has karşılığı = bakiye × para tanımındaki has oranı.",
      paraToplamlari), gruplar: duzen.gruplar };
  },

  /**
   * R2 Cari ekstre — cari (boş = tüm cariler), tarih aralığı, para (çoklu); cari → para grupları, cari başlık bilgisi, devir + yürüyen bakiye, fiş no, has karşılığı.
   * Eski parametreler: ilk – son ad, hesap tipi (satır tipi), sıralama (Kod / Ad), Devir (Dahil → dönem öncesi kayıtlar satır satır / Değil → tek net devir satırı).
   * Emanet alma / verme dekontları bakiyeyi etkilemeyen bilgi satırıdır (eski "CARİ EMANET - DEKONT EKSTRE"; kullanıcı kararı B25c).
   */
  async CAREKS1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const hesapTipi = hesapTipiOku(p), dahil = secim(p, "devir", ["degil", "dahil"]) === "dahil", adaGore = secim(p, "siralama", ["kod", "ad"]) === "ad";
    const d = await belgeTablolari(pool), pg = await paraGrupBilgisi(pool);
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("htip", sql.Int, hesapTipiKodu(hesapTipi));
    const fOrtak = filtreler(req, p, { cari: "C", para: "CH.paraId" }) + metinAraligi(req, p, "C.AD", "cariAd");
    const f = `${fOrtak} AND (@htip IS NULL OR CH.tip=@htip)`;
    const cariAlan = `RTRIM(ISNULL(C.ADRES,'')) cariAdres, RTRIM(ISNULL(C.TELEFON,'')) cariTelefon, RTRIM(ISNULL(C.VERGI_KIMLIK_NO,'')) cariVergiNo`;
    // Kaynak: cari hareketler + virman dekontu + bankadan ödenen döviz fişi + sarraf fişi cari ödemesi (eski VODVZR_CARI_EMANET_DEKONT_EKSTRE kapsamı; kaynak.ts)
    const ch = `;WITH CH (${CARI_HAREKET_KOLONLARI}) AS (
       ${cariHareketleriSql(d)}
      )`;
    // Emanet alma / verme (dekont TIP 0 / 1; satır tipi dekont tipiyle aynı olan satırlar, iptal edilmemiş): yalnız dönem içi ve Hesap tipi = Hepsi iken.
    // İlgili cari: almada alacaklı, vermede borçlu (uygulama ikisine de aynı cariyi yazar).
    const emanet = d.dekont && hesapTipi === "hepsi" ? `
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, ${cariAlan}, CAST(D.CARI_DEKONT_ID AS varchar(20)) fisNo, D.TIP dekontTip, D.TARIH tarih, D.EKLEME_ZAMANI eklemeZamani,
        CONVERT(varchar(5), CASE WHEN CAST(D.TARIH AS time)='00:00' THEN CAST(D.EKLEME_ZAMANI AS time) ELSE CAST(D.TARIH AS time) END, 108) saat,
        RTRIM(ISNULL(D.ACIKLAMA,'')) aciklama, DS.PARA_ID paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(P.HAS_ORANI,0) hasOrani, DS.MEBLAG meblag, RTRIM(ISNULL(V.KOD,'')) vezneKod
      FROM dbo.TODVZ_CARI_DEKONT D JOIN dbo.TODVZ_CARI_DEKONT_SATIRI DS ON DS.CARI_DEKONT_ID=D.CARI_DEKONT_ID AND DS.TIP=D.TIP JOIN dbo.TODVZ_PARA P ON P.PARA_ID=DS.PARA_ID
        JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=CASE WHEN D.TIP=0 THEN COALESCE(D.ALACAKLI_ID, D.BORCLU_ID) ELSE COALESCE(D.BORCLU_ID, D.ALACAKLI_ID) END
        LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=D.VEZNE_ID
      WHERE D.TIP IN (0,1) AND D.IPTAL_TARIHI IS NULL AND CAST(D.TARIH AS date) BETWEEN @bas AND @bit ${fOrtak.replace(/CH\.paraId/g, "DS.PARA_ID")}
      ORDER BY D.TARIH, D.EKLEME_ZAMANI, D.CARI_DEKONT_ID, DS.SATIR_NO;` : "";
    const res = await req.query(`
      ${ch}
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, ${cariAlan}, CH.paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(P.HAS_ORANI,0) hasOrani,
        SUM(CASE WHEN CH.tip=0 THEN CH.meblag ELSE 0 END) borc, SUM(CASE WHEN CH.tip=1 THEN CH.meblag ELSE 0 END) alacak
      FROM CH JOIN dbo.TODVZ_PARA P ON P.PARA_ID=CH.paraId JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=CH.cariKartId
      WHERE CAST(CH.tarih AS date)<@bas${dahil ? " AND 1=0" : ""} ${f} GROUP BY C.CARI_KART_ID, C.KOD, C.AD, C.ADRES, C.TELEFON, C.VERGI_KIMLIK_NO, CH.paraId, P.KOD, P.SIRA_NO, P.HAS_ORANI;
      ${ch}
      SELECT C.CARI_KART_ID cariId, RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, ${cariAlan}, CH.belgeNo fisNo, CH.evrakTipi, CH.tarih, CH.eklemeZamani, CH.hareketTipi, CH.tip, CASE WHEN CAST(CH.tarih AS date)<@bas THEN 1 ELSE 0 END onceki,
        CONVERT(varchar(5), CASE WHEN CAST(CH.tarih AS time)='00:00' THEN CAST(CH.eklemeZamani AS time) ELSE CAST(CH.tarih AS time) END, 108) saat,
        CH.aciklama, CH.paraId, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(P.HAS_ORANI,0) hasOrani, CH.meblag, RTRIM(ISNULL(V.KOD,'')) vezneKod
      FROM CH JOIN dbo.TODVZ_PARA P ON P.PARA_ID=CH.paraId JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=CH.cariKartId LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=CH.vezneId
      WHERE CAST(CH.tarih AS date)<=@bit${dahil ? "" : " AND CAST(CH.tarih AS date)>=@bas"} ${f}
      ORDER BY C.KOD, ISNULL(P.SIRA_NO,99), P.KOD, CH.tarih, CH.eklemeZamani, CH.evrakTipi, CH.hareketId, CH.satirNo;${emanet}`);
    const sets = res.recordsets as any[];
    const e = ekstreKur(sets[0], sets[1], sets[2] || [], { baslangic: p.baslangic, bitis: p.bitis, adaGore, devirSatiri: !dahil });
    // "Cari ve para bazında toplam" özetinde paralar cari içinde Döviz / Kuyum başlıkları altında (K11)
    const ozet = paraBasliklariEkle(e.paraToplamlari, { grupla: (s): ParaGrubu => pg.grup(s as any), alan: "paraKod", bolumle: ["cari"] });
    const adOzeti = metinAraligiOzeti(p, "cariAd", "Ad");
    return { ...sinirla(e.satirlar, t, `${aralikOzeti(p)}${ozetEk(p) || (adOzeti ? "" : " · Tüm cariler")}${adOzeti}${hesapTipiOzeti(hesapTipi)}${dahil ? " · Devir dahil" : ""}`,
      "Yön: A = cari alacaklı (bizden alacağı var), B = cari borçlu. Her cari ve para birimi ayrı gruplanır; ilk satır başlangıç tarihinden önceki devirdir. Has karşılığı = yürüyen bakiye × para tanımındaki has oranı.",
      ozet), grupAltSatirlar: grupAltBasliklari(e.grupAltSatirlar, s => pg.grup(s)), ...(dahil ? { gruplar: ekstreGruplari(t.gruplar, true) } : {}), ...(e.bilgiVar ? {} : { kolonCikar: ["emanet"] }) };
  },

  /** R3 Cari hareket listesi — sıralama grubu da belirler (cariHareketDuzeni); hesap tipi satırın borç / alacak tipini süzer */
  async CARHAR1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const duzen = cariHareketDuzeni(prm(p, "siralama")), hesapTipi = hesapTipiOku(p);
    const pg = await paraGrupBilgisi(pool);
    const req = pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis)
      .input("ht", sql.Int, Number.isInteger(p.hareketTipi) ? p.hareketTipi : null).input("htip", sql.Int, hesapTipiKodu(hesapTipi));
    const htler = (p.hareketTipleri || []).filter(n => Number.isInteger(n) && n >= 0 && n <= 5);
    htler.forEach((h, i) => req.input(`htl${i}`, sql.Int, h));
    // Belgelerden gelen satırların hareket tipi eski görünümdeki gibi 0 (nakit) sayılır; "Nakit" seçimi onları da kapsar
    const f = filtreler(req, p, { cari: "C", vezne: "V", para: "CH.paraId" }) + metinAraligi(req, p, "C.AD", "cariAd")
      + (htler.length ? ` AND CH.hareketTipi IN (${htler.map((_, i) => `@htl${i}`).join(",")})` : "");
    const res = await req.query(`
      ;WITH CH (${CARI_HAREKET_KOLONLARI}) AS (
       ${cariHareketleriSql(await belgeTablolari(pool))}
      )
      SELECT CH.belgeNo fisNo, CH.evrakTipi, CH.tarih, CONVERT(char(10), CAST(CH.tarih AS date), 23) gun,
        CONVERT(varchar(5), CASE WHEN CAST(CH.tarih AS time)='00:00' THEN CAST(CH.eklemeZamani AS time) ELSE CAST(CH.tarih AS time) END, 108) saat,
        RTRIM(ISNULL(C.KOD,'')) cariKod, RTRIM(ISNULL(C.AD,'')) cariAd, CH.hareketTipi, CH.hareketTipi hareketTipiKod, CH.tip tipKod,
        CH.aciklama, CH.paraId, RTRIM(P.KOD) paraKod, CH.meblag, RTRIM(ISNULL(V.KOD,'')) vezneKod
      FROM CH JOIN dbo.TODVZ_PARA P ON P.PARA_ID=CH.paraId LEFT JOIN dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=CH.cariKartId LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=CH.vezneId
      WHERE CAST(CH.tarih AS date) BETWEEN @bas AND @bit AND (@ht IS NULL OR CH.hareketTipi=@ht) AND (@htip IS NULL OR CH.tip=@htip) ${f}
      ORDER BY ${duzen.sira};`);
    // Grup para iken paralar Döviz → Kuyum bölümlerine dizilir (K11; docs 1.6); S.No grup içinde sıfırlanır
    const kayitlar = duzen.kip === "tarih" ? paraGrubunaGoreSirala(res.recordset as any[], s => pg.grup(s)) : res.recordset as any[];
    const { satirlar, netToplamlar } = cariHareketSatirlari(kayitlar, duzen.grupAlani);
    const adOzeti = metinAraligiOzeti(p, "cariAd", "Ad");
    return { ...sinirla(satirlar, t, `${aralikOzeti(p)}${ozetEk(p)}${adOzeti}${hesapTipiOzeti(hesapTipi)}${Number.isInteger(p.hareketTipi) ? ` · ${HAREKET_TIPI[p.hareketTipi!] || "Diğer"}` : htler.length ? ` · ${htler.map(h => HAREKET_TIPI[h]).join(", ")}` : ""}${CARHAR_SIRA_ADI[duzen.kip]}`,
      undefined, paraBasliklariEkle(netToplamlar, { grupla: (s): ParaGrubu => pg.grup(s), alan: "paraKod" })), gruplar: duzen.gruplar };
  },

  /** R4 Cari kart listesi — sıralama (Kod / Ad), ilk – son kod (dürbün), ilk – son ad, serbest arama */
  async CARKRT1(pool, p, t) {
    const adaGore = secim(p, "siralama", ["kod", "ad"]) === "ad";
    const req = pool.request().input("arama", sql.NVarChar(100), p.arama?.trim() ? `%${p.arama.trim()}%` : null);
    const f = filtreler(req, p, { cari: "C" }) + metinAraligi(req, p, "C.AD", "cariAd");
    const res = await req.query(`
      SELECT RTRIM(ISNULL(C.KOD,'')) kod, RTRIM(ISNULL(C.AD,'')) ad, C.KISILIK_TIPI kisilikKod, RTRIM(ISNULL(C.VERGI_KIMLIK_NO,'')) vergiNo,
        RTRIM(ISNULL(C.PASAPORT_NO,'')) pasaportNo, RTRIM(ISNULL(C.TELEFON,'')) telefon, RTRIM(ISNULL(C.EPOSTA,'')) eposta, RTRIM(ISNULL(C.ADRES,'')) adres,
        ISNULL(C.KARA_LISTEDE,0) karaListe, RTRIM(ISNULL(C.YETKILI_KISI,'')) yetkili, RTRIM(ISNULL(C.BABA_ADI,'')) babaAdi,
        RTRIM(ISNULL(VD.AD,'')) vergiDairesi, RTRIM(ISNULL(ILC.AD,'')) ilce, RTRIM(ISNULL(NULLIF(RTRIM(PK.KOD),''),PK.AD)) postaKodu, RTRIM(ISNULL(IL.AD,'')) il,
        RTRIM(ISNULL(NULLIF(RTRIM(UL.KOD),''),UL.AD)) ulke, RTRIM(ISNULL(UY.AD,'')) uyruk, RTRIM(ISNULL(HY.AD,'')) hukukiYapi
      FROM dbo.TODVZ_CARI_KART C
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI VD ON VD.TABLO_MADDESI_ID=C.VERGI_DAIRESI_ID AND VD.TUR=0 LEFT JOIN dbo.TODVZ_TABLO_MADDESI ILC ON ILC.TABLO_MADDESI_ID=C.ILCE_ID AND ILC.TUR=2
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI PK ON PK.TABLO_MADDESI_ID=C.POSTA_KODU_ID AND PK.TUR IN (1,4) LEFT JOIN dbo.TODVZ_TABLO_MADDESI IL ON IL.TABLO_MADDESI_ID=C.IL_ID AND IL.TUR=3
      LEFT JOIN dbo.TODVZ_ULKE UL ON UL.ULKE_ID=C.ULKE_ID LEFT JOIN dbo.TODVZ_ULKE UY ON UY.ULKE_ID=C.UYRUK_ID
      LEFT JOIN dbo.TODVZ_TABLO_MADDESI HY ON HY.TABLO_MADDESI_ID=C.HUKUKI_YAPI_ID AND HY.TUR=5
      WHERE (@arama IS NULL OR C.KOD LIKE @arama OR C.AD LIKE @arama OR C.VERGI_KIMLIK_NO LIKE @arama) ${f}
      ORDER BY ${adaGore ? "C.AD, C.KOD" : "C.KOD"};`);
    const satirlar = res.recordset.map((r: any, i: number) => ({ ...r, siraNo: i + 1, kisilik: KISILIK[Number(r.kisilikKod)] || "-", karaListe: r.karaListe ? "EVET" : "" }));
    const ozet = `${p.arama?.trim() ? ` · Arama: "${p.arama.trim()}"` : ""}${ozetEk(p)}${metinAraligiOzeti(p, "cariAd", "Ad")}`.replace(/^ · /, "");
    return sinirla(satirlar, t, ozet || "Tüm cari kartlar");
  },
};

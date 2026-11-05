import sql from "mssql";
import { ApiError } from "../../../utils/ApiError.js";
import type { RaporGrup, RaporSonucVeri, RaporTanim } from "../raporTanim.js";
import { type RaporParametreler, FIS_USD_KOLON_SQL, adetOzeti, usdKuruCozucu, aralikOzeti, ek, ekOnay, filtreler, idFiltre, ozetEk, sinirla, tarihTr } from "../raporOrtak.js";
import { fisKaynagi, type FisKaynagi } from "../fisKaynak.js";
import { paraBasliklariEkle, paraGrupBilgisi, type ParaGrubu } from "../paraGrup.js";

/**
 * Fiş raporları (docs/raporlar-faz2.md Faz R2-F; eski Crystal raporlarıyla eşitleme: docs/RAPOR_ESITLEME_UYGULAMA.md) — yalnızca SELECT.
 * FISLIS1, GUNFIS1, ISTRAP1, VERNUM1 birleşik fiş kaynağını (fisKaynak.ts) okur ve lisansa göre Döviz fişi / Sarraf fişi / Perakende fişi / Ticari fiş
 * bölümlerine ayrılır; ISTKMV1 döviz fişine özgüdür (dbo.TODVZ_FIS). Crystal'daki "GENEL TOPLAM" alt raporlarının karşılığı `ozetSatirlar`
 * (para bazında özet; paralar Döviz / Kuyum / Ticari başlıkları altında).
 */

type Sorgu = (pool: sql.ConnectionPool, p: RaporParametreler, t: RaporTanim) => Promise<RaporSonucVeri>;

const tipAdi = (k: any) => (Number(k) === 1 ? "Satış" : "Alış");
const tipOzeti = (p: RaporParametreler) => (p.fisTipi === 0 ? " · Alış" : p.fisTipi === 1 ? " · Satış" : "");
const tipGirdisi = (req: sql.Request, p: RaporParametreler) => req.input("tip", sql.Int, p.fisTipi === 0 || p.fisTipi === 1 ? p.fisTipi : null);

/** Fiş satırı birleşimi: F / S birleşik kaynağın türetilmiş tablolarıdır (kolon adları TODVZ_FIS / TODVZ_FIS_SATIRI ile aynı) */
const satirJoin = (k: FisKaynagi) => `${k.F} JOIN ${k.S} ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
  LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_ISTATISTIK I ON I.ISTATISTIK_ID=F.ISTATISTIK_ID`;
/** Döviz fişine özgü raporlar (ISTKMV1) */
const DOVIZ_SATIR_JOIN = `dbo.TODVZ_FIS F JOIN dbo.TODVZ_FIS_SATIRI S ON S.FIS_ID=F.FIS_ID JOIN dbo.TODVZ_PARA P ON P.PARA_ID=S.PARA_ID
  LEFT JOIN dbo.TODVZ_VEZNE V ON V.VEZNE_ID=F.VEZNE_ID LEFT JOIN dbo.TODVZ_ISTATISTIK I ON I.ISTATISTIK_ID=F.ISTATISTIK_ID`;

/** Ek parametre değeri: `p.ek` → (yerel deneme betikleri için) parametrenin kendisi */
const ekD = (p: RaporParametreler, ad: string): string => ek(p, ad) || String((p as any)[ad] ?? "").trim();
const ekIsaretli = (p: RaporParametreler, ad: string): boolean => ekOnay(p, ad) || (ek(p, ad) === "" && ["1", "true", "evet"].includes(String((p as any)[ad] ?? "").toLowerCase()));
/** Seçim değeri geçerli listede değilse ilk seçenek (varsayılan) */
const secim = <T extends string>(deger: string | undefined, gecerli: readonly T[]): T => (gecerli.includes(deger as T) ? (deger as T) : gecerli[0]);
const gunIso = (g: any) => new Date(g).toISOString().slice(0, 10);
const ilkSonAralik = (p: RaporParametreler, ad: string) => ({ ilk: ekD(p, `${ad}Ilk`), son: ekD(p, `${ad}Son`) });
const aralikMetni = (etiket: string, a: { ilk: string; son: string }) => (a.ilk || a.son ? ` · ${etiket} ${a.ilk || "…"} → ${a.son || "…"}` : "");
const tarihAraligiMetni = (bas: string, bit: string) => (bas === bit ? tarihTr(bas) : `${tarihTr(bas)} – ${tarihTr(bit)}`);

const kiyas = (a: string, b: string) => a.localeCompare(b, "tr", { sensitivity: "accent" });
/** İlk – son metin aralığı süzgeci (eski raporlardaki "İlk / Son seri no, belge no, ad, vergi no"): uçlar dahil, büyük / küçük harf ayrımı yok; boş uç sınırsız. Saf fonksiyon. */
export function metinAraliginda(deger: any, ilk?: string, son?: string): boolean {
  const d = String(deger ?? "").trim(), i = String(ilk ?? "").trim(), s = String(son ?? "").trim();
  return (!i || kiyas(d, i) >= 0) && (!s || kiyas(d, s) <= 0);
}

/** Müşteri adı beyan edilmemiş fiş mi (ünvan boş ya da "İsim beyan edilmemiştir"). Saf fonksiyon. */
export function isimBeyanEdilmemis(unvan: any): boolean {
  const u = String(unvan ?? "").trim().toLocaleUpperCase("tr");
  return !u || u === "İSİM BEYAN EDİLMEMİŞTİR";
}

/** Para (× tip) bazında özet: adet = farklı fiş sayısı, ortalama kur = tutar / miktar. Ticari bölümün satırları (`ticari`) ayrı tutulur. Saf fonksiyon — testte kullanılır. */
export function paraOzeti(satirlar: { fisId: number; paraKod: string; tip: string; miktar: number; tutar: number; komisyon?: number; bmv?: number; kmv?: number; kdv?: number; ticari?: boolean; siraNo?: number }[]) {
  const m = new Map<string, any>();
  for (const s of satirlar) {
    const k = `${s.ticari ? "T" : ""}|${s.paraKod}|${s.tip}`;
    if (!m.has(k)) m.set(k, { paraKod: s.paraKod, tip: s.tip, ...(s.ticari ? { ticari: true } : {}), ...(s.siraNo != null ? { siraNo: Number(s.siraNo) } : {}), fisler: new Set<number>(), miktar: 0, tutar: 0, komisyon: 0, bmv: 0, kmv: 0, kdv: 0 });
    const o = m.get(k); o.fisler.add(s.fisId);
    o.miktar += Number(s.miktar) || 0; o.tutar += Number(s.tutar) || 0; o.komisyon += Number(s.komisyon) || 0; o.bmv += Number(s.bmv) || 0; o.kmv += Number(s.kmv) || 0; o.kdv += Number(s.kdv) || 0;
  }
  return [...m.values()].map(({ fisler, ...o }) => ({ ...o, adet: fisler.size, ortKur: o.miktar ? o.tutar / o.miktar : 0 }));
}
/** Para özeti sırası: para sıra no → para kodu → Alış, sonra Satış (ticari satırlar başlık eklenirken ayrıca sona gider). Saf fonksiyon. */
export function paraOzetiSirala<T extends { paraKod: string; tip: string; siraNo?: number }>(o: T[]): T[] {
  const tipSira = (t: string) => (t === "Alış" || t === "A" ? 0 : 1);
  return o.map((s, i) => ({ s, i })).sort((a, b) => (a.s.siraNo ?? 99) - (b.s.siraNo ?? 99) || kiyas(String(a.s.paraKod), String(b.s.paraKod)) || tipSira(a.s.tip) - tipSira(b.s.tip) || a.i - b.i).map(x => x.s);
}
const ozetGirdisi = (x: any) => ({ fisId: x.fisId, paraKod: x.paraKod, tip: x.tip, miktar: x.miktar, tutar: x.tutar, komisyon: x.komisyon, bmv: x.bmv, kmv: x.kmv, kdv: x.kdv, ticari: Number(x.bolum) === 4,
  ...(x.siraNo != null ? { siraNo: Number(x.siraNo) } : {}) });
/** Satırların hepsi tek parada mı (ticari bölümün parası ayrı sayılır): miktar toplamı yalnız o zaman anlamlıdır. Saf fonksiyon. */
export const tekParali = (satirlar: Record<string, any>[]) => new Set(satirlar.map(x => `${Number(x.bolum) === 4 || x.ticari ? "T" : ""}|${x.paraKod}`)).size === 1;
/** Tek paralı grupta miktar toplamı: ara toplamın altında "Miktar : x" satırı (farklı paraların miktarı hiçbir toplamda toplanmaz) */
const MIKTAR_NET = { arti: "miktar", eksi: "_yok", etiket: "Miktar", artiHarf: " ", eksiHarf: " " };
/** FISLIS1 gün grubu (detay): rapor tek paralıysa gün ara toplamının altında miktar satırı. Saf fonksiyon. */
export const fisListeGruplari = (toplamKipi: boolean, tekPara: boolean): RaporGrup[] =>
  (toplamKipi ? [] : [{ anahtar: "gunBaslik", baslik: "{{gunBaslik}}", altToplam: true, ...(tekPara ? { net: MIKTAR_NET } : {}) }]);

/** Özet satırının para grubu: ticari bölümün satırları "Ticari", kuyum paraları "Kuyum", kalanı "Döviz" (K11) */
export type ParaGruplayici = (s: Record<string, any>) => ParaGrubu;
export const paraGruplayici = (pg: { grup(x: { paraId?: any; paraKod?: any }): ParaGrubu }): ParaGruplayici => s => (s.ticari ? "ticari" : pg.grup({ paraKod: s.paraKod }));

/** FISLIS1 sıralaması (eski @Siralama): gün grubu sabittir, seçim gün içindeki sırayı belirler — seri no / belge no / para (sonra fiş); "tarih" sorgu sırasıdır (saat, fiş). Saf fonksiyon. */
export const FIS_SIRALAMALARI = ["tarih", "seri", "belge", "para"] as const;
export function fisSirala<T extends Record<string, any>>(satirlar: T[], siralama: string): T[] {
  const alan = siralama === "seri" ? "seriNo" : siralama === "belge" ? "belgeNo" : siralama === "para" ? "paraKod" : "";
  if (!alan) return satirlar;
  return satirlar.map((s, i) => ({ s, i })).sort((a, b) => (Number(a.s.bolum) || 0) - (Number(b.s.bolum) || 0) || String(a.s.gunIso).localeCompare(String(b.s.gunIso))
    || kiyas(String(a.s[alan] ?? ""), String(b.s[alan] ?? "")) || (Number(a.s.fisId) || 0) - (Number(b.s.fisId) || 0) || a.i - b.i).map(x => x.s);
}

const GUN_TOPLANANLAR = ["miktar", "kmv", "tutar", "komisyon", "bmv", "kdv", "toplamTutar", "odemeTutari"] as const;
/** FISLIS1 "Toplam" liste tipi (eski rapor: ayrıntı satırları gizli, yalnız gün ara toplamları): bölüm × gün başına tek satır; miktar yalnız gün tek paralıysa (yoksa boş). Saf fonksiyon. */
export function gunlukToplamlar(satirlar: Record<string, any>[]) {
  const m = new Map<string, any>();
  for (const s of satirlar) {
    const a = `${s.bolum}|${s.gunIso}`;
    if (!m.has(a)) m.set(a, { bolum: s.bolum, bolumAd: s.bolumAd, gun: s.gun, gunIso: s.gunIso, gunBaslik: s.gunBaslik, zaman: s.gun, fisler: new Set<number>(), paralar: new Set<string>(), ...Object.fromEntries(GUN_TOPLANANLAR.map(x => [x, 0])) });
    const o = m.get(a); o.fisler.add(s.fisId); o.paralar.add(String(s.paraKod));
    for (const alan of GUN_TOPLANANLAR) o[alan] += Number(s[alan]) || 0;
  }
  return [...m.values()].map(({ fisler, paralar, ...o }) => ({ ...o, adet: fisler.size, miktar: paralar.size === 1 ? o.miktar : null }));
}

/** GUNFIS1 "GÜN TOPLAMI" (eski alt rapor): gün grubu anahtarı → o günün para (× tip) özeti; `grupla` verilirse Döviz / Kuyum / Ticari başlıklarıyla. Saf fonksiyon. */
export function gunToplamlari(satirlar: Record<string, any>[], grupla?: ParaGruplayici): Record<string, Record<string, any>[]> {
  const gunler = new Map<string, Record<string, any>[]>();
  for (const s of satirlar) { const a = String(s.gunAnahtar); if (!gunler.has(a)) gunler.set(a, []); gunler.get(a)!.push(s); }
  const cikti: Record<string, Record<string, any>[]> = {};
  for (const [a, ss] of gunler) { const o = paraOzetiSirala(paraOzeti(ss.map(ozetGirdisi))); cikti[a] = grupla ? paraBasliklariEkle(o, { grupla, alan: "paraKod" }) : o; }
  return cikti;
}
/** Vezne başlığı: kod ile ad aynıysa (ya da ad boşsa) tek yazılır ("01 — 01" değil "01"). Saf fonksiyon. */
export const vezneBasligi = (kod: any, ad: any) => { const k = String(kod ?? "").trim(), a = String(ad ?? "").trim(); return !a || a === k ? k : `${k} — ${a}`; };
/** GUNFIS1 grupları: gün → vezne × tip; rapor tek paralıysa her iki seviyenin ara toplamı altında miktar satırı. Saf fonksiyon. */
export const gunlukFisGruplari = (tekPara: boolean): RaporGrup[] => [
  { anahtar: "gunAnahtar", baslik: "{{gunBaslik}}", altToplam: true, toplamEtiketi: "{{gunBaslik}} toplamı", ...(tekPara ? { net: MIKTAR_NET } : {}) },
  { anahtar: "grupAnahtar", baslik: "{{grupBaslik}}", altToplam: true, ...(tekPara ? { net: MIKTAR_NET } : {}) }];

/**
 * ISTRAP1 grupları (eski rapor: istatistik → @Siralama): Detaylı kipte "para" → istatistik + para, "tarih" → istatistik + gün × para; "seri" seçiminde ikinci
 * seviye her fiş satırı olacağından tek seviye (istatistik) kalır. Toplam kipinde satır zaten istatistik × para olduğundan tek seviye. Saf fonksiyon.
 */
export const ISTATISTIK_SIRALAMALARI = ["para", "tarih", "seri"] as const;
/**
 * Detaylı kipte miktar kolonu toplanmaz (farklı paraların miktarı toplanmasın — eski @ToplanacakMiktar); miktar toplamı yalnız tek paralı grupta
 * net satırı olarak basılır: para alt grubunda her zaman, istatistik grubunda yalnız rapordaki satırların hepsi tek paraysa (`tekPara`).
 * Ara toplam etiketinde "Toplam fiş sayısı" (farklı fiş sayısı, `fisSayilariEkle`).
 */
export function istatistikGruplari(siralama: string, detay: boolean, tekPara = false): RaporGrup[] {
  if (!detay) return [{ anahtar: "istatistikBaslik", baslik: "{{istatistikBaslik}}", altToplam: true }];
  const ist: RaporGrup = { anahtar: "istatistikBaslik", baslik: "{{istatistikBaslik}}", altToplam: true, toplamEtiketi: "ARA TOPLAM ({{istFisSayisi}} fiş)", ...(tekPara ? { net: MIKTAR_NET } : {}) };
  if (siralama !== "para" && siralama !== "tarih") return [ist];
  return [ist, { anahtar: "altGrup", baslik: "{{altGrupBaslik}}", altToplam: true, toplamEtiketi: "Toplam ({{altFisSayisi}} fiş)", net: MIKTAR_NET }];
}
/**
 * ISTRAP1 grup başına fiş sayısı ("Toplam fiş sayısı"): farklı fiş (FIS_ID) sayısı — çok satırlı fiş (ör. 3 satırlı sarraf fişi) tek fiştir;
 * belge no ile sayılmaz (sarraf fiş no tekil değildir). `istFisSayisi`, `altFisSayisi`. Saf fonksiyon.
 */
export function fisSayilariEkle<T extends Record<string, any>>(satirlar: T[]): (T & { istFisSayisi: number; altFisSayisi: number })[] {
  const say = new Map<string, Set<number>>(), ia = (s: T) => `${s.bolum}|${s.istatistikBaslik}`, aa = (s: T) => `${ia(s)}|${s.altGrup}`;
  const ekle = (a: string, id: number) => { if (!say.has(a)) say.set(a, new Set()); say.get(a)!.add(id); };
  for (const s of satirlar) { ekle(ia(s), Number(s.fisId)); ekle(aa(s), Number(s.fisId)); }
  return satirlar.map(s => ({ ...s, istFisSayisi: say.get(ia(s))!.size, altFisSayisi: say.get(aa(s))!.size }));
}
/**
 * ISTRAP1 rapor sonu para özeti: para satırları (para sırası, Döviz / Kuyum / Ticari başlıkları) + birden çok para varsa başlıksız tek GENEL satırı;
 * GENEL'de fiş sayıları farklı fiş sayısıdır, miktarlar (farklı paralar) boş. `topla` ISTRAP1'in toplayıcısıdır. Saf fonksiyon.
 */
export function istatistikParaOzeti(paralar: Record<string, any>[], genel: Record<string, any>, grupla: ParaGruplayici): Record<string, any>[] {
  const ozet = paraBasliklariEkle(paraOzetiSirala(paralar as any[]), { grupla, alan: "paraKod" });
  if (paralar.length > 1) ozet.push({ ...genel, paraKod: "GENEL", girisMiktar: null, cikisMiktar: null, miktar: null });
  return ozet;
}
/** ISTRAP1 sırası: bölüm → istatistik (sorgu sırası) → seçime göre para / gün + para / seri no + para. Satırlara `altGrup` / `altGrupBaslik` yazar. Saf fonksiyon. */
export function istatistikSirala<T extends Record<string, any>>(satirlar: T[], siralama: string): (T & { altGrup: string; altGrupBaslik: string })[] {
  const sira = new Map<string, number>();
  for (const s of satirlar) { const a = `${s.bolum}|${s.istatistikBaslik}`; if (!sira.has(a)) sira.set(a, sira.size); }
  const para = (a: T, b: T) => (Number(a.siraNo) || 0) - (Number(b.siraNo) || 0) || kiyas(String(a.paraKod), String(b.paraKod));
  const ic = siralama === "tarih" ? (a: T, b: T) => String(a.gunIso).localeCompare(String(b.gunIso)) || para(a, b)
    : siralama === "seri" ? (a: T, b: T) => kiyas(String(a.seriNo ?? ""), String(b.seriNo ?? "")) || para(a, b) : para;
  return satirlar.map((s, i) => ({ s, i })).sort((a, b) => sira.get(`${a.s.bolum}|${a.s.istatistikBaslik}`)! - sira.get(`${b.s.bolum}|${b.s.istatistikBaslik}`)! || ic(a.s, b.s) || a.i - b.i)
    .map(({ s }) => ({ ...s, altGrup: siralama === "tarih" ? `${s.gunIso}|${s.paraKod}` : String(s.paraKod), altGrupBaslik: siralama === "tarih" ? `${s.gunBaslik} · ${s.paraKod}` : String(s.paraKod) }));
}

/**
 * ISTKMV1 grupları (eski @Grup): "yok" → yalnız istatistik; "doviz" → istatistik + para kodu; "vezne" → istatistik + vezne no.
 * İkinci seviyenin ara toplamı basılmaz (eski raporda grup alt bilgisi gizli). Saf fonksiyon.
 */
export const KMV_SIRALAMALARI = ["yok", "doviz", "vezne"] as const;
export function kmvGruplari(siralama: string): RaporGrup[] {
  const ist: RaporGrup = { anahtar: "istatistikBaslik", baslik: "{{istatistikBaslik}}", altToplam: true };
  if (siralama === "doviz") return [ist, { anahtar: "paraKod", baslik: "Para kodu : {{paraKod}}", altToplam: false }];
  if (siralama === "vezne") return [ist, { anahtar: "vezneKod", baslik: "Vezne no : {{vezneKod}}", altToplam: false }];
  return [ist];
}
export interface KmvSecenek { siralama: string; isimsizTopla: boolean }
/**
 * ISTKMV1 kırılım anahtarı (eski @Kirilim): aynı anahtarlı satırlar tek satırda toplanır; null → satır kendi başına kalır.
 * Sıralama "yok": yalnız "isim beyan edilmemişleri para bazında topla" işaretliyken ve isimsiz fişlerde gün × para. Sıralama döviz / vezne:
 * isimsiz fişler (kutu işaretli olmasa da) grup × gün × para, isimli fişler ünvan × seri no × para. Saf fonksiyon.
 */
export function kmvKirilimAnahtari(s: Record<string, any>, o: KmvSecenek): string | null {
  const isimsiz = isimBeyanEdilmemis(s.unvan);
  const on = `${s.istatistikBaslik}|${o.siralama === "vezne" ? s.vezneKod : ""}|${s.gunIso}`;
  if (o.siralama !== "doviz" && o.siralama !== "vezne") return isimsiz && o.isimsizTopla ? `${on}|G|${s.paraKod}` : null;
  return isimsiz ? `${on}|G|${s.paraKod}` : `${on}|U|${s.unvan}|${s.seriNo}|${s.paraKod}`;
}
/**
 * ISTKMV1 kırılımı: aynı anahtarlı satırlar ilkinin yerinde tek satır olur (Σ miktar, ortalama kur = Σ tutar ÷ Σ miktar, Σ tutar, Σ KMV, Σ fiş toplamı);
 * toplanan fiş satırları `_alt` içinde kalır (satır altı tablo). Tek satırlı kırılım olduğu gibi kalır; toplamlar değişmez. Saf fonksiyon.
 */
export function kmvKirilimla(satirlar: Record<string, any>[], o: KmvSecenek): Record<string, any>[] {
  const kovalar: Record<string, any>[][] = [], yer = new Map<string, number>();
  for (const s of satirlar) {
    const a = kmvKirilimAnahtari(s, o);
    if (a === null) { kovalar.push([s]); continue; }
    if (!yer.has(a)) { yer.set(a, kovalar.length); kovalar.push([]); }
    kovalar[yer.get(a)!].push(s);
  }
  return kovalar.map(ss => {
    if (ss.length === 1) return ss[0];
    const ilk = ss[0], topla = (alan: string) => ss.reduce((t, x) => t + (Number(x[alan]) || 0), 0);
    const ortak = (alan: string, yoksa: any = "") => (ss.every(x => x[alan] === ilk[alan]) ? ilk[alan] : yoksa);
    const miktar = topla("miktar"), tutar = topla("tutar");
    return { ...ilk, saat: null, vezneKod: ortak("vezneKod"), tip: ortak("tip"), kimlikNo: ortak("kimlikNo"), ulke: ortak("ulke"), belgeNo: ortak("belgeNo"), seriNo: ortak("seriNo"),
      miktar, kur: miktar ? tutar / miktar : 0, tutar, kmv: topla("kmv"), fisToplami: topla("fisToplami"), kmvOrani: ortak("kmvOrani", null),
      _alt: ss.map(x => ({ saat: x.saat, vezneKod: x.vezneKod, belgeNo: x.belgeNo, seriNo: x.seriNo, miktar: x.miktar, kur: x.kur, tutar: x.tutar, kmv: x.kmv, fisToplami: x.fisToplami })) };
  });
}
/** ISTKMV1 sırası: istatistik (sorgu sırası) → seçime göre para kodu / vezne no → sorgu sırası (gün, saat). Saf fonksiyon. */
export function kmvSirala<T extends Record<string, any>>(satirlar: T[], siralama: string): T[] {
  const alan = siralama === "doviz" ? "paraKod" : siralama === "vezne" ? "vezneKod" : "";
  if (!alan) return satirlar;
  const sira = new Map<string, number>();
  for (const s of satirlar) if (!sira.has(s.istatistikBaslik)) sira.set(s.istatistikBaslik, sira.size);
  return satirlar.map((s, i) => ({ s, i })).sort((a, b) => sira.get(a.s.istatistikBaslik)! - sira.get(b.s.istatistikBaslik)! || kiyas(String(a.s[alan] ?? ""), String(b.s[alan] ?? "")) || a.i - b.i).map(x => x.s);
}

/** VERNUM1 "Fiş cinsi" → bölümler: Döviz = Döviz fişi, Altın = Sarraf fişi (B25b); "hepsi" = lisansın açtığı bütün bölümler. Saf fonksiyon. */
export const FIS_CINSLERI = ["hepsi", "doviz", "altin"] as const;
export const fisCinsiBolumleri = (cins: string): number[] | undefined => (cins === "doviz" ? [1] : cins === "altin" ? [2] : undefined);

/**
 * VERNUM1 kimlik özeti: aynı kimliğin satırları bir araya (ilk görünme sırası); her kimlik için bir kez kimlik başlık satırı, altında Döviz / Kuyum / Ticari
 * başlık satırları (K11; başlık metni ilk kolonda — Para kolonunda değil). Para satırlarında kimlik kolonu boştur (başlıkta yazılı). Saf fonksiyon.
 */
export function kimlikOzetiBaslikli(satirlar: Record<string, any>[], grupla: ParaGruplayici): Record<string, any>[] {
  const parcalar = new Map<string, Record<string, any>[]>();
  for (const s of satirlar) { if (!parcalar.has(s.kimlik)) parcalar.set(s.kimlik, []); parcalar.get(s.kimlik)!.push(s); }
  const cikti: Record<string, any>[] = [];
  for (const [kimlik, ss] of parcalar) {
    cikti.push({ kimlik, _baslik: kimlik, _stil: "baslik" });
    cikti.push(...paraBasliklariEkle(ss.map(s => ({ ...s, kimlik: "" })), { grupla, alan: "kimlik" }));
  }
  return cikti;
}

/** Nihai tüketici yer tutucu numarası (11111111111, 2222222222 …: tek rakamın tekrarı) ya da boş → kimlik sayılmaz. Saf fonksiyon. */
export const gecerliKimlikNo = (no: any): string => { const n = String(no ?? "").replace(/\s+/g, ""); return !n || /^(.)\1*$/.test(n) ? "" : n; };
/** Ünvan karşılaştırma anahtarı: Türkçe büyük harf, kırpılmış, iç boşluklar tek. Saf fonksiyon. */
export const unvanAnahtari = (u: any) => String(u ?? "").trim().replace(/\s+/g, " ").toLocaleUpperCase("tr");
/** Yazım farkı karşılaştırması: Türkçe harfler sadeleştirilir (İ/I, Ş/S, Ğ/G, Ü/U, Ö/O, Ç/C) — "yunus demirbas" = "YUNUS DEMIRBAS". Saf fonksiyon. */
const ayniYazim = (a: any, b: any) => {
  const sade = (u: any) => unvanAnahtari(u).replace(/[İI]/g, "I").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ü/g, "U").replace(/Ö/g, "O").replace(/Ç/g, "C");
  return sade(a) === sade(b);
};
/**
 * VERNUM1 grup anahtarı: geçerli VKN / TCKN, yoksa geçerli pasaport no; ikisi de yoksa ünvan (Türkçe büyük harf). Aynı numaranın farklı yazılmış ünvanları tek gruptur.
 * Saf fonksiyon.
 */
export function vergiNoKimligi(x: { vergiNo?: any; pasaportNo?: any; unvan?: any }): { anahtar: string; no: string; tur: string } {
  const vkn = gecerliKimlikNo(x.vergiNo), pas = gecerliKimlikNo(x.pasaportNo);
  if (vkn) return { anahtar: `K|${vkn}`, no: vkn, tur: vkn.length === 11 ? "TCKN" : "VKN" };
  if (pas) return { anahtar: `K|${pas}`, no: pas, tur: "Pasaport" };
  return { anahtar: `U|${unvanAnahtari(x.unvan)}`, no: "", tur: "" };
}
/**
 * VERNUM1 gruplama: satırlara `grupAnahtar` / `grupBaslik` yazar (başlıkta grubun ilk ünvanı); detay satırında başlıkta yazanlar tekrarlanmaz —
 * kimlik no, pasaport no ve vergi dairesi boş, ünvan yalnız başlıktakinden farklı yazılmışsa. Asıl değerler `unvanAsil` / `vergiNoAsil` alanlarında kalır. Saf fonksiyon.
 */
export function vergiNoGrupla<T extends Record<string, any>>(satirlar: T[]): (T & { grupAnahtar: string; grupBaslik: string; unvanAsil: string })[] {
  const ilk = new Map<string, T>();
  const kimlikler = satirlar.map(s => { const k = vergiNoKimligi(s); if (!ilk.has(k.anahtar)) ilk.set(k.anahtar, s); return k; });
  return satirlar.map((s, i) => {
    const k = kimlikler[i], bas = ilk.get(k.anahtar)!, basUnvan = String(bas.unvan ?? "").trim();
    const grupBaslik = k.no ? `${k.tur} ${k.no} — ${basUnvan}` : basUnvan || "Kimlik numarası girilmemiş fişler";
    const ayniUnvan = ayniYazim(s.unvan, basUnvan);
    return { ...s, grupAnahtar: k.anahtar, grupBaslik, unvanAsil: String(s.unvan ?? ""), vergiNoAsil: String(s.vergiNo ?? ""),
      unvan: ayniUnvan ? "" : s.unvan, vergiNo: "", pasaportNo: "", vergiDairesi: "" };
  });
}
/** VERNUM1 cins harfi (eski @Cins): para türüne göre — kuyum parası "A", döviz "D"; ticari fiş "T". Saf fonksiyon. */
export const vergiNoCinsi = (bolum: any, grup: ParaGrubu) => (Number(bolum) === 4 ? "T" : grup === "kuyum" ? "A" : "D");
/** VERNUM1 boş rapor notu */
export const vergiNoBosNotu = (sinirUstu: boolean) => (sinirUstu ? "Seçilen ölçütlerde vergi sınırına ulaşan işlem yok." : "Seçilen ölçütlerde işlem yok.");

/** Veri satırı sayısı başlık satırları sayılmadan yazılır */
const sonuc = (s: RaporSonucVeri, ek2: Partial<RaporSonucVeri> = {}): RaporSonucVeri =>
  (s.sinirAsildi ? s : { ...s, toplamKayit: s.satirlar.filter(x => x._stil !== "baslik").length, ...ek2 });

export const FIS_SORGULARI: Record<string, Sorgu> = {

  /**
   * Fiş listeleme — eski "ALIŞ / SATIŞ FİŞİ LİSTELEME" metrikleri: satır = fiş satırı (tarih, saat, para, vezne, seri no, belge no, miktar, kur, KMV, lira), gün bazında gruplu
   * ve ara toplamlı; rapor sonunda fiş / satır sayısı ve para bazında toplam. Fiş düzeyindeki tutarlar (toplam tutar, ödeme tutarı) yalnızca fişin ilk satırında
   * taşınır ki toplamlar iki kez sayılmasın (ekran / Excel kolonları). Para seçilirse yalnızca o paranın satırları listelenir (eski rapordaki gibi).
   * Eski parametreler: liste tipi (Detay / Toplam — Toplam'da gün başına tek satır), ilk – son seri no, ilk – son belge no, sıralama (gün içinde seri no / belge no / tarih / para),
   * iptal edilenler (işaretliyse yalnız iptal fişler). Sektör bölümleri: Döviz fişi / Sarraf fişi / Perakende fişi / Ticari fiş.
   */
  async FISLIS1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const k = await fisKaynagi(pool, p), pg = await paraGrupBilgisi(pool);
    const iptal = ekIsaretli(p, "iptal"), toplamKipi = ekD(p, "listeTipi") === "toplam", siralama = secim(p.siralama, FIS_SIRALAMALARI);
    const seri = ilkSonAralik(p, "seriNo"), belge = ilkSonAralik(p, "belgeNo");
    const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("iptal", sql.Int, iptal ? 1 : 0), p);
    const f = filtreler(req, p, { cari: "C", vezne: "V", para: "S.PARA_ID" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
    const cariSecili = !!(p.cariIdler?.length || p.cariSonId || p.cariKartId);
    const res = await req.query(`
      SELECT F.BOLUM bolum, F.FIS_ID fisId, S.SATIR_NO satirNo, F.TARIH zaman, ISNULL(F.ZAMAN,F.TARIH) saatZaman, CAST(F.TARIH AS date) gun, F.TIP tipKod, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo,
        RTRIM(ISNULL(F.UNVAN,'')) unvan, RTRIM(ISNULL(F.VERGI_KIMLIK_NO,'')) kimlikNo, RTRIM(ISNULL(C.KOD,'')) cariKod,
        RTRIM(ISNULL(I.KOD,'')) istatistikKod, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KDV,0) kdv,
        ISNULL(F.TOPLAM_TUTAR,0) toplamTutar, ISNULL(F.ODEME_TUTARI,0) odemeTutari
      FROM ${satirJoin(k)} ${cariSecili ? "JOIN" : "LEFT JOIN"} dbo.TODVZ_CARI_KART C ON C.CARI_KART_ID=F.CARI_KART_ID
      WHERE ISNULL(F.IPTAL,0)=@iptal AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY F.BOLUM, CAST(F.TARIH AS date), ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
    const ham = fisSirala(res.recordset.filter((r: any) => metinAraliginda(r.seriNo, seri.ilk, seri.son) && metinAraliginda(r.belgeNo, belge.ilk, belge.son))
      .map((r: any) => ({ ...r, gunIso: gunIso(r.gun) })), siralama);
    const gorulen = new Set<number>();
    const detay = ham.map((r: any) => { const ilk = !gorulen.has(Number(r.fisId)); gorulen.add(Number(r.fisId));
      return { ...r, saat: r.saatZaman, bolumAd: k.bolumAd(r.bolum), tip: tipAdi(r.tipKod), miktar: Number(r.miktar), kur: Number(r.kur), tutar: Number(r.tutar), komisyon: Number(r.komisyon), bmv: Number(r.bmv), kmv: Number(r.kmv), kdv: Number(r.kdv),
        toplamTutar: ilk ? Number(r.toplamTutar) : 0, odemeTutari: ilk ? Number(r.odemeTutari) : 0, gunBaslik: tarihTr(r.gunIso) }; });
    // Rapor sonu: para × tip bazında miktar / tutar / vergiler + fiş adedi (eski "GENEL TOPLAM" ve "Fiş sayısı" karşılığı; eski rapor satır sayar — ikisi de verilir)
    const ozet = paraOzetiSirala(paraOzeti(detay.map(ozetGirdisi)))
      .map(o => ({ ...o, satirAdedi: detay.filter((x: any) => x.paraKod === o.paraKod && x.tip === o.tip && (Number(x.bolum) === 4) === !!o.ticari).length }));
    const satirlar = toplamKipi ? gunlukToplamlar(detay) : detay;
    const gruplar = fisListeGruplari(toplamKipi, detay.length > 0 && tekParali(detay));
    return sonuc(sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.istatistikIdler, "istatistik")}${aralikMetni("Seri no", seri)}${aralikMetni("Belge no", belge)}${iptal ? " · İptal edilenler" : ""}${toplamKipi ? " · Toplam" : ""} · ${gorulen.size} fiş, ${detay.length} satır`,
      `Her satır bir fiş satırıdır; gün bazında gruplanır. Lira = satır tutarı. Toplam tutar ve ödeme tutarı fişin ilk satırında gösterilir. Para seçilirse yalnızca o paranın satırları listelenir. ${iptal ? "Yalnızca iptal edilen fişler listelenir." : "İptal fişler hariçtir."}`,
      paraBasliklariEkle(ozet, { grupla: paraGruplayici(pg), alan: "paraKod" })), { gruplar });
  },

  /**
   * Günlük fiş detay — eski "GÜNLÜK ALIŞ / SATIŞ DETAY RAPORU": tarih aralığındaki fiş satırları gün bazında gruplu; her günün altında "GÜN TOPLAMI" para özeti
   * (para, miktar, ortalama kur, lira), rapor sonunda para bazında GENEL TOPLAM. Gün içinde vezne × fiş tipi grubu (bizim ek seviyemiz) kalır.
   * İptal edilenler işaretliyse yalnız iptal fişler. Sektör bölümleri: Döviz fişi / Sarraf fişi / Perakende fişi / Ticari fiş.
   */
  async GUNFIS1(pool, p, t) {
    // Eski kayıtlı aramalar tek gün (`tarih`) taşır: aralık verilmemişse o gün kullanılır
    const bas = p.baslangic || p.tarih, bit = p.bitis || p.tarih || bas;
    if (!bas || !bit) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const k = await fisKaynagi(pool, p), pg = await paraGrupBilgisi(pool);
    const iptal = ekIsaretli(p, "iptal");
    const req = tipGirdisi(pool.request().input("bas", sql.Date, bas).input("bit", sql.Date, bit).input("iptal", sql.Int, iptal ? 1 : 0), p);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" });
    const res = await req.query(`
      SELECT F.BOLUM bolum, F.FIS_ID fisId, F.TARIH zaman, ISNULL(F.ZAMAN,F.TARIH) saatZaman, CAST(F.TARIH AS date) gun, F.TIP tipKod, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.UNVAN,'')) unvan,
        RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(V.AD,'')) vezneAd, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar,
        ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KDV,0) kdv
      FROM ${satirJoin(k)}
      WHERE ISNULL(F.IPTAL,0)=@iptal AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY F.BOLUM, CAST(F.TARIH AS date), V.KOD, F.TIP, ISNULL(F.ZAMAN,F.TARIH), F.FIS_ID, S.SATIR_NO;`);
    const satirlar = res.recordset.map((r: any) => { const g = gunIso(r.gun);
      return { ...r, saat: r.saatZaman, bolumAd: k.bolumAd(r.bolum), tip: tipAdi(r.tipKod), miktar: Number(r.miktar), kur: Number(r.kur), tutar: Number(r.tutar), komisyon: Number(r.komisyon),
        bmv: Number(r.bmv), kmv: Number(r.kmv), kdv: Number(r.kdv), gunIso: g, gunBaslik: tarihTr(g), gunAnahtar: `${r.bolum}|${g}`,
        grupAnahtar: `${r.vezneKod}|${r.tipKod}`, grupBaslik: `${vezneBasligi(r.vezneKod, r.vezneAd)} · ${tipAdi(r.tipKod)}` }; });
    const grupla = paraGruplayici(pg);
    return sonuc(sinirla(satirlar, t, `${tarihAraligiMetni(bas, bit)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${iptal ? " · İptal edilenler" : ""}`,
      `Gün, vezne ve fiş tipine göre gruplanır; ara toplamlar farklı paraların TL tutarlarını toplar, miktar toplamı için gün toplamı ve sondaki para bazındaki özet kullanılır. ${iptal ? "Yalnızca iptal edilen fişler listelenir." : "İptal fişler hariçtir."}`,
      paraBasliklariEkle(paraOzetiSirala(paraOzeti(satirlar.map(ozetGirdisi))), { grupla, alan: "paraKod" })),
      { grupAltSatirlar: gunToplamlari(satirlar, grupla), gruplar: gunlukFisGruplari(satirlar.length > 0 && tekParali(satirlar)) });
  },

  /**
   * İstatistik raporu — eski "İSTATİSTİK DETAY / TOPLAM RAPORU" metrikleri. Rapor tipi (`birlestir`):
   * "toplam" istatistik × para satırı: Giriş (alış) miktar / TL / fiş ve Çıkış (satış) miktar / TL / fiş yan yana (eski @GirisMiktar, @GirisTutar, @CikisMiktar, @CikisTutar);
   * "detay" (varsayılan) fiş satırı: para, tarih, saat, tip (A / S), seri no, belge no, miktar, kur, lira. İstatistik koduna göre grup + ara toplam; Detaylı kipte sıralama
   * (para / tarih / seri no) ikinci grup seviyesini de belirler (eski @Siralama). Rapor sonunda para bazında giriş / çıkış özeti ve fiş sayıları (eski rapor sonu alt raporu).
   * Fiş adedi farklı fiş sayısıdır; eski rapor satır saydığı için satır adedi de verilir. Sektör bölümleri: Döviz fişi / Sarraf fişi / Perakende fişi / Ticari fiş.
   */
  async ISTRAP1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const detay = p.birlestir !== "toplam"; // varsayılan: Detaylı (eski rapordaki ilk seçenek)
    const siralama = detay ? secim(p.siralama, ISTATISTIK_SIRALAMALARI) : "para";
    const k = await fisKaynagi(pool, p), grupla = paraGruplayici(await paraGrupBilgisi(pool));
    const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis), p);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
    const res = await req.query(`
      SELECT F.BOLUM bolum, F.FIS_ID fisId, ISNULL(F.ISTATISTIK_ID,0) istatistikId, RTRIM(ISNULL(I.KOD,'')) istatistikKod, RTRIM(ISNULL(I.ACIKLAMA,'')) istatistikAd, F.TIP tipKod, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        F.TARIH zaman, ISNULL(F.ZAMAN,F.TARIH) saatZaman, CAST(F.TARIH AS date) gun, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar, ISNULL(S.KOMISYON,0) komisyon, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KDV,0) kdv
      FROM ${satirJoin(k)}
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY F.BOLUM, I.KOD, ISNULL(P.SIRA_NO,99), P.KOD, CAST(F.TARIH AS date), F.SERI_NO, F.FIS_ID, S.SATIR_NO;`);
    const ham = istatistikSirala(res.recordset.map((r: any) => { const g = gunIso(r.gun);
      return { ...r, saat: r.saatZaman, bolumAd: k.bolumAd(r.bolum), ticari: Number(r.bolum) === 4, gunIso: g, gunBaslik: tarihTr(g), giris: Number(r.tipKod) === 0, miktar: Number(r.miktar) || 0, kur: Number(r.kur) || 0, tutar: Number(r.tutar) || 0,
        komisyon: Number(r.komisyon) || 0, bmv: Number(r.bmv) || 0, kmv: Number(r.kmv) || 0, kdv: Number(r.kdv) || 0,
        istatistikBaslik: r.istatistikKod ? `${r.istatistikKod} — ${r.istatistikAd}` : "İstatistik kodu yok" }; }), siralama);
    const topla = (anahtar: (x: any) => string, ortak: (x: any) => Record<string, any>) => { const m = new Map<string, any>();
      for (const x of ham) { const a = anahtar(x); if (!m.has(a)) m.set(a, { ...ortak(x), gF: new Set<number>(), cF: new Set<number>(), girisMiktar: 0, girisTutar: 0, cikisMiktar: 0, cikisTutar: 0, satirAdedi: 0, komisyon: 0, bmv: 0, kmv: 0, kdv: 0 });
        const o = m.get(a); o.satirAdedi++; (x.giris ? o.gF : o.cF).add(x.fisId);
        if (x.giris) { o.girisMiktar += x.miktar; o.girisTutar += x.tutar; } else { o.cikisMiktar += x.miktar; o.cikisTutar += x.tutar; }
        o.komisyon += x.komisyon; o.bmv += x.bmv; o.kmv += x.kmv; o.kdv += x.kdv; }
      return [...m.values()].map(({ gF, cF, ...o }) => ({ ...o, girisFis: gF.size, cikisFis: cF.size, adet: new Set([...gF, ...cF]).size, miktar: o.girisMiktar + o.cikisMiktar, tutar: o.girisTutar + o.cikisTutar,
        ortGirisKuru: o.girisMiktar ? o.girisTutar / o.girisMiktar : 0, ortCikisKuru: o.cikisMiktar ? o.cikisTutar / o.cikisMiktar : 0 })); };
    const ticariEk = (x: any) => (x.ticari ? { ticari: true } : {});
    // Toplam kipinde satır istatistik × para: paralar istatistik grubunun içinde Döviz / Kuyum / Ticari başlıkları altında
    const satirlar = detay ? fisSayilariEkle(ham.map((x: any) => ({ ...x, tip: x.giris ? "A" : "S" })))
      : paraBasliklariEkle(topla(x => `${x.bolum}|${x.istatistikId}|${x.paraKod}`, x => ({ bolum: x.bolum, bolumAd: x.bolumAd, istatistikBaslik: x.istatistikBaslik, paraKod: x.paraKod, ...ticariEk(x) })),
        { grupla, alan: "paraKod", bolumle: ["bolumAd", "istatistikBaslik"] });
    const paralar = topla(x => `${x.ticari ? "T" : ""}|${x.paraKod}`, x => ({ paraKod: x.paraKod, siraNo: Number(x.siraNo), ...ticariEk(x) }));
    const ozet = istatistikParaOzeti(paralar, topla(() => "*", () => ({ paraKod: "GENEL" }))[0] || {}, grupla);
    return sonuc(sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.istatistikIdler, "istatistik")} · ${detay ? "Detaylı" : "Toplam"}`,
      "Fişler istatistik koduna göre gruplanır. Giriş = alış fişleri, Çıkış = satış fişleri. Miktar toplamları farklı para birimlerini birlikte içerebilir; para bazında toplam rapor sonundaki tablodadır (GENEL satırında miktar toplanmaz). İptal fişler hariçtir.",
      ozet), { gruplar: istatistikGruplari(siralama, detay, new Set(ham.map((x: any) => `${x.ticari ? "T" : ""}|${x.paraKod}`)).size === 1) });
  },

  /**
   * İstatistik bazında KMV raporu — eski "İSTATİSTİK BAZINDA KMV RAPORU" metrikleri: satır = fiş satırı (tarih, saat, vezne, ünvan, vergi / TC no, ülke, belge no, seri no,
   * para, miktar, kur, tutar, KMV, fiş toplamı, istatistik). Eski @FisToplami / @Tutar formülleri KMV'nin kura dahil olup olmamasına bakar; bu sistemde KMV hiçbir zaman
   * kura dahil değildir (fiş çıktısı: "Kmv kura dahil değildir") → Tutar = satır tutarı, Fiş toplamı = tutar + KMV. İşlem türü eski rapordaki gibi Alış / Satış / Hepsi.
   * Sıralama (yok / döviz bazında / vezne bazında) ikinci grup seviyesini, "isim beyan edilmemişleri para bazında topla" kırılımı belirler (eski @Grup / @Kirilim):
   * toplanan satır tek satırda (Σ miktar, ortalama kur, Σ tutar, Σ KMV, Σ fiş toplamı), fişleri altındaki tabloda. Döviz fişine özgüdür (dbo.TODVZ_FIS).
   * Önceki özet (istatistik × para × KMV oranı: fiş adedi, miktar, matrah, KMV) rapor sonundaki tablodadır.
   */
  async ISTKMV1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    const siralama = secim(p.siralama, KMV_SIRALAMALARI), isimsizTopla = ekIsaretli(p, "isimsizTopla");
    const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis), p);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
    const ulkeVar = (await pool.request().query(`SELECT CASE WHEN OBJECT_ID('dbo.TODVZ_ULKE','U') IS NULL THEN 0 ELSE 1 END v`)).recordset[0]?.v;
    const res = await req.query(`
      SELECT F.FIS_ID fisId, F.TARIH zaman, ISNULL(F.ZAMAN,F.TARIH) saatZaman, CAST(F.TARIH AS date) gun, F.TIP tipKod, RTRIM(ISNULL(V.KOD,'')) vezneKod, RTRIM(ISNULL(F.UNVAN,'')) unvan,
        COALESCE(NULLIF(RTRIM(F.VERGI_KIMLIK_NO),''), NULLIF(RTRIM(F.PASAPORT_NO),''), '') kimlikNo, ${ulkeVar ? "RTRIM(ISNULL(UL.AD,''))" : "''"} ulke,
        RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(P.KOD) paraKod, ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur,
        ISNULL(S.TUTAR,0) tutar, ISNULL(S.KMV,0) kmv, ISNULL(S.KMV_ORANI,0) kmvOrani, RTRIM(ISNULL(I.KOD,'')) istatistikKod, RTRIM(ISNULL(I.ACIKLAMA,'')) istatistikAd
      FROM ${DOVIZ_SATIR_JOIN} ${ulkeVar ? "LEFT JOIN dbo.TODVZ_ULKE UL ON UL.ULKE_ID=F.ULKE_ID" : ""}
      WHERE ISNULL(F.IPTAL,0)=0 AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip) ${f}
      ORDER BY I.KOD, CAST(F.TARIH AS date), ISNULL(F.ZAMAN,F.TARIH), F.BELGE_NO, F.SERI_NO, S.SATIR_NO;`);
    const ham = res.recordset.map((r: any) => { const tutar = Number(r.tutar) || 0, kmv = Number(r.kmv) || 0;
      return { ...r, saat: r.saatZaman, gunIso: gunIso(r.gun), tip: tipAdi(r.tipKod), miktar: Number(r.miktar) || 0, kur: Number(r.kur) || 0, tutar, kmv, kmvOrani: Number(r.kmvOrani) || 0, fisToplami: tutar + kmv,
        istatistikBaslik: r.istatistikKod ? `${r.istatistikKod} — ${r.istatistikAd}` : "İstatistik kodu yok" }; });
    const oz = new Map<string, any>();
    for (const x of ham) { if (!x.kmv && !x.kmvOrani) continue; const a = `${x.istatistikKod}|${x.paraKod}|${x.kmvOrani}`;
      if (!oz.has(a)) oz.set(a, { istatistik: x.istatistikBaslik, paraKod: x.paraKod, kmvOrani: x.kmvOrani, fisler: new Set<number>(), miktar: 0, matrah: 0, kmv: 0 });
      const o = oz.get(a); o.fisler.add(x.fisId); o.miktar += x.miktar; o.matrah += x.tutar; o.kmv += x.kmv; }
    const ozet = [...oz.values()].map(({ fisler, ...o }) => ({ ...o, adet: fisler.size }));
    const satirlar = kmvKirilimla(kmvSirala(ham, siralama), { siralama, isimsizTopla });
    return sonuc(sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p) || " · Alış + Satış"}${ozetEk(p) || " · Tüm vezneler"}${adetOzeti(p.istatistikIdler, "istatistik")}${siralama === "doviz" ? " · Döviz bazında" : siralama === "vezne" ? " · Vezne bazında" : ""}${isimsizTopla ? " · İsimsizler para bazında" : ""}`,
      "Her satır bir fiş satırıdır. Tutar = satır tutarı (KMV hariç; bu sistemde KMV kura dahil değildir), Fiş toplamı = tutar + KMV. Kambiyo muameleleri vergisi yalnızca satış fişlerinde doğar; rapor sonundaki özet yalnızca KMV'li satırları (istatistik × para × KMV oranı) toplar. İptal fişler hariçtir.",
      ozet.length ? paraBasliklariEkle(ozet, { grupla: paraGruplayici(await paraGrupBilgisi(pool)), alan: "paraKod", bolumle: ["istatistik"] }) : ozet), { gruplar: kmvGruplari(siralama) });
  },

  /**
   * Vergi numarası raporu — eski "VERGİ NUMARASI RAPORU" ile aynı metrikler: satır = fiş satırı (ünvan, vergi dairesi, vergi no, pasaport no, tip, tarih, saat,
   * seri no, belge no, para, kur, miktar, tutar, USD karşılığı, cins). Karşılık = satır tutarı ÷ fişin USD kuru; USD satırında miktarın kendisi (eski @Karsilik formülü).
   * Varsayılan olarak yalnızca karşılığı firma tanımındaki döviz vergi sınırına (DOVIZ_VERGI_SINIRI) ulaşan satırlar listelenir (eski "Tanımlara bakılsın").
   * Eski parametreler: ilk – son ad, ilk – son vergi no, gösterim şekli (fiş tutarı / dolar karşılığı — kolonlar tanımdaki koşulla), fiş cinsi (Döviz = Döviz fişi bölümü,
   * Altın = Sarraf fişi bölümü), istatistik, iptal edilenler, saat gözükmesin. Kimlik bazında özet (fiş adedi, ort. kur, komisyon, BSMV, KMV) rapor sonundaki özet tablosundadır.
   * Sektör bölümleri: Döviz fişi / Sarraf fişi / Perakende fişi / Ticari fiş.
   */
  async VERNUM1(pool, p, t) {
    if (!p.baslangic || !p.bitis) throw ApiError.badRequest("Tarih aralığı zorunludur.");
    let sinir = 0, sinirPara = "USD";
    try { const tn = (await pool.request().query(`SELECT TOP 1 ISNULL(T.DOVIZ_VERGI_SINIRI,0) sinir, RTRIM(ISNULL(SP.KOD,'USD')) para FROM dbo.TODVZ_TANIM T LEFT JOIN dbo.TODVZ_PARA SP ON SP.PARA_ID=T.DOVIZ_VERGI_SINIRI_PARA_ID`)).recordset[0];
      sinir = Number(tn?.sinir) || 0; sinirPara = String(tn?.para || "USD"); } catch { /* tanım okunamadıysa sınır uygulanmaz */ }
    const sinirUstu = p.durum !== "tumu" && sinir > 0;
    const cins = secim(ekD(p, "fisCinsi"), FIS_CINSLERI), iptal = ekIsaretli(p, "iptal");
    const ad = ilkSonAralik(p, "ad"), vergiNo = ilkSonAralik(p, "vergiNo");
    const yalniz = fisCinsiBolumleri(cins);
    const k = await fisKaynagi(pool, p, yalniz ? { yalniz } : undefined);
    const req = tipGirdisi(pool.request().input("bas", sql.Date, p.baslangic).input("bit", sql.Date, p.bitis).input("iptal", sql.Int, iptal ? 1 : 0), p)
      .input("arama", sql.NVarChar(100), p.arama?.trim() ? `%${p.arama.trim()}%` : null);
    const f = filtreler(req, p, { vezne: "V", para: "S.PARA_ID" }) + idFiltre(req, p.istatistikIdler, "F.ISTATISTIK_ID", "is");
    const res = await req.query(`
      SELECT F.BOLUM bolum, F.FIS_ID fisId, COALESCE(NULLIF(RTRIM(F.VERGI_KIMLIK_NO),''), NULLIF(RTRIM(F.PASAPORT_NO),''), '') kimlikNo,
        CASE WHEN NULLIF(RTRIM(F.VERGI_KIMLIK_NO),'') IS NULL AND NULLIF(RTRIM(F.PASAPORT_NO),'') IS NOT NULL THEN 1 ELSE 0 END pasaport,
        RTRIM(ISNULL(F.UNVAN,'')) unvan, RTRIM(ISNULL(F.VERGI_KIMLIK_NO,'')) vergiNo, RTRIM(ISNULL(F.PASAPORT_NO,'')) pasaportNo, RTRIM(ISNULL(VD.AD,'')) vergiDairesi,
        F.TIP tipKod, F.TARIH zaman, ISNULL(F.ZAMAN,F.TARIH) saatZaman, RTRIM(ISNULL(F.SERI_NO,'')) seriNo, RTRIM(ISNULL(F.BELGE_NO,'')) belgeNo, RTRIM(P.KOD) paraKod, ISNULL(P.SIRA_NO,99) siraNo,
        ISNULL(S.MIKTAR,0) miktar, ISNULL(S.KUR,0) kur, ISNULL(S.TUTAR,0) tutar, ISNULL(S.BMV,0) bmv, ISNULL(S.KMV,0) kmv, ISNULL(S.KOMISYON,0) komisyon, ${FIS_USD_KOLON_SQL}
      FROM ${satirJoin(k)} LEFT JOIN dbo.TODVZ_TABLO_MADDESI VD ON VD.TABLO_MADDESI_ID=F.VERGI_DAIRESI_ID
      WHERE ISNULL(F.IPTAL,0)=@iptal AND CAST(F.TARIH AS date) BETWEEN @bas AND @bit AND (@tip IS NULL OR F.TIP=@tip)
        AND (@arama IS NULL OR F.VERGI_KIMLIK_NO LIKE @arama OR F.PASAPORT_NO LIKE @arama OR F.UNVAN LIKE @arama) ${f}
      ORDER BY F.BOLUM, F.TARIH, F.SERI_NO, F.FIS_ID, S.SATIR_NO;`);
    const usdKuruBul = await usdKuruCozucu(pool, res.recordset);
    const grupla = paraGruplayici(await paraGrupBilgisi(pool));
    const ham = vergiNoGrupla(res.recordset.map((r: any) => { const miktar = Number(r.miktar) || 0, tutar = Number(r.tutar) || 0, usdKuru = Number(usdKuruBul(r)) || 0;
      const vkn = gecerliKimlikNo(r.vergiNo), pas = gecerliKimlikNo(r.pasaportNo);
      return { ...r, saat: r.saatZaman, bolumAd: k.bolumAd(r.bolum), tip: tipAdi(r.tipKod), miktar, tutar, kur: Number(r.kur) || 0, usdKuru, bmv: Number(r.bmv) || 0, kmv: Number(r.kmv) || 0, komisyon: Number(r.komisyon) || 0,
        usdKarsiligi: String(r.paraKod).toUpperCase() === "USD" ? miktar : usdKuru > 0 ? tutar / usdKuru : 0,
        cins: vergiNoCinsi(r.bolum, grupla({ paraKod: r.paraKod, ticari: Number(r.bolum) === 4 })),
        kimlikAlt: [r.vergiDairesi ? `Vergi dairesi: ${r.vergiDairesi}` : "", pas && vkn ? `Pasaport no: ${pas}` : ""].filter(Boolean).join(" · ") }; })
      .filter((s: any) => (!sinirUstu || s.usdKarsiligi >= sinir) && metinAraliginda(s.unvan, ad.ilk, ad.son) && metinAraliginda(s.vergiNo, vergiNo.ilk, vergiNo.son)));
    // Grup sırası: bölüm → kimlik no / ünvan / toplam tutar (büyükten küçüğe); grup içinde tarih → seri no (eski rapor sırası, sorgudan gelir)
    const ga = (s: any) => `${s.bolum}|${s.grupAnahtar}`;
    const toplam = new Map<string, number>(); for (const s of ham) toplam.set(ga(s), (toplam.get(ga(s)) || 0) + s.tutar);
    const unvan = new Map<string, string>(); for (const s of ham) if (!unvan.has(ga(s))) unvan.set(ga(s), s.unvanAsil);
    const satirlar = ham.map((s: any, i: number) => ({ ...s, _i: i })).sort((a: any, b: any) => Number(a.bolum) - Number(b.bolum)
      || (p.siralama === "tutar" ? (toplam.get(ga(b))! - toplam.get(ga(a))!) : p.siralama === "unvan" ? (unvan.get(ga(a)) || "").localeCompare(unvan.get(ga(b)) || "", "tr") : 0)
      || a.grupAnahtar.localeCompare(b.grupAnahtar) || a._i - b._i);
    // Kimlik × tip × para özeti (önceki rapor düzeni): fiş adedi, ortalama kur, vergiler
    const oz = new Map<string, any>();
    // Ticari bölümün satırları ayrı tutulur (Ticari başlığı altına girer)
    for (const s of satirlar) { const ticari = Number(s.bolum) === 4, a = `${s.grupAnahtar}|${s.tipKod}|${ticari ? "T" : ""}|${s.paraKod}`;
      if (!oz.has(a)) oz.set(a, { kimlik: s.grupBaslik, tip: s.tip, paraKod: s.paraKod, ...(ticari ? { ticari: true } : {}), fisler: new Set<number>(), miktar: 0, tutar: 0, usdKarsiligi: 0, komisyon: 0, bmv: 0, kmv: 0 });
      const o = oz.get(a); o.fisler.add(s.fisId); o.miktar += s.miktar; o.tutar += s.tutar; o.usdKarsiligi += s.usdKarsiligi; o.komisyon += s.komisyon; o.bmv += s.bmv; o.kmv += s.kmv; }
    const ozetSatirlar = kimlikOzetiBaslikli([...oz.values()].map(({ fisler, ...o }) => ({ ...o, adet: fisler.size, ortKur: o.miktar ? o.tutar / o.miktar : 0 })), grupla);
    const sinirMetni = `${sinir.toLocaleString("tr-TR")} ${sinirPara}`;
    return sonuc(sinirla(satirlar, t, `${aralikOzeti(p)}${tipOzeti(p)}${ozetEk(p) || " · Tüm vezneler"}${cins === "doviz" ? " · Döviz" : cins === "altin" ? " · Altın" : ""}${adetOzeti(p.istatistikIdler, "istatistik")}${p.arama?.trim() ? ` · Arama: "${p.arama.trim()}"` : ""}${aralikMetni("Ad", ad)}${aralikMetni("Vergi no", vergiNo)}${iptal ? " · İptal edilenler" : ""}${sinirUstu ? ` · +${sinirMetni}` : " · Tüm işlemler"}`,
      vergiNoBosNotu(sinirUstu), ozetSatirlar));
  },
};

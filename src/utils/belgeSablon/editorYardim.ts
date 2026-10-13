import { kagitOlcusu, ogeKutusu, type BelgeOge, type BelgeSablon } from "../../../Backend/src/services/belge/sablonCekirdek";

/**
 * Şablon editörünün saf işlemleri (docs/FIS_TASARIM_YOL_HARITASI.md, 4.4): öğe ekleme, taşıma, boyutlandırma,
 * kopyalama, alan ekleme. Şablon değiştirilmez, her işlem yeni şablon döner (geri al / yinele için).
 */

export type EklenebilirTip = "metin" | "satirlar" | "tablo" | "kutu" | "cizgi" | "qr" | "logo" | "imza";

export const OGE_ADLARI: Record<string, string> = {
  metin: "Metin", satirlar: "Satırlar", tablo: "Tablo", liste: "Liste", kutu: "Kutu", cizgi: "Çizgi",
  resim: "Resim", logo: "Logo", imza: "İmza / Kaşe", qr: "Karekod", filigran: "Filigran",
};

const yuvarla = (n: number) => Math.round(n * 2) / 2;
const kopya = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export const icGenislik = (s: BelgeSablon) => kagitOlcusu(s)[0] - 2 * (s.kenar ?? 28);
export const icYukseklik = (s: BelgeSablon) => { const h = kagitOlcusu(s)[1]; return h > 0 ? h - 2 * (s.kenar ?? 28) : Infinity; };

/** Kimliği şablonda olmayan yeni bir kimlik */
export function yeniKimlik(s: BelgeSablon, onek: string): string {
  const var_ = new Set(s.ogeler.map(o => o.id).filter(Boolean));
  for (let i = 1; ; i++) { const id = `${onek}-${i}`; if (!var_.has(id)) return id; }
}

/** Öğenin taşınabilir sol-üst köşesi */
export function ogeKonumu(o: BelgeOge): { x: number; y: number } {
  if (o.tip === "cizgi") return { x: Math.min(o.x1, o.x2), y: Math.min(o.y1, o.y2) };
  if (o.tip === "filigran") return { x: 0, y: 0 };
  return { x: (o as any).x ?? 0, y: (o as any).y ?? 0 };
}

/** Yeni öğe: verilen y'de (yoksa en alttaki öğenin altında), kâğıt genişliğinde makul ölçüyle */
export function yeniOge(s: BelgeSablon, tip: EklenebilirTip, y: number, gorsel?: string): BelgeOge {
  const g = icGenislik(s);
  const boyut = s.yaziBoyutu ?? 8;
  const id = yeniKimlik(s, tip);
  const yy = yuvarla(Math.max(0, y));
  switch (tip) {
    case "metin": return { id, tip, x: 0, y: yy, g, metin: "Yeni metin", boyut };
    case "satirlar": return { id, tip, x: 0, y: yy, g, satirlar: ["Birinci satır", "İkinci satır"], boyut, aralik: 1 };
    case "tablo": return { id, tip, x: 0, y: yy, g, etiketG: Math.round(g * 0.5), satirH: Math.round(boyut * 1.6), boyut, cerceve: "yok", hizaDeger: "right", satirlar: [["Etiket", "Değer"]] };
    case "kutu": return { id, tip, x: 0, y: yy, g, h: 30, kalinlik: 0.6 };
    case "cizgi": return { id, tip, x1: 0, y1: yy, x2: g, y2: yy, kalinlik: 0.6 };
    case "qr": return { id, tip, x: 0, y: yy, boyut: Math.min(60, g), icerik: "{{qr}}" };
    case "logo": return { id, tip, gorsel: gorsel || "", x: 0, y: yy, g: Math.min(80, g), h: 40 };
    case "imza": return { id, tip, gorsel: gorsel || "", x: Math.max(0, Math.floor((g - 90) * 2) / 2), y: yy, g: Math.min(90, g), h: 45 };
  }
}

/** Öğeyi (dx, dy) kadar taşır; kâğıdın içinde tutar. */
export function ogeTasi(s: BelgeSablon, i: number, dx: number, dy: number): BelgeSablon {
  const y = kopya(s);
  const o: any = y.ogeler[i];
  if (!o || o.tip === "filigran") return s;
  const icG = icGenislik(s), icH = icYukseklik(s);
  if (o.tip === "cizgi") {
    const minX = Math.min(o.x1, o.x2), maxX = Math.max(o.x1, o.x2), minY = Math.min(o.y1, o.y2);
    const ddx = Math.max(-minX, Math.min(dx, icG - maxX)), ddy = Math.max(-minY, dy);
    // 0,5 pt'ye yuvarlanır ama kâğıttan taşmaz
    const kirp = (v: number) => Math.max(0, Math.min(yuvarla(v), icG));
    o.x1 = kirp(o.x1 + ddx); o.x2 = kirp(o.x2 + ddx); o.y1 = Math.max(0, yuvarla(o.y1 + ddy)); o.y2 = Math.max(0, yuvarla(o.y2 + ddy));
    return y;
  }
  const genislik = o.tip === "qr" ? o.boyut : (o.g ?? (o.tip === "metin" ? icG - o.x : 60));
  o.x = Math.max(0, Math.min(yuvarla(o.x + dx), icG - genislik));
  o.y = yuvarla(Math.max(0, Math.min(o.y + dy, Number.isFinite(icH) ? icH - 4 : Infinity)));
  return y;
}

/** Sağ-alt köşeden boyutlandırma (genişlik / yükseklik; karekodda kenar; çizgide bitiş noktası). */
export function ogeBoyutla(s: BelgeSablon, i: number, dg: number, dh: number): BelgeSablon {
  const y = kopya(s);
  const o: any = y.ogeler[i];
  if (!o || o.tip === "filigran") return s;
  const icG = icGenislik(s);
  if (o.tip === "cizgi") { o.x2 = yuvarla(Math.max(0, Math.min(o.x2 + dg, icG))); o.y2 = yuvarla(Math.max(0, o.y2 + dh)); return y; }
  if (o.tip === "qr") { o.boyut = yuvarla(Math.max(20, Math.min(o.boyut + Math.max(dg, dh), icG - o.x))); return y; }
  const eskiG = o.g ?? icG - o.x;
  o.g = yuvarla(Math.max(10, Math.min(eskiG + dg, icG - o.x)));
  // Tablo / liste: etiket sütunu oranla ölçeklenir; sütunlu listede sütunlar oranla
  if ((o.tip === "tablo" || o.tip === "liste") && typeof o.etiketG === "number") o.etiketG = yuvarla(Math.min(o.g, o.etiketG * (o.g / eskiG)));
  if (o.tip === "liste" && Array.isArray(o.sutunlar)) {
    const top = o.sutunlar.reduce((t: number, c: any) => t + c.g, 0);
    o.sutunlar = o.sutunlar.map((c: any) => ({ ...c, g: yuvarla(c.g * (o.g / top)) }));
    const fark = o.g - o.sutunlar.reduce((t: number, c: any) => t + c.g, 0);
    o.sutunlar[o.sutunlar.length - 1].g = yuvarla(o.sutunlar[o.sutunlar.length - 1].g + fark);
  }
  if (o.tip === "kutu" || o.tip === "resim" || o.tip === "logo" || o.tip === "imza") o.h = yuvarla(Math.max(4, (o.h ?? 60) + dh));
  return y;
}

/** Öğeyi kopyalar (yeni kimlik, 6 pt aşağı). */
export function ogeKopyala(s: BelgeSablon, i: number): { sablon: BelgeSablon; yeni: number } {
  const y = kopya(s);
  const o: any = kopya(y.ogeler[i]);
  if (!o) return { sablon: s, yeni: i };
  o.id = yeniKimlik(y, String(o.tip));
  if (typeof o.ad === "string" && o.ad) o.ad = `${o.ad.replace(/ \(kopya\)$/, "")} (kopya)`;
  delete o.zorunlu;
  if (o.tip === "cizgi") { o.y1 += 6; o.y2 += 6; } else if (typeof o.y === "number") o.y += 6;
  y.ogeler.splice(i + 1, 0, o);
  return { sablon: y, yeni: i + 1 };
}

/** Öğeyi siler (kilit yok — bölüm 11, K12). */
export function ogeSil(s: BelgeSablon, i: number): BelgeSablon {
  if (!s.ogeler[i]) return s;
  const y = kopya(s);
  y.ogeler.splice(i, 1);
  return y;
}

/** Öğeyi öne / arkaya alır (çizim sırası). */
export function ogeSirala(s: BelgeSablon, i: number, yon: -1 | 1): { sablon: BelgeSablon; yeni: number } {
  const j = i + yon;
  if (j < 0 || j >= s.ogeler.length) return { sablon: s, yeni: i };
  const y = kopya(s);
  [y.ogeler[i], y.ogeler[j]] = [y.ogeler[j], y.ogeler[i]];
  return { sablon: y, yeni: j };
}

/** Öğenin bir alanını günceller (`undefined` alanı siler). */
export function ogeGuncelle(s: BelgeSablon, i: number, alanlar: Record<string, unknown>): BelgeSablon {
  const y = kopya(s);
  const o: any = y.ogeler[i];
  if (!o) return s;
  for (const [k, v] of Object.entries(alanlar)) { if (v === undefined || v === "") delete o[k]; else o[k] = v; }
  return y;
}

/**
 * Alan ekleme: seçili öğe metin / satırlar ise sonuna `{{alan}}` eklenir; değilse alanın etiketiyle yeni metin
 * öğesi en alta eklenir. Dönen `yeni`, seçilecek öğenin sırası.
 */
export function alanEkle(s: BelgeSablon, secili: number | null, alan: string, enAlt: number): { sablon: BelgeSablon; yeni: number } {
  const yer = `{{${alan}}}`;
  const o: any = secili !== null ? s.ogeler[secili] : null;
  if (o && o.tip === "metin") return { sablon: ogeGuncelle(s, secili!, { metin: `${o.metin ? `${o.metin} ` : ""}${yer}` }), yeni: secili! };
  if (o && o.tip === "satirlar") return { sablon: ogeGuncelle(s, secili!, { satirlar: [...(o.satirlar || []), yer] }), yeni: secili! };
  const y = kopya(s);
  const yeni = yeniOge(y, "metin", enAlt + 4) as any;
  yeni.metin = yer;
  y.ogeler.push(yeni);
  return { sablon: y, yeni: y.ogeler.length - 1 };
}

/** Tablo satırları ↔ düz metin ("Etiket | Değer" her satırda; kalın için sonuna " | *") */
export function tabloMetni(satirlar: any[]): string {
  return (satirlar || []).map(r => {
    const a = Array.isArray(r) ? { etiket: r[0], deger: r[1], kalin: r[2] } : r;
    return [a.etiket ?? "", a.deger ?? "", ...(a.kalin ? ["*"] : []), ...(a.kosul ? [`?${a.kosul}`] : [])].join(" | ");
  }).join("\n");
}
/** "|" ile böler; `{{alan|biçim}}` içindeki "|" ayırıcı sayılmaz. */
function parcala(satir: string): string[] {
  const p: string[] = [];
  let derinlik = 0, bas = 0;
  for (let i = 0; i < satir.length; i++) {
    if (satir.startsWith("{{", i)) { derinlik++; i++; continue; }
    if (satir.startsWith("}}", i) && derinlik > 0) { derinlik--; i++; continue; }
    if (satir[i] === "|" && derinlik === 0) { p.push(satir.slice(bas, i)); bas = i + 1; }
  }
  p.push(satir.slice(bas));
  return p.map(x => x.trim());
}
export function metindenTablo(metin: string): any[] {
  return String(metin || "").split(/\r?\n/).filter(l => l.trim()).map(l => {
    const p = parcala(l);
    const kalin = p.slice(2).includes("*");
    const kosul = p.slice(2).find(x => x.startsWith("?"))?.slice(1);
    return kosul ? { etiket: p[0] ?? "", deger: p[1] ?? "", ...(kalin ? { kalin: true } : {}), kosul } : [p[0] ?? "", p[1] ?? "", ...(kalin ? [true] : [])];
  });
}

// ── Bölüm 11 (K13–K16): satır / kolon ekleme, değer seçici, "ne zaman görünsün", milimetre

/** Punto ↔ milimetre (yan panel kullanıcıya mm gösterir, şablon punto saklar). */
export const ptMm = (pt: number) => Math.round(((pt * 25.4) / 72) * 10) / 10;
export const mmPt = (mm: number) => Math.round(((mm * 72) / 25.4) * 100) / 100;

export interface SatirNesnesi { etiket: string; deger: string; kalin?: boolean; kosul?: string }
/** Tablo satırını tek biçime çevirir (`["Etiket", "Değer", kalın?]` ya da nesne). */
export function satirNesnesi(r: any): SatirNesnesi {
  const a = Array.isArray(r) ? { etiket: r[0], deger: r[1], kalin: r[2] } : (r || {});
  return { etiket: String(a.etiket ?? ""), deger: String(a.deger ?? ""), ...(a.kalin ? { kalin: true } : {}), ...(a.kosul ? { kosul: String(a.kosul) } : {}) };
}
/** Koşulsuz satır kısa (dizi) biçimde yazılır — varsayılan şablonlarla aynı. */
export function satirYaz(n: SatirNesnesi): any {
  return n.kosul ? { etiket: n.etiket, deger: n.deger, ...(n.kalin ? { kalin: true } : {}), kosul: n.kosul } : [n.etiket, n.deger, ...(n.kalin ? [true] : [])];
}

type DiziAnahtari = "satirlar" | "sutunlar" | "altSatirlar";
const dizi = (o: any, k: DiziAnahtari): any[] => (Array.isArray(o?.[k]) ? o[k] : []);

/** Öğenin listesine (tablo satırları, satırlar, sütunlar) `sonra` sırasından sonra (yoksa sona) değer ekler. */
export function diziEkle(s: BelgeSablon, i: number, k: DiziAnahtari, deger: any, sonra?: number): { sablon: BelgeSablon; yeni: number } {
  const y = kopya(s);
  const o: any = y.ogeler[i];
  if (!o) return { sablon: s, yeni: -1 };
  const d = [...dizi(o, k)];
  const yer = sonra === undefined || sonra < 0 || sonra >= d.length ? d.length : sonra + 1;
  d.splice(yer, 0, deger);
  o[k] = d;
  return { sablon: y, yeni: yer };
}
export function diziSil(s: BelgeSablon, i: number, k: DiziAnahtari, n: number): BelgeSablon {
  if (dizi(s.ogeler[i], k)[n] === undefined) return s;
  const y = kopya(s);
  (y.ogeler[i] as any)[k].splice(n, 1);
  return y;
}
export function diziTasi(s: BelgeSablon, i: number, k: DiziAnahtari, n: number, yon: -1 | 1): { sablon: BelgeSablon; yeni: number } {
  const d = dizi(s.ogeler[i], k), m = n + yon;
  if (n < 0 || n >= d.length || m < 0 || m >= d.length) return { sablon: s, yeni: n };
  const y = kopya(s);
  const yd = (y.ogeler[i] as any)[k];
  [yd[n], yd[m]] = [yd[m], yd[n]];
  return { sablon: y, yeni: m };
}
export function diziGuncelle(s: BelgeSablon, i: number, k: DiziAnahtari, n: number, deger: any): BelgeSablon {
  if (dizi(s.ogeler[i], k)[n] === undefined) return s;
  const y = kopya(s);
  (y.ogeler[i] as any)[k][n] = deger;
  return y;
}

/** Tablo satırı ekle: `["Yeni satır", ""]` seçili satırın altına. */
export const tabloSatirEkle = (s: BelgeSablon, i: number, sonra?: number) => diziEkle(s, i, "satirlar", ["Yeni satır", ""], sonra);
/** Tablo satırının bir parçasını değiştirir (etiket, değer, kalın, koşul). */
export function tabloSatirGuncelle(s: BelgeSablon, i: number, n: number, alanlar: Partial<SatirNesnesi>): BelgeSablon {
  const d = dizi(s.ogeler[i], "satirlar");
  if (d[n] === undefined) return s;
  const yeni: SatirNesnesi = { ...satirNesnesi(d[n]), ...alanlar };
  if (!yeni.kalin) delete yeni.kalin;
  if (!yeni.kosul) delete yeni.kosul;
  return diziGuncelle(s, i, "satirlar", n, satirYaz(yeni));
}

/** Kolon genişliklerini 0,5 pt'ye yuvarlar, farkı son kolona verir (toplam = liste genişliği). */
function sutunGenislikDuzelt(o: any, toplam: number) {
  o.sutunlar = o.sutunlar.map((c: any) => ({ ...c, g: Math.max(4, yuvarla(c.g)) }));
  const fark = toplam - o.sutunlar.reduce((t: number, c: any) => t + c.g, 0);
  const son = o.sutunlar[o.sutunlar.length - 1];
  son.g = Math.max(4, Math.round((son.g + fark) * 100) / 100);
}
/** Sütunlu listeye kolon ekler: yeni kolon eşit pay alır, diğerleri oranla daralır; toplam liste genişliğinde kalır. */
export function sutunEkle(s: BelgeSablon, i: number, sonra?: number): { sablon: BelgeSablon; yeni: number } {
  const o: any = s.ogeler[i];
  if (!o || o.tip !== "liste" || !Array.isArray(o.sutunlar) || !o.sutunlar.length || o.sutunlar.length >= 20) return { sablon: s, yeni: -1 };
  const toplam = o.sutunlar.reduce((t: number, c: any) => t + c.g, 0);
  const pay = toplam / (o.sutunlar.length + 1);
  const r = diziEkle(s, i, "sutunlar", { baslik: "Yeni", deger: "", g: pay }, sonra);
  const yo: any = r.sablon.ogeler[i];
  yo.sutunlar = yo.sutunlar.map((c: any, n: number) => (n === r.yeni ? c : { ...c, g: (c.g * (toplam - pay)) / toplam }));
  sutunGenislikDuzelt(yo, toplam);
  // Alt satırlar aynı kolonun altında kalsın
  if (Array.isArray(yo.altSatirlar)) yo.altSatirlar = yo.altSatirlar.map((a: any) => ((a.sutun ?? 0) >= r.yeni ? { ...a, sutun: (a.sutun ?? 0) + 1 } : a));
  return r;
}
/** Kolonu siler, genişliğini kalanlara oranla dağıtır (tek kolon silinmez). */
export function sutunSil(s: BelgeSablon, i: number, n: number): BelgeSablon {
  const o: any = s.ogeler[i];
  if (!o || o.tip !== "liste" || !Array.isArray(o.sutunlar) || o.sutunlar.length <= 1 || !o.sutunlar[n]) return s;
  const toplam = o.sutunlar.reduce((t: number, c: any) => t + c.g, 0);
  const y = diziSil(s, i, "sutunlar", n);
  const yo: any = y.ogeler[i];
  const kalan = yo.sutunlar.reduce((t: number, c: any) => t + c.g, 0);
  yo.sutunlar = yo.sutunlar.map((c: any) => ({ ...c, g: (c.g * toplam) / kalan }));
  sutunGenislikDuzelt(yo, toplam);
  if (Array.isArray(yo.altSatirlar)) yo.altSatirlar = yo.altSatirlar.map((a: any) => ((a.sutun ?? 0) > n ? { ...a, sutun: a.sutun - 1 } : (a.sutun ?? 0) === n ? { ...a, sutun: Math.max(0, n - 1) } : a));
  return y;
}
/** Kolonu sola / sağa taşır; alt satırlar kolonuyla birlikte gider. */
export function sutunTasi(s: BelgeSablon, i: number, n: number, yon: -1 | 1): { sablon: BelgeSablon; yeni: number } {
  const r = diziTasi(s, i, "sutunlar", n, yon);
  if (r.yeni === n) return r;
  const yo: any = r.sablon.ogeler[i];
  if (Array.isArray(yo.altSatirlar)) yo.altSatirlar = yo.altSatirlar.map((a: any) => ((a.sutun ?? 0) === n ? { ...a, sutun: r.yeni } : (a.sutun ?? 0) === r.yeni ? { ...a, sutun: n } : a));
  return r;
}

/** Öğenin yatay aralığı (şablon koordinatı) */
function yatayAralik(o: any, icG: number): [number, number] {
  if (o.tip === "cizgi") return [Math.min(o.x1, o.x2), Math.max(o.x1, o.x2)];
  const x = o.x ?? 0;
  const g = o.tip === "qr" ? o.boyut : (o.g ?? (o.tip === "metin" ? icG - x : 60));
  return [x, x + g];
}

/**
 * Yazılı öğe uzayınca / kısalınca (satır ekleme, kolon başlığı, yazı boyutu) altındaki öğeler aynı miktar kayar;
 * öğeyi içine alan kutu da uzar. Böylece eklenen satır alttaki yazının üstüne binmez (bölüm 11, K15).
 */
export function alttakileriKaydir(eski: BelgeSablon, yeni: BelgeSablon, i: number): BelgeSablon {
  const a: any = eski.ogeler[i], b: any = yeni.ogeler[i];
  if (!a || !b || a.tip !== b.tip || !["metin", "satirlar", "tablo", "liste"].includes(b.tip)) return yeni;
  const vb = eski.yaziBoyutu ?? 8;
  const ka = ogeKutusu(a, vb), kb = ogeKutusu(b, vb);
  if (Math.abs(ka.ust - kb.ust) > 0.01) return yeni;
  const fark = kb.h - ka.h;
  if (Math.abs(fark) < 0.01) return yeni;
  const eskiAlt = ka.ust + ka.h;
  const icG = icGenislik(yeni);
  const [bx1, bx2] = yatayAralik(b, icG);
  const kes = (o: any) => { const [x1, x2] = yatayAralik(o, icG); return x1 < bx2 - 0.5 && bx1 < x2 - 0.5; };
  const y = kopya(yeni);
  y.ogeler.forEach((o: any, j) => {
    if (j === i || o.tip === "filigran" || !kes(o)) return;
    const yuvar = (v: number) => Math.max(0, Math.round(v * 100) / 100);
    if (o.tip === "cizgi") { if (Math.min(o.y1, o.y2) >= eskiAlt - 0.5) { o.y1 = yuvar(o.y1 + fark); o.y2 = yuvar(o.y2 + fark); } return; }
    if (o.y >= eskiAlt - 0.5) o.y = yuvar(o.y + fark);
    else if (o.tip === "kutu" && o.y <= ka.ust + 0.5 && o.y + o.h >= eskiAlt - 0.5) o.h = Math.max(1, Math.round((o.h + fark) * 100) / 100);
  });
  return y;
}

// ── Değer seçici: "Bilgi" (alan), "Hesap" (a işlem b), "Yazı" (sabit / serbest)

export type Islem = "+" | "-" | "*" | "/";
export type DegerParcasi =
  | { tur: "bilgi"; alan: string; bicim: string; on: string; son: string }
  | { tur: "hesap"; a: string; islem: Islem; b: string; bicim: string; on: string; son: string }
  | { tur: "yazi"; metin: string };

/** Kullanıcıya gösterilen biçim adları ("" = olduğu gibi). */
export const BICIM_ADLARI: [string, string][] = [
  ["", "Olduğu gibi"], ["tl", "Tutar (TL kuruş ayarı)"], ["doviz", "Döviz (kuruş ayarı)"], ["sayi", "Sayı, 2 hane"],
  ["sayi:0", "Tam sayı"], ["sayi:3", "Sayı, 3 hane"], ["sayi4", "Sayı, 4 hane"], ["kurb", "Kur (firma ayarı)"], ["kur", "Kur (5 hane)"], ["buyuk", "BÜYÜK HARF"],
];
export const ISLEM_ADLARI: [Islem, string][] = [["+", "+ topla"], ["-", "− çıkar"], ["*", "× çarp"], ["/", "÷ böl"]];

const BILGI_PARCA = /^([^{}]*)\{\{\s*([A-Za-z_][\w.]*)\s*(?:\|\s*([\w:]+)\s*)?\}\}([^{}]*)$/;
const HESAP_PARCA = /^([^{}]*)\{\{=\s*(\S+)\s*([+\-*/])\s*(\S+?)\s*(?:\|\s*([\w:]+)\s*)?\}\}([^{}]*)$/;

/** Değer metnini parçalarına ayırır; tek alan ya da tek hesap içermiyorsa "yazi". */
export function degerCoz(metin: string): DegerParcasi {
  const m = String(metin ?? "");
  const h = HESAP_PARCA.exec(m);
  if (h) return { tur: "hesap", on: h[1], a: h[2], islem: h[3] as Islem, b: h[4], bicim: h[5] ?? "", son: h[6] };
  const b = BILGI_PARCA.exec(m);
  if (b) return { tur: "bilgi", on: b[1], alan: b[2], bicim: b[3] ?? "", son: b[4] };
  return { tur: "yazi", metin: m };
}
/** Parçalardan değer metni kurar (sayıda virgül noktaya çevrilir). */
export function degerKur(p: DegerParcasi): string {
  if (p.tur === "yazi") return p.metin;
  if (p.tur === "bilgi") return p.alan ? `${p.on}{{${p.alan}${p.bicim ? `|${p.bicim}` : ""}}}${p.son}` : `${p.on}${p.son}`;
  const terim = (t: string) => String(t || "0").trim().replace(",", ".");
  return `${p.on}{{= ${terim(p.a)} ${p.islem} ${terim(p.b)}${p.bicim ? ` | ${p.bicim}` : ""}}}${p.son}`;
}

// ── "Ne zaman görünsün" (koşul)

export type KosulSecimi = { mod: "her" } | { mod: "dolu" | "bos"; alan: string } | { mod: "ozel"; metin: string };
export function kosulCoz(kosul: string | undefined): KosulSecimi {
  const k = String(kosul ?? "").trim();
  if (!k) return { mod: "her" };
  const m = /^(!?)\{\{\s*([A-Za-z_][\w.]*)\s*\}\}$/.exec(k);
  if (m) return { mod: m[1] ? "bos" : "dolu", alan: m[2] };
  return { mod: "ozel", metin: k };
}
export function kosulKur(k: KosulSecimi): string | undefined {
  if (k.mod === "her") return undefined;
  if (k.mod === "ozel") return k.metin.trim() || undefined;
  return k.alan ? `${k.mod === "bos" ? "!" : ""}{{${k.alan}}}` : undefined;
}

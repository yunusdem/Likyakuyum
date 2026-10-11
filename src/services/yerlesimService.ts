import { adSadelestir, cssSiralari, etkinSira, kimlikAta } from "../utils/girisSirasi";
import { alanEtiketi, ekranAdi, girisSirasiService, yerlesimAnahtari } from "./girisSirasiService";

/**
 * Sürükle-bırak yerleşim (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, 4b · Y1–Y6).
 *
 * Kutu: etiketi ve giriş alanı olan blok (Form.Group, "label + input" div'i, onay kutusu …).
 * Bölüm: birden çok kutunun ortak üst elemanı (Sarraf fişi üst satırı, Döviz fişi sütunu, kartın Row'u …).
 * Kutular yalnız kendi bölümünde yer değiştirir; yer değişimi CSS `order` iledir — React'in DOM'una ve sayfanın
 * koduna dokunulmaz. Tablolar (satır içi alanlar) yerleşime girmez.
 */

/** Kutu belirteci: giriş alanı ya da form denetimi (salt okunur görüntü kutuları da taşınır) */
const ALAN = 'input:not([type="hidden"]), select, textarea, .form-control, .form-select, .form-check';
const ETIKET = "label, .form-label";
const KOK = "[data-sayfa-icerik], [data-ekran], .modal, body";

export interface Birim {
  /** kutu elemanı (bölümün doğrudan çocuğu) */
  kutu: HTMLElement;
  /** kalıcı ad (ekran içinde tekil) */
  ad: string;
  etiket: string;
}
export interface Bolum {
  el: HTMLElement;
  /** bölümdeki kutular, ekrandaki (DOM) dizilişle */
  birimler: Birim[];
}

const alanIceriyor = (el: Element) => el.matches(ALAN) || !!el.querySelector(ALAN);
const etiketSayisi = (el: Element) => el.querySelectorAll(ETIKET).length + (el.matches(ETIKET) ? 1 : 0);

/**
 * Alan elemanından yukarı çıkarak kutusunu ve bölümünü bulur. Bölüm: alan içeren en az iki çocuğu ve en az iki etiketi
 * olan ilk üst eleman (tek etiketli üst eleman, birden çok girişli tek kutudur — ör. Tarih + Saat).
 */
export function kutuBul(alan: Element): { kutu: HTMLElement; bolum: HTMLElement } | null {
  if (alan.closest("table, .modal")) return null;
  let a = alan as HTMLElement;
  while (a.parentElement) {
    const p = a.parentElement;
    const alanliCocuk = Array.from(p.children).filter(alanIceriyor).length;
    if (alanliCocuk >= 2 && etiketSayisi(p) >= 2) return { kutu: a, bolum: p };
    if (p.matches(KOK)) return null;
    a = p;
  }
  return null;
}

const kokEleman = (ekran: string): HTMLElement | null => {
  const acik = Array.from(document.querySelectorAll<HTMLElement>("[data-ekran]")).find((e) => e.dataset.ekran === ekran);
  return acik || document.querySelector<HTMLElement>("[data-sayfa-icerik]");
};

const kutuEtiketi = (kutu: HTMLElement): string => {
  const l = kutu.matches(ETIKET) ? kutu : kutu.querySelector(ETIKET);
  const metin = (l?.textContent || "").replace(/\s+/g, " ").replace(/[\s:*]+$/, "").trim();
  if (metin) return metin;
  const g = kutu.matches(ALAN) ? kutu : kutu.querySelector<HTMLElement>(ALAN);
  return g ? alanEtiketi(g as HTMLElement) : "";
};

/** Ekrandaki bölümler ve kutuları (gizli sekmelerdekiler dahil; adlar bunlara göre sayılır, sabit kalır) */
export function bolumleriBul(ekran: string): Bolum[] {
  const kok = kokEleman(ekran);
  if (!kok) return [];
  const bolumler = new Map<HTMLElement, Set<HTMLElement>>();
  kok.querySelectorAll(ALAN).forEach((alan) => {
    if (ekranAdi(alan) !== ekran) return;
    const k = kutuBul(alan);
    if (!k || !kok.contains(k.bolum)) return;
    if (!bolumler.has(k.bolum)) bolumler.set(k.bolum, new Set());
    bolumler.get(k.bolum)!.add(k.kutu);
  });
  // Bölümler ve kutular ekrandaki dizilişte; adlar ekran genelinde tekil (aynı etiketin ikincisine .2)
  const sirali = Array.from(bolumler.entries()).sort(([a], [b]) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const hepsi: { bolum: HTMLElement; kutu: HTMLElement; etiket: string }[] = [];
  for (const [bolum, kutular] of sirali) {
    for (const kutu of Array.from(bolum.children) as HTMLElement[]) if (kutular.has(kutu)) hepsi.push({ bolum, kutu, etiket: kutuEtiketi(kutu) });
  }
  const adlar = kimlikAta(hepsi.map((h) => ({ taban: adSadelestir(h.etiket) ? `k.${adSadelestir(h.etiket, 50)}` : null, grup: null })));
  const sonuc: Bolum[] = [];
  hepsi.forEach((h, i) => {
    const ad = adlar[i];
    if (!ad) return; // adı çıkarılamayan kutu yerinde kalır
    let b = sonuc.find((x) => x.el === h.bolum);
    if (!b) sonuc.push((b = { el: h.bolum, birimler: [] }));
    b.birimler.push({ kutu: h.kutu, ad, etiket: h.etiket });
  });
  return sonuc.filter((b) => b.birimler.length >= 2);
}

const ISARET = "data-gs-yer";
const BLOK = "data-gs-blok";

/** Bir bölüme kutu dizilişini uygular (adlar listesi = istenen sıra; listede olmayan kutu yerinde kalır) */
function bolumeUygula(b: Bolum, adSirasi: string[]): void {
  const cocuklar = Array.from(b.el.children) as HTMLElement[];
  const yerler = b.birimler.map((x) => cocuklar.indexOf(x.kutu));
  const dizilis = etkinSira(b.birimler.map((x) => ({ alan: x.ad })), adSirasi.map((alan) => ({ alan, atla: false })));
  const sira = cssSiralari(cocuklar.length, yerler, dizilis);
  if (!sira) return bolumuTemizle(b.el);
  // Blok bölüm (ör. alt alta Form.Group'lar) sıralanabilmek için dikey flex olur; zaten flex/grid ise dokunulmaz
  const gorunum = getComputedStyle(b.el).display;
  if (!b.el.hasAttribute(BLOK) && !/flex|grid/.test(gorunum)) {
    b.el.setAttribute(BLOK, "1");
    b.el.style.display = "flex";
    b.el.style.flexDirection = "column";
  }
  cocuklar.forEach((c, i) => {
    c.style.order = String(sira[i]);
    c.setAttribute(ISARET, "1");
  });
}

function bolumuTemizle(el: HTMLElement): void {
  (Array.from(el.children) as HTMLElement[]).forEach((c) => {
    if (c.hasAttribute(ISARET)) {
      c.style.order = "";
      c.removeAttribute(ISARET);
    }
  });
  if (el.hasAttribute(BLOK)) {
    el.style.display = "";
    el.style.flexDirection = "";
    el.removeAttribute(BLOK);
  }
}

/** Ekrandaki bütün yerleşim işaretlerini kaldırır */
export function yerlesimiTemizle(ekran: string): void {
  const kok = kokEleman(ekran);
  kok?.querySelectorAll<HTMLElement>(`[${ISARET}]`).forEach((c) => c.parentElement && bolumuTemizle(c.parentElement));
  kok?.querySelectorAll<HTMLElement>(`[${BLOK}]`).forEach(bolumuTemizle);
}

/** Verilen ad sırasını (ya da kullanıcının kayıtlı yerleşimini) ekrana uygular */
export function yerlesimUygula(ekran: string, adSirasi?: string[]): void {
  const sira = adSirasi ?? (girisSirasiService.kayit(yerlesimAnahtari(ekran)) || []).map((k) => k.alan);
  if (!sira.length) return yerlesimiTemizle(ekran);
  for (const b of bolumleriBul(ekran)) bolumeUygula(b, sira);
}

/** Bölümdeki kutuların şu anki görünür sırası (adlar) */
export function bolumSirasi(b: Bolum): string[] {
  const o = (k: HTMLElement) => (k.style.order === "" ? Array.from(b.el.children).indexOf(k) : Number(k.style.order));
  return [...b.birimler].sort((x, y) => o(x.kutu) - o(y.kutu)).map((x) => x.ad);
}

/**
 * Enter için görünür diziliş: aynı bölümdeki iki alanın sırası kutularının CSS sırasına göre, gerisi ekrandaki (DOM)
 * dizilişe göre. Kutular bölüm içinde bitişik olduğundan karşılaştırma tutarlıdır.
 */
export function gorunurSirala(els: HTMLElement[]): HTMLElement[] {
  const bilgi = new Map<HTMLElement, { kutu: HTMLElement; bolum: HTMLElement } | null>();
  const bul = (el: HTMLElement) => {
    if (!bilgi.has(el)) bilgi.set(el, kutuBul(el));
    return bilgi.get(el)!;
  };
  const sira = (k: HTMLElement) => (k.style.order === "" ? Array.from(k.parentElement!.children).indexOf(k) : Number(k.style.order));
  return [...els].sort((a, b) => {
    if (a === b) return 0;
    const ka = bul(a);
    const kb = bul(b);
    if (ka && kb && ka.bolum === kb.bolum && ka.kutu !== kb.kutu) return sira(ka.kutu) - sira(kb.kutu);
    return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });
}

/** Ekranın kayıtlı yerleşimi var mı */
export const yerlesimVarMi = (ekran: string | null): boolean => !!ekran && !!girisSirasiService.kayit(yerlesimAnahtari(ekran))?.length;

export const YERLESIM_OLAYI = "erp-yerlesim-duzenle";
export const yerlesimDuzenle = (ekran: string) => window.dispatchEvent(new CustomEvent(YERLESIM_OLAYI, { detail: { ekran } }));

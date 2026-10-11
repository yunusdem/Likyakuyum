import { apiClient } from "./apiClient";
import { SiraAlani, SiraOgesi, adSadelestir, ilkKonum, kimlikAta, sonrakiKonum, yolEkranAdi } from "../utils/girisSirasi";

/**
 * Kullanıcıya özel giriş sırası (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K3–K5).
 * Kullanıcının bütün ekran sıraları bir kez yüklenip bellekte tutulur; Enter anında sunucuya gidilmez.
 * Oturum (kullanıcı + veritabanı) değişince yeniden yüklenir.
 */

const TOKEN_ANAHTARI = "kuyumcu_erp_access_token";

let yuklenenOturum: string | null = null;
let siralar: Record<string, SiraAlani[]> = {};
let suruyor: Promise<void> | null = null;
const dinleyiciler = new Set<() => void>();

/** Token'dan oturum anahtarı (kullanıcı + veritabanı); token yenilenince değişmez */
function oturumAnahtari(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_ANAHTARI);
    if (!token) return null;
    const govde = token.split(".")[1];
    if (!govde) return null;
    const p = JSON.parse(atob(govde.replace(/-/g, "+").replace(/_/g, "/")));
    return p?.userId ? `${p.userId}@${p.dbServer || ""}/${p.dbName || ""}` : null;
  } catch {
    return null;
  }
}

export const girisSirasiService = {
  /** Sıralar bu oturum için yüklü değilse yükler (hata sessizdir: kayıt yoksa ekranın kendi sırası geçerli) */
  hazirla(): Promise<void> {
    const oturum = oturumAnahtari();
    if (!oturum) {
      yuklenenOturum = null;
      siralar = {};
      return Promise.resolve();
    }
    if (oturum === yuklenenOturum) return Promise.resolve();
    if (suruyor) return suruyor;
    suruyor = apiClient
      .get<Record<string, SiraAlani[]>>("/giris-sirasi")
      .then((r) => {
        siralar = r.data || {};
        yuklenenOturum = oturum;
        dinleyiciler.forEach((f) => f());
      })
      .catch(() => undefined)
      .finally(() => {
        suruyor = null;
      });
    return suruyor;
  },

  /** Ekranın kaydı (yoksa undefined). Oturum değiştiyse eski kayıt kullanılmaz. */
  kayit(ekran: string): SiraAlani[] | undefined {
    if (yuklenenOturum !== oturumAnahtari()) {
      void this.hazirla();
      return undefined;
    }
    return siralar[ekran];
  },

  async kaydet(ekran: string, alanlar: SiraAlani[]): Promise<void> {
    await apiClient.put(`/giris-sirasi/${encodeURIComponent(ekran)}`, { alanlar });
    siralar = { ...siralar, [ekran]: alanlar };
    dinleyiciler.forEach((f) => f());
  },

  async sifirla(ekran: string): Promise<void> {
    await apiClient.delete(`/giris-sirasi/${encodeURIComponent(ekran)}`);
    const { [ekran]: _, ...kalan } = siralar;
    siralar = kalan;
    dinleyiciler.forEach((f) => f());
  },

  dinle(f: () => void): () => void {
    dinleyiciler.add(f);
    return () => dinleyiciler.delete(f);
  },
};

/** Alanın atlanamaz olup olmadığı: HTML required, aria-required ya da data-zorunlu */
export const zorunluMu = (el: Element): boolean =>
  (el as HTMLInputElement).required === true || el.getAttribute("aria-required") === "true" || el.getAttribute("data-zorunlu") === "true";

/** Sayfa içeriği (App.tsx <main>): açık data-ekran verilmemiş alanlar sayfanın adresiyle bir ekran sayılır */
const SAYFA_KOKU = "[data-sayfa-icerik]";

/** Elemanın bağlı olduğu ekran: en yakın data-ekran; yoksa sayfa içeriğindeyse sayfanın adresi. Pencereler (modal) hariç. */
export function ekranAdi(el: Element | null): string | null {
  if (!el || typeof el.closest !== "function") return null;
  const acik = el.closest<HTMLElement>("[data-ekran]");
  if (acik) return acik.dataset.ekran || null;
  if (el.closest(".modal")) return null;
  return el.closest(SAYFA_KOKU) ? yolEkranAdi(window.location.pathname) : null;
}

/** Ekranın kök elemanı */
function ekranKoku(ekran: string): HTMLElement | null {
  const acik = Array.from(document.querySelectorAll<HTMLElement>("[data-ekran]")).find((e) => e.dataset.ekran === ekran);
  if (acik) return acik;
  return ekran === yolEkranAdi(window.location.pathname) ? document.querySelector<HTMLElement>(SAYFA_KOKU) : null;
}

/** Ayar penceresini açar (sağ tık menüsü, araç çubuğu) */
export const GIRIS_SIRASI_OLAYI = "erp-giris-sirasi";
export const girisSirasiAc = (ekran: string) => window.dispatchEvent(new CustomEvent(GIRIS_SIRASI_OLAYI, { detail: { ekran } }));

/** Odaklanabilir giriş alanları (genel Enter işleyişiyle aynı seçici) */
export const GIRIS_ALANI_SECICI =
  'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]):not([readonly])';
const gorunur = (el: HTMLElement) => el.offsetParent !== null && !el.hasAttribute("aria-hidden");

/** Sayfada sırası ayarlanabilen ekran var mı (araç çubuğu düğmesi için) */
export const siraliEkranVarMi = (): boolean =>
  !!document.querySelector("[data-ekran]") || !!document.querySelector(`${SAYFA_KOKU} input:not([type="hidden"]), ${SAYFA_KOKU} select`);

/** Sayfadaki ayarlanabilir ekran (araç çubuğundan açılırken; imleç bir ekrandaysa o) */
export function etkinEkran(): string | null {
  return (
    ekranAdi(document.activeElement) ||
    document.querySelector<HTMLElement>("[data-ekran]")?.dataset.ekran ||
    (document.querySelector(SAYFA_KOKU) ? yolEkranAdi(window.location.pathname) : null)
  );
}

const temizEtiket = (s: string | null | undefined) => String(s ?? "").replace(/\s+/g, " ").replace(/[\s:*]+$/, "").trim();

/** Alanın kullanıcıya görünen adı: data-etiket → <label for> → tablo başlığı → aynı gruptaki etiket → aria-label / placeholder */
export function alanEtiketi(el: HTMLElement): string {
  if (el.dataset.etiket) return temizEtiket(el.dataset.etiket);
  if (el.id) {
    const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (l?.textContent?.trim()) return temizEtiket(l.textContent);
  }
  const td = el.closest("td");
  if (td) {
    const tablo = td.closest("table");
    const i = Array.from(td.parentElement?.children || []).indexOf(td);
    const th = tablo?.querySelectorAll("thead tr:last-child th")[i];
    if (th?.textContent?.trim()) return temizEtiket(th.textContent);
  }
  const grup = el.closest(".form-group, .input-group, .mb-1, .mb-2, .mb-3, .row");
  const l = grup?.querySelector("label, .form-label");
  if (l?.textContent?.trim()) return temizEtiket(l.textContent);
  return temizEtiket(el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("title"));
}

/**
 * Alanın taban adı: data-alan (açık verilen) → name → kalıcı id → görünen etiket. Sunucu biçimine indirgenir;
 * bulunamazsa null (alan adsızdır, sıralanmaz, ekrandaki yerinde kalır).
 */
function alanTabani(el: HTMLElement): string | null {
  const acik = el.getAttribute("data-alan");
  if (acik) return acik;
  // Tablo hücresinde sütun başlığı önce gelir: id / name çoğu zaman satır numarası taşır, satırlar aynı adı almalı
  if (el.closest("td")) {
    const sutun = adSadelestir(alanEtiketi(el));
    if (sutun) return `e.${sutun}`;
  }
  const ad = adSadelestir(el.getAttribute("name"));
  if (ad) return `n.${ad}`;
  // React'in ürettiği (":r1:") ya da sayı içeren geçici kimlikler kalıcı değildir
  if (el.id && !el.id.includes(":") && !/\d{4,}/.test(el.id)) {
    const id = adSadelestir(el.id);
    if (id) return `i.${id}`;
  }
  const etiket = adSadelestir(alanEtiketi(el));
  return etiket ? `e.${etiket}` : null;
}

/** Aynı ekrandaki elemanlara kimlik ver (aynı satırda tekrar eden adlara .2, .3) */
function kimlikler(els: HTMLElement[], ekran: string): (string | null)[] {
  return kimlikAta(els.map((el) => ({ taban: ekranAdi(el) === ekran ? alanTabani(el) : null, grup: el.closest("tr") })));
}

export interface EkranAlani {
  alan: string;
  etiket: string;
  zorunlu: boolean;
}

/** Ekranın görünür giriş alanları ve kimlikleri (Enter işleyişi ve pencere aynı sayımı kullanır) */
function ekranKimlikleri(ekran: string): { els: HTMLElement[]; adlar: (string | null)[] } {
  const kok = ekranKoku(ekran);
  const els = kok ? Array.from(kok.querySelectorAll<HTMLElement>(GIRIS_ALANI_SECICI)).filter(gorunur) : [];
  return { els, adlar: kimlikler(els, ekran) };
}

/** Ekrandaki görünür, adlı alanlar ekrandaki dizilişle (pencereler ve iç içe başka ekranlar hariç, ad başına bir kez) */
export function ekranAlanlari(ekran: string): EkranAlani[] {
  const { els, adlar } = ekranKimlikleri(ekran);
  const sonuc: EkranAlani[] = [];
  const etiketSayisi = new Map<string, number>();
  els.forEach((el, i) => {
    const alan = adlar[i];
    if (!alan || sonuc.some((x) => x.alan === alan)) return;
    const etiket = alanEtiketi(el) || el.getAttribute("name") || alan;
    const n = (etiketSayisi.get(etiket) || 0) + 1;
    etiketSayisi.set(etiket, n);
    // Aynı etiketli ikinci alan pencerede ayırt edilebilsin
    sonuc.push({ alan, etiket: n === 1 ? etiket : `${etiket} (${n})`, zorunlu: zorunluMu(el) });
  });
  return sonuc;
}

/** Hedefin ekranında kullanıcının kayıtlı sırası varsa ekran adı */
export function kayitliEkran(hedef: Element): string | null {
  const ekran = ekranAdi(hedef);
  return ekran && girisSirasiService.kayit(ekran)?.length ? ekran : null;
}

/** Kendi Enter işleyişi olan sayfalarda kullanıcının sırasını koruma süresi (ms) */
export const KORUMA_SURESI = 300;

/**
 * Kendi Enter işleyişi olan sayfalar (Sarraf / Perakende / Döviz fişi, Cari Hareket, ürün tanımları …) Enter'da
 * odağı kendi zincirlerindeki alana taşır. Kullanıcının bu ekran için sırası varsa, Enter'dan sonraki kısa sürede
 * sayfa odağı var olan başka bir alana taşırsa kullanıcının sıradaki alanına geri alınır. Sayfa özel bir iş yaptıysa
 * (pencere açtı, yeni satır ekledi, başka ekrana geçti, odağı aynı alanda tuttu, uzun süren arama) karışılmaz:
 * sayfanın kod mantığı aynen geçerlidir. (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, Faz 9)
 */
export function sirayiKoru(hedef: HTMLElement, sonraki: HTMLElement, ekran: string, adaylar: HTMLElement[]): void {
  const mevcut = new Set(adaylar);
  const bitis = performance.now() + KORUMA_SURESI;
  let geriAlma = 0;
  const birak = () => document.removeEventListener("focusin", dinle, true);
  function dinle(e: FocusEvent) {
    const a = e.target as HTMLElement;
    if (performance.now() > bitis) return birak();
    if (a === sonraki) return;
    // Odağı aynı alanda tuttu (ör. doğrulama) ya da özel bir iş yaptı: sayfaya bırak
    if (a === hedef || !(a instanceof HTMLElement) || a.closest(".modal") || !mevcut.has(a) || ekranAdi(a) !== ekran) return birak();
    if (++geriAlma > 2) return birak();
    setTimeout(() => {
      if (document.activeElement !== a || !sonraki.isConnected) return;
      sonraki.focus();
      if (sonraki instanceof HTMLInputElement && !["date", "checkbox", "radio"].includes(sonraki.type)) {
        try {
          sonraki.select();
        } catch {
          /* seçilemeyen tür */
        }
      }
    }, 0);
  }
  document.addEventListener("focusin", dinle, true);
  setTimeout(birak, KORUMA_SURESI + 20);
}

/**
 * Enter ile gidilecek sonraki eleman. `adaylar` ekrandaki dizilişte, odaklanabilir ve görünür alanlardır
 * (genel Enter işleyişinin bulduğu liste). Kayıt yoksa bir sonraki aday döner — bugünkü davranış.
 * Ekranın kendi Enter işleyişi olan sayfalar da kendi aday listeleriyle bunu çağırır.
 */
export function girisSirasiSonraki(hedef: HTMLElement, adaylar: HTMLElement[]): HTMLElement | null {
  const mevcut = adaylar.indexOf(hedef);
  if (mevcut < 0) return null;
  const ekran = ekranAdi(hedef);
  const kayit = ekran ? girisSirasiService.kayit(ekran) : undefined;
  if (!ekran || !kayit?.length) return mevcut < adaylar.length - 1 ? adaylar[mevcut + 1] : null;
  // Satırlı tablolarda aynı alan her satırda tekrar eder: sıra yalnızca hedefin satırında uygulanır
  const satir = hedef.closest("tr");
  const { els, adlar } = ekranKimlikleri(ekran);
  const ad = new Map(els.map((el, i) => [el, adlar[i]]));
  const ogeler: SiraOgesi[] = adaylar.map((el) => ({
    // başka ekrana ya da başka satıra ait alanlar sıralanmaz, yerinde kalır
    alan: el.closest("tr") === satir ? ad.get(el) ?? null : null,
    zorunlu: zorunluMu(el),
  }));
  const i = sonrakiKonum(ogeler, mevcut, kayit);
  if (i === null) return null;
  // Yeni bir satıra geçiliyorsa (başlıktan ya da önceki satırdan) o satıra kullanıcının sırasındaki ilk hücreden girilir
  const yeniSatir = adaylar[i].closest("tr");
  if (yeniSatir && yeniSatir !== satir) {
    const satirdakiler = adaylar.filter((el) => el.closest("tr") === yeniSatir);
    const ilk = ilkKonum(satirdakiler.map((el) => ({ alan: ad.get(el) ?? null, zorunlu: zorunluMu(el) })), kayit);
    if (ilk !== null) return satirdakiler[ilk];
  }
  return adaylar[i];
}
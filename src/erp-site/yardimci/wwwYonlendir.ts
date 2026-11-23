/**
 * likyaerp.com (www'siz) uygulama alan adıdır; tanıtım sitesi www.likyaerp.com'da kendi stiliyle (erp.css) çalışır. Uygulama bu alan adında
 * tanıtım yollarını açınca sayfa stilsiz kalıyordu (23.11.2026). Tanıtım yolu www'ye geçirilir; uygulama adresleri (/login …) ve masaüstüne
 * yüklenmiş uygulama penceresi yönlendirilmez. index.html'deki erken betik (uygulama dosyası inmeden çalışır) aynı kuralı uygular.
 */

/** Tanıtım sitesinin yolları (App.tsx'teki ErpDuzen altındaki yollar) */
export const TANITIM_YOLU = /^\/(urunler\/[^/]+|karsilastir|entegrasyonlar|hakkimizda|iletisim|kvkk|gizlilik)?\/?$/i;

/** Masaüstüne / ana ekrana yüklenmiş uygulama penceresi mi (main.tsx ile aynı denetim) */
export const uygulamaPenceresiMi = (): boolean =>
  typeof window !== "undefined" &&
  (["standalone", "window-controls-overlay", "minimal-ui"].some((m) => window.matchMedia?.(`(display-mode: ${m})`).matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

/** Geçilecek www adresi; bu alan adı / yol / pencere için yönlendirme yoksa null. */
export const wwwAdresi = (konum: { hostname: string; pathname: string; search: string; hash: string }, uygulamaPenceresi: boolean): string | null => {
  if (konum.hostname.toLowerCase() !== "likyaerp.com" || uygulamaPenceresi || !TANITIM_YOLU.test(konum.pathname)) return null;
  return `https://www.likyaerp.com${konum.pathname}${konum.search}${konum.hash}`;
};

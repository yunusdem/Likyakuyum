/**
 * Google Analytics 4 altyapısı (docs/LIKYAERP_TANITIM_SITESI.md K11).
 * VITE_ERP_GA_ID tanımlı değilse hiçbir şey yüklenmez; tanımlanınca build yeterlidir, kod değişmez.
 * Search Console doğrulaması vite.erp.config.ts içinde (VITE_ERP_GSC_DOGRULAMA) statik HTML'e yazılır.
 */
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = ((import.meta as any).env?.VITE_ERP_GA_ID as string | undefined)?.trim();

let kuruldu = false;

export const analitikKur = () => {
  if (!GA_ID || kuruldu || typeof document === "undefined") return;
  kuruldu = true;
  const betik = document.createElement("script");
  betik.async = true;
  betik.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(betik);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag, arguments nesnesini bekler
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
  // Sayfa görüntülemeyi yönlendirici değişiminde biz göndeririz
  window.gtag("config", GA_ID, { send_page_view: false, anonymize_ip: true });
};

export const sayfaGoruntulendi = (yol: string) => {
  if (!GA_ID || !window.gtag) return;
  window.gtag("event", "page_view", { page_path: yol, page_location: window.location.href, page_title: document.title });
};

/** Form gönderimi gibi dönüşümler */
export const olayGonder = (ad: string, veri: Record<string, unknown> = {}) => {
  if (!GA_ID || !window.gtag) return;
  window.gtag("event", ad, veri);
};

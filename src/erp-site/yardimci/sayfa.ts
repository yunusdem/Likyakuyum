import { useEffect } from "react";
import { SIRKET } from "../veri/sirket";

/**
 * Sayfa başlığı, açıklaması ve kanonik adresi (SEO). Her sayfa kendi değerini verir;
 * erp.html'deki varsayılanlar ilk yüklemede arama motoruna gider.
 */
const metaYaz = (secici: string, nitelik: "name" | "property", ad: string, deger: string) => {
  let etiket = document.head.querySelector<HTMLMetaElement>(secici);
  if (!etiket) {
    etiket = document.createElement("meta");
    etiket.setAttribute(nitelik, ad);
    document.head.appendChild(etiket);
  }
  etiket.setAttribute("content", deger);
};

export const useSayfa = (baslik: string, aciklama: string, yol: string) => {
  useEffect(() => {
    const tam = yol === "/" ? baslik : `${baslik} | Likya ERP`;
    document.title = tam;
    metaYaz('meta[name="description"]', "name", "description", aciklama);
    metaYaz('meta[property="og:title"]', "property", "og:title", tam);
    metaYaz('meta[property="og:description"]', "property", "og:description", aciklama);
    metaYaz('meta[property="og:url"]', "property", "og:url", `${SIRKET.site}${yol}`);
    let kanonik = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!kanonik) {
      kanonik = document.createElement("link");
      kanonik.rel = "canonical";
      document.head.appendChild(kanonik);
    }
    kanonik.href = `${SIRKET.site}${yol}`;
  }, [baslik, aciklama, yol]);
};

import React from "react";
import { useSearchParams } from "react-router-dom";
import { useSayfa } from "../yardimci/sayfa";
import { URUNLER } from "../veri/urunler";
import { CagriBolumu } from "../bilesenler/Ortak";

/** /iletisim?urun=likya-doviz gibi bağlantılarda form o ürünle açılır. */
export const Iletisim: React.FC = () => {
  useSayfa(
    "İletişim & Demo",
    "Likya ürünleri için ücretsiz demo ve teklif isteyin. Telefon, WhatsApp ya da e-posta ile bize ulaşın.",
    "/iletisim"
  );
  const [arama] = useSearchParams();
  const urun = URUNLER.find((u) => u.slug === arama.get("urun"))?.kod;
  return (
    <>
      <section className="sayfa-bas">
        <div className="k">
          <span className="ust-baslik">İletişim</span>
          <h1>Demo isteyin, teklif alın, soru sorun</h1>
          <p>Hangi ürünle ilgilendiğinizi seçin; ekibimiz en kısa sürede sizi arasın. Acil konular için telefon ve WhatsApp.</p>
        </div>
      </section>
      <CagriBolumu urun={urun} baslik="Bize ulaşın" aciklama="Hafta içi mesai saatlerinde telefonla, her zaman WhatsApp ve e-posta ile." />
    </>
  );
};

export default Iletisim;

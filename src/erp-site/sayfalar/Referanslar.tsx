import React from "react";
import { IconBuildingStore, IconCircleCheck } from "@tabler/icons-react";
import { REFERANSLAR } from "../veri/sirket";
import { useSayfa } from "../yardimci/sayfa";
import { BolumBasligi, CagriBolumu } from "../bilesenler/Ortak";

export const Referanslar: React.FC = () => {
  useSayfa(
    "Referanslar",
    "Likya ERP ve Likya Kuyum çözümlerini güvenle kullanan referans kuyumculuk ve sarrafiye işletmeleri.",
    "/referanslar"
  );

  return (
    <>
      <section className="sayfa-bas">
        <div className="k">
          <span className="ust-baslik">Referanslarımız</span>
          <h1>Bizi tercih eden değerli işletmeler</h1>
          <p>
            Kuyumculuk, sarrafiye ve mücevherat sektöründe faaliyet gösteren iş ortaklarımız günlük operasyonlarını Likya altyapısıyla yönetiyor.
          </p>
        </div>
      </section>

      <section className="bolum">
        <div className="k">
          <BolumBasligi
            ust="İş Ortaklarımız"
            baslik="Likya kullanan seçkin kuyumcular"
            aciklama="Güvenilir vezne, stok, etiket ve e-belge süreçleriyle yanlarında olduğumuz referans işletmelerimiz."
            orta
          />
          <div className="izgara izgara-3">
            {REFERANSLAR.map((refAd, idx) => (
              <div key={refAd} className="kart" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <span
                    className="ikon-kutu"
                    style={{ "--u": "#0b1f3a", "--u-acik": "#eef2f7", flexShrink: 0 } as React.CSSProperties}
                  >
                    <IconBuildingStore size={22} aria-hidden="true" />
                  </span>
                  <div>
                    <small style={{ color: "var(--gri-2)", fontWeight: 600 }}>Referans #{idx + 1}</small>
                    <h3 style={{ margin: "2px 0 0" }}>{refAd}</h3>
                  </div>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#047857", fontSize: 13, fontWeight: 600 }}>
                  <IconCircleCheck size={16} aria-hidden="true" />
                  <span>Aktif Likya Kullanıcısı</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CagriBolumu />
    </>
  );
};

export default Referanslar;

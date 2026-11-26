import React from "react";
import { IconBrandWhatsapp, IconHeadset, IconPhone, IconUser } from "@tabler/icons-react";
import { DESTEK_EKIBI } from "../veri/sirket";
import { useSayfa } from "../yardimci/sayfa";
import { BolumBasligi, CagriBolumu } from "../bilesenler/Ortak";

export const DestekEkibi: React.FC = () => {
  useSayfa(
    "Destek Numaraları",
    "Likya ERP ve Likya Kuyum teknik destek ekibi iletişim numaraları ve WhatsApp destek hatları.",
    "/destek-ekibi"
  );

  return (
    <>
      <section className="sayfa-bas">
        <div className="k">
          <span className="ust-baslik">Destek Numaraları</span>
          <h1>Her zaman yanınızdayız</h1>
          <p>
            Kurulum, eğitim, cihaz bağlantıları ve günlük kullanım sorularınız için destek ekibimize telefon veya WhatsApp üzerinden doğrudan ulaşabilirsiniz.
          </p>
        </div>
      </section>

      <section className="bolum">
        <div className="k">
          <BolumBasligi
            ust="Doğrudan İletişim"
            baslik="Likya Destek Ekibi"
            aciklama="Aşağıdaki destek uzmanlarımızdan herhangi birini tek tıkla arayabilir veya WhatsApp'tan yazabilirsiniz."
            orta
          />
          <div className="izgara izgara-2">
            {DESTEK_EKIBI.map((uye) => (
              <div
                key={uye.ad}
                className="kart"
                style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 20 }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span
                    className="ikon-kutu"
                    style={{
                      "--u": "#0b1f3a",
                      "--u-acik": "#eef2f7",
                      width: 52,
                      height: 52,
                      flexShrink: 0,
                    } as React.CSSProperties}
                  >
                    <IconUser size={26} aria-hidden="true" />
                  </span>
                  <div>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#047857",
                        background: "#ecfdf5",
                        padding: "2px 10px",
                        borderRadius: 999,
                        marginBottom: 4,
                      }}
                    >
                      <IconHeadset size={13} aria-hidden="true" /> Teknik Destek Uzmanı
                    </span>
                    <h3 style={{ margin: "2px 0 4px" }}>{uye.ad}</h3>
                    <a
                      href={`tel:${uye.telefonHam}`}
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: "var(--lacivert)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {uye.telefon}
                    </a>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <a href={`tel:${uye.telefonHam}`} className="dugme dugme-ana dugme-kucuk" style={{ flex: 1 }}>
                    <IconPhone size={16} aria-hidden="true" /> Hemen Ara
                  </a>
                  <a
                    href={uye.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="dugme dugme-wa dugme-kucuk"
                    style={{ flex: 1 }}
                  >
                    <IconBrandWhatsapp size={16} aria-hidden="true" /> WhatsApp
                  </a>
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

export default DestekEkibi;

import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowLeft,
  IconBrandWhatsapp,
  IconHeadset,
  IconPhone,
  IconUser,
} from "@tabler/icons-react";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";
import { DESTEK_EKIBI } from "./iletisimBilgileri";
import "../../styles/LandingFurni.css";

export const LandingDestekEkibiPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="furni-wrapper min-vh-100 d-flex flex-column bg-white">
      <LandingNavbar />

      {/* Hero Banner */}
      <section
        className="text-white"
        style={{
          background: "linear-gradient(135deg, #2c4c41 0%, #1e352d 100%)",
          paddingTop: "120px",
          paddingBottom: "64px",
        }}
      >
        <div className="container text-center" style={{ maxWidth: "960px" }}>
          <span
            className="badge rounded-pill px-3 py-2 fw-bold text-uppercase mb-3 d-inline-flex align-items-center gap-1.5"
            style={{ backgroundColor: "rgba(249, 191, 41, 0.16)", color: "#f9bf29", fontSize: "0.78rem", letterSpacing: "1px" }}
          >
            <IconHeadset size={15} />
            Destek Numaraları
          </span>
          <h1 className="fw-bold mb-3" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)" }}>
            Likya <span style={{ color: "#f9bf29" }}>Destek Ekibi</span>
          </h1>
          <p className="mb-0 mx-auto" style={{ maxWidth: "680px", color: "rgba(255,255,255,0.8)", fontSize: "1.05rem" }}>
            Kurulum, eğitim ve günlük teknik destek ihtiyaçlarınız için ekibimize telefon veya WhatsApp üzerinden doğrudan ulaşabilirsiniz.
          </p>
        </div>
      </section>

      {/* Destek Ekibi Kartları */}
      <section className="py-5 flex-grow-1" style={{ backgroundColor: "#f8fbf9" }}>
        <div className="container py-3" style={{ maxWidth: "1080px" }}>
          <div className="row g-4">
            {DESTEK_EKIBI.map((uye) => (
              <div key={uye.ad} className="col-12 col-md-6">
                <div
                  className="h-100 bg-white rounded-4 border p-4 shadow-sm d-flex flex-column justify-content-between gap-3"
                  style={{ borderColor: "#e2ece7" }}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                      style={{
                        width: "56px",
                        height: "56px",
                        background: "linear-gradient(135deg, #2c4c41 0%, #1e352d 100%)",
                        color: "#f9bf29",
                      }}
                    >
                      <IconUser size={28} />
                    </div>
                    <div className="min-w-0">
                      <span className="badge rounded-pill mb-1" style={{ backgroundColor: "#ecfdf5", color: "#047857", fontSize: "0.72rem" }}>
                        Teknik Destek Uzmanı
                      </span>
                      <h2 className="h5 fw-bold text-dark mb-0">{uye.ad}</h2>
                      <a
                        href={`tel:${uye.telefonHam}`}
                        className="text-decoration-none fw-bold font-monospace d-inline-block mt-1"
                        style={{ fontSize: "1.05rem", color: "#2c4c41" }}
                      >
                        {uye.telefon}
                      </a>
                    </div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 pt-2 border-top">
                    <a
                      href={`tel:${uye.telefonHam}`}
                      className="btn flex-grow-1 fw-bold rounded-pill py-2 d-inline-flex align-items-center justify-content-center gap-2"
                      style={{ backgroundColor: "#2c4c41", color: "#ffffff", fontSize: "0.88rem" }}
                    >
                      <IconPhone size={17} />
                      Hemen Ara
                    </a>
                    <a
                      href={uye.whatsapp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn flex-grow-1 fw-bold rounded-pill py-2 d-inline-flex align-items-center justify-content-center gap-2 text-white"
                      style={{ backgroundColor: "#25D366", borderColor: "#25D366", fontSize: "0.88rem" }}
                    >
                      <IconBrandWhatsapp size={17} />
                      WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="d-flex flex-wrap align-items-center justify-content-center gap-3 mt-5">
            <Link to="/" className="btn btn-outline-secondary rounded-pill px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2">
              <IconArrowLeft size={16} />
              Ana Sayfaya Dön
            </Link>
            <Link
              to="/referanslar"
              className="btn rounded-pill px-4 py-2 fw-bold d-inline-flex align-items-center gap-2"
              style={{ backgroundColor: "#f9bf29", color: "#2c4c41" }}
            >
              Referanslarımızı İnceleyin
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default LandingDestekEkibiPage;

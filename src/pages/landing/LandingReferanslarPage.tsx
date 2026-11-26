import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  IconArrowLeft,
  IconBuildingStore,
  IconCheck,
  IconPhoneCall,
  IconSparkles,
} from "@tabler/icons-react";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";
import { ILETISIM, REFERANSLAR, TEL_LINK } from "./iletisimBilgileri";
import "../../styles/LandingFurni.css";

export const LandingReferanslarPage: React.FC = () => {
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
            <IconSparkles size={15} />
            Referanslarımız
          </span>
          <h1 className="fw-bold mb-3" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)" }}>
            Bizi Tercih Eden <span style={{ color: "#f9bf29" }}>Değerli İşletmeler</span>
          </h1>
          <p className="mb-0 mx-auto" style={{ maxWidth: "680px", color: "rgba(255,255,255,0.8)", fontSize: "1.05rem" }}>
            Türkiye genelinde güvenle hizmet veren kuyumcu ve sarrafiye işletmeleri operasyonlarını Likya Kuyum ile yönetiyor.
          </p>
        </div>
      </section>

      {/* Referans Kartları */}
      <section className="py-5 flex-grow-1" style={{ backgroundColor: "#f8fbf9" }}>
        <div className="container py-3" style={{ maxWidth: "1180px" }}>
          <div className="row g-4">
            {REFERANSLAR.map((refAd, idx) => (
              <div key={refAd} className="col-12 col-sm-6 col-lg-4">
                <div
                  className="h-100 bg-white rounded-4 border p-4 shadow-sm d-flex flex-column justify-content-between"
                  style={{ borderColor: "#e2ece7", transition: "transform 0.18s ease, box-shadow 0.18s ease" }}
                >
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div
                      className="d-inline-flex align-items-center justify-content-center rounded-3 flex-shrink-0"
                      style={{
                        width: "52px",
                        height: "52px",
                        background: "linear-gradient(135deg, #2c4c41 0%, #1e352d 100%)",
                        color: "#f9bf29",
                      }}
                    >
                      <IconBuildingStore size={26} />
                    </div>
                    <div className="min-w-0">
                      <div className="small text-muted fw-semibold">Referans #{idx + 1}</div>
                      <h2 className="h5 fw-bold text-dark mb-0">{refAd}</h2>
                    </div>
                  </div>
                  <div className="d-flex align-items-center gap-1.5 small fw-semibold" style={{ color: "#047857" }}>
                    <IconCheck size={16} />
                    <span>Aktif Likya Kullanıcısı</span>
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
              to="/destek-ekibi"
              className="btn rounded-pill px-4 py-2 fw-bold d-inline-flex align-items-center gap-2"
              style={{ backgroundColor: "#2c4c41", color: "#ffffff" }}
            >
              Destek Ekibimizle İletişime Geçin
            </Link>
            <a
              href={TEL_LINK}
              className="btn rounded-pill px-4 py-2 fw-bold d-inline-flex align-items-center gap-2"
              style={{ backgroundColor: "#f9bf29", color: "#2c4c41" }}
            >
              <IconPhoneCall size={17} />
              {ILETISIM.telefon}
            </a>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};

export default LandingReferanslarPage;

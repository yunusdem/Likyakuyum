import React from "react";
import { useNavigate } from "react-router-dom";
import { IconArrowRight } from "@tabler/icons-react";

/**
 * Sistemin kök adresinde ("/") açılan karşılama sayfası.
 * Solda kısa tanıtım, sağda giriş sayfasına yönlendiren buton.
 */
export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-vh-100 w-100 d-flex align-items-center justify-content-center p-3 p-md-4 landing-page-wrapper"
      style={{
        background: "linear-gradient(135deg, #faf7f2 0%, #f3ede2 50%, #f7f3ea 100%)",
        fontFamily: "'Segoe UI', 'Inter', -apple-system, sans-serif",
      }}
    >
      <style>{`
        .landing-login-btn {
          background: linear-gradient(135deg, #c88f18 0%, #9e640b 100%) !important;
          color: #ffffff !important;
          box-shadow: 0 4px 12px rgba(184, 123, 25, 0.28) !important;
          border: none !important;
          transition: all 0.2s ease !important;
        }
        .landing-login-btn:hover {
          background: linear-gradient(135deg, #d89e24 0%, #ad6f0e 100%) !important;
          box-shadow: 0 6px 16px rgba(184, 123, 25, 0.38) !important;
          transform: translateY(-1px) !important;
        }
      `}</style>

      {/* Arka plan dekoratif daireler */}
      <div
        className="position-absolute rounded-circle"
        style={{
          width: "450px",
          height: "450px",
          background: "radial-gradient(circle, rgba(200, 143, 24, 0.1) 0%, rgba(200, 143, 24, 0) 70%)",
          top: "5%",
          right: "5%",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />
      <div
        className="position-absolute rounded-circle"
        style={{
          width: "400px",
          height: "400px",
          background: "radial-gradient(circle, rgba(168, 101, 10, 0.08) 0%, rgba(168, 101, 10, 0) 70%)",
          bottom: "5%",
          left: "5%",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      <div className="container position-relative z-1" style={{ maxWidth: "1000px" }}>
        <div className="row align-items-center g-4 g-lg-5">
          {/* Sol: kısa tanıtım yazısı */}
          <div className="col-12 col-lg-8">
            <div className="d-flex align-items-center mb-3">
              <img
                src="/images/logo/logo.svg"
                alt="Likya Kuyum Logo"
                className="flex-shrink-0 me-3"
                style={{ width: "56px", height: "56px", objectFit: "contain" }}
              />
              <h3 className="fw-bold mb-0 letter-spacing-1" style={{ fontSize: "2rem", lineHeight: "1.15" }}>
                <span className="brand-text-likya">Likya</span>{" "}
                <span className="brand-text-kuyum">Kuyum</span>
              </h3>
            </div>

            <span
              className="small text-uppercase fw-semibold d-inline-block mb-3"
              style={{ color: "#a8650a", fontSize: "0.78rem", letterSpacing: "1.2px" }}
            >
              Döviz & Altın Yönetim Platformu
            </span>

            <h4 className="fw-bold mb-3" style={{ color: "#1c1917", lineHeight: "1.35" }}>
              Kuyumculuk ve sarrafiye işlerinizin <br />
              <span style={{ color: "#a8650a" }}>tek merkezden yönetimi</span>
            </h4>

            <p className="mb-0" style={{ color: "#5b5245", lineHeight: "1.7", maxWidth: "620px" }}>
              Kasa, vezne, döviz kurları, cari hesaplar, stok ve e-belge süreçlerinizi tek bir
              platformda toplar; canlı kur takibi, anlık raporlama ve güvenli SQL veritabanı
              altyapısıyla günlük işlerinizi hızlandırır. Devam etmek için giriş yapın.
            </p>
          </div>

          {/* Sağ: giriş butonu */}
          <div className="col-12 col-lg-4 d-flex justify-content-lg-end">
            <button
              type="button"
              className="btn btn-lg fw-semibold py-3 px-4 rounded-3 d-inline-flex align-items-center justify-content-center gap-2 landing-login-btn"
              onClick={() => navigate("/login")}
              style={{ minWidth: "220px" }}
            >
              Giriş Yap
              <IconArrowRight size={20} />
            </button>
          </div>
        </div>

        <div className="mt-5 pt-3 border-top" style={{ borderColor: "#ede4d3" }}>
          <span className="small" style={{ color: "#94a3b8", fontSize: "0.78rem" }}>
            © 2026 Likya Kuyum · v2026 Enterprise
          </span>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;

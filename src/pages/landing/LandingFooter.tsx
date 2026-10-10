import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IconBuildingStore,
  IconPhone,
  IconMail,
  IconMapPin,
  IconBrandWhatsapp,
  IconShieldCheck,
  IconSparkles,
  IconArrowRight,
  IconReceipt,
  IconBarcode,
  IconDeviceTv,
  IconFileInvoice,
  IconCreditCard,
  IconUsers,
  IconScale,
  IconDatabase,
} from "@tabler/icons-react";
import { ILETISIM, MAIL_LINK, TEL2_LINK, TEL_LINK } from "./iletisimBilgileri";

export const LandingFooter: React.FC = () => {
  const navigate = useNavigate();

  return (
    <footer className="hw-footer position-relative z-1">
      {/* Top CTA Banner in Hopewell Dark Gradient Style */}
      <div className="container mb-5" style={{ maxWidth: "1240px", marginTop: "-60px" }}>
        <div className="hw-cta-banner">
          <div className="hw-cta-glow"></div>
          <div className="row align-items-center g-4 position-relative z-1">
            <div className="col-12 col-lg-8">
              <div className="hw-eyebrow hw-eyebrow-dark mb-3">
                <IconSparkles size={16} style={{ color: "#f59e0b" }} />
                <span>Kurumsal Kuyumculuk & Sarrafiye ERP</span>
              </div>
              <h2 className="fw-bolder mb-3 text-white" style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", letterSpacing: "-0.5px", lineHeight: "1.25" }}>
                Mağazanızın Tüm Satış ve Stok Süreçlerini Bugün Güçlendirin
              </h2>
              <p className="mb-0 text-white text-opacity-75" style={{ maxWidth: "620px", fontSize: "1rem", lineHeight: "1.65" }}>
                Vezne satışından canlı 4K vitrin panosuna, kuyruk etiketinden MASAK denetimli cari ve has emanet takibine kadar tek kurumsal yazılımla güvendesiniz.
              </p>
            </div>
            <div className="col-12 col-lg-4 text-lg-end d-flex flex-wrap gap-3 justify-content-lg-end">
              <Link
                to="/iletisim"
                className="hw-btn-outline"
                style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
              >
                <span>Demo Talebi</span>
              </Link>
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="hw-btn-primary"
              >
                <span>Sisteme Giriş Yap</span>
                <IconArrowRight size={17} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="container pt-4" style={{ maxWidth: "1280px" }}>
        <div className="row g-5 mb-4">
          {/* Col 1: Brand & Gold Logo */}
          <div className="col-12 col-lg-4">
            <div className="d-flex align-items-center gap-3 mb-3">
              <img
                src="/images/logo/logo.svg"
                alt="Likya Kuyum Logo"
                style={{
                  width: "48px",
                  height: "48px",
                  objectFit: "contain",
                  filter: "drop-shadow(0 3px 8px rgba(200, 143, 24, 0.35))",
                }}
              />
              <div>
                <h4 className="fw-bold mb-0 text-white" style={{ fontSize: "1.45rem", letterSpacing: "-0.5px" }}>
                  Likya <span style={{ color: "#f59e0b" }}>Kuyum</span>
                </h4>
                <span className="fw-bold text-uppercase" style={{ color: "#d97706", fontSize: "0.68rem", letterSpacing: "1.2px" }}>
                  Döviz & Altın Yönetim Platformu
                </span>
              </div>
            </div>

            <p className="small mb-4 text-secondary" style={{ lineHeight: "1.7", color: "#94a3b8" }}>
              Kuyumcular, sarraflar, atölyeler ve döviz büroları için özel olarak geliştirilmiş yeni nesil hibrit SQL, hassas terazi ve e-belge entegrasyonlu kurumsal kaynak planlama sistemi.
            </p>

            <div className="d-flex flex-column gap-2 small">
              <a href={TEL_LINK} className="d-flex align-items-center gap-2 text-decoration-none" style={{ color: "#cbd5e1" }}>
                <IconPhone size={16} style={{ color: "#f59e0b" }} />
                <span>{ILETISIM.telefon}</span>
              </a>
              <a href={TEL2_LINK} className="d-flex align-items-center gap-2 text-decoration-none" style={{ color: "#cbd5e1" }}>
                <IconPhone size={16} style={{ color: "#f59e0b" }} />
                <span>{ILETISIM.telefon2}</span>
              </a>
              <a href={ILETISIM.whatsapp} target="_blank" rel="noopener noreferrer" className="d-flex align-items-center gap-2 text-decoration-none" style={{ color: "#cbd5e1" }}>
                <IconBrandWhatsapp size={16} style={{ color: "#25d366" }} />
                <span>WhatsApp: {ILETISIM.telefon}</span>
              </a>
              <a href={MAIL_LINK} className="d-flex align-items-center gap-2 text-decoration-none" style={{ color: "#cbd5e1" }}>
                <IconMail size={16} style={{ color: "#f59e0b" }} />
                <span>{ILETISIM.eposta}</span>
              </a>
              <div className="d-flex align-items-center gap-2" style={{ color: "#cbd5e1" }}>
                <IconMapPin size={16} style={{ color: "#f59e0b" }} />
                <span>{ILETISIM.adres}</span>
              </div>
            </div>
          </div>

          {/* Col 2: Core Modules */}
          <div className="col-6 col-md-4 col-lg-2">
            <h6 className="hw-footer-title">ERP Modülleri</h6>
            <ul className="list-unstyled d-flex flex-column gap-1 mb-0">
              <li><Link to="/#moduller" className="hw-footer-link">Perakende Satış POS</Link></li>
              <li><Link to="/#moduller" className="hw-footer-link">Termal Barkod Etiket</Link></li>
              <li><Link to="/canli-pano" className="hw-footer-link">Canlı 4K TV Vitrin Panosu</Link></li>
              <li><Link to="/#moduller" className="hw-footer-link">GİB E-Fatura & E-Arşiv</Link></li>
              <li><Link to="/#moduller" className="hw-footer-link">Cari & Sarrafiye Emanet</Link></li>
              <li><Link to="/#moduller" className="hw-footer-link">E-Banka & Sanal POS</Link></li>
            </ul>
          </div>

          {/* Col 3: Hardware & Integrations */}
          <div className="col-6 col-md-4 col-lg-3">
            <h6 className="hw-footer-title">Donanım & Entegrasyon</h6>
            <ul className="list-unstyled d-flex flex-column gap-1 mb-0">
              <li><span className="hw-footer-link">Hassas Terazi (RS232/USB)</span></li>
              <li><span className="hw-footer-link">Zebra & Argox Barkod Yazıcı</span></li>
              <li><span className="hw-footer-link">Optik Barkod & QR Okuyucu</span></li>
              <li><span className="hw-footer-link">4K Akıllı TV Fiyat Panosu</span></li>
              <li><span className="hw-footer-link">Yerel SQL & Hibrit Bulut</span></li>
              <li><span className="hw-footer-link">F10 Sessiz Hızlı Çıktı Servisi</span></li>
            </ul>
          </div>

          {/* Col 4: Trust, Security & Legal */}
          <div className="col-12 col-md-4 col-lg-3">
            <h6 className="hw-footer-title">Mevzuat & Güvenlik</h6>
            <p className="small mb-3" style={{ color: "#94a3b8", lineHeight: "1.6" }}>
              3065 KDV Kanunu özel matrahı, MASAK kimlik doğrulama standartları ve yerel şifrelenmiş veri tabanı mimarisi.
            </p>
            <div className="p-3 rounded-3 border" style={{ backgroundColor: "rgba(255, 255, 255, 0.04)", borderColor: "#1e293b" }}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <IconShieldCheck size={18} style={{ color: "#10b981" }} />
                <span className="fw-bold text-white small">%100 Yasal & Güvenli</span>
              </div>
              <span className="text-secondary small" style={{ fontSize: "0.75rem" }}>
                GİB E-Belge Portalı ve MASAK denetim kurallarına tam uyumlu altyapı.
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="hw-footer-bottom d-flex flex-column flex-md-row align-items-center justify-content-between gap-3">
          <div>
            © {new Date().getFullYear()} Likya Kuyumculuk ERP Sistemleri. Tüm hakları saklıdır.
          </div>
          <div className="d-flex align-items-center gap-4">
            <Link to="/guvenlik" className="text-secondary text-decoration-none small" style={{ transition: "color 0.2s ease" }}>
              Gizlilik Politikası
            </Link>
            <Link to="/guvenlik" className="text-secondary text-decoration-none small" style={{ transition: "color 0.2s ease" }}>
              Kullanım Koşulları
            </Link>
            <Link to="/iletisim" className="text-secondary text-decoration-none small" style={{ transition: "color 0.2s ease" }}>
              Destek Hattı
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;

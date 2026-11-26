import React from "react";
import { Link } from "react-router-dom";
import {
  IconPhone,
  IconMail,
  IconMapPin,
  IconBrandWhatsapp,
  IconShieldCheck,
} from "@tabler/icons-react";
import { ILETISIM, MAIL_LINK, TEL2_LINK, TEL_LINK } from "./iletisimBilgileri";

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-white border-top position-relative z-1 py-5" style={{ borderColor: "#e2e8f0" }}>
      <div className="container" style={{ maxWidth: "1280px" }}>
        <div className="row g-5 mb-4">
          {/* Col 1: Brand & Contact */}
          <div className="col-12 col-lg-4">
            <div className="d-flex align-items-center gap-3 mb-3">
              <img
                src="/images/logo/logo.svg"
                alt="Likya Kuyum Logo"
                style={{
                  width: "44px",
                  height: "44px",
                  objectFit: "contain",
                }}
              />
              <div>
                <h4 className="fw-bold mb-0" style={{ fontSize: "1.4rem", letterSpacing: "-0.4px", color: "#1e352d" }}>
                  Likya <span style={{ color: "#b45309" }}>Kuyum</span>
                </h4>
                <span className="fw-bold text-uppercase" style={{ color: "#475569", fontSize: "0.68rem", letterSpacing: "1px" }}>
                  Döviz &amp; Altın Yönetim Platformu
                </span>
              </div>
            </div>

            <p className="small mb-4" style={{ lineHeight: "1.7", color: "#475569" }}>
              Kuyumcular, sarraflar, atölyeler ve döviz büroları için özel olarak geliştirilmiş yeni nesil hibrit SQL, hassas terazi ve e-belge entegrasyonlu kurumsal kaynak planlama sistemi.
            </p>

            <div className="d-flex flex-column gap-2 small">
              <a href={TEL_LINK} className="d-flex align-items-center gap-2 text-decoration-none fw-semibold" style={{ color: "#1e293b" }}>
                <IconPhone size={16} style={{ color: "#2c4c41" }} />
                <span>{ILETISIM.telefon}</span>
              </a>
              <a href={TEL2_LINK} className="d-flex align-items-center gap-2 text-decoration-none fw-semibold" style={{ color: "#1e293b" }}>
                <IconPhone size={16} style={{ color: "#2c4c41" }} />
                <span>{ILETISIM.telefon2}</span>
              </a>
              <a href={ILETISIM.whatsapp} target="_blank" rel="noopener noreferrer" className="d-flex align-items-center gap-2 text-decoration-none fw-semibold" style={{ color: "#047857" }}>
                <IconBrandWhatsapp size={16} style={{ color: "#16a34a" }} />
                <span>WhatsApp: {ILETISIM.telefon}</span>
              </a>
              <a href={MAIL_LINK} className="d-flex align-items-center gap-2 text-decoration-none fw-medium" style={{ color: "#334155" }}>
                <IconMail size={16} style={{ color: "#2c4c41" }} />
                <span>{ILETISIM.eposta}</span>
              </a>
              <div className="d-flex align-items-center gap-2" style={{ color: "#334155" }}>
                <IconMapPin size={16} style={{ color: "#2c4c41" }} />
                <span>{ILETISIM.adres}</span>
              </div>
            </div>
          </div>

          {/* Col 2: Core Modules */}
          <div className="col-6 col-md-4 col-lg-2">
            <h6 className="fw-bold mb-3" style={{ color: "#0f172a", fontSize: "0.95rem" }}>ERP Modülleri</h6>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-0 small">
              <li><Link to="/" className="text-decoration-none" style={{ color: "#334155" }}>Perakende Satış POS</Link></li>
              <li><Link to="/" className="text-decoration-none" style={{ color: "#334155" }}>Termal Barkod Etiket</Link></li>
              <li><Link to="/canli-pano" className="text-decoration-none" style={{ color: "#334155" }}>Canlı 4K TV Vitrin Panosu</Link></li>
              <li><Link to="/" className="text-decoration-none" style={{ color: "#334155" }}>GİB E-Fatura &amp; E-Arşiv</Link></li>
              <li><Link to="/" className="text-decoration-none" style={{ color: "#334155" }}>Cari &amp; Sarrafiye Emanet</Link></li>
              <li><Link to="/" className="text-decoration-none" style={{ color: "#334155" }}>E-Banka &amp; Sanal POS</Link></li>
            </ul>
          </div>

          {/* Col 3: Hardware & Quick Links */}
          <div className="col-6 col-md-4 col-lg-3">
            <h6 className="fw-bold mb-3" style={{ color: "#0f172a", fontSize: "0.95rem" }}>Kurumsal &amp; Destek</h6>
            <ul className="list-unstyled d-flex flex-column gap-2 mb-0 small">
              <li><Link to="/referanslar" className="text-decoration-none fw-medium" style={{ color: "#334155" }}>Referanslarımız</Link></li>
              <li><Link to="/destek-ekibi" className="text-decoration-none fw-medium" style={{ color: "#334155" }}>Destek Ekibi Numaraları</Link></li>
              <li><Link to="/hakkimizda" className="text-decoration-none fw-medium" style={{ color: "#334155" }}>Hakkımızda</Link></li>
              <li><Link to="/iletisim" className="text-decoration-none fw-medium" style={{ color: "#334155" }}>İletişim</Link></li>
              <li><span style={{ color: "#475569" }}>Hassas Terazi (RS232/USB)</span></li>
              <li><span style={{ color: "#475569" }}>F10 Sessiz Hızlı Çıktı Servisi</span></li>
            </ul>
          </div>

          {/* Col 4: Trust, Security & Legal */}
          <div className="col-12 col-md-4 col-lg-3">
            <h6 className="fw-bold mb-3" style={{ color: "#0f172a", fontSize: "0.95rem" }}>Mevzuat &amp; Güvenlik</h6>
            <p className="small mb-3" style={{ color: "#475569", lineHeight: "1.6" }}>
              3065 KDV Kanunu özel matrahı, MASAK kimlik doğrulama standartları ve yerel şifrelenmiş veri tabanı mimarisi.
            </p>
            <div className="p-3 rounded-3 border" style={{ backgroundColor: "#f8fbf9", borderColor: "#d1e7dd" }}>
              <div className="d-flex align-items-center gap-2 mb-1">
                <IconShieldCheck size={18} style={{ color: "#047857" }} />
                <span className="fw-bold small" style={{ color: "#0f172a" }}>%100 Yasal &amp; Güvenli</span>
              </div>
              <span className="small" style={{ fontSize: "0.78rem", color: "#475569" }}>
                GİB E-Belge Portalı ve MASAK denetim kurallarına tam uyumlu altyapı.
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-4 border-top d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 small" style={{ color: "#475569" }}>
          <div>
            © {new Date().getFullYear()} Likya Kuyumculuk ERP Sistemleri. Tüm hakları saklıdır.
          </div>
          <div className="d-flex align-items-center gap-4">
            <Link to="/guvenlik" className="text-decoration-none small fw-medium" style={{ color: "#334155" }}>
              Gizlilik Politikası
            </Link>
            <Link to="/guvenlik" className="text-decoration-none small fw-medium" style={{ color: "#334155" }}>
              Kullanım Koşulları
            </Link>
            <Link to="/destek-ekibi" className="text-decoration-none small fw-medium" style={{ color: "#334155" }}>
              Destek Ekibi
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;

import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  IconArrowRight,
  IconBuildingStore,
  IconHeadset,
  IconMenu2,
  IconX,
} from "@tabler/icons-react";

interface LandingNavbarProps {
  hideTicker?: boolean;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  const isHomePage = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      if (!isHomePage) return;

      const sections = ["home", "cozumler", "neden-biz", "avantajlar", "kampanya", "yorumlar", "iletisim"];
      const scrollPos = window.scrollY + 120;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPos >= top && scrollPos < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHomePage]);

  const navLinks = [
    { label: "Ana Sayfa", targetId: "home" },
    { label: "Kampanya", targetId: "kampanya" },
    { label: "Çözümler", targetId: "cozumler" },
    { label: "Neden Biz?", targetId: "neden-biz" },
    { label: "Özellikler", targetId: "avantajlar" },
    { label: "İletişim", targetId: "iletisim" },
  ];

  const scrollToSection = (targetId: string) => {
    setMobileMenuOpen(false);
    if (!isHomePage) {
      navigate("/");
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
      return;
    }
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className="fixed-top z-3 w-100">
      <nav className={`furni-navbar ${isScrolled || !isHomePage ? "scrolled" : ""}`}>
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="d-flex align-items-center justify-content-between w-100">
            {/* 1. Left: Gold Brand Logo */}
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("home");
              }}
              className="furni-brand-logo me-4"
            >
              <img
                src="/images/logo/logo.svg"
                alt="Likya Kuyum Logo"
                style={{
                  width: "38px",
                  height: "38px",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 6px rgba(249, 191, 41, 0.35))",
                }}
              />
              <div className="d-flex align-items-center gap-1 lh-1">
                <span className="brand-text-likya" style={{ fontSize: "1.75rem" }}>
                  Likya
                </span>
                <span className="brand-text-kuyum" style={{ fontSize: "1.75rem", color: "#fef3c7" }}>
                  Kuyum
                </span>
                <span className="dot" style={{ color: "#f9bf29", fontSize: "1.85rem", lineHeight: "0" }}>.</span>
              </div>
            </a>

            {/* 2. Center: Single-Line Nav Links + Referanslar & Destek Ekibi Sayfa Bağlantıları */}
            <div className="d-none d-lg-flex align-items-center gap-3 gap-xl-4 mx-auto">
              {navLinks.map((item) => {
                const isActive = isHomePage && activeSection === item.targetId;
                return (
                  <a
                    key={item.targetId}
                    href={`#${item.targetId}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(item.targetId);
                    }}
                    className={`furni-nav-link text-nowrap ${isActive ? "active" : ""}`}
                  >
                    {item.label}
                  </a>
                );
              })}

              <Link
                to="/referanslar"
                className={`furni-nav-link text-nowrap ${location.pathname === "/referanslar" ? "active" : ""}`}
              >
                Referanslar
              </Link>

              <Link
                to="/destek-ekibi"
                className={`furni-nav-link text-nowrap d-inline-flex align-items-center gap-1 ${
                  location.pathname === "/destek-ekibi" ? "active" : ""
                }`}
              >
                <IconHeadset size={16} style={{ color: "#f9bf29" }} />
                <span>Destek Ekibi</span>
              </Link>
            </div>

            {/* 3. Right Placeholder */}
            <div className="d-none d-lg-flex align-items-center ms-3 flex-shrink-0" />

            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              className="navbar-toggler border-0 p-2 text-white d-lg-none"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <IconX size={26} /> : <IconMenu2 size={26} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            className="d-lg-none w-100 px-4 py-3 shadow-lg mt-2"
            style={{
              backgroundColor: "#2c4c41",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            }}
          >
            <div className="d-flex flex-column gap-2 mb-3">
              {navLinks.map((item) => {
                const isActive = isHomePage && activeSection === item.targetId;
                return (
                  <a
                    key={item.targetId}
                    href={`#${item.targetId}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(item.targetId);
                    }}
                    className="py-2 px-3 rounded text-decoration-none text-white fw-medium d-flex align-items-center justify-content-between"
                    style={{
                      backgroundColor: isActive ? "rgba(249, 191, 41, 0.15)" : "transparent",
                      color: isActive ? "#f9bf29" : "#ffffff",
                    }}
                  >
                    <span>{item.label}</span>
                    <IconArrowRight size={16} />
                  </a>
                );
              })}

              <Link
                to="/referanslar"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 px-3 rounded text-decoration-none text-white fw-medium d-flex align-items-center justify-content-between"
                style={{
                  backgroundColor: location.pathname === "/referanslar" ? "rgba(249, 191, 41, 0.15)" : "transparent",
                  color: location.pathname === "/referanslar" ? "#f9bf29" : "#ffffff",
                }}
              >
                <span>Referanslar</span>
                <IconArrowRight size={16} />
              </Link>

              <Link
                to="/destek-ekibi"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 px-3 rounded text-decoration-none text-white fw-medium d-flex align-items-center justify-content-between"
                style={{
                  backgroundColor: location.pathname === "/destek-ekibi" ? "rgba(249, 191, 41, 0.15)" : "transparent",
                  color: location.pathname === "/destek-ekibi" ? "#f9bf29" : "#ffffff",
                }}
              >
                <span className="d-inline-flex align-items-center gap-1.5">
                  <IconHeadset size={16} style={{ color: "#f9bf29" }} />
                  Destek Ekibi
                </span>
                <IconArrowRight size={16} />
              </Link>
            </div>

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/login");
              }}
              className="furni-btn-login w-100 justify-content-center py-2.5"
            >
              <IconBuildingStore size={18} />
              <span>Sisteme Giriş Yap</span>
              <IconArrowRight size={16} />
            </button>
          </div>
        )}
      </nav>
    </header>
  );
};

export default LandingNavbar;

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconArrowRight,
  IconBuildingStore,
  IconMenu2,
  IconX,
} from "@tabler/icons-react";

interface LandingNavbarProps {
  hideTicker?: boolean;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      const sections = ["home", "cozumler", "neden-biz", "avantajlar", "yorumlar", "iletisim"];
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
  }, []);

  const navLinks = [
    { label: "Ana Sayfa", targetId: "home" },
    { label: "Çözümler", targetId: "cozumler" },
    { label: "Neden Biz?", targetId: "neden-biz" },
    { label: "Özellikler", targetId: "avantajlar" },
    { label: "Yorumlar", targetId: "yorumlar" },
    { label: "İletişim", targetId: "iletisim" },
  ];

  const scrollToSection = (targetId: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(targetId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <header className="fixed-top z-3 w-100">
      <nav
        className={`furni-navbar ${isScrolled ? "scrolled" : ""}`}
      >
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="d-flex align-items-center justify-content-between w-100">
            {/* 1. Left: Gold Brand Logo matching Login Page */}
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

            {/* 2. Center: Single-Line Nav Links with Equal Gaps */}
            <div className="d-none d-lg-flex align-items-center gap-4 mx-auto">
              {navLinks.map((item) => {
                const isActive = activeSection === item.targetId;
                return (
                  <a
                    key={item.targetId}
                    href={`#${item.targetId}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(item.targetId);
                    }}
                    className={`furni-nav-link ${isActive ? "active" : ""}`}
                  >
                    {item.label}
                  </a>
                );
              })}
            </div>

            {/* 3. Right: Action Login Button (Single Row, No Wrap) */}
            <div className="d-none d-lg-flex align-items-center ms-4 flex-shrink-0">
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="furni-btn-login shadow-sm"
              >
                <IconBuildingStore size={17} />
                <span>Sisteme Giriş Yap</span>
                <IconArrowRight size={15} />
              </button>
            </div>

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
                const isActive = activeSection === item.targetId;
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

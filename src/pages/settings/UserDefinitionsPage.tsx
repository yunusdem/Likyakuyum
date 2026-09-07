import React, { useState, useMemo, useCallback, useRef } from "react";

import {
  Card,
  Row,
  Col,
  Nav,
  Tab,
  Form,
  Button,
  Badge,
  Modal,
  Alert,
  Table,
  InputGroup,
  Dropdown,
} from "react-bootstrap";
import {
  IconUser,
  IconKey,
  IconCash,
  IconCheck,
  IconDatabase,
  IconFileCertificate,
  IconSearch,
  IconEye,
  IconEyeOff,
  IconPalette,
  IconAdjustments,
  IconShieldLock,
  IconPrinter,
  IconZoomIn,
  IconExchange,
  IconServer,
  IconPlus,
  IconAlertCircle,
  IconSparkles,
  IconItalic,
  IconBold,
  IconLetterCase,
  IconTypography,
  IconX,
  IconChevronDown,
} from "@tabler/icons-react";

import ERPToolbar from "components/common/ERPToolbar";
import { printReportTable } from "../../utils/printReport";
import { UserService, UserProfileDto } from "../../services/userService";
import { CashDeskService } from "../../services/cashDeskService";
import LookupModal from "../../components/common/LookupModal";

import { useAuth } from "../../context/AuthContext";


export type UserProfile = UserProfileDto;


export const FONT_CATALOG = [
  // Sans-Serif (Modern & Okunaklı)
  { label: "Inter (Modern Web UI)", value: "Inter, sans-serif", category: "Sans-Serif" },
  { label: "Roboto (Google Standart)", value: "Roboto, sans-serif", category: "Sans-Serif" },
  { label: "Poppins (Modern Yuvarlak)", value: "Poppins, sans-serif", category: "Sans-Serif" },
  { label: "Montserrat (Geometrik & Şık)", value: "Montserrat, sans-serif", category: "Sans-Serif" },
  { label: "Outfit (Lüks & Çağdaş)", value: "Outfit, sans-serif", category: "Sans-Serif" },
  { label: "Plus Jakarta Sans (Temiz Kurumsal)", value: "Plus Jakarta Sans, sans-serif", category: "Sans-Serif" },
  { label: "Public Sans (Resmi Standart)", value: "Public Sans, sans-serif", category: "Sans-Serif" },
  { label: "DM Sans (Modern Minimal)", value: "DM Sans, sans-serif", category: "Sans-Serif" },
  { label: "Open Sans (Evrensel Sans)", value: "Open Sans, sans-serif", category: "Sans-Serif" },
  { label: "Lato (Ferah & Denge)", value: "Lato, sans-serif", category: "Sans-Serif" },
  { label: "Nunito (Yumuşak Hatlı)", value: "Nunito, sans-serif", category: "Sans-Serif" },
  { label: "Raleway (Zarif İnce)", value: "Raleway, sans-serif", category: "Sans-Serif" },
  { label: "Work Sans (Endüstriyel)", value: "Work Sans, sans-serif", category: "Sans-Serif" },
  { label: "Rubik (Modern Kübik)", value: "Rubik, sans-serif", category: "Sans-Serif" },
  { label: "Urbanist (Geometrik Estetik)", value: "Urbanist, sans-serif", category: "Sans-Serif" },
  { label: "Manrope (Net & Keskin)", value: "Manrope, sans-serif", category: "Sans-Serif" },
  { label: "Lexend (Hızlı Okunabilir)", value: "Lexend, sans-serif", category: "Sans-Serif" },
  { label: "Quicksand (Yuvarlak Başlık)", value: "Quicksand, sans-serif", category: "Sans-Serif" },
  { label: "Segoe UI (Windows Standart)", value: "Segoe UI, sans-serif", category: "Sans-Serif" },
  { label: "Tahoma (ERP Klasik)", value: "Tahoma, sans-serif", category: "Sans-Serif" },
  { label: "Arial (Standart Sans)", value: "Arial, sans-serif", category: "Sans-Serif" },
  { label: "Calibri (Modern Ofis)", value: "Calibri, sans-serif", category: "Sans-Serif" },
  { label: "Verdana (Geniş Okunaklı)", value: "Verdana, sans-serif", category: "Sans-Serif" },
  { label: "Trebuchet MS (Kurumsal Sans)", value: "Trebuchet MS, sans-serif", category: "Sans-Serif" },
  { label: "Helvetica (Temiz & Düz)", value: "Helvetica, sans-serif", category: "Sans-Serif" },
  { label: "MS Sans Serif (Delphi Klasik)", value: "MS Sans Serif, sans-serif", category: "Sans-Serif" },

  // Serif (Lüks Vitrin, Mücevher, Altın & Sarrafiye)
  { label: "Cinzel (Altın Sarraf Klasik)", value: "Cinzel, serif", category: "Serif" },
  { label: "Playfair Display (Lüks Vitrin Serif)", value: "Playfair Display, serif", category: "Serif" },
  { label: "Bodoni Moda (Moda & Mücevher)", value: "Bodoni Moda, serif", category: "Serif" },
  { label: "Cormorant Garamond (Klasik Zarafet)", value: "Cormorant Garamond, serif", category: "Serif" },
  { label: "EB Garamond (Geleneksel Sarraf)", value: "EB Garamond, serif", category: "Serif" },
  { label: "Marcellus (Roma Tarzı Serif)", value: "Marcellus, serif", category: "Serif" },
  { label: "Prata (Zarif Başlık Serif)", value: "Prata, serif", category: "Serif" },
  { label: "Lora (Zarif Gövde Serif)", value: "Lora, serif", category: "Serif" },
  { label: "Libre Baskerville (Kitap Serif)", value: "Libre Baskerville, serif", category: "Serif" },
  { label: "Merriweather (Okunaklı Serif)", value: "Merriweather, serif", category: "Serif" },
  { label: "Georgia (Klasik Serif)", value: "Georgia, serif", category: "Serif" },
  { label: "Times New Roman (Standart Serif)", value: "Times New Roman, serif", category: "Serif" },

  // Monospace & Finans
  { label: "Fira Code (Modern Sayısal / Finans)", value: "Fira Code, monospace", category: "Monospace" },
  { label: "JetBrains Mono (Sayısal Monospace)", value: "JetBrains Mono, monospace", category: "Monospace" },
  { label: "IBM Plex Mono (Kurumsal Monospace)", value: "IBM Plex Mono, monospace", category: "Monospace" },
  { label: "Roboto Mono (Google Monospace)", value: "Roboto Mono, monospace", category: "Monospace" },
  { label: "Space Mono (Geometrik Monospace)", value: "Space Mono, monospace", category: "Monospace" },
  { label: "Source Code Pro (Temiz Monospace)", value: "Source Code Pro, monospace", category: "Monospace" },
  { label: "Oswald (Kompakt Finans Başlık)", value: "Oswald, sans-serif", category: "Monospace" },
  { label: "Consolas (Sayısal Monospace)", value: "Consolas, monospace", category: "Monospace" },
  { label: "Courier New (Klasik Daktilo)", value: "Courier New, monospace", category: "Monospace" },

  // Handwriting / El Yazısı
  { label: "Caveat (Doğal El Yazısı)", value: "Caveat, cursive", category: "El Yazısı" },
  { label: "Dancing Script (Zarif El Yazısı)", value: "Dancing Script, cursive", category: "El Yazısı" },
  { label: "Great Vibes (Kaligrafi İmza)", value: "Great Vibes, cursive", category: "El Yazısı" },
  { label: "Pacifico (Fırça Yazısı)", value: "Pacifico, cursive", category: "El Yazısı" },
  { label: "Sacramento (İnce İmza)", value: "Sacramento, cursive", category: "El Yazısı" },
];

/**
 * Dropdown Menu with Live Typography Preview:
 * Her fontun adının yanında o fontla canlı olarak render edilen `Abc / ABC 123 ₺` önizleme kartı yer alır.
 */
export const FontSelectDropdown: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}> = ({ value, onChange, placeholder = "Font Seçin" }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tümü");

  const currentFontObj = FONT_CATALOG.find(
    (f) => f.value === value || f.value.toLowerCase().startsWith(value.split(",")[0].toLowerCase())
  );
  const currentLabel = currentFontObj ? currentFontObj.label.split(" (")[0] : value.split(",")[0] || placeholder;

  const categories = ["Tümü", "Sans-Serif", "Serif", "Monospace", "El Yazısı"];

  const filteredFonts = useMemo(() => {
    return FONT_CATALOG.filter((f) => {
      const matchesSearch =
        f.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.value.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "Tümü" || f.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchTerm, selectedCategory]);

  return (
    <Dropdown className="d-inline-block">
      <Dropdown.Toggle
        variant="light"
        size="sm"
        className="d-flex align-items-center justify-content-between border text-start bg-white shadow-none px-2.5 py-1.5 rounded-2"
        style={{ width: "240px" }}
      >
        <div className="d-flex align-items-center gap-1.5 overflow-hidden me-1">
          <span className="text-truncate fw-semibold small" style={{ maxWidth: "115px" }}>
            {currentLabel}
          </span>
          <span
            className="badge bg-light text-primary border"
            style={{ fontFamily: value, fontSize: "11px", letterSpacing: "0.3px" }}
          >
            Abc/ABC ₺
          </span>
        </div>
        <IconChevronDown size={14} className="text-muted ms-auto" />
      </Dropdown.Toggle>

      <Dropdown.Menu
        className="p-2 shadow-lg border rounded-3 dropdown-menu-end"
        style={{ width: "380px", maxHeight: "380px", overflowY: "auto", zIndex: 1060 }}
      >
        {/* Arama ve Filtre */}
        <div className="px-1 pb-2 border-bottom mb-2 sticky-top bg-white">
          <InputGroup size="sm" className="mb-2">
            <InputGroup.Text className="bg-light text-muted border-end-0">
              <IconSearch size={14} />
            </InputGroup.Text>
            <Form.Control
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-start-0 bg-light"
              autoFocus
            />
            {searchTerm && (
              <Button variant="light" size="sm" onClick={() => setSearchTerm("")}>
                <IconX size={12} />
              </Button>
            )}
          </InputGroup>

          {/* Kategori Filtre Butonları */}
          <div className="d-flex gap-1 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <Badge
                key={cat}
                bg={selectedCategory === cat ? "primary" : "light"}
                text={selectedCategory === cat ? "white" : "dark"}
                className="border px-2 py-1 user-select-none"
                style={{ cursor: "pointer", fontSize: "11px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCategory(cat);
                }}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>

        {/* Font Listesi */}
        <div className="d-flex flex-column gap-1">
          {filteredFonts.length === 0 ? (
            <div className="text-center text-muted small py-3">Eşleşen font bulunamadı</div>
          ) : (
            filteredFonts.map((f) => {
              const isSelected =
                value === f.value || value.toLowerCase().startsWith(f.value.split(",")[0].toLowerCase());
              return (
                <Dropdown.Item
                  key={f.value}
                  active={isSelected}
                  onClick={() => onChange(f.value)}
                  className={`d-flex align-items-center justify-content-between p-2 rounded-2 ${
                    isSelected ? "bg-primary text-white" : "hover-bg-light"
                  }`}
                  style={{ cursor: "pointer" }}
                >
                  <div className="d-flex flex-column me-2 text-truncate" style={{ maxWidth: "160px" }}>
                    <span className="fw-semibold small text-truncate">{f.label}</span>
                    <span
                      className="small"
                      style={{ fontSize: "10px", opacity: isSelected ? 0.9 : 0.6 }}
                    >
                      {f.category}
                    </span>
                  </div>

                  {/* Yanında Fontun Birebir Yazılmış Canlı Önizlemesi: Abc / ABC 123 ₺ */}
                  <div
                    className={`px-2 py-1 rounded text-nowrap ms-auto border ${
                      isSelected ? "bg-white text-dark border-white" : "bg-light text-dark"
                    }`}
                    style={{
                      fontFamily: f.value,
                      fontSize: "13px",
                      lineHeight: "1.2",
                    }}
                  >
                    Abc / ABC 123 ₺
                  </div>
                </Dropdown.Item>
              );
            })
          )}
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
};


export interface ThemePreset {
  id: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  previewBg: string;
  previewText: string;
  previewAccent: string;
  previewFont: string;
  appearance: UserProfile["appearance"];
}

export const THEME_PRESETS: ThemePreset[] = [
  // 1. MODERN KURUMSAL VE SAAS (Slate & Indigo)
  {
    id: "saas-slate-indigo",
    name: "Modern Kurumsal & SaaS (Slate & Indigo)",
    badge: "SaaS Popüler",
    badgeColor: "primary",
    description: "Slate arkaplan, Indigo (#6366f1) vurgular, ferah paneller ve Plus Jakarta Sans fontu",
    previewBg: "#f8fafc",
    previewText: "#0f172a",
    previewAccent: "#6366f1",
    previewFont: "Plus Jakarta Sans, Inter, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#f8fafc",
      programTextColor: "#0f172a",
      programFont: "Plus Jakarta Sans, Inter, sans-serif",
      gridHeaderBgColor: "#e2e8f0",
      gridBgColor: "#ffffff",
      gridFont: "Plus Jakarta Sans, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#0f172a",
      windowFocusColor: "#6366f1",

      enableMenuTheme: true,
      menuBgColor: "#ffffff",
      menuSelectedBgColor: "#6366f1",
      menuFont: "Plus Jakarta Sans, sans-serif",
      menuHeaderBgColor: "#0f172a",
      menuHeaderFont: "Plus Jakarta Sans, sans-serif",
      menuBackdropColor: "#0f172a",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#ecfdf5",
      buyHeaderTextColor: "#047857",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#eef2ff",
      sellHeaderTextColor: "#4338ca",
    },
  },

  // 2. FINTECH VE ERP DASHBOARD (Zinc & Emerald)
  {
    id: "fintech-zinc-emerald",
    name: "Fintech & ERP Dashboard (Zinc & Emerald)",
    badge: "Fintech ERP",
    badgeColor: "success",
    description: "Finans & borsa panelleri için Zinc yüzeyler, Zümrüt Yeşili (#059669) ve DM Sans fontu",
    previewBg: "#fafafa",
    previewText: "#18181b",
    previewAccent: "#059669",
    previewFont: "DM Sans, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#fafafa",
      programTextColor: "#18181b",
      programFont: "DM Sans, sans-serif",
      gridHeaderBgColor: "#e4e4e7",
      gridBgColor: "#ffffff",
      gridFont: "DM Sans, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#18181b",
      windowFocusColor: "#059669",

      enableMenuTheme: true,
      menuBgColor: "#18181b",
      menuSelectedBgColor: "#059669",
      menuFont: "DM Sans, sans-serif",
      menuHeaderBgColor: "#09090b",
      menuHeaderFont: "DM Sans, sans-serif",
      menuBackdropColor: "#18181b",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#dcfce7",
      buyHeaderTextColor: "#15803d",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fef3c7",
      sellHeaderTextColor: "#b45309",
    },
  },

  // 3. LÜKS, KUYUMCU VE E-TİCARET (Warm Charcoal & Gold)
  {
    id: "luxury-charcoal-gold",
    name: "Lüks Kuyumcu & Sarraf (Warm Charcoal & Gold)",
    badge: "Lüks Sarraf",
    badgeColor: "warning",
    description: "Kuyumcu & sarraf vitrini için sıcak kömür arayüz, gerçek altın sarısı (#d4af37) ve Playfair Display + Cinzel fontu",
    previewBg: "#fcfbf9",
    previewText: "#1c1917",
    previewAccent: "#d4af37",
    previewFont: "Playfair Display, Cinzel, serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#fcfbf9",
      programTextColor: "#1c1917",
      programFont: "Playfair Display, Cinzel, serif",
      gridHeaderBgColor: "#fef9c3",
      gridBgColor: "#ffffff",
      gridFont: "Cinzel, serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#1c1917",
      windowFocusColor: "#d4af37",

      enableMenuTheme: true,
      menuBgColor: "#1c1b1a",
      menuSelectedBgColor: "#d4af37",
      menuFont: "Cinzel, serif",
      menuHeaderBgColor: "#121212",
      menuHeaderFont: "Playfair Display, serif",
      menuBackdropColor: "#1c1b1a",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#fef3c7",
      buyHeaderTextColor: "#92400e",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fef9c3",
      sellHeaderTextColor: "#b45309",
    },
  },

  // 4. MINIMALIST VE TECH (Neutral & Electric Blue)
  {
    id: "minimal-electric-blue",
    name: "Minimalist & Tech (Neutral & Electric Blue)",
    badge: "Tech Modern",
    badgeColor: "primary",
    description: "Yüksek kontrastlı nötr beyaz paneller, Royal Blue (#2563eb), Cyan vurgular ve Poppins fontu",
    previewBg: "#ffffff",
    previewText: "#09090b",
    previewAccent: "#2563eb",
    previewFont: "Poppins, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#ffffff",
      programTextColor: "#09090b",
      programFont: "Poppins, sans-serif",
      gridHeaderBgColor: "#f4f4f5",
      gridBgColor: "#ffffff",
      gridFont: "Poppins, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#09090b",
      windowFocusColor: "#2563eb",

      enableMenuTheme: true,
      menuBgColor: "#09090b",
      menuSelectedBgColor: "#2563eb",
      menuFont: "Poppins, sans-serif",
      menuHeaderBgColor: "#18181b",
      menuHeaderFont: "Poppins, sans-serif",
      menuBackdropColor: "#09090b",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#ecfeff",
      buyHeaderTextColor: "#0891b2",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#eff6ff",
      sellHeaderTextColor: "#1d4ed8",
    },
  },

  {
    id: "snow-white-gold",
    name: "Kar Beyazı & Zarif Altın",
    badge: "Lüks Beyaz",
    badgeColor: "warning",
    description: "Kuyumcu vitrini ferahlığında saf beyaz zemin ve zarif altın sarısı vurgular",
    previewBg: "#ffffff",
    previewText: "#18181b",
    previewAccent: "#d97706",
    previewFont: "Outfit, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#ffffff",
      programTextColor: "#18181b",
      programFont: "Outfit, sans-serif",
      gridHeaderBgColor: "#fffbeb",
      gridBgColor: "#ffffff",
      gridFont: "Outfit, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#18181b",
      windowFocusColor: "#d97706",

      enableMenuTheme: true,
      menuBgColor: "#ffffff",
      menuSelectedBgColor: "#d97706",
      menuFont: "Outfit, sans-serif",
      menuHeaderBgColor: "#ffffff",
      menuHeaderFont: "Outfit, sans-serif",
      menuBackdropColor: "#fffbeb",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#f0fdf4",
      buyHeaderTextColor: "#15803d",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fff7ed",
      sellHeaderTextColor: "#c2410c",
    },
  },
  {
    id: "midnight-gold",
    name: "Lüks Gece & Altın Varak",
    badge: "Popüler Koyu",
    badgeColor: "warning",
    description: "Koyu gece şıklığı, altın sarısı vurgular ve çağdaş lüks tipografi",
    previewBg: "#0f172a",
    previewText: "#f8fafc",
    previewAccent: "#eab308",
    previewFont: "Outfit, Inter, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#0f172a",
      programTextColor: "#f8fafc",
      programFont: "Outfit, Inter, sans-serif",
      gridHeaderBgColor: "#1e293b",
      gridBgColor: "#0f172a",
      gridFont: "Outfit, sans-serif",
      windowBgColor: "#1e293b",
      windowTextColor: "#f8fafc",
      windowFocusColor: "#eab308",

      enableMenuTheme: true,
      menuBgColor: "#090d16",
      menuSelectedBgColor: "#eab308",
      menuFont: "Outfit, sans-serif",
      menuHeaderBgColor: "#020617",
      menuHeaderFont: "Outfit, sans-serif",
      menuBackdropColor: "#0f172a",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#1e293b",
      buyHeaderTextColor: "#38bdf8",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#1e293b",
      sellHeaderTextColor: "#fbbf24",
    },
  },

  {
    id: "corporate-blue",
    name: "Kurumsal Aydınlık & Kraliyet Mavisi",
    badge: "ERP Standart",
    badgeColor: "primary",
    description: "Gözü yormayan aydınlık çalışma ortamı ve güçlü safir mavi aksanlar",
    previewBg: "#f8fafc",
    previewText: "#0f172a",
    previewAccent: "#2563eb",
    previewFont: "Inter, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#f8fafc",
      programTextColor: "#0f172a",
      programFont: "Inter, sans-serif",
      gridHeaderBgColor: "#e0f2fe",
      gridBgColor: "#ffffff",
      gridFont: "Inter, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#0f172a",
      windowFocusColor: "#2563eb",

      enableMenuTheme: true,
      menuBgColor: "#ffffff",
      menuSelectedBgColor: "#2563eb",
      menuFont: "Inter, sans-serif",
      menuHeaderBgColor: "#f1f5f9",
      menuHeaderFont: "Inter, sans-serif",
      menuBackdropColor: "#000000",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#e0f2fe",
      buyHeaderTextColor: "#0369a1",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fef3c7",
      sellHeaderTextColor: "#b45309",
    },
  },
  {
    id: "emerald-kuyumcu",
    name: "Zümrüt Yeşili & Sarrafiye",
    badge: "Sektörel Özel",
    badgeColor: "success",
    description: "Kuyumculuk ve sarrafiye sektörü için özel zümrüt yeşili paleti",
    previewBg: "#f0fdf4",
    previewText: "#064e3b",
    previewAccent: "#059669",
    previewFont: "Montserrat, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#f0fdf4",
      programTextColor: "#064e3b",
      programFont: "Montserrat, sans-serif",
      gridHeaderBgColor: "#dcfce7",
      gridBgColor: "#ffffff",
      gridFont: "Montserrat, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#064e3b",
      windowFocusColor: "#059669",

      enableMenuTheme: true,
      menuBgColor: "#064e3b",
      menuSelectedBgColor: "#10b981",
      menuFont: "Montserrat, sans-serif",
      menuHeaderBgColor: "#022c22",
      menuHeaderFont: "Montserrat, sans-serif",
      menuBackdropColor: "#064e3b",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#dcfce7",
      buyHeaderTextColor: "#065f46",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#fef9c3",
      sellHeaderTextColor: "#854d0e",
    },
  },
  {
    id: "delphi-classic",
    name: "Klasik Masaüstü ERP (Delphi/Windows)",
    badge: "Masaüstü Klasik",
    badgeColor: "secondary",
    description: "Geleneksel kuyumcu masaüstü yazılımlarına alışkın kullanıcılar için",
    previewBg: "#f4f4f4",
    previewText: "#000000",
    previewAccent: "#000080",
    previewFont: "Tahoma, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#f4f4f4",
      programTextColor: "#000000",
      programFont: "Tahoma, sans-serif",
      gridHeaderBgColor: "#cbe5ff",
      gridBgColor: "#ffffff",
      gridFont: "Tahoma, sans-serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#000000",
      windowFocusColor: "#000080",

      enableMenuTheme: true,
      menuBgColor: "#bfe0ff",
      menuSelectedBgColor: "#ff80ff",
      menuFont: "Tahoma, sans-serif",
      menuHeaderBgColor: "#000080",
      menuHeaderFont: "Tahoma, sans-serif",
      menuBackdropColor: "#ff8080",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#cbe5ff",
      buyHeaderTextColor: "#000080",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#ffe0c0",
      sellHeaderTextColor: "#804000",
    },
  },
  {
    id: "rose-luxury",
    name: "Rose Gold & Pırlanta Serif",
    badge: "Mücevher Şık",
    badgeColor: "danger",
    description: "Pırlanta, mücevher ve zarif serif tipografiye sahip lüks vitrin",
    previewBg: "#fff1f2",
    previewText: "#4c0519",
    previewAccent: "#e11d48",
    previewFont: "Playfair Display, Georgia, serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#fff1f2",
      programTextColor: "#4c0519",
      programFont: "Playfair Display, Georgia, serif",
      gridHeaderBgColor: "#ffe4e6",
      gridBgColor: "#ffffff",
      gridFont: "Playfair Display, serif",
      windowBgColor: "#ffffff",
      windowTextColor: "#4c0519",
      windowFocusColor: "#e11d48",

      enableMenuTheme: true,
      menuBgColor: "#ffe4e6",
      menuSelectedBgColor: "#e11d48",
      menuFont: "Playfair Display, serif",
      menuHeaderBgColor: "#9f1239",
      menuHeaderFont: "Playfair Display, serif",
      menuBackdropColor: "#fda4af",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#ffe4e6",
      buyHeaderTextColor: "#9f1239",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#ffedd5",
      sellHeaderTextColor: "#9a3412",
    },
  },
  {
    id: "oled-charcoal",
    name: "OLED Saf Siyah & Minimalist",
    badge: "OLED Dark",
    badgeColor: "dark",
    description: "Yüksek kontrast, ultra net yazı ve minimum göz yorgunluğu",
    previewBg: "#121212",
    previewText: "#ffffff",
    previewAccent: "#38bdf8",
    previewFont: "Poppins, sans-serif",
    appearance: {
      enableProgramTheme: true,
      programBgColor: "#121212",
      programTextColor: "#ffffff",
      programFont: "Poppins, sans-serif",
      gridHeaderBgColor: "#1e1e1e",
      gridBgColor: "#181818",
      gridFont: "Poppins, sans-serif",
      windowBgColor: "#1e1e1e",
      windowTextColor: "#ffffff",
      windowFocusColor: "#38bdf8",

      enableMenuTheme: true,
      menuBgColor: "#0a0a0a",
      menuSelectedBgColor: "#38bdf8",
      menuFont: "Poppins, sans-serif",
      menuHeaderBgColor: "#000000",
      menuHeaderFont: "Poppins, sans-serif",
      menuBackdropColor: "#121212",

      enableBuyHeaderTheme: true,
      buyHeaderBgColor: "#1e1e1e",
      buyHeaderTextColor: "#38bdf8",

      enableSellHeaderTheme: true,
      sellHeaderBgColor: "#1e1e1e",
      sellHeaderTextColor: "#f59e0b",
    },
  },
];


const defaultNewUserTemplate: UserProfile = {
  id: "",

  username: "",
  fullName: "",
  role: "Kasa / Vezne Sorumlusu",
  password: "",
  cashierCode: "",
  isActive: true,

  isSysAdmin: false,
  displayDays: 0,
  hasWorkspacePerm: true,
  hasDateChangePerm: false,
  hasCommissionPerm: false,
  hasSlipNoChangePerm: false,
  hasCashDeskBalanceCheck: false,
  canViewAccountBalance: true,
  canViewOpenTermTrans: false,
  hasSlipBankAccountPerm: false,
  hasSlipAmountChangePerm: false,
  isSuspiciousTransAuth: false,
  noCrossRateCheck: false,

  printerId: "1",
  horizontalZoom: 0,
  verticalZoom: 0,
  hasCommissionRate: false,
  commissionRate: "0.00",
  ratePermType: "Var",
  ratePermValue: "0.00",

  menuPerms: {
    mainMenu: "Tam Yetki",
    cashier: "Tam Yetki",
    safe: "Tam Yetki",
    exchange: "Tam Yetki",
    accounts: "Tam Yetki",
    admin: "Yetki Yok",
    accounting: "Yetki Yok",
    reports: "Tam Yetki",
    consolidatedReports: "Yetki Yok",
    techOps: "Yetki Yok",
    movementType: "Tam Yetki",
  },

  buyStatCode: "",
  sellStatCode: "",
  arbitrageBuyStatCode: "",
  arbitrageSellStatCode: "",

  integratorUsername: "",
  integratorPassword: "",
  isEDocumentActive: false,
  masakUsername: "",
  masakPassword: "",
  hasMasakWarning: false,
  noDeviationWarning: false,
  canBeOutsideCounterRate: false,

  appearance: {
    enableProgramTheme: true,
    programBgColor: "#f8fafc",
    programTextColor: "#0f172a",
    programFont: "Segoe UI, sans-serif",
    gridHeaderBgColor: "#cbe5ff",
    gridBgColor: "#ffffff",
    gridFont: "Segoe UI, sans-serif",
    windowBgColor: "#ffffff",
    windowTextColor: "#000000",
    windowFocusColor: "#e2e8f0",

    enableMenuTheme: true,
    menuBgColor: "#bfe0ff",
    menuSelectedBgColor: "#ff80ff",
    menuFont: "Segoe UI, sans-serif",
    menuHeaderBgColor: "#000080",
    menuHeaderFont: "Segoe UI, sans-serif",
    menuBackdropColor: "#ff8080",

    enableBuyHeaderTheme: false,
    buyHeaderBgColor: "#e2e8f0",
    buyHeaderTextColor: "#000000",

    enableSellHeaderTheme: false,
    sellHeaderBgColor: "#e2e8f0",
    sellHeaderTextColor: "#000000",
  },
};

const UserDefinitionsPage: React.FC = () => {
  const { user: authUser } = useAuth();
  const rawDb = localStorage.getItem("kuyumcu_erp_active_db");
  const activeDb = rawDb && rawDb !== "test" ? rawDb : "R2016_dvz";
  const rawServer = localStorage.getItem("kuyumcu_erp_active_server");
  const activeServer = rawServer && rawServer !== "test" ? rawServer : "localhost";


  const [users, setUsers] = useState<UserProfile[]>([defaultNewUserTemplate]);
  const [userIndex, setUserIndex] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<UserProfile>(defaultNewUserTemplate);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(true);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);


  const autoSaveTimerRef = useRef<any>(null);

  const autoSaveAppearance = useCallback(
    (newAppearance: UserProfile["appearance"], userToSave: UserProfile) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          // If editing an existing user record in the DB, update that user record directly
          // CRITICAL: NEVER overwrite logged-in user session (kuyumcu_erp_user) or trigger refreshUser()!
          if (userToSave.id) {
            await UserService.updateUser(userToSave.id, {
              ...userToSave,
              appearance: newAppearance,
            });
            // Update local users array
            setUsers((prev) =>
              prev.map((u) => (String(u.id) === String(userToSave.id) ? { ...u, appearance: newAppearance } : u))
            );
          }
        } catch (err) {
          console.warn("Otomatik görünüm veritabanı kaydı:", err);
        }
      }, 150);
    },
    []
  );


  const handleApplyThemePreset = (preset: ThemePreset) => {
    if (!preset.appearance) return;
    const newAppearance = {
      ...currentUser.appearance,
      ...preset.appearance,
    };
    const updatedUser = {
      ...currentUser,
      appearance: newAppearance,
    };
    setCurrentUser(updatedUser);
    window.dispatchEvent(new CustomEvent("kuyumcu_preview_appearance", { detail: newAppearance }));

    if (currentUser.id && !isNewRecord) {
      autoSaveAppearance(newAppearance, updatedUser);
      setAlertSuccess(`"${preset.name}" tema paketi uygulandı ve veritabanına otomatik kaydedildi.`);
    } else {
      setAlertSuccess(`"${preset.name}" tema paketi seçildi. Yeni kullanıcıyı kaydetmek için sol üstteki "Kaydet" (💾) butonuna basınız.`);
    }
    setTimeout(() => setAlertSuccess(null), 3000);
  };





  // Modal States
  const [showConsolidatedModal, setShowConsolidatedModal] = useState<boolean>(false);
  const [showEDocumentModal, setShowEDocumentModal] = useState<boolean>(false);
  const [showCashierModal, setShowCashierModal] = useState<boolean>(false);
  const [cashierList, setCashierList] = useState<{ id: number; kod: string; name: string }[]>([]);

  // Selected cashier matching helper for dropdown
  const selectedCashierValue = useMemo(() => {
    const raw = String(currentUser?.cashierCode || "").trim();
    if (!raw) return "";
    const matched = cashierList.find(
      (c) =>
        String(c.kod).toLowerCase() === raw.toLowerCase() ||
        String(c.id) === raw
    );
    return matched ? (matched.kod || String(matched.id)) : raw;
  }, [currentUser?.cashierCode, cashierList]);

  // Consolidated Databases Modal State
  const [dbList, setDbList] = useState([
    { id: "1", name: `${activeDb} (Aktif SQL)`, server: activeServer, active: true },
  ]);

  // Load users from SQL database on mount
  const loadUsersFromDb = async (selectIndex?: number) => {
    try {
      setIsLoading(true);
      const [res, cashiers] = await Promise.all([
        UserService.listUsers(),
        CashDeskService.getVezneler().catch(async () => {
          const c = await UserService.getCashiers().catch(() => []);
          return c.map((item: any) => ({
            id: item.id,
            kod: item.kod || String(item.id),
            ad: item.name || `Vezne ${item.id}`,
          }));
        }),
      ]);

      const mappedCashiers = (cashiers || []).map((v: any) => ({
        id: v.id,
        kod: (v.kod || "").trim() || String(v.id),
        name: (v.ad || v.name || "").trim() || `Vezne ${v.id}`,
      }));
      setCashierList(mappedCashiers);

      const dbUsers = res.data || [];
      setUsers(dbUsers);

      if (selectIndex !== undefined && dbUsers.length > 0 && selectIndex >= 0) {
        const idx = Math.min(selectIndex, dbUsers.length - 1);
        setUserIndex(idx);
        setCurrentUser(JSON.parse(JSON.stringify(dbUsers[idx])));
        setIsNewRecord(false);
      } else {
        // Always default to new user creation mode
        setUserIndex(0);
        setCurrentUser({
          ...defaultNewUserTemplate,
          id: "",
          username: "",
          fullName: "",
          password: "",
          cashierCode: mappedCashiers.length > 0 ? (mappedCashiers[0].kod || String(mappedCashiers[0].id)) : "00",
          isActive: true,
        });
        setIsNewRecord(true);
      }
    } catch (err: any) {

      console.warn("SQL Server'dan kullanıcılar yüklenirken fallback kullanılıyor:", err.message);
      setUsers([defaultNewUserTemplate]);
      setCurrentUser(defaultNewUserTemplate);
      setIsNewRecord(true);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    loadUsersFromDb();
  }, []);



  // Helper to update field
  const updateField = <K extends keyof UserProfile>(field: K, value: UserProfile[K]) => {
    setCurrentUser((prev) => ({ ...prev, [field]: value }));
  };

  const isDefaultOrPlaceholder = (val: any) => {
    if (val === undefined || val === null) return true;
    const str = String(val).trim();
    return (
      str === "0" ||
      str === "00" ||
      str === "0.00" ||
      str === "1" ||
      str === "EMM2026" ||
      str === "EAR2026" ||
      str === "EFN2026" ||
      str === "Şifre girin" ||
      str === "Kullanıcı adı girin"
    );
  };

  const handleInputFocusOrClick = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement> | React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>,
    field?: keyof UserProfile
  ) => {
    const target = e.currentTarget;
    if (field && isDefaultOrPlaceholder(currentUser[field])) {
      updateField(field, "" as any);
    } else {
      target.select();
    }
  };


  const updateAppearanceField = <K extends keyof UserProfile["appearance"]>(
    field: K,
    value: UserProfile["appearance"][K]
  ) => {
    const updatedAppearance = {
      ...currentUser.appearance,
      [field]: value,
    };
    const updatedUser = {
      ...currentUser,
      appearance: updatedAppearance,
    };

    setCurrentUser(updatedUser);

    // Direct DOM style update
    window.dispatchEvent(new CustomEvent("kuyumcu_preview_appearance", { detail: updatedAppearance }));

    // Auto-save to SQL database (only for existing saved user records, never touches active auth session)
    if (currentUser.id && !isNewRecord) {
      autoSaveAppearance(updatedAppearance, updatedUser);
    }
  };




  const updateMenuPerm = (menuKey: keyof UserProfile["menuPerms"], value: string) => {
    setCurrentUser((prev) => ({
      ...prev,
      menuPerms: { ...prev.menuPerms, [menuKey]: value },
    }));
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const trimmedUsername = (currentUser.username || "").trim();
      if (!trimmedUsername) {
        setAlertError("Lütfen kullanıcı adı alanını doldurunuz.");
        return;
      }

      if (trimmedUsername.includes(" ")) {
        setAlertError("Kullanıcı adında boşluk karakteri kullanılamaz.");
        return;
      }

      const cashierVal = String(currentUser.cashierCode ?? "").trim();
      if (!cashierVal) {
        setAlertError("Lütfen vezne numarasını doldurunuz.");
        return;
      }

      // Her zaman yeni kullanıcı ekleme modunda: Kullanıcı adı, şifre ve vezne ile yeni kayıt eklenir
      const isDuplicate = users.some(
        (u) => u.id && u.username.toLowerCase() === trimmedUsername.toLowerCase()
      );
      if (isDuplicate) {
        setAlertError(`"${trimmedUsername}" kullanıcı adı daha önce kayıtlıdır. Lütfen farklı bir kullanıcı adı seçiniz.`);
        return;
      }

      const { id, ...newUserData } = currentUser;
      const created = await UserService.createUser({
        ...newUserData,
        username: trimmedUsername.replace(/\s+/g, ""),
      });
      setAlertSuccess(`"${created.username}" kullanıcısı başarıyla veritabanına eklendi.`);

      // Veritabanındaki kullanıcı listesini arka planda güncelle
      const res = await UserService.listUsers();
      setUsers(res.data || []);

      // Formu her zaman yeni kullanıcı eklemeye hazır olarak temizle
      setCurrentUser({
        ...defaultNewUserTemplate,
        id: "",
        username: "",
        fullName: "",
        password: "",
        cashierCode: cashierList.length > 0 ? (cashierList[0].kod || String(cashierList[0].id)) : "00",
        isActive: true,
      });
      setIsNewRecord(true);
      setTimeout(() => setAlertSuccess(null), 4500);
    } catch (err: any) {



      setAlertError(err.message || "Kaydetme sırasında bir hata oluştu.");
      setTimeout(() => setAlertError(null), 6000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadUsersFromDb(isNewRecord ? undefined : userIndex);
    setAlertSuccess("Veritabanından kullanıcı verileri yenilendi.");
    setTimeout(() => setAlertSuccess(null), 2500);
  };


  const handleNewUser = () => {
    const blankUser: UserProfile = {
      ...defaultNewUserTemplate,
      id: "",
      username: "",
      fullName: "",
      password: "",
      cashierCode: "",
      isActive: true,
    };
    setCurrentUser(blankUser);
    setIsNewRecord(true);
    setAlertSuccess("Yeni kullanıcı modu aktif. Bilgileri girip 'Kaydet' butonuna basınız.");
    setTimeout(() => setAlertSuccess(null), 3000);
  };

  const handleDelete = async () => {
    if (!currentUser.id || isNewRecord) {
      handleNewUser();
      return;
    }
    const confirmDelete = window.confirm(
      `"${currentUser.username}" (ID: ${currentUser.id}) kullanıcısını SQL veritabanından kalıcı olarak silmek istediğinize emin misiniz?`
    );
    if (!confirmDelete) return;

    try {
      setIsLoading(true);
      await UserService.deleteUser(currentUser.id);
      setAlertSuccess(`"${currentUser.username}" kullanıcısı veritabanından silindi.`);
      await loadUsersFromDb(Math.max(0, userIndex - 1));
      setTimeout(() => setAlertSuccess(null), 3500);
    } catch (err: any) {
      setAlertError(`Silme hatası: ${err.message || "Bilinmeyen hata"}`);
      setTimeout(() => setAlertError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavigate = (direction: "first" | "prev" | "next" | "last") => {
    if (users.length === 0) return;
    setIsNewRecord(false);
    let nextIdx = userIndex;
    if (direction === "first") nextIdx = 0;
    else if (direction === "prev") nextIdx = Math.max(0, userIndex - 1);
    else if (direction === "next") nextIdx = Math.min(users.length - 1, userIndex + 1);
    else if (direction === "last") nextIdx = users.length - 1;

    setUserIndex(nextIdx);
    setCurrentUser(JSON.parse(JSON.stringify(users[nextIdx])));
  };

  const handlePrint = () => {
    printReportTable<UserProfile>({
      title: "Kullanıcı Tanımları Listesi Raporu",
      subtitle: `Sistem Kullanıcıları Dökümü (${users.length} Kayıt)`,
      data: users,
      columns: [
        { header: "Kullanıcı Adı", key: "username", width: "18%" },
        { header: "Adı Soyadı", key: "fullName", width: "26%" },
        { header: "Vezne Kodu", key: "cashierCode", width: "16%", align: "center" },
        { header: "Yetki Rolü", key: "role", width: "16%", align: "center" },
        { header: "Durum", render: (item) => (item.isActive ? "Aktif" : "Pasif"), width: "14%", align: "center" },
      ],
      summaryInfo: `Toplam Kullanıcı Sayısı: ${users.length}`,
    });
  };


  return (
    <div className="p-2 p-md-3">
      <ERPToolbar
        onNew={handleNewUser}
        onSave={handleSave}
        onSearch={() => {
          const searchInput = document.querySelector<HTMLInputElement>("input[placeholder*='ara' i]");
          if (searchInput) {
            searchInput.focus();
            searchInput.select();
          }
        }}
        onDelete={handleDelete}
        onFirst={() => handleNavigate("first")}
        onPrev={() => handleNavigate("prev")}
        onNext={() => handleNavigate("next")}
        onLast={() => handleNavigate("last")}
        onPrint={handlePrint}
        onRefresh={handleRefresh}
        onEDocument={() => setShowEDocumentModal(true)}
        onConsolidatedDB={() => setShowConsolidatedModal(true)}
      />


      {alertSuccess && (
        <Alert variant="success" className="d-flex align-items-center gap-2 py-2 mb-3 shadow-sm border-0">
          <IconCheck size={18} />
          <span>{alertSuccess}</span>
        </Alert>
      )}

      {alertError && (
        <Alert variant="danger" className="d-flex align-items-center gap-2 py-2 mb-3 shadow-sm border-0">
          <IconAlertCircle size={18} />
          <span>{alertError}</span>
        </Alert>
      )}

      <Card className="border-0 shadow-sm rounded-3 mb-4 bg-white">
        <Card.Body className="p-3 p-md-4">
          {/* Kullanıcı Adı, Şifre, Vezne Giriş Alanları (Her zaman yeni kullanıcı eklemeye hazır) */}


          <Row className="g-3 align-items-center">
            <Col xs={12} md={4}>
              <Form.Group as={Row} className="align-items-center mb-0">
                <Form.Label column sm={4} className="small text-secondary fw-semibold text-sm-end pe-2 mb-0">
                  Kullanıcı Adı:
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-light text-muted">
                      <IconUser size={16} />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      value={currentUser.username || ""}
                      disabled={isLoading}
                      onFocus={(e) => handleInputFocusOrClick(e, "username")}
                      onClick={(e) => handleInputFocusOrClick(e, "username")}
                      onChange={(e) => updateField("username", e.target.value.replace(/\s+/g, ""))}
                      className="border"
                    />
                  </InputGroup>
                </Col>
              </Form.Group>
            </Col>

            <Col xs={12} md={4}>
              <Form.Group as={Row} className="align-items-center mb-0">
                <Form.Label column sm={4} className="small text-secondary fw-semibold text-sm-end pe-2 mb-0">
                  Şifre:
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-light text-muted">
                      <IconKey size={16} />
                    </InputGroup.Text>
                    <Form.Control
                      type={showPassword ? "text" : "password"}
                      value={currentUser.password || ""}
                      disabled={isLoading}
                      onFocus={(e) => handleInputFocusOrClick(e, "password")}
                      onClick={(e) => handleInputFocusOrClick(e, "password")}
                      onChange={(e) => updateField("password", e.target.value)}
                      className="border"
                    />
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Şifreyi Gizle" : "Şifreyi Göster"}
                    >
                      {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>
            </Col>

            <Col xs={12} md={4}>
              <Form.Group as={Row} className="align-items-center mb-0">
                <Form.Label column sm={4} className="small text-secondary fw-semibold text-sm-end pe-2 mb-0">
                  Vezne:
                </Form.Label>
                <Col sm={8}>
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-light text-muted">
                      <IconCash size={16} />
                    </InputGroup.Text>
                    <Form.Select
                      size="sm"
                      value={selectedCashierValue}
                      disabled={isLoading}
                      onChange={(e) => updateField("cashierCode", e.target.value)}
                      className="border fw-bold font-monospace"
                    >
                      <option value="">-- Vezne Seçiniz --</option>
                      {cashierList.map((c) => (
                        <option key={c.id} value={c.kod || String(c.id)}>
                          [{c.kod}] {c.name}
                        </option>
                      ))}
                    </Form.Select>
                    <Button
                      variant="outline-secondary"
                      onClick={() => setShowCashierModal(true)}
                      title="Vezne Listesinde Ara & Seç"
                      className="d-flex align-items-center justify-content-center px-2.5 bg-light"
                    >
                      <IconSearch size={16} />
                    </Button>
                  </InputGroup>
                </Col>
              </Form.Group>
            </Col>
          </Row>

        </Card.Body>
      </Card>

      <Tab.Container defaultActiveKey="genel">
        <Card className="border-0 shadow-sm rounded-3 bg-white overflow-hidden mb-4">
          <Card.Header className="bg-white border-bottom p-0">
            <Nav className="nav-line-bottom px-3 pt-1 border-0" defaultActiveKey="genel">
              <Nav.Item>
                <Nav.Link
                  role="button"
                  eventKey="genel"
                  className="d-flex align-items-center gap-2 py-3 px-3 fw-semibold"
                >
                  <IconAdjustments size={18} /> Genel
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  role="button"
                  eventKey="gorunum"
                  className="d-flex align-items-center gap-2 py-3 px-3 fw-semibold"
                >
                  <IconPalette size={18} /> Görünüm
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Card.Header>

          <Card.Body className="p-3 p-md-4">
            <Tab.Content>
              {/* TAB 1: GENEL AYARLAR */}
              <Tab.Pane eventKey="genel">
                <Row className="g-4">
                  {/* Sol Kolon: İzinler & Yetkiler Checkbox Listesi */}
                  <Col xs={12} lg={4}>
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <h6 className="fw-bold text-dark mb-3 pb-2 border-bottom d-flex align-items-center justify-content-between">
                        <span>Yetki ve İzin Seçenekleri</span>
                        {currentUser.isSysAdmin && (
                          <Badge bg="primary" className="fw-normal">
                            Yönetici
                          </Badge>
                        )}
                      </h6>

                      <div className="d-flex flex-column gap-2 mb-2">
                        <Form.Check
                          type="checkbox"
                          id="isSysAdmin"
                          label={<span className="fw-bold text-primary">Sistem yöneticisi</span>}
                          checked={currentUser.isSysAdmin}
                          onChange={(e) => updateField("isSysAdmin", e.target.checked)}
                        />

                        {/* İşlem Gösterme Gün Sayısı */}
                        <div className="d-flex align-items-center justify-content-between my-2 p-2 bg-white rounded border">
                          <span className="small text-secondary fw-semibold">
                            İşlem gösterme gün sayısı
                          </span>
                          <Form.Control
                            type="text"
                            size="sm"
                            style={{ width: "80px" }}
                            value={currentUser.displayDays || ""}
                            onFocus={(e) => handleInputFocusOrClick(e, "displayDays")}
                            onClick={(e) => handleInputFocusOrClick(e, "displayDays")}
                            onChange={(e) =>
                              updateField("displayDays", e.target.value)
                            }
                            className="text-center bg-light border fw-bold"
                          />
                        </div>

                        <Form.Check
                          type="checkbox"
                          id="hasWorkspacePerm"
                          label="Çalışma alanı işlemleri yetkisi"
                          checked={currentUser.hasWorkspacePerm}
                          onChange={(e) =>
                            updateField("hasWorkspacePerm", e.target.checked)
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="hasDateChangePerm"
                          label="Tarih değiştirme yetkisi"
                          checked={currentUser.hasDateChangePerm}
                          onChange={(e) =>
                            updateField("hasDateChangePerm", e.target.checked)
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="hasCommissionPerm"
                          label="Komisyon alma yetkisi"
                          checked={currentUser.hasCommissionPerm}
                          onChange={(e) =>
                            updateField("hasCommissionPerm", e.target.checked)
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="hasSlipNoChangePerm"
                          label="Fiş numarası değiştirme yetkisi"
                          checked={currentUser.hasSlipNoChangePerm}
                          onChange={(e) =>
                            updateField("hasSlipNoChangePerm", e.target.checked)
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="hasCashDeskBalanceCheck"
                          label="Vezne bakiye kontrolü"
                          checked={currentUser.hasCashDeskBalanceCheck}
                          onChange={(e) =>
                            updateField("hasCashDeskBalanceCheck", e.target.checked)
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="canViewAccountBalance"
                          label="Cari bakiye görebilir"
                          checked={currentUser.canViewAccountBalance}
                          onChange={(e) =>
                            updateField("canViewAccountBalance", e.target.checked)
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="canViewOpenTermTrans"
                          label="Açık vadeli işlemleri görebilir"
                          checked={currentUser.canViewOpenTermTrans}
                          onChange={(e) =>
                            updateField("canViewOpenTermTrans", e.target.checked)
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="hasSlipBankAccountPerm"
                          label="Fiş banka hesabı seçme yetkisi"
                          checked={currentUser.hasSlipBankAccountPerm}
                          onChange={(e) =>
                            updateField("hasSlipBankAccountPerm", e.target.checked)
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="hasSlipAmountChangePerm"
                          label="Fişte tutar değiştirme yetkisi"
                          checked={currentUser.hasSlipAmountChangePerm}
                          onChange={(e) =>
                            updateField("hasSlipAmountChangePerm", e.target.checked)
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="isSuspiciousTransAuth"
                          label="Şüpheli işlemler yetkilisi"
                          checked={currentUser.isSuspiciousTransAuth}
                          onChange={(e) =>
                            updateField("isSuspiciousTransAuth", e.target.checked)
                          }
                        />
                        <Form.Check
                          type="checkbox"
                          id="noCrossRateCheck"
                          label="Cari dekontda çapraz kur kontrolü yok"
                          checked={currentUser.noCrossRateCheck}
                          onChange={(e) =>
                            updateField("noCrossRateCheck", e.target.checked)
                          }
                        />
                      </div>
                    </div>
                  </Col>

                  {/* Orta Kolon: Donanım, Zoom, Oranlar & Kur Yetkisi */}
                  <Col xs={12} lg={4}>
                    <div className="p-3 rounded-3 border bg-light h-100 d-flex flex-column gap-3">
                      <h6 className="fw-bold text-dark pb-2 border-bottom mb-0">
                        Donanım, Yakınlaştırma & Kur
                      </h6>

                      {/* Yazıcı */}
                      <div className="p-2 bg-white rounded border">
                        <Form.Group as={Row} className="align-items-center mb-0">
                          <Form.Label column sm={4} className="small text-secondary fw-semibold text-sm-end pe-2 mb-0 d-flex align-items-center gap-1">
                            <IconPrinter size={16} /> Yazıcı:
                          </Form.Label>
                          <Col sm={8}>
                            <InputGroup size="sm">
                              <Form.Control
                                type="text"
                                value={currentUser.printerId || ""}
                                onFocus={(e) => handleInputFocusOrClick(e, "printerId")}
                                onClick={(e) => handleInputFocusOrClick(e, "printerId")}
                                onChange={(e) => updateField("printerId", e.target.value)}
                                className="bg-light border fw-bold text-center"
                              />
                              <Button
                                variant="outline-secondary"
                                onClick={() => alert("Sistem yazıcıları")}
                              >
                                <IconSearch size={15} />
                              </Button>
                            </InputGroup>
                          </Col>
                        </Form.Group>
                      </div>

                      {/* Zoom Ayarları */}
                      <div className="p-2 bg-white rounded border">
                        <span className="small text-secondary fw-semibold d-flex align-items-center gap-1 mb-2">
                          <IconZoomIn size={16} /> Ekran Yakınlaştırma
                        </span>
                        <div className="d-flex flex-column gap-2">
                          <Form.Group as={Row} className="align-items-center mb-0">
                            <Form.Label column sm={5} className="small text-muted text-sm-end pe-2 mb-0">Yatay zoom:</Form.Label>
                            <Col sm={7}>
                              <Form.Control
                                type="text"
                                size="sm"
                                value={currentUser.horizontalZoom || ""}
                                onFocus={(e) => handleInputFocusOrClick(e, "horizontalZoom")}
                                onClick={(e) => handleInputFocusOrClick(e, "horizontalZoom")}
                                onChange={(e) =>
                                  updateField("horizontalZoom", e.target.value)
                                }
                                className="bg-light border text-center"
                              />
                            </Col>
                          </Form.Group>
                          <Form.Group as={Row} className="align-items-center mb-0">
                            <Form.Label column sm={5} className="small text-muted text-sm-end pe-2 mb-0">Dikey zoom:</Form.Label>
                            <Col sm={7}>
                              <Form.Control
                                type="text"
                                size="sm"
                                value={currentUser.verticalZoom || ""}
                                onFocus={(e) => handleInputFocusOrClick(e, "verticalZoom")}
                                onClick={(e) => handleInputFocusOrClick(e, "verticalZoom")}
                                onChange={(e) =>
                                  updateField("verticalZoom", e.target.value)
                                }
                                className="bg-light border text-center"
                              />
                            </Col>
                          </Form.Group>
                        </div>
                      </div>

                      {/* Komisyon Oranı */}
                      <div className="p-2 bg-white rounded border">
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <Form.Check
                            type="checkbox"
                            id="hasCommissionRate"
                            label={<span className="small fw-semibold text-secondary">Komisyon oranı</span>}
                            checked={currentUser.hasCommissionRate}
                            onChange={(e) =>
                              updateField("hasCommissionRate", e.target.checked)
                            }
                          />
                          <InputGroup size="sm" style={{ width: "110px" }}>
                            <Form.Control
                              type="text"
                              disabled={!currentUser.hasCommissionRate}
                              value={currentUser.commissionRate || ""}
                              onFocus={(e) => handleInputFocusOrClick(e, "commissionRate")}
                              onClick={(e) => handleInputFocusOrClick(e, "commissionRate")}
                              onChange={(e) =>
                                updateField("commissionRate", e.target.value)
                              }
                              className="bg-light border text-end"
                            />
                            <InputGroup.Text className="bg-light small px-1">%</InputGroup.Text>
                          </InputGroup>
                        </div>
                      </div>

                      {/* Kur Yetkisi */}
                      <div className="p-2 bg-white rounded border">
                        <Form.Group as={Row} className="align-items-center mb-0">
                          <Form.Label column sm={4} className="small text-secondary fw-semibold text-sm-end pe-2 mb-0 d-flex align-items-center gap-1">
                            <IconExchange size={16} /> Kur yetkisi:
                          </Form.Label>
                          <Col sm={8}>
                            <div className="d-flex align-items-center gap-2">
                              <Form.Select
                                size="sm"
                                value={currentUser.ratePermType || "Var"}
                                onChange={(e) => updateField("ratePermType", e.target.value)}
                                style={{ width: "90px" }}
                                className="bg-light border fw-medium"
                              >
                                <option value="Var">Var</option>
                                <option value="Yok">Yok</option>
                                <option value="Limitli">Limitli</option>
                              </Form.Select>
                              <Form.Control
                                type="text"
                                size="sm"
                                value={currentUser.ratePermValue || ""}
                                onFocus={(e) => handleInputFocusOrClick(e, "ratePermValue")}
                                onClick={(e) => handleInputFocusOrClick(e, "ratePermValue")}
                                onChange={(e) =>
                                  updateField("ratePermValue", e.target.value)
                                }
                                className="bg-light border text-end"
                              />
                            </div>
                          </Col>
                        </Form.Group>
                      </div>
                    </div>
                  </Col>

                  {/* Sağ Kolon: Menü Yetkileri */}
                  <Col xs={12} lg={4}>
                    <div className="p-3 rounded-3 border bg-light h-100">
                      <h6 className="fw-bold text-dark pb-2 border-bottom mb-2 d-flex align-items-center justify-content-between">
                        <span>Menü yetkileri</span>
                      </h6>

                      <div className="bg-white rounded border overflow-hidden">
                        <Table size="sm" className="align-middle mb-0" style={{ tableLayout: "fixed", width: "100%" }}>
                          <thead className="bg-light">
                            <tr>
                              <th className="small text-secondary px-2 py-1" style={{ width: "48%" }}>
                                Menü
                              </th>
                              <th className="small text-secondary px-2 py-1 text-end" style={{ width: "52%" }}>
                                Yetki
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { label: "Ana menü", key: "mainMenu" as const },
                              { label: "Vezne işlemleri", key: "cashier" as const },
                              { label: "Kasa işlemleri", key: "safe" as const },
                              { label: "Kur işlemleri", key: "exchange" as const },
                              { label: "Cari işlemler", key: "accounts" as const },
                              { label: "Yönetici işlemleri", key: "admin" as const },
                              { label: "Muhasebe", key: "accounting" as const },
                              { label: "Raporlar", key: "reports" as const },
                              { label: "Konsolide raporlar", key: "consolidatedReports" as const },
                              { label: "Teknik işlemler", key: "techOps" as const },
                              { label: "Hareket tipi", key: "movementType" as const },
                            ].map((item) => (
                              <tr key={item.key}>
                                <td className="small fw-medium px-2 py-1 text-truncate" title={item.label}>
                                  {item.label}
                                </td>
                                <td className="px-1 py-1">
                                  <Form.Select
                                    size="sm"
                                    value={currentUser.menuPerms[item.key]}
                                    onChange={(e) => updateMenuPerm(item.key, e.target.value)}
                                    className="bg-light border text-dark fw-semibold w-100"
                                    style={{
                                      fontSize: "11.5px",
                                      paddingTop: "2px",
                                      paddingBottom: "2px",
                                      paddingLeft: "4px",
                                      paddingRight: "18px",
                                      minHeight: "28px",
                                    }}
                                  >
                                    <option value="Tam Yetki">Tam Yetki</option>
                                    <option value="Kısıtlı">Kısıtlı</option>
                                    <option value="Görüntüleme">Görüntüleme</option>
                                    <option value="Yetki Yok">Yetki Yok</option>
                                  </Form.Select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    </div>
                  </Col>

                  {/* Alt Kısım: İstatistik Kodları */}
                  <Col xs={12}>
                    <div className="p-3 rounded-3 border bg-light">
                      <Row className="g-3">
                        <Col xs={12} sm={6} md={3}>
                          <Form.Group as={Row} className="align-items-center mb-0">
                            <Form.Label column sm={5} className="small text-secondary fw-semibold text-sm-end pe-2 mb-0">
                              Alış kodu:
                            </Form.Label>
                            <Col sm={7}>
                              <InputGroup size="sm">
                                <Form.Control
                                  type="text"
                                  value={currentUser.buyStatCode || ""}
                                  onFocus={(e) => handleInputFocusOrClick(e, "buyStatCode")}
                                  onClick={(e) => handleInputFocusOrClick(e, "buyStatCode")}
                                  onChange={(e) => updateField("buyStatCode", e.target.value)}
                                  className="bg-white border"
                                />
                                <Button variant="outline-secondary" onClick={() => alert("Kod arama")}>
                                  <IconSearch size={14} />
                                </Button>
                              </InputGroup>
                            </Col>
                          </Form.Group>
                        </Col>

                        <Col xs={12} sm={6} md={3}>
                          <Form.Group as={Row} className="align-items-center mb-0">
                            <Form.Label column sm={5} className="small text-secondary fw-semibold text-sm-end pe-2 mb-0">
                              Satış kodu:
                            </Form.Label>
                            <Col sm={7}>
                              <InputGroup size="sm">
                                <Form.Control
                                  type="text"
                                  value={currentUser.sellStatCode || ""}
                                  onFocus={(e) => handleInputFocusOrClick(e, "sellStatCode")}
                                  onClick={(e) => handleInputFocusOrClick(e, "sellStatCode")}
                                  onChange={(e) => updateField("sellStatCode", e.target.value)}
                                  className="bg-white border"
                                />
                                <Button variant="outline-secondary" onClick={() => alert("Kod arama")}>
                                  <IconSearch size={14} />
                                </Button>
                              </InputGroup>
                            </Col>
                          </Form.Group>
                        </Col>

                        <Col xs={12} sm={6} md={3}>
                          <Form.Group as={Row} className="align-items-center mb-0">
                            <Form.Label column sm={5} className="small text-secondary fw-semibold text-sm-end pe-2 mb-0">
                              Arbitraj alış:
                            </Form.Label>
                            <Col sm={7}>
                              <InputGroup size="sm">
                                <Form.Control
                                  type="text"
                                  value={currentUser.arbitrageBuyStatCode || ""}
                                  onFocus={(e) => handleInputFocusOrClick(e, "arbitrageBuyStatCode")}
                                  onClick={(e) => handleInputFocusOrClick(e, "arbitrageBuyStatCode")}
                                  onChange={(e) =>
                                    updateField("arbitrageBuyStatCode", e.target.value)
                                  }
                                  className="bg-white border"
                                />
                                <Button variant="outline-secondary" onClick={() => alert("Kod arama")}>
                                  <IconSearch size={14} />
                                </Button>
                              </InputGroup>
                            </Col>
                          </Form.Group>
                        </Col>

                        <Col xs={12} sm={6} md={3}>
                          <Form.Group as={Row} className="align-items-center mb-0">
                            <Form.Label column sm={5} className="small text-secondary fw-semibold text-sm-end pe-2 mb-0">
                              Arbitraj satış:
                            </Form.Label>
                            <Col sm={7}>
                              <InputGroup size="sm">
                                <Form.Control
                                  type="text"
                                  value={currentUser.arbitrageSellStatCode || ""}
                                  onFocus={(e) => handleInputFocusOrClick(e, "arbitrageSellStatCode")}
                                  onClick={(e) => handleInputFocusOrClick(e, "arbitrageSellStatCode")}
                                  onChange={(e) =>
                                    updateField("arbitrageSellStatCode", e.target.value)
                                  }
                                  className="bg-white border"
                                />
                                <Button variant="outline-secondary" onClick={() => alert("Kod arama")}>
                                  <IconSearch size={14} />
                                </Button>
                              </InputGroup>
                            </Col>
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>
                  </Col>

                </Row>
              </Tab.Pane>

              {/* TAB 2: GÖRÜNÜM AYARLARI */}
              <Tab.Pane eventKey="gorunum">
                <div className="d-flex flex-column gap-4">
                  <Row className="g-4">
                    {/* Sol Kolon: Program & Grid Görünümü */}
                    <Col xs={12} md={6}>
                      <div className="p-3 rounded-3 border bg-light h-100">
                        <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-3">
                          <Form.Check
                            type="checkbox"
                            id="enableProgramTheme"
                            label={<span className="fw-bold text-dark">Program</span>}
                            checked={currentUser.appearance?.enableProgramTheme ?? true}
                            onChange={(e) =>
                              updateAppearanceField("enableProgramTheme", e.target.checked)
                            }
                          />
                        </div>

                        <div className="d-flex flex-column gap-2">
                          {/* Zemin Rengi */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Zemin rengi</span>
                            <div className="d-flex align-items-center gap-2">
                              <input
                                type="color"
                                value={currentUser.appearance?.programBgColor || "#f8fafc"}
                                onChange={(e) => updateAppearanceField("programBgColor", e.target.value)}
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "36px", height: "30px", cursor: "pointer" }}
                              />
                            </div>
                          </div>

                          {/* Yazı Rengi */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Yazı rengi</span>
                            <div className="d-flex align-items-center gap-2">
                              <input
                                type="color"
                                value={currentUser.appearance?.programTextColor || "#0f172a"}
                                onChange={(e) => updateAppearanceField("programTextColor", e.target.value)}
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "36px", height: "30px", cursor: "pointer" }}
                              />
                            </div>
                          </div>

                          {/* Font */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Program fontu</span>
                            <FontSelectDropdown
                              value={currentUser.appearance?.programFont || "Segoe UI, sans-serif"}
                              onChange={(val) => updateAppearanceField("programFont", val)}
                            />
                          </div>

                          {/* Grid Başlık Rengi */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Grid başlık rengi</span>
                            <input
                              type="color"
                              value={currentUser.appearance?.gridHeaderBgColor || "#cbe5ff"}
                              onChange={(e) =>
                                updateAppearanceField("gridHeaderBgColor", e.target.value)
                              }
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                          </div>

                          {/* Grid Zemin Rengi */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Grid zemin rengi</span>
                            <input
                              type="color"
                              value={currentUser.appearance?.gridBgColor || "#ffffff"}
                              onChange={(e) => updateAppearanceField("gridBgColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                          </div>

                          {/* Grid Fontu */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Grid fontu</span>
                            <FontSelectDropdown
                              value={currentUser.appearance?.gridFont || "Segoe UI, sans-serif"}
                              onChange={(val) => updateAppearanceField("gridFont", val)}
                            />
                          </div>

                          {/* Pencere Zemin Rengi */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Pencere zemin rengi</span>
                            <input
                              type="color"
                              value={currentUser.appearance?.windowBgColor || "#ffffff"}
                              onChange={(e) => updateAppearanceField("windowBgColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                          </div>

                          {/* Pencere Yazı Rengi */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Pencere yazı rengi</span>
                            <input
                              type="color"
                              value={currentUser.appearance?.windowTextColor || "#000000"}
                              onChange={(e) => updateAppearanceField("windowTextColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                          </div>

                          {/* Pencere Fokus Rengi */}
                          <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                            <span className="small fw-semibold text-secondary">Pencere fokus rengi</span>
                            <input
                              type="color"
                              value={currentUser.appearance?.windowFocusColor || "#e2e8f0"}
                              onChange={(e) => updateAppearanceField("windowFocusColor", e.target.value)}
                              className="form-control form-control-color p-0 border-0"
                              style={{ width: "36px", height: "30px", cursor: "pointer" }}
                            />
                          </div>
                        </div>
                      </div>
                    </Col>

                    {/* Sağ Kolon: Menü, Alış & Satış Başlığı */}
                    <Col xs={12} md={6}>
                      <div className="d-flex flex-column gap-3 h-100">
                        {/* Menü Görünümü */}
                        <div className="p-3 rounded-3 border bg-light">
                          <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
                            <Form.Check
                              type="checkbox"
                              id="enableMenuTheme"
                              label={<span className="fw-bold text-dark">Menü</span>}
                              checked={currentUser.appearance?.enableMenuTheme ?? true}
                              onChange={(e) =>
                                updateAppearanceField("enableMenuTheme", e.target.checked)
                              }
                            />
                          </div>

                          <div className="d-flex flex-column gap-2">
                            <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                              <span className="small fw-semibold text-secondary">Zemin rengi</span>
                              <input
                                type="color"
                                value={currentUser.appearance?.menuBgColor || "#bfe0ff"}
                                onChange={(e) => updateAppearanceField("menuBgColor", e.target.value)}
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "36px", height: "30px", cursor: "pointer" }}
                              />
                            </div>

                            <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                              <span className="small fw-semibold text-secondary">Seçilen zemin rengi</span>
                              <input
                                type="color"
                                value={currentUser.appearance?.menuSelectedBgColor || "#ff80ff"}
                                onChange={(e) =>
                                  updateAppearanceField("menuSelectedBgColor", e.target.value)
                                }
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "36px", height: "30px", cursor: "pointer" }}
                              />
                            </div>

                            {/* Menü Fontu */}
                            <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                              <span className="small fw-semibold text-secondary">Menü fontu</span>
                              <FontSelectDropdown
                                value={currentUser.appearance?.menuFont || "Segoe UI, sans-serif"}
                                onChange={(val) => updateAppearanceField("menuFont", val)}
                              />
                            </div>

                            {/* Menü Başlık Fontu */}
                            <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                              <span className="small fw-semibold text-secondary">Menü başlık fontu</span>
                              <FontSelectDropdown
                                value={currentUser.appearance?.menuHeaderFont || "Segoe UI, sans-serif"}
                                onChange={(val) => updateAppearanceField("menuHeaderFont", val)}
                              />
                            </div>


                            <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                              <span className="small fw-semibold text-secondary">Başlık zemin rengi</span>
                              <input
                                type="color"
                                value={currentUser.appearance?.menuHeaderBgColor || "#000080"}
                                onChange={(e) =>
                                  updateAppearanceField("menuHeaderBgColor", e.target.value)
                                }
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "36px", height: "30px", cursor: "pointer" }}
                              />
                            </div>

                            <div className="d-flex align-items-center justify-content-between p-2 bg-white rounded border">
                              <span className="small fw-semibold text-secondary">Arka plan rengi</span>
                              <input
                                type="color"
                                value={currentUser.appearance?.menuBackdropColor || "#ff8080"}
                                onChange={(e) =>
                                  updateAppearanceField("menuBackdropColor", e.target.value)
                                }
                                className="form-control form-control-color p-0 border-0"
                                style={{ width: "36px", height: "30px", cursor: "pointer" }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Alış Başlığı */}
                        <div className="p-3 rounded-3 border bg-light">
                          <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
                            <Form.Check
                              type="checkbox"
                              id="enableBuyHeaderTheme"
                              label={<span className="fw-bold text-dark">Alış başlığı</span>}
                              checked={currentUser.appearance?.enableBuyHeaderTheme ?? false}
                              onChange={(e) =>
                                updateAppearanceField("enableBuyHeaderTheme", e.target.checked)
                              }
                            />
                          </div>
                          <Row className="g-2">
                            <Col xs={6}>
                              <div className="p-2 bg-white rounded border d-flex align-items-center justify-content-between">
                                <span className="small text-secondary">Zemin</span>
                                <input
                                  type="color"
                                  value={currentUser.appearance?.buyHeaderBgColor || "#e2e8f0"}
                                  onChange={(e) =>
                                    updateAppearanceField("buyHeaderBgColor", e.target.value)
                                  }
                                  className="form-control form-control-color p-0 border-0"
                                  style={{ width: "30px", height: "26px" }}
                                />
                              </div>
                            </Col>
                            <Col xs={6}>
                              <div className="p-2 bg-white rounded border d-flex align-items-center justify-content-between">
                                <span className="small text-secondary">Yazı</span>
                                <input
                                  type="color"
                                  value={currentUser.appearance?.buyHeaderTextColor || "#000000"}
                                  onChange={(e) =>
                                    updateAppearanceField("buyHeaderTextColor", e.target.value)
                                  }
                                  className="form-control form-control-color p-0 border-0"
                                  style={{ width: "30px", height: "26px" }}
                                />
                              </div>
                            </Col>
                          </Row>
                        </div>

                        {/* Satış Başlığı */}
                        <div className="p-3 rounded-3 border bg-light">
                          <div className="d-flex align-items-center justify-content-between pb-2 border-bottom mb-2">
                            <Form.Check
                              type="checkbox"
                              id="enableSellHeaderTheme"
                              label={<span className="fw-bold text-dark">Satış başlığı</span>}
                              checked={currentUser.appearance?.enableSellHeaderTheme ?? false}
                              onChange={(e) =>
                                updateAppearanceField("enableSellHeaderTheme", e.target.checked)
                              }
                            />
                          </div>
                          <Row className="g-2">
                            <Col xs={6}>
                              <div className="p-2 bg-white rounded border d-flex align-items-center justify-content-between">
                                <span className="small text-secondary">Zemin</span>
                                <input
                                  type="color"
                                  value={currentUser.appearance?.sellHeaderBgColor || "#e2e8f0"}
                                  onChange={(e) =>
                                    updateAppearanceField("sellHeaderBgColor", e.target.value)
                                  }
                                  className="form-control form-control-color p-0 border-0"
                                  style={{ width: "30px", height: "26px" }}
                                />
                              </div>
                            </Col>
                            <Col xs={6}>
                              <div className="p-2 bg-white rounded border d-flex align-items-center justify-content-between">
                                <span className="small text-secondary">Yazı</span>
                                <input
                                  type="color"
                                  value={currentUser.appearance?.sellHeaderTextColor || "#000000"}
                                  onChange={(e) =>
                                    updateAppearanceField("sellHeaderTextColor", e.target.value)
                                  }
                                  className="form-control form-control-color p-0 border-0"
                                  style={{ width: "30px", height: "26px" }}
                                />
                              </div>
                            </Col>
                          </Row>
                        </div>
                      </div>
                    </Col>
                  </Row>

                  {/* HAZIR RENK & UYUMLU TEMA PAKETLERİ (PRESET THEMES) */}
                  <Card className="border shadow-sm rounded-3 bg-white mt-2">
                    <Card.Header className="bg-light py-2.5 px-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
                      <div className="d-flex align-items-center gap-2">
                        <IconSparkles className="text-warning" size={20} />
                        <span className="fw-bold text-dark fs-6">Hazır Uyumlu Renk & Font Temaları (Tek Tıkla Seç)</span>
                      </div>
                      <span className="text-muted small">
                        İstediğiniz temaya tıklayarak tüm renk ve font ayarlarını anında otomatik doldurabilirsiniz.
                      </span>
                    </Card.Header>
                    <Card.Body className="p-3">
                      <Row className="g-3">
                        {THEME_PRESETS.map((preset) => (
                          <Col xs={12} sm={6} lg={4} key={preset.id}>
                            <div className="p-3 rounded-3 border h-100 d-flex flex-column justify-content-between bg-white hover-shadow transition-all position-relative">
                              <div>
                                <div className="d-flex align-items-center justify-content-between mb-2">
                                  <Badge bg={preset.badgeColor as any} className="font-monospace px-2 py-1">
                                    {preset.badge}
                                  </Badge>
                                  <span className="small text-muted font-monospace" style={{ fontSize: "11px" }}>
                                    {preset.previewFont.split(",")[0]}
                                  </span>
                                </div>
                                <h6 className="fw-bold text-dark mb-1">{preset.name}</h6>
                                <p className="text-secondary small mb-3" style={{ fontSize: "12px", minHeight: "36px" }}>
                                  {preset.description}
                                </p>

                                {/* Mini Renk Paleti Önizleme Şeridi */}
                                <div className="d-flex align-items-center gap-1.5 p-2 rounded border mb-3" style={{ backgroundColor: preset.previewBg }}>
                                  <div
                                    className="rounded-circle border"
                                    style={{ width: "16px", height: "16px", backgroundColor: preset.previewAccent }}
                                    title="Aksan Rengi"
                                  />
                                  <div
                                    className="rounded-circle border"
                                    style={{ width: "16px", height: "16px", backgroundColor: preset.previewText }}
                                    title="Yazı Rengi"
                                  />
                                  <div
                                    className="rounded-circle border"
                                    style={{ width: "16px", height: "16px", backgroundColor: preset.previewBg }}
                                    title="Arka Plan"
                                  />
                                  <span
                                    className="ms-auto fw-bold"
                                    style={{
                                      color: preset.previewText,
                                      fontFamily: preset.previewFont,
                                      fontSize: "12px",
                                    }}
                                  >
                                    Örnek Metin ₺
                                  </span>
                                </div>
                              </div>

                              <Button
                                variant="outline-primary"
                                size="sm"
                                className="w-100 fw-semibold d-flex align-items-center justify-content-center gap-1.5 py-1.5"
                                onClick={() => handleApplyThemePreset(preset)}
                              >
                                <IconSparkles size={14} /> Bu Temayı Uygula
                              </Button>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </Card.Body>
                  </Card>
                </div>
              </Tab.Pane>


            </Tab.Content>
          </Card.Body>
        </Card>
      </Tab.Container>

      {/* Modal 1: Konsolide Veritabanları */}
      <Modal
        show={showConsolidatedModal}
        onHide={() => setShowConsolidatedModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <IconDatabase size={20} className="text-primary" /> Konsolide Veritabanı Tanımları
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <p className="text-muted small mb-3">
            Şube ve konsolide raporlama için yetkilendirilen veritabanı bağlantılarını yapılandırın.
          </p>
          <Table hover responsive className="align-middle mb-3 border">
            <thead className="bg-light">
              <tr>
                <th>Durum</th>
                <th>Veritabanı Adı</th>
                <th>Sunucu IP / Host</th>
                <th className="text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {dbList.map((db) => (
                <tr key={db.id}>
                  <td>
                    <Form.Check
                      type="switch"
                      checked={db.active}
                      onChange={() =>
                        setDbList((prev) =>
                          prev.map((d) => (d.id === db.id ? { ...d, active: !d.active } : d))
                        )
                      }
                    />
                  </td>
                  <td className="fw-semibold text-primary">{db.name}</td>
                  <td className="text-muted font-monospace">{db.server}</td>
                  <td className="text-center">
                    <Button
                      variant="outline-info"
                      size="sm"
                      className="py-0 px-2"
                      onClick={() => alert(`Bağlantı başarılı: ${db.server}`)}
                    >
                      <IconServer size={14} className="me-1" /> Test Et
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Button
            variant="outline-primary"
            size="sm"
            className="fw-semibold"
            onClick={() => {
              const newName = prompt("Yeni Veritabanı Adı:");
              if (newName) {
                setDbList([
                  ...dbList,
                  {
                    id: String(Date.now()),
                    name: newName,
                    server: "192.168.1.120",
                    active: true,
                  },
                ]);
              }
            }}
          >
            <IconPlus size={16} className="me-1" /> Yeni Veritabanı Ekle
          </Button>
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <Button variant="secondary" size="sm" onClick={() => setShowConsolidatedModal(false)}>
            Kapat
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setShowConsolidatedModal(false);
              setAlertSuccess("Konsolide veritabanı ayarları başarıyla kaydedildi.");
              setTimeout(() => setAlertSuccess(null), 3000);
            }}
          >
            Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal 2: e-Belge Tanımları */}
      <Modal
        show={showEDocumentModal}
        onHide={() => setShowEDocumentModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="bg-light">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
            <IconFileCertificate size={20} className="text-warning" /> e-Belge Tanımları & Entegrasyon
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <Row className="g-3">
            <Col xs={12} sm={6}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">
                  E-Fatura Seri / Ön Ek
                </Form.Label>
                <Form.Control
                  type="text"
                  defaultValue="EMA2026"
                  onFocus={(e) => (e.target as HTMLInputElement).select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="bg-light border"
                />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">
                  E-Arşiv Seri / Ön Ek
                </Form.Label>
                <Form.Control
                  type="text"
                  defaultValue="EMA2026"
                  onFocus={(e) => (e.target as HTMLInputElement).select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="bg-light border"
                />
              </Form.Group>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">
                  E-Müstahsil Seri / Ön Ek
                </Form.Label>
                <Form.Control
                  type="text"
                  defaultValue="EMM2026"
                  onFocus={(e) => (e.target as HTMLInputElement).select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="bg-light border"
                />
              </Form.Group>
            </Col>

            <Col xs={12} sm={6}>
              <Form.Group>
                <Form.Label className="small text-secondary fw-semibold">
                  Entegratör Seçimi
                </Form.Label>
                <Form.Select className="bg-light border">
                  <option value="uyumsoft">Uyumsoft Entegratör</option>
                  <option value="innova">İnnova Bilişim</option>
                  <option value="turkkep">TÜRKKEP</option>
                  <option value="qnb">eFinans / QNB</option>
                  <option value="logo">Logo e-Devlet</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Check
                type="checkbox"
                id="autoSendEDoc"
                defaultChecked
                label="Belge kaydedildiğinde otomatik GİB kuyruğuna aktar"
                className="small fw-semibold text-secondary"
              />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <Button variant="secondary" size="sm" onClick={() => setShowEDocumentModal(false)}>
            Kapat
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setShowEDocumentModal(false);
              setAlertSuccess("e-Belge tanımları başarıyla güncellendi.");
              setTimeout(() => setAlertSuccess(null), 3000);
            }}
          >
            Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal 3: Vezne Arama & Seçici (LookupModal) */}
      <LookupModal<{ id: number; kod: string; name: string }>
        show={showCashierModal}
        onHide={() => setShowCashierModal(false)}
        title="Vezne Listesi & Arama"
        items={cashierList}
        searchPlaceholder="Vezne kodu veya adı ile arayın..."
        columns={[
          {
            header: "Vezne Kodu",
            width: "120px",
            align: "center",
            render: (v) => <span className="badge bg-light text-primary border font-monospace fw-bold px-2 py-1">{v.kod}</span>,
          },
          {
            header: "Vezne Adı",
            render: (v) => <span className="fw-semibold text-dark">{v.name}</span>,
          },
          {
            header: "No / ID",
            width: "100px",
            align: "center",
            render: (v) => <span className="text-muted small font-monospace">#{v.id}</span>,
          },
        ]}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            item.kod.toLowerCase().includes(t) ||
            item.name.toLowerCase().includes(t) ||
            String(item.id).includes(t)
          );
        }}
        onSelect={(item) => {
          updateField("cashierCode", item.kod || String(item.id));
          setShowCashierModal(false);
        }}
      />
    </div>
  );
};

export default UserDefinitionsPage;


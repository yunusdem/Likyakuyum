import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Container, Button, Badge, Spinner } from "react-bootstrap";
import {
  IconDeviceTv,
  IconMaximize,
  IconMinimize,
  IconSettings,
  IconRefresh,
  IconBinoculars,
  IconPalette,
} from "@tabler/icons-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import LookupModal from "../../components/common/LookupModal";
import { PanoService, PanoModel, PanoSatiriModel } from "../../services/panoService";
import {
  PANO_TEMPLATES,
  resolvePanoTheme,
  DEFAULT_PANO_TEMPLATE_ID,
  PanoTheme,
} from "../../utils/panoThemes";

// Helper: Formats rate to 3 decimals with dot, e.g. "48.500" or "00.000"
const formatDigitalRate = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val)) || Number(val) === 0) {
    return "00.000";
  }
  const num = Number(val);
  const str = num.toString();
  const decimals = str.includes(".") ? str.split(".")[1].length : 0;
  const digits = Math.min(4, Math.max(3, decimals));
  return num.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

// Helper: Formats rates for Sarraf Vitrin (Matching the photo: whole numbers for gold/coins, decimals for silver/doviz)
const formatSarrafRate = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val)) || Number(val) === 0) {
    return "-";
  }
  const n = Number(val);
  if (n >= 1000) {
    return n % 1 === 0
      ? n.toLocaleString("tr-TR")
      : n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  } else {
    return n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }
};

// Dynamic rate font size auto-scaler for cyber layout
const getDigitalRateFontSize = (str: string, isMajor: boolean = false): string => {
  const len = str.length;
  if (isMajor) {
    if (len >= 11) return "clamp(1.1rem, min(2.2vw, 3.4vh), 2.3rem)";
    if (len >= 9) return "clamp(1.3rem, min(2.8vw, 4.4vh), 3.0rem)";
    if (len >= 7) return "clamp(1.5rem, min(3.5vw, 5.4vh), 3.7rem)";
    return "clamp(1.8rem, min(4.2vw, 6.2vh), 4.4rem)";
  } else {
    if (len >= 11) return "clamp(0.95rem, min(1.6vw, 2.8vh), 2.0rem)";
    if (len >= 9) return "clamp(1.1rem, min(2.0vw, 3.6vh), 2.5rem)";
    if (len >= 7) return "clamp(1.25rem, min(2.4vw, 4.4vh), 2.9rem)";
    return "clamp(1.4rem, min(2.9vw, 5.2vh), 3.5rem)";
  }
};

// ==========================================
// REALISTIC VECTOR ICONS (Gold Bar, Coin, Silver, Flags)
// ==========================================

export const GoldBarIcon: React.FC<{ width?: number | string; height?: number | string }> = ({
  width = 65,
  height = 42,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 140 90"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))" }}
  >
    <defs>
      <linearGradient id="goldBarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="25%" stopColor="#eab308" />
        <stop offset="60%" stopColor="#ca8a04" />
        <stop offset="85%" stopColor="#a16207" />
        <stop offset="100%" stopColor="#713f12" />
      </linearGradient>
    </defs>
    <rect x="5" y="5" width="130" height="80" rx="8" fill="url(#goldBarGrad)" stroke="#fef08a" strokeWidth="2.5" />
    <rect x="13" y="13" width="114" height="64" rx="5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
    <text x="70" y="37" fill="#422006" fontSize="13" fontWeight="900" fontFamily="sans-serif" textAnchor="middle" letterSpacing="1.2">
      FINE GOLD
    </text>
    <text x="70" y="53" fill="#422006" fontSize="11" fontWeight="800" fontFamily="monospace" textAnchor="middle">
      995.0
    </text>
    <text x="70" y="67" fill="#713f12" fontSize="9" fontWeight="700" fontFamily="sans-serif" textAnchor="middle" letterSpacing="0.8">
      İSTANBUL
    </text>
    <path d="M 18 15 L 122 15 L 105 27 L 35 27 Z" fill="rgba(255,255,255,0.38)" />
  </svg>
);

export const GoldCoinIcon: React.FC<{ width?: number | string; height?: number | string }> = ({
  width = 54,
  height = 54,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.65))" }}
  >
    <defs>
      <radialGradient id="coinGrad" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="35%" stopColor="#eab308" />
        <stop offset="70%" stopColor="#ca8a04" />
        <stop offset="100%" stopColor="#854d0e" />
      </radialGradient>
      <linearGradient id="coinRim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef9c3" />
        <stop offset="50%" stopColor="#b45309" />
        <stop offset="100%" stopColor="#fef08a" />
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="47" fill="url(#coinRim)" stroke="#fef08a" strokeWidth="2" />
    <circle cx="50" cy="50" r="43" fill="none" stroke="rgba(113, 63, 18, 0.6)" strokeWidth="1.5" strokeDasharray="3 2" />
    <circle cx="50" cy="50" r="40" fill="url(#coinGrad)" />
    <path
      d="M 52 24 C 47 24 43 27 41 31 C 39 35 39 38 37 41 C 35 44 32 46 32 48 C 32 50 35 50 36 52 C 37 54 35 56 37 58 C 39 60 41 59 43 62 C 45 65 43 68 46 72 C 49 76 56 76 60 74 C 64 72 66 68 66 64 C 66 60 63 56 63 52 C 63 48 65 45 65 40 C 65 32 59 24 52 24 Z"
      fill="#a16207"
      opacity="0.85"
    />
    <path
      d="M 51 25 C 46.5 25 43 28 41 32 C 39.5 35.5 39.5 38 38 41 C 36 44 33.5 45.5 33.5 47.5 C 33.5 49 36 49.5 37 51.5 C 38 53.5 36.5 55 38 57 C 40 59 41.5 58.5 43.5 61 C 45 64 43.5 67 46.5 70.5 C 49 74 55 74 58.5 72.5 C 62 71 64 67.5 64 64 C 64 60 61.5 56.5 61.5 52.5 C 61.5 48.5 63.5 45.5 63.5 41 C 63.5 33.5 58 25 51 25 Z"
      fill="#fef08a"
      opacity="0.6"
    />
    <circle cx="50" cy="50" r="37" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" strokeDasharray="1.5 2" />
  </svg>
);

export const SilverBarIcon: React.FC<{ width?: number | string; height?: number | string }> = ({
  width = 65,
  height = 42,
}) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 140 90"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))" }}
  >
    <defs>
      <linearGradient id="silverBarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="30%" stopColor="#cbd5e1" />
        <stop offset="65%" stopColor="#94a3b8" />
        <stop offset="90%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
    </defs>
    <rect x="5" y="5" width="130" height="80" rx="8" fill="url(#silverBarGrad)" stroke="#f1f5f9" strokeWidth="2.5" />
    <rect x="13" y="13" width="114" height="64" rx="5" fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" />
    <text x="70" y="37" fill="#0f172a" fontSize="13" fontWeight="900" fontFamily="sans-serif" textAnchor="middle" letterSpacing="1.2">
      GÜMÜŞ
    </text>
    <text x="70" y="53" fill="#1e293b" fontSize="11" fontWeight="800" fontFamily="monospace" textAnchor="middle">
      999.0
    </text>
    <text x="70" y="67" fill="#334155" fontSize="9" fontWeight="700" fontFamily="sans-serif" textAnchor="middle" letterSpacing="0.8">
      SILVER 1000g
    </text>
    <path d="M 18 15 L 122 15 L 105 27 L 35 27 Z" fill="rgba(255,255,255,0.45)" />
  </svg>
);

// Standalone vector SVG flags with realistic waving fabric overlay
export const WavingFlag: React.FC<{ code: string; width?: number | string; height?: number | string }> = ({
  code,
  width = 64,
  height = 40,
}) => {
  const c = (code || "").trim().toUpperCase();

  const renderFlagContent = () => {
    switch (c) {
      case "USD":
      case "USA":
        return (
          <svg viewBox="0 0 190 120" className="w-100 h-100" preserveAspectRatio="none">
            {Array.from({ length: 13 }).map((_, i) => (
              <rect
                key={i}
                x="0"
                y={(i * 120) / 13}
                width="190"
                height={120 / 13 + 0.5}
                fill={i % 2 === 0 ? "#b22234" : "#ffffff"}
              />
            ))}
            <rect x="0" y="0" width="76" height={(7 * 120) / 13} fill="#3c3b6e" />
            {[1, 2, 3, 4, 5].map((row) =>
              [1, 2, 3, 4, 5, 6].map((col) => (
                <circle
                  key={`star-${row}-${col}`}
                  cx={col * 11 - 2}
                  cy={row * 11 - 2}
                  r="2"
                  fill="#ffffff"
                />
              ))
            )}
          </svg>
        );

      case "EUR":
      case "EURO":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#003399" />
            {Array.from({ length: 12 }).map((_, i) => {
              const angle = (i * 30 * Math.PI) / 180;
              const cx = 90 + 36 * Math.sin(angle);
              const cy = 60 - 36 * Math.cos(angle);
              return (
                <polygon
                  key={i}
                  points={`${cx},${cy - 5.5} ${cx + 1.8},${cy - 1.8} ${cx + 5.5},${cy - 1.8} ${cx + 2.6},${cy + 1} ${cx + 3.8},${cy + 5} ${cx},${cy + 2.5} ${cx - 3.8},${cy + 5} ${cx - 2.6},${cy + 1} ${cx - 5.5},${cy - 1.8} ${cx - 1.8},${cy - 1.8}`}
                  fill="#ffcc00"
                />
              );
            })}
          </svg>
        );

      case "GBP":
      case "UK":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#012169" />
            <path d="M0,0 L180,120 M180,0 L0,120" stroke="#ffffff" strokeWidth="24" />
            <path d="M0,0 L90,60 M180,0 L90,60 M180,120 L90,60 M0,120 L90,60" stroke="#c8102e" strokeWidth="8" />
            <path d="M90,0 V120 M0,60 H180" stroke="#ffffff" strokeWidth="36" />
            <path d="M90,0 V120 M0,60 H180" stroke="#c8102e" strokeWidth="22" />
          </svg>
        );

      case "CHF":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#d52b1e" />
            <rect x="74" y="24" width="32" height="72" rx="2" fill="#ffffff" />
            <rect x="44" y="44" width="92" height="32" rx="2" fill="#ffffff" />
          </svg>
        );

      case "CAD":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect x="0" y="0" width="45" height="120" fill="#d80621" />
            <rect x="45" y="0" width="90" height="120" fill="#ffffff" />
            <rect x="135" y="0" width="45" height="120" fill="#d80621" />
            <g transform="translate(90, 60) scale(0.65)" fill="#d80621">
              <path d="M 0,-42 L 6,-22 L 20,-28 L 16,-10 L 34,-6 L 24,10 L 32,16 L 14,24 L 18,34 L 3,30 L 2,46 L -2,46 L -3,30 L -18,34 L -14,24 L -32,16 L -24,10 L -34,-6 L -16,-10 L -20,-28 L -6,-22 Z" />
            </g>
          </svg>
        );

      case "AUD":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#00008b" />
            <g transform="scale(0.5)">
              <rect width="180" height="120" fill="#012169" />
              <path d="M0,0 L180,120 M180,0 L0,120" stroke="#ffffff" strokeWidth="22" />
              <path d="M0,0 L90,60 M180,0 L90,60 M180,120 L90,60 M0,120 L90,60" stroke="#c8102e" strokeWidth="7" />
              <path d="M90,0 V120 M0,60 H180" stroke="#ffffff" strokeWidth="34" />
              <path d="M90,0 V120 M0,60 H180" stroke="#c8102e" strokeWidth="20" />
            </g>
            <circle cx="45" cy="90" r="14" fill="#ffffff" opacity="0.9" />
            <circle cx="135" cy="30" r="4.5" fill="#ffffff" />
            <circle cx="155" cy="50" r="4.5" fill="#ffffff" />
            <circle cx="135" cy="90" r="4.5" fill="#ffffff" />
            <circle cx="115" cy="65" r="4.5" fill="#ffffff" />
            <circle cx="145" cy="72" r="3" fill="#ffffff" />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#1e293b" />
            <circle cx="90" cy="60" r="32" fill="#334155" />
            <text x="90" y="67" fill="#f8fafc" fontSize="22" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
              {c.slice(0, 3)}
            </text>
          </svg>
        );
    }
  };

  return (
    <div
      className="position-relative overflow-hidden rounded shadow-sm border border-secondary flex-shrink-0"
      style={{
        width,
        height,
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.45)",
      }}
    >
      {renderFlagContent()}
      <svg
        className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ mixBlendMode: "overlay", opacity: 0.8 }}
      >
        <defs>
          <linearGradient id={`waveGrad-${c}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="25%" stopColor="#000000" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="75%" stopColor="#000000" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#waveGrad-${c})`} />
      </svg>
    </div>
  );
};

// Helper: Selects the best vector icon based on product code and name
export const renderProductIcon = (kod?: string, ad?: string) => {
  const k = (kod || "").trim().toUpperCase();
  const a = (ad || "").trim().toUpperCase();

  if (k.includes("GUMUS") || k.includes("GÜMÜŞ") || a.includes("GÜMÜŞ") || a.includes("GUMUS")) {
    return <SilverBarIcon width="clamp(36px, 3.8vw, 56px)" height="clamp(24px, 2.5vw, 36px)" />;
  }
  if (k.includes("24") || k.includes("22") || k === "HAS" || k.includes("KULCE") || k.includes("KÜLÇE") || a.includes("KÜLÇE") || a.includes("HAS ALTIN")) {
    return <GoldBarIcon width="clamp(38px, 4.2vw, 62px)" height="clamp(25px, 2.7vw, 38px)" />;
  }
  const isCurrency = ["USD", "EUR", "GBP", "CHF", "CAD", "AUD", "JPY", "SAR", "AED", "RUB"].includes(k);
  if (isCurrency) {
    return <WavingFlag code={k} width="clamp(38px, 4vw, 56px)" height="clamp(24px, 2.5vw, 35px)" />;
  }
  return <GoldCoinIcon width="clamp(36px, 3.8vw, 54px)" height="clamp(36px, 3.8vw, 54px)" />;
};

// Grid Row for Sarraf Vitrin (Matching user's photo)
const SarrafGridRow: React.FC<{
  item: PanoSatiriModel;
  activeTheme: PanoTheme;
  alisBaslik: string;
  satisBaslik: string;
  flashed?: "up" | "down" | null;
}> = ({ item, activeTheme, alisBaslik, satisBaslik, flashed }) => {
  const itemKod = (item.gorunecekAd || item.kod || item.ad || "").toUpperCase();
  const alisStr = formatSarrafRate(item.dovizAlis);
  const satisStr = formatSarrafRate(item.dovizSatis);
  const isLight = Boolean(activeTheme.isLight);

  return (
    <div
      className={`d-flex align-items-center justify-content-between px-3 px-md-3 py-1.5 rounded-2 border flex-grow-1 ${
        flashed ? (flashed === "up" ? "flash-up" : "flash-down") : ""
      }`}
      style={{
        backgroundColor: activeTheme.cardBg,
        borderColor: activeTheme.borderColor,
        backdropFilter: "blur(4px)",
      }}
    >
      {/* Icon + Product Name */}
      <div className="d-flex align-items-center gap-2.5" style={{ width: "42%", minWidth: "120px" }}>
        <div className="flex-shrink-0">
          {renderProductIcon(item.kod, item.ad)}
        </div>
        <div
          className="font-digital-title text-uppercase fw-bold text-nowrap overflow-hidden"
          style={{
            fontSize: "clamp(0.95rem, min(1.6vw, 2.7vh), 1.85rem)",
            letterSpacing: "1px",
            lineHeight: 1.15,
            textOverflow: "ellipsis",
            color: isLight ? "#000000" : (activeTheme.codeColor || "#ffffff"),
          }}
          title={itemKod}
        >
          {itemKod}
        </div>
      </div>

      {/* Alış Value */}
      <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ width: "29%" }}>
        <span
          className="text-uppercase text-nowrap font-digital-title fw-bold"
          style={{
            color: isLight ? "#000000" : (activeTheme.labelColor || "rgba(255, 255, 255, 0.75)"),
            fontSize: "clamp(0.65rem, min(0.85vw, 1.4vh), 0.95rem)",
            letterSpacing: "1px",
            lineHeight: 1,
            marginBottom: "1px",
          }}
        >
          {alisBaslik}
        </span>
        <span
          className="font-digital-number text-nowrap fw-bold"
          style={{
            color: activeTheme.alisTextColor || (isLight ? "#b91c1c" : "#f87171"),
            fontSize: "clamp(1.35rem, min(2.4vw, 3.8vh), 2.8rem)",
            letterSpacing: "1px",
            lineHeight: 1.05,
            textShadow: activeTheme.rateShadow || "none",
          }}
        >
          {alisStr}
        </span>
      </div>

      {/* Satış Value */}
      <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ width: "29%" }}>
        <span
          className="text-uppercase text-nowrap font-digital-title fw-bold"
          style={{
            color: isLight ? "#000000" : (activeTheme.labelColor || "rgba(255, 255, 255, 0.75)"),
            fontSize: "clamp(0.65rem, min(0.85vw, 1.4vh), 0.95rem)",
            letterSpacing: "1px",
            lineHeight: 1,
            marginBottom: "1px",
          }}
        >
          {satisBaslik}
        </span>
        <span
          className="font-digital-number text-nowrap fw-bold"
          style={{
            color: activeTheme.satisTextColor || (isLight ? "#15803d" : "#4ade80"),
            fontSize: "clamp(1.35rem, min(2.4vw, 3.8vh), 2.8rem)",
            letterSpacing: "1px",
            lineHeight: 1.05,
            textShadow: activeTheme.rateShadow || "none",
          }}
        >
          {satisStr}
        </span>
      </div>
    </div>
  );
};

export const PanoPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Active Pano Data
  const [selectedPanoId, setSelectedPanoId] = useState<number>(() => {
    const fromUrl = searchParams.get("id");
    return fromUrl ? Number(fromUrl) : 1;
  });

  const [activePano, setActivePano] = useState<PanoModel | null>(null);
  const [allPanos, setAllPanos] = useState<PanoModel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search Modal for switching panos via Binoculars
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);

  // Active resolved theme
  const activeTheme = useMemo(() => {
    return resolvePanoTheme(activePano?.htmlDosyaAdi);
  }, [activePano?.htmlDosyaAdi]);

  const handleThemeChange = (newThemeId: string) => {
    localStorage.setItem("pano_active_template", newThemeId);
    if (activePano) {
      setActivePano({ ...activePano, htmlDosyaAdi: newThemeId });
    }
  };

  // Previous rates for flash animations
  const prevRatesRef = useRef<Map<string, { alis: number | null; satis: number | null }>>(new Map());
  const [flashedItems, setFlashedItems] = useState<Record<string, "up" | "down" | null>>({});

  // Fetch all panos list
  useEffect(() => {
    PanoService.getAllPanos()
      .then((list) => {
        setAllPanos(list);
        if (list.length > 0) {
          const matched = list.find((p) => p.panoId === selectedPanoId) || list[0];
          setSelectedPanoId(matched.panoId);
        }
      })
      .catch(() => { });
  }, [selectedPanoId]);

  // Load live board data for selected Pano
  const fetchLiveBoard = useCallback(async () => {
    if (!selectedPanoId || selectedPanoId <= 0) {
      try {
        const list = await PanoService.getAllPanos();
        if (list.length > 0) {
          setSelectedPanoId(list[0].panoId);
          return;
        }
      } catch { }
      setLoading(false);
      return;
    }

    try {
      const data = await PanoService.getLiveBoardData(selectedPanoId);

      // Check price changes for flash animation
      const newFlashes: Record<string, "up" | "down" | null> = {};
      data.satirlar.forEach((satir) => {
        const key = (satir.kod || "").toUpperCase();
        const prev = prevRatesRef.current.get(key);
        if (prev && satir.dovizSatis !== null && satir.dovizSatis !== undefined && prev.satis !== null) {
          if (satir.dovizSatis > prev.satis) newFlashes[key] = "up";
          else if (satir.dovizSatis < prev.satis) newFlashes[key] = "down";
        }
        prevRatesRef.current.set(key, {
          alis: satir.dovizAlis ?? null,
          satis: satir.dovizSatis ?? null,
        });
      });

      setFlashedItems(newFlashes);
      setActivePano(data);
      setError(null);

      // Clear flashes after 1.5s
      setTimeout(() => setFlashedItems({}), 1500);
    } catch (err: any) {
      setError("Pano verisi çekilemedi: " + (err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [selectedPanoId]);

  useEffect(() => {
    fetchLiveBoard();
  }, [fetchLiveBoard]);

  // Auto Refresh Interval
  useEffect(() => {
    if (!activePano) return;
    const intervalSec = Math.max(1, activePano.yenilemeAraligi || 5);
    const timer = setInterval(() => {
      fetchLiveBoard();
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [activePano, fetchLiveBoard]);

  // Fullscreen Handlers
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      }
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    document.addEventListener("mozfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
      document.removeEventListener("mozfullscreenchange", handleFsChange);
    };
  }, []);

  // Keyboard shortcut F for Fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFullscreen]);

  // 1. DATA PARTITION FOR CYBER / EXCHANGE LAYOUT (USD & EUR left, others right)
  const { usdItem, eurItem, otherItems } = useMemo(() => {
    const satirlar = (activePano?.satirlar || []).filter(
      (s) => s.gorunur && !["TL", "TRY", "TL.", "YTL", "TRL"].includes((s.kod || "").trim().toUpperCase())
    );

    const usd = satirlar.find((s) => (s.kod || "").trim().toUpperCase() === "USD") || {
      paraId: 1,
      kod: "USD",
      ad: "Amerikan Doları",
      gorunecekAd: "USD",
      siraNo: 1,
      gorunur: true,
      carpan: 1,
      dovizAlis: null,
      dovizSatis: null,
    };

    const eur = satirlar.find((s) => (s.kod || "").trim().toUpperCase() === "EUR") || {
      paraId: 2,
      kod: "EUR",
      ad: "Euro",
      gorunecekAd: "EUR",
      siraNo: 2,
      gorunur: true,
      carpan: 1,
      dovizAlis: null,
      dovizSatis: null,
    };

    let others = satirlar.filter(
      (s) => !["USD", "EUR"].includes((s.kod || "").trim().toUpperCase())
    );

    const defaultCodes = ["GBP", "CHF", "CAD", "AUD"];
    for (const code of defaultCodes) {
      if (others.length < 4 && !others.some((s) => (s.kod || "").trim().toUpperCase() === code)) {
        others.push({
          paraId: Math.floor(Math.random() * -1000) - 1,
          kod: code,
          ad: code,
          gorunecekAd: code,
          siraNo: others.length + 3,
          gorunur: true,
          carpan: 1,
          dovizAlis: null,
          dovizSatis: null,
        });
      }
    }

    return { usdItem: usd, eurItem: eur, otherItems: others };
  }, [activePano]);

  // 2. DATA PARTITION FOR SARRAF VİTRİN LAYOUT (Matching user's uploaded photo)
  const { sarrafTopRows, sarrafGridLeft, sarrafGridRight } = useMemo(() => {
    const satirlar = (activePano?.satirlar || []).filter(
      (s) => s.gorunur && !["TL", "TRY", "TL.", "YTL", "TRL"].includes((s.kod || "").trim().toUpperCase())
    );

    // Fallback matching exact rates and items in user's photo
    if (satirlar.length === 0) {
      const topMock: PanoSatiriModel[] = [
        { paraId: -1, kod: "24 AYAR", ad: "24 AYAR", gorunecekAd: "24 AYAR", siraNo: 1, gorunur: true, carpan: 1, dovizAlis: 6291, dovizSatis: 6473 },
        { paraId: -2, kod: "22 AYAR", ad: "22 AYAR", gorunecekAd: "22 AYAR", siraNo: 2, gorunur: true, carpan: 1, dovizAlis: 5642, dovizSatis: 6063 },
      ];
      const leftMock: PanoSatiriModel[] = [
        { paraId: -3, kod: "ESKİ ÇEYREK", ad: "ESKİ ÇEYREK", gorunecekAd: "ESKİ ÇEYREK", siraNo: 3, gorunur: true, carpan: 1, dovizAlis: 10045, dovizSatis: 10530 },
        { paraId: -4, kod: "ESKİ YARIM", ad: "ESKİ YARIM", gorunecekAd: "ESKİ YARIM", siraNo: 4, gorunur: true, carpan: 1, dovizAlis: 20091, dovizSatis: 21060 },
        { paraId: -5, kod: "ESKİ ZİYNET TAM", ad: "ESKİ ZİYNET TAM", gorunecekAd: "ESKİ ZİYNET TAM", siraNo: 5, gorunur: true, carpan: 1, dovizAlis: 40182, dovizSatis: 42120 },
        { paraId: -6, kod: "ATA LİRA", ad: "ATA LİRA", gorunecekAd: "ATA LİRA", siraNo: 6, gorunur: true, carpan: 1, dovizAlis: 41881, dovizSatis: 43523 },
      ];
      const rightMock: PanoSatiriModel[] = [
        { paraId: -7, kod: "YENİ ÇEYREK", ad: "YENİ ÇEYREK", gorunecekAd: "YENİ ÇEYREK", siraNo: 7, gorunur: true, carpan: 1, dovizAlis: 10135, dovizSatis: 10730 },
        { paraId: -8, kod: "YENİ YARIM", ad: "YENİ YARIM", gorunecekAd: "YENİ YARIM", siraNo: 8, gorunur: true, carpan: 1, dovizAlis: 20271, dovizSatis: 21460 },
        { paraId: -9, kod: "YENİ ZİYNET TAM", ad: "YENİ ZİYNET TAM", gorunecekAd: "YENİ ZİYNET TAM", siraNo: 9, gorunur: true, carpan: 1, dovizAlis: 40542, dovizSatis: 42920 },
        { paraId: -10, kod: "GÜMÜŞ", ad: "GÜMÜŞ", gorunecekAd: "GÜMÜŞ", siraNo: 10, gorunur: true, carpan: 1, dovizAlis: 76.04, dovizSatis: 91.12 },
      ];
      return { sarrafTopRows: topMock, sarrafGridLeft: leftMock, sarrafGridRight: rightMock };
    }

    const isTopItem = (s: any) => {
      const k = (s.kod || "").toUpperCase();
      const a = (s.gorunecekAd || s.ad || "").toUpperCase();
      return (
        k.includes("24") ||
        k.includes("22") ||
        k === "HAS" ||
        k.includes("KULCE") ||
        k.includes("KÜLÇE") ||
        a.includes("24 AYAR") ||
        a.includes("22 AYAR") ||
        a.includes("HAS ALTIN")
      );
    };

    let top = satirlar.filter(isTopItem);
    if (top.length > 2) top = top.slice(0, 2);

    if (top.length === 0 && satirlar.length > 0) {
      top = satirlar.slice(0, Math.min(2, satirlar.length));
    } else if (top.length === 1 && satirlar.length > 1) {
      const nextCandidate = satirlar.find((x) => !top.includes(x));
      if (nextCandidate) top.push(nextCandidate);
    }

    const rest = satirlar.filter((s) => !top.includes(s));
    const mid = Math.ceil(rest.length / 2);
    const left = rest.slice(0, mid);
    const right = rest.slice(mid);

    return { sarrafTopRows: top, sarrafGridLeft: left, sarrafGridRight: right };
  }, [activePano]);

  return (
    <div
      className="pano-live-page min-vh-100 d-flex flex-column user-select-none"
      onDoubleClick={toggleFullscreen}
      title="Tam ekran yapmak veya çıkmak için çift tıklayabilirsiniz (veya F tuşuna basabilirsiniz)"
      style={{
        backgroundColor: activeTheme.containerBg,
        background: activeTheme.bg,
        color: activeTheme.rateColor,
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Orbitron:wght@600;700;800;900&family=Share+Tech+Mono&family=Inter:wght@600;700;800&display=swap');

        .font-digital-title {
          font-family: 'Orbitron', 'Chakra Petch', 'Inter', sans-serif;
          font-weight: 700;
          letter-spacing: 1.2px;
        }

        .font-digital-number {
          font-family: 'Orbitron', 'Chakra Petch', 'Share Tech Mono', 'Courier New', monospace;
          font-weight: 700;
          font-variant-numeric: slashed-zero;
          font-feature-settings: "zero" 1;
          letter-spacing: 1px;
        }

        /* Responsive Overrides */
        @media (max-width: 991.98px) {
          .pano-main-layout {
            flex-direction: column !important;
            overflow-y: auto !important;
            height: auto !important;
            min-height: 100% !important;
          }
          .pano-left-col {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 2px solid rgba(255, 255, 255, 0.25) !important;
            height: auto !important;
            min-height: auto !important;
          }
          .pano-right-col {
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
          }
          .pano-major-card {
            height: auto !important;
            min-height: 180px !important;
            padding: 1rem 0.5rem !important;
          }
          .sarraf-vitrin-layout {
            overflow-y: auto !important;
          }
          .sarraf-grid-wrapper {
            flex-direction: column !important;
          }
          .sarraf-grid-col {
            width: 100% !important;
          }
        }

        @media (min-width: 992px) {
          .pano-main-layout {
            flex-direction: row !important;
            height: 100% !important;
            overflow: hidden !important;
          }
          .pano-left-col {
            width: 48% !important;
            height: 100% !important;
            border-right: 2px solid rgba(255, 255, 255, 0.25) !important;
          }
          .pano-right-col {
            width: 52% !important;
            height: 100% !important;
          }
          .pano-major-card {
            height: 50% !important;
          }
          .sarraf-grid-wrapper {
            flex-direction: row !important;
          }
          .sarraf-grid-col {
            width: 50% !important;
          }
        }

        /* Subtle flash animations for live rate change */
        .flash-up {
          animation: pulseGreen 1.2s ease-in-out;
        }
        .flash-down {
          animation: pulseRed 1.2s ease-in-out;
        }

        @keyframes pulseGreen {
          0% { background-color: rgba(34, 197, 94, 0.45); }
          100% { background-color: transparent; }
        }

        @keyframes pulseRed {
          0% { background-color: rgba(239, 68, 68, 0.45); }
          100% { background-color: transparent; }
        }
      `}</style>

      {/* Cyber/Geometric Background Polygonal Mesh */}
      {activeTheme.meshOpacity && activeTheme.meshOpacity > 0 && (
        <svg
          className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none"
          style={{ zIndex: 0, opacity: activeTheme.meshOpacity }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="cyberMeshGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.7" />
              <stop offset="45%" stopColor="#ec4899" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          <path
            d="M 220,120 L 520,300 L 920,200 L 1320,340 L 760,600 L 520,300 M 920,200 L 760,600 M 380,640 L 760,600 L 1200,740 M 1320,340 L 1700,480"
            stroke="url(#cyberMeshGrad)"
            strokeWidth="1.4"
            fill="none"
          />
          <circle cx="520" cy="300" r="3.5" fill="#ec4899" opacity="0.85" />
          <circle cx="920" cy="200" r="3.5" fill="#7c3aed" opacity="0.85" />
          <circle cx="760" cy="600" r="4" fill="#06b6d4" opacity="0.85" />
          <circle cx="1320" cy="340" r="3.5" fill="#ec4899" opacity="0.85" />
        </svg>
      )}

      {/* 1. Standalone Top Bar Controls (Non-Fullscreen) */}
      {!isFullscreen && (
        <div
          className="print-none px-3 py-1.5 d-flex align-items-center justify-content-between flex-wrap gap-2 shadow-sm"
          style={{
            zIndex: 10,
            backgroundColor: "rgba(15, 17, 23, 0.95)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <IconDeviceTv size={20} className="text-warning" />
            <span className="fw-bold text-light font-monospace fs-6">
              CANLI FİYAT PANOSU {activePano ? `(${activePano.panoNo})` : ""}
            </span>
            <Badge bg="warning" text="dark" className="fw-bold ms-1">
              {activeTheme.shortName}
            </Badge>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Quick Template Switcher Dropdown */}
            <div
              className="d-flex align-items-center gap-1.5 px-2 py-0.5 rounded border border-secondary shadow-xs"
              style={{ backgroundColor: "rgba(30, 41, 59, 0.75)" }}
              title="Pano Tasarım Şablonunu Değiştir"
            >
              <IconPalette size={16} className="text-warning flex-shrink-0" />
              <select
                className="form-select form-select-sm bg-transparent text-white border-0 py-0 ps-1 pe-4 font-monospace shadow-none"
                style={{ fontSize: "12px", cursor: "pointer", width: "auto" }}
                value={activeTheme.id}
                onChange={(e) => handleThemeChange(e.target.value)}
              >
                {PANO_TEMPLATES.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id} className="bg-dark text-white">
                    {tmpl.name} {tmpl.isDefault ? "(Varsayılan)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline-light"
              size="sm"
              onClick={() => setShowSearchModal(true)}
              className="d-flex align-items-center gap-1.5 py-1 px-3 shadow-xs"
              title="Pano Seç (Dürbün)"
            >
              <IconBinoculars size={16} className="text-warning" />
              <span>Pano Seç ({activePano?.panoNo || "Dürbün"})</span>
            </Button>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={fetchLiveBoard}
              disabled={loading}
              className="d-flex align-items-center gap-1 py-1 px-2.5 text-light border-secondary"
              title="Canlı Fiyatları Yenile"
            >
              <IconRefresh size={16} />
              <span>Yenile</span>
            </Button>
            <Button
              variant="outline-info"
              size="sm"
              onClick={() => navigate("/kur/pano-tanimi")}
              className="d-flex align-items-center gap-1 py-1 px-2.5 shadow-xs"
              title="Pano Tanımlarına Git"
            >
              <IconSettings size={16} />
              <span>Pano Tanımları</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={toggleFullscreen}
              className="d-flex align-items-center gap-1.5 py-1 px-3 fw-bold shadow-xs ms-1"
              title="TV Tam Ekran Modunu Başlat (F tuşu)"
            >
              <IconMaximize size={16} />
              <span>TV Tam Ekran (F)</span>
            </Button>
          </div>
        </div>
      )}

      {/* Floating Hover Controls in Fullscreen Mode */}
      {isFullscreen && (
        <div
          className="position-fixed top-0 end-0 m-3 d-flex align-items-center gap-2 print-none opacity-50 hover-opacity-100"
          style={{
            zIndex: 9999,
            transition: "opacity 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.4")}
        >
          {/* Quick theme switcher in fullscreen */}
          <div
            className="rounded-pill px-2.5 py-1 shadow-lg border border-secondary d-flex align-items-center gap-1.5 text-white"
            style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(15, 23, 42, 0.85)" }}
          >
            <IconPalette size={15} className="text-warning flex-shrink-0" />
            <select
              className="form-select form-select-sm bg-transparent text-white border-0 py-0 ps-0 pe-3 font-monospace shadow-none"
              style={{ fontSize: "11px", cursor: "pointer", width: "auto" }}
              value={activeTheme.id}
              onChange={(e) => handleThemeChange(e.target.value)}
              title="Tema Değiştir"
            >
              {PANO_TEMPLATES.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id} className="bg-dark text-white">
                  {tmpl.shortName}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="dark"
            size="sm"
            onClick={() => setShowSearchModal(true)}
            className="rounded-pill px-3 py-1.5 shadow-lg border border-secondary d-flex align-items-center gap-1.5 text-white"
            style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(15, 23, 42, 0.85)" }}
            title="Pano Seç"
          >
            <IconBinoculars size={16} className="text-warning" />
            <span className="small fw-semibold">{activePano?.panoNo || "Pano Seç"}</span>
          </Button>
          <Button
            variant="dark"
            size="sm"
            onClick={fetchLiveBoard}
            className="rounded-circle p-2 shadow-lg border border-secondary text-white"
            style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(15, 23, 42, 0.85)" }}
            title="Fiyatları Yenile"
          >
            <IconRefresh size={16} />
          </Button>
          <Button
            variant="dark"
            size="sm"
            onClick={toggleFullscreen}
            className="rounded-pill px-3 py-1.5 shadow-lg border border-secondary d-flex align-items-center gap-1.5 text-white"
            style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(15, 23, 42, 0.85)" }}
            title="Tam Ekrandan Çık (Esc veya F)"
          >
            <IconMinimize size={16} />
            <span className="small fw-semibold">Tam Ekrandan Çık</span>
          </Button>
        </div>
      )}

      {/* Main Digital Board Area */}
      <Container
        fluid
        className="flex-grow-1 d-flex flex-column p-0"
        style={{
          zIndex: 1,
          height: isFullscreen ? "100vh" : "calc(100vh - 46px)",
          minHeight: 0,
        }}
      >
        {loading && !activePano ? (
          <div className="m-auto text-center py-5">
            <Spinner animation="border" variant="warning" style={{ width: "3.5rem", height: "3.5rem" }} />
            <div className="mt-3 fs-4 text-light fw-medium font-digital-title">Canlı Pano Yükleniyor...</div>
          </div>
        ) : error && !activePano ? (
          <div className="m-auto text-center py-5">
            <div className="text-danger fs-3 fw-bold mb-2">Pano Yüklenemedi</div>
            <div className="text-light fs-5 mb-3">{error}</div>
            <Button variant="warning" onClick={() => navigate("/kur/pano-tanimi")}>
              Pano Tanımlarına Git
            </Button>
          </div>
        ) : (
          <>
            {/* =========================================================================
                TEMA 1: CYBER EXCHANGE (Varsayılan - Birebir Mevcut Borsa Düzeni)
               ========================================================================= */}
            {activeTheme.layout === "cyber-exchange" && (
              <div className="pano-main-layout d-flex w-100 flex-grow-1">
                {/* LEFT COLUMN (USD & EUR Major Currencies) - approx 48% */}
                <div className="pano-left-col d-flex flex-column">
                  {/* --- USD BLOCK --- */}
                  <div
                    className={`pano-major-card d-flex flex-row align-items-center px-3 px-xl-4 py-2 border-bottom ${
                      flashedItems["USD"] ? (flashedItems["USD"] === "up" ? "flash-up" : "flash-down") : ""
                    }`}
                    style={{
                      borderBottomColor: activeTheme.borderColor,
                      backgroundColor: activeTheme.cardBg,
                    }}
                  >
                    <div
                      className="d-flex flex-column align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "26%", minWidth: "85px" }}
                    >
                      <div
                        className="font-digital-title text-uppercase text-nowrap"
                        style={{
                          fontSize: "clamp(1.6rem, min(3.8vw, 6vh), 3.6rem)",
                          color: activeTheme.isLight ? "#000000" : "#b0bac9",
                          lineHeight: 1.1,
                          letterSpacing: "2px",
                        }}
                      >
                        USD
                      </div>
                      <div className="mt-1 mt-md-2">
                        <WavingFlag
                          code="USD"
                          width="clamp(58px, min(6.8vw, 9.5vh), 105px)"
                          height="clamp(36px, min(4.2vw, 6vh), 65px)"
                        />
                      </div>
                    </div>

                    <div className="d-flex flex-column justify-content-center gap-1 gap-md-2 flex-grow-1 ps-2 ps-md-3 min-w-0" style={{ minWidth: 0 }}>
                      <div
                        className="rate-box-compact"
                        style={{
                          border: `2px solid ${activeTheme.alisBorder}`,
                          backgroundColor: activeTheme.cardBg,
                          boxShadow: `0 0 12px ${activeTheme.alisBorder}26`,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          className="text-center font-digital-title text-nowrap py-0.5 px-1"
                          style={{
                            backgroundColor: activeTheme.alisBg,
                            borderBottom: `1.5px solid ${activeTheme.alisBorder}`,
                            color: activeTheme.alisTextColor,
                            fontSize: "clamp(0.72rem, min(1vw, 1.8vh), 1.15rem)",
                            letterSpacing: "1.5px",
                            lineHeight: 1.2,
                          }}
                        >
                          ALIŞ - WE BUY
                        </div>
                        {(() => {
                          const str = formatDigitalRate(usdItem.dovizAlis);
                          return (
                            <div
                              className="text-center font-digital-number text-nowrap py-0.5 px-1"
                              style={{
                                color: activeTheme.rateColor,
                                fontSize: getDigitalRateFontSize(str, true),
                                letterSpacing: str.length >= 8 ? "0.5px" : "1.5px",
                                lineHeight: 1.05,
                                textShadow: activeTheme.rateShadow || "none",
                                overflow: "hidden",
                              }}
                            >
                              {str}
                            </div>
                          );
                        })()}
                      </div>

                      <div
                        className="rate-box-compact"
                        style={{
                          border: `2px solid ${activeTheme.satisBorder}`,
                          backgroundColor: activeTheme.cardBg,
                          boxShadow: `0 0 12px ${activeTheme.satisBorder}26`,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          className="text-center font-digital-title text-nowrap py-0.5 px-1"
                          style={{
                            backgroundColor: activeTheme.satisBg,
                            borderBottom: `1.5px solid ${activeTheme.satisBorder}`,
                            color: activeTheme.satisTextColor,
                            fontSize: "clamp(0.72rem, min(1vw, 1.8vh), 1.15rem)",
                            letterSpacing: "1.5px",
                            lineHeight: 1.2,
                          }}
                        >
                          SATIŞ - WE SELL
                        </div>
                        {(() => {
                          const str = formatDigitalRate(usdItem.dovizSatis);
                          return (
                            <div
                              className="text-center font-digital-number text-nowrap py-0.5 px-1"
                              style={{
                                color: activeTheme.rateColor,
                                fontSize: getDigitalRateFontSize(str, true),
                                letterSpacing: str.length >= 8 ? "0.5px" : "1.5px",
                                lineHeight: 1.05,
                                textShadow: activeTheme.rateShadow || "none",
                                overflow: "hidden",
                              }}
                            >
                              {str}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* --- EUR BLOCK --- */}
                  <div
                    className={`pano-major-card d-flex flex-row align-items-center px-3 px-xl-4 py-2 ${
                      flashedItems["EUR"] ? (flashedItems["EUR"] === "up" ? "flash-up" : "flash-down") : ""
                    }`}
                    style={{
                      backgroundColor: activeTheme.cardBg,
                    }}
                  >
                    <div
                      className="d-flex flex-column align-items-center justify-content-center flex-shrink-0"
                      style={{ width: "26%", minWidth: "85px" }}
                    >
                      <div
                        className="font-digital-title text-uppercase text-nowrap"
                        style={{
                          fontSize: "clamp(1.6rem, min(3.8vw, 6vh), 3.6rem)",
                          color: activeTheme.isLight ? "#000000" : "#b0bac9",
                          lineHeight: 1.1,
                          letterSpacing: "2px",
                        }}
                      >
                        EUR
                      </div>
                      <div className="mt-1 mt-md-2">
                        <WavingFlag
                          code="EUR"
                          width="clamp(58px, min(6.8vw, 9.5vh), 105px)"
                          height="clamp(36px, min(4.2vw, 6vh), 65px)"
                        />
                      </div>
                    </div>

                    <div className="d-flex flex-column justify-content-center gap-1 gap-md-2 flex-grow-1 ps-2 ps-md-3 min-w-0" style={{ minWidth: 0 }}>
                      <div
                        className="rate-box-compact"
                        style={{
                          border: `2px solid ${activeTheme.alisBorder}`,
                          backgroundColor: activeTheme.cardBg,
                          boxShadow: `0 0 12px ${activeTheme.alisBorder}26`,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          className="text-center font-digital-title text-nowrap py-0.5 px-1"
                          style={{
                            backgroundColor: activeTheme.alisBg,
                            borderBottom: `1.5px solid ${activeTheme.alisBorder}`,
                            color: activeTheme.alisTextColor,
                            fontSize: "clamp(0.72rem, min(1vw, 1.8vh), 1.15rem)",
                            letterSpacing: "1.5px",
                            lineHeight: 1.2,
                          }}
                        >
                          ALIŞ - WE BUY
                        </div>
                        {(() => {
                          const str = formatDigitalRate(eurItem.dovizAlis);
                          return (
                            <div
                              className="text-center font-digital-number text-nowrap py-0.5 px-1"
                              style={{
                                color: activeTheme.rateColor,
                                fontSize: getDigitalRateFontSize(str, true),
                                letterSpacing: str.length >= 8 ? "0.5px" : "1.5px",
                                lineHeight: 1.05,
                                textShadow: activeTheme.rateShadow || "none",
                                overflow: "hidden",
                              }}
                            >
                              {str}
                            </div>
                          );
                        })()}
                      </div>

                      <div
                        className="rate-box-compact"
                        style={{
                          border: `2px solid ${activeTheme.satisBorder}`,
                          backgroundColor: activeTheme.cardBg,
                          boxShadow: `0 0 12px ${activeTheme.satisBorder}26`,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          className="text-center font-digital-title text-nowrap py-0.5 px-1"
                          style={{
                            backgroundColor: activeTheme.satisBg,
                            borderBottom: `1.5px solid ${activeTheme.satisBorder}`,
                            color: activeTheme.satisTextColor,
                            fontSize: "clamp(0.72rem, min(1vw, 1.8vh), 1.15rem)",
                            letterSpacing: "1.5px",
                            lineHeight: 1.2,
                          }}
                        >
                          SATIŞ - WE SELL
                        </div>
                        {(() => {
                          const str = formatDigitalRate(eurItem.dovizSatis);
                          return (
                            <div
                              className="text-center font-digital-number text-nowrap py-0.5 px-1"
                              style={{
                                color: activeTheme.rateColor,
                                fontSize: getDigitalRateFontSize(str, true),
                                letterSpacing: str.length >= 8 ? "0.5px" : "1.5px",
                                lineHeight: 1.05,
                                textShadow: activeTheme.rateShadow || "none",
                                overflow: "hidden",
                              }}
                            >
                              {str}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT COLUMN (Other Currencies Table) - approx 52% */}
                <div className="pano-right-col d-flex flex-column px-2 px-md-3 px-xl-4 min-w-0" style={{ minWidth: 0 }}>
                  <div
                    className="d-flex align-items-center py-1 py-md-2"
                    style={{
                      borderBottom: `1.5px solid ${activeTheme.borderColor}`,
                    }}
                  >
                    <div style={{ width: "26%", flexShrink: 0 }} />
                    <div style={{ width: "37%", flexShrink: 0, textAlign: "center", overflow: "hidden" }}>
                      <span
                        className="font-digital-title text-uppercase text-nowrap d-inline-block"
                        style={{
                          color: activeTheme.alisTextColor,
                          borderBottom: `2px solid ${activeTheme.alisBorder}`,
                          fontSize: "clamp(0.82rem, min(1.35vw, 2.5vh), 1.6rem)",
                          letterSpacing: "1px",
                          paddingBottom: "2px",
                          maxWidth: "100%",
                        }}
                      >
                        ALIŞ-WE BUY
                      </span>
                    </div>
                    <div style={{ width: "37%", flexShrink: 0, textAlign: "center", overflow: "hidden" }}>
                      <span
                        className="font-digital-title text-uppercase text-nowrap d-inline-block"
                        style={{
                          color: activeTheme.satisTextColor,
                          borderBottom: `2px solid ${activeTheme.satisBorder}`,
                          fontSize: "clamp(0.82rem, min(1.35vw, 2.5vh), 1.6rem)",
                          letterSpacing: "1px",
                          paddingBottom: "2px",
                          maxWidth: "100%",
                        }}
                      >
                        SATIŞ-WE SELL
                      </span>
                    </div>
                  </div>

                  <div className="d-flex flex-column justify-content-around flex-grow-1 min-w-0" style={{ minWidth: 0 }}>
                    {otherItems.slice(0, 5).map((satir, idx) => {
                      const alisStr = formatDigitalRate(satir.dovizAlis);
                      const satisStr = formatDigitalRate(satir.dovizSatis);
                      const key = (satir.kod || "").toUpperCase();
                      const isFlashed = flashedItems[key];

                      return (
                        <div
                          key={satir.paraId || idx}
                          className={`d-flex align-items-center py-1.5 py-md-2 ${
                            idx < otherItems.slice(0, 5).length - 1 ? "border-bottom" : ""
                          } ${isFlashed ? (isFlashed === "up" ? "flash-up" : "flash-down") : ""}`}
                          style={{
                            borderBottomColor: activeTheme.borderColor,
                            minHeight: 0,
                          }}
                        >
                          <div
                            className="d-flex align-items-center gap-1.5 gap-md-2 flex-shrink-0"
                            style={{ width: "26%", overflow: "hidden" }}
                          >
                            <WavingFlag
                              code={satir.kod}
                              width="clamp(42px, min(4.4vw, 5.8vh), 75px)"
                              height="clamp(26px, min(2.7vw, 3.8vh), 46px)"
                            />
                            <span
                              className="font-digital-title text-uppercase text-nowrap"
                              style={{
                                color: activeTheme.codeColor,
                                fontSize: "clamp(1.15rem, min(2vw, 3.4vh), 2.4rem)",
                                letterSpacing: "1px",
                              }}
                            >
                              {satir.kod}
                            </span>
                          </div>

                          <div
                            className="flex-shrink-0 text-center"
                            style={{
                              width: "37%",
                              overflow: "hidden",
                            }}
                          >
                            <span
                              className="font-digital-number text-nowrap d-inline-block"
                              style={{
                                color: activeTheme.rateColor,
                                fontSize: getDigitalRateFontSize(alisStr, false),
                                letterSpacing: alisStr.length >= 8 ? "0.5px" : "1px",
                                lineHeight: 1,
                                textShadow: activeTheme.rateShadow || "none",
                                maxWidth: "100%",
                              }}
                            >
                              {alisStr}
                            </span>
                          </div>

                          <div
                            className="flex-shrink-0 text-center"
                            style={{
                              width: "37%",
                              overflow: "hidden",
                            }}
                          >
                            <span
                              className="font-digital-number text-nowrap d-inline-block"
                              style={{
                                color: activeTheme.rateColor,
                                fontSize: getDigitalRateFontSize(satisStr, false),
                                letterSpacing: satisStr.length >= 8 ? "0.5px" : "1px",
                                lineHeight: 1,
                                textShadow: activeTheme.rateShadow || "none",
                                maxWidth: "100%",
                              }}
                            >
                              {satisStr}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                TEMA 2: SARRAF & KUYUMCU TV VİTRİN DÜZENİ (Fotoğraftaki Birebir Tasarım)
               ========================================================================= */}
            {activeTheme.layout === "sarraf-vitrin" && (
              <div className="sarraf-vitrin-layout d-flex flex-column w-100 flex-grow-1 p-2 p-md-3 p-xl-4 overflow-hidden">
                {/* --- TOP PROMINENT ROWS (24 AYAR & 22 AYAR) --- */}
                <div className="d-flex flex-column gap-2 mb-2 mb-md-3">
                  {sarrafTopRows.map((item, idx) => {
                    const itemKod = (item.gorunecekAd || item.kod || item.ad || "").toUpperCase();
                    const alisStr = formatSarrafRate(item.dovizAlis);
                    const satisStr = formatSarrafRate(item.dovizSatis);
                    const isFlashed = flashedItems[item.kod || ""];

                    return (
                      <div
                        key={item.paraId || idx}
                        className={`d-flex align-items-center justify-content-between px-3 px-md-4 py-2 rounded-3 border ${
                          isFlashed ? (isFlashed === "up" ? "flash-up" : "flash-down") : ""
                        }`}
                        style={{
                          backgroundColor: activeTheme.cardBg,
                          borderColor: activeTheme.borderColor,
                          backdropFilter: "blur(6px)",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                        }}
                      >
                        {/* Left: Gold Bar Graphic + Item Name */}
                        <div className="d-flex align-items-center gap-3" style={{ width: "35%", minWidth: "160px" }}>
                          <div className="flex-shrink-0">
                            {renderProductIcon(item.kod, item.ad)}
                          </div>
                          <div
                            className="font-digital-title text-uppercase fw-bold text-nowrap"
                            style={{
                              fontSize: "clamp(1.5rem, min(3.2vw, 4.8vh), 3.4rem)",
                              letterSpacing: "1.5px",
                              lineHeight: 1.1,
                              color: activeTheme.isLight ? "#000000" : (activeTheme.codeColor || "#ffffff"),
                            }}
                          >
                            {itemKod}
                          </div>
                        </div>

                        {/* Middle: ALIŞ - WE BUY */}
                        <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ width: "32%" }}>
                          <span
                            className="text-uppercase text-nowrap font-digital-title fw-bold"
                            style={{
                              color: activeTheme.isLight ? "#000000" : (activeTheme.labelColor || "rgba(255, 255, 255, 0.8)"),
                              fontSize: "clamp(0.75rem, min(1.1vw, 1.8vh), 1.25rem)",
                              fontWeight: 700,
                              letterSpacing: "1.5px",
                              marginBottom: "2px",
                            }}
                          >
                            {activePano?.alisKuruBasligi || "ALIŞ - WE BUY"}
                          </span>
                          <span
                            className="font-digital-number text-nowrap fw-bold"
                            style={{
                              color: activeTheme.alisTextColor || (activeTheme.isLight ? "#b91c1c" : "#f87171"),
                              fontSize: "clamp(2.0rem, min(4.2vw, 6.2vh), 4.4rem)",
                              letterSpacing: "1.5px",
                              lineHeight: 1,
                              textShadow: activeTheme.rateShadow || "0 0 10px rgba(239, 68, 68, 0.4)",
                            }}
                          >
                            {alisStr}
                          </span>
                        </div>

                        {/* Right: SATIŞ - WE SELL */}
                        <div className="d-flex flex-column align-items-center justify-content-center text-center" style={{ width: "33%" }}>
                          <span
                            className="text-uppercase text-nowrap font-digital-title fw-bold"
                            style={{
                              color: activeTheme.isLight ? "#000000" : (activeTheme.labelColor || "rgba(255, 255, 255, 0.8)"),
                              fontSize: "clamp(0.75rem, min(1.1vw, 1.8vh), 1.25rem)",
                              fontWeight: 700,
                              letterSpacing: "1.5px",
                              marginBottom: "2px",
                            }}
                          >
                            {activePano?.satisKuruBasligi || "SATIŞ - WE SELL"}
                          </span>
                          <span
                            className="font-digital-number text-nowrap fw-bold"
                            style={{
                              color: activeTheme.satisTextColor || (activeTheme.isLight ? "#15803d" : "#4ade80"),
                              fontSize: "clamp(2.0rem, min(4.2vw, 6.2vh), 4.4rem)",
                              letterSpacing: "1.5px",
                              lineHeight: 1,
                              textShadow: activeTheme.rateShadow || "0 0 10px rgba(34, 197, 94, 0.4)",
                            }}
                          >
                            {satisStr}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* --- BOTTOM BALANCED 2-COLUMN GRID (ÇEYREK, YARIM, TAM, ATA, GÜMÜŞ VB.) --- */}
                <div className="sarraf-grid-wrapper d-flex flex-grow-1 gap-2 gap-md-3 gap-xl-4 overflow-hidden" style={{ minHeight: 0 }}>
                  {/* Left Column */}
                  <div className="sarraf-grid-col d-flex flex-column flex-grow-1 gap-1.5 gap-md-2 overflow-hidden">
                    {sarrafGridLeft.map((item, idx) => (
                      <SarrafGridRow
                        key={item.paraId || idx}
                        item={item}
                        activeTheme={activeTheme}
                        alisBaslik={activePano?.alisKuruBasligi || "ALIŞ - WE BUY"}
                        satisBaslik={activePano?.satisKuruBasligi || "SATIŞ - WE SELL"}
                        flashed={flashedItems[item.kod || ""]}
                      />
                    ))}
                  </div>

                  {/* Right Column */}
                  <div className="sarraf-grid-col d-flex flex-column flex-grow-1 gap-1.5 gap-md-2 overflow-hidden">
                    {sarrafGridRight.map((item, idx) => (
                      <SarrafGridRow
                        key={item.paraId || idx}
                        item={item}
                        activeTheme={activeTheme}
                        alisBaslik={activePano?.alisKuruBasligi || "ALIŞ - WE BUY"}
                        satisBaslik={activePano?.satisKuruBasligi || "SATIŞ - WE SELL"}
                        flashed={flashedItems[item.kod || ""]}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* =========================================================================
                TEMA 3: CARD GRID (Modern Glassmorphism Finans Kartları)
               ========================================================================= */}
            {activeTheme.layout === "card-grid" && (
              <div className="d-flex flex-column w-100 flex-grow-1 p-3 p-md-4 overflow-auto">
                <div
                  className="d-grid gap-3"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(clamp(240px, 28vw, 380px), 1fr))",
                  }}
                >
                  {(activePano?.satirlar || []).filter((s) => s.gorunur).map((satir, idx) => {
                    const itemKod = (satir.gorunecekAd || satir.kod || satir.ad || "").toUpperCase();
                    const alisStr = formatSarrafRate(satir.dovizAlis);
                    const satisStr = formatSarrafRate(satir.dovizSatis);
                    const isFlashed = flashedItems[satir.kod || ""];

                    return (
                      <div
                        key={satir.paraId || idx}
                        className={`rounded-3 p-3 border d-flex flex-column justify-content-between ${
                          isFlashed ? (isFlashed === "up" ? "flash-up" : "flash-down") : ""
                        }`}
                        style={{
                          backgroundColor: activeTheme.cardBg,
                          borderColor: activeTheme.borderColor,
                          backdropFilter: "blur(10px)",
                          boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
                          minHeight: "140px",
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <div className="d-flex align-items-center gap-2">
                            {renderProductIcon(satir.kod, satir.ad)}
                            <span
                              className="font-digital-title fw-bold"
                              style={{ fontSize: "1.3rem", letterSpacing: "1px", color: activeTheme.isLight ? "#000000" : (activeTheme.codeColor || "#ffffff") }}
                            >
                              {itemKod}
                            </span>
                          </div>
                          <Badge bg="info" className="px-2 py-1 font-monospace">
                            Canlı
                          </Badge>
                        </div>

                        <div className="d-flex align-items-center gap-2 mt-auto">
                          {/* Alış */}
                          <div
                            className="flex-grow-1 rounded p-2 text-center"
                            style={{
                              backgroundColor: activeTheme.alisBg,
                              border: `1px solid ${activeTheme.alisBorder}`,
                            }}
                          >
                            <div className="small text-uppercase font-digital-title fw-semibold" style={{ fontSize: "11px", color: activeTheme.isLight ? "#000000" : "rgba(255, 255, 255, 0.75)" }}>
                              {activePano?.alisKuruBasligi || "ALIŞ"}
                            </div>
                            <div
                              className="font-digital-number fw-bold"
                              style={{ fontSize: "1.5rem", color: activeTheme.alisTextColor }}
                            >
                              {alisStr}
                            </div>
                          </div>

                          {/* Satış */}
                          <div
                            className="flex-grow-1 rounded p-2 text-center"
                            style={{
                              backgroundColor: activeTheme.satisBg,
                              border: `1px solid ${activeTheme.satisBorder}`,
                            }}
                          >
                            <div className="small text-uppercase font-digital-title fw-semibold" style={{ fontSize: "11px", color: activeTheme.isLight ? "#000000" : "rgba(255, 255, 255, 0.75)" }}>
                              {activePano?.satisKuruBasligi || "SATIŞ"}
                            </div>
                            <div
                              className="font-digital-number fw-bold"
                              style={{ fontSize: "1.5rem", color: activeTheme.satisTextColor }}
                            >
                              {satisStr}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* =========================================================================
                TEMA 4: TABLE TICKER (Kapalıçarşı & LED Borsa Tablosu)
               ========================================================================= */}
            {activeTheme.layout === "table-ticker" && (
              <div className="d-flex flex-column w-100 flex-grow-1 p-3 p-md-4 overflow-hidden">
                {/* Table Header */}
                <div
                  className="d-flex align-items-center px-3 py-2 rounded-top border font-digital-title text-uppercase"
                  style={{
                    backgroundColor: "rgba(22, 101, 52, 0.3)",
                    borderColor: activeTheme.borderColor,
                    color: "#86efac",
                    fontSize: "clamp(0.85rem, 1.2vw, 1.2rem)",
                    letterSpacing: "1.5px",
                  }}
                >
                  <div style={{ width: "8%" }}>#</div>
                  <div style={{ width: "42%" }}>DÖVİZ / MADEN / SARRAFİYE</div>
                  <div style={{ width: "25%", textAlign: "right" }}>{activePano?.alisKuruBasligi || "ALIŞ (WE BUY)"}</div>
                  <div style={{ width: "25%", textAlign: "right" }}>{activePano?.satisKuruBasligi || "SATIŞ (WE SELL)"}</div>
                </div>

                {/* Table Rows */}
                <div className="d-flex flex-column flex-grow-1 overflow-auto border-start border-end border-bottom" style={{ borderColor: activeTheme.borderColor }}>
                  {(activePano?.satirlar || []).filter((s) => s.gorunur).map((satir, idx) => {
                    const itemKod = (satir.gorunecekAd || satir.kod || satir.ad || "").toUpperCase();
                    const alisStr = formatSarrafRate(satir.dovizAlis);
                    const satisStr = formatSarrafRate(satir.dovizSatis);
                    const isFlashed = flashedItems[satir.kod || ""];

                    return (
                      <div
                        key={satir.paraId || idx}
                        className={`d-flex align-items-center px-3 py-2 border-bottom flex-grow-1 ${
                          isFlashed ? (isFlashed === "up" ? "flash-up" : "flash-down") : ""
                        }`}
                        style={{
                          backgroundColor: idx % 2 === 0 ? activeTheme.cardBg : "rgba(5, 15, 8, 0.95)",
                          borderBottomColor: activeTheme.borderColor,
                        }}
                      >
                        <div className="font-digital-title text-muted" style={{ width: "8%", fontSize: "1.1rem" }}>
                          {(idx + 1).toString().padStart(2, "0")}
                        </div>
                        <div className="d-flex align-items-center gap-2.5 font-digital-title fw-bold" style={{ width: "42%", fontSize: "clamp(1.1rem, 1.6vw, 1.8rem)", color: activeTheme.isLight ? "#000000" : (activeTheme.codeColor || "#ffffff") }}>
                          {renderProductIcon(satir.kod, satir.ad)}
                          <span>{itemKod}</span>
                        </div>
                        <div
                          className="font-digital-number fw-bold"
                          style={{
                            width: "25%",
                            textAlign: "right",
                            color: activeTheme.alisTextColor,
                            fontSize: "clamp(1.4rem, 2.2vw, 2.6rem)",
                          }}
                        >
                          {alisStr}
                        </div>
                        <div
                          className="font-digital-number fw-bold"
                          style={{
                            width: "25%",
                            textAlign: "right",
                            color: activeTheme.satisTextColor,
                            fontSize: "clamp(1.4rem, 2.2vw, 2.6rem)",
                          }}
                        >
                          {satisStr}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </Container>

      {/* Pano Search Modal (Dürbün ile Pano Seçimi) */}
      <LookupModal<PanoModel>
        show={showSearchModal}
        onHide={() => setShowSearchModal(false)}
        title="Pano Seçimi (Dürbün)"
        searchPlaceholder="Pano No veya Firma Adı ile ara..."
        items={allPanos}
        isLoading={loading && allPanos.length === 0}
        filterFn={(p, term) => {
          const t = term.toLowerCase();
          return p.panoNo.toLowerCase().includes(t) || (p.firmaAdi ? p.firmaAdi.toLowerCase().includes(t) : false);
        }}
        columns={[
          {
            header: "Pano No",
            width: "120px",
            render: (p) => (
              <span className="badge bg-primary-subtle text-primary border font-monospace fw-bold">{p.panoNo}</span>
            ),
          },
          {
            header: "Firma / Pano Başlığı",
            render: (p) => <span className="fw-semibold text-dark">{p.firmaAdi || "-"}</span>,
          },
          {
            header: "Yenileme",
            width: "90px",
            align: "center",
            render: (p) => <span className="font-monospace small">{p.yenilemeAraligi} sn</span>,
          },
          {
            header: "HTML Şablon",
            width: "140px",
            render: (p) => <span className="font-monospace text-muted small">{p.htmlDosyaAdi || "-"}</span>,
          },
        ]}
        onSelect={(p) => {
          setSelectedPanoId(p.panoId);
        }}
      />
    </div>
  );
};

export default PanoPage;

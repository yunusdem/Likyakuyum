import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Container, Button, Badge, Spinner } from "react-bootstrap";
import {
  IconDeviceTv,
  IconMaximize,
  IconMinimize,
  IconSettings,
  IconRefresh,
  IconBinoculars,
} from "@tabler/icons-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import LookupModal from "../../components/common/LookupModal";
import { PanoService, PanoModel, PanoSatiriModel } from "../../services/panoService";

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

// Dynamic rate font size auto-scaler: prevents any overflow or overlap if numbers are long
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
            {/* 13 Stripes */}
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
            {/* Blue Canton */}
            <rect x="0" y="0" width="76" height={(7 * 120) / 13} fill="#3c3b6e" />
            {/* Stars Matrix */}
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
            {/* 12 Stars Circle */}
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
            {/* White Diagonals */}
            <path d="M0,0 L180,120 M180,0 L0,120" stroke="#ffffff" strokeWidth="24" />
            {/* Red Diagonals */}
            <path d="M0,0 L90,60 M180,0 L90,60 M180,120 L90,60 M0,120 L90,60" stroke="#c8102e" strokeWidth="8" />
            {/* White Cross */}
            <path d="M90,0 V120 M0,60 H180" stroke="#ffffff" strokeWidth="36" />
            {/* Red Cross */}
            <path d="M90,0 V120 M0,60 H180" stroke="#c8102e" strokeWidth="22" />
          </svg>
        );

      case "CHF":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#d52b1e" />
            {/* Bold White Swiss Cross */}
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
            {/* Stylized Red Maple Leaf */}
            <g transform="translate(90, 60) scale(0.65)" fill="#d80621">
              <path d="M 0,-42 L 6,-22 L 20,-28 L 16,-10 L 34,-6 L 24,10 L 32,16 L 14,24 L 18,34 L 3,30 L 2,46 L -2,46 L -3,30 L -18,34 L -14,24 L -32,16 L -24,10 L -34,-6 L -16,-10 L -20,-28 L -6,-22 Z" />
            </g>
          </svg>
        );

      case "AUD":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#00008b" />
            {/* Small Union Jack canton */}
            <g transform="scale(0.5)">
              <rect width="180" height="120" fill="#012169" />
              <path d="M0,0 L180,120 M180,0 L0,120" stroke="#ffffff" strokeWidth="22" />
              <path d="M0,0 L90,60 M180,0 L90,60 M180,120 L90,60 M0,120 L90,60" stroke="#c8102e" strokeWidth="7" />
              <path d="M90,0 V120 M0,60 H180" stroke="#ffffff" strokeWidth="34" />
              <path d="M90,0 V120 M0,60 H180" stroke="#c8102e" strokeWidth="20" />
            </g>
            {/* Commonwealth Star (large 7-pointed) */}
            <circle cx="45" cy="90" r="14" fill="#ffffff" opacity="0.9" />
            {/* Southern Cross stars */}
            <circle cx="135" cy="30" r="4.5" fill="#ffffff" />
            <circle cx="155" cy="50" r="4.5" fill="#ffffff" />
            <circle cx="135" cy="90" r="4.5" fill="#ffffff" />
            <circle cx="115" cy="65" r="4.5" fill="#ffffff" />
            <circle cx="145" cy="72" r="3" fill="#ffffff" />
          </svg>
        );

      case "JPY":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#ffffff" />
            <circle cx="90" cy="60" r="35" fill="#bc002d" />
          </svg>
        );

      case "SAR":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#006c35" />
            <rect x="40" y="70" width="100" height="6" fill="#ffffff" rx="3" />
            <path d="M45,64 L35,73 L45,82" stroke="#ffffff" strokeWidth="4" fill="none" />
            <text x="90" y="52" fill="#ffffff" fontSize="20" fontWeight="bold" textAnchor="middle">
              SAR
            </text>
          </svg>
        );

      case "AED":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect x="0" y="0" width="180" height="40" fill="#00732f" />
            <rect x="0" y="40" width="180" height="40" fill="#ffffff" />
            <rect x="0" y="80" width="180" height="40" fill="#000000" />
            <rect x="0" y="0" width="45" height="120" fill="#ff0000" />
          </svg>
        );

      case "KWD":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect x="0" y="0" width="180" height="40" fill="#007a3d" />
            <rect x="0" y="40" width="180" height="40" fill="#ffffff" />
            <rect x="0" y="80" width="180" height="40" fill="#ce1126" />
            <polygon points="0,0 55,40 55,80 0,120" fill="#000000" />
          </svg>
        );

      case "RUB":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect x="0" y="0" width="180" height="40" fill="#ffffff" />
            <rect x="0" y="40" width="180" height="40" fill="#0039a6" />
            <rect x="0" y="80" width="180" height="40" fill="#d52b1e" />
          </svg>
        );

      case "NOK":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#ba0c2f" />
            <path d="M55,0 V120 M0,60 H180" stroke="#ffffff" strokeWidth="30" />
            <path d="M55,0 V120 M0,60 H180" stroke="#00205b" strokeWidth="15" />
          </svg>
        );

      case "DKK":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#c8102e" />
            <path d="M60,0 V120 M0,60 H180" stroke="#ffffff" strokeWidth="22" />
          </svg>
        );

      case "SEK":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#005293" />
            <path d="M65,0 V120 M0,60 H180" stroke="#fecb00" strokeWidth="24" />
          </svg>
        );

      default:
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#1e293b" />
            <circle cx="90" cy="60" r="32" fill="#334155" stroke="#facc15" strokeWidth="3" />
            <text x="90" y="67" fill="#facc15" fontSize="22" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
              {c.slice(0, 3)}
            </text>
          </svg>
        );
    }
  };

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: "4px",
        overflow: "hidden",
        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        display: "inline-flex",
        flexShrink: 0,
      }}
    >
      {renderFlagContent()}
      {/* 3D Realistic Waving Fabric Highlight Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(130deg, rgba(255,255,255,0.35) 0%, rgba(0,0,0,0.2) 28%, rgba(255,255,255,0.25) 50%, rgba(0,0,0,0.3) 72%, rgba(255,255,255,0.2) 100%)",
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

export const PanoPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedId = Number(searchParams.get("id")) || 0;

  const [allPanos, setAllPanos] = useState<PanoModel[]>([]);
  const [activePano, setActivePano] = useState<PanoModel | null>(null);
  const [selectedPanoId, setSelectedPanoId] = useState<number>(requestedId);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);

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
      .catch(() => {});
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
      } catch {}
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
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
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

  // Split currencies: USD, EUR and Other list
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

    // If fewer than 4 items on the right, ensure standard GBP, CHF, CAD, AUD exist to match the exact visual layout
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

  return (
    <div
      className="pano-live-page min-vh-100 d-flex flex-column user-select-none"
      onDoubleClick={toggleFullscreen}
      title="Tam ekran yapmak veya çıkmak için çift tıklayabilirsiniz (veya F tuşuna basabilirsiniz)"
      style={{
        backgroundColor: "#161920",
        color: "#ffffff",
        position: "relative",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Orbitron:wght@600;700;800;900&family=Share+Tech+Mono&display=swap');

        .font-digital-title {
          font-family: 'Orbitron', 'Chakra Petch', sans-serif;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .font-digital-number {
          font-family: 'Orbitron', 'Chakra Petch', 'Share Tech Mono', 'Courier New', monospace;
          font-weight: 700;
          font-variant-numeric: slashed-zero;
          font-feature-settings: "zero" 1;
          letter-spacing: 1px;
        }

        /* Responsive Layout Overrides: prevent ANY overlap on small screens/laptops */
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
          .pano-live-page {
            overflow-y: auto !important;
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
        }

        /* Tight screen height protections (e.g. laptops 768px height) */
        @media (max-height: 720px) and (min-width: 992px) {
          .pano-major-card {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }
          .rate-box-compact {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
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
          0% { background-color: rgba(34, 197, 94, 0.4); }
          100% { background-color: transparent; }
        }

        @keyframes pulseRed {
          0% { background-color: rgba(239, 68, 68, 0.4); }
          100% { background-color: transparent; }
        }
      `}</style>

      {/* Cyber/Geometric Background Polygonal Mesh (Matching the photo behind the board) */}
      <svg
        className="position-absolute top-0 start-0 w-100 h-100 pointer-events-none"
        style={{ zIndex: 0, opacity: 0.18 }}
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
              VEZNEÜSTÜ DÖVİZ PANOSU {activePano ? `(${activePano.panoNo})` : ""}
            </span>
            <Badge bg="warning" text="dark" className="fw-bold ms-1">
              Yatay TV Modu
            </Badge>
          </div>

          <div className="d-flex align-items-center gap-2">
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
          <div className="pano-main-layout d-flex w-100 flex-grow-1">
            {/* ========================================================
                LEFT COLUMN (USD & EUR Major Currencies) - approx 48%
               ======================================================== */}
            <div className="pano-left-col d-flex flex-column">
              {/* --- USD BLOCK --- */}
              <div
                className={`pano-major-card d-flex flex-row align-items-center px-3 px-xl-4 py-2 border-bottom ${
                  flashedItems["USD"] ? (flashedItems["USD"] === "up" ? "flash-up" : "flash-down") : ""
                }`}
                style={{
                  borderBottomColor: "rgba(255, 255, 255, 0.25)",
                }}
              >
                {/* Left: "USD" label & Flag */}
                <div
                  className="d-flex flex-column align-items-center justify-content-center flex-shrink-0"
                  style={{ width: "26%", minWidth: "85px" }}
                >
                  <div
                    className="font-digital-title text-uppercase text-nowrap"
                    style={{
                      fontSize: "clamp(1.6rem, min(3.8vw, 6vh), 3.6rem)",
                      color: "#b0bac9",
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

                {/* Right: Alış & Satış Rate Boxes */}
                <div className="d-flex flex-column justify-content-center gap-1 gap-md-2 flex-grow-1 ps-2 ps-md-3 min-w-0" style={{ minWidth: 0 }}>
                  {/* USD ALIŞ - WE BUY Box */}
                  <div
                    className="rate-box-compact"
                    style={{
                      border: "2px solid #ef4444",
                      backgroundColor: "rgba(0, 0, 0, 0.45)",
                      boxShadow: "0 0 12px rgba(239, 68, 68, 0.15)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="text-center font-digital-title text-white text-nowrap py-0.5 px-1"
                      style={{
                        backgroundColor: "#8a2428",
                        borderBottom: "1.5px solid #ef4444",
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
                          className="text-center font-digital-number text-white text-nowrap py-0.5 px-1"
                          style={{
                            fontSize: getDigitalRateFontSize(str, true),
                            letterSpacing: str.length >= 8 ? "0.5px" : "1.5px",
                            lineHeight: 1.05,
                            textShadow: "0 0 8px rgba(255, 255, 255, 0.3)",
                            overflow: "hidden",
                          }}
                        >
                          {str}
                        </div>
                      );
                    })()}
                  </div>

                  {/* USD SATIŞ - WE SELL Box */}
                  <div
                    className="rate-box-compact"
                    style={{
                      border: "2px solid #22c55e",
                      backgroundColor: "rgba(0, 0, 0, 0.45)",
                      boxShadow: "0 0 12px rgba(34, 197, 94, 0.15)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="text-center font-digital-title text-white text-nowrap py-0.5 px-1"
                      style={{
                        backgroundColor: "#1b5e32",
                        borderBottom: "1.5px solid #22c55e",
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
                          className="text-center font-digital-number text-white text-nowrap py-0.5 px-1"
                          style={{
                            fontSize: getDigitalRateFontSize(str, true),
                            letterSpacing: str.length >= 8 ? "0.5px" : "1.5px",
                            lineHeight: 1.05,
                            textShadow: "0 0 8px rgba(255, 255, 255, 0.3)",
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
              >
                {/* Left: "EUR" label & Flag */}
                <div
                  className="d-flex flex-column align-items-center justify-content-center flex-shrink-0"
                  style={{ width: "26%", minWidth: "85px" }}
                >
                  <div
                    className="font-digital-title text-uppercase text-nowrap"
                    style={{
                      fontSize: "clamp(1.6rem, min(3.8vw, 6vh), 3.6rem)",
                      color: "#b0bac9",
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

                {/* Right: Alış & Satış Rate Boxes */}
                <div className="d-flex flex-column justify-content-center gap-1 gap-md-2 flex-grow-1 ps-2 ps-md-3 min-w-0" style={{ minWidth: 0 }}>
                  {/* EUR ALIŞ - WE BUY Box */}
                  <div
                    className="rate-box-compact"
                    style={{
                      border: "2px solid #ef4444",
                      backgroundColor: "rgba(0, 0, 0, 0.45)",
                      boxShadow: "0 0 12px rgba(239, 68, 68, 0.15)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="text-center font-digital-title text-white text-nowrap py-0.5 px-1"
                      style={{
                        backgroundColor: "#8a2428",
                        borderBottom: "1.5px solid #ef4444",
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
                          className="text-center font-digital-number text-white text-nowrap py-0.5 px-1"
                          style={{
                            fontSize: getDigitalRateFontSize(str, true),
                            letterSpacing: str.length >= 8 ? "0.5px" : "1.5px",
                            lineHeight: 1.05,
                            textShadow: "0 0 8px rgba(255, 255, 255, 0.3)",
                            overflow: "hidden",
                          }}
                        >
                          {str}
                        </div>
                      );
                    })()}
                  </div>

                  {/* EUR SATIŞ - WE SELL Box */}
                  <div
                    className="rate-box-compact"
                    style={{
                      border: "2px solid #22c55e",
                      backgroundColor: "rgba(0, 0, 0, 0.45)",
                      boxShadow: "0 0 12px rgba(34, 197, 94, 0.15)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      className="text-center font-digital-title text-white text-nowrap py-0.5 px-1"
                      style={{
                        backgroundColor: "#1b5e32",
                        borderBottom: "1.5px solid #22c55e",
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
                          className="text-center font-digital-number text-white text-nowrap py-0.5 px-1"
                          style={{
                            fontSize: getDigitalRateFontSize(str, true),
                            letterSpacing: str.length >= 8 ? "0.5px" : "1.5px",
                            lineHeight: 1.05,
                            textShadow: "0 0 8px rgba(255, 255, 255, 0.3)",
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

            {/* ========================================================
                RIGHT COLUMN (Other Currencies Table) - approx 52%
               ======================================================== */}
            <div className="pano-right-col d-flex flex-column px-2 px-md-3 px-xl-4 min-w-0" style={{ minWidth: 0 }}>
              {/* Column Headers (ALIŞ-WE BUY & SATIŞ-WE SELL) with strict 26% / 37% / 37% column widths */}
              <div
                className="d-flex align-items-center py-1 py-md-2"
                style={{
                  borderBottom: "1.5px solid rgba(255, 255, 255, 0.25)",
                }}
              >
                {/* Left empty spacer above Flag & Code (26%) */}
                <div style={{ width: "26%", flexShrink: 0 }} />

                {/* Header: ALIŞ-WE BUY (37%) */}
                <div style={{ width: "37%", flexShrink: 0, textAlign: "center", overflow: "hidden" }}>
                  <span
                    className="font-digital-title text-uppercase text-nowrap d-inline-block"
                    style={{
                      color: "#f87171",
                      borderBottom: "2px solid #ef4444",
                      fontSize: "clamp(0.82rem, min(1.35vw, 2.5vh), 1.6rem)",
                      letterSpacing: "1px",
                      paddingBottom: "2px",
                      maxWidth: "100%",
                    }}
                  >
                    ALIŞ-WE BUY
                  </span>
                </div>

                {/* Header: SATIŞ-WE SELL (37%) */}
                <div style={{ width: "37%", flexShrink: 0, textAlign: "center", overflow: "hidden" }}>
                  <span
                    className="font-digital-title text-uppercase text-nowrap d-inline-block"
                    style={{
                      color: "#4ade80",
                      borderBottom: "2px solid #22c55e",
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

              {/* Currency Data Rows with strict 26% / 37% / 37% column widths */}
              <div className="d-flex flex-column flex-grow-1 justify-content-around min-w-0" style={{ minWidth: 0 }}>
                {otherItems.map((item, idx) => {
                  const codeUpper = (item.kod || "").toUpperCase();
                  const flash = flashedItems[codeUpper];
                  const alisStr = formatDigitalRate(item.dovizAlis);
                  const satisStr = formatDigitalRate(item.dovizSatis);

                  return (
                    <div
                      key={`${item.paraId}-${codeUpper}-${idx}`}
                      className={`d-flex align-items-center py-1 py-md-2 ${
                        flash ? (flash === "up" ? "flash-up" : "flash-down") : ""
                      }`}
                      style={{
                        borderBottom:
                          idx < otherItems.length - 1
                            ? "1px solid rgba(255, 255, 255, 0.22)"
                            : "none",
                      }}
                    >
                      {/* Flag + Yellow Currency Code (26%) */}
                      <div
                        className="d-flex align-items-center gap-1 gap-md-2 flex-shrink-0"
                        style={{ width: "26%", overflow: "hidden" }}
                      >
                        <WavingFlag
                          code={codeUpper}
                          width="clamp(36px, min(3.8vw, 5vh), 56px)"
                          height="clamp(22px, min(2.4vw, 3.2vh), 36px)"
                        />
                        <span
                          className="font-digital-title fw-bold text-uppercase text-nowrap"
                          style={{
                            color: "#facc15",
                            fontSize: "clamp(1.15rem, min(2.2vw, 4vh), 2.5rem)",
                            letterSpacing: "1px",
                          }}
                        >
                          {codeUpper}
                        </span>
                      </div>

                      {/* Alış Rate (37%) */}
                      <div style={{ width: "37%", flexShrink: 0, textAlign: "center", overflow: "hidden" }}>
                        <span
                          className="font-digital-number text-white text-nowrap d-inline-block"
                          style={{
                            fontSize: getDigitalRateFontSize(alisStr, false),
                            letterSpacing: alisStr.length >= 8 ? "0.5px" : "1px",
                            lineHeight: 1,
                            textShadow: "0 0 6px rgba(255, 255, 255, 0.25)",
                            maxWidth: "100%",
                          }}
                        >
                          {alisStr}
                        </span>
                      </div>

                      {/* Satış Rate (37%) */}
                      <div style={{ width: "37%", flexShrink: 0, textAlign: "center", overflow: "hidden" }}>
                        <span
                          className="font-digital-number text-white text-nowrap d-inline-block"
                          style={{
                            fontSize: getDigitalRateFontSize(satisStr, false),
                            letterSpacing: satisStr.length >= 8 ? "0.5px" : "1px",
                            lineHeight: 1,
                            textShadow: "0 0 6px rgba(255, 255, 255, 0.25)",
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

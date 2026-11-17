import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button, Badge, Spinner } from "react-bootstrap";
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

// Helper: Formats rate exactly matching the TV screen photo (e.g. 6291, 10045, 76,04)
const formatPanoRate = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val)) || Number(val) === 0) {
    return "-";
  }
  const num = Number(val);
  // Tam sayı ise nokta/virgül olmadan doğrudan sayı olarak göster (örn: 6291, 10045)
  if (Math.abs(num - Math.round(num)) < 0.005) {
    return String(Math.round(num));
  }
  // Kuruşlu ise virgülle 2 hane göster (örn: Gümüş 76,04)
  return num.toFixed(2).replace(".", ",");
};

// ─── Realistic Pure SVG Visual Components ─────────────────────────────────────

// 1. Külçe Altın (Gold Bullion Bar - 24 Ayar / 22 Ayar / Has)
export const GoldBullionSvg: React.FC<{
  caratText?: string;
  width?: number | string;
  height?: number | string;
}> = ({ caratText = "995.0", width = "clamp(54px, min(5.5vw, 8.5vh), 92px)", height = "clamp(40px, min(4.2vw, 6.5vh), 70px)" }) => {
  return (
    <svg
      viewBox="0 0 160 120"
      style={{
        width,
        height,
        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.65))",
        flexShrink: 0,
      }}
    >
      <defs>
        <linearGradient id="goldBarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8a6416" />
          <stop offset="18%" stopColor="#e4b849" />
          <stop offset="42%" stopColor="#fff8c4" />
          <stop offset="68%" stopColor="#d4a329" />
          <stop offset="88%" stopColor="#966e1b" />
          <stop offset="100%" stopColor="#573f0e" />
        </linearGradient>
        <linearGradient id="goldInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f3d778" />
          <stop offset="25%" stopColor="#fff2ab" />
          <stop offset="55%" stopColor="#d8a62f" />
          <stop offset="85%" stopColor="#aa7d1a" />
          <stop offset="100%" stopColor="#7a550d" />
        </linearGradient>
        <linearGradient id="stampGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#634509" />
          <stop offset="100%" stopColor="#ab8022" />
        </linearGradient>
        <linearGradient id="shineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.15" />
          <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 3D Base Drop Shadow Plate */}
      <rect x="10" y="12" width="140" height="96" rx="8" fill="#1f1807" />

      {/* Main Bullion Body */}
      <rect x="8" y="10" width="144" height="100" rx="7" fill="url(#goldBarGrad)" stroke="#523908" strokeWidth="1" />

      {/* Inner Recessed Face */}
      <rect x="18" y="18" width="124" height="84" rx="5" fill="url(#goldInnerGrad)" stroke="#745210" strokeWidth="1.2" />

      {/* Engraved Oval Seal with FINE GOLD */}
      <ellipse cx="80" cy="40" rx="36" ry="16" fill="none" stroke="url(#stampGrad)" strokeWidth="1.8" />
      <text
        x="80"
        y="37"
        textAnchor="middle"
        fill="url(#stampGrad)"
        fontSize="8.5"
        fontWeight="800"
        fontFamily="'Arial Black', sans-serif"
        letterSpacing="0.8"
      >
        FINE GOLD
      </text>
      <text
        x="80"
        y="48"
        textAnchor="middle"
        fill="url(#stampGrad)"
        fontSize="9.5"
        fontWeight="900"
        fontFamily="'Arial Black', sans-serif"
        letterSpacing="0.5"
      >
        {caratText}
      </text>

      {/* Mint Inscription & Serial */}
      <text
        x="80"
        y="68"
        textAnchor="middle"
        fill="url(#stampGrad)"
        fontSize="8"
        fontWeight="700"
        fontFamily="'Arial', sans-serif"
        letterSpacing="2"
      >
        ISTANBUL
      </text>
      <line x1="42" y1="73" x2="118" y2="73" stroke="url(#stampGrad)" strokeWidth="1.2" strokeDasharray="3,2" />
      <text
        x="80"
        y="86"
        textAnchor="middle"
        fill="url(#stampGrad)"
        fontSize="8.5"
        fontWeight="bold"
        fontFamily="'Courier New', monospace"
        letterSpacing="1.5"
      >
        MELTER & ASSAYER
      </text>

      {/* Dynamic diagonal shine across top-left corner */}
      <path d="M 18,18 L 85,18 L 18,85 Z" fill="url(#shineGrad)" pointerEvents="none" />
    </svg>
  );
};

// 2. Cumhuriyet / Ziynet / Sarrafiye Altın Sikke (Çeyrek, Yarım, Tam, Ata)
export const GoldCoinSvg: React.FC<{
  type?: "ceyrek" | "yarim" | "tam" | "ata" | "resat";
  width?: number | string;
  height?: number | string;
}> = ({ width = "clamp(34px, min(3.5vw, 5.5vh), 56px)", height = "clamp(34px, min(3.5vw, 5.5vh), 56px)" }) => {
  return (
    <svg
      viewBox="0 0 120 120"
      style={{
        width,
        height,
        filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.65))",
        flexShrink: 0,
      }}
    >
      <defs>
        <radialGradient id="coinRimGrad" cx="50%" cy="50%" r="50%">
          <stop offset="85%" stopColor="#d4af37" />
          <stop offset="93%" stopColor="#fff8c4" />
          <stop offset="97%" stopColor="#8a6416" />
          <stop offset="100%" stopColor="#4d370b" />
        </radialGradient>
        <radialGradient id="coinFieldGrad" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#fff5bd" />
          <stop offset="25%" stopColor="#f3d36b" />
          <stop offset="60%" stopColor="#d4a329" />
          <stop offset="88%" stopColor="#966e1b" />
          <stop offset="100%" stopColor="#664910" />
        </radialGradient>
        <linearGradient id="portraitGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fffadb" />
          <stop offset="40%" stopColor="#f7dc88" />
          <stop offset="75%" stopColor="#c49424" />
          <stop offset="100%" stopColor="#7a550d" />
        </linearGradient>
        <linearGradient id="wreathGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#fff1a8" />
          <stop offset="60%" stopColor="#c69527" />
          <stop offset="100%" stopColor="#6e4c0c" />
        </linearGradient>
        <linearGradient id="coinShine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Base Outer Rim with Bevel */}
      <circle cx="60" cy="60" r="58" fill="url(#coinRimGrad)" stroke="#4a350a" strokeWidth="1.5" />

      {/* Reeded / Milled Teeth Border (36 dots around circumference) */}
      {Array.from({ length: 36 }).map((_, i) => {
        const rad = (i * 10 * Math.PI) / 180;
        const x = 60 + 53.5 * Math.cos(rad);
        const y = 60 + 53.5 * Math.sin(rad);
        return <circle key={i} cx={x} cy={y} r="1.3" fill="#634509" />;
      })}

      {/* Inner Recessed Coin Field */}
      <circle cx="60" cy="60" r="49" fill="url(#coinFieldGrad)" stroke="#745210" strokeWidth="1" />

      {/* Ornate Laurel Wreath Around Rim (Defne Çelengi) */}
      <g fill="url(#wreathGrad)" opacity="0.85">
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = 95 + i * 14;
          const rad = (angle * Math.PI) / 180;
          const cx = 60 + 41 * Math.cos(rad);
          const cy = 60 + 41 * Math.sin(rad);
          return (
            <ellipse
              key={`wl-${i}`}
              cx={cx}
              cy={cy}
              rx="4.5"
              ry="2.4"
              transform={`rotate(${angle + 40} ${cx} ${cy})`}
            />
          );
        })}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = 85 - i * 14;
          const rad = (angle * Math.PI) / 180;
          const cx = 60 + 41 * Math.cos(rad);
          const cy = 60 + 41 * Math.sin(rad);
          return (
            <ellipse
              key={`wr-${i}`}
              cx={cx}
              cy={cy}
              rx="4.5"
              ry="2.4"
              transform={`rotate(${angle - 40} ${cx} ${cy})`}
            />
          );
        })}
      </g>

      {/* Center Atatürk Silhouette Profile Relief */}
      <g transform="translate(60, 58) scale(0.72) translate(-60, -60)">
        <path
          d="M 52,24 C 61,24 67,27 71,32 C 75,37 76,43 75,48 C 77,50 78,54 77,57 C 76,60 74,62 73,63 C 74,67 74,71 70,75 C 67,78 63,81 57,84 C 53,86 48,87 43,87 C 41,84 41,80 43,76 C 45,72 48,69 51,66 C 47,63 45,59 46,55 C 47,52 49,50 51,48 C 50,44 50,38 49,34 C 48,29 49,25 52,24 Z"
          fill="#473106"
          opacity="0.4"
          transform="translate(1.5, 2)"
        />
        <path
          d="M 52,24 C 61,24 67,27 71,32 C 75,37 76,43 75,48 C 77,50 78,54 77,57 C 76,60 74,62 73,63 C 74,67 74,71 70,75 C 67,78 63,81 57,84 C 53,86 48,87 43,87 C 41,84 41,80 43,76 C 45,72 48,69 51,66 C 47,63 45,59 46,55 C 47,52 49,50 51,48 C 50,44 50,38 49,34 C 48,29 49,25 52,24 Z"
          fill="url(#portraitGrad)"
          stroke="#fff4b8"
          strokeWidth="0.8"
        />
        <path
          d="M 46,84 L 54,80 L 62,84 L 57,89 L 51,89 Z"
          fill="url(#portraitGrad)"
          stroke="#473106"
          strokeWidth="0.7"
        />
      </g>

      {/* Arched Star & Crescent */}
      <circle cx="60" cy="20" r="2.2" fill="#fff7be" />
      <circle cx="50" cy="22" r="1.8" fill="#ffd700" />
      <circle cx="70" cy="22" r="1.8" fill="#ffd700" />

      {/* Highlight Shine across the coin surface */}
      <path d="M 22,25 A 49 49 0 0 1 95,25 A 49 49 0 0 0 22,25 Z" fill="url(#coinShine)" pointerEvents="none" />
    </svg>
  );
};

// 3. Gümüş Külçe / Medalyon (Silver Ingot)
export const SilverIngotSvg: React.FC<{
  width?: number | string;
  height?: number | string;
}> = ({ width = "clamp(46px, min(4.5vw, 6.8vh), 72px)", height = "clamp(34px, min(3.4vw, 5.2vh), 54px)" }) => {
  return (
    <svg
      viewBox="0 0 140 105"
      style={{
        width,
        height,
        filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.65))",
        flexShrink: 0,
      }}
    >
      <defs>
        <linearGradient id="silverBarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4a5568" />
          <stop offset="18%" stopColor="#a0aec0" />
          <stop offset="45%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#cbd5e0" />
          <stop offset="90%" stopColor="#718096" />
          <stop offset="100%" stopColor="#2d3748" />
        </linearGradient>
        <linearGradient id="silverInnerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#edf2f7" />
          <stop offset="30%" stopColor="#ffffff" />
          <stop offset="65%" stopColor="#cbd5e0" />
          <stop offset="100%" stopColor="#718096" />
        </linearGradient>
        <linearGradient id="silverStamp" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2d3748" />
          <stop offset="100%" stopColor="#4a5568" />
        </linearGradient>
      </defs>

      {/* Silver Bar Body */}
      <rect x="8" y="10" width="124" height="85" rx="7" fill="url(#silverBarGrad)" stroke="#2d3748" strokeWidth="1.2" />
      <rect x="16" y="18" width="108" height="69" rx="5" fill="url(#silverInnerGrad)" stroke="#4a5568" strokeWidth="1" />

      {/* Stamp */}
      <ellipse cx="70" cy="38" rx="30" ry="14" fill="none" stroke="url(#silverStamp)" strokeWidth="1.6" />
      <text
        x="70"
        y="36"
        textAnchor="middle"
        fill="url(#silverStamp)"
        fontSize="7.5"
        fontWeight="800"
        fontFamily="'Arial Black', sans-serif"
        letterSpacing="0.8"
      >
        FINE SILVER
      </text>
      <text
        x="70"
        y="46"
        textAnchor="middle"
        fill="url(#silverStamp)"
        fontSize="9"
        fontWeight="900"
        fontFamily="'Arial Black', sans-serif"
      >
        999.0
      </text>

      <text
        x="70"
        y="66"
        textAnchor="middle"
        fill="url(#silverStamp)"
        fontSize="8"
        fontWeight="bold"
        fontFamily="'Arial', sans-serif"
        letterSpacing="2"
      >
        GÜMÜŞ
      </text>
      <text
        x="70"
        y="78"
        textAnchor="middle"
        fill="url(#silverStamp)"
        fontSize="8"
        fontWeight="bold"
        fontFamily="'Courier New', monospace"
      >
        1000g
      </text>
    </svg>
  );
};

// 4. Dalgalanan Bayraklar (Dövizler için Waving Flag - Tüm Dünya ve Bölgesel Dövizler)
export const WavingFlag: React.FC<{ code: string; width?: number | string; height?: number | string }> = ({
  code,
  width = "clamp(34px, min(3.5vw, 5.5vh), 56px)",
  height = "clamp(22px, min(2.3vw, 3.6vh), 36px)",
}) => {
  const c = (code || "").trim().toUpperCase();

  const renderFlagContent = () => {
    switch (c) {
      case "USD":
      case "USA":
      case "USDT":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            {Array.from({ length: 13 }).map((_, i) => (
              <rect
                key={i}
                x="0"
                y={(i * 120) / 13}
                width="180"
                height={120 / 13 + 0.5}
                fill={i % 2 === 0 ? "#b22234" : "#ffffff"}
              />
            ))}
            <rect x="0" y="0" width="72" height={(7 * 120) / 13} fill="#3c3b6e" />
            {[1, 2, 3, 4, 5].map((row) =>
              [1, 2, 3, 4, 5, 6].map((col) => (
                <circle key={`star-${row}-${col}`} cx={col * 10.5 - 1} cy={row * 10.5 - 1} r="1.8" fill="#ffffff" />
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

      case "JPY":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#ffffff" />
            <circle cx="90" cy="60" r="35" fill="#bc002d" />
          </svg>
        );

      case "KWD":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="40" y="0" fill="#007a3d" />
            <rect width="180" height="40" y="40" fill="#ffffff" />
            <rect width="180" height="40" y="80" fill="#ce1126" />
            <polygon points="0,0 52,40 52,80 0,120" fill="#000000" />
          </svg>
        );

      case "QAR":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#8d1b3d" />
            <rect width="50" height="120" fill="#ffffff" />
            <polygon
              points="50,0 62,6.67 50,13.33 62,20 50,26.67 62,33.33 50,40 62,46.67 50,53.33 62,60 50,66.67 62,73.33 50,80 62,86.67 50,93.33 62,100 50,106.67 62,113.33 50,120 0,120 0,0"
              fill="#ffffff"
            />
          </svg>
        );

      case "BHD":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#ce1126" />
            <rect width="45" height="120" fill="#ffffff" />
            <polygon
              points="45,0 60,12 45,24 60,36 45,48 60,60 45,72 60,84 45,96 60,108 45,120 0,120 0,0"
              fill="#ffffff"
            />
          </svg>
        );

      case "OMR":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="40" y="0" fill="#ffffff" />
            <rect width="180" height="40" y="40" fill="#db161b" />
            <rect width="180" height="40" y="80" fill="#008000" />
            <rect x="0" y="0" width="45" height="120" fill="#db161b" />
            <path d="M22,18 L22,34 M14,24 L30,24" stroke="#ffffff" strokeWidth="3" />
          </svg>
        );

      case "JOD":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="40" y="0" fill="#000000" />
            <rect width="180" height="40" y="40" fill="#ffffff" />
            <rect width="180" height="40" y="80" fill="#007a3d" />
            <polygon points="0,0 60,60 0,120" fill="#ce1126" />
            <circle cx="20" cy="60" r="4.5" fill="#ffffff" />
          </svg>
        );

      case "ILS":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#ffffff" />
            <rect x="0" y="16" width="180" height="16" fill="#0038b8" />
            <rect x="0" y="88" width="180" height="16" fill="#0038b8" />
            <polygon points="90,44 104,68 76,68" stroke="#0038b8" strokeWidth="3" fill="none" />
            <polygon points="90,76 104,52 76,52" stroke="#0038b8" strokeWidth="3" fill="none" />
          </svg>
        );

      case "RUB":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="40" y="0" fill="#ffffff" />
            <rect width="180" height="40" y="40" fill="#0039a6" />
            <rect width="180" height="40" y="80" fill="#d52b1e" />
          </svg>
        );

      case "CNY":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#de2910" />
            <polygon points="30,16 34,26 44,26 36,32 39,42 30,36 21,42 24,32 16,26 26,26" fill="#ffde00" />
            <circle cx="58" cy="18" r="4" fill="#ffde00" />
            <circle cx="70" cy="30" r="4" fill="#ffde00" />
            <circle cx="70" cy="48" r="4" fill="#ffde00" />
            <circle cx="58" cy="60" r="4" fill="#ffde00" />
          </svg>
        );

      case "AZN":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="40" y="0" fill="#00b5e2" />
            <rect width="180" height="40" y="40" fill="#ef3340" />
            <rect width="180" height="40" y="80" fill="#509e2f" />
            <circle cx="86" cy="60" r="14" fill="#ffffff" />
            <circle cx="90" cy="60" r="11" fill="#ef3340" />
            <polygon
              points="102,60 97.5,61.5 99,57 95,58.5 98,62.5 95,64 99,63 97.5,67"
              fill="#ffffff"
            />
          </svg>
        );

      case "NOK":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#ba0c2f" />
            <rect x="50" y="0" width="36" height="120" fill="#ffffff" />
            <rect x="0" y="42" width="180" height="36" fill="#ffffff" />
            <rect x="56" y="0" width="24" height="120" fill="#00205b" />
            <rect x="0" y="48" width="180" height="24" fill="#00205b" />
          </svg>
        );

      case "SEK":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#006aa7" />
            <rect x="55" y="0" width="26" height="120" fill="#fecc00" />
            <rect x="0" y="47" width="180" height="26" fill="#fecc00" />
          </svg>
        );

      case "DKK":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#c60c30" />
            <rect x="55" y="0" width="22" height="120" fill="#ffffff" />
            <rect x="0" y="49" width="180" height="22" fill="#ffffff" />
          </svg>
        );

      case "TRY":
      case "TL":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#e30a17" />
            <circle cx="72" cy="60" r="30" fill="#ffffff" />
            <circle cx="78" cy="60" r="24" fill="#e30a17" />
            <polygon
              points="104,60 92,64.2 96,51.8 86,59 100,53.2"
              fill="#ffffff"
            />
          </svg>
        );

      case "BGN":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="40" y="0" fill="#ffffff" />
            <rect width="180" height="40" y="40" fill="#00966e" />
            <rect width="180" height="40" y="80" fill="#d62612" />
          </svg>
        );

      case "RON":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="60" height="120" x="0" fill="#002b7f" />
            <rect width="60" height="120" x="60" fill="#fcd116" />
            <rect width="60" height="120" x="120" fill="#ce1126" />
          </svg>
        );

      case "PLN":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="60" y="0" fill="#ffffff" />
            <rect width="180" height="60" y="60" fill="#dc143c" />
          </svg>
        );

      case "GEL":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#ffffff" />
            <rect x="76" y="0" width="28" height="120" fill="#ff0000" />
            <rect x="0" y="46" width="180" height="28" fill="#ff0000" />
            <path
              d="M38,20 v16 M30,28 h16 M142,20 v16 M134,28 h16 M38,84 v16 M30,92 h16 M142,84 v16 M134,92 h16"
              stroke="#ff0000"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
        );

      case "KZT":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#00afca" />
            <circle cx="100" cy="54" r="18" fill="#fec50c" />
            <path d="M80,82 Q100,72 120,82 Q100,76 80,82 Z" fill="#fec50c" />
            <rect x="0" y="0" width="14" height="120" fill="#fec50c" opacity="0.85" />
          </svg>
        );

      case "KRW":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#ffffff" />
            <path d="M90,36 A24,24 0 0,1 90,84 A12,12 0 0,1 90,60 A12,12 0 0,0 90,36 Z" fill="#cd2e3a" />
            <path d="M90,36 A12,12 0 0,1 90,60 A12,12 0 0,0 90,84 A24,24 0 0,1 90,36 Z" fill="#0047a0" />
            <rect x="36" y="24" width="20" height="4" fill="#000" transform="rotate(35 46 26)" />
            <rect x="124" y="24" width="20" height="4" fill="#000" transform="rotate(-35 134 26)" />
            <rect x="36" y="92" width="20" height="4" fill="#000" transform="rotate(-35 46 94)" />
            <rect x="124" y="92" width="20" height="4" fill="#000" transform="rotate(35 134 94)" />
          </svg>
        );

      case "INR":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="40" y="0" fill="#ff9933" />
            <rect width="180" height="40" y="40" fill="#ffffff" />
            <rect width="180" height="40" y="80" fill="#138808" />
            <circle cx="90" cy="60" r="14" stroke="#000080" strokeWidth="2.5" fill="none" />
            <circle cx="90" cy="60" r="3" fill="#000080" />
          </svg>
        );

      case "SGD":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="60" y="0" fill="#ed2939" />
            <rect width="180" height="60" y="60" fill="#ffffff" />
            <circle cx="45" cy="30" r="16" fill="#ffffff" />
            <circle cx="50" cy="30" r="14" fill="#ed2939" />
            <circle cx="58" cy="22" r="2.5" fill="#ffffff" />
            <circle cx="66" cy="26" r="2.5" fill="#ffffff" />
            <circle cx="66" cy="34" r="2.5" fill="#ffffff" />
            <circle cx="58" cy="38" r="2.5" fill="#ffffff" />
            <circle cx="54" cy="30" r="2.5" fill="#ffffff" />
          </svg>
        );

      case "NZD":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#00247d" />
            <g transform="scale(0.5)">
              <rect width="180" height="120" fill="#012169" />
              <path d="M0,0 L180,120 M180,0 L0,120" stroke="#ffffff" strokeWidth="22" />
              <path d="M0,0 L90,60 M180,0 L90,60 M180,120 L90,60 M0,120 L90,60" stroke="#c8102e" strokeWidth="7" />
              <path d="M90,0 V120 M0,60 H180" stroke="#ffffff" strokeWidth="34" />
              <path d="M90,0 V120 M0,60 H180" stroke="#c8102e" strokeWidth="20" />
            </g>
            <circle cx="135" cy="32" r="5" fill="#c8102e" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="155" cy="55" r="4.5" fill="#c8102e" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="135" cy="90" r="5" fill="#c8102e" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="115" cy="62" r="4.5" fill="#c8102e" stroke="#ffffff" strokeWidth="1.5" />
          </svg>
        );

      case "HKD":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="120" fill="#de2910" />
            <circle cx="90" cy="60" r="25" fill="none" stroke="#ffffff" strokeWidth="3.5" opacity="0.9" />
            <circle cx="90" cy="60" r="10" fill="#ffffff" />
            <circle cx="90" cy="60" r="4" fill="#de2910" />
          </svg>
        );

      case "EGP":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="40" y="0" fill="#ce1126" />
            <rect width="180" height="40" y="40" fill="#ffffff" />
            <rect width="180" height="40" y="80" fill="#000000" />
            <path d="M84,52 L96,52 L94,68 L86,68 Z" fill="#c09300" />
            <circle cx="90" cy="50" r="4" fill="#c09300" />
          </svg>
        );

      case "IRR":
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <rect width="180" height="40" y="0" fill="#239f40" />
            <rect width="180" height="40" y="40" fill="#ffffff" />
            <rect width="180" height="40" y="80" fill="#da0000" />
            <circle cx="90" cy="60" r="10" fill="#da0000" />
          </svg>
        );

      default:
        // Bilinmeyen veya özel para birimleri için prestijli döviz brövesi
        return (
          <svg viewBox="0 0 180 120" className="w-100 h-100" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`flagBg-${c}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="50%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0b1120" />
              </linearGradient>
              <linearGradient id={`flagGold-${c}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#ca8a04" />
              </linearGradient>
            </defs>
            <rect width="180" height="120" fill={`url(#flagBg-${c})`} />
            <rect x="3" y="3" width="174" height="114" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" rx="3" />
            <circle cx="90" cy="60" r="40" fill="none" stroke="rgba(250,204,21,0.25)" strokeWidth="1.5" />
            <ellipse cx="90" cy="60" rx="20" ry="40" fill="none" stroke="rgba(250,204,21,0.2)" strokeWidth="1.5" />
            <line x1="50" y1="60" x2="130" y2="60" stroke="rgba(250,204,21,0.2)" strokeWidth="1.5" />
            <rect x="34" y="38" width="112" height="44" rx="6" fill="rgba(0,0,0,0.5)" stroke={`url(#flagGold-${c})`} strokeWidth="1.8" />
            <text
              x="90"
              y="69"
              fill={`url(#flagGold-${c})`}
              fontSize="24"
              fontWeight="900"
              textAnchor="middle"
              fontFamily="'Arial Black', sans-serif"
              letterSpacing="2.5"
            >
              {c.slice(0, 4) || "FX"}
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
        boxShadow: "0 3px 8px rgba(0, 0, 0, 0.6)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        display: "inline-flex",
        flexShrink: 0,
      }}
    >
      {renderFlagContent()}
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

// ─── Otomatik Görsel Tespit Edici ve Renderlayıcı ──────────────────────────────
export type PanoVisualType =
  | "bullion_24"
  | "bullion_22"
  | "bullion_18"
  | "bullion_14"
  | "coin_ceyrek"
  | "coin_yarim"
  | "coin_tam"
  | "coin_ata"
  | "coin_gremse"
  | "coin_resat"
  | "silver"
  | "currency";

export function detectPanoVisual(item: { kod?: string; ad?: string; gorunecekAd?: string }): {
  type: PanoVisualType;
  currencyCode?: string;
  label?: string;
} {
  const codeRaw = (item.kod || "").trim().toUpperCase();
  const titleRaw = `${item.gorunecekAd || ""} ${item.ad || ""}`.trim();
  const combinedLower = `${codeRaw} ${titleRaw}`.toLocaleLowerCase("tr-TR");

  // 1. Gümüş / Silver (Öncelikli)
  if (
    combinedLower.includes("gümüş") ||
    combinedLower.includes("gumus") ||
    combinedLower.includes("silver") ||
    codeRaw === "XAG" ||
    codeRaw.startsWith("XAG/") ||
    codeRaw.startsWith("XAG")
  ) {
    return { type: "silver", label: "GÜMÜŞ" };
  }

  // 2. Altın Ayarları & Külçeler (24, 22, 18, 14 Ayar / Has)
  if (
    combinedLower.includes("24 ayar") ||
    combinedLower.includes("24k") ||
    combinedLower.includes("has altın") ||
    combinedLower.includes("has altin") ||
    codeRaw === "24 AYAR" ||
    codeRaw === "HAS" ||
    codeRaw === "HAS ALTIN" ||
    codeRaw === "XAU" ||
    codeRaw.startsWith("XAU/") ||
    (combinedLower.includes("külçe") && !combinedLower.includes("gümüş")) ||
    (combinedLower.includes("kulce") && !combinedLower.includes("gumus"))
  ) {
    return { type: "bullion_24", label: "24 AYAR" };
  }

  if (
    combinedLower.includes("22 ayar") ||
    combinedLower.includes("22k") ||
    combinedLower.includes("bilezik") ||
    codeRaw === "22 AYAR"
  ) {
    return { type: "bullion_22", label: "22 AYAR" };
  }

  if (combinedLower.includes("18 ayar") || combinedLower.includes("18k") || codeRaw === "18 AYAR") {
    return { type: "bullion_18", label: "18 AYAR" };
  }

  if (combinedLower.includes("14 ayar") || combinedLower.includes("14k") || codeRaw === "14 AYAR") {
    return { type: "bullion_14", label: "14 AYAR" };
  }

  // 3. Türk Sarrafiye Altın Sikkeleri
  if (combinedLower.includes("ata") || combinedLower.includes("cumhuriyet")) {
    return { type: "coin_ata", label: "ATA" };
  }
  if (combinedLower.includes("çeyrek") || combinedLower.includes("ceyrek")) {
    return { type: "coin_ceyrek", label: "ÇEYREK" };
  }
  if (combinedLower.includes("yarım") || combinedLower.includes("yarim")) {
    return { type: "coin_yarim", label: "YARIM" };
  }
  if (
    combinedLower.includes("gremse") ||
    combinedLower.includes("ikibuçuk") ||
    combinedLower.includes("ikibucuk") ||
    combinedLower.includes("beşli") ||
    combinedLower.includes("besli")
  ) {
    return { type: "coin_gremse", label: "GREMSE" };
  }
  if (combinedLower.includes("reşat") || combinedLower.includes("resat") || combinedLower.includes("hamit")) {
    return { type: "coin_resat", label: "REŞAT" };
  }
  if (
    combinedLower.includes("ziynet") ||
    combinedLower.includes("tam altın") ||
    combinedLower.includes("tam altin") ||
    (combinedLower.includes("tam") && !combinedLower.includes("döviz"))
  ) {
    return { type: "coin_tam", label: "TAM" };
  }

  // 4. Döviz Tespiti (Tüm Dünya ve Bölgesel Dövizler)
  let detectedCurrency: string | null = null;

  const currencyMap: Array<{ keys: string[]; code: string }> = [
    { keys: ["USD", "DOLAR", "DOLLAR", "AMERİKAN", "AMERIKAN", "USDT"], code: "USD" },
    { keys: ["EUR", "EURO", "AVRO"], code: "EUR" },
    { keys: ["GBP", "STERLİN", "STERLIN", "POUND", "İNGİLİZ", "INGILIZ"], code: "GBP" },
    { keys: ["CHF", "FRANK", "FRANGI", "FRANG", "İSVİÇRE", "ISVICRE"], code: "CHF" },
    { keys: ["CAD", "KANADA"], code: "CAD" },
    { keys: ["AUD", "AVUSTRALYA"], code: "AUD" },
    { keys: ["JPY", "YEN", "JAPON"], code: "JPY" },
    { keys: ["SAR", "SUUDİ", "SUUDI", "RİYAL", "RIYAL", "SAUDI"], code: "SAR" },
    { keys: ["AED", "DİRHEM", "DIRHEM", "DIRHAM", "BAE", "EMIRATES"], code: "AED" },
    { keys: ["KWD", "KUVEYT", "KUVEYTI"], code: "KWD" },
    { keys: ["QAR", "KATAR", "QATAR"], code: "QAR" },
    { keys: ["BHD", "BAHREYN", "BAHRAIN"], code: "BHD" },
    { keys: ["OMR", "UMMAN", "OMAN"], code: "OMR" },
    { keys: ["JOD", "ÜRDÜN", "URDUN", "JORDAN"], code: "JOD" },
    { keys: ["ILS", "ŞEKEL", "SEKEL", "SHEKEL", "İSRAİL", "ISRAIL"], code: "ILS" },
    { keys: ["RUB", "RUBLE", "RUS", "RUSYA"], code: "RUB" },
    { keys: ["CNY", "YUAN", "ÇİN", "CIN", "CHINA"], code: "CNY" },
    { keys: ["AZN", "MANAT", "AZERBAYCAN"], code: "AZN" },
    { keys: ["NOK", "NORVEÇ", "NORVEC", "NORWAY"], code: "NOK" },
    { keys: ["SEK", "İSVEÇ", "ISVEC", "SWEDEN"], code: "SEK" },
    { keys: ["DKK", "DANİMARKA", "DANIMARKA", "DENMARK"], code: "DKK" },
    { keys: ["TRY", "TL", "TÜRK LİRASI", "TURK LIRASI"], code: "TRY" },
    { keys: ["BGN", "LEVA", "BULGAR", "BULGARİSTAN", "BULGARISTAN"], code: "BGN" },
    { keys: ["RON", "LEY", "ROMANYA"], code: "RON" },
    { keys: ["PLN", "ZLOTİ", "ZLOTI", "POLONYA"], code: "PLN" },
    { keys: ["GEL", "LARİ", "LARI", "GÜRCİSTAN", "GURCISTAN"], code: "GEL" },
    { keys: ["KZT", "TENGE", "KAZAK", "KAZAKHSTAN"], code: "KZT" },
    { keys: ["KRW", "WON", "KORE"], code: "KRW" },
    { keys: ["INR", "RUPİ", "RUPI", "HİNDİSTAN", "HINDISTAN"], code: "INR" },
    { keys: ["SGD", "SİNGAPUR", "SINGAPUR"], code: "SGD" },
    { keys: ["NZD", "ZELANDA"], code: "NZD" },
    { keys: ["HKD", "HONG KONG", "HONGKONG"], code: "HKD" },
    { keys: ["EGP", "MISIR LİRASI", "MISIR LIRASI", "MISIR"], code: "EGP" },
    { keys: ["IRR", "İRAN", "IRAN", "TÜMEN", "TUMEN"], code: "IRR" },
  ];

  // A. Kod içinden pair veya net eşleşme kontrolü (örn: USD, USD/TRY, USDTRY, EUR_TRY)
  const cleanCode = codeRaw.replace(/[^A-Z]/g, "");
  for (const entry of currencyMap) {
    if (codeRaw === entry.code || cleanCode.startsWith(entry.code)) {
      detectedCurrency = entry.code;
      break;
    }
  }

  // B. İsim / başlık içerisinden eşleştirme
  if (!detectedCurrency) {
    for (const entry of currencyMap) {
      if (entry.keys.some((k) => combinedLower.includes(k.toLocaleLowerCase("tr-TR")))) {
        detectedCurrency = entry.code;
        break;
      }
    }
  }

  // C. Genel ISO 4217 3 harfli döviz kodu kontrolü (örn: MXN, THB, BRL vb.)
  if (!detectedCurrency) {
    const codeMatch = codeRaw.match(/^([A-Z]{3})(\/?[A-Z]{3})?$/);
    if (codeMatch && codeMatch[1] && !["ALT", "HAS", "ATA", "RES", "ZYN", "GRM"].includes(codeMatch[1])) {
      detectedCurrency = codeMatch[1];
    }
  }

  if (detectedCurrency) {
    return { type: "currency", currencyCode: detectedCurrency };
  }

  // 5. Gram Altın kontrolü
  if (combinedLower.includes("gram") || combinedLower.includes("gr")) {
    return { type: "bullion_24", label: "24 AYAR" };
  }

  // 6. Varsayılan altın sikke
  return { type: "coin_tam", label: item.kod || "ALTIN" };
}

export const PanoItemVisualRenderer: React.FC<{
  item: { kod?: string; ad?: string; gorunecekAd?: string };
  isMajor?: boolean;
}> = ({ item, isMajor = false }) => {
  const visual = detectPanoVisual(item);

  if (visual.type === "bullion_24") {
    return <GoldBullionSvg caratText="995.0" />;
  }
  if (visual.type === "bullion_22") {
    return <GoldBullionSvg caratText="916.0" />;
  }
  if (visual.type === "bullion_18") {
    return <GoldBullionSvg caratText="750.0" />;
  }
  if (visual.type === "bullion_14") {
    return <GoldBullionSvg caratText="585.0" />;
  }
  if (visual.type === "silver") {
    return <SilverIngotSvg />;
  }
  if (visual.type === "currency") {
    return <WavingFlag code={visual.currencyCode || "USD"} />;
  }

  return <GoldCoinSvg type={visual.type.replace("coin_", "") as any} />;
};

// ─── Fotoğraftaki Birebir Başlangıç / Demo Verileri ───────────────────────────
const DEFAULT_PHOTO_ITEMS: PanoSatiriModel[] = [
  { paraId: 1, kod: "24 AYAR", ad: "24 Ayar Has Altın", gorunecekAd: "24 AYAR", siraNo: 1, gorunur: true, carpan: 1, dovizAlis: 6291, dovizSatis: 6473 },
  { paraId: 2, kod: "22 AYAR", ad: "22 Ayar Bilezik", gorunecekAd: "22 AYAR", siraNo: 2, gorunur: true, carpan: 1, dovizAlis: 5642, dovizSatis: 6063 },
  { paraId: 3, kod: "ESKİ ÇEYREK", ad: "Eski Çeyrek Altın", gorunecekAd: "ESKİ ÇEYREK", siraNo: 3, gorunur: true, carpan: 1, dovizAlis: 10045, dovizSatis: 10530 },
  { paraId: 4, kod: "YENİ ÇEYREK", ad: "Yeni Çeyrek Altın", gorunecekAd: "YENİ ÇEYREK", siraNo: 4, gorunur: true, carpan: 1, dovizAlis: 10135, dovizSatis: 10730 },
  { paraId: 5, kod: "ESKİ YARIM", ad: "Eski Yarım Altın", gorunecekAd: "ESKİ YARIM", siraNo: 5, gorunur: true, carpan: 1, dovizAlis: 20091, dovizSatis: 21060 },
  { paraId: 6, kod: "YENİ YARIM", ad: "Yeni Yarım Altın", gorunecekAd: "YENİ YARIM", siraNo: 6, gorunur: true, carpan: 1, dovizAlis: 20271, dovizSatis: 21460 },
  { paraId: 7, kod: "ESKİ ZİYNET TAM", ad: "Eski Ziynet Tam Altın", gorunecekAd: "ESKİ ZİYNET TAM", siraNo: 7, gorunur: true, carpan: 1, dovizAlis: 40182, dovizSatis: 42120 },
  { paraId: 8, kod: "YENİ ZİYNET TAM", ad: "Yeni Ziynet Tam Altın", gorunecekAd: "YENİ ZİYNET TAM", siraNo: 8, gorunur: true, carpan: 1, dovizAlis: 40542, dovizSatis: 42920 },
  { paraId: 9, kod: "ATA LİRA", ad: "Ata Lira Cumhuriyet", gorunecekAd: "ATA LİRA", siraNo: 9, gorunur: true, carpan: 1, dovizAlis: 41881, dovizSatis: 43523 },
  { paraId: 10, kod: "GÜMÜŞ", ad: "Gümüş Gram", gorunecekAd: "GÜMÜŞ", siraNo: 10, gorunur: true, carpan: 1, dovizAlis: 76.04, dovizSatis: 91.12 },
];

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

  // Price changes tracking for flash animations
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

  // Partition items into Top Major Rows (24 Ayar, 22 Ayar) & Two-Column Grid
  const { topRows, leftColumnItems, rightColumnItems } = useMemo(() => {
    const satirlar = (activePano?.satirlar || []).filter(
      (s) => s.gorunur && !["TL", "TRY", "TL.", "YTL", "TRL"].includes((s.kod || "").trim().toUpperCase())
    );

    const sourceList = satirlar.length > 0 ? satirlar : DEFAULT_PHOTO_ITEMS;

    // 1. Üst satırlar (24 Ayar & 22 Ayar)
    const major24 = sourceList.find((s) => {
      const v = detectPanoVisual(s);
      return v.type === "bullion_24";
    });
    const major22 = sourceList.find((s) => {
      const v = detectPanoVisual(s);
      return v.type === "bullion_22";
    });

    const majors: PanoSatiriModel[] = [];
    if (major24) majors.push(major24);
    if (major22) majors.push(major22);

    // Eğer 24 veya 22 bulunamadıysa ve USD/EUR varsa onları üst satıra al
    if (majors.length === 0) {
      const usd = sourceList.find((s) => (s.kod || "").toUpperCase() === "USD");
      const eur = sourceList.find((s) => (s.kod || "").toUpperCase() === "EUR");
      if (usd) majors.push(usd);
      if (eur) majors.push(eur);
    }

    // 2. Alt 2 sütunluk ızgara elemanları
    const gridItems = sourceList.filter((s) => !majors.some((m) => m.paraId === s.paraId));

    const left: PanoSatiriModel[] = [];
    const right: PanoSatiriModel[] = [];

    const hasEskiYeni = gridItems.some((s) => {
      const n = (s.gorunecekAd || s.ad || s.kod || "").toUpperCase();
      return n.includes("ESKİ") || n.includes("ESKI");
    });

    if (hasEskiYeni) {
      for (const item of gridItems) {
        const name = (item.gorunecekAd || item.ad || item.kod || "").toUpperCase();
        if (name.includes("ESKİ") || name.includes("ESKI") || name.includes("ATA")) {
          left.push(item);
        } else if (name.includes("YENİ") || name.includes("YENI") || name.includes("GÜMÜŞ") || name.includes("GUMUS")) {
          right.push(item);
        } else {
          if (left.length <= right.length) left.push(item);
          else right.push(item);
        }
      }
    } else {
      const mid = Math.ceil(gridItems.length / 2);
      left.push(...gridItems.slice(0, mid));
      right.push(...gridItems.slice(mid));
    }

    return { topRows: majors, leftColumnItems: left, rightColumnItems: right };
  }, [activePano]);

  return (
    <div
      className="pano-live-page user-select-none"
      onDoubleClick={toggleFullscreen}
      title="Tam ekran yapmak veya çıkmak için çift tıklayabilirsiniz (veya F tuşuna basabilirsiniz)"
      style={{
        backgroundColor: "#0d0f14",
        backgroundImage: "radial-gradient(ellipse at 50% 15%, #181d28 0%, #0d0f14 75%, #06070a 100%)",
        color: "#ffffff",
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        margin: 0,
        padding: 0,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700;800&family=Orbitron:wght@600;700;800;900&family=Rajdhani:wght@600;700;800&display=swap');

        /* Ekranı %100 Dolduracak Sıfır Boşluk Düzeni */
        html, body, #root {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          width: 100vw !important;
          height: 100vh !important;
        }

        .font-pano-title {
          font-family: 'Rajdhani', 'Chakra Petch', sans-serif;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .font-pano-header {
          font-family: 'Rajdhani', 'Chakra Petch', sans-serif;
          font-weight: 700;
          letter-spacing: 1.5px;
        }

        .font-pano-rate {
          font-family: 'Rajdhani', 'Chakra Petch', 'Orbitron', monospace;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }

        /* Fotoğraftaki Kırmızı Alış Rengi & Parıltısı */
        .rate-color-buy {
          color: #ef4444;
          text-shadow: 0 0 16px rgba(239, 68, 68, 0.45);
        }

        /* Fotoğraftaki Yeşil Satış Rengi & Parıltısı */
        .rate-color-sell {
          color: #22c55e;
          text-shadow: 0 0 16px rgba(34, 197, 94, 0.45);
        }

        /* Fiyat Değişim Yanıp Sönme Efektleri */
        @keyframes flashGreen {
          0% { background-color: rgba(34, 197, 94, 0.4); }
          100% { background-color: transparent; }
        }
        @keyframes flashRed {
          0% { background-color: rgba(239, 68, 68, 0.4); }
          100% { background-color: transparent; }
        }

        .flash-up {
          animation: flashGreen 1.4s ease-out;
        }
        .flash-down {
          animation: flashRed 1.4s ease-out;
        }

        .pano-row-hover {
          transition: background-color 0.2s ease;
        }
        .pano-row-hover:hover {
          background-color: rgba(255, 255, 255, 0.035);
        }

        /* Kontrol Araç Çubuğu Hover */
        .pano-controls-bar {
          opacity: 0.15;
          transition: opacity 0.3s ease;
        }
        .pano-controls-bar:hover {
          opacity: 1;
        }
      `}</style>

      {/* Floating Top Control Toolbar (Minimalist, TV'yi bozmaz) */}
      <div
        className="pano-controls-bar position-absolute top-0 end-0 m-2 m-md-3 z-3 d-flex align-items-center gap-2"
        style={{ pointerEvents: "auto" }}
      >
        <Badge bg="dark" className="border border-secondary text-light px-3 py-2 d-none d-md-inline-block">
          <IconDeviceTv size={15} className="me-1 text-warning" />
          {activePano ? `${activePano.panoNo} - ${activePano.firmaAdi || "Canlı Fiyat Panosu"}` : "Canlı TV Panosu"}
        </Badge>

        <Button
          variant="outline-light"
          size="sm"
          className="border-secondary bg-dark bg-opacity-75"
          onClick={() => setShowSearchModal(true)}
          title="Pano Seç (Dürbün)"
        >
          <IconBinoculars size={16} className="text-warning" />
        </Button>

        <Button
          variant="outline-light"
          size="sm"
          className="border-secondary bg-dark bg-opacity-75"
          onClick={fetchLiveBoard}
          title="Yenile"
        >
          <IconRefresh size={16} className={loading ? "spin" : ""} />
        </Button>

        <Button
          variant="outline-light"
          size="sm"
          className="border-secondary bg-dark bg-opacity-75"
          onClick={() => navigate("/kur/pano-tanimi")}
          title="Pano Tanımları"
        >
          <IconSettings size={16} />
        </Button>

        <Button
          variant="warning"
          size="sm"
          className="fw-bold d-flex align-items-center gap-1.5 px-2.5"
          onClick={toggleFullscreen}
          title="Tam Ekran (F)"
        >
          {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
          <span className="small">{isFullscreen ? "Küçült" : "Tam Ekran"}</span>
        </Button>
      </div>

      {/* Main Full-Viewport TV Screen Layout */}
      <div className="w-100 h-100 d-flex flex-column justify-content-between">
        {loading && !activePano && topRows.length === 0 ? (
          <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1">
            <Spinner animation="border" variant="warning" style={{ width: "3.5rem", height: "3.5rem" }} />
            <div className="mt-3 text-warning font-pano-title fs-4">FİYAT PANOSU YÜKLENİYOR...</div>
          </div>
        ) : error && topRows.length === 0 ? (
          <div className="d-flex flex-column align-items-center justify-content-center flex-grow-1">
            <div className="text-danger font-pano-title fs-3 mb-2">Hata Oluştu</div>
            <div className="text-muted mb-3">{error}</div>
            <Button variant="warning" onClick={() => navigate("/kur/pano-tanimi")}>
              Pano Tanımına Git
            </Button>
          </div>
        ) : (
          <div className="w-100 h-100 d-flex flex-column">
            {/* =================================================================
                1. BÖLÜM: ÜST SATIRLAR (24 AYAR & 22 AYAR KÜLÇE ALTIN BÖLÜMÜ)
                Ekran yüksekliğinin yaklaşık %33'ünü kaplar, her satır flex: 1 ile eşit paylaşır.
               ================================================================= */}
            {topRows.length > 0 && (
              <div
                className="w-100 d-flex flex-column"
                style={{
                  height: topRows.length === 1 ? "18vh" : "33vh",
                  flexShrink: 0,
                  padding: "clamp(6px, 1.2vh, 16px) clamp(16px, 2.5vw, 44px) 0",
                  boxSizing: "border-box",
                }}
              >
                {topRows.map((rowItem) => {
                  const title = rowItem.gorunecekAd || rowItem.ad || rowItem.kod;
                  const alisStr = formatPanoRate(rowItem.dovizAlis);
                  const satisStr = formatPanoRate(rowItem.dovizSatis);
                  const flash = flashedItems[(rowItem.kod || "").toUpperCase()];

                  return (
                    <div
                      key={`top-${rowItem.paraId}-${rowItem.kod}`}
                      className={`d-flex align-items-center w-100 px-3 px-md-4 pano-row-hover rounded-3 ${
                        flash ? (flash === "up" ? "flash-up" : "flash-down") : ""
                      }`}
                      style={{
                        flex: 1,
                        minHeight: 0,
                        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                        background: "rgba(255, 255, 255, 0.015)",
                        marginBottom: "clamp(3px, 0.6vh, 8px)",
                      }}
                    >
                      {/* Sol: Görsel (Külçe Altın) + Başlık (24 AYAR / 22 AYAR) */}
                      <div className="d-flex align-items-center gap-3 gap-md-4" style={{ width: "35%", minWidth: "220px" }}>
                        <PanoItemVisualRenderer item={rowItem} isMajor={true} />
                        <div
                          className="font-pano-title text-white text-uppercase text-nowrap"
                          style={{
                            fontSize: "clamp(1.5rem, min(3.2vw, 4.8vh), 3.8rem)",
                            letterSpacing: "3px",
                            lineHeight: 1,
                          }}
                        >
                          {title}
                        </div>
                      </div>

                      {/* Orta: ALIŞ - WE BUY Bölümü */}
                      <div
                        className="d-flex flex-column align-items-center justify-content-center"
                        style={{ width: "32.5%", textAlign: "center" }}
                      >
                        <div
                          className="font-pano-header text-uppercase text-nowrap mb-0.5"
                          style={{
                            color: "rgba(255, 255, 255, 0.65)",
                            fontSize: "clamp(0.68rem, min(0.95vw, 1.8vh), 1.2rem)",
                            letterSpacing: "2px",
                          }}
                        >
                          ALIŞ - WE BUY
                        </div>
                        <div
                          className="font-pano-rate rate-color-buy text-nowrap"
                          style={{
                            fontSize: "clamp(1.9rem, min(4.2vw, 6.2vh), 4.6rem)",
                            letterSpacing: "2px",
                          }}
                        >
                          {alisStr}
                        </div>
                      </div>

                      {/* Sağ: SATIŞ - WE SELL Bölümü */}
                      <div
                        className="d-flex flex-column align-items-center justify-content-center"
                        style={{ width: "32.5%", textAlign: "center" }}
                      >
                        <div
                          className="font-pano-header text-uppercase text-nowrap mb-0.5"
                          style={{
                            color: "rgba(255, 255, 255, 0.65)",
                            fontSize: "clamp(0.68rem, min(0.95vw, 1.8vh), 1.2rem)",
                            letterSpacing: "2px",
                          }}
                        >
                          SATIŞ - WE SELL
                        </div>
                        <div
                          className="font-pano-rate rate-color-sell text-nowrap"
                          style={{
                            fontSize: "clamp(1.9rem, min(4.2vw, 6.2vh), 4.6rem)",
                            letterSpacing: "2px",
                          }}
                        >
                          {satisStr}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* =================================================================
                2. BÖLÜM: ALT İKİ SÜTUNLUK IZGARA
                Ekranın kalan %67'sini kaplar, her satır flex: 1 ile eşit paylaştırılır.
                Sol Sütun (Eski Çeyrek, Yarım, Tam, Ata)
                Sağ Sütun (Yeni Çeyrek, Yarım, Tam, Gümüş)
               ================================================================= */}
            <div
              className="w-100 d-flex flex-grow-1"
              style={{
                height: topRows.length > 0 ? (topRows.length === 1 ? "82vh" : "67vh") : "100vh",
                minHeight: 0,
                padding: "clamp(4px, 1vh, 12px) clamp(16px, 2.5vw, 44px) clamp(8px, 1.5vh, 18px)",
                gap: "clamp(16px, 2.5vw, 48px)",
                boxSizing: "border-box",
              }}
            >
              {/* --- SOL SÜTUN --- */}
              <div className="d-flex flex-column h-100" style={{ width: "50%", minWidth: 0 }}>
                {/* Sütun Başlıkları: ALIŞ - WE BUY & SATIŞ - WE SELL */}
                <div
                  className="d-flex align-items-center pb-1"
                  style={{
                    flex: "0 0 auto",
                    height: "clamp(22px, 3.6vh, 36px)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
                  }}
                >
                  <div style={{ width: "42%" }} />
                  <div
                    className="font-pano-header text-uppercase text-center text-nowrap"
                    style={{
                      width: "29%",
                      color: "rgba(255, 255, 255, 0.65)",
                      fontSize: "clamp(0.65rem, min(0.95vw, 1.7vh), 1.15rem)",
                      letterSpacing: "1.5px",
                    }}
                  >
                    ALIŞ - WE BUY
                  </div>
                  <div
                    className="font-pano-header text-uppercase text-center text-nowrap"
                    style={{
                      width: "29%",
                      color: "rgba(255, 255, 255, 0.65)",
                      fontSize: "clamp(0.65rem, min(0.95vw, 1.7vh), 1.15rem)",
                      letterSpacing: "1.5px",
                    }}
                  >
                    SATIŞ - WE SELL
                  </div>
                </div>

                {/* Sol Sütun Satırları (Her satır flex: 1 ile eşit yükseklik alır) */}
                <div className="d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
                  {leftColumnItems.map((item, idx) => {
                    const title = item.gorunecekAd || item.ad || item.kod;
                    const alisStr = formatPanoRate(item.dovizAlis);
                    const satisStr = formatPanoRate(item.dovizSatis);
                    const flash = flashedItems[(item.kod || "").toUpperCase()];

                    return (
                      <div
                        key={`left-${item.paraId}-${idx}`}
                        className={`d-flex align-items-center px-2 pano-row-hover rounded-2 ${
                          flash ? (flash === "up" ? "flash-up" : "flash-down") : ""
                        }`}
                        style={{
                          flex: 1,
                          minHeight: 0,
                          borderBottom: idx < leftColumnItems.length - 1 ? "1px solid rgba(255, 255, 255, 0.05)" : "none",
                        }}
                      >
                        {/* Sol: Sikke/Görsel + Ürün İsmi */}
                        <div
                          className="d-flex align-items-center gap-2 gap-md-3 min-w-0"
                          style={{ width: "42%", overflow: "hidden" }}
                        >
                          <PanoItemVisualRenderer item={item} isMajor={false} />
                          <div
                            className="font-pano-title text-white text-uppercase text-nowrap"
                            style={{
                              fontSize: "clamp(0.85rem, min(1.45vw, 2.5vh), 1.85rem)",
                              letterSpacing: "1px",
                              lineHeight: 1.1,
                            }}
                          >
                            {title}
                          </div>
                        </div>

                        {/* Alış Fiyatı (Kırmızı) */}
                        <div
                          className="font-pano-rate rate-color-buy text-center text-nowrap"
                          style={{
                            width: "29%",
                            fontSize: "clamp(1.2rem, min(2.4vw, 4.0vh), 3.0rem)",
                            letterSpacing: "1px",
                          }}
                        >
                          {alisStr}
                        </div>

                        {/* Satış Fiyatı (Yeşil) */}
                        <div
                          className="font-pano-rate rate-color-sell text-center text-nowrap"
                          style={{
                            width: "29%",
                            fontSize: "clamp(1.2rem, min(2.4vw, 4.0vh), 3.0rem)",
                            letterSpacing: "1px",
                          }}
                        >
                          {satisStr}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dikey Ayırıcı Çizgi */}
              <div
                style={{
                  width: "1px",
                  height: "100%",
                  background: "linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.15) 15%, rgba(255, 255, 255, 0.15) 85%, transparent)",
                }}
              />

              {/* --- SAĞ SÜTUN --- */}
              <div className="d-flex flex-column h-100" style={{ width: "50%", minWidth: 0 }}>
                {/* Sütun Başlıkları: ALIŞ - WE BUY & SATIŞ - WE SELL */}
                <div
                  className="d-flex align-items-center pb-1"
                  style={{
                    flex: "0 0 auto",
                    height: "clamp(22px, 3.6vh, 36px)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
                  }}
                >
                  <div style={{ width: "42%" }} />
                  <div
                    className="font-pano-header text-uppercase text-center text-nowrap"
                    style={{
                      width: "29%",
                      color: "rgba(255, 255, 255, 0.65)",
                      fontSize: "clamp(0.65rem, min(0.95vw, 1.7vh), 1.15rem)",
                      letterSpacing: "1.5px",
                    }}
                  >
                    ALIŞ - WE BUY
                  </div>
                  <div
                    className="font-pano-header text-uppercase text-center text-nowrap"
                    style={{
                      width: "29%",
                      color: "rgba(255, 255, 255, 0.65)",
                      fontSize: "clamp(0.65rem, min(0.95vw, 1.7vh), 1.15rem)",
                      letterSpacing: "1.5px",
                    }}
                  >
                    SATIŞ - WE SELL
                  </div>
                </div>

                {/* Sağ Sütun Satırları (Her satır flex: 1 ile eşit yükseklik alır) */}
                <div className="d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
                  {rightColumnItems.map((item, idx) => {
                    const title = item.gorunecekAd || item.ad || item.kod;
                    const alisStr = formatPanoRate(item.dovizAlis);
                    const satisStr = formatPanoRate(item.dovizSatis);
                    const flash = flashedItems[(item.kod || "").toUpperCase()];

                    return (
                      <div
                        key={`right-${item.paraId}-${idx}`}
                        className={`d-flex align-items-center px-2 pano-row-hover rounded-2 ${
                          flash ? (flash === "up" ? "flash-up" : "flash-down") : ""
                        }`}
                        style={{
                          flex: 1,
                          minHeight: 0,
                          borderBottom: idx < rightColumnItems.length - 1 ? "1px solid rgba(255, 255, 255, 0.05)" : "none",
                        }}
                      >
                        {/* Sol: Sikke/Görsel + Ürün İsmi */}
                        <div
                          className="d-flex align-items-center gap-2 gap-md-3 min-w-0"
                          style={{ width: "42%", overflow: "hidden" }}
                        >
                          <PanoItemVisualRenderer item={item} isMajor={false} />
                          <div
                            className="font-pano-title text-white text-uppercase text-nowrap"
                            style={{
                              fontSize: "clamp(0.85rem, min(1.45vw, 2.5vh), 1.85rem)",
                              letterSpacing: "1px",
                              lineHeight: 1.1,
                            }}
                          >
                            {title}
                          </div>
                        </div>

                        {/* Alış Fiyatı (Kırmızı) */}
                        <div
                          className="font-pano-rate rate-color-buy text-center text-nowrap"
                          style={{
                            width: "29%",
                            fontSize: "clamp(1.2rem, min(2.4vw, 4.0vh), 3.0rem)",
                            letterSpacing: "1px",
                          }}
                        >
                          {alisStr}
                        </div>

                        {/* Satış Fiyatı (Yeşil) */}
                        <div
                          className="font-pano-rate rate-color-sell text-center text-nowrap"
                          style={{
                            width: "29%",
                            fontSize: "clamp(1.2rem, min(2.4vw, 4.0vh), 3.0rem)",
                            letterSpacing: "1px",
                          }}
                        >
                          {satisStr}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

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

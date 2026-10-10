import React from "react";
import { Link } from "react-router-dom";

/** Likya işareti: "L" harfi ve yükselen tepe (K6). public-erp/favicon.svg ile aynı çizim. */
export const LogoIsaret: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
    <rect width="64" height="64" rx="14" fill="#0b1f3a" />
    <path d="M20 15v33h25" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M30 35l8-10 8 10" fill="none" stroke="#f5b83d" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Logo: React.FC<{ acik?: boolean; onClick?: () => void }> = ({ acik, onClick }) => (
  <Link to="/" className={`logo${acik ? " logo-acik" : ""}`} aria-label="Likya ERP ana sayfa" onClick={onClick}>
    <LogoIsaret />
    <span>
      Likya<span className="nokta">.</span>ERP
    </span>
  </Link>
);

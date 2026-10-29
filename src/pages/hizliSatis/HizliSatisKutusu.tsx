import React from "react";

/**
 * Hızlı satış ürün kutusu: resim varsa resim + ad, yoksa renkli zemin + ad (düzen ve satış ekranı ortak).
 * Resim kırpılmadan sığdırılır (contain); boş kalan alan ve saydam PNG arkası butonun zemin rengidir (renksizse beyaz).
 */
export interface HizliSatisKutusuProps {
  ad: string;
  kod?: string | null;
  renk?: string | null;
  resim?: string | null;
  altYazi?: string | null;
  uyari?: string;
  pasif?: boolean;
  onClick?: () => void;
}

/** Zemin rengine göre okunur yazı rengi */
export const yaziRengi = (zemin: string | null | undefined): string => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(zemin || "");
  if (!m) return "var(--bs-body-color)";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#1f2937" : "#ffffff";
};

export const HizliSatisKutusu: React.FC<HizliSatisKutusuProps> = ({ ad, kod, renk, resim, altYazi, uyari, pasif, onClick }) => (
  <button type="button" onClick={onClick} disabled={pasif} title={uyari || ad}
    className="hs-kutu w-100 border-0 p-0 d-flex flex-column overflow-hidden shadow-sm"
    style={{ height: 118, borderRadius: 10, background: renk || "var(--bs-tertiary-bg)", color: yaziRengi(renk), opacity: pasif ? 0.5 : 1,
      outline: uyari ? "2px dashed var(--bs-danger)" : undefined, cursor: pasif ? "not-allowed" : "pointer", touchAction: "manipulation" }}>
    {resim ? (
      <div className="flex-grow-1 w-100" style={{ background: `${renk || "#ffffff"} url("${resim}") center/contain no-repeat`, minHeight: 0 }} />
    ) : (
      <div className="flex-grow-1 w-100 d-flex align-items-center justify-content-center px-2 fw-bold" style={{ fontSize: 15, lineHeight: 1.15, minHeight: 0 }}>
        {ad}
      </div>
    )}
    <div className="w-100 px-1 text-center" style={{ fontSize: 12, lineHeight: 1.2, padding: "3px 0", background: resim ? "rgba(0,0,0,.62)" : "transparent", color: resim ? "#fff" : undefined }}>
      {resim ? <div className="fw-semibold text-truncate">{ad}</div> : kod ? <div className="text-truncate" style={{ opacity: 0.75 }}>{kod}</div> : null}
      {altYazi ? <div className="text-truncate fw-semibold">{altYazi}</div> : null}
    </div>
  </button>
);

export default HizliSatisKutusu;

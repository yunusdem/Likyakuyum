import React, { useState, useRef, useEffect } from "react";
import { IconCheck } from "@tabler/icons-react";

export interface ComboboxInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  headerTitle?: string;
  badgeText?: string;
  className?: string;
}

export const ComboboxInput: React.FC<ComboboxInputProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = "",
  disabled = false,
  icon,
  headerTitle,
  badgeText,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dışarı tıklandığında dropdown menüyü kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  // Yazılan değere göre filtrele, eşleşen yoksa tüm listeyi göster
  const trimmed = (value || "").trim().toLowerCase();
  const filtered = trimmed
    ? options.filter((opt) => opt.toLowerCase().includes(trimmed))
    : options;
  const displayOptions = filtered.length > 0 ? filtered : options;

  return (
    <div
      ref={containerRef}
      className={`position-relative w-100 ${className}`}
      style={{ userSelect: "none" }}
    >
      <style>{`
        @keyframes comboboxFadeIn {
          0% {
            opacity: 0;
            transform: translateY(-4px) scaleY(0.98);
            transform-origin: top center;
          }
          100% {
            opacity: 1;
            transform: translateY(0) scaleY(1);
            transform-origin: top center;
          }
        }
      `}</style>
      {/* Input / Trigger Alanı */}
      <div
        className="d-flex align-items-center w-100"
        style={{
          height: "40px",
          backgroundColor: disabled ? "#f8fafc" : "#ffffff",
          border: `1.5px solid ${isOpen ? "#2563eb" : "#dee2e6"}`,
          borderRadius: isOpen ? "8px 8px 0 0" : "8px",
          boxShadow: isOpen
            ? "0 0 0 3px rgba(37, 99, 235, 0.12)"
            : "none",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: isOpen ? 1061 : 1,
        }}
      >
        {/* Sol İkon */}
        {icon && (
          <div
            className="d-flex align-items-center justify-content-center px-2.5 flex-shrink-0"
            style={{
              color: isOpen ? "#2563eb" : "#64748b",
              transition: "color 0.2s ease",
            }}
          >
            {icon}
          </div>
        )}

        {/* Yazılabilir Input Alanı */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          className="w-100 h-100 border-0 bg-transparent px-1"
          style={{
            outline: "none",
            fontSize: "0.85rem",
            fontWeight: 500,
            color: disabled ? "#94a3b8" : "#1e293b",
          }}
        />

        {/* Sağ Chevron / Açma-Kapama Butonu */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (!disabled) {
              if (!isOpen && inputRef.current) {
                inputRef.current.focus();
              }
              setIsOpen(!isOpen);
            }
          }}
          className="d-flex align-items-center justify-content-center border-0 bg-transparent px-2.5 h-100"
          style={{
            cursor: disabled ? "not-allowed" : "pointer",
            color: isOpen ? "#2563eb" : "#64748b",
          }}
          title="Seçenekleri Göster"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              width: "16px",
              height: "16px",
              transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              flexShrink: 0,
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Dropdown Menü (Input Alanı ile Birebir Aynı Genişlikte Açılır) */}
      {isOpen && !disabled && (
        <div
          className="position-absolute start-0 end-0 shadow-lg"
          style={{
            top: "100%",
            width: "100%",
            backgroundColor: "#ffffff",
            border: "1.5px solid #2563eb",
            borderTop: "1px solid #f1f5f9",
            borderRadius: "0 0 10px 10px",
            boxShadow:
              "0 14px 28px -4px rgba(15, 23, 42, 0.14), 0 6px 12px -2px rgba(15, 23, 42, 0.08)",
            padding: "8px 6px",
            zIndex: 1060,
            maxHeight: "260px",
            overflowY: "auto",
            animation: "comboboxFadeIn 0.18s ease-out",
          }}
        >
          {/* Üst Başlık & Adet Rozeti */}
          {headerTitle && (
            <div className="d-flex align-items-center justify-content-between px-2.5 py-1.5 mb-1.5 border-bottom border-light-subtle">
              <span
                className="small fw-bold text-uppercase text-secondary d-flex align-items-center gap-1.5"
                style={{ fontSize: "0.68rem", letterSpacing: "0.5px" }}
              >
                {headerTitle}
              </span>
              <span
                className="badge bg-light text-muted border fw-normal"
                style={{ fontSize: "0.65rem" }}
              >
                {badgeText || `${displayOptions.length} Adet`}
              </span>
            </div>
          )}

          {/* Seçenekler Listesi */}
          <div className="d-flex flex-column gap-1">
            {displayOptions.map((opt) => {
              const isSelected = value.trim() === opt.trim();
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className="w-100 text-start border-0 rounded-2 px-2.5 py-2 d-flex align-items-center justify-content-between"
                  style={{
                    fontSize: "0.85rem",
                    backgroundColor: isSelected ? "#eff6ff" : "transparent",
                    color: isSelected ? "#1d4ed8" : "#334155",
                    fontWeight: isSelected ? 600 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }
                  }}
                >
                  <span className="d-flex align-items-center gap-2">
                    <span
                      className="rounded-circle d-inline-block flex-shrink-0"
                      style={{
                        width: "7px",
                        height: "7px",
                        backgroundColor: isSelected ? "#2563eb" : "#94a3b8",
                        transition: "background-color 0.15s ease",
                      }}
                    />
                    <span>{opt}</span>
                  </span>
                  {isSelected && (
                    <IconCheck
                      size={16}
                      className="text-primary flex-shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

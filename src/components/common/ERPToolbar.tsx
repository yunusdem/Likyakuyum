import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  IconNumbers,
  IconPrinter,
  IconCash,
  IconChartBar,
  IconPackage,
  IconUserPlus,
  IconUserCheck,
  IconBuilding,
  IconUserCheck as IconUser,
  IconFileText,
} from "@tabler/icons-react";

export interface ERPToolbarProps {
  onNew?: () => void;
  onSave?: () => void;
  onSearch?: () => void;
  onDelete?: () => void;
  onFirst?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onLast?: () => void;
  onPrint?: () => void;
  onRefresh?: () => void;
  onClear?: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onSelectUser?: () => void;
  onDetailSearch?: () => void;
  onFilter?: () => void;
  onDuplicate?: () => void;
  onHksSend?: () => void;
  onEDocument?: () => void;
  onConsolidatedDB?: () => void;
  disabled?: boolean;
  pageTitle?: string;
  pageIcon?: React.ReactNode;
}

const ROUTE_PAGE_MAP: Record<string, { title: string; icon: React.ReactNode }> = {
  "/ayarlar/numeratorler": { title: "Numaratör Tanımları", icon: <IconNumbers size={20} /> },
  "/tanimlar/numeratorler": { title: "Numaratör Tanımları", icon: <IconNumbers size={20} /> },
  "/ayarlar/numaratorler": { title: "Numaratör Tanımları", icon: <IconNumbers size={20} /> },
  "/ayarlar/numarator-tanimlari": { title: "Numaratör Tanımları", icon: <IconNumbers size={20} /> },
  "/ayarlar/yazici-tanimlari": { title: "Yazıcı Tanımları", icon: <IconPrinter size={20} /> },
  "/tanimlar/yazici-tanimlari": { title: "Yazıcı Tanımları", icon: <IconPrinter size={20} /> },
  "/ayarlar/vezne-tanimlari": { title: "Vezne Tanımları", icon: <IconCash size={20} /> },
  "/tanimlar/vezne-tanimlari": { title: "Vezne Tanımları", icon: <IconCash size={20} /> },
  "/ayarlar/istatistik-tanimlari": { title: "İstatistik Tanımları", icon: <IconChartBar size={20} /> },
  "/tanimlar/istatistik-tanimlari": { title: "İstatistik Tanımları", icon: <IconChartBar size={20} /> },
  "/ayarlar/urun-tanimlari": { title: "Ürün Tanımları", icon: <IconPackage size={20} /> },
  "/tanimlar/urun-tanimlari": { title: "Ürün Tanımları", icon: <IconPackage size={20} /> },
  "/cari/kart-kayit": { title: "Cari Kart Kayıt", icon: <IconUserPlus size={20} /> },
  "/cari/kayit": { title: "Cari Kart Kayıt", icon: <IconUserPlus size={20} /> },
  "/cari/kart-duzeltme": { title: "Cari Kart Düzeltme", icon: <IconUserCheck size={20} /> },
  "/cari/kart-listesi": { title: "Cari Kart Listesi", icon: <IconFileText size={20} /> },
  "/cari/listesi": { title: "Cari Kart Listesi", icon: <IconFileText size={20} /> },
  "/cari/cari-kart-listesi": { title: "Cari Kart Listesi", icon: <IconFileText size={20} /> },
  "/cari/detayli-kart-listesi": { title: "Cari Kart Listesi", icon: <IconFileText size={20} /> },
  "/cari/hareket-kayit": { title: "C- Cari Hareket Kayıt", icon: <IconCash size={20} /> },
  "/cari/hareket-duzeltme": { title: "D- Cari Hareket Düzeltme", icon: <IconCash size={20} /> },
  "/cari/hareket-listesi": { title: "E- Cari Hareket Listesi", icon: <IconFileText size={20} /> },
  "/ayarlar/firma-tanimlari": { title: "Firma Tanımları", icon: <IconBuilding size={20} /> },
  "/ayarlar/kullanici-tanimlari": { title: "Kullanıcı Tanımları", icon: <IconUser size={20} /> },
};

export const ERPToolbar: React.FC<ERPToolbarProps> = ({
  onNew,
  onSave,
  onSearch,
  onDelete,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onPrint,
  onRefresh,
  onClear,
  disabled = false,
  pageTitle,
  pageIcon,
}) => {
  const location = useLocation();
  const routeMatch = ROUTE_PAGE_MAP[location.pathname];
  const finalTitle = pageTitle || routeMatch?.title || "";
  const finalIcon = pageIcon || routeMatch?.icon || <IconFileText size={20} />;
  // Global ERP keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      if (e.key === "F2") {
        e.preventDefault();
        if (onSave) onSave();
      } else if (e.key === "F3") {
        e.preventDefault();
        if (onSearch) {
          onSearch();
        } else {
          const searchInput = document.querySelector<HTMLInputElement>(
            "input[type='search'], input[placeholder*='ara' i], input[placeholder*='Ara' i]"
          );
          if (searchInput) searchInput.focus();
        }
      } else if (e.key === "F4") {
        e.preventDefault();
        if (onNew) onNew();
        else if (onClear) onClear();
      } else if (e.key === "F5") {
        if (onRefresh) {
          e.preventDefault();
          onRefresh();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSave, onSearch, onNew, onClear, onRefresh, disabled]);

  const defaultHandler = (actionName: string) => {
    if (actionName === "Ara/Bul") {
      const searchInput = document.querySelector<HTMLInputElement>(
        "input[type='search'], input[placeholder*='ara' i], input[placeholder*='Ara' i]"
      );
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
        return;
      }
    }
    if (actionName === "Yazdır") {
      window.print();
      return;
    }
  };

  return (
    <div className="erp-action-toolbar-wrapper mb-3 p-1.5 d-flex align-items-center justify-content-between flex-wrap gap-1 bg-white border rounded shadow-2xs">
      {/* Sol Toolbar Buton Grubu - Sıfır Sayfa Titremesi / Sıfır Kayma */}
      <div className="d-flex align-items-center flex-wrap erp-toolbar-strip gap-1">
        {/* 1. Yeni Kayıt (F4) - Boş Belge & Üst Köşesinde Artı (+) İkonu */}
        <button
          type="button"
          disabled={disabled}
          onClick={onNew || onClear || (() => defaultHandler("Yeni Kayıt"))}
          className="erp-tb-btn"
          title="Yeni Kayıt (F4)"
          aria-label="Yeni Kayıt"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            {/* Boş Beyaz Belge Gövdesi */}
            <path
              d="M4 4.5C4 3.67 4.67 3 5.5 3H12.5L17.5 8V20.5C17.5 21.33 16.83 22 16 22H5.5C4.67 22 4 21.33 4 20.5V4.5Z"
              fill="#ffffff"
              stroke="#475569"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* Belge Katlanmış Köşesi */}
            <path
              d="M12.5 3V8H17.5"
              fill="#e2e8f0"
              stroke="#475569"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {/* Üst Kenar / Köşedeki Yeşil Kare Artı (+) Rozeti */}
            <rect
              x="12.5"
              y="1.5"
              width="10"
              height="10"
              rx="2.5"
              fill="#22c55e"
              stroke="#ffffff"
              strokeWidth="1.4"
            />
            {/* Kalın Beyaz Artı (+) */}
            <line x1="17.5" y1="3.8" x2="17.5" y2="9.2" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="14.8" y1="6.5" x2="20.2" y2="6.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* 2. Kaydet (F2) */}
        <button
          type="button"
          disabled={disabled}
          onClick={onSave || (() => defaultHandler("Kaydet"))}
          className="erp-tb-btn"
          title="Kaydet (F2)"
          aria-label="Kaydet"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            {/* Floppy Body (Blue) */}
            <path
              d="M4 3H17L20 6V20C20 20.55 19.55 21 19 21H5C4.45 21 4 20.55 4 20V3Z"
              fill="#2563eb"
              stroke="#1d4ed8"
              strokeWidth="1.2"
            />
            {/* Top White Metal Shutter */}
            <rect x="7" y="3.5" width="9" height="7" rx="0.5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.8" />
            <rect x="12" y="5" width="2.5" height="4" rx="0.3" fill="#2563eb" />
            {/* Bottom White Label */}
            <rect x="6.5" y="13" width="11" height="7.5" rx="0.5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.8" />
            <line x1="8" y1="15.5" x2="16" y2="15.5" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
            <line x1="8" y1="18" x2="14" y2="18" stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </button>

        {/* 3. Ara / Bul (F3) */}
        <button
          type="button"
          disabled={disabled}
          onClick={
            onSearch ||
            (() => {
              const searchInput = document.querySelector<HTMLInputElement>(
                "input[type='search'], input[placeholder*='ara' i], input[placeholder*='Ara' i]"
              );
              if (searchInput) {
                searchInput.focus();
                searchInput.select();
              }
            })
          }
          className="erp-tb-btn"
          title="Ara / Bul (F3)"
          aria-label="Ara / Bul"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            {/* Sol ve Sağ Üst Göz Mercekleri */}
            <rect x="3.5" y="3" width="5" height="3" rx="1" fill="#1e293b" stroke="#000000" strokeWidth="0.5" />
            <rect x="15.5" y="3" width="5" height="3" rx="1" fill="#1e293b" stroke="#000000" strokeWidth="0.5" />

            {/* Sol Dürbün Gövdesi */}
            <path d="M4 6H8L10 16.5H2.5L4 6Z" fill="#0f172a" stroke="#000000" strokeWidth="0.8" />
            <ellipse cx="6.2" cy="17.2" rx="4" ry="2.2" fill="#000000" />
            <ellipse cx="6.2" cy="17.2" rx="2.6" ry="1.2" fill="#38bdf8" fillOpacity="0.45" />

            {/* Sağ Dürbün Gövdesi */}
            <path d="M16 6H20L21.5 16.5H14L16 6Z" fill="#0f172a" stroke="#000000" strokeWidth="0.8" />
            <ellipse cx="17.8" cy="17.2" rx="4" ry="2.2" fill="#000000" />
            <ellipse cx="17.8" cy="17.2" rx="2.6" ry="1.2" fill="#38bdf8" fillOpacity="0.45" />

            {/* Orta Bağlantı Köprüsü ve Netlik Ayar Tekerleği */}
            <rect x="8" y="7.5" width="8" height="2.5" rx="0.5" fill="#334155" />
            <rect x="10.5" y="5.5" width="3" height="6.5" rx="1" fill="#64748b" stroke="#000000" strokeWidth="0.5" />
            <line x1="11" y1="8" x2="13" y2="8" stroke="#cbd5e1" strokeWidth="0.8" />
            <rect x="8" y="12" width="8" height="2" fill="#1e293b" />
          </svg>
        </button>

        {/* 4. Sil */}
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete || (() => defaultHandler("Sil"))}
          className="erp-tb-btn"
          title="Sil"
          aria-label="Sil"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            {/* Trash Lid */}
            <path d="M3 6H21" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" />
            {/* Trash Can Body (Red Fill) */}
            <path d="M19 6L18 20C18 20.5523 17.5523 21 17 21H7C6.44772 21 6 20.5523 6 20L5 6" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.8" />
            {/* Vertical Inner Lines */}
            <line x1="10" y1="10" x2="10" y2="17" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="14" y1="10" x2="14" y2="17" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <span className="erp-tb-divider" />

        {/* 5. İlk Kayıt (|◀) */}
        <button
          type="button"
          disabled={disabled}
          onClick={onFirst || (() => defaultHandler("İlk Kayıt"))}
          className="erp-tb-btn"
          title="İlk Kayıt"
          aria-label="İlk Kayıt"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000">
            <rect x="4" y="4" width="3" height="16" rx="0.5" />
            <polygon points="20,4 20,20 8,12" />
          </svg>
        </button>

        {/* 6. Önceki Kayıt (◀) */}
        <button
          type="button"
          disabled={disabled}
          onClick={onPrev || (() => defaultHandler("Önceki Kayıt"))}
          className="erp-tb-btn"
          title="Önceki Kayıt"
          aria-label="Önceki Kayıt"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000">
            <polygon points="18,4 18,20 6,12" />
          </svg>
        </button>

        {/* Sonraki Kayıt (▶) */}
        <button
          type="button"
          disabled={disabled}
          onClick={onNext || (() => defaultHandler("Sonraki Kayıt"))}
          className="erp-tb-btn"
          title="Sonraki Kayıt"
          aria-label="Sonraki Kayıt"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000">
            <polygon points="6,4 6,20 18,12" />
          </svg>
        </button>

        {/* 7. Son Kayıt (▶|) */}
        <button
          type="button"
          disabled={disabled}
          onClick={onLast || (() => defaultHandler("Son Kayıt"))}
          className="erp-tb-btn"
          title="Son Kayıt"
          aria-label="Son Kayıt"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#000000">
            <polygon points="4,4 4,20 16,12" />
            <rect x="17" y="4" width="3" height="16" rx="0.5" />
          </svg>
        </button>

        <span className="erp-tb-divider" />

        {/* 8. Yazdır (Ctrl+P) */}
        <button
          type="button"
          disabled={disabled}
          onClick={onPrint || (() => window.print())}
          className="erp-tb-btn"
          title="Yazdır (Ctrl+P)"
          aria-label="Yazdır"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V3h12v6" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" rx="0.5" fill="#f8fafc" stroke="#000000" strokeWidth="1.8" />
            <line x1="9" y1="17" x2="15" y2="17" />
            <line x1="9" y1="19.5" x2="13" y2="19.5" />
          </svg>
        </button>
      </div>

      {/* Ortadaki Sayfa İkonu ve Başlığı (Print'in sağında, Refresh'in solunda) */}
      {finalTitle && (
        <div className="d-flex align-items-center gap-2 px-2 ms-2 me-auto erp-toolbar-title-box">
          <span className="erp-tb-divider d-none d-sm-inline-block" style={{ height: "20px", margin: "0 6px 0 0" }} />
          {finalIcon && (
            <span className="text-primary d-inline-flex align-items-center">
              {finalIcon}
            </span>
          )}
          <span className="fw-bold text-dark fs-6" style={{ letterSpacing: "-0.2px" }}>
            {finalTitle}
          </span>
        </div>
      )}

      {/* Sağ Toolbar Grubu: Yenile */}
      <div className="d-flex align-items-center gap-1 ms-auto">
        {onRefresh && (
          <button
            type="button"
            disabled={disabled}
            onClick={onRefresh}
            className="erp-tb-btn erp-tb-btn-secondary"
            title="Yenile (F5)"
            aria-label="Yenile"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4" />
              <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ERPToolbar;

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  IconTrash,
  IconPlus,
  IconRefresh,
  IconDeviceFloppy,
  IconFilePlus,
  IconPrinter,
  IconFolderMinus,
  IconSettings,
} from "@tabler/icons-react";

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  targetType: "grid-row" | "sidebar" | "page";
  rowId?: string;
  tableType?: string;
  tableActionHandler?: {
    onDeleteRow?: (rowId: string) => void;
    onAddRow?: () => void;
  };
}

export const ERPContextMenu: React.FC = () => {
  const [menu, setMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetType: "page",
  });

  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setMenu((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
  }, []);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // Input veya metin seçimlerinde tarayıcı varsayılanına izin vermek istenirse kontrol edilebilir,
      // ancak kullanıcının "SAğdaki sidebar ve tüm sayfalarda sağ tıka basınca bize özel şeyler gözükecek" talebine
      // istinaden custom ERP menüsü açıyoruz.
      const target = e.target as HTMLElement | null;
      if (!target) return;

      e.preventDefault();

      let targetType: "grid-row" | "sidebar" | "page" = "page";
      let rowId: string | undefined;
      let tableType: string | undefined;

      // 1. Grid Satırı tespiti
      const tr = target.closest("tr");
      if (tr) {
        const gridRowId = tr.getAttribute("data-row-id") || tr.dataset?.rowId;
        tableType = tr.getAttribute("data-table-type") || tr.closest("table")?.getAttribute("data-table-type") || undefined;
        if (gridRowId) {
          targetType = "grid-row";
          rowId = gridRowId;
        } else {
          // data-row-id yoksa ama bir tbody içindeyse yine grid satırı olarak kabul et
          const tbody = tr.closest("tbody");
          if (tbody) {
            targetType = "grid-row";
            const rowIndex = Array.from(tbody.children).indexOf(tr);
            rowId = String(rowIndex);
          }
        }
      }

      // 2. Sidebar tespiti
      if (targetType !== "grid-row" && target.closest("#miniSidebar, .sidebar-menu-wrapper, .navbar-vertical")) {
        targetType = "sidebar";
      }

      // Menü koordinatlarını ekran sınırları içine al
      let x = e.clientX;
      let y = e.clientY;
      const menuWidth = 200;
      const menuHeight = 220;

      if (x + menuWidth > window.innerWidth) {
        x = window.innerWidth - menuWidth - 10;
      }
      if (y + menuHeight > window.innerHeight) {
        y = window.innerHeight - menuHeight - 10;
      }

      setMenu({
        isOpen: true,
        x,
        y,
        targetType,
        rowId,
        tableType,
      });
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu]);

  if (!menu.isOpen) return null;

  // Eylemler
  const handleAction = (actionKey: string) => {
    closeMenu();

    if (actionKey === "row-delete") {
      window.dispatchEvent(
        new CustomEvent("erp-grid-row-delete", { detail: { rowId: menu.rowId, tableType: menu.tableType } })
      );
    } else if (actionKey === "row-add") {
      window.dispatchEvent(
        new CustomEvent("erp-grid-row-add", { detail: { rowId: menu.rowId, tableType: menu.tableType } })
      );
    } else if (actionKey === "refresh") {
      window.location.reload();
    } else if (actionKey === "new-record") {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F4" }));
    } else if (actionKey === "save-record") {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "F1" }));
    } else if (actionKey === "print") {
      window.print();
    } else if (actionKey === "sidebar-collapse-all") {
      // Sidebar tüm menüleri kapat
      const openButtons = document.querySelectorAll<HTMLElement>("#miniSidebar .accordion-button:not(.collapsed)");
      openButtons.forEach((btn) => btn.click());
    }
  };

  return (
    <div
      ref={menuRef}
      className="erp-context-menu"
      style={{ top: `${menu.y}px`, left: `${menu.x}px` }}
      role="menu"
    >
      {/* 1. Grid Satırı Seçenekleri */}
      {menu.targetType === "grid-row" && (
        <>
          <div className="erp-context-menu-header">Satır İşlemleri</div>
          <button
            type="button"
            className="erp-context-menu-item text-danger"
            onClick={() => handleAction("row-delete")}
          >
            <IconTrash size={16} />
            <span>Satırı Sil</span>
          </button>
          <button
            type="button"
            className="erp-context-menu-item text-success"
            onClick={() => handleAction("row-add")}
          >
            <IconPlus size={16} />
            <span>Yeni Satır Ekle</span>
          </button>
          <div className="erp-context-menu-divider" />
        </>
      )}

      {/* 2. Sidebar Seçenekleri */}
      {menu.targetType === "sidebar" && (
        <>
          <div className="erp-context-menu-header">Menü Seçenekleri</div>
          <button
            type="button"
            className="erp-context-menu-item"
            onClick={() => handleAction("refresh")}
          >
            <IconRefresh size={16} className="text-primary" />
            <span>Sayfayı Yenile</span>
          </button>
          <button
            type="button"
            className="erp-context-menu-item"
            onClick={() => handleAction("sidebar-collapse-all")}
          >
            <IconFolderMinus size={16} className="text-secondary" />
            <span>Tüm Menüleri Kapat</span>
          </button>
          <div className="erp-context-menu-divider" />
        </>
      )}

      {/* 3. Genel Sayfa ERP Eylemleri */}
      <div className="erp-context-menu-header">Hızlı İşlemler</div>
      <button
        type="button"
        className="erp-context-menu-item"
        onClick={() => handleAction("new-record")}
      >
        <IconFilePlus size={16} className="text-success" />
        <span>Yeni Kayıt (F4)</span>
      </button>
      <button
        type="button"
        className="erp-context-menu-item"
        onClick={() => handleAction("save-record")}
      >
        <IconDeviceFloppy size={16} className="text-primary" />
        <span>Kaydet (F1)</span>
      </button>
      <button
        type="button"
        className="erp-context-menu-item"
        onClick={() => handleAction("refresh")}
      >
        <IconRefresh size={16} className="text-secondary" />
        <span>Sayfayı Yenile (F5)</span>
      </button>
      <button
        type="button"
        className="erp-context-menu-item"
        onClick={() => handleAction("print")}
      >
        <IconPrinter size={16} className="text-dark" />
        <span>Yazdır (F10)</span>
      </button>
    </div>
  );
};

export default ERPContextMenu;

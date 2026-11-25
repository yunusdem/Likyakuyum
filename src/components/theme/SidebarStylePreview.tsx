import React from "react";
import { SidebarStyleType } from "../../hooks/useSidebarStyle";

interface SidebarStylePreviewProps {
  styleId: SidebarStyleType;
  isSelected?: boolean;
}

export const SidebarStylePreview: React.FC<SidebarStylePreviewProps> = ({
  styleId,
  isSelected = false,
}) => {
  return (
    <div
      className="rounded-2 p-1.5 border bg-white d-flex overflow-hidden mt-auto"
      style={{ height: "44px", borderColor: isSelected ? "#93c5fd" : "#e2e8f0" }}
    >
      {styleId === "hover" && (
        <div className="d-flex w-100 gap-1">
          <div className="rounded-1 bg-primary" style={{ width: "14px", height: "100%" }} />
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.68rem" }}
          >
            Sayfa Alanı (Fare ile Genişler)
          </div>
        </div>
      )}

      {styleId === "classic" && (
        <div className="d-flex w-100 gap-1">
          <div className="rounded-1 bg-primary" style={{ width: "32px", height: "100%" }} />
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.68rem" }}
          >
            Sayfa Alanı (Sabit Dikey Menü)
          </div>
        </div>
      )}

      {styleId === "flyout" && (
        <div className="d-flex w-100 gap-1 position-relative">
          <div className="rounded-1 bg-primary" style={{ width: "26px", height: "100%" }} />
          <div
            className="rounded-1 border border-warning shadow-xs bg-white px-1 d-flex align-items-center text-warning-emphasis"
            style={{ width: "45px", height: "90%", fontSize: "0.62rem", fontWeight: "bold" }}
          >
            Kart &gt;
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.68rem" }}
          >
            Sayfa
          </div>
        </div>
      )}

      {styleId === "topbar" && (
        <div className="d-flex flex-column w-100 gap-1">
          <div className="d-flex w-100 gap-1" style={{ height: "12px" }}>
            <div className="rounded-1 bg-success" style={{ width: "24px", height: "100%" }} />
            <div className="rounded-1 bg-primary flex-grow-1" style={{ height: "100%" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.68rem" }}
          >
            Tam Genişlik Sayfa (Üst Tek Satır)
          </div>
        </div>
      )}

      {styleId === "dual" && (
        <div className="d-flex w-100 gap-1">
          <div className="rounded-1 bg-success" style={{ width: "12px", height: "100%" }} />
          <div className="rounded-1 bg-primary-subtle border" style={{ width: "24px", height: "100%" }} />
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.68rem" }}
          >
            Sayfa Alanı
          </div>
        </div>
      )}

      {(styleId === "megamenu" || styleId === "drawer") && (
        <div className="d-flex flex-column w-100 gap-1">
          <div className="d-flex w-100 gap-1" style={{ height: "12px" }}>
            <div className="rounded-1 bg-success" style={{ width: "24px", height: "100%" }} />
            <div className="rounded-1 bg-info flex-grow-1" style={{ height: "100%" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-primary fw-medium"
            style={{ fontSize: "0.68rem" }}
          >
            Çok Sütunlu Mega Panel
          </div>
        </div>
      )}

      {styleId === "compact" && (
        <div className="d-flex w-100 gap-1">
          <div className="rounded-1 bg-secondary" style={{ width: "20px", height: "100%" }} />
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.68rem" }}
          >
            Geniş Çalışma Alanı (Dar 215px)
          </div>
        </div>
      )}

      {styleId === "wide" && (
        <div className="d-flex w-100 gap-1">
          <div
            className="rounded-1 bg-primary d-flex flex-column justify-content-center gap-0.5 px-1"
            style={{ width: "48px", height: "100%" }}
          >
            <div className="rounded-1 bg-white bg-opacity-75" style={{ height: "5px" }} />
            <div className="rounded-1 bg-white bg-opacity-50" style={{ height: "5px" }} />
            <div className="rounded-1 bg-white bg-opacity-50" style={{ height: "5px" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.68rem" }}
          >
            Ferah 320px Kart Menü
          </div>
        </div>
      )}

      {styleId === "floating" && (
        <div className="d-flex w-100 gap-1.5 p-0.5 bg-light rounded-1">
          <div
            className="rounded-2 bg-primary shadow-sm"
            style={{ width: "28px", height: "100%", border: "1px solid rgba(255,255,255,0.6)" }}
          />
          <div
            className="flex-grow-1 rounded-2 bg-white border d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.68rem" }}
          >
            Yüzen Yuvarlak Ada
          </div>
        </div>
      )}

      {styleId === "right" && (
        <div className="d-flex w-100 gap-1">
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.68rem" }}
          >
            Sayfa Alanı (Sağ Sabit)
          </div>
          <div className="rounded-1 bg-primary" style={{ width: "32px", height: "100%" }} />
        </div>
      )}

      {styleId === "ribbon" && (
        <div className="d-flex flex-column w-100 gap-0.5">
          <div className="d-flex w-100 gap-1" style={{ height: "10px" }}>
            <div className="rounded-1 bg-success" style={{ width: "22px", height: "100%" }} />
            <div className="rounded-1 bg-primary flex-grow-1" style={{ height: "100%" }} />
          </div>
          <div className="rounded-1 bg-primary-subtle border border-primary-subtle" style={{ height: "9px" }} />
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.62rem" }}
          >
            İki Katlı Şerit Sekmeli
          </div>
        </div>
      )}

      {styleId === "dock" && (
        <div className="d-flex flex-column w-100 gap-1">
          <div className="d-flex w-100 gap-1 align-items-center px-1 rounded-1 bg-dark" style={{ height: "12px" }}>
            <div className="rounded-circle bg-success" style={{ width: "6px", height: "6px" }} />
            <div className="rounded-1 bg-info" style={{ width: "18px", height: "4px" }} />
            <div className="rounded-1 bg-warning" style={{ width: "18px", height: "4px" }} />
            <div className="rounded-1 bg-light opacity-50" style={{ width: "18px", height: "4px" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-dark fw-medium"
            style={{ fontSize: "0.66rem" }}
          >
            Koyu İnce Bar + 3 Sütun
          </div>
        </div>
      )}

      {styleId === "railgrid" && (
        <div className="d-flex w-100 gap-1">
          <div
            className="rounded-1 bg-light border p-0.5"
            style={{
              width: "36px",
              height: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "2px",
            }}
          >
            <div className="rounded-1 bg-primary" />
            <div className="rounded-1 bg-success" />
            <div className="rounded-1 bg-warning" />
            <div className="rounded-1 bg-info" />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.66rem" }}
          >
            2 Sütunlu Uygulama Kutuları
          </div>
        </div>
      )}

      {styleId === "tree" && (
        <div className="d-flex w-100 gap-1">
          <div
            className="rounded-1 bg-white border d-flex flex-column justify-content-center gap-0.5 px-1"
            style={{ width: "40px", height: "100%" }}
          >
            <div className="rounded-1 bg-primary" style={{ height: "4px", width: "100%" }} />
            <div className="rounded-1 bg-secondary-subtle ms-1.5" style={{ height: "3px", width: "75%" }} />
            <div className="rounded-1 bg-secondary-subtle ms-1.5" style={{ height: "3px", width: "65%" }} />
            <div className="rounded-1 bg-success" style={{ height: "4px", width: "90%" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.66rem" }}
          >
            Çoklu Klasör Ağacı
          </div>
        </div>
      )}

      {styleId === "command" && (
        <div className="d-flex w-100 gap-1">
          <div className="rounded-1 bg-white border d-flex flex-column gap-0.5 p-0.5" style={{ width: "38px", height: "100%" }}>
            <div className="rounded-1 bg-primary-subtle border border-primary-subtle" style={{ height: "8px" }} />
            <div className="rounded-1 bg-secondary-subtle" style={{ height: "5px" }} />
            <div className="rounded-1 bg-secondary-subtle" style={{ height: "5px" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.66rem" }}
          >
            Canlı Arama Odaklı Menü
          </div>
        </div>
      )}

      {styleId === "pillbar" && (
        <div className="d-flex flex-column w-100 gap-1">
          <div className="d-flex w-100 gap-1 align-items-center px-1.5 rounded-pill border bg-white shadow-xs" style={{ height: "13px" }}>
            <div className="rounded-pill bg-success" style={{ width: "18px", height: "6px" }} />
            <div className="rounded-pill bg-primary" style={{ width: "20px", height: "5px" }} />
            <div className="rounded-pill bg-secondary-subtle" style={{ width: "20px", height: "5px" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.65rem" }}
          >
            Yüzen Kapsül Üst Bar
          </div>
        </div>
      )}

      {styleId === "iconbar" && (
        <div className="d-flex flex-column w-100 gap-0.5">
          <div className="d-flex w-100 gap-1 align-items-center px-1" style={{ height: "16px" }}>
            <div className="rounded-1 bg-success" style={{ width: "20px", height: "14px" }} />
            <div className="rounded-1 bg-primary-subtle border" style={{ width: "16px", height: "14px" }} />
            <div className="rounded-1 bg-warning-subtle border" style={{ width: "16px", height: "14px" }} />
            <div className="rounded-1 bg-info-subtle border" style={{ width: "16px", height: "14px" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.64rem" }}
          >
            Büyük İkonlu Üst Bar
          </div>
        </div>
      )}

      {styleId === "centered" && (
        <div className="d-flex flex-column w-100 gap-0.5">
          <div className="d-flex w-100 justify-content-center align-items-center" style={{ height: "10px" }}>
            <div className="rounded-pill bg-success" style={{ width: "36px", height: "8px" }} />
          </div>
          <div className="d-flex w-100 justify-content-center gap-1 border-top pt-0.5" style={{ height: "8px" }}>
            <div className="bg-success" style={{ width: "16px", height: "3px" }} />
            <div className="bg-secondary-subtle" style={{ width: "16px", height: "3px" }} />
            <div className="bg-secondary-subtle" style={{ width: "16px", height: "3px" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.6rem" }}
          >
            Ortalanmış Çift Satır
          </div>
        </div>
      )}

      {styleId === "cmdbar" && (
        <div className="d-flex flex-column w-100 gap-1">
          <div className="d-flex w-100 gap-1 align-items-center" style={{ height: "12px" }}>
            <div className="rounded-1 bg-success" style={{ width: "20px", height: "100%" }} />
            <div className="rounded-pill bg-primary-subtle border border-primary-subtle" style={{ width: "48px", height: "100%" }} />
            <div className="rounded-1 bg-secondary-subtle flex-grow-1" style={{ height: "100%" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-muted"
            style={{ fontSize: "0.65rem" }}
          >
            Header İçi Canlı Arama
          </div>
        </div>
      )}

      {styleId === "fullgrid" && (
        <div className="d-flex flex-column w-100 gap-1">
          <div className="d-flex w-100 gap-1 align-items-center" style={{ height: "12px" }}>
            <div className="rounded-1 bg-success" style={{ width: "20px", height: "100%" }} />
            <div className="rounded-1 bg-primary" style={{ width: "34px", height: "100%" }} />
            <div className="flex-grow-1" />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-primary fw-medium"
            style={{ fontSize: "0.64rem" }}
          >
            Tam Ekran Modül Izgarası
          </div>
        </div>
      )}

      {styleId === "splitbar" && (
        <div className="d-flex flex-column w-100 gap-1">
          <div className="d-flex w-100 gap-1 align-items-center px-1 rounded-1" style={{ height: "12px", backgroundColor: "#047857" }}>
            <div className="rounded-1 bg-warning" style={{ width: "16px", height: "5px" }} />
            <div className="rounded-1 bg-white opacity-75" style={{ width: "16px", height: "5px" }} />
            <div className="rounded-1 bg-white opacity-50" style={{ width: "16px", height: "5px" }} />
          </div>
          <div
            className="flex-grow-1 rounded-1 bg-light border border-dashed d-flex align-items-center justify-content-center text-success fw-medium"
            style={{ fontSize: "0.64rem" }}
          >
            Zümrüt Bar + İkili Panel
          </div>
        </div>
      )}
    </div>
  );
};

export default SidebarStylePreview;

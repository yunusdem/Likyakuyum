import React, { useState, useEffect, useRef } from "react";
import { Modal, Table, Button, Form, InputGroup, Badge } from "react-bootstrap";
import { IconCoins, IconX, IconSearch, IconCheck } from "@tabler/icons-react";

export interface KurListItem {
  id: number;
  kod: string;
  ad: string;
  dovizAlis?: number;
  dovizSatis?: number;
  efektifAlis?: number;
  efektifSatis?: number;
  parite?: number;
}

interface KurListesiModalProps {
  show: boolean;
  onClose: () => void;
  paralar: KurListItem[];
  onSelect: (para: KurListItem) => void;
  kurKurusSayisi?: number;
  tip?: number; // 0: Alış, 1: Satış
  kurTuru?: number; // 0: Efektif, 1: Döviz
}

export const KurListesiModal: React.FC<KurListesiModalProps> = ({
  show,
  onClose,
  paralar,
  onSelect,
  kurKurusSayisi = 6,
  tip = 0,
  kurTuru = 0,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Filtrelenmiş liste
  const filteredParalar = searchTerm.trim()
    ? paralar.filter((p) => {
        const term = searchTerm.toLowerCase().trim();
        return (
          p.kod.toLowerCase().includes(term) ||
          (p.ad && p.ad.toLowerCase().includes(term))
        );
      })
    : paralar;

  // Modal açıldığında arama ve seçimi sıfırla
  useEffect(() => {
    if (show) {
      setSearchTerm("");
      setSelectedIndex(null);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
    }
  }, [show]);

  // Seçili satırı görünümde tut
  useEffect(() => {
    if (show && selectedIndex !== null && rowRefs.current[selectedIndex]) {
      rowRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex, show]);

  // Tek tıkla satır seçimi (Dürbün ikonu LookupModal gibi)
  const handleRowClick = (idx: number) => {
    setSelectedIndex(idx);
  };

  // Çift tıkla doğrudan seçip fişe aktarma ve kapatma
  const handleRowDoubleClick = (para: KurListItem) => {
    onSelect(para);
    onClose();
  };

  // Seçimi onayla (Enter veya butona tık)
  const handleConfirm = () => {
    if (selectedIndex !== null && filteredParalar[selectedIndex]) {
      handleRowDoubleClick(filteredParalar[selectedIndex]);
    } else if (filteredParalar.length > 0) {
      handleRowDoubleClick(filteredParalar[0]);
    }
  };

  // Klavye ok tuşları, Enter ve Escape dinleyicisi
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (prev === null) return 0;
          return prev < filteredParalar.length - 1 ? prev + 1 : prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (prev === null) return 0;
          return prev > 0 ? prev - 1 : 0;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, selectedIndex, filteredParalar, onClose]);

  const formatRate = (val?: number) => {
    if (val === undefined || val === null || val === 0) return "";
    return val.toFixed(kurKurusSayisi);
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      dialogClassName="modal-kur-listesi-dialog"
      contentClassName="p-0 border-0 shadow-2xl rounded-2 overflow-hidden"
    >
      {/* Scoped CSS - Dürbün modalı LookupModal ile birebir aynı açık mavi stil */}
      <style>{`
        .kur-selected-row,
        .kur-selected-row > td,
        .kur-selected-row > th {
          background-color: #bae6fd !important;
          --bs-table-bg: #bae6fd !important;
          --bs-table-accent-bg: #bae6fd !important;
          box-shadow: inset 0 0 0 9999px #bae6fd !important;
          color: #0369a1 !important;
        }
        .kur-selected-row:hover,
        .kur-selected-row:hover > td,
        .kur-selected-row:hover > th {
          background-color: #7dd3fc !important;
          --bs-table-bg: #7dd3fc !important;
          --bs-table-accent-bg: #7dd3fc !important;
          box-shadow: inset 0 0 0 9999px #7dd3fc !important;
        }
      `}</style>

      <div
        className="d-flex flex-column"
        style={{
          border: "1px solid #475569",
          borderRadius: "4px",
          backgroundColor: "#ffffff",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
          width: "100%",
          maxWidth: "920px",
          margin: "0 auto",
        }}
      >
        {/* Başlık Çubuğu */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2"
          style={{
            backgroundColor: "#e2e8f0",
            borderBottom: "1px solid #94a3b8",
            cursor: "default",
            userSelect: "none",
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle"
              style={{ width: "22px", height: "22px", backgroundColor: "#0284c7", color: "#fff" }}
            >
              <IconCoins size={14} />
            </div>
            <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
              Kur Listesi (Gişe Kurları)
            </span>
          </div>

          {/* Sadece Kapatma Butonu (✕) */}
          <div>
            <button
              type="button"
              className="btn btn-sm p-0 d-flex align-items-center justify-content-center border"
              style={{
                width: "24px",
                height: "22px",
                backgroundColor: "#f8fafc",
                borderColor: "#cbd5e1",
                borderRadius: "3px",
              }}
              onClick={onClose}
              title="Kapat (ESC)"
            >
              <IconX size={14} className="text-dark" />
            </button>
          </div>
        </div>

        {/* Hızlı Arama Inputu */}
        <div className="px-3 pt-2 pb-2 bg-white border-bottom">
          <InputGroup size="sm">
            <InputGroup.Text className="bg-white border-end-0">
              <IconSearch size={14} className="text-secondary" />
            </InputGroup.Text>
            <Form.Control
              ref={searchInputRef}
              placeholder="Döviz kodu veya adı ile filtrele (USD, EUR, vb.)..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedIndex(null);
              }}
              className="border-start-0 shadow-none"
              style={{ fontSize: "13px" }}
            />
            {searchTerm && (
              <Button
                variant="outline-secondary"
                className="border-start-0 bg-white"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedIndex(null);
                  searchInputRef.current?.focus();
                }}
              >
                <IconX size={13} />
              </Button>
            )}
          </InputGroup>
        </div>

        {/* İpucu Banner'ı (Dürbün modalındaki gibi) */}
        <div className="d-flex align-items-center justify-content-between px-3 py-1.5 bg-light text-muted small border-bottom">
          <span>
            💡 <strong>İpucu:</strong> Satıra tek tıklayarak seçebilir, çift tıklayarak doğrudan forma aktarabilirsiniz.
          </span>
          {selectedIndex !== null && filteredParalar[selectedIndex] && (
            <Badge bg="primary" className="py-1 px-2 d-flex align-items-center gap-1" style={{ backgroundColor: "#0284c7" }}>
              <IconCheck size={12} />
              {filteredParalar[selectedIndex].kod} seçildi
            </Badge>
          )}
        </div>

        {/* Tablo Alanı */}
        <div
          className="p-0"
          style={{
            maxHeight: "460px",
            minHeight: "340px",
            overflowY: "auto",
            backgroundColor: "#ffffff",
          }}
        >
          <Table
            bordered
            hover
            size="sm"
            className="mb-0 text-nowrap align-middle"
            style={{ fontSize: "13px", borderCollapse: "separate", borderSpacing: 0 }}
          >
            <thead
              className="position-sticky top-0"
              style={{
                zIndex: 10,
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              <tr style={{ backgroundColor: "#cde4f7", color: "#0f172a" }}>
                <th
                  style={{
                    width: "85px",
                    padding: "8px 10px",
                    borderRight: "1px solid #94a3b8",
                    borderBottom: "1px solid #94a3b8",
                    backgroundColor: "#cde4f7",
                  }}
                >
                  Kod
                </th>
                <th
                  style={{
                    width: "220px",
                    padding: "8px 10px",
                    borderRight: "1px solid #94a3b8",
                    borderBottom: "1px solid #94a3b8",
                    backgroundColor: "#cde4f7",
                  }}
                >
                  Ad
                </th>
                {/* Döviz Alış */}
                <th
                  className={`text-end ${kurTuru === 1 && tip === 0 ? "fw-bold" : ""}`}
                  style={{
                    width: "135px",
                    padding: "8px 10px",
                    borderRight: "1px solid #94a3b8",
                    borderBottom: "1px solid #94a3b8",
                    backgroundColor: kurTuru === 1 && tip === 0 ? "#bae6fd" : "#cde4f7",
                    color: kurTuru === 1 && tip === 0 ? "#0369a1" : "#0f172a",
                  }}
                >
                  Döviz alış {kurTuru === 1 && tip === 0 ? "✓" : ""}
                </th>
                {/* Döviz Satış */}
                <th
                  className={`text-end ${kurTuru === 1 && tip === 1 ? "fw-bold" : ""}`}
                  style={{
                    width: "135px",
                    padding: "8px 10px",
                    borderRight: "1px solid #94a3b8",
                    borderBottom: "1px solid #94a3b8",
                    backgroundColor: kurTuru === 1 && tip === 1 ? "#bae6fd" : "#cde4f7",
                    color: kurTuru === 1 && tip === 1 ? "#0369a1" : "#0f172a",
                  }}
                >
                  Döviz satış {kurTuru === 1 && tip === 1 ? "✓" : ""}
                </th>
                {/* Efektif Alış Kolonu */}
                <th
                  className="text-end fw-bold"
                  style={{
                    width: "145px",
                    padding: "8px 10px",
                    borderRight: "1px solid #60a5fa",
                    borderBottom: "1px solid #60a5fa",
                    backgroundColor: kurTuru === 0 && tip === 0 ? "#0284c7" : "#93c5fd",
                    color: kurTuru === 0 && tip === 0 ? "#ffffff" : "#0f172a",
                  }}
                >
                  Efektif alış {kurTuru === 0 && tip === 0 ? "✓ (Aktif)" : ""}
                </th>
                {/* Efektif Satış Kolonu */}
                <th
                  className="text-end fw-bold"
                  style={{
                    width: "145px",
                    padding: "8px 10px",
                    borderBottom: "1px solid #60a5fa",
                    backgroundColor: kurTuru === 0 && tip === 1 ? "#0284c7" : "#93c5fd",
                    color: kurTuru === 0 && tip === 1 ? "#ffffff" : "#0f172a",
                  }}
                >
                  Efektif satış {kurTuru === 0 && tip === 1 ? "✓ (Aktif)" : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredParalar.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5 text-muted">
                    Uygun kur kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredParalar.map((p, idx) => {
                  const isSelected = idx === selectedIndex;
                  const selectedBgColor = "#bae6fd"; // Dürbün modalındaki açık mavi

                  const isEfAlisActive = kurTuru === 0 && tip === 0;
                  const isEfSatisActive = kurTuru === 0 && tip === 1;
                  const isDvzAlisActive = kurTuru === 1 && tip === 0;
                  const isDvzSatisActive = kurTuru === 1 && tip === 1;

                  return (
                    <tr
                      key={p.id || p.kod || idx}
                      ref={(el) => {
                        rowRefs.current[idx] = el;
                      }}
                      onClick={() => handleRowClick(idx)}
                      onDoubleClick={() => handleRowDoubleClick(p)}
                      className={isSelected ? "kur-selected-row table-primary fw-semibold" : ""}
                      style={{
                        cursor: "pointer",
                        userSelect: "none",
                        backgroundColor: isSelected ? selectedBgColor : idx % 2 === 1 ? "#f8fafc" : "#ffffff",
                        boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                      }}
                    >
                      {/* Kod */}
                      <td
                        className="fw-bold font-monospace px-3 py-1.5"
                        style={{
                          backgroundColor: isSelected ? selectedBgColor : undefined,
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                          color: isSelected ? "#0369a1" : undefined,
                          borderRight: "1px solid #cbd5e1",
                          borderBottom: "1px solid #cbd5e1",
                        }}
                      >
                        {p.kod}
                      </td>

                      {/* Ad */}
                      <td
                        className="text-truncate px-3 py-1.5"
                        style={{
                          maxWidth: "220px",
                          backgroundColor: isSelected ? selectedBgColor : undefined,
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                          color: isSelected ? "#0c4a6e" : undefined,
                          borderRight: "1px solid #cbd5e1",
                          borderBottom: "1px solid #cbd5e1",
                        }}
                      >
                        {p.ad}
                      </td>

                      {/* Döviz Alış */}
                      <td
                        className={`text-end font-monospace px-3 py-1.5 ${isDvzAlisActive ? "fw-bold" : ""}`}
                        style={{
                          backgroundColor: isSelected ? selectedBgColor : isDvzAlisActive ? "#e0f2fe" : undefined,
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                          color: isDvzAlisActive ? "#0369a1" : undefined,
                          borderRight: "1px solid #cbd5e1",
                          borderBottom: "1px solid #cbd5e1",
                        }}
                      >
                        {formatRate(p.dovizAlis)}
                      </td>

                      {/* Döviz Satış */}
                      <td
                        className={`text-end font-monospace px-3 py-1.5 ${isDvzSatisActive ? "fw-bold" : ""}`}
                        style={{
                          backgroundColor: isSelected ? selectedBgColor : isDvzSatisActive ? "#e0f2fe" : undefined,
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                          color: isDvzSatisActive ? "#0369a1" : undefined,
                          borderRight: "1px solid #cbd5e1",
                          borderBottom: "1px solid #cbd5e1",
                        }}
                      >
                        {formatRate(p.dovizSatis)}
                      </td>

                      {/* Efektif Alış Hücresi */}
                      <td
                        className={`text-end font-monospace px-3 py-1.5 ${isEfAlisActive ? "fw-bold" : "fw-semibold"}`}
                        style={{
                          backgroundColor: isSelected ? selectedBgColor : isEfAlisActive ? "#dbeafe" : "#eff6ff",
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                          color: isEfAlisActive ? "#1d4ed8" : "#0369a1",
                          borderRight: "1px solid #cbd5e1",
                          borderBottom: "1px solid #cbd5e1",
                        }}
                      >
                        {formatRate(p.efektifAlis)}
                      </td>

                      {/* Efektif Satış Hücresi */}
                      <td
                        className={`text-end font-monospace px-3 py-1.5 ${isEfSatisActive ? "fw-bold" : "fw-semibold"}`}
                        style={{
                          backgroundColor: isSelected ? selectedBgColor : isEfSatisActive ? "#dbeafe" : "#eff6ff",
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                          color: isEfSatisActive ? "#1d4ed8" : "#0369a1",
                          borderBottom: "1px solid #cbd5e1",
                        }}
                      >
                        {formatRate(p.efektifSatis)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        {/* Alt Bilgi ve Buton Çubuğu (LookupModal stili) */}
        <div
          className="d-flex justify-content-between align-items-center px-3 py-2 bg-light border-top"
          style={{ fontSize: "12.5px" }}
        >
          <span className="text-muted">
            Toplam: <b>{filteredParalar.length}</b> kayıt
          </span>
          <div className="d-flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              style={{ minWidth: "75px" }}
            >
              Kapat (ESC)
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={selectedIndex === null || !filteredParalar[selectedIndex]}
              onClick={handleConfirm}
              style={{
                minWidth: "110px",
                backgroundColor: "#0284c7",
                borderColor: "#0284c7",
              }}
            >
              Seçimi Onayla
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default KurListesiModal;

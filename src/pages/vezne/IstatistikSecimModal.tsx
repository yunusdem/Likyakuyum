import React, { useState, useEffect, useRef, useMemo } from "react";
import { Modal, Table, Button, Form, InputGroup, Badge, Spinner } from "react-bootstrap";
import { IconChartBar, IconX, IconSearch, IconCheck, IconCornerDownLeft } from "@tabler/icons-react";
import { DovizFisService, IstatistikSecimItem } from "../../services/dovizFisService";
import { StatisticService } from "../../services/statisticService";

interface IstatistikSecimModalProps {
  show: boolean;
  onClose: () => void;
  tip: number; // 0: Alış, 1: Satış
  onSelect: (item: IstatistikSecimItem) => void;
  currentKod?: string;
}

export const IstatistikSecimModal: React.FC<IstatistikSecimModalProps> = ({
  show,
  onClose,
  tip,
  onSelect,
  currentKod,
}) => {
  const [items, setItems] = useState<IstatistikSecimItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Verileri yükle
  useEffect(() => {
    if (!show) return;

    let isMounted = true;
    setLoading(true);
    setSearchTerm("");
    setSelectedIndex(null);

    const loadData = async () => {
      try {
        // Öncelikli olarak /api/v1/doviz-fis/istatistikler?tip={tip} endpoint'inden al
        const data = await DovizFisService.getIstatistikler(tip);
        if (isMounted) {
          if (data && data.length > 0) {
            setItems(data);
          } else {
            // Yedek olarak StatisticService'den filtreleyerek al
            const allStats = await StatisticService.getStatistics();
            const fallbackFiltered = allStats
              .filter((s) => s.fisTipi === tip)
              .map((s) => ({
                id: s.id,
                kod: (s.kod || "").trim(),
                ad: (s.aciklama || "").trim(),
                aciklama: (s.aciklama || "").trim(),
                tip: s.fisTipi,
                fisTipi: s.fisTipi,
                fisDizaynTipi: s.fisDizaynTipi,
                ciktiSatirSayisi: s.ciktiSatirSayisi,
              }));
            setItems(fallbackFiltered);
          }
        }
      } catch (err) {
        console.error("İstatistikler yüklenirken hata:", err);
        if (isMounted) {
          try {
            const allStats = await StatisticService.getStatistics();
            const fallbackFiltered = allStats
              .filter((s) => s.fisTipi === tip)
              .map((s) => ({
                id: s.id,
                kod: (s.kod || "").trim(),
                ad: (s.aciklama || "").trim(),
                aciklama: (s.aciklama || "").trim(),
                tip: s.fisTipi,
                fisTipi: s.fisTipi,
                fisDizaynTipi: s.fisDizaynTipi,
                ciktiSatirSayisi: s.ciktiSatirSayisi,
              }));
            setItems(fallbackFiltered);
          } catch {
            setItems([]);
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setTimeout(() => {
            searchInputRef.current?.focus();
          }, 100);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [show, tip]);

  // Arama filtrelemesi
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase().trim();
    return items.filter((item) => {
      const kodMatch = item.kod?.toLowerCase().includes(term);
      const adMatch = (item.ad || item.aciklama || "").toLowerCase().includes(term);
      return kodMatch || adMatch;
    });
  }, [items, searchTerm]);

  // İlk açılışta veya liste değiştiğinde mevcut koda göre veya ilk satırı seç
  useEffect(() => {
    if (!show || loading || filteredItems.length === 0) {
      if (filteredItems.length === 0) setSelectedIndex(null);
      return;
    }

    if (currentKod) {
      const foundIdx = filteredItems.findIndex(
        (i) => i.kod.trim().toLowerCase() === currentKod.trim().toLowerCase()
      );
      if (foundIdx >= 0) {
        setSelectedIndex(foundIdx);
        return;
      }
    }

    // Default olarak ilk satırı seçili yap
    setSelectedIndex((prev) => {
      if (prev !== null && prev < filteredItems.length) return prev;
      return 0;
    });
  }, [show, loading, filteredItems, currentKod]);

  // Seçili satırı görünümde tut
  useEffect(() => {
    if (show && selectedIndex !== null && rowRefs.current[selectedIndex]) {
      rowRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex, show]);

  // Tek tık satır seçimi
  const handleRowClick = (idx: number) => {
    setSelectedIndex(idx);
  };

  // Çift tık seçip onaylama
  const handleRowDoubleClick = (item: IstatistikSecimItem) => {
    onSelect(item);
    onClose();
  };

  // Onaylama (Enter tuşu veya Seç butonu)
  const handleConfirm = () => {
    if (selectedIndex !== null && filteredItems[selectedIndex]) {
      handleRowDoubleClick(filteredItems[selectedIndex]);
    } else if (filteredItems.length > 0) {
      handleRowDoubleClick(filteredItems[0]);
    }
  };

  // Klavye navigasyonu (Yukarı/Aşağı, Enter, ESC)
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          if (prev === null) return 0;
          return prev < filteredItems.length - 1 ? prev + 1 : prev;
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
  }, [show, selectedIndex, filteredItems, onClose]);

  const tipLabel = tip === 0 ? "Alış İstatistikleri" : "Satış İstatistikleri";

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      dialogClassName="modal-istatistik-secim-dialog"
      contentClassName="p-0 border-0 shadow-2xl rounded-2 overflow-hidden"
    >
      {/* Özel Vurgulama CSS - Diğer modallarla ve ERP standardıyla uyumlu */}
      <style>{`
        .istatistik-selected-row,
        .istatistik-selected-row > td,
        .istatistik-selected-row > th {
          background-color: #bae6fd !important;
          --bs-table-bg: #bae6fd !important;
          --bs-table-accent-bg: #bae6fd !important;
          box-shadow: inset 0 0 0 9999px #bae6fd !important;
          color: #0369a1 !important;
        }
        .istatistik-selected-row:hover,
        .istatistik-selected-row:hover > td,
        .istatistik-selected-row:hover > th {
          background-color: #7dd3fc !important;
          --bs-table-bg: #7dd3fc !important;
          --bs-table-accent-bg: #7dd3fc !important;
          box-shadow: inset 0 0 0 9999px #7dd3fc !important;
        }
        .istatistik-row {
          cursor: pointer;
          user-select: none;
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
          maxWidth: "750px",
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
              style={{
                width: "22px",
                height: "22px",
                backgroundColor: tip === 0 ? "#0284c7" : "#d97706",
                color: "#fff",
              }}
            >
              <IconChartBar size={14} />
            </div>
            <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
              F3) İstatistik Kodu Seçimi
            </span>
            <Badge
              bg={tip === 0 ? "info" : "warning"}
              text={tip === 0 ? "white" : "dark"}
              className="ms-1 px-2 py-1"
              style={{ fontSize: "11px", fontWeight: 600 }}
            >
              {tipLabel} (Tip: {tip})
            </Badge>
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
              placeholder="İstatistik kodu veya tanımı ile filtrele (örn: 9249, 10285, ALIŞ)..."
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

        {/* Bilgilendirme ve Seçim İpucu */}
        <div className="d-flex align-items-center justify-content-between px-3 py-1.5 bg-light text-muted small border-bottom">
          <span>
            💡 <strong>İpucu:</strong> Yön tuşlarıyla gezinip <strong>Enter</strong> veya <strong>çift tıklama</strong> ile seçebilirsiniz.
          </span>
          {selectedIndex !== null && filteredItems[selectedIndex] && (
            <Badge
              bg="primary"
              className="py-1 px-2 d-flex align-items-center gap-1"
              style={{ backgroundColor: "#0284c7" }}
            >
              <IconCheck size={12} />
              {filteredItems[selectedIndex].kod} seçildi
            </Badge>
          )}
        </div>

        {/* Tablo Alanı */}
        <div
          style={{
            maxHeight: "380px",
            minHeight: "220px",
            overflowY: "auto",
            backgroundColor: "#f8fafc",
          }}
        >
          {loading ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
              <Spinner animation="border" size="sm" className="mb-2 text-primary" />
              <span style={{ fontSize: "13px" }}>İstatistikler yükleniyor...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p className="mb-1 fw-semibold" style={{ fontSize: "13.5px" }}>
                Kayıt bulunamadı
              </p>
              <p className="small mb-0" style={{ fontSize: "12px" }}>
                {searchTerm
                  ? `"${searchTerm}" aramasına uygun ${tipLabel.toLowerCase()} bulunamadı.`
                  : `Tanımlı ${tipLabel.toLowerCase()} kaydı yok.`}
              </p>
            </div>
          ) : (
            <Table bordered hover size="sm" className="mb-0 bg-white" style={{ fontSize: "12.5px" }}>
              <thead
                className="sticky-top"
                style={{
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
                  borderBottom: "2px solid #cbd5e1",
                  zIndex: 2,
                }}
              >
                <tr>
                  <th style={{ width: "130px", textAlign: "left" }} className="px-3 py-2">
                    İstatistik Kodu
                  </th>
                  <th style={{ textAlign: "left" }} className="px-3 py-2">
                    Tanım / İstatistik Adı
                  </th>
                  <th style={{ width: "120px", textAlign: "center" }} className="px-3 py-2">
                    Fiş Dizayn Tipi
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, idx) => {
                  const isSelected = selectedIndex === idx;
                  const ad = item.ad || item.aciklama || "-";

                  return (
                    <tr
                      key={item.id || idx}
                      ref={(el) => {
                        rowRefs.current[idx] = el;
                      }}
                      className={`istatistik-row ${isSelected ? "istatistik-selected-row" : ""}`}
                      onClick={() => handleRowClick(idx)}
                      onDoubleClick={() => handleRowDoubleClick(item)}
                    >
                      {/* İstatistik Kodu */}
                      <td className="px-3 py-2 font-monospace fw-bold text-start align-middle">
                        {item.kod}
                      </td>

                      {/* Tanım / İstatistik Adı */}
                      <td className="px-3 py-2 text-start align-middle">
                        <span className="fw-medium">{ad}</span>
                      </td>

                      {/* Fiş Dizayn Tipi */}
                      <td className="px-3 py-2 text-center align-middle">
                        {item.fisDizaynTipi !== undefined && item.fisDizaynTipi !== null ? (
                          <span
                            className="badge bg-secondary-subtle text-secondary border px-2 py-0.5"
                            style={{ fontSize: "11px" }}
                          >
                            Tip {item.fisDizaynTipi}
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>

        {/* Alt Bilgi ve Aksiyon Çubuğu */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2 bg-light border-top"
          style={{ fontSize: "12.5px" }}
        >
          <div className="text-muted">
            Toplam: <strong>{filteredItems.length}</strong> kayıt{" "}
            {searchTerm && `(${items.length} kayıttan filtrelendi)`}
          </div>

          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={onClose}
              className="px-3 py-1"
              style={{ fontSize: "12px", height: "30px" }}
            >
              Vazgeç (ESC)
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={selectedIndex === null || !filteredItems[selectedIndex]}
              className="px-3 py-1 d-flex align-items-center gap-1"
              style={{
                fontSize: "12px",
                height: "30px",
                backgroundColor: "#0284c7",
                borderColor: "#0284c7",
              }}
            >
              <IconCornerDownLeft size={14} />
              <span>Seç (Enter)</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

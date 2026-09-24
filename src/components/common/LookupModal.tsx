import React, { useState, useEffect, useRef, useMemo } from "react";
import { Modal, Form, InputGroup, Table, Button, Spinner, Badge } from "react-bootstrap";
import { IconSearch, IconBinoculars, IconX, IconCheck } from "@tabler/icons-react";

export interface LookupColumn<T> {
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render: (item: T) => React.ReactNode;
}

export interface LookupModalProps<T> {
  show: boolean;
  onHide: () => void;
  title: string;
  items: T[];
  isLoading?: boolean;
  searchPlaceholder?: string;
  initialSearchTerm?: string;
  selectedId?: any;
  columns: LookupColumn<T>[];
  filterFn: (item: T, term: string) => boolean;
  onSelect: (item: T) => void;
}

export function LookupModal<T extends Record<string, any>>({
  show,
  onHide,
  title,
  items = [],
  isLoading = false,
  searchPlaceholder = "Arama yapın...",
  initialSearchTerm = "",
  selectedId,
  columns,
  filterFn,
  onSelect,
}: LookupModalProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const getItemId = (it: any): string => {
    if (!it) return "";
    if (it.sarrafFisiId !== undefined && it.sarrafFisiId !== null) return `sarraf-${it.sarrafFisiId}`;
    if (it.altinUrunId !== undefined && it.altinUrunId !== null) return `altin-${it.altinUrunId}`;
    if (it.ozelUrunId !== undefined && it.ozelUrunId !== null) return `ozel-${it.ozelUrunId}`;
    if (it.iskontoId !== undefined && it.iskontoId !== null) return `iskonto-${it.iskontoId}`;
    if (it.hesapHareketiId !== undefined && it.hesapHareketiId !== null) return `hareket-${it.hesapHareketiId}`;
    if (it.hesapId !== undefined && it.hesapId !== null) return `hesap-${it.hesapId}`;
    if (it.fisId !== undefined && it.fisId !== null) return `fis-${it.fisId}`;
    if (it.cariKartId !== undefined && it.cariKartId !== null) return `cari-${it.cariKartId}`;
    if (it.vezneId !== undefined && it.vezneId !== null) return `vezne-${it.vezneId}`;
    if (it.panoId !== undefined && it.panoId !== null) return `pano-${it.panoId}`;
    if (it.sayimFisiId !== undefined && it.sayimFisiId !== null) return `sayim-${it.sayimFisiId}`;
    if (it.bankoKodu !== undefined && it.bankoKodu !== null) return `banko-${it.bankoKodu}`;
    if (it.grupKodu !== undefined && it.grupKodu !== null) return `grup-${it.grupKodu}`;
    if (it.barkod !== undefined && it.barkod !== null) return `bar-${it.barkod}`;
    if (it.fisNo !== undefined && it.fisNo !== null) return `fisno-${it.fisNo}`;
    if (it.id !== undefined && it.id !== null) return `id-${it.id}`;
    if (it.ID !== undefined && it.ID !== null) return `ID-${it.ID}`;
    if (it.kod !== undefined && it.kod !== null) return `kod-${it.kod}`;
    if (it.code !== undefined && it.code !== null) return `code-${it.code}`;
    return "";
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    return items.filter((item) => filterFn(item, searchTerm.trim()));
  }, [items, searchTerm, filterFn]);

  const prevShowRef = useRef(false);

  // Reset search term and pre-select item matching selectedId only once when modal opens
  useEffect(() => {
    if (show && !prevShowRef.current) {
      const term = initialSearchTerm || "";
      setSearchTerm(term);

      const activeList = term.trim() ? items.filter((item) => filterFn(item, term.trim())) : items;
      if (selectedId !== undefined && selectedId !== null && activeList && activeList.length > 0) {
        const foundIdx = activeList.findIndex((it: any) => {
          if (it.sarrafFisiId !== undefined && (it.sarrafFisiId === selectedId || String(it.sarrafFisiId) === String(selectedId))) return true;
          if (it.id !== undefined && (it.id === selectedId || String(it.id) === String(selectedId))) return true;
          if (it.hesapId !== undefined && (it.hesapId === selectedId || String(it.hesapId) === String(selectedId))) return true;
          if (it.iskontoId !== undefined && (it.iskontoId === selectedId || String(it.iskontoId) === String(selectedId))) return true;
          if (it.kod !== undefined && String(it.kod) === String(selectedId)) return true;
          if (it.code !== undefined && String(it.code) === String(selectedId)) return true;
          if (it.ID !== undefined && (it.ID === selectedId || String(it.ID) === String(selectedId))) return true;
          return false;
        });
        setSelectedIndex(foundIdx >= 0 ? foundIdx : 0);
      } else {
        setSelectedIndex(0);
      }

      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          if (term) {
            searchInputRef.current.select();
          }
        }
      }, 60);
    }
    prevShowRef.current = show;
  }, [show, selectedId, initialSearchTerm, items, filterFn]);

  // Scroll selected row into view automatically (using auto to avoid jumping animation)
  useEffect(() => {
    if (show && rowRefs.current[selectedIndex]) {
      rowRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [selectedIndex, show]);

  // Single click: Select row (highlight blue), do not close modal
  const handleRowClick = (index: number) => {
    setSelectedIndex(index);
  };

  // Double click: Confirm selection, populate form fields and close modal
  const handleRowDoubleClick = (item: T) => {
    onSelect(item);
    onHide();
  };

  // Click on "Seç" button: immediately confirms selection, populates form fields and closes modal
  const handleSecButtonClick = (e: React.MouseEvent, item: T) => {
    e.stopPropagation();
    onSelect(item);
    onHide();
  };

  // Confirm currently selected item
  const handleConfirm = () => {
    if (filteredItems.length > 0 && selectedIndex >= 0 && selectedIndex < filteredItems.length) {
      onSelect(filteredItems[selectedIndex]);
      onHide();
    } else if (filteredItems.length > 0) {
      onSelect(filteredItems[0]);
      onHide();
    }
  };

  // Keyboard navigation handler (ArrowUp, ArrowDown, Enter, Escape)
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => {
          if (filteredItems.length === 0) return 0;
          return prev < filteredItems.length - 1 ? prev + 1 : prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => {
          if (filteredItems.length === 0) return 0;
          return prev > 0 ? prev - 1 : 0;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onHide();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, selectedIndex, filteredItems, onHide]);

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      backdrop="static"
      keyboard={false}
      onEntered={() => {
        // Safe focus after modal animation completes to avoid focus-trap flicker
        searchInputRef.current?.focus();
      }}
    >
      <Modal.Header closeButton className="py-2.5 bg-light">
        <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
          <IconBinoculars size={20} className="text-primary" />
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        {/* Search Input Bar */}
        <InputGroup className="mb-3">
          <InputGroup.Text className="bg-white border-end-0">
            <IconSearch size={16} className="text-secondary" />
          </InputGroup.Text>
          <Form.Control
            ref={searchInputRef}
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setSelectedIndex(0);
            }}
            className="border-start-0"
          />
          {searchTerm && (
            <Button
              variant="outline-secondary"
              className="border-start-0 bg-white"
              onClick={() => {
                setSearchTerm("");
                setSelectedIndex(0);
                searchInputRef.current?.focus();
              }}
            >
              <IconX size={14} />
            </Button>
          )}
        </InputGroup>

        {/* Info Banner */}
        <div className="d-flex align-items-center justify-content-between mb-2 px-1 text-muted small">
          <span>
            💡 <strong>İpucu:</strong> Satıra çift tıklayarak, <strong>Enter</strong> basarak veya <strong>Seç</strong> butonuyla doğrudan forma aktarabilirsiniz. (Yukarı/Aşağı tuşları ile gezinebilirsiniz)
          </span>
          {filteredItems.length > 0 && selectedIndex >= 0 && selectedIndex < filteredItems.length && (
            <Badge bg="primary" className="py-1 px-2">
              1 satır seçildi
            </Badge>
          )}
        </div>

        {/* Scoped selection style to override Bootstrap table inset shadow and hover */}
        <style>{`
          .lookup-table tbody tr.lookup-selected-row,
          .lookup-table tbody tr.lookup-selected-row > td,
          .lookup-table tbody tr.lookup-selected-row > th,
          .lookup-table tbody tr.lookup-selected-row:hover,
          .lookup-table tbody tr.lookup-selected-row:hover > td,
          .lookup-table tbody tr.lookup-selected-row:hover > th {
            background-color: #bae6fd !important;
            --bs-table-bg: #bae6fd !important;
            --bs-table-accent-bg: #bae6fd !important;
            box-shadow: inset 0 0 0 9999px #bae6fd !important;
            color: #0c4a6e !important;
          }
          .lookup-table tbody tr:not(.lookup-selected-row):hover > td,
          .lookup-table tbody tr:not(.lookup-selected-row):hover > th {
            background-color: #f1f5f9 !important;
            --bs-table-bg: #f1f5f9 !important;
            --bs-table-accent-bg: #f1f5f9 !important;
          }
        `}</style>

        {/* Table Content */}
        <div style={{ maxHeight: "380px", overflowY: "auto" }} className="border rounded">
          {isLoading ? (
            <div className="p-4 text-center text-muted">
              <Spinner animation="border" size="sm" className="me-2" />
              Yükleniyor...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-4 text-center text-muted">
              {items.length === 0 ? "Kayıtlı veri bulunamadı." : "Arama kriterine uygun kayıt bulunamadı."}
            </div>
          ) : (
            <Table responsive size="sm" className="mb-0 align-middle lookup-table">
              <thead className="table-light sticky-top" style={{ top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ width: "40px" }} className="text-center">#</th>
                  {columns.map((col, idx) => (
                    <th
                      key={idx}
                      style={col.width ? { width: col.width } : undefined}
                      className={col.align === "center" ? "text-center" : col.align === "right" ? "text-end" : "text-start"}
                    >
                      {col.header}
                    </th>
                  ))}
                  <th style={{ width: "70px" }} className="text-center">Seçim</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => {
                  const itemId = getItemId(item);
                  const isSelected = index === selectedIndex;

                  return (
                    <tr
                      key={`lookup-row-${index}-${itemId || "item"}`}
                      ref={(el) => { rowRefs.current[index] = el; }}
                      onClick={() => handleRowClick(index)}
                      onDoubleClick={() => handleRowDoubleClick(item)}
                      className={isSelected ? "lookup-selected-row fw-semibold" : ""}
                      style={{
                        cursor: "pointer",
                      }}
                    >
                      <td
                        className="text-center small"
                        style={{
                          color: isSelected ? "#0369a1" : "#64748b",
                        }}
                      >
                        {isSelected ? <IconCheck size={16} className="text-primary fw-bold" /> : index + 1}
                      </td>
                      {columns.map((col, colIdx) => (
                        <td
                          key={colIdx}
                          className={col.align === "center" ? "text-center" : col.align === "right" ? "text-end" : "text-start"}
                          style={{
                            color: isSelected ? "#0c4a6e" : undefined,
                          }}
                        >
                          {col.render(item)}
                        </td>
                      ))}
                      <td className="text-center">
                        <Button
                          size="sm"
                          variant={isSelected ? "primary" : "outline-secondary"}
                          className={`py-0 px-2 fs-7 ${isSelected ? "fw-bold shadow-sm" : ""}`}
                          onClick={(e) => handleSecButtonClick(e, item)}
                          title="Bu kaydı seç ve aktar"
                        >
                          Seç
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer className="py-2 bg-light d-flex justify-content-between align-items-center">
        <span className="small text-muted">
          Toplam: {filteredItems.length} kayıt
        </span>
        <div className="d-flex gap-2">
          <Button variant="secondary" size="sm" onClick={onHide}>
            Kapat
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={selectedIndex === null || !filteredItems[selectedIndex]}
            onClick={handleConfirm}
          >
            Seçimi Onayla
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

export default LookupModal;

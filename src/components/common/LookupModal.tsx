import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Modal, Form, InputGroup, Table, Button, Spinner, Badge } from "react-bootstrap";
import { IconSearch, IconBinoculars, IconX, IconCheck, IconPlus } from "@tabler/icons-react";
import { highlightText } from "./HighlightText";

export interface LookupColumn<T> {
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render: (item: T) => React.ReactNode;
  highlight?: boolean;
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
  onAddNew?: () => void;
  addNewLabel?: string;
  isItemDisabled?: (item: T) => boolean;
  renderDetail?: (item: T) => React.ReactNode;
  searchByCodeOnly?: boolean;
}

const MAX_DISPLAY_COUNT = 150;

function LookupModalContent<T extends Record<string, any>>({
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
  onAddNew,
  addNewLabel = "Yeni Kayıt",
  isItemDisabled,
  renderDetail,
  searchByCodeOnly = false,
}: LookupModalProps<T>) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm || "");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  useEffect(() => {
    if (show) {
      setSearchTerm(initialSearchTerm || "");
    }
  }, [show, initialSearchTerm]);

  const getItemId = useCallback((it: any): string => {
    if (!it) return "";
    if (it.posCihaziId !== undefined && it.posCihaziId !== null) return `pos-${it.posCihaziId}`;
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
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    return items.filter((item) => filterFn(item, searchTerm.trim()));
  }, [items, searchTerm, filterFn]);

  const displayItems = useMemo(() => {
    return filteredItems.slice(0, MAX_DISPLAY_COUNT);
  }, [filteredItems]);

  // Initial selection and focus on modal open
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    if (!show) {
      isFirstMountRef.current = true;
      return;
    }

    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      if (selectedId !== undefined && selectedId !== null && selectedId !== "" && filteredItems.length > 0) {
        const foundIdx = filteredItems.findIndex((it: any) => {
          if (it.posCihaziId !== undefined && (it.posCihaziId === selectedId || String(it.posCihaziId) === String(selectedId))) return true;
          if (it.sarrafFisiId !== undefined && (it.sarrafFisiId === selectedId || String(it.sarrafFisiId) === String(selectedId))) return true;
          if (it.id !== undefined && (it.id === selectedId || String(it.id) === String(selectedId))) return true;
          if (it.hesapId !== undefined && (it.hesapId === selectedId || String(it.hesapId) === String(selectedId))) return true;
          if (it.iskontoId !== undefined && (it.iskontoId === selectedId || String(it.iskontoId) === String(selectedId))) return true;
          if (it.kod !== undefined && (String(it.kod).trim().toLowerCase() === String(selectedId).trim().toLowerCase())) return true;
          if (it.code !== undefined && (String(it.code).trim().toLowerCase() === String(selectedId).trim().toLowerCase())) return true;
          if (it.ID !== undefined && (it.ID === selectedId || String(it.ID) === String(selectedId))) return true;
          return false;
        });
        setSelectedIndex(foundIdx >= 0 && foundIdx < MAX_DISPLAY_COUNT ? foundIdx : 0);
      } else {
        setSelectedIndex(0);
      }

      const t = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          if (searchTerm) {
            searchInputRef.current.select();
          }
        }
      }, 40);

      return () => clearTimeout(t);
    }
  }, [show, selectedId, filteredItems, searchTerm]);

  // Scroll selected row into view
  useEffect(() => {
    if (rowRefs.current[selectedIndex]) {
      rowRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [selectedIndex]);

  // Single click: Select row (and confirm if no renderDetail)
  const handleRowClick = (index: number, item: T) => {
    setSelectedIndex(index);
    if (!renderDetail) {
      if (isItemDisabled?.(item)) return;
      onSelect(item);
      onHide();
    }
  };

  // Double click: Confirm selection
  const handleRowDoubleClick = (item: T) => {
    if (isItemDisabled?.(item)) return;
    onSelect(item);
    onHide();
  };

  // Click on "Seç" button
  const handleSecButtonClick = (e: React.MouseEvent, item: T) => {
    e.stopPropagation();
    if (isItemDisabled?.(item)) return;
    onSelect(item);
    onHide();
  };

  // Confirm currently selected item
  const handleConfirm = useCallback(() => {
    if (displayItems.length > 0 && selectedIndex >= 0 && selectedIndex < displayItems.length) {
      const selected = displayItems[selectedIndex];
      if (isItemDisabled?.(selected)) return;
      onSelect(selected);
      onHide();
    } else if (displayItems.length > 0) {
      const firstAvailable = displayItems.find((it) => !isItemDisabled?.(it));
      if (firstAvailable) {
        onSelect(firstAvailable);
        onHide();
      }
    }
  }, [displayItems, selectedIndex, isItemDisabled, onSelect, onHide]);

  // Keyboard navigation handler (ArrowUp, ArrowDown, Enter, Escape, F-keys)
  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Herhangi bir F1..F12 tuşuna basıldığında açık modalı kapat ve eylemin üst sayfada işlenmesine izin ver
      if (/^F([1-9]|1[0-2])$/.test(e.key)) {
        onHide();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setSelectedIndex((prev) => {
          if (displayItems.length === 0) return 0;
          return prev < displayItems.length - 1 ? prev + 1 : prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setSelectedIndex((prev) => {
          if (displayItems.length === 0) return 0;
          return prev > 0 ? prev - 1 : 0;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onHide();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, displayItems, handleConfirm, onHide]);

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      backdrop="static"
      keyboard={false}
      enforceFocus={false}
      restoreFocus={false}
      onEntered={() => {
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
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex((prev) => {
                  if (displayItems.length === 0) return 0;
                  return prev < displayItems.length - 1 ? prev + 1 : prev;
                });
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIndex((prev) => {
                  if (displayItems.length === 0) return 0;
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
          {displayItems.length > 0 && selectedIndex >= 0 && selectedIndex < displayItems.length && (
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
          .lookup-table tbody tr:not(.lookup-selected-row):hover,
          .lookup-table tbody tr:not(.lookup-selected-row):hover > td,
          .lookup-table tbody tr:not(.lookup-selected-row):hover > th {
            background-color: #e0f2fe !important;
            --bs-table-bg: #e0f2fe !important;
            --bs-table-accent-bg: #e0f2fe !important;
            --bs-table-hover-bg: #e0f2fe !important;
            box-shadow: inset 0 0 0 9999px #e0f2fe !important;
            color: #0369a1 !important;
          }
        `}</style>

        {/* Table Content */}
        <div style={{ maxHeight: "380px", overflowY: "auto" }} className="border rounded">
          {isLoading ? (
            <div className="p-4 text-center text-muted">
              <Spinner animation="border" size="sm" className="me-2" />
              Yükleniyor...
            </div>
          ) : displayItems.length === 0 ? (
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
                {displayItems.map((item, index) => {
                  const itemId = getItemId(item);
                  const isSelected = index === selectedIndex;
                  const isDisabled = Boolean(isItemDisabled?.(item));

                  return (
                    <tr
                      key={`lookup-row-${index}-${itemId || "item"}`}
                      ref={(el) => { rowRefs.current[index] = el; }}
                      onClick={() => !isDisabled && handleRowClick(index, item)}
                      onDoubleClick={() => !isDisabled && handleRowDoubleClick(item)}
                      className={isSelected && !isDisabled ? "lookup-selected-row fw-semibold" : isDisabled ? "text-muted" : ""}
                      style={{
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.45 : 1,
                        backgroundColor: isDisabled ? "#f8fafc" : undefined,
                      }}
                      title={isDisabled ? "Bu ürün bu tabloda seçilemez" : undefined}
                    >
                      <td
                        className="text-center small"
                        style={{
                          color: isDisabled ? "#94a3b8" : (isSelected ? "#0369a1" : "#64748b"),
                        }}
                      >
                        {isSelected && !isDisabled ? <IconCheck size={16} className="text-primary fw-bold" /> : index + 1}
                      </td>
                      {columns.map((col, colIdx) => {
                        const shouldHighlight = searchByCodeOnly
                          ? (col.highlight === true || (colIdx === 0 && col.highlight !== false))
                          : (col.highlight !== false);
                        return (
                          <td
                            key={colIdx}
                            className={col.align === "center" ? "text-center" : col.align === "right" ? "text-end" : "text-start"}
                            style={{
                              color: isDisabled ? "#94a3b8" : (isSelected ? "#0c4a6e" : undefined),
                            }}
                          >
                            {shouldHighlight ? highlightText(col.render(item), searchTerm) : col.render(item)}
                          </td>
                        );
                      })}
                      <td className="text-center">
                        <Button
                          size="sm"
                          disabled={isDisabled}
                          variant={isDisabled ? "secondary" : (isSelected ? "primary" : "outline-secondary")}
                          className={`py-0 px-2 fs-7 ${isSelected && !isDisabled ? "fw-bold shadow-sm" : ""}`}
                          onClick={(e) => !isDisabled && handleSecButtonClick(e, item)}
                          title={isDisabled ? "Bu ürün bu tabloda seçilemez" : "Bu kaydı seç ve aktar"}
                        >
                          {isDisabled ? "Pasif" : "Seç"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>

        {/* Detay Bölümü (varsa) */}
        {renderDetail && selectedIndex !== null && displayItems[selectedIndex] && (
          <div className="mt-2 p-2 rounded bg-light border" style={{ fontSize: "11.5px" }}>
            {renderDetail(displayItems[selectedIndex])}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="py-2 bg-light d-flex justify-content-between align-items-center">
        <span className="small text-muted">
          Toplam: {filteredItems.length} kayıt {filteredItems.length > MAX_DISPLAY_COUNT && `(İlk ${MAX_DISPLAY_COUNT} listeleniyor)`}
        </span>
        <div className="d-flex gap-2 align-items-center">
          {onAddNew && (
            <Button
              variant="success"
              size="sm"
              onClick={onAddNew}
              className="d-flex align-items-center gap-1 fw-bold text-white shadow-xs"
              style={{
                fontSize: "12px",
                height: "30px",
                backgroundColor: "#16a34a",
                borderColor: "#15803d",
              }}
            >
              <IconPlus size={15} />
              <span>{addNewLabel}</span>
            </Button>
          )}
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={onHide}
            style={{ fontSize: "12px", height: "30px" }}
          >
            Vazgeç (ESC)
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={selectedIndex === null || !displayItems[selectedIndex]}
            onClick={handleConfirm}
            style={{ fontSize: "12px", height: "30px" }}
          >
            Seçimi Onayla
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

export function LookupModal<T extends Record<string, any>>(props: LookupModalProps<T>) {
  if (!props.show) return null;
  return <LookupModalContent {...props} />;
}

export default LookupModal;

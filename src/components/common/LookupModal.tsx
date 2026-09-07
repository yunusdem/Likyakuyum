import React, { useState, useEffect, useRef } from "react";
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
  columns: LookupColumn<T>[];
  filterFn: (item: T, term: string) => boolean;
  onSelect: (item: T) => void;
}

export function LookupModal<T extends { id?: string | number }>({
  show,
  onHide,
  title,
  items = [],
  isLoading = false,
  searchPlaceholder = "Arama yapın...",
  columns,
  filterFn,
  onSelect,
}: LookupModalProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Reset selection and search term whenever modal opens
  useEffect(() => {
    if (show) {
      setSelectedItem(null);
      setSearchTerm("");
    }
  }, [show]);

  const filteredItems = searchTerm.trim()
    ? items.filter((item) => filterFn(item, searchTerm.trim()))
    : items;

  // Single click: Select row only (do NOT populate form or close modal)
  const handleRowClick = (item: T) => {
    setSelectedItem(item);
  };

  // Double click: Confirm selection, populate form fields and close modal
  const handleRowDoubleClick = (item: T) => {
    onSelect(item);
    onHide();
  };

  // Confirm currently selected item
  const handleConfirm = () => {
    if (selectedItem) {
      onSelect(selectedItem);
      onHide();
    } else if (filteredItems.length > 0) {
      // If no explicit single click but user presses confirm, pick first matched item
      onSelect(filteredItems[0]);
      onHide();
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "ArrowDown" && filteredItems.length > 0) {
      e.preventDefault();
      if (!selectedItem) {
        setSelectedItem(filteredItems[0]);
      } else {
        const currIdx = filteredItems.findIndex(
          (it) => (it.id !== undefined ? it.id === selectedItem.id : it === selectedItem)
        );
        if (currIdx < filteredItems.length - 1) {
          setSelectedItem(filteredItems[currIdx + 1]);
        }
      }
    } else if (e.key === "ArrowUp" && filteredItems.length > 0) {
      e.preventDefault();
      if (selectedItem) {
        const currIdx = filteredItems.findIndex(
          (it) => (it.id !== undefined ? it.id === selectedItem.id : it === selectedItem)
        );
        if (currIdx > 0) {
          setSelectedItem(filteredItems[currIdx - 1]);
        }
      }
    }
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      centered
      backdrop="static"
      keyboard={true}
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
        {/* Search Input */}
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
              setSelectedItem(null);
            }}
            onKeyDown={handleSearchKeyDown}
            className="border-start-0"
          />
          {searchTerm && (
            <Button
              variant="outline-secondary"
              className="border-start-0 bg-white"
              onClick={() => {
                setSearchTerm("");
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
            💡 <strong>İpucu:</strong> Satıra tek tıklayarak seçebilir, çift tıklayarak doğrudan forma aktarabilirsiniz.
          </span>
          {selectedItem && (
            <Badge bg="primary" className="py-1 px-2">
              1 satır seçildi
            </Badge>
          )}
        </div>

        {/* Scoped selection style to override Bootstrap table inset shadow */}
        <style>{`
          .lookup-selected-row,
          .lookup-selected-row > td,
          .lookup-selected-row > th {
            background-color: #bae6fd !important;
            --bs-table-bg: #bae6fd !important;
            --bs-table-accent-bg: #bae6fd !important;
            box-shadow: inset 0 0 0 9999px #bae6fd !important;
            color: #0369a1 !important;
          }
          .lookup-selected-row:hover,
          .lookup-selected-row:hover > td,
          .lookup-selected-row:hover > th {
            background-color: #7dd3fc !important;
            --bs-table-bg: #7dd3fc !important;
            --bs-table-accent-bg: #7dd3fc !important;
            box-shadow: inset 0 0 0 9999px #7dd3fc !important;
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
            <Table hover responsive size="sm" className="mb-0 align-middle">
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
                  const getItemId = (it: any) => {
                    if (!it) return "";
                    if (it.id !== undefined && it.id !== null) return String(it.id);
                    if (it.ID !== undefined && it.ID !== null) return String(it.ID);
                    if (it.kod !== undefined && it.kod !== null) return `kod-${it.kod}`;
                    if (it.code !== undefined && it.code !== null) return `code-${it.code}`;
                    if (it.cariKartId !== undefined && it.cariKartId !== null) return `cari-${it.cariKartId}`;
                    return "";
                  };

                  const itemId = getItemId(item);
                  const selectedId = getItemId(selectedItem);
                  const isSelected = Boolean(
                    selectedItem &&
                      (itemId && selectedId ? itemId === selectedId : item === selectedItem)
                  );
                  const selectedBgColor = "#bae6fd"; // Belirgin açık mavi renk (Sky-200)

                  return (
                    <tr
                      key={itemId || index}
                      onClick={() => handleRowClick(item)}
                      onDoubleClick={() => handleRowDoubleClick(item)}
                      className={isSelected ? "lookup-selected-row table-primary fw-semibold" : ""}
                      style={{
                        cursor: "pointer",
                        userSelect: "none",
                        backgroundColor: isSelected ? selectedBgColor : undefined,
                        boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                      }}
                    >
                      <td
                        className="text-center small"
                        style={{
                          backgroundColor: isSelected ? selectedBgColor : undefined,
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
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
                            backgroundColor: isSelected ? selectedBgColor : undefined,
                            boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                            color: isSelected ? "#0c4a6e" : undefined,
                          }}
                        >
                          {col.render(item)}
                        </td>
                      ))}
                      <td
                        className="text-center"
                        style={{
                          backgroundColor: isSelected ? selectedBgColor : undefined,
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                        }}
                      >
                        <Button
                          size="sm"
                          variant={isSelected ? "primary" : "outline-secondary"}
                          className="py-0 px-2 fs-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(item);
                            onHide();
                          }}
                          title="Çift tıklama veya bu buton ile doğrudan seçin"
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
            disabled={!selectedItem && filteredItems.length === 0}
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

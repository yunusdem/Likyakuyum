import React, { useState, useEffect, useMemo, useRef } from "react";
import { Modal, Button, Form, Table, Badge, Alert, InputGroup } from "react-bootstrap";
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import { EtiketService, TabloMaddesiItem } from "../../services/etiketService";

interface TabloMaddesiSecimModalProps {
  show: boolean;
  onHide: () => void;
  tur: number; // 11: Taş Cinsi, 12: Saflık, 13: Kesim
  turBaslik?: string;
  initialSearchTerm?: string;
  onSelect: (item: TabloMaddesiItem) => void;
}

export const TabloMaddesiSecimModal: React.FC<TabloMaddesiSecimModalProps> = ({
  show,
  onHide,
  tur,
  turBaslik,
  initialSearchTerm = "",
  onSelect,
}) => {
  const [items, setItems] = useState<TabloMaddesiItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  // Form State for Add / Edit (Sadece Tanım Adı)
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formId, setFormId] = useState<number | null>(null);
  const [formAd, setFormAd] = useState<string>("");
  const [formKod, setFormKod] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "danger"; message: string } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const formAdRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const resolvedBaslik = useMemo(() => {
    if (turBaslik) return turBaslik;
    if (tur === 11) return "Taş Cinsi";
    if (tur === 12) return "Saflık";
    if (tur === 13) return "Kesim";
    return `Tablo Maddesi (Tür: ${tur})`;
  }, [tur, turBaslik]);

  // Load items from backend
  const loadItems = async (selectAfterAd?: string) => {
    setIsLoading(true);
    try {
      const data = await EtiketService.getTabloMaddeleri(tur);
      setItems(data);
      if (selectAfterAd) {
        const found = data.find((x) => x.ad.toLowerCase() === selectAfterAd.toLowerCase());
        if (found) {
          onSelect(found);
          onHide();
        }
      }
    } catch (err: any) {
      console.error("Tablo maddeleri yüklenirken hata:", err);
      setAlertInfo({ type: "danger", message: "Kayıtlar yüklenirken bir hata oluştu." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      setSearchTerm(initialSearchTerm);
      setShowForm(false);
      setFormId(null);
      setFormAd("");
      setFormKod("");
      setAlertInfo(null);
      setSelectedIndex(0);
      loadItems();
      setTimeout(() => {
        searchInputRef.current?.focus();
        if (initialSearchTerm) {
          searchInputRef.current?.select();
        }
      }, 100);
    }
  }, [show, tur, initialSearchTerm]);

  // Filtered Items (KOD ve AD alanlarına göre arama)
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase().trim();
    return items.filter(
      (item) =>
        (item.ad && item.ad.toLowerCase().includes(term)) ||
        (item.kod && item.kod.toLowerCase().includes(term))
    );
  }, [items, searchTerm]);

  // Auto scroll highlighted row into view
  useEffect(() => {
    if (filteredItems.length > 0 && selectedIndex >= 0 && selectedIndex < filteredItems.length) {
      rowRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, filteredItems]);

  // Handle Save (Add or Edit)
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formAd.trim()) {
      setAlertInfo({ type: "danger", message: "Tanım adı zorunludur." });
      return;
    }

    setIsSaving(true);
    setAlertInfo(null);
    try {
      await EtiketService.saveTabloMaddesi({
        id: formId,
        tur,
        ad: formAd.trim(),
        kod: formKod.trim() || undefined,
      });

      setAlertInfo({
        type: "success",
        message: formId ? "Kayıt başarıyla güncellendi." : "Yeni kayıt başarıyla eklendi.",
      });

      setShowForm(false);
      const savedAd = formAd.trim();
      setFormId(null);
      setFormAd("");
      setFormKod("");
      await loadItems(savedAd);
    } catch (err: any) {
      console.error("Kayıt kaydedilirken hata:", err);
      setAlertInfo({
        type: "danger",
        message: err?.response?.data?.message || err?.message || "Kayıt sırasında hata oluştu.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleDelete = async (item: TabloMaddesiItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`"${item.ad}" kaydını silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await EtiketService.deleteTabloMaddesi(item.id);
      setAlertInfo({ type: "success", message: `"${item.ad}" silindi.` });
      await loadItems();
    } catch (err: any) {
      console.error("Kayıt silinirken hata:", err);
      setAlertInfo({
        type: "danger",
        message: err?.response?.data?.message || err?.message || "Kayıt silinemedi.",
      });
    }
  };

  // Open Edit Form
  const handleStartEdit = (item: TabloMaddesiItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormId(item.id);
    setFormAd(item.ad || "");
    setFormKod(item.kod || "");
    setShowForm(true);
    setAlertInfo(null);
    setTimeout(() => {
      formAdRef.current?.focus();
    }, 50);
  };

  // Open Add Form
  const handleStartAdd = () => {
    setFormId(null);
    setFormAd(searchTerm.trim() || "");
    setFormKod("");
    setShowForm(true);
    setAlertInfo(null);
    setTimeout(() => {
      formAdRef.current?.focus();
    }, 50);
  };

  // Key Down in Search Input (Yön Okları ve Enter ile Gezinme)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems.length > 0 && selectedIndex >= 0 && selectedIndex < filteredItems.length) {
        onSelect(filteredItems[selectedIndex]);
        onHide();
      } else if (filteredItems.length === 0 && searchTerm.trim()) {
        handleStartAdd();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onHide();
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static">
      <Modal.Header closeButton className="bg-light py-2.5 px-3 border-bottom">
        <div className="d-flex align-items-center justify-content-between w-100 me-2">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold fs-6 text-dark">{resolvedBaslik} Seçimi &amp; Tanımları</span>
            <Badge bg="primary" className="font-monospace">
              TUR: {tur}
            </Badge>
          </div>
          <div className="d-flex align-items-center gap-1.5">
            <Button
              variant={showForm ? "secondary" : "success"}
              size="sm"
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                } else {
                  handleStartAdd();
                }
              }}
              className="d-flex align-items-center gap-1 fw-bold px-2.5"
            >
              {showForm ? (
                <>
                  <IconX size={15} />
                  <span>İptal</span>
                </>
              ) : (
                <>
                  <IconPlus size={15} />
                  <span>Yeni Kayıt</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-3">
        {alertInfo && (
          <Alert
            variant={alertInfo.type}
            dismissible
            onClose={() => setAlertInfo(null)}
            className="py-1.5 px-3 mb-2.5 small"
          >
            {alertInfo.message}
          </Alert>
        )}

        {/* ─── Yeni Kayıt / Düzenleme Form Alanı (Sadece Tanım Adı) ─── */}
        {showForm && (
          <div className="border rounded-3 p-3 bg-light mb-3 shadow-sm">
            <div className="fw-bold text-dark small mb-2 d-flex align-items-center gap-1.5">
              <IconEdit size={16} className="text-primary" />
              <span>{formId ? `${resolvedBaslik} Düzenle` : `Yeni ${resolvedBaslik} Tanımla`}</span>
            </div>
            <Form onSubmit={handleSave}>
              <div className="row g-2">
                <div className="col-12">
                  <Form.Group>
                    <Form.Label className="small fw-semibold text-secondary mb-1">
                      Tanım Adı <span className="text-danger">*</span> (Örn: {tur === 11 ? "Pırlanta, Yakut" : tur === 12 ? "VS1, SI1" : "Brillant, Baget"})
                    </Form.Label>
                    <Form.Control
                      ref={formAdRef}
                      type="text"
                      size="sm"
                      value={formAd}
                      onChange={(e) => setFormAd(e.target.value)}
                      placeholder="Tanım Adı giriniz..."
                      required
                      className="fw-bold"
                    />
                  </Form.Group>
                </div>
              </div>
              <div className="d-flex justify-content-end gap-2 mt-2.5 pt-2 border-top">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setShowForm(false)}
                  disabled={isSaving}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  type="submit"
                  disabled={isSaving}
                  className="d-flex align-items-center gap-1 fw-bold px-3"
                >
                  <IconCheck size={16} />
                  <span>{isSaving ? "Kaydediliyor..." : formId ? "Güncelle" : "Kaydet ve Seç"}</span>
                </Button>
              </div>
            </Form>
          </div>
        )}

        {/* ─── Arama Çubuğu ─── */}
        <div className="mb-2.5">
          <InputGroup size="sm">
            <InputGroup.Text className="bg-white">
              <IconSearch size={15} className="text-muted" />
            </InputGroup.Text>
            <Form.Control
              ref={searchInputRef}
              type="text"
              placeholder={`${resolvedBaslik} ara... (Klavye yön okları ve Enter ile seçebilirsiniz)`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
              className="fw-semibold"
            />
            {searchTerm && (
              <Button
                variant="outline-secondary"
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
        </div>

        {/* ─── Tablo Maddeleri Tablosu (KOD ve AD Alanları) ─── */}
        <div className="table-responsive border rounded bg-white" style={{ maxHeight: "380px" }}>
          <style>{`
            .tablo-maddesi-table tbody tr.tablo-maddesi-selected,
            .tablo-maddesi-table tbody tr.tablo-maddesi-selected > td,
            .tablo-maddesi-table tbody tr.tablo-maddesi-selected:hover,
            .tablo-maddesi-table tbody tr.tablo-maddesi-selected:hover > td {
              background-color: #bae6fd !important;
              --bs-table-bg: #bae6fd !important;
              --bs-table-accent-bg: #bae6fd !important;
              box-shadow: inset 0 0 0 9999px #bae6fd !important;
              color: #0c4a6e !important;
            }
            .tablo-maddesi-table tbody tr.tablo-maddesi-selected span,
            .tablo-maddesi-table tbody tr.tablo-maddesi-selected td {
              color: #0c4a6e !important;
            }
            .tablo-maddesi-table tbody tr.tablo-maddesi-selected .btn {
              color: #0284c7 !important;
            }
            .tablo-maddesi-table tbody tr.tablo-maddesi-selected .btn:hover {
              background-color: rgba(2, 132, 199, 0.15) !important;
            }
            .tablo-maddesi-table tbody tr:not(.tablo-maddesi-selected):hover > td {
              background-color: #f0f9ff !important;
              --bs-table-bg: #f0f9ff !important;
              --bs-table-accent-bg: #f0f9ff !important;
            }
          `}</style>
          <Table size="sm" className="mb-0 align-middle font-monospace tablo-maddesi-table" style={{ fontSize: "13px" }}>
            <thead className="table-light sticky-top">
              <tr className="text-secondary small">
                <th style={{ width: "40px" }} className="text-center">#</th>
                <th style={{ width: "120px" }}>Kod</th>
                <th>Tanım Adı</th>
                <th style={{ width: "90px" }} className="text-center">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    Yükleniyor...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-4 text-muted">
                    <div>Kayıt bulunamadı.</div>
                    {searchTerm && (
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="mt-2 fw-bold"
                        onClick={handleStartAdd}
                      >
                        <IconPlus size={14} className="me-1" />
                        &quot;{searchTerm}&quot; Tanımını Yeni Kayıt Olarak Ekle
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isHighlighted = idx === selectedIndex;
                  return (
                    <tr
                      key={item.id}
                      ref={(el) => {
                        rowRefs.current[idx] = el;
                      }}
                      className={isHighlighted ? "tablo-maddesi-selected fw-semibold" : ""}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => {
                        onSelect(item);
                        onHide();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      title="Seçmek için Enter'a basın veya çift tıklayın"
                    >
                      <td className="text-center small">{idx + 1}</td>
                      <td>
                        <span className="fw-bold text-primary">{item.kod || "-"}</span>
                      </td>
                      <td>
                        <span className="text-dark fw-semibold">{item.ad}</span>
                      </td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="d-flex align-items-center justify-content-center gap-1">
                          <Button
                            variant="light"
                            size="sm"
                            className="p-1 border-0 text-primary"
                            onClick={(e) => handleStartEdit(item, e)}
                            title="Düzenle"
                          >
                            <IconEdit size={14} />
                          </Button>
                          <Button
                            variant="light"
                            size="sm"
                            className="p-1 border-0 text-danger"
                            onClick={(e) => handleDelete(item, e)}
                            title="Sil"
                          >
                            <IconTrash size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>

      <Modal.Footer className="bg-light py-2 px-3 d-flex justify-content-between align-items-center">
        <span className="small text-muted">
          Toplam <strong>{filteredItems.length}</strong> / {items.length} kayıt. (Seçmek için <kbd>Enter</kbd> veya <strong>çift tıklayın</strong>)
        </span>
        <div className="d-flex align-items-center gap-2">
          {filteredItems.length > 0 && (
            <Button
              variant="primary"
              size="sm"
              className="fw-bold px-3"
              onClick={() => {
                if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
                  onSelect(filteredItems[selectedIndex]);
                  onHide();
                }
              }}
            >
              <IconCheck size={15} className="me-1" />
              Seç ({filteredItems[selectedIndex]?.ad || ""})
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onHide}>
            Kapat
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

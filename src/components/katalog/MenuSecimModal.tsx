import React, { useState, useEffect, useRef } from "react";
import { Modal, Button, Table, Form, InputGroup, Badge, Spinner, Alert } from "react-bootstrap";
import {
  IconSearch,
  IconPlus,
  IconCheck,
  IconEdit,
  IconTrash,
  IconListDetails,
  IconDeviceTv,
  IconX,
} from "@tabler/icons-react";
import { MenuItem, MenuService, SaveMenuPayload } from "../../services/menuService";

interface MenuSecimModalProps {
  show: boolean;
  onClose: () => void;
  selectedMenuId?: number | null;
  onSelect: (menu: { menuId: number; menuAdi: string }) => void;
}

export const MenuSecimModal: React.FC<MenuSecimModalProps> = ({
  show,
  onClose,
  selectedMenuId,
  onSelect,
}) => {
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [search, setSearch] = useState<string>("");
  const [currentSelectedId, setCurrentSelectedId] = useState<number | null>(selectedMenuId || null);
  const [notif, setNotif] = useState<{ type: "success" | "danger" | "warning"; text: string } | null>(null);

  // Focus & Navigation Refs
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Yeni / Düzenleme Menü Formu
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formId, setFormId] = useState<number | null>(null);
  const [formAdi, setFormAdi] = useState<string>("");
  const [formAciklama, setFormAciklama] = useState<string>("");
  const [formSira, setFormSira] = useState<number>(0);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadMenus = async () => {
    try {
      setLoading(true);
      const list = await MenuService.getMenus();
      setMenus(list);
      // Eğer hiç seçili yoksa ve listede menü varsa ilkini otomatik işaretle
      if (!currentSelectedId && list.length > 0) {
        const defaultMenu = list.find((m) => m.aktif) || list[0];
        setCurrentSelectedId(defaultMenu.menuId);
      }
    } catch (err: any) {
      console.error("Menüler yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      setCurrentSelectedId(selectedMenuId || null);
      loadMenus();
      setShowForm(false);
      setFormError(null);
      setNotif(null);
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }, 50);
    }
  }, [show, selectedMenuId]);

  const filteredMenus = menus.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.menuAdi.toLowerCase().includes(q) ||
      (m.aciklama && m.aciklama.toLowerCase().includes(q))
    );
  });

  // Keep selection valid when filtered
  useEffect(() => {
    if (filteredMenus.length > 0) {
      const exists = filteredMenus.some((m) => m.menuId === currentSelectedId);
      if (!exists) {
        setCurrentSelectedId(filteredMenus[0].menuId);
      }
    }
  }, [filteredMenus, currentSelectedId]);

  // Scroll selected row into view
  useEffect(() => {
    if (currentSelectedId) {
      const idx = filteredMenus.findIndex((m) => m.menuId === currentSelectedId);
      if (idx >= 0 && rowRefs.current[idx]) {
        rowRefs.current[idx]?.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [currentSelectedId, filteredMenus]);

  // Keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showForm) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (filteredMenus.length === 0) return;
        const currentIdx = filteredMenus.findIndex((m) => m.menuId === currentSelectedId);
        const nextIdx = currentIdx < filteredMenus.length - 1 ? currentIdx + 1 : currentIdx;
        const targetMenu = filteredMenus[nextIdx];
        if (targetMenu) {
          setCurrentSelectedId(targetMenu.menuId);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (filteredMenus.length === 0) return;
        const currentIdx = filteredMenus.findIndex((m) => m.menuId === currentSelectedId);
        const prevIdx = currentIdx > 0 ? currentIdx - 1 : 0;
        const targetMenu = filteredMenus[prevIdx];
        if (targetMenu) {
          setCurrentSelectedId(targetMenu.menuId);
        }
      } else if (e.key === "Enter") {
        // Form dışındayken Enter seçimi onaylar
        if (!showForm && currentSelectedId) {
          e.preventDefault();
          const selected = filteredMenus.find((m) => m.menuId === currentSelectedId) || menus.find((m) => m.menuId === currentSelectedId);
          if (selected) {
            onSelect({ menuId: selected.menuId, menuAdi: selected.menuAdi });
            onClose();
          }
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [show, showForm, filteredMenus, currentSelectedId, menus, onSelect, onClose]);

  const handleOpenNew = () => {
    setFormId(null);
    setFormAdi("");
    setFormAciklama("");
    setFormSira(menus.length + 1);
    setFormError(null);
    setShowForm(true);
  };

  const handleOpenEdit = (m: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormId(m.menuId);
    setFormAdi(m.menuAdi);
    setFormAciklama(m.aciklama || "");
    setFormSira(m.siraNo || 0);
    setFormError(null);
    setShowForm(true);
  };

  const handleDelete = async (m: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `"${m.menuAdi}" menüsü silinecek ve bu menüye bağlı ürünlerin menü bağı kaldırılacaktır.\n\nOnaylıyor musunuz?`
    );

    if (confirmed) {
      try {
        await MenuService.deleteMenu(m.menuId);
        if (currentSelectedId === m.menuId) {
          setCurrentSelectedId(null);
        }
        await loadMenus();
        setNotif({ type: "success", text: `"${m.menuAdi}" menüsü başarıyla silindi.` });
      } catch (err: any) {
        setNotif({ type: "danger", text: err.message || "Menü silinemedi." });
      }
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAdi.trim()) {
      setFormError("Lütfen menü adını giriniz.");
      return;
    }
    setFormError(null);
    setFormSubmitting(true);
    try {
      const payload: SaveMenuPayload = {
        menuId: formId,
        menuAdi: formAdi.trim(),
        aciklama: formAciklama.trim() || null,
        siraNo: Number(formSira) || 0,
        aktif: true,
      };
      const saved = await MenuService.saveMenu(payload);
      setShowForm(false);
      await loadMenus();
      setCurrentSelectedId(saved.menuId);
      setNotif({
        type: "success",
        text: formId ? "Menü başarıyla güncellendi." : "Yeni menü oluşturuldu ve seçildi.",
      });
    } catch (err: any) {
      setFormError(err.message || "Menü kaydedilemedi.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Çift tıklama veya butonla kullanımda yapma
  const handleApplyMenu = (m: MenuItem) => {
    onSelect({ menuId: m.menuId, menuAdi: m.menuAdi });
    onClose();
  };

  const handleConfirmSelect = () => {
    if (!currentSelectedId) {
      setNotif({
        type: "warning",
        text: "Lütfen ürünün ait olacağı menüyü seçiniz veya yeni bir menü ekleyiniz.",
      });
      return;
    }
    const selected = menus.find((m) => m.menuId === currentSelectedId);
    if (selected) {
      handleApplyMenu(selected);
    }
  };

  return (
    <Modal show={show} onHide={onClose} size="lg" centered backdrop="static">
      <Modal.Header closeButton className="bg-light py-2.5">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 text-dark">
          <IconDeviceTv size={20} className="text-primary" />
          <span>Katalog & TV Menü Seçimi</span>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3">
        {/* Scoped lookup styling matching system Lookups */}
        <style>{`
          .menu-lookup-table tbody tr.menu-selected-row,
          .menu-lookup-table tbody tr.menu-selected-row > td,
          .menu-lookup-table tbody tr.menu-selected-row > th,
          .menu-lookup-table tbody tr.menu-selected-row:hover,
          .menu-lookup-table tbody tr.menu-selected-row:hover > td,
          .menu-lookup-table tbody tr.menu-selected-row:hover > th {
            background-color: #bae6fd !important;
            --bs-table-bg: #bae6fd !important;
            --bs-table-accent-bg: #bae6fd !important;
            box-shadow: inset 0 0 0 9999px #bae6fd !important;
            color: #0c4a6e !important;
          }
          .menu-lookup-table tbody tr:not(.menu-selected-row):hover,
          .menu-lookup-table tbody tr:not(.menu-selected-row):hover > td,
          .menu-lookup-table tbody tr:not(.menu-selected-row):hover > th {
            background-color: #e0f2fe !important;
            --bs-table-bg: #e0f2fe !important;
            --bs-table-accent-bg: #e0f2fe !important;
            --bs-table-hover-bg: #e0f2fe !important;
            box-shadow: inset 0 0 0 9999px #e0f2fe !important;
            color: #0369a1 !important;
          }
        `}</style>

        {notif && (
          <Alert
            variant={notif.type}
            dismissible
            onClose={() => setNotif(null)}
            className="py-1.5 px-2.5 small mb-2.5"
          >
            {notif.text}
          </Alert>
        )}

        {/* Üst Bilgi ve Yeni Menü Butonu */}
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <InputGroup style={{ maxWidth: "340px" }} size="sm">
            <InputGroup.Text className="bg-white">
              <IconSearch size={15} className="text-secondary" />
            </InputGroup.Text>
            <Form.Control
              ref={searchInputRef}
              placeholder="Menü ara (Ok tuşları ile gezin, Enter seçer)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <Button variant="outline-secondary" onClick={() => setSearch("")}>
                <IconX size={14} />
              </Button>
            )}
          </InputGroup>

          {!showForm && (
            <Button
              variant="outline-primary"
              size="sm"
              className="d-flex align-items-center gap-1.5 fw-semibold shadow-xs"
              onClick={handleOpenNew}
            >
              <IconPlus size={16} />
              <span>Yeni Menü Ekle</span>
            </Button>
          )}
        </div>

        {/* Yeni / Düzenle Formu */}
        {showForm && (
          <div className="p-3 border rounded-3 bg-light mb-3">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="fw-bold small text-dark d-flex align-items-center gap-1.5">
                <IconEdit size={16} className="text-primary" />
                {formId ? "Menü Düzenle" : "Yeni Menü Oluştur"}
              </span>
              <Button
                variant="outline-secondary"
                size="sm"
                className="py-0 px-2"
                onClick={() => setShowForm(false)}
              >
                İptal
              </Button>
            </div>

            {formError && (
              <Alert variant="danger" className="py-1.5 px-2.5 small mb-2">
                {formError}
              </Alert>
            )}

            <Form onSubmit={handleSaveForm}>
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <Form.Group>
                    <Form.Label className="small fw-semibold mb-1">
                      Menü Adı <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      size="sm"
                      placeholder="Örn: Vitrin TV Menüsü, Yeni Sezon..."
                      value={formAdi}
                      onChange={(e) => setFormAdi(e.target.value)}
                      autoFocus
                    />
                  </Form.Group>
                </div>
                <div className="col-12 col-md-4">
                  <Form.Group>
                    <Form.Label className="small fw-semibold mb-1">Açıklama</Form.Label>
                    <Form.Control
                      size="sm"
                      placeholder="Kısa açıklama..."
                      value={formAciklama}
                      onChange={(e) => setFormAciklama(e.target.value)}
                    />
                  </Form.Group>
                </div>
                <div className="col-12 col-md-2">
                  <Form.Group>
                    <Form.Label className="small fw-semibold mb-1">Sıra</Form.Label>
                    <Form.Control
                      type="number"
                      size="sm"
                      value={formSira}
                      onChange={(e) => setFormSira(Number(e.target.value))}
                    />
                  </Form.Group>
                </div>
                <div className="col-12 d-flex justify-content-end gap-2 mt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={formSubmitting}
                    className="d-flex align-items-center gap-1 fw-semibold"
                  >
                    {formSubmitting ? (
                      <Spinner size="sm" />
                    ) : (
                      <>
                        <IconCheck size={16} />
                        <span>Kaydet</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Form>
          </div>
        )}

        {/* Menü Listesi */}
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <div className="small text-muted mt-2">Menüler yükleniyor...</div>
          </div>
        ) : filteredMenus.length === 0 ? (
          <div className="text-center py-4 border rounded-3 bg-light">
            <IconListDetails size={32} className="text-muted mb-2" />
            <div className="small text-muted">
              {search ? "Aramaya uygun menü bulunamadı." : "Henüz bir menü oluşturulmamış."}
            </div>
          </div>
        ) : (
          <div className="table-responsive border rounded-3" style={{ maxHeight: "360px" }}>
            <Table hover size="sm" className="mb-0 align-middle menu-lookup-table">
              <thead className="table-light sticky-top">
                <tr className="small text-secondary">
                  <th style={{ width: "40px" }} className="text-center">
                    Seç
                  </th>
                  <th>Menü Adı</th>
                  <th>Açıklama</th>
                  <th style={{ width: "90px" }} className="text-center">
                    Ürün Sayısı
                  </th>
                  <th style={{ width: "70px" }} className="text-center">
                    Sıra
                  </th>
                  <th style={{ width: "80px" }} className="text-end">
                    İşlem
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMenus.map((m, idx) => {
                  const isSelected = currentSelectedId === m.menuId;
                  return (
                    <tr
                      key={m.menuId}
                      ref={(el) => { rowRefs.current[idx] = el; }}
                      onClick={() => setCurrentSelectedId(m.menuId)}
                      onDoubleClick={() => handleApplyMenu(m)}
                      className={isSelected ? "menu-selected-row fw-semibold" : ""}
                      style={{ cursor: "pointer" }}
                      title="Tek tıklama ile seçin, çift tıklama ile hemen kullanıma alın"
                    >
                      <td className="text-center">
                        <Form.Check
                          type="radio"
                          name="selectedMenu"
                          checked={isSelected}
                          onChange={() => setCurrentSelectedId(m.menuId)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="fw-semibold">
                        <div className="d-flex align-items-center gap-1.5">
                          <span>{m.menuAdi}</span>
                          {isSelected && (
                            <Badge bg="primary" className="px-1.5 py-0.5" style={{ fontSize: "10px" }}>
                              Seçili
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="small text-muted">{m.aciklama || "-"}</td>
                      <td className="text-center">
                        <Badge bg="light" text="dark" className="border">
                          {m.urunSayisi ?? 0} ürün
                        </Badge>
                      </td>
                      <td className="text-center small text-secondary">{m.siraNo || 0}</td>
                      <td className="text-end">
                        <div className="d-flex align-items-center justify-content-end gap-1">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="p-1"
                            title="Düzenle"
                            onClick={(e) => handleOpenEdit(m, e)}
                          >
                            <IconEdit size={14} />
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="p-1"
                            title="Sil"
                            onClick={(e) => handleDelete(m, e)}
                          >
                            <IconTrash size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer className="bg-light py-2">
        <div className="me-auto small text-muted d-none d-sm-block">
          <kbd>↑</kbd> <kbd>↓</kbd> Gezinme &nbsp;|&nbsp; <kbd>Enter</kbd> veya Çift Tıklama ile Seç
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          İptal
        </Button>
        <Button
          variant="primary"
          size="sm"
          className="d-flex align-items-center gap-1 fw-semibold px-3"
          onClick={handleConfirmSelect}
          disabled={!currentSelectedId}
        >
          <IconCheck size={16} />
          <span>Seç ve Uygula</span>
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

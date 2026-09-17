import React, { useState, useEffect, useMemo, useRef } from "react";
import { Modal, Button, Form, Table, Badge, Alert, InputGroup } from "react-bootstrap";
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconCheck,
  IconX,
  IconSparkles,
  IconRotateClockwise,
} from "@tabler/icons-react";
import { AyarService, AyarItem, SaveAyarDto } from "../../services/ayarService";

interface AyarSecimModalProps {
  show: boolean;
  onHide: () => void;
  onSelect: (ayar: AyarItem) => void;
  selectedAyarKodu?: string;
}

export const AyarSecimModal: React.FC<AyarSecimModalProps> = ({
  show,
  onHide,
  onSelect,
  selectedAyarKodu,
}) => {
  const [ayarlar, setAyarlar] = useState<AyarItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Form State for Add / Edit
  const [showForm, setShowForm] = useState<boolean>(false);
  const [formAyarId, setFormAyarId] = useState<number | null>(null);
  const [formAyarKodu, setFormAyarKodu] = useState<string>("");
  const [formAyarAdi, setFormAyarAdi] = useState<string>("");
  const [formMilyem, setFormMilyem] = useState<string>("");
  const [formStandartAyar, setFormStandartAyar] = useState<string>("");
  const [formSiraNo, setFormSiraNo] = useState<number>(0);
  const [formVarsayilan, setFormVarsayilan] = useState<boolean>(false);
  const [formAktif, setFormAktif] = useState<boolean>(true);
  const [formAciklama, setFormAciklama] = useState<string>("");

  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load Ayarlar from backend (SODVZ_AYAR_LISTELE)
  const loadAyarlar = async () => {
    setIsLoading(true);
    try {
      const data = await AyarService.getAyarlar(false);
      setAyarlar(data);
      if (selectedAyarKodu && !selectedId) {
        const found = data.find(
          (a) => a.ayarKodu.toUpperCase().trim() === selectedAyarKodu.toUpperCase().trim()
        );
        if (found) setSelectedId(found.ayarId);
      }
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: "Ayar listesi yüklenemedi: " + (err.message || err) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      loadAyarlar();
      setShowForm(false);
      setAlertInfo(null);
      setTimeout(() => {
        if (searchInputRef.current) searchInputRef.current.focus();
      }, 150);
    }
  }, [show]);

  // Filtered Ayarlar
  const filteredAyarlar = useMemo(() => {
    if (!searchTerm.trim()) return ayarlar;
    const term = searchTerm.toLowerCase().trim();
    return ayarlar.filter(
      (a) =>
        a.ayarKodu.toLowerCase().includes(term) ||
        a.ayarAdi.toLowerCase().includes(term) ||
        String(a.milyem).includes(term) ||
        String(a.standartAyar).includes(term) ||
        (a.aciklama && a.aciklama.toLowerCase().includes(term))
    );
  }, [ayarlar, searchTerm]);

  // Start Adding New Ayar
  const handleAddNew = () => {
    setFormAyarId(null);
    setFormAyarKodu("");
    setFormAyarAdi("");
    setFormMilyem("");
    setFormStandartAyar("");
    setFormSiraNo(ayarlar.length + 1);
    setFormVarsayilan(false);
    setFormAktif(true);
    setFormAciklama("");
    setAlertInfo(null);
    setShowForm(true);
  };

  // Start Editing Ayar
  const handleEdit = (it: AyarItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFormAyarId(it.ayarId);
    setFormAyarKodu(it.ayarKodu);
    setFormAyarAdi(it.ayarAdi);
    setFormMilyem(String(it.milyem));
    setFormStandartAyar(String(it.standartAyar));
    setFormSiraNo(it.siraNo);
    setFormVarsayilan(it.varsayilan);
    setFormAktif(it.aktif);
    setFormAciklama(it.aciklama || "");
    setAlertInfo(null);
    setShowForm(true);
  };

  // Auto calculate Milyem or Standart Ayar when typing
  const handleMilyemChange = (val: string) => {
    setFormMilyem(val);
    const num = parseFloat(val.replace(",", "."));
    if (!isNaN(num) && num > 0 && num <= 1) {
      const calcStandart = Math.round(num * 24);
      if (!formStandartAyar) {
        setFormStandartAyar(String(calcStandart));
      }
    }
  };

  const handleAyarKoduChange = (val: string) => {
    const code = val.toUpperCase();
    setFormAyarKodu(code);
    if (!formAyarAdi) {
      setFormAyarAdi(`${code} Ayar`);
    }
    const numPart = parseInt(code, 10);
    if (!isNaN(numPart) && numPart > 0 && numPart <= 24) {
      if (!formStandartAyar) setFormStandartAyar(String(numPart));
      if (!formMilyem) {
        if (numPart === 24) setFormMilyem("1.00000");
        else if (numPart === 22) setFormMilyem("0.91600");
        else if (numPart === 18) setFormMilyem("0.75000");
        else if (numPart === 14) setFormMilyem("0.58500");
        else if (numPart === 8) setFormMilyem("0.33300");
        else setFormMilyem((numPart / 24).toFixed(5));
      }
    }
  };

  // Save Ayar via procedure (SODVZ_AYAR_KAYDET)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAyarKodu.trim()) {
      setAlertInfo({ type: "danger", message: "Lütfen ayar kodunu giriniz." });
      return;
    }
    if (!formAyarAdi.trim()) {
      setAlertInfo({ type: "danger", message: "Lütfen ayar adını giriniz." });
      return;
    }
    const milyemNum = parseFloat(formMilyem.replace(",", "."));
    if (isNaN(milyemNum) || milyemNum <= 0 || milyemNum > 1) {
      setAlertInfo({
        type: "danger",
        message: "Milyem 0 ile 1.00000 arasında geçerli bir ondalık değer olmalıdır (Örn: 0.91600 veya 0.58500).",
      });
      return;
    }

    setIsSaving(true);
    setAlertInfo(null);
    try {
      const dto: SaveAyarDto = {
        ayarId: formAyarId,
        ayarKodu: formAyarKodu.trim().toUpperCase(),
        ayarAdi: formAyarAdi.trim(),
        milyem: milyemNum,
        standartAyar: formStandartAyar ? parseInt(formStandartAyar, 10) : Math.round(milyemNum * 24),
        siraNo: formSiraNo,
        varsayilan: formVarsayilan,
        aktif: formAktif,
        aciklama: formAciklama.trim() || null,
      };

      const res = await AyarService.saveAyar(dto);
      setAlertInfo({
        type: "success",
        message: res.yeniKayit ? "Ayar tanımı başarıyla eklendi." : "Ayar tanımı güncellendi.",
      });
      setShowForm(false);
      await loadAyarlar();
      setSelectedId(res.ayarId);
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: err.response?.data?.message || err.message || "Ayar kaydedilemedi.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Ayar via procedure (SODVZ_AYAR_SIL)
  const handleDelete = async (it: AyarItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`"${it.ayarKodu} - ${it.ayarAdi}" ayar tanımını silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      await AyarService.deleteAyar(it.ayarId);
      setAlertInfo({ type: "success", message: `"${it.ayarKodu}" ayar tanımı silindi.` });
      if (selectedId === it.ayarId) setSelectedId(null);
      await loadAyarlar();
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: err.response?.data?.message || err.message || "Ayar tanımı silinemedi.",
      });
    }
  };

  // Select Ayar and close
  const handleConfirmSelect = () => {
    const selected = ayarlar.find((a) => a.ayarId === selectedId);
    if (selected) {
      onSelect(selected);
      onHide();
    } else {
      setAlertInfo({ type: "danger", message: "Lütfen listeden bir ayar seçiniz." });
    }
  };

  // Keyboard navigation inside modal
  const handleModalKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onHide();
      return;
    }
    if (!showForm && (e.key === "Enter" || e.code === "NumpadEnter") && selectedId) {
      e.preventDefault();
      handleConfirmSelect();
      return;
    }
    if (!showForm && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const curIdx = filteredAyarlar.findIndex((a) => a.ayarId === selectedId);
      if (e.key === "ArrowDown") {
        const next = curIdx < filteredAyarlar.length - 1 ? curIdx + 1 : 0;
        setSelectedId(filteredAyarlar[next]?.ayarId || null);
      } else {
        const prev = curIdx > 0 ? curIdx - 1 : filteredAyarlar.length - 1;
        setSelectedId(filteredAyarlar[prev]?.ayarId || null);
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
      onKeyDown={handleModalKeyDown}
    >
      <Modal.Header closeButton className="py-2.5 px-3 bg-light border-bottom">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
          <IconSparkles size={20} className="text-warning" />
          <span>Altın Ayar & Milyem Tanımları</span>
          <Badge bg="secondary" className="font-monospace">
            {ayarlar.length} Tanım
          </Badge>
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3">
        {alertInfo && (
          <Alert
            variant={alertInfo.type}
            dismissible
            onClose={() => setAlertInfo(null)}
            className="py-1.5 px-3 mb-2 small fw-semibold"
          >
            {alertInfo.message}
          </Alert>
        )}

        {/* Top Search & Actions Bar */}
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2.5">
          <InputGroup size="sm" style={{ maxWidth: "340px" }}>
            <InputGroup.Text className="bg-white">
              <IconSearch size={15} className="text-secondary" />
            </InputGroup.Text>
            <Form.Control
              ref={searchInputRef}
              type="text"
              placeholder="Ayar kodu, adı veya milyem ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <Button variant="outline-secondary" size="sm" onClick={() => setSearchTerm("")}>
                <IconX size={14} />
              </Button>
            )}
          </InputGroup>

          <div className="d-flex align-items-center gap-2">
            <Button
              size="sm"
              variant="outline-primary"
              className="d-flex align-items-center gap-1 fw-bold"
              onClick={loadAyarlar}
              disabled={isLoading}
              title="Yenile"
            >
              <IconRotateClockwise size={15} /> Yenile
            </Button>
            <Button
              size="sm"
              variant={showForm ? "outline-secondary" : "primary"}
              className="d-flex align-items-center gap-1 fw-bold shadow-2xs"
              onClick={() => {
                if (showForm) setShowForm(false);
                else handleAddNew();
              }}
            >
              {showForm ? (
                <>
                  <IconX size={15} /> İptal
                </>
              ) : (
                <>
                  <IconPlus size={15} /> Yeni Ayar Tanımı
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Inline Add / Edit Form */}
        {showForm && (
          <div className="border rounded p-3 mb-3 bg-light shadow-2xs">
            <div className="fw-bold mb-2 text-primary small d-flex align-items-center gap-1.5">
              {formAyarId ? <IconEdit size={16} /> : <IconPlus size={16} />}
              <span>{formAyarId ? `Ayar Tanımını Düzenle (#${formAyarId})` : "Yeni Ayar Tanımı Ekle"}</span>
            </div>
            <Form onSubmit={handleSaveForm}>
              <div className="row g-2 mb-2">
                <div className="col-md-4">
                  <Form.Label className="small fw-semibold text-secondary mb-1">
                    Ayar Kodu <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    size="sm"
                    type="text"
                    required
                    placeholder="Örn: 22 FANTAZI, 24, 14"
                    value={formAyarKodu}
                    onChange={(e) => handleAyarKoduChange(e.target.value)}
                    className="fw-bold font-monospace"
                  />
                </div>
                <div className="col-md-5">
                  <Form.Label className="small fw-semibold text-secondary mb-1">
                    Ayar Tanımı / Adı <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    size="sm"
                    type="text"
                    required
                    placeholder="Örn: 22 Ayar Fantazi"
                    value={formAyarAdi}
                    onChange={(e) => setFormAyarAdi(e.target.value)}
                  />
                </div>
                <div className="col-md-3">
                  <Form.Label className="small fw-semibold text-secondary mb-1">
                    Milyem (0 - 1.0) <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    size="sm"
                    type="text"
                    required
                    placeholder="Örn: 0.91600"
                    value={formMilyem}
                    onChange={(e) => handleMilyemChange(e.target.value)}
                    className="fw-bold font-monospace text-end"
                  />
                </div>
              </div>

              <div className="row g-2 mb-2">
                <div className="col-md-3">
                  <Form.Label className="small fw-semibold text-secondary mb-1">Standart Ayar (Karat)</Form.Label>
                  <Form.Control
                    size="sm"
                    type="number"
                    placeholder="24, 22, 18, 14, 8"
                    value={formStandartAyar}
                    onChange={(e) => setFormStandartAyar(e.target.value)}
                    className="font-monospace text-end"
                  />
                </div>
                <div className="col-md-3">
                  <Form.Label className="small fw-semibold text-secondary mb-1">Sıra No</Form.Label>
                  <Form.Control
                    size="sm"
                    type="number"
                    value={formSiraNo}
                    onChange={(e) => setFormSiraNo(parseInt(e.target.value, 10) || 0)}
                    className="font-monospace text-end"
                  />
                </div>
                <div className="col-md-6 d-flex align-items-center gap-4 pt-3">
                  <Form.Check
                    type="checkbox"
                    id="form-varsayilan-chk"
                    label="Varsayılan Ayar"
                    checked={formVarsayilan}
                    onChange={(e) => setFormVarsayilan(e.target.checked)}
                    className="small fw-semibold"
                  />
                  <Form.Check
                    type="checkbox"
                    id="form-aktif-chk"
                    label="Aktif Tanım"
                    checked={formAktif}
                    onChange={(e) => setFormAktif(e.target.checked)}
                    className="small fw-semibold text-success"
                  />
                </div>
              </div>

              <div className="row g-2 mb-2">
                <div className="col-md-12">
                  <Form.Label className="small fw-semibold text-secondary mb-1">Açıklama / Not</Form.Label>
                  <Form.Control
                    size="sm"
                    type="text"
                    placeholder="İsteğe bağlı ek açıklama"
                    value={formAciklama}
                    onChange={(e) => setFormAciklama(e.target.value)}
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 pt-1 border-top">
                <Button size="sm" variant="secondary" onClick={() => setShowForm(false)}>
                  İptal
                </Button>
                <Button size="sm" variant="success" type="submit" disabled={isSaving} className="fw-bold px-3">
                  {isSaving ? "Kaydediliyor..." : "Ayar Kaydet"}
                </Button>
              </div>
            </Form>
          </div>
        )}

        {/* Scoped selection style to ensure vivid blue row highlight on click */}
        <style>{`
          .ayar-table tbody tr.ayar-selected-row,
          .ayar-table tbody tr.ayar-selected-row > td,
          .ayar-table tbody tr.ayar-selected-row > th,
          .ayar-table tbody tr.ayar-selected-row:hover,
          .ayar-table tbody tr.ayar-selected-row:hover > td,
          .ayar-table tbody tr.ayar-selected-row:hover > th {
            background-color: #0284c7 !important;
            --bs-table-bg: #0284c7 !important;
            --bs-table-accent-bg: #0284c7 !important;
            box-shadow: inset 0 0 0 9999px #0284c7 !important;
            color: #ffffff !important;
          }
          .ayar-table tbody tr.ayar-selected-row td .badge {
            background-color: #ffffff !important;
            color: #0284c7 !important;
          }
          .ayar-table tbody tr.ayar-selected-row td .text-success {
            color: #ffffff !important;
          }
          .ayar-table tbody tr.ayar-selected-row td .text-secondary {
            color: #e0f2fe !important;
          }
          .ayar-table tbody tr.ayar-selected-row td .btn-outline-primary {
            color: #ffffff !important;
            border-color: #ffffff !important;
            background-color: rgba(255, 255, 255, 0.2) !important;
          }
          .ayar-table tbody tr:not(.ayar-selected-row):hover > td,
          .ayar-table tbody tr:not(.ayar-selected-row):hover > th {
            background-color: #f1f5f9 !important;
            --bs-table-bg: #f1f5f9 !important;
            --bs-table-accent-bg: #f1f5f9 !important;
          }
        `}</style>

        {/* Ayar List Grid Table */}
        <div
          className="border rounded table-responsive shadow-2xs"
          style={{ maxHeight: "360px", minHeight: "220px", overflowY: "auto" }}
        >
          <Table hover size="sm" className="mb-0 align-middle user-select-none ayar-table" style={{ fontSize: "12.5px" }}>
            <thead className="table-light sticky-top border-bottom" style={{ zIndex: 1 }}>
              <tr>
                <th style={{ width: "45px" }} className="text-center">
                  Sıra
                </th>
                <th style={{ width: "130px" }}>Ayar Kodu</th>
                <th>Ayar Adı / Tanımı</th>
                <th style={{ width: "100px" }} className="text-end">
                  Milyem
                </th>
                <th style={{ width: "90px" }} className="text-center">
                  Karat
                </th>
                <th style={{ width: "85px" }} className="text-center">
                  Varsayılan
                </th>
                <th style={{ width: "70px" }} className="text-center">
                  Durum
                </th>
                <th style={{ width: "65px" }} className="text-center">
                  Düzenle
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-secondary">
                    Yükleniyor...
                  </td>
                </tr>
              ) : filteredAyarlar.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-4 text-secondary">
                    Kayıtlı ayar tanımı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredAyarlar.map((it) => {
                  const isSelected = selectedId === it.ayarId;
                  return (
                    <tr
                      key={it.ayarId}
                      onClick={() => setSelectedId(it.ayarId)}
                      onDoubleClick={() => {
                        setSelectedId(it.ayarId);
                        onSelect(it);
                        onHide();
                      }}
                      style={{ cursor: "pointer" }}
                      className={isSelected ? "ayar-selected-row fw-semibold" : ""}
                    >
                      <td className="text-center font-monospace text-secondary">{it.siraNo}</td>
                      <td>
                        <Badge
                          bg={isSelected ? "primary" : "secondary"}
                          className="font-monospace px-2 py-1"
                          style={{ fontSize: "11.5px" }}
                        >
                          {it.ayarKodu}
                        </Badge>
                      </td>
                      <td>{it.ayarAdi}</td>
                      <td className="text-end font-monospace fw-bold text-success">
                        {it.milyem.toFixed(5)}
                      </td>
                      <td className="text-center font-monospace">{it.standartAyar}</td>
                      <td className="text-center">
                        {it.varsayilan ? (
                          <Badge bg="info" className="px-1.5 py-0.5">
                            Evet
                          </Badge>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="text-center">
                        {it.aktif ? (
                          <Badge bg="success" className="px-1.5 py-0.5">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge bg="secondary" className="px-1.5 py-0.5">
                            Pasif
                          </Badge>
                        )}
                      </td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          className="p-1 line-height-1"
                          title="Düzenle"
                          onClick={(e) => handleEdit(it, e)}
                        >
                          <IconEdit size={13} />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>

      <Modal.Footer className="py-2 px-3 bg-light border-top d-flex justify-content-between">
        <div className="small text-secondary">
          <span>Seçmek için satıra çift tıklayabilir veya klavyeden </span>
          <kbd>Enter</kbd> tuşuna basabilirsiniz.
        </div>
        <div className="d-flex align-items-center gap-2">
          <Button size="sm" variant="secondary" onClick={onHide}>
            Kapat (Esc)
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="fw-bold px-3 d-flex align-items-center gap-1 shadow-2xs"
            disabled={!selectedId}
            onClick={handleConfirmSelect}
          >
            <IconCheck size={16} /> Seç
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

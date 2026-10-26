import React, { useState, useEffect, useRef } from "react";
import { Form, InputGroup, Button, Modal, Spinner } from "react-bootstrap";
import { IconBinoculars, IconPlus, IconCheck, IconX } from "@tabler/icons-react";
import LookupModal, { LookupColumn } from "./LookupModal";
import { CariService, LookupItem } from "../../services/cariService";

const normalizeTr = (str: string): string => {
  return (str || "")
    .toLocaleLowerCase("tr-TR")
    .replace(/[\s\-_]/g, "")
    .trim();
};

export interface LookupDurbunSelectProps {
  id?: string;
  label: string; // Örn: "Vergi Dairesi", "Hukuki Yapı", "Meslek", "Sektör"
  value: number | null | undefined;
  items: LookupItem[];
  onChange: (id: number | null) => void;
  tur: number; // 0: Vergi Dairesi, 5: Hukuki Yapı, 9: Meslek, 8: Sektör
  disabled?: boolean;
  placeholder?: string;
  nextFocusId?: string;
  onAfterSelect?: () => void;
  onRefreshLookups: () => Promise<any>;
  onSuccessMessage?: (msg: string) => void;
  onErrorMessage?: (msg: string) => void;
  columns?: LookupColumn<LookupItem>[];
}

export const LookupDurbunSelect: React.FC<LookupDurbunSelectProps> = ({
  id,
  label,
  value,
  items = [],
  onChange,
  tur,
  disabled = false,
  placeholder,
  nextFocusId,
  onAfterSelect,
  onRefreshLookups,
  onSuccessMessage,
  onErrorMessage,
  columns,
}) => {
  const [inputText, setInputText] = useState<string>("");
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);
  const [modalInitialSearch, setModalInitialSearch] = useState<string>("");

  // Yeni Kayıt Ekleme Modalı
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newRecordAd, setNewRecordAd] = useState<string>("");
  const [newRecordKod, setNewRecordKod] = useState<string>("");
  const [isSavingNewRecord, setIsSavingNewRecord] = useState<boolean>(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Seçim yapıldığında bir sonraki inputa otomatik fokuslanma
  const focusNext = () => {
    const doFocus = () => {
      // 1. nextFocusId belirtilmişse öncelikle onu bul
      if (nextFocusId) {
        const el = document.getElementById(nextFocusId) as HTMLElement | null;
        if (el) {
          el.focus();
          if ("select" in el && typeof (el as any).select === "function") {
            (el as any).select();
          }
          return;
        }
      }

      // 2. Genel arama: Mevcut form veya tab içinde sıradaki aktif input/select'i bul
      if (inputRef.current) {
        const root =
          inputRef.current.closest("form") ||
          inputRef.current.closest(".tab-pane") ||
          document.body;
        const focusableSelector =
          'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])';
        const allFocusables = Array.from(root.querySelectorAll(focusableSelector)) as HTMLElement[];
        const currentIndex = allFocusables.indexOf(inputRef.current);
        if (currentIndex !== -1 && currentIndex < allFocusables.length - 1) {
          const nextEl = allFocusables[currentIndex + 1];
          nextEl.focus();
          if ("select" in nextEl && typeof (nextEl as any).select === "function") {
            (nextEl as any).select();
          }
        }
      }
    };

    // Modal kapanma animasyonunu (fade) bekleyerek iki aşamada odaklan
    setTimeout(doFocus, 80);
    setTimeout(doFocus, 180);
    if (onAfterSelect) {
      setTimeout(onAfterSelect, 100);
    }
  };

  // Dışarıdan gelen value veya items değiştikçe inputText'i güncelle
  useEffect(() => {
    if (value !== null && value !== undefined && (value as any) !== "") {
      const match = items.find((x) => x.id === value || Number(x.id) === Number(value));
      if (match) {
        setInputText(match.ad || "");
      } else {
        // Eğer listede henüz görünmüyorsa boşaltma, mevcut metni koru
      }
    } else {
      setInputText("");
    }
  }, [value, items]);

  // Metin kutusunda değişiklik
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (!val.trim()) {
      onChange(null);
    }
  };

  // Klavyeden Enter'a basıldığında arama ve seçim
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const term = inputText.trim();

      if (!term) {
        setModalInitialSearch("");
        setShowLookupModal(true);
        return;
      }

      const norm = normalizeTr(term);
      const matches = items.filter(
        (it) =>
          normalizeTr(it.ad || "").includes(norm) ||
          (it.kod ? normalizeTr(it.kod).includes(norm) : false)
      );

      if (matches.length === 1) {
        // Tek kayıt var ise doğrudan seç ve sonraki alana odaklan
        const single = matches[0];
        onChange(single.id);
        setInputText(single.ad);
        focusNext();
      } else {
        // Birden fazla ise veya uyuşan yok ise modalı açıp aranan uyuşanları göster
        setModalInitialSearch(term);
        setShowLookupModal(true);
      }
    } else if (e.key === "F3" || e.key === "F4") {
      e.preventDefault();
      e.stopPropagation();
      setModalInitialSearch(inputText.trim());
      setShowLookupModal(true);
    }
  };

  // Odak kaybedildiğinde kontrol
  const handleBlur = () => {
    const term = inputText.trim();
    if (!term) {
      onChange(null);
      return;
    }
    // Eğer yazılan metin listedeki bir elemanla tam eşleşiyorsa seç
    const exactMatch = items.find(
      (it) => normalizeTr(it.ad || "") === normalizeTr(term)
    );
    if (exactMatch) {
      onChange(exactMatch.id);
      setInputText(exactMatch.ad);
    } else {
      // Eğer geçerli bir seçim varsa geri onun adına dön
      const currentSelected = items.find(
        (x) => x.id === value || Number(x.id) === Number(value)
      );
      if (currentSelected) {
        setInputText(currentSelected.ad);
      }
    }
  };

  // Dürbün butonuna tıklandığında
  const handleDurbunClick = () => {
    setModalInitialSearch(inputText.trim());
    setShowLookupModal(true);
  };

  // Yeni Kayıt Kaydetme
  const handleSaveNewRecord = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newRecordAd.trim()) {
      setAddModalError(`Lütfen ${label.toLowerCase()} adı giriniz.`);
      return;
    }

    setIsSavingNewRecord(true);
    setAddModalError(null);
    try {
      const cleanAd = newRecordAd.trim();
      const cleanKod = newRecordKod.trim() ? newRecordKod.trim() : null;

      const saved = await CariService.saveTabloMaddesi({
        tur,
        ad: cleanAd,
        kod: cleanKod,
      });

      // Lookups listesini sunucudan taze çek
      await onRefreshLookups();

      // Yeni eklenen kaydı otomatik seç
      onChange(saved.id);
      setInputText(saved.ad);

      setShowAddModal(false);
      setShowLookupModal(false);
      focusNext();

      if (onSuccessMessage) {
        onSuccessMessage(`Yeni ${label} (${saved.ad}) başarıyla eklendi ve seçildi.`);
      }
    } catch (err: any) {
      const errMsg = err?.message || "Kayıt eklenirken bir hata oluştu.";
      setAddModalError(errMsg);
      if (onErrorMessage) onErrorMessage(errMsg);
    } finally {
      setIsSavingNewRecord(false);
    }
  };

  const defaultColumns: LookupColumn<LookupItem>[] = [
    {
      header: "Kod",
      width: "110px",
      render: (it) => (
        <span className="font-monospace text-muted">{it.kod || "-"}</span>
      ),
    },
    {
      header: `${label} Adı`,
      render: (it) => <strong>{it.ad}</strong>,
    },
  ];

  return (
    <>
      <InputGroup className="w-100">
        <Form.Control
          ref={inputRef}
          id={id}
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder || `${label} seçiniz veya yazıp Enter'a basınız...`}
          autoComplete="off"
        />
        <Button
          variant="outline-secondary"
          type="button"
          disabled={disabled}
          onClick={handleDurbunClick}
          title={`${label} Seç (Dürbün)`}
          aria-label={`${label} Seç`}
          className="d-flex align-items-center justify-content-center px-2.5 bg-light border-start-0"
          style={{ borderColor: "#ced4da" }}
        >
          {/* Oklu Dürbün İkonu */}
          <span className="d-inline-flex align-items-center gap-1 text-primary">
            <IconBinoculars size={16} strokeWidth={2} />
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </span>
        </Button>
      </InputGroup>

      {/* Arama ve Seçim Modalı */}
      <LookupModal<LookupItem>
        show={showLookupModal}
        onHide={() => setShowLookupModal(false)}
        title={`${label} Seç`}
        items={items}
        initialSearchTerm={modalInitialSearch}
        searchPlaceholder={`${label} adı veya kodu ile arayın...`}
        filterFn={(it, term) => {
          const norm = normalizeTr(term);
          return (
            normalizeTr(it.ad || "").includes(norm) ||
            (it.kod ? normalizeTr(it.kod).includes(norm) : false)
          );
        }}
        columns={columns || defaultColumns}
        selectedId={value}
        onSelect={(it) => {
          onChange(it.id);
          setInputText(it.ad);
          setShowLookupModal(false);
          focusNext();
        }}
        onAddNew={() => {
          setNewRecordAd(modalInitialSearch || inputText || "");
          setNewRecordKod("");
          setAddModalError(null);
          setShowAddModal(true);
        }}
        addNewLabel="Yeni Kayıt"
      />

      {/* Yeni Kayıt Ekleme Alt Modalı */}
      <Modal
        show={showAddModal}
        onHide={() => !isSavingNewRecord && setShowAddModal(false)}
        centered
        size="sm"
      >
        <Modal.Header closeButton={!isSavingNewRecord}>
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconPlus size={18} className="text-success" />
            Yeni {label} Ekle
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSaveNewRecord}>
          <Modal.Body className="py-3">
            {addModalError && (
              <div className="alert alert-danger py-1 px-2 small mb-3">
                {addModalError}
              </div>
            )}
            <Form.Group className="mb-2">
              <Form.Label className="small fw-semibold text-secondary mb-1">
                {label} Adı <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                type="text"
                autoFocus
                placeholder={`${label} adını giriniz...`}
                value={newRecordAd}
                onChange={(e) => setNewRecordAd(e.target.value)}
                disabled={isSavingNewRecord}
              />
            </Form.Group>
            <Form.Group className="mb-1">
              <Form.Label className="small fw-semibold text-secondary mb-1">
                Kodu (İsteğe Bağlı)
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="Kod..."
                value={newRecordKod}
                onChange={(e) => setNewRecordKod(e.target.value)}
                disabled={isSavingNewRecord}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer className="py-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setShowAddModal(false)}
              disabled={isSavingNewRecord}
            >
              <IconX size={14} className="me-1" />
              Vazgeç
            </Button>
            <Button
              variant="success"
              size="sm"
              type="submit"
              disabled={isSavingNewRecord || !newRecordAd.trim()}
            >
              {isSavingNewRecord ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <IconCheck size={14} className="me-1" />
                  Kaydet
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
};

export default LookupDurbunSelect;

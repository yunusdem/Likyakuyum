import React, { useState, useEffect } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Badge,
  Alert,
  Spinner,
  Modal,
  InputGroup,
} from "react-bootstrap";
import {
  IconNumbers,
  IconSearch,
  IconCheck,
  IconAlertCircle,
  IconTrash,
  IconAdjustments,
  IconChevronUp,
  IconChevronDown,
  IconPrinter,
  IconSparkles,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal from "../../components/common/LookupModal";
import { printReportTable } from "../../utils/printReport";
import {
  NumeratorService,
  NumeratorItem,
  NumeratorFormData,
} from "../../services/numeratorService";

import { PrinterService, YaziciItem } from "../../services/printerService";


const initialFormState: NumeratorFormData = {
  tur: 0,
  yaziciId: null,
  onek: "",
  baslangic: "" as any,
  bitis: "" as any,
  uzunluk: "" as any,
  onuneSifirKoy: true,
};

const TUR_OPTIONS: { [key: number]: string } = {
  0: "0 - Döviz Alış Fişi",
  1: "1 - Döviz Satış Fişi",
  2: "2 - Efektif Alış Fişi",
  3: "3 - Efektif Satış Fişi",
  4: "4 - Sarrafiye / Altın Alış Fişi",
  5: "5 - Sarrafiye / Altın Satış Fişi",
  10: "10 - Tediye Makbuzu / Genel Fiş",
  11: "11 - Tahsilat Makbuzu",
  12: "12 - Virman Fişi",
  14: "14 - Kasa Alış Fişi",
  18: "18 - Kasa Satış Fişi",
  20: "20 - Genel Sarraf Fişi",
};

export const NumeratorDefinitionsPage: React.FC = () => {
  const activeDb = localStorage.getItem("kuyumcu_erp_active_db") || "R2016_dvz";
  const activeServer = localStorage.getItem("kuyumcu_erp_active_server") || "localhost";

  // Data states
  const [numerators, setNumerators] = useState<NumeratorItem[]>([]);
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedNumerator, setSelectedNumerator] = useState<NumeratorItem | null>(null);
  const [formData, setFormData] = useState<NumeratorFormData>(initialFormState);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  // UI / Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedTurFilter, setSelectedTurFilter] = useState<string>("all");
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showRecordLookupModal, setShowRecordLookupModal] = useState<boolean>(false);
  const [showOnekLookupModal, setShowOnekLookupModal] = useState<boolean>(false);

  // Load all numerators and printers
  const loadData = async (targetTur?: number, targetYaziciId?: number | null) => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const [numList, prnList] = await Promise.all([
        NumeratorService.getNumerators(),
        PrinterService.getYazicilar().catch(() => []),
      ]);

      const list = numList || [];
      setNumerators(list);
      setPrinters(prnList || []);

      if (list.length > 0) {
        let idx = 0;
        if (targetTur !== undefined) {
          const foundIdx = list.findIndex(
            (n) => Number(n.tur) === Number(targetTur) && (n.yaziciId ?? null) === (targetYaziciId ?? null)
          );
          if (foundIdx !== -1) idx = foundIdx;
        }
        setSelectedIndex(idx);
        handleSelectNumerator(list[idx], idx);
      } else {
        handleClear(false);
      }
    } catch (err: any) {
      setAlertError(err.message || "Numaratör tanımları yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectNumerator = (item: NumeratorItem, idx?: number) => {
    setSelectedNumerator(item);
    if (idx !== undefined) {
      setSelectedIndex(idx);
    } else {
      const foundIdx = numerators.findIndex((n) => n.id === item.id);
      if (foundIdx !== -1) setSelectedIndex(foundIdx);
    }
    setIsNewRecord(false);
    setFormData({
      tur: Number(item.tur),
      yaziciId: item.yaziciId !== null && item.yaziciId !== undefined ? Number(item.yaziciId) : null,
      yaziciOrtakAlan: item.yaziciId === null,
      onek: item.onek || "",
      baslangic: item.baslangic,
      bitis: item.bitis,
      uzunluk: item.uzunluk,
      onuneSifirKoy: item.onuneSifirKoy !== false,
    });
    setAlertError(null);
  };

  const handleClear = (showAlert: boolean = true) => {
    setSelectedNumerator(null);
    setIsNewRecord(true);
    setSelectedIndex(-1);
    setFormData({
      ...initialFormState,
      tur: 0,
      yaziciId: null,
      yaziciOrtakAlan: true,
      onek: "",
      baslangic: 1,
      bitis: 0,
      uzunluk: 10,
      onuneSifirKoy: true,
    });
    if (showAlert) {
      setAlertSuccess("Form alanları temizlendi. Yeni bilgileri girip 'Kaydet' butonuna basınız.");
      setTimeout(() => setAlertSuccess(null), 3500);
    }
    setAlertError(null);
  };

  const handleNewNumerator = () => {
    // Listede henüz tanımlanmamış ilk Belge Türünü önerelim
    const usedTurs = new Set(numerators.map((n) => Number(n.tur)));
    const firstAvailableTurStr = Object.keys(TUR_OPTIONS).find((t) => !usedTurs.has(parseInt(t, 10)));
    const nextTur = firstAvailableTurStr !== undefined ? parseInt(firstAvailableTurStr, 10) : 0;

    setSelectedNumerator(null);
    setIsNewRecord(true);
    setSelectedIndex(-1);
    setFormData({
      tur: nextTur,
      yaziciId: null,
      yaziciOrtakAlan: true,
      onek: "",
      baslangic: 1,
      bitis: 0,
      uzunluk: 10,
      onuneSifirKoy: true,
    });
    setAlertError(null);
    setAlertSuccess(`Yeni kayıt modu: ${TUR_OPTIONS[nextTur] || `Tür ${nextTur}`} seçildi. Bilgileri girip 'Kaydet' butonuna basınız.`);
    setTimeout(() => setAlertSuccess(null), 3500);
  };

  // Belge Türü veya Bağlı Yazıcı değiştiğinde mevcut kaydı veya yeni kayıt modunu ayarlar
  const handleTurOrYaziciChange = (newTur: number, newYaziciId: number | null) => {
    const cleanTur = Number(newTur);
    const cleanYaziciId =
      newYaziciId !== null && newYaziciId !== undefined && !isNaN(Number(newYaziciId))
        ? Number(newYaziciId)
        : null;

    const exactMatch = numerators.find(
      (n) => Number(n.tur) === cleanTur && (n.yaziciId ?? null) === cleanYaziciId
    );

    if (exactMatch && !isNewRecord) {
      // Düzenleme modundayken listede varsa o kaydı getir
      handleSelectNumerator(exactMatch);
    } else if (exactMatch && isNewRecord) {
      // Yeni kayıt modundayken zaten veritabanında var olan bir türe geçilirse uyar ve düzenleme moduna al
      handleSelectNumerator(exactMatch);
      const turLabel = TUR_OPTIONS[cleanTur] || `Tür ${cleanTur}`;
      setAlertSuccess(`ℹ️ [${turLabel}] tanımı zaten veritabanında mevcut. Düzenleme moduna alındı.`);
      setTimeout(() => setAlertSuccess(null), 3500);
    } else {
      // Listede bu tür yok -> Tamamen YENİ bir kayıt oluşturma moduna geç
      setSelectedNumerator(null);
      setIsNewRecord(true);
      setSelectedIndex(-1);
      setFormData((prev) => ({
        ...prev,
        tur: cleanTur,
        yaziciId: cleanYaziciId,
        yaziciOrtakAlan: cleanYaziciId === null,
        onek: isNewRecord ? prev.onek : "",
        baslangic: isNewRecord && prev.baslangic ? prev.baslangic : 1,
        bitis: isNewRecord && prev.bitis !== undefined ? prev.bitis : 0,
        uzunluk: prev.uzunluk || 10,
        onuneSifirKoy: prev.onuneSifirKoy ?? true,
      }));
      const turLabel = TUR_OPTIONS[cleanTur] || `Tür ${cleanTur}`;
      setAlertSuccess(`Yeni Kayıt Modu: ${turLabel} için henüz tanım yok. Değerleri girip 'Kaydet' butonuna basınız.`);
      setTimeout(() => setAlertSuccess(null), 3500);
    }
  };

  const handleNavigate = (direction: "first" | "prev" | "next" | "last") => {
    if (numerators.length === 0) return;
    let newIdx = selectedIndex >= 0 ? selectedIndex : 0;
    if (direction === "first") newIdx = 0;
    else if (direction === "prev") newIdx = Math.max(0, newIdx - 1);
    else if (direction === "next") newIdx = Math.min(numerators.length - 1, newIdx + 1);
    else if (direction === "last") newIdx = numerators.length - 1;

    setSelectedIndex(newIdx);
    handleSelectNumerator(numerators[newIdx], newIdx);
  };

  const handleInputChange = (field: keyof NumeratorFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Canlı numara formatı hesaplama fonksiyonu (Ön Ek, Sıfır Doldurma, Hane Uzunluğu ve Numara)
  const formatNumara = (
    numVal: number | string | undefined | null,
    prefix: string,
    totalLen: number,
    onuneSifirKoy: boolean
  ): string => {
    const cleanPrefix = (prefix || "").trim();
    const parsedNum =
      numVal === "" || numVal === null || numVal === undefined
        ? 1
        : parseInt(String(numVal), 10);
    const safeNum = isNaN(parsedNum) ? 1 : Math.max(0, parsedNum);
    const numStr = String(safeNum);

    if (!onuneSifirKoy || totalLen <= cleanPrefix.length) {
      return `${cleanPrefix}${numStr}`;
    }

    const remaining = Math.max(1, totalLen - cleanPrefix.length);
    const padded = numStr.padStart(remaining, "0");
    return `${cleanPrefix}${padded}`;
  };

  const totalLen = Math.max(1, parseInt(String(formData.uzunluk), 10) || 10);
  const previewNumara = formatNumara(formData.baslangic, formData.onek, totalLen, formData.onuneSifirKoy);

  // Stored procedure (dbo.SODVZ_NUMERATOR_KAYDET) çağrısı ile kaydetme işlemi
  const handleSave = async () => {
    setAlertError(null);

    const cleanTur = parseInt(String(formData.tur), 10);
    if (isNaN(cleanTur)) {
      setAlertError("⚠️ Zorunlu Alan Eksik: Lütfen Belge / İşlem Türünü seçiniz.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const yaziciId =
      formData.yaziciId !== null &&
      formData.yaziciId !== undefined &&
      String(formData.yaziciId) !== "" &&
      !isNaN(parseInt(String(formData.yaziciId), 10))
        ? parseInt(String(formData.yaziciId), 10)
        : null;

    const payload: NumeratorFormData = {
      tur: cleanTur,
      yaziciId,
      yaziciOrtakAlan: yaziciId === null,
      onek: (formData.onek || "").trim(),
      baslangic: parseInt(String(formData.baslangic), 10) || 0,
      bitis: parseInt(String(formData.bitis), 10) || 0,
      uzunluk: Math.max(1, parseInt(String(formData.uzunluk), 10) || 10),
      onuneSifirKoy: formData.onuneSifirKoy !== false,
    };

    try {
      setIsSaving(true);
      setAlertError(null);

      // dbo.SODVZ_NUMERATOR_KAYDET prosedürü çağrılır (kayıt varsa UPDATE, yoksa INSERT)
      const saved = await NumeratorService.saveNumerator(payload);
      const turLabel = TUR_OPTIONS[saved.tur] || `Tür ${saved.tur}`;
      setAlertSuccess(`✅ [${turLabel}] ${saved.onek || "Numaratör"} tanımı başarıyla kaydedildi.`);

      await loadData(saved.tur, saved.yaziciId);
      setTimeout(() => setAlertSuccess(null), 4500);
    } catch (err: any) {
      setAlertError(`❌ Kaydetme Başarısız: ${err.message || "İşlem sırasında bir hata oluştu."}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedNumerator || isNewRecord) return;
    try {
      setIsSaving(true);
      setShowDeleteModal(false);
      await NumeratorService.deleteNumerator(selectedNumerator.id);
      setAlertSuccess(`✅ [Tür ${selectedNumerator.tur}] ${selectedNumerator.onek || "Numaratör"} tanımı başarıyla silindi.`);
      await loadData();
      setTimeout(() => setAlertSuccess(null), 4000);
    } catch (err: any) {
      setAlertError(`❌ Silme Başarısız: ${err.message || "Numaratör tanımı silinirken bir hata oluştu."}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered numerators list
  const filteredNumerators = numerators.filter((n) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (n.onek && n.onek.toLowerCase().includes(term)) ||
      String(n.tur).includes(term) ||
      (n.yaziciAdi && n.yaziciAdi.toLowerCase().includes(term)) ||
      (TUR_OPTIONS[n.tur] && TUR_OPTIONS[n.tur].toLowerCase().includes(term));

    if (!matchesSearch) return false;
    if (selectedTurFilter === "all") return true;
    return n.tur === parseInt(selectedTurFilter, 10);
  });

  const handlePrint = () => {
    printReportTable<NumeratorItem>({
      title: "Numaratör Tanımları Listesi Raporu",
      subtitle: `Aktif Numaratör Formatları Dökümü (${filteredNumerators.length} Kayıt)`,
      data: filteredNumerators,
      columns: [
        { header: "Ön Ek", key: "onek", width: "14%", align: "center" },
        {
          header: "Numaratör Türü",
          render: (item) => (item.tur === 0 ? "0 - Fiş Numaratörü" : item.tur === 1 ? "1 - Belge Numaratörü" : `${item.tur} - Numaratör`),
          width: "24%",
        },
        { header: "Başlangıç / Son No", key: "baslangic", width: "16%", align: "right" },
        { header: "Bitiş No", key: "bitis", width: "16%", align: "right" },
        { header: "Hane Uzunluğu", key: "uzunluk", width: "14%", align: "center" },
        {
          header: "Bağlı Yazıcı",
          render: (item) => (item.yaziciId ? `Yazıcı ID: ${item.yaziciId}` : "Tüm Yazıcılar"),
          width: "16%",
        },
      ],
      summaryInfo: `Toplam Numaratör Tanımı: ${filteredNumerators.length}`,
    });
  };

  return (
    <div className="p-2 p-md-3">
      {/* 1. Sol Üst Klasik ERP Toolbar */}
      <ERPToolbar
        pageTitle="Numaratör Tanımları"
        pageIcon={<IconNumbers size={20} />}
        onNew={handleNewNumerator}
        onSave={handleSave}
        onSearch={() => setShowRecordLookupModal(true)}
        onDelete={() => {
          if (selectedNumerator && !isNewRecord) {
            setShowDeleteModal(true);
          }
        }}
        onFirst={() => handleNavigate("first")}
        onPrev={() => handleNavigate("prev")}
        onNext={() => handleNavigate("next")}
        onLast={() => handleNavigate("last")}
        onPrint={handlePrint}
        onRefresh={() => loadData(selectedIndex)}
        onClear={handleClear}
        disabled={isLoading || isSaving}
      />

      {/* Notifications */}
      {alertSuccess && (
        <Alert variant="success" className="d-flex align-items-center gap-2 py-2 mb-3 shadow-sm border-0" dismissible onClose={() => setAlertSuccess(null)}>
          <IconCheck size={18} />
          <span>{alertSuccess}</span>
        </Alert>
      )}

      {alertError && (
        <Alert variant="danger" className="d-flex align-items-center gap-2 py-2 mb-3 shadow-sm border-0" dismissible onClose={() => setAlertError(null)}>
          <IconAlertCircle size={18} />
          <span>{alertError}</span>
        </Alert>
      )}

      {/* 2. Main Container Card (Tam Genişlik, Liste Kaldırıldı, Yatay Inputlar) */}
      <Card className="border-0 shadow-sm rounded-3 mb-4 bg-white">
        <Card.Body className="p-3 p-md-4">
          <div className="mb-3 pb-2 border-bottom d-flex align-items-center justify-content-end flex-wrap gap-2">
            <Badge bg={isNewRecord ? "warning" : "primary"} className="px-2.5 py-1.5 fs-7">
              {isNewRecord
                ? `Yeni Kayıt Modu [${TUR_OPTIONS[formData.tur] || `Tür ${formData.tur}`}]`
                : `Düzenleme Modu [${TUR_OPTIONS[formData.tur] || `Tür ${formData.tur}`}] (${formData.onek || "Ön Ek Yok"})`}
            </Badge>
          </div>

          <div className="mx-auto" style={{ maxWidth: "850px" }}>
            <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              {/* 1. Canlı Numara Önizleme Kartı */}
              <div className="p-3 mb-4 rounded-3 border bg-light shadow-2xs">
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                  <span className="small text-secondary fw-semibold d-flex align-items-center gap-1">
                    <IconSparkles size={16} className="text-warning" /> Canlı Numara Formatı Önizlemesi:
                  </span>
                  <span className="small text-muted" style={{ fontSize: "0.75rem" }}>
                    Toplam {formData.uzunluk} hane {formData.onuneSifirKoy ? "(Önüne Sıfır Doldurmalı)" : "(Serbest Boyut)"}
                  </span>
                </div>

                <h4
                  className="fw-bold text-primary font-monospace mb-0"
                  style={{
                    wordBreak: "break-all",
                    overflowWrap: "anywhere",
                    lineHeight: 1.4,
                  }}
                >
                  {previewNumara}
                </h4>
              </div>

              {/* Yatay Form Alanları: Solda Etiket, Sağda Input */}
              <div className="border rounded-3 p-3 p-md-4 bg-white shadow-2xs mb-3">
                {/* Belge Türü */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Belge / İşlem Türü <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Select
                      value={String(formData.tur)}
                      onChange={(e) => {
                        const newTur = parseInt(e.target.value, 10);
                        handleTurOrYaziciChange(newTur, formData.yaziciId);
                      }}
                      className="fw-bold text-primary"
                    >
                      {Object.entries(TUR_OPTIONS).map(([val, label]) => (
                        <option key={val} value={String(val)}>
                          {label}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Bağlı Yazıcı */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Bağlı Yazıcı :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Select
                      value={formData.yaziciId !== null && formData.yaziciId !== undefined ? String(formData.yaziciId) : ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newYaziciId = val !== "" && !isNaN(parseInt(val, 10)) ? parseInt(val, 10) : null;
                        handleTurOrYaziciChange(formData.tur, newYaziciId);
                      }}
                    >
                      <option value="">Tüm Yazıcılar (Genel / NULL)</option>
                      {printers.map((p) => (
                        <option key={p.id} value={String(p.id)}>
                          [{p.siraNo}] {p.ad} {p.cihazAdi ? `(${p.cihazAdi})` : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Col>
                </Form.Group>

                {/* Ön Ek (ONEK) - Oklu Dürbünlü Kod Alma Inputu */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Ön Ek :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <CodeLookupInput
                      value={formData.onek}
                      maxLength={50}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleInputChange("onek", e.target.value)}
                      onLookupClick={() => setShowOnekLookupModal(true)}
                      lookupTitle="Tanımlı Numaratörlerden Ön Ek Seç (Oklu Dürbün)"
                    />
                  </Col>
                </Form.Group>

                {/* Başlangıç / Son No */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Başlangıç / Son No <span className="text-danger">*</span> :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <InputGroup>
                      <Form.Control
                        type="text"
                        inputMode="numeric"
                        value={formData.baslangic || ""}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          handleInputChange("baslangic", val === "" ? "" : parseInt(val, 10));
                        }}
                        onBlur={() => {
                          const parsed = parseInt(String(formData.baslangic), 10);
                          handleInputChange("baslangic", isNaN(parsed) ? 1 : parsed);
                        }}
                        className="fw-bold font-monospace"
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2.5"
                        onClick={() => {
                          const current = parseInt(String(formData.baslangic), 10) || 0;
                          handleInputChange("baslangic", Math.max(0, current - 1));
                        }}
                        type="button"
                      >
                        <IconChevronDown size={15} />
                      </Button>
                      <Button
                        variant="outline-secondary"
                        className="px-2.5"
                        onClick={() => {
                          const current = parseInt(String(formData.baslangic), 10) || 0;
                          handleInputChange("baslangic", current + 1);
                        }}
                        type="button"
                      >
                        <IconChevronUp size={15} />
                      </Button>
                    </InputGroup>
                  </Col>
                </Form.Group>

                {/* Bitiş No */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Bitiş No :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Control
                      type="text"
                      inputMode="numeric"
                      value={formData.bitis || ""}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        handleInputChange("bitis", val === "" ? "" : parseInt(val, 10));
                      }}
                      onBlur={() => {
                        const parsed = parseInt(String(formData.bitis), 10);
                        handleInputChange("bitis", isNaN(parsed) ? 0 : parsed);
                      }}
                      className="fw-bold font-monospace"
                    />
                  </Col>
                </Form.Group>

                {/* Toplam Hane Uzunluğu */}
                <Form.Group as={Row} className="mb-3 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Hane Uzunluğu :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <InputGroup>
                      <Form.Control
                        type="text"
                        inputMode="numeric"
                        value={formData.uzunluk === 0 ? "10" : formData.uzunluk}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          handleInputChange("uzunluk", val === "" ? "" : parseInt(val, 10));
                        }}
                        onBlur={() => {
                          const parsed = parseInt(String(formData.uzunluk), 10);
                          handleInputChange("uzunluk", isNaN(parsed) || parsed < 1 ? 10 : parsed);
                        }}
                        className="fw-bold font-monospace"
                      />
                      <Button
                        variant="outline-secondary"
                        className="px-2.5"
                        onClick={() => {
                          const current = parseInt(String(formData.uzunluk), 10) || 10;
                          handleInputChange("uzunluk", Math.max(1, current - 1));
                        }}
                        type="button"
                      >
                        <IconChevronDown size={15} />
                      </Button>
                      <Button
                        variant="outline-secondary"
                        className="px-2.5"
                        onClick={() => {
                          const current = parseInt(String(formData.uzunluk), 10) || 10;
                          handleInputChange("uzunluk", current + 1);
                        }}
                        type="button"
                      >
                        <IconChevronUp size={15} />
                      </Button>
                    </InputGroup>
                  </Col>
                </Form.Group>

                {/* Önüne Sıfır Doldur */}
                <Form.Group as={Row} className="mb-2 align-items-center">
                  <Form.Label column sm={4} md={3} className="text-secondary fw-semibold text-sm-end pe-3 mb-0">
                    Önüne Sıfır Doldur :
                  </Form.Label>
                  <Col sm={8} md={9}>
                    <Form.Check
                      type="switch"
                      id="onune-sifir-koy-switch"
                      label={
                        <span className="small text-muted">
                          {formData.onuneSifirKoy ? "Numara hane sayısına kadar sıfırlarla tamamlanır." : "Numara sıfır eklenmeden olduğu gibi yazılır."}
                        </span>
                      }
                      checked={formData.onuneSifirKoy}
                      onChange={(e) => handleInputChange("onuneSifirKoy", e.target.checked)}
                    />
                  </Col>
                </Form.Group>
              </div>
            </Form>
          </div>
        </Card.Body>
      </Card>

      {/* 1. Toolbar Kayıt Arama & Seçme Modalı (F3) */}
      <LookupModal<NumeratorItem>
        show={showRecordLookupModal}
        onHide={() => setShowRecordLookupModal(false)}
        title="Numaratör Tanımı Seçimi"
        searchPlaceholder="Ön ek veya tür ile ara..."
        items={numerators}
        isLoading={isLoading}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          const turName = TUR_OPTIONS[item.tur]?.toLowerCase() || "";
          return item.onek.toLowerCase().includes(t) || turName.includes(t);
        }}
        columns={[
          {
            header: "Ön Ek",
            width: "120px",
            render: (n) => <span className="badge bg-light text-dark border font-monospace fw-bold">{n.onek || "-"}</span>,
          },
          {
            header: "Belge / İşlem Türü",
            render: (n) => TUR_OPTIONS[n.tur] || `Tür ${n.tur}`,
          },
          {
            header: "Son No",
            width: "100px",
            align: "right",
            render: (n) => <span className="font-monospace">{n.baslangic}</span>,
          },
          {
            header: "Bitiş",
            width: "80px",
            align: "right",
            render: (n) => <span className="font-monospace">{n.bitis === 0 ? "Limitsiz" : n.bitis}</span>,
          },
          {
            header: "Hane",
            width: "70px",
            align: "center",
            render: (n) => n.uzunluk,
          },
        ]}
        onSelect={(n) => {
          const foundIdx = numerators.findIndex((item) => item.id === n.id);
          handleSelectNumerator(n, foundIdx !== -1 ? foundIdx : 0);
          setShowRecordLookupModal(false);
        }}
      />

      {/* 2. Ön Ek (ONEK) Seçim Modalı (Sadece Ön Ek alanını doldurur, Belge Türünü ASLA değiştirmez) */}
      <LookupModal<NumeratorItem>
        show={showOnekLookupModal}
        onHide={() => setShowOnekLookupModal(false)}
        title="Ön Ek (ONEK) Seçimi"
        searchPlaceholder="Ön ek veya tür ile ara..."
        items={numerators}
        isLoading={isLoading}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          const turName = TUR_OPTIONS[item.tur]?.toLowerCase() || "";
          return item.onek.toLowerCase().includes(t) || turName.includes(t);
        }}
        columns={[
          {
            header: "Ön Ek",
            width: "120px",
            render: (n) => <span className="badge bg-primary text-white border font-monospace fw-bold">{n.onek || "-"}</span>,
          },
          {
            header: "Belge / İşlem Türü",
            render: (n) => TUR_OPTIONS[n.tur] || `Tür ${n.tur}`,
          },
          {
            header: "Hane",
            width: "70px",
            align: "center",
            render: (n) => n.uzunluk,
          },
        ]}
        onSelect={(n) => {
          handleInputChange("onek", n.onek || "");
          setShowOnekLookupModal(false);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-5 text-danger d-flex align-items-center gap-2">
            <IconTrash size={20} /> Numaratör Tanımı Silme Onayı
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>[{TUR_OPTIONS[selectedNumerator?.tur || 0] || `Tür ${selectedNumerator?.tur}`}] {selectedNumerator?.onek || "(Ön Ek Yok)"}</strong> numaratör tanımını veritabanından kalıcı olarak silmek istediğinize emin misiniz?
          </p>
          <p className="small text-danger mb-0">
            ⚠️ Bu işlem geri alınamaz.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowDeleteModal(false)}>
            İptal
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} disabled={isSaving}>
            {isSaving ? "Siliniyor..." : "Evet, Tanımı Sil"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default NumeratorDefinitionsPage;

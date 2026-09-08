import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Table,
  Badge,
  Modal,
  Alert,
  InputGroup,
  FormCheck,
} from "react-bootstrap";
import {
  IconDeviceTv,
  IconCheck,
  IconX,
  IconPlus,
  IconTrash,
  IconSearch,
  IconPalette,
  IconTypography,
  IconFolderOpen,
  IconArrowUp,
  IconArrowDown,
  IconRefresh,
  IconCopy,
  IconExternalLink,
  IconGripVertical,
  IconBinoculars,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal from "../../components/common/LookupModal";
import { PanoService, PanoModel, PanoSatiriModel, SavePanoPayload } from "../../services/panoService";
import { ProductDefinitionService, ProductItem } from "../../services/productDefinitionService";
import { FontSelectDropdown } from "../settings/UserDefinitionsPage";
import { useAuth } from "../../context/AuthContext";

interface StyleProperties {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  color: string;
  bgColor: string;
}

const parseStyleString = (styleStr: string): StyleProperties => {
  const defaults: StyleProperties = {
    fontFamily: "Inter, sans-serif",
    fontSize: 16,
    bold: false,
    color: "#ffffff",
    bgColor: "transparent",
  };
  if (!styleStr) return defaults;
  try {
    const parts = styleStr.split(";");
    const result = { ...defaults };
    parts.forEach((part) => {
      const [key, val] = part.split(":");
      if (!key || !val) return;
      const cleanKey = key.trim();
      const cleanVal = val.trim();
      if (cleanKey === "font") result.fontFamily = cleanVal;
      if (cleanKey === "size") result.fontSize = Number(cleanVal) || 16;
      if (cleanKey === "bold") result.bold = cleanVal === "1" || cleanVal === "true";
      if (cleanKey === "color") result.color = cleanVal;
      if (cleanKey === "bgColor") result.bgColor = cleanVal;
    });
    return result;
  } catch {
    return defaults;
  }
};

const serializeStyleString = (prop: StyleProperties): string => {
  return `font:${prop.fontFamily};size:${prop.fontSize};bold:${prop.bold ? 1 : 0};color:${prop.color};bgColor:${prop.bgColor}`;
};

export const PanoTanimiPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // State definitions
  const [panos, setPanos] = useState<PanoModel[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Drag and Drop state for grid rows
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Available currencies from system
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);

  // Auto-save debounce timer ref
  const autoSaveTimeoutRef = useRef<any>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<string | null>(null);

  // Active form data matching procedure parameters
  const [form, setForm] = useState<PanoModel>({
    panoId: 0,
    panoNo: "PANO_01",
    yenilemeAraligi: 5,
    firmaAdi: "",
    paraBasligi: "DÖVİZ",
    alisKuruBasligi: "WE BUY - ALIŞ",
    satisKuruBasligi: "WE SELL - SATIŞ",
    firmaAdiOzellikleri: "font:Outfit, sans-serif;size:24;bold:1;color:#ffffff;bgColor:transparent",
    tarihSaatOzellikleri: "font:Inter, sans-serif;size:14;bold:1;color:#fbbf24;bgColor:transparent",
    baslikOzellikleri: "font:Inter, sans-serif;size:16;bold:1;color:#60a5fa;bgColor:transparent",
    satirOzellikleri: "font:Fira Code, monospace;size:18;bold:1;color:#ffffff;bgColor:transparent",
    zeminRengi: localStorage.getItem("pano_active_theme_bg") || "#0f172a",
    boslukSayisi: 10,
    htmlDosyaAdi: "Pano_Dikey.html",
    kodAlaniGenisligi: 60,
    kurAlaniGenisligi: 40,
    satirlar: [],
  });

  const [useHtmlFile, setUseHtmlFile] = useState<boolean>(true);

  // Modals
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showStyleModal, setShowStyleModal] = useState<boolean>(false);
  const [activeStyleKey, setActiveStyleKey] = useState<
    "firmaAdiOzellikleri" | "tarihSaatOzellikleri" | "baslikOzellikleri" | "satirOzellikleri" | null
  >(null);
  const [activeStyleTitle, setActiveStyleTitle] = useState<string>("");
  const [tempStyle, setTempStyle] = useState<StyleProperties>({
    fontFamily: "Inter, sans-serif",
    fontSize: 16,
    bold: false,
    color: "#ffffff",
    bgColor: "transparent",
  });

  const [showHtmlModal, setShowHtmlModal] = useState<boolean>(false);

  // Load panos and currencies on mount (excluding TL/TRY)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [panoList, prods] = await Promise.all([
        PanoService.getAllPanos().catch(() => []),
        ProductDefinitionService.getProducts().catch(() => []),
      ]);

      // Filter out TL / TRY from available currencies (TL is fixed base currency)
      const nonTlProducts = prods.filter(
        (p) => !["TL", "TRY", "TL.", "YTL", "TRL"].includes((p.kod || "").trim().toUpperCase())
      );
      setAvailableProducts(nonTlProducts);

      if (panoList && panoList.length > 0) {
        const sanitizedPanos = panoList.map((p) => ({
          ...p,
          satirlar: (p.satirlar || []).filter(
            (s) => !["TL", "TRY", "TL.", "YTL", "TRL"].includes((s.kod || "").trim().toUpperCase())
          ),
        }));
        setPanos(sanitizedPanos);
        setCurrentIndex(0);
        setForm(sanitizedPanos[0]);
        setUseHtmlFile(Boolean(sanitizedPanos[0].htmlDosyaAdi));
      } else {
        // Create initial default pano form
        const initialLines: PanoSatiriModel[] = nonTlProducts.slice(0, 8).map((p, idx) => ({
          paraId: p.id,
          kod: p.kod,
          ad: p.ad,
          gorunecekAd: `${p.kod} - ${p.ad}`,
          siraNo: idx + 1,
          gorunur: true,
          carpan: 1.0,
        }));

        const initialBg = localStorage.getItem("pano_active_theme_bg") || "#0f172a";
        const newForm: PanoModel = {
          panoId: 0,
          panoNo: "PANO_01",
          yenilemeAraligi: 5,
          firmaAdi: "",
          paraBasligi: "DÖVİZ",
          alisKuruBasligi: "WE BUY - ALIŞ",
          satisKuruBasligi: "WE SELL - SATIŞ",
          firmaAdiOzellikleri: "font:Outfit, sans-serif;size:24;bold:1;color:#ffffff;bgColor:transparent",
          tarihSaatOzellikleri: "font:Inter, sans-serif;size:14;bold:1;color:#fbbf24;bgColor:transparent",
          baslikOzellikleri: "font:Inter, sans-serif;size:16;bold:1;color:#38bdf8;bgColor:transparent",
          satirOzellikleri: "font:Fira Code, monospace;size:18;bold:1;color:#ffffff;bgColor:transparent",
          zeminRengi: initialBg,
          boslukSayisi: 10,
          htmlDosyaAdi: "Pano_Dikey.html",
          kodAlaniGenisligi: 60,
          kurAlaniGenisligi: 40,
          satirlar: initialLines,
        };

        setForm(newForm);
      }
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: "Veriler yüklenirken hata oluştu: " + (err?.message || err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate between loaded panos
  const selectPano = (pano: PanoModel, index: number) => {
    setCurrentIndex(index);
    setForm(pano);
    setUseHtmlFile(Boolean(pano.htmlDosyaAdi));
  };

  const handleFirst = () => {
    if (panos.length > 0) selectPano(panos[0], 0);
  };

  const handlePrev = () => {
    if (currentIndex > 0) selectPano(panos[currentIndex - 1], currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < panos.length - 1) selectPano(panos[currentIndex + 1], currentIndex + 1);
  };

  const handleLast = () => {
    if (panos.length > 0) selectPano(panos[panos.length - 1], panos.length - 1);
  };

  // Auto-save appearance changes (Zemin Rengi, Font/Stil özellikleri)
  const autoSaveAppearance = useCallback((updates: Partial<PanoModel>) => {
    setForm((prev) => {
      const merged = { ...prev, ...updates };

      // 1. Immediately store in localStorage so PanoPage syncs instantly
      if (merged.zeminRengi) {
        localStorage.setItem("pano_active_theme_bg", merged.zeminRengi);
      }
      const appearanceData = {
        zeminRengi: merged.zeminRengi,
        firmaAdiOzellikleri: merged.firmaAdiOzellikleri,
        tarihSaatOzellikleri: merged.tarihSaatOzellikleri,
        baslikOzellikleri: merged.baslikOzellikleri,
        satirOzellikleri: merged.satirOzellikleri,
        boslukSayisi: merged.boslukSayisi,
        kodAlaniGenisligi: merged.kodAlaniGenisligi,
        kurAlaniGenisligi: merged.kurAlaniGenisligi,
      };
      localStorage.setItem("pano_appearance_settings", JSON.stringify(appearanceData));

      // 2. Debounced auto-save to backend if pano already exists
      if (merged.panoId && merged.panoId > 0) {
        if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = setTimeout(async () => {
          try {
            await PanoService.savePano({
              panoId: merged.panoId,
              panoNo: merged.panoNo,
              yenilemeAraligi: Number(merged.yenilemeAraligi) || 5,
              firmaAdi: merged.firmaAdi,
              paraBasligi: merged.paraBasligi,
              alisKuruBasligi: merged.alisKuruBasligi,
              satisKuruBasligi: merged.satisKuruBasligi,
              firmaAdiOzellikleri: merged.firmaAdiOzellikleri,
              tarihSaatOzellikleri: merged.tarihSaatOzellikleri,
              baslikOzellikleri: merged.baslikOzellikleri,
              satirOzellikleri: merged.satirOzellikleri,
              zeminRengi: merged.zeminRengi,
              boslukSayisi: Number(merged.boslukSayisi) || 0,
              htmlDosyaAdi: merged.htmlDosyaAdi,
              kodAlaniGenisligi: Number(merged.kodAlaniGenisligi) || 60,
              kurAlaniGenisligi: Number(merged.kurAlaniGenisligi) || 40,
              satirlar: (merged.satirlar || []).map((s, idx) => ({
                paraId: s.paraId,
                gorunecekAd: s.gorunecekAd,
                siraNo: s.siraNo || idx + 1,
                gorunur: s.gorunur,
                carpan: Number(s.carpan) || 1.0,
              })),
            });
            setAutoSaveStatus("Görünüm otomatik kaydedildi");
            setTimeout(() => setAutoSaveStatus(null), 2500);
          } catch (e) {
            console.warn("Auto-save appearance warning:", e);
          }
        }, 600);
      } else {
        setAutoSaveStatus("Görünüm rengi güncellendi");
        setTimeout(() => setAutoSaveStatus(null), 2000);
      }

      return merged;
    });
  }, []);

  // Reset form to new Pano (Tüm her yer temizlenir)
  const handleNew = () => {
    setCurrentIndex(-1);
    setUseHtmlFile(false);
    setForm({
      panoId: 0,
      panoNo: "",
      yenilemeAraligi: 5,
      firmaAdi: "",
      paraBasligi: "DÖVİZ",
      alisKuruBasligi: "ALIŞ",
      satisKuruBasligi: "SATIŞ",
      firmaAdiOzellikleri: "font:Outfit, sans-serif;size:24;bold:1;color:#ffffff;bgColor:transparent",
      tarihSaatOzellikleri: "font:Inter, sans-serif;size:14;bold:1;color:#fbbf24;bgColor:transparent",
      baslikOzellikleri: "font:Inter, sans-serif;size:16;bold:1;color:#38bdf8;bgColor:transparent",
      satirOzellikleri: "font:Fira Code, monospace;size:18;bold:1;color:#ffffff;bgColor:transparent",
      zeminRengi: "#000000",
      boslukSayisi: 0,
      htmlDosyaAdi: "",
      kodAlaniGenisligi: 60,
      kurAlaniGenisligi: 40,
      satirlar: [],
    });
    setAlertInfo({
      type: "warning",
      message: "Yeni kayıt modu: Tüm alanlar temizlendi. Pano No ve bilgileri girip sol üstteki 'Kaydet' butonuna basarak kaydedebilirsiniz.",
    });
  };

  // Save via stored procedure SODVZ_PANO_TANIMI_KAYDET
  const handleSave = async () => {
    if (!form.panoNo || !form.panoNo.trim()) {
      setAlertInfo({ type: "danger", message: "Lütfen geçerli bir Pano No giriniz." });
      return;
    }

    setSaving(true);
    setAlertInfo(null);
    try {
      // Clean and sanitize rows, ensuring SATIR_NO / siraNo are numbers and no TL/TRY
      const sanitizedRows = form.satirlar
        .filter((s) => s.paraId && !["TL", "TRY", "TL.", "YTL", "TRL"].includes((s.kod || "").trim().toUpperCase()))
        .map((s, idx) => ({
          paraId: s.paraId,
          gorunecekAd: s.gorunecekAd || `${s.kod} - ${s.ad}`,
          siraNo: s.siraNo ? Number(s.siraNo) : idx + 1,
          gorunur: s.gorunur !== undefined ? Boolean(s.gorunur) : true,
          carpan: Number(s.carpan) || 1.0,
        }));

      const payload: SavePanoPayload = {
        panoId: form.panoId > 0 ? Number(form.panoId) : null,
        panoNo: form.panoNo.trim(),
        yenilemeAraligi: Number(form.yenilemeAraligi) || 5,
        firmaAdi: form.firmaAdi || "",
        paraBasligi: form.paraBasligi || "DÖVİZ",
        alisKuruBasligi: form.alisKuruBasligi || "ALIŞ",
        satisKuruBasligi: form.satisKuruBasligi || "SATIŞ",
        firmaAdiOzellikleri: form.firmaAdiOzellikleri,
        tarihSaatOzellikleri: form.tarihSaatOzellikleri,
        baslikOzellikleri: form.baslikOzellikleri,
        satirOzellikleri: form.satirOzellikleri,
        zeminRengi: form.zeminRengi || "#000000",
        boslukSayisi: Number(form.boslukSayisi) || 0,
        htmlDosyaAdi: useHtmlFile ? (form.htmlDosyaAdi || "Pano_Dikey.html") : "",
        kodAlaniGenisligi: Number(form.kodAlaniGenisligi) || 60,
        kurAlaniGenisligi: Number(form.kurAlaniGenisligi) || 40,
        satirlar: sanitizedRows,
      };

      const saved = await PanoService.savePano(payload);
      setForm(saved);
      if (saved.zeminRengi) {
        localStorage.setItem("pano_active_theme_bg", saved.zeminRengi);
      }
      setAlertInfo({ type: "success", message: `SODVZ_PANO_TANIMI_KAYDET: '${saved.panoNo}' tanımı başarıyla kaydedildi.` });

      // Refresh list
      const updatedList = await PanoService.getAllPanos();
      setPanos(updatedList);
      const newIdx = updatedList.findIndex((p) => p.panoId === saved.panoId);
      if (newIdx !== -1) setCurrentIndex(newIdx);
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: "Kaydetme hatası: " + (err?.message || err) });
    } finally {
      setSaving(false);
    }
  };

  // Delete via stored procedure SODVZ_PANO_TANIMI_SIL
  const handleDelete = async () => {
    if (!form.panoId || form.panoId <= 0) {
      setAlertInfo({ type: "warning", message: "Henüz veritabanında kaydı bulunmayan Pano silinemez." });
      return;
    }

    if (!window.confirm(`'${form.panoNo}' isimli Pano tanımını silmek istediğinize emin misiniz?`)) {
      return;
    }

    setSaving(true);
    try {
      await PanoService.deletePano(form.panoId);
      setAlertInfo({ type: "success", message: `SODVZ_PANO_TANIMI_SIL: '${form.panoNo}' tanımı başarıyla silindi.` });
      await loadData();
    } catch (err: any) {
      setAlertInfo({ type: "danger", message: "Silme hatası: " + (err?.message || err) });
    } finally {
      setSaving(false);
    }
  };

  // Currency lines table helpers
  const handleAddCurrency = (prodId: number) => {
    const prod = availableProducts.find((p) => p.id === prodId);
    if (!prod) return;
    if (form.satirlar.some((s) => s.paraId === prod.id)) {
      setAlertInfo({ type: "warning", message: `'${prod.kod}' para birimi zaten listede ekli.` });
      return;
    }
    const newLine: PanoSatiriModel = {
      paraId: prod.id,
      kod: prod.kod,
      ad: prod.ad,
      gorunecekAd: `${prod.kod} - ${prod.ad}`,
      siraNo: form.satirlar.length + 1,
      gorunur: true,
      carpan: 1.0,
    };
    setForm({ ...form, satirlar: [...form.satirlar, newLine] });
  };

  const handleAddAllCurrencies = () => {
    const existingParaIds = new Set(form.satirlar.map((s) => s.paraId));
    const newLines: PanoSatiriModel[] = [...form.satirlar];
    let nextSeq = form.satirlar.length + 1;

    availableProducts.forEach((prod) => {
      if (!existingParaIds.has(prod.id)) {
        newLines.push({
          paraId: prod.id,
          kod: prod.kod,
          ad: prod.ad,
          gorunecekAd: `${prod.kod} - ${prod.ad}`,
          siraNo: nextSeq++,
          gorunur: true,
          carpan: 1.0,
        });
      }
    });

    setForm({ ...form, satirlar: newLines });
  };

  const handleUpdateLine = (index: number, key: keyof PanoSatiriModel, value: any) => {
    const updated = [...form.satirlar];
    updated[index] = { ...updated[index], [key]: value };
    setForm({ ...form, satirlar: updated });
  };

  const handleRemoveLine = (index: number) => {
    const updated = form.satirlar.filter((_, i) => i !== index);
    setForm({ ...form, satirlar: updated });
  };

  const handleMoveLine = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === form.satirlar.length - 1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const updated = [...form.satirlar];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    // Recalculate siraNo
    updated.forEach((line, idx) => (line.siraNo = idx + 1));
    setForm({ ...form, satirlar: updated });
  };

  // Drag & drop row reordering handler
  const handleDropRow = (targetIdx: number) => {
    if (draggedIndex === null || draggedIndex === targetIdx) return;
    const updated = [...form.satirlar];
    const [movedItem] = updated.splice(draggedIndex, 1);
    updated.splice(targetIdx, 0, movedItem);
    updated.forEach((line, idx) => {
      line.siraNo = idx + 1;
    });
    setForm({ ...form, satirlar: updated });
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Style Property Modal open handler
  const openStyleModal = (
    key: "firmaAdiOzellikleri" | "tarihSaatOzellikleri" | "baslikOzellikleri" | "satirOzellikleri",
    title: string
  ) => {
    setActiveStyleKey(key);
    setActiveStyleTitle(title);
    setTempStyle(parseStyleString(form[key]));
    setShowStyleModal(true);
  };

  const saveStyleModal = () => {
    if (activeStyleKey) {
      const serialized = serializeStyleString(tempStyle);
      autoSaveAppearance({ [activeStyleKey]: serialized });
    }
    setShowStyleModal(false);
  };

  // Search filtered panos
  const filteredSearchPanos = useMemo(() => {
    if (!searchQuery) return panos;
    const q = searchQuery.toLowerCase();
    return panos.filter(
      (p) =>
        p.panoNo.toLowerCase().includes(q) ||
        p.firmaAdi.toLowerCase().includes(q) ||
        p.htmlDosyaAdi.toLowerCase().includes(q)
    );
  }, [panos, searchQuery]);

  return (
    <div className="pano-tanimi-page-container container-fluid px-2 py-2">
      {/* 1. ERP Top Action Toolbar */}
      <ERPToolbar
        pageTitle="D- Pano Tanımı"
        pageIcon={<IconDeviceTv size={22} className="text-primary" />}
        onNew={handleNew}
        onSave={handleSave}
        onDelete={handleDelete}
        onSearch={() => setShowSearchModal(true)}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        onRefresh={loadData}
        onClear={handleNew}
        onPrint={() => window.print()}
        disabled={saving || loading}
        rightContent={
          <Button
            variant="success"
            size="sm"
            className="d-flex align-items-center gap-1.5 fw-semibold shadow-xs"
            onClick={() => navigate(`/kur/pano?id=${form.panoId || 0}`)}
          >
            <IconExternalLink size={16} />
            <span>Canlı Pano Ekranı</span>
          </Button>
        }
      />

      {/* Alert Notifications */}
      {alertInfo && (
        <Alert
          variant={alertInfo.type}
          dismissible
          onClose={() => setAlertInfo(null)}
          className="py-2 px-3 mb-3 border rounded shadow-2xs small fw-medium"
        >
          {alertInfo.message}
        </Alert>
      )}

      {/* Main Screen Windows Form Container */}
      <Card className="shadow-sm border border-secondary-subtle rounded-3">
        <Card.Body className="p-3 bg-body">
          <Row className="g-3">
            {/* Left Pane: Form Parameters matching Procedure Parameters & Desktop Screenshot */}
            <Col xs={12} lg={6} xl={5} className="d-flex flex-column gap-2.5 border-end-lg pe-lg-3">
              {/* Row 1: Pano No with Lookup Button */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <Form.Label className="fw-semibold small mb-0">Pano No</Form.Label>
                </Col>
                <Col xs={12} sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      type="text"
                      value={form.panoNo}
                      onChange={(e) => setForm({ ...form, panoNo: e.target.value })}
                      placeholder="Örn: DIKEY, PANO_01"
                      className="fw-bold font-monospace bg-white border"
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      onClick={() => setShowSearchModal(true)}
                      title="Pano Listesi / Pano Seç"
                      className="d-flex align-items-center justify-content-center px-2.5 bg-light border-start-0"
                      style={{ borderColor: "#ced4da" }}
                    >
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
                </Col>
              </Row>

              {/* Row 2: HTML Dosya with Lookup Button */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <div className="d-flex align-items-center gap-2">
                    <FormCheck
                      type="checkbox"
                      id="htmlFileToggle"
                      checked={useHtmlFile}
                      onChange={(e) => setUseHtmlFile(e.target.checked)}
                      className="mb-0"
                    />
                    <Form.Label htmlFor="htmlFileToggle" className="fw-semibold small mb-0 user-select-none" style={{ cursor: "pointer" }}>
                      HTML Dosya
                    </Form.Label>
                  </div>
                </Col>
                <Col xs={12} sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      type="text"
                      value={form.htmlDosyaAdi}
                      disabled={!useHtmlFile}
                      onChange={(e) => setForm({ ...form, htmlDosyaAdi: e.target.value })}
                      placeholder="Pano_Dikey.html"
                      className="bg-white font-monospace"
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      disabled={!useHtmlFile}
                      onClick={() => setShowHtmlModal(true)}
                      title="HTML Şablon Dosyaları Seç"
                      className="d-flex align-items-center justify-content-center px-2.5 bg-light border-start-0"
                      style={{ borderColor: "#ced4da" }}
                    >
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
                </Col>
              </Row>

              {/* Row 2: Yenileme Süresi */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <Form.Label className="fw-semibold small mb-0">Yenileme süresi</Form.Label>
                </Col>
                <Col xs={12} sm={8}>
                  <InputGroup size="sm">
                    <Form.Control
                      type="number"
                      min={1}
                      max={3600}
                      value={form.yenilemeAraligi}
                      onChange={(e) => setForm({ ...form, yenilemeAraligi: Number(e.target.value) || 5 })}
                      className="text-center fw-bold"
                    />
                    <InputGroup.Text className="bg-light fw-medium">Saniye</InputGroup.Text>
                  </InputGroup>
                </Col>
              </Row>

              {/* Row 3: Pano Başlığı */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <Form.Label className="fw-semibold small mb-0">Pano başlığı</Form.Label>
                </Col>
                <Col xs={12} sm={8}>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={form.firmaAdi}
                    onChange={(e) => autoSaveAppearance({ firmaAdi: e.target.value })}
                    placeholder="Firma / Pano Adı Başlığı"
                    className="bg-white border"
                  />
                </Col>
              </Row>

              {/* Row 4: Para Adı Başlığı */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <Form.Label className="fw-semibold small mb-0">Para adı başlığı</Form.Label>
                </Col>
                <Col xs={12} sm={8}>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={form.paraBasligi}
                    onChange={(e) => setForm({ ...form, paraBasligi: e.target.value })}
                    placeholder="Örn: DÖVİZ"
                    className="bg-white border"
                  />
                </Col>
              </Row>

              {/* Row 5: Satış Kuru Başlığı */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <Form.Label className="fw-semibold small mb-0">Satış kuru başlığı</Form.Label>
                </Col>
                <Col xs={12} sm={8}>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={form.satisKuruBasligi}
                    onChange={(e) => setForm({ ...form, satisKuruBasligi: e.target.value })}
                    placeholder="Örn: WE SELL - SATIŞ"
                    className="bg-white border"
                  />
                </Col>
              </Row>

              {/* Row 6: Alış Kuru Başlığı */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <Form.Label className="fw-semibold small mb-0">Alış kuru başlığı</Form.Label>
                </Col>
                <Col xs={12} sm={8}>
                  <Form.Control
                    type="text"
                    size="sm"
                    value={form.alisKuruBasligi}
                    onChange={(e) => setForm({ ...form, alisKuruBasligi: e.target.value })}
                    placeholder="Örn: WE BUY - ALIŞ"
                    className="bg-white border"
                  />
                </Col>
              </Row>

              <hr className="my-2 border-secondary-subtle" />

              {/* Style Buttons Section (Matching Screenshot Desktop Layout) */}
              <div className="bg-light p-2.5 rounded-3 border">
                <div className="fw-semibold text-dark small mb-2 d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-1.5">
                    <IconTypography size={16} className="text-primary" />
                    <span>Yazı Tipi & Stil Özellikleri</span>
                  </div>
                  <Badge bg="info" className="px-1.5 py-0.5 text-white fw-normal" style={{ fontSize: "10px" }}>
                    Otomatik Kayıt
                  </Badge>
                </div>
                <Row className="g-2 mb-2">
                  <Col xs={12} sm={6}>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="w-100 py-1 text-truncate text-start d-flex align-items-center justify-content-between"
                      onClick={() => openStyleModal("baslikOzellikleri", "Başlık Özellikleri")}
                    >
                      <span className="small">Başlık özellikleri</span>
                      <IconPalette size={14} className="text-muted ms-1" />
                    </Button>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="w-100 py-1 text-truncate text-start d-flex align-items-center justify-content-between"
                      onClick={() => openStyleModal("satirOzellikleri", "Satır Özellikleri")}
                    >
                      <span className="small">Satır özellikleri</span>
                      <IconPalette size={14} className="text-muted ms-1" />
                    </Button>
                  </Col>
                </Row>
                <Row className="g-2">
                  <Col xs={12} sm={6}>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="w-100 py-1 text-truncate text-start d-flex align-items-center justify-content-between"
                      onClick={() => openStyleModal("firmaAdiOzellikleri", "Pano Başlık Özellikleri")}
                    >
                      <span className="small">Pano başlık özellikleri</span>
                      <IconPalette size={14} className="text-muted ms-1" />
                    </Button>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="w-100 py-1 text-truncate text-start d-flex align-items-center justify-content-between"
                      onClick={() => openStyleModal("tarihSaatOzellikleri", "Tarih Saat Özellikleri")}
                    >
                      <span className="small">Tarih saat özellikleri</span>
                      <IconPalette size={14} className="text-muted ms-1" />
                    </Button>
                  </Col>
                </Row>
              </div>

              {/* Zemin Rengi Picker (Otomatik Kayıtlı) */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <Form.Label className="fw-semibold small mb-0 d-flex align-items-center gap-1">
                    <span>Zemin rengi</span>
                  </Form.Label>
                </Col>
                <Col xs={12} sm={8} className="d-flex align-items-center gap-2 flex-wrap">
                  <Form.Control
                    type="color"
                    size="sm"
                    value={form.zeminRengi || "#000000"}
                    onChange={(e) => autoSaveAppearance({ zeminRengi: e.target.value })}
                    style={{ width: "44px", height: "32px", cursor: "pointer", padding: "2px" }}
                    className="border rounded flex-shrink-0"
                    title="Pano sayfasında anında geçerli olur ve otomatik kaydedilir"
                  />
                  <Form.Control
                    type="text"
                    size="sm"
                    value={form.zeminRengi}
                    onChange={(e) => autoSaveAppearance({ zeminRengi: e.target.value })}
                    placeholder="#000000"
                    className="font-monospace text-uppercase"
                    style={{ width: "95px" }}
                  />
                  {user?.appearance?.programBgColor && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => autoSaveAppearance({ zeminRengi: user.appearance?.programBgColor || "#000000" })}
                      className="py-1 px-2 text-nowrap small border flex-shrink-0"
                      title="Kullanıcı ayarlarındaki aktif program temasının rengini aktar"
                    >
                      Tema Rengini Al
                    </Button>
                  )}
                  <div
                    className="rounded border shadow-2xs flex-grow-1"
                    style={{
                      height: "32px",
                      minWidth: "70px",
                      backgroundColor: form.zeminRengi || "#000000",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "10px",
                      fontWeight: 600,
                    }}
                  >
                    Önizleme
                  </div>
                </Col>
              </Row>

              {/* Boşluk Sayısı */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <Form.Label className="fw-semibold small mb-0">Sola eklenecek boşluk</Form.Label>
                </Col>
                <Col xs={12} sm={8}>
                  <Form.Control
                    type="number"
                    size="sm"
                    min={0}
                    max={200}
                    value={form.boslukSayisi}
                    onChange={(e) => autoSaveAppearance({ boslukSayisi: Number(e.target.value) || 0 })}
                    className="text-center fw-bold"
                  />
                </Col>
              </Row>

              {/* Para kodu genişliği % */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <Form.Label className="fw-semibold small mb-0">Para kodu genişliği %</Form.Label>
                </Col>
                <Col xs={12} sm={8}>
                  <Form.Control
                    type="number"
                    size="sm"
                    min={10}
                    max={90}
                    value={form.kodAlaniGenisligi}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 50;
                      autoSaveAppearance({
                        kodAlaniGenisligi: val,
                        kurAlaniGenisligi: 100 - val,
                      });
                    }}
                    className="text-center fw-bold"
                  />
                </Col>
              </Row>

              {/* Kur alanı genişliği % */}
              <Row className="g-2 align-items-center">
                <Col xs={12} sm={4}>
                  <Form.Label className="fw-semibold small mb-0">Kur alanı genişliği %</Form.Label>
                </Col>
                <Col xs={12} sm={8}>
                  <Form.Control
                    type="number"
                    size="sm"
                    min={10}
                    max={90}
                    value={form.kurAlaniGenisligi}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 50;
                      autoSaveAppearance({
                        kurAlaniGenisligi: val,
                        kodAlaniGenisligi: 100 - val,
                      });
                    }}
                    className="text-center fw-bold"
                  />
                </Col>
              </Row>
            </Col>

            {/* Right Pane: Currency Table Grid */}
            <Col xs={12} lg={6} xl={7} className="d-flex flex-column gap-2.5">

              {/* Currency Satırları Grid Table Header & Buttons */}
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pt-1">
                <div className="fw-bold text-dark small d-flex align-items-center gap-1.5">
                  <Badge bg="primary" pill>
                    {form.satirlar.length}
                  </Badge>
                  <span>Pano Gösterilecek Para Birimleri Listesi</span>
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <Form.Select
                    size="sm"
                    className="py-1 px-2 small bg-white"
                    style={{ width: "170px" }}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddCurrency(Number(e.target.value));
                      }
                    }}
                  >
                    <option value="">+ Para Birimi Ekle...</option>
                    {availableProducts
                      .filter((prod) => !form.satirlar.some((s) => s.paraId === prod.id))
                      .map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.kod} - {prod.ad}
                        </option>
                      ))}
                  </Form.Select>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={handleAddAllCurrencies}
                    className="py-1 px-2.5 text-nowrap d-flex align-items-center gap-1"
                  >
                    <IconPlus size={14} />
                    <span>Tüm Para Birimlerini Ekle</span>
                  </Button>
                </div>
              </div>

              {/* Grid Table */}
              <div className="table-responsive border rounded bg-white shadow-2xs overflow-y-auto" style={{ maxHeight: "360px" }}>
                <Table hover size="sm" className="mb-0 align-middle">
                  <thead className="bg-light sticky-top border-bottom">
                    <tr className="small text-muted text-nowrap">
                      <th style={{ width: "32px" }} className="text-center"></th>
                      <th style={{ width: "35px" }} className="text-center">#</th>
                      <th style={{ width: "70px" }}>Kod</th>
                      <th>Ad</th>
                      <th>Görünecek Ad</th>
                      <th style={{ width: "75px" }} className="text-center">Çarpan</th>
                      <th style={{ width: "70px" }} className="text-center">Görünür</th>
                      <th style={{ width: "80px" }} className="text-center">Sıralama</th>
                      <th style={{ width: "40px" }} className="text-center">Sil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.satirlar.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center text-muted py-4 small">
                          Henüz panoda gösterilecek para birimi eklenmedi. 'Tüm Para Birimlerini Ekle' butonunu kullanabilirsiniz.
                        </td>
                      </tr>
                    ) : (
                      form.satirlar.map((line, idx) => {
                        const isDragging = draggedIndex === idx;
                        const isDragOver = dragOverIndex === idx;
                        return (
                          <tr
                            key={`${line.paraId}-${idx}`}
                            draggable={true}
                            onDragStart={(e) => {
                              setDraggedIndex(idx);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              if (dragOverIndex !== idx) setDragOverIndex(idx);
                            }}
                            onDragLeave={() => {
                              if (dragOverIndex === idx) setDragOverIndex(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              handleDropRow(idx);
                            }}
                            onDragEnd={() => {
                              setDraggedIndex(null);
                              setDragOverIndex(null);
                            }}
                            className={`user-select-none ${!line.gorunur ? "bg-light opacity-50" : ""} ${
                              isDragging ? "opacity-25 bg-warning-subtle" : ""
                            } ${isDragOver ? "border-top border-3 border-primary bg-primary-subtle" : ""}`}
                            style={{ cursor: "grab" }}
                          >
                            <td
                              className="text-center text-muted align-middle py-1 px-1"
                              style={{ cursor: "grab" }}
                              title="Mouse ile basılı tutarak yukarı/aşağı sürükleyip bırakabilirsiniz"
                            >
                              <IconGripVertical size={16} className="text-secondary" />
                            </td>
                            <td className="text-center fw-semibold small text-muted">{idx + 1}</td>
                            <td className="fw-bold font-monospace text-primary small">{line.kod}</td>
                            <td className="small text-truncate" style={{ maxWidth: "130px" }}>{line.ad}</td>
                            <td>
                              <Form.Control
                                type="text"
                                size="sm"
                                value={line.gorunecekAd}
                                onChange={(e) => handleUpdateLine(idx, "gorunecekAd", e.target.value)}
                                className="py-0.5 px-2 small border-secondary-subtle"
                              />
                            </td>
                            <td className="text-center">
                              <Form.Control
                                type="number"
                                size="sm"
                                step="0.0001"
                                value={line.carpan}
                                onChange={(e) => handleUpdateLine(idx, "carpan", Number(e.target.value) || 1.0)}
                                className="py-0.5 px-1 small text-center font-monospace border-secondary-subtle"
                                style={{ width: "65px" }}
                              />
                            </td>
                            <td className="text-center">
                              <FormCheck
                                type="checkbox"
                                checked={line.gorunur}
                                onChange={(e) => handleUpdateLine(idx, "gorunur", e.target.checked)}
                                className="d-inline-block"
                              />
                            </td>
                            <td className="text-center">
                              <div className="d-flex align-items-center justify-content-center gap-1">
                                <Button
                                  variant="light"
                                  size="sm"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveLine(idx, "up")}
                                  className="p-0 border-0"
                                  style={{ width: "20px", height: "20px" }}
                                >
                                  <IconArrowUp size={14} />
                                </Button>
                                <Button
                                  variant="light"
                                  size="sm"
                                  disabled={idx === form.satirlar.length - 1}
                                  onClick={() => handleMoveLine(idx, "down")}
                                  className="p-0 border-0"
                                  style={{ width: "20px", height: "20px" }}
                                >
                                  <IconArrowDown size={14} />
                                </Button>
                              </div>
                            </td>
                            <td className="text-center">
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => handleRemoveLine(idx)}
                                className="text-danger p-0 border-0"
                                title="Satırı Sil"
                              >
                                <IconTrash size={15} />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </Table>
              </div>

              {/* Live Preview Bar */}
              <div
                className="p-3 rounded-3 shadow-sm border mt-auto overflow-hidden text-white"
                style={{
                  backgroundColor: form.zeminRengi || "#0f172a",
                  minHeight: "110px",
                }}
              >
                <div
                  className="mb-1 text-truncate"
                  style={{
                    fontFamily: parseStyleString(form.firmaAdiOzellikleri).fontFamily,
                    fontSize: `${parseStyleString(form.firmaAdiOzellikleri).fontSize * 0.75}px`,
                    fontWeight: parseStyleString(form.firmaAdiOzellikleri).bold ? "bold" : "normal",
                    color: parseStyleString(form.firmaAdiOzellikleri).color,
                  }}
                >
                  {form.firmaAdi || "Pano Başlığı Önizleme"}
                </div>
                <div className="d-flex align-items-center justify-content-between border-top border-secondary pt-2 mt-2">
                  <span
                    style={{
                      fontFamily: parseStyleString(form.baslikOzellikleri).fontFamily,
                      fontSize: `${parseStyleString(form.baslikOzellikleri).fontSize * 0.75}px`,
                      color: parseStyleString(form.baslikOzellikleri).color,
                    }}
                  >
                    {form.paraBasligi || "DÖVİZ"}
                  </span>
                  <span
                    style={{
                      fontFamily: parseStyleString(form.baslikOzellikleri).fontFamily,
                      fontSize: `${parseStyleString(form.baslikOzellikleri).fontSize * 0.75}px`,
                      color: parseStyleString(form.baslikOzellikleri).color,
                    }}
                  >
                    {form.alisKuruBasligi || "ALIŞ"} / {form.satisKuruBasligi || "SATIŞ"}
                  </span>
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>

        {/* Footer Status Bar (Top buttons are used for all actions) */}
        <Card.Footer className="bg-light border-top py-2 px-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="text-muted small fw-semibold font-monospace">
              {panos.length > 0 ? (currentIndex === 0 ? "İlk kayıt" : currentIndex === panos.length - 1 ? "Son kayıt" : `Kayıt ${currentIndex + 1} / ${panos.length}`) : "Yeni Kayıt Modu"}
            </span>
            {form.panoNo && (
              <Badge bg="secondary" className="font-monospace small">
                {form.panoNo}
              </Badge>
            )}
          </div>
          {autoSaveStatus && (
            <Badge bg="success" className="small fw-semibold py-1 px-2 d-flex align-items-center gap-1 shadow-2xs">
              <IconCheck size={13} />
              <span>{autoSaveStatus}</span>
            </Badge>
          )}
        </Card.Footer>
      </Card>

      {/* 1. Style Property Modal */}
      <Modal show={showStyleModal} onHide={() => setShowStyleModal(false)} centered>
        <Modal.Header closeButton className="bg-light py-2">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconPalette size={20} className="text-primary" />
            <span>{activeStyleTitle}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <Form className="d-flex flex-column gap-3">
            <div>
              <Form.Label className="fw-semibold small">Font Ailesi</Form.Label>
              <div className="w-100">
                <FontSelectDropdown
                  value={tempStyle.fontFamily}
                  onChange={(fontVal) => setTempStyle({ ...tempStyle, fontFamily: fontVal })}
                />
              </div>
            </div>

            <Row className="g-2">
              <Col sm={6}>
                <Form.Label className="fw-semibold small">Font Boyutu (px)</Form.Label>
                <Form.Control
                  type="number"
                  size="sm"
                  min={8}
                  max={72}
                  value={tempStyle.fontSize}
                  onChange={(e) => setTempStyle({ ...tempStyle, fontSize: Number(e.target.value) || 16 })}
                  className="fw-bold"
                />
              </Col>
              <Col sm={6} className="d-flex align-items-end">
                <FormCheck
                  type="checkbox"
                  id="fontBoldCheck"
                  label="Kalın (Bold)"
                  checked={tempStyle.bold}
                  onChange={(e) => setTempStyle({ ...tempStyle, bold: e.target.checked })}
                  className="fw-bold small mb-2"
                />
              </Col>
            </Row>

            <Row className="g-2">
              <Col sm={6}>
                <Form.Label className="fw-semibold small">Yazı Rengi</Form.Label>
                <div className="d-flex align-items-center gap-2">
                  <Form.Control
                    type="color"
                    size="sm"
                    value={tempStyle.color || "#ffffff"}
                    onChange={(e) => setTempStyle({ ...tempStyle, color: e.target.value })}
                    style={{ width: "40px", height: "30px", padding: "1px" }}
                  />
                  <Form.Control
                    type="text"
                    size="sm"
                    value={tempStyle.color}
                    onChange={(e) => setTempStyle({ ...tempStyle, color: e.target.value })}
                    className="font-monospace text-uppercase"
                  />
                </div>
              </Col>
              <Col sm={6}>
                <Form.Label className="fw-semibold small">Arkaplan Rengi</Form.Label>
                <div className="d-flex align-items-center gap-2">
                  <Form.Control
                    type="color"
                    size="sm"
                    value={tempStyle.bgColor && tempStyle.bgColor !== "transparent" ? tempStyle.bgColor : "#000000"}
                    onChange={(e) => setTempStyle({ ...tempStyle, bgColor: e.target.value })}
                    style={{ width: "40px", height: "30px", padding: "1px" }}
                  />
                  <Form.Control
                    type="text"
                    size="sm"
                    value={tempStyle.bgColor}
                    onChange={(e) => setTempStyle({ ...tempStyle, bgColor: e.target.value })}
                    className="font-monospace text-uppercase"
                  />
                </div>
              </Col>
            </Row>

            {/* Live Style Preview Card */}
            <div className="p-3 border rounded bg-dark text-center mt-2">
              <span
                style={{
                  fontFamily: tempStyle.fontFamily,
                  fontSize: `${tempStyle.fontSize}px`,
                  fontWeight: tempStyle.bold ? "bold" : "normal",
                  color: tempStyle.color,
                  backgroundColor: tempStyle.bgColor !== "transparent" ? tempStyle.bgColor : "transparent",
                  padding: "4px 8px",
                  borderRadius: "4px",
                }}
              >
                100.00 USD - 38.50 TL / 38.65 TL
              </span>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer className="py-2 bg-light">
          <Button variant="secondary" size="sm" onClick={() => setShowStyleModal(false)}>
            İptal
          </Button>
          <Button variant="primary" size="sm" onClick={saveStyleModal} className="fw-bold">
            Uygula
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 2. Pano Search Modal (Dürbün ile Seçim - D- Vezne Tanımları gibi) */}
      <LookupModal<PanoModel>
        show={showSearchModal}
        onHide={() => setShowSearchModal(false)}
        title="Pano Tanımı Arama (Dürbün)"
        searchPlaceholder="Pano No, Firma Adı veya HTML Dosya Adı ile ara..."
        items={panos}
        filterFn={(p, term) => {
          const t = term.toLowerCase();
          return (
            p.panoNo.toLowerCase().includes(t) ||
            p.firmaAdi.toLowerCase().includes(t) ||
            (p.htmlDosyaAdi ? p.htmlDosyaAdi.toLowerCase().includes(t) : false)
          );
        }}
        columns={[
          {
            header: "Pano No",
            width: "120px",
            render: (p) => <span className="badge bg-primary-subtle text-primary border font-monospace fw-bold">{p.panoNo}</span>,
          },
          {
            header: "Firma / Pano Başlığı",
            render: (p) => <span className="fw-semibold text-dark">{p.firmaAdi || "-"}</span>,
          },
          {
            header: "HTML Dosya",
            width: "140px",
            render: (p) => <span className="font-monospace text-muted small">{p.htmlDosyaAdi || "-"}</span>,
          },
          {
            header: "Yenileme",
            width: "90px",
            align: "center",
            render: (p) => <span className="font-monospace small">{p.yenilemeAraligi}s</span>,
          },
        ]}
        onSelect={(p) => {
          const originalIdx = panos.findIndex((item) => item.panoId === p.panoId);
          selectPano(p, originalIdx !== -1 ? originalIdx : 0);
        }}
      />

      {/* 3. HTML File Chooser Modal */}
      <Modal show={showHtmlModal} onHide={() => setShowHtmlModal(false)} centered>
        <Modal.Header closeButton className="bg-light py-2">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconFolderOpen size={20} className="text-primary" />
            <span>HTML Pano Şablonu Seç</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <p className="small text-muted mb-2">Pano gösterimi için hazırlanmış HTML şablon dosyasını seçiniz:</p>
          <div className="d-flex flex-column gap-2">
            {[
              { name: "Pano_Dikey.html", desc: "Dikey ekranlar için yüksek çözünürlüklü dijital pano tasarımı" },
              { name: "Pano_Yatay.html", desc: "TV & geniş ekranlar için 16:9 yatay döviz panosu tasarımı" },
              { name: "Pano_Vitrin.html", desc: "Mağaza dış vitrini için yüksek kontrastlı sarrafiye tasarımı" },
              { name: "Pano_Kompakt.html", desc: "Mini vezne ve müşteri bilgilendirme panosu" },
            ].map((tmpl) => (
              <Card
                key={tmpl.name}
                className={`border shadow-2xs hover-border-primary cursor-pointer p-2.5 ${form.htmlDosyaAdi === tmpl.name ? "border-primary bg-primary-subtle" : "bg-white"}`}
                onClick={() => {
                  setForm({ ...form, htmlDosyaAdi: tmpl.name });
                  setShowHtmlModal(false);
                }}
              >
                <div className="d-flex align-items-center justify-content-between">
                  <div className="fw-bold font-monospace text-primary small">{tmpl.name}</div>
                  {form.htmlDosyaAdi === tmpl.name && <IconCheck size={16} className="text-primary" />}
                </div>
                <div className="text-muted small mt-1" style={{ fontSize: "11px" }}>{tmpl.desc}</div>
              </Card>
            ))}
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default PanoTanimiPage;

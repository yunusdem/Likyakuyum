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
} from "react-bootstrap";
import {
  IconPrinter,
  IconSearch,
  IconCheck,
  IconAlertCircle,
  IconTrash,
  IconAdjustments,
  IconRefresh,
  IconDownload,
  IconCopy,
} from "@tabler/icons-react";
import { getPowerShellOneLinerCommand } from "../../utils/localPrintAgentScript";

import ERPToolbar from "../../components/common/ERPToolbar";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import LookupModal from "../../components/common/LookupModal";
import useERPAutoFocus from "../../hooks/useERPAutoFocus";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { printReportTable } from "../../utils/printReport";
import {
  PrinterService,
  YaziciItem,
  YaziciFormData,
  YaziciUsageInfo,
  SystemPrinterItem,
  isVirtualSystemPrinter,
} from "../../services/printerService";


const initialFormState: YaziciFormData = {
  siraNo: "" as any,
  ad: "",
  cihazAdi: "",
  baglantiNoktasi: "",
  belgeYaziciModu: 1,
  belgeYaziciDizini: "",
  kopyaSayisi: 1,
};

export const PrinterDefinitionsPage: React.FC = () => {
  const activeDb = localStorage.getItem("kuyumcu_erp_active_db") || "R2016_dvz";
  const activeServer = localStorage.getItem("kuyumcu_erp_active_server") || "localhost";
  const { user } = useAuth();

  // Data states
  const [yazicilar, setYazicilar] = useState<YaziciItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [selectedYazici, setSelectedYazici] = useState<YaziciItem | null>(null);
  const [formData, setFormData] = useState<YaziciFormData>(initialFormState);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);

  useERPAutoFocus({ dependencies: [isNewRecord, selectedIndex] });

  const { showSuccess, showError } = useToast();

  // UI / Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    yazici: YaziciItem;
    loadingUsage?: boolean;
    usage?: YaziciUsageInfo;
  } | null>(null);
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);
  const [showSystemPrintersModal, setShowSystemPrintersModal] = useState<boolean>(false);
  const [printerList, setPrinterList] = useState<string[]>(() => {
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("likya_terminal_last_printer") : null;
    return saved && !isVirtualSystemPrinter(saved) ? [saved] : [];
  });
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinterItem[]>([]);
  const [isLoadingSystemPrinters, setIsLoadingSystemPrinters] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [selectedSystemPrinterName, setSelectedSystemPrinterName] = useState<string>("");
  const [systemPrinterSearchTerm, setSystemPrinterSearchTerm] = useState<string>("");
  const [manualPrinterName, setManualPrinterName] = useState<string>("");
  const [copiedOneLiner, setCopiedOneLiner] = useState<boolean>(false);

  const handleCopyOneLiner = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://likyakuyum.com";
    const cmd = getPowerShellOneLinerCommand(origin);
    navigator.clipboard.writeText(cmd);
    setCopiedOneLiner(true);
    setTimeout(() => setCopiedOneLiner(false), 4000);
  };

  // Sayfa açıldığında bu bilgisayarın yerel yazıcılarını arka planda otomatik çek
  useEffect(() => {
    // LocalStorage'daki eski "USB Printer P" ve sanal yazıcı kalıntılarını temizle
    try {
      const raw = localStorage.getItem("likya_client_printers");
      if (raw) {
        const parsed = JSON.parse(raw);
        const cleaned = parsed.filter(
          (p: any) => !isVirtualSystemPrinter(p?.name) && p?.source !== "usb"
        );
        localStorage.setItem("likya_client_printers", JSON.stringify(cleaned));
      }
    } catch {}

    PrinterService.getSystemPrinters(user)
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          const filtered = list.filter((p) => !isVirtualSystemPrinter(p.name));
          setSystemPrinters(filtered);
          const names = filtered.map((p) => p.name).filter(Boolean);
          if (names.length > 0) {
            setPrinterList(names);
          }
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // Sadece o anki bilgisayara bağlı yazıcıları çeken fonksiyon
  const fetchRealTimePrinters = async (): Promise<string[]> => {
    return PrinterService.fetchRealTimePrinters();
  };

  const handleGetPrinters = async () => {
    setIsLoadingSystemPrinters(true);
    setAlertError(null);
    try {
      // 1. Kullanıcı tıklaması ile tarayıcının yerel USB cihaz izin ve seçim penceresini doğrudan tetikle
      const usbChosen = await PrinterService.requestUsbPrinter();

      // 2. Tarayıcı Printing API & sistemden bağlı yazıcıları çek
      const detected = await PrinterService.fetchRealTimePrinters();
      const allDetected: string[] = [];
      if (usbChosen && !isVirtualSystemPrinter(usbChosen)) {
        allDetected.push(usbChosen);
      }
      for (const d of detected) {
        if (!isVirtualSystemPrinter(d) && !allDetected.includes(d)) {
          allDetected.push(d);
        }
      }

      // 3. Yerel backend / spooler yazıcılarını çek
      try {
        const sysList = await PrinterService.getSystemPrinters(user);
        for (const sp of sysList) {
          if (!isVirtualSystemPrinter(sp.name) && !allDetected.includes(sp.name)) {
            allDetected.push(sp.name);
          }
        }
      } catch {}

      // 4. Hafızadaki terminal yazıcısını ekle
      const terminalSaved = localStorage.getItem("likya_terminal_last_printer");
      if (terminalSaved && !isVirtualSystemPrinter(terminalSaved) && !allDetected.includes(terminalSaved)) {
        allDetected.push(terminalSaved);
      }

      // Listede gerçek bağlı donanım bulunduysa forma ata
      if (allDetected.length > 0) {
        setPrinterList(allDetected);
        const mappedItems: SystemPrinterItem[] = allDetected.map((name, idx) => ({
          name,
          isDefault: idx === 0,
          isOnline: true,
          source: "browser",
          details: "Bu Bilgisayara Bağlı Yazıcı",
        }));
        setSystemPrinters(mappedItems);
        for (const item of mappedItems) {
          PrinterService.saveClientPrinter(item, user?.id);
        }
        handleInputChange("cihazAdi", allDetected[0]);
        if (!formData.ad || formData.ad.trim() === "") {
          handleInputChange("ad", allDetected[0]);
        }
        showSuccess(`Bilgisayarınıza bağlı ${allDetected.length} adet yazıcı başarıyla tespit edildi!`);
      } else {
        showSuccess("Bağlı yazıcı aranıyor. Dilerseniz modelini kutudan seçebilir veya yazabilirsiniz.");
      }
    } catch (error: any) {
      console.debug("Yazıcılar getirilirken hata:", error);
    } finally {
      setIsLoadingSystemPrinters(false);
    }
  };

  const handleScanWebPrinters = handleGetPrinters;

  const handleOpenSystemPrinters = async () => {
    setShowSystemPrintersModal(true);
    setIsLoadingSystemPrinters(true);
    setPermissionStatus(null);
    setSystemPrinterSearchTerm("");
    setSelectedSystemPrinterName(formData.cihazAdi || "");

    try {
      const list = await PrinterService.getSystemPrinters(user);
      const activePrinters = (list || []).filter((p) => !isVirtualSystemPrinter(p.name));
      setSystemPrinters(activePrinters);
      const names = activePrinters.map((p) => p.name).filter(Boolean);
      if (names.length > 0) {
        setPrinterList(names);
        if (!formData.cihazAdi) {
          setSelectedSystemPrinterName(names[0]);
        }
      }
    } catch (err) {
      console.debug("Sistem yazıcıları listelenirken hata:", err);
    } finally {
      setIsLoadingSystemPrinters(false);
    }
  };

  const handleAddManualLocalPrinter = () => {
    const name = manualPrinterName.trim();
    if (!name) return;
    const item: SystemPrinterItem = {
      name,
      source: "local_agent",
      isDefault: true,
      details: "Bu Bilgisayara Özel Tanımlanan Yerel Yazıcı",
    };
    PrinterService.saveClientPrinter(item, user?.id);
    setManualPrinterName("");
    showSuccess(`"${name}" bu bilgisayarın yerel yazıcısı olarak eklendi ve seçildi.`);
    handleOpenSystemPrinters();
    handleSelectSystemPrinter(name);
  };

  const handleAddDirectPrinter = (pName: string) => {
    const item: SystemPrinterItem = {
      name: pName,
      source: "local_agent",
      isDefault: true,
      details: "Bu Bilgisayarın Denetim Masası Yazıcısı",
    };
    PrinterService.saveClientPrinter(item, user?.id);
    showSuccess(`"${pName}" seçildi ve bu bilgisayara kaydedildi.`);
    handleOpenSystemPrinters();
    handleSelectSystemPrinter(pName);
  };

  const handleSelectSystemPrinter = (printerName: string) => {
    handleInputChange("cihazAdi", printerName);
    if (!formData.ad || formData.ad.trim() === "" || formData.ad === formData.cihazAdi) {
      handleInputChange("ad", printerName);
    }
    setShowSystemPrintersModal(false);
  };

  // Load all printers
  const loadData = async (targetIndex?: number) => {
    try {
      setIsLoading(true);
      setAlertError(null);

      const list = await PrinterService.getYazicilar();
      setYazicilar(list || []);

      if (list && list.length > 0 && targetIndex !== undefined) {
        const idx = targetIndex >= 0 && targetIndex < list.length
          ? targetIndex
          : 0;
        setSelectedIndex(idx);
        handleSelectYazici(list[idx], idx);
      } else {
        handleClear(false);
      }
    } catch (err: any) {
      setAlertError(err.message || "Yazıcı tanımları yüklenirken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectYazici = (yazici: YaziciItem, idx?: number) => {
    setSelectedYazici(yazici);
    if (idx !== undefined) {
      setSelectedIndex(idx);
    } else {
      const foundIdx = yazicilar.findIndex((y) => y.id === yazici.id);
      if (foundIdx !== -1) setSelectedIndex(foundIdx);
    }
    setIsNewRecord(false);
    setFormData({
      siraNo: yazici.siraNo,
      ad: yazici.ad,
      cihazAdi: yazici.cihazAdi || "",
      baglantiNoktasi: yazici.baglantiNoktasi || "",
      belgeYaziciModu: yazici.belgeYaziciModu,
      belgeYaziciDizini: yazici.belgeYaziciDizini || "",
      kopyaSayisi: yazici.kopyaSayisi,
    });
    setAlertError(null);
  };

  const handleClear = (showAlert: boolean = true) => {
    setSelectedYazici(null);
    setIsNewRecord(true);
    setFormData({
      ...initialFormState,
      siraNo: "" as any,
      ad: "",
      cihazAdi: "",
      baglantiNoktasi: "",
      belgeYaziciModu: 1,
      belgeYaziciDizini: "",
      kopyaSayisi: 1,
    });
    if (showAlert) {
      setAlertSuccess("Form alanları temizlendi. Yeni bilgileri girip sol üstteki 'Kaydet' (💾) butonuna basınız.");
      setTimeout(() => setAlertSuccess(null), 3500);
    }
    setAlertError(null);
  };

  const handleNewYazici = () => {
    handleClear();
  };


  const handleNavigate = (direction: "first" | "prev" | "next" | "last") => {
    if (yazicilar.length === 0) return;
    let newIdx = selectedIndex;
    if (direction === "first") newIdx = 0;
    else if (direction === "prev") newIdx = Math.max(0, selectedIndex - 1);
    else if (direction === "next") newIdx = Math.min(yazicilar.length - 1, selectedIndex + 1);
    else if (direction === "last") newIdx = yazicilar.length - 1;

    setSelectedIndex(newIdx);
    handleSelectYazici(yazicilar[newIdx], newIdx);
  };

  const handleInputChange = (field: keyof YaziciFormData, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Unified save handler for creating new and updating existing printer records
  const handleSave = async () => {
    setAlertError(null);

    // 1. Türkçe Zorunlu Alan Doğrulamaları
    if (!formData.ad || !formData.ad.trim()) {
      setAlertError("⚠️ Zorunlu Alan Eksik: Lütfen Yazıcı Tanım Adını (Paylaşım Adı) giriniz.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (formData.ad.trim().length > 200) {
      setAlertError("⚠️ Geçersiz Giriş: Yazıcı adı en fazla 200 karakter olabilir.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    let cleanSiraNo = parseInt(String(formData.siraNo), 10);
    if (isNaN(cleanSiraNo) || cleanSiraNo <= 0) {
      const maxSira = yazicilar.reduce((max, y) => {
        const s = Number(y.siraNo);
        return !isNaN(s) && s > max ? s : max;
      }, 0);
      cleanSiraNo = Math.max(maxSira + 1, yazicilar.length + 1);
    }
    const cleanKopyaSayisi = parseInt(String(formData.kopyaSayisi), 10) || 1;

    const payload: YaziciFormData = {
      ...formData,
      siraNo: cleanSiraNo,
      kopyaSayisi: cleanKopyaSayisi,
    };

    try {
      setIsSaving(true);
      setAlertError(null);

      if (isNewRecord || !selectedYazici) {
        const created = await PrinterService.createYazici(payload);
        setAlertSuccess(`✅ "${created.ad}" yazıcısı veritabanına başarıyla eklendi.`);
        await loadData();
        handleClear(false);
      } else {
        const updated = await PrinterService.updateYazici(selectedYazici.id, payload);
        setAlertSuccess(`✅ "${updated.ad}" yazıcı bilgileri başarıyla güncellendi.`);
        await loadData();
        handleClear(false);
      }

      // Seçilen yazıcıyı bilgisayara özel benzersiz Terminal UUID ile tarayıcı hafızasına kaydet
      const terminalUUID = PrinterService.getTerminalUUID();
      const chosenDevice = payload.cihazAdi || payload.ad;
      if (chosenDevice) {
        PrinterService.saveClientPrinter({
          name: chosenDevice,
          source: "browser",
          isDefault: true,
          details: `Bu Bilgisayarın Denetim Masası Yazıcısı [Terminal: ${terminalUUID.substring(0, 10)}]`,
        }, user?.id);
        localStorage.setItem("likya_terminal_last_printer", chosenDevice);
      }

      setTimeout(() => setAlertSuccess(null), 4500);
    } catch (err: any) {
      setAlertError(`❌ Kaydetme Başarısız: ${err.message || "İşlem sırasında beklenmeyen bir hata oluştu."}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsSaving(false);
    }
  };


  const handleOpenDeleteConfirm = (yazici: YaziciItem) => {
    setDeleteConfirm({
      yazici,
      loadingUsage: true,
    });

    PrinterService.getYaziciUsage(yazici.id)
      .then((usage) => {
        setDeleteConfirm((prev) =>
          prev && prev.yazici.id === yazici.id
            ? { ...prev, loadingUsage: false, usage }
            : prev
        );
      })
      .catch(() => {
        setDeleteConfirm((prev) =>
          prev && prev.yazici.id === yazici.id
            ? { ...prev, loadingUsage: false }
            : prev
        );
      });
  };

  const handleExecuteDelete = async (
    yazici: YaziciItem,
    usage?: YaziciUsageInfo
  ) => {
    setDeleteConfirm(null);
    try {
      setIsSaving(true);
      await PrinterService.deleteYazici(yazici.id, { force: true });

      const cleanedParts: string[] = [];
      if (usage?.hasVezne) cleanedParts.push("vezne tanımlarından");
      if (usage?.hasKullanici) cleanedParts.push("kullanıcı atamalarından");
      if (usage?.hasNumerator) cleanedParts.push("numaratör serilerinden");
      cleanedParts.push("yazıcı tanımlarından ve sistemden");

      setAlertSuccess(
        `✅ "${yazici.ad}" yazıcısı; ${cleanedParts.join(", ")} başarıyla silindi ve temizlendi.`
      );
      await loadData(Math.max(0, selectedIndex - 1));
      setTimeout(() => setAlertSuccess(null), 5000);
    } catch (err: any) {
      setAlertError(
        `❌ Silme Başarısız: ${err.message || "Yazıcı silinirken bir hata oluştu."}`
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered printers list
  const filteredYazicilar = yazicilar.filter((y) => {
    const s = searchTerm.toLowerCase();
    return (
      y.ad.toLowerCase().includes(s) ||
      (y.cihazAdi && y.cihazAdi.toLowerCase().includes(s)) ||
      (y.baglantiNoktasi && y.baglantiNoktasi.toLowerCase().includes(s))
    );
  });

  const handlePrint = () => {
    printReportTable<YaziciItem>({
      title: "Yazıcı Tanımları Listesi Raporu",
      subtitle: `Aktif Tanımlı Yazıcılar Dökümü (${filteredYazicilar.length} Kayıt)`,
      data: filteredYazicilar,
      columns: [
        { header: "Sıra", key: "siraNo", width: "8%", align: "center" },
        { header: "Yazıcı Adı / Tanım", key: "ad", width: "32%" },
        { header: "Sistem Aygıtı / Cihaz Adı", key: "cihazAdi", width: "32%" },
        { header: "Bağlantı Noktası (Port)", key: "baglantiNoktasi", width: "16%" },
        { header: "Kopya", key: "kopyaSayisi", width: "12%", align: "center" },
      ],
      summaryInfo: `Toplam Tanımlı Yazıcı: ${filteredYazicilar.length}`,
    });
  };

  return (
    <div className="w-100 pb-3">
      {/* 1. Sol Üst Klasik ERP Toolbar */}
      <ERPToolbar
        pageTitle="Yazıcı Tanımları"
        pageIcon={<IconPrinter size={20} />}
        onNew={handleNewYazici}
        onSave={handleSave}
        onSearch={() => setShowLookupModal(true)}
        onDelete={() => {
          if (selectedYazici && !isNewRecord) {
            handleOpenDeleteConfirm(selectedYazici);
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
        modeText={isNewRecord ? "Yeni Kayıt Modu" : `Düzenleme: [${formData.siraNo}] ${formData.ad}`}
      />


      {/* Notifications: Sağ altta beliren ve otomatik kaybolan toast */}
      {(alertSuccess || alertError) && (
        <div className="erp-toast-container">
          {alertSuccess && (
            <Alert variant="success" className="erp-toast-item d-flex align-items-center gap-2 py-2 mb-0 shadow border-0" dismissible onClose={() => setAlertSuccess(null)}>
              <IconCheck size={18} />
              <span>{alertSuccess}</span>
            </Alert>
          )}

          {alertError && (
            <Alert variant="danger" className="erp-toast-item d-flex align-items-center gap-2 py-2 mb-0 shadow border-0" dismissible onClose={() => setAlertError(null)}>
              <IconAlertCircle size={18} />
              <span>{alertError}</span>
            </Alert>
          )}
        </div>
      )}

      {/* 2. Main Container Card (Tam Sayfa Dış Kenarlık) */}
      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Body className="p-3 p-md-4">
          <Row>
            <Col lg={7} md={12}>
              {(() => {
                const labelColStyle = { width: "155px", flex: "0 0 155px", maxWidth: "155px" };
                return (
                  <Form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                    {/* Sıra No */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                        Sıra No :
                      </Form.Label>
                      <Col>
                        <div style={{ maxWidth: "130px" }}>
                          <Form.Control
                            autoFocus
                            size="sm"
                            type="text"
                            inputMode="numeric"
                            placeholder="Otomatik"
                            value={formData.siraNo !== undefined && formData.siraNo !== null ? formData.siraNo : ""}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, "");
                              handleInputChange("siraNo", val === "" ? "" : parseInt(val, 10));
                            }}
                            className="font-monospace text-dark"
                          />
                        </div>
                      </Col>
                    </Form.Group>

                    {/* Yazıcı Tanımı / Adı - Programdaki ismi (Dürbünsüz) */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                        Yazıcı Tanımı / Adı <span className="text-danger">*</span> :
                      </Form.Label>
                      <Col>
                        <div style={{ maxWidth: "340px" }}>
                          <Form.Control
                            type="text"
                            size="sm"
                            maxLength={200}
                            placeholder="Örn: Fiş Yazıcısı"
                            value={formData.ad}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleInputChange("ad", e.target.value)}
                            required
                          />
                        </div>
                      </Col>
                    </Form.Group>

                    {/* Cihaz / Aygıt Adı - Datalist + Dropdown Seçim + Dürbünlü Arama */}
                    <Form.Group as={Row} className="mb-2 align-items-center g-2">
                      <Form.Label column style={labelColStyle} className="small fw-semibold text-secondary text-start text-nowrap mb-0">
                        Cihaz / Aygıt Adı :
                      </Form.Label>
                      <Col>
                        <div style={{ maxWidth: "480px" }} className="d-flex align-items-center gap-1.5 flex-wrap">
                          <div className="flex-grow-1" style={{ minWidth: "220px" }}>
                            <CodeLookupInput
                              list="system-printers-datalist"
                              value={formData.cihazAdi || ""}
                              maxLength={200}
                              placeholder="Yazıcı seçiniz veya yazınız"
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleInputChange("cihazAdi", e.target.value)}
                              onLookupClick={handleOpenSystemPrinters}
                              lookupTitle="Bilgisayardaki Aktif Yazıcıları Listele ve Seç (Denetim Masası)"
                            />
                            <datalist id="system-printers-datalist">
                              {printerList.map((pName) => (
                                <option key={pName} value={pName}>
                                  {pName}
                                </option>
                              ))}
                            </datalist>
                          </div>

                          {printerList.length > 0 && (
                            <div style={{ minWidth: "160px", maxWidth: "240px" }}>
                              <Form.Select
                                size="sm"
                                value={formData.cihazAdi || ""}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleInputChange("cihazAdi", e.target.value);
                                  }
                                }}
                                className="font-monospace text-dark"
                                title="Bu bilgisayardaki yazıcılar arasından seç"
                              >
                                <option value="">-- Seçiniz --</option>
                                {printerList.map((pName) => (
                                  <option key={pName} value={pName}>
                                    {pName}
                                  </option>
                                ))}
                              </Form.Select>
                            </div>
                          )}

                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="py-1 px-2.5 d-flex align-items-center gap-1 text-nowrap shadow-xs fw-semibold"
                            onClick={handleGetPrinters}
                            title="Bu bilgisayara bağlı yazıcıları tara ve listele"
                          >
                            <IconPrinter size={15} />
                            <span style={{ fontSize: "11px" }}>Yazıcıları Getir</span>
                          </Button>
                        </div>
                      </Col>
                    </Form.Group>
                  </Form>
                );
              })()}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Dürbün Yazıcı Arama & Seçme Modalı (Liste Verisi Yoksa Bomboş) */}
      <LookupModal<YaziciItem>
        show={showLookupModal}
        onHide={() => setShowLookupModal(false)}
        title="Yazıcı Tanımı Seçimi"
        searchPlaceholder="Yazıcı adı, cihaz veya port ile ara..."
        items={yazicilar}
        isLoading={isLoading}
        filterFn={(item, term) => {
          const t = term.toLowerCase();
          return (
            item.ad.toLowerCase().includes(t) ||
            (item.cihazAdi && item.cihazAdi.toLowerCase().includes(t)) ||
            (item.baglantiNoktasi && item.baglantiNoktasi.toLowerCase().includes(t)) ||
            String(item.siraNo).includes(t)
          );
        }}
        columns={[
          {
            header: "Sıra",
            width: "70px",
            align: "center",
            render: (y) => <span className="badge bg-light text-dark border font-monospace fw-bold">{y.siraNo}</span>,
          },
          {
            header: "Yazıcı Tanım Adı",
            render: (y) => <span className="fw-semibold text-dark">{y.ad}</span>,
          },
          {
            header: "Cihaz / Aygıt Adı",
            render: (y) => <span className="text-secondary">{y.cihazAdi || "-"}</span>,
          },
        ]}
        onSelect={(y) => {
          const foundIdx = yazicilar.findIndex((item) => item.id === y.id);
          handleSelectYazici(y, foundIdx !== -1 ? foundIdx : 0);
        }}
      />

      {/* Bilgisayardaki Aktif Yazıcıları Seçme Modalı (Denetim Masası / Aygıtlar ve Yazıcılar) */}
      {/* Bilgisayardaki Aktif Yazıcılar (Tarayıcı İstemci İzni & Denetim Masası) Modalı */}
      <Modal
        show={showSystemPrintersModal}
        onHide={() => setShowSystemPrintersModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconPrinter size={20} className="text-primary" />
            <span>Bilgisayardaki Aktif Yazıcılar (İstemci Aygıtları & Denetim Masası)</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {/* Denetim Masası ve Yerel Yazıcı Durumu */}
          {(() => {
            const hasPrinters = systemPrinters.length > 0;
            return hasPrinters ? (
              <div className="alert alert-success bg-success bg-opacity-10 border-success border-opacity-25 py-2 px-3 small mb-2.5 d-flex align-items-center justify-content-between rounded-2 shadow-xs">
                <div className="d-flex align-items-center gap-2">
                  <IconCheck size={20} className="text-success flex-shrink-0" />
                  <div>
                    <strong className="text-success">Bu Bilgisayarın Denetim Masası Yazıcıları Aktif ({systemPrinters.length} Adet)</strong>
                    <span className="text-dark ms-1.5">
                      — İstemci bilgisayarınızdaki yazıcılar doğrudan algılandı ve listelendi.
                    </span>
                  </div>
                </div>
                <Badge bg="success" className="px-2 py-1">
                  🟢 {systemPrinters.length} Yazıcı Hazır
                </Badge>
              </div>
            ) : (
              <div className="alert alert-info bg-info bg-opacity-10 border-info border-opacity-25 p-2.5 small mb-2.5 rounded-2 shadow-xs">
                <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                  <div className="d-flex align-items-center gap-2">
                    <IconPrinter size={20} className="text-primary flex-shrink-0" />
                    <div>
                      <div className="fw-bold text-dark mb-0.5">
                        Doğrudan Bu Bilgisayara Bağlı Yazıcıları Tara
                      </div>
                      <div className="text-secondary" style={{ lineHeight: "1.3" }}>
                        Kurulum gerektirmeden, tarayıcınız üzerinden bilgisayarınıza takılı olan fiş ve etiket yazıcılarını algılar.
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    className="fw-bold d-flex align-items-center gap-1.5 py-1 px-3 shadow-xs text-nowrap"
                    onClick={handleGetPrinters}
                    disabled={isLoadingSystemPrinters}
                    title="Bağlı yazıcıları tarar ve izin ister"
                  >
                    <IconRefresh size={15} />
                    <span>🌐 Yazıcıları Tara / İzin Ver</span>
                    {isLoadingSystemPrinters && <Spinner size="sm" animation="border" className="ms-1" />}
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* Hızlı Seçim ve Doğrudan Tarama Çubuğu */}
          <div className="p-2 mb-2.5 rounded bg-light border d-flex flex-wrap align-items-center justify-content-between gap-2 shadow-xs">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <Button
                variant="outline-primary"
                size="sm"
                className="fw-bold d-flex align-items-center gap-1.5 py-1 px-2.5 shadow-xs"
                onClick={handleGetPrinters}
                disabled={isLoadingSystemPrinters}
                title="Chromium / Windows Spooler üzerinden bu bilgisayara bağlı yazıcıları doğrudan tara ve listele"
              >
                <IconPrinter size={16} />
                <span>🌐 Bilgisayar Yazıcılarını Tara</span>
                {isLoadingSystemPrinters && <Spinner size="sm" animation="border" className="ms-1" />}
              </Button>

              {permissionStatus && (
                <span className="small text-muted fst-italic ms-2">{permissionStatus}</span>
              )}
            </div>

            <div className="d-flex align-items-center gap-1.5">
              <span className="small text-secondary fw-semibold text-nowrap">veya Yazıcı Adı Gir:</span>
              <div className="input-group input-group-sm" style={{ width: "230px" }}>
                <Form.Control
                  type="text"
                  placeholder="Örn: POS-80C"
                  value={manualPrinterName}
                  onChange={(e) => setManualPrinterName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddManualLocalPrinter();
                    }
                  }}
                  className="py-0.5"
                />
                <Button
                  variant="primary"
                  onClick={handleAddManualLocalPrinter}
                  disabled={!manualPrinterName.trim()}
                  className="fw-semibold px-2.5"
                  title="Bu bilgisayara özel yazıcı olarak kaydeder ve forma atar"
                >
                  Ekle
                </Button>
              </div>
            </div>
          </div>

          {/* Arama ve Canlı Listeyi Yenileme Çubuğu */}
          <div className="d-flex align-items-center justify-content-between gap-2 mb-2 p-1.5 bg-light rounded border">
            <div className="input-group input-group-sm" style={{ maxWidth: "380px" }}>
              <span className="input-group-text bg-white px-2">
                <IconSearch size={14} className="text-secondary" />
              </span>
              <Form.Control
                type="text"
                placeholder="Canlı yazıcılarda ara (Epson, PDF, Terminal vb.)..."
                value={systemPrinterSearchTerm}
                onChange={(e) => setSystemPrinterSearchTerm(e.target.value)}
                className="py-0.5"
              />
            </div>

            <div className="d-flex align-items-center gap-1.5">
              <Button
                variant="primary"
                size="sm"
                className="py-0.5 px-3 d-flex align-items-center gap-1.5 fw-semibold shadow-xs"
                onClick={handleOpenSystemPrinters}
                disabled={isLoadingSystemPrinters}
                title="Canlı Yazıcı Listesini Yenile"
              >
                <IconRefresh size={14} />
                <span>Canlı Listeyi Yenile</span>
              </Button>
            </div>
          </div>

          {isLoadingSystemPrinters ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" size="sm" className="me-2" />
              <span className="text-secondary small">Bu bilgisayardaki yazıcılar taranıyor, lütfen bekleyiniz...</span>
            </div>
          ) : (
            <div className="table-responsive border rounded mb-2" style={{ maxHeight: "320px", overflowY: "auto" }}>
              <table className="table table-hover table-sm align-middle mb-0 user-select-none">
                <thead className="table-light sticky-top">
                  <tr>
                    <th style={{ width: "40px" }} className="text-center">#</th>
                    <th>Yazıcı / Aygıt Adı (Denetim Masası / Donanım)</th>
                    <th style={{ width: "170px" }} className="text-center">Kaynak</th>
                    <th style={{ width: "90px" }} className="text-end">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = systemPrinters.filter((p) =>
                      !systemPrinterSearchTerm
                        ? true
                        : p.name.toLowerCase().includes(systemPrinterSearchTerm.toLowerCase())
                    );
                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-muted">
                            <div className="fw-semibold">Bu bilgisayarda henüz algılanan yazıcı bulunamadı.</div>
                            <div className="small mt-1">
                              Yukarıdaki <strong>"🌐 Bilgisayar Yazıcılarını Tara"</strong> butonuna basarak bilgisayarınızdaki yazıcıları doğrudan ekleyebilirsiniz.
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    return filtered.map((p, idx) => {
                      const isSelected = selectedSystemPrinterName === p.name;
                      return (
                        <tr
                          key={idx}
                          style={{ cursor: "pointer" }}
                          onClick={() => setSelectedSystemPrinterName(p.name)}
                          onDoubleClick={() => handleSelectSystemPrinter(p.name)}
                          className={isSelected ? "table-primary fw-semibold" : ""}
                          title="Tek tıklama: Satırı seçer | Çift tıklama: Forma atar ve kapatır"
                        >
                          <td className="text-center text-secondary small">{idx + 1}</td>
                          <td>
                            <div className="d-flex flex-column">
                              <div className="d-flex align-items-center gap-2">
                                <IconPrinter size={18} className="text-primary opacity-75" />
                                <span className={isSelected ? "text-primary fw-bold" : "text-dark"}>
                                  {p.name}
                                </span>
                                {formData.cihazAdi === p.name && (
                                  <Badge bg="primary" className="ms-1 px-1.5 py-0.5">Mevcut</Badge>
                                )}
                                {p.isDefault && (
                                  <Badge bg="success" className="ms-1 px-1.5 py-0.5">Varsayılan</Badge>
                                )}
                              </div>
                              {p.details && (
                                <div className="text-muted small ps-4" style={{ fontSize: "11px" }}>
                                  {p.details}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="text-center">
                            {p.details?.includes("Ağ") || p.details?.includes("Wi-Fi") ? (
                              <Badge bg="info" className="px-2 py-0.5">🌐 Ağ / Wi-Fi Yazıcısı</Badge>
                            ) : p.details?.includes("USB") || p.source === "usb" ? (
                              <Badge bg="primary" className="px-2 py-0.5">🔌 USB Cihaz (Takılı)</Badge>
                            ) : p.source === "local_agent" ? (
                              <Badge bg="success" className="px-2 py-0.5">💻 Bu Bilgisayar (Denetim Masası)</Badge>
                            ) : p.source === "browser" ? (
                              <Badge bg="primary" className="px-2 py-0.5">🌐 Tarayıcı / Windows</Badge>
                            ) : p.source === "user_assigned" ? (
                              <Badge bg="info" className="px-2 py-0.5">👤 Kullanıcı Yazıcısı</Badge>
                            ) : p.source === "server" ? (
                              <Badge bg="secondary" className="px-2 py-0.5">🏢 Sunucuda Kayıtlı</Badge>
                            ) : p.source === "serial" ? (
                              <Badge bg="warning" text="dark" className="px-2 py-0.5">🔌 Seri Port</Badge>
                            ) : (
                              <Badge bg="secondary" className="px-2 py-0.5">🖥️ Sistem</Badge>
                            )}
                          </td>
                          <td className="text-end">
                            <Button
                              variant={isSelected ? "primary" : "outline-primary"}
                              size="sm"
                              className="py-0 px-2.5 fw-semibold"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSystemPrinter(p.name);
                              }}
                            >
                              Seç
                            </Button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light py-2 px-3 d-flex justify-content-between align-items-center">
          <div className="small text-muted">
            {selectedSystemPrinterName ? (
              <span>Seçili Yazıcı: <strong className="text-dark">{selectedSystemPrinterName}</strong> (Çift tıkla veya 'Seç' butonuyla atayabilirsiniz)</span>
            ) : (
              <span>Tek tıklama satırı seçer, çift tıklama forma aktarır.</span>
            )}
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedSystemPrinterName}
              onClick={() => handleSelectSystemPrinter(selectedSystemPrinterName)}
              className="fw-bold px-3"
            >
              Seç ve Ata
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowSystemPrintersModal(false)}>
              Kapat
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Yazıcı Silme Onay Popup'ı (Sayfa ortasında, nerelerden silineceğini açıkça listeleyen popup) */}
      <Modal
        show={!!deleteConfirm}
        onHide={() => !isSaving && setDeleteConfirm(null)}
        centered
        backdrop="static"
        keyboard={!isSaving}
        size="lg"
        className="delete-confirmation-modal"
      >
        <Modal.Header closeButton={!isSaving} className="bg-light py-2.5 px-3 border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconAlertCircle size={20} className="text-danger" />
            <span>Yazıcı Silme Bildirimi</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3.5">
          <div className="d-flex align-items-center gap-2 mb-3 pb-2.5 border-bottom">
            <div
              className="p-2.5 rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center"
              style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}
            >
              <IconTrash size={26} />
            </div>
            <div className="flex-grow-1">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold fs-5 text-dark">{deleteConfirm?.yazici.ad}</span>
                <Badge bg="danger" className="text-uppercase px-2.5 py-1 fs-7">
                  Sıra No: {deleteConfirm?.yazici.siraNo}
                </Badge>
                {deleteConfirm?.yazici.baglantiNoktasi && (
                  <Badge bg="secondary" className="px-2 py-1 fs-7">
                    Port: {deleteConfirm.yazici.baglantiNoktasi}
                  </Badge>
                )}
              </div>
              <div className="text-secondary small mt-0.5">
                Bu yazıcının sistemdeki kullanım alanları ve silineceği yerler aşağıda listelenmiştir:
              </div>
            </div>
          </div>

          {deleteConfirm?.loadingUsage ? (
            <div className="py-4 text-center text-muted small d-flex flex-column align-items-center gap-2">
              <Spinner size="sm" animation="border" variant="danger" />
              <span>Yazıcının veritabanındaki kullanım alanları taranıyor...</span>
            </div>
          ) : (
            <div>
              <div className="fw-bold text-dark small mb-2 d-flex align-items-center gap-1.5">
                <span>Silme İşleminde Temizlenecek ve Kaldırılacak Yerler:</span>
              </div>

              <div className="d-flex flex-column gap-2 mb-3">
                {/* 1. Vezne Tanımları (Fiş ve Form Yazıcıları) */}
                {deleteConfirm?.usage?.hasVezne ? (
                  <div className="p-2.5 rounded border border-danger-subtle bg-danger-subtle bg-opacity-25 d-flex align-items-start gap-2.5">
                    <IconPrinter size={20} className="text-danger flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-danger small">
                          1. Vezne Tanımları ({deleteConfirm.usage.vezneCount} Adet Vezne)
                        </strong>
                        <Badge bg="danger">Yazıcı Seçimleri Sıfırlanacak</Badge>
                      </div>
                      <div className="mt-1 small">
                        <div className="text-dark mb-1">Bu yazıcının tanımlı olduğu vezneler ve fiş tipleri:</div>
                        <div className="d-flex flex-column gap-1 bg-white p-2 rounded border border-danger-subtle">
                          {deleteConfirm.usage.vezneDetails?.map((v, idx) => (
                            <div key={idx} className="d-flex justify-content-between align-items-center text-dark">
                              <span><strong>{v.vezneKod}</strong> - {v.vezneAd}</span>
                              <div className="d-flex gap-1 flex-wrap">
                                {v.roles.map((r, rIdx) => (
                                  <span key={rIdx} className="badge bg-light text-danger border border-danger-subtle fw-semibold">
                                    {r}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-muted small mt-1">
                        Bu veznelerdeki ilgili fiş/form yazıcı seçimleri kaldırılarak boşaltılacaktır.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded border border-light bg-light d-flex align-items-center gap-2 text-muted small">
                    <IconCheck size={16} className="text-success" />
                    <span><strong>1. Vezne Tanımları:</strong> Hiçbir vezneye fiş veya form yazıcısı olarak atanmamış.</span>
                  </div>
                )}

                {/* 2. Kullanıcı Tanımları (Varsayılan Yazıcı) */}
                {deleteConfirm?.usage?.hasKullanici ? (
                  <div className="p-2.5 rounded border border-warning-subtle bg-warning-subtle bg-opacity-25 d-flex align-items-start gap-2.5">
                    <IconPrinter size={20} className="text-warning flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-warning-emphasis small">
                          2. Kullanıcı Tanımları ({deleteConfirm.usage.kullaniciCount} Kullanıcı)
                        </strong>
                        <Badge bg="warning" text="dark">Varsayılan Yazıcı Sıfırlanacak</Badge>
                      </div>
                      <div className="text-dark small mt-1">
                        Varsayılan Yazıcı Olarak Seçen Kullanıcılar:{" "}
                        <strong>{deleteConfirm.usage.kullaniciNames?.join(", ")}</strong>
                      </div>
                      <div className="text-muted small mt-0.5">
                        Bu kullanıcıların varsayılan yazıcı ataması temizlenecektir.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded border border-light bg-light d-flex align-items-center gap-2 text-muted small">
                    <IconCheck size={16} className="text-success" />
                    <span><strong>2. Kullanıcı Tanımları:</strong> Herhangi bir kullanıcının varsayılan yazıcısı olarak seçili değil.</span>
                  </div>
                )}

                {/* 3. Numaratör / Seri No Tanımları */}
                {deleteConfirm?.usage?.hasNumerator ? (
                  <div className="p-2.5 rounded border border-danger-subtle bg-danger-subtle bg-opacity-25 d-flex align-items-start gap-2.5">
                    <IconAdjustments size={20} className="text-danger flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-danger small">
                          3. Numaratör Tanımları ({deleteConfirm.usage.numeratorCount} Adet Özel Seri)
                        </strong>
                        <Badge bg="danger">Silinecek</Badge>
                      </div>
                      <div className="text-dark small mt-1">
                        Bu yazıcıya bağlı özel evrak seri tanımları:{" "}
                        <strong>{deleteConfirm.usage.numeratorDetails?.map((n) => `Tür ${n.tur} (${n.onek})`).join(", ")}</strong>
                      </div>
                      <div className="text-muted small mt-0.5">
                        Yazıcıya özel numaratör serileri sistemden kaldırılacaktır (Genel numaratörler korunur).
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded border border-light bg-light d-flex align-items-center gap-2 text-muted small">
                    <IconCheck size={16} className="text-success" />
                    <span><strong>3. Numaratör Tanımları:</strong> Bu yazıcıya özel ayrılmış numaratör serisi bulunmuyor.</span>
                  </div>
                )}

                {/* 4. Yazıcı Tanım Kartı */}
                <div className="p-2.5 rounded border border-danger-subtle bg-white d-flex align-items-start gap-2.5">
                  <IconTrash size={20} className="text-danger flex-shrink-0 mt-0.5" />
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center justify-content-between">
                      <strong className="text-danger small">4. Yazıcı Tanım Kartı</strong>
                      <Badge bg="danger">Tamamen Silinecek</Badge>
                    </div>
                    <div className="text-muted small mt-0.5">
                      <strong>[{deleteConfirm?.yazici.siraNo}] {deleteConfirm?.yazici.ad}</strong> yazıcı kartı sistemden kalıcı olarak silinecektir.
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="alert alert-warning py-2.5 px-3 small mb-0 border-0 rounded-2 text-dark d-flex align-items-start gap-2 shadow-xs"
                style={{ backgroundColor: "#fef3c7" }}
              >
                <IconAlertCircle size={20} className="text-warning flex-shrink-0 mt-0.5" />
                <span>
                  <strong>"Yine de Sil"</strong> butonuna bastığınızda, bu yazıcı yukarıda listelenen tüm yerlerden (vezneler, kullanıcılar ve numaratör tanımları) otomatik olarak kaldırılacak ve sistemden silinecektir.
                </span>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light py-2 px-3 border-top d-flex justify-content-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="px-3"
            onClick={() => setDeleteConfirm(null)}
            disabled={isSaving}
          >
            Vazgeç
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="px-3 fw-bold d-flex align-items-center gap-1.5 shadow-xs"
            onClick={() =>
              deleteConfirm &&
              handleExecuteDelete(deleteConfirm.yazici, deleteConfirm.usage)
            }
            disabled={isSaving || deleteConfirm?.loadingUsage}
          >
            {isSaving ? (
              <>
                <Spinner size="sm" animation="border" />
                <span>Siliniyor...</span>
              </>
            ) : (
              <>
                <IconTrash size={16} />
                <span>Yine de Sil</span>
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PrinterDefinitionsPage;

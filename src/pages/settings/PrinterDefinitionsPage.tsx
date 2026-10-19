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
  isNonPrinterHardware,
  getLocalPrintersFromStorage,
  saveLocalPrintersToStorage,
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

  const { showError } = useToast();

  // UI / Status states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [alertError, setAlertError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    yazici: YaziciItem;
    loadingUsage?: boolean;
    usage?: YaziciUsageInfo;
  } | null>(null);
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);
  const [showSystemPrintersModal, setShowSystemPrintersModal] = useState<boolean>(false);
  const [printerList, setPrinterList] = useState<string[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinterItem[]>([]);
  const [isLoadingSystemPrinters, setIsLoadingSystemPrinters] = useState<boolean>(false);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
  const [selectedSystemPrinterName, setSelectedSystemPrinterName] = useState<string>("");
  const [systemPrinterSearchTerm, setSystemPrinterSearchTerm] = useState<string>("");
  const [isAgentOnline, setIsAgentOnline] = useState<boolean | null>(null);
  const [agentErrorMessage, setAgentErrorMessage] = useState<string | null>(null);

  // Sadece bu bilgisayara bağlı / Chrome Yazdır penceresindeki gerçek yazıcıları listeler (Sunucu verisi eklemez)
  const updateClientPrinterLists = (
    detectedList: (SystemPrinterItem | string)[] = systemPrinters
  ): SystemPrinterItem[] => {
    const printerMap = new Map<string, SystemPrinterItem>();

    // 1. Tarayıcı / Spooler / İstemcide Algılanan Gerçek Bilgisayar Yazıcıları
    (detectedList || []).forEach((item) => {
      const rawName = typeof item === "string" ? item : item.name;
      if (!rawName) return;
      const trimmed = rawName.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      const isVirtual = isVirtualSystemPrinter(trimmed);
      const isNet =
        trimmed.startsWith("\\\\") ||
        trimmed.includes("192.168.") ||
        trimmed.toLowerCase().includes("ağ") ||
        trimmed.toLowerCase().includes("network") ||
        trimmed.toLowerCase().includes("wi-fi") ||
        trimmed.toLowerCase().includes("wifi");

      printerMap.set(key, {
        name: trimmed,
        isDefault: typeof item === "object" ? Boolean(item.isDefault) : false,
        isOnline: typeof item === "object" && item.isOnline !== undefined ? Boolean(item.isOnline) : true,
        source: isVirtual ? "system" : typeof item === "object" && item.source ? item.source : "local_agent",
        details: isVirtual
          ? "📄 Sanal Yazıcı / Belge Çıktısı (PDF / XPS)"
          : typeof item === "object" && item.details
          ? item.details
          : isNet
          ? "📶 Bu Bilgisayara Bağlı Kablosuz / Ağ Yazıcısı"
          : "🔌 printercekmeApp (Yerel Donanım)",
      });
    });

    const allItems = Array.from(printerMap.values());

    // Sıralama: Fiziksel Yazıcılar (Argox, CP-Q1T vb.) en başta, sanal (PDF/XPS) en arkada
    allItems.sort((a, b) => {
      const aVirt = isVirtualSystemPrinter(a.name);
      const bVirt = isVirtualSystemPrinter(b.name);
      if (aVirt && !bVirt) return 1;
      if (!aVirt && bVirt) return -1;
      return a.name.localeCompare(b.name, "tr");
    });

    setSystemPrinters(allItems);
    setPrinterList(allItems.map((p) => p.name));
    return allItems;
  };

  // printercekmeApp (Port 9100) üzerinden yazıcıları canlı çeker
  const loadPrintersFromAgent = async () => {
    setIsLoadingSystemPrinters(true);
    setPermissionStatus("Yerel yazıcı servisi (printercekmeApp:9100) taranıyor...");

    try {
      const res = await PrinterService.fetchFromPrinterCekmeApp();
      if (res.success && res.printers.length > 0) {
        setIsAgentOnline(true);
        setAgentErrorMessage(null);

        const stored = getLocalPrintersFromStorage();
        const combinedNames = Array.from(
          new Set([...res.printers.map((p) => p.name), ...stored])
        );
        saveLocalPrintersToStorage(combinedNames);
        const list = updateClientPrinterLists(res.printers);
        setPermissionStatus(`🟢 printercekmeApp bağlı. ${res.printers.length} adet yerel yazıcı algılandı.`);
        if (list.length > 0) {
          setSelectedSystemPrinterName((prev) => (prev && list.some((p) => p.name === prev) ? prev : list[0].name));
        }
      } else {
        setIsAgentOnline(false);
        setAgentErrorMessage("Yerel yazıcı servisine ulaşılamadı. Lütfen Printer Ajanını başlatın.");
        setPermissionStatus(null);
        // Fallback olarak yerel hafızadaki yazıcıları göster
        const stored = getLocalPrintersFromStorage();
        updateClientPrinterLists(stored);
      }
    } catch (err: any) {
      setIsAgentOnline(false);
      setAgentErrorMessage("Yerel yazıcı servisine ulaşılamadı. Lütfen Printer Ajanını başlatın.");
      setPermissionStatus(null);
    } finally {
      setIsLoadingSystemPrinters(false);
    }
  };

  // Sayfa açıldığında bu istemci bilgisayarın LocalStorage'ındaki kayıtlı yazıcılarını yükle
  useEffect(() => {
    const stored = getLocalPrintersFromStorage();
    updateClientPrinterLists(stored);
  }, []);

  // Modal Açılışı: Otomatik olarak http://127.0.0.1:9100/api/printers adresine istek atar
  const handleOpenSystemPrinters = () => {
    setShowSystemPrintersModal(true);
    setSystemPrinterSearchTerm("");
    setAgentErrorMessage(null);

    const stored = getLocalPrintersFromStorage();
    const currentList = updateClientPrinterLists(stored);
    if (formData.cihazAdi && currentList.some((p) => p.name === formData.cihazAdi)) {
      setSelectedSystemPrinterName(formData.cihazAdi);
    } else if (currentList.length > 0) {
      setSelectedSystemPrinterName(currentList[0].name);
    } else {
      setSelectedSystemPrinterName("");
    }

    // Modal açıldığında otomatik printercekmeApp servisinden yazıcıları çek
    loadPrintersFromAgent();
  };

  const handleGetPrinters = handleOpenSystemPrinters;

  // Seçilen yazıcıyı forma ata ve doğrudan SQL veritabanına kaydet
  const handleSelectAndSaveToSQL = async (printerName: string) => {
    const cleanName = (printerName || "").trim();
    if (!cleanName) return;

    try {
      setIsSaving(true);

      // 1. İstemci LocalStorage'ına ekle
      const stored = getLocalPrintersFromStorage();
      const updated = Array.from(new Set([cleanName, ...stored]));
      saveLocalPrintersToStorage(updated);
      updateClientPrinterLists(updated);

      // 2. Terminal bazlı seçili yazıcı olarak hafızaya al
      const terminalUUID = PrinterService.getTerminalUUID();
      PrinterService.saveClientPrinter(
        {
          name: cleanName,
          source: "local_agent",
          isDefault: true,
          details: `printercekmeApp [Terminal: ${terminalUUID.substring(0, 10)}]`,
        },
        user?.id
      );

      // 3. Form alanlarını otomatik güncelle
      const newAd =
        !formData.ad || formData.ad.trim() === "" || formData.ad === formData.cihazAdi
          ? cleanName
          : formData.ad;

      let cleanSiraNo = parseInt(String(formData.siraNo), 10);
      if (isNaN(cleanSiraNo) || cleanSiraNo <= 0) {
        const maxSira = yazicilar.reduce((max, y) => {
          const s = Number(y.siraNo);
          return !isNaN(s) && s > max ? s : max;
        }, 0);
        cleanSiraNo = Math.max(maxSira + 1, yazicilar.length + 1);
      }

      const payload: YaziciFormData = {
        ...formData,
        siraNo: cleanSiraNo,
        ad: newAd,
        cihazAdi: cleanName,
        kopyaSayisi: parseInt(String(formData.kopyaSayisi), 10) || 1,
      };

      setFormData(payload);

      // 4. Mevcut SQL API rotamıza POST / PUT ederek kaydet
      if (isNewRecord || !selectedYazici) {
        await PrinterService.createYazici(payload);
      } else {
        await PrinterService.updateYazici(selectedYazici.id, payload);
      }

      await loadData();
      setShowSystemPrintersModal(false);
    } catch (err: any) {
      setAlertError(`❌ SQL Kayıt Hatası: ${err.message || "Yazıcı veritabanına kaydedilemedi."}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectSystemPrinter = handleSelectAndSaveToSQL;

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
        await PrinterService.createYazici(payload);
        await loadData();
        handleClear(false);
      } else {
        await PrinterService.updateYazici(selectedYazici.id, payload);
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
      await loadData(Math.max(0, selectedIndex - 1));
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


      {/* Notifications: Sağ altta beliren ve otomatik kaybolan hata bildirimi */}
      {alertError && (
        <div className="erp-toast-container">
          <Alert variant="danger" className="erp-toast-item d-flex align-items-center gap-2 py-2 mb-0 shadow border-0" dismissible onClose={() => setAlertError(null)}>
            <IconAlertCircle size={18} />
            <span>{alertError}</span>
          </Alert>
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
                            <div style={{ minWidth: "170px", maxWidth: "280px" }}>
                              <Form.Select
                                size="sm"
                                value={formData.cihazAdi || ""}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleInputChange("cihazAdi", e.target.value);
                                  }
                                }}
                                className="font-monospace text-dark"
                                title="Tanımlı sistem ve bilgisayar yazıcıları arasından seçiniz"
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
          {/* printercekmeApp (Port 9100) Servis Durumu ve Bildirimleri */}
          {isAgentOnline === true ? (
            <div className="alert alert-success bg-success bg-opacity-10 border-success border-opacity-25 py-2 px-3 small mb-2.5 d-flex align-items-center justify-content-between rounded-2 shadow-xs">
              <div className="d-flex align-items-center gap-2">
                <IconCheck size={20} className="text-success flex-shrink-0" />
                <div>
                  <strong className="text-success">printercekmeApp Yerel Ajanı Bağlı (Port 9100)</strong>
                  <span className="text-dark ms-1.5">
                    — Bilgisayarınızdaki tüm donanım yazıcıları ({systemPrinters.length} Adet) canlı olarak listelendi.
                  </span>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <Badge bg="success" className="px-2 py-1">
                  🟢 {systemPrinters.length} Yazıcı Aktif
                </Badge>
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="fw-semibold py-0.5 px-2.5"
                  onClick={loadPrintersFromAgent}
                  disabled={isLoadingSystemPrinters}
                  title="printercekmeApp üzerinden bilgisayara bağlı yazıcıları yeniden sorgula"
                >
                  <IconRefresh size={14} className="me-1" />
                  <span>Yeniden Tara</span>
                </Button>
              </div>
            </div>
          ) : isAgentOnline === false || agentErrorMessage ? (
            <Alert
              variant="warning"
              className="py-2.5 px-3 small mb-2.5 border-0 rounded-2 text-dark shadow-xs"
              style={{ backgroundColor: "#fef3c7" }}
            >
              <div className="d-flex align-items-start justify-content-between gap-2">
                <div className="d-flex align-items-start gap-2">
                  <IconAlertCircle size={22} className="text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="fw-bold text-dark fs-7">
                      ⚠️ Yerel yazıcı servisine ulaşılamadı. Lütfen Printer Ajanını başlatın.
                    </div>
                    <div className="text-secondary mt-0.5" style={{ lineHeight: "1.35" }}>
                      Bilgisayarınıza takılı fiş ve etiket yazıcılarının doğrudan okunabilmesi için proje dizinindeki{" "}
                      <strong className="text-dark font-monospace">printercekmeApp</strong> servisini başlatınız:
                      <div className="mt-1 font-monospace bg-white border p-1 rounded px-2 text-dark user-select-all" style={{ fontSize: "11px" }}>
                        cd printercekmeApp &amp;&amp; npm start &nbsp; <span className="text-muted">(veya baslat.bat dosyasına çift tıklayın)</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="fw-bold text-nowrap py-1 px-3 d-flex align-items-center gap-1 shadow-xs"
                  onClick={loadPrintersFromAgent}
                  disabled={isLoadingSystemPrinters}
                >
                  <IconRefresh size={15} />
                  <span>Ajanı Yeniden Dene</span>
                  {isLoadingSystemPrinters && <Spinner size="sm" animation="border" className="ms-1" />}
                </Button>
              </div>
            </Alert>
          ) : (
            <div className="p-2 mb-2.5 rounded bg-light border d-flex align-items-center justify-content-between">
              <span className="small text-secondary">
                Yerel yazıcı servisi (printercekmeApp) taranıyor, lütfen bekleyiniz...
              </span>
              <Spinner size="sm" animation="border" variant="primary" />
            </div>
          )}

          {/* Arama ve Canlı Listeyi Yenileme Çubuğu */}
          <div className="d-flex align-items-center justify-content-between gap-2 mb-2 p-1.5 bg-light rounded border">
            <div className="input-group input-group-sm" style={{ maxWidth: "380px" }}>
              <span className="input-group-text bg-white px-2">
                <IconSearch size={14} className="text-secondary" />
              </span>
              <Form.Control
                type="text"
                placeholder="Yazıcılarda ara (POS, Argox, Epson vb.)..."
                value={systemPrinterSearchTerm}
                onChange={(e) => setSystemPrinterSearchTerm(e.target.value)}
                className="py-0.5"
              />
            </div>

            <div className="d-flex align-items-center gap-1.5">
              <Button
                variant="outline-primary"
                size="sm"
                className="py-0.5 px-3 d-flex align-items-center gap-1.5 fw-semibold shadow-xs"
                onClick={loadPrintersFromAgent}
                disabled={isLoadingSystemPrinters}
                title="printercekmeApp (Port 9100) üzerinden yazıcıları canlı yenile"
              >
                <IconRefresh size={14} />
                <span>Yazıcıları Tara</span>
                {isLoadingSystemPrinters && <Spinner size="sm" animation="border" className="ms-1" />}
              </Button>
            </div>
          </div>

          {isLoadingSystemPrinters ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" size="sm" className="me-2" />
              <span className="text-secondary small">printercekmeApp üzerinden bilgisayardaki yazıcılar okunuyor...</span>
            </div>
          ) : (
            <div className="table-responsive border rounded mb-2" style={{ maxHeight: "320px", overflowY: "auto" }}>
              <table className="table table-hover table-sm align-middle mb-0 user-select-none">
                <thead className="table-light sticky-top">
                  <tr>
                    <th style={{ width: "40px" }} className="text-center">#</th>
                    <th>Yazıcı / Aygıt Adı (Denetim Masası / Donanım)</th>
                    <th style={{ width: "170px" }} className="text-center">Durum / Kaynak</th>
                    <th style={{ width: "130px" }} className="text-end">İşlem</th>
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
                            <div className="fw-semibold text-warning">
                              ⚠️ Yerel yazıcı servisine ulaşılamadı. Lütfen Printer Ajanını başlatın.
                            </div>
                            <div className="small mt-1 text-secondary">
                              Bilgisayarınızda <strong>printercekmeApp</strong> servisini başlattıktan sonra yukarıdaki <strong>"Yazıcıları Tara"</strong> butonuna basınız.
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
                          onDoubleClick={() => handleSelectAndSaveToSQL(p.name)}
                          className={isSelected ? "table-primary fw-semibold" : ""}
                          title="Tek tık: Satırı seçer | Çift tık: Seçip SQL veritabanına otomatik kaydeder"
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
                            {(() => {
                              const s = `${p.name} ${p.details || ""}`.toLowerCase();
                              if (isVirtualSystemPrinter(p.name)) {
                                return <Badge bg="secondary" className="px-2 py-0.5">📄 PDF / Sanal</Badge>;
                              }
                              if (s.includes("ağ") || s.includes("network") || s.includes("wi-fi") || s.includes("wifi")) {
                                return <Badge bg="info" className="px-2 py-0.5">📶 Ağ Yazıcısı</Badge>;
                              }
                              return <Badge bg="success" className="px-2 py-0.5">🔌 Hazır (Yerel)</Badge>;
                            })()}
                          </td>
                          <td className="text-end">
                            <div className="d-flex align-items-center justify-content-end gap-1">
                              <Button
                                variant={isSelected ? "primary" : "outline-primary"}
                                size="sm"
                                className="py-0 px-2 fw-semibold text-nowrap"
                                disabled={isSaving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectAndSaveToSQL(p.name);
                                }}
                                title="Bu yazıcıyı seçip SQL veritabanına otomatik kaydeder"
                              >
                                {isSaving && selectedSystemPrinterName === p.name ? (
                                  <Spinner size="sm" animation="border" />
                                ) : (
                                  "Seç ve Ata"
                                )}
                              </Button>
                            </div>
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
              <span>Seçili Yazıcı: <strong className="text-dark">{selectedSystemPrinterName}</strong> ("Seç ve Ata" veya çift tıklama ile doğrudan SQL'e kaydedilir)</span>
            ) : (
              <span>Listeden bir yazıcı seçiniz veya satıra çift tıklayınız.</span>
            )}
          </div>
          <div className="d-flex gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={!selectedSystemPrinterName || isSaving}
              onClick={() => handleSelectAndSaveToSQL(selectedSystemPrinterName)}
              className="fw-bold px-3 d-flex align-items-center gap-1.5"
            >
              <IconCheck size={16} />
              <span>Seç ve Ata</span>
              {isSaving && <Spinner size="sm" animation="border" className="ms-1" />}
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

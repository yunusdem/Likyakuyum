import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Table,
  Badge,
  Alert,
  Spinner,
  InputGroup,
  Modal,
} from "react-bootstrap";
import {
  IconCash,
  IconArrowUp,
  IconArrowDown,
  IconAlertCircle,
  IconRefresh,
  IconCoins,
  IconDeviceTv,
  IconArrowRight,
  IconTrash,
  IconCheck,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal from "../../components/common/LookupModal";
import BanknotService, { BanknotItem, BanknotCurrencyItem, CurrencyUsageInfo } from "../../services/banknotService";
import { useAuth } from "../../context/AuthContext";
import { getContrastColor } from "../../components/theme/UserThemeApplier";
import { onlyDecimal, blockNonNumericKeys } from "../../utils/numericInput";

export const BanknotDefinitionsPage: React.FC = () => {
  const { user } = useAuth();
  const userHeaderBg = user?.appearance?.gridHeaderBgColor || "var(--user-grid-header-bg, #cbe5ff)";
  const userHeaderTextColor = user?.appearance?.gridHeaderBgColor
    ? getContrastColor(user.appearance.gridHeaderBgColor, "#0f172a")
    : "var(--user-grid-header-text, #0f172a)";

  const [currencies, setCurrencies] = useState<BanknotCurrencyItem[]>([]);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<number | null>(null);

  // Banknot rows for the currently active currency
  const [rows, setRows] = useState<{ id: string; banknotId: number; miktar: string }[]>([]);

  // Active focus/selection target: 'currency' or 'banknote'
  const [activeTarget, setActiveTarget] = useState<"currency" | "banknote">("currency");
  const [selectedBanknotIndex, setSelectedBanknotIndex] = useState<number | null>(null);

  // State flags
  const [loadingCurrencies, setLoadingCurrencies] = useState<boolean>(true);
  const [loadingBanknotlar, setLoadingBanknotlar] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const navigate = useNavigate();
  const [alertInfo, setAlertInfo] = useState<{
    type: "success" | "danger" | "warning" | "info";
    message: string;
    actionText?: string;
    actionLink?: string;
    autoClose?: boolean;
  } | null>(null);

  // In-page delete confirmation state ("Vazgeç" veya "Yine de Sil")
  const [deleteConfirm, setDeleteConfirm] = useState<{
    targetId: number;
    targetName: string;
    targetKod: string;
    loadingUsage?: boolean;
    usage?: CurrencyUsageInfo;
  } | null>(null);

  useEffect(() => {
    if (alertInfo) {
      // Do not auto-dismiss if autoClose is explicitly false ("bildirim biraz dursun")
      if (alertInfo.autoClose === false) {
        return;
      }
      const duration = alertInfo.type === "danger" ? 15000 : 4500;
      const timer = setTimeout(() => setAlertInfo(null), duration);
      return () => clearTimeout(timer);
    }
  }, [alertInfo]);

  // Dürbün (Lookup) modal state
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);

  // Doğrudan Yeni Para Birimi Ekleme state (Sol listede satır içi)
  const [isAddingNewCurrency, setIsAddingNewCurrency] = useState<boolean>(false);
  const [newCurrencyKod, setNewCurrencyKod] = useState<string>("");
  const [newCurrencyAd, setNewCurrencyAd] = useState<string>("");
  const newCurrencyKodRef = useRef<HTMLInputElement | null>(null);
  const newCurrencyAdRef = useRef<HTMLInputElement | null>(null);

  // Refs for keyboard Enter navigation
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Active currency object
  const activeCurrency = useMemo(() => {
    if (!selectedCurrencyId) return null;
    return currencies.find((c) => c.id === selectedCurrencyId) || null;
  }, [currencies, selectedCurrencyId]);

  // Load currencies on mount
  const loadCurrencies = useCallback(async (preferredId?: number) => {
    setLoadingCurrencies(true);
    try {
      const list = await BanknotService.getCurrencies();
      setCurrencies(list);

      if (list.length > 0) {
        const targetId = preferredId && list.some((c) => c.id === preferredId)
          ? preferredId
          : selectedCurrencyId && list.some((c) => c.id === selectedCurrencyId)
          ? selectedCurrencyId
          : list[0].id;

        setSelectedCurrencyId(targetId);
      } else {
        setSelectedCurrencyId(null);
        setRows([]);
      }
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: "Para birimleri yüklenirken hata oluştu: " + (err?.message || err),
      });
    } finally {
      setLoadingCurrencies(false);
    }
  }, [selectedCurrencyId]);

  useEffect(() => {
    loadCurrencies();
  }, []);

  // Load banknotes whenever selectedCurrencyId changes
  const loadBanknotlar = useCallback(async (paraId: number) => {
    if (paraId <= 0) return;
    setLoadingBanknotlar(true);
    setAlertInfo(null);
    try {
      const data = await BanknotService.getBanknotlar(paraId);

      if (data && data.length > 0) {
        const mapped = data.map((b, idx) => ({
          id: `bn-${paraId}-${b.banknotId || idx + 1}-${Math.random()}`,
          banknotId: b.banknotId || idx + 1,
          miktar: Number(b.miktar || 0).toFixed(2),
        }));
        setRows(mapped);
      } else {
        // Prepare standard blank banknot slots 1..7
        const blanks = Array.from({ length: 7 }, (_, idx) => ({
          id: `bn-${paraId}-${idx + 1}-${Math.random()}`,
          banknotId: idx + 1,
          miktar: "",
        }));
        setRows(blanks);
      }
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: "Banknot tanımları yüklenemedi: " + (err?.message || err),
      });
    } finally {
      setLoadingBanknotlar(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCurrencyId && selectedCurrencyId > 0) {
      loadBanknotlar(selectedCurrencyId);
    }
  }, [selectedCurrencyId, loadBanknotlar]);

  // Select currency from left panel or modal
  const handleSelectCurrency = (id: number) => {
    if (isAddingNewCurrency) {
      setIsAddingNewCurrency(false);
      setNewCurrencyKod("");
      setNewCurrencyAd("");
    }
    setSelectedCurrencyId(id);
    setActiveTarget("currency");
    setSelectedBanknotIndex(null);
  };

  // Row manipulation helpers
  const handleAmountChange = (index: number, val: string) => {
    const cleanVal = onlyDecimal(val);
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], miktar: cleanVal };
      return copy;
    });
  };

  const handleAmountBlur = (index: number) => {
    setRows((prev) => {
      const copy = [...prev];
      const raw = copy[index].miktar.replace(",", ".");
      const num = parseFloat(raw);
      if (!isNaN(num) && num > 0) {
        copy[index] = { ...copy[index], miktar: num.toFixed(2) };
      }
      return copy;
    });
  };

  // Tablonun sonuna yeni banknot satırı ekleme (Enter veya Aşağı ok ile)
  const handleAddBanknotRow = () => {
    setRows((prev) => {
      const nextBanknotId = prev.length + 1;
      return [
        ...prev,
        {
          id: `bn-new-${Date.now()}-${Math.random()}`,
          banknotId: nextBanknotId,
          miktar: "",
        },
      ];
    });

    setActiveTarget("banknote");
    const nextIdx = rows.length;
    setSelectedBanknotIndex(nextIdx);

    setTimeout(() => {
      inputRefs.current[nextIdx]?.focus();
    }, 50);
  };

  // "sol üstteki yeni kayıta basınca da doğrudan yeni birim eklenebilsin listeye ve banknot girilerek kayıt edilebilsin"
  const handleNewRecord = () => {
    setIsAddingNewCurrency(true);
    setNewCurrencyKod("");
    setNewCurrencyAd("");
    setSelectedCurrencyId(null);
    setActiveTarget("currency");

    // Kullanıcı talebi: Sadece 1. banknot satırı olsun, 7 tane birden açılmasın
    const blanks = [
      {
        id: `bn-new-${Date.now()}-1`,
        banknotId: 1,
        miktar: "",
      },
    ];
    setRows(blanks);
    setSelectedBanknotIndex(null);

    setTimeout(() => {
      newCurrencyKodRef.current?.focus();
    }, 50);
  };

  const handleCancelNewCurrency = () => {
    setIsAddingNewCurrency(false);
    setNewCurrencyKod("");
    setNewCurrencyAd("");
    if (currencies.length > 0) {
      handleSelectCurrency(currencies[0].id);
    }
  };

  // Keyboard navigation: Enter & Down arrow moves to next row, Up arrow moves to previous row
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (index < rows.length - 1) {
        inputRefs.current[index + 1]?.focus();
        setSelectedBanknotIndex(index + 1);
        setActiveTarget("banknote");
      } else {
        // Son satırda Enter veya Aşağı Ok tuşuna basınca yeni banknot satırı ekle
        handleAddBanknotRow();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
        setSelectedBanknotIndex(index - 1);
        setActiveTarget("banknote");
      }
    }
  };

  // Save via API into TODVZ_PARA and TODVZ_BANKNOT
  const handleSave = async () => {
    // 1. Yeni para birimi ekleniyorsa
    if (isAddingNewCurrency) {
      let cleanKod = newCurrencyKod.trim().toUpperCase();
      let cleanAd = newCurrencyAd.trim();

      if (!cleanKod && !cleanAd) {
        setAlertInfo({
          type: "warning",
          message: "Lütfen sol listedeki kutucuklara yeni para birimi kodu veya adını giriniz.",
        });
        newCurrencyKodRef.current?.focus();
        return;
      }

      if (!cleanKod) {
        cleanKod = cleanAd.slice(0, 5).toUpperCase();
      }
      if (!cleanAd) {
        cleanAd = cleanKod;
      }

      setSaving(true);
      setAlertInfo(null);
      try {
        const created = await BanknotService.createCurrency({ kod: cleanKod, ad: cleanAd });

        const payload = rows
          .map((r) => {
            const cleanNum = parseFloat(r.miktar.toString().replace(",", "."));
            return {
              banknotId: r.banknotId,
              miktar: isNaN(cleanNum) ? 0 : cleanNum,
            };
          })
          .filter((b) => b.miktar > 0);

        if (payload.length > 0) {
          await BanknotService.saveBanknotlar(created.id, payload);
        }

        setIsAddingNewCurrency(false);
        setNewCurrencyKod("");
        setNewCurrencyAd("");

        setAlertInfo({
          type: "success",
          message: `'${cleanKod} - ${cleanAd}' listeye eklendi ve ${payload.length} adet banknot başarıyla kaydedildi.`,
        });

        await loadCurrencies(created.id);
        setSelectedCurrencyId(created.id);
        loadBanknotlar(created.id);
      } catch (err: any) {
        setAlertInfo({
          type: "danger",
          message: "Kaydetme hatası: " + (err?.message || err),
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    // 2. Mevcut para birimi için banknot kaydı
    if (!selectedCurrencyId) {
      setAlertInfo({ type: "warning", message: "Lütfen bir para birimi seçiniz." });
      return;
    }

    setSaving(true);
    setAlertInfo(null);
    try {
      const payload = rows
        .map((r) => {
          const cleanNum = parseFloat(r.miktar.toString().replace(",", "."));
          return {
            banknotId: r.banknotId,
            miktar: isNaN(cleanNum) ? 0 : cleanNum,
          };
        })
        .filter((b) => b.miktar > 0);

      const saved = await BanknotService.saveBanknotlar(selectedCurrencyId, payload);

      setAlertInfo({
        type: "success",
        message: `'${activeCurrency?.ad || activeCurrency?.kod}' için ${saved.length} adet banknot tanımı başarıyla kaydedildi.`,
      });

      setCurrencies((prev) =>
        prev.map((c) => (c.id === selectedCurrencyId ? { ...c, banknotSayisi: saved.length } : c))
      );

      loadBanknotlar(selectedCurrencyId);
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: "Kaydetme hatası: " + (err?.message || err),
      });
    } finally {
      setSaving(false);
    }
  };

  // Silme işlemi
  const handleDelete = async () => {
    // 1. Banknot seçiliyse: Doğrudan sil (onay sormaz), sıralamayı 1..N koru ve anında veritabanından sil
    if (activeTarget === "banknote" && selectedBanknotIndex !== null && rows[selectedBanknotIndex]) {
      const deletedIdx = selectedBanknotIndex;
      const updatedRows = rows
        .filter((_, i) => i !== deletedIdx)
        .map((item, idx) => ({
          ...item,
          banknotId: idx + 1,
        }));

      setRows(updatedRows);

      const nextSelected = updatedRows.length === 0 ? null : Math.min(deletedIdx, updatedRows.length - 1);
      setSelectedBanknotIndex(nextSelected);
      if (nextSelected === null) {
        setActiveTarget("currency");
      }

      if (isAddingNewCurrency || !selectedCurrencyId) return;

      // Anında veritabanından sil / güncelle
      setSaving(true);
      try {
        const payload = updatedRows
          .map((r) => {
            const cleanNum = parseFloat(r.miktar.toString().replace(",", "."));
            return {
              banknotId: r.banknotId,
              miktar: isNaN(cleanNum) ? 0 : cleanNum,
            };
          })
          .filter((b) => b.miktar > 0);

        if (payload.length > 0) {
          const saved = await BanknotService.saveBanknotlar(selectedCurrencyId, payload);
          setCurrencies((prev) =>
            prev.map((c) => (c.id === selectedCurrencyId ? { ...c, banknotSayisi: saved.length } : c))
          );
        } else {
          await BanknotService.deleteBanknotlar(selectedCurrencyId);
          setCurrencies((prev) =>
            prev.map((c) => (c.id === selectedCurrencyId ? { ...c, banknotSayisi: 0 } : c))
          );
        }

        setAlertInfo({
          type: "success",
          message: `${deletedIdx + 1}. Banknot veritabanından başarıyla silindi.`,
        });
      } catch (err: any) {
        setAlertInfo({
          type: "danger",
          message: "Veritabanından silme hatası: " + (err?.message || err),
        });
      } finally {
        setSaving(false);
      }
      return;
    }

    // Yeni para birimi taslağındayken sil tuşuna basılırsa taslağı iptal et
    if (isAddingNewCurrency) {
      handleCancelNewCurrency();
      return;
    }

    // 2. Sol ekrandaki para birimini silmek isteyince: Sayfada "Vazgeç" ve "Yine de Sil" onayını aç
    if (!selectedCurrencyId) return;

    const currencyToDelete = currencies.find((c) => c.id === selectedCurrencyId) || activeCurrency;
    const targetId = selectedCurrencyId;
    const targetName = currencyToDelete?.ad || currencyToDelete?.kod || `ID: ${targetId}`;
    const targetKod = currencyToDelete?.kod || "";

    setDeleteConfirm({
      targetId,
      targetName,
      targetKod,
      loadingUsage: true,
    });

    BanknotService.getCurrencyUsage(targetId)
      .then((usage) => {
        setDeleteConfirm((prev) => (prev && prev.targetId === targetId ? { ...prev, loadingUsage: false, usage } : prev));
      })
      .catch(() => {
        setDeleteConfirm((prev) => (prev && prev.targetId === targetId ? { ...prev, loadingUsage: false } : prev));
      });
  };

  // "Yine de Sil" butonuna basınca vezneden, bakiyelerden, panodan ve banknot/para tanımlarından tamamen siler
  const handleExecuteDeleteCurrency = async (
    targetId: number,
    targetName: string,
    usage?: CurrencyUsageInfo
  ) => {
    setDeleteConfirm(null);
    setSaving(true);
    setAlertInfo(null);
    try {
      await BanknotService.deleteCurrency(targetId, { force: true });

      // Anında sol listeden o isimli ve ID'li kaydı çıkar
      const remaining = currencies.filter((c) => c.id !== targetId);
      setCurrencies(remaining);

      if (remaining.length > 0) {
        const nextId = remaining[0].id;
        setSelectedCurrencyId(nextId);
        loadBanknotlar(nextId);
      } else {
        setSelectedCurrencyId(null);
        setRows([]);
      }

      setSelectedBanknotIndex(null);
      setActiveTarget("currency");

      const cleanedParts: string[] = [];
      if (usage?.hasPano) cleanedParts.push("fiyat panolarından");
      if (usage?.hasBakiye) cleanedParts.push("kasa/vezne bakiyelerinden");
      if (usage?.hasVezne) cleanedParts.push("vezne tanımlarından");
      cleanedParts.push("banknot tanımlarından ve sistemden");

      setAlertInfo({
        type: "success",
        message: `'${targetName}' para birimi; ${cleanedParts.join(", ")} başarıyla silindi ve temizlendi.`,
        autoClose: true,
      });
    } catch (err: any) {
      const rawMsg = err?.message || String(err);

      setAlertInfo({
        type: "danger",
        message: "Para birimi silme hatası: " + rawMsg,
        autoClose: false,
      });
    } finally {
      setSaving(false);
    }
  };

  // Navigation handlers across currencies
  const currentCurrencyIndex = useMemo(() => {
    return currencies.findIndex((c) => c.id === selectedCurrencyId);
  }, [currencies, selectedCurrencyId]);

  const handleFirst = () => {
    if (currencies.length > 0) handleSelectCurrency(currencies[0].id);
  };

  const handlePrev = () => {
    if (currentCurrencyIndex > 0) {
      handleSelectCurrency(currencies[currentCurrencyIndex - 1].id);
    }
  };

  const handleNext = () => {
    if (currentCurrencyIndex < currencies.length - 1) {
      handleSelectCurrency(currencies[currentCurrencyIndex + 1].id);
    }
  };

  const handleLast = () => {
    if (currencies.length > 0) handleSelectCurrency(currencies[currencies.length - 1].id);
  };


  return (
    <div className="banknot-tanimlari-container w-100 pb-3" style={{ overflowX: "hidden" }}>
      {/* 1. ERP Action Toolbar */}
      <ERPToolbar
        pageTitle="B- Banknot Tanımları"
        pageIcon={<IconCash size={22} className="text-primary" />}
        onSave={handleSave}
        onSearch={() => setShowLookupModal(true)}
        onNew={handleNewRecord}
        onDelete={handleDelete}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        onRefresh={() => {
          loadCurrencies(selectedCurrencyId || undefined);
          if (selectedCurrencyId) loadBanknotlar(selectedCurrencyId);
        }}
        onPrint={() => window.print()}
        disabled={loadingCurrencies || loadingBanknotlar || saving}
      />

      {/* 2. Para Birimi / Fiyat Panosu Silme Onay Popup'ı (Kullanıcı talebi: Sayfa ortasında popup şeklinde bildirim, Vazgeç ve Yine de Sil butonları) */}
      <Modal
        show={!!deleteConfirm}
        onHide={() => !saving && setDeleteConfirm(null)}
        centered
        backdrop="static"
        keyboard={!saving}
        size="lg"
        className="delete-confirmation-modal"
      >
        <Modal.Header closeButton={!saving} className="bg-light py-2.5 px-3 border-bottom">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-2">
            <IconAlertCircle size={20} className="text-danger" />
            <span>Para Birimi Silme Bildirimi</span>
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
                <span className="fw-bold fs-5 text-dark">{deleteConfirm?.targetName}</span>
                <Badge bg="danger" className="text-uppercase px-2.5 py-1 fs-7">
                  {deleteConfirm?.targetKod}
                </Badge>
              </div>
              <div className="text-secondary small mt-0.5">
                Bu para biriminin sistemdeki kullanım alanları ve silineceği yerler aşağıda listelenmiştir:
              </div>
            </div>
          </div>

          {deleteConfirm?.loadingUsage ? (
            <div className="py-4 text-center text-muted small d-flex flex-column align-items-center gap-2">
              <Spinner size="sm" animation="border" variant="danger" />
              <span>Para biriminin veritabanındaki kullanım alanları taranıyor...</span>
            </div>
          ) : (
            <div>
              <div className="fw-bold text-dark small mb-2 d-flex align-items-center gap-1.5">
                <span>Silme İşleminde Temizlenecek ve Kaldırılacak Yerler:</span>
              </div>

              <div className="d-flex flex-column gap-2 mb-3">
                {/* 1. Fiyat Panoları */}
                {deleteConfirm?.usage?.hasPano ? (
                  <div className="p-2.5 rounded border border-danger-subtle bg-danger-subtle bg-opacity-25 d-flex align-items-start gap-2.5">
                    <IconDeviceTv size={20} className="text-danger flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-danger small">
                          1. Fiyat Panoları ({deleteConfirm.usage.panoCount} Adet Pano)
                        </strong>
                        <Badge bg="danger">Panolardan Kaldırılacak</Badge>
                      </div>
                      <div className="text-dark small mt-1">
                        Bulunduğu Panolar:{" "}
                        <strong>{deleteConfirm.usage.panoNames?.join(", ") || "Fiyat Panosu"}</strong>
                      </div>
                      <div className="text-muted small mt-0.5">
                        Pano satırlarından bu döviz kuru tamamen çıkarılacaktır.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded border border-light bg-light d-flex align-items-center gap-2 text-muted small">
                    <IconCheck size={16} className="text-success" />
                    <span><strong>1. Fiyat Panoları:</strong> Fiyat panosunda satırı bulunmuyor.</span>
                  </div>
                )}

                {/* 2. Kasa / Vezne Bakiyeleri */}
                {deleteConfirm?.usage?.hasBakiye ? (
                  <div className="p-2.5 rounded border border-danger-subtle bg-danger-subtle bg-opacity-25 d-flex align-items-start gap-2.5">
                    <IconCoins size={20} className="text-danger flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-danger small">
                          2. Kasa ve Vezne Bakiyeleri (Toplam: {deleteConfirm.usage.totalBakiye.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {deleteConfirm.targetKod})
                        </strong>
                        <Badge bg="danger">Bakiyeler Sıfırlanıp Silinecek</Badge>
                      </div>
                      <div className="mt-1 small">
                        <div className="text-dark mb-1">Mevcut Bakiyeli Vezneler:</div>
                        <div className="d-flex flex-column gap-1 bg-white p-2 rounded border border-danger-subtle">
                          {deleteConfirm.usage.bakiyeDetails?.map((b, idx) => (
                            <div key={idx} className="d-flex justify-content-between align-items-center text-dark">
                              <span><strong>{b.vezneKod}</strong> - {b.vezneAd}</span>
                              <span className="badge bg-light text-danger border border-danger-subtle fw-bold">
                                {b.miktar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {deleteConfirm.targetKod}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="text-muted small mt-1">
                        Bu kasalardaki {deleteConfirm.targetKod} bakiyeleri tamamen temizlenecektir.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded border border-light bg-light d-flex align-items-center gap-2 text-muted small">
                    <IconCheck size={16} className="text-success" />
                    <span><strong>2. Kasa Bakiyeleri:</strong> Kasalarda bu para birimine ait bakiye bulunmuyor.</span>
                  </div>
                )}

                {/* 3. Vezne Tanımları (Varsayılan Para Birimi) */}
                {deleteConfirm?.usage?.hasVezne ? (
                  <div className="p-2.5 rounded border border-warning-subtle bg-warning-subtle bg-opacity-25 d-flex align-items-start gap-2.5">
                    <IconCash size={20} className="text-warning flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-warning-emphasis small">
                          3. Vezne Tanımları ({deleteConfirm.usage.vezneNames?.length || 0} Adet Vezne)
                        </strong>
                        <Badge bg="warning" text="dark">TL'ye Çevrilecek</Badge>
                      </div>
                      <div className="text-dark small mt-1">
                        Varsayılan Para Birimi Seçili Olan Vezneler:{" "}
                        <strong>{deleteConfirm.usage.vezneNames?.join(", ")}</strong>
                      </div>
                      <div className="text-muted small mt-0.5">
                        Bu veznelerin varsayılan para birimi Türk Lirası (TL / ID: 1) olarak güncellenecektir.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded border border-light bg-light d-flex align-items-center gap-2 text-muted small">
                    <IconCheck size={16} className="text-success" />
                    <span><strong>3. Vezne Tanımları:</strong> Hiçbir veznede varsayılan para birimi olarak seçili değil.</span>
                  </div>
                )}

                {/* 4. Banknot Kupür Tanımları */}
                <div className="p-2.5 rounded border border-secondary-subtle bg-light d-flex align-items-start gap-2.5">
                  <IconCash size={20} className="text-secondary flex-shrink-0 mt-0.5" />
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center justify-content-between">
                      <strong className="text-dark small">4. Banknot Kupür Tanımları</strong>
                      <Badge bg="secondary">Silinecek</Badge>
                    </div>
                    <div className="text-muted small mt-0.5">
                      {deleteConfirm?.usage && deleteConfirm.usage.banknotCount > 0
                        ? `Bu para birimine ait ${deleteConfirm.usage.banknotCount} adet banknot kupür kaydı sistemden silinecektir.`
                        : "Tanımlı banknot kupür kayıtları sistemden silinecektir."}
                    </div>
                  </div>
                </div>

                {/* 5. Döviz Kurları */}
                {deleteConfirm?.usage && deleteConfirm.usage.kurCount > 0 && (
                  <div className="p-2.5 rounded border border-secondary-subtle bg-light d-flex align-items-start gap-2.5">
                    <IconCoins size={20} className="text-secondary flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-dark small">5. Döviz Kurları ({deleteConfirm.usage.kurCount} Kayıt)</strong>
                        <Badge bg="secondary">Silinecek</Badge>
                      </div>
                      <div className="text-muted small mt-0.5">
                        Tüm geçmiş ve güncel kur listesi satırları silinecektir.
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Fiş ve Cari Bağlantıları */}
                {deleteConfirm?.usage?.hasFis && (
                  <div className="p-2.5 rounded border border-danger-subtle bg-danger-subtle bg-opacity-25 d-flex align-items-start gap-2.5">
                    <IconAlertCircle size={20} className="text-danger flex-shrink-0 mt-0.5" />
                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center justify-content-between">
                        <strong className="text-danger small">6. Fiş ve Cari Kayıtları ({deleteConfirm.usage.fisCount} Fiş)</strong>
                        <Badge bg="danger">Bağlantılar Temizlenecek</Badge>
                      </div>
                      <div className="text-muted small mt-0.5">
                        Geçmiş fiş hareketleri ve cari kart favori para birimi bağlantıları kaldırılacaktır.
                      </div>
                    </div>
                  </div>
                )}

                {/* 7. Para Birimi Tanım Kartı */}
                <div className="p-2.5 rounded border border-danger-subtle bg-white d-flex align-items-start gap-2.5">
                  <IconTrash size={20} className="text-danger flex-shrink-0 mt-0.5" />
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center justify-content-between">
                      <strong className="text-danger small">7. Para Birimi Tanım Kartı</strong>
                      <Badge bg="danger">Tamamen Silinecek</Badge>
                    </div>
                    <div className="text-muted small mt-0.5">
                      <strong>{deleteConfirm?.targetName} ({deleteConfirm?.targetKod})</strong> para birimi sistemden tamamen kaldırılacaktır.
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
                  <strong>"Yine de Sil"</strong> butonuna bastığınızda, bu para birimi yukarıda listelenen tüm yerlerden (fiyat panoları, kasa bakiyeleri, vezne tanımları ve banknot kayıtları) otomatik olarak silinecektir.
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
            disabled={saving}
          >
            Vazgeç
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="px-3 fw-bold d-flex align-items-center gap-1.5 shadow-xs"
            onClick={() =>
              deleteConfirm &&
              handleExecuteDeleteCurrency(
                deleteConfirm.targetId,
                deleteConfirm.targetName,
                deleteConfirm.usage
              )
            }
            disabled={saving}
          >
            {saving ? (
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

      {/* Alert Notifications: Sağ altta beliren ve yönlendirme butonlu toast */}
      {alertInfo && (
        <div
          className="erp-toast-container"
          data-no-autoclose={alertInfo.autoClose === false ? "true" : undefined}
          style={{ zIndex: 1060 }}
        >
          <Alert
            variant={alertInfo.type}
            dismissible
            onClose={() => setAlertInfo(null)}
            className={`erp-toast-item py-2 px-3 mb-0 border shadow small fw-medium d-flex align-items-center justify-content-between gap-3 ${
              alertInfo.autoClose === false ? "erp-sticky-notification" : ""
            }`}
            data-no-autoclose={alertInfo.autoClose === false ? "true" : undefined}
            style={{ maxWidth: "560px" }}
          >
            <div className="d-flex align-items-center gap-2">
              {alertInfo.type === "danger" && <IconAlertCircle size={18} className="text-danger flex-shrink-0" />}
              <span>{alertInfo.message}</span>
            </div>
            <div className="d-flex align-items-center gap-1.5">
              {alertInfo.actionLink && alertInfo.actionText && (
                <Button
                  variant={alertInfo.type === "danger" ? "danger" : "primary"}
                  size="sm"
                  className="py-1 px-2.5 text-nowrap fw-semibold d-flex align-items-center gap-1 shadow-xs"
                  style={{ fontSize: "11.5px", borderRadius: "4px" }}
                  onClick={() => navigate(alertInfo.actionLink!)}
                >
                  <span>{alertInfo.actionText}</span>
                  <IconArrowRight size={13} />
                </Button>
              )}
              {alertInfo.autoClose === false && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="py-0.5 px-2 text-nowrap"
                  style={{ fontSize: "11.5px" }}
                  onClick={() => setAlertInfo(null)}
                >
                  Kapat
                </Button>
              )}
            </div>
          </Alert>
        </div>
      )}

      {/* Embedded CSS: Banknot satırları normal, hover ve seçili durumları */}
      <style>{`
        /* 1. Normal Durum */
        .banknot-row .banknot-label-cell {
          background-color: #cce3f5 !important;
          box-shadow: inset 0 0 0 9999px #cce3f5 !important;
          color: #1e293b !important;
        }
        .banknot-row .banknot-input-cell {
          background-color: #ffffff !important;
          box-shadow: inset 0 0 0 9999px #ffffff !important;
        }

        /* 2. Üzerine Gelince (Hover) - TÜM SATIR AÇIK MAVİ */
        .banknot-row:hover > td,
        .banknot-row:hover .banknot-label-cell,
        .banknot-row:hover .banknot-input-cell {
          background-color: #bae6fd !important;
          --bs-table-bg: #bae6fd !important;
          --bs-table-hover-bg: #bae6fd !important;
          --bs-table-bg-state: #bae6fd !important;
          box-shadow: inset 0 0 0 9999px #bae6fd !important;
        }
        .banknot-row:hover .banknot-label-cell {
          color: #0369a1 !important;
        }

        /* 3. Seçili Durum - TÜM SATIR OTOMATİK TAMAMEN MAVİ */
        .banknot-row.banknot-selected-row,
        .banknot-row.banknot-selected-row > td,
        .banknot-row.banknot-selected-row .banknot-label-cell,
        .banknot-row.banknot-selected-row .banknot-input-cell {
          background-color: #bae6fd !important;
          background: #bae6fd !important;
          --bs-table-bg: #bae6fd !important;
          --bs-table-hover-bg: #bae6fd !important;
          --bs-table-bg-state: #bae6fd !important;
          box-shadow: inset 0 0 0 9999px #bae6fd !important;
        }
        .banknot-row.banknot-selected-row .banknot-label-cell {
          color: #0369a1 !important;
          font-weight: 700 !important;
        }

        /* 4. Seçili Satırın Üzerine İmleç ile Gelince BEYAZ OLMAYACAK, FULL AYNI RENKTE KALACAK */
        .banknot-row.banknot-selected-row:hover,
        .banknot-row.banknot-selected-row:hover > td,
        .banknot-row.banknot-selected-row:hover .banknot-label-cell,
        .banknot-row.banknot-selected-row:hover .banknot-input-cell {
          background-color: #bae6fd !important;
          background: #bae6fd !important;
          --bs-table-bg: #bae6fd !important;
          --bs-table-hover-bg: #bae6fd !important;
          --bs-table-bg-state: #bae6fd !important;
          box-shadow: inset 0 0 0 9999px #bae6fd !important;
        }

        /* 5. Sayı birim yazılan bölümde sayı kısmına tıklanınca / düzenlenince: ARKASI BEYAZ KARE İÇERİSİNDE OLACAK */
        .banknot-row .banknot-amount-input {
          background-color: transparent !important;
          background: transparent !important;
          border: 1.5px solid transparent !important;
          border-radius: 2px !important;
          box-shadow: none !important;
          color: #0f172a !important;
        }

        .banknot-row .banknot-amount-input:focus,
        .banknot-row .banknot-amount-input:active {
          background-color: #ffffff !important;
          background: #ffffff !important;
          color: #0f172a !important;
          border: 1.5px solid #0284c7 !important;
          border-radius: 2px !important;
          box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.25) !important;
          outline: none !important;
          padding-right: 8px !important;
        }

        /* 6. En üst bölüm: Siyah değil, kullanıcının kayıtlı görünüm rengi */
        .banknot-grid-table thead,
        .banknot-grid-table thead tr,
        .banknot-grid-table thead th,
        .banknot-th-label,
        .banknot-th-miktar {
          background-color: var(--user-grid-header-bg, #cbe5ff) !important;
          background: var(--user-grid-header-bg, #cbe5ff) !important;
          color: var(--user-grid-header-text, #0f172a) !important;
          box-shadow: inset 0 0 0 9999px var(--user-grid-header-bg, #cbe5ff) !important;
          border-color: #cbd5e1 !important;
        }
      `}</style>

      {/* Main Two-Panel Windows Layout - Wide matching ERPToolbar Ribbon */}
      <div className="w-100">
        <Card className="shadow-2xs border border-secondary-subtle rounded-3 overflow-hidden">
          <Card.Body className="p-2.5 bg-body">
            <div className="d-flex flex-wrap gap-2">
              {/* Left Panel: Currency List Box */}
              <div style={{ width: "210px", minWidth: "180px" }}>
                <div className="d-flex flex-column h-100 border rounded-2 bg-white shadow-2xs overflow-hidden">
                  {/* Currency Header & Quick Pano Link */}
                  <div
                    className="d-flex align-items-center justify-content-between px-2 py-1 border-bottom"
                    style={{ backgroundColor: "#f8fafc" }}
                  >
                    <span className="small fw-bold text-secondary" style={{ fontSize: "11px" }}>
                      Para Birimleri ({currencies.length})
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-1 d-flex align-items-center gap-1"
                      style={{ fontSize: "10.5px" }}
                      title="Fiyat Panosu Tanımına Git"
                      onClick={() => navigate("/kur/pano-tanimi")}
                    >
                      <IconDeviceTv size={12} />
                      <span>Pano</span>
                    </button>
                  </div>

                  {/* List Box */}
                  <div
                    className="list-group list-group-flush overflow-y-auto flex-grow-1"
                    style={{ maxHeight: "320px", minHeight: "240px" }}
                  >
                    {/* Doğrudan yeni para birimi ekleme satırı */}
                    {isAddingNewCurrency && (
                      <div
                        className="p-1.5 border-bottom shadow-2xs"
                        style={{
                          backgroundColor: "#dbeafe",
                          borderColor: "#93c5fd",
                          borderLeft: "3px solid #0284c7",
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <span className="small fw-bold text-primary" style={{ fontSize: "11px" }}>
                            Yeni Para Birimi
                          </span>
                          <button
                            type="button"
                            onClick={handleCancelNewCurrency}
                            className="btn btn-sm btn-link p-0 text-muted text-decoration-none"
                            title="İptal"
                            style={{ fontSize: "12px", lineHeight: 1 }}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="d-flex gap-1">
                          <Form.Control
                            ref={newCurrencyKodRef}
                            size="sm"
                            maxLength={5}
                            placeholder="KOD"
                            value={newCurrencyKod}
                            onChange={(e) => setNewCurrencyKod(e.target.value.toUpperCase())}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                newCurrencyAdRef.current?.focus();
                              }
                            }}
                            className="fw-bold text-center py-0.5 px-1 font-monospace"
                            style={{ width: "55px", fontSize: "11.5px", height: "24px" }}
                          />
                          <Form.Control
                            ref={newCurrencyAdRef}
                            size="sm"
                            placeholder="Adı..."
                            value={newCurrencyAd}
                            onChange={(e) => {
                              setNewCurrencyAd(e.target.value);
                              if (!newCurrencyKod && e.target.value.length <= 4) {
                                setNewCurrencyKod(e.target.value.toUpperCase());
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                inputRefs.current[0]?.focus();
                              }
                            }}
                            className="fw-semibold py-0.5 px-1.5 flex-grow-1"
                            style={{ fontSize: "11.5px", height: "24px" }}
                          />
                        </div>
                      </div>
                    )}

                    {loadingCurrencies ? (
                      <div className="p-3 text-center text-muted small">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Yükleniyor...
                      </div>
                    ) : currencies.length === 0 && !isAddingNewCurrency ? (
                      <div className="p-3 text-center text-muted small">Para birimi bulunamadı.</div>
                    ) : (
                      currencies.map((c) => {
                        const isSelected = !isAddingNewCurrency && c.id === selectedCurrencyId;
                        const isCurrencyFocused = isSelected && activeTarget === "currency";
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleSelectCurrency(c.id)}
                            className={`list-group-item list-group-item-action py-1 px-2.5 d-flex align-items-center justify-content-between border-bottom text-start transition-colors ${
                              isCurrencyFocused ? "active fw-bold shadow-2xs" : ""
                            }`}
                            style={
                              isSelected
                                ? {
                                    backgroundColor: isCurrencyFocused ? "#0284c7" : "#e0f2fe",
                                    borderColor: isCurrencyFocused ? "#0284c7" : "#bae6fd",
                                    color: isCurrencyFocused ? "#ffffff" : "#0369a1",
                                    fontWeight: isCurrencyFocused ? "bold" : "600",
                                  }
                                : { cursor: "pointer" }
                            }
                          >
                            <span className="text-truncate" style={{ fontSize: "12.5px" }}>
                              {c.ad}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right Panel: Banknot Denominations Grid (Miktar Tablosu - Dar ve Kompakt) */}
              <div style={{ width: "230px", minWidth: "200px" }}>
                <div className="border rounded-2 bg-white shadow-2xs overflow-hidden h-100 d-flex flex-column">
                  {/* Grid Table */}
                  <div className="table-responsive flex-grow-1 overflow-y-auto" style={{ maxHeight: "320px", minHeight: "240px" }}>
                    <Table bordered size="sm" className="banknot-grid-table mb-0 align-middle">
                      <thead className="sticky-top" style={{ top: 0, zIndex: 2, backgroundColor: userHeaderBg }}>
                        <tr className="small text-nowrap">
                          <th
                            style={{
                              width: "105px",
                              backgroundColor: userHeaderBg,
                              color: userHeaderTextColor,
                              boxShadow: `inset 0 0 0 9999px ${userHeaderBg}`,
                              padding: "4px 6px",
                            }}
                            className="banknot-th-label text-center fw-bold border-end"
                          >
                          </th>
                          <th
                            style={{
                              backgroundColor: userHeaderBg,
                              color: userHeaderTextColor,
                              boxShadow: `inset 0 0 0 9999px ${userHeaderBg}`,
                              padding: "4px 6px",
                              fontSize: "12px",
                            }}
                            className="banknot-th-miktar text-center fw-bold"
                          >
                            Miktar
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingBanknotlar ? (
                          <tr>
                            <td colSpan={2} className="text-center py-4 text-muted small">
                              <Spinner animation="border" size="sm" className="me-2" />
                              Banknotlar yükleniyor...
                            </td>
                          </tr>
                        ) : rows.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="text-center py-4 text-muted small">
                              Bu para birimine ait banknot kaydı bulunamadı.
                            </td>
                          </tr>
                        ) : (
                          rows.map((row, index) => {
                            const isRowSelected = activeTarget === "banknote" && selectedBanknotIndex === index;
                            return (
                              <tr
                                key={row.id}
                                className={`banknot-row ${isRowSelected ? "banknot-selected-row" : ""}`}
                                onClick={() => {
                                  setActiveTarget("banknote");
                                  setSelectedBanknotIndex(index);
                                  inputRefs.current[index]?.focus();
                                }}
                                style={{
                                  cursor: "pointer",
                                }}
                              >
                                {/* Banknot Sırası */}
                                <td
                                  className="banknot-label-cell text-center fw-semibold font-monospace user-select-none border-end"
                                  style={{
                                    width: "105px",
                                    fontSize: "11.5px",
                                    padding: "3px 4px",
                                  }}
                                >
                                  {index + 1} .Banknot
                                </td>

                                {/* Miktar Input */}
                                <td className="banknot-input-cell p-0.5">
                                  <Form.Control
                                    ref={(el) => {
                                      inputRefs.current[index] = el;
                                    }}
                                    type="text"
                                    inputMode="decimal"
                                    data-decimal="true"
                                    size="sm"
                                    value={row.miktar}
                                    onFocus={() => {
                                      setActiveTarget("banknote");
                                      setSelectedBanknotIndex(index);
                                    }}
                                    onClick={() => {
                                      setActiveTarget("banknote");
                                      setSelectedBanknotIndex(index);
                                    }}
                                    onChange={(e) => handleAmountChange(index, e.target.value)}
                                    onBlur={() => handleAmountBlur(index)}
                                    onKeyDown={(e: any) => {
                                      blockNonNumericKeys(e, true);
                                      handleKeyDown(e, index);
                                    }}
                                    placeholder="0.00"
                                    className="banknot-amount-input text-end fw-bold font-monospace shadow-none"
                                    style={{
                                      fontSize: "12.5px",
                                      letterSpacing: "0.5px",
                                      color: "#0f172a",
                                      height: "24px",
                                      padding: "1px 6px",
                                    }}
                                  />
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          </Card.Body>
        </Card>
      </div>

      {/* Dürbün (LookupModal) for Currency Selection - Exact same light blue highlight & double click */}
      <LookupModal<BanknotCurrencyItem>
        show={showLookupModal}
        onHide={() => setShowLookupModal(false)}
        title="Para Birimi Seçimi (Dürbün)"
        searchPlaceholder="Para kodu veya adı ile ara..."
        items={currencies}
        isLoading={loadingCurrencies}
        filterFn={(c, term) => {
          const t = term.toLowerCase();
          return c.kod.toLowerCase().includes(t) || c.ad.toLowerCase().includes(t);
        }}
        columns={[
          {
            header: "Kod",
            width: "80px",
            align: "center",
            render: (c) => <span className="badge bg-light text-dark border font-monospace fw-bold">{c.kod}</span>,
          },
          {
            header: "Para Birimi Adı",
            render: (c) => <span className="fw-semibold text-dark">{c.ad}</span>,
          },
          {
            header: "Tanımlı Banknot Sayısı",
            width: "160px",
            align: "center",
            render: (c) => (
              <Badge bg={c.banknotSayisi > 0 ? "primary" : "secondary"} pill>
                {c.banknotSayisi} banknot
              </Badge>
            ),
          },
        ]}
        onSelect={(c) => {
          handleSelectCurrency(c.id);
        }}
      />
    </div>
  );
};

export default BanknotDefinitionsPage;

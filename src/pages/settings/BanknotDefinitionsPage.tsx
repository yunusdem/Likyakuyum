import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal from "../../components/common/LookupModal";
import BanknotService, { BanknotItem, BanknotCurrencyItem } from "../../services/banknotService";
import { useAuth } from "../../context/AuthContext";
import { getContrastColor } from "../../components/theme/UserThemeApplier";

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
  const [alertInfo, setAlertInfo] = useState<{ type: "success" | "danger" | "warning" | "info"; message: string } | null>(null);

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
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], miktar: val };
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

    // 2. Sol ekrandaki para birimini silmek isteyince: EMİNMİSİNİZ diye sor ve veritabanından TAMAMEN SİL!
    if (!selectedCurrencyId) return;

    const currencyToDelete = currencies.find((c) => c.id === selectedCurrencyId) || activeCurrency;
    const targetId = selectedCurrencyId;
    const targetName = currencyToDelete?.ad || currencyToDelete?.kod || `ID: ${targetId}`;

    if (
      !window.confirm(
        `'${targetName}' (${currencyToDelete?.kod || targetId}) para birimini ve tüm banknotlarını veritabanından tamamen silmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await BanknotService.deleteCurrency(targetId);

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

      setAlertInfo({
        type: "success",
        message: `'${targetName}' para birimi veritabanından başarıyla silindi.`,
      });
    } catch (err: any) {
      setAlertInfo({
        type: "danger",
        message: "Para birimi silme hatası: " + (err?.message || err),
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
    <div className="banknot-tanimlari-container container-fluid px-2 py-2">
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

      {/* Main Two-Panel Windows Layout Replicating Screenshot */}
      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden">
        <Card.Body className="p-3 bg-body">
          <Row className="g-3">
            {/* Left Panel: Currency List Box (Exact layout from Screenshot - Arama kısmı kaldırıldı) */}
            <Col xs={12} md={5} lg={4} xl={4}>
              <div className="d-flex flex-column h-100 border rounded-2 bg-white shadow-2xs overflow-hidden">
                {/* List Box - Doğrudan en üstten başlar */}
                <div
                  className="list-group list-group-flush overflow-y-auto flex-grow-1"
                  style={{ maxHeight: "490px", minHeight: "360px" }}
                >
                  {/* Doğrudan yeni para birimi ekleme satırı */}
                  {isAddingNewCurrency && (
                    <div
                      className="p-2 border-bottom shadow-2xs"
                      style={{
                        backgroundColor: "#dbeafe",
                        borderColor: "#93c5fd",
                        borderLeft: "4px solid #0284c7",
                      }}
                    >
                      <div className="d-flex align-items-center justify-content-between mb-1.5">
                        <span className="small fw-bold text-primary" style={{ fontSize: "12px" }}>
                          Yeni Para Birimi
                        </span>
                        <button
                          type="button"
                          onClick={handleCancelNewCurrency}
                          className="btn btn-sm btn-link p-0 text-muted text-decoration-none"
                          title="İptal"
                          style={{ fontSize: "14px", lineHeight: 1 }}
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
                          className="fw-bold text-center py-1 px-1 font-monospace"
                          style={{ width: "65px", fontSize: "12.5px" }}
                        />
                        <Form.Control
                          ref={newCurrencyAdRef}
                          size="sm"
                          placeholder="Para birimi adı (Örn: EURO)..."
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
                          className="fw-semibold py-1 px-2 flex-grow-1"
                          style={{ fontSize: "12.5px" }}
                        />
                      </div>
                    </div>
                  )}

                  {loadingCurrencies ? (
                    <div className="p-4 text-center text-muted">
                      <Spinner animation="border" size="sm" className="me-2" />
                      Yükleniyor...
                    </div>
                  ) : currencies.length === 0 && !isAddingNewCurrency ? (
                    <div className="p-4 text-center text-muted small">Para birimi bulunamadı.</div>
                  ) : (
                    currencies.map((c) => {
                      const isSelected = !isAddingNewCurrency && c.id === selectedCurrencyId;
                      const isCurrencyFocused = isSelected && activeTarget === "currency";
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCurrency(c.id)}
                          className={`list-group-item list-group-item-action py-2 px-3 d-flex align-items-center justify-content-between border-bottom text-start transition-colors ${
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
                          <span className="text-truncate" style={{ fontSize: "13.5px" }}>
                            {c.ad}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </Col>

            {/* Right Panel: Banknot Denominations Grid (Exact layout from Screenshot) */}
            <Col xs={12} md={7} lg={8} xl={8} className="d-flex flex-column">
              <div className="border rounded-2 bg-white shadow-2xs overflow-hidden flex-grow-1 d-flex flex-column">
                {/* Grid Table matching Desktop Screenshot (2 columns: # .Banknot and Miktar) */}
                <div className="table-responsive flex-grow-1 overflow-y-auto" style={{ maxHeight: "460px", minHeight: "360px" }}>
                  <Table bordered size="sm" className="banknot-grid-table mb-0 align-middle">
                    <thead className="sticky-top" style={{ top: 0, zIndex: 2, backgroundColor: userHeaderBg }}>
                      <tr className="small text-nowrap">
                        <th
                          style={{
                            width: "170px",
                            backgroundColor: userHeaderBg,
                            color: userHeaderTextColor,
                            boxShadow: `inset 0 0 0 9999px ${userHeaderBg}`,
                          }}
                          className="banknot-th-label text-center fw-bold border-end"
                        >
                        </th>
                        <th
                          style={{
                            minWidth: "180px",
                            backgroundColor: userHeaderBg,
                            color: userHeaderTextColor,
                            boxShadow: `inset 0 0 0 9999px ${userHeaderBg}`,
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
                          <td colSpan={2} className="text-center py-5 text-muted">
                            <Spinner animation="border" size="sm" className="me-2" />
                            Banknotlar yükleniyor...
                          </td>
                        </tr>
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="text-center py-5 text-muted small">
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
                              {/* Banknot Sırası (Visual screenshot: 1 .Banknot, 2 .Banknot...) */}
                              <td
                                className="banknot-label-cell text-center fw-semibold small font-monospace user-select-none border-end"
                                style={{
                                  width: "170px",
                                }}
                              >
                                {index + 1} .Banknot
                              </td>

                              {/* Miktar Input (Enter moves down, Tab moves down, auto-adds next row at end) */}
                              <td className="banknot-input-cell p-1">
                                <Form.Control
                                  ref={(el) => {
                                    inputRefs.current[index] = el;
                                  }}
                                  type="text"
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
                                  onKeyDown={(e: any) => handleKeyDown(e, index)}
                                  placeholder="0.00"
                                  className="banknot-amount-input text-end fw-bold font-monospace shadow-none"
                                  style={{
                                    fontSize: "14px",
                                    letterSpacing: "0.5px",
                                    color: "#0f172a",
                                    height: "28px",
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
            </Col>
          </Row>
        </Card.Body>
      </Card>

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

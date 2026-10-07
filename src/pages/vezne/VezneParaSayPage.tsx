import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Row,
  Col,
  Table,
  Button,
  Modal,
  Form,
  InputGroup,
  Badge,
  Spinner,
} from "react-bootstrap";
import {
  IconCash,
  IconCheck,
  IconRefresh,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconCalculator,
  IconCoins,
  IconBuildingBank,
  IconUser,
  IconHistory,
  IconChecklist,
  IconInfoCircle,
  IconAlertTriangle,
  IconAlertCircle,
  IconPlus,
  IconMinus,
  IconClock,
  IconCalendar,
  IconEye,
  IconDeviceFloppy,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { LookupModal, LookupColumn } from "../../components/common/LookupModal";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { VezneTransferiService } from "../../services/vezneTransferiService";
import { BanknotService, BanknotCurrencyItem } from "../../services/banknotService";
import { CompanyService, TodvzTanimDto } from "../../services/companyService";
import { VezneParaSayimService, VezneParaSayimDto } from "../../services/vezneParaSayimService";
import { useAuth } from "../../context/AuthContext";

// Varsayılan kupür listeleri (veritabanında tanımlı banknot yoksa standart kupür seti)
const DEFAULT_KUPURLER: Record<string, number[]> = {
  TRY: [200, 100, 50, 20, 10, 5, 1, 0.5, 0.25],
  TL: [200, 100, 50, 20, 10, 5, 1, 0.5, 0.25],
  USD: [100, 50, 20, 10, 5, 2, 1],
  EUR: [500, 200, 100, 50, 20, 10, 5, 2, 1],
  GBP: [50, 20, 10, 5, 2, 1],
  CHF: [1000, 200, 100, 50, 20, 10],
  CAD: [100, 50, 20, 10, 5],
  AUD: [100, 50, 20, 10, 5],
  HAS: [100, 50, 20, 10, 5, 2.5, 1, 0.5],
  ALTIN: [100, 50, 20, 10, 5, 2.5, 1, 0.5],
};

export interface ParaSayCurrencyState {
  paraId: number;
  paraKodu: string;
  paraAdi: string;
  siraNo: number;
  kasaBakiyesi: number;
}

export interface PopupNotificationState {
  type: "success" | "danger" | "warning" | "info";
  title: string;
  message: string;
  details?: string;
}

export const VezneParaSayPage: React.FC = () => {
  const { user } = useAuth();

  // Üst Form Bilgileri
  const [tarih, setTarih] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [aciklama, setAciklama] = useState<string>("Günlük Kasa Sayımı");
  const [selectedVezneId, setSelectedVezneId] = useState<number>(0);
  const [selectedVezneKod, setSelectedVezneKod] = useState<string>("");
  const [selectedVezneAd, setSelectedVezneAd] = useState<string>("");
  const [activeSayimId, setActiveSayimId] = useState<number | null>(null);

  // Tanım & Liste State'leri
  const [vezneList, setVezneList] = useState<VezneItem[]>([]);
  const [currencyList, setCurrencyList] = useState<BanknotCurrencyItem[]>([]);
  const [companyTanim, setCompanyTanim] = useState<TodvzTanimDto | null>(null);
  const [kasaBakiyeleriMap, setKasaBakiyeleriMap] = useState<Record<number, number>>({});
  const [dbKupurCache, setDbKupurCache] = useState<Record<number, number[]>>({});

  // Sayım Adetleri Sözlüğü: { [paraKodu]: { [kupur]: adet } }
  const [countsMap, setCountsMap] = useState<Record<string, Record<number, number>>>({});
  const [selectedCurrencyIndex, setSelectedCurrencyIndex] = useState<number>(0);

  // UI Durumları
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showVezneLookup, setShowVezneLookup] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<VezneParaSayimDto[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);

  // Sayfa Ortasında Açılan Popup Bildirim Modalı
  const [popupNotification, setPopupNotification] = useState<PopupNotificationState | null>(null);

  // Klavye Navigasyonu Referansları
  const adetInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const vezneInputRef = useRef<HTMLInputElement | null>(null);

  // Sayfa Ortasında Popup Bildirim Gösterme
  const showPopup = useCallback((type: "success" | "danger" | "warning" | "info", title: string, message: string, details?: string) => {
    setPopupNotification({ type, title, message, details });
  }, []);

  // Popup otomatik kapatma (Başarılı / Bilgi bildirimleri için 2.8 saniye)
  useEffect(() => {
    if (popupNotification && (popupNotification.type === "success" || popupNotification.type === "info")) {
      const timer = setTimeout(() => {
        setPopupNotification(null);
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [popupNotification]);

  // Kullanıcının varsayılan veznesini belirleme
  const getUserVezne = useCallback(
    (list: VezneItem[]): VezneItem | undefined => {
      if (!list || list.length === 0) return undefined;
      const target = String(user?.cashierCode || "").trim().toLowerCase();
      let matched: VezneItem | undefined;
      if (target) {
        matched = list.find(
          (v) =>
            String(v.id).toLowerCase() === target ||
            v.kod.toLowerCase() === target
        );
        if (!matched && !isNaN(Number(target))) {
          const targetNum = Number(target);
          matched = list.find((v) => v.id === targetNum);
        }
      }
      if (!matched && list.length > 0) {
        matched = list[0];
      }
      return matched;
    },
    [user?.cashierCode]
  );

  // 1. Temel Tanımları Yükle (Vezneler, Para Birimleri, Şirket Bilgisi)
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [vezneler, currencies, company] = await Promise.all([
        CashDeskService.getVezneler().catch(() => []),
        BanknotService.getCurrencies().catch(() => []),
        CompanyService.getDefinitions().catch(() => null),
      ]);

      setVezneList(vezneler);
      setCurrencyList(currencies);
      if (company) setCompanyTanim(company);

      // Kullanıcının veznesini seç
      const defaultVezne = getUserVezne(vezneler);
      if (defaultVezne) {
        setSelectedVezneId(defaultVezne.id);
        setSelectedVezneKod(defaultVezne.kod);
        setSelectedVezneAd(defaultVezne.ad);
      }
    } catch (err: any) {
      showPopup(
        "danger",
        "Yükleme Hatası",
        "Başlangıç verileri yüklenirken bir sorun oluştu.",
        err?.message || String(err)
      );
    } finally {
      setIsLoading(false);
    }
  }, [getUserVezne, showPopup]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Seçili Veznenin Kasa Bakiyelerini Yükle
  const loadVezneBakiyeler = useCallback(async (vezneId: number, silent = false) => {
    if (!vezneId || vezneId <= 0) {
      setKasaBakiyeleriMap({});
      return;
    }
    try {
      const bakiyeler = await VezneTransferiService.getVezneBakiyeler(vezneId);
      const bMap: Record<number, number> = {};
      if (bakiyeler && Array.isArray(bakiyeler)) {
        bakiyeler.forEach((b) => {
          bMap[b.paraId] = Number(b.miktar) || 0;
        });
      }
      setKasaBakiyeleriMap(bMap);
      if (!silent) {
        showPopup(
          "info",
          "Bakiyeler Güncellendi",
          `${selectedVezneKod || "Seçili vezne"} kasa bakiyeleri güncel veritabanından çekildi.`
        );
      }
    } catch (err) {
      setKasaBakiyeleriMap({});
    }
  }, [selectedVezneKod, showPopup]);

  useEffect(() => {
    if (selectedVezneId > 0) {
      loadVezneBakiyeler(selectedVezneId, true);
    }
  }, [selectedVezneId, loadVezneBakiyeler]);

  // 3. Birleşik Para Birimleri Tablosu (Currency List + Kasa Bakiyesi)
  const masterCurrencies: ParaSayCurrencyState[] = useMemo(() => {
    if (!currencyList || currencyList.length === 0) return [];
    return currencyList.map((c) => ({
      paraId: c.id,
      paraKodu: (c.kod || "").trim(),
      paraAdi: (c.ad || "").trim(),
      siraNo: c.siraNo || 0,
      kasaBakiyesi: kasaBakiyeleriMap[c.id] || 0,
    }));
  }, [currencyList, kasaBakiyeleriMap]);

  // Seçili para birimi
  const activeCurrency = masterCurrencies[selectedCurrencyIndex] || masterCurrencies[0];
  const activeKodUpper = activeCurrency ? activeCurrency.paraKodu.toUpperCase().trim() : "";

  // 4. Seçili Para Biriminin Kupürlerini (TODVZ_BANKNOT) Yükleme / Önbellek
  useEffect(() => {
    if (!activeCurrency || !activeCurrency.paraId) return;
    const pId = activeCurrency.paraId;
    if (dbKupurCache[pId]) return;

    BanknotService.getBanknotlar(pId)
      .then((list) => {
        if (list && list.length > 0) {
          const sorted = list.map((b) => b.miktar).sort((a, b) => b - a);
          setDbKupurCache((prev) => ({ ...prev, [pId]: sorted }));
        }
      })
      .catch(() => {});
  }, [activeCurrency, dbKupurCache]);

  // Kupür Listesi Çözümleyici
  const getKupurlerForCurrency = useCallback(
    (paraId: number, kod: string): number[] => {
      const kodUpper = kod.toUpperCase().trim();
      if (dbKupurCache[paraId] && dbKupurCache[paraId].length > 0) {
        return dbKupurCache[paraId];
      }
      if (DEFAULT_KUPURLER[kodUpper]) {
        return DEFAULT_KUPURLER[kodUpper];
      }
      return [100, 50, 20, 10, 5, 1];
    },
    [dbKupurCache]
  );

  const activeKupurler = useMemo(() => {
    if (!activeCurrency) return [100, 50, 20, 10, 5, 1];
    return getKupurlerForCurrency(activeCurrency.paraId, activeCurrency.paraKodu);
  }, [activeCurrency, getKupurlerForCurrency]);

  // 5. Hesaplama Fonksiyonları
  const getSayilanTutar = useCallback(
    (kod: string): number => {
      const kodUpper = kod.toUpperCase().trim();
      const currCounts = countsMap[kodUpper] || {};
      let total = 0;
      Object.entries(currCounts).forEach(([kupurStr, adet]) => {
        const kupur = Number(kupurStr);
        if (kupur > 0 && adet > 0) {
          total += kupur * adet;
        }
      });
      return total;
    },
    [countsMap]
  );

  const getToplamBanknotAdedi = useCallback(
    (kod: string): number => {
      const kodUpper = kod.toUpperCase().trim();
      const currCounts = countsMap[kodUpper] || {};
      let count = 0;
      Object.values(currCounts).forEach((adet) => {
        if (adet > 0) count += adet;
      });
      return count;
    },
    [countsMap]
  );

  // Kupür Adedi Değiştirme
  const handleAdetChange = (kupur: number, valueStr: string) => {
    if (!activeKodUpper) return;
    const cleaned = valueStr.replace(/[^0-9]/g, "");
    const adet = cleaned === "" ? 0 : parseInt(cleaned, 10);

    setCountsMap((prev) => {
      const prevCurr = prev[activeKodUpper] || {};
      return {
        ...prev,
        [activeKodUpper]: {
          ...prevCurr,
          [kupur]: adet,
        },
      };
    });
  };

  // Hızlı Adet Artırma Butonları (+1, +5, +10, +50, +100)
  const handleQuickAdd = (kupur: number, delta: number) => {
    if (!activeKodUpper) return;
    const currentAdet = countsMap[activeKodUpper]?.[kupur] || 0;
    const newAdet = Math.max(0, currentAdet + delta);
    handleAdetChange(kupur, String(newAdet));
  };

  // Aktif Para Biriminin Sayımını Sıfırla
  const handleResetActiveCurrency = () => {
    if (!activeKodUpper) return;
    setCountsMap((prev) => ({
      ...prev,
      [activeKodUpper]: {},
    }));
    showPopup("info", "Kupürler Sıfırlandı", `${activeCurrency?.paraKodu} para birimi için sayım adetleri sıfırlandı.`);
  };

  // Aktif Para Birimini Sistem Bakiyesine Eşitle (Kupürlere otomatik dağıt)
  const handleAutoFillWithBalance = () => {
    if (!activeCurrency || activeCurrency.kasaBakiyesi <= 0) {
      showPopup("warning", "Bakiye Yok", "Sistemde dağıtılacak pozitif kasa bakiyesi bulunmuyor.");
      return;
    }
    let remaining = Math.round(activeCurrency.kasaBakiyesi);
    const newCounts: Record<number, number> = {};
    const sortedKupurs = [...activeKupurler].sort((a, b) => b - a);

    sortedKupurs.forEach((kupur) => {
      if (kupur > 0 && remaining >= kupur) {
        const count = Math.floor(remaining / kupur);
        newCounts[kupur] = count;
        remaining -= count * kupur;
      }
    });

    setCountsMap((prev) => ({
      ...prev,
      [activeKodUpper]: newCounts,
    }));

    showPopup(
      "success",
      "Otomatik Dağıtıldı",
      `${activeCurrency.paraKodu} kasa bakiyesi (${activeCurrency.kasaBakiyesi.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}) kupürlere otomatik dağıtıldı.`
    );
  };

  // Tüm Sayımları Temizle (F3)
  const handleClearAll = () => {
    setCountsMap({});
    setActiveSayimId(null);
    setShowClearConfirmModal(false);
    showPopup("info", "Sayımlar Sıfırlandı", "Tüm para birimlerine ait sayım adetleri sıfırlandı.");
  };

  // Veritabanına ve Yerel Depolamaya Kaydet (F2)
  const handleSave = async () => {
    if (!selectedVezneId || selectedVezneId <= 0) {
      showPopup("warning", "Vezne Seçimi Gerekli", "Lütfen önce sayım yapılan vezneyi seçiniz.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Satır Dökümlerini Hazırla
      const satirlar = masterCurrencies.map((curr) => {
        const kodUpper = curr.paraKodu.toUpperCase().trim();
        const sayilan = getSayilanTutar(curr.paraKodu);
        const bakiye = curr.kasaBakiyesi;
        const fark = sayilan - bakiye;
        const toplamAdet = getToplamBanknotAdedi(curr.paraKodu);
        const kupurler = countsMap[kodUpper] || {};

        return {
          paraId: curr.paraId,
          paraKodu: curr.paraKodu,
          paraAdi: curr.paraAdi,
          kasaBakiyesi: bakiye,
          sayilanTutar: sayilan,
          fark,
          toplamAdet,
          kupurler,
        };
      });

      // Genel Durum Belirleme
      let hasDifference = false;
      satirlar.forEach((s) => {
        if (Math.abs(s.fark) > 0.001) hasDifference = true;
      });
      const genelDurum = hasDifference ? "Farklı" : "Dengede";

      // 2. Veritabanı Payload
      const savePayload: VezneParaSayimDto = {
        sayimId: activeSayimId,
        tarih,
        saat: new Date().toTimeString().split(" ")[0].slice(0, 5),
        vezneId: selectedVezneId,
        vezneKodu: selectedVezneKod,
        vezneAdi: selectedVezneAd,
        kullaniciId: user?.id ? Number(user.id) : null,
        kullaniciAdi: user?.fullName || user?.username || "Veznedar",
        aciklama,
        genelDurum,
        countsMap,
        satirlar,
      };

      // 3. Veritabanına Kaydet
      const res = await VezneParaSayimService.saveSayim(savePayload);
      if (res?.sayimId) {
        setActiveSayimId(res.sayimId);
      }

      // 4. Offline LocalStorage Yedekleme
      try {
        localStorage.setItem(`para_sayim_${selectedVezneId}`, JSON.stringify(savePayload));
      } catch {}

      // 5. Sayfa Ortasında Başarı Pop-up'ı Göster
      showPopup(
        "success",
        "Sayım Başarıyla Kaydedildi!",
        `Vezne: ${selectedVezneKod} - ${selectedVezneAd}\nTarih: ${new Date(tarih).toLocaleDateString("tr-TR")}\nDurum: ${genelDurum}`,
        `Kayıt No: #${res?.sayimId || "Yeni"} | Tüm veriler veritabanında saklandı.`
      );
    } catch (err: any) {
      showPopup(
        "danger",
        "Kayıt Hatası",
        "Vezne para sayımı kaydedilirken bir hata meydana geldi.",
        err?.response?.data?.message || err?.message || String(err)
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Geçmiş Sayımları Aç (F4)
  const handleOpenHistory = async () => {
    if (!selectedVezneId || selectedVezneId <= 0) {
      showPopup("warning", "Vezne Seçiniz", "Geçmiş sayımları görmek için önce bir vezne seçiniz.");
      return;
    }
    setIsLoadingHistory(true);
    setShowHistoryModal(true);
    try {
      const list = await VezneParaSayimService.getGecmisSayimlar(selectedVezneId);
      setHistoryList(list);
    } catch {
      setHistoryList([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Geçmiş Sayımı Ekrana Yükle
  const handleLoadHistoryItem = async (sayimId: number) => {
    try {
      const detail = await VezneParaSayimService.getSayimById(sayimId);
      if (detail && detail.countsMap) {
        setCountsMap(detail.countsMap);
        setTarih(detail.tarih ? String(detail.tarih).split("T")[0] : tarih);
        setAciklama(detail.aciklama || "Geçmiş Sayım Yüklendi");
        setActiveSayimId(detail.sayimId || null);
        setShowHistoryModal(false);
        showPopup(
          "success",
          "Sayım Yüklendi",
          `Kayıt #${detail.sayimId} (${detail.tarih ? new Date(detail.tarih).toLocaleDateString("tr-TR") : ""}) başarıyla ekrana aktarıldı.`
        );
      }
    } catch (err: any) {
      showPopup("danger", "Yükleme Hatası", "Sayım detayları getirilemedi: " + (err?.message || err));
    }
  };

  // Klavye Gezinmesi (Enter / Ok Tuşları)
  const handleInputKeyDown = (
    e: React.KeyboardEvent<any>,
    kIndex: number
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (kIndex < activeKupurler.length - 1) {
        adetInputRefs.current[kIndex + 1]?.focus();
        adetInputRefs.current[kIndex + 1]?.select();
      } else {
        if (selectedCurrencyIndex < masterCurrencies.length - 1) {
          setSelectedCurrencyIndex(selectedCurrencyIndex + 1);
        } else {
          adetInputRefs.current[0]?.focus();
          adetInputRefs.current[0]?.select();
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (kIndex > 0) {
        adetInputRefs.current[kIndex - 1]?.focus();
        adetInputRefs.current[kIndex - 1]?.select();
      }
    }
  };

  // Para değiştiğinde ilk inputa odaklan
  useEffect(() => {
    const timer = setTimeout(() => {
      adetInputRefs.current[0]?.focus();
      adetInputRefs.current[0]?.select();
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedCurrencyIndex]);

  // Global Kısayol Tuşları (F2, F3, F4, F5, F7, F8, F12, ESC)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (popupNotification) {
        if (e.key === "Escape" || e.key === "Enter") {
          setPopupNotification(null);
          return;
        }
      }

      if (showVezneLookup || showPrintModal || showClearConfirmModal || showHistoryModal) {
        if (e.key === "Escape") {
          setShowVezneLookup(false);
          setShowPrintModal(false);
          setShowClearConfirmModal(false);
          setShowHistoryModal(false);
        }
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "F3") {
        e.preventDefault();
        setShowClearConfirmModal(true);
      } else if (e.key === "F4") {
        e.preventDefault();
        handleOpenHistory();
      } else if (e.key === "F5") {
        e.preventDefault();
        if (selectedVezneId > 0) loadVezneBakiyeler(selectedVezneId);
      } else if (e.key === "F7") {
        e.preventDefault();
        setShowPrintModal(true);
      } else if (e.key === "F8" || e.key === "F12") {
        e.preventDefault();
        setShowVezneLookup(true);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [
    popupNotification,
    showVezneLookup,
    showPrintModal,
    showClearConfirmModal,
    showHistoryModal,
    selectedVezneId,
    loadVezneBakiyeler,
    handleSave,
    handleOpenHistory,
  ]);

  // Özet İstatistikler
  const totalSayilanCurrencyCount = useMemo(() => {
    return masterCurrencies.filter((c) => getSayilanTutar(c.paraKodu) > 0).length;
  }, [masterCurrencies, getSayilanTutar]);

  const activeSayilanTutar = activeCurrency ? getSayilanTutar(activeCurrency.paraKodu) : 0;
  const activeKasaBakiye = activeCurrency ? activeCurrency.kasaBakiyesi : 0;
  const activeFark = activeSayilanTutar - activeKasaBakiye;

  // Vezne Lookup Tablo Kolonları
  const vezneColumns: LookupColumn<VezneItem>[] = [
    { header: "Vezne Kodu", render: (item) => item.kod, width: "120px" },
    { header: "Vezne Adı", render: (item) => item.ad },
  ];

  return (
    <div className="w-100 pb-4 px-2" style={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
      {/* Özel Scoped Stiller */}
      <style>{`
        .para-say-table tbody tr {
          cursor: pointer;
          transition: background-color 0.12s ease-in-out;
        }
        .para-say-table tbody tr:hover {
          background-color: #f1f5f9 !important;
        }
        .para-say-selected-row,
        .para-say-selected-row > td,
        .para-say-selected-row > th {
          background-color: #bae6fd !important;
          color: #0369a1 !important;
          font-weight: 600 !important;
        }
        .kupur-adet-input:focus {
          outline: 2px solid #0284c7 !important;
          background-color: #ffffff !important;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #print-sayim-tutanagi, #print-sayim-tutanagi * {
            visibility: visible;
          }
          #print-sayim-tutanagi {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>

      {/* 1. ERP Aksiyon Toolbar */}
      <ERPToolbar
        pageTitle="M- Vezne Para Say"
        pageIcon={<IconCash size={20} />}
        onSave={handleSave}
        onNew={() => setShowClearConfirmModal(true)}
        onRefresh={() => {
          if (selectedVezneId > 0) loadVezneBakiyeler(selectedVezneId);
        }}
        onPrint={() => setShowPrintModal(true)}
        onSearch={() => setShowVezneLookup(true)}
        disabled={isSaving || isLoading}
        modeText={
          selectedVezneKod
            ? `Aktif Vezne: ${selectedVezneKod} - ${selectedVezneAd} ${activeSayimId ? `(#${activeSayimId})` : ""}`
            : "Vezne Seçiniz"
        }
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline-primary"
              size="sm"
              className="py-1 px-2.5 fs-8 fw-semibold d-flex align-items-center gap-1.5"
              onClick={handleOpenHistory}
              title="Geçmiş Sayım Kayıtları (F4)"
            >
              <IconHistory size={15} />
              <span>Geçmiş Sayımlar (F4)</span>
            </Button>
            <Badge bg="primary" className="px-2.5 py-1.5 fs-7 fw-semibold">
              <IconCoins size={14} className="me-1" />
              {totalSayilanCurrencyCount} / {masterCurrencies.length} Para Sayıldı
            </Badge>
          </div>
        }
      />

      {/* 2. Üst Parametreler & Vezne Seçim Kartı */}
      <div
        className="border rounded-2 bg-white shadow-2xs mb-3 mt-1"
        style={{ borderColor: "#cbd5e1", padding: "12px 16px" }}
      >
        <Row className="g-2.5 align-items-center">
          {/* Tarih */}
          <Col xs={12} sm={6} md={3} lg={2.5}>
            <div className="d-flex flex-row align-items-center gap-2">
              <label
                className="small fw-semibold mb-0 text-nowrap"
                style={{ minWidth: "55px", fontSize: "12.5px", color: "#334155" }}
              >
                Tarih:
              </label>
              <Form.Control
                type="date"
                size="sm"
                value={tarih}
                onChange={(e) => setTarih(e.target.value)}
                style={{ height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
              />
            </div>
          </Col>

          {/* Vezne Seçimi */}
          <Col xs={12} sm={6} md={5} lg={4}>
            <div className="d-flex flex-row align-items-center gap-2">
              <label
                className="small fw-semibold mb-0 text-nowrap"
                style={{ minWidth: "55px", fontSize: "12.5px", color: "#334155" }}
              >
                Vezne:
              </label>
              <div className="d-flex align-items-center gap-1 flex-grow-1" style={{ minWidth: 0 }}>
                <InputGroup size="sm" style={{ width: "120px", flexShrink: 0 }}>
                  <Form.Control
                    ref={vezneInputRef}
                    type="text"
                    value={selectedVezneKod}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedVezneKod(val);
                      const found = vezneList.find(
                        (v) =>
                          v.kod.toLowerCase() === val.trim().toLowerCase() ||
                          String(v.id) === val.trim()
                      );
                      if (found) {
                        setSelectedVezneId(found.id);
                        setSelectedVezneAd(found.ad);
                      } else {
                        setSelectedVezneId(0);
                        setSelectedVezneAd("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "F8" || e.key === "F12") {
                        e.preventDefault();
                        setShowVezneLookup(true);
                      }
                    }}
                    placeholder=""
                    style={{
                      height: "30px",
                      fontSize: "12.5px",
                      fontWeight: 600,
                      borderColor: "#cbd5e1",
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    className="px-2 py-0 d-flex align-items-center justify-content-center"
                    style={{ height: "30px", borderColor: "#cbd5e1" }}
                    onClick={() => setShowVezneLookup(true)}
                    title="Vezne Seç (F8 / F12)"
                  >
                    <IconSearch size={14} />
                  </Button>
                </InputGroup>
                {selectedVezneAd && (
                  <span
                    className="text-dark small fw-semibold text-truncate ms-1"
                    style={{ maxWidth: "200px" }}
                    title={selectedVezneAd}
                  >
                    ({selectedVezneAd})
                  </span>
                )}
              </div>
            </div>
          </Col>

          {/* Sayım Yapan Personel */}
          <Col xs={12} sm={6} md={4} lg={3}>
            <div className="d-flex flex-row align-items-center gap-2">
              <label
                className="small fw-semibold mb-0 text-nowrap"
                style={{ minWidth: "80px", fontSize: "12.5px", color: "#334155" }}
              >
                Sayım Yapan:
              </label>
              <div
                className="px-2 py-1 rounded border bg-light text-dark small fw-semibold flex-grow-1 text-truncate"
                style={{ borderColor: "#cbd5e1", height: "30px", fontSize: "12px", lineHeight: "20px" }}
              >
                <IconUser size={14} className="me-1 text-secondary" />
                {user?.fullName || user?.username || "Veznedar"}
              </div>
            </div>
          </Col>

          {/* Açıklama */}
          <Col xs={12} lg={2.5}>
            <div className="d-flex flex-row align-items-center gap-2">
              <label
                className="small fw-semibold mb-0 text-nowrap"
                style={{ minWidth: "60px", fontSize: "12.5px", color: "#334155" }}
              >
                Açıklama:
              </label>
              <Form.Control
                type="text"
                size="sm"
                value={aciklama}
                onChange={(e) => setAciklama(e.target.value)}
                placeholder="Sayım notu..."
                style={{ height: "30px", fontSize: "12.5px", borderColor: "#cbd5e1" }}
              />
            </div>
          </Col>
        </Row>
      </div>

      {/* 3. Ana Master-Detail Ekran (Sol: Para Birimleri, Sağ: Kupür Sayım Detayı) */}
      <Row className="g-3">
        {/* SOL SÜTUN: Para Birimleri ve Kasa İcmali */}
        <Col xs={12} lg={6}>
          <div
            className="border rounded-2 bg-white shadow-2xs h-100 d-flex flex-column"
            style={{ borderColor: "#cbd5e1" }}
          >
            {/* Sol Panel Başlık */}
            <div
              className="px-3 py-2 border-bottom d-flex justify-content-between align-items-center bg-light rounded-top-2"
              style={{ borderColor: "#e2e8f0" }}
            >
              <div className="fw-bold small text-dark d-flex align-items-center gap-1.5">
                <IconBuildingBank size={16} className="text-primary" />
                Kasa Para Birimleri ve Bakiyeleri
              </div>
              <Button
                variant="outline-secondary"
                size="sm"
                className="py-0 px-2 fs-8 fw-semibold"
                style={{ height: "26px" }}
                onClick={() => {
                  if (selectedVezneId > 0) loadVezneBakiyeler(selectedVezneId);
                }}
                title="Kasa Bakiyelerini Yenile (F5)"
              >
                <IconRefresh size={13} className="me-1" />
                Yenile
              </Button>
            </div>

            {/* Para Birimleri Tablosu */}
            <div className="table-responsive flex-grow-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
              <Table hover bordered size="sm" className="mb-0 para-say-table" style={{ fontSize: "12.5px" }}>
                <thead
                  className="sticky-top"
                  style={{ backgroundColor: "#f8fafc", color: "#475569", zIndex: 1 }}
                >
                  <tr>
                    <th style={{ width: "40px" }} className="text-center">S.No</th>
                    <th style={{ width: "65px" }}>Kod</th>
                    <th>Para Birimi Adı</th>
                    <th className="text-end" style={{ width: "120px" }}>Kasa Bakiyesi</th>
                    <th className="text-end" style={{ width: "120px" }}>Sayılan</th>
                    <th className="text-end" style={{ width: "110px" }}>Fark</th>
                    <th className="text-center" style={{ width: "95px" }}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        <Spinner animation="border" size="sm" className="me-2" />
                        Para birimleri ve bakiyeler yükleniyor...
                      </td>
                    </tr>
                  ) : masterCurrencies.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4 text-muted">
                        Tanımlı para birimi bulunamadı.
                      </td>
                    </tr>
                  ) : (
                    masterCurrencies.map((curr, idx) => {
                      const isSelected = selectedCurrencyIndex === idx;
                      const sayilan = getSayilanTutar(curr.paraKodu);
                      const bakiye = curr.kasaBakiyesi;
                      const fark = sayilan - bakiye;
                      const hasCount = sayilan > 0;

                      let durumBadge = (
                        <span className="badge bg-light text-secondary border px-1.5 py-0.5 fs-8">
                          Bekliyor
                        </span>
                      );

                      if (hasCount || bakiye !== 0) {
                        if (Math.abs(fark) < 0.001) {
                          durumBadge = (
                            <span
                              className="badge border px-1.5 py-0.5 fs-8"
                              style={{ backgroundColor: "#dcfce7", color: "#15803d", borderColor: "#86efac" }}
                            >
                              <IconCheck size={11} className="me-0.5" />
                              Tam
                            </span>
                          );
                        } else if (fark > 0) {
                          durumBadge = (
                            <span
                              className="badge border px-1.5 py-0.5 fs-8"
                              style={{ backgroundColor: "#e0f2fe", color: "#0369a1", borderColor: "#7dd3fc" }}
                            >
                              <IconPlus size={11} className="me-0.5" />
                              Fazla
                            </span>
                          );
                        } else {
                          durumBadge = (
                            <span
                              className="badge border px-1.5 py-0.5 fs-8"
                              style={{ backgroundColor: "#fee2e2", color: "#b91c1c", borderColor: "#fca5a5" }}
                            >
                              <IconMinus size={11} className="me-0.5" />
                              Eksik
                            </span>
                          );
                        }
                      }

                      return (
                        <tr
                          key={curr.paraId || idx}
                          className={isSelected ? "para-say-selected-row" : ""}
                          onClick={() => setSelectedCurrencyIndex(idx)}
                        >
                          <td className="text-center text-muted">{idx + 1}</td>
                          <td className="fw-bold">{curr.paraKodu}</td>
                          <td className="text-truncate" style={{ maxWidth: "160px" }}>
                            {curr.paraAdi}
                          </td>
                          <td className="text-end font-monospace">
                            {bakiye.toLocaleString("tr-TR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="text-end fw-bold font-monospace text-primary">
                            {sayilan > 0
                              ? sayilan.toLocaleString("tr-TR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "-"}
                          </td>
                          <td
                            className={`text-end font-monospace fw-bold ${
                              Math.abs(fark) < 0.001
                                ? "text-success"
                                : fark > 0
                                ? "text-primary"
                                : "text-danger"
                            }`}
                          >
                            {hasCount || bakiye !== 0
                              ? (fark > 0 ? "+" : "") +
                                fark.toLocaleString("tr-TR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "-"}
                          </td>
                          <td className="text-center">{durumBadge}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </div>

            {/* Sol Panel Alt Aksiyonları */}
            <div
              className="p-2 border-top bg-light rounded-bottom-2 d-flex justify-content-between align-items-center"
              style={{ borderColor: "#e2e8f0" }}
            >
              <Button
                variant="outline-danger"
                size="sm"
                className="py-1 px-2.5 fs-8 fw-semibold"
                onClick={() => setShowClearConfirmModal(true)}
              >
                <IconTrash size={14} className="me-1" />
                Tüm Sayımları Sıfırla (F3)
              </Button>
              <div className="small text-muted">
                Toplam <strong>{masterCurrencies.length}</strong> para birimi
              </div>
            </div>
          </div>
        </Col>

        {/* SAĞ SÜTUN: Seçili Para Biriminin Kupür / Banknot Sayımı */}
        <Col xs={12} lg={6}>
          <div
            className="border rounded-2 bg-white shadow-2xs h-100 d-flex flex-column"
            style={{ borderColor: "#cbd5e1" }}
          >
            {/* Sağ Panel Başlık ve Hızlı Aksiyonlar */}
            <div
              className="px-3 py-2 border-bottom d-flex flex-wrap justify-content-between align-items-center bg-light rounded-top-2 gap-2"
              style={{ borderColor: "#e2e8f0" }}
            >
              <div className="fw-bold small text-dark d-flex align-items-center gap-1.5">
                <IconCash size={18} className="text-success" />
                <span>
                  {activeCurrency
                    ? `${activeCurrency.paraKodu} - ${activeCurrency.paraAdi}`
                    : "Para Seçiniz"}{" "}
                  Kupür Sayımı
                </span>
              </div>
              <div className="d-flex align-items-center gap-1.5">
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="py-0 px-2 fs-8 fw-semibold"
                  style={{ height: "26px" }}
                  onClick={handleAutoFillWithBalance}
                  title="Sistem Kasa Bakiyesini Kupürlere Otomatik Dağıt"
                >
                  <IconCalculator size={13} className="me-1" />
                  Bakiyeye Eşitle
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="py-0 px-2 fs-8 fw-semibold"
                  style={{ height: "26px" }}
                  onClick={handleResetActiveCurrency}
                  title="Bu Para Biriminin Sayımını Sıfırla"
                >
                  <IconTrash size={13} className="me-1" />
                  Sıfırla
                </Button>
              </div>
            </div>

            {/* Kupür Sayım Tablosu */}
            <div className="table-responsive flex-grow-1 p-2" style={{ maxHeight: "calc(100vh - 380px)" }}>
              <Table bordered size="sm" className="mb-0" style={{ fontSize: "13px" }}>
                <thead style={{ backgroundColor: "#f8fafc", color: "#475569" }}>
                  <tr>
                    <th style={{ width: "110px" }}>Kupür</th>
                    <th style={{ width: "140px" }} className="text-center">Adet</th>
                    <th className="text-end" style={{ width: "130px" }}>Tutar</th>
                    <th className="text-center" style={{ width: "160px" }}>Hızlı Ekle</th>
                    <th className="text-end" style={{ width: "70px" }}>Pay (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {activeKupurler.map((kupur, kIdx) => {
                    const adet = countsMap[activeKodUpper]?.[kupur] || 0;
                    const tutar = kupur * adet;
                    const pay =
                      activeSayilanTutar > 0
                        ? ((tutar / activeSayilanTutar) * 100).toFixed(1)
                        : "0.0";

                    return (
                      <tr key={`${activeKodUpper}-${kupur}-${kIdx}`} className="align-middle">
                        {/* Kupür Değeri */}
                        <td className="fw-bold text-dark ps-2">
                          <Badge bg="secondary" className="px-2 py-1 fs-7 me-1">
                            {kupur >= 1
                              ? kupur.toLocaleString("tr-TR")
                              : kupur.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                          </Badge>
                          <span className="text-muted small">{activeKodUpper}</span>
                        </td>

                        {/* Adet Inputu */}
                        <td className="text-center">
                          <Form.Control
                            ref={(el) => {
                              adetInputRefs.current[kIdx] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            size="sm"
                            className="text-center fw-bold font-monospace kupur-adet-input"
                            value={adet === 0 ? "" : String(adet)}
                            onChange={(e) => handleAdetChange(kupur, e.target.value)}
                            onKeyDown={(e) => handleInputKeyDown(e, kIdx)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0"
                            style={{
                              height: "32px",
                              fontSize: "13.5px",
                              borderColor: adet > 0 ? "#0284c7" : "#cbd5e1",
                              backgroundColor: adet > 0 ? "#f0f9ff" : "#ffffff",
                              color: adet > 0 ? "#0369a1" : "#1e293b",
                            }}
                          />
                        </td>

                        {/* Tutar */}
                        <td className="text-end fw-bold font-monospace text-dark pe-2">
                          {tutar > 0
                            ? tutar.toLocaleString("tr-TR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            : "-"}
                        </td>

                        {/* Hızlı Ekle Butonları */}
                        <td className="text-center">
                          <div className="d-inline-flex align-items-center gap-1">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="px-1.5 py-0 fs-8 fw-semibold"
                              style={{ height: "24px" }}
                              onClick={() => handleQuickAdd(kupur, 1)}
                            >
                              +1
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="px-1.5 py-0 fs-8 fw-semibold"
                              style={{ height: "24px" }}
                              onClick={() => handleQuickAdd(kupur, 5)}
                            >
                              +5
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="px-1.5 py-0 fs-8 fw-semibold"
                              style={{ height: "24px" }}
                              onClick={() => handleQuickAdd(kupur, 10)}
                            >
                              +10
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="px-1.5 py-0 fs-8 fw-semibold"
                              style={{ height: "24px" }}
                              onClick={() => handleQuickAdd(kupur, 50)}
                            >
                              +50
                            </Button>
                          </div>
                        </td>

                        {/* Pay Yüzdesi */}
                        <td className="text-end font-monospace text-muted small pe-2">
                          %{pay}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>

            {/* Sağ Panel: Kupür Sayım İcmali & Fark Kartı */}
            <div
              className="p-3 border-top bg-light rounded-bottom-2"
              style={{ borderColor: "#e2e8f0" }}
            >
              <Row className="g-2 text-center">
                <Col xs={6} sm={3}>
                  <div className="p-2 border rounded bg-white shadow-2xs">
                    <div className="text-muted fs-8 fw-semibold text-uppercase">Toplam Adet</div>
                    <div className="fs-6 fw-bold text-dark font-monospace mt-0.5">
                      {getToplamBanknotAdedi(activeKodUpper)} Adet
                    </div>
                  </div>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="p-2 border rounded bg-white shadow-2xs">
                    <div className="text-muted fs-8 fw-semibold text-uppercase">Kasa Bakiyesi</div>
                    <div className="fs-6 fw-bold text-secondary font-monospace mt-0.5">
                      {activeKasaBakiye.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </Col>
                <Col xs={6} sm={3}>
                  <div className="p-2 border rounded bg-white shadow-2xs">
                    <div className="text-muted fs-8 fw-semibold text-uppercase">Sayılan Tutar</div>
                    <div className="fs-6 fw-bold text-primary font-monospace mt-0.5">
                      {activeSayilanTutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </Col>
                <Col xs={6} sm={3}>
                  <div
                    className="p-2 border rounded shadow-2xs"
                    style={{
                      backgroundColor:
                        Math.abs(activeFark) < 0.001
                          ? "#dcfce7"
                          : activeFark > 0
                          ? "#e0f2fe"
                          : "#fee2e2",
                      borderColor:
                        Math.abs(activeFark) < 0.001
                          ? "#86efac"
                          : activeFark > 0
                          ? "#7dd3fc"
                          : "#fca5a5",
                    }}
                  >
                    <div
                      className="fs-8 fw-semibold text-uppercase"
                      style={{
                        color:
                          Math.abs(activeFark) < 0.001
                            ? "#15803d"
                            : activeFark > 0
                            ? "#0369a1"
                            : "#b91c1c",
                      }}
                    >
                      {Math.abs(activeFark) < 0.001
                        ? "Dengede"
                        : activeFark > 0
                        ? "Kasa Fazlası"
                        : "Kasa Noksanı"}
                    </div>
                    <div
                      className="fs-6 fw-bold font-monospace mt-0.5"
                      style={{
                        color:
                          Math.abs(activeFark) < 0.001
                            ? "#15803d"
                            : activeFark > 0
                            ? "#0369a1"
                            : "#b91c1c",
                      }}
                    >
                      {(activeFark > 0 ? "+" : "") +
                        activeFark.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </Col>
              </Row>
            </div>
          </div>
        </Col>
      </Row>

      {/* 4. Sayfa Ortasında Açılan Popup Bildirim Modalı */}
      <Modal
        show={!!popupNotification}
        onHide={() => setPopupNotification(null)}
        centered
        size="sm"
        backdrop="static"
        keyboard={true}
      >
        <Modal.Body className="p-4 text-center">
          {/* İkon */}
          <div className="mb-3 d-flex justify-content-center">
            {popupNotification?.type === "success" && (
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-success"
                style={{ width: "64px", height: "64px", backgroundColor: "#dcfce7" }}
              >
                <IconCheck size={36} stroke={2.5} />
              </div>
            )}
            {popupNotification?.type === "danger" && (
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-danger"
                style={{ width: "64px", height: "64px", backgroundColor: "#fee2e2" }}
              >
                <IconAlertCircle size={36} stroke={2.5} />
              </div>
            )}
            {popupNotification?.type === "warning" && (
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-warning"
                style={{ width: "64px", height: "64px", backgroundColor: "#fef3c7" }}
              >
                <IconAlertTriangle size={36} stroke={2.5} />
              </div>
            )}
            {popupNotification?.type === "info" && (
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-primary"
                style={{ width: "64px", height: "64px", backgroundColor: "#e0f2fe" }}
              >
                <IconInfoCircle size={36} stroke={2.5} />
              </div>
            )}
          </div>

          {/* Başlık */}
          <h5 className="fw-bold text-dark mb-2">{popupNotification?.title}</h5>

          {/* Mesaj */}
          <div
            className="text-secondary small mb-3 text-break"
            style={{ whiteSpace: "pre-line", lineHeight: 1.5 }}
          >
            {popupNotification?.message}
          </div>

          {/* Detay Bilgisi (Opsiyonel) */}
          {popupNotification?.details && (
            <div
              className="p-2 mb-3 bg-light rounded border text-start small font-monospace text-muted"
              style={{ fontSize: "11px", maxHeight: "100px", overflowY: "auto" }}
            >
              {popupNotification.details}
            </div>
          )}

          {/* Aksiyon Butonu */}
          <div className="d-flex justify-content-center mt-2">
            <Button
              variant={
                popupNotification?.type === "success"
                  ? "success"
                  : popupNotification?.type === "danger"
                  ? "danger"
                  : popupNotification?.type === "warning"
                  ? "warning"
                  : "primary"
              }
              size="sm"
              className="px-4 py-1.5 fw-bold shadow-sm"
              onClick={() => setPopupNotification(null)}
              autoFocus
            >
              Tamam (Enter)
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* 5. Geçmiş Sayımlar Modalı (F4) */}
      <Modal
        show={showHistoryModal}
        onHide={() => setShowHistoryModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="py-2.5 bg-light">
          <Modal.Title className="fs-6 fw-bold text-dark d-flex align-items-center gap-1.5">
            <IconHistory size={18} className="text-primary" />
            <span>Geçmiş Kasa Sayım Kayıtları ({selectedVezneKod || "Tüm Vezneler"})</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {isLoadingHistory ? (
            <div className="text-center py-4 text-muted">
              <Spinner animation="border" size="sm" className="me-2" />
              Geçmiş sayım kayıtları veritabanından getiriliyor...
            </div>
          ) : historyList.length === 0 ? (
            <div className="text-center py-4 text-muted">
              Bu vezneye ait kayıtlı geçmiş sayım bulunamadı.
            </div>
          ) : (
            <div className="table-responsive" style={{ maxHeight: "400px" }}>
              <Table hover bordered size="sm" className="mb-0 text-nowrap" style={{ fontSize: "12.5px" }}>
                <thead className="sticky-top bg-light text-secondary">
                  <tr>
                    <th style={{ width: "60px" }} className="text-center">Kayıt No</th>
                    <th style={{ width: "100px" }}>Tarih</th>
                    <th style={{ width: "70px" }}>Saat</th>
                    <th style={{ width: "120px" }}>Vezne</th>
                    <th>Sayım Yapan</th>
                    <th>Açıklama</th>
                    <th style={{ width: "90px" }} className="text-center">Durum</th>
                    <th style={{ width: "110px" }} className="text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {historyList.map((item) => (
                    <tr key={item.sayimId} className="align-middle">
                      <td className="text-center fw-bold font-monospace">#{item.sayimId}</td>
                      <td>{item.tarih ? new Date(item.tarih).toLocaleDateString("tr-TR") : "-"}</td>
                      <td>{item.saat || "-"}</td>
                      <td className="fw-semibold">{item.vezneKodu || item.vezneAdi || item.vezneId}</td>
                      <td>{item.kullaniciAdi || "-"}</td>
                      <td className="text-truncate" style={{ maxWidth: "180px" }}>
                        {item.aciklama || "-"}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge ${
                            item.genelDurum === "Dengede"
                              ? "bg-success"
                              : item.genelDurum === "Farklı"
                              ? "bg-warning text-dark"
                              : "bg-secondary"
                          }`}
                        >
                          {item.genelDurum || "Kaydedildi"}
                        </span>
                      </td>
                      <td className="text-center">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="py-0 px-2 fs-8 fw-semibold"
                          onClick={() => handleLoadHistoryItem(item.sayimId!)}
                          title="Bu sayımı ekrana yükle"
                        >
                          <IconEye size={13} className="me-1" />
                          Yükle
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="bg-light py-1.5 px-3">
          <Button variant="secondary" size="sm" onClick={() => setShowHistoryModal(false)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 6. Vezne Seçim Lookup Modalı (F8 / F12) */}
      <LookupModal<VezneItem>
        show={showVezneLookup}
        onHide={() => setShowVezneLookup(false)}
        title="Vezne Seçiniz (F8 / F12)"
        items={vezneList}
        columns={vezneColumns}
        searchPlaceholder="Vezne ara..."
        filterFn={(item, term) =>
          item.kod.toLowerCase().includes(term.toLowerCase()) ||
          item.ad.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(item) => {
          setSelectedVezneId(item.id);
          setSelectedVezneKod(item.kod);
          setSelectedVezneAd(item.ad);
          setShowVezneLookup(false);
        }}
      />

      {/* 7. Tüm Sayımları Temizle Onay Modalı */}
      <Modal
        show={showClearConfirmModal}
        onHide={() => setShowClearConfirmModal(false)}
        centered
        size="sm"
      >
        <Modal.Header closeButton className="py-2 bg-light">
          <Modal.Title className="fs-6 fw-bold text-danger">
            <IconTrash size={18} className="me-1" />
            Sayımları Sıfırla
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="py-3">
          <p className="small mb-0 text-muted">
            Girilen tüm para birimlerine ait banknot ve madeni para sayım adetleri sıfırlanacaktır.
            Onaylıyor musunuz?
          </p>
        </Modal.Body>
        <Modal.Footer className="py-1.5 bg-light">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowClearConfirmModal(false)}
          >
            Vazgeç
          </Button>
          <Button variant="danger" size="sm" onClick={handleClearAll}>
            Evet, Sıfırla
          </Button>
        </Modal.Footer>
      </Modal>

      {/* 8. Resmi Kasa Sayım Tutanağı / Yazdırma Modalı (F7) */}
      <Modal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton className="py-2 bg-light">
          <Modal.Title className="fs-6 fw-bold text-dark">
            <IconPrinter size={18} className="me-1 text-primary" />
            Vezne Kasa Sayım Tutanağı Önizleme
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4" id="print-sayim-tutanagi">
          {/* Tutanak Üst Başlık */}
          <div className="text-center border-bottom pb-3 mb-3">
            <h4 className="fw-bold mb-1 text-dark">
              {companyTanim?.FIRMA_ADI || "LİKYA KUYUMCULUK"}
            </h4>
            <h5 className="text-secondary fw-semibold mb-2">VEZNE KASA SAYIM TUTANAĞI</h5>
            <div className="d-flex justify-content-between small text-muted px-2 mt-2">
              <div>
                <strong>Tarih:</strong> {new Date(tarih).toLocaleDateString("tr-TR")}
              </div>
              <div>
                <strong>Vezne:</strong> {selectedVezneKod} - {selectedVezneAd}
              </div>
              <div>
                <strong>Sayım Yapan:</strong> {user?.fullName || user?.username || "Veznedar"}
              </div>
            </div>
            {aciklama && (
              <div className="text-start small text-muted mt-2 px-2">
                <strong>Açıklama:</strong> {aciklama}
              </div>
            )}
          </div>

          {/* Sayım İcmal Tablosu */}
          <h6 className="fw-bold mb-2 text-dark">1. Para Birimleri İcmali</h6>
          <Table bordered size="sm" className="mb-4 text-center" style={{ fontSize: "12px" }}>
            <thead className="bg-light">
              <tr>
                <th>Para Birimi</th>
                <th className="text-end">Kasa Bakiyesi</th>
                <th className="text-end">Sayılan Tutar</th>
                <th className="text-end">Fark</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {masterCurrencies.map((curr, i) => {
                const sayilan = getSayilanTutar(curr.paraKodu);
                const bakiye = curr.kasaBakiyesi;
                const fark = sayilan - bakiye;
                if (sayilan === 0 && bakiye === 0) return null;

                return (
                  <tr key={i}>
                    <td className="text-start fw-bold">
                      {curr.paraKodu} - {curr.paraAdi}
                    </td>
                    <td className="text-end">
                      {bakiye.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="text-end fw-bold">
                      {sayilan.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td
                      className={`text-end fw-bold ${
                        Math.abs(fark) < 0.001
                          ? "text-success"
                          : fark > 0
                          ? "text-primary"
                          : "text-danger"
                      }`}
                    >
                      {(fark > 0 ? "+" : "") +
                        fark.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      {Math.abs(fark) < 0.001
                        ? "Dengede"
                        : fark > 0
                        ? "Fazla"
                        : "Eksik"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {/* Kupür Dökümü Tablosu */}
          <h6 className="fw-bold mb-2 text-dark">2. Ayrıntılı Kupür Dökümü</h6>
          <Table bordered size="sm" className="mb-4" style={{ fontSize: "11.5px" }}>
            <thead className="bg-light text-center">
              <tr>
                <th>Para</th>
                <th>Kupür</th>
                <th>Adet</th>
                <th className="text-end">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {masterCurrencies.flatMap((curr) => {
                const currCounts = countsMap[curr.paraKodu.toUpperCase().trim()] || {};
                const kupurs = getKupurlerForCurrency(curr.paraId, curr.paraKodu);
                const entries = kupurs
                  .filter((kupur) => (currCounts[kupur] || 0) > 0)
                  .map((kupur, kIdx) => {
                    const adet = currCounts[kupur] || 0;
                    const tutar = kupur * adet;
                    return (
                      <tr key={`${curr.paraKodu}-${kupur}-${kIdx}`}>
                        <td className="fw-bold">{curr.paraKodu}</td>
                        <td className="text-center">{kupur.toLocaleString("tr-TR")}</td>
                        <td className="text-center fw-bold">{adet}</td>
                        <td className="text-end font-monospace">
                          {tutar.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  });
                return entries;
              })}
            </tbody>
          </Table>

          {/* İmza Alanları */}
          <div className="d-flex justify-content-between pt-4 mt-4 border-top small text-center text-muted">
            <div style={{ width: "200px" }}>
              <div>
                <strong>Sayımı Yapan Veznedar</strong>
              </div>
              <div className="mt-1">{user?.fullName || user?.username || "Veznedar"}</div>
              <div className="mt-4">İmza: __________________</div>
            </div>
            <div style={{ width: "200px" }}>
              <div>
                <strong>Kasa Şefi / Şube Müdürü</strong>
              </div>
              <div className="mt-1">Kontrol Eden</div>
              <div className="mt-4">İmza: __________________</div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-light py-1.5 px-3">
          <Button variant="secondary" size="sm" onClick={() => setShowPrintModal(false)}>
            Kapat
          </Button>
          <Button variant="primary" size="sm" onClick={() => window.print()}>
            <IconPrinter size={16} className="me-1" />
            Yazdır (Print)
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default VezneParaSayPage;

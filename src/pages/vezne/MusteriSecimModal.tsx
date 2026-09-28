import React, { useState, useEffect, useRef, useMemo } from "react";
import { Modal, Table, Button, Form, InputGroup, Badge, Nav, Spinner } from "react-bootstrap";
import { IconUser, IconX, IconSearch, IconCheck, IconCornerDownLeft, IconUserOff, IconUsers, IconPlus, IconGlobe } from "@tabler/icons-react";
import { CariKartItem, CariService } from "../../services/cariService";
import { DovizFisService, KayitsizMusteriItem } from "../../services/dovizFisService";
import { CariCardRegistrationPage } from "../cari/CariCardRegistrationPage";
import { highlightText } from "../../components/common/HighlightText";
import { ebelgeService } from "../../services/ebelgeService";
import { GibKullanici, gibAliasToEposta, gibKullanicilariTekillestir } from "../../utils/gibKullanici";

export type CustomerSelectionType = "registered" | "unregistered" | "anonymous";

export interface SelectedCustomerResult {
  type: CustomerSelectionType;
  id: number | null;
  kod?: string;
  unvan: string;
  vergiKimlikNo?: string;
  adres?: string;
  telefon?: string;
  eposta?: string;
  eFaturaPostaKutusu?: string;
  isMukellef?: boolean;
  vergiDairesi?: string;
  il?: string;
  ilce?: string;
  raw?: CariKartItem | KayitsizMusteriItem | GibKullanici;
}

export type CustomerSearchField = "all" | "kod" | "unvan" | "vkn";

interface MusteriSecimModalProps {
  show: boolean;
  onClose: () => void;
  cariler: CariKartItem[];
  kayitsizMusteriler: KayitsizMusteriItem[];
  onSelectCustomer: (result: SelectedCustomerResult) => void;
  currentUnvan?: string;
  initialSearchTerm?: string;
  initialSearchField?: CustomerSearchField;
}

type ActiveTab = "registered" | "unregistered";

type UnifiedItem =
  | { _kind: "registered"; data: CariKartItem }
  | { _kind: "unregistered"; data: KayitsizMusteriItem }
  | { _kind: "gib"; data: GibKullanici };

export const MusteriSecimModal: React.FC<MusteriSecimModalProps> = ({
  show,
  onClose,
  cariler,
  kayitsizMusteriler,
  onSelectCustomer,
  currentUnvan,
  initialSearchTerm = "",
  initialSearchField = "all",
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("registered");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [searchField, setSearchField] = useState<CustomerSearchField>(initialSearchField);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [internalCariler, setInternalCariler] = useState<CariKartItem[]>(cariler || []);
  const [internalKayitsizlar, setInternalKayitsizlar] = useState<KayitsizMusteriItem[]>(kayitsizMusteriler || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showNewCariModal, setShowNewCariModal] = useState<boolean>(false);

  const [gibResults, setGibResults] = useState<GibKullanici[]>([]);
  const [isGibLoading, setIsGibLoading] = useState<boolean>(false);

  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveCariler = cariler && cariler.length > 0 ? cariler : internalCariler;
  const effectiveKayitsizlar = kayitsizMusteriler && kayitsizMusteriler.length > 0 ? kayitsizMusteriler : internalKayitsizlar;

  useEffect(() => {
    if (cariler && cariler.length > 0) setInternalCariler(cariler);
  }, [cariler]);

  useEffect(() => {
    if (kayitsizMusteriler && kayitsizMusteriler.length > 0) setInternalKayitsizlar(kayitsizMusteriler);
  }, [kayitsizMusteriler]);

  useEffect(() => {
    if (!show) return;
    const term = initialSearchTerm ? initialSearchTerm.trim() : "";
    setSearchTerm(term);
    setSearchField(initialSearchField || "all");
    setSelectedIndex(0);
    setGibResults([]);

    const checkAndFetch = async () => {
      const needsCariler = effectiveCariler.length === 0;
      const needsKayitsiz = effectiveKayitsizlar.length === 0;

      if (needsCariler || needsKayitsiz) {
        if (needsCariler) setIsLoading(true);
        try {
          const [fetchedCariler, fetchedKayitsizlar] = await Promise.all([
            needsCariler ? CariService.getCariKartlar().catch(() => [] as CariKartItem[]) : Promise.resolve(effectiveCariler),
            needsKayitsiz ? DovizFisService.getKayitsizMusteriler().catch(() => [] as KayitsizMusteriItem[]) : Promise.resolve(effectiveKayitsizlar),
          ]);
          if (fetchedCariler && fetchedCariler.length > 0) {
            setInternalCariler(fetchedCariler.map((c) => ({
              ...c,
              kod: (c.kod || "").replace(/\s+/g, " ").trim(),
              ad: (c.ad || "").replace(/\s+/g, " ").trim(),
              telefon: (c.telefon || "").trim(),
            })));
          }
          if (fetchedKayitsizlar && fetchedKayitsizlar.length > 0) setInternalKayitsizlar(fetchedKayitsizlar);
        } finally {
          setIsLoading(false);
        }
      }

      const cleanDigits = term.replace(/\D/g, "");
      if (cleanDigits.length === 10 || cleanDigits.length === 11) void handleGibSearch(cleanDigits);

      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          if (term) searchInputRef.current.select();
        }
      }, 60);
    };

    checkAndFetch();
  }, [show, initialSearchTerm, initialSearchField]);

  useEffect(() => { setSelectedIndex(0); }, [activeTab]);

  const handleGibSearch = async (targetVkn?: string) => {
    const rawVkn = (targetVkn || searchTerm || "").replace(/\D/g, "");
    if (rawVkn.length !== 10 && rawVkn.length !== 11) return;
    setIsGibLoading(true);
    try {
      const res = await ebelgeService.mukellefSorgula(rawVkn);
      if (res && res.mukellefMi && res.kullanicilar && res.kullanicilar.length > 0) {
        setGibResults(gibKullanicilariTekillestir(res.kullanicilar));
      } else {
        setGibResults([]);
      }
    } catch {
      setGibResults([]);
    } finally {
      setIsGibLoading(false);
    }
  };

  useEffect(() => {
    const clean = searchTerm.replace(/\D/g, "");
    if (clean.length === 10 || clean.length === 11) {
      const timer = setTimeout(() => void handleGibSearch(clean), 450);
      return () => clearTimeout(timer);
    } else {
      setGibResults([]);
    }
  }, [searchTerm]);

  const currentList = useMemo((): UnifiedItem[] => {
    const sourceList = activeTab === "registered" ? effectiveCariler : effectiveKayitsizlar;
    const term = searchTerm.toLowerCase().trim();

    const filtered = sourceList.filter((item) => {
      if (!term) return true;
      const kod = (item as any).kod ? String((item as any).kod).toLowerCase() : "";
      const ad = item.ad ? item.ad.toLowerCase() : "";
      const unvan = (item as any).unvan ? String((item as any).unvan).toLowerCase() : "";
      const vkn = item.vergiKimlikNo ? item.vergiKimlikNo.replace(/\s+/g, "").toLowerCase() : "";
      const tel = item.telefon ? item.telefon.toLowerCase() : "";
      const adres = (item as any).adres ? String((item as any).adres).toLowerCase() : "";
      const il = (item as any).il ? String((item as any).il).toLowerCase() : "";
      const ilce = (item as any).ilce ? String((item as any).ilce).toLowerCase() : "";
      if (searchField === "kod") return kod.includes(term);
      if (searchField === "unvan") return ad.includes(term) || unvan.includes(term);
      if (searchField === "vkn") return vkn.includes(term.replace(/\s+/g, ""));
      return kod.includes(term) || ad.includes(term) || unvan.includes(term) ||
        vkn.includes(term.replace(/\s+/g, "")) || tel.includes(term) ||
        adres.includes(term) || il.includes(term) || ilce.includes(term);
    });

    const sqlItems: UnifiedItem[] = filtered.map((item) =>
      activeTab === "registered"
        ? { _kind: "registered", data: item as CariKartItem }
        : { _kind: "unregistered", data: item as KayitsizMusteriItem }
    );

    const gibItems: UnifiedItem[] = gibResults.map((g) => ({ _kind: "gib" as const, data: g }));

    return [...sqlItems, ...gibItems];
  }, [activeTab, effectiveCariler, effectiveKayitsizlar, gibResults, searchTerm, searchField]);

  useEffect(() => {
    if (show && selectedIndex !== null && rowRefs.current[selectedIndex]) {
      rowRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [selectedIndex, show]);

  const handleSelectRow = async (item: UnifiedItem) => {
    if (item._kind === "registered") {
      const c = item.data as CariKartItem;
      onSelectCustomer({
        type: "registered",
        id: c.id,
        kod: c.kod,
        unvan: c.ad || (c as any).unvan || "",
        vergiKimlikNo: c.vergiKimlikNo || "",
        adres: c.adres || "",
        telefon: c.telefon || "",
        eposta: c.eposta || (c as any).eFaturaPostaKutusu || "",
        eFaturaPostaKutusu: (c as any).eFaturaPostaKutusu || (c as any).eFaturaPosta || "",
        vergiDairesi: (c as any).vergiDairesi || "",
        il: (c as any).il || "",
        ilce: (c as any).ilce || "",
        isMukellef: Boolean((c as any).eFaturaPostaKutusu || (c as any).eFaturaPosta || (c as any).eFatura),
        raw: c,
      });
    } else if (item._kind === "unregistered") {
      const k = item.data as KayitsizMusteriItem;
      onSelectCustomer({
        type: "unregistered",
        id: null,
        kod: "",
        unvan: k.ad || k.unvan || "",
        vergiKimlikNo: k.vergiKimlikNo || "",
        adres: k.adres || "",
        telefon: k.telefon || "",
        eposta: (k as any).eposta || "",
        vergiDairesi: (k as any).vergiDairesi || "",
        il: (k as any).il || "",
        ilce: (k as any).ilce || "",
        raw: k,
      });
    } else {
      const g = item.data as GibKullanici;
      const alias = g.Alias || g.Identifier || "";
      const eposta = gibAliasToEposta(alias);
      const cleanVkn = (g.Identifier || searchTerm || "").replace(/\D/g, "");
      let extraAdres = "", extraTel = "", extraVd = "", extraIl = "", extraIlce = "";
      try {
        if (cleanVkn) {
          const adrs = await ebelgeService.aliciAdresleri(cleanVkn);
          if (Array.isArray(adrs) && adrs.length > 0) {
            extraAdres = adrs[0].adres || "";
            extraTel = adrs[0].telefon || "";
            extraVd = adrs[0].vergiDairesi || "";
            extraIl = adrs[0].il || "";
            extraIlce = adrs[0].ilce || "";
          }
        }
      } catch { }
      onSelectCustomer({
        type: "unregistered",
        id: null,
        kod: "",
        unvan: g.Title || "",
        vergiKimlikNo: cleanVkn,
        adres: extraAdres,
        telefon: extraTel,
        eposta,
        eFaturaPostaKutusu: alias,
        vergiDairesi: extraVd,
        il: extraIl,
        ilce: extraIlce,
        isMukellef: true,
        raw: g,
      });
    }
    onClose();
  };

  const handleSelectIsimBeyanEdilmemistir = () => {
    onSelectCustomer({ type: "anonymous", id: null, kod: "", unvan: "İSİM BEYAN EDİLMEMİŞTİR", vergiKimlikNo: "", adres: "", telefon: "" });
    onClose();
  };

  const handleConfirm = () => {
    if (selectedIndex !== null && currentList[selectedIndex]) void handleSelectRow(currentList[selectedIndex]);
    else if (currentList.length > 0) void handleSelectRow(currentList[0]);
  };

  useEffect(() => {
    if (!show || showNewCariModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (/^F([1-9]|1[0-2])$/.test(e.key)) { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        setSelectedIndex((prev) => prev === null ? 0 : prev < currentList.length - 1 ? prev + 1 : prev);
      } else if (e.key === "ArrowUp") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        setSelectedIndex((prev) => prev === null ? 0 : prev > 0 ? prev - 1 : 0);
      } else if (e.key === "Enter") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, showNewCariModal, currentList, selectedIndex]);

  const selectedItem = selectedIndex !== null ? currentList[selectedIndex] : null;

  return (
    <>
      <style>{`
        .cari-secim-modal-custom .modal-dialog {
          max-width: 96vw !important;
          margin: 1.5rem auto !important;
        }
        .cari-secim-modal-custom .modal-content {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .musteri-row { cursor: pointer; transition: background-color 0.15s ease; }
        .musteri-row:not(.musteri-selected-row):hover,
        .musteri-row:not(.musteri-selected-row):hover > td,
        .musteri-row:not(.musteri-selected-row):hover > th {
          background-color: #e0f2fe !important;
          --bs-table-bg: #e0f2fe !important;
          --bs-table-accent-bg: #e0f2fe !important;
          --bs-table-hover-bg: #e0f2fe !important;
          box-shadow: inset 0 0 0 9999px #e0f2fe !important;
          color: #0369a1 !important;
        }
        .musteri-selected-row,
        .musteri-selected-row > td,
        .musteri-selected-row > th,
        .musteri-selected-row:hover,
        .musteri-selected-row:hover > td,
        .musteri-selected-row:hover > th {
          background-color: #bae6fd !important;
          --bs-table-bg: #bae6fd !important;
          --bs-table-accent-bg: #bae6fd !important;
          box-shadow: inset 0 0 0 9999px #bae6fd !important;
          color: #0c4a6e !important;
          font-weight: 600;
        }
        .gib-row > td { background-color: #f0fdf4 !important; }
        .gib-row.musteri-selected-row,
        .gib-row.musteri-selected-row > td,
        .gib-row.musteri-selected-row > th,
        .gib-row.musteri-selected-row:hover,
        .gib-row.musteri-selected-row:hover > td,
        .gib-row.musteri-selected-row:hover > th {
          background-color: #bbf7d0 !important;
          --bs-table-bg: #bbf7d0 !important;
          --bs-table-accent-bg: #bbf7d0 !important;
          box-shadow: inset 0 0 0 9999px #bbf7d0 !important;
          color: #166534 !important;
          font-weight: 600;
        }
      `}</style>

      <Modal
        show={show}
        onHide={onClose}
        size="xl"
        centered
        backdrop="static"
        keyboard={false}
        dialogClassName="cari-secim-modal-custom"
      >
        <div
          className="d-flex flex-column"
          style={{
            border: "1px solid #475569",
            borderRadius: "6px",
            backgroundColor: "#ffffff",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            width: "100%",
            maxWidth: "960px",
            margin: "0 auto",
            overflow: "hidden",
          }}
        >
          {/* Başlık */}
          <div
            className="d-flex align-items-center justify-content-between px-3 py-2"
            style={{ backgroundColor: "#e2e8f0", borderBottom: "1px solid #94a3b8" }}
          >
            <div className="d-flex align-items-center gap-2">
              <div className="d-flex align-items-center justify-content-center rounded-circle"
                style={{ width: "22px", height: "22px", backgroundColor: "#0284c7", color: "#fff" }}>
                <IconUsers size={14} />
              </div>
              <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
                Cari / Müşteri Seçimi
              </span>
              {isGibLoading && (
                <span className="d-flex align-items-center gap-1 text-success" style={{ fontSize: "11px" }}>
                  <Spinner animation="border" size="sm" style={{ width: "11px", height: "11px" }} />
                  e-Fatura sorgulanıyor...
                </span>
              )}
              {!isGibLoading && gibResults.length > 0 && (
                <Badge bg="success" style={{ fontSize: "10px" }}>
                  {gibResults.length} e-Fatura kaydı bulundu
                </Badge>
              )}
            </div>
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="outline-primary" size="sm"
                onClick={handleSelectIsimBeyanEdilmemistir}
                className="d-flex align-items-center gap-1 py-0 px-2 fw-semibold"
                style={{ fontSize: "11.5px", height: "24px", backgroundColor: "#f0f9ff", borderColor: "#0284c7", color: "#0284c7" }}
              >
                <IconUserOff size={13} />
                <span>İSİM BEYAN EDİLMEMİŞTİR</span>
              </Button>
              <button type="button" className="btn btn-sm p-0 d-flex align-items-center justify-content-center border"
                style={{ width: "24px", height: "22px", backgroundColor: "#f8fafc", borderColor: "#cbd5e1", borderRadius: "3px" }}
                onClick={onClose} title="Kapat (ESC)">
                <IconX size={14} className="text-dark" />
              </button>
            </div>
          </div>

          {/* Sekmeler */}
          <div className="px-3 pt-2 pb-0 bg-light border-bottom">
            <Nav variant="tabs" className="border-bottom-0" style={{ fontSize: "12.5px" }}>
              <Nav.Item>
                <Nav.Link
                  active={activeTab === "registered"}
                  onClick={() => setActiveTab("registered")}
                  className="py-1 px-3 fw-semibold"
                  style={{
                    color: activeTab === "registered" ? "#0284c7" : "#64748b",
                    backgroundColor: activeTab === "registered" ? "#ffffff" : "transparent",
                    borderBottomColor: activeTab === "registered" ? "#ffffff" : undefined,
                    cursor: "pointer",
                  }}
                >
                  Kayıtlı Cariler ({effectiveCariler.length})
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  active={activeTab === "unregistered"}
                  onClick={() => setActiveTab("unregistered")}
                  className="py-1 px-3 fw-semibold"
                  style={{
                    color: activeTab === "unregistered" ? "#0284c7" : "#64748b",
                    backgroundColor: activeTab === "unregistered" ? "#ffffff" : "transparent",
                    borderBottomColor: activeTab === "unregistered" ? "#ffffff" : undefined,
                    cursor: "pointer",
                  }}
                >
                  Kayıtsız Müşteriler ({effectiveKayitsizlar.length})
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </div>

          {/* Arama */}
          <div className="px-3 pt-2 pb-2 bg-white border-bottom">
            <div className="d-flex align-items-center gap-1 mb-1">
              <span className="text-muted small fw-semibold me-1" style={{ fontSize: "11px" }}>Arama Alanı:</span>
              {[
                { id: "all", label: "Tümü" },
                { id: "kod", label: "Cari Kodu" },
                { id: "unvan", label: "Ünvan / Ad" },
                { id: "vkn", label: "TCKN / VKN" },
              ].map((f) => (
                <Badge
                  key={f.id}
                  className="cursor-pointer border py-1 px-2"
                  style={{
                    fontSize: "11px", cursor: "pointer",
                    backgroundColor: searchField === f.id ? "#0284c7" : "#f1f5f9",
                    borderColor: searchField === f.id ? "#0284c7" : "#cbd5e1",
                    color: searchField === f.id ? "white" : "#334155",
                  }}
                  onClick={() => { setSearchField(f.id as CustomerSearchField); setSelectedIndex(0); searchInputRef.current?.focus(); }}
                >
                  {f.label}
                </Badge>
              ))}
            </div>
            <InputGroup size="sm">
              <InputGroup.Text className="bg-white border-end-0">
                <IconSearch size={14} className="text-secondary" />
              </InputGroup.Text>
              <Form.Control
                ref={searchInputRef}
                placeholder={
                  searchField === "kod" ? "Sadece Cari Kodu ile arayın..." :
                  searchField === "unvan" ? "Sadece Ünvan / Ad ile arayın..." :
                  searchField === "vkn" ? "TCKN / VKN (10-11 hane ise e-Fatura otomatik sorgulanır)..." :
                  activeTab === "registered" ? "Cari kodu, ünvanı, VKN/TCKN ile arayın..." :
                  "Müşteri adı/ünvanı, VKN/TCKN ile arayın..."
                }
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setSelectedIndex(0); }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault(); e.stopPropagation();
                    setSelectedIndex((prev) => prev === null ? 0 : prev < currentList.length - 1 ? prev + 1 : prev);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault(); e.stopPropagation();
                    setSelectedIndex((prev) => prev === null ? 0 : prev > 0 ? prev - 1 : 0);
                  } else if (e.key === "Enter") {
                    e.preventDefault(); e.stopPropagation();
                    handleConfirm();
                  } else if (e.key === "Escape") {
                    e.preventDefault(); e.stopPropagation();
                    onClose();
                  }
                }}
                className="border-start-0 shadow-none"
                style={{ fontSize: "13px" }}
              />
              {searchTerm && (
                <Button variant="outline-secondary" className="border-start-0 bg-white"
                  onClick={() => { setSearchTerm(""); setSelectedIndex(0); searchInputRef.current?.focus(); }}>
                  <IconX size={13} />
                </Button>
              )}
            </InputGroup>
          </div>

          {/* İpucu */}
          <div className="d-flex align-items-center justify-content-between px-3 py-1 bg-light text-muted small border-bottom">
            <span>
              💡 <strong>İpucu:</strong> Çift tıklayın veya <strong>Enter</strong> ile forma aktarın. 10/11 haneli VKN/TCKN girilince e-Fatura otomatik sorgulanır.
            </span>
            {selectedItem && (
              <Badge className="py-1 px-2 d-flex align-items-center gap-1" style={{ backgroundColor: "#0284c7" }}>
                <IconCheck size={12} />
                {(selectedItem.data as any).kod || (selectedItem.data as any).Title || (selectedItem.data as any).ad || (selectedItem.data as any).unvan || "Seçildi"}
              </Badge>
            )}
          </div>

          {/* Tablo */}
          <div style={{ maxHeight: "360px", minHeight: "220px", overflowY: "auto", backgroundColor: "#f8fafc" }}>
            {isLoading && currentList.length === 0 ? (
              <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
                <Spinner animation="border" size="sm" className="mb-2 text-primary" />
                <span style={{ fontSize: "13px" }}>Kayıtlar yükleniyor...</span>
              </div>
            ) : currentList.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <p className="mb-1 fw-semibold" style={{ fontSize: "13.5px" }}>Kayıt bulunamadı</p>
                <p className="small mb-0" style={{ fontSize: "12px" }}>
                  {searchTerm ? `"${searchTerm}" aramasına uygun kayıt bulunamadı.` :
                    activeTab === "unregistered" ? "Kayıtsız müşteri kaydı bulunmuyor." : "Tanımlı cari kaydı bulunmuyor."}
                </p>
              </div>
            ) : (
              <Table bordered hover size="sm" className="mb-0 bg-white" style={{ fontSize: "12.5px" }}>
                <thead className="sticky-top"
                  style={{ backgroundColor: "#f1f5f9", color: "#334155", borderBottom: "2px solid #cbd5e1", zIndex: 2 }}>
                  <tr>
                    <th style={{ width: "130px" }} className="px-3 py-2">{activeTab === "registered" ? "Cari Kodu" : "Müşteri No"}</th>
                    <th className="px-3 py-2">Ünvan / Ad</th>
                    <th style={{ width: "150px" }} className="px-3 py-2">VKN / TCKN</th>
                    <th style={{ width: "130px" }} className="px-3 py-2">Telefon</th>
                    <th style={{ width: "110px", textAlign: "center" }} className="px-2 py-2">Tür</th>
                    <th style={{ width: "70px", textAlign: "center" }} className="px-2 py-2">Seçim</th>
                  </tr>
                </thead>
                <tbody>
                  {currentList.map((item, idx) => {
                    const isSelected = selectedIndex === idx;
                    const isGib = item._kind === "gib";
                    const sel = item.data as any;
                    const kod = isGib ? (sel.Identifier || searchTerm || "-") : (sel.kod || `#${sel.id}`);
                    const ad = isGib ? (sel.Title || "-") : (sel.ad || sel.unvan || "-");
                    const vkn = isGib ? (sel.Identifier || "-") : (sel.vergiKimlikNo || "-");
                    const tel = isGib ? "-" : (sel.telefon || "-");

                    return (
                      <tr
                        key={isGib ? `gib-${idx}` : (sel.id || idx)}
                        ref={(el) => { rowRefs.current[idx] = el; }}
                        className={`musteri-row${isGib ? " gib-row" : ""}${isSelected ? " musteri-selected-row" : ""}`}
                        onClick={() => setSelectedIndex(idx)}
                        onDoubleClick={() => handleSelectRow(item)}
                      >
                        <td className="px-3 py-2 font-monospace fw-bold text-start align-middle">
                          {!isGib && (searchField === "kod" || searchField === "all") ? highlightText(kod, searchTerm) : kod}
                        </td>
                        <td className="px-3 py-2 text-start align-middle fw-medium">
                          {isGib ? (
                            <span className="d-flex align-items-center gap-1">
                              <IconGlobe size={12} className="text-success flex-shrink-0" />
                              {ad}
                            </span>
                          ) : (searchField === "unvan" || searchField === "all") ? highlightText(ad, searchTerm) : ad}
                        </td>
                        <td className="px-3 py-2 font-monospace text-start align-middle">
                          {!isGib && (searchField === "vkn" || searchField === "all") ? highlightText(vkn, searchTerm) : vkn}
                        </td>
                        <td className="px-3 py-2 text-start align-middle text-muted">
                          {!isGib && searchField === "all" ? highlightText(tel, searchTerm) : tel}
                        </td>
                        <td className="text-center align-middle px-2 py-1">
                          {isGib ? (
                            <Badge bg="success" style={{ fontSize: "10.5px" }}>e-Fatura</Badge>
                          ) : (
                            <Badge style={{
                              fontSize: "10.5px",
                              backgroundColor: item._kind === "registered" ? "#e0f2fe" : "#fef9c3",
                              color: item._kind === "registered" ? "#0369a1" : "#92400e",
                              border: `1px solid ${item._kind === "registered" ? "#bae6fd" : "#fde68a"}`,
                            }}>
                              {item._kind === "registered" ? "Kayıtlı" : "Kayıtsız"}
                            </Badge>
                          )}
                        </td>
                        <td className="text-center align-middle px-2 py-1">
                          <Button
                            size="sm"
                            variant={isSelected ? (isGib ? "success" : "primary") : "outline-secondary"}
                            className={`py-0 px-2${isSelected ? " fw-bold shadow-sm" : ""}`}
                            style={{ fontSize: "11.5px" }}
                            onClick={(e) => { e.stopPropagation(); void handleSelectRow(item); }}
                          >
                            Seç
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </div>

          {/* Detay Paneli */}
          {selectedItem && (() => {
            const isGibItem = selectedItem._kind === "gib";
            const sel = selectedItem.data as any;
            const kod = isGibItem ? "e-Fatura" : (sel.kod || `#${sel.id || "-"}`);
            const unvan = isGibItem ? (sel.Title || "-") : (sel.ad || sel.unvan || "-");
            const vkn = isGibItem ? (sel.Identifier || searchTerm || "-") : (sel.vergiKimlikNo || "-");
            const vd = sel.vergiDairesi || "-";
            const tel = sel.telefon || "-";
            const pkAlias = isGibItem ? (sel.Alias || "-") : (sel.eFaturaPostaKutusu || "-");
            const email = isGibItem ? (gibAliasToEposta(sel.Alias) || "-") : (sel.eposta || "-");
            const yetkili = sel.yetkiliKisi || sel.babaAdi || "-";
            const tipStr = isGibItem ? "GİB e-Fatura Mükellefi"
              : (sel.kisilikTipi === 1 ? "Tüzel Kişi (Şirket)" : sel.kisilikTipi === 2 ? "Yabancı Uyruklu" : "Gerçek Kişi (Şahıs)");
            const adresStr = [sel.adres, sel.ilce, sel.il].filter(Boolean).join(" / ") || "-";

            return (
              <div className="px-3 py-2 bg-white border-top">
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="fw-bold text-dark d-flex align-items-center gap-1" style={{ fontSize: "11.5px" }}>
                    <IconUser size={14} className={isGibItem ? "text-success" : "text-primary"} />
                    <span>{isGibItem ? "GİB e-Fatura Mükellef Bilgisi" : "Cari Detay Bilgisi"}</span>
                  </span>
                  <div className="d-flex align-items-center gap-1">
                    <span className={`badge border font-monospace px-2 py-1 ${isGibItem ? "bg-success-subtle text-success border-success-subtle" : "bg-light text-secondary"}`} style={{ fontSize: "10.5px" }}>
                      {tipStr}
                    </span>
                    <span className={`badge border px-2 py-1 ${isGibItem ? "bg-success text-white" : "bg-primary-subtle text-primary border-primary-subtle"}`} style={{ fontSize: "10.5px" }}>
                      {isGibItem ? "GİB e-Fatura (Formu Doldurur)" : (selectedItem._kind === "registered" ? "Kayıtlı Cari" : "Kayıtsız Müşteri")}
                    </span>
                  </div>
                </div>
                <div className="p-2 rounded bg-light border" style={{ fontSize: "11.5px" }}>
                  <div className="row g-1">
                    <div className="col-12 col-md-5">
                      <div className="text-muted" style={{ fontSize: "10px" }}>Ünvan / Ad Soyad:</div>
                      <div className="fw-bold text-dark text-truncate" title={unvan}>{unvan}</div>
                    </div>
                    <div className="col-6 col-md-2">
                      <div className="text-muted" style={{ fontSize: "10px" }}>Cari / Kaynak:</div>
                      <div className="font-monospace fw-semibold text-primary text-truncate">{kod}</div>
                    </div>
                    <div className="col-6 col-md-2">
                      <div className="text-muted" style={{ fontSize: "10px" }}>VKN / TCKN:</div>
                      <div className="font-monospace fw-semibold text-dark text-truncate">{vkn}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="text-muted" style={{ fontSize: "10px" }}>e-Fatura Posta Kutusu:</div>
                      <div className="font-monospace text-success text-truncate" title={pkAlias}>{pkAlias}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="text-muted" style={{ fontSize: "10px" }}>Vergi Dairesi:</div>
                      <div className="text-dark text-truncate" title={vd !== "-" ? vd : adresStr}>{vd !== "-" ? vd : adresStr}</div>
                    </div>
                    <div className="col-6 col-md-3">
                      <div className="text-muted" style={{ fontSize: "10px" }}>Telefon:</div>
                      <div className="text-dark text-truncate">{tel}</div>
                    </div>
                    <div className="col-6 col-md-6">
                      <div className="text-muted" style={{ fontSize: "10px" }}>E-Posta / Alias:</div>
                      <div className="text-dark text-truncate" title={email !== "-" ? email : yetkili}>
                        {email !== "-" ? email : (yetkili !== "-" ? `Yetkili: ${yetkili}` : "-")}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Alt Çubuk */}
          <div className="d-flex align-items-center justify-content-between px-3 py-2 bg-light border-top" style={{ fontSize: "12.5px" }}>
            <div className="text-muted">
              Toplam: <strong>{currentList.length}</strong> kayıt
              {gibResults.length > 0 && <span className="text-success ms-2">({gibResults.length} e-Fatura dahil)</span>}
            </div>
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="success" size="sm"
                onClick={() => setShowNewCariModal(true)}
                className="px-3 py-1 d-flex align-items-center gap-1 fw-bold text-white"
                style={{ fontSize: "12px", height: "30px", backgroundColor: "#16a34a", borderColor: "#15803d" }}
              >
                <IconPlus size={15} />
                <span>Yeni Kayıt</span>
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={onClose} className="px-3 py-1" style={{ fontSize: "12px", height: "30px" }}>
                Vazgeç (ESC)
              </Button>
              <Button
                variant="primary" size="sm"
                onClick={handleConfirm}
                disabled={selectedIndex === null || !currentList[selectedIndex]}
                className="px-3 py-1 d-flex align-items-center gap-1"
                style={{ fontSize: "12px", height: "30px", backgroundColor: "#0284c7", borderColor: "#0284c7" }}
              >
                <IconCornerDownLeft size={14} />
                <span>Seç ve Forma Aktar (Enter)</span>
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {showNewCariModal && (
        <CariCardRegistrationPage
          isModal={true}
          onCancel={() => setShowNewCariModal(false)}
          onSuccess={async (newCari) => {
            setShowNewCariModal(false);
            if (newCari) {
              const updatedCariler = await CariService.getCariKartlar().catch(() => internalCariler);
              setInternalCariler(updatedCariler);
              onSelectCustomer({
                type: "registered",
                id: newCari.id,
                kod: newCari.kod,
                unvan: newCari.ad || (newCari as any).unvan || "",
                vergiKimlikNo: newCari.vergiKimlikNo || "",
                adres: newCari.adres || "",
                telefon: newCari.telefon || "",
                eposta: newCari.eposta || "",
                eFaturaPostaKutusu: (newCari as any).eFaturaPostaKutusu || "",
                vergiDairesi: (newCari as any).vergiDairesi || "",
                il: (newCari as any).il || "",
                ilce: (newCari as any).ilce || "",
                raw: newCari,
              });
              onClose();
            }
          }}
        />
      )}
    </>
  );
};

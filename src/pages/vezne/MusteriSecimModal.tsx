import React, { useState, useEffect, useRef, useMemo } from "react";
import { Modal, Table, Button, Form, InputGroup, Badge, Nav, Spinner } from "react-bootstrap";
import { IconUser, IconX, IconSearch, IconCheck, IconCornerDownLeft, IconUserOff, IconUsers } from "@tabler/icons-react";
import { CariKartItem, CariService } from "../../services/cariService";
import { DovizFisService, KayitsizMusteriItem } from "../../services/dovizFisService";

export type CustomerSelectionType = "registered" | "unregistered" | "anonymous";

export interface SelectedCustomerResult {
  type: CustomerSelectionType;
  id: number | null;
  kod?: string;
  unvan: string;
  vergiKimlikNo?: string;
  adres?: string;
  telefon?: string;
  raw?: CariKartItem | KayitsizMusteriItem;
}

interface MusteriSecimModalProps {
  show: boolean;
  onClose: () => void;
  cariler: CariKartItem[];
  kayitsizMusteriler: KayitsizMusteriItem[];
  onSelectCustomer: (result: SelectedCustomerResult) => void;
  currentUnvan?: string;
  initialSearchTerm?: string;
}

export const MusteriSecimModal: React.FC<MusteriSecimModalProps> = ({
  show,
  onClose,
  cariler,
  kayitsizMusteriler,
  onSelectCustomer,
  currentUnvan,
  initialSearchTerm = "",
}) => {
  const [activeTab, setActiveTab] = useState<"registered" | "unregistered">("registered");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [internalCariler, setInternalCariler] = useState<CariKartItem[]>(cariler || []);
  const [internalKayitsizlar, setInternalKayitsizlar] = useState<KayitsizMusteriItem[]>(kayitsizMusteriler || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveCariler = cariler && cariler.length > 0 ? cariler : internalCariler;
  const effectiveKayitsizlar = kayitsizMusteriler && kayitsizMusteriler.length > 0 ? kayitsizMusteriler : internalKayitsizlar;

  // Prop güncellemelerini iç state'e aktar
  useEffect(() => {
    if (cariler && cariler.length > 0) {
      setInternalCariler(cariler);
    }
  }, [cariler]);

  useEffect(() => {
    if (kayitsizMusteriler && kayitsizMusteriler.length > 0) {
      setInternalKayitsizlar(kayitsizMusteriler);
    }
  }, [kayitsizMusteriler]);

  // Modal açıldığında arama terimini başlat ve verileri kontrol et
  useEffect(() => {
    if (!show) return;

    const term = initialSearchTerm ? initialSearchTerm.trim() : "";
    setSearchTerm(term);
    setSelectedIndex(0);

    const checkAndFetch = async () => {
      const needsCariler = effectiveCariler.length === 0;
      const needsKayitsiz = effectiveKayitsizlar.length === 0;

      if (needsCariler || needsKayitsiz) {
        if (needsCariler && activeTab === "registered") {
          setIsLoading(true);
        }
        try {
          const [fetchedCariler, fetchedKayitsizlar] = await Promise.all([
            needsCariler ? CariService.getCariKartlar().catch(() => [] as CariKartItem[]) : Promise.resolve(effectiveCariler),
            needsKayitsiz ? DovizFisService.getKayitsizMusteriler().catch(() => [] as KayitsizMusteriItem[]) : Promise.resolve(effectiveKayitsizlar),
          ]);

          if (fetchedCariler && fetchedCariler.length > 0) {
            const trimmed = fetchedCariler.map((c) => ({
              ...c,
              kod: (c.kod || "").replace(/\s+/g, " ").trim(),
              ad: (c.ad || "").replace(/\s+/g, " ").trim(),
              telefon: (c.telefon || "").trim(),
            }));
            setInternalCariler(trimmed);
          }
          if (fetchedKayitsizlar && fetchedKayitsizlar.length > 0) {
            setInternalKayitsizlar(fetchedKayitsizlar);
          }
        } finally {
          setIsLoading(false);
        }
      }
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          if (term) {
            searchInputRef.current.select();
          }
        }
      }, 60);
    };

    checkAndFetch();
  }, [show, initialSearchTerm]);

  // Tab değiştiğinde seçimi koru ama satır seçimini sıfırla
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeTab]);

  // Filtrelenmiş liste
  const currentList = useMemo(() => {
    const list = activeTab === "registered" ? effectiveCariler : effectiveKayitsizlar;
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();

    return list.filter((item) => {
      const kod = (item as any).kod ? String((item as any).kod).toLowerCase() : "";
      const ad = item.ad ? item.ad.toLowerCase() : "";
      const unvan = (item as any).unvan ? String((item as any).unvan).toLowerCase() : "";
      const vkn = item.vergiKimlikNo ? item.vergiKimlikNo.toLowerCase() : "";
      const tel = item.telefon ? item.telefon.toLowerCase() : "";

      return kod.includes(term) || ad.includes(term) || unvan.includes(term) || vkn.includes(term) || tel.includes(term);
    });
  }, [activeTab, effectiveCariler, effectiveKayitsizlar, searchTerm]);

  // Seçili satırı görünümde tut
  useEffect(() => {
    if (show && selectedIndex !== null && rowRefs.current[selectedIndex]) {
      rowRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "auto",
      });
    }
  }, [selectedIndex, show]);

  // Seçim işlemi
  const handleSelectRow = (item: CariKartItem | KayitsizMusteriItem) => {
    if (activeTab === "registered") {
      const c = item as CariKartItem;
      onSelectCustomer({
        type: "registered",
        id: c.id,
        kod: c.kod,
        unvan: c.ad || (c as any).unvan || "",
        vergiKimlikNo: c.vergiKimlikNo || "",
        adres: c.adres || "",
        telefon: c.telefon || "",
        raw: c,
      });
    } else {
      const k = item as KayitsizMusteriItem;
      onSelectCustomer({
        type: "unregistered",
        id: null,
        kod: "",
        unvan: k.ad || k.unvan || "",
        vergiKimlikNo: k.vergiKimlikNo || "",
        adres: k.adres || "",
        telefon: k.telefon || "",
        raw: k,
      });
    }
    onClose();
  };

  // İsim beyan edilmemiştir seç
  const handleSelectIsimBeyanEdilmemistir = () => {
    onSelectCustomer({
      type: "anonymous",
      id: null,
      kod: "",
      unvan: "İSİM BEYAN EDİLMEMİŞTİR",
      vergiKimlikNo: "",
      adres: "",
      telefon: "",
    });
    onClose();
  };

  const handleConfirm = () => {
    if (selectedIndex !== null && currentList[selectedIndex]) {
      handleSelectRow(currentList[selectedIndex]);
    } else if (currentList.length > 0) {
      handleSelectRow(currentList[0]);
    }
  };

  // Klavye navigasyonu (Yukarı/Aşağı Ok, Enter, Escape)
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => {
          if (prev === null) return 0;
          return prev < currentList.length - 1 ? prev + 1 : prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => {
          if (prev === null) return 0;
          return prev > 0 ? prev - 1 : 0;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, selectedIndex, currentList, onClose]);

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      dialogClassName="modal-musteri-secim-dialog"
      contentClassName="p-0 border-0 shadow-2xl rounded-2 overflow-hidden"
    >
      <style>{`
        .musteri-selected-row,
        .musteri-selected-row > td,
        .musteri-selected-row > th {
          background-color: #bae6fd !important;
          --bs-table-bg: #bae6fd !important;
          --bs-table-accent-bg: #bae6fd !important;
          box-shadow: inset 0 0 0 9999px #bae6fd !important;
          color: #0369a1 !important;
        }
        .musteri-selected-row:hover,
        .musteri-selected-row:hover > td,
        .musteri-selected-row:hover > th {
          background-color: #7dd3fc !important;
          --bs-table-bg: #7dd3fc !important;
          --bs-table-accent-bg: #7dd3fc !important;
          box-shadow: inset 0 0 0 9999px #7dd3fc !important;
        }
        .musteri-row {
          cursor: pointer;
        }
      `}</style>

      <div
        className="d-flex flex-column"
        style={{
          border: "1px solid #475569",
          borderRadius: "4px",
          backgroundColor: "#ffffff",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
          width: "100%",
          maxWidth: "840px",
          margin: "0 auto",
        }}
      >
        {/* Başlık Çubuğu */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2"
          style={{
            backgroundColor: "#e2e8f0",
            borderBottom: "1px solid #94a3b8",
            cursor: "default",
          }}
        >
          <div className="d-flex align-items-center gap-2">
            <div
              className="d-flex align-items-center justify-content-center rounded-circle"
              style={{
                width: "22px",
                height: "22px",
                backgroundColor: "#0284c7",
                color: "#fff",
              }}
            >
              <IconUsers size={14} />
            </div>
            <span className="fw-bold text-dark" style={{ fontSize: "14px" }}>
              Cari / Müşteri Seçimi
            </span>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Hızlı İsim Beyan Edilmemiştir Seçimi */}
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleSelectIsimBeyanEdilmemistir}
              className="d-flex align-items-center gap-1 py-0 px-2 fw-semibold"
              style={{
                fontSize: "11.5px",
                height: "24px",
                backgroundColor: "#f0f9ff",
                borderColor: "#0284c7",
                color: "#0284c7",
              }}
              title="Fişe doğrudan 'İSİM BEYAN EDİLMEMİŞTİR' atar"
            >
              <IconUserOff size={13} />
              <span>İSİM BEYAN EDİLMEMİŞTİR</span>
            </Button>

            {/* Kapatma Butonu (✕) */}
            <button
              type="button"
              className="btn btn-sm p-0 d-flex align-items-center justify-content-center border"
              style={{
                width: "24px",
                height: "22px",
                backgroundColor: "#f8fafc",
                borderColor: "#cbd5e1",
                borderRadius: "3px",
              }}
              onClick={onClose}
              title="Kapat (ESC)"
            >
              <IconX size={14} className="text-dark" />
            </button>
          </div>
        </div>

        {/* Sekmeler: Kayıtlı Cariler / Kayıtsız Müşteriler */}
        <div className="px-3 pt-2 pb-0 bg-light border-bottom">
          <Nav variant="tabs" className="border-bottom-0" style={{ fontSize: "12.5px" }}>
            <Nav.Item>
              <Nav.Link
                active={activeTab === "registered"}
                onClick={() => setActiveTab("registered")}
                className="py-1 px-3 fw-semibold cursor-pointer"
                style={{
                  color: activeTab === "registered" ? "#0284c7" : "#64748b",
                  backgroundColor: activeTab === "registered" ? "#ffffff" : "transparent",
                  borderBottomColor: activeTab === "registered" ? "#ffffff" : undefined,
                }}
              >
                Kayıtlı Cariler ({effectiveCariler.length})
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link
                active={activeTab === "unregistered"}
                onClick={() => setActiveTab("unregistered")}
                className="py-1 px-3 fw-semibold cursor-pointer"
                style={{
                  color: activeTab === "unregistered" ? "#0284c7" : "#64748b",
                  backgroundColor: activeTab === "unregistered" ? "#ffffff" : "transparent",
                  borderBottomColor: activeTab === "unregistered" ? "#ffffff" : undefined,
                }}
              >
                Kayıtsız Müşteriler ({effectiveKayitsizlar.length})
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </div>

        {/* Hızlı Arama Inputu */}
        <div className="px-3 pt-2 pb-2 bg-white border-bottom">
          <InputGroup size="sm">
            <InputGroup.Text className="bg-white border-end-0">
              <IconSearch size={14} className="text-secondary" />
            </InputGroup.Text>
            <Form.Control
              ref={searchInputRef}
              placeholder={
                activeTab === "registered"
                  ? "Cari kodu, ünvanı veya VKN/TCKN ile filtrele..."
                  : "Müşteri adı/ünvanı veya VKN/TCKN ile filtrele..."
              }
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setSelectedIndex(0);
              }}
              className="border-start-0 shadow-none"
              style={{ fontSize: "13px" }}
            />
            {searchTerm && (
              <Button
                variant="outline-secondary"
                className="border-start-0 bg-white"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedIndex(0);
                  searchInputRef.current?.focus();
                }}
              >
                <IconX size={13} />
              </Button>
            )}
          </InputGroup>
        </div>

        {/* İpucu Şeridi */}
        <div className="d-flex align-items-center justify-content-between px-3 py-1.5 bg-light text-muted small border-bottom">
          <span>
            💡 <strong>İpucu:</strong> Satıra tek tıklayarak seçebilir, çift tıklayarak veya <strong>Enter</strong> ile fişe aktarabilirsiniz.
          </span>
          {selectedIndex !== null && currentList[selectedIndex] && (
            <Badge
              bg="primary"
              className="py-1 px-2 d-flex align-items-center gap-1"
              style={{ backgroundColor: "#0284c7" }}
            >
              <IconCheck size={12} />
              {(currentList[selectedIndex] as any).kod || currentList[selectedIndex].ad || "Seçildi"}
            </Badge>
          )}
        </div>

        {/* Tablo Listesi */}
        <div
          style={{
            maxHeight: "360px",
            minHeight: "220px",
            overflowY: "auto",
            backgroundColor: "#f8fafc",
          }}
        >
          {isLoading && currentList.length === 0 ? (
            <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
              <Spinner animation="border" size="sm" className="mb-2 text-primary" />
              <span style={{ fontSize: "13px" }}>Müşteri ve cari kayıtları yükleniyor...</span>
            </div>
          ) : currentList.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <p className="mb-1 fw-semibold" style={{ fontSize: "13.5px" }}>
                Kayıt bulunamadı
              </p>
              <p className="small mb-0" style={{ fontSize: "12px" }}>
                {searchTerm
                  ? `"${searchTerm}" aramasına uygun kayıt bulunamadı.`
                  : activeTab === "unregistered"
                  ? "Kayıtsız müşteri kaydı bulunmuyor. Ünvan alanına doğrudan serbest metin yazabilirsiniz."
                  : "Tanımlı cari kaydı bulunmuyor."}
              </p>
            </div>
          ) : (
            <Table bordered hover size="sm" className="mb-0 bg-white" style={{ fontSize: "12.5px" }}>
              <thead
                className="sticky-top"
                style={{
                  backgroundColor: "#f1f5f9",
                  color: "#334155",
                  borderBottom: "2px solid #cbd5e1",
                  zIndex: 2,
                }}
              >
                <tr>
                  <th style={{ width: "130px", textAlign: "left" }} className="px-3 py-2">
                    {activeTab === "registered" ? "Cari Kodu" : "Müşteri No"}
                  </th>
                  <th style={{ textAlign: "left" }} className="px-3 py-2">
                    Ünvan / Ad
                  </th>
                  <th style={{ width: "150px", textAlign: "left" }} className="px-3 py-2">
                    VKN / TCKN
                  </th>
                  <th style={{ width: "130px", textAlign: "left" }} className="px-3 py-2">
                    Telefon
                  </th>
                  <th style={{ width: "70px", textAlign: "center" }} className="px-2 py-2">
                    Seçim
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentList.map((item, idx) => {
                  const isSelected = selectedIndex === idx;
                  const kod = (item as any).kod || `#${item.id}`;
                  const ad = item.ad || (item as any).unvan || "-";
                  const vkn = item.vergiKimlikNo || "-";
                  const tel = item.telefon || "-";

                  return (
                    <tr
                      key={item.id || idx}
                      ref={(el) => {
                        rowRefs.current[idx] = el;
                      }}
                      className={`musteri-row ${isSelected ? "musteri-selected-row" : ""}`}
                      onClick={() => setSelectedIndex(idx)}
                      onDoubleClick={() => handleSelectRow(item)}
                    >
                      <td className="px-3 py-2 font-monospace fw-bold text-start align-middle">
                        {kod}
                      </td>
                      <td className="px-3 py-2 text-start align-middle fw-medium">
                        {ad}
                      </td>
                      <td className="px-3 py-2 font-monospace text-start align-middle">
                        {vkn}
                      </td>
                      <td className="px-3 py-2 text-start align-middle text-muted">
                        {tel}
                      </td>
                      <td className="text-center align-middle px-2 py-1">
                        <Button
                          size="sm"
                          variant={isSelected ? "primary" : "outline-secondary"}
                          className={`py-0 px-2 fs-7 ${isSelected ? "fw-bold shadow-sm" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectRow(item);
                          }}
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

        {/* Alt Bilgi ve Aksiyon Çubuğu */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-2 bg-light border-top"
          style={{ fontSize: "12.5px" }}
        >
          <div className="text-muted">
            Toplam: <strong>{currentList.length}</strong> kayıt
          </div>

          <div className="d-flex align-items-center gap-2">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={onClose}
              className="px-3 py-1"
              style={{ fontSize: "12px", height: "30px" }}
            >
              Vazgeç (ESC)
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirm}
              disabled={selectedIndex === null || !currentList[selectedIndex]}
              className="px-3 py-1 d-flex align-items-center gap-1"
              style={{
                fontSize: "12px",
                height: "30px",
                backgroundColor: "#0284c7",
                borderColor: "#0284c7",
              }}
            >
              <IconCornerDownLeft size={14} />
              <span>Seç (Enter)</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

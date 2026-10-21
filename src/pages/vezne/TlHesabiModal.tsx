import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal, Form, Button, InputGroup } from "react-bootstrap";
import { IconCalculator, IconX, IconCheck, IconBinoculars } from "@tabler/icons-react";
import { ParaItem } from "./DovizFisiPage";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import { parseDecimal, formatMiktar, parseKur } from "../../utils/numericInput";

interface TlHesabiModalProps {
  show: boolean;
  onClose: () => void;
  paralar: ParaItem[];
  tip: number; // 0: Alış, 1: Satış
  kurTuru: number; // 0: Efektif, 1: Döviz
  resolveCurrencyRate: (para: ParaItem, currentTip: number, currentKurTuru: number) => number;
  onApply: (data: {
    para: ParaItem;
    miktar: number;
    kur: number;
    tutar: number;
  }) => void;
  kurKurusSayisi?: number;
  dovizKurusSayisi?: number;
  tlKurusSayisi?: number;
  initialParaKod?: string;
  initialKur?: string | number;
}

export const TlHesabiModal: React.FC<TlHesabiModalProps> = ({
  show,
  onClose,
  paralar,
  tip,
  kurTuru,
  resolveCurrencyRate,
  onApply,
  kurKurusSayisi = 6,
  dovizKurusSayisi = 2,
  tlKurusSayisi = 2,
  initialParaKod,
  initialKur,
}) => {
  const [tlMiktariStr, setTlMiktariStr] = useState<string>("0");
  const [selectedParaKod, setSelectedParaKod] = useState<string>("USD");
  const [kurStr, setKurStr] = useState<string>("1.000000");
  const [showParaLookup, setShowParaLookup] = useState<boolean>(false);

  const tlInputRef = useRef<HTMLInputElement | null>(null);
  const dovizKodInputRef = useRef<HTMLInputElement | null>(null);
  const kurInputRef = useRef<HTMLInputElement | null>(null);
  const tamamBtnRef = useRef<HTMLButtonElement | null>(null);

  // Modal açıldığında varsayılan para ve kur hazırla, TL miktarı inputuna odaklan
  useEffect(() => {
    if (show) {
      setTlMiktariStr("0");
      const rowPara = (initialParaKod && initialParaKod.trim())
        ? paralar.find((p) => p.kod.toUpperCase() === initialParaKod.trim().toUpperCase())
        : null;

      const initialPara =
        rowPara ||
        paralar.find((p) => p.kod.toUpperCase() === "USD") ||
        paralar.find((p) => p.kod.toUpperCase() !== "TL" && p.kod.toUpperCase() !== "TRY") ||
        paralar[0];

      if (initialPara) {
        setSelectedParaKod(initialPara.kod);
        let rate = 0;
        const kurInputVal = initialKur !== undefined && initialKur !== null ? String(initialKur) : "";
        if (rowPara && kurInputVal && parseKur(kurInputVal) > 0) {
          rate = parseKur(kurInputVal);
        } else {
          rate = resolveCurrencyRate(initialPara, tip, kurTuru);
        }
        setKurStr(rate > 0 ? rate.toFixed(kurKurusSayisi) : "1.000000");
      }

      setTimeout(() => {
        if (tlInputRef.current) {
          tlInputRef.current.focus();
          tlInputRef.current.select();
        }
      }, 100);
    }
  }, [show, paralar, tip, kurTuru, resolveCurrencyRate, kurKurusSayisi, initialParaKod, initialKur]);

  const selectedPara = paralar.find(
    (p) => p.kod.toUpperCase() === selectedParaKod.toUpperCase().trim()
  );

  // Para cinsi değiştiğinde kuru güncelle
  const handleParaSelect = (para: ParaItem) => {
    setSelectedParaKod(para.kod);
    const rate = resolveCurrencyRate(para, tip, kurTuru);
    setKurStr(rate > 0 ? rate.toFixed(kurKurusSayisi) : "1.000000");
    setShowParaLookup(false);
    setTimeout(() => {
      kurInputRef.current?.focus();
      kurInputRef.current?.select();
    }, 100);
  };

  const tlMiktariNum = parseDecimal(tlMiktariStr);
  const kurNum = parseKur(kurStr);

  // Formül: Miktar = TL Miktarı / Kur
  const miktarNum = kurNum > 0 ? tlMiktariNum / kurNum : 0;
  const miktarStr =
    miktarNum > 0
      ? miktarNum.toLocaleString("tr-TR", {
          minimumFractionDigits: dovizKurusSayisi,
          maximumFractionDigits: dovizKurusSayisi,
        })
      : "0";

  const handleTamam = useCallback(() => {
    if (!selectedPara) return;
    if (tlMiktariNum <= 0 || kurNum <= 0 || miktarNum <= 0) return;

    onApply({
      para: selectedPara,
      miktar: Math.round(miktarNum * Math.pow(10, dovizKurusSayisi)) / Math.pow(10, dovizKurusSayisi),
      kur: kurNum,
      tutar: tlMiktariNum,
    });
    onClose();
  }, [selectedPara, tlMiktariNum, kurNum, miktarNum, onApply, dovizKurusSayisi, onClose]);

  // ESC ve F1 dinleyicisi (Modal genelinde)
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showParaLookup) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "F1") {
        e.preventDefault();
        e.stopPropagation();
        handleTamam();
      } else if (/^F([2-9]|1[0-2])$/.test(e.key)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, showParaLookup, handleTamam, onClose]);

  const paraLookupColumns: LookupColumn<ParaItem>[] = [
    { header: "Kod", width: "90px", render: (p) => p.kod },
    { header: "Ad", render: (p) => p.ad },
    {
      header: "Kur",
      align: "right",
      width: "110px",
      render: (p) => resolveCurrencyRate(p, tip, kurTuru).toFixed(kurKurusSayisi),
    },
  ];

  return (
    <>
      <Modal
        show={show}
        onHide={onClose}
        centered
        backdrop="static"
        dialogClassName="modal-tl-hesabi-dialog"
        contentClassName="p-0 border-0 shadow-2xl rounded-2 overflow-hidden"
      >
        <div
          className="d-flex flex-column"
          style={{
            border: "1px solid #475569",
            borderRadius: "4px",
            backgroundColor: "#f8fafc",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
            width: "100%",
            maxWidth: "480px",
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
              userSelect: "none",
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <div
                className="d-flex align-items-center justify-content-center rounded-circle"
                style={{ width: "22px", height: "22px", backgroundColor: "#10b981", color: "#fff" }}
              >
                <IconCalculator size={14} />
              </div>
              <span className="fw-bold text-dark" style={{ fontSize: "13.5px" }}>
                TL Hesabı
              </span>
            </div>
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

          {/* Modal Form Gövdesi */}
          <div className="p-4" style={{ backgroundColor: "#f1f5f9" }}>
            {/* 1. TL Miktarı */}
            <div className="d-flex align-items-center mb-3">
              <label
                className="fw-semibold text-secondary mb-0"
                style={{ width: "120px", fontSize: "13px" }}
              >
                TL miktarı
              </label>
              <div className="flex-grow-1">
                <Form.Control
                  ref={tlInputRef}
                  type="text"
                  size="sm"
                  className="text-end font-monospace fw-bold"
                  style={{
                    fontSize: "14px",
                    borderColor: "#3b82f6",
                    backgroundColor: "#ffffff",
                    padding: "6px 10px",
                  }}
                  value={tlMiktariStr}
                  onChange={(e) => {
                    const input = e.target;
                    let rawVal = input.value;
                    if (rawVal.length > 1 && rawVal.startsWith("0") && !rawVal.startsWith("0,") && !rawVal.startsWith("0.")) {
                      rawVal = rawVal.replace(/^0+/, "") || "0";
                    }
                    const isAtEnd = (input.selectionStart ?? rawVal.length) >= rawVal.length - 1;
                    const formatted = formatMiktar(rawVal);
                    setTlMiktariStr(formatted);
                    if (isAtEnd) {
                      requestAnimationFrame(() => {
                        input.setSelectionRange(formatted.length, formatted.length);
                      });
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val !== "") {
                      setTlMiktariStr(formatMiktar(val));
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      dovizKodInputRef.current?.focus();
                      dovizKodInputRef.current?.select();
                    }
                  }}
                />
              </div>
            </div>

            {/* 2. Döviz Kodu */}
            <div className="d-flex align-items-center mb-3">
              <label
                className="fw-semibold text-secondary mb-0"
                style={{ width: "120px", fontSize: "13px" }}
              >
                Döviz kodu
              </label>
              <div className="flex-grow-1">
                <InputGroup size="sm">
                  <Form.Control
                    ref={dovizKodInputRef}
                    type="text"
                    className="font-monospace fw-bold text-uppercase"
                    style={{ fontSize: "13.5px", padding: "6px 10px" }}
                    value={selectedParaKod}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setSelectedParaKod(val);
                      const matched = paralar.find((p) => p.kod.toUpperCase() === val.trim());
                      if (matched) {
                        const rate = resolveCurrencyRate(matched, tip, kurTuru);
                        if (rate > 0) setKurStr(rate.toFixed(kurKurusSayisi));
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        kurInputRef.current?.focus();
                        kurInputRef.current?.select();
                      } else if (e.key === "F4") {
                        e.preventDefault();
                        setShowParaLookup(true);
                      }
                    }}
                  />
                  <Button
                    variant="outline-secondary"
                    className="px-2.5"
                    onClick={() => setShowParaLookup(true)}
                    title="Para Seç (Dürbün - F4)"
                  >
                    <IconBinoculars size={14} />
                  </Button>
                </InputGroup>
              </div>
            </div>

            {/* 3. Kur */}
            <div className="d-flex align-items-center mb-3">
              <label
                className="fw-semibold text-secondary mb-0"
                style={{ width: "120px", fontSize: "13px" }}
              >
                Kur
              </label>
              <div className="flex-grow-1">
                <Form.Control
                  ref={kurInputRef}
                  type="text"
                  size="sm"
                  className="text-end font-monospace fw-semibold"
                  style={{ fontSize: "13.5px", padding: "6px 10px" }}
                  value={kurStr}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9.,]/g, "");
                    const parts = val.split(/[.,]/);
                    if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");
                    setKurStr(val);
                  }}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      tamamBtnRef.current?.focus();
                    }
                  }}
                />
              </div>
            </div>

            {/* 4. Miktar */}
            <div className="d-flex align-items-center mb-4">
              <label
                className="fw-semibold text-secondary mb-0"
                style={{ width: "120px", fontSize: "13px" }}
              >
                Miktar
              </label>
              <div className="flex-grow-1">
                <Form.Control
                  type="text"
                  size="sm"
                  readOnly
                  className="text-end font-monospace fw-bold bg-white"
                  style={{ fontSize: "13.5px", color: "#0f172a", borderColor: "#cbd5e1", padding: "6px 10px" }}
                  value={miktarStr}
                />
              </div>
            </div>

            {/* Tamam Butonu */}
            <div className="d-flex justify-content-center pt-3 border-top">
              <Button
                ref={tamamBtnRef}
                variant="light"
                className="d-flex align-items-center justify-content-center gap-2 px-4 py-2 border shadow-xs fw-semibold"
                style={{
                  minWidth: "140px",
                  borderColor: "#94a3b8",
                  backgroundColor: "#ffffff",
                  fontSize: "13px",
                }}
                onClick={handleTamam}
                disabled={!selectedPara || tlMiktariNum <= 0 || kurNum <= 0}
              >
                <IconCheck size={18} className="text-success stroke-2" />
                <span>Tamam (F1)</span>
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Para Seçim Modalı (Dürbün) */}
      <LookupModal<ParaItem>
        show={showParaLookup}
        onHide={() => setShowParaLookup(false)}
        title="Para Seçimi"
        items={paralar}
        columns={paraLookupColumns}
        filterFn={(p, term) =>
          p.kod.toLowerCase().includes(term.toLowerCase()) ||
          p.ad.toLowerCase().includes(term.toLowerCase())
        }
        searchPlaceholder="Para kodu veya adı ile ara..."
        onSelect={handleParaSelect}
      />
    </>
  );
};

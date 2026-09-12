import React, { useState, useEffect, useRef, useCallback } from "react";
import { Modal, Table } from "react-bootstrap";
import { IconCash, IconX, IconCheck } from "@tabler/icons-react";
import BanknotService from "../../services/banknotService";

export interface ParaSaymaCurrencyItem {
  paraId?: number;
  kod: string;
  ad: string;
  sayilacak: number;
}

export interface ParaSaymaModalProps {
  show: boolean;
  onClose: () => void;
  currencies: ParaSaymaCurrencyItem[];
  counts: Record<string, Record<number, number>>; // { [kod]: { [kupur]: adet } }
  onCountsChange: (newCounts: Record<string, Record<number, number>>) => void;
  tlKurusSayisi?: number;
  dovizKurusSayisi?: number;
}

// Varsayılan kupür listeleri (veritabanında tanımlı banknot yoksa fallback)
const DEFAULT_KUPURLER: Record<string, number[]> = {
  USD: [100, 50, 20, 10, 5, 2, 1],
  EUR: [500, 200, 100, 50, 20, 10, 5],
  TRY: [200, 100, 50, 20, 10, 5],
  TL: [200, 100, 50, 20, 10, 5],
  GBP: [50, 20, 10, 5],
  CHF: [1000, 200, 100, 50, 20, 10],
  CAD: [100, 50, 20, 10, 5],
  AUD: [100, 50, 20, 10, 5],
};

export const ParaSaymaModal: React.FC<ParaSaymaModalProps> = ({
  show,
  onClose,
  currencies,
  counts,
  onCountsChange,
  tlKurusSayisi = 2,
  dovizKurusSayisi = 2,
}) => {
  const [selectedCurrencyIndex, setSelectedCurrencyIndex] = useState<number>(0);
  const [dbKupurMap, setDbKupurMap] = useState<Record<string, number[]>>({});
  const adetInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Modal açıldığında ilk geçerli para birimini seç ve ilk inputa odaklan
  useEffect(() => {
    if (show) {
      setSelectedCurrencyIndex(0);
      setTimeout(() => {
        adetInputRefs.current[0]?.focus();
        adetInputRefs.current[0]?.select();
      }, 100);
    }
  }, [show]);

  // Seçili para değiştikçe ilk inputa odaklan
  useEffect(() => {
    if (show) {
      setTimeout(() => {
        adetInputRefs.current[0]?.focus();
        adetInputRefs.current[0]?.select();
      }, 50);
    }
  }, [selectedCurrencyIndex, show]);

  // Fişteki para birimleri için TODVZ_BANKNOT tablosundan kupürleri yükle
  useEffect(() => {
    if (!show) return;

    currencies.forEach(async (curr) => {
      const kodUpper = curr.kod.toUpperCase().trim();
      if (curr.paraId && !dbKupurMap[kodUpper]) {
        try {
          const list = await BanknotService.getBanknotlar(curr.paraId);
          if (list && list.length > 0) {
            // Kupürleri büyükten küçüğe sırala
            const sortedKupurler = list.map((b) => b.miktar).sort((a, b) => b - a);
            setDbKupurMap((prev) => ({
              ...prev,
              [kodUpper]: sortedKupurler,
            }));
          }
        } catch {
          // Servis hatasında varsayılanlar kullanılacak
        }
      }
    });
  }, [show, currencies, dbKupurMap]);

  // ESC tuşu dinleyicisi
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, onClose]);

  // Seçili para birimi
  const activeCurrency = currencies[selectedCurrencyIndex] || currencies[0];
  const activeKodUpper = activeCurrency ? activeCurrency.kod.toUpperCase().trim() : "";

  // Kupür listesini belirle (Önce DB, sonra DEFAULT, fallback [100, 50, 20, 10, 5, 1])
  const getKupurler = useCallback(
    (kodUpper: string): number[] => {
      if (dbKupurMap[kodUpper] && dbKupurMap[kodUpper].length > 0) {
        return dbKupurMap[kodUpper];
      }
      if (DEFAULT_KUPURLER[kodUpper]) {
        return DEFAULT_KUPURLER[kodUpper];
      }
      return [100, 50, 20, 10, 5, 1];
    },
    [dbKupurMap]
  );

  const activeKupurler = getKupurler(activeKodUpper);

  // Belirli bir para için toplam sayılan tutarı hesapla
  const getSayilanTutar = (kod: string): number => {
    const kodUpper = kod.toUpperCase().trim();
    const currCounts = counts[kodUpper] || {};
    let total = 0;
    Object.entries(currCounts).forEach(([kupurStr, adet]) => {
      const kupur = Number(kupurStr);
      if (kupur > 0 && adet > 0) {
        total += kupur * adet;
      }
    });
    return total;
  };

  // Kupür adedi değiştiğinde güncelle
  const handleAdetChange = (kupur: number, valueStr: string) => {
    if (!activeKodUpper) return;

    // Sadece pozitif tamsayı kabul et
    const cleaned = valueStr.replace(/[^0-9]/g, "");
    const adet = cleaned === "" ? 0 : parseInt(cleaned, 10);

    const prevCurrCounts = counts[activeKodUpper] || {};
    const newCurrCounts = {
      ...prevCurrCounts,
      [kupur]: adet,
    };

    onCountsChange({
      ...counts,
      [activeKodUpper]: newCurrCounts,
    });
  };

  // Adet inputunda klavye navigasyonu (Enter / Ok tuşları)
  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    kIndex: number
  ) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (kIndex < activeKupurler.length - 1) {
        adetInputRefs.current[kIndex + 1]?.focus();
        adetInputRefs.current[kIndex + 1]?.select();
      } else {
        // Son kupürdeyse: sol tabloda bir sonraki para varsa ona geç, yoksa ilk kupüre dön
        if (selectedCurrencyIndex < currencies.length - 1) {
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

  // Formatlayıcı
  const formatMoney = (val: number, isTL: boolean) => {
    const decimals = isTL ? tlKurusSayisi : dovizKurusSayisi;
    return val.toLocaleString("tr-TR", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      dialogClassName="modal-para-sayma-dialog"
      contentClassName="p-0 border-0 shadow-2xl rounded-2 overflow-hidden"
    >
      {/* Scoped CSS - Masaüstü ERP stili ve açık mavi seçim */}
      <style>{`
        .para-sayma-selected-row,
        .para-sayma-selected-row > td,
        .para-sayma-selected-row > th {
          background-color: #bae6fd !important;
          --bs-table-bg: #bae6fd !important;
          --bs-table-accent-bg: #bae6fd !important;
          box-shadow: inset 0 0 0 9999px #bae6fd !important;
          color: #0369a1 !important;
        }
        .para-sayma-selected-row:hover,
        .para-sayma-selected-row:hover > td,
        .para-sayma-selected-row:hover > th {
          background-color: #7dd3fc !important;
          --bs-table-bg: #7dd3fc !important;
          --bs-table-accent-bg: #7dd3fc !important;
          box-shadow: inset 0 0 0 9999px #7dd3fc !important;
        }
        .adet-input:focus {
          outline: 1.5px dashed #0284c7 !important;
          background-color: #ffffff !important;
        }
      `}</style>

      <div
        className="d-flex flex-column"
        style={{
          border: "1px solid #475569",
          borderRadius: "4px",
          backgroundColor: "#f1f5f9",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.45)",
          width: "100%",
          maxWidth: "760px",
          margin: "0 auto",
        }}
      >
        {/* Başlık Çubuğu */}
        <div
          className="d-flex align-items-center justify-content-between px-3 py-1.5"
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
              style={{ width: "20px", height: "20px", backgroundColor: "#0284c7", color: "#fff" }}
            >
              <IconCash size={13} />
            </div>
            <span className="fw-bold text-dark" style={{ fontSize: "13.5px" }}>
              Para sayma
            </span>
          </div>

          {/* Sadece Kapatma Butonu (✕) */}
          <button
            type="button"
            className="btn btn-sm p-0 d-flex align-items-center justify-content-center border"
            style={{
              width: "22px",
              height: "20px",
              backgroundColor: "#f8fafc",
              borderColor: "#cbd5e1",
              borderRadius: "3px",
            }}
            onClick={onClose}
            title="Kapat (ESC)"
          >
            <IconX size={13} className="text-dark" />
          </button>
        </div>

        {/* Gövde Alanı (İki Blok Yan Yana) */}
        <div className="p-2.5 d-flex gap-2.5" style={{ minHeight: "330px", backgroundColor: "#f8fafc" }}>
          {/* ================= SOL PANEL: FİŞ TABLOSU ================= */}
          <div
            className="d-flex flex-column flex-grow-1 border rounded bg-white shadow-xs overflow-hidden"
            style={{ width: "54%", borderColor: "#cbd5e1" }}
          >
            {/* Sol Panel Başlığı: "Fiş" */}
            <div
              className="text-center py-1 fw-bold text-dark border-bottom"
              style={{
                backgroundColor: "#e2e8f0",
                fontSize: "13px",
                letterSpacing: "0.5px",
              }}
            >
              Fiş
            </div>

            {/* Sol Panel Tablosu */}
            <div className="flex-grow-1 overflow-auto">
              <Table
                bordered
                size="sm"
                className="mb-0 text-nowrap align-middle"
                style={{ fontSize: "12.5px", borderCollapse: "separate", borderSpacing: 0 }}
              >
                <thead className="position-sticky top-0" style={{ zIndex: 2 }}>
                  <tr style={{ backgroundColor: "#cbe2f8", color: "#0f172a" }}>
                    <th
                      style={{
                        padding: "6px 8px",
                        backgroundColor: "#cbe2f8",
                        borderRight: "1px solid #94a3b8",
                        borderBottom: "1px solid #94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      Para
                    </th>
                    <th
                      className="text-end"
                      style={{
                        width: "85px",
                        padding: "6px 8px",
                        backgroundColor: "#cbe2f8",
                        borderRight: "1px solid #94a3b8",
                        borderBottom: "1px solid #94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      Sayılacak
                    </th>
                    <th
                      className="text-end"
                      style={{
                        width: "80px",
                        padding: "6px 8px",
                        backgroundColor: "#cbe2f8",
                        borderRight: "1px solid #94a3b8",
                        borderBottom: "1px solid #94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      Sayılan
                    </th>
                    <th
                      className="text-end"
                      style={{
                        width: "85px",
                        padding: "6px 8px",
                        backgroundColor: "#cbe2f8",
                        borderBottom: "1px solid #94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      Kalan
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((c, idx) => {
                    const isSelected = idx === selectedCurrencyIndex;
                    const isTL = c.kod.toUpperCase() === "TRY" || c.kod.toUpperCase() === "TL";
                    const sayilan = getSayilanTutar(c.kod);
                    const kalan = c.sayilacak - sayilan;
                    const isCompleted = Math.abs(kalan) < 0.0001 && sayilan > 0;
                    const selectedBgColor = "#bae6fd";

                    return (
                      <tr
                        key={c.kod + idx}
                        onClick={() => setSelectedCurrencyIndex(idx)}
                        className={isSelected ? "para-sayma-selected-row fw-semibold" : ""}
                        style={{
                          cursor: "pointer",
                          userSelect: "none",
                          backgroundColor: isSelected ? selectedBgColor : idx % 2 === 1 ? "#f8fafc" : "#ffffff",
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                        }}
                      >
                        {/* Para Adı */}
                        <td
                          className="px-2 py-1.5"
                          style={{
                            borderRight: "1px solid #cbd5e1",
                            borderBottom: "1px solid #cbd5e1",
                            color: isSelected ? "#0369a1" : "#1e293b",
                          }}
                        >
                          <div className="d-flex align-items-center gap-1">
                            {isCompleted && <IconCheck size={13} className="text-success fw-bold" />}
                            <span>{c.ad || c.kod}</span>
                          </div>
                        </td>

                        {/* Sayılacak */}
                        <td
                          className="text-end font-monospace px-2 py-1.5"
                          style={{
                            borderRight: "1px solid #cbd5e1",
                            borderBottom: "1px solid #cbd5e1",
                            color: isSelected ? "#0369a1" : "#334155",
                          }}
                        >
                          {formatMoney(c.sayilacak, isTL)}
                        </td>

                        {/* Sayılan */}
                        <td
                          className="text-end font-monospace px-2 py-1.5"
                          style={{
                            borderRight: "1px solid #cbd5e1",
                            borderBottom: "1px solid #cbd5e1",
                            color: isSelected
                              ? "#0369a1"
                              : sayilan > 0
                              ? "#0284c7"
                              : "#94a3b8",
                            fontWeight: sayilan > 0 ? 600 : 400,
                          }}
                        >
                          {sayilan > 0 ? formatMoney(sayilan, isTL) : ""}
                        </td>

                        {/* Kalan */}
                        <td
                          className="text-end font-monospace px-2 py-1.5 fw-semibold"
                          style={{
                            borderBottom: "1px solid #cbd5e1",
                            color: isSelected
                              ? "#0369a1"
                              : isCompleted
                              ? "#16a34a"
                              : kalan < 0
                              ? "#dc2626"
                              : "#0f172a",
                          }}
                        >
                          {formatMoney(kalan, isTL)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </div>

          {/* ================= SAĞ PANEL: KUPÜR / BANKNOT TABLOSU ================= */}
          <div
            className="d-flex flex-column border rounded bg-white shadow-xs overflow-hidden"
            style={{ width: "46%", borderColor: "#cbd5e1" }}
          >
            {/* Sağ Panel Başlığı: Seçili Paranın Adı */}
            <div
              className="text-center py-1 fw-bold text-dark border-bottom"
              style={{
                backgroundColor: "#e2e8f0",
                fontSize: "13px",
                letterSpacing: "0.5px",
              }}
            >
              {activeCurrency ? activeCurrency.ad || activeCurrency.kod : "BANKNOTLAR"}
            </div>

            {/* Sağ Panel Tablosu */}
            <div className="flex-grow-1 overflow-auto">
              <Table
                bordered
                size="sm"
                className="mb-0 text-nowrap align-middle"
                style={{ fontSize: "12.5px", borderCollapse: "separate", borderSpacing: 0 }}
              >
                <thead className="position-sticky top-0" style={{ zIndex: 2 }}>
                  <tr style={{ backgroundColor: "#cbe2f8", color: "#0f172a" }}>
                    <th
                      className="text-center"
                      style={{
                        width: "70px",
                        padding: "6px 8px",
                        backgroundColor: "#cbe2f8",
                        borderRight: "1px solid #94a3b8",
                        borderBottom: "1px solid #94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      Banknot
                    </th>
                    <th
                      className="text-center"
                      style={{
                        width: "80px",
                        padding: "6px 8px",
                        backgroundColor: "#cbe2f8",
                        borderRight: "1px solid #94a3b8",
                        borderBottom: "1px solid #94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      Adet
                    </th>
                    <th
                      className="text-end"
                      style={{
                        padding: "6px 8px",
                        backgroundColor: "#cbe2f8",
                        borderBottom: "1px solid #94a3b8",
                        fontWeight: 600,
                      }}
                    >
                      Tutar
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activeKupurler.map((kupur, kIdx) => {
                    const currCounts = counts[activeKodUpper] || {};
                    const adet = currCounts[kupur] ?? 0;
                    const tutar = kupur * adet;
                    const isTL = activeKodUpper === "TRY" || activeKodUpper === "TL";

                    return (
                      <tr key={kupur}>
                        {/* Banknot Değeri */}
                        <td
                          className="text-center font-monospace fw-bold px-2 py-1"
                          style={{
                            borderRight: "1px solid #cbd5e1",
                            borderBottom: "1px solid #cbd5e1",
                            backgroundColor: "#ffffff",
                            color: "#1e293b",
                          }}
                        >
                          {kupur}
                        </td>

                        {/* Adet Giriş Kutusu */}
                        <td
                          className="p-0"
                          style={{
                            borderRight: "1px solid #cbd5e1",
                            borderBottom: "1px solid #cbd5e1",
                            backgroundColor: "#ffffff",
                          }}
                        >
                          <input
                            ref={(el) => {
                              adetInputRefs.current[kIdx] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            className="form-control form-control-sm border-0 text-center font-monospace fw-bold p-1 shadow-none adet-input"
                            style={{
                              height: "28px",
                              fontSize: "13px",
                              backgroundColor: "transparent",
                            }}
                            value={adet > 0 ? String(adet) : ""}
                            placeholder=""
                            onChange={(e) => handleAdetChange(kupur, e.target.value)}
                            onKeyDown={(e) => handleInputKeyDown(e, kIdx)}
                            onFocus={(e) => e.target.select()}
                          />
                        </td>

                        {/* Tutar */}
                        <td
                          className="text-end font-monospace fw-semibold px-2 py-1"
                          style={{
                            borderBottom: "1px solid #cbd5e1",
                            backgroundColor: "#ffffff",
                            color: tutar > 0 ? "#0f172a" : "#94a3b8",
                          }}
                        >
                          {tutar > 0 ? formatMoney(tutar, isTL) : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          </div>
        </div>

        {/* Modal Alt Bilgi Çubuğu */}
        <div
          className="d-flex justify-content-between align-items-center px-3 py-1.5 bg-light border-top"
          style={{ fontSize: "12px", color: "#64748b" }}
        >
          <span>
            <b>Enter:</b> Bir alt kupüre geçer &nbsp;|&nbsp; <b>ESC:</b> Kapatır &nbsp;|&nbsp; Adetler hafızada korunur
          </span>
          <span>
            Seçili: <b>{activeCurrency ? activeCurrency.ad || activeCurrency.kod : ""}</b>
          </span>
        </div>
      </div>
    </Modal>
  );
};

export default ParaSaymaModal;

import React, { useEffect } from "react";
import { Modal, Table, Button } from "react-bootstrap";
import { IconBuildingBank, IconX, IconPrinter } from "@tabler/icons-react";
import { VezneBakiyeDetailItem } from "../../services/dovizFisService";
import { triggerSilentPrint } from "../../services/silentPrintService";

interface VezneBakiyeModalProps {
  show: boolean;
  onClose: () => void;
  vezneAd: string;
  vezneKod: string;
  bakiyeler: VezneBakiyeDetailItem[];
  tlKurusSayisi?: number;
}

export const VezneBakiyeModal: React.FC<VezneBakiyeModalProps> = ({
  show,
  onClose,
  vezneAd,
  vezneKod,
  bakiyeler,
  tlKurusSayisi = 2,
}) => {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

  // Modal açıldığında seçimi sıfırla
  useEffect(() => {
    if (show) {
      setSelectedIndex(null);
    }
  }, [show]);
  // ESC tuşu ve F10) Yazdır tuşu dinleyicisi
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "F10") {
        e.preventDefault();
        handlePrint();
      } else if (/^F([1-9]|1[1-2])$/.test(e.key)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [show, onClose]);

  const handlePrint = async () => {
    const rowsHtml = displayItems
      .map(
        (item) => `
      <tr>
        <td style="padding: 4px 0; border-bottom: 1px dashed #000; font-weight: 600;">${item.kod} ${item.ad && item.ad !== item.kod ? `(${item.ad})` : ""}</td>
        <td style="padding: 4px 0; border-bottom: 1px dashed #000; text-align: right; font-weight: 700;">${Number(item.miktar).toLocaleString("tr-TR", { minimumFractionDigits: tlKurusSayisi, maximumFractionDigits: tlKurusSayisi })}</td>
      </tr>
    `
      )
      .join("");

    const slipHtml = `
      <div style="font-family: 'Consolas', monospace; font-size: 13px; color: #000; width: 100%; max-width: 78mm; padding: 4px;">
        <div style="text-align: center; font-weight: 800; font-size: 15px; margin-bottom: 4px;">VEZNE BAKİYE DÖKÜMÜ</div>
        <div style="text-align: center; font-weight: 700; font-size: 12px; margin-bottom: 6px;">${vezneKod} - ${vezneAd}</div>
        <div style="font-size: 11px; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 4px;">
          Tarih: ${new Date().toLocaleDateString("tr-TR")} ${new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: left; padding: 2px 0;">Hesap / Para</th>
              <th style="text-align: right; padding: 2px 0;">Bakiye</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div style="text-align: center; font-size: 10px; margin-top: 12px; border-top: 1px solid #000; padding-top: 4px;">
          LİKYA ERP - BİLGİ FİŞİDİR
        </div>
      </div>
    `;

    await triggerSilentPrint({
      html: slipHtml,
      title: `Vezne_${vezneKod}_Bakiye`,
      isPos: true,
      allowBrowserFallback: false,
    });
  };

  const displayItems = bakiyeler && bakiyeler.length > 0 ? bakiyeler : [];

  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      backdrop="static"
      dialogClassName="modal-vezne-bakiye-dialog"
      contentClassName="p-0 border-0 shadow-2xl rounded-2 overflow-hidden"
    >
      <div
        className="d-flex flex-column"
        style={{
          border: "1px solid #475569",
          borderRadius: "4px",
          backgroundColor: "#ffffff",
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
              style={{ width: "22px", height: "22px", backgroundColor: "#0284c7", color: "#fff" }}
            >
              <IconBuildingBank size={14} />
            </div>
            <span className="fw-bold text-dark" style={{ fontSize: "13.5px" }}>
              Vezne bakiye {vezneAd ? `(${vezneKod} - ${vezneAd})` : ""}
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

        {/* İki Sütunlu Grid Alanı */}
        <div
          className="p-0"
          style={{
            maxHeight: "480px",
            minHeight: "340px",
            overflowY: "auto",
            backgroundColor: "#ffffff",
          }}
        >
          <Table
            bordered
            size="sm"
            className="mb-0 text-nowrap align-middle"
            style={{ fontSize: "13px", borderCollapse: "separate", borderSpacing: 0 }}
          >
            <thead className="position-sticky top-0" style={{ zIndex: 10 }}>
              <tr>
                <th
                  style={{
                    width: "50%",
                    padding: "8px 14px",
                    backgroundColor: "#cbe2f8",
                    color: "#0f172a",
                    borderRight: "1px solid #94a3b8",
                    borderBottom: "1px solid #94a3b8",
                    fontWeight: 600,
                  }}
                >
                  Döviz Cinsi
                </th>
                <th
                  className="text-end"
                  style={{
                    width: "50%",
                    padding: "8px 14px",
                    backgroundColor: "#cbe2f8",
                    color: "#0f172a",
                    borderBottom: "1px solid #94a3b8",
                    fontWeight: 600,
                  }}
                >
                  Bakiye Miktarı
                </th>
              </tr>
            </thead>
            <tbody>
              {displayItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="text-center py-5 text-muted small"
                    style={{ backgroundColor: "#f8fafc" }}
                  >
                    Kayıtlı vezne bakiyesi bulunamadı.
                  </td>
                </tr>
              ) : (
                displayItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  const selectedBgColor = "#bae6fd";

                  return (
                    <tr
                      key={item.paraId || item.kod || idx}
                      onClick={() => setSelectedIndex(idx)}
                      style={{
                        cursor: "pointer",
                        userSelect: "none",
                        backgroundColor: isSelected ? selectedBgColor : undefined,
                        boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                      }}
                    >
                      {/* Sol Sütun: Açık Mavi veya Seçili Renk */}
                      <td
                        className="fw-bold font-monospace px-3.5 py-2"
                        style={{
                          backgroundColor: isSelected ? selectedBgColor : "#cbe2f8",
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                          borderRight: "1px solid #93c5fd",
                          borderBottom: "1px solid #e2e8f0",
                          color: isSelected ? "#0369a1" : "#1e293b",
                        }}
                      >
                        {item.kod} {item.ad && item.ad !== item.kod ? `(${item.ad})` : ""}
                      </td>
                      {/* Sağ Sütun: Bakiye */}
                      <td
                        className="text-end font-monospace fw-semibold px-3.5 py-2"
                        style={{
                          backgroundColor: isSelected ? selectedBgColor : "#ffffff",
                          boxShadow: isSelected ? `inset 0 0 0 9999px ${selectedBgColor}` : undefined,
                          borderBottom: "1px solid #e2e8f0",
                          color: isSelected ? "#0369a1" : item.miktar < 0 ? "#dc2626" : "#0f172a",
                        }}
                      >
                        {Number(item.miktar).toLocaleString("tr-TR", {
                          minimumFractionDigits: tlKurusSayisi,
                          maximumFractionDigits: tlKurusSayisi,
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </div>

        {/* Modal Altı: F10) Yazdır Butonu */}
        <div
          className="d-flex align-items-center justify-content-end px-3 py-2.5"
          style={{
            backgroundColor: "#e0f2fe",
            borderTop: "1px solid #94a3b8",
          }}
        >
          <Button
            variant="info"
            size="sm"
            className="d-flex align-items-center gap-1.5 px-3 py-1.5 fw-semibold shadow-xs"
            style={{
              fontSize: "12.5px",
              backgroundColor: "#0284c7",
              borderColor: "#0284c7",
              color: "#ffffff",
            }}
            onClick={handlePrint}
            title="Vezne Dökümünü Yazdır (F10)"
          >
            <IconPrinter size={15} />
            <span>F10) Yazdır</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};

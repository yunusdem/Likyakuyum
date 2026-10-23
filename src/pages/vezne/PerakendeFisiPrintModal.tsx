import React, { useEffect, useState, useRef, useCallback } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { IconPrinter, IconX, IconReceipt, IconFileText } from "@tabler/icons-react";
import { PerakendeFaturaModel } from "../../services/perakendeService";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { VezneItem } from "../../services/cashDeskService";
import { resolveEffectivePrinter, ResolvedPrinterResult } from "../../utils/printerResolver";
import { useAuth } from "../../context/AuthContext";
import { perakendeFisHtml, perakendeFisleriHtml, type FisHtml } from "../../utils/belgeSablon/fisCikti";
import { fisiYazdir } from "../../utils/belgeSablon/yazdir";
import { SablonluFisOnizleme, useSablonluFis } from "../../components/belge/SablonluFisOnizleme";

export interface PerakendeFisiPrintModalProps {
  show: boolean;
  onHide: () => void;
  fatura: PerakendeFaturaModel | null;
  autoPrint?: boolean;
  vezne?: VezneItem | null;
}

/**
 * Perakende bilgi fişi (80 mm POS) / e-Arşiv fatura görünümü (A4) önizleme ve yazdırma.
 * Fiş, firmanın şablonundan çizilir (docs/FIS_TASARIM_YOL_HARITASI.md); düzen kodda değil şablondadır.
 */
export const PerakendeFisiPrintModal: React.FC<PerakendeFisiPrintModalProps> = ({ show, onHide, fatura, autoPrint = false, vezne }) => {
  const { user } = useAuth();
  const [printType, setPrintType] = useState<"A4" | "POS">("POS");
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<{ name: string; isDefault?: boolean }[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | string | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ResolvedPrinterResult | null>(null);
  const [yaziciHazir, setYaziciHazir] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const faturaRef = useRef(fatura);
  faturaRef.current = fatura;

  const tip = fatura?.faturaTipi === 0 ? 0 : 1;

  useEffect(() => {
    if (!show) { setYaziciHazir(false); return; }

    Promise.all([
      PrinterService.getYazicilar().catch(() => [] as YaziciItem[]),
      PrinterService.getSystemPrinters(user).catch(() => [] as any[]),
    ])
      .then(([dbList, sysList]) => {
        setPrinters(dbList);
        setSystemPrinters(sysList);

        const termUUID = PrinterService.getTerminalUUID();
        const savedTermPrinter =
          localStorage.getItem(`likya_terminal_printer_${termUUID}`) ||
          localStorage.getItem("likya_last_selected_printer") ||
          localStorage.getItem("likya_terminal_last_printer");

        const resolved = resolveEffectivePrinter({ pageType: "perakende", tip, vezne, user, printers: dbList });
        setResolvedResult(resolved);

        let initialPName: string | null = null;
        if (savedTermPrinter) {
          setSelectedPrinterId(savedTermPrinter);
          initialPName = savedTermPrinter;
        } else if (resolved.printerId !== null && resolved.printerId !== undefined) {
          setSelectedPrinterId(resolved.printerId);
          initialPName = resolved.printerName;
        } else {
          const fallback = resolved.printerName || (sysList[0]?.name ?? null);
          setSelectedPrinterId(fallback);
          initialPName = fallback;
        }

        if (initialPName) {
          fetch("http://127.0.0.1:9100/api/set-default", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ printerName: initialPName }),
          }).catch(() => {});
        }

        if (resolved.recommendedPrintType) setPrintType(resolved.recommendedPrintType);
      })
      .finally(() => setYaziciHazir(true));
  }, [show, tip, vezne, user]);

  const { fis, hata } = useSablonluFis(show && yaziciHazir && !!fatura, `${printType}|${fatura?.faturaId ?? ""}|${fatura?.faturaNo ?? ""}`,
    () => perakendeFisleriHtml(faturaRef.current as any, printType === "POS" ? "80" : "A4"));

  const handlePrinterChange = (newVal: string) => {
    setSelectedPrinterId(newVal || null);
    if (!newVal) return;

    const matchedSys = systemPrinters.find((p) => p.name.toLowerCase() === newVal.toLowerCase());
    const matchedDb = printers.find((p) => String(p.id) === newVal || p.cihazAdi === newVal || p.ad === newVal);
    const pName = matchedSys?.name || matchedDb?.cihazAdi || matchedDb?.ad || newVal;

    PrinterService.saveClientPrinter({ name: pName }, user?.id);

    fetch("http://127.0.0.1:9100/api/set-default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printerName: pName }),
    }).catch(() => {});
  };

  const handleBrowserPrint = useCallback(() => {
    if (!fis) return;
    const fisler = Array.isArray(fis) ? fis : [fis];
    const fullHtml = fisler.map((f) => f.html).join("<div style='page-break-after:always;height:0;'></div>");
    const printWin = window.open("", "_blank", "width=850,height=900");
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Perakende Fişi / Fatura</title>
          <style>
            @page {
              size: ${printType === "POS" ? "80mm auto" : "A4 portrait"};
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              background: #ffffff;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .pos-print-root {
              width: 80mm;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          ${printType === "POS" ? `<div class="pos-print-root">${fullHtml}</div>` : fullHtml}
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
        </html>
      `);
      printWin.document.close();
    }
  }, [fis, printType]);

  const handlePrint = useCallback(async (hazir: FisHtml | FisHtml[] | null = fis) => {
    if (!hazir || isPrinting) return;
    setIsPrinting(true);
    try {
      const selectedDbPrinter = printers.find(
        (p) =>
          String(p.id) === String(selectedPrinterId) ||
          (p.cihazAdi && String(p.cihazAdi).trim().toLowerCase() === String(selectedPrinterId).trim().toLowerCase()) ||
          (p.ad && String(p.ad).trim().toLowerCase() === String(selectedPrinterId).trim().toLowerCase())
      );
      const selectedSysPrinter = systemPrinters.find(
        (p) => p.name.toLowerCase() === String(selectedPrinterId || "").toLowerCase()
      );

      const targetPrinterName = selectedSysPrinter
        ? selectedSysPrinter.name
        : selectedDbPrinter
        ? (selectedDbPrinter.cihazAdi?.trim() || selectedDbPrinter.ad?.trim() || null)
        : (selectedPrinterId ? String(selectedPrinterId) : (resolvedResult?.printerName || null));

      const targetCopies = selectedDbPrinter?.kopyaSayisi ? Number(selectedDbPrinter.kopyaSayisi) : (resolvedResult?.kopyaSayisi || 1);
      const res = await fisiYazdir(hazir, {
        printerId: selectedDbPrinter ? selectedDbPrinter.id : null,
        printerName: targetPrinterName,
        copies: targetCopies,
        isPos: printType === "POS",
      });
      if (res.success) {
        onHide();
      } else {
        handleBrowserPrint();
        onHide();
      }
    } finally {
      setIsPrinting(false);
    }
  }, [fis, isPrinting, selectedPrinterId, printers, systemPrinters, resolvedResult, printType, onHide, handleBrowserPrint]);

  // Doğrudan yazdırma: fiş hazır olunca yazdır ve kapat; hata olursa pencere açılır, hata görünür.
  const otomatikBasildi = useRef(false);
  useEffect(() => { if (!show) otomatikBasildi.current = false; }, [show]);
  useEffect(() => {
    if (!show || !autoPrint || otomatikBasildi.current || !fis) return;
    otomatikBasildi.current = true;
    handlePrint(fis).finally(() => onHide());
  }, [show, autoPrint, fis, handlePrint, onHide]);

  // Keyboard shortcut listener (Enter / F8 / F10 inside print modal)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!show) return;
      if (e.key === "Enter" || e.key === "F8" || e.key === "F10") {
        e.preventDefault();
        e.stopPropagation();
        handlePrint();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onHide();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [show, handlePrint, onHide]);

  if (!fatura) return null;

  return (
    <Modal show={show && (!autoPrint || !!hata)} onHide={onHide} size="xl" centered className="perakende-print-modal" backdrop="static">
      <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom d-print-none">
        <div className="d-flex align-items-center justify-content-between w-100 me-3 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <div className="p-2 rounded bg-primary text-white">
              <IconPrinter size={20} />
            </div>
            <div>
              <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                Perakende Fişi / Fatura
                {Array.isArray(fis) && fis.length > 1 && (
                  <span className="badge bg-primary fs-xs px-2 py-0.5">
                    {fis.length} Fiş
                  </span>
                )}
              </h6>
              <small className="text-muted">
                No: <strong className="text-dark">{fatura.faturaNo}</strong>
              </small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-1">
              <span className="text-secondary small fw-bold">Yazıcı:</span>
              <Form.Select
                size="sm"
                value={selectedPrinterId !== null && selectedPrinterId !== undefined ? String(selectedPrinterId) : ""}
                onChange={(e) => handlePrinterChange(e.target.value)}
                style={{ width: "220px", fontSize: "11.5px", fontWeight: 600 }}
              >
                {systemPrinters.length > 0 && (
                  <optgroup label="🔌 Bu Bilgisayara Bağlı Yazıcılar">
                    {systemPrinters.map((p) => (
                      <option key={`sys-${p.name}`} value={p.name}>
                        {p.name} {p.isDefault ? "(Varsayılan)" : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {printers.length > 0 && (
                  <optgroup label="🏢 Sistem / Vezne Tanımlı Yazıcılar">
                    {printers.map((p) => (
                      <option key={`db-${p.id}`} value={p.id}>
                        {p.ad || p.cihazAdi || `Yazıcı #${p.id}`} {p.kopyaSayisi ? `(${p.kopyaSayisi} Kopya)` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
                {printers.length === 0 && systemPrinters.length === 0 && (
                  <option value="">Sistem Varsayılan Yazıcısı</option>
                )}
              </Form.Select>
              {resolvedResult?.sourceLabel && (
                <span className="badge bg-secondary bg-opacity-10 text-secondary border px-1.5 py-1" style={{ fontSize: "10px" }}>
                  {resolvedResult.sourceLabel}
                </span>
              )}
            </div>

            <div className="btn-group btn-group-sm">
              <button type="button" className={`btn ${printType === "A4" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setPrintType("A4")}>
                <IconFileText size={15} className="me-1" />
                A4 Fatura
              </button>
              <button type="button" className={`btn ${printType === "POS" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setPrintType("POS")}>
                <IconReceipt size={15} className="me-1" />
                80mm POS
              </button>
            </div>

            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleBrowserPrint}
              disabled={!fis || isPrinting}
              className="px-2.5 fw-bold"
              title="Google Chrome / Tarayıcı Önizleme Penceresi ile Yazdır"
            >
              <IconPrinter size={14} className="me-1" />
              Tarayıcı (Ctrl+P)
            </Button>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-4 bg-light overflow-auto" style={{ maxHeight: "calc(85vh - 110px)" }}>
        <SablonluFisOnizleme fis={fis} hata={hata} />
      </Modal.Body>

      <Modal.Footer className="bg-light py-2 px-3 border-top d-print-none">
        <Button variant="outline-secondary" size="sm" onClick={onHide} disabled={isPrinting}>
          <IconX size={16} className="me-1" />
          Kapat
        </Button>
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleBrowserPrint}
          disabled={!fis || isPrinting}
          title="Google Chrome / Tarayıcı Yazdırma Penceresi (Ctrl+P)"
        >
          <IconPrinter size={14} className="me-1" />
          Tarayıcıdan Yazdır (Ctrl+P)
        </Button>
        <Button variant="primary" size="sm" onClick={() => handlePrint()} disabled={!fis || isPrinting}>
          {isPrinting ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-1" />
              Yazdırılıyor...
            </>
          ) : (
            <>
              <IconPrinter size={16} className="me-1" />
              Yazdır (F10{Array.isArray(fis) && fis.length > 1 ? ` - ${fis.length} Fiş` : ""})
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};


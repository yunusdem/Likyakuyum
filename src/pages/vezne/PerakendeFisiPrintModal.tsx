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
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | string | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ResolvedPrinterResult | null>(null);
  const [yaziciHazir, setYaziciHazir] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const faturaRef = useRef(fatura);
  faturaRef.current = fatura;

  const tip = fatura?.faturaTipi === 0 ? 0 : 1;

  useEffect(() => {
    if (!show) { setYaziciHazir(false); return; }
    PrinterService.getYazicilar()
      .then((list) => {
        setPrinters(list);
        const resolved = resolveEffectivePrinter({ pageType: "perakende", tip, vezne, user, printers: list });
        setResolvedResult(resolved);
        setSelectedPrinterId(resolved.printerId !== null && resolved.printerId !== undefined ? resolved.printerId : (resolved.printerName || null));
        if (resolved.recommendedPrintType) setPrintType(resolved.recommendedPrintType);
      })
      .catch(() => {
        const resolved = resolveEffectivePrinter({ pageType: "perakende", tip, vezne, user, printers: [] });
        setResolvedResult(resolved);
        setSelectedPrinterId(resolved.printerId !== null && resolved.printerId !== undefined ? resolved.printerId : (resolved.printerName || null));
      })
      .finally(() => setYaziciHazir(true));
  }, [show, tip, vezne, user]);

  const { fis, hata } = useSablonluFis(show && yaziciHazir && !!fatura, `${printType}|${fatura?.faturaId ?? ""}|${fatura?.faturaNo ?? ""}`,
    () => perakendeFisleriHtml(faturaRef.current as any, printType === "POS" ? "80" : "A4"));

  const handlePrint = useCallback(async (hazir: FisHtml | FisHtml[] | null = fis) => {
    if (!hazir || isPrinting) return;
    setIsPrinting(true);
    try {
      const selectedPrinter = printers.find(
        (p) =>
          String(p.id) === String(selectedPrinterId) ||
          (p.cihazAdi && String(p.cihazAdi).trim().toLowerCase() === String(selectedPrinterId).trim().toLowerCase()) ||
          (p.ad && String(p.ad).trim().toLowerCase() === String(selectedPrinterId).trim().toLowerCase())
      );
      const targetPrinterName = selectedPrinter
        ? (selectedPrinter.cihazAdi?.trim() || selectedPrinter.ad?.trim() || null)
        : (selectedPrinterId ? String(selectedPrinterId) : (resolvedResult?.printerName || null));
      const targetCopies = selectedPrinter?.kopyaSayisi ? Number(selectedPrinter.kopyaSayisi) : (resolvedResult?.kopyaSayisi || 1);
      const res = await fisiYazdir(hazir, {
        printerId: selectedPrinter ? selectedPrinter.id : null,
        printerName: targetPrinterName,
        copies: targetCopies,
        isPos: printType === "POS",
      });
      if (res.success) {
        onHide();
      } else {
        alert(`⚠️ Yazdırma hatası: ${res.message}`);
      }
    } finally {
      setIsPrinting(false);
    }
  }, [fis, isPrinting, selectedPrinterId, printers, resolvedResult, printType, onHide]);

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
                onChange={(e) => setSelectedPrinterId(e.target.value || null)}
                style={{ width: "200px", fontSize: "12px", fontWeight: 600 }}
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ad || p.cihazAdi || `Yazıcı #${p.id}`} {p.kopyaSayisi ? `(${p.kopyaSayisi} Kopya)` : ""}
                  </option>
                ))}
                {printers.length === 0 && <option value="">Sistem Varsayılan Yazıcısı</option>}
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


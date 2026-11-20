import React, { useEffect, useState, useRef, useCallback } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import { IconPrinter, IconX, IconReceipt, IconFileText } from "@tabler/icons-react";
import type { TicariSatisFisi } from "../../services/ticariService";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { VezneItem } from "../../services/cashDeskService";
import { resolveEffectivePrinter, ResolvedPrinterResult } from "../../utils/printerResolver";
import { useAuth } from "../../context/AuthContext";
import { ticariFisHtml, type FisHtml } from "../../utils/belgeSablon/fisCikti";
import { fisiYazdir } from "../../utils/belgeSablon/yazdir";
import { SablonluFisOnizleme, useSablonluFis } from "../../components/belge/SablonluFisOnizleme";

export interface TicariFisPrintModalProps {
  show: boolean;
  onHide: () => void;
  fatura: (Partial<TicariSatisFisi> & Record<string, any>) | null;
  autoPrint?: boolean;
  vezne?: VezneItem | null;
}

/**
 * Ticari satış bilgi fişi (80 mm) / fatura görünümü (A4) önizleme ve yazdırma (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T17).
 * Fiş, firmanın şablonundan çizilir (docs/FIS_TASARIM_YOL_HARITASI.md); düzen kodda değil şablondadır.
 */
export const TicariFisPrintModal: React.FC<TicariFisPrintModalProps> = ({ show, onHide, fatura, autoPrint = false, vezne }) => {
  const { user } = useAuth();
  const [printType, setPrintType] = useState<"A4" | "POS">("POS");
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ResolvedPrinterResult | null>(null);
  const [yaziciHazir, setYaziciHazir] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  // PrinterAgent hatası yutulmaz: pencere açık kalır, mesaj görünür (ortak alan denetimi 19.11.2026, #38)
  const [yazdirHatasi, setYazdirHatasi] = useState<string | null>(null);
  const faturaRef = useRef(fatura);
  faturaRef.current = fatura;

  useEffect(() => {
    if (!show) { setYaziciHazir(false); return; }
    PrinterService.getYazicilar()
      .then((list) => {
        setPrinters(list);
        const resolved = resolveEffectivePrinter({ pageType: "perakende", tip: 1, vezne, user, printers: list });
        setResolvedResult(resolved);
        setSelectedPrinterId(resolved.printerId);
        if (resolved.recommendedPrintType) setPrintType(resolved.recommendedPrintType);
      })
      .catch(() => {
        setResolvedResult(resolveEffectivePrinter({ pageType: "perakende", tip: 1, vezne, user, printers: [] }));
      })
      .finally(() => setYaziciHazir(true));
  }, [show, vezne, user]);

  const { fis, hata } = useSablonluFis(show && yaziciHazir && !!fatura, `${printType}|${fatura?.faturaId ?? ""}|${fatura?.faturaNo ?? ""}`,
    () => ticariFisHtml(faturaRef.current as any, printType === "POS" ? "80" : "A4"));

  const handlePrint = useCallback(async (hazir: FisHtml | FisHtml[] | null = fis): Promise<boolean> => {
    if (!hazir || isPrinting) return false;
    setIsPrinting(true);
    setYazdirHatasi(null);
    try {
      // Seçilen yazıcı kaydının cihaz adı / adı gider (vezne modallarındaki gibi); seçim yoksa çözülen yazıcı.
      // Kopya: her belge nolu fiş 1 kopya (yazdir.ts kuralı) (ortak alan denetimi 19.11.2026, #39 / #40)
      const secilen = printers.find((p) => String(p.id) === String(selectedPrinterId)) || null;
      const printerName = secilen
        ? (secilen.cihazAdi?.trim() || secilen.ad?.trim() || null)
        : (resolvedResult?.printer?.cihazAdi || resolvedResult?.printer?.ad || null);
      const res = await fisiYazdir(hazir, {
        printerId: secilen ? secilen.id : null,
        printerName,
        copies: 1,
        isPos: printType === "POS",
      });
      if (res.success) return true;
      // Hata olunca pencere kapanmaz; mesaj gösterilir (#38)
      setYazdirHatasi(res.message || "Fiş yazıcıya gönderilemedi.");
      return false;
    } catch (e: any) {
      setYazdirHatasi(e?.message || "Fiş yazıcıya gönderilemedi.");
      return false;
    } finally {
      setIsPrinting(false);
    }
  }, [fis, isPrinting, printers, selectedPrinterId, resolvedResult, printType]);

  // Doğrudan yazdırma: fiş hazır olunca yazdır ve kapat; hata olursa pencere açılır, hata görünür.
  const otomatikBasildi = useRef(false);
  useEffect(() => { if (!show) { otomatikBasildi.current = false; setYazdirHatasi(null); } }, [show]);
  useEffect(() => {
    if (!show || !autoPrint || otomatikBasildi.current || !fis) return;
    otomatikBasildi.current = true;
    // Yalnız başarıda kapanır; başarısızlıkta pencere hata ile açılır (#38)
    handlePrint(fis).then((basildi) => { if (basildi) onHide(); });
  }, [show, autoPrint, fis, handlePrint, onHide]);

  // Keyboard shortcut listener (F8 / F10 inside print modal)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!show) return;
      if (e.key === "F8" || e.key === "F10") {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [show, handlePrint]);

  if (!fatura) return null;

  return (
    <Modal show={show && (!autoPrint || !!hata || !!yazdirHatasi)} onHide={onHide} size="xl" centered className="ticari-print-modal" backdrop="static">
      <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom d-print-none">
        <div className="d-flex align-items-center justify-content-between w-100 me-3 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <div className="p-2 rounded bg-primary text-white">
              <IconPrinter size={20} />
            </div>
            <div>
              <h6 className="mb-0 fw-bold">Satış Fişi / Fatura</h6>
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
                value={selectedPrinterId || ""}
                onChange={(e) => setSelectedPrinterId(e.target.value ? Number(e.target.value) : null)}
                style={{ width: "200px", fontSize: "12px", fontWeight: 600 }}
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {/* "(N Kopya)" etiketi kaldırıldı: her belge nolu fiş 1 kopya basılır (ortak alan denetimi 19.11.2026, #40) */}
                    {p.ad || p.cihazAdi || `Yazıcı #${p.id}`}
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
        {yazdirHatasi && (
          <Alert variant="danger" className="mb-3 py-2 small" dismissible onClose={() => setYazdirHatasi(null)}>
            <div className="fw-bold">Fiş yazıcıya gönderilemedi.</div>
            <div>{yazdirHatasi}</div>
            <div className="mt-1">Yazıcı köprüsünü (PrinterAgent) ve seçilen yazıcıyı kontrol edip yeniden deneyin.</div>
          </Alert>
        )}
        <SablonluFisOnizleme fis={fis} hata={hata} />
      </Modal.Body>

      <Modal.Footer className="bg-light py-2 px-3 border-top d-print-none">
        <Button variant="outline-secondary" size="sm" onClick={onHide}>
          <IconX size={16} className="me-1" />
          Kapat
        </Button>
        <Button variant="primary" size="sm" onClick={() => handlePrint()} disabled={!fis || isPrinting}>
          <IconPrinter size={16} className="me-1" />
          Yazdır
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

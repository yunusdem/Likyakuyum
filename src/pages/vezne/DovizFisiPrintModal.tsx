import React, { useEffect, useState, useRef, useCallback } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { IconPrinter, IconX } from "@tabler/icons-react";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { resolveEffectivePrinter, ResolvedPrinterResult } from "../../utils/printerResolver";
import { useAuth } from "../../context/AuthContext";
import { dovizFisHtml, type FisHtml } from "../../utils/belgeSablon/fisCikti";
import { fisiYazdir } from "../../utils/belgeSablon/yazdir";
import { SablonluFisOnizleme, useSablonluFis } from "../../components/belge/SablonluFisOnizleme";

export interface PrintLineItem {
  paraKodu: string;
  paraAdi?: string;
  miktar: number | string;
  kur: number | string;
  tutar: number | string;
  usdKarsiligi?: number | string;
  bmv?: number | string;
  komisyon?: number | string;
}

export interface DovizFisiPrintModalProps {
  show: boolean;
  onHide: () => void;
  autoPrint?: boolean;
  fisId?: number | null;
  tip: number; // 0: Alış, 1: Satış
  tarih: string;
  saat?: string;
  seriNo?: string;
  belgeNo?: string;
  unvan?: string;
  vergiKimlikNo?: string;
  detayIl?: string;
  detayIlce?: string;
  detayUyruk?: string;
  detayPasaportNo?: string;
  detayMeslek?: string;
  detayCariTipi?: string;
  vezneKod?: string;
  vezne?: any;
  istatistikKodu?: string;
  guid?: string;
  lines: PrintLineItem[];
  toplamTutar?: number;
  odemeTutari?: number;
  bsmvTutari?: number;
  komisyonTutari?: number;
  giseUsdKuru?: number;
  dovizKurusSayisi?: number;
  kurKurusSayisi?: number;
  tlKurusSayisi?: number;
}

/**
 * e-Döviz fişi önizleme / yazdırma (F9, F10 otomatik).
 * Fiş, firmanın termal şablonundan çizilir (docs/FIS_TASARIM_YOL_HARITASI.md); düzen kodda değil şablondadır.
 */
export const DovizFisiPrintModal: React.FC<DovizFisiPrintModalProps> = (props) => {
  const { show, onHide, autoPrint = false, tip, vezne } = props;
  const isSatis = tip === 1;
  const { user } = useAuth();
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | string | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ResolvedPrinterResult | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;
  // Fiş HTML'i: pencere her açıldığında ekranın o anki görüntüsüyle şablondan üretilir.
  const { fis, hata } = useSablonluFis(show, "doviz", () => {
    const { show: _s, onHide: _o, autoPrint: _a, vezne: _v, ...girdi } = propsRef.current;
    return dovizFisHtml(girdi);
  });

  // Load printers and resolve effective printer based on vezne/user/tip
  useEffect(() => {
    if (!show) return;
    PrinterService.getYazicilar()
      .then((list) => {
        setPrinters(list);
        const resolved = resolveEffectivePrinter({ pageType: "doviz", tip, vezne, user, printers: list });
        setResolvedResult(resolved);
        setSelectedPrinterId(resolved.printerId !== null && resolved.printerId !== undefined ? resolved.printerId : (resolved.printerName || null));
      })
      .catch(() => {
        const resolved = resolveEffectivePrinter({ pageType: "doviz", tip, vezne, user, printers: [] });
        setResolvedResult(resolved);
        setSelectedPrinterId(resolved.printerId !== null && resolved.printerId !== undefined ? resolved.printerId : (resolved.printerName || null));
      });
  }, [show, tip, vezne, user]);

  const handlePrint = useCallback(async (hazir: FisHtml | null = fis) => {
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
        isPos: true,
      });
      if (res.success) {
        onHide();
      } else {
        alert(`⚠️ Yazdırma hatası: ${res.message}`);
      }
    } finally {
      setIsPrinting(false);
    }
  }, [fis, isPrinting, selectedPrinterId, printers, resolvedResult, onHide]);

  // F10 / doğrudan yazdırma: fiş hazır olunca yazdır ve kapat; hata olursa pencere açık kalır, hata görünür.
  const otomatikBasildi = useRef(false);
  useEffect(() => { if (!show) otomatikBasildi.current = false; }, [show]);
  useEffect(() => {
    if (!show || !autoPrint || otomatikBasildi.current) return;
    if (fis) {
      otomatikBasildi.current = true;
      handlePrint(fis).finally(() => onHide());
    }
  }, [show, autoPrint, fis, handlePrint, onHide]);

  // Enter / F8 / F10 / Escape Shortcuts for print when modal is open
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

  return (
    <Modal show={show && (!autoPrint || !!hata)} onHide={onHide} size="lg" centered backdrop="static">
      <Modal.Header closeButton className="bg-light py-2 px-3">
        <div className="d-flex align-items-center justify-content-between w-100 me-2 flex-wrap gap-2">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 mb-0">
            <IconPrinter size={18} className="text-primary" />
            e-Döviz Fişi ({isSatis ? "SATIŞ BELGESİ" : "ALIM BELGESİ"} - 80mm)
          </Modal.Title>
          <div className="d-flex align-items-center gap-2">
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
              <span className="badge bg-secondary bg-opacity-10 text-secondary border px-2 py-1" style={{ fontSize: "10px" }}>
                {resolvedResult.sourceLabel}
              </span>
            )}
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-3" style={{ backgroundColor: "#525659", overflow: "auto" }}>
        <SablonluFisOnizleme fis={fis} hata={hata} />
      </Modal.Body>

      <Modal.Footer className="bg-light py-2 d-flex justify-content-between">
        <Button variant="secondary" size="sm" onClick={onHide} disabled={isPrinting} className="d-flex align-items-center gap-1">
          <IconX size={15} /> Kapat
        </Button>
        <Button variant="primary" size="sm" onClick={() => handlePrint()} disabled={!fis || isPrinting} className="d-flex align-items-center gap-1 px-4 fw-bold shadow-xs">
          {isPrinting ? (
            <>
              <Spinner as="span" animation="border" size="sm" className="me-1" />
              Yazdırılıyor...
            </>
          ) : (
            <>
              <IconPrinter size={16} /> Yazdır (F8 / Termal Çıktı)
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};


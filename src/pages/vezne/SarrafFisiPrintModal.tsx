import React, { useEffect, useState, useRef, useCallback } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { IconPrinter, IconX, IconReceipt, IconFileText } from "@tabler/icons-react";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { resolveEffectivePrinter, ResolvedPrinterResult } from "../../utils/printerResolver";
import { useAuth } from "../../context/AuthContext";
import { sarrafFisHtml, sarrafFisleriHtml, type FisHtml } from "../../utils/belgeSablon/fisCikti";
import { fisiYazdir } from "../../utils/belgeSablon/yazdir";
import { SablonluFisOnizleme, useSablonluFis } from "../../components/belge/SablonluFisOnizleme";

export interface SarrafPrintLineItem {
  satirNo?: number;
  urunKodu?: string;
  urunAdi: string;
  adet?: number | string;
  miktar?: number | string;
  milyem?: number | string;
  hasGram?: number | string;
  iscilikiMiktari?: number | string;
  iscilikHasGram?: number | string;
  iscilikHesaplamaSekli?: number;
  kur?: number | string;
  tutar?: number | string;
  aciklama?: string;
  urunTipi?: number;
  karat?: number | string;
}

export interface SarrafPrintOdemeItem {
  satirNo?: number;
  odemeAraciTuru?: number;
  paraKodu?: string;
  paraAdi?: string;
  adet?: number | string;
  miktar?: number | string;
  milyem?: number | string;
  hasGram?: number | string;
  kur?: number | string;
  tutar?: number | string;
}

export interface SarrafFisiPrintModalProps {
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
  detayAdres?: string;
  detayTelefonNo?: string;
  vezneKod?: string;
  vezne?: any;
  kullaniciAdi?: string;
  satirlar: SarrafPrintLineItem[];
  odemeSatirlari?: SarrafPrintOdemeItem[];
  toplamTutar?: number;
  toplamHas?: number;
  odenenTutar?: number;
  kalanTutar?: number;
}

/**
 * Sarraf fişi önizleme / yazdırma (80 mm POS veya A4).
 * Fiş, firmanın şablonundan çizilir (docs/FIS_TASARIM_YOL_HARITASI.md); düzen kodda değil şablondadır.
 */
export const SarrafFisiPrintModal: React.FC<SarrafFisiPrintModalProps> = (props) => {
  const { show, onHide, autoPrint = false, tip, vezne } = props;
  const { user } = useAuth();
  const [printType, setPrintType] = useState<"A4" | "POS">("POS");
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | string | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ResolvedPrinterResult | null>(null);
  const [yaziciHazir, setYaziciHazir] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const isSatis = Number(tip) === 1;
  const fisTuruBaslik = isSatis ? "SARRAF SATIŞ FİŞİ" : "SARRAF ALIŞ FİŞİ";
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!show) { setYaziciHazir(false); return; }
    PrinterService.getYazicilar()
      .then((list) => {
        setPrinters(list);
        const resolved = resolveEffectivePrinter({ pageType: "sarraf", tip, vezne, user, printers: list });
        setResolvedResult(resolved);
        setSelectedPrinterId(resolved.printerId !== null && resolved.printerId !== undefined ? resolved.printerId : (resolved.printerName || null));
        if (resolved.recommendedPrintType) setPrintType(resolved.recommendedPrintType);
      })
      .catch(() => {
        const resolved = resolveEffectivePrinter({ pageType: "sarraf", tip, vezne, user, printers: [] });
        setResolvedResult(resolved);
        setSelectedPrinterId(resolved.printerId !== null && resolved.printerId !== undefined ? resolved.printerId : (resolved.printerName || null));
      })
      .finally(() => setYaziciHazir(true));
  }, [show, tip, vezne, user]);

  // Kâğıt türü yazıcıdan belli olunca (ve kullanıcı değiştirdikçe) şablondan üretilir.
  const { fis, hata } = useSablonluFis(show && yaziciHazir, printType, () => {
    const { show: _s, onHide: _o, autoPrint: _a, vezne: _v, ...girdi } = propsRef.current;
    return sarrafFisleriHtml(girdi, printType === "POS" ? "80" : "A4");
  });

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

  // F8/F10 / Enter Shortcuts inside Print Modal
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

  const toplamFisSayisi = Array.isArray(fis) ? fis.length : (fis ? 1 : 0);

  return (
    <Modal show={show && (!autoPrint || !!hata)} onHide={onHide} size="lg" centered className="sarraf-print-modal">
      <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom d-print-none">
        <div className="d-flex align-items-center justify-content-between w-100 me-3 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <IconReceipt size={20} className="text-primary" />
            <h6 className="mb-0 fw-bold">
              {fisTuruBaslik}
              {toplamFisSayisi > 1 && (
                <span className="badge bg-primary ms-2 fs-xs px-2 py-0.5">
                  {toplamFisSayisi} Fiş
                </span>
              )}
            </h6>
          </div>

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <div className="d-flex align-items-center gap-1">
              <span className="text-secondary small fw-bold">Yazıcı:</span>
              <Form.Select
                size="sm"
                value={selectedPrinterId !== null && selectedPrinterId !== undefined ? String(selectedPrinterId) : ""}
                onChange={(e) => setSelectedPrinterId(e.target.value || null)}
                style={{ width: "190px", fontSize: "11.5px", fontWeight: 600 }}
              >
                {printers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.ad || p.cihazAdi || `Yazıcı #${p.id}`} {p.kopyaSayisi ? `(${p.kopyaSayisi} Kopya)` : ""}
                  </option>
                ))}
                {printers.length === 0 && <option value="">Sistem Varsayılan Yazıcısı</option>}
              </Form.Select>
              {resolvedResult?.sourceLabel && (
                <span className="badge bg-secondary bg-opacity-10 text-secondary border px-1.5 py-1" style={{ fontSize: "9.5px" }}>
                  {resolvedResult.sourceLabel}
                </span>
              )}
            </div>

            <div className="btn-group btn-group-sm" role="group">
              <button type="button" className={`btn ${printType === "POS" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setPrintType("POS")}>
                <IconReceipt size={14} className="me-1" />
                80mm POS
              </button>
              <button type="button" className={`btn ${printType === "A4" ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setPrintType("A4")}>
                <IconFileText size={14} className="me-1" />
                A4 Belge
              </button>
            </div>
            <Button variant="success" size="sm" onClick={() => handlePrint()} disabled={!fis || isPrinting} className="px-3 fw-bold">
              {isPrinting ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-1" />
                  Yazdırılıyor...
                </>
              ) : (
                <>
                  <IconPrinter size={15} className="me-1" />
                  Yazdır (F10{toplamFisSayisi > 1 ? ` - ${toplamFisSayisi} Fiş` : ""})
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-3 bg-secondary bg-opacity-10" style={{ maxHeight: "75vh", overflow: "auto" }}>
        <SablonluFisOnizleme fis={fis} hata={hata} />
      </Modal.Body>

      <Modal.Footer className="bg-light py-2 px-3 border-top d-print-none">
        <div className="d-flex justify-content-between w-100 align-items-center">
          <small className="text-muted">
            Kısayol: <kbd>F10</kbd> veya <kbd>F8</kbd> Yazdır | <kbd>ESC</kbd> Kapat
          </small>
          <div className="d-flex gap-2">
            <Button variant="outline-secondary" size="sm" onClick={onHide} disabled={isPrinting}>
              <IconX size={15} className="me-1" />
              Kapat (ESC)
            </Button>
            <Button variant="primary" size="sm" onClick={() => handlePrint()} disabled={!fis || isPrinting}>
              {isPrinting ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-1" />
                  Yazdırılıyor...
                </>
              ) : (
                <>
                  <IconPrinter size={15} className="me-1" />
                  Yazdır (F10{toplamFisSayisi > 1 ? ` - ${toplamFisSayisi} Fiş` : ""})
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default SarrafFisiPrintModal;

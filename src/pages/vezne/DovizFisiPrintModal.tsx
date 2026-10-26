import React, { useEffect, useState, useRef, useCallback } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { IconPrinter, IconX } from "@tabler/icons-react";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { resolveEffectivePrinter, ResolvedPrinterResult } from "../../utils/printerResolver";
import { useAuth } from "../../context/AuthContext";
import { dovizFisHtml, dovizFisleriHtml, type FisHtml } from "../../utils/belgeSablon/fisCikti";
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
  kmv?: number | string;
  kmvOrani?: number | string;
  komisyon?: number | string;
  seriNo?: string;
  belgeNo?: string;
  ettn?: string;
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
  isArbitraj?: boolean;
  gelisNedeni?: string;
  lines: PrintLineItem[];
  toplamTutar?: number;
  totalMasraf?: number;
  sonToplam?: number;
  odemeTutari?: number;
  bsmvTutari?: number;
  kmvTutari?: number;
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
  const isSatis = Number(tip) === 1;
  const { user } = useAuth();
  const [printers, setPrinters] = useState<YaziciItem[]>([]);
  const [systemPrinters, setSystemPrinters] = useState<{ name: string; isDefault?: boolean }[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | string | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ResolvedPrinterResult | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;

  const { fis, hata } = useSablonluFis(show, "doviz", () => {
    const { show: _s, onHide: _o, autoPrint: _a, vezne: _v, ...girdi } = propsRef.current;
    return dovizFisleriHtml(girdi);
  });

  // Load printers and resolve effective printer based on vezne/user/tip
  useEffect(() => {
    if (!show) return;
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

        const resolved = resolveEffectivePrinter({ pageType: "doviz", tip, vezne, user, printers: dbList });
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
      });
  }, [show, tip, vezne, user]);

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
          <title>e-Döviz Fişi</title>
          <style>
            @page {
              size: 80mm auto;
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
              display: flex;
              justify-content: center;
            }
            .belge-sablon {
              margin: 0 auto !important;
              transform: scale(0.95);
              transform-origin: top center;
              box-sizing: border-box !important;
            }
          </style>
        </head>
        <body>
          <div class="pos-print-root">${fullHtml}</div>
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
  }, [fis]);

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

      const res = await fisiYazdir(hazir, {
        printerId: selectedDbPrinter ? selectedDbPrinter.id : null,
        printerName: targetPrinterName,
        copies: 1,
        isPos: true,
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
  }, [fis, isPrinting, selectedPrinterId, printers, systemPrinters, resolvedResult, onHide, handleBrowserPrint]);

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
      if (e.key === "Enter" || e.key === "F8" || e.key === "F9" || e.key === "F10") {
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
    <Modal
      show={show && (!autoPrint || !!hata)}
      onHide={onHide}
      size="lg"
      centered
      backdrop="static"
      style={{ zIndex: 1070 }}
    >
      <Modal.Header closeButton className="bg-light py-2 px-3">
        <div className="d-flex align-items-center justify-content-between w-100 me-2 flex-wrap gap-2">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2 mb-0">
            <IconPrinter size={18} className="text-primary" />
            <span>
              e-Döviz Fişi ({props.isArbitraj ? `ARBİTRAJ ${isSatis ? "SATIŞ BELGESİ" : "ALIM BELGESİ"}` : (isSatis ? "SATIŞ BELGESİ" : "ALIM BELGESİ")} - 80mm)
            </span>
            {toplamFisSayisi > 1 && (
              <span className="badge bg-primary ms-1 fs-xs px-2 py-0.5">
                {toplamFisSayisi} Fiş
              </span>
            )}
            {!props.fisId && (
              <span className="badge bg-warning text-dark border border-warning-subtle fw-bold ms-1" style={{ fontSize: "11px" }}>
                Teklif (Kayıtsız)
              </span>
            )}
          </Modal.Title>
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
                <span className="badge bg-secondary bg-opacity-10 text-secondary border px-2 py-1" style={{ fontSize: "10px" }}>
                  {resolvedResult.sourceLabel}
                </span>
              )}
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
              Tarayıcı
            </Button>
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
        <div className="d-flex gap-2">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handleBrowserPrint}
            disabled={!fis || isPrinting}
            title="Google Chrome / Tarayıcı Yazdırma Penceresi"
          >
            <IconPrinter size={14} className="me-1" />
            Tarayıcıdan Yazdır
          </Button>
          <Button variant="primary" size="sm" onClick={() => handlePrint()} disabled={!fis || isPrinting} className="d-flex align-items-center gap-1 px-4 fw-bold shadow-xs">
            {isPrinting ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-1" />
                Yazdırılıyor...
              </>
            ) : (
              <>
                <IconPrinter size={16} /> Yazdır (F10{toplamFisSayisi > 1 ? ` - ${toplamFisSayisi} Fiş` : ""})
              </>
            )}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};


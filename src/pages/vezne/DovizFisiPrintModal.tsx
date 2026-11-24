import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import { IconPrinter, IconX, IconBrandWhatsapp, IconAlertTriangle } from "@tabler/icons-react";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { resolveEffectivePrinter, ResolvedPrinterResult } from "../../utils/printerResolver";
import { useAuth } from "../../context/AuthContext";
import { dovizFisHtml, dovizFisleriHtml, type FisHtml } from "../../utils/belgeSablon/fisCikti";
import { fisiYazdir } from "../../utils/belgeSablon/yazdir";
import { SablonluFisOnizleme, useSablonluFis } from "../../components/belge/SablonluFisOnizleme";
import { BelgeService } from "../../services/belgeService";
import { shareReceiptVisualOrPdfToWhatsApp, buildDovizWhatsAppMessage } from "../../utils/whatsAppMessageBuilder";

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
  detayTelefonNo?: string;
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
  alinanPara?: number;
  paraUstu?: number;
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
  // PrinterAgent hatası yutulmaz: pencere açık kalır, mesaj görünür (ortak alan denetimi 19.11.2026, #38)
  const [yazdirHatasi, setYazdirHatasi] = useState<string | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const pdfBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!show) { pdfBlobRef.current = null; return; }
    const { show: _s, onHide: _o, autoPrint: _a, vezne: _v, ...girdi } = propsRef.current;
    BelgeService.onizlemePdfBlob("doviz", girdi, "80")
      .then((b) => { pdfBlobRef.current = b; })
      .catch(() => {});
  }, [show]);

  const isFisEmpty = !props.lines || props.lines.length === 0;

  const handleWhatsAppPdfShare = useCallback(async () => {
    if (isFisEmpty) {
      alert("Boş fiş paylaşılamaz! Fişte veri bulunmamaktadır.");
      return;
    }
    setIsSharingPdf(true);
    const docNo = props.belgeNo || props.seriNo || (props.fisId ? `DOV-${props.fisId}` : "doviz_fisi");
    const cached = pdfBlobRef.current;

    const { show: _s, onHide: _o, autoPrint: _a, vezne: _v, ...girdi } = propsRef.current;
    const pdfPromise = cached
      ? Promise.resolve(cached)
      : BelgeService.onizlemePdfBlob("doviz", girdi, "80")
          .catch(async () => {
            if (props.fisId || props.belgeNo) {
              const res = await BelgeService.pdfBlobUrl({
                fisId: props.fisId,
                belgeNo: props.belgeNo || props.seriNo,
                bicim: "80",
              });
              if (res?.url) {
                const r = await fetch(res.url);
                return await r.blob();
              }
            }
            return null;
          });

    try {
      await shareReceiptVisualOrPdfToWhatsApp({
        elementId: "sablonlu-fis-icerik",
        pdfBlob: cached,
        pdfPromise,
        fileName: docNo,
        phone: props.detayTelefonNo,
        message: buildDovizWhatsAppMessage(props),
      });
    } finally {
      setIsSharingPdf(false);
    }
  }, [props.fisId, props.belgeNo, props.seriNo, props.detayTelefonNo]);

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
    if (isFisEmpty) {
      alert("Boş fiş yazdırılamaz! Fişte veri bulunmamaktadır.");
      return;
    }
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
              padding: 4px 0 0 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              box-sizing: border-box;
            }
            .belge-sablon {
              margin: 0 auto !important;
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

  const handlePrint = useCallback(async (hazir: FisHtml | FisHtml[] | null = fis): Promise<boolean> => {
    if (isFisEmpty) {
      alert("Boş fiş yazdırılamaz! Fişte veri bulunmamaktadır.");
      return false;
    }
    if (!hazir || isPrinting) return false;
    setIsPrinting(true);
    setYazdirHatasi(null);
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
        return true;
      }
      // Hata olunca pencere kapanmaz; mesaj gösterilir, "Tarayıcıdan Yazdır" önerilir (ortak alan denetimi 19.11.2026, #38)
      setYazdirHatasi(res.message || "Fiş yazıcıya gönderilemedi.");
      return false;
    } catch (e: any) {
      setYazdirHatasi(e?.message || "Fiş yazıcıya gönderilemedi.");
      return false;
    } finally {
      setIsPrinting(false);
    }
  }, [fis, isPrinting, selectedPrinterId, printers, systemPrinters, resolvedResult, onHide, handleBrowserPrint]);

  // F10 / doğrudan yazdırma: fiş hazır olunca yazdır ve kapat; hata olursa pencere açık kalır, hata görünür.
  const otomatikBasildi = useRef(false);
  useEffect(() => { if (!show) { otomatikBasildi.current = false; setYazdirHatasi(null); } }, [show]);
  useEffect(() => {
    if (!show || !autoPrint || otomatikBasildi.current) return;
    if (fis) {
      otomatikBasildi.current = true;
      // Başarıda handlePrint kapatır; başarısızlıkta pencere hata ile açılır (#38)
      // Boş fiş otomatik yazdırılamaz: görünmez pencere açık kalmasın, kapanır (hata kutusu yalnız yazıcı hatasında açılır)
    void handlePrint(fis).then((basildi) => { if (!basildi && isFisEmpty) onHide(); });
    }
  }, [show, autoPrint, fis, handlePrint, isFisEmpty, onHide]);

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
      show={show && (!autoPrint || !!hata || !!yazdirHatasi)}
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
              e-Döviz Fişi ({props.isArbitraj ? (toplamFisSayisi > 1 ? "DÖVİZ & ARBİTRAJ" : "ARBİTRAJ") : (isSatis ? "SATIŞ BELGESİ" : "ALIM BELGESİ")} - 80mm)
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
                        {/* "(N Kopya)" etiketi kaldırıldı: her belge nolu fiş 1 kopya basılır (ortak alan denetimi 19.11.2026, #40) */}
                        {p.ad || p.cihazAdi || `Yazıcı #${p.id}`}
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
              disabled={!fis || isPrinting || isFisEmpty}
              className="px-2.5 fw-bold"
              title="Google Chrome / Tarayıcı Önizleme Penceresi ile Yazdır"
            >
              <IconPrinter size={14} className="me-1" />
              Tarayıcı
            </Button>

            <Button
              variant="success"
              size="sm"
              onClick={handleWhatsAppPdfShare}
              disabled={!fis || isPrinting || isSharingPdf || isFisEmpty}
              className="d-inline-flex align-items-center justify-content-center p-0 rounded-circle shadow-xs"
              style={{
                backgroundColor: "#25D366",
                borderColor: "#25D366",
                width: "30px",
                height: "30px",
                minWidth: "30px",
              }}
              title="PDF Olarak WhatsApp ile Gönder"
              aria-label="PDF Olarak WhatsApp ile Gönder"
            >
              {isSharingPdf ? (
                <Spinner size="sm" animation="border" style={{ width: 14, height: 14 }} />
              ) : (
                <IconBrandWhatsapp size={18} className="text-white" />
              )}
            </Button>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="p-3" style={{ backgroundColor: "#525659", overflow: "auto" }}>
        {isFisEmpty && (
          <div className="alert alert-warning py-2 px-3 mb-3 d-flex align-items-center" role="alert">
            <IconAlertTriangle size={18} className="me-2 text-warning flex-shrink-0" />
            <div><strong>Uyarı:</strong> Fişte herhangi bir veri veya döviz kalemi bulunmamaktadır. Boş fiş yazdırılamaz.</div>
          </div>
        )}
        {yazdirHatasi && (
          <Alert variant="danger" className="mb-3 py-2 small" dismissible onClose={() => (autoPrint ? onHide() : setYazdirHatasi(null))}>
            <div className="fw-bold">Fiş yazıcıya gönderilemedi.</div>
            <div>{yazdirHatasi}</div>
            <div className="mt-1 d-flex align-items-center gap-2 flex-wrap">
              <span>Yazıcı köprüsünü (PrinterAgent) kontrol edip yeniden deneyin ya da tarayıcıdan yazdırın.</span>
              <Button variant="outline-danger" size="sm" className="py-0" onClick={handleBrowserPrint} disabled={!fis}>
                <IconPrinter size={13} className="me-1" />
                Tarayıcıdan Yazdır
              </Button>
            </div>
          </Alert>
        )}
        <SablonluFisOnizleme fis={fis} hata={hata} />
      </Modal.Body>

      <Modal.Footer className="bg-light py-2 px-3 d-flex justify-content-between align-items-center">
        <div className="d-flex align-items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onHide} disabled={isPrinting} className="d-flex align-items-center gap-1">
            <IconX size={15} /> Kapat
          </Button>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={handleBrowserPrint}
            disabled={!fis || isPrinting || isFisEmpty}
            title="Google Chrome / Tarayıcı Yazdırma Penceresi"
          >
            <IconPrinter size={14} className="me-1" />
            Tarayıcıdan Yazdır
          </Button>
          <Button variant="primary" size="sm" onClick={() => handlePrint()} disabled={!fis || isPrinting || isFisEmpty} className="d-flex align-items-center gap-1 px-4 fw-bold shadow-xs">
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


import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Modal, Button, Form, Spinner, Alert } from "react-bootstrap";
import { IconPrinter, IconX, IconReceipt, IconFileText, IconBrandWhatsapp, IconAlertTriangle } from "@tabler/icons-react";
import { PrinterService, YaziciItem } from "../../services/printerService";
import { resolveEffectivePrinter, ResolvedPrinterResult } from "../../utils/printerResolver";
import { useAuth } from "../../context/AuthContext";
import { sarrafFisHtml, type FisHtml } from "../../utils/belgeSablon/fisCikti";
import { fisiYazdir } from "../../utils/belgeSablon/yazdir";
import { SablonluFisOnizleme, useSablonluFis } from "../../components/belge/SablonluFisOnizleme";
import { BelgeService } from "../../services/belgeService";
import { shareReceiptVisualOrPdfToWhatsApp, buildSarrafWhatsAppMessage } from "../../utils/whatsAppMessageBuilder";

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
  const [systemPrinters, setSystemPrinters] = useState<{ name: string; isDefault?: boolean }[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<number | string | null>(null);
  const [resolvedResult, setResolvedResult] = useState<ResolvedPrinterResult | null>(null);
  const [yaziciHazir, setYaziciHazir] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  // PrinterAgent hatası yutulmaz: pencere açık kalır, mesaj görünür (ortak alan denetimi 19.11.2026, #38)
  const [yazdirHatasi, setYazdirHatasi] = useState<string | null>(null);
  const isSatis = Number(tip) === 1;
  const isTeklif = !props.fisId;
  const fisTuruBaslik = isSatis
    ? (isTeklif ? "SARRAF SATIŞ FİŞİ (TEKLİF)" : "SARRAF SATIŞ FİŞİ")
    : (isTeklif ? "SARRAF ALIŞ FİŞİ (TEKLİF)" : "SARRAF ALIŞ FİŞİ");
  const propsRef = useRef(props);
  propsRef.current = props;

  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const pdfBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!show) { pdfBlobRef.current = null; return; }
    const { show: _s, onHide: _o, autoPrint: _a, ...girdi } = propsRef.current;
    BelgeService.onizlemePdfBlob("sarraf", girdi, printType === "A4" ? "A4" : "80")
      .then((b) => { pdfBlobRef.current = b; })
      .catch(() => {});
  }, [show, printType]);

  const handleWhatsAppPdfShare = useCallback(async () => {
    setIsSharingPdf(true);
    const docNo = props.belgeNo || props.seriNo || (props.fisId ? `FIS-${props.fisId}` : "sarraf_fisi");
    
    // Önceden hazır olan PDF varsa hemen kullan, yoksa arka planda üret
    const cached = pdfBlobRef.current;
    const { show: _s, onHide: _o, autoPrint: _a, ...girdi } = propsRef.current;
    const pdfPromise = cached
      ? Promise.resolve(cached)
      : BelgeService.onizlemePdfBlob("sarraf", girdi, printType === "A4" ? "A4" : "80")
          .catch(async () => {
            if (props.fisId || props.belgeNo) {
              const res = await BelgeService.pdfBlobUrl({
                fisId: props.fisId,
                belgeNo: props.belgeNo || props.seriNo,
                bicim: printType === "A4" ? "a4" : "80",
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
        message: buildSarrafWhatsAppMessage(props),
      });
    } finally {
      setIsSharingPdf(false);
    }
  }, [props.fisId, props.belgeNo, props.seriNo, props.detayTelefonNo, printType]);

  useEffect(() => {
    if (!show) { setYaziciHazir(false); return; }
    
    // Hem sunucu yazıcılarını hem bu bilgisayara bağlı gerçek yazıcıları yükle
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

        const resolved = resolveEffectivePrinter({ pageType: "sarraf", tip, vezne, user, printers: dbList });
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

        // Açılışta Windows varsayılan yazıcısını hemen bu yazıcı ile eşitle (Chrome Ctrl+P'nin doğrudan bu yazıcıyı seçmesi için)
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

  // Kâğıt türü yazıcıdan belli olunca (ve kullanıcı değiştirdikçe) şablondan üretilir; bütün satırlar tek fişte.
  const { fis, hata } = useSablonluFis(show && yaziciHazir, printType, () => {
    const { show: _s, onHide: _o, autoPrint: _a, vezne: _v, ...girdi } = propsRef.current;
    return sarrafFisHtml(girdi, printType === "POS" ? "80" : "A4");
  });

  const handlePrinterChange = (newVal: string) => {
    setSelectedPrinterId(newVal || null);
    if (!newVal) return;

    // Terminal yerel hafızasına kaydet
    const matchedSys = systemPrinters.find((p) => p.name.toLowerCase() === newVal.toLowerCase());
    const matchedDb = printers.find((p) => String(p.id) === newVal || p.cihazAdi === newVal || p.ad === newVal);
    const pName = matchedSys?.name || matchedDb?.cihazAdi || matchedDb?.ad || newVal;

    PrinterService.saveClientPrinter({ name: pName }, user?.id);

    // printercekmeApp varsayılan yazıcısını güncelle
    fetch("http://127.0.0.1:9100/api/set-default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printerName: pName }),
    }).catch(() => {});
  };

  const isFisEmpty = !props.satirlar || props.satirlar.length === 0;

  // Tarayıcı üzerinden yerel yazdırma (Google Chrome Ctrl+P penceresi)
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
          <title>${fisTuruBaslik}</title>
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
              ${printType === "POS" ? "display: flex; justify-content: center;" : ""}
            }
            .belge-sablon {
              margin: 0 auto !important;
              ${printType === "POS" ? "transform: scale(0.95); transform-origin: top center; box-sizing: border-box !important;" : ""}
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
  }, [fis, fisTuruBaslik, printType]);

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
        isPos: printType === "POS",
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
  }, [fis, isPrinting, selectedPrinterId, printers, systemPrinters, resolvedResult, printType, onHide, handleBrowserPrint]);
  // Doğrudan yazdırma: fiş hazır olunca yazdır ve kapat; hata olursa pencere açılır, hata görünür.
  const otomatikBasildi = useRef(false);
  useEffect(() => { if (!show) { otomatikBasildi.current = false; setYazdirHatasi(null); } }, [show]);
  useEffect(() => {
    if (!show || !autoPrint || otomatikBasildi.current || !fis) return;
    otomatikBasildi.current = true;
    // Başarıda handlePrint kapatır; başarısızlıkta pencere hata ile açılır (#38)
    // Boş fiş otomatik yazdırılamaz: görünmez pencere açık kalmasın, kapanır (hata kutusu yalnız yazıcı hatasında açılır)
    void handlePrint(fis).then((basildi) => { if (!basildi && isFisEmpty) onHide(); });
  }, [show, autoPrint, fis, handlePrint, isFisEmpty, onHide]);

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
    <Modal show={show && (!autoPrint || !!hata || !!yazdirHatasi)} onHide={onHide} size="lg" centered className="sarraf-print-modal">
      <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom d-print-none">
        <div className="d-flex align-items-center justify-content-between w-100 me-2 flex-wrap gap-2">
          <div className="d-flex align-items-center gap-2">
            <IconReceipt size={20} className="text-primary" />
            <h6 className="mb-0 fw-bold d-flex align-items-center">
              {fisTuruBaslik}
              {toplamFisSayisi > 1 && (
                <span className="badge bg-primary ms-2 fs-xs px-2 py-0.5">
                  {toplamFisSayisi} Fiş
                </span>
              )}
              {isTeklif && (
                <span className="badge bg-warning text-dark border border-warning-subtle fw-bold ms-2" style={{ fontSize: "11px" }}>
                  Teklif (Kayıtsız)
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

            <Button variant="success" size="sm" onClick={() => handlePrint()} disabled={!fis || isPrinting || isFisEmpty} className="px-3 fw-bold">
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

            <Button
              variant="success"
              size="sm"
              onClick={handleWhatsAppPdfShare}
              disabled={!fis || isPrinting || isSharingPdf}
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

      <Modal.Body className="p-3 bg-secondary bg-opacity-10" style={{ maxHeight: "75vh", overflow: "auto" }}>
        {isFisEmpty && (
          <div className="alert alert-warning py-2 px-3 mb-3 d-flex align-items-center" role="alert">
            <IconAlertTriangle size={18} className="me-2 text-warning flex-shrink-0" />
            <div><strong>Uyarı:</strong> Fişte herhangi bir veri veya kalem bulunmamaktadır. Boş fiş yazdırılamaz.</div>
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

      <Modal.Footer className="bg-light py-2 px-3 border-top d-print-none">
        <div className="d-flex justify-content-between w-100 align-items-center">
          <small className="text-muted">
            Kısayol: <kbd>F10</kbd> veya <kbd>F8</kbd> Yazdır | <kbd>ESC</kbd> Kapat
          </small>
          <div className="d-flex gap-2 align-items-center">
            <Button variant="outline-secondary" size="sm" onClick={onHide} disabled={isPrinting}>
              <IconX size={15} className="me-1" />
              Kapat (ESC)
            </Button>
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
            <Button variant="primary" size="sm" onClick={() => handlePrint()} disabled={!fis || isPrinting || isFisEmpty}>
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

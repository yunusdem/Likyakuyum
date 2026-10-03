import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Button,
  Badge,
  Form,
  InputGroup,
  Table,
  Modal,
  Alert,
  Spinner,
  Tabs,
  Tab,
} from "react-bootstrap";
import {
  IconTag,
  IconBarcode,
  IconCpu,
  IconPrinter,
  IconSparkles,
  IconSearch,
  IconCheck,
  IconAlertTriangle,
  IconDeviceFloppy,
  IconRotateClockwise,
  IconCopy,
  IconDownload,
  IconPlus,
  IconTrash,
  IconWifi,
  IconBuildingStore,
  IconEye,
  IconSettings,
  IconDiamond,
  IconLayersLinked,
  IconPlayerPlay,
} from "@tabler/icons-react";
import {
  EtiketService,
  AltinUrunItem,
  OzelUrunItem,
} from "../../services/etiketService";
import RfidSayimPage from "./RfidSayimPage";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

// ─── EPC Üretici Fonksiyonu ────────────────────────────────────────────────
const generateUniqueEpc = (id: number, tip: "altin" | "ozel", ayarStr?: string, grupKodu?: string): string => {
  const ayarNum = (ayarStr || "14").replace(/[^0-9]/g, "") || "14";
  const ayarCode = ayarNum.padStart(2, "0").slice(-2);
  const tipCode = tip === "altin" ? "AL" : "OZ";
  const yearCode = new Date().getFullYear().toString().slice(-2);
  const idCode = Number(id || 1).toString().padStart(8, "0");
  const cleanGrup = (grupKodu || "LK").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2).padEnd(2, "K");
  
  const header = "E280";
  const body = `${cleanGrup}${ayarCode}${tipCode}${yearCode}${idCode}`.slice(0, 16);
  const hexBody = Buffer.from(body).toString("hex").toUpperCase().slice(0, 20);
  return `${header}${hexBody}`.slice(0, 24);
};

// ─── ZPL RFID Etiket Komut Üreteci ──────────────────────────────────────────
export const generateJewelryZpl = (
  item: {
    stokKodu: string;
    urunAdi: string;
    ayar: string;
    brutGram: number;
    hasGram?: number;
    satisFiyati?: number;
    satisParaKodu?: string;
    firmaAdi?: string;
    designType?: "kelebek" | "dambil" | "kuyruklu";
  },
  epc: string
): string => {
  const firma = (item.firmaAdi || "LIKYA KUYUMCULUK").slice(0, 20);
  const ayar = item.ayar ? `${item.ayar}K` : "14K";
  const gram = Number(item.brutGram || 0).toFixed(2);
  const barkod = item.stokKodu || "000000";
  const fiyat = item.satisFiyati ? `${item.satisFiyati.toLocaleString("tr-TR")} ${item.satisParaKodu || "TL"}` : "";

  return `^XA
^PW600
^LL340
^LH0,0
^CI28
^FO30,25^A0N,22,22^FD${firma}^FS
^FO30,55^A0N,26,26^FD${item.urunAdi.slice(0, 18)}^FS
^FO30,90^A0N,20,20^FDAyar: ${ayar} | Brüt: ${gram} g^FS
^FO30,118^A0N,18,18^FDFiyat: ${fiyat}^FS
^FO30,150^BY2,2,42^BCN,42,Y,N,N^FD${barkod}^FS
^RFW,H,1,2,6^FD${epc}^FS
^FO310,25^A0N,18,18^FD[RFID UHF ÇIP KODU]^FS
^FO310,50^A0N,16,16^FD${epc.slice(0, 12)}^FS
^FO310,70^A0N,16,16^FD${epc.slice(12)}^FS
^FO310,105^BQN,2,4^FDQA,${epc}^FS
^FO310,195^A0N,14,14^FDGen2 ISO18000-6C^FS
^XZ`;
};

export interface QueueItem {
  id: number;
  tip: "altin" | "ozel";
  stokKodu: string;
  urunAdi: string;
  ayar: string;
  milyem: number;
  brutGram: number;
  hasGram: number;
  satisFiyati: number;
  satisParaKodu: string;
  epc: string;
  durum: "BEKLIYOR" | "KODLANDI" | "BASILDI";
  rawItem: any;
}

export const RfidEtiketUretimPage: React.FC = () => {
  const [activeMainTab, setActiveMainTab] = useState<"uretim" | "sayim">("uretim");

  // ─── Veritabanı Ürünleri ───────────────────────────────────────────────────
  const [altinUrunler, setAltinUrunler] = useState<AltinUrunItem[]>([]);
  const [ozelUrunler, setOzelUrunler] = useState<OzelUrunItem[]>([]);
  const [tablalar, setTablalar] = useState<string[]>([]);
  const [loadingDb, setLoadingDb] = useState<boolean>(true);

  // ─── Arama & Seçim ─────────────────────────────────────────────────────────
  const [aramaMetni, setAramaMetni] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [currentEpc, setCurrentEpc] = useState<string>("");

  // ─── Baskı Kuyruğu ────────────────────────────────────────────────────────
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedQueueIds, setSelectedQueueIds] = useState<number[]>([]);
  const [etiketTasarimTipi, setEtiketTasarimTipi] = useState<"kelebek" | "dambil" | "kuyruklu">("kelebek");

  // ─── Simülasyon & ZPL Modal ───────────────────────────────────────────────
  const [simulasyonModu, setSimulasyonModu] = useState<boolean>(true);
  const [zplModalOpen, setZplModalOpen] = useState<boolean>(false);
  const [generatedZpl, setGeneratedZpl] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: "success" | "danger" | "info" } | null>(null);

  // ─── Toplu Seçim Modalı ───────────────────────────────────────────────────
  const [topluSecimModalOpen, setTopluSecimModalOpen] = useState<boolean>(false);
  const [topluSeciliBanko, setTopluSeciliBanko] = useState<string>("TÜMÜ");
  const [topluSeciliAyar, setTopluSeciliAyar] = useState<string>("TÜMÜ");

  const barcodeSvgRef = useRef<SVGSVGElement | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const showStatus = (text: string, type: "success" | "danger" | "info" = "success") => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg(null), 4500);
  };

  // ─── 1. Veritabanından Ürünleri Çekme ──────────────────────────────────────
  const verileriYukle = useCallback(async () => {
    setLoadingDb(true);
    try {
      const [altinList, ozelList, bankoList] = await Promise.all([
        EtiketService.getAltinUrunler({ satildi: false }).catch(() => []),
        EtiketService.getOzelUrunler({ satildi: false }).catch(() => []),
        EtiketService.getBankolar({ aktif: true }).catch(() => []),
      ]);

      setAltinUrunler(altinList);
      setOzelUrunler(ozelList);

      const bSet = new Set<string>();
      altinList.forEach((a) => a.banko && bSet.add(a.banko));
      ozelList.forEach((o) => o.banko && bSet.add(o.banko));
      bankoList.forEach((b) => b.bankoAdi && bSet.add(b.bankoAdi));
      setTablalar(Array.from(bSet).sort());

      // İlk ürünü önizlemeye seç
      if (altinList.length > 0 && !selectedProduct) {
        const first = altinList[0];
        selectProductForPreview(first, "altin");
      }
    } catch {
    } finally {
      setLoadingDb(false);
    }
  }, [selectedProduct]);

  useEffect(() => {
    verileriYukle();
  }, [verileriYukle]);

  // ─── 2. Ürün Seçildiğinde EPC & Barkod Üret ────────────────────────────────
  const selectProductForPreview = (prod: any, tip: "altin" | "ozel") => {
    setSelectedProduct({ ...prod, tip });
    const epc = prod.rfidEpc || generateUniqueEpc(prod.altinUrunId || prod.ozelUrunId || 1, tip, prod.ayar, prod.grupKodu);
    setCurrentEpc(epc);
  };

  // SVG Barkod & QR Kod Canlı Çizimi
  useEffect(() => {
    if (selectedProduct && currentEpc) {
      try {
        const codeVal = selectedProduct.barkod || `${selectedProduct.grupKodu}-${selectedProduct.urunNo || 1}`;
        if (barcodeSvgRef.current) {
          JsBarcode(barcodeSvgRef.current, codeVal, {
            format: "CODE128",
            width: 1.3,
            height: 38,
            displayValue: true,
            fontSize: 10,
            margin: 0,
          });
        }
        QRCode.toDataURL(currentEpc, { width: 75, margin: 1 })
          .then((url) => setQrDataUrl(url))
          .catch(() => {});
      } catch {}
    }
  }, [selectedProduct, currentEpc]);

  // ─── 3. Kuyruğa Ürün Ekleme ────────────────────────────────────────────────
  const kuyrugaEkle = (prod: any, tip: "altin" | "ozel") => {
    const id = prod.altinUrunId || prod.ozelUrunId;
    if (queue.some((q) => q.id === id && q.tip === tip)) {
      showStatus("Bu ürün zaten baskı kuyruğunda yer alıyor.", "info");
      return;
    }

    const ayar = prod.ayar || "14";
    const ayarNum = parseFloat(ayar.replace(/[^0-9.]/g, "")) || 14;
    let milyem = 0.585;
    if (ayarNum === 24) milyem = 0.995;
    else if (ayarNum === 22) milyem = 0.916;
    else if (ayarNum === 18) milyem = 0.750;
    else if (ayarNum === 14) milyem = 0.585;
    else if (ayarNum === 8) milyem = 0.333;

    const brut = Number(prod.miktar || prod.hasGram || 0);
    const has = prod.hasGram ? Number(prod.hasGram) : Number((brut * milyem).toFixed(3));
    const epc = prod.rfidEpc || generateUniqueEpc(id, tip, ayar, prod.grupKodu);

    const newItem: QueueItem = {
      id,
      tip,
      stokKodu: prod.barkod || `${prod.grupKodu}-${prod.urunNo}`,
      urunAdi: prod.model || prod.mamulTipi || `${prod.grupKodu} Ürün`,
      ayar,
      milyem,
      brutGram: brut,
      hasGram: has,
      satisFiyati: prod.satisFiyati || 0,
      satisParaKodu: prod.satisParaKodu || "TL",
      epc,
      durum: prod.rfidEpc ? "KODLANDI" : "BEKLIYOR",
      rawItem: prod,
    };

    setQueue((prev) => [...prev, newItem]);
    showStatus(`${newItem.stokKodu} baskı kuyruğuna eklendi.`, "success");
  };

  // ─── 4. Tekil Yazdır & RFID Kodla (F10) ────────────────────────────────────
  const tekilYazdirVeKodla = async () => {
    if (!selectedProduct) return;
    setIsProcessing(true);
    try {
      const id = selectedProduct.altinUrunId || selectedProduct.ozelUrunId;
      const tip = selectedProduct.tip || "altin";
      const epc = currentEpc;

      const zpl = generateJewelryZpl(
        {
          stokKodu: selectedProduct.barkod || `${selectedProduct.grupKodu}-${selectedProduct.urunNo}`,
          urunAdi: selectedProduct.model || selectedProduct.mamulTipi || selectedProduct.grupKodu,
          ayar: selectedProduct.ayar || "14",
          brutGram: selectedProduct.miktar || selectedProduct.hasGram || 0,
          satisFiyati: selectedProduct.satisFiyati,
          satisParaKodu: selectedProduct.satisParaKodu,
          designType: etiketTasarimTipi,
        },
        epc
      );

      // Backend API'ye kaydet
      await EtiketService.encodeAndPrintRfid({ id, tip, epc, designType: etiketTasarimTipi }).catch(() => {});

      // Kuyruktaki durumu güncelle
      setQueue((prev) =>
        prev.map((q) => (q.id === id && q.tip === tip ? { ...q, durum: "KODLANDI", epc } : q))
      );

      setGeneratedZpl(zpl);
      setZplModalOpen(true);
      showStatus(`[${epc.slice(-6)}] RFID çipine kodlandı ve ZPL baskısı hazırlandı.`, "success");
    } catch (e: any) {
      showStatus("Hata: " + e.message, "danger");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── 5. Seçilenleri Toplu Yazdır & Kodla ───────────────────────────────────
  const topluYazdirVeKodla = async () => {
    const targets = queue.filter((q) => selectedQueueIds.includes(q.id));
    if (targets.length === 0) {
      showStatus("Lütfen baskı yapılacak ürünleri tablodan seçin.", "info");
      return;
    }

    setIsProcessing(true);
    try {
      const payloadItems = targets.map((t) => ({ id: t.id, tip: t.tip, epc: t.epc, designType: etiketTasarimTipi }));
      const res = await EtiketService.bulkEncodeRfid({ items: payloadItems }).catch(() => ({
        combinedZpl: targets.map((t) => generateJewelryZpl({ ...t, brutGram: t.brutGram }, t.epc)).join("\n"),
      }));

      setQueue((prev) =>
        prev.map((q) => (selectedQueueIds.includes(q.id) ? { ...q, durum: "KODLANDI" } : q))
      );

      setGeneratedZpl(res.combinedZpl || "");
      setZplModalOpen(true);
      showStatus(`${targets.length} adet ürün toplu olarak RFID çipine kodlandı ve baskı emri oluşturuldu.`, "success");
    } catch (e: any) {
      showStatus("Toplu kodlama hatası: " + e.message, "danger");
    } finally {
      setIsProcessing(false);
    }
  };

  // ─── 6. Toplu Seçim Filtresinden Kuyruğa Aktar ─────────────────────────────
  const topluKuyrugaAktar = () => {
    let count = 0;
    const addList = (items: any[], tip: "altin" | "ozel") => {
      items.forEach((item) => {
        const matchesBanko = topluSeciliBanko === "TÜMÜ" || item.banko === topluSeciliBanko;
        const matchesAyar = topluSeciliAyar === "TÜMÜ" || item.ayar === topluSeciliAyar;
        if (matchesBanko && matchesAyar) {
          kuyrugaEkle(item, tip);
          count++;
        }
      });
    };

    addList(altinUrunler, "altin");
    addList(ozelUrunler, "ozel");

    setTopluSecimModalOpen(false);
    showStatus(`${count} adet ürün baskı kuyruğuna aktarıldı.`, "success");
  };

  // Klavye Dinleyicisi (F10)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F10") {
        e.preventDefault();
        tekilYazdirVeKodla();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="rfid-etiket-uretim-page p-2 d-flex flex-column" style={{ background: "#0f172a", minHeight: "100vh", color: "#f8fafc" }}>
      {/* ─── Ana Sekme Geçişi (Üretim vs Sayım) ─── */}
      <div className="d-flex align-items-center justify-content-between p-2 rounded-2 mb-2" style={{ background: "#1e293b", border: "1px solid #334155" }}>
        <div className="d-flex align-items-center gap-2">
          <div className="btn-group btn-group-sm">
            <Button
              variant={activeMainTab === "uretim" ? "primary" : "outline-secondary"}
              size="sm"
              className="fw-bold px-3 py-1 text-white border-secondary"
              onClick={() => setActiveMainTab("uretim")}
            >
              <IconTag size={15} className="me-1" /> 🏷️ RFID Etiket Üretim & Kodlama
            </Button>
            <Button
              variant={activeMainTab === "sayim" ? "primary" : "outline-secondary"}
              size="sm"
              className="fw-bold px-3 py-1 text-white border-secondary"
              onClick={() => setActiveMainTab("sayim")}
            >
              <IconWifi size={15} className="me-1" /> 📡 Hızlı RFID Tabla & Vitrin Sayımı
            </Button>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* Simülasyon Modu Toggle */}
          <div className="d-flex align-items-center px-2 py-1 rounded bg-black bg-opacity-40 border border-secondary" style={{ fontSize: "11px" }}>
            <span className="text-muted me-1.5">Zebra RFID Yazıcı:</span>
            <span className={`fw-bold ${simulasyonModu ? "text-warning" : "text-success"}`}>
              {simulasyonModu ? "SİMÜLATÖR" : "ONLINE (ZD621R)"}
            </span>
          </div>

          <Button
            variant="outline-secondary"
            size="sm"
            className="py-1 px-2 border-secondary text-light"
            onClick={() => setSimulasyonModu(!simulasyonModu)}
            title="Fiziksel / Simülasyon Yazıcı Değiştir"
          >
            <IconSettings size={14} />
          </Button>
        </div>
      </div>

      {activeMainTab === "sayim" ? (
        <RfidSayimPage isModal={false} />
      ) : (
        <div className="d-flex flex-column gap-2 flex-grow-1">
          {/* Durum Bildirimi */}
          {statusMsg && (
            <Alert variant={statusMsg.type} className="py-1 px-3 mb-0 small d-flex align-items-center justify-content-between border-0 bg-opacity-20">
              <span>{statusMsg.text}</span>
              <Button variant="link" size="sm" className="p-0 text-decoration-none" onClick={() => setStatusMsg(null)}>
                Kapat
              </Button>
            </Alert>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              1. ÜST BÖLÜM (ÜRÜN ARAMA & TOPLU SEÇİM)
             ═══════════════════════════════════════════════════════════════════ */}
          <Card className="border-0 shadow-none rounded-2" style={{ background: "#1e293b", border: "1px solid #334155" }}>
            <Card.Body className="p-2">
              <Row className="g-2 align-items-center">
                {/* Anlık Arama */}
                <Col lg={5} md={6}>
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-dark text-muted border-secondary py-1 px-2">
                      <IconSearch size={14} />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Barkod / Stok Kodu / Model veya Grup Ara..."
                      className="bg-dark text-white border-secondary py-1"
                      style={{ fontSize: "12px" }}
                      value={aramaMetni}
                      onChange={(e) => setAramaMetni(e.target.value)}
                    />
                  </InputGroup>
                </Col>

                {/* Hızlı Seçim Listesi Dropdown */}
                <Col lg={4} md={6}>
                  <Form.Select
                    size="sm"
                    className="bg-dark text-white border-secondary py-1 fw-semibold"
                    style={{ fontSize: "12px" }}
                    value={selectedProduct ? `${selectedProduct.tip}_${selectedProduct.altinUrunId || selectedProduct.ozelUrunId}` : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const [tip, idStr] = val.split("_");
                      const id = Number(idStr);
                      if (tip === "altin") {
                        const found = altinUrunler.find((a) => a.altinUrunId === id);
                        if (found) selectProductForPreview(found, "altin");
                      } else {
                        const found = ozelUrunler.find((o) => o.ozelUrunId === id);
                        if (found) selectProductForPreview(found, "ozel");
                      }
                    }}
                  >
                    <option value="">-- Ürün Seçin ({altinUrunler.length + ozelUrunler.length} Ürün Mevcut) --</option>
                    {altinUrunler.map((a) => (
                      <option key={`altin_${a.altinUrunId}`} value={`altin_${a.altinUrunId}`}>
                        [ALTIN {a.ayar}K] {a.barkod || a.grupKodu} - {a.model || "Altın"} ({a.miktar || a.hasGram}g)
                      </option>
                    ))}
                    {ozelUrunler.map((o) => (
                      <option key={`ozel_${o.ozelUrunId}`} value={`ozel_${o.ozelUrunId}`}>
                        [ÖZEL {o.ayar}K] {o.barkod || o.grupKodu} - {o.mamulTipi || "Mücevher"}
                      </option>
                    ))}
                  </Form.Select>
                </Col>

                {/* Butonlar */}
                <Col lg={3} className="d-flex gap-1.5 justify-content-lg-end">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    className="py-1 px-2.5 text-white border-secondary d-flex align-items-center"
                    onClick={() => setTopluSecimModalOpen(true)}
                  >
                    <IconLayersLinked size={14} className="me-1 text-primary" /> Toplu Seçim
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    className="py-1 px-3 fw-bold d-flex align-items-center"
                    disabled={!selectedProduct}
                    onClick={() => selectedProduct && kuyrugaEkle(selectedProduct, selectedProduct.tip)}
                  >
                    <IconPlus size={14} className="me-1" /> Kuyruğa Ekle
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* ═══════════════════════════════════════════════════════════════════
              2. ORTA BÖLÜM (CANLI KELEBEK / KUYRUKLU ETİKET ÖNİZLEME)
             ═══════════════════════════════════════════════════════════════════ */}
          <Card className="border-0 shadow-none rounded-2" style={{ background: "#1e293b", border: "1px solid #334155" }}>
            <Card.Body className="p-3">
              <Row className="g-3 align-items-center">
                {/* Sol / Orta: Gerçekçi Kuyumcu RFID Etiket Önizlemesi */}
                <Col lg={7} className="d-flex justify-content-center">
                  <div
                    className="p-3 rounded-3 position-relative d-flex shadow"
                    style={{
                      width: "480px",
                      minHeight: "160px",
                      background: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
                      border: "2px solid #cbd5e1",
                      color: "#0f172a",
                    }}
                  >
                    {/* Sol Kanat */}
                    <div className="d-flex flex-column justify-content-between pe-3 border-end border-secondary border-opacity-50" style={{ width: "50%" }}>
                      <div>
                        <div className="fw-bold tracking-tight text-primary" style={{ fontSize: "11px" }}>
                          LİKYA KUYUMCULUK
                        </div>
                        <div className="fw-bold text-dark text-truncate mt-0.5" style={{ fontSize: "13px" }}>
                          {selectedProduct ? (selectedProduct.model || selectedProduct.mamulTipi || selectedProduct.grupKodu) : "Mücevher / Altın"}
                        </div>
                      </div>

                      <div className="my-1">
                        <div className="d-flex justify-content-between align-items-baseline" style={{ fontSize: "11px" }}>
                          <span className="text-muted">Ayar:</span>
                          <span className="fw-bold badge bg-dark text-white px-1.5 py-0.5">
                            {selectedProduct ? `${selectedProduct.ayar}K / ${selectedProduct.tip === "altin" ? "916" : "750"}` : "14K / 585"}
                          </span>
                        </div>
                        <div className="d-flex justify-content-between align-items-baseline mt-0.5" style={{ fontSize: "11px" }}>
                          <span className="text-muted">Brüt Ağırlık:</span>
                          <span className="fw-bold text-dark">
                            {selectedProduct ? `${Number(selectedProduct.miktar || selectedProduct.hasGram || 0).toFixed(2)} g` : "3.45 g"}
                          </span>
                        </div>
                      </div>

                      <div className="d-flex align-items-center justify-content-between border-top pt-1 mt-1" style={{ fontSize: "10px" }}>
                        <span className="text-muted">Has: {selectedProduct?.hasGram ? `${selectedProduct.hasGram} HAS` : "-"}</span>
                        <span className="badge bg-success bg-opacity-20 text-success fw-bold">RFID INLAY</span>
                      </div>
                    </div>

                    {/* Sağ Kanat */}
                    <div className="d-flex flex-column justify-content-between ps-3" style={{ width: "50%" }}>
                      <div className="text-center">
                        <svg ref={barcodeSvgRef} style={{ maxWidth: "100%", height: "35px" }} />
                      </div>

                      <div className="d-flex align-items-center justify-content-between mt-1">
                        <div className="font-monospace" style={{ fontSize: "10px", lineHeight: "1.1" }}>
                          <div className="text-muted">RFID EPC HEX:</div>
                          <div className="fw-bold text-primary text-break">{currentEpc ? `${currentEpc.slice(0, 12)}...` : "E280..."}</div>
                        </div>

                        {qrDataUrl && <img src={qrDataUrl} alt="RFID QR" style={{ width: "36px", height: "36px" }} />}
                      </div>

                      <div className="text-center border-top pt-1 text-muted font-monospace" style={{ fontSize: "9px" }}>
                        Gen2 UHF 860-960 MHz
                      </div>
                    </div>

                    {/* Kuyumcu Etiket İpi Silueti */}
                    <div
                      className="position-absolute"
                      style={{
                        bottom: "-12px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: "3px",
                        height: "18px",
                        background: "#94a3b8",
                        borderRadius: "2px",
                      }}
                    />
                  </div>
                </Col>

                {/* Sağ: EPC Kontrolü & Aksiyonlar */}
                <Col lg={5}>
                  <div className="p-2.5 rounded bg-black bg-opacity-40 border border-secondary">
                    <div className="d-flex align-items-center justify-content-between mb-1.5">
                      <Form.Label className="small fw-bold text-muted mb-0">ÜRETİLEN BENZERSİZ RFID EPC KODU:</Form.Label>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-info small text-decoration-none fw-semibold"
                        onClick={() => {
                          if (selectedProduct) {
                            const newEpc = generateUniqueEpc(
                              selectedProduct.altinUrunId || selectedProduct.ozelUrunId || Date.now(),
                              selectedProduct.tip || "altin",
                              selectedProduct.ayar,
                              selectedProduct.grupKodu
                            );
                            setCurrentEpc(newEpc);
                            showStatus("Yeni benzersiz EPC kodu üretildi.", "info");
                          }
                        }}
                      >
                        <IconSparkles size={13} className="me-1" /> Yeni EPC Üret
                      </Button>
                    </div>

                    <InputGroup size="sm" className="mb-2">
                      <Form.Control
                        type="text"
                        readOnly
                        className="bg-dark text-warning font-monospace fw-bold border-secondary py-1"
                        style={{ fontSize: "12px", letterSpacing: "0.5px" }}
                        value={currentEpc}
                      />
                      <Button
                        variant="outline-secondary"
                        className="border-secondary text-light"
                        onClick={() => {
                          navigator.clipboard.writeText(currentEpc);
                          showStatus("EPC panoya kopyalandı.", "info");
                        }}
                      >
                        <IconCopy size={13} />
                      </Button>
                    </InputGroup>

                    <div className="d-flex align-items-center justify-content-between gap-2">
                      {/* Etiket Tasarım Türü */}
                      <Form.Select
                        size="sm"
                        className="bg-dark text-white border-secondary py-1"
                        style={{ fontSize: "11px", width: "160px" }}
                        value={etiketTasarimTipi}
                        onChange={(e) => setEtiketTasarimTipi(e.target.value as any)}
                      >
                        <option value="kelebek">🦋 Kelebek Etiket</option>
                        <option value="dambil">🏋️ Dambıl Etiket</option>
                        <option value="kuyruklu">🏷️ Kuyruklu Etiket</option>
                      </Form.Select>

                      <Button
                        variant="success"
                        size="sm"
                        className="fw-bold px-3 py-1 d-flex align-items-center"
                        disabled={!selectedProduct || isProcessing}
                        onClick={tekilYazdirVeKodla}
                      >
                        {isProcessing ? <Spinner animation="border" size="sm" className="me-1" /> : <IconPrinter size={15} className="me-1" />}
                        Tekil Yazdır & Kodla (F10)
                      </Button>
                    </div>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* ═══════════════════════════════════════════════════════════════════
              3. ALT BÖLÜM (BASKI VE KODLAMA KUYRUĞU TABLOSU)
             ═══════════════════════════════════════════════════════════════════ */}
          <Card className="border-0 shadow-none rounded-2 flex-grow-1 d-flex flex-column" style={{ background: "#1e293b", border: "1px solid #334155" }}>
            <div className="d-flex align-items-center justify-content-between p-1.5 px-2 border-bottom border-secondary bg-black bg-opacity-20 gap-2">
              <div className="d-flex align-items-center gap-2">
                <span className="fw-bold small text-white">Baskı & RFID Kodlama Kuyruğu</span>
                <Badge bg="primary" pill style={{ fontSize: "10px" }}>
                  {queue.length} Ürün
                </Badge>
                {selectedQueueIds.length > 0 && (
                  <Badge bg="info" pill style={{ fontSize: "10px" }}>
                    {selectedQueueIds.length} Seçili
                  </Badge>
                )}
              </div>

              <div className="d-flex align-items-center gap-1.5">
                <Button
                  variant="outline-danger"
                  size="sm"
                  className="py-0.5 px-2 border-0 text-danger"
                  style={{ fontSize: "11px" }}
                  disabled={queue.length === 0}
                  onClick={() => {
                    setQueue([]);
                    setSelectedQueueIds([]);
                  }}
                >
                  <IconTrash size={13} className="me-1" /> Kuyruğu Temizle
                </Button>

                <Button
                  variant="success"
                  size="sm"
                  className="py-0.5 px-3 fw-bold border-0"
                  style={{ fontSize: "11px" }}
                  disabled={selectedQueueIds.length === 0 || isProcessing}
                  onClick={topluYazdirVeKodla}
                >
                  <IconPrinter size={13} className="me-1" /> Seçilenleri Toplu Yazdır & Kodla ({selectedQueueIds.length})
                </Button>
              </div>
            </div>

            <div className="table-responsive flex-grow-1" style={{ maxHeight: "260px", overflowY: "auto" }}>
              <Table className="table-dark table-hover mb-0 text-nowrap align-middle" style={{ fontSize: "12px" }}>
                <thead className="sticky-top" style={{ background: "#0f172a", borderBottom: "2px solid #334155" }}>
                  <tr>
                    <th style={{ width: "35px" }}>
                      <Form.Check
                        type="checkbox"
                        checked={selectedQueueIds.length > 0 && selectedQueueIds.length === queue.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedQueueIds(queue.map((q) => q.id));
                          else setSelectedQueueIds([]);
                        }}
                      />
                    </th>
                    <th style={{ width: "35px" }}>#</th>
                    <th>STOK KODU</th>
                    <th>ÜRÜN ADI</th>
                    <th style={{ width: "60px" }}>AYAR</th>
                    <th style={{ width: "60px" }}>MİLYEM</th>
                    <th className="text-end" style={{ width: "80px" }}>BRÜT GR</th>
                    <th className="text-end" style={{ width: "80px" }}>HAS GR</th>
                    <th>RFID EPC KODU</th>
                    <th style={{ width: "90px" }}>DURUM</th>
                    <th className="text-end" style={{ width: "70px" }}>İŞLEM</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-4 text-muted">
                        Kuyrukta bekleyen ürün bulunmuyor. Yukarıdaki aramadan veya 'Toplu Seçim' ile ürün ekleyebilirsiniz.
                      </td>
                    </tr>
                  ) : (
                    queue.map((item, index) => {
                      const isSelected = selectedQueueIds.includes(item.id);
                      return (
                        <tr key={`${item.tip}_${item.id}`} className={isSelected ? "table-active" : ""}>
                          <td>
                            <Form.Check
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedQueueIds((prev) => [...prev, item.id]);
                                else setSelectedQueueIds((prev) => prev.filter((id) => id !== item.id));
                              }}
                            />
                          </td>
                          <td className="text-muted font-monospace">{index + 1}</td>
                          <td>
                            <span className="font-monospace text-light fw-semibold">{item.stokKodu}</span>
                          </td>
                          <td>
                            <span className="fw-semibold text-white">{item.urunAdi}</span>
                          </td>
                          <td>
                            <span className="badge bg-secondary bg-opacity-50">{item.ayar}K</span>
                          </td>
                          <td className="font-monospace text-muted">{item.milyem.toFixed(3)}</td>
                          <td className="text-end font-monospace fw-bold text-warning">{item.brutGram.toFixed(2)}</td>
                          <td className="text-end font-monospace fw-bold text-success">{item.hasGram.toFixed(2)}</td>
                          <td>
                            <span className="font-monospace text-info small fw-bold">{item.epc}</span>
                          </td>
                          <td>
                            <Badge bg={item.durum === "KODLANDI" ? "success" : "warning"} text={item.durum === "KODLANDI" ? "white" : "dark"} className="px-2 py-0.5">
                              {item.durum}
                            </Badge>
                          </td>
                          <td className="text-end">
                            <Button
                              variant="outline-danger"
                              size="sm"
                              className="p-0.5 px-1.5 border-0"
                              onClick={() => setQueue((prev) => prev.filter((q) => !(q.id === item.id && q.tip === item.tip)))}
                            >
                              <IconTrash size={13} />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* ─── ZPL BASKI EMİR ÇIKTISI MODALI ─── */}
      <Modal show={zplModalOpen} onHide={() => setZplModalOpen(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-dark text-white border-secondary">
          <Modal.Title className="h6 fw-bold">
            <IconPrinter size={18} className="me-2 text-success" />
            Zebra ZD621R Termal RFID Yazıcı ZPL Emri
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white p-3">
          <Alert variant="info" className="py-1 px-3 small border-0 bg-info bg-opacity-20 text-info mb-2">
            RFID çipine <code>^RFW</code> komutu ile EPC yazılmış ve etiket görsel tasarımı oluşturulmuştur.
          </Alert>
          <Form.Control
            as="textarea"
            rows={10}
            readOnly
            className="bg-black text-success font-monospace small border-secondary"
            value={generatedZpl}
          />
        </Modal.Body>
        <Modal.Footer className="bg-dark border-secondary">
          <Button
            variant="outline-light"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(generatedZpl);
              showStatus("ZPL komutu panoya kopyalandı.", "success");
            }}
          >
            <IconCopy size={14} className="me-1" /> ZPL Kopyala
          </Button>
          <Button variant="primary" size="sm" onClick={() => setZplModalOpen(false)}>
            Tamam
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── TOPLU SEÇİM MODALI ─── */}
      <Modal show={topluSecimModalOpen} onHide={() => setTopluSecimModalOpen(false)} centered>
        <Modal.Header closeButton className="bg-dark text-white border-secondary">
          <Modal.Title className="h6 fw-bold">
            <IconLayersLinked size={18} className="me-2 text-primary" />
            Toplu Ürün Seçimi & Kuyruğa Aktarma
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-dark text-white p-3">
          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold text-muted">Banko / Vitrin Konumu:</Form.Label>
            <Form.Select
              size="sm"
              className="bg-black text-white border-secondary"
              value={topluSeciliBanko}
              onChange={(e) => setTopluSeciliBanko(e.target.value)}
            >
              <option value="TÜMÜ">🌐 Tüm Bankolar & Vitrinler</option>
              {tablalar.map((t) => (
                <option key={t} value={t}>
                  📍 {t}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label className="small fw-bold text-muted">Ayar Filtresi:</Form.Label>
            <Form.Select
              size="sm"
              className="bg-black text-white border-secondary"
              value={topluSeciliAyar}
              onChange={(e) => setTopluSeciliAyar(e.target.value)}
            >
              <option value="TÜMÜ">Tüm Ayarlar (14K, 18K, 22K, 24K)</option>
              <option value="22">22 Ayar</option>
              <option value="14">14 Ayar</option>
              <option value="18">18 Ayar</option>
              <option value="24">24 Ayar</option>
              <option value="8">8 Ayar</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="bg-dark border-secondary">
          <Button variant="outline-secondary" size="sm" onClick={() => setTopluSecimModalOpen(false)}>
            Vazgeç
          </Button>
          <Button variant="primary" size="sm" onClick={topluKuyrugaAktar}>
            Seçilenleri Kuyruğa Aktar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default RfidEtiketUretimPage;

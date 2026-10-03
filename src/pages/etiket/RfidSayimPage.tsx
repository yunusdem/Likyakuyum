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
} from "react-bootstrap";
import {
  IconWifi,
  IconBarcode,
  IconCpu,
  IconPlayerPlay,
  IconPlayerPause,
  IconRotateClockwise,
  IconCheck,
  IconAlertTriangle,
  IconSearch,
  IconFileSpreadsheet,
  IconVolume,
  IconVolumeOff,
  IconSparkles,
  IconDeviceFloppy,
  IconScale,
  IconBuildingStore,
  IconArrowRight,
  IconKeyboard,
  IconDownload,
  IconX,
  IconNfc,
  IconCopy,
  IconEdit,
  IconPlus,
  IconTagOff,
  IconBinoculars,
  IconInfoCircle,
} from "@tabler/icons-react";
import {
  EtiketService,
  AltinUrunItem,
  OzelUrunItem,
  RfidTagItem,
} from "../../services/etiketService";

// ─── Web Audio API ile Anlık Bip Sentezleyici ──────────────────────────────
class RfidBeeper {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public beep(freq = 2400, dur = 0.035, vol = 0.12) {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch {}
  }

  public successChime() {
    this.beep(1760, 0.06, 0.18);
    setTimeout(() => this.beep(2637, 0.09, 0.18), 70);
  }
}

const beeper = new RfidBeeper();

const getMilyemForAyar = (ayar: string | null | undefined): number => {
  const clean = String(ayar || "").replace(/[^0-9.]/g, "");
  if (clean === "24") return 0.995;
  if (clean === "22") return 0.916;
  if (clean === "18") return 0.750;
  if (clean === "14") return 0.585;
  if (clean === "8") return 0.333;
  const p = parseFloat(clean);
  if (!isNaN(p) && p > 0 && p <= 1) return p;
  if (!isNaN(p) && p > 1) return Number((p / 24).toFixed(3));
  return 0.916;
};

export interface RfidSayimPageProps {
  isModal?: boolean;
  onClose?: () => void;
  onTransferToSlip?: (items: RfidTagItem[]) => void;
}

export const RfidSayimPage: React.FC<RfidSayimPageProps> = ({
  isModal = false,
  onClose,
  onTransferToSlip,
}) => {
  const [sayimModu, setSayimModu] = useState<"tabla" | "serbest">("tabla");
  const [seciliTabla, setSeciliTabla] = useState<string>("TÜMÜ");
  const [filtreDurum, setFiltreDurum] = useState<"tumu" | "okunan" | "eksik" | "etiketsiz" | "bilinmeyen">("tumu");
  const [aramaMetni, setAramaMetni] = useState<string>("");

  const [baglantiTipi, setBaglantiTipi] = useState<"canli" | "ws" | "serial" | "simulasyon">("canli");
  const [baglantiDurumu, setBaglantiDurumu] = useState<"bagli" | "kesildi" | "tani">("bagli");
  const [portAdi, setPortAdi] = useState<string>("DONANIM AKTİF (USB / HID / Serial)");
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [sesAcik, setSesAcik] = useState<boolean>(true);
  const [manuelEpcText, setManuelEpcText] = useState<string>("");

  const [altinUrunler, setAltinUrunler] = useState<AltinUrunItem[]>([]);
  const [ozelUrunler, setOzelUrunler] = useState<OzelUrunItem[]>([]);
  const [tablalar, setTablalar] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [scannedMap, setScannedMap] = useState<Map<string, RfidTagItem>>(new Map());
  const [recentReadEpcs, setRecentReadEpcs] = useState<string[]>([]);
  const [savingSlip, setSavingSlip] = useState<boolean>(false);
  const [notifyModal, setNotifyModal] = useState<{
    show: boolean;
    type: "success" | "warning" | "danger" | "info";
    title?: string;
    message: string;
  } | null>(null);

  const showNotify = (message: string, type: "success" | "warning" | "danger" | "info" = "info", title?: string) => {
    setNotifyModal({ show: true, type, title, message });
  };

  // ─── RFID Tanımlama Modalı State'leri ─────────────────────────────────────
  const [assignModalOpen, setAssignModalOpen] = useState<boolean>(false);
  const [targetProductType, setTargetProductType] = useState<"altin" | "ozel">("altin");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [targetEpc, setTargetEpc] = useState<string>("");
  const [productSearchTerm, setProductSearchTerm] = useState<string>("");
  const [onlyUntaggedModalFilter, setOnlyUntaggedModalFilter] = useState<boolean>(true);
  const [assignLoading, setAssignLoading] = useState<boolean>(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // ─── Dürbünlü RFID / Barkod Arama & Seçim Modalı State'leri ─────────────
  const [searchModalOpen, setSearchModalOpen] = useState<boolean>(false);
  const [searchModalQuery, setSearchModalQuery] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wedgeBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  const verileriYukle = useCallback(async () => {
    setLoading(true);
    try {
      const [altinList, ozelList, bankoList] = await Promise.all([
        EtiketService.getAltinUrunler({ satildi: false }).catch(() => []),
        EtiketService.getOzelUrunler({ satildi: false }).catch(() => []),
        EtiketService.getBankolar({ aktif: true }).catch(() => []),
      ]);

      setAltinUrunler(altinList);
      setOzelUrunler(ozelList);

      const tSet = new Set<string>();
      altinList.forEach((a) => a.banko && tSet.add(a.banko));
      ozelList.forEach((o) => o.banko && tSet.add(o.banko));
      bankoList.forEach((b) => b.bankoAdi && tSet.add(b.bankoAdi));
      setTablalar(Array.from(tSet).sort());
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    verileriYukle();
  }, [verileriYukle]);

  // ─── RFID EPC Okuma İşleyicisi ───────────────────────────────────────────
  const handleTagRead = useCallback(
    (epc: string, rssi = -55) => {
      const cleanEpc = String(epc || "").trim().toUpperCase();
      if (!cleanEpc) return;

      if (sesAcik) beeper.beep();

      setRecentReadEpcs((prev) => {
        const next = [cleanEpc, ...prev.filter((e) => e !== cleanEpc)].slice(0, 15);
        return next;
      });

      const matchedAltin = altinUrunler.find(
        (a) =>
          (a.rfidEpc && a.rfidEpc.toUpperCase() === cleanEpc) ||
          (a.barkod && a.barkod.toUpperCase() === cleanEpc)
      );
      const matchedOzel = !matchedAltin
        ? ozelUrunler.find(
            (o) =>
              (o.rfidEpc && o.rfidEpc.toUpperCase() === cleanEpc) ||
              (o.barkod && o.barkod.toUpperCase() === cleanEpc)
          )
        : null;

      const nowStr = new Date().toLocaleTimeString("tr-TR");

      setScannedMap((prev) => {
        const next = new Map(prev);
        const existing = next.get(cleanEpc);

        if (existing) {
          next.set(cleanEpc, {
            ...existing,
            hitCount: existing.hitCount + 1,
            okunmaZamani: nowStr,
            rssi,
          });
        } else {
          if (matchedAltin) {
            const ayar = matchedAltin.ayar || "22";
            const milyem = getMilyemForAyar(ayar);
            const brut = Number(matchedAltin.miktar || matchedAltin.hasGram || 0);
            const has = matchedAltin.hasGram ? Number(matchedAltin.hasGram) : Number((brut * milyem).toFixed(3));

            next.set(cleanEpc, {
              sira: next.size + 1,
              epc: cleanEpc,
              stokKodu: matchedAltin.barkod || `${matchedAltin.grupKodu}-${matchedAltin.urunNo}`,
              urunAdi: matchedAltin.model ? `${matchedAltin.grupKodu} - ${matchedAltin.model}` : `${matchedAltin.grupKodu} Altın`,
              ayar,
              milyem,
              brutGram: brut,
              hasGram: has,
              satisFiyati: matchedAltin.satisFiyati || 0,
              satisParaKodu: matchedAltin.satisParaKodu || "TL",
              banko: matchedAltin.banko || "Vitrin",
              durum: "KAYITLI",
              okunmaZamani: nowStr,
              hitCount: 1,
              rssi,
              rawItem: matchedAltin,
            });
          } else if (matchedOzel) {
            const ayar = matchedOzel.ayar || "18";
            const milyem = getMilyemForAyar(ayar);
            const brut = Number(matchedOzel.miktar || 0);
            const has = Number((brut * milyem).toFixed(3));

            next.set(cleanEpc, {
              sira: next.size + 1,
              epc: cleanEpc,
              stokKodu: matchedOzel.barkod || `${matchedOzel.grupKodu}-${matchedOzel.urunNo}`,
              urunAdi: matchedOzel.mamulTipi ? `${matchedOzel.grupKodu} - ${matchedOzel.mamulTipi}` : `${matchedOzel.grupKodu} Pırlanta`,
              ayar,
              milyem,
              brutGram: brut,
              hasGram: has,
              satisFiyati: matchedOzel.satisFiyati || 0,
              satisParaKodu: matchedOzel.satisParaKodu || "USD",
              banko: matchedOzel.banko || "Pırlanta",
              durum: "KAYITLI",
              okunmaZamani: nowStr,
              hitCount: 1,
              rssi,
              rawItem: matchedOzel,
            });
          } else {
            next.set(cleanEpc, {
              sira: next.size + 1,
              epc: cleanEpc,
              stokKodu: "TANIMSIZ",
              urunAdi: `Bilinmeyen RFID [${cleanEpc.slice(-6)}]`,
              ayar: "-",
              milyem: 0,
              brutGram: 0,
              hasGram: 0,
              satisFiyati: 0,
              satisParaKodu: "TL",
              banko: "Tanımsız",
              durum: "BILINMEYEN",
              okunmaZamani: nowStr,
              hitCount: 1,
              rssi,
            });
          }
        }
        return next;
      });

      // WebSocket / Canlı mod için hareketsizlik sayacı (3 sn boyunca yeni etiket gelmezse otomatik durdur)
      if (baglantiTipi !== "simulasyon") {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(() => {
          setIsScanning(false);
          beeper.successChime();
        }, 3000);
      }
    },
    [altinUrunler, ozelUrunler, sesAcik, baglantiTipi]
  );

  // ─── WebSocket Bağlantısı ────────────────────────────────────────────────
  useEffect(() => {
    if (baglantiTipi === "ws") {
      try {
        const ws = new WebSocket("ws://localhost:8088/rfid");
        wsRef.current = ws;

        ws.onopen = () => {
          setBaglantiDurumu("bagli");
          setPortAdi("WebSocket (ws://localhost:8088)");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const epc = data.epc || data.tag || data.data;
            if (epc && isScanning) {
              handleTagRead(epc, data.rssi || -50);
            }
          } catch {
            if (event.data && isScanning) {
              handleTagRead(event.data, -50);
            }
          }
        };

        ws.onerror = () => {
          setBaglantiDurumu("kesildi");
          setPortAdi("WS Bağlantı Hatası (Port: 8088)");
        };

        ws.onclose = () => {
          setBaglantiDurumu("kesildi");
        };
      } catch {
        setBaglantiDurumu("kesildi");
      }

      return () => {
        if (wsRef.current) wsRef.current.close();
      };
    }
  }, [baglantiTipi, isScanning, handleTagRead]);

  // ─── Simülasyon Modu (Tüm Etiketler Okununca OTOMATİK DURUR) ──────────────
  useEffect(() => {
    if (!isScanning || baglantiTipi !== "simulasyon") {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
      return;
    }

    const availableTags: string[] = [];
    altinUrunler.forEach((a) => {
      if (!seciliTabla || seciliTabla === "TÜMÜ" || a.banko === seciliTabla) {
        if (a.rfidEpc && a.rfidEpc.trim()) availableTags.push(a.rfidEpc.trim());
      }
    });

    ozelUrunler.forEach((o) => {
      if (!seciliTabla || seciliTabla === "TÜMÜ" || o.banko === seciliTabla) {
        if (o.rfidEpc && o.rfidEpc.trim()) availableTags.push(o.rfidEpc.trim());
      }
    });

    if (availableTags.length === 0) {
      availableTags.push("E280116060000214848039AA", "E280116060000214848039BB", "E280116060000214848039CC");
    }

    let idx = 0;
    const totalToRead = availableTags.length;

    simIntervalRef.current = setInterval(() => {
      if (idx < totalToRead) {
        const epc = availableTags[idx];
        const rssi = Math.floor(Math.random() * 15) - 60;
        handleTagRead(epc, rssi);
        idx++;
      } else {
        if (simIntervalRef.current) clearInterval(simIntervalRef.current);
        setIsScanning(false);
        beeper.successChime();
      }
    }, 160);

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
  }, [isScanning, baglantiTipi, altinUrunler, ozelUrunler, seciliTabla, handleTagRead]);

  // ─── Sağ Tık ile Doğrudan RFID Tanımlama Modalını Aç ────────────────────
  const handleRowContextMenu = (e: React.MouseEvent, item: RfidTagItem) => {
    e.preventDefault();
    e.stopPropagation();
    openRfidAssignModal(item);
  };

  // ─── RFID Tanımlama Modalını Aç ──────────────────────────────────────────
  const openRfidAssignModal = (item?: RfidTagItem | null) => {
    setAssignError(null);
    if (item) {
      setTargetEpc(item.epc && !item.epc.includes("TANIMSIZ") && item.epc !== "ETİKETSİZ" ? item.epc : (recentReadEpcs[0] || ""));
      if (item.rawItem) {
        setSelectedProduct(item.rawItem);
        setTargetProductType(item.rawItem.altinUrunId ? "altin" : "ozel");
      } else {
        setSelectedProduct(null);
      }
    } else {
      setTargetEpc(recentReadEpcs.length > 0 ? recentReadEpcs[0] : "");
      setSelectedProduct(null);
    }
    setAssignModalOpen(true);
  };

  // ─── Otomatik Yeni Standart EPC Üret ─────────────────────────────────────
  const generateNewEpcCode = () => {
    const p = selectedProduct;
    const ayarStr = p?.ayar ? String(p.ayar).replace(/[^0-9]/g, "") : "14";
    const ayarCode = (ayarStr || "14").slice(0, 2).padStart(2, "0");
    const tipCode = targetProductType === "altin" ? "AU" : "PR";
    const yearCode = String(new Date().getFullYear()).slice(-2);
    const counter = p ? String(p.altinUrunId || p.ozelUrunId || 1).padStart(8, "0") : String(Math.floor(Math.random() * 90000000) + 10000000);
    const rawEpc = `LKY${ayarCode}${tipCode}${yearCode}${counter}`;
    setTargetEpc(rawEpc);
  };

  // ─── RFID'yi Ürüne Kaydet & Eşleştir (SQL Veritabanı) ────────────────────
  const handleSaveRfidAssignment = async () => {
    if (!selectedProduct) {
      setAssignError("Lütfen eşleştirilecek ürünü seçiniz.");
      return;
    }
    const cleanEpc = targetEpc.trim().toUpperCase();
    if (!cleanEpc || cleanEpc.length < 4) {
      setAssignError("Geçerli bir RFID EPC kodu giriniz veya üretiniz.");
      return;
    }

    setAssignLoading(true);
    setAssignError(null);

    try {
      const prodId = selectedProduct.altinUrunId || selectedProduct.ozelUrunId;
      const res = await EtiketService.encodeAndPrintRfid({
        id: prodId,
        tip: targetProductType,
        epc: cleanEpc,
      });

      if (res.success) {
        beeper.successChime();

        // Local state'i güncelle
        if (targetProductType === "altin") {
          setAltinUrunler((prev) =>
            prev.map((a) => (a.altinUrunId === prodId ? { ...a, rfidEpc: cleanEpc } : a))
          );
        } else {
          setOzelUrunler((prev) =>
            prev.map((o) => (o.ozelUrunId === prodId ? { ...o, rfidEpc: cleanEpc } : o))
          );
        }

        // Okunan haritayı güncelle
        const ayar = selectedProduct.ayar || (targetProductType === "altin" ? "22" : "18");
        const milyem = getMilyemForAyar(ayar);
        const brut = Number(selectedProduct.miktar || selectedProduct.hasGram || 0);
        const has = selectedProduct.hasGram ? Number(selectedProduct.hasGram) : Number((brut * milyem).toFixed(3));

        setScannedMap((prev) => {
          const next = new Map(prev);
          next.set(cleanEpc, {
            sira: next.size + 1,
            epc: cleanEpc,
            stokKodu: selectedProduct.barkod || `${selectedProduct.grupKodu}-${selectedProduct.urunNo}`,
            urunAdi: selectedProduct.model || selectedProduct.mamulTipi || `${selectedProduct.grupKodu} Ürün`,
            ayar,
            milyem,
            brutGram: brut,
            hasGram: has,
            satisFiyati: selectedProduct.satisFiyati || 0,
            satisParaKodu: selectedProduct.satisParaKodu || (targetProductType === "altin" ? "TL" : "USD"),
            banko: selectedProduct.banko || "Vitrin",
            durum: "KAYITLI",
            okunmaZamani: new Date().toLocaleTimeString("tr-TR"),
            hitCount: 1,
            rawItem: selectedProduct,
          });
          return next;
        });

        setAssignModalOpen(false);
      }
    } catch (err: any) {
      setAssignError(err.message || "RFID kodu ürüne kaydedilemedi.");
    } finally {
      setAssignLoading(false);
    }
  };

  // ─── Tabla ve Serbest Sayım Satırları ────────────────────────────────────
  const activeTableRows = useMemo(() => {
    if (sayimModu === "serbest") {
      return Array.from(scannedMap.values());
    }

    const rows: RfidTagItem[] = [];
    const matchedEpcs = new Set<string>();

    // 1. Altın Ürünler
    const targetAltin = altinUrunler.filter((a) => !seciliTabla || seciliTabla === "TÜMÜ" || a.banko === seciliTabla);
    targetAltin.forEach((a, idx) => {
      const hasRfid = Boolean(a.rfidEpc && a.rfidEpc.trim().length > 0);
      const epc = hasRfid ? a.rfidEpc!.trim().toUpperCase() : "";
      const isScanned = hasRfid && scannedMap.has(epc);
      const scanItem = isScanned ? scannedMap.get(epc)! : null;

      if (hasRfid && isScanned) matchedEpcs.add(epc);

      const ayar = a.ayar || "22";
      const milyem = getMilyemForAyar(ayar);
      const brut = Number(a.miktar || a.hasGram || 0);
      const has = a.hasGram ? Number(a.hasGram) : Number((brut * milyem).toFixed(3));

      let durum: "KAYITLI" | "EKSIK" | "ETIKETSIZ" = "EKSIK";
      if (!hasRfid) durum = "ETIKETSIZ";
      else if (isScanned) durum = "KAYITLI";

      rows.push({
        sira: idx + 1,
        epc: epc || "RFID TANIMSIZ",
        stokKodu: a.barkod || `${a.grupKodu}-${a.urunNo}`,
        urunAdi: a.model ? `${a.grupKodu} - ${a.model}` : `${a.grupKodu} Altın`,
        ayar,
        milyem,
        brutGram: brut,
        hasGram: has,
        satisFiyati: a.satisFiyati || 0,
        satisParaKodu: a.satisParaKodu || "TL",
        banko: a.banko || "Vitrin",
        durum,
        okunmaZamani: scanItem?.okunmaZamani || "-",
        hitCount: scanItem?.hitCount || 0,
        rssi: scanItem?.rssi,
        rawItem: a,
      });
    });

    // 2. Özel / Pırlanta Ürünler
    const targetOzel = ozelUrunler.filter((o) => !seciliTabla || seciliTabla === "TÜMÜ" || o.banko === seciliTabla);
    targetOzel.forEach((o, idx) => {
      const hasRfid = Boolean(o.rfidEpc && o.rfidEpc.trim().length > 0);
      const epc = hasRfid ? o.rfidEpc!.trim().toUpperCase() : "";
      const isScanned = hasRfid && scannedMap.has(epc);
      const scanItem = isScanned ? scannedMap.get(epc)! : null;

      if (hasRfid && isScanned) matchedEpcs.add(epc);

      const ayar = o.ayar || "18";
      const milyem = getMilyemForAyar(ayar);
      const brut = Number(o.miktar || 0);
      const has = Number((brut * milyem).toFixed(3));

      let durum: "KAYITLI" | "EKSIK" | "ETIKETSIZ" = "EKSIK";
      if (!hasRfid) durum = "ETIKETSIZ";
      else if (isScanned) durum = "KAYITLI";

      rows.push({
        sira: rows.length + 1,
        epc: epc || "RFID TANIMSIZ",
        stokKodu: o.barkod || `${o.grupKodu}-${o.urunNo}`,
        urunAdi: o.mamulTipi ? `${o.grupKodu} - ${o.mamulTipi}` : `${o.grupKodu} Pırlanta`,
        ayar,
        milyem,
        brutGram: brut,
        hasGram: has,
        satisFiyati: o.satisFiyati || 0,
        satisParaKodu: o.satisParaKodu || "USD",
        banko: o.banko || "Pırlanta",
        durum,
        okunmaZamani: scanItem?.okunmaZamani || "-",
        hitCount: scanItem?.hitCount || 0,
        rssi: scanItem?.rssi,
        rawItem: o,
      });
    });

    // 3. Tablada tanımlı olmayan ancak okunan fazla / bilinmeyen RFID etiketleri
    scannedMap.forEach((sItem, epc) => {
      if (!matchedEpcs.has(epc)) {
        rows.unshift({
          ...sItem,
          durum: sItem.durum === "KAYITLI" ? "KAYITLI" : "BILINMEYEN",
        });
      }
    });

    return rows;
  }, [sayimModu, seciliTabla, altinUrunler, ozelUrunler, scannedMap]);

  // Metrikler
  const metrics = useMemo(() => {
    let benzersizAdet = 0;
    let eksikAdet = 0;
    let etiketsizAdet = 0;
    let bilinmeyenAdet = 0;
    let toplamBrut = 0;
    let toplamHas = 0;

    activeTableRows.forEach((r) => {
      if (r.durum === "KAYITLI") {
        benzersizAdet++;
        toplamBrut += r.brutGram;
        toplamHas += r.hasGram;
      } else if (r.durum === "EKSIK") {
        eksikAdet++;
      } else if (r.durum === "ETIKETSIZ") {
        etiketsizAdet++;
      } else if (r.durum === "BILINMEYEN") {
        bilinmeyenAdet++;
      }
    });

    return {
      benzersizAdet,
      eksikAdet,
      etiketsizAdet,
      bilinmeyenAdet,
      toplamBrut: Number(toplamBrut.toFixed(2)),
      toplamHas: Number(toplamHas.toFixed(2)),
    };
  }, [activeTableRows]);

  // Filtrelenmiş satırlar
  const filteredRows = useMemo(() => {
    return activeTableRows.filter((r) => {
      if (filtreDurum === "okunan" && r.durum !== "KAYITLI") return false;
      if (filtreDurum === "eksik" && r.durum !== "EKSIK") return false;
      if (filtreDurum === "etiketsiz" && r.durum !== "ETIKETSIZ") return false;
      if (filtreDurum === "bilinmeyen" && r.durum !== "BILINMEYEN") return false;

      if (aramaMetni.trim()) {
        const q = aramaMetni.toLowerCase();
        const epcMatch = r.epc.toLowerCase().includes(q);
        const stokMatch = r.stokKodu.toLowerCase().includes(q);
        const adMatch = r.urunAdi.toLowerCase().includes(q);
        return epcMatch || stokMatch || adMatch;
      }
      return true;
    });
  }, [activeTableRows, filtreDurum, aramaMetni]);

  // Ürün Seçim Listesi (Modal İçin)
  const productOptions = useMemo(() => {
    const list = targetProductType === "altin" ? altinUrunler : ozelUrunler;
    return list.filter((p: any) => {
      if (onlyUntaggedModalFilter && p.rfidEpc && p.rfidEpc.trim().length > 0) {
        return false;
      }
      if (!productSearchTerm.trim()) return true;
      const q = productSearchTerm.toLowerCase();
      return (
        (p.barkod && p.barkod.toLowerCase().includes(q)) ||
        (p.grupKodu && p.grupKodu.toLowerCase().includes(q)) ||
        (p.model && p.model.toLowerCase().includes(q)) ||
        (p.mamulTipi && p.mamulTipi.toLowerCase().includes(q)) ||
        (p.rfidEpc && p.rfidEpc.toLowerCase().includes(q))
      );
    }).slice(0, 50);
  }, [targetProductType, altinUrunler, ozelUrunler, productSearchTerm, onlyUntaggedModalFilter]);

  // Dürbün Arama & Seçim Listesi (Tüm Ürünler / Filtrelenmiş)
  const searchModalResults = useMemo(() => {
    const q = searchModalQuery.trim().toLowerCase();

    const altinMatched = altinUrunler.map((a) => ({
      id: `altin-${a.altinUrunId}`,
      originalId: a.altinUrunId,
      productType: "altin" as const,
      displayStok: a.barkod || `${a.grupKodu}-${a.urunNo}`,
      displayAd: a.model ? `${a.grupKodu} - ${a.model}` : `${a.grupKodu} Altın`,
      displayAyar: a.ayar || "22",
      displayMiktar: a.miktar || a.hasGram || 0,
      displayBanko: a.banko || "Vitrin",
      epc: a.rfidEpc || "",
      barkod: a.barkod || "",
      grupKodu: a.grupKodu || "",
      model: a.model || "",
      urunNo: a.urunNo || "",
      orjinalKod: a.orjinalKod || "",
    }));

    const ozelMatched = ozelUrunler.map((o) => ({
      id: `ozel-${o.ozelUrunId}`,
      originalId: o.ozelUrunId,
      productType: "ozel" as const,
      displayStok: o.barkod || `${o.grupKodu}-${o.urunNo}`,
      displayAd: o.mamulTipi ? `${o.grupKodu} - ${o.mamulTipi}` : `${o.grupKodu} Özel`,
      displayAyar: o.ayar || "18",
      displayMiktar: o.miktar || 0,
      displayBanko: o.banko || "Pırlanta",
      epc: o.rfidEpc || "",
      barkod: o.barkod || "",
      grupKodu: o.grupKodu || "",
      model: o.mamulTipi || "",
      urunNo: o.urunNo || "",
      orjinalKod: "",
    }));

    const all = [...altinMatched, ...ozelMatched];
    if (!q) return all.slice(0, 100);

    return all.filter((item) => {
      const epcMatch = item.epc && item.epc.toLowerCase().includes(q);
      const barkodMatch = item.barkod && item.barkod.toLowerCase().includes(q);
      const stokMatch = item.displayStok && item.displayStok.toLowerCase().includes(q);
      const adMatch = item.displayAd && item.displayAd.toLowerCase().includes(q);
      const grupMatch = item.grupKodu && item.grupKodu.toLowerCase().includes(q);
      const bankoMatch = item.displayBanko && item.displayBanko.toLowerCase().includes(q);
      const noMatch = item.urunNo && String(item.urunNo).toLowerCase().includes(q);
      return epcMatch || barkodMatch || stokMatch || adMatch || grupMatch || bankoMatch || noMatch;
    }).slice(0, 100);
  }, [altinUrunler, ozelUrunler, searchModalQuery]);

  // ─── Aksiyonlar ──────────────────────────────────────────────────────────
  const toggleScanning = () => {
    setIsScanning((prev) => !prev);
  };

  const openSearchSelectionModal = (initialQuery?: string) => {
    setSearchModalQuery(initialQuery !== undefined ? initialQuery : manuelEpcText || "");
    setSearchModalOpen(true);
  };

  const handleSelectProductFromSearchModal = (prod: any) => {
    const tagToRead = prod.epc || prod.barkod || prod.displayStok;
    handleTagRead(tagToRead);
    setSearchModalOpen(false);
    setManuelEpcText("");
  };

  const handleManuelEpcSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = manuelEpcText.trim();
    if (!clean) {
      openSearchSelectionModal("");
      return;
    }

    const q = clean.toLowerCase();

    // 1. Tam Eşleşme Kontrolü (Barkod veya RFID EPC birebir eşitse)
    const exactAltin = altinUrunler.find(
      (a) =>
        (a.rfidEpc && a.rfidEpc.toLowerCase() === q) ||
        (a.barkod && a.barkod.toLowerCase() === q)
    );
    const exactOzel = !exactAltin
      ? ozelUrunler.find(
          (o) =>
            (o.rfidEpc && o.rfidEpc.toLowerCase() === q) ||
            (o.barkod && o.barkod.toLowerCase() === q)
        )
      : null;

    if (exactAltin) {
      handleTagRead(exactAltin.rfidEpc || exactAltin.barkod || clean);
      setManuelEpcText("");
      return;
    }
    if (exactOzel) {
      handleTagRead(exactOzel.rfidEpc || exactOzel.barkod || clean);
      setManuelEpcText("");
      return;
    }

    // 2. Kısmi Eşleşme Taraması
    const matchedAltin = altinUrunler.filter((a) => {
      const epcM = a.rfidEpc && a.rfidEpc.toLowerCase().includes(q);
      const barM = a.barkod && a.barkod.toLowerCase().includes(q);
      const grpM = a.grupKodu && a.grupKodu.toLowerCase().includes(q);
      const mdlM = a.model && a.model.toLowerCase().includes(q);
      const noM = a.urunNo && String(a.urunNo).toLowerCase().includes(q);
      return epcM || barM || grpM || mdlM || noM;
    });

    const matchedOzel = ozelUrunler.filter((o) => {
      const epcM = o.rfidEpc && o.rfidEpc.toLowerCase().includes(q);
      const barM = o.barkod && o.barkod.toLowerCase().includes(q);
      const grpM = o.grupKodu && o.grupKodu.toLowerCase().includes(q);
      const mdlM = o.mamulTipi && o.mamulTipi.toLowerCase().includes(q);
      const noM = o.urunNo && String(o.urunNo).toLowerCase().includes(q);
      return epcM || barM || grpM || mdlM || noM;
    });

    const totalMatches = matchedAltin.length + matchedOzel.length;

    // Tek bir ürün varsa direkt seç ve oku
    if (totalMatches === 1) {
      const single = matchedAltin[0] || matchedOzel[0];
      handleTagRead(single.rfidEpc || single.barkod || clean);
      setManuelEpcText("");
    } else if (totalMatches > 1) {
      // Birden fazla ürün eşleşirse dürbün modalını aç ve eşleşenleri listele
      setSearchModalQuery(clean);
      setSearchModalOpen(true);
    } else {
      // Veritabanında eşleşen yoksa girilen kodu direkt RFID okuma olarak işle
      handleTagRead(clean);
      setManuelEpcText("");
    }
  };

  const temizleSayim = () => {
    setScannedMap(new Map());
    setRecentReadEpcs([]);
    setNotifyModal(null);
  };

  const fiseAktar = () => {
    const okunanlar = Array.from(scannedMap.values());
    if (okunanlar.length === 0) {
      showNotify("Aktarılacak okunan RFID kaydı bulunmuyor.", "warning", "Uyarı");
      return;
    }
    if (onTransferToSlip) {
      onTransferToSlip(okunanlar);
    }
    if (isModal && onClose) {
      onClose();
    }
  };

  const sayimFisiKaydet = async () => {
    const okunanlar = Array.from(scannedMap.values());
    if (okunanlar.length === 0) {
      showNotify("Kaydedilecek okunan RFID ürünü bulunmuyor.", "warning", "Uyarı");
      return;
    }

    setSavingSlip(true);
    try {
      const nextNo = await EtiketService.getNextSayimFisNo().catch(() => "RFID-" + Date.now());
      const payload = {
        fisNo: nextNo,
        tarih: new Date().toISOString(),
        banko: seciliTabla !== "TÜMÜ" ? seciliTabla : "Genel RFID Sayımı",
        aciklama: `RFID Sayım Fişi (${metrics.benzersizAdet} Adet, ${metrics.toplamBrut} gr)`,
        satirlar: okunanlar.map((item, idx) => ({
          siraNo: idx + 1,
          barkod: item.stokKodu,
          epc: item.epc,
          urunAdi: item.urunAdi,
          ayar: item.ayar,
          milyem: item.milyem,
          miktar: item.brutGram,
          hasGram: item.hasGram,
          durum: item.durum,
        })),
      };

      await EtiketService.saveSayimFisi(payload);
      beeper.successChime();
      showNotify(
        `Sayım fişi (#${nextNo}) başarıyla kaydedildi!\nToplam ${metrics.benzersizAdet} adet ürün sisteme işlendi.`,
        "success",
        "Sayım Fişi Kaydedildi"
      );
    } catch (err: any) {
      showNotify("Sayım fişi kaydedilirken hata oluştu: " + err.message, "danger", "Hata Oluştu");
    } finally {
      setSavingSlip(false);
    }
  };

  // ─── Klavye Kısayolları & Otomatik RFID Donanım Okuyucu (HID Keyboard Wedge) ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Modal açıkken klavye yakalamayı durdur (kullanıcı modalda yazıyor olabilir)
      if (assignModalOpen || searchModalOpen) return;

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // 1. Eğer kullanıcı herhangi bir input alanında DEĞİLSE:
      // RFID cihazı tuş taklidi (Keyboard Wedge) ile seri veri basarken arka planda otomatik yakala
      if (!isInput) {
        if (e.key === "Enter") {
          if (wedgeBufferRef.current.trim().length >= 3) {
            e.preventDefault();
            const epc = wedgeBufferRef.current.trim();
            wedgeBufferRef.current = "";
            handleTagRead(epc);
            return;
          }
        } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
          const now = Date.now();
          if (now - lastKeyTimeRef.current > 400) {
            wedgeBufferRef.current = "";
          }
          lastKeyTimeRef.current = now;
          wedgeBufferRef.current += e.key;

          // Enter tuşu basmayan hızlı RFID cihazları için otomatik timer
          setTimeout(() => {
            if (Date.now() - lastKeyTimeRef.current >= 70 && wedgeBufferRef.current.trim().length >= 8) {
              const epc = wedgeBufferRef.current.trim();
              wedgeBufferRef.current = "";
              handleTagRead(epc);
            }
          }, 90);
        }

        // Space: Başlat / Durdur
        if (e.code === "Space" || e.key === " ") {
          e.preventDefault();
          setIsScanning((prev) => !prev);
        }
      }

      // Standart ERP Fonksiyon Tuşları
      if (e.key === "F2") {
        e.preventDefault();
        fiseAktar();
      } else if (e.key === "F4") {
        e.preventDefault();
        temizleSayim();
      } else if (e.key === "F8") {
        e.preventDefault();
        setSayimModu((prev) => (prev === "tabla" ? "serbest" : "tabla"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [assignModalOpen, handleTagRead, fiseAktar, temizleSayim]);

  return (
    <div
      className="rfid-sayim-container d-flex flex-column h-100 p-3"
      data-no-erp-context="true"
      style={{ background: "#f8fafc", color: "#0f172a", minHeight: isModal ? "auto" : "100vh" }}
    >
      {/* ─── 1. ÜST KONTROL & METRİK ÇUBUĞU (SOL: SEÇİM + SIFIRLA + MANUEL GİRİŞ, SAĞ: BAŞLAT + METRİKLER) ─── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-2.5 mb-2.5 rounded-3 bg-white border shadow-sm">
        {/* EN SOL: Tablo Sayımı / Serbest Sayım + RFID Tanımla + Sıfırla + Manuel Barkod/EPC Okut */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="d-flex align-items-center bg-light p-1 rounded border gap-1">
            <Button
              variant={sayimModu === "tabla" ? "primary" : "light"}
              size="sm"
              className={`py-1 px-2.5 fw-semibold border-0 ${sayimModu === "tabla" ? "text-white" : "text-dark"}`}
              style={{ fontSize: "12px" }}
              onClick={() => setSayimModu("tabla")}
            >
              Tabla Sayımı
            </Button>
            <Button
              variant={sayimModu === "serbest" ? "primary" : "light"}
              size="sm"
              className={`py-1 px-2.5 fw-semibold border-0 ${sayimModu === "serbest" ? "text-white" : "text-dark"}`}
              style={{ fontSize: "12px" }}
              onClick={() => setSayimModu("serbest")}
            >
              Serbest Sayım
            </Button>
          </div>

          <Button
            variant="warning"
            size="sm"
            className="fw-bold px-2.5 py-1.5 d-flex align-items-center text-dark shadow-sm"
            onClick={() => openRfidAssignModal(null)}
            title="Ürüne yeni RFID EPC tanımla ve SQL veritabanına kaydet"
          >
            <IconNfc size={16} className="me-1" /> Ürüne RFID Tanımla
          </Button>

          <Button
            variant="outline-secondary"
            size="sm"
            className="px-2 py-1.5"
            onClick={temizleSayim}
            title="Sayımı Sıfırla (F4)"
          >
            <IconRotateClockwise size={15} className="me-1" /> Sıfırla
          </Button>

          {/* SIFIRLA'NIN SAĞINDA: Manuel Yazıp Enter'a Basarak Okuma Kutusu + Dürbün */}
          <Form onSubmit={handleManuelEpcSubmit} className="d-flex align-items-center">
            <InputGroup size="sm" style={{ width: "280px" }}>
              <InputGroup.Text className="bg-light text-muted border px-2 py-1">
                <IconBarcode size={15} />
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Barkod / Model / EPC..."
                className="border py-1 shadow-none bg-white text-dark fw-semibold"
                style={{ fontSize: "12px" }}
                value={manuelEpcText}
                onChange={(e) => setManuelEpcText(e.target.value)}
              />
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                className="px-2 py-1 bg-light border"
                onClick={() => openSearchSelectionModal(manuelEpcText)}
                title="Dürbün ile RFID / Ürün Ara ve Seç"
              >
                <IconBinoculars size={15} className="text-primary" />
              </Button>
              <Button type="submit" variant="primary" size="sm" className="px-2 py-1 fw-bold" title="Enter'a basarak oku">
                Oku
              </Button>
            </InputGroup>
          </Form>
        </div>

        {/* EN SAĞDA: BAŞLAT BUTONU (OKUNANIN HEMEN SOLUNDA) + METRİKLER (Okunan, Brüt, Has, Port, Ses) */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          {/* BAŞLAT / DURDUR BUTONU - OKUNAN'IN HEMEN SOLUNDA */}
          <Button
            variant={isScanning ? "danger" : "success"}
            size="sm"
            className="fw-bold px-3 py-1.5 shadow-sm d-flex align-items-center me-1"
            style={{ minWidth: "155px", justifyContent: "center", fontSize: "12px" }}
            onClick={toggleScanning}
          >
            {isScanning ? (
              <>
                <IconPlayerPause size={16} className="me-1.5" /> DURDUR (Space)
              </>
            ) : (
              <>
                <IconPlayerPlay size={16} className="me-1.5" /> BAŞLAT (Space)
              </>
            )}
          </Button>

          <div className="d-flex align-items-center px-2.5 py-1 bg-light rounded border">
            <span className="text-muted me-1.5" style={{ fontSize: "11px" }}>Okunan:</span>
            <span className="fw-bold text-primary font-monospace" style={{ fontSize: "13px" }}>
              {metrics.benzersizAdet} Adet
            </span>
          </div>

          <div className="d-flex align-items-center px-2.5 py-1 bg-light rounded border">
            <span className="text-muted me-1.5" style={{ fontSize: "11px" }}>Brüt:</span>
            <span className="fw-bold text-dark font-monospace" style={{ fontSize: "13px" }}>
              {metrics.toplamBrut.toFixed(2)} gr
            </span>
          </div>

          <div className="d-flex align-items-center px-2.5 py-1 bg-light rounded border">
            <span className="text-muted me-1.5" style={{ fontSize: "11px" }}>Has:</span>
            <span className="fw-bold text-success font-monospace" style={{ fontSize: "13px" }}>
              {metrics.toplamHas.toFixed(2)} gr
            </span>
          </div>

          <Button
            variant="outline-secondary"
            size="sm"
            className="p-1 px-1.5 text-dark"
            onClick={() => setSesAcik(!sesAcik)}
            title={sesAcik ? "Sesli Bip Açık" : "Ses Kapalı"}
          >
            {sesAcik ? <IconVolume size={15} className="text-success" /> : <IconVolumeOff size={15} className="text-muted" />}
          </Button>

          {isModal && onClose && (
            <Button variant="outline-danger" size="sm" className="p-1 px-2 ms-1" onClick={onClose}>
              <IconX size={15} />
            </Button>
          )}
        </div>
      </div>



      {/* ─── 2. CANLI TABLO ─── */}
      <Card className="border rounded-3 shadow-sm flex-grow-1 d-flex flex-column mb-2.5 bg-white">
        <div className="d-flex align-items-center justify-content-between p-2 px-3 border-bottom bg-light bg-opacity-50 gap-2">
          {/* TABLO ÜSTÜ SOL: Tablalar Dropdown'u + Durum Filtre Dropdown'u */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {sayimModu === "tabla" && (
              <Form.Select
                size="sm"
                className="bg-white text-dark border py-1 shadow-sm fw-semibold"
                style={{ width: "200px", fontSize: "12px" }}
                value={seciliTabla}
                onChange={(e) => setSeciliTabla(e.target.value)}
              >
                <option value="TÜMÜ">📍 Tüm Tablalar / Vitrin</option>
                {tablalar.map((t) => (
                  <option key={t} value={t}>
                    📍 {t}
                  </option>
                ))}
              </Form.Select>
            )}

            <Form.Select
              size="sm"
              className="bg-white text-dark border py-1 shadow-sm fw-semibold"
              style={{ width: "190px", fontSize: "12px" }}
              value={filtreDurum}
              onChange={(e) => setFiltreDurum(e.target.value as any)}
            >
              <option value="tumu">📋 Tümü ({activeTableRows.length})</option>
              <option value="okunan">✅ Okunan ({metrics.benzersizAdet})</option>
              {sayimModu === "tabla" && (
                <option value="eksik">⚠️ Okunmayan ({metrics.eksikAdet})</option>
              )}
              <option value="etiketsiz">🚫 RFID Yok ({metrics.etiketsizAdet})</option>
              <option value="bilinmeyen">❓ Bilinmeyen ({metrics.bilinmeyenAdet})</option>
            </Form.Select>
          </div>

          {/* TABLO ÜSTÜ SAĞ: Arama Kutusu */}
          <div className="d-flex align-items-center gap-2">
            <span className="text-muted d-none d-lg-inline" style={{ fontSize: "11px" }}>
              💡 İpucu: Satıra <b>Sağ Tıklayarak</b> veya butona basarak doğrudan RFID tanımlayabilirsiniz.
            </span>
            <InputGroup size="sm" style={{ width: "220px" }}>
              <InputGroup.Text className="bg-white text-muted border py-0 px-2">
                <IconSearch size={13} />
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="EPC / Stok / Model..."
                className="bg-white text-dark border py-0 shadow-none"
                style={{ fontSize: "11px" }}
                value={aramaMetni}
                onChange={(e) => setAramaMetni(e.target.value)}
              />
            </InputGroup>
          </div>
        </div>

        <div className="table-responsive flex-grow-1" style={{ maxHeight: isModal ? "360px" : "calc(100vh - 210px)", overflowY: "auto" }}>
          <Table hover className="mb-0 text-nowrap align-middle border-0" style={{ fontSize: "12px" }}>
            <thead className="sticky-top bg-light" style={{ borderBottom: "2px solid #cbd5e1", zIndex: 2 }}>
              <tr className="text-dark">
                <th style={{ width: "40px" }} className="py-2">#</th>
                <th style={{ width: "180px" }}>RFID EPC / ÇİP KODU</th>
                <th>STOK KODU</th>
                <th>ÜRÜN ADI / MODEL</th>
                <th style={{ width: "60px" }}>AYAR</th>
                <th style={{ width: "70px" }}>MİLYEM</th>
                <th className="text-end" style={{ width: "90px" }}>BRÜT GR</th>
                <th className="text-end" style={{ width: "90px" }}>HAS GR</th>
                <th style={{ width: "110px" }}>DURUM</th>
                <th style={{ width: "60px" }}>HİT</th>
                <th style={{ width: "80px" }}>SAAT</th>
                <th className="text-center" style={{ width: "90px" }}>İŞLEM</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-5 text-muted">
                    {loading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2 text-primary" /> Ürünler Yükleniyor...
                      </>
                    ) : (
                      "Kayıtlı veya okunan RFID ürünü bulunmuyor. 'BAŞLAT' butonuna basarak sayımı başlatabilirsiniz."
                    )}
                  </td>
                </tr>
              ) : (
                filteredRows.map((item, index) => {
                  const isRead = item.durum === "KAYITLI";
                  const isMissing = item.durum === "EKSIK";
                  const isUntagged = item.durum === "ETIKETSIZ";
                  const isUnknown = item.durum === "BILINMEYEN";

                  return (
                    <tr
                      key={item.epc + index}
                      onContextMenu={(e) => handleRowContextMenu(e, item)}
                      className={
                        isUntagged
                          ? "table-danger bg-opacity-25"
                          : isMissing
                          ? "table-warning bg-opacity-25"
                          : isRead
                          ? "table-success bg-opacity-25"
                          : ""
                      }
                      style={{ cursor: "context-menu" }}
                    >
                      <td className="text-muted font-monospace" style={{ fontSize: "11px" }}>
                        {index + 1}
                      </td>
                      <td>
                        {isUntagged ? (
                          <span className="badge bg-danger bg-opacity-10 text-danger border border-danger font-monospace px-1.5 py-0.5" style={{ fontSize: "10px" }}>
                            🚫 RFID TANIMSIZ
                          </span>
                        ) : (
                          <span className="font-monospace fw-bold text-primary" style={{ fontSize: "11px" }}>
                            {item.epc}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="font-monospace text-dark fw-bold">{item.stokKodu}</span>
                      </td>
                      <td>
                        <span className="fw-semibold text-dark">{item.urunAdi}</span>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border font-monospace">
                          {item.ayar ? `${item.ayar}K` : "-"}
                        </span>
                      </td>
                      <td>
                        <span className="font-monospace text-muted">{item.milyem.toFixed(3)}</span>
                      </td>
                      <td className="text-end font-monospace fw-bold text-dark">
                        {item.brutGram > 0 ? item.brutGram.toFixed(2) : "-"}
                      </td>
                      <td className="text-end font-monospace fw-bold text-success">
                        {item.hasGram > 0 ? item.hasGram.toFixed(2) : "-"}
                      </td>
                      <td>
                        {isRead && <Badge bg="success" className="px-2 py-0.5">✅ OKUNDU</Badge>}
                        {isMissing && <Badge bg="warning" text="dark" className="px-2 py-0.5">⚠️ OKUNMADI</Badge>}
                        {isUntagged && <Badge bg="danger" className="px-2 py-0.5">🚫 ETİKETSİZ</Badge>}
                        {isUnknown && <Badge bg="info" text="dark" className="px-2 py-0.5">❓ BİLİNMEYEN</Badge>}
                      </td>
                      <td>
                        <span className="badge bg-light text-secondary border font-monospace">
                          {item.hitCount > 0 ? `${item.hitCount}x` : "-"}
                        </span>
                      </td>
                      <td className="text-muted font-monospace" style={{ fontSize: "10px" }}>
                        {item.okunmaZamani}
                      </td>
                      <td className="text-center">
                        <Button
                          variant={isUntagged ? "danger" : "outline-primary"}
                          size="sm"
                          className="py-0 px-2 fw-semibold"
                          style={{ fontSize: "11px" }}
                          onClick={() => openRfidAssignModal(item)}
                          title="Bu ürüne RFID EPC tanımla veya değiştir"
                        >
                          <IconNfc size={13} className="me-1" /> {isUntagged ? "RFID Ekle" : "Tanımla"}
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

      {/* ─── 3. ALT AKSİYON ÇUBUĞU ─── */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 p-2.5 rounded-3 bg-white border shadow-sm">
        <div className="d-none d-md-flex align-items-center gap-3 text-muted small" style={{ fontSize: "11px" }}>
          <span><kbd className="bg-light text-dark px-1.5 py-0.5 border">Space</kbd> Başlat/Durdur</span>
          <span><kbd className="bg-light text-dark px-1.5 py-0.5 border">F2</kbd> Fişe Aktar</span>
          <span><kbd className="bg-light text-dark px-1.5 py-0.5 border">F4</kbd> Temizle</span>
          <span><kbd className="bg-light text-dark px-1.5 py-0.5 border">Sağ Tık</kbd> RFID Tanımla</span>
        </div>

        <div className="d-flex align-items-center gap-2 ms-auto">
          <Button
            variant="outline-secondary"
            size="sm"
            className="fw-bold px-3 py-1.5 text-dark"
            onClick={() => window.print()}
          >
            <IconDownload size={15} className="me-1" /> Yazdır / Excel
          </Button>

          <Button
            variant="outline-primary"
            size="sm"
            className="fw-bold px-3 py-1.5"
            disabled={savingSlip || activeTableRows.length === 0}
            onClick={sayimFisiKaydet}
          >
            {savingSlip ? <Spinner animation="border" size="sm" className="me-1" /> : <IconDeviceFloppy size={15} className="me-1" />}
            Sayım Fişi Kaydet
          </Button>

          <Button
            variant="success"
            size="sm"
            className="fw-bold px-4 py-1.5 shadow-sm d-flex align-items-center"
            disabled={metrics.benzersizAdet === 0}
            onClick={fiseAktar}
          >
            <IconArrowRight size={16} className="me-1.5" /> FİŞE AKTAR (F2)
          </Button>
        </div>
      </div>

      {/* ─── 4. ÜRÜNE RFID EPC TANIMLAMA VE EŞLEŞTİRME MODALI ─── */}
      <Modal
        show={assignModalOpen}
        onHide={() => setAssignModalOpen(false)}
        centered
        size="lg"
        contentClassName="bg-white text-dark border-0 shadow-lg"
      >
        <Modal.Header closeButton className="border-bottom bg-light pb-2">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center text-primary">
            <IconNfc size={20} className="me-2 text-warning" /> Ürüne RFID EPC Tanımla & Eşleştir
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          {assignError && (
            <Alert variant="danger" className="py-1 px-3 mb-2 small border">
              <IconAlertTriangle size={15} className="me-1.5 text-danger" /> {assignError}
            </Alert>
          )}

          <Row className="g-3">
            {/* Sol Taraf: Ürün Seçimi */}
            <Col md={6}>
              <div className="p-3 rounded-3 border bg-light h-100 d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-bold text-dark small">1. Hedef Ürünü Seç</span>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className={`btn btn-xs fw-semibold ${targetProductType === "altin" ? "btn-warning text-dark" : "btn-outline-secondary"}`}
                      onClick={() => {
                        setTargetProductType("altin");
                        setSelectedProduct(null);
                      }}
                      style={{ fontSize: "10px" }}
                    >
                      Altın Ürünler
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs fw-semibold ${targetProductType === "ozel" ? "btn-warning text-dark" : "btn-outline-secondary"}`}
                      onClick={() => {
                        setTargetProductType("ozel");
                        setSelectedProduct(null);
                      }}
                      style={{ fontSize: "10px" }}
                    >
                      Özel / Pırlanta
                    </button>
                  </div>
                </div>

                <div className="d-flex align-items-center justify-content-between gap-1 mb-2">
                  <Form.Control
                    type="text"
                    placeholder="Barkod / Model / Grup ile ara..."
                    size="sm"
                    className="bg-white text-dark border shadow-none"
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                  />
                  <Form.Check
                    type="switch"
                    id="untagged-switch-modal"
                    label="Yalnızca Etiketsiz"
                    checked={onlyUntaggedModalFilter}
                    onChange={(e) => setOnlyUntaggedModalFilter(e.target.checked)}
                    className="small text-nowrap text-muted"
                    style={{ fontSize: "10px" }}
                  />
                </div>

                <div className="flex-grow-1 overflow-auto border rounded bg-white p-1" style={{ maxHeight: "200px" }}>
                  {productOptions.length === 0 ? (
                    <div className="text-center py-3 text-muted small">
                      {onlyUntaggedModalFilter ? "Etiketsiz ürün bulunamadı." : "Aramaya uygun ürün bulunamadı."}
                    </div>
                  ) : (
                    productOptions.map((prod: any) => {
                      const id = prod.altinUrunId || prod.ozelUrunId;
                      const isSelected = selectedProduct && (selectedProduct.altinUrunId === id || selectedProduct.ozelUrunId === id);
                      const kod = prod.barkod || `${prod.grupKodu}-${prod.urunNo}`;
                      const ad = prod.model || prod.mamulTipi || `${prod.grupKodu} Ürün`;
                      const hasRfid = Boolean(prod.rfidEpc && prod.rfidEpc.trim().length > 0);

                      return (
                        <div
                          key={id}
                          className={`p-1.5 mb-1 rounded d-flex align-items-center justify-content-between small ${
                            isSelected ? "bg-primary text-white fw-bold shadow-sm" : "hover-bg-light text-dark border-bottom"
                          }`}
                          style={{ cursor: "pointer", fontSize: "11px" }}
                          onClick={() => setSelectedProduct(prod)}
                        >
                          <div>
                            <div className="font-monospace">{kod} - <span className={isSelected ? "text-white" : "text-primary fw-semibold"}>{ad}</span></div>
                            <div className={isSelected ? "text-light" : "text-muted"} style={{ fontSize: "10px" }}>
                              {prod.ayar}K | {prod.miktar || prod.hasGram || 0} gr | {prod.banko || "Vitrin"}
                            </div>
                          </div>
                          {hasRfid ? (
                            <Badge bg="success" style={{ fontSize: "9px" }}>RFID VAR</Badge>
                          ) : (
                            <Badge bg="danger" style={{ fontSize: "9px" }}>ETİKETSİZ</Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedProduct && (
                  <div className="mt-2 p-2 rounded bg-primary bg-opacity-10 border border-primary small">
                    <div className="text-primary fw-bold">Seçili: {selectedProduct.barkod || `${selectedProduct.grupKodu}-${selectedProduct.urunNo}`}</div>
                    <div className="text-dark">{selectedProduct.model || selectedProduct.mamulTipi} ({selectedProduct.ayar}K - {selectedProduct.miktar || selectedProduct.hasGram} gr)</div>
                  </div>
                )}
              </div>
            </Col>

            {/* Sağ Taraf: RFID EPC Belirleme */}
            <Col md={6}>
              <div className="p-3 rounded-3 border bg-light h-100 d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="fw-bold text-dark small">2. RFID EPC Kodu</span>
                  <Button
                    variant="outline-warning"
                    size="sm"
                    className="py-0 px-2 fw-semibold text-dark border-warning"
                    style={{ fontSize: "10px" }}
                    onClick={generateNewEpcCode}
                  >
                    <IconSparkles size={12} className="me-1 text-warning" /> Yeni EPC Üret
                  </Button>
                </div>

                <Form.Group className="mb-2">
                  <Form.Label className="small text-muted mb-1">Eşleştirilecek EPC Kodu (HEX / 24 Karakter):</Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    className="bg-white text-dark border font-monospace fw-bold shadow-none"
                    placeholder="E280... veya LKY..."
                    value={targetEpc}
                    onChange={(e) => setTargetEpc(e.target.value.toUpperCase())}
                  />
                </Form.Group>

                {/* Cihazın Okuduğu Son Etiketler */}
                <div className="flex-grow-1">
                  <div className="text-muted small mb-1" style={{ fontSize: "11px" }}>
                    📡 Cihazın Okuduğu Son RFID Etiketleri (Tıklayarak Seç):
                  </div>
                  <div className="d-flex flex-wrap gap-1 overflow-auto p-1 bg-white rounded border" style={{ maxHeight: "140px" }}>
                    {recentReadEpcs.length === 0 ? (
                      <span className="text-muted small p-2">Henüz cihaz tarafından RFID etiketi okunmadı.</span>
                    ) : (
                      recentReadEpcs.map((epc) => (
                        <Button
                          key={epc}
                          variant={targetEpc === epc ? "primary" : "outline-secondary"}
                          size="sm"
                          className="py-0.5 px-1.5 font-monospace text-truncate"
                          style={{ fontSize: "10px", maxWidth: "100%" }}
                          onClick={() => setTargetEpc(epc)}
                        >
                          🏷️ {epc}
                        </Button>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-2 text-muted small" style={{ fontSize: "10px" }}>
                  ℹ️ Kaydedildiğinde ürün veritabanına (`TODVZ_ALTIN_URUN` / `TODVZ_OZEL_URUN`) doğrudan işlenir ve RFID anteni anında ürünü tanır.
                </div>
              </div>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="border-top bg-light pt-2 justify-content-end gap-2">
          <Button variant="outline-secondary" size="sm" onClick={() => setAssignModalOpen(false)}>
            Vazgeç
          </Button>
          <Button
            variant="warning"
            size="sm"
            className="fw-bold px-3 text-dark d-flex align-items-center shadow-sm"
            disabled={assignLoading || !selectedProduct || !targetEpc.trim()}
            onClick={handleSaveRfidAssignment}
          >
            {assignLoading ? <Spinner animation="border" size="sm" className="me-1.5" /> : <IconDeviceFloppy size={16} className="me-1.5" />}
            SQL Veritabanına Kaydet & Eşleştir
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── 4. DÜRBÜN İLE RFID / ÜRÜN ARAMA VE SEÇİM MODALI ─── */}
      <Modal
        show={searchModalOpen}
        onHide={() => setSearchModalOpen(false)}
        size="xl"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-primary text-white py-2.5 px-3">
          <Modal.Title className="fs-6 fw-bold d-flex align-items-center">
            <IconBinoculars size={20} className="me-2 text-warning" />
            Dürbün ile RFID & Ürün Arama ({searchModalResults.length} Kayıt)
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
            <InputGroup size="sm" style={{ maxWidth: "480px" }}>
              <InputGroup.Text className="bg-white text-primary border">
                <IconBinoculars size={16} />
              </InputGroup.Text>
              <Form.Control
                type="text"
                placeholder="Barkod, RFID EPC, Grup, Model, Banko ile filtreleyin..."
                className="border shadow-none fw-semibold"
                value={searchModalQuery}
                onChange={(e) => setSearchModalQuery(e.target.value)}
                autoFocus
              />
              {searchModalQuery && (
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => setSearchModalQuery("")}
                >
                  <IconX size={14} />
                </Button>
              )}
            </InputGroup>
            <span className="text-muted small d-none d-md-inline">
              💡 Listeden ürünü seçtiğinizde anında sayım tablosuna <b>Okundu</b> olarak eklenir.
            </span>
          </div>

          <div className="table-responsive border rounded" style={{ maxHeight: "420px", overflowY: "auto" }}>
            <Table hover className="mb-0 text-nowrap align-middle" style={{ fontSize: "12px" }}>
              <thead className="sticky-top bg-light text-dark" style={{ borderBottom: "2px solid #cbd5e1" }}>
                <tr>
                  <th style={{ width: "40px" }}>#</th>
                  <th style={{ width: "80px" }}>TİP</th>
                  <th>BARKOD / STOK</th>
                  <th>RFID EPC KODU</th>
                  <th>ÜRÜN ADI / MODEL</th>
                  <th style={{ width: "60px" }}>AYAR</th>
                  <th style={{ width: "80px" }}>BRÜT (GR)</th>
                  <th>BANKO / TABLA</th>
                  <th style={{ width: "90px" }}>DURUM</th>
                  <th style={{ width: "110px" }} className="text-end">İŞLEM</th>
                </tr>
              </thead>
              <tbody>
                {searchModalResults.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-4 text-muted">
                      Aradığınız kritere uygun ürün bulunamadı.
                    </td>
                  </tr>
                ) : (
                  searchModalResults.map((p, idx) => {
                    const isAlreadyScanned = scannedMap.has((p.epc || p.barkod || "").toUpperCase());
                    return (
                      <tr key={p.id || idx}>
                        <td className="text-muted font-monospace">{idx + 1}</td>
                        <td>
                          {p.productType === "altin" ? (
                            <Badge bg="warning" className="text-dark" style={{ fontSize: "10px" }}>ALTIN</Badge>
                          ) : (
                            <Badge bg="info" className="text-dark" style={{ fontSize: "10px" }}>ÖZEL/PIRLANTA</Badge>
                          )}
                        </td>
                        <td className="fw-bold font-monospace text-primary">{p.displayStok}</td>
                        <td>
                          {p.epc ? (
                            <Badge bg="light" className="text-dark border font-monospace" style={{ fontSize: "11px" }}>
                              🏷️ {p.epc}
                            </Badge>
                          ) : (
                            <Badge bg="secondary" style={{ fontSize: "10px" }}>RFID TANIMSIZ</Badge>
                          )}
                        </td>
                        <td className="fw-semibold text-dark">{p.displayAd}</td>
                        <td className="font-monospace fw-bold">{p.displayAyar}K</td>
                        <td className="font-monospace fw-bold text-dark">{Number(p.displayMiktar).toFixed(2)} gr</td>
                        <td>
                          <Badge bg="light" className="text-dark border" style={{ fontSize: "11px" }}>
                            📍 {p.displayBanko}
                          </Badge>
                        </td>
                        <td>
                          {isAlreadyScanned ? (
                            <Badge bg="success" style={{ fontSize: "10px" }}>✅ OKUNDU</Badge>
                          ) : (
                            <Badge bg="light" className="text-muted border" style={{ fontSize: "10px" }}>⏳ BEKLİYOR</Badge>
                          )}
                        </td>
                        <td className="text-end">
                          <Button
                            size="sm"
                            variant={isAlreadyScanned ? "outline-success" : "success"}
                            className="py-1 px-2.5 fw-bold d-inline-flex align-items-center shadow-sm"
                            style={{ fontSize: "11px" }}
                            onClick={() => handleSelectProductFromSearchModal(p)}
                          >
                            <IconCheck size={14} className="me-1" />
                            {isAlreadyScanned ? "Tekrar Oku" : "Seç & Oku"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer className="border-top bg-light py-2 px-3 justify-content-end">
          <Button variant="outline-secondary" size="sm" onClick={() => setSearchModalOpen(false)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ─── BİLDİRİM / UYARI POPUP MODALI (ORTADA AÇILIR) ─── */}
      <Modal
        show={Boolean(notifyModal?.show)}
        onHide={() => setNotifyModal(null)}
        centered
        size="sm"
        backdrop="static"
      >
        <Modal.Body className="text-center p-4">
          <div className="d-flex justify-content-center mb-3">
            {notifyModal?.type === "success" && (
              <div
                className="d-flex align-items-center justify-content-center rounded-circle bg-success bg-opacity-10 text-success"
                style={{ width: "56px", height: "56px" }}
              >
                <IconCheck size={30} />
              </div>
            )}
            {notifyModal?.type === "warning" && (
              <div
                className="d-flex align-items-center justify-content-center rounded-circle bg-warning bg-opacity-10 text-warning"
                style={{ width: "56px", height: "56px" }}
              >
                <IconAlertTriangle size={30} />
              </div>
            )}
            {notifyModal?.type === "danger" && (
              <div
                className="d-flex align-items-center justify-content-center rounded-circle bg-danger bg-opacity-10 text-danger"
                style={{ width: "56px", height: "56px" }}
              >
                <IconAlertTriangle size={30} />
              </div>
            )}
            {notifyModal?.type === "info" && (
              <div
                className="d-flex align-items-center justify-content-center rounded-circle bg-primary bg-opacity-10 text-primary"
                style={{ width: "56px", height: "56px" }}
              >
                <IconInfoCircle size={30} />
              </div>
            )}
          </div>

          <h5 className="fw-bold text-dark mb-2">
            {notifyModal?.title || (notifyModal?.type === "success" ? "Başarılı" : notifyModal?.type === "danger" ? "Hata" : "Bilgi")}
          </h5>

          <p className="text-secondary small mb-4" style={{ whiteSpace: "pre-line" }}>
            {notifyModal?.message}
          </p>

          <Button
            variant={notifyModal?.type === "danger" ? "danger" : notifyModal?.type === "warning" ? "warning" : "dark"}
            className="w-100 py-2 fw-semibold shadow-sm"
            onClick={() => setNotifyModal(null)}
          >
            Tamam
          </Button>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default RfidSayimPage;

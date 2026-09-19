import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Table,
  Badge,
  InputGroup,
  Modal,
  Spinner,
} from "react-bootstrap";
import {
  IconBarcode,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconFileCheck,
  IconSearch,
  IconBinoculars,
  IconUser,
  IconRefresh,
  IconDeviceFloppy,
  IconHistory,
  IconCheck,
  IconX,
  IconTrash,
  IconCurrencyLira,
  IconEdit,
} from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import LookupModal, { LookupColumn } from "../../components/common/LookupModal";
import {
  PerakendeService,
  PerakendeUrunItem,
  PerakendeFaturaModel,
  SavePerakendeFaturaPayload,
  SavePerakendeFaturaSatiriPayload,
  PerakendeFaturaListItem,
} from "../../services/perakendeService";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { CariService, CariKartItem, CariLookups } from "../../services/cariService";
import { DovizFisService, KayitsizMusteriItem } from "../../services/dovizFisService";
import { EtiketService, AltinUrunItem, OzelUrunItem } from "../../services/etiketService";
import { AyarService, AyarItem } from "../../services/ayarService";
import { AyarSecimModal } from "../../components/common/AyarSecimModal";
import { MusteriSecimModal, SelectedCustomerResult } from "./MusteriSecimModal";
import { PerakendeFisiPrintModal } from "./PerakendeFisiPrintModal";
import { SarrafFisService } from "../../services/sarrafFisService";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";

interface CartLineItem {
  id: string;
  altinUrunId?: number | null;
  barkod: string;
  urunAdi: string;
  ayar: string;
  miktar: number | string;
  birim: string;
  gram: number | string;
  hasGram: number | string;
  birimFiyat: number | string;
  tutar: number | string;
  kdvOrani: number | string;
  kdvTutari: number | string;
  toplamTutar: number | string;
}

const GRID_COLS = [
  "barkod",
  "urunAdi",
  "ayar",
  "miktar",
  "birim",
  "gram",
  "hasGram",
  "birimFiyat",
  "kdvOrani",
] as const;
type GridColKey = typeof GRID_COLS[number];

const makeId = () => `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const createEmptyRow = (): CartLineItem => ({
  id: makeId(),
  altinUrunId: null,
  barkod: "",
  urunAdi: "",
  ayar: "14K",
  miktar: 1,
  birim: "Adet",
  gram: "",
  hasGram: "",
  birimFiyat: "",
  tutar: "",
  kdvOrani: 0,
  kdvTutari: "",
  toplamTutar: "",
});

const isRowEmpty = (row?: CartLineItem): boolean => {
  if (!row) return true;
  const hasBarkod = Boolean(row.barkod && String(row.barkod).trim());
  const hasUrunAdi = Boolean(row.urunAdi && String(row.urunAdi).trim());
  const hasGram = Boolean(row.gram !== "" && Number(row.gram) > 0);
  const hasHasGram = Boolean(row.hasGram !== "" && Number(row.hasGram) > 0);
  const hasBirimFiyat = Boolean(row.birimFiyat !== "" && Number(row.birimFiyat) > 0);
  const hasTutar = Boolean(row.tutar !== "" && Number(row.tutar) > 0);
  const hasKdvTutari = Boolean(row.kdvTutari !== "" && Number(row.kdvTutari) > 0);

  return !hasBarkod && !hasUrunAdi && !hasGram && !hasHasGram && !hasBirimFiyat && !hasTutar && !hasKdvTutari;
};

export const PerakendeFisiPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  // Active Loaded Invoice State
  const [currentFaturaId, setCurrentFaturaId] = useState<number | null>(null);

  // Header State
  const [faturaNo, setFaturaNo] = useState<string>("");
  const [tarih, setTarih] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );
  const [saat, setSaat] = useState<string>(
    new Date().toTimeString().substring(0, 5)
  );
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [selectedVezne, setSelectedVezne] = useState<VezneItem | null>(null);
  const [faturaTipi, setFaturaTipi] = useState<number>(1); // 1: Satış, 2: İade
  const [senaryo, setSenaryo] = useState<string>("EARSIVFATURA");

  // Customer State
  const [aliciVknTckn, setAliciVknTckn] = useState<string>("11111111111");
  const [aliciUnvan, setAliciUnvan] = useState<string>("NİHAİ TÜKETİCİ");
  const [cariKartId, setCariKartId] = useState<number | null>(null);
  const [adres, setAdres] = useState<string>("");
  const [ilce, setIlce] = useState<string>("");
  const [il, setIl] = useState<string>("");
  const [vergiDairesi, setVergiDairesi] = useState<string>("");
  const [telefon, setTelefon] = useState<string>("");
  const [eposta, setEposta] = useState<string>("");

  // Barcode & Cart State
  const [barcodeInput, setBarcodeInput] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [items, setItems] = useState<CartLineItem[]>([createEmptyRow()]);
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    rowId: string;
    rowIndex: number;
  } | null>(null);

  // Refs for grid keyboard navigation
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const rowInputRefs = useRef<Record<string, HTMLElement | null>>({});

  // Submitting State & Mutex Ref
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);

  // Modals State
  const [showVezneModal, setShowVezneModal] = useState<boolean>(false);
  const [showMusteriModal, setShowMusteriModal] = useState<boolean>(false);
  const [showProductLookup, setShowProductLookup] = useState<boolean>(false);
  const [showAyarModal, setShowAyarModal] = useState<boolean>(false);
  const [activeAyarRowId, setActiveAyarRowId] = useState<string | null>(null);
  const [cariler, setCariler] = useState<CariKartItem[]>([]);
  const [cariLookups, setCariLookups] = useState<CariLookups | null>(null);
  const [kayitsizMusteriler, setKayitsizMusteriler] = useState<KayitsizMusteriItem[]>([]);
  const [altinList, setAltinList] = useState<AltinUrunItem[]>([]);
  const [ozelList, setOzelList] = useState<OzelUrunItem[]>([]);
  const [isProductLoading, setIsProductLoading] = useState<boolean>(false);

  // Print Preview Modal
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [printedFatura, setPrintedFatura] = useState<PerakendeFaturaModel | null>(null);

  // Invoices History Search Modal
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<PerakendeFaturaListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>("");
  const [historyStartDate, setHistoryStartDate] = useState<string>(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)
  );
  const [historyEndDate, setHistoryEndDate] = useState<string>(
    new Date().toISOString().substring(0, 10)
  );

  // Audio cues (Muted per user request)
  const playBeep = useCallback((_type: "success" | "error") => {
    // Sesler tamamen kapatıldı
  }, []);

  // Safe selection bounds helper
  const getSelectionBounds = (el: any): { isAtStart: boolean; isAtEnd: boolean } => {
    if (!el || !(el instanceof HTMLInputElement)) {
      return { isAtStart: true, isAtEnd: true };
    }
    try {
      const len = el.value ? el.value.length : 0;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      if (typeof start === "number" && typeof end === "number") {
        return {
          isAtStart: start === 0,
          isAtEnd: end === len,
        };
      }
    } catch { }
    return { isAtStart: true, isAtEnd: true };
  };

  // Focus Grid Cell Helper
  const focusGridCell = (
    rowId: string,
    field: GridColKey,
    mode: "select" | "start" | "end" = "select"
  ) => {
    const el = rowInputRefs.current[`${rowId}_${field}`];
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement) {
        try {
          if (mode === "select") {
            el.select();
          } else if (mode === "start") {
            el.setSelectionRange(0, 0);
          } else if (mode === "end") {
            const len = el.value ? el.value.length : 0;
            el.setSelectionRange(len, len);
          }
        } catch { }
      }
    }
  };

  // Initial Next Number
  const loadNextNo = useCallback(async () => {
    try {
      const prefix = senaryo === "EARSIVFATURA" ? "EAR" : "GIB";
      const nextNo = await PerakendeService.getNextFaturaNo(prefix);
      setFaturaNo(nextNo);
    } catch {
      const year = new Date().getFullYear();
      setFaturaNo(`GIB${year}000000001`);
    }
  }, [senaryo]);

  // Load Products for Lookup
  const loadProductsForLookup = useCallback(async () => {
    setIsProductLoading(true);
    try {
      const [altin, ozel] = await Promise.all([
        EtiketService.getAltinUrunler({ limit: 500 }).catch(() => []),
        EtiketService.getOzelUrunler({ limit: 500 }).catch(() => []),
      ]);
      setAltinList(altin || []);
      setOzelList(ozel || []);
    } catch {
      // ignore
    } finally {
      setIsProductLoading(false);
    }
  }, []);

  // Helper to determine the logged-in user's assigned vezne
  const resolveUserVezne = useCallback(
    async (list: VezneItem[]): Promise<VezneItem | undefined> => {
      if (!list || list.length === 0) return undefined;

      let userVezneId: number | null = null;
      if (user?.id) {
        userVezneId = await SarrafFisService.getUserVezneId(Number(user.id)).catch(() => null);
      }

      if (userVezneId) {
        const uv = list.find((v) => v.id === userVezneId);
        if (uv) return uv;
      }

      if (user?.cashierCode) {
        const target = String(user.cashierCode).trim().toLowerCase();
        const uv = list.find(
          (v) =>
            String(v.id).toLowerCase() === target ||
            v.kod.toLowerCase() === target ||
            String(v.kod).toLowerCase() === target
        );
        if (uv) return uv;
      }

      return list[0];
    },
    [user?.id, user?.cashierCode]
  );

  useEffect(() => {
    CashDeskService.getVezneler()
      .then(async (data) => {
        const list = data || [];
        setVezneler(list);
        if (list.length > 0) {
          const uv = await resolveUserVezne(list);
          if (uv) setSelectedVezne(uv);
        }
      })
      .catch(console.error);

    CariService.getCariKartlar()
      .then(setCariler)
      .catch(console.error);

    CariService.getLookups()
      .then(setCariLookups)
      .catch(console.error);

    DovizFisService.getKayitsizMusteriler()
      .then(setKayitsizMusteriler)
      .catch(console.error);

    // Fatura No varsayılan olarak boş gelir, boş bırakılırsa kayıtta numaratörden otomatik üretilir.
    loadProductsForLookup();

    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 150);
  }, [loadProductsForLookup, resolveUserVezne]);

  // Recalculate Totals for single row
  const recalculateLine = (line: Partial<CartLineItem>): CartLineItem => {
    const miktar = Number(line.miktar) || 0;
    const birimFiyat = Number(line.birimFiyat) || 0;
    const kdvOrani = Number(line.kdvOrani) || 0;
    const tutar = Math.round(miktar * birimFiyat * 100) / 100;
    const kdvTutari = Math.round(tutar * (kdvOrani / 100) * 100) / 100;
    const toplamTutar = Math.round((tutar + kdvTutari) * 100) / 100;

    return {
      id: line.id || makeId(),
      altinUrunId: line.altinUrunId ?? null,
      barkod: line.barkod || "",
      urunAdi: line.urunAdi || "",
      ayar: line.ayar || "14K",
      miktar: line.miktar === "" ? "" : miktar,
      birim: line.birim || "Adet",
      gram: line.gram === "" ? "" : (Number(line.gram) || 0),
      hasGram: line.hasGram === "" ? "" : (Number(line.hasGram) || 0),
      birimFiyat: line.birimFiyat === "" ? "" : birimFiyat,
      tutar: tutar > 0 ? tutar : (line.tutar === "" ? "" : 0),
      kdvOrani: line.kdvOrani === "" ? "" : kdvOrani,
      kdvTutari: kdvTutari > 0 ? kdvTutari : (line.kdvTutari === "" ? "" : 0),
      toplamTutar: toplamTutar > 0 ? toplamTutar : (line.toplamTutar === "" ? "" : 0),
    };
  };

  // Add Product to Cart
  const addProductToCart = (product: {
    altinUrunId?: number | null;
    barkod: string;
    urunAdi: string;
    ayar?: string | null;
    miktar?: number;
    birim?: string;
    gram?: number;
    hasGram?: number;
    satisFiyati?: number;
    kdvOrani?: number;
  }) => {
    const populated = recalculateLine({
      altinUrunId: product.altinUrunId ?? null,
      barkod: product.barkod,
      urunAdi: product.urunAdi || "Altın Ürün",
      ayar: product.ayar || "14K",
      miktar: product.miktar || 1,
      birim: product.birim || "Adet",
      gram: product.gram || 0,
      hasGram: product.hasGram || 0,
      birimFiyat: product.satisFiyati || 0,
      kdvOrani: product.kdvOrani ?? 0,
    });

    setItems((prev) => {
      // If there is any empty row in the table, populate that row instead of adding a new one
      const emptyIdx = prev.findIndex(
        (r) => !r.barkod?.trim() && !r.urunAdi?.trim() && (!r.birimFiyat || Number(r.birimFiyat) === 0)
      );

      if (emptyIdx >= 0) {
        const next = [...prev];
        next[emptyIdx] = { ...populated, id: prev[emptyIdx].id };
        setActiveRowIndex(emptyIdx);
        return next;
      } else {
        setActiveRowIndex(prev.length);
        return [...prev, populated];
      }
    });

    showSuccess(`Ürün eklendi: ${product.urunAdi} (${product.barkod})`);
    playBeep("success");
    setBarcodeInput("");
  };

  // Barcode Lookup Handler (from main scanner input)
  const handleBarcodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const barcode = barcodeInput.trim();
    if (!barcode) return;

    // Check if barcode already in cart
    const existingIndex = items.findIndex(
      (item) => item.barkod && item.barkod.toLowerCase() === barcode.toLowerCase()
    );

    if (existingIndex >= 0) {
      showWarning(`'${barcode}' barkodlu ürün zaten tabloda eklenmiş!`);
      playBeep("error");
      setBarcodeInput("");
      barcodeInputRef.current?.focus();
      return;
    }

    setIsScanning(true);
    try {
      const product = await PerakendeService.getProductByBarcode(barcode);
      if (product) {
        addProductToCart({
          altinUrunId: product.altinUrunId,
          barkod: product.barkod,
          urunAdi: product.urunAdi,
          ayar: product.ayar,
          miktar: product.miktar,
          birim: product.birim,
          gram: product.gram,
          hasGram: product.hasGram,
          satisFiyati: product.satisFiyati,
          kdvOrani: product.kdvOrani,
        });
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || `'${barcode}' barkodlu ürün bulunamadı.`;
      showError(msg);
      playBeep("error");
    } finally {
      setIsScanning(false);
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    }
  };

  // Product Selection from Dürbün (LookupModal)
  const handleSelectFromProductLookup = async (
    item: { tip: "altin" | "ozel"; item: AltinUrunItem | OzelUrunItem }
  ) => {
    const raw = item.item;
    const barcode = raw.barkod || `${raw.grupKodu}${raw.urunNo}`;
    const urunAdi =
      item.tip === "altin"
        ? (raw as AltinUrunItem).model || "Altın Takı / Ziynet"
        : (raw as OzelUrunItem).mamulTipi || "Özel Ürün";

    const hasGram = Number((raw as any).hasGram) || 0;
    const gram = Number((raw as any).gram) || (hasGram > 0 ? Number((hasGram * 1.05).toFixed(2)) : (Number(raw.miktar) || 1));

    addProductToCart({
      altinUrunId: (raw as any).altinUrunId ?? null,
      barkod: barcode,
      urunAdi,
      ayar: raw.ayar || "14K",
      miktar: raw.miktar || 1,
      birim: (raw as any).birim || "Adet",
      gram,
      hasGram,
      satisFiyati: Number(raw.satisFiyati) || 0,
      kdvOrani: 0,
    });

    setShowProductLookup(false);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  // Combined Lookup Items for Product Search Modal
  const combinedLookupItems: { tip: "altin" | "ozel"; item: AltinUrunItem | OzelUrunItem }[] = [
    ...altinList.map((it) => ({ tip: "altin" as const, item: it })),
    ...ozelList.map((it) => ({ tip: "ozel" as const, item: it })),
  ];

  const productLookupColumns: LookupColumn<{ tip: "altin" | "ozel"; item: AltinUrunItem | OzelUrunItem }>[] = [
    {
      header: "Tip",
      width: "70px",
      align: "center",
      render: (it) => (
        <Badge bg={it.tip === "altin" ? "warning" : "info"} className="text-dark fw-bold">
          {it.tip === "altin" ? "Altın" : "Özel"}
        </Badge>
      ),
    },
    {
      header: "Barkod",
      width: "120px",
      render: (it) => (
        <span className="font-monospace fw-bold text-primary">{it.item.barkod || "-"}</span>
      ),
    },
    {
      header: "Açıklama / Model",
      render: (it) =>
        (it.tip === "altin"
          ? (it.item as AltinUrunItem).model
          : (it.item as OzelUrunItem).mamulTipi) || "-",
    },
    {
      header: "Ayar",
      width: "70px",
      align: "center",
      render: (it) => <span>{it.item.ayar || "-"}</span>,
    },
    {
      header: "Has Gram",
      width: "90px",
      align: "right",
      render: (it) => (
        <span className="font-monospace">{Number((it.item as any).hasGram || 0).toFixed(3)}</span>
      ),
    },
    {
      header: "Satış Fiyatı",
      width: "110px",
      align: "right",
      render: (it) => (
        <span className="font-monospace fw-bold text-dark">
          {Number(it.item.satisFiyati || 0).toLocaleString("tr-TR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          ₺
        </span>
      ),
    },
  ];

  // Update Item in Cart
  const handleUpdateItem = (id: string, updates: Partial<CartLineItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return recalculateLine({ ...item, ...updates });
        }
        return item;
      })
    );
  };

  // Keyboard Navigation across Table Grid Cells
  const handleGridKeyDown = (
    e: React.KeyboardEvent<HTMLElement>,
    rowIndex: number,
    colKey: GridColKey,
    rowId: string
  ) => {
    const colIdx = GRID_COLS.indexOf(colKey);
    const totalCols = GRID_COLS.length;
    const { isAtStart, isAtEnd } = getSelectionBounds(e.currentTarget);

    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      e.preventDefault();

      // If user typed a barcode in the barcode cell and pressed enter, resolve it
      if (colKey === "barkod") {
        const row = items[rowIndex];
        const val = (String(row.barkod) || "").trim();
        if (val) {
          PerakendeService.getProductByBarcode(val)
            .then((product) => {
              if (product) {
                setItems((prev) =>
                  prev.map((r) =>
                    r.id === rowId
                      ? recalculateLine({
                        ...r,
                        altinUrunId: product.altinUrunId,
                        barkod: product.barkod,
                        urunAdi: product.urunAdi || "Altın Ürün",
                        ayar: product.ayar || "14K",
                        miktar: product.miktar || 1,
                        birim: product.birim || "Adet",
                        gram: product.gram || 0,
                        hasGram: product.hasGram || 0,
                        birimFiyat: product.satisFiyati || 0,
                        kdvOrani: product.kdvOrani ?? 0,
                      })
                      : r
                  )
                );
                playBeep("success");
                focusGridCell(rowId, "miktar", "select");
              }
            })
            .catch(() => {
              playBeep("error");
              setShowProductLookup(true);
            });
          return;
        } else {
          setShowProductLookup(true);
          return;
        }
      }

      if (colKey === "ayar") {
        const row = items[rowIndex];
        const val = (String(row.ayar) || "").trim();
        if (!val) {
          setActiveAyarRowId(rowId);
          setShowAyarModal(true);
          return;
        }
      }

      // Next column in same row
      if (colIdx + 1 < totalCols) {
        const nk = GRID_COLS[colIdx + 1];
        focusGridCell(rowId, nk, "select");
      } else {
        // Last column in row -> jump to next row or create a new row!
        if (rowIndex < items.length - 1) {
          const nr = items[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "barkod", "select");
        } else {
          // If current row is completely empty, do NOT create another new empty row
          const currentRow = items[rowIndex];
          if (isRowEmpty(currentRow)) {
            focusGridCell(currentRow.id, "barkod", "select");
            return;
          }

          const newRow = createEmptyRow();
          setItems((prev) => [...prev, newRow]);
          setActiveRowIndex(rowIndex + 1);
          setTimeout(() => focusGridCell(newRow.id, "barkod", "select"), 30);
        }
      }
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (colIdx > 0) {
        const pk = GRID_COLS[colIdx - 1];
        focusGridCell(rowId, pk, "select");
      } else if (rowIndex > 0) {
        const pr = items[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, GRID_COLS[totalCols - 1], "select");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (rowIndex < items.length - 1) {
        const nr = items[rowIndex + 1];
        setActiveRowIndex(rowIndex + 1);
        focusGridCell(nr.id, colKey, "select");
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (rowIndex > 0) {
        const pr = items[rowIndex - 1];
        setActiveRowIndex(rowIndex - 1);
        focusGridCell(pr.id, colKey, "select");
      } else {
        barcodeInputRef.current?.focus();
      }
    } else if (e.key === "ArrowRight") {
      if (isAtEnd) {
        e.preventDefault();
        if (colIdx + 1 < totalCols) {
          const nk = GRID_COLS[colIdx + 1];
          focusGridCell(rowId, nk, "start");
        } else if (rowIndex < items.length - 1) {
          const nr = items[rowIndex + 1];
          setActiveRowIndex(rowIndex + 1);
          focusGridCell(nr.id, "barkod", "start");
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (isAtStart) {
        e.preventDefault();
        if (colIdx > 0) {
          const pk = GRID_COLS[colIdx - 1];
          focusGridCell(rowId, pk, "end");
        } else if (rowIndex > 0) {
          const pr = items[rowIndex - 1];
          setActiveRowIndex(rowIndex - 1);
          focusGridCell(pr.id, GRID_COLS[totalCols - 1], "end");
        }
      }
    }
  };

  // Add New Row (Right Click / Context Menu)
  const handleAddRow = (afterIndex?: number) => {
    const targetIndex = typeof afterIndex === "number" ? afterIndex : items.length - 1;
    const targetRow = items[targetIndex];

    // Eğer satır komple boş ise sağ tık yapıp yeni satır ekleye basınca hiçbir şey olmasın
    if (isRowEmpty(targetRow)) {
      if (targetRow) {
        focusGridCell(targetRow.id, "barkod", "select");
      }
      return;
    }

    // Herhangi bir yer dolu ise yeni satır eklesin
    const newRow = createEmptyRow();
    if (typeof afterIndex === "number" && afterIndex >= 0 && afterIndex < items.length) {
      setItems((prev) => {
        const next = [...prev];
        next.splice(afterIndex + 1, 0, newRow);
        return next;
      });
      setActiveRowIndex(afterIndex + 1);
    } else {
      setItems((prev) => [...prev, newRow]);
      setActiveRowIndex(items.length);
    }
    setTimeout(() => focusGridCell(newRow.id, "barkod", "select"), 30);
  };

  // Delete Row (Right Click / Context Menu)
  const handleDeleteRow = (targetRowIdOrIndex: string | number) => {
    setItems((prev) => {
      let next: CartLineItem[];
      if (typeof targetRowIdOrIndex === "number") {
        next = prev.filter((_, idx) => idx !== targetRowIdOrIndex);
      } else {
        next = prev.filter((r) => r.id !== targetRowIdOrIndex);
      }
      if (next.length === 0) {
        return [createEmptyRow()];
      }
      return next;
    });
    showSuccess("Satır silindi");
  };

  // Global click & contextmenu event listener for ERPContextMenu integration
  useEffect(() => {
    const handleErpRowDelete = (e: any) => {
      const rowId = e.detail?.rowId;
      if (rowId) {
        handleDeleteRow(rowId);
      }
    };

    const handleErpRowAdd = () => {
      handleAddRow();
    };

    const handleWindowClick = () => {
      setContextMenu(null);
    };

    window.addEventListener("erp-grid-row-delete", handleErpRowDelete);
    window.addEventListener("erp-grid-row-add", handleErpRowAdd);
    window.addEventListener("click", handleWindowClick);
    window.addEventListener("scroll", handleWindowClick, true);

    return () => {
      window.removeEventListener("erp-grid-row-delete", handleErpRowDelete);
      window.removeEventListener("erp-grid-row-add", handleErpRowAdd);
      window.removeEventListener("click", handleWindowClick);
      window.removeEventListener("scroll", handleWindowClick, true);
    };
  }, [items]);

  // Reset / New (F1 / Toolbar onNew)
  const handleReset = async () => {
    setCurrentFaturaId(null);
    setItems([createEmptyRow()]);
    setActiveRowIndex(0);
    setAliciVknTckn("11111111111");
    setAliciUnvan("NİHAİ TÜKETİCİ");
    setCariKartId(null);
    setAdres("");
    setIlce("");
    setIl("");
    setVergiDairesi("");
    setTelefon("");
    setEposta("");
    setFaturaTipi(1);
    setSenaryo("EARSIVFATURA");
    setFaturaNo("");

    if (vezneler.length > 0) {
      const uv = await resolveUserVezne(vezneler);
      if (uv) setSelectedVezne(uv);
    }

    showInfo("Yeni satış formu hazırlandı");
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  // Quick Nihai Tüketici
  const handleSetNihaiTuketici = () => {
    setAliciVknTckn("11111111111");
    setAliciUnvan("NİHAİ TÜKETİCİ");
    setCariKartId(null);
    setAdres("");
    setIlce("");
    setIl("");
    setVergiDairesi("");
    setTelefon("");
    setEposta("");
    showInfo("Müşteri 'NİHAİ TÜKETİCİ' olarak ayarlandı");
  };

  // Customer selection from Modal
  const handleSelectCustomer = async (res: SelectedCustomerResult) => {
    setAliciUnvan(res.unvan);
    setAliciVknTckn(res.vergiKimlikNo || "11111111111");
    setAdres(res.adres || "");
    setTelefon(res.telefon || "");

    let lookups = cariLookups;
    if (!lookups) {
      try {
        lookups = await CariService.getLookups();
        setCariLookups(lookups);
      } catch { }
    }

    if (res.type === "registered" && res.id) {
      setCariKartId(res.id);
      const raw = res.raw as any;
      if (raw) {
        const vdName =
          raw.vergiDairesi ||
          lookups?.vergiDairesiList?.find((x) => x.id === raw.vergiDairesiId)?.ad ||
          "";
        const ilName =
          raw.il ||
          lookups?.ilList?.find((x) => x.id === raw.ilId)?.ad ||
          "";
        const ilceName =
          raw.ilce ||
          lookups?.ilceList?.find((x) => x.id === raw.ilceId)?.ad ||
          "";

        setVergiDairesi(vdName);
        setIl(ilName);
        setIlce(ilceName);
        if (raw.adres) setAdres(raw.adres);
        if (raw.telefon) setTelefon(raw.telefon);
        if (raw.eposta) setEposta(raw.eposta);
      }
    } else if (res.type === "unregistered") {
      setCariKartId(null);
      const raw = res.raw as any;
      if (raw) {
        const vdName =
          raw.vergiDairesi ||
          lookups?.vergiDairesiList?.find((x) => x.id === raw.vergiDairesiId)?.ad ||
          "";
        const ilName =
          raw.il ||
          lookups?.ilList?.find((x) => x.id === raw.ilId)?.ad ||
          "";
        const ilceName =
          raw.ilce ||
          lookups?.ilceList?.find((x) => x.id === raw.ilceId)?.ad ||
          "";

        setVergiDairesi(vdName);
        setIl(ilName);
        setIlce(ilceName);
        if (raw.adres) setAdres(raw.adres);
        if (raw.telefon) setTelefon(raw.telefon);
        if (raw.eposta) setEposta(raw.eposta);
      }
    } else {
      setCariKartId(null);
      setVergiDairesi("");
      setIl("");
      setIlce("");
      setEposta("");
    }
    setShowMusteriModal(false);
    showSuccess(`Müşteri seçildi: ${res.unvan}`);
    setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 50);
  };

  // Valid non-empty items
  const validItems = items.filter(
    (i) => (i.barkod && i.barkod.trim()) || (i.urunAdi && i.urunAdi.trim()) || Number(i.birimFiyat) > 0
  );

  // Complete Sale & Save Invoice
  // withPrint = false -> F1 / Normal Kaydet (düz kaydeder, yazdırma modalı açılmaz)
  // withPrint = true  -> F9 / Kaydet & Yazdır (faturayı kaydeder ve yazdırma modalını açar)
  const handleCompleteSale = async (withPrint: boolean = false) => {
    if (isSubmittingRef.current) return;

    if (validItems.length === 0) {
      showError("Fatura oluşturmak için sepete en az 1 adet ürün eklemelisiniz!");
      barcodeInputRef.current?.focus();
      return;
    }

    const cleanVkn = (aliciVknTckn || "").replace(/\D/g, "");
    if (cleanVkn.length !== 10 && cleanVkn.length !== 11) {
      showWarning("TCKN (11 hane) veya VKN (10 hane) geçerli uzunlukta olmalıdır!");
    }

    if (!aliciUnvan.trim()) {
      showError("Alıcı Ünvanı / Müşteri Adı boş bırakılamaz!");
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      const payloadSatirlar: SavePerakendeFaturaSatiriPayload[] = validItems.map((item) => ({
        altinUrunId: item.altinUrunId,
        barkod: item.barkod,
        urunAdi: item.urunAdi || "Altın Ürün",
        ayar: item.ayar,
        miktar: Number(item.miktar) || 1,
        birim: item.birim,
        gram: Number(item.gram) || 0,
        hasGram: Number(item.hasGram) || 0,
        birimFiyat: Number(item.birimFiyat) || 0,
        kdvOrani: Number(item.kdvOrani) || 0,
      }));

      const payload: SavePerakendeFaturaPayload = {
        faturaId: currentFaturaId,
        vezneId: selectedVezne?.id || 1,
        faturaNo: faturaNo.trim(),
        tarih: `${tarih}T${saat}:00`,
        faturaTipi,
        senaryo,
        cariKartId,
        aliciVknTckn: cleanVkn || "11111111111",
        aliciUnvan: aliciUnvan.trim(),
        adres: adres.trim() || undefined,
        ilce: ilce.trim() || undefined,
        il: il.trim() || undefined,
        vergiDairesi: vergiDairesi.trim() || undefined,
        telefon: telefon.trim() || undefined,
        eposta: eposta.trim() || undefined,
        paraId: 1, // TL
        kur: 1.0,
        satirlar: payloadSatirlar,
      };

      const result = await PerakendeService.createInvoice(payload);

      showSuccess(`Fatura başarıyla kaydedildi! (No: ${result.faturaNo})`);

      if (withPrint) {
        setPrintedFatura(result);
        setShowPrintModal(true);
      }

      handleReset();
    } catch (err: any) {
      const msg =
        err.response?.data?.message || err.message || "Fatura ve satış kaydedilirken bir hata oluştu.";
      showError(msg);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Invoices History (Toolbar onSearch / F3)
  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const list = await PerakendeService.listInvoices({
        baslangicTarihi: historyStartDate,
        bitisTarihi: historyEndDate,
        search: historySearch || undefined,
      });
      setHistoryList(list);
    } catch {
      showError("Geçmiş faturalar yüklenemedi");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSearchHistory = async () => {
    setHistoryLoading(true);
    try {
      const list = await PerakendeService.listInvoices({
        baslangicTarihi: historyStartDate,
        bitisTarihi: historyEndDate,
        search: historySearch || undefined,
      });
      setHistoryList(list);
    } catch {
      showError("Arama hatası");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSelectInvoiceForEdit = async (id: number) => {
    try {
      const response = await PerakendeService.getInvoiceById(id);
      if (!response) {
        showError("Fatura detayı bulunamadı");
        return;
      }

      let inv: any = response;
      if (inv && inv.data && typeof inv.data === "object" && !Array.isArray(inv.data)) {
        inv = inv.data;
      }
      if (inv && inv.data && typeof inv.data === "object" && !Array.isArray(inv.data)) {
        inv = inv.data;
      }

      setCurrentFaturaId(inv.faturaId || inv.FATURA_ID || id);
      setFaturaNo(inv.faturaNo || inv.FATURA_NO || "");
      const invDate = inv.tarih || inv.TARIH;
      if (invDate) {
        const d = new Date(invDate);
        if (!isNaN(d.getTime())) {
          setTarih(d.toISOString().slice(0, 10));
          setSaat(d.toTimeString().slice(0, 5));
        }
      }
      setFaturaTipi(inv.faturaTipi ?? inv.FATURA_TIPI ?? 1);
      setSenaryo(inv.senaryo || inv.SENARYO || "EARSIVFATURA");
      setCariKartId(inv.cariKartId ?? inv.CARI_KART_ID ?? null);
      setAliciVknTckn(inv.aliciVknTckn || inv.ALICI_VKN_TCKN || "11111111111");
      setAliciUnvan(inv.aliciUnvan || inv.ALICI_UNVAN || "NİHAİ TÜKETİCİ");
      setAdres(inv.adres || inv.ADRES || "");
      setIlce(inv.ilce || inv.ILCE || "");
      setIl(inv.il || inv.IL || "");
      setVergiDairesi(inv.vergiDairesi || inv.VERGI_DAIRESI || "");
      setEposta(inv.eposta || inv.EPOSTA || "");
      setTelefon(inv.telefon || inv.TELEFON || "");

      const vezId = inv.vezneId ?? inv.VEZNE_ID;
      if (vezId && vezneler.length > 0) {
        const matchedVezne = vezneler.find((v) => v.id === vezId);
        if (matchedVezne) setSelectedVezne(matchedVezne);
      }

      const rawLines: any[] =
        inv.satirlar ||
        inv.SATIRLAR ||
        inv.lines ||
        inv.LINES ||
        inv.items ||
        inv.ITEMS ||
        [];

      if (rawLines && rawLines.length > 0) {
        const mappedRows: CartLineItem[] = rawLines.map((s: any, idx: number) => {
          const m = Number(s.miktar ?? s.MIKTAR ?? s.quantity ?? s.adet) || 1;
          const f = Number(s.birimFiyat ?? s.BIRIM_FIYAT ?? s.unitPrice ?? s.fiyat) || 0;
          const tutar = Number(s.tutar ?? s.TUTAR ?? s.total) || Math.round(m * f * 100) / 100;
          const kdvRate = Number(s.kdvOrani ?? s.KDV_ORANI ?? s.vatRate ?? s.kdv) || 0;
          const kdvTutari =
            Number(s.kdvTutari ?? s.KDV_TUTARI ?? s.vatAmount) ||
            Math.round(tutar * (kdvRate / 100) * 100) / 100;
          const toplamTutar =
            Number(s.toplamTutar ?? s.TOPLAM_TUTAR ?? s.grandTotal) ||
            Math.round((tutar + kdvTutari) * 100) / 100;

          return {
            id: s.faturaSatirId ? `row_${s.faturaSatirId}` : s.id ? `row_${s.id}` : makeId(),
            altinUrunId: s.altinUrunId ?? s.ALTIN_URUN_ID ?? null,
            barkod: (s.barkod || s.BARKOD || "").toString(),
            urunAdi: (s.urunAdi || s.URUN_ADI || "Altın Ürün").toString(),
            ayar: (s.ayar || s.AYAR || "").toString(),
            miktar: m,
            birim: (s.birim || s.BIRIM || "Adet").toString(),
            gram: Number(s.gram ?? s.GRAM) || 0,
            hasGram: Number(s.hasGram ?? s.HAS_GRAM) || 0,
            birimFiyat: f,
            tutar,
            kdvOrani: kdvRate,
            kdvTutari,
            toplamTutar,
          };
        });
        setItems(mappedRows);
        setActiveRowIndex(0);
      } else {
        const invGenelToplam = Number(inv.genelToplam ?? inv.GENEL_TOPLAM) || 0;
        const invAraToplam = Number(inv.araToplam ?? inv.ARA_TOPLAM) || invGenelToplam;
        const invToplamKdv = Number(inv.toplamKdv ?? inv.TOPLAM_KDV) || 0;

        if (invGenelToplam > 0 || invAraToplam > 0) {
          setItems([
            {
              id: makeId(),
              altinUrunId: null,
              barkod: "",
              urunAdi: "Perakende Satış Kalemi",
              ayar: "",
              miktar: 1,
              birim: "Adet",
              gram: 0,
              hasGram: 0,
              birimFiyat: invAraToplam,
              tutar: invAraToplam,
              kdvOrani: invAraToplam > 0 && invToplamKdv > 0 ? Math.round((invToplamKdv / invAraToplam) * 100) : 0,
              kdvTutari: invToplamKdv,
              toplamTutar: invGenelToplam || invAraToplam,
            },
          ]);
        } else {
          setItems([createEmptyRow()]);
        }
        setActiveRowIndex(0);
      }

      setShowHistoryModal(false);
      showSuccess(
        `'${inv.faturaNo || inv.FATURA_NO || ""}' numaralı fatura (${rawLines.length > 0 ? rawLines.length : 1} kalem) forma yüklendi.`
      );
    } catch (err: any) {
      console.error("handleSelectInvoiceForEdit error:", err);
      showError("Fatura detayı yüklenirken bir hata oluştu");
    }
  };

  const handleViewInvoiceDetail = async (id: number) => {
    try {
      const detail = await PerakendeService.getInvoiceById(id);
      if (detail) {
        setPrintedFatura(detail);
        setShowPrintModal(true);
      }
    } catch {
      showError("Fatura detayı getirilemedi");
    }
  };

  const handleDeleteInvoice = async (id: number, faturaNumarasi: string) => {
    if (
      !window.confirm(
        `'${faturaNumarasi}' numaralı faturayı silmek ve satılan altın ürünleri tekrar stoğa iade etmek istediğinize emin misiniz?`
      )
    ) {
      return;
    }

    try {
      await PerakendeService.deleteInvoice(id);
      showSuccess(`'${faturaNumarasi}' numaralı fatura silindi ve ürünler stoğa iade edildi.`);
      setHistoryList((prev) => prev.filter((item) => item.faturaId !== id));
      if (currentFaturaId === id) {
        handleReset();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Fatura silinemedi";
      showError(msg);
    }
  };

  const handleDeleteCurrent = () => {
    if (currentFaturaId) {
      handleDeleteInvoice(currentFaturaId, faturaNo);
    } else if (items.length > 1 || (items[0] && (items[0].barkod || items[0].urunAdi || Number(items[0].birimFiyat) > 0))) {
      handleDeleteRow(activeRowIndex);
    } else {
      showInfo("Silinecek bir kayıt veya satır bulunamadı");
    }
  };

  // Keyboard Shortcuts References
  const handleResetRef = useRef(handleReset);
  handleResetRef.current = handleReset;

  const handleSaveNormalRef = useRef(() => handleCompleteSale(false));
  handleSaveNormalRef.current = () => handleCompleteSale(false);

  const handleSavePrintRef = useRef(() => handleCompleteSale(true));
  handleSavePrintRef.current = () => handleCompleteSale(true);

  const handleDeleteRef = useRef(handleDeleteCurrent);
  handleDeleteRef.current = handleDeleteCurrent;

  const handleOpenHistoryRef = useRef(handleOpenHistory);
  handleOpenHistoryRef.current = handleOpenHistory;

  // Keyboard Shortcuts (Registered ONCE)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "F1") {
        e.preventDefault();
        e.stopPropagation();
        handleSaveNormalRef.current();
      } else if (e.key === "F2") {
        e.preventDefault();
        e.stopPropagation();
        handleDeleteRef.current();
      } else if (e.key === "F3") {
        e.preventDefault();
        e.stopPropagation();
        handleOpenHistoryRef.current();
      } else if (e.key === "F4") {
        e.preventDefault();
        e.stopPropagation();
        setShowMusteriModal(true);
      } else if (e.key === "F9") {
        e.preventDefault();
        e.stopPropagation();
        handleSavePrintRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Calculate Running Totals
  const totalQuantity = validItems.reduce((acc, i) => acc + (Number(i.miktar) || 0), 0);
  const totalGrams = validItems.reduce((acc, i) => acc + (Number(i.gram) || 0), 0);
  const totalHasGrams = validItems.reduce((acc, i) => acc + (Number(i.hasGram) || 0), 0);
  const araToplam = validItems.reduce((acc, i) => acc + (Number(i.tutar) || 0), 0);
  const toplamKdv = validItems.reduce((acc, i) => acc + (Number(i.kdvTutari) || 0), 0);
  const genelToplam = validItems.reduce((acc, i) => acc + (Number(i.toplamTutar) || 0), 0);

  // Vezne Lookup Columns
  const vezneLookupColumns: LookupColumn<VezneItem>[] = [
    { header: "Kod", width: "100px", align: "center", render: (v) => <span className="fw-bold">{v.kod}</span> },
    { header: "Vezne Adı", render: (v) => <span>{v.ad}</span> },
  ];

  return (
    <div
      className="perakende-fisi-page w-100 pb-3"
      style={{ fontFamily: "'Segoe UI', sans-serif", fontSize: "12.5px" }}
    >
      {/* ─── 1. Top ERP Toolbar ────────────────────────────────────────── */}
      <ERPToolbar
        disableShortcuts
        pageTitle={
          <span style={{ fontWeight: 700, fontSize: "14px" }}>
            B- Perakende Fişi{" "}
            <Badge bg={faturaTipi === 1 ? "success" : "danger"} style={{ fontSize: "11px" }}>
              {faturaTipi === 1 ? "SATIŞ" : "İADE"}
            </Badge>
            <Badge bg="primary" className="ms-1" style={{ fontSize: "11px" }}>
              {senaryo === "EARSIVFATURA" ? "e-Arşiv" : "e-Fatura"}
            </Badge>
          </span>
        }
        pageIcon={<IconBarcode size={20} />}
        onNew={handleReset}
        onSave={() => handleCompleteSale(false)}
        onPrint={() => handleCompleteSale(true)}
        onSearch={handleOpenHistory}
        onDelete={handleDeleteCurrent}
        hideDelete={false}
        rightContent={
          <div className="d-flex align-items-center gap-1">
            <Button
              variant="outline-success"
              size="sm"
              className="py-1 px-2 fw-semibold d-flex align-items-center gap-1"
              style={{ fontSize: "11px" }}
              onClick={() => handleCompleteSale(true)}
              title="Kaydet & Yazdır (F9)"
              disabled={isSubmitting}
            >
              <IconPrinter size={15} />
              <span>Kaydet & Yazdır (F9)</span>
            </Button>
          </div>
        }
      />

      {/* ─── 2. Top Vezne & Fatura Parametreleri Barı (Responsive) ───── */}
      <div
        className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2 p-1.5 border rounded bg-light"
        style={{ fontSize: "12px" }}
      >
        <div className="d-flex align-items-center flex-wrap gap-2">
          {/* Vezne Seçimi */}
          <div className="d-flex align-items-center gap-1">
            <span className="fw-bold text-primary" style={{ minWidth: 45 }}>
              VEZNE
            </span>
            <div className="input-group input-group-sm" style={{ width: 115 }}>
              <input
                type="text"
                value={selectedVezne?.kod || ""}
                readOnly
                onClick={() => setShowVezneModal(true)}
                className="form-control form-control-sm text-center fw-bold bg-white"
                style={{ cursor: "pointer", fontSize: "12px" }}
              />
              <Button
                size="sm"
                variant="outline-secondary"
                className="px-2 py-0 d-flex align-items-center"
                onClick={() => setShowVezneModal(true)}
                title="Vezne Seç"
              >
                <IconBinoculars size={14} />
              </Button>
            </div>
            {selectedVezne?.ad && (
              <span className="text-muted small ms-1 d-none d-md-inline">({selectedVezne.ad})</span>
            )}
          </div>

          {/* Fatura No */}
          <div className="d-flex align-items-center gap-1">
            <span className="fw-bold text-secondary" style={{ minWidth: 65 }}>
              FATURA NO
            </span>
            <div className="input-group input-group-sm" style={{ width: 175 }}>
              <input
                type="text"
                className="form-control form-control-sm font-monospace fw-bold text-primary bg-white"
                value={faturaNo}
                onChange={(e) => setFaturaNo(e.target.value)}
                placeholder="Otomatik (Numaratör)"
                style={{ fontSize: "11.5px" }}
              />
              <Button
                size="sm"
                variant="outline-secondary"
                className="px-2 py-0 d-flex align-items-center"
                onClick={loadNextNo}
                title="Numaratörden Sıradaki Numarayı Çek"
              >
                <IconRefresh size={13} />
              </Button>
            </div>
          </div>

          {/* Tarih & Saat */}
          <div className="d-flex align-items-center gap-1">
            <span className="fw-bold text-secondary">TARİH</span>
            <input
              type="date"
              className="form-control form-control-sm bg-white"
              style={{ width: 120, fontSize: "12px" }}
              value={tarih}
              onChange={(e) => setTarih(e.target.value)}
            />
            <input
              type="time"
              className="form-control form-control-sm bg-white"
              style={{ width: 80, fontSize: "12px" }}
              value={saat}
              onChange={(e) => setSaat(e.target.value)}
            />
          </div>

          {/* Senaryo */}
          <div className="d-flex align-items-center gap-1">
            <span className="fw-bold text-secondary">SENARYO</span>
            <Form.Select
              size="sm"
              style={{ width: 135, fontSize: "12px" }}
              value={senaryo}
              onChange={(e) => {
                const newSenaryo = e.target.value;
                setSenaryo(newSenaryo);
                if (faturaNo) {
                  const pfx = newSenaryo === "EARSIVFATURA" ? "EAR" : "GIB";
                  PerakendeService.getNextFaturaNo(pfx).then(setFaturaNo).catch(console.error);
                }
              }}
            >
              <option value="EARSIVFATURA">e-Arşiv Fatura</option>
              <option value="TEMELFATURA">Temel Fatura</option>
              <option value="TICARIFATURA">Ticari Fatura</option>
            </Form.Select>
          </div>
        </div>

        {/* Fatura Tipi */}
        <div className="d-flex align-items-center gap-1">
          <Form.Select
            size="sm"
            style={{ width: 95, fontSize: "12px", fontWeight: 700 }}
            className={faturaTipi === 1 ? "text-success border-success" : "text-danger border-danger"}
            value={faturaTipi}
            onChange={(e) => setFaturaTipi(Number(e.target.value))}
          >
            <option value={1}>SATIŞ</option>
            <option value={2}>İADE</option>
          </Form.Select>
        </div>
      </div>

      {/* ─── 3. Header Panel: Müşteri & Cari Bilgileri (Responsive Grid) ─ */}
      <Card className="shadow-sm mb-2 border">
        <Card.Body className="p-2">
          <Row className="g-2">
            {/* Sol Sütun: Ünvan & Dürbün, TCKN / VKN */}
            {/* Sol Sütun: Ünvan & Dürbün, TCKN / VKN, Vergi Dairesi, İl / İlçe */}
            <Col xs={12} lg={6}>
              <div className="d-flex align-items-center mb-1 flex-wrap flex-sm-nowrap gap-1">
                <label style={{ width: 85, minWidth: 85, fontSize: "12px", fontWeight: 600 }}>
                  Müşteri Adı
                </label>
                <InputGroup size="sm" style={{ flex: 1, minWidth: "150px" }}>
                  <Form.Control
                    value={aliciUnvan}
                    onChange={(e) => {
                      setAliciUnvan(e.target.value);
                      if (cariKartId) setCariKartId(null);
                    }}
                    style={{ fontSize: "12px", fontWeight: 600 }}
                  />
                  <Button
                    variant="outline-secondary"
                    className="px-2 py-0 d-flex align-items-center"
                    onClick={() => setShowMusteriModal(true)}
                    title="Cari / Müşteri Seç (F4)"
                  >
                    <IconBinoculars size={14} />
                  </Button>
                </InputGroup>
                <Button
                  variant="outline-primary"
                  size="sm"
                  className="px-2 py-0"
                  onClick={handleSetNihaiTuketici}
                  title="Nihai Tüketici Olarak Doldur"
                  style={{ fontSize: "11px", whiteSpace: "nowrap" }}
                >
                  Nihai Tüketici
                </Button>
              </div>

              <div className="d-flex align-items-center mb-1">
                <label style={{ width: 85, minWidth: 85, fontSize: "12px", fontWeight: 600 }}>
                  TCKN / VKN
                </label>
                <Form.Control
                  size="sm"
                  maxLength={11}
                  value={aliciVknTckn}
                  onChange={(e) => setAliciVknTckn(e.target.value.replace(/\D/g, ""))}
                  style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 600, flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center mb-1">
                <label style={{ width: 85, minWidth: 85, fontSize: "12px", fontWeight: 600 }}>
                  Vergi Dairesi
                </label>
                <Form.Control
                  size="sm"
                  value={vergiDairesi}
                  onChange={(e) => setVergiDairesi(e.target.value)}
                  style={{ fontSize: "12px", flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center">
                <label style={{ width: 85, minWidth: 85, fontSize: "12px", fontWeight: 600 }}>
                  İl / İlçe
                </label>
                <div className="d-flex gap-1" style={{ flex: 1 }}>
                  <Form.Control
                    size="sm"
                    value={il}
                    onChange={(e) => setIl(e.target.value)}
                    style={{ fontSize: "12px", flex: 1 }}
                  />
                  <Form.Control
                    size="sm"
                    value={ilce}
                    onChange={(e) => setIlce(e.target.value)}
                    style={{ fontSize: "12px", flex: 1 }}
                  />
                </div>
              </div>
            </Col>

            {/* Sağ Sütun: Adres, Telefon, E-Posta */}
            <Col xs={12} lg={6}>
              <div className="d-flex align-items-start mb-1">
                <label style={{ width: 65, minWidth: 65, fontSize: "12px", fontWeight: 600, paddingTop: "3px" }}>
                  Adres
                </label>
                <Form.Control
                  size="sm"
                  as="textarea"
                  rows={2}
                  value={adres}
                  onChange={(e) => setAdres(e.target.value)}
                  style={{ fontSize: "12px", flex: 1, resize: "none" }}
                />
              </div>

              <div className="d-flex align-items-center mb-1">
                <label style={{ width: 65, minWidth: 65, fontSize: "12px", fontWeight: 600 }}>
                  Telefon
                </label>
                <Form.Control
                  size="sm"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  style={{ fontSize: "12px", flex: 1 }}
                />
              </div>

              <div className="d-flex align-items-center">
                <label style={{ width: 65, minWidth: 65, fontSize: "12px", fontWeight: 600 }}>
                  E-Posta
                </label>
                <Form.Control
                  size="sm"
                  type="email"
                  value={eposta}
                  onChange={(e) => setEposta(e.target.value)}
                  style={{ fontSize: "12px", flex: 1 }}
                />
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* ─── 4. Hızlı Barkod Okuma & Dürbünlü Seçim Alanı (Ortalı & Kompakt) ─── */}
      <div className="d-flex justify-content-center my-2">
        <div
          className="d-flex align-items-center gap-2 p-1.5 bg-white border rounded shadow-sm w-100"
          style={{ maxWidth: 540 }}
        >
          <div className="d-flex align-items-center gap-1 text-primary fw-bold px-1 px-sm-2 flex-shrink-0">
            <IconBarcode size={22} />
            <span className="d-none d-sm-inline" style={{ fontSize: "12px" }}>BARKOD OKUYUCU</span>
          </div>

          <Form onSubmit={handleBarcodeSubmit} className="flex-grow-1">
            <InputGroup size="sm">
              <Form.Control
                ref={barcodeInputRef}
                type="text"
                className="fw-bold font-monospace bg-white"
                style={{ fontSize: "13px" }}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                disabled={isScanning}
                autoFocus
              />
              {/* Barkod Dürbün Butonu */}
              <Button
                type="button"
                variant="outline-secondary"
                className="px-2 py-0 d-flex align-items-center"
                onClick={() => setShowProductLookup(true)}
                title="Barkodlu Altın / Özel Ürün Listesinden Seç"
              >
                <IconBinoculars size={16} />
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="px-3 fw-bold d-flex align-items-center gap-1"
                disabled={isScanning || !barcodeInput.trim()}
              >
                {isScanning ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  <>
                    <IconPlus size={15} />
                    <span>Ekle</span>
                  </>
                )}
              </Button>
            </InputGroup>
          </Form>
        </div>
      </div>

      {/* ─── 5. Satış Kalemleri Grid Tablosu (Tam Ekrana Sığar, Mobilde Kaydırılabilir) ─── */}
      <div
        className="table-responsive border rounded bg-white shadow-sm w-100"
        style={{ minHeight: "160px", overflowX: "auto" }}
      >
        <Table
          bordered
          size="sm"
          hover
          className="mb-0 align-middle text-nowrap w-100"
          style={{ fontSize: "11.5px", minWidth: "820px" }}
        >
          <thead style={{ background: "#d9e8fb", color: "#000" }}>
            <tr className="text-center align-middle">
              <th style={{ width: "3%", minWidth: "28px" }}>#</th>
              <th style={{ width: "12%", minWidth: "115px" }}>Barkod</th>
              <th style={{ width: "22%", minWidth: "145px" }}>Mal / Hizmet Açıklaması</th>
              <th style={{ width: "8%", minWidth: "80px" }}>Ayar</th>
              <th style={{ width: "5%", minWidth: "50px" }}>Miktar</th>
              <th style={{ width: "5%", minWidth: "45px" }}>Birim</th>
              <th style={{ width: "8%", minWidth: "65px" }}>Gram</th>
              <th style={{ width: "8%", minWidth: "65px" }}>Has Gr</th>
              <th style={{ width: "9%", minWidth: "75px" }}>Birim Fiyat (₺)</th>
              <th style={{ width: "5%", minWidth: "48px" }}>KDV %</th>
              <th style={{ width: "7%", minWidth: "65px" }}>KDV Tutarı</th>
              <th style={{ width: "8%", minWidth: "78px" }}>Satır Toplamı (₺)</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={item.id}
                data-row-id={item.id}
                data-table-type="perakende-satir"
                className="align-middle"
                style={idx === activeRowIndex ? { background: "#edf5ff" } : {}}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveRowIndex(idx);
                  setContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    rowId: item.id,
                    rowIndex: idx,
                  });
                }}
              >
                <td className="text-center text-muted small" style={{ padding: "2px" }}>
                  {idx + 1}
                </td>

                {/* Barkod (Dürbünlü Giriş) */}
                <td style={{ padding: "2px" }}>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={(el) => {
                        rowInputRefs.current[`${item.id}_barkod`] = el;
                      }}
                      size="sm"
                      type="text"
                      className="font-monospace py-0 px-1 fw-bold text-primary"
                      style={{ fontSize: "11.5px", height: "24px" }}
                      value={item.barkod}
                      onChange={(e) => handleUpdateItem(item.id, { barkod: e.target.value })}
                      onKeyDown={(e) => handleGridKeyDown(e, idx, "barkod", item.id)}
                      onFocus={() => setActiveRowIndex(idx)}
                    />
                    <Button
                      variant="outline-secondary"
                      className="px-1 py-0 d-flex align-items-center"
                      onClick={() => {
                        setActiveRowIndex(idx);
                        setShowProductLookup(true);
                      }}
                      title="Ürün Seç"
                      style={{ height: "24px" }}
                    >
                      <IconBinoculars size={12} />
                    </Button>
                  </InputGroup>
                </td>

                {/* Mal / Hizmet Açıklaması */}
                <td style={{ padding: "2px" }}>
                  <Form.Control
                    ref={(el) => {
                      rowInputRefs.current[`${item.id}_urunAdi`] = el;
                    }}
                    size="sm"
                    type="text"
                    className="py-0 px-1 fw-semibold"
                    style={{ fontSize: "11.5px", height: "24px" }}
                    value={item.urunAdi}
                    onChange={(e) => handleUpdateItem(item.id, { urunAdi: e.target.value })}
                    onKeyDown={(e) => handleGridKeyDown(e, idx, "urunAdi", item.id)}
                    onFocus={() => setActiveRowIndex(idx)}
                  />
                </td>

                {/* Ayar (Dürbünlü Seçim & Giriş) */}
                <td style={{ padding: "2px" }}>
                  <InputGroup size="sm">
                    <Form.Control
                      ref={(el) => {
                        rowInputRefs.current[`${item.id}_ayar`] = el;
                      }}
                      size="sm"
                      type="text"
                      className="text-center font-monospace py-0 px-1 fw-bold"
                      style={{ fontSize: "11px", height: "24px" }}
                      value={item.ayar}
                      onChange={(e) => handleUpdateItem(item.id, { ayar: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "F4") {
                          e.preventDefault();
                          setActiveRowIndex(idx);
                          setActiveAyarRowId(item.id);
                          setShowAyarModal(true);
                          return;
                        }
                        handleGridKeyDown(e, idx, "ayar", item.id);
                      }}
                      onFocus={() => setActiveRowIndex(idx)}
                    />
                    <Button
                      variant="outline-secondary"
                      className="px-1 py-0 d-flex align-items-center"
                      onClick={() => {
                        setActiveRowIndex(idx);
                        setActiveAyarRowId(item.id);
                        setShowAyarModal(true);
                      }}
                      title="Ayar Listesinden Seç (F4)"
                      style={{ height: "24px" }}
                    >
                      <IconBinoculars size={12} />
                    </Button>
                  </InputGroup>
                </td>

                {/* Miktar */}
                <td style={{ padding: "2px" }}>
                  <Form.Control
                    ref={(el) => {
                      rowInputRefs.current[`${item.id}_miktar`] = el;
                    }}
                    size="sm"
                    type="number"
                    min={1}
                    className="text-center font-monospace py-0 px-1"
                    style={{ fontSize: "11.5px", height: "24px" }}
                    value={item.miktar}
                    onChange={(e) =>
                      handleUpdateItem(item.id, {
                        miktar: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    onKeyDown={(e) => handleGridKeyDown(e, idx, "miktar", item.id)}
                    onFocus={() => setActiveRowIndex(idx)}
                  />
                </td>

                {/* Birim */}
                <td style={{ padding: "2px" }}>
                  <Form.Control
                    ref={(el) => {
                      rowInputRefs.current[`${item.id}_birim`] = el;
                    }}
                    size="sm"
                    type="text"
                    className="text-center py-0 px-1"
                    style={{ fontSize: "11px", height: "24px" }}
                    value={item.birim}
                    onChange={(e) => handleUpdateItem(item.id, { birim: e.target.value })}
                    onKeyDown={(e) => handleGridKeyDown(e, idx, "birim", item.id)}
                    onFocus={() => setActiveRowIndex(idx)}
                  />
                </td>

                {/* Gram */}
                <td style={{ padding: "2px" }}>
                  <Form.Control
                    ref={(el) => {
                      rowInputRefs.current[`${item.id}_gram`] = el;
                    }}
                    size="sm"
                    type="number"
                    step="0.01"
                    className="text-end font-monospace py-0 px-1"
                    style={{ fontSize: "11.5px", height: "24px" }}
                    value={item.gram}
                    onChange={(e) =>
                      handleUpdateItem(item.id, {
                        gram: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    onKeyDown={(e) => handleGridKeyDown(e, idx, "gram", item.id)}
                    onFocus={() => setActiveRowIndex(idx)}
                  />
                </td>

                {/* Has Gram */}
                <td style={{ padding: "2px" }}>
                  <Form.Control
                    ref={(el) => {
                      rowInputRefs.current[`${item.id}_hasGram`] = el;
                    }}
                    size="sm"
                    type="number"
                    step="0.001"
                    className="text-end font-monospace py-0 px-1"
                    style={{ fontSize: "11.5px", height: "24px" }}
                    value={item.hasGram}
                    onChange={(e) =>
                      handleUpdateItem(item.id, {
                        hasGram: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    onKeyDown={(e) => handleGridKeyDown(e, idx, "hasGram", item.id)}
                    onFocus={() => setActiveRowIndex(idx)}
                  />
                </td>

                {/* Birim Fiyat */}
                <td style={{ padding: "2px" }}>
                  <Form.Control
                    ref={(el) => {
                      rowInputRefs.current[`${item.id}_birimFiyat`] = el;
                    }}
                    size="sm"
                    type="number"
                    step="0.01"
                    className="text-end font-monospace fw-bold py-0 px-1 text-primary"
                    style={{ fontSize: "11.5px", height: "24px" }}
                    value={item.birimFiyat}
                    onChange={(e) =>
                      handleUpdateItem(item.id, {
                        birimFiyat: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    onKeyDown={(e) => handleGridKeyDown(e, idx, "birimFiyat", item.id)}
                    onFocus={() => setActiveRowIndex(idx)}
                  />
                </td>

                {/* KDV % (Kullanıcı İstediği Değeri Yazabilir, Varsayılan 0) */}
                <td style={{ padding: "2px" }}>
                  <Form.Control
                    ref={(el) => {
                      rowInputRefs.current[`${item.id}_kdvOrani`] = el;
                    }}
                    size="sm"
                    type="number"
                    min={0}
                    step={1}
                    className="text-center font-monospace py-0 px-1"
                    style={{ fontSize: "11.5px", height: "24px" }}
                    value={item.kdvOrani === "" ? "" : item.kdvOrani}
                    onChange={(e) =>
                      handleUpdateItem(item.id, {
                        kdvOrani: e.target.value === "" ? "" : Number(e.target.value),
                      })
                    }
                    onKeyDown={(e) => handleGridKeyDown(e, idx, "kdvOrani", item.id)}
                    onFocus={() => setActiveRowIndex(idx)}
                  />
                </td>

                {/* KDV Tutarı */}
                <td className="text-end font-monospace" style={{ padding: "2px 6px" }}>
                  {typeof item.kdvTutari === "number" && item.kdvTutari > 0
                    ? item.kdvTutari.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                    : "-"}
                </td>

                {/* Satır Toplamı */}
                <td className="text-end fw-bold font-monospace text-dark" style={{ padding: "2px 6px" }}>
                  {typeof item.toplamTutar === "number" && item.toplamTutar > 0
                    ? `${item.toplamTutar.toLocaleString("tr-TR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ₺`
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* ─── 6. Alt Toplam ve Hesap Özeti Paneli (Responsive) ──────────── */}
      <div
        className="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center justify-content-between p-2 mt-2 border rounded bg-light gap-2"
        style={{ fontSize: "12px" }}
      >
        <div className="d-flex align-items-center flex-wrap gap-2 gap-sm-3">
          <div>
            <span className="text-muted me-1">Kalem:</span>
            <strong className="font-monospace text-dark">{validItems.length}</strong>
          </div>
          <div>
            <span className="text-muted me-1">Toplam Adet:</span>
            <strong className="font-monospace text-dark">{totalQuantity}</strong>
          </div>
          <div>
            <span className="text-muted me-1">Toplam Gram:</span>
            <strong className="font-monospace text-dark">{totalGrams.toFixed(2)} gr</strong>
          </div>
          <div>
            <span className="text-muted me-1">Toplam Has:</span>
            <strong className="font-monospace text-dark">{totalHasGrams.toFixed(3)} has</strong>
          </div>
        </div>

        <div className="d-flex align-items-center flex-wrap justify-content-between justify-content-lg-end gap-2 gap-sm-3">
          <div>
            <span className="text-muted me-1">Ara Toplam:</span>
            <strong className="font-monospace text-dark">
              {araToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </strong>
          </div>
          <div>
            <span className="text-muted me-1">KDV:</span>
            <strong className="font-monospace text-warning-emphasis">
              {toplamKdv.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
            </strong>
          </div>
          <div className="px-3 py-1 bg-success text-white rounded font-monospace fw-bold fs-6 text-center">
            GENEL TOPLAM: {genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
          </div>
        </div>
      </div>

      {/* ─── 7. Kısayol Bilgilendirme Çubuğu (Footer Notu) ────────────── */}
      <div
        className="d-flex align-items-center justify-content-between flex-wrap gap-2 px-3 py-1.5 mt-2 rounded border bg-white text-muted shadow-sm"
        style={{ fontSize: "11px" }}
      >
        <div className="d-flex align-items-center flex-wrap gap-2 gap-md-3">
          <span>
            <kbd className="bg-primary text-white px-1.5 py-0.5 rounded me-1 fw-bold">F1</kbd>
            <strong className="text-dark">Kaydet</strong>
          </span>
          <span className="text-secondary">•</span>
          <span>
            <kbd className="bg-danger text-white px-1.5 py-0.5 rounded me-1 fw-bold">F2</kbd>
            <strong className="text-dark">Sil</strong>
          </span>
          <span className="text-secondary">•</span>
          <span>
            <kbd className="bg-info text-white px-1.5 py-0.5 rounded me-1 fw-bold">F3</kbd>
            <strong className="text-dark">Fatura Ara</strong>
          </span>
          <span className="text-secondary">•</span>
          <span>
            <kbd className="bg-secondary text-white px-1.5 py-0.5 rounded me-1 fw-bold">F4</kbd>
            <strong className="text-dark">Müşteri Seç</strong>
          </span>
          <span className="text-secondary">•</span>
          <span>
            <kbd className="bg-success text-white px-1.5 py-0.5 rounded me-1 fw-bold">F9</kbd>
            <strong className="text-dark">Kaydet & Yazdır</strong>
          </span>
        </div>
        <div className="text-muted small d-none d-lg-block">
          Likya Kuyumculuk ERP
        </div>
      </div>

      {/* ─── Sağ Tık Context Menü (Satır Ekle / Sil) ─────────────────── */}
      {contextMenu?.visible && (
        <div
          className="position-fixed bg-white border rounded shadow-lg py-1"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            zIndex: 9999,
            minWidth: 160,
            fontSize: "12px",
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-muted fw-bold border-bottom" style={{ fontSize: "11px" }}>
            Satır İşlemleri (#{contextMenu.rowIndex + 1})
          </div>
          <button
            type="button"
            className="dropdown-item px-3 py-1.5 d-flex align-items-center gap-2 text-success"
            style={{ cursor: "pointer" }}
            onClick={() => {
              handleAddRow(contextMenu.rowIndex);
              setContextMenu(null);
            }}
          >
            <IconPlus size={15} />
            <span>Yeni Satır Ekle</span>
          </button>
          <button
            type="button"
            className="dropdown-item px-3 py-1.5 d-flex align-items-center gap-2 text-danger"
            style={{ cursor: "pointer" }}
            onClick={() => {
              handleDeleteRow(contextMenu.rowId);
              setContextMenu(null);
            }}
          >
            <IconTrash size={15} />
            <span>Satırı Sil</span>
          </button>
        </div>
      )}

      {/* ─── MODALS ───────────────────────────────────────────────────── */}

      {/* Barkodlu Altın / Özel Ürün Seçim Modalı (LookupModal) */}
      <LookupModal
        show={showProductLookup}
        onHide={() => setShowProductLookup(false)}
        title="Barkodlu Ürün Seçimi"
        items={combinedLookupItems}
        isLoading={isProductLoading}
        columns={productLookupColumns}
        filterFn={(it, term) => {
          const t = term.toLowerCase();
          const barkod = (it.item.barkod || `${it.item.grupKodu}${it.item.urunNo}`).toLowerCase();
          const model = (
            (it.tip === "altin"
              ? (it.item as AltinUrunItem).model
              : (it.item as OzelUrunItem).mamulTipi) || ""
          ).toLowerCase();
          const ayar = (it.item.ayar || "").toLowerCase();
          return barkod.includes(t) || model.includes(t) || ayar.includes(t);
        }}
        onSelect={handleSelectFromProductLookup}
      />

      {/* Vezne Seçim Modalı (LookupModal) */}
      <LookupModal
        show={showVezneModal}
        onHide={() => setShowVezneModal(false)}
        title="Vezne / Kasa Seçimi"
        items={vezneler}
        columns={vezneLookupColumns}
        filterFn={(v, term) =>
          v.kod.toLowerCase().includes(term.toLowerCase()) ||
          v.ad.toLowerCase().includes(term.toLowerCase())
        }
        onSelect={(v) => {
          setSelectedVezne(v);
          setShowVezneModal(false);
        }}
      />

      {/* Müşteri / Cari Seçim Modalı (MusteriSecimModal) */}
      {showMusteriModal && (
        <MusteriSecimModal
          show={showMusteriModal}
          onClose={() => setShowMusteriModal(false)}
          cariler={cariler}
          kayitsizMusteriler={kayitsizMusteriler}
          onSelectCustomer={handleSelectCustomer}
          currentUnvan={aliciUnvan}
        />
      )}

      {/* Ayar Seçim Modalı (AyarSecimModal) */}
      {showAyarModal && (
        <AyarSecimModal
          show={showAyarModal}
          onHide={() => {
            setShowAyarModal(false);
            setActiveAyarRowId(null);
          }}
          selectedAyarKodu={
            items.find((it) => it.id === activeAyarRowId)?.ayar || undefined
          }
          onSelect={(selectedAyar: AyarItem) => {
            if (activeAyarRowId) {
              setItems((prev) =>
                prev.map((r) => {
                  if (r.id !== activeAyarRowId) return r;
                  const gram = Number(r.gram) || 0;
                  const milyem = Number(selectedAyar.milyem) || 0;
                  const hasGram =
                    gram > 0 && milyem > 0
                      ? parseFloat(((gram * milyem) / 1000).toFixed(3))
                      : r.hasGram;

                  return recalculateLine({
                    ...r,
                    ayar: selectedAyar.ayarKodu,
                    hasGram,
                  });
                })
              );
              setTimeout(() => {
                focusGridCell(activeAyarRowId, "miktar", "select");
              }, 50);
            }
            setShowAyarModal(false);
            setActiveAyarRowId(null);
          }}
        />
      )}

      {/* Yazdırma Önizleme Modalı (PerakendeFisiPrintModal) */}
      {showPrintModal && (
        <PerakendeFisiPrintModal
          show={showPrintModal}
          onHide={() => setShowPrintModal(false)}
          fatura={printedFatura}
        />
      )}

      {/* Geçmiş Faturalar Arama ve İptal Modalı */}
      <Modal
        show={showHistoryModal}
        onHide={() => setShowHistoryModal(false)}
        size="xl"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton className="bg-light py-2 px-3 border-bottom">
          <div className="d-flex align-items-center gap-2">
            <IconHistory size={20} className="text-primary" />
            <h6 className="mb-0 fw-bold">Geçmiş Perakende Satışları & Faturalar</h6>
          </div>
        </Modal.Header>

        <Modal.Body className="p-3 bg-light">
          {/* Filtreleme Alanı */}
          <div className="row g-2 mb-3 bg-white p-2 rounded border">
            <div className="col-12 col-md-3">
              <Form.Label className="small text-muted mb-1">Başlangıç Tarihi</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                value={historyStartDate}
                onChange={(e) => setHistoryStartDate(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-3">
              <Form.Label className="small text-muted mb-1">Bitiş Tarihi</Form.Label>
              <Form.Control
                size="sm"
                type="date"
                value={historyEndDate}
                onChange={(e) => setHistoryEndDate(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-4">
              <Form.Label className="small text-muted mb-1">Arama</Form.Label>
              <Form.Control
                size="sm"
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <div className="col-12 col-md-2 d-flex align-items-end">
              <Button
                variant="primary"
                size="sm"
                className="w-100 d-flex align-items-center justify-content-center gap-1"
                onClick={handleSearchHistory}
                disabled={historyLoading}
              >
                {historyLoading ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  <>
                    <IconSearch size={14} />
                    <span>Filtrele</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Fatura Listesi Tablosu */}
          <div className="table-responsive bg-white rounded border" style={{ maxHeight: "400px" }}>
            <Table hover size="sm" className="align-middle mb-0 text-nowrap" style={{ fontSize: "12px" }}>
              <thead style={{ background: "#d9e8fb" }} className="sticky-top small">
                <tr>
                  <th>Fatura No</th>
                  <th>Tarih</th>
                  <th>Senaryo</th>
                  <th>Alıcı / Müşteri</th>
                  <th>TCKN / VKN</th>
                  <th className="text-end">Ara Toplam</th>
                  <th className="text-end">KDV</th>
                  <th className="text-end">Genel Toplam</th>
                  <th className="text-center">E-Belge</th>
                  <th className="text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-4">
                      <Spinner size="sm" animation="border" className="me-2" />
                      Faturalar yükleniyor...
                    </td>
                  </tr>
                ) : historyList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-4 text-muted">
                      Kriterlere uygun kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  historyList.map((f) => (
                    <tr
                      key={f.faturaId}
                      onDoubleClick={() => handleSelectInvoiceForEdit(f.faturaId)}
                      style={{ cursor: "pointer" }}
                      className="user-select-none"
                      title="Forma aktarmak ve düzenlemek için çift tıklayın"
                    >
                      <td className="fw-bold font-monospace text-primary">{f.faturaNo}</td>
                      <td className="small">
                        {new Date(f.tarih).toLocaleDateString("tr-TR")}
                      </td>
                      <td>
                        <Badge bg="light" text="dark" className="border">
                          {f.senaryo}
                        </Badge>
                      </td>
                      <td className="fw-bold">{f.aliciUnvan}</td>
                      <td className="font-monospace small">{f.aliciVknTckn}</td>
                      <td className="text-end font-monospace">
                        {f.araToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="text-end font-monospace">
                        {f.toplamKdv.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="text-end fw-bold font-monospace text-success">
                        {f.genelToplam.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                      </td>
                      <td className="text-center">
                        {f.eBelgeDurumu === 2 ? (
                          <Badge bg="success">GİB Onaylı</Badge>
                        ) : f.eBelgeDurumu === 1 ? (
                          <Badge bg="info">İletildi</Badge>
                        ) : (
                          <Badge bg="secondary">Taslak</Badge>
                        )}
                      </td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="btn-group btn-group-sm">
                          <Button
                            variant="primary"
                            size="sm"
                            className="py-0 px-2 fw-semibold"
                            onClick={() => handleSelectInvoiceForEdit(f.faturaId)}
                            title="Forma Aktar ve Düzenle"
                          >
                            <IconEdit size={14} className="me-1" />
                            Aç
                          </Button>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="py-0 px-2"
                            onClick={() => handleViewInvoiceDetail(f.faturaId)}
                            title="İncele ve Yazdır"
                          >
                            <IconPrinter size={14} className="me-1" />
                            Yazdır
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="py-0 px-2"
                            onClick={() => handleDeleteInvoice(f.faturaId, f.faturaNo)}
                            title="Faturayı Sil ve Stoğa İade Et"
                          >
                            <IconX size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>

        <Modal.Footer className="bg-light py-2 px-3 border-top">
          <Button variant="secondary" size="sm" onClick={() => setShowHistoryModal(false)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PerakendeFisiPage;

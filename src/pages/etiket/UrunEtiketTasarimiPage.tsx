import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useReducer,
  useMemo,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dropdown, Modal, Table, Badge } from "react-bootstrap";
import {
  IconTypography,
  IconBarcode,
  IconQrcode,
  IconSquare,
  IconCircle,
  IconLine,
  IconPhoto,
  IconStar,
  IconHeart,
  IconCrown,
  IconDiamond,
  IconAlertTriangle,
  IconDeviceFloppy,
  IconPrinter,
  IconTrash,
  IconCopy,
  IconPlus,
  IconMinus,
  IconRotate,
  IconAlignLeft,
  IconAlignCenter,
  IconAlignRight,
  IconBold,
  IconItalic,
  IconUnderline,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconLayoutGrid,
  IconEye,
  IconEyeOff,
  IconLock,
  IconLockOpen,
  IconChevronUp,
  IconChevronDown,
  IconArrowUp,
  IconArrowDown,
  IconCheck,
  IconX,
  IconSettings,
  IconPalette,
  IconLayersSubtract,
  IconWifi,
  IconSparkles,
  IconTemplate,
  IconArrowsMove,
  IconMagnet,
  IconGripVertical,
  IconMaximize,
  IconMinimize,
  IconMenu2,
  IconSearch,
  IconScissors,
  IconAdjustmentsHorizontal,
  IconZoomIn,
  IconZoomOut,
  IconHandMove,
  IconEdit,
  IconGridDots,
  IconUpload,
} from "@tabler/icons-react";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";
import "../../styles/LabelCanvas.css";
import {
  EtiketService,
  EtiketSablonItem,
  EtiketLogoItem,
  EtiketSablonAlan,
  EtiketSekli,
  EtiketArkaPlan,
} from "../../services/etiketService";

// ─── Yardımcı İkonlar ──────────────────────────────────────────────────────────
const IconBinoculars = ({ size = 15, color = "currentColor", strokeWidth = 2 }: { size?: number; color?: string; strokeWidth?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flexShrink: 0 }}
  >
    <circle cx="6" cy="15" r="4" />
    <circle cx="18" cy="15" r="4" />
    <path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
    <path d="M2.5 13 4 7a2 2 0 0 1 2-1.5h1.5A1.5 1.5 0 0 1 9 7v2" />
    <path d="M21.5 13 20 7a2 2 0 0 0-2-1.5h-1.5A1.5 1.5 0 0 0 15 7v2" />
  </svg>
);

const IconHandGrab = ({ size = 15, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M8 13v-8.5a1.5 1.5 0 0 1 3 0v7.5" />
    <path d="M11 11.5v-2a1.5 1.5 0 0 1 3 0v2.5" />
    <path d="M14 10.5a1.5 1.5 0 0 1 3 0v1.5" />
    <path d="M17 11.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1 -6 6h-2h.208a6 6 0 0 1 -5.012 -2.7a69.74 69.74 0 0 1 -.196 -.3c-.312 -.479 -1.407 -2.388 -3.286 -5.728a1.5 1.5 0 0 1 .536 -2.022a1.867 1.867 0 0 1 2.28 .28l1.47 1.47" />
  </svg>
);

const IconFocus2 = ({ size = 15, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <circle cx="12" cy="12" r=".5" fill={color} />
    <path d="M12 12m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
    <path d="M12 3l0 2" />
    <path d="M3 12l2 0" />
    <path d="M12 19l0 2" />
    <path d="M19 12l2 0" />
  </svg>
);

const IconDatabase = ({ size = 15, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6" />
    <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6" />
  </svg>
);

const IconShapes = ({ size = 15, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <path d="M4 4h5v5h-5z" />
    <path d="M14 4h6l-3 5z" />
    <circle cx="16.5" cy="16.5" r="3.5" />
  </svg>
);

// ─── Sabitler ────────────────────────────────────────────────────────────────

const PX_PER_MM = 3.7795275591; // 96dpi

export interface CanvaFontItem {
  family: string;
  name: string;
  category: "kuyumcu" | "script" | "sans" | "display" | "mono";
  categoryLabel: string;
  sample: string;
}

export const CANVA_FONTS: CanvaFontItem[] = [
  // 💎 Kuyumcu & Lüks Serif
  { family: "Cinzel", name: "Cinzel", category: "kuyumcu", categoryLabel: "Kuyumcu & Lüks", sample: "14K Altın Yüzük" },
  { family: "Playfair Display", name: "Playfair Display", category: "kuyumcu", categoryLabel: "Kuyumcu & Lüks", sample: "Tektaş Pırlanta 0.50ct" },
  { family: "Bodoni Moda", name: "Bodoni Moda", category: "kuyumcu", categoryLabel: "Kuyumcu & Lüks", sample: "Lüks Kuyumculuk" },
  { family: "Cormorant Garamond", name: "Cormorant Garamond", category: "kuyumcu", categoryLabel: "Kuyumcu & Lüks", sample: "22K Bilezik 15.40 gr" },
  { family: "Marcellus", name: "Marcellus", category: "kuyumcu", categoryLabel: "Kuyumcu & Lüks", sample: "Antik & Klasik" },
  { family: "Prata", name: "Prata", category: "kuyumcu", categoryLabel: "Kuyumcu & Lüks", sample: "Zarif Koleksiyon" },
  { family: "EB Garamond", name: "EB Garamond", category: "kuyumcu", categoryLabel: "Kuyumcu & Lüks", sample: "Klasik Tasarım" },
  { family: "Georgia", name: "Georgia", category: "kuyumcu", categoryLabel: "Kuyumcu & Lüks", sample: "Okunaklı Serif" },
  { family: "Times New Roman", name: "Times New Roman", category: "kuyumcu", categoryLabel: "Kuyumcu & Lüks", sample: "Standart Serif" },

  // ✨ Zarif & El Yazısı (Script)
  { family: "Great Vibes", name: "Great Vibes", category: "script", categoryLabel: "Zarif Kaligrafi", sample: "Özel Tasarım & Aşk" },
  { family: "Dancing Script", name: "Dancing Script", category: "script", categoryLabel: "Zarif Kaligrafi", sample: "Sonsuzluk Kolyesi" },
  { family: "Caveat", name: "Caveat", category: "script", categoryLabel: "Zarif Kaligrafi", sample: "El Yapımı Takı" },
  { family: "Pacifico", name: "Pacifico", category: "script", categoryLabel: "Zarif Kaligrafi", sample: "Yaz Koleksiyonu" },
  { family: "Sacramento", name: "Sacramento", category: "script", categoryLabel: "Zarif Kaligrafi", sample: "İmza Serisi" },

  // 🏢 Modern & Net Sans-Serif
  { family: "Inter", name: "Inter", category: "sans", categoryLabel: "Modern & Net", sample: "Gram: 4.85 gr | 14K" },
  { family: "Montserrat", name: "Montserrat", category: "sans", categoryLabel: "Modern & Net", sample: "KABASAKAL KUYUMCULUK" },
  { family: "Poppins", name: "Poppins", category: "sans", categoryLabel: "Modern & Net", sample: "Net & Yuvarlak Harfler" },
  { family: "Outfit", name: "Outfit", category: "sans", categoryLabel: "Modern & Net", sample: "Minimalist Etiket" },
  { family: "Roboto", name: "Roboto", category: "sans", categoryLabel: "Modern & Net", sample: "Fiyat: 12.500 ₺" },
  { family: "Open Sans", name: "Open Sans", category: "sans", categoryLabel: "Modern & Net", sample: "Barkod: 869000123" },
  { family: "Lato", name: "Lato", category: "sans", categoryLabel: "Modern & Net", sample: "Dengeli & Şık" },
  { family: "Manrope", name: "Manrope", category: "sans", categoryLabel: "Modern & Net", sample: "Modern Çizgiler" },
  { family: "Arial", name: "Arial", category: "sans", categoryLabel: "Modern & Net", sample: "Standart Sans-Serif" },
  { family: "Verdana", name: "Verdana", category: "sans", categoryLabel: "Modern & Net", sample: "Geniş Harfler" },
  { family: "Tahoma", name: "Tahoma", category: "sans", categoryLabel: "Modern & Net", sample: "Kompakt Düzen" },

  // 🏷️ Kompakt & Başlık Display
  { family: "Oswald", name: "Oswald", category: "display", categoryLabel: "Başlık & Kompakt", sample: "ALTIN & SARRAFİYE" },
  { family: "Rubik", name: "Rubik", category: "display", categoryLabel: "Başlık & Kompakt", sample: "YENİ MODEL 2026" },
  { family: "Quicksand", name: "Quicksand", category: "display", categoryLabel: "Başlık & Kompakt", sample: "İnce Geometrik" },
  { family: "Impact", name: "Impact", category: "display", categoryLabel: "Başlık & Kompakt", sample: "İNDİRİM %20" },

  // ⌨️ Monospace
  { family: "Space Mono", name: "Space Mono", category: "mono", categoryLabel: "Daktilo & Kod", sample: "RFID-EPC: E2801160" },
  { family: "Roboto Mono", name: "Roboto Mono", category: "mono", categoryLabel: "Daktilo & Kod", sample: "0123456789" },
  { family: "Fira Code", name: "Fira Code", category: "mono", categoryLabel: "Daktilo & Kod", sample: "KOD: YZ-8890" },
  { family: "Courier New", name: "Courier New", category: "mono", categoryLabel: "Daktilo & Kod", sample: "Daktilo Fontu" },
];

const FONT_FAMILIES = CANVA_FONTS.map((f) => f.family);

export const CANVA_COLOR_MATRIX = [
  // 1. Siyah, Griler & Beyaz
  ["#000000", "#1e293b", "#475569", "#64748b", "#94a3b8", "#cbd5e1", "#ffffff"],
  // 2. Kuyumcu Maden & Sıcak Tonlar
  ["#92400e", "#b45309", "#d4af37", "#eab308", "#facc15", "#fef08a", "#fffbeb"],
  // 3. Kırmızılar & Gül Kurusu / Pembe
  ["#7f1d1d", "#991b1b", "#dc2626", "#ef4444", "#fb7185", "#f43f5e", "#ec4899"],
  // 4. Turuncular & Amber
  ["#7c2d12", "#9a3412", "#c2410c", "#ea580c", "#f97316", "#fb923c", "#fed7aa"],
  // 5. Yeşiller & Zümrüt
  ["#14532d", "#166534", "#15803d", "#059669", "#10b981", "#34d399", "#a7f3d0"],
  // 6. Maviler & Safir
  ["#1e3a8a", "#1e40af", "#1d4ed8", "#2563eb", "#0284c7", "#0ea5e9", "#7dd3fc"],
  // 7. Morlar & Mürdüm
  ["#581c87", "#6b21a8", "#7e22ce", "#9333ea", "#a855f7", "#c084fc", "#e9d5ff"],
];

export const JEWELRY_PALETTE = [
  { name: "24K Saf Altın", color: "#eab308" },
  { name: "22K Klasik Altın", color: "#d4af37" },
  { name: "18K Rose Gold", color: "#fb7185" },
  { name: "14K Yeşil Altın", color: "#a3e635" },
  { name: "925 Gümüş", color: "#94a3b8" },
  { name: "Beyaz Altın", color: "#f8fafc" },
  { name: "Yakut Kırmızı", color: "#dc2626" },
  { name: "Zümrüt Yeşil", color: "#059669" },
  { name: "Safir Mavi", color: "#2563eb" },
  { name: "Oniks Siyah", color: "#000000" },
  { name: "Antik Bronz", color: "#92400e" },
  { name: "Şampanya", color: "#fde047" },
];

const ETIKET_TIPLERI = [
  { value: 0, ad: "Altın / Sarrafiye", badge: "#d97706", icon: "🪙" },
  { value: 1, ad: "Özel / Pırlanta", badge: "#6366f1", icon: "💎" },
  { value: 2, ad: "Yüzük / Dambıl", badge: "#0ea5e9", icon: "💍" },
  { value: 3, ad: "Fiyat & Ayar", badge: "#64748b", icon: "🏷️" },
  { value: 4, ad: "Kablosuz RFID", badge: "#10b981", icon: "📡" },
];

const ETIKET_SEKILLERI: { value: EtiketSekli; ad: string; icon: string; desc: string }[] = [
  { value: "kelebek", ad: "Kelebek (Çift Kanat)", icon: "🦋", desc: "İki kanatlı, katlamalı orta köprülü" },
  { value: "kuyruklu", ad: "Kuyruklu (Kordon/İpli)", icon: "🏷️", desc: "Gövde ve uzun kuyruk şeridi" },
  { value: "bogumlukuyruk", ad: "Boğumlu Kuyruk (Çift Kanat + Kuyruk)", icon: "🎗️", desc: "Ortada boğumlu iki kanat, sağda kuyruk şeridi" },
  { value: "dambil", ad: "Dambıl (Yüzük)", icon: "🦴", desc: "İki yuvarlak başlık, ince köprü" },
  { value: "rfid", ad: "Kablosuz RFID", icon: "📡", desc: "Dahili anten ve çip alanı" },
  { value: "dikdortgen", ad: "Standart Dikdörtgen", icon: "▬", desc: "Klasik kuyumcu kartı" },
  { value: "bogumlukuyrukkeskin", ad: "Boğumlu Kuyruk (Keskin Köşeli)", icon: "📐", desc: "Köşeleri yuvarlatılmamış, ortası boğumlu, sağda kuyruklu" },
];

const ALTIN_ALANLAR = [
  { key: "barkod", label: "Barkod No", icon: "▨" },
  { key: "grupKodu", label: "Grup Kodu", icon: "#" },
  { key: "ayar", label: "Ayar (14K/18K/22K)", icon: "⚖" },
  { key: "hasGram", label: "Has Gram", icon: "g" },
  { key: "gramaj", label: "Gramaj", icon: "g" },
  { key: "satisIscilik", label: "İşçilik", icon: "₺" },
  { key: "satisFiyati", label: "Satış Fiyatı", icon: "₺" },
  { key: "maliyet", label: "Maliyet", icon: "₺" },
  { key: "ureticiFirma", label: "Üretici Firma", icon: "🏭" },
  { key: "model", label: "Model", icon: "📐" },
  { key: "banko", label: "Banko", icon: "🗃" },
  { key: "altinKuru", label: "Altın Kuru", icon: "📈" },
  { key: "hasKuru1", label: "Has Kuru 1", icon: "₺" },
  { key: "hasKuru2", label: "Has Kuru 2", icon: "₺" },
  { key: "tarih", label: "Tarih", icon: "📅" },
  { key: "logoAlani", label: "Firma Logosu", icon: "🏢" },
  { key: "epcAlani", label: "EPC (RFID)", icon: "📡" },
];

const SHAPE_PRESETS = [
  { type: "line" as const, label: "Düz Çizgi", icon: "─", w: 25, h: 0.5 },
  { type: "line-dashed" as const, label: "Kesikli Çizgi", icon: "- -", w: 25, h: 0.5 },
  { type: "line-dotted" as const, label: "Noktalı Çizgi", icon: "···", w: 25, h: 0.5 },
  { type: "line-double" as const, label: "Çift Çizgi", icon: "═", w: 25, h: 1 },
  { type: "line-vertical" as const, label: "Dikey Çizgi", icon: "│", w: 0.5, h: 14 },
  { type: "rect" as const, label: "Dikdörtgen", icon: "▭", w: 18, h: 9 },
  { type: "rect-round" as const, label: "Yuvarlak Köşe", icon: "▢", w: 18, h: 9 },
  { type: "ellipse" as const, label: "Daire / Elips", icon: "○", w: 10, h: 10 },
  { type: "diamond" as const, label: "Baklava / Elmas", icon: "◇", w: 10, h: 10 },
];

const ICON_PRESETS = [
  { name: "star", label: "Yıldız", emoji: "⭐" },
  { name: "heart", label: "Kalp", emoji: "❤️" },
  { name: "crown", label: "Taç", emoji: "👑" },
  { name: "diamond", label: "Elmas", emoji: "💎" },
  { name: "ring", label: "Yüzük", emoji: "💍" },
  { name: "sparkle", label: "Işıltı", emoji: "✨" },
];

export const JEWELRY_QUICK_COLORS = [
  { name: "Siyah", color: "#000000" },
  { name: "Altın", color: "#d4af37" },
  { name: "Bronz", color: "#92400e" },
  { name: "Beyaz", color: "#ffffff" },
  { name: "Kırmızı", color: "#dc2626" },
  { name: "Zümrüt", color: "#059669" },
  { name: "Safir", color: "#2563eb" },
];

const POPULAR_SIZES = [
  { ad: "65×22 mm (Kelebek)", icon: "🦋", config: { genislikMm: 65, yukseklikMm: 22, etiketSekli: "kelebek" as const, solKanatMm: 28, kopruGenislikMm: 9 } },
  { ad: "70×15 mm (Kuyruklu)", icon: "🏷️", config: { genislikMm: 70, yukseklikMm: 15, etiketSekli: "kuyruklu" as const, kuyrukGenislikMm: 35, kuyrukKalinlikMm: 4 } },
  { ad: "75×20 mm (Boğumlu Kuyruk)", icon: "🎗️", config: { genislikMm: 75, yukseklikMm: 20, etiketSekli: "bogumlukuyruk" as const, solKanatMm: 30, sagKanatMm: 30, kopruGenislikMm: 8, bogumDerinlikMm: 2, kuyrukGenislikMm: 15, kuyrukKalinlikMm: 4 } },
  { ad: "80×12 mm (Dambıl)", icon: "🦴", config: { genislikMm: 80, yukseklikMm: 12, etiketSekli: "dambil" as const, solKanatMm: 35, kopruYukseklikMm: 4 } },
  { ad: "45×10 mm (Mini)", icon: "▬", config: { genislikMm: 45, yukseklikMm: 10, etiketSekli: "dikdortgen" as const } },
  { ad: "50×20 mm (Kare)", icon: "▬", config: { genislikMm: 50, yukseklikMm: 20, etiketSekli: "dikdortgen" as const } },
  { ad: "72×18 mm (RFID)", icon: "📡", config: { genislikMm: 72, yukseklikMm: 18, etiketSekli: "rfid" as const } },
  { ad: "75×20 mm (Boğumlu Kuyruk - Keskin Köşe)", icon: "📐", config: { genislikMm: 75, yukseklikMm: 20, etiketSekli: "bogumlukuyrukkeskin" as const, solKanatMm: 30, sagKanatMm: 30, kopruGenislikMm: 8, bogumDerinlikMm: 2, kuyrukGenislikMm: 15, kuyrukKalinlikMm: 4, koseYuvarlikligiMm: 0 } },
];

// ─── Tip Tanımları ────────────────────────────────────────────────────────────
export type ElementType =
  | "text"
  | "field"
  | "barcode"
  | "qr"
  | "rfid"
  | "rect"
  | "rect-round"
  | "ellipse"
  | "diamond"
  | "line"
  | "line-dashed"
  | "line-dotted"
  | "line-double"
  | "line-vertical"
  | "icon"
  | "image"
  | "logo";

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number; // mm
  y: number; // mm
  width: number; // mm
  height: number; // mm
  rotation: number; // degrees
  opacity: number; // 0-1
  locked: boolean;
  visible: boolean;
  zIndex: number;
  // Text/Field
  text?: string;
  isNumeric?: boolean;
  fieldKey?: string;
  prefix?: string;
  suffix?: string;
  fontSize?: number; // pt
  fontFamily?: string;
  fontWeight?: "normal" | "bold" | "600";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline" | "line-through";
  textTransform?: "none" | "uppercase" | "lowercase";
  textAlign?: "left" | "center" | "right";
  color?: string;

  // Shape/Container
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  // Icon
  iconName?: string;
  iconEmoji?: string;
  // Barcode
  barcodeFormat?: "CODE128" | "EAN13" | "QR" | "RFID";
  barcodeValue?: string;
  barcodeText?: string;
  showText?: boolean;
  // Image
  imageData?: string;
}

export interface LabelConfig {
  etiketTipi: number;
  etiketSekli: EtiketSekli;
  genislikMm: number;
  yukseklikMm: number;
  solKanatMm: number;
  sagKanatMm: number;
  kopruGenislikMm: number;    // Boğum Genişliği (mm)
  bogumDerinlikMm?: number;   // Boğum / Çentik Derinliği (mm) - Normal etiket basıcı kağıtlarına göre
  kopruYukseklikMm: number;   // Boğum Kalan Yüksekliği
  kuyrukGenislikMm: number;   // Tail length (mm)
  kuyrukKalinlikMm: number;   // Tail height/thickness (mm)
  delikCapiMm: number;
  delikKonumu: "yok" | "sol" | "orta" | "sag";
  katlamaCizgisi: boolean;
  bgColor: string;
  bgTexture: "beyaz" | "krem" | "siyah" | "altin";
  koseYuvarlikligiMm?: number; // Dış köşe yuvarlaklığı (mm) - tüm şekillerde ayarlanabilir
  bogumEkle?: boolean;         // Standart Dikdörtgen üzerine özel boğum ekle
  kuyrukEkle?: boolean;        // Standart Dikdörtgen üzerine özel kuyruk ekle
  yaziciUstKaydirmaMm?: number; // Yazıcı Üst Kaydırma Offseti (mm)
  yaziciSolKaydirmaMm?: number; // Yazıcı Sol Kaydırma Offseti (mm)
}

export type PaperLayoutId =
  | "single"
  | "roll"
  | "roll2"
  | "roll3"
  | "a4"
  | "a5"
  | "a6"
  | "a3"
  | "sheet_100x150"
  | "strip_80x200";

export interface PaperLayoutOption {
  id: PaperLayoutId;
  name: string;
  shortName: string;
  icon: string;
  badge: string;
  widthMm: number;
  heightMm: number;
  description: string;
}

export const PAPER_LAYOUTS: PaperLayoutOption[] = [
  {
    id: "single",
    name: "Tekli 1:1",
    shortName: "Tekli 1:1",
    icon: "🏷️",
    badge: "1:1 Birebir",
    widthMm: 0,
    heightMm: 0,
    description: "Tekli etiket birebir milimetrik görünüm",
  },
  {
    id: "roll",
    name: "1'li Rulo",
    shortName: "1'li Rulo",
    icon: "📜",
    badge: "Tek Sıra Rulo",
    widthMm: 0,
    heightMm: 0,
    description: "Kuyumcu tek sıra termal barkod rulosu",
  },
  {
    id: "roll2",
    name: "2'li Rulo",
    shortName: "2'li Rulo",
    icon: "📜",
    badge: "Çift Sıra Rulo",
    widthMm: 0,
    heightMm: 0,
    description: "2'li yan yana çift sıralı kuyumcu rulosu",
  },
  {
    id: "roll3",
    name: "3'lü Rulo",
    shortName: "3'lü Rulo",
    icon: "📜",
    badge: "Üç Sıra Rulo",
    widthMm: 0,
    heightMm: 0,
    description: "3'lü yan yana üç sıralı kuyumcu rulosu",
  },
  {
    id: "a4",
    name: "A4 Tabaka",
    shortName: "A4 Tabaka",
    icon: "📄",
    badge: "A4 Tabaka",
    widthMm: 210,
    heightMm: 297,
    description: "Standart A4 etiket sayfasına çoklu tabaka dizilimi (210×297 mm)",
  },
  {
    id: "a5",
    name: "A5 Tabaka",
    shortName: "A5 Tabaka",
    icon: "📄",
    badge: "A5 Tabaka",
    widthMm: 148,
    heightMm: 210,
    description: "A5 yarım boy etiket tabakası (148×210 mm)",
  },
  {
    id: "a6",
    name: "A6 Tabaka",
    shortName: "A6 Tabaka",
    icon: "📄",
    badge: "A6 Tabaka",
    widthMm: 105,
    heightMm: 148,
    description: "A6 çeyrek boy mini etiket tabakası (105×148 mm)",
  },
  {
    id: "a3",
    name: "A3 Tabaka",
    shortName: "A3 Tabaka",
    icon: "📑",
    badge: "A3 Tabaka",
    widthMm: 297,
    heightMm: 420,
    description: "Geniş A3 matbaa tabakası (297×420 mm)",
  },
  {
    id: "sheet_100x150",
    name: "10×15 Tabaka",
    shortName: "10×15 Tabaka",
    icon: "🏷️",
    badge: "10×15 Kart",
    widthMm: 100,
    heightMm: 150,
    description: "100×150 mm kuyumcu mini etiket kartı tabakası",
  },
  {
    id: "strip_80x200",
    name: "8×20 Şerit",
    shortName: "8×20 Şerit",
    icon: "📜",
    badge: "8×20 Şerit",
    widthMm: 80,
    heightMm: 200,
    description: "80×200 mm kuyumcu vitrin şerit kartı",
  },
];

export interface PaperTypeOption {
  id: string;
  name: string;
  shortName: string;
  bgColor: string;
  borderColor: string;
  previewBg: string;
  shadow?: string;
  isDark?: boolean;
  opacity?: number;
  description: string;
}

export const LABEL_PAPERS: PaperTypeOption[] = [
  {
    id: "kuse_beyaz",
    name: "Kuşe Parlak Beyaz",
    shortName: "Kuşe Beyaz",
    bgColor: "#ffffff",
    borderColor: "#cbd5e1",
    previewBg: "#ffffff",
    description: "Standart kuyumcu parlak beyaz kuşe etiket",
  },
  {
    id: "mat_pp",
    name: "Mat Polipropilen (PP)",
    shortName: "Mat PP",
    bgColor: "#f8fafc",
    borderColor: "#94a3b8",
    previewBg: "#f1f5f9",
    description: "Yırtılmaz, suya ve parfüme dayanıklı mat PP etiket",
  },
  {
    id: "metalik_altin",
    name: "Metalik Altın Varak (Gold)",
    shortName: "Metalik Altın",
    bgColor: "#fef08a",
    borderColor: "#ca8a04",
    previewBg: "linear-gradient(135deg, #fef08a, #ca8a04)",
    description: "Lüks altın varak metalize kuyumcu etiketi",
  },
  {
    id: "metalik_gumus",
    name: "Metalik Parlak Gümüş (Silver)",
    shortName: "Metalik Gümüş",
    bgColor: "#e2e8f0",
    borderColor: "#94a3b8",
    previewBg: "linear-gradient(135deg, #ffffff, #94a3b8)",
    description: "Pırlanta ve saat için metalik gümüş folyo etiket",
  },
  {
    id: "seffaf",
    name: "Buzlu Şeffaf (Transparan)",
    shortName: "Şeffaf",
    bgColor: "rgba(255, 255, 255, 0.7)",
    borderColor: "#38bdf8",
    previewBg: "repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%) 50% / 8px 8px",
    opacity: 0.85,
    description: "Şeffaf transparan kuyumcu yüzük ve bileklik etiketi",
  },
  {
    id: "siyah_mat",
    name: "Lüks Mat Siyah (Dark Velvet)",
    shortName: "Siyah Mat",
    bgColor: "#18181b",
    borderColor: "#52525b",
    previewBg: "#18181b",
    isDark: true,
    description: "Özel koleksiyon ve pırlanta için mat siyah etiket",
  },
  {
    id: "kraft",
    name: "Doğal Kraft / Saman Kağıt",
    shortName: "Kraft Kağıt",
    bgColor: "#d7be9d",
    borderColor: "#a88860",
    previewBg: "#d7be9d",
    description: "Doğal ve otantik el yapımı mücevher kraft etiketi",
  },
  {
    id: "saten_krem",
    name: "Saten Dokulu Krem (İpek)",
    shortName: "Saten Krem",
    bgColor: "#fffbeb",
    borderColor: "#fde68a",
    previewBg: "#fef3c7",
    description: "İpek ve saten kumaş dokulu zarif krem etiket",
  },
];

export interface BuiltinTemplate {
  id: string;
  ad: string;
  kategori: string;
  etiketTipi: number;
  icon: string;
  aciklama: string;
  config: LabelConfig;
  elements: Partial<CanvasElement>[];
}

export const JEWELRY_LOGOS = [
  {
    id: "logo_likya",
    name: "Likya Altın",
    icon: "👑",
    dataUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 40' fill='%23b45309'><path d='M10 30 L20 10 L30 25 L40 10 L50 30 Z'/><text x='55' y='26' font-size='15' font-family='Arial' font-weight='bold' fill='%23b45309'>LİKYA</text></svg>",
  },
  {
    id: "logo_14k",
    name: "14K Damga",
    icon: "⚖️",
    dataUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30' fill='%230f172a'><rect x='2' y='2' width='56' height='26' rx='5' fill='none' stroke='%23000' stroke-width='2'/><text x='30' y='20' font-size='13' font-family='Arial' font-weight='bold' text-anchor='middle' fill='%23000'>585 14K</text></svg>",
  },
  {
    id: "logo_22k",
    name: "22K Sarrafiye",
    icon: "🪙",
    dataUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 30' fill='%23b45309'><rect x='2' y='2' width='56' height='26' rx='5' fill='none' stroke='%23b45309' stroke-width='2'/><text x='30' y='20' font-size='13' font-family='Arial' font-weight='bold' text-anchor='middle' fill='%23b45309'>916 22K</text></svg>",
  },
  {
    id: "logo_pirlanta",
    name: "Pırlanta Crest",
    icon: "💎",
    dataUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='%230284c7'><polygon points='20,4 36,14 30,34 10,34 4,14' fill='none' stroke='%230284c7' stroke-width='2'/><polygon points='20,4 26,14 20,34 14,14' fill='none' stroke='%230284c7' stroke-width='1.5'/><line x1='4' y1='14' x2='36' y2='14' stroke='%230284c7' stroke-width='1.5'/></svg>",
  },
  {
    id: "logo_tse",
    name: "TSE Garanti",
    icon: "🛡️",
    dataUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 30' fill='%230f172a'><ellipse cx='25' cy='15' rx='22' ry='12' fill='none' stroke='%23000' stroke-width='2'/><text x='25' y='19' font-size='11' font-family='Arial' font-weight='bold' text-anchor='middle' fill='%23000'>TSE</text></svg>",
  },
  {
    id: "logo_rfid",
    name: "RFID Anten",
    icon: "📡",
    dataUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40' fill='%23059669'><path d='M8 20 A12 12 0 0 1 32 20 M12 20 A8 8 0 0 1 28 20 M16 20 A4 4 0 0 1 24 20' fill='none' stroke='%23059669' stroke-width='2'/><circle cx='20' cy='20' r='2' fill='%23059669'/></svg>",
  },
];

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "builtin_1",
    ad: "14K / 22K Kelebek Sarrafiye (Altın Çift Çerçeveli)",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "🦋",
    aciklama: "65×22 mm altın varak çift çerçeveli klasik çift kanatlı kuyumcu etiketi",
    config: {
      etiketTipi: 0,
      etiketSekli: "kelebek",
      genislikMm: 65,
      yukseklikMm: 22,
      solKanatMm: 28,
      sagKanatMm: 28,
      kopruGenislikMm: 6,
      bogumDerinlikMm: 2.0,
      kopruYukseklikMm: 18,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 26, height: 20, borderColor: "#d4af37", borderWidth: 1.2 },
      { type: "rect", x: 37, y: 1, width: 27, height: 20, borderColor: "#d4af37", borderWidth: 1.2 },
      { type: "text", x: 2, y: 2, width: 24, height: 3.5, text: "LİKYA KUYUMCULUK", fontSize: 7, fontWeight: "bold", color: "#b45309" },
      { type: "barcode", x: 2, y: 6, width: 24, height: 7.5, barcodeValue: "140829104", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 15.5, width: 24, height: 4.5, text: "₺ 18.450", fontSize: 9.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 38, y: 2.5, width: 25, height: 3.5, text: "14K Dorika Kolye", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "field", x: 38, y: 6.5, width: 12, height: 3, fieldKey: "ayar", text: "585 (14K)", fontSize: 7, color: "#b45309" },
      { type: "field", x: 51, y: 6.5, width: 13, height: 3, fieldKey: "gramaj", text: "3.42 gr", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "field", x: 38, y: 10.5, width: 25, height: 3, fieldKey: "satisIscilik", text: "İşçilik: ₺140/g", fontSize: 6.5, color: "#475569" },
      { type: "field", x: 38, y: 14.5, width: 25, height: 3.5, text: "KOD: KL-8492", fontSize: 6.5, color: "#64748b" },
    ],
  },
  {
    id: "builtin_2",
    ad: "VIP Pırlanta QR Sertifika Kartı (Safir Çerçeveli Kelebek)",
    kategori: "Özel / Pırlanta",
    etiketTipi: 1,
    icon: "💎",
    aciklama: "70×20 mm safir mavisi sertifika çerçeveli, karat/renk ve QR kodlu pırlanta etiketi",
    config: {
      etiketTipi: 1,
      etiketSekli: "kelebek",
      genislikMm: 70,
      yukseklikMm: 20,
      solKanatMm: 30,
      sagKanatMm: 30,
      kopruGenislikMm: 6,
      bogumDerinlikMm: 1.5,
      kopruYukseklikMm: 17,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 28, height: 18, borderColor: "#0369a1", borderWidth: 1.2 },
      { type: "rect", x: 41, y: 1, width: 28, height: 18, borderColor: "#0369a1", borderWidth: 1.2 },
      { type: "text", x: 2, y: 2, width: 17, height: 3.5, text: "DIAMOND VIP", fontSize: 7, fontWeight: "bold", color: "#0284c7" },
      { type: "qr", x: 20, y: 2, width: 8, height: 8, barcodeValue: "https://cert.likyakuyum.com/D8492", barcodeFormat: "QR" },
      { type: "barcode", x: 2, y: 9.5, width: 26, height: 5, barcodeValue: "PIRL-94021", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 15, width: 26, height: 3.5, text: "$ 1.450 / ₺ 49.000", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 42, y: 2, width: 26, height: 3.5, text: "0.45 CT Tektaş Yüzük", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 42, y: 6, width: 13, height: 3, text: "Renk: F", fontSize: 7, color: "#000" },
      { type: "text", x: 55, y: 6, width: 13, height: 3, text: "Berraklık: VS1", fontSize: 7, color: "#000" },
      { type: "text", x: 42, y: 9.5, width: 26, height: 3, text: "18K Altın (2.85 gr)", fontSize: 6.5, color: "#475569" },
      { type: "text", x: 42, y: 14, width: 26, height: 3.5, text: "HRD Sertifika: 240981", fontSize: 6.5, fontWeight: "bold", color: "#0284c7" },
    ],
  },
  {
    id: "builtin_3",
    ad: "22K Ajda & Burma Bilezik (Amber Yuvarlak Kenarlı Kuyruk Flama)",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "🏷️",
    aciklama: "85×16 mm amber yuvarlatılmış kavisli gövde ve 45mm kuyruk şeritli bilezik etiketi",
    config: {
      etiketTipi: 0,
      etiketSekli: "kuyruklu",
      genislikMm: 85,
      yukseklikMm: 16,
      solKanatMm: 38,
      sagKanatMm: 45,
      kopruGenislikMm: 5,
      bogumDerinlikMm: 0,
      kopruYukseklikMm: 16,
      kuyrukGenislikMm: 45,
      kuyrukKalinlikMm: 3.5,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect-round", x: 1, y: 1, width: 36, height: 14, borderColor: "#b45309", borderWidth: 1.2, borderRadius: 2.5 },
      { type: "barcode", x: 2, y: 2, width: 20, height: 5.5, barcodeValue: "220849102", barcodeFormat: "CODE128" },
      { type: "text", x: 23, y: 2, width: 13, height: 3.5, text: "22 AYAR", fontSize: 7, fontWeight: "bold", color: "#b45309" },
      { type: "text", x: 23, y: 5.5, width: 13, height: 3.5, text: "14.80 g", fontSize: 8, fontWeight: "bold", color: "#000" },
      { type: "text", x: 2, y: 8.5, width: 34, height: 3, text: "Ajda Bilezik 22K (916)", fontSize: 6.5, color: "#000" },
      { type: "text", x: 2, y: 11.5, width: 34, height: 3.5, text: "₺ 48.950", fontSize: 8.5, fontWeight: "bold", color: "#000" },
    ],
  },
  {
    id: "builtin_4",
    ad: "Dambıl İki Başlıklı Yüzük & Alyans (Elips / Yuvarlak Başlıklar)",
    kategori: "Yüzük / Dambıl",
    etiketTipi: 2,
    icon: "🦴",
    aciklama: "60×14 mm iki yuvarlak elips başlıklı, sol tarafta yüzük ölçüsü çemberi ve sağda fiyat",
    config: {
      etiketTipi: 2,
      etiketSekli: "dambil",
      genislikMm: 60,
      yukseklikMm: 14,
      solKanatMm: 25,
      sagKanatMm: 25,
      kopruGenislikMm: 8,
      bogumDerinlikMm: 3.0,
      kopruYukseklikMm: 7,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "ellipse", x: 1, y: 1, width: 23, height: 12, borderColor: "#0f172a", borderWidth: 0.8 },
      { type: "ellipse", x: 36, y: 1, width: 23, height: 12, borderColor: "#0f172a", borderWidth: 0.8 },
      { type: "barcode", x: 2.5, y: 2, width: 20, height: 5, barcodeValue: "YZ-8402", barcodeFormat: "CODE128" },
      { type: "text", x: 2.5, y: 8, width: 20, height: 3.5, text: "ÖLÇÜ: 14", fontSize: 7, fontWeight: "bold", color: "#0284c7" },
      { type: "text", x: 37.5, y: 2, width: 20, height: 3.5, text: "2.85 gr 14K", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 37.5, y: 5.5, width: 20, height: 2.5, text: "KOD: ALY-10", fontSize: 6, color: "#64748b" },
      { type: "text", x: 37.5, y: 8, width: 20, height: 4, text: "₺ 8.250", fontSize: 8.5, fontWeight: "bold", color: "#000" },
    ],
  },
  {
    id: "builtin_5",
    ad: "24K Yatırımlık Darphane Külçe & Ziynet (Altın Köşebentli Çerçeve)",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "🪙",
    aciklama: "50×18 mm çeyrek, yarım, cumhuriyet ve gram külçe altın için parlak altın yaldızlı etiket",
    config: {
      etiketTipi: 0,
      etiketSekli: "kelebek",
      genislikMm: 50,
      yukseklikMm: 18,
      solKanatMm: 22,
      sagKanatMm: 22,
      kopruGenislikMm: 5,
      bogumDerinlikMm: 1.5,
      kopruYukseklikMm: 15,
      kuyrukGenislikMm: 30,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 20, height: 16, borderColor: "#ca8a04", borderWidth: 1.2 },
      { type: "rect", x: 29, y: 1, width: 20, height: 16, borderColor: "#ca8a04", borderWidth: 1.2 },
      { type: "text", x: 2, y: 2, width: 18, height: 3.5, text: "DARPHANE", fontSize: 7, fontWeight: "bold", color: "#b45309" },
      { type: "barcode", x: 2, y: 6, width: 18, height: 5.5, barcodeValue: "CYR-2026", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 12.5, width: 18, height: 3.5, text: "1.75 gr Has", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 30, y: 2, width: 18, height: 3.5, text: "YENİ ÇEYREK", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 30, y: 6, width: 18, height: 3, text: "Ayar: 916 (22K)", fontSize: 6.5, color: "#475569" },
      { type: "text", x: 30, y: 9.5, width: 18, height: 3, text: "Kur: ₺ 3.140", fontSize: 6.5, color: "#64748b" },
      { type: "text", x: 30, y: 13, width: 18, height: 3.5, text: "₺ 5.580", fontSize: 8.5, fontWeight: "bold", color: "#000" },
    ],
  },
  {
    id: "builtin_6",
    ad: "Kablosuz RFID Akıllı Mağaza Etiketi (Zümrüt Yeşil Antenli)",
    kategori: "Kablosuz RFID",
    etiketTipi: 4,
    icon: "📡",
    aciklama: "60×22 mm dahili antenli, EPC kodlu ve barkodlu RFID akıllı mücevher etiketi",
    config: {
      etiketTipi: 4,
      etiketSekli: "rfid",
      genislikMm: 60,
      yukseklikMm: 22,
      solKanatMm: 30,
      sagKanatMm: 30,
      kopruGenislikMm: 6,
      bogumDerinlikMm: 0,
      kopruYukseklikMm: 22,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: false,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 58, height: 20, borderColor: "#059669", borderWidth: 1.2 },
      { type: "text", x: 3, y: 2, width: 26, height: 4, text: "📡 RFID SMART TAG", fontSize: 7, fontWeight: "bold", color: "#059669" },
      { type: "field", x: 3, y: 6.5, width: 34, height: 3, fieldKey: "epcAlani", text: "EPC: E280116060000214", fontSize: 6, color: "#059669" },
      { type: "barcode", x: 3, y: 10.5, width: 30, height: 6, barcodeValue: "RFID-9401", barcodeFormat: "CODE128" },
      { type: "text", x: 3, y: 17, width: 30, height: 3.5, text: "Altın Kelepçe 14K", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 36, y: 10.5, width: 20, height: 4, text: "18.20 gr", fontSize: 8.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 36, y: 15.5, width: 20, height: 4.5, text: "₺ 64.500", fontSize: 9, fontWeight: "bold", color: "#059669" },
    ],
  },
  {
    id: "builtin_7",
    ad: "Lüks İsviçre Kol Saati (Dikey Bölmeli Antrasit Kart)",
    kategori: "Fiyat & Ayar",
    etiketTipi: 3,
    icon: "⏱️",
    aciklama: "64×20 mm safir cam, otomatik mekanizma ve garanti detaylı dikey ayırıcılı lüks saat etiketi",
    config: {
      etiketTipi: 3,
      etiketSekli: "dikdortgen",
      genislikMm: 64,
      yukseklikMm: 20,
      solKanatMm: 32,
      sagKanatMm: 32,
      kopruGenislikMm: 0,
      bogumDerinlikMm: 0,
      kopruYukseklikMm: 20,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 62, height: 18, borderColor: "#1e293b", borderWidth: 1 },
      { type: "line-vertical", x: 31, y: 1, width: 1, height: 18, borderColor: "#cbd5e1" },
      { type: "text", x: 3, y: 2, width: 26, height: 4, text: "GENEVE LUXURY", fontSize: 7, fontWeight: "bold", color: "#0f172a" },
      { type: "barcode", x: 3, y: 6.5, width: 26, height: 6.5, barcodeValue: "SW-84920", barcodeFormat: "CODE128" },
      { type: "text", x: 3, y: 14.5, width: 26, height: 4, text: "₺ 68.000", fontSize: 9, fontWeight: "bold", color: "#000" },
      { type: "text", x: 34, y: 2, width: 27, height: 4, text: "Otomatik Chrono", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 34, y: 6.5, width: 27, height: 3, text: "Safir Cam • 50M", fontSize: 6, color: "#475569" },
      { type: "text", x: 34, y: 10, width: 27, height: 3, text: "316L Çelik Kasa", fontSize: 6.5, color: "#000" },
      { type: "text", x: 34, y: 14, width: 27, height: 3.5, text: "5 Yıl Garanti", fontSize: 6, color: "#059669" },
    ],
  },
  {
    id: "builtin_8",
    ad: "Rose Gold & Pembe Taşlı Butik Kolye (Pembe Kesikli Oval Çerçeveli)",
    kategori: "Özel / Pırlanta",
    etiketTipi: 1,
    icon: "🌸",
    aciklama: "65×20 mm zarif pembe kavisli çerçeveli, rose gold ve fantezi renkli taşlı kolye etiketi",
    config: {
      etiketTipi: 1,
      etiketSekli: "kelebek",
      genislikMm: 65,
      yukseklikMm: 20,
      solKanatMm: 28,
      sagKanatMm: 28,
      kopruGenislikMm: 6,
      bogumDerinlikMm: 2.0,
      kopruYukseklikMm: 16,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect-round", x: 1, y: 1, width: 26, height: 18, borderColor: "#db2777", borderWidth: 1.2, borderRadius: 2.5 },
      { type: "rect-round", x: 37, y: 1, width: 27, height: 18, borderColor: "#db2777", borderWidth: 1.2, borderRadius: 2.5 },
      { type: "text", x: 2, y: 2, width: 24, height: 3.5, text: "ROSE BOUTIQUE", fontSize: 7, fontWeight: "bold", color: "#be185d" },
      { type: "barcode", x: 2, y: 6.5, width: 24, height: 6.5, barcodeValue: "RSE-8491", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 14.5, width: 24, height: 4, text: "₺ 26.800", fontSize: 9, fontWeight: "bold", color: "#000" },
      { type: "text", x: 38, y: 2, width: 25, height: 3.5, text: "14K Pembe Kolye", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 38, y: 6, width: 12, height: 3, text: "585 Ayar", fontSize: 6.5, color: "#be185d" },
      { type: "text", x: 50, y: 6, width: 13, height: 3, text: "3.95 gr", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 38, y: 9.5, width: 25, height: 3, text: "Doğal Safir & Zirkon", fontSize: 6, color: "#475569" },
      { type: "text", x: 38, y: 13.5, width: 25, height: 3.5, text: "Kod: NCK-ROSE-26", fontSize: 6, color: "#64748b" },
    ],
  },
  {
    id: "builtin_9",
    ad: "22K Mega Trabzon Hasırı (Keskin Boğumlu Çift Kanat + Kuyruk)",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "📐",
    aciklama: "85×18 mm keskin boğumlu çift kanat ve kuyruk şeridi ile ağır hasır bilezik etiketi",
    config: {
      etiketTipi: 0,
      etiketSekli: "bogumlukuyrukkeskin",
      genislikMm: 85,
      yukseklikMm: 18,
      solKanatMm: 35,
      sagKanatMm: 35,
      kopruGenislikMm: 8,
      bogumDerinlikMm: 2,
      kopruYukseklikMm: 18,
      kuyrukGenislikMm: 15,
      kuyrukKalinlikMm: 4,
      koseYuvarlikligiMm: 0,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 33, height: 16, borderColor: "#b45309", borderWidth: 1.2 },
      { type: "barcode", x: 2, y: 2, width: 22, height: 6, barcodeValue: "TRB-2208", barcodeFormat: "CODE128" },
      { type: "text", x: 25, y: 2, width: 8, height: 3, text: "22K", fontSize: 6.5, fontWeight: "bold", color: "#b45309" },
      { type: "text", x: 25, y: 5.5, width: 8, height: 3, text: "36.4g", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 2, y: 9, width: 31, height: 3, text: "Trabzon Hasırı 19 Sıra", fontSize: 6.5, color: "#000" },
      { type: "text", x: 2, y: 12.5, width: 31, height: 4, text: "₺ 118.500", fontSize: 9, fontWeight: "bold", color: "#000" },
      { type: "text", x: 42, y: 2, width: 26, height: 3.5, text: "Has: 33.34 gr", fontSize: 7, color: "#475569" },
      { type: "text", x: 42, y: 6.5, width: 26, height: 3.5, text: "TSE & Garanti Belgeli", fontSize: 6, color: "#059669" },
    ],
  },
  {
    id: "builtin_10",
    ad: "Promosyon & Kampanya Kartı (Kırmızı Çift Çizgili İndirimli)",
    kategori: "Fiyat & Ayar",
    etiketTipi: 3,
    icon: "🔥",
    aciklama: "55×20 mm üzeri çizili eski liste fiyatı ve indirimli net kırmızı çerçeveli etiket",
    config: {
      etiketTipi: 3,
      etiketSekli: "dikdortgen",
      genislikMm: 55,
      yukseklikMm: 20,
      solKanatMm: 27.5,
      sagKanatMm: 27.5,
      kopruGenislikMm: 0,
      bogumDerinlikMm: 0,
      kopruYukseklikMm: 20,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 53, height: 18, borderColor: "#dc2626", borderWidth: 1.2 },
      { type: "text", x: 2, y: 2, width: 22, height: 4, text: "🔥 %20 İNDİRİM", fontSize: 7.5, fontWeight: "bold", color: "#dc2626" },
      { type: "barcode", x: 2, y: 7, width: 22, height: 6, barcodeValue: "PRM-5821", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 14.5, width: 22, height: 3.5, text: "KOD: IND-20", fontSize: 6.5, color: "#64748b" },
      { type: "text", x: 28, y: 2, width: 24, height: 4, text: "14K İtalyan Zincir", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 28, y: 6.5, width: 24, height: 3, text: "Ağırlık: 4.50 gr", fontSize: 6.5, color: "#000" },
      { type: "text", x: 28, y: 10, width: 24, height: 3, text: "₺ 22.000", fontSize: 7, textDecoration: "underline", color: "#94a3b8" },
      { type: "text", x: 28, y: 13.5, width: 24, height: 4.5, text: "₺ 17.600", fontSize: 9.5, fontWeight: "bold", color: "#dc2626" },
    ],
  },
  {
    id: "builtin_11",
    ad: "Zümrüt & Safir Gerdanlık (Koyu Orman Yeşili Çerçeveli Kelebek)",
    kategori: "Özel / Pırlanta",
    etiketTipi: 1,
    icon: "👑",
    aciklama: "72×22 mm koyu zümrüt köşebentli, damla kesim renkli taş ve pırlanta karat tablosu",
    config: {
      etiketTipi: 1,
      etiketSekli: "kelebek",
      genislikMm: 72,
      yukseklikMm: 22,
      solKanatMm: 31,
      sagKanatMm: 31,
      kopruGenislikMm: 6,
      bogumDerinlikMm: 2.0,
      kopruYukseklikMm: 18,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 29, height: 20, borderColor: "#047857", borderWidth: 1.2 },
      { type: "rect", x: 42, y: 1, width: 29, height: 20, borderColor: "#047857", borderWidth: 1.2 },
      { type: "text", x: 2, y: 2, width: 27, height: 3.5, text: "ROYAL EMERALD", fontSize: 7, fontWeight: "bold", color: "#047857" },
      { type: "barcode", x: 2, y: 6.5, width: 27, height: 7, barcodeValue: "ZMR-8401", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 15, width: 27, height: 4.5, text: "₺ 78.500", fontSize: 9.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 43, y: 2, width: 27, height: 3.5, text: "Zümrüt Damla Kolye", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 43, y: 6, width: 27, height: 3, text: "Zümrüt: 1.20 CT Doğal", fontSize: 7, color: "#047857" },
      { type: "text", x: 43, y: 9.5, width: 27, height: 3, text: "Pırlanta: 0.35 CT F-VS", fontSize: 6.5, color: "#0284c7" },
      { type: "text", x: 43, y: 13, width: 27, height: 3, text: "18K Beyaz (8.40 gr)", fontSize: 6.5, color: "#000" },
      { type: "text", x: 43, y: 16.5, width: 27, height: 3.5, text: "Uluslararası Sertifikalı", fontSize: 6, color: "#059669" },
    ],
  },
  {
    id: "builtin_12",
    ad: "Nazar Boncuklu Mineli Bebek Künyesi (Gök Mavisi Yumuşak Oval)",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "🧿",
    aciklama: "48×14 mm açık mavi yuvarlak kavisli çerçeveli, bebek künyesi ve hediyelik altın etiket",
    config: {
      etiketTipi: 0,
      etiketSekli: "kelebek",
      genislikMm: 48,
      yukseklikMm: 14,
      solKanatMm: 21,
      sagKanatMm: 21,
      kopruGenislikMm: 5,
      bogumDerinlikMm: 1.5,
      kopruYukseklikMm: 11,
      kuyrukGenislikMm: 25,
      kuyrukKalinlikMm: 3.5,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect-round", x: 1, y: 1, width: 19, height: 12, borderColor: "#38bdf8", borderWidth: 1, borderRadius: 2.5 },
      { type: "rect-round", x: 28, y: 1, width: 19, height: 12, borderColor: "#38bdf8", borderWidth: 1, borderRadius: 2.5 },
      { type: "barcode", x: 1.5, y: 1.5, width: 18, height: 5, barcodeValue: "BBK-3021", barcodeFormat: "CODE128" },
      { type: "text", x: 1.5, y: 7.5, width: 18, height: 4, text: "₺ 6.850", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 29, y: 1.5, width: 17, height: 3, text: "14K Bebek Künye", fontSize: 6.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 29, y: 5, width: 17, height: 2.5, text: "1.85 gr (585)", fontSize: 6, color: "#475569" },
      { type: "text", x: 29, y: 8, width: 17, height: 3.5, text: "Mineli Nazar", fontSize: 6, color: "#0284c7" },
    ],
  },
  {
    id: "builtin_13",
    ad: "Erkek Oniks & Şövalye Yüzük (Mat Siyah Dikdörtgen Dambıl)",
    kategori: "Yüzük / Dambıl",
    etiketTipi: 2,
    icon: "🛡️",
    aciklama: "62×20 mm mat siyah maskülen dikdörtgen başlıklı, erkek oniks şövalye yüzük etiketi",
    config: {
      etiketTipi: 2,
      etiketSekli: "dambil",
      genislikMm: 62,
      yukseklikMm: 20,
      solKanatMm: 26,
      sagKanatMm: 26,
      kopruGenislikMm: 8,
      bogumDerinlikMm: 3.0,
      kopruYukseklikMm: 10,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 24, height: 18, borderColor: "#0f172a", borderWidth: 1.2 },
      { type: "rect", x: 37, y: 1, width: 24, height: 18, borderColor: "#0f172a", borderWidth: 1.2 },
      { type: "barcode", x: 2, y: 2, width: 22, height: 6.5, barcodeValue: "MEN-9402", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 10, width: 22, height: 4, text: "₺ 21.500", fontSize: 8.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 2, y: 15, width: 22, height: 3.5, text: "ÖLÇÜ: 24", fontSize: 7, fontWeight: "bold", color: "#0284c7" },
      { type: "text", x: 38, y: 2, width: 22, height: 4, text: "14K Oniks Şövalye", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 38, y: 7, width: 22, height: 3.5, text: "Ağırlık: 6.85 gr", fontSize: 7, color: "#000" },
      { type: "text", x: 38, y: 11.5, width: 22, height: 3.5, text: "Doğal Oniks Taşlı", fontSize: 6.5, color: "#475569" },
      { type: "text", x: 38, y: 15.5, width: 22, height: 3.5, text: "Kod: SVL-024", fontSize: 6, color: "#64748b" },
    ],
  },
  {
    id: "builtin_14",
    ad: "Kuyruklu İnce İtalyan Zincir & Halhal (Mor / Eflatun İnce Şerit)",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "📿",
    aciklama: "75×12 mm eflatun zarif kavisli minyatür gövde ve 40mm ultra-ince kuyruk şeritli etiket",
    config: {
      etiketTipi: 0,
      etiketSekli: "kuyruklu",
      genislikMm: 75,
      yukseklikMm: 12,
      solKanatMm: 30,
      sagKanatMm: 40,
      kopruGenislikMm: 5,
      bogumDerinlikMm: 0,
      kopruYukseklikMm: 12,
      kuyrukGenislikMm: 40,
      kuyrukKalinlikMm: 2.8,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect-round", x: 1, y: 1, width: 28, height: 10, borderColor: "#7c3aed", borderWidth: 1, borderRadius: 2 },
      { type: "barcode", x: 2, y: 1.5, width: 17, height: 4.5, barcodeValue: "ZNC-7401", barcodeFormat: "CODE128" },
      { type: "text", x: 20, y: 1.5, width: 8, height: 3, text: "14K", fontSize: 6.5, fontWeight: "bold", color: "#7c3aed" },
      { type: "text", x: 20, y: 5.5, width: 8, height: 3, text: "2.10g", fontSize: 6.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 2, y: 6.5, width: 17, height: 3.5, text: "₺ 8.900", fontSize: 7.5, fontWeight: "bold", color: "#000" },
    ],
  },
  {
    id: "builtin_15",
    ad: "Boğumlu Çift Kanat Lüks Pırlanta Seti (Kraliyet Kobalt Mavisi + Kuyruk)",
    kategori: "Özel / Pırlanta",
    etiketTipi: 1,
    icon: "🎗️",
    aciklama: "88×20 mm boğumlu çift kanat kobalt mavi çerçeve ve sağda kordon kuyruğu ile lüks set etiketi",
    config: {
      etiketTipi: 1,
      etiketSekli: "bogumlukuyruk",
      genislikMm: 88,
      yukseklikMm: 20,
      solKanatMm: 36,
      sagKanatMm: 36,
      kopruGenislikMm: 8,
      bogumDerinlikMm: 2.5,
      kopruYukseklikMm: 20,
      kuyrukGenislikMm: 16,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect-round", x: 1, y: 1, width: 34, height: 18, borderColor: "#1d4ed8", borderWidth: 1.2, borderRadius: 2 },
      { type: "text", x: 2, y: 2, width: 32, height: 3.5, text: "ROYAL DIAMOND SUITE", fontSize: 7, fontWeight: "bold", color: "#1d4ed8" },
      { type: "barcode", x: 2, y: 6, width: 22, height: 6, barcodeValue: "SET-84092", barcodeFormat: "CODE128" },
      { type: "text", x: 25, y: 6, width: 9, height: 3, text: "18K Beyaz", fontSize: 6, color: "#475569" },
      { type: "text", x: 25, y: 9.5, width: 9, height: 3, text: "14.60 gr", fontSize: 6.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 2, y: 13, width: 32, height: 4.5, text: "₺ 165.000", fontSize: 9.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 42, y: 2, width: 26, height: 3.5, text: "Pırlanta: 1.85 CT F-VS", fontSize: 7, fontWeight: "bold", color: "#1d4ed8" },
      { type: "text", x: 42, y: 6.5, width: 26, height: 3.5, text: "GIA Sertifikalı", fontSize: 6.5, color: "#059669" },
    ],
  },
  {
    id: "builtin_16",
    ad: "Özel Atölye İmalat & Tamir Kartı (Amber Tablolu Dikdörtgen)",
    kategori: "Özel / Pırlanta",
    etiketTipi: 1,
    icon: "🔨",
    aciklama: "70×25 mm müşteri adı, hedef gramaj, teslim tarihi ve bakiye takip amber çerçeveli kart",
    config: {
      etiketTipi: 1,
      etiketSekli: "dikdortgen",
      genislikMm: 70,
      yukseklikMm: 25,
      solKanatMm: 35,
      sagKanatMm: 35,
      kopruGenislikMm: 0,
      bogumDerinlikMm: 0,
      kopruYukseklikMm: 25,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 68, height: 23, borderColor: "#d97706", borderWidth: 1.2 },
      { type: "line-vertical", x: 35, y: 1, width: 1, height: 23, borderColor: "#d97706" },
      { type: "text", x: 2, y: 2, width: 31, height: 4, text: "🔨 ATÖLYE İŞ EMRİ", fontSize: 7.5, fontWeight: "bold", color: "#d97706" },
      { type: "barcode", x: 2, y: 7, width: 31, height: 7, barcodeValue: "SPR-2026-94", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 16.5, width: 31, height: 4, text: "Müşteri: Mehmet Yılmaz", fontSize: 6.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 37, y: 2, width: 30, height: 3.5, text: "Özel Tasarım Alyans", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 37, y: 6, width: 30, height: 3, text: "18K • Hedef: 9.50g", fontSize: 6.5, color: "#000" },
      { type: "text", x: 37, y: 9.5, width: 30, height: 3, text: "İç Yazı: 'Ayşe & Mehmet'", fontSize: 6, color: "#be185d" },
      { type: "text", x: 37, y: 13, width: 30, height: 3, text: "Teslim: 28.09.2026", fontSize: 6.5, fontWeight: "bold", color: "#0284c7" },
      { type: "text", x: 37, y: 17.5, width: 30, height: 4, text: "Kalan: ₺ 12.000", fontSize: 7.5, fontWeight: "bold", color: "#059669" },
    ],
  },
  {
    id: "builtin_17",
    ad: "Platin 950 & Pırlanta Lüks Alyans (Platin Gri Çift Çerçeveli Kelebek)",
    kategori: "Özel / Pırlanta",
    etiketTipi: 1,
    icon: "💍",
    aciklama: "60×18 mm saf Platin 950 ve pırlantalı VIP nikah alyansı için antrasit platin gri etiket",
    config: {
      etiketTipi: 1,
      etiketSekli: "kelebek",
      genislikMm: 60,
      yukseklikMm: 18,
      solKanatMm: 26,
      sagKanatMm: 26,
      kopruGenislikMm: 6,
      bogumDerinlikMm: 1.5,
      kopruYukseklikMm: 15,
      kuyrukGenislikMm: 30,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 24, height: 16, borderColor: "#475569", borderWidth: 1 },
      { type: "rect", x: 35, y: 1, width: 24, height: 16, borderColor: "#475569", borderWidth: 1 },
      { type: "text", x: 2, y: 2, width: 22, height: 3.5, text: "PLATINUM 950", fontSize: 7, fontWeight: "bold", color: "#334155" },
      { type: "barcode", x: 2, y: 6, width: 22, height: 6, barcodeValue: "PLT-9501", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 13, width: 22, height: 3.5, text: "$ 1.250 / ₺ 42.500", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 36, y: 2, width: 22, height: 3.5, text: "Platin Çift Alyans", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 36, y: 5.5, width: 22, height: 3, text: "7.40 gr PT950", fontSize: 6.5, color: "#334155" },
      { type: "text", x: 36, y: 9, width: 22, height: 3, text: "Pırlanta: 0.08 CT F-VS", fontSize: 6.5, color: "#0284c7" },
      { type: "text", x: 36, y: 12.5, width: 22, height: 3.5, text: "Ömür Boyu Bakım", fontSize: 6, color: "#059669" },
    ],
  },
  {
    id: "builtin_18",
    ad: "İnci & Mercan Kolye Ucu (Mercan Kırmızısı Elips Dambıl)",
    kategori: "Yüzük / Dambıl",
    etiketTipi: 2,
    icon: "🦪",
    aciklama: "54×16 mm mercan rengi elips çerçeveli, inci milimetre çapı ve kalite sınıfı etiketi",
    config: {
      etiketTipi: 2,
      etiketSekli: "dambil",
      genislikMm: 54,
      yukseklikMm: 16,
      solKanatMm: 22,
      sagKanatMm: 22,
      kopruGenislikMm: 7,
      bogumDerinlikMm: 2.5,
      kopruYukseklikMm: 8,
      kuyrukGenislikMm: 30,
      kuyrukKalinlikMm: 3.5,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "ellipse", x: 1, y: 1, width: 20, height: 14, borderColor: "#ea580c", borderWidth: 1 },
      { type: "ellipse", x: 33, y: 1, width: 20, height: 14, borderColor: "#ea580c", borderWidth: 1 },
      { type: "barcode", x: 2, y: 2, width: 18, height: 5, barcodeValue: "PRL-8490", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 8, width: 18, height: 3.5, text: "9.5 mm Akoya", fontSize: 6.5, fontWeight: "bold", color: "#ea580c" },
      { type: "text", x: 2, y: 11.5, width: 18, height: 3, text: "Grade: AAA", fontSize: 6, color: "#475569" },
      { type: "text", x: 34, y: 2, width: 18, height: 3.5, text: "14K Sarı Montür", fontSize: 6.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 34, y: 6, width: 18, height: 3, text: "Toplam: 3.20 gr", fontSize: 6.5, color: "#000" },
      { type: "text", x: 34, y: 10, width: 18, height: 4, text: "₺ 11.500", fontSize: 8.5, fontWeight: "bold", color: "#000" },
    ],
  },
  {
    id: "builtin_19",
    ad: "Vintage / Antika Elmas Gül Kesim (Sepia & Antik Bronz Kenarlık)",
    kategori: "Özel / Pırlanta",
    etiketTipi: 1,
    icon: "🥀",
    aciklama: "58×18 mm anayar elmas, rosecut ve antika tasarım takılar için sepia bronz çerçeveli etiket",
    config: {
      etiketTipi: 1,
      etiketSekli: "kelebek",
      genislikMm: 58,
      yukseklikMm: 18,
      solKanatMm: 25,
      sagKanatMm: 25,
      kopruGenislikMm: 6,
      bogumDerinlikMm: 1.5,
      kopruYukseklikMm: 15,
      kuyrukGenislikMm: 30,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "rect", x: 1, y: 1, width: 23, height: 16, borderColor: "#78350f", borderWidth: 1.2 },
      { type: "rect", x: 34, y: 1, width: 23, height: 16, borderColor: "#78350f", borderWidth: 1.2 },
      { type: "text", x: 2, y: 2, width: 21, height: 3.5, text: "ANTİKA ELMAS", fontSize: 7, fontWeight: "bold", color: "#78350f" },
      { type: "barcode", x: 2, y: 6, width: 21, height: 6, barcodeValue: "ELM-0842", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 13, width: 21, height: 3.5, text: "₺ 24.800", fontSize: 8.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 35, y: 2, width: 21, height: 3.5, text: "Gül Kesim Elmas", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 35, y: 5.5, width: 21, height: 3, text: "0.40 CT RoseCut", fontSize: 6.5, color: "#78350f" },
      { type: "text", x: 35, y: 9, width: 21, height: 3, text: "8K Altın + Gümüş Montür", fontSize: 6, color: "#475569" },
      { type: "text", x: 35, y: 12.5, width: 21, height: 3.5, text: "El Yapımı Vintage", fontSize: 6, color: "#059669" },
    ],
  },
  {
    id: "builtin_20",
    ad: "Minimal Dar Barkod Şeridi (Kenarlıksız Hızlı Satış)",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "⚡",
    aciklama: "40×12 mm çerçevesiz sade, kompakt hızlı barkod ve net fiyat şeridi",
    config: {
      etiketTipi: 0,
      etiketSekli: "dikdortgen",
      genislikMm: 40,
      yukseklikMm: 12,
      solKanatMm: 20,
      sagKanatMm: 20,
      kopruGenislikMm: 0,
      bogumDerinlikMm: 0,
      kopruYukseklikMm: 12,
      kuyrukGenislikMm: 20,
      kuyrukKalinlikMm: 3,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: false,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "barcode", x: 1, y: 1, width: 21, height: 7, barcodeValue: "849201", barcodeFormat: "CODE128" },
      { type: "text", x: 1, y: 8.5, width: 21, height: 3, text: "14K Tektaş • 1.45g", fontSize: 6, color: "#000" },
      { type: "text", x: 23, y: 1, width: 16, height: 4, text: "₺ 7.450", fontSize: 8.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 23, y: 6, width: 16, height: 3, text: "Ölçü: 12", fontSize: 6.5, fontWeight: "bold", color: "#0284c7" },
    ],
  },
];

interface CanvasState {
  elements: CanvasElement[];
  labelConfig: LabelConfig;
}

type HistoryEntry = CanvasState;

interface EditorState {
  present: CanvasState;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

// ─── Reducer ─────────────────────────────────────────────────────────────────
type EditorAction =
  | { type: "SET_ELEMENTS"; elements: CanvasElement[] }
  | { type: "ADD_ELEMENT"; element: CanvasElement }
  | { type: "UPDATE_ELEMENT"; id: string; changes: Partial<CanvasElement> }
  | { type: "DELETE_ELEMENTS"; ids: string[] }
  | { type: "SET_LABEL_CONFIG"; config: Partial<LabelConfig> }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "PUSH_HISTORY" }
  | { type: "LOAD_STATE"; state: CanvasState };

const defaultLabelConfig: LabelConfig = {
  etiketTipi: 0,
  etiketSekli: "kelebek",
  genislikMm: 65,
  yukseklikMm: 22,
  solKanatMm: 28,
  sagKanatMm: 28,
  kopruGenislikMm: 6,
  bogumDerinlikMm: 2.0,
  kopruYukseklikMm: 18,
  kuyrukGenislikMm: 35,
  kuyrukKalinlikMm: 4,
  delikCapiMm: 0,
  delikKonumu: "yok",
  katlamaCizgisi: true,
  bgColor: "#ffffff",
  bgTexture: "beyaz",
  yaziciUstKaydirmaMm: -0.8,
  yaziciSolKaydirmaMm: 0,
};

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "PUSH_HISTORY": {
      return {
        ...state,
        past: [...state.past.slice(-29), state.present],
        future: [],
      };
    }
    case "ADD_ELEMENT": {
      const newPresent = {
        ...state.present,
        elements: [...state.present.elements, action.element],
      };
      return {
        past: [...state.past.slice(-29), state.present],
        present: newPresent,
        future: [],
      };
    }
    case "UPDATE_ELEMENT": {
      const newPresent = {
        ...state.present,
        elements: state.present.elements.map((el) =>
          el.id === action.id ? { ...el, ...action.changes } : el
        ),
      };
      return { ...state, present: newPresent };
    }
    case "DELETE_ELEMENTS": {
      const newPresent = {
        ...state.present,
        elements: state.present.elements.filter(
          (el) => !action.ids.includes(el.id)
        ),
      };
      return {
        past: [...state.past.slice(-29), state.present],
        present: newPresent,
        future: [],
      };
    }
    case "SET_ELEMENTS": {
      return {
        ...state,
        present: { ...state.present, elements: action.elements },
      };
    }
    case "SET_LABEL_CONFIG": {
      const newPresent = {
        ...state.present,
        labelConfig: { ...state.present.labelConfig, ...action.config },
      };
      return {
        past: [...state.past.slice(-29), state.present],
        present: newPresent,
        future: [],
      };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future.slice(0, 19)],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
    case "LOAD_STATE": {
      return {
        past: [...state.past.slice(-29), state.present],
        present: action.state,
        future: [],
      };
    }
    default:
      return state;
  }
}

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────
function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function mmToPx(mm: number, zoom = 1): number {
  return mm * PX_PER_MM * zoom;
}

function pxToMm(px: number, zoom = 1): number {
  return px / (PX_PER_MM * zoom);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function snapToGrid(val: number, gridMm: number): number {
  if (gridMm <= 0) return val;
  return Math.round(val / gridMm) * gridMm;
}

// ─── Barkod Renderer ─────────────────────────────────────────────────────────
function BarcodeRenderer({
  value,
  format,
  width,
  height,
  barcodeText,
  showText = true,
}: {
  value: string;
  format: string;
  width: number;
  height: number;
  barcodeText?: string;
  showText?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const displayVal = value || "123456789";
  const customText = (barcodeText !== undefined && barcodeText.trim() !== "") ? barcodeText : displayVal;

  useEffect(() => {
    if (svgRef.current && format !== "QR") {
      try {
        JsBarcode(svgRef.current, displayVal, {
          format: format === "EAN13" ? "EAN13" : "CODE128",
          width: 1.2,
          height: Math.max(10, height * 0.55),
          displayValue: showText !== false,
          text: customText,
          fontSize: 8,
          margin: 1,
          textMargin: 1,
        });
        const svg = svgRef.current;
        const wAttr = svg.getAttribute("width") || "100";
        const hAttr = svg.getAttribute("height") || "40";
        svg.setAttribute("viewBox", `0 0 ${wAttr} ${hAttr}`);
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.setAttribute("preserveAspectRatio", "none");
      } catch { }
    }
  }, [displayVal, format, height, customText, showText]);

  if (format === "QR") {
    return <QRRenderer value={displayVal} size={Math.min(width, height)} />;
  }

  return (
    <svg
      ref={svgRef}
      style={{ width: "100%", height: "100%", display: "block", shapeRendering: "crispEdges" }}
    />
  );
}

function QRRenderer({ value, size }: { value: string; size: number }) {
  const [svgHtml, setSvgHtml] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCode.toString(value || "QR", {
      type: "svg",
      margin: 0,
      width: Math.max(16, size),
      errorCorrectionLevel: "M",
    })
      .then((svg) => {
        if (active) setSvgHtml(svg);
      })
      .catch(() => { });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!svgHtml) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "9px",
          color: "#94a3b8",
        }}
      >
        QR
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}

// ─── Vektörel Baskı SVG Üreticileri (Sıfır Kayıp, 300+ DPI Termal Çıktı) ────────
function getBarcodeSvgString(
  value: string,
  format: string,
  widthMm: number,
  heightMm: number,
  showText = true,
  barcodeText?: string
): string {
  try {
    const svgNode = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const displayVal = value || "123456789";
    const customText = (barcodeText !== undefined && barcodeText.trim() !== "") ? barcodeText : displayVal;
    const heightPx = Math.max(12, heightMm * PX_PER_MM * 0.7);
    JsBarcode(svgNode, displayVal, {
      format: format === "EAN13" ? "EAN13" : "CODE128",
      width: 1.5,
      height: heightPx,
      displayValue: showText !== false,
      text: customText,
      fontSize: 9,
      fontOptions: "bold",
      margin: 1,
      textMargin: 1,
    });
    const wAttr = svgNode.getAttribute("width") || "100";
    const hAttr = svgNode.getAttribute("height") || "40";
    svgNode.setAttribute("viewBox", `0 0 ${wAttr} ${hAttr}`);
    svgNode.removeAttribute("width");
    svgNode.removeAttribute("height");
    svgNode.setAttribute("preserveAspectRatio", "none");
    svgNode.setAttribute("style", "width: 100%; height: 100%; display: block; shape-rendering: crispEdges;");
    return svgNode.outerHTML;
  } catch {
    return `<div style="font-size:8px;text-align:center;width:100%;height:100%;">${value || "BARCODE"}</div>`;
  }
}

async function getQrSvgString(value: string): Promise<string> {
  try {
    const svg = await QRCode.toString(value || "QR", {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
    });
    return svg.replace(/<svg\s+/, '<svg style="width:100%;height:100%;display:block;" ');
  } catch {
    return `<div style="font-size:8px;text-align:center;width:100%;height:100%;">QR</div>`;
  }
}

async function buildSingleLabelHtml(
  config: LabelConfig,
  elementsList: CanvasElement[]
): Promise<string> {
  const W = config.genislikMm;
  const H = config.yukseklikMm;
  const isDark = isColorDark(config.bgColor);
  const ustKaydirma = config.yaziciUstKaydirmaMm || 0;
  const solKaydirma = config.yaziciSolKaydirmaMm || 0;

  const elementsHtmlPromises = elementsList
    .filter((el) => el.visible !== false)
    .map(async (el) => {
      const left = el.x + solKaydirma;
      const top = el.y + ustKaydirma;
      const width = el.width;
      const height = el.height;
      const rotation = el.rotation || 0;
      const opacity = el.opacity ?? 1;

      let innerContent = "";

      if (el.type === "text" || el.type === "field") {
        const textContent =
          el.type === "field"
            ? `${el.prefix || ""}${el.text || el.fieldKey || ""}${el.suffix || ""}`
            : el.text || (el.isNumeric ? "0.00" : "");
        const isRight = el.textAlign === "right" || (el.isNumeric && !el.textAlign);
        const isCenter = el.textAlign === "center";
        const alignSelf = isRight ? "flex-end" : isCenter ? "center" : "flex-start";
        const textAlignCss = isRight ? "right" : isCenter ? "center" : "left";
        const fontSizeMm = ((el.fontSize || 8) * 0.352778).toFixed(3);
        const effectiveColor = el.color && el.color !== "transparent" ? el.color : (isDark ? "#ffffff" : "#000000");

        innerContent = `
          <div style="
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: ${alignSelf};
            text-align: ${textAlignCss};
            font-family: '${el.fontFamily || "Arial"}', sans-serif !important;
            font-size: ${fontSizeMm}mm !important;
            font-weight: ${el.fontWeight === "bold" ? "700" : el.fontWeight || "600"};
            font-style: ${el.fontStyle || "normal"};
            text-decoration: ${el.textDecoration || "none"};
            color: ${effectiveColor} !important;
            line-height: 1.15;
            padding: 0 0.4mm;
            white-space: nowrap;
            overflow: hidden;
            background: ${el.backgroundColor && el.backgroundColor !== "transparent" ? el.backgroundColor : "transparent"};
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            -webkit-text-size-adjust: 100% !important;
            text-size-adjust: 100% !important;
          ">
            <span style="width: 100%; text-align: ${textAlignCss}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; line-height: 1.15; -webkit-text-size-adjust: 100% !important; text-size-adjust: 100% !important;">
              ${textContent}
            </span>
          </div>
        `;
      } else if (el.type === "barcode") {
        const barcodeVal = el.barcodeValue || el.text || "123456789";
        const customText = el.barcodeText;
        const showTxt = el.showText !== false;
        const svgStr = getBarcodeSvgString(barcodeVal, el.barcodeFormat || "CODE128", el.width, el.height, showTxt, customText);
        innerContent = `<div style="width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">${svgStr}</div>`;
      } else if (el.type === "qr" || el.type === "rfid") {
        const qrVal = el.barcodeValue || el.text || (el.type === "qr" ? "QR" : "RFID");
        const svgStr = await getQrSvgString(qrVal);
        innerContent = `<div style="width:100%;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">${svgStr}</div>`;
      } else if (el.type === "icon") {
        const iconSizeMm = height * 0.75;
        innerContent = `
          <div style="
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${iconSizeMm.toFixed(2)}mm;
            line-height: 1;
            color: ${el.color || "#000000"};
            font-family: 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Segoe UI Symbol',sans-serif;
          ">
            ${el.iconEmoji || "⭐"}
          </div>
        `;
      } else if (el.type === "rect" || el.type === "rect-round") {
        const borderMm = Math.max(0.35, (el.borderWidth || 1) * 0.352778);
        const radiusMm = el.type === "rect-round" ? 1.5 : (el.borderRadius || 0) * 0.352778;
        innerContent = `
          <div style="
            width: 100%;
            height: 100%;
            background: ${el.backgroundColor || "transparent"};
            border: ${borderMm.toFixed(3)}mm solid ${el.borderColor || "#000000"};
            border-radius: ${radiusMm.toFixed(3)}mm;
            box-sizing: border-box;
          "></div>
        `;
      } else if (el.type === "ellipse") {
        const borderMm = Math.max(0.35, (el.borderWidth || 1) * 0.352778);
        innerContent = `
          <div style="
            width: 100%;
            height: 100%;
            background: ${el.backgroundColor || "transparent"};
            border: ${borderMm.toFixed(3)}mm solid ${el.borderColor || "#000000"};
            border-radius: 50%;
            box-sizing: border-box;
          "></div>
        `;
      } else if (el.type === "diamond") {
        innerContent = `
          <svg viewBox="0 0 40 40" style="width:100%;height:100%;display:block;">
            <polygon
              points="20,2 38,20 20,38 2,20"
              fill="${el.backgroundColor || "transparent"}"
              stroke="${el.borderColor || "#000000"}"
              stroke-width="${Math.max(1.5, el.borderWidth || 1)}"
            />
          </svg>
        `;
      } else if (el.type === "line-vertical") {
        const lineThickMm = Math.max(0.35, (el.borderWidth || 1) * 0.352778);
        innerContent = `
          <div style="
            width: 0;
            height: 100%;
            border-left: ${lineThickMm.toFixed(3)}mm solid ${el.borderColor || "#000000"};
            position: absolute;
            left: 50%;
            top: 0;
          "></div>
        `;
      } else if (el.type === "line" || el.type === "line-dashed" || el.type === "line-dotted" || el.type === "line-double") {
        const lineThickMm = Math.max(0.35, (el.borderWidth || 1) * 0.352778);
        const borderStyle = el.type === "line-dashed" ? "dashed" : el.type === "line-dotted" ? "dotted" : el.type === "line-double" ? "double" : "solid";
        innerContent = `
          <div style="
            width: 100%;
            height: 0;
            border-top: ${lineThickMm.toFixed(3)}mm ${borderStyle} ${el.borderColor || "#000000"};
            position: absolute;
            top: 50%;
            left: 0;
          "></div>
        `;
      } else if (el.type === "image" || el.type === "logo") {
        if (el.imageData) {
          innerContent = `
            <img
              src="${el.imageData}"
              style="width:100%;height:100%;object-fit:contain;display:block;"
            />
          `;
        }
      }

      return `
        <div style="
          position: absolute;
          left: ${left}mm;
          top: ${top}mm;
          width: ${width}mm;
          height: ${height}mm;
          transform: rotate(${rotation}deg);
          transform-origin: center center;
          opacity: ${opacity};
          box-sizing: border-box;
          z-index: ${el.zIndex || 1};
          overflow: hidden;
        ">
          ${innerContent}
        </div>
      `;
    });

  const elementsHtmlArray = await Promise.all(elementsHtmlPromises);
  const elementsHtml = elementsHtmlArray.join("\n");

  return `
    <div class="print-label-cell" style="
      position: absolute;
      top: 0;
      left: 0;
      width: ${W}mm;
      height: ${H}mm;
      background: ${config.bgColor || "#ffffff"};
      overflow: hidden;
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      page-break-inside: avoid;
      break-inside: avoid;
    ">
      ${elementsHtml}
    </div>
  `;
}

function isColorDark(color?: string): boolean {
  if (!color || color === "transparent") return false;
  const c = color.trim().toLowerCase();
  if (c === "#000" || c === "#000000" || c === "#18181b" || c === "#0f172a" || c === "#111827") return true;
  if (c.startsWith("#") && c.length === 7) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  }
  return false;
}

// ─── Gerçekçi Etiket Şekli SVG (Birebir Siluet, Katlama & Görsel Izgara Çizgileri) ─
function LabelShapeSVG({
  config,
  zoom,
  snapGrid,
  isPreview = false,
}: {
  config: LabelConfig;
  zoom: number;
  snapGrid: number;
  isPreview?: boolean;
}) {
  const W = mmToPx(config.genislikMm, zoom);
  const H = mmToPx(config.yukseklikMm, zoom);
  // Köşe yarıçapı: kullanıcı "Köşe Yuvarlaklığı" ile ayarlayabilir (varsayılan 3mm).
  // Etiket çok küçültüldüğünde (ör. yükseklik 10mm altı) yarıçap gövdenin yarısını
  // aşıp şeklin kendi içine girmesine yol açmasın diye sınırlanır.
  const cornerMm = config.koseYuvarlikligiMm !== undefined ? config.koseYuvarlikligiMm : 3;
  const r = Math.max(0, Math.min(mmToPx(cornerMm, zoom), H / 2 - 0.5, W / 6));

  const isDark = isColorDark(config.bgColor);
  const shapeFill = config.bgColor || "#ffffff";
  const strokeColor = isPreview ? "#cbd5e1" : "#94a3b8";
  const foldLineColor = isDark ? "rgba(255, 255, 255, 0.4)" : "#94a3b8";

  // Görsel Izgara Deseni Tanımı (Önizleme modunda ızgara gizlenir)
  const gridPatternSize = !isPreview && snapGrid > 0 ? mmToPx(snapGrid, zoom) : 0;
  const patId = `grid_pat_${config.etiketSekli}_${Math.round(snapGrid * 10)}_${Math.round(zoom * 100)}`;

  // 1. KELEBEK ŞEKLİ (Gerçekçi Kuyumcu Etiket Rulosu Boğumu)
  if (config.etiketSekli === "kelebek") {
    const solW = Math.min(mmToPx(config.solKanatMm || config.genislikMm / 2, zoom), W - 2);
    const sagW = Math.max(2, W - solW);
    const rawNeckW = mmToPx(config.kopruGenislikMm !== undefined ? config.kopruGenislikMm : 6, zoom);
    // Köprü/boğum genişliği kanatlardan taşıp kavis kendi üstüne binmesin diye kanatlarla sınırlanır
    const neckW = Math.max(2, Math.min(rawNeckW, solW * 1.4, sagW * 1.4));
    // Boğum / Çentik derinliği: Standart etiket rulolarında üstten ve alttan 1.5 - 3mm kavisli çentiktir
    const indentMm = config.bogumDerinlikMm !== undefined ? config.bogumDerinlikMm : 2.0;
    const indent = Math.max(0, Math.min(mmToPx(indentMm, zoom), H / 2 - 1));
    const midX = solW;
    const neckTop = indent;
    const neckBot = H - indent;

    const path = indent <= 0 ? `
      M ${r} 0
      L ${W - r} 0
      Q ${W} 0 ${W} ${r}
      L ${W} ${H - r}
      Q ${W} ${H} ${W - r} ${H}
      L ${r} ${H}
      Q 0 ${H} 0 ${H - r}
      L 0 ${r}
      Q 0 0 ${r} 0 Z
    ` : `
      M ${r} 0
      L ${midX - neckW / 2} 0
      C ${midX - neckW / 4} 0, ${midX - neckW / 4} ${neckTop}, ${midX} ${neckTop}
      C ${midX + neckW / 4} ${neckTop}, ${midX + neckW / 4} 0, ${midX + neckW / 2} 0
      L ${W - r} 0
      Q ${W} 0 ${W} ${r}
      L ${W} ${H - r}
      Q ${W} ${H} ${W - r} ${H}
      L ${midX + neckW / 2} ${H}
      C ${midX + neckW / 4} ${H}, ${midX + neckW / 4} ${neckBot}, ${midX} ${neckBot}
      C ${midX - neckW / 4} ${neckBot}, ${midX - neckW / 4} ${H}, ${midX - neckW / 2} ${H}
      L ${r} ${H}
      Q 0 ${H} 0 ${H - r}
      L 0 ${r}
      Q 0 0 ${r} 0 Z
    `;

    return (
      <svg
        style={{ position: "absolute", inset: 0, width: W, height: H, pointerEvents: "none", overflow: "visible" }}
        width={W}
        height={H}
      >
        <defs>
          <clipPath id="kelebekClip">
            <path d={path} />
          </clipPath>
          {gridPatternSize > 0 && (
            <pattern id={patId} width={gridPatternSize} height={gridPatternSize} patternUnits="userSpaceOnUse">
              <path d={`M ${gridPatternSize} 0 L 0 0 L 0 ${gridPatternSize}`} fill="none" stroke="#0284c7" strokeWidth={0.8} opacity={0.45} />
            </pattern>
          )}
        </defs>
        <path d={path} fill={shapeFill} stroke={strokeColor} strokeWidth={1.2} />
        {gridPatternSize > 0 && (
          <rect x={0} y={0} width={W} height={H} fill={`url(#${patId})`} clipPath="url(#kelebekClip)" />
        )}
        {config.katlamaCizgisi && (
          <line
            x1={midX}
            y1={Math.max(0, neckTop - 2)}
            x2={midX}
            y2={Math.min(H, neckBot + 2)}
            stroke={foldLineColor}
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
      </svg>
    );
  }

  // 2. DAMBIL ŞEKLİ (Yüzük & Alyans İki Oval Başlıklı)
  if (config.etiketSekli === "dambil") {
    const solW = Math.min(mmToPx(config.solKanatMm || config.genislikMm / 2, zoom), W - 2);
    const sagW = Math.max(2, W - solW);
    const midX = solW;
    // Baş dairesinin yarıçapı, dar kanatlarda iki başlık birbirine binmesin diye kanat genişlikleriyle de sınırlanır
    const headR = Math.max(1, Math.min(H / 2, solW, sagW));
    const indentMm = config.bogumDerinlikMm !== undefined ? config.bogumDerinlikMm : 3.0;
    const indent = Math.max(0, Math.min(mmToPx(indentMm, zoom), H / 2 - 1));
    const rawNeckW = mmToPx(config.kopruGenislikMm !== undefined ? config.kopruGenislikMm : 8, zoom);
    const neckW = Math.max(2, Math.min(rawNeckW, solW * 1.4, sagW * 1.4));
    const neckTop = indent;
    const neckBot = H - indent;

    const path = `
      M ${headR} 0
      L ${midX - neckW / 2} 0
      C ${midX - neckW / 4} 0, ${midX - neckW / 4} ${neckTop}, ${midX} ${neckTop}
      C ${midX + neckW / 4} ${neckTop}, ${midX + neckW / 4} 0, ${midX + neckW / 2} 0
      L ${W - headR} 0
      A ${headR} ${headR} 0 0 1 ${W} ${headR}
      A ${headR} ${headR} 0 0 1 ${W - headR} ${H}
      L ${midX + neckW / 2} ${H}
      C ${midX + neckW / 4} ${H}, ${midX + neckW / 4} ${neckBot}, ${midX} ${neckBot}
      C ${midX - neckW / 4} ${neckBot}, ${midX - neckW / 4} ${H}, ${midX - neckW / 2} ${H}
      L ${headR} ${H}
      A ${headR} ${headR} 0 0 1 0 ${headR}
      A ${headR} ${headR} 0 0 1 ${headR} 0 Z
    `;

    return (
      <svg
        style={{ position: "absolute", inset: 0, width: W, height: H, pointerEvents: "none", overflow: "visible" }}
        width={W}
        height={H}
      >
        <defs>
          <clipPath id="dambilClip">
            <path d={path} />
          </clipPath>
          {gridPatternSize > 0 && (
            <pattern id={patId} width={gridPatternSize} height={gridPatternSize} patternUnits="userSpaceOnUse">
              <path d={`M ${gridPatternSize} 0 L 0 0 L 0 ${gridPatternSize}`} fill="none" stroke="#0284c7" strokeWidth={0.8} opacity={0.45} />
            </pattern>
          )}
        </defs>
        <path d={path} fill={shapeFill} stroke={strokeColor} strokeWidth={1.2} />
        {gridPatternSize > 0 && (
          <rect x={0} y={0} width={W} height={H} fill={`url(#${patId})`} clipPath="url(#dambilClip)" />
        )}
        {config.katlamaCizgisi && (
          <line
            x1={midX}
            y1={neckTop - 1}
            x2={midX}
            y2={neckBot + 1}
            stroke={foldLineColor}
            strokeWidth={1}
            strokeDasharray="2,2"
          />
        )}
      </svg>
    );
  }

  // 3. KUYRUKLU ETİKET
  if (config.etiketSekli === "kuyruklu") {
    // Gövde her zaman en az 8mm kalsın diye kuyruk uzunluğu buna göre sınırlanır;
    // böylece gövde ve kuyruk oranı, etiket ne kadar küçültülürse küçültülsün W ile tutarlı kalır.
    const minBodyW = Math.min(mmToPx(8, zoom), W * 0.5);
    const tailLen = Math.max(0, Math.min(mmToPx(config.kuyrukGenislikMm || 35, zoom), W - minBodyW));
    const bodyW = W - tailLen;
    const tailH = Math.max(1, Math.min(mmToPx(config.kuyrukKalinlikMm || 4, zoom), H * 0.9));
    const tailTop = (H - tailH) / 2;
    const tailBot = (H + tailH) / 2;
    const tailR = Math.min(tailH / 2, tailLen / 2);

    const path = `
      M ${r} 0
      L ${bodyW - r} 0
      Q ${bodyW} 0 ${bodyW} ${r}
      L ${bodyW} ${tailTop}
      L ${W - tailR} ${tailTop}
      A ${tailR} ${tailR} 0 0 1 ${W} ${tailTop + tailR}
      A ${tailR} ${tailR} 0 0 1 ${W - tailR} ${tailBot}
      L ${bodyW} ${tailBot}
      L ${bodyW} ${H - r}
      Q ${bodyW} ${H} ${bodyW - r} ${H}
      L ${r} ${H}
      Q 0 ${H} 0 ${H - r}
      L 0 ${r}
      Q 0 0 ${r} 0 Z
    `;

    return (
      <svg
        style={{ position: "absolute", inset: 0, width: W, height: H, pointerEvents: "none", overflow: "visible" }}
        width={W}
        height={H}
      >
        <defs>
          <clipPath id="kuyrukluClip">
            <path d={path} />
          </clipPath>
          {gridPatternSize > 0 && (
            <pattern id={patId} width={gridPatternSize} height={gridPatternSize} patternUnits="userSpaceOnUse">
              <path d={`M ${gridPatternSize} 0 L 0 0 L 0 ${gridPatternSize}`} fill="none" stroke="#0284c7" strokeWidth={0.8} opacity={0.45} />
            </pattern>
          )}
        </defs>
        <path d={path} fill={shapeFill} stroke={strokeColor} strokeWidth={1.2} />
        {gridPatternSize > 0 && (
          <rect x={0} y={0} width={W} height={H} fill={`url(#${patId})`} clipPath="url(#kuyrukluClip)" />
        )}
        {config.katlamaCizgisi && (
          <>
            <line
              x1={bodyW / 2}
              y1={2}
              x2={bodyW / 2}
              y2={H - 2}
              stroke={foldLineColor}
              strokeWidth={0.8}
              strokeDasharray="2,2"
            />
            <line
              x1={bodyW}
              y1={tailTop}
              x2={bodyW}
              y2={tailBot}
              stroke={foldLineColor}
              strokeWidth={0.8}
              strokeDasharray="1.5,1.5"
            />
          </>
        )}
      </svg>
    );
  }

  // 3B. BOĞUMLU KUYRUK ŞEKLİ (Ortası boğumlu iki kanat + sağdan çıkan kuyruk şeridi)
  // "bogumlukuyrukkeskin" de aynı geometriyi kullanır; farkı sadece varsayılan Köşe
  // Yuvarlaklığı değeridir (0mm = keskin köşe) — kullanıcı ikisinde de köşe yuvarlaklığını
  // (ve boğum/kuyruk ölçülerini) istediği gibi değiştirebilir.
  if (config.etiketSekli === "bogumlukuyruk" || config.etiketSekli === "bogumlukuyrukkeskin") {
    const rawSolW = mmToPx(Math.max(1, config.solKanatMm || config.genislikMm / 3), zoom);
    const rawSagW = mmToPx(Math.max(1, config.sagKanatMm || config.genislikMm / 3), zoom);
    const rawTailLen = mmToPx(Math.max(0, config.kuyrukGenislikMm ?? 15), zoom);
    const rawTotal = rawSolW + rawSagW + rawTailLen;
    // Girilen sol + sağ + kuyruk toplamı artık genişliği asla aşamayacağı için (giriş tarafında
    // sınırlanıyor), burada sadece eski/aşırı kayıtlı verilere karşı savunma amaçlı KÜÇÜLTÜLÜR;
    // toplam W'den küçükse değerler olduğu gibi (gerdirilmeden) çizilir, kalan boşluk kuyruğun
    // ucunda boş alan olarak kalır.
    const fitScale = rawTotal > W && rawTotal > 0 ? W / rawTotal : 1;
    const solW = rawSolW * fitScale;
    const sagW = rawSagW * fitScale;
    const tailLen = rawTailLen * fitScale;
    const bodyW = solW + sagW;
    const midX = solW;

    const rawNeckW = mmToPx(config.kopruGenislikMm !== undefined ? config.kopruGenislikMm : 8, zoom);
    const neckW = Math.max(2, Math.min(rawNeckW, solW * 1.4, sagW * 1.4));
    const indentMm = config.bogumDerinlikMm !== undefined ? config.bogumDerinlikMm : 2.0;
    const indent = Math.max(0, Math.min(mmToPx(indentMm, zoom), H / 2 - 1));
    const neckTop = indent;
    const neckBot = H - indent;

    const tailH = Math.max(1, Math.min(mmToPx(config.kuyrukKalinlikMm || 4, zoom), H * 0.9));
    const tailTop = (H - tailH) / 2;
    const tailBot = (H + tailH) / 2;
    const tailR = Math.min(tailH / 2, tailLen / 2);

    const path = `
      M ${r} 0
      L ${midX - neckW / 2} 0
      C ${midX - neckW / 4} 0, ${midX - neckW / 4} ${neckTop}, ${midX} ${neckTop}
      C ${midX + neckW / 4} ${neckTop}, ${midX + neckW / 4} 0, ${midX + neckW / 2} 0
      L ${bodyW - r} 0
      Q ${bodyW} 0 ${bodyW} ${r}
      L ${bodyW} ${tailTop}
      L ${W - tailR} ${tailTop}
      A ${tailR} ${tailR} 0 0 1 ${W} ${tailTop + tailR}
      A ${tailR} ${tailR} 0 0 1 ${W - tailR} ${tailBot}
      L ${bodyW} ${tailBot}
      L ${bodyW} ${H - r}
      Q ${bodyW} ${H} ${bodyW - r} ${H}
      L ${midX + neckW / 2} ${H}
      C ${midX + neckW / 4} ${H}, ${midX + neckW / 4} ${neckBot}, ${midX} ${neckBot}
      C ${midX - neckW / 4} ${neckBot}, ${midX - neckW / 4} ${H}, ${midX - neckW / 2} ${H}
      L ${r} ${H}
      Q 0 ${H} 0 ${H - r}
      L 0 ${r}
      Q 0 0 ${r} 0 Z
    `;

    return (
      <svg
        style={{ position: "absolute", inset: 0, width: W, height: H, pointerEvents: "none", overflow: "visible" }}
        width={W}
        height={H}
      >
        <defs>
          <clipPath id="bogumluKuyrukClip">
            <path d={path} />
          </clipPath>
          {gridPatternSize > 0 && (
            <pattern id={patId} width={gridPatternSize} height={gridPatternSize} patternUnits="userSpaceOnUse">
              <path d={`M ${gridPatternSize} 0 L 0 0 L 0 ${gridPatternSize}`} fill="none" stroke="#0284c7" strokeWidth={0.8} opacity={0.45} />
            </pattern>
          )}
        </defs>
        <path d={path} fill={shapeFill} stroke={strokeColor} strokeWidth={1.2} />
        {gridPatternSize > 0 && (
          <rect x={0} y={0} width={W} height={H} fill={`url(#${patId})`} clipPath="url(#bogumluKuyrukClip)" />
        )}
        {config.katlamaCizgisi && (
          <>
            <line
              x1={midX}
              y1={Math.max(0, neckTop - 2)}
              x2={midX}
              y2={Math.min(H, neckBot + 2)}
              stroke={foldLineColor}
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            <line
              x1={bodyW}
              y1={tailTop}
              x2={bodyW}
              y2={tailBot}
              stroke={foldLineColor}
              strokeWidth={0.8}
              strokeDasharray="1.5,1.5"
            />
          </>
        )}
      </svg>
    );
  }

  // 4. RFID KABLOSUZ ETİKET
  if (config.etiketSekli === "rfid") {
    return (
      <svg
        style={{ position: "absolute", inset: 0, width: W, height: H, pointerEvents: "none" }}
        width={W}
        height={H}
      >
        <defs>
          {gridPatternSize > 0 && (
            <pattern id={patId} width={gridPatternSize} height={gridPatternSize} patternUnits="userSpaceOnUse">
              <path d={`M ${gridPatternSize} 0 L 0 0 L 0 ${gridPatternSize}`} fill="none" stroke="#0284c7" strokeWidth={0.8} opacity={0.45} />
            </pattern>
          )}
        </defs>
        <rect
          x={1}
          y={1}
          width={W - 2}
          height={H - 2}
          rx={6}
          fill={shapeFill}
          stroke={strokeColor}
          strokeWidth={1.2}
        />
        {gridPatternSize > 0 && (
          <rect x={2} y={2} width={W - 4} height={H - 4} rx={5} fill={`url(#${patId})`} />
        )}
        <rect
          x={5}
          y={5}
          width={W - 10}
          height={H - 10}
          rx={4}
          fill="none"
          stroke="#10b981"
          strokeWidth={0.6}
          strokeDasharray="4,2"
          opacity={0.4}
        />
        <circle cx={W - 12} cy={12} r={3} fill="#10b981" opacity={0.35} />
      </svg>
    );
  }

  // 5. DİKDÖRTGEN (Standart) — Boğum ve/veya Kuyruk eklenmemişse basit yuvarlak köşeli dikdörtgen
  const hasBogum = !!config.bogumEkle;
  const hasKuyruk = !!config.kuyrukEkle;

  if (!hasBogum && !hasKuyruk) {
    return (
      <svg
        style={{ position: "absolute", inset: 0, width: W, height: H, pointerEvents: "none" }}
        width={W}
        height={H}
      >
        <defs>
          {gridPatternSize > 0 && (
            <pattern id={patId} width={gridPatternSize} height={gridPatternSize} patternUnits="userSpaceOnUse">
              <path d={`M ${gridPatternSize} 0 L 0 0 L 0 ${gridPatternSize}`} fill="none" stroke="#0284c7" strokeWidth={0.8} opacity={0.45} />
            </pattern>
          )}
        </defs>
        <rect
          x={1}
          y={1}
          width={W - 2}
          height={H - 2}
          rx={r}
          fill={shapeFill}
          stroke={strokeColor}
          strokeWidth={1.2}
        />
        {gridPatternSize > 0 && (
          <rect x={2} y={2} width={W - 4} height={H - 4} rx={r} fill={`url(#${patId})`} />
        )}
        {config.katlamaCizgisi && (
          <line
            x1={W / 2}
            y1={2}
            x2={W / 2}
            y2={H - 2}
            stroke={foldLineColor}
            strokeWidth={0.8}
            strokeDasharray="2,2"
          />
        )}
      </svg>
    );
  }

  // 5B. DİKDÖRTGEN + Özel Boğum ve/veya Özel Kuyruk (kullanıcı tarafından açılıp kapatılabilir)
  {
    const minBodyW = hasKuyruk ? Math.min(mmToPx(8, zoom), W * 0.5) : 0;
    const tailLen = hasKuyruk ? Math.max(0, Math.min(mmToPx(config.kuyrukGenislikMm || 35, zoom), W - minBodyW)) : 0;
    const bodyW = W - tailLen;
    const tailH = hasKuyruk ? Math.max(1, Math.min(mmToPx(config.kuyrukKalinlikMm || 4, zoom), H * 0.9)) : 0;
    const tailTop = (H - tailH) / 2;
    const tailBot = (H + tailH) / 2;
    const tailR = hasKuyruk ? Math.min(tailH / 2, tailLen / 2) : 0;

    // Köşe yarıçapı, kuyruğun gövdeyle birleştiği noktadan taşıp geometriyi bozmasın diye
    // (kuyruk varsa) o noktanın düşey mesafesiyle de sınırlanır.
    const rr = Math.max(0, Math.min(r, hasKuyruk ? tailTop : r, bodyW / 6));

    const rawMidX = config.solKanatMm ? mmToPx(config.solKanatMm, zoom) : bodyW / 2;
    const midX = hasBogum ? Math.max(4, Math.min(rawMidX, bodyW - 4)) : bodyW / 2;
    const rawNeckW = mmToPx(config.kopruGenislikMm !== undefined ? config.kopruGenislikMm : 8, zoom);
    const neckW = hasBogum ? Math.max(2, Math.min(rawNeckW, midX * 1.4, (bodyW - midX) * 1.4)) : 0;
    const indentMm = config.bogumDerinlikMm !== undefined ? config.bogumDerinlikMm : 2.0;
    const indent = hasBogum ? Math.max(0, Math.min(mmToPx(indentMm, zoom), H / 2 - 1)) : 0;
    const neckTop = indent;
    const neckBot = H - indent;

    const topBogumPart = hasBogum
      ? `
      L ${midX - neckW / 2} 0
      C ${midX - neckW / 4} 0, ${midX - neckW / 4} ${neckTop}, ${midX} ${neckTop}
      C ${midX + neckW / 4} ${neckTop}, ${midX + neckW / 4} 0, ${midX + neckW / 2} 0`
      : "";
    const botBogumPart = hasBogum
      ? `
      L ${midX + neckW / 2} ${H}
      C ${midX + neckW / 4} ${H}, ${midX + neckW / 4} ${neckBot}, ${midX} ${neckBot}
      C ${midX - neckW / 4} ${neckBot}, ${midX - neckW / 4} ${H}, ${midX - neckW / 2} ${H}`
      : "";
    const tailPart = hasKuyruk
      ? `
      L ${bodyW} ${tailTop}
      L ${W - tailR} ${tailTop}
      A ${tailR} ${tailR} 0 0 1 ${W} ${tailTop + tailR}
      A ${tailR} ${tailR} 0 0 1 ${W - tailR} ${tailBot}
      L ${bodyW} ${tailBot}`
      : "";

    const path = `
      M ${rr} 0${topBogumPart}
      L ${bodyW - rr} 0
      Q ${bodyW} 0 ${bodyW} ${rr}${tailPart}
      L ${bodyW} ${H - rr}
      Q ${bodyW} ${H} ${bodyW - rr} ${H}${botBogumPart}
      L ${rr} ${H}
      Q 0 ${H} 0 ${H - rr}
      L 0 ${rr}
      Q 0 0 ${rr} 0 Z
    `;

    return (
      <svg
        style={{ position: "absolute", inset: 0, width: W, height: H, pointerEvents: "none", overflow: "visible" }}
        width={W}
        height={H}
      >
        <defs>
          <clipPath id="dikdortgenOzelClip">
            <path d={path} />
          </clipPath>
          {gridPatternSize > 0 && (
            <pattern id={patId} width={gridPatternSize} height={gridPatternSize} patternUnits="userSpaceOnUse">
              <path d={`M ${gridPatternSize} 0 L 0 0 L 0 ${gridPatternSize}`} fill="none" stroke="#0284c7" strokeWidth={0.8} opacity={0.45} />
            </pattern>
          )}
        </defs>
        <path d={path} fill={shapeFill} stroke={strokeColor} strokeWidth={1.2} />
        {gridPatternSize > 0 && (
          <rect x={0} y={0} width={W} height={H} fill={`url(#${patId})`} clipPath="url(#dikdortgenOzelClip)" />
        )}
        {config.katlamaCizgisi && (
          <>
            {hasBogum && (
              <line
                x1={midX}
                y1={Math.max(0, neckTop - 2)}
                x2={midX}
                y2={Math.min(H, neckBot + 2)}
                stroke={foldLineColor}
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            )}
            {hasKuyruk && (
              <line
                x1={bodyW}
                y1={tailTop}
                x2={bodyW}
                y2={tailBot}
                stroke={foldLineColor}
                strokeWidth={0.8}
                strokeDasharray="1.5,1.5"
              />
            )}
            {!hasBogum && (
              <line
                x1={bodyW / 2}
                y1={2}
                x2={bodyW / 2}
                y2={H - 2}
                stroke={foldLineColor}
                strokeWidth={0.8}
                strokeDasharray="2,2"
              />
            )}
          </>
        )}
      </svg>
    );
  }
}

// ─── Statik Çoklu Tabaka / Rulo Etiket Hücresi (Önizleme & Baskı İçin) ────────
const StaticLabelCell: React.FC<{
  config: LabelConfig;
  elements: CanvasElement[];
  zoom: number;
}> = ({ config, elements, zoom }) => {
  const W = mmToPx(config.genislikMm, zoom);
  const H = mmToPx(config.yukseklikMm, zoom);
  const sorted = [...elements].filter((e) => e.visible).sort((a, b) => a.zIndex - b.zIndex);
  const isDark = isColorDark(config.bgColor);

  return (
    <div
      className="static-label-cell"
      style={{
        width: W,
        height: H,
        position: "relative",
        boxSizing: "border-box",
        flexShrink: 0,
        backgroundColor: config.bgColor || "#ffffff",
        borderRadius: config.etiketSekli === "dambil" ? 6 * zoom : 2,
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        overflow: "visible",
      }}
    >
      <LabelShapeSVG config={config} zoom={zoom} snapGrid={0} isPreview={true} />
      {sorted.map((el) => {
        const isRight = el.textAlign === "right" || el.isNumeric;
        const isCenter = el.textAlign === "center";
        const effectiveTextColor =
          isDark && (!el.color || el.color === "#000000" || el.color === "#000" || el.color.toLowerCase() === "#111827")
            ? "#f8fafc"
            : el.color || "#000000";

        const elStyle: React.CSSProperties = {
          position: "absolute",
          left: mmToPx(el.x, zoom),
          top: mmToPx(el.y, zoom),
          width: mmToPx(el.width, zoom),
          height: mmToPx(el.height, zoom),
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          opacity: el.opacity,
          zIndex: el.zIndex,
          boxSizing: "border-box",
          pointerEvents: "none",
        };

        return (
          <div key={el.id} className="canvas-element" style={elStyle}>
            {(el.type === "text" || el.type === "field") && (
              <div
                style={{
                  fontFamily: el.fontFamily || "Arial",
                  fontSize: `${mmToPx((el.fontSize || 8) * 0.352778, zoom)}px`,
                  fontWeight: el.fontWeight || "normal",
                  fontStyle: el.fontStyle || "normal",
                  textDecoration: el.textDecoration || "none",
                  textAlign: isRight ? "right" : isCenter ? "center" : "left",
                  color: effectiveTextColor,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isRight ? "flex-end" : isCenter ? "center" : "flex-start",
                  padding: "0 2px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  userSelect: "none",
                  background: el.backgroundColor && el.backgroundColor !== "transparent" ? el.backgroundColor : undefined,
                }}
              >
                <span
                  style={{
                    width: "100%",
                    textAlign: isRight ? "right" : isCenter ? "center" : "left",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "block",
                  }}
                >
                  {el.type === "field"
                    ? `${el.prefix || ""}${el.text || el.fieldKey || "Alan"}${el.suffix || ""}`
                    : el.text || (el.isNumeric ? "0.00" : "Metin")}
                </span>
              </div>
            )}

            {el.type === "barcode" && (
              <BarcodeRenderer
                value={el.barcodeValue || el.text || "123456789"}
                format={el.barcodeFormat || "CODE128"}
                width={mmToPx(el.width, zoom)}
                height={mmToPx(el.height, zoom)}
                barcodeText={el.barcodeText}
                showText={el.showText !== false}
              />
            )}

            {el.type === "qr" && (
              <QRRenderer
                value={el.barcodeValue || el.text || "QR"}
                size={Math.min(mmToPx(el.width, zoom), mmToPx(el.height, zoom))}
              />
            )}

            {el.type === "icon" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%",
                  height: "100%",
                  fontSize: `${mmToPx(el.height * 0.75, zoom)}px`,
                  lineHeight: 1,
                  color: el.color || "#000",
                  fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Segoe UI Symbol',sans-serif",
                  WebkitPrintColorAdjust: "exact",
                  printColorAdjust: "exact",
                } as React.CSSProperties}
              >
                {el.iconEmoji || "⭐"}
              </div>
            )}

            {(el.type === "rect" || el.type === "rect-round") && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: el.backgroundColor || "transparent",
                  border: `${(el.borderWidth || 1) * zoom * 0.8}px solid ${el.borderColor || "#000000"}`,
                  borderRadius: el.type === "rect-round" ? 4 * zoom : (el.borderRadius || 0) * zoom,
                }}
              />
            )}

            {el.type === "ellipse" && (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: el.backgroundColor || "transparent",
                  border: `${(el.borderWidth || 1) * zoom * 0.8}px solid ${el.borderColor || "#000000"}`,
                  borderRadius: "50%",
                }}
              />
            )}

            {el.type === "diamond" && (
              <svg viewBox="0 0 40 40" style={{ width: "100%", height: "100%" }}>
                <polygon
                  points="20,2 38,20 20,38 2,20"
                  fill={el.backgroundColor || "transparent"}
                  stroke={el.borderColor || "#000000"}
                  strokeWidth={el.borderWidth || 1}
                />
              </svg>
            )}

            {el.type === "line" && (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
                <div style={{ width: "100%", height: `${Math.max(1, (el.borderWidth || 1) * zoom * 0.8)}px`, background: el.borderColor || "#000000" }} />
              </div>
            )}

            {el.type === "line-dashed" && (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
                <div style={{ width: "100%", borderTop: `${Math.max(1, (el.borderWidth || 1) * zoom * 0.8)}px dashed ${el.borderColor || "#000000"}` }} />
              </div>
            )}

            {el.type === "line-dotted" && (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
                <div style={{ width: "100%", borderTop: `${Math.max(1, (el.borderWidth || 1) * zoom * 0.8)}px dotted ${el.borderColor || "#000000"}` }} />
              </div>
            )}

            {el.type === "line-double" && (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
                <div style={{ width: "100%", borderTop: `${Math.max(2, 2.5 * zoom)}px double ${el.borderColor || "#000000"}` }} />
              </div>
            )}

            {el.type === "line-vertical" && (
              <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center" }}>
                <div style={{ height: "100%", width: `${Math.max(1, (el.borderWidth || 1) * zoom * 0.8)}px`, background: el.borderColor || "#000000" }} />
              </div>
            )}

            {(el.type === "image" || el.type === "logo") && el.imageData && (
              <img
                src={el.imageData}
                alt="Logo/Görsel"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                  pointerEvents: "none",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Kayıtlı Şablon Kartı Görsel Küçük Resim (Thumbnail) ───────────────────
const SablonThumbnail: React.FC<{ sablon: EtiketSablonItem }> = ({ sablon }) => {
  const bg = sablon.arkaPlanRengi
    ? (sablon.arkaPlanRengi === "beyaz" ? "#ffffff" : sablon.arkaPlanRengi === "altin" ? "#fef08a" : sablon.arkaPlanRengi === "siyah" ? "#18181b" : sablon.arkaPlanRengi === "gumus" ? "#e2e8f0" : sablon.arkaPlanRengi)
    : (sablon as any).bgColor || "#ffffff";

  const config: LabelConfig = {
    etiketTipi: sablon.etiketTipi || 1,
    etiketSekli: (sablon.etiketSekli as any) || "kelebek",
    genislikMm: sablon.genislikMm || 50,
    yukseklikMm: sablon.yukseklikMm || 20,
    solKanatMm: sablon.solKanatGenislikMm ?? (sablon.genislikMm || 50) / 2,
    sagKanatMm: sablon.sagKanatGenislikMm ?? (sablon.genislikMm || 50) / 2,
    kopruGenislikMm: 9,
    kopruYukseklikMm: 8,
    kuyrukGenislikMm: sablon.kuyrukGenislikMm ?? 35,
    kuyrukKalinlikMm: 4,
    delikCapiMm: 0,
    delikKonumu: "yok",
    katlamaCizgisi: true,
    bgColor: bg,
    bgTexture: "beyaz",
  };

  const els: CanvasElement[] = (sablon.alanlar || []).map((alan, i) => ({
    id: `thumb-${sablon.etiketSablonId}-${i}`,
    type: (alan.etiketElementTipi || "text") as ElementType,
    x: alan.x ?? 5,
    y: alan.y ?? 5 + i * 5,
    width: alan.genislik ?? (alan.etiketElementTipi === "barcode" ? 25 : 20),
    height: alan.yukseklik ?? (alan.etiketElementTipi === "barcode" ? 8 : 4),
    rotation: alan.rotation ?? 0,
    opacity: alan.opacity ?? 1,
    locked: false,
    visible: alan.visible ?? true,
    zIndex: alan.zIndex ?? i,
    text: alan.text || alan.alan,
    fieldKey: alan.alan,
    prefix: alan.prefix,
    suffix: alan.suffix,
    fontSize: alan.fontSize ?? 7,
    fontFamily: alan.fontFamily ?? "Arial",
    fontWeight: (alan.fontWeight as any) ?? "normal",
    fontStyle: (alan.fontStyle as any) ?? "normal",
    textDecoration: (alan.textDecoration as any) ?? "none",
    textAlign: (alan.textAlign as any) ?? "left",
    color: alan.color ?? "#000000",
    backgroundColor: alan.backgroundColor ?? "transparent",
    borderColor: alan.borderColor ?? "transparent",
    borderWidth: alan.borderWidth ?? 0,
    borderRadius: alan.borderRadius ?? 0,
    barcodeFormat: alan.barkodFormat as any,
    barcodeValue: alan.barcodeValue,
    barcodeText: alan.barcodeText || alan.customText,
    showText: alan.showBarcodeText ?? true,
    iconEmoji: alan.iconEmoji,
  }));

  const maxW = 175;
  const maxH = 88;
  const rawW = mmToPx(config.genislikMm, 1);
  const rawH = mmToPx(config.yukseklikMm, 1);
  const scale = Math.min(maxW / rawW, maxH / rawH, 1.15);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        padding: 4,
      }}
    >
      <div
        style={{
          width: mmToPx(config.genislikMm, scale),
          height: mmToPx(config.yukseklikMm, scale),
          position: "relative",
          boxShadow: "0 2px 10px rgba(0,0,0,0.6)",
          borderRadius: config.etiketSekli === "dambil" ? 4 * scale : 2,
          overflow: "visible",
        }}
      >
        <StaticLabelCell config={config} elements={els} zoom={scale} />
      </div>
    </div>
  );
};

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────
const UrunEtiketTasarimiPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // ─── State ────────────────────────────────────────────────────────────────
  const [editorState, dispatch] = useReducer(editorReducer, {
    present: {
      elements: [],
      labelConfig: defaultLabelConfig,
    },
    past: [],
    future: [],
  });

  const { elements, labelConfig } = editorState.present;

  const [zoom, setZoom] = useState(1.6);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<CanvasElement[]>([]);
  type CanvaSidebarCategory = "templates" | "elements" | "text" | "brand" | "barcode" | "layers" | "settings";
  const [canvaCategory, setCanvaCategory] = useState<CanvaSidebarCategory>("templates");
  const [isCanvaDrawerOpen, setIsCanvaDrawerOpen] = useState(true);
  const [templateFilterQuery, setTemplateFilterQuery] = useState("");

  // 🎨 Canva Font & Color Popover States
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState("");
  const [activeColorPopover, setActiveColorPopover] = useState<"textColor" | "bgColor" | "borderColor" | null>(null);
  const [customHexInput, setCustomHexInput] = useState("");
  const [isLabelSelected, setIsLabelSelected] = useState<boolean>(false);
  const inspectorRef = useRef<HTMLDivElement>(null);

  const [snapGrid, setSnapGrid] = useState(0); // 0 = Serbest / Akıcı piksel hassasiyeti
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<PaperLayoutId>("single");
  const [selectedPaperId, setSelectedPaperId] = useState<string>("kuse_beyaz");

  const selectedPaper = useMemo(
    () => LABEL_PAPERS.find((p) => p.id === selectedPaperId) || LABEL_PAPERS[0],
    [selectedPaperId]
  );

  const selectedLayout = useMemo(
    () => PAPER_LAYOUTS.find((l) => l.id === selectedLayoutId) || PAPER_LAYOUTS[0],
    [selectedLayoutId]
  );

  const currentLayoutInfo = useMemo(() => {
    const labelW = labelConfig.genislikMm;
    const labelH = labelConfig.yukseklikMm;
    if (selectedLayoutId === "single") {
      return {
        name: "Tekli 1:1",
        pageW: labelW,
        pageH: labelH,
        cols: 1,
        rows: 1,
        total: 1,
        margin: 0,
        gap: 0,
        description: `Tekli Etiket • 1:1 Gerçek Boyut (${labelW}×${labelH} mm)`,
      };
    }
    if (selectedLayoutId === "roll") {
      return {
        name: "1'li Rulo",
        pageW: labelW + 8,
        pageH: (labelH + 3) * 6 + 20,
        cols: 1,
        rows: 6,
        total: 6,
        margin: 4,
        gap: 3,
        description: `1'li Termal Rulo • Sürekli Ardışık Baskı (${labelW}×${labelH} mm)`,
      };
    }
    if (selectedLayoutId === "roll2") {
      return {
        name: "2'li Rulo",
        pageW: (labelW + 3) * 2 + 8,
        pageH: (labelH + 3) * 5 + 20,
        cols: 2,
        rows: 5,
        total: 10,
        margin: 4,
        gap: 3,
        description: `2'li Yan Yana Rulo • 5 Sıra (10 Adet)`,
      };
    }
    if (selectedLayoutId === "roll3") {
      return {
        name: "3'lü Rulo",
        pageW: (labelW + 3) * 3 + 8,
        pageH: (labelH + 3) * 5 + 20,
        cols: 3,
        rows: 5,
        total: 15,
        margin: 4,
        gap: 3,
        description: `3'lü Yan Yana Rulo • 5 Sıra (15 Adet)`,
      };
    }

    let pageW = 210;
    let pageH = 297;
    let margin = 7;
    let pageName = "A4 Tabaka";

    if (selectedLayoutId === "a4") {
      pageW = 210;
      pageH = 297;
      margin = 7;
      pageName = "A4 Tabaka";
    } else if (selectedLayoutId === "a5") {
      pageW = 148;
      pageH = 210;
      margin = 5;
      pageName = "A5 Tabaka";
    } else if (selectedLayoutId === "a6") {
      pageW = 105;
      pageH = 148;
      margin = 4;
      pageName = "A6 Tabaka";
    } else if (selectedLayoutId === "a3") {
      pageW = 297;
      pageH = 420;
      margin = 10;
      pageName = "A3 Tabaka";
    } else if (selectedLayoutId === "sheet_100x150") {
      pageW = 100;
      pageH = 150;
      margin = 4;
      pageName = "10×15 Tabaka";
    } else if (selectedLayoutId === "strip_80x200") {
      pageW = 80;
      pageH = 200;
      margin = 4;
      pageName = "8×20 Şerit";
    }

    const gap = 2;
    const cols = Math.max(1, Math.floor((pageW - margin * 2 + gap) / (labelW + gap)));
    const rows = Math.max(1, Math.floor((pageH - margin * 2 + gap) / (labelH + gap)));
    const total = cols * rows;

    return {
      name: pageName,
      pageW,
      pageH,
      cols,
      rows,
      total,
      margin,
      gap,
      description: `${pageName} (${pageW}×${pageH} mm) • 1 Sayfada ${total} Adet (${cols} Sütun × ${rows} Satır)`,
    };
  }, [selectedLayoutId, labelConfig.genislikMm, labelConfig.yukseklikMm]);

  // 🎨 Tasarımda Kullanılan Renkleri Otomatik Topla (Belge Renkleri)
  const designColors = useMemo(() => {
    const set = new Set<string>();
    if (labelConfig.bgColor && labelConfig.bgColor !== "transparent") set.add(labelConfig.bgColor.toLowerCase());
    elements.forEach((el) => {
      if (el.color && el.color !== "transparent") set.add(el.color.toLowerCase());
      if (el.backgroundColor && el.backgroundColor !== "transparent") set.add(el.backgroundColor.toLowerCase());
      if (el.borderColor && el.borderColor !== "transparent") set.add(el.borderColor.toLowerCase());
    });
    return Array.from(set);
  }, [elements, labelConfig.bgColor]);

  // 🔍 Filtrelenmiş Yazı Tipleri
  const filteredFonts = useMemo(() => {
    if (!fontSearchQuery.trim()) return CANVA_FONTS;
    const q = fontSearchQuery.toLowerCase();
    return CANVA_FONTS.filter((f) => f.name.toLowerCase().includes(q) || f.categoryLabel.toLowerCase().includes(q));
  }, [fontSearchQuery]);

  // 🎨 Canva Tarzı Renk Tablosu Popover Render Fonksiyonu
  const renderColorTablePopover = (
    title: string,
    currentColor: string,
    onSelectColor: (c: string) => void,
    allowTransparent: boolean = false
  ) => {
    return (
      <div className="canva-color-popover" onClick={(e) => e.stopPropagation()}>
        <div className="canva-color-popover-header">
          <span>{title}</span>
          <button
            type="button"
            className="canva-color-close-btn"
            onClick={() => setActiveColorPopover(null)}
          >
            <IconX size={14} />
          </button>
        </div>

        {/* Özel Renk ve Damlalık / Hex Bar */}
        <div className="canva-color-hex-bar">
          <input
            type="color"
            className="canva-color-native-input"
            value={currentColor.startsWith("#") && currentColor.length === 7 ? currentColor : "#000000"}
            onChange={(e) => {
              onSelectColor(e.target.value);
              dispatch({ type: "PUSH_HISTORY" });
            }}
            title="Renk Seçiciyi Aç"
          />
          <input
            type="text"
            className="canva-color-text-input"
            placeholder="#000000"
            value={customHexInput || currentColor}
            onChange={(e) => {
              setCustomHexInput(e.target.value);
              if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(e.target.value)) {
                onSelectColor(e.target.value);
                dispatch({ type: "PUSH_HISTORY" });
              }
            }}
          />
        </div>

        {/* Şeffaf Seçeneği (Opsiyonel) */}
        {allowTransparent && (
          <div className="canva-color-section">
            <button
              type="button"
              className={`canva-color-transparent-btn ${currentColor === "transparent" ? "active" : ""}`}
              onClick={() => {
                onSelectColor("transparent");
                dispatch({ type: "PUSH_HISTORY" });
                setActiveColorPopover(null);
              }}
            >
              <span className="transparent-icon">⊘</span>
              <span>Şeffaf (Dolgu Yok)</span>
            </button>
          </div>
        )}

        {/* Belge Renkleri (Canvas'ta var olanlar) */}
        {designColors.length > 0 && (
          <div className="canva-color-section">
            <div className="canva-color-section-title">📄 Belge Renkleri</div>
            <div className="canva-color-chips-row">
              {designColors.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className={`canva-color-swatch-box ${currentColor.toLowerCase() === hex ? "selected" : ""}`}
                  style={{ backgroundColor: hex }}
                  title={hex}
                  onClick={() => {
                    onSelectColor(hex);
                    dispatch({ type: "PUSH_HISTORY" });
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Kuyumcu & Sektörel Renkler */}
        <div className="canva-color-section">
          <div className="canva-color-section-title">💎 Kuyumcu Maden & Taş Tonları</div>
          <div className="canva-color-chips-row">
            {JEWELRY_PALETTE.map((item) => (
              <button
                key={item.name}
                type="button"
                className={`canva-color-swatch-box ${currentColor.toLowerCase() === item.color.toLowerCase() ? "selected" : ""}`}
                style={{ backgroundColor: item.color }}
                title={`${item.name} (${item.color})`}
                onClick={() => {
                  onSelectColor(item.color);
                  dispatch({ type: "PUSH_HISTORY" });
                }}
              />
            ))}
          </div>
        </div>

        {/* Standart Renk Tablosu Matrisi (35 Renk) */}
        <div className="canva-color-section">
          <div className="canva-color-section-title">🎨 Standart Renk Tablosu</div>
          <div className="canva-color-table-grid">
            {CANVA_COLOR_MATRIX.map((row, rIdx) => (
              <div key={rIdx} className="canva-color-row">
                {row.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`canva-color-swatch-box ${currentColor.toLowerCase() === hex.toLowerCase() ? "selected" : ""}`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                    onClick={() => {
                      onSelectColor(hex);
                      dispatch({ type: "PUSH_HISTORY" });
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Popover Dışına Tıklayınca Kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inspectorRef.current && !inspectorRef.current.contains(e.target as Node)) {
        setFontMenuOpen(false);
        setActiveColorPopover(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Önizleme Modu Otomatik Ekrana Sığdırma (Fit-to-Screen) & Zoom
  const [previewZoom, setPreviewZoom] = useState<number>(0.65);

  const calculateFitZoom = useCallback(
    (layoutId: PaperLayoutId) => {
      const container = canvasScrollContainerRef.current;
      const availW = (container ? container.clientWidth : window.innerWidth) - 130;
      const availH = (container ? container.clientHeight : window.innerHeight) - 100;

      let pageW = 210;
      let pageH = 297;
      if (layoutId === "single") {
        pageW = labelConfig.genislikMm;
        pageH = labelConfig.yukseklikMm;
      } else if (layoutId === "roll") {
        pageW = labelConfig.genislikMm + 8;
        pageH = (labelConfig.yukseklikMm + 3) * 6 + 20;
      } else if (layoutId === "roll2") {
        pageW = (labelConfig.genislikMm + 3) * 2 + 8;
        pageH = (labelConfig.yukseklikMm + 3) * 5 + 20;
      } else if (layoutId === "roll3") {
        pageW = (labelConfig.genislikMm + 3) * 3 + 8;
        pageH = (labelConfig.yukseklikMm + 3) * 5 + 20;
      } else if (layoutId === "a4") {
        pageW = 210;
        pageH = 297;
      } else if (layoutId === "a5") {
        pageW = 148;
        pageH = 210;
      } else if (layoutId === "a6") {
        pageW = 105;
        pageH = 148;
      } else if (layoutId === "a3") {
        pageW = 297;
        pageH = 420;
      } else if (layoutId === "sheet_100x150") {
        pageW = 100;
        pageH = 150;
      } else if (layoutId === "strip_80x200") {
        pageW = 80;
        pageH = 200;
      }

      const sheetW_px = mmToPx(pageW, 1);
      const sheetH_px = mmToPx(pageH, 1);

      if (sheetW_px <= 0 || sheetH_px <= 0) return 0.65;

      const scaleW = availW / sheetW_px;
      const scaleH = availH / sheetH_px;
      let fit = Math.min(scaleW, scaleH) * 0.94;

      if (layoutId === "single") {
        fit = Math.min(fit, 1.8);
      } else {
        fit = Math.min(fit, 1.2);
      }

      return clamp(Math.round(fit * 100) / 100, 0.15, 3.0);
    },
    [labelConfig.genislikMm, labelConfig.yukseklikMm]
  );

  useEffect(() => {
    if (isPreviewMode) {
      const fit = calculateFitZoom(selectedLayoutId);
      setPreviewZoom(fit);
      if (canvasScrollContainerRef.current) {
        canvasScrollContainerRef.current.scrollTop = 0;
      }
    }
  }, [isPreviewMode, selectedLayoutId, calculateFitZoom]);

  // Şablon ve Dürbün State
  const [sablonlar, setSablonlar] = useState<EtiketSablonItem[]>([]);
  const [activeSablon, setActiveSablon] = useState<EtiketSablonItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [durbunModal, setDurbunModal] = useState(false);
  const [durbunSelectedId, setDurbunSelectedId] = useState<number | null>(null);
  const [durbunFilter, setDurbunFilter] = useState("");
  const [durbunTipFilter, setDurbunTipFilter] = useState<number | "all">("all");
  const [sablonAdi, setSablonAdi] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorPopup, setErrorPopup] = useState<{ show: boolean; title: string; message: string } | null>(null);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [editTitleModal, setEditTitleModal] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  // Kolay Arayüz Modalları & Serbest Pan/Kaydırma State
  const [canvasPan, setCanvasPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [fieldsModalOpen, setFieldsModalOpen] = useState(false);
  const [shapeModalOpen, setShapeModalOpen] = useState(false);
  const [printerModalOpen, setPrinterModalOpen] = useState(false);
  const [logoModalOpen, setLogoModalOpen] = useState(false);
  const [shapesAccordionOpen, setShapesAccordionOpen] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");
  const [fieldCategory, setFieldCategory] = useState<"all" | "altin" | "pirlanta" | "genel">("all");
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number }>({ x: 0, y: 0, startPanX: 0, startPanY: 0 });

  // Özel Sağ Tık Menüsü State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetId: string | null;
  } | null>(null);

  const [guidelines, setGuidelines] = useState<{ xLines: number[]; yLines: number[] }>({
    xLines: [],
    yLines: [],
  });

  // Drag & Move state refs (Piksel hassasiyetinde akıcı hareket)
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasScrollContainerRef = useRef<HTMLDivElement>(null);

  // ─── Serbest Kaydırma (Pan) ve Ortala Fonksiyonları ─────────────────────────
  const centerCanvas = useCallback((smooth = true) => {
    setCanvasPan({ x: 0, y: 0 });
    if (canvasScrollContainerRef.current) {
      const container = canvasScrollContainerRef.current;
      container.scrollTo({
        left: Math.max(0, (container.scrollWidth - container.clientWidth) / 2),
        top: Math.max(0, (container.scrollHeight - container.clientHeight) / 2),
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  useEffect(() => {
    centerCanvas(false);
    const t1 = setTimeout(() => centerCanvas(false), 50);
    const t2 = setTimeout(() => centerCanvas(true), 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [centerCanvas, activeSablon, zoom, labelConfig.genislikMm, labelConfig.yukseklikMm]);
  const dragRef = useRef<{
    active: boolean;
    type: "move" | "resize" | "rotate" | "lasso";
    elementId?: string;
    handle?: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    origRot: number;
    centerX: number;
    centerY: number;
    lassoStart?: { x: number; y: number };
  } | null>(null);

  const [lasso, setLasso] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageTargetIdRef = useRef<string | null>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  // Çift tıklamada input açıldığında anında odaklan ve tüm metni seç
  useEffect(() => {
    if (editingId) {
      setTimeout(() => {
        if (inlineInputRef.current) {
          inlineInputRef.current.focus();
          inlineInputRef.current.select();
        }
      }, 20);
    }
  }, [editingId]);


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEv) => {
      const base64 = loadEv.target?.result as string;
      if (base64) {
        const targetId =
          imageTargetIdRef.current ||
          (selectedElement?.type === "image" || selectedElement?.type === "logo"
            ? selectedElement.id
            : null);

        if (targetId && elements.some((el) => el.id === targetId)) {
          // Doğrudan o alanın / kutunun içine fotoğrafı yerleştir
          updateElement(targetId, {
            imageData: base64,
            text: file.name,
          });
          dispatch({ type: "PUSH_HISTORY" });
          setSelectedIds([targetId]);
        } else {
          // Tuvalde seçili görsel kutusu yoksa yeni kutu olarak ekle
          addElement({
            type: "image",
            imageData: base64,
            x: 4,
            y: 4,
            width: 16,
            height: 10,
            text: file.name,
          });
        }
        imageTargetIdRef.current = null;
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ─── Şablonları Yükle ──────────────────────────────────────────────────────
  const loadSablonlarList = useCallback(async () => {
    try {
      const data = await EtiketService.getSablonlar();
      setSablonlar(data);
    } catch { }
  }, []);

  useEffect(() => {
    loadSablonlarList();
  }, [loadSablonlarList]);

  // ─── Sektörel Logo & Damga Yönetimi (TODVZ_FOTOGRAF: URUN_TIPI = 9) ────────
  const [dbLogolar, setDbLogolar] = useState<EtiketLogoItem[]>([]);
  const [loadingDbLogolar, setLoadingDbLogolar] = useState(false);
  const logoUploadInputRef = useRef<HTMLInputElement>(null);

  const loadDbLogolarList = useCallback(async () => {
    try {
      setLoadingDbLogolar(true);
      const data = await EtiketService.getLogolar(9);
      setDbLogolar(data);
    } catch {
      // Sessizce geç
    } finally {
      setLoadingDbLogolar(false);
    }
  }, []);

  useEffect(() => {
    loadDbLogolarList();
  }, [loadDbLogolarList]);

  const handleUploadDbLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (loadEv) => {
      const base64 = loadEv.target?.result as string;
      if (base64) {
        try {
          await EtiketService.saveLogo({
            base64,
            dosyaAdi: file.name,
            mimeTipi: file.type || "image/png",
            tip: 9,
          });
          await loadDbLogolarList();
        } catch (err: any) {
          alert("Logo veritabanına kaydedilemedi: " + (err?.response?.data?.message || err?.message));
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDeleteDbLogo = async (fotografId: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Bu logoyu veritabanından silmek istediğinize emin misiniz?")) return;
    try {
      await EtiketService.deleteLogo(fotografId);
      await loadDbLogolarList();
    } catch (err: any) {
      alert("Logo silinemedi: " + (err?.response?.data?.message || err?.message));
    }
  };

  // ─── Seçili Elemanlar ──────────────────────────────────────────────────────

  const selectedElements = useMemo(
    () => elements.filter((el) => selectedIds.includes(el.id)),
    [elements, selectedIds]
  );
  const selectedElement = selectedElements.length === 1 ? selectedElements[0] : null;

  // ─── Dış Tıklamada Context Menüyü Kapat ──────────────────────────────────────
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu?.visible) setContextMenu(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => window.removeEventListener("click", handleGlobalClick);
  }, [contextMenu]);

  // ─── Klavye Kısayolları (Piksel Hassasiyetinde Nudge) ───────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isEditing = editingId !== null || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "Escape") {
        if (isPreviewMode) {
          setIsPreviewMode(false);
          return;
        }
        setSelectedIds([]);
        setEditingId(null);
        setContextMenu(null);
        if (isFullscreen) setIsFullscreen(false);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }
      if (e.key === "F3") {
        e.preventDefault();
        setDurbunModal(true);
        return;
      }
      if (e.key === "F1" || ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S"))) {
        e.preventDefault();
        handleQuickSaveRef.current();
        return;
      }
      if (e.key === "F9" || ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P"))) {
        e.preventDefault();
        handleDirectPrint();
        return;
      }
      if (e.key === "F10") {
        e.preventDefault();
        handleSaveAndPrintRef.current();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && !isEditing) {
        e.preventDefault();
        setSelectedIds(elements.map((el) => el.id));
        return;
      }

      if (isEditing) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        setClipboard(selectedElements.map((el) => ({ ...el })));
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        if (clipboard.length > 0) {
          dispatch({ type: "PUSH_HISTORY" });
          const newEls = clipboard.map((el) => ({
            ...el,
            id: genId(),
            x: el.x + 2,
            y: el.y + 2,
            zIndex: Math.max(...elements.map((e) => e.zIndex), 0) + 1,
          }));
          newEls.forEach((el) =>
            dispatch({ type: "ADD_ELEMENT", element: el })
          );
          setSelectedIds(newEls.map((el) => el.id));
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        if (selectedElements.length > 0) {
          const newEls = selectedElements.map((el) => ({
            ...el,
            id: genId(),
            x: el.x + 2,
            y: el.y + 2,
            zIndex: Math.max(...elements.map((e) => e.zIndex), 0) + 1,
          }));
          newEls.forEach((el) => dispatch({ type: "ADD_ELEMENT", element: el }));
          setSelectedIds(newEls.map((el) => el.id));
        }
        return;
      }
      if (e.key === "Escape") {
        setSelectedIds([]);
        setEditingId(null);
        setIsLabelSelected(false);
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          dispatch({ type: "DELETE_ELEMENTS", ids: selectedIds });
          setSelectedIds([]);
        }
        return;
      }
      // Hassas piksel nudge (0.15 mm serbest adım)
      const arrow = { ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0], ArrowUp: [0, -0.15], ArrowDown: [0, 0.15] }[e.key];
      if (arrow && selectedIds.length > 0) {
        e.preventDefault();
        const mult = e.shiftKey ? 8 : 1;
        selectedIds.forEach((id) => {
          const el = elements.find((e) => e.id === id);
          if (el && !el.locked) {
            dispatch({ type: "UPDATE_ELEMENT", id, changes: { x: el.x + arrow[0] * mult, y: el.y + arrow[1] * mult } });
          }
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, selectedElements, clipboard, elements, editingId, isFullscreen, isPreviewMode]);

  // ─── Doğrudan Çıktı Alma (Baskı) Yordamı ──────────────────────────────────
  const handleDirectPrint = useCallback(async () => {
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      window.print();
      return;
    }

    const title = sablonAdi ? `${sablonAdi} - Etiket Baskı` : "Etiket Baskı";

    const isRollType = selectedLayoutId === "roll" || selectedLayoutId === "roll2" || selectedLayoutId === "roll3";
    const isSheetType = !isRollType && selectedLayoutId !== "single";

    const singleLabelHtml = await buildSingleLabelHtml(labelConfig, elements);

    const fontsHeadHtml = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400..900;1,6..96,400..900&family=Caveat:wght@400..700&family=Cinzel:wght@400..900&family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&family=Dancing+Script:wght@400..700&family=Great+Vibes&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Montserrat:ital,wght@0,100..900;1,100..900&family=Oswald:wght@200..700&family=Outfit:wght@100..900&family=Pacifico&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Poppins:ital,wght@0,100..900;1,100..900&family=Roboto:ital,wght@0,100..900;1,100..900&family=Sacramento&family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
    `;

    const printScript = `
      <script>
        function triggerPrint() {
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function() {
              setTimeout(function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 600);
              }, 120);
            });
          } else {
            setTimeout(function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 600);
            }, 250);
          }
        }
        window.onload = triggerPrint;
      </script>
    `;

    // 1. TÜM TABAKA VE KART BASKILARI (A4, A5, A6, A3, 10x15, 8x20)
    if (isPreviewMode && isSheetType) {
      const { pageW, pageH, margin, gap, cols, total, name } = currentLayoutInfo;
      const labelW = labelConfig.genislikMm;
      const labelH = labelConfig.yukseklikMm;

      let gridItemsHtml = "";
      for (let i = 0; i < total; i++) {
        gridItemsHtml += `
          <div style="width: ${labelW}mm; height: ${labelH}mm; position: relative; overflow: hidden; box-sizing: border-box;">
            ${singleLabelHtml}
          </div>
        `;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${title} (${name} Baskı)</title>
            ${fontsHeadHtml}
            <style>
              @page {
                size: ${pageW}mm ${pageH}mm portrait;
                margin: ${margin}mm;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                width: 100%;
                height: 100%;
                margin: 0;
                padding: 0;
                background: #ffffff;
              }
              .sheet-grid {
                display: grid;
                grid-template-columns: repeat(${cols}, ${labelW}mm);
                grid-auto-rows: ${labelH}mm;
                gap: ${gap}mm;
                justify-content: center;
                align-content: flex-start;
              }
            </style>
          </head>
          <body>
            <div class="sheet-grid">
              ${gridItemsHtml}
            </div>
            ${printScript}
          </body>
        </html>
      `);
      printWindow.document.close();
      return;
    }

    // 2. TERMAL RULO ŞERİT BASKISI (1'li, 2'li, 3'lü Rulo)
    if (isPreviewMode && isRollType) {
      const { cols, rows } = currentLayoutInfo;

      let rollItemsHtml = "";
      for (let r = 0; r < rows; r++) {
        rollItemsHtml += `<div style="display: flex; gap: 3mm; margin-bottom: 3mm; justify-content: center; page-break-inside: avoid; break-inside: avoid;">`;
        for (let c = 0; c < cols; c++) {
          rollItemsHtml += `
            <div style="width: ${labelConfig.genislikMm}mm; height: ${labelConfig.yukseklikMm}mm; position: relative; overflow: hidden;">
              ${singleLabelHtml}
            </div>
          `;
        }
        rollItemsHtml += `</div>`;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>${title} (Rulo Şerit Baskı)</title>
            ${fontsHeadHtml}
            <style>
              @page {
                size: ${labelConfig.genislikMm + 6}mm auto;
                margin: 0;
              }
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              html, body {
                margin: 0;
                padding: 3mm 0;
                background: #ffffff;
                display: flex;
                flex-direction: column;
                align-items: center;
              }
            </style>
          </head>
          <body>
            ${rollItemsHtml}
            ${printScript}
          </body>
        </html>
      `);
      printWindow.document.close();
      return;
    }

    // 3. TEKLİ BİREBİR ETİKET BASKISI (Termal Barkod Yazıcı)
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          ${fontsHeadHtml}
          <style>
            @page {
              size: ${labelConfig.genislikMm}mm ${labelConfig.yukseklikMm}mm;
              margin: 0 !important;
            }
            *, *::before, *::after {
              box-sizing: border-box !important;
              margin: 0 !important;
              padding: 0 !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: ${labelConfig.genislikMm}mm !important;
              height: ${labelConfig.yukseklikMm}mm !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              background: #ffffff !important;
              overflow: hidden !important;
            }
            .print-wrapper {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              width: ${labelConfig.genislikMm}mm !important;
              height: ${labelConfig.yukseklikMm}mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              background: #ffffff !important;
            }
          </style>
        </head>
        <body>
          <div class="print-wrapper">
            ${singleLabelHtml}
          </div>
          ${printScript}
        </body>
      </html>
    `);
    printWindow.document.close();
  }, [labelConfig, sablonAdi, isPreviewMode, selectedLayoutId, currentLayoutInfo, elements]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const canvasPanRef = useRef(canvasPan);
  canvasPanRef.current = canvasPan;

  const isPreviewModeRef = useRef(isPreviewMode);
  isPreviewModeRef.current = isPreviewMode;

  // ─── Mouse Wheel ile Zoom Yapma (Etiket ve Cursor Odaklı Yakınlaştırma / Uzaklaştırma) ──────
  useEffect(() => {
    const el = canvasScrollContainerRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // Önizleme modundayken:
      // Eğer Ctrl/Cmd basılıysa veya pinch zoom yapılıyorsa sayfayı büyüt/küçült.
      if (isPreviewModeRef.current) {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const zoomFactor = Math.exp(-e.deltaY * 0.008);
          setPreviewZoom((prevZoom) => {
            const nextZoom = prevZoom * zoomFactor;
            return clamp(Math.round(nextZoom * 100) / 100, 0.15, 3.5);
          });
        }
        return;
      }

      e.preventDefault();

      const currentZoom = zoomRef.current;
      const currentPan = canvasPanRef.current;

      let zoomFactor: number;
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch zoom veya Ctrl + Wheel (Hassas ve akıcı)
        zoomFactor = Math.exp(-e.deltaY * 0.008);
      } else {
        // Standart Mouse Wheel tekerleği (Yukarı = Yakınlaş, Aşağı = Uzaklaş)
        const direction = e.deltaY < 0 ? 1 : -1;
        zoomFactor = direction > 0 ? 1.14 : 0.88;
      }

      const nextZoom = clamp(Math.round(currentZoom * zoomFactor * 100) / 100, 0.3, 6.0);
      if (nextZoom === currentZoom) return;

      // Mouse imlecinin container içindeki konumuna göre odaklı zoom (Focal point zoom towards cursor):
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const offsetX = mouseX - centerX;
      const offsetY = mouseY - centerY;

      const scaleRatio = nextZoom / currentZoom;
      const nextPanX = currentPan.x + (offsetX - currentPan.x) * (1 - scaleRatio);
      const nextPanY = currentPan.y + (offsetY - currentPan.y) * (1 - scaleRatio);

      setZoom(nextZoom);
      setCanvasPan({
        x: Math.round(nextPanX * 10) / 10,
        y: Math.round(nextPanY * 10) / 10,
      });
    };

    el.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleNativeWheel);
  }, []);

  // ─── Eleman Ekle ──────────────────────────────────────────────────────────
  const addElement = useCallback(
    (overrides: Partial<CanvasElement> & { type: ElementType }) => {
      const maxZ = elements.length > 0 ? Math.max(...elements.map((e) => e.zIndex)) : 0;
      const w = overrides.width || (overrides.type === "barcode" ? 26 : overrides.type === "qr" ? 14 : overrides.type === "line" ? 20 : 20);
      const h = overrides.height || (overrides.type === "barcode" ? 8 : overrides.type === "qr" ? 14 : overrides.type === "line" ? 0.5 : 5);

      const newEl: CanvasElement = {
        id: genId(),
        type: overrides.type,
        x: overrides.x !== undefined ? overrides.x : Math.max(2, (labelConfig.genislikMm - w) / 2),
        y: overrides.y !== undefined ? overrides.y : Math.max(2, (labelConfig.yukseklikMm - h) / 2),
        width: w,
        height: h,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: maxZ + 1,
        fontSize: 8,
        fontFamily: "Arial",
        fontWeight: "normal",
        fontStyle: "normal",
        textDecoration: "none",
        textAlign: overrides.textAlign || (overrides.isNumeric ? "right" : "left"),
        color: "#000000",
        backgroundColor: "transparent",
        borderColor: "transparent",
        borderWidth: 0,
        borderRadius: 0,
        ...overrides,
      };
      dispatch({ type: "ADD_ELEMENT", element: newEl });
      setSelectedIds([newEl.id]);
    },
    [elements, labelConfig]
  );


  // ─── HTML5 Sürükle Bırak (Drag & Drop) ─────────────────────────────────────
  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
          const reader = new FileReader();
          reader.onload = (loadEv) => {
            const base64 = loadEv.target?.result as string;
            if (base64 && canvasRef.current) {
              const rect = canvasRef.current.getBoundingClientRect();
              const dropX = pxToMm(e.clientX - rect.left, zoom);
              const dropY = pxToMm(e.clientY - rect.top, zoom);
              addElement({
                type: "image",
                imageData: base64,
                x: Math.max(0, Math.round((dropX - 8) * 10) / 10),
                y: Math.max(0, Math.round((dropY - 5) * 10) / 10),
                width: 16,
                height: 10,
                text: file.name,
              });
            }
          };
          reader.readAsDataURL(file);
          return;
        }
      }

      const rawData = e.dataTransfer.getData("application/json");
      if (!rawData || !canvasRef.current) return;
      const data = JSON.parse(rawData);

      const rect = canvasRef.current.getBoundingClientRect();
      const dropX = pxToMm(e.clientX - rect.left, zoom);
      const dropY = pxToMm(e.clientY - rect.top, zoom);

      const w = data.width || 20;
      const h = data.height || 6;
      const finalX = clamp(dropX - w / 2, 0, Math.max(0.5, labelConfig.genislikMm - w));
      const finalY = clamp(dropY - h / 2, 0, Math.max(0.5, labelConfig.yukseklikMm - h));

      addElement({
        ...data,
        x: Math.round(finalX * 100) / 100,
        y: Math.round(finalY * 100) / 100,
      });
    } catch { }
  };

  // ─── Mouse / Touch Koordinatları ──────────────────────────────────────────
  const getCanvasPos = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: pxToMm(clientX - rect.left, zoom),
        y: pxToMm(clientY - rect.top, zoom),
      };
    },
    [zoom]
  );

  // ─── Sürükleme Başlatıcı ───────────────────────────────────────────────────
  const startDragMove = (clientX: number, clientY: number, id: string) => {
    setIsLabelSelected(false);
    const el = elements.find((item) => item.id === id);
    if (!el || el.locked) return;

    if (!selectedIds.includes(id)) {
      setSelectedIds([id]);
    }

    dragRef.current = {
      active: true,
      type: "move",
      elementId: id,
      startX: clientX,
      startY: clientY,
      origX: el.x,
      origY: el.y,
      origW: el.width,
      origH: el.height,
      origRot: el.rotation,
      centerX: el.x + el.width / 2,
      centerY: el.y + el.height / 2,
    };
  };

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) return;

      const target = e.target as HTMLElement;
      const isElementOrHandle =
        target.closest(".canvas-element") ||
        target.closest(".resize-handle") ||
        target.closest(".rotate-handle") ||
        target.closest(".context-quick-bar") ||
        target.closest(".canvas-top-action-bar") ||
        target.closest(".canvas-context-compact-ribbon");

      const isInsideLabel =
        target.closest(".label-canvas") ||
        target.closest(".label-canvas-wrapper") ||
        target.closest(".label-dimension-badge-top") ||
        target.closest(".label-dimension-badge-left");

      if (isElementOrHandle) {
        setIsLabelSelected(false);
      } else {
        if (!e.shiftKey) setSelectedIds([]);
        setEditingId(null);

        // Şablonun zeminine tıklanınca şablon ayarlarını aç, dışarıya tıklanınca kapat
        if (isInsideLabel) {
          setIsLabelSelected(true);
        } else {
          setIsLabelSelected(false);
        }

        if (e.shiftKey) {
          const pos = getCanvasPos(e.clientX, e.clientY);
          dragRef.current = {
            active: true,
            type: "lasso",
            startX: e.clientX,
            startY: e.clientY,
            origX: pos.x,
            origY: pos.y,
            origW: 0,
            origH: 0,
            origRot: 0,
            centerX: 0,
            centerY: 0,
            lassoStart: pos,
          };
        } else {
          // Doğrudan mouse ile boş alandan tutup serbestçe her yöne kaydır (Pan)
          isPanningRef.current = true;
          panStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            startPanX: canvasPan.x,
            startPanY: canvasPan.y,
          };
        }
      }
    },
    [getCanvasPos, canvasPan]
  );

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.button === 2) return;
      e.stopPropagation();
      setIsLabelSelected(false);
      startDragMove(e.clientX, e.clientY, id);
    },
    [elements, selectedIds, getCanvasPos]
  );


  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, id: string, handle: string) => {
      e.stopPropagation();
      e.preventDefault();
      const el = elements.find((el) => el.id === id);
      if (!el) return;
      dragRef.current = {
        active: true,
        type: "resize",
        elementId: id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origX: el.x,
        origY: el.y,
        origW: el.width,
        origH: el.height,
        origRot: el.rotation,
        centerX: el.x + el.width / 2,
        centerY: el.y + el.height / 2,
      };
    },
    [elements]
  );

  const handleRotateMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      const el = elements.find((el) => el.id === id);
      if (!el) return;
      dragRef.current = {
        active: true,
        type: "rotate",
        elementId: id,
        startX: e.clientX,
        startY: e.clientY,
        origX: el.x,
        origY: el.y,
        origW: el.width,
        origH: el.height,
        origRot: el.rotation,
        centerX: mmToPx(el.x + el.width / 2, zoom),
        centerY: mmToPx(el.y + el.height / 2, zoom),
      };
    },
    [elements, zoom]
  );

  const handleRotateTouchStart = useCallback(
    (e: React.TouchEvent, id: string) => {
      if (e.touches.length === 1) {
        e.stopPropagation();
        const touch = e.touches[0];
        const el = elements.find((el) => el.id === id);
        if (!el) return;
        dragRef.current = {
          active: true,
          type: "rotate",
          elementId: id,
          startX: touch.clientX,
          startY: touch.clientY,
          origX: el.x,
          origY: el.y,
          origW: el.width,
          origH: el.height,
          origRot: el.rotation,
          centerX: mmToPx(el.x + el.width / 2, zoom),
          centerY: mmToPx(el.y + el.height / 2, zoom),
        };
      }
    },
    [elements, zoom]
  );

  const handleElementTouchStart = (e: React.TouchEvent, id: string) => {
    if (e.touches.length === 1) {
      e.stopPropagation();
      const touch = e.touches[0];
      startDragMove(touch.clientX, touch.clientY, id);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, elementId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (elementId) {
      if (!selectedIds.includes(elementId)) {
        setSelectedIds([elementId]);
      }
    }
    setContextMenu({
      visible: true,
      x: Math.min(window.innerWidth - 200, e.clientX),
      y: Math.min(window.innerHeight - 260, e.clientY),
      targetId: elementId || null,
    });
  };

  // ─── Mouse / Touch Move & Up (Kesintisiz Piksel Hassasiyeti) ───────────────
  useEffect(() => {
    const handleMove = (clientX: number, clientY: number) => {
      if (isPanningRef.current) {
        const dx = clientX - panStartRef.current.x;
        const dy = clientY - panStartRef.current.y;
        setCanvasPan({
          x: panStartRef.current.startPanX + dx,
          y: panStartRef.current.startPanY + dy,
        });
        return;
      }

      if (!dragRef.current?.active) return;
      const dr = dragRef.current;

      if (dr.type === "move" && dr.elementId) {
        const dx = pxToMm(clientX - dr.startX, zoom);
        const dy = pxToMm(clientY - dr.startY, zoom);
        const moveIds = selectedIds.includes(dr.elementId) ? selectedIds : [dr.elementId];
        const primaryEl = elements.find((item) => item.id === dr.elementId);
        if (!primaryEl || primaryEl.locked) return;

        let rawX = dr.origX + dx;
        let rawY = dr.origY + dy;

        // Mıknatıslı Akıllı Hizalama (Smart Guides / Magnetic Snapping)
        const activeXLines: number[] = [];
        const activeYLines: number[] = [];

        const SNAP_THRESHOLD_MM = Math.max(pxToMm(7, zoom), snapGrid > 0 ? snapGrid * 0.75 : 0.8);
        const otherEls = elements.filter((e) => !moveIds.includes(e.id) && e.visible);

        // X Adayları (Tuval kenarları, orta çizgi, katlama çizgisi ve diğer eleman kenarları)
        const xTargets = [
          0,
          labelConfig.genislikMm / 2,
          labelConfig.genislikMm,
          ...(labelConfig.solKanatMm ? [labelConfig.solKanatMm] : []),
        ];
        otherEls.forEach((other) => {
          xTargets.push(other.x);
          xTargets.push(other.x + other.width / 2);
          xTargets.push(other.x + other.width);
        });

        // Y Adayları (Tuval üst, orta, alt kenarları ve diğer eleman kenarları)
        const yTargets = [
          0,
          labelConfig.yukseklikMm / 2,
          labelConfig.yukseklikMm,
        ];
        otherEls.forEach((other) => {
          yTargets.push(other.y);
          yTargets.push(other.y + other.height / 2);
          yTargets.push(other.y + other.height);
        });

        // X Snapping & Guidelines
        let bestDeltaX = SNAP_THRESHOLD_MM;
        let snappedX = rawX;
        let matchedXLine: number | null = null;
        const pW = primaryEl.width;

        for (const targetX of xTargets) {
          // Sol kenar
          if (Math.abs(rawX - targetX) < bestDeltaX) {
            bestDeltaX = Math.abs(rawX - targetX);
            snappedX = targetX;
            matchedXLine = targetX;
          }
          // Orta nokta
          if (Math.abs(rawX + pW / 2 - targetX) < bestDeltaX) {
            bestDeltaX = Math.abs(rawX + pW / 2 - targetX);
            snappedX = targetX - pW / 2;
            matchedXLine = targetX;
          }
          // Sağ kenar
          if (Math.abs(rawX + pW - targetX) < bestDeltaX) {
            bestDeltaX = Math.abs(rawX + pW - targetX);
            snappedX = targetX - pW;
            matchedXLine = targetX;
          }
        }

        if (matchedXLine !== null) {
          rawX = snappedX;
          activeXLines.push(matchedXLine);
        } else if (snapGrid > 0) {
          rawX = snapToGrid(rawX, snapGrid);
          // Check if grid-snapped position aligns with any target
          for (const targetX of xTargets) {
            if (
              Math.abs(rawX - targetX) < 0.15 ||
              Math.abs(rawX + pW / 2 - targetX) < 0.15 ||
              Math.abs(rawX + pW - targetX) < 0.15
            ) {
              activeXLines.push(targetX);
            }
          }
        }

        // Y Snapping & Guidelines
        let bestDeltaY = SNAP_THRESHOLD_MM;
        let snappedY = rawY;
        let matchedYLine: number | null = null;
        const pH = primaryEl.height;

        for (const targetY of yTargets) {
          // Üst kenar
          if (Math.abs(rawY - targetY) < bestDeltaY) {
            bestDeltaY = Math.abs(rawY - targetY);
            snappedY = targetY;
            matchedYLine = targetY;
          }
          // Orta nokta
          if (Math.abs(rawY + pH / 2 - targetY) < bestDeltaY) {
            bestDeltaY = Math.abs(rawY + pH / 2 - targetY);
            snappedY = targetY - pH / 2;
            matchedYLine = targetY;
          }
          // Alt kenar
          if (Math.abs(rawY + pH - targetY) < bestDeltaY) {
            bestDeltaY = Math.abs(rawY + pH - targetY);
            snappedY = targetY - pH;
            matchedYLine = targetY;
          }
        }

        if (matchedYLine !== null) {
          rawY = snappedY;
          activeYLines.push(matchedYLine);
        } else if (snapGrid > 0) {
          rawY = snapToGrid(rawY, snapGrid);
          // Check if grid-snapped position aligns with any target
          for (const targetY of yTargets) {
            if (
              Math.abs(rawY - targetY) < 0.15 ||
              Math.abs(rawY + pH / 2 - targetY) < 0.15 ||
              Math.abs(rawY + pH - targetY) < 0.15
            ) {
              activeYLines.push(targetY);
            }
          }
        }

        setGuidelines({
          xLines: Array.from(new Set(activeXLines)),
          yLines: Array.from(new Set(activeYLines)),
        });


        const finalDx = rawX - dr.origX;
        const finalDy = rawY - dr.origY;

        moveIds.forEach((id) => {
          const el = elements.find((item) => item.id === id);
          if (!el || el.locked) return;
          const origElX = id === dr.elementId ? dr.origX : el.x;
          const origElY = id === dr.elementId ? dr.origY : el.y;

          const newX = Math.round((origElX + finalDx) * 100) / 100;
          const newY = Math.round((origElY + finalDy) * 100) / 100;

          dispatch({ type: "UPDATE_ELEMENT", id, changes: { x: newX, y: newY } });
        });
      } else if (dr.type === "resize" && dr.elementId && dr.handle) {
        const dx = pxToMm(clientX - dr.startX, zoom);
        const dy = pxToMm(clientY - dr.startY, zoom);
        let { origX: nx, origY: ny, origW: nw, origH: nh } = dr;
        const h = dr.handle;
        if (h.includes("e")) nw = Math.max(2, dr.origW + dx);
        if (h.includes("s")) nh = Math.max(1, dr.origH + dy);
        if (h.includes("w")) { nx = dr.origX + dx; nw = Math.max(2, dr.origW - dx); }
        if (h.includes("n")) { ny = dr.origY + dy; nh = Math.max(1, dr.origH - dy); }
        dispatch({
          type: "UPDATE_ELEMENT",
          id: dr.elementId,
          changes: { x: Math.round(nx * 100) / 100, y: Math.round(ny * 100) / 100, width: Math.round(nw * 100) / 100, height: Math.round(nh * 100) / 100 },
        });
      } else if (dr.type === "rotate" && dr.elementId) {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const angle = Math.atan2(
          clientY - rect.top - dr.centerY,
          clientX - rect.left - dr.centerX
        );
        const rawDeg = ((angle * 180) / Math.PI - 90 + 360) % 360;

        // Mıknatıslı Açı Yakalama (0°, 90°, 180°, 270° - Tam Dik ve Düz)
        const SNAP_TOLERANCE = 5.0; // ±5° manyetik yakalama
        const snapAngles = [0, 90, 180, 270, 360];
        let finalDeg = Math.round(rawDeg);
        let isSnapped = false;

        for (const target of snapAngles) {
          if (Math.abs(rawDeg - target) <= SNAP_TOLERANCE) {
            finalDeg = target % 360;
            isSnapped = true;
            break;
          }
        }

        const el = elements.find((item) => item.id === dr.elementId);
        if (el) {
          const centerX = el.x + el.width / 2;
          const centerY = el.y + el.height / 2;

          if (isSnapped) {
            // Tam dik veya düz olunca merkez kılavuz çizgileri gösterilir
            setGuidelines({
              xLines: [centerX],
              yLines: [centerY],
            });
          } else {
            setGuidelines({ xLines: [], yLines: [] });
          }
        }

        dispatch({
          type: "UPDATE_ELEMENT",
          id: dr.elementId,
          changes: { rotation: finalDeg },
        });
      } else if (dr.type === "lasso" && dr.lassoStart) {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const curX = pxToMm(clientX - rect.left, zoom);
        const curY = pxToMm(clientY - rect.top, zoom);
        const lx = Math.min(curX, dr.lassoStart.x);
        const ly = Math.min(curY, dr.lassoStart.y);
        const lw = Math.abs(curX - dr.lassoStart.x);
        const lh = Math.abs(curY - dr.lassoStart.y);
        setLasso({ x: lx, y: ly, w: lw, h: lh });
      }
    };

    const handleEnd = () => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
      }
      if (!dragRef.current?.active) return;
      const dr = dragRef.current;

      if (dr.type === "lasso" && lasso) {
        const inLasso = elements
          .filter(
            (el) =>
              el.x < lasso.x + lasso.w &&
              el.x + el.width > lasso.x &&
              el.y < lasso.y + lasso.h &&
              el.y + el.height > lasso.y
          )
          .map((el) => el.id);
        setSelectedIds(inLasso);
        setLasso(null);
      }

      setGuidelines({ xLines: [], yLines: [] });
      if (dr.type === "move" || dr.type === "resize" || dr.type === "rotate") {
        dispatch({ type: "PUSH_HISTORY" });
      }

      dragRef.current = null;
    };

    const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const onMouseUp = () => handleEnd();

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const onTouchEnd = () => handleEnd();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [zoom, elements, selectedIds, snapGrid, lasso]);

  // ─── Eleman & Şekil Güncellemeleri ─────────────────────────────────────────
  const updateElement = useCallback(
    (id: string, changes: Partial<CanvasElement>) => {
      dispatch({ type: "UPDATE_ELEMENT", id, changes });
    },
    []
  );

  const alignElement = useCallback(
    (
      alignment: "center-h" | "center-v" | "tail" | "left-wing" | "right-wing",
      elId?: string
    ) => {
      const targetId = elId || (selectedIds.length === 1 ? selectedIds[0] : null);
      if (!targetId) return;
      const el = elements.find((e) => e.id === targetId);
      if (!el) return;

      const W = labelConfig.genislikMm;
      const H = labelConfig.yukseklikMm;

      if (alignment === "center-h") {
        updateElement(targetId, { x: Math.max(0, Math.round(((W - el.width) / 2) * 10) / 10) });
      } else if (alignment === "center-v") {
        updateElement(targetId, { y: Math.max(0, Math.round(((H - el.height) / 2) * 10) / 10) });
      } else if (alignment === "tail") {
        let tailStartX = 0;
        let tailW = labelConfig.kuyrukGenislikMm || 35;

        if (labelConfig.etiketSekli === "kuyruklu") {
          const minBodyW = Math.min(8, W * 0.5);
          const tailLen = Math.max(0, Math.min(labelConfig.kuyrukGenislikMm || 35, W - minBodyW));
          tailStartX = W - tailLen;
          tailW = tailLen;
        } else if (
          labelConfig.etiketSekli === "bogumlukuyruk" ||
          labelConfig.etiketSekli === "bogumlukuyrukkeskin"
        ) {
          const rawSolW = Math.max(1, labelConfig.solKanatMm || W / 3);
          const rawSagW = Math.max(1, labelConfig.sagKanatMm || W / 3);
          const rawTailLen = Math.max(0, labelConfig.kuyrukGenislikMm ?? 15);
          const rawTotal = rawSolW + rawSagW + rawTailLen;
          const fitScale = rawTotal > W && rawTotal > 0 ? W / rawTotal : 1;
          tailStartX = (rawSolW + rawSagW) * fitScale;
          tailW = rawTailLen * fitScale;
        } else if (labelConfig.etiketSekli === "dambil" || labelConfig.etiketSekli === "kelebek") {
          const solW = Math.min(labelConfig.solKanatMm || W / 2, W - 2);
          const neckW = labelConfig.kopruGenislikMm !== undefined ? labelConfig.kopruGenislikMm : 8;
          tailStartX = solW - neckW / 2;
          tailW = neckW;
        } else {
          tailStartX = W / 2;
          tailW = W / 2;
        }

        const newX = Math.max(0, Math.round((tailStartX + (tailW - el.width) / 2) * 10) / 10);
        const newY = Math.max(0, Math.round(((H - el.height) / 2) * 10) / 10);
        updateElement(targetId, { x: newX, y: newY });
      } else if (alignment === "left-wing") {
        let wingW = labelConfig.solKanatMm || W / 2;
        if (labelConfig.etiketSekli === "bogumlukuyruk" || labelConfig.etiketSekli === "bogumlukuyrukkeskin") {
          const rawSolW = Math.max(1, labelConfig.solKanatMm || W / 3);
          const rawSagW = Math.max(1, labelConfig.sagKanatMm || W / 3);
          const rawTailLen = Math.max(0, labelConfig.kuyrukGenislikMm ?? 15);
          const rawTotal = rawSolW + rawSagW + rawTailLen;
          const fitScale = rawTotal > W && rawTotal > 0 ? W / rawTotal : 1;
          wingW = rawSolW * fitScale;
        }
        const newX = Math.max(0, Math.round(((wingW - el.width) / 2) * 10) / 10);
        const newY = Math.max(0, Math.round(((H - el.height) / 2) * 10) / 10);
        updateElement(targetId, { x: newX, y: newY });
      } else if (alignment === "right-wing") {
        let startX = labelConfig.solKanatMm || W / 2;
        let wingW = labelConfig.sagKanatMm || W / 2;
        if (labelConfig.etiketSekli === "bogumlukuyruk" || labelConfig.etiketSekli === "bogumlukuyrukkeskin") {
          const rawSolW = Math.max(1, labelConfig.solKanatMm || W / 3);
          const rawSagW = Math.max(1, labelConfig.sagKanatMm || W / 3);
          const rawTailLen = Math.max(0, labelConfig.kuyrukGenislikMm ?? 15);
          const rawTotal = rawSolW + rawSagW + rawTailLen;
          const fitScale = rawTotal > W && rawTotal > 0 ? W / rawTotal : 1;
          startX = rawSolW * fitScale;
          wingW = rawSagW * fitScale;
        }
        const newX = Math.max(0, Math.round((startX + (wingW - el.width) / 2) * 10) / 10);
        const newY = Math.max(0, Math.round(((H - el.height) / 2) * 10) / 10);
        updateElement(targetId, { x: newX, y: newY });
      }
    },
    [elements, labelConfig, selectedIds, updateElement]
  );

  const updateLabelConfig = useCallback(
    (changes: Partial<LabelConfig>, shouldScaleElements: boolean = true) => {
      const oldW = labelConfig.genislikMm;
      const oldH = labelConfig.yukseklikMm;
      const newW = changes.genislikMm !== undefined ? changes.genislikMm : oldW;
      const newH = changes.yukseklikMm !== undefined ? changes.yukseklikMm : oldH;

      const hasDimensionChange =
        (changes.genislikMm !== undefined && changes.genislikMm !== oldW && changes.genislikMm > 0) ||
        (changes.yukseklikMm !== undefined && changes.yukseklikMm !== oldH && changes.yukseklikMm > 0);

      if (shouldScaleElements && hasDimensionChange && oldW > 0 && oldH > 0 && elements.length > 0) {
        const ratioX = newW / oldW;
        const ratioY = newH / oldH;
        // Sadece genişlik ya da sadece yükseklik değiştirildiğinde (ratioX ≠ ratioY) yazı boyutu
        // ortalama oranla küçültülürse kutudan daha yavaş küçülüp komşu elemanların üstüne taşabilir.
        // Bu yüzden metin her zaman EN ÇOK küçülen eksene göre ölçeklenir; böylece kutusuna asla taşmaz.
        const fontRatio = Math.min(ratioX, ratioY);

        // Also scale shape sub-dimensions proportionally if not explicitly provided
        const scaledConfigChanges: Partial<LabelConfig> = { ...changes };
        if (changes.solKanatMm === undefined && labelConfig.solKanatMm) {
          scaledConfigChanges.solKanatMm = Math.round(labelConfig.solKanatMm * ratioX * 10) / 10;
        }
        if (changes.sagKanatMm === undefined && labelConfig.sagKanatMm) {
          scaledConfigChanges.sagKanatMm = Math.round(labelConfig.sagKanatMm * ratioX * 10) / 10;
        }
        if (changes.kopruGenislikMm === undefined && labelConfig.kopruGenislikMm) {
          scaledConfigChanges.kopruGenislikMm = Math.max(1, Math.round(labelConfig.kopruGenislikMm * ratioX * 10) / 10);
        }
        if (changes.kuyrukGenislikMm === undefined && labelConfig.kuyrukGenislikMm) {
          scaledConfigChanges.kuyrukGenislikMm = Math.round(labelConfig.kuyrukGenislikMm * ratioX * 10) / 10;
        }
        if (changes.kuyrukKalinlikMm === undefined && labelConfig.kuyrukKalinlikMm) {
          scaledConfigChanges.kuyrukKalinlikMm = Math.max(1, Math.round(labelConfig.kuyrukKalinlikMm * ratioY * 10) / 10);
        }
        if (changes.kopruYukseklikMm === undefined && labelConfig.kopruYukseklikMm) {
          scaledConfigChanges.kopruYukseklikMm = Math.round(labelConfig.kopruYukseklikMm * ratioY * 10) / 10;
        }

        const scaledElements: CanvasElement[] = elements.map((el) => ({
          ...el,
          x: Math.round(el.x * ratioX * 100) / 100,
          y: Math.round(el.y * ratioY * 100) / 100,
          width: Math.max(0.5, Math.round(el.width * ratioX * 100) / 100),
          height: Math.max(0.5, Math.round(el.height * ratioY * 100) / 100),
          fontSize: el.fontSize ? Math.max(3, Math.round(el.fontSize * fontRatio * 10) / 10) : el.fontSize,
          borderWidth: el.borderWidth ? Math.max(0.2, Math.round(el.borderWidth * fontRatio * 10) / 10) : el.borderWidth,
          borderRadius: el.borderRadius ? Math.round(el.borderRadius * fontRatio * 10) / 10 : el.borderRadius,
        }));

        dispatch({
          type: "LOAD_STATE",
          state: {
            elements: scaledElements,
            labelConfig: { ...labelConfig, ...scaledConfigChanges },
          },
        });
      } else {
        dispatch({ type: "SET_LABEL_CONFIG", config: changes });
      }
    },
    [labelConfig, elements]
  );

  // ─── Boğumlu Kuyruk Şekli: Sol Boğum / Sağ Boğum / Kuyruk Boyu Bağımsız Girişleri ──
  // Her ölçü girildiği gibi (mm bazında) tam olarak uygulanır, diğer ikisi buna ayak
  // uydurmaz; toplam genişlik (genislikMm) bu üçünün toplamına göre EN SON, otomatik
  // olarak yeniden hesaplanır. Yani tasarımı büyültmek/küçültmek için sol/sağ/kuyruktan
  // herhangi birini değiştirmek yeterlidir — Genişlik alanı sadece sonucu gösterir.
  const updateBogumluKuyrukSol = useCallback(
    (v: number) => {
      const sag = labelConfig.sagKanatMm || 0;
      const kuyruk = labelConfig.kuyrukGenislikMm || 0;
      updateLabelConfig({ solKanatMm: v, sagKanatMm: sag, kuyrukGenislikMm: kuyruk, genislikMm: Math.round((v + sag + kuyruk) * 10) / 10 });
    },
    [labelConfig, updateLabelConfig]
  );
  const updateBogumluKuyrukSag = useCallback(
    (v: number) => {
      const sol = labelConfig.solKanatMm || 0;
      const kuyruk = labelConfig.kuyrukGenislikMm || 0;
      updateLabelConfig({ sagKanatMm: v, solKanatMm: sol, kuyrukGenislikMm: kuyruk, genislikMm: Math.round((sol + v + kuyruk) * 10) / 10 });
    },
    [labelConfig, updateLabelConfig]
  );
  const updateBogumluKuyrukKuyruk = useCallback(
    (v: number) => {
      const sol = labelConfig.solKanatMm || 0;
      const sag = labelConfig.sagKanatMm || 0;
      updateLabelConfig({ kuyrukGenislikMm: v, solKanatMm: sol, sagKanatMm: sag, genislikMm: Math.round((sol + sag + v) * 10) / 10 });
    },
    [labelConfig, updateLabelConfig]
  );

  // Yükseklik ekseninde aynı mantık: Kuyruk Kalınlığı ya da Boğum Derinliği, mevcut
  // Yükseklik'e sığmayacak kadar büyütülürse -diğer ölçü sabit kalırken- Yükseklik
  // otomatik olarak (en son) bu değere yetecek kadar büyütülür.
  const updateKuyrukKalinlik = useCallback(
    (v: number) => {
      const neededH = Math.round((v / 0.9) * 10) / 10;
      const newH = Math.max(labelConfig.yukseklikMm, neededH);
      updateLabelConfig({ kuyrukKalinlikMm: v, yukseklikMm: newH });
    },
    [labelConfig, updateLabelConfig]
  );
  const updateBogumDerinlik = useCallback(
    (v: number) => {
      const neededH = Math.round((v * 2 + 1) * 10) / 10;
      const newH = Math.max(labelConfig.yukseklikMm, neededH);
      updateLabelConfig({ bogumDerinlikMm: v, yukseklikMm: newH });
    },
    [labelConfig, updateLabelConfig]
  );

  // ─── Katman Yönetimi (Doğru Sıralama & Katman Değişimi) ─────────────────────
  const reorderLayers = (newOrderedList: CanvasElement[]) => {
    const normalized = newOrderedList.map((el, i) => ({ ...el, zIndex: (i + 1) * 10 }));
    dispatch({ type: "SET_ELEMENTS", elements: normalized });
    dispatch({ type: "PUSH_HISTORY" });
  };

  const bringToFront = (id: string) => {
    const list = [...elements];
    list.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const idx = list.findIndex((e) => e.id === id);
    if (idx !== -1) {
      const [item] = list.splice(idx, 1);
      list.push(item);
      reorderLayers(list);
    }
  };

  const bringForward = (id: string) => {
    const list = [...elements];
    list.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const idx = list.findIndex((e) => e.id === id);
    if (idx !== -1 && idx < list.length - 1) {
      const temp = list[idx];
      list[idx] = list[idx + 1];
      list[idx + 1] = temp;
      reorderLayers(list);
    } else if (idx === list.length - 1) {
      reorderLayers(list);
    }
  };

  const sendBackward = (id: string) => {
    const list = [...elements];
    list.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const idx = list.findIndex((e) => e.id === id);
    if (idx > 0) {
      const temp = list[idx];
      list[idx] = list[idx - 1];
      list[idx - 1] = temp;
      reorderLayers(list);
    } else if (idx === 0) {
      reorderLayers(list);
    }
  };

  const sendToBack = (id: string) => {
    const list = [...elements];
    list.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
    const idx = list.findIndex((e) => e.id === id);
    if (idx !== -1) {
      const [item] = list.splice(idx, 1);
      list.unshift(item);
      reorderLayers(list);
    }
  };

  // ─── Şablon Hızlı & Doğrudan Kaydetme (Ctrl+S / F1) ──────────────────────
  const handleQuickSave = async () => {
    const nameToSave = sablonAdi.trim() || activeSablon?.ad || "";
    if (!nameToSave) {
      setSaveModal(true);
      return;
    }

    // Aynı isimde başka bir şablon olup olmadığını kontrol et (Benzersiz İsim Kontrolü)
    const duplicate = sablonlar.find(
      (s) =>
        s.ad &&
        s.ad.trim().toLowerCase() === nameToSave.toLowerCase() &&
        s.etiketSablonId !== activeSablon?.etiketSablonId
    );
    if (duplicate) {
      alert(`"${nameToSave}" isminde bir şablon zaten mevcut! Lütfen farklı ve benzersiz bir şablon ismi belirleyin.`);
      setSaveModal(true);
      return;
    }

    setLoading(true);
    try {
      const alanlar: EtiketSablonAlan[] = elements.map((el) => ({
        alan: el.fieldKey || el.text || el.type,
        etiketElementTipi: el.type as any,
        x: el.x,
        y: el.y,
        genislik: el.width,
        yukseklik: el.height,
        rotation: el.rotation,
        fontSize: el.fontSize,
        fontFamily: el.fontFamily,
        fontWeight: el.fontWeight,
        fontStyle: el.fontStyle,
        textDecoration: el.textDecoration,
        textAlign: el.textAlign,
        color: el.color,
        backgroundColor: el.backgroundColor,
        borderColor: el.borderColor,
        borderWidth: el.borderWidth,
        borderRadius: el.borderRadius,
        prefix: el.prefix,
        suffix: el.suffix,
        barkodFormat: el.barcodeFormat,
        barcodeFormat: el.barcodeFormat,
        barcodeValue: el.barcodeValue,
        barcodeText: el.barcodeText,
        showBarcodeText: el.showText,
        zIndex: el.zIndex,
        opacity: el.opacity,
        visible: el.visible,
        locked: el.locked,
        iconEmoji: el.iconEmoji,
        text: el.text,
      }));

      // Eğer kayıtlı bir şablon seçilmişse güncelle, yoksa yeni şablon oluştur
      const targetSablonId = activeSablon?.etiketSablonId && activeSablon.etiketSablonId > 0 ? activeSablon.etiketSablonId : null;

      const savedItem = await EtiketService.saveSablon({
        etiketSablonId: targetSablonId,
        ad: nameToSave,
        etiketTipi: labelConfig.etiketTipi,
        genislikMm: labelConfig.genislikMm,
        yukseklikMm: labelConfig.yukseklikMm,
        etiketSekli: labelConfig.etiketSekli,
        solKanatGenislikMm: labelConfig.solKanatMm,
        sagKanatGenislikMm: labelConfig.sagKanatMm,
        kuyrukGenislikMm: labelConfig.kuyrukGenislikMm,
        alanlar,
      });

      await loadSablonlarList();
      setActiveSablon(savedItem);
      setSablonAdi(savedItem.ad);
      setSaveModal(false);
      setSaveStatus("saved");
      setSavedIndicator(true);
      setTimeout(() => {
        setSaveStatus("idle");
        setSavedIndicator(false);
      }, 5000);
    } catch (err: any) {
      console.error("Kaydetme hatası:", err);
      setSaveStatus("error");
      const errText = err?.response?.data?.message || err?.message || "Kayıt sırasında bir hata oluştu!";
      setErrorMessage(errText);
      setErrorPopup({
        show: true,
        title: "Şablon Kayıt Bildirimi",
        message: errText,
      });
      setTimeout(() => {
        setSaveStatus("idle");
        setErrorMessage(null);
      }, 6000);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSaveRef = useRef(handleQuickSave);
  handleQuickSaveRef.current = handleQuickSave;

  const handleSave = handleQuickSave;

  // ─── Kaydet ve Çıktı Al (Tek Tık: Önce Kaydet, Ardından Yazdır) ─────────────
  const handleSaveAndPrint = async () => {
    const nameToSave = sablonAdi.trim() || activeSablon?.ad || "";
    if (!nameToSave) {
      setSaveModal(true);
      return;
    }
    await handleQuickSave();
    handleDirectPrint();
  };

  const handleSaveAndPrintRef = useRef(handleSaveAndPrint);
  handleSaveAndPrintRef.current = handleSaveAndPrint;

  // ─── 15 Saniyede Bir Otomatik Kayıt & Veri Kaybını Önleme ───────────────────
  const autoSaveStateRef = useRef({ elements, labelConfig, sablonAdi, activeSablon });
  useEffect(() => {
    autoSaveStateRef.current = { elements, labelConfig, sablonAdi, activeSablon };
  }, [elements, labelConfig, sablonAdi, activeSablon]);

  const performAutoSave = useCallback(async () => {
    const { elements: currentEls, labelConfig: currentCfg, sablonAdi: currentName, activeSablon: currentSablon } = autoSaveStateRef.current;

    // 1. Tarayıcı LocalStorage Otomatik Yedekleme (Anında ve Kesintisiz)
    try {
      if (currentEls.length > 0) {
        localStorage.setItem(
          "likya_etiket_auto_backup",
          JSON.stringify({
            elements: currentEls,
            labelConfig: currentCfg,
            sablonAdi: currentName,
            activeSablonId: currentSablon?.etiketSablonId || null,
            savedAt: new Date().toISOString(),
          })
        );
      }
    } catch (e) {
      console.warn("LocalStorage auto-save uyarısı:", e);
    }

    // 2. Eğer en az 1 eleman varsa veya aktif şablon varsa veritabanına da sessizce kaydet
    if (currentEls.length > 0 && (currentName.trim() || currentSablon?.etiketSablonId)) {
      try {
        const nameToSave = currentName.trim() || currentSablon?.ad || "Otomatik Tasarım";
        const matchedExisting = sablonlar.find(
          (s) => s.ad && s.ad.trim().toLowerCase() === nameToSave.toLowerCase()
        );
        const targetSablonId = currentSablon?.etiketSablonId || matchedExisting?.etiketSablonId || null;

        const alanlar: EtiketSablonAlan[] = currentEls.map((el) => ({
          alan: el.fieldKey || el.text || el.type,
          etiketElementTipi: el.type as any,
          x: el.x,
          y: el.y,
          genislik: el.width,
          yukseklik: el.height,
          rotation: el.rotation,
          fontSize: el.fontSize,
          fontFamily: el.fontFamily,
          fontWeight: el.fontWeight,
          fontStyle: el.fontStyle,
          textDecoration: el.textDecoration,
          textAlign: el.textAlign,
          color: el.color,
          backgroundColor: el.backgroundColor,
          borderColor: el.borderColor,
          borderWidth: el.borderWidth,
          borderRadius: el.borderRadius,
          prefix: el.prefix,
          suffix: el.suffix,
          barkodFormat: el.barcodeFormat,
          barcodeFormat: el.barcodeFormat,
          barcodeValue: el.barcodeValue,
          barcodeText: el.barcodeText,
          showBarcodeText: el.showText,
          zIndex: el.zIndex,
          opacity: el.opacity,
          visible: el.visible,
          locked: el.locked,
          iconEmoji: el.iconEmoji,
          text: el.text,
        }));

        const savedItem = await EtiketService.saveSablon({
          etiketSablonId: targetSablonId,
          ad: nameToSave,
          etiketTipi: currentCfg.etiketTipi,
          genislikMm: currentCfg.genislikMm,
          yukseklikMm: currentCfg.yukseklikMm,
          etiketSekli: currentCfg.etiketSekli,
          solKanatGenislikMm: currentCfg.solKanatMm,
          sagKanatGenislikMm: currentCfg.sagKanatMm,
          kuyrukGenislikMm: currentCfg.kuyrukGenislikMm,
          alanlar,
        });

        if (savedItem && !currentSablon?.etiketSablonId) {
          setActiveSablon(savedItem);
        }
      } catch (err) {
        // Arka plan otomatik kayıtta kullanıcı akışını kesmeden sessizce devam et
      }
    }
  }, [sablonlar]);

  useEffect(() => {
    const interval = setInterval(() => {
      performAutoSave();
    }, 15000); // 15 saniyede bir periyodik otomatik kayıt

    return () => clearInterval(interval);
  }, [performAutoSave]);

  // Sayfa açılışında yerel taslak yedeği varsa otomatik kurtarma
  useEffect(() => {
    try {
      const backupStr = localStorage.getItem("likya_etiket_auto_backup");
      if (backupStr) {
        const backup = JSON.parse(backupStr);
        if (backup && Array.isArray(backup.elements) && backup.elements.length > 0) {
          if (editorState.present.elements.length === 0) {
            dispatch({
              type: "LOAD_STATE",
              state: {
                elements: backup.elements,
                labelConfig: backup.labelConfig || defaultLabelConfig,
              },
            });
            if (backup.sablonAdi) {
              setSablonAdi(backup.sablonAdi);
            }
          }
        }
      }
    } catch { }
  }, []);

  const handleLoadSablon = (sablon: EtiketSablonItem) => {
    const els: CanvasElement[] = (sablon.alanlar || []).map((alan, i) => ({
      id: genId(),
      type: (alan.type || alan.etiketElementTipi || "text") as ElementType,
      x: alan.x ?? 5,
      y: alan.y ?? 5 + i * 7,
      width: alan.width ?? alan.genislik ?? ((alan.type || alan.etiketElementTipi) === "barcode" ? 25 : 20),
      height: alan.height ?? alan.yukseklik ?? ((alan.type || alan.etiketElementTipi) === "barcode" ? 8 : 5),
      rotation: alan.rotation ?? 0,
      opacity: alan.opacity ?? 1,
      locked: alan.locked ?? false,
      visible: alan.visible ?? true,
      zIndex: alan.zIndex ?? i,
      text: alan.text || alan.customText || alan.ad || alan.alan,
      fieldKey: alan.key || alan.alan,
      prefix: alan.prefix,
      suffix: alan.suffix,
      fontSize: alan.fontSize ?? 8,
      fontFamily: alan.fontFamily ?? "Arial",
      fontWeight: (alan.fontWeight as any) ?? "normal",
      fontStyle: (alan.fontStyle as any) ?? "normal",
      textDecoration: (alan.textDecoration as any) ?? "none",
      textAlign: (alan.textAlign as any) ?? "left",
      color: alan.color ?? "#000000",
      backgroundColor: alan.backgroundColor ?? "transparent",
      borderColor: alan.borderColor ?? "transparent",
      borderWidth: alan.borderWidth ?? 0,
      borderRadius: alan.borderRadius ?? 0,
      barcodeFormat: (alan.barcodeFormat || alan.barkodFormat) as any,
      barcodeValue: alan.barcodeValue,
      barcodeText: alan.barcodeText || alan.customText,
      showText: alan.showBarcodeText ?? alan.showText ?? true,
      iconEmoji: alan.iconEmoji,
      imageData: alan.imageData,
    }));

    dispatch({
      type: "LOAD_STATE",
      state: {
        elements: els,
        labelConfig: {
          etiketTipi: sablon.etiketTipi,
          etiketSekli: sablon.etiketSekli || "kelebek",
          genislikMm: sablon.genislikMm,
          yukseklikMm: sablon.yukseklikMm,
          solKanatMm: sablon.solKanatGenislikMm ?? Math.round(sablon.genislikMm * 0.42 * 10) / 10,
          sagKanatMm: sablon.sagKanatGenislikMm ?? Math.round(sablon.genislikMm * 0.42 * 10) / 10,
          kopruGenislikMm: Math.round(sablon.genislikMm * 0.16 * 10) / 10,
          kopruYukseklikMm: Math.round(sablon.yukseklikMm * 0.8 * 10) / 10,
          kuyrukGenislikMm: sablon.kuyrukGenislikMm ?? 35,
          kuyrukKalinlikMm: 4,
          delikCapiMm: 0,
          delikKonumu: "yok",
          katlamaCizgisi: true,
          bgColor: "#ffffff",
          bgTexture: "beyaz",
        },
      },
    });
    setActiveSablon(sablon);
    setSablonAdi(sablon.ad);
    setSelectedIds([]);
    setDurbunModal(false);
  };

  // ─── Canvas Boyutları ─────────────────────────────────────────────────────
  const canvasW = mmToPx(labelConfig.genislikMm, zoom);
  const canvasH = mmToPx(labelConfig.yukseklikMm, zoom);

  const sortedElements = useMemo(
    () => [...elements].sort((a, b) => a.zIndex - b.zIndex),
    [elements]
  );

  // ─── Eleman İçeriği Render ────────────────────────────────────────────────
  const renderElementContent = (el: CanvasElement, isSelected: boolean) => {
    const isEditing = editingId === el.id;

    if (el.type === "text" || el.type === "field") {
      const isRight = el.textAlign === "right" || el.isNumeric;
      const isCenter = el.textAlign === "center";
      const isDarkPaper = isPreviewMode && selectedPaper.isDark;
      const effectiveTextColor =
        isDarkPaper && (!el.color || el.color === "#000000" || el.color === "#000" || el.color.toLowerCase() === "#111827")
          ? "#f8fafc"
          : el.color || "#000000";

      const textStyle: React.CSSProperties = {
        fontFamily: el.fontFamily || "Arial",
        fontSize: `${mmToPx((el.fontSize || 8) * 0.352778, zoom)}px`,
        fontWeight: el.fontWeight || "normal",
        fontStyle: el.fontStyle || "normal",
        textDecoration: el.textDecoration || "none",
        textTransform: el.textTransform || "none",
        textAlign: isRight ? "right" : isCenter ? "center" : "left",
        color: effectiveTextColor,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: isRight ? "flex-end" : isCenter ? "center" : "flex-start",
        padding: "0 2px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        userSelect: "none",
        background: el.backgroundColor && el.backgroundColor !== "transparent" ? el.backgroundColor : undefined,
      };

      const displayText =
        el.type === "field"
          ? `${el.prefix || ""}${el.text || el.fieldKey || "Alan"}${el.suffix || ""}`
          : el.text || (el.isNumeric ? "0.00" : "Metin");

      if (isEditing) {
        return (
          <input
            ref={inlineInputRef}
            type="text"
            inputMode={el.isNumeric ? "decimal" : "text"}
            className="element-inline-edit"
            autoFocus
            value={el.type === "field" ? (el.text || el.fieldKey || "") : (el.text ?? "")}
            style={{
              fontFamily: el.fontFamily || "Arial",
              fontSize: `${mmToPx((el.fontSize || 8) * 0.352778, zoom)}px`,
              fontWeight: el.fontWeight || "normal",
              color: el.color || "#000",
              textAlign: isRight ? "right" : isCenter ? "center" : "left",
              width: "100%",
              height: "100%",
              boxSizing: "border-box",
              position: "relative",
              zIndex: 100,
            }}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (el.isNumeric) {
                const allowedKeys = [
                  "Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
                  "Tab", "Enter", "Escape", "Home", "End"
                ];
                if (
                  !allowedKeys.includes(e.key) &&
                  !e.ctrlKey &&
                  !e.metaKey &&
                  !/^[0-9.,]$/.test(e.key)
                ) {
                  e.preventDefault();
                }
              }
              if (e.key === "Enter" || e.key === "Escape") {
                (e.target as HTMLInputElement).blur();
              }
              e.stopPropagation();
            }}
            onChange={(e) => {
              let val = e.target.value;
              if (el.isNumeric) {
                val = val.replace(/[^0-9.,]/g, "");
              }
              if (el.type === "field") {
                updateElement(el.id, { text: val, fieldKey: val });
              } else {
                updateElement(el.id, { text: val });
              }
            }}
            onBlur={() => {
              setEditingId(null);
              dispatch({ type: "PUSH_HISTORY" });
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          />
        );
      }

      return (
        <div
          style={textStyle}
          onDoubleClick={(e) => {
            e.stopPropagation();
            dragRef.current = null;
            setSelectedIds([el.id]);
            setEditingId(el.id);
          }}
        >
          <span
            style={{
              width: "100%",
              textAlign: isRight ? "right" : isCenter ? "center" : "left",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {displayText}
          </span>
        </div>
      );
    }



    if (el.type === "barcode") {
      return (
        <BarcodeRenderer
          value={el.barcodeValue || el.text || "123456789"}
          format={el.barcodeFormat || "CODE128"}
          width={mmToPx(el.width, zoom)}
          height={mmToPx(el.height, zoom)}
          barcodeText={el.barcodeText}
          showText={el.showText !== false}
        />
      );
    }

    if (el.type === "qr") {
      return (
        <QRRenderer
          value={el.barcodeValue || el.text || "QR"}
          size={Math.min(mmToPx(el.width, zoom), mmToPx(el.height, zoom))}
        />
      );
    }

    if (el.type === "icon") {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            fontSize: `${mmToPx(el.height * 0.75, zoom)}px`,
            lineHeight: 1,
            color: el.color || "#000",
            fontFamily: "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Segoe UI Symbol',sans-serif",
          } as React.CSSProperties}
        >
          {el.iconEmoji || "⭐"}
        </div>
      );
    }

    if (el.type === "rect" || el.type === "rect-round") {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: el.backgroundColor || "transparent",
            border: `${el.borderWidth || 1}px solid ${el.borderColor || "#000000"}`,
            borderRadius: el.type === "rect-round" ? 4 : (el.borderRadius || 0),
          }}
        />
      );
    }

    if (el.type === "ellipse") {
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: el.backgroundColor || "transparent",
            border: `${el.borderWidth || 1}px solid ${el.borderColor || "#000000"}`,
            borderRadius: "50%",
          }}
        />
      );
    }

    if (el.type === "diamond") {
      return (
        <svg viewBox="0 0 40 40" style={{ width: "100%", height: "100%" }}>
          <polygon
            points="20,2 38,20 20,38 2,20"
            fill={el.backgroundColor || "transparent"}
            stroke={el.borderColor || "#000000"}
            strokeWidth={el.borderWidth || 1}
          />
        </svg>
      );
    }

    if (el.type === "line") {
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
          <div style={{ width: "100%", height: `${el.borderWidth || 1}px`, background: el.borderColor || "#000000" }} />
        </div>
      );
    }

    if (el.type === "line-dashed") {
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
          <div style={{ width: "100%", borderTop: `${el.borderWidth || 1}px dashed ${el.borderColor || "#000000"}` }} />
        </div>
      );
    }

    if (el.type === "line-dotted") {
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
          <div style={{ width: "100%", borderTop: `${el.borderWidth || 1}px dotted ${el.borderColor || "#000000"}` }} />
        </div>
      );
    }

    if (el.type === "line-double") {
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
          <div style={{ width: "100%", borderTop: `3px double ${el.borderColor || "#000000"}` }} />
        </div>
      );
    }

    if (el.type === "line-vertical") {
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center" }}>
          <div style={{ height: "100%", width: `${el.borderWidth || 1}px`, background: el.borderColor || "#000000" }} />
        </div>
      );
    }

    if (el.type === "image" || el.type === "logo") {
      if (el.imageData) {
        return (
          <img
            src={el.imageData}
            alt="Logo/Görsel"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
        );
      }
      return (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "#f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${Math.min(mmToPx(el.height * 0.45, zoom), 12)}px`,
            color: "#475569",
            fontWeight: 700,
            border: "1px dashed #94a3b8",
            borderRadius: 3,
            flexDirection: "column",
            gap: 2,
            cursor: "pointer",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedIds([el.id]);
            imageTargetIdRef.current = el.id;
            imageInputRef.current?.click();
          }}
          title="Fotoğraf Yüklemek İçin Tıklayın"
        >
          <IconPhoto size={14} color="#64748b" />
          <span style={{ fontSize: 8 }}>Fotoğraf Yükle</span>
        </div>
      );
    }

    return <div style={{ width: "100%", height: "100%" }} />;
  };

  // ─── Dürbün Modal Filtrelenmiş Şablonlar ────────────────────────────────────
  const filteredSablonlar = useMemo(() => {
    return sablonlar.filter((s) => {
      const matchText = !durbunFilter || s.ad.toLowerCase().includes(durbunFilter.toLowerCase());
      const matchTip = durbunTipFilter === "all" || s.etiketTipi === durbunTipFilter;
      return matchText && matchTip;
    });
  }, [sablonlar, durbunFilter, durbunTipFilter]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      ref={pageContainerRef}
      className={`label-designer-page ${isFullscreen ? "is-fullscreen" : ""}`}
    >
      {/* ── Mobil Backdrop (Paneller Açıkken Tıklayıp Kapatma) ───────────── */}
      {isCanvaDrawerOpen && (
        <div
          className="mobile-panel-backdrop"
          onClick={() => setIsCanvaDrawerOpen(false)}
        />
      )}

      {/* ── Minimalist & Ferah Üst Bar (Sol: Şablon & Dürbün, Orta: Şablon Bilgisi, Sağ: Kaydet & Çıktı Al) ── */}
      <div className="top-erp-toolbar">
        {/* Sol Alan: Şablonlar (Dürbün - F3), Yeni, Geri Al / Yinele */}
        <div className="top-toolbar-left">
          {/* Dürbün / Şablon Galerisi Butonu (Sol Üstte - F3) */}
          <button
            className="top-action-btn"
            title="Hazır Şablon Galerisi (Dürbün - F3)"
            onClick={() => setDurbunModal(true)}
          >
            <IconBinoculars size={15} />
            <span>Geçmiş</span>
            <span style={{ fontSize: 9.5, background: "rgba(255,255,255,0.2)", padding: "1px 4px", borderRadius: 3, fontWeight: 700, marginLeft: 2 }}>F3</span>
          </button>

          <div className="top-toolbar-divider" />

          <button
            className="top-icon-action-btn"
            title="Yeni Tasarım Başlat (Model Seçimi)"
            onClick={() => {
              if (confirm("Yeni bir tasarıma başlamak istiyor musunuz?")) {
                dispatch({ type: "SET_ELEMENTS", elements: [] });
                setActiveSablon(null);
                setSablonAdi("");
                setShapeModalOpen(true);
              }
            }}
          >
            <IconPlus size={15} />
          </button>

          <button
            className="top-icon-action-btn"
            title="Geri Al (Ctrl+Z)"
            onClick={() => dispatch({ type: "UNDO" })}
            disabled={editorState.past.length === 0}
          >
            <IconArrowBackUp size={15} />
          </button>
          <button
            className="top-icon-action-btn"
            title="Yinele (Ctrl+Y)"
            onClick={() => dispatch({ type: "REDO" })}
            disabled={editorState.future.length === 0}
          >
            <IconArrowForwardUp size={15} />
          </button>
        </div>

        {/* Orta Alan: Küçük Ekranlarda da Bozulmayan Şablon Başlık Rozeti */}
        <div className="top-toolbar-center">
          <div
            className="top-center-template-card"
            onClick={() => {
              setTitleInput(sablonAdi || activeSablon?.ad || "");
              setEditTitleModal(true);
            }}
            title="Şablon İsmini Düzenlemek İçin Tıklayın"
          >
            <span className="tmpl-icon">🏷️</span>
            <span className="tmpl-name">{sablonAdi || activeSablon?.ad || "İsimsiz Şablon"}</span>
            <span className="tmpl-dim">{labelConfig.genislikMm}×{labelConfig.yukseklikMm} mm</span>
            <IconEdit size={12} color="#38bdf8" className="tmpl-edit-icon" />
          </div>
        </div>

        {/* Sağ Alan: Kaydedildi Bildirimi, Yazıcı Ayarları, Çıktı Al, Kaydet (F1) */}
        <div className="top-toolbar-right">
          {/* 5 Saniye Sonra Kaybolan 'Kaydedildi' Rozeti (Yazıcı Ayarları Solunda) */}
          {savedIndicator && (
            <div className="top-saved-toast-badge animate-fadein">
              <IconCheck size={13} />
              <span>Kaydedildi</span>
            </div>
          )}

          <button
            className="top-action-btn"
            title="Yazıcı Kalibrasyon Ayarları"
            onClick={() => setPrinterModalOpen(true)}
          >
            <IconPrinter size={15} />
            <span>Yazıcı Ayarları</span>
          </button>

          {/* Çıktı Al Butonu */}
          <button
            className="top-action-btn"
            style={{ background: "rgba(59, 130, 246, 0.18)", borderColor: "#60a5fa", color: "#93c5fd" }}
            title="Doğrudan Çıktı Al (Ctrl+P)"
            onClick={handleDirectPrint}
          >
            <IconPrinter size={15} />
            <span>Çıktı Al</span>
          </button>

          {/* Normal Kaydet Butonu (F1) */}
          <button
            className="top-print-btn"
            title="Şablonu Kaydet (F1 / Ctrl+S)"
            onClick={handleQuickSave}
            disabled={loading}
          >
            <IconDeviceFloppy size={15} />
            <span>Kaydet</span>
            <span style={{ fontSize: 10, background: "rgba(255,255,255,0.25)", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>F1</span>
          </button>
        </div>
      </div>

      {/* ── Ana Editör Gövdesi ────────────────────────────────────────────── */}
      <div className="label-editor-body">
        {/* ── Canva Tarzı Sol Menü ve Açılır Panel (Canva Icon Rail & Drawer) ── */}
        <div className="canva-sidebar-container">
          {/* Sol Dikey İkon Şeridi */}
          <div className="canva-icon-rail">
            {[
              { id: "templates", label: "Şablonlar", icon: <IconTemplate size={20} /> },
              { id: "elements", label: "Bileşenler", icon: <IconShapes size={20} /> },
              { id: "text", label: "Metin", icon: <IconTypography size={20} /> },
              { id: "brand", label: "Marka", icon: <IconCrown size={20} /> },
              { id: "barcode", label: "Barkod & QR", icon: <IconBarcode size={20} /> },
              { id: "layers", label: "Katmanlar", icon: <IconLayersSubtract size={20} /> },
              { id: "settings", label: "Ayarlar", icon: <IconSettings size={20} /> },
            ].map((item) => {
              const isActive = isCanvaDrawerOpen && canvaCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`canva-rail-btn ${isActive ? "active" : ""}`}
                  title={item.label}
                  onClick={() => {
                    if (canvaCategory === item.id && isCanvaDrawerOpen) {
                      setIsCanvaDrawerOpen(false);
                    } else {
                      setCanvaCategory(item.id as any);
                      setIsCanvaDrawerOpen(true);
                    }
                  }}
                >
                  <div className="rail-icon">{item.icon}</div>
                  <span className="rail-label">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Açılır Çekmece Panel */}
          {isCanvaDrawerOpen && (
            <div className="canva-drawer animate-fadein">
              <div className="canva-drawer-header">
                <div className="canva-drawer-title">
                  {canvaCategory === "templates" && <><span>📂</span> Şablonlar</>}
                  {canvaCategory === "elements" && <><span>🔷</span> Bileşenler & Şekiller</>}
                  {canvaCategory === "text" && <><span>📝</span> Metin & Alanlar</>}
                  {canvaCategory === "brand" && <><span>👑</span> Marka & Damgalar</>}
                  {canvaCategory === "barcode" && <><span>📊</span> Barkod & QR</>}
                  {canvaCategory === "layers" && <><span>📑</span> Katmanlar ({elements.length})</>}
                  {canvaCategory === "settings" && <><span>⚙️</span> Etiket & Yazıcı Ayarları</>}
                </div>
                <button
                  type="button"
                  className="canva-drawer-close"
                  title="Paneli Kapat"
                  onClick={() => setIsCanvaDrawerOpen(false)}
                >
                  <IconX size={16} />
                </button>
              </div>

              <div className="canva-drawer-content">
                {/* ── 1. ŞABLONLAR KATEGORİSİ ── */}
                {canvaCategory === "templates" && (
                  <>
                    <div className="panel-section-title">
                      <span>📂 Şablon Ara & Keşfet</span>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <input
                        type="text"
                        className="toolbar-input"
                        style={{ width: "100%", padding: "5px 8px", fontSize: 11.5 }}
                        placeholder="Şablon veya model ara..."
                        value={templateFilterQuery}
                        onChange={(e) => setTemplateFilterQuery(e.target.value)}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                      <button
                        className="elem-btn"
                        style={{ flex: 1, padding: "7px 8px", background: "rgba(56, 189, 248, 0.12)", borderColor: "rgba(56, 189, 248, 0.4)", color: "#0284c7" }}
                        onClick={() => setDurbunModal(true)}
                      >
                        <IconBinoculars size={14} color="#0284c7" />
                        <span style={{ fontWeight: 700, fontSize: 11 }}>Kayıtlı Şablonlar</span>
                      </button>
                      <button
                        className="elem-btn"
                        style={{ flex: 1, padding: "7px 8px" }}
                        onClick={() => {
                          if (confirm("Yeni bir tasarıma başlamak istiyor musunuz?")) {
                            dispatch({ type: "SET_ELEMENTS", elements: [] });
                            setActiveSablon(null);
                            setSablonAdi("");
                            setShapeModalOpen(true);
                          }
                        }}
                      >
                        <IconPlus size={14} />
                        <span style={{ fontWeight: 600, fontSize: 11 }}>+ Yeni Tasarım</span>
                      </button>
                    </div>

                    <div className="panel-section-title">
                      <span>⭐ Sektörel Hazır Şablonlar ({BUILTIN_TEMPLATES.length})</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                      {BUILTIN_TEMPLATES
                        .filter((tmpl) => !templateFilterQuery || tmpl.ad.toLowerCase().includes(templateFilterQuery.toLowerCase()) || tmpl.kategori.toLowerCase().includes(templateFilterQuery.toLowerCase()))
                        .map((tmpl) => (
                          <div
                            key={tmpl.id}
                            className="elem-btn"
                            style={{
                              flexDirection: "column",
                              alignItems: "stretch",
                              padding: "8px 10px",
                              gap: 4,
                              cursor: "pointer",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: 6,
                            }}
                            onClick={() => {
                              updateLabelConfig(tmpl.config, false);
                              const newElements = tmpl.elements.map((el, i) => ({
                                id: genId(),
                                type: el.type,
                                x: el.x,
                                y: el.y,
                                width: el.width,
                                height: el.height,
                                rotation: el.rotation || 0,
                                text: el.text || "",
                                fieldKey: el.fieldKey,
                                barcodeFormat: el.barcodeFormat,
                                barcodeValue: el.barcodeValue,
                                imageData: el.imageData,
                                fontSize: el.fontSize || 8,
                                fontWeight: el.fontWeight || "normal",
                                fontStyle: el.fontStyle || "normal",
                                textDecoration: el.textDecoration || "none",
                                color: el.color || "#000000",
                                textAlign: el.textAlign || "left",
                                fontFamily: "Arial",
                                zIndex: i + 1,
                                visible: true,
                                locked: false,
                              }));
                              dispatch({ type: "SET_ELEMENTS", elements: newElements as any });
                              setSelectedIds([]);
                              setSablonAdi("");
                              setActiveSablon(null);
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontSize: 16 }}>{tmpl.icon}</span>
                                <span style={{ fontWeight: 700, fontSize: 11.5, color: "#0f172a" }}>{tmpl.ad}</span>
                              </div>
                              <span style={{ fontSize: 8.5, background: "rgba(56,189,248,0.15)", color: "#0369a1", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>
                                {tmpl.kategori}
                              </span>
                            </div>
                            <div style={{ fontSize: 9.5, color: "#64748b", lineHeight: 1.25 }}>{tmpl.aciklama}</div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, color: "#94a3b8", marginTop: 3 }}>
                              <span>{tmpl.config.genislikMm}×{tmpl.config.yukseklikMm} mm ({tmpl.elements.length} alan)</span>
                              <span style={{ color: "#059669", fontWeight: 700 }}>Tıkla ve Yükle →</span>
                            </div>
                          </div>
                        ))}
                    </div>

                    <div className="panel-section-title">
                      <span>💾 Kayıtlı Şablonlarınız ({sablonlar.length})</span>
                    </div>
                    {loading ? (
                      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", padding: "10px 0" }}>Yükleniyor...</div>
                    ) : sablonlar.length === 0 ? (
                      <div style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "center", padding: "10px 0" }}>Henüz kayıtlı şablon bulunmuyor.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {sablonlar
                          .filter((s) => !templateFilterQuery || (s.ad || "").toLowerCase().includes(templateFilterQuery.toLowerCase()))
                          .map((s) => (
                            <div
                              key={s.etiketSablonId}
                              className="elem-btn"
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "6px 8px",
                                background: activeSablon?.etiketSablonId === s.etiketSablonId ? "#ecfdf5" : "#f8fafc",
                                borderColor: activeSablon?.etiketSablonId === s.etiketSablonId ? "#10b981" : "#e2e8f0",
                                cursor: "pointer",
                              }}
                              onClick={() => handleLoadSablon(s)}
                            >
                              <div style={{ textAlign: "left", flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 11, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {s.ad}
                                </div>
                                <div style={{ fontSize: 9, color: "#64748b" }}>
                                  {s.genislikMm}×{s.yukseklikMm} mm • {s.etiketSekli}
                                </div>
                              </div>
                              <button
                                style={{ background: "none", border: "none", color: "#ef4444", padding: "2px 6px", cursor: "pointer" }}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`"${s.ad}" şablonunu silmek istediğinize emin misiniz?`)) {
                                    try {
                                      await EtiketService.deleteSablon(s.etiketSablonId);
                                      if (activeSablon?.etiketSablonId === s.etiketSablonId) {
                                        setActiveSablon(null);
                                        setSablonAdi("");
                                      }
                                      loadSablonlarList();
                                    } catch (err: any) {
                                      alert("Şablon silinemedi: " + (err?.message || ""));
                                    }
                                  }
                                }}
                                title="Şablonu Sil"
                              >
                                <IconTrash size={12} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </>
                )}

                {/* ── 2. BİLEŞENLER & ŞEKİLLER KATEGORİSİ ── */}
                {canvaCategory === "elements" && (
                  <>
                    <div className="panel-section-title">
                      <span>🔷 Geometrik Şekiller</span>
                      <span className="drag-hint-pill">Tıkla / Sürükle</span>
                    </div>
                    <div className="shapes-grid" style={{ marginBottom: 14 }}>
                      {SHAPE_PRESETS.map((s) => {
                        const shapeData = {
                          type: s.type,
                          backgroundColor: "transparent",
                          borderColor: "#000000",
                          borderWidth: 1,
                          width: s.w,
                          height: s.h,
                        };
                        return (
                          <button
                            key={s.type}
                            className="shape-item-btn"
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/json", JSON.stringify(shapeData));
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => addElement(shapeData as any)}
                          >
                            <span className="shape-item-icon">{s.icon}</span>
                            <span className="shape-item-label">{s.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="panel-section-title">
                      <span>⭐ Kuyumcu İkonları & Semboller</span>
                    </div>
                    <div className="icons-grid" style={{ marginBottom: 14 }}>
                      {ICON_PRESETS.map((ic) => {
                        const iconData = { type: "icon", iconName: ic.name, iconEmoji: ic.emoji, width: 8, height: 8 };
                        return (
                          <button
                            key={ic.name}
                            className="icon-item-btn"
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/json", JSON.stringify(iconData));
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => addElement(iconData as any)}
                          >
                            <span className="icon-item-emoji">{ic.emoji}</span>
                            <span className="icon-item-label">{ic.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="elem-btn"
                      style={{
                        width: "100%",
                        background: "#f0fdf4",
                        borderColor: "#86efac",
                        color: "#166534",
                        padding: "8px 10px",
                        marginTop: 6,
                      }}
                      onClick={() => setShapeModalOpen(true)}
                    >
                      <div className="elem-btn-icon"><IconShapes size={15} color="#166534" /></div>
                      <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 11.5 }}>📐 Boyut & Model Modalı</div>
                        <div style={{ fontSize: 9, color: "#4b5563" }}>Kelebek, Kuyruklu, Dambıl ölçüleri</div>
                      </div>
                    </button>
                  </>
                )}

                {/* ── 3. METİN & VERİTABANI KATEGORİSİ ── */}
                {canvaCategory === "text" && (
                  <>
                    <div className="panel-section-title">
                      <span>📝 Metin & Sayı Alanları</span>
                      <span className="drag-hint-pill">Tıkla / Sürükle</span>
                    </div>

                    {/* Serbest Metin */}
                    <button
                      className="elem-btn"
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({ type: "text", text: "Yeni Metin", fontSize: 8, color: "#000000", textAlign: "left", width: 22, height: 4.5 })
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addElement({ type: "text", text: "Yeni Metin", fontSize: 8, color: "#000000", textAlign: "left", width: 22, height: 4.5 })}
                    >
                      <div className="elem-btn-icon"><IconTypography size={14} /></div>
                      <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>Serbest Metin</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>Sola hizalı açıklama metni</div>
                      </div>
                    </button>

                    {/* Sayı Alanı */}
                    <button
                      className="elem-btn"
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({
                            type: "text",
                            isNumeric: true,
                            text: "0.00",
                            fontSize: 8.5,
                            fontWeight: "bold",
                            color: "#000000",
                            textAlign: "right",
                            width: 18,
                            height: 4.5,
                          })
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() =>
                        addElement({
                          type: "text",
                          isNumeric: true,
                          text: "0.00",
                          fontSize: 8.5,
                          fontWeight: "bold",
                          color: "#000000",
                          textAlign: "right",
                          width: 18,
                          height: 4.5,
                        })
                      }
                    >
                      <div className="elem-btn-icon" style={{ fontSize: 13, fontWeight: 700, color: "#0284c7" }}>#</div>
                      <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>Sayı Alanı (Sağa Dayalı)</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>Gram, Fiyat, Sayı değerleri</div>
                      </div>
                    </button>

                    {/* Veritabanı ERP Alanı Ekle Modalı */}
                    <button
                      className="elem-btn"
                      style={{
                        background: "rgba(56, 189, 248, 0.12)",
                        borderColor: "rgba(56, 189, 248, 0.4)",
                        color: "#0284c7",
                        padding: "7px 10px",
                        marginTop: 4,
                      }}
                      onClick={() => setFieldsModalOpen(true)}
                    >
                      <div className="elem-btn-icon"><IconDatabase size={14} color="#0284c7" /></div>
                      <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ fontWeight: 700, color: "#0284c7" }}>+ ERP / Veritabanı Alanı Seç</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>Gram, Ayar, Fiyat, Barkod, RFID</div>
                      </div>
                    </button>

                    <div className="panel-section-title" style={{ marginTop: 14 }}>
                      <span>⚡ Hızlı Veri Alanları (Tek Tık)</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
                      {[
                        { key: "URUN_ADI", label: "Ürün Adı", sample: "Tektaş Yüzük", w: 25, h: 4.5 },
                        { key: "BARKOD", label: "Barkod No", sample: "86900012345", w: 22, h: 4.5 },
                        { key: "GRAM", label: "Gram", sample: "4.85 gr", w: 16, h: 4.5, isNumeric: true },
                        { key: "AYAR", label: "Ayar", sample: "14K", w: 12, h: 4.5 },
                        { key: "FIYAT", label: "Satış Fiyatı", sample: "12.500 ₺", w: 20, h: 4.5, isNumeric: true },
                        { key: "TARIH", label: "Tarih", sample: "25.09.2026", w: 18, h: 4 },
                        { key: "MILYEM", label: "Milyem", sample: "585", w: 12, h: 4.5 },
                        { key: "OZEL_KOD", label: "Özel Kod", sample: "YZ-001", w: 16, h: 4 },
                      ].map((f) => (
                        <button
                          key={f.key}
                          className="elem-btn"
                          style={{ padding: "5px 6px", fontSize: 10, justifyContent: "flex-start", gap: 5 }}
                          onClick={() =>
                            addElement({
                              type: "field",
                              fieldKey: f.key,
                              text: f.sample,
                              fontSize: 8,
                              fontWeight: "bold",
                              color: "#000000",
                              textAlign: f.isNumeric ? "right" : "left",
                              width: f.w,
                              height: f.h,
                            })
                          }
                        >
                          <span style={{ fontSize: 11 }}>🏷️</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {/* ── 4. MARKA & DAMGALAR KATEGORİSİ ── */}
                {canvaCategory === "brand" && (
                  <>
                    <div className="panel-section-title">
                      <span>📷 Fotoğraf & Logo Yükle</span>
                    </div>
                    <input
                      type="file"
                      ref={imageInputRef}
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: "none" }}
                    />
                    <button
                      className="elem-btn"
                      style={{
                        background: "linear-gradient(135deg, rgba(14,165,233,0.12), rgba(99,102,241,0.12))",
                        borderColor: "rgba(56,189,248,0.4)",
                        color: "#0284c7",
                        padding: "8px 10px",
                        width: "100%",
                      }}
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <div className="elem-btn-icon"><IconUpload size={16} color="#0284c7" /></div>
                      <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 11.5 }}>Fotoğraf / Logo Seç</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>PNG, JPG, SVG veya Damga Görseli</div>
                      </div>
                    </button>

                    <input
                      type="file"
                      ref={logoUploadInputRef}
                      accept="image/*,.svg"
                      onChange={handleUploadDbLogo}
                      style={{ display: "none" }}
                    />

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "14px 0 6px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Kayıtlı Damgalar & Logolar
                      </span>
                      <button
                        className="btn btn-xs btn-outline-info"
                        style={{ fontSize: 9.5, padding: "2px 8px", borderRadius: 4, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}
                        onClick={() => logoUploadInputRef.current?.click()}
                        title="Veritabanına yeni damga/logo yükle"
                      >
                        <IconUpload size={11} />
                        <span>+ Yükle</span>
                      </button>
                    </div>

                    {loadingDbLogolar ? (
                      <div style={{ fontSize: 10, color: "#94a3b8", padding: "6px 4px", textAlign: "center" }}>Logolar yükleniyor...</div>
                    ) : dbLogolar.length > 0 ? (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                          {dbLogolar.map((lg) => {
                            const logoData = {
                              type: "image",
                              imageData: lg.dataUrl,
                              width: 14,
                              height: 8,
                              text: lg.dosyaAdi,
                            };
                            return (
                              <div
                                key={lg.fotografId}
                                className="elem-btn"
                                style={{ position: "relative", padding: "5px 6px", fontSize: 9.5, gap: 5, cursor: "pointer" }}
                                draggable={true}
                                onDragStart={(e) => {
                                  e.dataTransfer.setData("application/json", JSON.stringify(logoData));
                                  e.dataTransfer.effectAllowed = "copy";
                                }}
                                onClick={() => addElement(logoData as any)}
                                title={`${lg.dosyaAdi} (Kayıtlı Logo)`}
                              >
                                <img src={lg.dataUrl} alt={lg.dosyaAdi} style={{ width: 18, height: 14, objectFit: "contain", flexShrink: 0, borderRadius: 2 }} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>
                                  {lg.dosyaAdi}
                                </span>
                                <button
                                  style={{ background: "none", border: "none", color: "#ef4444", padding: "0 2px", cursor: "pointer", fontSize: 12, lineHeight: 1 }}
                                  onClick={(e) => handleDeleteDbLogo(lg.fotografId, e)}
                                  title="Bu logoyu veritabanından sil"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", margin: "10px 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      ⭐ Standart Altın / Gümüş Damgaları:
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      {JEWELRY_LOGOS.map((lg) => {
                        const logoData = {
                          type: "image",
                          imageData: lg.dataUrl,
                          width: 14,
                          height: 8,
                          text: lg.name,
                        };
                        return (
                          <button
                            key={lg.id}
                            className="elem-btn"
                            style={{ padding: "5px 6px", fontSize: 9.5, gap: 5 }}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/json", JSON.stringify(logoData));
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => addElement(logoData as any)}
                            title={lg.name}
                          >
                            <img src={lg.dataUrl} alt={lg.name} style={{ width: 18, height: 14, objectFit: "contain", flexShrink: 0, borderRadius: 2 }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {lg.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* ── 5. BARKOD & QR KATEGORİSİ ── */}
                {canvaCategory === "barcode" && (
                  <>
                    <div className="panel-section-title">
                      <span>📊 Barkod & Kodlar</span>
                      <span className="drag-hint-pill">Tıkla / Sürükle</span>
                    </div>

                    <button
                      className="elem-btn"
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({ type: "barcode", barcodeFormat: "CODE128", barcodeValue: "123456789", width: 28, height: 9 })
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addElement({ type: "barcode", barcodeFormat: "CODE128", barcodeValue: "123456789", width: 28, height: 9 })}
                    >
                      <div className="elem-btn-icon"><IconBarcode size={14} /></div>
                      <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>Barkod (Code128)</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>Kuyumcu ve Sarrafiye standardı</div>
                      </div>
                    </button>

                    <button
                      className="elem-btn"
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({ type: "barcode", barcodeFormat: "EAN13", barcodeValue: "8691234567890", width: 28, height: 9 })
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addElement({ type: "barcode", barcodeFormat: "EAN13", barcodeValue: "8691234567890", width: 28, height: 9 })}
                    >
                      <div className="elem-btn-icon"><IconBarcode size={14} /></div>
                      <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>Barkod (EAN-13)</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>13 Haneli Uluslararası Barkod</div>
                      </div>
                    </button>

                    <button
                      className="elem-btn"
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({ type: "qr", barcodeFormat: "QR", barcodeValue: "QR", width: 14, height: 14 })
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addElement({ type: "qr", barcodeFormat: "QR", barcodeValue: "QR", width: 14, height: 14 })}
                    >
                      <div className="elem-btn-icon"><IconQrcode size={14} /></div>
                      <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>QR Kod</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>Karekod link veya ürün verisi</div>
                      </div>
                    </button>

                    <button
                      className="elem-btn"
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/json",
                          JSON.stringify({ type: "rfid", barcodeFormat: "RFID", barcodeValue: "RFID", width: 20, height: 8 })
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => addElement({ type: "rfid", barcodeFormat: "RFID", barcodeValue: "RFID", width: 20, height: 8 })}
                    >
                      <div className="elem-btn-icon"><IconWifi size={14} /></div>
                      <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>RFID / EPC Alanı</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>Radyo frekanslı çipli etiket</div>
                      </div>
                    </button>
                  </>
                )}

                {/* ── 6. KATMANLAR KATEGORİSİ ── */}
                {canvaCategory === "layers" && (
                  <>
                    <div className="panel-section-title">
                      <span>Katman Sırası ({elements.length} nesne)</span>
                    </div>

                    {elements.length === 0 && (
                      <div style={{ color: "#64748b", fontSize: 11.5, textAlign: "center", padding: "20px 0" }}>
                        Tuvalde henüz nesne yok
                      </div>
                    )}

                    {[...elements].sort((a, b) => b.zIndex - a.zIndex).map((el) => (
                      <div
                        key={el.id}
                        className={`layer-item ${selectedIds.includes(el.id) ? "selected" : ""}`}
                        onClick={(e) => {
                          if (e.shiftKey) {
                            setSelectedIds((prev) =>
                              prev.includes(el.id) ? prev.filter((x) => x !== el.id) : [...prev, el.id]
                            );
                          } else {
                            setSelectedIds([el.id]);
                          }
                        }}
                      >
                        <IconGripVertical size={11} style={{ color: "#64748b", flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {el.type === "field" ? (el.text || el.fieldKey || "Alan") : el.type === "text" ? el.text : el.type}
                        </span>
                        <button
                          className={`layer-icon-btn ${el.visible ? "active" : ""}`}
                          title="Görünürlük"
                          onClick={(e) => { e.stopPropagation(); updateElement(el.id, { visible: !el.visible }); }}
                        >
                          {el.visible ? <IconEye size={12} /> : <IconEyeOff size={12} />}
                        </button>
                        <button
                          className={`layer-icon-btn ${el.locked ? "active" : ""}`}
                          title="Kilitle"
                          onClick={(e) => { e.stopPropagation(); updateElement(el.id, { locked: !el.locked }); }}
                        >
                          {el.locked ? <IconLock size={12} /> : <IconLockOpen size={12} />}
                        </button>
                        <button
                          className="layer-icon-btn"
                          title="Sil"
                          style={{ color: "#f87171" }}
                          onClick={(e) => { e.stopPropagation(); dispatch({ type: "DELETE_ELEMENTS", ids: [el.id] }); setSelectedIds((p) => p.filter((x) => x !== el.id)); }}
                        >
                          <IconTrash size={11} />
                        </button>
                      </div>
                    ))}
                  </>
                )}

                {/* ── 7. AYARLAR & YAZICI KATEGORİSİ ── */}
                {canvaCategory === "settings" && (
                  <>
                    <div className="panel-section-title">
                      <span>🖨️ Yazıcı Kalibrasyonu</span>
                    </div>
                    <button
                      type="button"
                      className="btn-open-printer-modal"
                      style={{ marginBottom: 14 }}
                      onClick={() => setPrinterModalOpen(true)}
                    >
                      <IconPrinter size={15} />
                      <span>Yazıcı Ayarları & Kalibrasyon Modalı</span>
                    </button>

                    <div className="panel-section-title">
                      <span>📐 Etiket Modeli & Boyutu</span>
                    </div>
                    <div className="prop-row">
                      <span className="prop-label">Model:</span>
                      <select
                        className="prop-input"
                        value={labelConfig.etiketSekli}
                        onChange={(e) => updateLabelConfig({ etiketSekli: e.target.value as any })}
                      >
                        {ETIKET_SEKILLERI.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.icon} {s.ad}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="prop-row">
                      <span className="prop-label">Genişlik:</span>
                      <input
                        type="number"
                        className="prop-input"
                        key={`en-model-${labelConfig.genislikMm}`}
                        defaultValue={labelConfig.genislikMm}
                        step={1}
                        min={5}
                        max={300}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!isNaN(v) && v > 0) updateLabelConfig({ genislikMm: v });
                          else e.target.value = String(labelConfig.genislikMm);
                        }}
                      />
                      <span style={{ fontSize: 9, color: "#64748b" }}>mm</span>
                    </div>
                    <div className="prop-row">
                      <span className="prop-label">Yükseklik:</span>
                      <input
                        type="number"
                        className="prop-input"
                        key={`boy-model-${labelConfig.yukseklikMm}`}
                        defaultValue={labelConfig.yukseklikMm}
                        step={1}
                        min={3}
                        max={200}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!isNaN(v) && v > 0) updateLabelConfig({ yukseklikMm: v });
                          else e.target.value = String(labelConfig.yukseklikMm);
                        }}
                      />
                      <span style={{ fontSize: 9, color: "#64748b" }}>mm</span>
                    </div>

                    {(labelConfig.etiketSekli === "bogumlukuyruk" || labelConfig.etiketSekli === "bogumlukuyrukkeskin" || labelConfig.etiketSekli === "kuyruklu" || labelConfig.etiketSekli === "kelebek") && (
                      <>
                        <div className="prop-row">
                          <span className="prop-label">Sol Kanat:</span>
                          <input
                            type="number"
                            className="prop-input"
                            value={labelConfig.solKanatMm ?? 28}
                            step={0.5}
                            min={1}
                            max={150}
                            onChange={(e) => updateLabelConfig({ solKanatMm: Number(e.target.value) || 1 })}
                          />
                          <span style={{ fontSize: 9, color: "#64748b" }}>mm</span>
                        </div>

                        <div className="prop-row">
                          <span className="prop-label">Sağ Kanat:</span>
                          <input
                            type="number"
                            className="prop-input"
                            value={labelConfig.sagKanatMm ?? 28}
                            step={0.5}
                            min={1}
                            max={150}
                            onChange={(e) => updateLabelConfig({ sagKanatMm: Number(e.target.value) || 1 })}
                          />
                          <span style={{ fontSize: 9, color: "#64748b" }}>mm</span>
                        </div>

                        <div className="prop-row">
                          <span className="prop-label">Boğum Derinlik:</span>
                          <input
                            type="number"
                            className="prop-input"
                            value={labelConfig.bogumDerinlikMm ?? 2.0}
                            step={0.2}
                            min={0}
                            max={25}
                            onChange={(e) => updateLabelConfig({ bogumDerinlikMm: Number(e.target.value) || 0 })}
                          />
                          <span style={{ fontSize: 9, color: "#64748b" }}>mm</span>
                        </div>

                        <div className="prop-row">
                          <span className="prop-label">Kuyruk Boyu:</span>
                          <input
                            type="number"
                            className="prop-input"
                            value={labelConfig.kuyrukGenislikMm ?? 35}
                            step={0.5}
                            min={1}
                            max={200}
                            onChange={(e) => updateLabelConfig({ kuyrukGenislikMm: Number(e.target.value) || 1 })}
                          />
                          <span style={{ fontSize: 9, color: "#64748b" }}>mm</span>
                        </div>

                        <div className="prop-row">
                          <span className="prop-label">Kuyruk Kalınlık:</span>
                          <input
                            type="number"
                            className="prop-input"
                            value={labelConfig.kuyrukKalinlikMm ?? 4}
                            step={0.5}
                            min={1}
                            max={40}
                            onChange={(e) => updateLabelConfig({ kuyrukKalinlikMm: Number(e.target.value) || 1 })}
                          />
                          <span style={{ fontSize: 9, color: "#64748b" }}>mm</span>
                        </div>
                      </>
                    )}

                    <button
                      type="button"
                      className="elem-btn"
                      style={{
                        width: "100%",
                        background: "rgba(56, 189, 248, 0.12)",
                        borderColor: "rgba(56, 189, 248, 0.4)",
                        color: "#0284c7",
                        padding: "7px 10px",
                        margin: "8px 0 14px",
                      }}
                      onClick={() => setShapeModalOpen(true)}
                    >
                      <div className="elem-btn-icon"><IconShapes size={14} color="#0284c7" /></div>
                      <div style={{ textAlign: "left", flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 11 }}>Tüm Model Ölçülerini Düzenle</div>
                        <div style={{ fontSize: 9, color: "#64748b" }}>Görsel model seçimi ve detay ayarları</div>
                      </div>
                    </button>

                    <div className="panel-section-title">
                      <span>🎨 Kart Rengi & Çizgiler</span>
                    </div>
                    <label className="small-form-check" style={{ marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={labelConfig.katlamaCizgisi}
                        onChange={(e) => updateLabelConfig({ katlamaCizgisi: e.target.checked })}
                      />
                      <span>Katlama Çizgisi</span>
                    </label>
                    <div className="prop-row" style={{ marginBottom: 14 }}>
                      <span className="prop-label">Renk:</span>
                      <div className="color-swatch" style={{ background: labelConfig.bgColor }} title="Kart Rengi">
                        <input
                          type="color"
                          value={labelConfig.bgColor}
                          onChange={(e) => updateLabelConfig({ bgColor: e.target.value })}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: "#64748b", marginLeft: 4 }}>{labelConfig.bgColor}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Orta Aydınlık Kanvas Çalışma Alanı (Figma / Canva Grid) ───── */}
        <div className="canvas-area">
          {/* ── En Üstte Açılan Tam Genişlikteki Ayar & Müfettiş Çubuğu (Kaydırmasız) ── */}
          {!isPreviewMode && (selectedElement || isLabelSelected) && (
            <div className="canvas-fullwidth-subbar-container animate-fadein">
              {/* Şablon Zeminine Tıklanmışsa: Canva Tarzı Şablon Geometri & Ölçü Çubuğu */}
              {!selectedElement && isLabelSelected && (
                <div className="canvas-fullwidth-geometry-bar">
                  <div className="geom-title-badge" title="Aktif Şablon Modeli">
                    <span>🏷️</span>
                    <span>{sablonAdi || activeSablon?.ad || "Şablon Ayarları"}</span>
                  </div>

                  {/* Toplam Genişlik ve Yükseklik */}
                  <div className="geom-field-group" title="Toplam Genişlik (mm)">
                    <span className="geom-label">Genişlik:</span>
                    <input
                      type="number"
                      className="geom-input"
                      value={labelConfig.genislikMm}
                      min={5}
                      max={300}
                      step={0.5}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) updateLabelConfig({ genislikMm: v });
                      }}
                    />
                    <span className="geom-unit">mm</span>
                  </div>

                  <div className="geom-field-group" title="Toplam Yükseklik (mm)">
                    <span className="geom-label">Yükseklik:</span>
                    <input
                      type="number"
                      className="geom-input"
                      value={labelConfig.yukseklikMm}
                      min={4}
                      max={200}
                      step={0.5}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0) updateLabelConfig({ yukseklikMm: v });
                      }}
                    />
                    <span className="geom-unit">mm</span>
                  </div>

                  {/* Köşe Yuvarlatma (R - mm) */}
                  <div className="geom-field-group" title="Köşe Yuvarlaklığı / Radyus (mm)">
                    <span className="geom-label">Köşe R:</span>
                    <input
                      type="number"
                      className="geom-input"
                      value={labelConfig.koseYuvarlikligiMm || 0}
                      min={0}
                      max={30}
                      step={0.5}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v >= 0) updateLabelConfig({ koseYuvarlikligiMm: v });
                      }}
                    />
                    <span className="geom-unit">mm</span>
                  </div>

                  <div className="geom-divider" />

                  {/* Boğumlu Kuyruk & Keskin Boğumlu Kuyruk Alanları */}
                  {(labelConfig.etiketSekli === "bogumlukuyruk" || labelConfig.etiketSekli === "bogumlukuyrukkeskin") && (
                    <>
                      <div className="geom-field-group" title="Sol Kanat Genişliği (mm)">
                        <span className="geom-label">Sol Kanat:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.solKanatMm ?? 28}
                          min={1}
                          max={150}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateBogumluKuyrukSol(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>

                      <div className="geom-field-group" title="Sağ Kanat Genişliği (mm)">
                        <span className="geom-label">Sağ Kanat:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.sagKanatMm ?? 28}
                          min={1}
                          max={150}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateBogumluKuyrukSag(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>

                      <div className="geom-field-group" title="Boğum Derinliği (mm)">
                        <span className="geom-label">Boğum:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.bogumDerinlikMm ?? 2.0}
                          min={0}
                          max={20}
                          step={0.2}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= 0) updateBogumDerinlik(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>

                      <div className="geom-field-group" title="Kuyruk Uzunluğu (mm)">
                        <span className="geom-label">Kuyruk:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.kuyrukGenislikMm ?? 35}
                          min={1}
                          max={200}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateBogumluKuyrukKuyruk(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>

                      <div className="geom-field-group" title="Kuyruk Kalınlığı (mm)">
                        <span className="geom-label">Kuyruk Kalınlık:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.kuyrukKalinlikMm ?? 4}
                          min={1}
                          max={30}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateKuyrukKalinlik(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>
                    </>
                  )}

                  {/* Kuyruklu (Kordon/İpli) Alanları */}
                  {labelConfig.etiketSekli === "kuyruklu" && (
                    <>
                      <div className="geom-field-group" title="Gövde / Sol Kanat Genişliği (mm)">
                        <span className="geom-label">Gövde:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.solKanatMm ?? 28}
                          min={1}
                          max={150}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateBogumluKuyrukSol(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>

                      <div className="geom-field-group" title="Kuyruk Uzunluğu (mm)">
                        <span className="geom-label">Kuyruk:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.kuyrukGenislikMm ?? 35}
                          min={1}
                          max={200}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateBogumluKuyrukKuyruk(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>

                      <div className="geom-field-group" title="Kuyruk Kalınlığı (mm)">
                        <span className="geom-label">Kuyruk Kalınlık:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.kuyrukKalinlikMm ?? 4}
                          min={1}
                          max={30}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateKuyrukKalinlik(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>
                    </>
                  )}

                  {/* Kelebek (Çift Kanat) Alanları */}
                  {labelConfig.etiketSekli === "kelebek" && (
                    <>
                      <div className="geom-field-group" title="Sol Kanat (mm)">
                        <span className="geom-label">Sol Kanat:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.solKanatMm ?? 28}
                          min={1}
                          max={150}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateBogumluKuyrukSol(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>

                      <div className="geom-field-group" title="Sağ Kanat (mm)">
                        <span className="geom-label">Sağ Kanat:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.sagKanatMm ?? 28}
                          min={1}
                          max={150}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateBogumluKuyrukSag(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>

                      <div className="geom-field-group" title="Köprü Genişliği (mm)">
                        <span className="geom-label">Köprü Gen:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.kopruGenislikMm ?? 6}
                          min={1}
                          max={50}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateLabelConfig({ kopruGenislikMm: v });
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>

                      <div className="geom-field-group" title="Köprü Yüksekliği (mm)">
                        <span className="geom-label">Köprü Yük:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.kopruYukseklikMm ?? 18}
                          min={1}
                          max={100}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateLabelConfig({ kopruYukseklikMm: v });
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>
                    </>
                  )}

                  {/* Dambıl Alanları */}
                  {labelConfig.etiketSekli === "dambil" && (
                    <>
                      <div className="geom-field-group" title="Başlık Çapı (mm)">
                        <span className="geom-label">Başlık:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.solKanatMm ?? 12}
                          min={1}
                          max={100}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateBogumluKuyrukSol(v);
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>

                      <div className="geom-field-group" title="Köprü Şerit Genişliği (mm)">
                        <span className="geom-label">Köprü:</span>
                        <input
                          type="number"
                          className="geom-input"
                          value={labelConfig.kopruGenislikMm ?? 4}
                          min={1}
                          max={50}
                          step={0.5}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateLabelConfig({ kopruGenislikMm: v });
                          }}
                        />
                        <span className="geom-unit">mm</span>
                      </div>
                    </>
                  )}

                  {/* Katlama Çizgisi */}
                  <label className="small-form-check" style={{ marginLeft: 4, cursor: "pointer" }} title="Katlama Kılavuz Çizgisini Göster">
                    <input
                      type="checkbox"
                      checked={labelConfig.katlamaCizgisi}
                      onChange={(e) => updateLabelConfig({ katlamaCizgisi: e.target.checked })}
                    />
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: "#475569" }}>Katlama Çizgisi</span>
                  </label>
                </div>
              )}

              {/* Eleman Seçiliyse: Canva Tarzı Tam Genişlikte Bileşen Ayar Müfettişi */}
              {selectedElement && (
                <div ref={inspectorRef} className="canvas-fullwidth-inspector">
                  {/* Tip / Rozet */}
                  <div className="inspector-badge">
                    <span>
                      {selectedElement.type === "text" ? "✏️" :
                        selectedElement.type === "field" ? "🏷️" :
                          selectedElement.type === "barcode" ? "📊" :
                            selectedElement.type === "qr" ? "📱" :
                              selectedElement.type === "image" || selectedElement.type === "logo" ? "🖼️" : "🔷"}
                    </span>
                    <span className="badge-text" title={selectedElement.text || selectedElement.fieldKey || selectedElement.type}>
                      {selectedElement.fieldKey ? `[${selectedElement.text || selectedElement.fieldKey}]` : (selectedElement.text || selectedElement.type)}
                    </span>
                    {selectedElement.type === "text" && (
                      <button
                        type="button"
                        className="inspector-icon-btn"
                        title="Metni Doğrudan Düzenle"
                        onClick={() => setEditingId(selectedElement.id)}
                      >
                        <IconEdit size={11} />
                      </button>
                    )}
                  </div>

                  <div className="inspector-divider" />

                  {/* Metin & Veri Alanı Kontrolleri */}
                  {(selectedElement.type === "text" || selectedElement.type === "field") && (
                    <>
                      {/* Canva Tarzı Yazı Tipi (Font) Seçici ve Popover */}
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          className={`canva-font-trigger-btn ${fontMenuOpen ? "active" : ""}`}
                          title="Yazı Tipini Değiştir"
                          onClick={() => {
                            setFontMenuOpen((v) => !v);
                            setActiveColorPopover(null);
                          }}
                        >
                          <span className="canva-font-trigger-name" style={{ fontFamily: selectedElement.fontFamily || "Arial" }}>
                            {selectedElement.fontFamily || "Arial"}
                          </span>
                          <IconChevronDown size={13} color="#64748b" />
                        </button>

                        {fontMenuOpen && (
                          <div className="canva-font-popover" onClick={(e) => e.stopPropagation()}>
                            <div className="canva-font-header">
                              <input
                                type="text"
                                className="canva-font-search-input"
                                placeholder="Yazı tipi ara (örn: Cinzel, Playfair, Inter)..."
                                value={fontSearchQuery}
                                onChange={(e) => setFontSearchQuery(e.target.value)}
                                autoFocus
                              />
                            </div>
                            <div className="canva-font-list">
                              {(["kuyumcu", "script", "sans", "display", "mono"] as const).map((catKey) => {
                                const fontsInCat = filteredFonts.filter((f) => f.category === catKey);
                                if (fontsInCat.length === 0) return null;
                                const catTitle =
                                  catKey === "kuyumcu" ? "💎 Kuyumcu & Lüks Serif" :
                                    catKey === "script" ? "✨ Zarif & El Yazısı" :
                                      catKey === "sans" ? "🏢 Modern & Okunabilir" :
                                        catKey === "display" ? "🏷️ Başlık & Kompakt" : "⌨️ Daktilo & Kod";
                                return (
                                  <div key={catKey}>
                                    <div className="canva-font-category-header">{catTitle}</div>
                                    {fontsInCat.map((f) => {
                                      const isSelected = (selectedElement.fontFamily || "Arial").toLowerCase() === f.family.toLowerCase();
                                      return (
                                        <button
                                          key={f.family}
                                          type="button"
                                          className={`canva-font-item ${isSelected ? "selected" : ""}`}
                                          onClick={() => {
                                            updateElement(selectedElement.id, { fontFamily: f.family });
                                            dispatch({ type: "PUSH_HISTORY" });
                                            setFontMenuOpen(false);
                                          }}
                                        >
                                          <span className="canva-font-item-name" style={{ fontFamily: f.family }}>
                                            {f.name}
                                          </span>
                                          <span className="canva-font-item-preview" style={{ fontFamily: f.family }}>
                                            {f.sample}
                                          </span>
                                          {isSelected && <IconCheck size={14} color="#059669" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Punto Stepper: [-] [8.5] [+] */}
                      <div className="inspector-stepper-group">
                        <button
                          type="button"
                          className="stepper-btn"
                          title="Punto Azalt (-0.5)"
                          onClick={() => updateElement(selectedElement.id, { fontSize: Math.max(3, (selectedElement.fontSize ?? 8) - 0.5) })}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="stepper-input"
                          value={selectedElement.fontSize ?? 8}
                          min={3}
                          max={120}
                          step={0.5}
                          title="Punto"
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) updateElement(selectedElement.id, { fontSize: val });
                          }}
                        />
                        <button
                          type="button"
                          className="stepper-btn"
                          title="Punto Artır (+0.5)"
                          onClick={() => updateElement(selectedElement.id, { fontSize: Math.min(120, (selectedElement.fontSize ?? 8) + 0.5) })}
                        >
                          +
                        </button>
                      </div>

                      {/* Kalın, İtalik, Altı Çizili, Büyük Harf (TT) - Segmented Pill */}
                      <div className="inspector-segmented-group">
                        <button
                          type="button"
                          className={`seg-btn ${selectedElement.fontWeight === "bold" ? "active" : ""}`}
                          title="Kalın (Bold)"
                          onClick={() => updateElement(selectedElement.id, { fontWeight: selectedElement.fontWeight === "bold" ? "normal" : "bold" })}
                        >
                          <IconBold size={13} />
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${selectedElement.fontStyle === "italic" ? "active" : ""}`}
                          title="İtalik (Italic)"
                          onClick={() => updateElement(selectedElement.id, { fontStyle: selectedElement.fontStyle === "italic" ? "normal" : "italic" })}
                        >
                          <IconItalic size={13} />
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${selectedElement.textDecoration === "underline" ? "active" : ""}`}
                          title="Altı Çizili (Underline)"
                          onClick={() => updateElement(selectedElement.id, { textDecoration: selectedElement.textDecoration === "underline" ? "none" : "underline" })}
                        >
                          <IconUnderline size={13} />
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${selectedElement.textTransform === "uppercase" ? "active" : ""}`}
                          title="Büyük Harfe Dönüştür (TT)"
                          style={{ fontSize: 10.5, fontWeight: 800 }}
                          onClick={() => updateElement(selectedElement.id, { textTransform: selectedElement.textTransform === "uppercase" ? "none" : "uppercase" })}
                        >
                          TT
                        </button>
                      </div>

                      {/* Hizalama Segmented Pill */}
                      <div className="inspector-segmented-group">
                        <button
                          type="button"
                          className={`seg-btn ${selectedElement.textAlign === "left" ? "active" : ""}`}
                          title="Sola Hizala"
                          onClick={() => updateElement(selectedElement.id, { textAlign: "left" })}
                        >
                          <IconAlignLeft size={13} />
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${(!selectedElement.textAlign || selectedElement.textAlign === "center") ? "active" : ""}`}
                          title="Ortala"
                          onClick={() => updateElement(selectedElement.id, { textAlign: "center" })}
                        >
                          <IconAlignCenter size={13} />
                        </button>
                        <button
                          type="button"
                          className={`seg-btn ${selectedElement.textAlign === "right" ? "active" : ""}`}
                          title="Sağa Hizala"
                          onClick={() => updateElement(selectedElement.id, { textAlign: "right" })}
                        >
                          <IconAlignRight size={13} />
                        </button>
                      </div>

                      <div className="inspector-divider" />

                      {/* Canva Tarzı Yazı Rengi Tablosu */}
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          className={`canva-color-trigger-btn ${activeColorPopover === "textColor" ? "active" : ""}`}
                          title="Yazı Rengini Seç"
                          onClick={() => {
                            setActiveColorPopover(activeColorPopover === "textColor" ? null : "textColor");
                            setFontMenuOpen(false);
                          }}
                        >
                          <div className="canva-color-chip" style={{ background: selectedElement.color || "#000000" }} />
                          <span className="canva-color-btn-label">Yazı Rengi</span>
                          <IconChevronDown size={11} color="#64748b" />
                        </button>

                        {activeColorPopover === "textColor" &&
                          renderColorTablePopover(
                            "Yazı Rengi Seç",
                            selectedElement.color || "#000000",
                            (newColor) => updateElement(selectedElement.id, { color: newColor }),
                            false
                          )}
                      </div>

                      {/* Canva Tarzı Zemin / Vurgu Rengi Tablosu */}
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          className={`canva-color-trigger-btn ${activeColorPopover === "bgColor" ? "active" : ""}`}
                          title="Zemin / Arka Plan Rengini Seç"
                          onClick={() => {
                            setActiveColorPopover(activeColorPopover === "bgColor" ? null : "bgColor");
                            setFontMenuOpen(false);
                          }}
                        >
                          <div
                            className="canva-color-chip"
                            style={{
                              background:
                                !selectedElement.backgroundColor || selectedElement.backgroundColor === "transparent"
                                  ? "repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%) 50% / 8px 8px"
                                  : selectedElement.backgroundColor,
                            }}
                          />
                          <span className="canva-color-btn-label">Zemin Rengi</span>
                          <IconChevronDown size={11} color="#64748b" />
                        </button>

                        {activeColorPopover === "bgColor" &&
                          renderColorTablePopover(
                            "Zemin / Vurgu Rengi Seç",
                            selectedElement.backgroundColor || "transparent",
                            (newColor) => updateElement(selectedElement.id, { backgroundColor: newColor }),
                            true
                          )}
                      </div>
                    </>
                  )}

                  {/* Geometrik Şekiller */}
                  {(selectedElement.type === "rect" || selectedElement.type === "rect-round" || selectedElement.type === "ellipse" || selectedElement.type === "diamond" || selectedElement.type.startsWith("line")) && (
                    <>
                      {/* Canva Tarzı Dolgu Rengi Tablosu */}
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          className={`canva-color-trigger-btn ${activeColorPopover === "bgColor" ? "active" : ""}`}
                          title="Şekil Dolgu Rengini Seç"
                          onClick={() => {
                            setActiveColorPopover(activeColorPopover === "bgColor" ? null : "bgColor");
                            setFontMenuOpen(false);
                          }}
                        >
                          <div
                            className="canva-color-chip"
                            style={{
                              background:
                                !selectedElement.backgroundColor || selectedElement.backgroundColor === "transparent"
                                  ? "repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%) 50% / 8px 8px"
                                  : selectedElement.backgroundColor,
                            }}
                          />
                          <span className="canva-color-btn-label">Dolgu Rengi</span>
                          <IconChevronDown size={11} color="#64748b" />
                        </button>

                        {activeColorPopover === "bgColor" &&
                          renderColorTablePopover(
                            "Şekil Dolgu Rengi Seç",
                            selectedElement.backgroundColor || "transparent",
                            (newColor) => updateElement(selectedElement.id, { backgroundColor: newColor }),
                            true
                          )}
                      </div>

                      {/* Canva Tarzı Çizgi / Dış Renk Tablosu */}
                      <div style={{ position: "relative" }}>
                        <button
                          type="button"
                          className={`canva-color-trigger-btn ${activeColorPopover === "borderColor" ? "active" : ""}`}
                          title="Dış Çizgi / Kenarlık Rengini Seç"
                          onClick={() => {
                            setActiveColorPopover(activeColorPopover === "borderColor" ? null : "borderColor");
                            setFontMenuOpen(false);
                          }}
                        >
                          <div
                            className="canva-color-chip"
                            style={{
                              background:
                                !selectedElement.borderColor || selectedElement.borderColor === "transparent"
                                  ? "repeating-conic-gradient(#cbd5e1 0% 25%, #ffffff 0% 50%) 50% / 8px 8px"
                                  : selectedElement.borderColor,
                            }}
                          />
                          <span className="canva-color-btn-label">Çizgi Rengi</span>
                          <IconChevronDown size={11} color="#64748b" />
                        </button>

                        {activeColorPopover === "borderColor" &&
                          renderColorTablePopover(
                            "Dış Çizgi / Kenarlık Rengi Seç",
                            selectedElement.borderColor || "#000000",
                            (newColor) => updateElement(selectedElement.id, { borderColor: newColor }),
                            true
                          )}
                      </div>

                      {/* Kalınlık Stepper */}
                      <div className="inspector-stepper-group">
                        <span className="inspector-label" style={{ paddingLeft: 6 }}>Kalınlık:</span>
                        <button
                          type="button"
                          className="stepper-btn"
                          onClick={() => updateElement(selectedElement.id, { borderWidth: Math.max(0, (selectedElement.borderWidth ?? 1) - 0.5) })}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="stepper-input"
                          value={selectedElement.borderWidth ?? 1}
                          min={0}
                          max={20}
                          step={0.5}
                          onChange={(e) => updateElement(selectedElement.id, { borderWidth: parseFloat(e.target.value) || 0 })}
                        />
                        <button
                          type="button"
                          className="stepper-btn"
                          onClick={() => updateElement(selectedElement.id, { borderWidth: Math.min(20, (selectedElement.borderWidth ?? 1) + 0.5) })}
                        >
                          +
                        </button>
                      </div>
                    </>
                  )}

                  {/* Barkod Kontrolleri */}
                  {selectedElement.type === "barcode" && (
                    <>
                      <div className="inspector-group">
                        <select
                          className="inspector-select"
                          value={selectedElement.barcodeFormat || "CODE128"}
                          onChange={(e) => updateElement(selectedElement.id, { barcodeFormat: e.target.value as any })}
                        >
                          <option value="CODE128">CODE128</option>
                          <option value="EAN13">EAN13</option>
                          <option value="CODE39">CODE39</option>
                          <option value="UPC">UPC</option>
                        </select>
                      </div>
                      <input
                        type="text"
                        className="inspector-text-input"
                        style={{ width: 90 }}
                        value={selectedElement.barcodeValue || ""}
                        placeholder="Barkod kodu"
                        onChange={(e) => updateElement(selectedElement.id, { barcodeValue: e.target.value })}
                      />
                      <button
                        type="button"
                        className={`seg-btn ${selectedElement.showText !== false ? "active" : ""}`}
                        style={{ width: "auto", padding: "0 6px", fontSize: 10, fontWeight: 700 }}
                        onClick={() => updateElement(selectedElement.id, { showText: selectedElement.showText === false ? true : false })}
                      >
                        123 Yazı
                      </button>
                      <div className="inspector-color-group">
                        <div className="inspector-color-palette">
                          {JEWELRY_QUICK_COLORS.map((c) => (
                            <button
                              key={c.color}
                              type="button"
                              className={`color-dot ${(selectedElement.color || "#000000").toLowerCase() === c.color.toLowerCase() ? "selected" : ""}`}
                              style={{ background: c.color }}
                              onClick={() => updateElement(selectedElement.id, { color: c.color })}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* QR Kod Kontrolleri */}
                  {selectedElement.type === "qr" && (
                    <>
                      <input
                        type="text"
                        className="inspector-text-input"
                        style={{ width: 110 }}
                        value={selectedElement.barcodeValue || ""}
                        placeholder="URL / Metin"
                        onChange={(e) => updateElement(selectedElement.id, { barcodeValue: e.target.value })}
                      />
                      <div className="inspector-color-group">
                        <span className="inspector-label">QR:</span>
                        <div className="inspector-color-palette">
                          {JEWELRY_QUICK_COLORS.map((c) => (
                            <button
                              key={c.color}
                              type="button"
                              className={`color-dot ${(selectedElement.color || "#000000").toLowerCase() === c.color.toLowerCase() ? "selected" : ""}`}
                              style={{ background: c.color }}
                              onClick={() => updateElement(selectedElement.id, { color: c.color })}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Görsel Kontrolleri */}
                  {(selectedElement.type === "image" || selectedElement.type === "logo") && (
                    <div className="inspector-group">
                      <label className="inspector-action-btn" style={{ cursor: "pointer" }} title="Yeni Görsel Yükle">
                        📷 Değiştir
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                updateElement(selectedElement.id, { imageData: evt.target?.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )}

                  <div className="inspector-divider" />

                  {/* Tuvalde Hızlı Hizalama */}
                  <div className="inspector-group">
                    <button type="button" className="inspector-action-btn" title="Tuvalde Yatay Ortala" onClick={() => alignElement("center-h")}>
                      ↔ Ortala
                    </button>
                    <button type="button" className="inspector-action-btn" title="Tuvalde Dikey Ortala" onClick={() => alignElement("center-v")}>
                      ↕ Dikey
                    </button>
                    {(labelConfig.etiketSekli === "kuyruklu" || labelConfig.etiketSekli === "bogumlukuyruk" || labelConfig.etiketSekli === "bogumlukuyrukkeskin" || labelConfig.etiketSekli === "dambil") && (
                      <button type="button" className="inspector-action-btn tail-btn" title="Kuyruk Şeridine Ortala" onClick={() => alignElement("tail")}>
                        🦴 Kuyruk
                      </button>
                    )}
                  </div>

                  {/* Kilit Butonu */}
                  <button
                    type="button"
                    className={`inspector-icon-btn ${selectedElement.locked ? "active" : ""}`}
                    title={selectedElement.locked ? "Kilidi Aç" : "Elemanı Kilitle"}
                    onClick={() => updateElement(selectedElement.id, { locked: !selectedElement.locked })}
                  >
                    {selectedElement.locked ? "🔒" : "🔓"}
                  </button>

                  {/* Sil Butonu */}
                  <button
                    type="button"
                    className="inspector-icon-btn danger"
                    title="Seçili Nesneyi Sil (Delete)"
                    onClick={() => {
                      dispatch({ type: "DELETE_ELEMENTS", ids: [selectedElement.id] });
                      setSelectedIds([]);
                    }}
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Sadece Önizleme Modunda Açılan Üst Bar */}
          {isPreviewMode && (
            <div className="preview-top-actions-bar animate-fadein">
              <button
                type="button"
                className="canvas-floating-btn"
                title="Önizleme Modunu Kapat (ESC)"
                onClick={() => setIsPreviewMode(false)}
              >
                <IconX size={15} />
                <span>Kapat (ESC)</span>
              </button>

              <div className="preview-top-center-info">
                <span className="preview-info-text">{currentLayoutInfo.description}</span>
              </div>

              <button
                type="button"
                className="canvas-floating-btn print-btn"
                title="Doğrudan Çıktı Al (Yazdır - Ctrl+P)"
                onClick={handleDirectPrint}
              >
                <IconPrinter size={15} />
                <span>Çıktı Al</span>
              </button>
            </div>
          )}

          {/* Sağ Tarafta Dikey Kağıt Seçim Çekmecesi (Üzerine gelince genişler, seçilince küçülür) */}
          {isPreviewMode && (
            <div
              className="preview-right-paper-drawer animate-fadein"
              title="Kağıt & Tabaka Düzeni Seçimi (Genişletmek için üzerine gelin)"
            >
              {PAPER_LAYOUTS.map((layout) => {
                const isActive = selectedLayoutId === layout.id;
                return (
                  <button
                    key={layout.id}
                    type="button"
                    className={`preview-paper-item-btn ${isActive ? "active" : ""}`}
                    title={layout.description}
                    onClick={() => {
                      setSelectedLayoutId(layout.id);
                      setPreviewZoom(calculateFitZoom(layout.id));
                    }}
                  >
                    <span className="paper-icon">{layout.icon}</span>
                    <span className="paper-name">{layout.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sağ Altta Yakınlaştırma / Uzaklaştırma & Ekrana Sığdır Kontrolleri */}
          {isPreviewMode && (
            <div className="preview-bottom-zoom-bar animate-fadein">
              <button
                type="button"
                className="preview-zoom-btn"
                title="Uzaklaştır (Ctrl + Tekerlek)"
                onClick={() => setPreviewZoom((z) => clamp(Math.round((z - 0.08) * 100) / 100, 0.15, 3.0))}
              >
                -
              </button>
              <button
                type="button"
                className="preview-zoom-fit-btn"
                title="Sayfayı Ekrana Tam Sığdır"
                onClick={() => setPreviewZoom(calculateFitZoom(selectedLayoutId))}
              >
                <span>{Math.round(previewZoom * 100)}%</span>
                <span className="fit-text">Sığdır</span>
              </button>
              <button
                type="button"
                className="preview-zoom-btn"
                title="Yakınlaştır (Ctrl + Tekerlek)"
                onClick={() => setPreviewZoom((z) => clamp(Math.round((z + 0.08) * 100) / 100, 0.15, 3.0))}
              >
                +
              </button>
            </div>
          )}

          {/* ⌨️ Sol Altta Kısayol Bilgilendirme (Siyah Sade Yazı) */}
          <div className="canvas-bottom-left-shortcuts animate-fadein">
            <button
              type="button"
              className="canvas-bottom-shortcut-pill"
              title="Şablonu Kaydet (F1 veya Ctrl+S)"
              onClick={() => handleQuickSaveRef.current()}
            >
              <kbd>F1</kbd>
              <span>Kaydet</span>
            </button>
            <span className="shortcut-dot">•</span>
            <button
              type="button"
              className="canvas-bottom-shortcut-pill"
              title="Şablon Ara / Dürbün (F3)"
              onClick={() => setDurbunModal(true)}
            >
              <kbd>F3</kbd>
              <span>Ara</span>
            </button>
            <span className="shortcut-dot">•</span>
            <button
              type="button"
              className="canvas-bottom-shortcut-pill"
              title="Kaydet ve Doğrudan Çıktı Al (F10)"
              onClick={() => handleSaveAndPrintRef.current()}
            >
              <kbd>F10</kbd>
              <span>Kaydet/Yazdır</span>
            </button>
            <span className="shortcut-dot">•</span>
            <button
              type="button"
              className="canvas-bottom-shortcut-pill"
              title="Doğrudan Yazdır (F9 veya Ctrl+P)"
              onClick={() => handleDirectPrint()}
            >
              <kbd>F9</kbd>
              <span>Yazdır</span>
            </button>
          </div>

          {/* 👁️ Sağ Altta Önizleme / Tasarım Modu Geçiş Butonu */}
          <div className="canvas-bottom-right-preview-action animate-fadein">
            <button
              type="button"
              className={`canvas-corner-pill-btn ${isPreviewMode ? "active" : ""}`}
              title={isPreviewMode ? "Tasarım Moduna Dön (ESC)" : "Önizleme Moduna Geç"}
              onClick={() => {
                setIsPreviewMode((v) => !v);
                if (!isPreviewMode) {
                  setEditingId(null);
                  setSelectedIds([]);
                }
              }}
            >
              <IconEye size={15} />
              <span>{isPreviewMode ? "Tasarım Modu" : "Önizle"}</span>
            </button>
          </div>

          <div
            ref={canvasScrollContainerRef}
            className={`canvas-scroll-container ${isPreviewMode ? "preview-mode-scroll" : ""}`}
            onMouseDown={handleCanvasMouseDown}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onContextMenu={(e) => handleContextMenu(e)}
          >

            <div className={`canvas-workspace ${isPreviewMode ? "preview-mode-workspace" : ""}`}>
              {/* 1. ÇOKLU TABAKA ÖNİZLEMESİ (A4, A5, A6, A3, 10x15, 8x20) */}
              {isPreviewMode &&
                selectedLayoutId !== "single" &&
                selectedLayoutId !== "roll" &&
                selectedLayoutId !== "roll2" &&
                selectedLayoutId !== "roll3" && (() => {
                  const { pageW, pageH, margin, gap, cols, rows, total } = currentLayoutInfo;
                  const labelW = labelConfig.genislikMm;
                  const labelH = labelConfig.yukseklikMm;
                  const sheetScale = previewZoom;

                  return (
                    <div className="sheet-preview-container">
                      <div
                        className="sheet-page-wrapper"
                        style={{
                          width: mmToPx(pageW, sheetScale),
                          height: mmToPx(pageH, sheetScale),
                          padding: mmToPx(margin, sheetScale),
                        }}
                      >
                        <div
                          className="sheet-grid-wrapper"
                          style={{
                            gridTemplateColumns: `repeat(${cols}, ${mmToPx(labelW, sheetScale)}px)`,
                            gridAutoRows: `${mmToPx(labelH, sheetScale)}px`,
                            gap: `${mmToPx(gap, sheetScale)}px`,
                          }}
                        >
                          {Array.from({ length: total }).map((_, idx) => (
                            <StaticLabelCell
                              key={`sheet-item-${idx}`}
                              config={labelConfig}
                              elements={elements}
                              zoom={sheetScale}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* 2. KUYUMCU TERMAL RULO ŞERİT ÖNİZLEMESİ (1'li, 2'li, 3'lü Rulo) */}
              {isPreviewMode &&
                (selectedLayoutId === "roll" || selectedLayoutId === "roll2" || selectedLayoutId === "roll3") && (() => {
                  const { cols, rows, pageW } = currentLayoutInfo;
                  const carrierMargin = 4;
                  const gapX = 3;
                  const gapY = 3;
                  const rollScale = previewZoom;

                  return (
                    <div className="sheet-preview-container">
                      <div
                        className="roll-strip-carrier"
                        style={{
                          width: mmToPx(pageW, rollScale),
                          padding: `${mmToPx(10, rollScale)}px ${mmToPx(carrierMargin, rollScale)}px`,
                          gap: `${mmToPx(gapY, rollScale)}px`,
                        }}
                      >
                        {Array.from({ length: rows }).map((_, rIdx) => (
                          <React.Fragment key={`roll-row-${rIdx}`}>
                            <div
                              style={{
                                display: "flex",
                                gap: `${mmToPx(gapX, rollScale)}px`,
                                justifyContent: "center",
                              }}
                            >
                              {Array.from({ length: cols }).map((_, cIdx) => (
                                <StaticLabelCell
                                  key={`roll-cell-${rIdx}-${cIdx}`}
                                  config={labelConfig}
                                  elements={elements}
                                  zoom={rollScale}
                                />
                              ))}
                            </div>
                            {rIdx < rows - 1 && <div className="roll-perforation-mark" />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              {/* 3. TEKLİ ETİKET ÖNİZLEMESİ */}
              {isPreviewMode && selectedLayoutId === "single" && (
                <div className="sheet-preview-container">
                  <StaticLabelCell
                    config={labelConfig}
                    elements={elements}
                    zoom={previewZoom}
                  />
                </div>
              )}

              {/* 4. TASARIM MODU ETİKET TUVALİ */}
              {!isPreviewMode && (
                <div
                  className="label-canvas-wrapper"
                  style={{
                    transform: `translate(${canvasPan.x}px, ${canvasPan.y}px)`,
                    willChange: "transform",
                  }}
                >
                  {/* Üst ve Sol Milimetrik Ölçü Rozetleri */}
                  <div className="label-dimension-badge-top">
                    {labelConfig.genislikMm} mm
                  </div>
                  <div className="label-dimension-badge-left">
                    {labelConfig.yukseklikMm} mm
                  </div>

                  {/* Asıl Etiket Tuvali */}
                  <div
                    ref={canvasRef}
                    className="label-canvas"
                    style={{
                      width: canvasW,
                      height: canvasH,
                      position: "relative",
                    }}
                  >
                    {/* Birebir Kesim Silueti ve Görsel Izgara Çizgileri */}
                    <LabelShapeSVG config={labelConfig} zoom={zoom} snapGrid={snapGrid} isPreview={isPreviewMode} />

                    {/* 🧲 Akıllı Mıknatıslı Hizalama Kılavuz Çizgileri (Smart Guides) */}
                    {guidelines.xLines.map((gx, idx) => (
                      <div
                        key={`gx-${idx}`}
                        style={{
                          position: "absolute",
                          left: mmToPx(gx, zoom),
                          top: 0,
                          width: 1,
                          height: "100%",
                          background: "#ec4899",
                          boxShadow: "0 0 6px rgba(236,72,153,0.9)",
                          zIndex: 9990,
                          pointerEvents: "none",
                        }}
                      />
                    ))}
                    {guidelines.yLines.map((gy, idx) => (
                      <div
                        key={`gy-${idx}`}
                        style={{
                          position: "absolute",
                          top: mmToPx(gy, zoom),
                          left: 0,
                          height: 1,
                          width: "100%",
                          background: "#ec4899",
                          boxShadow: "0 0 6px rgba(236,72,153,0.9)",
                          zIndex: 9990,
                          pointerEvents: "none",
                        }}
                      />
                    ))}

                    {/* Katmanlar (Elements) */}
                    {sortedElements.map((el) => {
                      const isSelected = selectedIds.includes(el.id);
                      if (!el.visible) return null;

                      return (
                        <div
                          key={el.id}
                          className={`canvas-element ${isSelected ? "selected" : ""}`}
                          style={{
                            left: mmToPx(el.x, zoom),
                            top: mmToPx(el.y, zoom),
                            width: mmToPx(el.width, zoom),
                            height: mmToPx(el.height, zoom),
                            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                            transformOrigin: "center center",
                            zIndex: el.zIndex,
                            opacity: el.opacity,
                            cursor: el.locked ? "not-allowed" : "move",
                          }}
                          onMouseDown={(e) => {
                            if (editingId === el.id) return;
                            handleElementMouseDown(e, el.id);
                          }}
                          onTouchStart={(e) => {
                            if (editingId === el.id) return;
                            handleElementTouchStart(e, el.id);
                          }}
                          onContextMenu={(e) => {
                            if (isPreviewMode) return;
                            handleContextMenu(e, el.id);
                          }}
                          onDoubleClick={(e) => {
                            if (isPreviewMode) return;
                            e.stopPropagation();
                            if (el.type === "text" || el.type === "field") {
                              dragRef.current = null;
                              setSelectedIds([el.id]);
                              setEditingId(el.id);
                            }
                          }}
                        >

                          {!isSelected && !isPreviewMode && <div className="element-hover-ring" />}

                          {/* İçerik */}
                          {renderElementContent(el, isSelected)}

                          {/* Seçim ve Boyutlandırma Tutamaçları */}
                          {isSelected && !isPreviewMode && !el.locked && selectedIds.length === 1 && (
                            <>
                              <div className="rotate-handle-line" />
                              <div
                                className="rotate-handle"
                                title="Döndür"
                                onMouseDown={(e) => handleRotateMouseDown(e, el.id)}
                                onTouchStart={(e) => handleRotateTouchStart(e, el.id)}
                              >
                                <IconRotate size={10} stroke={2.5} />
                              </div>
                              {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((h) => (
                                <div
                                  key={h}
                                  className={`resize-handle ${h}`}
                                  onMouseDown={(e) => handleResizeMouseDown(e, el.id, h)}
                                />
                              ))}
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* Lasso Seçim */}
                    {lasso && !isPreviewMode && (
                      <div
                        className="lasso-box"
                        style={{
                          left: mmToPx(lasso.x, zoom),
                          top: mmToPx(lasso.y, zoom),
                          width: mmToPx(lasso.w, zoom),
                          height: mmToPx(lasso.h, zoom),
                        }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Durum Çubuğu ─────────────────────────────────────────── */}
          <div className="editor-status-bar">
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className="status-item">
                📐 Model: {ETIKET_SEKILLERI.find((s) => s.value === labelConfig.etiketSekli)?.ad} ({labelConfig.genislikMm}×{labelConfig.yukseklikMm}mm)
              </span>
              <span className="status-item">
                🔢 {elements.length} nesne
              </span>
              {snapGrid > 0 && (
                <span className="status-item" style={{ color: "#38bdf8" }}>
                  🌐 {snapGrid}mm Izgara Aktif
                </span>
              )}
              {selectedElement && (
                <span className="status-item">
                  📍 X:{selectedElement.x.toFixed(1)} Y:{selectedElement.y.toFixed(1)} W:{selectedElement.width.toFixed(1)} H:{selectedElement.height.toFixed(1)}mm
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Özel Sağ Tık Menüsü (Context Menu) ────────────────────────────── */}
      {contextMenu?.visible && (
        <div
          className="custom-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.targetId ? (
            (() => {
              const targetEl = elements.find((e) => e.id === contextMenu.targetId);
              const isText = targetEl?.type === "text" || targetEl?.type === "field";
              const isImg = targetEl?.type === "image" || targetEl?.type === "logo";
              return (
                <>
                  {isText && (
                    <>
                      <div className="context-menu-section-title">Punto Boyutu</div>
                      <div className="context-quick-bar">
                        {[6, 7, 8, 9, 10, 11, 12, 14, 16].map((pt) => (
                          <button
                            key={pt}
                            className={`context-punto-btn ${(targetEl.fontSize || 8) === pt ? "active" : ""}`}
                            onClick={() => {
                              updateElement(targetEl.id, { fontSize: pt });
                              dispatch({ type: "PUSH_HISTORY" });
                            }}
                          >
                            {pt}pt
                          </button>
                        ))}
                      </div>
                      <div className="context-menu-section-title">Hızlı Biçim</div>
                      <div className="context-quick-bar">
                        <button
                          className={`context-punto-btn ${targetEl.fontWeight === "bold" ? "active" : ""}`}
                          onClick={() => updateElement(targetEl.id, { fontWeight: targetEl.fontWeight === "bold" ? "normal" : "bold" })}
                          title="Kalın"
                        >
                          <b>B</b>
                        </button>
                        <button
                          className={`context-punto-btn ${targetEl.fontStyle === "italic" ? "active" : ""}`}
                          onClick={() => updateElement(targetEl.id, { fontStyle: targetEl.fontStyle === "italic" ? "normal" : "italic" })}
                          title="İtalik"
                        >
                          <i>I</i>
                        </button>
                        <button
                          className={`context-punto-btn ${targetEl.textDecoration === "underline" ? "active" : ""}`}
                          onClick={() => updateElement(targetEl.id, { textDecoration: targetEl.textDecoration === "underline" ? "none" : "underline" })}
                          title="Altı Çizili"
                        >
                          <u>U</u>
                        </button>
                        <button
                          className={`context-punto-btn ${targetEl.textAlign === "left" ? "active" : ""}`}
                          onClick={() => updateElement(targetEl.id, { textAlign: "left" })}
                          title="Sola Hizala"
                        >
                          Sola
                        </button>
                        <button
                          className={`context-punto-btn ${targetEl.textAlign === "center" ? "active" : ""}`}
                          onClick={() => updateElement(targetEl.id, { textAlign: "center" })}
                          title="Ortala"
                        >
                          Orta
                        </button>
                        <button
                          className={`context-punto-btn ${targetEl.textAlign === "right" ? "active" : ""}`}
                          onClick={() => updateElement(targetEl.id, { textAlign: "right" })}
                          title="Sağa Hizala"
                        >
                          Sağa
                        </button>
                      </div>
                      <div className="context-menu-divider" />
                    </>
                  )}

                  {isImg && (
                    <>
                      <div
                        className="context-menu-item"
                        onClick={() => {
                          imageTargetIdRef.current = contextMenu.targetId;
                          imageInputRef.current?.click();
                          setContextMenu(null);
                        }}
                      >
                        <IconUpload size={13} />
                        <span>Fotoğraf / Logo Yükle</span>
                      </div>
                      <div className="context-menu-divider" />
                    </>
                  )}

                  <div
                    className="context-menu-item"
                    onClick={() => {
                      setEditingId(contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <IconTypography size={13} />
                    <span>Metni Düzenle</span>
                    <span className="shortcut">Çift Tık</span>
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      setClipboard(selectedElements.map((el) => ({ ...el })));
                      setContextMenu(null);
                    }}
                  >
                    <IconCopy size={13} />
                    <span>Kopyala</span>
                    <span className="shortcut">Ctrl+C</span>
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      if (selectedElement) {
                        const newEl = { ...selectedElement, id: genId(), x: selectedElement.x + 2, y: selectedElement.y + 2, zIndex: Math.max(...elements.map((e) => e.zIndex), 0) + 1 };
                        dispatch({ type: "ADD_ELEMENT", element: newEl });
                        setSelectedIds([newEl.id]);
                      }
                      setContextMenu(null);
                    }}
                  >
                    <IconSparkles size={13} />
                    <span>Çoğalt (Klonla)</span>
                    <span className="shortcut">Ctrl+D</span>
                  </div>
                  <div className="context-menu-divider" />
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      const target = contextMenu.targetId || selectedIds[0];
                      if (target) bringToFront(target);
                      setContextMenu(null);
                    }}
                  >
                    <IconArrowUp size={13} color="#059669" />
                    <span style={{ fontWeight: 700, color: "#059669" }}>En Öne Getir</span>
                    <span className="shortcut">Ctrl+Shift+]</span>
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      const target = contextMenu.targetId || selectedIds[0];
                      if (target) bringForward(target);
                      setContextMenu(null);
                    }}
                  >
                    <IconArrowUp size={13} />
                    <span>Bir Katman Öne Getir</span>
                    <span className="shortcut">Ctrl+]</span>
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      const target = contextMenu.targetId || selectedIds[0];
                      if (target) sendBackward(target);
                      setContextMenu(null);
                    }}
                  >
                    <IconArrowDown size={13} />
                    <span>Bir Katman Arkaya Gönder</span>
                    <span className="shortcut">Ctrl+[</span>
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      const target = contextMenu.targetId || selectedIds[0];
                      if (target) sendToBack(target);
                      setContextMenu(null);
                    }}
                  >
                    <IconArrowDown size={13} color="#d97706" />
                    <span style={{ fontWeight: 600 }}>En Arkaya Gönder</span>
                    <span className="shortcut">Ctrl+Shift+[</span>
                  </div>
                  <div className="context-menu-divider" />
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      if (selectedElement) {
                        updateElement(selectedElement.id, {
                          rotation: ((selectedElement.rotation || 0) + 90) % 360,
                        });
                      }
                      setContextMenu(null);
                    }}
                  >
                    <IconRotate size={13} />
                    <span>90° Sağa Döndür</span>
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      if (selectedElement) {
                        updateElement(selectedElement.id, {
                          locked: !selectedElement.locked,
                        });
                      }
                      setContextMenu(null);
                    }}
                  >
                    <IconLock size={13} />
                    <span>{selectedElement?.locked ? "Kilidi Aç" : "Kilitle"}</span>
                  </div>
                  <div className="context-menu-divider" />
                  <div
                    className="context-menu-item danger"
                    onClick={() => {
                      if (selectedIds.length > 0) {
                        dispatch({ type: "DELETE_ELEMENTS", ids: selectedIds });
                        setSelectedIds([]);
                      }
                      setContextMenu(null);
                    }}
                  >
                    <IconTrash size={13} />
                    <span>Sil</span>
                    <span className="shortcut">Del</span>
                  </div>
                </>
              );
            })()
          ) : (
            <>
              <div
                className="context-menu-item"
                onClick={() => {
                  if (clipboard.length > 0) {
                    const newEls = clipboard.map((el) => ({
                      ...el,
                      id: genId(),
                      x: el.x + 3,
                      y: el.y + 3,
                      zIndex: Math.max(0, ...elements.map((e) => e.zIndex)) + 1,
                    }));
                    newEls.forEach((el) => dispatch({ type: "ADD_ELEMENT", element: el }));
                    setSelectedIds(newEls.map((el) => el.id));
                  }
                  setContextMenu(null);
                }}
              >
                <IconCopy size={13} />
                <span>Yapıştır</span>
                <span className="shortcut">Ctrl+V</span>
              </div>
              <div
                className="context-menu-item"
                onClick={() => {
                  setSelectedIds(elements.map((el) => el.id));
                  setContextMenu(null);
                }}
              >
                <IconLayoutGrid size={13} />
                <span>Tümünü Seç</span>
                <span className="shortcut">Ctrl+A</span>
              </div>
              <div className="context-menu-divider" />
              <div
                className="context-menu-item"
                onClick={() => {
                  setZoom(1.5);
                  setContextMenu(null);
                }}
              >
                <IconMaximize size={13} />
                <span>Zoom Sıfırla (%150)</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── 🔭 DÜRBÜN MODALI: Kayıtlı Şablon Arama & Seçim ────────────────── */}
      <Modal
        show={durbunModal}
        onHide={() => setDurbunModal(false)}
        size="lg"
        centered
        className="dark-modal"
      >
        <Modal.Header closeButton style={{ background: "#0f172a", borderColor: "#334155", color: "#f8fafc" }}>
          <Modal.Title style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}>
            <IconBinoculars size={18} color="#38bdf8" />
            <span>Kayıtlı Etiket Şablonları</span>
          </Modal.Title>

        </Modal.Header>
        <Modal.Body style={{ background: "#1e293b", color: "#e2e8f0" }}>
          {/* Arama & Tip Filtresi */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input
              type="text"
              className="prop-input"
              style={{ flex: 1, padding: "6px 10px", fontSize: 12.5 }}
              placeholder="Şablon adına göre ara..."
              value={durbunFilter}
              onChange={(e) => setDurbunFilter(e.target.value)}
              autoFocus
            />
            <select
              className="prop-input"
              style={{ width: 170, fontSize: 12 }}
              value={durbunTipFilter}
              onChange={(e) => setDurbunTipFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">Tüm Kategoriler</option>
              {ETIKET_TIPLERI.map((t) => (
                <option key={t.value} value={t.value}>{t.icon} {t.ad}</option>
              ))}
            </select>
          </div>

          {/* Şablon Kartları Izgarası */}
          <div style={{ maxHeight: 440, overflowY: "auto", paddingRight: 4 }}>
            {filteredSablonlar.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#64748b", fontSize: 13 }}>
                Kayıtlı şablon bulunamadı
              </div>
            ) : (
              <div className="sablon-grid">
                {filteredSablonlar.map((s) => {
                  const tip = ETIKET_TIPLERI.find((t) => t.value === s.etiketTipi);
                  const sekil = ETIKET_SEKILLERI.find((x) => x.value === s.etiketSekli);
                  const isSelected = durbunSelectedId === s.etiketSablonId;
                  const isActive = activeSablon?.etiketSablonId === s.etiketSablonId;

                  return (
                    <div
                      key={s.etiketSablonId}
                      className={`sablon-card ${isSelected ? "selected-card" : ""} ${isActive ? "active" : ""}`}
                      onClick={() => setDurbunSelectedId(s.etiketSablonId)}
                      onDoubleClick={() => {
                        handleLoadSablon(s);
                        setDurbunModal(false);
                      }}
                      title="1 Tık: Seçin | Çift Tık: Doğrudan Yükleyin"
                    >
                      {/* Gerçekçi Görsel Etiket Önizleme Fotoğrafı */}
                      <div className="sablon-card-preview">
                        <SablonThumbnail sablon={s} />
                        <Badge
                          bg="secondary"
                          style={{
                            position: "absolute",
                            top: 4,
                            right: 4,
                            fontSize: 8.5,
                            background: "rgba(15, 23, 42, 0.85)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            backdropFilter: "blur(4px)",
                            zIndex: 10,
                          }}
                        >
                          {sekil?.ad || tip?.ad || "Etiket"}
                        </Badge>
                      </div>

                      <div className="sablon-card-name" title={s.ad}>
                        {s.ad}
                      </div>
                      <div className="sablon-card-meta">
                        <span>{s.genislikMm}×{s.yukseklikMm} mm</span>
                        <span>•</span>
                        <span>{s.alanlar?.length || 0} alan</span>
                      </div>

                      <div style={{ display: "flex", gap: 5, marginTop: "auto" }}>
                        <button
                          type="button"
                          style={{
                            flex: 1,
                            padding: "4px 0",
                            background: isSelected ? "#0284c7" : "#334155",
                            border: "none",
                            borderRadius: 4,
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadSablon(s);
                            setDurbunModal(false);
                          }}
                        >
                          {isSelected ? "✓ Yükle" : "Yükle"}
                        </button>
                        <button
                          type="button"
                          style={{
                            padding: "4px 8px",
                            background: "rgba(239,68,68,0.12)",
                            border: "1px solid rgba(239,68,68,0.25)",
                            borderRadius: 4,
                            color: "#f87171",
                            fontSize: 10.5,
                            cursor: "pointer",
                          }}
                          title="Şablonu Sil"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`"${s.ad}" şablonunu silmek istiyor musunuz?`)) {
                              await EtiketService.deleteSablon(s.etiketSablonId);
                              loadSablonlarList();
                              if (durbunSelectedId === s.etiketSablonId) {
                                setDurbunSelectedId(null);
                              }
                            }
                          }}
                        >
                          <IconTrash size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer style={{ background: "#0f172a", borderColor: "#334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            💡 <strong>İpucu:</strong> Şablonu seçmek için <strong>1 kez</strong>, yüklemek için <strong>2 kez (çift tık)</strong> tıklayın.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ padding: "5px 14px", background: "transparent", border: "1px solid #334155", borderRadius: 5, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
              onClick={() => setDurbunModal(false)}
            >
              Kapat
            </button>
            {(() => {
              const selectedItem = sablonlar.find((s) => s.etiketSablonId === durbunSelectedId);
              return (
                <button
                  style={{
                    padding: "5px 16px",
                    background: selectedItem ? "#0284c7" : "#334155",
                    border: "none",
                    borderRadius: 5,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: selectedItem ? "pointer" : "not-allowed",
                    opacity: selectedItem ? 1 : 0.5,
                  }}
                  disabled={!selectedItem}
                  onClick={() => {
                    if (selectedItem) {
                      handleLoadSablon(selectedItem);
                      setDurbunModal(false);
                    }
                  }}
                >
                  Seçili Şablonu Yükle
                </button>
              );
            })()}
          </div>
        </Modal.Footer>
      </Modal>

      {/* ── Kaydet Modal ──────────────────────────────────────────────── */}
      <Modal
        show={saveModal}
        onHide={() => setSaveModal(false)}
        centered
        className="dark-modal"
      >
        <Modal.Header closeButton style={{ background: "#0f172a", borderColor: "#334155", color: "#f8fafc" }}>
          <Modal.Title style={{ fontSize: 15 }}>💾 Şablonu Kaydet</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: "#1e293b", color: "#e2e8f0" }}>
          <div style={{ marginBottom: 6, fontSize: 12, color: "#94a3b8" }}>
            Şablon Adı:
          </div>
          <input
            type="text"
            className="prop-input"
            style={{ width: "100%", padding: "7px 10px", fontSize: 13 }}
            placeholder="örn: 65mm Altın Kelebek Etiketi"
            value={sablonAdi}
            onChange={(e) => setSablonAdi(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            autoFocus
          />
          <div style={{ marginTop: 12, fontSize: 11.5, color: "#94a3b8", background: "#0f172a", padding: "8px 10px", borderRadius: 5, border: "1px solid #334155" }}>
            <div>📐 <strong>Boyut:</strong> {labelConfig.genislikMm}×{labelConfig.yukseklikMm} mm</div>
            <div>🦋 <strong>Şekil:</strong> {ETIKET_SEKILLERI.find((s) => s.value === labelConfig.etiketSekli)?.ad}</div>
            <div>🔢 <strong>Eleman Sayısı:</strong> {elements.length} nesne</div>
          </div>
        </Modal.Body>
        <Modal.Footer style={{ background: "#0f172a", borderColor: "#334155" }}>
          <button
            style={{ padding: "5px 14px", background: "transparent", border: "1px solid #334155", borderRadius: 5, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
            onClick={() => setSaveModal(false)}
          >
            İptal
          </button>
          <button
            style={{ padding: "5px 18px", background: "#0284c7", border: "none", borderRadius: 5, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.7 : 1 }}
            onClick={handleSave}
            disabled={loading || !sablonAdi.trim()}
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </Modal.Footer>
      </Modal>

      {/* ── ✏️ Şablon İsmini Değiştir Modalı ────────────────────────────── */}
      <Modal
        show={editTitleModal}
        onHide={() => setEditTitleModal(false)}
        centered
        className="dark-modal"
      >
        <Modal.Header closeButton style={{ background: "#0f172a", borderColor: "#334155", color: "#f8fafc" }}>
          <Modal.Title style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 7 }}>
            <IconEdit size={17} color="#38bdf8" />
            <span>Şablon İsmini Düzenle</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: "#1e293b", color: "#e2e8f0" }}>
          <div style={{ marginBottom: 6, fontSize: 12, color: "#94a3b8" }}>
            Yeni Şablon Adı:
          </div>
          <input
            type="text"
            className="prop-input"
            style={{ width: "100%", padding: "7px 10px", fontSize: 13 }}
            placeholder="Şablon Adı Giriniz..."
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && titleInput.trim()) {
                setSablonAdi(titleInput.trim());
                if (activeSablon) {
                  setActiveSablon({ ...activeSablon, ad: titleInput.trim() });
                }
                setEditTitleModal(false);
              }
            }}
            autoFocus
          />
        </Modal.Body>
        <Modal.Footer style={{ background: "#0f172a", borderColor: "#334155" }}>
          <button
            style={{ padding: "5px 14px", background: "transparent", border: "1px solid #334155", borderRadius: 5, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
            onClick={() => setEditTitleModal(false)}
          >
            İptal
          </button>
          <button
            style={{ padding: "5px 18px", background: "#0284c7", border: "none", borderRadius: 5, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            onClick={() => {
              if (titleInput.trim()) {
                setSablonAdi(titleInput.trim());
                if (activeSablon) {
                  setActiveSablon({ ...activeSablon, ad: titleInput.trim() });
                }
                setEditTitleModal(false);
              }
            }}
            disabled={!titleInput.trim()}
          >
            Uygula
          </button>
        </Modal.Footer>
      </Modal>

      {/* ── 📐 Etiket Boyut & Geometri Yapılandırma Modalı ────────────────── */}
      <Modal
        show={shapeModalOpen}
        onHide={() => setShapeModalOpen(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton style={{ background: "#ffffff", borderColor: "#e2e8f0", color: "#0f172a" }}>
          <Modal.Title style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
            <IconAdjustmentsHorizontal size={20} color="#0284c7" />
            <span>📐 Etiket Boyut & Geometri Ayarları</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: "#f8fafc", color: "#0f172a", maxHeight: "75vh", overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16 }}>
            {/* Sol: Etiket Modelleri & Kesim Şekli Seçimi */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0284c7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>1. Etiket Kesim Şekli & Modeli</span>
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
                  ({ETIKET_SEKILLERI.length} Farklı Model)
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxHeight: "58vh", overflowY: "auto", paddingRight: 4 }}>
                {ETIKET_SEKILLERI.map((s) => {
                  const isSel = labelConfig.etiketSekli === s.value;
                  return (
                    <div
                      key={s.value}
                      style={{
                        padding: "10px 12px",
                        background: isSel ? "#eff6ff" : "#ffffff",
                        border: isSel ? "2px solid #0284c7" : "1px solid #cbd5e1",
                        borderRadius: 8,
                        cursor: "pointer",
                        boxShadow: isSel ? "0 2px 8px rgba(2,132,199,0.2)" : "0 1px 3px rgba(0,0,0,0.04)",
                        transition: "all 0.15s ease",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                      onClick={() => updateLabelConfig({ etiketSekli: s.value as any })}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 20 }}>{s.icon}</span>
                        {isSel && (
                          <span style={{ fontSize: 10, background: "#0284c7", color: "#ffffff", padding: "1px 6px", borderRadius: 10, fontWeight: 700 }}>
                            ✓ Seçili
                          </span>
                        )}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 12, color: isSel ? "#0284c7" : "#0f172a", marginTop: 4 }}>
                        {s.ad}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b", lineHeight: 1.25 }}>
                        {s.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sağ: Tüm Milimetrik Boyutlar & Geometri Parametreleri */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#0284c7" }}>
                2. Tüm Milimetrik Ölçü ve Geometri Ayarları
              </div>

              {/* Ana Ölçüler */}
              <div style={{ background: "#ffffff", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 11.5, color: "#0f172a", marginBottom: 8, borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                  📏 Genel Boyutlar
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Toplam Genişlik (En):</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: "100%", textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                        value={labelConfig.genislikMm}
                        min={5}
                        max={300}
                        step={0.5}
                        onChange={(e) => updateLabelConfig({ genislikMm: Number(e.target.value) || 10 })}
                      />
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>mm</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Toplam Yükseklik (Boy):</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: "100%", textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                        value={labelConfig.yukseklikMm}
                        min={3}
                        max={200}
                        step={0.5}
                        onChange={(e) => updateLabelConfig({ yukseklikMm: Number(e.target.value) || 5 })}
                      />
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>mm</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #f1f5f9" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569" }}>🔘 Köşe Yuvarlatma (Radyus):</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: 65, textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                        value={labelConfig.koseYuvarlikligiMm || 0}
                        min={0}
                        max={30}
                        step={0.5}
                        onChange={(e) => updateLabelConfig({ koseYuvarlikligiMm: Math.max(0, Number(e.target.value) || 0) })}
                      />
                      <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>mm</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    style={{ width: "100%", accentColor: "#0284c7", cursor: "pointer" }}
                    min={0}
                    max={25}
                    step={0.5}
                    value={labelConfig.koseYuvarlikligiMm || 0}
                    onChange={(e) => updateLabelConfig({ koseYuvarlikligiMm: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Boğum, Kuyruk, Kanat ve Köprü Detayları */}
              <div style={{ background: "#ffffff", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ fontWeight: 700, fontSize: 11.5, color: "#0f172a", marginBottom: 8, borderBottom: "1px solid #f1f5f9", paddingBottom: 4 }}>
                  🦴 Boğum, Kuyruk & Kanat Detayları
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Sol Kanat / Gövde:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: "100%", textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                        value={labelConfig.solKanatMm ?? 28}
                        min={1}
                        max={150}
                        step={0.5}
                        onChange={(e) => updateLabelConfig({ solKanatMm: Number(e.target.value) || 1 })}
                      />
                      <span style={{ fontSize: 11, color: "#64748b" }}>mm</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>Sağ Kanat Genişliği:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: "100%", textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                        value={labelConfig.sagKanatMm ?? 28}
                        min={1}
                        max={150}
                        step={0.5}
                        onChange={(e) => updateLabelConfig({ sagKanatMm: Number(e.target.value) || 1 })}
                      />
                      <span style={{ fontSize: 11, color: "#64748b" }}>mm</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>✂️ Boğum Derinliği:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: "100%", textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                        value={labelConfig.bogumDerinlikMm ?? 2.0}
                        min={0}
                        max={25}
                        step={0.2}
                        onChange={(e) => updateLabelConfig({ bogumDerinlikMm: Number(e.target.value) || 0 })}
                      />
                      <span style={{ fontSize: 11, color: "#64748b" }}>mm</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>🎗️ Kuyruk Uzunluğu:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: "100%", textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                        value={labelConfig.kuyrukGenislikMm ?? 35}
                        min={1}
                        max={200}
                        step={0.5}
                        onChange={(e) => updateLabelConfig({ kuyrukGenislikMm: Number(e.target.value) || 1 })}
                      />
                      <span style={{ fontSize: 11, color: "#64748b" }}>mm</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>📏 Kuyruk Kalınlığı (Yükseklik):</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: "100%", textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                        value={labelConfig.kuyrukKalinlikMm ?? 4}
                        min={1}
                        max={40}
                        step={0.5}
                        onChange={(e) => updateLabelConfig({ kuyrukKalinlikMm: Number(e.target.value) || 1 })}
                      />
                      <span style={{ fontSize: 11, color: "#64748b" }}>mm</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>🌉 Köprü Genişliği:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="number"
                        className="prop-input"
                        style={{ width: "100%", textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                        value={labelConfig.kopruGenislikMm ?? 6}
                        min={1}
                        max={60}
                        step={0.5}
                        onChange={(e) => updateLabelConfig({ kopruGenislikMm: Number(e.target.value) || 1 })}
                      />
                      <span style={{ fontSize: 11, color: "#64748b" }}>mm</span>
                    </div>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 3 }}>🌉 Köprü Yüksekliği:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      className="prop-input"
                      style={{ width: 80, textAlign: "center", background: "#f8fafc", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                      value={labelConfig.kopruYukseklikMm ?? 18}
                      min={1}
                      max={120}
                      step={0.5}
                      onChange={(e) => updateLabelConfig({ kopruYukseklikMm: Number(e.target.value) || 1 })}
                    />
                    <span style={{ fontSize: 11, color: "#64748b" }}>mm</span>
                  </div>
                </div>
              </div>

              {/* Katlama Çizgisi & Delik Ayarları */}
              <div style={{ background: "#ffffff", padding: 12, borderRadius: 8, border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label className="small-form-check" style={{ cursor: "pointer", margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={labelConfig.katlamaCizgisi}
                    onChange={(e) => updateLabelConfig({ katlamaCizgisi: e.target.checked })}
                  />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: "#1e293b" }}>Katlama Kılavuz Çizgisi</span>
                </label>

                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Kart Rengi:</span>
                  <div className="color-swatch" style={{ background: labelConfig.bgColor, width: 22, height: 22, borderRadius: 4 }}>
                    <input
                      type="color"
                      value={labelConfig.bgColor}
                      onChange={(e) => updateLabelConfig({ bgColor: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
          <button
            style={{ padding: "8px 24px", background: "#0284c7", border: "none", borderRadius: 6, color: "#ffffff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(2,132,199,0.3)" }}
            onClick={() => setShapeModalOpen(false)}
          >
            Seç ve Tasarıma Başla
          </button>
        </Modal.Footer>
      </Modal>

      {/* ── 🖨️ Yazıcı Kalibrasyon & Baskı Kaydırma Modalı ────────────────── */}
      <Modal
        show={printerModalOpen}
        onHide={() => setPrinterModalOpen(false)}
        centered
      >
        <Modal.Header closeButton style={{ background: "#ffffff", borderColor: "#e2e8f0", color: "#0f172a" }}>
          <Modal.Title style={{ fontSize: 15, display: "flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
            <IconPrinter size={18} color="#0284c7" />
            <span>🖨️ Yazıcı Milimetrik Kalibrasyonu & Kaydırma</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: "#f8fafc", color: "#0f172a" }}>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 14, lineHeight: 1.4 }}>
            Termal barkod yazıcınızın kağıt besleme veya optik sensör farklılıklarını milimetrik olarak sıfırlayabilirsiniz:
          </div>

          <div style={{ background: "#ffffff", padding: 14, borderRadius: 8, border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: 14 }}>
            {/* Yatay Sol / Sağ */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#1e293b", marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>Yatay Kaydırma (Sol / Sağ):</span>
                <span style={{ color: "#0284c7", fontWeight: 700 }}>
                  {(labelConfig.yaziciSolKaydirmaMm || 0) > 0 ? `+${labelConfig.yaziciSolKaydirmaMm}` : (labelConfig.yaziciSolKaydirmaMm || 0)} mm
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  style={{ height: 28, padding: "0 10px", fontSize: 11.5, fontWeight: 600, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, color: "#334155", cursor: "pointer" }}
                  onClick={() => updateLabelConfig({ yaziciSolKaydirmaMm: Math.round(((labelConfig.yaziciSolKaydirmaMm || 0) - 0.5) * 10) / 10 })}
                >
                  ◄ 0.5mm Sola
                </button>
                <input
                  type="number"
                  className="prop-input"
                  style={{ textAlign: "center", flex: 1, height: 28, background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                  value={labelConfig.yaziciSolKaydirmaMm || 0}
                  step={0.1}
                  onChange={(e) => updateLabelConfig({ yaziciSolKaydirmaMm: parseFloat(e.target.value) || 0 })}
                />
                <button
                  type="button"
                  style={{ height: 28, padding: "0 10px", fontSize: 11.5, fontWeight: 600, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, color: "#334155", cursor: "pointer" }}
                  onClick={() => updateLabelConfig({ yaziciSolKaydirmaMm: Math.round(((labelConfig.yaziciSolKaydirmaMm || 0) + 0.5) * 10) / 10 })}
                >
                  0.5mm Sağa ►
                </button>
              </div>
            </div>

            {/* Dikey Üst / Alt */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#1e293b", marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>Dikey Kaydırma (Yukarı / Aşağı):</span>
                <span style={{ color: "#0284c7", fontWeight: 700 }}>
                  {(labelConfig.yaziciUstKaydirmaMm ?? -0.8) > 0 ? `+${labelConfig.yaziciUstKaydirmaMm ?? -0.8}` : (labelConfig.yaziciUstKaydirmaMm ?? -0.8)} mm
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  style={{ height: 28, padding: "0 10px", fontSize: 11.5, fontWeight: 600, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, color: "#334155", cursor: "pointer" }}
                  onClick={() => updateLabelConfig({ yaziciUstKaydirmaMm: Math.round(((labelConfig.yaziciUstKaydirmaMm ?? -0.8) + 0.5) * 10) / 10 })}
                >
                  ▲ 0.5mm Yukarı
                </button>
                <input
                  type="number"
                  className="prop-input"
                  style={{ textAlign: "center", flex: 1, height: 28, background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", fontWeight: 700 }}
                  value={labelConfig.yaziciUstKaydirmaMm ?? -0.8}
                  step={0.1}
                  onChange={(e) => updateLabelConfig({ yaziciUstKaydirmaMm: parseFloat(e.target.value) || 0 })}
                />
                <button
                  type="button"
                  style={{ height: 28, padding: "0 10px", fontSize: 11.5, fontWeight: 600, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, color: "#334155", cursor: "pointer" }}
                  onClick={() => updateLabelConfig({ yaziciUstKaydirmaMm: Math.round(((labelConfig.yaziciUstKaydirmaMm ?? -0.8) - 0.5) * 10) / 10 })}
                >
                  ▼ 0.5mm Aşağı
                </button>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer style={{ background: "#ffffff", borderColor: "#e2e8f0" }}>
          <button
            style={{ padding: "8px 24px", background: "#0284c7", border: "none", borderRadius: 6, color: "#ffffff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(2,132,199,0.3)" }}
            onClick={() => setPrinterModalOpen(false)}
          >
            Kaydet ve Kapat
          </button>
        </Modal.Footer>
      </Modal>

      {/* ── 🗄️ Hızlı Veritabanı Alanları Modalı ────────────────────────────── */}
      <Modal
        show={fieldsModalOpen}
        onHide={() => setFieldsModalOpen(false)}
        centered
        size="lg"
        className="dark-modal"
      >
        <Modal.Header closeButton style={{ background: "#0f172a", borderColor: "#334155", color: "#f8fafc" }}>
          <Modal.Title style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <IconDatabase size={18} color="#38bdf8" />
            <span>🗄️ Veritabanı Alanı Ekle (Tıkla ve Etikete Yerleştir)</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ background: "#1e293b", color: "#e2e8f0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
            {[
              { key: "barkod", label: "Barkod Numarası", type: "field", sample: "8690001492", icon: "📊", cat: "Temel" },
              { key: "urunAdi", label: "Ürün Adı / Cinsi", type: "field", sample: "14K Altın Bileklik", icon: "🏷️", cat: "Temel" },
              { key: "ayar", label: "Ayar / Karat", type: "field", sample: "585 14K", icon: "✨", cat: "Altın" },
              { key: "gramaj", label: "Net Gramaj", type: "field", sample: "3.45 gr", icon: "⚖️", cat: "Altın", isNumeric: true },
              { key: "brutGram", label: "Brüt Gramaj", type: "field", sample: "3.60 gr", icon: "⚖️", cat: "Altın", isNumeric: true },
              { key: "hasGram", label: "Has Gramajı", type: "field", sample: "2.02 gr", icon: "🪙", cat: "Altın", isNumeric: true },
              { key: "satisIscilik", label: "Satış İşçilik Tutarı", type: "field", sample: "₺180/gr", icon: "🔨", cat: "Fiyat" },
              { key: "fiyat", label: "Satış Fiyatı", type: "field", sample: "₺14.250", icon: "💰", cat: "Fiyat" },
              { key: "milyem", label: "Milyem Değeri", type: "field", sample: "0.585", icon: "📐", cat: "Altın" },
              { key: "tasKarat", label: "Taş Karatı / Cinsi", type: "field", sample: "0.15 ct VS1", icon: "💎", cat: "Pırlanta" },
              { key: "epcAlani", label: "RFID EPC Kodu", type: "field", sample: "E280116060000", icon: "📡", cat: "RFID" },
              { key: "tarih", label: "Üretim / Giriş Tarihi", type: "field", sample: "25.09.2026", icon: "📅", cat: "Genel" },
            ].map((f) => (
              <div
                key={f.key}
                style={{
                  padding: "10px 12px",
                  background: "rgba(15,23,42,0.6)",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "all 0.15s ease",
                }}
                onClick={() => {
                  addElement({
                    type: "field",
                    fieldKey: f.key,
                    text: f.sample,
                    fontSize: 8,
                    color: "#000000",
                    textAlign: f.isNumeric ? "right" : "left",
                    width: f.isNumeric ? 18 : 24,
                    height: 4.5,
                  });
                  setFieldsModalOpen(false);
                }}
              >
                <span style={{ fontSize: 20 }}>{f.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#f8fafc" }}>{f.label}</div>
                  <div style={{ fontSize: 10, color: "#38bdf8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Örn: {f.sample}
                  </div>
                </div>
                <span style={{ color: "#38bdf8", fontSize: 11, fontWeight: 700 }}>+ Ekle</span>
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer style={{ background: "#0f172a", borderColor: "#334155" }}>
          <button
            style={{ padding: "6px 16px", background: "transparent", border: "1px solid #334155", borderRadius: 6, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
            onClick={() => setFieldsModalOpen(false)}
          >
            Kapat
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default UrunEtiketTasarimiPage;

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
  IconDeviceFloppy,
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

// ─── Dürbün İkonu (Binoculars) ───────────────────────────────────────────────
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

// ─── Sabitler ────────────────────────────────────────────────────────────────

const PX_PER_MM = 3.7795275591; // 96dpi

const FONT_FAMILIES = [
  "Inter",
  "Arial",
  "Arial Narrow",
  "Courier New",
  "Georgia",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
  "Comic Sans MS",
  "Impact",
  "Lucida Console",
  "Palatino Linotype",
  "Tahoma",
  "Century Gothic",
  "Franklin Gothic Medium",
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
  { value: "dambil", ad: "Dambıl (Yüzük)", icon: "🦴", desc: "İki yuvarlak başlık, ince köprü" },
  { value: "rfid", ad: "Kablosuz RFID", icon: "📡", desc: "Dahili anten ve çip alanı" },
  { value: "dikdortgen", ad: "Standart Dikdörtgen", icon: "▬", desc: "Klasik kuyumcu kartı" },
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

const POPULAR_SIZES = [
  { ad: "65×22 mm (Kelebek)", icon: "🦋", config: { genislikMm: 65, yukseklikMm: 22, etiketSekli: "kelebek" as const, solKanatMm: 28, kopruGenislikMm: 9 } },
  { ad: "70×15 mm (Kuyruklu)", icon: "🏷️", config: { genislikMm: 70, yukseklikMm: 15, etiketSekli: "kuyruklu" as const, kuyrukGenislikMm: 35, kuyrukKalinlikMm: 4 } },
  { ad: "80×12 mm (Dambıl)", icon: "🦴", config: { genislikMm: 80, yukseklikMm: 12, etiketSekli: "dambil" as const, solKanatMm: 35, kopruYukseklikMm: 4 } },
  { ad: "45×10 mm (Mini)", icon: "▬", config: { genislikMm: 45, yukseklikMm: 10, etiketSekli: "dikdortgen" as const } },
  { ad: "50×20 mm (Kare)", icon: "▬", config: { genislikMm: 50, yukseklikMm: 20, etiketSekli: "dikdortgen" as const } },
  { ad: "72×18 mm (RFID)", icon: "📡", config: { genislikMm: 72, yukseklikMm: 18, etiketSekli: "rfid" as const } },
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
  fieldKey?: string;
  prefix?: string;
  suffix?: string;
  fontSize?: number; // pt
  fontFamily?: string;
  fontWeight?: "normal" | "bold" | "600";
  fontStyle?: "normal" | "italic";
  textDecoration?: "none" | "underline";
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
}

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
    ad: "14K / 22K Kelebek Sarrafiye (Standart)",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "🦋",
    aciklama: "65×22 mm çift kanatlı klasik kuyumcu barkod ve gramaj etiketi",
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
      { type: "text", x: 2, y: 2, width: 24, height: 4, text: "LİKYA KUYUMCULUK", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "barcode", x: 2, y: 7, width: 24, height: 7.5, barcodeValue: "140829104", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 16, width: 24, height: 4.5, text: "₺ 18.450", fontSize: 9.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 34, y: 2, width: 28, height: 4, text: "14K Dorika Kolye", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "field", x: 34, y: 7, width: 14, height: 3.5, fieldKey: "ayar", text: "585 14K", fontSize: 7, color: "#000" },
      { type: "field", x: 48, y: 7, width: 14, height: 3.5, fieldKey: "gramaj", text: "3.42 gr", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "field", x: 34, y: 11.5, width: 28, height: 3.5, fieldKey: "satisIscilik", text: "İşçilik: ₺140/g", fontSize: 6.5, color: "#475569" },
      { type: "field", x: 34, y: 16, width: 28, height: 3.5, fieldKey: "barkod", text: "KOD: KL-8492", fontSize: 6.5, color: "#64748b" },
    ],
  },
  {
    id: "builtin_2",
    ad: "Özel Pırlanta & Tektaş Sertifika Etiketi",
    kategori: "Özel / Pırlanta",
    etiketTipi: 1,
    icon: "💎",
    aciklama: "70×20 mm karat, renk, berraklık ve QR sertifika bağlantılı pırlanta etiketi",
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
      { type: "text", x: 2, y: 2, width: 18, height: 4, text: "DIAMOND VIP", fontSize: 7, fontWeight: "bold", color: "#0284c7" },
      { type: "qr", x: 21, y: 2, width: 7.5, height: 7.5, barcodeValue: "https://cert.likyakuyum.com/D8492", barcodeFormat: "QR" },
      { type: "barcode", x: 2, y: 10, width: 26, height: 5.5, barcodeValue: "PIRL-94021", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 16, width: 26, height: 3.5, text: "$ 1.450 / ₺ 49.000", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 36, y: 2, width: 30, height: 3.5, text: "0.45 CT Tektaş Yüzük", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 36, y: 6.5, width: 15, height: 3.5, text: "Renk: F", fontSize: 7, color: "#000" },
      { type: "text", x: 52, y: 6.5, width: 15, height: 3.5, text: "Berraklık: VS1", fontSize: 7, color: "#000" },
      { type: "text", x: 36, y: 11, width: 30, height: 3.5, text: "Ağırlık: 2.85 gr (18K)", fontSize: 6.5, color: "#475569" },
      { type: "text", x: 36, y: 15.5, width: 30, height: 3.5, text: "HRD Sertifika: 240981", fontSize: 6.5, color: "#0284c7" },
    ],
  },
  {
    id: "builtin_3",
    ad: "Uzun Kuyruklu Bilezik / İpli Kolye",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "🏷️",
    aciklama: "85×16 mm gövde ve 45mm ekstra uzun kordonlu katlamalı bilezik etiketi",
    config: {
      etiketTipi: 0,
      etiketSekli: "kuyruklu",
      genislikMm: 85,
      yukseklikMm: 16,
      solKanatMm: 40,
      sagKanatMm: 45,
      kopruGenislikMm: 6,
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
      { type: "barcode", x: 2, y: 2, width: 22, height: 6, barcodeValue: "220849102", barcodeFormat: "CODE128" },
      { type: "text", x: 25, y: 2, width: 13, height: 3.5, text: "22 AYAR", fontSize: 7, fontWeight: "bold", color: "#b45309" },
      { type: "text", x: 25, y: 5.5, width: 13, height: 3.5, text: "14.80 g", fontSize: 8, fontWeight: "bold", color: "#000" },
      { type: "text", x: 2, y: 9, width: 36, height: 3.5, text: "Ajda Bilezik 22K", fontSize: 7, color: "#000" },
      { type: "text", x: 2, y: 12.5, width: 36, height: 3.5, text: "₺ 48.950", fontSize: 8.5, fontWeight: "bold", color: "#000" },
    ],
  },
  {
    id: "builtin_4",
    ad: "Dambıl Yüzük & Alyans Etiketi",
    kategori: "Yüzük / Dambıl",
    etiketTipi: 2,
    icon: "🦴",
    aciklama: "60×14 mm iki oval başlıklı yüzük ve alyans etiketi",
    config: {
      etiketTipi: 2,
      etiketSekli: "dambil",
      genislikMm: 60,
      yukseklikMm: 14,
      solKanatMm: 26,
      sagKanatMm: 26,
      kopruGenislikMm: 8,
      bogumDerinlikMm: 3.0,
      kopruYukseklikMm: 8,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "barcode", x: 2, y: 2, width: 18, height: 5.5, barcodeValue: "YZ-8402", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 8.5, width: 18, height: 3.5, text: "ÖLÇÜ: 14", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 38, y: 2, width: 18, height: 3.5, text: "2.85 gr 14K", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 38, y: 6, width: 18, height: 3, text: "KOD: ALY-10", fontSize: 6.5, color: "#64748b" },
      { type: "text", x: 38, y: 9.5, width: 18, height: 3.5, text: "₺ 8.250", fontSize: 8, fontWeight: "bold", color: "#000" },
    ],
  },
  {
    id: "builtin_5",
    ad: "24K Yatırımlık Çeyrek / Yarım Altın",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "🪙",
    aciklama: "50×18 mm çeyrek, yarım, cumhuriyet ve gram külçe altın etiketi",
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
      { type: "text", x: 2, y: 2, width: 18, height: 3.5, text: "DARPHANE", fontSize: 7, fontWeight: "bold", color: "#b45309" },
      { type: "barcode", x: 2, y: 6, width: 18, height: 6, barcodeValue: "CYR-2026", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 13, width: 18, height: 3.5, text: "1.75 gr Has", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 28, y: 2, width: 20, height: 3.5, text: "YENİ ÇEYREK", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 28, y: 6.5, width: 20, height: 3, text: "Ayar: 916 (22K)", fontSize: 6.5, color: "#475569" },
      { type: "text", x: 28, y: 10, width: 20, height: 3, text: "Kur: ₺ 3.140", fontSize: 6.5, color: "#64748b" },
      { type: "text", x: 28, y: 13.5, width: 20, height: 4, text: "₺ 5.580", fontSize: 8.5, fontWeight: "bold", color: "#000" },
    ],
  },
  {
    id: "builtin_6",
    ad: "Kablosuz RFID Akıllı Mağaza Etiketi",
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
    ad: "Saat & 925 Gümüş Özel Etiketi",
    kategori: "Fiyat & Ayar",
    etiketTipi: 3,
    icon: "⌚",
    aciklama: "60×18 mm saat, gümüş ve aksesuar fiyat ve ayar etiketi",
    config: {
      etiketTipi: 3,
      etiketSekli: "kelebek",
      genislikMm: 60,
      yukseklikMm: 18,
      solKanatMm: 26,
      sagKanatMm: 26,
      kopruGenislikMm: 6,
      bogumDerinlikMm: 1.5,
      kopruYukseklikMm: 15,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "text", x: 2, y: 2, width: 22, height: 4, text: "SILVER & WATCH", fontSize: 7, fontWeight: "bold", color: "#475569" },
      { type: "barcode", x: 2, y: 6.5, width: 22, height: 6, barcodeValue: "SLV-90412", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 13.5, width: 22, height: 3.5, text: "₺ 2.450", fontSize: 8.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 32, y: 2, width: 26, height: 3.5, text: "Gümüş Baget Yüzük", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 32, y: 6, width: 26, height: 3, text: "925 Ayar Gümüş", fontSize: 6.5, color: "#475569" },
      { type: "text", x: 32, y: 9.5, width: 26, height: 3, text: "Ağırlık: 4.80 gr", fontSize: 6.5, color: "#000" },
      { type: "text", x: 32, y: 13, width: 26, height: 3, text: "2 Yıl Garanti Belgeli", fontSize: 6, color: "#059669" },
    ],
  },
  {
    id: "builtin_8",
    ad: "Firma Logolu VIP Lüks Etiket",
    kategori: "Özel / Pırlanta",
    etiketTipi: 1,
    icon: "👑",
    aciklama: "75×22 mm özel marka logolu, yüksek prestijli mücevher kartı",
    config: {
      etiketTipi: 1,
      etiketSekli: "kelebek",
      genislikMm: 75,
      yukseklikMm: 22,
      solKanatMm: 32,
      sagKanatMm: 32,
      kopruGenislikMm: 7,
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
      { type: "image", x: 3, y: 2, width: 14, height: 6, imageData: JEWELRY_LOGOS[0].dataUrl },
      { type: "barcode", x: 3, y: 9, width: 26, height: 6.5, barcodeValue: "VIP-10842", barcodeFormat: "CODE128" },
      { type: "text", x: 3, y: 16.5, width: 26, height: 4, text: "₺ 84.000", fontSize: 9, fontWeight: "bold", color: "#b45309" },
      { type: "text", x: 40, y: 2, width: 32, height: 4, text: "VIP Özel Tasarım Gerdanlık", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 40, y: 7, width: 16, height: 3.5, text: "18K (750)", fontSize: 7, color: "#000" },
      { type: "text", x: 56, y: 7, width: 16, height: 3.5, text: "12.40 gr", fontSize: 7.5, fontWeight: "bold", color: "#000" },
      { type: "text", x: 40, y: 11.5, width: 32, height: 3.5, text: "Pırlanta: 0.25 CT H-SI", fontSize: 6.5, color: "#0284c7" },
      { type: "text", x: 40, y: 16, width: 32, height: 3.5, text: "Sertifika No: LK-2026-09", fontSize: 6.5, color: "#64748b" },
    ],
  },
  {
    id: "builtin_9",
    ad: "Promosyon & İndirimli Ürün Etiketi",
    kategori: "Fiyat & Ayar",
    etiketTipi: 3,
    icon: "🔥",
    aciklama: "55×20 mm üzeri çizili eski fiyat ve indirimli net fiyat etiketi",
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
      { type: "text", x: 2, y: 2, width: 22, height: 4, text: "🔥 %20 İNDİRİM", fontSize: 7.5, fontWeight: "bold", color: "#dc2626" },
      { type: "barcode", x: 2, y: 7, width: 22, height: 6.5, barcodeValue: "PRM-5821", barcodeFormat: "CODE128" },
      { type: "text", x: 2, y: 14.5, width: 22, height: 3.5, text: "KOD: IND-20", fontSize: 6.5, color: "#64748b" },
      { type: "text", x: 28, y: 2, width: 24, height: 4, text: "14K İtalyan Zincir", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 28, y: 6.5, width: 24, height: 3, text: "Ağırlık: 4.50 gr", fontSize: 6.5, color: "#000" },
      { type: "text", x: 28, y: 10, width: 24, height: 3.5, text: "₺ 22.000", fontSize: 7.5, textDecoration: "underline", color: "#94a3b8" },
      { type: "text", x: 28, y: 14, width: 24, height: 4.5, text: "₺ 17.600", fontSize: 9.5, fontWeight: "bold", color: "#dc2626" },
    ],
  },
  {
    id: "builtin_10",
    ad: "Takı Seti & Gerdanlık Geniş Etiket",
    kategori: "Altın / Sarrafiye",
    etiketTipi: 0,
    icon: "✨",
    aciklama: "80×25 mm çok parçalı takı setleri için geniş detaylı etiket",
    config: {
      etiketTipi: 0,
      etiketSekli: "kelebek",
      genislikMm: 80,
      yukseklikMm: 25,
      solKanatMm: 35,
      sagKanatMm: 35,
      kopruGenislikMm: 7,
      bogumDerinlikMm: 2.0,
      kopruYukseklikMm: 21,
      kuyrukGenislikMm: 35,
      kuyrukKalinlikMm: 4,
      delikCapiMm: 0,
      delikKonumu: "yok",
      katlamaCizgisi: true,
      bgColor: "#ffffff",
      bgTexture: "beyaz",
    },
    elements: [
      { type: "text", x: 3, y: 2, width: 30, height: 4, text: "3'LÜ DÜĞÜN SETİ", fontSize: 8, fontWeight: "bold", color: "#b45309" },
      { type: "barcode", x: 3, y: 7.5, width: 28, height: 8, barcodeValue: "SET-30948", barcodeFormat: "CODE128" },
      { type: "text", x: 3, y: 17.5, width: 28, height: 5, text: "₺ 142.000", fontSize: 10, fontWeight: "bold", color: "#000" },
      { type: "text", x: 42, y: 2, width: 35, height: 4, text: "Gerdanlık + Bileklik + Küpe", fontSize: 7, fontWeight: "bold", color: "#000" },
      { type: "text", x: 42, y: 7, width: 17, height: 3.5, text: "22K (916)", fontSize: 7.5, color: "#b45309" },
      { type: "text", x: 59, y: 7, width: 18, height: 3.5, text: "42.80 gr", fontSize: 8, fontWeight: "bold", color: "#000" },
      { type: "text", x: 42, y: 12, width: 35, height: 3.5, text: "Has Ağırlık: 39.20 gr Has", fontSize: 6.5, color: "#475569" },
      { type: "text", x: 42, y: 16.5, width: 35, height: 3.5, text: "Model No: TRB-SET-2026", fontSize: 6.5, color: "#64748b" },
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
}: {
  value: string;
  format: string;
  width: number;
  height: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const displayVal = value || "123456789";

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, displayVal, {
          format: format === "EAN13" ? "EAN13" : "CODE128",
          width: 1.2,
          height: Math.max(10, height * 0.55),
          displayValue: true,
          fontSize: 7,
          margin: 1,
          textMargin: 1,
        });
      } catch { }
    }
  }, [displayVal, format, height]);

  if (format === "QR") {
    return <QRRenderer value={displayVal} size={Math.min(width, height)} />;
  }

  return (
    <svg
      ref={svgRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

function QRRenderer({ value, size }: { value: string; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value || "RFID", {
        width: Math.max(16, size),
        margin: 1,
      }).catch(() => { });
    }
  }, [value, size]);
  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
    />
  );
}

// ─── Gerçekçi Etiket Şekli SVG (Birebir Siluet, Katlama & Görsel Izgara Çizgileri) ─
function LabelShapeSVG({
  config,
  zoom,
  snapGrid,
}: {
  config: LabelConfig;
  zoom: number;
  snapGrid: number;
}) {
  const W = mmToPx(config.genislikMm, zoom);
  const H = mmToPx(config.yukseklikMm, zoom);
  const r = mmToPx(3, zoom);

  const shapeFill = config.bgColor || "#ffffff";
  const strokeColor = "#cbd5e1";
  const foldLineColor = "#94a3b8";

  // Görsel Izgara Deseni Tanımı
  const gridPatternSize = snapGrid > 0 ? mmToPx(snapGrid, zoom) : 0;
  const patId = `grid_pat_${config.etiketSekli}_${Math.round(snapGrid * 10)}_${Math.round(zoom * 100)}`;

  // 1. KELEBEK ŞEKLİ (Gerçekçi Kuyumcu Etiket Rulosu Boğumu)
  if (config.etiketSekli === "kelebek") {
    const solW = mmToPx(config.solKanatMm || config.genislikMm / 2, zoom);
    const neckW = mmToPx(config.kopruGenislikMm !== undefined ? config.kopruGenislikMm : 6, zoom);
    // Boğum / Çentik derinliği: Standart etiket rulolarında üstten ve alttan 1.5 - 3mm kavisli çentiktir
    const indentMm = config.bogumDerinlikMm !== undefined ? config.bogumDerinlikMm : 2.0;
    const indent = mmToPx(indentMm, zoom);
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
    const solW = mmToPx(config.solKanatMm || config.genislikMm / 2, zoom);
    const midX = solW;
    const headR = H / 2;
    const indentMm = config.bogumDerinlikMm !== undefined ? config.bogumDerinlikMm : 3.0;
    const indent = mmToPx(indentMm, zoom);
    const neckW = mmToPx(config.kopruGenislikMm !== undefined ? config.kopruGenislikMm : 8, zoom);
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
    const tailLen = mmToPx(config.kuyrukGenislikMm || 35, zoom);
    const bodyW = Math.max(mmToPx(20, zoom), W - tailLen);
    const tailH = mmToPx(config.kuyrukKalinlikMm || 4, zoom);
    const tailTop = (H - tailH) / 2;
    const tailBot = (H + tailH) / 2;
    const tailR = tailH / 2;

    const path = `
      M ${r} 0
      L ${bodyW - r} 0
      Q ${bodyW} 0 ${bodyW} ${r}
      L ${bodyW} ${tailTop - 2}
      C ${bodyW} ${tailTop}, ${bodyW + 2} ${tailTop}, ${bodyW + 4} ${tailTop}
      L ${W - tailR} ${tailTop}
      A ${tailR} ${tailR} 0 0 1 ${W} ${tailTop + tailR}
      A ${tailR} ${tailR} 0 0 1 ${W - tailR} ${tailBot}
      L ${bodyW + 4} ${tailBot}
      C ${bodyW + 2} ${tailBot}, ${bodyW} ${tailBot}, ${bodyW} ${tailBot + 2}
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

  // 5. DİKDÖRTGEN
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
  const [leftPanelTab, setLeftPanelTab] = useState<"elements" | "shape" | "layers" | "presets">("elements");
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [snapGrid, setSnapGrid] = useState(0); // 0 = Serbest / Akıcı piksel hassasiyeti
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Şablon ve Dürbün State
  const [sablonlar, setSablonlar] = useState<EtiketSablonItem[]>([]);
  const [activeSablon, setActiveSablon] = useState<EtiketSablonItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveModal, setSaveModal] = useState(false);
  const [durbunModal, setDurbunModal] = useState(false);
  const [durbunFilter, setDurbunFilter] = useState("");
  const [durbunTipFilter, setDurbunTipFilter] = useState<number | "all">("all");
  const [sablonAdi, setSablonAdi] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedIndicator, setSavedIndicator] = useState(false);
  const [editTitleModal, setEditTitleModal] = useState(false);
  const [titleInput, setTitleInput] = useState("");

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
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        handleQuickSaveRef.current();
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
  }, [selectedIds, selectedElements, clipboard, elements, editingId, isFullscreen]);

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
        textAlign: "left",
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

  // ─── Mouse Wheel ile Zoom Yapma ───────────────────────────────────────────
  const handleWheelZoom = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setZoom((z) => clamp(Math.round((z + delta) * 20) / 20, 0.3, 4.5));
  }, []);

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
  const startDragMove = (clientX: number, clientY: number, id: string, eDetail = 1) => {
    const el = elements.find((item) => item.id === id);
    if (!el || el.locked) return;

    if (eDetail === 2 && (el.type === "text" || el.type === "field")) {
      setEditingId(id);
      return;
    }

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

      if (
        e.target === canvasRef.current ||
        (e.target as HTMLElement).classList.contains("label-canvas") ||
        (e.target as HTMLElement).classList.contains("canvas-scroll-container")
      ) {
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
        if (!e.shiftKey) setSelectedIds([]);
        setEditingId(null);
      }
    },
    [getCanvasPos]
  );

  const handleElementMouseDown = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.button === 2) return;
      e.stopPropagation();
      startDragMove(e.clientX, e.clientY, id, e.detail);
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
        const deg = (angle * 180) / Math.PI + 90;
        dispatch({
          type: "UPDATE_ELEMENT",
          id: dr.elementId,
          changes: { rotation: Math.round(deg) },
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

  const updateLabelConfig = useCallback((changes: Partial<LabelConfig>) => {
    dispatch({ type: "SET_LABEL_CONFIG", config: changes });
  }, []);

  // ─── Katman Yönetimi (Doğru Sıralama & Katman Değişimi) ─────────────────────
  const reorderLayers = (newOrderedList: CanvasElement[]) => {
    const normalized = newOrderedList.map((el, i) => ({ ...el, zIndex: i + 1 }));
    dispatch({ type: "SET_ELEMENTS", elements: normalized });
    dispatch({ type: "PUSH_HISTORY" });
  };

  const bringForward = (id: string) => {
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((e) => e.id === id);
    if (idx < sorted.length - 1 && idx !== -1) {
      const temp = sorted[idx];
      sorted[idx] = sorted[idx + 1];
      sorted[idx + 1] = temp;
      reorderLayers(sorted);
    }
  };

  const sendBackward = (id: string) => {
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((e) => e.id === id);
    if (idx > 0) {
      const temp = sorted[idx];
      sorted[idx] = sorted[idx - 1];
      sorted[idx - 1] = temp;
      reorderLayers(sorted);
    }
  };

  const bringToFront = (id: string) => {
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((e) => e.id === id);
    if (idx !== -1) {
      const [item] = sorted.splice(idx, 1);
      sorted.push(item);
      reorderLayers(sorted);
    }
  };

  const sendToBack = (id: string) => {
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    const idx = sorted.findIndex((e) => e.id === id);
    if (idx !== -1) {
      const [item] = sorted.splice(idx, 1);
      sorted.unshift(item);
      reorderLayers(sorted);
    }
  };

  // ─── Şablon Hızlı & Doğrudan Kaydetme (Ctrl+S) ──────────────────────────────
  const handleQuickSave = async () => {
    const nameToSave = sablonAdi.trim() || activeSablon?.ad || "";
    if (!nameToSave) {
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
        zIndex: el.zIndex,
        opacity: el.opacity,
        visible: el.visible,
        locked: el.locked,
        iconEmoji: el.iconEmoji,
        text: el.text,
      }));

      const savedItem = await EtiketService.saveSablon({
        etiketSablonId: activeSablon?.etiketSablonId || null,
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
      setErrorMessage(err?.response?.data?.message || err?.message || "Kayıt sırasında bir hata oluştu!");
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

  const handleLoadSablon = (sablon: EtiketSablonItem) => {
    const els: CanvasElement[] = (sablon.alanlar || []).map((alan, i) => ({
      id: genId(),
      type: (alan.etiketElementTipi || "text") as ElementType,
      x: alan.x ?? 5,
      y: alan.y ?? 5 + i * 7,
      width: alan.genislik ?? (alan.etiketElementTipi === "barcode" ? 25 : 20),
      height: alan.yukseklik ?? (alan.etiketElementTipi === "barcode" ? 8 : 5),
      rotation: alan.rotation ?? 0,
      opacity: alan.opacity ?? 1,
      locked: alan.locked ?? false,
      visible: alan.visible ?? true,
      zIndex: alan.zIndex ?? i,
      text: alan.text || alan.alan,
      fieldKey: alan.alan,
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
      barcodeFormat: alan.barkodFormat as any,
      iconEmoji: alan.iconEmoji,
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
          solKanatMm: sablon.solKanatGenislikMm ?? sablon.genislikMm / 2,
          sagKanatMm: sablon.sagKanatGenislikMm ?? sablon.genislikMm / 2,
          kopruGenislikMm: 9,
          kopruYukseklikMm: 8,
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
      const textStyle: React.CSSProperties = {
        fontFamily: el.fontFamily || "Arial",
        fontSize: `${(el.fontSize || 8) * zoom * 0.65}px`,
        fontWeight: el.fontWeight || "normal",
        fontStyle: el.fontStyle || "normal",
        textDecoration: el.textDecoration || "none",
        textAlign: el.textAlign || "left",
        color: el.color || "#000000",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        padding: "0 2px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        userSelect: "none",
        background: el.backgroundColor && el.backgroundColor !== "transparent" ? el.backgroundColor : undefined,
      };

      const displayText =
        el.type === "field"
          ? `${el.prefix || ""}[${el.fieldKey || el.text || "Alan"}]${el.suffix || ""}`
          : el.text || "Metin";

      if (isEditing) {
        return (
          <input
            type="text"
            className="element-inline-edit"
            autoFocus
            defaultValue={el.type === "field" ? (el.fieldKey || el.text || "") : (el.text || "")}
            style={{
              fontFamily: el.fontFamily || "Arial",
              fontSize: `${(el.fontSize || 8) * zoom * 0.65}px`,
              fontWeight: el.fontWeight || "normal",
              color: el.color || "#000",
            }}
            onFocus={(e) => e.target.select()}
            onBlur={(e) => {
              if (el.type === "field") {
                updateElement(el.id, { text: e.target.value, fieldKey: e.target.value });
              } else {
                updateElement(el.id, { text: e.target.value });
              }
              setEditingId(null);
              dispatch({ type: "PUSH_HISTORY" });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                setEditingId(null);
              }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        );
      }

      return (
        <div
          style={textStyle}
          onClick={(e) => {
            if (isSelected) {
              setEditingId(el.id);
            }
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
          }}
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
      {(leftPanelOpen || rightPanelOpen) && (
        <div
          className="mobile-panel-backdrop"
          onClick={() => {
            setLeftPanelOpen(false);
            setRightPanelOpen(false);
          }}
        />
      )}

      {/* ── Üst ERP Toolbar (Ekonomik, Asla Üst Üste Binmeyen Düzen) ──────── */}
      <div className="top-erp-toolbar">
        {/* Sol Panel Toggle */}
        <button
          className={`tb-btn ${leftPanelOpen ? "active" : ""}`}
          title="Sol Paneli Aç/Kapat"
          onClick={() => {
            setLeftPanelOpen((v) => !v);
            if (!leftPanelOpen && window.innerWidth < 1024) setRightPanelOpen(false);
          }}
        >
          <IconMenu2 size={16} />
          <span>Elemanlar</span>
        </button>

        {/* 🔭 DÜRBÜN İKONU: Şablonlar */}
        <button
          className="tb-btn highlight"
          title="Kayıtlı Şablonları Ara ve Seç (Dürbün)"
          onClick={() => setDurbunModal(true)}
        >
          <IconBinoculars size={15} />
          <span> </span>
        </button>

        {/* Yeni Şablon */}
        <button
          className="tb-btn"
          title="Yeni Boş Şablon"
          onClick={() => {
            if (confirm("Yeni bir tasarıma başlamak istiyor musunuz?")) {
              dispatch({ type: "SET_ELEMENTS", elements: [] });
              setActiveSablon(null);
              setSablonAdi("");
            }
          }}
        >
          <IconPlus size={15} />
          <span>Yeni</span>
        </button>

        {/* 🏷️ Şablon Adı ve Düzenleme Kalemi (Dürbün İkonlu) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "2px 8px",
            background: "rgba(15,23,42,0.6)",
            borderRadius: 5,
            border: "1px solid #334155",
            flexShrink: 0,
          }}
        >
          <IconBinoculars size={13} color="#38bdf8" />
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Şablon:</span>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: "#f8fafc",
              maxWidth: 130,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={sablonAdi || activeSablon?.ad || "İsimsiz Şablon"}
          >
            {sablonAdi || activeSablon?.ad || "İsimsiz Şablon"}
          </span>

          <button
            className="tb-btn"
            style={{ width: 20, height: 20, padding: 0, border: "none", background: "transparent" }}
            title="Şablon İsmini Değiştir"
            onClick={() => {
              setTitleInput(sablonAdi || activeSablon?.ad || "Altın Etiket Tasarımı");
              setEditTitleModal(true);
            }}
          >
            <IconEdit size={13} color="#38bdf8" />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* HIZLI KART BOYUTU DÜZENLEME (EN × BOY mm) */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <span className="toolbar-label">En:</span>
          <button
            className="tb-btn"
            style={{ width: 18, height: 24, padding: 0, fontSize: 12, fontWeight: 700 }}
            title="Genişliği 1mm Azalt"
            onClick={() => updateLabelConfig({ genislikMm: Math.max(5, labelConfig.genislikMm - 1) })}
          >
            -
          </button>
          <input
            type="number"
            className="toolbar-input"
            style={{ width: 44, textAlign: "center", padding: "2px 2px" }}
            value={labelConfig.genislikMm}
            min={5}
            max={300}
            step={0.5}
            title="Kart / Etiket Genişliği (mm)"
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) updateLabelConfig({ genislikMm: v });
            }}
          />
          <button
            className="tb-btn"
            style={{ width: 18, height: 24, padding: 0, fontSize: 12, fontWeight: 700 }}
            title="Genişliği 1mm Artır"
            onClick={() => updateLabelConfig({ genislikMm: Math.min(300, labelConfig.genislikMm + 1) })}
          >
            +
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <span className="toolbar-label">Boy:</span>
          <button
            className="tb-btn"
            style={{ width: 18, height: 24, padding: 0, fontSize: 12, fontWeight: 700 }}
            title="Yüksekliği 1mm Azalt"
            onClick={() => updateLabelConfig({ yukseklikMm: Math.max(3, labelConfig.yukseklikMm - 1) })}
          >
            -
          </button>
          <input
            type="number"
            className="toolbar-input"
            style={{ width: 44, textAlign: "center", padding: "2px 2px" }}
            value={labelConfig.yukseklikMm}
            min={3}
            max={200}
            step={0.5}
            title="Kart / Etiket Yüksekliği (mm)"
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) updateLabelConfig({ yukseklikMm: v });
            }}
          />
          <button
            className="tb-btn"
            style={{ width: 18, height: 24, padding: 0, fontSize: 12, fontWeight: 700 }}
            title="Yüksekliği 1mm Artır"
            onClick={() => updateLabelConfig({ yukseklikMm: Math.min(200, labelConfig.yukseklikMm + 1) })}
          >
            +
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Geri Al / Yinele */}
        <button
          className="tb-btn"
          title="Geri Al (Ctrl+Z)"
          onClick={() => dispatch({ type: "UNDO" })}
          disabled={editorState.past.length === 0}
        >
          <IconArrowBackUp size={15} />
        </button>
        <button
          className="tb-btn"
          title="Yinele (Ctrl+Y / Ctrl+Shift+Z)"
          onClick={() => dispatch({ type: "REDO" })}
          disabled={editorState.future.length === 0}
        >
          <IconArrowForwardUp size={15} />
        </button>

        {/* Çoklu Hizalama */}
        {selectedIds.length > 1 && (
          <>
            <div className="toolbar-divider" />
            <button
              className="tb-btn"
              title="Sola Hizala"
              onClick={() => {
                const minX = Math.min(...selectedElements.map((e) => e.x));
                selectedIds.forEach((id) => updateElement(id, { x: minX }));
              }}
            >
              <IconAlignLeft size={14} />
            </button>
            <button
              className="tb-btn"
              title="Ortaya Hizala"
              onClick={() => {
                const minX = Math.min(...selectedElements.map((e) => e.x));
                const maxX = Math.max(...selectedElements.map((e) => e.x + e.width));
                const cX = (minX + maxX) / 2;
                selectedIds.forEach((id) => {
                  const el = elements.find((e) => e.id === id);
                  if (el) updateElement(id, { x: cX - el.width / 2 });
                });
              }}
            >
              <IconAlignCenter size={14} />
            </button>
            <button
              className="tb-btn"
              title="Sağa Hizala"
              onClick={() => {
                const maxX = Math.max(...selectedElements.map((e) => e.x + e.width));
                selectedIds.forEach((id) => {
                  const el = elements.find((e) => e.id === id);
                  if (el) updateElement(id, { x: maxX - el.width });
                });
              }}
            >
              <IconAlignRight size={14} />
            </button>
          </>
        )}

        {/* Kaydet Butonu ve 5sn Kaydedildi Rozeti */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <button
            className="tb-btn save-btn"
            title="Şablonu Kaydet (Ctrl+S)"
            onClick={handleQuickSave}
            disabled={loading}
          >
            <IconDeviceFloppy size={15} />
            <span>Kaydet</span>
          </button>
          {saveStatus === "saved" && (
            <span
              style={{
                color: "#4ade80",
                fontWeight: 700,
                fontSize: 11,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(34,197,94,0.15)",
                padding: "3px 8px",
                borderRadius: 4,
                border: "1px solid rgba(34,197,94,0.3)",
              }}
            >
              ✓ Kaydedildi
            </span>
          )}
          {saveStatus === "error" && (
            <span
              style={{
                color: "#f87171",
                fontWeight: 700,
                fontSize: 11,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(239,68,68,0.15)",
                padding: "3px 8px",
                borderRadius: 4,
                border: "1px solid rgba(239,68,68,0.3)",
              }}
              title={errorMessage || "Kayıt Hatası"}
            >
              ✗ Hata: {errorMessage || "Kaydedilemedi"}
            </span>
          )}
        </div>

        {/* Seçili Elemanı Sil */}
        {selectedIds.length > 0 && (
          <button
            className="tb-btn danger"
            title="Seçili Elemanı Sil (Delete)"
            onClick={() => {
              dispatch({ type: "DELETE_ELEMENTS", ids: selectedIds });
              setSelectedIds([]);
            }}
          >
            <IconTrash size={15} />
          </button>
        )}

        <div style={{ marginLeft: "auto" }} />

        {/* GÖRSEL IZGARA SEÇİMİ */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
          <span className="toolbar-label" style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}>
            <IconGridDots size={13} color="#38bdf8" />
            <span>Izgara:</span>
          </span>
          <select
            className="toolbar-select"
            value={snapGrid}
            onChange={(e) => setSnapGrid(Number(e.target.value))}
            style={{ width: 88, height: 26, fontSize: 11 }}
          >
            <option value={0}>Kapalı</option>
            <option value={0.5}>0.5 mm</option>
            <option value={1}>1.0 mm</option>
            <option value={2}>2.0 mm</option>
            <option value={5}>5.0 mm</option>
            <option value={10}>10.0 mm</option>
          </select>
        </div>

        {/* Kategori: Sabit Altın */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 9px",
            background: "rgba(217, 119, 6, 0.15)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            borderRadius: 5,
            color: "#fcd34d",
            fontSize: 11.5,
            fontWeight: 700,
            flexShrink: 0,
          }}
          title="Kategori: Altın Ürün Etiketi"
        >
          <span>🪙</span>
          <span>Altın</span>
        </div>

        {/* Tam Ekran Modu */}
        <button
          className="tb-btn"
          title={isFullscreen ? "Tam Ekrandan Çık (ESC)" : "Tam Ekran"}
          onClick={() => setIsFullscreen((v) => !v)}
        >
          {isFullscreen ? <IconMinimize size={15} /> : <IconMaximize size={15} />}
        </button>

        {/* Sağ Panel Toggle */}
        <button
          className={`tb-btn ${rightPanelOpen ? "active" : ""}`}
          title="Sağ Özellik Panelini Aç/Kapat"
          onClick={() => {
            setRightPanelOpen((v) => !v);
            if (!rightPanelOpen && window.innerWidth < 1024) setLeftPanelOpen(false);
          }}
        >
          <IconSettings size={15} />
          <span>Ayar</span>
        </button>
      </div>

      {/* ── Dinamik Bağlamsal Toolbar (Seçili Eleman Araçları) ─────────────── */}
      {selectedElement && (
        <div className="top-context-toolbar animate-fadein">
          {(selectedElement.type === "text" || selectedElement.type === "field") && (
            <>
              {/* Doğrudan Düzenleme Butonu */}
              <button
                className="tb-btn highlight"
                style={{ height: 26, fontSize: 11 }}
                title="Metni Düzenle (veya Çift Tıkla)"
                onClick={() => setEditingId(selectedElement.id)}
              >
                <IconEdit size={13} />
                <span>Düzenle</span>
              </button>

              {/* Font Ailesi */}
              <select
                className="toolbar-select"
                style={{ width: 120, height: 26, fontSize: 11 }}
                value={selectedElement.fontFamily || "Arial"}
                onChange={(e) => {
                  updateElement(selectedElement.id, { fontFamily: e.target.value });
                  dispatch({ type: "PUSH_HISTORY" });
                }}
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>

              {/* Font Boyutu */}
              <input
                type="number"
                className="toolbar-input w-45"
                style={{ height: 26 }}
                value={selectedElement.fontSize || 8}
                min={4}
                max={72}
                onFocus={(e) => e.target.select()}
                onChange={(e) =>
                  updateElement(selectedElement.id, { fontSize: Number(e.target.value) })
                }
                title="Font Boyutu (pt)"
              />

              <div className="toolbar-divider" />

              {/* Bold, Italic, Underline */}
              <button
                className={`tb-btn ${selectedElement.fontWeight === "bold" ? "active" : ""}`}
                style={{ height: 26, width: 26, padding: 0 }}
                title="Kalın (Bold)"
                onClick={() =>
                  updateElement(selectedElement.id, {
                    fontWeight: selectedElement.fontWeight === "bold" ? "normal" : "bold",
                  })
                }
              >
                <IconBold size={14} />
              </button>
              <button
                className={`tb-btn ${selectedElement.fontStyle === "italic" ? "active" : ""}`}
                style={{ height: 26, width: 26, padding: 0 }}
                title="İtalik"
                onClick={() =>
                  updateElement(selectedElement.id, {
                    fontStyle: selectedElement.fontStyle === "italic" ? "normal" : "italic",
                  })
                }
              >
                <IconItalic size={14} />
              </button>
              <button
                className={`tb-btn ${selectedElement.textDecoration === "underline" ? "active" : ""}`}
                style={{ height: 26, width: 26, padding: 0 }}
                title="Altı Çizili"
                onClick={() =>
                  updateElement(selectedElement.id, {
                    textDecoration:
                      selectedElement.textDecoration === "underline" ? "none" : "underline",
                  })
                }
              >
                <IconUnderline size={14} />
              </button>

              <div className="toolbar-divider" />

              {/* Hizalama */}
              <button
                className={`tb-btn ${selectedElement.textAlign === "left" ? "active" : ""}`}
                style={{ height: 26, width: 26, padding: 0 }}
                title="Sola Hizala"
                onClick={() => updateElement(selectedElement.id, { textAlign: "left" })}
              >
                <IconAlignLeft size={14} />
              </button>
              <button
                className={`tb-btn ${(!selectedElement.textAlign || selectedElement.textAlign === "center") ? "active" : ""}`}
                style={{ height: 26, width: 26, padding: 0 }}
                title="Ortala"
                onClick={() => updateElement(selectedElement.id, { textAlign: "center" })}
              >
                <IconAlignCenter size={14} />
              </button>
              <button
                className={`tb-btn ${selectedElement.textAlign === "right" ? "active" : ""}`}
                style={{ height: 26, width: 26, padding: 0 }}
                title="Sağa Hizala"
                onClick={() => updateElement(selectedElement.id, { textAlign: "right" })}
              >
                <IconAlignRight size={14} />
              </button>

              <div className="toolbar-divider" />

              {/* Yazı Rengi */}
              <span className="toolbar-label">Renk:</span>
              <div
                className="color-swatch"
                style={{ background: selectedElement.color || "#000" }}
                title="Yazı Rengi"
              >
                <input
                  type="color"
                  value={selectedElement.color || "#000000"}
                  onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                />
              </div>
            </>
          )}

          {/* Şekil Renkleri */}
          {(selectedElement.type === "rect" || selectedElement.type === "ellipse") && (
            <>
              <span className="toolbar-label">Dolgu:</span>
              <div
                className="color-swatch"
                style={{ background: selectedElement.backgroundColor || "transparent" }}
                title="Dolgu Rengi"
              >
                <input
                  type="color"
                  value={selectedElement.backgroundColor || "#ffffff"}
                  onChange={(e) => updateElement(selectedElement.id, { backgroundColor: e.target.value })}
                />
              </div>
              <span className="toolbar-label">Kenar:</span>
              <div
                className="color-swatch"
                style={{ background: selectedElement.borderColor || "#000" }}
                title="Kenarlık Rengi"
              >
                <input
                  type="color"
                  value={selectedElement.borderColor || "#000000"}
                  onChange={(e) => updateElement(selectedElement.id, { borderColor: e.target.value })}
                />
              </div>
            </>
          )}

          <div className="toolbar-divider" />

          {/* Döndürme Hızlı Butonları */}
          <button
            className="tb-btn"
            style={{ height: 26 }}
            title="90° Sağa Döndür"
            onClick={() =>
              updateElement(selectedElement.id, {
                rotation: ((selectedElement.rotation || 0) + 90) % 360,
              })
            }
          >
            <IconRotate size={14} />
            <span style={{ fontSize: 9.5 }}>+90°</span>
          </button>

          {/* Katman Sırası */}
          <button
            className="tb-btn"
            style={{ height: 26, width: 26, padding: 0 }}
            title="Öne Getir (Ctrl+])"
            onClick={() => bringForward(selectedElement.id)}
          >
            <IconArrowUp size={14} />
          </button>
          <button
            className="tb-btn"
            style={{ height: 26, width: 26, padding: 0 }}
            title="Arkaya Gönder (Ctrl+[)"
            onClick={() => sendBackward(selectedElement.id)}
          >
            <IconArrowDown size={14} />
          </button>

          {/* Klonla */}
          <button
            className="tb-btn"
            style={{ height: 26, width: 26, padding: 0 }}
            title="Klonla (Ctrl+D)"
            onClick={() => {
              const newEl = { ...selectedElement, id: genId(), x: selectedElement.x + 2, y: selectedElement.y + 2, zIndex: selectedElement.zIndex + 1 };
              dispatch({ type: "ADD_ELEMENT", element: newEl });
              setSelectedIds([newEl.id]);
            }}
          >
            <IconCopy size={14} />
          </button>

          {/* Sil */}
          <button
            className="tb-btn danger"
            style={{ height: 26, width: 26, padding: 0 }}
            title="Sil (Delete)"
            onClick={() => {
              dispatch({ type: "DELETE_ELEMENTS", ids: selectedIds });
              setSelectedIds([]);
            }}
          >
            <IconTrash size={14} />
          </button>
        </div>
      )}

      {/* ── Ana Editör Gövdesi ────────────────────────────────────────────── */}
      <div className="label-editor-body">
        {/* ── Sol Panel (Çekmece: 4 Eşit Sütunlu Asla Çakışmayan Tablar) ─────── */}
        <div className={`left-panel ${leftPanelOpen ? "open" : "collapsed"}`}>
          {/* Mobil Başlık ve Kapat Butonu */}
          <div className="panel-header-mobile">
            <span>🎨 Bileşenler & Modeller</span>
            <button
              onClick={() => setLeftPanelOpen(false)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
            >
              <IconX size={18} />
            </button>
          </div>

          {/* 4 Eşit Sütunlu Tab Başlıkları */}
          <div className="left-panel-tabs">
            {(
              [
                { key: "elements", label: "Öğeler", icon: <IconPlus size={13} /> },
                { key: "shape", label: "Boyut", icon: <IconLayoutGrid size={13} /> },
                { key: "layers", label: "Katman", icon: <IconLayersSubtract size={13} /> },
                { key: "presets", label: "Şablon", icon: <IconBinoculars size={13} /> },
              ] as const
            ).map((tab) => (
              <div
                key={tab.key}
                className={`left-panel-tab ${leftPanelTab === tab.key ? "active" : ""}`}
                onClick={() => setLeftPanelTab(tab.key as any)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </div>
            ))}
          </div>

          {/* Tab İçerikleri */}
          <div className="left-panel-content">
            {/* ── 1. Öğeler Sekmesi (Sadeleştirilmiş & Akıcı Sürükle Bırak) ─── */}
            {leftPanelTab === "elements" && (
              <>
                <div className="panel-section-title">
                  <span>📝 Metin & Sayı</span>
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
                    <div style={{ fontSize: 9, color: "#94a3b8" }}>Sola hizalı metin</div>
                  </div>
                </button>

                {/* Sayı Alanı (Sağa Dayalı) */}
                <button
                  className="elem-btn"
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({ type: "text", text: "0.00", fontSize: 8.5, fontWeight: "bold", color: "#000000", textAlign: "right", width: 18, height: 4.5 })
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => addElement({ type: "text", text: "0.00", fontSize: 8.5, fontWeight: "bold", color: "#000000", textAlign: "right", width: 18, height: 4.5 })}
                >
                  <div className="elem-btn-icon" style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8" }}>#</div>
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>Sayı Alanı (Sağa Dayalı)</div>
                    <div style={{ fontSize: 9, color: "#94a3b8" }}>Gram, Fiyat, Ayar vb.</div>
                  </div>
                </button>

                {/* Görsel / Logo Kutusu */}
                <button
                  className="elem-btn"
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({ type: "image", width: 16, height: 10, text: "Görsel" })
                    );
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => addElement({ type: "image", width: 16, height: 10, text: "Görsel" })}
                >
                  <div className="elem-btn-icon"><IconPhoto size={14} color="#0284c7" /></div>
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>Görsel / Logo Kutusu</div>
                    <div style={{ fontSize: 9, color: "#94a3b8" }}>Sürükle / Tıkla / Sağ Tık</div>
                  </div>
                </button>

                <div className="panel-section-title">
                  <span>📊 Barkodlar & Kodlar</span>
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
                  <span>Barkod (Code128)</span>
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
                  <span>QR Kod</span>
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
                  <span>RFID / EPC Alanı</span>
                </button>

                <div className="panel-section-title">
                  <span>🔷 Çizgiler & Şekiller ({SHAPE_PRESETS.length})</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
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
                        className="elem-btn"
                        style={{ padding: "6px 7px", fontSize: 10 }}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/json", JSON.stringify(shapeData));
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => addElement(shapeData as any)}
                      >
                        <div className="elem-btn-icon" style={{ fontSize: 11, minWidth: 18 }}>{s.icon}</div>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="panel-section-title">⭐ Kuyumcu İkonları</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {ICON_PRESETS.map((ic) => {
                    const iconData = { type: "icon", iconName: ic.name, iconEmoji: ic.emoji, width: 8, height: 8 };
                    return (
                      <button
                        key={ic.name}
                        className="elem-btn"
                        style={{ justifyContent: "center", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 4px" }}
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("application/json", JSON.stringify(iconData));
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => addElement(iconData as any)}
                      >
                        <span style={{ fontSize: 16 }}>{ic.emoji}</span>
                        <span style={{ fontSize: 9 }}>{ic.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 📷 Fotoğraf, Logo & Barkod Görselleri */}
                <div className="panel-section-title" style={{ marginTop: 12 }}>
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
                    background: "linear-gradient(135deg, rgba(14,165,233,0.15), rgba(99,102,241,0.15))",
                    borderColor: "rgba(56,189,248,0.4)",
                    color: "#38bdf8",
                    padding: "8px 10px",
                    width: "100%",
                  }}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <div className="elem-btn-icon"><IconUpload size={16} color="#38bdf8" /></div>
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 11.5 }}>Fotoğraf / Logo Seç</div>
                    <div style={{ fontSize: 9, color: "#94a3b8" }}>PNG, JPG, SVG veya Barkod Fotoğrafı</div>
                  </div>
                </button>

                <input
                  type="file"
                  ref={logoUploadInputRef}
                  accept="image/*,.svg"
                  onChange={handleUploadDbLogo}
                  style={{ display: "none" }}
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    margin: "12px 0 6px",
                  }}
                >
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Sektörel Damga & Logo Hazırları
                  </span>
                  <button
                    className="btn btn-xs btn-outline-info"
                    style={{
                      fontSize: 9.5,
                      padding: "2px 8px",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontWeight: 600,
                    }}
                    onClick={() => logoUploadInputRef.current?.click()}
                    title="Veritabanına yeni damga/logo yükle (TODVZ_FOTOGRAF: Tip 9)"
                  >
                    <IconUpload size={11} />
                    <span>+ Yükle</span>
                  </button>
                </div>

                {/* ── 1. Veritabanına Kayıtlı Kullanıcı Damgaları & Logoları (URUN_TIPI = 9) ── */}
                {loadingDbLogolar ? (
                  <div style={{ fontSize: 10, color: "#94a3b8", padding: "6px 4px", textAlign: "center" }}>
                    Logolar yükleniyor...
                  </div>
                ) : dbLogolar.length > 0 ? (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 9, color: "#38bdf8", fontWeight: 600, marginBottom: 4 }}>
                      🏷️ Kayıtlı Logolar ({dbLogolar.length}):
                    </div>
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
                            style={{
                              position: "relative",
                              padding: "5px 6px",
                              fontSize: 9.5,
                              gap: 5,
                              cursor: "pointer",
                            }}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/json", JSON.stringify(logoData));
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => addElement(logoData as any)}
                            title={`${lg.dosyaAdi} (Kayıtlı Logo)`}
                          >
                            <img
                              src={lg.dataUrl}
                              alt={lg.dosyaAdi}
                              style={{ width: 18, height: 14, objectFit: "contain", flexShrink: 0, borderRadius: 2 }}
                            />
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                textAlign: "left",
                              }}
                            >
                              {lg.dosyaAdi}
                            </span>
                            <button
                              style={{
                                background: "none",
                                border: "none",
                                color: "#ef4444",
                                padding: "0 2px",
                                cursor: "pointer",
                                fontSize: 12,
                                lineHeight: 1,
                                opacity: 0.7,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
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

                {/* ── 2. Sektörel Standart Damgalar ── */}
                <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, margin: "6px 0 4px" }}>
                  ⭐ Sektörel Standart Hazırlar:
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
                        <img
                          src={lg.dataUrl}
                          alt={lg.name}
                          style={{ width: 18, height: 14, objectFit: "contain", flexShrink: 0, borderRadius: 2 }}
                        />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {lg.name}
                        </span>
                      </button>
                    );
                  })}
                </div>

              </>
            )}

            {/* ── 2. Şekil & Boyut Sekmesi (Kart Boyutu Düzenleme) ──────────── */}
            {leftPanelTab === "shape" && (
              <>
                <div className="panel-section-title">Etiket Şekli / Modeli</div>

                {ETIKET_SEKILLERI.map((s) => (
                  <button
                    key={s.value}
                    className="elem-btn"
                    style={{
                      background: labelConfig.etiketSekli === s.value ? "rgba(56,189,248,0.2)" : undefined,
                      borderColor: labelConfig.etiketSekli === s.value ? "#38bdf8" : undefined,
                      color: labelConfig.etiketSekli === s.value ? "#38bdf8" : undefined,
                    }}
                    onClick={() => updateLabelConfig({ etiketSekli: s.value })}
                  >
                    <div className="elem-btn-icon" style={{ fontSize: 14 }}>{s.icon}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{s.ad}</div>
                      <div style={{ fontSize: 9.5, color: "#94a3b8" }}>{s.desc}</div>
                    </div>
                  </button>
                ))}

                <div className="panel-section-title" style={{ marginTop: 12 }}>
                  <span>⚡ Popüler Hazır Boyutlar</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
                  {POPULAR_SIZES.map((ps) => (
                    <button
                      key={ps.ad}
                      className="tb-btn"
                      style={{
                        background: labelConfig.genislikMm === ps.config.genislikMm && labelConfig.yukseklikMm === ps.config.yukseklikMm && labelConfig.etiketSekli === ps.config.etiketSekli ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: labelConfig.genislikMm === ps.config.genislikMm && labelConfig.yukseklikMm === ps.config.yukseklikMm ? "#38bdf8" : "#cbd5e1",
                        fontSize: 10,
                        padding: "4px 6px",
                        height: "auto",
                        justifyContent: "flex-start",
                        borderRadius: 5,
                      }}
                      onClick={() => updateLabelConfig(ps.config)}
                    >
                      <span>{ps.icon}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ps.ad}</span>
                    </button>
                  ))}
                </div>

                <div className="panel-section-title" style={{ marginTop: 8 }}>
                  <span>Kart / Etiket Boyutları</span>
                </div>

                <div className="prop-row">
                  <span className="prop-label">Toplam En:</span>
                  <button
                    className="tb-btn"
                    style={{ width: 22, height: 26, padding: 0, fontSize: 13, fontWeight: 700, background: "#0f172a", border: "1px solid #334155" }}
                    onClick={() => updateLabelConfig({ genislikMm: Math.max(5, labelConfig.genislikMm - 1) })}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="prop-input"
                    value={labelConfig.genislikMm}
                    min={5}
                    max={300}
                    step={0.5}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) updateLabelConfig({ genislikMm: v });
                    }}
                  />
                  <button
                    className="tb-btn"
                    style={{ width: 22, height: 26, padding: 0, fontSize: 13, fontWeight: 700, background: "#0f172a", border: "1px solid #334155" }}
                    onClick={() => updateLabelConfig({ genislikMm: Math.min(300, labelConfig.genislikMm + 1) })}
                  >
                    +
                  </button>
                  <span style={{ fontSize: 9.5, color: "#94a3b8" }}>mm</span>
                </div>

                <div className="prop-row">
                  <span className="prop-label">Toplam Boy:</span>
                  <button
                    className="tb-btn"
                    style={{ width: 22, height: 26, padding: 0, fontSize: 13, fontWeight: 700, background: "#0f172a", border: "1px solid #334155" }}
                    onClick={() => updateLabelConfig({ yukseklikMm: Math.max(3, labelConfig.yukseklikMm - 1) })}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="prop-input"
                    value={labelConfig.yukseklikMm}
                    min={3}
                    max={200}
                    step={0.5}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v > 0) updateLabelConfig({ yukseklikMm: v });
                    }}
                  />
                  <button
                    className="tb-btn"
                    style={{ width: 22, height: 26, padding: 0, fontSize: 13, fontWeight: 700, background: "#0f172a", border: "1px solid #334155" }}
                    onClick={() => updateLabelConfig({ yukseklikMm: Math.min(200, labelConfig.yukseklikMm + 1) })}
                  >
                    +
                  </button>
                  <span style={{ fontSize: 9.5, color: "#94a3b8" }}>mm</span>
                </div>

                {/* Kelebek & Dambıl Boğum / Çentik Detayları */}
                {(labelConfig.etiketSekli === "kelebek" || labelConfig.etiketSekli === "dambil") && (
                  <>
                    <div className="panel-section-title" style={{ marginTop: 10 }}>
                      <span>🏷️ Boğum & Çentik Ayarları</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: "#94a3b8", marginBottom: 6, lineHeight: 1.3 }}>
                      Yazıcı rulo kağıdına göre boğum derinliği (Standart: 1.5 - 2.5 mm, Düz: 0 mm)
                    </div>

                    <div className="prop-row">
                      <span className="prop-label" style={{ width: 95 }}>Boğum Derinlik:</span>
                      <button
                        className="tb-btn"
                        style={{ width: 22, height: 26, padding: 0, fontSize: 13, fontWeight: 700, background: "#0f172a", border: "1px solid #334155" }}
                        onClick={() => updateLabelConfig({ bogumDerinlikMm: Math.max(0, Math.round(((labelConfig.bogumDerinlikMm ?? 2) - 0.5) * 10) / 10) })}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="prop-input"
                        value={labelConfig.bogumDerinlikMm ?? 2.0}
                        min={0}
                        max={10}
                        step={0.5}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v >= 0) updateLabelConfig({ bogumDerinlikMm: v });
                        }}
                      />
                      <button
                        className="tb-btn"
                        style={{ width: 22, height: 26, padding: 0, fontSize: 13, fontWeight: 700, background: "#0f172a", border: "1px solid #334155" }}
                        onClick={() => updateLabelConfig({ bogumDerinlikMm: Math.min(10, Math.round(((labelConfig.bogumDerinlikMm ?? 2) + 0.5) * 10) / 10) })}
                      >
                        +
                      </button>
                      <span style={{ fontSize: 9.5, color: "#94a3b8" }}>mm</span>
                    </div>

                    <div className="prop-row">
                      <span className="prop-label" style={{ width: 95 }}>Köprü Genişlik:</span>
                      <button
                        className="tb-btn"
                        style={{ width: 22, height: 26, padding: 0, fontSize: 13, fontWeight: 700, background: "#0f172a", border: "1px solid #334155" }}
                        onClick={() => updateLabelConfig({ kopruGenislikMm: Math.max(2, Math.round((labelConfig.kopruGenislikMm - 0.5) * 10) / 10) })}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        className="prop-input"
                        value={labelConfig.kopruGenislikMm}
                        min={2}
                        max={40}
                        step={0.5}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) updateLabelConfig({ kopruGenislikMm: v });
                        }}
                      />
                      <button
                        className="tb-btn"
                        style={{ width: 22, height: 26, padding: 0, fontSize: 13, fontWeight: 700, background: "#0f172a", border: "1px solid #334155" }}
                        onClick={() => updateLabelConfig({ kopruGenislikMm: Math.min(40, Math.round((labelConfig.kopruGenislikMm + 0.5) * 10) / 10) })}
                      >
                        +
                      </button>
                      <span style={{ fontSize: 9.5, color: "#94a3b8" }}>mm</span>
                    </div>

                    {labelConfig.etiketSekli === "kelebek" && (
                      <div className="prop-row">
                        <span className="prop-label" style={{ width: 95 }}>Sol Kanat:</span>
                        <input
                          type="number"
                          className="prop-input"
                          value={labelConfig.solKanatMm}
                          min={5}
                          max={labelConfig.genislikMm - 5}
                          step={0.5}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v > 0) updateLabelConfig({ solKanatMm: v });
                          }}
                        />
                        <span style={{ fontSize: 9.5, color: "#94a3b8" }}>mm</span>
                      </div>
                    )}
                  </>
                )}

                {/* Kuyruklu Etiket Detayları */}
                {labelConfig.etiketSekli === "kuyruklu" && (
                  <>
                    <div className="prop-row">
                      <span className="prop-label" style={{ width: 80 }}>Kuyruk Uzunluk:</span>
                      <input
                        type="number"
                        className="prop-input"
                        value={labelConfig.kuyrukGenislikMm}
                        min={10}
                        max={120}
                        step={1}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) updateLabelConfig({ kuyrukGenislikMm: v });
                        }}
                      />
                      <span style={{ fontSize: 9.5, color: "#94a3b8" }}>mm</span>
                    </div>
                    <div className="prop-row">
                      <span className="prop-label" style={{ width: 80 }}>Kuyruk Kalınlık:</span>
                      <input
                        type="number"
                        className="prop-input"
                        value={labelConfig.kuyrukKalinlikMm}
                        min={2}
                        max={15}
                        step={0.5}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) updateLabelConfig({ kuyrukKalinlikMm: v });
                        }}
                      />
                      <span style={{ fontSize: 9.5, color: "#94a3b8" }}>mm</span>
                    </div>
                  </>
                )}

                <div className="panel-section-title" style={{ marginTop: 10 }}>
                  <span>Çizgiler & Renk</span>
                </div>

                <label className="small-form-check" style={{ marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={labelConfig.katlamaCizgisi}
                    onChange={(e) => updateLabelConfig({ katlamaCizgisi: e.target.checked })}
                  />
                  <span>Katlama Çizgisini Göster</span>
                </label>

                <div className="prop-row">
                  <span className="prop-label">Renk:</span>
                  <div className="color-swatch" style={{ background: labelConfig.bgColor }} title="Özel Renk">
                    <input
                      type="color"
                      value={labelConfig.bgColor}
                      onChange={(e) => updateLabelConfig({ bgColor: e.target.value })}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>{labelConfig.bgColor}</span>
                </div>
              </>
            )}

            {/* ── 3. Katmanlar Sekmesi ──────────────────────────────── */}
            {leftPanelTab === "layers" && (
              <>
                <div className="panel-section-title">
                  <span>Katman Sırası</span>
                  <span style={{ fontSize: 9.5, color: "#94a3b8", fontWeight: 400 }}>
                    ({elements.length} nesne)
                  </span>
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
                      {el.type === "field" ? `[${el.fieldKey}]` : el.type === "text" ? el.text : el.type}
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

            {/* ── 4. Hazır Şablonlar Sekmesi (10 Sektörel Hazır Tasarım) ─── */}
            {leftPanelTab === "presets" && (
              <>
                <div className="panel-section-title">
                  <span>⭐ Sektörel Hazır Şablonlar ({BUILTIN_TEMPLATES.length})</span>
                </div>
                <div style={{ fontSize: 9.5, color: "#94a3b8", marginBottom: 8 }}>
                  Kuyumcu, sarrafiye ve pırlanta için önceden tasarlanmış hazır kalıplar:
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {BUILTIN_TEMPLATES.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="elem-btn"
                      style={{
                        flexDirection: "column",
                        alignItems: "stretch",
                        padding: "8px 10px",
                        gap: 4,
                        cursor: "pointer",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.07)",
                        borderRadius: 6,
                      }}
                      onClick={() => {
                        updateLabelConfig(tmpl.config);
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
                        setSablonAdi(tmpl.ad);
                        setActiveSablon(null);
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 16 }}>{tmpl.icon}</span>
                          <span style={{ fontWeight: 700, fontSize: 11.5, color: "#f8fafc" }}>{tmpl.ad}</span>
                        </div>
                        <span style={{ fontSize: 8.5, background: "rgba(56,189,248,0.15)", color: "#38bdf8", padding: "1px 5px", borderRadius: 3, fontWeight: 600 }}>
                          {tmpl.kategori}
                        </span>
                      </div>
                      <div style={{ fontSize: 9.5, color: "#94a3b8", lineHeight: 1.25 }}>{tmpl.aciklama}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9, color: "#64748b", marginTop: 3 }}>
                        <span>{tmpl.config.genislikMm}×{tmpl.config.yukseklikMm} mm ({tmpl.elements.length} alan)</span>
                        <span style={{ color: "#38bdf8", fontWeight: 600 }}>Tıkla ve Uygula →</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Orta Aydınlık Kanvas Çalışma Alanı (Figma / Canva Grid) ───── */}
        <div className="canvas-area">
          <div
            className="canvas-scroll-container"
            onWheel={handleWheelZoom}
            onMouseDown={handleCanvasMouseDown}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onContextMenu={(e) => handleContextMenu(e)}
          >
            <div className="canvas-workspace">
              {/* Etiket Bounding Box Wrapper */}
              <div className="label-canvas-wrapper">
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
                  <LabelShapeSVG config={labelConfig} zoom={zoom} snapGrid={snapGrid} />

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

                  {/* Tuval Elemanları */}
                  {sortedElements
                    .filter((el) => el.visible)
                    .map((el) => {
                      const isSelected = selectedIds.includes(el.id);
                      const elStyle: React.CSSProperties = {
                        left: mmToPx(el.x, zoom),
                        top: mmToPx(el.y, zoom),
                        width: mmToPx(el.width, zoom),
                        height: mmToPx(el.height, zoom),
                        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                        opacity: el.opacity,
                        zIndex: el.zIndex,
                        cursor: el.locked ? "not-allowed" : "move",
                      };

                      return (
                        <div
                          key={el.id}
                          className={`canvas-element ${isSelected ? "selected" : ""}`}
                          style={elStyle}
                          onMouseDown={(e) => handleElementMouseDown(e, el.id)}
                          onTouchStart={(e) => handleElementTouchStart(e, el.id)}
                          onContextMenu={(e) => handleContextMenu(e, el.id)}
                        >
                          {!isSelected && <div className="element-hover-ring" />}

                          {/* İçerik */}
                          {renderElementContent(el, isSelected)}

                          {/* Seçim ve Boyutlandırma Tutamaçları */}
                          {isSelected && !el.locked && selectedIds.length === 1 && (
                            <>
                              <div className="rotate-handle-line" />
                              <div
                                className="rotate-handle"
                                title="Döndür"
                                onMouseDown={(e) => handleRotateMouseDown(e, el.id)}
                              />
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
                  {lasso && (
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
            </div>
          </div>

          {/* ── Yüzen Zoom Kontrolleri ───────────────────────────────── */}
          <div className="zoom-bar">
            <button
              className="tb-btn"
              style={{ padding: "0 4px", height: 24 }}
              title="Uzaklaştır"
              onClick={() => setZoom((z) => clamp(Math.round((z - 0.2) * 10) / 10, 0.3, 4.5))}
            >
              <IconMinus size={13} />
            </button>
            <span
              className="zoom-value"
              title="150%'e Sıfırla"
              onClick={() => setZoom(1.5)}
            >
              %{Math.round(zoom * 100)}
            </span>
            <button
              className="tb-btn"
              style={{ padding: "0 4px", height: 24 }}
              title="Yaklaştır"
              onClick={() => setZoom((z) => clamp(Math.round((z + 0.2) * 10) / 10, 0.3, 4.5))}
            >
              <IconPlus size={13} />
            </button>
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

        {/* ── Sağ Özellik Paneli (Seçili Eleman Varsa Eleman, Yoksa Kart Boyutları) ─ */}
        <div className={`right-panel ${rightPanelOpen ? "open" : "collapsed"}`}>
          {/* Mobil Başlık ve Kapat Butonu */}
          <div className="panel-header-mobile">
            <span>⚙️ {selectedElement ? "Nesne Özellikleri" : "Kart / Etiket Boyutu"}</span>
            <button
              onClick={() => setRightPanelOpen(false)}
              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer" }}
            >
              <IconX size={18} />
            </button>
          </div>

          {selectedElement ? (
            <>
              {/* Metin & ERP Alan Ayarları */}
              {(selectedElement.type === "text" || selectedElement.type === "field") && (
                <>
                  <div className="prop-group">
                    <div className="prop-group-title">
                      <span>Metin Özellikleri</span>
                      <span style={{ fontSize: 9.5, color: "#38bdf8" }}>{selectedElement.type}</span>
                    </div>
                    {selectedElement.type === "field" && (
                      <div className="prop-row">
                        <span className="prop-label">Alan:</span>
                        <select
                          className="prop-input"
                          value={selectedElement.fieldKey || ""}
                          onChange={(e) => updateElement(selectedElement.id, { fieldKey: e.target.value })}
                        >
                          <option value="">— Seç —</option>
                          {ALTIN_ALANLAR.map((a) => (
                            <option key={a.key} value={a.key}>{a.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {selectedElement.type === "text" && (
                      <div className="prop-row">
                        <span className="prop-label">Metin:</span>
                        <input
                          type="text"
                          className="prop-input"
                          value={selectedElement.text || ""}
                          onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="prop-row">
                      <span className="prop-label">Önek:</span>
                      <input
                        type="text"
                        className="prop-input"
                        value={selectedElement.prefix || ""}
                        placeholder="örn: Gr: "
                        onChange={(e) => updateElement(selectedElement.id, { prefix: e.target.value })}
                      />
                    </div>
                    <div className="prop-row">
                      <span className="prop-label">Sonek:</span>
                      <input
                        type="text"
                        className="prop-input"
                        value={selectedElement.suffix || ""}
                        placeholder="örn: TL"
                        onChange={(e) => updateElement(selectedElement.id, { suffix: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="prop-group">
                    <div className="prop-group-title">Tipografi & Punto</div>
                    <div className="prop-row">
                      <select
                        className="prop-input"
                        style={{ fontFamily: selectedElement.fontFamily }}
                        value={selectedElement.fontFamily || "Arial"}
                        onChange={(e) => updateElement(selectedElement.id, { fontFamily: e.target.value })}
                      >
                        {FONT_FAMILIES.map((f) => (
                          <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div className="prop-row">
                      <span className="prop-label">Punto:</span>
                      <input
                        type="number"
                        className="prop-input"
                        value={selectedElement.fontSize ?? ""}
                        min={4}
                        max={72}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const v = e.target.value === "" ? "" : Number(e.target.value);
                          updateElement(selectedElement.id, { fontSize: v as any });
                        }}
                      />
                      <span style={{ fontSize: 9, color: "#94a3b8" }}>pt</span>
                    </div>

                    {/* Hızlı Punto Butonları */}
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 4 }}>
                      {[6, 7, 8, 9, 10, 11, 12, 14].map((pt) => (
                        <button
                          key={pt}
                          className={`context-punto-btn ${selectedElement.fontSize === pt ? "active" : ""}`}
                          style={{ flex: 1, textAlign: "center", padding: "2px 0" }}
                          onClick={() => updateElement(selectedElement.id, { fontSize: pt })}
                        >
                          {pt}
                        </button>
                      ))}
                    </div>

                    <div className="prop-row" style={{ marginTop: 8 }}>
                      <span className="prop-label">Yazı Rengi:</span>
                      <div className="color-swatch" style={{ background: selectedElement.color || "#000" }}>
                        <input
                          type="color"
                          value={selectedElement.color || "#000000"}
                          onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                        />
                      </div>
                      <span style={{ fontSize: 10, color: "#94a3b8" }}>{selectedElement.color || "#000000"}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Görsel & Logo Ayarları */}
              {(selectedElement.type === "image" || selectedElement.type === "logo") && (
                <div className="prop-group">
                  <div className="prop-group-title">Fotoğraf & Logo Özellikleri</div>
                  {selectedElement.imageData && (
                    <div style={{ textAlign: "center", marginBottom: 8, background: "rgba(0,0,0,0.3)", padding: 6, borderRadius: 4 }}>
                      <img
                        src={selectedElement.imageData}
                        alt="Seçili Görsel"
                        style={{ maxHeight: 60, maxWidth: "100%", objectFit: "contain" }}
                      />
                    </div>
                  )}
                  <button
                    className="elem-btn"
                    style={{ width: "100%", padding: "5px 8px", fontSize: 11, justifyContent: "center", gap: 5 }}
                    onClick={() => {
                      imageTargetIdRef.current = selectedElement?.id || null;
                      imageInputRef.current?.click();
                    }}
                  >
                    <IconUpload size={13} />
                    <span>Fotoğrafı Değiştir</span>
                  </button>
                </div>
              )}

              {/* Şekil Renk & Kenarlık Ayarları */}
              {(selectedElement.type === "rect" || selectedElement.type === "rect-round" || selectedElement.type === "ellipse" || selectedElement.type === "diamond" || selectedElement.type.startsWith("line")) && (
                <div className="prop-group">
                  <div className="prop-group-title">Şekil & Kenarlık</div>
                  <div className="prop-row">
                    <span className="prop-label">Çizgi/Kenar Rengi:</span>
                    <div className="color-swatch" style={{ background: selectedElement.borderColor || "#000" }}>
                      <input
                        type="color"
                        value={selectedElement.borderColor || "#000000"}
                        onChange={(e) => updateElement(selectedElement.id, { borderColor: e.target.value })}
                      />
                    </div>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>{selectedElement.borderColor || "#000000"}</span>
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Kalınlık:</span>
                    <input
                      type="number"
                      className="prop-input"
                      value={selectedElement.borderWidth ?? 1}
                      min={1}
                      max={20}
                      onChange={(e) => {
                        const v = e.target.value === "" ? 1 : Number(e.target.value);
                        updateElement(selectedElement.id, { borderWidth: v });
                      }}
                    />
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>px</span>
                  </div>
                </div>
              )}

              {/* Görünürlük & Kilit */}
              <div className="prop-group">
                <div className="prop-group-title">Katman & Kilit</div>
                <label className="small-form-check" style={{ marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={selectedElement.locked}
                    onChange={(e) => updateElement(selectedElement.id, { locked: e.target.checked })}
                  />
                  <span>Nesneyi Kilitle</span>
                </label>
                <label className="small-form-check">
                  <input
                    type="checkbox"
                    checked={selectedElement.visible}
                    onChange={(e) => updateElement(selectedElement.id, { visible: e.target.checked })}
                  />
                  <span>Görünür</span>
                </label>
              </div>

              <div className="prop-group">
                <button
                  style={{
                    width: "100%",
                    padding: "6px",
                    background: "rgba(239,68,68,0.12)",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 5,
                    color: "#f87171",
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                  }}
                  onClick={() => {
                    dispatch({ type: "DELETE_ELEMENTS", ids: [selectedElement.id] });
                    setSelectedIds([]);
                  }}
                >
                  <IconTrash size={13} />
                  Nesneyi Sil
                </button>
              </div>
            </>
          ) : (
            <>
              {/* ── Hiçbir Eleman Seçili Değilken: Doğrudan KART BOYUTU & ŞEKİL DÜZENLEME ── */}
              <div className="prop-group">
                <div className="prop-group-title">
                  <span>📐 Kart / Etiket Boyutu</span>
                  <span style={{ fontSize: 9, color: "#38bdf8" }}>Genel Ayar</span>
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
                    value={labelConfig.genislikMm}
                    step={1}
                    min={5}
                    max={300}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateLabelConfig({ genislikMm: Number(e.target.value) })}
                  />
                  <span style={{ fontSize: 9, color: "#94a3b8" }}>mm</span>
                </div>
                <div className="prop-row">
                  <span className="prop-label">Yükseklik:</span>
                  <input
                    type="number"
                    className="prop-input"
                    value={labelConfig.yukseklikMm}
                    step={1}
                    min={3}
                    max={200}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => updateLabelConfig({ yukseklikMm: Number(e.target.value) })}
                  />
                  <span style={{ fontSize: 9, color: "#94a3b8" }}>mm</span>
                </div>
              </div>

              {/* Model Detay Ölçüleri (Boğum, Kanatlar, Kuyruk) */}
              {(labelConfig.etiketSekli === "kelebek" || labelConfig.etiketSekli === "dambil" || labelConfig.etiketSekli === "kuyruklu") && (
                <div className="prop-group">
                  <div className="prop-group-title">
                    <span>🔬 Model Milimetrik Boğum & Kuyruk</span>
                  </div>
                  {labelConfig.etiketSekli === "kuyruklu" && (
                    <div className="prop-row">
                      <span className="prop-label">Kuyruk Boyu:</span>
                      <input
                        type="number"
                        className="prop-input"
                        value={labelConfig.kuyrukGenislikMm !== undefined ? labelConfig.kuyrukGenislikMm : 35}
                        step={1}
                        min={10}
                        max={150}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateLabelConfig({ kuyrukGenislikMm: Number(e.target.value) })}
                      />
                      <span style={{ fontSize: 9, color: "#94a3b8" }}>mm</span>
                    </div>
                  )}
                  <div className="prop-row">
                    <span className="prop-label">Boğum Derinliği:</span>
                    <input
                      type="number"
                      className="prop-input"
                      value={labelConfig.bogumDerinlikMm !== undefined ? labelConfig.bogumDerinlikMm : (labelConfig.etiketSekli === "kelebek" ? 2.0 : 3.0)}
                      step={0.5}
                      min={0}
                      max={15}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateLabelConfig({ bogumDerinlikMm: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>mm</span>
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Köprü / Boğum Genişliği:</span>
                    <input
                      type="number"
                      className="prop-input"
                      value={labelConfig.kopruGenislikMm !== undefined ? labelConfig.kopruGenislikMm : (labelConfig.etiketSekli === "kelebek" ? 6 : 8)}
                      step={0.5}
                      min={1}
                      max={30}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateLabelConfig({ kopruGenislikMm: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>mm</span>
                  </div>
                  <div className="prop-row">
                    <span className="prop-label">Sol Kanat Genişliği:</span>
                    <input
                      type="number"
                      className="prop-input"
                      value={labelConfig.solKanatMm || labelConfig.genislikMm / 2}
                      step={1}
                      min={5}
                      max={labelConfig.genislikMm - 5}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateLabelConfig({ solKanatMm: Number(e.target.value) })}
                    />
                    <span style={{ fontSize: 9, color: "#94a3b8" }}>mm</span>
                  </div>
                </div>
              )}

              {/* Hızlı Ölçü Presetleri (Taşmayan Tek Sütun Düzen) */}
              <div className="prop-group">
                <div className="prop-group-title">
                  <span>⚡ Sektörel Standart Ölçüler</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
                  {POPULAR_SIZES.map((ps) => {
                    const isSelected =
                      labelConfig.genislikMm === ps.config.genislikMm &&
                      labelConfig.yukseklikMm === ps.config.yukseklikMm &&
                      labelConfig.etiketSekli === ps.config.etiketSekli;
                    return (
                      <button
                        key={ps.ad}
                        className="elem-btn"
                        style={{
                          padding: "5px 8px",
                          height: "auto",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          borderRadius: 5,
                          width: "100%",
                          background: isSelected ? "rgba(56,189,248,0.18)" : "rgba(255,255,255,0.03)",
                          border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.07)",
                        }}
                        onClick={() => updateLabelConfig(ps.config)}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
                          <span style={{ fontSize: 13, flexShrink: 0 }}>{ps.icon}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ps.ad}
                          </span>
                        </div>
                        <span style={{ fontSize: 9.5, color: isSelected ? "#38bdf8" : "#94a3b8", fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>
                          {ps.config.genislikMm}×{ps.config.yukseklikMm}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="prop-group">
                <div className="prop-group-title">
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
                <div className="prop-row">
                  <span className="prop-label">Renk:</span>
                  <div className="color-swatch" style={{ background: labelConfig.bgColor }} title="Kart Rengi">
                    <input
                      type="color"
                      value={labelConfig.bgColor}
                      onChange={(e) => updateLabelConfig({ bgColor: e.target.value })}
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>{labelConfig.bgColor}</span>
                </div>
              </div>
            </>
          )}
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
                      if (contextMenu.targetId) bringForward(contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <IconArrowUp size={13} />
                    <span>Öne Getir</span>
                    <span className="shortcut">Ctrl+]</span>
                  </div>
                  <div
                    className="context-menu-item"
                    onClick={() => {
                      if (contextMenu.targetId) sendBackward(contextMenu.targetId);
                      setContextMenu(null);
                    }}
                  >
                    <IconArrowDown size={13} />
                    <span>Arkaya Gönder</span>
                    <span className="shortcut">Ctrl+[</span>
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
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {filteredSablonlar.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "#64748b", fontSize: 13 }}>
                Kayıtlı şablon bulunamadı
              </div>
            ) : (
              <div className="sablon-grid">
                {filteredSablonlar.map((s) => {
                  const tip = ETIKET_TIPLERI.find((t) => t.value === s.etiketTipi);
                  const sekil = ETIKET_SEKILLERI.find((x) => x.value === s.etiketSekli);
                  const isActive = activeSablon?.etiketSablonId === s.etiketSablonId;
                  return (
                    <div
                      key={s.etiketSablonId}
                      className={`sablon-card ${isActive ? "active" : ""}`}
                      onClick={() => {
                        handleLoadSablon(s);
                        setDurbunModal(false);
                      }}
                    >
                      <div className="sablon-card-preview">
                        <span style={{ fontSize: 22 }}>{sekil?.icon || tip?.icon || "🏷️"}</span>
                        <Badge
                          bg="secondary"
                          style={{ position: "absolute", top: 5, right: 5, fontSize: 8.5, opacity: 0.9 }}
                        >
                          {sekil?.ad || "Etiket"}
                        </Badge>
                      </div>
                      <div className="sablon-card-name" title={s.ad}>{s.ad}</div>
                      <div className="sablon-card-meta">
                        <span>{s.genislikMm}×{s.yukseklikMm} mm</span>
                        <span>•</span>
                        <span>{s.alanlar?.length || 0} eleman</span>
                      </div>
                      <div style={{ display: "flex", gap: 5, marginTop: "auto" }}>
                        <button
                          style={{
                            flex: 1,
                            padding: "4px 0",
                            background: "#0284c7",
                            border: "none",
                            borderRadius: 4,
                            color: "#fff",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadSablon(s);
                            setDurbunModal(false);
                          }}
                        >
                          Seç & Yükle
                        </button>
                        <button
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
        <Modal.Footer style={{ background: "#0f172a", borderColor: "#334155" }}>
          <button
            style={{ padding: "5px 14px", background: "transparent", border: "1px solid #334155", borderRadius: 5, color: "#94a3b8", fontSize: 12, cursor: "pointer" }}
            onClick={() => setDurbunModal(false)}
          >
            Kapat
          </button>
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
    </div>
  );
};

export default UrunEtiketTasarimiPage;

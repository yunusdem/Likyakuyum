export interface PanoTheme {
  id: string;
  name: string;
  shortName: string;
  description: string;
  tag: string;
  layout: "cyber-exchange" | "sarraf-vitrin" | "card-grid" | "table-ticker";
  isDefault?: boolean;
  isLight?: boolean;
  badgeBg: "primary" | "warning" | "info" | "light" | "success" | "secondary";
  bg: string;
  containerBg: string;
  cardBg: string;
  borderColor: string;
  alisBg: string;
  alisBorder: string;
  alisTextColor: string;
  satisBg: string;
  satisBorder: string;
  satisTextColor: string;
  codeColor: string;
  rateColor: string;
  labelColor?: string;
  headerTextColor?: string;
  rateShadow?: string;
  meshOpacity?: number;
  previewColors: string[];
}

export const PANO_TEMPLATES: PanoTheme[] = [
  {
    id: "classic-cyber",
    name: "Borsa & Siber LED (Varsayılan)",
    shortName: "Siber LED",
    description: "Mevcut popüler tasarım; sol sütunda dev USD/EUR, dalgalanan 3D bayraklar, sağ sütunda diğer dövizler ve siber mesh arka plan.",
    tag: "Varsayılan",
    layout: "cyber-exchange",
    isDefault: true,
    badgeBg: "primary",
    bg: "#161920",
    containerBg: "#161920",
    cardBg: "rgba(0, 0, 0, 0.45)",
    borderColor: "rgba(255, 255, 255, 0.25)",
    alisBg: "#8a2428",
    alisBorder: "#ef4444",
    alisTextColor: "#f87171",
    satisBg: "#1b5e32",
    satisBorder: "#22c55e",
    satisTextColor: "#4ade80",
    codeColor: "#facc15",
    rateColor: "#ffffff",
    rateShadow: "0 0 8px rgba(255, 255, 255, 0.3)",
    meshOpacity: 0.18,
    previewColors: ["#161920", "#ef4444", "#22c55e", "#facc15"],
  },
  {
    id: "sarraf-vitrin",
    name: "Kuyumcu & Sarrafiye TV Panosu (Vitrin Ekranı)",
    shortName: "Kuyumcu Vitrin",
    description: "Görseldeki TV vitrin tasarımı: Üstte 24 Ayar ve 22 Ayar büyük altın külçeli satırlar, altta çift sütun altın paralar (Çeyrek, Yarım, Tam, Ata, Gümüş); kırmızı Alış, yeşil Satış değerleri.",
    tag: "Vitrin Görünümü",
    layout: "sarraf-vitrin",
    badgeBg: "warning",
    bg: "linear-gradient(180deg, #181b22 0%, #0d0f14 100%)",
    containerBg: "#0d0f14",
    cardBg: "rgba(22, 26, 35, 0.8)",
    borderColor: "rgba(255, 255, 255, 0.15)",
    alisBg: "transparent",
    alisBorder: "#ef4444",
    alisTextColor: "#f87171",
    satisBg: "transparent",
    satisBorder: "#22c55e",
    satisTextColor: "#4ade80",
    codeColor: "#ffffff",
    rateColor: "#ffffff",
    rateShadow: "0 0 10px rgba(0, 0, 0, 0.6)",
    meshOpacity: 0.05,
    previewColors: ["#0d0f14", "#d4af37", "#f87171", "#4ade80"],
  },
  {
    id: "card-grid",
    name: "Modern Finans Kartları (Glassmorphism Grid)",
    shortName: "Finans Kartları",
    description: "Tüm döviz ve altınların modern 3D buzlu cam kartlar (grid) halinde dizildiği, rozetli, parıltılı ve trend göstergeleri içeren yüksek teknolojili ekran.",
    tag: "Modern Grid",
    layout: "card-grid",
    badgeBg: "info",
    bg: "linear-gradient(135deg, #070c18 0%, #0f172a 50%, #0b1120 100%)",
    containerBg: "#070c18",
    cardBg: "rgba(30, 41, 59, 0.65)",
    borderColor: "rgba(56, 189, 248, 0.25)",
    alisBg: "rgba(239, 68, 68, 0.22)",
    alisBorder: "#f43f5e",
    alisTextColor: "#fda4af",
    satisBg: "rgba(16, 185, 129, 0.2)",
    satisBorder: "#10b981",
    satisTextColor: "#6ee7b7",
    codeColor: "#38bdf8",
    rateColor: "#ffffff",
    rateShadow: "0 0 12px rgba(56, 189, 248, 0.35)",
    meshOpacity: 0.12,
    previewColors: ["#070c18", "#38bdf8", "#10b981", "#f43f5e"],
  },
  {
    id: "table-ticker",
    name: "Kapalıçarşı & LED Borsa Tablosu",
    shortName: "LED Borsa Tablosu",
    description: "Kapalıçarşı ve borsa salonları tipi tam ekran şerit liste; sıra numaralı, yüksek kontrastlı LED satırlar, hızlı tarama ve yüksek okunabilirlik.",
    tag: "Borsa Şerit Tablo",
    layout: "table-ticker",
    badgeBg: "success",
    bg: "#050907",
    containerBg: "#050907",
    cardBg: "rgba(10, 25, 15, 0.8)",
    borderColor: "rgba(34, 197, 94, 0.3)",
    alisBg: "rgba(220, 38, 38, 0.28)",
    alisBorder: "#ef4444",
    alisTextColor: "#f87171",
    satisBg: "rgba(34, 197, 94, 0.25)",
    satisBorder: "#22c55e",
    satisTextColor: "#4ade80",
    codeColor: "#4ade80",
    rateColor: "#86efac",
    rateShadow: "0 0 10px rgba(74, 222, 128, 0.5)",
    meshOpacity: 0.08,
    previewColors: ["#050907", "#22c55e", "#4ade80", "#ef4444"],
  },
  {
    id: "light-vitrin",
    name: "Aydınlık Sarraf Vitrini (Güneş Işığı Uyumlu)",
    shortName: "Açık Vitrin",
    description: "Gündüz ve güneş ışığı alan dış vitrin ekranları için yansımayı önleyen beyaz/platin zemin, yüksek kontrastlı siyah yazılar ve net vitrin görünümü.",
    tag: "Gündüz & Açık",
    layout: "sarraf-vitrin",
    isLight: true,
    badgeBg: "light",
    bg: "linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%)",
    containerBg: "#f8fafc",
    cardBg: "rgba(255, 255, 255, 0.95)",
    borderColor: "#94a3b8",
    alisBg: "transparent",
    alisBorder: "#b91c1c",
    alisTextColor: "#b91c1c",
    satisBg: "transparent",
    satisBorder: "#15803d",
    satisTextColor: "#15803d",
    codeColor: "#000000",
    rateColor: "#000000",
    labelColor: "#000000",
    headerTextColor: "#000000",
    rateShadow: "none",
    meshOpacity: 0.04,
    previewColors: ["#ffffff", "#000000", "#15803d", "#b91c1c"],
  },
];

export const DEFAULT_PANO_TEMPLATE_ID = "classic-cyber";

export function resolvePanoTheme(templateId?: string | null): PanoTheme {
  if (!templateId) {
    const local = localStorage.getItem("pano_active_template");
    const found = PANO_TEMPLATES.find((t) => t.id === local);
    return found || PANO_TEMPLATES[0];
  }
  const match = PANO_TEMPLATES.find((t) => t.id === templateId);
  if (match) return match;
  // If legacy template name or filename was provided, map appropriately
  if (templateId.includes("sarraf") || templateId.includes("gold") || templateId.includes("luxury")) {
    return PANO_TEMPLATES.find((t) => t.id === "sarraf-vitrin") || PANO_TEMPLATES[1];
  }
  if (templateId.includes("grid") || templateId.includes("glass") || templateId.includes("modern")) {
    return PANO_TEMPLATES.find((t) => t.id === "card-grid") || PANO_TEMPLATES[2];
  }
  if (templateId.includes("table") || templateId.includes("ticker") || templateId.includes("terminal") || templateId.includes("matrix")) {
    return PANO_TEMPLATES.find((t) => t.id === "table-ticker") || PANO_TEMPLATES[3];
  }
  if (templateId.includes("light") || templateId.includes("Vitrin") || templateId.includes("acik")) {
    return PANO_TEMPLATES.find((t) => t.id === "light-vitrin") || PANO_TEMPLATES[4];
  }
  return PANO_TEMPLATES[0];
}

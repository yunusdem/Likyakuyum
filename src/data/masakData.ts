export interface MasakListInfo {
  key: string;
  /** Backend / TODVZ_MASAK_LISTE.LISTE_KOD karsiligi */
  listeKod: "A" | "B" | "C" | "3AB";
  code: string;
  shortTitle: string;
  title: string;
  description: string;
  lawReference: string;
  url: string;
  filename: string;
  tag: string;
  badgeBg: string;
  badgeText: string;
  accentColor: string;
}

export const MASAK_LISTS: MasakListInfo[] = [
  {
    key: "a",
    listeKod: "A",
    code: "A",
    shortTitle: "BMGK Kararları (Madde 5)",
    title: "Birleşmiş Milletler Güvenlik Konseyi Kararına İstinaden Malvarlıkları Dondurulanlar",
    description: "6415 Sayılı Kanun 5. Madde Kapsamında Malvarlıkları Dondurulan Gerçek ve Tüzel Kişiler",
    lawReference: "6415 Sayılı Kanun 5. Madde",
    url: "https://ms.hmb.gov.tr/uploads/sites/12/2026/08/A-BIRLESMIS-MILLETLER-GUVENLIK-KONSEYI-KARARINA-ISTINADEN-MALVARLIKLARI-DONDURULANLAR-6415-SAYILI-KANUN-5.-MADDE-27.08-40e72586a1281a0e.xlsx",
    filename: "A-BMGK-6415-Madde-5.xlsx",
    tag: "BMGK Kararı",
    badgeBg: "#dbeafe",
    badgeText: "#1e40af",
    accentColor: "#2563eb",
  },
  {
    key: "b",
    listeKod: "B",
    code: "B",
    shortTitle: "Yabancı Ülke Talepleri (Madde 6)",
    title: "Yabancı Ülke Taleplerine İstinaden Malvarlıkları Dondurulanlar",
    description: "6415 Sayılı Kanun 6. Madde Kapsamında Yabancı Devletlerin Talepleri Doğrultusunda Dondurulanlar",
    lawReference: "6415 Sayılı Kanun 6. Madde",
    url: "https://ms.hmb.gov.tr/uploads/sites/12/2026/01/B-YABANCI-ULKE-TALEPLERINE-ISTINADEN-MALVARLIKLARI-DONDURULANLAR-6415-SAYILI-KANUN-6.-MADDE-0cb2484e46e910b1.xlsx",
    filename: "B-Yabanci-Ulke-Talepleri-6415-Madde-6.xlsx",
    tag: "Yabancı Ülke",
    badgeBg: "#fef3c7",
    badgeText: "#92400e",
    accentColor: "#d97706",
  },
  {
    key: "c",
    listeKod: "C",
    code: "C",
    shortTitle: "İç Dondurma Kararı (Madde 7)",
    title: "İç Dondurma Kararı ile Malvarlıkları Dondurulanlar",
    description: "6415 Sayılı Kanun 7. Madde Kapsamında Makul Sebeplere İstinaden Malvarlıkları Dondurulanlar",
    lawReference: "6415 Sayılı Kanun 7. Madde",
    url: "https://ms.hmb.gov.tr/uploads/sites/12/2026/07/C-IC-DONDURMA-KARARI-ILE-MALVARLIKLARI-DONDURULANLAR-6415-SAYILI-KANUN-7.-MADDE-G-6e6f23b75ed73de9.xlsx",
    filename: "C-Ic-Dondurma-6415-Madde-7.xlsx",
    tag: "İç Dondurma",
    badgeBg: "#fee2e2",
    badgeText: "#991b1b",
    accentColor: "#dc2626",
  },
  {
    key: "3a3b",
    listeKod: "3AB",
    code: "3.A-B",
    shortTitle: "Kitle İmha Silahları (7262 S.K.)",
    title: "7262 Sayılı Kanun 3.A ve 3.B Maddeleri Kapsamında Malvarlıkları Dondurulanlar",
    description: "Kitle İmha Silahlarının Yayılmasının Finansmanının Önlenmesine İlişkin Kararlar Kapsamında Dondurulanlar",
    lawReference: "7262 Sayılı Kanun 3.A ve 3.B Maddeleri",
    url: "https://ms.hmb.gov.tr/uploads/sites/12/2026/07/D-7262-SAYILI-KANUN-3.A-VE-3.B-MADDELERI-EXCEL-29.07.2026-7065dd0684b9962c.xlsx",
    filename: "D-7262-Kanun-3A-3B.xlsx",
    tag: "7262 S.K.",
    badgeBg: "#ede9fe",
    badgeText: "#5b21b6",
    accentColor: "#7c3aed",
  },
];

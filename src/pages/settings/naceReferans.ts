/**
 * Kuyumculuk / sarrafiye / döviz faaliyetlerinin NACE kodları ve izin verilen KDV oranları — NACE kartında hazır liste.
 *
 * KAYNAK (docs/NACE_KDV_ANALIZ.md): GİB NACE → oran tablosu yayımlamadı (27.03.2026 duyurusu: kontrol ertelendi,
 * 16.03.2026 paket güncellemeleri için işlem yapılmayacak). Oranı mevzuat malın cinsine göre belirler; bu kodların
 * kapsadığı mallar için oranlar resmi mevzuattan türetildi (src/pages/ebelge/kuyumcuKdv.ts): ziynet/sikke altın ve
 * gümüş %20 (özel matrah 805/808), saat/işçilik/tamir %20 genel oran; külçe altın/gümüş ve kıymetli taş istisna
 * (230) ile %0 — istisnalı satır oran kontrolünden bağımsızdır. Döviz bürosu hizmetleri %20; döviz teslimi 17/4-g
 * istisnasıdır (232). Kamuya açık derleme (musavirlerkulubu.com.tr, 10.07.2026) aynı sonucu veriyor.
 */
export interface NaceReferans {
  kod: string;
  ad: string;
  oranlar: number[];
}

export const NACE_REFERANS_TARIHI = "27.09.2026";

export const KUYUMCU_NACE_KODLARI: NaceReferans[] = [
  { kod: "47.77.01", ad: "Altın ve diğer değerli metallerden takı, eşya ve mücevherat perakende ticareti (kuyumculuk)", oranlar: [20] },
  { kod: "47.77.02", ad: "Gümüş takı, eşya ve mücevherat perakende ticareti", oranlar: [20] },
  { kod: "47.77.03", ad: "Saat perakende ticareti", oranlar: [20] },
  { kod: "47.77.05", ad: "İnci, değerli ve yarı değerli taşlardan ürünlerin perakende ticareti", oranlar: [20] },
  { kod: "46.48.01", ad: "Mücevher ve takı toptan ticareti (altın, gümüş vb.; imitasyon hariç)", oranlar: [20] },
  { kod: "46.48.02", ad: "Saat toptan ticareti", oranlar: [20] },
  { kod: "46.82.03", ad: "Birincil formdaki değerli metallerin toptan ticareti (külçe, granül vb.)", oranlar: [20] },
  { kod: "46.86.05", ad: "İşlenmemiş inci, değerli ve yarı değerli taşların toptan ticareti", oranlar: [20] },
  { kod: "32.12.01", ad: "Değerli metallerden takı ve mücevher imalatı", oranlar: [20] },
  { kod: "32.12.04", ad: "İnci ve değerli taşların işlenmesi, değerli taşlardan takı imalatı", oranlar: [20] },
  { kod: "32.12.90", ad: "Mücevher ve benzeri diğer eşyaların imalatı", oranlar: [20] },
  { kod: "24.41.16", ad: "İşlenmemiş / yarı işlenmiş altın imalatı", oranlar: [20] },
  { kod: "24.41.17", ad: "İşlenmemiş / yarı işlenmiş gümüş imalatı", oranlar: [20] },
  { kod: "24.41.19", ad: "Değerli metal alaşımlarının imalatı", oranlar: [20] },
  { kod: "24.54.02", ad: "Değerli metallerin dökümü", oranlar: [20] },
  { kod: "95.25.01", ad: "Saatlerin onarımı", oranlar: [20] },
  { kod: "95.25.02", ad: "Mücevherlerin onarımı", oranlar: [20] },
  { kod: "74.99.04", ad: "Ekspertiz faaliyetleri (antika, mücevher vb.)", oranlar: [20] },
  { kod: "66.12.04", ad: "Döviz bürolarının faaliyetleri", oranlar: [20] },
  { kod: "66.12.06", ad: "Kambiyo hizmetleri (döviz büroları hariç)", oranlar: [20] },
];

export const naceReferansBul = (kod: string): NaceReferans | undefined =>
  KUYUMCU_NACE_KODLARI.find((n) => n.kod === kod.trim());

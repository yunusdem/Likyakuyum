/**
 * Restorant başlığının firmaya özel adı (26.11.2026, karar R4): lisanstaki "Restorant başlık adı" (admin paneli › Firma › Lisans) —
 * "Kafe", "Lokanta", "Pastane" … Boşsa "Restorant". Sunucudan gelen profil (user.merkez.restoranAdi) ekrana hazırlanırken yazılır
 * (kullaniciGorunum.ts › profiliGorunumeGoreHazirla); menü tanımındaki Restorant başlığı buradan okur (DashboardRoute).
 */
export const VARSAYILAN_RESTORAN_ADI = "Restorant";
const EN_UZUN = 40;

let ad = VARSAYILAN_RESTORAN_ADI;

/** Başlık adını temizler: boşluklar toplanır, 40 karakter, harf öneki ("L- ") ve denetim karakterleri atılır; boşsa varsayılan */
export const restoranAdiTemizle = (v: unknown): string => {
  const t = String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/^\s*[A-Za-zÇĞİÖŞÜçğıöşü]\s*[-–—]\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, EN_UZUN)
    .trim();
  return t || VARSAYILAN_RESTORAN_ADI;
};

export const restoranAdi = (): string => ad;
export const restoranAdiAyarla = (v: unknown): void => { ad = restoranAdiTemizle(v); };

/**
 * Yerel gün, fiş ekranlarının tarih kutusu biçimi: "YYYY-MM-DD". Yeni fişin varsayılan tarihi bununla alınır;
 * `new Date().toISOString().slice(0, 10)` UTC günüdür, Türkiye'de 00:00–03:00 arası dünü verir
 * (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md T2).
 */
export const yerelGun = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Kaydedilecek fiş günü. Tarih değiştirme yetkisi kalktı (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md T1): kural her
 * kullanıcıda tarihYetkisi = true verir, kutudaki gün olduğu gibi gider. tarihYetkisi false verilirse (eski davranış)
 * yeni fiş bugünün tarihiyle gider; düzeltmede fişin kendi tarihi kalır.
 */
export const fisGunu = (gun: string, yeniKayit: boolean, tarihYetkisi: boolean): string =>
  !tarihYetkisi && yeniKayit ? yerelGun() : gun;

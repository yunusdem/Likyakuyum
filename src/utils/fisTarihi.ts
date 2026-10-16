/** Yerel gün, fiş ekranlarının tarih kutusu biçimi: "YYYY-MM-DD" */
const yerelGun = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Kaydedilecek fiş günü (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4.2): tarih değiştirme yetkisi olmayanın yeni fişi bugünün
 * tarihiyle gider. Tarih kutusu bu kullanıcıda kilitli olduğundan gece yarısını geçen açık ekran dünün tarihini tutuyor,
 * sunucu da reddediyordu; kullanıcı kutuyu düzeltemiyordu. Düzeltmede fişin kendi tarihi kalır.
 */
export const fisGunu = (gun: string, yeniKayit: boolean, tarihYetkisi: boolean): string =>
  !tarihYetkisi && yeniKayit ? yerelGun() : gun;

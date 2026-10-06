/**
 * Çevrimdışı lisans kodlarını doğrulayan Ed25519 AÇIK anahtarı (base64, SPKI DER).
 * docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 7.3
 *
 * Gizli değildir. Sunucuda `npm run lisans-anahtar` çıktısındaki "AÇIK ANAHTAR" buraya yazılır ve kurulum paketi
 * bundan sonra derlenir. Boşken kurulum modunda hiçbir lisans kabul edilmez (kilit: LISANS_GECERSIZ).
 * Bu değer ortam değişkeninden OKUNMAZ: müşteri makinesinde değiştirilip sahte lisans kabul ettirilemesin.
 */
export const LISANS_ACIK_ANAHTAR = "MCowBQYDK2VwAyEAEqNrvFNrgZ9m54XNbm8H9/8OUxzZuetaxoDtZnVr7t0=";

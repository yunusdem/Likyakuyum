export const AZAMI_AKTIF_ADMIN = 3;
export const LISANS_UYARI_GUN = 30;
/**
 * İçe aktarılmış ve şifresi henüz merkeze taşınmamış kullanıcıların SIFRE_HASH değeri. Bu kullanıcılar ilk girişte
 * firma veritabanındaki eski şifreleriyle doğrulanır; başarılı olursa şifre bcrypt ile merkeze yazılır.
 */
export const ESKI_SIFRE_ISARETI = "ESKI";

import { useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { modulAcikMi } from "../../config/modulKatalogu";
import { useKullaniciYetkisi } from "../../hooks/useKullaniciYetkisi";

/**
 * Mobil modülü firmaya açık mı (açıkça açılan modül: kısıtsız firmada kapalı) ve kullanıcı yönetici mi
 * (docs/MOBIL_CARI_YOL_HARITASI.md K8, K11). Cari kartındaki Mobil Erişim sekmesi ikisi birden doğruysa görünür.
 */
export const useMobilYetkisi = (): { modulAcik: boolean; yonetici: boolean; tanimYapabilir: boolean; ticariAcik: boolean } => {
  const { user } = useAuth();
  const yetki = useKullaniciYetkisi();
  const acik = user?.merkez?.moduller;
  return useMemo(() => {
    const modulAcik = modulAcikMi(acik, "mobil");
    // Ticari modülü açıksa Mobil Ayarları'nda katalog bölümü görünür (Faz 8)
    return { modulAcik, yonetici: !!yetki.yonetici, tanimYapabilir: modulAcik && !!yetki.yonetici, ticariAcik: modulAcikMi(acik, "ticari") };
  }, [acik, yetki]);
};

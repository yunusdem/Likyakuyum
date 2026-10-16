import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { KullaniciYetkisi, yetkiProfilden } from "../../Backend/src/services/yetki/kullaniciYetkiKural";

/**
 * Giriş yapan kullanıcının kart yetkileri (docs/YETKI_VE_VEZNE_YOL_HARITASI.md §4). Sistem yöneticisi her yetkiye sahiptir.
 * Ekrandaki kilitler içindir; aynı kuralları sunucu da uygular.
 */
export const useKullaniciYetkisi = (): KullaniciYetkisi => {
  const { user } = useAuth();
  return useMemo(() => yetkiProfilden(user), [user]);
};

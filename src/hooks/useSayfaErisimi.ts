import { useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { sayfaErisimi } from "../config/modulKatalogu";
import { useKullaniciYetkisi } from "./useKullaniciYetkisi";

/**
 * Bir adrese gidilebilir mi: firmanın lisansında (modül kataloğu) ve kullanıcının menü yetkisinde açık mı. Sayfa içindeki
 * bağlantı ve kısayollar kapalı sayfaya götürmesin diye kullanılır; asıl koruma ModulKorumasi'ndadır.
 */
export const useSayfaErisimi = (): ((yol: string) => boolean) => {
  const { user } = useAuth();
  const acik = user?.merkez?.moduller;
  const yetki = useKullaniciYetkisi();
  return useCallback((yol: string) => sayfaErisimi(acik, yetki, yol), [acik, yetki]);
};

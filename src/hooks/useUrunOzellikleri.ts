import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { urunOzellikleri, UrunOzellikleri } from "../config/modulKatalogu";

/** Firmanın lisansına (açık modüllerine) göre sayfa içinde gösterilecek ürüne özel seçenekler. */
export const useUrunOzellikleri = (): UrunOzellikleri => {
  const { user } = useAuth();
  const acik = user?.merkez?.moduller;
  return useMemo(() => urunOzellikleri(acik), [acik]);
};

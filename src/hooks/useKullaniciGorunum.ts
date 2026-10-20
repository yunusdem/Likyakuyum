import { useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { gorunumYoneticisiMi, kapaliGenislet } from "../config/kullaniciGorunum";

/**
 * Kullanıcı görünümü (docs/KULLANICI_GORUNUM_YOL_HARITASI.md, G3): üst çubuk kontrol düğmeleri (kontrol:*) için.
 * Menü / kısayol / sayfa kısıtları profilin modül listesine indirildiği için ayrı kancaya gerek yoktur.
 */
export const useKullaniciGorunum = () => {
  const { user } = useAuth();
  const yonetici = gorunumYoneticisiMi(user);
  const kapali = useMemo(() => (yonetici ? new Set<string>() : kapaliGenislet(user?.gorunumKapali || [])), [user?.gorunumKapali, yonetici]);
  const kontrolAcik = useCallback((kod: string) => !kapali.has(kod), [kapali]);
  return { yonetici, kapali, kontrolAcik };
};

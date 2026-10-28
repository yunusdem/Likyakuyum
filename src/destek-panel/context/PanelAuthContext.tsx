import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { OTURUM_BITTI_OLAYI, panelApi, PersonelDto, tokenOku, tokenYaz } from "../services/panelApi";

interface PanelAuthDegeri {
  personel: PersonelDto | null;
  yukleniyor: boolean;
  giris: (kullaniciAdi: string, sifre: string) => Promise<void>;
  cikis: () => Promise<void>;
  yenile: () => Promise<void>;
}

const PanelAuthContext = createContext<PanelAuthDegeri | null>(null);

export const PanelAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [personel, setPersonel] = useState<PersonelDto | null>(null);
  const [yukleniyor, setYukleniyor] = useState<boolean>(!!tokenOku());

  const yenile = useCallback(async () => {
    setPersonel(await panelApi.ben());
  }, []);

  useEffect(() => {
    if (!tokenOku()) return;
    panelApi
      .ben()
      .then(setPersonel)
      .catch(() => tokenYaz(null))
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(() => {
    const bitti = () => setPersonel(null);
    window.addEventListener(OTURUM_BITTI_OLAYI, bitti);
    return () => window.removeEventListener(OTURUM_BITTI_OLAYI, bitti);
  }, []);

  const giris = useCallback(async (kullaniciAdi: string, sifre: string) => {
    const s = await panelApi.giris(kullaniciAdi, sifre);
    tokenYaz(s.token);
    setPersonel(s.personel);
  }, []);

  const cikis = useCallback(async () => {
    try {
      await panelApi.cikis();
    } catch {
      // oturum zaten bitmiş olabilir
    }
    tokenYaz(null);
    setPersonel(null);
  }, []);

  const deger = useMemo(() => ({ personel, yukleniyor, giris, cikis, yenile }), [personel, yukleniyor, giris, cikis, yenile]);
  return <PanelAuthContext.Provider value={deger}>{children}</PanelAuthContext.Provider>;
};

export const usePanelAuth = (): PanelAuthDegeri => {
  const ctx = useContext(PanelAuthContext);
  if (!ctx) throw new Error("usePanelAuth, PanelAuthProvider içinde kullanılmalıdır");
  return ctx;
};

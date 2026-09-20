import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminApi, AdminDto, OTURUM_BITTI_OLAYI, tokenOku, tokenYaz } from "../services/adminApi";

interface AdminAuthDegeri {
  admin: AdminDto | null;
  yukleniyor: boolean;
  giris: (kullaniciAdi: string, sifre: string) => Promise<void>;
  cikis: () => Promise<void>;
  yenile: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthDegeri | null>(null);

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminDto | null>(null);
  const [yukleniyor, setYukleniyor] = useState<boolean>(!!tokenOku());

  const yenile = useCallback(async () => {
    setAdmin(await adminApi.ben());
  }, []);

  // Sayfa yenilendiğinde sekmedeki token hâlâ geçerli mi, sunucuya sor
  useEffect(() => {
    if (!tokenOku()) return;
    adminApi
      .ben()
      .then(setAdmin)
      .catch(() => tokenYaz(null))
      .finally(() => setYukleniyor(false));
  }, []);

  useEffect(() => {
    const bitti = () => setAdmin(null);
    window.addEventListener(OTURUM_BITTI_OLAYI, bitti);
    return () => window.removeEventListener(OTURUM_BITTI_OLAYI, bitti);
  }, []);

  const giris = useCallback(async (kullaniciAdi: string, sifre: string) => {
    const sonuc = await adminApi.giris(kullaniciAdi, sifre);
    tokenYaz(sonuc.token);
    setAdmin(sonuc.admin);
  }, []);

  const cikis = useCallback(async () => {
    try {
      await adminApi.cikis();
    } catch {
      // oturum zaten bitmiş olabilir
    }
    tokenYaz(null);
    setAdmin(null);
  }, []);

  const deger = useMemo(() => ({ admin, yukleniyor, giris, cikis, yenile }), [admin, yukleniyor, giris, cikis, yenile]);
  return <AdminAuthContext.Provider value={deger}>{children}</AdminAuthContext.Provider>;
};

export const useAdminAuth = (): AdminAuthDegeri => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth, AdminAuthProvider içinde kullanılmalıdır");
  return ctx;
};

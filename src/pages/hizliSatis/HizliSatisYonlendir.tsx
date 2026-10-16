import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useKullaniciYetkisi } from "../../hooks/useKullaniciYetkisi";
import { acilisModulu, hizliSatisYolu, sonModulOku } from "../../config/hizliSatis";

/** Üst çubuktaki Hızlı Satış kısayolu: en son kullanılan (açık) modülün hızlı satışı (H2) */
const HizliSatisYonlendir: React.FC = () => {
  const { user } = useAuth();
  const yetki = useKullaniciYetkisi();
  const m = acilisModulu(user?.merkez?.moduller, sonModulOku(), yetki);
  if (!m) {
    return (
      <div className="text-center text-muted py-5">
        <h5 className="mb-2">Hızlı satış kullanılabilecek modül yok</h5>
        <p>Perakende, Ticari, Sarraf ya da Döviz hızlı satışından biri hesabınızda açık olmalı.</p>
      </div>
    );
  }
  return <Navigate to={hizliSatisYolu(m)} replace />;
};

export default HizliSatisYonlendir;

import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { usePanelAuth } from "./context/PanelAuthContext";
import PanelLayout from "./layouts/PanelLayout";
import GirisPage from "./pages/GirisPage";
import SifrePage from "./pages/SifrePage";
import TaleplerPage from "./pages/TaleplerPage";
import MusterilerPage from "./pages/MusterilerPage";
import PanelBildirimlerPage from "./pages/PanelBildirimlerPage";
import PersonelPage from "./pages/PersonelPage";
import HizliCevaplarPage from "./pages/HizliCevaplarPage";
import RaporPage from "./pages/RaporPage";

/** Oturum yoksa girişe; geçici şifreyle girildiyse şifre belirleme ekranına kilitler. */
const Korumali: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { personel, yukleniyor } = usePanelAuth();
  const konum = useLocation();
  if (yukleniyor) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" />
      </div>
    );
  }
  if (!personel) return <Navigate to="/giris" replace />;
  if (personel.sifreDegismeli && konum.pathname !== "/sifre") return <Navigate to="/sifre" replace />;
  return children;
};

/** Yalnız destek admini (D4) */
const YalnizAdmin: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { personel } = usePanelAuth();
  return personel?.rol === "ADMIN" ? children : <Navigate to="/" replace />;
};

const PanelApp: React.FC = () => (
  <Routes>
    <Route path="/giris" element={<GirisPage />} />
    <Route
      element={
        <Korumali>
          <PanelLayout />
        </Korumali>
      }
    >
      <Route path="/" element={<TaleplerPage />} />
      <Route path="/musteriler" element={<MusterilerPage />} />
      <Route path="/bildirimler" element={<PanelBildirimlerPage />} />
      <Route path="/sifre" element={<SifrePage />} />
      <Route path="/personel" element={<YalnizAdmin><PersonelPage /></YalnizAdmin>} />
      <Route path="/hizli-cevaplar" element={<YalnizAdmin><HizliCevaplarPage /></YalnizAdmin>} />
      <Route path="/rapor" element={<YalnizAdmin><RaporPage /></YalnizAdmin>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default PanelApp;

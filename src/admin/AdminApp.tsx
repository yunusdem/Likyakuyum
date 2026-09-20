import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Spinner } from "react-bootstrap";
import { useAdminAuth } from "./context/AdminAuthContext";
import AdminLayout from "./layouts/AdminLayout";
import AdminLoginPage from "./pages/AdminLoginPage";
import SifreDegistirPage from "./pages/SifreDegistirPage";
import PanoPage from "./pages/PanoPage";
import AdminlerPage from "./pages/AdminlerPage";
import FirmalarPage from "./pages/FirmalarPage";
import FirmaDetayPage from "./pages/FirmaDetayPage";
import KullanicilarPage from "./pages/KullanicilarPage";
import CevrimiciPage from "./pages/CevrimiciPage";
import GirisGecmisiPage from "./pages/GirisGecmisiPage";
import IslemKaydiPage from "./pages/IslemKaydiPage";

/** Oturum yoksa girişe; geçici şifreyle girildiyse şifre belirleme ekranına kilitler. */
const Korumali: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { admin, yukleniyor } = useAdminAuth();
  const konum = useLocation();

  if (yukleniyor) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner animation="border" />
      </div>
    );
  }
  if (!admin) return <Navigate to="/giris" replace />;
  if (admin.sifreDegismeli && konum.pathname !== "/sifre-degistir") {
    return <Navigate to="/sifre-degistir" replace />;
  }
  return children;
};

const AdminApp: React.FC = () => (
  <Routes>
    <Route path="/giris" element={<AdminLoginPage />} />
    <Route
      element={
        <Korumali>
          <AdminLayout />
        </Korumali>
      }
    >
      <Route path="/" element={<PanoPage />} />
      <Route path="/firmalar" element={<FirmalarPage />} />
      <Route path="/firmalar/:id" element={<FirmaDetayPage />} />
      <Route path="/kullanicilar" element={<KullanicilarPage />} />
      <Route path="/cevrimici" element={<CevrimiciPage />} />
      <Route path="/giris-gecmisi" element={<GirisGecmisiPage />} />
      <Route path="/islem-kaydi" element={<IslemKaydiPage />} />
      <Route path="/adminler" element={<AdminlerPage />} />
      <Route path="/sifre-degistir" element={<SifreDegistirPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AdminApp;

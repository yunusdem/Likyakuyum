import React from "react";
import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import Header from "layouts/header/Header";
import Sidebar from "layouts/Sidebar";
import HomePage from "./pages/HomePage";
import ModulePage from "./pages/ModulePage";
import UserDefinitionsPage from "./pages/settings/UserDefinitionsPage";
import CompanyDefinitionsPage from "./pages/settings/CompanyDefinitionsPage";
import CashDeskDefinitionsPage from "./pages/settings/CashDeskDefinitionsPage";
import PrinterDefinitionsPage from "./pages/settings/PrinterDefinitionsPage";
import ProductDefinitionsPage from "./pages/settings/ProductDefinitionsPage";
import StatisticDefinitionsPage from "./pages/settings/StatisticDefinitionsPage";
import NumeratorDefinitionsPage from "./pages/settings/NumeratorDefinitionsPage";
import CariCardRegistrationPage from "./pages/cari/CariCardRegistrationPage";
import CariCardListPage from "./pages/cari/CariCardListPage";
import CariHareketPage from "./pages/cari/CariHareketPage";
import CariHareketListPage from "./pages/cari/CariHareketListPage";
import KurFiyatListesiPage from "./pages/kur/KurFiyatListesiPage";
import PanoTanimiPage from "./pages/kur/PanoTanimiPage";
import PanoPage from "./pages/kur/PanoPage";
import MasakListsPage from "./pages/settings/MasakListsPage";
import BanknotDefinitionsPage from "./pages/settings/BanknotDefinitionsPage";
import CariEmanetDekontPage from "./pages/cari/CariEmanetDekontPage";
import EBelgeHomePage from "./pages/ebelge/EBelgeHomePage";
import EBelgeGelenPage from "./pages/ebelge/EBelgeGelenPage";
import EBelgeDogrulaPage from "./pages/ebelge/EBelgeDogrulaPage";
import EBelgeGidenPage from "./pages/ebelge/EBelgeGidenPage";
import EBelgeIrsaliyePage from "./pages/ebelge/EBelgeIrsaliyePage";
import EBelgeSettingsPage from "./pages/settings/EBelgeSettingsPage";
import LoginPage from "./pages/auth/LoginPage";


import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { UserThemeApplier } from "./components/theme/UserThemeApplier";
import useMenu from "hooks/useMenu";
import useEnterNavigation from "./hooks/useEnterNavigation";


const DashboardLayout: React.FC = () => {
  const { collapsed, handleCollapsed } = useMenu();
  const isExpanded = collapsed === "expanded" || !collapsed;

  return (
    <div className="dashboard-layout-root min-vh-100 position-relative">
      {/* 1. Main Sidebar */}
      <Sidebar hideLogo={false} containerId="miniSidebar" />

      {/* 2. Mobile Backdrop (closes sidebar on tap outside) */}
      {isExpanded && (
        <div
          className="sidebar-backdrop d-lg-none"
          onClick={() => handleCollapsed("collapsed")}
          aria-hidden="true"
        />
      )}

      {/* 3. Main Content Area */}
      <div id="content" className="position-relative min-vh-100 d-flex flex-column">
        <Header />
        <main className="flex-grow-1 custom-container py-3">
          <Outlet />
        </main>
        <footer className="custom-container py-3 border-top mt-auto bg-body">
          <div className="d-flex align-items-center">
            <img
              src="/images/logo/logo.svg"
              alt="Likya Kuyum Logo"
              className="flex-shrink-0 me-2"
              style={{ width: "22px", height: "22px", objectFit: "contain" }}
            />
            <span className="text-muted small">
              © 2026 <strong className="brand-text-likya">Likya</strong> <strong className="brand-text-kuyum">Kuyum</strong>. Tüm hakları saklıdır.
            </span>
          </div>
        </footer>


      </div>
    </div>
  );
};

export default function App() {
  useEnterNavigation();

  return (
    <AuthProvider>
      <UserThemeApplier />
      <Routes>

        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sign-in" element={<Navigate to="/login" replace />} />

        {/* Protected Dashboard Routes - Requires Valid JWT Token */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<HomePage />} />
            <Route path="ayarlar/kullanici-tanimlari" element={<UserDefinitionsPage />} />
            <Route path="tanimlar/kullanici-tanimlari" element={<UserDefinitionsPage />} />
            <Route path="ayarlar/firma-tanimlari" element={<CompanyDefinitionsPage />} />
            <Route path="tanimlar/firma-tanimlari" element={<CompanyDefinitionsPage />} />
            <Route path="ayarlar/vezne-tanimlari" element={<CashDeskDefinitionsPage />} />
            <Route path="tanimlar/vezne-tanimlari" element={<CashDeskDefinitionsPage />} />
            <Route path="ayarlar/yazici-tanimlari" element={<PrinterDefinitionsPage />} />
            <Route path="tanimlar/yazici-tanimlari" element={<PrinterDefinitionsPage />} />
            <Route path="ayarlar/urun-tanimlari" element={<ProductDefinitionsPage />} />
            <Route path="tanimlar/urun-tanimlari" element={<ProductDefinitionsPage />} />
            <Route path="ayarlar/istatistik-tanimlari" element={<StatisticDefinitionsPage />} />
            <Route path="tanimlar/istatistik-tanimlari" element={<StatisticDefinitionsPage />} />
            <Route path="ayarlar/numeratorler" element={<NumeratorDefinitionsPage />} />
            <Route path="tanimlar/numeratorler" element={<NumeratorDefinitionsPage />} />
            <Route path="ayarlar/numaratorler" element={<NumeratorDefinitionsPage />} />
            <Route path="ayarlar/numarator-tanimlari" element={<NumeratorDefinitionsPage />} />
            <Route path="tanimlar/numarator-tanimlari" element={<NumeratorDefinitionsPage />} />
            <Route path="ayarlar/numerator-tanimlari" element={<NumeratorDefinitionsPage />} />
            <Route path="tanimlar/numerator-tanimlari" element={<NumeratorDefinitionsPage />} />
            <Route path="ayarlar/banknot-tanimlari" element={<BanknotDefinitionsPage />} />
            {/* e-Belge (ICE entegratör) */}
            <Route path="e-belge" element={<EBelgeHomePage />} />
            <Route path="e-belge/gelen" element={<EBelgeGelenPage />} />
            <Route path="e-belge/dogrula" element={<EBelgeDogrulaPage />} />
            <Route path="e-belge/giden" element={<EBelgeGidenPage />} />
            <Route path="e-belge/irsaliye" element={<EBelgeIrsaliyePage />} />
            <Route path="ayarlar/e-belge" element={<EBelgeSettingsPage />} />
            <Route path="tanimlar/e-belge" element={<EBelgeSettingsPage />} />
            <Route path="tanimlar/banknot-tanimlari" element={<BanknotDefinitionsPage />} />
            <Route path="cari/kart-kayit" element={<CariCardRegistrationPage />} />
            <Route path="cari/kayit" element={<CariCardRegistrationPage />} />
            <Route path="cari/kart-duzeltme" element={<CariCardRegistrationPage />} />
            <Route path="cari/cari-kart-kayit" element={<CariCardRegistrationPage />} />
            <Route path="cari/kart-listesi" element={<CariCardListPage />} />
            <Route path="cari/listesi" element={<CariCardListPage />} />
            <Route path="cari/cari-kart-listesi" element={<CariCardListPage />} />
            <Route path="cari/detayli-kart-listesi" element={<CariCardListPage />} />
            <Route path="cari/hareket-kayit" element={<CariHareketPage />} />
            <Route path="cari/hareket-duzeltme" element={<CariHareketPage />} />
            <Route path="cari/hareket-listesi" element={<CariHareketListPage />} />
            <Route path="cari/hareketler" element={<CariHareketListPage />} />
            <Route path="cari/emanet-dekont" element={<CariEmanetDekontPage />} />
            <Route path="cari/cari-emanet-dekont" element={<CariEmanetDekontPage />} />
            <Route path="cari/emanet" element={<CariEmanetDekontPage />} />
            <Route path="kur/anlik-fiyat-listesi" element={<KurFiyatListesiPage pageType="anlik" />} />
            <Route path="kur/gunluk-fiyat-listesi" element={<Navigate to="/kur/anlik-fiyat-listesi" replace />} />
            <Route path="kur/saklanan-fiyat-listesi" element={<KurFiyatListesiPage pageType="saklanan" />} />
            <Route path="kur/pano" element={<PanoPage />} />
            <Route path="kur/pano-tanimi" element={<PanoTanimiPage />} />
            <Route path="tanimlar/pano-tanimi" element={<PanoTanimiPage />} />
            <Route path="ayarlar/masak-dondurulanlar" element={<MasakListsPage />} />
            <Route path="masak" element={<MasakListsPage />} />
            <Route path=":section/*" element={<ModulePage />} />



            <Route path="*" element={<ModulePage />} />
          </Route>
        </Route>






        {/* Catch-all redirect to /dashboard (which will route to /login if unauthenticated) */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}




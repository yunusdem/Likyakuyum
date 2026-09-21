import React from "react";
import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import Header from "layouts/header/Header";
import Sidebar from "layouts/Sidebar";
import HomePage from "./pages/HomePage";
import ModulePage from "./pages/ModulePage";
import UserDefinitionsPage from "./pages/settings/UserDefinitionsPage";
import ChangePasswordPage from "./pages/auth/ChangePasswordPage";
import ModulKorumasi from "./components/auth/ModulKorumasi";
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
import RaporPage from "./pages/rapor/RaporPage";
import BanknotDefinitionsPage from "./pages/settings/BanknotDefinitionsPage";
import CariEmanetDekontPage from "./pages/cari/CariEmanetDekontPage";
import DovizFisiPage from "./pages/vezne/DovizFisiPage";
import VezneTransferiPage from "./pages/vezne/VezneTransferiPage";
import VezneIzlemePage from "./pages/vezne/VezneIzlemePage";
import SarrafFisiPage from "./pages/vezne/SarrafFisiPage";
import PerakendeFisiPage from "./pages/vezne/PerakendeFisiPage";
import BankaHesapKartiPage from "./pages/banka/BankaHesapKartiPage";
import BankaHareketiPage from "./pages/banka/BankaHareketiPage";
import KasaHesapKayitPage from "./pages/kasa/KasaHesapKayitPage";
import KasaHareketPage from "./pages/kasa/KasaHareketPage";
import BarkodEtiketBasimiPage from "./pages/etiket/BarkodEtiketBasimiPage";
import AltinUrunTanimlamaPage from "./pages/etiket/AltinUrunTanimlamaPage";
import OzelUrunTanimlamaPage from "./pages/etiket/OzelUrunTanimlamaPage";
import UrunEtiketTasarimiPage from "./pages/etiket/UrunEtiketTasarimiPage";
import BarkodluSayimFisiPage from "./pages/etiket/BarkodluSayimFisiPage";
import TopluEtiketYazdirmaPage from "./pages/etiket/TopluEtiketYazdirmaPage";
import YuzukBilezikEtiketiPage from "./pages/etiket/YuzukBilezikEtiketiPage";
import FiyatAyarEtiketleriPage from "./pages/etiket/FiyatAyarEtiketleriPage";
import EBelgeHomePage from "./pages/ebelge/EBelgeHomePage";
import EBelgeGelenPage from "./pages/ebelge/EBelgeGelenPage";
import EBelgeDogrulaPage from "./pages/ebelge/EBelgeDogrulaPage";
import EBelgeGidenPage from "./pages/ebelge/EBelgeGidenPage";
import EBelgeIrsaliyePage from "./pages/ebelge/EBelgeIrsaliyePage";
import EBelgeGiderPage from "./pages/ebelge/EBelgeGiderPage";
import EBelgeKaynakPage from "./pages/ebelge/EBelgeKaynakPage";
import EBelgeMustahsilPage from "./pages/ebelge/EBelgeMustahsilPage";
import EBelgeSettingsPage from "./pages/settings/EBelgeSettingsPage";
import LoginPage from "./pages/auth/LoginPage";
import LandingPage from "./pages/LandingPage";


import ProtectedRoute from "./components/auth/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ERPContextMenu } from "./components/common/ERPContextMenu";
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
        <main className="flex-grow-1 custom-container pt-1 pb-3">
          <ModulKorumasi />
        </main>
        <footer className="custom-container py-3 border-top mt-auto bg-body">
          <div className="d-flex align-items-center">
            <img
              src="/images/logo/logo.svg"
              alt="Likya Kuyum Logo"
              className="flex-shrink-0 me-2"
              style={{ width: "22px", height: "22px", objectFit: "contain" }}
            />
            <span className="text-muted small d-inline-flex align-items-center">
              © 2026&nbsp;<strong className="text-dark fw-bold">LİKYA KUYUM</strong>.&nbsp;Tüm hakları saklıdır.
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
      <ToastProvider>
        <UserThemeApplier />
        <ERPContextMenu />
        <Routes>

        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/sign-in" element={<Navigate to="/login" replace />} />

        {/* Protected Dashboard Routes - Requires Valid JWT Token */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route path="dashboard" element={<HomePage />} />
            <Route path="sifre-degistir" element={<ChangePasswordPage />} />
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
            <Route path="e-belge/gider" element={<EBelgeGiderPage />} />
            <Route path="e-belge/kaynak" element={<EBelgeKaynakPage />} />
            <Route path="e-belge/mustahsil" element={<EBelgeMustahsilPage />} />
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
            <Route path="cari/emanet-duzeltme" element={<CariEmanetDekontPage />} />
            <Route path="cari/emanet-dekont-duzeltme" element={<CariEmanetDekontPage />} />
            <Route path="cari/emanet-dekont-kayit" element={<CariEmanetDekontPage />} />
            <Route path="cari/emanet-kayit" element={<CariEmanetDekontPage />} />
            <Route path="cari/cari-emanet-dekont" element={<CariEmanetDekontPage />} />
                        <Route path="cari/emanet" element={<CariEmanetDekontPage />} />
            <Route path="vezne/doviz-fisi" element={<DovizFisiPage />} />
            <Route path="vezne/doviz-fis" element={<DovizFisiPage />} />
            <Route path="vezne/doviz-fisi-kayit" element={<DovizFisiPage />} />
            <Route path="vezne/doviz-fisi-duzeltme" element={<DovizFisiPage />} />
            <Route path="vezne/doviz-fis-duzeltme" element={<DovizFisiPage />} />
            <Route path="vezne/transfer-kayit" element={<VezneTransferiPage />} />
            <Route path="vezne/transfer-duzeltme" element={<VezneTransferiPage />} />
            <Route path="vezne/vezne-transferi-kayit" element={<VezneTransferiPage />} />
            <Route path="vezne/vezne-transferi-duzeltme" element={<VezneTransferiPage />} />
            <Route path="vezne/vezne-transferi" element={<VezneTransferiPage />} />
            <Route path="vezne/transfer" element={<VezneTransferiPage />} />
            <Route path="vezne/izleme" element={<VezneIzlemePage />} />
            <Route path="vezne/vezne-izleme" element={<VezneIzlemePage />} />
            <Route path="vezne/sarraf-fisi" element={<SarrafFisiPage key="sarraf-kayit" isDuzeltme={false} />} />
            <Route path="vezne/sarraf-fisi-kayit" element={<SarrafFisiPage key="sarraf-kayit" isDuzeltme={false} />} />
            <Route path="vezne/genel-sarraf-fisi" element={<SarrafFisiPage key="sarraf-kayit" isDuzeltme={false} />} />
            <Route path="vezne/sarraf-fisi-duzeltme" element={<SarrafFisiPage key="sarraf-duzeltme" isDuzeltme={true} />} />
            <Route path="vezne/perakende-fisi" element={<PerakendeFisiPage key="perakende-kayit" isDuzeltme={false} />} />
            <Route path="vezne/perakende-fis" element={<PerakendeFisiPage key="perakende-kayit" isDuzeltme={false} />} />
            <Route path="vezne/perakende-fisi-kayit" element={<PerakendeFisiPage key="perakende-kayit" isDuzeltme={false} />} />
            <Route path="vezne/perakende" element={<PerakendeFisiPage key="perakende-kayit" isDuzeltme={false} />} />
            <Route path="vezne/perakende-fisi-duzeltme" element={<PerakendeFisiPage key="perakende-duzeltme" isDuzeltme={true} />} />
            <Route path="vezne/perakende-duzeltme" element={<PerakendeFisiPage key="perakende-duzeltme" isDuzeltme={true} />} />
            <Route path="kur/anlik-fiyat-listesi" element={<KurFiyatListesiPage pageType="anlik" />} />
            <Route path="kur/gunluk-fiyat-listesi" element={<Navigate to="/kur/anlik-fiyat-listesi" replace />} />
            <Route path="kur/saklanan-fiyat-listesi" element={<KurFiyatListesiPage pageType="saklanan" />} />
            <Route path="kur/pano" element={<PanoPage />} />
            <Route path="kur/pano-tanimi" element={<PanoTanimiPage />} />
            <Route path="tanimlar/pano-tanimi" element={<PanoTanimiPage />} />
            <Route path="ayarlar/masak-dondurulanlar" element={<MasakListsPage />} />
            <Route path="masak" element={<MasakListsPage />} />
            {/* Eski "Belge / Fiş PDF" adresleri e-Belge ana sayfasına gider */}
            <Route path="belge" element={<Navigate to="/e-belge" replace />} />
            <Route path="raporlar/belge" element={<Navigate to="/e-belge" replace />} />
            <Route path="raporlar/:yol" element={<RaporPage />} />
            <Route path="banka/hesap-kartlari" element={<BankaHesapKartiPage />} />
            <Route path="banka/hesap-karti" element={<BankaHesapKartiPage />} />
            <Route path="banka/hareketler" element={<BankaHareketiPage />} />
            <Route path="banka/hesap-hareketleri" element={<BankaHareketiPage />} />
            <Route path="kasa/hesap-kayit" element={<KasaHesapKayitPage />} />
            <Route path="kasa/hesap-duzeltme" element={<KasaHesapKayitPage />} />
            <Route path="kasa/hareket-kayit" element={<KasaHareketPage />} />
            <Route path="kasa/hareket-duzeltme" element={<KasaHareketPage />} />
            <Route path="kasa/kasa-hareket-kayit" element={<KasaHareketPage />} />
            <Route path="kasa/kasa-hareket-duzeltme" element={<KasaHareketPage />} />
            <Route path="kasa/hareket" element={<KasaHareketPage />} />
            <Route path="kasa/kasa-hareket" element={<KasaHareketPage />} />
            <Route path="etiket/barkod-fiyat" element={<BarkodEtiketBasimiPage />} />
            <Route path="etiket/barkod-basimi" element={<BarkodEtiketBasimiPage />} />
            <Route path="etiket/altin-urun-barkodlama" element={<AltinUrunTanimlamaPage />} />
            <Route path="etiket/altin-urun-duzeltme" element={<AltinUrunTanimlamaPage />} />
            <Route path="etiket/altin-urun-tanimlama" element={<AltinUrunTanimlamaPage />} />
            <Route path="etiket/ozel-urun-barkodlama" element={<OzelUrunTanimlamaPage />} />
            <Route path="etiket/ozel-urun-duzeltme" element={<OzelUrunTanimlamaPage />} />
            <Route path="etiket/ozel-urun-tanimlama" element={<OzelUrunTanimlamaPage />} />
            <Route path="etiket/altin-etiket-tasarimi" element={<UrunEtiketTasarimiPage />} />
            <Route path="etiket/ozel-urun-etiket-tasarimi" element={<UrunEtiketTasarimiPage />} />
            <Route path="etiket/tasarim" element={<UrunEtiketTasarimiPage />} />
            <Route path="etiket/fiyat-etiketi" element={<FiyatAyarEtiketleriPage />} />
            <Route path="etiket/sayim-fisi" element={<BarkodluSayimFisiPage />} />
            <Route path="etiket/barkodlu-sayim-fisi" element={<BarkodluSayimFisiPage />} />
            <Route path=":section/*" element={<ModulePage />} />



            <Route path="*" element={<ModulePage />} />
          </Route>
        </Route>






        {/* Catch-all redirect to /dashboard (which will route to /login if unauthenticated) */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}




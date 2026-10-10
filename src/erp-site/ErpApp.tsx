import React, { useEffect } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Ust } from "./bilesenler/Ust";
import { Alt } from "./bilesenler/Alt";
import { SabitIletisim } from "./bilesenler/Ortak";
import { AnaSayfa } from "./sayfalar/AnaSayfa";
import { UrunSayfasi } from "./sayfalar/UrunSayfasi";
import { Karsilastir } from "./sayfalar/Karsilastir";
import { Entegrasyonlar } from "./sayfalar/Entegrasyonlar";
import { Hakkimizda } from "./sayfalar/Hakkimizda";
import { Iletisim } from "./sayfalar/Iletisim";
import { Gizlilik, Kvkk } from "./sayfalar/Yasal";
import { Bulunamadi } from "./sayfalar/Bulunamadi";
import { analitikKur, sayfaGoruntulendi } from "./yardimci/analitik";

/** www.likyaerp.com düzeni ve yolları (docs/LIKYAERP_TANITIM_SITESI.md §4). */
const Duzen: React.FC = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    analitikKur();
  }, []);

  // Sayfa değişince başa dön (çapa varsa ona git); başlık güncellendikten sonra sayfa görüntüleme gönder
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo(0, 0);
    }
    const t = window.setTimeout(() => sayfaGoruntulendi(pathname), 50);
    return () => window.clearTimeout(t);
  }, [pathname, hash]);

  return (
    <>
      <a href="#icerik" className="atla">
        İçeriğe geç
      </a>
      <Ust />
      <main id="icerik">
        <Outlet />
      </main>
      <Alt />
      <SabitIletisim />
    </>
  );
};

export const ErpApp: React.FC = () => (
  <Routes>
    <Route element={<Duzen />}>
      <Route path="/" element={<AnaSayfa />} />
      <Route path="/urunler/:slug" element={<UrunSayfasi />} />
      <Route path="/karsilastir" element={<Karsilastir />} />
      <Route path="/entegrasyonlar" element={<Entegrasyonlar />} />
      <Route path="/hakkimizda" element={<Hakkimizda />} />
      <Route path="/iletisim" element={<Iletisim />} />
      <Route path="/kvkk" element={<Kvkk />} />
      <Route path="/gizlilik" element={<Gizlilik />} />
      <Route path="*" element={<Bulunamadi />} />
    </Route>
  </Routes>
);

export default ErpApp;

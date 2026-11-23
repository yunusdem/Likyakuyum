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
import { uygulamaPenceresiMi, wwwAdresi } from "./yardimci/wwwYonlendir";

/** www.likyaerp.com düzeni ve yolları (docs/LIKYAERP_TANITIM_SITESI.md §4). */
export const ErpDuzen: React.FC = () => {
  const { pathname, hash, search } = useLocation();
  // likyaerp.com (www'siz, uygulama) içinden tanıtım sayfasına gelinirse (ör. giriş ekranındaki "Ana Sayfaya Dön") www'deki stilli siteye geç
  const www = typeof window !== "undefined" ? wwwAdresi({ hostname: window.location.hostname, pathname, search, hash }, uygulamaPenceresiMi()) : null;

  useEffect(() => {
    if (www) window.location.replace(www);
  }, [www]);

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

  if (www) return null;

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
    <Route element={<ErpDuzen />}>
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

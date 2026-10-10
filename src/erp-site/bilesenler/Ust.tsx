import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { IconArrowRight, IconChevronDown, IconMenu2, IconPhone, IconX } from "@tabler/icons-react";
import { URUNLER } from "../veri/urunler";
import { SIRKET, TEL_LINK } from "../veri/sirket";
import { Logo } from "./Logo";
import { urunStili } from "./UrunStil";

/** Üst menü: masaüstünde "Ürünler" açılır paneli, mobilde tam ekran menü. Sitede giriş düğmesi yok (K4). */
export const Ust: React.FC = () => {
  const konum = useLocation();
  const [kaydi, setKaydi] = useState(false);
  const [urunlerAcik, setUrunlerAcik] = useState(false);
  const [mobilAcik, setMobilAcik] = useState(false);
  const acilirRef = useRef<HTMLDivElement>(null);
  const kapatZamanlayici = useRef<number | undefined>(undefined);

  useEffect(() => {
    const kaydir = () => setKaydi(window.scrollY > 8);
    kaydir();
    window.addEventListener("scroll", kaydir, { passive: true });
    return () => window.removeEventListener("scroll", kaydir);
  }, []);

  // Sayfa değişince menüler kapanır
  useEffect(() => {
    setUrunlerAcik(false);
    setMobilAcik(false);
  }, [konum.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobilAcik ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobilAcik]);

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUrunlerAcik(false);
        setMobilAcik(false);
      }
    };
    const disTik = (e: MouseEvent) => {
      if (acilirRef.current && !acilirRef.current.contains(e.target as Node)) setUrunlerAcik(false);
    };
    document.addEventListener("keydown", tus);
    document.addEventListener("mousedown", disTik);
    return () => {
      document.removeEventListener("keydown", tus);
      document.removeEventListener("mousedown", disTik);
    };
  }, []);

  const ac = () => {
    window.clearTimeout(kapatZamanlayici.current);
    setUrunlerAcik(true);
  };
  const gecikmeliKapat = () => {
    kapatZamanlayici.current = window.setTimeout(() => setUrunlerAcik(false), 140);
  };

  const urunSayfasinda = konum.pathname.startsWith("/urunler");

  return (
    <>
      <header className={`ust${kaydi || mobilAcik ? " kaydi" : ""}`}>
        <div className="k">
          <Logo />

          <nav className="menu" aria-label="Ana menü">
            <div
              ref={acilirRef}
              className={`acilir${urunlerAcik ? " acik" : ""}`}
              onMouseEnter={ac}
              onMouseLeave={gecikmeliKapat}
            >
              <button
                type="button"
                aria-expanded={urunlerAcik}
                aria-controls="urunler-paneli"
                onClick={() => setUrunlerAcik((v) => !v)}
                style={urunSayfasinda ? { color: "var(--metin)" } : undefined}
              >
                Ürünler <IconChevronDown size={16} aria-hidden="true" />
              </button>
              <div className="acilir-panel" id="urunler-paneli" role="menu">
                {URUNLER.map((u) => {
                  const Ikon = u.ikon;
                  return (
                    <Link key={u.kod} to={`/urunler/${u.slug}`} className="acilir-oge" role="menuitem" style={urunStili(u)}>
                      <span className="ikon-kutu">
                        <Ikon size={22} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{u.ad}</strong>
                        <span>{u.etiket}</span>
                      </span>
                    </Link>
                  );
                })}
                <div className="acilir-alt">
                  <span>Hangisi size uygun, emin değil misiniz?</span>
                  <Link to="/karsilastir">Ürünleri karşılaştırın →</Link>
                </div>
              </div>
            </div>
            <NavLink to="/karsilastir" className={({ isActive }) => (isActive ? "aktif" : "")}>
              Karşılaştır
            </NavLink>
            <NavLink to="/entegrasyonlar" className={({ isActive }) => (isActive ? "aktif" : "")}>
              Entegrasyonlar
            </NavLink>
            <NavLink to="/hakkimizda" className={({ isActive }) => (isActive ? "aktif" : "")}>
              Hakkımızda
            </NavLink>
            <NavLink to="/iletisim" className={({ isActive }) => (isActive ? "aktif" : "")}>
              İletişim
            </NavLink>
          </nav>

          <div className="menu-sag">
            <a href={TEL_LINK} className="dugme dugme-cizgi dugme-kucuk" aria-label={`Bizi arayın: ${SIRKET.telefon}`}>
              <IconPhone size={16} aria-hidden="true" /> Arayın
            </a>
            <Link to="/iletisim" className="dugme dugme-ana dugme-kucuk">
              Demo İste <IconArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>

          <button
            type="button"
            className="menu-dugme"
            aria-label={mobilAcik ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={mobilAcik}
            aria-controls="mobil-menu"
            onClick={() => setMobilAcik((v) => !v)}
          >
            {mobilAcik ? <IconX size={22} /> : <IconMenu2 size={22} />}
          </button>
        </div>
      </header>

      <div id="mobil-menu" className={`mobil-menu${mobilAcik ? " acik" : ""}`} hidden={!mobilAcik}>
        <h4>Ürünler</h4>
        {URUNLER.map((u) => {
          const Ikon = u.ikon;
          return (
            <Link key={u.kod} to={`/urunler/${u.slug}`} className="mobil-oge" style={urunStili(u)}>
              <span className="ikon-kutu">
                <Ikon size={20} aria-hidden="true" />
              </span>
              {u.ad}
            </Link>
          );
        })}
        <div className="ayrac" />
        <Link to="/karsilastir" className="mobil-oge">Karşılaştır</Link>
        <Link to="/entegrasyonlar" className="mobil-oge">Entegrasyonlar</Link>
        <Link to="/hakkimizda" className="mobil-oge">Hakkımızda</Link>
        <Link to="/iletisim" className="mobil-oge">İletişim</Link>
        <div className="ayrac" />
        <Link to="/iletisim" className="dugme dugme-ana">
          Demo İste <IconArrowRight size={16} aria-hidden="true" />
        </Link>
        <a href={TEL_LINK} className="dugme dugme-cizgi">
          <IconPhone size={16} aria-hidden="true" /> {SIRKET.telefon}
        </a>
      </div>
    </>
  );
};

export default Ust;

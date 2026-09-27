import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  IconDeviceTv,
  IconArrowsExchange,
  IconSparkles,
  IconCheck,
  IconArrowRight,
  IconDeviceDesktop,
  IconFlame,
  IconSettings,
  IconVolume,
  IconCoins,
} from "@tabler/icons-react";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";

export const LandingPanoPage: React.FC = () => {
  const navigate = useNavigate();

  const [prices, setPrices] = useState({
    hasAltin: { alis: 3452.8, satis: 3488.5, fark: "+0.45%" },
    bilezik22: { alis: 3165.0, satis: 3345.0, fark: "+0.38%" },
    altin18k: { alis: 2540.0, satis: 2790.0, fark: "+0.40%" },
    altin14k: { alis: 1985.0, satis: 2315.0, fark: "+0.35%" },
    ceyrek: { alis: 5620.0, satis: 5740.0, fark: "+0.52%" },
    yarim: { alis: 11240.0, satis: 11480.0, fark: "+0.52%" },
    tam: { alis: 22480.0, satis: 22960.0, fark: "+0.50%" },
    ata: { alis: 23100.0, satis: 23550.0, fark: "+0.48%" },
    usd: { alis: 36.44, satis: 36.60, fark: "+0.12%" },
    eur: { alis: 38.18, satis: 38.38, fark: "+0.18%" },
    gbp: { alis: 45.30, satis: 45.75, fark: "+0.25%" },
    gumus: { alis: 39.85, satis: 42.20, fark: "+0.60%" },
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setPrices((prev) => ({
        ...prev,
        hasAltin: {
          ...prev.hasAltin,
          alis: Number((prev.hasAltin.alis + (Math.random() * 0.8 - 0.4)).toFixed(2)),
          satis: Number((prev.hasAltin.satis + (Math.random() * 0.8 - 0.4)).toFixed(2)),
        },
        usd: {
          ...prev.usd,
          alis: Number((prev.usd.alis + (Math.random() * 0.02 - 0.01)).toFixed(2)),
          satis: Number((prev.usd.satis + (Math.random() * 0.02 - 0.01)).toFixed(2)),
        },
      }));
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const panoFeatures = [
    {
      title: "Full-Screen TV Modu (4K & Full HD)",
      desc: "Akıllı televizyonunuza veya TV'ye bağlı minik bir Android/PC cihazına ek bir yazılım yüklemeden, standart tarayıcı üzerinden F11 tam ekran çalışır.",
      icon: <IconDeviceTv size={26} className="text-warning" />,
    },
    {
      title: "Anlık Piyasa & Otomatik Marj",
      desc: "Kapalıçarşı ve serbest piyasa ham kurlarını anında çeker; dükkanınıza özel belirlediğiniz alış ve satış kâr marjlarını otomatik ekleyerek panoya yansıtır.",
      icon: <IconArrowsExchange size={26} className="text-warning" />,
    },
    {
      title: "Kişiselleştirilebilir Görsel Şablonlar",
      desc: "Kayan duyuru bandı, firma logonuz, altın rengi lüks temalar, nöbetçi eczane ve döviz kurları kutularını dilediğiniz gibi açıp kapatabilirsiniz.",
      icon: <IconSettings size={26} className="text-warning" />,
    },
    {
      title: "Websocket ile Sıfır Gecikme",
      desc: "Sayfa yenilemeye gerek kalmadan, fiyat değişimleri anında yeşil/kırmızı animasyonlarla müşterinizin gözü önünde canlı güncellenir.",
      icon: <IconFlame size={26} className="text-warning" />,
    },
  ];

  return (
    <div className="w-100 min-vh-100 bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <LandingNavbar />

      {/* Header */}
      <section className="py-5 border-bottom" style={{ background: "linear-gradient(180deg, #faf6ef 0%, #ffffff 100%)" }}>
        <div className="container text-center py-3" style={{ maxWidth: "960px" }}>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill mb-3 bg-white border shadow-sm" style={{ borderColor: "#ebdcc8" }}>
            <IconSparkles size={16} className="text-warning" />
            <span className="small fw-bold text-uppercase" style={{ color: "#784405", fontSize: "0.78rem" }}>
              Mağaza Vitrin & Müşteri Ekranı
            </span>
          </div>

          <h1 className="fw-bolder display-5 text-dark mb-3">
            Canlı Kur ve <span style={{ color: "#b8860b" }}>TV Fiyat Panosu</span>
          </h1>

          <p className="lead text-secondary mx-auto mb-4" style={{ maxWidth: "760px", fontSize: "1.08rem", lineHeight: "1.7" }}>
            Mağazanıza giren müşterilerinize güven veren, Kapalıçarşı canlı verileriyle senkronize, ultra şık 4K altın ve döviz fiyat panosu.
          </p>

          <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="btn px-4 py-2.5 rounded-pill text-white fw-bold d-inline-flex align-items-center gap-2 shadow-sm"
              style={{ background: "linear-gradient(135deg, #c88f18 0%, #9e640b 100%)", border: "none" }}
            >
              <IconDeviceTv size={20} />
              <span>Panoyu Canlı Başlat</span>
            </button>
          </div>
        </div>
      </section>

      {/* Live Interactive Pano Showcase */}
      <section className="py-5 py-md-6 bg-white">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="text-center mb-4">
            <h6 className="fw-bold text-uppercase text-warning" style={{ fontSize: "0.82rem", letterSpacing: "1.5px" }}>
              CANLI İNTERAKTİF ÖNİZLEME
            </h6>
            <h2 className="fw-bolder text-dark">Mağazanızın Televizyonunda Bu Şekilde Görünür</h2>
          </div>

          {/* TV Frame Mockup */}
          <div
            className="p-3 p-md-4 rounded-4 shadow-lg border position-relative overflow-hidden mb-5"
            style={{
              background: "linear-gradient(145deg, #181511 0%, #241d15 50%, #15120e 100%)",
              borderColor: "#c88f18",
              boxShadow: "0 25px 60px rgba(90, 50, 10, 0.25)",
            }}
          >
            {/* TV Header inside Mockup */}
            <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom border-secondary border-opacity-25 flex-wrap gap-2 text-white">
              <div className="d-flex align-items-center gap-3">
                <img src="/images/logo/logo.svg" alt="Logo" style={{ width: "40px", height: "40px" }} />
                <div>
                  <h4 className="fw-bold mb-0 letter-spacing-1 text-warning">LİKYA KUYUMCULUK & SARRAFİYE</h4>
                  <span className="small text-white-50" style={{ fontSize: "0.75rem" }}>
                    CANLI PİYASA FİYAT BÜLTENİ · {new Date().toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-danger rounded-pill px-3 py-1.5 small fw-bold">
                  CANLI YAYIN (0 ms)
                </span>
              </div>
            </div>

            {/* Pano Table Grid */}
            <div className="row g-2.5">
              {[
                { title: "Has Altın (Gr)", buy: prices.hasAltin.alis, sell: prices.hasAltin.satis, color: "#f59e0b" },
                { title: "22 Ayar Bilezik", buy: prices.bilezik22.alis, sell: prices.bilezik22.satis, color: "#fbbf24" },
                { title: "18 Ayar Altın", buy: prices.altin18k.alis, sell: prices.altin18k.satis, color: "#fbbf24" },
                { title: "14 Ayar Hurda", buy: prices.altin14k.alis, sell: prices.altin14k.satis, color: "#fbbf24" },
                { title: "Çeyrek Altın", buy: prices.ceyrek.alis, sell: prices.ceyrek.satis, color: "#f59e0b" },
                { title: "Yarım Altın", buy: prices.yarim.alis, sell: prices.yarim.satis, color: "#f59e0b" },
                { title: "Tam Ziynet", buy: prices.tam.alis, sell: prices.tam.satis, color: "#f59e0b" },
                { title: "Ata Lira", buy: prices.ata.alis, sell: prices.ata.satis, color: "#f59e0b" },
                { title: "Amerikan Doları (USD)", buy: prices.usd.alis, sell: prices.usd.satis, color: "#10b981" },
                { title: "Euro (EUR)", buy: prices.eur.alis, sell: prices.eur.satis, color: "#10b981" },
                { title: "İngiliz Sterlini (GBP)", buy: prices.gbp.alis, sell: prices.gbp.satis, color: "#10b981" },
                { title: "Gümüş Has (Gr)", buy: prices.gumus.alis, sell: prices.gumus.satis, color: "#94a3b8" },
              ].map((item, idx) => (
                <div key={idx} className="col-12 col-sm-6 col-lg-3">
                  <div
                    className="p-3 rounded-3 text-white border"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      borderColor: "rgba(200, 143, 24, 0.2)",
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold small" style={{ color: item.color }}>
                        {item.title}
                      </span>
                    </div>
                    <div className="d-flex align-items-center justify-content-between">
                      <div>
                        <div className="text-white-50" style={{ fontSize: "0.7rem" }}>ALIŞ</div>
                        <div className="fw-bold" style={{ fontSize: "1rem" }}>{item.buy.toLocaleString("tr-TR")} ₺</div>
                      </div>
                      <div className="text-end">
                        <div className="text-white-50" style={{ fontSize: "0.7rem" }}>SATIŞ</div>
                        <div className="fw-bolder text-warning" style={{ fontSize: "1.05rem" }}>{item.sell.toLocaleString("tr-TR")} ₺</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Kayan Yazı Mockup */}
            <div className="mt-3 p-2 rounded-2 text-white small d-flex align-items-center gap-2" style={{ backgroundColor: "rgba(200, 143, 24, 0.15)", border: "1px solid rgba(200, 143, 24, 0.3)" }}>
              <span className="badge bg-warning text-dark fw-bold">DUYURU</span>
              <span className="text-truncate">
                Değerli müşterilerimiz; tüm sarrafiye ve ziynet alım-satım işlemleriniz anlık Kapalıçarşı canlı kurları üzerinden gerçekleştirilmektedir.
              </span>
            </div>
          </div>

          {/* Features Grid */}
          <div className="row g-4">
            {panoFeatures.map((f, i) => (
              <div key={i} className="col-12 col-md-6">
                <div className="p-4 rounded-4 bg-white border h-100 shadow-sm" style={{ borderColor: "#ede4d3" }}>
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div className="p-3 rounded-3" style={{ backgroundColor: "#faf5ea", border: "1px solid #ebdcc8" }}>
                      {f.icon}
                    </div>
                    <h4 className="fw-bold text-dark mb-0" style={{ fontSize: "1.2rem" }}>
                      {f.title}
                    </h4>
                  </div>
                  <p className="text-secondary small mb-0" style={{ lineHeight: "1.7" }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};
export default LandingPanoPage;

import React from "react";
import { useNavigate } from "react-router-dom";
import {
  IconBuildingStore,
  IconPhone,
  IconMail,
  IconMapPin,
  IconBrandWhatsapp,
  IconSparkles,
  IconHeadset,
  IconAward,
  IconShieldCheck,
} from "@tabler/icons-react";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";
import IletisimFormu from "./IletisimFormu";
import { ILETISIM, MAIL_LINK, TEL2_LINK, TEL_LINK } from "./iletisimBilgileri";

export const LandingAboutPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="w-100 min-vh-100 bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <LandingNavbar />

      {/* Header */}
      <section className="py-5 border-bottom" style={{ background: "linear-gradient(180deg, #faf6ef 0%, #ffffff 100%)" }}>
        <div className="container text-center py-3" style={{ maxWidth: "960px" }}>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill mb-3 bg-white border shadow-sm" style={{ borderColor: "#ebdcc8" }}>
            <IconSparkles size={16} className="text-warning" />
            <span className="small fw-bold text-uppercase" style={{ color: "#784405", fontSize: "0.78rem" }}>
              Kurumsal & İletişim
            </span>
          </div>

          <h1 className="fw-bolder display-5 text-dark mb-3">
            Sarrafiyelerin Güvenilir <span style={{ color: "#b8860b" }}>Teknoloji Ortağı</span>
          </h1>

          <p className="lead text-secondary mx-auto mb-0" style={{ maxWidth: "760px", fontSize: "1.08rem", lineHeight: "1.7" }}>
            Likya Kuyumculuk Yazılımları; Türkiye genelinde yüzlerce kuyumcu, sarraf ve döviz bürosunun finansal ve operasyonel kalbini yönetmektedir.
          </p>
        </div>
      </section>

      {/* About & Stats Section */}
      <section className="py-5 py-md-6 bg-white">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="row g-5 align-items-center mb-5">
            <div className="col-12 col-lg-6">
              <h6 className="fw-bold text-uppercase text-warning" style={{ fontSize: "0.82rem", letterSpacing: "1.5px" }}>
                HAKKIMIZDA
              </h6>
              <h2 className="fw-bolder text-dark mb-3">
                Kuyumculuk Sektörünün Dinamiklerine Hakim Uzman Mühendislik
              </h2>
              <p className="text-secondary" style={{ lineHeight: "1.8", fontSize: "1rem" }}>
                Kuyumculuk ve sarrafiye sektörü; standart perakende yazılımlarıyla yönetilemeyecek kadar hassas milyem hesapları, hurda takasları, emanet sarrafiyeler ve sıkı MASAK/maliye mevzuatları barındırır.
              </p>
              <p className="text-secondary" style={{ lineHeight: "1.8", fontSize: "1rem" }}>
                Likya Kuyum, Kapalıçarşı ve Kuyumcukent esnafının sahadaki gerçek ihtiyaçları dinlenerek sıfırdan geliştirilmiş, hatasız matematiksel motoruyla güven veren yeni nesil bir kurumsal ERP çözümüdür.
              </p>

              <div className="row g-3 pt-2">
                <div className="col-6">
                  <div className="p-3 rounded-3 border" style={{ backgroundColor: "#faf7f2", borderColor: "#ede4d3" }}>
                    <div className="fw-bolder fs-3" style={{ color: "#784405" }}>15+ Yıl</div>
                    <div className="text-secondary small fw-medium">Sektörel Tecrübe</div>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3 rounded-3 border" style={{ backgroundColor: "#faf7f2", borderColor: "#ede4d3" }}>
                    <div className="fw-bolder fs-3" style={{ color: "#784405" }}>%99.9</div>
                    <div className="text-secondary small fw-medium">Hizmet Sürekliliği</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Contact & Demo Request Form */}
            <div className="col-12 col-lg-6">
              <div
                className="p-4 p-md-5 rounded-4 bg-white border shadow-sm position-relative"
                style={{ borderColor: "#ede4d3", boxShadow: "0 15px 35px rgba(120, 68, 5, 0.08)" }}
              >
                <h3 className="fw-bolder text-dark mb-1">Demo & Bilgi Talebi</h3>
                <p className="text-secondary small mb-4">
                  Formu doldurun, uzman ekibimiz mağazanız için en uygun çözümü 15 dakika içinde sunsun.
                </p>

                <IletisimFormu kaynak="iletisim" renk="altin" dugmeYazisi="Ücretsiz Demo Talebi Gönder" />
              </div>
            </div>
          </div>

          {/* Contact Cards Grid */}
          <div className="row g-4 pt-4 border-top" style={{ borderColor: "#ede4d3" }}>
            <div className="col-12 col-md-4">
              <div className="p-4 rounded-4 bg-white border text-center h-100 shadow-sm" style={{ borderColor: "#ede4d3" }}>
                <div className="p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ backgroundColor: "#faf5ea" }}>
                  <IconPhone size={26} style={{ color: "#784405" }} />
                </div>
                <h5 className="fw-bold text-dark mb-1">Hemen Arayın</h5>
                <p className="text-secondary small mb-2">Satış & Destek Hattı</p>
                <a href={TEL_LINK} className="fw-bold fs-5 text-dark text-decoration-none d-block">{ILETISIM.telefon}</a>
                <a href={TEL2_LINK} className="fw-bold fs-6 text-secondary text-decoration-none d-block mt-1">{ILETISIM.telefon2}</a>
                <div className="small text-secondary mt-2">{ILETISIM.adres}</div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="p-4 rounded-4 bg-white border text-center h-100 shadow-sm" style={{ borderColor: "#ede4d3" }}>
                <div className="p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ backgroundColor: "#faf5ea" }}>
                  <IconBrandWhatsapp size={26} className="text-success" />
                </div>
                <h5 className="fw-bold text-dark mb-1">WhatsApp Destek</h5>
                <p className="text-secondary small mb-2">Anlık Canlı Destek & Fiyatlandırma</p>
                <a href={ILETISIM.whatsapp} target="_blank" rel="noopener noreferrer" className="fw-bold fs-5 text-success text-decoration-none">{ILETISIM.telefon}</a>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="p-4 rounded-4 bg-white border text-center h-100 shadow-sm" style={{ borderColor: "#ede4d3" }}>
                <div className="p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ backgroundColor: "#faf5ea" }}>
                  <IconMail size={26} style={{ color: "#784405" }} />
                </div>
                <h5 className="fw-bold text-dark mb-1">E-Posta İletişim</h5>
                <p className="text-secondary small mb-2">Kurumsal & Entegrasyon Talepleri</p>
                <a href={MAIL_LINK} className="fw-bold fs-6 text-dark text-decoration-none">{ILETISIM.eposta}</a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};
export default LandingAboutPage;

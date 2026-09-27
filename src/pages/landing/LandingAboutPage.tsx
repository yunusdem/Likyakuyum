import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconBuildingStore,
  IconPhone,
  IconMail,
  IconMapPin,
  IconBrandWhatsapp,
  IconSparkles,
  IconCheck,
  IconSend,
  IconHeadset,
  IconAward,
  IconShieldCheck,
} from "@tabler/icons-react";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";

export const LandingAboutPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    phone: "",
    city: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

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

                {submitted ? (
                  <div className="alert alert-success p-4 rounded-3 text-center">
                    <IconCheck size={40} className="text-success mb-2" />
                    <h5 className="fw-bold mb-1">Talebiniz Alındı!</h5>
                    <p className="small text-muted mb-0">
                      Müşteri temsilcimiz en kısa sürede sizinle iletişime geçecektir.
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
                    <div>
                      <label className="form-label small fw-bold text-secondary mb-1">Adınız Soyadınız *</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        placeholder="Örn: Ahmet Yılmaz"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        style={{ height: "44px", borderColor: "#e2e8f0" }}
                      />
                    </div>
                    <div>
                      <label className="form-label small fw-bold text-secondary mb-1">Kuyumcu / Firma Ünvanı *</label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        placeholder="Örn: Yılmaz Kuyumculuk & Sarrafiye"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        style={{ height: "44px", borderColor: "#e2e8f0" }}
                      />
                    </div>
                    <div className="row g-2">
                      <div className="col-6">
                        <label className="form-label small fw-bold text-secondary mb-1">Telefon Numarası *</label>
                        <input
                          type="tel"
                          required
                          className="form-control"
                          placeholder="05XX XXX XX XX"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          style={{ height: "44px", borderColor: "#e2e8f0" }}
                        />
                      </div>
                      <div className="col-6">
                        <label className="form-label small fw-bold text-secondary mb-1">Şehir</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="İstanbul"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          style={{ height: "44px", borderColor: "#e2e8f0" }}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label small fw-bold text-secondary mb-1">Notunuz / İhtiyaçlarınız</label>
                      <textarea
                        rows={3}
                        className="form-control"
                        placeholder="Kaç şube/vezne kullanmak istiyorsunuz? Terazi ve barkod yazıcı durumu..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        style={{ borderColor: "#e2e8f0" }}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn py-2.5 text-white fw-bold d-flex align-items-center justify-content-center gap-2 rounded-3 mt-2 shadow-sm"
                      style={{ background: "linear-gradient(135deg, #c88f18 0%, #9e640b 100%)", border: "none" }}
                    >
                      <IconSend size={18} />
                      <span>Ücretsiz Demo Talebi Gönder</span>
                    </button>
                  </form>
                )}
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
                <h5 className="fw-bold text-dark mb-1">Santral & Satış</h5>
                <p className="text-secondary small mb-2">Hafta içi 08:30 - 19:00</p>
                <div className="fw-bold fs-5 text-dark">+90 (850) 840 00 00</div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="p-4 rounded-4 bg-white border text-center h-100 shadow-sm" style={{ borderColor: "#ede4d3" }}>
                <div className="p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ backgroundColor: "#faf5ea" }}>
                  <IconBrandWhatsapp size={26} className="text-success" />
                </div>
                <h5 className="fw-bold text-dark mb-1">WhatsApp Destek</h5>
                <p className="text-secondary small mb-2">Anlık Canlı Destek & Fiyatlandırma</p>
                <div className="fw-bold fs-5 text-success">+90 (532) 000 00 00</div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="p-4 rounded-4 bg-white border text-center h-100 shadow-sm" style={{ borderColor: "#ede4d3" }}>
                <div className="p-3 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ backgroundColor: "#faf5ea" }}>
                  <IconMail size={26} style={{ color: "#784405" }} />
                </div>
                <h5 className="fw-bold text-dark mb-1">E-Posta İletişim</h5>
                <p className="text-secondary small mb-2">Kurumsal & Entegrasyon Talepleri</p>
                <div className="fw-bold fs-6 text-dark">bilgi@likyakuyum.com</div>
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

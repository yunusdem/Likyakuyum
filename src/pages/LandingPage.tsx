import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  IconArrowRight,
  IconReceipt,
  IconBarcode,
  IconDeviceTv,
  IconFileInvoice,
  IconCreditCard,
  IconUsers,
  IconShieldCheck,
  IconCheck,
  IconBuildingStore,
  IconScale,
  IconPhoneCall,
  IconStar,
  IconPrinter,
  IconCoins,
  IconChevronLeft,
  IconChevronRight,
  IconSend,
  IconBrandWhatsapp,
  IconMail,
  IconPhone,
  IconMapPin,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTwitter,
  IconBrandLinkedin,
  IconX,
  IconZoomIn,
  IconDownload,
} from "@tabler/icons-react";
import LandingNavbar from "./landing/LandingNavbar";
import IletisimFormu from "./landing/IletisimFormu";
import HeroCarousel from "./landing/HeroCarousel";
import { ILETISIM, MAIL_LINK, TEL2_LINK, TEL_LINK } from "./landing/iletisimBilgileri";
import "../styles/LandingFurni.css";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTestiIndex, setActiveTestiIndex] = useState(0);
  const [isBrosurModalOpen, setIsBrosurModalOpen] = useState(false);

  const testimonials = [
    {
      name: "Ahmet Yıldırım",
      role: "Mağaza Sahibi",
      store: "Yıldırım Mücevherat · Kapalıçarşı",
      comment:
        "Likya Kuyum'a geçtikten sonra vezne satış hızımız 3 katına çıktı. Hassas teraziden anında gram çekmesi ve F10 ile tek tuşla sessiz etiket basması sayesinde yoğun günlerde hata yapma riskimiz sıfıra indi.",
      avatar: "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=150&h=150&fit=crop&auto=format",
    },
    {
      name: "Mehmet Demir",
      role: "Genel Müdür",
      store: "Demir Sarrafiye & Döviz · Kuyumcukent",
      comment:
        "Cari has altın emanet takibi ve 3065 sayılı özel matrah KDV faturası bizim için en kritik konuydu. Likya sayesinde e-faturalarımız saniyeler içinde GİB portalında onaylanıyor.",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&auto=format",
    },
    {
      name: "Serkan Aktaş",
      role: "Şube Müdürü",
      store: "Aktaş Gold & Diamond · İzmir Kemeraltı",
      comment:
        "4K TV Canlı Vitrin Panosu mağazamıza inanılmaz prestij kattı. Müşteriler vitrindeki canlı Kapalıçarşı fiyatlarını izleyip güvenle alışveriş yapıyor, fiyatları kasadan değiştirdiğim an ekrana yansıyor.",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&auto=format",
    },
  ];

  const handlePrevTesti = () => {
    setActiveTestiIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNextTesti = () => {
    setActiveTestiIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="furni-wrapper">
      {/* ─── 1. NAVBAR (Single Horizontal Line) ─── */}
      <LandingNavbar />

      {/* ─── 2. FURNI HERO SECTION (Dark Green / Gold Accent) ─── */}
      <section className="furni-hero" id="home">
        <div className="container" style={{ maxWidth: "1360px" }}>
          <div className="row align-items-center justify-content-between g-5">
            {/* Left Hero Intro */}
            <div className="col-lg-5">
              <h1>
                Modern Kuyumculuk & <span className="d-block" style={{ color: "#f9bf29" }}>Sarrafiye ERP Sistemi</span>
              </h1>
              <p>
                Hızlı vezne satışı, 0.0001 Gr hassas terazi senkronizasyonu, termal kuyruk etiketleme, 
                4K canlı vitrin panosu ve 3065 KDV özel matrahlı resmi GİB E-Fatura süreçleri tek çatı altında.
              </p>
              <div className="d-flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="furni-btn-gold"
                >
                  <span>Hemen Başlayın</span>
                  <IconArrowRight size={17} />
                </button>
                <a href="#cozumler" className="furni-btn-outline">
                  <span>Çözümleri İnceleyin</span>
                </a>
                <a href={TEL_LINK} className="furni-btn-outline">
                  <IconPhoneCall size={17} />
                  <span>{ILETISIM.telefon}</span>
                </a>
              </div>
            </div>

            {/* Right Hero Showcase with Dynamic Rotating Carousel */}
            <div className="col-lg-7 position-relative">
              <HeroCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* ─── 3. 4-COLUMN PRODUCT SECTION ("Crafted with excellent material") ─── */}
      <section className="furni-section-pad bg-white" id="cozumler">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="row g-4 align-items-center">
            {/* Col 1: Section Title & Explore */}
            <div className="col-12 col-md-12 col-lg-3 mb-4 mb-lg-0">
              <h2 className="mb-3" style={{ fontSize: "2rem", lineHeight: "1.25" }}>
                Kusursuz Kuyumcu Altyapısı.
              </h2>
              <p className="mb-4 text-secondary" style={{ fontSize: "0.95rem" }}>
                Gram, milyem, has altın ve döviz dengesini anlık koruyan yüksek hassasiyetli ERP modülleri.
              </p>
              <a href="#avantajlar" className="furni-btn-dark">
                <span>Tümünü Keşfet</span>
                <IconArrowRight size={16} />
              </a>
            </div>

            {/* Col 2: Product 1 - Perakende Satış POS */}
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="furni-product-item">
                <div className="furni-product-thumbnail">
                  <img
                    src="/images/landing/vezne-pos-terazi.jpg"
                    alt="Perakende Satış Vezne POS - 0.0001 Gr Terazi Senkron"
                  />
                </div>
                <h3 className="furni-product-title">Perakende Vezne POS</h3>
                <strong className="furni-product-price">0.0001 Gr Terazi Senkron</strong>
              </div>
            </div>

            {/* Col 3: Product 2 - Zebra Termal Barkod */}
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="furni-product-item">
                <div className="furni-product-thumbnail">
                  <img
                    src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=500&h=400&fit=crop&auto=format"
                    alt="Zebra Termal Kuyruk Etiketi"
                    onError={(e) => {
                      e.currentTarget.src = "/images/hero/hero-4.jpeg";
                    }}
                  />
                </div>
                <h3 className="furni-product-title">Zebra Kuyruk Etiketi</h3>
                <strong className="furni-product-price">F10 Sessiz Baskı</strong>
              </div>
            </div>

            {/* Col 4: Product 3 - Canlı 4K TV Vitrin Panosu */}
            <div className="col-12 col-sm-6 col-lg-3">
              <div className="furni-product-item">
                <div className="furni-product-thumbnail">
                  <img
                    src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&h=400&fit=crop&auto=format"
                    alt="Canlı 4K TV Vitrin Panosu"
                    onError={(e) => {
                      e.currentTarget.src = "/images/hero/hero-2.jpeg";
                    }}
                  />
                </div>
                <h3 className="furni-product-title">4K TV Canlı Pano</h3>
                <strong className="furni-product-price">Kapalıçarşı 0 ms Veri</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 4. WHY CHOOSE US (2x2 Grid + Big Showroom Image) ─── */}
      <section className="furni-section-pad" id="neden-biz">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="row justify-content-between align-items-center g-5">
            {/* Left 2x2 Feature Grid */}
            <div className="col-lg-6">
              <h2 className="mb-3" style={{ fontSize: "2.2rem" }}>
                Neden Likya Kuyumculuk ERP?
              </h2>
              <p className="mb-4 text-secondary">
                Kuyumculuk sektörü sıradan bir muhasebe programıyla yönetilemez. Has altın, milyem, işçilik ve döviz dinamiklerini tek sistemde birleştiriyoruz.
              </p>

              <div className="row g-4 my-2">
                <div className="col-6 furni-feature-item">
                  <div className="furni-feature-icon-box">
                    <IconScale size={24} />
                  </div>
                  <h4 className="fw-bold fs-6 mb-2 text-dark">Hassas Terazi (RS232/USB)</h4>
                  <p className="small text-secondary mb-0">
                    Dikomsan, Desis ve Radwag terazilerinden 0.0001 Gr hassasiyetle anında tartım.
                  </p>
                </div>

                <div className="col-6 furni-feature-item">
                  <div className="furni-feature-icon-box">
                    <IconPrinter size={24} />
                  </div>
                  <h4 className="fw-bold fs-6 mb-2 text-dark">F10 Sessiz Hızlı Çıktı</h4>
                  <p className="small text-secondary mb-0">
                    Tarayıcı önizleme penceresi açılmadan doğrudan varsayılan yazıcıdan fiş basımı.
                  </p>
                </div>

                <div className="col-6 furni-feature-item">
                  <div className="furni-feature-icon-box">
                    <IconFileInvoice size={24} />
                  </div>
                  <h4 className="fw-bold fs-6 mb-2 text-dark">3065 Özel Matrah KDV</h4>
                  <p className="small text-secondary mb-0">
                    Altının has bedeli vergiden muaf, yalnızca işçilik tutarı üzerinden yasal KDV.
                  </p>
                </div>

                <div className="col-6 furni-feature-item">
                  <div className="furni-feature-icon-box">
                    <IconShieldCheck size={24} />
                  </div>
                  <h4 className="fw-bold fs-6 mb-2 text-dark">MASAK & Hibrit SQL</h4>
                  <p className="small text-secondary mb-0">
                    İnternet kesilse dahi yerel SQL ile kesintisiz satış ve güvenli kimlik denetimi.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Image with Yellow Dot Matrix */}
            <div className="col-lg-5 position-relative">
              <div className="furni-dots-pattern"></div>
              <div className="rounded-4 overflow-hidden shadow-lg border">
                <img
                  src="https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=700&h=700&fit=crop&auto=format"
                  alt="Kuyumcu Vitrini ve Mücevherat"
                  className="img-fluid w-100"
                  onError={(e) => {
                    e.currentTarget.src = "/images/hero/hero-1.jpeg";
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 5. WE HELP YOU SECTION (3-Image Artistic Collage) ─── */}
      <section className="furni-section-pad bg-white" id="avantajlar">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="row justify-content-between align-items-center g-5">
            {/* Left 3-Image Collage with Green Dot Matrix */}
            <div className="col-lg-7 position-relative">
              <div className="furni-dots-pattern-green"></div>
              <div className="furni-imgs-grid">
                <div className="furni-grid-1">
                  <img
                    src="https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=600&h=600&fit=crop&auto=format"
                    alt="Altın Atölyesi ve Tasarım"
                    onError={(e) => {
                      e.currentTarget.src = "/images/hero/hero-5.jpeg";
                    }}
                  />
                </div>
                <div className="furni-grid-2">
                  <img
                    src="https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400&h=300&fit=crop&auto=format"
                    alt="Külçe Altın ve Has Kasa"
                    onError={(e) => {
                      e.currentTarget.src = "/images/hero/hero-7.jpeg";
                    }}
                  />
                </div>
                <div className="furni-grid-3">
                  <img
                    src="/images/landing/kdv-3065-ozel-matrah.jpg"
                    alt="GİB E-Fatura ve Muhasebe"
                  />
                </div>
              </div>
            </div>

            {/* Right Detailed Copy */}
            <div className="col-lg-5">
              <h2 className="mb-3" style={{ fontSize: "2.1rem" }}>
                Modern Kuyumculukta Hız, Güven ve Sıfır Fire.
              </h2>
              <p className="mb-4 text-secondary">
                Vezne kasasından müşteri emanetlerine, canlı vitrin TV ekranından GİB resmi faturalarına kadar mağazanızın tüm operasyonlarını tek ekrandan yönetin.
              </p>

              <ul className="list-unstyled d-flex flex-column gap-2.5 mb-4 text-dark small fw-medium">
                <li className="d-flex align-items-center gap-2">
                  <IconCheck size={18} style={{ color: "#3b5d50" }} />
                  <span>Hassas Tartım & Terazi Senkronizasyonu (RS232/USB)</span>
                </li>
                <li className="d-flex align-items-center gap-2">
                  <IconCheck size={18} style={{ color: "#3b5d50" }} />
                  <span>Çoklu Para (TL, USD, EUR) & Has Altın Emanet Kasası</span>
                </li>
                <li className="d-flex align-items-center gap-2">
                  <IconCheck size={18} style={{ color: "#3b5d50" }} />
                  <span>GİB E-Fatura, E-Arşiv & WhatsApp Tek Tık Fatura İletimi</span>
                </li>
                <li className="d-flex align-items-center gap-2">
                  <IconCheck size={18} style={{ color: "#3b5d50" }} />
                  <span>WhatsApp & SMS Üzerinden 3D Secure Güvenli Tahsilat</span>
                </li>
              </ul>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="furni-btn-dark"
              >
                <span>Sistemi Keşfedin</span>
                <IconArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. 3 MINI HORIZONTAL CARDS ROW (Furni Sub-Feature Row) ─── */}
      <section className="py-5 bg-white border-bottom">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="row g-4">
            <div className="col-12 col-md-4">
              <div className="d-flex align-items-center gap-3 p-3 rounded-4 bg-light border">
                <img
                  src="https://images.unsplash.com/photo-1610375461246-83df859d849d?w=100&h=100&fit=crop&auto=format"
                  alt="Cari & Has Emanet"
                  style={{ width: "70px", height: "70px", borderRadius: "12px", objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.src = "/images/hero/hero-7.jpeg";
                  }}
                />
                <div>
                  <h5 className="fw-bold mb-1 text-dark" style={{ fontSize: "1rem" }}>Cari & Has Emanet</h5>
                  <p className="small text-secondary mb-1">Müşteri emanetlerini gram bazında anlık takip edin.</p>
                  <a href="#cozumler" className="small fw-bold text-dark text-decoration-none" style={{ color: "#3b5d50" }}>İncele →</a>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="d-flex align-items-center gap-3 p-3 rounded-4 bg-light border">
                <img
                  src="https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=100&h=100&fit=crop&auto=format"
                  alt="E-Banka & Sanal POS"
                  style={{ width: "70px", height: "70px", borderRadius: "12px", objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.src = "/images/hero/hero-9.jpeg";
                  }}
                />
                <div>
                  <h5 className="fw-bold mb-1 text-dark" style={{ fontSize: "1rem" }}>E-Banka & 3D Tahsilat</h5>
                  <p className="small text-secondary mb-1">WhatsApp ile ödeme linki ve otomatik mutabakat.</p>
                  <a href="#cozumler" className="small fw-bold text-dark text-decoration-none" style={{ color: "#3b5d50" }}>İncele →</a>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="d-flex align-items-center gap-3 p-3 rounded-4 bg-light border">
                <img
                  src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=100&h=100&fit=crop&auto=format"
                  alt="Çoklu Kasa & Şube"
                  style={{ width: "70px", height: "70px", borderRadius: "12px", objectFit: "cover" }}
                  onError={(e) => {
                    e.currentTarget.src = "/images/hero/hero-3.jpeg";
                  }}
                />
                <div>
                  <h5 className="fw-bold mb-1 text-dark" style={{ fontSize: "1rem" }}>Çoklu Kasa & Şube</h5>
                  <p className="small text-secondary mb-1">Tüm şubelerinizin kasa hareketlerini tek merkezden izleyin.</p>
                  <a href="#cozumler" className="small fw-bold text-dark text-decoration-none" style={{ color: "#3b5d50" }}>İncele →</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── KAMPANYA & PAKETLER BÖLÜMÜ (Resmi Broşür & Paket Karşılaştırması) ─── */}
      <section className="furni-section-pad" id="kampanya" style={{ background: "linear-gradient(180deg, #f8fbf9 0%, #edf4f0 100%)" }}>
        <div className="container" style={{ maxWidth: "1280px" }}>
          {/* Bölüm Başlığı */}
          <div className="text-center mb-5">
            <span
              className="badge px-3 py-2 fw-bold text-uppercase rounded-pill mb-3 shadow-xs"
              style={{
                backgroundColor: "#f9bf29",
                color: "#2c4c41",
                fontSize: "0.85rem",
                letterSpacing: "1px",
              }}
            >
              🔥 Sınırlı Süreli Kampanya
            </span>
            <h2 className="fw-bold mb-3" style={{ fontSize: "2.3rem", color: "#2f2f2f" }}>
              İşinizi Büyütmenin En Akıllı Bulut Yolu
            </h2>
            <p className="text-secondary mx-auto mb-0" style={{ maxWidth: "780px", fontSize: "1.05rem" }}>
              Likya ERP ile satıştan stok yönetimine, karar almaktan raporlamaya kadar tüm süreçler tek ekranda.
              Kuyumculara özel avantajlı kampanya fiyatları ve paket karşılaştırması aşağıda yer almaktadır.
            </p>
          </div>

          {/* Kampanya Broşürü Vitrin Kartı */}
          <div className="card border-0 shadow-lg rounded-4 overflow-hidden mb-5 bg-white">
            <div className="position-relative">
              <img
                src="/images/kampanya/likya-erp-kampanya-brosur.jpg"
                alt="Likya ERP Sınırlı Süreli Kampanya ve Paket Karşılaştırması Broşürü"
                className="img-fluid w-100"
                style={{
                  cursor: "zoom-in",
                  display: "block",
                  maxHeight: "750px",
                  objectFit: "contain",
                  backgroundColor: "#0d1b2a",
                }}
                onClick={() => setIsBrosurModalOpen(true)}
              />
              <div
                className="p-3 p-md-4 d-flex flex-wrap align-items-center justify-content-between gap-3 text-white"
                style={{
                  background: "linear-gradient(180deg, #132435 0%, #0d1b2a 100%)",
                }}
              >
                <div>
                  <div className="fw-bold fs-5 text-warning mb-1 d-flex align-items-center gap-2">
                    <span>Likya ERP Resmi Kampanya & Modül Broşürü</span>
                    <span className="badge bg-warning text-dark px-2 py-0.5 rounded-pill" style={{ fontSize: "11px" }}>
                      2026 Güncel
                    </span>
                  </div>
                  <div className="small text-light opacity-75">
                    Detaylı incelemek ve tam boyutta görüntülemek için görsele veya "Büyüt" butonuna tıklayabilirsiniz.
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsBrosurModalOpen(true)}
                    className="btn btn-warning fw-bold px-3 py-2 rounded-pill shadow-sm d-flex align-items-center gap-1.5"
                    style={{ fontSize: "0.9rem" }}
                  >
                    <IconZoomIn size={18} />
                    Broşürü Büyüt
                  </button>
                  <a
                    href="https://wa.me/905326732622?text=Merhaba,%20Likya%20ERP%20kampanya%20paketleri%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-success fw-bold px-3 py-2 rounded-pill shadow-sm d-flex align-items-center gap-1.5"
                    style={{ backgroundColor: "#25D366", borderColor: "#25D366", fontSize: "0.9rem" }}
                  >
                    <IconBrandWhatsapp size={18} />
                    WhatsApp: 0532 673 26 22
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Hızlı Paket Kartları (Broşürle Birebir Uyumlu) */}
          <div className="row g-4 justify-content-center">
            {/* Kuyum Paketi */}
            <div className="col-12 col-md-6 col-lg-5">
              <div
                className="h-100 p-4 p-lg-5 rounded-4 bg-white shadow-sm border position-relative d-flex flex-column justify-content-between"
                style={{ borderColor: "#e2e8f0" }}
              >
                <div>
                  <div className="small fw-bold text-uppercase text-muted mb-1" style={{ letterSpacing: "1px" }}>
                    LİKYA ERP
                  </div>
                  <h3 className="fw-bold fs-4 text-dark mb-2">Kuyum Paketi</h3>
                  <div className="d-flex align-items-baseline gap-2 mb-3">
                    <span className="text-muted text-decoration-line-through fs-5">$3.500</span>
                    <span className="fw-bolder" style={{ fontSize: "2.4rem", color: "#3b5d50" }}>
                      $2.480
                    </span>
                    <span className="text-secondary small fw-semibold">+ KDV</span>
                  </div>
                  <div className="badge bg-light text-secondary border px-3 py-2 rounded-pill mb-4" style={{ fontSize: "0.82rem" }}>
                    RFID ve e-Banka hariç tüm temel modüller
                  </div>

                  <ul className="list-unstyled d-flex flex-column gap-2 mb-4" style={{ fontSize: "0.93rem" }}>
                    {[
                      "Kuyumculuk ve Hızlı Satış İşlemleri",
                      "Stok ve Vitrin Yönetimi",
                      "Cari, Kasa ve Raporlama",
                      "Hassas Terazi ve Barkod Entegrasyonu",
                      "e-Fatura, e-Arşiv ve e-Gider Pusulası",
                      "MASAK Müşteri ve Kimlik İşlemleri",
                      "Çoklu Şube Yönetimi",
                    ].map((feature, i) => (
                      <li key={i} className="d-flex align-items-center gap-2 text-dark">
                        <IconCheck size={18} className="text-success flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="https://wa.me/905326732622?text=Merhaba,%20Kuyum%20Paketi%20($2.480)%20i%C3%A7in%20bilgi%20ve%20kurulum%20teklifi%20almak%20istiyorum."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-outline-dark fw-bold w-100 py-2.5 rounded-pill d-flex align-items-center justify-content-center gap-2"
                >
                  <span>Bu Paketi Seç</span>
                  <IconArrowRight size={16} />
                </a>
              </div>
            </div>

            {/* Kuyum Pro Paketi (En Kapsamlı) */}
            <div className="col-12 col-md-6 col-lg-5">
              <div
                className="h-100 p-4 p-lg-5 rounded-4 bg-white shadow border border-2 position-relative d-flex flex-column justify-content-between"
                style={{ borderColor: "#f9bf29" }}
              >
                <div
                  className="position-absolute top-0 end-0 translate-middle-y me-4 badge px-3 py-1.5 fw-bold rounded-pill shadow-xs"
                  style={{ backgroundColor: "#f9bf29", color: "#2c4c41", fontSize: "0.82rem" }}
                >
                  EN KAPSAMLI ÇÖZÜM
                </div>

                <div>
                  <div className="small fw-bold text-uppercase text-muted mb-1" style={{ letterSpacing: "1px" }}>
                    LİKYA ERP
                  </div>
                  <h3 className="fw-bold fs-4 text-dark mb-2">Kuyum Pro Paketi</h3>
                  <div className="d-flex align-items-baseline gap-2 mb-3">
                    <span className="text-muted text-decoration-line-through fs-5">$6.000</span>
                    <span className="fw-bolder" style={{ fontSize: "2.4rem", color: "#c88f18" }}>
                      $3.980
                    </span>
                    <span className="text-secondary small fw-semibold">+ KDV</span>
                  </div>
                  <div className="badge bg-warning bg-opacity-20 text-dark border border-warning px-3 py-2 rounded-pill mb-4" style={{ fontSize: "0.82rem" }}>
                    🌟 Tüm özellikler & modüller sınırsız açık
                  </div>

                  <ul className="list-unstyled d-flex flex-column gap-2 mb-4" style={{ fontSize: "0.93rem" }}>
                    {[
                      "Kuyumculuk ve Hızlı Satış İşlemleri",
                      "Stok ve Vitrin Yönetimi",
                      "Cari, Kasa ve Raporlama",
                      "Hassas Terazi ve Barkod Entegrasyonu",
                      "e-Fatura, e-Arşiv ve e-Gider Pusulası",
                      "MASAK Müşteri ve Kimlik İşlemleri",
                      "Çoklu Şube Yönetimi",
                      "⚡ RFID Stok Sayım Sistemi (Saniyeler içinde toplu sayım)",
                      "💳 e-Banka & Sanal POS Entegrasyonu",
                    ].map((feature, i) => (
                      <li key={i} className="d-flex align-items-center gap-2 text-dark fw-semibold">
                        <IconCheck size={18} className="text-warning flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href="https://wa.me/905326732622?text=Merhaba,%20Kuyum%20Pro%20Paketi%20($3.980)%20i%C3%A7in%20bilgi%20ve%20kurulum%20teklifi%20almak%20istiyorum."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="furni-btn-gold w-100 py-2.5 text-center text-decoration-none d-flex align-items-center justify-content-center gap-2"
                >
                  <span>Pro Paketi Seç</span>
                  <IconArrowRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. TESTIMONIALS SECTION (Furni Slider Centered Quote) ─── */}
      <section className="furni-section-pad" id="yorumlar">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="text-center mb-5">
            <h2 style={{ fontSize: "2.2rem" }}>Kullanıcı Yorumları</h2>
          </div>

          <div className="position-relative">
            {/* Slider Navigation Buttons */}
            <div className="d-flex align-items-center justify-content-between position-absolute top-50 start-0 end-0 translate-middle-y px-2 z-2 d-none d-md-flex">
              <button
                type="button"
                onClick={handlePrevTesti}
                className="furni-slider-btn"
                aria-label="Önceki Yorum"
              >
                <IconChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={handleNextTesti}
                className="furni-slider-btn"
                aria-label="Sonraki Yorum"
              >
                <IconChevronRight size={22} />
              </button>
            </div>

            {/* Testimonial Quote Box */}
            <div className="furni-testi-box">
              <p className="furni-testi-quote">
                "{testimonials[activeTestiIndex].comment}"
              </p>
              <img
                src={testimonials[activeTestiIndex].avatar}
                alt={testimonials[activeTestiIndex].name}
                className="furni-testi-avatar"
              />
              <div className="fw-bold text-dark fs-6">
                {testimonials[activeTestiIndex].name}
              </div>
              <div className="small text-secondary">
                {testimonials[activeTestiIndex].role}, {testimonials[activeTestiIndex].store}
              </div>

              {/* Mobile Indicator Dots */}
              <div className="d-flex justify-content-center gap-2 mt-4 d-md-none">
                {testimonials.map((_, i) => (
                  <span
                    key={i}
                    onClick={() => setActiveTestiIndex(i)}
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: i === activeTestiIndex ? "#3b5d50" : "#d1d5db",
                      cursor: "pointer",
                    }}
                  ></span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 8. RECENT BLOG & GUIDES (3 Cards in a Row) ─── */}
      <section className="furni-section-pad bg-white" id="rehber">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="d-flex justify-content-between align-items-center mb-5">
            <h2 style={{ fontSize: "2.1rem" }}>Kuyumculuk Rehberi & Mevzuat</h2>
            <a href="#cozumler" className="fw-bold text-decoration-none" style={{ color: "#3b5d50" }}>
              Tüm Yazılar →
            </a>
          </div>

          <div className="row g-4">
            <div className="col-12 col-md-4">
              <div className="furni-blog-card">
                <div className="furni-blog-img">
                  <img
                    src="/images/landing/kdv-3065-ozel-matrah.jpg"
                    alt="3065 Sayılı KDV Özel Matrahı ve Altın Muhasebesi"
                  />
                </div>
                <div className="p-4">
                  <h4 className="fw-bold fs-6 mb-2 text-dark">
                    3065 Sayılı KDV Özel Matrahı Kuyumculukta Nasıl Hesaplanır?
                  </h4>
                  <p className="small text-secondary mb-3">
                    Altının has bedeli KDV istisnası ve sadece işçilik bedeli üzerinden faturalandırma rehberi.
                  </p>
                  <div className="small text-muted">Mevzuat Rehberi · 2026</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="furni-blog-card">
                <div className="furni-blog-img">
                  <img
                    src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&h=400&fit=crop&auto=format"
                    alt="Kuyruk Etiketleme Standartları"
                    onError={(e) => {
                      e.currentTarget.src = "/images/hero/hero-11.jpeg";
                    }}
                  />
                </div>
                <div className="p-4">
                  <h4 className="fw-bold fs-6 mb-2 text-dark">
                    Dayanıklı Termal Kuyruk Etiketleme ve Barkod Okuyucu Seçimi
                  </h4>
                  <p className="small text-secondary mb-3">
                    Zebra, Argox ve TSC yazıcılarla kuyumcu yüzük ve bilezik etiketlerinde sıfır hata.
                  </p>
                  <div className="small text-muted">Donanım Rehberi · 2026</div>
                </div>
              </div>
            </div>

            <div className="col-12 col-md-4">
              <div className="furni-blog-card">
                <div className="furni-blog-img">
                  <img
                    src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&h=400&fit=crop&auto=format"
                    alt="4K TV Vitrin Panosu"
                    onError={(e) => {
                      e.currentTarget.src = "/images/hero/hero-13.jpeg";
                    }}
                  />
                </div>
                <div className="p-4">
                  <h4 className="fw-bold fs-6 mb-2 text-dark">
                    Vitrin 4K TV Panosu ile Müşteri Güveni ve Satış Artışı
                  </h4>
                  <p className="small text-secondary mb-3">
                    Kapalıçarşı canlı has altın ve döviz fiyatlarını şık bir arayüzle müşterilerinize sunun.
                  </p>
                  <div className="small text-muted">Pazarlama Rehberi · 2026</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 9. İLETİŞİM: Ara / WhatsApp / E-posta + Ön Bilgi Formu ─── */}
      <section className="furni-section-pad position-relative z-2" id="iletisim" style={{ background: "#f8f9fa" }}>
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="row g-4 g-lg-5 align-items-start">
            {/* Sol: başlık + iletişim kanalları */}
            <div className="col-12 col-lg-5">
              <h2 className="mb-3" style={{ fontSize: "2.2rem" }}>
                Bize Ulaşın, Size Özel Teklif Alın
              </h2>
              <p className="text-secondary mb-4">
                Mağazanız için en uygun kurulumu birlikte planlayalım. Hemen arayın, WhatsApp'tan yazın ya da formu doldurun;
                en kısa sürede sizi arayalım.
              </p>

              <div className="d-flex flex-column gap-3">
                <a href={TEL_LINK} className="furni-contact-card text-decoration-none">
                  <div className="furni-contact-icon" style={{ background: "#3b5d50" }}>
                    <IconPhoneCall size={24} color="#ffffff" />
                  </div>
                  <div>
                    <div className="small text-secondary">Hemen Arayın</div>
                    <div className="fw-bold fs-5 text-dark">{ILETISIM.telefon}</div>
                  </div>
                </a>
                <a href={TEL2_LINK} className="furni-contact-card text-decoration-none">
                  <div className="furni-contact-icon" style={{ background: "#3b5d50" }}>
                    <IconPhone size={24} color="#ffffff" />
                  </div>
                  <div>
                    <div className="small text-secondary">Sabit Hat</div>
                    <div className="fw-bold fs-5 text-dark">{ILETISIM.telefon2}</div>
                  </div>
                </a>
                <a href={ILETISIM.whatsapp} target="_blank" rel="noopener noreferrer" className="furni-contact-card text-decoration-none">
                  <div className="furni-contact-icon" style={{ background: "#25d366" }}>
                    <IconBrandWhatsapp size={24} color="#ffffff" />
                  </div>
                  <div>
                    <div className="small text-secondary">WhatsApp'tan Yazın</div>
                    <div className="fw-bold fs-5 text-dark">{ILETISIM.telefon}</div>
                  </div>
                </a>
                <a href={MAIL_LINK} className="furni-contact-card text-decoration-none">
                  <div className="furni-contact-icon" style={{ background: "#f9bf29" }}>
                    <IconMail size={24} color="#2f2f2f" />
                  </div>
                  <div>
                    <div className="small text-secondary">E-posta Gönderin</div>
                    <div className="fw-bold fs-5 text-dark">{ILETISIM.eposta}</div>
                  </div>
                </a>
              </div>
            </div>

            {/* Sağ: ön bilgi formu */}
            <div className="col-12 col-lg-7">
              <div className="furni-newsletter-box" style={{ marginBottom: 0 }}>
                <div className="d-flex align-items-center gap-2 mb-1 text-dark">
                  <IconSend size={22} style={{ color: "#3b5d50" }} />
                  <h3 className="fw-bold mb-0" style={{ fontSize: "1.35rem" }}>Ön Bilgi & Demo Talebi</h3>
                </div>
                <p className="text-secondary small mb-4">
                  Formu doldurun, ekibimiz sizi arayıp mağazanıza uygun çözümü anlatsın.
                </p>
                <IletisimFormu kaynak="ana-sayfa" renk="yesil" dugmeYazisi="Bilgi Talebi Gönder" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sabit Ara / WhatsApp düğmeleri (mobilde tek dokunuşla) */}
      <div className="furni-float-contact">
        <a href={ILETISIM.whatsapp} target="_blank" rel="noopener noreferrer" className="furni-float-btn" style={{ background: "#25d366" }} aria-label="WhatsApp'tan yazın" title="WhatsApp'tan yazın">
          <IconBrandWhatsapp size={26} color="#ffffff" />
        </a>
        <a href={TEL_LINK} className="furni-float-btn" style={{ background: "#3b5d50" }} aria-label={`Ara: ${ILETISIM.telefon}`} title={`Ara: ${ILETISIM.telefon}`}>
          <IconPhoneCall size={24} color="#ffffff" />
        </a>
      </div>

      {/* ─── 10. FURNI FOOTER ─── */}
      <footer className="furni-footer">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="row g-5 mb-5">
            {/* Brand Col */}
            <div className="col-12 col-lg-4">
              <div className="d-flex align-items-center gap-2 mb-3">
                <img
                  src="/images/logo/logo.svg"
                  alt="Likya Kuyum Logo"
                  style={{ width: "36px", height: "36px", objectFit: "contain" }}
                />
                <div className="d-flex align-items-center gap-1 lh-1">
                  <span className="brand-text-likya" style={{ fontSize: "1.6rem" }}>Likya</span>
                  <span className="brand-text-kuyum" style={{ fontSize: "1.6rem" }}>Kuyum</span>
                  <span style={{ color: "#f9bf29", fontSize: "1.7rem", lineHeight: "0" }}>.</span>
                </div>
              </div>

              <p className="text-secondary small mb-4" style={{ lineHeight: "1.75" }}>
                Kuyumcular, sarraflar, atölyeler ve döviz büroları için yeni nesil hibrit SQL, hassas terazi ve e-belge entegrasyonlu kurumsal kaynak planlama sistemi.
              </p>

              <div className="d-flex flex-column gap-2 small mb-4">
                <a href={TEL_LINK} className="furni-footer-link d-flex align-items-center gap-2">
                  <IconPhone size={16} style={{ color: "#f9bf29" }} />
                  <span>{ILETISIM.telefon}</span>
                </a>
                <a href={TEL2_LINK} className="furni-footer-link d-flex align-items-center gap-2">
                  <IconPhone size={16} style={{ color: "#f9bf29" }} />
                  <span>{ILETISIM.telefon2}</span>
                </a>
                <a href={ILETISIM.whatsapp} target="_blank" rel="noopener noreferrer" className="furni-footer-link d-flex align-items-center gap-2">
                  <IconBrandWhatsapp size={16} style={{ color: "#25d366" }} />
                  <span>WhatsApp: {ILETISIM.telefon}</span>
                </a>
                <a href={MAIL_LINK} className="furni-footer-link d-flex align-items-center gap-2">
                  <IconMail size={16} style={{ color: "#f9bf29" }} />
                  <span>{ILETISIM.eposta}</span>
                </a>
                <div className="furni-footer-link d-flex align-items-center gap-2">
                  <IconMapPin size={16} style={{ color: "#f9bf29" }} />
                  <span>{ILETISIM.adres}</span>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <a href={ILETISIM.instagram} target="_blank" rel="noopener noreferrer" className="furni-social-circle" aria-label="Instagram"><IconBrandInstagram size={18} /></a>
                <a href="#" className="furni-social-circle"><IconBrandFacebook size={18} /></a>
                <a href="#" className="furni-social-circle"><IconBrandTwitter size={18} /></a>
                <a href="#" className="furni-social-circle"><IconBrandLinkedin size={18} /></a>
              </div>
            </div>

            {/* Quick Links 1 */}
            <div className="col-6 col-md-3 col-lg-2">
              <h5 className="furni-footer-title" style={{ fontSize: "1.05rem" }}>Modüller</h5>
              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                <li><a href="#cozumler" className="furni-footer-link">Perakende Vezne POS</a></li>
                <li><a href="#cozumler" className="furni-footer-link">Termal Kuyruk Etiketi</a></li>
                <li><Link to="/canli-pano" className="furni-footer-link">Canlı 4K TV Panosu</Link></li>
                <li><a href="#cozumler" className="furni-footer-link">GİB E-Fatura</a></li>
              </ul>
            </div>

            {/* Quick Links 2 */}
            <div className="col-6 col-md-3 col-lg-2">
              <h5 className="furni-footer-title" style={{ fontSize: "1.05rem" }}>Donanım</h5>
              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                <li><a href="#neden-biz" className="furni-footer-link">Hassas Terazi (RS232)</a></li>
                <li><a href="#neden-biz" className="furni-footer-link">Zebra Barkod Yazıcı</a></li>
                <li><a href="#neden-biz" className="furni-footer-link">F10 Sessiz Çıktı</a></li>
                <li><a href="#neden-biz" className="furni-footer-link">Yerel SQL Server</a></li>
              </ul>
            </div>

            {/* Quick Links 3 */}
            <div className="col-6 col-md-3 col-lg-2">
              <h5 className="furni-footer-title" style={{ fontSize: "1.05rem" }}>Kurumsal</h5>
              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                <li><a href="#neden-biz" className="furni-footer-link">Hakkımızda</a></li>
                <li><a href="#rehber" className="furni-footer-link">Kuyumcu Rehberi</a></li>
                <li><a href="#yorumlar" className="furni-footer-link">Referanslar</a></li>
                <li><a href="#iletisim" className="furni-footer-link">İletişim & Destek</a></li>
              </ul>
            </div>

            {/* Quick Links 4 */}
            <div className="col-6 col-md-3 col-lg-2">
              <h5 className="furni-footer-title" style={{ fontSize: "1.05rem" }}>Mevzuat</h5>
              <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                <li><span className="furni-footer-link">3065 Özel Matrah KDV</span></li>
                <li><span className="furni-footer-link">MASAK Denetimi</span></li>
                <li><span className="furni-footer-link">KVKK Uyumlu</span></li>
                <li><span className="furni-footer-link">GİB E-Arşiv</span></li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-top d-flex flex-column flex-md-row align-items-center justify-content-between gap-3 small text-secondary">
            <div>
              Copyright &copy; {new Date().getFullYear()} Likya Kuyumculuk ERP Sistemleri. Tüm hakları saklıdır.
            </div>
            <div className="d-flex gap-4">
              <Link to="/guvenlik" className="text-secondary text-decoration-none">Gizlilik Politikası</Link>
              <Link to="/guvenlik" className="text-secondary text-decoration-none">Kullanım Koşulları</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── KAMPANYA BROŞÜRÜ LIGHTBOX / BÜYÜK MODAL ─── */}
      {isBrosurModalOpen && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3 p-md-4"
          style={{
            backgroundColor: "rgba(10, 20, 30, 0.94)",
            zIndex: 9999,
            backdropFilter: "blur(8px)",
          }}
          onClick={() => setIsBrosurModalOpen(false)}
        >
          <div
            className="position-relative d-flex flex-column align-items-center"
            style={{ maxWidth: "1240px", width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Kapat Butonu */}
            <button
              type="button"
              onClick={() => setIsBrosurModalOpen(false)}
              className="btn btn-light position-absolute top-0 end-0 m-2 rounded-circle d-flex align-items-center justify-content-center p-0 shadow-lg"
              style={{ width: "42px", height: "42px", zIndex: 10 }}
              aria-label="Kapat"
            >
              <IconX size={22} />
            </button>

            {/* Broşür Görseli */}
            <div className="rounded-4 overflow-hidden shadow-2xl border border-secondary border-opacity-25 bg-dark">
              <img
                src="/images/kampanya/likya-erp-kampanya-brosur.jpg"
                alt="Likya ERP Resmi Kampanya Broşürü"
                className="img-fluid"
                style={{ maxHeight: "82vh", objectFit: "contain", width: "100%" }}
              />
            </div>

            {/* Alt İşlem Butonları */}
            <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 mt-3">
              <a
                href="/images/kampanya/likya-erp-kampanya-brosur.jpg"
                download="Likya-ERP-Kampanya-Brosuru.jpg"
                className="btn btn-outline-light rounded-pill px-4 py-2 small fw-bold d-flex align-items-center gap-2"
              >
                <IconDownload size={16} />
                Broşürü Cihazınıza İndirin
              </a>
              <a
                href="https://wa.me/905326732622?text=Merhaba,%20Likya%20ERP%20kampanya%20bro%C5%9F%C3%BCr%C3%BCndeki%20paketler%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum."
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-success rounded-pill px-4 py-2 small fw-bold d-flex align-items-center gap-2"
                style={{ backgroundColor: "#25D366", borderColor: "#25D366" }}
              >
                <IconBrandWhatsapp size={18} />
                WhatsApp: 0532 673 26 22
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;

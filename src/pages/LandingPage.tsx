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
} from "@tabler/icons-react";
import LandingNavbar from "./landing/LandingNavbar";
import "../styles/LandingFurni.css";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [activeTestiIndex, setActiveTestiIndex] = useState(0);

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
        <div className="container" style={{ maxWidth: "1280px" }}>
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
              </div>
            </div>

            {/* Right Hero Showcase with Dot Matrix */}
            <div className="col-lg-7 position-relative">
              <div className="furni-hero-img-box">
                <div className="furni-dots-pattern"></div>
                <img
                  src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=900&h=600&fit=crop&auto=format"
                  alt="Kuyumculuk ve Mücevherat ERP"
                />
              </div>
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
                    src="https://images.unsplash.com/photo-1556742049-0a67e5572263?w=500&h=400&fit=crop&auto=format"
                    alt="Perakende Satış Vezne POS"
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
                  />
                </div>
                <div className="furni-grid-2">
                  <img
                    src="https://images.unsplash.com/photo-1610375461246-83df859d849d?w=400&h=300&fit=crop&auto=format"
                    alt="Külçe Altın ve Has Kasa"
                  />
                </div>
                <div className="furni-grid-3">
                  <img
                    src="https://images.unsplash.com/photo-1450133064473-71024230f91b?w=450&h=400&fit=crop&auto=format"
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
                  src="https://images.unsplash.com/photo-1556742049-0a67e5572263?w=100&h=100&fit=crop&auto=format"
                  alt="Çoklu Kasa & Şube"
                  style={{ width: "70px", height: "70px", borderRadius: "12px", objectFit: "cover" }}
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
                    src="https://images.unsplash.com/photo-1450133064473-71024230f91b?w=600&h=400&fit=crop&auto=format"
                    alt="3065 Sayılı KDV Özel Matrahı"
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

      {/* ─── 9. NEWSLETTER & CTA (Floating Box with Gold Accent) ─── */}
      <section className="position-relative z-2" id="iletisim">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="furni-newsletter-box">
            <div className="row align-items-center g-4">
              <div className="col-12 col-lg-6">
                <div className="d-flex align-items-center gap-2 mb-2 text-dark">
                  <IconMail size={24} style={{ color: "#3b5d50" }} />
                  <h3 className="fw-bold mb-0" style={{ fontSize: "1.45rem" }}>
                    Bültenimize Abone Olun & Demo İsteyin
                  </h3>
                </div>
                <p className="text-secondary small mb-0">
                  Kuyumculuk mevzuatları, altın kurları ve sistem güncellemelerinden ilk siz haberdar olun.
                </p>
              </div>

              <div className="col-12 col-lg-6">
                <form onSubmit={(e) => { e.preventDefault(); alert("Teşekkürler! Demo talebiniz alındı."); }}>
                  <div className="row g-2">
                    <div className="col-sm-5">
                      <input
                        type="text"
                        className="form-control rounded-pill py-2.5 px-3 border"
                        placeholder="Adınız Soyadınız"
                        required
                      />
                    </div>
                    <div className="col-sm-5">
                      <input
                        type="tel"
                        className="form-control rounded-pill py-2.5 px-3 border"
                        placeholder="Telefon Numaranız"
                        required
                      />
                    </div>
                    <div className="col-sm-2">
                      <button
                        type="submit"
                        className="btn w-100 h-100 rounded-pill text-white d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: "#3b5d50" }}
                      >
                        <IconSend size={18} />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

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

              <div className="d-flex align-items-center gap-2">
                <a href="#" className="furni-social-circle"><IconBrandInstagram size={18} /></a>
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
    </div>
  );
};

export default LandingPage;

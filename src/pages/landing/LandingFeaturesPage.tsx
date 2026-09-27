import React from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  IconScale,
  IconReceipt,
  IconArrowsExchange,
  IconBarcode,
  IconShieldCheck,
  IconDeviceTv,
  IconBuildingStore,
  IconFileInvoice,
  IconCreditCard,
  IconUsers,
  IconSparkles,
  IconCheck,
  IconArrowRight,
  IconCalculator,
  IconCpu,
  IconLock,
} from "@tabler/icons-react";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";

export const LandingFeaturesPage: React.FC = () => {
  const navigate = useNavigate();

  const coreFeatures = [
    {
      icon: <IconScale size={28} className="text-warning" />,
      title: "Hassas Milyem ve Gramaj Motoru",
      desc: "24 Ayar (0.995 / 0.9999), 22 Ayar (0.916), 18 Ayar (0.750) ve 14 Ayar (0.585) ürünlerde 0.0001 gram hassasiyetiyle anlık has karşılığı hesaplar. Karışık milyemli sarrafiye alımlarında firesiz dönüşüm sağlar.",
      badge: "Milyem Hassasiyeti",
      points: [
        "Otomatik milyem dönüşüm tablosu ve özelleştirilebilir fire oranı",
        "Hurda altın alımında saf has gramajının anında kasaya aktarımı",
        "RS232/USB bağlantılı kuyumcu terazileriyle tek tıkta ağırlık alma",
      ],
    },
    {
      icon: <IconReceipt size={28} className="text-warning" />,
      title: "Hibrit Çoklu Ödeme ve Takas POS",
      desc: "Tek bir satış fişi içerisinde Nakit TL, Efektif Döviz (USD/EUR/GBP), Hurda/Eski Altın Takası, Kredi Kartı ve Veresiye cari borçlandırmayı aynı anda işler.",
      badge: "Hızlı Perakende POS",
      points: [
        "Hurda altın verip yeni ziynet alma işlemlerini tek fişte kapatma",
        "Kalan fiş tutarını F7 tuşuyla anında veresiyeye aktarma",
        "Satır bazlı veya toplam fiş üzerinden grup iskontosu uygulama",
      ],
    },
    {
      icon: <IconBarcode size={28} className="text-warning" />,
      title: "Akıllı Barkod & Kuyruk Etiketleme",
      desc: "Zebra, Argox ve TSC yazıcılarla %100 uyumlu etiketleme. Kuyruk etiketlerinde ürün kodu, ayar, gram, işçilik ve satış fiyatını milimetrik hassasiyetle basar.",
      badge: "Termal Baskı",
      points: [
        "Görsel Etiket Tasarım editörü ile dinamik logo ve barkod yerleşimi",
        "Toplu etiket dökümü ve otomatik seri numaralandırma",
        "Kablosuz el terminali veya optik okuyucu ile 1 dakikada vitrin sayımı",
      ],
    },
    {
      icon: <IconDeviceTv size={28} className="text-warning" />,
      title: "Mağaza İçi 4K Canlı TV Pano",
      desc: "Müşterileriniz ve vitrininiz için modern TV fiyat panosu. Kapalıçarşı canlı piyasa verilerini ve dükkanınızın kâr marjlarını eş zamanlı ekrana yansıtır.",
      badge: "Sıfır Gecikme",
      points: [
        "Websocket ile anlık gecikmesiz canlı kur yenileme",
        "Kayan yazı, kampanya duyuruları ve sarrafiye altın listesi",
        "TV ekranında tam ekran (F11) çalışabilen hafif istemci",
      ],
    },
    {
      icon: <IconShieldCheck size={28} className="text-warning" />,
      title: "MASAK ve 3065 Sayılı KDV Denetimi",
      desc: "185.000 TL üzeri nakit alım/satımlarda otomatik T.C. Kimlik / Pasaport zorunluluğu ve şüpheli işlem kontrolü. Kuyumculuk özel matrahına tam uyumlu KDV hesaplaması.",
      badge: "Yasal Uyum",
      points: [
        "Has altın bedeli KDV'den muaf, yalnızca işçilik tutarına %20 KDV",
        "E-Arşiv Fatura ve E-Fatura doğrudan GİB portalına tek tıkla iletim",
        "Müşteri bazlı MASAK kimlik doğrulama ve risk listesi sorgulama",
      ],
    },
    {
      icon: <IconCreditCard size={28} className="text-warning" />,
      title: "E-Banka & WhatsApp Ödeme Linki",
      desc: "Banka hesap hareketlerini otomatik cariye işleme, sanal POS üzerinden tek çekim/taksitli ödeme alma ve müşteriye WhatsApp'tan güvenli ödeme linki atma.",
      badge: "Dijital Tahsilat",
      points: [
        "Tüm bankaların hesap hareketlerini tek ekranda konsolide izleme",
        "WhatsApp / SMS üzerinden tek tıkla güvenli 3D Secure linki",
        "Fiziki POS komisyon oranları ve taksit vadeleri takibi",
      ],
    },
  ];

  return (
    <div className="w-100 min-vh-100 bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <LandingNavbar />

      {/* Hero Header */}
      <section
        className="py-5 py-md-6 border-bottom position-relative"
        style={{
          background: "linear-gradient(180deg, #faf6ef 0%, #ffffff 100%)",
        }}
      >
        <div className="container text-center py-4" style={{ maxWidth: "960px" }}>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill mb-3 bg-white border shadow-sm" style={{ borderColor: "#ebdcc8" }}>
            <IconSparkles size={16} className="text-warning" />
            <span className="small fw-bold text-uppercase" style={{ color: "#784405", fontSize: "0.78rem" }}>
              Likya ERP Çözüm Ekosistemi
            </span>
          </div>

          <h1 className="fw-bolder display-5 text-dark mb-3" style={{ lineHeight: "1.2" }}>
            Kuyumculuk Sektörünün En Kapsamlı <br />
            <span style={{ color: "#b8860b" }}>Teknoloji ve Yönetim Çözümleri</span>
          </h1>

          <p className="lead text-secondary mx-auto mb-4" style={{ maxWidth: "760px", fontSize: "1.1rem", lineHeight: "1.7" }}>
            Sadece bir muhasebe programı değil; dükkan terazinizden vitrin sayımınıza, mağaza TV panonuzdan resmi GİB E-Faturanıza kadar sarrafiyenizin kalbi olan eksiksiz bir ERP platformu.
          </p>

          <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="btn px-4 py-2.5 rounded-pill text-white fw-bold d-inline-flex align-items-center gap-2 shadow-sm"
              style={{ background: "linear-gradient(135deg, #c88f18 0%, #9e640b 100%)", border: "none" }}
            >
              <IconBuildingStore size={20} />
              <span>Sistemi Deneyimleyin</span>
            </button>
            <Link
              to="/moduller"
              className="btn btn-outline-secondary px-4 py-2.5 rounded-pill fw-semibold bg-white"
              style={{ borderColor: "#d5c3ab", color: "#784405" }}
            >
              Modülleri İnceleyin
            </Link>
          </div>
        </div>
      </section>

      {/* Deep Dive Feature Cards */}
      <section className="py-5 py-md-6 bg-white">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="text-center mb-5">
            <h6 className="fw-bold text-uppercase text-warning" style={{ fontSize: "0.82rem", letterSpacing: "1.5px" }}>
              TEMEL YETENEKLER
            </h6>
            <h2 className="fw-bolder text-dark">Sarrafiye İşletmenize Güç Katan Özellikler</h2>
          </div>

          <div className="row g-4">
            {coreFeatures.map((item, idx) => (
              <div key={idx} className="col-12 col-md-6 col-lg-4">
                <div
                  className="h-100 p-4 rounded-4 bg-white border transition-all d-flex flex-column justify-content-between shadow-sm"
                  style={{
                    borderColor: "#ede4d3",
                    boxShadow: "0 10px 25px rgba(120, 68, 5, 0.04)",
                  }}
                >
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div
                        className="p-3 rounded-3 d-flex align-items-center justify-content-center"
                        style={{ backgroundColor: "#faf5ea", border: "1px solid #ebdcc8" }}
                      >
                        {item.icon}
                      </div>
                      <span className="badge rounded-pill px-3 py-1.5" style={{ backgroundColor: "#faf5ea", color: "#784405", border: "1px solid #ebdcc8" }}>
                        {item.badge}
                      </span>
                    </div>

                    <h4 className="fw-bold text-dark mb-2" style={{ fontSize: "1.25rem" }}>
                      {item.title}
                    </h4>
                    <p className="text-secondary small mb-4" style={{ lineHeight: "1.65" }}>
                      {item.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-top" style={{ borderColor: "#f1ebe1" }}>
                    <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                      {item.points.map((pt, pIdx) => (
                        <li key={pIdx} className="d-flex align-items-start gap-2 small text-secondary">
                          <IconCheck size={16} className="text-success flex-shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Grid Section */}
      <section className="py-5 py-md-6 border-top" style={{ backgroundColor: "#faf7f2", borderColor: "#ede4d3" }}>
        <div className="container" style={{ maxWidth: "1120px" }}>
          <div className="text-center mb-5">
            <h6 className="fw-bold text-uppercase text-warning" style={{ fontSize: "0.82rem", letterSpacing: "1.5px" }}>
              NEDEN LİKYA KUYUM ERP?
            </h6>
            <h2 className="fw-bolder text-dark">Geleneksel Yazılımlar ile Likya ERP Karşılaştırması</h2>
          </div>

          <div className="table-responsive bg-white rounded-4 shadow-sm border overflow-hidden" style={{ borderColor: "#ede4d3" }}>
            <table className="table table-hover mb-0 align-middle">
              <thead style={{ backgroundColor: "#faf5ea" }}>
                <tr>
                  <th className="py-3 px-4 text-dark fw-bold">Özellik / Yetenek</th>
                  <th className="py-3 px-4 text-secondary text-center" style={{ width: "220px" }}>Eski / Klasik Programlar</th>
                  <th className="py-3 px-4 text-center fw-bold" style={{ width: "240px", backgroundColor: "#faecd2", color: "#784405" }}>
                    Likya Kuyum ERP
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-3 px-4 fw-medium text-dark">Hassas Milyem ve Has Gram Hesaplama</td>
                  <td className="text-center text-muted">Sadece 2 basamak yuvarlama</td>
                  <td className="text-center fw-bold text-success" style={{ backgroundColor: "#fefcf9" }}>
                    0.0001 Gr Tam Has Doğruluğu
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 fw-medium text-dark">Karma Ödeme ve Hurda Altın Takası</td>
                  <td className="text-center text-muted">Ayrı fişler gerektirir</td>
                  <td className="text-center fw-bold text-success" style={{ backgroundColor: "#fefcf9" }}>
                    Tek Fişte Çoklu Ödeme & Takas
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 fw-medium text-dark">4K Canlı TV Fiyat Panosu</td>
                  <td className="text-center text-muted">Ek pahalı donanım gerekir</td>
                  <td className="text-center fw-bold text-success" style={{ backgroundColor: "#fefcf9" }}>
                    Dahili Web Tabanlı TV Modu
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 fw-medium text-dark">Resmi GİB E-Fatura & E-Arşiv</td>
                  <td className="text-center text-muted">3. parti ek entegratör ücreti</td>
                  <td className="text-center fw-bold text-success" style={{ backgroundColor: "#fefcf9" }}>
                    Doğrudan Dahili GİB Entegrasyonu
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 fw-medium text-dark">WhatsApp'tan Sanal POS Ödeme Linki</td>
                  <td className="text-center text-muted">Desteklenmez</td>
                  <td className="text-center fw-bold text-success" style={{ backgroundColor: "#fefcf9" }}>
                    Tek Tıkla WhatsApp & SMS Paylaşımı
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 fw-medium text-dark">MASAK Denetimi & Kimlik Tespiti</td>
                  <td className="text-center text-muted">Manuel takip</td>
                  <td className="text-center fw-bold text-success" style={{ backgroundColor: "#fefcf9" }}>
                    185.000 TL Otomatik Kimlik Uyarısı
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};
export default LandingFeaturesPage;

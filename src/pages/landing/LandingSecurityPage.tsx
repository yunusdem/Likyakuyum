import React from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  IconShieldCheck,
  IconFileInvoice,
  IconDatabase,
  IconLock,
  IconSparkles,
  IconCheck,
  IconArrowRight,
  IconBuildingStore,
  IconScale,
  IconUserCheck,
} from "@tabler/icons-react";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";

export const LandingSecurityPage: React.FC = () => {
  const navigate = useNavigate();

  const securityPillars = [
    {
      icon: <IconShieldCheck size={32} className="text-warning" />,
      badge: "MASAK Mevzuatı",
      title: "185.000 TL Nakit İşlem & Kimlik Tespiti",
      desc: "5549 Sayılı Suç Gelirlerinin Aklanmasının Önlenmesi Kanunu gereğince kuyumcular için belirlenen parasal sınırları otomatik uygular.",
      details: [
        "185.000 TL ve üzeri nakit altın/döviz işlemlerinde otomatik T.C. Kimlik / Pasaport / Vergi No zorunluluğu",
        "Şüpheli İşlem Bildirimi (ŞİB) ve dahili MASAK yasaklı/riskli müşteri sorgu listesi",
        "İşlem fişlerinde kimlik bilgilerinin ve imza bölümlerinin yasal formatta basımı",
        "Geçmişe dönük MASAK denetim raporlarının tek tıkla Excel/PDF ihracı",
      ],
    },
    {
      icon: <IconFileInvoice size={32} className="text-warning" />,
      badge: "3065 Sayılı KDV Kanunu",
      title: "Kuyumculukta Özel Matrah ve İşçilik KDV",
      desc: "KDV Kanunu'nun 17/4-g ve 23/f maddeleri kapsamında altın bedeli ile işçilik tutarını anında ayrıştırır.",
      details: [
        "Satılan ziynet ürünün saf altın (has) bedeli KDV'den tam istisna tutulur",
        "Yalnızca kuyumcu kârı ve işçilik bedeli üzerinden yasal %20 KDV hesaplanır",
        "E-Arşiv Fatura ve E-Fatura XML çıktılarında özel matrah kodları otomatik doldurulur",
        "Muhasebeciniz ve mali müşaviriniz için hatasız KDV beyanname dökümleri üretir",
      ],
    },
    {
      icon: <IconDatabase size={32} className="text-warning" />,
      badge: "SQL Server 2026",
      title: "Transaction Güvencesi & Şifreli Yedekleme",
      desc: "Verileriniz silinmeye veya elektrik kesintilerine karşı Microsoft SQL Server ACID transaction mimarisiyle korunur.",
      details: [
        "Her vezne fişi ve kasa hareketi transaction blokları içinde çalışır, yarım kalan kayıt oluşmaz",
        "Otomatik zamanlanmış günlük/haftalık şifrelenmiş yedekleme altyapısı",
        "Hem yerel SQL Server (dükkan sunucusu) hem de güvenli bulut SQL bağlantı desteği",
        "Kullanıcı bazlı detaylı işlem logları (kim, ne zaman, hangi fişi ekledi/düzenledi)",
      ],
    },
    {
      icon: <IconUserCheck size={32} className="text-warning" />,
      badge: "KVKK & Yetkilendirme",
      title: "Kullanıcı Yetkilendirme & KVKK Mimarisi",
      desc: "Personelinizin sadece kendi yetki alanındaki modüllere ve kasalara erişmesini sağlayan rol tabanlı güvenlik.",
      details: [
        "Vezne personeli, kasa şefi ve mağaza müdürü için ayrıştırılmış rol bazlı menü erişimi",
        "İskonto verme tavan limiti ve maliyet görme kısıtlaması",
        "Müşteri telefon ve kişisel verilerinin KVKK uyumlu maskelenmesi",
        "Kasa silme veya geçmiş fiş düzeltmelerinde yönetici şifre onayı",
      ],
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
              Yasal Güvence & Kurumsal Güvenlik
            </span>
          </div>

          <h1 className="fw-bolder display-5 text-dark mb-3">
            MASAK, GİB ve <span style={{ color: "#b8860b" }}>Veri Güvenliği Standartları</span>
          </h1>

          <p className="lead text-secondary mx-auto mb-0" style={{ maxWidth: "760px", fontSize: "1.08rem", lineHeight: "1.7" }}>
            Maliye denetimleri, MASAK yükümlülükleri ve veritabanı güvenliğinde sıfır risk. Likya Kuyum ERP ile her işleminiz yasalara %100 uygundur.
          </p>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="py-5 py-md-6 bg-white">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="row g-4">
            {securityPillars.map((p, idx) => (
              <div key={idx} className="col-12 col-lg-6">
                <div
                  className="h-100 p-4 p-md-5 rounded-4 bg-white border shadow-sm d-flex flex-column justify-content-between"
                  style={{ borderColor: "#ede4d3", boxShadow: "0 10px 25px rgba(120, 68, 5, 0.04)" }}
                >
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <div className="p-3 rounded-3" style={{ backgroundColor: "#faf5ea", border: "1px solid #ebdcc8" }}>
                        {p.icon}
                      </div>
                      <span className="badge rounded-pill px-3 py-1.5" style={{ backgroundColor: "#faf5ea", color: "#784405", border: "1px solid #ebdcc8" }}>
                        {p.badge}
                      </span>
                    </div>

                    <h3 className="fw-bold text-dark mb-2" style={{ fontSize: "1.35rem" }}>
                      {p.title}
                    </h3>
                    <p className="text-secondary small mb-4" style={{ lineHeight: "1.7" }}>
                      {p.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-top" style={{ borderColor: "#f1ebe1" }}>
                    <h6 className="fw-bold text-dark small mb-2 text-uppercase" style={{ fontSize: "0.78rem" }}>
                      Mevzuat & Sistem Kapsamı
                    </h6>
                    <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
                      {p.details.map((d, dIdx) => (
                        <li key={dIdx} className="d-flex align-items-start gap-2 small text-secondary">
                          <IconCheck size={16} className="text-success flex-shrink-0 mt-0.5" />
                          <span>{d}</span>
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

      {/* Trust & Guarantee Callout */}
      <section className="py-5 border-top" style={{ backgroundColor: "#faf7f2", borderColor: "#ede4d3" }}>
        <div className="container text-center" style={{ maxWidth: "860px" }}>
          <h3 className="fw-bold text-dark mb-3">Mali Müşavir ve Denetçilerin Tercihi</h3>
          <p className="text-secondary mb-4" style={{ lineHeight: "1.7" }}>
            Likya Kuyum ERP; Gelir İdaresi Başkanlığı e-Dönüşüm standartlarına ve Türkiye Cumhuriyet Merkez Bankası döviz bildirim yönergelerine göre düzenli güncellenir.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="btn px-4 py-2.5 rounded-pill text-white fw-bold d-inline-flex align-items-center gap-2 shadow-sm"
            style={{ background: "linear-gradient(135deg, #c88f18 0%, #9e640b 100%)", border: "none" }}
          >
            <IconBuildingStore size={20} />
            <span>Sisteme Başlayın</span>
          </button>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};
export default LandingSecurityPage;

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  IconHelpCircle,
  IconChevronDown,
  IconSparkles,
  IconBuildingStore,
  IconPhoneCall,
} from "@tabler/icons-react";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";

export const LandingFaqPage: React.FC = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      category: "Donanım & Terazi Entegrasyonu",
      items: [
        {
          q: "Likya Kuyum hassas teraziler ve barkod yazıcılarla nasıl haberleşir?",
          a: "Sistemimiz standart seri port (RS232) ve USB dönüştürücüler üzerinden piyasadaki tüm hassas kuyumcu terazileriyle doğrudan entegre çalışır. Fiş keserken terazideki gramaj tek tuşla ekrana yansır. Zebra, Argox, TSC ve Godex gibi endüstriyel termal barkod yazıcılarına doğrudan kuyruk etiket baskısı gönderir.",
        },
        {
          q: "Barkodlu vitrin sayımı nasıl gerçekleştirilir?",
          a: "Kablosuz optik el terminali veya kablolu barkod okuyucu ile vitrindeki ürünlerin etiketleri ardı ardına taranır. Sistem, kayıtlı stok ile sayılan adet/gramaj farkını anında raporlar ve eksik/fazla ürünleri listeler.",
        },
        {
          q: "Mağaza içi TV fiyat panosu için ek bir pahalı donanım gerekir mi?",
          a: "Hayır. Akıllı televizyonunuzdaki (Smart TV) web tarayıcısından veya TV'ye bağlı minik bir HDMI PC/Android kutudan tek tıkla tam ekran Pano modunu açabilirsiniz. Fiyatlar ana kasadan veya Kapalıçarşı piyasasından anlık güncellenir.",
        },
      ],
    },
    {
      category: "Mevzuat, KDV & MASAK",
      items: [
        {
          q: "Kuyumculukta has altın ve işçilik KDV hesaplamaları mevzuata uygun mu?",
          a: "Evet. Likya Kuyum, 3065 sayılı KDV Kanunu'nun kuyumculuk özel matrah hükümlerine tam uyumludur. Satış esnasında ürünün has bedeli vergiden istisna tutulurken yalnızca işçilik/kâr tutarı üzerinden KDV otomatik hesaplanır ve e-faturaya yansıtılır.",
        },
        {
          q: "185.000 TL MASAK nakit işlem sınırı nasıl denetlenir?",
          a: "Tek fişte veya aynı müşterinin gün içerisindeki kümülatif nakit işlemlerinde 185.000 TL aşıldığında sistem personeli uyarır ve T.C. Kimlik / Pasaport / Vergi Numarası girilmeden işlemin kaydedilmesine izin vermez.",
        },
        {
          q: "GİB E-Fatura ve E-Arşiv için ek bir entegratör ücreti ödemem gerekir mi?",
          a: "Sistemimiz hem doğrudan GİB Portalı ile hem de tercih ettiğiniz özel entegratörler (Trendyol E-Dönüşüm, Foriba/Sovos, Digital Planet vb.) ile doğrudan çalışabilir.",
        },
      ],
    },
    {
      category: "Çalışma Modları, Çoklu Kasa & Güvenlik",
      items: [
        {
          q: "Aynı anda birden fazla vezne, kasa ve şube kullanılabilir mi?",
          a: "Kesinlikle. Çoklu vezne altyapısı sayesinde her personelin kendi vezne kasası, açılış-kapanış devirleri ve gün sonu mutabakatı bağımsız işler; merkez yönetim tüm hareketleri konsolide olarak tek ekranda izler.",
        },
        {
          q: "İnternet kesildiğinde program çalışmaya devam eder mi?",
          a: "Evet. Dükkanınızdaki yerel SQL Server üzerinden çalıştığınızda internet bağlantınız olmasa dahi vezne satışı, terazi tartımı, barkod basımı ve kasa devirleri kesintisiz devam eder. İnternet geldiğinde e-belgeler GİB'e iletilir.",
        },
        {
          q: "Eski kuyumcu programımdaki stok ve cari verilerini aktarabilir miyim?",
          a: "Evet. Likya Kuyum veri aktarım sihirbazı ile Excel, CSV veya eski SQL veritabanınızdaki cari hesap bakiyeleri, ürün stokları ve borç/alacak kayıtları dakikalar içinde yeni sisteme aktarılır.",
        },
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
              Merak Edilenler & Yanıtlar
            </span>
          </div>

          <h1 className="fw-bolder display-5 text-dark mb-3">
            Sıkça Sorulan <span style={{ color: "#b8860b" }}>Sorular</span>
          </h1>

          <p className="lead text-secondary mx-auto mb-0" style={{ maxWidth: "760px", fontSize: "1.08rem", lineHeight: "1.7" }}>
            Likya Kuyum ERP hakkında donanım, teraziler, mevzuat, e-belge ve kurulumla ilgili en çok yöneltilen soruların detaylı yanıtları.
          </p>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="py-5 py-md-6 bg-white">
        <div className="container" style={{ maxWidth: "960px" }}>
          {faqs.map((cat, cIdx) => (
            <div key={cIdx} className="mb-5">
              <h4 className="fw-bold text-dark mb-3 pb-2 border-bottom d-flex align-items-center gap-2" style={{ borderColor: "#ede4d3", fontSize: "1.3rem" }}>
                <span className="p-1 rounded bg-warning bg-opacity-25" />
                <span>{cat.category}</span>
              </h4>

              <div className="d-flex flex-column gap-3">
                {cat.items.map((item, iIdx) => {
                  const itemGlobalIdx = cIdx * 10 + iIdx;
                  const isOpen = openIndex === itemGlobalIdx;
                  return (
                    <div
                      key={iIdx}
                      className="border rounded-4 transition-all overflow-hidden bg-white shadow-sm"
                      style={{
                        borderColor: isOpen ? "#c88f18" : "#ede4d3",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setOpenIndex(isOpen ? null : itemGlobalIdx)}
                        className="w-100 p-4 text-start bg-transparent border-0 d-flex align-items-center justify-content-between gap-3"
                      >
                        <span className="fw-bold text-dark" style={{ fontSize: "1.05rem" }}>
                          {item.q}
                        </span>
                        <div
                          className="p-1.5 rounded-circle d-flex align-items-center justify-content-center transition-all flex-shrink-0"
                          style={{
                            backgroundColor: isOpen ? "#faf5ea" : "#f1f5f9",
                            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                            color: isOpen ? "#784405" : "#64748b",
                          }}
                        >
                          <IconChevronDown size={18} />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 pb-4 pt-1 text-secondary border-top" style={{ borderColor: "#faf5ea", lineHeight: "1.75", fontSize: "0.95rem" }}>
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Help Contact Banner */}
          <div className="p-4 p-md-5 rounded-4 text-center border shadow-sm mt-5" style={{ backgroundColor: "#faf7f2", borderColor: "#ede4d3" }}>
            <h4 className="fw-bold text-dark mb-2">Başka Bir Sorunuz mu Var?</h4>
            <p className="text-secondary small mb-4">
              Teknik ekibimiz ve sektör uzmanlarımız sorularınızı yanıtlamaktan memnuniyet duyar.
            </p>
            <div className="d-flex align-items-center justify-content-center gap-3 flex-wrap">
              <Link
                to="/iletisim"
                className="btn px-4 py-2.5 rounded-pill text-white fw-bold d-inline-flex align-items-center gap-2 shadow-sm"
                style={{ background: "linear-gradient(135deg, #c88f18 0%, #9e640b 100%)", border: "none" }}
              >
                <IconPhoneCall size={18} />
                <span>Bize Ulaşın</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};
export default LandingFaqPage;

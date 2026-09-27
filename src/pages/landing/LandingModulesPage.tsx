import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  IconReceipt,
  IconBarcode,
  IconDeviceTv,
  IconFileInvoice,
  IconCreditCard,
  IconUsers,
  IconBuildingBank,
  IconChartBar,
  IconCheck,
  IconArrowRight,
  IconSparkles,
  IconPrinter,
  IconScale,
  IconBrandWhatsapp,
} from "@tabler/icons-react";
import LandingNavbar from "./LandingNavbar";
import LandingFooter from "./LandingFooter";

export const LandingModulesPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedModule, setSelectedModule] = useState<string>("vezne");

  const modulesList = [
    {
      id: "vezne",
      title: "Vezne & Perakende Satış",
      icon: <IconReceipt size={24} />,
      badge: "Hızlı POS & Satış",
      subtitle: "Kuyumcu ve Sarrafiyeler İçin Hızlı, Hatasız ve Çoklu Ödeme Destekli Satış Masası",
      description:
        "Likya Vezne Satış modülü; ziynet altın, pırlanta, sarrafiye, gümüş ve döviz satışlarını saniyeler içinde tamamlamanızı sağlar. Terazi entegrasyonuyla ağırlığı anında okur, hurda altın takasını ve müşterinin kalan bakiyesini veresiye aktarır.",
      features: [
        "Altın, Ziynet, Gümüş ve Efektif Döviz Satış/İade fişleri",
        "Karma Ödeme: Nakit TL, Döviz, Hurda/Has Takası, Kredi Kartı ve Veresiye cari aktarımı",
        "Satır bazında ve fiş geneli otomatik iskonto hesaplama (F1-F12 klavye kısayolları)",
        "Kalan tutarı tek tuşla (F7) anında veresiyeye veya cari hesaba aktarma",
        "Seri port/USB üzerinden tüm hassas kuyumcu terazileriyle anlık tartım",
        "Kasa bazlı bağımsız gün başı devri ve gün sonu mutabakatı",
      ],
      specs: [
        { label: "İşlem Süresi", val: "< 5 Saniye" },
        { label: "Ödeme Yöntemi", val: "5+ Çoklu Tür" },
        { label: "Hassasiyet", val: "0.0001 Gram Has" },
        { label: "Kısayol Desteği", val: "F1-F12 Tam Klavye" },
      ],
    },
    {
      id: "barkod",
      title: "Barkod & Ürün Etiketleme",
      icon: <IconBarcode size={24} />,
      badge: "Termal Baskı",
      subtitle: "Yüzük, Kolye, Bilezik Kuyruk Etiketleri ve Görsel Tasarım Editörü",
      description:
        "Zebra, Argox, Godex ve TSC endüstriyel termal yazıcılarla kuyruk etiketleri basın. Görsel etiket tasarım modülü sayesinde logonuzu, ayar, gram, işçilik ve satış fiyatını milimetrik konumlandırın.",
      features: [
        "Yüzük, Bilezik, Kolye ve Set ürünleri için yırtılmaz kuyruk etiket baskısı",
        "Maliyet işçilik, satış kârı ve milyem bazlı otomatik fiyat hesaplama",
        "Görsel Etiket Tasarım Modülü ile sürükle-bırak logo ve barkod yerleşimi",
        "Toplu etiket dökümü ve otomatik seri barkod üretimi",
        "Kablosuz el terminali veya optik okuyucu ile Barkodlu Vitrin Sayım Fişi",
        "Altın ve özel taşlı ürünlerin fotoğrafını çekip karta ekleme desteği",
      ],
      specs: [
        { label: "Yazıcı Uyumu", val: "Zebra, Argox, TSC, Godex" },
        { label: "Etiket Tipleri", val: "Kuyruk, Kelebek, Rulo" },
        { label: "Sayım Hızı", val: "100 Ürün / Dakika" },
        { label: "Özelleştirme", val: "Görsel Şablon Editörü" },
      ],
    },
    {
      id: "pano",
      title: "Canlı Kur & TV Fiyat Panosu",
      icon: <IconDeviceTv size={24} />,
      badge: "Vitrin Ekranı",
      subtitle: "Kapalıçarşı ve Serbest Piyasa Fiyatlarını Mağazanızın TV'sine Yansıtın",
      description:
        "Kapalıçarşı ve serbest piyasa canlı altın ve döviz fiyatlarını anlık alarak dükkanınızın alış/satış kâr marjlarını otomatik hesaplayın. 4K televizyonlarda tam ekran vitrin panosu olarak sunun.",
      features: [
        "Full-screen TV Pano modu ile vitrin ve kasa üstü fiyat gösterimi",
        "Kapalıçarşı ve serbest piyasa kurlarını anlık ve kesintisiz alma",
        "Firma kâr marjını ve spread oranlarını anında panoya yansıtma",
        "Özelleştirilebilir kayan yazı, firma logosu, nöbetçi eczane ve duyuru bandı",
        "Websocket ile sıfır gecikmeli fiyat yenileme",
        "Altın, Gümüş, Ziynet ve 30+ Dünya Para Birimi desteği",
      ],
      specs: [
        { label: "Gecikme Süresi", val: "0 ms Real-Time" },
        { label: "Çözünürlük", val: "Full HD & 4K Uyumlu" },
        { label: "Fiyat Listesi", val: "Sınırsız Çeşit" },
        { label: "Bağlantı", val: "Smart TV / Web Tarayıcı" },
      ],
    },
    {
      id: "ebelge",
      title: "E-Belge & GİB E-Fatura (3065 KDV)",
      icon: <IconFileInvoice size={24} />,
      badge: "GİB %100 Uyumlu",
      subtitle: "Kuyumculuk Özel Matrahına Uygun E-Arşiv, E-Fatura, E-İrsaliye ve Gider Pusulası",
      description:
        "Gelir İdaresi Başkanlığı (GİB) standartlarında altın işçilik KDV ayrımıyla fatura kesin. Has altın bedeli vergiden istisna tutulurken işçilik tutarı üzerinden KDV otomatik hesaplanır.",
      features: [
        "E-Arşiv Fatura ve E-Fatura doğrudan GİB portalı entegrasyonu",
        "E-İrsaliye, E-Müstahsil Makbuzu ve Gider Pusulası düzenleme",
        "3065 Sayılı KDV Kanunu'na uygun Has ve İşçilik KDV matrah ayrımı",
        "Gelen ve giden tüm e-belgeleri tek ekranda sorgulama ve XML/PDF indirme",
        "Müşteriye otomatik e-posta ve SMS ile e-fatura gönderme",
        "10 yıl boyunca güvenli bulut arşivleme ve yasal uyumluluk garantisi",
      ],
      specs: [
        { label: "Mevzuat", val: "3065 Sayılı KDV Kanunu" },
        { label: "İmzalama Hızı", val: "Anında XML İmzası" },
        { label: "Entegrasyon", val: "GİB & Özel Entegratör" },
        { label: "Arşiv Süresi", val: "10 Yıl Güvenli Bulut" },
      ],
    },
    {
      id: "ebanka",
      title: "E-Banka, Sanal POS & WhatsApp Tahsilat",
      icon: <IconCreditCard size={24} />,
      badge: "Fintech Çözümleri",
      subtitle: "Tüm Banka Hesapları Tek Ekranda, WhatsApp'tan Anında Ödeme Linki",
      description:
        "Banka hesap hareketlerinizi otomatik çekerek cari kartlara fişleştirin. Sanal POS (VPOS) ile kredi kartından tek çekim veya taksitli ödeme alın; WhatsApp üzerinden müşterilerinize güvenli ödeme linki gönderin.",
      features: [
        "Tüm banka hesap hareketlerinin anlık izlenmesi ve otomatik muhasebeleşmesi",
        "VPOS Sanal POS ile kredi kartı tek çekim ve taksitli tahsilat",
        "WhatsApp ve SMS üzerinden tek tıkla Güvenli 3D Secure Ödeme Linki paylaşımı",
        "Fiziki POS cihazı komisyon oranları ve vade takibi",
        "Gün sonu otomatik banka mutabakatı ve hesap özeti raporu",
      ],
      specs: [
        { label: "Banka Desteği", val: "Tüm Türk Bankaları" },
        { label: "Tahsilat Linki", val: "WhatsApp & SMS" },
        { label: "Güvenlik", val: "3D Secure 2.0" },
        { label: "Mutabakat", val: "Otomatik Gün Sonu" },
      ],
    },
    {
      id: "cari",
      title: "Cari Hesap & Altın Emanet Yönetimi",
      icon: <IconUsers size={24} />,
      badge: "CRM & Müşteri",
      subtitle: "TL, Döviz ve Has Altın Bakiyesi, Sarrafiye Emanetleri ve MASAK Uyumu",
      description:
        "Müşteri ve toptancı hesaplarınızı TL, Döviz ve Has Altın bazında takip edin. Sarrafiye emanet dekontları düzenleyin, 185.000 TL üzeri işlemlerde MASAK kimlik tespitini otomatik uygulayın.",
      features: [
        "TL, Döviz ve Has Altın cinsinden çoklu ve bağımsız bakiye takibi",
        "Cari Emanet Dekontları ile sarrafiye emanet kayıtları ve barkodlu teslim fişi",
        "MASAK mevzuatına uygun T.C. Kimlik / Pasaport ve vergi no denetimi",
        "Ayrıntılı hesap ekstresi, yaşlandırma raporları ve mutabakat mektubu çıktısı",
        "Müşteriye özel iskonto grubu ve risk limiti tanımlama",
      ],
      specs: [
        { label: "Bakiye Türü", val: "TL + Döviz + Has Gr" },
        { label: "Emanet Türü", val: "Gram, Ziynet, Çeyrek" },
        { label: "MASAK Denetimi", val: "185.000 TL Otomatik" },
        { label: "Ekstre Formatı", val: "PDF, Excel, WhatsApp" },
      ],
    },
    {
      id: "kasa",
      title: "Kasa, Banknot & Masraf Yönetimi",
      icon: <IconBuildingBank size={24} />,
      badge: "Kasa Güvenliği",
      subtitle: "Vezne Kasaları, Banknot Sayımı, Genel Giderler ve Para Transferleri",
      description:
        "Birden fazla dükkan kasası, döviz kasası ve sarrafiye altın kasası yönetimi. Kasa devirleri, banknot kupür dökümü ve personel masraf fişleri tek ekranda.",
      features: [
        "Çoklu şube ve vezne kasaları arası anlık virman ve transfer fişleri",
        "Kupür bazlı banknot sayımı (200 TL, 100 TL, 100 USD, 50 EUR vb.)",
        "Dükkan genel giderleri, personel avansları ve masraf kartları",
        "Kasa açılış-kapanış devirleri ve gün sonu kasa z raporu dökümü",
      ],
      specs: [
        { label: "Kasa Türü", val: "TL, Döviz, Sarrafiye" },
        { label: "Kupür Desteği", val: "Tüm Dünya Banknotları" },
        { label: "Transfer Hızı", val: "Anında Kasa Virmanı" },
        { label: "Yetkilendirme", val: "Kullanıcı Bazlı Kasa" },
      ],
    },
    {
      id: "rapor",
      title: "Gelişmiş Raporlama & Kârlılık Analizi",
      icon: <IconChartBar size={24} />,
      badge: "Kar / Zarar Analizi",
      subtitle: "Gerçek Zamanlı Altın Kârı, Günlük Ciro ve Stok Yaşlandırma Raporları",
      description:
        "İşletmenizin anlık finansal durumunu görün. Has altın bazında net kârlılık, ürün grubu bazında satış dağılımı ve vitrin stok devir hızını grafiklerle analiz edin.",
      features: [
        "Has Altın, İşçilik ve Döviz kâr/zarar raporları",
        "Personel bazlı satış performansı ve prim hesaplama",
        "Vitrin stok devir hızı, en çok satan modeller ve kritik stok uyarıları",
        "Tek tıkla Excel, PDF ve e-posta rapor ihracı",
      ],
      specs: [
        { label: "Rapor Formatı", val: "Excel, PDF, Grafik" },
        { label: "Kâr Analizi", val: "Milyem & TL Bazlı" },
        { label: "Veri Güncelliği", val: "Anlık Canlı SQL" },
        { label: "Dışa Aktarım", val: "Sınırsız İhracat" },
      ],
    },
  ];

  const activeMod = modulesList.find((m) => m.id === selectedModule) || modulesList[0];

  return (
    <div className="w-100 min-vh-100 bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <LandingNavbar />

      {/* Header */}
      <section className="py-5 border-bottom" style={{ background: "linear-gradient(180deg, #faf6ef 0%, #ffffff 100%)" }}>
        <div className="container text-center py-3" style={{ maxWidth: "960px" }}>
          <div className="d-inline-flex align-items-center gap-2 px-3 py-1.5 rounded-pill mb-3 bg-white border shadow-sm" style={{ borderColor: "#ebdcc8" }}>
            <IconSparkles size={16} className="text-warning" />
            <span className="small fw-bold text-uppercase" style={{ color: "#784405", fontSize: "0.78rem" }}>
              Tüm İşletme İhtiyaçları Tek Yazılımda
            </span>
          </div>

          <h1 className="fw-bolder display-5 text-dark mb-3">
            Likya Kuyum ERP <span style={{ color: "#b8860b" }}>Modüller Rehberi</span>
          </h1>

          <p className="lead text-secondary mx-auto mb-0" style={{ maxWidth: "740px", fontSize: "1.08rem", lineHeight: "1.7" }}>
            Kuyumculuk, sarrafiye ve döviz bürolarının tüm operasyonel adımları için sıfırdan geliştirilmiş 8 ana modülümüzü keşfedin.
          </p>
        </div>
      </section>

      {/* Interactive Modules Explorer */}
      <section className="py-5 py-md-6 bg-white">
        <div className="container" style={{ maxWidth: "1280px" }}>
          <div className="row g-4">
            {/* Left Nav Tabs */}
            <div className="col-12 col-lg-4">
              <div className="p-3 rounded-4 bg-light border shadow-sm sticky-top" style={{ top: "100px", borderColor: "#ede4d3" }}>
                <h6 className="fw-bold text-uppercase px-2 mb-3 text-secondary" style={{ fontSize: "0.8rem", letterSpacing: "1px" }}>
                  ERP MODÜLLERİ ({modulesList.length})
                </h6>
                <div className="d-flex flex-column gap-1.5">
                  {modulesList.map((m) => {
                    const isSelected = selectedModule === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedModule(m.id)}
                        className="btn text-start p-3 rounded-3 d-flex align-items-center justify-content-between border-0 transition-all"
                        style={{
                          backgroundColor: isSelected ? "#ffffff" : "transparent",
                          color: isSelected ? "#784405" : "#475569",
                          boxShadow: isSelected ? "0 4px 12px rgba(120, 68, 5, 0.08)" : "none",
                          border: isSelected ? "1px solid #ebdcc8" : "1px solid transparent",
                          fontWeight: isSelected ? 700 : 500,
                        }}
                      >
                        <div className="d-flex align-items-center gap-2.5">
                          <span className={isSelected ? "text-warning" : "text-muted"}>{m.icon}</span>
                          <span style={{ fontSize: "0.92rem" }}>{m.title}</span>
                        </div>
                        <IconArrowRight size={16} className={isSelected ? "text-warning" : "text-muted opacity-50"} />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Detailed Panel */}
            <div className="col-12 col-lg-8">
              <div
                className="p-4 p-md-5 rounded-4 bg-white border shadow-sm"
                style={{ borderColor: "#ede4d3", boxShadow: "0 12px 30px rgba(120, 68, 5, 0.06)" }}
              >
                {/* Header Badge & Title */}
                <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
                  <div className="d-flex align-items-center gap-2.5">
                    <div
                      className="p-3 rounded-3 d-flex align-items-center justify-content-center text-warning"
                      style={{ backgroundColor: "#faf5ea", border: "1px solid #ebdcc8" }}
                    >
                      {activeMod.icon}
                    </div>
                    <div>
                      <h2 className="fw-bolder text-dark mb-0" style={{ fontSize: "1.75rem" }}>
                        {activeMod.title}
                      </h2>
                      <span className="text-secondary small fw-medium">{activeMod.subtitle}</span>
                    </div>
                  </div>
                  <span className="badge rounded-pill px-3 py-1.5" style={{ backgroundColor: "#faf5ea", color: "#784405", border: "1px solid #ebdcc8", fontSize: "0.82rem" }}>
                    {activeMod.badge}
                  </span>
                </div>

                {/* Description */}
                <p className="text-secondary mb-4" style={{ fontSize: "1rem", lineHeight: "1.75" }}>
                  {activeMod.description}
                </p>

                {/* Specs Grid */}
                <div className="row g-3 mb-4">
                  {activeMod.specs.map((sp, sIdx) => (
                    <div key={sIdx} className="col-6 col-md-3">
                      <div className="p-3 rounded-3 border text-center" style={{ backgroundColor: "#faf7f2", borderColor: "#ede4d3" }}>
                        <div className="text-muted small mb-1" style={{ fontSize: "0.75rem" }}>
                          {sp.label}
                        </div>
                        <div className="fw-bold text-dark" style={{ fontSize: "0.92rem", color: "#784405" }}>
                          {sp.val}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Features List */}
                <h5 className="fw-bold text-dark mb-3" style={{ fontSize: "1.1rem" }}>
                  Öne Çıkan Modül Fonksiyonları
                </h5>
                <div className="d-flex flex-column gap-2.5 mb-4">
                  {activeMod.features.map((feat, fIdx) => (
                    <div key={fIdx} className="d-flex align-items-start gap-2.5 p-2 rounded-2" style={{ backgroundColor: "#fafaf8" }}>
                      <IconCheck size={18} className="text-success flex-shrink-0 mt-0.5" />
                      <span className="text-dark small fw-medium" style={{ lineHeight: "1.5" }}>
                        {feat}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Bottom CTA */}
                <div className="pt-4 border-top d-flex align-items-center justify-content-between flex-wrap gap-3" style={{ borderColor: "#ede4d3" }}>
                  <span className="small text-muted">
                    Bu modülü canlı denemek için sisteme giriş yapabilirsiniz.
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="btn px-4 py-2.5 rounded-3 text-white fw-bold d-inline-flex align-items-center gap-2 shadow-sm"
                    style={{ background: "linear-gradient(135deg, #c88f18 0%, #9e640b 100%)", border: "none" }}
                  >
                    <span>Modülü Çalıştır</span>
                    <IconArrowRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
};
export default LandingModulesPage;

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { IconArrowRight, IconCircleCheck, IconPlayerPlay } from "@tabler/icons-react";
import { ISLETME_TURLERI, ORTAK_ALTYAPI, URUNLER, urunKoduyla } from "../veri/urunler";
import { RAKAMLAR } from "../veri/sirket";
import { useSayfa } from "../yardimci/sayfa";
import { urunStili } from "../bilesenler/UrunStil";
import { Belir, BolumBasligi, CagriBolumu, SSS, UrunKarti, Yorumlar } from "../bilesenler/Ortak";

const ANA_SSS = [
  {
    soru: "Likya ürünlerini ayrı ayrı alabilir miyim?",
    cevap:
      "Evet. Likya.Kuyum, Gümüş, Döviz ve Ticari tek başına çalışır. Birden fazla iş kolunuz ya da şubeniz varsa Likya.ERP hepsini tek merkezde birleştirir; ürünleri ihtiyacınıza göre açarsınız.",
  },
  {
    soru: "Program bulutta mı çalışıyor, bilgisayara mı kuruluyor?",
    cevap:
      "İkisi birden. Hibrit yapıda veriler bulutta ve yerel SQL'de tutulur; internet kesilse de satış sürer, bağlantı gelince eşitlenir.",
  },
  {
    soru: "e-Fatura için ayrıca entegratör ücreti ödemem gerekir mi?",
    cevap: "e-Fatura, e-Arşiv ve e-Döviz programın içindedir; belgeyi kestiğiniz ekrandan gönderir, durumunu aynı yerden izlersiniz.",
  },
  {
    soru: "Eski programımdaki verileri aktarabilir miyim?",
    cevap: "Evet. Cari, stok ve açılış bakiyeleri Excel, CSV ya da SQL üzerinden aktarılır; kurulum sırasında ekibimiz yardımcı olur.",
  },
];

const ADIMLAR = [
  { baslik: "Tanışalım", metin: "İşletmenizi ve ihtiyacınızı dinliyor, size uygun Likya ürününü birlikte seçiyoruz." },
  { baslik: "Canlı demo", metin: "Seçtiğiniz ürünü kendi iş akışınız üzerinden canlı olarak gösteriyoruz." },
  { baslik: "Kurulum & aktarım", metin: "Programı kuruyor, eski verilerinizi aktarıyor, cihazlarınızı bağlıyoruz." },
  { baslik: "Eğitim & destek", metin: "Ekibinizi eğitiyor, telefon ve WhatsApp üzerinden yanınızda kalıyoruz." },
];

export const AnaSayfa: React.FC = () => {
  useSayfa(
    "Likya ERP — Kuyum, Gümüş, Döviz ve Ticari İşletmeler İçin Yönetim Yazılımı",
    "Likya ürün ailesi: Likya.ERP, Likya.Kuyum, Likya.Gümüş, Likya.Döviz, Likya.Ticari ve Likya.Connector. GİB e-Belge, e-Banka, POS ve terazi entegrasyonlu, bulut ve yerel çalışan yönetim yazılımları.",
    "/"
  );
  const [secili, setSecili] = useState(0);
  const tur = ISLETME_TURLERI[secili];
  const erp = urunKoduyla("erp");
  const connector = urunKoduyla("connector");
  const ErpIkon = erp.ikon;
  const ConnectorIkon = connector.ikon;
  const SektorUrunleri = URUNLER.filter((u) => u.kod !== "erp" && u.kod !== "connector");

  return (
    <>
      {/* HERO */}
      <section className="hero" aria-labelledby="hero-baslik">
        <div className="k">
          <div className="hero-izgara">
            <div>
              <span className="rozet">
                <i>6 ürün</i> Tek altyapı, tek destek ekibi
              </span>
              <h1 id="hero-baslik">
                İşletmenize göre şekillenen <em>yönetim yazılımı</em>
              </h1>
              <p className="giris">
                Kuyumcudan döviz bürosuna, gümüş atölyesinden ticari işletmeye: Likya ürün ailesi GİB e-Belge, e-Banka, POS ve
                terazi entegrasyonuyla birlikte gelir. İster tek ürünle başlayın, ister hepsini Likya.ERP'de birleştirin.
              </p>
              <div className="hero-dugmeler">
                <a href="#demo" className="dugme dugme-altin">
                  Ücretsiz Demo İste <IconArrowRight size={18} aria-hidden="true" />
                </a>
                <a href="#urunler" className="dugme dugme-acik">
                  <IconPlayerPlay size={18} aria-hidden="true" /> Ürünleri Keşfedin
                </a>
              </div>
              <div className="hero-guven">
                <span>
                  <IconCircleCheck size={16} aria-hidden="true" /> GİB e-Belge dahili
                </span>
                <span>
                  <IconCircleCheck size={16} aria-hidden="true" /> Bulut + yerel çalışma
                </span>
                <span>
                  <IconCircleCheck size={16} aria-hidden="true" /> MASAK & 3065 KDV uyumlu
                </span>
              </div>
            </div>

            {/* Ürün ailesi şeması: çatı Likya.ERP, altında sektör ürünleri, en altta Connector katmanı */}
            <div className="ekosistem" aria-label="Likya ürün ailesi">
              <Link to={`/urunler/${erp.slug}`} className="eko-cati">
                <span className="ikon-kutu">
                  <ErpIkon size={24} aria-hidden="true" />
                </span>
                <span>
                  <strong>{erp.ad}</strong>
                  <small>Hepsini tek merkezde birleştiren çatı</small>
                </span>
              </Link>
              {SektorUrunleri.map((u) => {
                const Ikon = u.ikon;
                return (
                  <Link key={u.kod} to={`/urunler/${u.slug}`} className="eko-oge" style={urunStili(u)}>
                    <span className="ikon-kutu">
                      <Ikon size={22} aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{u.ad}</strong>
                      <small>{u.etiket}</small>
                    </span>
                  </Link>
                );
              })}
              <Link to={`/urunler/${connector.slug}`} className="eko-alt">
                <span className="ikon-kutu">
                  <ConnectorIkon size={22} aria-hidden="true" />
                </span>
                <span>
                  <strong>{connector.ad}</strong>
                  <small>GİB · Banka · POS · Terazi · Etiket yazıcı bağlantı katmanı</small>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* RAKAMLAR */}
      <section className="k" style={{ marginTop: -36, position: "relative", zIndex: 2 }} aria-label="Rakamlarla Likya">
        <div className="rakamlar" style={{ boxShadow: "var(--golge-2)" }}>
          {RAKAMLAR.map((r) => (
            <div key={r.etiket}>
              <strong>{r.deger}</strong>
              <span>{r.etiket}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ÜRÜNLER */}
      <section className="bolum" id="urunler" aria-labelledby="urunler-baslik">
        <div className="k">
          <Belir>
            <div className="bolum-bas orta">
              <span className="ust-baslik">Ürün ailesi</span>
              <h2 id="urunler-baslik">Her iş kolu için ayrı ürün, hepsi için tek altyapı</h2>
              <p>
                Sektörünüze özel ürünü seçin; büyüdükçe diğerlerini ekleyin. Tüm Likya ürünleri aynı veritabanını, aynı
                e-Belge ve banka altyapısını kullanır.
              </p>
            </div>
          </Belir>
          <div className="izgara izgara-3">
            {URUNLER.map((u) => (
              <Belir key={u.kod}>
                <UrunKarti urun={u} />
              </Belir>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: 28 }}>
            <Link to="/karsilastir" className="baglanti-ok" style={{ color: "var(--lacivert)" }}>
              Tüm ürünleri özellik özellik karşılaştırın <IconArrowRight size={16} aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>

      {/* SEÇİCİ */}
      <section className="bolum bolum-gri" aria-labelledby="secici-baslik">
        <div className="k">
          <BolumBasligi
            ust="Size hangisi uygun?"
            baslik="İşletmenizi seçin, size uygun Likya'yı gösterelim"
            aciklama="Tek ürünle başlayabilir ya da Likya.ERP ile tüm iş kollarınızı tek çatı altında toplayabilirsiniz."
          />
          <div className="secici">
            <div className="secici-liste" role="tablist" aria-label="İşletme türü">
              {ISLETME_TURLERI.map((t, i) => {
                const Ikon = t.ikon;
                return (
                  <button
                    key={t.ad}
                    type="button"
                    role="tab"
                    id={`secici-${i}`}
                    aria-selected={secili === i}
                    aria-controls="secici-sonuc"
                    onClick={() => setSecili(i)}
                  >
                    <Ikon size={20} aria-hidden="true" /> {t.ad}
                  </button>
                );
              })}
            </div>
            <div className="secici-sonuc" id="secici-sonuc" role="tabpanel" aria-labelledby={`secici-${secili}`}>
              <p>{tur.neden}</p>
              <div className="secici-urunler">
                {tur.oneri.map((kod) => {
                  const u = urunKoduyla(kod);
                  const Ikon = u.ikon;
                  return (
                    <Link key={kod} to={`/urunler/${u.slug}`} className="secici-urun" style={urunStili(u)}>
                      <span className="ikon-kutu">
                        <Ikon size={22} aria-hidden="true" />
                      </span>
                      <span>
                        <strong>{u.ad}</strong>
                        <span>Ürünü incele →</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ORTAK ALTYAPI */}
      <section className="bolum" aria-labelledby="altyapi-baslik">
        <div className="k">
          <div className="bolum-bas">
            <span className="ust-baslik">Ortak altyapı</span>
            <h2 id="altyapi-baslik">Hangi ürünü seçerseniz seçin, bunlar hep dahil</h2>
            <p>Mevzuat, güvenlik ve entegrasyon tarafını biz düşünüyoruz; siz işinize odaklanın.</p>
          </div>
          <div className="izgara izgara-3">
            {ORTAK_ALTYAPI.map((o) => {
              const Ikon = o.ikon;
              return (
                <Belir key={o.baslik} className="kart">
                  <span className="ikon-kutu" style={{ "--u": "#0b1f3a", "--u-acik": "#eef2f7" } as React.CSSProperties}>
                    <Ikon size={22} aria-hidden="true" />
                  </span>
                  <h3>{o.baslik}</h3>
                  <p>{o.metin}</p>
                </Belir>
              );
            })}
          </div>
        </div>
      </section>

      {/* NASIL ÇALIŞIYORUZ */}
      <section className="bolum bolum-koyu" aria-labelledby="adim-baslik">
        <div className="k">
          <BolumBasligi
            ust="Nasıl başlıyoruz?"
            baslik="İlk görüşmeden kullanıma dört adım"
            aciklama="Kurulumu, veri aktarımını ve eğitimi ekibimiz üstlenir."
          />
          <ol className="adimlar" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {ADIMLAR.map((a) => (
              <li key={a.baslik} className="adim">
                <h3>{a.baslik}</h3>
                <p>{a.metin}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* YORUMLAR */}
      <section className="bolum" aria-labelledby="yorum-baslik">
        <div className="k">
          <div className="bolum-bas orta">
            <span className="ust-baslik">Kullanıcılarımız</span>
            <h2 id="yorum-baslik">Likya kullananlar ne diyor?</h2>
          </div>
          <Yorumlar />
        </div>
      </section>

      {/* SSS */}
      <section className="bolum bolum-gri" aria-labelledby="sss-baslik">
        <div className="k">
          <div className="bolum-bas orta">
            <span className="ust-baslik">Sık sorulanlar</span>
            <h2 id="sss-baslik">Aklınıza takılanlar</h2>
          </div>
          <SSS sorular={ANA_SSS} />
        </div>
      </section>

      <CagriBolumu />
    </>
  );
};

export default AnaSayfa;

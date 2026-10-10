import React from "react";
import { Link, useParams } from "react-router-dom";
import { IconArrowRight, IconBrandWhatsapp, IconCheck, IconPlugConnected, IconUserCheck } from "@tabler/icons-react";
import { URUNLER, urunBul } from "../veri/urunler";
import { SIRKET } from "../veri/sirket";
import { useSayfa } from "../yardimci/sayfa";
import { urunStili } from "../bilesenler/UrunStil";
import { TemsiliEkran } from "../bilesenler/TemsiliEkran";
import { Belir, CagriBolumu, SSS, Yorumlar } from "../bilesenler/Ortak";
import { Bulunamadi } from "./Bulunamadi";

/** Altı ürünün ortak sayfa şablonu; içerik veri/urunler.ts'den gelir (K3). */
export const UrunSayfasi: React.FC = () => {
  const { slug } = useParams();
  const urun = urunBul(slug);
  useSayfa(urun ? `${urun.ad} — ${urun.etiket}` : "Sayfa bulunamadı", urun ? urun.kisa : "", `/urunler/${slug ?? ""}`);
  if (!urun) return <Bulunamadi />;

  const Ikon = urun.ikon;
  const digerleri = URUNLER.filter((u) => u.kod !== urun.kod);
  const kuyumMu = urun.kod === "kuyum";

  return (
    <div style={urunStili(urun)}>
      {/* HERO */}
      <section className="urun-hero" aria-labelledby="urun-baslik">
        <div className="k">
          <nav className="yol-izi" aria-label="Konum">
            <Link to="/">Ana sayfa</Link>
            <span aria-hidden="true">/</span>
            <span>Ürünler</span>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{urun.ad}</span>
          </nav>
          <div className="hero-izgara">
            <div>
              <span className="urun-rozet">
                <span className="ikon-kutu">
                  <Ikon size={22} aria-hidden="true" />
                </span>
                {urun.ad}
                <small>{urun.etiket}</small>
              </span>
              <h1 id="urun-baslik">{urun.baslik}</h1>
              <p className="giris">{urun.aciklama}</p>
              <div className="hero-dugmeler">
                <a href="#demo" className="dugme dugme-urun">
                  Demo / Teklif İste <IconArrowRight size={18} aria-hidden="true" />
                </a>
                <a href={SIRKET.whatsapp} target="_blank" rel="noopener noreferrer" className="dugme dugme-cizgi">
                  <IconBrandWhatsapp size={18} aria-hidden="true" /> WhatsApp'tan Sorun
                </a>
              </div>
            </div>
            <TemsiliEkran urun={urun} />
          </div>
        </div>
      </section>

      {/* KİMLER İÇİN */}
      <section className="bolum" style={{ paddingBottom: 48 }} aria-labelledby="kim-baslik">
        <div className="k">
          <div className="bolum-bas">
            <span className="ust-baslik">Kimler için?</span>
            <h2 id="kim-baslik">{urun.ad} bu işletmeler için tasarlandı</h2>
          </div>
          <ul className="kim-icin">
            {urun.kimIcin.map((k) => (
              <li key={k}>
                <IconUserCheck size={20} aria-hidden="true" /> {k}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* RAKAMLAR */}
      <section className="k" aria-label={`${urun.ad} rakamları`}>
        <div className="rakamlar">
          {urun.rakamlar.map((r) => (
            <div key={r.etiket}>
              <strong>{r.deger}</strong>
              <span>{r.etiket}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ÖNE ÇIKANLAR */}
      <section className="bolum" aria-labelledby="ozellik-baslik">
        <div className="k">
          <div className="bolum-bas">
            <span className="ust-baslik">Öne çıkanlar</span>
            <h2 id="ozellik-baslik">İşinizi hızlandıran özellikler</h2>
          </div>
          <div className="izgara izgara-3">
            {urun.oneCikanlar.map((o) => {
              const OIkon = o.ikon;
              return (
                <Belir key={o.baslik} className="kart">
                  <span className="ikon-kutu">
                    <OIkon size={22} aria-hidden="true" />
                  </span>
                  <h3>{o.baslik}</h3>
                  <p>{o.metin}</p>
                </Belir>
              );
            })}
          </div>
        </div>
      </section>

      {/* MODÜLLER */}
      <section className="bolum bolum-gri" aria-labelledby="modul-baslik">
        <div className="k">
          <div className="bolum-bas">
            <span className="ust-baslik">Modüller</span>
            <h2 id="modul-baslik">{urun.ad} içinde neler var?</h2>
          </div>
          <div className={`izgara ${urun.moduller.length > 4 ? "izgara-3" : "izgara-4"}`}>
            {urun.moduller.map((m) => (
              <div key={m.baslik} className="kart modul-kart">
                <h3>{m.baslik}</h3>
                <ul className="tik-liste">
                  {m.maddeler.map((md) => (
                    <li key={md}>
                      <IconCheck size={16} aria-hidden="true" /> {md}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ENTEGRASYONLAR */}
      <section className="bolum" aria-labelledby="entegrasyon-baslik">
        <div className="k">
          <div className="bolum-bas">
            <span className="ust-baslik">Entegrasyonlar</span>
            <h2 id="entegrasyon-baslik">Kullandığınız sistemlerle konuşur</h2>
            <p>
              Bağlantılar Likya.Connector üzerinden kurulur.{" "}
              <Link to="/entegrasyonlar" className="baglanti-ok">
                Tüm entegrasyonlar <IconArrowRight size={16} aria-hidden="true" />
              </Link>
            </p>
          </div>
          <div className="cipler">
            {urun.entegrasyonlar.map((e) => (
              <span key={e} className="cip">
                <IconPlugConnected size={16} aria-hidden="true" /> {e}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* YORUMLAR (yalnız Likya.Kuyum ve çatı ürün) */}
      {(kuyumMu || urun.kod === "erp") && (
        <section className="bolum bolum-gri" aria-labelledby="yorum-baslik">
          <div className="k">
            <div className="bolum-bas orta">
              <span className="ust-baslik">Kullanıcılarımız</span>
              <h2 id="yorum-baslik">Likya kullananlar ne diyor?</h2>
            </div>
            <Yorumlar />
            {kuyumMu && (
              <p style={{ textAlign: "center", marginTop: 28 }}>
                <a href={SIRKET.kuyumSitesi} target="_blank" rel="noopener" className="baglanti-ok">
                  Likya.Kuyum'un kendi sitesi: likyakuyum.com <IconArrowRight size={16} aria-hidden="true" />
                </a>
              </p>
            )}
          </div>
        </section>
      )}

      {/* SSS */}
      <section className="bolum" aria-labelledby="sss-baslik">
        <div className="k">
          <div className="bolum-bas orta">
            <span className="ust-baslik">Sık sorulanlar</span>
            <h2 id="sss-baslik">{urun.ad} hakkında sorular</h2>
          </div>
          <SSS sorular={urun.sss} />
        </div>
      </section>

      {/* DİĞER ÜRÜNLER */}
      <section className="bolum bolum-gri" style={{ paddingTop: 64, paddingBottom: 64 }} aria-labelledby="diger-baslik">
        <div className="k">
          <div className="bolum-bas" style={{ marginBottom: 24 }}>
            <h2 id="diger-baslik" style={{ fontSize: 24 }}>
              Diğer Likya ürünleri
            </h2>
          </div>
          <div className="diger-urunler">
            {digerleri.map((d) => {
              const DIkon = d.ikon;
              return (
                <Link key={d.kod} to={`/urunler/${d.slug}`} className="diger-urun" style={urunStili(d)}>
                  <span className="ikon-kutu">
                    <DIkon size={20} aria-hidden="true" />
                  </span>
                  <strong>{d.ad}</strong>
                  <span>{d.etiket}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <CagriBolumu
        urun={urun.kod}
        baslik={`${urun.ad} için demo isteyin`}
        aciklama="Ürünü kendi iş akışınız üzerinden canlı gösterelim, ihtiyacınıza göre teklif hazırlayalım."
      />
    </div>
  );
};

export default UrunSayfasi;

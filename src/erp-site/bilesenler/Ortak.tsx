import React from "react";
import { Link } from "react-router-dom";
import { IconArrowRight, IconBrandWhatsapp, IconCheck, IconChevronDown, IconMail, IconPhone, IconQuote } from "@tabler/icons-react";
import type { Urun, UrunKodu } from "../veri/urunler";
import { MAIL_LINK, SIRKET, TEL_LINK, YORUMLAR } from "../veri/sirket";
import { IletisimFormu } from "./IletisimFormu";
import { urunStili } from "./UrunStil";

/** Bölüm içi kapsayıcı (içerik her zaman görünür; kaydırma animasyonu bilerek yok). */
export const Belir: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={className}>{children}</div>
);

export const BolumBasligi: React.FC<{ ust?: string; baslik: string; aciklama?: string; orta?: boolean }> = ({
  ust,
  baslik,
  aciklama,
  orta,
}) => (
  <div className={`bolum-bas${orta ? " orta" : ""}`}>
    {ust && <span className="ust-baslik">{ust}</span>}
    <h2>{baslik}</h2>
    {aciklama && <p>{aciklama}</p>}
  </div>
);

export const UrunKarti: React.FC<{ urun: Urun; maddeSayisi?: number }> = ({ urun, maddeSayisi = 3 }) => {
  const Ikon = urun.ikon;
  return (
    <Link to={`/urunler/${urun.slug}`} className="urun-kart" style={urunStili(urun)}>
      <div className="ust-satir">
        <span className="ikon-kutu buyuk">
          <Ikon size={28} aria-hidden="true" />
        </span>
        <span className="etiket">{urun.etiket}</span>
      </div>
      <h3>{urun.ad}</h3>
      <p>{urun.kisa}</p>
      <ul className="maddeler">
        {urun.oneCikanlar.slice(0, maddeSayisi).map((o) => (
          <li key={o.baslik}>
            <IconCheck size={16} aria-hidden="true" /> {o.baslik}
          </li>
        ))}
      </ul>
      <span className="baglanti-ok">
        İncele <IconArrowRight size={16} aria-hidden="true" />
      </span>
    </Link>
  );
};

export const SSS: React.FC<{ sorular: { soru: string; cevap: string }[] }> = ({ sorular }) => (
  <div className="sss">
    {sorular.map((s) => (
      <details key={s.soru}>
        <summary>
          {s.soru}
          <IconChevronDown size={20} aria-hidden="true" />
        </summary>
        <p>{s.cevap}</p>
      </details>
    ))}
  </div>
);

export const Yorumlar: React.FC = () => (
  <div className="izgara izgara-3">
    {YORUMLAR.map((y) => (
      <figure key={y.ad} className="yorum" style={{ margin: 0 }}>
        <IconQuote size={28} className="tirnak" aria-hidden="true" />
        <blockquote>{y.yorum}</blockquote>
        <figcaption className="yorum-kisi">
          <span className="bas-harf" aria-hidden="true">
            {y.ad
              .split(" ")
              .map((p) => p[0])
              .join("")}
          </span>
          <span>
            <strong>{y.ad}</strong>
            <span>
              {y.rol} · {y.firma}
            </span>
          </span>
        </figcaption>
        <div className="yorum-urun">{y.urun}</div>
      </figure>
    ))}
  </div>
);

/** Sayfa sonundaki çağrı bölümü: iletişim satırları + demo formu (K4). */
export const CagriBolumu: React.FC<{ urun?: UrunKodu; baslik?: string; aciklama?: string }> = ({
  urun,
  baslik = "İşletmenize uygun Likya'yı birlikte seçelim",
  aciklama = "Formu doldurun ya da hemen arayın; ihtiyacınızı dinleyip size uygun ürünü ve kurulum planını çıkaralım.",
}) => (
  <section className="bolum bolum-koyu" id="demo" aria-labelledby="cagri-baslik">
    <div className="k">
      <div className="cagri">
        <div className="cagri-sol">
          <span className="ust-baslik">Demo & Teklif</span>
          <h2 id="cagri-baslik">{baslik}</h2>
          <p>{aciklama}</p>
          <div className="iletisim-satirlari">
            <a href={TEL_LINK} className="iletisim-satir">
              <span className="ikon-kutu">
                <IconPhone size={22} aria-hidden="true" />
              </span>
              <span>
                <small>Satış & destek hattı</small>
                <strong>{SIRKET.telefon}</strong>
              </span>
            </a>
            <a href={SIRKET.whatsapp} target="_blank" rel="noopener noreferrer" className="iletisim-satir">
              <span className="ikon-kutu">
                <IconBrandWhatsapp size={22} aria-hidden="true" />
              </span>
              <span>
                <small>WhatsApp'tan yazın</small>
                <strong>Anında yanıt</strong>
              </span>
            </a>
            <a href={MAIL_LINK} className="iletisim-satir">
              <span className="ikon-kutu">
                <IconMail size={22} aria-hidden="true" />
              </span>
              <span>
                <small>E-posta</small>
                <strong>{SIRKET.eposta}</strong>
              </span>
            </a>
          </div>
        </div>
        <div className="form-kutu">
          <h3>Demo / teklif isteyin</h3>
          <p>Ücretsiz tanıtım için bilgilerinizi bırakın, size dönelim.</p>
          <IletisimFormu urun={urun} />
        </div>
      </div>
    </div>
  </section>
);

export const SabitIletisim: React.FC = () => (
  <div className="sabit-iletisim">
    <a href={SIRKET.whatsapp} target="_blank" rel="noopener noreferrer" className="wa" aria-label="WhatsApp'tan yazın">
      <IconBrandWhatsapp size={28} aria-hidden="true" />
    </a>
    <a href={TEL_LINK} className="tel" aria-label={`Arayın: ${SIRKET.telefon}`}>
      <IconPhone size={24} aria-hidden="true" />
    </a>
  </div>
);

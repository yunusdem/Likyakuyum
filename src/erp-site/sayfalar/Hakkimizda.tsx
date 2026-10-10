import React from "react";
import { IconBulb, IconHeadset, IconScale, IconShieldCheck } from "@tabler/icons-react";
import { RAKAMLAR } from "../veri/sirket";
import { useSayfa } from "../yardimci/sayfa";
import { BolumBasligi, CagriBolumu, Yorumlar } from "../bilesenler/Ortak";

const DEGERLER = [
  { ikon: IconScale, baslik: "Sektörü bilerek", metin: "Milyem, hurda, emanet, kur ve MASAK gibi konular standart perakende yazılımlarıyla yönetilemez; ürünlerimizi bu ayrıntılar için yazdık." },
  { ikon: IconShieldCheck, baslik: "Mevzuata uyum", metin: "GİB e-Dönüşüm, 3065 KDV ve MASAK düzenlemelerini yakından izliyor, güncellemeleri kendiliğinden yayıyoruz." },
  { ikon: IconHeadset, baslik: "Yakın destek", metin: "Kurulumdan eğitime, günlük sorulara kadar telefon ve WhatsApp üzerinden yanınızdayız." },
  { ikon: IconBulb, baslik: "Sürekli gelişim", metin: "Kullanıcılarımızdan gelen istekler yol haritamızı belirler; yeni özellikler düzenli olarak eklenir." },
];

export const Hakkimizda: React.FC = () => {
  useSayfa(
    "Hakkımızda",
    "Likya; kuyumcu, sarraf, döviz bürosu ve ticari işletmeler için yönetim yazılımları geliştiren bir teknoloji ekibidir.",
    "/hakkimizda"
  );
  return (
    <>
      <section className="sayfa-bas">
        <div className="k">
          <span className="ust-baslik">Hakkımızda</span>
          <h1>İşletmelerin güvenilir teknoloji ortağı</h1>
          <p>
            Likya, Kapalıçarşı ve Kuyumcukent esnafının ihtiyaçları dinlenerek geliştirilen kuyumculuk yazılımıyla başladı.
            Bugün aynı altyapı; gümüş, döviz ve ticari işletmeler için ayrı ürünlere, çok şubeli gruplar için Likya.ERP'ye
            dönüştü.
          </p>
        </div>
      </section>
      <section className="k" style={{ marginTop: 48 }} aria-label="Rakamlarla Likya">
        <div className="rakamlar">
          {RAKAMLAR.map((r) => (
            <div key={r.etiket}>
              <strong>{r.deger}</strong>
              <span>{r.etiket}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="bolum">
        <div className="k">
          <BolumBasligi ust="Neye önem veriyoruz?" baslik="Uzman mühendislik, sektör bilgisi" />
          <div className="izgara izgara-4">
            {DEGERLER.map((d) => {
              const Ikon = d.ikon;
              return (
                <div key={d.baslik} className="kart">
                  <span className="ikon-kutu" style={{ "--u": "#0b1f3a", "--u-acik": "#eef2f7" } as React.CSSProperties}>
                    <Ikon size={22} aria-hidden="true" />
                  </span>
                  <h3>{d.baslik}</h3>
                  <p>{d.metin}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="bolum bolum-gri">
        <div className="k">
          <BolumBasligi ust="Kullanıcılarımız" baslik="Likya kullananlar ne diyor?" orta />
          <Yorumlar />
        </div>
      </section>
      <CagriBolumu />
    </>
  );
};

export default Hakkimizda;

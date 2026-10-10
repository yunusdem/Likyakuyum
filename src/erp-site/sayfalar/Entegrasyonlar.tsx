import React from "react";
import { Link } from "react-router-dom";
import { IconArrowRight, IconBuildingBank, IconCheck, IconCpu, IconDatabase, IconFileInvoice } from "@tabler/icons-react";
import { urunKoduyla } from "../veri/urunler";
import { useSayfa } from "../yardimci/sayfa";
import { urunStili } from "../bilesenler/UrunStil";
import { Belir, CagriBolumu } from "../bilesenler/Ortak";

const GRUPLAR = [
  {
    ikon: IconFileInvoice,
    baslik: "e-Belge & GİB",
    metin: "Belgeyi kestiğiniz ekrandan gönderin, durumunu aynı yerden izleyin.",
    maddeler: ["e-Fatura", "e-Arşiv Fatura", "e-Döviz belgesi", "3065 KDV özel matrah kodları", "GİB mükellef (VKN) sorgusu", "Gönderim kuyruğu ve otomatik yeniden deneme"],
  },
  {
    ikon: IconBuildingBank,
    baslik: "Banka & Ödeme",
    metin: "Banka hareketleri ve kart tahsilatları cari hesaplarla kendiliğinden eşleşir.",
    maddeler: ["e-Banka: tüm Türk bankalarının hesap hareketleri", "Sanal POS: tek çekim ve taksit", "WhatsApp / SMS ile 3D Secure ödeme linki", "ÖKC / POS cihazları (Inpos, Beko)", "POS komisyon ve vade takibi", "Günlük mutabakat"],
  },
  {
    ikon: IconCpu,
    baslik: "Donanım",
    metin: "Mağazadaki cihazlar küçük bir yerel ajan üzerinden programla konuşur.",
    maddeler: ["Terazi: Dikomsan, Desis, Radwag (RS232 / USB)", "Etiket yazıcı: Zebra, Argox, TSC, Godex", "Barkod okuyucu ve el terminali", "Banknot sayma makinesi", "Smart TV / HDMI fiyat panosu", "Fiş ve A4 yazıcılar"],
  },
  {
    ikon: IconDatabase,
    baslik: "Veri & Paylaşım",
    metin: "Veriniz içeri de dışarı da kolayca taşınır.",
    maddeler: ["Canlı kur ve piyasa akışı", "Excel / CSV / SQL ile veri aktarımı", "Excel ve PDF raporlar", "E-posta ve WhatsApp ile ekstre gönderimi", "Bulut + yerel SQL eşitleme", "Şifreli zamanlanmış yedek"],
  },
];

export const Entegrasyonlar: React.FC = () => {
  useSayfa(
    "Entegrasyonlar",
    "GİB e-Fatura, e-Arşiv, e-Döviz; e-Banka, sanal POS, ÖKC; terazi, etiket yazıcı ve TV panosu entegrasyonları. Likya.Connector ile tek katmanda.",
    "/entegrasyonlar"
  );
  const connector = urunKoduyla("connector");
  return (
    <div style={urunStili(connector)}>
      <section className="sayfa-bas">
        <div className="k">
          <span className="ust-baslik">Entegrasyonlar</span>
          <h1>GİB'den teraziye, bankadan POS cihazına: hepsi bağlı</h1>
          <p>
            Tüm bağlantılar {connector.ad} katmanında toplanır. Bir bağlantı koparsa işlem kuyrukta bekler, bağlantı gelince
            kendiliğinden tamamlanır.
          </p>
          <p style={{ marginTop: 24 }}>
            <Link to={`/urunler/${connector.slug}`} className="dugme dugme-urun">
              {connector.ad}'ı inceleyin <IconArrowRight size={18} aria-hidden="true" />
            </Link>
          </p>
        </div>
      </section>
      <section className="bolum" style={{ paddingTop: 64 }}>
        <div className="k">
          <div className="izgara izgara-2">
            {GRUPLAR.map((g) => {
              const Ikon = g.ikon;
              return (
                <Belir key={g.baslik} className="kart">
                  <span className="ikon-kutu buyuk">
                    <Ikon size={28} aria-hidden="true" />
                  </span>
                  <h3 style={{ fontSize: 21 }}>{g.baslik}</h3>
                  <p style={{ marginBottom: 18 }}>{g.metin}</p>
                  <ul className="tik-liste">
                    {g.maddeler.map((m) => (
                      <li key={m}>
                        <IconCheck size={16} aria-hidden="true" /> {m}
                      </li>
                    ))}
                  </ul>
                </Belir>
              );
            })}
          </div>
        </div>
      </section>
      <CagriBolumu urun="connector" baslik="Bağlamak istediğiniz bir sistem mi var?" aciklama="Kullandığınız cihaz, banka ya da yazılımı yazın; entegrasyon olanaklarını birlikte değerlendirelim." />
    </div>
  );
};

export default Entegrasyonlar;

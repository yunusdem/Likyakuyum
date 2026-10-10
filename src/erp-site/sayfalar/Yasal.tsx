import React from "react";
import { Link } from "react-router-dom";
import { MAIL_LINK, SIRKET, VERI_SORUMLUSU } from "../veri/sirket";
import { useSayfa } from "../yardimci/sayfa";

/**
 * KVKK aydınlatma metni ve gizlilik/çerez bilgisi. Veri sorumlusu adı veri/sirket.ts'den gelir
 * (resmi unvan girilince kendiliğinden güncellenir — docs/LIKYAERP_TANITIM_SITESI.md açık sorular).
 */
const YasalSayfa: React.FC<{ baslik: string; ozet: string; children: React.ReactNode }> = ({ baslik, ozet, children }) => (
  <>
    <section className="sayfa-bas">
      <div className="k">
        <span className="ust-baslik">Yasal</span>
        <h1>{baslik}</h1>
        <p>{ozet}</p>
      </div>
    </section>
    <section className="bolum" style={{ paddingTop: 48 }}>
      <div className="k">
        <article className="metin">{children}</article>
      </div>
    </section>
  </>
);

export const Kvkk: React.FC = () => {
  useSayfa("KVKK Aydınlatma Metni", "Likya ERP web sitesi iletişim formu kapsamında kişisel verilerin işlenmesine ilişkin aydınlatma metni.", "/kvkk");
  return (
    <YasalSayfa baslik="KVKK Aydınlatma Metni" ozet="6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında web sitemiz üzerinden toplanan veriler hakkında bilgilendirme.">
      <h2>Veri sorumlusu</h2>
      <p>
        Bu metin, {VERI_SORUMLUSU} ("Likya") tarafından www.likyaerp.com üzerinden toplanan kişisel veriler için hazırlanmıştır.
        Bize {SIRKET.adres} adresinden, <a href={MAIL_LINK}>{SIRKET.eposta}</a> e-posta adresinden ve {SIRKET.telefon}{" "}
        numarasından ulaşabilirsiniz.
      </p>
      <h2>İşlenen veriler ve amaçlar</h2>
      <p>Demo / teklif formunu doldurduğunuzda aşağıdaki veriler işlenir:</p>
      <ul>
        <li>Kimlik ve iletişim: ad soyad, telefon, e-posta, şehir</li>
        <li>Talep bilgisi: firma adı, ilgilendiğiniz ürün, mesajınız</li>
        <li>İşlem güvenliği: formun gönderildiği IP adresi ve zaman</li>
      </ul>
      <p>
        Bu veriler; talebinize dönüş yapmak, demo ve teklif sürecini yürütmek ve formun kötüye kullanımını önlemek amacıyla
        işlenir.
      </p>
      <h2>Hukuki sebep</h2>
      <p>
        Veriler, KVKK m.5/2-c (sözleşmenin kurulmasıyla doğrudan ilgili olması) ve m.5/2-f (meşru menfaat) hukuki sebeplerine
        dayanılarak, formu doldurmanızla otomatik olmayan yolla toplanır.
      </p>
      <h2>Aktarım ve saklama</h2>
      <p>
        Form içeriği yalnızca e-posta olarak ekibimize iletilir, ayrı bir veritabanında tutulmaz. Kişisel verileriniz üçüncü
        kişilere satılmaz ve pazarlama amacıyla paylaşılmaz; e-posta hizmet sağlayıcımız dışında aktarım yapılmaz. Talebiniz
        sonuçlandıktan sonra makul süre içinde silinir.
      </p>
      <h2>Haklarınız</h2>
      <p>
        KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini ya da silinmesini isteme ve itiraz etme
        haklarına sahipsiniz. Başvurularınızı <a href={MAIL_LINK}>{SIRKET.eposta}</a> adresine iletebilirsiniz.
      </p>
    </YasalSayfa>
  );
};

export const Gizlilik: React.FC = () => {
  useSayfa("Gizlilik ve Çerezler", "Likya ERP web sitesinin gizlilik ve çerez politikası.", "/gizlilik");
  return (
    <YasalSayfa baslik="Gizlilik ve Çerezler" ozet="Web sitemizi ziyaret ettiğinizde hangi bilgilerin nasıl kullanıldığı.">
      <h2>Topladığımız bilgiler</h2>
      <p>
        Siteyi gezerken sizden kişisel bilgi istemeyiz. Yalnızca demo / teklif formunu doldurduğunuzda verdiğiniz bilgiler
        işlenir; ayrıntılar için <Link to="/kvkk">KVKK Aydınlatma Metni</Link>'ne bakın.
      </p>
      <h2>Çerezler</h2>
      <p>
        Site, çalışması için zorunlu olmayan hiçbir çerez kullanmaz. Ziyaret istatistikleri için Google Analytics
        etkinleştirilirse, IP adresi anonimleştirilerek yalnızca toplu kullanım istatistiği tutulur ve bu sayfa
        güncellenir.
      </p>
      <h2>Dış bağlantılar</h2>
      <p>
        WhatsApp ve telefon bağlantıları ilgili uygulamaları açar; bu uygulamaların kendi gizlilik politikaları geçerlidir.
      </p>
      <h2>İletişim</h2>
      <p>
        Gizlilikle ilgili sorularınız için: <a href={MAIL_LINK}>{SIRKET.eposta}</a>
      </p>
    </YasalSayfa>
  );
};

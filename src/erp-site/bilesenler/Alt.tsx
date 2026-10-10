import React from "react";
import { Link } from "react-router-dom";
import { IconBrandWhatsapp, IconMail, IconMapPin, IconPhone } from "@tabler/icons-react";
import { URUNLER } from "../veri/urunler";
import { MAIL_LINK, SIRKET, TEL2_LINK, TEL_LINK } from "../veri/sirket";
import { Logo } from "./Logo";

export const Alt: React.FC = () => (
  <footer className="alt">
    <div className="k">
      <div className="alt-izgara">
        <div>
          <Logo acik />
          <p className="alt-tanim">
            Kuyumcudan döviz bürosuna, ticari işletmeden çok şubeli gruplara: GİB e-Belge, e-Banka, POS ve terazi
            entegrasyonlu, bulut ve yerel çalışan yönetim yazılımları.
          </p>
          <div className="alt-iletisim">
            <a href={TEL_LINK}>
              <IconPhone size={16} aria-hidden="true" /> {SIRKET.telefon}
            </a>
            <a href={TEL2_LINK}>
              <IconPhone size={16} aria-hidden="true" /> {SIRKET.telefon2}
            </a>
            <a href={SIRKET.whatsapp} target="_blank" rel="noopener noreferrer">
              <IconBrandWhatsapp size={16} aria-hidden="true" /> WhatsApp: {SIRKET.telefon}
            </a>
            <a href={MAIL_LINK}>
              <IconMail size={16} aria-hidden="true" /> {SIRKET.eposta}
            </a>
            <span>
              <IconMapPin size={16} aria-hidden="true" /> {SIRKET.adres}
            </span>
          </div>
        </div>
        <div>
          <h4>Ürünler</h4>
          <ul>
            {URUNLER.map((u) => (
              <li key={u.kod}>
                <Link to={`/urunler/${u.slug}`}>{u.ad}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4>Keşfedin</h4>
          <ul>
            <li>
              <Link to="/karsilastir">Ürün karşılaştırma</Link>
            </li>
            <li>
              <Link to="/entegrasyonlar">Entegrasyonlar</Link>
            </li>
            <li>
              <a href={SIRKET.kuyumSitesi} target="_blank" rel="noopener">
                likyakuyum.com
              </a>
            </li>
          </ul>
        </div>
        <div>
          <h4>Kurumsal</h4>
          <ul>
            <li>
              <Link to="/hakkimizda">Hakkımızda</Link>
            </li>
            <li>
              <Link to="/iletisim">İletişim & Demo</Link>
            </li>
            <li>
              <Link to="/kvkk">KVKK Aydınlatma Metni</Link>
            </li>
            <li>
              <Link to="/gizlilik">Gizlilik ve Çerezler</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="alt-cizgi">
        <span>© {new Date().getFullYear()} {SIRKET.marka}. Tüm hakları saklıdır.</span>
        <nav aria-label="Yasal">
          <Link to="/kvkk">KVKK</Link>
          <Link to="/gizlilik">Gizlilik</Link>
        </nav>
      </div>
    </div>
  </footer>
);

export default Alt;

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { IconBrandWhatsapp, IconCheck, IconPhone, IconSend } from "@tabler/icons-react";
import { URUNLER, type UrunKodu } from "../veri/urunler";
import { SIRKET, TEL_LINK } from "../veri/sirket";
import { olayGonder } from "../yardimci/analitik";

/**
 * Demo / teklif formu (K4). likyakuyum.com'daki formla aynı backend uç noktasına gider
 * (POST /api/v1/iletisim/form, kaynak = "likyaerp"); içerik info@likyakuyum.com'a mail olur.
 */
interface Veri {
  adSoyad: string;
  firma: string;
  telefon: string;
  eposta: string;
  sehir: string;
  mesaj: string;
  urun: string;
  web: string;
}

const EMIN_DEGIL = "Henüz emin değilim";

export const IletisimFormu: React.FC<{ urun?: UrunKodu }> = ({ urun }) => {
  const [veri, setVeri] = useState<Veri>({
    adSoyad: "",
    firma: "",
    telefon: "",
    eposta: "",
    sehir: "",
    mesaj: "",
    urun: urun ? URUNLER.find((u) => u.kod === urun)!.ad : "",
    web: "",
  });
  const [durum, setDurum] = useState<"bos" | "gonderiliyor" | "tamam" | "hata">("bos");
  const [mesaj, setMesaj] = useState("");

  const alan = (k: keyof Veri) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setVeri((v) => ({ ...v, [k]: e.target.value }));

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (durum === "gonderiliyor") return;
    setDurum("gonderiliyor");
    const kontrol = new AbortController();
    const zaman = window.setTimeout(() => kontrol.abort(), 40000);
    try {
      const yanit = await fetch("/api/v1/iletisim/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...veri, urun: veri.urun === EMIN_DEGIL ? "" : veri.urun, kaynak: "likyaerp" }),
        signal: kontrol.signal,
      });
      const govde = await yanit.json().catch(() => null);
      if (!yanit.ok) throw new Error(govde?.message || "Form gönderilemedi.");
      setMesaj(govde?.message || "Talebiniz alındı.");
      setDurum("tamam");
      olayGonder("generate_lead", { urun: veri.urun || "belirtilmedi" });
    } catch (err: any) {
      setMesaj(err?.name === "AbortError" ? "Sunucu yanıt vermedi." : err?.message || "Form gönderilemedi.");
      setDurum("hata");
    } finally {
      window.clearTimeout(zaman);
    }
  };

  if (durum === "tamam") {
    return (
      <div className="form-tamam" role="status">
        <span className="ikon-kutu buyuk">
          <IconCheck size={30} aria-hidden="true" />
        </span>
        <h3>Talebiniz alındı</h3>
        <p>{mesaj}</p>
        <div className="dugmeler">
          <a href={TEL_LINK} className="dugme dugme-cizgi dugme-kucuk">
            <IconPhone size={16} aria-hidden="true" /> {SIRKET.telefon}
          </a>
          <a href={SIRKET.whatsapp} target="_blank" rel="noopener noreferrer" className="dugme dugme-wa dugme-kucuk">
            <IconBrandWhatsapp size={16} aria-hidden="true" /> WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={gonder}>
      {/* Honeypot: ekranda görünmez, botlar doldurur */}
      <div className="gizli" aria-hidden="true">
        <label>
          Web
          <input type="text" name="web" tabIndex={-1} autoComplete="off" value={veri.web} onChange={alan("web")} />
        </label>
      </div>

      <div className="form-satir">
        <div className="alan">
          <label htmlFor="f-ad">
            Ad Soyad <span aria-hidden="true">*</span>
          </label>
          <input id="f-ad" required minLength={2} maxLength={100} autoComplete="name" value={veri.adSoyad} onChange={alan("adSoyad")} />
        </div>
        <div className="alan">
          <label htmlFor="f-firma">Firma</label>
          <input id="f-firma" maxLength={150} autoComplete="organization" value={veri.firma} onChange={alan("firma")} />
        </div>
      </div>
      <div className="form-satir">
        <div className="alan">
          <label htmlFor="f-tel">
            Telefon <span aria-hidden="true">*</span>
          </label>
          <input id="f-tel" type="tel" required maxLength={30} autoComplete="tel" placeholder="05XX XXX XX XX" value={veri.telefon} onChange={alan("telefon")} />
        </div>
        <div className="alan">
          <label htmlFor="f-eposta">E-posta</label>
          <input id="f-eposta" type="email" maxLength={150} autoComplete="email" value={veri.eposta} onChange={alan("eposta")} />
        </div>
      </div>
      <div className="form-satir">
        <div className="alan">
          <label htmlFor="f-urun">İlgilendiğiniz ürün</label>
          <select id="f-urun" value={veri.urun} onChange={alan("urun")}>
            <option value="">Seçin</option>
            {URUNLER.map((u) => (
              <option key={u.kod} value={u.ad}>
                {u.ad} — {u.etiket}
              </option>
            ))}
            <option value={EMIN_DEGIL}>{EMIN_DEGIL}</option>
          </select>
        </div>
        <div className="alan">
          <label htmlFor="f-sehir">Şehir</label>
          <input id="f-sehir" maxLength={60} autoComplete="address-level1" value={veri.sehir} onChange={alan("sehir")} />
        </div>
      </div>
      <div className="alan">
        <label htmlFor="f-mesaj">Mesajınız</label>
        <textarea
          id="f-mesaj"
          maxLength={2000}
          placeholder="Kaç şube / kasa kullanacaksınız? Şu an hangi programı kullanıyorsunuz?"
          value={veri.mesaj}
          onChange={alan("mesaj")}
        />
      </div>

      {durum === "hata" && (
        <div className="uyari uyari-hata" role="alert">
          <strong>{mesaj}</strong> Bize doğrudan ulaşın: <a href={TEL_LINK}>{SIRKET.telefon}</a> ·{" "}
          <a href={SIRKET.whatsapp} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </div>
      )}

      <button type="submit" className="dugme dugme-ana" disabled={durum === "gonderiliyor"}>
        {durum === "gonderiliyor" ? (
          <>
            <span className="donuyor" aria-hidden="true" /> Gönderiliyor...
          </>
        ) : (
          <>
            <IconSend size={18} aria-hidden="true" /> Demo / Teklif İste
          </>
        )}
      </button>
      <p className="form-not">
        Bilgileriniz yalnızca sizinle iletişime geçmek için kullanılır. Ayrıntı: <Link to="/kvkk">KVKK Aydınlatma Metni</Link>
      </p>
    </form>
  );
};

export default IletisimFormu;

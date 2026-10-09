import React, { useState } from "react";
import { IconBrandWhatsapp, IconCheck, IconPhone, IconSend } from "@tabler/icons-react";
import { iletisimService, IletisimFormVerisi } from "../../services/iletisimService";
import { ILETISIM, TEL_LINK } from "./iletisimBilgileri";

/**
 * Tanıtım sitesi ön bilgi formu — ana sayfa ve /iletisim sayfasında aynı bileşen (docs/ILETISIM_FORMU_YOL_HARITASI.md İ3, İ4).
 * Gönderim backend'e gider, oradan info@likyakuyum.com'a mail olur. Honeypot alanı (web) gerçek kullanıcıya görünmez.
 */
interface Props {
  kaynak: IletisimFormVerisi["kaynak"];
  /** Düğme rengi / biçimi: ana sayfa yeşil, iletişim sayfası altın */
  renk?: "yesil" | "altin";
  dugmeYazisi?: string;
}

const BOS: IletisimFormVerisi = { adSoyad: "", firma: "", telefon: "", eposta: "", sehir: "", mesaj: "", kaynak: "ana-sayfa", web: "" };

const girdiStil: React.CSSProperties = { height: "44px", borderColor: "#e2e8f0" };

export const IletisimFormu: React.FC<Props> = ({ kaynak, renk = "yesil", dugmeYazisi = "Bilgi Talebi Gönder" }) => {
  const [veri, setVeri] = useState<IletisimFormVerisi>({ ...BOS, kaynak });
  const [durum, setDurum] = useState<"bos" | "gonderiliyor" | "tamam" | "hata">("bos");
  const [mesaj, setMesaj] = useState("");

  const alan = (k: keyof IletisimFormVerisi) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setVeri((v) => ({ ...v, [k]: e.target.value }));

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (durum === "gonderiliyor") return;
    setDurum("gonderiliyor");
    try {
      const sonuc = await iletisimService.formGonder({ ...veri, kaynak });
      setMesaj(sonuc);
      setDurum("tamam");
    } catch (err: any) {
      setMesaj(err?.message || "Form gönderilemedi.");
      setDurum("hata");
    }
  };

  const dugmeStil: React.CSSProperties =
    renk === "altin"
      ? { background: "linear-gradient(135deg, #c88f18 0%, #9e640b 100%)", border: "none" }
      : { backgroundColor: "#3b5d50", border: "none" };

  if (durum === "tamam") {
    return (
      <div className="alert alert-success p-4 rounded-3 text-center mb-0">
        <IconCheck size={40} className="text-success mb-2" />
        <h5 className="fw-bold mb-1">Talebiniz Alındı!</h5>
        <p className="small text-muted mb-3">{mesaj}</p>
        <div className="d-flex justify-content-center gap-2 flex-wrap">
          <a href={TEL_LINK} className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1">
            <IconPhone size={16} /> {ILETISIM.telefon}
          </a>
          <a href={ILETISIM.whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-success d-inline-flex align-items-center gap-1">
            <IconBrandWhatsapp size={16} /> WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={gonder} className="d-flex flex-column gap-3" noValidate={false}>
      {/* Honeypot: ekranda görünmez, botlar doldurur */}
      <div style={{ position: "absolute", left: "-9999px", top: 0, width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
        <label>
          Web
          <input type="text" name="web" tabIndex={-1} autoComplete="off" value={veri.web} onChange={alan("web")} />
        </label>
      </div>

      <div className="row g-2">
        <div className="col-12 col-sm-6">
          <label className="form-label small fw-bold text-secondary mb-1">Adınız Soyadınız *</label>
          <input type="text" required maxLength={100} className="form-control" placeholder="Örn: Ahmet Yılmaz" value={veri.adSoyad} onChange={alan("adSoyad")} style={girdiStil} />
        </div>
        <div className="col-12 col-sm-6">
          <label className="form-label small fw-bold text-secondary mb-1">Firma / Mağaza Adı</label>
          <input type="text" maxLength={150} className="form-control" placeholder="Örn: Yılmaz Kuyumculuk" value={veri.firma} onChange={alan("firma")} style={girdiStil} />
        </div>
      </div>
      <div className="row g-2">
        <div className="col-12 col-sm-6">
          <label className="form-label small fw-bold text-secondary mb-1">Telefon Numaranız *</label>
          <input type="tel" required maxLength={30} className="form-control" placeholder="05XX XXX XX XX" value={veri.telefon} onChange={alan("telefon")} style={girdiStil} />
        </div>
        <div className="col-12 col-sm-6">
          <label className="form-label small fw-bold text-secondary mb-1">E-posta Adresiniz</label>
          <input type="email" maxLength={150} className="form-control" placeholder="ornek@firma.com" value={veri.eposta} onChange={alan("eposta")} style={girdiStil} />
        </div>
      </div>
      <div>
        <label className="form-label small fw-bold text-secondary mb-1">Şehir</label>
        <input type="text" maxLength={60} className="form-control" placeholder="İstanbul" value={veri.sehir} onChange={alan("sehir")} style={girdiStil} />
      </div>
      <div>
        <label className="form-label small fw-bold text-secondary mb-1">Mesajınız / İhtiyaçlarınız</label>
        <textarea rows={3} maxLength={2000} className="form-control" placeholder="Kaç şube / vezne kullanacaksınız? Terazi ve barkod yazıcı durumu..." value={veri.mesaj} onChange={alan("mesaj")} style={{ borderColor: "#e2e8f0" }} />
      </div>

      {durum === "hata" && (
        <div className="alert alert-danger small py-2 px-3 mb-0">
          <div className="fw-bold mb-1">{mesaj}</div>
          <div className="d-flex gap-2 flex-wrap align-items-center">
            <span>Bize ulaşın:</span>
            <a href={TEL_LINK} className="fw-bold text-decoration-none text-danger">{ILETISIM.telefon}</a>
            <span>·</span>
            <a href={ILETISIM.whatsapp} target="_blank" rel="noopener noreferrer" className="fw-bold text-decoration-none text-success">WhatsApp</a>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={durum === "gonderiliyor"}
        className="btn py-2.5 text-white fw-bold d-flex align-items-center justify-content-center gap-2 rounded-3 mt-1 shadow-sm"
        style={dugmeStil}
      >
        {durum === "gonderiliyor" ? (
          <>
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <span>Gönderiliyor...</span>
          </>
        ) : (
          <>
            <IconSend size={18} />
            <span>{dugmeYazisi}</span>
          </>
        )}
      </button>
      <p className="small text-secondary mb-0" style={{ fontSize: "0.78rem" }}>
        Bilgileriniz yalnızca sizinle iletişime geçmek için kullanılır; üçüncü kişilerle paylaşılmaz.
      </p>
    </form>
  );
};

export default IletisimFormu;

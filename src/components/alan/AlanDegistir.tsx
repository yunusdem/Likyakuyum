import React, { useEffect, useState } from "react";
import { Alert, Modal, Spinner } from "react-bootstrap";
import { IconArrowsExchange, IconDatabase } from "@tabler/icons-react";
import { AlanBilgisi, AlanListesi, AuthService } from "../../services/authService";
import { alanKodu } from "../../../Backend/src/utils/alanKodu";
import useMenu from "../../hooks/useMenu";

/**
 * Alan değiştirme ve bulunulan alanın gösterimi. Alan = müşteri noya bağlı veritabanlarından biri (R2026_dvz, A2026_dvz);
 * kodu veritabanı adının "_dvz"siz hali (eski programdaki gibi).
 * - Sol menünün en üstü (ve üst menü stillerinde menü çubuğu): Alan Değiştir düğmesi. Yalnız "Çalışma alanı işlemleri
 *   yetkisi" olan (ya da yönetici) ve birden çok alanı bulunan kullanıcıda çizilir; geçiş şifre sormaz.
 * - Sağ üst: bulunulan alanın rozeti (herkese).
 * - Tarayıcı sekmesi: "R2026 · FİRMA ADI" (alanliBaslik).
 */

const DB_ANAHTARI = "kuyumcu_erp_active_db";

/** Bulunulan alanın kodu (girişte / alan değiştirmede saklanan veritabanı adından); oturum yoksa boş */
export const bulunulanAlanKodu = (): string => {
  try {
    return alanKodu(localStorage.getItem(DB_ANAHTARI));
  } catch {
    return "";
  }
};

/** Tarayıcı sekmesinin başlığı: alan kodu önde ("R2026 · DEMİRTAŞ DÖVİZ") */
export const alanliBaslik = (ad: string | null | undefined): string => {
  const kod = bulunulanAlanKodu();
  const temiz = String(ad || "").trim();
  if (!kod) return temiz;
  return temiz ? `${kod} · ${temiz}` : kod;
};

// Liste oturum başına bir kez sorulur (düğme, rozet ve üst menü paylaşır). Alan değişince sayfa baştan yüklenir;
// çıkış yapıp başka alana girilirse jeton değiştiği için yeniden sorulur.
let onbellek: { jeton: string | null; soz: Promise<AlanListesi> } | null = null;
const alanListesiniGetir = (): Promise<AlanListesi> => {
  const jeton = AuthService.getToken();
  if (!onbellek || onbellek.jeton !== jeton) {
    const soz = AuthService.alanlar().catch(() => {
      onbellek = null; // hata kalıcı olmasın
      return { gecebilir: false, alanlar: [] } as AlanListesi;
    });
    onbellek = { jeton, soz };
  }
  return onbellek.soz;
};

const useAlanListesi = (): AlanListesi | null => {
  const [liste, setListe] = useState<AlanListesi | null>(null);
  useEffect(() => {
    let iptal = false;
    alanListesiniGetir().then((l) => {
      if (!iptal) setListe(l);
    });
    return () => {
      iptal = true;
    };
  }, []);
  return liste;
};

const STIL = `
  .alan-degistir-kutu { padding: 8px 10px 4px; }
  .alan-degistir-dugme {
    width: 100%; display: flex; align-items: center; gap: 8px; padding: 6px 10px;
    border: 1px solid #cbd5e1; border-radius: 8px; background: #ffffff; color: #0f172a;
    font-size: 12.5px; font-weight: 600; line-height: 1.2; cursor: pointer; transition: background-color .15s, border-color .15s;
  }
  .alan-degistir-dugme:hover { background: #f1f5f9; border-color: #94a3b8; }
  .alan-degistir-dugme .alan-degistir-ikon { color: #b45309; flex-shrink: 0; }
  .alan-degistir-kod {
    margin-left: auto; font-weight: 800; font-size: 12px; color: #047857; background: #ecfdf5;
    border: 1px solid #a7f3d0; border-radius: 6px; padding: 0 6px; white-space: nowrap;
  }
  .alan-degistir-dugme.ust { width: 28px; height: 28px; padding: 0; margin: 0 4px; justify-content: center; flex-shrink: 0; }
  .modal-backdrop.alan-degistir-ortu { z-index: 2005; }
  .alan-secim:not(:disabled):hover { background: #f1f5f9 !important; border-color: #94a3b8 !important; }
  @media (min-width: 1200px) {
    html.collapsed #miniSidebar .alan-degistir-kutu { padding: 8px 8px 4px; }
    html.collapsed #miniSidebar .alan-degistir-dugme { justify-content: center; padding: 6px 0; }
    html.collapsed #miniSidebar .alan-degistir-metin { display: none !important; }
  }
`;

/** Alan seçme penceresi: bulunulan alan işaretli, ötekine tıklanınca geçilir ve uygulama yeni alanda baştan açılır */
const AlanDegistirPenceresi: React.FC<{ show: boolean; onHide: () => void; alanlar: AlanBilgisi[] }> = ({ show, onHide, alanlar }) => {
  const [gecilen, setGecilen] = useState<number | null>(null);
  const [hata, setHata] = useState("");

  useEffect(() => {
    if (show) setHata("");
  }, [show]);

  const gec = async (a: AlanBilgisi) => {
    if (a.bulunulan || gecilen !== null) return;
    setHata("");
    setGecilen(a.firmaId);
    try {
      await AuthService.alanDegistir(a.firmaId);
      window.location.assign("/dashboard");
    } catch (err: any) {
      setHata(err?.message || "Alan değiştirilemedi.");
      setGecilen(null);
    }
  };

  return (
    <Modal
      show={show}
      onHide={() => gecilen === null && onHide()}
      centered
      backdrop={gecilen === null ? true : "static"}
      // Sol menü çekmecesi (z-index 1055) ve örtüsünün üstünde
      style={{ zIndex: 2010 }}
      backdropClassName="alan-degistir-ortu"
    >
      <Modal.Header closeButton={gecilen === null}>
        <Modal.Title className="fs-6 d-flex align-items-center gap-2">
          <IconArrowsExchange size={18} className="text-warning" />
          Alan Değiştir
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex flex-column gap-2">
          {alanlar.map((a) => (
            <button
              key={a.firmaId}
              type="button"
              disabled={a.bulunulan || gecilen !== null}
              onClick={() => gec(a)}
              className={`btn alan-secim text-start text-dark border rounded-2 d-flex align-items-center gap-2 px-3 py-2 ${a.bulunulan ? "bg-light" : "bg-white"}`}
              style={{ opacity: 1 }}
            >
              <IconDatabase size={18} className={a.bulunulan ? "text-success" : "text-secondary"} />
              <span className="flex-grow-1" style={{ minWidth: 0 }}>
                <span className="d-block fw-bold">{a.alanKodu}</span>
                {a.unvan && <span className="d-block small text-muted text-truncate">{a.unvan}</span>}
              </span>
              {a.bulunulan ? (
                <span className="badge bg-success-subtle text-success border border-success-subtle">Bulunulan alan</span>
              ) : gecilen === a.firmaId ? (
                <Spinner animation="border" size="sm" />
              ) : (
                <span className="small fw-semibold text-primary">Geç</span>
              )}
            </button>
          ))}
        </div>
        {hata && (
          <Alert variant="danger" className="mt-3 mb-0 py-2 small">
            {hata}
          </Alert>
        )}
        <div className="small text-muted mt-3">Alan değişince açık ekranlar kapanır; kaydedilmemiş bilgiler kaybolur.</div>
      </Modal.Body>
    </Modal>
  );
};

/**
 * Alan Değiştir düğmesi. yerlesim "kenar": sol menünün en üstü (daraltılmış menüde yalnız simge); "ust": üst menü çubuğu.
 * Yetkisiz ya da tek alanlı kullanıcıda hiç çizilmez.
 */
export const AlanDegistirDugmesi: React.FC<{ yerlesim?: "kenar" | "ust" }> = ({ yerlesim = "kenar" }) => {
  const liste = useAlanListesi();
  const [acik, setAcik] = useState(false);
  const { handleCollapsed } = useMenu();
  if (!liste?.gecebilir) return null;
  const kod = liste.alanlar.find((a) => a.bulunulan)?.alanKodu || bulunulanAlanKodu();

  const ac = () => {
    // Dar ekranda sol menü çekmece olarak açık durur ve örtüsü pencerenin önüne geçer: önce çekmece kapanır
    if (window.innerWidth < 1200) handleCollapsed("collapsed");
    setAcik(true);
  };

  const dugme = (
    <button
      type="button"
      className={`alan-degistir-dugme ${yerlesim === "ust" ? "ust" : ""}`}
      onClick={ac}
      title={`Alan Değiştir (bulunulan alan: ${kod})`}
    >
      <IconArrowsExchange size={yerlesim === "ust" ? 15 : 18} strokeWidth={2.2} className="alan-degistir-ikon" />
      {/* Üst menü satırında yer yok (8 ana menü tam sığıyor): orada yalnız simge; bulunulan alan sağ üstteki rozette,
          yazı simgenin üstüne gelince çıkar */}
      {yerlesim !== "ust" && <span className="alan-degistir-metin">Alan Değiştir</span>}
      {yerlesim !== "ust" && <span className="alan-degistir-kod alan-degistir-metin">{kod}</span>}
    </button>
  );

  return (
    <>
      <style>{STIL}</style>
      {yerlesim === "ust" ? dugme : <div className="alan-degistir-kutu flex-shrink-0">{dugme}</div>}
      <AlanDegistirPenceresi show={acik} onHide={() => setAcik(false)} alanlar={liste.alanlar} />
    </>
  );
};

/** Sağ üst: bulunulan alanın rozeti (herkese; üstüne gelince firma ünvanı ve veritabanı adı) */
export const AlanRozeti: React.FC = () => {
  const liste = useAlanListesi();
  const bulunulan = liste?.alanlar.find((a) => a.bulunulan);
  const kod = bulunulan?.alanKodu || bulunulanAlanKodu();
  if (!kod) return null;
  const aciklama = [bulunulan?.unvan, bulunulan?.dbName].filter(Boolean).join(" · ");
  return (
    <span
      className="d-inline-flex align-items-center gap-1 px-2 rounded-2 text-nowrap user-select-none"
      title={`Bulunulan alan: ${kod}${aciklama ? ` (${aciklama})` : ""}`}
      style={{ height: "32px", border: "1px solid #a7f3d0", background: "#ecfdf5", color: "#047857" }}
    >
      <IconDatabase size={15} strokeWidth={2.2} />
      <span className="d-none d-sm-inline" style={{ fontSize: "10.5px", fontWeight: 700, color: "#475569" }}>
        Alan
      </span>
      <span style={{ fontSize: "12px", fontWeight: 800 }}>{kod}</span>
    </span>
  );
};

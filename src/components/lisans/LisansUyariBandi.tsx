import React, { useEffect, useState } from "react";
import { Alert, Button, Modal } from "react-bootstrap";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useAuth } from "../../context/AuthContext";

/** Uyarı eşikleri (K8): 30 gün kala bant, son 7 gün günde bir kez pencere. */
export const BANT_GUN = 30;
export const PENCERE_GUN = 7;
const PENCERE_ANAHTARI = "likya_lisans_uyari_gunu";

export const bugunYerel = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Lisansın bitmesine az kaldığında üstte sarı bant ve son günlerde pencere (bulut ve kurulum). */
const LisansUyariBandi: React.FC = () => {
  const { user } = useAuth();
  const kalan = user?.merkez?.lisansKalanGun;
  const iletisim = user?.merkez?.iletisim;
  const [pencere, setPencere] = useState(false);

  useEffect(() => {
    if (kalan === null || kalan === undefined || kalan < 0 || kalan > PENCERE_GUN) return;
    let gosterildi = "";
    try {
      gosterildi = localStorage.getItem(PENCERE_ANAHTARI) || "";
    } catch {
      gosterildi = "";
    }
    if (gosterildi !== bugunYerel()) setPencere(true);
  }, [kalan]);

  if (kalan === null || kalan === undefined || kalan < 0 || kalan > BANT_GUN) return null;

  const metin = kalan === 0 ? "Lisansınız bugün sona eriyor." : `Lisansınızın bitmesine ${kalan} gün kaldı.`;
  const iletisimMetni = [iletisim?.telefon, iletisim?.eposta].filter(Boolean).join(" · ");

  const kapat = () => {
    try {
      localStorage.setItem(PENCERE_ANAHTARI, bugunYerel());
    } catch {
      /* depolama kapalı olabilir */
    }
    setPencere(false);
  };

  return (
    <>
      <Alert variant="warning" className="d-flex align-items-center gap-2 py-2 mb-2 small">
        <IconAlertTriangle size={18} className="flex-shrink-0" />
        <span>
          {metin} Kesinti yaşamamak için lütfen bizimle iletişime geçin{iletisimMetni ? `: ${iletisimMetni}` : "."}
        </span>
      </Alert>
      <Modal show={pencere} onHide={kapat} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Lisans süreniz bitiyor</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{metin}</p>
          {/* Ayarlardaki açıklama "süre doldu" içindir; burada lisans henüz bitmedi, yalnız iletişim gösterilir */}
          <p className="mb-1">Kesinti yaşamamak için lütfen bizimle iletişime geçin.</p>
          {iletisim?.telefon && <div>Telefon: {iletisim.telefon}</div>}
          {iletisim?.eposta && <div>E-posta: {iletisim.eposta}</div>}
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={kapat}>Tamam</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default LisansUyariBandi;

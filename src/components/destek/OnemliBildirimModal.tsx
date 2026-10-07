import React, { useState } from "react";
import { Button, Modal } from "react-bootstrap";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { DestekService, KonuOzet, zamanYaz } from "../../services/destekService";

interface Props {
  bildirimler: KonuOzet[];
  onKapandi: () => void;
}

/** "Önemli" bildirim girişte pencere olarak açılır; "Okudum" denince bir daha çıkmaz (K8). */
const OnemliBildirimModal: React.FC<Props> = ({ bildirimler, onKapandi }) => {
  const navigate = useNavigate();
  const [sira, setSira] = useState(0);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const b = bildirimler[sira];
  if (!b) return null;

  const okudum = async (git = false) => {
    setKaydediliyor(true);
    try {
      await DestekService.onemliOkundu(b.konuId);
    } catch {
      /* bir sonraki açılışta yeniden sorulur */
    } finally {
      setKaydediliyor(false);
    }
    if (git) {
      onKapandi();
      navigate(`/destek?konu=${b.konuId}`);
      return;
    }
    if (sira + 1 < bildirimler.length) setSira(sira + 1);
    else onKapandi();
  };

  return (
    <Modal show centered backdrop="static" keyboard={false}>
      <Modal.Header>
        <Modal.Title as="h6" className="d-flex align-items-center gap-2">
          <IconAlertTriangle size={20} className="text-danger" />
          {b.baslik}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div style={{ whiteSpace: "pre-wrap" }}>{b.sonMesaj}</div>
        <div className="small text-secondary mt-3">
          {zamanYaz(b.gonderimTarihi || b.olusturmaTarihi)}
          {bildirimler.length > 1 && ` · ${sira + 1} / ${bildirimler.length}`}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={() => okudum(true)} disabled={kaydediliyor}>
          Ayrıntı
        </Button>
        <Button variant="primary" onClick={() => okudum(false)} disabled={kaydediliyor}>
          Okudum
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default OnemliBildirimModal;

import React, { useCallback, useEffect, useState } from "react";
import SimpleBar from "simplebar-react";
import { Button, Nav, Offcanvas, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { IconChecks, IconCloudOff, IconPlus } from "@tabler/icons-react";
import Flex from "./Flex";
import KonuListesi from "../destek/KonuListesi";
import { DestekService, KonuOzet, KullaniciSekmesi } from "../../services/destekService";

interface NotificationProps {
  isOpen: boolean;
  onClose: () => void;
  onTalepOlustur: () => void;
  cevrimdisi?: boolean;
}

const SEKMELER: { key: KullaniciSekmesi; ad: string }[] = [
  { key: "tumu", ad: "Tümü" },
  { key: "talepler", ad: "Taleplerim" },
  { key: "bildirimler", ad: "Bildirimler" },
  { key: "arsiv", ad: "Arşiv" },
];

/** Zilin sağ paneli (K11): sekmeli liste, Talep Oluştur, tümünü okundu, Tümünü Gör → /destek. */
const NoficationList: React.FC<NotificationProps> = ({ isOpen, onClose, onTalepOlustur, cevrimdisi }) => {
  const navigate = useNavigate();
  const [sekme, setSekme] = useState<KullaniciSekmesi>("tumu");
  const [konular, setKonular] = useState<KonuOzet[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const s = await DestekService.konular(sekme);
      setKonular(s.konular);
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Liste okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [sekme]);

  useEffect(() => {
    if (isOpen) yukle();
  }, [isOpen, yukle]);

  const ac = (k: KonuOzet) => {
    onClose();
    navigate(`/destek?konu=${k.konuId}`);
  };

  const tumunuOkundu = async () => {
    try {
      await DestekService.okundu(null);
      await yukle();
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    }
  };

  return (
    <Offcanvas placement="end" show={isOpen} onHide={onClose}>
      <div className="sticky-top bg-white">
        <Offcanvas.Header className="gap-4 pb-2" closeButton>
          <Flex justifyContent="between" className="w-100 align-items-center">
            <h5 className="mb-0" id="offcanvasNotificationLabel">
              Destek
            </h5>
            <Flex alignItems="center" className="gap-2">
              <Button variant="primary" size="sm" onClick={onTalepOlustur}>
                <IconPlus size={16} className="me-1" />
                Talep Oluştur
              </Button>
              <Button variant="ghost" size="sm" className="text-primary p-1" title="Tümünü okundu işaretle" onClick={tumunuOkundu}>
                <IconChecks size={22} strokeWidth={1.5} />
              </Button>
            </Flex>
          </Flex>
        </Offcanvas.Header>
        <Nav className="nav-line-bottom px-3" activeKey={sekme} onSelect={(k) => k && setSekme(k as KullaniciSekmesi)}>
          {SEKMELER.map((s) => (
            <Nav.Item key={s.key}>
              <Nav.Link role="button" eventKey={s.key}>
                {s.ad}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>
      </div>

      {cevrimdisi && (
        <div className="small text-warning px-3 py-2 d-flex align-items-center gap-1 border-bottom">
          <IconCloudOff size={14} /> Merkeze ulaşılamıyor; yazdıklarınız bağlanınca gönderilir.
        </div>
      )}

      <SimpleBar style={{ maxHeight: "calc(100vh - 170px)" }}>
        {hata && <div className="text-danger small px-3 py-2">{hata}</div>}
        {yukleniyor && konular.length === 0 ? (
          <div className="text-center py-5">
            <Spinner size="sm" />
          </div>
        ) : (
          <KonuListesi konular={konular} onSec={ac} bosMetin={sekme === "talepler" ? "Henüz talebiniz yok." : "Bildirim yok."} />
        )}
      </SimpleBar>

      <div className="px-5 py-3 text-center bg-white position-absolute bottom-0 border-top border-dashed w-100">
        <Button
          variant="link"
          className="text-inherit p-0"
          onClick={() => {
            onClose();
            navigate("/destek");
          }}
        >
          Tümünü Gör
        </Button>
      </div>
    </Offcanvas>
  );
};

export default NoficationList;

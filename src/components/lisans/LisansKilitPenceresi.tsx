import React, { useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { IconLock, IconPhone, IconMail, IconCopy } from "@tabler/icons-react";
import { SistemService } from "../../services/sistemService";
import type { LisansIletisim } from "../../services/userService";

export interface LisansKilitBilgisi {
  baslik?: string;
  mesaj: string;
  neden?: string | null;
  iletisim?: LisansIletisim | null;
  /** Yalnız kurulum (exe): makine kimliği ve "Lisans Yükle" alanı gösterilir */
  makineKimligi?: string | null;
}

interface Props {
  bilgi: LisansKilitBilgisi | null;
  /** Kurulumda kilit kapatılamaz; bulutta (giriş reddi) kapatılabilir */
  kapat?: () => void;
  /** Lisans yüklenince (kurulum) */
  yuklendi?: () => void;
}

const BASLIK: Record<string, string> = {
  LISANS_YOK: "Lisans yüklenmemiş",
  LISANS_DOLDU: "Lisans süreniz doldu",
  LISANS_BITTI: "Lisans süreniz doldu",
  SAAT_GERI_ALINDI: "Program kilitlendi",
  DURUM_BOZUK: "Program kilitlendi",
  MAKINE_UYUSMUYOR: "Lisans bu bilgisayara ait değil",
};

/** Lisans kilidi / süresi doldu penceresi: neden + iletişim; kurulumda makine kimliği ve Lisans Yükle (K8, K16, K17, K18). */
const LisansKilitPenceresi: React.FC<Props> = ({ bilgi, kapat, yuklendi }) => {
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);

  if (!bilgi) return null;
  const kurulum = !!bilgi.makineKimligi;
  const i = bilgi.iletisim;
  // Ayarlardaki açıklama "süre doldu" içindir; başka kilit nedenlerinde nötr cümle gösterilir
  const sureDoldu = bilgi.neden === "LISANS_DOLDU" || bilgi.neden === "LISANS_BITTI";
  const aciklama = sureDoldu ? i?.metin : "Lütfen bizimle iletişime geçin.";

  const yukle = async () => {
    setHata(null);
    setBekliyor(true);
    try {
      const d = await SistemService.lisansYukle(kod.trim());
      if (d.durum === "KILITLI") {
        setHata(d.mesaj || "Lisans yüklendi ancak program hâlâ kilitli.");
        return;
      }
      setKod("");
      yuklendi?.();
    } catch (e: any) {
      setHata(e?.message || "Lisans yüklenemedi.");
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <Modal show onHide={() => kapat?.()} backdrop="static" keyboard={!!kapat} centered>
      <Modal.Header closeButton={!!kapat}>
        <Modal.Title as="h5" className="d-flex align-items-center gap-2">
          <IconLock size={20} />
          {bilgi.baslik || (bilgi.neden && BASLIK[bilgi.neden]) || "Program kilitli"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-3">{bilgi.mesaj}</p>
        {(aciklama || i?.telefon || i?.eposta) && (
          <Alert variant="warning" className="mb-3">
            {aciklama && <div className="mb-1">{aciklama}</div>}
            {i?.telefon && (
              <div className="d-flex align-items-center gap-2">
                <IconPhone size={16} /> <a href={`tel:${i.telefon.replace(/\s+/g, "")}`}>{i.telefon}</a>
              </div>
            )}
            {i?.eposta && (
              <div className="d-flex align-items-center gap-2">
                <IconMail size={16} /> <a href={`mailto:${i.eposta}`}>{i.eposta}</a>
              </div>
            )}
          </Alert>
        )}
        {kurulum && (
          <>
            <Form.Label className="small text-muted mb-1">Bu bilgisayarın kimliği (lisans için bize iletin)</Form.Label>
            <div className="d-flex align-items-center gap-2 mb-3">
              <code className="fs-5">{bilgi.makineKimligi}</code>
              <Button
                size="sm"
                variant="outline-secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(bilgi.makineKimligi || "");
                    setKopyalandi(true);
                  } catch {
                    setKopyalandi(false);
                  }
                }}
              >
                <IconCopy size={14} className="me-1" />
                {kopyalandi ? "Kopyalandı" : "Kopyala"}
              </Button>
            </div>
            <Form.Group controlId="lisansKodu">
              <Form.Label>Lisans Yükle</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                value={kod}
                onChange={(e) => setKod(e.target.value)}
                placeholder="Size gönderilen LKY1. ile başlayan lisans kodunu buraya yapıştırın"
                spellCheck={false}
              />
            </Form.Group>
            {hata && (
              <Alert variant="danger" className="mt-3 mb-0">
                {hata}
              </Alert>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {kurulum && (
          <Button variant="primary" disabled={bekliyor || kod.trim().length < 20} onClick={yukle}>
            {bekliyor ? <Spinner animation="border" size="sm" /> : "Lisansı Yükle"}
          </Button>
        )}
        {kapat && (
          <Button variant="outline-secondary" onClick={kapat}>
            Kapat
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default LisansKilitPenceresi;

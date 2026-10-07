import React, { useState } from "react";
import { Alert, Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import { useLocation } from "react-router-dom";
import { DestekService, KonuDetay, Oncelik, TALEP_TURU_ADI, TalepTuru, dosyayiBase64Yap } from "../../services/destekService";
import GorselSecici, { SecilenGorsel } from "./GorselSecici";

interface Props {
  show: boolean;
  onHide: () => void;
  onAcildi: (detay: KonuDetay) => void;
}

/** Talep Oluştur (K1, K4): başlık, tür, öncelik, açıklama, görseller; açıldığı ekran otomatik. */
const TalepOlusturModal: React.FC<Props> = ({ show, onHide, onAcildi }) => {
  const konum = useLocation();
  const [baslik, setBaslik] = useState("");
  const [talepTuru, setTalepTuru] = useState<TalepTuru>("SORU");
  const [oncelik, setOncelik] = useState<Oncelik>("NORMAL");
  const [metin, setMetin] = useState("");
  const [gorseller, setGorseller] = useState<SecilenGorsel[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const temizle = () => {
    setBaslik("");
    setTalepTuru("SORU");
    setOncelik("NORMAL");
    setMetin("");
    gorseller.forEach((g) => URL.revokeObjectURL(g.onizleme));
    setGorseller([]);
    setHata(null);
  };

  const kapat = () => {
    if (gonderiliyor) return;
    temizle();
    onHide();
  };

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baslik.trim()) return setHata("Başlık girilmelidir.");
    if (!metin.trim()) return setHata("Açıklama girilmelidir.");
    setGonderiliyor(true);
    setHata(null);
    try {
      const ekler = await Promise.all(gorseller.map((g) => dosyayiBase64Yap(g.dosya)));
      const detay = await DestekService.talepAc({ baslik: baslik.trim(), metin: metin.trim(), talepTuru, oncelik, ekran: konum.pathname, ekler });
      temizle();
      onAcildi(detay);
    } catch (err: any) {
      setHata(err?.message || "Talep oluşturulamadı.");
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <Modal show={show} onHide={kapat} centered backdrop="static">
      <Form onSubmit={gonder}>
        <Modal.Header closeButton>
          <Modal.Title as="h6">Talep Oluştur</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {hata && (
            <Alert variant="danger" className="py-2 small">
              {hata}
            </Alert>
          )}
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold">Başlık</Form.Label>
            <Form.Control autoFocus maxLength={200} value={baslik} onChange={(e) => setBaslik(e.target.value)} placeholder="Kısaca sorun ya da istek" />
          </Form.Group>
          <Row>
            <Col xs={6}>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">Tür</Form.Label>
                <Form.Select value={talepTuru} onChange={(e) => setTalepTuru(e.target.value as TalepTuru)}>
                  {(Object.keys(TALEP_TURU_ADI) as TalepTuru[]).map((t) => (
                    <option key={t} value={t}>
                      {TALEP_TURU_ADI[t]}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={6}>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">Öncelik</Form.Label>
                <Form.Select value={oncelik} onChange={(e) => setOncelik(e.target.value as Oncelik)}>
                  <option value="NORMAL">Normal</option>
                  <option value="ACIL">Acil</option>
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold">Açıklama</Form.Label>
            <Form.Control as="textarea" rows={5} maxLength={4000} value={metin} onChange={(e) => setMetin(e.target.value)} placeholder="Ne oldu, hangi ekranda, ne bekliyordunuz?" />
            <div className="text-end small text-secondary">{metin.length} / 4000</div>
          </Form.Group>
          <GorselSecici secilenler={gorseller} onDegis={setGorseller} onHata={setHata} />
          <div className="small text-secondary mt-2">Ekran: {konum.pathname}</div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={kapat} disabled={gonderiliyor}>
            Vazgeç
          </Button>
          <Button type="submit" variant="primary" disabled={gonderiliyor}>
            {gonderiliyor ? <Spinner size="sm" className="me-1" /> : null}
            Gönder
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default TalepOlusturModal;

import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { IconPlus } from "@tabler/icons-react";
import { HizliCevap, panelApi } from "../services/panelApi";

const BOS = { cevapId: null as number | null, baslik: "", metin: "", sira: 0, aktif: true };

/** Destek admini > Hızlı Cevaplar (D16): personel sohbette tek tıkla ekler. Silme yok, pasife alınır. */
const HizliCevaplarPage: React.FC = () => {
  const [liste, setListe] = useState<HizliCevap[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [form, setForm] = useState<typeof BOS | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setListe(await panelApi.hizliCevaplar(true));
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Liste okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const kaydet = async (veri = form) => {
    if (!veri) return;
    setKaydediliyor(true);
    setHata(null);
    try {
      setListe(await panelApi.hizliCevapYaz(veri));
      setForm(null);
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div>
            <h5 className="mb-0">Hızlı Cevaplar</h5>
            <small className="text-muted">Personel sohbet ekranında "Hızlı cevap" düğmesinden ekler; metin gönderilmeden önce düzenlenebilir.</small>
          </div>
          <Button size="sm" className="btn-adm" onClick={() => setForm({ ...BOS, sira: (liste[liste.length - 1]?.sira ?? 0) + 10 })}>
            <IconPlus size={16} className="me-1" />
            Yeni
          </Button>
        </div>
        {hata && !form && <Alert variant="danger">{hata}</Alert>}
        {yukleniyor && liste.length === 0 ? (
          <div className="text-center py-5">
            <Spinner animation="border" size="sm" />
          </div>
        ) : (
          <Table hover size="sm" className="align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Sıra</th>
                <th style={{ width: 220 }}>Başlık</th>
                <th>Metin</th>
                <th style={{ width: 90 }}>Durum</th>
                <th style={{ width: 150 }} />
              </tr>
            </thead>
            <tbody>
              {liste.map((c) => (
                <tr key={c.cevapId} className={c.aktif ? "" : "text-muted"}>
                  <td>{c.sira}</td>
                  <td>{c.baslik}</td>
                  <td className="small" style={{ whiteSpace: "pre-wrap" }}>
                    {c.metin.length > 220 ? `${c.metin.slice(0, 220)}…` : c.metin}
                  </td>
                  <td>
                    <Badge bg={c.aktif ? "success" : "secondary"} className="fw-normal">
                      {c.aktif ? "Aktif" : "Pasif"}
                    </Badge>
                  </td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="link" className="p-0 me-2" onClick={() => setForm({ ...c })}>
                      Düzenle
                    </Button>
                    <Button size="sm" variant="link" className="p-0" onClick={() => kaydet({ ...c, aktif: !c.aktif })}>
                      {c.aktif ? "Pasife al" : "Aktif et"}
                    </Button>
                  </td>
                </tr>
              ))}
              {liste.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    Henüz hızlı cevap yok.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </Card.Body>

      <Modal show={!!form} onHide={() => setForm(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title as="h5">{form?.cevapId ? "Hızlı cevabı düzenle" : "Yeni hızlı cevap"}</Modal.Title>
        </Modal.Header>
        {form && (
          <Modal.Body>
            {hata && <Alert variant="danger">{hata}</Alert>}
            <div className="d-flex gap-3 mb-3">
              <Form.Group className="flex-grow-1">
                <Form.Label>Başlık</Form.Label>
                <Form.Control value={form.baslik} maxLength={100} onChange={(e) => setForm({ ...form, baslik: e.target.value })} autoFocus />
              </Form.Group>
              <Form.Group style={{ width: 110 }}>
                <Form.Label>Sıra</Form.Label>
                <Form.Control type="number" min={0} max={9999} value={form.sira} onChange={(e) => setForm({ ...form, sira: Number(e.target.value) || 0 })} />
              </Form.Group>
            </div>
            <Form.Group className="mb-3">
              <Form.Label>Metin</Form.Label>
              <Form.Control as="textarea" rows={6} maxLength={4000} value={form.metin} onChange={(e) => setForm({ ...form, metin: e.target.value })} />
            </Form.Group>
            <Form.Check type="switch" id="hc-aktif" label="Aktif" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setForm(null)}>
            Vazgeç
          </Button>
          <Button className="btn-adm" onClick={() => kaydet()} disabled={kaydediliyor || !form?.baslik.trim() || !form?.metin.trim()}>
            {kaydediliyor ? <Spinner size="sm" /> : "Kaydet"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default HizliCevaplarPage;

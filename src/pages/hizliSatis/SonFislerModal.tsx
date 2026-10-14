import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { HizliSatisFisi, HizliSatisService } from "../../services/hizliSatisService";
import { HizliSatisModul, MODUL_ADI } from "../../../Backend/src/services/hizliSatis/hizliSatisKural";

/** Hızlı satıştan kaydedilen fişler (H20); satıra tıklanınca modülün düzeltme ekranı açılır (iade/iptal oradan, H19) */
const DUZELTME: Record<HizliSatisModul, string> = {
  perakende: "/vezne/perakende-fisi-duzeltme",
  ticari: "/ticari/satis-fisi-duzeltme",
  sarraf: "/vezne/sarraf-fisi-duzeltme",
  doviz: "/vezne/doviz-fisi-duzeltme",
};

const para = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const saat = (z: string) => {
  const d = new Date(z);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export const SonFislerModal: React.FC<{ modul: HizliSatisModul; acik: boolean; kapat: () => void }> = ({ modul, acik, kapat }) => {
  const navigate = useNavigate();
  const [gun, setGun] = useState(1);
  const [liste, setListe] = useState<HizliSatisFisi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (!acik) return;
    setYukleniyor(true);
    setHata(null);
    HizliSatisService.fisler(modul, gun)
      .then(setListe)
      .catch((e) => setHata(e?.message || "Fişler alınamadı."))
      .finally(() => setYukleniyor(false));
  }, [acik, modul, gun]);

  const alisSatis = modul === "sarraf" || modul === "doviz";
  const toplam = liste.reduce((a, f) => a + (f.tip === 0 ? -f.tutar : f.tutar), 0);
  return (
    <Modal show={acik} onHide={kapat} size="lg" centered>
      <Modal.Header closeButton className="py-2">
        <Modal.Title className="fs-6">{MODUL_ADI[modul]} — hızlı satış fişleri</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-2">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Form.Select size="sm" style={{ width: 160 }} value={gun} onChange={(e) => setGun(Number(e.target.value))} aria-label="Dönem">
            <option value={1}>Bugün</option>
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
          </Form.Select>
          <span className="small text-muted ms-auto">{liste.length} fiş{liste.length ? ` · ${para(toplam)} TL` : ""}</span>
        </div>
        {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          <Table size="sm" hover className="align-middle mb-0">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary"><th>Zaman</th><th>Fiş No</th>{alisSatis && <th>Tür</th>}<th>Müşteri</th><th className="text-end">Tutar</th><th>Kasiyer</th></tr>
            </thead>
            <tbody>
              {yukleniyor ? (
                <tr><td colSpan={6} className="text-center py-4"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
              ) : !liste.length ? (
                <tr><td colSpan={6} className="text-center text-muted py-4">Bu dönemde hızlı satış fişi yok.</td></tr>
              ) : liste.map((f) => (
                <tr key={f.fisId} role="button" title="Düzeltme ekranında aç" onClick={() => { kapat(); navigate(`${DUZELTME[modul]}?id=${f.fisId}`); }}>
                  <td className="small text-nowrap">{saat(f.zaman)}</td>
                  <td className="font-monospace fw-semibold text-primary">{f.fisNo}</td>
                  {alisSatis && <td>{f.tip === 1 ? <Badge bg="danger">Satış</Badge> : <Badge bg="success">Alış</Badge>}</td>}
                  <td className="text-truncate" style={{ maxWidth: 220 }}>{f.unvan}</td>
                  <td className="text-end fw-semibold">{para(f.tutar)}</td>
                  <td className="small text-muted">{f.kullanici || ""}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
      <Modal.Footer className="py-1"><Button variant="secondary" size="sm" onClick={kapat}>Kapat</Button></Modal.Footer>
    </Modal>
  );
};

export default SonFislerModal;

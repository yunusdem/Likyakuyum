import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import { IconAlertTriangle, IconPlayerPlay, IconTrash } from "@tabler/icons-react";
import { BekleyenSepet, HizliSatisService } from "../../services/hizliSatisService";
import type { HizliSatisModul } from "../../../Backend/src/services/hizliSatis/hizliSatisKural";

/** Beklemeye alma (isteğe bağlı not) ve bekleyen sepetler listesi (H25–H28) */
const para = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const zamanYaz = (z: string) => {
  const d = new Date(z);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export const BekletModal: React.FC<{ acik: boolean; ozet: string; kapat: () => void; onay: (not: string) => void; bekliyor: boolean }> = ({ acik, ozet, kapat, onay, bekliyor }) => {
  const [not, setNot] = useState("");
  useEffect(() => { if (acik) setNot(""); }, [acik]);
  return (
    <Modal show={acik} onHide={kapat} centered>
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6">Sepeti beklemeye al</Modal.Title></Modal.Header>
      <Modal.Body>
        <div className="small text-muted mb-2">{ozet}</div>
        <Form.Label className="small mb-0">Not (isteğe bağlı)</Form.Label>
        <Form.Control autoFocus maxLength={200} value={not} placeholder="ör. Ayşe Hanım, akşam gelecek" onChange={(e) => setNot(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !bekliyor) onay(not); }} />
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button variant="secondary" onClick={kapat}>Vazgeç</Button>
        <Button variant="warning" disabled={bekliyor} onClick={() => onay(not)}>{bekliyor ? <Spinner size="sm" className="me-1" /> : null}Beklemeye Al</Button>
      </Modal.Footer>
    </Modal>
  );
};

interface ListeProps {
  acik: boolean;
  modul: HizliSatisModul;
  vezneId: number | null;
  yonetici: boolean;
  kapat: () => void;
  ac: (b: BekleyenSepet) => void;
  /** Liste değişince (silme) sayacı tazelemek için */
  degisti: () => void;
}

export const BekleyenlerModal: React.FC<ListeProps> = ({ acik, modul, vezneId, yonetici, kapat, ac, degisti }) => {
  const [liste, setListe] = useState<BekleyenSepet[] | null>(null);
  const [tumu, setTumu] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = () => {
    setListe(null);
    setHata(null);
    HizliSatisService.bekleyenler(modul, vezneId, tumu).then(setListe).catch((e) => { setListe([]); setHata(e?.message || "Bekleyen sepetler alınamadı."); });
  };
  useEffect(() => { if (acik) yukle(); }, [acik, modul, vezneId, tumu]); // eslint-disable-line react-hooks/exhaustive-deps

  const sil = async (b: BekleyenSepet) => {
    if (!window.confirm(`${b.musteri || "Bekleyen sepet"} (${para(b.toplam)} TL) silinsin mi?`)) return;
    try {
      await HizliSatisService.bekleyenSil(b.bekleyenId, vezneId);
      degisti();
      yukle();
    } catch (e: any) {
      setHata(e?.message || "Silinemedi.");
    }
  };

  const alisVar = modul === "perakende" || modul === "sarraf" || modul === "doviz";
  return (
    <Modal show={acik} onHide={kapat} size="lg" centered>
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6">Bekleyen sepetler</Modal.Title></Modal.Header>
      <Modal.Body className="p-2">
        {yonetici && (
          <Form.Check type="switch" id="bekleyen-tumu" className="mb-2 small" label="Bütün vezneler" checked={tumu} onChange={(e) => setTumu(e.target.checked)} />
        )}
        {hata && <Alert variant="danger" className="py-1 px-2 small">{hata}</Alert>}
        <div style={{ maxHeight: 440, overflowY: "auto" }}>
          <Table size="sm" hover className="align-middle mb-0">
            <thead className="table-light sticky-top">
              <tr className="small text-secondary"><th>Zaman</th>{alisVar && <th>Tür</th>}<th>Müşteri / not</th><th className="text-center">Kalem</th><th className="text-end">Tutar</th><th>Kasiyer</th><th style={{ width: 120 }}></th></tr>
            </thead>
            <tbody>
              {liste === null ? (
                <tr><td colSpan={7} className="text-center py-4"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
              ) : !liste.length ? (
                <tr><td colSpan={7} className="text-center text-muted py-4">Bekleyen sepet yok.</td></tr>
              ) : liste.map((b) => (
                <tr key={b.bekleyenId} className={b.eski ? "text-muted" : ""} style={{ height: 46 }}>
                  <td className="small text-nowrap">
                    {zamanYaz(b.zaman)}
                    {b.eski && <Badge bg="warning" text="dark" className="ms-1" title="7 günden eski"><IconAlertTriangle size={12} /> eski</Badge>}
                  </td>
                  {alisVar && <td>{b.tip === 1 ? <Badge bg="danger">Satış</Badge> : <Badge bg="success">Alış</Badge>}</td>}
                  <td>
                    <div className="fw-semibold text-truncate" style={{ maxWidth: 220 }}>{b.musteri || "Nihai tüketici"}</div>
                    {b.aciklama && <div className="small text-truncate" style={{ maxWidth: 220 }}>{b.aciklama}</div>}
                  </td>
                  <td className="text-center">{b.kalem}</td>
                  <td className="text-end fw-semibold">{para(b.toplam)}</td>
                  <td className="small">{b.kullaniciAdi || ""}</td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="primary" className="me-1" onClick={() => ac(b)}><IconPlayerPlay size={14} className="me-1" />Aç</Button>
                    <Button size="sm" variant="outline-danger" title="Sil" onClick={() => void sil(b)}><IconTrash size={14} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <div className="small text-muted mt-2">Açılan sepette altın, ziynet ve döviz fiyatları güncel kurdan yenilenir; elle verilen fiyat korunur.</div>
      </Modal.Body>
    </Modal>
  );
};

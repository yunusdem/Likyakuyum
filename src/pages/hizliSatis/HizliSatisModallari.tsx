import React, { useEffect, useState } from "react";
import { Button, ButtonGroup, Form, ListGroup, Modal } from "react-bootstrap";
import { girisEkle, girisSayi } from "./TusTakimi";
import { SERBEST_KDV_ORANLARI } from "../../../Backend/src/services/hizliSatis/hizliSatisKural";

/** Dokunmatik ekranda sayı sorma (gram, fiyat, indirim): kendi tuş takımı + klavye */
export interface SayiSorusu {
  baslik: string;
  aciklama?: string;
  birim?: string;
  ilk?: number | null;
  /** İndirimde % / tutar seçimi */
  yuzdeSecimi?: boolean;
  onay: (deger: number, yuzde: boolean) => void;
}

export const SayiSorModal: React.FC<{ soru: SayiSorusu | null; kapat: () => void }> = ({ soru, kapat }) => {
  const [g, setG] = useState("");
  const [yuzde, setYuzde] = useState(false);
  useEffect(() => {
    setG(soru?.ilk ? String(soru.ilk).replace(".", ",") : "");
    setYuzde(false);
  }, [soru]);
  if (!soru) return null;
  const n = girisSayi(g);
  const tamam = () => {
    if (n === null || !(n > 0)) return;
    soru.onay(n, yuzde);
    kapat();
  };
  const tus = (t: string) => (
    <button key={t} type="button" className="btn btn-light border fw-bold" style={{ height: 52, fontSize: 20 }} onClick={() => setG((x) => girisEkle(x, t))}>{t}</button>
  );
  return (
    <Modal show onHide={kapat} centered size="sm">
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6">{soru.baslik}</Modal.Title></Modal.Header>
      <Modal.Body>
        {soru.aciklama && <div className="small text-muted mb-2">{soru.aciklama}</div>}
        {soru.yuzdeSecimi && (
          <ButtonGroup className="w-100 mb-2">
            <Button variant={yuzde ? "outline-primary" : "primary"} onClick={() => setYuzde(false)}>Tutar (TL)</Button>
            <Button variant={yuzde ? "primary" : "outline-primary"} onClick={() => setYuzde(true)}>Yüzde (%)</Button>
          </ButtonGroup>
        )}
        <Form.Control autoFocus inputMode="decimal" className="text-end fw-bold mb-2" style={{ fontSize: 24 }} value={g}
          onChange={(e) => setG(e.target.value.replace(/[^\d,]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") tamam(); }}
          aria-label={soru.baslik} />
        {soru.birim && <div className="text-end small text-muted mb-2">{yuzde ? "%" : soru.birim}</div>}
        <div className="d-grid gap-1" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ",", "00"].map(tus)}
        </div>
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button variant="outline-secondary" onClick={() => setG((x) => x.slice(0, -1))}>Sil</Button>
        <Button variant="secondary" onClick={kapat}>Vazgeç</Button>
        <Button variant="primary" disabled={n === null || !(n > 0)} onClick={tamam}>Tamam</Button>
      </Modal.Footer>
    </Modal>
  );
};

/** Serbest ürün (H9): ad + KDV dahil fiyat + KDV oranı; stoktan düşmez */
export const SerbestUrunModal: React.FC<{ acik: boolean; kapat: () => void; onay: (ad: string, fiyat: number, kdv: number) => void }> = ({ acik, kapat, onay }) => {
  const [ad, setAd] = useState("");
  const [fiyat, setFiyat] = useState("");
  const [kdv, setKdv] = useState(20);
  useEffect(() => {
    if (acik) { setAd(""); setFiyat(""); setKdv(20); }
  }, [acik]);
  const n = girisSayi(fiyat);
  const gecerli = ad.trim().length > 0 && n !== null && n > 0;
  return (
    <Modal show={acik} onHide={kapat} centered>
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6">Serbest ürün</Modal.Title></Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-2">
          <Form.Label className="small mb-0">Ürün adı</Form.Label>
          <Form.Control autoFocus maxLength={100} value={ad} onChange={(e) => setAd(e.target.value)} />
        </Form.Group>
        <div className="d-flex gap-2">
          <Form.Group className="flex-grow-1">
            <Form.Label className="small mb-0">Fiyat (KDV dahil)</Form.Label>
            <Form.Control inputMode="decimal" value={fiyat} onChange={(e) => setFiyat(e.target.value.replace(/[^\d,]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter" && gecerli) { onay(ad.trim(), n!, kdv); kapat(); } }} />
          </Form.Group>
          <Form.Group style={{ width: 110 }}>
            <Form.Label className="small mb-0">KDV %</Form.Label>
            <Form.Select value={kdv} onChange={(e) => setKdv(Number(e.target.value))}>
              {SERBEST_KDV_ORANLARI.map((k) => <option key={k} value={k}>{k}</option>)}
            </Form.Select>
          </Form.Group>
        </div>
        <div className="small text-muted mt-2">Serbest ürün stoktan düşmez.</div>
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button variant="secondary" onClick={kapat}>Vazgeç</Button>
        <Button variant="primary" disabled={!gecerli} onClick={() => { onay(ad.trim(), n!, kdv); kapat(); }}>Ekle</Button>
      </Modal.Footer>
    </Modal>
  );
};

/** POS cihazı / banka hesabı seçimi */
export interface SecimSorusu<T> {
  baslik: string;
  secenekler: { anahtar: string; ad: string; alt?: string; deger: T }[];
  onay: (d: T) => void;
}

export function SecimModal<T>({ soru, kapat }: { soru: SecimSorusu<T> | null; kapat: () => void }) {
  if (!soru) return null;
  return (
    <Modal show onHide={kapat} centered>
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6">{soru.baslik}</Modal.Title></Modal.Header>
      <Modal.Body className="p-2">
        {!soru.secenekler.length && <div className="text-muted small p-2">Tanımlı kayıt yok.</div>}
        <ListGroup>
          {soru.secenekler.map((s) => (
            <ListGroup.Item key={s.anahtar} action className="py-3" onClick={() => { soru.onay(s.deger); kapat(); }}>
              <div className="fw-semibold">{s.ad}</div>
              {s.alt && <div className="small text-muted">{s.alt}</div>}
            </ListGroup.Item>
          ))}
        </ListGroup>
      </Modal.Body>
    </Modal>
  );
}

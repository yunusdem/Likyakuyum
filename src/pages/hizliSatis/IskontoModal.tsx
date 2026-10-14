import React, { useEffect, useState } from "react";
import { Alert, Button, ButtonGroup, Form, ListGroup, Modal, Spinner } from "react-bootstrap";
import { IskontoItem, IskontoService } from "../../services/iskontoService";
import { IndirimGirdisi, indirimTutari } from "../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import { girisSayi } from "./TusTakimi";

/**
 * Hızlı satış iskontosu (14.10.2026): İskonto Tanımları'ndaki aktif iskontolar herkese açık; elle yüzde / tutar yalnız
 * "Hızlı Satış – Fiyat/İndirim" yetkisinde. Tanımın en çok iskonto ve en az fiş tutarı sınırları uygulanır.
 */
const para = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const tanimAciklamasi = (i: IskontoItem): string => {
  const t = Number(i.iskontoTipi);
  const parca = [
    t === 1 ? `%${Number(i.oran) || 0}` : t === 2 ? `${para(Number(i.tutar) || 0)} TL` : t === 3 ? `${Number(i.hasTutar) || 0} gr has` : "tutar sorulur",
    Number(i.maxIskontoTutari) > 0 ? `en çok ${para(Number(i.maxIskontoTutari))} TL` : "",
    Number(i.minTutar) > 0 ? `en az ${para(Number(i.minTutar))} TL fişte` : "",
  ];
  return parca.filter(Boolean).join(" · ");
};

/** Tanımlı iskontodan sepet iskontosu. Serbest (tipsiz) tanımda tutar verilmeli. */
export function tanimdanIndirim(i: IskontoItem, hasKuru: number, serbestTutar?: number | null): IndirimGirdisi | null {
  const t = Number(i.iskontoTipi);
  const ortak = { iskontoId: i.iskontoId, kod: (i.kod || `ISK-${i.iskontoId}`).trim(), ad: i.tanim, azami: Number(i.maxIskontoTutari) || null, enAz: Number(i.minTutar) || null };
  if (t === 1) return Number(i.oran) > 0 ? { ...ortak, turu: 1, deger: Number(i.oran) } : null;
  if (t === 2) return Number(i.tutar) > 0 ? { ...ortak, turu: 2, deger: Number(i.tutar) } : null;
  if (t === 3) return Number(i.hasTutar) > 0 && hasKuru > 0 ? { ...ortak, turu: 2, deger: Math.round(Number(i.hasTutar) * hasKuru * 100) / 100 } : null;
  return serbestTutar && serbestTutar > 0 ? { ...ortak, turu: 2, deger: serbestTutar } : null;
}

interface Props {
  acik: boolean;
  /** İskontodan önceki fiş toplamı */
  brut: number;
  hasKuru: number;
  fiyatYetkisi: boolean;
  /** Elle iskonto bu modülde yazılabilir mi */
  elleVar: boolean;
  mevcut: IndirimGirdisi | null;
  kapat: () => void;
  onay: (i: IndirimGirdisi | null) => void;
}

export const IskontoModal: React.FC<Props> = ({ acik, brut, hasKuru, fiyatYetkisi, elleVar, mevcut, kapat, onay }) => {
  const [liste, setListe] = useState<IskontoItem[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [serbest, setSerbest] = useState<IskontoItem | null>(null);
  const [g, setG] = useState("");
  const [yuzde, setYuzde] = useState(false);

  useEffect(() => {
    if (!acik) return;
    setHata(null);
    setSerbest(null);
    setG("");
    setYuzde(false);
    IskontoService.getIskontolar({ aktif: true })
      .then((l) => setListe((l || []).filter((x) => x.aktif !== false)))
      .catch((e) => { setListe([]); setHata(e?.message || "İskonto tanımları alınamadı."); });
  }, [acik]);

  const sec = (i: IskontoItem) => {
    if (Number(i.minTutar) > 0 && brut < Number(i.minTutar)) return setHata(`"${i.tanim}" en az ${para(Number(i.minTutar))} TL'lik fişte uygulanır.`);
    if (Number(i.iskontoTipi) === 3 && !(hasKuru > 0)) return setHata("Has altın kuru yok; has gram iskontosu hesaplanamaz.");
    if (![1, 2, 3].includes(Number(i.iskontoTipi))) { setSerbest(i); setG(""); return; }
    const ind = tanimdanIndirim(i, hasKuru);
    if (!ind) return setHata(`"${i.tanim}" tanımında oran / tutar yok.`);
    onay(ind);
  };

  const n = girisSayi(g);
  const elleUygula = () => {
    if (n === null || !(n > 0)) return;
    if (serbest) {
      const ind = tanimdanIndirim(serbest, hasKuru, n);
      if (ind) onay(ind);
      return;
    }
    if (yuzde && n > 100) return setHata("Yüzde 100'den büyük olamaz.");
    onay({ turu: yuzde ? 1 : 2, deger: n });
  };

  return (
    <Modal show={acik} onHide={kapat} centered>
      <Modal.Header closeButton className="py-2">
        <Modal.Title className="fs-6">İskonto — fiş {para(brut)} TL</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-2">
        {hata && <Alert variant="danger" className="py-1 px-2 small">{hata}</Alert>}
        {mevcut && (
          <Alert variant="info" className="py-1 px-2 small d-flex justify-content-between align-items-center">
            <span>Uygulanan: {mevcut.ad || (mevcut.turu === 1 ? `%${mevcut.deger}` : `${para(mevcut.deger)} TL`)} → {para(indirimTutari(brut, mevcut))} TL</span>
            <Button size="sm" variant="outline-danger" className="py-0" onClick={() => onay(null)}>Kaldır</Button>
          </Alert>
        )}
        {liste === null ? (
          <div className="text-center py-3"><Spinner size="sm" className="me-2" />Yükleniyor...</div>
        ) : !liste.length ? (
          <div className="small text-muted p-2">Ayarlar › İskonto Tanımları'nda aktif iskonto yok.</div>
        ) : (
          <ListGroup className="mb-2" style={{ maxHeight: 300, overflowY: "auto" }}>
            {liste.map((i) => (
              <ListGroup.Item key={i.iskontoId} action active={serbest?.iskontoId === i.iskontoId} className="py-2" onClick={() => sec(i)}>
                <div className="fw-semibold">{i.tanim}{i.kod ? <span className="small text-muted ms-1">{i.kod}</span> : null}</div>
                <div className="small">{tanimAciklamasi(i)}</div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
        {(serbest || (elleVar && fiyatYetkisi)) && (
          <div className="border-top pt-2">
            <div className="small fw-semibold mb-1">{serbest ? `"${serbest.tanim}" — tutar` : "Elle iskonto"}</div>
            {!serbest && (
              <ButtonGroup size="sm" className="mb-2">
                <Button variant={yuzde ? "outline-primary" : "primary"} onClick={() => setYuzde(false)}>Tutar (TL)</Button>
                <Button variant={yuzde ? "primary" : "outline-primary"} onClick={() => setYuzde(true)}>Yüzde (%)</Button>
              </ButtonGroup>
            )}
            <div className="d-flex gap-2">
              <Form.Control autoFocus={!!serbest} inputMode="decimal" className="text-end fw-bold" value={g} aria-label="İskonto değeri"
                onChange={(e) => setG(e.target.value.replace(/[^\d,]/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") elleUygula(); }} />
              <Button variant="primary" disabled={n === null || !(n > 0)} onClick={elleUygula}>Uygula</Button>
            </div>
          </div>
        )}
        {!serbest && elleVar && !fiyatYetkisi && <div className="small text-muted mt-2">Elle iskonto için "Hızlı Satış – Fiyat/İndirim" yetkisi gerekir.</div>}
      </Modal.Body>
    </Modal>
  );
};

export default IskontoModal;

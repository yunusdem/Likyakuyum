import React, { useState } from "react";
import { Alert, Badge, Button, Form, Modal, Spinner } from "react-bootstrap";
import { adminApi, FirmaDto, LisansDto, tarihYaz } from "../services/adminApi";

interface Props {
  firma: FirmaDto;
  lisans: LisansDto;
  degisti: () => void;
}

const MAKINE = /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

/**
 * Kurulum (exe) firmasının lisans satırı: makine kimliğiyle imzalı kod üret, kodu göster/kopyala, iptal et.
 * Müşteri kodu programdaki "Lisans Yükle" alanına yapıştırır; internet varsa kod programa kendiliğinden de iner.
 */
const LisansKoduIslemleri: React.FC<Props> = ({ firma, lisans, degisti }) => {
  const [acik, setAcik] = useState<"uret" | "goster" | null>(null);
  const [makine, setMakine] = useState(firma.makineKimligi || "");
  const [kod, setKod] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);

  const ac = (tur: "uret" | "goster") => {
    setHata(null);
    setKopyalandi(false);
    setKod(tur === "goster" ? lisans.lisansKodu : null);
    setMakine(firma.makineKimligi || lisans.makineKimligi || "");
    setAcik(tur);
  };

  const uret = async () => {
    setBekliyor(true);
    setHata(null);
    try {
      const r = await adminApi.lisansKoduUret(firma.firmaId, lisans.lisansId, makine.trim().toUpperCase());
      setKod(r.kod);
      setAcik("goster");
      degisti();
    } catch (e: any) {
      setHata(e?.message || "Kod üretilemedi.");
    } finally {
      setBekliyor(false);
    }
  };

  const iptal = async () => {
    if (!window.confirm("Bu lisans iptal edilsin mi? İptal edilen lisansın kodu programa bir daha indirilmez.")) return;
    try {
      await adminApi.lisansIptal(firma.firmaId, lisans.lisansId);
      degisti();
    } catch (e: any) {
      window.alert(e?.message || "İptal edilemedi.");
    }
  };

  return (
    <>
      <div className="d-flex flex-wrap gap-1 align-items-center">
        {lisans.iptal ? (
          <Badge bg="danger">İptal</Badge>
        ) : (
          <>
            {lisans.aktif && (
              <Button size="sm" className="btn-adm" onClick={() => ac("uret")}>
                {lisans.lisansKodu ? "Yeni Kod" : "Kod Üret"}
              </Button>
            )}
            {lisans.lisansKodu && (
              <Button size="sm" variant="outline-secondary" onClick={() => ac("goster")}>
                Kodu Göster
              </Button>
            )}
            {lisans.lisansKodu && (
              <Button size="sm" variant="outline-danger" onClick={iptal}>
                İptal
              </Button>
            )}
          </>
        )}
        {lisans.makineKimligi && <span className="small text-muted ms-1">{lisans.makineKimligi}</span>}
        {lisans.teslim === "HEARTBEAT" && (
          <Badge bg="success" className="ms-1" title={lisans.teslimTarihi ? tarihYaz(lisans.teslimTarihi) : ""}>
            Programa indi
          </Badge>
        )}
      </div>

      <Modal show={!!acik} onHide={() => setAcik(null)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title as="h5">{acik === "uret" ? "Lisans kodu üret" : "Lisans kodu"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {hata && <Alert variant="danger">{hata}</Alert>}
          {acik === "uret" ? (
            <>
              <p className="small text-muted">
                Bitiş {lisans.bitis}, kullanıcı limiti {lisans.kullaniciLimiti}. Kod yalnız aşağıdaki makine kimliğine sahip
                bilgisayarda çalışır. Müşteri bu kimliği programın kilit ekranında görür; internet varsa firma sayfasına da
                kendiliğinden düşer.
              </p>
              <Form.Group controlId="makineKimligi">
                <Form.Label>Makine kimliği</Form.Label>
                <Form.Control
                  value={makine}
                  onChange={(e) => setMakine(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  maxLength={19}
                  isInvalid={makine.length > 0 && !MAKINE.test(makine)}
                  style={{ fontFamily: "monospace" }}
                />
              </Form.Group>
            </>
          ) : (
            <>
              <p className="small text-muted mb-2">
                Bu kodu müşteriye iletin; programdaki "Lisans Yükle" alanına yapıştırılır. Seri: {lisans.seriNo ?? "-"}
              </p>
              <Form.Control as="textarea" rows={6} readOnly value={kod || ""} style={{ fontFamily: "monospace", fontSize: 12 }} />
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          {acik === "uret" ? (
            <Button className="btn-adm" disabled={bekliyor || !MAKINE.test(makine)} onClick={uret}>
              {bekliyor ? <Spinner animation="border" size="sm" /> : "Kodu Üret"}
            </Button>
          ) : (
            <Button
              variant="outline-secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(kod || "");
                  setKopyalandi(true);
                } catch {
                  setKopyalandi(false);
                }
              }}
            >
              {kopyalandi ? "Kopyalandı" : "Kopyala"}
            </Button>
          )}
          <Button variant="outline-secondary" onClick={() => setAcik(null)}>
            Kapat
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default LisansKoduIslemleri;

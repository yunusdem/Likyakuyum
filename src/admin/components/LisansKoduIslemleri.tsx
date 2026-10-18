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
 * Kurulum (exe) firmasının lisans satırı: aktivasyon anahtarı üret (varsayılan; müşteri programa yazar, makine merkezde
 * kendiliğinden bağlanır), internetsiz kurulum için makine kimliğiyle imzalı kod üret, kodu göster/kopyala, iptal et.
 * docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md 16.
 */
const LisansKoduIslemleri: React.FC<Props> = ({ firma, lisans, degisti }) => {
  const [acik, setAcik] = useState<"uret" | "goster" | null>(null);
  const [makine, setMakine] = useState(firma.makineKimligi || "");
  const [kod, setKod] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [internetsiz, setInternetsiz] = useState(false);
  const [anahtarSatiri, setAnahtarSatiri] = useState<LisansDto | null>(null);
  const [anahtarKopyalandi, setAnahtarKopyalandi] = useState(false);
  // Üretilen anahtar liste yenilenmeden de görünsün
  const l = anahtarSatiri && anahtarSatiri.lisansId === lisans.lisansId ? anahtarSatiri : lisans;

  const ac = (tur: "uret" | "goster") => {
    setHata(null);
    setKopyalandi(false);
    setAnahtarKopyalandi(false);
    setAnahtarSatiri(null);
    setInternetsiz(false);
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

  const anahtarUret = async () => {
    if (l.aktivasyonAnahtari && !window.confirm("Yeni anahtar üretilsin mi? Eski anahtar geçersiz olur (kullanılmış bilgisayardaki lisans bitişe kadar çalışmaya devam eder).")) return;
    setBekliyor(true);
    setHata(null);
    setAnahtarKopyalandi(false);
    try {
      setAnahtarSatiri(await adminApi.aktivasyonAnahtariUret(firma.firmaId, lisans.lisansId));
      degisti();
    } catch (e: any) {
      setHata(e?.message || "Anahtar üretilemedi.");
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
        {lisans.kodGuncel === false && (
          <Badge
            bg="warning"
            text="dark"
            className="ms-1"
            title="Modül, ürün, kullanıcı limiti ya da iletişim bilgisi kod üretildikten sonra değişti. İnternetli kurulumda yeni kod kendiliğinden iner; internetsizse Yeni Kod üretip müşteriye iletin."
          >
            Kod güncel değil
          </Badge>
        )}
        {lisans.teslim === "HEARTBEAT" && (
          <Badge bg="success" className="ms-1" title={lisans.teslimTarihi ? tarihYaz(lisans.teslimTarihi) : ""}>
            Programa indi
          </Badge>
        )}
      </div>

      <Modal show={!!acik} onHide={() => setAcik(null)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title as="h5">{acik === "uret" ? "Lisansı etkinleştir" : "Lisans kodu"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {hata && <Alert variant="danger">{hata}</Alert>}
          {acik === "uret" ? (
            <>
              <p className="small text-muted">
                Bitiş {lisans.bitis}, kullanıcı limiti {lisans.kullaniciLimiti}. Müşteri aktivasyon anahtarını programın kilit
                ekranındaki "Lisans Yükle" alanına yazar; program internetten bağlanır ve lisans o bilgisayara kendiliğinden
                kilitlenir. Anahtar tek bilgisayarda kullanılabilir.
              </p>
              <Form.Label>Aktivasyon anahtarı</Form.Label>
              {l.aktivasyonAnahtari ? (
                <>
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <code className="fs-5">{l.aktivasyonAnahtari}</code>
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(l.aktivasyonAnahtari || "");
                          setAnahtarKopyalandi(true);
                        } catch {
                          setAnahtarKopyalandi(false);
                        }
                      }}
                    >
                      {anahtarKopyalandi ? "Kopyalandı" : "Kopyala"}
                    </Button>
                  </div>
                  <div className="small mt-1">
                    {l.aktivasyonTarihi ? (
                      <span className="text-success">
                        Kullanıldı: {tarihYaz(l.aktivasyonTarihi)} · {l.aktivasyonMakine}
                      </span>
                    ) : (
                      <span className="text-muted">Henüz kullanılmadı.</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="small text-muted">Bu lisansa henüz anahtar üretilmedi.</div>
              )}
              <Button className="btn-adm mt-2" size="sm" disabled={bekliyor} onClick={anahtarUret}>
                {bekliyor && !internetsiz ? <Spinner animation="border" size="sm" /> : l.aktivasyonAnahtari ? "Yeni Anahtar Üret" : "Anahtar Üret"}
              </Button>

              <hr />
              {!internetsiz ? (
                <Button variant="link" size="sm" className="p-0" onClick={() => setInternetsiz(true)}>
                  İnternetsiz kurulum: makine kimliğiyle kod üret
                </Button>
              ) : (
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
                  <Form.Text muted>Müşteri bu kimliği programın kilit ekranında görür; internet varsa firma sayfasına da kendiliğinden düşer.</Form.Text>
                </Form.Group>
              )}
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
            internetsiz && (
              <Button className="btn-adm" disabled={bekliyor || !MAKINE.test(makine)} onClick={uret}>
                {bekliyor ? <Spinner animation="border" size="sm" /> : "Kodu Üret"}
              </Button>
            )
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

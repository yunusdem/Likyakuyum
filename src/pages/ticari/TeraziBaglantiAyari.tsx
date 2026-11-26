import React, { useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { IconDeviceFloppy, IconPlugConnected, IconScale } from "@tabler/icons-react";
import { useToast } from "../../context/ToastContext";
import { TeraziBaglantiAyari as Ayar, teraziAyariDenetle } from "../../../Backend/src/services/ticari/teraziProtokol";
import { teraziAyariOku, teraziAyariYaz, teraziOku, teraziPortuSec, webSerialVarMi } from "../../services/teraziService";

/**
 * Stok Ayarları › Bu bilgisayardaki terazi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA4). Ayar tarayıcıda saklanır (terazi hangi
 * kasaya takılıysa orada yapılır). Tarayıcı yolu Chrome / Edge'in Web Serial özelliği; değilse yazdırma ajanı COM porttan okur.
 */
const BAUDLAR = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200];

export const TeraziBaglantiAyari: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [a, setA] = useState<Ayar>(() => teraziAyariOku());
  const [test, setTest] = useState<{ calisiyor: boolean; sonuc: string | null; tamam: boolean }>({ calisiyor: false, sonuc: null, tamam: false });
  const degistir = (d: Partial<Ayar>) => setA((x) => ({ ...x, ...d }));
  const hata = teraziAyariDenetle(a);
  const serial = webSerialVarMi();

  const kaydet = () => {
    if (hata) return showError(hata);
    teraziAyariYaz(a);
    showSuccess(a.yol === "yok" ? "Bu bilgisayarda terazi kapatıldı." : "Terazi ayarı bu bilgisayara kaydedildi.");
  };
  const portSec = async () => {
    try {
      const y = await teraziPortuSec(a);
      setA(y);
      showSuccess("Terazi portu seçildi. Kaydetmeyi unutmayın.");
    } catch (e: any) {
      if (e?.name !== "NotFoundError") showError(e?.message || "Port seçilemedi.");
    }
  };
  const dene = async () => {
    setTest({ calisiyor: true, sonuc: null, tamam: false });
    try {
      const r = await teraziOku(a);
      const hamGorunum = r.ham.replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/[\x00-\x1f]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`);
      const ozet = r.hata ? r.hata : `${(r.kg as number).toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 4 })} kg${r.kararli ? "" : " (sabit değil)"}`;
      setTest({ calisiyor: false, sonuc: `${ozet} — ham yanıt: "${hamGorunum.slice(0, 80)}"`, tamam: !r.hata && r.kararli });
    } catch (e: any) {
      setTest({ calisiyor: false, sonuc: e?.message || "Terazi okunamadı.", tamam: false });
    }
  };

  return (
    <Card className="border shadow-xs h-100">
      <Card.Header className="bg-light py-2 fw-bold small d-flex align-items-center gap-1"><IconScale size={16} />Bu bilgisayardaki terazi</Card.Header>
      <Card.Body className="p-2">
        <div className="small text-muted mb-2 px-1">
          Kasaya USB / seri kabloyla bağlı terazi. Ayar yalnız <b>bu bilgisayarda</b> geçerlidir; tartı penceresinde "Teraziden oku" çıkar.
        </div>
        <Row className="g-2 small">
          <Col md={12}>
            <Form.Label className="mb-1 fw-semibold">Bağlantı</Form.Label>
            <div className="d-flex flex-wrap gap-3">
              <Form.Check type="radio" id="tz-yok" name="tz-yol" label="Terazi yok" checked={a.yol === "yok"} onChange={() => degistir({ yol: "yok" })} />
              <Form.Check type="radio" id="tz-tarayici" name="tz-yol" checked={a.yol === "tarayici"} onChange={() => degistir({ yol: "tarayici" })}
                label={<>Tarayıcı (USB/seri) {serial ? <Badge bg="success">destekleniyor</Badge> : <Badge bg="secondary">bu tarayıcıda yok</Badge>}</>} />
              <Form.Check type="radio" id="tz-ajan" name="tz-yol" label="Yazdırma ajanı (COM port)" checked={a.yol === "ajan"} onChange={() => degistir({ yol: "ajan" })} />
            </div>
          </Col>
          {a.yol !== "yok" && (
            <>
              <Col xs={6} md={3}>
                <Form.Label className="mb-1">Baud</Form.Label>
                <Form.Select size="sm" value={a.baud} onChange={(e) => degistir({ baud: Number(e.target.value) })}>{BAUDLAR.map((b) => <option key={b} value={b}>{b}</option>)}</Form.Select>
              </Col>
              <Col xs={6} md={3}>
                <Form.Label className="mb-1">Veri biti</Form.Label>
                <Form.Select size="sm" value={a.veriBit} onChange={(e) => degistir({ veriBit: Number(e.target.value) as 7 | 8 })}><option value={8}>8</option><option value={7}>7</option></Form.Select>
              </Col>
              <Col xs={6} md={3}>
                <Form.Label className="mb-1">Parite</Form.Label>
                <Form.Select size="sm" value={a.parite} onChange={(e) => degistir({ parite: e.target.value as Ayar["parite"] })}><option value="none">Yok</option><option value="even">Çift</option><option value="odd">Tek</option></Form.Select>
              </Col>
              <Col xs={6} md={3}>
                <Form.Label className="mb-1">Dur biti</Form.Label>
                <Form.Select size="sm" value={a.durBit} onChange={(e) => degistir({ durBit: Number(e.target.value) as 1 | 2 })}><option value={1}>1</option><option value={2}>2</option></Form.Select>
              </Col>
              <Col md={6}>
                <Form.Label className="mb-1">Okuma şekli</Form.Label>
                <Form.Select size="sm" value={a.protokol} onChange={(e) => degistir({ protokol: e.target.value as Ayar["protokol"] })}>
                  <option value="istek">İstekle ("W" gönderilir — CAS / ECR)</option>
                  <option value="surekli">Terazi sürekli gönderiyor</option>
                </Form.Select>
              </Col>
              <Col md={6}>
                {a.yol === "ajan" ? (
                  <>
                    <Form.Label className="mb-1">COM port</Form.Label>
                    <Form.Control size="sm" value={a.ajanPort} maxLength={6} onChange={(e) => degistir({ ajanPort: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="COM3" />
                  </>
                ) : (
                  <>
                    <Form.Label className="mb-1">Port</Form.Label>
                    <div className="d-flex align-items-center gap-2">
                      <Button size="sm" variant="outline-primary" disabled={!serial} onClick={() => void portSec()}><IconPlugConnected size={14} className="me-1" />Port seç</Button>
                      <span className="text-muted">{a.usbVendorId != null ? `Seçili (USB ${a.usbVendorId.toString(16)}:${(a.usbProductId ?? 0).toString(16)})` : "Seçilmedi"}</span>
                    </div>
                  </>
                )}
              </Col>
              <Col md={6}>
                <Form.Check type="switch" id="tz-gram" label="Ondalıksız yanıt gramdır (00750 = 0,750 kg)" checked={a.ondaliksizGram} onChange={(e) => degistir({ ondaliksizGram: e.target.checked })} />
              </Col>
              <Col md={6}>
                <Form.Check type="switch" id="tz-oto" label="Tartı penceresi açılınca kendiliğinden oku" checked={a.otomatik} onChange={(e) => degistir({ otomatik: e.target.checked })} />
              </Col>
            </>
          )}
        </Row>
        {hata && a.yol !== "yok" && <Alert variant="warning" className="py-1 px-2 small mt-2 mb-0">{hata}</Alert>}
        {test.sonuc && <div className={`small mt-2 ${test.tamam ? "text-success" : "text-danger"}`} role="status">{test.tamam ? "✔ " : ""}{test.sonuc}</div>}
        <div className="d-flex gap-2 justify-content-end mt-2">
          {a.yol !== "yok" && (
            <Button size="sm" variant="outline-success" disabled={test.calisiyor || !!hata} onClick={() => void dene()}>
              {test.calisiyor ? <Spinner size="sm" className="me-1" /> : <IconScale size={14} className="me-1" />}Teraziyi dene
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={kaydet}><IconDeviceFloppy size={14} className="me-1" />Bu bilgisayara kaydet</Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default TeraziBaglantiAyari;

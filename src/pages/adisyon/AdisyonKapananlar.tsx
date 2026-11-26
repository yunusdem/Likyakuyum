import React, { useCallback, useState } from "react";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { IconLockOpen } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { AdisyonService, KapananAdisyon } from "../../services/adisyonService";
import { para } from "../../services/ticariService";

/**
 * Kapanan adisyonlar ve "Yeniden aç" (karar K1, TA25; 26.11.2026). Yanlış kapatılan adisyon yönetici tarafından yeniden açılır:
 * satış fişi geri alınır (stok ve vezne etkisiyle), kalemler yeniden ödenmemiş olur, alınan ödemeler bekleyen ara ödeme olarak
 * kalır. Fişi e-Belge olarak iletilmiş adisyon açılamaz. Liste istenince yüklenir (rapor her açılışta ek sorgu çalıştırmaz).
 */
export const AdisyonKapananlar: React.FC<{ gun: string }> = ({ gun }) => {
  const { showSuccess } = useToast();
  const git = useNavigate();
  const [liste, setListe] = useState<KapananAdisyon[] | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [secili, setSecili] = useState<KapananAdisyon | null>(null);
  const [neden, setNeden] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [acHata, setAcHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true); setHata(null);
    try { setListe((await AdisyonService.kapananlar(gun)).adisyonlar); } catch (e: any) { setHata(e?.message || "Liste alınamadı."); } finally { setYukleniyor(false); }
  }, [gun]);
  const ac = async () => {
    if (!secili) return;
    setMesgul(true); setAcHata(null);
    try {
      const r = await AdisyonService.yenidenAc(secili.adisyonId, neden.trim());
      showSuccess(`${secili.adisyonNo} yeniden açıldı.`);
      setSecili(null);
      git(r.tur === 1 && r.masaId ? `/adisyon/masalar?masa=${r.masaId}` : `/adisyon/masalar?paket=${r.adisyonId}`);
    } catch (e: any) { setAcHata(e?.message || "Adisyon yeniden açılamadı."); } finally { setMesgul(false); }
  };
  const yer = (x: KapananAdisyon) => (x.tur === 1 ? `Masa ${x.masa ?? "-"}` : `${x.tur === 3 ? "Gel-al" : "Paket"}${x.musteri ? ` · ${x.musteri}` : ""}`);

  return (
    <Card className="border shadow-xs h-100">
      <Card.Header className="bg-light py-2 small fw-bold d-flex align-items-center">
        Kapanan adisyonlar ({gun.split("-").reverse().join(".")})
        <Button size="sm" variant="outline-secondary" className="ms-auto py-0" disabled={yukleniyor} onClick={() => void yukle()}>{yukleniyor ? <Spinner size="sm" /> : liste ? "Yenile" : "Listeyi getir"}</Button>
      </Card.Header>
      <Card.Body className="p-0">
        {hata && <Alert variant="danger" className="py-2 small m-2">{hata}</Alert>}
        {!liste ? <div className="small text-muted p-2">Yanlış kapatılan adisyonu yeniden açmak için listeyi getirin.</div> : (
          <Table size="sm" className="mb-0 align-middle" responsive>
            <thead><tr><th>Kapanış</th><th>Adisyon</th><th>Yer</th><th>Garson</th><th className="text-end">Tutar</th><th /></tr></thead>
            <tbody>
              {liste.map((x) => (
                <tr key={x.adisyonId}>
                  <td className="text-nowrap">{new Date(x.kapanis).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}</td>
                  <td>{x.adisyonNo}{x.yenidenAcildi > 0 && <Badge bg="secondary" className="ms-1" title="Daha önce yeniden açılıp kapatıldı">{x.yenidenAcildi}× açıldı</Badge>}</td>
                  <td>{yer(x)}</td><td>{x.garson}</td><td className="text-end">{para(x.toplam)}</td>
                  <td className="text-end">
                    {x.acilabilir
                      ? <Button size="sm" variant="outline-dark" className="py-0" aria-label={`${x.adisyonNo} yeniden aç`} onClick={() => { setSecili(x); setNeden(""); setAcHata(null); }}><IconLockOpen size={14} className="me-1" />Yeniden aç</Button>
                      : <span className="small text-muted" title="Fişi e-Belge olarak iletildi; yeniden açılamaz">e-Belge iletildi</span>}
                  </td>
                </tr>
              ))}
              {!liste.length && <tr><td colSpan={6} className="text-muted">Bu gün kapanan adisyon yok.</td></tr>}
            </tbody>
          </Table>
        )}
      </Card.Body>
      <Modal show={!!secili} onHide={() => setSecili(null)} centered>
        <Modal.Header closeButton className="py-2"><Modal.Title className="h6 mb-0">Yeniden aç: {secili?.adisyonNo} · {secili ? yer(secili) : ""}</Modal.Title></Modal.Header>
        <Modal.Body>
          <Alert variant="warning" className="py-2 small">Adisyonun satış fişi ({secili ? para(secili.toplam) : ""} TL) geri alınır: stok ve vezne eski hâline döner. Alınan ödemeler adisyonda bekleyen ödeme olarak kalır; para iade edildiyse ödeme penceresinden silin, ardından adisyonu düzeltip yeniden kapatın.</Alert>
          <Form.Label className="small fw-bold mb-1">Neden (zorunlu)</Form.Label>
          <Form.Control autoFocus aria-label="Yeniden açma nedeni" maxLength={100} placeholder="Örn. yanlış masa kapatıldı" value={neden} onChange={(e) => setNeden(e.target.value)} />
          {acHata && <Alert variant="danger" className="py-2 small mt-2 mb-0">{acHata}</Alert>}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="outline-secondary" onClick={() => setSecili(null)}>Vazgeç</Button>
          <Button variant="dark" disabled={neden.trim().length < 3 || mesgul} onClick={() => void ac()}>{mesgul ? <Spinner size="sm" /> : "Yeniden aç"}</Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default AdisyonKapananlar;

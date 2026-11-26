import React, { useEffect, useState } from "react";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import { IconRefresh } from "@tabler/icons-react";

export interface MisafirPinBilgisi { pin: string; masa: string; musteriNo: string | null }

/**
 * Masadaki misafirin PIN'i (docs/TICARI_ADISYON_YOL_HARITASI.md §11, M2–M3): garson / kasa açık masa adisyonunda görür ve misafire söyler.
 * PIN bu adisyona özeldir; "Yenile" yeni PIN verir (eski PIN ve misafir oturumları düşer). Adisyon kapanınca PIN geçersiz olur.
 */
export const MisafirPinModal: React.FC<{ adisyonId: number | null; getir: (adisyonId: number, yenile: boolean) => Promise<MisafirPinBilgisi>; kapat: () => void }> = ({ adisyonId, getir, kapat }) => {
  const [b, setB] = useState<MisafirPinBilgisi | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const yukle = async (yenile: boolean) => {
    if (!adisyonId) return;
    setMesgul(true); setHata(null);
    try { setB(await getir(adisyonId, yenile)); } catch (e: any) { setHata(e?.response?.data?.message || e?.message || "PIN alınamadı."); } finally { setMesgul(false); }
  };
  useEffect(() => { setB(null); if (adisyonId) void yukle(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adisyonId]);
  return (
    <Modal show={!!adisyonId} onHide={kapat} centered size="sm">
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6 fw-bold">Misafir PIN'i{b?.masa ? ` — ${b.masa}` : ""}</Modal.Title></Modal.Header>
      <Modal.Body className="text-center">
        {hata && <Alert variant="danger" className="py-2 small text-start">{hata}</Alert>}
        {!b && !hata && <Spinner />}
        {b && (
          <>
            <div aria-label="Misafir PIN" style={{ fontSize: 44, fontWeight: 800, letterSpacing: 8, fontFamily: "ui-monospace, monospace" }}>{b.pin}</div>
            <div className="small text-muted mt-2">Misafir masadaki QR kodu okutup bu PIN'i girer; menüden sipariş verir, hesabını görür. PIN yalnız bu adisyonda geçer, hesap kapanınca biter.</div>
            {b.musteriNo && <div className="small mt-2">QR'sız giriş: <b>/misafir</b> · müşteri no <b>{b.musteriNo}</b></div>}
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button size="sm" variant="outline-danger" disabled={mesgul || !b} onClick={() => { if (window.confirm("Yeni PIN verilsin mi? Eski PIN ile girmiş misafirlerin oturumu kapanır.")) void yukle(true); }}><IconRefresh size={14} className="me-1" />Yeni PIN</Button>
        <Button size="sm" variant="secondary" onClick={kapat}>Kapat</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MisafirPinModal;

import React, { useEffect, useState } from "react";
import { Alert, Button, Modal, Spinner, Table } from "react-bootstrap";
import { IconArrowUp, IconDownload, IconFile, IconFolder } from "@tabler/icons-react";
import { CompanyService, FirmaKlasorOgesi } from "../../services/companyService";

/**
 * Firmanın dosya klasörü (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K12): klasörlerde gezinir, dosyayı indirir.
 * Bulutta firma sunucu diskine erişemediği için dosyalar buradan alınır.
 */
interface Props {
  show: boolean;
  onHide: () => void;
  kokYol?: string;
}

const boyutYaz = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

const FirmaKlasoruModal: React.FC<Props> = ({ show, onHide, kokYol }) => {
  const [yol, setYol] = useState<string[]>([]);
  const [ogeler, setOgeler] = useState<FirmaKlasorOgesi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (show) setYol([]);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    let iptal = false;
    setYukleniyor(true);
    setHata(null);
    CompanyService.klasorListe(yol.join("/"))
      .then((l) => !iptal && setOgeler(l))
      .catch((e: any) => !iptal && setHata(e?.message || "Klasör okunamadı."))
      .finally(() => !iptal && setYukleniyor(false));
    return () => {
      iptal = true;
    };
  }, [show, yol]);

  const indir = async (ad: string) => {
    try {
      await CompanyService.klasorIndir([...yol, ad].join("/"));
    } catch (e: any) {
      setHata(e?.message || "Dosya indirilemedi.");
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="py-2">
        <Modal.Title className="fs-6 fw-semibold">Firma Klasörü</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-2">
        <div className="d-flex align-items-center gap-2 mb-2 small">
          <Button size="sm" variant="outline-secondary" disabled={!yol.length} onClick={() => setYol(yol.slice(0, -1))} title="Üst klasör">
            <IconArrowUp size={14} />
          </Button>
          <span className="font-monospace text-break">
            {kokYol || "Firma klasörü"}
            {yol.length ? `\\${yol.join("\\")}` : ""}
          </span>
        </div>
        {hata && <Alert variant="danger" className="py-1 px-2 small mb-2">{hata}</Alert>}
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <Table size="sm" hover className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th>Ad</th>
                <th className="text-end" style={{ width: 90 }}>Boyut</th>
                <th style={{ width: 140 }}>Tarih</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {yukleniyor ? (
                <tr><td colSpan={4} className="text-center py-3"><Spinner size="sm" /></td></tr>
              ) : ogeler.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-muted py-3">Klasör boş.</td></tr>
              ) : (
                ogeler.map((o) => (
                  <tr key={o.ad} style={{ cursor: o.klasor ? "pointer" : undefined }} onDoubleClick={() => (o.klasor ? setYol([...yol, o.ad]) : indir(o.ad))}>
                    <td className="text-break">
                      {o.klasor ? (
                        <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => setYol([...yol, o.ad])}>
                          <IconFolder size={15} className="me-1 text-warning" />{o.ad}
                        </button>
                      ) : (
                        <><IconFile size={15} className="me-1 text-secondary" />{o.ad}</>
                      )}
                    </td>
                    <td className="text-end">{o.klasor ? "" : boyutYaz(o.boyut)}</td>
                    <td>{new Date(o.tarih).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="text-end">
                      {!o.klasor && (
                        <Button size="sm" variant="link" className="p-0" title="İndir" onClick={() => indir(o.ad)}>
                          <IconDownload size={15} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default FirmaKlasoruModal;

import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import { IconPhotoPlus, IconTrash } from "@tabler/icons-react";
import { BelgeService, type BelgeGorseli } from "../../services/belgeService";

const AZAMI_BAYT = 1024 * 1024;
const TUR_ADI: Record<BelgeGorseli["tur"], string> = { LOGO: "Logo", IMZA: "İmza / Kaşe" };

/**
 * Logolar ve İmzalar (docs/FIS_TASARIM_YOL_HARITASI.md, 4.3): firmanın fişlerde kullandığı görseller.
 * PNG / JPG, en çok 1 MB. İmza ve kaşe için arka planı saydam PNG önerilir. Şablona adla bağlanır.
 */
export const BelgeGorselleriModal: React.FC<{ show: boolean; onHide: () => void; onDegisti?: () => void }> = ({ show, onHide, onDegisti }) => {
  const [liste, setListe] = useState<BelgeGorseli[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [uyari, setUyari] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);
  const [ad, setAd] = useState("");
  const [tur, setTur] = useState<"LOGO" | "IMZA">("LOGO");
  const [dosya, setDosya] = useState<{ ad: string; dataUrl: string } | null>(null);
  const [isleniyor, setIsleniyor] = useState(false);
  const [silinecek, setSilinecek] = useState<{ g: BelgeGorseli; kullanan: string[] } | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try { setListe(await BelgeService.gorseller()); }
    catch (e: any) { setUyari({ type: "danger", message: e?.message || "Görseller okunamadı." }); }
    finally { setYukleniyor(false); }
  }, []);
  useEffect(() => { if (show) { setUyari(null); void yukle(); } }, [show, yukle]);

  const dosyaSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    setDosya(null);
    if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type) && !/\.(png|jpe?g)$/i.test(f.name)) { setUyari({ type: "danger", message: "Yalnızca PNG ve JPG görseller yüklenebilir." }); return; }
    if (f.size > AZAMI_BAYT) { setUyari({ type: "danger", message: "Görsel çok büyük (en çok 1 MB)." }); return; }
    const okuyucu = new FileReader();
    okuyucu.onload = () => {
      setDosya({ ad: f.name, dataUrl: String(okuyucu.result || "") });
      if (!ad.trim()) setAd(f.name.replace(/\.[^.]+$/, "").slice(0, 40));
    };
    okuyucu.readAsDataURL(f);
  };

  const ekle = async () => {
    if (!dosya || !ad.trim()) return;
    setIsleniyor(true); setUyari(null);
    try {
      await BelgeService.gorselEkle({ ad: ad.trim(), tur, dataUrl: dosya.dataUrl });
      setUyari({ type: "success", message: `"${ad.trim()}" yüklendi. Şablonda ${tur === "LOGO" ? "logo" : "imza"} öğesiyle bu adı seçerek kullanabilirsiniz.` });
      setAd(""); setDosya(null);
      await yukle(); onDegisti?.();
    } catch (e: any) { setUyari({ type: "danger", message: e?.message || "Görsel yüklenemedi." }); }
    finally { setIsleniyor(false); }
  };

  const sil = async (g: BelgeGorseli, zorla: boolean) => {
    setIsleniyor(true); setUyari(null);
    try {
      await BelgeService.gorselSil(g.id, zorla);
      setSilinecek(null);
      setUyari({ type: "success", message: `"${g.ad}" silindi.` });
      await yukle(); onDegisti?.();
    } catch (e: any) {
      if (e?.ayrinti?.kod === "GORSEL_KULLANILIYOR") setSilinecek({ g, kullanan: e.ayrinti.kullanan || [] });
      else setUyari({ type: "danger", message: e?.message || "Görsel silinemedi." });
    } finally { setIsleniyor(false); }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6 fw-bold">Logolar ve İmzalar</Modal.Title></Modal.Header>
      <Modal.Body>
        {uyari && <Alert variant={uyari.type} dismissible onClose={() => setUyari(null)} className="py-2 small">{uyari.message}</Alert>}

        <div className="border rounded p-2 mb-3 bg-light">
          <Row className="g-2 align-items-end">
            <Col md={4}>
              <Form.Label className="small fw-semibold mb-1">Görsel (PNG / JPG, en çok 1 MB)</Form.Label>
              <Form.Control size="sm" type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={dosyaSec} />
            </Col>
            <Col md={3}>
              <Form.Label className="small fw-semibold mb-1">Ad</Form.Label>
              <Form.Control size="sm" value={ad} maxLength={40} placeholder="ör. Kaşe" onChange={(e) => setAd(e.target.value)} />
            </Col>
            <Col md={3}>
              <Form.Label className="small fw-semibold mb-1">Tür</Form.Label>
              <Form.Select size="sm" value={tur} onChange={(e) => setTur(e.target.value as "LOGO" | "IMZA")}>
                <option value="LOGO">Logo</option>
                <option value="IMZA">İmza / Kaşe</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Button size="sm" className="w-100" disabled={!dosya || !ad.trim() || isleniyor} onClick={() => void ekle()}>
                {isleniyor ? <Spinner size="sm" /> : <><IconPhotoPlus size={15} className="me-1" />Yükle</>}
              </Button>
            </Col>
          </Row>
          {dosya && <div className="mt-2 d-flex align-items-center gap-2 small"><img src={dosya.dataUrl} alt="" style={{ height: 40, maxWidth: 120, objectFit: "contain", background: "#fff", border: "1px solid #ddd" }} /> {dosya.ad}</div>}
          <div className="text-muted mt-1" style={{ fontSize: 11 }}>İmza ve kaşe için arka planı saydam PNG önerilir. 80 mm fişlerde görseller siyah-beyaz basılır.</div>
        </div>

        {yukleniyor ? (
          <div className="text-muted small d-flex align-items-center gap-2"><Spinner size="sm" /> Yükleniyor…</div>
        ) : liste.length === 0 ? (
          <div className="text-muted small">Henüz görsel yok.</div>
        ) : (
          <Row className="g-2">
            {liste.map((g) => (
              <Col md={4} key={g.id}>
                <div className="border rounded p-2 h-100 d-flex flex-column">
                  <div className="d-flex align-items-center justify-content-center mb-2" style={{ height: 70, background: "repeating-conic-gradient(#eee 0 25%, #fff 0 50%) 0 0 / 12px 12px" }}>
                    <img src={g.dataUrl} alt={g.ad} style={{ maxHeight: 66, maxWidth: "100%", objectFit: "contain" }} />
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <span className="fw-semibold small text-truncate me-auto" title={g.ad}>{g.ad}</span>
                    <Badge bg={g.tur === "LOGO" ? "primary" : "info"}>{TUR_ADI[g.tur]}</Badge>
                  </div>
                  <div className="text-muted" style={{ fontSize: 11 }}>{Math.ceil(g.boyut / 1024)} KB{g.kullanildigiBelgeler.length ? ` · ${g.kullanildigiBelgeler.length} belgede` : " · kullanılmıyor"}</div>
                  <Button size="sm" variant="outline-danger" className="mt-auto pt-1" disabled={isleniyor} onClick={() => void sil(g, false)}>
                    <IconTrash size={14} className="me-1" />Sil
                  </Button>
                </div>
              </Col>
            ))}
          </Row>
        )}

        {silinecek && (
          <Alert variant="warning" className="mt-3 mb-0 small">
            <div className="fw-bold">"{silinecek.g.ad}" şu belgelerde kullanılıyor:</div>
            <ul className="mb-2 ps-3">{silinecek.kullanan.map((k) => <li key={k}>{k}</li>)}</ul>
            Silinirse bu belgelerde görselin yeri boş kalır (fiş yine basılır).
            <div className="mt-2 d-flex gap-2">
              <Button size="sm" variant="danger" disabled={isleniyor} onClick={() => void sil(silinecek.g, true)}>Yine de sil</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => setSilinecek(null)}>Vazgeç</Button>
            </div>
          </Alert>
        )}
      </Modal.Body>
    </Modal>
  );
};

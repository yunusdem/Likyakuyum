import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import {
  IconFileTypePdf,
  IconRefresh,
  IconExternalLink,
  IconCheck,
  IconX,
  IconAlertTriangle,
} from "@tabler/icons-react";

import {
  EbelgeGelenSatiri,
  ebelgeRedKabulRozet,
  ebelgeService,
  ebelgeTarihSaat,
  ebelgeTicariMi,
  ebelgeTutar,
} from "../../services/ebelgeService";

interface Props {
  uuid: string | null;
  onClose: () => void;
  /** Cevap gönderildikten sonra listeyi tazelemek için */
  onCevapVerildi?: () => void;
}

/**
 * Gelen belge detayı.
 *
 * GÜVENLİK: `GetInvoice_HTML` çıktısını ICE üretiyor, yani üçüncü tarafın HTML'i.
 * Bu yüzden dangerouslySetInnerHTML KULLANILMAZ; içerik sandbox'lı bir iframe'e
 * srcdoc olarak verilir ve `allow-same-origin` BİLEREK verilmez — böylece sayfa
 * kendi origin'imize, çerezlerimize ve localStorage'a erişemez.
 * (docs/ice-baglanti.md §11.1 S5)
 */
const EBelgeDetayModal: React.FC<Props> = ({ uuid, onClose, onCevapVerildi }) => {
  const [detay, setDetay] = useState<EbelgeGelenSatiri | null>(null);
  const [html, setHtml] = useState<string>("");
  const [yukleniyor, setYukleniyor] = useState<boolean>(false);
  const [htmlYukleniyor, setHtmlYukleniyor] = useState<boolean>(false);
  const [pdfYukleniyor, setPdfYukleniyor] = useState<boolean>(false);
  const [hata, setHata] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Kabul/red — iki adımlı onay
  const [cevapModu, setCevapModu] = useState<"Kabul" | "Red" | null>(null);
  const [cevapAciklama, setCevapAciklama] = useState<string>("");
  const [cevapGonderiliyor, setCevapGonderiliyor] = useState<boolean>(false);

  const temizleBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const detayYukle = useCallback(
    async (statuYenile: boolean) => {
      if (!uuid) return;
      setYukleniyor(true);
      setHata(null);
      try {
        setDetay(await ebelgeService.getGelenDetay(uuid, statuYenile));
      } catch (err: any) {
        setHata(err?.message || "Belge detayı alınamadı.");
      } finally {
        setYukleniyor(false);
      }
    },
    [uuid]
  );

  const htmlYukle = useCallback(async () => {
    if (!uuid) return;
    setHtmlYukleniyor(true);
    setHata(null);
    try {
      setHtml(await ebelgeService.getGelenHtml(uuid));
    } catch (err: any) {
      setHata(err?.message || "Belge görüntüsü alınamadı.");
    } finally {
      setHtmlYukleniyor(false);
    }
  }, [uuid]);

  useEffect(() => {
    if (!uuid) {
      setDetay(null);
      setHtml("");
      temizleBlob();
      return;
    }
    setCevapModu(null);
    setCevapAciklama("");
    detayYukle(false);
    htmlYukle();
    return temizleBlob;
  }, [uuid, detayYukle, htmlYukle, temizleBlob]);

  const pdfAc = async () => {
    if (!uuid) return;
    setPdfYukleniyor(true);
    setHata(null);
    try {
      temizleBlob();
      const url = await ebelgeService.getGelenPdfBlobUrl(uuid);
      blobUrlRef.current = url;
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setHata(err?.message || "PDF açılamadı.");
    } finally {
      setPdfYukleniyor(false);
    }
  };

  const cevapGonder = async () => {
    if (!uuid || !cevapModu) return;
    if (cevapModu === "Red" && !cevapAciklama.trim()) {
      setHata("Red cevabı için açıklama zorunludur.");
      return;
    }

    setCevapGonderiliyor(true);
    setHata(null);
    try {
      const guncel = await ebelgeService.cevapVer(uuid, cevapModu, cevapAciklama.trim());
      setDetay(guncel);
      setCevapModu(null);
      setCevapAciklama("");
      onCevapVerildi?.();
    } catch (err: any) {
      setHata(err?.message || "Cevap gönderilemedi.");
    } finally {
      setCevapGonderiliyor(false);
    }
  };

  const rozet = ebelgeRedKabulRozet(detay?.redKabul);
  // Cevap yalnızca ticari faturaya ve yalnızca bir kez verilebilir
  const cevapVerilebilir = Boolean(detay && !detay.redKabul && ebelgeTicariMi(detay.profil));

  return (
    <Modal show={Boolean(uuid)} onHide={onClose} size="xl" centered scrollable>
      <Modal.Header closeButton className="py-2 px-3">
        <Modal.Title style={{ fontSize: "14px" }} className="fw-semibold">
          Gelen Belge — {detay?.belgeNo || uuid}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="p-3">
        {hata && (
          <Alert variant="danger" className="py-2 px-3 mb-3 border rounded shadow-2xs small">
            {hata}
          </Alert>
        )}

        {yukleniyor ? (
          <div className="d-flex align-items-center gap-2 py-3 justify-content-center">
            <Spinner animation="border" size="sm" />
            <span className="small text-secondary">Detay yükleniyor…</span>
          </div>
        ) : detay ? (
          <div className="border rounded-2 p-3 mb-3 shadow-2xs">
            <Row className="g-2" style={{ fontSize: "13px" }}>
              <Col xs={12} md={6}>
                <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                  Gönderen
                </div>
                <div className="fw-semibold">{detay.supplier || detay.sender || "-"}</div>
              </Col>
              <Col xs={6} md={3}>
                <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                  Belge No
                </div>
                <div className="font-monospace">{detay.belgeNo || "-"}</div>
              </Col>
              <Col xs={6} md={3}>
                <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                  Düzenlenme
                </div>
                <div>{ebelgeTarihSaat(detay.duzenlemeTarihi)}</div>
              </Col>

              <Col xs={6} md={3}>
                <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                  Tutar
                </div>
                <div className="fw-semibold">{ebelgeTutar(detay.tutar, detay.paraBirimi)}</div>
              </Col>
              <Col xs={6} md={3}>
                <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                  Senaryo
                </div>
                <div>{detay.profil || "-"}</div>
              </Col>
              <Col xs={6} md={3}>
                <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                  GİB Statüsü
                </div>
                <div title={detay.gibStatuAciklama || ""}>
                  {detay.statu || detay.gibStatuAciklama || "-"}
                </div>
              </Col>
              <Col xs={6} md={3}>
                <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                  Cevap Durumu
                </div>
                <Badge bg={rozet.bg} text={rozet.text}>
                  {rozet.etiket}
                </Badge>
              </Col>

              <Col xs={12}>
                <div className="text-secondary" style={{ fontSize: "11.5px" }}>
                  ETTN
                </div>
                <div className="font-monospace text-break" style={{ fontSize: "12px" }}>
                  {detay.uuid}
                </div>
              </Col>

              {detay.redKabul && (
                <Col xs={12}>
                  <div className="border-top pt-2 mt-1">
                    <span className="text-secondary" style={{ fontSize: "11.5px" }}>
                      {detay.redKabul} cevabı — {ebelgeTarihSaat(detay.redKabulTarihi)}
                      {detay.redKabulKullanici ? ` · ${detay.redKabulKullanici}` : ""}
                    </span>
                    {detay.redKabulAciklama && <div className="small">{detay.redKabulAciklama}</div>}
                  </div>
                </Col>
              )}
            </Row>
          </div>
        ) : null}

        {cevapVerilebilir && (
          <div className="border rounded-2 p-3 mb-3 shadow-2xs">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <span className="fw-semibold" style={{ fontSize: "13px" }}>
                Ticari Fatura Cevabı
              </span>

              {!cevapModu && (
                <div className="d-flex gap-2">
                  <Button
                    size="sm"
                    variant="outline-success"
                    onClick={() => setCevapModu("Kabul")}
                    className="d-flex align-items-center gap-1"
                  >
                    <IconCheck size={15} />
                    Kabul Et
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => setCevapModu("Red")}
                    className="d-flex align-items-center gap-1"
                  >
                    <IconX size={15} />
                    Reddet
                  </Button>
                </div>
              )}
            </div>

            {!cevapModu ? (
              <div className="text-secondary small mt-2">
                Bu belge ticari fatura senaryosunda; kabul veya red cevabı verilmesi gerekir.
              </div>
            ) : (
              /* 2. adım — açık onay. Geri alınamaz olduğu için tek tıkla gönderilmez. */
              <div className="mt-3">
                <Alert
                  variant={cevapModu === "Red" ? "danger" : "warning"}
                  className="py-2 px-3 mb-2 border rounded shadow-2xs small"
                >
                  <IconAlertTriangle size={15} className="me-1" />
                  <strong>{cevapModu === "Red" ? "Red" : "Kabul"}</strong> cevabı GİB'e gönderilecek ve{" "}
                  <strong>geri alınamaz</strong>. Devam etmek istediğinize emin misiniz?
                </Alert>

                <Form.Label className="small mb-1">
                  Açıklama
                  {cevapModu === "Red" && <span style={{ color: "#dc2626" }}> (zorunlu)</span>}
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  size="sm"
                  value={cevapAciklama}
                  onChange={(e) => setCevapAciklama(e.target.value)}
                  placeholder={
                    cevapModu === "Red" ? "Örn: Tutar bilgisi uyuşmazlığı" : "İsteğe bağlı açıklama"
                  }
                  maxLength={1000}
                  data-custom-enter="true"
                />

                <div className="d-flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant={cevapModu === "Red" ? "danger" : "success"}
                    onClick={cevapGonder}
                    disabled={cevapGonderiliyor || (cevapModu === "Red" && !cevapAciklama.trim())}
                    className="d-flex align-items-center gap-1"
                  >
                    {cevapGonderiliyor ? <Spinner animation="border" size="sm" /> : null}
                    Evet, {cevapModu === "Red" ? "reddet" : "kabul et"} ve gönder
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setCevapModu(null);
                      setCevapAciklama("");
                    }}
                    disabled={cevapGonderiliyor}
                  >
                    Vazgeç
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="d-flex align-items-center justify-content-between mb-2">
          <span className="fw-semibold" style={{ fontSize: "13px" }}>
            Belge Görüntüsü
          </span>
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={() => detayYukle(true)}
              disabled={yukleniyor}
              className="d-flex align-items-center gap-1"
            >
              <IconRefresh size={15} />
              Statüyü Yenile
            </Button>
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={pdfAc}
              disabled={pdfYukleniyor}
              className="d-flex align-items-center gap-1"
            >
              {pdfYukleniyor ? <Spinner animation="border" size="sm" /> : <IconFileTypePdf size={15} />}
              PDF Aç
              <IconExternalLink size={13} />
            </Button>
          </div>
        </div>

        <div className="border rounded-2 overflow-hidden" style={{ height: "60vh" }}>
          {htmlYukleniyor ? (
            <div className="d-flex align-items-center gap-2 h-100 justify-content-center">
              <Spinner animation="border" size="sm" />
              <span className="small text-secondary">Belge görüntüsü alınıyor…</span>
            </div>
          ) : html ? (
            /*
             * sandbox içinde allow-same-origin YOK: belge kendi origin'imize,
             * çerezlerimize ve localStorage'a erişemez. Script çalışsa bile
             * yalıtılmış bir origin içinde kalır.
             */
            <iframe
              title="Belge görüntüsü"
              srcDoc={html}
              sandbox=""
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: "100%", border: "none" }}
            />
          ) : (
            <div className="d-flex align-items-center h-100 justify-content-center text-secondary small">
              Görüntü alınamadı.
            </div>
          )}
        </div>
      </Modal.Body>

      <Modal.Footer className="py-2 px-3">
        <Button size="sm" variant="secondary" onClick={onClose}>
          Kapat
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EBelgeDetayModal;

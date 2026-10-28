import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { IconPhone, IconRefresh } from "@tabler/icons-react";
import { DURUM_ADI, DURUM_RENGI, konuEtiketi, zamanOnce } from "../../components/destek/destekOrtak";
import { FirmaKarti, MusteriKullanici, panelApi, PanelKonu } from "../services/panelApi";
import FirmaKartiGoster, { tarihYaz } from "../components/FirmaKarti";
import TelefonTalebiModal from "../components/TelefonTalebiModal";

/** Destek paneli > Müşteriler (D13): salt okunur firma listesi; seçilen firmanın kartı, kullanıcıları ve kayıtları. */
const MusterilerPage: React.FC = () => {
  const navigate = useNavigate();
  const [arama, setArama] = useState("");
  const [liste, setListe] = useState<FirmaKarti[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [secili, setSecili] = useState<number | null>(null);
  const [detay, setDetay] = useState<{ firma: FirmaKarti; kullanicilar: MusteriKullanici[]; talepler: PanelKonu[] } | null>(null);
  const [telefonAcik, setTelefonAcik] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setListe(await panelApi.musteriler(arama.trim() || undefined));
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Liste okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [arama]);

  useEffect(() => {
    const z = setTimeout(yukle, 250);
    return () => clearTimeout(z);
  }, [yukle]);

  useEffect(() => {
    setDetay(null);
    if (secili) panelApi.musteri(secili).then(setDetay).catch((e) => setHata(e?.message));
  }, [secili]);

  return (
    <div className="d-flex gap-3 flex-wrap flex-lg-nowrap align-items-start">
      <Card className="shadow-sm flex-grow-1" style={{ minWidth: 0 }}>
        <Card.Body className="p-3">
          <div className="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
            <div>
              <h5 className="mb-0">Müşteriler</h5>
              <small className="text-muted">{liste.length} firma · salt okunur</small>
            </div>
            <div className="d-flex gap-2">
              <Form.Control size="sm" style={{ width: 260 }} placeholder="Unvan, müşteri no, telefon, yetkili…" value={arama} onChange={(e) => setArama(e.target.value)} />
              <Button size="sm" variant="outline-secondary" onClick={yukle} title="Yenile">
                <IconRefresh size={16} />
              </Button>
            </div>
          </div>
          {hata && <Alert variant="danger">{hata}</Alert>}
          {yukleniyor && liste.length === 0 ? (
            <div className="text-center py-5">
              <Spinner animation="border" size="sm" />
            </div>
          ) : (
            <div style={{ maxHeight: "calc(100vh - 230px)", overflowY: "auto" }}>
              <Table hover size="sm" className="mb-0 align-middle">
                <thead className="sticky-top bg-white">
                  <tr>
                    <th>Firma</th>
                    <th>Müşteri no</th>
                    <th>Telefon</th>
                    <th>Paket</th>
                    <th>Lisans</th>
                    <th className="text-center">Açık talep</th>
                    <th>Son talep</th>
                  </tr>
                </thead>
                <tbody>
                  {liste.map((f) => (
                    <tr key={f.firmaId} role="button" className={secili === f.firmaId ? "table-active" : ""} onClick={() => setSecili(f.firmaId)}>
                      <td>
                        {f.unvan}
                        {f.durum !== "AKTIF" && (
                          <Badge bg={f.durum === "DONDURULMUS" ? "warning" : "secondary"} className="ms-1 fw-normal">
                            {f.durum}
                          </Badge>
                        )}
                      </td>
                      <td>{f.musteriNo || <span className="text-muted">{f.firmaKodu}</span>}</td>
                      <td>{f.telefon || "-"}</td>
                      <td>{f.paket || "-"}</td>
                      <td>{tarihYaz(f.lisansBitis)}</td>
                      <td className="text-center">{f.acikTalep ? <Badge bg="primary">{f.acikTalep}</Badge> : "-"}</td>
                      <td className="small text-muted">{f.sonTalep ? zamanOnce(f.sonTalep) : "-"}</td>
                    </tr>
                  ))}
                  {liste.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        Firma bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {secili && (
        <Card className="shadow-sm dsp-musteri-detay">
          <Card.Body className="p-3">
            {!detay ? (
              <div className="text-center py-5">
                <Spinner animation="border" size="sm" />
              </div>
            ) : (
              <>
                <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
                  <h6 className="mb-0">{detay.firma.unvan}</h6>
                  <Button size="sm" variant="outline-primary" onClick={() => setTelefonAcik(true)}>
                    <IconPhone size={14} className="me-1" />
                    Telefon talebi
                  </Button>
                </div>
                <FirmaKartiGoster firma={detay.firma} katlanmaz />
                {detay.firma.adres && <div className="small text-muted mt-2">{detay.firma.adres}</div>}
                {detay.firma.durumNotu && <div className="small text-warning-emphasis mt-1">Durum notu: {detay.firma.durumNotu}</div>}

                <div className="fw-semibold small mt-3 mb-1">Kullanıcılar ({detay.kullanicilar.length})</div>
                <Table size="sm" className="small mb-0">
                  <tbody>
                    {detay.kullanicilar.map((k) => (
                      <tr key={k.kullaniciId} className={k.durum !== "AKTIF" ? "text-muted" : ""}>
                        <td>
                          {k.adSoyad || "-"} <span className="text-muted">({k.kullaniciAdi})</span>
                          {k.yonetici && (
                            <Badge bg="light" text="dark" className="ms-1 border fw-normal">
                              yönetici
                            </Badge>
                          )}
                        </td>
                        <td className="text-end text-muted">{k.durum !== "AKTIF" ? "pasif" : k.sonGiris ? zamanOnce(k.sonGiris) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                <div className="d-flex justify-content-between align-items-center mt-3 mb-1">
                  <span className="fw-semibold small">Kayıtlar ({detay.talepler.length})</span>
                  <Button size="sm" variant="link" className="p-0" onClick={() => navigate(`/?firma=${secili}`)}>
                    Talepler ekranında aç
                  </Button>
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {detay.talepler.map((t) => (
                    <div key={t.konuId} className="dsp-mini-satir" role="button" onClick={() => navigate(`/?firma=${secili}&konu=${t.konuId}`)}>
                      <div className="text-truncate">{t.baslik}</div>
                      <div className="small text-muted d-flex gap-2 align-items-center">
                        <span>{konuEtiketi(t)}</span>
                        <Badge bg={DURUM_RENGI[t.durum]} className="fw-normal">
                          {DURUM_ADI[t.durum]}
                        </Badge>
                        <span className="ms-auto">{zamanOnce(t.sonMesajTarihi)}</span>
                      </div>
                    </div>
                  ))}
                  {detay.talepler.length === 0 && <div className="small text-muted">Kayıt yok.</div>}
                </div>
              </>
            )}
          </Card.Body>
        </Card>
      )}
      <TelefonTalebiModal show={telefonAcik} firmaId={secili ?? undefined} onHide={() => setTelefonAcik(false)} onAcildi={(konuId) => navigate(`/?konu=${konuId}`)} />
    </div>
  );
};

export default MusterilerPage;

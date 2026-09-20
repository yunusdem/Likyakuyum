import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Card, Col, Row, Spinner, Table } from "react-bootstrap";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, gunYaz, LisansUyarisi, OzetDto, tarihYaz } from "../services/adminApi";
import MusteriSorgu from "../components/MusteriSorgu";

const Sayi: React.FC<{ baslik: string; deger: number; renk?: string }> = ({ baslik, deger, renk }) => (
  <Col xs={6} md={4} xl={2}>
    <Card className="shadow-sm h-100">
      <Card.Body>
        <div className="text-muted small">{baslik}</div>
        <div className={`fs-3 fw-semibold ${renk && deger > 0 ? renk : ""}`}>{deger}</div>
      </Card.Body>
    </Card>
  </Col>
);

const LisansListesi: React.FC<{ baslik: string; satirlar: LisansUyarisi[]; bitmis?: boolean }> = ({ baslik, satirlar, bitmis }) => (
  <Card className="shadow-sm h-100">
    <Card.Body>
      <h6 className="mb-3">{baslik}</h6>
      {satirlar.length === 0 ? (
        <div className="text-muted small">Yok.</div>
      ) : (
        <Table size="sm" responsive className="align-middle mb-0">
          <tbody>
            {satirlar.map((l) => (
              <tr key={l.firmaId}>
                <td>
                  <Link to={`/firmalar/${l.firmaId}`} className="text-decoration-none">
                    {l.unvan}
                  </Link>
                  <span className="text-muted small ms-1">{l.firmaKodu}</span>
                </td>
                <td className="text-end text-nowrap">{gunYaz(l.bitis)}</td>
                <td className={`text-end text-nowrap ${bitmis ? "text-danger" : ""}`}>
                  {bitmis ? `${-l.kalanGun} gün önce` : l.kalanGun === 0 ? "bugün" : `${l.kalanGun} gün`}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card.Body>
  </Card>
);

const PanoPage: React.FC = () => {
  const { admin } = useAdminAuth();
  const [ozet, setOzet] = useState<OzetDto | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .ozet()
      .then(setOzet)
      .catch((err) => setHata(err?.message || "Özet getirilemedi."));
  }, []);

  return (
    <>
      <div className="mb-3">
        <h5 className="mb-0">Hoş geldiniz, {admin?.adSoyad}</h5>
        <div className="text-muted small">Son giriş: {tarihYaz(admin?.sonGiris)}</div>
      </div>

      <MusteriSorgu />

      {hata && <Alert variant="danger">{hata}</Alert>}
      {!ozet && !hata && (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      )}

      {ozet && (
        <>
          <Row className="g-3 mb-3">
            <Sayi baslik="Firma" deger={ozet.firmaToplam} />
            <Sayi baslik="Aktif firma" deger={ozet.firmaAktif} />
            <Sayi baslik="Dondurulmuş" deger={ozet.firmaDondurulmus} renk="text-warning" />
            <Sayi baslik="Pasif" deger={ozet.firmaPasif} />
            <Sayi baslik="Aktif kullanıcı" deger={ozet.kullaniciAktif} />
            <Sayi baslik="Doğrulanmamış" deger={ozet.dogrulanmamis} renk="text-danger" />
          </Row>
          {ozet.lisanssizFirma > 0 && (
            <Alert variant="warning">
              {ozet.lisanssizFirma} firmanın tanımlı lisansı yok. <Link to="/firmalar">Firmalara git</Link>
            </Alert>
          )}
          <Row className="g-3">
            <Col lg={6}>
              <LisansListesi baslik="Süresi biten lisanslar" satirlar={ozet.suresiBitenLisanslar} bitmis />
            </Col>
            <Col lg={6}>
              <LisansListesi baslik={`${ozet.lisansUyariGun} gün içinde bitecek lisanslar`} satirlar={ozet.yaklasanLisanslar} />
            </Col>
          </Row>
        </>
      )}
    </>
  );
};

export default PanoPage;

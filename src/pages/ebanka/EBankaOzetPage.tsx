import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Row, Table } from "react-bootstrap";
import { IconRefresh } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EBankaOzet, EBankaService } from "../../services/ebankaService";
import { EsitlemeModal, ModRozeti, esitlemeOzeti, ibanYaz, paraYaz, useBildirim, zamanYaz } from "./ebankaOrtak";

// F- e-Banka > A- Özet (docs/EBANKA_VOMSIS_YOL_HARITASI.md, Faz 1)

export const EBankaOzetPage: React.FC = () => {
  const [ozet, setOzet] = useState<EBankaOzet | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [esitlemeAcik, setEsitlemeAcik] = useState(false);
  const { bildir, bildirimKutusu } = useBildirim();

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setOzet(await EBankaService.getOzet());
    } catch (err: any) {
      bildir("danger", err?.message || "Özet okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [bildir]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  return (
    <div className="ebanka-ozet-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="A- e-Banka Özet"
        onRefresh={yukle}
        hideNew
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor}
        modeText={`Son güncelleme: ${zamanYaz(ozet?.sonEsitleme)}`}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <ModRozeti mod={ozet?.mod} />
            <Button size="sm" variant="primary" onClick={() => setEsitlemeAcik(true)}>
              <IconRefresh size={16} className="me-1" />
              Vomsis'ten Güncelle
            </Button>
          </div>
        }
      />
      {bildirimKutusu}

      {ozet && ozet.hesaplar.length === 0 && !yukleniyor && (
        <Alert variant="light" className="border small">
          Henüz veri çekilmedi. <b>Vomsis'ten Güncelle</b> ile bankaları, hesapları ve hareketleri çekin.
        </Alert>
      )}

      <Row className="g-3 mb-3">
        {ozet?.toplamlar.map((t) => (
          <Col key={t.doviz} xl={3} md={4} sm={6}>
            <Card className="border shadow-sm bg-white h-100">
              <Card.Body className="p-3">
                <div className="small fw-bold text-secondary">Toplam {t.doviz}</div>
                <div className="fs-4 fw-bold font-monospace text-primary">{paraYaz(t.bakiye)}</div>
                <div className="small text-muted">{t.hesapAdedi} hesap</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
        {ozet && ozet.hesaplar.length > 0 && (
          <Col xl={3} md={4} sm={6}>
            <Card className="border shadow-sm bg-white h-100">
              <Card.Body className="p-3">
                <div className="small fw-bold text-secondary">Hareketler</div>
                <div className="fs-4 fw-bold font-monospace">{ozet.hareketAdedi.toLocaleString("tr-TR")}</div>
                <div className="small text-muted">
                  {ozet.ilkHareket ? `${zamanYaz(ozet.ilkHareket).slice(0, 10)} – ${zamanYaz(ozet.sonHareket).slice(0, 10)}` : "Hareket yok"}
                </div>
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>

      {!!ozet?.eslesmeyenHesapAdedi && (
        <Alert variant="warning" className="small py-2">
          {ozet.eslesmeyenHesapAdedi} Vomsis hesabı bir Banka Hesap Kartı ile eşleşmedi. Eşleşmeyen hesabın hareketleri fişe aktarılmaz.{" "}
          <Link to="/ebanka/hesaplar">Hesaplar ekranından eşleyin.</Link>
        </Alert>
      )}

      {ozet && ozet.hesaplar.length > 0 && (
        <Card className="border shadow-sm w-100 bg-white">
          <Card.Header className="bg-white py-2 small fw-bold text-secondary">Hesaplar</Card.Header>
          <Card.Body className="p-0">
            <Table size="sm" hover responsive className="mb-0 small align-middle">
              <thead className="table-light">
                <tr>
                  <th>Banka</th>
                  <th>Şube</th>
                  <th>Hesap No</th>
                  <th>IBAN</th>
                  <th>Döviz</th>
                  <th className="text-end">Bakiye</th>
                  <th>Banka Hesap Kartı</th>
                </tr>
              </thead>
              <tbody>
                {ozet.hesaplar.map((h) => (
                  <tr key={h.vomsisHesapId} className={h.aktif ? undefined : "text-muted"}>
                    <td className="fw-semibold">{h.bankaAdi}</td>
                    <td>{h.subeAdi || h.subeKodu || "-"}</td>
                    <td className="font-monospace">{h.hesapNo || "-"}</td>
                    <td className="font-monospace">{ibanYaz(h.iban)}</td>
                    <td>{h.doviz}</td>
                    <td className="text-end font-monospace fw-bold">{paraYaz(h.bakiye)}</td>
                    <td>
                      {!h.aktif ? (
                        <Badge bg="secondary">Pasif</Badge>
                      ) : h.bankaId ? (
                        `${h.bankaHesapNo || ""} ${h.bankaHesapAdi || ""}`.trim()
                      ) : (
                        <Badge bg="warning" text="dark">
                          Eşleşmedi
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      <EsitlemeModal
        show={esitlemeAcik}
        sonEsitleme={ozet?.sonEsitleme ?? null}
        onHide={() => setEsitlemeAcik(false)}
        onBitti={(s) => {
          setEsitlemeAcik(false);
          bildir("success", esitlemeOzeti(s));
          yukle();
        }}
      />
    </div>
  );
};

export default EBankaOzetPage;

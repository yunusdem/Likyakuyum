import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { IconPlus } from "@tabler/icons-react";
import { adminApi, FirmaDto, FirmaDurum } from "../services/adminApi";
import FirmaFormu from "../components/FirmaFormu";
import { DogrulamaRozeti, DurumRozeti, LisansRozeti } from "../components/FirmaRozetleri";

type DurumFiltresi = "HEPSI" | FirmaDurum;

const FirmalarPage: React.FC = () => {
  const navigate = useNavigate();
  const [firmalar, setFirmalar] = useState<FirmaDto[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [durum, setDurum] = useState<DurumFiltresi>("HEPSI");
  const [ekleAcik, setEkleAcik] = useState(false);

  const yukle = useCallback(async () => {
    try {
      setFirmalar(await adminApi.firmalar());
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Firmalar getirilemedi.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    return firmalar.filter(
      (f) =>
        (durum === "HEPSI" || f.durum === durum) &&
        (q === "" ||
          [f.firmaKodu, f.unvan, f.vknTckn, f.yetkiliKisi, f.dbName].some((v) => (v || "").toLocaleLowerCase("tr").includes(q)))
    );
  }, [firmalar, arama, durum]);

  return (
    <>
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <h5 className="mb-0">Firmalar</h5>
            <div className="d-flex flex-wrap gap-2">
              <Form.Control
                size="sm"
                style={{ width: 220 }}
                placeholder="Kod, unvan, VKN, veritabanı…"
                value={arama}
                onChange={(e) => setArama(e.target.value)}
              />
              <Form.Select size="sm" style={{ width: 160 }} value={durum} onChange={(e) => setDurum(e.target.value as DurumFiltresi)}>
                <option value="HEPSI">Tüm durumlar</option>
                <option value="AKTIF">Aktif</option>
                <option value="DONDURULMUS">Dondurulmuş</option>
                <option value="PASIF">Pasif</option>
              </Form.Select>
              <Button className="btn-adm" size="sm" onClick={() => setEkleAcik(true)}>
                <IconPlus size={16} className="me-1" />
                Yeni Firma
              </Button>
            </div>
          </div>

          {hata && <Alert variant="danger">{hata}</Alert>}

          {yukleniyor ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : gorunen.length === 0 ? (
            <div className="text-muted py-4 text-center">
              {firmalar.length === 0 ? "Henüz firma tanımlanmamış." : "Aramaya uyan firma yok."}
            </div>
          ) : (
            <Table hover responsive className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Unvan</th>
                  <th>Durum</th>
                  <th>Lisans bitiş</th>
                  <th>Kullanıcı</th>
                  <th>Doğrulama</th>
                  <th>Veritabanı</th>
                </tr>
              </thead>
              <tbody>
                {gorunen.map((f) => (
                  <tr key={f.firmaId} role="button" onClick={() => navigate(`/firmalar/${f.firmaId}`)}>
                    <td className="fw-semibold">{f.firmaKodu}</td>
                    <td>{f.unvan}</td>
                    <td>
                      <DurumRozeti durum={f.durum} />
                    </td>
                    <td>
                      <LisansRozeti firma={f} />
                    </td>
                    <td>
                      {f.kullaniciSayisi}
                      {f.aktifLisans ? ` / ${f.aktifLisans.kullaniciLimiti}` : ""}
                    </td>
                    <td>
                      <DogrulamaRozeti dogrulandi={f.dogrulandi} />
                    </td>
                    <td className="text-muted small">
                      {f.dbServer} · {f.dbName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      <Modal show={ekleAcik} onHide={() => setEkleAcik(false)} size="lg" backdrop="static" centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Yeni Firma</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <FirmaFormu
            vazgec={() => setEkleAcik(false)}
            kaydet={async (veri) => {
              const firma = await adminApi.firmaEkle(veri);
              navigate(`/firmalar/${firma.firmaId}`);
            }}
          />
        </Modal.Body>
      </Modal>
    </>
  );
};

export default FirmalarPage;

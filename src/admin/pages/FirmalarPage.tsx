import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { IconPlus } from "@tabler/icons-react";
import { adminApi, BulutDurum, FirmaDto, FirmaDurum } from "../services/adminApi";
import FirmaFormu from "../components/FirmaFormu";
import { DogrulamaRozeti, DurumRozeti, EpostaRozeti, LisansRozeti } from "../components/FirmaRozetleri";
import { UrunRozetleri } from "../components/UrunSecici";

type DurumFiltresi = "HEPSI" | FirmaDurum;

const FirmalarPage: React.FC = () => {
  const navigate = useNavigate();
  const [firmalar, setFirmalar] = useState<FirmaDto[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [durum, setDurum] = useState<DurumFiltresi>("HEPSI");
  const [ekleAcik, setEkleAcik] = useState(false);
  const [bulut, setBulut] = useState<BulutDurum | null>(null);
  // Bulut firma oluşturulduktan sonra geçici şifre yalnız bu pencerede, bir kez gösterilir
  const [sonuc, setSonuc] = useState<{
    firma: FirmaDto;
    ilkKullanici: { kullaniciAdi: string; geciciSifre: string };
  } | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);
  // Lisans ürünleri (docs/LISANS_URUN_PAKETLERI.md): firmaId → ürün kodları; paket tabloları yoksa boş
  const [urunler, setUrunler] = useState<Record<number, string[]>>({});

  const ekleAc = async () => {
    setEkleAcik(true);
    try {
      setBulut(await adminApi.bulutDurum());
    } catch {
      setBulut(null); // eski sunucu / yetki: seçenek gösterilmez, normal kayıt çalışır
    }
  };

  const sonucuKapat = () => {
    const firmaId = sonuc?.firma.firmaId;
    setSonuc(null);
    setKopyalandi(false);
    if (firmaId) navigate(`/firmalar/${firmaId}`);
  };

  const yukle = useCallback(async () => {
    try {
      setFirmalar(await adminApi.firmalar());
      setHata(null);
      adminApi
        .firmaUrunleri()
        .then(setUrunler)
        .catch(() => setUrunler({}));
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
          [f.firmaKodu, f.musteriNo, f.unvan, f.vknTckn, f.yetkiliKisi, f.dbName].some((v) => (v || "").toLocaleLowerCase("tr").includes(q)))
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
                placeholder="Kod, müşteri no, unvan, VKN…"
                value={arama}
                onChange={(e) => setArama(e.target.value)}
              />
              <Form.Select size="sm" style={{ width: 160 }} value={durum} onChange={(e) => setDurum(e.target.value as DurumFiltresi)}>
                <option value="HEPSI">Tüm durumlar</option>
                <option value="AKTIF">Aktif</option>
                <option value="DONDURULMUS">Dondurulmuş</option>
                <option value="PASIF">Pasif</option>
                <option value="SILINECEK">Silinecek</option>
                <option value="SILINDI">Silindi</option>
              </Form.Select>
              <Button className="btn-adm" size="sm" onClick={ekleAc}>
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
                  <th>Müşteri No</th>
                  <th>Unvan</th>
                  <th>Durum</th>
                  <th>Lisans bitiş</th>
                  <th>Ürün</th>
                  <th>Kullanıcı</th>
                  <th>Doğrulama</th>
                  <th>Veritabanı</th>
                </tr>
              </thead>
              <tbody>
                {gorunen.map((f) => (
                  <tr key={f.firmaId} role="button" onClick={() => navigate(`/firmalar/${f.firmaId}`)}>
                    <td className="fw-semibold">{f.firmaKodu}</td>
                    <td>{f.musteriNo || <span className="text-danger small">tanımlı değil</span>}</td>
                    <td>{f.unvan}</td>
                    <td>
                      <DurumRozeti durum={f.durum} />
                    </td>
                    <td>
                      <LisansRozeti firma={f} />
                    </td>
                    <td>
                      {urunler[f.firmaId]?.length ? (
                        <UrunRozetleri urunler={urunler[f.firmaId]} kisa />
                      ) : (
                        <span className="text-muted small">{f.aktifLisans?.paketAdi || "-"}</span>
                      )}
                    </td>
                    <td>
                      {f.kullaniciSayisi}
                      {f.aktifLisans ? ` / ${f.aktifLisans.kullaniciLimiti}` : ""}
                    </td>
                    <td>
                      <DogrulamaRozeti dogrulandi={f.dogrulandi} /> <EpostaRozeti firma={f} />
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
            bulut={bulut}
            bulutKaydet={async (veri) => {
              const yanit = await adminApi.firmaBulutEkle(veri);
              setEkleAcik(false);
              setSonuc(yanit);
              yukle();
            }}
          />
        </Modal.Body>
      </Modal>

      <Modal show={!!sonuc} onHide={sonucuKapat} backdrop="static" keyboard={false} centered>
        <Modal.Header>
          <Modal.Title as="h5">Firma oluşturuldu</Modal.Title>
        </Modal.Header>
        {sonuc && (
          <Modal.Body>
            <Table size="sm" className="mb-3">
              <tbody>
                <tr>
                  <th className="fw-normal text-muted">Firma</th>
                  <td>
                    {sonuc.firma.firmaKodu} · {sonuc.firma.unvan}
                  </td>
                </tr>
                <tr>
                  <th className="fw-normal text-muted">Müşteri No</th>
                  <td>{sonuc.firma.musteriNo}</td>
                </tr>
                <tr>
                  <th className="fw-normal text-muted">Veritabanı</th>
                  <td>
                    {sonuc.firma.dbServer} · {sonuc.firma.dbName}
                  </td>
                </tr>
                <tr>
                  <th className="fw-normal text-muted">İlk kullanıcı</th>
                  <td className="fw-semibold">{sonuc.ilkKullanici.kullaniciAdi}</td>
                </tr>
                <tr>
                  <th className="fw-normal text-muted">Geçici şifre</th>
                  <td>
                    <code className="fs-6">{sonuc.ilkKullanici.geciciSifre}</code>{" "}
                    <Button
                      size="sm"
                      variant="outline-secondary"
                      className="ms-2"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(sonuc.ilkKullanici.geciciSifre);
                          setKopyalandi(true);
                        } catch {
                          setKopyalandi(false);
                        }
                      }}
                    >
                      {kopyalandi ? "Kopyalandı" : "Kopyala"}
                    </Button>
                  </td>
                </tr>
              </tbody>
            </Table>
            <Alert variant="warning" className="mb-0">
              Geçici şifre yalnızca şimdi gösteriliyor. Firmaya iletin; kullanıcı ilk girişte kendi şifresini belirler.
            </Alert>
          </Modal.Body>
        )}
        <Modal.Footer>
          <Button className="btn-adm" onClick={sonucuKapat}>
            Tamam, firmaya git
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default FirmalarPage;

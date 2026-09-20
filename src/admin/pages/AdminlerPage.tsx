import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { IconPlus } from "@tabler/icons-react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, AdminDto, tarihYaz } from "../services/adminApi";

interface GeciciSifreBilgisi {
  kullaniciAdi: string;
  sifre: string;
}

const AdminlerPage: React.FC = () => {
  const { admin: ben } = useAdminAuth();
  const [adminler, setAdminler] = useState<AdminDto[]>([]);
  const [azamiAktif, setAzamiAktif] = useState(3);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [islemde, setIslemde] = useState<number | null>(null);

  const [ekleAcik, setEkleAcik] = useState(false);
  const [yeniKullaniciAdi, setYeniKullaniciAdi] = useState("");
  const [yeniAdSoyad, setYeniAdSoyad] = useState("");
  const [ekleHata, setEkleHata] = useState<string | null>(null);
  const [ekleniyor, setEkleniyor] = useState(false);

  const [onay, setOnay] = useState<{ metin: string; calistir: () => Promise<void> } | null>(null);
  const [geciciSifre, setGeciciSifre] = useState<GeciciSifreBilgisi | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  const yukle = useCallback(async () => {
    try {
      const sonuc = await adminApi.adminler();
      setAdminler(sonuc.adminler);
      setAzamiAktif(sonuc.azamiAktif);
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Adminler getirilemedi.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const aktifSayisi = adminler.filter((a) => a.durum === "AKTIF").length;
  const limitDolu = aktifSayisi >= azamiAktif;

  const ekle = async (e: React.FormEvent) => {
    e.preventDefault();
    setEkleHata(null);
    setEkleniyor(true);
    try {
      const sonuc = await adminApi.adminEkle(yeniKullaniciAdi.trim(), yeniAdSoyad.trim());
      setEkleAcik(false);
      setYeniKullaniciAdi("");
      setYeniAdSoyad("");
      setKopyalandi(false);
      setGeciciSifre({ kullaniciAdi: sonuc.admin.kullaniciAdi, sifre: sonuc.geciciSifre });
      await yukle();
    } catch (err: any) {
      setEkleHata(err?.message || "Admin oluşturulamadı.");
    } finally {
      setEkleniyor(false);
    }
  };

  const islemYap = async (adminId: number, is: () => Promise<void>) => {
    setIslemde(adminId);
    setHata(null);
    try {
      await is();
      await yukle();
    } catch (err: any) {
      setHata(err?.message || "İşlem yapılamadı.");
    } finally {
      setIslemde(null);
    }
  };

  const durumDegistir = (a: AdminDto) => {
    const yeniDurum = a.durum === "AKTIF" ? "PASIF" : "AKTIF";
    setOnay({
      metin:
        yeniDurum === "PASIF"
          ? `${a.adSoyad} (@${a.kullaniciAdi}) pasife alınsın mı? Açık oturumu kapanır ve panele giremez.`
          : `${a.adSoyad} (@${a.kullaniciAdi}) yeniden aktif edilsin mi?`,
      calistir: () =>
        islemYap(a.adminId, async () => {
          await adminApi.adminGuncelle(a.adminId, { durum: yeniDurum });
        }),
    });
  };

  const sifreSifirla = (a: AdminDto) => {
    setOnay({
      metin: `${a.adSoyad} (@${a.kullaniciAdi}) için şifre sıfırlansın mı? Mevcut şifresi geçersiz olur ve açık oturumu kapanır.`,
      calistir: () =>
        islemYap(a.adminId, async () => {
          const sonuc = await adminApi.adminSifreSifirla(a.adminId);
          setKopyalandi(false);
          setGeciciSifre({ kullaniciAdi: a.kullaniciAdi, sifre: sonuc.geciciSifre });
        }),
    });
  };

  const kopyala = async () => {
    if (!geciciSifre) return;
    try {
      await navigator.clipboard.writeText(geciciSifre.sifre);
      setKopyalandi(true);
    } catch {
      // pano izni yoksa şifre ekrandan elle seçilip kopyalanabilir
    }
  };

  return (
    <>
      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-0">Adminler</h5>
              <small className="text-muted">
                Aktif: {aktifSayisi} / {azamiAktif}
              </small>
            </div>
            <Button
              className="btn-adm"
              size="sm"
              disabled={limitDolu}
              title={limitDolu ? `En fazla ${azamiAktif} aktif admin olabilir` : undefined}
              onClick={() => {
                setEkleHata(null);
                setEkleAcik(true);
              }}
            >
              <IconPlus size={16} className="me-1" />
              Yeni Admin
            </Button>
          </div>

          {hata && <Alert variant="danger">{hata}</Alert>}

          {yukleniyor ? (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          ) : (
            <Table hover responsive className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Kullanıcı adı</th>
                  <th>Ad Soyad</th>
                  <th>Durum</th>
                  <th>Son giriş</th>
                  <th>Oluşturma</th>
                  <th className="text-end">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {adminler.map((a) => {
                  const kendisi = a.adminId === ben?.adminId;
                  return (
                    <tr key={a.adminId}>
                      <td>
                        {a.kullaniciAdi}
                        {kendisi && <span className="text-muted ms-1">(siz)</span>}
                      </td>
                      <td>{a.adSoyad}</td>
                      <td>
                        <Badge bg={a.durum === "AKTIF" ? "success" : "secondary"}>
                          {a.durum === "AKTIF" ? "Aktif" : "Pasif"}
                        </Badge>
                        {a.sifreDegismeli && (
                          <Badge bg="warning" text="dark" className="ms-1">
                            Şifre bekliyor
                          </Badge>
                        )}
                      </td>
                      <td>{tarihYaz(a.sonGiris)}</td>
                      <td>{tarihYaz(a.olusturmaTarihi)}</td>
                      <td className="text-end">
                        {!kendisi && (
                          <>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="me-2"
                              disabled={islemde === a.adminId}
                              onClick={() => sifreSifirla(a)}
                            >
                              Şifre Sıfırla
                            </Button>
                            <Button
                              variant={a.durum === "AKTIF" ? "outline-danger" : "outline-success"}
                              size="sm"
                              disabled={islemde === a.adminId || (a.durum === "PASIF" && limitDolu)}
                              onClick={() => durumDegistir(a)}
                            >
                              {a.durum === "AKTIF" ? "Pasife Al" : "Aktif Et"}
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Yeni admin */}
      <Modal show={ekleAcik} onHide={() => !ekleniyor && setEkleAcik(false)} centered>
        <Form onSubmit={ekle} autoComplete="off">
          <Modal.Header closeButton>
            <Modal.Title as="h5">Yeni Admin</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {ekleHata && <Alert variant="danger">{ekleHata}</Alert>}
            <Form.Group className="mb-3" controlId="admYeniKullaniciAdi">
              <Form.Label>Kullanıcı adı</Form.Label>
              <Form.Control
                value={yeniKullaniciAdi}
                onChange={(e) => setYeniKullaniciAdi(e.target.value)}
                required
                minLength={3}
                maxLength={50}
                pattern="[a-zA-Z0-9._\-]+"
                autoFocus
              />
              <Form.Text muted>Harf, rakam, nokta, alt çizgi ve tire.</Form.Text>
            </Form.Group>
            <Form.Group controlId="admYeniAdSoyad">
              <Form.Label>Ad Soyad</Form.Label>
              <Form.Control
                value={yeniAdSoyad}
                onChange={(e) => setYeniAdSoyad(e.target.value)}
                required
                minLength={2}
                maxLength={100}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setEkleAcik(false)} disabled={ekleniyor}>
              Vazgeç
            </Button>
            <Button type="submit" className="btn-adm" disabled={ekleniyor}>
              {ekleniyor ? <Spinner animation="border" size="sm" /> : "Oluştur"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Onay */}
      <Modal show={!!onay} onHide={() => setOnay(null)} centered>
        <Modal.Body className="p-4">{onay?.metin}</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setOnay(null)}>
            Vazgeç
          </Button>
          <Button
            className="btn-adm"
            onClick={() => {
              const calistir = onay?.calistir;
              setOnay(null);
              calistir?.();
            }}
          >
            Evet
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Geçici şifre: yalnızca bir kez gösterilir */}
      <Modal show={!!geciciSifre} onHide={() => setGeciciSifre(null)} backdrop="static" keyboard={false} centered>
        <Modal.Header>
          <Modal.Title as="h5">Geçici Şifre</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>@{geciciSifre?.kullaniciAdi}</strong> için geçici şifre:
          </p>
          <div className="adm-gecici-sifre mb-3">{geciciSifre?.sifre}</div>
          <Alert variant="warning" className="mb-0">
            Bu şifre bir daha gösterilmez. Kişiye güvenli bir yoldan iletin; ilk girişte kendi şifresini belirleyecek.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={kopyala}>
            {kopyalandi ? "Kopyalandı" : "Kopyala"}
          </Button>
          <Button className="btn-adm" onClick={() => setGeciciSifre(null)}>
            Not aldım, kapat
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default AdminlerPage;

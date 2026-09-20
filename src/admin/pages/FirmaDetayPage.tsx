import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Tab, Table, Tabs } from "react-bootstrap";
import { adminApi, FirmaDto, FirmaDurum, gunYaz, LisansDto, LisansGirdi, tarihYaz } from "../services/adminApi";
import FirmaFormu from "../components/FirmaFormu";
import FirmaKullanicilari from "../components/FirmaKullanicilari";
import FirmaModulleri from "../components/FirmaModulleri";
import FirmaEpostaDogrulama from "../components/FirmaEpostaDogrulama";
import { DogrulamaRozeti, DURUM_ETIKETI, DurumRozeti, EpostaRozeti, LisansRozeti } from "../components/FirmaRozetleri";

const DURUM_ACIKLAMASI: Record<FirmaDurum, string> = {
  AKTIF: "Firma normal çalışır.",
  DONDURULMUS:
    "Kullanıcılar giremez; giriş ekranında “Hesabınız donduruldu” penceresi çıkar. İçerideki kullanıcılar bir sonraki işlemlerinde düşer. Veriler durur.",
  PASIF: "Kullanılmayan firma. Kullanıcılar giremez; içerideki kullanıcılar bir sonraki işlemlerinde düşer. Veriler durur.",
};

const bugun = () => new Date().toISOString().slice(0, 10);
const birYilSonra = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

const FirmaDetayPage: React.FC = () => {
  const firmaId = Number(useParams().id);
  const [firma, setFirma] = useState<FirmaDto | null>(null);
  const [lisanslar, setLisanslar] = useState<LisansDto[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);

  const [durumModal, setDurumModal] = useState<FirmaDurum | null>(null);
  const [durumNotu, setDurumNotu] = useState("");
  const [dogrulamaNotu, setDogrulamaNotu] = useState("");
  const [lisansAcik, setLisansAcik] = useState(false);
  const [lisans, setLisans] = useState<LisansGirdi>({
    lisansAnahtari: "",
    baslangic: bugun(),
    bitis: birYilSonra(),
    kullaniciLimiti: 1,
    paketAdi: "",
    notlar: "",
  });
  const [lisansHata, setLisansHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      const [f, l] = await Promise.all([adminApi.firma(firmaId), adminApi.lisanslar(firmaId)]);
      setFirma(f);
      setLisanslar(l);
      setDogrulamaNotu(f.dogrulamaNotu ?? "");
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Firma getirilemedi.");
    }
  }, [firmaId]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  /** Tek seferde bir işlem; sonucu firmaya yazar, hata/bilgi şeridini günceller. */
  const calistir = async (ad: string, is: () => Promise<string | void>) => {
    setMesgul(ad);
    setHata(null);
    setBilgi(null);
    try {
      const mesaj = await is();
      if (mesaj) setBilgi(mesaj);
    } catch (err: any) {
      setHata(err?.message || "İşlem yapılamadı.");
    } finally {
      setMesgul(null);
    }
  };

  if (!firma) {
    return hata ? (
      <Alert variant="danger">
        {hata} <Link to="/firmalar">Firmalara dön</Link>
      </Alert>
    ) : (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  const durumuKaydet = () =>
    calistir("durum", async () => {
      const hedef = durumModal!;
      setDurumModal(null);
      setFirma(await adminApi.firmaDurum(firmaId, hedef, durumNotu));
      return `Firma durumu: ${DURUM_ETIKETI[hedef]}.`;
    });

  const lisansKaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    setLisansHata(null);
    if (lisans.bitis < lisans.baslangic) return setLisansHata("Bitiş tarihi başlangıçtan önce olamaz.");
    setMesgul("lisans");
    try {
      const sonuc = await adminApi.lisansEkle(firmaId, lisans);
      setFirma(sonuc.firma);
      setLisanslar(sonuc.lisanslar);
      setLisansAcik(false);
      setBilgi("Lisans eklendi.");
    } catch (err: any) {
      setLisansHata(err?.message || "Lisans eklenemedi.");
    } finally {
      setMesgul(null);
    }
  };

  const lisansFormunuAc = () => {
    // Uzatma: yeni lisans, mevcut lisansın bittiği günün ertesinden başlar ve aynı limit/paketle gelir
    const mevcut = firma.aktifLisans;
    let baslangic = bugun();
    if (mevcut && mevcut.bitis >= baslangic) {
      const d = new Date(`${mevcut.bitis}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      baslangic = d.toISOString().slice(0, 10);
    }
    const bitis = new Date(`${baslangic}T00:00:00Z`);
    bitis.setUTCFullYear(bitis.getUTCFullYear() + 1);
    bitis.setUTCDate(bitis.getUTCDate() - 1);
    setLisans({
      lisansAnahtari: "",
      baslangic,
      bitis: bitis.toISOString().slice(0, 10),
      kullaniciLimiti: mevcut?.kullaniciLimiti ?? Math.max(1, firma.kullaniciSayisi),
      paketAdi: mevcut?.paketAdi ?? "",
      notlar: "",
    });
    setLisansHata(null);
    setLisansAcik(true);
  };

  return (
    <>
      <div className="mb-3">
        <Link to="/firmalar" className="text-decoration-none">
          ← Firmalar
        </Link>
      </div>

      <Card className="shadow-sm mb-3">
        <Card.Body className="p-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <h5 className="mb-1">
                {firma.unvan} <span className="text-muted fw-normal">· {firma.firmaKodu}</span>
              </h5>
              <div className="small mb-2">
                Müşteri No:{" "}
                {firma.musteriNo ? (
                  <strong>{firma.musteriNo}</strong>
                ) : (
                  <span className="text-danger">tanımlı değil</span>
                )}
                <span className="text-muted ms-3">Program türü: {firma.prgTur}</span>
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <DurumRozeti durum={firma.durum} />
                <LisansRozeti firma={firma} />
                <DogrulamaRozeti dogrulandi={firma.dogrulandi} />
                <EpostaRozeti firma={firma} />
                <span className="text-muted small">
                  Kullanıcı: {firma.kullaniciSayisi}
                  {firma.aktifLisans ? ` / ${firma.aktifLisans.kullaniciLimiti}` : ""}
                </span>
              </div>
              {firma.durumNotu && <div className="text-muted small mt-2">Durum notu: {firma.durumNotu}</div>}
            </div>
            <div className="d-flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline-danger"
                disabled={!!mesgul}
                title="Firmanın tüm açık oturumlarını kapatır; kullanıcılar yeniden giriş yapabilir"
                onClick={() =>
                  calistir("oturum", async () => {
                    const sonuc = await adminApi.firmaOturumlariniKapat(firmaId);
                    return `${sonuc.kapanan} oturum kapatıldı.`;
                  })
                }
              >
                Oturumları Kapat
              </Button>
              {(["AKTIF", "DONDURULMUS", "PASIF"] as FirmaDurum[])
                .filter((d) => d !== firma.durum)
                .map((d) => (
                  <Button
                    key={d}
                    size="sm"
                    variant={d === "AKTIF" ? "outline-success" : d === "DONDURULMUS" ? "outline-warning" : "outline-secondary"}
                    disabled={!!mesgul}
                    onClick={() => {
                      setDurumNotu(d === "AKTIF" ? "" : (firma.durumNotu ?? ""));
                      setDurumModal(d);
                    }}
                  >
                    {d === "AKTIF" ? "Aktif Et" : d === "DONDURULMUS" ? "Dondur" : "Pasife Al"}
                  </Button>
                ))}
            </div>
          </div>
        </Card.Body>
      </Card>

      {hata && <Alert variant="danger">{hata}</Alert>}
      {bilgi && (
        <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
          {bilgi}
        </Alert>
      )}

      <Card className="shadow-sm">
        <Card.Body className="p-4">
          <Tabs defaultActiveKey="bilgi" className="mb-4">
            <Tab eventKey="bilgi" title="Bilgi & Bağlantı">
              <FirmaFormu
                key={firma.firmaId}
                firma={firma}
                kaydet={async (veri) => {
                  setFirma(await adminApi.firmaGuncelle(firmaId, veri));
                  setBilgi("Firma bilgileri kaydedildi.");
                }}
              />
            </Tab>

            <Tab eventKey="dogrulama" title="Doğrulama">
              <Row className="g-4">
                <Col lg={12}>
                  <h6>Firma kimlik onayı</h6>
                  <div className="text-muted small mb-2">
                    VKN/TCKN, unvan, vergi dairesi ve yetkili bilgilerini kontrol ettikten sonra işaretleyin.
                    {firma.dogrulamaTarihi && (
                      <>
                        {" "}
                        Son işlem: {tarihYaz(firma.dogrulamaTarihi)}
                        {firma.dogrulayanAdmin ? ` · @${firma.dogrulayanAdmin}` : ""}
                      </>
                    )}
                  </div>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    className="mb-2"
                    placeholder="Doğrulama notu (isteğe bağlı)"
                    maxLength={500}
                    value={dogrulamaNotu}
                    onChange={(e) => setDogrulamaNotu(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className={firma.dogrulandi ? "" : "btn-adm"}
                    variant={firma.dogrulandi ? "outline-secondary" : undefined}
                    disabled={!!mesgul}
                    onClick={() =>
                      calistir("dogrulama", async () => {
                        const hedef = !firma.dogrulandi;
                        setFirma(await adminApi.firmaDogrulama(firmaId, hedef, dogrulamaNotu));
                        return hedef ? "Firma doğrulandı olarak işaretlendi." : "Doğrulama kaldırıldı.";
                      })
                    }
                  >
                    {firma.dogrulandi ? "Doğrulamayı Kaldır" : "Doğrulandı Olarak İşaretle"}
                  </Button>
                </Col>

                <Col lg={12}>
                  <FirmaEpostaDogrulama firma={firma} firmaGuncellendi={setFirma} bildir={setBilgi} />
                </Col>

                <Col lg={6}>
                  <h6>Veritabanı bağlantısı</h6>
                  <div className="small mb-2">
                    {firma.dbSonTestSonucu ? (
                      <>
                        <div>{firma.dbSonTestSonucu}</div>
                        <div className="text-muted">{tarihYaz(firma.dbSonTestTarihi)}</div>
                      </>
                    ) : (
                      <span className="text-muted">Henüz test edilmedi.</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={!!mesgul}
                    onClick={() =>
                      calistir("dbtest", async () => {
                        const sonuc = await adminApi.firmaDbTest(firmaId);
                        setFirma(sonuc.firma);
                        if (!sonuc.basarili) throw new Error(sonuc.sonuc);
                        return sonuc.sonuc;
                      })
                    }
                  >
                    {mesgul === "dbtest" ? <Spinner animation="border" size="sm" /> : "Bağlantıyı Test Et"}
                  </Button>
                </Col>

                <Col lg={6}>
                  <h6>MASAK durumu</h6>
                  <div className="small mb-2">
                    {firma.masakDurumu ? (
                      <>
                        <div>{firma.masakDurumu}</div>
                        <div className="text-muted">{tarihYaz(firma.masakSonKontrol)}</div>
                      </>
                    ) : (
                      <span className="text-muted">Henüz kontrol edilmedi.</span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    disabled={!!mesgul}
                    onClick={() =>
                      calistir("masak", async () => {
                        const sonuc = await adminApi.firmaMasakKontrol(firmaId);
                        setFirma(sonuc.firma);
                        return sonuc.sonuc;
                      })
                    }
                  >
                    {mesgul === "masak" ? <Spinner animation="border" size="sm" /> : "MASAK Durumunu Kontrol Et"}
                  </Button>
                </Col>
              </Row>
            </Tab>

            <Tab eventKey="kullanicilar" title={`Kullanıcılar (${firma.kullaniciSayisi})`} mountOnEnter>
              <FirmaKullanicilari firma={firma} firmaYenile={async () => setFirma(await adminApi.firma(firmaId))} />
            </Tab>

            <Tab eventKey="moduller" title="Modüller" mountOnEnter>
              <FirmaModulleri firma={firma} />
            </Tab>

            <Tab eventKey="lisans" title="Lisans">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div className="text-muted small">
                  Yeni lisans eklendiğinde firmanın geçerli lisansı o olur; öncekiler geçmiş olarak kalır.
                </div>
                <Button size="sm" className="btn-adm" onClick={lisansFormunuAc}>
                  {firma.aktifLisans ? "Lisansı Uzat / Yenile" : "Lisans Ekle"}
                </Button>
              </div>
              {lisanslar.length === 0 ? (
                <div className="text-muted py-3">Bu firmaya lisans tanımlanmamış.</div>
              ) : (
                <Table responsive className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Başlangıç</th>
                      <th>Bitiş</th>
                      <th>Kullanıcı limiti</th>
                      <th>Paket</th>
                      <th>Lisans anahtarı</th>
                      <th>Not</th>
                      <th>Eklenme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lisanslar.map((l) => (
                      <tr key={l.lisansId} className={l.aktif ? "" : "text-muted"}>
                        <td>{l.aktif ? <Badge bg="success">Geçerli</Badge> : <Badge bg="light" text="dark">Geçmiş</Badge>}</td>
                        <td>{gunYaz(l.baslangic)}</td>
                        <td>{gunYaz(l.bitis)}</td>
                        <td>{l.kullaniciLimiti}</td>
                        <td>{l.paketAdi || "-"}</td>
                        <td>{l.lisansAnahtari || "-"}</td>
                        <td style={{ maxWidth: 260 }}>{l.notlar || "-"}</td>
                        <td>{tarihYaz(l.olusturmaTarihi)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Tab>
          </Tabs>
        </Card.Body>
      </Card>

      {/* Durum değişikliği */}
      <Modal show={!!durumModal} onHide={() => setDurumModal(null)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">
            {firma.unvan}: {durumModal && DURUM_ETIKETI[durumModal]}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>{durumModal && DURUM_ACIKLAMASI[durumModal]}</p>
          <Form.Control
            as="textarea"
            rows={2}
            placeholder="Not (isteğe bağlı) — ör. neden donduruldu"
            maxLength={500}
            value={durumNotu}
            onChange={(e) => setDurumNotu(e.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setDurumModal(null)}>
            Vazgeç
          </Button>
          <Button className="btn-adm" onClick={durumuKaydet}>
            Onayla
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Lisans ekleme */}
      <Modal show={lisansAcik} onHide={() => mesgul !== "lisans" && setLisansAcik(false)} centered>
        <Form onSubmit={lisansKaydet} autoComplete="off">
          <Modal.Header closeButton>
            <Modal.Title as="h5">{firma.aktifLisans ? "Lisansı Uzat / Yenile" : "Lisans Ekle"}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {lisansHata && <Alert variant="danger">{lisansHata}</Alert>}
            <Row className="g-3">
              <Col xs={6}>
                <Form.Group controlId="lisBas">
                  <Form.Label>Başlangıç</Form.Label>
                  <Form.Control type="date" required value={lisans.baslangic} onChange={(e) => setLisans({ ...lisans, baslangic: e.target.value })} />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group controlId="lisBit">
                  <Form.Label>Bitiş (dahil)</Form.Label>
                  <Form.Control type="date" required min={lisans.baslangic} value={lisans.bitis} onChange={(e) => setLisans({ ...lisans, bitis: e.target.value })} />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group controlId="lisLimit">
                  <Form.Label>Kullanıcı limiti</Form.Label>
                  <Form.Control
                    type="number"
                    required
                    min={Math.max(1, firma.kullaniciSayisi)}
                    max={10000}
                    value={lisans.kullaniciLimiti}
                    onChange={(e) => setLisans({ ...lisans, kullaniciLimiti: Number(e.target.value) })}
                  />
                </Form.Group>
              </Col>
              <Col xs={6}>
                <Form.Group controlId="lisPaket">
                  <Form.Label>Paket</Form.Label>
                  <Form.Control maxLength={100} placeholder="ör. MASAK + e-Belge" value={lisans.paketAdi} onChange={(e) => setLisans({ ...lisans, paketAdi: e.target.value })} />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group controlId="lisAnahtar">
                  <Form.Label>Lisans anahtarı / sözleşme no</Form.Label>
                  <Form.Control maxLength={100} value={lisans.lisansAnahtari} onChange={(e) => setLisans({ ...lisans, lisansAnahtari: e.target.value })} />
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group controlId="lisNot">
                  <Form.Label>Not</Form.Label>
                  <Form.Control as="textarea" rows={2} maxLength={1000} value={lisans.notlar} onChange={(e) => setLisans({ ...lisans, notlar: e.target.value })} />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setLisansAcik(false)} disabled={mesgul === "lisans"}>
              Vazgeç
            </Button>
            <Button type="submit" className="btn-adm" disabled={mesgul === "lisans"}>
              {mesgul === "lisans" ? <Spinner animation="border" size="sm" /> : "Kaydet"}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
};

export default FirmaDetayPage;

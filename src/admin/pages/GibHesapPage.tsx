import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { adminApi, GibHesapDurumu, tarihYaz, VknSorguSonucu } from "../services/adminApi";

const KAYNAK_ETIKETI: Record<VknSorguSonucu["kaynak"], string> = {
  GIB: "GİB",
  ONBELLEK: "Önbellek",
  ICE: "ICE",
};

/**
 * Merkezi GİB (Dijital Vergi Dairesi) hesabı: bir kez girilir, bütün firmalar VKN/TCKN sorgusunda kullanır.
 * docs/GIB_VKN_SORGU_YOL_HARITASI.md
 */
const GibHesapPage: React.FC = () => {
  const [durum, setDurum] = useState<GibHesapDurumu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kod, setKod] = useState("");
  const [sifre, setSifre] = useState("");
  const [islem, setIslem] = useState<"kaydet" | "dene" | "sil" | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  const [no, setNo] = useState("");
  const [sorguluyor, setSorguluyor] = useState(false);
  const [sorguHata, setSorguHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<VknSorguSonucu | null>(null);

  useEffect(() => {
    adminApi
      .gibHesap()
      .then((d) => {
        setDurum(d);
        setKod(d.kullaniciKodu || "");
      })
      .catch((e) => setHata(e?.message || "GİB hesabı okunamadı."))
      .finally(() => setYukleniyor(false));
  }, []);

  const calistir = async (tur: "kaydet" | "dene" | "sil", is: () => Promise<GibHesapDurumu>, basari: string) => {
    setHata(null);
    setBilgi(null);
    setIslem(tur);
    try {
      const d = await is();
      setDurum(d);
      setBilgi(basari);
      if (tur === "kaydet") setSifre("");
      if (tur === "sil") {
        setKod("");
        setSifre("");
      }
    } catch (e: any) {
      setHata(e?.message || "İşlem yapılamadı.");
      // Deneme başarısızsa son hata bilgisi hesaba yazıldı; ekranda da görünsün
      if (tur === "dene") adminApi.gibHesap().then(setDurum).catch(() => undefined);
    } finally {
      setIslem(null);
    }
  };

  const kaydet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kod.trim() || !sifre) return setHata("Kullanıcı kodu ve şifre zorunludur.");
    calistir("kaydet", () => adminApi.gibHesapKaydet(kod.trim(), sifre), "Kaydedildi. Şimdi \"Bağlantıyı Dene\" ile kontrol edin.");
  };

  const sil = () => {
    if (!window.confirm("GİB hesabı silinsin mi? Silinince hiçbir firma GİB'den sorgu yapamaz.")) return;
    calistir("sil", adminApi.gibHesapSil, "GİB hesabı silindi.");
  };

  const sorgula = async (e: React.FormEvent) => {
    e.preventDefault();
    setSorguHata(null);
    setSonuc(null);
    setSorguluyor(true);
    try {
      setSonuc(await adminApi.vknSorgu(no));
    } catch (err: any) {
      setSorguHata(err?.message || "Sorgu yapılamadı.");
    } finally {
      setSorguluyor(false);
    }
  };

  if (yukleniyor) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <Row className="g-3">
      <Col lg={6}>
        <Card className="shadow-sm h-100">
          <Card.Body className="p-4">
            <h5 className="mb-1">GİB Hesabı</h5>
            <p className="text-muted small mb-3">
              Dijital Vergi Dairesi kullanıcı kodu ve şifresi. Bütün firmalar VKN / TCKN sorgusunu bu hesapla yapar.
            </p>

            {hata && <Alert variant="danger">{hata}</Alert>}
            {bilgi && <Alert variant="success">{bilgi}</Alert>}

            <Table size="sm" className="mb-3">
              <tbody>
                <tr>
                  <th style={{ width: 170 }}>Durum</th>
                  <td>
                    {!durum?.tanimli ? (
                      <Badge bg="secondary">Tanımlı değil</Badge>
                    ) : durum.sonHata && (!durum.sonBasariliGiris || durum.sonHataTarihi! > durum.sonBasariliGiris) ? (
                      <Badge bg="danger">Hata</Badge>
                    ) : durum.sonBasariliGiris ? (
                      <Badge bg="success">Çalışıyor</Badge>
                    ) : (
                      <Badge bg="warning" text="dark">Denenmedi</Badge>
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Son başarılı giriş</th>
                  <td>{tarihYaz(durum?.sonBasariliGiris)}</td>
                </tr>
                <tr>
                  <th>Son hata</th>
                  <td>{durum?.sonHata ? `${durum.sonHata} (${tarihYaz(durum.sonHataTarihi)})` : "-"}</td>
                </tr>
                <tr>
                  <th>Son değişiklik</th>
                  <td>{tarihYaz(durum?.guncellemeTarihi)}</td>
                </tr>
              </tbody>
            </Table>

            <Form onSubmit={kaydet} autoComplete="off">
              <Form.Group className="mb-3" controlId="gibKod">
                <Form.Label>Kullanıcı kodu</Form.Label>
                <Form.Control value={kod} onChange={(e) => setKod(e.target.value)} maxLength={50} autoComplete="off" />
              </Form.Group>
              <Form.Group className="mb-3" controlId="gibSifre">
                <Form.Label>Şifre</Form.Label>
                <Form.Control
                  type="password"
                  value={sifre}
                  onChange={(e) => setSifre(e.target.value)}
                  maxLength={100}
                  autoComplete="new-password"
                  placeholder={durum?.tanimli ? "Değiştirmek için yeni şifreyi yazın" : ""}
                />
              </Form.Group>
              <div className="d-flex gap-2 flex-wrap">
                <Button type="submit" disabled={!!islem}>
                  {islem === "kaydet" ? <Spinner size="sm" animation="border" /> : "Kaydet"}
                </Button>
                <Button
                  variant="outline-primary"
                  disabled={!!islem || !durum?.tanimli}
                  onClick={() => calistir("dene", adminApi.gibHesapDene, "GİB portalına giriş başarılı.")}
                >
                  {islem === "dene" ? <Spinner size="sm" animation="border" /> : "Bağlantıyı Dene"}
                </Button>
                {durum?.tanimli && (
                  <Button variant="outline-danger" className="ms-auto" disabled={!!islem} onClick={sil}>
                    Sil
                  </Button>
                )}
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Col>

      <Col lg={6}>
        <Card className="shadow-sm h-100">
          <Card.Body className="p-4">
            <h5 className="mb-1">VKN / TCKN Sorgula</h5>
            <p className="text-muted small mb-3">GİB'deki unvan, ad-soyad ve vergi dairesini gösterir.</p>

            <Form onSubmit={sorgula} className="d-flex gap-2 mb-3">
              <Form.Control
                value={no}
                onChange={(e) => setNo(e.target.value.replace(/\D/g, "").slice(0, 11))}
                placeholder="10 haneli VKN ya da 11 haneli TCKN"
                inputMode="numeric"
              />
              <Button type="submit" disabled={sorguluyor || no.length < 10}>
                {sorguluyor ? <Spinner size="sm" animation="border" /> : "Sorgula"}
              </Button>
            </Form>

            {sorguHata && <Alert variant="danger">{sorguHata}</Alert>}
            {sonuc?.sonuc === "KAYIT_YOK" && <Alert variant="warning">Bu numara GİB'de kayıtlı değil.</Alert>}
            {sonuc?.sonuc === "BULUNDU" && (
              <>
                {sonuc.uyari && <Alert variant="warning">{sonuc.uyari}</Alert>}
                <Table size="sm" bordered>
                  <tbody>
                    <tr>
                      <th style={{ width: 150 }}>{sonuc.tur}</th>
                      <td>{sonuc.no}</td>
                    </tr>
                    {sonuc.unvan && (
                      <tr>
                        <th>Unvan</th>
                        <td>{sonuc.unvan}</td>
                      </tr>
                    )}
                    {(sonuc.ad || sonuc.soyad) && (
                      <tr>
                        <th>Ad Soyad</th>
                        <td>{[sonuc.ad, sonuc.soyad].filter(Boolean).join(" ")}</td>
                      </tr>
                    )}
                    <tr>
                      <th>Vergi dairesi</th>
                      <td>{sonuc.vergiDairesi || "-"}</td>
                    </tr>
                    <tr>
                      <th>Kaynak</th>
                      <td>
                        {KAYNAK_ETIKETI[sonuc.kaynak]} · {tarihYaz(sonuc.sorguTarihi)}
                      </td>
                    </tr>
                  </tbody>
                </Table>
              </>
            )}
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
};

export default GibHesapPage;

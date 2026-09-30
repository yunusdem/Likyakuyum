import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { IconBuildingBank } from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import { gibService, GibHesapDurumu, VknSorguSonucu } from "../../services/gibService";

const KAYNAK_ETIKETI: Record<VknSorguSonucu["kaynak"], string> = { GIB: "GİB", ONBELLEK: "Önbellek", ICE: "ICE" };

/** Veritabanı saatleri UTC gibi gelir (sunucudaki yerel saat); olduğu gibi gösterilir. */
const tarihYaz = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("tr-TR", { timeZone: "UTC" }) : "-");

type Uyari = { type: "success" | "danger" | "warning"; message: string } | null;

/**
 * Firmanın kendi GİB (Dijital Vergi Dairesi) hesabı: VKN / TCKN sorgusu bu hesapla yapılır.
 * Şifre sunucuda şifreli saklanır, ekrana hiç gelmez. docs/GIB_VKN_SORGU_YOL_HARITASI.md
 */
const GibHesapSettingsPage: React.FC = () => {
  const [durum, setDurum] = useState<GibHesapDurumu | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kod, setKod] = useState("");
  const [sifre, setSifre] = useState("");
  const [islem, setIslem] = useState<"kaydet" | "dene" | "sil" | null>(null);
  const [uyari, setUyari] = useState<Uyari>(null);

  const [no, setNo] = useState("");
  const [sorguluyor, setSorguluyor] = useState(false);
  const [sorguHata, setSorguHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<VknSorguSonucu | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const d = await gibService.hesap();
      setDurum(d);
      setKod(d.kullaniciKodu || "");
    } catch (e: any) {
      setUyari({ type: "danger", message: e?.message || "GİB hesabı okunamadı." });
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const calistir = async (tur: "kaydet" | "dene" | "sil", is: () => Promise<GibHesapDurumu>, basari: string) => {
    setUyari(null);
    setIslem(tur);
    try {
      const d = await is();
      setDurum(d);
      setUyari({ type: "success", message: basari });
      if (tur === "kaydet") setSifre("");
      if (tur === "sil") {
        setKod("");
        setSifre("");
      }
    } catch (e: any) {
      setUyari({ type: "danger", message: e?.message || "İşlem yapılamadı." });
      // Deneme başarısızsa son hata hesaba yazıldı; ekranda da görünsün
      if (tur === "dene") gibService.hesap().then(setDurum).catch(() => undefined);
    } finally {
      setIslem(null);
    }
  };

  const kaydet = () => {
    if (!kod.trim() || !sifre) return setUyari({ type: "danger", message: "Kullanıcı kodu ve şifre zorunludur." });
    void calistir("kaydet", () => gibService.hesapKaydet(kod.trim(), sifre), "Kaydedildi. Şimdi \"Bağlantıyı Dene\" ile kontrol edin.");
  };

  const sil = () => {
    if (!window.confirm("GİB hesabı silinsin mi? Silinince VKN / TCKN sorgusu GİB'den yapılamaz.")) return;
    void calistir("sil", gibService.hesapSil, "GİB hesabı silindi.");
  };

  const sorgula = async (e: React.FormEvent) => {
    e.preventDefault();
    setSorguHata(null);
    setSonuc(null);
    setSorguluyor(true);
    try {
      setSonuc(await gibService.vknSorgu(no));
    } catch (err: any) {
      setSorguHata(err?.message || "Sorgu yapılamadı.");
    } finally {
      setSorguluyor(false);
    }
  };

  const hataVar = !!durum?.sonHata && (!durum.sonBasariliGiris || (durum.sonHataTarihi || "") > durum.sonBasariliGiris);

  return (
    <div className="w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="GİB Sorgu Ayarları"
        pageIcon={<IconBuildingBank size={22} className="text-primary" />}
        onSave={kaydet}
        onRefresh={() => void yukle()}
        disabled={yukleniyor || !!islem}
      />

      {uyari && (
        <Alert variant={uyari.type} dismissible onClose={() => setUyari(null)} className="py-2 px-3 mb-3 small fw-medium">
          {uyari.message}
        </Alert>
      )}

      <Row className="g-3">
        <Col lg={6}>
          <Card className="shadow-sm h-100">
            <Card.Body className="p-4">
              <h6 className="mb-1 fw-bold">GİB Hesabı</h6>
              <p className="text-muted small mb-3">
                Dijital Vergi Dairesi (e-Arşiv Portalı) kullanıcı kodu ve şifresi. Cari kartı ve e-Belge ekranlarındaki
                VKN / TCKN sorgusu bu hesapla yapılır.
              </p>

              {yukleniyor ? (
                <div className="text-center py-4">
                  <Spinner animation="border" />
                </div>
              ) : (
                <>
                  <Table size="sm" className="mb-3 small">
                    <tbody>
                      <tr>
                        <th style={{ width: 170 }}>Durum</th>
                        <td>
                          {!durum?.tanimli ? (
                            <Badge bg="secondary">Tanımlı değil</Badge>
                          ) : hataVar ? (
                            <Badge bg="danger">Hata</Badge>
                          ) : durum.sonBasariliGiris ? (
                            <Badge bg="success">Çalışıyor</Badge>
                          ) : (
                            <Badge bg="warning" text="dark">
                              Denenmedi
                            </Badge>
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
                        <td>
                          {tarihYaz(durum?.guncellemeTarihi)}
                          {durum?.guncelleyen ? ` · ${durum.guncelleyen}` : ""}
                        </td>
                      </tr>
                    </tbody>
                  </Table>

                  <Form
                    onSubmit={(e) => {
                      e.preventDefault();
                      kaydet();
                    }}
                    autoComplete="off"
                  >
                    <Form.Group className="mb-3" controlId="gibKod">
                      <Form.Label className="small fw-semibold">Kullanıcı kodu</Form.Label>
                      <Form.Control value={kod} onChange={(e) => setKod(e.target.value)} maxLength={50} autoComplete="off" />
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="gibSifre">
                      <Form.Label className="small fw-semibold">Şifre</Form.Label>
                      <Form.Control
                        type="password"
                        value={sifre}
                        onChange={(e) => setSifre(e.target.value)}
                        maxLength={100}
                        autoComplete="new-password"
                        placeholder={durum?.tanimli ? "Değiştirmek için şifreyi yeniden yazın" : ""}
                      />
                    </Form.Group>
                    <div className="d-flex gap-2 flex-wrap">
                      <Button type="submit" disabled={!!islem}>
                        {islem === "kaydet" ? <Spinner size="sm" animation="border" /> : "Kaydet"}
                      </Button>
                      <Button
                        variant="outline-primary"
                        disabled={!!islem || !durum?.tanimli}
                        onClick={() => void calistir("dene", gibService.hesapDene, "GİB portalına giriş başarılı.")}
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
                </>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="shadow-sm h-100">
            <Card.Body className="p-4">
              <h6 className="mb-1 fw-bold">VKN / TCKN Sorgula</h6>
              <p className="text-muted small mb-3">GİB'deki unvan, ad-soyad ve vergi dairesini gösterir; hiçbir yere kayıt yapmaz.</p>

              <Form onSubmit={sorgula} className="d-flex gap-2 mb-3">
                <Form.Control
                  value={no}
                  onChange={(e) => setNo(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  placeholder="10 haneli VKN ya da 11 haneli TCKN"
                  inputMode="numeric"
                  className="font-monospace"
                />
                <Button type="submit" disabled={sorguluyor || no.length < 10}>
                  {sorguluyor ? <Spinner size="sm" animation="border" /> : "Sorgula"}
                </Button>
              </Form>

              {sorguHata && <Alert variant="danger" className="small">{sorguHata}</Alert>}
              {sonuc?.sonuc === "KAYIT_YOK" && (
                <Alert variant="warning" className="small">
                  Bu numara GİB'de kayıtlı değil.
                </Alert>
              )}
              {sonuc?.sonuc === "BULUNDU" && (
                <>
                  {sonuc.uyari && <Alert variant="warning" className="small">{sonuc.uyari}</Alert>}
                  <Table size="sm" bordered className="small">
                    <tbody>
                      <tr>
                        <th style={{ width: 150 }}>{sonuc.tur}</th>
                        <td className="font-monospace">{sonuc.no}</td>
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
    </div>
  );
};

export default GibHesapSettingsPage;

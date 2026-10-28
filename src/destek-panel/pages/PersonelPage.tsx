import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { IconPlus, IconRefresh } from "@tabler/icons-react";
import { zamanOnce } from "../../components/destek/destekOrtak";
import { usePanelAuth } from "../context/PanelAuthContext";
import { panelApi, PersonelDto, PersonelGorme, PersonelRol } from "../services/panelApi";

const GORME_ADI: Record<PersonelGorme, string> = { TUMU: "Tüm talepler", ATANAN: "Havuz + kendine atananlar" };

/** Destek admini > Personel (D4–D6): ekle, rol, görme yetkisi, pasif, şifre sıfırla, kilit aç. */
const PersonelPage: React.FC = () => {
  const { personel: ben } = usePanelAuth();
  const [liste, setListe] = useState<PersonelDto[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [yeniAcik, setYeniAcik] = useState(false);
  const [form, setForm] = useState({ kullaniciAdi: "", adSoyad: "", rol: "PERSONEL" as PersonelRol, gorme: "TUMU" as PersonelGorme });
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [gecici, setGecici] = useState<{ ad: string; sifre: string } | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setListe(await panelApi.personel());
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Liste okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const islem = async (fn: () => Promise<PersonelDto[] | unknown>, basari: string) => {
    setHata(null);
    setMesaj(null);
    try {
      const s = await fn();
      if (Array.isArray(s)) setListe(s as PersonelDto[]);
      else await yukle();
      setMesaj(basari);
    } catch (err: any) {
      setHata(err?.message || "İşlem yapılamadı.");
    }
  };

  const ekle = async () => {
    setKaydediliyor(true);
    setHata(null);
    try {
      const s = await panelApi.personelEkle({ ...form, kullaniciAdi: form.kullaniciAdi.trim(), adSoyad: form.adSoyad.trim() });
      setYeniAcik(false);
      setGecici({ ad: form.kullaniciAdi.trim().toLowerCase(), sifre: s.geciciSifre });
      setForm({ kullaniciAdi: "", adSoyad: "", rol: "PERSONEL", gorme: "TUMU" });
      yukle();
    } catch (err: any) {
      setHata(err?.message || "Eklenemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const sifirla = async (p: PersonelDto) => {
    if (!window.confirm(`${p.adSoyad} için geçici şifre oluşturulsun mu? Açık oturumu kapanır.`)) return;
    try {
      const s = await panelApi.personelSifreSifirla(p.personelId);
      setGecici({ ad: p.kullaniciAdi, sifre: s.geciciSifre });
    } catch (err: any) {
      setHata(err?.message || "Şifre sıfırlanamadı.");
    }
  };

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            <h5 className="mb-0">Personel</h5>
            <small className="text-muted">Yönetim paneli adminleri buraya kendiliğinden gelir ve her zaman destek adminidir.</small>
          </div>
          <div className="d-flex gap-2">
            <Button size="sm" className="btn-adm" onClick={() => { setHata(null); setYeniAcik(true); }}>
              <IconPlus size={16} className="me-1" />
              Yeni personel
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={yukle} title="Yenile">
              <IconRefresh size={16} />
            </Button>
          </div>
        </div>
        {hata && <Alert variant="danger" dismissible onClose={() => setHata(null)}>{hata}</Alert>}
        {mesaj && <Alert variant="success" dismissible onClose={() => setMesaj(null)}>{mesaj}</Alert>}
        {yukleniyor && liste.length === 0 ? (
          <div className="text-center py-5">
            <Spinner animation="border" size="sm" />
          </div>
        ) : (
          <Table hover size="sm" className="align-middle mb-0" responsive>
            <thead>
              <tr>
                <th>Ad soyad</th>
                <th>Kullanıcı adı</th>
                <th>Rol</th>
                <th>Görme yetkisi</th>
                <th>Durum</th>
                <th>Son giriş</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {liste.map((p) => {
                const bagli = !!p.adminId;
                const kendisi = p.personelId === ben?.personelId;
                return (
                  <tr key={p.personelId} className={p.durum !== "AKTIF" ? "text-muted" : ""}>
                    <td>
                      {p.cevrimici && <span className="dsp-cevrimici" title="Çevrimiçi" />}
                      {p.adSoyad}
                      {bagli && (
                        <Badge bg="light" text="dark" className="ms-1 border fw-normal" title="Yönetim paneli hesabı">
                          yönetim
                        </Badge>
                      )}
                      {kendisi && <span className="text-muted small"> (siz)</span>}
                    </td>
                    <td>{p.kullaniciAdi}</td>
                    <td>
                      {bagli ? (
                        "Destek admini"
                      ) : (
                        <Form.Select size="sm" style={{ width: 140 }} value={p.rol} disabled={kendisi} onChange={(e) => islem(() => panelApi.personelGuncelle(p.personelId, { rol: e.target.value as PersonelRol }), "Rol değişti.")}>
                          <option value="PERSONEL">Personel</option>
                          <option value="ADMIN">Destek admini</option>
                        </Form.Select>
                      )}
                    </td>
                    <td>
                      {bagli || p.rol === "ADMIN" ? (
                        GORME_ADI.TUMU
                      ) : (
                        <Form.Select size="sm" style={{ width: 210 }} value={p.gorme} onChange={(e) => islem(() => panelApi.personelGuncelle(p.personelId, { gorme: e.target.value as PersonelGorme }), "Görme yetkisi değişti.")}>
                          <option value="TUMU">{GORME_ADI.TUMU}</option>
                          <option value="ATANAN">{GORME_ADI.ATANAN}</option>
                        </Form.Select>
                      )}
                    </td>
                    <td>
                      <Badge bg={p.durum === "AKTIF" ? "success" : "secondary"} className="fw-normal">
                        {p.durum === "AKTIF" ? "Aktif" : "Pasif"}
                      </Badge>
                      {p.kilitli && (
                        <Badge bg="danger" className="ms-1 fw-normal">
                          Kilitli
                        </Badge>
                      )}
                      {p.sifreDegismeli && !bagli && (
                        <Badge bg="warning" text="dark" className="ms-1 fw-normal" title="Henüz kendi şifresini belirlemedi">
                          Geçici şifre
                        </Badge>
                      )}
                    </td>
                    <td className="small text-muted">{p.sonGiris ? zamanOnce(p.sonGiris) : "-"}</td>
                    <td className="text-end text-nowrap">
                      {!bagli && (
                        <>
                          {p.kilitli && (
                            <Button size="sm" variant="link" className="p-0 me-2" onClick={() => islem(() => panelApi.personelKilitAc(p.personelId), "Kilit açıldı.")}>
                              Kilidi aç
                            </Button>
                          )}
                          <Button size="sm" variant="link" className="p-0 me-2" onClick={() => sifirla(p)}>
                            Şifre sıfırla
                          </Button>
                          {!kendisi &&
                            (p.durum === "AKTIF" ? (
                              <Button
                                size="sm"
                                variant="link"
                                className="p-0 text-danger"
                                onClick={() =>
                                  window.confirm(`${p.adSoyad} pasife alınsın mı? Oturumu kapanır, üzerindeki açık talepler havuza döner.`) &&
                                  islem(() => panelApi.personelGuncelle(p.personelId, { durum: "PASIF" }), "Personel pasife alındı.")
                                }
                              >
                                Pasife al
                              </Button>
                            ) : (
                              <Button size="sm" variant="link" className="p-0" onClick={() => islem(() => panelApi.personelGuncelle(p.personelId, { durum: "AKTIF" }), "Personel aktif.")}>
                                Aktif et
                              </Button>
                            ))}
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

      <Modal show={yeniAcik} onHide={() => setYeniAcik(false)}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Yeni personel</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {hata && <Alert variant="danger">{hata}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Ad soyad</Form.Label>
            <Form.Control value={form.adSoyad} maxLength={100} onChange={(e) => setForm({ ...form, adSoyad: e.target.value })} autoFocus />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Kullanıcı adı</Form.Label>
            <Form.Control value={form.kullaniciAdi} maxLength={50} onChange={(e) => setForm({ ...form, kullaniciAdi: e.target.value })} />
            <Form.Text>Harf, rakam, nokta, tire; en az 3 karakter. Küçük harfe çevrilir.</Form.Text>
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Rol</Form.Label>
            <Form.Select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as PersonelRol })}>
              <option value="PERSONEL">Personel</option>
              <option value="ADMIN">Destek admini</option>
            </Form.Select>
          </Form.Group>
          {form.rol === "PERSONEL" && (
            <Form.Group>
              <Form.Label>Görme yetkisi</Form.Label>
              <Form.Select value={form.gorme} onChange={(e) => setForm({ ...form, gorme: e.target.value as PersonelGorme })}>
                <option value="TUMU">{GORME_ADI.TUMU}</option>
                <option value="ATANAN">{GORME_ADI.ATANAN}</option>
              </Form.Select>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setYeniAcik(false)}>
            Vazgeç
          </Button>
          <Button className="btn-adm" onClick={ekle} disabled={kaydediliyor || !form.adSoyad.trim() || form.kullaniciAdi.trim().length < 3}>
            {kaydediliyor ? <Spinner size="sm" /> : "Ekle"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!gecici} onHide={() => setGecici(null)}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Geçici şifre</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            <strong>{gecici?.ad}</strong> bu şifreyle girip kendi şifresini belirleyecek. Şifre bir daha gösterilmez.
          </p>
          <div className="adm-gecici-sifre">{gecici?.sifre}</div>
        </Modal.Body>
        <Modal.Footer>
          <Button className="btn-adm" onClick={() => setGecici(null)}>
            Tamam
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default PersonelPage;

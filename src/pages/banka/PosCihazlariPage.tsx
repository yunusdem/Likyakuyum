import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconPlugConnected, IconPlus, IconTrash } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { PosCihaziItem, PosCihaziService } from "../../services/posCihaziService";
import { PosEntegrasyon, PosIslemService, PosMod, PosTanimlar, PosTerminal, PosTerminalKaydet } from "../../services/posIslemService";
import { useBildirim } from "../ebanka/ebankaOrtak";

// F- Banka / POS > E- POS Cihazları (docs/POS_ENTEGRASYON_YOL_HARITASI.md)
// Fiziksel cihazlar burada tanımlanır; muhasebe POS kartları (B- POS Cihazı Tanımları) ayrıdır (K15).

const ENTEGRASYON_ADI: Record<PosEntegrasyon, string> = { yok: "Yok (elle)", beko: "Beko", inpos: "Inpos" };
const BOS: PosTerminalKaydet = { posTerminalId: null, ad: "", entegrasyon: "yok", model: null, sicilNo: null, terminalKimlik: null, posCihaziId: null, aktif: true, vezneIdler: [] };

export const PosModRozeti: React.FC<{ mod?: PosMod }> = ({ mod }) =>
  !mod ? null : (
    <Badge bg={mod === "canli" ? "success" : mod === "test" ? "warning" : "secondary"} text={mod === "test" ? "dark" : undefined} className="px-2 py-1 fs-7">
      {mod === "canli" ? "Canlı" : mod === "test" ? "Test (örnek cihaz)" : "Kapalı"}
    </Badge>
  );

export const PosCihazlariPage: React.FC = () => {
  const [tanimlar, setTanimlar] = useState<PosTanimlar | null>(null);
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [posKartlari, setPosKartlari] = useState<PosCihaziItem[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [form, setForm] = useState<PosTerminalKaydet | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [calisan, setCalisan] = useState<string | null>(null);
  const [silinecek, setSilinecek] = useState<PosTerminal | null>(null);
  const [eslemeler, setEslemeler] = useState<{ bankaKodu: string; posCihaziId: string }[]>([]);
  const [eslemeDegisti, setEslemeDegisti] = useState(false);
  const { bildir, bildirimKutusu } = useBildirim();

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const [t, v, p] = await Promise.all([PosIslemService.getTanimlar(), CashDeskService.getVezneler().catch(() => []), PosCihaziService.getPosCihazlari().catch(() => [])]);
      setTanimlar(t);
      setVezneler(v);
      setPosKartlari(p);
      setEslemeler(t.bankaEslemeleri.map((e) => ({ bankaKodu: e.bankaKodu, posCihaziId: String(e.posCihaziId) })));
      setEslemeDegisti(false);
    } catch (err: any) {
      bildir("danger", err?.message || "POS cihazları okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [bildir]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const kaydet = async () => {
    if (!form) return;
    setKaydediliyor(true);
    try {
      await PosIslemService.terminalKaydet(form);
      setForm(null);
      bildir("success", "POS cihazı kaydedildi.");
      await yukle();
    } catch (err: any) {
      bildir("danger", err?.message || "POS cihazı kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const sil = async () => {
    if (!silinecek) return;
    try {
      await PosIslemService.terminalSil(silinecek.posTerminalId);
      bildir("success", "POS cihazı silindi.");
      await yukle();
    } catch (err: any) {
      bildir("danger", err?.message || "POS cihazı silinemedi.");
    } finally {
      setSilinecek(null);
    }
  };

  const dene = async (t: PosTerminal, is: "baglanti" | "gunsonu") => {
    setCalisan(`${is}-${t.posTerminalId}`);
    try {
      const s = is === "baglanti" ? await PosIslemService.baglantiTesti(t.posTerminalId) : await PosIslemService.gunSonu(t.posTerminalId);
      bildir("success", s.ayrinti);
    } catch (err: any) {
      bildir("danger", err?.message || "İşlem yapılamadı.");
    } finally {
      setCalisan(null);
    }
  };

  const eslemeleriKaydet = async () => {
    setKaydediliyor(true);
    try {
      await PosIslemService.bankaEslemeleriniYaz(eslemeler.map((e) => ({ bankaKodu: e.bankaKodu.trim(), posCihaziId: Number(e.posCihaziId) })));
      bildir("success", "Banka eşlemeleri kaydedildi.");
      await yukle();
    } catch (err: any) {
      bildir("danger", err?.message || "Banka eşlemeleri kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const eslemeYaz = (i: number, degisen: Partial<{ bankaKodu: string; posCihaziId: string }>) => {
    setEslemeler((onceki) => onceki.map((e, n) => (n === i ? { ...e, ...degisen } : e)));
    setEslemeDegisti(true);
  };

  const vezneAdi = (id: number) => vezneler.find((v) => v.id === id)?.ad || `Vezne ${id}`;
  const modeller = form ? tanimlar?.modeller[form.entegrasyon] || [] : [];
  const kapali = tanimlar?.mod === "kapali";

  return (
    <div className="pos-cihazlari-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="E- POS Cihazları"
        onRefresh={yukle}
        onNew={() => setForm({ ...BOS })}
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor}
        rightContent={<PosModRozeti mod={tanimlar?.mod} />}
      />
      {bildirimKutusu}

      {kapali && (
        <Alert variant="light" className="border small py-2">
          POS cihazı entegrasyonu bu firmada kapalı. Cihazları şimdiden tanımlayabilirsiniz; fişlerden cihaza tutar gönderimi entegrasyon açılınca başlar.
        </Alert>
      )}

      <Card className="border shadow-sm mb-3 w-100 bg-white">
        <Card.Header className="bg-white py-2 d-flex align-items-center justify-content-between">
          <span className="fw-bold small">Cihazlar</span>
          <Button size="sm" variant="primary" onClick={() => setForm({ ...BOS })}>
            <IconPlus size={16} className="me-1" />
            Yeni Cihaz
          </Button>
        </Card.Header>
        <Card.Body className="p-0">
          <Table size="sm" hover responsive className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th>Cihaz Adı</th>
                <th>Entegrasyon</th>
                <th>Model</th>
                <th>Terminal Kimliği</th>
                <th>Vezneler</th>
                <th>Varsayılan POS Kartı</th>
                <th>Durum</th>
                <th className="text-end">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {tanimlar?.terminaller.map((t) => (
                <tr key={t.posTerminalId}>
                  <td className="fw-semibold">{t.ad}</td>
                  <td>{ENTEGRASYON_ADI[t.entegrasyon]}</td>
                  <td>{t.model || "-"}</td>
                  <td className="font-monospace">{t.terminalKimlik || "-"}</td>
                  <td>{t.vezneIdler.length ? t.vezneIdler.map(vezneAdi).join(", ") : "Tümü"}</td>
                  <td>{t.posCihaziAd ? `${t.posCihaziKod || ""} ${t.posCihaziAd}`.trim() : "-"}</td>
                  <td>
                    <Badge bg={t.aktif ? "success" : "secondary"}>{t.aktif ? "Aktif" : "Pasif"}</Badge>
                  </td>
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="light" className="border me-1" disabled={kapali || calisan !== null} onClick={() => dene(t, "baglanti")}>
                      {calisan === `baglanti-${t.posTerminalId}` ? <Spinner size="sm" /> : <IconPlugConnected size={15} className="me-1" />}
                      Bağlantıyı Dene
                    </Button>
                    <Button size="sm" variant="light" className="border me-1" disabled={kapali || calisan !== null || t.entegrasyon === "yok"} onClick={() => dene(t, "gunsonu")}>
                      {calisan === `gunsonu-${t.posTerminalId}` && <Spinner size="sm" className="me-1" />}
                      Gün Sonu
                    </Button>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      className="me-1"
                      onClick={() => setForm({ posTerminalId: t.posTerminalId, ad: t.ad, entegrasyon: t.entegrasyon, model: t.model, sicilNo: t.sicilNo, terminalKimlik: t.terminalKimlik, posCihaziId: t.posCihaziId, aktif: t.aktif, vezneIdler: t.vezneIdler })}
                    >
                      Düzenle
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => setSilinecek(t)}>
                      <IconTrash size={15} />
                    </Button>
                  </td>
                </tr>
              ))}
              {!tanimlar?.terminaller.length && !yukleniyor && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-3">
                    Tanımlı POS cihazı yok.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Header className="bg-white py-2 d-flex align-items-center justify-content-between">
          <span className="fw-bold small">Banka → POS Kartı Eşlemesi</span>
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="light"
              className="border"
              onClick={() => {
                setEslemeler((o) => [...o, { bankaKodu: "", posCihaziId: "" }]);
                setEslemeDegisti(true);
              }}
            >
              <IconPlus size={16} className="me-1" />
              Satır Ekle
            </Button>
            <Button size="sm" variant="primary" disabled={!eslemeDegisti || kaydediliyor || eslemeler.some((e) => !e.bankaKodu.trim() || !e.posCihaziId)} onClick={eslemeleriKaydet}>
              Kaydet
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          <Table size="sm" className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: "40%" }}>Cihazdan Dönen Banka</th>
                <th>Tahsilatın Yazılacağı POS Kartı</th>
                <th style={{ width: "50px" }} />
              </tr>
            </thead>
            <tbody>
              {eslemeler.map((e, i) => (
                <tr key={i}>
                  <td>
                    <Form.Control size="sm" type="text" value={e.bankaKodu} maxLength={100} onChange={(ev) => eslemeYaz(i, { bankaKodu: ev.target.value })} />
                  </td>
                  <td>
                    <Form.Select size="sm" value={e.posCihaziId} onChange={(ev) => eslemeYaz(i, { posCihaziId: ev.target.value })}>
                      <option value="">Seçiniz</option>
                      {posKartlari.map((p) => (
                        <option key={p.posCihaziId} value={p.posCihaziId}>
                          {p.kod} - {p.ad}
                        </option>
                      ))}
                    </Form.Select>
                  </td>
                  <td className="text-end">
                    <Button
                      size="sm"
                      variant="outline-danger"
                      onClick={() => {
                        setEslemeler((o) => o.filter((_, n) => n !== i));
                        setEslemeDegisti(true);
                      }}
                    >
                      <IconTrash size={15} />
                    </Button>
                  </td>
                </tr>
              ))}
              {!eslemeler.length && (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-3">
                    Eşleme yok. Tahsilat, cihazın varsayılan POS kartına ya da fiş satırında seçili karta yazılır.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={form !== null} onHide={kaydediliyor ? undefined : () => setForm(null)} centered>
        <Modal.Header closeButton={!kaydediliyor} className="py-2">
          <Modal.Title className="fs-6 fw-bold">{form?.posTerminalId ? "POS Cihazını Düzenle" : "Yeni POS Cihazı"}</Modal.Title>
        </Modal.Header>
        {form && (
          <Modal.Body className="small">
            <Form.Label className="fw-bold text-secondary mb-1">Cihaz Adı</Form.Label>
            <Form.Control autoFocus size="sm" type="text" className="mb-2" maxLength={100} value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
            <Row className="g-2 mb-2">
              <Col xs={6}>
                <Form.Label className="fw-bold text-secondary mb-1">Entegrasyon</Form.Label>
                <Form.Select size="sm" value={form.entegrasyon} onChange={(e) => setForm({ ...form, entegrasyon: e.target.value as PosEntegrasyon, model: null })}>
                  {(Object.keys(ENTEGRASYON_ADI) as PosEntegrasyon[]).map((k) => (
                    <option key={k} value={k}>
                      {ENTEGRASYON_ADI[k]}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={6}>
                <Form.Label className="fw-bold text-secondary mb-1">Model</Form.Label>
                <Form.Select size="sm" value={form.model || ""} disabled={!modeller.length} onChange={(e) => setForm({ ...form, model: e.target.value || null })}>
                  <option value="">{modeller.length ? "Seçiniz" : "-"}</option>
                  {modeller.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Form.Select>
              </Col>
            </Row>
            <Row className="g-2 mb-2">
              <Col xs={6}>
                <Form.Label className="fw-bold text-secondary mb-1">Sicil No</Form.Label>
                <Form.Control size="sm" type="text" maxLength={50} value={form.sicilNo || ""} onChange={(e) => setForm({ ...form, sicilNo: e.target.value || null })} />
              </Col>
              <Col xs={6}>
                <Form.Label className="fw-bold text-secondary mb-1">Terminal Kimliği</Form.Label>
                <Form.Control
                  size="sm"
                  type="text"
                  maxLength={100}
                  disabled={form.entegrasyon === "yok"}
                  value={form.terminalKimlik || ""}
                  onChange={(e) => setForm({ ...form, terminalKimlik: e.target.value || null })}
                />
              </Col>
            </Row>
            <Form.Label className="fw-bold text-secondary mb-1">Varsayılan POS Kartı</Form.Label>
            <Form.Select size="sm" className="mb-2" value={form.posCihaziId ?? ""} onChange={(e) => setForm({ ...form, posCihaziId: Number(e.target.value) || null })}>
              <option value="">Yok (fiş satırında seçili kart kullanılır)</option>
              {posKartlari.map((p) => (
                <option key={p.posCihaziId} value={p.posCihaziId}>
                  {p.kod} - {p.ad}
                </option>
              ))}
            </Form.Select>
            <Form.Label className="fw-bold text-secondary mb-1">Kullanabilen Vezneler</Form.Label>
            <div className="border rounded px-2 py-1 mb-2" style={{ maxHeight: "140px", overflowY: "auto" }}>
              {vezneler.map((v) => (
                <Form.Check
                  key={v.id}
                  type="checkbox"
                  id={`pos-vezne-${v.id}`}
                  label={`${v.kod} - ${v.ad}`}
                  checked={form.vezneIdler.includes(v.id)}
                  onChange={(e) => setForm({ ...form, vezneIdler: e.target.checked ? [...form.vezneIdler, v.id] : form.vezneIdler.filter((x) => x !== v.id) })}
                />
              ))}
              {!vezneler.length && <span className="text-muted">Vezne tanımı yok.</span>}
            </div>
            <div className="text-muted mb-2">Hiçbiri işaretlenmezse cihazı tüm vezneler kullanır.</div>
            <Form.Check type="switch" id="pos-cihaz-aktif" label="Aktif" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
          </Modal.Body>
        )}
        <Modal.Footer className="py-2">
          <Button size="sm" variant="light" disabled={kaydediliyor} onClick={() => setForm(null)}>
            Vazgeç
          </Button>
          <Button size="sm" variant="primary" disabled={kaydediliyor || !form?.ad.trim()} onClick={kaydet}>
            {kaydediliyor && <Spinner size="sm" className="me-1" />}
            Kaydet
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={silinecek !== null} onHide={() => setSilinecek(null)} centered size="sm">
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold text-danger">POS Cihazını Sil</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          <strong>{silinecek?.ad}</strong> silinsin mi?
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="secondary" onClick={() => setSilinecek(null)}>
            Vazgeç
          </Button>
          <Button size="sm" variant="danger" onClick={sil}>
            Evet, Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PosCihazlariPage;

import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconArrowsExchange, IconCopy, IconPlus, IconRefresh, IconTrash } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { EBankaCari, EBankaService, EBankaVposLink, EBankaVposLinkler } from "../../services/ebankaService";
import { CariSecModal, ModRozeti, bugun, paraYaz, useBildirim, zamanYaz } from "./ebankaOrtak";

// F- e-Banka > G- Ödeme Linkleri (docs/EBANKA_VOMSIS_YOL_HARITASI.md, Faz 4)
// Vomsis bildirim göndermez: linkin ödendiği "Durumları Güncelle" ile öğrenilir ve tahsilat fişi o anda kesilir.

const gunYaz = (g: string | null): string => (g ? g.split("-").reverse().join(".") : "-");
const BOS_FORM = { baslik: "", tutar: "", paraBirimi: "TRY", sonGecerlilik: "", eposta: "", telefon: "", sms: false, mail: false, maxTaksit: 0, aciklama: "" };

export const EBankaOdemeLinkleriPage: React.FC = () => {
  const [veri, setVeri] = useState<EBankaVposLinkler | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [guncelleniyor, setGuncelleniyor] = useState(false);
  const [uyarilar, setUyarilar] = useState<string[]>([]);

  const [formAcik, setFormAcik] = useState(false);
  const [form, setForm] = useState(BOS_FORM);
  const [cari, setCari] = useState<EBankaCari | null>(null);
  const [cariSecAcik, setCariSecAcik] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [silinecek, setSilinecek] = useState<EBankaVposLink | null>(null);
  const [gosterilenLink, setGosterilenLink] = useState<string | null>(null);
  const { bildir, bildirimKutusu } = useBildirim();

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setVeri(await EBankaService.getVposLinkler());
    } catch (err: any) {
      bildir("danger", err?.message || "Ödeme linkleri okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [bildir]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const durumlariGuncelle = async () => {
    setGuncelleniyor(true);
    try {
      const s = await EBankaService.vposLinkleriGuncelle();
      setVeri((onceki) => (onceki ? { ...onceki, mod: s.mod, linkler: s.linkler } : onceki));
      setUyarilar(s.uyarilar);
      bildir(s.uyarilar.length ? "warning" : "success", `${s.sorulan} link soruldu, ${s.yeniOdenen} yeni ödeme${s.kesilenFis ? `, ${s.kesilenFis} tahsilat fişi kesildi` : ""}.`);
    } catch (err: any) {
      bildir("danger", err?.message || "Durumlar güncellenemedi.");
    } finally {
      setGuncelleniyor(false);
    }
  };

  const cariSecildi = async (c: EBankaCari) => {
    setCari(c);
    setCariSecAcik(false);
    // Telefon ve e-posta cariden dolar; kullanıcı değiştirebilir
    try {
      const i = await EBankaService.getCariIletisim(c.cariKartId);
      setForm((f) => ({ ...f, telefon: i.telefon || f.telefon, eposta: i.eposta || f.eposta, baslik: f.baslik || `${c.ad} tahsilat`.slice(0, 200) }));
    } catch {
      /* iletişim bilgisi gelmese de link oluşturulabilir */
    }
  };

  const formuAc = () => {
    setForm(BOS_FORM);
    setCari(null);
    setFormAcik(true);
  };

  const olustur = async () => {
    if (!cari) return;
    setKaydediliyor(true);
    try {
      const l = await EBankaService.vposLinkOlustur({ ...form, cariKartId: cari.cariKartId });
      setFormAcik(false);
      bildir("success", "Ödeme linki oluşturuldu.");
      if (l.link) kopyala(l.link, false);
      await yukle();
    } catch (err: any) {
      bildir("danger", err?.message || "Ödeme linki oluşturulamadı.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const kopyala = async (metin: string, bildirimli = true) => {
    let tamam = false;
    try {
      // navigator.clipboard yalnızca HTTPS'te (güvenli bağlamda) vardır; site HTTP'den açıldığında eski yönteme düşülür
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(metin);
        tamam = true;
      } else {
        const alan = document.createElement("textarea");
        alan.value = metin;
        alan.setAttribute("readonly", "");
        alan.style.position = "fixed";
        alan.style.opacity = "0";
        document.body.appendChild(alan);
        alan.select();
        tamam = document.execCommand("copy");
        alan.remove();
      }
    } catch {
      tamam = false;
    }
    if (tamam) {
      if (bildirimli) bildir("success", "Link panoya kopyalandı.");
    } else {
      // Kopyalanamıyorsa link kaybolmasın: seçilip kopyalanabilecek bir pencerede gösterilir
      setGosterilenLink(metin);
    }
  };

  const sil = async () => {
    if (!silinecek) return;
    setKaydediliyor(true);
    try {
      await EBankaService.vposLinkSil(silinecek.uid);
      setSilinecek(null);
      bildir("success", "Ödeme linki silindi.");
      await yukle();
    } catch (err: any) {
      bildir("danger", err?.message || "Ödeme linki silinemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const canli = veri?.mod === "canli";

  return (
    <div className="ebanka-odeme-linkleri-page w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="G- e-Banka Ödeme Linkleri"
        onNew={formuAc}
        onRefresh={yukle}
        hideSave
        hideSearch
        hideDelete
        hideNavigation
        hidePrint
        disabled={yukleniyor || guncelleniyor}
        modeText={`${veri?.linkler.length ?? 0} link`}
        rightContent={
          <div className="d-flex align-items-center gap-2">
            <ModRozeti mod={veri?.mod} />
            <Button size="sm" variant="outline-primary" disabled={guncelleniyor} onClick={durumlariGuncelle}>
              {guncelleniyor ? <Spinner size="sm" className="me-1" /> : <IconRefresh size={16} className="me-1" />}
              Durumları Güncelle
            </Button>
            <Button size="sm" variant="primary" onClick={formuAc}>
              <IconPlus size={16} className="me-1" />
              Yeni Ödeme Linki
            </Button>
          </div>
        }
      />
      {bildirimKutusu}

      {veri && canli && !veri.vposBankaTanimli && (
        <Alert variant="warning" className="small py-2">
          Sanal POS banka hesabı seçilmemiş; ödenen linkler için tahsilat fişi kesilemez. <Link to="/ebanka/ayarlar">Ayarlar ekranından seçin.</Link>
        </Alert>
      )}
      {veri && !canli && (
        <Alert variant="light" className="border small py-2">
          Test (örnek veri) modunda gerçek link oluşmaz ve <b>fiş kesilmez</b>. Örnek link, oluşturulduktan 1 dakika sonra "ödenmiş" görünür.
        </Alert>
      )}
      {uyarilar.length > 0 && (
        <Alert variant="warning" className="small py-2" dismissible onClose={() => setUyarilar([])}>
          {uyarilar.map((u, i) => (
            <div key={i}>{u}</div>
          ))}
        </Alert>
      )}

      <Card className="border shadow-sm w-100 bg-white">
        <Card.Body className="p-0">
          <Table size="sm" hover responsive className="mb-0 small align-middle">
            <thead className="table-light">
              <tr>
                <th>Oluşturma</th>
                <th>Cari</th>
                <th>Başlık</th>
                <th className="text-end">Tutar</th>
                <th className="text-center">Taksit</th>
                <th>Son Geçerlilik</th>
                <th>Bildirim</th>
                <th>Durum</th>
                <th>Tahsilat Fişi</th>
                <th style={{ width: "90px" }}></th>
              </tr>
            </thead>
            <tbody>
              {veri?.linkler.map((l) => (
                <tr key={l.uid}>
                  <td className="font-monospace text-nowrap">{zamanYaz(l.olusturmaZamani)}</td>
                  <td>{l.cariAdi ? `${l.cariKod} - ${l.cariAdi}` : "-"}</td>
                  <td>{l.baslik || "-"}</td>
                  <td className="text-end font-monospace fw-bold text-nowrap">
                    {paraYaz(l.tutar)} {l.paraBirimi}
                  </td>
                  <td className="text-center">{l.maxTaksit || ""}</td>
                  <td className="font-monospace">{gunYaz(l.sonGecerlilik)}</td>
                  <td className="text-nowrap">
                    {[l.sms && "SMS", l.mail && "E-posta"].filter(Boolean).join(", ") || "-"}
                    <div className="text-muted">{[l.telefon, l.eposta].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>
                    <Badge bg={l.odendi ? "success" : "secondary"} title={l.durum ? `Vomsis durumu: ${l.durum}` : undefined}>
                      {l.odendi ? "Ödendi" : "Bekliyor"}
                    </Badge>
                  </td>
                  <td>{l.bankaHareketId && l.bankaHareketId > 0 ? <Badge bg="success">#{l.bankaHareketId}</Badge> : l.odendi ? <span className="text-muted">Kesilmedi</span> : ""}</td>
                  <td className="text-end text-nowrap">
                    {l.link && (
                      <Button size="sm" variant="light" className="border py-0 me-1" title="Linki kopyala" onClick={() => kopyala(l.link as string)}>
                        <IconCopy size={14} />
                      </Button>
                    )}
                    {!l.odendi && (
                      <Button size="sm" variant="light" className="border py-0 text-danger" title="Linki sil" onClick={() => setSilinecek(l)}>
                        <IconTrash size={14} />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {!veri?.linkler.length && !yukleniyor && (
                <tr>
                  <td colSpan={10} className="text-center text-muted py-3">
                    Ödeme linki yok.
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={formAcik} onHide={kaydediliyor ? undefined : () => setFormAcik(false)} centered size="lg">
        <Modal.Header closeButton={!kaydediliyor} className="py-2">
          <Modal.Title className="fs-6 fw-bold">Yeni Ödeme Linki</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          <Form.Label className="fw-bold text-secondary mb-1">
            Cari <span className="text-danger">*</span>
          </Form.Label>
          <div className="d-flex align-items-center gap-2 mb-3">
            <div className="flex-grow-1 border rounded px-2 py-1 bg-light">{cari ? `${cari.kod} - ${cari.ad}` : "Seçilmedi"}</div>
            <Button size="sm" variant="outline-primary" onClick={() => setCariSecAcik(true)}>
              <IconArrowsExchange size={16} className="me-1" />
              Seç
            </Button>
          </div>
          <Row className="g-2">
            <Col md={8}>
              <Form.Label className="fw-bold text-secondary mb-1">Başlık</Form.Label>
              <Form.Control type="text" size="sm" maxLength={200} value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })} />
            </Col>
            <Col md={4}>
              <Form.Label className="fw-bold text-secondary mb-1">Son Geçerlilik</Form.Label>
              <Form.Control type="date" size="sm" min={bugun()} value={form.sonGecerlilik} onChange={(e) => setForm({ ...form, sonGecerlilik: e.target.value })} />
              <Form.Text className="text-muted" style={{ fontSize: "11px" }}>
                Boşsa 3 ay
              </Form.Text>
            </Col>
            <Col md={4}>
              <Form.Label className="fw-bold text-secondary mb-1">
                Tutar <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control type="text" size="sm" inputMode="decimal" className="font-monospace fw-bold" value={form.tutar} onChange={(e) => setForm({ ...form, tutar: e.target.value })} />
            </Col>
            <Col md={4}>
              <Form.Label className="fw-bold text-secondary mb-1">Para Birimi</Form.Label>
              <Form.Select size="sm" value={form.paraBirimi} onChange={(e) => setForm({ ...form, paraBirimi: e.target.value })}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label className="fw-bold text-secondary mb-1">En Fazla Taksit</Form.Label>
              <Form.Select size="sm" value={form.maxTaksit} onChange={(e) => setForm({ ...form, maxTaksit: Number(e.target.value) })}>
                <option value={0}>Taksit yok</option>
                {[2, 3, 4, 5, 6, 9, 12].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label className="fw-bold text-secondary mb-1">Telefon</Form.Label>
              <Form.Control type="text" size="sm" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} placeholder="05xxxxxxxxx" />
              <Form.Check type="checkbox" id="link-sms" className="mt-1" label="SMS ile gönder" checked={form.sms} onChange={(e) => setForm({ ...form, sms: e.target.checked })} />
            </Col>
            <Col md={6}>
              <Form.Label className="fw-bold text-secondary mb-1">E-posta</Form.Label>
              <Form.Control type="email" size="sm" value={form.eposta} onChange={(e) => setForm({ ...form, eposta: e.target.value })} />
              <Form.Check type="checkbox" id="link-mail" className="mt-1" label="E-posta ile gönder" checked={form.mail} onChange={(e) => setForm({ ...form, mail: e.target.checked })} />
            </Col>
            <Col md={12}>
              <Form.Label className="fw-bold text-secondary mb-1">Açıklama</Form.Label>
              <Form.Control type="text" size="sm" maxLength={500} value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="light" disabled={kaydediliyor} onClick={() => setFormAcik(false)}>
            Vazgeç
          </Button>
          <Button size="sm" variant="primary" disabled={kaydediliyor || !cari || !form.tutar.trim()} onClick={olustur}>
            {kaydediliyor && <Spinner size="sm" className="me-1" />}
            Linki Oluştur
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!silinecek} onHide={kaydediliyor ? undefined : () => setSilinecek(null)} centered size="sm">
        <Modal.Body className="small">
          <b>{silinecek?.baslik}</b> ({paraYaz(silinecek?.tutar)} {silinecek?.paraBirimi}) ödeme linki silinsin mi? Müşteri bu linkten artık ödeme yapamaz.
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="light" disabled={kaydediliyor} onClick={() => setSilinecek(null)}>
            Vazgeç
          </Button>
          <Button size="sm" variant="danger" disabled={kaydediliyor} onClick={sil}>
            {kaydediliyor && <Spinner size="sm" className="me-1" />}
            Sil
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={!!gosterilenLink} onHide={() => setGosterilenLink(null)} centered>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6 fw-bold">Ödeme Linki</Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          <div className="mb-2">Tarayıcı panoya kopyalamaya izin vermedi. Linki aşağıdan seçip kopyalayın:</div>
          <Form.Control as="textarea" rows={3} readOnly value={gosterilenLink || ""} className="font-monospace" onFocus={(e) => e.target.select()} />
        </Modal.Body>
      </Modal>

      <CariSecModal show={cariSecAcik} onHide={() => setCariSecAcik(false)} onSec={cariSecildi} />
    </div>
  );
};

export default EBankaOdemeLinkleriPage;

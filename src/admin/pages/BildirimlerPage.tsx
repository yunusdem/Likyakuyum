import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import { IconPlus, IconRefresh } from "@tabler/icons-react";
import { adminApi, BildirimGirdi, DestekHedefSecenekleri, DestekKonuDetay } from "../services/adminApi";
import { BILDIRIM_TURU_ADI, BildirimHedefi, BildirimTuru, DURUM_ADI, DURUM_RENGI, HEDEF_ADI, KonuOzet, zamanYaz } from "../../components/destek/destekOrtak";
import { ADMIN_DESTEK_DEGISTI } from "../components/AdminKonuSohbet";

const BOS: BildirimGirdi = { baslik: "", metin: "", bildirimTuru: "DUYURU", onemli: false, cevapAlir: true, hedef: "TUMU", firmaIds: [], kullaniciIds: [], gonder: false };

/** Panel > Bildirimler (K7, K8, K10, K17): taslak / gönder / geri çek; hedef: tümü, seçili firmalar, seçili kullanıcılar. */
const BildirimlerPage: React.FC = () => {
  const [satirlar, setSatirlar] = useState<KonuOzet[]>([]);
  const [kurulu, setKurulu] = useState(true);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [secenekler, setSecenekler] = useState<DestekHedefSecenekleri | null>(null);

  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenen, setDuzenlenen] = useState<number | null>(null);
  const [form, setForm] = useState<BildirimGirdi>(BOS);
  const [formHata, setFormHata] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [firmaFiltre, setFirmaFiltre] = useState("");
  const [detay, setDetay] = useState<DestekKonuDetay | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const s = await adminApi.bildirimler();
      setSatirlar(s.satirlar);
      setKurulu(s.kurulu);
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Bildirimler okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    yukle();
    adminApi.bildirimHedefleri().then(setSecenekler).catch(() => undefined);
  }, [yukle]);

  const degisti = () => window.dispatchEvent(new Event(ADMIN_DESTEK_DEGISTI));

  const yeniAc = () => {
    setDuzenlenen(null);
    setForm(BOS);
    setFormHata(null);
    setFormAcik(true);
  };

  const duzenleAc = async (k: KonuOzet) => {
    try {
      const d = await adminApi.destekKonu(k.konuId);
      setDuzenlenen(k.konuId);
      setForm({
        baslik: d.konu.baslik,
        metin: d.mesajlar[0]?.metin || "",
        bildirimTuru: d.konu.bildirimTuru || "DUYURU",
        onemli: d.konu.onemli,
        cevapAlir: d.konu.cevapAlir,
        hedef: d.konu.hedef || "TUMU",
        firmaIds: d.konu.hedef === "FIRMA" ? (d.hedefler || []).map((h) => h.firmaId) : [],
        kullaniciIds: d.konu.hedef === "KULLANICI" ? (d.hedefler || []).map((h) => h.kullaniciId!).filter(Boolean) : [],
        gonder: false,
      });
      setFormHata(null);
      setFormAcik(true);
    } catch (err: any) {
      setHata(err?.message || "Taslak açılamadı.");
    }
  };

  const kaydet = async (gonder: boolean) => {
    if (!form.baslik.trim()) return setFormHata("Başlık girilmelidir.");
    if (!form.metin.trim()) return setFormHata("Metin girilmelidir.");
    if (form.hedef === "FIRMA" && (form.firmaIds || []).length === 0) return setFormHata("En az bir firma seçin.");
    if (form.hedef === "KULLANICI" && (form.kullaniciIds || []).length === 0) return setFormHata("En az bir kullanıcı seçin.");
    if (gonder && !window.confirm(`Bildirim gönderilsin mi? Hedef: ${HEDEF_ADI[form.hedef]}.`)) return;
    setKaydediliyor(true);
    setFormHata(null);
    try {
      const veri = { ...form, gonder };
      if (duzenlenen) await adminApi.bildirimGuncelle(duzenlenen, veri);
      else await adminApi.bildirimOlustur(veri);
      setFormAcik(false);
      setMesaj(gonder ? "Bildirim gönderildi." : "Taslak kaydedildi.");
      degisti();
      yukle();
    } catch (err: any) {
      setFormHata(err?.message || "Kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  const geriCek = async (k: KonuOzet) => {
    if (!window.confirm(`"${k.baslik}" geri çekilsin mi? Tüm kullanıcılardan kalkar.`)) return;
    try {
      await adminApi.bildirimGeriCek(k.konuId);
      setMesaj("Bildirim geri çekildi.");
      yukle();
    } catch (err: any) {
      setHata(err?.message || "Geri çekilemedi.");
    }
  };

  const firmaSecenekleri = useMemo(() => {
    const q = firmaFiltre.trim().toLocaleLowerCase("tr");
    return (secenekler?.firmalar || []).filter((f) => !q || `${f.unvan} ${f.firmaKodu}`.toLocaleLowerCase("tr").includes(q));
  }, [secenekler, firmaFiltre]);

  const kullaniciSecenekleri = useMemo(() => {
    const q = firmaFiltre.trim().toLocaleLowerCase("tr");
    const firmaAdi = new Map((secenekler?.firmalar || []).map((f) => [f.firmaId, f.unvan]));
    return (secenekler?.kullanicilar || [])
      .map((k) => ({ ...k, firmaUnvan: firmaAdi.get(k.firmaId) || "" }))
      .filter((k) => !q || `${k.kullaniciAdi} ${k.adSoyad || ""} ${k.firmaUnvan}`.toLocaleLowerCase("tr").includes(q));
  }, [secenekler, firmaFiltre]);

  const secimiDegistir = (alan: "firmaIds" | "kullaniciIds", id: number, secili: boolean) =>
    setForm((f) => ({ ...f, [alan]: secili ? Array.from(new Set([...(f[alan] || []), id])) : (f[alan] || []).filter((x) => x !== id) }));

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h5 className="mb-0">Bildirimler</h5>
            <small className="text-muted">Kullanıcı panelindeki zile düşen duyurular; yeniden eskiye</small>
          </div>
          <div className="d-flex gap-2">
            <Button size="sm" variant="outline-secondary" onClick={yukle} title="Yenile">
              <IconRefresh size={16} />
            </Button>
            <Button size="sm" variant="primary" onClick={yeniAc} disabled={!kurulu}>
              <IconPlus size={16} className="me-1" />
              Yeni Bildirim
            </Button>
          </div>
        </div>

        {!kurulu && <Alert variant="warning">Destek tabloları kurulu değil. Sunucuda docs/sql/LIKYA_ADMIN_DESTEK.sql çalıştırılmalı.</Alert>}
        {hata && <Alert variant="danger" onClose={() => setHata(null)} dismissible>{hata}</Alert>}
        {mesaj && <Alert variant="success" onClose={() => setMesaj(null)} dismissible>{mesaj}</Alert>}

        {yukleniyor && satirlar.length === 0 ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
          </div>
        ) : satirlar.length === 0 ? (
          <div className="text-muted small">Henüz bildirim yok.</div>
        ) : (
          <Table size="sm" hover responsive className="align-middle">
            <thead>
              <tr>
                <th>Başlık</th>
                <th>Tür</th>
                <th>Hedef</th>
                <th>Durum</th>
                <th>Gönderim</th>
                <th className="text-end">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((k) => (
                <tr key={k.konuId}>
                  <td>
                    <div className="fw-semibold">
                      {k.onemli && <Badge bg="danger" className="me-1">Önemli</Badge>}
                      {k.baslik}
                    </div>
                    <div className="small text-muted text-truncate" style={{ maxWidth: 420 }}>
                      {k.sonMesaj}
                    </div>
                  </td>
                  <td>
                    {k.bildirimTuru ? BILDIRIM_TURU_ADI[k.bildirimTuru] : "-"}
                    {k.surum && <div className="small text-muted">{k.surum}</div>}
                  </td>
                  <td>
                    {k.hedef ? HEDEF_ADI[k.hedef] : "-"}
                    {k.hedefSayisi !== null && <span className="text-muted small"> ({k.hedefSayisi})</span>}
                  </td>
                  <td>
                    <Badge bg={DURUM_RENGI[k.durum]}>{DURUM_ADI[k.durum]}</Badge>
                    {!k.cevapAlir && <div className="small text-muted">yanıt kapalı</div>}
                  </td>
                  <td className="small">{k.gonderimTarihi ? zamanYaz(k.gonderimTarihi) : <span className="text-muted">{zamanYaz(k.olusturmaTarihi)}</span>}</td>
                  <td className="text-end" style={{ minWidth: 110 }}>
                    <Button size="sm" variant="link" className="p-0 me-2" onClick={() => adminApi.destekKonu(k.konuId).then(setDetay).catch((e) => setHata(e?.message))}>
                      Ayrıntı
                    </Button>
                    {k.durum === "TASLAK" && (
                      <Button size="sm" variant="link" className="p-0 me-2" onClick={() => duzenleAc(k)}>
                        Düzenle / Gönder
                      </Button>
                    )}
                    {k.durum === "GONDERILDI" && (
                      <Button size="sm" variant="link" className="p-0 text-danger" onClick={() => geriCek(k)}>
                        Geri çek
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>

      {/* Yeni / taslak düzenleme */}
      <Modal show={formAcik} onHide={() => !kaydediliyor && setFormAcik(false)} size="lg" backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title as="h6">{duzenlenen ? "Taslağı Düzenle" : "Yeni Bildirim"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formHata && <Alert variant="danger" className="py-2 small">{formHata}</Alert>}
          <Row>
            <Col md={8}>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">Başlık</Form.Label>
                <Form.Control maxLength={200} value={form.baslik} onChange={(e) => setForm({ ...form, baslik: e.target.value })} />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-semibold">Tür</Form.Label>
                <Form.Select value={form.bildirimTuru} onChange={(e) => setForm({ ...form, bildirimTuru: e.target.value as BildirimTuru })}>
                  {(Object.keys(BILDIRIM_TURU_ADI) as BildirimTuru[]).map((t) => (
                    <option key={t} value={t}>
                      {BILDIRIM_TURU_ADI[t]}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold">Metin</Form.Label>
            <Form.Control as="textarea" rows={6} maxLength={4000} value={form.metin} onChange={(e) => setForm({ ...form, metin: e.target.value })} />
            <div className="text-end small text-muted">{form.metin.length} / 4000</div>
          </Form.Group>
          <div className="d-flex flex-wrap gap-4 mb-3">
            <Form.Check type="switch" id="onemli" label="Önemli (girişte pencere olarak açılır)" checked={form.onemli} onChange={(e) => setForm({ ...form, onemli: e.target.checked })} />
            <Form.Check type="switch" id="cevapAlir" label="Yanıtlanabilir" checked={form.cevapAlir} onChange={(e) => setForm({ ...form, cevapAlir: e.target.checked })} />
          </div>
          <Form.Group className="mb-2">
            <Form.Label className="small fw-semibold">Hedef</Form.Label>
            <div className="d-flex gap-3 flex-wrap">
              {(Object.keys(HEDEF_ADI) as BildirimHedefi[]).map((h) => (
                <Form.Check key={h} type="radio" name="hedef" id={`hedef-${h}`} label={HEDEF_ADI[h]} checked={form.hedef === h} onChange={() => setForm({ ...form, hedef: h })} />
              ))}
            </div>
          </Form.Group>
          {form.hedef !== "TUMU" && (
            <div className="border rounded p-2">
              <Form.Control size="sm" className="mb-2" placeholder="Ara…" value={firmaFiltre} onChange={(e) => setFirmaFiltre(e.target.value)} />
              <div style={{ maxHeight: 220, overflow: "auto" }}>
                {form.hedef === "FIRMA"
                  ? firmaSecenekleri.map((f) => (
                      <Form.Check
                        key={f.firmaId}
                        type="checkbox"
                        id={`f-${f.firmaId}`}
                        label={`${f.unvan} (${f.firmaKodu})${f.durum !== "AKTIF" ? ` · ${f.durum}` : ""}`}
                        checked={(form.firmaIds || []).includes(f.firmaId)}
                        onChange={(e) => secimiDegistir("firmaIds", f.firmaId, e.target.checked)}
                      />
                    ))
                  : kullaniciSecenekleri.map((k) => (
                      <Form.Check
                        key={k.kullaniciId}
                        type="checkbox"
                        id={`k-${k.kullaniciId}`}
                        label={`${k.adSoyad || k.kullaniciAdi} (${k.kullaniciAdi}) · ${k.firmaUnvan}`}
                        checked={(form.kullaniciIds || []).includes(k.kullaniciId)}
                        onChange={(e) => secimiDegistir("kullaniciIds", k.kullaniciId, e.target.checked)}
                      />
                    ))}
              </div>
              <div className="small text-muted mt-1">
                Seçili: {form.hedef === "FIRMA" ? (form.firmaIds || []).length : (form.kullaniciIds || []).length}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setFormAcik(false)} disabled={kaydediliyor}>
            Vazgeç
          </Button>
          <Button variant="outline-primary" onClick={() => kaydet(false)} disabled={kaydediliyor}>
            Taslak Kaydet
          </Button>
          <Button variant="primary" onClick={() => kaydet(true)} disabled={kaydediliyor}>
            {kaydediliyor ? <Spinner size="sm" className="me-1" /> : null}
            Gönder
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Ayrıntı */}
      <Modal show={!!detay} onHide={() => setDetay(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title as="h6">{detay?.konu.baslik}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detay && (
            <>
              <div className="small text-muted mb-2">
                {detay.konu.bildirimTuru ? BILDIRIM_TURU_ADI[detay.konu.bildirimTuru] : ""} · {detay.konu.hedef ? HEDEF_ADI[detay.konu.hedef] : ""} ·{" "}
                <Badge bg={DURUM_RENGI[detay.konu.durum]}>{DURUM_ADI[detay.konu.durum]}</Badge>
                {detay.konu.gonderimTarihi && ` · ${zamanYaz(detay.konu.gonderimTarihi)}`}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }} className="mb-3">
                {detay.mesajlar[0]?.metin}
              </div>
              {detay.konu.hedef !== "TUMU" && (
                <div className="small">
                  <div className="fw-semibold mb-1">Hedefler</div>
                  {(detay.hedefler || []).map((h, i) => (
                    <div key={i}>
                      {h.unvan} ({h.firmaKodu}){h.kullaniciAdi ? ` / ${h.kullaniciAdi}` : ""}
                    </div>
                  ))}
                </div>
              )}
              {typeof detay.yanitSayisi === "number" && detay.yanitSayisi > 0 && (
                <div className="mt-3">
                  <Link to={`/destek?kaynak=${detay.konu.konuId}`}>{detay.yanitSayisi} yanıt talebi</Link>
                </div>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>
    </Card>
  );
};

export default BildirimlerPage;

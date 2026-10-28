import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { Oncelik, TALEP_TURU_ADI, TalepTuru } from "../../components/destek/destekOrtak";
import { destekDegisti, FirmaKarti, MusteriKullanici, panelApi } from "../services/panelApi";

interface Props {
  show: boolean;
  onHide: () => void;
  onAcildi: (konuId: number) => void;
  /** Müşteriler sayfasından açılınca firma hazır gelir */
  firmaId?: number;
}

/** Telefonla arayan müşteri için firma adına talep (D15). Talep açanın üzerine atanır; müşteri kendi Destek listesinde görür. */
const TelefonTalebiModal: React.FC<Props> = ({ show, onHide, onAcildi, firmaId: hazirFirma }) => {
  const [firmalar, setFirmalar] = useState<FirmaKarti[]>([]);
  const [firmaAra, setFirmaAra] = useState("");
  const [firmaId, setFirmaId] = useState<number | undefined>(hazirFirma);
  const [kullanicilar, setKullanicilar] = useState<MusteriKullanici[]>([]);
  const [kullaniciId, setKullaniciId] = useState<number | undefined>(undefined);
  const [baslik, setBaslik] = useState("");
  const [metin, setMetin] = useState("");
  const [talepTuru, setTalepTuru] = useState<TalepTuru>("SORU");
  const [oncelik, setOncelik] = useState<Oncelik>("NORMAL");
  const [hata, setHata] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    if (!show) return;
    setFirmaId(hazirFirma);
    setKullaniciId(undefined);
    setBaslik("");
    setMetin("");
    setTalepTuru("SORU");
    setOncelik("NORMAL");
    setHata(null);
    setFirmaAra("");
    panelApi.musteriler().then(setFirmalar).catch(() => undefined);
  }, [show, hazirFirma]);

  useEffect(() => {
    setKullaniciId(undefined);
    setKullanicilar([]);
    if (firmaId) panelApi.musteri(firmaId).then((m) => setKullanicilar(m.kullanicilar.filter((k) => k.durum === "AKTIF"))).catch(() => undefined);
  }, [firmaId]);

  const suzulmus = useMemo(() => {
    const q = firmaAra.trim().toLocaleLowerCase("tr");
    return firmalar.filter((f) => !q || `${f.unvan} ${f.firmaKodu} ${f.musteriNo || ""} ${f.telefon || ""}`.toLocaleLowerCase("tr").includes(q)).slice(0, 200);
  }, [firmalar, firmaAra]);

  const kaydet = async () => {
    if (!firmaId) return setHata("Firma seçin.");
    if (!baslik.trim()) return setHata("Başlık girin.");
    if (!metin.trim()) return setHata("Görüşme notunu girin.");
    setKaydediliyor(true);
    setHata(null);
    try {
      const d = await panelApi.telefonTalebi({ firmaId, kullaniciId: kullaniciId ?? null, baslik: baslik.trim(), metin: metin.trim(), talepTuru, oncelik });
      destekDegisti();
      onAcildi(d.konu.konuId);
    } catch (err: any) {
      setHata(err?.message || "Talep açılamadı.");
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title as="h5">Telefon talebi</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {hata && <Alert variant="danger">{hata}</Alert>}
        <Form.Group className="mb-3">
          <Form.Label>Firma</Form.Label>
          {!hazirFirma && <Form.Control size="sm" className="mb-1" placeholder="Unvan, müşteri no, telefon ile ara…" value={firmaAra} onChange={(e) => setFirmaAra(e.target.value)} />}
          <Form.Select value={firmaId ?? ""} onChange={(e) => setFirmaId(e.target.value ? Number(e.target.value) : undefined)} disabled={!!hazirFirma}>
            <option value="">Seçin…</option>
            {(hazirFirma ? firmalar.filter((f) => f.firmaId === hazirFirma) : suzulmus).map((f) => (
              <option key={f.firmaId} value={f.firmaId}>
                {f.unvan} ({f.musteriNo || f.firmaKodu})
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Arayan kullanıcı</Form.Label>
          <Form.Select value={kullaniciId ?? ""} onChange={(e) => setKullaniciId(e.target.value ? Number(e.target.value) : undefined)} disabled={!firmaId}>
            <option value="">Belirtilmedi (firma yöneticileri görür)</option>
            {kullanicilar.map((k) => (
              <option key={k.kullaniciId} value={k.kullaniciId}>
                {k.adSoyad || k.kullaniciAdi} ({k.kullaniciAdi}){k.yonetici ? " · yönetici" : ""}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <div className="d-flex gap-3 mb-3">
          <Form.Group className="flex-grow-1">
            <Form.Label>Tür</Form.Label>
            <Form.Select value={talepTuru} onChange={(e) => setTalepTuru(e.target.value as TalepTuru)}>
              {(Object.keys(TALEP_TURU_ADI) as TalepTuru[]).map((t) => (
                <option key={t} value={t}>
                  {TALEP_TURU_ADI[t]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <Form.Group className="flex-grow-1">
            <Form.Label>Öncelik</Form.Label>
            <Form.Select value={oncelik} onChange={(e) => setOncelik(e.target.value as Oncelik)}>
              <option value="NORMAL">Normal</option>
              <option value="ACIL">Acil</option>
            </Form.Select>
          </Form.Group>
        </div>
        <Form.Group className="mb-3">
          <Form.Label>Başlık</Form.Label>
          <Form.Control value={baslik} maxLength={200} onChange={(e) => setBaslik(e.target.value)} />
        </Form.Group>
        <Form.Group>
          <Form.Label>Görüşme notu</Form.Label>
          <Form.Control as="textarea" rows={4} maxLength={4000} value={metin} onChange={(e) => setMetin(e.target.value)} />
          <Form.Text>Müşteri bu notu kendi Destek listesinde "Likya Destek" adıyla görür.</Form.Text>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={kaydediliyor}>
          Vazgeç
        </Button>
        <Button className="btn-adm" onClick={kaydet} disabled={kaydediliyor}>
          {kaydediliyor ? <Spinner size="sm" /> : "Talep aç"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TelefonTalebiModal;

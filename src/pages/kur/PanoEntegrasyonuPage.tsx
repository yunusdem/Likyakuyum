import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner } from "react-bootstrap";
import { IconCopy, IconCheck, IconEye, IconEyeOff, IconKey, IconPlugConnected, IconRefresh, IconTrash, IconExternalLink } from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import { PanoEntegrasyonSatiri, PanoEntegrasyonService } from "../../services/panoEntegrasyonService";

/**
 * Kur › Pano Entegrasyonu (docs/PANO_API_YOL_HARITASI.md). Pano başına açık veri anahtarı: LED pano yazılımı
 * (ya da panocunun köprü programı) buradaki adresleri okur. Yalnız yönetici görür (sunucu 403).
 */

type Uyari = { tur: "success" | "danger" | "warning"; metin: string } | null;

const tarihYaz = (d: string | null) => (d ? new Date(d).toLocaleString("tr-TR") : "-");

const maskele = (a: string) => a.slice(0, 4) + "••••••••••••••••••••••••" + a.slice(-4);

/** Panoya basılan "kopyala" düğmesi; 1,5 sn "kopyalandı" gösterir */
const Kopyala: React.FC<{ metin: string; etiket?: string }> = ({ metin, etiket }) => {
  const [oldu, setOldu] = useState(false);
  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(metin);
    } catch {
      const t = document.createElement("textarea");
      t.value = metin;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setOldu(true);
    setTimeout(() => setOldu(false), 1500);
  };
  return (
    <Button size="sm" variant={oldu ? "success" : "outline-secondary"} onClick={kopyala} title="Panoya kopyala">
      {oldu ? <IconCheck size={16} /> : <IconCopy size={16} />}
      {etiket && <span className="ms-1">{oldu ? "Kopyalandı" : etiket}</span>}
    </Button>
  );
};

const AdresSatiri: React.FC<{ ad: string; adres: string; aciklama: string }> = ({ ad, adres, aciklama }) => (
  <div className="mb-2">
    <div className="d-flex align-items-center gap-2 small">
      <Badge bg="dark" className="font-monospace" style={{ minWidth: 46 }}>
        {ad}
      </Badge>
      <span className="text-muted">{aciklama}</span>
    </div>
    <InputGroup size="sm" className="mt-1">
      <Form.Control readOnly value={adres} className="font-monospace" onFocus={(e) => e.currentTarget.select()} />
      <Kopyala metin={adres} />
      <Button size="sm" variant="outline-secondary" href={adres} target="_blank" rel="noreferrer" title="Yeni sekmede aç">
        <IconExternalLink size={16} />
      </Button>
    </InputGroup>
  </div>
);

const PanoKarti: React.FC<{
  pano: PanoEntegrasyonSatiri;
  mesgul: boolean;
  onUret: () => void;
  onIptal: () => void;
  onOnbellek: (sn: number) => void;
}> = ({ pano, mesgul, onUret, onIptal, onOnbellek }) => {
  const [goster, setGoster] = useState(false);
  const [sn, setSn] = useState(String(pano.onbellekSn));
  const [ornek, setOrnek] = useState<string | null>(null);
  const [ornekHata, setOrnekHata] = useState<string | null>(null);

  useEffect(() => setSn(String(pano.onbellekSn)), [pano.onbellekSn]);
  useEffect(() => {
    setOrnek(null);
    setOrnekHata(null);
  }, [pano.anahtar]);

  const ornekGetir = async () => {
    if (!pano.adresler) return;
    setOrnekHata(null);
    try {
      const r = await fetch(pano.adresler.json, { cache: "no-store" });
      const metin = await r.text();
      if (!r.ok) throw new Error(`Sunucu ${r.status} döndü: ${metin.slice(0, 200)}`);
      setOrnek(JSON.stringify(JSON.parse(metin), null, 2));
    } catch (e: any) {
      setOrnekHata(e?.message || "Örnek alınamadı.");
    }
  };

  const snKaydet = () => {
    const n = Number(sn);
    if (!Number.isInteger(n) || n < 1 || n > 3600) {
      setSn(String(pano.onbellekSn));
      return;
    }
    if (n !== pano.onbellekSn) onOnbellek(n);
  };

  return (
    <Card className="mb-3 shadow-sm">
      <Card.Header className="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2">
          <IconPlugConnected size={20} className="text-primary" />
          <strong>{pano.panoNo}</strong>
          <span className="text-muted small">{pano.firmaAdi}</span>
          <Badge bg="secondary" pill>
            {pano.satirSayisi} satır
          </Badge>
        </div>
        {pano.anahtar ? (
          <Badge bg="success">Yayında</Badge>
        ) : (
          <Badge bg="secondary">Anahtar yok</Badge>
        )}
      </Card.Header>
      <Card.Body>
        {!pano.anahtar ? (
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <span className="text-muted">Bu pano için henüz anahtar üretilmedi. Üretince dört adres (JSON, XML, TXT, HTML) hemen çalışır.</span>
            <Button variant="primary" size="sm" disabled={mesgul} onClick={onUret}>
              <IconKey size={16} className="me-1" /> Anahtar üret
            </Button>
          </div>
        ) : (
          <Row>
            <Col lg={7}>
              <Form.Label className="small text-muted mb-1">Anahtar</Form.Label>
              <InputGroup size="sm" className="mb-3">
                <Form.Control readOnly className="font-monospace" value={goster ? pano.anahtar : maskele(pano.anahtar)} />
                <Button size="sm" variant="outline-secondary" onClick={() => setGoster((g) => !g)} title={goster ? "Gizle" : "Göster"}>
                  {goster ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </Button>
                <Kopyala metin={pano.anahtar} />
              </InputGroup>

              <AdresSatiri ad="JSON" adres={pano.adresler!.json} aciklama="Yazılım entegrasyonu için (satır alanları: kod, alis, satis, alisYazi, satisYazi)" />
              <AdresSatiri ad="XML" adres={pano.adresler!.xml} aciklama="XML okuyan pano programları için" />
              <AdresSatiri ad="TXT" adres={pano.adresler!.txt} aciklama="Satır başına KOD;ALIŞ;SATIŞ (Türkçe sayı biçimi)" />
              <AdresSatiri ad="HTML" adres={pano.adresler!.html} aciklama="Girişsiz pano sayfası: TV / Android kutu tarayıcısında tam ekran açın" />
            </Col>
            <Col lg={5}>
              <Form.Group className="mb-3">
                <Form.Label className="small text-muted mb-1">Önbellek süresi (saniye)</Form.Label>
                <InputGroup size="sm">
                  <Form.Control
                    type="number"
                    min={1}
                    max={3600}
                    value={sn}
                    onChange={(e) => setSn(e.target.value)}
                    onBlur={snKaydet}
                    onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                    disabled={mesgul}
                    style={{ maxWidth: 110 }}
                  />
                  <InputGroup.Text>sn</InputGroup.Text>
                </InputGroup>
                <Form.Text muted>Aynı adrese bu süre içinde gelen istekler aynı cevabı alır. En az 1 sn.</Form.Text>
              </Form.Group>

              <div className="small mb-3">
                <div className="d-flex justify-content-between border-bottom py-1">
                  <span className="text-muted">Üreten</span>
                  <span>{pano.olusturan || "-"}</span>
                </div>
                <div className="d-flex justify-content-between border-bottom py-1">
                  <span className="text-muted">Üretim</span>
                  <span>{tarihYaz(pano.olusturmaTarihi)}</span>
                </div>
                <div className="d-flex justify-content-between border-bottom py-1">
                  <span className="text-muted">Son erişim</span>
                  <span>{tarihYaz(pano.sonErisim)}</span>
                </div>
                <div className="d-flex justify-content-between py-1">
                  <span className="text-muted">Toplam istek</span>
                  <span>{pano.istekSayisi.toLocaleString("tr-TR")}</span>
                </div>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <Button size="sm" variant="outline-primary" disabled={mesgul} onClick={ornekGetir}>
                  Canlı örnek cevap
                </Button>
                <Button
                  size="sm"
                  variant="outline-warning"
                  disabled={mesgul}
                  onClick={() => window.confirm("Anahtar yenilenecek. Eski adres hemen çalışmayı bırakır; pano programındaki adresi değiştirmeniz gerekir. Devam edilsin mi?") && onUret()}
                >
                  <IconRefresh size={16} className="me-1" /> Yenile
                </Button>
                <Button
                  size="sm"
                  variant="outline-danger"
                  disabled={mesgul}
                  onClick={() => window.confirm("Anahtar iptal edilecek; adresler çalışmayı bırakır. Devam edilsin mi?") && onIptal()}
                >
                  <IconTrash size={16} className="me-1" /> İptal et
                </Button>
              </div>
            </Col>
            {(ornek || ornekHata) && (
              <Col xs={12} className="mt-3">
                {ornekHata ? (
                  <Alert variant="danger" className="mb-0 py-2 small">
                    {ornekHata}
                  </Alert>
                ) : (
                  <pre className="bg-light border rounded p-2 small mb-0" style={{ maxHeight: 320, overflow: "auto" }}>
                    {ornek}
                  </pre>
                )}
              </Col>
            )}
          </Row>
        )}
      </Card.Body>
    </Card>
  );
};

const PanoEntegrasyonuPage: React.FC = () => {
  const [panolar, setPanolar] = useState<PanoEntegrasyonSatiri[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [mesgul, setMesgul] = useState(false);
  const [uyari, setUyari] = useState<Uyari>(null);
  const [yasak, setYasak] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setPanolar(await PanoEntegrasyonService.liste());
      setYasak(null);
    } catch (e: any) {
      if (e?.status === 403 || e?.statusCode === 403) setYasak(e?.message || "Bu sayfaya yalnız yönetici girebilir.");
      else setUyari({ tur: "danger", metin: e?.message || "Liste alınamadı." });
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const degistir = (yeni: PanoEntegrasyonSatiri) => setPanolar((l) => l.map((p) => (p.panoId === yeni.panoId ? yeni : p)));

  const calistir = async (is: () => Promise<PanoEntegrasyonSatiri>, mesaj: string) => {
    setMesgul(true);
    setUyari(null);
    try {
      degistir(await is());
      setUyari({ tur: "success", metin: mesaj });
    } catch (e: any) {
      setUyari({ tur: "danger", metin: e?.message || "İşlem yapılamadı." });
    } finally {
      setMesgul(false);
    }
  };

  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="Pano Entegrasyonu" pageIcon={<IconPlugConnected size={22} className="text-primary" />} onRefresh={() => void yukle()} disabled={yukleniyor || mesgul} />

      {uyari && (
        <Alert variant={uyari.tur} dismissible onClose={() => setUyari(null)} className="mt-3">
          {uyari.metin}
        </Alert>
      )}

      {yasak ? (
        <Alert variant="warning" className="mt-3">
          {yasak}
        </Alert>
      ) : yukleniyor ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <>
          <Card className="mt-3 mb-3 border-0 bg-light">
            <Card.Body className="small py-2">
              <strong>Nasıl çalışır?</strong> Her pano tanımı için bir anahtar üretin; LED pano programınıza (ya da panocunuzun köprü programına) aşağıdaki
              adreslerden uygun olanı verin. Adres, pano tanımındaki görünür satırları Anlık Fiyat Listesi'ndeki komisyonlu fiyatlarla verir. Giriş
              istemez; anahtarı bilen herkes okuyabilir, bu yüzden anahtarı yalnız panocunuzla paylaşın. Şüphelenirseniz <em>Yenile</em> ile eski adresi
              anında kapatın.
            </Card.Body>
          </Card>

          {panolar.length === 0 && <Alert variant="info">Pano tanımı yok. Önce Kur › Pano Tanımı'ndan bir pano oluşturun.</Alert>}

          {panolar.map((p) => (
            <PanoKarti
              key={p.panoId}
              pano={p}
              mesgul={mesgul}
              onUret={() => void calistir(() => PanoEntegrasyonService.uret(p.panoId), p.anahtar ? "Anahtar yenilendi; eski adres kapandı." : "Anahtar üretildi.")}
              onIptal={() => void calistir(() => PanoEntegrasyonService.iptal(p.panoId), "Anahtar iptal edildi.")}
              onOnbellek={(sn) => void calistir(() => PanoEntegrasyonService.onbellek(p.panoId, sn), "Önbellek süresi kaydedildi.")}
            />
          ))}
        </>
      )}
    </div>
  );
};

export default PanoEntegrasyonuPage;

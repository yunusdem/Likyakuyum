import React, { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, ListGroup, Modal, Row, Spinner } from "react-bootstrap";
import { adminApi, ModulKaydi, PaketDto, PaketListesi, tarihYaz } from "../services/adminApi";
import { modulKatalogu } from "../../config/modulKatalogu";
import ModulAgaci, { agacYapisi } from "../components/ModulAgaci";
import { paketleriHazirla, URUN_ROZET_RENGI } from "../components/paketOrtak";

/**
 * Paket Tanımları (docs/LISANS_URUN_PAKETLERI.md §3.3). Her paketin açtığı sayfalar burada görülür ve değiştirilir.
 * Kayıtta, paketi kullanan firmalara uygulanıp uygulanmayacağı sorulur: "Uygula" → o firmaların sayfaları yeni içerikle
 * hesaplanır (elle istisnalar korunur); "Yalnız bundan sonra" → firmaların bugünkü sayfaları aynen kalır.
 */
const PaketlerPage: React.FC = () => {
  const [liste, setListe] = useState<PaketListesi | null>(null);
  const [katalog, setKatalog] = useState<ModulKaydi[] | null>(null);
  const [seciliKod, setSeciliKod] = useState<string>("kuyum");
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [degisti, setDegisti] = useState(false);
  const [soru, setSoru] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const k = await adminApi.modulKatalogEsitle(modulKatalogu());
        const l = await paketleriHazirla();
        setKatalog(k);
        setListe(l);
      } catch (err: any) {
        setHata(err?.message || "Paketler getirilemedi.");
      }
    })();
  }, []);

  const secili = liste?.paketler.find((p) => p.paketKodu === seciliKod) || null;
  useEffect(() => {
    if (secili) setAcik(new Set(secili.moduller));
    setDegisti(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seciliKod, liste]);

  const yapi = useMemo(() => agacYapisi(katalog || []), [katalog]);
  const yapraklar = (katalog || []).filter((m) => yapi.yaprakMi(m.modulKodu));
  const kayitli = useMemo(() => new Set(secili?.moduller || []), [secili]);
  // Hiçbir pakette (çekirdek dahil) olmayan sayfalar: menüye sonradan eklenmiş olabilir, ERP dışında kimsede açık değil
  const pakette = useMemo(() => new Set((liste?.paketler || []).flatMap((p) => p.moduller)), [liste]);
  const sahipsiz = yapraklar.filter((m) => !pakette.has(m.modulKodu));

  const paketSec = (kod: string) => {
    if (degisti && !window.confirm("Kaydedilmemiş değişiklikler var. Yine de başka pakete geçilsin mi?")) return;
    setSeciliKod(kod);
    setBilgi(null);
  };

  const kaydet = async (uygula: boolean) => {
    if (!secili) return;
    setSoru(false);
    setKaydediliyor(true);
    setHata(null);
    try {
      const s = await adminApi.paketYaz(secili.paketKodu, { moduller: [...acik], uygula });
      setListe({ ...liste!, paketler: liste!.paketler.map((p) => (p.paketKodu === s.paket.paketKodu ? s.paket : p)) });
      setBilgi(
        uygula
          ? `${secili.ad} kaydedildi ve ${s.etkilenenFirma} firmaya uygulandı.` +
              (s.kurulumFirmalari.length ? ` Kurulum (exe) firmaları için yeni lisans kodu üretin: ${s.kurulumFirmalari.join(", ")}.` : "")
          : `${secili.ad} kaydedildi. Mevcut ${s.etkilenenFirma} firmanın sayfaları değişmedi; yeni içerik bundan sonra ürün seçilen lisanslarda geçerli.`
      );
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  if (!liste || !katalog) {
    return hata ? (
      <Alert variant="danger">{hata}</Alert>
    ) : (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!liste.kurulu) {
    return (
      <Alert variant="warning">
        Ürün paketi tabloları merkez veritabanında kurulmamış. Sunucuda <code>docs/sql/LIKYA_ADMIN_URUN_PAKET.sql</code> betiğini SSMS'te
        çalıştırın, sonra bu sayfayı yenileyin. Betik çalışana kadar lisanslar eskisi gibi (ürünsüz) çalışır.
      </Alert>
    );
  }

  const acikYaprak = yapraklar.filter((m) => acik.has(m.modulKodu)).length;
  const fark = yapraklar.filter((m) => acik.has(m.modulKodu) !== kayitli.has(m.modulKodu)).length;
  const rozet = (m: ModulKaydi) => {
    if (!yapi.yaprakMi(m.modulKodu) || acik.has(m.modulKodu) === kayitli.has(m.modulKodu)) return null;
    return acik.has(m.modulKodu) ? (
      <Badge bg="primary" className="fw-normal">Eklenecek</Badge>
    ) : (
      <Badge bg="warning" text="dark" className="fw-normal">Çıkarılacak</Badge>
    );
  };

  const paketSatiri = (p: PaketDto) => (
    <ListGroup.Item key={p.paketKodu} action active={p.paketKodu === seciliKod} onClick={() => paketSec(p.paketKodu)} className="d-flex align-items-center gap-2">
      <span className="rounded-circle d-inline-block" style={{ width: 10, height: 10, flexShrink: 0, background: URUN_ROZET_RENGI[p.paketKodu] || "#adb5bd" }} />
      <span className="flex-grow-1">
        <span className="fw-semibold">{p.ad}</span>
        <div className="small opacity-75">
          {p.hepsi ? "Tüm sayfalar" : p.cekirdek ? `Her pakette · ${p.moduller.length} kod` : `${p.moduller.length} kod`}
        </div>
      </span>
      <Badge bg={p.paketKodu === seciliKod ? "light" : "secondary"} text={p.paketKodu === seciliKod ? "dark" : undefined} title="Bu paketi kullanan firma">
        {p.firmaSayisi}
      </Badge>
    </ListGroup.Item>
  );

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
        <div>
          <h4 className="mb-1">Paket Tanımları</h4>
          <div className="text-muted small">
            Lisansta seçilen ürünün firmaya hangi sayfaları açacağı. Firmada elle açılan / kapatılan sayfalar paket değişse de korunur.
          </div>
        </div>
      </div>

      {hata && <Alert variant="danger">{hata}</Alert>}
      {bilgi && (
        <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
          {bilgi}
        </Alert>
      )}
      {sahipsiz.length > 0 && (
        <Alert variant="warning" className="py-2 small">
          Hiçbir pakette olmayan {sahipsiz.length} sayfa var (menüye sonradan eklenmiş olabilir; yalnız ERP firmalarında açık):{" "}
          {sahipsiz.slice(0, 8).map((m) => m.baslik).join(", ")}
          {sahipsiz.length > 8 ? " …" : ""}
        </Alert>
      )}

      <Row className="g-3">
        <Col lg={3}>
          <ListGroup className="shadow-sm">{liste.paketler.map(paketSatiri)}</ListGroup>
        </Col>
        <Col lg={9}>
          {secili && (
            <Card className="shadow-sm">
              <Card.Body className="p-4">
                <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                  <div>
                    <h5 className="mb-1">{secili.ad}</h5>
                    <div className="text-muted small">
                      {secili.firmaSayisi} firma kullanıyor
                      {secili.kurulumFirmaSayisi > 0 && ` (${secili.kurulumFirmaSayisi} kurulum)`}
                      {secili.guncellemeTarihi && ` · son değişiklik ${tarihYaz(secili.guncellemeTarihi)}${secili.guncelleyen ? ` (${secili.guncelleyen})` : ""}`}
                    </div>
                  </div>
                  {!secili.hepsi && (
                    <div className="d-flex gap-2 align-items-center">
                      <span className="text-muted small">
                        {acikYaprak} / {yapraklar.length} sayfa{fark > 0 && ` · ${fark} değişiklik`}
                      </span>
                      <Button size="sm" variant="outline-secondary" disabled={!degisti || kaydediliyor} onClick={() => { setAcik(new Set(secili.moduller)); setDegisti(false); }}>
                        Geri Al
                      </Button>
                      <Button size="sm" className="btn-adm" disabled={!degisti || kaydediliyor} onClick={() => (secili.firmaSayisi > 0 ? setSoru(true) : kaydet(false))}>
                        {kaydediliyor ? <Spinner animation="border" size="sm" /> : "Kaydet"}
                      </Button>
                    </div>
                  )}
                </div>

                {secili.hepsi ? (
                  <Alert variant="info" className="mb-0">
                    {secili.ad} tüm sayfaları kapsar; içeriği düzenlenmez. Menüye eklenen yeni sayfalar ERP firmalarında kendiliğinden açılır.
                    Firmaya özel kapatma Firma Detay › Modüller sekmesinden yapılır.
                  </Alert>
                ) : (
                  <>
                    {secili.cekirdek && (
                      <Alert variant="secondary" className="py-2 small">
                        Çekirdek, seçilen her ürünle birlikte açılır (ERP hariç tüm ürünlü firmalar).
                      </Alert>
                    )}
                    <ModulAgaci
                      katalog={katalog}
                      acik={acik}
                      kimlik={`paket-${secili.paketKodu}`}
                      rozet={rozet}
                      onDegistir={(y) => {
                        setAcik(y);
                        setDegisti(true);
                        setBilgi(null);
                      }}
                    />
                  </>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      <Modal show={soru} onHide={() => setSoru(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{secili?.ad} — değişiklik kime uygulansın?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-2">
            Bu paketi kullanan <strong>{secili?.firmaSayisi} firma</strong> var.
          </p>
          <ul className="small mb-2">
            <li>
              <strong>Firmalara da uygula:</strong> bu firmaların sayfaları yeni içerikle yeniden hesaplanır; firmada elle açılan /
              kapatılan sayfalar korunur.
            </li>
            <li>
              <strong>Yalnız bundan sonra:</strong> mevcut firmaların sayfaları aynen kalır; yeni içerik bundan sonra ürün seçilen
              lisanslarda geçerli olur.
            </li>
          </ul>
          {!!secili?.kurulumFirmaSayisi && (
            <Alert variant="warning" className="py-2 small mb-0">
              {secili.kurulumFirmaSayisi} kurulum (exe) firması var: uygularsanız onlar için yeni lisans kodu üretmeniz gerekir.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => kaydet(false)}>
            Yalnız bundan sonra
          </Button>
          <Button className="btn-adm" onClick={() => kaydet(true)}>
            Firmalara da uygula
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default PaketlerPage;

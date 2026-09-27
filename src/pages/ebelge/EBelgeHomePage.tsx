import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import {
  IconFileCertificate,
  IconInbox,
  IconSend,
  IconSettings,
  IconFileCheck,
  IconTruckDelivery,
  IconCircleCheck,
  IconCircleX,
} from "@tabler/icons-react";

import ERPToolbar from "../../components/common/ERPToolbar";
import { EbelgeAyar, EbelgeYerelTaslak, EBELGE_YEREL_TASLAK_FORMU, ebelgeService, ebelgeTutar } from "../../services/ebelgeService";
import { KnskYaklasanlarKarti } from "./EBelgeKnsk";

/**
 * e-Belge ana sayfası (hub).
 *
 * Sol menüye dal eklemek yerine bu sayfa kullanılıyor (docs/ice-baglanti.md karar #14):
 * üst şeritteki "E- Belge" bağlantısı buraya geliyor, alt ekranlara geçiş buradaki kartlardan.
 */

interface ModulKarti {
  baslik: string;
  aciklama: string;
  ikon: React.ReactNode;
  yol: string;
  hazir: boolean;
}

const KARTLAR: ModulKarti[] = [
  {
    baslik: "Gelen Kutusu",
    aciklama: "Firmanıza gelen e-Faturaları görüntüleyin, kabul veya red cevabı verin.",
    ikon: <IconInbox size={26} />,
    yol: "/e-belge/gelen",
    hazir: true,
  },
  {
    baslik: "Giden Kutusu",
    aciklama: "Gönderdiğiniz e-Fatura, e-Arşiv, e-Gider ve e-İrsaliye belgeleri; gönderildi / hatalı durumu, PDF ve iptal işlemleri.",
    ikon: <IconSend size={26} />,
    yol: "/e-belge/giden",
    hazir: true,
  },
  {
    baslik: "e-Fatura / e-Arşiv Oluştur",
    aciklama: "Ad soyad veya TC/VKN ile mükellef sorgulayın; mükellefse e-Fatura, değilse e-Arşiv olarak düzenleyin.",
    ikon: <IconFileCheck size={26} />,
    yol: "/e-belge/dogrula",
    hazir: true,
  },
  {
    baslik: "e-İrsaliye Oluştur",
    aciklama: "Sevk irsaliyesi düzenleyin — doğrulayın, GİB'e gönderin. İrsaliyede tutar yoktur.",
    ikon: <IconTruckDelivery size={26} />,
    yol: "/e-belge/irsaliye",
    hazir: true,
  },
  {
    baslik: "e-Gider Oluştur",
    aciklama: "Gider pusulasını hazırlayın, tutarlarını kontrol edin ve ICE'ye gönderin.",
    ikon: <IconFileCheck size={26} />,
    yol: "/e-belge/gider",
    hazir: true,
  },
  {
    baslik: "e-Müstahsil Oluştur",
    aciklama: "Üretici bilgileri, SMS doğrulaması ve stopajla e-Müstahsil makbuzu düzenleyin.",
    ikon: <IconFileCheck size={26} />,
    yol: "/e-belge/mustahsil",
    hazir: true,
  },
  {
    baslik: "Kesilmiş Belgeleri Gönder",
    aciklama: "Sistemde kesilmiş belgeleri listeleyin, seçip ICE'ye gönderin; gönderilmedi, gönderildi ve hatalı sonuçları izleyin.",
    ikon: <IconSend size={26} />,
    yol: "/e-belge/kaynak",
    hazir: true,
  },
  {
    baslik: "Bağlantı Ayarları",
    aciklama: "Entegratör (ICE Teknoloji) bağlantı bilgileri, bağlantı testi ve kontör durumu.",
    ikon: <IconSettings size={26} />,
    yol: "/ayarlar/e-belge",
    hazir: true,
  },
];

/**
 * e-Fatura / e-Arşiv Oluştur kartı (yönetici isteği 14.09.2026): sayfaya gitmeden önce pop-up'ta TCKN/VKN alınır,
 * numara tamamlanınca mükellef sorgusu kendiliğinden çalışır ve sonuca göre form (e-Fatura ya da e-Arşiv) ilgili
 * senaryoyla otomatik açılır. Sorgu başarısızsa kullanıcı yine de forma geçebilir; tür orada belirlenir.
 */
const VknPopup: React.FC<{ show: boolean; onHide: () => void }> = ({ show, onHide }) => {
  const navigate = useNavigate();
  const [vkn, setVkn] = useState("");
  const [sorgulaniyor, setSorgulaniyor] = useState(false);
  const [sonuc, setSonuc] = useState<{ mukellefMi: boolean; mesaj: string } | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  /** "Forma geç": e-Fatura / e-Arşiv / Taslaklar seçenekleri (docs/GIRIS_VE_EBELGE_DUZENLEME.md E1). */
  const [formSor, setFormSor] = useState(false);
  /** Taslaklar seçildi: kayıtlı fatura taslakları (e-Fatura + e-Arşiv) listelenir. */
  const [taslaklar, setTaslaklar] = useState<EbelgeYerelTaslak[] | null>(null);
  const [taslakHata, setTaslakHata] = useState<string | null>(null);
  const taslaklariGoster = async () => {
    setTaslakHata(null);
    setTaslaklar([]);
    try {
      const liste = await ebelgeService.yerelTaslakListe();
      setTaslaklar(liste.filter((t) => t.belgeTuru === "EFatura" || t.belgeTuru === "EArsiv"));
    } catch (e: any) {
      setTaslaklar(null);
      setTaslakHata(e?.message || "Taslaklar alınamadı.");
    }
  };
  const taslakAc = (id: number) => { onHide(); navigate(`/e-belge/dogrula?taslak=${id}`); };
  const sira = useRef(0);
  const formaGec = (earsiv: boolean) => { onHide(); navigate(`/e-belge/dogrula?senaryo=${earsiv ? "EARSIVFATURA" : "TICARIFATURA"}${vkn ? `&vkn=${encodeURIComponent(vkn)}` : ""}`); };
  const yonlendir = (m: boolean, no: string) => { onHide(); navigate(`/e-belge/dogrula?vkn=${encodeURIComponent(no)}&senaryo=${m ? "TICARIFATURA" : "EARSIVFATURA"}`); };
  useEffect(() => {
    if (show) { setVkn(""); setSonuc(null); setHata(null); setSorgulaniyor(false); setFormSor(false); setTaslaklar(null); setTaslakHata(null); }
  }, [show]);
  useEffect(() => {
    if (!/^\d{10,11}$/.test(vkn)) { setSonuc(null); setHata(null); return; }
    const no = vkn, s = ++sira.current;
    const zaman = setTimeout(async () => {
      setSorgulaniyor(true); setHata(null); setSonuc(null);
      try {
        const cevap = await ebelgeService.mukellefSorgula(no);
        if (s !== sira.current) return;
        setSonuc({ mukellefMi: cevap.mukellefMi, mesaj: cevap.mesaj });
        // Sonuç görülsün diye kısa bekleme, sonra otomatik yönlendirme
        setTimeout(() => { if (s === sira.current) yonlendir(cevap.mukellefMi, no); }, 900);
      } catch (e: any) {
        if (s !== sira.current) return;
        setHata((e?.message || "Mükellef sorgulanamadı.") + " Numarayı kontrol edin ya da türü formda seçmek için Forma geç'e basın.");
      } finally { if (s === sira.current) setSorgulaniyor(false); }
    }, 500);
    return () => clearTimeout(zaman);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vkn]);
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6 fw-semibold">e-Fatura / e-Arşiv — Alıcı TCKN / VKN</Modal.Title></Modal.Header>
      <Modal.Body>
        <Form.Label className="small fw-semibold text-secondary">Alıcı TCKN (11) veya VKN (10)</Form.Label>
        <Form.Control autoFocus size="lg" className="font-monospace" inputMode="numeric" maxLength={11} value={vkn} placeholder="Numara tamamlanınca sorgu kendiliğinden yapılır"
          onChange={e => setVkn(e.target.value.replace(/\D/g, ""))} />
        <div className="mt-3" style={{ minHeight: 48 }}>
          {sorgulaniyor && <div className="text-muted small"><Spinner size="sm" animation="border" className="me-2" />GİB mükellef listesi sorgulanıyor…</div>}
          {sonuc && <Alert variant={sonuc.mukellefMi ? "primary" : "success"} className="py-2 mb-0 small">
            {sonuc.mukellefMi ? "Alıcı e-Fatura mükellefi → e-Fatura formu açılıyor…" : "Alıcı e-Fatura mükellefi değil → e-Arşiv formu açılıyor…"}
          </Alert>}
          {hata && <Alert variant="danger" className="py-2 mb-0 small">{hata}</Alert>}
        </div>
        {formSor && <Alert variant="light" className="border py-2 mt-2 mb-0 small">
          <div className="fw-semibold mb-2">Nereye gitmek istiyorsunuz?</div>
          <div className="d-flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={() => formaGec(false)}>e-Fatura formu</Button>
            <Button size="sm" variant="success" onClick={() => formaGec(true)}>e-Arşiv formu</Button>
            <Button size="sm" variant={taslaklar ? "secondary" : "outline-secondary"} onClick={() => void taslaklariGoster()}>Taslaklar</Button>
          </div>
          {taslakHata && <div className="text-danger mt-2">{taslakHata}</div>}
          {taslaklar && (
            <div className="mt-2 border rounded bg-body" style={{ maxHeight: 260, overflowY: "auto" }}>
              {taslaklar.length === 0 ? (
                <div className="text-secondary p-2">Kayıtlı fatura taslağı yok.</div>
              ) : (
                taslaklar.map((t) => (
                  <button key={t.id} type="button" className="list-group-item list-group-item-action w-100 text-start border-0 border-bottom px-2 py-1"
                    onClick={() => taslakAc(t.id)} title="Taslağı formda aç">
                    <div className="d-flex justify-content-between gap-2">
                      <span className="text-truncate">
                        <Badge bg={t.belgeTuru === "EFatura" ? "primary" : "success"} className="me-1">{EBELGE_YEREL_TASLAK_FORMU[t.belgeTuru].ad}</Badge>
                        {t.aliciUnvan || t.aliciVkn || "Alıcı yok"}
                      </span>
                      <span className="font-monospace text-nowrap">{t.tutar == null ? "" : ebelgeTutar(t.tutar, t.paraBirimi || "TRY")}</span>
                    </div>
                    <div className="text-secondary" style={{ fontSize: 11 }}>
                      #{t.id} · {new Date(t.guncellemeTarihi).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
                      {t.olusturan ? ` · ${t.olusturan}` : ""}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </Alert>}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button variant="secondary" size="sm" onClick={onHide}>Vazgeç</Button>
        <Button variant="outline-primary" size="sm" disabled={sorgulaniyor} onClick={() => setFormSor(true)}>Forma geç</Button>
      </Modal.Footer>
    </Modal>
  );
};

const EBelgeHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [vknPopup, setVknPopup] = useState(false);
  const [ayar, setAyar] = useState<EbelgeAyar | null>(null);
  const [yukleniyor, setYukleniyor] = useState<boolean>(true);

  const durumYukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setAyar(await ebelgeService.getAyar());
    } catch {
      setAyar(null);
    } finally {
      setYukleniyor(false);
    }
  }, []);

  useEffect(() => {
    durumYukle();
  }, [durumYukle]);

  const baglantiHazir = Boolean(ayar?.aktif && ayar?.sifreTanimli && ayar?.kullaniciAdi);

  return (
    <div className="ebelge-home-container w-100 pb-3" style={{ overflowX: "hidden" }}>
      <ERPToolbar
        pageTitle="e-Belge"
        pageIcon={<IconFileCertificate size={22} className="text-primary" />}
        onRefresh={durumYukle}
        disabled={yukleniyor}
      />

      <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
        <Card.Body className="p-3 bg-body">
          <div className="d-flex flex-wrap align-items-center gap-3">
            <span className="fw-semibold" style={{ fontSize: "13px" }}>
              Entegratör Durumu
            </span>

            {yukleniyor ? (
              <Spinner animation="border" size="sm" />
            ) : baglantiHazir ? (
              <span className="d-flex align-items-center gap-1 small">
                <IconCircleCheck size={16} style={{ color: "#22c55e" }} />
                Bağlantı tanımlı ve aktif
                <Badge bg="secondary-subtle" text="secondary" className="ms-1">
                  {ayar?.ortam}
                </Badge>
              </span>
            ) : (
              <span className="d-flex align-items-center gap-1 small">
                <IconCircleX size={16} style={{ color: "#dc2626" }} />
                Bağlantı henüz yapılandırılmadı — Bağlantı Ayarları ekranından tanımlayınız.
              </span>
            )}

            {ayar?.firmaVkn && (
              <span className="text-secondary small ms-auto font-monospace">VKN: {ayar.firmaVkn}</span>
            )}
          </div>
        </Card.Body>
      </Card>

      <KnskYaklasanlarKarti />

      <Row className="g-3">
        {KARTLAR.map((kart) => (
          <Col xs={12} md={6} xl={4} key={kart.yol}>
            <Card
              className="shadow-sm border border-secondary-subtle rounded-3 h-100"
              role={kart.hazir ? "button" : undefined}
              onClick={kart.hazir ? () => (kart.yol === "/e-belge/dogrula" ? setVknPopup(true) : navigate(kart.yol)) : undefined}
              style={kart.hazir ? undefined : { opacity: 0.65 }}
            >
              <Card.Body className="p-3 bg-body d-flex flex-column">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span style={{ color: "#0284c7" }}>{kart.ikon}</span>
                  <span className="fw-semibold" style={{ fontSize: "14px" }}>
                    {kart.baslik}
                  </span>
                  {!kart.hazir && (
                    <Badge bg="warning-subtle" text="warning" className="ms-auto">
                      Hazırlanıyor
                    </Badge>
                  )}
                </div>
                <div className="text-secondary small">{kart.aciklama}</div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
      <VknPopup show={vknPopup} onHide={() => setVknPopup(false)} />
    </div>
  );
};

export default EBelgeHomePage;

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Dropdown, Form, ListGroup, Row, Spinner } from "react-bootstrap";
import { IconEyeCog, IconLock } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import ERPToolbar from "../../components/common/ERPToolbar";
import ModulAgaci from "../../admin/components/ModulAgaci";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { gorunumKatalogu, gorunumYoneticisiMi, kapaliGenislet } from "../../config/kullaniciGorunum";
import { ModulKaydi, sayfaErisimi } from "../../config/modulKatalogu";
import { KullaniciGorunumService } from "../../services/kullaniciGorunumService";
import { UserProfileDto, UserService } from "../../services/userService";
import { anaMenuAcik, yetkiProfilden } from "../../../Backend/src/services/yetki/kullaniciYetkiKural";

/**
 * Görünüm Ayarları (docs/KULLANICI_GORUNUM_YOL_HARITASI.md, Faz 3): yönetici çalışanı seçer, yönetim panelindeki modül
 * ağacının firmanın lisansına süzülmüş hâlinde (G1) menü maddelerini, üst kısayolları ve kontrol düğmelerini (G3) açar/kapatır.
 * Kapalı kodlar saklanır (G7); yöneticilere uygulanmaz (G5).
 */

const TUM_KULLANICILAR = 1000;

export const GorunumAyarlariPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const yonetici = gorunumYoneticisiMi(user);

  const katalog = useMemo<ModulKaydi[]>(() => gorunumKatalogu(user?.merkez?.moduller), [user?.merkez?.moduller]);
  const tumKodlar = useMemo(() => katalog.map((m) => m.modulKodu), [katalog]);

  const [kullanicilar, setKullanicilar] = useState<UserProfileDto[]>([]);
  const [arama, setArama] = useState("");
  const [secili, setSecili] = useState<UserProfileDto | null>(null);
  const [acik, setAcik] = useState<Set<string>>(new Set());
  const [kayitli, setKayitli] = useState<string[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    if (!yonetici) return;
    UserService.listUsers({ limit: TUM_KULLANICILAR })
      .then((r) => setKullanicilar((r.data || []).filter((u) => u.isActive !== false)))
      .catch((e: any) => setHata(e?.message || "Kullanıcılar alınamadı."));
  }, [yonetici]);

  /** Kapalı listeden ağaçtaki açık kümesi: kayıtta olmayan (yeni) kodlar açık (G6) */
  const kapalidanAcik = useCallback(
    (kapali: string[]) => {
      const k = kapaliGenislet(kapali);
      return new Set(tumKodlar.filter((kod) => !k.has(kod)));
    },
    [tumKodlar]
  );

  const kullaniciSec = useCallback(
    async (u: UserProfileDto) => {
      setSecili(u);
      setYukleniyor(true);
      setHata(null);
      try {
        const d = await KullaniciGorunumService.oku(u.id);
        setKayitli(d.kapali);
        setAcik(kapalidanAcik(d.kapali));
      } catch (e: any) {
        setHata(e?.message || "Görünüm ayarı alınamadı.");
        setKayitli([]);
        setAcik(new Set(tumKodlar));
      } finally {
        setYukleniyor(false);
      }
    },
    [kapalidanAcik, tumKodlar]
  );

  const kapaliKodlar = useMemo(() => tumKodlar.filter((k) => !acik.has(k)), [tumKodlar, acik]);
  const degisti = useMemo(() => {
    const a = [...kapaliKodlar].sort().join("|");
    const b = [...kapaliGenislet(kayitli)].filter((k) => tumKodlar.includes(k)).sort().join("|");
    return a !== b;
  }, [kapaliKodlar, kayitli, tumKodlar]);

  const kaydet = useCallback(async () => {
    if (!secili) return;
    setKaydediliyor(true);
    try {
      const d = await KullaniciGorunumService.kaydet(secili.id, kapaliKodlar);
      setKayitli(d.kapali);
      showSuccess(kapaliKodlar.length ? `${secili.fullName || secili.username}: ${kapaliKodlar.length} öğe gizlendi.` : `${secili.fullName || secili.username}: her şey görünür.`);
    } catch (e: any) {
      showError(e?.message || "Görünüm ayarı kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  }, [secili, kapaliKodlar, showSuccess, showError]);

  const kopyala = useCallback(
    async (kaynak: UserProfileDto) => {
      try {
        const d = await KullaniciGorunumService.oku(kaynak.id);
        setAcik(kapalidanAcik(d.kapali));
      } catch (e: any) {
        showError(e?.message || "Kaynak kullanıcının ayarı alınamadı.");
      }
    },
    [kapalidanAcik, showError]
  );

  // G4: harf yetkisiyle zaten kapalı maddeler rozetle gösterilir (kutusu değişebilir ama harf açılmadan görünmez)
  const seciliYetki = useMemo(() => (secili ? yetkiProfilden(secili) : null), [secili]);
  const rozet = useCallback(
    (m: ModulKaydi) => {
      if (!seciliYetki || seciliYetki.yonetici) return null;
      let yetkisiz = false;
      if (m.tur === "ANA" && !m.modulKodu.includes(":")) yetkisiz = !anaMenuAcik(seciliYetki, m.modulKodu);
      else if (m.tur === "ALT" && !m.modulKodu.includes(":#")) yetkisiz = !sayfaErisimi(null, seciliYetki, "/" + m.modulKodu.slice(m.modulKodu.indexOf(":") + 1));
      return yetkisiz ? (
        <Badge bg="secondary" title="Kullanıcı Tanımları'ndaki menü yetkisinde kapalı; burada açılsa da görünmez">
          yetkiyle kapalı
        </Badge>
      ) : null;
    },
    [seciliYetki]
  );

  const suzulen = useMemo(() => {
    const a = arama.trim().toLocaleLowerCase("tr-TR");
    return kullanicilar.filter((u) => !a || `${u.fullName || ""} ${u.username || ""}`.toLocaleLowerCase("tr-TR").includes(a));
  }, [kullanicilar, arama]);

  if (!yonetici) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center text-center py-5">
        <IconLock size={44} className="text-muted mb-3" />
        <h5 className="mb-2">Bu sayfaya yetkiniz yok</h5>
        <p className="text-muted mb-3">Görünüm ayarlarını yalnız sistem yöneticisi değiştirebilir.</p>
        <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  const seciliYonetici = !!secili && (secili.isSysAdmin || secili.role === "admin");
  const kilitli = !secili || seciliYonetici || yukleniyor || kaydediliyor;

  return (
    <div className="d-flex flex-column gap-2">
      <ERPToolbar
        pageTitle="Görünüm Ayarları"
        pageIcon={<IconEyeCog size={20} />}
        onSave={secili && !seciliYonetici ? kaydet : undefined}
        disabled={kilitli || !degisti}
      />
      {hata && (
        <Alert variant="danger" className="py-2 mb-0">
          {hata}
        </Alert>
      )}
      <Row className="g-2">
        <Col md={3}>
          <Card className="h-100">
            <Card.Header className="py-2 fw-semibold small">Çalışanlar</Card.Header>
            <Card.Body className="p-2">
              <Form.Control size="sm" placeholder="Ara…" value={arama} onChange={(e) => setArama(e.target.value)} className="mb-2" />
              <ListGroup variant="flush" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                {suzulen.map((u) => {
                  const yon = u.isSysAdmin || u.role === "admin";
                  return (
                    <ListGroup.Item key={u.id} action active={secili?.id === u.id} onClick={() => void kullaniciSec(u)} className="py-1.5 px-2 small">
                      <div className="d-flex align-items-center gap-2">
                        <span className="flex-grow-1 text-truncate">{u.fullName || u.username}</span>
                        {yon && (
                          <Badge bg="danger" title="Yöneticiye görünüm kısıtı uygulanmaz">
                            Yönetici
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted" style={{ fontSize: 11 }}>
                        {u.username}
                      </div>
                    </ListGroup.Item>
                  );
                })}
                {!suzulen.length && <div className="text-muted small p-2">Kullanıcı yok.</div>}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
        <Col md={9}>
          <Card className="h-100">
            <Card.Header className="py-2 d-flex align-items-center gap-2 flex-wrap">
              <span className="fw-semibold small flex-grow-1">
                {secili ? `${secili.fullName || secili.username} — görünen öğeler` : "Soldan bir çalışan seçiniz"}
              </span>
              {secili && !seciliYonetici && (
                <>
                  <span className="text-muted small">
                    {tumKodlar.length - kapaliKodlar.length} / {tumKodlar.length} açık
                  </span>
                  <Button size="sm" variant="outline-success" disabled={kilitli} onClick={() => setAcik(new Set(tumKodlar))}>
                    Tümünü aç
                  </Button>
                  <Button size="sm" variant="outline-secondary" disabled={kilitli} onClick={() => setAcik(new Set())}>
                    Tümünü kapat
                  </Button>
                  <Dropdown>
                    <Dropdown.Toggle size="sm" variant="outline-primary" disabled={kilitli}>
                      Kopyala
                    </Dropdown.Toggle>
                    <Dropdown.Menu style={{ maxHeight: 300, overflowY: "auto" }}>
                      {kullanicilar
                        .filter((u) => u.id !== secili.id && !(u.isSysAdmin || u.role === "admin"))
                        .map((u) => (
                          <Dropdown.Item key={u.id} onClick={() => void kopyala(u)}>
                            {u.fullName || u.username}
                          </Dropdown.Item>
                        ))}
                    </Dropdown.Menu>
                  </Dropdown>
                  <Button size="sm" variant="primary" disabled={kilitli || !degisti} onClick={() => void kaydet()}>
                    {kaydediliyor ? <Spinner size="sm" animation="border" /> : "Kaydet"}
                  </Button>
                </>
              )}
            </Card.Header>
            <Card.Body className="p-2" style={{ maxHeight: "72vh", overflowY: "auto" }}>
              {!secili && (
                <div className="text-muted small p-2">
                  Ağaçta yalnız firmanızın lisansındaki menüler, üst kısayollar ve üst çubuk kontrol düğmeleri listelenir. Kapatılan öğe
                  çalışanın sol/üst menüsünde, kısayol çubuğunda ve ana sayfada görünmez; adresle de açılamaz.
                </div>
              )}
              {secili && seciliYonetici && (
                <Alert variant="info" className="py-2 small mb-0">
                  Bu kullanıcı yönetici; yöneticiler lisanstaki her şeyi görür, görünüm kısıtı uygulanmaz.
                </Alert>
              )}
              {secili && !seciliYonetici && yukleniyor && (
                <div className="d-flex align-items-center gap-2 small text-muted p-2">
                  <Spinner size="sm" animation="border" /> Yükleniyor…
                </div>
              )}
              {secili && !seciliYonetici && !yukleniyor && (
                <ModulAgaci katalog={katalog} acik={acik} onDegistir={setAcik} disabled={kilitli} kimlik={`gorunum-${secili.id}`} rozet={rozet} />
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default GorunumAyarlariPage;

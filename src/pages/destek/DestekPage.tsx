import React, { useCallback, useEffect, useState } from "react";
import { Button, Form, Nav, Spinner } from "react-bootstrap";
import { IconChecks, IconCloudOff, IconPlus, IconRefresh } from "@tabler/icons-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import KonuListesi from "../../components/destek/KonuListesi";
import KonuSohbet from "../../components/destek/KonuSohbet";
import TalepOlusturModal from "../../components/destek/TalepOlusturModal";
import { DestekService, KonuOzet, KullaniciSekmesi } from "../../services/destekService";
import "../../components/destek/destek.scss";

const SEKMELER: { key: KullaniciSekmesi; ad: string }[] = [
  { key: "tumu", ad: "Tümü" },
  { key: "talepler", ad: "Taleplerim" },
  { key: "bildirimler", ad: "Bildirimler" },
  { key: "arsiv", ad: "Arşiv" },
];

/** Destek sayfası (K11, K20): solda liste, sağda sohbet. ?konu=ID ile doğrudan açılır. */
const DestekPage: React.FC = () => {
  const navigate = useNavigate();
  const [arama, setArama] = useSearchParams();
  const seciliId = Number(arama.get("konu")) || null;
  const [sekme, setSekme] = useState<KullaniciSekmesi>("tumu");
  const [konular, setKonular] = useState<KonuOzet[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [cevrimdisi, setCevrimdisi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [talepAcik, setTalepAcik] = useState(false);
  const [filtre, setFiltre] = useState("");

  const yukle = useCallback(async (sessiz = false) => {
    if (!sessiz) setYukleniyor(true);
    try {
      const s = await DestekService.konular(sekme);
      setKonular(s.konular);
      setCevrimdisi(!!s.cevrimdisi);
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Liste okunamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [sekme]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const sec = (k: KonuOzet) => setArama({ konu: String(k.konuId) });
  const sohbetDegisti = useCallback(() => yukle(true), [yukle]);

  const gorunen = filtre.trim()
    ? konular.filter((k) => `${k.baslik} ${k.sonMesaj || ""}`.toLocaleLowerCase("tr-TR").includes(filtre.trim().toLocaleLowerCase("tr-TR")))
    : konular;

  return (
    <div className="container-fluid px-2 px-md-3 pt-2">
      <div className="d-flex align-items-center justify-content-between mb-2 flex-wrap gap-2">
        <h5 className="mb-0">Destek</h5>
        <div className="d-flex align-items-center gap-2">
          {cevrimdisi && (
            <span className="small text-warning d-inline-flex align-items-center gap-1">
              <IconCloudOff size={14} /> Merkeze ulaşılamıyor
            </span>
          )}
          <Button variant="outline-secondary" size="sm" onClick={() => yukle()} title="Yenile">
            <IconRefresh size={16} />
          </Button>
          <Button
            variant="outline-secondary"
            size="sm"
            title="Tümünü okundu işaretle"
            onClick={async () => {
              await DestekService.okundu(null).catch(() => undefined);
              yukle(true);
            }}
          >
            <IconChecks size={16} />
          </Button>
          <Button variant="primary" size="sm" onClick={() => setTalepAcik(true)}>
            <IconPlus size={16} className="me-1" />
            Talep Oluştur
          </Button>
        </div>
      </div>

      <div className="destek-sayfa">
        <div className="destek-sol">
          <Nav className="nav-line-bottom px-2 pt-1" activeKey={sekme} onSelect={(k) => k && setSekme(k as KullaniciSekmesi)}>
            {SEKMELER.map((s) => (
              <Nav.Item key={s.key}>
                <Nav.Link role="button" eventKey={s.key} className="px-2 py-2 small">
                  {s.ad}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
          <div className="px-2 py-2 border-bottom">
            <Form.Control size="sm" placeholder="Ara…" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
          </div>
          {hata && <div className="text-danger small px-3 py-2">{hata}</div>}
          {yukleniyor && konular.length === 0 ? (
            <div className="text-center py-5">
              <Spinner size="sm" />
            </div>
          ) : (
            <KonuListesi konular={gorunen} seciliId={seciliId} onSec={sec} bosMetin={sekme === "talepler" ? "Henüz talebiniz yok." : "Kayıt yok."} />
          )}
        </div>
        <div className="destek-sag">
          {seciliId ? (
            <KonuSohbet key={seciliId} konuId={seciliId} onDegisti={sohbetDegisti} onKonuDegisti={(id) => setArama({ konu: String(id) })} />
          ) : (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 text-secondary py-5 gap-2">
              <div>Soldan bir kayıt seçin ya da yeni talep oluşturun.</div>
              <Button variant="outline-primary" size="sm" onClick={() => setTalepAcik(true)}>
                <IconPlus size={16} className="me-1" />
                Talep Oluştur
              </Button>
            </div>
          )}
        </div>
      </div>

      <TalepOlusturModal
        show={talepAcik}
        onHide={() => setTalepAcik(false)}
        onAcildi={(d) => {
          setTalepAcik(false);
          setSekme("talepler");
          navigate(`/destek?konu=${d.konu.konuId}`);
        }}
      />
    </div>
  );
};

export default DestekPage;

import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Nav, Spinner } from "react-bootstrap";
import { useSearchParams } from "react-router-dom";
import { IconPhone, IconRefresh } from "@tabler/icons-react";
import { DURUM_ADI, DURUM_RENGI, konuEtiketi, zamanOnce } from "../../components/destek/destekOrtak";
import { DESTEK_DEGISTI_OLAYI, EkipUyesi, HizliCevap, panelApi, PanelKonu, PanelKonuFiltresi, PanelOzet, PanelSekme } from "../services/panelApi";
import { usePanelAuth } from "../context/PanelAuthContext";
import PanelKonuSohbet from "../components/PanelKonuSohbet";
import TelefonTalebiModal from "../components/TelefonTalebiModal";
import "../../components/destek/destek.scss";

const SAYFA_BOYU = 50;

const SEKMELER: { anahtar: PanelSekme; baslik: string }[] = [
  { anahtar: "havuz", baslik: "Havuz" },
  { anahtar: "benim", baslik: "Bana atanan" },
  { anahtar: "tumu", baslik: "Tümü" },
  { anahtar: "sistem", baslik: "Sistem" },
];

/** Destek paneli > Talepler: sekmeli liste (havuz / bana atanan / tümü / sistem) + sohbet (D6, D7, D10). */
const TaleplerPage: React.FC = () => {
  const { personel } = usePanelAuth();
  const [arama, setArama] = useSearchParams();
  const seciliId = Number(arama.get("konu")) || null;
  const kaynakId = Number(arama.get("kaynak")) || undefined;
  const firmaParam = Number(arama.get("firma")) || undefined;
  const [sekme, setSekme] = useState<PanelSekme>(kaynakId || firmaParam ? "tumu" : "havuz");
  const [durum, setDurum] = useState<string>("");
  const [metinArama, setMetinArama] = useState("");
  const [personelFiltre, setPersonelFiltre] = useState<number | undefined>(undefined);
  const [sayfa, setSayfa] = useState(1);
  const [satirlar, setSatirlar] = useState<PanelKonu[]>([]);
  const [toplam, setToplam] = useState(0);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [ozet, setOzet] = useState<PanelOzet | null>(null);
  const [ekip, setEkip] = useState<EkipUyesi[]>([]);
  const [hizli, setHizli] = useState<HizliCevap[]>([]);
  const [telefonAcik, setTelefonAcik] = useState(false);

  useEffect(() => {
    panelApi.ekip().then(setEkip).catch(() => undefined);
    panelApi.hizliCevaplar().then(setHizli).catch(() => undefined);
  }, []);

  const yukle = useCallback(
    async (sessiz = false) => {
      if (!sessiz) setYukleniyor(true);
      const f: PanelKonuFiltresi = { sekme, sayfa, sayfaBoyu: SAYFA_BOYU };
      if (durum) f.durum = durum;
      if (metinArama.trim()) f.arama = metinArama.trim();
      if (personelFiltre) f.personelId = personelFiltre;
      if (kaynakId) f.kaynakKonuId = kaynakId;
      if (firmaParam) f.firmaId = firmaParam;
      try {
        const [s, o] = await Promise.all([panelApi.konular(f), panelApi.ozet()]);
        setSatirlar(s.satirlar);
        setToplam(s.toplam);
        setOzet(o);
        setHata(null);
      } catch (err: any) {
        setHata(err?.message || "Liste okunamadı.");
      } finally {
        setYukleniyor(false);
      }
    },
    [sekme, durum, metinArama, personelFiltre, sayfa, kaynakId, firmaParam]
  );

  useEffect(() => {
    yukle();
  }, [yukle]);

  useEffect(() => {
    const z = setInterval(() => document.visibilityState === "visible" && yukle(true), 20_000);
    return () => clearInterval(z);
  }, [yukle]);

  useEffect(() => {
    const dinle = () => yukle(true);
    window.addEventListener(DESTEK_DEGISTI_OLAYI, dinle);
    return () => window.removeEventListener(DESTEK_DEGISTI_OLAYI, dinle);
  }, [yukle]);

  const sec = (konuId: number | null) => {
    const yeni = new URLSearchParams(arama);
    if (konuId) yeni.set("konu", String(konuId));
    else yeni.delete("konu");
    setArama(yeni);
  };
  const filtreTemizle = () => {
    const yeni = new URLSearchParams(arama);
    yeni.delete("kaynak");
    yeni.delete("firma");
    setArama(yeni);
  };

  const sekmeSayisi = (s: PanelSekme) => (s === "havuz" ? ozet?.havuz : s === "benim" ? ozet?.benim : s === "sistem" ? ozet?.sistemOkunmamis : undefined);
  const sayfaSayisi = Math.max(1, Math.ceil(toplam / SAYFA_BOYU));
  const tumunuGorur = personel?.rol === "ADMIN" || personel?.gorme === "TUMU";

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <Nav variant="tabs" activeKey={sekme} onSelect={(k) => { setSekme((k as PanelSekme) || "havuz"); setSayfa(1); setDurum(""); }}>
            {SEKMELER.map((s) => (
              <Nav.Item key={s.anahtar}>
                <Nav.Link eventKey={s.anahtar}>
                  {s.baslik}
                  {!!sekmeSayisi(s.anahtar) && (
                    <Badge bg={s.anahtar === "havuz" ? "warning" : s.anahtar === "sistem" ? "danger" : "primary"} text={s.anahtar === "havuz" ? "dark" : undefined} pill className="ms-1">
                      {sekmeSayisi(s.anahtar)}
                    </Badge>
                  )}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>
          <div className="d-flex flex-wrap gap-2">
            <Form.Control size="sm" style={{ width: 210 }} placeholder="Başlık, firma, müşteri no…" value={metinArama} onChange={(e) => { setMetinArama(e.target.value); setSayfa(1); }} />
            <Form.Select size="sm" style={{ width: 160 }} value={durum} onChange={(e) => { setDurum(e.target.value); setSayfa(1); }}>
              <option value="">{sekme === "havuz" ? "Tüm durumlar" : "Kapalı olmayanlar"}</option>
              <option value="HEPSI">Kapalılar dahil</option>
              <option value="ACIK">Açık</option>
              <option value="KULLANICI_YANITLADI">Müşteri yanıtladı</option>
              <option value="CEVAPLANDI">Cevaplandı</option>
              {sekme !== "havuz" && <option value="KAPALI">Kapalı</option>}
            </Form.Select>
            {tumunuGorur && sekme === "tumu" && (
              <Form.Select size="sm" style={{ width: 170 }} value={personelFiltre ?? ""} onChange={(e) => { setPersonelFiltre(e.target.value ? Number(e.target.value) : undefined); setSayfa(1); }}>
                <option value="">Tüm personel</option>
                {ekip.map((x) => (
                  <option key={x.personelId} value={x.personelId}>
                    {x.adSoyad}
                  </option>
                ))}
              </Form.Select>
            )}
            <Button size="sm" variant="outline-primary" onClick={() => setTelefonAcik(true)} title="Telefonla arayan müşteri için talep aç">
              <IconPhone size={16} className="me-1" />
              Telefon talebi
            </Button>
            <Button size="sm" variant="outline-secondary" onClick={() => yukle()} title="Yenile">
              <IconRefresh size={16} />
            </Button>
          </div>
        </div>
        <div className="small text-muted mb-2">
          {toplam} kayıt
          {(kaynakId || firmaParam) && (
            <>
              {" · "}
              {kaynakId ? `#${kaynakId} bildirimine yanıtlar` : "seçili firmanın kayıtları"}{" "}
              <Button variant="link" size="sm" className="p-0 align-baseline" onClick={filtreTemizle}>
                (süzgeci kaldır)
              </Button>
            </>
          )}
        </div>

        {hata && <Alert variant="danger">{hata}</Alert>}

        <div className="destek-sayfa" style={{ height: "calc(100vh - 235px)" }}>
          <div className="destek-sol">
            {yukleniyor && satirlar.length === 0 ? (
              <div className="text-center py-5">
                <Spinner animation="border" size="sm" />
              </div>
            ) : satirlar.length === 0 ? (
              <div className="text-center text-muted small py-5">{sekme === "havuz" ? "Havuzda bekleyen talep yok." : "Kayıt yok."}</div>
            ) : (
              <div className="destek-liste">
                {satirlar.map((k) => (
                  <div
                    key={k.konuId}
                    role="button"
                    tabIndex={0}
                    className={`destek-satir${k.okunmamis ? " okunmamis" : ""}${seciliId === k.konuId ? " secili" : ""}`}
                    onClick={() => sec(k.konuId)}
                    onKeyDown={(e) => e.key === "Enter" && sec(k.konuId)}
                  >
                    <div className="destek-govde">
                      <div className="destek-baslik" title={k.baslik}>
                        {k.baslik}
                      </div>
                      <div className="destek-ozet">
                        {k.firmaUnvan || "-"}
                        {k.kullaniciAdi ? ` · ${k.kullaniciAdi}` : ""}
                      </div>
                      {k.sonMesaj && (
                        <div className="destek-ozet">
                          {k.sonMesajTaraf === "ADMIN" ? "Destek: " : ""}
                          {k.sonMesaj}
                        </div>
                      )}
                      <div className="destek-alt">
                        <span>{konuEtiketi(k)}</span>
                        <Badge bg={DURUM_RENGI[k.durum]} className="fw-normal">
                          {DURUM_ADI[k.durum]}
                        </Badge>
                        {k.oncelik === "ACIL" && k.tur === "TALEP" && (
                          <Badge bg="danger" className="fw-normal">
                            Acil
                          </Badge>
                        )}
                        {k.kaynak === "TELEFON" && (
                          <Badge bg="info" className="fw-normal">
                            Tel
                          </Badge>
                        )}
                        {k.atananAdmin ? <span title="Atanan">→ {k.atananPersonelId === personel?.personelId ? "Ben" : k.atananAdmin}</span> : <span className="text-warning-emphasis">havuz</span>}
                        <span className="ms-auto">{zamanOnce(k.sonMesajTarihi)}</span>
                      </div>
                    </div>
                    {k.okunmamis && <div className="destek-nokta" />}
                  </div>
                ))}
              </div>
            )}
            {sayfaSayisi > 1 && (
              <div className="d-flex justify-content-between align-items-center p-2 border-top small">
                <Button size="sm" variant="outline-secondary" disabled={sayfa <= 1} onClick={() => setSayfa(sayfa - 1)}>
                  Önceki
                </Button>
                <span>
                  {sayfa} / {sayfaSayisi}
                </span>
                <Button size="sm" variant="outline-secondary" disabled={sayfa >= sayfaSayisi} onClick={() => setSayfa(sayfa + 1)}>
                  Sonraki
                </Button>
              </div>
            )}
          </div>
          <div className="destek-sag">
            {seciliId ? (
              <PanelKonuSohbet key={seciliId} konuId={seciliId} ekip={ekip} hizliCevaplar={hizli} onDegisti={() => yukle(true)} onKapandi={() => sec(null)} />
            ) : (
              <div className="d-flex align-items-center justify-content-center h-100 text-muted py-5">Soldan bir kayıt seçin.</div>
            )}
          </div>
        </div>
      </Card.Body>
      <TelefonTalebiModal
        show={telefonAcik}
        onHide={() => setTelefonAcik(false)}
        onAcildi={(konuId) => {
          setTelefonAcik(false);
          setSekme("benim");
          sec(konuId);
          yukle(true);
        }}
      />
    </Card>
  );
};

export default TaleplerPage;

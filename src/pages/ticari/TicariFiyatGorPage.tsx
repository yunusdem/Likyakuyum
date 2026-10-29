import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner } from "react-bootstrap";
import { IconBarcode, IconPhoto, IconPrinter, IconSearch, IconTag, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { KurService } from "../../services/kurService";
import { AktifKampanya, StokKart, TicariService, miktarYaz, para } from "../../services/ticariService";
import { kampanyaSec, kartDahilFiyat } from "../../../Backend/src/services/ticari/ticariHesap";
import { StokKartSecici } from "./StokKartSecici";

/**
 * L- Fiyat Gör (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 2, G3–G4): stok kartı için barkod okutup fiyat / stok görme.
 * Kuyum'un Barkod Fiyat sayfasından ayrıdır; döviz fiyatlı kart güncel satış kuruyla TL'ye çevrilir. Kampanyalı fiyat İş 11'de.
 */
const TL = (kod?: string | null) => ["TL", "TRY", ""].includes(String(kod || "").trim().toUpperCase());

export const TicariFiyatGorPage: React.FC = () => {
  const navigate = useNavigate();
  const [barkod, setBarkod] = useState("");
  const [kart, setKart] = useState<StokKart | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [secici, setSecici] = useState<{ acik: boolean; arama: string }>({ acik: false, arama: "" });
  const [kurlar, setKurlar] = useState<Map<number, number>>(new Map());
  const [kampanyalar, setKampanyalar] = useState<AktifKampanya[]>([]);
  const girisRef = useRef<HTMLInputElement | null>(null);
  const odak = () => setTimeout(() => { girisRef.current?.focus(); girisRef.current?.select(); }, 50);

  useEffect(() => {
    KurService.getKurTablosu({ tur: 0 }).then((t) => {
      const m = new Map<number, number>();
      for (const k of t?.satirlar || []) m.set(Number(k.paraId), Number(k.efektifSatis ?? k.dovizSatis ?? 0) || 0);
      setKurlar(m);
    }).catch(() => setKurlar(new Map()));
    TicariService.aktifKampanyalar().then(setKampanyalar).catch(() => setKampanyalar([]));
    odak();
  }, []);

  /** Kartı (resmiyle) gösterir */
  const goster = useCallback(async (k: StokKart) => {
    setHata(null);
    try {
      setKart(await TicariService.kart(k.stokKartId));
    } catch {
      setKart(k);
    }
    odak();
  }, []);

  const okut = async () => {
    const d = barkod.trim();
    if (!d) { setSecici({ acik: true, arama: "" }); return; }
    setYukleniyor(true);
    setHata(null);
    try {
      const k = await TicariService.kartBul(d);
      if (k) { setBarkod(""); await goster(k); }
      else { setKart(null); setHata(`"${d}" barkodlu ya da kodlu ürün bulunamadı.`); setSecici({ acik: true, arama: d }); }
    } catch (e: any) {
      setHata(e?.message || "Ürün aranamadı.");
    } finally {
      setYukleniyor(false);
    }
  };

  const temizle = () => { setKart(null); setHata(null); setBarkod(""); odak(); };

  // Fiyat: KDV dahil TL; döviz fiyatlı kartta güncel satış kuruyla
  const dahil = kart ? kartDahilFiyat(kart.satisFiyati, kart.kdvOrani, kart.fiyatKdvDahil) : 0;
  const dovizli = !!(kart && kart.paraId && !TL(kart.paraKodu));
  const kur = dovizli ? kurlar.get(kart!.paraId!) || 0 : 1;
  const fiyatTL = dovizli ? Math.round(dahil * kur * 100) / 100 : dahil;
  // Kampanya (İş 11, G12): kapsayan kampanya varsa kampanyalı fiyat da gösterilir
  const kmp = kart && kart.satisFiyati !== null ? kampanyaSec(kampanyalar, { stokKartId: kart.stokKartId, stokGrupId: kart.stokGrupId }, fiyatTL) : null;

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="L- Fiyat Gör" pageIcon={<IconTag size={20} />} hideSave hideDelete hideNew hidePrint onRefresh={temizle} />
      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-3">
          <Row className="g-2 align-items-end">
            <Col md={7}>
              <Form.Label className="fw-bold mb-1">Barkod ya da kod okutun</Form.Label>
              <InputGroup size="lg">
                <InputGroup.Text className="bg-light"><IconBarcode size={22} /></InputGroup.Text>
                <Form.Control ref={girisRef} autoFocus value={barkod} placeholder="Barkod okutun ya da kod yazıp Enter'a basın" disabled={yukleniyor}
                  onChange={(e) => setBarkod(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void okut(); } if (e.key === "Escape") temizle(); }} />
                <Button variant="primary" disabled={yukleniyor} onClick={() => void okut()}>{yukleniyor ? <Spinner size="sm" /> : "Sorgula"}</Button>
                <Button variant="outline-secondary" title="Ürün ara (F4)" onClick={() => setSecici({ acik: true, arama: barkod.trim() })}><IconSearch size={18} className="me-1" />Ara</Button>
              </InputGroup>
            </Col>
            <Col md={5} className="d-flex gap-2 justify-content-md-end">
              <Button variant="outline-success" size="lg" disabled={!kart} onClick={() => kart && navigate(`/ticari/etiket?kart=${kart.stokKartId}`)}><IconPrinter size={18} className="me-1" />Etikete Bas</Button>
              <Button variant="outline-danger" size="lg" disabled={!kart && !barkod} onClick={temizle}><IconX size={18} className="me-1" />Temizle</Button>
            </Col>
          </Row>
          {hata && <Alert variant="warning" className="py-2 mt-2 mb-0">{hata}</Alert>}
        </Card.Body>
      </Card>

      {kart ? (
        <Card className="border shadow-xs">
          <Card.Body className="p-3">
            <Row className="g-3">
              <Col md={3}>
                <div className="border rounded d-flex align-items-center justify-content-center bg-light" style={{ height: 240 }}>
                  {kart.resim ? <img src={kart.resim} alt="" style={{ maxWidth: "100%", maxHeight: 236, objectFit: "contain" }} /> : <IconPhoto size={64} className="text-muted" />}
                </div>
              </Col>
              <Col md={9}>
                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                  <div>
                    <div className="fw-bold" style={{ fontSize: 30, lineHeight: 1.15 }}>{kart.ad}</div>
                    <div className="text-muted mt-1">
                      <span className="font-monospace fw-semibold text-primary">{kart.kod}</span>
                      {kart.grupAdi && <Badge bg="light" text="dark" className="border ms-2">{kart.grupAdi}</Badge>}
                      {!kart.aktif && <Badge bg="secondary" className="ms-2">Pasif</Badge>}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-muted small">Satış fiyatı (KDV dahil)</div>
                    <div className="fw-bold text-success" style={{ fontSize: 44, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                      {kart.satisFiyati === null ? "—" : `${para(fiyatTL)} TL`}
                    </div>
                    {dovizli && kart.satisFiyati !== null && (
                      <div className="small text-muted mt-1">{para(dahil)} {kart.paraKodu} × kur {kur > 0 ? para(kur) : "yok"}</div>
                    )}
                    {kmp && (
                      <div className="mt-1">
                        <Badge bg="danger" className="me-1">Kampanya</Badge>
                        <span className="fw-bold text-danger" style={{ fontSize: 26 }}>{para(Math.max(0, fiyatTL - kmp.indirim))} TL</span>
                        <div className="small text-muted">{kmp.kampanya.ad}: {kmp.kampanya.tur === 1 ? `%${kmp.kampanya.deger}` : `${para(kmp.kampanya.deger)} TL`} indirim</div>
                      </div>
                    )}
                  </div>
                </div>
                <Row className="g-2 mt-2 small">
                  <Col sm={6} md={3}><div className="border rounded p-2 h-100"><div className="text-muted">Stok</div><div className={`fs-5 fw-bold ${kart.bakiye < 0 ? "text-danger" : kart.enAzStok !== null && kart.bakiye < kart.enAzStok ? "text-warning" : ""}`}>{miktarYaz(kart.bakiye)} {kart.birim}</div></div></Col>
                  <Col sm={6} md={3}><div className="border rounded p-2 h-100"><div className="text-muted">KDV</div><div className="fs-5 fw-bold">%{kart.kdvOrani}</div></div></Col>
                  <Col sm={6} md={3}><div className="border rounded p-2 h-100"><div className="text-muted">Barkod</div><div className="fw-bold font-monospace">{kart.barkodlar.length ? kart.barkodlar.join(", ") : "—"}</div></div></Col>
                  <Col sm={6} md={3}><div className="border rounded p-2 h-100"><div className="text-muted">En az stok</div><div className="fs-5 fw-bold">{kart.enAzStok !== null ? `${miktarYaz(kart.enAzStok)} ${kart.birim}` : "—"}</div></div></Col>
                </Row>
                {kart.aciklama && <div className="text-muted small mt-2">{kart.aciklama}</div>}
              </Col>
            </Row>
          </Card.Body>
        </Card>
      ) : (
        <Card className="border shadow-xs"><Card.Body className="text-center text-muted py-5">
          <IconBarcode size={48} className="mb-2" /><div>Barkod okutun ya da "Ara" ile ürün seçin.</div>
        </Card.Body></Card>
      )}

      <StokKartSecici show={secici.acik} aramaMetni={secici.arama} onHide={() => { setSecici({ acik: false, arama: "" }); odak(); }}
        onSelect={(k) => { setSecici({ acik: false, arama: "" }); setBarkod(""); void goster(k); }} />
    </div>
  );
};

export default TicariFiyatGorPage;

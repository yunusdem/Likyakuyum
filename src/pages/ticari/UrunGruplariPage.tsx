import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconCategory, IconCheck, IconEdit, IconPlus, IconSearch, IconTrash, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { StokGrup, StokKart, TicariService, miktarYaz, para } from "../../services/ticariService";
import { StokKartSecici } from "./StokKartSecici";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

const SAYFA = 200;

/**
 * G- Ürün Grupları (docs/TICARI_ISLEMLER_YOL_HARITASI.md, T6). Gruba ürün ekleme / çıkarma (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md
 * İş 10, G15): kart tek grupta; başka gruptaki kart onayla taşınır. Grubun kartları sayfalı (200) listelenir.
 */
export const UrunGruplariPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const yetki = useTicariYetki();
  const [gruplar, setGruplar] = useState<StokGrup[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [arama, setArama] = useState("");
  const [yeniAd, setYeniAd] = useState("");
  const [duzenlenen, setDuzenlenen] = useState<{ id: number; ad: string; aktif: boolean } | null>(null);
  const [mesgul, setMesgul] = useState(false);
  // Seçili grubun kartları (İş 10)
  const [secili, setSecili] = useState<number | null>(null);
  const [kartlar, setKartlar] = useState<StokKart[]>([]);
  const [kartToplam, setKartToplam] = useState(0);
  const [kartYukleniyor, setKartYukleniyor] = useState(false);
  const [kartArama, setKartArama] = useState("");
  const [secici, setSecici] = useState(false);
  const istek = useRef(0);

  const yukle = async () => {
    setYukleniyor(true);
    try {
      setGruplar(await TicariService.gruplar());
    } catch (e: any) {
      showError(e?.message || "Gruplar alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  };
  useEffect(() => { void yukle(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const kartlariYukle = useCallback(async (grupId: number, sayfa = 1) => {
    const no = ++istek.current;
    setKartYukleniyor(true);
    try {
      const r = await TicariService.kartlarSayfali({ grupId, aktif: null, arama: kartArama.trim() || undefined, sayfa, adet: SAYFA });
      if (no !== istek.current) return;
      setKartlar((p) => (sayfa === 1 ? r.kartlar : [...p, ...r.kartlar.filter((k) => !p.some((x) => x.stokKartId === k.stokKartId))]));
      setKartToplam(r.toplam);
    } catch (e: any) {
      if (no === istek.current) showError(e?.message || "Grubun kartları alınamadı.");
    } finally {
      if (no === istek.current) setKartYukleniyor(false);
    }
  }, [kartArama, showError]);
  useEffect(() => {
    if (secili === null) { setKartlar([]); setKartToplam(0); return; }
    const t = setTimeout(() => { void kartlariYukle(secili); }, kartArama.trim() ? 300 : 0);
    return () => clearTimeout(t);
  }, [secili, kartlariYukle, kartArama]);

  const gorunen = useMemo(() => {
    const t = arama.trim().toLocaleLowerCase("tr-TR");
    return t ? gruplar.filter((g) => g.ad.toLocaleLowerCase("tr-TR").includes(t)) : gruplar;
  }, [gruplar, arama]);
  const seciliGrup = gruplar.find((g) => g.stokGrupId === secili) || null;

  const ekle = async () => {
    if (!yeniAd.trim()) return;
    setMesgul(true);
    try {
      await TicariService.grupKaydet({ ad: yeniAd.trim() });
      showSuccess(`"${yeniAd.trim()}" grubu eklendi.`);
      setYeniAd("");
      await yukle();
    } catch (e: any) {
      showError(e?.message || "Grup eklenemedi.");
    } finally {
      setMesgul(false);
    }
  };

  const kaydet = async () => {
    if (!duzenlenen) return;
    setMesgul(true);
    try {
      await TicariService.grupKaydet({ stokGrupId: duzenlenen.id, ad: duzenlenen.ad, aktif: duzenlenen.aktif });
      showSuccess("Grup güncellendi.");
      setDuzenlenen(null);
      await yukle();
    } catch (e: any) {
      showError(e?.message || "Grup kaydedilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  const sil = async (g: StokGrup) => {
    if (!window.confirm(`"${g.ad}" grubu silinsin mi?`)) return;
    try {
      await TicariService.grupSil(g.stokGrupId);
      showSuccess("Grup silindi.");
      if (secili === g.stokGrupId) setSecili(null);
      await yukle();
    } catch (e: any) {
      showError(e?.message || "Grup silinemedi.");
    }
  };

  /** Seçiciden kart ekleme: başka gruptaysa onayla taşınır (G15) */
  const kartEkle = async (k: StokKart) => {
    if (!seciliGrup) return;
    if (k.stokGrupId === seciliGrup.stokGrupId) { showError(`"${k.ad}" zaten bu grupta.`); return; }
    if (k.stokGrupId && k.grupAdi && !window.confirm(`"${k.ad}" kartı "${k.grupAdi}" grubunda. "${seciliGrup.ad}" grubuna taşınsın mı?`)) return;
    try {
      const r = await TicariService.grupKartlari(seciliGrup.stokGrupId, { ekle: [k.stokKartId] });
      showSuccess(r.tasinan ? `"${k.ad}" gruba taşındı.` : `"${k.ad}" gruba eklendi.`);
      setGruplar((p) => p.map((g) => (g.stokGrupId === seciliGrup.stokGrupId ? { ...g, kartSayisi: g.kartSayisi + r.eklenen } : g.stokGrupId === k.stokGrupId ? { ...g, kartSayisi: Math.max(0, g.kartSayisi - r.tasinan) } : g)));
      void kartlariYukle(seciliGrup.stokGrupId);
    } catch (e: any) {
      showError(e?.message || "Kart gruba eklenemedi.");
    }
  };

  const kartCikar = async (k: StokKart) => {
    if (!seciliGrup) return;
    if (!window.confirm(`"${k.ad}" kartı "${seciliGrup.ad}" grubundan çıkarılsın mı? (Kart grupsuz kalır)`)) return;
    try {
      const r = await TicariService.grupKartlari(seciliGrup.stokGrupId, { cikar: [k.stokKartId] });
      showSuccess("Kart gruptan çıkarıldı.");
      setKartlar((p) => p.filter((x) => x.stokKartId !== k.stokKartId));
      setKartToplam((t) => Math.max(0, t - r.cikarilan));
      setGruplar((p) => p.map((g) => (g.stokGrupId === seciliGrup.stokGrupId ? { ...g, kartSayisi: Math.max(0, g.kartSayisi - r.cikarilan) } : g)));
    } catch (e: any) {
      showError(e?.message || "Kart gruptan çıkarılamadı.");
    }
  };

  const yonetebilir = yetki.yonetebilir;

  return (
    <div className="container-fluid p-2">
      <ERPToolbar pageTitle="G- Ürün Grupları" pageIcon={<IconCategory size={20} />} onRefresh={() => { void yukle(); if (secili !== null) void kartlariYukle(secili); }} hideSave hideDelete hideNew hidePrint />
      {!yetki.yukleniyor && !yonetebilir && <Alert variant="warning" className="py-2">{YETKI_YOK_MESAJI} Grupları ve kartlarını yalnız görüntüleyebilirsiniz.</Alert>}

      <Card className="border shadow-xs mb-2">
        <Card.Body className="p-2 d-flex flex-wrap gap-2 align-items-end">
          <Form.Group style={{ minWidth: 260 }}>
            <Form.Label className="small text-muted mb-1 fw-bold">Yeni grup adı</Form.Label>
            <InputGroup size="sm">
              <Form.Control value={yeniAd} disabled={!yonetebilir || mesgul} maxLength={100} placeholder="Ör. Kırtasiye"
                onChange={(e) => setYeniAd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void ekle(); } }} />
              <Button variant="primary" disabled={!yonetebilir || mesgul || !yeniAd.trim()} onClick={ekle}>
                <IconPlus size={15} className="me-1" />Ekle
              </Button>
            </InputGroup>
          </Form.Group>
          <Form.Group className="ms-auto" style={{ minWidth: 240 }}>
            <Form.Label className="small text-muted mb-1 fw-bold">Ara</Form.Label>
            <InputGroup size="sm">
              <InputGroup.Text className="bg-light"><IconSearch size={15} /></InputGroup.Text>
              <Form.Control value={arama} placeholder="Grup adı ara..." onChange={(e) => setArama(e.target.value)} />
            </InputGroup>
          </Form.Group>
        </Card.Body>
      </Card>

      <Row className="g-2">
        <Col lg={5}>
          <Card className="border shadow-xs">
            <div className="table-responsive" style={{ maxHeight: "calc(100vh - 290px)", minHeight: 240 }}>
              <Table hover striped bordered size="sm" className="align-middle mb-0">
                <thead className="table-light sticky-top">
                  <tr className="small text-secondary">
                    <th style={{ width: 50 }} className="text-center">#</th>
                    <th>Grup Adı</th>
                    <th style={{ width: 110 }} className="text-center">Kart Sayısı</th>
                    <th style={{ width: 90 }} className="text-center">Durum</th>
                    <th style={{ width: 100 }} className="text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {yukleniyor ? (
                    <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
                  ) : gorunen.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-muted">Grup yok. Yukarıdan ekleyebilirsiniz.</td></tr>
                  ) : gorunen.map((g, i) => (
                    <tr key={g.stokGrupId} onClick={() => setSecili(g.stokGrupId)} className={secili === g.stokGrupId ? "table-primary" : ""} style={{ cursor: "pointer" }} title="Grubun ürünlerini göster">
                      <td className="text-center text-muted small">{i + 1}</td>
                      <td>
                        {duzenlenen?.id === g.stokGrupId ? (
                          <div className="d-flex gap-2 align-items-center" onClick={(e) => e.stopPropagation()}>
                            <Form.Control size="sm" autoFocus value={duzenlenen.ad} maxLength={100}
                              onChange={(e) => setDuzenlenen({ ...duzenlenen, ad: e.target.value })}
                              onKeyDown={(e) => { if (e.key === "Enter") void kaydet(); if (e.key === "Escape") setDuzenlenen(null); }} />
                            <Form.Check type="switch" label="Aktif" checked={duzenlenen.aktif} onChange={(e) => setDuzenlenen({ ...duzenlenen, aktif: e.target.checked })} />
                          </div>
                        ) : <span className="fw-semibold">{g.ad}</span>}
                      </td>
                      <td className="text-center">{g.kartSayisi}</td>
                      <td className="text-center">{g.aktif ? <Badge bg="success">Aktif</Badge> : <Badge bg="secondary">Pasif</Badge>}</td>
                      <td className="text-center" onClick={(e) => e.stopPropagation()}>
                        {duzenlenen?.id === g.stokGrupId ? (
                          <div className="btn-group btn-group-sm">
                            <Button size="sm" variant="success" className="py-0 px-2" disabled={mesgul} onClick={kaydet} title="Kaydet"><IconCheck size={14} /></Button>
                            <Button size="sm" variant="outline-secondary" className="py-0 px-2" onClick={() => setDuzenlenen(null)} title="Vazgeç"><IconX size={14} /></Button>
                          </div>
                        ) : (
                          <div className="btn-group btn-group-sm">
                            <Button size="sm" variant="outline-secondary" className="py-0 px-2" disabled={!yonetebilir} title="Düzelt"
                              onClick={() => setDuzenlenen({ id: g.stokGrupId, ad: g.ad, aktif: g.aktif })}><IconEdit size={14} /></Button>
                            <Button size="sm" variant="outline-danger" className="py-0 px-2" disabled={!yonetebilir} title="Sil" onClick={() => sil(g)}><IconTrash size={14} /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <Card.Footer className="bg-light py-1 px-3 small text-muted">Toplam {gorunen.length} grup. Kartı olan grup silinemez; pasif yapılabilir. Satıra tıklayınca grubun ürünleri sağda listelenir.</Card.Footer>
          </Card>
        </Col>
        <Col lg={7}>
          <Card className="border shadow-xs">
            <Card.Header className="bg-light py-2 d-flex flex-wrap align-items-center gap-2">
              <span className="fw-bold">{seciliGrup ? `"${seciliGrup.ad}" grubunun ürünleri` : "Grup seçin"}</span>
              {seciliGrup && <Badge bg="secondary">{kartToplam} kart</Badge>}
              <InputGroup size="sm" className="ms-auto" style={{ maxWidth: 260 }}>
                <InputGroup.Text className="bg-white"><IconSearch size={14} /></InputGroup.Text>
                <Form.Control value={kartArama} disabled={!seciliGrup} placeholder="Grupta ara (kod / ad / barkod)" onChange={(e) => setKartArama(e.target.value)} />
              </InputGroup>
              <Button size="sm" variant="primary" disabled={!seciliGrup || !yonetebilir} onClick={() => setSecici(true)} title="Stok kartlarından seçip gruba ekle"><IconPlus size={15} className="me-1" />Ürün ekle</Button>
            </Card.Header>
            <div className="table-responsive" style={{ maxHeight: "calc(100vh - 340px)", minHeight: 240 }}>
              <Table hover striped bordered size="sm" className="align-middle mb-0 text-nowrap">
                <thead className="table-light sticky-top">
                  <tr className="small text-secondary"><th style={{ width: 40 }} className="text-center">#</th><th>Kod</th><th>Ürün Adı</th><th>Barkod</th><th className="text-end">Satış Fiyatı</th><th className="text-end">Stok</th><th style={{ width: 80 }} className="text-center">Durum</th><th style={{ width: 60 }}></th></tr>
                </thead>
                <tbody>
                  {!seciliGrup ? (
                    <tr><td colSpan={8} className="text-center py-5 text-muted">Soldan bir grup seçin.</td></tr>
                  ) : kartYukleniyor && !kartlar.length ? (
                    <tr><td colSpan={8} className="text-center py-5"><Spinner size="sm" className="me-2" />Yükleniyor...</td></tr>
                  ) : kartlar.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-5 text-muted">Bu grupta kart yok. "Ürün ekle" ile stok kartlarından seçin.</td></tr>
                  ) : kartlar.map((k, i) => (
                    <tr key={k.stokKartId}>
                      <td className="text-center text-muted small">{i + 1}</td>
                      <td className="fw-bold font-monospace text-primary">{k.kod}</td>
                      <td className="fw-semibold">{k.ad}</td>
                      <td className="font-monospace small">{k.barkodlar[0] || ""}{k.barkodlar.length > 1 && <Badge bg="light" text="dark" className="border ms-1">+{k.barkodlar.length - 1}</Badge>}</td>
                      <td className="text-end">{k.satisFiyati !== null ? `${para(k.satisFiyati)} ${k.paraKodu || "TL"}` : ""}</td>
                      <td className={`text-end fw-bold ${k.bakiye < 0 ? "text-danger" : ""}`}>{miktarYaz(k.bakiye)} {k.birim}</td>
                      <td className="text-center">{k.aktif ? <Badge bg="success">Aktif</Badge> : <Badge bg="secondary">Pasif</Badge>}</td>
                      <td className="text-center"><Button size="sm" variant="outline-danger" className="py-0 px-2" disabled={!yonetebilir} title="Gruptan çıkar" onClick={() => void kartCikar(k)}><IconX size={14} /></Button></td>
                    </tr>
                  ))}
                  {seciliGrup && kartlar.length < kartToplam && (
                    <tr><td colSpan={8} className="text-center py-2">
                      <Button size="sm" variant="outline-secondary" disabled={kartYukleniyor} onClick={() => void kartlariYukle(seciliGrup.stokGrupId, Math.floor(kartlar.length / SAYFA) + 1)}>
                        {kartYukleniyor && <Spinner size="sm" className="me-1" />}Devamını yükle ({kartToplam - kartlar.length} kart daha)
                      </Button>
                    </td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card>
        </Col>
      </Row>

      <StokKartSecici show={secici} onHide={() => setSecici(false)} onSelect={(k) => { setSecici(false); void kartEkle(k); }} />
    </div>
  );
};

export default UrunGruplariPage;

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Nav, Row, Table } from "react-bootstrap";
import { IconBarcode, IconListSearch, IconTrash, IconTrashX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { LookupModal } from "../../components/common/LookupModal";
import { useToast } from "../../context/ToastContext";
import { FireFisi, FireListesi, StokKart, TicariService, eksiStokUyarisiMi, miktarYaz, para } from "../../services/ticariService";
import { tartiBirimi, tartiMetniCoz } from "../../../Backend/src/services/ticari/ticariHesap";
import { StokKartSecici } from "./StokKartSecici";
import { stokBarkodCoz } from "./stokBarkod";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

/**
 * Ticari › Fire / Zayi Fişi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA12). Satır: ürün + miktar + neden (bozulma, kesim firesi, SKT …);
 * kaydedince stok düşer, satıra o anki birim maliyet yazılır (fire maliyeti). Kg / Gr üründe miktar "347gr" / "1,25" yazılabilir.
 * İkinci sekme: tarih / neden süzgeçli fire listesi ve neden dağılımı.
 */
type Satir = { anahtar: string; stokKartId: number; kod: string; ad: string; birim: string; miktar: string; neden: string; maliyet?: number };
let sayac = 0;
const anahtar = () => `f${++sayac}`;
const metin = (n: number) => String(Math.round(n * 10000) / 10000).replace(".", ",");
const yerelZaman = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const bugun = () => new Date().toLocaleDateString("en-CA");
/** Kg / Gr kartta "347gr", "1,25kg", "0,5"; öteki kartta sayı */
const miktarOku = (m: string, birim: string): number | null => {
  const tb = tartiBirimi(birim);
  if (tb) { const t = tartiMetniCoz(m, tb); return typeof t === "number" && t > 0 ? t : null; }
  const s = m.trim();
  if (!s) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const TicariFireFisiPage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const yetki = useTicariYetki();
  const location = useLocation();
  const navigate = useNavigate();
  const [sekme, setSekme] = useState<"fis" | "liste">("fis");
  const [nedenler, setNedenler] = useState<string[]>([]);
  const [fis, setFis] = useState<FireFisi | null>(null);
  const [tarih, setTarih] = useState(yerelZaman());
  const [aciklama, setAciklama] = useState("");
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [okut, setOkut] = useState("");
  const [isleniyor, setIsleniyor] = useState(false);
  const [secici, setSecici] = useState<{ acik: boolean; arama: string }>({ acik: false, arama: "" });
  const [kayitlar, setKayitlar] = useState<{ fireId: number; fireNo: string; tarih: string; kalem: number; maliyet: number }[] | null>(null);
  const [lBas, setLBas] = useState(bugun());
  const [lBit, setLBit] = useState(bugun());
  const [lNeden, setLNeden] = useState("");
  const [lVeri, setLVeri] = useState<FireListesi | null>(null);
  const okutRef = useRef<HTMLInputElement>(null);

  useEffect(() => { TicariService.fireNedenleri().then(setNedenler).catch(() => setNedenler([])); }, []);

  const ac = useCallback(async (id: number) => {
    try {
      const f = await TicariService.fire(id);
      setFis(f);
      setTarih(yerelZaman(new Date(f.tarih)));
      setAciklama(f.aciklama || "");
      setSatirlar(f.satirlar.map((x) => ({ anahtar: anahtar(), stokKartId: x.stokKartId, kod: x.kod, ad: x.ad, birim: x.birim, miktar: metin(x.miktar), neden: x.neden, maliyet: x.maliyet })));
    } catch (e: any) {
      showError(e?.message || "Fire fişi açılamadı.");
    }
  }, [showError]);

  useEffect(() => {
    const id = Number(new URLSearchParams(location.search).get("id"));
    if (id > 0) void ac(id);
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const yeni = () => { setFis(null); setAciklama(""); setSatirlar([]); setTarih(yerelZaman()); setOkut(""); navigate("/ticari/fire-fisi", { replace: true }); };

  const ekle = (k: StokKart, miktar: number) => {
    setSatirlar((p) => [...p, { anahtar: anahtar(), stokKartId: k.stokKartId, kod: k.kod, ad: k.ad, birim: k.birim, miktar: tartiBirimi(k.birim) && miktar === 1 ? "" : metin(miktar), neden: nedenler[0] || "Bozulma" }]);
  };

  const okutuldu = async () => {
    const d = okut.trim();
    if (!d) { setSecici({ acik: true, arama: "" }); return; }
    setOkut(""); // önce temizle: yanıt gelmeden yapılan ikinci okutma ilkinin sonuna eklenmesin
    const r = await stokBarkodCoz(d);
    if (!r) { setSecici({ acik: true, arama: d }); return; }
    if ("hata" in r) { showError(r.hata); return; }
    ekle(r.kart, r.miktar);
    if (r.bilgi) showWarning(`${r.kart.ad}: ${r.bilgi}`, 2500);
    setOkut("");
  };

  const toplam = useMemo(() => satirlar.reduce((a, x) => a + (x.maliyet || 0), 0), [satirlar]);

  const kaydet = async (onay = false) => {
    if (!yetki.yonetebilir) { showError(YETKI_YOK_MESAJI); return; }
    if (!satirlar.length) { showWarning("Fişe en az bir ürün ekleyin."); return; }
    const okunan = satirlar.map((x) => ({ x, m: miktarOku(x.miktar, x.birim) }));
    const bozuk = okunan.find((o) => o.m === null);
    if (bozuk) { showWarning(`${bozuk.x.ad}: miktar okunamadı (${bozuk.x.birim}).`); return; }
    setIsleniyor(true);
    let tekrar = false;
    try {
      const r = await TicariService.fireKaydet({ fireId: fis?.fireId ?? null, tarih: new Date(tarih).toISOString(), aciklama: aciklama || null,
        satirlar: okunan.map((o) => ({ stokKartId: o.x.stokKartId, miktar: o.m!, neden: o.x.neden })), eksiStokOnay: onay });
      if (r.uyari) showWarning(r.uyari);
      showSuccess(`${r.fis.fireNo} kaydedildi; stok düştü, fire maliyeti ${para(r.fis.toplamMaliyet)} TL.`);
      navigate(`/ticari/fire-fisi?id=${r.fis.fireId}`, { replace: true });
      await ac(r.fis.fireId);
    } catch (e: any) {
      if (eksiStokUyarisiMi(e)) tekrar = window.confirm(e.message);
      else showError(e?.message || "Fire fişi kaydedilemedi.");
    } finally {
      setIsleniyor(false);
    }
    if (tekrar) await kaydet(true);
  };

  const sil = async () => {
    if (!fis || !window.confirm(`${fis.fireNo} silinsin mi? Düşülen stok geri gelir.`)) return;
    try {
      await TicariService.fireSil(fis.fireId);
      showSuccess("Fire fişi silindi.");
      yeni();
    } catch (e: any) {
      showError(e?.message || "Silinemedi.");
    }
  };

  const kayitlariAc = async () => {
    try {
      const l = await TicariService.fireListe({});
      const m = new Map<number, { fireId: number; fireNo: string; tarih: string; kalem: number; maliyet: number }>();
      for (const s of l.satirlar) {
        const x = m.get(s.fireId) || { fireId: s.fireId, fireNo: s.fireNo, tarih: s.tarih, kalem: 0, maliyet: 0 };
        x.kalem += 1; x.maliyet = Math.round((x.maliyet + s.maliyet) * 100) / 100; m.set(s.fireId, x);
      }
      setKayitlar([...m.values()]);
    } catch (e: any) { showError(e?.message || "Liste alınamadı."); }
  };
  const listele = async () => {
    try { setLVeri(await TicariService.fireListe({ baslangic: lBas, bitis: lBit, neden: lNeden || undefined })); } catch (e: any) { showError(e?.message || "Liste alınamadı."); }
  };
  useEffect(() => { if (sekme === "liste") void listele(); }, [sekme]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="U- Fire / Zayi Fişi" pageIcon={<IconTrashX size={20} />} onNew={yeni} onSave={() => void kaydet()} onDelete={fis ? sil : undefined}
        hideDelete={!fis} hidePrint hideSearch hideNavigation disabled={isleniyor} />
      {!yetki.yukleniyor && !yetki.yonetebilir && <Alert variant="warning" className="py-2">{YETKI_YOK_MESAJI}</Alert>}
      <Nav variant="pills" className="mb-2 gap-1" activeKey={sekme} onSelect={(k) => setSekme((k as any) || "fis")}>
        <Nav.Item><Nav.Link eventKey="fis">Fire fişi</Nav.Link></Nav.Item>
        <Nav.Item><Nav.Link eventKey="liste">Fire listesi</Nav.Link></Nav.Item>
      </Nav>
      {sekme === "fis" ? (
        <>
          <Card className="border shadow-xs mb-3">
            <Card.Body className="py-2">
              <Row className="g-2 align-items-end">
                <Col xs={6} md={2}><Form.Label className="small mb-1">Fire no</Form.Label><Form.Control size="sm" readOnly value={fis?.fireNo || "(yeni)"} /></Col>
                <Col xs={6} md={2}><Form.Label className="small mb-1">Tarih</Form.Label><Form.Control size="sm" type="datetime-local" aria-label="Tarih" value={tarih} onChange={(e) => setTarih(e.target.value)} /></Col>
                <Col xs={12} md={5}><Form.Label className="small mb-1">Açıklama</Form.Label><Form.Control size="sm" aria-label="Açıklama" value={aciklama} onChange={(e) => setAciklama(e.target.value)} /></Col>
                <Col xs={12} md={3} className="text-md-end"><Button size="sm" variant="outline-secondary" onClick={kayitlariAc}><IconListSearch size={15} className="me-1" />Kayıtlı fireler</Button></Col>
              </Row>
            </Card.Body>
          </Card>
          <Card className="border shadow-xs">
            <Card.Header className="py-2">
              <InputGroup size="sm" style={{ maxWidth: 380 }}>
                <InputGroup.Text><IconBarcode size={16} /></InputGroup.Text>
                <Form.Control ref={okutRef} aria-label="Barkod okut" placeholder="Barkod / kod okutun ya da Enter ile arayın" value={okut} autoFocus
                  onChange={(e) => setOkut(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void okutuldu(); } }} />
              </InputGroup>
            </Card.Header>
            <Table size="sm" className="mb-0 small align-middle">
              <thead><tr><th>Kod</th><th>Ürün</th><th style={{ width: 150 }}>Miktar</th><th style={{ width: 220 }}>Neden</th><th className="text-end">Maliyet</th><th /></tr></thead>
              <tbody>
                {satirlar.map((x) => (
                  <tr key={x.anahtar}>
                    <td className="text-muted">{x.kod}</td><td>{x.ad}</td>
                    <td><InputGroup size="sm"><Form.Control aria-label={`${x.ad} miktar`} className="text-end" value={x.miktar} placeholder={tartiBirimi(x.birim) ? "347gr / 1,25" : ""}
                      onChange={(e) => { const v = e.target.value; setSatirlar((p) => p.map((y) => (y.anahtar === x.anahtar ? { ...y, miktar: v, maliyet: undefined } : y))); }} /><InputGroup.Text>{x.birim}</InputGroup.Text></InputGroup></td>
                    <td><Form.Select size="sm" aria-label={`${x.ad} neden`} value={x.neden} onChange={(e) => { const v = e.target.value; setSatirlar((p) => p.map((y) => (y.anahtar === x.anahtar ? { ...y, neden: v } : y))); }}>
                      {nedenler.map((n) => <option key={n}>{n}</option>)}</Form.Select></td>
                    <td className="text-end">{x.maliyet !== undefined ? para(x.maliyet) : <span className="text-muted">kayıtta</span>}</td>
                    <td className="text-end"><Button size="sm" variant="link" className="text-danger p-0" aria-label={`${x.ad} satırını sil`} onClick={() => setSatirlar((p) => p.filter((y) => y.anahtar !== x.anahtar))}><IconTrash size={16} /></Button></td>
                  </tr>
                ))}
                {!satirlar.length && <tr><td colSpan={6} className="text-center text-muted py-3">Ürün okutun ya da arayın.</td></tr>}
              </tbody>
              {fis && <tfoot><tr className="fw-bold"><td colSpan={4}>Fire maliyeti</td><td className="text-end">{para(toplam)} TL</td><td /></tr></tfoot>}
            </Table>
          </Card>
        </>
      ) : (
        <Card className="border shadow-xs">
          <Card.Header className="py-2 d-flex flex-wrap gap-2 align-items-end">
            <Form.Control type="date" size="sm" style={{ width: 150 }} aria-label="Başlangıç" value={lBas} onChange={(e) => setLBas(e.target.value)} />
            <Form.Control type="date" size="sm" style={{ width: 150 }} aria-label="Bitiş" value={lBit} onChange={(e) => setLBit(e.target.value)} />
            <Form.Select size="sm" style={{ width: 200 }} aria-label="Neden" value={lNeden} onChange={(e) => setLNeden(e.target.value)}>
              <option value="">Tüm nedenler</option>{nedenler.map((n) => <option key={n}>{n}</option>)}
            </Form.Select>
            <Button size="sm" variant="primary" onClick={listele}>Listele</Button>
            {lVeri && <span className="ms-auto small">Toplam fire maliyeti: <b>{para(lVeri.toplamMaliyet)} TL</b></span>}
          </Card.Header>
          {lVeri && lVeri.nedenler.length > 0 && (
            <div className="px-3 pt-2 d-flex flex-wrap gap-2">{lVeri.nedenler.map((n) => <Badge key={n.neden} bg="light" text="dark" className="border">{n.neden}: {para(n.maliyet)} TL</Badge>)}</div>
          )}
          <Table size="sm" hover className="mb-0 small mt-2">
            <thead><tr><th>Tarih</th><th>Fire no</th><th>Kod</th><th>Ürün</th><th className="text-end">Miktar</th><th>Neden</th><th className="text-end">Maliyet</th></tr></thead>
            <tbody>
              {(lVeri?.satirlar || []).map((x) => (
                <tr key={`${x.fireId}-${x.satirNo}`} role="button" onClick={() => { setSekme("fis"); navigate(`/ticari/fire-fisi?id=${x.fireId}`); }}>
                  <td>{new Date(x.tarih).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</td><td>{x.fireNo}</td><td className="text-muted">{x.kod}</td><td>{x.ad}</td>
                  <td className="text-end">{miktarYaz(x.miktar)} {x.birim}</td><td>{x.neden}</td><td className="text-end">{para(x.maliyet)}</td>
                </tr>
              ))}
              {lVeri && !lVeri.satirlar.length && <tr><td colSpan={7} className="text-center text-muted py-3">Bu aralıkta fire yok.</td></tr>}
            </tbody>
          </Table>
        </Card>
      )}
      <StokKartSecici show={secici.acik} aramaMetni={secici.arama} onHide={() => setSecici({ acik: false, arama: "" })}
        onSelect={(k) => { ekle(k, 1); setSecici({ acik: false, arama: "" }); setOkut(""); setTimeout(() => okutRef.current?.focus(), 50); }} />
      <LookupModal<{ fireId: number; fireNo: string; tarih: string; kalem: number; maliyet: number }> show={!!kayitlar} onHide={() => setKayitlar(null)} title="Kayıtlı fire fişleri" items={kayitlar || []}
        columns={[
          { header: "No", render: (x) => x.fireNo },
          { header: "Tarih", render: (x) => new Date(x.tarih).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) },
          { header: "Kalem", align: "right", render: (x) => x.kalem },
          { header: "Maliyet", align: "right", render: (x) => para(x.maliyet) },
        ]}
        filterFn={(x, t) => x.fireNo.toLocaleLowerCase("tr-TR").includes(t.toLocaleLowerCase("tr-TR"))}
        onSelect={(x) => { setKayitlar(null); navigate(`/ticari/fire-fisi?id=${x.fireId}`); }} />
    </div>
  );
};

export default TicariFireFisiPage;

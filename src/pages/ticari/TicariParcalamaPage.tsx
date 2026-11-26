import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Table } from "react-bootstrap";
import { IconArrowsSplit2, IconCalculator, IconDeviceFloppy, IconPlus, IconTemplate, IconTrash } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { ParcalamaFisi, ParcalamaListeSatiri, ParcalamaSablonu, StokKart, TicariService, eksiStokUyarisiMi, miktarYaz, para } from "../../services/ticariService";
import { maliyetDagit, parcalamaOzeti } from "../../../Backend/src/services/ticari/ticariHesap";
import { StokKartSecici } from "./StokKartSecici";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

/**
 * Ticari › Parçalama Fişi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA17 — kasap). Girdi ürün + miktar stoktan çıkar (o anki ortalama maliyetle);
 * çıktı parçaları + miktar + birim maliyet (elle) stoğa girer. "Maliyeti dağıt": girdi maliyeti şablondaki paylara (yoksa miktara) göre.
 * Fire = girdi − çıktılar (ağırlık birimlerinde kendiliğinden). Şablon: girdi + parça listesi, sonraki fişlerde seçilir.
 */
type Satir = { anahtar: string; stokKartId: number; kod: string; ad: string; birim: string; miktar: string; birimMaliyet: string; pay: number | null; verim: number | null };
type Girdi = { stokKartId: number; kod: string; ad: string; birim: string } | null;
let sayac = 0;
const anahtar = () => `p${++sayac}`;
const metin = (n: number | null | undefined, hane = 4) => (n === null || n === undefined ? "" : String(Math.round(n * 10 ** hane) / 10 ** hane).replace(".", ","));
const sayi = (v: string): number => { const t = String(v || "").trim(); if (!t) return NaN; return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t); };
const yerelZaman = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const TicariParcalamaPage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const yetki = useTicariYetki();
  const location = useLocation();
  const navigate = useNavigate();
  const [fis, setFis] = useState<ParcalamaFisi | null>(null);
  const [tarih, setTarih] = useState(yerelZaman());
  const [girdi, setGirdi] = useState<Girdi>(null);
  const [girdiMiktar, setGirdiMiktar] = useState("");
  const [girdiMaliyet, setGirdiMaliyet] = useState<{ birimMaliyet: number; bakiye: number } | null>(null);
  const [fireElle, setFireElle] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [sablonlar, setSablonlar] = useState<ParcalamaSablonu[]>([]);
  const [sablonId, setSablonId] = useState<number | null>(null);
  const [secici, setSecici] = useState<"girdi" | "cikti" | null>(null);
  const [isleniyor, setIsleniyor] = useState(false);
  const [son, setSon] = useState<ParcalamaListeSatiri[]>([]);

  const sablonYukle = useCallback(() => TicariService.parcalamaSablonlar().then(setSablonlar).catch(() => setSablonlar([])), []);
  const sonYukle = useCallback(() => TicariService.parcalamaListe({}).then((l) => setSon(l.slice(0, 12))).catch(() => setSon([])), []);
  useEffect(() => { void sablonYukle(); void sonYukle(); }, [sablonYukle, sonYukle]);

  // Girdi maliyeti: fiş tarihindeki ortalama (düzeltmede fişin kendi kaydı)
  useEffect(() => {
    if (!girdi) { setGirdiMaliyet(null); return; }
    if (fis && fis.girdi.stokKartId === girdi.stokKartId) { setGirdiMaliyet({ birimMaliyet: fis.girdi.birimMaliyet, bakiye: NaN }); return; }
    TicariService.parcalamaGirdiMaliyeti(girdi.stokKartId, new Date(tarih).toISOString()).then((m) => setGirdiMaliyet({ birimMaliyet: m.birimMaliyet, bakiye: m.bakiye })).catch(() => setGirdiMaliyet(null));
  }, [girdi, tarih, fis]);

  const ac = useCallback(async (id: number) => {
    try {
      const f = await TicariService.parcalama(id);
      setFis(f);
      setTarih(yerelZaman(new Date(f.tarih)));
      setGirdi({ stokKartId: f.girdi.stokKartId, kod: f.girdi.kod, ad: f.girdi.ad, birim: f.girdi.birim });
      setGirdiMiktar(metin(f.girdi.miktar));
      setFireElle(f.fireMiktar !== null && f.fireMiktar !== f.ozet.fireOnerisi ? metin(f.fireMiktar) : "");
      setAciklama(f.aciklama || "");
      setSablonId(f.sablonId);
      setSatirlar(f.satirlar.map((x) => ({ anahtar: anahtar(), stokKartId: x.stokKartId, kod: x.kod, ad: x.ad, birim: x.birim, miktar: metin(x.miktar), birimMaliyet: metin(x.birimMaliyet, 6), pay: null, verim: null })));
    } catch (e: any) { showError(e?.message || "Parçalama fişi açılamadı."); }
  }, [showError]);
  useEffect(() => { const id = Number(new URLSearchParams(location.search).get("id")); if (id > 0) void ac(id); }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const yeni = () => { setFis(null); setGirdi(null); setGirdiMiktar(""); setFireElle(""); setAciklama(""); setSatirlar([]); setSablonId(null); setTarih(yerelZaman()); navigate("/ticari/parcalama", { replace: true }); };

  const sablonSec = (id: number | null) => {
    setSablonId(id);
    const s = sablonlar.find((x) => x.sablonId === id);
    if (!s) return;
    setGirdi({ stokKartId: s.girdiKartId, kod: s.girdiKod, ad: s.girdiAd, birim: s.girdiBirim });
    const gm = sayi(girdiMiktar);
    setSatirlar(s.satirlar.map((x) => ({ anahtar: anahtar(), stokKartId: x.stokKartId, kod: x.kod, ad: x.ad, birim: x.birim,
      // Verim yazılıysa girdi miktarından öneri (kg → çıktının biriminde)
      miktar: x.verimYuzde && gm > 0 ? metin((gm * x.verimYuzde) / 100 * (x.birim.toLowerCase() === "gr" && s.girdiBirim.toLowerCase() === "kg" ? 1000 : 1)) : "",
      birimMaliyet: "", pay: x.maliyetPayi, verim: x.verimYuzde })));
  };

  const hesap = useMemo(() => {
    const gm = sayi(girdiMiktar);
    if (!girdi || !(gm > 0) || !girdiMaliyet) return null;
    const c = satirlar.map((s) => ({ miktar: sayi(s.miktar) || 0, birim: s.birim, birimMaliyet: sayi(s.birimMaliyet) || 0 }));
    return parcalamaOzeti({ miktar: gm, birim: girdi.birim, birimMaliyet: girdiMaliyet.birimMaliyet }, c);
  }, [girdi, girdiMiktar, girdiMaliyet, satirlar]);

  const dagit = () => {
    if (!hesap) { showWarning("Önce girdi ürünü ve miktarını yazın."); return; }
    const b = maliyetDagit(hesap.girdiMaliyet, satirlar.map((s) => ({ miktar: sayi(s.miktar) || 0, pay: s.pay })));
    setSatirlar((p) => p.map((s, i) => ({ ...s, birimMaliyet: metin(b[i], 6) })));
  };

  const kaydet = async (onay = false) => {
    if (!yetki.yonetebilir) { showError(YETKI_YOK_MESAJI); return; }
    if (!girdi) { showWarning("Parçalanacak ürünü seçin."); return; }
    if (!(sayi(girdiMiktar) > 0)) { showWarning("Girdi miktarını yazın."); return; }
    if (!satirlar.length) { showWarning("En az bir parça ekleyin."); return; }
    const bozuk = satirlar.find((s) => !(sayi(s.miktar) > 0) || !(sayi(s.birimMaliyet) >= 0));
    if (bozuk) { showWarning(`${bozuk.ad}: miktar ve birim maliyet yazılmalı ("Maliyeti dağıt" doldurur).`); return; }
    setIsleniyor(true);
    let tekrar = false;
    try {
      const r = await TicariService.parcalamaKaydet({ parcalamaId: fis?.parcalamaId ?? null, tarih: new Date(tarih).toISOString(), girdiKartId: girdi.stokKartId, girdiMiktar: sayi(girdiMiktar),
        fireMiktar: fireElle.trim() ? sayi(fireElle) : null, sablonId, aciklama: aciklama || null,
        satirlar: satirlar.map((s) => ({ stokKartId: s.stokKartId, miktar: sayi(s.miktar), birimMaliyet: sayi(s.birimMaliyet) })), eksiStokOnay: onay });
      if (r.uyari) showWarning(r.uyari, 6000);
      showSuccess(`${r.fis.parcalamaNo} kaydedildi: ${r.fis.girdi.ad} ${miktarYaz(r.fis.girdi.miktar)} ${r.fis.girdi.birim} → ${r.fis.satirlar.length} parça.`);
      navigate(`/ticari/parcalama?id=${r.fis.parcalamaId}`, { replace: true });
      await ac(r.fis.parcalamaId);
      void sonYukle();
    } catch (e: any) {
      if (eksiStokUyarisiMi(e)) tekrar = window.confirm(e.message);
      else showError(e?.message || "Parçalama fişi kaydedilemedi.");
    } finally { setIsleniyor(false); }
    if (tekrar) await kaydet(true);
  };

  const sil = async (onay = false) => {
    if (!fis) return;
    if (!onay && !window.confirm(`${fis.parcalamaNo} silinsin mi? Girdi stoğa geri döner, parçalar stoktan düşer.`)) return;
    try {
      await TicariService.parcalamaSil(fis.parcalamaId, onay);
      showSuccess("Parçalama fişi silindi."); yeni(); void sonYukle();
    } catch (e: any) {
      if (eksiStokUyarisiMi(e) && window.confirm(e.message)) await sil(true);
      else if (!eksiStokUyarisiMi(e)) showError(e?.message || "Silinemedi.");
    }
  };

  const sablonaKaydet = async () => {
    if (!girdi || !satirlar.length) { showWarning("Şablon için girdi ürünü ve en az bir parça gerekli."); return; }
    const ad = window.prompt("Şablon adı", sablonlar.find((x) => x.sablonId === sablonId)?.ad || girdi.ad);
    if (!ad) return;
    const gm = sayi(girdiMiktar), gcm = hesap?.ciktiMaliyet || 0;
    try {
      const var_ = sablonlar.find((x) => x.ad === ad.trim());
      // Verim % = parça ağırlığı / girdi; maliyet payı % = parça maliyeti / çıktı maliyeti (yuvarlama artığı en büyük paya)
      const paylar = satirlar.map((s) => (gcm > 0 ? Math.round(((sayi(s.miktar) * sayi(s.birimMaliyet)) / gcm) * 10000) / 100 : null));
      if (paylar.every((x) => x !== null)) { const fark = Math.round((100 - paylar.reduce((t, x) => t + (x || 0), 0)) * 100) / 100; const i = paylar.indexOf(Math.max(...(paylar as number[]))); paylar[i] = Math.round(((paylar[i] || 0) + fark) * 100) / 100; }
      const s = await TicariService.parcalamaSablonKaydet({ sablonId: var_?.sablonId ?? null, ad: ad.trim(), girdiKartId: girdi.stokKartId,
        satirlar: satirlar.map((x, i) => ({ stokKartId: x.stokKartId, verimYuzde: gm > 0 && x.birim.toLowerCase() === girdi.birim.toLowerCase() ? Math.round((sayi(x.miktar) / gm) * 10000) / 100 : x.verim, maliyetPayi: paylar[i] })) });
      showSuccess(`"${s.ad}" şablonu kaydedildi.`);
      await sablonYukle(); setSablonId(s.sablonId);
    } catch (e: any) { showError(e?.message || "Şablon kaydedilemedi."); }
  };

  const fire = fireElle.trim() ? sayi(fireElle) : hesap?.fireOnerisi ?? null;
  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="Z- Parçalama Fişi" pageIcon={<IconArrowsSplit2 size={20} />} onNew={yeni} onSave={() => void kaydet()} onDelete={fis ? () => void sil() : undefined}
        hideSearch hideNavigation disabled={isleniyor} />
      <Row className="g-3">
        <Col xl={9}>
          <Card className="border shadow-xs mb-3">
            <Card.Body className="py-2">
              <Row className="g-2 align-items-end">
                <Col md={2}><Form.Label className="small mb-1">Fiş no</Form.Label><Form.Control size="sm" readOnly value={fis?.parcalamaNo || "(yeni)"} /></Col>
                <Col md={3}><Form.Label className="small mb-1">Tarih</Form.Label><Form.Control size="sm" type="datetime-local" aria-label="Tarih" value={tarih} onChange={(e) => setTarih(e.target.value)} /></Col>
                <Col md={3}>
                  <Form.Label className="small mb-1">Şablon</Form.Label>
                  <Form.Select size="sm" aria-label="Şablon" value={sablonId ?? ""} onChange={(e) => sablonSec(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Şablonsuz</option>
                    {sablonlar.map((s) => <option key={s.sablonId} value={s.sablonId}>{s.ad} ({s.satirlar.length} parça)</option>)}
                  </Form.Select>
                </Col>
                <Col md={4}><Form.Label className="small mb-1">Açıklama</Form.Label><Form.Control size="sm" maxLength={250} value={aciklama} onChange={(e) => setAciklama(e.target.value)} /></Col>
              </Row>
            </Card.Body>
          </Card>
          <Card className="border shadow-xs mb-3">
            <Card.Header className="py-2 fw-semibold small">Parçalanan (girdi)</Card.Header>
            <Card.Body className="py-2">
              <Row className="g-2 align-items-end">
                <Col md={5}>
                  <Form.Label className="small mb-1">Ürün</Form.Label>
                  <InputGroup size="sm">
                    <Form.Control readOnly aria-label="Girdi ürünü" value={girdi ? `${girdi.kod} ${girdi.ad}` : ""} placeholder="Karkas / bütün ürün seçin" onClick={() => setSecici("girdi")} />
                    <Button variant="outline-primary" onClick={() => setSecici("girdi")}>Seç</Button>
                  </InputGroup>
                </Col>
                <Col md={2}>
                  <Form.Label className="small mb-1">Miktar ({girdi?.birim || "—"})</Form.Label>
                  <Form.Control size="sm" className="text-end" inputMode="decimal" aria-label="Girdi miktarı" value={girdiMiktar} onChange={(e) => setGirdiMiktar(e.target.value.replace(/[^0-9.,]/g, ""))} />
                </Col>
                <Col md={5} className="small">
                  {girdiMaliyet && <div>Ortalama maliyet: <b>{para(girdiMaliyet.birimMaliyet, 4)} TL/{girdi?.birim}</b>{Number.isFinite(girdiMaliyet.bakiye) && <> · stok {miktarYaz(girdiMaliyet.bakiye)} {girdi?.birim}</>}</div>}
                  {hesap && <div>Girdi maliyeti: <b>{para(hesap.girdiMaliyet)} TL</b></div>}
                </Col>
              </Row>
            </Card.Body>
          </Card>
          <Card className="border shadow-xs mb-3">
            <Card.Header className="py-2 d-flex align-items-center gap-2">
              <span className="fw-semibold small me-auto">Parçalar (çıktı)</span>
              <Button size="sm" variant="outline-primary" onClick={() => setSecici("cikti")}><IconPlus size={14} className="me-1" />Parça ekle</Button>
              <Button size="sm" variant="outline-success" onClick={dagit} title="Girdi maliyetini şablondaki paylara (yoksa miktara) göre dağıtır"><IconCalculator size={14} className="me-1" />Maliyeti dağıt</Button>
              <Button size="sm" variant="outline-secondary" onClick={sablonaKaydet}><IconTemplate size={14} className="me-1" />Şablon olarak kaydet</Button>
            </Card.Header>
            <Table size="sm" className="mb-0 small align-middle" aria-label="Parçalar">
              <thead><tr><th>#</th><th>Parça</th><th style={{ width: 130 }} className="text-end">Miktar</th><th style={{ width: 150 }} className="text-end">Birim maliyet (TL)</th><th className="text-end">Tutar</th><th className="text-end">Pay</th><th style={{ width: 40 }} /></tr></thead>
              <tbody>
                {satirlar.map((s, i) => {
                  const tutar = (sayi(s.miktar) || 0) * (sayi(s.birimMaliyet) || 0);
                  return (
                    <tr key={s.anahtar}>
                      <td className="text-muted">{i + 1}</td>
                      <td><span className="fw-semibold">{s.ad}</span> <span className="text-muted">{s.kod}</span>{s.verim ? <Badge bg="light" text="dark" className="ms-1 border">verim %{metin(s.verim, 2)}</Badge> : null}</td>
                      <td><InputGroup size="sm"><Form.Control className="text-end" inputMode="decimal" aria-label={`${s.ad} miktar`} value={s.miktar}
                        onChange={(e) => setSatirlar((p) => p.map((x) => (x.anahtar === s.anahtar ? { ...x, miktar: e.target.value.replace(/[^0-9.,]/g, "") } : x)))} /><InputGroup.Text>{s.birim}</InputGroup.Text></InputGroup></td>
                      <td><Form.Control size="sm" className="text-end" inputMode="decimal" aria-label={`${s.ad} birim maliyet`} value={s.birimMaliyet}
                        onChange={(e) => setSatirlar((p) => p.map((x) => (x.anahtar === s.anahtar ? { ...x, birimMaliyet: e.target.value.replace(/[^0-9.,]/g, "") } : x)))} /></td>
                      <td className="text-end">{para(tutar)}</td>
                      <td className="text-end text-muted">{s.pay !== null ? `%${metin(s.pay, 2)}` : hesap && hesap.ciktiMaliyet > 0 ? `%${metin((tutar / hesap.ciktiMaliyet) * 100, 1)}` : ""}</td>
                      <td><Button size="sm" variant="outline-danger" className="py-0 px-1" aria-label={`${s.ad} sil`} onClick={() => setSatirlar((p) => p.filter((x) => x.anahtar !== s.anahtar))}><IconTrash size={13} /></Button></td>
                    </tr>
                  );
                })}
                {!satirlar.length && <tr><td colSpan={7} className="text-center text-muted py-3">Şablon seçin ya da parça ekleyin.</td></tr>}
              </tbody>
            </Table>
          </Card>
          {hesap && (
            <Row className="g-2">
              <Col md={3}><Card className="border h-100"><Card.Body className="py-2"><div className="small text-muted">Girdi maliyeti</div><div className="fs-6 fw-bold">{para(hesap.girdiMaliyet)} TL</div></Card.Body></Card></Col>
              <Col md={3}><Card className="border h-100"><Card.Body className="py-2"><div className="small text-muted">Parçaların maliyeti</div><div className="fs-6 fw-bold">{para(hesap.ciktiMaliyet)} TL</div>
                <div className={`small ${Math.abs(hesap.fark) >= 0.01 ? "text-danger" : "text-success"}`}>fark {para(hesap.fark)} TL</div></Card.Body></Card></Col>
              <Col md={3}><Card className="border h-100"><Card.Body className="py-2"><div className="small text-muted">Fire ({girdi?.birim})</div>
                <Form.Control size="sm" className="text-end mt-1" inputMode="decimal" aria-label="Fire miktarı" placeholder={hesap.fireOnerisi !== null ? metin(hesap.fireOnerisi) : "—"} value={fireElle}
                  onChange={(e) => setFireElle(e.target.value.replace(/[^0-9.,]/g, ""))} /></Card.Body></Card></Col>
              <Col md={3}><Card className="border h-100"><Card.Body className="py-2"><div className="small text-muted">Verim</div><div className="fs-6 fw-bold">{hesap.verimYuzde !== null ? `%${metin(hesap.verimYuzde, 2)}` : "—"}</div>
                {fire !== null && <div className="small text-muted">fire {miktarYaz(fire)} {girdi?.birim}</div>}</Card.Body></Card></Col>
              {hesap.uyarilar.length > 0 && <Col xs={12}><Alert variant="warning" className="py-2 small mb-0">{hesap.uyarilar.join(" ")}</Alert></Col>}
            </Row>
          )}
          <div className="d-flex justify-content-end mt-3">
            <Button variant="success" disabled={isleniyor} onClick={() => void kaydet()}><IconDeviceFloppy size={16} className="me-1" />Kaydet</Button>
          </div>
        </Col>
        <Col xl={3}>
          <Card className="border shadow-xs">
            <Card.Header className="py-2 fw-semibold small">Son parçalamalar</Card.Header>
            <Table size="sm" hover className="mb-0 small" aria-label="Son parçalamalar">
              <tbody>
                {son.map((x) => (
                  <tr key={x.parcalamaId} role="button" onClick={() => navigate(`/ticari/parcalama?id=${x.parcalamaId}`)} className={fis?.parcalamaId === x.parcalamaId ? "fw-bold" : ""}>
                    <td><div>{x.parcalamaNo}</div><div className="text-muted" style={{ fontSize: 11 }}>{new Date(x.tarih).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</div></td>
                    <td><div>{x.girdiAd}</div><div className="text-muted" style={{ fontSize: 11 }}>{miktarYaz(x.girdiMiktar)} {x.girdiBirim} → {x.parcaSayisi} parça</div></td>
                    <td className="text-end">{para(x.ciktiMaliyet)}</td>
                  </tr>
                ))}
                {!son.length && <tr><td className="text-muted text-center py-3">Kayıt yok.</td></tr>}
              </tbody>
            </Table>
          </Card>
        </Col>
      </Row>
      <StokKartSecici show={secici !== null} onHide={() => setSecici(null)}
        onSelect={(k: StokKart) => {
          if (secici === "girdi") setGirdi({ stokKartId: k.stokKartId, kod: k.kod, ad: k.ad, birim: k.birim });
          else if (satirlar.some((x) => x.stokKartId === k.stokKartId)) showWarning(`${k.ad} zaten listede.`);
          else if (girdi && k.stokKartId === girdi.stokKartId) showWarning("Parçalanan ürün parça olamaz.");
          else setSatirlar((p) => [...p, { anahtar: anahtar(), stokKartId: k.stokKartId, kod: k.kod, ad: k.ad, birim: k.birim, miktar: "", birimMaliyet: "", pay: null, verim: null }]);
          setSecici(null);
        }} />
    </div>
  );
};

export default TicariParcalamaPage;

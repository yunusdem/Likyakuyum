import { paraOkuBos } from "../../utils/sayiGirisi";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, InputGroup, Row, Spinner, Table } from "react-bootstrap";
import { IconCashRegister, IconLock, IconLockOpen, IconPrinter, IconRefresh } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { useToast } from "../../context/ToastContext";
import { CashDeskService, VezneItem } from "../../services/cashDeskService";
import { CompanyService } from "../../services/companyService";
import { TicariService, VardiyaDurumu, VardiyaListeSatiri, VardiyaOzeti } from "../../services/ticariService";
import { TL_KUPURLERI, kupurToplami, vardiyaFarki } from "../../../Backend/src/services/ticari/ticariHesap";
import { farkYazisi, htmlYazdir, tl, vardiyaRaporHtml, zamanYaz } from "./ticariRaporCikti";

/**
 * Ticari › Vardiya — kasiyer kasa açılış / kapanış (docs/TICARI_ADISYON_YOL_HARITASI.md, TA8).
 * Vardiya kullanıcının veznesi içindir (sistem yöneticisi vezne seçebilir). Açılışta devir nakit, kapanışta sayılan nakit
 * (doğrudan ya da küpürle); beklenen = devir + nakit satış − nakit iade + diğer giriş − diğer çıkış. Kapanış raporu kayıtta saklanır.
 */
/** Para kutusu: "1.250" = 1250 (ekran tutarı böyle gösterir); boş ya da geçersiz yazım null */
const sayiOku = (v: string): number | null => { const n = paraOkuBos(v); return n === null || Number.isNaN(n) ? null : n; };
const bugun = () => new Date().toLocaleDateString("en-CA");
const gunOnce = (g: number) => new Date(Date.now() - g * 86_400_000).toLocaleDateString("en-CA");
const farkRengi = (durum: string | null) => (durum === "TAMAM" ? "success" : durum === "FAZLA" ? "warning" : durum === "EKSIK" ? "danger" : "secondary");

const RaporKarti: React.FC<{ o: VardiyaOzeti; onYazdir: () => void }> = ({ o, onYazdir }) => {
  const n = o.nakit;
  return (
    <Card className="border shadow-xs h-100" aria-label="Vardiya raporu">
      <Card.Header className="d-flex justify-content-between align-items-center py-2">
        <div>
          <strong>Vardiya raporu {o.vardiyaId ? `#${o.vardiyaId}` : ""}</strong>{" "}
          {o.kapanis ? <Badge bg="secondary">Kapandı</Badge> : <Badge bg="success">Açık · anlık</Badge>}
        </div>
        <Button size="sm" variant="outline-secondary" onClick={onYazdir}><IconPrinter size={16} className="me-1" />Yazdır (80 mm)</Button>
      </Card.Header>
      <Card.Body className="small">
        <div className="text-muted mb-2">
          {[o.vezne.kod, o.vezne.ad].filter(Boolean).join(" - ")} · Açılış {zamanYaz(o.acilis.zaman)} {o.acilis.kullanici}
          {o.kapanis && <> · Kapanış {zamanYaz(o.kapanis.zaman)} {o.kapanis.kullanici}</>}
        </div>
        <Row className="g-3">
          <Col md={6}>
            <h6 className="mb-1">Nakit (TL)</h6>
            <Table size="sm" className="mb-0">
              <tbody>
                <tr><td>Devir</td><td className="text-end">{tl(n.devir)}</td></tr>
                <tr><td>+ Nakit satış</td><td className="text-end">{tl(n.nakitSatis)}</td></tr>
                <tr><td>− Nakit iade</td><td className="text-end">{tl(n.nakitIade)}</td></tr>
                <tr><td>+ Diğer nakit giriş</td><td className="text-end">{tl(n.digerGiris)}</td></tr>
                <tr><td>− Diğer nakit çıkış</td><td className="text-end">{tl(n.digerCikis)}</td></tr>
                <tr className="fw-bold"><td>Beklenen</td><td className="text-end" data-test="beklenen">{tl(n.beklenen)}</td></tr>
                {n.sayilan !== null && (
                  <>
                    <tr><td>Sayılan</td><td className="text-end">{tl(n.sayilan)}</td></tr>
                    <tr className="fw-bold"><td>Fark</td><td className="text-end"><Badge bg={farkRengi(n.durum)}>{farkYazisi(n.fark, n.durum)}</Badge></td></tr>
                  </>
                )}
              </tbody>
            </Table>
          </Col>
          <Col md={6}>
            <h6 className="mb-1">Fişler</h6>
            <Table size="sm" className="mb-2">
              <tbody>
                <tr><td>Satış ({o.fisler.satisAdet} fiş)</td><td className="text-end">{tl(o.fisler.satisToplam)}</td></tr>
                <tr><td>İade ({o.fisler.iadeAdet} fiş)</td><td className="text-end">{tl(o.fisler.iadeToplam)}</td></tr>
                <tr className="fw-bold"><td>Net</td><td className="text-end">{tl(o.fisler.satisToplam - o.fisler.iadeToplam)}</td></tr>
              </tbody>
            </Table>
            {o.kupur && Object.keys(o.kupur).length > 0 && (
              <div className="text-muted">Sayım: {Object.entries(o.kupur).sort((a, b) => Number(b[0]) - Number(a[0])).map(([d, a]) => `${tl(Number(d))}×${a}`).join(", ")}</div>
            )}
          </Col>
        </Row>
        {o.odemeler.length > 0 && (
          <>
            <h6 className="mt-3 mb-1">Ödeme türleri (TL karşılığı)</h6>
            <Table size="sm" className="mb-0">
              <thead><tr><th>Tür</th><th className="text-end">Satış</th><th className="text-end">İade</th><th className="text-end">Net</th></tr></thead>
              <tbody>
                {o.odemeler.map((x) => (
                  <tr key={`${x.tur}|${x.paraKodu}`}><td>{x.tur}{x.paraKodu !== "TL" ? ` (${x.paraKodu})` : ""}</td><td className="text-end">{tl(x.satis)}</td><td className="text-end">{tl(x.iade)}</td><td className="text-end">{tl(x.net)}</td></tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
        {o.digerHareketler.length > 0 && (
          <>
            <h6 className="mt-3 mb-1">Diğer nakit hareketleri</h6>
            <Table size="sm" className="mb-0">
              <thead><tr><th>Saat</th><th>Tür</th><th>Açıklama</th><th className="text-end">Giriş</th><th className="text-end">Çıkış</th></tr></thead>
              <tbody>
                {o.digerHareketler.map((h, i) => (
                  <tr key={i}><td>{zamanYaz(h.zaman).slice(-5)}</td><td>{h.tur}</td><td>{[h.belgeNo, h.aciklama].filter(Boolean).join(" · ")}</td><td className="text-end">{h.giris ? tl(h.giris) : ""}</td><td className="text-end">{h.cikis ? tl(h.cikis) : ""}</td></tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
        {o.digerParalar.length > 0 && (
          <div className="text-muted mt-2">Döviz / diğer: {o.digerParalar.map((p) => `${p.paraKodu} +${tl(p.giris)} / −${tl(p.cikis)}`).join(" · ")} (TL beklenene girmez)</div>
        )}
        {(o.acilis.not || o.kapanis?.not) && (
          <div className="text-muted mt-2">{o.acilis.not && <>Açılış notu: {o.acilis.not}. </>}{o.kapanis?.not && <>Kapanış notu: {o.kapanis.not}.</>}</div>
        )}
      </Card.Body>
    </Card>
  );
};

export const TicariVardiyaPage: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [yonetici, setYonetici] = useState(false);
  const [vezneler, setVezneler] = useState<VezneItem[]>([]);
  const [vezneId, setVezneId] = useState<number | null>(null);
  const [durum, setDurum] = useState<VardiyaDurumu | null>(null);
  const [rapor, setRapor] = useState<VardiyaOzeti | null>(null);
  const [liste, setListe] = useState<VardiyaListeSatiri[]>([]);
  const [baslangic, setBaslangic] = useState(gunOnce(7));
  const [bitis, setBitis] = useState(bugun());
  const [devir, setDevir] = useState("");
  const [acilisNotu, setAcilisNotu] = useState("");
  const [kupurle, setKupurle] = useState(true);
  const [kupur, setKupur] = useState<Record<string, string>>({});
  const [sayilan, setSayilan] = useState("");
  const [kapanisNotu, setKapanisNotu] = useState("");
  const [yukleniyor, setYukleniyor] = useState(true);
  const [isleniyor, setIsleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [firmaAdi, setFirmaAdi] = useState("");

  useEffect(() => {
    TicariService.yetki().then((y) => {
      setYonetici(y.sistemYoneticisi);
      if (y.sistemYoneticisi) CashDeskService.getVezneler().then(setVezneler).catch(() => setVezneler([]));
    }).catch(() => setYonetici(false));
    CompanyService.getDefinitions().then((d) => setFirmaAdi(String(d?.FIRMA_ADI || "").trim())).catch(() => undefined);
  }, []);

  const listeYukle = useCallback(async (v: number | null) => {
    try {
      setListe(await TicariService.vardiyaListe({ vezneId: v, baslangic, bitis }));
    } catch (e: any) {
      setListe([]);
      showError(e?.message || "Vardiya listesi alınamadı.");
    }
  }, [baslangic, bitis, showError]);

  const yukle = useCallback(async (v: number | null = vezneId) => {
    setYukleniyor(true);
    setHata(null);
    try {
      const d = await TicariService.vardiyaDurum(v);
      setDurum(d);
      setRapor(d.acik);
      if (!d.acik) setDevir(tl(d.oneriDevir));
      await listeYukle(v ?? d.vezne.vezneId);
    } catch (e: any) {
      setDurum(null);
      setRapor(null);
      setHata(e?.message || "Vardiya durumu alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [vezneId, listeYukle]);

  useEffect(() => { yukle(vezneId); }, [vezneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const kupurTL = useMemo(() => kupurToplami(Object.fromEntries(Object.entries(kupur).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))]))), [kupur]);
  const sayilanTL = kupurle ? kupurTL : sayiOku(sayilan);
  const onizleme = durum?.acik && sayilanTL !== null ? vardiyaFarki(durum.acik.nakit.beklenen, sayilanTL) : null;

  const ac = async () => {
    const d = sayiOku(devir);
    if (d === null || d < 0) { showError("Devir nakdi 0 ya da pozitif bir tutar olmalı."); return; }
    setIsleniyor(true);
    try {
      await TicariService.vardiyaAc({ devir: d, not: acilisNotu || null, vezneId });
      showSuccess(`Vardiya açıldı (devir ${tl(d)} TL).`);
      setAcilisNotu("");
      setKupur({});
      setSayilan("");
      await yukle();
    } catch (e: any) {
      showError(e?.message || "Vardiya açılamadı.");
    } finally {
      setIsleniyor(false);
    }
  };

  const kapat = async () => {
    if (!durum?.acik) return;
    if (sayilanTL === null) { showError("Sayılan nakdi yazın ya da küpürleri sayın."); return; }
    const f = vardiyaFarki(durum.acik.nakit.beklenen, sayilanTL);
    if (!window.confirm(`Vardiya kapatılsın mı?\nBeklenen: ${tl(durum.acik.nakit.beklenen)} TL\nSayılan: ${tl(sayilanTL)} TL\nFark: ${farkYazisi(f.fark, f.durum)}`)) return;
    setIsleniyor(true);
    try {
      const kp = kupurle ? Object.fromEntries(Object.entries(kupur).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))]).filter(([, v]) => Number(v) > 0)) : null;
      const r = await TicariService.vardiyaKapat({ sayilan: kupurle ? null : sayilanTL, kupur: kp && Object.keys(kp).length ? kp : null, not: kapanisNotu || null, vezneId });
      showSuccess(`Vardiya kapandı: ${farkYazisi(r.nakit.fark, r.nakit.durum)}.`);
      setKapanisNotu("");
      setKupur({});
      setSayilan("");
      await yukle();
      setRapor(r);
    } catch (e: any) {
      showError(e?.message || "Vardiya kapatılamadı.");
    } finally {
      setIsleniyor(false);
    }
  };

  const raporAc = async (id: number) => {
    try {
      setRapor(await TicariService.vardiyaRapor(id));
    } catch (e: any) {
      showError(e?.message || "Vardiya raporu alınamadı.");
    }
  };

  const yazdir = () => {
    if (rapor && !htmlYazdir(vardiyaRaporHtml(rapor, firmaAdi, "80"))) showError("Yazdırma penceresi açılamadı (açılır pencere engelli olabilir).");
  };

  const acik = durum?.acik || null;
  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="R- Vardiya (Kasa Açılış / Kapanış)" pageIcon={<IconCashRegister size={20} />} hideNew hideSave hideDelete hideSearch hideNavigation
        onPrint={rapor ? yazdir : undefined} hidePrint={!rapor} disabled={isleniyor} />
      {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}

      <Row className="g-3">
        <Col xl={5}>
          <Card className="border shadow-xs">
            <Card.Header className="d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
              <div className="d-flex align-items-center gap-2">
                {acik ? <IconLockOpen size={18} className="text-success" /> : <IconLock size={18} className="text-secondary" />}
                <strong>{durum ? [durum.vezne.kod, durum.vezne.ad].filter(Boolean).join(" - ") : "Vezne"}</strong>
                {durum && (acik ? <Badge bg="success">Vardiya açık</Badge> : <Badge bg="secondary">Vardiya kapalı</Badge>)}
              </div>
              <div className="d-flex gap-2 align-items-center">
                {yonetici && vezneler.length > 0 && (
                  <Form.Select size="sm" style={{ width: 200 }} aria-label="Vezne" value={vezneId ?? ""} onChange={(e) => setVezneId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Kendi veznem</option>
                    {vezneler.map((v) => <option key={v.id} value={v.id}>{[v.kod, v.ad].filter(Boolean).join(" - ")}</option>)}
                  </Form.Select>
                )}
                <Button size="sm" variant="outline-secondary" onClick={() => yukle()} disabled={yukleniyor} aria-label="Yenile"><IconRefresh size={16} /></Button>
              </div>
            </Card.Header>
            <Card.Body>
              {yukleniyor && !durum ? (
                <div className="text-center py-4"><Spinner size="sm" /></div>
              ) : !durum ? null : !acik ? (
                <>
                  {durum.zorunlu && <Alert variant="warning" className="py-2 small">Bu firmada satış için açık vardiya gerekli (Stok Ayarları). Kasayı açmadan satış ve iade kaydedilmez.</Alert>}
                  <Form.Group className="mb-2">
                    <Form.Label className="small mb-1">Devir nakit (kasadaki TL)</Form.Label>
                    <InputGroup>
                      <Form.Control aria-label="Devir nakit" inputMode="decimal" value={devir} onChange={(e) => setDevir(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ac(); }} />
                      <InputGroup.Text>TL</InputGroup.Text>
                    </InputGroup>
                    <Form.Text>Önerilen: son kapanışta sayılan {tl(durum.oneriDevir)} TL.</Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label className="small mb-1">Not</Form.Label>
                    <Form.Control aria-label="Açılış notu" maxLength={250} value={acilisNotu} onChange={(e) => setAcilisNotu(e.target.value)} />
                  </Form.Group>
                  <Button variant="success" onClick={ac} disabled={isleniyor}><IconLockOpen size={16} className="me-1" />Vardiyayı aç</Button>
                </>
              ) : (
                <>
                  <div className="small text-muted mb-2">Açılış {zamanYaz(acik.acilis.zaman)} · {acik.acilis.kullanici || "—"} · devir {tl(acik.nakit.devir)} TL</div>
                  <div className="d-flex justify-content-between align-items-center border rounded p-2 mb-3 bg-body-tertiary">
                    <span>Beklenen nakit</span>
                    <strong className="fs-5" data-test="beklenen-ust">{tl(acik.nakit.beklenen)} TL</strong>
                  </div>
                  <Form.Check type="switch" id="kupurle" className="mb-2" label="Küpürle say" checked={kupurle} onChange={(e) => setKupurle(e.target.checked)} />
                  {kupurle ? (
                    <Table size="sm" className="mb-2 small align-middle">
                      <thead><tr><th>Küpür</th><th style={{ width: 110 }}>Adet</th><th className="text-end">Tutar</th></tr></thead>
                      <tbody>
                        {TL_KUPURLERI.map((d) => {
                          const a = Math.max(0, Math.floor(Number(kupur[String(d)]) || 0));
                          return (
                            <tr key={d}>
                              <td>{tl(d)} TL</td>
                              <td><Form.Control size="sm" aria-label={`${tl(d)} TL adet`} inputMode="numeric" value={kupur[String(d)] ?? ""}
                                onChange={(e) => setKupur((k) => ({ ...k, [String(d)]: e.target.value.replace(/\D/g, "") }))} /></td>
                              <td className="text-end">{a ? tl(Math.round(d * 100) * a / 100) : ""}</td>
                            </tr>
                          );
                        })}
                        <tr className="fw-bold"><td colSpan={2}>Sayılan</td><td className="text-end" data-test="kupur-toplam">{tl(kupurTL)}</td></tr>
                      </tbody>
                    </Table>
                  ) : (
                    <Form.Group className="mb-2">
                      <Form.Label className="small mb-1">Sayılan nakit</Form.Label>
                      <InputGroup>
                        <Form.Control aria-label="Sayılan nakit" inputMode="decimal" value={sayilan} onChange={(e) => setSayilan(e.target.value)} />
                        <InputGroup.Text>TL</InputGroup.Text>
                      </InputGroup>
                    </Form.Group>
                  )}
                  {onizleme && (
                    <div className="mb-2">Fark: <Badge bg={farkRengi(onizleme.durum)} data-test="fark-onizleme">{farkYazisi(onizleme.fark, onizleme.durum)}</Badge></div>
                  )}
                  <Form.Group className="mb-3">
                    <Form.Label className="small mb-1">Kapanış notu</Form.Label>
                    <Form.Control aria-label="Kapanış notu" maxLength={250} value={kapanisNotu} onChange={(e) => setKapanisNotu(e.target.value)} />
                  </Form.Group>
                  <Button variant="danger" onClick={kapat} disabled={isleniyor}><IconLock size={16} className="me-1" />Vardiyayı kapat</Button>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col xl={7}>
          {rapor ? <RaporKarti o={rapor} onYazdir={yazdir} /> : (
            <Card className="border shadow-xs h-100"><Card.Body className="text-muted small d-flex align-items-center justify-content-center">Açık vardiya yok. Geçmiş bir vardiyanın raporunu görmek için aşağıdaki listeden seçin.</Card.Body></Card>
          )}
        </Col>
      </Row>

      <Card className="border shadow-xs mt-3">
        <Card.Header className="d-flex flex-wrap align-items-center gap-2 py-2">
          <strong className="me-auto">Geçmiş vardiyalar</strong>
          <Form.Control type="date" size="sm" style={{ width: 150 }} aria-label="Başlangıç" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
          <Form.Control type="date" size="sm" style={{ width: 150 }} aria-label="Bitiş" value={bitis} onChange={(e) => setBitis(e.target.value)} />
          <Button size="sm" variant="outline-primary" onClick={() => listeYukle(vezneId ?? durum?.vezne.vezneId ?? null)}>Listele</Button>
        </Card.Header>
        <Card.Body className="p-0">
          <Table size="sm" hover responsive className="mb-0 small align-middle">
            <thead>
              <tr><th>#</th>{yonetici && <th>Vezne</th>}<th>Açılış</th><th>Açan</th><th>Kapanış</th><th>Kapatan</th><th className="text-end">Devir</th><th className="text-end">Beklenen</th><th className="text-end">Sayılan</th><th className="text-end">Fark</th></tr>
            </thead>
            <tbody>
              {liste.length === 0 && <tr><td colSpan={yonetici ? 10 : 9} className="text-center text-muted py-3">Bu aralıkta vardiya yok.</td></tr>}
              {liste.map((x) => {
                const durumu = x.fark === null ? null : Math.abs(x.fark) < 0.005 ? "TAMAM" : x.fark > 0 ? "FAZLA" : "EKSIK";
                return (
                  <tr key={x.vardiyaId} role="button" className={rapor?.vardiyaId === x.vardiyaId ? "table-active" : ""} onClick={() => raporAc(x.vardiyaId)}>
                    <td>{x.vardiyaId}</td>{yonetici && <td>{x.vezne}</td>}<td>{zamanYaz(x.acilis)}</td><td>{x.acan}</td>
                    <td>{x.kapanis ? zamanYaz(x.kapanis) : <Badge bg="success">Açık</Badge>}</td><td>{x.kapatan}</td>
                    <td className="text-end">{tl(x.devir)}</td><td className="text-end">{tl(x.beklenen)}</td><td className="text-end">{tl(x.sayilan)}</td>
                    <td className="text-end">{durumu && <Badge bg={farkRengi(durumu)}>{farkYazisi(x.fark, durumu)}</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default TicariVardiyaPage;

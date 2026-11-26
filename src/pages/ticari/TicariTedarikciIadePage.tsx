import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Button, ButtonGroup, Card, Col, Form, InputGroup, Row, Table } from "react-bootstrap";
import { IconBarcode, IconFileInvoice, IconListSearch, IconTrash, IconTruckReturn } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { LookupModal } from "../../components/common/LookupModal";
import { useToast } from "../../context/ToastContext";
import { CariKartItem, CariService } from "../../services/cariService";
import { ebelgeService } from "../../services/ebelgeService";
import { KDV_SECENEKLERI, StokGiris, StokKart, TedarikciIadeKaynagi, TedarikciIadeListeSatiri, TedarikciIadesi, TicariService, eksiStokUyarisiMi, miktarYaz, para } from "../../services/ticariService";
import { girisSatirHesapla, yuvarla2 } from "../../../Backend/src/services/ticari/ticariHesap";
import { StokKartSecici } from "./StokKartSecici";
import { stokBarkodCoz } from "./stokBarkod";
import { YETKI_YOK_MESAJI, useTicariYetki } from "./useTicariYetki";

/**
 * Ticari › Tedarikçiye İade (docs/TICARI_ADISYON_YOL_HARITASI.md, TA13). Giriş fişinden (satır başına kalan kadar, giriş fiyatıyla)
 * ya da serbest (tedarikçi + kartlar, son alış fiyatı). Kayıtla stok düşer, tedarikçiye borç yazılır. İade faturası e-Belge yerel
 * taslağı olarak açılır (fatura tipi IADE, iade edilen fatura giriş fişinin belge no / tarihi); gönderim e-Belge ekranından elle.
 * Adres: ?giris=<giriş fişi> o fişten başlar, ?id=<iade> kayıtlı iadeyi gösterir.
 */
type SerbestSatir = { anahtar: string; kart: StokKart; miktar: string; birimFiyat: string; kdvOrani: number };
let sayac = 0;
const sayi = (v: string): number => { const s = String(v ?? "").trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : NaN; };
const metin = (n: number) => String(Math.round(n * 10000) / 10000).replace(".", ",");
const yerelZaman = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export const TicariTedarikciIadePage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useToast();
  const yetki = useTicariYetki();
  const location = useLocation();
  const navigate = useNavigate();
  const [mod, setMod] = useState<"giris" | "serbest">("giris");
  const [kaynak, setKaynak] = useState<TedarikciIadeKaynagi | null>(null);
  const [iadeMiktar, setIadeMiktar] = useState<Record<number, string>>({});
  const [serbest, setSerbest] = useState<SerbestSatir[]>([]);
  const [cari, setCari] = useState<{ id: number; kod: string; ad: string } | null>(null);
  const [tarih, setTarih] = useState(yerelZaman());
  const [belgeNo, setBelgeNo] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [sonuc, setSonuc] = useState<TedarikciIadesi | null>(null);
  const [isleniyor, setIsleniyor] = useState(false);
  const [okut, setOkut] = useState("");
  const [secici, setSecici] = useState<{ acik: boolean; arama: string }>({ acik: false, arama: "" });
  const [girisler, setGirisler] = useState<StokGiris[] | null>(null);
  const [cariler, setCariler] = useState<CariKartItem[] | null>(null);
  const [cariSecici, setCariSecici] = useState(false);
  const [kayitlar, setKayitlar] = useState<TedarikciIadeListeSatiri[] | null>(null);
  const okutRef = useRef<HTMLInputElement>(null);

  const girisAc = async (id: number) => {
    try {
      const k = await TicariService.tedIadeKaynak(id);
      setKaynak(k); setIadeMiktar({}); setSonuc(null); setMod("giris");
      if (!k.fis.cariKartId) showWarning(`${k.fis.fisNo} giriş fişinde tedarikçi yok; serbest iade yapın.`);
    } catch (e: any) { showError(e?.message || "Giriş fişi açılamadı."); }
  };
  const iadeAc = async (id: number) => {
    try { setSonuc(await TicariService.tedIade(id)); } catch (e: any) { showError(e?.message || "İade açılamadı."); }
  };
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (Number(q.get("id")) > 0) void iadeAc(Number(q.get("id")));
    else if (Number(q.get("giris")) > 0) void girisAc(Number(q.get("giris")));
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  const yeni = () => { setKaynak(null); setIadeMiktar({}); setSerbest([]); setCari(null); setBelgeNo(""); setAciklama(""); setSonuc(null); setTarih(yerelZaman()); navigate("/ticari/tedarikci-iade", { replace: true }); };

  const girisSatirlari = useMemo(() => (kaynak?.satirlar || []).map((s) => {
    const m = sayi(iadeMiktar[s.satirNo] || "");
    const h = m > 0 ? girisSatirHesapla(m, s.birimFiyat, s.kdvOrani) : null;
    return { ...s, m, h, asiyor: m > s.kalan + 0.00005 };
  }), [kaynak, iadeMiktar]);
  const serbestSatirlari = useMemo(() => serbest.map((s) => {
    const m = sayi(s.miktar), f = sayi(s.birimFiyat);
    return { ...s, m, f, h: m > 0 && f >= 0 ? girisSatirHesapla(m, f, s.kdvOrani) : null };
  }), [serbest]);
  const toplam = useMemo(() => {
    const h = mod === "giris" ? girisSatirlari.map((x) => x.h) : serbestSatirlari.map((x) => x.h);
    const v = h.filter(Boolean) as { tutar: number; kdvTutari: number; toplamTutar: number }[];
    return { ara: yuvarla2(v.reduce((a, x) => a + x.tutar, 0)), kdv: yuvarla2(v.reduce((a, x) => a + x.kdvTutari, 0)), genel: yuvarla2(v.reduce((a, x) => a + x.toplamTutar, 0)) };
  }, [mod, girisSatirlari, serbestSatirlari]);

  const okutuldu = async () => {
    const d = okut.trim();
    if (!d) { setSecici({ acik: true, arama: "" }); return; }
    setOkut(""); // önce temizle: yanıt gelmeden yapılan ikinci okutma ilkinin sonuna eklenmesin
    const r = await stokBarkodCoz(d);
    if (!r) { setSecici({ acik: true, arama: d }); return; }
    if ("hata" in r) { showError(r.hata); return; }
    ekle(r.kart, r.miktar);
    setOkut("");
  };
  const ekle = (k: StokKart, m: number) => setSerbest((p) => [...p, { anahtar: `s${++sayac}`, kart: k, miktar: metin(m), birimFiyat: metin(k.sonAlisFiyati ?? k.alisFiyati ?? 0), kdvOrani: k.kdvOrani }]);

  const kaydet = async (onay = false) => {
    if (!yetki.yonetebilir) { showError(YETKI_YOK_MESAJI); return; }
    let satirlar: any[];
    if (mod === "giris") {
      if (!kaynak) { showWarning("Önce giriş fişini seçin."); return; }
      const as = girisSatirlari.find((x) => x.asiyor);
      if (as) { showWarning(`${as.ad}: iade edilebilecek kalan ${miktarYaz(as.kalan)} ${as.birim}.`); return; }
      satirlar = girisSatirlari.filter((x) => x.m > 0).map((x) => ({ girisSatirNo: x.satirNo, miktar: x.m }));
    } else {
      if (!cari) { showWarning("Tedarikçi cari seçin."); return; }
      const bozuk = serbestSatirlari.find((x) => !(x.m > 0) || !(x.f >= 0));
      if (bozuk) { showWarning(`${bozuk.kart.ad}: miktar / fiyat okunamadı.`); return; }
      satirlar = serbestSatirlari.map((x) => ({ stokKartId: x.kart.stokKartId, miktar: x.m, birimFiyat: x.f, kdvOrani: x.kdvOrani }));
    }
    if (!satirlar.length) { showWarning("İade miktarı girin."); return; }
    if (!onay && !window.confirm(`Tedarikçiye ${para(toplam.genel)} TL iade kesilsin mi? Stok düşer, tedarikçiye borç yazılır.`)) return;
    setIsleniyor(true);
    let tekrar = false;
    try {
      const r = await TicariService.tedIadeKaydet({ stokGirisId: mod === "giris" ? kaynak!.fis.stokGirisId : null, cariKartId: mod === "serbest" ? cari!.id : null,
        tarih: new Date(tarih).toISOString(), belgeNo: belgeNo || null, aciklama: aciklama || null, satirlar, eksiStokOnay: onay });
      if (r.uyari) showWarning(r.uyari);
      showSuccess(`${r.fis.iadeNo} kaydedildi: stok düştü, ${r.fis.cariAd} carisine ${para(r.fis.genelToplam)} TL borç yazıldı.`);
      setSonuc(r.fis);
      navigate(`/ticari/tedarikci-iade?id=${r.fis.iadeId}`, { replace: true });
    } catch (e: any) {
      if (eksiStokUyarisiMi(e)) tekrar = window.confirm(e.message);
      else showError(e?.message || "İade kaydedilemedi.");
    } finally { setIsleniyor(false); }
    if (tekrar) await kaydet(true);
  };

  const ebelgeTaslagi = async () => {
    if (!sonuc) return;
    try {
      const t = await TicariService.tedIadeEbelgeTaslagi(sonuc.iadeId);
      const { id } = await ebelgeService.yerelTaslakKaydet({ id: sonuc.ebelgeTaslakId ?? undefined, belgeTuru: t.icerik.senaryo === "EARSIVFATURA" ? "EArsiv" : "EFatura",
        aliciVkn: t.icerik.aliciVkn || null, aliciUnvan: t.icerik.aliciUnvan || null, tutar: t.genelToplam, paraBirimi: "TRY", icerik: t.icerik });
      await TicariService.tedIadeTaslakBagla(sonuc.iadeId, id);
      if (t.eksik.length) showWarning(`Taslakta tamamlanacak: ${t.eksik.join(", ")}.`, 6000);
      navigate(`/e-belge/dogrula?taslak=${id}`);
    } catch (e: any) { showError(e?.message || "e-Belge taslağı hazırlanamadı."); }
  };

  const sil = async () => {
    if (!sonuc || !window.confirm(`${sonuc.iadeNo} silinsin mi? Stok geri gelir, tedarikçi borcu silinir.`)) return;
    try { await TicariService.tedIadeSil(sonuc.iadeId); showSuccess("İade silindi."); yeni(); } catch (e: any) { showError(e?.message || "Silinemedi."); }
  };

  return (
    <div className="container-fluid py-3">
      <ERPToolbar pageTitle="V- Tedarikçiye İade" pageIcon={<IconTruckReturn size={20} />} onNew={yeni} onSave={sonuc ? undefined : () => void kaydet()} hideSave={!!sonuc}
        onDelete={sonuc ? sil : undefined} hideDelete={!sonuc} hidePrint hideSearch hideNavigation disabled={isleniyor} />
      {!yetki.yukleniyor && !yetki.yonetebilir && <Alert variant="warning" className="py-2">{YETKI_YOK_MESAJI}</Alert>}
      {sonuc ? (
        <Card className="border shadow-xs">
          <Card.Body>
            <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
              <div>
                <h5 className="mb-1">{sonuc.iadeNo} <Badge bg="secondary" className="ms-1">Tedarikçiye iade</Badge></h5>
                <div className="small text-muted">{new Date(sonuc.tarih).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })} · {sonuc.cariKod} {sonuc.cariAd}
                  {sonuc.girisNo && <> · giriş {sonuc.girisNo}{sonuc.girisBelgeNo ? ` (fatura ${sonuc.girisBelgeNo})` : ""}</>}</div>
              </div>
              <div className="d-flex gap-2 align-items-start">
                <Button size="sm" variant="primary" onClick={ebelgeTaslagi}><IconFileInvoice size={15} className="me-1" />{sonuc.ebelgeTaslakId ? "e-Belge iade taslağını aç" : "İade faturası taslağı (e-Belge)"}</Button>
                <Button size="sm" variant="outline-secondary" onClick={yeni}>Yeni iade</Button>
              </div>
            </div>
            <Table size="sm" className="small mb-2">
              <thead><tr><th>Kod</th><th>Ürün</th><th className="text-end">Miktar</th><th className="text-end">Birim fiyat</th><th className="text-end">KDV</th><th className="text-end">Tutar</th><th className="text-end">KDV dahil</th></tr></thead>
              <tbody>{sonuc.satirlar.map((s) => <tr key={s.satirNo}><td className="text-muted">{s.kod}</td><td>{s.ad}</td><td className="text-end">{miktarYaz(s.miktar)} {s.birim}</td><td className="text-end">{para(s.birimFiyat, 4)}</td><td className="text-end">%{s.kdvOrani}</td><td className="text-end">{para(s.tutar)}</td><td className="text-end">{para(s.toplamTutar)}</td></tr>)}</tbody>
              <tfoot><tr className="fw-bold"><td colSpan={5}>Toplam (KDV {para(sonuc.toplamKdv)})</td><td className="text-end">{para(sonuc.araToplam)}</td><td className="text-end">{para(sonuc.genelToplam)} TL</td></tr></tfoot>
            </Table>
            <div className="small text-muted">Stok düştü; tedarikçiye {para(sonuc.genelToplam)} TL borç yazıldı. İade faturası e-Belge ekranından elle gönderilir.</div>
          </Card.Body>
        </Card>
      ) : (
        <>
          <Card className="border shadow-xs mb-3">
            <Card.Body className="py-2">
              <Row className="g-2 align-items-end">
                <Col xs={12} md={3}>
                  <Form.Label className="small mb-1">İade türü</Form.Label>
                  <ButtonGroup size="sm" className="d-flex">
                    <Button variant={mod === "giris" ? "primary" : "outline-primary"} onClick={() => setMod("giris")}>Giriş fişinden</Button>
                    <Button variant={mod === "serbest" ? "primary" : "outline-primary"} onClick={() => setMod("serbest")}>Serbest</Button>
                  </ButtonGroup>
                </Col>
                {mod === "giris" ? (
                  <Col xs={12} md={3}><Form.Label className="small mb-1">Giriş fişi</Form.Label>
                    <InputGroup size="sm"><Form.Control readOnly value={kaynak ? `${kaynak.fis.fisNo} · ${kaynak.fis.cariAd}` : ""} placeholder="Seçin" />
                      <Button variant="outline-secondary" onClick={() => { setGirisler(null); TicariService.girisListe({ limit: 300 }).then(setGirisler).catch(() => setGirisler([])); }}><IconListSearch size={15} /></Button></InputGroup></Col>
                ) : (
                  <Col xs={12} md={3}><Form.Label className="small mb-1">Tedarikçi</Form.Label>
                    <InputGroup size="sm"><Form.Control readOnly value={cari ? `${cari.kod} ${cari.ad}` : ""} placeholder="Cari seçin" />
                      <Button variant="outline-secondary" onClick={() => { setCariSecici(true); if (!cariler) CariService.getCariKartlar().then(setCariler).catch(() => setCariler([])); }}>Seç</Button></InputGroup></Col>
                )}
                <Col xs={6} md={2}><Form.Label className="small mb-1">Tarih</Form.Label><Form.Control size="sm" type="datetime-local" aria-label="Tarih" value={tarih} onChange={(e) => setTarih(e.target.value)} /></Col>
                <Col xs={6} md={2}><Form.Label className="small mb-1">Belge no</Form.Label><Form.Control size="sm" aria-label="Belge no" value={belgeNo} onChange={(e) => setBelgeNo(e.target.value)} /></Col>
                <Col xs={12} md={2} className="text-md-end"><Button size="sm" variant="outline-secondary" onClick={() => TicariService.tedIadeListe({}).then(setKayitlar).catch((e) => showError(e?.message))}>Kayıtlı iadeler</Button></Col>
                <Col xs={12}><Form.Control size="sm" aria-label="Açıklama" placeholder="Açıklama (ör. kusurlu ürün)" value={aciklama} onChange={(e) => setAciklama(e.target.value)} /></Col>
              </Row>
            </Card.Body>
          </Card>
          <Card className="border shadow-xs">
            {mod === "serbest" && (
              <Card.Header className="py-2"><InputGroup size="sm" style={{ maxWidth: 380 }}><InputGroup.Text><IconBarcode size={16} /></InputGroup.Text>
                <Form.Control ref={okutRef} aria-label="Barkod okut" placeholder="Barkod / kod okutun ya da Enter ile arayın" value={okut} onChange={(e) => setOkut(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void okutuldu(); } }} /></InputGroup></Card.Header>
            )}
            <Table size="sm" className="small mb-0 align-middle">
              {mod === "giris" ? (
                <>
                  <thead><tr><th>Kod</th><th>Ürün</th><th className="text-end">Alınan</th><th className="text-end">İade edilen</th><th className="text-end">Kalan</th><th className="text-end">Birim fiyat</th><th style={{ width: 140 }} className="text-end">İade miktarı</th><th className="text-end">KDV dahil</th></tr></thead>
                  <tbody>
                    {girisSatirlari.map((s) => (
                      <tr key={s.satirNo} className={s.asiyor ? "table-danger" : ""}>
                        <td className="text-muted">{s.kod}</td><td>{s.ad}</td><td className="text-end">{miktarYaz(s.alinan)} {s.birim}</td><td className="text-end">{s.iadeEdilen ? miktarYaz(s.iadeEdilen) : ""}</td>
                        <td className="text-end fw-semibold">{miktarYaz(s.kalan)}</td><td className="text-end">{para(s.birimFiyat, 4)} <span className="text-muted">%{s.kdvOrani}</span></td>
                        <td><InputGroup size="sm"><Form.Control className="text-end" aria-label={`${s.ad} iade miktarı`} value={iadeMiktar[s.satirNo] || ""} disabled={!s.kalan}
                          onChange={(e) => setIadeMiktar((p) => ({ ...p, [s.satirNo]: e.target.value }))} /><Button variant="outline-secondary" disabled={!s.kalan} onClick={() => setIadeMiktar((p) => ({ ...p, [s.satirNo]: metin(s.kalan) }))}>Tümü</Button></InputGroup></td>
                        <td className="text-end">{s.h ? para(s.h.toplamTutar) : ""}</td>
                      </tr>
                    ))}
                    {!kaynak && <tr><td colSpan={8} className="text-center text-muted py-3">Giriş fişini seçin.</td></tr>}
                  </tbody>
                </>
              ) : (
                <>
                  <thead><tr><th>Kod</th><th>Ürün</th><th style={{ width: 140 }}>Miktar</th><th style={{ width: 140 }}>Birim fiyat (KDV hariç)</th><th style={{ width: 100 }}>KDV</th><th className="text-end">KDV dahil</th><th /></tr></thead>
                  <tbody>
                    {serbestSatirlari.map((s) => (
                      <tr key={s.anahtar}>
                        <td className="text-muted">{s.kart.kod}</td><td>{s.kart.ad}</td>
                        <td><InputGroup size="sm"><Form.Control className="text-end" aria-label={`${s.kart.ad} miktar`} value={s.miktar} onChange={(e) => { const v = e.target.value; setSerbest((p) => p.map((y) => (y.anahtar === s.anahtar ? { ...y, miktar: v } : y))); }} /><InputGroup.Text>{s.kart.birim}</InputGroup.Text></InputGroup></td>
                        <td><Form.Control size="sm" className="text-end" aria-label={`${s.kart.ad} fiyat`} value={s.birimFiyat} onChange={(e) => { const v = e.target.value; setSerbest((p) => p.map((y) => (y.anahtar === s.anahtar ? { ...y, birimFiyat: v } : y))); }} /></td>
                        <td><Form.Select size="sm" aria-label={`${s.kart.ad} KDV`} value={s.kdvOrani} onChange={(e) => { const v = Number(e.target.value); setSerbest((p) => p.map((y) => (y.anahtar === s.anahtar ? { ...y, kdvOrani: v } : y))); }}>{KDV_SECENEKLERI.map((k) => <option key={k} value={k}>%{k}</option>)}</Form.Select></td>
                        <td className="text-end">{s.h ? para(s.h.toplamTutar) : ""}</td>
                        <td className="text-end"><Button size="sm" variant="link" className="text-danger p-0" aria-label="Satırı sil" onClick={() => setSerbest((p) => p.filter((y) => y.anahtar !== s.anahtar))}><IconTrash size={16} /></Button></td>
                      </tr>
                    ))}
                    {!serbest.length && <tr><td colSpan={7} className="text-center text-muted py-3">Ürün okutun ya da arayın.</td></tr>}
                  </tbody>
                </>
              )}
              <tfoot><tr className="fw-bold"><td colSpan={mod === "giris" ? 7 : 5}>İade toplamı (KDV {para(toplam.kdv)})</td><td className="text-end">{para(toplam.genel)} TL</td>{mod === "serbest" && <td />}</tr></tfoot>
            </Table>
          </Card>
        </>
      )}
      <StokKartSecici show={secici.acik} aramaMetni={secici.arama} onHide={() => setSecici({ acik: false, arama: "" })}
        onSelect={(k) => { ekle(k, 1); setSecici({ acik: false, arama: "" }); setOkut(""); setTimeout(() => okutRef.current?.focus(), 50); }} />
      <LookupModal<StokGiris> show={girisler !== null} onHide={() => setGirisler(null)} title="Giriş fişi seç" items={girisler || []} isLoading={girisler === null}
        columns={[{ header: "No", render: (x) => x.fisNo, highlight: true }, { header: "Tarih", render: (x) => new Date(x.tarih).toLocaleDateString("tr-TR") },
          { header: "Tedarikçi", render: (x) => x.cariAd || <span className="text-muted">yok</span> }, { header: "Belge", render: (x) => x.belgeNo || "" }, { header: "Tutar", align: "right", render: (x) => para(x.genelToplam) }]}
        filterFn={(x, t) => `${x.fisNo} ${x.cariAd || ""} ${x.belgeNo || ""}`.toLocaleLowerCase("tr-TR").includes(t.toLocaleLowerCase("tr-TR"))}
        onSelect={(x) => { setGirisler(null); void girisAc(x.stokGirisId); }} />
      <LookupModal<CariKartItem> show={cariSecici} onHide={() => setCariSecici(false)} title="Tedarikçi seç" items={cariler || []} isLoading={!cariler}
        columns={[{ header: "Kod", width: "120px", render: (x) => x.kod, highlight: true }, { header: "Ad", render: (x) => x.ad }]}
        filterFn={(x, t) => `${x.kod} ${x.ad}`.toLocaleLowerCase("tr-TR").includes(t.toLocaleLowerCase("tr-TR"))}
        onSelect={(x) => { setCariSecici(false); setCari({ id: x.id, kod: x.kod, ad: x.ad }); }} />
      <LookupModal<TedarikciIadeListeSatiri> show={!!kayitlar} onHide={() => setKayitlar(null)} title="Kayıtlı tedarikçi iadeleri" items={kayitlar || []}
        columns={[{ header: "No", render: (x) => x.iadeNo }, { header: "Tarih", render: (x) => new Date(x.tarih).toLocaleDateString("tr-TR") }, { header: "Tedarikçi", render: (x) => x.cariAd },
          { header: "Giriş", render: (x) => x.girisNo || "serbest" }, { header: "Tutar", align: "right", render: (x) => para(x.genelToplam) }]}
        filterFn={(x, t) => `${x.iadeNo} ${x.cariAd} ${x.girisNo || ""}`.toLocaleLowerCase("tr-TR").includes(t.toLocaleLowerCase("tr-TR"))}
        onSelect={(x) => { setKayitlar(null); navigate(`/ticari/tedarikci-iade?id=${x.iadeId}`); }} />
    </div>
  );
};

export default TicariTedarikciIadePage;

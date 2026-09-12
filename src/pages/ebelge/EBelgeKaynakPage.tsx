import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Form, Modal, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import { EbelgeKaynakDetay, EbelgeKaynakHazir, EbelgeKaynakSatiri, ebelgeService, ebelgeTutar, ebelgeGidenDurumRozet } from "../../services/ebelgeService";
import { BelgeService } from "../../services/belgeService";
import './ebelgeKaynak.css';

const bugun = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const tarihYaz = (t: string) => t?.slice(0, 10).split('-').reverse().join('.');
type Kaynak = '' | 'FATURA' | 'IRSALIYE' | 'GIDER' | 'DOVIZ';

const key = (k: { evrakTuru: number; belgeId: number; belgeTuru: number; belgeNo?: string }) => `${k.evrakTuru}:${k.belgeId}:${k.belgeTuru}${k.evrakTuru === 99 && k.belgeNo ? ':' + k.belgeNo.trim() : ''}`;
const turAdi = (k: { kaynak?: string; belgeTuru: number }) =>
  k.kaynak === 'DOVIZ' ? 'e-Döviz'
    : ({ 0: 'Fatura', 1: 'Fatura', 2: 'e-İrsaliye', 3: 'e-Gider' }[k.belgeTuru] || `Tür ${k.belgeTuru}`);
export default function EBelgeKaynakPage() {
  const [kayitlar, setKayitlar] = useState<EbelgeKaynakSatiri[]>([]);
  const [sayfa, setSayfa] = useState(1); const [toplam, setToplam] = useState(0);
  const [arama, setArama] = useState(''); const [durum, setDurum] = useState('');
  const [kaynak, setKaynak] = useState<Kaynak>(''); const [ilk, setIlk] = useState(bugun); const [son, setSon] = useState(bugun);
  const [busy, setBusy] = useState(false); const [hata, setHata] = useState('');
  const [secili, setSecili] = useState<string[]>([]);
  const [hazirlar, setHazirlar] = useState<EbelgeKaynakHazir[]>([]);
  const [sonuclar, setSonuclar] = useState<Record<string, { no: string; durum: string; mesaj: string }>>({});
  const [onay, setOnay] = useState(false);
  const [detay, setDetay] = useState<EbelgeKaynakDetay | null>(null);
  const [pdf, setPdf] = useState<{ url: string; no: string } | null>(null);
  const requestId = useRef(0);
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);
  const yukle = async (p = 1) => {
    const id = ++requestId.current;
    setSecili([]); setHazirlar([]); setOnay(false);
    if (ilk && son && ilk > son) { setBusy(false); setHata('İlk tarih, son tarihten sonra olamaz.'); return; }
    setBusy(true); setHata(''); setSecili([]); setHazirlar([]); setOnay(false);
    try { const data = await ebelgeService.kaynakListe({ sayfa: p, arama: arama || undefined, durum: durum || undefined,
      kaynak: kaynak || undefined,
      baslangicTarihi: ilk || undefined, bitisTarihi: son || undefined });
      if (id === requestId.current) { setKayitlar(data.kayitlar); setToplam(data.toplam); setSayfa(p); }
    } catch (e: any) { if (id === requestId.current) { setKayitlar([]); setToplam(0); setHata(e.message || 'Kaynak belgeler alınamadı.'); } }
    finally { if (id === requestId.current) setBusy(false); }
  };
  useEffect(() => { void yukle(); }, [kaynak, durum, ilk, son]);
  const detayAc = async (k: EbelgeKaynakSatiri) => {
    setBusy(true); setHata('');
    try { setDetay(await ebelgeService.kaynakDetay(k)); }
    catch (e: any) { setHata(e.message || 'Fiş açılamadı.'); }
    finally { setBusy(false); }
  };
  const pdfAc = async (k: EbelgeKaynakSatiri) => {
    setBusy(true); setHata('');
    try {
      // e-Döviz fişi: Belge modülünün GİB düzenindeki PDF'i (ETTN'li ve gönderilmişse ICE resmî PDF'i). Bkz. docs/belgeverapor.md
      const url = k.kaynak === 'DOVIZ'
        ? (await BelgeService.pdfBlobUrl({ fisId: k.belgeId, belgeNo: k.belgeNo })).url
        : await ebelgeService.kaynakPdf(k);
      setPdf({ url, no: k.belgeNo });
    }
    catch (e: any) { setHata(e.message || 'PDF önizlemesi açılamadı.'); }
    finally { setBusy(false); }
  };
  const hazirla = async () => {
    setBusy(true); setHata(''); setHazirlar([]); setOnay(false); setSonuclar({});
    const hazir: EbelgeKaynakHazir[] = [];
    for (const k of kayitlar.filter(r => r.secilebilir && secili.includes(key(r)))) {
      setSonuclar(o => ({ ...o, [key(k)]: { no: k.belgeNo, durum: 'Hazırlanıyor', mesaj: 'Mükellefiyet ve belge doğrulanıyor…' } }));
      try { const cevap = await ebelgeService.kaynakHazirla(k); hazir.push(cevap);
        setSonuclar(o => ({ ...o, [key(k)]: { no: k.belgeNo, durum: 'Hazır', mesaj: `Test başarılı; henüz gönderilmedi. ${cevap.belgeTuruAdi} · ${ebelgeTutar(cevap.tutar,cevap.paraBirimi || 'TRY')}` } }));
      } catch (e: any) { setSonuclar(o => ({ ...o, [key(k)]: { no: k.belgeNo, durum: 'Hatalı', mesaj: e.message || 'Belge hazırlanamadı.' } })); }
    }
    setHazirlar(hazir); setBusy(false);
  };
  const gonder = async () => {
    setBusy(true); setOnay(false); const gonderilecek = [...hazirlar]; setHazirlar([]);
    for (const k of gonderilecek) {
      setSonuclar(o => ({ ...o, [key(k)]: { no: k.belgeNo, durum: 'Gönderiliyor', mesaj: '' } }));
      try { const cevap = await ebelgeService.kaynakGonder(k);
        setSonuclar(o => ({ ...o, [key(k)]: { no: k.belgeNo, durum: 'Gönderildi', mesaj: cevap.mesaj } }));
      } catch (e: any) { setSonuclar(o => ({ ...o, [key(k)]: { no: k.belgeNo, durum: 'Kontrol gerekli', mesaj: e.message || 'Gönderim sonucu alınamadı; giden kutusunu kontrol edin.' } })); }
    }
    await yukle(sayfa);
  };
  const secilebilir = kayitlar.filter(k => k.secilebilir);
  return <div className="container-fluid py-3 ebelge-kaynak">
    {hata && <Alert variant="danger">{hata}</Alert>}
    <Card className="mb-3"><Card.Body className="p-3"><Form onSubmit={e => { e.preventDefault(); void yukle(); }}><fieldset disabled={busy} className="kaynak-filtre">
      <Form.Group controlId="kaynak-arama"><Form.Label>Belge no / ünvan</Form.Label><Form.Control size="sm" value={arama} onChange={e => setArama(e.target.value)} /></Form.Group>
      <Form.Group controlId="kaynak-ilk"><Form.Label>İlk tarih</Form.Label><Form.Control size="sm" type="date" value={ilk} onChange={e => setIlk(e.target.value)} /></Form.Group>
      <Form.Group controlId="kaynak-son"><Form.Label>Son tarih</Form.Label><Form.Control size="sm" type="date" value={son} onChange={e => setSon(e.target.value)} /></Form.Group>
      <Form.Group controlId="kaynak-tur"><Form.Label>Kaynak</Form.Label><Form.Select size="sm" value={kaynak} onChange={e => setKaynak(e.target.value as Kaynak)}><option value="">Tümü</option><option value="FATURA">Fatura</option><option value="IRSALIYE">e-İrsaliye</option><option value="GIDER">e-Gider pusulası</option><option value="DOVIZ">e-Döviz fişi</option></Form.Select></Form.Group>
      <Form.Group controlId="kaynak-durum"><Form.Label>Durum</Form.Label><Form.Select size="sm" value={durum} onChange={e => setDurum(e.target.value)}><option value="">Tümü</option><option value="GONDERILMEDI">Gönderilmedi</option><option value="GONDERILDI">Gönderildi</option><option value="HATA">Hatalı</option><option value="GONDERILIYOR">Gönderiliyor</option><option value="KONTROL_GEREKLI">Kontrol gerekli</option><option value="BELIRSIZ">Sonuç belirsiz</option></Form.Select></Form.Group>
      <Button size="sm" type="submit">{busy ? 'Bekleyin…' : 'Listele'}</Button><Link className="text-nowrap pb-1" to="/e-belge/giden">Giden Kutusu</Link>
    </fieldset></Form></Card.Body></Card>
    <Card><Card.Body>
      <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
        <Button size="sm" disabled={busy || !secilebilir.length} onClick={() => { setSecili(secilebilir.every(k => secili.includes(key(k))) ? [] : secilebilir.map(key)); setHazirlar([]); setOnay(false); }}>Tümünü seç / kaldır</Button>
        <Button size="sm" disabled={busy || !secili.length} onClick={hazirla}>Test et / hazırla</Button>
        <Button size="sm" disabled={busy || !hazirlar.length} onClick={() => setOnay(true)}>Hazır belgeleri gönder</Button>
        <span className="small">{secili.length} seçili · {hazirlar.length} hazır</span>
      </div>
      {onay && <Alert variant="warning">Aşağıdaki {hazirlar.length} belge ICE üzerinden gönderilecek:
        <ul>{hazirlar.map(h => <li key={key(h)}>{h.belgeNo} · {h.unvan} · {h.belgeTuruAdi} · {ebelgeTutar(h.tutar,h.paraBirimi || 'TRY')}</li>)}</ul>
        <Button size="sm" onClick={gonder}>Gönderimi onayla</Button><Button size="sm" className="ms-2" variant="secondary" onClick={() => setOnay(false)}>Vazgeç</Button>
      </Alert>}
      <Table responsive size="sm" hover className="kaynak-tablo"><thead><tr><th>Seç</th><th>Belge no</th><th>Tarih</th><th>Ünvan</th><th>Tutar</th><th>Tür</th><th>Durum / hata açıklaması</th></tr></thead>
        <tbody>{kayitlar.map(k => { const rozet=ebelgeGidenDurumRozet(k.durum); return <tr key={key(k)}>
          <td title={k.engel || undefined}><Form.Check aria-label={`${k.belgeNo} seç`} disabled={busy || !k.secilebilir} checked={secili.includes(key(k))} onChange={e => {
            setSecili(o => e.target.checked ? [...o,key(k)] : o.filter(id => id!==key(k))); setHazirlar([]); setOnay(false);
          }} /></td><td>{k.kaynak === 'DOVIZ' ? <Link to={`/vezne/doviz-fisi-duzeltme?id=${k.belgeId}`} title="Döviz fişini aç">{k.belgeNo}</Link> : <Button className="p-0 text-start" variant="link" disabled={busy} onClick={() => detayAc(k)}>{k.belgeNo}</Button>}</td><td><Button className="p-0 text-nowrap" variant="link" disabled={busy} title="PDF önizlemesini aç" onClick={() => pdfAc(k)}>{tarihYaz(k.tarih)}</Button></td><td>{k.unvan}</td><td className="text-nowrap">{ebelgeTutar(k.tutar,k.paraBirimi)}</td><td>{turAdi(k)}</td>
          <td className="kaynak-aciklama"><Badge bg={rozet.bg} text={rozet.text}>{rozet.etiket}</Badge>{k.hata && <div className="mt-1">{k.hata}</div>}
            {k.engel && k.engel !== k.hata && <div className="mt-1">{k.engel}</div>}
            {Number(k.eskiDurum) !== 0 && <div>Kaynak durum kodu: {k.eskiDurum}</div>}
            {k.eskiEttn && <div className="mt-1">ETTN: <span className="kaynak-ettn">{k.eskiEttn}</span></div>}
            {sonuclar[key(k)] && <div className="mt-2" role="status"><strong>{sonuclar[key(k)].durum}:</strong> {sonuclar[key(k)].mesaj}</div>}</td>
        </tr>; })}{!kayitlar.length && <tr><td colSpan={7}>{busy ? 'Yükleniyor…' : 'Seçilen tarih ve filtrelerde kayıt bulunamadı.'}</td></tr>}</tbody>
      </Table>
      <div className="d-flex gap-2 align-items-center"><Button size="sm" disabled={busy || sayfa<=1} onClick={() => yukle(sayfa-1)}>Önceki</Button><span>{toplam} kayıt · Sayfa {sayfa}</span><Button size="sm" disabled={busy || sayfa*50>=toplam} onClick={() => yukle(sayfa+1)}>Sonraki</Button></div>
    </Card.Body></Card>
    {!!Object.keys(sonuclar).length && <Card className="mt-3"><Card.Body><h6>İşlem sonuçları</h6><Table responsive size="sm"><thead><tr><th>Belge no</th><th>Sonuç</th><th>Açıklama</th></tr></thead><tbody>{Object.entries(sonuclar).map(([id,s]) => <tr key={id}><td>{s.no}</td><td>{s.durum}</td><td className="kaynak-aciklama">{s.mesaj}</td></tr>)}</tbody></Table></Card.Body></Card>}
    <Modal show={!!pdf} onHide={() => setPdf(null)} size="xl"><Modal.Header closeButton><Modal.Title>{pdf?.no} — PDF önizleme</Modal.Title></Modal.Header><Modal.Body className="p-0">{pdf && <iframe title="Belge PDF önizlemesi" src={pdf.url} style={{ width: '100%', height: '75vh', border: 0 }} />}</Modal.Body><Modal.Footer>{pdf && <a className="btn btn-primary btn-sm" href={pdf.url} download={`${pdf.no}.pdf`}>PDF indir</a>}</Modal.Footer></Modal>
    <Modal show={!!detay} onHide={() => setDetay(null)} size="lg"><Modal.Header closeButton><Modal.Title>{detay?.belgeNo} — Fiş detayı</Modal.Title></Modal.Header><Modal.Body>{detay && <><p>{detay.unvan} · {tarihYaz(detay.tarih)} · {detay.tur}</p><Table responsive><thead><tr><th>Açıklama</th><th>Miktar</th><th>Tutar</th><th>KDV</th></tr></thead><tbody>{detay.satirlar.map((s, i) => <tr key={i}><td>{s.ad}</td><td>{s.miktar}</td><td>{ebelgeTutar(s.tutar, detay.paraBirimi)}</td><td>{ebelgeTutar(s.kdv || 0, detay.paraBirimi)}</td></tr>)}</tbody></Table><strong>Toplam: {ebelgeTutar(detay.tutar, detay.paraBirimi)}</strong></>}</Modal.Body></Modal>
  </div>;
}

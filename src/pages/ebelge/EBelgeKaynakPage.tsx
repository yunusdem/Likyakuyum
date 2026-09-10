import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import { EbelgeKaynakHazir, EbelgeKaynakSatiri, ebelgeService, ebelgeTutar, ebelgeGidenDurumRozet } from "../../services/ebelgeService";

const key = (k: { evrakTuru: number; belgeId: number; belgeTuru: number }) => `${k.evrakTuru}:${k.belgeId}:${k.belgeTuru}`;
const turAdi = (k: { kaynak?: string; belgeTuru: number }) =>
  k.kaynak === 'DOVIZ' ? 'e-Döviz'
    : ({ 0: 'Fatura', 1: 'Fatura', 2: 'e-İrsaliye', 3: 'e-Gider' }[k.belgeTuru] || `Tür ${k.belgeTuru}`);
export default function EBelgeKaynakPage() {
  const [kayitlar, setKayitlar] = useState<EbelgeKaynakSatiri[]>([]);
  const [sayfa, setSayfa] = useState(1); const [toplam, setToplam] = useState(0);
  const [arama, setArama] = useState(''); const [durum, setDurum] = useState('');
  const [tur, setTur] = useState(''); const [kaynak, setKaynak] = useState(''); const [ilk, setIlk] = useState(''); const [son, setSon] = useState('');
  const [busy, setBusy] = useState(false); const [hata, setHata] = useState('');
  const [secili, setSecili] = useState<string[]>([]);
  const [hazirlar, setHazirlar] = useState<EbelgeKaynakHazir[]>([]);
  const [sonuclar, setSonuclar] = useState<Record<string, { no: string; durum: string; mesaj: string }>>({});
  const [onay, setOnay] = useState(false);
  const yukle = async (p = 1) => {
    setBusy(true); setHata(''); setSecili([]); setHazirlar([]); setOnay(false);
    try { const data = await ebelgeService.kaynakListe({ sayfa: p, arama: arama || undefined, durum: durum || undefined,
      belgeTuru: tur === '' ? undefined : Number(tur), kaynak: (kaynak || undefined) as 'FATURA' | 'DOVIZ' | undefined,
      baslangicTarihi: ilk || undefined, bitisTarihi: son || undefined });
      setKayitlar(data.kayitlar); setToplam(data.toplam); setSayfa(p);
    } catch (e: any) { setKayitlar([]); setToplam(0); setHata(e.message || 'Kaynak belgeler alınamadı.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void yukle(); }, []);
  const hazirla = async () => {
    setBusy(true); setHata(''); setHazirlar([]); setOnay(false); setSonuclar({});
    const hazir: EbelgeKaynakHazir[] = [];
    for (const k of kayitlar.filter(r => secili.includes(key(r)))) {
      setSonuclar(o => ({ ...o, [key(k)]: { no: k.belgeNo, durum: 'Hazırlanıyor', mesaj: 'Mükellefiyet ve belge doğrulanıyor…' } }));
      try { const cevap = await ebelgeService.kaynakHazirla(k); hazir.push(cevap);
        setSonuclar(o => ({ ...o, [key(k)]: { no: k.belgeNo, durum: 'Hazır', mesaj: `${cevap.belgeTuruAdi} · ${ebelgeTutar(cevap.tutar,'TRY')}` } }));
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
  // e-Döviz fişleri de gönderilebilir; fatura tarafında yalnızca 0/1 türleri desteklenir.
  const secilebilir = kayitlar.filter(k =>
    (k.kaynak === 'DOVIZ' || [0,1].includes(k.belgeTuru)) &&
    !k.uuid && ['GONDERILMEDI','HATA'].includes(k.durum) && !k.eskiEttn && !k.eskiDurum);
  return <div className="container-fluid py-3">
    <div className="d-flex justify-content-between mb-3"><h5>Kesilmiş Belgeler — ICE Gönderimi</h5><Link to="/e-belge/giden">Giden Kutusu</Link></div>
    {hata && <Alert variant="danger">{hata}</Alert>}
    <Card className="mb-3"><Card.Body><fieldset disabled={busy}><Row className="g-2">
      <Col md={4}><Form.Label>Belge no / ünvan</Form.Label><Form.Control size="sm" value={arama} onChange={e => setArama(e.target.value)} /></Col>
      <Col md={2}><Form.Label>İlk tarih</Form.Label><Form.Control size="sm" type="date" value={ilk} onChange={e => setIlk(e.target.value)} /></Col>
      <Col md={2}><Form.Label>Son tarih</Form.Label><Form.Control size="sm" type="date" value={son} onChange={e => setSon(e.target.value)} /></Col>
      <Col md={2}><Form.Label>Kaynak</Form.Label><Form.Select size="sm" value={kaynak} onChange={e => setKaynak(e.target.value)}><option value="">Tümü</option><option value="FATURA">Fatura / İrsaliye / Gider</option><option value="DOVIZ">e-Döviz fişi</option></Form.Select></Col>
      <Col md={2}><Form.Label>Belge türü</Form.Label><Form.Select size="sm" value={tur} onChange={e => setTur(e.target.value)}><option value="">Tümü</option><option value="0">Fatura (kaynak 0)</option><option value="1">Fatura (kaynak 1)</option><option value="2">e-İrsaliye</option><option value="3">e-Gider</option></Form.Select></Col>
      <Col md={2}><Form.Label>Durum</Form.Label><Form.Select size="sm" value={durum} onChange={e => setDurum(e.target.value)}><option value="">Tümü</option><option value="GONDERILMEDI">Gönderilmedi</option><option value="GONDERILDI">Gönderildi</option><option value="HATA">Hatalı</option><option value="GONDERILIYOR">Gönderiliyor</option><option value="KONTROL_GEREKLI">Kontrol gerekli</option><option value="BELIRSIZ">Sonuç belirsiz</option></Form.Select></Col>
    </Row><Button className="mt-2" size="sm" onClick={() => yukle(1)}>Listele</Button></fieldset></Card.Body></Card>
    <Card><Card.Body>
      <p className="small text-secondary">Mevcut sistemin e-Belge ve e-Döviz listelerinden okunur. Eski ETTN/durum kayıtları yeniden gönderimden önce kontrol gerektirir. Faturalarda e-Fatura/e-Arşiv türü mükellef sorgusuyla belirlenir; e-Döviz fişleri gönderim öncesi ICE önizlemesiyle doğrulanır. İptal edilmiş döviz fişleri listelenmez.</p>
      <div className="d-flex gap-2 align-items-center mb-2">
        <Button size="sm" disabled={busy || !secilebilir.length} onClick={() => { setSecili(secili.length ? [] : secilebilir.map(key)); setHazirlar([]); setOnay(false); }}>Gönderilebilirleri seç / kaldır</Button>
        <Button size="sm" disabled={busy || !secili.length} onClick={hazirla}>Seçilenleri hazırla</Button>
        <Button size="sm" disabled={busy || !hazirlar.length} onClick={() => setOnay(true)}>Hazır belgeleri gönder</Button>
        <span className="small">{secili.length} seçili · {hazirlar.length} hazır</span>
      </div>
      {onay && <Alert variant="warning">Aşağıdaki {hazirlar.length} belge ICE üzerinden gönderilecek:
        <ul>{hazirlar.map(h => <li key={key(h)}>{h.belgeNo} · {h.unvan} · {h.belgeTuruAdi} · {ebelgeTutar(h.tutar,'TRY')}</li>)}</ul>
        <Button size="sm" onClick={gonder}>Gönderimi onayla</Button><Button size="sm" className="ms-2" variant="secondary" onClick={() => setOnay(false)}>Vazgeç</Button>
      </Alert>}
      <Table responsive size="sm" hover><thead><tr><th>Seç</th><th>Belge no</th><th>Tarih</th><th>Ünvan</th><th>Tutar</th><th>Tür</th><th>Durum / hata açıklaması</th></tr></thead>
        <tbody>{kayitlar.map(k => { const rozet=ebelgeGidenDurumRozet(k.durum); return <tr key={key(k)}>
          <td><Form.Check aria-label={`${k.belgeNo} seç`} disabled={busy || !secilebilir.some(s => key(s)===key(k))} checked={secili.includes(key(k))} onChange={e => {
            setSecili(o => e.target.checked ? [...o,key(k)] : o.filter(id => id!==key(k))); setHazirlar([]); setOnay(false);
          }} /></td><td>{k.belgeNo}</td><td>{k.tarih?.slice(0,10)}</td><td>{k.unvan}</td><td>{ebelgeTutar(k.tutar,k.paraBirimi)}</td><td>{turAdi(k)}</td>
          <td><Badge bg={rozet.bg} text={rozet.text}>{rozet.etiket}</Badge><small className="d-block">{k.hata}</small>
            {(k.eskiEttn || k.eskiDurum !== 0) && <small className="d-block">Eski durum: {k.eskiDurum} · ETTN: {k.eskiEttn || '-'}</small>}</td>
        </tr>; })}{!kayitlar.length && <tr><td colSpan={7}>{busy ? 'Yükleniyor…' : 'Kayıt bulunamadı. Kaynak sistemdeki e-Belge başlangıç tarihi ve belge türü seçimleri listeyi belirler.'}</td></tr>}</tbody>
      </Table>
      <div className="d-flex gap-2 align-items-center"><Button size="sm" disabled={busy || sayfa<=1} onClick={() => yukle(sayfa-1)}>Önceki</Button><span>{toplam} kayıt · Sayfa {sayfa}</span><Button size="sm" disabled={busy || sayfa*50>=toplam} onClick={() => yukle(sayfa+1)}>Sonraki</Button></div>
    </Card.Body></Card>
    {!!Object.keys(sonuclar).length && <Card className="mt-3"><Card.Body><h6>Seçilen belgelerin işlem sonuçları</h6><Table size="sm"><thead><tr><th>Belge no</th><th>Sonuç</th><th>Açıklama</th></tr></thead><tbody>{Object.entries(sonuclar).map(([id,s]) => <tr key={id}><td>{s.no}</td><td>{s.durum}</td><td>{s.mesaj}</td></tr>)}</tbody></Table></Card.Body></Card>}
  </div>;
}

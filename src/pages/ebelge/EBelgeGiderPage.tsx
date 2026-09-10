import { useEffect, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import EBelgeCariSec from "./EBelgeCariSec";
import { EbelgeGiderIstegi, ebelgeService, ebelgeTutar } from "../../services/ebelgeService";

const bosSatir = () => ({ ad: "", miktar: 1, birimKodu: "C62", birimFiyat: 0, vergiOrani: 0 });
const bugun = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
export default function EBelgeGiderPage() {
  const [girdi, setGirdi] = useState<EbelgeGiderIstegi>({ belgeNo: "", tarih: bugun(), belgeTipi: "SATIS", paraBirimi: "TRY",
    alici: { vknTckn: "", ad: "", soyad: "", unvan: "", il: "", ilce: "" }, vergiTuruKodu: "", satirlar: [bosSatir()] });
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState("");
  const [onizleme, setOnizleme] = useState<Awaited<ReturnType<typeof ebelgeService.giderOnizle>> | null>(null);
  const [onay, setOnay] = useState(false);
  const [sonuc, setSonuc] = useState<Awaited<ReturnType<typeof ebelgeService.giderGonder>> | null>(null);
  const [gonderimDenendi, setGonderimDenendi] = useState(false);
  const [pdf, setPdf] = useState<string | null>(null);
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf); }, [pdf]);
  const degistir = (patch: Partial<EbelgeGiderIstegi>) => { setGirdi(o => ({ ...o, ...patch })); setOnizleme(null); setOnay(false); };
  const kontrol = async () => {
    setBusy(true); setHata(""); setOnizleme(null);
    try { setOnizleme(await ebelgeService.giderOnizle(girdi)); }
    catch (e: any) { setHata(e.message || "Kontrol başarısız."); } finally { setBusy(false); }
  };
  const gonder = async () => {
    setBusy(true); setHata(""); setOnay(false); setGonderimDenendi(true);
    try { setSonuc(await ebelgeService.giderGonder(girdi)); }
    catch (e: any) { setHata(`${e.message || "Gönderim tamamlanamadı."} Giden kutusunda belge numarasıyla sonucu kontrol edin.`); }
    finally { setBusy(false); }
  };
  return <div className="container-fluid py-3">
    <div className="d-flex justify-content-between mb-3"><h5>e-Gider Pusulası Oluştur</h5><Link to="/e-belge/giden">Giden Kutusu</Link></div>
    {hata && <Alert variant="danger">{hata}</Alert>}
    {sonuc && <Alert variant="success">{sonuc.belgeNo}: Gönderildi. {sonuc.mesaj}
      <Button size="sm" className="ms-2" onClick={async () => { try { setPdf(await ebelgeService.giderPdf(sonuc.uuid)); } catch (e: any) { setHata(e.message); } }}>PDF aç</Button></Alert>}
    {pdf && <iframe title="e-Gider PDF" src={pdf} width="100%" height="600" />}
    <fieldset disabled={busy || gonderimDenendi}>
      <Card className="mb-3"><Card.Body>
        <Row className="g-2 mb-3">
          <Col md={4}><Form.Label>Belge no</Form.Label><Form.Control value={girdi.belgeNo} maxLength={16} placeholder="GIP2026000000001" onChange={e => degistir({ belgeNo: e.target.value.toUpperCase() })} /></Col>
          <Col md={3}><Form.Label>Tarih</Form.Label><Form.Control type="date" value={girdi.tarih} onChange={e => degistir({ tarih: e.target.value })} /></Col>
          <Col md={3}><Form.Label>İşlem</Form.Label><Form.Select value={girdi.belgeTipi} onChange={e => degistir({ belgeTipi: e.target.value as "SATIS" | "IADE", iadeDayanak: e.target.value === "IADE" ? { belgeTipi: "BELGESIZ", belgeTarihi: bugun() } : undefined })}><option value="SATIS">Mal/hizmet alımı</option><option value="IADE">İade</option></Form.Select></Col>
          <Col md={2}><Form.Label>Vergi türü kodu</Form.Label><Form.Control value={girdi.vergiTuruKodu} maxLength={4} onChange={e => degistir({ vergiTuruKodu: e.target.value.replace(/\D/g, "") })} /></Col>
        </Row>
        <p className="small text-secondary">Malı satan / iadeyi yapan kişinin bilgileri. Vergi kodunu ve oranını işleminize göre giriniz.</p>
        <EBelgeCariSec onSelect={(c, l) => {
          const adlar = c.ad.trim().split(/\s+/); const soyad = adlar.length > 1 ? adlar.pop()! : "";
          degistir({ alici: { vknTckn: c.vergiKimlikNo?.trim() || "", unvan: c.ad, ad: adlar.join(" "), soyad,
            il: l.ilList.find(x => x.id === c.ilId)?.ad || "", ilce: l.ilceList.find(x => x.id === c.ilceId)?.ad || "" } });
        }} />
        <Row className="g-2">{([['vknTckn','TC / VKN'],['unvan','Ünvan'],['ad','Ad'],['soyad','Soyad'],['il','İl'],['ilce','İlçe']] as const).map(([key,label]) =>
          <Col md={4} key={key}><Form.Label>{label}</Form.Label><Form.Control value={girdi.alici[key] || ""} onChange={e => degistir({ alici: { ...girdi.alici, [key]: e.target.value } })} /></Col>)}</Row>
        {girdi.iadeDayanak && <Row className="g-2 mt-2">
          <Col md={4}><Form.Label>İade dayanağı</Form.Label><Form.Select value={girdi.iadeDayanak.belgeTipi} onChange={e => degistir({ iadeDayanak: { ...girdi.iadeDayanak!, belgeTipi: e.target.value as "BELGESIZ" | "EARSIV_FATURA" | "SATIS_FISI" } })}><option value="BELGESIZ">Belgesiz</option><option value="EARSIV_FATURA">e-Arşiv fatura</option><option value="SATIS_FISI">Satış fişi</option></Form.Select></Col>
          <Col md={4}><Form.Label>Dayanak no</Form.Label><Form.Control value={girdi.iadeDayanak.belgeNo || ""} onChange={e => degistir({ iadeDayanak: { ...girdi.iadeDayanak!, belgeNo: e.target.value } })} /></Col>
          <Col md={4}><Form.Label>Dayanak tarihi</Form.Label><Form.Control type="date" value={girdi.iadeDayanak.belgeTarihi} onChange={e => degistir({ iadeDayanak: { ...girdi.iadeDayanak!, belgeTarihi: e.target.value } })} /></Col>
        </Row>}
      </Card.Body></Card>
      <Card><Card.Body><Table responsive size="sm"><thead><tr><th>Mal / hizmet</th><th>Miktar</th><th>Birim</th><th>Birim fiyat (TRY)</th><th>Vergi %</th><th /></tr></thead>
        <tbody>{girdi.satirlar.map((s,i) => <tr key={i}>{(['ad','miktar','birimKodu','birimFiyat','vergiOrani'] as const).map(key => <td key={key}><Form.Control size="sm" aria-label={`${i + 1}. satır ${key}`} value={s[key]} type={['ad','birimKodu'].includes(key) ? 'text' : 'number'} step="any" onChange={e => degistir({ satirlar: girdi.satirlar.map((satir,j) => j === i ? { ...satir, [key]: ['ad','birimKodu'].includes(key) ? e.target.value : Number(e.target.value) } : satir) })} /></td>)}
          <td><Button size="sm" variant="outline-danger" disabled={girdi.satirlar.length === 1} onClick={() => degistir({ satirlar: girdi.satirlar.filter((_,j) => i !== j) })}>Sil</Button></td></tr>)}</tbody></Table>
        <Button size="sm" onClick={() => degistir({ satirlar: [...girdi.satirlar, bosSatir()] })}>Satır ekle</Button>
        <Button size="sm" className="ms-2" onClick={kontrol}>Kontrol et ve toplamı göster</Button>
        {onizleme && <Alert variant="info" className="mt-3">Mal/hizmet: {ebelgeTutar(onizleme.ozet.malHizmetToplam, 'TRY')} · Vergi: {ebelgeTutar(onizleme.ozet.vergiToplam, 'TRY')} · Ödenecek: {ebelgeTutar(onizleme.ozet.odenecekTutar, 'TRY')}
          <p className="mb-2">Yerel kontrol tamamlandı. ICE'nin bu belge türü için gönderim öncesi doğrulama servisi bulunmuyor.</p>
          <Button size="sm" onClick={() => setOnay(true)}>Gönder</Button>
        </Alert>}
        {onay && <Alert variant="warning">{girdi.belgeNo} · {girdi.alici.unvan || `${girdi.alici.ad} ${girdi.alici.soyad}`} · {ebelgeTutar(onizleme!.ozet.odenecekTutar, 'TRY')}. ICE üzerinden e-Gider belgesi oluşturulacak.
          <Button size="sm" className="ms-2" onClick={gonder}>Gönderimi onayla</Button><Button size="sm" className="ms-2" variant="secondary" onClick={() => setOnay(false)}>Vazgeç</Button>
        </Alert>}
      </Card.Body></Card>
    </fieldset>
  </div>;
}

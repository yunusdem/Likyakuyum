import React, { useEffect, useState } from "react";
import { Alert, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import { EbelgeArsivSatiri, EbelgeStatu, ebelgeService, ebelgeTarihSaat, ebelgeTutar } from "../../services/ebelgeService";

const gun = (fark = 0) => new Date(Date.now() + fark * 86400000).toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });

/** ICE başlık aynası; uygulamanın gönderim durumunu değiştirmez. */
const EBelgeArsivPanel: React.FC = () => {
  const [baslangic, setBaslangic] = useState(gun(-30));
  const [bitis, setBitis] = useState(gun());
  const [arama, setArama] = useState("");
  const [sayfa, setSayfa] = useState(1);
  const [toplam, setToplam] = useState(0);
  const [kayitlar, setKayitlar] = useState<EbelgeArsivSatiri[]>([]);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [uyari, setUyari] = useState<string | null>(null);

  const yukle = async (hedef = 1) => {
    const r = await ebelgeService.listEarsivArsiv(hedef, arama.trim());
    setKayitlar(r.kayitlar); setToplam(r.toplam); setSayfa(hedef);
  };
  const calistir = async (is: () => Promise<void>) => {
    setMesgul(true); setHata(null);
    try { await is(); }
    catch (err: any) { setHata(err?.message || "ICE arşiv işlemi tamamlanamadı."); }
    finally { setMesgul(false); }
  };
  useEffect(() => { void calistir(() => yukle()); }, []);
  const senkronize = () => calistir(async () => {
    setBilgi(null); setUyari(null);
    const r = await ebelgeService.senkronizeEarsivArsiv(baslangic, bitis);
    setBilgi(`${r.cekilen} başlık alındı, ${r.yazilan} kayıt güncellendi.`);
    setUyari([r.uyari, r.atlanan ? `${r.atlanan} kayıt eksik/geçersiz bilgi nedeniyle yazılmadı.` : ""].filter(Boolean).join(" ") || null);
    await yukle();
  });
  const isaretle = (uuid: string, statu: EbelgeStatu) => calistir(async () => {
    await ebelgeService.earsivArsivIsaretle(uuid, statu);
    await yukle(sayfa); setBilgi(`Arşiv kaydı ${statu} olarak işaretlendi.`);
  });
  return <Card className="mb-3"><Card.Body>
    <h2 className="h6">ICE e-Arşiv kayıtları</h2>
    <p className="small text-secondary">ICE'den alınan başlıklar burada saklanır. Tarih aralığı senkronizasyon içindir;
      aşağıdaki liste daha önce alınan tüm kayıtları da içerir. ICE durum kodu, GİB rapor sonucu veya uygulamanın gönderim onayı değildir.</p>
    {hata && <Alert variant="danger">{hata}</Alert>}
    {bilgi && <Alert variant="info">{bilgi}</Alert>}
    {uyari && <Alert variant="warning">{uyari}</Alert>}
    <fieldset disabled={mesgul}>
      <div className="d-flex gap-2 flex-wrap align-items-end mb-3">
        <Form.Group><Form.Label>Başlangıç</Form.Label><Form.Control size="sm" type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} /></Form.Group>
        <Form.Group><Form.Label>Bitiş</Form.Label><Form.Control size="sm" type="date" value={bitis} onChange={(e) => setBitis(e.target.value)} /></Form.Group>
        <Button size="sm" onClick={senkronize} disabled={!baslangic || !bitis || baslangic > bitis}>ICE'den senkronize et</Button>
        <Form.Group><Form.Label>Belge no / ETTN / unvan</Form.Label><Form.Control size="sm" value={arama} maxLength={200} onChange={(e) => setArama(e.target.value)} /></Form.Group>
        <Button size="sm" variant="outline-secondary" onClick={() => calistir(() => yukle())}>Listede ara</Button>
      </div>
      {mesgul && <Spinner animation="border" size="sm" />}
      <div className="table-responsive"><Table size="sm" hover>
        <thead><tr><th>Belge</th><th>Tarih</th><th>Gönderici</th><th>Alıcı</th><th>Tutar</th><th>ICE durumu</th><th>Son yerel işaret</th><th>İşlem</th></tr></thead>
        <tbody>{kayitlar.map((r) => <tr key={r.uuid}>
          <td>{r.belgeNo}<small className="d-block text-secondary">{r.uuid}</small></td>
          <td>{ebelgeTarihSaat(r.tarih)}</td><td>{r.gondericiUnvan || r.gondericiVkn || "-"}</td>
          <td>{r.aliciUnvan || r.aliciVkn || "-"}</td><td>{ebelgeTutar(r.tutar, r.paraBirimi)}</td>
          <td>{r.iceStatuKodu || "-"}<small className="d-block">{r.iceStatuAciklama}</small></td>
          <td>{r.isaret || "-"}</td><td><Form.Select size="sm" aria-label={`${r.belgeNo} arşiv işareti`} value="" onChange={(e) => { if (e.target.value) void isaretle(r.uuid, e.target.value as EbelgeStatu); }}>
            <option value="">İşaretle…</option><option value="Okundu">Okundu</option><option value="Okunmadı">Okunmadı</option>
            <option value="Islendi">İşlendi</option><option value="Islenmedi">İşlenmedi</option>
          </Form.Select></td>
        </tr>)}{kayitlar.length === 0 && <tr><td colSpan={8}>Arşiv kaydı yok. ICE'den senkronize edebilirsiniz.</td></tr>}</tbody>
      </Table></div>
      <div className="d-flex gap-2 align-items-center"><span>{toplam} kayıt · Sayfa {sayfa}/{Math.max(1, Math.ceil(toplam / 50))}</span>
        <Button size="sm" variant="outline-secondary" disabled={sayfa <= 1} onClick={() => calistir(() => yukle(sayfa - 1))}>Önceki</Button>
        <Button size="sm" variant="outline-secondary" disabled={sayfa * 50 >= toplam} onClick={() => calistir(() => yukle(sayfa + 1))}>Sonraki</Button>
      </div>
    </fieldset>
  </Card.Body></Card>;
};
export default EBelgeArsivPanel;

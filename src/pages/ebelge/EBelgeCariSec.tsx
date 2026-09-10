import { useState } from "react";
import { Alert, Button, Form, Table } from "react-bootstrap";
import { CariService, CariKartItem, CariLookups } from "../../services/cariService";

/** Existing cari API is read only here; no change to the cari module. */
export default function EBelgeCariSec({ onSelect }: {
  onSelect: (cari: CariKartItem, lookups: CariLookups) => void;
}) {
  const [arama, setArama] = useState("");
  const [kayitlar, setKayitlar] = useState<CariKartItem[]>([]);
  const [lookups, setLookups] = useState<CariLookups | null>(null);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState("");
  const ara = async () => {
    if (arama.trim().length < 2) { setHata("En az iki karakter giriniz."); return; }
    setBusy(true); setHata(""); setKayitlar([]);
    try {
      const [cariler, sozluk] = await Promise.all([CariService.getCariKartlar(), CariService.getLookups()]);
      const q = arama.trim().toLocaleLowerCase("tr-TR");
      const eslesen = cariler.filter(c => `${c.ad} ${c.kod} ${c.vergiKimlikNo || ""}`.toLocaleLowerCase("tr-TR").includes(q));
      setKayitlar(eslesen.slice(0, 50)); setLookups(sozluk);
      if (!eslesen.length) setHata("Bu ad soyad ile cari bulunamadı. Kaydı yoksa TC/VKN alanını elle doldurun.");
      else if (eslesen.length > 50) setHata("İlk 50 eşleşme gösteriliyor; aramayı daraltabilirsiniz.");
    } catch (e: any) { setHata(e.message || "Cari listesi alınamadı."); }
    finally { setBusy(false); }
  };
  return <div className="mb-3">
    <Form.Label>Ad soyad ile ara (TC / VKN ile de aranabilir)</Form.Label>
    <div className="d-flex gap-2">
      <Form.Control size="sm" value={arama} onChange={e => setArama(e.target.value)} onKeyDown={e => {
        if (e.key === "Enter") { e.preventDefault(); void ara(); }
      }} />
      <Button size="sm" disabled={busy} onClick={ara}>{busy ? "Aranıyor…" : "Cari Ara"}</Button>
    </div>
    {hata && <Alert variant="info" className="mt-2">{hata}</Alert>}
    {!!kayitlar.length && <Table size="sm" responsive>
      <thead><tr><th>Kod</th><th>Ad soyad</th><th>TC / VKN</th><th /></tr></thead>
      <tbody>{kayitlar.map(c => <tr key={c.id}><td>{c.kod}</td><td>{c.ad}</td><td>{c.vergiKimlikNo || "Eksik"}</td>
        <td><Button size="sm" disabled={!/^\d{10,11}$/.test(c.vergiKimlikNo?.trim() || "")}
          onClick={() => { if (lookups) { onSelect(c, lookups); setKayitlar([]); } }}>Seç</Button></td></tr>)}</tbody>
    </Table>}
  </div>;
}

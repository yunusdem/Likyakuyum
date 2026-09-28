import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { EBELGE_YEREL_TASLAK_FORMU, EbelgeYerelTaslak, EbelgeYerelTaslakTuru, ebelgeService, ebelgeTutar } from "../../services/ebelgeService";

/**
 * Yerel taslaklar — docs/ebelge-revizyon.md K3. Tüm belge türlerinin (e-Fatura, e-Arşiv, e-İrsaliye, e-Gider,
 * e-Müstahsil) formdan hiçbir kontrol yapılmadan saklanan taslakları. Bu kayıtlar GİB'e gitmemiştir; "Aç" ilgili formu taslakla doldurur, gönderim oradan yapılır.
 */
const tarihSaat = (t: string) => new Date(t).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });

export default function EBelgeYerelTaslaklar() {
  const navigate = useNavigate();
  const [kayitlar, setKayitlar] = useState<EbelgeYerelTaslak[]>([]);
  const [hata, setHata] = useState("");
  const [busy, setBusy] = useState(false);
  const [silinecek, setSilinecek] = useState<number | null>(null);
  /** Türe göre ayrı listeler (docs/GIRIS_VE_EBELGE_DUZENLEME.md R4); e-Fatura ve e-Arşiv her zaman görünür */
  const [sekme, setSekme] = useState<EbelgeYerelTaslakTuru>("EFatura");

  const yukle = () => ebelgeService.yerelTaslakListe().then(setKayitlar).catch((e: any) => setHata(e?.message || "Yerel taslaklar alınamadı."));
  useEffect(() => { void yukle(); }, []);

  const sil = async (id: number) => {
    setBusy(true); setHata("");
    try { await ebelgeService.yerelTaslakSil(id); setSilinecek(null); await yukle(); }
    catch (e: any) { setHata(e?.message || "Taslak silinemedi."); }
    finally { setBusy(false); }
  };

  if (!kayitlar.length && !hata) return null;
  const turler = (Object.keys(EBELGE_YEREL_TASLAK_FORMU) as EbelgeYerelTaslakTuru[])
    .filter((t) => t === "EFatura" || t === "EArsiv" || kayitlar.some((k) => k.belgeTuru === t));
  const gorunen = kayitlar.filter((k) => k.belgeTuru === sekme);
  return <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
    <Card.Body className="p-3 bg-body">
      <div className="fw-semibold mb-2" style={{ fontSize: "13px" }}>
        Yerel Taslaklar <span className="text-secondary fw-normal">— GİB'e gönderilmedi, belge numarası kullanılmadı</span>
      </div>
      {hata && <Alert variant="danger" className="py-2 small">{hata}</Alert>}
      <div className="d-flex flex-wrap gap-1 mb-2">
        {turler.map((t) => (
          <Button key={t} size="sm" variant={sekme === t ? "primary" : "outline-secondary"} onClick={() => setSekme(t)}>
            {EBELGE_YEREL_TASLAK_FORMU[t].ad} ({kayitlar.filter((k) => k.belgeTuru === t).length})
          </Button>
        ))}
      </div>
      {!gorunen.length && <div className="small text-secondary">Kayıtlı {EBELGE_YEREL_TASLAK_FORMU[sekme].ad} taslağı yok.</div>}
      <Table responsive size="sm" hover className="mb-0 align-middle">
        <thead><tr><th>Tür</th><th>Belge no</th><th>Alıcı</th><th className="text-end">Tutar</th><th>Son kayıt</th><th>Kaydeden</th><th></th></tr></thead>
        <tbody>{gorunen.map((t) => <tr key={t.id}>
          <td><Badge bg="secondary">{EBELGE_YEREL_TASLAK_FORMU[t.belgeTuru]?.ad || t.belgeTuru}</Badge></td>
          <td className="font-monospace">{t.belgeNo || "-"}</td>
          <td>{t.aliciUnvan || t.aliciVkn || "-"}</td>
          <td className="text-end font-monospace">{t.tutar == null ? "-" : ebelgeTutar(t.tutar, t.paraBirimi || "TRY")}</td>
          <td className="text-nowrap">{tarihSaat(t.guncellemeTarihi)}</td>
          <td>{t.olusturan || "-"}</td>
          <td className="text-end text-nowrap">
            {silinecek === t.id ? <>
              <span className="small me-2">Taslak silinsin mi?</span>
              <Button size="sm" variant="danger" className="me-1" disabled={busy} onClick={() => void sil(t.id)}>Sil</Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => setSilinecek(null)}>Vazgeç</Button>
            </> : <>
              <Button size="sm" variant="link" className="p-0 me-2" title="Taslağı formda aç" disabled={busy}
                onClick={() => navigate(`${EBELGE_YEREL_TASLAK_FORMU[t.belgeTuru].yol}?taslak=${t.id}`)}><IconPencil size={16} /></Button>
              <Button size="sm" variant="link" className="p-0" style={{ color: "#dc2626" }} title="Taslağı sil" disabled={busy}
                onClick={() => setSilinecek(t.id)}><IconTrash size={16} /></Button>
            </>}
          </td>
        </tr>)}</tbody>
      </Table>
    </Card.Body>
  </Card>;
}

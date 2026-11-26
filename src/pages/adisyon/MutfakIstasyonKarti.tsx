import React, { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Form, Table } from "react-bootstrap";
import { IconPrinter, IconRefresh } from "@tabler/icons-react";
import { useToast } from "../../context/ToastContext";
import { AdisyonService, MutfakBekleyenFis } from "../../services/adisyonService";
import { checkLocalPrintServiceOnline } from "../../services/silentPrintService";
import { MUTFAK_ISTASYON_ANAHTARI, MUTFAK_ISTASYON_OLAYI, mutfakIstasyonuMu } from "../../components/adisyon/MutfakYaziciIstasyonu";

/**
 * Adisyon › Ayarlar › Bu bilgisayar (D5, TA30): mutfak fişlerini basan kasa PC'si seçimi (bilgisayara özel), yazdırma ajanı
 * denetimi, kuyruktaki / basılamayan fişler (yeniden dene, basıldı say).
 */
export const MutfakIstasyonKarti: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [acik, setAcik] = useState(mutfakIstasyonuMu());
  const [ajan, setAjan] = useState<"bilinmiyor" | "var" | "yok">("bilinmiyor");
  const [fisler, setFisler] = useState<MutfakBekleyenFis[]>([]);
  const [son, setSon] = useState<{ basarili: boolean; mesaj: string; zaman: number } | null>(null);
  const yukle = useCallback(async () => { try { setFisler(await AdisyonService.mutfakBekleyen()); } catch { /* */ } }, []);
  useEffect(() => { void yukle(); const t = setInterval(() => void yukle(), 10_000); return () => clearInterval(t); }, [yukle]);
  useEffect(() => {
    const f = (e: Event) => { setSon((e as CustomEvent).detail); void yukle(); };
    window.addEventListener(MUTFAK_ISTASYON_OLAYI, f);
    return () => window.removeEventListener(MUTFAK_ISTASYON_OLAYI, f);
  }, [yukle]);
  const ajanDenetle = async () => setAjan((await checkLocalPrintServiceOnline().catch(() => null)) ? "var" : "yok");
  useEffect(() => { if (acik) void ajanDenetle(); }, [acik]);
  const degistir = (v: boolean) => { setAcik(v); localStorage.setItem(MUTFAK_ISTASYON_ANAHTARI, v ? "1" : "0"); };
  const yeniden = async (f: MutfakBekleyenFis, basildi: boolean) => {
    try { await AdisyonService.mutfakFisYeniden(f.fisId, basildi); showSuccess(basildi ? "Fiş basıldı sayıldı." : "Fiş yeniden kuyruğa alındı."); await yukle(); } catch (e: any) { showError(e?.message || "Yapılamadı."); }
  };
  return (
    <Card className="border shadow-xs">
      <Card.Header className="bg-light py-2 fw-bold small d-flex align-items-center gap-2"><IconPrinter size={16} />Bu bilgisayar — mutfak fişleri</Card.Header>
      <Card.Body>
        <Form.Check type="switch" id="mutfak-istasyon" checked={acik} onChange={(e) => degistir(e.target.checked)}
          label={<div><div className="fw-semibold">Mutfak / bar fişlerini bu bilgisayar bassın</div><div className="small text-muted">Garsonun ve kasanın siparişleri hazırlık yerinin yazıcısına bu bilgisayardaki yazdırma ajanıyla basılır. Bu bilgisayar açık olmalı. Birden çok bilgisayar işaretlenirse fiş yine bir kez basılır.</div></div>} />
        {acik && (
          <div className="small mt-2 d-flex align-items-center gap-2">
            Yazdırma ajanı: {ajan === "var" ? <Badge bg="success">çalışıyor</Badge> : ajan === "yok" ? <Badge bg="danger">bulunamadı (127.0.0.1:9100)</Badge> : <Badge bg="secondary">denetleniyor</Badge>}
            <Button size="sm" variant="link" className="p-0" onClick={() => void ajanDenetle()}>yeniden denetle</Button>
            {son && <span className={son.basarili ? "text-success" : "text-danger"}>Son fiş: {son.basarili ? "basıldı" : son.mesaj} ({new Date(son.zaman).toLocaleTimeString("tr-TR")})</span>}
          </div>
        )}
        <div className="d-flex align-items-center mt-3 mb-1">
          <span className="fw-bold small">Basılmayı bekleyen fişler</span>
          <Badge bg={fisler.some((f) => f.durdu) ? "danger" : "secondary"} className="ms-2">{fisler.length}</Badge>
          <Button size="sm" variant="link" className="ms-auto p-0" aria-label="Fiş listesini yenile" onClick={() => void yukle()}><IconRefresh size={14} /></Button>
        </div>
        {!fisler.length ? <div className="small text-muted">Kuyruk boş.</div> : (
          <Table size="sm" className="mb-0 align-middle small">
            <thead><tr><th>Yer</th><th>Masa</th><th>Kalem</th><th>Deneme</th><th>Durum</th><th /></tr></thead>
            <tbody>
              {fisler.map((f) => (
                <tr key={f.fisId}>
                  <td>{f.yer}{f.tur === 2 && <Badge bg="dark" className="ms-1">İptal</Badge>}</td>
                  <td>{f.masa || "Paket"}</td>
                  <td>{f.kalem}</td>
                  <td>{f.deneme}</td>
                  <td>{f.durdu ? <Badge bg="danger">Durdu</Badge> : f.eskidi ? <Badge bg="warning" text="dark" title="30 dakikayı geçtiği için kendiliğinden basılmaz; isterseniz yeniden kuyruğa alın">Eskidi</Badge> : f.hata ? <span className="text-danger">{f.hata}</span> : <span className="text-muted">sırada</span>}</td>
                  <td className="text-end text-nowrap">
                    {(f.durdu || f.hata) && <Button size="sm" variant="link" className="py-0" onClick={() => void yeniden(f, false)}>Yeniden dene</Button>}
                    <Button size="sm" variant="link" className="py-0 text-secondary" onClick={() => void yeniden(f, true)}>Basıldı say</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card.Body>
    </Card>
  );
};

export default MutfakIstasyonKarti;

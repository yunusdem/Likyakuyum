import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Modal, Spinner } from "react-bootstrap";
import { IconPrinter, IconRefresh } from "@tabler/icons-react";
import QRCode from "qrcode";
import { AdisyonService, MasaQrListesi } from "../../services/adisyonService";

/** Misafir adresi (§11 M4): QR'ın içindeki bağlantı (saf; test edilir) */
export const misafirAdresi = (koken: string, musteriNo: string, anahtar: string) =>
  `${koken.replace(/\/+$/, "")}/misafir?m=${encodeURIComponent(musteriNo)}&q=${encodeURIComponent(anahtar)}`;

/**
 * Masa QR kodları (docs/TICARI_ADISYON_YOL_HARITASI.md §11, M4): her masanın kendi kodu; masaya yapıştırılır. Kod yalnız masayı tanıtır,
 * sipariş için garsonun verdiği PIN de gerekir. "Yenile" o masanın kodunu değiştirir (eski çıktı çalışmaz). "Yazdır" çıktı penceresi açar.
 */
export const MasaQrModal: React.FC<{ show: boolean; kapat: () => void }> = ({ show, kapat }) => {
  const [l, setL] = useState<MasaQrListesi | null>(null);
  const [resim, setResim] = useState<Record<number, string>>({});
  const [hata, setHata] = useState<string | null>(null);
  const musteriNo = l?.musteriNo || localStorage.getItem("kuyumcu_erp_musteri_no") || "";
  const ciz = useCallback(async (x: MasaQrListesi) => {
    const no = x.musteriNo || localStorage.getItem("kuyumcu_erp_musteri_no") || "";
    const r: Record<number, string> = {};
    for (const m of x.masalar) r[m.masaId] = await QRCode.toDataURL(misafirAdresi(window.location.origin, no, m.anahtar), { margin: 1, width: 220, errorCorrectionLevel: "M" });
    setResim(r); setL(x);
  }, []);
  useEffect(() => {
    if (!show) return;
    setHata(null); setL(null);
    AdisyonService.masaQr().then(ciz).catch((e: any) => setHata(e?.response?.data?.message || e?.message || "QR kodları alınamadı."));
  }, [show, ciz]);
  const yenile = async (masaId: number, ad: string) => {
    if (!window.confirm(`"${ad}" masasının QR kodu yenilensin mi? Masadaki eski kod çalışmaz; yenisini yazdırıp yapıştırın.`)) return;
    try { await ciz(await AdisyonService.masaQrYenile(masaId)); } catch (e: any) { setHata(e?.response?.data?.message || e?.message || "Yenilenemedi."); }
  };
  const yazdir = () => {
    if (!l) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    const kartlar = l.masalar.filter((m) => m.aktif).map((m) => `<div class="k"><div class="b">${m.bolge.replace(/</g, "&lt;")}</div><div class="m">Masa ${m.ad.replace(/</g, "&lt;")}</div><img src="${resim[m.masaId]}"/><div class="a">Okutun, garsonunuzdan masa PIN'ini isteyin</div></div>`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Masa QR kodları</title><style>body{font-family:Arial,sans-serif;margin:12px}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.k{border:1px dashed #94a3b8;border-radius:10px;padding:10px;text-align:center;break-inside:avoid}.b{font-size:12px;color:#475569}.m{font-size:22px;font-weight:700}.a{font-size:11px;color:#334155}img{width:170px;height:170px}</style></head><body><div class="g">${kartlar}</div></body></html>`);
    w.document.close();
    w.focus();
  };
  return (
    <Modal show={show} onHide={kapat} size="lg" scrollable>
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6 fw-bold">Masa QR kodları (misafir siparişi)</Modal.Title></Modal.Header>
      <Modal.Body>
        {hata && <Alert variant="danger" className="py-2 small">{hata}</Alert>}
        {l && !l.acik && <Alert variant="warning" className="py-2 small">Masadan misafir siparişi kapalı: kodlar okutulunca "sipariş kapalı" görünür. Açmak için Restorant › Ayarlar.</Alert>}
        {l && !musteriNo && <Alert variant="warning" className="py-2 small">Müşteri no bulunamadı; kodlar eksik adres taşır.</Alert>}
        {!l && !hata && <Spinner />}
        {l && !l.masalar.length && <div className="text-muted small">Henüz masa yok.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
          {l?.masalar.map((m) => (
            <div key={m.masaId} className="border rounded p-2 text-center" style={{ opacity: m.aktif ? 1 : 0.5 }}>
              <div className="small text-muted">{m.bolge}</div>
              <div className="fw-bold">Masa {m.ad}</div>
              {resim[m.masaId] && <img src={resim[m.masaId]} alt={`Masa ${m.ad} QR kodu`} style={{ width: 140, height: 140 }} />}
              <div><Button size="sm" variant="link" className="py-0" onClick={() => void yenile(m.masaId, m.ad)}><IconRefresh size={13} className="me-1" />Yenile</Button></div>
            </div>
          ))}
        </div>
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button size="sm" variant="primary" disabled={!l?.masalar.length} onClick={yazdir}><IconPrinter size={14} className="me-1" />Yazdır</Button>
        <Button size="sm" variant="secondary" onClick={kapat}>Kapat</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default MasaQrModal;

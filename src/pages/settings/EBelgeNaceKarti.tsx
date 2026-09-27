import React, { useEffect, useState } from "react";
import { Button, Card, Form, Spinner, Table } from "react-bootstrap";
import { IconPlus, IconTrash, IconDeviceFloppy } from "@tabler/icons-react";
import { EBELGE_KDV_ORANLARI, EbelgeNaceKaydi, ebelgeService } from "../../services/ebelgeService";
import { useToast } from "../../context/ToastContext";
import { KUYUMCU_NACE_KODLARI, NACE_REFERANS_TARIHI, naceReferansBul } from "./naceReferans";

/**
 * Firma NACE (faaliyet) kodları ve her kod için faturada kullanılabilecek KDV oranları
 * (docs/GIRIS_VE_EBELGE_DUZENLEME.md N1). Fatura formundaki KDV listesi bu oranlara göre ayrılır; NACE dışı oran
 * seçilirse uyarılır. Liste boşsa kısıt yoktur. Kodlar vergi levhasındaki ana ve yan faaliyet kodlarıdır.
 */
const EBelgeNaceKarti: React.FC = () => {
  const { showSuccess, showToast } = useToast();
  const [liste, setListe] = useState<EbelgeNaceKaydi[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    ebelgeService
      .naceListe()
      .then(setListe)
      .catch((e: any) => showToast(e?.message || "NACE kodları alınamadı.", "danger", 0))
      .finally(() => setYukleniyor(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const degistir = (i: number, yeni: Partial<EbelgeNaceKaydi>) =>
    setListe((o) => o.map((n, j) => (j === i ? { ...n, ...yeni } : n)));

  /** Kod yazılınca hazır listede varsa açıklama ve oran kendiliğinden gelir (boş açıklama ezilmez sayılmaz, doldurulur). */
  const kodDegistir = (i: number, kod: string) =>
    setListe((o) => o.map((n, j) => {
      if (j !== i) return n;
      const ref = naceReferansBul(kod);
      return ref && !n.aciklama.trim() ? { ...n, kod, aciklama: ref.ad, oranlar: [...ref.oranlar] } : { ...n, kod };
    }));

  const hazirdanEkle = (kod: string) => {
    const ref = naceReferansBul(kod);
    if (!ref || liste.some((n) => n.kod === ref.kod)) return;
    setListe((o) => [...o, { kod: ref.kod, aciklama: ref.ad, oranlar: [...ref.oranlar] }]);
  };

  const oranDegistir = (i: number, oran: number, secili: boolean) =>
    setListe((o) =>
      o.map((n, j) =>
        j === i ? { ...n, oranlar: secili ? [...n.oranlar, oran].sort((a, b) => a - b) : n.oranlar.filter((x) => x !== oran) } : n
      )
    );

  const kaydet = async () => {
    setKaydediliyor(true);
    try {
      setListe(await ebelgeService.naceKaydet(liste));
      showSuccess("NACE kodları kaydedildi.");
    } catch (e: any) {
      showToast(e?.message || "NACE kodları kaydedilemedi.", "danger", 0);
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
      <Card.Body className="p-3 bg-body">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div>
            <div className="fw-semibold" style={{ fontSize: "13px" }}>NACE Kodları ve KDV Oranları</div>
            <div className="text-secondary" style={{ fontSize: "12px" }}>
              Vergi levhasındaki ana ve yan faaliyet kodlarınızı ve her kod için kullanılabilecek KDV oranlarını girin
              (mali müşavirinizden teyit edin). Faturada bu oranlar önce gösterilir, NACE dışı oran seçilince uyarı çıkar.
              Liste boşsa kısıt yoktur.
            </div>
          </div>
          <div className="d-flex gap-2 flex-shrink-0">
            <Form.Select size="sm" value="" style={{ width: 260 }} disabled={yukleniyor || liste.length >= 20}
              title={`Kuyumculuk / döviz faaliyet kodları — oranlar resmi mevzuattan türetildi (${NACE_REFERANS_TARIHI})`}
              onChange={(e) => hazirdanEkle(e.target.value)}>
              <option value="">Kuyumculuk kodlarından ekle…</option>
              {KUYUMCU_NACE_KODLARI.filter((r) => !liste.some((n) => n.kod === r.kod)).map((r) => (
                <option key={r.kod} value={r.kod}>{r.kod} — {r.ad}</option>
              ))}
            </Form.Select>
            <Button size="sm" variant="outline-secondary" className="d-flex align-items-center gap-1"
              onClick={() => setListe((o) => [...o, { kod: "", aciklama: "", oranlar: [20] }])} disabled={yukleniyor || liste.length >= 20}>
              <IconPlus size={14} /> Kod Ekle
            </Button>
          </div>
        </div>

        {yukleniyor ? (
          <Spinner animation="border" size="sm" />
        ) : (
          <>
            {liste.length === 0 ? (
              <div className="small text-secondary mb-2">NACE kodu girilmedi; faturada tüm KDV oranları seçilebilir.</div>
            ) : (
              <Table size="sm" responsive className="align-middle mb-2">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>NACE Kodu</th>
                    <th>Açıklama</th>
                    <th>İzin verilen KDV oranları</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {liste.map((n, i) => (
                    <tr key={i}>
                      <td>
                        <Form.Control size="sm" className="font-monospace" placeholder="47.77.01" maxLength={10} value={n.kod}
                          list="nace-referans-kodlari"
                          onChange={(e) => kodDegistir(i, e.target.value.replace(/[^0-9.]/g, ""))} />
                      </td>
                      <td>
                        <Form.Control size="sm" maxLength={200} placeholder="Ör: Mücevher perakende ticareti" value={n.aciklama}
                          onChange={(e) => degistir(i, { aciklama: e.target.value })} />
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          {EBELGE_KDV_ORANLARI.map((o) => (
                            <Form.Check key={o} inline type="checkbox" id={`nace-${i}-${o}`} className="small me-0" label={`%${o}`}
                              checked={n.oranlar.includes(o)} onChange={(e) => oranDegistir(i, o, e.target.checked)} />
                          ))}
                        </div>
                      </td>
                      <td>
                        <Button size="sm" variant="link" className="p-0" style={{ color: "#dc2626" }} title="Kodu sil"
                          onClick={() => setListe((o) => o.filter((_, j) => j !== i))}>
                          <IconTrash size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <datalist id="nace-referans-kodlari">
              {KUYUMCU_NACE_KODLARI.map((r) => <option key={r.kod} value={r.kod}>{r.ad}</option>)}
            </datalist>
            <div className="text-secondary mb-2" style={{ fontSize: "11.5px" }}>
              Hazır listedeki oranlar resmi mevzuattan türetildi (KDVK 17/4-g, 23/e, 28; KDVGUT III/A-4.2.1): kuyumculuk
              kalemleri %20 (ziynet/sikke özel matrahla), külçe altın ve kıymetli taş istisnayla %0. GİB NACE–oran tablosu
              yayımlamadı; kodlarınızı vergi levhasından (Dijital Vergi Dairesi) alın. Faaliyet dışı satışta (demirbaş, masraf
              yansıtma) faturada satırın İstisna Kodu'na 555 yazılır.
            </div>
            <Button size="sm" variant="primary" className="d-flex align-items-center gap-1" disabled={kaydediliyor} onClick={() => void kaydet()}>
              {kaydediliyor ? <Spinner animation="border" size="sm" /> : <IconDeviceFloppy size={15} />} NACE Kodlarını Kaydet
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default EBelgeNaceKarti;

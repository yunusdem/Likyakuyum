import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { MobilKatalogKarti, MobilYonetimService } from "../../services/mobilYonetimService";

/**
 * Mobil Ayarları › mobil katalog (Ticari, docs/MOBIL_CARI_YOL_HARITASI.md Faz 8): firma stok kartlarından seçer ve sıralar.
 * Cari, seçilen kartları kendi fiyat listesindeki (yoksa kartın) KDV dahil fiyatla görür ve sepetle sipariş verir; stok
 * miktarını görmez, yalnız "stokta var / yok".
 */

const tl = (v: number | null | undefined) => (v === null || v === undefined ? "fiyat yok" : `${v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`);

const MobilKatalogSecimi: React.FC = () => {
  const [secili, setSecili] = useState<MobilKatalogKarti[] | null>(null);
  const [arama, setArama] = useState("");
  const [bulunan, setBulunan] = useState<MobilKatalogKarti[]>([]);
  const [araniyor, setAraniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  const yukle = useCallback(async () => {
    try {
      setSecili(await MobilYonetimService.katalog());
    } catch (e: any) {
      setHata(e?.message || "Katalog alınamadı.");
      setSecili([]);
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useEffect(() => {
    if (zamanlayici.current) clearTimeout(zamanlayici.current);
    const q = arama.trim();
    if (q.length < 2) {
      setBulunan([]);
      return;
    }
    zamanlayici.current = setTimeout(async () => {
      setAraniyor(true);
      try {
        setBulunan(await MobilYonetimService.katalogAra(q));
      } catch (e: any) {
        setHata(e?.message || "Arama yapılamadı.");
      } finally {
        setAraniyor(false);
      }
    }, 350);
  }, [arama]);

  const tasi = (i: number, yon: -1 | 1) =>
    setSecili((l) => {
      if (!l) return l;
      const j = i + yon;
      if (j < 0 || j >= l.length) return l;
      const k = [...l];
      [k[i], k[j]] = [k[j], k[i]];
      return k;
    });

  const kaydet = async () => {
    if (!secili) return;
    setMesgul(true);
    setHata(null);
    setMesaj(null);
    try {
      setSecili(await MobilYonetimService.katalogYaz(secili.map((k) => k.stokKartId)));
      setMesaj("Mobil katalog kaydedildi.");
    } catch (e: any) {
      setHata(e?.message || "Kaydedilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  const seciliIdler = new Set((secili || []).map((k) => k.stokKartId));

  return (
    <Card className="mb-4">
      <Card.Header className="py-2 fw-semibold small">Mobil katalog (Ticari)</Card.Header>
      <Card.Body>
        <div className="small text-muted mb-2">
          Cari, seçilen stok kartlarını kendi fiyat listesindeki (atanmamışsa kartın) KDV dahil fiyatla görür ve sepetle sipariş verir. Stok miktarı ve alış fiyatı mobilde görünmez; yalnız "stokta var / yok". Kampanya indirimi mobilde uygulanmaz.
        </div>
        {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
        {mesaj && <Alert variant="success" className="py-2">{mesaj}</Alert>}
        {!secili ? (
          <Spinner animation="border" size="sm" />
        ) : (
          <div className="d-flex flex-wrap gap-4">
            <div style={{ minWidth: 360, flex: 1 }}>
              <div className="small fw-semibold mb-1">Katalogdakiler ({secili.length})</div>
              <div style={{ maxHeight: 380, overflowY: "auto" }}>
                <Table size="sm" className="small align-middle">
                  <tbody>
                    {secili.length === 0 && (
                      <tr>
                        <td className="text-muted">Katalog boş; mobilde Katalog sekmesi görünmez.</td>
                      </tr>
                    )}
                    {secili.map((k, i) => (
                      <tr key={k.stokKartId} className={k.aktif === false ? "text-muted" : ""}>
                        <td className="font-monospace">{k.kod}</td>
                        <td>
                          {k.ad}
                          {k.aktif === false && <span className="ms-1 badge bg-secondary">pasif</span>}
                        </td>
                        <td className="text-end text-nowrap">{tl(k.fiyat)}</td>
                        <td className="text-end text-nowrap text-muted" title="Stok bakiyesi (mobilde görünmez)">
                          {k.bakiye.toLocaleString("tr-TR")} {k.birim}
                        </td>
                        <td className="text-end text-nowrap">
                          <Button size="sm" variant="link" className="p-0 me-1" disabled={i === 0} onClick={() => tasi(i, -1)} title="Yukarı">
                            <IconArrowUp size={15} />
                          </Button>
                          <Button size="sm" variant="link" className="p-0 me-2" disabled={i === secili.length - 1} onClick={() => tasi(i, 1)} title="Aşağı">
                            <IconArrowDown size={15} />
                          </Button>
                          <Button size="sm" variant="outline-secondary" onClick={() => setSecili((l) => (l || []).filter((x) => x.stokKartId !== k.stokKartId))}>
                            Çıkar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </div>
            <div style={{ minWidth: 300, flex: 1 }}>
              <div className="small fw-semibold mb-1">Stok kartı ekle</div>
              <Form.Control size="sm" placeholder="Kod, ad ya da barkod (en az 2 harf)" value={arama} onChange={(e) => setArama(e.target.value)} />
              <div className="mt-2" style={{ maxHeight: 340, overflowY: "auto" }}>
                {araniyor && <Spinner animation="border" size="sm" />}
                {!araniyor && arama.trim().length >= 2 && bulunan.length === 0 && <div className="small text-muted">Eşleşen aktif kart yok.</div>}
                {bulunan.map((k) => (
                  <div key={k.stokKartId} className="d-flex align-items-center justify-content-between small border-bottom py-1">
                    <span>
                      <span className="font-monospace">{k.kod}</span> {k.ad} <span className="text-muted">· {tl(k.fiyat)}</span>
                    </span>
                    <Button
                      size="sm"
                      variant={seciliIdler.has(k.stokKartId) ? "outline-secondary" : "outline-primary"}
                      disabled={seciliIdler.has(k.stokKartId) || k.fiyat === null}
                      title={k.fiyat === null ? "Fiyatı olmayan kart mobilde satılamaz" : undefined}
                      onClick={() => setSecili((l) => [...(l || []), k])}
                    >
                      {seciliIdler.has(k.stokKartId) ? "Ekli" : "Ekle"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="text-end">
          <Button onClick={() => void kaydet()} disabled={mesgul || !secili}>
            {mesgul ? "Kaydediliyor…" : "Kataloğu kaydet"}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default MobilKatalogSecimi;

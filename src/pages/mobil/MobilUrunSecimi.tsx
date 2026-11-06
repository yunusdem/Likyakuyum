import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Form, Spinner, Table } from "react-bootstrap";
import { IconArrowDown, IconArrowUp } from "@tabler/icons-react";
import { MobilParaUrunu, MobilYonetimService } from "../../services/mobilYonetimService";

/**
 * Mobil Ayarları › mobilde görünen ürünler (docs/MOBIL_CARI_YOL_HARITASI.md K14): firma seçer ve sıralar. Cari yalnız
 * bu ürünlerin son fiyatını görür (Anlık Fiyat Listesi'nin son kaydı, komisyonlu).
 */

const TIP_ADI: Record<number, string> = { 0: "Döviz", 1: "Altın", 2: "Gümüş", 3: "Ziynet" };

const MobilUrunSecimi: React.FC = () => {
  const [urunler, setUrunler] = useState<MobilParaUrunu[] | null>(null);
  const [secili, setSecili] = useState<number[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(async () => {
    try {
      const l = await MobilYonetimService.urunler();
      setUrunler(l);
      setSecili(l.filter((u) => u.secili).sort((a, b) => (a.sira ?? 0) - (b.sira ?? 0)).map((u) => u.urunId));
    } catch (e: any) {
      setHata(e?.message || "Ürünler alınamadı.");
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const harita = useMemo(() => new Map((urunler || []).map((u) => [u.urunId, u])), [urunler]);
  const secilmeyen = (urunler || []).filter((u) => !secili.includes(u.urunId));

  const tasi = (i: number, yon: -1 | 1) =>
    setSecili((l) => {
      const j = i + yon;
      if (j < 0 || j >= l.length) return l;
      const k = [...l];
      [k[i], k[j]] = [k[j], k[i]];
      return k;
    });

  const kaydet = async () => {
    setMesgul(true);
    setHata(null);
    setMesaj(null);
    try {
      await MobilYonetimService.urunSecimiYaz(secili);
      setMesaj("Mobilde görünen ürünler kaydedildi.");
      await yukle();
    } catch (e: any) {
      setHata(e?.message || "Kaydedilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Header className="py-2 fw-semibold small">Mobilde görünen ürünler</Card.Header>
      <Card.Body>
        <div className="small text-muted mb-2">
          Cari, seçilen ürünlerin Anlık Fiyat Listesi'ndeki son (komisyonlu) fiyatını görür; ham kur ve komisyon görünmez. Cariye özel makas cari kartının Mobil sekmesinden verilir.
        </div>
        {hata && <Alert variant="danger" className="py-2">{hata}</Alert>}
        {mesaj && <Alert variant="success" className="py-2">{mesaj}</Alert>}
        {!urunler ? (
          <Spinner animation="border" size="sm" />
        ) : (
          <div className="d-flex flex-wrap gap-4">
            <div style={{ minWidth: 320, flex: 1 }}>
              <div className="small fw-semibold mb-1">Seçilenler (mobildeki sırayla)</div>
              <Table size="sm" className="small align-middle">
                <tbody>
                  {secili.length === 0 && (
                    <tr>
                      <td className="text-muted">Henüz ürün seçilmedi; cari fiyat göremez.</td>
                    </tr>
                  )}
                  {secili.map((id, i) => {
                    const u = harita.get(id);
                    return (
                      <tr key={id}>
                        <td className="font-monospace">{u?.kod}</td>
                        <td>{u?.ad}</td>
                        <td>{u?.urunTipi !== null && u?.urunTipi !== undefined && <Badge bg="light" text="dark">{TIP_ADI[u.urunTipi] ?? u.urunTipi}</Badge>}</td>
                        <td className="text-end text-nowrap">
                          <Button size="sm" variant="link" className="p-0 me-1" disabled={i === 0} onClick={() => tasi(i, -1)} title="Yukarı">
                            <IconArrowUp size={15} />
                          </Button>
                          <Button size="sm" variant="link" className="p-0 me-2" disabled={i === secili.length - 1} onClick={() => tasi(i, 1)} title="Aşağı">
                            <IconArrowDown size={15} />
                          </Button>
                          <Button size="sm" variant="outline-secondary" onClick={() => setSecili((l) => l.filter((x) => x !== id))}>
                            Çıkar
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            <div style={{ minWidth: 280, flex: 1 }}>
              <div className="small fw-semibold mb-1">Eklenebilecekler</div>
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {secilmeyen.map((u) => (
                  <Form.Check
                    key={u.urunId}
                    id={`mu-${u.urunId}`}
                    className="small"
                    type="checkbox"
                    checked={false}
                    label={`${u.kod} — ${u.ad}${u.urunTipi ? ` (${TIP_ADI[u.urunTipi] ?? u.urunTipi})` : ""}`}
                    onChange={() => setSecili((l) => [...l, u.urunId])}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div className="text-end">
          <Button onClick={() => void kaydet()} disabled={mesgul || !urunler}>
            {mesgul ? "Kaydediliyor…" : "Ürünleri kaydet"}
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
};

export default MobilUrunSecimi;

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Card, Col, Row, Spinner, Table } from "react-bootstrap";
import { IconBuildingBank, IconCash, IconChevronRight, IconRefresh } from "@tabler/icons-react";
import { VezneIzlemeService, type VezneIzlemeDataResponse } from "../services/vezneIzlemeService";
import { EBankaService, type EBankaHareketListesi, type EBankaOzet } from "../services/ebankaService";
import { bugun, paraYaz, zamanYaz } from "./ebanka/ebankaOrtak";

// Dashboard: solda vezne bakiyeleri, sağda banka hesapları ve bugünkü hareketler.
// Yalnızca bakiyesi olan birimler görünür; ayrıntı için asıl ekrana gidilir. Yenileme elle.

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [vezne, setVezne] = useState<VezneIzlemeDataResponse | null>(null);
  const [vezneHata, setVezneHata] = useState("");
  const [banka, setBanka] = useState<EBankaOzet | null>(null);
  const [hareketler, setHareketler] = useState<EBankaHareketListesi | null>(null);
  const [bankaHata, setBankaHata] = useState("");
  const [yukleniyor, setYukleniyor] = useState(false);

  const yenile = useCallback(async () => {
    setYukleniyor(true);
    const g = bugun();
    await Promise.all([
      VezneIzlemeService.getIzlemeData()
        .then((v) => { setVezne(v); setVezneHata(""); })
        .catch((e) => setVezneHata(e?.message || "Vezne bakiyeleri alınamadı.")),
      Promise.all([EBankaService.getOzet(), EBankaService.getHareketler({ baslangic: g, bitis: g, sayfa: 1, sayfaBoyutu: 8 })])
        .then(([o, h]) => { setBanka(o); setHareketler(h); setBankaHata(""); })
        .catch((e) => setBankaHata(e?.message || "Banka bilgileri alınamadı.")),
    ]);
    setYukleniyor(false);
  }, []);

  useEffect(() => { yenile(); }, [yenile]);

  const vezneSatirlari = (vezne?.rows || []).filter((r) => Math.abs(r.toplam) >= 0.005 || Object.values(r.bakiyeler || {}).some((m) => Math.abs(Number(m)) >= 0.005));
  const vezneler = vezne?.columns || [];
  const hesaplar = (banka?.hesaplar || []).filter((h) => h.aktif && Math.abs(h.bakiye) >= 0.005);

  const baslik = (ikon: React.ReactNode, ad: string, alt: string, yol: string) => (
    <Card.Header className="bg-white d-flex align-items-center gap-2 py-2">
      {ikon}
      <span className="fw-bold">{ad}</span>
      <span className="text-muted small">{alt}</span>
      <Button size="sm" variant="link" className="ms-auto p-0 text-decoration-none" onClick={() => navigate(yol)}>
        Ayrıntı <IconChevronRight size={14} />
      </Button>
    </Card.Header>
  );

  return (
    <div className="w-100 pb-3">
      <div className="d-flex align-items-center mb-2">
        <span className="fw-bold">Genel Durum</span>
        <Button size="sm" variant="light" className="border ms-auto" disabled={yukleniyor} onClick={yenile}>
          {yukleniyor ? <Spinner size="sm" /> : <IconRefresh size={16} />} <span className="ms-1">Yenile</span>
        </Button>
      </div>
      <Row className="g-3">
        <Col lg={6}>
          <Card className="border shadow-sm h-100">
            {baslik(<IconCash size={18} className="text-success" />, "Vezneler", `${vezneler.length} vezne`, "/vezne/izleme")}
            <Card.Body className="p-0">
              {vezneHata ? (
                <div className="text-danger small p-3">{vezneHata}</div>
              ) : (
                <Table size="sm" hover responsive className="mb-0 small align-middle">
                  <thead className="table-light">
                    <tr>
                      <th>Birim</th>
                      {vezneler.map((v) => <th key={v.vezneId} className="text-end text-nowrap">{v.ad || v.kod}</th>)}
                      <th className="text-end">Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vezneSatirlari.map((r) => (
                      <tr key={r.paraId} style={{ cursor: "pointer" }} onClick={() => navigate("/vezne/izleme")}>
                        <td className="fw-bold">{r.paraKodu}</td>
                        {vezneler.map((v) => {
                          const m = Number(r.bakiyeler?.[v.vezneId]) || 0;
                          return <td key={v.vezneId} className={`text-end font-monospace ${m < 0 ? "text-danger" : ""}`}>{m ? paraYaz(m) : ""}</td>;
                        })}
                        <td className={`text-end font-monospace fw-bold ${r.toplam < 0 ? "text-danger" : ""}`}>{paraYaz(r.toplam)}</td>
                      </tr>
                    ))}
                    {vezne && vezneSatirlari.length === 0 && (
                      <tr><td colSpan={vezneler.length + 2} className="text-center text-muted py-3">Veznelerde bakiye yok.</td></tr>
                    )}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="border shadow-sm h-100">
            {baslik(<IconBuildingBank size={18} className="text-primary" />, "Banka", banka?.sonEsitleme ? `son eşitleme ${zamanYaz(banka.sonEsitleme)}` : "", "/ebanka/ozet")}
            <Card.Body className="p-0">
              {bankaHata ? (
                <div className="text-muted small p-3">{bankaHata}</div>
              ) : (
                <>
                  {(banka?.toplamlar || []).length > 0 && (
                    <div className="d-flex flex-wrap gap-2 p-2 border-bottom">
                      {banka!.toplamlar.map((t) => (
                        <Badge key={t.doviz} bg="light" text="dark" className="border px-2 py-1 font-monospace">
                          {paraYaz(t.bakiye)} {t.doviz}
                        </Badge>
                      ))}
                      {banka!.bekleyen > 0 && (
                        <Badge bg="warning" text="dark" className="px-2 py-1" style={{ cursor: "pointer" }} onClick={() => navigate("/ebanka/bekleyenler")}>
                          {banka!.bekleyen} bekleyen hareket
                        </Badge>
                      )}
                    </div>
                  )}
                  <Table size="sm" hover responsive className="mb-0 small align-middle">
                    <thead className="table-light">
                      <tr><th>Hesap</th><th className="text-end">Bakiye</th></tr>
                    </thead>
                    <tbody>
                      {hesaplar.map((h) => (
                        <tr key={h.vomsisHesapId} style={{ cursor: "pointer" }} onClick={() => navigate("/ebanka/hesaplar")}>
                          <td>{h.bankaAdi} {h.doviz} <span className="text-muted">{h.hesapNo || ""}</span></td>
                          <td className={`text-end font-monospace fw-bold ${h.bakiye < 0 ? "text-danger" : ""}`}>{paraYaz(h.bakiye)} {h.doviz}</td>
                        </tr>
                      ))}
                      {banka && hesaplar.length === 0 && <tr><td colSpan={2} className="text-center text-muted py-2">Bakiyesi olan hesap yok.</td></tr>}
                    </tbody>
                  </Table>
                  <div className="fw-bold text-secondary small px-2 pt-2">
                    Bugünkü hareketler {hareketler ? `(${hareketler.toplam})` : ""}
                  </div>
                  <Table size="sm" hover responsive className="mb-0 small align-middle">
                    <tbody>
                      {(hareketler?.satirlar || []).map((h) => (
                        <tr key={h.vomsisId} style={{ cursor: "pointer" }} onClick={() => navigate("/ebanka/hareketler")}>
                          <td className="font-monospace text-nowrap">{zamanYaz(h.sistemTarihi).slice(-5)}</td>
                          <td className="text-truncate" style={{ maxWidth: 220 }} title={h.aciklama || ""}>{h.karsiUnvan || h.gonderenUnvan || h.aciklama || h.bankaAdi}</td>
                          <td className={`text-end font-monospace fw-bold text-nowrap ${h.tutar < 0 ? "text-danger" : "text-success"}`}>
                            {h.tutar < 0 ? "" : "+"}{paraYaz(h.tutar)} {h.doviz}
                          </td>
                        </tr>
                      ))}
                      {hareketler && hareketler.satirlar.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-2">Bugün banka hareketi yok.</td></tr>}
                    </tbody>
                  </Table>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default HomePage;

import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { IconRefresh } from "@tabler/icons-react";
import { panelApi, RaporSatiri } from "../services/panelApi";

const iki = (n: number) => String(n).padStart(2, "0");
const gun = (d: Date) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;

/** Dakikayı "2 sa 15 dk" / "3 gün 4 sa" biçiminde yazar */
const sureYaz = (dk: number | null): string => {
  if (dk === null || dk === undefined) return "-";
  if (dk < 60) return `${dk} dk`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} sa ${dk % 60} dk`;
  return `${Math.floor(sa / 24)} gün ${sa % 24} sa`;
};

/** Destek admini > Rapor (D17): kişi başı açık / kapanan / ilk cevap süresi. */
const RaporPage: React.FC = () => {
  const bugun = new Date();
  const ayBasi = new Date(bugun.getFullYear(), bugun.getMonth(), 1);
  const [bas, setBas] = useState(gun(ayBasi));
  const [bit, setBit] = useState(gun(bugun));
  const [veri, setVeri] = useState<{ satirlar: RaporSatiri[]; genel: { havuz: number; acik: number; yeni: number; kapanan: number; ortIlkCevapDk: number | null } } | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      setVeri(await panelApi.rapor(bas, bit));
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Rapor alınamadı.");
    } finally {
      setYukleniyor(false);
    }
  }, [bas, bit]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const kart = (baslik: string, deger: React.ReactNode, aciklama: string) => (
    <Col xs={6} md>
      <div className="dsp-rapor-kart">
        <div className="small text-muted">{baslik}</div>
        <div className="fs-4 fw-semibold">{deger}</div>
        <div className="small text-muted">{aciklama}</div>
      </div>
    </Col>
  );

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <h5 className="mb-0">Rapor</h5>
          <div className="d-flex gap-2 align-items-center">
            <Form.Control size="sm" type="date" value={bas} max={bit} onChange={(e) => setBas(e.target.value)} />
            <span>–</span>
            <Form.Control size="sm" type="date" value={bit} min={bas} onChange={(e) => setBit(e.target.value)} />
            <Button size="sm" variant="outline-secondary" onClick={yukle} title="Yenile">
              {yukleniyor ? <Spinner size="sm" /> : <IconRefresh size={16} />}
            </Button>
          </div>
        </div>
        {hata && <Alert variant="danger">{hata}</Alert>}
        {veri && (
          <>
            <Row className="g-2 mb-3">
              {kart("Havuzda bekleyen", veri.genel.havuz, "şu an, atanmamış")}
              {kart("Açık talep", veri.genel.acik, "şu an, kapalı olmayan")}
              {kart("Yeni talep", veri.genel.yeni, "seçili aralıkta")}
              {kart("Kapanan", veri.genel.kapanan, "seçili aralıkta, hâlâ kapalı")}
              {kart("Ort. ilk cevap", sureYaz(veri.genel.ortIlkCevapDk), "seçili aralıkta")}
            </Row>
            <Table hover size="sm" className="align-middle mb-0" responsive>
              <thead>
                <tr>
                  <th>Personel</th>
                  <th className="text-end" title="Şu an üzerindeki kapalı olmayan talepler">
                    Açık (şu an)
                  </th>
                  <th className="text-end" title="Aralıkta kapattığı ve hâlâ kapalı olan talepler">
                    Kapattığı
                  </th>
                  <th className="text-end" title="Aralıkta ilk cevabı verdiği talepler">
                    İlk cevap verdiği
                  </th>
                  <th className="text-end">Ort. ilk cevap süresi</th>
                  <th className="text-end" title="Müşteriye yazdığı mesaj (iç not hariç)">
                    Mesaj
                  </th>
                </tr>
              </thead>
              <tbody>
                {veri.satirlar.map((s) => (
                  <tr key={s.personelId} className={s.durum !== "AKTIF" ? "text-muted" : ""}>
                    <td>
                      {s.adSoyad}
                      {s.rol === "ADMIN" && <span className="small text-muted"> · admin</span>}
                      {s.durum !== "AKTIF" && <span className="small"> · pasif</span>}
                    </td>
                    <td className="text-end">{s.acik}</td>
                    <td className="text-end">{s.kapanan}</td>
                    <td className="text-end">{s.ilkCevap}</td>
                    <td className="text-end">{sureYaz(s.ortIlkCevapDk)}</td>
                    <td className="text-end">{s.mesaj}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="small text-muted mt-2">Telefon talepleri ilk cevap süresine girmez. Yeniden açılan talep "kapattığı" sayısından düşer.</div>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default RaporPage;

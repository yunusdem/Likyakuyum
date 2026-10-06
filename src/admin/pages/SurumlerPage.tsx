import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Spinner, Table } from "react-bootstrap";
import { adminApi, SurumDto, tarihYaz } from "../services/adminApi";

/** Yayınlanan sürüm paketleri (sunucuda her deploy'dan sonra: npm run surum:yayinla). */
const SurumlerPage: React.FC = () => {
  const [liste, setListe] = useState<SurumDto[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .surumler()
      .then(setListe)
      .catch((e) => setHata(e?.message || "Sürümler getirilemedi."));
  }, []);

  const degistir = async (s: SurumDto) => {
    setMesgul(s.surum);
    setHata(null);
    try {
      setListe(await adminApi.surumGuncelle(s.surum, { aktif: !s.aktif }));
    } catch (e: any) {
      setHata(e?.message || "Değiştirilemedi.");
    } finally {
      setMesgul(null);
    }
  };

  const enSon = liste?.find((s) => s.aktif)?.surum;

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-4">
        <h5 className="mb-1">Sürümler</h5>
        <p className="text-muted small mb-3">
          Kurulum (exe) programları internet bağlantısında en son aktif sürümü (ya da firmaya sabitlenen sürümü) indirir ve gece
          uygular. Sorunlu bir sürümü pasife alırsanız programlar bir önceki aktif sürüme döner.
        </p>
        {hata && <Alert variant="danger">{hata}</Alert>}
        {!liste ? (
          <Spinner animation="border" />
        ) : liste.length === 0 ? (
          <div className="text-muted">Henüz sürüm yayınlanmamış. Sunucuda Backend klasöründe: npm run surum:yayinla</div>
        ) : (
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Sürüm</th>
                <th>Yayın</th>
                <th>Boyut</th>
                <th>Şema</th>
                <th>Kurulum</th>
                <th>Not</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {liste.map((s) => (
                <tr key={s.surum} className={s.aktif ? "" : "text-muted"}>
                  <td className="fw-semibold">
                    {s.surum} {s.surum === enSon && <Badge bg="success">En son</Badge>} {!s.aktif && <Badge bg="secondary">Pasif</Badge>}
                  </td>
                  <td>{tarihYaz(s.yayinTarihi)}</td>
                  <td>{(s.boyut / 1024 / 1024).toFixed(1)} MB</td>
                  <td>{s.semaSurumu ?? "-"}</td>
                  <td>
                    {s.kurulumSayisi}
                    {s.sabitFirmaSayisi > 0 && <span className="text-muted small"> ({s.sabitFirmaSayisi} sabit)</span>}
                  </td>
                  <td style={{ maxWidth: 280 }}>{s.notlar || "-"}</td>
                  <td>
                    <Button size="sm" variant={s.aktif ? "outline-secondary" : "outline-success"} disabled={mesgul === s.surum} onClick={() => degistir(s)}>
                      {s.aktif ? "Pasife Al" : "Aktif Et"}
                    </Button>
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

export default SurumlerPage;

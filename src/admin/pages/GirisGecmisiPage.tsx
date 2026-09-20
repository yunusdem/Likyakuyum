import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Card, Form, Spinner, Table } from "react-bootstrap";
import { adminApi, GirisLogu, tarihYaz } from "../services/adminApi";
import Sayfalama from "../components/Sayfalama";

const BOYUT = 50;

/** Başarılı ve başarısız tüm giriş denemeleri (kullanıcılar ve adminler). */
const GirisGecmisiPage: React.FC = () => {
  const [satirlar, setSatirlar] = useState<GirisLogu[] | null>(null);
  const [toplam, setToplam] = useState(0);
  const [sayfa, setSayfa] = useState(1);
  const [arama, setArama] = useState("");
  const [tur, setTur] = useState("");
  const [basarili, setBasarili] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    // Yazarken her tuşta istek atmamak için kısa gecikme
    const zamanlayici = window.setTimeout(async () => {
      try {
        const sonuc = await adminApi.girisLoglari({ sayfa, boyut: BOYUT, arama: arama.trim(), tur, basarili });
        if (iptal) return;
        setSatirlar(sonuc.satirlar);
        setToplam(sonuc.toplam);
        setHata(null);
      } catch (err: any) {
        if (!iptal) setHata(err?.message || "Giriş geçmişi getirilemedi.");
      }
    }, 300);
    return () => {
      iptal = true;
      window.clearTimeout(zamanlayici);
    };
  }, [sayfa, arama, tur, basarili]);

  const filtre = (ayarla: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    ayarla(e.target.value);
    setSayfa(1);
  };

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h5 className="mb-0">Giriş Geçmişi</h5>
          <div className="d-flex flex-wrap gap-2">
            <Form.Control size="sm" style={{ width: 220 }} placeholder="Kullanıcı adı veya IP…" value={arama} onChange={filtre(setArama)} />
            <Form.Select size="sm" style={{ width: 150 }} value={tur} onChange={filtre(setTur)}>
              <option value="">Herkes</option>
              <option value="KULLANICI">Kullanıcılar</option>
              <option value="ADMIN">Adminler</option>
            </Form.Select>
            <Form.Select size="sm" style={{ width: 150 }} value={basarili} onChange={filtre(setBasarili)}>
              <option value="">Tüm sonuçlar</option>
              <option value="true">Başarılı</option>
              <option value="false">Başarısız</option>
            </Form.Select>
          </div>
        </div>

        {hata && <Alert variant="danger">{hata}</Alert>}

        {satirlar === null ? (
          !hata && (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          )
        ) : satirlar.length === 0 ? (
          <div className="text-muted py-3">Kayıt yok.</div>
        ) : (
          <>
            <Table hover responsive size="sm" className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Kullanıcı</th>
                  <th>Firma</th>
                  <th>Sonuç</th>
                  <th>IP</th>
                  <th>Tarayıcı</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((g) => (
                  <tr key={g.logId}>
                    <td className="text-nowrap">{tarihYaz(g.tarih)}</td>
                    <td>
                      {g.kullaniciAdi || "-"}
                      {g.tur === "ADMIN" && (
                        <Badge bg="dark" className="ms-2">
                          Admin
                        </Badge>
                      )}
                    </td>
                    <td>
                      {g.firmaId ? (
                        <Link to={`/firmalar/${g.firmaId}`} className="text-decoration-none">
                          {g.firmaUnvan}
                        </Link>
                      ) : (
                        <span className="text-muted">{g.tur === "ADMIN" ? "Yönetim paneli" : "-"}</span>
                      )}
                    </td>
                    <td>
                      {g.basarili ? (
                        <Badge bg="success">Başarılı</Badge>
                      ) : (
                        <>
                          <Badge bg="danger">Başarısız</Badge>
                          <span className="text-muted small ms-2">{g.redNedeni}</span>
                        </>
                      )}
                    </td>
                    <td>{g.ip || "-"}</td>
                    <td className="text-muted small" style={{ maxWidth: 240 }} title={g.tarayici || undefined}>
                      <div className="text-truncate">{g.tarayici || "-"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Sayfalama sayfa={sayfa} boyut={BOYUT} toplam={toplam} degistir={setSayfa} />
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default GirisGecmisiPage;

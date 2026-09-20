import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Card, Form, Table } from "react-bootstrap";
import { IconSearch } from "@tabler/icons-react";
import { adminApi, FirmaDto, FirmaDurum } from "../services/adminApi";
import { DurumRozeti, LisansRozeti } from "./FirmaRozetleri";

/** Durumun sayı karşılığı: 1 = Aktif, 0 = Pasif, 2 = Dondurulmuş */
const DURUM_KODU: Record<FirmaDurum, number> = { AKTIF: 1, PASIF: 0, DONDURULMUS: 2 };

const kucult = (v: string | null | undefined) => (v || "").toLocaleLowerCase("tr");

/**
 * Pano'daki müşteri no sorgusu: admin müşteri noyu (ya da firma kodunu / unvanını) yazar; eşleşen firmanın
 * durumu (1 / 0 / 2), program türü, lisansı ve kullanıcı sayısı hemen altında görünür. Yalnızca yönetim panelinde çalışır.
 */
const MusteriSorgu: React.FC = () => {
  const navigate = useNavigate();
  const [firmalar, setFirmalar] = useState<FirmaDto[]>([]);
  const [arama, setArama] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .firmalar()
      .then(setFirmalar)
      .catch((err) => setHata(err?.message || "Firmalar getirilemedi."));
  }, []);

  const sonuc = useMemo(() => {
    const q = kucult(arama.trim());
    if (!q) return [];
    return firmalar
      .filter((f) => [f.musteriNo, f.firmaKodu, f.unvan].some((v) => kucult(v).includes(q)))
      // Müşteri nosu tam eşleşen en üstte
      .sort((a, b) => Number(kucult(b.musteriNo) === q) - Number(kucult(a.musteriNo) === q))
      .slice(0, 20);
  }, [firmalar, arama]);

  return (
    <Card className="shadow-sm mb-3">
      <Card.Body>
        <div className="d-flex flex-wrap align-items-center gap-3">
          <h6 className="mb-0">Müşteri No ile Sorgula</h6>
          <div className="position-relative flex-grow-1" style={{ maxWidth: 360 }}>
            <IconSearch size={16} className="position-absolute text-muted" style={{ left: 10, top: 9 }} />
            <Form.Control
              size="sm"
              style={{ paddingLeft: 32 }}
              placeholder="ör. D20AC0001 — firma kodu ya da unvan da yazılabilir"
              value={arama}
              onChange={(e) => setArama(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {hata && (
          <Alert variant="danger" className="mt-3 mb-0">
            {hata}
          </Alert>
        )}

        {arama.trim() !== "" && !hata && (
          <div className="mt-3">
            {sonuc.length === 0 ? (
              <div className="text-muted small">Bu müşteri no / ad ile kayıtlı firma yok.</div>
            ) : (
              <Table hover responsive size="sm" className="align-middle mb-0">
                <thead>
                  <tr>
                    <th>Müşteri No</th>
                    <th>Firma</th>
                    <th>Durum</th>
                    <th>Prg. türü</th>
                    <th>Lisans bitiş</th>
                    <th>Kullanıcı</th>
                  </tr>
                </thead>
                <tbody>
                  {sonuc.map((f) => (
                    <tr key={f.firmaId} role="button" onClick={() => navigate(`/firmalar/${f.firmaId}`)}>
                      <td className="fw-semibold">{f.musteriNo || <span className="text-danger small">tanımlı değil</span>}</td>
                      <td>
                        {f.unvan} <span className="text-muted small">{f.firmaKodu}</span>
                      </td>
                      <td className="text-nowrap">
                        <span className="fw-semibold me-2">{DURUM_KODU[f.durum]}</span>
                        <DurumRozeti durum={f.durum} />
                      </td>
                      <td>{f.prgTur}</td>
                      <td>
                        <LisansRozeti firma={f} />
                      </td>
                      <td>
                        {f.kullaniciSayisi}
                        {f.aktifLisans ? ` / ${f.aktifLisans.kullaniciLimiti}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default MusteriSorgu;

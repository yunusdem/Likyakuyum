import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Card, Form, Spinner } from "react-bootstrap";
import { adminApi, KullaniciDto } from "../services/adminApi";
import KullaniciTablosu from "../components/KullaniciTablosu";

/** Tüm firmaların kullanıcıları. Yeni kullanıcı ve içe aktarma, firmanın kendi sayfasındaki Kullanıcılar sekmesindedir. */
const KullanicilarPage: React.FC = () => {
  const [kullanicilar, setKullanicilar] = useState<KullaniciDto[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [arama, setArama] = useState("");
  const [durum, setDurum] = useState<"HEPSI" | "AKTIF" | "PASIF">("HEPSI");

  const yukle = useCallback(async () => {
    try {
      setKullanicilar(await adminApi.kullanicilar());
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Kullanıcılar getirilemedi.");
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    return (kullanicilar || []).filter(
      (k) =>
        (durum === "HEPSI" || k.durum === durum) &&
        (q === "" || [k.kullaniciAdi, k.adSoyad, k.firmaUnvan, k.firmaKodu].some((v) => (v || "").toLocaleLowerCase("tr").includes(q)))
    );
  }, [kullanicilar, arama, durum]);

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h5 className="mb-0">Kullanıcılar</h5>
            {kullanicilar && <small className="text-muted">{gorunen.length} / {kullanicilar.length}</small>}
          </div>
          <div className="d-flex flex-wrap gap-2">
            <Form.Control size="sm" style={{ width: 240 }} placeholder="Kullanıcı, ad, firma…" value={arama} onChange={(e) => setArama(e.target.value)} />
            <Form.Select size="sm" style={{ width: 150 }} value={durum} onChange={(e) => setDurum(e.target.value as typeof durum)}>
              <option value="HEPSI">Tüm durumlar</option>
              <option value="AKTIF">Aktif</option>
              <option value="PASIF">Pasif</option>
            </Form.Select>
          </div>
        </div>

        {hata && <Alert variant="danger">{hata}</Alert>}
        {kullanicilar === null ? (
          !hata && (
            <div className="text-center py-4">
              <Spinner animation="border" />
            </div>
          )
        ) : (
          <KullaniciTablosu kullanicilar={gorunen} firmaSutunu yenile={yukle} />
        )}
      </Card.Body>
    </Card>
  );
};

export default KullanicilarPage;

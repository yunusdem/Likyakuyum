import React, { useEffect, useState } from "react";
import { Alert, Button, Form, Spinner } from "react-bootstrap";
import { adminApi, FirmaDto, PosMod } from "../services/adminApi";

const MODLAR: { mod: PosMod; ad: string; aciklama: string }[] = [
  { mod: "kapali", ad: "Kapalı", aciklama: "Fişlerde POS satırı bugünkü gibi elle çalışır; cihaza hiçbir şey gönderilmez." },
  { mod: "test", ad: "Test (örnek cihaz)", aciklama: "Ekranlar örnek cihazla çalışır; gerçek cihaza ve bankaya hiçbir şey gitmez." },
  { mod: "canli", ad: "Canlı", aciklama: "Tutar gerçek cihaza gönderilir ve karttan çekilir." },
];

/** Firma Detay > POS sekmesi. Firmanın POS cihazı entegrasyon modu yalnızca buradan değişir; firma kendi tarafında değiştiremez. */
const FirmaPos: React.FC<{ firma: FirmaDto }> = ({ firma }) => {
  const [kayitli, setKayitli] = useState<PosMod | null>(null);
  const [secili, setSecili] = useState<PosMod>("kapali");
  const [tablolarKurulu, setTablolarKurulu] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  useEffect(() => {
    let iptal = false;
    (async () => {
      try {
        const s = await adminApi.firmaPosModu(firma.firmaId);
        if (iptal) return;
        setKayitli(s.mod);
        setSecili(s.mod);
        setTablolarKurulu(s.tablolarKurulu);
      } catch (err: any) {
        if (!iptal) setHata(err?.message || "POS modu getirilemedi.");
      }
    })();
    return () => {
      iptal = true;
    };
  }, [firma.firmaId]);

  const kaydet = async () => {
    setKaydediliyor(true);
    setHata(null);
    try {
      const s = await adminApi.firmaPosModuYaz(firma.firmaId, secili);
      setKayitli(s.mod);
      setSecili(s.mod);
      setBilgi("POS modu kaydedildi. Değişiklik en geç yarım dakika içinde firmanın ekranlarına yansır.");
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  if (kayitli === null) {
    return hata ? (
      <Alert variant="danger">{hata}</Alert>
    ) : (
      <div className="text-center py-4">
        <Spinner animation="border" />
      </div>
    );
  }

  return (
    <>
      {hata && <Alert variant="danger">{hata}</Alert>}
      {bilgi && (
        <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
          {bilgi}
        </Alert>
      )}
      {!tablolarKurulu && (
        <Alert variant="warning">
          POS tabloları merkez veritabanında kurulmamış. Sunucuda <code>docs/sql/LIKYA_ADMIN_POS.sql</code> betiği çalıştırılana kadar her firma Kapalı davranır.
        </Alert>
      )}

      <div className="mb-3">
        {MODLAR.map((m) => (
          <Form.Check
            key={m.mod}
            type="radio"
            name={`pos-mod-${firma.firmaId}`}
            id={`pos-mod-${firma.firmaId}-${m.mod}`}
            className="mb-2"
            checked={secili === m.mod}
            disabled={!tablolarKurulu}
            onChange={() => {
              setSecili(m.mod);
              setBilgi(null);
            }}
            label={
              <>
                <span className="fw-semibold">{m.ad}</span>
                <div className="text-muted small">{m.aciklama}</div>
              </>
            }
          />
        ))}
      </div>

      <Button size="sm" className="btn-adm" disabled={!tablolarKurulu || secili === kayitli || kaydediliyor} onClick={kaydet}>
        {kaydediliyor ? <Spinner animation="border" size="sm" /> : "Kaydet"}
      </Button>
    </>
  );
};

export default FirmaPos;

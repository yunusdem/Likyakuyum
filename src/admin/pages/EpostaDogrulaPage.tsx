import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Alert, Button, Card, Spinner } from "react-bootstrap";
import { adminApi } from "../services/adminApi";

/**
 * Firmanın, doğrulama mailindeki bağlantıyla açtığı sayfa (oturum gerekmez). Doğrulama sayfa açılınca DEĞİL, düğmeye
 * basılınca yapılır: mail güvenlik tarayıcıları bağlantıları önceden açtığı için, açılışta doğrulamak adresi sahibi
 * görmeden "doğrulanmış" yapardı.
 */
const EpostaDogrulaPage: React.FC = () => {
  const [params] = useSearchParams();
  const anahtar = params.get("t") || "";
  const [bekliyor, setBekliyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [sonuc, setSonuc] = useState<{ unvan: string; eposta: string } | null>(null);

  const dogrula = async () => {
    setBekliyor(true);
    setHata(null);
    try {
      setSonuc(await adminApi.epostaOnayla(anahtar));
    } catch (err: any) {
      setHata(err?.message || "Doğrulama yapılamadı.");
    } finally {
      setBekliyor(false);
    }
  };

  return (
    <div className="adm-giris">
      <Card className="shadow-sm" style={{ maxWidth: 440 }}>
        <Card.Body className="p-4">
          <h4 className="mb-1">Likya Kuyum</h4>
          <div className="text-muted mb-4">E-posta doğrulaması</div>

          {sonuc ? (
            <Alert variant="success" className="mb-0">
              <strong>{sonuc.eposta}</strong> adresi <strong>{sonuc.unvan}</strong> için doğrulandı. Bu sayfayı kapatabilirsiniz.
            </Alert>
          ) : !anahtar ? (
            <Alert variant="danger" className="mb-0">
              Bağlantı eksik. Lütfen maildeki bağlantıyı olduğu gibi açın.
            </Alert>
          ) : (
            <>
              {hata && <Alert variant="danger">{hata}</Alert>}
              <p>Bu e-posta adresinin size ait olduğunu onaylamak için aşağıdaki düğmeye basın.</p>
              <Button className="btn-adm w-100" disabled={bekliyor} onClick={dogrula}>
                {bekliyor ? <Spinner animation="border" size="sm" /> : "E-posta adresimi doğrula"}
              </Button>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default EpostaDogrulaPage;

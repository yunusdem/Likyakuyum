import React, { useEffect, useState } from "react";
import { Alert, Button, Spinner } from "react-bootstrap";
import { adminApi, FirmaDto, MailDurumu, tarihYaz } from "../services/adminApi";
import { EpostaRozeti } from "./FirmaRozetleri";

interface Props {
  firma: FirmaDto;
  firmaGuncellendi: (firma: FirmaDto) => void;
  bildir: (mesaj: string) => void;
}

/**
 * Doğrulama sekmesi > E-posta doğrulaması. Firma kimlik onayından (VKN / unvan, elle) ayrıdır:
 * burada doğrulanan, kayıtlı e-posta adresinin gerçekten firmaya ait olduğudur. Firma maildeki bağlantıyla
 * doğrular; admin de elle işaretleyebilir ya da doğrulamayı kaldırabilir.
 */
const FirmaEpostaDogrulama: React.FC<Props> = ({ firma, firmaGuncellendi, bildir }) => {
  const [mail, setMail] = useState<MailDurumu | null>(null);
  const [mesgul, setMesgul] = useState<"gonder" | "elle" | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .mailDurumu()
      .then(setMail)
      .catch(() => setMail(null));
  }, []);

  const calistir = async (tur: "gonder" | "elle", is: () => Promise<FirmaDto>, mesaj: string) => {
    setMesgul(tur);
    setHata(null);
    try {
      firmaGuncellendi(await is());
      bildir(mesaj);
    } catch (err: any) {
      setHata(err?.message || "İşlem yapılamadı.");
    } finally {
      setMesgul(null);
    }
  };

  return (
    <>
      <h6>
        E-posta doğrulaması <EpostaRozeti firma={firma} />
      </h6>
      <div className="small mb-2">
        {firma.eposta ? (
          <>
            Adres: <strong>{firma.eposta}</strong>
          </>
        ) : (
          <span className="text-danger">Firmanın e-posta adresi tanımlı değil (Bilgi & Bağlantı sekmesinden girin).</span>
        )}
        {firma.epostaDogrulandi && (
          <div className="text-muted">
            Doğrulandı: {tarihYaz(firma.epostaDogrulamaTarihi)} ·{" "}
            {firma.epostaDogrulamaKaynak === "MAIL" ? "firma maildeki bağlantıyla doğruladı" : "admin elle işaretledi"}
          </div>
        )}
        {!firma.epostaDogrulandi && firma.epostaSonGonderim && (
          <div className="text-muted">
            Son gönderim: {tarihYaz(firma.epostaSonGonderim)}
            {firma.epostaBaglantiBitis
              ? ` · bağlantı ${tarihYaz(firma.epostaBaglantiBitis)} tarihine kadar geçerli, firma henüz doğrulamadı`
              : " · bağlantının süresi doldu ya da iptal edildi"}
          </div>
        )}
      </div>

      {hata && <Alert variant="danger">{hata}</Alert>}
      {mail && !mail.yapilandirildi && (
        <Alert variant="warning" className="small">
          Mail ayarı yapılmamış: doğrulama maili gönderilemez. Sunucudaki <code>Backend\.env.local</code> dosyasına{" "}
          <code>SMTP_HOST</code>, <code>SMTP_PORT</code>, <code>SMTP_USER</code>, <code>SMTP_PASSWORD</code> ve{" "}
          <code>SMTP_FROM</code> satırlarını ekleyip backend'i yeniden başlatın. O zamana kadar elle işaretleyebilirsiniz.
        </Alert>
      )}

      <div className="d-flex flex-wrap gap-2">
        {!firma.epostaDogrulandi && (
          <Button
            size="sm"
            className="btn-adm"
            disabled={!!mesgul || !firma.eposta || !mail?.yapilandirildi}
            onClick={() =>
              calistir(
                "gonder",
                () => adminApi.epostaDogrulamaGonder(firma.firmaId),
                `Doğrulama maili ${firma.eposta} adresine gönderildi. Bağlantı ${mail?.gecerlilikSaat ?? 48} saat geçerli.`
              )
            }
          >
            {mesgul === "gonder" ? (
              <Spinner animation="border" size="sm" />
            ) : firma.epostaSonGonderim ? (
              "Doğrulama Mailini Yeniden Gönder"
            ) : (
              "Doğrulama Maili Gönder"
            )}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline-secondary"
          disabled={!!mesgul || (!firma.epostaDogrulandi && !firma.eposta)}
          onClick={() =>
            calistir(
              "elle",
              () => adminApi.epostaDogrulamaElle(firma.firmaId, !firma.epostaDogrulandi),
              firma.epostaDogrulandi ? "E-posta doğrulaması kaldırıldı." : "E-posta elle doğrulanmış olarak işaretlendi."
            )
          }
        >
          {mesgul === "elle" ? (
            <Spinner animation="border" size="sm" />
          ) : firma.epostaDogrulandi ? (
            "E-posta Doğrulamasını Kaldır"
          ) : (
            "Elle Doğrulanmış İşaretle"
          )}
        </Button>
      </div>
      {mail?.yapilandirildi && <div className="text-muted small mt-2">Gönderen: {mail.gonderen}</div>}
    </>
  );
};

export default FirmaEpostaDogrulama;

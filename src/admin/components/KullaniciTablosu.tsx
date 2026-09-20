import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Form, Modal, Table } from "react-bootstrap";
import { adminApi, KullaniciDto, tarihYaz } from "../services/adminApi";

interface Props {
  kullanicilar: KullaniciDto[];
  /** Tüm firmaların listelendiği ekranda firma sütunu gösterilir */
  firmaSutunu?: boolean;
  /** Bir işlem sonrası listeyi (ve firma sayılarını) tazelemek için */
  yenile: () => Promise<void> | void;
}

/** Firma kullanıcıları tablosu: aktif/pasif, firma yöneticisi ve şifre sıfırlama işlemleriyle. */
const KullaniciTablosu: React.FC<Props> = ({ kullanicilar, firmaSutunu, yenile }) => {
  const [hata, setHata] = useState<string | null>(null);
  const [islemde, setIslemde] = useState<number | null>(null);
  const [onay, setOnay] = useState<{ metin: string; calistir: () => Promise<void> } | null>(null);
  const [geciciSifre, setGeciciSifre] = useState<{ kullaniciAdi: string; sifre: string; uyari?: string } | null>(null);

  const islemYap = async (kullaniciId: number, is: () => Promise<void>) => {
    setIslemde(kullaniciId);
    setHata(null);
    try {
      await is();
      await yenile();
    } catch (err: any) {
      setHata(err?.message || "İşlem yapılamadı.");
    } finally {
      setIslemde(null);
    }
  };

  const durumDegistir = (k: KullaniciDto) => {
    const hedef = k.durum === "AKTIF" ? "PASIF" : "AKTIF";
    setOnay({
      metin:
        hedef === "PASIF"
          ? `${k.kullaniciAdi} pasife alınsın mı? Kullanıcı giriş yapamaz; verileri durur.`
          : `${k.kullaniciAdi} yeniden aktif edilsin mi?`,
      calistir: () => islemYap(k.kullaniciId, async () => void (await adminApi.kullaniciGuncelle(k.kullaniciId, { durum: hedef }))),
    });
  };

  const sifreSifirla = (k: KullaniciDto) =>
    setOnay({
      metin: `${k.kullaniciAdi} için şifre sıfırlansın mı? Mevcut şifresi geçersiz olur.`,
      calistir: () =>
        islemYap(k.kullaniciId, async () => {
          const sonuc = await adminApi.kullaniciSifreSifirla(k.kullaniciId);
          setGeciciSifre({
            kullaniciAdi: k.kullaniciAdi,
            sifre: sonuc.geciciSifre,
            uyari: sonuc.firmaDbEsitlendi
              ? undefined
              : "Firma veritabanına ulaşılamadığı için oradaki eski şifre alanı güncellenemedi. Giriş merkezden doğrulandığı için yeni şifre geçerlidir.",
          });
        }),
    });

  if (kullanicilar.length === 0) return <div className="text-muted py-3">Kullanıcı yok.</div>;

  return (
    <>
      {hata && <Alert variant="danger">{hata}</Alert>}
      <Table hover responsive className="align-middle mb-0">
        <thead>
          <tr>
            {firmaSutunu && <th>Firma</th>}
            <th>Kullanıcı adı</th>
            <th>Durum</th>
            <th>Firma yöneticisi</th>
            <th>Son giriş</th>
            <th>Kaynak</th>
            <th className="text-end">İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {kullanicilar.map((k) => (
            <tr key={k.kullaniciId} className={k.durum === "PASIF" ? "text-muted" : ""}>
              {firmaSutunu && (
                <td>
                  <Link to={`/firmalar/${k.firmaId}`} className="text-decoration-none">
                    {k.firmaUnvan}
                  </Link>
                  <span className="text-muted small ms-1">{k.firmaKodu}</span>
                </td>
              )}
              <td>
                <span className="fw-semibold">{k.kullaniciAdi}</span>
                {k.adSoyad && <span className="text-muted ms-2">{k.adSoyad}</span>}
              </td>
              <td>
                <Badge bg={k.durum === "AKTIF" ? "success" : "secondary"}>{k.durum === "AKTIF" ? "Aktif" : "Pasif"}</Badge>
                {k.sifreDegismeli && (
                  <Badge bg="warning" text="dark" className="ms-1">
                    Şifre bekliyor
                  </Badge>
                )}
                {!k.sifreTasindi && (
                  <Badge bg="light" text="dark" className="ms-1" title="İçe aktarıldı; ilk girişinde mevcut şifresiyle doğrulanıp merkeze taşınacak">
                    Eski şifre
                  </Badge>
                )}
              </td>
              <td>
                <Form.Check
                  type="switch"
                  id={`yonetici-${k.kullaniciId}`}
                  checked={k.firmaYoneticisi}
                  disabled={islemde === k.kullaniciId}
                  onChange={() =>
                    islemYap(k.kullaniciId, async () => void (await adminApi.kullaniciGuncelle(k.kullaniciId, { firmaYoneticisi: !k.firmaYoneticisi })))
                  }
                />
              </td>
              <td>{tarihYaz(k.sonGiris)}</td>
              <td className="text-muted small">{k.olusturan || "-"}</td>
              <td className="text-end text-nowrap">
                <Button variant="outline-secondary" size="sm" className="me-2" disabled={islemde === k.kullaniciId} onClick={() => sifreSifirla(k)}>
                  Şifre Sıfırla
                </Button>
                <Button
                  variant={k.durum === "AKTIF" ? "outline-danger" : "outline-success"}
                  size="sm"
                  disabled={islemde === k.kullaniciId}
                  onClick={() => durumDegistir(k)}
                >
                  {k.durum === "AKTIF" ? "Pasife Al" : "Aktif Et"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal show={!!onay} onHide={() => setOnay(null)} centered>
        <Modal.Body className="p-4">{onay?.metin}</Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setOnay(null)}>
            Vazgeç
          </Button>
          <Button
            className="btn-adm"
            onClick={() => {
              const calistir = onay?.calistir;
              setOnay(null);
              calistir?.();
            }}
          >
            Evet
          </Button>
        </Modal.Footer>
      </Modal>

      <GeciciSifreModal bilgi={geciciSifre} kapat={() => setGeciciSifre(null)} />
    </>
  );
};

/** Geçici şifre yalnızca bir kez, bu pencerede gösterilir. */
export const GeciciSifreModal: React.FC<{
  bilgi: { kullaniciAdi: string; sifre: string; uyari?: string } | null;
  kapat: () => void;
}> = ({ bilgi, kapat }) => {
  const [kopyalandi, setKopyalandi] = useState(false);
  const kopyala = async () => {
    if (!bilgi) return;
    try {
      await navigator.clipboard.writeText(bilgi.sifre);
      setKopyalandi(true);
    } catch {
      // pano izni yoksa şifre ekrandan elle seçilip kopyalanabilir
    }
  };
  return (
    <Modal show={!!bilgi} onHide={kapat} onExited={() => setKopyalandi(false)} backdrop="static" keyboard={false} centered>
      <Modal.Header>
        <Modal.Title as="h5">Geçici Şifre</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          <strong>{bilgi?.kullaniciAdi}</strong> için geçici şifre:
        </p>
        <div className="adm-gecici-sifre mb-3">{bilgi?.sifre}</div>
        <Alert variant="warning" className="mb-0">
          Bu şifre bir daha gösterilmez. Kişiye güvenli bir yoldan iletin; ilk girişte kendi şifresini belirleyecek.
        </Alert>
        {bilgi?.uyari && (
          <Alert variant="info" className="mt-2 mb-0 small">
            {bilgi.uyari}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={kopyala}>
          {kopyalandi ? "Kopyalandı" : "Kopyala"}
        </Button>
        <Button className="btn-adm" onClick={kapat}>
          Not aldım, kapat
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default KullaniciTablosu;

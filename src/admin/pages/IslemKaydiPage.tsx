import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Card, Form, Spinner, Table } from "react-bootstrap";
import { adminApi, IslemLogu, tarihYaz } from "../services/adminApi";
import Sayfalama from "../components/Sayfalama";

const BOYUT = 50;

const ISLEM_ETIKETI: Record<string, string> = {
  ADMIN_EKLENDI: "Admin eklendi",
  ADMIN_GUNCELLENDI: "Admin güncellendi",
  ADMIN_DURUM: "Admin durumu",
  ADMIN_SIFRE_SIFIRLANDI: "Admin şifresi sıfırlandı",
  ADMIN_SIFRE_DEGISTI: "Admin şifresini değiştirdi",
  FIRMA_EKLENDI: "Firma eklendi",
  FIRMA_GUNCELLENDI: "Firma güncellendi",
  FIRMA_DURUM: "Firma durumu",
  FIRMA_DOGRULAMA: "Firma doğrulaması",
  FIRMA_DB_SIFRE_DEGISTI: "Firma veritabanı şifresi",
  LISANS_EKLENDI: "Lisans eklendi",
  KULLANICI_ACILDI: "Kullanıcı açıldı",
  KULLANICI_GUNCELLENDI: "Kullanıcı güncellendi",
  KULLANICI_DURUM: "Kullanıcı durumu",
  KULLANICI_SIFRE_SIFIRLANDI: "Kullanıcı şifresi sıfırlandı",
  KULLANICI_ICE_AKTARILDI: "Kullanıcılar içe aktarıldı",
  MODUL_DEGISTI: "Modül ayarı",
  MODUL_KATALOG_ESITLENDI: "Modül kataloğu eşitlendi",
  OTURUM_KAPATILDI: "Oturum kapatıldı",
  EPOSTA_DOGRULAMA_GONDERILDI: "Doğrulama maili gönderildi",
  EPOSTA_DOGRULANDI: "E-posta doğrulandı",
  EPOSTA_DOGRULAMA_KALDIRILDI: "E-posta doğrulaması kaldırıldı",
};

/** JSON değerini "alan: değer" satırları olarak yazar; çözülemezse olduğu gibi gösterir. */
const degerYaz = (json: string | null): string => {
  if (!json) return "";
  try {
    const v = JSON.parse(json);
    if (v === null || typeof v !== "object") return String(v);
    return Object.entries(v)
      .filter(([, d]) => d !== null && d !== "" && !(Array.isArray(d) && d.length === 0))
      .map(([k, d]) => `${k}: ${Array.isArray(d) ? d.join(", ") : typeof d === "object" ? JSON.stringify(d) : d}`)
      .join(" · ");
  } catch {
    return json;
  }
};

/** Hangi admin neyi, ne zaman değiştirdi. Kayıtlar silinemez; şifreler hiçbir zaman yazılmaz. */
const IslemKaydiPage: React.FC = () => {
  const [satirlar, setSatirlar] = useState<IslemLogu[] | null>(null);
  const [toplam, setToplam] = useState(0);
  const [sayfa, setSayfa] = useState(1);
  const [arama, setArama] = useState("");
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    const zamanlayici = window.setTimeout(async () => {
      try {
        const sonuc = await adminApi.islemLoglari({ sayfa, boyut: BOYUT, arama: arama.trim() });
        if (iptal) return;
        setSatirlar(sonuc.satirlar);
        setToplam(sonuc.toplam);
        setHata(null);
      } catch (err: any) {
        if (!iptal) setHata(err?.message || "İşlem kaydı getirilemedi.");
      }
    }, 300);
    return () => {
      iptal = true;
      window.clearTimeout(zamanlayici);
    };
  }, [sayfa, arama]);

  const hedefBaglantisi = (i: IslemLogu): React.ReactNode => {
    if (!i.hedefTur) return "-";
    const metin = `${i.hedefTur} #${i.hedefId ?? ""}`;
    return i.hedefTur === "FIRMA" && i.hedefId ? (
      <Link to={`/firmalar/${i.hedefId}`} className="text-decoration-none">
        {metin}
      </Link>
    ) : (
      metin
    );
  };

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-4">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <h5 className="mb-0">İşlem Kaydı</h5>
          <Form.Control
            size="sm"
            style={{ width: 260 }}
            placeholder="İşlem, admin veya içerik…"
            value={arama}
            onChange={(e) => {
              setArama(e.target.value);
              setSayfa(1);
            }}
          />
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
                  <th>Admin</th>
                  <th>İşlem</th>
                  <th>Hedef</th>
                  <th>Önceki</th>
                  <th>Yeni</th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((i) => (
                  <tr key={i.logId}>
                    <td className="text-nowrap">{tarihYaz(i.tarih)}</td>
                    <td>{i.admin ? `@${i.admin}` : <span className="text-muted">sunucu komutu</span>}</td>
                    <td>{ISLEM_ETIKETI[i.islem] || i.islem}</td>
                    <td className="text-nowrap">{hedefBaglantisi(i)}</td>
                    <td className="text-muted small" style={{ maxWidth: 280 }}>
                      {degerYaz(i.eskiDeger) || "-"}
                    </td>
                    <td className="small" style={{ maxWidth: 360 }}>
                      {degerYaz(i.yeniDeger) || "-"}
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

export default IslemKaydiPage;

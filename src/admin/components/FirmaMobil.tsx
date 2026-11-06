import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { adminApi, FirmaDto, MobilFirmaOzeti, MobilKullanim } from "../services/adminApi";

// Merkez saatleri sürücüde UTC sayılır (duvar saati): olduğu gibi yazılır
const zaman = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("tr-TR", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" }) : "—");
const YETKI_KISA: [keyof MobilKullanim["kullanicilar"][number]["yetkiler"], string][] = [["fiyat", "F"], ["bakiye", "B"], ["dokum", "D"], ["alis", "A"], ["satis", "S"]];

/**
 * Firma Detay › Mobil sekmesi (docs/MOBIL_CARI_YOL_HARITASI.md K2, K7, K11, K26). Mobil kullanıcı sınırı firma başına
 * toplamdır (0 = tanımlanamaz); kısa ad mobil sitenin solunda görünür, boşsa ünvanın ilk sözcüğü. Modülün kendisi
 * Modüller sekmesinde "M- Mobil" olarak açılır.
 */
const FirmaMobil: React.FC<{ firma: FirmaDto }> = ({ firma }) => {
  const [ozet, setOzet] = useState<MobilFirmaOzeti | null>(null);
  const [limit, setLimit] = useState("0");
  const [kisaAd, setKisaAd] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const [kullanim, setKullanim] = useState<MobilKullanim | null>(null);

  const doldur = (o: MobilFirmaOzeti) => {
    setOzet(o);
    setLimit(String(o.kullaniciLimiti));
    setKisaAd(o.kisaAd || "");
  };

  const yukle = useCallback(async () => {
    setHata(null);
    try {
      doldur(await adminApi.mobilOzet(firma.firmaId));
      setKullanim(await adminApi.mobilKullanim(firma.firmaId).catch(() => null));
    } catch (err: any) {
      setHata(err?.message || "Mobil ayarı getirilemedi.");
    }
  }, [firma.firmaId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 0) return setHata("Sınır 0 ya da daha büyük bir tam sayı olmalıdır.");
    setMesgul(true);
    setHata(null);
    setBilgi(null);
    try {
      doldur(await adminApi.mobilYaz(firma.firmaId, { kullaniciLimiti: n, kisaAd: kisaAd.trim() || null }));
      setBilgi("Kaydedildi.");
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  if (!ozet) {
    return hata ? (
      <Alert variant="danger">{hata}</Alert>
    ) : (
      <div className="text-center py-4">
        <Spinner animation="border" />
      </div>
    );
  }

  if (!ozet.semaVar) {
    return (
      <Alert variant="warning">
        Mobil erişim tabloları sunucuda kurulmamış. SSMS'te <code>docs/sql/LIKYA_ADMIN_MOBIL.sql</code> betiğini çalıştırın.
      </Alert>
    );
  }

  return (
    <div style={{ maxWidth: 820 }}>
      <p className="mb-2">
        Modül durumu:{" "}
        {ozet.modulAcik ? <Badge bg="success">Açık</Badge> : <Badge bg="secondary">Kapalı</Badge>}{" "}
        <span className="text-muted small">(Modüller sekmesinde en alttaki “M- Mobil”)</span>
      </p>
      <p className="mb-3">
        Kullanım: <strong>{ozet.kullanilan}</strong> / {ozet.kullaniciLimiti} mobil kullanıcı
        {ozet.musteriNo ? <span className="text-muted small"> · Müşteri no {ozet.musteriNo}</span> : <Badge bg="warning" className="ms-2">Müşteri no yok — cari giriş yapamaz</Badge>}
      </p>
      {hata && <Alert variant="danger">{hata}</Alert>}
      {bilgi && <Alert variant="success">{bilgi}</Alert>}
      <Form onSubmit={kaydet}>
        <Row className="g-3">
          <Col sm={5}>
            <Form.Group controlId="mobilLimit">
              <Form.Label>Mobil kullanıcı sınırı</Form.Label>
              <Form.Control type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} disabled={mesgul} />
              <Form.Text>Firma başına toplam. 0 = firma mobil kullanıcı tanımlayamaz.</Form.Text>
            </Form.Group>
          </Col>
          <Col sm={7}>
            <Form.Group controlId="mobilKisaAd">
              <Form.Label>Kısa ad (mobil sitede solda)</Form.Label>
              <Form.Control maxLength={40} value={kisaAd} placeholder={ozet.gorunenKisaAd} onChange={(e) => setKisaAd(e.target.value)} disabled={mesgul} />
              <Form.Text>Boş bırakılırsa ünvanın ilk sözcüğü: “{ozet.gorunenKisaAd}”.</Form.Text>
            </Form.Group>
          </Col>
        </Row>
        <Button type="submit" className="btn-adm mt-3" disabled={mesgul}>
          {mesgul ? "Kaydediliyor…" : "Kaydet"}
        </Button>
      </Form>

      {kullanim && (
        <>
          <h6 className="mt-4 mb-2">Mobil kullanıcılar</h6>
          <p className="small text-muted mb-2">
            Sınıra sayılan (aktif): <strong>{kullanim.ozet.aktif}</strong> · pasif {kullanim.ozet.pasif} · kilitli {kullanim.ozet.kilitli} · hiç giriş yapmamış {kullanim.ozet.hicGirmedi}. Kullanıcıları firma yöneticisi programdan (cari kartı › Mobil, Mobil Kullanıcılar) yönetir.
          </p>
          {kullanim.kullanicilar.length === 0 ? (
            <div className="small text-muted">Henüz mobil kullanıcı yok.</div>
          ) : (
            <Table size="sm" responsive className="small align-middle">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Cari</th>
                  <th title="F fiyat · B bakiye · D döküm · A alış · S satış">Yetki</th>
                  <th>Durum</th>
                  <th>Son giriş</th>
                </tr>
              </thead>
              <tbody>
                {kullanim.kullanicilar.map((k) => (
                  <tr key={k.erisimId} className={k.aktif ? "" : "text-muted"}>
                    <td>
                      <span className="font-monospace">{k.kullaniciAdi}</span>
                      {k.adSoyad && <div className="text-muted">{k.adSoyad}</div>}
                    </td>
                    <td>
                      {k.cariKod} {k.cariAd}
                    </td>
                    <td className="font-monospace">{YETKI_KISA.map(([a, h]) => (k.yetkiler[a] ? h : "·")).join("")}</td>
                    <td>
                      {k.aktif ? <Badge bg="success">Aktif</Badge> : <Badge bg="secondary">Pasif</Badge>}
                      {k.kilitli && <Badge bg="danger" className="ms-1">Kilitli</Badge>}
                      {k.sifreDegismeli && <Badge bg="warning" text="dark" className="ms-1">İlk şifre</Badge>}
                    </td>
                    <td className="text-nowrap">{zaman(k.sonGiris)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}

          <h6 className="mt-4 mb-2">Son mobil girişler</h6>
          {kullanim.girisler.length === 0 ? (
            <div className="small text-muted">Kayıt yok.</div>
          ) : (
            <Table size="sm" responsive className="small align-middle">
              <thead>
                <tr>
                  <th>Zaman</th>
                  <th>Müşteri no / kullanıcı</th>
                  <th>Sonuç</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {kullanim.girisler.map((g) => (
                  <tr key={g.logId}>
                    <td className="text-nowrap">{zaman(g.tarih)}</td>
                    <td className="font-monospace">{g.kullaniciAdi}</td>
                    <td>{g.basarili ? <Badge bg="success">Başarılı</Badge> : <><Badge bg="danger">Reddedildi</Badge> <span className="text-muted">{g.redNedeni}</span></>}</td>
                    <td className="font-monospace">{g.ip}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </div>
  );
};

export default FirmaMobil;

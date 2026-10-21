import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Form, InputGroup, Spinner, Table } from "react-bootstrap";
import { adminApi, FirmaDto, PanoAnahtarSatiri } from "../services/adminApi";

/**
 * Firma Detay > Pano API sekmesi (docs/PANO_API_YOL_HARITASI.md, P2/P10). Firmanın panoları firma veritabanından okunur;
 * anahtar üret / yenile / iptal, önbellek süresi, son erişim ve istek sayısı. Firma kendi tarafında da aynı işlemleri yapar.
 */

const tarihYaz = (d: string | null) => (d ? new Date(d).toLocaleString("tr-TR") : "-");

const Satir: React.FC<{ p: PanoAnahtarSatiri; mesgul: boolean; onUret: () => void; onIptal: () => void; onOnbellek: (sn: number) => void }> = ({ p, mesgul, onUret, onIptal, onOnbellek }) => {
  const [sn, setSn] = useState(String(p.onbellekSn));
  const [goster, setGoster] = useState(false);
  useEffect(() => setSn(String(p.onbellekSn)), [p.onbellekSn]);
  const snKaydet = () => {
    const n = Number(sn);
    if (!Number.isInteger(n) || n < 1 || n > 3600) return setSn(String(p.onbellekSn));
    if (n !== p.onbellekSn) onOnbellek(n);
  };
  return (
    <>
      <tr>
        <td>
          <strong>{p.panoNo}</strong>
          <div className="text-muted small">{p.firmaAdi}</div>
        </td>
        <td>
          {p.anahtar ? (
            <>
              <code className="small">{goster ? p.anahtar : p.anahtar.slice(0, 4) + "…" + p.anahtar.slice(-4)}</code>{" "}
              <Button size="sm" variant="link" className="p-0" onClick={() => setGoster((g) => !g)}>
                {goster ? "gizle" : "göster"}
              </Button>
            </>
          ) : (
            <Badge bg="secondary">yok</Badge>
          )}
        </td>
        <td>
          {p.anahtar ? (
            <InputGroup size="sm" style={{ width: 120 }}>
              <Form.Control type="number" min={1} max={3600} value={sn} onChange={(e) => setSn(e.target.value)} onBlur={snKaydet} disabled={mesgul} />
              <InputGroup.Text>sn</InputGroup.Text>
            </InputGroup>
          ) : (
            "-"
          )}
        </td>
        <td className="small">{p.olusturan || "-"}</td>
        <td className="small">{tarihYaz(p.sonErisim)}</td>
        <td className="text-end">{p.istekSayisi.toLocaleString("tr-TR")}</td>
        <td className="text-nowrap">
          <Button size="sm" className="btn-adm me-1" disabled={mesgul} onClick={() => (!p.anahtar || window.confirm("Anahtar yenilenecek; eski adres hemen kapanır. Devam?")) && onUret()}>
            {p.anahtar ? "Yenile" : "Üret"}
          </Button>
          {p.anahtar && (
            <Button size="sm" variant="outline-danger" disabled={mesgul} onClick={() => window.confirm("Anahtar iptal edilecek; adresler çalışmayı bırakır. Devam?") && onIptal()}>
              İptal
            </Button>
          )}
        </td>
      </tr>
      {p.anahtar && p.adresler && (
        <tr>
          <td colSpan={7} className="pt-0 border-top-0">
            <div className="small font-monospace text-muted">
              <div>JSON: {p.adresler.json}</div>
              <div>XML: {p.adresler.xml}</div>
              <div>TXT: {p.adresler.txt}</div>
              <div>HTML: {p.adresler.html}</div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const FirmaPanoApi: React.FC<{ firma: FirmaDto }> = ({ firma }) => {
  const [liste, setListe] = useState<PanoAnahtarSatiri[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(async () => {
    setHata(null);
    try {
      setListe(await adminApi.panoAnahtarlari(firma.firmaId));
    } catch (err: any) {
      setHata(err?.message || "Pano anahtarları getirilemedi.");
      setListe([]);
    }
  }, [firma.firmaId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const calistir = async (is: () => Promise<PanoAnahtarSatiri>, mesaj: string) => {
    setMesgul(true);
    setHata(null);
    setBilgi(null);
    try {
      const yeni = await is();
      setListe((l) => (l || []).map((p) => (p.panoId === yeni.panoId ? yeni : p)));
      setBilgi(mesaj);
    } catch (err: any) {
      setHata(err?.message || "İşlem yapılamadı.");
    } finally {
      setMesgul(false);
    }
  };

  if (liste === null) {
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
      <p className="text-muted small">
        Firma, pano tanımındaki komisyonlu fiyatlarını anahtarlı açık adresten LED pano yazılımına verir. Modülün firmaya açık olması gerekir
        (Modüller › Kur › Pano Entegrasyonu); kapalıyken adresler 403 döner. Firma aynı işlemleri Kur › Pano Entegrasyonu sayfasından da yapar.
      </p>
      {liste.length === 0 ? (
        <Alert variant="info">Firmada pano tanımı yok.</Alert>
      ) : (
        <Table size="sm" responsive className="align-middle">
          <thead>
            <tr>
              <th>Pano</th>
              <th>Anahtar</th>
              <th>Önbellek</th>
              <th>Üreten</th>
              <th>Son erişim</th>
              <th className="text-end">İstek</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {liste.map((p) => (
              <Satir
                key={p.panoId}
                p={p}
                mesgul={mesgul}
                onUret={() => void calistir(() => adminApi.panoAnahtarUret(firma.firmaId, p.panoId), p.anahtar ? "Anahtar yenilendi." : "Anahtar üretildi.")}
                onIptal={() => void calistir(() => adminApi.panoAnahtarIptal(firma.firmaId, p.panoId), "Anahtar iptal edildi.")}
                onOnbellek={(sn) => void calistir(() => adminApi.panoOnbellekYaz(firma.firmaId, p.panoId, sn), "Önbellek süresi kaydedildi.")}
              />
            ))}
          </tbody>
        </Table>
      )}
      <Button size="sm" variant="outline-secondary" disabled={mesgul} onClick={() => void yukle()}>
        Yenile
      </Button>
    </>
  );
};

export default FirmaPanoApi;

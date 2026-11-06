import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, ButtonGroup, Form, Modal, Spinner } from "react-bootstrap";
import { MobilHata, MobilYetkiler, istek, tl } from "../api";
import type { MobilFiyat } from "./FiyatEkrani";

/**
 * Al / Sat (docs/MOBIL_CARI_YOL_HARITASI.md K17, K21, K30, K32): yazılım ya da iş bilgisi gerektirmeyen sade alışveriş
 * ekranı. Ürün seçilir, alış / satış, miktar; tutar anında görünür. Onayda fiyat sabitlenir ve firma onayına düşer; süre
 * içinde onaylanmazsa emir düşer. Ödeme / teslim tercihi yalnız bilgidir, son ödeme şeklini firma belirler.
 */

interface IslemBilgisi {
  acik: boolean;
  kapaliNedeni: string | null;
  alis: boolean;
  satis: boolean;
  tercihler: { kod: string; ad: string }[];
  gecerlilikSn: number;
  sinirlar: { islemEnAzTl: number | null; islemEnCokTl: number | null; gunlukLimitTl: number | null; gunlukKalanTl: number | null; calisma: string | null };
}
interface Emir {
  emirId: number;
  tur?: "PARA" | "STOK";
  yon: "AL" | "SAT";
  durum: string;
  durumAdi: string;
  toplamTl: number;
  tercih: string | null;
  kalanSn: number;
  redNedeni: string | null;
  fisNo: string | null;
  olusturmaTarihi: string;
  satirlar: { urunAd: string | null; miktar: number; birim: string | null; birimFiyat: number; tutar: number }[];
}

const DURUM_RENGI: Record<string, string> = { BEKLIYOR: "warning", ONAYLANDI: "success", REDDEDILDI: "danger", SURESI_DOLDU: "secondary", IPTAL: "secondary" };
const sure = (sn: number) => (sn >= 60 ? `${Math.floor(sn / 60)} dk ${sn % 60 ? `${sn % 60} sn` : ""}` : `${sn} sn`);
const basamak = (v: number) => (v >= 1000 ? 2 : v < 10 ? 4 : 3);

const IslemEkrani: React.FC<{ firmaId: number; yetkiler: MobilYetkiler }> = ({ firmaId }) => {
  const [bilgi, setBilgi] = useState<IslemBilgisi | null>(null);
  const [fiyatlar, setFiyatlar] = useState<MobilFiyat[] | null>(null);
  const [emirler, setEmirler] = useState<Emir[] | null>(null);
  const [urunId, setUrunId] = useState<number | "">("");
  const [yon, setYon] = useState<"AL" | "SAT">("AL");
  const [miktar, setMiktar] = useState("");
  const [tercih, setTercih] = useState("");
  const [not, setNot] = useState("");
  const [onay, setOnay] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      const [b, f, e] = await Promise.all([
        istek<IslemBilgisi>("GET", "/islem"),
        istek<{ urunler: MobilFiyat[] }>("GET", "/fiyatlar").catch(() => ({ urunler: [] as MobilFiyat[] })),
        istek<Emir[]>("GET", "/emirler"),
      ]);
      setBilgi(b);
      setFiyatlar(f.urunler);
      setEmirler(e);
      setYon((y) => (y === "AL" && !b.alis ? "SAT" : y === "SAT" && !b.satis ? "AL" : y));
      setTercih((t) => t || b.tercihler[0]?.kod || "");
    } catch (e: any) {
      setHata(e?.message || "Bilgi alınamadı.");
    }
  }, []);

  useEffect(() => {
    void yukle();
    const t = setInterval(() => void yukle(), 15_000);
    return () => clearInterval(t);
  }, [yukle, firmaId]);

  // Bekleyen emirlerin kalan süresi saniye saniye azalsın
  useEffect(() => {
    if (!emirler?.some((e) => e.durum === "BEKLIYOR")) return;
    const t = setInterval(() => setEmirler((l) => l && l.map((e) => (e.durum === "BEKLIYOR" ? { ...e, kalanSn: Math.max(0, e.kalanSn - 1) } : e))), 1000);
    return () => clearInterval(t);
  }, [emirler]);

  const urun = useMemo(() => fiyatlar?.find((u) => u.urunId === urunId) || null, [fiyatlar, urunId]);
  const birimFiyat = urun ? (yon === "AL" ? urun.satis : urun.alis) : null;
  const m = Number(miktar.replace(",", "."));
  const tutar = birimFiyat && m > 0 ? Math.round(m * birimFiyat * 100) / 100 : null;

  const gonder = async () => {
    if (!urun || !birimFiyat) return;
    setMesgul(true);
    setHata(null);
    try {
      await istek("POST", "/emir", { urunId: urun.urunId, yon, miktar: m, tercih: tercih || null, not, gorulenFiyat: birimFiyat });
      setOnay(false);
      setMiktar("");
      setNot("");
      setMesaj("Emriniz alındı. Firma onayladığında işleminiz kesinleşir.");
      await yukle();
    } catch (e: any) {
      setOnay(false);
      if (e instanceof MobilHata && e.kod === "FIYAT_DEGISTI") {
        setHata("Fiyat değişti. Güncel fiyatı kontrol edip yeniden deneyin.");
        await yukle();
      } else setHata(e?.message || "Emir verilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  const iptal = async (id: number) => {
    if (!window.confirm("Emir iptal edilsin mi?")) return;
    try {
      await istek("POST", `/emir/${id}/iptal`);
      await yukle();
    } catch (e: any) {
      setHata(e?.message || "İptal edilemedi.");
    }
  };

  if (!bilgi || !fiyatlar)
    return hata ? (
      <Alert variant="warning">{hata}</Alert>
    ) : (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );

  return (
    <>
      {hata && (
        <Alert variant="warning" dismissible onClose={() => setHata(null)}>
          {hata}
        </Alert>
      )}
      {mesaj && (
        <Alert variant="success" dismissible onClose={() => setMesaj(null)}>
          {mesaj}
        </Alert>
      )}

      {/* Geniş ekranda işlem formu solda, emirler sağda (mobil.scss .m-iki-kolon) */}
      <div className="m-iki-kolon">
      <div className="m-kart">
        <div className="m-baslik">Al / Sat</div>
        {!bilgi.acik ? (
          <div className="text-muted">{bilgi.kapaliNedeni}</div>
        ) : fiyatlar.length === 0 ? (
          <div className="text-muted">Şu an işleme açık ürün yok.</div>
        ) : (
          <>
            {bilgi.alis && bilgi.satis && (
              <ButtonGroup className="w-100 mb-3">
                <Button variant={yon === "AL" ? "success" : "outline-success"} className="m-buyuk-dugme" onClick={() => setYon("AL")}>
                  Almak istiyorum
                </Button>
                <Button variant={yon === "SAT" ? "danger" : "outline-danger"} className="m-buyuk-dugme" onClick={() => setYon("SAT")}>
                  Satmak istiyorum
                </Button>
              </ButtonGroup>
            )}
            {!(bilgi.alis && bilgi.satis) && <div className="fw-semibold mb-2">{yon === "AL" ? "Almak istiyorum" : "Satmak istiyorum"}</div>}
            <Form.Group className="mb-3" controlId="urun">
              <Form.Label>Ürün</Form.Label>
              <Form.Select size="lg" value={urunId} onChange={(e) => setUrunId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Seçin…</option>
                {fiyatlar
                  .filter((u) => (yon === "AL" ? u.satis : u.alis))
                  .map((u) => (
                    <option key={u.urunId} value={u.urunId}>
                      {u.ad} — {tl(yon === "AL" ? u.satis : u.alis, basamak((yon === "AL" ? u.satis : u.alis) || 0))} TL / {u.birim === u.kod ? "1" : u.birim}
                    </option>
                  ))}
              </Form.Select>
            </Form.Group>
            {urun && (
              <Form.Group className="mb-3" controlId="miktar">
                <Form.Label>Miktar ({urun.birim})</Form.Label>
                <Form.Control size="lg" inputMode="decimal" value={miktar} placeholder="0" onChange={(e) => setMiktar(e.target.value)} />
              </Form.Group>
            )}
            {tutar !== null && (
              <div className="d-flex justify-content-between align-items-baseline mb-3">
                <span className="text-muted">Tutar</span>
                <span className="fs-4 fw-bold">{tl(tutar, 2)} TL</span>
              </div>
            )}
            {bilgi.tercihler.length > 0 && (
              <Form.Group className="mb-2">
                <Form.Label>Ödeme / teslim tercihiniz</Form.Label>
                {bilgi.tercihler.map((t) => (
                  <Form.Check key={t.kod} type="radio" id={`tercih-${t.kod}`} name="tercih" label={t.ad} checked={tercih === t.kod} onChange={() => setTercih(t.kod)} />
                ))}
              </Form.Group>
            )}
            <Form.Group className="mb-3" controlId="not">
              <Form.Control as="textarea" rows={2} maxLength={500} placeholder="Not (isteğe bağlı)" value={not} onChange={(e) => setNot(e.target.value)} />
            </Form.Group>
            <Button className="w-100 m-buyuk-dugme" disabled={!tutar || mesgul} onClick={() => setOnay(true)}>
              Devam
            </Button>
            <div className="small text-muted mt-2">
              {bilgi.sinirlar.islemEnAzTl !== null && <>En az {tl(bilgi.sinirlar.islemEnAzTl, 0)} TL · </>}
              {bilgi.sinirlar.islemEnCokTl !== null && <>En çok {tl(bilgi.sinirlar.islemEnCokTl, 0)} TL · </>}
              {bilgi.sinirlar.gunlukKalanTl !== null && <>Bugün kalan {tl(bilgi.sinirlar.gunlukKalanTl, 0)} TL · </>}
              {bilgi.sinirlar.calisma && <>Saat {bilgi.sinirlar.calisma}</>}
            </div>
          </>
        )}
      </div>

      <div className="m-kart">
        <div className="m-baslik">Emirlerim</div>
        {!emirler || emirler.length === 0 ? (
          <div className="text-muted">Henüz emriniz yok.</div>
        ) : (
          emirler.map((e) => (
            <div className="m-dokum-satir" key={e.emirId}>
              <div className="sol">
                <div>
                  <span className={e.tur === "STOK" ? "text-primary" : e.yon === "AL" ? "text-success" : "text-danger"}>{e.tur === "STOK" ? "Sipariş" : e.yon === "AL" ? "Alış" : "Satış"}</span> ·{" "}
                  {e.satirlar.map((s) => `${s.miktar.toLocaleString("tr-TR")} ${s.birim || ""} ${s.urunAd || ""}`).join(", ")}
                </div>
                <div className="soluk">
                  #{e.emirId} · {new Date(e.olusturmaTarihi).toLocaleString("tr-TR", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" })}
                  {e.fisNo ? ` · fiş ${e.fisNo}` : ""}
                  {e.redNedeni ? ` · ${e.redNedeni}` : ""}
                </div>
                {e.durum === "BEKLIYOR" && (
                  <Button size="sm" variant="link" className="p-0 text-danger" onClick={() => void iptal(e.emirId)}>
                    İptal et
                  </Button>
                )}
              </div>
              <div className="tutar">
                {tl(e.toplamTl, 2)} TL
                <div>
                  <Badge bg={DURUM_RENGI[e.durum] || "secondary"}>{e.durumAdi}</Badge>
                </div>
                {e.durum === "BEKLIYOR" && <div className="soluk">{sure(e.kalanSn)} kaldı</div>}
              </div>
            </div>
          ))
        )}
      </div>
      </div>

      <Modal show={onay} onHide={() => setOnay(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">Emri onaylayın</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {urun && birimFiyat && tutar && (
            <>
              <div className="fs-5 fw-bold mb-1">
                {yon === "AL" ? "Alış" : "Satış"}: {m.toLocaleString("tr-TR")} {urun.birim} {urun.ad}
              </div>
              <div>
                Birim fiyat: <b>{tl(birimFiyat, basamak(birimFiyat))} TL</b>
              </div>
              <div className="fs-4 fw-bold my-2">{tl(tutar, 2)} TL</div>
              {tercih && <div className="small">Tercihiniz: {bilgi.tercihler.find((t) => t.kod === tercih)?.ad}</div>}
              {yon === "AL" && urun.birim === urun.kod && <div className="small text-muted mt-1">Döviz alışında yasal vergi (BSMV / KMV) fişte ayrıca eklenir.</div>}
              <div className="small text-muted mt-2">
                Fiyat {sure(bilgi.gecerlilikSn)} sabittir. Firma bu süre içinde onaylarsa işleminiz kesinleşir; onaylanmazsa emir düşer.
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setOnay(false)}>
            Vazgeç
          </Button>
          <Button className="m-buyuk-dugme px-4" disabled={mesgul} onClick={() => void gonder()}>
            {mesgul ? <Spinner size="sm" animation="border" /> : "Emri gönder"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default IslemEkrani;

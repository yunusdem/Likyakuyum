import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { IconMinus, IconPlus, IconShoppingBag, IconTrash } from "@tabler/icons-react";
import { MobilHata, istek, tl } from "../api";

/**
 * Ticari katalog + sepet (docs/MOBIL_CARI_YOL_HARITASI.md Faz 8, V8): firmanın seçtiği ürünler, carinin fiyatıyla (KDV
 * dahil). Stok miktarı görünmez; yalnız "stokta var / yok". Sepet onaylanınca fiyatlar sabitlenir ve sipariş firma onayına
 * düşer; süre içinde onaylanmazsa düşer. Durum Al / Sat › Emirlerim'de görünür.
 */

export interface KatalogUrunu {
  stokKartId: number;
  kod: string;
  ad: string;
  grup: string | null;
  birim: string;
  fiyat: number;
  kdvOrani: number;
  stokta: boolean;
}
interface IslemBilgisi {
  acik: boolean;
  kapaliNedeni: string | null;
  alis: boolean;
  tercihler: { kod: string; ad: string }[];
  gecerlilikSn: number;
  sinirlar: { islemEnAzTl: number | null; islemEnCokTl: number | null; gunlukKalanTl: number | null; calisma: string | null };
}

const adetMi = (birim: string) => birim.toLocaleLowerCase("tr-TR") === "adet";
const sure = (sn: number) => (sn >= 60 ? `${Math.floor(sn / 60)} dk${sn % 60 ? ` ${sn % 60} sn` : ""}` : `${sn} sn`);
const miktarOku = (v: string) => Number(String(v).replace(",", "."));

const KatalogEkrani: React.FC<{ firmaId: number }> = ({ firmaId }) => {
  const [urunler, setUrunler] = useState<KatalogUrunu[] | null>(null);
  const [bilgi, setBilgi] = useState<IslemBilgisi | null>(null);
  const [arama, setArama] = useState("");
  const [grup, setGrup] = useState("");
  // Sepet: kart → miktar (metin; virgüllü ondalık yazılabilsin)
  const [sepet, setSepet] = useState<Record<number, string>>({});
  const [sepetAcik, setSepetAcik] = useState(false);
  const [tercih, setTercih] = useState("");
  const [not, setNot] = useState("");
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);

  const yukle = useCallback(async () => {
    try {
      const [k, b] = await Promise.all([istek<{ urunler: KatalogUrunu[] }>("GET", "/katalog"), istek<IslemBilgisi>("GET", "/islem").catch(() => null)]);
      setUrunler(k.urunler);
      setBilgi(b);
      if (b) setTercih((t) => t || b.tercihler[0]?.kod || "");
      // Katalogdan çıkan ürün sepetten düşer
      setSepet((s) => Object.fromEntries(Object.entries(s).filter(([id]) => k.urunler.some((u) => u.stokKartId === Number(id)))));
    } catch (e: any) {
      setHata(e?.message || "Katalog alınamadı.");
    }
  }, []);

  useEffect(() => {
    setSepet({});
    void yukle();
  }, [yukle, firmaId]);

  const gruplar = useMemo(() => [...new Set((urunler || []).map((u) => u.grup).filter((g): g is string => !!g))].sort((a, b) => a.localeCompare(b, "tr")), [urunler]);
  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return (urunler || []).filter((u) => (!grup || u.grup === grup) && (!q || u.ad.toLocaleLowerCase("tr-TR").includes(q) || u.kod.toLocaleLowerCase("tr-TR").includes(q)));
  }, [urunler, arama, grup]);
  const harita = useMemo(() => new Map((urunler || []).map((u) => [u.stokKartId, u])), [urunler]);
  const satirlar = Object.entries(sepet)
    .map(([id, m]) => ({ u: harita.get(Number(id))!, metin: m, miktar: miktarOku(m) }))
    .filter((s) => s.u);
  const gecerliSatir = (s: { u: KatalogUrunu; miktar: number }) => s.miktar > 0 && (!adetMi(s.u.birim) || Number.isInteger(s.miktar));
  const toplam = Math.round(satirlar.reduce((a, s) => a + (gecerliSatir(s) ? Math.round(s.miktar * s.u.fiyat * 100) / 100 : 0), 0) * 100) / 100;
  const sepetGecerli = satirlar.length > 0 && satirlar.every(gecerliSatir);

  const arttir = (u: KatalogUrunu, d: 1 | -1) =>
    setSepet((s) => {
      const simdi = miktarOku(s[u.stokKartId] || "0") || 0;
      const yeni = Math.max(0, Math.round((simdi + d) * 1000) / 1000);
      const k = { ...s };
      if (yeni <= 0) delete k[u.stokKartId];
      else k[u.stokKartId] = String(yeni).replace(".", ",");
      return k;
    });

  const gonder = async () => {
    setMesgul(true);
    setHata(null);
    try {
      const r = await istek<{ emir: { emirId: number } }>("POST", "/siparis", {
        satirlar: satirlar.map((s) => ({ stokKartId: s.u.stokKartId, miktar: s.miktar, gorulenFiyat: s.u.fiyat })),
        tercih: tercih || null,
        not,
      });
      setSepet({});
      setNot("");
      setSepetAcik(false);
      setMesaj(`Siparişiniz alındı (#${r.emir.emirId}). Firma onayladığında kesinleşir; durumunu Al / Sat › Emirlerim'de görebilirsiniz.`);
    } catch (e: any) {
      if (e instanceof MobilHata && e.kod === "FIYAT_DEGISTI") {
        setHata("Bazı fiyatlar değişti. Sepeti kontrol edip yeniden gönderin.");
        await yukle();
      } else setHata(e?.message || "Sipariş verilemedi.");
    } finally {
      setMesgul(false);
    }
  };

  if (!urunler)
    return hata ? (
      <Alert variant="warning">{hata}</Alert>
    ) : (
      <div className="text-center py-5">
        <Spinner animation="border" />
      </div>
    );

  const siparisAcik = !!bilgi?.acik && !!bilgi?.alis;

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
      <div className="m-kart">
        <div className="m-baslik">Katalog</div>
        {bilgi && !siparisAcik && <div className="small text-muted mb-2">{bilgi.kapaliNedeni || "Sipariş yetkiniz yok; yalnız fiyatları görebilirsiniz."}</div>}
        <Form.Control className="mb-2" placeholder="Ürün ara" value={arama} onChange={(e) => setArama(e.target.value)} />
        {gruplar.length > 1 && (
          <div className="d-flex gap-1 flex-wrap mb-2">
            <Button size="sm" variant={!grup ? "primary" : "outline-primary"} onClick={() => setGrup("")}>
              Tümü
            </Button>
            {gruplar.map((g) => (
              <Button key={g} size="sm" variant={grup === g ? "primary" : "outline-primary"} onClick={() => setGrup(g)}>
                {g}
              </Button>
            ))}
          </div>
        )}
        {urunler.length === 0 && <div className="text-muted">Katalogda ürün yok.</div>}
        {urunler.length > 0 && gorunen.length === 0 && <div className="text-muted">Aramaya uyan ürün yok.</div>}
        <div className="m-urun-izgara">
        {gorunen.map((u) => {
          const m = sepet[u.stokKartId];
          return (
            <div key={u.stokKartId} className="m-dokum-satir align-items-center">
              <div className="sol">
                <div className="fw-semibold">{u.ad}</div>
                <div className="soluk">
                  {u.kod} · {u.stokta ? <span className="text-success">Stokta var</span> : <span className="text-danger">Stokta yok</span>}
                </div>
                <div className="fw-bold">
                  {tl(u.fiyat, 2)} TL <span className="soluk fw-normal">/ {u.birim}</span>
                </div>
              </div>
              {siparisAcik && (
                <div className="d-flex align-items-center gap-1">
                  {m ? (
                    <>
                      <Button size="sm" variant="outline-secondary" aria-label="Azalt" onClick={() => arttir(u, -1)}>
                        <IconMinus size={16} />
                      </Button>
                      <Form.Control
                        size="sm"
                        inputMode="decimal"
                        style={{ width: 64, textAlign: "center" }}
                        value={m}
                        aria-label={`${u.ad} miktarı`}
                        onChange={(e) => setSepet((s) => ({ ...s, [u.stokKartId]: e.target.value }))}
                      />
                      <Button size="sm" variant="outline-secondary" aria-label="Arttır" onClick={() => arttir(u, 1)}>
                        <IconPlus size={16} />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline-primary" onClick={() => arttir(u, 1)}>
                      Sepete ekle
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
        <div className="small text-muted mt-2">Fiyatlar KDV dahildir.</div>
      </div>

      {satirlar.length > 0 && (
        <div className="m-sepet-cubugu">
          <Button className="w-100 m-buyuk-dugme d-flex justify-content-between align-items-center" onClick={() => setSepetAcik(true)}>
            <span>
              <IconShoppingBag size={20} className="me-1" />
              Sepet ({satirlar.length})
            </span>
            <span>{tl(toplam, 2)} TL</span>
          </Button>
        </div>
      )}

      <Modal show={sepetAcik} onHide={() => setSepetAcik(false)} centered fullscreen="sm-down">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">Sepetim</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {satirlar.map((s) => (
            <div key={s.u.stokKartId} className="m-dokum-satir align-items-center">
              <div className="sol">
                <div className="fw-semibold">{s.u.ad}</div>
                <div className="soluk">
                  {tl(s.u.fiyat, 2)} TL / {s.u.birim}
                  {!gecerliSatir(s) && <span className="text-danger"> · {adetMi(s.u.birim) ? "adet tam sayı olmalı" : "miktar geçersiz"}</span>}
                </div>
              </div>
              <div className="d-flex align-items-center gap-1">
                <Form.Control
                  size="sm"
                  inputMode="decimal"
                  style={{ width: 72, textAlign: "center" }}
                  value={s.metin}
                  aria-label={`${s.u.ad} miktarı`}
                  onChange={(e) => setSepet((x) => ({ ...x, [s.u.stokKartId]: e.target.value }))}
                />
                <span className="small" style={{ minWidth: 80, textAlign: "right" }}>
                  {gecerliSatir(s) ? `${tl(Math.round(s.miktar * s.u.fiyat * 100) / 100, 2)} TL` : "-"}
                </span>
                <Button
                  size="sm"
                  variant="link"
                  className="text-danger p-1"
                  aria-label="Sepetten çıkar"
                  onClick={() =>
                    setSepet((x) => {
                      const k = { ...x };
                      delete k[s.u.stokKartId];
                      return k;
                    })
                  }
                >
                  <IconTrash size={16} />
                </Button>
              </div>
            </div>
          ))}
          <div className="d-flex justify-content-between align-items-baseline my-3">
            <span className="text-muted">Toplam (KDV dahil)</span>
            <span className="fs-4 fw-bold">{tl(toplam, 2)} TL</span>
          </div>
          {bilgi && bilgi.tercihler.length > 0 && (
            <Form.Group className="mb-2">
              <Form.Label>Ödeme / teslim tercihiniz</Form.Label>
              {bilgi.tercihler.map((t) => (
                <Form.Check key={t.kod} type="radio" id={`ktercih-${t.kod}`} name="ktercih" label={t.ad} checked={tercih === t.kod} onChange={() => setTercih(t.kod)} />
              ))}
            </Form.Group>
          )}
          <Form.Control as="textarea" rows={2} maxLength={500} placeholder="Not (isteğe bağlı)" value={not} onChange={(e) => setNot(e.target.value)} />
          {bilgi && (
            <div className="small text-muted mt-2">
              Fiyatlar {sure(bilgi.gecerlilikSn)} sabittir. Firma bu süre içinde onaylarsa siparişiniz kesinleşir; onaylanmazsa düşer.
              {bilgi.sinirlar.gunlukKalanTl !== null && <> Bugün kalan sınırınız {tl(bilgi.sinirlar.gunlukKalanTl, 0)} TL.</>}
            </div>
          )}
          {satirlar.some((s) => !s.u.stokta) && (
            <Alert variant="warning" className="mt-2 mb-0 py-2 small">
              Sepette stokta olmayan ürün var; firma tedarik süresini bildirebilir.
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSepetAcik(false)}>
            Alışverişe dön
          </Button>
          <Button className="m-buyuk-dugme px-4" disabled={!sepetGecerli || mesgul || !siparisAcik} onClick={() => void gonder()}>
            {mesgul ? <Spinner size="sm" animation="border" /> : "Siparişi gönder"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default KatalogEkrani;

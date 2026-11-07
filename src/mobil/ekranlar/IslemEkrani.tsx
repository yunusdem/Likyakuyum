import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Form, Modal, Spinner } from "react-bootstrap";
import { IconChevronRight } from "@tabler/icons-react";
import { MobilHata, MobilYetkiler, istek, tl } from "../api";
import type { MobilFiyat } from "./FiyatEkrani";

/**
 * Al / Sat (docs/MOBIL_CARI_YOL_HARITASI.md K17, K21, K30, K32, §8 T5): yazılım ya da iş bilgisi gerektirmeyen sade
 * alışveriş ekranı. Yön seçilir, ürün alttan açılan listeden (fiyatıyla) seçilir, miktar yazılır ya da hızlı çipten
 * alınır; birim fiyat ve tutar anında görünür. Onayda fiyat sabitlenir ve firma onayına düşer; süre içinde onaylanmazsa
 * emir düşer. Ödeme / teslim tercihi yalnız bilgidir, son ödeme şeklini firma belirler.
 * Fiyatlar'dan gelen kısayol (T1) `baslangic` ile ürün + yönü seçili getirir.
 */

export interface IslemBaslangici {
  urunId: number;
  yon: "AL" | "SAT";
  /** Aynı ürüne ikinci kez dokunulunca da uygulansın diye her dokunuşta değişir */
  sayac: number;
}

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

const sure = (sn: number) => (sn >= 60 ? `${Math.floor(sn / 60)} dk ${sn % 60 ? `${sn % 60} sn` : ""}` : `${sn} sn`);
const basamak = (v: number) => (v >= 1000 ? 2 : v < 10 ? 4 : 3);
const adetMi = (birim: string) => birim.toLocaleLowerCase("tr-TR") === "adet";
/** Birime göre hızlı miktar çipleri: döviz (birim = kod) 100 / 500 / 1.000 / 5.000, adet 1 / 2 / 5 / 10, gram 1 / 5 / 10 / 50 */
const hizliMiktarlar = (u: MobilFiyat): number[] => (u.birim === u.kod ? [100, 500, 1000, 5000] : adetMi(u.birim) ? [1, 2, 5, 10] : [1, 5, 10, 50]);
const emirTuru = (e: Emir) => (e.tur === "STOK" ? "stok" : e.yon === "AL" ? "al" : "sat");
const emirAdi = (e: Emir) => (e.tur === "STOK" ? "Sipariş" : e.yon === "AL" ? "Alış" : "Satış");

const IslemEkrani: React.FC<{ firmaId: number; yetkiler: MobilYetkiler; baslangic?: IslemBaslangici | null }> = ({ firmaId, baslangic }) => {
  const [bilgi, setBilgi] = useState<IslemBilgisi | null>(null);
  const [fiyatlar, setFiyatlar] = useState<MobilFiyat[] | null>(null);
  const [emirler, setEmirler] = useState<Emir[] | null>(null);
  const [urunId, setUrunId] = useState<number | "">("");
  const [yon, setYon] = useState<"AL" | "SAT">("AL");
  const [miktar, setMiktar] = useState("");
  const [tercih, setTercih] = useState("");
  const [not, setNot] = useState("");
  const [seciciAcik, setSeciciAcik] = useState(false);
  const [arama, setArama] = useState("");
  const [onay, setOnay] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const miktarKutusu = useRef<HTMLInputElement>(null);
  const uygulananBaslangic = useRef(0);

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

  // Fiyatlar'dan gelen kısayol: veriler gelince ürün + yön seçilir, imleç miktara gider (T1)
  useEffect(() => {
    if (!baslangic || !bilgi || !fiyatlar || uygulananBaslangic.current === baslangic.sayac) return;
    uygulananBaslangic.current = baslangic.sayac;
    const u = fiyatlar.find((x) => x.urunId === baslangic.urunId);
    const yonIzinli = baslangic.yon === "AL" ? bilgi.alis : bilgi.satis;
    if (!u || !yonIzinli) return;
    setYon(baslangic.yon);
    setUrunId(u.urunId);
    setMiktar("");
    setMesaj(null);
    window.setTimeout(() => miktarKutusu.current?.focus(), 80);
  }, [baslangic, bilgi, fiyatlar]);

  // Bekleyen emirlerin kalan süresi saniye saniye azalsın
  useEffect(() => {
    if (!emirler?.some((e) => e.durum === "BEKLIYOR")) return;
    const t = setInterval(() => setEmirler((l) => l && l.map((e) => (e.durum === "BEKLIYOR" ? { ...e, kalanSn: Math.max(0, e.kalanSn - 1) } : e))), 1000);
    return () => clearInterval(t);
  }, [emirler]);

  const yonFiyati = useCallback((u: MobilFiyat, y: "AL" | "SAT") => (y === "AL" ? u.satis : u.alis), []);
  const secenekler = useMemo(() => (fiyatlar || []).filter((u) => yonFiyati(u, yon) !== null), [fiyatlar, yon, yonFiyati]);
  const gorunenSecenekler = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr-TR");
    return q ? secenekler.filter((u) => u.ad.toLocaleLowerCase("tr-TR").includes(q) || u.kod.toLocaleLowerCase("tr-TR").includes(q)) : secenekler;
  }, [secenekler, arama]);
  const urun = useMemo(() => fiyatlar?.find((u) => u.urunId === urunId) || null, [fiyatlar, urunId]);
  const birimFiyat = urun ? yonFiyati(urun, yon) : null;
  const m = Number(miktar.replace(",", "."));
  const tutar = birimFiyat && m > 0 ? Math.round(m * birimFiyat * 100) / 100 : null;

  const yonDegistir = (y: "AL" | "SAT") => {
    setYon(y);
    // Seçili ürünün bu yönde fiyatı yoksa seçim kalkar
    if (urun && yonFiyati(urun, y) === null) setUrunId("");
  };

  const urunSec = (id: number) => {
    setUrunId(id);
    setSeciciAcik(false);
    setArama("");
    window.setTimeout(() => miktarKutusu.current?.focus(), 80);
  };

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
      <div className="m-yukleniyor">
        <Spinner animation="border" />
      </div>
    );

  const yonSinifi = yon === "AL" ? "al" : "sat";
  const karsiEtiket = yon === "AL" ? "Satış" : "Alış";

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
          <div className="m-kart-ust">
            <div className="m-baslik">Al / Sat</div>
            {bilgi.acik && bilgi.sinirlar.calisma && <span className="m-ipucu">Saat {bilgi.sinirlar.calisma}</span>}
          </div>
          {!bilgi.acik ? (
            <div className="m-bos">{bilgi.kapaliNedeni}</div>
          ) : fiyatlar.length === 0 ? (
            <div className="m-bos">Şu an işleme açık ürün yok.</div>
          ) : (
            <>
              {bilgi.alis && bilgi.satis ? (
                <div className="m-segment mb-3" role="tablist" aria-label="İşlem yönü">
                  <button type="button" role="tab" aria-selected={yon === "AL"} className={yon === "AL" ? "secili al" : ""} onClick={() => yonDegistir("AL")}>
                    Almak istiyorum
                  </button>
                  <button type="button" role="tab" aria-selected={yon === "SAT"} className={yon === "SAT" ? "secili sat" : ""} onClick={() => yonDegistir("SAT")}>
                    Satmak istiyorum
                  </button>
                </div>
              ) : (
                <div className="fw-bold fs-5 mb-3">{yon === "AL" ? "Almak istiyorum" : "Satmak istiyorum"}</div>
              )}

              <div className="m-alan">
                <div className="m-etiket">Ürün</div>
                <button type="button" className="m-secici" onClick={() => setSeciciAcik(true)} aria-haspopup="dialog">
                  {urun ? (
                    <>
                      <div className="ic">
                        <div className="ust">{urun.ad}</div>
                        <div className="alt">
                          {urun.kod} · {urun.birim}
                        </div>
                      </div>
                      {birimFiyat !== null && (
                        <div className={`fiyat ${yon === "AL" ? "satis" : "alis"}`}>
                          {tl(birimFiyat, basamak(birimFiyat))} <span className="m-ipucu">TL</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="ic">
                      <div className="bos">Ürün seçin…</div>
                    </div>
                  )}
                  <IconChevronRight size={18} className="ok" />
                </button>
              </div>

              {urun && (
                <div className="m-alan">
                  <div className="m-etiket">Miktar</div>
                  <div className="m-miktar">
                    <Form.Control ref={miktarKutusu} inputMode="decimal" value={miktar} placeholder="0" aria-label={`Miktar (${urun.birim})`} onChange={(e) => setMiktar(e.target.value)} />
                    <span className="birim">{urun.birim}</span>
                  </div>
                  <div className="m-cipler mt-2">
                    {hizliMiktarlar(urun).map((n) => (
                      <button key={n} type="button" className={`m-cip${m === n ? " secili" : ""}`} onClick={() => setMiktar(String(n))}>
                        {n.toLocaleString("tr-TR")} {urun.birim}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {urun && birimFiyat !== null && (
                <div className="m-ozet">
                  <div className="satir">
                    <span>{karsiEtiket} fiyatı</span>
                    <b>
                      {tl(birimFiyat, basamak(birimFiyat))} TL / {urun.birim === urun.kod ? "1" : urun.birim}
                    </b>
                  </div>
                  {tutar !== null && (
                    <div className="satir">
                      <span>Miktar</span>
                      <b>
                        {m.toLocaleString("tr-TR")} {urun.birim}
                      </b>
                    </div>
                  )}
                  <div className="toplam">
                    <span className="etiket">{yon === "AL" ? "Ödeyeceğiniz" : "Alacağınız"}</span>
                    <span className="deger">{tutar !== null ? `${tl(tutar, 2)} TL` : "—"}</span>
                  </div>
                </div>
              )}

              {bilgi.tercihler.length > 0 && (
                <div className="m-alan">
                  <div className="m-etiket">Ödeme / teslim tercihiniz</div>
                  <div className="m-cipler" role="radiogroup" aria-label="Ödeme / teslim tercihi">
                    {bilgi.tercihler.map((t) => (
                      <button key={t.kod} type="button" role="radio" aria-checked={tercih === t.kod} className={`m-cip${tercih === t.kod ? " secili" : ""}`} onClick={() => setTercih(t.kod)}>
                        {t.ad}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Form.Group className="m-alan" controlId="not">
                <Form.Control as="textarea" rows={2} maxLength={500} placeholder="Not (isteğe bağlı)" value={not} onChange={(e) => setNot(e.target.value)} />
              </Form.Group>

              <Button className={`w-100 m-buyuk-dugme m-cta ${yonSinifi}`} disabled={!tutar || mesgul} onClick={() => setOnay(true)}>
                {urun && tutar ? (yon === "AL" ? "Alış emri ver" : "Satış emri ver") : "Devam"}
              </Button>

              <div className="m-sinirlar">
                {bilgi.sinirlar.islemEnAzTl !== null && (
                  <span>
                    En az <b>{tl(bilgi.sinirlar.islemEnAzTl, 0)} TL</b>
                  </span>
                )}
                {bilgi.sinirlar.islemEnCokTl !== null && (
                  <span>
                    En çok <b>{tl(bilgi.sinirlar.islemEnCokTl, 0)} TL</b>
                  </span>
                )}
                {bilgi.sinirlar.gunlukKalanTl !== null && (
                  <span>
                    Bugün kalan <b>{tl(bilgi.sinirlar.gunlukKalanTl, 0)} TL</b>
                  </span>
                )}
                <span>
                  Fiyat <b>{sure(bilgi.gecerlilikSn)}</b> sabit
                </span>
              </div>
            </>
          )}
        </div>

        <div className="m-kart">
          <div className="m-kart-ust">
            <div className="m-baslik">Emirlerim</div>
            {emirler && emirler.length > 0 && <span className="m-ipucu">{emirler.length} emir</span>}
          </div>
          {!emirler || emirler.length === 0 ? (
            <div className="m-bos">Henüz emriniz yok.</div>
          ) : (
            emirler.map((e) => (
              <div className={`m-emir ${emirTuru(e)}`} key={e.emirId}>
                <div className="ust">
                  <div>
                    <div className={`tur ${emirTuru(e)}`}>
                      {emirAdi(e)} · #{e.emirId}
                    </div>
                    <div className="urun">{e.satirlar.map((s) => `${s.miktar.toLocaleString("tr-TR")} ${s.birim || ""} ${s.urunAd || ""}`).join(", ")}</div>
                  </div>
                  <div className="tutar">
                    {tl(e.toplamTl, 2)} TL
                    <div className="mt-1">
                      <span className={`m-rozet ${e.durum}`}>{e.durumAdi}</span>
                    </div>
                  </div>
                </div>
                <div className="alt">
                  <span>
                    {new Date(e.olusturmaTarihi).toLocaleString("tr-TR", { timeZone: "UTC", dateStyle: "short", timeStyle: "short" })}
                    {e.fisNo ? ` · Fiş ${e.fisNo}` : ""}
                    {e.redNedeni ? ` · ${e.redNedeni}` : ""}
                  </span>
                  {e.durum === "BEKLIYOR" && (
                    <span className="d-flex align-items-center gap-3">
                      <span className="m-sayac">{sure(e.kalanSn)} kaldı</span>
                      <button type="button" className="iptal" onClick={() => void iptal(e.emirId)}>
                        İptal et
                      </button>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Ürün seçimi: alttan açılan liste, fiyatıyla (T5) */}
      <Modal show={seciciAcik} onHide={() => setSeciciAcik(false)} centered scrollable className="m-sheet">
        <Modal.Header closeButton>
          <Modal.Title>{yon === "AL" ? "Ne almak istiyorsunuz?" : "Ne satmak istiyorsunuz?"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {secenekler.length > 8 && <Form.Control className="mb-2" placeholder="Ürün ara" value={arama} autoFocus onChange={(e) => setArama(e.target.value)} />}
          {gorunenSecenekler.length === 0 && <div className="m-bos">Uygun ürün yok.</div>}
          {gorunenSecenekler.map((u) => {
            const f = yonFiyati(u, yon)!;
            return (
              <button key={u.urunId} type="button" className={`m-liste-satir${u.urunId === urunId ? " secili" : ""}`} onClick={() => urunSec(u.urunId)}>
                <div className="ic">
                  <div className="ust">{u.ad}</div>
                  <div className="alt">
                    {u.kod} · {u.birim}
                  </div>
                </div>
                <div className={`fiyat ${yon === "AL" ? "satis" : "alis"}`}>
                  <span className="alt">{karsiEtiket}</span>
                  {tl(f, basamak(f))}
                </div>
              </button>
            );
          })}
        </Modal.Body>
      </Modal>

      <Modal show={onay} onHide={() => setOnay(false)} centered className="m-sheet">
        <Modal.Header closeButton>
          <Modal.Title>Emri onaylayın</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {urun && birimFiyat && tutar && (
            <>
              <div className={`m-emir ${yonSinifi} mb-3`}>
                <div className={`tur ${yonSinifi}`}>{yon === "AL" ? "Alış" : "Satış"}</div>
                <div className="urun fs-5">
                  {m.toLocaleString("tr-TR")} {urun.birim} {urun.ad}
                </div>
              </div>
              <div className="m-ozet mb-2">
                <div className="satir">
                  <span>Birim fiyat</span>
                  <b>{tl(birimFiyat, basamak(birimFiyat))} TL</b>
                </div>
                {tercih && (
                  <div className="satir">
                    <span>Tercihiniz</span>
                    <b>{bilgi.tercihler.find((t) => t.kod === tercih)?.ad}</b>
                  </div>
                )}
                <div className="toplam">
                  <span className="etiket">{yon === "AL" ? "Ödeyeceğiniz" : "Alacağınız"}</span>
                  <span className="deger">{tl(tutar, 2)} TL</span>
                </div>
              </div>
              {yon === "AL" && urun.birim === urun.kod && <div className="m-ipucu mb-1">Döviz alışında yasal vergi (BSMV / KMV) fişte ayrıca eklenir.</div>}
              <div className="m-ipucu">Fiyat {sure(bilgi.gecerlilikSn)} sabittir. Firma bu süre içinde onaylarsa işleminiz kesinleşir; onaylanmazsa emir düşer.</div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setOnay(false)}>
            Vazgeç
          </Button>
          <Button className={`m-buyuk-dugme m-cta ${yonSinifi} px-4`} disabled={mesgul} onClick={() => void gonder()}>
            {mesgul ? <Spinner size="sm" animation="border" /> : "Emri gönder"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default IslemEkrani;

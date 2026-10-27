import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Col, Form, Row, Table } from "react-bootstrap";
import { Link } from "react-router-dom";
import EBelgeCariSec from "./EBelgeCariSec";
import { EbelgeFaturaNoOnerisi, EbelgeGiderIstegi, EbelgeGiderOzet, ebelgeService, ebelgeTutar } from "../../services/ebelgeService";
import { useYerelTaslak } from "./useYerelTaslak";
import GibSorguButonu, { gibSorgula, useGibOtomatikSorgu } from "../../components/common/GibSorguButonu";
import { GibDegerleri, GibDoldurmaSonucu } from "../../utils/gibSorgu";
import {
  IADE_KDV_ORANLARI,
  KUYUM_AYARLARI,
  KUYUM_BIRIMLERI,
  KUYUM_URUN_ONERILERI,
  KuyumForm,
  KuyumSatir,
  STOPAJ_SECENEKLERI,
  birimFiyatHesapla,
  bosKuyumSatir,
  hasGram,
  kuyumFormHatalari,
  kuyumGiderIstegi,
  kuyumSatirAdi,
  kuyumToplam,
  tutarHesapla,
} from "./giderKuyum";
import "./ebelgeForm.css";

const bugun = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const bosForm = (): KuyumForm => ({
  giderTuru: "kuyum",
  seri: "",
  belgeNo: "",
  tarih: bugun(),
  belgeTipi: "SATIS",
  alici: { vknTckn: "", ad: "", soyad: "", unvan: "", il: "", ilce: "", adres: "" },
  stopaj: "0",
  ozelOran: 0,
  iadeKdv: 20,
  satirlar: [bosKuyumSatir()],
  not: "",
});
const sayi = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const gramYaz = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/**
 * e-Gider "Kuyum" formu (docs/E_GIDER_YOL_HARITASI.md K5–K12, K18): kuyumcunun vatandaştan altın / gümüş alımı ve
 * yüz yüze iadesi. turSecici: başlık satırındaki Kuyum / Genel seçimi (EBelgeGiderPage verir).
 */
export default function EBelgeGiderKuyum({ turSecici }: { turSecici?: React.ReactNode }) {
  const [form, setForm] = useState<KuyumForm>(bosForm);
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState("");
  const [hatalar, setHatalar] = useState<string[]>([]);
  const [uyarilar, setUyarilar] = useState<string[]>([]);
  const [uyariOnay, setUyariOnay] = useState(false);
  const [onizleme, setOnizleme] = useState<EbelgeGiderOzet | null>(null);
  const [sonuc, setSonuc] = useState<Awaited<ReturnType<typeof ebelgeService.giderGonder>> | null>(null);
  const [gonderimDenendi, setGonderimDenendi] = useState(false);
  const [pdf, setPdf] = useState<string | null>(null);
  const [oneriler, setOneriler] = useState<EbelgeFaturaNoOnerisi[] | null>(null);
  const [oneriHata, setOneriHata] = useState("");
  // Numara elle yazıldıysa (ya da taslaktan geldiyse) öneri üzerine yazmaz; ref: geç gelen öneri güncel değeri görsün
  const otoNoRef = useRef(true);
  const setOtoNo = (v: boolean) => { otoNoRef.current = v; };
  const [gibMesaji, setGibMesaji] = useState<GibDoldurmaSonucu | null>(null);
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf); }, [pdf]);

  const degistir = (patch: Partial<KuyumForm>) => {
    setForm((o) => ({ ...o, ...patch }));
    setOnizleme(null);
    setUyariOnay(false);
    setUyarilar([]);
  };
  const saticiDegistir = (patch: Partial<KuyumForm["alici"]>) => degistir({ alici: { ...form.alici, ...patch } });
  const satirDegistir = (i: number, yeni: KuyumSatir) => degistir({ satirlar: form.satirlar.map((s, j) => (j === i ? yeni : s)) });

  const taslak = useYerelTaslak<KuyumForm & Record<string, unknown>>("EGiderPusulasi", (t) => {
    setForm({ ...bosForm(), ...t, alici: { ...bosForm().alici, ...(t.alici || {}) }, giderTuru: "kuyum" });
    setOtoNo(false);
  });

  // Seri + sıradaki numara (K11): ayarlardaki EGider serileri; kullanıcı numarayı elle de yazabilir
  const yil = Number(form.tarih.slice(0, 4)) || new Date().getFullYear();
  const onerileriYukle = useCallback(async () => {
    setOneriHata("");
    try {
      const liste = await ebelgeService.faturaNoOnerileri("EGider", yil);
      setOneriler(liste);
      const secili = liste.find((o) => o.varsayilan) || liste[0];
      if (secili) {
        setForm((o) => {
          if (!otoNoRef.current && o.belgeNo) return o;
          const hedef = liste.find((x) => x.seri === o.seri) || secili;
          return { ...o, seri: hedef.seri, belgeNo: hedef.onerilenNo };
        });
      }
    } catch (e: any) {
      setOneriler([]);
      setOneriHata(e?.message || "Numara önerisi alınamadı; numarayı elle yazabilirsiniz.");
    }
  }, [yil]);
  useEffect(() => { void onerileriYukle(); }, [yil]); // eslint-disable-line react-hooks/exhaustive-deps

  // GİB'den ad / soyad (TCKN) ya da ünvan (VKN): boşlar dolar, farklıysa sorulur
  const gibMevcut = (no: string): GibDegerleri =>
    no.replace(/\D/g, "").length === 11 ? { ad: form.alici.ad, soyad: form.alici.soyad } : { unvan: form.alici.unvan };
  const gibUygula = (d: GibDegerleri) => {
    setForm((o) => ({ ...o, alici: { ...o.alici, ad: d.ad ?? o.alici.ad, soyad: d.soyad ?? o.alici.soyad, unvan: d.unvan ?? o.alici.unvan } }));
    setOnizleme(null);
  };
  useGibOtomatikSorgu(
    form.alici.vknTckn,
    (no) => void gibSorgula({ no, mevcut: gibMevcut(no), uygula: gibUygula }).then(setGibMesaji),
    busy || gonderimDenendi
  );

  const toplam = kuyumToplam(form);
  const kimlikUzunluk = form.alici.vknTckn.replace(/\D/g, "").length;
  const saticiAdi = kimlikUzunluk === 10 ? form.alici.unvan : `${form.alici.ad} ${form.alici.soyad}`.trim();

  const taslakKaydet = () =>
    taslak.kaydet(
      { belgeNo: form.belgeNo, aliciVkn: form.alici.vknTckn, aliciUnvan: saticiAdi, paraBirimi: "TRY", tutar: toplam.odenecek },
      form as KuyumForm & Record<string, unknown>
    );

  const gonder = async () => {
    setHata("");
    const h = kuyumFormHatalari(form);
    setHatalar(h);
    if (h.length) return;
    const istek = kuyumGiderIstegi(form) as EbelgeGiderIstegi;
    setBusy(true);
    try {
      // Yerel hesap ve eksik zorunlu içerik uyarısı (engel değil; K10). ICE'ye ön denetim yapılmaz (K14).
      const on = await ebelgeService.giderOnizle(istek);
      setOnizleme(on.ozet);
      if (on.uyarilar?.length && !uyariOnay) {
        setUyarilar(on.uyarilar);
        setBusy(false);
        return;
      }
    } catch (e: any) {
      setHata(e?.message || "Kontrol başarısız.");
      setBusy(false);
      return;
    }
    setGonderimDenendi(true);
    try {
      setSonuc(await ebelgeService.giderGonder(istek));
      await taslak.gonderildi();
    } catch (e: any) {
      setHata(`${e?.message || "Gönderim tamamlanamadı."} Giden kutusunda belge numarasıyla sonucu kontrol edin.`);
    } finally {
      setBusy(false);
    }
  };

  const iade = form.belgeTipi === "IADE";
  const kilitli = busy || gonderimDenendi;

  return (
    <div className="w-100 pb-3">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
        <h5 className="mb-0">e-Gider Pusulası Oluştur</h5>
        {turSecici}
        <Link to="/e-belge/giden">Giden Kutusu</Link>
      </div>
      {hata && <Alert variant="danger">{hata}</Alert>}
      {hatalar.length > 0 && (
        <Alert variant="danger" dismissible onClose={() => setHatalar([])}>
          <div className="fw-semibold mb-1">Eksik ya da hatalı alanlar:</div>
          <ul className="mb-0">{hatalar.map((m) => <li key={m}>{m}</li>)}</ul>
        </Alert>
      )}
      {uyarilar.length > 0 && !sonuc && (
        <Alert variant="warning">
          <ul className="mb-2">{uyarilar.map((m) => <li key={m}>{m}</li>)}</ul>
          <Button size="sm" variant="warning" disabled={kilitli} onClick={() => { setUyariOnay(true); setUyarilar([]); }}>
            Anladım, gönderebilirim
          </Button>
          <span className="small ms-2">Ardından yeniden Gönder'e basın.</span>
        </Alert>
      )}
      {gibMesaji && <Alert variant={gibMesaji.tur} dismissible onClose={() => setGibMesaji(null)}>{gibMesaji.mesaj}</Alert>}
      {taslak.taslakHata && <Alert variant="danger">{taslak.taslakHata}</Alert>}
      {taslak.taslakMesaj && !sonuc && <Alert variant="info">{taslak.taslakMesaj}</Alert>}
      {sonuc && (
        <Alert variant="success">
          {sonuc.belgeNo}: Gönderildi. {sonuc.mesaj}
          <Button size="sm" className="ms-2" onClick={async () => {
            try { setPdf(await ebelgeService.giderPdf(sonuc.uuid)); } catch (e: any) { setHata(e.message); }
          }}>PDF aç</Button>
        </Alert>
      )}
      {pdf && <iframe title="e-Gider PDF" src={pdf} width="100%" height="600" />}

      <fieldset className="eb-yatay" disabled={kilitli}>
        <Card className="mb-3"><Card.Body>
          <Row className="g-2 mb-2">
            <Col md={3}>
              <Form.Label>Seri</Form.Label>
              <Form.Select value={form.seri} onChange={(e) => {
                const o = oneriler?.find((x) => x.seri === e.target.value);
                setOtoNo(true);
                degistir({ seri: e.target.value, belgeNo: o?.onerilenNo || form.belgeNo });
              }}>
                {!oneriler?.length && <option value="">—</option>}
                {oneriler?.map((o) => <option key={o.seri} value={o.seri}>{o.seri}{o.varsayilan ? " (varsayılan)" : ""}</option>)}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Belge no</Form.Label>
              <div className="d-flex gap-1">
                <Form.Control value={form.belgeNo} maxLength={16} placeholder="GDR2026000000001"
                  onChange={(e) => { setOtoNo(false); degistir({ belgeNo: e.target.value.toUpperCase() }); }} />
                <Button size="sm" variant="outline-secondary" title="Sıradaki numarayı yeniden al"
                  onClick={() => { setOtoNo(true); void onerileriYukle(); }}>↻</Button>
              </div>
            </Col>
            <Col md={2}>
              <Form.Label>Tarih</Form.Label>
              <Form.Control type="date" value={form.tarih} onChange={(e) => degistir({ tarih: e.target.value })} />
            </Col>
            <Col md={3}>
              <Form.Label>İşlem</Form.Label>
              <Form.Select value={form.belgeTipi} onChange={(e) => {
                const t = e.target.value as "SATIS" | "IADE";
                degistir({ belgeTipi: t, iadeDayanak: t === "IADE" ? { belgeTipi: "BELGESIZ", belgeTarihi: bugun() } : undefined });
              }}>
                <option value="SATIS">Alış (vatandaştan altın / gümüş)</option>
                <option value="IADE">İade (müşteri malı geri getirdi)</option>
              </Form.Select>
            </Col>
          </Row>
          {oneriHata && <div className="small text-warning mb-2">{oneriHata}</div>}
          {oneriler && !oneriler.length && !oneriHata && (
            <div className="small text-secondary mb-2">
              e-Belge Ayarları'nda e-Gider serisi tanımlı değil; numarayı elle yazın ya da{" "}
              <Link to="/ayarlar/e-belge">seri tanımlayın</Link>.
            </div>
          )}

          <p className="small text-secondary mb-2">
            {iade ? "Malı iade eden müşterinin" : "Malı satan kişinin"} bilgileri. Adres zorunludur (VUK 234).
          </p>
          <EBelgeCariSec onSelect={(c, l) => {
            const adlar = c.ad.trim().split(/\s+/);
            const soyad = adlar.length > 1 ? adlar.pop()! : "";
            degistir({
              alici: {
                vknTckn: c.vergiKimlikNo?.trim() || "",
                unvan: c.ad,
                ad: adlar.join(" "),
                soyad,
                il: l.ilList.find((x) => x.id === c.ilId)?.ad || "",
                ilce: l.ilceList.find((x) => x.id === c.ilceId)?.ad || "",
                adres: c.adres?.trim() || "",
              },
            });
          }} />
          <Row className="g-2">
            <Col md={4}>
              <Form.Label>TC / VKN</Form.Label>
              <div className="input-group">
                <Form.Control value={form.alici.vknTckn} maxLength={11}
                  onChange={(e) => saticiDegistir({ vknTckn: e.target.value.replace(/\D/g, "") })} />
                <GibSorguButonu no={form.alici.vknTckn} mevcut={gibMevcut(form.alici.vknTckn)} uygula={gibUygula} onMesaj={setGibMesaji} />
              </div>
            </Col>
            {kimlikUzunluk === 10 ? (
              <Col md={8}>
                <Form.Label>Ünvan</Form.Label>
                <Form.Control value={form.alici.unvan} onChange={(e) => saticiDegistir({ unvan: e.target.value })} />
              </Col>
            ) : (
              <>
                <Col md={4}><Form.Label>Ad</Form.Label><Form.Control value={form.alici.ad} onChange={(e) => saticiDegistir({ ad: e.target.value })} /></Col>
                <Col md={4}><Form.Label>Soyad</Form.Label><Form.Control value={form.alici.soyad} onChange={(e) => saticiDegistir({ soyad: e.target.value })} /></Col>
              </>
            )}
            <Col md={4}><Form.Label>İl</Form.Label><Form.Control value={form.alici.il} onChange={(e) => saticiDegistir({ il: e.target.value })} /></Col>
            <Col md={4}><Form.Label>İlçe</Form.Label><Form.Control value={form.alici.ilce} onChange={(e) => saticiDegistir({ ilce: e.target.value })} /></Col>
            <Col md={4}><Form.Label>Adres</Form.Label><Form.Control value={form.alici.adres} maxLength={300} placeholder="Mahalle, cadde, no" onChange={(e) => saticiDegistir({ adres: e.target.value })} /></Col>
          </Row>

          {iade && form.iadeDayanak && (
            <Row className="g-2 mt-2">
              <Col md={4}>
                <Form.Label>İade dayanağı</Form.Label>
                <Form.Select value={form.iadeDayanak.belgeTipi}
                  onChange={(e) => degistir({ iadeDayanak: { ...form.iadeDayanak!, belgeTipi: e.target.value as "BELGESIZ" | "EARSIV_FATURA" | "SATIS_FISI" } })}>
                  <option value="BELGESIZ">Belgesiz</option>
                  <option value="EARSIV_FATURA">e-Arşiv fatura</option>
                  <option value="SATIS_FISI">Satış fişi</option>
                </Form.Select>
              </Col>
              <Col md={4}><Form.Label>Dayanak no</Form.Label>
                <Form.Control value={form.iadeDayanak.belgeNo || ""} disabled={form.iadeDayanak.belgeTipi === "BELGESIZ"}
                  onChange={(e) => degistir({ iadeDayanak: { ...form.iadeDayanak!, belgeNo: e.target.value } })} />
              </Col>
              <Col md={4}><Form.Label>Dayanak tarihi</Form.Label>
                <Form.Control type="date" value={form.iadeDayanak.belgeTarihi}
                  onChange={(e) => degistir({ iadeDayanak: { ...form.iadeDayanak!, belgeTarihi: e.target.value } })} />
              </Col>
            </Row>
          )}
        </Card.Body></Card>

        <Card><Card.Body>
          <datalist id="kuyum-urunler">{KUYUM_URUN_ONERILERI.map((u) => <option key={u} value={u} />)}</datalist>
          <Table responsive size="sm" className="align-middle">
            <thead>
              <tr><th>Ürün</th><th>Ayar</th><th>Birim</th><th>Miktar</th><th>Birim fiyat (TRY)</th><th>Tutar (TRY)</th><th /></tr>
            </thead>
            <tbody>
              {form.satirlar.map((s, i) => {
                const has = hasGram(s);
                return (
                  <tr key={i}>
                    <td style={{ minWidth: 180 }}>
                      <Form.Control size="sm" list="kuyum-urunler" value={s.urun} aria-label={`${i + 1}. satır ürün`}
                        onChange={(e) => satirDegistir(i, { ...s, urun: e.target.value })} />
                      {s.urun.trim() && <div className="small text-secondary mt-1">{kuyumSatirAdi(s)}</div>}
                    </td>
                    <td style={{ minWidth: 110 }}>
                      <Form.Select size="sm" value={s.ayar} aria-label={`${i + 1}. satır ayar`} onChange={(e) => satirDegistir(i, { ...s, ayar: e.target.value })}>
                        {KUYUM_AYARLARI.map((a) => <option key={a.kod} value={a.kod}>{a.ad}{a.milyem ? ` (${a.milyem})` : ""}</option>)}
                      </Form.Select>
                    </td>
                    <td style={{ minWidth: 90 }}>
                      <Form.Select size="sm" value={s.birim} aria-label={`${i + 1}. satır birim`}
                        onChange={(e) => satirDegistir(i, { ...s, birim: e.target.value as KuyumSatir["birim"] })}>
                        {KUYUM_BIRIMLERI.map((b) => <option key={b.kod} value={b.kod}>{b.ad}</option>)}
                      </Form.Select>
                    </td>
                    <td style={{ minWidth: 100 }}>
                      <Form.Control size="sm" type="number" step="any" min={0} value={s.miktar || ""} aria-label={`${i + 1}. satır miktar`}
                        onChange={(e) => satirDegistir(i, tutarHesapla({ ...s, miktar: sayi(e.target.value) }))} />
                      {has !== null && <div className="small text-secondary mt-1">Has {gramYaz(has)} gr</div>}
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <Form.Control size="sm" type="number" step="any" min={0} value={s.birimFiyat || ""} aria-label={`${i + 1}. satır birim fiyat`}
                        onChange={(e) => satirDegistir(i, tutarHesapla({ ...s, birimFiyat: sayi(e.target.value) }))} />
                    </td>
                    <td style={{ minWidth: 120 }}>
                      <Form.Control size="sm" type="number" step="any" min={0} value={s.tutar || ""} aria-label={`${i + 1}. satır tutar`}
                        onChange={(e) => satirDegistir(i, birimFiyatHesapla({ ...s, tutar: sayi(e.target.value) }))} />
                    </td>
                    <td>
                      <Button size="sm" variant="outline-danger" disabled={form.satirlar.length === 1}
                        onClick={() => degistir({ satirlar: form.satirlar.filter((_, j) => j !== i) })}>Sil</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Button size="sm" onClick={() => degistir({ satirlar: [...form.satirlar, bosKuyumSatir()] })}>Satır ekle</Button>

          <Row className="g-2 mt-3">
            {!iade ? (
              <>
                <Col md={6}>
                  <Form.Label>Stopaj</Form.Label>
                  <Form.Select value={form.stopaj} onChange={(e) => degistir({ stopaj: e.target.value })}>
                    {STOPAJ_SECENEKLERI.map((s) => <option key={s.kod} value={s.kod}>{s.ad}</option>)}
                  </Form.Select>
                </Col>
                {form.stopaj === "OZEL" && (
                  <Col md={3}>
                    <Form.Label>Oran %</Form.Label>
                    <Form.Control type="number" step="any" min={0} max={100} value={form.ozelOran || ""}
                      onChange={(e) => degistir({ ozelOran: sayi(e.target.value) })} />
                  </Col>
                )}
              </>
            ) : (
              <Col md={4}>
                <Form.Label>İade KDV %</Form.Label>
                <Form.Select value={form.iadeKdv} onChange={(e) => degistir({ iadeKdv: Number(e.target.value) })}>
                  {IADE_KDV_ORANLARI.map((o) => <option key={o} value={o}>%{o}</option>)}
                </Form.Select>
              </Col>
            )}
            <Col md={12}>
              <Form.Label>Not</Form.Label>
              <Form.Control value={form.not} maxLength={1000} placeholder="İsteğe bağlı açıklama" onChange={(e) => degistir({ not: e.target.value })} />
            </Col>
          </Row>
          {iade && (
            <div className="small text-secondary mt-1">
              Özel matrahlı ziynette KDV yalnız işçilikten hesaplanır; oranı buna göre seçin ya da %0 bırakın.
            </div>
          )}

          <Alert variant="info" className="mt-3 mb-3">
            Mal toplamı: {ebelgeTutar(toplam.mal, "TRY")} · {iade ? "KDV" : "Stopaj"} (%{toplam.oran}): {ebelgeTutar(toplam.vergi, "TRY")} ·{" "}
            <strong>{iade ? "Toplam" : "Satıcıya ödenecek"}: {ebelgeTutar(toplam.odenecek, "TRY")}</strong>
            {onizleme && Math.abs(onizleme.odenecekTutar - toplam.odenecek) > 0.011 && (
              <div className="small">Sunucu hesabı: {ebelgeTutar(onizleme.odenecekTutar, "TRY")}</div>
            )}
          </Alert>

          <Button size="sm" variant="secondary" disabled={taslak.taslakBusy} onClick={taslakKaydet}>Taslaklara Kaydet</Button>
          <Button size="sm" className="ms-2" variant="success" onClick={gonder}>Gönder</Button>
        </Card.Body></Card>
      </fieldset>
    </div>
  );
}

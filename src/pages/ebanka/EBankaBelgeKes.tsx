import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Form, Row, Spinner, Table } from "react-bootstrap";
import { IconFileInvoice, IconPlus, IconRefresh, IconSend, IconTrash } from "@tabler/icons-react";
import { EBankaBelgeHazir, EBankaService, MutabakatSatiri } from "../../services/ebankaService";
import { SarrafFisService } from "../../services/sarrafFisService";
import { KurService } from "../../services/kurService";
import { CariService } from "../../services/cariService";
import EBelgeCariSec from "../ebelge/EBelgeCariSec";
import KuyumKodDurbun from "../../components/common/KuyumKodDurbun";
import { paraYaz } from "./ebankaOrtak";
import {
  BelgeAltin,
  BelgeForm,
  BelgeKur,
  BelgeUrun,
  altinTutari,
  belgeIstegi,
  belgeUrunleri,
  bosAlici,
  dovizKuru,
  formHatalari,
  giderTahmini,
  hedefTl,
  satisTahmini,
  tlHesapMi,
  urunFiyati,
  urunSatiri,
  varsayilanUrun,
} from "./ebankaBelgeHesap";

/**
 * Kuyum e-Banka Faturalandırma — "Belge kes" (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF4–EF13, EF21–EF23).
 * Gelen para → kuyum satış faturası (22 ayar altın %0 + 805 / işçilik %20), giden para → kuyum e-Gider pusulası.
 * Fiş açılmaz. "Hazırla" sunucunun kesin hesabını ve ICE doğrulamasını gösterir; "Gönder" belgeyi keser.
 */

const sayiOku = (v: string) => {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const sayiYaz = (n: number, basamak = 2) => (n ? n.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: basamak, useGrouping: false }) : "");

/** Sayı kutusu: yazarken metni korur, odaktan çıkınca sayıya çevirir */
const SayiKutusu: React.FC<{ deger: number; basamak?: number; onDegis: (n: number) => void; disabled?: boolean; placeholder?: string }> = ({ deger, basamak = 2, onDegis, disabled, placeholder }) => {
  const [metin, setMetin] = useState(sayiYaz(deger, basamak));
  const [odak, setOdak] = useState(false);
  useEffect(() => {
    if (!odak) setMetin(sayiYaz(deger, basamak));
  }, [deger, basamak, odak]);
  return (
    <Form.Control size="sm" className="text-end font-monospace" inputMode="decimal" value={metin} disabled={disabled} placeholder={placeholder}
      onFocus={() => setOdak(true)}
      onChange={(e) => {
        setMetin(e.target.value);
        onDegis(sayiOku(e.target.value));
      }}
      onBlur={() => {
        setOdak(false);
        setMetin(sayiYaz(deger, basamak));
      }} />
  );
};

export const EBankaBelgeKes: React.FC<{ satir: MutabakatSatiri; onBitti: (mesaj: string) => void }> = ({ satir, onBitti }) => {
  const yon = satir.yon;
  const dovizHesap = !tlHesapMi(satir.doviz);
  const [urunler, setUrunler] = useState<BelgeUrun[]>([]);
  const [kurlar, setKurlar] = useState<BelgeKur[]>([]);
  const [form, setForm] = useState<BelgeForm>(() => ({
    alici: { ...bosAlici(), vknTckn: satir.karsiNo || "", unvan: satir.cari?.ad || satir.karsiTaraf || "" },
    altinlar: [],
    iscilikKdvOrani: 20,
    iscilikEkle: false,
    iscilik: 0,
    iscilikElle: false,
    kur: satir.kur || 0,
  }));
  const [cariAra, setCariAra] = useState(false);
  const [hazir, setHazir] = useState<EBankaBelgeHazir | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState("");

  const hedef = hedefTl(satir.tutar, satir.doviz, form.kur);
  const degistir = (patch: Partial<BelgeForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setHazir(null);
  };
  const aliciDegistir = (patch: Partial<BelgeForm["alici"]>) => degistir({ alici: { ...form.alici, ...patch } });

  // Ürün listesi + fiyat tablosu (anlık öncelikli, eksik alan günlükten) — Sarraf fişi / e-Gider Kuyum ile aynı kaynak
  useEffect(() => {
    let iptal = false;
    Promise.all([
      SarrafFisService.getUrunler().catch(() => []),
      KurService.getKurTablosu({ tur: 1 }).catch(() => null),
      KurService.getKurTablosu({ tur: 0 }).catch(() => null),
    ]).then(([u, gunluk, anlik]) => {
      if (iptal) return;
      const harita = new Map<string, BelgeKur>();
      const anahtar = (k: BelgeKur) => (k.kod ? k.kod.toLocaleUpperCase("tr-TR").trim() : k.paraId ? `ID_${k.paraId}` : (k.ad || "").toLocaleUpperCase("tr-TR").trim());
      for (const k of (gunluk?.satirlar || []) as BelgeKur[]) if (anahtar(k)) harita.set(anahtar(k), k);
      for (const k of (anlik?.satirlar || []) as BelgeKur[]) {
        const a = anahtar(k);
        if (!a) continue;
        const e = harita.get(a);
        const sec = (x: number | null | undefined, y: number | null | undefined) => (Number(x) > 0 ? x : y ?? null);
        harita.set(a, { ...e, ...k, efektifAlis: sec(k.efektifAlis, e?.efektifAlis), dovizAlis: sec(k.dovizAlis, e?.dovizAlis), efektifSatis: sec(k.efektifSatis, e?.efektifSatis), dovizSatis: sec(k.dovizSatis, e?.dovizSatis) });
      }
      setUrunler(u as BelgeUrun[]);
      setKurlar([...harita.values()]);
    });
    return () => {
      iptal = true;
    };
  }, []);

  // Eşlenen cari varsa kimlik ve adres cari kartından
  useEffect(() => {
    if (!satir.cari) return;
    let iptal = false;
    Promise.all([CariService.getCariKartById(satir.cari.cariKartId), CariService.getLookups()])
      .then(([c, l]) => {
        if (iptal) return;
        const adlar = c.ad.trim().split(/\s+/);
        const soyad = adlar.length > 1 ? adlar.pop()! : "";
        setForm((f) => ({
          ...f,
          alici: {
            ...f.alici,
            vknTckn: c.vergiKimlikNo?.trim() || f.alici.vknTckn,
            unvan: c.ad.trim(),
            ad: adlar.join(" "),
            soyad,
            vergiDairesi: l.vergiDairesiList.find((x) => x.id === c.vergiDairesiId)?.ad || "",
            il: l.ilList.find((x) => x.id === c.ilId)?.ad || "",
            ilce: l.ilceList.find((x) => x.id === c.ilceId)?.ad || "",
            adres: c.adres?.trim() || "",
            eposta: c.eposta?.trim() || "",
            telefon: c.telefon?.trim() || "",
          },
        }));
      })
      .catch(() => undefined);
    return () => {
      iptal = true;
    };
  }, [satir.cari]);

  const secilebilir = useMemo(() => belgeUrunleri(urunler), [urunler]);

  // Döviz hesapta kur otomatik gelir (EF23), elle değiştirilebilir
  const kurGetir = () => {
    const k = dovizKuru(kurlar, satir.doviz || "", yon);
    if (k) degistir({ kur: k });
    else setHata(`${satir.doviz} kuru Anlık Fiyat Listesinde bulunamadı; elle girin.`);
  };
  useEffect(() => {
    if (dovizHesap && !(form.kur > 0) && kurlar.length) {
      const k = dovizKuru(kurlar, satir.doviz || "", yon);
      if (k) setForm((f) => ({ ...f, kur: k }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kurlar]);

  // İlk satır: 22 ayar, gram ön değeri belge tutarı ÷ fiyat (EF9, EF10)
  useEffect(() => {
    if (form.altinlar.length || !urunler.length || !(hedef > 0)) return;
    const u = varsayilanUrun(urunler);
    if (u) setForm((f) => ({ ...f, altinlar: [urunSatiri(u, kurlar, yon, hedef)] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urunler, kurlar, hedef]);

  const satirDegistir = (i: number, patch: Partial<BelgeAltin>) => degistir({ altinlar: form.altinlar.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const urunSec = (i: number, paraId: number) => {
    const u = secilebilir.find((x) => x.paraId === paraId);
    if (!u) return;
    const digerleri = form.altinlar.filter((_, j) => j !== i).reduce((t, a) => t + altinTutari(a), 0);
    degistir({ altinlar: form.altinlar.map((a, j) => (j === i ? urunSatiri(u, kurlar, yon, hedef - digerleri, a) : a)) });
  };
  const fiyatYenile = (i: number) => {
    const a = form.altinlar[i];
    const u = secilebilir.find((x) => x.paraId === a.paraId);
    const f = u ? urunFiyati(u, kurlar, yon) : null;
    if (f) satirDegistir(i, { birimFiyat: f });
  };

  const satis = satisTahmini(form, hedef);
  const gider = giderTahmini(form, hedef);
  const hatalar = formHatalari(form, yon, hedef, dovizHesap);
  const istek = () => belgeIstegi(form, satir.vomsisId, yon, hedef, dovizHesap);

  const hazirla = async () => {
    setHata("");
    setCalisiyor(true);
    try {
      setHazir(await EBankaService.belgeHazirla(istek()));
    } catch (e: any) {
      setHata(e?.message || "Belge hazırlanamadı.");
    } finally {
      setCalisiyor(false);
    }
  };
  const gonder = async () => {
    if (!hazir) return;
    if (!window.confirm(`${hazir.belgeTuruAdi} ${paraYaz(hazir.toplam)} TL olarak kesilecek. GİB'e gönderilen belge geri alınamaz. Gönderilsin mi?`)) return;
    setHata("");
    setCalisiyor(true);
    try {
      const s = await EBankaService.belgeGonder(istek());
      onBitti(`${s.belgeTuruAdi} ${s.belgeNo} gönderildi.${s.mesaj ? " " + s.mesaj : ""}`);
    } catch (e: any) {
      setHata(e?.message || "Belge gönderilemedi.");
    } finally {
      setCalisiyor(false);
    }
  };

  const kisi = yon === "gelen" ? "Alıcı" : "Satıcı";
  return (
    <div className="border rounded p-2 mb-2">
      <div className="fw-bold text-secondary mb-1">
        <IconFileInvoice size={16} className="me-1" />
        Belge kes — {yon === "gelen" ? "satış faturası (e-Fatura / e-Arşiv)" : "e-Gider pusulası"}
      </div>
      <div className="text-muted mb-2">
        {yon === "gelen"
          ? "Altın satırları %0 KDV ve seçilen kodla (altın 805, gümüş 808; dürbünden değişir), kalan tutar işçilik satırına %20 KDV ile yazılır; toplam bankaya gelen paraya kuruşu kuruşuna eşit olur. Fiş açılmaz."
          : "Altın satırı ödenen tutarın tamamıdır; işçilik eklenirse kalan işçilik satırına yazılır. Toplam ödenen tutara eşit olur. Fiş açılmaz."}
      </div>

      {/* Kişi */}
      <Row className="g-2 mb-2">
        <Col md={3}>
          <Form.Label className="small fw-bold mb-0">{kisi} TC / VKN</Form.Label>
          <Form.Control size="sm" value={form.alici.vknTckn} maxLength={11} onChange={(e) => aliciDegistir({ vknTckn: e.target.value.replace(/\D/g, "") })} />
        </Col>
        <Col md={5}>
          <Form.Label className="small fw-bold mb-0">{form.alici.vknTckn.length === 10 ? "Unvan" : "Ad soyad"}</Form.Label>
          <div className="d-flex gap-1">
            <Form.Control size="sm" value={form.alici.unvan} onChange={(e) => aliciDegistir({ unvan: e.target.value, ad: "", soyad: "" })} />
            <Button size="sm" variant="outline-secondary" className="text-nowrap" onClick={() => setCariAra((x) => !x)}>Cari ara</Button>
          </div>
        </Col>
        <Col md={4}>
          <Form.Label className="small fw-bold mb-0">Vergi dairesi</Form.Label>
          <Form.Control size="sm" value={form.alici.vergiDairesi} onChange={(e) => aliciDegistir({ vergiDairesi: e.target.value })} />
        </Col>
        <Col md={3}>
          <Form.Label className="small fw-bold mb-0">İl</Form.Label>
          <Form.Control size="sm" value={form.alici.il} onChange={(e) => aliciDegistir({ il: e.target.value })} />
        </Col>
        <Col md={3}>
          <Form.Label className="small fw-bold mb-0">İlçe</Form.Label>
          <Form.Control size="sm" value={form.alici.ilce} onChange={(e) => aliciDegistir({ ilce: e.target.value })} />
        </Col>
        <Col md={6}>
          <Form.Label className="small fw-bold mb-0">Adres</Form.Label>
          <Form.Control size="sm" value={form.alici.adres} placeholder="Boşsa firmanın il / ilçesi yazılır" onChange={(e) => aliciDegistir({ adres: e.target.value })} />
        </Col>
      </Row>
      {cariAra && (
        <EBelgeCariSec
          onSelect={(c, l) => {
            const adlar = c.ad.trim().split(/\s+/);
            const soyad = adlar.length > 1 ? adlar.pop()! : "";
            setCariAra(false);
            degistir({
              alici: {
                vknTckn: c.vergiKimlikNo?.trim() || "",
                unvan: c.ad.trim(),
                ad: adlar.join(" "),
                soyad,
                vergiDairesi: l.vergiDairesiList.find((x) => x.id === c.vergiDairesiId)?.ad || "",
                il: l.ilList.find((x) => x.id === c.ilId)?.ad || "",
                ilce: l.ilceList.find((x) => x.id === c.ilceId)?.ad || "",
                adres: c.adres?.trim() || "",
                eposta: c.eposta?.trim() || "",
                telefon: c.telefon?.trim() || "",
              },
            });
          }}
        />
      )}

      {/* Tutar / kur */}
      <div className="d-flex flex-wrap align-items-end gap-3 mb-2">
        {dovizHesap && (
          <div style={{ width: 200 }}>
            <Form.Label className="small fw-bold mb-0">{satir.doviz} kuru ({yon === "gelen" ? "döviz alış" : "döviz satış"})</Form.Label>
            <div className="d-flex gap-1">
              <SayiKutusu deger={form.kur} basamak={4} onDegis={(n) => degistir({ kur: n })} />
              <Button size="sm" variant="outline-secondary" title="Anlık Fiyat Listesinden getir" onClick={kurGetir}>
                <IconRefresh size={14} />
              </Button>
            </div>
          </div>
        )}
        <div>
          <div className="small fw-bold text-secondary">Belge tutarı</div>
          <div className="fs-6 fw-bold font-monospace">
            {paraYaz(hedef)} TL
            {dovizHesap && <span className="text-muted fw-normal small ms-2">({paraYaz(satir.tutar)} {satir.doviz})</span>}
          </div>
        </div>
      </div>

      {/* Altın satırları */}
      <Table size="sm" className="mb-2 align-middle">
        <thead>
          <tr className="text-muted">
            <th>Altın</th>
            <th style={{ width: 70 }}>Birim</th>
            <th style={{ width: 120 }} className="text-end">Gram / adet</th>
            {yon === "gelen" && <th style={{ width: 100 }}>KDV kodu</th>}
            <th style={{ width: 170 }} className="text-end">Fiyat</th>
            <th style={{ width: 130 }} className="text-end">Tutar</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {form.altinlar.map((a, i) => (
            <tr key={i}>
              <td>
                <Form.Select size="sm" value={a.paraId ?? ""} onChange={(e) => urunSec(i, Number(e.target.value))}>
                  {!a.paraId && <option value="">{a.ad || "Seçin"}</option>}
                  {secilebilir.map((u) => (
                    <option key={u.paraId} value={u.paraId}>{u.ad}</option>
                  ))}
                </Form.Select>
              </td>
              <td>{a.birim === "GRM" ? "Gram" : "Adet"}</td>
              <td>
                <SayiKutusu deger={a.miktar} basamak={a.birim === "GRM" ? 2 : 0} onDegis={(n) => satirDegistir(i, { miktar: a.birim === "GRM" ? Math.round(n * 100) / 100 : Math.round(n) })} />
              </td>
              {yon === "gelen" && (
                <td>
                  <KuyumKodDurbun value={a.kod || ""} onChange={(kod) => satirDegistir(i, { kod })} isInvalid={!a.kod} />
                </td>
              )}
              <td>
                <div className="d-flex gap-1">
                  <SayiKutusu deger={a.birimFiyat} onDegis={(n) => satirDegistir(i, { birimFiyat: n })} />
                  <Button size="sm" variant="outline-secondary" title="Fiyatı listeden yeniden al" onClick={() => fiyatYenile(i)}>
                    <IconRefresh size={14} />
                  </Button>
                </div>
              </td>
              <td className="text-end font-monospace">{paraYaz(yon === "giden" && form.altinlar.length === 1 ? gider.altin : altinTutari(a))}</td>
              <td className="text-end">
                {form.altinlar.length > 1 && (
                  <Button size="sm" variant="link" className="p-0 text-danger" title="Satırı sil" onClick={() => degistir({ altinlar: form.altinlar.filter((_, j) => j !== i) })}>
                    <IconTrash size={14} />
                  </Button>
                )}
              </td>
            </tr>
          ))}
          {yon === "gelen" && (
            <tr>
              <td colSpan={7}>
                <Button size="sm" variant="link" className="p-0" disabled={!secilebilir.length}
                  onClick={() => {
                    const u = varsayilanUrun(urunler);
                    if (u) degistir({ altinlar: [...form.altinlar, { ...urunSatiri(u, kurlar, yon, 0), miktar: 0 }] });
                  }}>
                  <IconPlus size={14} className="me-1" />
                  Altın satırı ekle
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {/* İşçilik */}
      {yon === "gelen" ? (
        <Row className="g-2 align-items-end mb-2">
          <Col md={2}>
            <Form.Label className="small fw-bold mb-0">İşçilik KDV %</Form.Label>
            <SayiKutusu deger={form.iscilikKdvOrani} onDegis={(n) => degistir({ iscilikKdvOrani: n })} />
          </Col>
          <Col md={10} className="small">
            {satis.asim ? (
              <span className="text-danger fw-bold">Altın tutarı belge tutarını {paraYaz(-satis.kalan)} TL aşıyor; gramı ya da fiyatı düşürün.</span>
            ) : (
              <span className="text-muted">
                Altın {paraYaz(satis.altin)} + işçilik ≈ {paraYaz(satis.matrah)} + KDV ≈ {paraYaz(satis.kdv)} = <b>{paraYaz(hedef)} TL</b>
                {satis.kalan === 0 && " (işçilik satırı olmaz)"}
              </span>
            )}
          </Col>
        </Row>
      ) : (
        <Row className="g-2 align-items-end mb-2">
          <Col md="auto">
            <Form.Check type="switch" id={`iscilik-${satir.vomsisId}`} label="İşçilik ekle" checked={form.iscilikEkle}
              onChange={(e) => degistir({ iscilikEkle: e.target.checked, iscilikElle: false })} />
          </Col>
          {form.iscilikEkle && (
            <Col md={3}>
              <Form.Label className="small fw-bold mb-0">İşçilik tutarı</Form.Label>
              <div className="d-flex gap-1">
                <SayiKutusu deger={gider.iscilik} onDegis={(n) => degistir({ iscilik: n, iscilikElle: true })} />
                <Button size="sm" variant="outline-secondary" title="Kalanı yeniden hesapla" onClick={() => degistir({ iscilikElle: false })}>
                  <IconRefresh size={14} />
                </Button>
              </div>
            </Col>
          )}
          <Col className="small text-muted">
            Altın {paraYaz(gider.altin)}{form.iscilikEkle ? ` + işçilik ${paraYaz(gider.iscilik)}` : ""} = <b>{paraYaz(hedef)} TL</b> · GV stopajı %0
          </Col>
        </Row>
      )}

      {hatalar.length > 0 && (
        <Alert variant="light" className="border py-1 px-2 small mb-2">
          {hatalar.map((h) => (
            <div key={h}>• {h}</div>
          ))}
        </Alert>
      )}
      {hata && <Alert variant="danger" className="py-1 px-2 small mb-2">{hata}</Alert>}

      <div className="d-flex gap-2">
        <Button size="sm" variant="outline-primary" disabled={calisiyor || hatalar.length > 0} onClick={hazirla}>
          {calisiyor && !hazir ? <Spinner size="sm" className="me-1" /> : <IconFileInvoice size={14} className="me-1" />}
          Hazırla ve kontrol et
        </Button>
        {hazir && (
          <Button size="sm" variant="primary" disabled={calisiyor} onClick={gonder}>
            {calisiyor ? <Spinner size="sm" className="me-1" /> : <IconSend size={14} className="me-1" />}
            {hazir.belgeTuruAdi} olarak gönder
          </Button>
        )}
      </div>

      {hazir && (
        <div className="mt-2">
          <div className="small text-secondary mb-1">
            <b>{hazir.belgeTuruAdi}</b> · önerilen no {hazir.belgeNo} (gönderimde seriden yeniden alınır) · tarih {hazir.tarih.split("-").reverse().join(".")}
          </div>
          <Table size="sm" bordered className="small mb-1">
            <thead className="table-light">
              <tr>
                <th>Mal / hizmet</th>
                <th className="text-end">Miktar</th>
                <th className="text-end">Fiyat</th>
                <th className="text-end">{hazir.tur === "fatura" ? "KDV %" : "Stopaj %"}</th>
                <th className="text-end">Tutar</th>
                <th className="text-end">{hazir.tur === "fatura" ? "KDV" : "Stopaj"}</th>
              </tr>
            </thead>
            <tbody>
              {hazir.satirlar.map((s, i) => (
                <tr key={i}>
                  <td>{s.ad}</td>
                  <td className="text-end font-monospace">{s.miktar.toLocaleString("tr-TR", { maximumFractionDigits: 3 })} {s.birim}</td>
                  <td className="text-end font-monospace">{s.birimFiyat.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                  <td className="text-end">%{s.kdvOrani}</td>
                  <td className="text-end font-monospace">
                    {paraYaz(s.tutar)}
                    {s.iskonto ? <div className="text-muted">iskonto {paraYaz(s.iskonto)}</div> : null}
                  </td>
                  <td className="text-end font-monospace">{paraYaz(s.kdv)}</td>
                </tr>
              ))}
              <tr className="fw-bold">
                <td colSpan={4} className="text-end">Ödenecek</td>
                <td colSpan={2} className="text-end font-monospace">{paraYaz(hazir.toplam)} TL</td>
              </tr>
            </tbody>
          </Table>
          {hazir.uyarilar.map((u) => (
            <Alert key={u} variant="warning" className="py-1 px-2 small mb-1">{u}</Alert>
          ))}
          {hazir.onizlemeHtml && (
            <iframe title="Belge önizlemesi" sandbox="allow-scripts" srcDoc={hazir.onizlemeHtml} className="w-100 border rounded bg-white" style={{ height: 600 }} />
          )}
        </div>
      )}
    </div>
  );
};

export default EBankaBelgeKes;

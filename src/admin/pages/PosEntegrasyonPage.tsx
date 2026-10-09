import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Col, Form, Row, Spinner, Tab, Table, Tabs } from "react-bootstrap";
import { v4 as uuid } from "uuid";
import {
  adminApi,
  AdminApiHatasi,
  PosDenemeIslemi,
  PosDogrulamaModeli,
  PosDogrulamaSonucu,
  PosKonsolFirma,
  PosKonsolTerminal,
  PosLogu,
  PosMerkezAyar,
  PosMerkezAyarGirdi,
  PosSenaryo,
  tarihYaz,
} from "../services/adminApi";

// POS cihazı entegrasyonu (Inpos + Beko) — docs/POS_ENTEGRASYON_YOL_HARITASI.md, 3.5
// Doğrulama sekmesi kabul ölçütüdür: bir modelde tüm senaryolar Geçti olunca o model "Doğrulandı" sayılır.

const paraYaz = (n: number): string => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const DURUM_ADI: Record<string, string> = { BEKLIYOR: "Cihazda bekliyor", ONAY: "Onaylandı", RET: "Reddedildi", IPTAL: "İptal", BELIRSIZ: "Belirsiz" };
const DURUM_RENGI: Record<string, string> = { BEKLIYOR: "primary", ONAY: "success", RET: "danger", IPTAL: "danger", BELIRSIZ: "warning" };

const SonucRozeti: React.FC<{ sonuc: PosDogrulamaSonucu | null }> = ({ sonuc }) =>
  sonuc === "GECTI" ? <Badge bg="success">Geçti</Badge> : sonuc === "KALDI" ? <Badge bg="danger">Kaldı</Badge> : <Badge bg="secondary">Denenmedi</Badge>;

// ─── Doğrulama ───────────────────────────────────────────────────────────────

const Dogrulama: React.FC<{ modeller: PosDogrulamaModeli[] | null; hata: string | null; isaretle: (model: string, senaryoNo: number, sonuc: PosDogrulamaSonucu | null, notu?: string) => Promise<void> }> = ({
  modeller,
  hata,
  isaretle,
}) => {
  const [notlar, setNotlar] = useState<Record<string, string>>({});
  const [calisan, setCalisan] = useState<string | null>(null);

  if (hata) return <Alert variant="danger">{hata}</Alert>;
  if (!modeller) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" />
      </div>
    );
  }

  const calistir = async (m: PosDogrulamaModeli, s: PosSenaryo, sonuc: PosDogrulamaSonucu | null) => {
    const anahtar = `${m.model}-${s.no}`;
    setCalisan(anahtar);
    try {
      await isaretle(m.model, s.no, sonuc, notlar[anahtar] ?? s.notu ?? "");
    } finally {
      setCalisan(null);
    }
  };

  return (
    <>
      {modeller.map((m) => (
        <div key={m.model} className="border rounded mb-4">
          <div className="d-flex flex-wrap align-items-center gap-2 px-3 py-2 bg-light">
            <span className="fw-semibold">{m.ad}</span>
            <span className="text-muted small">
              {m.gecenAdet} / {m.senaryolar.length} senaryo geçti
            </span>
            {m.dogrulandi ? (
              <Badge bg="success" className="ms-auto">
                Doğrulandı · {tarihYaz(m.dogrulamaTarihi)}
              </Badge>
            ) : (
              <Badge bg="secondary" className="ms-auto">
                Doğrulanmadı
              </Badge>
            )}
          </div>
          <Table hover responsive size="sm" className="align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th>Senaryo</th>
                <th>Geçme Şartı</th>
                <th>Sonuç</th>
                <th style={{ width: 220 }}>Not</th>
                <th>İşaretleyen</th>
                <th className="text-end">İşaret</th>
              </tr>
            </thead>
            <tbody>
              {m.senaryolar.map((s) => {
                const anahtar = `${m.model}-${s.no}`;
                return (
                  <tr key={s.no}>
                    <td>{s.no}</td>
                    <td className="fw-semibold">{s.ad}</td>
                    <td className="small text-muted">{s.gecmeSarti}</td>
                    <td>
                      <SonucRozeti sonuc={s.sonuc} />
                    </td>
                    <td>
                      <Form.Control size="sm" maxLength={300} value={notlar[anahtar] ?? s.notu ?? ""} onChange={(e) => setNotlar((n) => ({ ...n, [anahtar]: e.target.value }))} />
                    </td>
                    <td className="small text-nowrap">{s.admin ? `${s.admin} · ${tarihYaz(s.tarih)}` : "-"}</td>
                    <td className="text-end text-nowrap">
                      <Button size="sm" variant="outline-success" className="me-1" disabled={calisan !== null} onClick={() => calistir(m, s, "GECTI")}>
                        Geçti
                      </Button>
                      <Button size="sm" variant="outline-danger" className="me-1" disabled={calisan !== null} onClick={() => calistir(m, s, "KALDI")}>
                        Kaldı
                      </Button>
                      <Button size="sm" variant="outline-secondary" disabled={calisan !== null || s.sonuc === null} onClick={() => calistir(m, s, null)}>
                        Kaldır
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      ))}
    </>
  );
};

// ─── Test konsolu ────────────────────────────────────────────────────────────

type Olay = "BAGLANTI" | "MESGUL" | "AYNI" | null;

const Konsol: React.FC<{ modeller: PosDogrulamaModeli[] | null; isaretle: (model: string, senaryoNo: number, sonuc: PosDogrulamaSonucu | null, notu?: string) => Promise<void> }> = ({ modeller, isaretle }) => {
  const [firmalar, setFirmalar] = useState<PosKonsolFirma[] | null>(null);
  const [firmaId, setFirmaId] = useState("");
  const [terminaller, setTerminaller] = useState<PosKonsolTerminal[]>([]);
  const [terminalId, setTerminalId] = useState("");
  const [gercek, setGercek] = useState(false);
  const [tutar, setTutar] = useState("1,00");
  const [belgeTipi, setBelgeTipi] = useState<"earsiv" | "efatura">("earsiv");
  const [senaryoNo, setSenaryoNo] = useState("");
  const [islem, setIslem] = useState<PosDenemeIslemi | null>(null);
  const [sonKimlik, setSonKimlik] = useState<string | null>(null);
  const [olay, setOlay] = useState<Olay>(null);
  const [mesaj, setMesaj] = useState<{ tur: "success" | "danger"; metin: string } | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  useEffect(() => {
    adminApi
      .posFirmalar()
      .then(setFirmalar)
      .catch((err) => {
        setFirmalar([]);
        setMesaj({ tur: "danger", metin: err?.message || "Firmalar getirilemedi." });
      });
  }, []);

  useEffect(() => {
    setTerminaller([]);
    setTerminalId("");
    setIslem(null);
    if (!firmaId) return;
    let iptal = false;
    adminApi
      .posTerminaller(Number(firmaId))
      .then((t) => !iptal && setTerminaller(t.filter((x) => x.aktif && x.entegrasyon !== "yok")))
      .catch((err) => !iptal && setMesaj({ tur: "danger", metin: err?.message || "Cihazlar getirilemedi." }));
    return () => {
      iptal = true;
    };
  }, [firmaId]);

  // Bekleyen denemeyi yokla
  const bekleyenId = islem?.durum === "BEKLIYOR" ? islem.posIslemId : null;
  useEffect(() => {
    if (!bekleyenId || !firmaId) return;
    const t = window.setInterval(async () => {
      try {
        setIslem(await adminApi.posDenemeIslemi(Number(firmaId), bekleyenId));
      } catch {
        // Geçici hata: bir sonraki yoklamada yeniden denenir
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [bekleyenId, firmaId]);

  const terminal = terminaller.find((t) => t.posTerminalId === Number(terminalId)) || null;
  const senaryo = useMemo(() => modeller?.find((m) => m.model === terminal?.model)?.senaryolar.find((s) => s.no === Number(senaryoNo)) || null, [modeller, terminal, senaryoNo]);

  const calistir = async (is: () => Promise<void>) => {
    setCalisiyor(true);
    setMesaj(null);
    try {
      await is();
    } catch (err: any) {
      // 409 başka nedenlerle de dönebilir (ör. tablolar kurulmamış); yalnızca "cihaz meşgul" reddi senaryo 9'u geçirir
      if (err instanceof AdminApiHatasi && err.status === 409 && /başka bir işlemde/.test(err.message)) setOlay("MESGUL");
      setMesaj({ tur: "danger", metin: err?.message || "İşlem yapılamadı." });
    } finally {
      setCalisiyor(false);
    }
  };

  const baglantiDene = () =>
    calistir(async () => {
      setOlay(null);
      const s = await adminApi.posBaglantiTesti(Number(firmaId), Number(terminalId), gercek);
      setOlay("BAGLANTI");
      setMesaj({ tur: "success", metin: s.ayrinti });
    });

  const gonder = (ayniIstek: boolean) =>
    calistir(async () => {
      setOlay(null);
      const tutarSayi = Number(tutar.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(tutarSayi) || tutarSayi <= 0) throw new Error("Tutar sıfırdan büyük olmalıdır.");
      const kimlik = ayniIstek && sonKimlik ? sonKimlik : uuid();
      const onceki = islem?.posIslemId ?? null;
      const yeni = await adminApi.posDeneme(Number(firmaId), { istekKimlik: kimlik, posTerminalId: Number(terminalId), tutar: tutarSayi, belgeTipi, gercek });
      setSonKimlik(kimlik);
      setIslem(yeni);
      if (ayniIstek && onceki !== null && yeni.posIslemId === onceki) {
        setOlay("AYNI");
        setMesaj({ tur: "success", metin: `Aynı istek yeniden gönderildi: yeni işlem açılmadı, #${yeni.posIslemId} döndü.` });
      }
    });

  const kimlikDene = (saglayici: "token" | "inpos") =>
    calistir(async () => {
      const s = await adminApi.posKimlikTesti(saglayici);
      setMesaj({ tur: "success", metin: s.ayrinti });
    });

  /** Seçili senaryonun beklenen sonucuna göre öneri; sonuç henüz yoksa ya da senaryo elle değerlendiriliyorsa null */
  const oneri: PosDogrulamaSonucu | null = useMemo(() => {
    const b = senaryo?.beklenen;
    if (!b) return null;
    if (b === "BAGLANTI" || b === "MESGUL" || b === "AYNI") return olay === b ? "GECTI" : null;
    if (!islem || islem.durum === "BEKLIYOR") return null;
    return islem.durum === b && !(b === "ONAY" && islem.elle) ? "GECTI" : "KALDI";
  }, [senaryo, olay, islem]);

  const hazir = Boolean(firmaId && terminalId);

  return (
    <>
      {mesaj && (
        <Alert variant={mesaj.tur} dismissible onClose={() => setMesaj(null)}>
          {mesaj.metin}
        </Alert>
      )}

      <Row className="g-3 mb-3">
        <Col md={4}>
          <Form.Label className="small fw-semibold mb-1">Firma</Form.Label>
          <Form.Select size="sm" value={firmaId} onChange={(e) => setFirmaId(e.target.value)}>
            <option value="">{firmalar === null ? "Yükleniyor…" : "Seçiniz"}</option>
            {firmalar?.map((f) => (
              <option key={f.firmaId} value={f.firmaId}>
                {f.firmaKodu} - {f.unvan} ({f.mod === "canli" ? "Canlı" : "Test"})
              </option>
            ))}
          </Form.Select>
          {firmalar?.length === 0 && <div className="text-muted small mt-1">POS modu Test ya da Canlı olan firma yok. Firma Detay › POS sekmesinden açın.</div>}
        </Col>
        <Col md={4}>
          <Form.Label className="small fw-semibold mb-1">Cihaz</Form.Label>
          <Form.Select size="sm" value={terminalId} disabled={!firmaId} onChange={(e) => setTerminalId(e.target.value)}>
            <option value="">Seçiniz</option>
            {terminaller.map((t) => (
              <option key={t.posTerminalId} value={t.posTerminalId}>
                {t.ad} ({t.model || t.entegrasyon})
              </option>
            ))}
          </Form.Select>
          {firmaId && !terminaller.length && <div className="text-muted small mt-1">Bu firmada entegrasyonlu, aktif cihaz tanımı yok (Banka › POS Cihazları).</div>}
        </Col>
        <Col md={4}>
          <Form.Label className="small fw-semibold mb-1">Senaryo</Form.Label>
          <Form.Select size="sm" value={senaryoNo} onChange={(e) => setSenaryoNo(e.target.value)}>
            <option value="">Serbest deneme</option>
            {modeller?.[0]?.senaryolar.map((s) => (
              <option key={s.no} value={s.no}>
                {s.no}. {s.ad}
              </option>
            ))}
          </Form.Select>
          {senaryo && <div className="text-muted small mt-1">{senaryo.gecmeSarti}</div>}
        </Col>
      </Row>

      <div className="border rounded p-3 mb-3">
        <div className="d-flex flex-wrap gap-4 mb-2">
          <Form.Check type="radio" id="pos-hedef-ornek" name="pos-hedef" label="Örnek cihaz" checked={!gercek} onChange={() => setGercek(false)} />
          <Form.Check type="radio" id="pos-hedef-gercek" name="pos-hedef" label="Gerçek cihaz" checked={gercek} onChange={() => setGercek(true)} />
        </div>
        {gercek ? (
          <Alert variant="danger" className="py-2 small">
            Tutar gerçek cihaza gönderilir. Kart okutulursa <strong>para çekilir</strong>; iadesi cihazdan yapılır. Her gerçek deneme işlem kaydına yazılır.
          </Alert>
        ) : (
          <Alert variant="light" className="border py-2 small">
            Örnek cihazda sonuç tutarın kuruşuna göre belirlenir: <code>,01</code> ret · <code>,02</code> cihazda vazgeçme · <code>,03</code> hiç cevap yok · <code>,06</code> <code>,09</code>{" "}
            <code>,12</code> taksitli onay · diğerleri tek çekim onay.
          </Alert>
        )}

        <Row className="g-2 align-items-end">
          <Col md={3} xs={6}>
            <Form.Label className="small fw-semibold mb-1">Tutar (TL)</Form.Label>
            <Form.Control size="sm" inputMode="decimal" className="text-end" value={tutar} onChange={(e) => setTutar(e.target.value)} />
          </Col>
          <Col md={3} xs={6}>
            <Form.Label className="small fw-semibold mb-1">Bilgi Fişi</Form.Label>
            <Form.Select size="sm" value={belgeTipi} onChange={(e) => setBelgeTipi(e.target.value as "earsiv" | "efatura")}>
              <option value="earsiv">e-Arşiv</option>
              <option value="efatura">e-Fatura</option>
            </Form.Select>
          </Col>
          <Col md={6} className="d-flex flex-wrap gap-2">
            <Button size="sm" variant="outline-secondary" disabled={!hazir || calisiyor} onClick={baglantiDene}>
              Bağlantıyı Dene
            </Button>
            <Button size="sm" className="btn-adm" disabled={!hazir || calisiyor || islem?.durum === "BEKLIYOR"} onClick={() => gonder(false)}>
              {calisiyor ? <Spinner animation="border" size="sm" /> : "Deneme Tahsilatı Gönder"}
            </Button>
            <Button size="sm" variant="outline-secondary" disabled={!hazir || calisiyor || !sonKimlik} onClick={() => gonder(true)}>
              Aynı İsteği Yeniden Gönder
            </Button>
            <Button size="sm" variant="outline-secondary" disabled={!hazir || calisiyor} onClick={() => gonder(false)} title="Cihaz bir işlemdeyken ikinci isteğin reddedildiğini sınar">
              İkinci İstek Gönder
            </Button>
          </Col>
        </Row>
      </div>

      {islem && (
        <div className="border rounded p-3 mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span className="fw-semibold">Deneme #{islem.posIslemId}</span>
            <span className="font-monospace">{paraYaz(islem.tutar)} TL</span>
            <Badge bg={DURUM_RENGI[islem.durum]} text={islem.durum === "BELIRSIZ" ? "dark" : undefined}>
              {DURUM_ADI[islem.durum]}
              {islem.elle ? " (elle)" : ""}
            </Badge>
            <Badge bg={islem.mod === "canli" ? "danger" : "secondary"}>{islem.mod === "canli" ? "Gerçek cihaz" : "Örnek cihaz"}</Badge>
            {islem.durum === "BEKLIYOR" && (
              <span className="text-muted small">
                <Spinner animation="border" size="sm" className="me-1" />
                {islem.gecenSaniye ?? 0} sn
              </span>
            )}
          </div>
          <div className="small text-muted mb-2">
            {[
              islem.terminalAd,
              islem.bankaAdi,
              islem.taksit ? `${islem.taksit} taksit` : null,
              islem.onayKodu ? `Onay ${islem.onayKodu}` : null,
              islem.kartNo,
              islem.cihazFisNo ? `Fiş ${islem.cihazFisNo}` : null,
              islem.zNo ? `Z ${islem.zNo}` : null,
              islem.hata,
            ]
              .filter(Boolean)
              .join(" · ") || "-"}
          </div>
          <div className="d-flex flex-wrap gap-2">
            {islem.durum === "BEKLIYOR" && (
              <Button size="sm" variant="outline-danger" disabled={calisiyor} onClick={() => calistir(async () => setIslem(await adminApi.posDenemeIptal(Number(firmaId), islem.posIslemId)))}>
                İptal Et
              </Button>
            )}
            {(islem.durum === "BEKLIYOR" || islem.durum === "BELIRSIZ") && (
              <>
                <Button size="sm" variant="outline-success" disabled={calisiyor} onClick={() => calistir(async () => setIslem(await adminApi.posDenemeElle(Number(firmaId), islem.posIslemId, true)))}>
                  Alındı Olarak İşaretle
                </Button>
                <Button size="sm" variant="outline-secondary" disabled={calisiyor} onClick={() => calistir(async () => setIslem(await adminApi.posDenemeElle(Number(firmaId), islem.posIslemId, false)))}>
                  Alınmadı Olarak İşaretle
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {senaryo && terminal?.model && (
        <div className="border rounded p-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <span className="fw-semibold">
              {terminal.model} · Senaryo {senaryo.no}: {senaryo.ad}
            </span>
            <SonucRozeti sonuc={senaryo.sonuc} />
            {oneri && <span className="small text-muted">Bu denemeye göre öneri: {oneri === "GECTI" ? "Geçti" : "Kaldı"}</span>}
            <span className="ms-auto d-flex gap-2">
              <Button size="sm" variant={oneri === "GECTI" ? "success" : "outline-success"} disabled={!gercek || calisiyor} onClick={() => calistir(() => isaretle(terminal.model!, senaryo.no, "GECTI"))}>
                Geçti İşaretle
              </Button>
              <Button size="sm" variant={oneri === "KALDI" ? "danger" : "outline-danger"} disabled={!gercek || calisiyor} onClick={() => calistir(() => isaretle(terminal.model!, senaryo.no, "KALDI"))}>
                Kaldı İşaretle
              </Button>
            </span>
          </div>
          {!gercek && <div className="text-muted small mt-2">Doğrulama işareti yalnızca gerçek cihazla yapılan denemeye konur.</div>}
        </div>
      )}

      <div className="mt-3 d-flex flex-wrap gap-2">
        <Button size="sm" variant="outline-secondary" disabled={calisiyor} onClick={() => kimlikDene("token")}>
          Beko (Token) Kimliğini Dene
        </Button>
        <Button size="sm" variant="outline-secondary" disabled={calisiyor} onClick={() => kimlikDene("inpos")}>
          Inpos Kimliğini Dene
        </Button>
      </div>
    </>
  );
};

// ─── Ayarlar ─────────────────────────────────────────────────────────────────

const Ayarlar: React.FC = () => {
  const [ayar, setAyar] = useState<PosMerkezAyar | null>(null);
  const [form, setForm] = useState<PosMerkezAyarGirdi>({
    tokenClientId: "",
    tokenClientSecret: "",
    tokenAuthUrl: "",
    tokenApiUrl: "",
    donusKok: "",
    inposUygulamaNo: "",
    inposApiUrl: "",
    inposKullanici: "",
    inposSifre: "",
    inposWebhookKullanici: "",
    inposWebhookSifre: "",
  });
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const doldur = (a: PosMerkezAyar) => {
    setAyar(a);
    setForm({
      tokenClientId: a.tokenClientId,
      tokenClientSecret: "",
      tokenAuthUrl: a.tokenAuthUrl,
      tokenApiUrl: a.tokenApiUrl,
      donusKok: a.donusKok,
      inposUygulamaNo: a.inposUygulamaNo,
      inposApiUrl: a.inposApiUrl,
      inposKullanici: a.inposKullanici,
      inposSifre: "",
      inposWebhookKullanici: a.inposWebhookKullanici,
      inposWebhookSifre: "",
    });
  };

  useEffect(() => {
    adminApi
      .posAyar()
      .then(doldur)
      .catch((err) => setHata(err?.message || "POS ayarları getirilemedi."));
  }, []);

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    setKaydediliyor(true);
    setHata(null);
    setBilgi(null);
    try {
      doldur(
        await adminApi.posAyarKaydet({
          ...form,
          tokenClientSecret: form.tokenClientSecret || undefined,
          inposSifre: form.inposSifre || undefined,
          inposWebhookSifre: form.inposWebhookSifre || undefined,
        })
      );
      setBilgi("POS ayarları kaydedildi.");
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    } finally {
      setKaydediliyor(false);
    }
  };

  if (!ayar) {
    return hata ? (
      <Alert variant="danger">{hata}</Alert>
    ) : (
      <div className="text-center py-4">
        <Spinner animation="border" />
      </div>
    );
  }

  const alan = (etiket: string, ad: keyof PosMerkezAyarGirdi, ek?: { tur?: string; yer?: string }) => (
    <Form.Group className="mb-3">
      <Form.Label className="small fw-semibold mb-1">{etiket}</Form.Label>
      <Form.Control size="sm" type={ek?.tur || "text"} placeholder={ek?.yer} autoComplete="off" value={form[ad] || ""} disabled={!ayar.tablolarKurulu} onChange={(e) => setForm({ ...form, [ad]: e.target.value })} />
    </Form.Group>
  );

  return (
    <Form onSubmit={kaydet} style={{ maxWidth: 640 }}>
      {hata && <Alert variant="danger">{hata}</Alert>}
      {bilgi && (
        <Alert variant="success" dismissible onClose={() => setBilgi(null)}>
          {bilgi}
        </Alert>
      )}
      {!ayar.tablolarKurulu && (
        <Alert variant="warning">
          POS tabloları merkez veritabanında kurulmamış. Sunucuda <code>docs/sql/LIKYA_ADMIN_POS.sql</code> betiğini çalıştırın.
        </Alert>
      )}

      <h6 className="mb-3">Beko (Token)</h6>
      {alan("Client ID", "tokenClientId")}
      {alan("Client Secret", "tokenClientSecret", { tur: "password", yer: ayar.tokenClientSecretTanimli ? "Kayıtlı (değiştirmek için yazın)" : "" })}
      {alan("Kimlik Adresi (auth)", "tokenAuthUrl", { yer: "https://…" })}
      {alan("Servis Adresi (sepet)", "tokenApiUrl", { yer: "https://…" })}
      {alan("Sunucunun Dış Adresi", "donusKok", { yer: "https://likyakuyum.com" })}

      <h6 className="mb-3 mt-4">Inpos (TSM bulut)</h6>
      {alan("Servis Adresi", "inposApiUrl", { yer: "https://tsmtest.inpos.com.tr" })}
      {alan("Portal Kullanıcı Adı", "inposKullanici")}
      {alan("Portal Şifresi", "inposSifre", { tur: "password", yer: ayar.inposSifreTanimli ? "Kayıtlı (değiştirmek için yazın)" : "" })}
      {alan("Bildirim (Webhook) Kullanıcı Adı", "inposWebhookKullanici")}
      {alan("Bildirim (Webhook) Şifresi", "inposWebhookSifre", { tur: "password", yer: ayar.inposWebhookSifreTanimli ? "Kayıtlı (değiştirmek için yazın)" : "" })}
      <Form.Group className="mb-3">
        <Form.Label className="small fw-semibold mb-1">Portala Yazılacak Bildirim Adresi</Form.Label>
        <Form.Control size="sm" readOnly value={ayar.inposWebhookAdresi || "Önce sunucunun dış adresini girin"} />
        <Form.Text className="text-muted">
          Inpos portalı › Entegrasyon › Webhook Konfigürasyonu › <strong>Sipariş Durum Güncelleme</strong> alanına bu adres, kimlik doğrulama türü Basic Auth ve yukarıdaki bildirim kullanıcı adı / şifresi
          yazılır. Listeleme ve detay webhook'ları boş bırakılır (siparişler Inpos'ta tutulur).
        </Form.Text>
      </Form.Group>
      {alan("Uygulama Numarası (GMP3, kullanılmıyor)", "inposUygulamaNo")}

      <div className="d-flex align-items-center gap-3">
        <Button type="submit" size="sm" className="btn-adm" disabled={!ayar.tablolarKurulu || kaydediliyor}>
          {kaydediliyor ? <Spinner animation="border" size="sm" /> : "Kaydet"}
        </Button>
        {ayar.guncellemeTarihi && <span className="text-muted small">Son değişiklik: {tarihYaz(ayar.guncellemeTarihi)}</span>}
      </div>
    </Form>
  );
};

// ─── Günlük ──────────────────────────────────────────────────────────────────

const jsonYaz = (metin: string | null): string => {
  if (!metin) return "";
  try {
    return JSON.stringify(JSON.parse(metin), null, 2);
  } catch {
    return metin;
  }
};

const Gunluk: React.FC = () => {
  const [satirlar, setSatirlar] = useState<PosLogu[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [acik, setAcik] = useState<number | null>(null);

  const yukle = useCallback(async () => {
    try {
      setSatirlar(await adminApi.posLog(100));
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "Günlük getirilemedi.");
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="text-muted small">Cihaz servisine giden istekler ve cihazdan gelen bildirimler (son 100).</span>
        <Button size="sm" variant="outline-secondary" onClick={yukle}>
          Yenile
        </Button>
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
        <Table hover responsive size="sm" className="align-middle mb-0">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Tür</th>
              <th>Firma</th>
              <th>Özet</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {satirlar.map((l) => (
              <React.Fragment key={l.logId}>
                <tr>
                  <td className="text-nowrap">{tarihYaz(l.tarih)}</td>
                  <td>
                    <Badge bg={l.tur === "DONUS" ? "info" : "secondary"}>{l.tur === "DONUS" ? "Bildirim" : "İstek"}</Badge>
                  </td>
                  <td>{l.firmaKodu || "-"}</td>
                  <td className={l.basarili ? "" : "text-danger"}>{l.ozet}</td>
                  <td className="text-end">
                    {(l.istek || l.yanit) && (
                      <Button size="sm" variant="link" className="p-0 text-decoration-none" onClick={() => setAcik(acik === l.logId ? null : l.logId)}>
                        {acik === l.logId ? "Gizle" : "Ayrıntı"}
                      </Button>
                    )}
                  </td>
                </tr>
                {acik === l.logId && (
                  <tr>
                    <td colSpan={5} className="bg-light">
                      {l.istek && (
                        <>
                          <div className="small fw-semibold">Giden</div>
                          <pre className="small mb-2" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                            {jsonYaz(l.istek)}
                          </pre>
                        </>
                      )}
                      {l.yanit && (
                        <>
                          <div className="small fw-semibold">Gelen</div>
                          <pre className="small mb-0" style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                            {jsonYaz(l.yanit)}
                          </pre>
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
};

// ─── Sayfa ───────────────────────────────────────────────────────────────────

const PosEntegrasyonPage: React.FC = () => {
  const [modeller, setModeller] = useState<PosDogrulamaModeli[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .posDogrulama()
      .then((s) => setModeller(s.modeller))
      .catch((err) => setHata(err?.message || "Doğrulama durumu getirilemedi."));
  }, []);

  const isaretle = useCallback(async (model: string, senaryoNo: number, sonuc: PosDogrulamaSonucu | null, notu?: string) => {
    try {
      setModeller((await adminApi.posDogrulamaYaz({ model, senaryoNo, sonuc, notu })).modeller);
      setHata(null);
    } catch (err: any) {
      setHata(err?.message || "İşaret kaydedilemedi.");
      throw err;
    }
  }, []);

  return (
    <Card className="shadow-sm">
      <Card.Body className="p-4">
        <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
          <h5 className="mb-0">POS Entegrasyonu</h5>
          {modeller?.map((m) => (
            <Badge key={m.model} bg={m.dogrulandi ? "success" : "secondary"}>
              {m.ad}: {m.dogrulandi ? "Doğrulandı" : `${m.gecenAdet} / ${m.senaryolar.length}`}
            </Badge>
          ))}
        </div>

        <Tabs defaultActiveKey="dogrulama" className="mb-4">
          <Tab eventKey="dogrulama" title="Doğrulama">
            <Dogrulama modeller={modeller} hata={hata} isaretle={isaretle} />
          </Tab>
          <Tab eventKey="konsol" title="Test Konsolu" mountOnEnter>
            <Konsol modeller={modeller} isaretle={isaretle} />
          </Tab>
          <Tab eventKey="ayarlar" title="Ayarlar" mountOnEnter>
            <Ayarlar />
          </Tab>
          <Tab eventKey="gunluk" title="Günlük" mountOnEnter>
            <Gunluk />
          </Tab>
        </Tabs>
      </Card.Body>
    </Card>
  );
};

export default PosEntegrasyonPage;

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Form, Modal, Spinner, Table } from "react-bootstrap";
import { IconAlertTriangle, IconCheck, IconCreditCard, IconHelpCircle, IconX } from "@tabler/icons-react";
import { v4 as uuid } from "uuid";
import { PosBelgeTipi, PosBelgeTuru, PosIslem, PosIslemService, PosMod, PosPesinOdeme, PosTerminal } from "../../services/posIslemService";

// POS cihazı tahsilatı — docs/POS_ENTEGRASYON_YOL_HARITASI.md (K13: kart, fiş kaydedilmeden hemen önce çekilir)
// Fiş ekranları yalnızca bu kancayı çağırır; cihazla ilgili iş mantığı fiş ekranlarına yazılmaz.
// Inpos (bulut, K34): fişin bütün POS satırları tek sipariş olarak gider, cihazda tek bilgi fişi basılır; sonuç satırlara dağıtılır.

export interface PosTahsilSatiri {
  /** Ödeme satırının ekrandaki kimliği */
  kimlik: string;
  tutar: number;
  /** Satırda seçili muhasebe POS kartı */
  posCihaziId: number | null;
}

export interface PosTahsilIstegi {
  belgeTuru: PosBelgeTuru;
  belgeNo: string | null;
  belgeTipi: PosBelgeTipi;
  /** Düzeltilen fişin kimliği; yeni fişte boş */
  belgeId?: number | null;
  vezneId: number | null;
  aliciAd?: string | null;
  /** Alıcının VKN / TCKN'si; bilgi fişine basılır (nihai tüketicide boş) */
  aliciVkn?: string | null;
  /** Fişin nakit / havale / cari satırları: cihaza "ödenmiş" gider, cihaz yalnız kart tutarını çeker (Inpos) */
  pesinOdemeler?: PosPesinOdeme[];
  satirlar: PosTahsilSatiri[];
}

/** Muhasebe POS kartı (B- POS Cihazı Tanımları) */
export interface PosKarti {
  posCihaziId: number;
  kod: string | null;
  ad: string | null;
}

export interface PosTahsilSonucu {
  /** false → tahsilat tamamlanmadı ya da vazgeçildi: fiş KAYDEDİLMEMELİ */
  tamam: boolean;
  /** Satır kimliği → cihazdan dönen bankaya göre belirlenen kart; yalnızca satırda seçili olandan farklıysa dolar (K15) */
  kartlar: Record<string, PosKarti>;
}

type Alinan = { posIslemId: number; tutar: number; kart: PosKarti | null };

const kartiniAl = (i: PosIslem): PosKarti | null => (i.posCihaziId ? { posCihaziId: i.posCihaziId, kod: i.posCihaziKod, ad: i.posCihaziAd } : null);

interface Satir extends PosTahsilSatiri {
  islem: PosIslem | null;
  hata: string | null;
  /** Sunucuya istek sürüyor */
  mesgul: boolean;
  /** Cihaza en az bir kez gönderildi ya da elle işaretlendi (kendiliğinden yeniden gönderilmez) */
  denendi: boolean;
  /** Bu fiş için daha önce tahsil edilmiş (düzeltme ya da yinelenen Kaydet) */
  oncedenAlinmis: boolean;
}

interface Pencere {
  istek: PosTahsilIstegi;
  mod: PosMod;
  terminaller: PosTerminal[];
  satirlar: Satir[];
  uyarilar: string[];
}

const SON_CIHAZ_ANAHTARI = "kuyumcu_pos_son_cihaz";
const YOKLAMA_MS = 2000;

const paraYaz = (n: number): string => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ayni = (a: number, b: number): boolean => Math.abs(a - b) < 0.005;
const alindiMi = (s: Satir): boolean => s.oncedenAlinmis || s.islem?.durum === "ONAY";

export function usePosTahsilat() {
  const [pencere, setPencere] = useState<Pencere | null>(null);
  const [terminalId, setTerminalId] = useState<number | null>(null);
  const [bildirim, setBildirim] = useState<string | null>(null);
  const cozRef = useRef<((s: PosTahsilSonucu) => void) | null>(null);
  // Bu ekran açıkken tahsil edilen satırlar: Kaydet yinelenirse aynı satır ikinci kez çekilmez
  const alinanlarRef = useRef(new Map<string, Alinan>());
  // Kaydet'e art arda basılırsa ikinci çağrı tahsilat başlatmaz
  const calisiyorRef = useRef(false);
  // Düzeltmede fişte karşılığı kalmayan eski tahsilatlar: fiş kaydedilince "iade bekliyor" işaretlenir (K14)
  const iadeEdilecekRef = useRef<PosIslem[]>([]);

  const satirYaz = useCallback((kimlik: string, degisen: Partial<Satir> | ((s: Satir) => Partial<Satir>)) => {
    setPencere((p) => (p ? { ...p, satirlar: p.satirlar.map((s) => (s.kimlik === kimlik ? { ...s, ...(typeof degisen === "function" ? degisen(s) : degisen) } : s)) } : p));
  }, []);

  const islemYaz = useCallback((islem: PosIslem) => {
    setPencere((p) => (p ? { ...p, satirlar: p.satirlar.map((s) => (s.islem?.posIslemId === islem.posIslemId ? { ...s, islem } : s)) } : p));
  }, []);

  const pencereRef = useRef<Pencere | null>(null);
  pencereRef.current = pencere;

  const degisenKartlar = useCallback((satirlar: PosTahsilSatiri[]): Record<string, PosKarti> => {
    const kartlar: Record<string, PosKarti> = {};
    for (const s of satirlar) {
      const kart = alinanlarRef.current.get(s.kimlik)?.kart;
      if (kart && kart.posCihaziId !== s.posCihaziId) kartlar[s.kimlik] = kart;
    }
    return kartlar;
  }, []);

  const bitir = useCallback(
    (tamam: boolean) => {
      const p = pencereRef.current;
      if (!p) return;
      setPencere(null);
      cozRef.current?.({ tamam, kartlar: degisenKartlar(p.satirlar) });
      cozRef.current = null;
    },
    [degisenKartlar]
  );

  const hazirla = useCallback(async (istek: PosTahsilIstegi): Promise<PosTahsilSonucu> => {
    const satirlar = istek.satirlar.filter((s) => s.tutar > 0);
    const uyarilar: string[] = [];
    const alinanlar = alinanlarRef.current;

    // Tahsil edildikten sonra tutarı değişen, silinen ya da fişi hiç kaydedilmeyen satır: çekim cihazdan iade edilmelidir.
    // Bu adım her zaman çalışır; yoksa yarım kalan bir çekim bir sonraki fişe bağlanırdı.
    for (const [kimlik, a] of [...alinanlar]) {
      const satir = satirlar.find((s) => s.kimlik === kimlik);
      if (satir && ayni(satir.tutar, a.tutar)) continue;
      alinanlar.delete(kimlik);
      try {
        await PosIslemService.iadeIsaretle(a.posIslemId, 1);
      } catch {
        // İşaret konamazsa da kullanıcı uyarılır
      }
      uyarilar.push(`Daha önce çekilen ${paraYaz(a.tutar)} TL'nin satırı artık yok ya da tutarı değişti: bu tutar cihazdan iade edilmeli.`);
    }
    if (!satirlar.length) {
      if (uyarilar.length) setBildirim(uyarilar.join(" "));
      return { tamam: true, kartlar: {} };
    }

    let mod: PosMod = "kapali";
    let terminaller: PosTerminal[] = [];
    try {
      ({ mod, terminaller } = await PosIslemService.getDurum(istek.vezneId));
    } catch {
      // Modül kapalı ya da servis yanıt vermiyor: fiş kaydı engellenmez
    }
    if (mod === "kapali" || !terminaller.length) {
      if (uyarilar.length) setBildirim(uyarilar.join(" "));
      return { tamam: true, kartlar: {} };
    }

    // Düzeltme: fişin kayıtlı tahsilatları satırlarla tutara göre eşlenir; eşleşen satır yeniden çekilmez
    iadeEdilecekRef.current = [];
    if (istek.belgeId) {
      let kayitlilar: PosIslem[] = [];
      try {
        kayitlilar = await PosIslemService.getBelgeIslemleri(istek.belgeTuru, istek.belgeId);
      } catch {
        kayitlilar = [];
      }
      const bostakiler = kayitlilar.filter((k) => ![...alinanlar.values()].some((a) => a.posIslemId === k.posIslemId));
      for (const satir of satirlar) {
        if (alinanlar.has(satir.kimlik)) continue;
        const i = bostakiler.findIndex((k) => ayni(k.tutar, satir.tutar));
        if (i < 0) continue;
        const [k] = bostakiler.splice(i, 1);
        alinanlar.set(satir.kimlik, { posIslemId: k.posIslemId, tutar: k.tutar, kart: kartiniAl(k) });
      }
      iadeEdilecekRef.current = bostakiler;
      for (const k of bostakiler) uyarilar.push(`Bu fişte daha önce çekilen ${paraYaz(k.tutar)} TL'nin satırı kalmadı: fiş kaydedilince bu tutar cihazdan iade edilmeli.`);
    }

    const bekleyenVar = satirlar.some((s) => !alinanlar.has(s.kimlik));
    if (!bekleyenVar && !uyarilar.length) return { tamam: true, kartlar: degisenKartlar(satirlar) };

    const sonCihaz = Number(localStorage.getItem(SON_CIHAZ_ANAHTARI)) || 0;
    setTerminalId((terminaller.find((t) => t.posTerminalId === sonCihaz) || terminaller[0]).posTerminalId);
    setPencere({
      istek,
      mod,
      terminaller,
      uyarilar,
      satirlar: satirlar.map((s) => ({ ...s, islem: null, hata: null, mesgul: false, denendi: false, oncedenAlinmis: alinanlar.has(s.kimlik) })),
    });
    return new Promise<PosTahsilSonucu>((coz) => {
      cozRef.current = coz;
    });
  }, [degisenKartlar]);

  /**
   * Fiş kaydedilmeden hemen önce çağrılır. POS entegrasyonu kapalıysa ya da veznenin cihazı yoksa hiçbir şey sormadan
   * tamam döner (POS satırı bugünkü gibi elle çalışır). tamam=false dönerse fiş kaydedilmemelidir.
   */
  const tahsilEt = useCallback(
    async (istek: PosTahsilIstegi): Promise<PosTahsilSonucu> => {
      if (calisiyorRef.current) return { tamam: false, kartlar: {} };
      calisiyorRef.current = true;
      try {
        return await hazirla(istek);
      } finally {
        calisiyorRef.current = false;
      }
    },
    [hazirla]
  );

  /** Fiş kaydedildikten sonra çağrılır: fişten önce alınan tahsilatları fişe bağlar. Hata fırlatmaz. */
  const kaydedildi = useCallback(async (belgeTuru: PosBelgeTuru, belgeId: number | null | undefined, belgeNo?: string | null) => {
    const alinanlar = alinanlarRef.current;
    const iadeEdilecek = iadeEdilecekRef.current;
    alinanlarRef.current = new Map();
    iadeEdilecekRef.current = [];
    if (!belgeId || (!alinanlar.size && !iadeEdilecek.length)) return;
    try {
      if (alinanlar.size) await PosIslemService.belgeyeBagla([...alinanlar.values()].map((a) => a.posIslemId), belgeTuru, belgeId, belgeNo);
      for (const k of iadeEdilecek) await PosIslemService.iadeIsaretle(k.posIslemId, 1);
      if (iadeEdilecek.length) {
        setBildirim(`${paraYaz(iadeEdilecek.reduce((t, k) => t + k.tutar, 0))} TL cihazdan iade edilmeli. İşlem "iade bekliyor" olarak işaretlendi (Banka › POS İşlemleri).`);
      }
    } catch {
      setBildirim("Fiş kaydedildi ancak POS tahsilatı fişe bağlanamadı. Banka › POS İşlemleri ekranından kontrol edin.");
    }
  }, []);

  const girdi = useCallback(
    (p: Pencere, s: Satir) => ({
      istekKimlik: uuid(),
      posTerminalId: terminalId,
      tutar: s.tutar,
      belgeTuru: p.istek.belgeTuru,
      belgeId: p.istek.belgeId ?? null,
      belgeNo: p.istek.belgeNo,
      belgeTipi: p.istek.belgeTipi,
      posCihaziId: s.posCihaziId,
      vezneId: p.istek.vezneId,
      aliciAd: p.istek.aliciAd ?? null,
      aliciVkn: p.istek.aliciVkn ?? null,
    }),
    [terminalId]
  );

  /** Fiş başına tek sipariş (Inpos): verilen satırlar birlikte gider, dönen işlemler satırlara istek kimliğiyle eşlenir. */
  const gonderToplu = useCallback(
    async (p: Pencere, hedefler: Satir[]) => {
      if (!hedefler.length) return;
      if (terminalId) localStorage.setItem(SON_CIHAZ_ANAHTARI, String(terminalId));
      const kimlikler = new Map(hedefler.map((s) => [s.kimlik, uuid()] as const));
      for (const s of hedefler) satirYaz(s.kimlik, { islem: null, mesgul: true, hata: null, denendi: true });
      try {
        const islemler = await PosIslemService.baslatToplu({
          grupKimlik: uuid(),
          posTerminalId: terminalId,
          satirlar: hedefler.map((s) => ({ istekKimlik: kimlikler.get(s.kimlik)!, tutar: s.tutar, posCihaziId: s.posCihaziId })),
          pesinOdemeler: p.istek.pesinOdemeler || [],
          belgeTuru: p.istek.belgeTuru,
          belgeId: p.istek.belgeId ?? null,
          belgeNo: p.istek.belgeNo,
          belgeTipi: p.istek.belgeTipi,
          vezneId: p.istek.vezneId,
          aliciAd: p.istek.aliciAd ?? null,
          aliciVkn: p.istek.aliciVkn ?? null,
        });
        for (const s of hedefler) {
          const islem = islemler.find((i) => i.istekKimlik === kimlikler.get(s.kimlik)) || null;
          satirYaz(s.kimlik, { islem, mesgul: false, hata: islem ? null : "İşlem açılamadı." });
        }
      } catch (err: any) {
        for (const s of hedefler) satirYaz(s.kimlik, { hata: err?.message || "İşlem yapılamadı.", mesgul: false });
      }
    },
    [satirYaz, terminalId]
  );

  const calistir = useCallback(
    async (kimlik: string, is: () => Promise<PosIslem>) => {
      satirYaz(kimlik, { mesgul: true, hata: null, denendi: true });
      try {
        const islem = await is();
        satirYaz(kimlik, { islem, mesgul: false });
      } catch (err: any) {
        satirYaz(kimlik, { hata: err?.message || "İşlem yapılamadı.", mesgul: false });
      }
    },
    [satirYaz]
  );

  const gonder = useCallback(
    (p: Pencere, s: Satir) => {
      // Inpos: fişin alınmamış bütün satırları tek sipariş olarak gider (tek bilgi fişi)
      if (p.terminaller.find((t) => t.posTerminalId === terminalId)?.entegrasyon === "inpos") {
        return gonderToplu(p, p.satirlar.filter((x) => !alindiMi(x) && !x.mesgul));
      }
      if (terminalId) localStorage.setItem(SON_CIHAZ_ANAHTARI, String(terminalId));
      // Önceki denemenin sonucu ekranda kalmasın
      satirYaz(s.kimlik, { islem: null });
      return calistir(s.kimlik, () => PosIslemService.baslat(girdi(p, s)));
    },
    [calistir, girdi, gonderToplu, satirYaz, terminalId]
  );

  /** Bekleyen ya da belirsiz işlem varsa onu işaretler; yoksa cihaza hiç göndermeden "alındı" kaydı açar (K26). */
  const alindiIsaretle = useCallback(
    (p: Pencere, s: Satir) =>
      calistir(s.kimlik, () =>
        s.islem && (s.islem.durum === "BEKLIYOR" || s.islem.durum === "BELIRSIZ") ? PosIslemService.elleIsaretle(s.islem.posIslemId, true) : PosIslemService.elleAlindi(girdi(p, s))
      ),
    [calistir, girdi]
  );

  // Onaylanan satır hemen kaydedilir: pencere kapansa da aynı satır yeniden çekilmez
  useEffect(() => {
    for (const s of pencere?.satirlar || []) {
      if (s.islem?.durum === "ONAY") alinanlarRef.current.set(s.kimlik, { posIslemId: s.islem.posIslemId, tutar: s.tutar, kart: kartiniAl(s.islem) });
    }
  }, [pencere]);

  // Bekleyen işlemleri yokla. Belirsiz'e düşenler de yoklanır: cihazın geç gelen sonucu ekrana kendiliğinden yansır.
  const bekleyenler = useMemo(
    () =>
      (pencere?.satirlar || [])
        .filter((s) => s.islem?.durum === "BEKLIYOR" || s.islem?.durum === "BELIRSIZ")
        .map((s) => s.islem!.posIslemId)
        .join(","),
    [pencere]
  );
  useEffect(() => {
    if (!bekleyenler) return;
    const idler = bekleyenler.split(",").map(Number);
    const t = setInterval(async () => {
      for (const id of idler) {
        try {
          islemYaz(await PosIslemService.getIslem(id));
        } catch {
          // Geçici ağ hatası: bir sonraki yoklamada yeniden denenir
        }
      }
    }, YOKLAMA_MS);
    return () => clearInterval(t);
  }, [bekleyenler, islemYaz]);

  const ozet = useMemo(() => {
    const s = pencere?.satirlar || [];
    return {
      hepsiAlindi: s.length > 0 && s.every(alindiMi),
      suren: s.some((x) => x.mesgul || x.islem?.durum === "BEKLIYOR"),
      siradaki: s.find((x) => !alindiMi(x) && !x.denendi) || null,
      // Denenip alınamayan satır varken sıradaki kendiliğinden gönderilmez; önce kullanıcı karar verir
      takilan: s.some((x) => !alindiMi(x) && x.denendi),
      yeniAlinan: s.some((x) => x.islem?.durum === "ONAY"),
    };
  }, [pencere]);

  const duzeltme = Boolean(pencere?.istek.belgeId);

  // Yeni fişte satırlar sırayla kendiliğinden cihaza gider (tek cihaz aynı anda tek işlem alır). Düzeltmede kullanıcı başlatır.
  useEffect(() => {
    if (!pencere || duzeltme || ozet.suren || ozet.takilan || !ozet.siradaki || !terminalId) return;
    gonder(pencere, ozet.siradaki);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pencere, duzeltme, ozet.suren, ozet.takilan, ozet.siradaki, terminalId]);

  // Hepsi alındıysa pencere kendiliğinden kapanır ve fiş kaydedilir (uyarı varsa kullanıcı okusun diye beklenir)
  useEffect(() => {
    if (!pencere || !ozet.hepsiAlindi || ozet.suren || pencere.uyarilar.length) return;
    const t = setTimeout(() => bitir(true), 700);
    return () => clearTimeout(t);
  }, [pencere, ozet.hepsiAlindi, ozet.suren, bitir]);

  useEffect(() => {
    if (!bildirim) return;
    const t = setTimeout(() => setBildirim(null), 12000);
    return () => clearTimeout(t);
  }, [bildirim]);

  const durumHucresi = (s: Satir): React.ReactNode => {
    if (s.mesgul) return <Spinner size="sm" />;
    if (s.oncedenAlinmis && !s.islem) return <Badge bg="success">Daha önce alındı</Badge>;
    const i = s.islem;
    if (!i) return s.hata ? <Badge bg="danger">Gönderilemedi</Badge> : <Badge bg="secondary">Bekliyor</Badge>;
    if (i.durum === "BEKLIYOR") {
      return (
        <span className="d-inline-flex align-items-center gap-1 text-primary fw-semibold">
          <Spinner size="sm" /> Cihazda bekleniyor{i.gecenSaniye !== null ? ` (${i.gecenSaniye} sn)` : ""}
        </span>
      );
    }
    if (i.durum === "ONAY") {
      return (
        <Badge bg={i.elle ? "warning" : "success"} text={i.elle ? "dark" : undefined}>
          <IconCheck size={13} className="me-1" />
          {i.elle ? "Elle alındı" : "Onaylandı"}
        </Badge>
      );
    }
    if (i.durum === "BELIRSIZ") {
      return (
        <Badge bg="warning" text="dark">
          <IconHelpCircle size={13} className="me-1" />
          Belirsiz
        </Badge>
      );
    }
    return (
      <Badge bg="danger">
        <IconX size={13} className="me-1" />
        {i.durum === "IPTAL" ? "İptal" : i.elle ? "Alınmadı" : "Reddedildi"}
      </Badge>
    );
  };

  const ayrintiHucresi = (s: Satir): string => {
    const i = s.islem;
    if (s.hata) return s.hata;
    if (!i) return "";
    if (i.durum === "ONAY") {
      return [i.bankaAdi, i.taksit && i.taksit > 1 ? `${i.taksit} taksit` : null, i.onayKodu ? `Onay ${i.onayKodu}` : null, i.posCihaziAd].filter(Boolean).join(" · ");
    }
    if (i.durum === "BELIRSIZ") return "Cihazdan cevap gelmedi. Cihaza bakıp işaretleyin.";
    if (i.durum === "BEKLIYOR" && i.entegrasyon === "inpos" && i.mod === "canli") return "Cihazda Siparişler'den bu fişi seçip kartı okutun.";
    return i.hata || "";
  };

  const dugmeler = (p: Pencere, s: Satir): React.ReactNode => {
    if (s.mesgul || alindiMi(s)) return null;
    const i = s.islem;
    if (i?.durum === "BEKLIYOR") {
      return (
        <>
          <Button size="sm" variant="outline-danger" onClick={() => calistir(s.kimlik, () => PosIslemService.iptal(i.posIslemId))}>
            İptal Et
          </Button>
          <Button size="sm" variant="outline-secondary" onClick={() => alindiIsaretle(p, s)}>
            Alındı Olarak İşaretle
          </Button>
        </>
      );
    }
    if (i?.durum === "BELIRSIZ") {
      return (
        <>
          <Button size="sm" variant="success" onClick={() => alindiIsaretle(p, s)}>
            Alındı
          </Button>
          <Button size="sm" variant="outline-danger" onClick={() => calistir(s.kimlik, () => PosIslemService.elleIsaretle(i.posIslemId, false))}>
            Alınmadı
          </Button>
        </>
      );
    }
    return (
      <>
        <Button size="sm" variant="primary" disabled={ozet.suren || !terminalId} onClick={() => gonder(p, s)}>
          {s.denendi ? "Tekrar Dene" : "Cihaza Gönder"}
        </Button>
        <Button size="sm" variant="outline-secondary" disabled={ozet.suren} onClick={() => alindiIsaretle(p, s)}>
          Alındı Olarak İşaretle
        </Button>
      </>
    );
  };

  const pencereOgesi = (
    <>
      {bildirim && (
        <div className="erp-toast-container">
          <Alert variant="warning" dismissible onClose={() => setBildirim(null)} className="erp-toast-item d-flex align-items-center mb-0 shadow py-2 px-3 border-0">
            <IconAlertTriangle size={18} className="me-2 text-danger flex-shrink-0" />
            <span style={{ fontSize: "13px" }}>{bildirim}</span>
          </Alert>
        </div>
      )}
      {pencere && (
        <Modal show centered size="lg" backdrop="static" keyboard={false} onHide={() => undefined}>
          <Modal.Header className="py-2">
            <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2">
              <IconCreditCard size={18} /> POS Tahsilatı
              {pencere.istek.belgeNo && <span className="text-muted fw-normal font-monospace">{pencere.istek.belgeNo}</span>}
              {pencere.mod === "test" && (
                <Badge bg="warning" text="dark">
                  Test (örnek cihaz)
                </Badge>
              )}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="small">
            {pencere.uyarilar.map((u) => (
              <Alert key={u} variant="warning" className="py-2 small">
                <IconAlertTriangle size={16} className="me-1" />
                {u}
              </Alert>
            ))}
            <div className="d-flex align-items-center gap-2 mb-2">
              <Form.Label className="fw-bold text-secondary mb-0 text-nowrap">Cihaz</Form.Label>
              <Form.Select size="sm" style={{ maxWidth: "320px" }} value={terminalId ?? ""} disabled={ozet.suren} onChange={(e) => setTerminalId(Number(e.target.value) || null)}>
                {pencere.terminaller.map((t) => (
                  <option key={t.posTerminalId} value={t.posTerminalId}>
                    {t.ad}
                    {t.entegrasyon === "yok" ? " (entegrasyonsuz)" : ""}
                  </option>
                ))}
              </Form.Select>
            </div>
            <Table size="sm" className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="text-end" style={{ width: "130px" }}>
                    Tutar
                  </th>
                  <th style={{ width: "210px" }}>Durum</th>
                  <th>Ayrıntı</th>
                  <th className="text-end">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {pencere.satirlar.map((s) => (
                  <tr key={s.kimlik}>
                    <td className="text-end font-monospace fw-bold text-nowrap">{paraYaz(s.tutar)} TL</td>
                    <td>{durumHucresi(s)}</td>
                    <td className={s.hata || (s.islem && s.islem.durum !== "ONAY") ? "text-danger" : "text-muted"}>{ayrintiHucresi(s)}</td>
                    <td className="text-end">
                      <div className="d-inline-flex flex-wrap justify-content-end gap-1">{dugmeler(pencere, s)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            {!ozet.hepsiAlindi && ozet.yeniAlinan && (
              <div className="text-muted mt-2">Çekilen tutarlar kayıtlıdır. Fişi kaydetmeden vazgeçerseniz bu tutarları cihazdan iade etmelisiniz.</div>
            )}
          </Modal.Body>
          <Modal.Footer className="py-2">
            <Button size="sm" variant="light" disabled={ozet.suren} onClick={() => bitir(false)}>
              Vazgeç (Fişi Kaydetme)
            </Button>
            {duzeltme && !ozet.hepsiAlindi && (
              <Button size="sm" variant="outline-primary" disabled={ozet.suren} onClick={() => bitir(true)}>
                Tahsilat Yapmadan Kaydet
              </Button>
            )}
            <Button size="sm" variant="primary" disabled={!ozet.hepsiAlindi || ozet.suren} onClick={() => bitir(true)}>
              Fişi Kaydet
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );

  return { tahsilEt, kaydedildi, pencere: pencereOgesi };
}

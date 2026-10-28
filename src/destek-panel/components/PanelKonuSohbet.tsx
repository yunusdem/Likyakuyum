import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Dropdown, Form, Spinner } from "react-bootstrap";
import { IconLock, IconLockOpen, IconMessageBolt, IconPhotoPlus, IconSend, IconUserCheck } from "@tabler/icons-react";
import { MesajBalonu } from "../../components/destek/MesajBalonu";
import { DURUM_ADI, DURUM_RENGI, EK_AZAMI_ADET, EK_TURLERI, ekDenetle, konuEtiketi, zamanYaz } from "../../components/destek/destekOrtak";
import { destekDegisti, dosyaBase64, EkipUyesi, HizliCevap, panelApi, PanelKonuDetay } from "../services/panelApi";
import { usePanelAuth } from "../context/PanelAuthContext";
import FirmaKartiGoster from "./FirmaKarti";

const TAZELEME_MS = 10_000;

interface Props {
  konuId: number;
  ekip: EkipUyesi[];
  hizliCevaplar: HizliCevap[];
  onDegisti?: () => void;
  /** Aktarınca kayıt görünmez olduysa (yalnız atananları gören kişi) */
  onKapandi?: () => void;
}

/** Destek paneli sohbeti: cevap, iç not, görsel, hızlı cevap, üstlen, aktar, kapat / yeniden aç, firma kartı (D7–D12, D16). */
const PanelKonuSohbet: React.FC<Props> = ({ konuId, ekip, hizliCevaplar, onDegisti, onKapandi }) => {
  const { personel } = usePanelAuth();
  const [detay, setDetay] = useState<PanelKonuDetay | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [metin, setMetin] = useState("");
  const [icNot, setIcNot] = useState(false);
  const [gorseller, setGorseller] = useState<{ dosya: File; onizleme: string }[]>([]);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [kartAcik, setKartAcik] = useState(true);
  const altRef = useRef<HTMLDivElement>(null);
  const dosyaRef = useRef<HTMLInputElement>(null);
  const metinRef = useRef<HTMLTextAreaElement>(null);
  const sonMesajId = useRef(0);

  const altaKaydir = () => {
    const kutu = altRef.current?.parentElement;
    if (kutu) kutu.scrollTop = kutu.scrollHeight;
  };

  const uygula = useCallback(
    (d: PanelKonuDetay) => {
      setDetay(d);
      const son = d.mesajlar[d.mesajlar.length - 1]?.mesajId ?? 0;
      if (son !== sonMesajId.current) {
        sonMesajId.current = son;
        setTimeout(altaKaydir, 30);
      }
      onDegisti?.();
      destekDegisti();
    },
    [onDegisti]
  );

  const yukle = useCallback(
    async (sessiz = false) => {
      if (!sessiz) setYukleniyor(true);
      try {
        uygula(await panelApi.konu(konuId));
        setHata(null);
      } catch (err: any) {
        if (!sessiz) setHata(err?.message || "Kayıt okunamadı.");
      } finally {
        if (!sessiz) setYukleniyor(false);
      }
    },
    [konuId, uygula]
  );

  useEffect(() => {
    sonMesajId.current = 0;
    setMetin("");
    setIcNot(false);
    setGorseller([]);
    setBilgi(null);
    yukle();
    const z = setInterval(() => document.visibilityState === "visible" && yukle(true), TAZELEME_MS);
    return () => clearInterval(z);
  }, [yukle]);

  const islem = async (fn: () => Promise<unknown>, basari?: string) => {
    setHata(null);
    setBilgi(null);
    try {
      const s: any = await fn();
      if (s?.gorunmuyor) {
        destekDegisti();
        onDegisti?.();
        onKapandi?.();
        return;
      }
      if (s?.konu) uygula(s as PanelKonuDetay);
      if (basari) setBilgi(basari);
    } catch (err: any) {
      setHata(err?.message || "İşlem yapılamadı.");
      yukle(true);
    }
  };

  const gorselSec = (liste: FileList | null) => {
    if (!liste || liste.length === 0) return;
    const dosyalar = Array.from(liste);
    const h = ekDenetle(dosyalar, gorseller.length);
    if (h) return setHata(h);
    setGorseller([...gorseller, ...dosyalar.map((d) => ({ dosya: d, onizleme: URL.createObjectURL(d) }))]);
    if (dosyaRef.current) dosyaRef.current.value = "";
  };

  const gonder = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!metin.trim()) return;
    setGonderiliyor(true);
    setHata(null);
    try {
      const ekler = await Promise.all(gorseller.map(async (g) => ({ dosyaAdi: g.dosya.name, mime: g.dosya.type, veri: await dosyaBase64(g.dosya) })));
      uygula(await panelApi.mesajYaz(konuId, metin.trim(), icNot, ekler));
      gorseller.forEach((g) => URL.revokeObjectURL(g.onizleme));
      setGorseller([]);
      setMetin("");
    } catch (err: any) {
      setHata(err?.message || "Mesaj gönderilemedi.");
    } finally {
      setGonderiliyor(false);
    }
  };

  const hizliEkle = (c: HizliCevap) => {
    setMetin((m) => (m.trim() ? `${m.trimEnd()}\n${c.metin}` : c.metin));
    setTimeout(() => metinRef.current?.focus(), 0);
  };

  if (yukleniyor && !detay) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100 py-5">
        <Spinner animation="border" size="sm" />
      </div>
    );
  }
  if (!detay) return <Alert variant="danger" className="m-3">{hata || "Kayıt bulunamadı."}</Alert>;

  const k = detay.konu;
  const bende = k.atananPersonelId === personel?.personelId;

  return (
    <div className="destek-sohbet">
      <div className="destek-sohbet-ust">
        <div className="d-flex align-items-start gap-2 flex-wrap">
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="fw-semibold text-truncate" title={k.baslik}>
              #{k.konuId} · {k.baslik}
            </div>
            <div className="small text-muted d-flex flex-wrap gap-2 align-items-center">
              <span>{konuEtiketi(k)}</span>
              <Badge bg={DURUM_RENGI[k.durum]}>{DURUM_ADI[k.durum]}</Badge>
              {k.tur === "TALEP" && k.oncelik === "ACIL" && <Badge bg="danger">Acil</Badge>}
              {k.kaynak === "TELEFON" && <Badge bg="info">Telefon</Badge>}
              {k.firmaUnvan && (
                <span>
                  {k.firmaUnvan} <span className="text-muted">({k.firmaKodu})</span>
                </span>
              )}
              {k.kullaniciAdi && <span>· {k.kullaniciAdi}</span>}
              <span>· {zamanYaz(k.olusturmaTarihi)}</span>
              {k.ekran && <span>· ekran: {k.ekran}</span>}
              {k.kaynakKonuId && <span>· bildirim #{k.kaynakKonuId} yanıtı</span>}
            </div>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {!k.atananPersonelId ? (
              <Button size="sm" variant="success" onClick={() => islem(() => panelApi.ustlen(konuId), "Kaydı üstlendiniz.")}>
                <IconUserCheck size={16} className="me-1" />
                Üstlen
              </Button>
            ) : (
              <Badge bg={bende ? "success" : "secondary"} className="fw-normal py-2" title="Atanan">
                {bende ? "Sizde" : `→ ${k.atananAdmin}`}
              </Badge>
            )}
            <Form.Select
              size="sm"
              style={{ width: 170 }}
              value=""
              title="Başka birine aktar ya da havuza bırak"
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                const hedef = v === "havuz" ? null : Number(v);
                const ad = hedef === null ? "havuza" : `${ekip.find((x) => x.personelId === hedef)?.adSoyad} kişisine`;
                if (window.confirm(`Kayıt ${ad} aktarılsın mı?`)) islem(() => panelApi.aktar(konuId, hedef), "Kayıt aktarıldı.");
              }}
            >
              <option value="">Aktar…</option>
              {k.atananPersonelId && <option value="havuz">Havuza bırak</option>}
              {ekip
                .filter((x) => x.personelId !== k.atananPersonelId)
                .map((x) => (
                  <option key={x.personelId} value={x.personelId}>
                    {x.adSoyad}
                    {x.cevrimici ? " ●" : ""}
                  </option>
                ))}
            </Form.Select>
            {k.durum === "KAPALI" ? (
              <Button size="sm" variant="outline-secondary" onClick={() => islem(() => panelApi.durum(konuId, "ACIK"), "Kayıt yeniden açıldı.")}>
                <IconLockOpen size={16} className="me-1" />
                Yeniden aç
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline-danger"
                onClick={() => window.confirm("Kayıt kapatılsın mı? Eklenen görseller sunucudan silinir.") && islem(() => panelApi.durum(konuId, "KAPALI"), "Kayıt kapatıldı.")}
              >
                <IconLock size={16} className="me-1" />
                Kapat
              </Button>
            )}
          </div>
        </div>
        {detay.firma && (
          <FirmaKartiGoster firma={detay.firma} acik={kartAcik} onDegis={() => setKartAcik(!kartAcik)} />
        )}
      </div>

      <div className="destek-mesajlar">
        {detay.mesajlar.map((m) => (
          <MesajBalonu key={m.mesajId} m={m} benimTaraf="ADMIN" adres={panelApi.ekAdresi} />
        ))}
        <div ref={altRef} />
      </div>

      {hata && (
        <Alert variant="danger" className="py-1 px-3 small m-2 mb-0" dismissible onClose={() => setHata(null)}>
          {hata}
        </Alert>
      )}
      {bilgi && (
        <Alert variant="success" className="py-1 px-3 small m-2 mb-0" dismissible onClose={() => setBilgi(null)}>
          {bilgi}
        </Alert>
      )}

      <Form className="destek-yaz" onSubmit={gonder}>
        {gorseller.length > 0 && (
          <div className="destek-onizleme mb-2">
            {gorseller.map((g, i) => (
              <div className="destek-onizleme-kutu" key={g.onizleme}>
                <img src={g.onizleme} alt={g.dosya.name} />
                <button type="button" title="Kaldır" onClick={() => setGorseller(gorseller.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <Form.Control
          ref={metinRef}
          as="textarea"
          rows={3}
          maxLength={4000}
          placeholder={icNot ? "İç not (müşteri görmez)…" : "Cevabınız (müşteri 'Likya Destek' olarak görür)…"}
          value={metin}
          onChange={(e) => setMetin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) gonder();
          }}
          disabled={gonderiliyor}
          className={icNot ? "bg-warning-subtle" : ""}
        />
        <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
          <Dropdown drop="up">
            <Dropdown.Toggle size="sm" variant="outline-secondary" disabled={hizliCevaplar.length === 0} title="Hızlı cevap ekle">
              <IconMessageBolt size={16} className="me-1" />
              Hızlı cevap
            </Dropdown.Toggle>
            <Dropdown.Menu style={{ maxHeight: 320, overflowY: "auto" }}>
              {hizliCevaplar.map((c) => (
                <Dropdown.Item key={c.cevapId} onClick={() => hizliEkle(c)} title={c.metin}>
                  {c.baslik}
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown>
          <input ref={dosyaRef} type="file" accept={EK_TURLERI.join(",")} multiple hidden onChange={(e) => gorselSec(e.target.files)} />
          <Button size="sm" variant="outline-secondary" type="button" disabled={gorseller.length >= EK_AZAMI_ADET} onClick={() => dosyaRef.current?.click()} title="Görsel ekle (PNG/JPG/WEBP, en çok 3 MB)">
            <IconPhotoPlus size={16} />
          </Button>
          <Form.Check type="switch" id={`dsp-icnot-${konuId}`} label="İç not" checked={icNot} onChange={(e) => setIcNot(e.target.checked)} />
          <span className="small text-muted ms-auto">Ctrl+Enter gönderir</span>
          <Button size="sm" variant={icNot ? "warning" : "primary"} type="submit" disabled={gonderiliyor || !metin.trim()}>
            {gonderiliyor ? <Spinner size="sm" /> : <IconSend size={16} />}
            <span className="ms-1">{icNot ? "Not ekle" : "Cevapla"}</span>
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default PanelKonuSohbet;

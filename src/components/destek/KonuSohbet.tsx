import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Form, Spinner } from "react-bootstrap";
import { IconArchive, IconArchiveOff, IconSend } from "@tabler/icons-react";
import { DURUM_ADI, DURUM_RENGI, DestekService, KonuDetay, dosyayiBase64Yap, ekAdresi, konuEtiketi, zamanYaz } from "../../services/destekService";
import GorselSecici, { SecilenGorsel } from "./GorselSecici";
import { MesajBalonu } from "./MesajBalonu";

const TAZELEME_MS = 10_000; // K13

interface Props {
  konuId: number;
  /** Konu okunduğunda / mesaj yazıldığında liste tazelensin */
  onDegisti?: (detay: KonuDetay) => void;
  /** Bildirime yanıt yeni talep açınca o talebe geçilir */
  onKonuDegisti?: (yeniKonuId: number) => void;
}

/** Kullanıcı tarafı sohbet (K11): balonlar, görseller, mesaj yazma; bildirimde Yanıtla; arşivle. */
const KonuSohbet: React.FC<Props> = ({ konuId, onDegisti, onKonuDegisti }) => {
  const [detay, setDetay] = useState<KonuDetay | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [metin, setMetin] = useState("");
  const [gorseller, setGorseller] = useState<SecilenGorsel[]>([]);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [yanitAcik, setYanitAcik] = useState(false);
  const altRef = useRef<HTMLDivElement>(null);
  // Yalnız mesaj kutusu kayar; sayfa (pencere) yerinden oynamaz
  const altaKaydir = () => {
    const kutu = altRef.current?.parentElement;
    if (kutu) kutu.scrollTop = kutu.scrollHeight;
  };
  const sonMesajId = useRef<number>(0);

  const yukle = useCallback(
    async (sessiz = false) => {
      if (!sessiz) setYukleniyor(true);
      try {
        const d = await DestekService.konu(konuId);
        setDetay(d);
        setHata(null);
        const son = d.mesajlar[d.mesajlar.length - 1]?.mesajId ?? 0;
        if (son !== sonMesajId.current) {
          sonMesajId.current = son;
          onDegisti?.(d);
          setTimeout(() => altaKaydir(), 30);
        }
      } catch (err: any) {
        if (!sessiz) setHata(err?.message || "Kayıt okunamadı.");
      } finally {
        if (!sessiz) setYukleniyor(false);
      }
    },
    [konuId, onDegisti]
  );

  useEffect(() => {
    sonMesajId.current = 0;
    setMetin("");
    setYanitAcik(false);
    setGorseller([]);
    yukle();
    const z = setInterval(() => document.visibilityState === "visible" && yukle(true), TAZELEME_MS);
    return () => clearInterval(z);
  }, [yukle]);

  const gonder = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!metin.trim() || !detay) return;
    setGonderiliyor(true);
    setHata(null);
    try {
      const ekler = await Promise.all(gorseller.map((g) => dosyayiBase64Yap(g.dosya)));
      const yeni = await DestekService.mesajYaz(konuId, metin.trim(), ekler);
      setMetin("");
      gorseller.forEach((g) => URL.revokeObjectURL(g.onizleme));
      setGorseller([]);
      setYanitAcik(false);
      if (yeni.konu.konuId !== konuId) {
        onDegisti?.(yeni);
        onKonuDegisti?.(yeni.konu.konuId);
      } else {
        setDetay(yeni);
        sonMesajId.current = yeni.mesajlar[yeni.mesajlar.length - 1]?.mesajId ?? 0;
        onDegisti?.(yeni);
        setTimeout(() => altaKaydir(), 30);
      }
    } catch (err: any) {
      setHata(err?.message || "Mesaj gönderilemedi.");
    } finally {
      setGonderiliyor(false);
    }
  };

  const arsivle = async () => {
    if (!detay) return;
    try {
      await DestekService.arsiv(konuId, !detay.konu.arsiv);
      const d = await DestekService.konu(konuId);
      setDetay(d);
      onDegisti?.(d); // liste sekmeleri (Tümü / Arşiv) hemen tazelensin
    } catch (err: any) {
      setHata(err?.message || "Kaydedilemedi.");
    }
  };

  if (yukleniyor && !detay) {
    return (
      <div className="d-flex align-items-center justify-content-center h-100 py-5">
        <Spinner size="sm" />
      </div>
    );
  }
  if (!detay) return <Alert variant="danger">{hata || "Kayıt bulunamadı."}</Alert>;

  const k = detay.konu;
  const yazabilir = k.tur === "TALEP" || (k.tur === "BILDIRIM" ? k.cevapAlir : true);
  const yazKutusuAcik = k.tur === "TALEP" || yanitAcik;

  return (
    <div className="destek-sohbet">
      <div className="destek-sohbet-ust d-flex align-items-start gap-2">
        <div className="flex-grow-1 min-w-0">
          <div className="fw-semibold text-truncate" title={k.baslik}>
            {k.baslik}
          </div>
          <div className="small text-secondary d-flex flex-wrap gap-2 align-items-center">
            <span>{konuEtiketi(k)}</span>
            {k.tur === "TALEP" && <Badge bg={DURUM_RENGI[k.durum]}>{DURUM_ADI[k.durum]}</Badge>}
            {k.tur === "TALEP" && k.oncelik === "ACIL" && <Badge bg="danger">Acil</Badge>}
            {k.bekliyor && <Badge bg="warning" text="dark">Bağlanınca gönderilecek</Badge>}
            <span>{zamanYaz(k.olusturmaTarihi)}</span>
            {k.kullaniciAdi && k.tur === "TALEP" && <span>· {k.kullaniciAdi}</span>}
          </div>
        </div>
        {k.tur !== "TALEP" && yazabilir && !yanitAcik && (
          <Button size="sm" variant="outline-primary" onClick={() => setYanitAcik(true)}>
            Yanıtla
          </Button>
        )}
        <Button size="sm" variant="outline-secondary" onClick={arsivle} title={k.arsiv ? "Arşivden çıkar" : "Arşivle"}>
          {k.arsiv ? <IconArchiveOff size={16} /> : <IconArchive size={16} />}
        </Button>
      </div>

      <div className="destek-mesajlar">
        {detay.mesajlar.map((m) => (
          <MesajBalonu key={m.mesajId} m={m} benimTaraf="KULLANICI" adres={ekAdresi} />
        ))}
        {k.tur === "TALEP" && k.durum === "KAPALI" && <div className="destek-balon sistem">Bu talep kapatıldı. Yeni mesaj yazarsanız yeniden açılır.</div>}
        <div ref={altRef} />
      </div>

      {hata && (
        <Alert variant="danger" className="py-1 px-3 small m-2 mb-0">
          {hata}
        </Alert>
      )}

      {yazabilir && yazKutusuAcik && (
        <Form className="destek-yaz" onSubmit={gonder}>
          <Form.Control
            as="textarea"
            rows={2}
            maxLength={4000}
            placeholder={k.tur === "TALEP" ? "Mesajınız…" : "Bu bildirime yanıtınız (ayrı bir talep olarak iletilir)…"}
            value={metin}
            onChange={(e) => setMetin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) gonder();
            }}
            disabled={gonderiliyor}
          />
          <div className="d-flex align-items-center gap-2 mt-2">
            <GorselSecici secilenler={gorseller} onDegis={setGorseller} onHata={setHata} kucuk />
            <span className="small text-secondary ms-auto d-none d-sm-inline">Ctrl+Enter gönderir</span>
            {k.tur !== "TALEP" && (
              <Button size="sm" variant="outline-secondary" type="button" onClick={() => setYanitAcik(false)} disabled={gonderiliyor}>
                Vazgeç
              </Button>
            )}
            <Button size="sm" variant="primary" type="submit" disabled={gonderiliyor || !metin.trim()}>
              {gonderiliyor ? <Spinner size="sm" /> : <IconSend size={16} />}
              <span className="ms-1">Gönder</span>
            </Button>
          </div>
        </Form>
      )}
    </div>
  );
};

export default KonuSohbet;

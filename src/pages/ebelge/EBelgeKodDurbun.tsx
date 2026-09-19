import { useEffect, useState } from "react";
import { Alert, Button, Form, Modal } from "react-bootstrap";
import { IconPlus } from "@tabler/icons-react";
import CodeLookupInput from "../../components/common/CodeLookupInput";
import { SecimPenceresi, type SecimKolon } from "../rapor/RaporSecim";
import { EbelgeKod, EbelgeKodTuru, ebelgeService } from "../../services/ebelgeService";

/**
 * GİB kod dürbünü (istisna / tevkifat / özel matrah / ihraç kayıtlı) — docs/ebelge-revizyon.md K8.
 * Kutuya kod elle de yazılabilir; dürbün listeden seçtirir, "+" listede olmayan kodu tabloya ekler.
 * Liste yalnızca seçim kolaylığıdır; doğru kod mali müşavirle teyit edilir.
 */
const TUR_ADI: Record<EbelgeKodTuru, string> = {
  ISTISNA: "KDV istisna kodu", TEVKIFAT: "Tevkifat kodu", OZELMATRAH: "Özel matrah kodu", IHRACKAYITLI: "İhraç kayıtlı kodu",
};

// Aynı tür birden çok satırda kullanılır; liste sayfa ömrü boyunca bir kez çekilir.
const onbellek = new Map<EbelgeKodTuru, Promise<EbelgeKod[]>>();
const kodlariGetir = (tur: EbelgeKodTuru) => {
  if (!onbellek.has(tur)) onbellek.set(tur, ebelgeService.kodListe(tur).catch((e) => { onbellek.delete(tur); throw e; }));
  return onbellek.get(tur)!;
};

export default function EBelgeKodDurbun({ tur, value, onChange, onSelect, disabled, isInvalid, placeholder }: {
  tur: EbelgeKodTuru; value: string; onChange: (kod: string) => void; onSelect?: (k: EbelgeKod) => void;
  disabled?: boolean; isInvalid?: boolean; placeholder?: string;
}) {
  const [acik, setAcik] = useState(false);
  const [kodlar, setKodlar] = useState<EbelgeKod[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState("");
  const [ekle, setEkle] = useState<{ kod: string; ad: string; oran: string } | null>(null);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const yukle = () => {
    setYukleniyor(true); setHata("");
    kodlariGetir(tur).then(setKodlar).catch((e) => setHata(e?.message || "Kod listesi alınamadı.")).finally(() => setYukleniyor(false));
  };
  useEffect(() => { if (acik || ekle) yukle(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [acik, !!ekle, tur]);

  const sec = (k: EbelgeKod) => { onChange(k.kod); onSelect?.(k); };

  const kaydet = async () => {
    if (!ekle) return;
    setKaydediliyor(true); setHata("");
    try {
      const yeni = await ebelgeService.kodEkle({ tur, kod: ekle.kod.trim(), ad: ekle.ad.trim(), oran: tur === "TEVKIFAT" && ekle.oran !== "" ? Number(ekle.oran) : null });
      onbellek.delete(tur);
      setEkle(null); sec(yeni);
    } catch (e: any) { setHata(e?.message || "Kod eklenemedi."); }
    finally { setKaydediliyor(false); }
  };

  const kolonlar: SecimKolon<EbelgeKod>[] = [
    { baslik: "Kod", genislik: "70px", deger: (k) => <span className="font-monospace fw-bold">{k.kod}</span> },
    { baslik: "Açıklama", deger: (k) => k.ad },
    ...(tur === "TEVKIFAT" ? [{ baslik: "Oran %", genislik: "80px", hiza: "right" as const, deger: (k: EbelgeKod) => k.oran ?? "-" }] : []),
    { baslik: "", genislik: "70px", deger: (k) => (k.sistem ? "" : <span className="text-secondary small">eklenen</span>) },
  ];

  return <div className="d-flex gap-1 align-items-start">
    <div className="flex-grow-1" style={{ minWidth: 0 }}>
      <CodeLookupInput value={value} onChange={(e) => onChange(e.target.value.trim())} onLookupClick={() => setAcik(true)}
        placeholder={placeholder} lookupTitle={TUR_ADI[tur]} disabled={disabled} size="sm" isInvalid={isInvalid}
        title={kodlar.find((k) => k.kod === value)?.ad || `${TUR_ADI[tur]} (mali müşavirinizden teyit ediniz)`} />
    </div>
    <Button size="sm" variant="outline-secondary" className="px-1" disabled={disabled} title="Listeye yeni kod ekle"
      onClick={() => setEkle({ kod: "", ad: "", oran: "" })}><IconPlus size={14} /></Button>

    <SecimPenceresi<EbelgeKod> show={acik} onHide={() => setAcik(false)} title={`${TUR_ADI[tur]} seçimi`} items={kodlar} yukleniyor={yukleniyor}
      kolonlar={kolonlar} aramaAlanlari={(k) => [k.kod, k.ad]} anahtar={(k) => k.kod} aramaYerTutucu="Kod ya da açıklama ile arayın…"
      onSec={(s) => { if (s[0]) sec(s[0]); }} />

    <Modal show={!!ekle} onHide={() => setEkle(null)} centered size="sm">
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6 fw-semibold">Yeni {TUR_ADI[tur].toLocaleLowerCase("tr")}</Modal.Title></Modal.Header>
      <Modal.Body>
        {hata && <Alert variant="danger" className="py-2 small">{hata}</Alert>}
        <Form.Label className="small mb-1">Kod</Form.Label>
        <Form.Control size="sm" className="font-monospace mb-2" maxLength={4} value={ekle?.kod || ""} autoFocus
          onChange={(e) => setEkle((o) => o && { ...o, kod: e.target.value.replace(/\D/g, "") })} />
        <Form.Label className="small mb-1">Açıklama</Form.Label>
        <Form.Control size="sm" as="textarea" rows={2} maxLength={300} className="mb-2" value={ekle?.ad || ""}
          onChange={(e) => setEkle((o) => o && { ...o, ad: e.target.value })} />
        {tur === "TEVKIFAT" && <>
          <Form.Label className="small mb-1">Tevkifat oranı %</Form.Label>
          <Form.Control size="sm" type="number" min={0} max={100} className="font-monospace" value={ekle?.oran || ""}
            onChange={(e) => setEkle((o) => o && { ...o, oran: e.target.value })} />
        </>}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button size="sm" variant="secondary" onClick={() => setEkle(null)} disabled={kaydediliyor}>Vazgeç</Button>
        <Button size="sm" onClick={kaydet} disabled={kaydediliyor || !/^\d{3,4}$/.test(ekle?.kod || "") || (ekle?.ad.trim().length || 0) < 3}>Ekle ve seç</Button>
      </Modal.Footer>
    </Modal>
  </div>;
}

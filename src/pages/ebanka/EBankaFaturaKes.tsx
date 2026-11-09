import React, { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Modal, Spinner, Table } from "react-bootstrap";
import { IconEye, IconSend } from "@tabler/icons-react";
import { EbelgeKaynakSatiri, ebelgeService, ebelgeTutar } from "../../services/ebelgeService";
import type { MutabakatFisi } from "../../services/ebankaService";
import { gonderimSirasi, kaynakSatiriSec } from "./ebankaToplu";

/**
 * e-Banka Muhasebeleştirme — "Fatura kes" (tek fiş) ve "Faturalandır" (seçili hareketler) penceresi
 * (docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M8, M9). Fişin e-Belge kaynak satırı bulunur, kullanıcı belge türünü / tutarı
 * görüp önizler, Gönder ile e-Belge Kaynak ekranındaki yol çalışır (kaynakHazirla → kaynakGonder, KDV uyarısında onay,
 * küçük numaradan büyüğe). e-Belge ekranına gidilmez.
 */

export interface FaturaKesIsi {
  vomsisId: number;
  fis: MutabakatFisi;
}

type Durum = "araniyor" | "hazir" | "engel" | "bulunamadi" | "gonderilmis" | "gonderiliyor" | "gonderildi" | "atlandi" | "hata";
interface Satir {
  is: FaturaKesIsi;
  kaynak: EbelgeKaynakSatiri | null;
  durum: Durum;
  mesaj: string;
}

const DURUM_ROZETI: Record<Durum, { ad: string; renk: string; koyu?: boolean }> = {
  araniyor: { ad: "Aranıyor", renk: "light", koyu: true },
  hazir: { ad: "Gönderilebilir", renk: "info", koyu: true },
  engel: { ad: "Gönderilemez", renk: "warning", koyu: true },
  bulunamadi: { ad: "Bulunamadı", renk: "secondary" },
  gonderilmis: { ad: "Daha önce gönderilmiş", renk: "success" },
  gonderiliyor: { ad: "Gönderiliyor", renk: "primary" },
  gonderildi: { ad: "Gönderildi", renk: "success" },
  atlandi: { ad: "Atlandı", renk: "secondary" },
  hata: { ad: "Hatalı", renk: "danger" },
};

/** e-Belge Kaynak ekranındaki tür adı (EBelgeKaynakPage turAdi ile aynı) */
const turAdi = (k: EbelgeKaynakSatiri) =>
  k.kaynak === "DOVIZ" ? "e-Döviz"
    : k.kaynak === "PERAKENDE" ? ({ 0: "Perakende Alış (e-Gider)", 1: "Perakende Satış", 2: "Perakende İade" } as Record<number, string>)[k.belgeTuru] || "Perakende"
    : k.kaynak === "TICARI" ? "Ticari Satış"
    : k.kaynak === "SARRAF" ? ({ 1: "Sarraf Satış", 2: "Sarraf Satış (e-İrsaliye)", 3: "Sarraf Alış (e-Gider)" } as Record<number, string>)[k.belgeTuru] || "Sarraf"
    : ({ 0: "Fatura", 1: "Fatura", 2: "e-İrsaliye", 3: "e-Gider" } as Record<number, string>)[k.belgeTuru] || `Tür ${k.belgeTuru}`;

const FIS_TURU: Record<string, string> = { doviz: "Döviz fişi", sarraf: "Sarraf fişi", perakende: "Perakende" };
const gunYaz = (g: string | null) => (g ? g.slice(0, 10).split("-").reverse().join(".") : "-");

/** Fişin kaynak satırını bulur: fiş numarası + fiş günüyle listelenir (e-Belge Kaynak ekranındaki süzgeçle aynı). */
async function kaynakBul(is: FaturaKesIsi): Promise<EbelgeKaynakSatiri | null> {
  const f = is.fis;
  const gun = f.tarih ? f.tarih.slice(0, 10) : undefined;
  const veri = await ebelgeService.kaynakListe({
    sayfa: 1, arama: f.fisNo || undefined, kaynak: f.fisTuru === "doviz" ? "DOVIZ" : undefined, baslangicTarihi: gun, bitisTarihi: gun,
  });
  return kaynakSatiriSec(veri.kayitlar, f);
}

export const EBankaFaturaKes: React.FC<{
  isler: FaturaKesIsi[] | null;
  /** Toplu işte uygun olmadığı için listeye alınmayan hareketler */
  atlananlar?: { ad: string; neden: string }[];
  onKapat: (degisti: boolean) => void;
}> = ({ isler, atlananlar = [], onKapat }) => {
  const [satirlar, setSatirlar] = useState<Satir[]>([]);
  const [araniyor, setAraniyor] = useState(false);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [degisti, setDegisti] = useState(false);
  const [onizleme, setOnizleme] = useState<{ baslik: string; url: string; html?: string | null } | null>(null);
  const tur = useRef(0);

  const guncelle = (i: number, p: Partial<Satir>) => setSatirlar((o) => o.map((s, j) => (j === i ? { ...s, ...p } : s)));

  useEffect(() => {
    if (!isler) return;
    const benim = ++tur.current;
    setDegisti(false);
    setOnizleme(null);
    setSatirlar(isler.map((is) => ({ is, kaynak: null, durum: "araniyor", mesaj: "" })));
    setAraniyor(true);
    (async () => {
      for (let i = 0; i < isler.length; i++) {
        if (benim !== tur.current) return;
        try {
          const k = await kaynakBul(isler[i]);
          if (benim !== tur.current) return;
          if (!k) guncelle(i, { durum: "bulunamadi", mesaj: "Fiş e-Belge kaynak listesinde bulunamadı (fiş türü lisansta kapalı ya da e-belgeye konu değil)." });
          else if (k.durum === "GONDERILDI") guncelle(i, { kaynak: k, durum: "gonderilmis", mesaj: k.belgeNo });
          else if (!k.secilebilir) guncelle(i, { kaynak: k, durum: "engel", mesaj: k.engel || k.hata || "Bu fiş gönderilemez." });
          else guncelle(i, { kaynak: k, durum: "hazir", mesaj: k.hata || "" });
        } catch (e: any) {
          if (benim === tur.current) guncelle(i, { durum: "hata", mesaj: e?.message || "e-Belge kaynak listesi alınamadı." });
        }
      }
      if (benim === tur.current) setAraniyor(false);
    })();
  }, [isler]);

  const gidecekler = satirlar.map((s, i) => ({ s, i })).filter((x) => x.s.durum === "hazir" && x.s.kaynak);

  const gonder = async () => {
    if (!gidecekler.length) return;
    const n = gidecekler.length;
    if (!window.confirm(`${n} belge GİB'e gönderilecek. Gönderilen belge geri alınamaz, numarası kullanılmış olur. Devam edilsin mi?`)) return;
    setGonderiliyor(true);
    const sirali = gonderimSirasi(gidecekler.map((x) => ({ ...x, belgeNo: x.s.kaynak!.belgeNo })));
    // KDV'li alış onayı bu gönderimde bir kez sorulur (e-Banka alış fişlerinde işçilik KDV'si varsayılan %20)
    let kdvOnayi: boolean | null = null;
    for (const { s, i } of sirali) {
      const k = s.kaynak!;
      guncelle(i, { durum: "gonderiliyor", mesaj: "" });
      try {
        const hazir = await ebelgeService.kaynakHazirla(k);
        // KDV'li sarraf alışı: kullanıcı onaylarsa KDV 0 olarak gönderilir (docs/E_GIDER_YOL_HARITASI.md K9)
        if (hazir.uyari && kdvOnayi === null) {
          kdvOnayi = window.confirm(`${hazir.belgeNo || k.belgeNo}: ${hazir.uyari}${sirali.length > 1 ? "\n\nBu gönderimdeki KDV'li bütün alış fişleri için geçerlidir." : ""}\n\nYine de gönderilsin mi?`);
        }
        if (hazir.uyari && !kdvOnayi) {
          guncelle(i, { durum: "atlandi", mesaj: "Gönderilmedi (KDV uyarısı onaylanmadı)." });
          continue;
        }
        const cevap = await ebelgeService.kaynakGonder(hazir.uyari ? { ...hazir, kdvSifir: true } : hazir);
        guncelle(i, { durum: "gonderildi", mesaj: `${hazir.belgeTuruAdi || ""} ${hazir.belgeNo || ""} — ${cevap.mesaj || cevap.durum}`.trim() });
        setDegisti(true);
      } catch (e: any) {
        guncelle(i, { durum: "hata", mesaj: e?.message || "Gönderim sonucu alınamadı; e-Belge Giden kutusunu kontrol edin." });
        setDegisti(true);
      }
    }
    setGonderiliyor(false);
  };

  const onizle = async (k: EbelgeKaynakSatiri) => {
    try {
      const g = await ebelgeService.kaynakPdf(k);
      setOnizleme({ baslik: `${turAdi(k)} ${k.belgeNo}`, url: g.url, html: g.html });
    } catch (e: any) {
      alert(e?.message || "Önizleme açılamadı.");
    }
  };

  const kapat = () => {
    if (gonderiliyor) return;
    if (onizleme?.url) URL.revokeObjectURL(onizleme.url);
    tur.current++;
    onKapat(degisti);
  };

  const tek = (isler?.length ?? 0) === 1;
  return (
    <Modal show={!!isler} onHide={kapat} size="xl" centered backdrop={gonderiliyor ? "static" : true}>
      <Modal.Header closeButton={!gonderiliyor} className="py-2">
        <Modal.Title className="fs-6 fw-bold">
          {tek ? `Fatura kes — ${FIS_TURU[isler![0].fis.fisTuru] || "Fiş"} ${isler![0].fis.fisNo || `#${isler![0].fis.fisId}`}` : `Toplu faturalandırma — ${isler?.length ?? 0} fiş`}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="small">
        {onizleme ? (
          <>
            <div className="d-flex align-items-center mb-2">
              <span className="fw-bold">{onizleme.baslik} — önizleme</span>
              <Button size="sm" variant="outline-secondary" className="ms-auto py-0" onClick={() => setOnizleme(null)}>Listeye dön</Button>
            </div>
            {onizleme.html ? (
              <iframe title="Belge önizlemesi" sandbox="allow-scripts" srcDoc={onizleme.html} className="w-100 border-0" style={{ height: "70vh", background: "#fff" }} />
            ) : (
              <iframe title="Belge önizlemesi" src={onizleme.url} className="w-100 border-0" style={{ height: "70vh" }} />
            )}
          </>
        ) : (
          <>
            <div className="text-muted mb-2">
              Fatura fişin bilgileriyle oluşturulur (e-Belge Kaynak'taki "Gönder" ile aynı). Belge türü alıcının e-Fatura mükellefiyetine göre kesinleşir; önizleyip kontrol edin.
            </div>
            <Table size="sm" className="align-middle mb-2">
              <thead className="table-light">
                <tr>
                  <th>Fiş</th>
                  <th>Tarih</th>
                  <th>Ünvan</th>
                  <th className="text-end">Tutar</th>
                  <th>Belge</th>
                  <th>Durum</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {satirlar.map((s, i) => {
                  const r = DURUM_ROZETI[s.durum];
                  return (
                    <tr key={`${s.is.vomsisId}-${s.is.fis.fisTuru}-${s.is.fis.fisId}-${i}`}>
                      <td className="text-nowrap">
                        {FIS_TURU[s.is.fis.fisTuru]} <span className="font-monospace">{s.is.fis.fisNo || `#${s.is.fis.fisId}`}</span>
                      </td>
                      <td className="font-monospace text-nowrap">{gunYaz(s.is.fis.tarih)}</td>
                      <td>{s.kaynak?.unvan || s.is.fis.cariAdi || "-"}</td>
                      <td className="text-end font-monospace text-nowrap">{s.kaynak ? ebelgeTutar(s.kaynak.tutar, s.kaynak.paraBirimi) : ebelgeTutar(s.is.fis.fisToplami, "TRY")}</td>
                      <td className="text-nowrap">{s.kaynak ? turAdi(s.kaynak) : "-"}</td>
                      <td>
                        <Badge bg={r.renk} text={r.koyu ? "dark" : undefined}>
                          {s.durum === "araniyor" || s.durum === "gonderiliyor" ? <Spinner size="sm" className="me-1" style={{ width: 10, height: 10 }} /> : null}
                          {r.ad}
                        </Badge>
                        {s.mesaj && <div className="mt-1">{s.mesaj}</div>}
                      </td>
                      <td className="text-end">
                        {s.kaynak && (
                          <Button size="sm" variant="outline-secondary" className="py-0" disabled={gonderiliyor} onClick={() => onizle(s.kaynak!)}>
                            <IconEye size={14} className="me-1" />
                            Önizle
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            {atlananlar.length > 0 && (
              <Alert variant="light" className="border py-2 mb-0">
                <div className="fw-bold mb-1">Faturalandırılmayan {atlananlar.length} hareket</div>
                {atlananlar.slice(0, 30).map((a, i) => (
                  <div key={i}>{a.ad}: <span className="text-muted">{a.neden}</span></div>
                ))}
                {atlananlar.length > 30 && <div className="text-muted">… ve {atlananlar.length - 30} hareket daha</div>}
              </Alert>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <span className="small text-muted me-auto">
          {araniyor ? "Fişler e-Belge kaynak listesinde aranıyor…" : `${gidecekler.length} belge gönderilebilir`}
        </span>
        <Button size="sm" variant="outline-secondary" disabled={gonderiliyor} onClick={kapat}>Kapat</Button>
        <Button size="sm" variant="primary" disabled={gonderiliyor || araniyor || !gidecekler.length} onClick={gonder}>
          {gonderiliyor ? <Spinner size="sm" className="me-1" /> : <IconSend size={14} className="me-1" />}
          Gönder{gidecekler.length > 1 ? ` (${gidecekler.length})` : ""}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EBankaFaturaKes;

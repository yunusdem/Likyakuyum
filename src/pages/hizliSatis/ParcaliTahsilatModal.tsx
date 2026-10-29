import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Form, InputGroup, Modal, Table } from "react-bootstrap";
import { IconUser } from "@tabler/icons-react";
import { girisSayi } from "./TusTakimi";
import { ODEME_ADI, OdemeTuru, SepetOdemesi, odemeDurumu, yuvarla2 } from "../../../Backend/src/services/hizliSatis/hizliSatisHesap";
import { satirAnahtari } from "./modulVerisi";
import type { HizliMusteri } from "./kaydet/tipler";

/**
 * Parçalı tahsilat penceresi (docs/TICARI_GERI_BILDIRIM_YOL_HARITASI.md İş 8, G16): modülün ödeme türleri için tutar kutuları,
 * POS cihazı / banka hesabı seçimi, Cari için kayıtlı müşteri; kalan ve para üstü canlı. "Tamamla" ödemeleri fişe yazıp kaydeder.
 * Tuş takımı + ödeme düğmesi yolu da aynen durur.
 */
export interface OdemeSecenegi {
  anahtar: string;
  ad: string;
  alt?: string;
  /** Seçilince ödemeye işlenecek alanlar (posCihaziId, bankaId …) */
  alanlar: Partial<SepetOdemesi>;
}

interface Props {
  acik: boolean;
  genelToplam: number;
  odemeTurleri: OdemeTuru[];
  mevcut: SepetOdemesi[];
  musteri: HizliMusteri;
  posSecenekleri: OdemeSecenegi[];
  bankaSecenekleri: OdemeSecenegi[];
  /** Döviz'de banka hesabı tutarın tamamı için seçilir (başka ödemeyle karışmaz) */
  bankaTamami?: boolean;
  kapat: () => void;
  /** Cari satırı için kayıtlı müşteri seçtirir (AliciModal); seçilince musteri prop'u güncellenir */
  musteriSec: () => void;
  onay: (odemeler: SepetOdemesi[]) => void;
}

const para = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const metin = (n: number | undefined) => (n && n > 0 ? String(yuvarla2(n)).replace(".", ",") : "");

export const ParcaliTahsilatModal: React.FC<Props> = ({ acik, genelToplam, odemeTurleri, mevcut, musteri, posSecenekleri, bankaSecenekleri, bankaTamami, kapat, musteriSec, onay }) => {
  const [tutarlar, setTutarlar] = useState<Record<number, string>>({});
  const [posAnahtar, setPosAnahtar] = useState("");
  const [bankaAnahtar, setBankaAnahtar] = useState("");
  const kayitli = musteri.tur === "kayitli" && !!musteri.cariKartId;

  // Açılışta mevcut ödemelerden doldurulur; hiç ödeme yoksa kalan Nakit'e yazılır
  useEffect(() => {
    if (!acik) return;
    const t: Record<number, string> = {};
    for (const o of mevcut) t[o.tur] = metin((Number(t[o.tur]?.replace(",", ".")) || 0) + o.tutar);
    if (!mevcut.length && odemeTurleri.includes(0)) t[0] = metin(genelToplam);
    setTutarlar(t);
    const pos = mevcut.find((o) => o.tur === 2);
    setPosAnahtar(pos ? posSecenekleri.find((p) => p.alanlar.posCihaziId === pos.posCihaziId)?.anahtar || posSecenekleri[0]?.anahtar || "" : posSecenekleri[0]?.anahtar || "");
    const bnk = mevcut.find((o) => o.tur === 3);
    setBankaAnahtar(bnk ? bankaSecenekleri.find((b) => b.alanlar.bankaId === bnk.bankaId)?.anahtar || bankaSecenekleri[0]?.anahtar || "" : bankaSecenekleri[0]?.anahtar || "");
  }, [acik]); // eslint-disable-line react-hooks/exhaustive-deps

  const satirlar = useMemo(() => odemeTurleri.map((tur) => ({ tur, tutar: Math.max(0, girisSayi(tutarlar[tur] || "") || 0) })), [odemeTurleri, tutarlar]);
  const durum = useMemo(() => odemeDurumu(genelToplam, satirlar.filter((s) => s.tutar > 0)), [genelToplam, satirlar]);
  const hatalar: string[] = [];
  if (satirlar.some((s) => s.tur === 1 && s.tutar > 0) && !kayitli) hatalar.push("Cari ödeme için kayıtlı müşteri seçin.");
  if (satirlar.some((s) => s.tur === 2 && s.tutar > 0) && !posSecenekleri.length) hatalar.push("Tanımlı POS cihazı yok (Banka › POS Cihazları).");
  if (satirlar.some((s) => s.tur === 3 && s.tutar > 0) && !bankaSecenekleri.length) hatalar.push("Tanımlı banka hesabı yok.");
  if (bankaTamami && satirlar.some((s) => s.tur === 3 && s.tutar > 0) && satirlar.some((s) => s.tur !== 3 && s.tutar > 0)) hatalar.push("Döviz fişinde banka hesabı tutarın tamamı için seçilir; diğer kutuları boşaltın.");
  if (durum.fazlaOdeme) hatalar.push("Nakit dışı ödemeler fiş toplamını aşamaz; para üstü yalnız nakitten verilir.");
  if (durum.kalan > 0.01) hatalar.push(`Kalan ${para(durum.kalan)} TL.`);
  const tamam = hatalar.length === 0 && satirlar.some((s) => s.tutar > 0);

  const kalaniYaz = (tur: OdemeTuru) => {
    const digerleri = satirlar.filter((s) => s.tur !== tur).reduce((a, s) => a + s.tutar, 0);
    setTutarlar((t) => ({ ...t, [tur]: metin(Math.max(0, yuvarla2(genelToplam - digerleri))) }));
  };

  const onayla = () => {
    if (!tamam) return;
    const liste: SepetOdemesi[] = [];
    for (const s of satirlar) {
      if (!(s.tutar > 0)) continue;
      const temel: SepetOdemesi = { anahtar: satirAnahtari(), tur: s.tur, tutar: yuvarla2(s.tutar) };
      if (s.tur === 2) Object.assign(temel, posSecenekleri.find((p) => p.anahtar === posAnahtar)?.alanlar || posSecenekleri[0]?.alanlar || {});
      if (s.tur === 3) Object.assign(temel, bankaSecenekleri.find((b) => b.anahtar === bankaAnahtar)?.alanlar || bankaSecenekleri[0]?.alanlar || {});
      liste.push(temel);
    }
    onay(liste);
  };

  return (
    <Modal show={acik} onHide={kapat} centered>
      <Modal.Header closeButton className="py-2"><Modal.Title className="fs-6">Parçalı Tahsilat</Modal.Title></Modal.Header>
      <Modal.Body className="p-2">
        <div className="d-flex justify-content-between align-items-end px-1 mb-2">
          <span className="text-muted">Fiş toplamı</span>
          <span className="fw-bold" style={{ fontSize: 26, fontVariantNumeric: "tabular-nums" }}>{para(genelToplam)} TL</span>
        </div>
        <Table size="sm" borderless className="align-middle mb-1">
          <tbody>
            {odemeTurleri.map((tur) => (
              <tr key={tur}>
                <td style={{ width: 92 }} className="fw-semibold">{ODEME_ADI[tur]}</td>
                <td>
                  <InputGroup size="sm">
                    <Form.Control inputMode="decimal" className="text-end fw-bold" style={{ fontSize: 18 }} value={tutarlar[tur] || ""} aria-label={`${ODEME_ADI[tur]} tutarı`}
                      disabled={tur === 1 && !kayitli}
                      onChange={(e) => setTutarlar((t) => ({ ...t, [tur]: e.target.value.replace(/[^\d,]/g, "") }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (tamam) onayla(); } }} />
                    <Button variant="outline-secondary" title="Kalanı bu ödemeye yaz" onClick={() => kalaniYaz(tur)}>Kalan</Button>
                  </InputGroup>
                  {tur === 1 && (
                    <div className="small mt-1 d-flex align-items-center gap-2">
                      <span className={kayitli ? "" : "text-danger"}>{kayitli ? musteri.unvan : "Kayıtlı müşteri seçilmedi"}</span>
                      <Button size="sm" variant="outline-primary" className="py-0" onClick={musteriSec}><IconUser size={14} className="me-1" />{kayitli ? "Değiştir" : "Müşteri seç"}</Button>
                    </div>
                  )}
                  {tur === 2 && posSecenekleri.length > 1 && (
                    <Form.Select size="sm" className="mt-1" value={posAnahtar} onChange={(e) => setPosAnahtar(e.target.value)} aria-label="POS cihazı">
                      {posSecenekleri.map((p) => <option key={p.anahtar} value={p.anahtar}>{p.ad}{p.alt ? ` · ${p.alt}` : ""}</option>)}
                    </Form.Select>
                  )}
                  {tur === 2 && posSecenekleri.length === 1 && <div className="small text-muted mt-1">{posSecenekleri[0].ad}</div>}
                  {tur === 3 && bankaSecenekleri.length > 1 && (
                    <Form.Select size="sm" className="mt-1" value={bankaAnahtar} onChange={(e) => setBankaAnahtar(e.target.value)} aria-label="Banka hesabı">
                      {bankaSecenekleri.map((b) => <option key={b.anahtar} value={b.anahtar}>{b.ad}{b.alt ? ` · ${b.alt}` : ""}</option>)}
                    </Form.Select>
                  )}
                  {tur === 3 && bankaSecenekleri.length === 1 && <div className="small text-muted mt-1">{bankaSecenekleri[0].ad}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className="border-top pt-2 px-1 small">
          <div className="d-flex justify-content-between"><span className="text-muted">Ödenen</span><span>{para(durum.odenen)}</span></div>
          <div className="d-flex justify-content-between fw-bold"><span>{durum.paraUstu > 0 ? "Para üstü" : "Kalan"}</span><span className={durum.kalan > 0.01 ? "text-danger" : "text-success"}>{para(durum.paraUstu > 0 ? durum.paraUstu : durum.kalan)}</span></div>
        </div>
        {hatalar.length > 0 && <Alert variant="warning" className="py-1 small mt-2 mb-0">{hatalar.map((h) => <div key={h}>{h}</div>)}</Alert>}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button variant="secondary" onClick={kapat}>Vazgeç</Button>
        <Button variant="dark" className="fw-bold" disabled={!tamam} onClick={onayla}>Tamamla ve Kaydet</Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ParcaliTahsilatModal;

import React, { useEffect, useRef, useState } from "react";
import { Button, ButtonGroup, Form, Modal, Spinner } from "react-bootstrap";
import { IconScale } from "@tabler/icons-react";
import { teraziAyariOku, teraziOku } from "../../services/teraziService";
import { girisEkle, girisSayi } from "./TusTakimi";
import {
  TartiBirimi, TartiYazimi, tartiDegeri, tartiMiktari, tartiYaz, tartiYazimiTahmin, tutardanTartiMiktari, yuvarla2,
} from "../../../Backend/src/services/ticari/ticariHesap";

/**
 * Tartı penceresi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA2): Kg / Gr birimli ürün. "Gram | Kilo" (varsayılan gram) ya da
 * "Tutar" (100 TL'lik → kilo). Fiyat her zaman kartın birim fiyatından (KDV dahil) hesaplanır.
 * Bu bilgisayara terazi bağlıysa (TA4) "Teraziden oku" düğmesi; ayarda "otomatik" açıksa pencere açılınca kendiliğinden okur.
 */
export interface TartiSorusu {
  ad: string;
  kartBirimi: TartiBirimi;
  /** KDV dahil, kartın birimi başına (Kg kartında kg fiyatı) */
  birimFiyat: number;
  /** Tuş takımından gelen metin (virgüllü → kilo, virgülsüz → gram) */
  ilkMetin?: string;
  /** Satırın var olan miktarı (kartın biriminde) — pencere kilo yazımıyla açılır */
  mevcutMiktar?: number;
  onay: (miktar: number) => void;
}

type Sekme = TartiYazimi | "tutar";

const para = (n: number) => n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const metin = (n: number) => String(n).replace(".", ",");

/** Pencerenin açılış durumu: tuş takımı metni (virgüllü → kilo), yoksa satırın miktarı (kilo), yoksa boş gram */
const ilkDurum = (soru: TartiSorusu): { sekme: Sekme; g: string } => {
  if (soru.ilkMetin) return { sekme: tartiYazimiTahmin(soru.ilkMetin), g: soru.ilkMetin.replace(".", ",") };
  if (soru.mevcutMiktar && soru.mevcutMiktar > 0) return { sekme: "kilo", g: metin(tartiDegeri(soru.mevcutMiktar, "kilo", soru.kartBirimi)) };
  return { sekme: "gram", g: "" };
};

export const TartiModal: React.FC<{ soru: TartiSorusu | null; kapat: () => void }> = ({ soru, kapat }) => {
  const [sekme, setSekme] = useState<Sekme>("gram");
  const [g, setG] = useState("");
  // Soru değişince durum çizimden önce kurulur (efektle kurulunca ilk karede yanlış sekme görünüyordu)
  const [kaynak, setKaynak] = useState<TartiSorusu | null>(null);
  const [terazi, setTerazi] = useState<{ okunuyor: boolean; mesaj: string | null }>({ okunuyor: false, mesaj: null });
  const ayar = useRef(teraziAyariOku());
  const girdiRef = useRef<HTMLInputElement>(null);
  if (soru !== kaynak) {
    setKaynak(soru);
    if (soru) {
      const ilk = ilkDurum(soru);
      setSekme(ilk.sekme);
      setG(ilk.g);
      setTerazi({ okunuyor: false, mesaj: null });
    }
  }
  // Teraziden oku (TA4): kararlı ağırlık kilo sekmesine yazılır; kararsız / hata ise mesaj, kutuya dokunulmaz
  const teraziden = async () => {
    setTerazi({ okunuyor: true, mesaj: null });
    try {
      const r = await teraziOku(ayar.current);
      if (r.hata) return setTerazi({ okunuyor: false, mesaj: r.hata });
      if (!r.kararli) return setTerazi({ okunuyor: false, mesaj: "Terazi sabit değil; ürün durunca yeniden okuyun." });
      setSekme("kilo");
      setG(metin(r.kg as number));
      setTerazi({ okunuyor: false, mesaj: null });
    } catch (e: any) {
      setTerazi({ okunuyor: false, mesaj: e?.message || "Terazi okunamadı." });
    } finally {
      // Odak kutuya döner: düğmede kalırsa Enter "Tamam" yerine yeniden okuyordu (ekran denemesinde görüldü)
      setTimeout(() => girdiRef.current?.focus(), 0);
    }
  };
  useEffect(() => {
    if (!soru) return;
    ayar.current = teraziAyariOku();
    // Tuş takımından miktar gelmediyse ve satır düzeltilmiyorsa kendiliğinden okunur
    if (ayar.current.yol !== "yok" && ayar.current.otomatik && !soru.ilkMetin && !soru.mevcutMiktar) void teraziden();
  }, [soru]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!soru) return null;
  const teraziVar = ayar.current.yol !== "yok";
  const d = girisSayi(g);
  const miktar = d === null ? 0 : sekme === "tutar" ? tutardanTartiMiktari(d, soru.birimFiyat, soru.kartBirimi) : tartiMiktari(d, sekme, soru.kartBirimi);
  const tutar = yuvarla2(miktar * soru.birimFiyat);
  const fiyatYok = !(soru.birimFiyat > 0);
  // Üst sınır: tartı penceresi açıkken okutulan barkod (13 rakam + Enter) ağırlık sayılıp satıra 8 milyar kg yazılmasın
  const TARTI_UST_SINIR = 9999;
  const asiri = miktar > TARTI_UST_SINIR;
  const gecerli = miktar > 0 && !asiri && !(sekme === "tutar" && fiyatYok);
  const tamam = () => {
    if (!gecerli) return;
    soru.onay(miktar);
    kapat();
  };
  const sekmeSec = (s: Sekme) => {
    if (s === sekme) return;
    // Yazılan miktar yeni yazıma çevrilir (gram ↔ kilo); tutara geçince kutu boşalır
    if (miktar > 0 && s !== "tutar" && sekme !== "tutar") setG(metin(tartiDegeri(miktar, s, soru.kartBirimi)));
    else setG("");
    setSekme(s);
  };
  const tus = (t: string) => (
    <button key={t} type="button" className="btn btn-light border fw-bold" style={{ height: 52, fontSize: 20, touchAction: "manipulation" }} onClick={() => setG((x) => girisEkle(x, t))}>{t}</button>
  );
  const birimEtiketi = soru.kartBirimi === "Kg" ? "kg" : "gr";
  return (
    // Animasyonsuz: kapanırken arka perde kasiyerin hemen sonraki dokunuşunu yutmasın. restoreFocus kapalı: odak ürün düğmesine
    // dönerse aynı Enter o düğmeye tıklama olarak gidip pencereyi yeniden açıyordu (odak barkod kutusuna sayfa tarafından verilir)
    <Modal show onHide={kapat} centered size="sm" animation={false} restoreFocus={false} aria-labelledby="tarti-baslik">
      <Modal.Header closeButton className="py-2">
        <Modal.Title id="tarti-baslik" className="fs-6 d-flex align-items-center gap-1"><IconScale size={18} />{soru.ad}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="small text-muted mb-2">
          {fiyatYok ? "Fiyat bulunamadı — tutar sekmesi kapalı." : <>Fiyat: <b>{para(soru.birimFiyat)} TL</b> / {birimEtiketi} (KDV dahil)</>}
        </div>
        <ButtonGroup className="w-100 mb-2" aria-label="Giriş birimi">
          <Button variant={sekme === "gram" ? "primary" : "outline-primary"} onClick={() => sekmeSec("gram")}>Gram</Button>
          <Button variant={sekme === "kilo" ? "primary" : "outline-primary"} onClick={() => sekmeSec("kilo")}>Kilo</Button>
          <Button variant={sekme === "tutar" ? "primary" : "outline-primary"} disabled={fiyatYok} onClick={() => sekmeSec("tutar")}>Tutar</Button>
        </ButtonGroup>
        <Form.Control ref={girdiRef} autoFocus inputMode="decimal" className="text-end fw-bold" style={{ fontSize: 26 }} value={g}
          onChange={(e) => setG((sekme === "tutar" ? e.target.value : e.target.value.replace(/\./g, ",")).replace(/[^\d,]/g, "").replace(/(,.*),/g, "$1"))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); tamam(); } }}
          aria-label={sekme === "gram" ? "Gram" : sekme === "kilo" ? "Kilo" : "Tutar (TL)"} />
        {teraziVar && (
          <div className="mt-2">
            <Button variant="outline-success" className="w-100 fw-semibold" disabled={terazi.okunuyor} onClick={() => void teraziden()} style={{ touchAction: "manipulation" }}>
              {terazi.okunuyor ? <Spinner size="sm" className="me-1" /> : <IconScale size={16} className="me-1" />}Teraziden oku
            </Button>
            {terazi.mesaj && <div className="small text-danger mt-1" role="alert">{terazi.mesaj}</div>}
          </div>
        )}
        <div className="d-flex justify-content-between small mt-1 mb-2">
          <span className="text-muted">{sekme === "gram" ? "gr" : sekme === "kilo" ? "kg" : "TL"}</span>
          <span className="fw-semibold" aria-live="polite">{miktar > 0 ? <>{tartiYaz(miktar, soru.kartBirimi)} = {para(tutar)} TL</> : "—"}</span>
        </div>
        <div className="d-grid gap-1" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ",", "00"].map(tus)}
        </div>
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button variant="outline-secondary" onClick={() => setG((x) => x.slice(0, -1))}>Sil</Button>
        <Button variant="secondary" onClick={kapat}>Vazgeç</Button>
        <Button variant="primary" disabled={!gecerli} onClick={tamam}>Tamam</Button>
      </Modal.Footer>
    </Modal>
  );
};

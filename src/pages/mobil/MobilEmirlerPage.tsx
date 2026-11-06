import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, ButtonGroup, Form, Modal, Spinner, Table } from "react-bootstrap";
import { IconCheck, IconDeviceMobile, IconX } from "@tabler/icons-react";
import ERPToolbar from "../../components/common/ERPToolbar";
import { apiClient } from "../../services/apiClient";
import { tarihSaat } from "../../services/mobilYonetimService";

/**
 * Mobil › Mobil Emirler (docs/MOBIL_CARI_YOL_HARITASI.md K17, K19, K31, V7): carilerin mobilden verdiği emirler. Bekleyen
 * emirde emir fiyatı ile güncel fiyat yan yana görünür; onayda fiş özeti açılır, personel ödeme şeklini işaretler ve fiş mobil
 * vezne + mobil kullanıcı adına kesilir. Ret nedeni cariye e-postayla gider.
 */

interface EmirSatiri {
  urunId: number;
  urunKod: string | null;
  urunAd: string | null;
  miktar: number;
  birim: string | null;
  birimFiyat: number;
  tutar: number;
  guncelBirimFiyat: number | null;
  fark: number | null;
}
interface Emir {
  emirId: number;
  cariKod: string | null;
  cariAd: string | null;
  mobilKullaniciAdi: string | null;
  tur: "PARA" | "STOK";
  yon: "AL" | "SAT";
  toplamTl: number;
  tercihAdi: string | null;
  notu: string | null;
  durum: string;
  durumAdi: string;
  olusturmaTarihi: string;
  kalanSn: number;
  isleyenKullaniciAdi: string | null;
  redNedeni: string | null;
  odemeSekli: string | null;
  fisTuru: string | null;
  fisNo: string | null;
  satirlar: EmirSatiri[];
}
interface Onizleme {
  emir: Emir;
  fisAdi: string;
  vezne: string | null;
  kullanici: string | null;
  cari: { kod: string; ad: string };
  ozet: { toplam: number; odenecek: number; masraf: number; hasToplam: number; kdv?: number } | null;
  uyari: string | null;
  /** Ticari: sipariş stok bakiyesini aşıyorsa (onay engellenmez; "eksiye izin yok" kartı kayıtta engeller) */
  stokUyari?: string | null;
  secenekler: { kod: string; ad: string; liste?: { id: number; ad: string }[] }[];
  onerilenOdeme: string;
}

const RENK: Record<string, string> = { BEKLIYOR: "warning", ISLENIYOR: "info", ONAYLANDI: "success", REDDEDILDI: "danger", SURESI_DOLDU: "secondary", IPTAL: "secondary" };
const tl = (v: number | null | undefined, b = 2) => (v === null || v === undefined ? "-" : v.toLocaleString("tr-TR", { minimumFractionDigits: b, maximumFractionDigits: b }));
const kur = (v: number | null | undefined) => (v === null || v === undefined ? "-" : v.toLocaleString("tr-TR", { maximumFractionDigits: 6 }));
const sure = (sn: number) => `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, "0")}`;

const MobilEmirlerPage: React.FC = () => {
  const [emirler, setEmirler] = useState<Emir[] | null>(null);
  const [filtre, setFiltre] = useState<"BEKLIYOR" | "">("BEKLIYOR");
  const [hata, setHata] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);
  const [odeme, setOdeme] = useState("NAKIT");
  const [secim, setSecim] = useState<number | "">("");
  const [mesgul, setMesgul] = useState(false);

  const yukle = useCallback(async () => {
    try {
      const r = await apiClient.get<Emir[]>("/mobil-yonetim/emirler", filtre ? { durum: filtre } : undefined);
      setEmirler(r.data || []);
      setHata(null);
    } catch (e: any) {
      setHata(e?.message || "Emirler alınamadı.");
    }
  }, [filtre]);

  useEffect(() => {
    void yukle();
    const t = setInterval(() => void yukle(), 10_000);
    return () => clearInterval(t);
  }, [yukle]);

  // Kalan süre saniye saniye
  useEffect(() => {
    const t = setInterval(() => setEmirler((l) => l && l.map((e) => (e.durum === "BEKLIYOR" ? { ...e, kalanSn: Math.max(0, e.kalanSn - 1) } : e))), 1000);
    return () => clearInterval(t);
  }, []);

  const onayAc = async (e: Emir) => {
    setHata(null);
    try {
      const r = await apiClient.get<Onizleme>(`/mobil-yonetim/emirler/${e.emirId}/onizleme`);
      setOnizleme(r.data);
      setOdeme(r.data.onerilenOdeme);
      setSecim("");
    } catch (err: any) {
      setHata(err?.message || "Önizleme alınamadı.");
    }
  };

  const onayla = async () => {
    if (!onizleme) return;
    const sec = onizleme.secenekler.find((s) => s.kod === odeme);
    if (sec?.liste && secim === "") return setHata("Listeden seçim yapın.");
    const secilen = sec?.liste?.find((x) => x.id === secim);
    setMesgul(true);
    setHata(null);
    try {
      const r = await apiClient.post<any>(`/mobil-yonetim/emirler/${onizleme.emir.emirId}/onayla`, {
        odemeSekli: odeme,
        ...(odeme === "HAVALE" && { bankaId: secim, bankaAdi: secilen?.ad }),
        ...(odeme === "POS" && { posCihaziId: secim, posAdi: secilen?.ad }),
      });
      setMesaj(`Emir #${onizleme.emir.emirId} onaylandı; ${onizleme.fisAdi} ${r.data?.fis?.no || ""} kesildi.${r.data?.postaGitti ? " Cariye e-posta gitti." : ""}`);
      setOnizleme(null);
      await yukle();
    } catch (err: any) {
      setHata(err?.message || "Onaylanamadı.");
      if (err?.kod === "EMIR_ISLENEMEZ") {
        setOnizleme(null);
        await yukle();
      }
    } finally {
      setMesgul(false);
    }
  };

  const reddet = async (e: Emir) => {
    const neden = window.prompt(`Emir #${e.emirId} reddedilecek. Cariye iletilecek neden (isteğe bağlı):`, "");
    if (neden === null) return;
    try {
      await apiClient.post(`/mobil-yonetim/emirler/${e.emirId}/reddet`, { neden });
      setMesaj(`Emir #${e.emirId} reddedildi.`);
      await yukle();
    } catch (err: any) {
      setHata(err?.message || "Reddedilemedi.");
    }
  };

  return (
    <div className="p-2 p-md-3">
      <ERPToolbar pageTitle="Mobil Emirler" pageIcon={<IconDeviceMobile size={22} className="text-primary" />} onRefresh={() => void yukle()} disabled={mesgul} />
      <div className="d-flex align-items-center gap-2 mt-3 mb-2">
        <ButtonGroup size="sm">
          <Button variant={filtre === "BEKLIYOR" ? "primary" : "outline-primary"} onClick={() => setFiltre("BEKLIYOR")}>
            Onay bekleyenler
          </Button>
          <Button variant={filtre === "" ? "primary" : "outline-primary"} onClick={() => setFiltre("")}>
            Son 7 gün
          </Button>
        </ButtonGroup>
        <span className="small text-muted">10 saniyede bir yenilenir. Süresi dolan emir onaylanamaz.</span>
      </div>
      {hata && (
        <Alert variant="danger" dismissible onClose={() => setHata(null)}>
          {hata}
        </Alert>
      )}
      {mesaj && (
        <Alert variant="success" dismissible onClose={() => setMesaj(null)}>
          {mesaj}
        </Alert>
      )}
      {!emirler ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : emirler.length === 0 ? (
        <div className="text-muted py-4">{filtre ? "Onay bekleyen emir yok." : "Son 7 günde emir yok."}</div>
      ) : (
        <Table size="sm" responsive hover className="align-middle small">
          <thead>
            <tr>
              <th>#</th>
              <th>Zaman</th>
              <th>Cari</th>
              <th>İşlem</th>
              <th className="text-end">Emir fiyatı</th>
              <th className="text-end">Güncel fiyat</th>
              <th className="text-end">Tutar</th>
              <th>Tercih / not</th>
              <th>Durum</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {emirler.map((e) => (
              <tr key={e.emirId}>
                <td>{e.emirId}</td>
                <td className="text-nowrap">{tarihSaat(e.olusturmaTarihi)}</td>
                <td>
                  <span className="font-monospace">{e.cariKod}</span> {e.cariAd}
                  {e.mobilKullaniciAdi && e.mobilKullaniciAdi !== e.cariAd && <div className="text-muted">{e.mobilKullaniciAdi}</div>}
                </td>
                <td>
                  {e.tur === "STOK" ? (
                    <Badge bg="primary">Ticari sipariş</Badge>
                  ) : (
                    <Badge bg={e.yon === "AL" ? "success" : "danger"}>{e.yon === "AL" ? "Cari alıyor (satış)" : "Cari satıyor (alış)"}</Badge>
                  )}
                  {e.satirlar.map((s, i) => (
                    <div key={i}>
                      {s.miktar.toLocaleString("tr-TR")} {s.birim} {s.urunAd}
                    </div>
                  ))}
                </td>
                <td className="text-end">{e.satirlar.map((s, i) => <div key={i}>{kur(s.birimFiyat)}</div>)}</td>
                <td className="text-end">
                  {e.satirlar.map((s, i) => (
                    <div key={i} className={s.fark ? (s.fark > 0 === (e.yon === "SAT") ? "text-success" : "text-danger") : ""} title="Emir fiyatı güncel fiyata göre firma lehine yeşil, aleyhine kırmızı (cari alıyorken fiyat yükseldiyse aleyhine)">
                      {kur(s.guncelBirimFiyat)}
                      {s.fark ? ` (${s.fark > 0 ? "+" : ""}${kur(s.fark)})` : ""}
                    </div>
                  ))}
                </td>
                <td className="text-end fw-semibold">{tl(e.toplamTl)}</td>
                <td>
                  {e.tercihAdi}
                  {e.notu && <div className="text-muted">“{e.notu}”</div>}
                </td>
                <td>
                  <Badge bg={RENK[e.durum] || "secondary"}>{e.durumAdi}</Badge>
                  {e.durum === "BEKLIYOR" && <div className={e.kalanSn < 60 ? "text-danger" : "text-muted"}>{sure(e.kalanSn)} kaldı</div>}
                  {e.fisNo && <div className="text-muted">Fiş {e.fisNo}</div>}
                  {e.isleyenKullaniciAdi && <div className="text-muted">{e.isleyenKullaniciAdi}</div>}
                  {e.redNedeni && <div className="text-muted">{e.redNedeni}</div>}
                </td>
                <td className="text-nowrap text-end">
                  {e.durum === "BEKLIYOR" && e.kalanSn > 0 && (
                    <>
                      <Button size="sm" variant="success" className="me-1" onClick={() => void onayAc(e)}>
                        <IconCheck size={14} /> Onayla
                      </Button>
                      <Button size="sm" variant="outline-danger" onClick={() => void reddet(e)}>
                        <IconX size={14} /> Reddet
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal show={!!onizleme} onHide={() => setOnizleme(null)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title className="fs-6">Emir #{onizleme?.emir.emirId} — {onizleme?.fisAdi}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {onizleme && (
            <>
              <div className="small mb-2">
                <b>Cari:</b> {onizleme.cari.kod} {onizleme.cari.ad} · <b>Vezne:</b> {onizleme.vezne || "-"} · <b>Fişi kesen:</b> {onizleme.kullanici || "-"} (mobil)
              </div>
              <Table size="sm" bordered className="small">
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th className="text-end">Miktar</th>
                    <th className="text-end">Sabit fiyat</th>
                    <th className="text-end">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {onizleme.emir.satirlar.map((s, i) => (
                    <tr key={i}>
                      <td>{s.urunAd}</td>
                      <td className="text-end">
                        {s.miktar.toLocaleString("tr-TR")} {s.birim}
                      </td>
                      <td className="text-end">{kur(s.birimFiyat)}</td>
                      <td className="text-end">{tl(s.tutar)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              {onizleme.ozet && (
                <div className="small text-end mb-2">
                  {onizleme.ozet.masraf > 0 && <div>BSMV / KMV / komisyon: {tl(onizleme.ozet.masraf)} TL</div>}
                  {onizleme.ozet.kdv !== undefined && <div>KDV dahil (KDV: {tl(onizleme.ozet.kdv)} TL)</div>}
                  <div className="fs-6 fw-bold">
                    {onizleme.emir.yon === "AL" ? "Cariden alınacak" : "Cariye ödenecek"}: {tl(onizleme.ozet.odenecek)} TL
                  </div>
                </div>
              )}
              {onizleme.uyari && <Alert variant="warning" className="py-2 small">{onizleme.uyari}</Alert>}
              {onizleme.stokUyari && <Alert variant="warning" className="py-2 small">{onizleme.stokUyari}</Alert>}
              <div className="small mb-1">
                <b>Carinin tercihi:</b> {onizleme.emir.tercihAdi || "-"} {onizleme.emir.notu ? `· “${onizleme.emir.notu}”` : ""}
              </div>
              <Form.Label className="small fw-semibold mb-1">Ödeme şekli (son kararı siz verirsiniz)</Form.Label>
              {onizleme.secenekler.map((s) => (
                <div key={s.kod} className="d-flex align-items-center gap-2 mb-1">
                  <Form.Check type="radio" id={`odeme-${s.kod}`} name="odeme" label={s.ad} checked={odeme === s.kod} onChange={() => { setOdeme(s.kod); setSecim(""); }} />
                  {s.liste && odeme === s.kod && (
                    <Form.Select size="sm" style={{ maxWidth: 320 }} value={secim} onChange={(x) => setSecim(x.target.value ? Number(x.target.value) : "")}>
                      <option value="">Seçin…</option>
                      {s.liste.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.ad}
                        </option>
                      ))}
                    </Form.Select>
                  )}
                </div>
              ))}
              <div className="small text-muted mt-2">
                Fiş mobil vezne ve mobil kullanıcı adına kesilir; onaylayan olarak siz kaydedilirsiniz. e-Belge her zamanki gibi personel tarafından gönderilir.
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setOnizleme(null)}>
            Vazgeç
          </Button>
          <Button variant="success" disabled={mesgul || !!onizleme?.uyari} onClick={() => void onayla()}>
            {mesgul ? <Spinner size="sm" animation="border" /> : "Onayla ve fişi kes"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MobilEmirlerPage;

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Form, Table } from "react-bootstrap";
import { IconAlertTriangle } from "@tabler/icons-react";
import { EbelgeKnskKaydi, ebelgeService } from "../../services/ebelgeService";

/**
 * KNSK — kamu nüfuzuna sahip kişi (docs/ebelge-revizyon.md K9). İşaret elle, kullanıcı onayıyla konur ve 1 yıl geçerlidir;
 * süre dolmadan önce (sunucunun bildirdiği `uyariGun`) e-Belge ana sayfasında ve fatura formunda uyarılır.
 * Kayıt VKN/TCKN'ye bağlıdır ve e-Belge'nin kendi tablosunda durur; cari modülüne yalnızca `KnskCariAlani` yerleştirilir.
 */
const tarih = (t: string) => t?.slice(0, 10).split("-").reverse().join(".");
const vknGecerli = (v: string) => /^\d{10,11}$/.test(v);

const sureMetni = (k: EbelgeKnskKaydi) =>
  k.kalanGun < 0 ? `süresi ${-k.kalanGun} gün önce doldu` : k.kalanGun === 0 ? "süresi bugün doluyor" : `${k.kalanGun} gün kaldı`;

export const KnskRozet = ({ kayit, uyariGun }: { kayit: EbelgeKnskKaydi; uyariGun: number }) => (
  <Badge bg={kayit.kalanGun < 0 ? "danger" : kayit.kalanGun <= uyariGun ? "warning" : "dark"} text={kayit.kalanGun >= 0 && kayit.kalanGun <= uyariGun ? "dark" : undefined}
    title={`Kamu nüfuzuna sahip kişi · kayıt ${tarih(kayit.kayitTarihi)} · son onay ${tarih(kayit.sonOnayTarihi)} (${kayit.onaylayan || "-"}) · ${sureMetni(kayit)}`}>
    KNSK
  </Badge>
);

/** Verilen numaranın KNSK kaydını getirir; numara geçersizse sorgu yapılmaz. */
export function useKnsk(vknTckn: string) {
  const [kayit, setKayit] = useState<EbelgeKnskKaydi | null>(null);
  const [uyariGun, setUyariGun] = useState(30);
  const [sira, setSira] = useState(0);
  useEffect(() => {
    if (!vknGecerli(vknTckn)) { setKayit(null); return; }
    let iptal = false;
    // KNSK sorgusu yardımcı bilgidir; alınamazsa fatura akışı engellenmez.
    ebelgeService.knskGetir(vknTckn).then((c) => { if (!iptal) { setKayit(c.kayit); setUyariGun(c.uyariGun); } }).catch(() => { if (!iptal) setKayit(null); });
    return () => { iptal = true; };
  }, [vknTckn, sira]);
  return { kayit, uyariGun, yenile: () => setSira((s) => s + 1), setKayit };
}

/** Fatura formu: alıcı KNSK ise rozet + süresi yaklaşmış/dolmuşsa uyarı. */
export function KnskFormUyarisi({ vknTckn }: { vknTckn: string }) {
  const { kayit, uyariGun } = useKnsk(vknTckn);
  if (!kayit) return null;
  const yaklasti = kayit.kalanGun <= uyariGun;
  return <Alert variant={kayit.kalanGun < 0 ? "danger" : yaklasti ? "warning" : "secondary"} className="py-2 px-3 mb-3 border rounded shadow-2xs small">
    <KnskRozet kayit={kayit} uyariGun={uyariGun} /> <strong className="ms-1">Alıcı kamu nüfuzuna sahip kişi (KNSK) olarak kayıtlı.</strong>{" "}
    Kayıt: {tarih(kayit.kayitTarihi)} · Son onay: {tarih(kayit.sonOnayTarihi)} ({kayit.onaylayan || "-"}) · Geçerlilik: {tarih(kayit.bitisTarihi)}
    {yaklasti && <> — <IconAlertTriangle size={14} className="me-1" /><strong>{sureMetni(kayit)}</strong>; cari kartından onayı yenileyin.</>}
  </Alert>;
}

/** Cari kartı: KNSK işaretleme / yıllık yenileme / kaldırma. Kart kaydından bağımsız, anında kaydedilir. */
export function KnskCariAlani({ vknTckn, ad }: { vknTckn: string; ad?: string }) {
  const vkn = (vknTckn || "").replace(/\D/g, "");
  const { kayit, uyariGun, setKayit } = useKnsk(vkn);
  const [onay, setOnay] = useState<"isaretle" | "yenile" | "kaldir" | null>(null);
  const [aciklama, setAciklama] = useState("");
  const [busy, setBusy] = useState(false);
  const [hata, setHata] = useState("");
  useEffect(() => { setOnay(null); setHata(""); }, [vkn]);

  const uygula = async () => {
    setBusy(true); setHata("");
    try {
      if (onay === "kaldir") { await ebelgeService.knskKaldir(vkn); setKayit(null); }
      else setKayit((await ebelgeService.knskOnayla({ vknTckn: vkn, ad: ad?.trim() || null, aciklama: aciklama.trim() || null })).kayit);
      setOnay(null); setAciklama("");
    } catch (e: any) { setHata(e?.message || "KNSK kaydı güncellenemedi."); }
    finally { setBusy(false); }
  };

  if (!vknGecerli(vkn)) return <span className="small text-secondary">KNSK işareti için önce VKN / TCKN giriniz.</span>;
  return <div className="small">
    {kayit ? <div className="d-flex align-items-center flex-wrap gap-2">
      <KnskRozet kayit={kayit} uyariGun={uyariGun} />
      <span>Kayıt {tarih(kayit.kayitTarihi)} · son onay {tarih(kayit.sonOnayTarihi)} ({kayit.onaylayan || "-"}) ·{" "}
        <span className={kayit.kalanGun <= uyariGun ? "text-danger fw-bold" : ""}>{sureMetni(kayit)}</span></span>
      {!onay && <><Button size="sm" variant="outline-primary" className="py-0" onClick={() => setOnay("yenile")}>Onayı yenile</Button>
        <Button size="sm" variant="outline-danger" className="py-0" onClick={() => setOnay("kaldir")}>Kaldır</Button></>}
    </div> : !onay && <Button size="sm" variant="outline-dark" className="py-0" onClick={() => setOnay("isaretle")}>KNSK olarak işaretle</Button>}
    {onay && <div className="border rounded p-2 mt-1">
      <div className="fw-semibold mb-1">{onay === "kaldir" ? "KNSK işareti kaldırılsın mı?"
        : onay === "yenile" ? "Bu kişinin hâlâ kamu nüfuzuna sahip olduğunu onaylıyor musunuz? Onay 1 yıl geçerli olur."
        : "Bu kişiyi kamu nüfuzuna sahip kişi (KNSK) olarak işaretliyorsunuz. Onay sizin adınıza kaydedilir ve 1 yıl geçerlidir."}</div>
      {onay !== "kaldir" && <Form.Control size="sm" className="mb-2" placeholder="Açıklama (görev, dayanak — isteğe bağlı)" maxLength={500} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />}
      <Button size="sm" variant={onay === "kaldir" ? "danger" : "dark"} className="me-2" disabled={busy} onClick={uygula}>{onay === "kaldir" ? "Kaldır" : "Onaylıyorum"}</Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setOnay(null)}>Vazgeç</Button>
    </div>}
    {hata && <div className="text-danger mt-1">{hata}</div>}
  </div>;
}

/** e-Belge ana sayfası: onay süresi yaklaşan ya da dolan KNSK kayıtları. Kayıt yoksa hiçbir şey çizilmez. */
export function KnskYaklasanlarKarti() {
  const [kayitlar, setKayitlar] = useState<EbelgeKnskKaydi[]>([]);
  const [uyariGun, setUyariGun] = useState(30);
  useEffect(() => { ebelgeService.knskListe(true).then((c) => { setKayitlar(c.kayitlar); setUyariGun(c.uyariGun); }).catch(() => undefined); }, []);
  if (!kayitlar.length) return null;
  return <Card className="shadow-sm border border-warning rounded-3 overflow-hidden mb-3">
    <Card.Body className="p-3 bg-body">
      <div className="fw-semibold mb-2" style={{ fontSize: "13px" }}>
        <IconAlertTriangle size={16} className="me-1 text-warning" />
        KNSK onayı yenilenecek kişiler <span className="text-secondary fw-normal">— yıllık onayın bitmesine {uyariGun} gün ya da daha az kaldı</span>
      </div>
      <Table responsive size="sm" className="mb-0 align-middle">
        <thead><tr><th>VKN / TCKN</th><th>Ad / Unvan</th><th>İlk kayıt</th><th>Son onay</th><th>Bitiş</th><th>Durum</th></tr></thead>
        <tbody>{kayitlar.map((k) => <tr key={k.vknTckn}>
          <td className="font-monospace">{k.vknTckn}</td><td>{k.ad || "-"}</td><td>{tarih(k.kayitTarihi)}</td>
          <td>{tarih(k.sonOnayTarihi)} <span className="text-secondary">({k.onaylayan || "-"})</span></td><td>{tarih(k.bitisTarihi)}</td>
          <td className={k.kalanGun < 0 ? "text-danger fw-bold" : "fw-bold"}>{sureMetni(k)}</td>
        </tr>)}</tbody>
      </Table>
      <div className="form-text mb-0">Yenilemek için kişinin cari kartındaki KNSK alanından "Onayı yenile"ye basın.</div>
    </Card.Body>
  </Card>;
}

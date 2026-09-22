import React, { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Col, Form, Modal, Row, Spinner, Table } from "react-bootstrap";
import { IconAlertTriangle, IconCheck, IconRefresh } from "@tabler/icons-react";
import { EBankaAktarimSonucu, EBankaCari, EBankaEsitlemeSonucu, EBankaMod, EBankaService } from "../../services/ebankaService";

// F- e-Banka ekranlarının ortak parçaları (docs/EBANKA_VOMSIS_YOL_HARITASI.md)

export const paraYaz = (n: number | null | undefined): string =>
  n === null || n === undefined ? "-" : n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Sunucu tarihleri yerel duvar saatiyle gelir; saat dilimi çevirisi yapılmaz
export const zamanYaz = (z: string | null | undefined): string => {
  if (!z) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(z);
  return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}:${m[5]}` : z;
};

export const ibanYaz = (iban: string | null | undefined): string => (iban ? iban.replace(/(.{4})/g, "$1 ").trim() : "-");

const iki = (n: number) => String(n).padStart(2, "0");
export const gunMetni = (d: Date): string => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
export const bugun = (): string => gunMetni(new Date());
export const gunOnce = (gun: number): string => gunMetni(new Date(Date.now() - gun * 86_400_000));

export const ModRozeti: React.FC<{ mod?: EBankaMod }> = ({ mod }) =>
  mod ? (
    <Badge bg={mod === "canli" ? "success" : "warning"} text={mod === "canli" ? undefined : "dark"} className="px-2 py-1 fs-7">
      {mod === "canli" ? "Canlı" : "Test (örnek veri)"}
    </Badge>
  ) : null;

/** Kart başlığında görünüm seçimi. Temanın nav-tabs stili kart başlığına sığmayıp tablo başlığının üstüne bindiği için sade düğmeler kullanılır. */
export function SekmeDugmeleri<T extends string>({ secili, secenekler, onSec }: { secili: T; secenekler: { anahtar: T; ad: string }[]; onSec: (anahtar: T) => void }) {
  return (
    <div className="d-flex flex-wrap gap-1">
      {secenekler.map((s) => (
        <Button key={s.anahtar} size="sm" variant={s.anahtar === secili ? "primary" : "light"} className={s.anahtar === secili ? "" : "border"} onClick={() => onSec(s.anahtar)}>
          {s.ad}
        </Button>
      ))}
    </div>
  );
}

export type BildirimTuru = "success" | "danger" | "warning";

export const useBildirim = () => {
  const [bildirim, setBildirim] = useState<{ type: BildirimTuru; message: string } | null>(null);

  useEffect(() => {
    if (!bildirim) return;
    const t = setTimeout(() => setBildirim(null), 6000);
    return () => clearTimeout(t);
  }, [bildirim]);

  const bildir = useCallback((type: BildirimTuru, message: string) => setBildirim({ type, message }), []);

  const bildirimKutusu = bildirim && (
    <div className="erp-toast-container">
      <Alert variant={bildirim.type} dismissible onClose={() => setBildirim(null)} className="erp-toast-item d-flex align-items-center mb-0 shadow py-2 px-3 border-0">
        {bildirim.type === "success" ? (
          <IconCheck size={18} className="me-2 text-success flex-shrink-0" />
        ) : (
          <IconAlertTriangle size={18} className="me-2 text-danger flex-shrink-0" />
        )}
        <span style={{ fontSize: "13px" }}>{bildirim.message}</span>
      </Alert>
    </div>
  );

  return { bildir, bildirimKutusu };
};

/** Elle eşitleme: tarih aralığını kullanıcı seçer; varsayılan son eşitleme gününden bugüne (E3, E4). */
export function EsitlemeModal<T = EBankaEsitlemeSonucu>({
  show,
  sonEsitleme,
  onHide,
  onBitti,
  calistir: ozelCalistir,
  aciklama,
  varsayilanGun = 30,
}: {
  show: boolean;
  sonEsitleme: string | null;
  onHide: () => void;
  onBitti: (sonuc: T) => void;
  /** Verilmezse banka hesap hareketleri eşitlenir */
  calistir?: (baslangic: string, bitis: string) => Promise<T>;
  aciklama?: string;
  /** Hiç eşitleme yapılmamışsa kaç gün geriden başlansın */
  varsayilanGun?: number;
}) {
  const [baslangic, setBaslangic] = useState(bugun());
  const [bitis, setBitis] = useState(bugun());
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState("");

  useEffect(() => {
    if (!show) return;
    setBaslangic(sonEsitleme ? sonEsitleme.slice(0, 10) : gunOnce(varsayilanGun));
    setBitis(bugun());
    setHata("");
  }, [show, sonEsitleme, varsayilanGun]);

  const calistir = async () => {
    setCalisiyor(true);
    setHata("");
    try {
      onBitti(ozelCalistir ? await ozelCalistir(baslangic, bitis) : ((await EBankaService.esitle(baslangic, bitis)) as unknown as T));
    } catch (err: any) {
      setHata(err?.message || "Eşitleme yapılamadı.");
    } finally {
      setCalisiyor(false);
    }
  };

  return (
    <Modal show={show} onHide={calisiyor ? undefined : onHide} centered backdrop={calisiyor ? "static" : true}>
      <Modal.Header closeButton={!calisiyor} className="py-2">
        <Modal.Title className="fs-6 fw-bold">Bankadan Güncelle</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-2">
          <Col xs={6}>
            <Form.Label className="small fw-bold text-secondary mb-1">Başlangıç</Form.Label>
            <Form.Control type="date" size="sm" value={baslangic} max={bitis} disabled={calisiyor} onChange={(e) => setBaslangic(e.target.value)} />
          </Col>
          <Col xs={6}>
            <Form.Label className="small fw-bold text-secondary mb-1">Bitiş</Form.Label>
            <Form.Control type="date" size="sm" value={bitis} min={baslangic} max={bugun()} disabled={calisiyor} onChange={(e) => setBitis(e.target.value)} />
          </Col>
        </Row>
        <div className="small text-muted mt-2">
          {aciklama || "Bankalar, hesaplar, bakiyeler ve seçilen aralıktaki hesap hareketleri çekilir. Daha önce çekilmiş hareketler yeniden eklenmez."}
          {sonEsitleme && <> Son güncelleme: {zamanYaz(sonEsitleme)}.</>}
        </div>
        {hata && (
          <Alert variant="danger" className="small py-2 mt-2 mb-0">
            {hata}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer className="py-2">
        <Button size="sm" variant="light" disabled={calisiyor} onClick={onHide}>
          Vazgeç
        </Button>
        <Button size="sm" variant="primary" disabled={calisiyor || !baslangic || !bitis} onClick={calistir}>
          {calisiyor ? <Spinner size="sm" className="me-1" /> : <IconRefresh size={16} className="me-1" />}
          Güncelle
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export const aktarimOzeti = (a: EBankaAktarimSonucu): string =>
  `${a.aktarilan} banka fişi kesildi, ${a.bekleyen} hareket bekliyor` +
  (a.aktarilmayacak ? `, ${a.aktarilmayacak} hareket aktarılmayacak olarak kapatıldı` : "") +
  (a.hatali ? `, ${a.hatali} harekette hata oluştu` : "") +
  ".";

export const esitlemeOzeti = (s: EBankaEsitlemeSonucu): string =>
  `${s.hesapAdedi} hesap güncellendi, ${s.yeniHareket} yeni hareket eklendi` +
  (s.guncellenenHareket ? `, ${s.guncellenenHareket} hareket güncellendi` : "") +
  (s.yeniEslesenHesap ? `, ${s.yeniEslesenHesap} hesap IBAN ile eşleşti` : "") +
  "." +
  (s.aktarim ? ` Aktarım: ${aktarimOzeti(s.aktarim)}` : "");

/** Cari seçimi: kod, ad ya da vergi/TC kimlik no ile arar. */
export const CariSecModal: React.FC<{
  show: boolean;
  ilkArama?: string;
  onHide: () => void;
  onSec: (cari: EBankaCari) => void;
}> = ({ show, ilkArama, onHide, onSec }) => {
  const [arama, setArama] = useState("");
  const [sonuclar, setSonuclar] = useState<EBankaCari[]>([]);
  const [araniyor, setAraniyor] = useState(false);

  useEffect(() => {
    if (show) setArama(ilkArama || "");
  }, [show, ilkArama]);

  useEffect(() => {
    if (!show) return;
    const terim = arama.trim();
    if (terim.length < 2) {
      setSonuclar([]);
      return;
    }
    let iptal = false;
    const t = setTimeout(async () => {
      setAraniyor(true);
      try {
        const liste = await EBankaService.cariAra(terim);
        if (!iptal) setSonuclar(liste);
      } catch {
        if (!iptal) setSonuclar([]);
      } finally {
        if (!iptal) setAraniyor(false);
      }
    }, 300);
    return () => {
      iptal = true;
      clearTimeout(t);
    };
  }, [arama, show]);

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton className="py-2">
        <Modal.Title className="fs-6 fw-bold">Cari Seç</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Control autoFocus type="text" size="sm" value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Cari kodu, adı ya da vergi / TC kimlik no (en az 2 karakter)" />
        <div className="mt-2 border rounded" style={{ maxHeight: "340px", overflowY: "auto" }}>
          <Table size="sm" hover className="mb-0 small align-middle">
            <tbody>
              {sonuclar.map((c) => (
                <tr key={c.cariKartId} style={{ cursor: "pointer" }} onClick={() => onSec(c)}>
                  <td className="font-monospace text-nowrap" style={{ width: "120px" }}>
                    {c.kod}
                  </td>
                  <td className="fw-semibold">{c.ad}</td>
                  <td className="font-monospace text-nowrap text-end">{c.vergiNo || ""}</td>
                </tr>
              ))}
              {sonuclar.length === 0 && (
                <tr>
                  <td className="text-center text-muted py-3">{araniyor ? "Aranıyor…" : arama.trim().length < 2 ? "Aramak için yazın." : "Cari bulunamadı."}</td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>
      </Modal.Body>
    </Modal>
  );
};

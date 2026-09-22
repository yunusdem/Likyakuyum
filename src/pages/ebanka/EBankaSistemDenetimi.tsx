import React, { useState } from "react";
import { Alert, Badge, Button, Card, Form, Modal, Spinner, Table } from "react-bootstrap";
import { IconReceipt, IconStethoscope } from "@tabler/icons-react";
import { BankaHesapItem } from "../../services/bankaService";
import { EBankaDenetimSonucu, EBankaService } from "../../services/ebankaService";
import { BildirimTuru } from "./ebankaOrtak";

// F- e-Banka > Ayarlar > Sistem Denetimi: Vomsis hesabı olmadan sunucunun çalışmaya hazır olduğunu doğrular
// (docs/EBANKA_VOMSIS_YOL_HARITASI.md). Denetim salt okunurdur; deneme fişi ayrı bir butondur ve onay ister.

const ROZET: Record<EBankaDenetimSonucu["durum"], { ad: string; renk: string; koyuYazi?: boolean }> = {
  tamam: { ad: "Tamam", renk: "success" },
  uyari: { ad: "Uyarı", renk: "warning", koyuYazi: true },
  hata: { ad: "Hata", renk: "danger" },
  bilgi: { ad: "Bilgi", renk: "secondary" },
};

export const EBankaSistemDenetimi: React.FC<{ bankalar: BankaHesapItem[]; bildir: (type: BildirimTuru, message: string) => void; onGunlukDegisti?: () => void }> = ({ bankalar, bildir, onGunlukDegisti }) => {
  const [sonuclar, setSonuclar] = useState<EBankaDenetimSonucu[] | null>(null);
  const [zaman, setZaman] = useState<string | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);

  const [bankaId, setBankaId] = useState("");
  const [onayAcik, setOnayAcik] = useState(false);
  const [fisCalisiyor, setFisCalisiyor] = useState(false);
  const [fisAdimlari, setFisAdimlari] = useState<EBankaDenetimSonucu[] | null>(null);

  const denetle = async () => {
    setCalisiyor(true);
    try {
      // Sunucu denetimleri ile tarayıcıdan yapılan dönüş adresi denetimi birlikte gösterilir
      const [sunucu, donus] = await Promise.all([EBankaService.denetle(), EBankaService.donusAdresiDenetle()]);
      setSonuclar([...sunucu.sonuclar, donus]);
      setZaman(new Date().toLocaleString("tr-TR"));
    } catch (err: any) {
      bildir("danger", err?.message || "Sistem denetimi çalıştırılamadı.");
    } finally {
      setCalisiyor(false);
    }
  };

  const denemeFisi = async () => {
    setOnayAcik(false);
    setFisCalisiyor(true);
    try {
      const s = await EBankaService.denemeFisi(Number(bankaId));
      setFisAdimlari(s.adimlar);
      bildir(s.basarili ? "success" : "danger", s.basarili ? "Deneme fişi kesildi, geri okundu ve silindi: fiş kesme zinciri çalışıyor." : "Deneme fişi adımlarında sorun var; ayrıntı listede.");
      onGunlukDegisti?.();
    } catch (err: any) {
      bildir("danger", err?.message || "Deneme fişi çalıştırılamadı.");
    } finally {
      setFisCalisiyor(false);
    }
  };

  const say = (d: EBankaDenetimSonucu["durum"]) => (sonuclar || []).filter((s) => s.durum === d).length;
  const satirlar = (liste: EBankaDenetimSonucu[]) =>
    liste.map((s, i) => (
      <tr key={`${s.grup}-${s.ad}-${i}`}>
        <td className="text-muted text-nowrap">{i === 0 || liste[i - 1].grup !== s.grup ? s.grup : ""}</td>
        <td className="fw-semibold text-nowrap">{s.ad}</td>
        <td>
          <Badge bg={ROZET[s.durum].renk} text={ROZET[s.durum].koyuYazi ? "dark" : undefined}>
            {ROZET[s.durum].ad}
          </Badge>
        </td>
        <td>{s.ayrinti}</td>
      </tr>
    ));

  return (
    <Card className="border shadow-sm mb-3 w-100 bg-white">
      <Card.Header className="bg-white py-2 d-flex align-items-center gap-2">
        <span className="small fw-bold text-secondary">Sistem Denetimi</span>
        {sonuclar && (
          <span className="small text-muted">
            {zaman} — {say("tamam")} tamam, {say("uyari")} uyarı, {say("hata")} hata
          </span>
        )}
        <Button size="sm" variant="outline-primary" className="ms-auto" disabled={calisiyor} onClick={denetle}>
          {calisiyor ? <Spinner size="sm" className="me-1" /> : <IconStethoscope size={16} className="me-1" />}
          Denetimi Çalıştır
        </Button>
      </Card.Header>
      <Card.Body className="p-0">
        <div className="small text-muted px-3 py-2 border-bottom">
          Banka servisi hesabı gerekmeden bu sunucunun hazır olduğunu denetler: veritabanı ve tablolar, banka fişi altyapısı, para / kur / cari tanımları, ayarlar, sunucudan banka servisine erişim
          ve 3D Secure dönüş adresi. Hiçbir kayıt değiştirmez.
        </div>
        {sonuclar && (
          <Table size="sm" className="mb-0 small align-middle">
            <tbody>{satirlar(sonuclar)}</tbody>
          </Table>
        )}
        {sonuclar && say("hata") === 0 && (
          <Alert variant="success" className="small py-2 m-3 mb-0">
            Hata yok. {say("uyari") > 0 ? "Uyarılar çalışmayı engellemez; ilgili özelliğin davranışını açıklar." : "Sunucu e-Banka için hazır."}
          </Alert>
        )}

        <div className="px-3 py-3 border-top">
          <div className="small fw-bold text-secondary mb-1">Fiş kesme denemesi</div>
          <div className="small text-muted mb-2">
            Otomatik aktarımın kullandığı yoldan, seçtiğiniz banka hesabına <b>0,01 TL'lik bir banka fişi keser, geri okur ve hemen siler</b>. Geriye kayıt kalmaz; yalnızca bir fiş numarası
            harcanır. Test modunda da çalışır. Bu, banka servisi hesabı olmadan fiş kesme zincirinin bu sunucuda çalıştığının kanıtıdır.
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <Form.Select size="sm" style={{ maxWidth: "340px" }} value={bankaId} onChange={(e) => setBankaId(e.target.value)}>
              <option value="">Banka hesabı seçiniz</option>
              {bankalar.map((b) => (
                <option key={b.bankaId} value={b.bankaId}>
                  {b.hesapNo} - {b.hesapAdi}
                </option>
              ))}
            </Form.Select>
            <Button size="sm" variant="outline-secondary" disabled={!bankaId || fisCalisiyor} onClick={() => setOnayAcik(true)}>
              {fisCalisiyor ? <Spinner size="sm" className="me-1" /> : <IconReceipt size={16} className="me-1" />}
              Deneme Fişi Kes ve Sil
            </Button>
          </div>
          {fisAdimlari && (
            <Table size="sm" className="mb-0 mt-2 small align-middle">
              <tbody>{satirlar(fisAdimlari)}</tbody>
            </Table>
          )}
        </div>
      </Card.Body>

      <Modal show={onayAcik} onHide={() => setOnayAcik(false)} centered size="sm">
        <Modal.Body className="small">
          Gerçek veritabanında seçili banka hesabına <b>0,01 TL'lik</b> bir "Havale Alma" fişi kesilecek ve hemen silinecek. Devam edilsin mi?
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button size="sm" variant="light" onClick={() => setOnayAcik(false)}>
            Vazgeç
          </Button>
          <Button size="sm" variant="primary" onClick={denemeFisi}>
            Kes ve Sil
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
};

export default EBankaSistemDenetimi;

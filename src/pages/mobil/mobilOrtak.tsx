import React, { useEffect, useState } from "react";
import { Badge, Button, Form, InputGroup, Modal, Spinner, Table } from "react-bootstrap";
import { IconCopy, IconCheck, IconTrash } from "@tabler/icons-react";
import {
  MobilCariOzet,
  MobilErisim,
  MobilVeritabani,
  MobilYetkiler,
  MobilYonetimService,
  YETKI_ADLARI,
  panoyaKopyala,
} from "../../services/mobilYonetimService";

/** Mobil tanım ekranlarının ortak parçaları (docs/MOBIL_CARI_YOL_HARITASI.md, Faz 2) */

/** Cari formunun içinde Enter'a basılınca cari kaydedilmesin */
export const enterEngelle = (e: React.KeyboardEvent) => {
  if (e.key === "Enter") e.preventDefault();
};

export const KopyalaDugmesi: React.FC<{ metin: string; etiket?: string; size?: "sm" | "lg" }> = ({ metin, etiket = "Kopyala", size = "sm" }) => {
  const [tamam, setTamam] = useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={tamam ? "success" : "outline-secondary"}
      onClick={async () => {
        if (await panoyaKopyala(metin)) {
          setTamam(true);
          setTimeout(() => setTamam(false), 1500);
        }
      }}
    >
      {tamam ? <IconCheck size={14} /> : <IconCopy size={14} />} {tamam ? "Kopyalandı" : etiket}
    </Button>
  );
};

/** İlk şifre / sıfırlanan şifre: yalnız bir kez gösterilir (V2) */
export const SifreModal: React.FC<{ bilgi: { kullaniciAdi: string; geciciSifre: string; paylasim: string; girisAdresi: string } | null; onKapat: () => void }> = ({ bilgi, onKapat }) => (
  <Modal show={!!bilgi} onHide={onKapat} centered backdrop="static">
    <Modal.Header closeButton>
      <Modal.Title className="fs-6">Mobil giriş bilgisi</Modal.Title>
    </Modal.Header>
    <Modal.Body>
      <p className="small text-danger mb-2">Şifre yalnız şimdi gösterilir. Kopyalayıp cariye iletin; ilk girişte şifresini değiştirmesi istenecek.</p>
      <Table size="sm" bordered className="mb-2">
        <tbody>
          <tr>
            <th className="small">Kullanıcı adı</th>
            <td className="font-monospace">{bilgi?.kullaniciAdi}</td>
          </tr>
          <tr>
            <th className="small">İlk şifre</th>
            <td className="font-monospace fs-5">{bilgi?.geciciSifre}</td>
          </tr>
          <tr>
            <th className="small">Giriş adresi</th>
            <td className="small text-break">{bilgi?.girisAdresi}</td>
          </tr>
        </tbody>
      </Table>
      <Form.Control as="textarea" rows={5} readOnly value={bilgi?.paylasim || ""} className="small font-monospace" />
    </Modal.Body>
    <Modal.Footer>
      {bilgi && <KopyalaDugmesi metin={bilgi.paylasim} etiket="Tümünü kopyala" size="lg" />}
      <Button type="button" variant="secondary" onClick={onKapat}>
        Kapat
      </Button>
    </Modal.Footer>
  </Modal>
);

export const YetkiKutulari: React.FC<{ deger: MobilYetkiler; onChange: (y: MobilYetkiler) => void; disabled?: boolean; sikisik?: boolean; idOn: string }> = ({
  deger,
  onChange,
  disabled,
  sikisik,
  idOn,
}) => (
  <div className={sikisik ? "d-flex flex-wrap gap-2" : "d-flex flex-wrap gap-3"}>
    {YETKI_ADLARI.map((y) => (
      <Form.Check
        key={y.key}
        id={`${idOn}-${y.key}`}
        type="checkbox"
        className="small mb-0"
        label={y.ad}
        title={y.aciklama}
        checked={deger[y.key]}
        disabled={disabled}
        onChange={(e) => onChange({ ...deger, [y.key]: e.target.checked })}
      />
    ))}
  </div>
);

export const DurumRozeti: React.FC<{ durum: "AKTIF" | "PASIF" }> = ({ durum }) =>
  durum === "AKTIF" ? <Badge bg="success">Aktif</Badge> : <Badge bg="secondary">Pasif</Badge>;

/** Bir kullanıcının erişim satırları: yetki ve durum yerinde değişir, kaldırılabilir */
export const ErisimTablosu: React.FC<{ erisimler: MobilErisim[]; mesgul: boolean; onIslem: (is: () => Promise<unknown>, mesaj: string) => void }> = ({
  erisimler,
  mesgul,
  onIslem,
}) => (
  <Table size="sm" responsive className="mb-2 align-middle small">
    <thead>
      <tr>
        <th>Veritabanı</th>
        <th>Cari</th>
        <th>Yetkiler</th>
        <th>Durum</th>
        <th />
      </tr>
    </thead>
    <tbody>
      {erisimler.map((e) => (
        <tr key={e.erisimId}>
          <td>
            {e.firmaUnvan} {e.buFirma && <Badge bg="info">bu veritabanı</Badge>}
            <div className="text-muted" style={{ fontSize: 11 }}>
              {e.dbName}
            </div>
          </td>
          <td>
            <span className="font-monospace">{e.cariKod}</span> {e.cariAd}
          </td>
          <td>
            <YetkiKutulari
              idOn={`e${e.erisimId}`}
              sikisik
              deger={e.yetkiler}
              disabled={mesgul}
              onChange={(y) => onIslem(() => MobilYonetimService.erisimGuncelle(e.erisimId, { yetkiler: y }), "Yetkiler kaydedildi.")}
            />
          </td>
          <td>
            <Form.Check
              type="switch"
              id={`ed${e.erisimId}`}
              label={e.durum === "AKTIF" ? "Açık" : "Kapalı"}
              checked={e.durum === "AKTIF"}
              disabled={mesgul}
              onChange={(x) => onIslem(() => MobilYonetimService.erisimGuncelle(e.erisimId, { durum: x.target.checked ? "AKTIF" : "PASIF" }), "Erişim durumu kaydedildi.")}
            />
          </td>
          <td className="text-end">
            <Button
              type="button"
              size="sm"
              variant="outline-danger"
              disabled={mesgul}
              title="Bu veritabanındaki erişimi kaldır"
              onClick={() => window.confirm(`${e.firmaUnvan} erişimi kaldırılacak. Devam?`) && onIslem(() => MobilYonetimService.erisimSil(e.erisimId), "Erişim kaldırıldı.")}
            >
              <IconTrash size={14} />
            </Button>
          </td>
        </tr>
      ))}
    </tbody>
  </Table>
);

/** Başka veritabanında erişim ekleme (K25): veritabanı seçilir, o veritabanındaki cari listeden aranıp seçilir */
export const ErisimEkleFormu: React.FC<{
  mobilKullaniciId: number;
  veritabanlari: MobilVeritabani[];
  mevcutFirmalar: number[];
  mesgul: boolean;
  onIslem: (is: () => Promise<unknown>, mesaj: string) => void;
}> = ({ mobilKullaniciId, veritabanlari, mevcutFirmalar, mesgul, onIslem }) => {
  const secenekler = veritabanlari.filter((v) => !mevcutFirmalar.includes(v.firmaId));
  const [firmaId, setFirmaId] = useState<number | "">("");
  const [aranan, setAranan] = useState("");
  const [sonuc, setSonuc] = useState<MobilCariOzet[] | null>(null);
  const [cari, setCari] = useState<MobilCariOzet | null>(null);
  const [yetkiler, setYetkiler] = useState<MobilYetkiler>({ fiyat: true, bakiye: true, dokum: true, alis: false, satis: false });
  const [araniyor, setAraniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    setSonuc(null);
    setCari(null);
  }, [firmaId]);

  if (secenekler.length === 0) return null;

  const ara = async () => {
    if (!firmaId) return;
    setAraniyor(true);
    setHata(null);
    try {
      setSonuc(await MobilYonetimService.veritabaniCariAra(firmaId, aranan));
    } catch (e: any) {
      setHata(e?.message || "Arama yapılamadı.");
    } finally {
      setAraniyor(false);
    }
  };

  return (
    <div className="border rounded p-2 bg-light">
      <div className="small fw-semibold mb-1">Başka veritabanında erişim ver</div>
      <div className="d-flex flex-wrap gap-2 align-items-center">
        <Form.Select size="sm" style={{ maxWidth: 260 }} value={firmaId} onChange={(e) => setFirmaId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Veritabanı seçin…</option>
          {secenekler.map((v) => (
            <option key={v.firmaId} value={v.firmaId} disabled={!v.kullanilabilir}>
              {v.unvan} ({v.dbName}){!v.kullanilabilir ? " — Mobil kapalı" : ""}
            </option>
          ))}
        </Form.Select>
        {firmaId !== "" && (
          <InputGroup size="sm" style={{ maxWidth: 320 }}>
            <Form.Control
              placeholder="Cari kodu, adı ya da VKN"
              value={aranan}
              onChange={(e) => setAranan(e.target.value)}
              onKeyDown={(e) => {
                enterEngelle(e);
                if (e.key === "Enter") void ara();
              }}
            />
            <Button type="button" variant="outline-primary" onClick={() => void ara()} disabled={araniyor}>
              {araniyor ? <Spinner size="sm" animation="border" /> : "Ara"}
            </Button>
          </InputGroup>
        )}
      </div>
      {hata && <div className="text-danger small mt-1">{hata}</div>}
      {sonuc && (
        <div className="mt-2" style={{ maxHeight: 180, overflowY: "auto" }}>
          {sonuc.length === 0 && <div className="small text-muted">Cari bulunamadı.</div>}
          {sonuc.map((c) => (
            <Form.Check
              key={c.cariKartId}
              type="radio"
              id={`ek${mobilKullaniciId}-${c.cariKartId}`}
              name={`ek${mobilKullaniciId}`}
              className="small"
              label={`${c.kod} — ${c.ad}${c.vergiKimlikNo ? ` (${c.vergiKimlikNo})` : ""}`}
              checked={cari?.cariKartId === c.cariKartId}
              onChange={() => setCari(c)}
            />
          ))}
        </div>
      )}
      {cari && firmaId !== "" && (
        <div className="d-flex flex-wrap gap-2 align-items-center mt-2">
          <YetkiKutulari idOn={`ek${mobilKullaniciId}`} sikisik deger={yetkiler} onChange={setYetkiler} />
          <Button
            type="button"
            size="sm"
            className="ms-auto"
            disabled={mesgul}
            onClick={() =>
              onIslem(() => MobilYonetimService.erisimEkle(mobilKullaniciId, { firmaId, cariKartId: cari.cariKartId, yetkiler }), "Erişim eklendi.")
            }
          >
            Erişimi ekle
          </Button>
        </div>
      )}
    </div>
  );
};

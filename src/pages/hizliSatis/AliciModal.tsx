import React, { useEffect, useState } from "react";
import { Alert, Badge, Button, Col, Form, InputGroup, Modal, Row, Spinner } from "react-bootstrap";
import { IconSearch, IconUserCheck, IconUserOff, IconUsers } from "@tabler/icons-react";
import { MusteriSecimModal, SelectedCustomerResult } from "../vezne/MusteriSecimModal";
import { CariKartItem, CariService } from "../../services/cariService";
import { DovizFisService, KayitsizMusteriItem } from "../../services/dovizFisService";
import { HizliSatisService } from "../../services/hizliSatisService";
import { aliciEksikleri } from "../../../Backend/src/services/hizliSatis/hizliSatisKural";
import { noTemizle, noTuru } from "../../../Backend/src/utils/vknKontrol";
import { ANONIM_MUSTERI, HizliMusteri } from "./kaydet/tipler";

/**
 * Alıcı / müşteri (H13): TCKN/VKN yazılınca firmanın kayıtlarında (cari, önceki fatura, fişler, kayıtsız müşteri), sonra GİB'de
 * aranır; cari listeden de seçilebilir. `zorunlu` verilirse (12.000 TL sınırı ya da MASAK) eksik alanla kaydedilemez.
 */
export interface AliciZorunlulugu {
  baslik: string;
  /** MASAK: adres + kimlik + ünvan; fatura sınırı: + il/ilçe */
  ilIlce: boolean;
}

interface Props {
  acik: boolean;
  musteri: HizliMusteri;
  zorunlu: AliciZorunlulugu | null;
  /** Cari ödemesi için yalnız kayıtlı cari seçilebilir */
  kayitliGerekli?: boolean;
  kapat: () => void;
  onay: (m: HizliMusteri) => void;
}

const KAYNAK_ADI: Record<string, string> = {
  cari: "Cari karttan",
  fatura: "Önceki faturadan",
  sarraf: "Sarraf fişinden",
  doviz: "Döviz fişinden",
  kayitsiz: "Kayıtsız müşteriden",
  gib: "GİB'den",
};

export const kisilikTipi = (no: string): number => (noTemizle(no).length === 10 ? 2 : noTemizle(no).length === 11 ? 1 : 0);

export const AliciModal: React.FC<Props> = ({ acik, musteri, zorunlu, kayitliGerekli, kapat, onay }) => {
  const [m, setM] = useState<HizliMusteri>(musteri);
  const [sorguluyor, setSorguluyor] = useState(false);
  const [bilgi, setBilgi] = useState<{ tur: "success" | "warning" | "danger"; metin: string } | null>(null);
  const [secimAcik, setSecimAcik] = useState(false);
  const [cariler, setCariler] = useState<CariKartItem[]>([]);
  const [kayitsizlar, setKayitsizlar] = useState<KayitsizMusteriItem[]>([]);
  const [denendi, setDenendi] = useState(false);

  useEffect(() => {
    if (!acik) return;
    setM(musteri.tur === "anonim" ? { ...ANONIM_MUSTERI } : { ...musteri });
    setBilgi(null);
    setDenendi(false);
  }, [acik, musteri]);

  // Kimlik numarası değişirse seçili cari bağı kopar (başka kişi)
  const alan = (k: keyof HizliMusteri, v: string) =>
    setM((x) => ({ ...x, [k]: v, ...(k === "vknTckn" && x.tur === "kayitli" && noTemizle(v) !== noTemizle(x.vknTckn) ? { tur: "kayitsiz" as const, cariKartId: null, cariKod: null } : {}) }));

  const sorgula = async () => {
    const no = noTemizle(m.vknTckn);
    if (!noTuru(no)) {
      setBilgi({ tur: "danger", metin: no.length === 10 || no.length === 11 ? "Numaranın kontrol hanesi tutmuyor." : "VKN 10, TCKN 11 haneli olmalı." });
      return;
    }
    setSorguluyor(true);
    setBilgi(null);
    try {
      const r = await HizliSatisService.aliciSorgula(no);
      if (!r?.kaynak) {
        setBilgi({ tur: "warning", metin: r?.mesaj || "Kayıt bulunamadı. Bilgileri elle girin." });
        setM((x) => ({ ...x, vknTckn: no, kisilikTipi: kisilikTipi(no) }));
        return;
      }
      setM({
        tur: r.kaynak === "cari" && r.cariKartId ? "kayitli" : "kayitsiz",
        cariKartId: r.kaynak === "cari" ? r.cariKartId : null,
        cariKod: r.cariKod,
        unvan: r.unvan || "",
        vknTckn: no,
        adres: r.adres || "",
        il: r.il || "",
        ilce: r.ilce || "",
        vergiDairesi: r.vergiDairesi || "",
        telefon: r.telefon || "",
        eposta: r.eposta || "",
        mukellef: !!r.mukellef,
        kisilikTipi: kisilikTipi(no),
      });
      setBilgi({ tur: r.uyari ? "warning" : "success", metin: `${KAYNAK_ADI[r.kaynak] || "Kayıttan"} dolduruldu.${r.uyari ? " " + r.uyari : ""}${r.kaynak === "gib" ? " Adresi yazın." : ""}` });
    } catch (e: any) {
      setBilgi({ tur: "danger", metin: e?.message || "Sorgu yapılamadı." });
    } finally {
      setSorguluyor(false);
    }
  };

  const listedenSec = async () => {
    setSecimAcik(true);
    if (!cariler.length) {
      const [c, k] = await Promise.all([CariService.getCariKartlar().catch(() => []), DovizFisService.getKayitsizMusteriler().catch(() => [])]);
      setCariler(c);
      setKayitsizlar(k);
    }
  };

  const secildi = async (r: SelectedCustomerResult) => {
    setSecimAcik(false);
    if (r.type === "anonymous") {
      setM({ ...ANONIM_MUSTERI });
      return;
    }
    let { il = "", ilce = "", vergiDairesi = "" } = r;
    const raw: any = r.raw || {};
    if ((!il || !ilce || !vergiDairesi) && r.type === "registered") {
      try {
        const lk: any = await CariService.getLookups();
        const ad = (id: unknown) => (lk?.tabloMaddeleri || []).find((t: any) => Number(t.id) === Number(id))?.ad || "";
        il = il || ad(raw.ilId);
        ilce = ilce || ad(raw.ilceId);
        vergiDairesi = vergiDairesi || ad(raw.vergiDairesiId);
      } catch {
        /* adlar elle yazılır */
      }
    }
    const no = noTemizle(r.vergiKimlikNo || "");
    setM({
      tur: r.type === "registered" ? "kayitli" : "kayitsiz",
      cariKartId: r.type === "registered" ? r.id : null,
      cariKod: r.kod || null,
      unvan: r.unvan || "",
      vknTckn: no,
      adres: r.adres || "",
      il: String(il || "").trim(),
      ilce: String(ilce || "").trim(),
      vergiDairesi: String(vergiDairesi || "").trim(),
      telefon: r.telefon || "",
      eposta: r.eposta || "",
      mukellef: !!(r.isMukellef || r.eFaturaPostaKutusu),
      kisilikTipi: kisilikTipi(no),
    });
    setBilgi({ tur: "success", metin: r.type === "registered" ? "Cari karttan dolduruldu." : "Kayıtsız müşteriden dolduruldu." });
  };

  const eksikler = zorunlu ? aliciEksikleri(m).filter((e) => zorunlu.ilIlce || (e !== "İl" && e !== "İlçe")) : [];
  const tamam = () => {
    setDenendi(true);
    if (kayitliGerekli && (m.tur !== "kayitli" || !m.cariKartId)) {
      setBilgi({ tur: "danger", metin: "Cari ödemesi için kayıtlı bir cari seçin (Listeden Seç)." });
      return;
    }
    if (eksikler.length) return;
    const bos = !m.unvan.trim() && !noTemizle(m.vknTckn);
    onay(bos ? { ...ANONIM_MUSTERI } : { ...m, tur: m.tur === "anonim" ? "kayitsiz" : m.tur, vknTckn: noTemizle(m.vknTckn), kisilikTipi: kisilikTipi(m.vknTckn) });
  };
  const hatali = (ad: string) => denendi && eksikler.some((e) => e.includes(ad));

  return (
    <>
      <Modal show={acik && !secimAcik} onHide={kapat} centered size="lg" backdrop={zorunlu ? "static" : true}>
        <Modal.Header closeButton className="py-2">
          <Modal.Title className="fs-6">{zorunlu ? zorunlu.baslik : "Müşteri"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Row className="g-2 align-items-end">
            <Col md={6}>
              <Form.Label className="small mb-0">TCKN / VKN</Form.Label>
              <InputGroup>
                <Form.Control autoFocus inputMode="numeric" maxLength={11} value={m.vknTckn} isInvalid={hatali("TCKN")}
                  onChange={(e) => alan("vknTckn", e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void sorgula(); } }} />
                <Button variant="primary" disabled={sorguluyor} onClick={() => void sorgula()}>
                  {sorguluyor ? <Spinner size="sm" /> : <IconSearch size={16} />} Sorgula
                </Button>
              </InputGroup>
            </Col>
            <Col md={6} className="d-flex gap-2">
              <Button variant="outline-primary" className="flex-grow-1" onClick={() => void listedenSec()}><IconUsers size={16} className="me-1" />Listeden Seç</Button>
              {!zorunlu && !kayitliGerekli && (
                <Button variant="outline-secondary" onClick={() => { setM({ ...ANONIM_MUSTERI }); setBilgi(null); }}><IconUserOff size={16} className="me-1" />Nihai Tüketici</Button>
              )}
            </Col>
          </Row>
          {bilgi && <Alert variant={bilgi.tur} className="py-1 px-2 small mt-2 mb-0">{bilgi.metin}</Alert>}
          {m.tur === "kayitli" && <Badge bg="primary" className="mt-2"><IconUserCheck size={13} className="me-1" />Cari: {m.cariKod || m.cariKartId}</Badge>}
          <Row className="g-2 mt-1">
            <Col md={12}>
              <Form.Label className="small mb-0">Ad Soyad / Ünvan</Form.Label>
              <Form.Control maxLength={200} value={m.unvan} isInvalid={hatali("Ünvan")} onChange={(e) => alan("unvan", e.target.value)} />
            </Col>
            <Col md={12}>
              <Form.Label className="small mb-0">Adres</Form.Label>
              <Form.Control maxLength={250} value={m.adres} isInvalid={hatali("Adres")} onChange={(e) => alan("adres", e.target.value)} />
            </Col>
            <Col md={4}>
              <Form.Label className="small mb-0">İl</Form.Label>
              <Form.Control maxLength={50} value={m.il} isInvalid={hatali("İl") && !m.il.trim()} onChange={(e) => alan("il", e.target.value)} />
            </Col>
            <Col md={4}>
              <Form.Label className="small mb-0">İlçe</Form.Label>
              <Form.Control maxLength={50} value={m.ilce} isInvalid={hatali("İlçe")} onChange={(e) => alan("ilce", e.target.value)} />
            </Col>
            <Col md={4}>
              <Form.Label className="small mb-0">Vergi dairesi</Form.Label>
              <Form.Control maxLength={60} value={m.vergiDairesi} onChange={(e) => alan("vergiDairesi", e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label className="small mb-0">Telefon</Form.Label>
              <Form.Control maxLength={30} value={m.telefon} onChange={(e) => alan("telefon", e.target.value)} />
            </Col>
            <Col md={6}>
              <Form.Label className="small mb-0">E-posta</Form.Label>
              <Form.Control type="email" maxLength={100} value={m.eposta} onChange={(e) => alan("eposta", e.target.value)} />
            </Col>
          </Row>
          {denendi && eksikler.length > 0 && <Alert variant="danger" className="py-1 px-2 small mt-2 mb-0">Eksik: {eksikler.join(", ")}</Alert>}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" onClick={kapat}>Vazgeç</Button>
          <Button variant="primary" onClick={tamam}>{zorunlu ? "Kaydet ve Devam" : "Tamam"}</Button>
        </Modal.Footer>
      </Modal>
      <MusteriSecimModal show={acik && secimAcik} onClose={() => setSecimAcik(false)} cariler={cariler} kayitsizMusteriler={kayitsizlar} onSelectCustomer={(r) => void secildi(r)} currentUnvan={m.unvan} />
    </>
  );
};

export default AliciModal;

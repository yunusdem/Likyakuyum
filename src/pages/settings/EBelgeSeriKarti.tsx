import React, { useEffect, useState } from "react";
import { Badge, Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { IconDeviceFloppy, IconPlus, IconSearch, IconTrash } from "@tabler/icons-react";
import { EbelgeSeriKaydi, ebelgeService } from "../../services/ebelgeService";
import { useToast } from "../../context/ToastContext";

/**
 * Fatura serileri (docs/GIRIS_VE_EBELGE_DUZENLEME.md R3). Fatura formundaki numara listesi yalnızca buradaki serilerden
 * gelir (numara = ICE'deki son sıra + 1); her tür için bir varsayılan seri formda kendiliğinden seçilir.
 * "ICE'den bul" daha önce kesilmiş belgelerden serileri bulup listeye ekler (kaydetmek gerekir).
 */
type SeriTuru = "EFatura" | "EArsiv" | "EGider";
const TURLER: { kod: SeriTuru; ad: string; iceBul: boolean }[] = [
  { kod: "EFatura", ad: "e-Fatura", iceBul: true },
  { kod: "EArsiv", ad: "e-Arşiv", iceBul: true },
  // Perakende alış fişleri bu seriyle numaralanır ve gider pusulası olarak gider (docs/PERAKENDE_EBELGE_YOL_HARITASI.md P3)
  { kod: "EGider", ad: "e-Gider pusulası (Perakende alış)", iceBul: false },
];

const EBelgeSeriKarti: React.FC = () => {
  const { showSuccess, showToast } = useToast();
  const [liste, setListe] = useState<EbelgeSeriKaydi[]>([]);
  const [yeni, setYeni] = useState<Record<string, string>>({ EFatura: "", EArsiv: "", EGider: "" });
  const [yukleniyor, setYukleniyor] = useState(true);
  const [kaydediliyor, setKaydediliyor] = useState(false);
  const [araniyor, setAraniyor] = useState<string | null>(null);

  useEffect(() => {
    ebelgeService
      .seriListe()
      .then(setListe)
      .catch((e: any) => showToast(e?.message || "Seriler alınamadı.", "danger", 0))
      .finally(() => setYukleniyor(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ekle = (tur: SeriTuru, seri: string) => {
    const s = seri.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.length !== 3) {
      showToast("Seri 3 karakter (harf/rakam) olmalıdır.", "warning");
      return false;
    }
    if (liste.some((x) => x.belgeTuru === tur && x.seri === s)) {
      showToast(`${s} serisi zaten listede.`, "warning");
      return false;
    }
    setListe((o) =>
      o.some((x) => x.belgeTuru === tur && x.seri === s)
        ? o
        : [...o, { belgeTuru: tur, seri: s, varsayilan: !o.some((x) => x.belgeTuru === tur) }]
    );
    return true;
  };

  const varsayilanYap = (tur: string, seri: string) =>
    setListe((o) => o.map((x) => (x.belgeTuru === tur ? { ...x, varsayilan: x.seri === seri } : x)));

  const sil = (tur: string, seri: string) =>
    setListe((o) => {
      const kalan = o.filter((x) => !(x.belgeTuru === tur && x.seri === seri));
      // Varsayılan silindiyse türdeki ilk seri varsayılan olur
      if (!kalan.some((x) => x.belgeTuru === tur && x.varsayilan)) {
        const ilk = kalan.findIndex((x) => x.belgeTuru === tur);
        if (ilk >= 0) kalan[ilk] = { ...kalan[ilk], varsayilan: true };
      }
      return kalan;
    });

  const iceBul = async (tur: "EFatura" | "EArsiv") => {
    // e-Gider serisi ICE'den bulunmaz; elle girilir
    setAraniyor(tur);
    try {
      const bulunan = await ebelgeService.seriIceBul(tur);
      const yeniler = bulunan.filter((s) => !liste.some((x) => x.belgeTuru === tur && x.seri === s));
      yeniler.forEach((s) => ekle(tur, s));
      showToast(
        bulunan.length
          ? `ICE'de ${bulunan.length} seri bulundu (${bulunan.join(", ")})${yeniler.length ? `; ${yeniler.length} yeni seri eklendi, kaydetmeyi unutmayın` : "; hepsi zaten listede"}.`
          : "ICE'de bu türde kesilmiş belge bulunamadı; seriyi elle ekleyin.",
        bulunan.length ? "info" : "warning",
        6000
      );
    } catch (e: any) {
      showToast(e?.message || "ICE'den seri bulunamadı.", "danger", 0);
    } finally {
      setAraniyor(null);
    }
  };

  const kaydet = async () => {
    setKaydediliyor(true);
    try {
      setListe(await ebelgeService.seriKaydet(liste));
      showSuccess("Seriler kaydedildi.");
    } catch (e: any) {
      showToast(e?.message || "Seriler kaydedilemedi.", "danger", 0);
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <Card className="shadow-sm border border-secondary-subtle rounded-3 overflow-hidden mb-3">
      <Card.Body className="p-3 bg-body">
        <div className="fw-semibold" style={{ fontSize: "13px" }}>Fatura Serileri</div>
        <div className="text-secondary mb-2" style={{ fontSize: "12px" }}>
          Fatura formundaki numara listesi yalnızca buradaki serilerden gelir; numara ICE'deki son numaranın bir fazlasıdır.
          Varsayılan seri formda kendiliğinden seçilir. Aynı seri hem e-Fatura hem e-Arşiv'de kullanılabilir: numara iki türün
          en büyüğünden devam eder, çakışmaz.
        </div>
        {yukleniyor ? (
          <Spinner animation="border" size="sm" />
        ) : (
          <>
            <Row className="g-3">
              {TURLER.map((t) => {
                const turdekiler = liste.filter((x) => x.belgeTuru === t.kod);
                return (
                  <Col xs={12} md={4} key={t.kod}>
                    <div className="border rounded-2 p-2 h-100">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="fw-semibold" style={{ fontSize: "12.5px" }}>{t.ad}</span>
                        {t.iceBul && <Button size="sm" variant="link" className="p-0 d-flex align-items-center gap-1" style={{ fontSize: "12px" }}
                          disabled={araniyor !== null} onClick={() => void iceBul(t.kod as "EFatura" | "EArsiv")}>
                          {araniyor === t.kod ? <Spinner animation="border" size="sm" /> : <IconSearch size={13} />} ICE'den bul
                        </Button>}
                      </div>
                      {!turdekiler.length && <div className="small text-secondary mb-2">Seri tanımlı değil.</div>}
                      {turdekiler.map((x) => (
                        <div key={x.seri} className="d-flex align-items-center gap-2 mb-1">
                          <Form.Check type="radio" name={`varsayilan-${t.kod}`} id={`seri-${t.kod}-${x.seri}`} checked={x.varsayilan}
                            onChange={() => varsayilanYap(t.kod, x.seri)} title="Varsayılan seri"
                            label={<span className="font-monospace">{x.seri}</span>} />
                          {x.varsayilan && <Badge bg="success-subtle" text="success">varsayılan</Badge>}
                          <Button size="sm" variant="link" className="p-0 ms-auto" style={{ color: "#dc2626" }} title="Seriyi sil"
                            onClick={() => sil(t.kod, x.seri)}>
                            <IconTrash size={15} />
                          </Button>
                        </div>
                      ))}
                      <div className="d-flex gap-1 mt-2">
                        <Form.Control size="sm" className="font-monospace" maxLength={3} placeholder="Seri (ör. ABC)" style={{ width: 130 }}
                          value={yeni[t.kod]} onChange={(e) => setYeni((o) => ({ ...o, [t.kod]: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") }))}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (ekle(t.kod, yeni[t.kod])) setYeni((o) => ({ ...o, [t.kod]: "" })); } }} />
                        <Button size="sm" variant="outline-secondary" className="d-flex align-items-center gap-1" disabled={yeni[t.kod].length !== 3}
                          onClick={() => { if (ekle(t.kod, yeni[t.kod])) setYeni((o) => ({ ...o, [t.kod]: "" })); }}>
                          <IconPlus size={14} /> Ekle
                        </Button>
                      </div>
                    </div>
                  </Col>
                );
              })}
            </Row>
            <Button size="sm" variant="primary" className="d-flex align-items-center gap-1 mt-2" disabled={kaydediliyor} onClick={() => void kaydet()}>
              {kaydediliyor ? <Spinner animation="border" size="sm" /> : <IconDeviceFloppy size={15} />} Serileri Kaydet
            </Button>
          </>
        )}
      </Card.Body>
    </Card>
  );
};

export default EBelgeSeriKarti;

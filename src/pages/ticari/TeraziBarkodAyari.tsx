import React, { useState } from "react";
import { Badge, Button, Card, Form, InputGroup, Table } from "react-bootstrap";
import { IconBarcode, IconPlus, IconTrash } from "@tabler/icons-react";
import {
  TeraziDuzeni, ean13KontrolHanesi, teraziBarkodCoz, teraziDegerHanesi, teraziDuzeniDenetle, teraziOrnekBarkod,
} from "../../../Backend/src/services/ticari/ticariHesap";

/**
 * Stok Ayarları › Terazi barkodu (docs/TICARI_ADISYON_YOL_HARITASI.md, TA3). Terazinin bastığı EAN-13 etiketinin düzeni:
 * önek + ürün kodu (stok kartındaki "Terazi kodu") + ağırlık ya da tutar + kontrol hanesi. Deneme kutusu kaydetmeden
 * ekrandaki düzenlerle çözer.
 */
interface Props {
  duzenler: TeraziDuzeni[];
  setDuzenler: (d: TeraziDuzeni[]) => void;
  disabled?: boolean;
}

const yeniDuzen = (mevcut: TeraziDuzeni[]): TeraziDuzeni => {
  const bos = ["27", "28", "29", "20", "21", "22", "23", "24", "25", "26"].find((o) => !mevcut.some((d) => d.onek === o)) || "";
  return { onek: bos, kodHane: 5, degerTuru: bos === "28" ? "F" : "A", ondalik: bos === "28" ? 2 : 3, aktif: true, aciklama: null };
};

/** Deneme sonucu: neden çözülmediği de yazılır */
const dene = (barkod: string, duzenler: TeraziDuzeni[]): { tamam: boolean; metin: string } => {
  const b = barkod.trim();
  if (!b) return { tamam: false, metin: "" };
  if (!/^\d{13}$/.test(b)) return { tamam: false, metin: "Terazi barkodu 13 rakam olmalı." };
  const k = ean13KontrolHanesi(b);
  if (k !== Number(b[12])) return { tamam: false, metin: `Kontrol hanesi yanlış: son hane ${k} olmalı.` };
  const c = teraziBarkodCoz(b, duzenler);
  if (!c) return { tamam: false, metin: "Etkin bir düzenin önekiyle başlamıyor; kasada normal barkod gibi aranır." };
  const deger = c.agirlikKg !== null
    ? `${c.agirlikKg.toLocaleString("tr-TR", { minimumFractionDigits: 3, maximumFractionDigits: 4 })} kg`
    : `${Number(c.fiyat).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
  return { tamam: true, metin: `Önek ${c.duzen.onek} · Terazi kodu ${c.plu} · ${deger}` };
};

export const TeraziBarkodAyari: React.FC<Props> = ({ duzenler, setDuzenler, disabled }) => {
  const [deneme, setDeneme] = useState("");
  const degistir = (i: number, d: Partial<TeraziDuzeni>) => setDuzenler(duzenler.map((x, j) => (j === i ? { ...x, ...d } : x)));
  const sonuc = dene(deneme, duzenler);
  return (
    <Card className="border shadow-xs h-100">
      <Card.Header className="bg-light py-2 fw-bold small d-flex align-items-center gap-1"><IconBarcode size={16} />Terazi barkodu</Card.Header>
      <Card.Body className="p-2">
        <div className="small text-muted mb-2 px-1">
          Terazinin bastığı etiket okutulunca ürün, stok kartındaki <b>Terazi kodu</b> ile bulunur; kilo ya da tutar barkoddan gelir.
          Barkod: önek + ürün kodu + değer + kontrol hanesi (13 rakam). Kasaptaki yüksek kg fiyatı için ağırlık gömülü düzen önerilir.
        </div>
        <div className="table-responsive">
          <Table size="sm" bordered className="align-middle mb-2">
            <thead className="table-light">
              <tr className="small text-secondary">
                <th style={{ width: 70 }}>Önek</th><th style={{ width: 95 }}>Ürün kodu hanesi</th><th style={{ width: 150 }}>Gömülü değer</th>
                <th style={{ width: 125 }}>Ondalık</th><th>Örnek barkod</th><th style={{ width: 55 }} className="text-center">Etkin</th><th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {duzenler.map((d, i) => {
                const hata = teraziDuzeniDenetle(d) || (duzenler.findIndex((x) => x.onek === d.onek) !== i ? "Bu önek iki kez yazılmış." : null);
                return (
                  <tr key={i} className={hata ? "table-danger" : undefined} title={hata || undefined}>
                    <td><Form.Control size="sm" value={d.onek} maxLength={2} disabled={disabled} aria-label="Önek" onChange={(e) => degistir(i, { onek: e.target.value.replace(/\D/g, "") })} /></td>
                    <td>
                      <Form.Select size="sm" value={d.kodHane} disabled={disabled} aria-label="Ürün kodu hanesi" onChange={(e) => degistir(i, { kodHane: Number(e.target.value) })}>
                        {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                      </Form.Select>
                    </td>
                    <td>
                      <Form.Select size="sm" value={d.degerTuru} disabled={disabled} aria-label="Gömülü değer"
                        onChange={(e) => { const t = e.target.value as "A" | "F"; degistir(i, { degerTuru: t, ondalik: t === "A" ? 3 : 2 }); }}>
                        <option value="A">Ağırlık (kg)</option>
                        <option value="F">Tutar (TL)</option>
                      </Form.Select>
                    </td>
                    <td>
                      <Form.Select size="sm" value={d.ondalik} disabled={disabled} aria-label="Ondalık" onChange={(e) => degistir(i, { ondalik: Number(e.target.value) })}>
                        {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}{d.degerTuru === "A" && n === 3 ? " (gram)" : d.degerTuru === "F" && n === 2 ? " (kuruş)" : ""}</option>)}
                      </Form.Select>
                    </td>
                    <td className="small font-monospace">
                      {hata ? <span className="text-danger">{hata}</span> : (
                        <span title={`Kod 42, ${d.degerTuru === "A" ? "0,750 kg" : "187,50 TL"}; değer ${teraziDegerHanesi(d)} hane`}>{teraziOrnekBarkod(d, 42, d.degerTuru === "A" ? 0.75 : 187.5)} <span className="text-muted">= 42 · {d.degerTuru === "A" ? "0,750 kg" : "187,50 TL"}</span></span>
                      )}
                    </td>
                    <td className="text-center"><Form.Check aria-label="Etkin" checked={d.aktif} disabled={disabled} onChange={(e) => degistir(i, { aktif: e.target.checked })} /></td>
                    <td className="text-center p-0">
                      <Button variant="link" size="sm" className="text-danger p-1" disabled={disabled} title="Düzeni sil" aria-label={`${d.onek} düzenini sil`}
                        onClick={() => setDuzenler(duzenler.filter((_, j) => j !== i))}><IconTrash size={16} /></Button>
                    </td>
                  </tr>
                );
              })}
              {!duzenler.length && <tr><td colSpan={7} className="text-center text-muted small py-2">Düzen yok; terazi barkodu okunmaz.</td></tr>}
            </tbody>
          </Table>
        </div>
        <Button variant="outline-primary" size="sm" disabled={disabled || duzenler.length >= 10} onClick={() => setDuzenler([...duzenler, yeniDuzen(duzenler)])}>
          <IconPlus size={14} className="me-1" />Düzen ekle
        </Button>
        <div className="border-top mt-2 pt-2">
          <Form.Label className="small mb-1">Barkodu dene (kaydetmeden)</Form.Label>
          <InputGroup size="sm">
            <InputGroup.Text><IconBarcode size={14} /></InputGroup.Text>
            <Form.Control value={deneme} placeholder="Terazi etiketini okutun ya da yazın" onChange={(e) => setDeneme(e.target.value.replace(/\s/g, ""))} aria-label="Denenecek barkod" />
          </InputGroup>
          {sonuc.metin && <div className="small mt-1">{sonuc.tamam ? <Badge bg="success" className="me-1">Çözüldü</Badge> : <Badge bg="warning" text="dark" className="me-1">Çözülmedi</Badge>}{sonuc.metin}</div>}
        </div>
      </Card.Body>
    </Card>
  );
};

export default TeraziBarkodAyari;

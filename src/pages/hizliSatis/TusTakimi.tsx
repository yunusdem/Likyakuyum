import React from "react";
import { IconBackspace } from "@tabler/icons-react";

/** Hızlı satış tuş takımı (H5): rakamlar girişi doldurur; komut tuşları seçili satıra / fişe uygulanır */
export type TusKomutu = "miktar" | "fiyat" | "indirim" | "satirSil" | "enter" | "serbest";

interface Props {
  giris: string;
  setGiris: (f: (g: string) => string) => void;
  onKomut: (k: TusKomutu) => void;
  fiyatYetkisi: boolean;
  indirimVar: boolean;
  serbestVar: boolean;
  disabled?: boolean;
}

export const girisEkle = (g: string, t: string): string => {
  if (t === ",") return g.includes(",") ? g : (g || "0") + ",";
  const yeni = (g === "0" && t !== "00" ? "" : g) + t;
  const [tam, kesir] = yeni.split(",");
  if (tam.replace(/^0+(?=\d)/, "").length > 9 || (kesir && kesir.length > 4)) return g;
  return yeni.replace(/^0+(?=\d)/, "");
};

export const girisSayi = (g: string): number | null => {
  if (!g) return null;
  const n = Number(g.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const TUS: React.CSSProperties = { height: 54, fontSize: 20, fontWeight: 700, borderRadius: 10, touchAction: "manipulation" };
const KOMUT: React.CSSProperties = { ...TUS, fontSize: 13, lineHeight: 1.1 };

export const TusTakimi: React.FC<Props> = ({ giris, setGiris, onKomut, fiyatYetkisi, indirimVar, serbestVar, disabled }) => {
  const r = (t: string) => (
    <button key={t} type="button" className="btn btn-light border" style={TUS} disabled={disabled} onClick={() => setGiris((g) => girisEkle(g, t))}>{t}</button>
  );
  const k = (ad: string, komut: TusKomutu, renk = "btn-outline-secondary", kapali = false, title?: string) => (
    <button type="button" className={`btn ${renk}`} style={KOMUT} disabled={disabled || kapali} title={title} onClick={() => onKomut(komut)}>{ad}</button>
  );
  return (
    <div>
      <div className="form-control text-end fw-bold mb-2" style={{ fontSize: 26, height: 50, fontVariantNumeric: "tabular-nums" }} aria-label="Tuş takımı girişi">
        {giris || <span className="text-muted fw-normal" style={{ fontSize: 15 }}>miktar / tutar</span>}
      </div>
      <div className="d-grid gap-1" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {r("7")}{r("8")}{r("9")}{k("Miktar", "miktar", "btn-outline-primary")}
        {r("4")}{r("5")}{r("6")}{k("Fiyat Değiştir", "fiyat", "btn-outline-primary", !fiyatYetkisi, fiyatYetkisi ? undefined : "Hızlı Satış – Fiyat/İndirim yetkisi gerekli")}
        {r("1")}{r("2")}{r("3")}{k("İndirim", "indirim", "btn-outline-primary", !fiyatYetkisi || !indirimVar, !indirimVar ? "Bu modülde fiş indirimi yok" : fiyatYetkisi ? undefined : "Hızlı Satış – Fiyat/İndirim yetkisi gerekli")}
        {r("0")}{r("00")}{r(",")}{k("Satır Sil", "satirSil", "btn-outline-danger")}
        <button type="button" className="btn btn-light border" style={TUS} disabled={disabled} title="Geri sil" onClick={() => setGiris((g) => g.slice(0, -1))}><IconBackspace size={20} /></button>
        <button type="button" className="btn btn-light border" style={TUS} disabled={disabled} onClick={() => setGiris(() => "")}>C</button>
        {k("Serbest Ürün", "serbest", "btn-outline-success", !serbestVar, serbestVar ? undefined : "Bu modülde serbest ürün yok")}
        {k("Enter", "enter", "btn-secondary")}
      </div>
    </div>
  );
};

export default TusTakimi;

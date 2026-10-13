import React, { useEffect, useState } from "react";
import { ButtonGroup, Button, Form } from "react-bootstrap";
import { BICIM_ADLARI, ISLEM_ADLARI, degerCoz, degerKur, type DegerParcasi, type Islem } from "../../utils/belgeSablon/editorYardim";

/**
 * Değer seçici (docs/FIS_TASARIM_YOL_HARITASI.md, bölüm 11, K13): yazılım bilmeyen kullanıcı için üç yol —
 * "Bilgi" (fişin bir bilgisi, biçimiyle), "Hesap" (bilgi / sayı ile + − × ÷) ve "Yazı" (elle sabit yazı).
 * Sonuç şablonun `{{alan|biçim}}` / `{{= a işlem b}}` yazımıdır; kullanıcı bu yazımı görmez.
 */

export interface AlanSecenegi { yol: string; ad: string; grup: string }

interface Props {
  deger: string;
  onChange: (v: string) => void;
  secenekler: AlanSecenegi[];
  /** Ön / son yazı kutuları gösterilsin mi (tablo değerinde evet, karekodda hayır) */
  ekler?: boolean;
  /** Değer boşken açılacak sekme */
  bosMod?: DegerParcasi["tur"];
}

const gruplu = (secenekler: AlanSecenegi[]) => {
  const g = new Map<string, AlanSecenegi[]>();
  for (const s of secenekler) g.set(s.grup, [...(g.get(s.grup) || []), s]);
  return [...g.entries()];
};

/** Alan listesi (gruplu). Bilinmeyen yol da seçenek olarak kalır, değer kaybolmaz. */
export const AlanSecimi: React.FC<{ value: string; onChange: (v: string) => void; secenekler: AlanSecenegi[]; bos?: string; sayiSecenegi?: boolean }> = ({ value, onChange, secenekler, bos = "(bilgi seçin)", sayiSecenegi }) => (
  <Form.Select size="sm" value={value} onChange={(e) => onChange(e.target.value)} title={value ? `{{${value}}}` : undefined}>
    <option value="">{bos}</option>
    {sayiSecenegi && <option value="#sayi">Sayı yazacağım…</option>}
    {value && value !== "#sayi" && !secenekler.some((s) => s.yol === value) && <option value={value}>{value}</option>}
    {gruplu(secenekler).map(([grup, l]) => (
      <optgroup key={grup} label={grup}>
        {l.map((s) => <option key={s.yol} value={s.yol}>{s.ad}</option>)}
      </optgroup>
    ))}
  </Form.Select>
);

const sayiMi = (t: string) => /^-?\d/.test(String(t || "").trim());

/** Hesabın bir terimi: bilgi ya da elle yazılan sayı */
const Terim: React.FC<{ value: string; onChange: (v: string) => void; secenekler: AlanSecenegi[] }> = ({ value, onChange, secenekler }) => {
  const [sayi, setSayi] = useState(() => sayiMi(value));
  return sayi ? (
    <div className="d-flex gap-1">
      <Form.Control size="sm" inputMode="decimal" value={value.replace(".", ",")} placeholder="ör. 0,20"
        onChange={(e) => onChange(e.target.value.replace(/[^\d,.-]/g, ""))} />
      <Button size="sm" variant="outline-secondary" title="Sayı yerine bilgi seç" onClick={() => { setSayi(false); onChange(""); }}>Bilgi</Button>
    </div>
  ) : (
    <AlanSecimi value={value} secenekler={secenekler} sayiSecenegi onChange={(v) => { if (v === "#sayi") { setSayi(true); onChange("1"); } else onChange(v); }} />
  );
};

const ilkParca = (deger: string, bosMod: DegerParcasi["tur"]): DegerParcasi =>
  !deger && bosMod === "bilgi" ? { tur: "bilgi", alan: "", bicim: "", on: "", son: "" } : degerCoz(deger);

export const DegerSecici: React.FC<Props> = ({ deger, onChange, secenekler, ekler = true, bosMod = "yazi" }) => {
  const [p, setP] = useState<DegerParcasi>(() => ilkParca(deger, bosMod));
  // Dışarıdan değişirse (geri al, başka satır) yeniden çözülür; yarım seçim (bilgi seçilmemiş) korunur
  useEffect(() => { if (degerKur(p) !== deger) setP(ilkParca(deger, bosMod)); }, [deger]); // eslint-disable-line react-hooks/exhaustive-deps
  const yaz = (yeni: DegerParcasi) => { setP(yeni); onChange(degerKur(yeni)); };
  const kucuk = { fontSize: 11 } as const;

  const modDegistir = (mod: DegerParcasi["tur"]) => {
    if (mod === p.tur) return;
    const on = p.tur === "yazi" ? "" : p.on, son = p.tur === "yazi" ? "" : p.son;
    const bicim = p.tur === "yazi" ? "" : p.bicim;
    if (mod === "yazi") yaz({ tur: "yazi", metin: degerKur(p) });
    else if (mod === "bilgi") yaz({ tur: "bilgi", alan: p.tur === "hesap" ? (sayiMi(p.a) ? "" : p.a) : "", bicim, on, son });
    else yaz({ tur: "hesap", a: p.tur === "bilgi" ? p.alan : "", islem: "*", b: "1", bicim: bicim || "sayi", on, son });
  };

  return (
    <div className="border rounded p-1 bg-white">
      <ButtonGroup size="sm" className="w-100 mb-1">
        {([["bilgi", "Bilgi"], ["hesap", "Hesap"], ["yazi", "Yazı"]] as const).map(([m, ad]) => (
          <Button key={m} variant={p.tur === m ? "primary" : "outline-primary"} className="py-0" style={kucuk} onClick={() => modDegistir(m)}>{ad}</Button>
        ))}
      </ButtonGroup>
      {p.tur === "yazi" ? (
        <Form.Control size="sm" value={p.metin} placeholder="Basılacak yazı" onChange={(e) => yaz({ tur: "yazi", metin: e.target.value })} />
      ) : (
        <>
          {p.tur === "bilgi" ? (
            <AlanSecimi value={p.alan} secenekler={secenekler} onChange={(v) => yaz({ ...p, alan: v })} />
          ) : (
            <div className="d-grid gap-1">
              <Terim value={p.a} secenekler={secenekler} onChange={(v) => yaz({ ...p, a: v })} />
              <Form.Select size="sm" value={p.islem} onChange={(e) => yaz({ ...p, islem: e.target.value as Islem })}>
                {ISLEM_ADLARI.map(([i, ad]) => <option key={i} value={i}>{ad}</option>)}
              </Form.Select>
              <Terim value={p.b} secenekler={secenekler} onChange={(v) => yaz({ ...p, b: v })} />
            </div>
          )}
          <Form.Select size="sm" className="mt-1" value={p.bicim} title="Görünüş" onChange={(e) => yaz({ ...p, bicim: e.target.value })}>
            {BICIM_ADLARI.filter(([b]) => p.tur === "bilgi" || (b && b !== "buyuk")).map(([b, ad]) => <option key={b} value={b}>{ad}</option>)}
          </Form.Select>
          {ekler && (
            <div className="d-flex gap-1 mt-1">
              <Form.Control size="sm" value={p.on} placeholder="Önüne yazı" title="Değerin önüne basılır (ör. 'Tel: ')" onChange={(e) => yaz({ ...p, on: e.target.value.replace(/[{}]/g, "") })} />
              <Form.Control size="sm" value={p.son} placeholder="Sonuna yazı" title="Değerin arkasına basılır (ör. ' TL')" onChange={(e) => yaz({ ...p, son: e.target.value.replace(/[{}]/g, "") })} />
            </div>
          )}
        </>
      )}
    </div>
  );
};

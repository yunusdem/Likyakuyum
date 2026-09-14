import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Form, InputGroup, Modal, Spinner, Table } from "react-bootstrap";
import { IconBinoculars, IconCheck, IconSearch, IconX } from "@tabler/icons-react";
import CodeLookupInput from "../../components/common/CodeLookupInput";

/**
 * Rapor parametre "dürbün"ü (yönetici isteği 14.09.2026): cari / vezne / para seçimleri
 * projedeki dürbün desenine uyar (CodeLookupInput + arama penceresi). Pencerede kod ve yanındaki
 * alanlarda (ad, VKN, telefon…) aranır; tek ya da çoklu seçim yapılır. LookupModal tek seçimli olduğu
 * için burada çoklu seçim de destekleyen ayrı bir pencere kullanılır; ortak bileşenlere dokunulmaz.
 */

export interface SecimKolon<T> { baslik: string; genislik?: string; hiza?: "left" | "center" | "right"; deger: (x: T) => React.ReactNode }

export interface SecimPenceresiProps<T> {
  show: boolean; onHide: () => void; title: string; items: T[]; yukleniyor?: boolean;
  kolonlar: SecimKolon<T>[];
  /** Arama metni bu alanlarda aranır (küçük/büyük harf duyarsız) */
  aramaAlanlari: (x: T) => (string | number | null | undefined)[];
  anahtar: (x: T) => string;
  aramaYerTutucu?: string;
  coklu?: boolean;
  secili?: string[];
  onSec: (secilen: T[]) => void;
}

const kucult = (v: unknown) => String(v ?? "").toLocaleLowerCase("tr-TR");

export function SecimPenceresi<T>({ show, onHide, title, items, yukleniyor, kolonlar, aramaAlanlari, anahtar, aramaYerTutucu, coklu, secili, onSec }: SecimPenceresiProps<T>) {
  const [arama, setArama] = useState("");
  const [isaretli, setIsaretli] = useState<Set<string>>(new Set());
  const [imlec, setImlec] = useState<string | null>(null);
  const aramaRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (show) { setArama(""); setIsaretli(new Set(secili || [])); setImlec(null); } }, [show, secili]);

  const suzulmus = useMemo(() => {
    const t = kucult(arama.trim());
    if (!t) return items;
    const parcalar = t.split(/\s+/).filter(Boolean);
    return items.filter(x => { const metin = aramaAlanlari(x).map(kucult).join(" "); return parcalar.every(pp => metin.includes(pp)); });
  }, [items, arama, aramaAlanlari]);

  const sec = (x: T) => {
    if (coklu) { setIsaretli(o => { const n = new Set(o); const k = anahtar(x); if (n.has(k)) n.delete(k); else n.add(k); return n; }); setImlec(anahtar(x)); }
    else { onSec([x]); onHide(); }
  };
  const onayla = () => {
    if (coklu) { onSec(items.filter(x => isaretli.has(anahtar(x)))); onHide(); return; }
    const hedef = (imlec && suzulmus.find(x => anahtar(x) === imlec)) || suzulmus[0];
    if (hedef) { onSec([hedef]); onHide(); }
  };
  const klavye = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter") { e.preventDefault(); if (coklu && imlec) { const x = suzulmus.find(y => anahtar(y) === imlec); if (x) { sec(x); return; } } onayla(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); if (!suzulmus.length) return;
      const i = suzulmus.findIndex(x => anahtar(x) === imlec);
      const yeni = e.key === "ArrowDown" ? Math.min(i + 1, suzulmus.length - 1) : Math.max(i - 1, 0);
      setImlec(anahtar(suzulmus[yeni]));
    }
  };
  useEffect(() => { if (imlec) document.querySelector(".rapor-secim-imlec")?.scrollIntoView({ block: "nearest" }); }, [imlec]);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered backdrop="static" onKeyDown={klavye} onEntered={() => aramaRef.current?.focus()}>
      <Modal.Header closeButton className="py-2 bg-light">
        <Modal.Title className="fs-6 fw-bold d-flex align-items-center gap-2"><IconBinoculars size={20} className="text-primary" />{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="p-3">
        <InputGroup className="mb-2">
          <InputGroup.Text className="bg-white border-end-0"><IconSearch size={16} className="text-secondary" /></InputGroup.Text>
          <Form.Control ref={aramaRef} className="border-start-0" placeholder={aramaYerTutucu || "Kod, ad veya diğer alanlarla arayın…"} value={arama} onChange={e => { setArama(e.target.value); setImlec(null); }} />
          {arama && <Button variant="outline-secondary" className="bg-white" onClick={() => { setArama(""); aramaRef.current?.focus(); }}><IconX size={14} /></Button>}
        </InputGroup>
        <div className="d-flex justify-content-between align-items-center mb-2 small text-muted px-1">
          <span>{coklu ? "Satıra tıklayarak işaretleyin; birden fazla seçilebilir." : "Çift tıklama veya Enter ile seçilir; ↑↓ ile gezilir."}</span>
          {coklu ? <Badge bg="primary">{isaretli.size} seçili</Badge> : null}
        </div>
        <style>{`.rapor-secim-imlec > td { background-color: #e0f2fe !important; } .rapor-secim-isaretli > td { background-color: #dcfce7 !important; }`}</style>
        <div className="border rounded" style={{ maxHeight: 380, overflowY: "auto" }}>
          {yukleniyor ? <div className="p-4 text-center text-muted"><Spinner size="sm" animation="border" className="me-2" />Yükleniyor…</div>
            : !suzulmus.length ? <div className="p-4 text-center text-muted">{items.length ? "Arama ölçütüne uygun kayıt yok." : "Kayıt bulunamadı."}</div>
            : <Table hover size="sm" className="mb-0 align-middle">
              <thead className="table-light sticky-top"><tr>
                <th style={{ width: 36 }} className="text-center">{coklu ? "✓" : "#"}</th>
                {kolonlar.map((k, i) => <th key={i} style={k.genislik ? { width: k.genislik } : undefined} className={k.hiza === "center" ? "text-center" : k.hiza === "right" ? "text-end" : ""}>{k.baslik}</th>)}
                {!coklu && <th style={{ width: 60 }} />}
              </tr></thead>
              <tbody>
                {suzulmus.map((x, i) => { const k = anahtar(x); const im = k === imlec, isr = isaretli.has(k);
                  return <tr key={k} style={{ cursor: "pointer", userSelect: "none" }} className={im ? "rapor-secim-imlec" : isr ? "rapor-secim-isaretli" : ""}
                    onClick={() => coklu ? sec(x) : setImlec(k)} onDoubleClick={() => sec(x)}>
                    <td className="text-center small text-secondary">{coklu ? <Form.Check type="checkbox" checked={isr} readOnly tabIndex={-1} /> : im ? <IconCheck size={15} className="text-primary" /> : i + 1}</td>
                    {kolonlar.map((c, ci) => <td key={ci} className={c.hiza === "center" ? "text-center" : c.hiza === "right" ? "text-end" : ""}>{c.deger(x)}</td>)}
                    {!coklu && <td className="text-center"><Button size="sm" variant={im ? "primary" : "outline-secondary"} className="py-0 px-2" onClick={e => { e.stopPropagation(); sec(x); }}>Seç</Button></td>}
                  </tr>; })}
              </tbody>
            </Table>}
        </div>
      </Modal.Body>
      <Modal.Footer className="py-2 bg-light d-flex justify-content-between">
        <span className="small text-muted">{suzulmus.length} / {items.length} kayıt</span>
        <div className="d-flex gap-2">
          {coklu && <Button variant="outline-secondary" size="sm" onClick={() => setIsaretli(new Set())}>İşaretleri kaldır</Button>}
          <Button variant="secondary" size="sm" onClick={onHide}>Kapat</Button>
          <Button variant="primary" size="sm" onClick={onayla} disabled={!coklu && !suzulmus.length}>{coklu ? "Seçimi onayla" : "Seç"}</Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

/** Dürbünlü tek alan: kutuda kod (yazılabilir) + dürbün düğmesi; seçim penceresi bu bileşenin içindedir. */
export interface DurbunAlanProps<T> {
  value: string; onChange: (v: string) => void; onSelect: (x: T) => void;
  placeholder?: string; title: string; items: T[]; yukleniyor?: boolean; kolonlar: SecimKolon<T>[];
  aramaAlanlari: (x: T) => (string | number | null | undefined)[]; anahtar: (x: T) => string; aramaYerTutucu?: string;
  /** Kutu yalnızca gösterim (çoklu seçimde) */
  saltOkunur?: boolean; coklu?: boolean; secili?: string[]; onCokluSec?: (x: T[]) => void; disabled?: boolean;
}
export function DurbunAlan<T>(p: DurbunAlanProps<T>) {
  const [acik, setAcik] = useState(false);
  return <>
    <CodeLookupInput value={p.value} onChange={e => !p.saltOkunur && p.onChange(e.target.value)} onLookupClick={() => setAcik(true)} placeholder={p.placeholder}
      lookupTitle={p.title} disabled={p.disabled} size="sm" readOnly={p.saltOkunur} title={p.saltOkunur ? p.value : undefined} />
    <SecimPenceresi<T> show={acik} onHide={() => setAcik(false)} title={p.title} items={p.items} yukleniyor={p.yukleniyor} kolonlar={p.kolonlar}
      aramaAlanlari={p.aramaAlanlari} anahtar={p.anahtar} aramaYerTutucu={p.aramaYerTutucu} coklu={p.coklu} secili={p.secili}
      onSec={s => { if (p.coklu) p.onCokluSec?.(s); else if (s[0]) p.onSelect(s[0]); }} />
  </>;
}

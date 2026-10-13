import React, { useEffect, useState } from "react";
import { Badge, Button, ButtonGroup, Form, InputGroup } from "react-bootstrap";
import {
  IconAlignCenter, IconAlignLeft, IconAlignRight, IconArrowDown, IconArrowLeft, IconArrowRight, IconArrowUp,
  IconBold, IconChevronDown, IconChevronUp, IconCopy, IconItalic, IconMinus, IconPlus, IconTrash, IconUnderline,
} from "@tabler/icons-react";
import { YAZI_TIPLERI, type BelgeOge, type BelgeSablon } from "../../../Backend/src/services/belge/sablonCekirdek";
import type { BelgeGorseli } from "../../services/belgeService";
import {
  OGE_ADLARI, alttakileriKaydir, diziEkle, diziGuncelle, diziSil, diziTasi, kosulCoz, kosulKur, mmPt, ogeKopyala, ogeSil, ogeSirala, ptMm,
  satirNesnesi, sutunEkle, sutunSil, sutunTasi, tabloSatirEkle, tabloSatirGuncelle, type KosulSecimi,
} from "../../utils/belgeSablon/editorYardim";
import { AlanSecimi, DegerSecici, type AlanSecenegi } from "./DegerSecici";

/**
 * Seçili öğenin özellikleri — sade dil (docs/FIS_TASARIM_YOL_HARITASI.md, bölüm 11, K15–K16):
 * ölçüler milimetre, koşul "Ne zaman görünsün", değerler Bilgi / Hesap / Yazı seçiciyle; tablo satırı ve
 * liste kolonu eklenip silinir; yazı tipi, boyut, kalın / italik / altı çizili. JSON yalnız "Uzman" bölümünde.
 */

export interface AlanKatalogBilgisi { alanlar: string[]; listeler: Record<string, string[]>; aciklamalar?: Record<string, string> }

interface Props {
  sablon: BelgeSablon;
  secili: number;
  katalog: AlanKatalogBilgisi | null;
  firmaGorselleri: BelgeGorseli[];
  /** Ortak değişiklik (geçmişe yazar; `anahtar` aynı alana art arda yazımı birleştirir) */
  degistir: (yeni: BelgeSablon, anahtar?: string) => void;
  setSecili: (i: number | null) => void;
  /** Dosya seçtirip görseli yükler; yüklenen görselin adını döner */
  gorselYukle: (tur: "LOGO" | "IMZA") => Promise<string | null>;
}

const GRUP_ADLARI: Record<string, string> = {
  firma: "Firma", musteri: "Müşteri", toplam: "Toplamlar", tutar: "Tutarlar", s: "Bu satırın bilgileri", sube: "Şube", kasa: "Kasa",
};
const kopya = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const sayiOku = (v: string) => { const n = parseFloat(String(v).replace(",", ".")); return Number.isFinite(n) ? n : undefined; };
const Baslik: React.FC<{ children: React.ReactNode }> = ({ children }) => <div className="fw-semibold small border-bottom mt-3 mb-1 pb-1 text-primary">{children}</div>;
const kucuk = { fontSize: 11 } as const;

export const OzellikPaneli: React.FC<Props> = ({ sablon, secili, katalog, firmaGorselleri, degistir: degistirDis, setSecili, gorselYukle }) => {
  // Yazılı öğe uzar / kısalırsa alttakiler de kayar (satır ekleyince alttaki yazının üstüne binmesin)
  const degistir = (yeni: BelgeSablon, anahtar?: string) => degistirDis(alttakileriKaydir(sablon, yeni, secili), anahtar);
  const o: any = sablon.ogeler[secili];
  const [jsonMetni, setJsonMetni] = useState("");
  const [jsonHata, setJsonHata] = useState<string | null>(null);
  /** Koşul boşken seçilen ama bilgisi henüz seçilmemiş "dolu / boş" seçimi */
  const [bekleyenKosul, setBekleyenKosul] = useState<KosulSecimi["mod"]>("her");
  useEffect(() => { setJsonMetni(o ? JSON.stringify(o, null, 2) : ""); setJsonHata(null); }, [o]);
  useEffect(() => { setBekleyenKosul("her"); }, [secili]);
  if (!o) return null;

  const guncelle = (alanlar: Record<string, unknown>, anahtar?: string) => {
    const y = kopya(sablon);
    const h: any = y.ogeler[secili];
    for (const [k, v] of Object.entries(alanlar)) { if (v === undefined || v === "") delete h[k]; else h[k] = v; }
    degistir(y, anahtar ? `${secili}:${anahtar}` : undefined);
  };

  // ── Alan seçenekleri: liste öğesinde önce satırın bilgileri
  const ad = (yol: string) => katalog?.aciklamalar?.[yol] || yol;
  const grup = (yol: string) => GRUP_ADLARI[yol.split(".")[0]] || "Belge";
  const genel: AlanSecenegi[] = (katalog?.alanlar || []).map((yol) => ({ yol, ad: ad(yol), grup: yol.includes(".") ? grup(yol) : "Belge" }));
  const listeAlanlari: AlanSecenegi[] = o.tip === "liste" && katalog?.listeler[o.kaynak]
    ? [...katalog.listeler[o.kaynak], "sira"].map((yol) => ({ yol, ad: yol === "sira" ? "Sıra no" : ad(yol), grup: "Bu satırın bilgileri" }))
    : [];
  const secenekler = [...listeAlanlari, ...genel];

  // ── Ölçü kutusu: mm (şablon punto saklar) ya da punto (yazı boyutu)
  const olcu = (alan: string, etiket: string, birim: "mm" | "pt" = "mm") => (
    <Form.Group className="mb-1" key={alan}>
      <Form.Label className="mb-0" style={kucuk}>{etiket}</Form.Label>
      <InputGroup size="sm">
        <Form.Control type="number" step={birim === "mm" ? 0.5 : 0.5}
          value={typeof o[alan] === "number" ? (birim === "mm" ? ptMm(o[alan]) : Math.round(o[alan] * 100) / 100) : ""}
          onChange={(e) => { const v = sayiOku(e.target.value); guncelle({ [alan]: v === undefined ? undefined : birim === "mm" ? mmPt(v) : v }, alan); }} />
        <InputGroup.Text style={kucuk}>{birim}</InputGroup.Text>
      </InputGroup>
    </Form.Group>
  );

  const yazili = ["metin", "satirlar", "tablo", "liste", "filigran"].includes(o.tip);
  const tabloGibi = o.tip === "tablo" || (o.tip === "liste" && !o.sutunlar);
  const sutunlu = o.tip === "liste" && Array.isArray(o.sutunlar);
  const boyut = typeof o.boyut === "number" ? o.boyut : sablon.yaziBoyutu ?? 8;
  const kosul = kosulCoz(o.kosul);
  const kosulModu = kosul.mod !== "her" ? kosul.mod : bekleyenKosul;

  return (
    <>
      <div className="d-flex align-items-center gap-1 mb-2">
        <Badge bg="secondary">{OGE_ADLARI[o.tip] || o.tip}</Badge>
        <Form.Control size="sm" value={o.ad ?? ""} placeholder={o.id || "Ad verin"} title="Bu öğeye kendiniz için bir ad verin" onChange={(e) => guncelle({ ad: e.target.value }, "ad")} />
      </div>
      <div className="d-flex gap-1">
        <Button size="sm" variant="outline-secondary" title="Kopyasını oluştur (Ctrl+D)" onClick={() => { const r = ogeKopyala(sablon, secili); degistirDis(r.sablon); setSecili(r.yeni); }}><IconCopy size={14} /> Kopyala</Button>
        <Button size="sm" variant="outline-secondary" title="Arkaya gönder" onClick={() => { const r = ogeSirala(sablon, secili, -1); degistirDis(r.sablon); setSecili(r.yeni); }}><IconChevronDown size={14} /></Button>
        <Button size="sm" variant="outline-secondary" title="Öne getir" onClick={() => { const r = ogeSirala(sablon, secili, 1); degistirDis(r.sablon); setSecili(r.yeni); }}><IconChevronUp size={14} /></Button>
        <Button size="sm" variant="outline-danger" className="ms-auto" title="Sil (Delete)" onClick={() => { degistirDis(ogeSil(sablon, secili)); setSecili(null); }}><IconTrash size={14} /> Sil</Button>
      </div>

      {/* ── İçerik */}
      <Baslik>İçerik</Baslik>
      {(o.tip === "metin" || o.tip === "filigran") && (
        <>
          <Form.Control as="textarea" rows={3} size="sm" value={o.metin ?? ""} onChange={(e) => guncelle({ metin: e.target.value }, "metin")} />
          <MetneEkle secenekler={secenekler} onEkle={(parca) => guncelle({ metin: `${o.metin ? `${o.metin} ` : ""}${parca}` })} />
        </>
      )}

      {o.tip === "satirlar" && (
        <>
          {(o.satirlar || []).map((satir: string, n: number) => {
            const kosullu = satir.startsWith("?");
            return (
              <div key={`${secili}-${n}-${(o.satirlar || []).length}`} className="border rounded p-1 mb-1 bg-light">
                <div className="d-flex align-items-center gap-1 mb-1" style={kucuk}>
                  <span className="fw-semibold">{n + 1}. satır</span>
                  <Form.Check className="ms-1" type="checkbox" id={`bos-${n}`} label="Bilgi boşsa basma" checked={kosullu}
                    onChange={(e) => degistir(diziGuncelle(sablon, secili, "satirlar", n, e.target.checked ? `?${satir}` : satir.replace(/^\?/, "")))} />
                  <SiraDugmeleri onYukari={() => degistir(diziTasi(sablon, secili, "satirlar", n, -1).sablon)} onAsagi={() => degistir(diziTasi(sablon, secili, "satirlar", n, 1).sablon)}
                    onSil={() => degistir(diziSil(sablon, secili, "satirlar", n))} />
                </div>
                <DegerSecici deger={satir.replace(/^\?/, "")} secenekler={secenekler}
                  onChange={(v) => degistir(diziGuncelle(sablon, secili, "satirlar", n, `${kosullu ? "?" : ""}${v}`), `${secili}:satir${n}`)} />
              </div>
            );
          })}
          <Button size="sm" variant="outline-primary" className="w-100" onClick={() => degistir(diziEkle(sablon, secili, "satirlar", "Yeni satır").sablon)}><IconPlus size={14} /> Satır ekle</Button>
        </>
      )}

      {tabloGibi && (
        <>
          {o.tip === "liste" && <div className="text-muted mb-1" style={kucuk}>Bu bölüm her kayıt (ürün / döviz satırı) için tekrar basılır.</div>}
          {(o.satirlar || []).map((r: any, n: number) => {
            const s = satirNesnesi(r);
            return (
              <div key={`${secili}-${n}-${(o.satirlar || []).length}`} className="border rounded p-1 mb-1 bg-light">
                <div className="d-flex align-items-center gap-1 mb-1" style={kucuk}>
                  <span className="fw-semibold">{n + 1}. satır</span>
                  <SiraDugmeleri onYukari={() => degistir(diziTasi(sablon, secili, "satirlar", n, -1).sablon)} onAsagi={() => degistir(diziTasi(sablon, secili, "satirlar", n, 1).sablon)}
                    onSil={() => degistir(diziSil(sablon, secili, "satirlar", n))} />
                </div>
                <Form.Control size="sm" className="mb-1" value={s.etiket} placeholder="Sol taraf (ör. KDV %20)" onChange={(e) => degistir(tabloSatirGuncelle(sablon, secili, n, { etiket: e.target.value }), `${secili}:etiket${n}`)} />
                <DegerSecici deger={s.deger} secenekler={secenekler} onChange={(v) => degistir(tabloSatirGuncelle(sablon, secili, n, { deger: v }), `${secili}:deger${n}`)} />
                <div className="d-flex align-items-center gap-2 mt-1" style={kucuk}>
                  <Form.Check type="checkbox" id={`k-${n}`} label="Kalın" checked={!!s.kalin} onChange={(e) => degistir(tabloSatirGuncelle(sablon, secili, n, { kalin: e.target.checked }))} />
                  <Form.Check type="checkbox" id={`kb-${n}`} label="Yalnız bilgi doluysa" checked={!!s.kosul}
                    onChange={(e) => degistir(tabloSatirGuncelle(sablon, secili, n, { kosul: e.target.checked ? (kosulKur({ mod: "dolu", alan: ilkAlan(s.deger) || secenekler[0]?.yol || "" }) || "") : "" }))} />
                </div>
                {s.kosul && (
                  <AlanSecimi value={kosulCoz(s.kosul).mod === "dolu" ? (kosulCoz(s.kosul) as any).alan : ""} secenekler={secenekler} bos="(hangi bilgi?)"
                    onChange={(v) => degistir(tabloSatirGuncelle(sablon, secili, n, { kosul: v ? `{{${v}}}` : "" }))} />
                )}
              </div>
            );
          })}
          <Button size="sm" variant="outline-primary" className="w-100" onClick={() => degistir(tabloSatirEkle(sablon, secili).sablon)}><IconPlus size={14} /> Satır ekle</Button>
        </>
      )}

      {sutunlu && (
        <>
          <div className="text-muted mb-1" style={kucuk}>Her kolon bir sütundur; her kayıt bir satır olarak basılır.</div>
          {o.sutunlar.map((c: any, n: number) => (
            <div key={`${secili}-${n}-${o.sutunlar.length}`} className="border rounded p-1 mb-1 bg-light">
              <div className="d-flex align-items-center gap-1 mb-1" style={kucuk}>
                <span className="fw-semibold">{n + 1}. kolon</span>
                <ButtonGroup size="sm" className="ms-auto">
                  <Button variant="outline-secondary" className="py-0 px-1" title="Sola al" disabled={n === 0} onClick={() => degistir(sutunTasi(sablon, secili, n, -1).sablon)}><IconArrowLeft size={12} /></Button>
                  <Button variant="outline-secondary" className="py-0 px-1" title="Sağa al" disabled={n === o.sutunlar.length - 1} onClick={() => degistir(sutunTasi(sablon, secili, n, 1).sablon)}><IconArrowRight size={12} /></Button>
                  <Button variant="outline-danger" className="py-0 px-1" title="Kolonu sil" disabled={o.sutunlar.length <= 1} onClick={() => degistir(sutunSil(sablon, secili, n))}><IconTrash size={12} /></Button>
                </ButtonGroup>
              </div>
              <Form.Control size="sm" className="mb-1" value={c.baslik ?? ""} placeholder="Kolon başlığı" onChange={(e) => degistir(diziGuncelle(sablon, secili, "sutunlar", n, { ...c, baslik: e.target.value }), `${secili}:baslik${n}`)} />
              <DegerSecici deger={c.deger ?? ""} secenekler={secenekler} onChange={(v) => degistir(diziGuncelle(sablon, secili, "sutunlar", n, { ...c, deger: v }), `${secili}:sdeger${n}`)} />
              <div className="d-flex gap-1 mt-1 align-items-center">
                <InputGroup size="sm" style={{ width: 110 }}>
                  <Form.Control type="number" step={0.5} value={ptMm(c.g)} title="Kolon genişliği"
                    onChange={(e) => { const v = sayiOku(e.target.value); if (v && v > 0) degistir(diziGuncelle(sablon, secili, "sutunlar", n, { ...c, g: mmPt(v) }), `${secili}:sg${n}`); }} />
                  <InputGroup.Text style={kucuk}>mm</InputGroup.Text>
                </InputGroup>
                <HizaDugmeleri hiza={c.hiza || "left"} onChange={(h) => degistir(diziGuncelle(sablon, secili, "sutunlar", n, { ...c, hiza: h }))} />
              </div>
            </div>
          ))}
          <Button size="sm" variant="outline-primary" className="w-100" disabled={o.sutunlar.length >= 20} onClick={() => degistir(sutunEkle(sablon, secili).sablon)}><IconPlus size={14} /> Kolon ekle</Button>
          <Form.Check className="mt-1" style={kucuk} type="checkbox" id="baslikSatiri" label="Üstte kolon başlıkları basılsın" checked={!!o.baslikSatiri}
            onChange={(e) => guncelle({ baslikSatiri: e.target.checked || undefined })} />
        </>
      )}

      {o.tip === "qr" && (
        <>
          <div className="text-muted mb-1" style={kucuk}>Karekodun içine ne yazılsın?</div>
          <DegerSecici deger={o.icerik ?? ""} secenekler={secenekler} ekler={false} onChange={(v) => guncelle({ icerik: v }, "icerik")} />
        </>
      )}

      {(o.tip === "logo" || o.tip === "imza") && (
        <>
          <Form.Select size="sm" value={o.gorsel ?? ""} onChange={async (e) => {
            if (e.target.value !== "#yukle") { guncelle({ gorsel: e.target.value }); return; }
            const ad = await gorselYukle(o.tip === "logo" ? "LOGO" : "IMZA");
            if (ad) guncelle({ gorsel: ad });
          }}>
            {!firmaGorselleri.some((g) => g.ad === o.gorsel) && <option value={o.gorsel ?? ""}>{o.gorsel ? `${o.gorsel} (bulunamadı)` : "(görsel seçin)"}</option>}
            {firmaGorselleri.filter((g) => g.tur === (o.tip === "logo" ? "LOGO" : "IMZA")).map((g) => <option key={g.id} value={g.ad}>{g.ad}</option>)}
            <option value="#yukle">Bilgisayardan yeni görsel yükle…</option>
          </Form.Select>
          <div className="text-muted mt-1" style={kucuk}>PNG / JPG, en çok 1 MB. İmza ve kaşe için arka planı saydam PNG önerilir.</div>
        </>
      )}

      {/* ── Yazı görünümü */}
      {yazili && (
        <>
          <Baslik>Yazı</Baslik>
          {o.tip !== "filigran" && (
            <Form.Select size="sm" className="mb-1" value={o.font ?? ""} onChange={(e) => guncelle({ font: e.target.value || undefined })}
              style={{ fontFamily: o.font ? YAZI_TIPLERI[o.font]?.css : undefined }}>
              <option value="">Belgenin yazı tipi ({sablon.yaziTipi === "mono" ? "Courier New" : "Arial"})</option>
              {Object.entries(YAZI_TIPLERI).map(([f, y]) => <option key={f} value={f} style={{ fontFamily: y.css }}>{f}</option>)}
            </Form.Select>
          )}
          <div className="d-flex align-items-center gap-1 flex-wrap">
            <InputGroup size="sm" style={{ width: 120 }}>
              <Button variant="outline-secondary" title="Küçült" onClick={() => guncelle({ boyut: Math.max(3, boyut - 0.5) }, "boyut")}><IconMinus size={12} /></Button>
              <Form.Control type="number" step={0.5} value={boyut} title="Yazı boyutu (punto)" className="text-center px-1"
                onChange={(e) => guncelle({ boyut: sayiOku(e.target.value) }, "boyut")} />
              <Button variant="outline-secondary" title="Büyüt" onClick={() => guncelle({ boyut: Math.min(72, boyut + 0.5) }, "boyut")}><IconPlus size={12} /></Button>
            </InputGroup>
            {o.tip !== "filigran" && (
              <ButtonGroup size="sm">
                {o.tip === "metin" || o.tip === "satirlar" ? (
                  <Button variant={o.kalin ? "secondary" : "outline-secondary"} title="Kalın" onClick={() => guncelle({ kalin: o.kalin ? undefined : true })}><IconBold size={14} /></Button>
                ) : (
                  <Button variant={o.kalinDeger ? "secondary" : "outline-secondary"} title="Değerler kalın" onClick={() => guncelle({ kalinDeger: o.kalinDeger ? undefined : true })}><IconBold size={14} /></Button>
                )}
                <Button variant={o.italik ? "secondary" : "outline-secondary"} title="İtalik (eğik)" onClick={() => guncelle({ italik: o.italik ? undefined : true })}><IconItalic size={14} /></Button>
                {o.tip === "metin" && <Button variant={o.altCizgi ? "secondary" : "outline-secondary"} title="Altı çizili" onClick={() => guncelle({ altCizgi: o.altCizgi ? undefined : true })}><IconUnderline size={14} /></Button>}
              </ButtonGroup>
            )}
            {(o.tip === "metin" || o.tip === "satirlar") && <HizaDugmeleri hiza={o.hiza || "left"} onChange={(h) => guncelle({ hiza: h })} />}
            {tabloGibi && <HizaDugmeleri hiza={o.hizaDeger || "right"} onChange={(h) => guncelle({ hizaDeger: h })} />}
          </div>
          {(o.tip === "metin" || o.tip === "filigran") && (
            <InputGroup size="sm" className="mt-1" style={{ width: 160 }}>
              <InputGroup.Text style={kucuk}>Renk</InputGroup.Text>
              <Form.Control type="color" value={o.renk || (o.tip === "filigran" ? "#9a9a9a" : "#000000")} onChange={(e) => guncelle({ renk: e.target.value }, "renk")} />
            </InputGroup>
          )}
          {o.tip === "metin" && <div className="text-muted mt-1" style={kucuk}>Bir kelimeyi kalın yapmak için iki yıldız arasına yazın: **kelime**</div>}
          {(o.tip === "tablo" || o.tip === "liste") && (
            <Form.Check className="mt-1" style={kucuk} type="checkbox" id="cer" label="Hücrelerin çevresi çizgili" checked={(o.cerceve ?? "hucre") === "hucre"} onChange={(e) => guncelle({ cerceve: e.target.checked ? "hucre" : "yok" })} />
          )}
        </>
      )}

      {/* ── Yer ve boyut */}
      {o.tip !== "filigran" && (
        <>
          <Baslik>Yer ve boyut</Baslik>
          {o.tip === "cizgi" ? (
            <div className="d-grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {olcu("x1", "Başlangıç soldan")}{olcu("y1", "Başlangıç üstten")}{olcu("x2", "Bitiş soldan")}{olcu("y2", "Bitiş üstten")}
              {olcu("kalinlik", "Çizgi kalınlığı", "pt")}
              <Form.Check className="mt-4" style={kucuk} type="checkbox" id="kes" label="Kesikli" checked={!!o.kesikli} onChange={(e) => guncelle({ kesikli: e.target.checked || undefined })} />
            </div>
          ) : (
            <div className="d-grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {olcu("x", "Soldan")}{olcu("y", "Üstten")}
              {o.tip === "qr" ? olcu("boyut", "Kenar") : olcu("g", "Genişlik")}
              {["kutu", "resim", "logo", "imza"].includes(o.tip) && olcu("h", "Yükseklik")}
              {["tablo", "liste"].includes(o.tip) && olcu("satirH", "Satır yüksekliği")}
              {tabloGibi && olcu("etiketG", "Sol taraf genişliği")}
              {o.tip === "satirlar" && olcu("aralik", "Satır arası")}
              {o.tip === "kutu" && olcu("kalinlik", "Çerçeve kalınlığı", "pt")}
            </div>
          )}
          {o.tip === "kutu" && (
            <InputGroup size="sm" className="mt-1">
              <InputGroup.Text style={kucuk}>Zemin rengi</InputGroup.Text>
              <Form.Control type="color" value={o.zemin || "#ffffff"} onChange={(e) => guncelle({ zemin: e.target.value }, "zemin")} />
              <Button variant="outline-secondary" onClick={() => guncelle({ zemin: undefined })}>Yok</Button>
            </InputGroup>
          )}
        </>
      )}

      {/* ── Ne zaman görünsün */}
      <Baslik>Ne zaman görünsün?</Baslik>
      <Form.Select size="sm" value={kosulModu} onChange={(e) => {
        const mod = e.target.value as KosulSecimi["mod"];
        setBekleyenKosul(mod);
        const alan = kosul.mod === "dolu" || kosul.mod === "bos" ? kosul.alan : "";
        if (mod === "her") guncelle({ kosul: undefined });
        else if (mod === "ozel") guncelle({ kosul: o.kosul });
        else guncelle({ kosul: kosulKur({ mod, alan }) });
      }}>
        <option value="her">Her zaman</option>
        <option value="dolu">Seçtiğim bilgi doluysa</option>
        <option value="bos">Seçtiğim bilgi boşsa</option>
        {kosul.mod === "ozel" && <option value="ozel">Özel koşul</option>}
      </Form.Select>
      {(kosulModu === "dolu" || kosulModu === "bos") && (
        <div className="mt-1">
          <AlanSecimi value={kosul.mod === "dolu" || kosul.mod === "bos" ? kosul.alan : ""} secenekler={secenekler} bos="(hangi bilgi?)"
            onChange={(v) => guncelle({ kosul: kosulKur({ mod: kosulModu as "dolu" | "bos", alan: v }) })} />
        </div>
      )}
      {kosul.mod === "ozel" && <Form.Control size="sm" className="mt-1" value={o.kosul ?? ""} onChange={(e) => guncelle({ kosul: e.target.value || undefined }, "kosul")} />}
      <Form.Check className="mt-1" style={kucuk} type="checkbox" id="dar" label="Görünmezse alttakiler yukarı kaysın" checked={!!o.daralt} onChange={(e) => guncelle({ daralt: e.target.checked || undefined })} />

      <details className="mt-3">
        <summary className="small text-muted">Uzman ayarları (JSON)</summary>
        <Form.Control as="textarea" rows={10} size="sm" className="mt-1 font-monospace" style={kucuk} value={jsonMetni} onChange={(e) => { setJsonMetni(e.target.value); setJsonHata(null); }} />
        {jsonHata && <div className="text-danger small">{jsonHata}</div>}
        <Button size="sm" className="mt-1" variant="outline-primary" onClick={() => {
          try {
            const yeni = JSON.parse(jsonMetni);
            if (!yeni || typeof yeni !== "object" || Array.isArray(yeni) || typeof yeni.tip !== "string") throw new Error("Öğe { \"tip\": … } biçiminde olmalı.");
            const y = kopya(sablon); (y.ogeler as BelgeOge[])[secili] = yeni; degistirDis(y);
          } catch (err: any) { setJsonHata(err?.message || "JSON okunamadı."); }
        }}>Uygula</Button>
      </details>
    </>
  );
};

/** Değerdeki ilk bilginin yolu (koşul için öneri) */
const ilkAlan = (deger: string) => /\{\{\s*([A-Za-z_][\w.]*)/.exec(deger)?.[1] || "";

const SiraDugmeleri: React.FC<{ onYukari: () => void; onAsagi: () => void; onSil: () => void }> = ({ onYukari, onAsagi, onSil }) => (
  <ButtonGroup size="sm" className="ms-auto">
    <Button variant="outline-secondary" className="py-0 px-1" title="Yukarı al" onClick={onYukari}><IconArrowUp size={12} /></Button>
    <Button variant="outline-secondary" className="py-0 px-1" title="Aşağı al" onClick={onAsagi}><IconArrowDown size={12} /></Button>
    <Button variant="outline-danger" className="py-0 px-1" title="Satırı sil" onClick={onSil}><IconTrash size={12} /></Button>
  </ButtonGroup>
);

const HizaDugmeleri: React.FC<{ hiza: string; onChange: (h: "left" | "center" | "right") => void }> = ({ hiza, onChange }) => (
  <ButtonGroup size="sm">
    <Button variant={hiza === "left" ? "secondary" : "outline-secondary"} title="Sola yasla" onClick={() => onChange("left")}><IconAlignLeft size={14} /></Button>
    <Button variant={hiza === "center" ? "secondary" : "outline-secondary"} title="Ortala" onClick={() => onChange("center")}><IconAlignCenter size={14} /></Button>
    <Button variant={hiza === "right" ? "secondary" : "outline-secondary"} title="Sağa yasla" onClick={() => onChange("right")}><IconAlignRight size={14} /></Button>
  </ButtonGroup>
);

/** Metnin sonuna bilgi ya da hesap ekleme (yazıyı bozmadan) */
const MetneEkle: React.FC<{ secenekler: AlanSecenegi[]; onEkle: (parca: string) => void }> = ({ secenekler, onEkle }) => {
  const [acik, setAcik] = useState(false);
  const [deger, setDeger] = useState("");
  const [anahtar, setAnahtar] = useState(0);
  if (!acik) return <Button size="sm" variant="outline-primary" className="w-100 mt-1" onClick={() => setAcik(true)}><IconPlus size={14} /> Bilgi ya da hesap ekle</Button>;
  return (
    <div className="mt-1">
      <DegerSecici key={anahtar} deger="" bosMod="bilgi" secenekler={secenekler} ekler={false} onChange={setDeger} />
      <div className="d-flex gap-1 mt-1">
        <Button size="sm" variant="primary" disabled={!deger.includes("{{")} onClick={() => { onEkle(deger); setDeger(""); setAnahtar((k) => k + 1); setAcik(false); }}>Yazıya ekle</Button>
        <Button size="sm" variant="outline-secondary" onClick={() => setAcik(false)}>Vazgeç</Button>
      </div>
    </div>
  );
};

/**
 * Mutfak fişi (docs/TICARI_ADISYON_YOL_HARITASI.md, TA30, D5): 80 mm termal, büyük yazı; masa / adisyon no / ekleyen / saat,
 * kalemler miktar × ad (porsiyon), seçimler ve not ayrı satırda. İptal fişi (D6) üstte "İPTAL" bandıyla. Saf: test edilir.
 */
export interface MutfakFisIcerigi {
  tur: number; adisyonId: number; adisyonNo: string; masa: string | null; bolge: string | null; ekleyen: string | null; zaman: string; yer: string; yazici: string;
  /** Adisyon türü (1 masa, 2 paket, 3 gel-al) ve paket / gel-al müşterisi (D8); eski fişlerde yok */
  adisyonTuru?: number; musteri?: string | null;
  kalemler: { kalemId: number; ad: string; miktar: number; birim: string; porsiyon: string | null; secim: string; notu: string | null }[];
}

const kacir = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tartili = (birim: string) => /^(kg|gr|g)$/i.test(String(birim).trim());
export const miktarMetni = (m: number, birim: string) => (tartili(birim) ? `${String(m).replace(".", ",")} ${birim}` : `${m} x`);
/** Fişin başlığı: masa adı; paket / gel-alda tür + müşteri adı (kurye / tezgah kimin olduğunu görsün) */
export const fisBasligi = (i: Pick<MutfakFisIcerigi, "masa" | "adisyonTuru" | "musteri">): string =>
  i.masa ? `MASA ${i.masa}` : `${i.adisyonTuru === 3 ? "GEL-AL" : "PAKET"}${i.musteri ? ` · ${i.musteri}` : ""}`;
const saat = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }); };

export function mutfakFisHtml(i: MutfakFisIcerigi): string {
  const iptal = i.tur === 2;
  const masa = kacir(fisBasligi(i));
  const kalemler = i.kalemler.map((k) => `
    <div class="k">
      <div class="s"><span class="m">${kacir(miktarMetni(k.miktar, k.birim))}</span> ${kacir(k.ad)}${k.porsiyon ? ` <b>(${kacir(k.porsiyon)})</b>` : ""}</div>
      ${k.secim ? `<div class="e">${kacir(k.secim)}</div>` : ""}
      ${k.notu ? `<div class="n">NOT: ${kacir(k.notu)}</div>` : ""}
    </div>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${kacir(i.yer)} ${masa}</title><style>
    @page { size: 80mm auto; margin: 2mm; }
    body { width: 76mm; margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; }
    .bas { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
    .yer { font-size: 13px; }
    .masa { font-size: 26px; font-weight: 800; letter-spacing: 1px; }
    .bilgi { font-size: 12px; display: flex; justify-content: space-between; }
    .iptal { background: #000; color: #fff; text-align: center; font-size: 22px; font-weight: 800; padding: 2px 0; margin-bottom: 4px; }
    .k { border-bottom: 1px dotted #000; padding: 3px 0; }
    .s { font-size: 18px; font-weight: 700; }
    .m { font-size: 20px; }
    .e { font-size: 14px; padding-left: 8px; }
    .n { font-size: 15px; font-weight: 700; padding-left: 8px; text-decoration: underline; }
    .alt { font-size: 11px; text-align: center; margin-top: 4px; }
  </style></head><body>
    ${iptal ? `<div class="iptal">*** İPTAL ***</div>` : ""}
    <div class="bas"><div class="yer">${kacir(i.yer)}</div><div class="masa">${masa}</div>
      <div class="bilgi"><span>${kacir(i.bolge || "")}</span><span>${saat(i.zaman)}</span></div>
      <div class="bilgi"><span>${kacir(i.adisyonNo)}</span><span>${kacir(i.ekleyen || "")}</span></div></div>
    ${kalemler}
    <div class="alt">${i.kalemler.length} kalem</div>
  </body></html>`;
}

/** Fiş için düz metin (ajan HTML basamazsa / önizleme) */
export function mutfakFisMetni(i: MutfakFisIcerigi): string {
  const satirlar = [i.tur === 2 ? "*** IPTAL ***" : "", i.yer, fisBasligi(i), `${i.adisyonNo}  ${saat(i.zaman)}`, i.ekleyen || "", "-".repeat(32)];
  for (const k of i.kalemler) {
    satirlar.push(`${miktarMetni(k.miktar, k.birim)} ${k.ad}${k.porsiyon ? ` (${k.porsiyon})` : ""}`);
    if (k.secim) satirlar.push(`  ${k.secim}`);
    if (k.notu) satirlar.push(`  NOT: ${k.notu}`);
  }
  return satirlar.filter((s, idx) => s !== "" || idx > 0).join("\n");
}

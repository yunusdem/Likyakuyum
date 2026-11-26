import type { AdisyonRaporu } from "../../services/adisyonService";
import { RaporBicimi, raporSayfasi, tl, zamanYaz } from "../ticari/ticariRaporCikti";

/**
 * Adisyon gün sonu çıktısı (docs/TICARI_ADISYON_YOL_HARITASI.md, TA40, D10): 80 mm rulo ya da A4. Saf (test edilir); yazdırma
 * Ticari raporları gibi tarayıcının yazdırma penceresiyle. Servis ücreti İş K. 51'e göre çalışanlara eşit dağıtılır: pay = toplam / çalışan.
 */
const kacis = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
const miktar = (n: number) => Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 4 });
const satir = (ad: string, deger: string, kalin = false) => `<tr${kalin ? ' class="kalin"' : ""}><td>${kacis(ad)}</td><td class="sag">${kacis(deger)}</td></tr>`;

/** Servis ücretinin çalışan başına eşit payı (kuruş artığı ilk çalışana; toplam korunur) */
export function servisPaylari(toplam: number, calisan: number): number[] {
  const n = Math.max(0, Math.floor(Number(calisan) || 0));
  if (!n || !(toplam > 0)) return [];
  const kurus = Math.round(toplam * 100);
  const taban = Math.floor(kurus / n);
  return Array.from({ length: n }, (_, i) => (taban + (i < kurus - taban * n ? 1 : 0)) / 100);
}

export function adisyonRaporHtml(r: AdisyonRaporu, firmaAdi: string, bicim: RaporBicimi = "80", calisan?: number | null): string {
  const o = r.ozet;
  const dar = bicim === "80";
  const donem = r.donem.baslangic === r.donem.bitis ? zamanYaz(r.donem.baslangic) : `${zamanYaz(r.donem.baslangic)} – ${zamanYaz(r.donem.bitis)}`;
  const p: string[] = [];
  p.push(`<h1>Adisyon Gün Sonu</h1><div class="orta">${kacis(firmaAdi)}</div><div class="orta">${kacis(donem)}</div>`);
  if (r.acik.sayi) p.push(`<div class="orta" style="margin-top:4px;font-weight:bold;border:1px solid #000;padding:2px">Açık adisyon: ${r.acik.sayi} (${tl(r.acik.tutar)} TL)</div>`);
  p.push(`<h2>Özet</h2><table>${[
    satir("Adisyon", String(o.adisyon)), satir("Fiş", String(o.fis)), satir("Ürün satışı", tl(o.urunSatis)),
    ...(o.servis ? [satir("Servis ücreti", tl(o.servis))] : []), ...(Math.abs(o.yuvarlama) > 0.004 ? [satir("Yuvarlama", tl(o.yuvarlama))] : []),
    satir("Ciro", tl(o.ciro), true), satir("Ortalama adisyon", tl(o.ortalama)),
    ...(o.kisi ? [satir(`Kişi (${o.kisi}) başı`, tl(o.kisiBasi))] : []), ...(o.ortalamaSure !== null ? [satir("Ortalama masa süresi", `${o.ortalamaSure} dk`)] : []),
    satir("İkram (değer)", tl(o.ikramDegeri)), satir("İptal (değer)", tl(o.iptalDegeri)), satir("İptal edilen adisyon", String(o.iptalAdisyon)),
  ].join("")}</table>`);
  if (r.odemeler.length) p.push(`<h2>Ödeme türleri</h2><table>${r.odemeler.map((x) => satir(x.ad, tl(x.tutar))).join("")}${satir("Toplam", tl(r.odemeler.reduce((t, x) => t + x.tutar, 0)), true)}</table>`);
  if (r.turler.length > 1) p.push(`<h2>Satış türü</h2><table>${r.turler.map((x) => satir(`${x.ad} (${x.adisyon})`, tl(x.ciro))).join("")}</table>`);
  if (r.garsonlar.length) {
    p.push(dar
      ? `<h2>Garsonlar</h2><table>${r.garsonlar.map((x) => satir(`${x.ad} (${x.adisyon})`, tl(x.ciro))).join("")}</table>`
      : `<h2>Garsonlar</h2><table><tr><th>Garson</th><th class="sag">Adisyon</th><th class="sag">Ciro</th><th class="sag">Servis</th><th class="sag">İkram</th><th class="sag">İptal</th></tr>
        ${r.garsonlar.map((x) => `<tr><td>${kacis(x.ad)}</td><td class="sag">${x.adisyon}</td><td class="sag">${tl(x.ciro)}</td><td class="sag">${tl(x.servis)}</td><td class="sag">${x.ikram}</td><td class="sag">${x.iptal}</td></tr>`).join("")}</table>`);
  }
  if (r.servisDagitimi.toplam > 0) {
    const n = calisan ?? r.servisDagitimi.etkinGarson;
    const paylar = servisPaylari(r.servisDagitimi.toplam, n);
    p.push(`<h2>Servis ücreti dağıtımı</h2><table>${satir("Toplanan", tl(r.servisDagitimi.toplam))}${satir("Çalışan", String(n || 0))}${paylar.length ? satir("Kişi başı pay", tl(paylar[0]), true) : ""}</table>`);
  }
  if (r.urunler.length) {
    const liste = dar ? r.urunler.slice(0, 40) : r.urunler;
    p.push(`<h2>Ürünler</h2><table class="ince"><tr><th>Ürün</th><th class="sag">Miktar</th><th class="sag">Tutar</th>${dar ? "" : '<th class="sag">İkram</th>'}</tr>
      ${liste.map((u) => `<tr><td>${kacis(u.ad)}</td><td class="sag">${miktar(u.miktar)}</td><td class="sag">${tl(u.tutar)}</td>${dar ? "" : `<td class="sag">${u.ikramMiktar ? `${miktar(u.ikramMiktar)} (${tl(u.ikramDeger)})` : ""}</td>`}</tr>`).join("")}</table>`);
  }
  if (r.ikramIptal.nedenler.length) {
    p.push(`<h2>İkram / iptal</h2><table>${r.ikramIptal.nedenler.map((x) => satir(`${x.tur === "ikram" ? "İkram" : "İptal"}: ${x.neden} (${x.adet})`, tl(x.deger))).join("")}</table>`);
    if (!dar) p.push(`<table class="ince"><tr><th>Zaman</th><th>Yer</th><th>Ürün</th><th>Neden</th><th>Yapan</th><th class="sag">Değer</th></tr>
      ${r.ikramIptal.satirlar.map((x) => `<tr><td>${kacis(zamanYaz(x.zaman))}</td><td>${kacis(x.yer)}</td><td>${x.tur === "ikram" ? "İkram" : "İptal"} · ${kacis(miktar(x.miktar))} ${kacis(x.ad)}</td><td>${kacis(x.neden)}</td><td>${kacis(x.yapan || "")}</td><td class="sag">${tl(x.deger)}</td></tr>`).join("")}</table>`);
  }
  if (r.acik.liste.length) p.push(`<h2>Açık adisyonlar</h2><table>${r.acik.liste.map((x) => satir(`${x.yer}${x.garson ? ` · ${x.garson}` : ""}`, tl(x.tutar))).join("")}</table>`);
  return raporSayfasi("Adisyon Gün Sonu", p.join(""), bicim);
}

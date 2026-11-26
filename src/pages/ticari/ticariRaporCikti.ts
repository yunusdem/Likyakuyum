import type { GunSonuRaporu, KarRaporu, SktRaporu, VardiyaOzeti } from "../../services/ticariService";

/**
 * Ticari kasa raporlarının yazdırma çıktısı (docs/TICARI_ADISYON_YOL_HARITASI.md, TA7 / TA8): 80 mm rulo ya da A4.
 * HTML üretimi saf fonksiyondur (test edilir); yazdırma tarayıcının yazdırma penceresiyle (printReport.ts gibi).
 */
export type RaporBicimi = "80" | "A4";

const kacis = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
export const tl = (n: number | null | undefined) => (n === null || n === undefined ? "" : Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
/** "YYYY-AA-GG SS:DD" → "GG.AA.YYYY SS:DD" */
export const zamanYaz = (z: string | null | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(String(z || ""));
  return m ? `${m[3]}.${m[2]}.${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ""}` : "";
};
export const farkYazisi = (fark: number | null, durum: string | null) =>
  durum === "TAMAM" ? "Tamam" : durum === "FAZLA" ? `${tl(fark)} fazla` : durum === "EKSIK" ? `${tl(Math.abs(Number(fark)))} eksik` : "";

/** Sayfa iskeleti: 80 mm'de tek sütun ve küçük yazı, A4'te ortalı 180 mm */
export function raporSayfasi(baslik: string, govde: string, bicim: RaporBicimi): string {
  const dar = bicim === "80";
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><title>${kacis(baslik)}</title><style>
    @page { size: ${dar ? "80mm auto" : "A4"}; margin: ${dar ? "3mm" : "12mm"}; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: ${dar ? "11px" : "12px"}; color: #000; margin: 0; ${dar ? "width: 74mm;" : "max-width: 180mm; margin: 0 auto;"} }
    h1 { font-size: ${dar ? "13px" : "16px"}; text-align: center; margin: 0 0 2px; }
    h2 { font-size: ${dar ? "11px" : "13px"}; margin: 8px 0 3px; border-bottom: 1px solid #000; padding-bottom: 1px; }
    .orta { text-align: center; }
    table { width: 100%; border-collapse: collapse; }
    td, th { padding: 1px 2px; vertical-align: top; }
    th { text-align: left; border-bottom: 1px dashed #000; font-weight: bold; }
    .sag { text-align: right; white-space: nowrap; }
    .kalin td { font-weight: bold; border-top: 1px solid #000; }
    .ince { font-size: ${dar ? "10px" : "11px"}; }
  </style></head><body>${govde}</body></html>`;
}

const satir = (ad: string, deger: string, kalin = false) => `<tr${kalin ? ' class="kalin"' : ""}><td>${kacis(ad)}</td><td class="sag">${kacis(deger)}</td></tr>`;

/** Kasiyer vardiya raporu (TA8) */
export function vardiyaRaporHtml(o: VardiyaOzeti, firmaAdi: string, bicim: RaporBicimi = "80"): string {
  const n = o.nakit;
  const vezne = [o.vezne.kod, o.vezne.ad].filter(Boolean).join(" - ");
  const parcalar: string[] = [];
  if (firmaAdi) parcalar.push(`<div class="orta ince">${kacis(firmaAdi)}</div>`);
  parcalar.push(`<h1>VARDİYA RAPORU</h1>`);
  parcalar.push(`<table class="ince">
    ${satir("Vardiya", o.vardiyaId ? `#${o.vardiyaId}` : "")}
    ${satir("Vezne", vezne)}
    ${satir("Açılış", `${zamanYaz(o.acilis.zaman)} ${o.acilis.kullanici}`.trim())}
    ${o.kapanis ? satir("Kapanış", `${zamanYaz(o.kapanis.zaman)} ${o.kapanis.kullanici}`.trim()) : satir("Durum", "Açık (anlık)")}
  </table>`);
  parcalar.push(`<h2>Nakit (TL)</h2><table>
    ${satir("Devir", tl(n.devir))}
    ${satir("+ Nakit satış", tl(n.nakitSatis))}
    ${satir("− Nakit iade", tl(n.nakitIade))}
    ${satir("+ Diğer nakit giriş", tl(n.digerGiris))}
    ${satir("− Diğer nakit çıkış", tl(n.digerCikis))}
    ${satir("Beklenen", tl(n.beklenen), true)}
    ${n.sayilan !== null ? satir("Sayılan", tl(n.sayilan)) + satir("Fark", farkYazisi(n.fark, n.durum), true) : ""}
  </table>`);
  if (o.kupur && Object.keys(o.kupur).length) {
    const k = Object.entries(o.kupur).sort((a, b) => Number(b[0]) - Number(a[0]));
    parcalar.push(`<h2>Sayım</h2><table class="ince">${k.map(([d, a]) => satir(`${tl(Number(d))} × ${a}`, tl(Math.round(Number(d) * 100) * a / 100))).join("")}</table>`);
  }
  parcalar.push(`<h2>Fişler</h2><table>
    ${satir(`Satış (${o.fisler.satisAdet} fiş)`, tl(o.fisler.satisToplam))}
    ${satir(`İade (${o.fisler.iadeAdet} fiş)`, tl(o.fisler.iadeToplam))}
    ${satir("Net", tl(o.fisler.satisToplam - o.fisler.iadeToplam), true)}
  </table>`);
  if (o.odemeler.length) {
    parcalar.push(`<h2>Ödeme türleri (TL karşılığı)</h2><table><tr><th>Tür</th><th class="sag">Satış</th><th class="sag">İade</th><th class="sag">Net</th></tr>
      ${o.odemeler.map((x) => `<tr><td>${kacis(x.tur)}${x.paraKodu && x.paraKodu !== "TL" ? ` (${kacis(x.paraKodu)})` : ""}</td><td class="sag">${tl(x.satis)}</td><td class="sag">${tl(x.iade)}</td><td class="sag">${tl(x.net)}</td></tr>`).join("")}
    </table>`);
  }
  if (o.digerHareketler.length) {
    parcalar.push(`<h2>Diğer nakit hareketleri</h2><table class="ince"><tr><th>Saat / tür</th><th class="sag">Giriş</th><th class="sag">Çıkış</th></tr>
      ${o.digerHareketler.map((h) => `<tr><td>${kacis(zamanYaz(h.zaman).slice(-5))} ${kacis(h.tur)}${h.aciklama ? `<br>${kacis(h.aciklama)}` : ""}</td><td class="sag">${h.giris ? tl(h.giris) : ""}</td><td class="sag">${h.cikis ? tl(h.cikis) : ""}</td></tr>`).join("")}
    </table>`);
  }
  if (o.digerParalar.length) {
    parcalar.push(`<h2>Diğer para birimleri (adet / miktar)</h2><table class="ince"><tr><th>Para</th><th class="sag">Giriş</th><th class="sag">Çıkış</th></tr>
      ${o.digerParalar.map((p) => `<tr><td>${kacis(p.paraKodu)}</td><td class="sag">${tl(p.giris)}</td><td class="sag">${tl(p.cikis)}</td></tr>`).join("")}
    </table>`);
  }
  const notlar = [o.acilis.not && `Açılış notu: ${o.acilis.not}`, o.kapanis?.not && `Kapanış notu: ${o.kapanis.not}`].filter(Boolean);
  if (notlar.length) parcalar.push(`<div class="ince" style="margin-top:6px">${notlar.map(kacis).join("<br>")}</div>`);
  if (o.kapanis) parcalar.push(`<table style="margin-top:18px" class="ince"><tr><td>Teslim eden</td><td class="sag">Teslim alan</td></tr></table>`);
  return raporSayfasi(`Vardiya raporu ${o.vardiyaId ?? ""}`.trim(), parcalar.join("\n"), bicim);
}

const miktarYaz = (n: number) => Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 4 });

/** Gün sonu satış raporu (TA7): 80 mm'de özet + ödeme + KDV + grup + ürün; A4'te ayrıca kasiyer ve saat dağılımı */
export function gunSonuHtml(r: GunSonuRaporu, firmaAdi: string, bicim: RaporBicimi = "80"): string {
  const dar = bicim === "80";
  const gun = r.suzgec.baslangic === r.suzgec.bitis ? zamanYaz(r.suzgec.baslangic) : `${zamanYaz(r.suzgec.baslangic)} – ${zamanYaz(r.suzgec.bitis)}`;
  const p: string[] = [];
  if (firmaAdi) p.push(`<div class="orta ince">${kacis(firmaAdi)}</div>`);
  p.push(`<h1>GÜN SONU SATIŞ RAPORU</h1><div class="orta ince">${kacis(gun)}</div>`);
  const suz = [r.suzgec.kasiyer && `Kasiyer: ${r.suzgec.kasiyer}`, r.suzgec.vezne && `Vezne: ${r.suzgec.vezne}`].filter(Boolean);
  if (suz.length) p.push(`<div class="orta ince">${suz.map(kacis).join(" · ")}</div>`);
  p.push(`<h2>Satış</h2><table>
    ${satir(`Fiş adedi`, String(r.satis.adet))}
    ${satir("Brüt (iskontosuz)", tl(r.satis.brut))}
    ${satir("− İskonto", tl(r.satis.iskonto))}
    ${r.satis.fisIskontosu ? satir("  (fiş iskontosu)", tl(r.satis.fisIskontosu)) : ""}
    ${satir("Net satış", tl(r.satis.net), true)}
  </table>`);
  p.push(`<h2>İade</h2><table>${satir("İade fişi", String(r.iade.adet))}${satir("İade tutarı", tl(r.iade.net), true)}</table>`);
  p.push(`<h2>Net</h2><table>${satir("Matrah", tl(r.net.matrah))}${satir("KDV", tl(r.net.kdv))}${satir("Net (satış − iade)", tl(r.net.net), true)}</table>`);
  if (r.kdvOranlari.length) {
    p.push(`<h2>KDV oranları</h2><table><tr><th>Oran</th><th class="sag">Matrah</th><th class="sag">KDV</th><th class="sag">Toplam</th></tr>
      ${r.kdvOranlari.map((k) => `<tr><td>%${kacis(k.oran)}</td><td class="sag">${tl(k.matrah)}</td><td class="sag">${tl(k.kdv)}</td><td class="sag">${tl(k.toplam)}</td></tr>`).join("")}</table>`);
  }
  if (r.odemeler.length || r.odemesiz) {
    p.push(`<h2>Ödeme türleri (TL karşılığı)</h2><table><tr><th>Tür</th><th class="sag">Satış</th><th class="sag">İade</th><th class="sag">Net</th></tr>
      ${r.odemeler.map((o) => `<tr><td>${kacis(o.tur)}${o.paraKodu !== "TL" ? ` (${kacis(o.paraKodu)} ${miktarYaz(o.dovizMiktar || 0)})` : ""}</td><td class="sag">${tl(o.satis)}</td><td class="sag">${tl(o.iade)}</td><td class="sag">${tl(o.net)}</td></tr>`).join("")}
      ${r.odemesiz ? `<tr><td>Ödemesiz kalan</td><td></td><td></td><td class="sag">${tl(r.odemesiz)}</td></tr>` : ""}</table>`);
  }
  if (r.gruplar.length) {
    p.push(`<h2>Gruplar</h2><table><tr><th>Grup</th>${dar ? "" : '<th class="sag">Kalem</th><th class="sag">Satış</th><th class="sag">İade</th>'}<th class="sag">Net</th></tr>
      ${r.gruplar.map((g) => `<tr><td>${kacis(g.grup)}</td>${dar ? "" : `<td class="sag">${g.kalem}</td><td class="sag">${tl(g.satis)}</td><td class="sag">${tl(g.iade)}</td>`}<td class="sag">${tl(g.net)}</td></tr>`).join("")}</table>`);
  }
  if (r.urunler.length) {
    p.push(`<h2>Ürünler</h2><table class="ince"><tr><th>Ürün</th><th class="sag">Miktar</th>${dar ? "" : '<th class="sag">Satış</th><th class="sag">İade</th>'}<th class="sag">Net</th></tr>
      ${r.urunler.map((u) => `<tr><td>${kacis(u.ad)}${dar ? "" : u.kod ? ` <span class="ince">(${kacis(u.kod)})</span>` : ""}</td><td class="sag">${miktarYaz(u.netMiktar)} ${kacis(u.birim)}</td>${dar ? "" : `<td class="sag">${tl(u.satis)}</td><td class="sag">${tl(u.iade)}</td>`}<td class="sag">${tl(u.net)}</td></tr>`).join("")}</table>`);
  }
  if (!dar && r.kasiyerler.length) {
    p.push(`<h2>Kasiyerler</h2><table><tr><th>Kasiyer</th><th class="sag">Satış fişi</th><th class="sag">İade fişi</th><th class="sag">Net</th></tr>
      ${r.kasiyerler.map((k) => `<tr><td>${kacis(k.ad)}</td><td class="sag">${k.satisAdet}</td><td class="sag">${k.iadeAdet}</td><td class="sag">${tl(k.net)}</td></tr>`).join("")}</table>`);
  }
  if (!dar && r.saatler.length) {
    p.push(`<h2>Saatlere göre</h2><table><tr><th>Saat</th><th class="sag">Satış fişi</th><th class="sag">Net</th></tr>
      ${r.saatler.map((s) => `<tr><td>${String(s.saat).padStart(2, "0")}:00–${String(s.saat).padStart(2, "0")}:59</td><td class="sag">${s.adet}</td><td class="sag">${tl(s.net)}</td></tr>`).join("")}</table>`);
  }
  return raporSayfasi(`Gün sonu ${gun}`, p.join("\n"), bicim);
}

/** HTML'i yeni pencerede açıp tarayıcının yazdırma penceresini getirir; açılır pencere engelliyse false */
/** Ortalama maliyet + kâr raporu (TA15), A4 */
export function karRaporuHtml(r: KarRaporu, firmaAdi: string, suzgecAdi = ""): string {
  const gun = r.suzgec.baslangic === r.suzgec.bitis ? zamanYaz(r.suzgec.baslangic) : `${zamanYaz(r.suzgec.baslangic)} – ${zamanYaz(r.suzgec.bitis)}`;
  const yuzde = (n: number | null) => (n === null ? "" : `%${n.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const t = r.toplam;
  const p: string[] = [];
  if (firmaAdi) p.push(`<div class="orta ince">${kacis(firmaAdi)}</div>`);
  p.push(`<h1>KÂR RAPORU</h1><div class="orta ince">${kacis(gun)}${suzgecAdi ? ` · ${kacis(suzgecAdi)}` : ""}</div>`);
  p.push(`<h2>Özet</h2><table>
    ${satir("Gelir (KDV hariç)", tl(t.gelir))}
    ${satir("Satılan malın maliyeti", tl(t.maliyet))}
    ${satir("Brüt kâr", `${tl(t.brutKar)} ${yuzde(t.karYuzde)}`, true)}
    ${satir("Fire maliyeti", tl(t.fireMaliyet))}
    ${satir("Sayım farkı", tl(t.sayimFarkMaliyet))}
    ${satir("Net kâr", tl(t.netKar), true)}
  </table>`);
  if (r.gruplar.length) {
    p.push(`<h2>Gruplar</h2><table><tr><th>Grup</th><th class="sag">Gelir</th><th class="sag">Maliyet</th><th class="sag">Kâr</th><th class="sag">Fire</th></tr>
      ${r.gruplar.map((g) => `<tr><td>${kacis(g.grup)}</td><td class="sag">${tl(g.gelir)}</td><td class="sag">${tl(g.maliyet)}</td><td class="sag">${tl(g.kar)}</td><td class="sag">${tl(g.fireMaliyet)}</td></tr>`).join("")}</table>`);
  }
  if (r.urunler.length) {
    p.push(`<h2>Ürünler</h2><table class="ince"><tr><th>Ürün</th><th class="sag">Net miktar</th><th class="sag">Gelir</th><th class="sag">Maliyet</th><th class="sag">Kâr</th><th class="sag">Kâr %</th><th class="sag">Ort. maliyet</th><th class="sag">Fire</th></tr>
      ${r.urunler.map((u) => `<tr><td>${kacis(u.ad)}${u.kod ? ` <span class="ince">(${kacis(u.kod)})</span>` : ""}</td><td class="sag">${miktarYaz(u.netMiktar)} ${kacis(u.birim)}</td><td class="sag">${tl(u.gelir)}</td><td class="sag">${tl(u.maliyet)}</td><td class="sag">${tl(u.kar)}</td><td class="sag">${yuzde(u.karYuzde)}</td><td class="sag">${tl(u.ortMaliyet)}</td><td class="sag">${u.fireMaliyet ? tl(u.fireMaliyet) : ""}</td></tr>`).join("")}
      <tr class="kalin"><td>Toplam</td><td></td><td class="sag">${tl(t.gelir)}</td><td class="sag">${tl(t.maliyet)}</td><td class="sag">${tl(t.brutKar)}</td><td class="sag">${yuzde(t.karYuzde)}</td><td></td><td class="sag">${tl(t.fireMaliyet)}</td></tr></table>`);
  }
  if (r.gunler.length > 1) {
    p.push(`<h2>Günler</h2><table><tr><th>Gün</th><th class="sag">Gelir</th><th class="sag">Maliyet</th><th class="sag">Kâr</th></tr>
      ${r.gunler.map((g) => `<tr><td>${kacis(zamanYaz(g.gun))}</td><td class="sag">${tl(g.gelir)}</td><td class="sag">${tl(g.maliyet)}</td><td class="sag">${tl(g.kar)}</td></tr>`).join("")}</table>`);
  }
  return raporSayfasi("Kâr Raporu", p.join(""), "A4");
}

/** SKT yaklaşanlar (TA16), A4 */
export function sktRaporuHtml(r: SktRaporu, firmaAdi: string, suzgecAdi = ""): string {
  const kalan = (g: number) => (g < 0 ? `${-g} gün geçti` : g === 0 ? "bugün" : `${g} gün`);
  const p: string[] = [];
  if (firmaAdi) p.push(`<div class="orta ince">${kacis(firmaAdi)}</div>`);
  p.push(`<h1>SKT YAKLAŞANLAR</h1><div class="orta ince">${kacis(zamanYaz(r.bugun))} · ${r.esikGun} gün${suzgecAdi ? ` · ${kacis(suzgecAdi)}` : ""}</div>`);
  p.push(`<h2>Özet</h2><table>
    ${satir(`Süresi geçmiş (${r.ozet.gecti.parti} parti)`, tl(r.ozet.gecti.deger))}
    ${satir(`Bugün doluyor (${r.ozet.bugun.parti} parti)`, tl(r.ozet.bugun.deger))}
    ${satir(`${r.esikGun} gün içinde (${r.ozet.yaklasiyor.parti} parti)`, tl(r.ozet.yaklasiyor.deger))}
  </table>`);
  if (r.satirlar.length) {
    p.push(`<h2>Partiler</h2><table class="ince"><tr><th>SKT</th><th>Kalan</th><th>Ürün</th><th>Parti</th><th>Giriş fişi</th><th class="sag">Partide kalan</th><th class="sag">Değer</th></tr>
      ${r.satirlar.map((x) => `<tr><td>${kacis(zamanYaz(x.skt))}</td><td>${kacis(kalan(x.kalanGun))}</td><td>${kacis(x.ad)}${x.kod ? ` <span class="ince">(${kacis(x.kod)})</span>` : ""}</td><td>${kacis(x.partiNo || "")}</td><td>${kacis(x.fisNo)}</td><td class="sag">${miktarYaz(x.kalan)} ${kacis(x.birim)}</td><td class="sag">${tl(x.deger)}</td></tr>`).join("")}</table>`);
  }
  return raporSayfasi("SKT Yaklaşanlar", p.join(""), "A4");
}

export function htmlYazdir(html: string): boolean {
  const w = window.open("", "_blank", "width=480,height=760");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch { /* kullanıcı pencereyi kapattı */ } }, 250);
  return true;
}

/**
 * Pano Entegrasyonu çıktı biçimleri (docs/PANO_API_YOL_HARITASI.md, P4/P5/P12). Saf dönüştürücüler: veritabanı yok.
 * JSON / XML / TXT aynı satır modelinden üretilir; HTML pano sayfası sunucuda üretilir ve kendini JSON ile yeniler.
 */

export interface PanoApiSatiri {
  kod: string;
  ad: string;
  alis: number | null;
  satis: number | null;
  alisYazi: string;
  satisYazi: string;
}

export interface PanoApiVerisi {
  firma: string;
  pano: string;
  guncelleme: string;
  satirlar: PanoApiSatiri[];
}

/** Pano tanımının görünüm bilgileri (yalnız HTML sayfası kullanır) */
export interface PanoGorunumu {
  paraBasligi: string;
  alisKuruBasligi: string;
  satisKuruBasligi: string;
  firmaAdiOzellikleri: string;
  tarihSaatOzellikleri: string;
  baslikOzellikleri: string;
  satirOzellikleri: string;
  zeminRengi: string;
  kodAlaniGenisligi: number;
  kurAlaniGenisligi: number;
}

export type PanoBicimi = "json" | "xml" | "txt";

export const ICERIK_TIPLERI: Record<PanoBicimi | "html", string> = {
  json: "application/json; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  html: "text/html; charset=utf-8",
};

/** Fiyat sayısı: 4 basamağa yuvarlanır (JSON/XML sayı alanı) */
export const fiyatSayisi = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000) / 10000;
};

/** Sayıdaki ondalık basamak sayısı (2–4 arasına sıkıştırılır) */
const ondalikSayisi = (n: number): number => {
  const s = String(n);
  const i = s.indexOf(".");
  const d = i < 0 ? 0 : s.length - i - 1;
  return Math.min(4, Math.max(2, d));
};

/** Türkçe biçim: binlik nokta, ondalık virgül — 6581.27 → "6.581,27"; null → "" */
export const fiyatYazisi = (v: number | null): string => {
  if (v === null) return "";
  const basamak = ondalikSayisi(v);
  const sabit = v.toFixed(basamak);
  const [tam, kesir] = sabit.split(".");
  const isaret = tam.startsWith("-") ? "-" : "";
  const rakamlar = isaret ? tam.slice(1) : tam;
  const binlik = rakamlar.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${isaret}${binlik}${kesir ? "," + kesir : ""}`;
};

export const satirKur = (kod: string, ad: string, alis: unknown, satis: unknown): PanoApiSatiri => {
  const a = fiyatSayisi(alis);
  const s = fiyatSayisi(satis);
  return { kod: (kod || "").trim(), ad: (ad || "").trim(), alis: a, satis: s, alisYazi: fiyatYazisi(a), satisYazi: fiyatYazisi(s) };
};

/** Sunucu saati, +03:00 ile ISO (2026-10-21T14:05:12+03:00) */
export const guncellemeZamani = (d = new Date()): string => {
  const tr = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return tr.toISOString().slice(0, 19) + "+03:00";
};

export const json = (v: PanoApiVerisi): string => JSON.stringify(v);

const xmlKacis = (s: string): string =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const xml = (v: PanoApiVerisi): string => {
  const sayi = (n: number | null) => (n === null ? "" : String(n));
  const satirlar = v.satirlar
    .map(
      (s) =>
        `  <satir kod="${xmlKacis(s.kod)}" ad="${xmlKacis(s.ad)}" alis="${sayi(s.alis)}" satis="${sayi(s.satis)}" alisYazi="${xmlKacis(s.alisYazi)}" satisYazi="${xmlKacis(s.satisYazi)}"/>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>\n<pano firma="${xmlKacis(v.firma)}" no="${xmlKacis(v.pano)}" guncelleme="${v.guncelleme}">\n${satirlar}\n</pano>\n`;
};

/** Satır başına KOD;AD;ALIS;SATIS — noktalı virgül alanlardan çıkarılır (P12) */
export const txt = (v: PanoApiVerisi): string => {
  const temiz = (s: string) => s.replace(/[;\r\n]+/g, " ").trim();
  return v.satirlar.map((s) => `${temiz(s.kod)};${temiz(s.ad)};${s.alisYazi};${s.satisYazi}`).join("\r\n") + "\r\n";
};

/** Hata gövdesi: JSON nesne, XML/TXT tek satır */
export const hataGovdesi = (bicim: PanoBicimi, kod: string, mesaj: string): string => {
  if (bicim === "json") return JSON.stringify({ hata: kod, mesaj });
  if (bicim === "xml") return `<?xml version="1.0" encoding="utf-8"?>\n<hata kod="${xmlKacis(kod)}">${xmlKacis(mesaj)}</hata>\n`;
  return `HATA;${kod}\r\n`;
};

// ---------------------------------------------------------------------------------------------- HTML ---

interface YaziOzelligi {
  font: string;
  size: number;
  bold: boolean;
  color: string;
  bgColor: string;
}

/** "font:Inter, sans-serif;size:18;bold:1;color:#ffffff;bgColor:transparent" → nesne. Eksik alanlarda varsayılan. */
export const ozellikCoz = (metin: string | null | undefined, varsayilan: Partial<YaziOzelligi> = {}): YaziOzelligi => {
  const o: YaziOzelligi = { font: "Arial, sans-serif", size: 18, bold: true, color: "#ffffff", bgColor: "transparent", ...varsayilan };
  for (const parca of String(metin || "").split(";")) {
    const i = parca.indexOf(":");
    if (i < 0) continue;
    const ad = parca.slice(0, i).trim();
    const deger = parca.slice(i + 1).trim();
    if (!deger) continue;
    if (ad === "font") o.font = deger;
    else if (ad === "size") o.size = Math.min(200, Math.max(6, Number(deger) || o.size));
    else if (ad === "bold") o.bold = deger === "1" || deger.toLowerCase() === "true";
    else if (ad === "color") o.color = deger;
    else if (ad === "bgColor") o.bgColor = deger;
  }
  return o;
};

const htmlKacis = (s: string): string =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** CSS değerine yalnız güvenli karakterler (renk / yazı tipi adı); betik enjeksiyonu olmasın */
const cssDeger = (s: string, varsayilan: string): string => (/^[#a-zA-Z0-9 ,.()%'-]{1,80}$/.test(s) ? s : varsayilan);

const stil = (o: YaziOzelligi): string =>
  `font-family:${cssDeger(o.font, "Arial, sans-serif")};font-size:${o.size}px;font-weight:${o.bold ? 700 : 400};color:${cssDeger(o.color, "#ffffff")};background:${cssDeger(o.bgColor, "transparent")}`;

/**
 * Girişsiz HTML pano sayfası: pano tanımındaki renk ve yazı özellikleri; sayfa içindeki küçük betik JSON adresini
 * önbellek süresiyle çekip tabloyu yeniler. Kütüphane yok; eski Android kutular ve TV tarayıcıları için sade DOM.
 */
export const html = (v: PanoApiVerisi, g: PanoGorunumu, jsonAdresi: string, yenilemeSn: number): string => {
  const firma = ozellikCoz(g.firmaAdiOzellikleri, { size: 28 });
  const saat = ozellikCoz(g.tarihSaatOzellikleri, { size: 16, color: "#fbbf24" });
  const baslik = ozellikCoz(g.baslikOzellikleri, { size: 18, color: "#60a5fa" });
  const satir = ozellikCoz(g.satirOzellikleri, { size: 24 });
  const zemin = cssDeger(g.zeminRengi || "#0f172a", "#0f172a");
  const kodGen = Math.min(80, Math.max(20, Number(g.kodAlaniGenisligi) || 50));
  const satirlar = v.satirlar
    .map(
      (s) =>
        `<tr data-kod="${htmlKacis(s.kod)}"><td class="k">${htmlKacis(s.ad || s.kod)}</td><td class="f a">${htmlKacis(s.alisYazi)}</td><td class="f s">${htmlKacis(s.satisYazi)}</td></tr>`
    )
    .join("");
  const sn = Math.max(1, Math.floor(yenilemeSn) || 1);
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Cache-Control" content="no-store">
<title>${htmlKacis(v.firma || "Pano")}</title>
<style>
html,body{margin:0;padding:0;height:100%;background:${zemin};overflow:hidden}
body{display:flex;flex-direction:column;font-family:Arial,sans-serif}
header{display:flex;justify-content:space-between;align-items:center;padding:1.2vh 2vw}
#firma{${stil(firma)}}
#saat{${stil(saat)}}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th{${stil(baslik)};text-align:right;padding:.6vh 2vw;text-transform:uppercase}
th:first-child{text-align:left;width:${kodGen}%}
td{${stil(satir)};padding:.9vh 2vw;border-top:1px solid rgba(255,255,255,.12);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
td.f{text-align:right;font-variant-numeric:tabular-nums}
td.yukari{color:#4ade80}td.asagi{color:#f87171}
#durum{position:fixed;right:1vw;bottom:1vh;font-size:12px;color:rgba(255,255,255,.45)}
</style>
</head>
<body>
<header><div id="firma">${htmlKacis(v.firma)}</div><div id="saat"></div></header>
<table>
<thead><tr><th>${htmlKacis(g.paraBasligi || "DÖVİZ")}</th><th>${htmlKacis(g.alisKuruBasligi || "ALIŞ")}</th><th>${htmlKacis(g.satisKuruBasligi || "SATIŞ")}</th></tr></thead>
<tbody id="satirlar">${satirlar}</tbody>
</table>
<div id="durum"></div>
<script>
(function(){
  var ADRES=${JSON.stringify(jsonAdresi)}, SN=${sn};
  var onceki={};
  function saat(){var d=new Date(),p=function(n){return (n<10?"0":"")+n};document.getElementById("saat").textContent=p(d.getDate())+"."+p(d.getMonth()+1)+"."+d.getFullYear()+" "+p(d.getHours())+":"+p(d.getMinutes())+":"+p(d.getSeconds());}
  function metin(s){return String(s==null?"":s)}
  function ciz(v){
    var tb=document.getElementById("satirlar"),h="";
    for(var i=0;i<v.satirlar.length;i++){var s=v.satirlar[i],o=onceki[s.kod]||{},ya="",ys="";
      if(o.alis!=null&&s.alis!=null&&s.alis!==o.alis)ya=s.alis>o.alis?" yukari":" asagi";
      if(o.satis!=null&&s.satis!=null&&s.satis!==o.satis)ys=s.satis>o.satis?" yukari":" asagi";
      h+='<tr><td class="k"></td><td class="f a'+ya+'"></td><td class="f s'+ys+'"></td></tr>';
      onceki[s.kod]={alis:s.alis,satis:s.satis};}
    tb.innerHTML=h;
    var trs=tb.getElementsByTagName("tr");
    for(var j=0;j<v.satirlar.length;j++){var c=trs[j].getElementsByTagName("td"),r=v.satirlar[j];c[0].textContent=metin(r.ad||r.kod);c[1].textContent=metin(r.alisYazi);c[2].textContent=metin(r.satisYazi);}
    document.getElementById("firma").textContent=metin(v.firma);
    document.getElementById("durum").textContent="";
  }
  function cek(){
    var x=new XMLHttpRequest();x.open("GET",ADRES+(ADRES.indexOf("?")<0?"?":"&")+"t="+Date.now(),true);
    x.onreadystatechange=function(){if(x.readyState!==4)return;
      if(x.status===200){try{ciz(JSON.parse(x.responseText));}catch(e){document.getElementById("durum").textContent="veri okunamadı";}}
      else document.getElementById("durum").textContent="bağlantı yok ("+x.status+")";};
    x.onerror=function(){document.getElementById("durum").textContent="bağlantı yok";};
    x.send();
  }
  var ilk=document.getElementById("satirlar").getElementsByTagName("tr");
  for(var i=0;i<ilk.length;i++){var c=ilk[i].getElementsByTagName("td");onceki[ilk[i].getAttribute("data-kod")]={alis:null,satis:null};}
  saat();setInterval(saat,1000);setInterval(cek,SN*1000);
})();
</script>
</body>
</html>
`;
};

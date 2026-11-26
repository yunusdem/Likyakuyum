/**
 * Kasaya bağlı terazi yanıtı çözümü (docs/TICARI_ADISYON_YOL_HARITASI.md, TA4). Saf: tarayıcı (Web Serial) ve yazdırma ajanı
 * yolunun ikisi de ham metni buraya verir.
 *
 * Desteklenen yaygın biçimler (CAS / A&D / Dibal ECR benzeri):
 *   "ST,GS,+  0.750kg"   durum (ST kararlı, US kararsız, OL aşırı yük) + ağırlık + birim
 *   "  0.750kg"          yalnız ağırlık + birim (W isteğine CAS ECR yanıtı)
 *   "\x02 0.750\x03"     STX/ETX arasında ağırlık, birimsiz → kg
 *   "00750"              ondalıksız, birimsiz → ayara göre gram (varsayılan) ya da kg
 * Sürekli gönderen terazide birden çok satır gelir; son tam satır kullanılır.
 */

export type TeraziProtokolu = "istek" | "surekli";

export interface TeraziBaglantiAyari {
  /** yok · tarayici (Web Serial, Chrome/Edge) · ajan (yazdırma ajanı, COM port) */
  yol: "yok" | "tarayici" | "ajan";
  baud: number;
  veriBit: 7 | 8;
  parite: "none" | "even" | "odd";
  durBit: 1 | 2;
  /** istek: ağırlık için "W\r" gönderilir (CAS ECR) · surekli: terazi kendisi gönderir */
  protokol: TeraziProtokolu;
  /** Ondalıksız, birimsiz yanıt gram mıdır (değilse kg) */
  ondaliksizGram: boolean;
  /** Ajan yolunda port (COM3) */
  ajanPort: string;
  /** Tartı penceresi açılınca kendiliğinden oku */
  otomatik: boolean;
  /** Tarayıcı yolunda seçilen USB cihazı (getPorts ile yeniden bulmak için) */
  usbVendorId?: number | null;
  usbProductId?: number | null;
}

export const VARSAYILAN_TERAZI_AYARI: TeraziBaglantiAyari = {
  yol: "yok", baud: 9600, veriBit: 8, parite: "none", durBit: 1, protokol: "istek", ondaliksizGram: true, ajanPort: "COM3", otomatik: true,
  usbVendorId: null, usbProductId: null,
};

/** CAS ECR ağırlık isteği: "W" + CR */
export const TERAZI_ISTEGI = "W\r";
export const TERAZI_ISTEGI_HEX = "570D";

export interface TeraziOkumasi {
  /** Okunan ağırlık (kg); okunamadıysa null */
  kg: number | null;
  /** Terazi sabit (ST) mi; durum bilgisi yoksa true sayılır */
  kararli: boolean;
  /** Okunamadı / aşırı yük / eksi ağırlık açıklaması */
  hata: string | null;
}

const yuvarla4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/** Tek satırın çözümü */
function satirCoz(satir: string, ondaliksizGram: boolean): TeraziOkumasi | null {
  // Yazdırılamayan karakterler (STX/ETX vb.) boşluk olur
  const t = satir.replace(/[\x00-\x1f\x7f]/g, " ").trim();
  if (!t) return null;
  const buyuk = t.toUpperCase();
  if (/\b(OL|OVER|ASIRI)\b/.test(buyuk) || /\bOL,/.test(buyuk)) return { kg: null, kararli: false, hata: "Terazide aşırı yük (OL)." };
  const kararsiz = /\b(US|UNST|MOTION)\b/.test(buyuk) || /^US,/.test(buyuk) || /\?/.test(t);
  const m = /([-+]?)\s*(\d+(?:[.,]\d+)?)\s*(KG|LB|G)?\b/.exec(buyuk);
  if (!m) return null;
  const isaret = m[1] === "-" ? -1 : 1;
  const sayi = Number(m[2].replace(",", "."));
  if (!Number.isFinite(sayi)) return null;
  const birim = m[3] || "";
  if (birim === "LB") return { kg: null, kararli: false, hata: "Terazi libre (lb) gönderiyor; terazinin birimini kg yapın." };
  const ondalikli = /[.,]/.test(m[2]);
  let kg: number;
  if (birim === "KG") kg = sayi;
  else if (birim === "G") kg = sayi / 1000;
  else kg = ondalikli ? sayi : ondaliksizGram ? sayi / 1000 : sayi;
  kg = yuvarla4(kg * isaret);
  if (kg < 0) return { kg, kararli: !kararsiz, hata: "Terazi eksi gösteriyor; darayı sıfırlayın." };
  if (kg === 0) return { kg: 0, kararli: !kararsiz, hata: "Terazi boş (0)." };
  return { kg, kararli: !kararsiz, hata: null };
}

/** Satır sonu: CRLF tek satır sonudur (ayrı ayrı sayılırsa tek satır "iki satır" görünür) */
const SATIR_SONU = /\r\n|\r|\n|\x03/;

/** Sürekli gönderen terazide yeterli veri geldi mi: yarım ilk satır + iki TAM satır (en az üç satır sonu) */
export function teraziSurekliYeterliMi(ham: string): boolean {
  return /\d/.test(ham) && String(ham ?? "").split(SATIR_SONU).length - 1 >= 3;
}

/**
 * Ham yanıtın çözümü: son çözülebilen satır.
 * `surekli` (terazi durmadan gönderiyor; port akışın ortasında açılır): ilk satır her zaman yarımdır ve atılır ("+  0.750kg" yerine
 * "50kg" okunup 50 kg sayılmasın — 26.11.2026 denetimi); son iki TAM satır aynı ağırlığı vermedikçe okuma "kararsız" döner.
 */
export function teraziCevabiCoz(ham: string, ondaliksizGram = true, surekli = false): TeraziOkumasi {
  const metin = String(ham ?? "");
  const satirlar = metin.split(SATIR_SONU);
  // Sondaki satır yarım gelebilir ("…+  0.7"): tam satır varken yarım olan atılır
  if (satirlar.length > 1 && !/[\r\n\x03]$/.test(metin)) satirlar.pop();
  if (surekli) {
    satirlar.shift(); // akışın ortasından başlayan ilk parça
    const cozulen = satirlar.map((x) => satirCoz(x, ondaliksizGram)).filter((x): x is TeraziOkumasi => !!x);
    if (cozulen.length < 2) return { kg: null, kararli: false, hata: metin.trim() ? "Teraziden yeterli veri gelmedi; yeniden deneyin." : "Teraziden yanıt gelmedi." };
    const son = cozulen[cozulen.length - 1], onceki = cozulen[cozulen.length - 2];
    if (son.hata) return son;
    if (son.kg === null || onceki.kg === null || Math.abs(son.kg - onceki.kg) > 0.0005) return { kg: son.kg, kararli: false, hata: null };
    return son;
  }
  for (let i = satirlar.length - 1; i >= 0; i--) {
    const s = satirCoz(satirlar[i], ondaliksizGram);
    if (s) return s;
  }
  return { kg: null, kararli: false, hata: ham && String(ham).trim() ? "Terazi yanıtı anlaşılamadı." : "Teraziden yanıt gelmedi." };
}

/** Ayar denetimi (yazdırma ajanının kabul ettikleriyle aynı) */
export const teraziAyariDenetle = (a: Partial<TeraziBaglantiAyari>): string | null => {
  if (!a.yol || !["yok", "tarayici", "ajan"].includes(a.yol)) return "Bağlantı yolu seçilmeli.";
  if (a.yol === "yok") return null;
  if (![1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].includes(Number(a.baud))) return "Baud hızı geçersiz.";
  if (a.veriBit !== 7 && a.veriBit !== 8) return "Veri biti 7 ya da 8 olmalı.";
  if (!a.parite || !["none", "even", "odd"].includes(a.parite)) return "Parite geçersiz.";
  if (a.durBit !== 1 && a.durBit !== 2) return "Dur biti 1 ya da 2 olmalı.";
  if (a.yol === "ajan" && !/^COM\d{1,3}$/i.test(String(a.ajanPort || "").trim())) return "Port COM1, COM3 gibi olmalı.";
  return null;
};

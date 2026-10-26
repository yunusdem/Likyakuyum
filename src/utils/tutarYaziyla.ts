/**
 * Sayısal tutarı Türkçe yazıyla ifade eden yardımcı fonksiyon.
 * Örn: 87030 -> "SEKSEN YEDİ BİN OTUZ TL"
 */
export function tutarYaziylaTr(tutar: number): string {
  const birler = ["", "BİR", "İKİ", "ÜÇ", "DÖRT", "BEŞ", "ALTI", "YEDİ", "SEKİZ", "DOKUZ"];
  const onlar = ["", "ON", "YİRMİ", "OTUZ", "KIRK", "ELLİ", "ALTMIŞ", "YETMİŞ", "SEKSEN", "DOKSAN"];
  const gruplar = ["", "BİN", "MİLYON", "MİLYAR", "TRİLYON"];

  const uclu = (n: number, grup: number): string => {
    const y = Math.floor(n / 100);
    const o = Math.floor((n % 100) / 10);
    const b = n % 10;
    let res = "";
    if (y > 0) {
      res += (y === 1 ? "YÜZ" : birler[y] + " YÜZ") + " ";
    }
    if (o > 0) {
      res += onlar[o] + " ";
    }
    if (b > 0 && !(grup === 1 && n === 1)) {
      res += birler[b] + " ";
    }
    return res.trim();
  };

  const deger = Math.abs(Number(tutar) || 0);
  let lira = Math.floor(deger);
  let kurus = Math.round((deger - lira) * 100);
  if (kurus === 100) {
    lira += 1;
    kurus = 0;
  }

  const parcalar: string[] = [];
  for (let n = lira, i = 0; n > 0 && i < gruplar.length; n = Math.floor(n / 1000), i++) {
    const k = n % 1000;
    if (k > 0) {
      const ucluStr = uclu(k, i);
      const grupStr = gruplar[i];
      parcalar.unshift((ucluStr ? ucluStr + " " : "") + grupStr);
    }
  }

  const tam = parcalar.length ? parcalar.join(" ").replace(/\s+/g, " ").trim() : "SIFIR";
  const kurusStr = kurus > 0 ? ` ${onlar[Math.floor(kurus / 10)] || ""} ${birler[kurus % 10] || ""} KRŞ`.replace(/\s+/g, " ").trim() : "";

  return `${tam} TL${kurusStr ? ` ${kurusStr}` : ""}`;
}

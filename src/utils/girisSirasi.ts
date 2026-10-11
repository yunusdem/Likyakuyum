/**
 * Kullanıcıya özel giriş sırası — saf mantık (docs/FIRMA_OZEL_AYARLAR_YOL_HARITASI.md, K3–K4).
 *
 * Ekrandaki alanlar ekrandaki dizilişiyle gelir. Kullanıcının kaydında adı geçen alanlar, kayıttaki sırayla
 * kendi yuvalarını doldurur; kayıtta olmayan (yeni eklenmiş ya da adsız) alanlar ekrandaki yerinde kalır.
 * "Atla" işaretli alana Enter ile uğranmaz; zorunlu alan hiçbir zaman atlanmaz.
 */

export interface SiraAlani {
  alan: string;
  atla: boolean;
}

export interface SiraOgesi {
  /** data-alan değeri; adsız alan için null */
  alan: string | null;
  /** zorunlu alan atlanamaz */
  zorunlu?: boolean;
}

/** Kayda göre etkin sıra: ekrandaki konumların (index) yeni dizilişi */
export function etkinSira(ogeler: SiraOgesi[], kayit: SiraAlani[] | null | undefined): number[] {
  const dom = ogeler.map((_, i) => i);
  if (!kayit?.length) return dom;
  const kayitSirasi = new Map(kayit.map((k, i) => [k.alan, i]));
  // Kayıtta adı geçen ilk eleman yuvaları (aynı ad birden çok kez görünürse yalnızca ilki sıralanır)
  const gorulen = new Set<string>();
  const yuvalar: number[] = [];
  for (const i of dom) {
    const a = ogeler[i].alan;
    if (a && kayitSirasi.has(a) && !gorulen.has(a)) {
      gorulen.add(a);
      yuvalar.push(i);
    }
  }
  const sirali = [...yuvalar].sort((x, y) => kayitSirasi.get(ogeler[x].alan!)! - kayitSirasi.get(ogeler[y].alan!)!);
  const sonuc = [...dom];
  yuvalar.forEach((yuva, n) => (sonuc[yuva] = sirali[n]));
  return sonuc;
}

/** Atlanacak mı? (zorunlu alan atlanmaz) */
export function atlanirMi(oge: SiraOgesi, kayit: SiraAlani[] | null | undefined): boolean {
  if (!oge.alan || oge.zorunlu || !kayit?.length) return false;
  return kayit.some((k) => k.alan === oge.alan && k.atla);
}

/**
 * `mevcut` konumundaki alandan sonra Enter ile gidilecek alanın konumu; sonda ise null.
 * Mevcut alan kendisi "atla" işaretli olsa da (fareyle tıklanmış) sıradaki yerinden devam edilir.
 */
export function sonrakiKonum(ogeler: SiraOgesi[], mevcut: number, kayit: SiraAlani[] | null | undefined): number | null {
  if (mevcut < 0 || mevcut >= ogeler.length) return null;
  const sira = etkinSira(ogeler, kayit);
  const yer = sira.indexOf(mevcut);
  for (let i = yer + 1; i < sira.length; i++) {
    if (!atlanirMi(ogeler[sira[i]], kayit)) return sira[i];
  }
  return null;
}

const TR_HARF: Record<string, string> = { ç: "c", ğ: "g", ı: "i", i̇: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

/** Metni sunucunun kabul ettiği ad biçimine indirger: "Müşteri Adı:" → "musteri-adi" */
export function adSadelestir(s: string | null | undefined, azami = 60): string {
  return String(s ?? "")
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]|i̇/g, (h) => TR_HARF[h] ?? h)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, azami)
    .replace(/-+$/, "");
}

/** Ekran adı: açık verilmişse o; yoksa sayfa adresinden ("/vezne/sarraf-fisi" → "yol.vezne-sarraf-fisi") */
export const yolEkranAdi = (yol: string): string => `yol.${adSadelestir(yol, 70) || "ana"}`;

/**
 * Alan kimlikleri: her elemanın taban adı (data-alan / name / id / etiket) ve grubu (tablo satırı) verilir;
 * aynı grupta aynı taban ikinci kez geçerse ".2", ".3" eklenir. Tabanı olmayan alan adsız kalır (yerinde durur).
 */
export function kimlikAta(ogeler: { taban: string | null; grup: unknown }[]): (string | null)[] {
  const sayac = new Map<unknown, Map<string, number>>();
  return ogeler.map(({ taban, grup }) => {
    if (!taban) return null;
    let g = sayac.get(grup);
    if (!g) sayac.set(grup, (g = new Map()));
    const n = (g.get(taban) || 0) + 1;
    g.set(taban, n);
    return n === 1 ? taban : `${taban}.${n}`;
  });
}

/** Etkin sıradaki ilk atlanmayan alanın konumu (bir satıra girilirken); yoksa null */
export function ilkKonum(ogeler: SiraOgesi[], kayit: SiraAlani[] | null | undefined): number | null {
  for (const i of etkinSira(ogeler, kayit)) if (!atlanirMi(ogeler[i], kayit)) return i;
  return null;
}

/** Ayar penceresinde gösterilecek liste: kayıt sırası + kayıtta olmayanlar ekrandaki yerinde */
export function ayarListesi(
  alanlar: { alan: string; etiket: string; zorunlu?: boolean }[],
  kayit: SiraAlani[] | null | undefined
): { alan: string; etiket: string; zorunlu: boolean; atla: boolean }[] {
  const tekil = alanlar.filter((a, i) => alanlar.findIndex((b) => b.alan === a.alan) === i);
  const sira = etkinSira(tekil.map((a) => ({ alan: a.alan })), kayit);
  return sira.map((i) => {
    const a = tekil[i];
    return { alan: a.alan, etiket: a.etiket, zorunlu: !!a.zorunlu, atla: !a.zorunlu && atlanirMi({ alan: a.alan }, kayit) };
  });
}

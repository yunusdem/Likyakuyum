/**
 * Müşteri ekranı (docs/TICARI_ADISYON_YOL_HARITASI.md, TA9): aynı bilgisayarda ikinci monitöre taşınan ayrı pencere.
 * Kasa sayfası (Hızlı Satış, Adisyon tahsilatı) sepet / toplam / ödeme durumunu BroadcastChannel ile yayınlar; müşteri ekranı
 * yalnız dinler (sunucuya istek atmaz). Geç açılan pencere son durumu localStorage'dan okur ve "iste" mesajıyla tazeler.
 * Model kurulumu saf fonksiyondur (test edilir).
 */
export const MUSTERI_KANALI = "likya-musteri-ekrani";
const DURUM_ANAHTARI = "likya_musteri_ekrani_durum";
const KIMLIK_ANAHTARI = "likya_musteri_ekrani_kimlik";

export interface MusteriEkraniSatiri {
  ad: string;
  /** Gösterilecek miktar: "3 Adet", "0,347 Kg", "2 Koli (24 Adet)" */
  miktar: string;
  birimFiyat: number;
  tutar: number;
  /** İndirim / kampanya rozeti */
  not?: string | null;
}

export interface MusteriEkraniDurumu {
  surum: 1;
  /** Gönderim anı (ms); eski mesaj yenisini ezmesin */
  zaman: number;
  tur: "bos" | "sepet" | "tamam";
  satirlar: MusteriEkraniSatiri[];
  /** Son eklenen / değişen satırın sırası (vurgulanır, görünür alana kaydırılır) */
  vurgu: number | null;
  kalemSayisi: number;
  araToplam: number;
  indirim: number;
  kdv: number;
  toplam: number;
  odenen: number;
  kalan: number;
  paraUstu: number;
  /** Alış (müşteriye ödenecek) mı */
  alis: boolean;
}

/** Firma kimliği ayrı yollanır (logo büyük olabilir) */
export interface MusteriEkraniKimligi { firmaAdi: string; logo: string | null; karsilama: string }

const yuvarla2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const miktarMetni = (n: number) => Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 4 });

export interface KasaSatiri {
  anahtar: string;
  ad: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  ek?: { birim?: { ad: string; carpan: number } | null; kampanya?: { ad: string } | null; iskonto?: unknown } | null;
}

/** Satırın müşteri ekranındaki miktar yazısı; ek birimde (koli) koli sayısı ve ana birim birlikte */
export function musteriMiktari(s: Pick<KasaSatiri, "miktar" | "birim" | "ek">): string {
  const b = s.ek?.birim;
  if (b && b.carpan > 0 && b.carpan !== 1) {
    const koli = Math.round((s.miktar / b.carpan) * 10000) / 10000;
    return `${miktarMetni(koli)} ${b.ad} (${miktarMetni(s.miktar)} ${s.birim})`;
  }
  return `${miktarMetni(s.miktar)} ${s.birim || "Adet"}`;
}

/** Önceki sepete göre eklenen ya da miktarı / fiyatı değişen ilk satır (sondan); yoksa null */
export function degisenSatir(onceki: Pick<KasaSatiri, "anahtar" | "miktar" | "birimFiyat">[], yeni: Pick<KasaSatiri, "anahtar" | "miktar" | "birimFiyat">[]): number | null {
  const eski = new Map(onceki.map((s) => [s.anahtar, s]));
  for (let i = yeni.length - 1; i >= 0; i--) {
    const o = eski.get(yeni[i].anahtar);
    if (!o || o.miktar !== yeni[i].miktar || o.birimFiyat !== yeni[i].birimFiyat) return i;
  }
  return null;
}

/**
 * Kasa durumundan müşteri ekranı modeli. Satış bitince (`sonFis`) "tamam": toplam ve para üstü fişinkidir.
 * `satirTutarlari` sepet hesabının gösterilen satır tutarlarıdır (sepetHesapla).
 */
export function musteriEkraniDurumu(g: {
  sepet: KasaSatiri[];
  satirTutarlari: number[];
  toplam: { araToplam: number; indirim: number; kdv: number; genelToplam: number };
  odeme: { odenen: number; kalan: number; paraUstu: number };
  alis?: boolean;
  sonFis?: { toplam: number; paraUstu: number } | null;
  oncekiSepet?: KasaSatiri[] | null;
  zaman?: number;
}): MusteriEkraniDurumu {
  const zaman = g.zaman ?? Date.now();
  if (g.sonFis && !g.sepet.length) {
    return { surum: 1, zaman, tur: "tamam", satirlar: [], vurgu: null, kalemSayisi: 0, araToplam: 0, indirim: 0, kdv: 0,
      toplam: yuvarla2(g.sonFis.toplam), odenen: yuvarla2(g.sonFis.toplam + g.sonFis.paraUstu), kalan: 0, paraUstu: yuvarla2(g.sonFis.paraUstu), alis: !!g.alis };
  }
  if (!g.sepet.length) {
    return { surum: 1, zaman, tur: "bos", satirlar: [], vurgu: null, kalemSayisi: 0, araToplam: 0, indirim: 0, kdv: 0, toplam: 0, odenen: 0, kalan: 0, paraUstu: 0, alis: !!g.alis };
  }
  const satirlar = g.sepet.map((s, i) => ({
    ad: s.ad,
    miktar: musteriMiktari(s),
    birimFiyat: yuvarla2(s.birimFiyat),
    tutar: yuvarla2(g.satirTutarlari[i] ?? s.miktar * s.birimFiyat),
    not: s.ek?.kampanya ? `Kampanya: ${s.ek.kampanya.ad}` : null,
  }));
  return {
    surum: 1, zaman, tur: "sepet", satirlar,
    vurgu: g.oncekiSepet ? degisenSatir(g.oncekiSepet, g.sepet) : satirlar.length - 1,
    kalemSayisi: satirlar.length,
    araToplam: yuvarla2(g.toplam.araToplam), indirim: yuvarla2(g.toplam.indirim), kdv: yuvarla2(g.toplam.kdv), toplam: yuvarla2(g.toplam.genelToplam),
    odenen: yuvarla2(g.odeme.odenen), kalan: yuvarla2(g.odeme.kalan), paraUstu: yuvarla2(g.odeme.paraUstu), alis: !!g.alis,
  };
}

/** Gelen mesaj geçerli bir durum mu (başka sekmeden bozuk / eski sürüm mesajı ekranı bozmasın) */
export function durumGecerliMi(d: unknown): d is MusteriEkraniDurumu {
  const x = d as MusteriEkraniDurumu;
  return !!x && x.surum === 1 && ["bos", "sepet", "tamam"].includes(x.tur) && Array.isArray(x.satirlar) && Number.isFinite(x.toplam) && Number.isFinite(x.zaman);
}

type Mesaj = { tip: "durum"; durum: MusteriEkraniDurumu } | { tip: "kimlik"; kimlik: MusteriEkraniKimligi } | { tip: "iste" };

const kanalAc = (): BroadcastChannel | null => (typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(MUSTERI_KANALI));
const sakla = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* kota / gizli mod */ } };
const oku = <T,>(k: string): T | null => { try { const s = localStorage.getItem(k); return s ? (JSON.parse(s) as T) : null; } catch { return null; } };

/** Kasa tarafı: durum ve kimlik yayınlar; müşteri ekranının "iste" mesajına son durumu yeniden yollar */
export function musteriYayincisi() {
  const kanal = kanalAc();
  let sonDurum: MusteriEkraniDurumu | null = null;
  let kimlik: MusteriEkraniKimligi | null = null;
  if (kanal) kanal.onmessage = (e: MessageEvent<Mesaj>) => {
    if (e.data?.tip !== "iste") return;
    if (kimlik) kanal.postMessage({ tip: "kimlik", kimlik } as Mesaj);
    if (sonDurum) kanal.postMessage({ tip: "durum", durum: sonDurum } as Mesaj);
  };
  return {
    durum(d: MusteriEkraniDurumu) { sonDurum = d; sakla(DURUM_ANAHTARI, d); kanal?.postMessage({ tip: "durum", durum: d } as Mesaj); },
    kimlik(k: MusteriEkraniKimligi) { kimlik = k; sakla(KIMLIK_ANAHTARI, k); kanal?.postMessage({ tip: "kimlik", kimlik: k } as Mesaj); },
    kapat() { kanal?.close(); },
  };
}

/** Müşteri ekranı tarafı: son durumu okur, gelenleri dinler, açılışta "iste" yollar */
export function musteriDinleyicisi(onDurum: (d: MusteriEkraniDurumu) => void, onKimlik: (k: MusteriEkraniKimligi) => void) {
  const kanal = kanalAc();
  let son = 0;
  const durumAl = (d: unknown) => { if (durumGecerliMi(d) && d.zaman >= son) { son = d.zaman; onDurum(d); } };
  const ilk = oku<MusteriEkraniDurumu>(DURUM_ANAHTARI);
  if (ilk) durumAl(ilk);
  const k0 = oku<MusteriEkraniKimligi>(KIMLIK_ANAHTARI);
  if (k0) onKimlik(k0);
  if (kanal) {
    kanal.onmessage = (e: MessageEvent<Mesaj>) => {
      if (e.data?.tip === "durum") durumAl(e.data.durum);
      else if (e.data?.tip === "kimlik" && e.data.kimlik) onKimlik(e.data.kimlik);
    };
    kanal.postMessage({ tip: "iste" } as Mesaj);
  }
  // BroadcastChannel olmayan tarayıcıda localStorage olayı
  const depo = (e: StorageEvent) => {
    if (e.key === DURUM_ANAHTARI && e.newValue) { try { durumAl(JSON.parse(e.newValue)); } catch { /* bozuk */ } }
    if (e.key === KIMLIK_ANAHTARI && e.newValue) { try { onKimlik(JSON.parse(e.newValue)); } catch { /* bozuk */ } }
  };
  window.addEventListener("storage", depo);
  return () => { kanal?.close(); window.removeEventListener("storage", depo); };
}

/**
 * Müşteri ekranı penceresini açar. Tarayıcı Pencere Yönetimi iznini verirse ikinci ekranın konumuna açılır; yoksa kasiyer pencereyi
 * ikinci monitöre sürükleyip "Tam ekran"a basar. Aynı ad ile ikinci kez çağrılınca var olan pencere öne gelir.
 */
export function musteriEkraniAc(): Window | null {
  // Pencere tıklamanın içinde hemen açılır (izin beklenirse açılır pencere engeline takılır); sonra ikinci ekrana taşınır
  const p = window.open("/musteri-ekrani", "likya_musteri_ekrani", "popup=yes,width=1280,height=800");
  p?.focus();
  if (p) void ikinciEkranaTasi(p);
  return p;
}

async function ikinciEkranaTasi(p: Window): Promise<void> {
  try {
    const w = window as any;
    if (typeof w.getScreenDetails !== "function") return;
    const ekranlar = await w.getScreenDetails(); // ilk seferde tarayıcı "pencere yönetimi" izni sorar
    const liste = ekranlar.screens as any[];
    const diger = liste.find((s) => s !== ekranlar.currentScreen && !s.isPrimary) || liste.find((s) => s !== ekranlar.currentScreen);
    if (!diger || p.closed) return;
    p.moveTo(diger.availLeft, diger.availTop);
    p.resizeTo(diger.availWidth, diger.availHeight);
  } catch { /* izin verilmedi ya da tek ekran: kasiyer pencereyi sürükler */ }
}

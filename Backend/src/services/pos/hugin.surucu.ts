import { env } from "../../config/env.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { PosAdminSqlRepository } from "../../models/admin/posAdminSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { sifreCoz } from "../../utils/kripto.utils.js";
import { INPOS_BANKALARI } from "./inpos.surucu.js";
import { GrupOdemesi, PesinOdeme, PosIslem, PosKalem, PosSurucu, PosTerminal, SurucuIstek, SurucuSonuc } from "./pos.types.js";

/**
 * Hugin S1 (Android Yazarkasa POS) sürücüsü — PC Link API'si, TSM Gateway üzerinden (bulut). K36.
 * Kaynak: docs/hugin/pc-link.openapi.json + pc-link.postman.json (docs/POS_ENTEGRASYON_YOL_HARITASI.md §0c).
 *
 * Akış (fiş başına tek mali belge, K35'in Hugin hali):
 *   POST /v1/documents {docCategory: SALE} → documentId (işlem referansı)
 *   tek kart:      PUT /v1/documents/{id} (kalemler + EFT_POS + nakit…) — kart bu istekte okunur ("combo")
 *   birden çok:    her kart için POST /v1/documents/{id}/payments/EFT_POS {amount}, sonra PUT
 * Kart okunana kadar HTTP isteği açık kalır. Bu yüzden gonder() belgeyi açıp hemen döner, tahsilat arka planda sürer,
 * sonuç SurucuIstek.sonucBildir ile işlemlere yazılır. Sunucu yeniden başlarsa sorgula() cihaz durumundan
 * (GET /v1/status: aktif belge + son 3 belge) sonucu bulmaya çalışır.
 *
 * Kimlik: Hugin yazılım firmasına tek bir tsmToken verir; cihaz (sicil no) başına kısa ömürlü accessToken alınır
 * (POST /v1/tsm/token). Her istekte X-SoftwareId (bizim VKN), X-HardwareId (sunucunun sabit kimliği), X-SerialNo.
 *
 * Fatura bizden (ICE) çıkar; cihaz e-Arşiv / e-Fatura bilgi fişi basar (K37). Cihazın kendi entegratörüne e-Belge
 * gönderip göndermediği Hugin'e soruldu (A18). Gerçek cihazla HENÜZ DENENMEDİ; belgede açık olmayan alanlar hoşgörülü okunur.
 */

export const HUGIN_VARSAYILAN_GW = "https://pclink-gw.hugin.co";
export const HUGIN_VARSAYILAN_DONANIM = "LIKYAERP-SUNUCU";

/** Kısa istekler (belge açma, durum, ayarlar, token) */
const KISA_MS = 20_000;
/** Kart okutma bekleyen istekler: canlıdaki 180 sn bekleme süresinden biraz uzun */
const KART_MS = 200_000;
/** Z raporu (cihaz yazdırır) */
const Z_MS = 90_000;
/** accessToken süresi dolmadan bu kadar önce yenilenir */
const TOKEN_PAYI_SN = 120;
const AYAR_ONBELLEK_MS = 10 * 60 * 1000;
/** Aynı belge için cihaz durumu en fazla bu aralıkla sorulur ("gereksiz durum sorgusu cihazı yavaşlatır") */
const DURUM_ARALIK_MS = 10_000;
/** Kağıt bitti vb. (206): belge kapanışı bu aralıkla, bu süre boyunca yeniden denenir */
const KAPANIS_TEKRAR_MS = 20_000;
const KAPANIS_SURE_MS = 10 * 60 * 1000;
/** Biten tahsilat sonuçları bellekte bu kadar tutulur */
const GOREV_OMRU_MS = 60 * 60 * 1000;
/** Kalemler verilemediğinde bilgi fişindeki tek satırın KDV oranı (kuyumda altın bedeli istisna) */
const TEK_SATIR_KDV = 0;

const ODEME_TIPI: Record<PesinOdeme["tur"], string> = { nakit: "CASH", havale: "WIRE", cari: "OPEN_ACCOUNT" };

interface HuginAyar {
  gwUrl: string;
  tsmToken: string;
  yazilimId: string;
  donanimId: string;
}

type Gunluk = (k: { ozet: string; istek?: unknown; yanit?: unknown; basarili: boolean }) => Promise<void>;

const kok = (url: string): string => url.trim().replace(/\/+$/, "");
const para = (n: number): number => Math.round(n * 100) / 100;
/** Hugin finansal değerleri metin ve noktalı ister: "1250.00" */
const tutarYaz = (n: number): string => para(n).toFixed(2);
const yaz = (v: unknown): string | null => (v === undefined || v === null || String(v).trim() === "" ? null : String(v).trim());

/**
 * Merkezdeki ayar önce gelir; boş alan sunucunun .env.local'indeki HUGIN_* değerinden tamamlanır.
 * Test sunucusunda yönetim paneli kapalı olduğu için Hugin bilgileri orada .env.local'e yazılır.
 */
const ayarOkuDb = async (): Promise<HuginAyar> => {
  const a = await PosAdminSqlRepository.ayarGetir();
  const tsmToken = sifreCoz(a?.huginTsmTokenSifreli) || yaz(env.HUGIN_TSM_TOKEN);
  const yazilimId = yaz(a?.huginYazilimId) || yaz(env.HUGIN_YAZILIM_ID);
  if (!yazilimId || !tsmToken) {
    throw ApiError.badRequest("Hugin bilgileri tanımlı değil. Yönetim panelinde POS Entegrasyonu > Ayarlar bölümünden yazılım kimliği (VKN) ve Hugin'in verdiği tsmToken girilmelidir.");
  }
  return {
    gwUrl: kok(yaz(a?.huginGwUrl) || yaz(env.HUGIN_GW_URL) || HUGIN_VARSAYILAN_GW),
    tsmToken,
    yazilimId,
    donanimId: yaz(a?.huginDonanimId) || yaz(env.HUGIN_DONANIM_ID) || HUGIN_VARSAYILAN_DONANIM,
  };
};

const gunlukDb: Gunluk = async (k) => {
  try {
    await PosAdminSqlRepository.logYaz({ tur: "ISTEK", ...k });
  } catch {
    // Günlük yazılamazsa tahsilat etkilenmez
  }
};

let ayarKaynagi: () => Promise<HuginAyar> = ayarOkuDb;
let gunluk: Gunluk = gunlukDb;
let kapanisTekrarMs = KAPANIS_TEKRAR_MS;

/** Test için: ayar ve günlük kaynağını değiştirir, önbellekleri boşaltır. */
export const huginTestDuzeni = (d: { ayar?: HuginAyar; gunluk?: Gunluk; kapanisTekrarMs?: number } | null) => {
  ayarKaynagi = d?.ayar ? async () => d.ayar! : ayarOkuDb;
  gunluk = d?.gunluk ?? gunlukDb;
  kapanisTekrarMs = d?.kapanisTekrarMs ?? KAPANIS_TEKRAR_MS;
  erisimler.clear();
  cihazAyarlari.clear();
  durumOnbellegi.clear();
  gorevler.clear();
};

// ─── HTTP ───────────────────────────────────────────────────────────────────

interface Yanit {
  durum: number;
  veri: any;
}

/** Gövde hata zarfı mı: {"status":"ERROR"} ya da dolu "error" nesnesi */
export const govdeHataMi = (veri: any): boolean =>
  Boolean(veri && typeof veri === "object" && (String(veri.status || "").toUpperCase() === "ERROR" || (veri.error && typeof veri.error === "object" && (veri.error.code || veri.error.title))));

/** 200 + ERROR gövdesinin karşılığı olan HTTP durumu (hata türü ve mesajlar bu koda göre çalışır) */
export const hataDurumu = (veri: any): number => {
  const k = String(veri?.error?.code || "").toUpperCase();
  if (k === "DISCONNECTED" || k === "ERR_NO_TSM" || k === "ERR_PCLINK_INACTIVE") return 503;
  if (k === "ERR_INVALID_STATE" || k === "BUSY" || k === "ERR_OPEN_DOCUMENT" || k.startsWith("DOCUMENT_ALREADY")) return 409;
  if (k === "DOCUMENT_NOT_FOUND" || k === "NOT_FOUND") return 404;
  if (k === "ERR_TOKEN_EXPIRED" || k === "INVALID_REFRESH_TOKEN" || k === "UNAUTHORIZED") return 401;
  if (/CANCEL/.test(k) && k !== "ERR_INVALID_CANCEL") return 417;
  if (/^\d{2,3}$/.test(k) || ["INSUFFICIENT_FUNDS", "DO_NOT_HONOR", "INVALID_CARD", "EXPIRED_CARD", "INCORRECT_PIN", "TIMEOUT"].includes(k)) return 417;
  return 400;
};

const http = async (ozet: string, url: string, metod: string, basliklar: Record<string, string>, govde: unknown, zamanMs: number, gizli = false): Promise<Yanit> => {
  const kontrol = new AbortController();
  const zamanlayici = setTimeout(() => kontrol.abort(), zamanMs);
  try {
    const yanit = await fetch(url, {
      method: metod,
      headers: { Accept: "application/json", ...(govde !== undefined ? { "Content-Type": "application/json" } : {}), ...basliklar },
      body: govde !== undefined ? JSON.stringify(govde) : undefined,
      signal: kontrol.signal,
    });
    const metin = await yanit.text();
    let veri: any = null;
    try {
      veri = metin ? JSON.parse(metin) : null;
    } catch {
      veri = { ham: metin.slice(0, 300) };
    }
    // Hugin hataları HTTP 200 ile de döndürebiliyor ({"status":"ERROR","error":{...}}); bunlar hata koduna çevrilir
    const durum = yanit.status < 300 && govdeHataMi(veri) ? hataDurumu(veri) : yanit.status;
    // tsmToken / accessToken günlüğe yazılmaz
    await gunluk({ ozet: `${ozet} → ${yanit.status}${durum !== yanit.status ? ` (ERROR → ${durum})` : ""}`, istek: gizli ? null : govde ?? null, yanit: gizli ? { durum: yanit.status } : veri, basarili: durum < 400 });
    return { durum, veri };
  } catch (err: any) {
    const mesaj = err?.name === "AbortError" ? "Hugin cihazı / Gateway zamanında yanıt vermedi." : `Hugin Gateway'e ulaşılamadı: ${err?.message || err}`;
    await gunluk({ ozet: `${ozet} → ulaşılamadı`, yanit: mesaj, basarili: false });
    throw new ApiError(HttpStatus.BAD_GATEWAY, mesaj);
  } finally {
    clearTimeout(zamanlayici);
  }
};

/** Cevabın asıl gövdesi: { status, data, error, metadata } zarfı; bazı örneklerde alanlar üst düzeyde. */
const govdeAl = (veri: any): any => (veri && typeof veri === "object" && veri.data && typeof veri.data === "object" ? veri.data : veri || {});

export interface HuginHata {
  kod: string | null;
  baslik: string | null;
  aciklama: string | null;
}

export const huginHataOku = (veri: any): HuginHata => {
  const e = veri?.error && typeof veri.error === "object" ? veri.error : {};
  return { kod: yaz(e.code), baslik: yaz(e.title), aciklama: yaz(e.description) };
};

const hataMetni = (durum: number, veri: any, varsayilan: string): string => {
  const h = huginHataOku(veri);
  const ayrinti = [h.baslik, h.aciklama].filter(Boolean).join(": ");
  return ayrinti ? `${varsayilan} ${ayrinti}${h.kod ? ` (${h.kod})` : ""}` : `${varsayilan} (${durum})`;
};

/**
 * Kart tahsilatı hatasının türü:
 *  ret      — banka / kart reddi (417, BKM yanıt kodu, INSUFFICIENT_FUNDS …)
 *  vazgecme — kasiyer / müşteri cihazda vazgeçti
 *  mesgul   — cihaz başka işte ya da durumu uygun değil
 *  baglanti — cihaz Gateway'e bağlı değil, TSM'ye ulaşamıyor
 *  diger    — belge / veri hatası
 */
/** Cihazda kart beklenirken süre doldu (Hugin kodu 81 / TIMEOUT): kart okutulmadı, para çekilmedi */
export const kartZamanAsimi = (veri: any): boolean => {
  const { kod, baslik } = huginHataOku(veri);
  const k = (kod || "").toUpperCase();
  return k === "81" || k === "TIMEOUT" || /zaman aşımı/i.test(baslik || "");
};

export type HataTuru = "ret" | "vazgecme" | "mesgul" | "baglanti" | "diger";

export const huginHataTuru = (durum: number, veri: any): HataTuru => {
  const { kod } = huginHataOku(veri);
  const k = (kod || "").toUpperCase();
  if (k === "DISCONNECTED" || k === "ERR_NO_TSM" || k === "ERR_PCLINK_INACTIVE") return "baglanti";
  if (k === "BUSY" || (k === "ERR_INVALID_STATE" && (durum === 409 || durum === 503))) return "mesgul";
  if (/CANCEL/.test(k) && k !== "ERR_INVALID_CANCEL" && k !== "DOCUMENT_ALREADY_CANCELLED") return "vazgecme";
  if (durum === 417 || /^\d{2,3}$/.test(k) || ["INSUFFICIENT_FUNDS", "DO_NOT_HONOR", "INVALID_CARD", "EXPIRED_CARD", "INCORRECT_PIN", "TIMEOUT"].includes(k)) return "ret";
  if (durum === 503) return "mesgul";
  return "diger";
};

// ─── Kimlik ─────────────────────────────────────────────────────────────────

const erisimler = new Map<string, { token: string; bitis: number }>();

const temelBasliklar = (a: HuginAyar, seri: string): Record<string, string> => ({ "X-SoftwareId": a.yazilimId, "X-HardwareId": a.donanimId, "X-SerialNo": seri });

const tokenAl = async (a: HuginAyar, seri: string): Promise<string> => {
  const { durum, veri } = await http(`Hugin token ${seri}`, `${a.gwUrl}/v1/tsm/token`, "POST", temelBasliklar(a, seri), { tsmToken: a.tsmToken }, KISA_MS, true);
  const g = govdeAl(veri);
  const token = yaz(g.accessToken) ?? yaz(veri?.accessToken);
  if (durum >= 400 || !token) {
    const { kod } = huginHataOku(veri);
    if (kod === "DISCONNECTED" || durum === 503) throw new ApiError(HttpStatus.BAD_GATEWAY, `Cihaz ${seri} Hugin Gateway'e bağlı değil. Cihazda PC Link uygulamasında Gateway bağlantısının açık ve cihazın internette olduğunu kontrol edin.`);
    if (durum === 401) throw new ApiError(HttpStatus.BAD_GATEWAY, `Hugin tsmToken'ı kabul etmedi (cihaz ${seri}). tsmToken ve yazılım kimliği (VKN) kontrol edilmeli (yönetim paneli ya da sunucunun .env.local dosyası); sorun sürerse Hugin GMP desteğine başvurun.`);
    throw new ApiError(HttpStatus.BAD_GATEWAY, hataMetni(durum, veri, `Hugin erişim anahtarı alınamadı (cihaz ${seri}).`));
  }
  const omur = Math.max(Number(g.expiresIn ?? veri?.expiresIn) || 3600, 300) - TOKEN_PAYI_SN;
  erisimler.set(seri, { token, bitis: Date.now() + omur * 1000 });
  return token;
};

const erisim = async (a: HuginAyar, seri: string): Promise<string> => {
  const e = erisimler.get(seri);
  return e && e.bitis > Date.now() ? e.token : tokenAl(a, seri);
};

/** Cihaza (Gateway üzerinden) istek. Erişim anahtarı düşmüşse bir kez yenileyip yeniden dener. */
const istek = async (seri: string, ozet: string, metod: "GET" | "POST" | "PUT" | "PATCH", yol: string, govde?: unknown, zamanMs = KISA_MS): Promise<Yanit> => {
  const a = await ayarKaynagi();
  const url = `${a.gwUrl}${yol}`;
  let y = await http(ozet, url, metod, { ...temelBasliklar(a, seri), Authorization: `Bearer ${await erisim(a, seri)}` }, govde, zamanMs);
  if (y.durum === 401) {
    erisimler.delete(seri);
    y = await http(ozet, url, metod, { ...temelBasliklar(a, seri), Authorization: `Bearer ${await tokenAl(a, seri)}` }, govde, zamanMs);
  }
  return y;
};

/** Cihazın mali sicil numarası (X-SerialNo): cihaz tanımındaki sicil no, yoksa terminal kimliği. */
export const huginSeri = (t: PosTerminal): string => {
  const seri = (t.sicilNo || t.terminalKimlik || "").trim().toUpperCase();
  if (!seri) throw ApiError.badRequest(`"${t.ad}" cihazının sicil numarası tanımlı değil. Banka › POS Cihazları'nda Sicil No alanına cihazın mali sicil numarasını yazın.`);
  return seri;
};

// ─── Cihaz ayarları (departmanlar) ──────────────────────────────────────────

export interface HuginDepartman {
  id: number;
  ad: string;
  kdv: number;
}

export interface HuginCihazAyari {
  seri: string | null;
  vkn: string | null;
  eBelgeKullanicisi: boolean | null;
  lisansBitis: string | null;
  bankalar: { id: number; ad: string }[];
  departmanlar: HuginDepartman[];
}

const cihazAyarlari = new Map<string, { zaman: number; ayar: HuginCihazAyari }>();

export const huginAyariniCoz = (veri: any): HuginCihazAyari => {
  const g = govdeAl(veri);
  const sayi = (v: unknown): number | null => (Number.isFinite(Number(v)) && String(v).trim() !== "" ? Number(v) : null);
  return {
    seri: yaz(g.serialNo),
    vkn: yaz(g.merchant?.taxId) ?? yaz(g.merchant?.taxNo),
    eBelgeKullanicisi: typeof g.merchant?.eInvoiceUser === "boolean" ? g.merchant.eInvoiceUser : null,
    lisansBitis: yaz(g.licenceExpirationDate),
    bankalar: (Array.isArray(g.applications) ? g.applications : [])
      .map((x: any) => ({ id: sayi(x?.id), ad: yaz(x?.name) || "" }))
      .filter((x: { id: number | null }) => x.id !== null) as { id: number; ad: string }[],
    departmanlar: (Array.isArray(g.departments) ? g.departments : [])
      .map((d: any) => ({ id: sayi(d?.id), ad: yaz(d?.name) || "", kdv: sayi(d?.vatRate) }))
      .filter((d: any) => d.id !== null && d.kdv !== null) as HuginDepartman[],
  };
};

const cihazAyari = async (seri: string, yenile = false): Promise<HuginCihazAyari> => {
  const o = cihazAyarlari.get(seri);
  if (!yenile && o && Date.now() - o.zaman < AYAR_ONBELLEK_MS) return o.ayar;
  const { durum, veri } = await istek(seri, `Hugin ayarlar ${seri}`, "GET", "/v1/settings");
  if (durum >= 400) throw new ApiError(HttpStatus.BAD_GATEWAY, hataMetni(durum, veri, `Cihaz ${seri} ayarları okunamadı.`));
  const ayar = huginAyariniCoz(veri);
  cihazAyarlari.set(seri, { zaman: Date.now(), ayar });
  return ayar;
};

// ─── Belge ──────────────────────────────────────────────────────────────────

/** Bizim e-Belge numaramız: 3 harf/rakam + yıl + 9 hane (16 karakter). Değilse invoiceId gönderilmez (cihaz kendisi belirler). */
const E_BELGE_NO = /^[A-Z0-9]{3}20\d{2}\d{9}$/;

/**
 * Bilgi fişi kalemleri. Fiş satırları verilmiş, toplamı belge toplamını tutuyor ve her satırın KDV oranına uyan bir
 * departman cihazda varsa satırlar; değilse tek satır "Fatura toplamı" (%0). Departman listesi bilinmiyorsa
 * departmentId gönderilmez — cihaz o KDV oranını kullanan ilk departmanı seçer. Tutar satır toplamıdır (KDV dahil).
 * Miktar tam sayı değilse (gram) gönderilmez; tutar zaten satır toplamı.
 */
export const huginKalemleri = (kalemler: PosKalem[] | undefined, toplam: number, departmanlar: HuginDepartman[] | null) => {
  const departman = (kdv: number): number | undefined => departmanlar?.find((d) => d.kdv === kdv)?.id;
  const satir = (ad: string, tutar: number, kdv: number, miktar?: number) => {
    const d = departman(kdv);
    const tamMiktar = miktar !== undefined && Number.isInteger(miktar) && miktar > 1;
    return {
      name: ad.slice(0, 100),
      amount: tutarYaz(tutar),
      vatRate: kdv,
      ...(d !== undefined ? { departmentId: d } : {}),
      ...(tamMiktar ? { quantity: String(miktar), unitPrice: tutarYaz(tutar / miktar!) } : {}),
    };
  };
  const tek = [satir("Fatura toplamı", toplam, TEK_SATIR_KDV)];
  if (!kalemler?.length) return tek;
  if (Math.abs(para(kalemler.reduce((t, k) => t + k.tutar, 0)) - para(toplam)) > 0.011) return tek;
  if (kalemler.some((k) => !Number.isInteger(k.kdvOrani))) return tek;
  if (departmanlar && kalemler.some((k) => departman(k.kdvOrani) === undefined)) return tek;
  return kalemler.map((k) => satir(k.ad, k.tutar, k.kdvOrani, k.miktar));
};

export interface HuginPlan {
  /** Cihazda kartla çekilecek tutarlar (POS satırı başına) */
  kartlar: number[];
  /** Belge kapanışı (PUT /v1/documents/{id}) gövdesi */
  kapanis: Record<string, unknown>;
}

/** Fiş başına tek belge: kart satırları + peşin ödenmiş kısım + kalemler. */
export const huginBelgesi = (i: SurucuIstek, departmanlar: HuginDepartman[] | null): HuginPlan => {
  const islemler = i.grup?.islemler.length ? i.grup.islemler : [i.islem];
  const pesinler = (i.grup?.pesinOdemeler || []).filter((p) => p.tutar > 0);
  const kartlar = islemler.map((x) => para(x.tutar));
  const toplam = para(kartlar.reduce((t, x) => t + x, 0) + pesinler.reduce((t, p) => t + p.tutar, 0));
  const belgeNo = yaz(i.islem.belgeNo);
  const tek = kartlar.length === 1;
  const kapanis: Record<string, unknown> = {
    // Fatura bizim sistemden çıkar; cihaz bilgi fişi basar (K37)
    saleType: i.islem.belgeTipi === "efatura" ? "E_INVOICE" : "E_ARCHIVE",
    ...(belgeNo && E_BELGE_NO.test(belgeNo) ? { invoiceId: belgeNo } : {}),
    referenceCode: (belgeNo || `POS-${i.islem.posIslemId}`).slice(0, 50),
    // Nihai tüketicide VKN yok; e-Arşivde 11111111111 kullanılır (A18 teyidi bekleniyor)
    customer: { taxId: i.aliciVkn || "11111111111", taxName: (i.aliciAd || "NİHAİ TÜKETİCİ").slice(0, 100) },
    items: huginKalemleri(i.grup?.kalemler, toplam, departmanlar),
    payments: [
      // Tek kartta kart bu istekte okunur ve banka ayrıntısı istenir; çok kartta kartlar önceden çekilmiştir
      ...kartlar.map((k) => ({ type: "EFT_POS", amount: tutarYaz(k), ...(tek ? { detailedResponse: true } : {}) })),
      ...pesinler.map((p) => ({ type: ODEME_TIPI[p.tur], amount: tutarYaz(p.tutar) })),
    ],
    totals: { documentTotal: tutarYaz(toplam), netTotal: tutarYaz(toplam) },
  };
  return { kartlar, kapanis };
};

// ─── Sonuç ──────────────────────────────────────────────────────────────────

const bankaCoz = (...kaynaklar: any[]): { kod: string | null; ad: string | null } => {
  for (const k of kaynaklar) {
    if (!k || typeof k !== "object") continue;
    const id = Number(k.bankId ?? k.acquirerId ?? k.acquirer?.id);
    if (Number.isFinite(id) && id > 0) return { kod: String(id), ad: yaz(k.bankName) ?? INPOS_BANKALARI[id] ?? `Banka ${id}` };
  }
  return { kod: null, ad: null };
};

/** Kart ödemesi cevabı (Parçalı Ödeme Ekle, Belge Sonlandır'daki eftPayment ya da 206 gövdesi) → ödeme satırı */
export const huginOdemeCoz = (ham: any, varsayilanTutar: number): GrupOdemesi & { islemNo: string | null; bankaRef: string | null } => {
  const o = ham && typeof ham === "object" ? ham : {};
  const ek = o.additionalData && typeof o.additionalData === "object" ? o.additionalData : {};
  const kart = o.card || ek.card || {};
  const b = bankaCoz(o, ek, kart);
  const taksit = Number(o.installmentCount ?? ek.installmentCount);
  const bin = yaz(kart.cardBIN ?? o.cardBIN ?? ek.cardBIN);
  const son = yaz(kart.panSuffix ?? o.panSuffix ?? ek.panSuffix);
  const tutar = Number(o.amount);
  return {
    tutar: Number.isFinite(tutar) && tutar > 0 ? para(tutar) : para(varsayilanTutar),
    bankaKodu: b.kod,
    bankaAdi: b.ad,
    onayKodu: yaz(o.authorizationCode ?? ek.authorizationCode),
    taksit: Number.isFinite(taksit) && taksit > 1 ? taksit : 1,
    kartNo: bin || son ? `${(bin || "").slice(0, 6) || "******"}** **** ${son ? son.padStart(4, "0").slice(-4) : "****"}` : null,
    islemNo: yaz(o.transactionId ?? o.paymentId),
    bankaRef: yaz(o.bankReferenceNo ?? ek.bankReferenceNo ?? o.rrn ?? ek.rrn),
  };
};

/** "0023_0004" → Z no 0023, fiş no 0004 */
export const huginFisNo = (receiptNo: unknown): { zNo: string | null; fisNo: string | null } => {
  const s = yaz(receiptNo);
  if (!s) return { zNo: null, fisNo: null };
  const m = /^(\d+)_(\d+)$/.exec(s);
  return m ? { zNo: m[1], fisNo: m[2] } : { zNo: null, fisNo: s };
};

const sonucYap = (odemeler: ReturnType<typeof huginOdemeCoz>[], kapanis: any, documentId: string, ek: Partial<SurucuSonuc> = {}): SurucuSonuc => {
  const g = govdeAl(kapanis);
  const { zNo, fisNo } = huginFisNo(g.receiptNo);
  const ilk = odemeler[0];
  return {
    durum: "ONAY",
    bankaKodu: ilk?.bankaKodu ?? null,
    bankaAdi: ilk?.bankaAdi ?? null,
    taksit: ilk?.taksit ?? null,
    onayKodu: ilk?.onayKodu ?? null,
    kartNo: ilk?.kartNo ?? null,
    cihazFisNo: fisNo,
    zNo,
    // İade ikinci aşamada API'den yapılabilsin diye banka referansı ve cihaz işlem no saklanır (K40)
    ham: { documentId, receiptNo: yaz(g.receiptNo), invoiceId: yaz(g.invoiceId), odemeler: odemeler.map((o) => ({ tutar: o.tutar, islemNo: o.islemNo, bankaKodu: o.bankaKodu, bankaRef: o.bankaRef, onayKodu: o.onayKodu })) },
    grupOdemeleri: odemeler.map(({ tutar, bankaKodu, bankaAdi, onayKodu, taksit, kartNo }) => ({ tutar, bankaKodu, bankaAdi, onayKodu, taksit, kartNo })),
    ...ek,
  };
};

const retSonucu = (tur: HataTuru, mesaj: string, documentId: string): SurucuSonuc => ({
  durum: tur === "vazgecme" ? "IPTAL" : "RET",
  hata: mesaj,
  ham: { documentId },
  grupOdemeleri: [],
});

// ─── Arka plan tahsilatı ────────────────────────────────────────────────────

interface Gorev {
  seri: string;
  zaman: number;
  sonuc: SurucuSonuc | null;
}

const gorevler = new Map<string, Gorev>();

const gorevleriTemizle = () => {
  const simdi = Date.now();
  for (const [k, g] of gorevler) if (g.sonuc && simdi - g.zaman > GOREV_OMRU_MS) gorevler.delete(k);
};

/** Açık belgeyi cihazda iptal eder (kart çekilmemişse). Sonuç önemsenmez; günlüğe yazılır. */
const belgeyiBirak = async (seri: string, documentId: string) => {
  try {
    await istek(seri, `Hugin belge iptal ${documentId}`, "POST", `/v1/documents/${encodeURIComponent(documentId)}/cancel`);
  } catch {
    // günlükte
  }
};

/**
 * Kağıt bitti / pil düşük (206): kart çekildi ama belge kapanmadı. Kasiyer sorunu giderene kadar belge kapanışı
 * arka planda yeniden denenir (önce "Aktif Belge Devam", sonra aynı kapanış). Sunucu yeniden başlarsa durur.
 */
const kapanisiTamamla = (seri: string, documentId: string, govde: unknown) => {
  const bitis = Date.now() + KAPANIS_SURE_MS;
  const dene = async () => {
    try {
      await istek(seri, `Hugin belge devam ${documentId}`, "POST", `/v1/documents/${encodeURIComponent(documentId)}/resume`);
      const { durum, veri } = await istek(seri, `Hugin belge kapanış (tekrar) ${documentId}`, "PUT", `/v1/documents/${encodeURIComponent(documentId)}`, govde, KART_MS);
      const kod = huginHataOku(veri).kod;
      if (durum === 200 || kod === "DOCUMENT_ALREADY_CLOSED") return;
    } catch {
      // günlükte
    }
    if (Date.now() < bitis) setTimeout(() => void dene(), kapanisTekrarMs);
    else logger.warn(`[POS] Hugin belgesi ${documentId} (cihaz ${seri}) kapatılamadı; cihazda açık belge var, cihazdan tamamlanmalı.`);
  };
  setTimeout(() => void dene(), kapanisTekrarMs);
};

/** Açık belgede alınmış kart ödemeleri (cihaz durumundan, önbelleksiz). Cihaza sorulamazsa null. */
const aktifBelgeOdemeleri = async (seri: string, documentId: string): Promise<ReturnType<typeof huginOdemeCoz>[] | null> => {
  try {
    const { durum, veri } = await istek(seri, `Hugin durum (kapanış hatası) ${documentId}`, "GET", "/v1/status");
    if (durum >= 400) return null;
    const g = govdeAl(veri);
    const belge = g.activeDocument?.documentId === documentId ? g.activeDocument : (Array.isArray(g.lastDocuments) ? g.lastDocuments : []).find((d: any) => d?.documentId === documentId);
    return (Array.isArray(belge?.eftPayments) ? belge.eftPayments : []).map((o: any) => huginOdemeCoz(o, 0)).filter((o: GrupOdemesi) => o.tutar > 0);
  } catch {
    return null;
  }
};

/** Kartları çeker ve belgeyi kapatır. Her durumda bir sonuç döner (hata fırlatmaz). */
export const huginTahsilEt = async (i: SurucuIstek, seri: string, documentId: string): Promise<SurucuSonuc> => {
  let departmanlar: HuginDepartman[] | null = null;
  try {
    departmanlar = (await cihazAyari(seri)).departmanlar;
  } catch {
    departmanlar = null;
  }
  const { kartlar, kapanis } = huginBelgesi(i, departmanlar);
  const yol = `/v1/documents/${encodeURIComponent(documentId)}`;
  const alinanlar: ReturnType<typeof huginOdemeCoz>[] = [];

  // Birden çok kart: her kart ayrı okutulur, sonra belge kapanır
  if (kartlar.length > 1) {
    for (let n = 0; n < kartlar.length; n++) {
      let y: Yanit;
      try {
        y = await istek(seri, `Hugin kart ${n + 1}/${kartlar.length} ${documentId}`, "POST", `${yol}/payments/EFT_POS`, { amount: tutarYaz(kartlar[n]), detailedResponse: true }, KART_MS);
      } catch (err: any) {
        // Cevap gelmedi: kartın çekilip çekilmediği bilinmiyor → sonuç verilmez, işlem Belirsiz'e düşer (K10)
        return { durum: "RET", hata: `${err?.message || err}`, ham: { documentId, belirsiz: true }, grupOdemeleri: [] };
      }
      if (y.durum !== 200) {
        const tur = huginHataTuru(y.durum, y.veri);
        const mesaj = hataMetni(y.durum, y.veri, `${n + 1}. kart ${tur === "vazgecme" ? "cihazda iptal edildi." : "alınamadı."}`);
        if (!alinanlar.length) {
          await belgeyiBirak(seri, documentId);
          return retSonucu(tur, mesaj, documentId);
        }
        // Önceki kartlar çekildi: para alındığı için onaylı yazılır, kalan satırlar ret olur. Belge cihazda açık kalır.
        return sonucYap(alinanlar, null, documentId, { hata: `${mesaj} Cihazda belge açık kaldı: kalan tutarı cihazdan tamamlayın ya da belgeyi cihazdan iptal edin.` });
      }
      alinanlar.push(huginOdemeCoz(govdeAl(y.veri), kartlar[n]));
    }
  }

  let y: Yanit;
  try {
    y = await istek(seri, `Hugin belge kapanış ${documentId}`, "PUT", yol, kapanis, KART_MS);
  } catch (err: any) {
    return { durum: "RET", hata: `${err?.message || err}`, ham: { documentId, belirsiz: true }, grupOdemeleri: [] };
  }
  const g = govdeAl(y.veri);

  if (y.durum === 200) {
    const odemeler = kartlar.length > 1 ? alinanlar : [huginOdemeCoz(g.eftPayment || g.payment || {}, kartlar[0])];
    return sonucYap(odemeler, y.veri, documentId);
  }
  if (y.durum === 206) {
    // Kart çekildi, belge kapanmadı (kağıt / pil). Yanıt yalnız ödeme bilgisidir.
    const odemeler = kartlar.length > 1 ? alinanlar : [huginOdemeCoz(g.eftPayment || g, kartlar[0])];
    kapanisiTamamla(seri, documentId, kapanis);
    return sonucYap(odemeler, null, documentId, { hata: "Kart çekildi ama cihaz bilgi fişini basamadı (kağıt / pil). Sorun giderilince belge kendiliğinden tamamlanır; olmazsa cihazdan tamamlayın." });
  }
  const tur = huginHataTuru(y.durum, y.veri);
  if (kartlar.length > 1) {
    // Kartlar çekildi ama belge kapanmadı (veri hatası vb.): para alındı
    return sonucYap(alinanlar, null, documentId, { hata: hataMetni(y.durum, y.veri, "Kartlar çekildi ama belge cihazda kapatılamadı; cihazdan tamamlayın.") });
  }
  if (tur !== "ret" && tur !== "vazgecme") {
    // Tek kartta kart, kapanış isteğinin içinde okunur: hata kart çekildikten sonra da gelmiş olabilir. Cihaza sorulur;
    // kart alınmışsa para alınmıştır (onay + uyarı), belge bırakılmaz. Sorulamazsa sonuç verilmez (Belirsiz, K10).
    const alinan = await aktifBelgeOdemeleri(seri, documentId);
    if (alinan === null) return { durum: "RET", hata: hataMetni(y.durum, y.veri, "Belge kapatılamadı."), ham: { documentId, belirsiz: true }, grupOdemeleri: [] };
    if (alinan.length) return sonucYap(alinan, null, documentId, { hata: hataMetni(y.durum, y.veri, "Kart çekildi ama belge cihazda kapatılamadı; cihazdan tamamlayın.") });
  }
  await belgeyiBirak(seri, documentId);
  return retSonucu(tur, hataMetni(y.durum, y.veri, tur === "ret" ? (kartZamanAsimi(y.veri) ? "Kart zamanında okutulmadı." : "Kart reddedildi.") : tur === "vazgecme" ? "Cihazda vazgeçildi." : "Cihaz satışı tamamlamadı."), documentId);
};

/** Belirsiz sonuç (bağlantı koptu): pos.service'e "henüz sonuç yok" demek için null'a çevrilir. */
const belirsizMi = (s: SurucuSonuc): boolean => Boolean((s.ham as any)?.belirsiz);

// ─── Cihaz durumundan sonuç bulma ───────────────────────────────────────────

const durumOnbellegi = new Map<string, { zaman: number; veri: any }>();

/**
 * GET /v1/status cevabından bir belgenin sonucunu çıkarır: aktif belgeyse null (hâlâ sürüyor), son 3 belgede
 * COMPLETED ise onay (kart tutarlarıyla), CANCELLED ise iptal; hiç yoksa null.
 */
export const huginDurumdanSonuc = (veri: any, documentId: string): SurucuSonuc | null => {
  const g = govdeAl(veri);
  if (g.activeDocument?.documentId === documentId) return null;
  const belge = (Array.isArray(g.lastDocuments) ? g.lastDocuments : []).find((d: any) => d?.documentId === documentId);
  if (!belge) return null;
  const durum = String(belge.documentStatus || "").toUpperCase();
  if (durum === "CANCELLED") return { durum: "IPTAL", hata: "Belge cihazda iptal edildi.", ham: { documentId, durum }, grupOdemeleri: [] };
  if (durum !== "COMPLETED") return null;
  const odemeler = (Array.isArray(belge.eftPayments) ? belge.eftPayments : []).map((o: any) => huginOdemeCoz(o, 0)).filter((o: GrupOdemesi) => o.tutar > 0);
  return sonucYap(odemeler, null, documentId);
};

const cihazDurumu = async (seri: string): Promise<any> => {
  const o = durumOnbellegi.get(seri);
  if (o && Date.now() - o.zaman < DURUM_ARALIK_MS) return o.veri;
  const { durum, veri } = await istek(seri, `Hugin durum ${seri}`, "GET", "/v1/status");
  if (durum >= 400) throw new ApiError(HttpStatus.BAD_GATEWAY, hataMetni(durum, veri, "Cihaz durumu okunamadı."));
  durumOnbellegi.set(seri, { zaman: Date.now(), veri });
  return veri;
};

// ─── Sürücü ─────────────────────────────────────────────────────────────────

export const HuginSurucu: PosSurucu = {
  async gonder(i: SurucuIstek) {
    const seri = huginSeri(i.terminal);
    const { durum, veri } = await istek(seri, `Hugin belge başlat ${i.islem.posIslemId}`, "POST", "/v1/documents", { docCategory: "SALE" });
    if (durum >= 400) {
      const tur = huginHataTuru(durum, veri);
      if (tur === "mesgul") throw new ApiError(HttpStatus.CONFLICT, hataMetni(durum, veri, "Cihaz şu anda başka bir işlemde ya da açık belgesi var."));
      if (tur === "baglanti") throw new ApiError(HttpStatus.BAD_GATEWAY, hataMetni(durum, veri, "Cihaz Hugin Gateway'e bağlı değil."));
      throw new ApiError(HttpStatus.BAD_GATEWAY, hataMetni(durum, veri, "Cihazda satış belgesi açılamadı."));
    }
    const documentId = yaz(govdeAl(veri).documentId);
    if (!documentId) throw new ApiError(HttpStatus.BAD_GATEWAY, "Cihaz belge kimliği döndürmedi.");

    gorevleriTemizle();
    const gorev: Gorev = { seri, zaman: Date.now(), sonuc: null };
    gorevler.set(documentId, gorev);
    void huginTahsilEt(i, seri, documentId)
      .catch((err: any): SurucuSonuc => ({ durum: "RET", hata: `${err?.message || err}`, ham: { documentId, belirsiz: true }, grupOdemeleri: [] }))
      .then(async (sonuc) => {
        gorev.sonuc = sonuc;
        gorev.zaman = Date.now();
        // Cevap alınamadıysa sonuç yazılmaz; işlem süre dolunca Belirsiz olur, sorgula cihaz durumundan bulmaya çalışır
        if (belirsizMi(sonuc) || !i.sonucBildir) return;
        try {
          await i.sonucBildir(sonuc);
        } catch (err: any) {
          logger.warn(`[POS] Hugin sonucu yazılamadı (${documentId}): ${err?.message}`);
        }
      });
    return { ref: documentId };
  },

  async sorgula(islem: PosIslem, terminal: PosTerminal): Promise<SurucuSonuc | null> {
    if (!islem.surucuRef) return null;
    const g = gorevler.get(islem.surucuRef);
    if (g) {
      // Bu sunucuda sürüyor ya da bitti (bildirim yazılamadıysa sonuç buradan da alınır)
      if (!g.sonuc) return null;
      if (!belirsizMi(g.sonuc)) return g.sonuc;
    }
    // Bu sunucuda kaydı yok (yeniden başladı) ya da cevap alınamadı: cihazın son belgelerine bakılır
    return huginDurumdanSonuc(await cihazDurumu(huginSeri(terminal)), islem.surucuRef);
  },

  async iptal(islem: PosIslem, terminal: PosTerminal) {
    if (!islem.surucuRef) return;
    const seri = huginSeri(terminal);
    const { durum, veri } = await istek(seri, `Hugin belge iptal ${islem.surucuRef}`, "POST", `/v1/documents/${encodeURIComponent(islem.surucuRef)}/cancel`);
    const kod = huginHataOku(veri).kod;
    if (durum === 200 || durum === 404 || kod === "DOCUMENT_ALREADY_CANCELLED" || kod === "DOCUMENT_NOT_FOUND") return;
    // Kart okutma sürerken cihaz meşguldür; kart çekildiyse belge iptal edilemez
    throw new ApiError(HttpStatus.CONFLICT, hataMetni(durum, veri, "Cihazdaki belge iptal edilemedi."));
  },

  async baglantiTesti(terminal: PosTerminal) {
    const seri = huginSeri(terminal);
    const { durum, veri } = await istek(seri, `Hugin bağlantı ${seri}`, "GET", `/v1/tsm/devices/${encodeURIComponent(seri)}`);
    if (durum >= 400) throw new ApiError(HttpStatus.BAD_GATEWAY, hataMetni(durum, veri, `Cihaz ${seri} Gateway'de görünmüyor.`));
    const b = govdeAl(veri);
    const ayar = await cihazAyari(seri, true);
    const uyarilar: string[] = [];
    if (!ayar.departmanlar.some((d) => d.kdv === TEK_SATIR_KDV)) uyarilar.push("cihazda %0 KDV'li departman yok (kuyum satırları için tanımlanmalı)");
    if (ayar.eBelgeKullanicisi) uyarilar.push("cihazda e-Belge kullanıcısı işaretli — faturanın cihazdan ikinci kez kesilmediği Hugin'le teyit edilmeli");
    const bankalar = ayar.bankalar.map((x) => x.ad || String(x.id)).join(", ");
    return [
      `Cihaz ${seri} Gateway'e bağlı (${yaz(b.status) || "durum yok"}${b.lastPongAt ? `, son yanıt ${b.lastPongAt}` : ""}).`,
      ayar.vkn ? `İşyeri VKN ${ayar.vkn}.` : null,
      ayar.departmanlar.length ? `Departmanlar: ${ayar.departmanlar.map((d) => `${d.ad} %${d.kdv}`).join(", ")}.` : "Cihazda departman bulunamadı.",
      bankalar ? `Bankalar: ${bankalar}.` : null,
      ayar.lisansBitis ? `PC Link lisansı ${ayar.lisansBitis} tarihine kadar.` : null,
      uyarilar.length ? `Uyarı: ${uyarilar.join("; ")}.` : null,
    ]
      .filter(Boolean)
      .join(" ");
  },

  async gunSonu(terminal: PosTerminal) {
    const seri = huginSeri(terminal);
    const { durum, veri } = await istek(seri, `Hugin Z raporu ${seri}`, "POST", "/v1/reports/Z", undefined, Z_MS);
    if (durum >= 400) {
      const kod = huginHataOku(veri).kod;
      if (kod === "ERR_OPEN_DOCUMENT") throw new ApiError(HttpStatus.CONFLICT, "Cihazda açık belge var; Z raporundan önce açık belge kapatılmalı (cihazdan tamamlayın ya da iptal edin).");
      throw new ApiError(HttpStatus.BAD_GATEWAY, hataMetni(durum, veri, "Z raporu alınamadı."));
    }
    const g = govdeAl(veri);
    const { zNo } = huginFisNo(g.reportHeader?.receiptNo);
    return [`Z raporu alındı${zNo ? ` (Z no ${zNo})` : ""}.`, g.topSat ? `Satış toplamı ${g.topSat}.` : null, "Banka gün sonu Z ile birlikte cihazda alınır."].filter(Boolean).join(" ");
  },
};

/** Yönetim panelindeki "Kimliği Dene": tsmToken cihaz başına kullanılır, burada yalnız ayarların tamlığı sınanır. */
export const huginKimlikTesti = async (): Promise<string> => {
  const a = await ayarKaynagi();
  return `Hugin ayarları tamam (Gateway ${a.gwUrl}, yazılım kimliği ${a.yazilimId}, donanım kimliği ${a.donanimId}). Erişim anahtarı cihaz başına alınır; Test Konsolu'nda bir Hugin cihazı seçip "Bağlantı (gerçek cihaz)" ile deneyin.`;
};

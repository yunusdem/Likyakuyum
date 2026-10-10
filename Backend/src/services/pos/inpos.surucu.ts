import crypto from "crypto";
import { env } from "../../config/env.config.js";
import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { PosAdminSqlRepository } from "../../models/admin/posAdminSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { sifreCoz, sifrele } from "../../utils/kripto.utils.js";
import { GrupOdemesi, PesinOdeme, PosIslem, PosKalem, PosSurucu, PosTerminal, SurucuIstek, SurucuSonuc } from "./pos.types.js";

/**
 * Inpos M530 sürücüsü — TSM Entegrasyon API'si (bulut, "inPOS.TMS.IntegrationAPI").
 * Kaynak: Inpos portalındaki swagger (docs/POS_ENTEGRASYON_YOL_HARITASI.md §0b). Mağazaya köprü kurulmaz (K34).
 *
 * Akış: sunucu fişi "sipariş" olarak TSM'ye yazar (fiş başına TEK sipariş; nakit / havale / cari kısmı "önceden
 * tahsil edilmiş" gider, kart tutarı cihazda alınır) → sipariş cihazın ekranında listelenir → kasiyer seçer (LOCKED)
 * → kart okutulur, bilgi fişi basılır (CLOSED) → sonuç "Sipariş Durum Güncelleme" webhook'uyla bize gelir; gelmezse
 * sorgula() siparişi TSM'den okur. Dönen ödemeler aynı fişin POS satırlarına tutara göre dağıtılır (pos.service).
 *
 * Gerçek M530 test cihazıyla denendi (09–10.10.2026): tek / iki kart, nakit + kart, vazgeçme, internetsiz, meşgul,
 * webhook. Belgede olmayanlar (kart reddi bildirimi, iade, canlı adres) Inpos'a soruldu.
 */

const ZAMAN_ASIMI_MS = 20_000;
/** JWT süresi dolmadan bu kadar önce yenilenir */
const ERISIM_PAYI_SN = 120;
const ESLESME_ONBELLEK_MS = 10 * 60 * 1000;

/** Kalemler verilemediğinde bilgi fişindeki tek satırın KDV oranı (kuyumda altın bedeli istisna). */
const KALEM_KDV = 0;
/** TSM'nin kabul ettiği KDV oranları (swagger: "0, 1, 10 ya da 20"); başka oran siparişi reddettirir. */
const GECERLI_KDV = new Set([0, 1, 10, 20]);
/** Bilgi fişi kopya sayısı (swagger document.slipCount; boş bırakılırsa cihaz 2 basar). */
const FIS_KOPYA = 1;
/**
 * Aynı sipariş en fazla bu aralıkla sorgulanır. Swagger: getOrderById'nin periyodik çağrılması limit aşımına ve
 * yavaşlamaya yol açar; sonuç için webhook önerilir. Sonuç asıl olarak "Sipariş Durum Güncelleme" bildirimiyle gelir,
 * sorgu yalnız bildirim ulaşmazsa yedek yoldur.
 */
const SORGU_ARALIK_MS = 10_000;

/** TSM'nin ödeme tipleri (PaymentTypeEnum) */
const ODEME_TIPI = { kart: "CreditCardPayment", nakit: "CashPayment", havale: "MoneyTransfer", cari: "OpenAccount" } as const;
/** Bilgi fişi belge tipleri (OrderDocumentTypeEnum) */
const BELGE_TIPI = { efatura: "EFatura", earsiv: "EArsiv" } as const;

/** Aracı banka kodları (swagger AcquirerInfoResponse + Inpos SDK Acquirer listesi) */
export const INPOS_BANKALARI: Record<number, string> = {
  1: "Merkez Bankası",
  10: "Ziraat Bankası",
  12: "Halkbank",
  15: "Vakıfbank",
  32: "TEB",
  46: "Akbank",
  59: "Şekerbank",
  62: "Garanti BBVA",
  64: "İş Bankası",
  67: "Yapı Kredi",
  111: "QNB Finansbank",
  134: "Denizbank",
  135: "Anadolubank",
  203: "Albaraka Türk",
  205: "Kuveyt Türk",
};

interface InposAyar {
  apiUrl: string;
  kullanici: string;
  sifre: string;
}

interface Eslesme {
  id: string;
  taxPayerNo: string | null;
  taxPayerTitle: string | null;
  name: string | null;
  csn: string[];
}

const kok = (url: string): string => url.trim().replace(/\/+$/, "");
const para = (n: number): number => Math.round(n * 100) / 100;

const ayarOku = async (): Promise<InposAyar> => {
  const a = await PosAdminSqlRepository.ayarGetir();
  const sifre = sifreCoz(a?.inposSifreSifreli);
  if (!a?.inposApiUrl || !a.inposKullanici || !sifre) {
    throw ApiError.badRequest("Inpos TSM bilgileri tanımlı değil. Yönetim panelinde POS Entegrasyonu > Ayarlar bölümünden servis adresi, kullanıcı adı ve şifre girilmelidir.");
  }
  return { apiUrl: kok(a.inposApiUrl), kullanici: a.inposKullanici, sifre };
};

const http = async (ozet: string, url: string, metod: string, basliklar: Record<string, string>, govde?: unknown): Promise<{ durum: number; veri: any }> => {
  const kontrol = new AbortController();
  const zamanlayici = setTimeout(() => kontrol.abort(), ZAMAN_ASIMI_MS);
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
      veri = { detail: metin.slice(0, 300) };
    }
    // Günlüğe kimlik bilgisi yazılmaz (giriş isteğinin gövdesi de yazılmaz)
    const gunlukIstek = govde !== undefined && !/login/i.test(url) ? govde : null;
    const gunlukYanit = /login/i.test(url) ? { durum: yanit.status } : veri;
    await PosAdminSqlRepository.logYaz({ tur: "ISTEK", ozet: `${ozet} → ${yanit.status}`, istek: gunlukIstek, yanit: gunlukYanit, basarili: yanit.status < 400 });
    return { durum: yanit.status, veri };
  } catch (err: any) {
    const mesaj = err?.name === "AbortError" ? "Inpos servisi yanıt vermedi (zaman aşımı)." : `Inpos servisine ulaşılamadı: ${err?.message || err}`;
    await PosAdminSqlRepository.logYaz({ tur: "ISTEK", ozet: `${ozet} → ulaşılamadı`, yanit: mesaj, basarili: false });
    throw new ApiError(HttpStatus.BAD_GATEWAY, mesaj);
  } finally {
    clearTimeout(zamanlayici);
  }
};

/** TSM hata gövdesi (ProblemDetails): title / detail */
const inposHatasi = (durum: number, veri: any, varsayilan: string): ApiError => {
  const ayrinti = [veri?.title, veri?.detail].filter((x) => typeof x === "string" && x.trim()).join(": ");
  return new ApiError(durum === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY, ayrinti ? `${varsayilan} ${ayrinti}` : `${varsayilan} (${durum})`);
};

/** Portal kullanıcı adı + şifre ile JWT alır ve merkezde şifreli saklar. */
const girisYap = async (a: InposAyar): Promise<string> => {
  const { durum, veri } = await http("Inpos giriş", `${a.apiUrl}/api/login`, "POST", {}, { email: a.kullanici, password: a.sifre });
  const erisim = veri?.accessToken || veri?.token;
  if (durum >= 400 || !erisim) {
    throw new ApiError(HttpStatus.BAD_GATEWAY, `Inpos servisi kimliği kabul etmedi (${durum}). Yönetim panelindeki kullanıcı adı / şifre kontrol edilmelidir.`);
  }
  const omur = Math.max(Number(veri.expiresIn) || 3600, 300) - ERISIM_PAYI_SN;
  await PosAdminSqlRepository.inposErisimYaz(sifrele(String(erisim)), Math.max(omur, 120));
  return String(erisim);
};

const erisimAnahtari = async (a: InposAyar): Promise<string> => sifreCoz(await PosAdminSqlRepository.inposErisimGetir()) || (await girisYap(a));

const sorguYaz = (sorgu?: Record<string, string | number | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sorgu || {})) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

/** Erişim anahtarı TSM tarafında düşmüşse bir kez yenileyip yeniden dener. */
const istek = async (ozet: string, metod: "GET" | "POST", yol: string, govde?: unknown, sorgu?: Record<string, string | number | undefined>): Promise<{ durum: number; veri: any }> => {
  const a = await ayarOku();
  const url = `${a.apiUrl}${yol}${sorguYaz(sorgu)}`;
  let { durum, veri } = await http(ozet, url, metod, { Authorization: `Bearer ${await erisimAnahtari(a)}` }, govde);
  if (durum === 401) {
    await PosAdminSqlRepository.inposErisimYaz(null, 0);
    ({ durum, veri } = await http(ozet, url, metod, { Authorization: `Bearer ${await girisYap(a)}` }, govde));
  }
  return { durum, veri };
};

// ─── Eşleşmeler (şube ↔ cihazlar) ───────────────────────────────────────────

let eslesmeOnbellegi: { zaman: number; liste: Eslesme[] } | null = null;

const eslesmeleriGetir = async (yenile: boolean): Promise<Eslesme[]> => {
  if (!yenile && eslesmeOnbellegi && Date.now() - eslesmeOnbellegi.zaman < ESLESME_ONBELLEK_MS) return eslesmeOnbellegi.liste;
  const { durum, veri } = await istek("Inpos eşleşmeler", "GET", "/api/getMatches");
  if (durum >= 400 || !Array.isArray(veri)) throw inposHatasi(durum, veri, "Inpos eşleşme listesi alınamadı.");
  const liste: Eslesme[] = veri.map((m: any) => ({
    id: String(m?.id || ""),
    taxPayerNo: m?.taxPayerNo ? String(m.taxPayerNo) : null,
    taxPayerTitle: m?.taxPayerTitle ? String(m.taxPayerTitle) : null,
    name: m?.name ? String(m.name) : null,
    csn: (Array.isArray(m?.csn) ? m.csn : []).map((c: unknown) => String(c).trim().toUpperCase()),
  }));
  eslesmeOnbellegi = { zaman: Date.now(), liste };
  return liste;
};

/** Cihaz sicil numarası (CSN): cihaz tanımındaki terminal kimliği, yoksa sicil no. */
export const inposCsn = (t: PosTerminal): string => {
  const csn = (t.terminalKimlik || t.sicilNo || "").trim().toUpperCase();
  if (!csn) throw ApiError.badRequest(`"${t.ad}" cihazının sicil numarası (CSN) tanımlı değil. Banka › POS Cihazları'nda Terminal Kimliği alanına cihazın sicil numarasını yazın.`);
  return csn;
};

/** Cihazın lisanslı olduğu eşleşme (şube). Önbellekte yoksa liste bir kez yenilenir. */
const eslesmeBul = async (csn: string): Promise<Eslesme> => {
  let liste = await eslesmeleriGetir(false);
  let e = liste.find((m) => m.csn.includes(csn));
  if (!e) {
    liste = await eslesmeleriGetir(true);
    e = liste.find((m) => m.csn.includes(csn));
  }
  if (!e) throw ApiError.badRequest(`Cihaz ${csn} Inpos'ta bu hesaba lisanslı görünmüyor. Inpos portalı › Lisanslar bölümünü ve cihaz tanımındaki sicil numarasını kontrol edin.`);
  return e;
};

// ─── Sipariş ────────────────────────────────────────────────────────────────

const pesinTipi = (tur: PesinOdeme["tur"]): string => ODEME_TIPI[tur];

/**
 * Bilgi fişi kalemleri: fiş satırları toplamı sipariş toplamını tutuyor ve oranlar TSM'nin kabul ettikleriyse satırlar,
 * değilse tek satır. Tutar KDV dahil. Kısım (section) hiçbir satırda gönderilmez.
 */
export const inposKalemleri = (kalemler: PosKalem[] | undefined, toplam: number) => {
  const tek = [{ name: "Fatura toplamı", unitPrice: toplam, vat: KALEM_KDV, quantity: 1, unit: "adet" }];
  if (!kalemler?.length) return tek;
  const kalemToplam = para(kalemler.reduce((t, k) => t + k.tutar, 0));
  if (Math.abs(kalemToplam - toplam) > 0.011) return tek;
  // TSM yalnız 0 / 1 / 10 / 20 kabul eder (eski %18 / %8 oranlı fiş "geçersiz KDV oranı" ile reddedilirdi)
  if (kalemler.some((k) => !GECERLI_KDV.has(Math.round(k.kdvOrani)))) return tek;
  // Kısım gönderilmez: M530'da her kısmın sabit KDV oranı var; kısım verilince oran tutmazsa cihaz "geçersiz KDV oranı" der.
  // Cihaz, orana uyan kısmı kendisi seçer (cihazda o oranda bir kısım tanımlı olmalı).
  return kalemler.map((k) => ({
    name: k.ad.slice(0, 100),
    unitPrice: para(k.tutar / k.miktar),
    vat: Math.round(k.kdvOrani),
    quantity: k.miktar,
    unit: "adet",
  }));
};

/** Fiş başına tek sipariş. Tutarlar TL (iki ondalık). */
export const inposSiparisi = (i: SurucuIstek, matchId: string, csn: string) => {
  const islemler = i.grup?.islemler.length ? i.grup.islemler : [i.islem];
  const pesinler = (i.grup?.pesinOdemeler || []).filter((p) => p.tutar > 0);
  const kart = para(islemler.reduce((t, x) => t + x.tutar, 0));
  const toplam = para(kart + pesinler.reduce((t, p) => t + p.tutar, 0));
  const belge = i.islem.belgeTipi === "efatura" ? "e-Fatura" : "e-Arşiv Fatura";
  const ad = `${belge}${i.islem.belgeNo ? ` ${i.islem.belgeNo}` : ""}`;
  return {
    matchId,
    csn: [csn],
    name: ad.slice(0, 100),
    no: i.islem.posIslemId,
    // Fatura bizim sistemden çıkar; cihaz yalnızca bilgi fişi basar (K3). Fişin kalemleri verilmiş ve toplamı tutuyorsa
    // kalemler basılır; yoksa tek satır "Fatura toplamı" (A15).
    items: inposKalemleri(i.grup?.kalemler, toplam),
    totalAmount: toplam,
    subtotalAmount: toplam,
    document: {
      type: BELGE_TIPI[i.islem.belgeTipi],
      ...(i.aliciVkn ? { taxNo: i.aliciVkn } : {}),
      ...(i.islem.belgeNo ? { no: i.islem.belgeNo } : {}),
      date: new Date().toISOString(),
      slipCount: FIS_KOPYA,
      deliveryNote: false,
    },
    // Fişte nakit / havale / cari kısmı varsa cihazda "ödenmiş" sayılır; cihaz yalnız kart tutarını çeker
    ...(pesinler.length ? { payments: pesinler.map((p) => ({ type: pesinTipi(p.tur), amount: para(p.tutar) })) } : {}),
    ...(i.aliciAd ? { note: i.aliciAd.slice(0, 200) } : {}),
  };
};

const bankaCoz = (acq: any): { kod: string | null; ad: string | null } => {
  if (acq === null || acq === undefined || acq === "") return { kod: null, ad: null };
  if (typeof acq === "object") {
    const id = Number(acq.id);
    const kod = Number.isFinite(id) && id > 0 ? String(id) : acq.name ? String(acq.name) : null;
    return { kod, ad: acq.name ? String(acq.name) : kod && INPOS_BANKALARI[id] ? INPOS_BANKALARI[id] : kod };
  }
  const id = Number(acq);
  if (Number.isFinite(id) && id > 0) return { kod: String(id), ad: INPOS_BANKALARI[id] || `Banka ${id}` };
  return { kod: String(acq), ad: String(acq) };
};

/**
 * TSM siparişini (getOrderById cevabı ya da webhook gövdesi) işlem sonucuna çevirir.
 * OPEN / LOCKED → null (hâlâ bekleniyor). CLOSED → onay + cihazda alınan kart ödemeleri. ERROR → ret.
 */
/**
 * Anahtarları camelCase'e çevirir (ilk harf küçük, iç içe). Inpos'un webhook gövdesi üst düzeyde küçük harf, iç
 * nesnelerde büyük harf gönderiyor (payments[].Type / Amount / Details.Acquirer, receipt.No / ZNo; 10.10.2026 günlüğü);
 * sorgu cevabı ise hep küçük harf. İkisi aynı biçime getirilir.
 */
export const anahtarlariKucult = (v: any): any => {
  if (Array.isArray(v)) return v.map(anahtarlariKucult);
  if (!v || typeof v !== "object") return v;
  const sonuc: Record<string, any> = {};
  for (const [k, deger] of Object.entries(v)) sonuc[k ? k[0].toLowerCase() + k.slice(1) : k] = anahtarlariKucult(deger);
  return sonuc;
};

export const inposSonucuCoz = (hamSiparis: any): SurucuSonuc | null => {
  const siparis = anahtarlariKucult(hamSiparis);
  const durum = String(siparis?.status || "").toUpperCase();
  if (durum === "OPEN" || durum === "LOCKED" || !durum) return null;
  if (durum === "ERROR") return { durum: "RET", hata: "Cihaz siparişi hata durumuna aldı.", ham: siparis, grupOdemeleri: [] };
  if (durum !== "CLOSED") return { durum: "RET", hata: `Cihazdan beklenmeyen sipariş durumu: ${durum}.`, ham: siparis, grupOdemeleri: [] };

  const odemeler: any[] = Array.isArray(siparis.payments) ? siparis.payments : [];
  const kartlar: GrupOdemesi[] = odemeler
    .filter((o) => String(o?.type || "") === ODEME_TIPI.kart && Number(o?.amount) > 0)
    .map((o) => {
      const b = bankaCoz(o?.details?.acquirer);
      return { tutar: para(Number(o.amount)), bankaKodu: b.kod, bankaAdi: b.ad };
    });
  const yaz = (v: unknown): string | null => (v === undefined || v === null || v === "" ? null : String(v));
  return {
    durum: "ONAY",
    bankaKodu: kartlar[0]?.bankaKodu ?? null,
    bankaAdi: kartlar[0]?.bankaAdi ?? null,
    // Onay kodu, maskeli kart no ve taksit TSM şemasında yok (A13 kapandı)
    cihazFisNo: yaz(siparis?.receipt?.no),
    zNo: yaz(siparis?.receipt?.zNo),
    ham: siparis,
    grupOdemeleri: kartlar,
  };
};

/** Kapanan sipariş cihaz listesinden düşsün (TSM, sipariş kimliğiyle birlikte cihaz CSN'sini de ister). Başarısızlık sonucu etkilemez. */
export const inposSiparisIslendi = async (ref: string, csn: string | null): Promise<void> => {
  if (!csn) return;
  try {
    await istek(`Inpos sipariş işlendi ${ref}`, "POST", "/api/markOrderProcessed", { id: ref, csn });
  } catch {
    // Günlüğe yazıldı; sipariş listede kalır, kasiyer görmezden gelir
  }
};

/** Son sorgu cevabı (sipariş kimliğine göre); süresi geçenler yazarken temizlenir. */
const sorguOnbellegi = new Map<string, { zaman: number; sonuc: SurucuSonuc | null }>();
const sorguOnbellegiYaz = (ref: string, sonuc: SurucuSonuc | null) => {
  const simdi = Date.now();
  for (const [k, v] of sorguOnbellegi) if (simdi - v.zaman >= SORGU_ARALIK_MS) sorguOnbellegi.delete(k);
  sorguOnbellegi.set(ref, { zaman: simdi, sonuc });
};
/** Test için: sorgu önbelleğini boşaltır. */
export const inposSorguOnbelleginiTemizle = () => sorguOnbellegi.clear();

export const InposSurucu: PosSurucu = {
  async gonder(i: SurucuIstek) {
    const csn = inposCsn(i.terminal);
    const eslesme = await eslesmeBul(csn);
    const { durum, veri } = await istek(`Inpos sipariş ${i.islem.posIslemId}`, "POST", "/api/addOrder", inposSiparisi(i, eslesme.id, csn));
    const ref = veri?.id ? String(veri.id) : null;
    if (durum >= 400 || !ref) throw inposHatasi(durum, veri, "Sipariş cihaza gönderilemedi.");
    return { ref };
  },

  async sorgula(islem: PosIslem, terminal: PosTerminal): Promise<SurucuSonuc | null> {
    if (!islem.surucuRef) return null;
    // Pencere 2 sn'de bir yokluyor ve aynı siparişin her kart satırı ayrı soruyor: TSM'ye aynı sipariş için en fazla
    // SORGU_ARALIK_MS'de bir gidilir, arada son cevap verilir (sonuç zaten webhook'la gelir)
    const onceki = sorguOnbellegi.get(islem.surucuRef);
    if (onceki && Date.now() - onceki.zaman < SORGU_ARALIK_MS) return onceki.sonuc;
    const { durum, veri } = await istek(`Inpos sipariş sorgu ${islem.posIslemId}`, "GET", "/api/getOrderById", undefined, { id: islem.surucuRef, csn: inposCsn(terminal) });
    let sonuc: SurucuSonuc | null;
    if (durum === 404) sonuc = { durum: "IPTAL", hata: "Sipariş cihaz servisinde bulunamadı (silinmiş).", grupOdemeleri: [] };
    else if (durum >= 400) throw inposHatasi(durum, veri, "Sipariş sorgulanamadı.");
    // "İşlendi" işareti sonucu satırlara yazan tarafta (pos.service grupSonucunuIsle) bir kez konur; burada da konunca
    // aynı sipariş için iki istek gidiyor, ikincisi 400 dönüyordu (10.10.2026 günlüğü).
    else sonuc = inposSonucuCoz(veri);
    sorguOnbellegiYaz(islem.surucuRef, sonuc);
    return sonuc;
  },

  async iptal(islem: PosIslem) {
    if (!islem.surucuRef) return;
    const { durum, veri } = await istek(`Inpos sipariş sil ${islem.posIslemId}`, "POST", "/api/deleteOrder", { id: islem.surucuRef });
    // 404: sipariş zaten yok. 400: cihazda seçilmiş / ödeniyor (LOCKED) → silinemez
    if (durum === 404) return;
    if (durum >= 400) throw inposHatasi(durum, veri, "Sipariş cihazda işlemde olduğu için silinemedi.");
  },

  async baglantiTesti(terminal: PosTerminal) {
    const csn = inposCsn(terminal);
    const e = await eslesmeBul(csn);
    const sube = [e.taxPayerTitle, e.name].filter(Boolean).join(" / ");
    return `Cihaz ${csn} Inpos'ta lisanslı${sube ? ` (${sube})` : ""}. Sipariş gönderilmeye hazır; cihaz internete bağlı olmalı.`;
  },

  async gunSonu() {
    // TSM entegrasyon API'sinde Z raporu çağrısı yok; Z cihazdan alınır (K22)
    throw new ApiError(HttpStatus.NOT_IMPLEMENTED, "Bu cihazda gün sonu programdan alınamıyor. Z raporunu cihazdan alın.");
  },
};

/** Yönetim panelindeki test konsolu için: kimliği ve lisanslı cihazları sınar. */
export const inposKimlikTesti = async (): Promise<string> => {
  await PosAdminSqlRepository.inposErisimYaz(null, 0);
  await girisYap(await ayarOku());
  const liste = await eslesmeleriGetir(true);
  const cihazlar = liste.flatMap((e) => e.csn);
  return `Inpos kimliği kabul edildi. Lisanslı cihaz: ${cihazlar.length ? cihazlar.join(", ") : "yok"}${liste.length ? ` · şube: ${liste.map((e) => [e.taxPayerTitle, e.name].filter(Boolean).join(" / ")).join("; ")}` : ""}.`;
};

/**
 * Inpos'un sonuç bildirimi (webhook) Basic Auth ile gelir; kullanıcı adı / şifre yönetim panelinde tanımlıdır.
 * Tanımlı değilse hiçbir bildirim kabul edilmez.
 */
export const inposWebhookYetkili = async (authorization: string | undefined): Promise<boolean> => {
  const a = await PosAdminSqlRepository.ayarGetir().catch(() => null);
  const sifre = sifreCoz(a?.inposWebhookSifreSifreli);
  if (!a?.inposWebhookKullanici || !sifre) return false;
  const m = /^Basic\s+(.+)$/i.exec(String(authorization || "").trim());
  if (!m) return false;
  const beklenen = Buffer.from(`${a.inposWebhookKullanici}:${sifre}`, "utf8");
  const gelen = Buffer.from(m[1], "base64");
  return beklenen.length === gelen.length && crypto.timingSafeEqual(beklenen, gelen);
};

/** Portala yazılacak bildirim adresi (yönetim paneli gösterir). */
export const inposWebhookAdresi = (donusKok: string | null | undefined): string | null => {
  const k = kok(donusKok || "");
  return k ? `${k}${env.API_PREFIX}/pos-donus/inpos` : null;
};

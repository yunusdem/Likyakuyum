import { HttpStatus } from "../../constants/httpStatusCodes.js";
import { PosAdminSqlRepository } from "../../models/admin/posAdminSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { sifreCoz, sifrele } from "../../utils/kripto.utils.js";
import { PosIslem, PosSurucu, PosTerminal, SurucuIstek, SurucuSonuc, kurus } from "./pos.types.js";

/**
 * Beko (Token) sürücüsü — TokenX Connect Cloud (kablosuz).
 * Kaynak: https://developer.tokeninc.com → TokenX Connect Cloud geliştirici dokümanı + Postman koleksiyonu.
 *
 * GERÇEK CİHAZLA DENENMEDİ: Token'dan client-id / client-secret gelmeden çalıştırılamaz. Dokümanda açıkça yazmayan ve
 * Token'a sorulan noktalar aşağıda "A2" ile işaretlidir (docs/POS_ENTEGRASYON_YOL_HARITASI.md, Açık konular).
 *
 * Akış: tutar cihaza "anlık sepet" olarak gider; müşteri kartı okutur; sonuç Token'dan bu sunucuya bildirilir
 * (BASKET_COMPLETED). Sorgulayarak sonuç öğrenmenin yolu dokümanda tanımlı olmadığı için sorgula() hep null döner.
 */

const ZAMAN_ASIMI_MS = 20_000;
/** Token'ın ödeme tipi kodları (kablolu dokümandaki tablo): 1 nakit, 3 kredi kartı */
const ODEME_KREDI_KARTI = 3;
/** Bilgi fişi belge tipleri (kablolu dokümandaki tablo). A2: bulut API'de aynı alanla gönderildiği doğrulanacak. */
const BELGE_TIPI_KODU = { efatura: 9006, earsiv: 9007 } as const;

const TOKEN_HATALARI: Record<number, string> = {
  1006: "Cihaz servisinde kayıt bulunamadı.",
  1007: "Bu işlem cihaza daha önce gönderilmiş.",
  1013: "Cihaz servisi gönderilen veriyi kabul etmedi (biçim hatası).",
  1018: "Cihazdaki işlem kilitli.",
  1100: "Cihazda tamamlanmamış bir işlem var. Önce cihazdaki işlemi bitirin ya da iptal edin.",
  1102: "İşlem cihazda zaten tamamlanmış.",
  1103: "Ödeme tutarı ile belge tutarı uyuşmuyor.",
  1104: "Cihaz \"sepet ödemesini hemen al\" modunda değil. Cihazın ayarından anlık modu açın.",
  1105: "İşlemin cihazdaki durumu bu isteğe uygun değil.",
  1106: "Cihaz servis tarafında bulunamadı. Cihaz tanımındaki terminal kimliğini kontrol edin.",
};

interface TokenAyar {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  apiUrl: string;
}

const kok = (url: string): string => url.trim().replace(/\/+$/, "");

const ayarOku = async (): Promise<TokenAyar> => {
  const a = await PosAdminSqlRepository.ayarGetir();
  const clientSecret = sifreCoz(a?.tokenClientSecretSifreli);
  if (!a?.tokenClientId || !clientSecret || !a.tokenAuthUrl || !a.tokenApiUrl) {
    throw ApiError.badRequest("Beko (Token) entegratör bilgileri tanımlı değil. Yönetim panelinde POS Entegrasyonu > Ayarlar bölümünden girilmelidir.");
  }
  return { clientId: a.tokenClientId, clientSecret, authUrl: kok(a.tokenAuthUrl), apiUrl: kok(a.tokenApiUrl) };
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
      veri = { description: metin.slice(0, 300) };
    }
    // Günlüğe kimlik başlıkları yazılmaz
    await PosAdminSqlRepository.logYaz({ tur: "ISTEK", ozet: `${ozet} → ${yanit.status}`, istek: govde ?? null, yanit: veri, basarili: yanit.status < 400 });
    return { durum: yanit.status, veri };
  } catch (err: any) {
    const mesaj = err?.name === "AbortError" ? "Cihaz servisi yanıt vermedi (zaman aşımı)." : `Cihaz servisine ulaşılamadı: ${err?.message || err}`;
    await PosAdminSqlRepository.logYaz({ tur: "ISTEK", ozet: `${ozet} → ulaşılamadı`, istek: govde ?? null, yanit: mesaj, basarili: false });
    throw new ApiError(HttpStatus.BAD_GATEWAY, mesaj);
  } finally {
    clearTimeout(zamanlayici);
  }
};

const tokenHatasi = (durum: number, veri: any): ApiError => {
  const kod = Number(veri?.status);
  const bilinen = TOKEN_HATALARI[kod];
  const ek = typeof veri?.description === "string" ? veri.description : "";
  return new ApiError(HttpStatus.BAD_GATEWAY, bilinen || `Cihaz servisi hata döndürdü (${Number.isFinite(kod) && kod ? kod : durum}).${ek ? ` ${ek}` : ""}`);
};

/** Yeni erişim anahtarı alır ve merkezde şifreli saklar (24 saat geçerli, 1 saat erken yenilenir). */
const girisYap = async (a: TokenAyar): Promise<string> => {
  const temel = Buffer.from(`${a.clientId}:${a.clientSecret}`, "utf8").toString("base64");
  const { durum, veri } = await http("Token kimlik", `${a.authUrl}/v1/auth/token`, "POST", { Authorization: `Basic ${temel}` });
  const erisim = veri?.result?.accessToken;
  if (durum >= 400 || !erisim) {
    throw new ApiError(HttpStatus.BAD_GATEWAY, `Cihaz servisi kimliği kabul etmedi (${durum}). Yönetim panelindeki client-id / client-secret kontrol edilmelidir.`);
  }
  const omur = Math.max(Number(veri.result.expiresIn) || 86400, 600) - 3600;
  await PosAdminSqlRepository.erisimYaz(sifrele(String(erisim)), Math.max(omur, 300));
  return String(erisim);
};

const erisimAnahtari = async (a: TokenAyar): Promise<string> => sifreCoz(await PosAdminSqlRepository.erisimGetir()) || (await girisYap(a));

/** Erişim anahtarı Token tarafında düşmüşse bir kez yenileyip yeniden dener. */
const istek = async (ozet: string, metod: string, yol: string, terminalKimlik: string | null, govde?: unknown): Promise<any> => {
  const a = await ayarOku();
  const basliklar = (erisim: string) => ({ Authorization: `Bearer ${erisim}`, ...(terminalKimlik ? { "terminal-id": terminalKimlik } : {}) });
  let { durum, veri } = await http(ozet, `${a.apiUrl}${yol}`, metod, basliklar(await erisimAnahtari(a)), govde);
  if (durum === 401) {
    await PosAdminSqlRepository.erisimYaz(null, 0);
    ({ durum, veri } = await http(ozet, `${a.apiUrl}${yol}`, metod, basliklar(await girisYap(a)), govde));
  }
  return { durum, veri };
};

const basarili = (durum: number, veri: any): boolean => durum < 400 && Number(veri?.status ?? 0) === 0;

const terminalKimligi = (t: PosTerminal): string => {
  if (!t.terminalKimlik) throw ApiError.badRequest(`"${t.ad}" cihazının terminal kimliği tanımlı değil.`);
  return t.terminalKimlik;
};

/** Cihaza giden sepet. Tutarlar kuruş, miktar binde (1000 = 1 adet), vergi yüzdesi yüzde × 100 cinsindendir. */
export const tokenSepeti = (i: SurucuIstek) => {
  const tutar = kurus(i.islem.tutar);
  const belge = i.islem.belgeTipi === "efatura" ? "e-Fatura" : "e-Arşiv Fatura";
  return {
    basketID: i.islem.istekKimlik,
    title: i.islem.belgeNo || `POS ${i.islem.posIslemId}`,
    note: i.aliciAd || undefined,
    // A2: bulut API'de bilgi fişi belge tipinin bu alanla gönderildiği doğrulanacak
    documentType: BELGE_TIPI_KODU[i.islem.belgeTipi],
    // Fatura bizim sistemden çıkar; cihaz yalnızca bilgi fişi basar (K3). Kısım ve vergi bilgi fişinde hesaba girmez.
    // A2: bilgi fişinde kısım / vergi alanlarının nasıl doldurulacağı doğrulanacak
    items: [{ name: `${belge}${i.islem.belgeNo ? ` ${i.islem.belgeNo}` : ""}`, price: tutar, sectionNo: 1, taxPercent: 0, quantity: 1000 }],
    paymentItems: [{ type: ODEME_KREDI_KARTI, amount: tutar, description: "Kredi kartı" }],
    ...(i.donusAdresi ? { callbackUrl: i.donusAdresi } : {}),
  };
};

/**
 * Token'ın sonuç bildirimini (BASKET_COMPLETED) işlem sonucuna çevirir. Başka bildirim türlerinde null döner.
 * data.status: 0 → tamamlandı, -1 → cihazda vazgeçildi, 99 → kesilen fiş cihazdan iptal edildi.
 */
export const tokenSonucuCoz = (bildirim: any): (SurucuSonuc & { fisIptali: boolean }) | null => {
  if (bildirim?.operation !== "BASKET_COMPLETED" || !bildirim.data) return null;
  const d = bildirim.data;
  const durum = Number(d.status);
  if (durum === 99) return { durum: "IPTAL", hata: "Fiş cihazdan iptal edildi.", ham: bildirim, fisIptali: true };
  if (durum !== 0) return { durum: "IPTAL", hata: "İşlem cihazda iptal edildi.", ham: bildirim, fisIptali: false };

  const odemeler: any[] = Array.isArray(d.paymentItems) ? d.paymentItems : [];
  const kart = odemeler.find((o) => Number(o?.type) === ODEME_KREDI_KARTI) ?? odemeler[0];
  // Banka, Token'ın "operatorId" koduyla gelir; muhasebe POS kartı bu koda göre eşlenir (K15)
  const operator = kart && Number(kart.operatorId) ? String(kart.operatorId) : null;
  const yaz = (v: unknown): string | null => (v === undefined || v === null || v === "" || Number(v) < 0 ? null : String(v));
  return {
    durum: "ONAY",
    bankaKodu: operator,
    bankaAdi: operator ? `Banka ${operator}` : null,
    // A2: taksit sayısı ve banka onay kodunun bildirimde hangi alanla geldiği doğrulanacak (örnek bildirimde yok)
    taksit: Number(kart?.installmentCount ?? kart?.installment) || null,
    onayKodu: yaz(kart?.authCode ?? kart?.TxnNo),
    kartNo: yaz(kart?.maskedPan ?? kart?.cardNo),
    cihazFisNo: yaz(d.receiptNo),
    zNo: yaz(d.zNo),
    ham: bildirim,
    fisIptali: false,
  };
};

export const TokenSurucu: PosSurucu = {
  async gonder(i: SurucuIstek) {
    // Sonuç yalnızca bildirimle gelir; dönüş adresi yoksa para çekilir ama sonucu hiç öğrenemeyiz
    if (!i.donusAdresi) {
      throw ApiError.badRequest("Sunucunun dış adresi tanımlı değil; cihaz sonucu bildiremez. Yönetim panelinde POS Entegrasyonu > Ayarlar bölümünden girilmelidir.");
    }
    const { durum, veri } = await istek(`Token anlık sepet ${i.islem.posIslemId}`, "POST", "/v1/instant-basket", terminalKimligi(i.terminal), tokenSepeti(i));
    // 1007: aynı sepet daha önce gitmiş; ikinci kez çekim başlatılmaz
    if (!basarili(durum, veri) && Number(veri?.status) !== 1007) throw tokenHatasi(durum, veri);
    return { ref: i.islem.istekKimlik };
  },

  async sorgula(): Promise<SurucuSonuc | null> {
    return null;
  },

  async iptal(islem: PosIslem) {
    if (!islem.surucuRef) return;
    const { durum, veri } = await istek(`Token sepet sil ${islem.posIslemId}`, "DELETE", `/v1/basket/${encodeURIComponent(islem.surucuRef)}`, null);
    // 1006: sepet zaten yok
    if (!basarili(durum, veri) && Number(veri?.status) !== 1006) throw tokenHatasi(durum, veri);
  },

  async baglantiTesti(terminal: PosTerminal) {
    const kimlik = terminalKimligi(terminal);
    const { durum, veri } = await istek(`Token terminal ${kimlik}`, "GET", `/v1/terminal/${encodeURIComponent(kimlik)}`, kimlik);
    if (!basarili(durum, veri)) throw tokenHatasi(durum, veri);
    const t = Array.isArray(veri?.result) ? veri.result[0] : veri?.result;
    const mod = Number(t?.mode);
    return mod === 1
      ? `Cihaz bulundu (${kimlik}), anlık modda. Tutar gönderilmeye hazır.`
      : `Cihaz bulundu (${kimlik}) ancak anlık modda değil. Cihazın ayarından "sepet ödemesini hemen al" modu açılmalı.`;
  },

  async gunSonu() {
    // A7: Token'ın bulut dokümanında gün sonu / Z raporu çağrısı yok
    throw new ApiError(HttpStatus.NOT_IMPLEMENTED, "Bu cihazda gün sonu programdan alınamıyor. Gün sonunu cihazdan alın.");
  },
};

/** Yönetim panelindeki test konsolu için: kimliği sınar. */
export const tokenKimlikTesti = async (): Promise<string> => {
  await PosAdminSqlRepository.erisimYaz(null, 0);
  await girisYap(await ayarOku());
  return "Token kimliği kabul edildi, erişim anahtarı alındı.";
};

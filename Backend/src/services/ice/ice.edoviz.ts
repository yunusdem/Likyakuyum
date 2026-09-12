import { escapeXml } from "./ice.client.js";
import { callWithSession } from "./ice.session.js";
import { IceConnectionConfig } from "./ice.types.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";

/**
 * e-Döviz (Döviz Alım/Satım Belgesi) ICE operasyonları.
 *
 * Kaynak: docs/ice/integration-2026-09-09.wsdl
 *
 * ## Doğrulanan noktalar
 *
 * 1. e-Döviz **fatura değildir**; UBL `CreditNote` tabanlı, yetkili müessese belgesidir.
 *    Bu yüzden e-Fatura/e-Arşiv hattından gönderilemez, kendi ucu vardır.
 *
 * 2. `preview_edoviz_basic`, `send_edoviz_basic` ile **aynı girdiyi** (`eDoviz_Belge`)
 *    alır ve yalnızca metin döndürür — yani **mali sonuç doğurmadan** doğrulama
 *    yapılabilir. e-Gider Pusulası'nda olmayan bu güvence burada var; gönderim
 *    öncesi her belge için önizleme çalıştırılır.
 *
 * 3. Alan sırası `eDoviz_Belge` sequence'ı ile birebir aynı olmak zorundadır:
 *    Login_Request_Header, Baslik_Bilgileri, Yetkili_Muessese, Musteri,
 *    Alis_Satis_Bilgileri, Odeme_Bilgileri, Ek_Bilgiler, Komisyon_Bilgileri,
 *    Kiymetli_Maden_Bilgileri, Tutar_Bilgileri, BuyBack, TutarHesaplanmasin.
 */

export interface EDovizTaraf {
  vknTckn?: string;
  pasaportNo?: string;
  unvan?: string;
  ad?: string;
  soyad?: string;
  adres?: string;
  ulke?: string;
  sehir?: string;
  ilce?: string;
  vergiDairesi?: string;
  telefon?: string;
  eposta?: string;
  ticaretSicilNo?: string;
  musteriTuru?: string;
}

export interface EDovizGirdi {
  belgeNo: string;
  uuid: string;
  profileId: string;
  creditNoteTypeCode: string;
  duzenlemeTarihi: string;
  duzenlemeSaati: string;
  notlar?: string[];
  yetkiliMuessese: EDovizTaraf;
  musteri: EDovizTaraf;
  alisSatis: {
    dovizKodu: string;
    dolarKarsilikKuru: number;
    tlKarsilikKuru: number;
    vergiOrani: number;
    vergiTutari: number;
    vergiMatrah: number;
    dovizMiktar: number;
  };
  /**
   * WSDL'de blok isteğe bağlı görünse de içindeki `Odeme_Yontemi` ve
   * `Son_Odeme_Tarihi` zorunlu; ICE blok hiç gelmediğinde null referans hatası
   * verip isteği reddediyor. Bu yüzden her belgede gönderilir.
   */
  odeme: {
    yontemi: "NAKIT" | "EFTHAVALE" | "KREDIKARTIBANKAKARTI" | "DIGER";
    sonOdemeTarihi: string;
    aciklama?: string;
    /** Yetkili Müessese Dosya Numarası — ICE ödeme hesap bloğunda zorunlu tutuyor. */
    yetkiliMuesseseDosyaNo?: string;
  };
  /**
   * İstatistik kodu (TCMB/Hazine döviz işlem istatistiği). ICE bunu belge türüyle
   * (alım/satım) doğrular; gümrük bilgisi olmayan fişte de gönderilmesi gerekir,
   * bu yüzden Ek_Bilgiler'den bağımsız tutulur.
   */
  istatistikNo?: string;
  ekBilgiler?: {
    istatistikNo?: string;
    geldigiUlke?: string;
    gelisNedeni?: string;
    ihracatYabanciSermaye: boolean;
    gumrukBeyanTarihi: string;
    gumrukBeyanNo?: string;
    dbtTarihi: string;
    dbtSayi?: string;
    gmtyTarihi: string;
    gmtySayi?: string;
    vezne?: string;
  };
  komisyon?: { vergiHaric?: number; vergi?: number; dahilToplam?: number };
  /** Kıymetli maden içermeyen döviz işlemlerinde adet sıfır gönderilir. */
  kiymetliMaden?: { ad?: string; adet?: number };
  /** BuyBack (geri alım) komisyonu; yoksa sıfır. */
  buyBackKomisyonTutari?: number;
  tutar: {
    miktar: number;
    kod: string;
    tlKarsilikKuru: number;
    dolarKarsilikKuru: number;
    safAltinKarsiligi: number;
    /**
     * WSDL'de Saf_Altin_Karsiligi ile Vergi_Orani arasında iki metin alanı var
     * (hem üretim hem test sunucusunda). Hiç gönderilmediklerinde .NET tarafında
     * null kalıyor; ICE vergi kodunu tabloda aradığı için null referans veriyor.
     * Döviz alım/satımında uygulanan vergi BSMV'dir (GİB kodu 0021); oran ve
     * tutar fişten gelir, alımda sıfır olabilir.
     */
    vergiAdi: string;
    vergiKodu: string;
    lineExtensionAmount: number;
    taxExclusiveAmount: number;
    taxInclusiveAmount: number;
    payableAmount: number;
    vergiOrani: number;
    vergiMatrahi: number;
    vergiTutari: number;
  };
  /** true ise ICE toplamları yeniden hesaplamaz; gönderdiğimiz tutarlar kullanılır. */
  tutarHesaplanmasin: boolean;
}

export interface IceEDovizSatirSonucu {
  success?: boolean | string;
  shema_is_validate?: boolean | string;
  schematron_is_validate?: boolean | string;
  ettn?: string;
  ID?: string;
  response_message?: string;
}

export interface IceEDovizSonucu {
  success?: boolean | string;
  response_code?: number | string;
  response_message?: string;
  CreditNoteType_responseTypes?: {
    CreditNoteType_responseType?: IceEDovizSatirSonucu | IceEDovizSatirSonucu[];
  };
}

const alan = (ad: string, deger: unknown): string => {
  if (deger === undefined || deger === null) return "";
  const metin = String(deger).trim();
  if (!metin) return "";
  return `<${ad}>${escapeXml(metin)}</${ad}>`;
};

/**
 * Metin alanı: boş olsa da etiket yazılır. ICE (.NET) tarafında XML'de hiç
 * gelmeyen metin `""` değil `null` olur ve sunucu ona dokunduğu anda "Nesne
 * başvurusu bir nesnenin örneğine ayarlanmadı" hatası verir. Boş etiket ise
 * `""` olarak okunur. Tarih ve sayı alanlarında bu yapılmaz: boş `<X></X>`
 * tarih/sayı olarak ayrıştırılamaz; onlar için `alan` kullanılır.
 */
const metin = (ad: string, deger: unknown): string =>
  `<${ad}>${escapeXml(deger === undefined || deger === null ? "" : String(deger).trim())}</${ad}>`;

/** Boş bloğu hiç göndermemek için: içi boşsa etiket de üretilmez. */
const blok = (ad: string, icerik: string): string => (icerik ? `<${ad}>${icerik}</${ad}>` : "");

const tarafXml = (ad: string, t: EDovizTaraf, musteriMi: boolean): string =>
  blok(
    ad,
    metin("Vkn_Tckn", t.vknTckn) +
      (musteriMi ? metin("Pasaport_No", t.pasaportNo) : "") +
      metin("Unvan", t.unvan) +
      metin("Adi", t.ad) +
      metin("Soyadi", t.soyad) +
      metin("Adres", t.adres) +
      metin("Ulke", t.ulke) +
      metin("Sehir", t.sehir) +
      metin("Ilce", t.ilce) +
      metin(musteriMi ? "VergiDairesi" : "Vergi_Dairesi", t.vergiDairesi) +
      metin("Web_Site", "") +
      metin("Telefon", t.telefon) +
      metin("Fax", "") +
      metin("Email", t.eposta) +
      metin("Ticaret_Sicil_No", t.ticaretSicilNo) +
      (musteriMi ? metin("Musteri_Turu", t.musteriTuru) : "")
  );

/**
 * Ek_Bilgiler bloğu. GİB e-Döviz Teknik Kılavuzu (v1.0, 3.12 AdditionalDocumentReference):
 * "Döviz ALIM belgesine ISTATISTIKNO, GELDIGIULKE, GELISNEDENI yazılacaktır. Döviz alım
 * belgesi ihracat ya da yabancı sermaye bedeli için düzenlendiği durumda ek olarak
 * gümrük beyanname / DBT / GMTY tarih-no bilgileri yazılacaktır."
 *
 * Yani bu alanlar yalnızca alım belgesine aittir. SATIM belgesinde gönderilmeleri
 * (boş etiket olarak bile) ICE'de "ISTATISTIKNO ile Belge türü uyumsuzluğu" retine
 * yol açtı; satımda hiç yazılmazlar. Blok ve Ihracat_Yabanci_Sermaye (zorunlu boolean)
 * her belgede gider; tarih alanları yalnızca kaynakta varsa yazılır (uydurulmaz).
 */
const ekBilgilerXml = (g: EDovizGirdi): string => {
  const alim = g.creditNoteTypeCode === "DOVIZALIMBELGESI";
  const e = g.ekBilgiler;
  return (
    `<Ek_Bilgiler>` +
    (alim
      ? metin("Istatistik_No", g.istatistikNo ?? e?.istatistikNo) +
        metin("Geldigi_Ulke", e?.geldigiUlke) +
        metin("Gelis_Nedeni", e?.gelisNedeni)
      : "") +
    `<Ihracat_Yabanci_Sermaye>${alim && e?.ihracatYabanciSermaye ? "true" : "false"}</Ihracat_Yabanci_Sermaye>` +
    (alim
      ? alan("Gumruk_Beyan_Tarihi", e?.gumrukBeyanTarihi) +
        metin("Gumruk_Beyan_No", e?.gumrukBeyanNo) +
        alan("DBT_Tarihi", e?.dbtTarihi) +
        metin("DBT_Sayi", e?.dbtSayi) +
        alan("GMTY_Tarihi", e?.gmtyTarihi) +
        metin("GMTY_Sayi", e?.gmtySayi)
      : "") +
    metin("Vezne", e?.vezne) +
    `</Ek_Bilgiler>`
  );
};

/**
 * `eDoviz_Belge` gövdesini üretir. Alan sırası WSDL sequence'ı ile birebir aynıdır;
 * sıra bozulursa ICE belgeyi reddeder.
 */
export const buildEDovizInnerXml = (loginHeaderXml: string, g: EDovizGirdi): string =>
  `<_eDovizBelge>` +
  loginHeaderXml +
  blok(
    "Baslik_Bilgileri",
    alan("ID", g.belgeNo) +
      alan("UUID", g.uuid) +
      alan("ProfileID", g.profileId) +
      alan("CreditNoteTypeCode", g.creditNoteTypeCode) +
      alan("Duzenleme_Tarihi", g.duzenlemeTarihi) +
      alan("Duzenleme_Saati", g.duzenlemeSaati) +
      // Notlar .NET tarafında dizidir; etiket hiç gelmezse null olur ve sunucu
      // üzerinde döngü kurduğu anda null referans verir. Boş da olsa gönderilir.
      `<Notlar>${(g.notlar || []).map((n) => alan("string", n)).join("")}</Notlar>`
  ) +
  tarafXml("Yetkili_Muessese", g.yetkiliMuessese, false) +
  tarafXml("Musteri", g.musteri, true) +
  blok(
    "Alis_Satis_Bilgileri",
    alan("Doviz_Kodu", g.alisSatis.dovizKodu) +
      alan("Dolar_Karsilik_Kuru", g.alisSatis.dolarKarsilikKuru) +
      alan("TL_Karsilik_Kuru", g.alisSatis.tlKarsilikKuru) +
      alan("Vergi_Orani", g.alisSatis.vergiOrani) +
      alan("Vergi_Tutari", g.alisSatis.vergiTutari) +
      alan("Vergi_Matrah", g.alisSatis.vergiMatrah) +
      alan("Doviz_Miktar", g.alisSatis.dovizMiktar)
  ) +
  blok(
    "Odeme_Bilgileri",
    alan("Odeme_Yontemi", g.odeme.yontemi) +
      alan("Son_Odeme_Tarihi", g.odeme.sonOdemeTarihi) +
      metin("Aciklama", g.odeme.aciklama) +
      // Hesap blokları WSDL'de isteğe bağlı görünür ama ICE nesne olarak okuyor;
      // gelmediğinde null referans verir. Nakit ödemede içerik yoktur, boş gider.
      // "Numarası" etiketindeki Türkçe karakter WSDL'de böyle tanımlı; değiştirilmez.
      // Dosya numarası ICE'de zorunlu ("Yetkili Müessese Dosya Numarası gönderilmek
      // zorundadır"). Alımda ödemeyi yapan, satımda ödeme yapılan taraf müessesedir;
      // ICE hangisini okuduğunu belirtmediği için iki blokta da gönderilir.
      `<Odeme_Yapan_Hesap>${metin("Yetkili_Muessese_Dosya_Numarası", g.odeme.yetkiliMuesseseDosyaNo)}${metin("Sube_Kodu", "")}${metin("Odeme_Aciklamasi", "")}</Odeme_Yapan_Hesap>` +
      `<Odeme_Yapilan_Hesap>${metin("Yetkili_Muessese_Dosya_Numarası", g.odeme.yetkiliMuesseseDosyaNo)}${metin("Sube_Kodu", "")}${metin("Odeme_Aciklamasi", "")}</Odeme_Yapilan_Hesap>`
  ) +
  // Ek_Bilgiler nesnesi ICE tarafında koşulsuz okunuyor; blok hiç gelmezse null
  // referans verir. Blok her zaman gönderilir ama gümrük tarihleri uydurulmaz:
  // tarih alanları yalnızca kaynak fişte varsa yazılır (.NET'te eksik tarih
  // null olmaz, varsayılan değer alır). Metin alanları boş da olsa yazılır.
  ekBilgilerXml(g) +
  // Komisyon, kıymetli maden ve BuyBack blokları her belgede gönderilir. ICE bu
  // blokları koşulsuz okuduğu için blok hiç gelmediğinde null referans hatası
  // veriyor. Komisyonsuz, madensiz ve buyback'siz bir döviz alımında bu alanların
  // gerçek değeri sıfırdır; uydurma veri değil, fişin kendi değeridir.
  blok(
    "Komisyon_Bilgileri",
    alan("Komisyon_Tutar_Vergi_Haric", g.komisyon?.vergiHaric ?? 0) +
      alan("Komisyon_Tutar_Vergi", g.komisyon?.vergi ?? 0) +
      alan("Komisyon_Dahil_Toplam", g.komisyon?.dahilToplam ?? 0)
  ) +
  blok(
    "Kiymetli_Maden_Bilgileri",
    metin("Kiymetli_Maden_Adi", g.kiymetliMaden?.ad) + alan("Adet", g.kiymetliMaden?.adet ?? 0)
  ) +
  blok(
    "Tutar_Bilgileri",
    alan("Miktar", g.tutar.miktar) +
      alan("Kod", g.tutar.kod) +
      alan("TL_Karsilik_Kuru", g.tutar.tlKarsilikKuru) +
    alan("Dolar_Karsilik_Kuru", g.tutar.dolarKarsilikKuru) +
      alan("Saf_Altin_Karsiligi", g.tutar.safAltinKarsiligi) +
      metin("Vergi_Adi", g.tutar.vergiAdi) +
      metin("Vergi_Kodu", g.tutar.vergiKodu) +
      alan("Vergi_Orani", g.tutar.vergiOrani) +
      alan("Vergi_Matrahi", g.tutar.vergiMatrahi) +
      alan("Vergi_Tutari", g.tutar.vergiTutari) +
      alan("LineExtensionAmount", g.tutar.lineExtensionAmount) +
      alan("TaxExclusiveAmount", g.tutar.taxExclusiveAmount) +
      alan("TaxInclusiveAmount", g.tutar.taxInclusiveAmount) +
      alan("PayableAmount", g.tutar.payableAmount)
  ) +
  blok("BuyBack", alan("Komisyon_Tutari", g.buyBackKomisyonTutari ?? 0)) +
  `<TutarHesaplanmasin>${g.tutarHesaplanmasin ? "true" : "false"}</TutarHesaplanmasin>` +
  `</_eDovizBelge>`;

/**
 * `preview_edoviz_basic` — belgeyi ICE'ye **göndermeden** önizler.
 *
 * Mali sonuç doğurmaz; okuma çağrısı sayıldığı için auth hatasında tekrar denenebilir.
 */
export const previewEDoviz = async (
  config: IceConnectionConfig,
  girdi: EDovizGirdi
): Promise<{ onizleme: string }> => {
  const { data } = await callWithSession<any>(config, {
    method: "preview_edoviz_basic",
    buildInnerXml: (loginHeaderXml) => buildEDovizInnerXml(loginHeaderXml, girdi),
    authHatasindaTekrarla: true,
  });

  const onizleme = typeof data === "string" ? data.trim() : '';
  if (!onizleme) {
    throw ApiError.unprocessable("ICE e-Döviz önizlemesi boş döndü; belge doğrulanamadı.");
  }
  // Servis hata metni de döndürebilir; her dolu metin başarılı önizleme değildir.
  const decoded = onizleme.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const belge = /^(?:<!doctype\s+html|<html[\s/>]|%PDF-)/i.test(decoded) ||
    /^(?:<!doctype\s+html|<html[\s/>]|%PDF-)/i.test(Buffer.from(onizleme, 'base64').toString('utf8').trim());
  if (!belge) throw ApiError.unprocessable(`ICE e-Döviz önizlemesi doğrulanamadı: ${onizleme.slice(0, 1000)}`);
  return { onizleme };
};

/**
 * `send_edoviz_basic` — e-Döviz belgesini gönderir.
 *
 * ⚠️ Mali sonuç doğurur. Yazma çağrısıdır: auth hatasında otomatik tekrar KAPALI.
 */
export const sendEDoviz = async (
  config: IceConnectionConfig,
  girdi: EDovizGirdi
): Promise<IceEDovizSonucu> => {
  const { data } = await callWithSession<IceEDovizSonucu>(config, {
    method: "send_edoviz_basic",
    buildInnerXml: (loginHeaderXml) => buildEDovizInnerXml(loginHeaderXml, girdi),
    authHatasindaTekrarla: false,
    timeoutMs: 120_000,
  });
  return data || {};
};

/**
 * `send_edoviz_iptal` — gönderilmiş e-Döviz belgesini iptal eder.
 *
 * ⚠️ Mali sonuç doğurur.
 */
export const sendEDovizIptal = async (
  config: IceConnectionConfig,
  belgeNo: string,
  iptalTarihi: string
): Promise<{ basarili: boolean; mesaj: string }> => {
  const { data } = await callWithSession<any>(config, {
    method: "send_edoviz_iptal",
    buildInnerXml: (loginHeaderXml) =>
      `<sendEDovizRequest>` +
      loginHeaderXml +
      alan("belgeNo", belgeNo) +
      alan("iptalTarihi", iptalTarihi) +
      `</sendEDovizRequest>`,
    authHatasindaTekrarla: false,
    timeoutMs: 120_000,
  });
  return {
    basarili: String(data?.success).toLowerCase() === "true",
    mesaj: data?.response_message ? String(data.response_message) : "",
  };
};

/**
 * `Get_EDoviz_Status` — UUID listesinin ICE'deki durumunu sorgular.
 *
 * Belirsiz kalan gönderimlerde yeniden göndermeden önce buraya bakılır.
 */
export const getEDovizStatus = async (
  config: IceConnectionConfig,
  uuidListesi: string[]
): Promise<any[]> => {
  const { data } = await callWithSession<any>(config, {
    method: "Get_EDoviz_Status",
    buildInnerXml: (loginHeaderXml) =>
      `<Get_EDoviz_Status_Request>` +
      loginHeaderXml +
      `<UUID_List>${uuidListesi.map((u) => alan("string", u)).join("")}</UUID_List>` +
      `</Get_EDoviz_Status_Request>`,
    authHatasindaTekrarla: true,
  });
  // Boş SOAP Result, bu UUID için kayıt olmadığını belirtir. Beklenmeyen veya
  // hata içeren cevapların "kayıt yok" kabul edilmesi tekrar gönderime yol açar.
  // Durum cevabının ham hâli loglanır: isSuccecss/STATUS alanlarının ICE'de ne
  // anlama geldiği belgelenmemiş; filtre kararı bu kayıtlara bakılarak doğrulanır.
  logger.info(`ICE Get_EDoviz_Status ham cevap (${uuidListesi.join(",")}) → ${data === '' ? '<boş>' : JSON.stringify(data).slice(0, 1500)}`);
  if (data === '') return [];
  const kayit = data?.Get_EDoviz_Status_Response;
  if (kayit === undefined || kayit === null) throw ApiError.conflict('ICE e-Döviz durum yanıtı doğrulanamadı. Gönderim durduruldu.');
  if (kayit === '') return [];
  // ICE, tanımadığı UUID'yi de kayıt olarak geri döndürüyor: UUID alanı istekten
  // yankılanıyor, `isSuccecss` false ve durum alanları boş kalıyor. Kaydın varlığını
  // "belge mevcut" saymak hiç gönderilmemiş belgeyi kilitler; bu yüzden yalnızca
  // isSuccecss doğru olan ya da bir durum bilgisi taşıyan kayıtlar gerçek sayılır.
  const dolu = (v: any) => String(v ?? '').trim() !== '';
  return (Array.isArray(kayit) ? kayit : [kayit]).filter(
    (k) => String(k?.isSuccecss).toLowerCase() === 'true' || dolu(k?.STATUS) || dolu(k?.STATUS_DESCRIPTION),
  );
};

/**
 * `GetEDoviz_XML_PDF` — gönderilmiş belgenin XML/PDF çıktısı.
 */
export const getEDovizCikti = async (
  config: IceConnectionConfig,
  ettn: string,
  secenekler: { pdf?: boolean; xml?: boolean } = { pdf: true }
): Promise<{ xml: string | null; pdf: Buffer | null; mesaj: string }> => {
  const { data } = await callWithSession<any>(config, {
    method: "GetEDoviz_XML_PDF",
    buildInnerXml: (loginHeaderXml) =>
      `<GetEDoviz_XML_PDF>` +
      loginHeaderXml +
      alan("ETTN", ettn) +
      `<get_pdf>${secenekler.pdf ? "true" : "false"}</get_pdf>` +
      `<get_xml>${secenekler.xml ? "true" : "false"}</get_xml>` +
      `</GetEDoviz_XML_PDF>`,
    authHatasindaTekrarla: true,
    timeoutMs: 120_000,
  });

  const pdfBase64 = data?.edoviz_pdf ? String(data.edoviz_pdf) : "";
  return {
    xml: data?.edoviz_xml ? String(data.edoviz_xml) : null,
    pdf: pdfBase64 ? Buffer.from(pdfBase64, "base64") : null,
    mesaj: data?.response_message ? String(data.response_message) : "",
  };
};

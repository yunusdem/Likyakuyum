import { ApiError } from "../utils/ApiError.js";
import { logger } from "../utils/logger.js";
import { SureliOnbellek } from "../utils/sureliOnbellek.js";
import { getPoolKey } from "../config/mssql.config.js";
import { FATURA_NO_BICIMI, faturaNoUret } from "../utils/faturaNo.utils.js";
import { EbelgeSeriRepository, SeriBelgeTuru } from "../models/ebelgeSeri.repository.js";
import { isEncryptionConfigured } from "../utils/crypto.utils.js";
import {
  DbContext,
  EbelgeSqlRepository,
  GelenBelgeSatiri,
  GelenListeFiltre,
  SaveEbelgeAyarDto,
} from "../models/ebelgeSql.repository.js";
import {
  GelenFaturaFiltre,
  IceBelgeStatu,
  IceCariAdres,
  getInvoiceCount,
  getInvoiceHtml,
  getInvoicePdf,
  getInvoiceStatusDetail,
  getInvoices,
  getMusteriCariAdresleri,
  getOncekiBelgeAdresi,
  ublTarafAdresi,
  getSonBelgeId,
  getUserListEFatura,
  gonderimSatirlari,
  invoiceCheckValidate,
  invoiceRedKabul,
  parseAmount,
  parseCurrency,
  parseIceDate,
  sendDraftDocumentApproval,
  sendInvoice,
  sendInvoiceTaslak,
  setInvoiceStatus,
} from "./ice/ice.efatura.js";
import {
  getGiderPusulasiCikti,
  sendGiderPusulasi,
} from "./ice/ice.giderpusulasi.js";
import {
  despatchAdviceCheckValidate,
  getDespatchAdviceCikti,
  getDespatchAdviceStatus,
  getDespatchAdvices,
  getUserListDespatchAdvice,
  irsaliyeGonderimSatirlari,
  sendDespatchAdvice,
} from "./ice/ice.irsaliye.js";
import {
  buildDespatchAdviceXml,
  type IrsaliyeGirdi,
} from "./ice/ubl/despatchAdviceBuilder.js";
import {
  buildGiderPusulasiXml,
  type GiderPusulasiGirdi,
} from "./ice/ubl/giderPusulasiBuilder.js";
import { buildMustahsilXml, type MustahsilGirdi } from "./ice/ubl/mustahsilBuilder.js";
import { cancelMustahsil, getProducerReceipts, sendMustahsil, setProducerReceiptStatus, validateMustahsil } from "./ice/ice.mustahsil.js";
import {
  getEarsivMailStatu,
  getEArchive,
  setEArchiveStatus,
  getEarsivRaporStatu,
  previewInvoice,
  sendDocumentEmail,
  sendEarsiv,
  sendEarsivIptal,
  type EmailBelgeTuru,
  type IceGoruntu,
} from "./ice/ice.earsiv.js";
import {
  UblFaturaGirdi,
  UblTaraf,
  buildInvoiceXml,
  hesapla,
  toBase64,
} from "./ice/ubl/invoiceBuilder.js";
import { assertAllowedServiceUrl } from "./ice/ice.client.js";
import { ASKIDAKI_DURUMLAR, EbelgeKuyrukService, type BelgeTuru } from "./ebelgeKuyruk.service.js";
import { goruntuCoz } from "./ice/ice.earsiv.js";
import {
  callWithSession,
  clearSession,
  health,
  logout,
  registerSessionShutdown,
} from "./ice/ice.session.js";
import {
  EbelgeAyarView,
  EbelgeBaglantiTestSonucu,
  IceKontorSatiri,
} from "./ice/ice.types.js";

registerSessionShutdown();

/** ICE'de kayıtlı cariden gelen, ekranda seçtirilen alıcı adresi */
export interface EbelgeAliciAdres {
  adresAdi: string;
  adres: string;
  il: string;
  ilce: string;
  ulke: string;
  postaKodu: string;
  eposta: string;
  telefon: string;
  /** ICE kayıtlı cariden ya da önceki belgenin UBL'sinden; yoksa boş */
  vergiDairesi: string;
}

/**
 * Süreç içi kilit: aynı belgeye eşzamanlı kabul/red isteklerini engeller.
 * Çift gönderim korumasının ilk katmanı (bkz. EbelgeService.cevapVer).
 */
const cevapKilitleri = new Set<string>();

/**
 * e-Belge servis katmanı: bağlantı ayarları, bağlantı testi, kontör,
 * gelen kutusu okuma ve kabul/red cevabı.
 */
/**
 * Alıcının posta kutusu (PK) etiketi: GİB listesinde aynı VKN için GB (gönderici birim) etiketi de dönebilir; fatura
 * PK'ya gönderilir. Birim bilgisi ya da etiket adı PK olanı seçer, yoksa ilk etiketi (eski davranış) kullanır.
 */
export const pkEtiketiSec = (kullanicilar: { Alias?: string; Unit?: string }[]): string => {
  const etiketler = kullanicilar.map((k) => ({ alias: String(k.Alias || "").trim(), birim: String(k.Unit || "").trim() }))
    .filter((k) => k.alias);
  const pk = etiketler.find((k) => k.birim.toUpperCase() === "PK")
    || etiketler.find((k) => /(^|[:._-])pk|defaultpk/i.test(k.alias))
    || etiketler.find((k) => k.birim.toUpperCase() !== "GB" && !/(^|[:._-])gb|defaultgb/i.test(k.alias));
  return (pk || etiketler[0])?.alias || "";
};

/** Ekrandaki mükellef / alıcı adresi sorguları için (anahtar: firma havuzu + VKN) */
const ALICI_ONBELLEK_SURE_MS = 6 * 60 * 60_000;
const ALICI_ONBELLEK_EN_FAZLA = 2000;
const mukellefOnbellek = new SureliOnbellek<{ mukellefMi: boolean; kullanicilar: any[]; mesaj: string }>(
  ALICI_ONBELLEK_SURE_MS, ALICI_ONBELLEK_EN_FAZLA);
const adresOnbellek = new SureliOnbellek<{ adresler: EbelgeAliciAdres[] }>(ALICI_ONBELLEK_SURE_MS, ALICI_ONBELLEK_EN_FAZLA);

export class EbelgeService {
  /**
   * Ayarları getirir. Kayıt yoksa TODVZ_TANIM'daki VKN ile ön doldurulmuş
   * boş bir taslak döner (ekranın boş açılmaması için).
   */
  public static async getAyar(dbContext?: DbContext): Promise<EbelgeAyarView & { sifrelemeHazir: boolean }> {
    const kayit = await EbelgeSqlRepository.getAyar(dbContext);
    const sifrelemeHazir = isEncryptionConfigured();

    if (kayit) {
      return { ...EbelgeSqlRepository.toAyarView(kayit), sifrelemeHazir };
    }

    const firmaVkn = await EbelgeSqlRepository.getFirmaVknFromTanim(dbContext);
    return {
      id: 0,
      ortam: "CANLI",
      servisUrl: "https://integration.iceteknoloji.com.tr/integration.asmx",
      kullaniciAdi: "",
      sifreTanimli: false,
      uygulamaAdi: "LikyaKuyumERP",
      uygulamaSurum: "1.0",
      firmaVkn,
      firmaAlias: "",
      firmaIl: "",
      firmaIlce: "",
      aktif: false,
      guncelleyen: null,
      guncellemeTarihi: null,
      sifrelemeHazir,
    };
  }

  /**
   * Ayarları kaydeder. Adres allowlist'ten geçmezse kayıt yapılmaz;
   * kayıt sonrası bellekteki oturum düşürülür (yeni bilgilerle yeniden giriş yapılsın diye).
   */
  public static async saveAyar(
    dto: SaveEbelgeAyarDto,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<EbelgeAyarView> {
    assertAllowedServiceUrl(dto.servisUrl);

    const mevcut = await EbelgeSqlRepository.getAyar(dbContext);
    const sifreVar = Boolean(mevcut?.sifreSifreli) || Boolean(dto.sifre && dto.sifre.trim());

    if (dto.aktif && !sifreVar) {
      throw ApiError.badRequest("Bağlantı etkinleştirilmeden önce entegratör şifresi girilmelidir.");
    }

    // Ayar değiştiyse eski oturum geçersiz
    if (mevcut) {
      clearSession({
        servisUrl: mevcut.servisUrl,
        kullaniciAdi: mevcut.kullaniciAdi,
        sifre: "",
        uygulamaAdi: mevcut.uygulamaAdi,
        uygulamaSurum: mevcut.uygulamaSurum,
        dbServer: dbContext?.dbServer,
        dbName: dbContext?.dbName,
      });
    }

    const sonuc = await EbelgeSqlRepository.saveAyar(dto, kullanici, dbContext);

    await EbelgeSqlRepository.writeLog(
      {
        metod: "AYAR_KAYIT",
        yon: "GIDEN",
        basarili: true,
        kullanici,
        istekOzet: `ortam=${dto.ortam} url=${dto.servisUrl} kullanici=${dto.kullaniciAdi} aktif=${dto.aktif}`,
      },
      dbContext
    );

    return sonuc;
  }

  /**
   * Bağlantı testi.
   *
   * Sıra önemli: önce `Health` (oturum gerektirmiyor) — servis ayakta değilse
   * boşuna Login denenmez, ICE'nin hatalı deneme sayacı şişmez.
   */
  public static async testBaglanti(
    kullanici: string,
    dbContext?: DbContext
  ): Promise<EbelgeBaglantiTestSonucu> {
    const started = Date.now();
    const kayit = await EbelgeSqlRepository.getAyar(dbContext);

    if (!kayit || !kayit.servisUrl) {
      throw ApiError.badRequest("Önce servis adresini kaydediniz.");
    }

    const sonuc: EbelgeBaglantiTestSonucu = {
      servisAyakta: false,
      healthCevabi: null,
      girisBasarili: false,
      hataMesaji: null,
      hataliDenemeSayisi: null,
      kontor: null,
      sureMs: 0,
    };

    // 1) Health — oturumsuz
    try {
      sonuc.healthCevabi = await health(kayit.servisUrl);
      sonuc.servisAyakta = true;
    } catch (err: any) {
      sonuc.hataMesaji = err?.message || "Servise ulaşılamadı.";
      sonuc.sureMs = Date.now() - started;
      await EbelgeSqlRepository.writeLog(
        {
          metod: "Health",
          yon: "GIDEN",
          basarili: false,
          hataMesaji: sonuc.hataMesaji,
          sureMs: sonuc.sureMs,
          kullanici,
        },
        dbContext
      );
      return sonuc;
    }

    // 2) Kimlik bilgisi yoksa test burada biter — Login denenmez
    if (!kayit.kullaniciAdi || !kayit.sifreSifreli) {
      sonuc.hataMesaji = "Servis ayakta. Giriş denenmedi: kullanıcı adı veya şifre tanımlı değil.";
      sonuc.sureMs = Date.now() - started;
      return sonuc;
    }

    // 3) Login + Get_Credit + Logout
    let config;
    try {
      config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    } catch (err: any) {
      sonuc.hataMesaji = err?.message || "Bağlantı yapılandırması okunamadı.";
      sonuc.sureMs = Date.now() - started;
      return sonuc;
    }

    try {
      const kontor = await this.fetchKontor(config, dbContext, kullanici);
      sonuc.girisBasarili = true;
      sonuc.kontor = kontor;
    } catch (err: any) {
      sonuc.hataMesaji = err?.message || "Entegratör girişi başarısız.";
      const eslesme = /hatalı deneme sayısı: (\d+)/i.exec(sonuc.hataMesaji || "");
      if (eslesme) {
        sonuc.hataliDenemeSayisi = Number(eslesme[1]);
      }
    } finally {
      // Test amaçlı açılan oturumu açık bırakma
      await logout(config).catch(() => undefined);
    }

    sonuc.sureMs = Date.now() - started;

    await EbelgeSqlRepository.writeLog(
      {
        metod: "BAGLANTI_TEST",
        yon: "GIDEN",
        basarili: sonuc.girisBasarili,
        hataMesaji: sonuc.hataMesaji,
        sureMs: sonuc.sureMs,
        kullanici,
      },
      dbContext
    );

    return sonuc;
  }

  /**
   * Kalan kontör bilgisi. ICE bunu DataSet (diffgram) olarak döndürüyor,
   * alan adları sabit olmadığı için satırlar olduğu gibi taşınır.
   */
  public static async getKontor(kullanici: string, dbContext?: DbContext): Promise<IceKontorSatiri[]> {
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    return this.fetchKontor(config, dbContext, kullanici);
  }

  private static async fetchKontor(
    config: Awaited<ReturnType<typeof EbelgeSqlRepository.getConnectionConfig>>,
    dbContext: DbContext | undefined,
    kullanici: string
  ): Promise<IceKontorSatiri[]> {
    const { data, trace } = await callWithSession<any>(config, {
      method: "Get_Credit",
      // Get_Credit yalnızca oturum başlığı alıyor
      buildInnerXml: (loginHeaderXml) => loginHeaderXml,
      authHatasindaTekrarla: true, // okuma çağrısı — tekrar güvenli
    });

    await EbelgeSqlRepository.writeLog(
      {
        metod: "Get_Credit",
        yon: "GIDEN",
        basarili: true,
        sureMs: trace.sureMs,
        kullanici,
      },
      dbContext
    );

    return extractDataSetRows(data);
  }

  public static async getLogs(limit: number, dbContext?: DbContext) {
    return EbelgeSqlRepository.getLogs(limit, dbContext);
  }

  /* ======================================================================
     Gelen kutusu (Faz 3)
     ====================================================================== */

  /**
   * ICE'den gelen belgeleri çekip yerel aynaya yazar.
   *
   * `HEADER_ONLY=true` ile çalışır: base64 UBL gövdesi indirilmez, yalnızca
   * başlıklar gelir. INVOICEHEADER zaten unvan, tarih, tutar ve GİB statüsünü
   * verdiği için liste ekranı için UBL ayrıştırmaya gerek yoktur.
   */
  public static async senkronizeGelen(
    kullanici: string,
    filtre: { gunSayisi?: number; limit?: number; okunmuslarDahil?: boolean; baslangic?: string; bitis?: string },
    dbContext?: DbContext
  ): Promise<{ toplamIce: number; cekilen: number; yazilan: number; sureMs: number }> {
    const started = Date.now();
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);

    // Ekrandaki tarih aralığı (YYYY-MM-DD, Türkiye saati) verildiyse o aralık; yoksa son N gün
    const gun = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
    let baslangic: Date;
    let bitis: Date;
    if (gun(filtre.baslangic) || gun(filtre.bitis)) {
      bitis = gun(filtre.bitis) ? new Date(`${filtre.bitis}T23:59:59+03:00`) : new Date();
      baslangic = gun(filtre.baslangic)
        ? new Date(`${filtre.baslangic}T00:00:00+03:00`)
        : new Date(bitis.getTime() - 30 * 86_400_000);
      if (baslangic > bitis) throw ApiError.badRequest("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      if (bitis.getTime() - baslangic.getTime() > 366 * 86_400_000) {
        throw ApiError.badRequest("Tarih aralığı en çok 1 yıl olabilir.");
      }
    } else {
      bitis = new Date();
      baslangic = new Date(bitis.getTime() - Math.min(Math.max(filtre.gunSayisi ?? 30, 1), 365) * 86_400_000);
    }
    const gunSayisi = Math.ceil((bitis.getTime() - baslangic.getTime()) / 86_400_000);

    const iceFiltre: GelenFaturaFiltre = {
      limit: Math.min(Math.max(filtre.limit ?? 200, 1), 1000),
      baslangicTarihi: baslangic,
      bitisTarihi: bitis,
      okunmuslarDahil: filtre.okunmuslarDahil ?? true,
      islenmislerDahil: true,
      yon: "IN",
    };

    // Önce adet — sayfalama ve kullanıcıya bilgi için
    let toplamIce = 0;
    try {
      toplamIce = await getInvoiceCount(config, iceFiltre);
    } catch (err) {
      logger.warn("GetInvoice_Count başarısız, listeye devam ediliyor:", err);
    }

    const { faturalar, sureMs } = await getInvoices(config, iceFiltre, true);

    let yazilan = 0;
    for (const fatura of faturalar) {
      const uuid = String(fatura.UUID || "").trim();
      if (!uuid) continue;

      const h = fatura.HEADER || {};
      await EbelgeSqlRepository.upsertGelen(
        {
          uuid,
          belgeNo: fatura.ID ? String(fatura.ID) : null,
          belgeTuru: "EFATURA",
          profil: h.PROFILEID ? String(h.PROFILEID) : null,
          sender: h.SENDER ? String(h.SENDER) : null,
          receiver: h.RECEIVER ? String(h.RECEIVER) : null,
          supplier: h.SUPPLIER ? String(h.SUPPLIER) : null,
          customer: h.CUSTOMER ? String(h.CUSTOMER) : null,
          duzenlemeTarihi: parseIceDate(h.ISSUE_DATE),
          tutar: parseAmount(h.PAYABLE_AMOUNT),
          paraBirimi: parseCurrency(h.PAYABLE_AMOUNT),
          faturaTipi: h.INVOICE_TYPE_CODE ? String(h.INVOICE_TYPE_CODE) : null,
          gibStatuKodu: h.GIB_STATUS_CODE != null ? Number(h.GIB_STATUS_CODE) : null,
          gibStatuAciklama: h.GIB_STATUS_DESCRIPTION ? String(h.GIB_STATUS_DESCRIPTION) : null,
          statu: h.STATUS ? String(h.STATUS) : null,
          statuAciklama: h.STATUS_DESCRIPTION ? String(h.STATUS_DESCRIPTION) : null,
          zarfId: h.ENVELOPE_IDENTIFIER ? String(h.ENVELOPE_IDENTIFIER) : null,
          hash: h.HASH ? String(h.HASH) : null,
        },
        dbContext
      );
      yazilan += 1;
    }

    const toplamSure = Date.now() - started;

    await EbelgeSqlRepository.writeLog(
      {
        metod: "GetInvoice",
        yon: "GELEN",
        basarili: true,
        sureMs,
        kullanici,
        istekOzet: `gun=${gunSayisi} limit=${iceFiltre.limit} yon=IN headerOnly=true`,
        cevapOzet: `ICE toplam=${toplamIce} çekilen=${faturalar.length} yazılan=${yazilan}`,
      },
      dbContext
    );

    return { toplamIce, cekilen: faturalar.length, yazilan, sureMs: toplamSure };
  }

  /** Yerel aynadan sayfalı liste */
  public static async listGelen(filtre: GelenListeFiltre, dbContext?: DbContext) {
    return EbelgeSqlRepository.listGelen(filtre, dbContext);
  }

  /**
   * Tek belge detayı. `statuYenile=true` ise ICE'den güncel GİB statüsü de çekilir.
   */
  public static async getGelenDetay(
    uuid: string,
    statuYenile: boolean,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<GelenBelgeSatiri> {
    const kayit = await EbelgeSqlRepository.getGelen(uuid, dbContext);
    if (!kayit) {
      throw ApiError.notFound("Belge yerel kayıtlarda bulunamadı. Önce senkronize ediniz.");
    }

    if (!statuYenile) return kayit;

    try {
      const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
      const detay = await getInvoiceStatusDetail(config, uuid);

      await EbelgeSqlRepository.updateGelenStatu(
        uuid,
        {
          statu: detay.STATUS ? String(detay.STATUS) : null,
          statuAciklama: detay.STATUS_DESCRIPTION ? String(detay.STATUS_DESCRIPTION) : null,
          gibStatuKodu: detay.STATUS_CODE != null && !isNaN(Number(detay.STATUS_CODE))
            ? Number(detay.STATUS_CODE)
            : null,
        },
        dbContext
      );

      await EbelgeSqlRepository.writeLog(
        { metod: "Get_Invoice_Status_Detail", yon: "GELEN", basarili: true, kullanici, ilgiliUuid: uuid },
        dbContext
      );

      return (await EbelgeSqlRepository.getGelen(uuid, dbContext)) || kayit;
    } catch (err: any) {
      // Statü çekilemezse yerel kayıt yine de gösterilir
      logger.warn(`Get_Invoice_Status_Detail başarısız (${uuid}):`, err);
      return kayit;
    }
  }

  /* ======================================================================
     Giden belge — UBL üretimi ve doğrulama (Faz 5)
     ====================================================================== */

  /**
   * Gönderici (firma) bilgilerini ayar + TODVZ_TANIM'dan tamamlar.
   * İstek gövdesinde verilen alanlar önceliklidir.
   */
  private static async goncericiTamamla(
    verilen: Partial<UblTaraf> | undefined,
    dbContext?: DbContext
  ): Promise<UblTaraf> {
    const ayar = await EbelgeSqlRepository.getAyar(dbContext);
    const firma = await EbelgeSqlRepository.getFirmaBilgisi(dbContext);

    const vknTckn = (verilen?.vknTckn || ayar?.firmaVkn || firma.vkn || "").trim();
    if (!vknTckn) {
      throw ApiError.badRequest(
        "Firma VKN/TCKN bulunamadı. E-Belge ayarlarından firma vergi kimlik numarasını giriniz."
      );
    }

    const unvan = verilen?.unvan || firma.unvan || undefined;

    // Şahıs firması (11 haneli TCKN): UBL-TR ad ve soyadı ayrı ister. Firma tablosunda
    // yalnızca unvan var; verilmemişse unvanın son kelimesi soyad, öncesi ad sayılır.
    let ad = verilen?.ad?.trim() || undefined;
    let soyad = verilen?.soyad?.trim() || undefined;
    if (vknTckn.length === 11 && !(ad && soyad)) {
      const parcalar = (unvan || "").trim().split(/\s+/).filter(Boolean);
      if (parcalar.length > 1) {
        soyad = parcalar.pop();
        ad = parcalar.join(" ");
      }
    }

    return {
      vknTckn,
      unvan,
      ad,
      soyad,
      vergiDairesi: verilen?.vergiDairesi,
      adres: verilen?.adres || firma.adres || undefined,
      // UBL-TR adreste il/ilçe zorunlu; firma tablosunda bu kolonlar yok, bu yüzden
      // e-Belge ayarlarından alınır (§16.17).
      ilce: verilen?.ilce || ayar?.firmaIlce || undefined,
      il: verilen?.il || ayar?.firmaIl || undefined,
      ulke: verilen?.ulke,
      telefon: verilen?.telefon || firma.telefon || undefined,
      eposta: verilen?.eposta,
      webAdresi: verilen?.webAdresi,
    };
  }

  /**
   * UBL-TR faturayı üretir ve **göndermeden** ICE'ye doğrulatır.
   *
   * `invoice_check_validate` şema + schematron sonucunu ve istenirse HTML önizlemeyi döndürür.
   * Bu çağrı belge oluşturmaz, mali sonuç doğurmaz.
   */
  public static async dogrulaGidenBelge(
    girdi: UblFaturaGirdi,
    kullanici: string,
    onizleme: boolean,
    dbContext?: DbContext
  ): Promise<{
    uuid: string;
    xml: string;
    ozet: ReturnType<typeof hesapla>;
    semaGecerli: boolean;
    schematronGecerli: boolean;
    mesaj: string;
    html: string | null;
  }> {
    const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
    const { xml, uuid, ozet } = buildInvoiceXml({ ...girdi, gonderici });

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const sonuc = await invoiceCheckValidate(config, toBase64(xml), { html: onizleme, pdf: false });

    const semaGecerli = String(sonuc?.shema_validate).toLowerCase() === "true";
    const schematronGecerli = String(sonuc?.shematron_validate).toLowerCase() === "true";

    await EbelgeSqlRepository.writeLog(
      {
        metod: "invoice_check_validate",
        yon: "GIDEN",
        basarili: semaGecerli && schematronGecerli,
        kullanici,
        ilgiliUuid: uuid,
        istekOzet: `belgeNo=${girdi.belgeNo} satır=${girdi.satirlar.length} tutar=${ozet.odenecekTutar}`,
        cevapOzet: `sema=${semaGecerli} schematron=${schematronGecerli} ${sonuc?.response_message || ""}`.trim(),
      },
      dbContext
    );

    return {
      uuid,
      xml,
      ozet,
      semaGecerli,
      schematronGecerli,
      mesaj: sonuc?.response_message?.trim() || "",
      html: onizleme && sonuc?.invoice_html ? String(sonuc.invoice_html) : null,
    };
  }

  /**
   * Ekrandaki mükellef sorgusu: mükellef çıkan sonuç firma+VKN anahtarıyla 6 saat bellekte tutulur,
   * aynı anda gelen aynı sorgu tek ICE çağrısını paylaşır. Mükellef olmayan / hatalı sonuç saklanmaz.
   * Gönderim yolları (kaynak gönderimi, alias çözümü) ICE'ye canlı sorar.
   */
  public static async mukellefSorgula(
    vknTckn: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ mukellefMi: boolean; kullanicilar: any[]; mesaj: string }> {
    const sonuc = await mukellefOnbellek.al(
      `${getPoolKey(dbContext?.dbServer, dbContext?.dbName)}|${vknTckn.trim()}`,
      () => this.mukellefSorgulaCanli(vknTckn, kullanici, dbContext),
      (s) => s.mukellefMi && s.kullanicilar.length > 0
    );
    return structuredClone(sonuc);
  }

  /**
   * Alıcının e-Fatura mükellefi olup olmadığını sorar.
   * Sonuç boşsa alıcı mükellef değildir → e-Arşiv kesilmelidir.
   */
  public static async mukellefSorgulaCanli(
    vknTckn: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ mukellefMi: boolean; kullanicilar: any[]; mesaj: string }> {
    if (!/^\d{10}$|^\d{11}$/.test(vknTckn.trim())) {
      return {
        mukellefMi: false,
        kullanicilar: [],
        mesaj: "Geçersiz VKN/TCKN formatı.",
      };
    }

    let config;
    try {
      config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    } catch {
      // Entegratör ayarları tanımlı değilse hata fırlatmak yerine e-Arşiv olarak kabul et
      return {
        mukellefMi: false,
        kullanicilar: [],
        mesaj: "e-Belge entegratör ayarları henüz tanımlanmamış. e-Arşiv senaryosu uygulandı.",
      };
    }

    try {
      const sonuc = await getUserListEFatura(config, vknTckn.trim());
      if (!sonuc.basarili) {
        return {
          mukellefMi: false,
          kullanicilar: [],
          mesaj: sonuc.mesaj || "Mükellef sorgusu yapılamadı, e-Arşiv uygulandı.",
        };
      }

      await EbelgeSqlRepository.writeLog(
        {
          metod: "getUserList_EFatura_Detail",
          yon: "GIDEN",
          basarili: sonuc.basarili,
          kullanici,
          istekOzet: `vkn=${vknTckn}`,
          cevapOzet: `${sonuc.kullanicilar.length} etiket`
            + (sonuc.silinenler.length ? `, ${sonuc.silinenler.length} silinmiş etiket` : ""),
        },
        dbContext
      );

      const tumuSilinmis = sonuc.kullanicilar.length === 0 && sonuc.silinenler.length > 0;
      return {
        mukellefMi: sonuc.kullanicilar.length > 0,
        kullanicilar: sonuc.kullanicilar,
        mesaj: tumuSilinmis
          ? "Alıcının e-Fatura kaydı GİB listesinden silinmiş; e-Arşiv uygulandı."
          : sonuc.mesaj,
      };
    } catch {
      return {
        mukellefMi: false,
        kullanicilar: [],
        mesaj: "Mükellef sorgulanamadı, varsayılan e-Arşiv senaryosu uygulandı.",
      };
    }
  }

  /**
   * Alıcının ICE portalında kayıtlı adreslerini döndürür (doğrulama ekranında seçtirilir).
   * Mükellef sorgusundan AYRI tutulur: adres bulunamaması belge türü kararını etkilemez.
   */
  public static async aliciAdresleri(
    vknTckn: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ adresler: EbelgeAliciAdres[] }> {
    // Adres bulunan sonuç 6 saat saklanır; boş sonuç ve hata saklanmaz
    const sonuc = await adresOnbellek.al(
      `${getPoolKey(dbContext?.dbServer, dbContext?.dbName)}|${vknTckn.trim()}`,
      () => this.aliciAdresleriCanli(vknTckn, kullanici, dbContext),
      (s) => s.adresler.length > 0
    );
    return structuredClone(sonuc);
  }

  private static async aliciAdresleriCanli(
    vknTckn: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ adresler: EbelgeAliciAdres[] }> {
    const vkn = vknTckn.trim();
    if (!/^\d{10}$|^\d{11}$/.test(vkn)) {
      throw ApiError.badRequest("VKN 10, TCKN 11 haneli rakam olmalıdır.");
    }

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);

    // İki kaynak birbirinden bağımsızdır; birinin hatası diğerini engellemez.
    const ham: IceCariAdres[] = [];
    const ozet: string[] = [];
    let hataSayisi = 0;

    // 0) Bu alıcıya daha önce kestiğimiz son belge (e-Arşiv dahil) — kendi kaydımız, ICE'ye gitmeden (R2)
    try {
      const son = await EbelgeSqlRepository.sonGidenXml(vkn, dbContext);
      const a = son ? ublTarafAdresi(son.xml, vkn, `Son belgemiz ${son.belgeNo}`.trim()) : null;
      if (a) ham.push(a);
      ozet.push(`son belgemiz: ${a ? 1 : 0}`);
    } catch (err: any) {
      ozet.push(`son belgemiz: ${err?.message || err}`);
    }

    try {
      const cari = await getMusteriCariAdresleri(config, vkn);
      ham.push(...cari.adresler);
      ozet.push(cari.basarili
        ? `cari: dönen=${cari.donenCari}, eşleşen=${cari.eslesenCari}, adres=${cari.adresler.length}`
        : `cari: ${cari.mesaj}`);
      if (!cari.basarili) hataSayisi++;
    } catch (err: any) {
      hataSayisi++;
      ozet.push(`cari: ${err?.message || err}`);
    }

    if (!ham.length) {
      try {
        const onceki = await getOncekiBelgeAdresi(config, vkn);
        if (onceki.adres) ham.push(onceki.adres);
        ozet.push(`önceki belge: bakılan=${onceki.bakilan}, adres=${onceki.adres ? 1 : 0}`);
      } catch (err: any) {
        hataSayisi++;
        ozet.push(`önceki belge: ${err?.message || err}`);
      }
    }

    const sonuc = { adresler: ham };
    await EbelgeSqlRepository.writeLog(
      {
        metod: "AliciAdresSorgu",
        yon: "GIDEN",
        basarili: ham.length > 0 || hataSayisi < 2,
        kullanici,
        istekOzet: `vkn=${vkn}`,
        cevapOzet: ozet.join(" | ").slice(0, 400),
      },
      dbContext
    );
    // Kendi kaydımızdan bilgi geldiyse ICE sorgularının hatası belgeyi durdurmaz
    if (!ham.length && hataSayisi === 2) {
      throw ApiError.unprocessable(`Alıcı adresi ICE'den sorgulanamadı (${ozet.join(" | ").slice(0, 300)}).`);
    }

    const m = (v: unknown) => String(v ?? "").trim();
    const adresler = sonuc.adresler
      .map((a) => ({
        adresAdi: m(a.AdresAdi),
        adres: [
          m(a.MahalleCadde),
          m(a.BinaAdi),
          m(a.BinaNo) && `No:${m(a.BinaNo)}`,
          m(a.DaireNo) && `D:${m(a.DaireNo)}`,
        ].filter(Boolean).join(" "),
        // Parça parça da döner: form Mahalle/Cadde, Bina Adı, Bina No, Kapı No alanlarını ayrı doldurur (R2)
        mahalleCadde: m(a.MahalleCadde),
        binaAdi: m(a.BinaAdi),
        binaNo: m(a.BinaNo),
        kapiNo: m(a.DaireNo),
        il: m(a.Sehir),
        ilce: m(a.Ilce),
        ulke: m(a.Ulke),
        postaKodu: m(a.PostaKodu),
        eposta: m(a.Eposta),
        telefon: m(a.Telefon),
        faks: m(a.Faks),
        webSitesi: m(a.WebSitesi),
        vergiDairesi: m(a.VergiDairesi),
        unvan: m(a.Unvan),
        ad: m(a.Ad),
        soyad: m(a.Soyad),
      }))
      .filter((a) => a.adres || a.il || a.ilce || a.eposta || a.telefon);

    return { adresler };
  }

  /**
   * Belgeyi ICE'de **taslak** olarak oluşturur.
   *
   * ⚠️ Taslak **GİB'e gitmez**. GİB'e ancak `DraftApproval` ile gönderilir; bu servis
   * o çağrıyı yapmaz ve Faz 6'da onay ucu hiç açılmamıştır (karar: kullanıcı,
   * "GİB'e gitmesin"). Taslak `taslakIptal` ile geri alınabilir.
   *
   * Akış: UBL üret → `invoice_check_validate` ile doğrula → geçtiyse taslak gönder.
   * Doğrulamadan geçmeyen belge ICE'ye hiç gönderilmez.
   */
  /* ======================================================================
     e-İrsaliye (Faz 9)
     ====================================================================== */

  /**
   * e-İrsaliyeyi **göndermeden** doğrular (`despatchadvice_check_validate`).
   */
  public static async dogrulaIrsaliyeBelgesi(
    girdi: IrsaliyeGirdi,
    kullanici: string,
    onizleme: boolean,
    dbContext?: DbContext
  ): Promise<{
    uuid: string;
    xml: string;
    satirSayisi: number;
    semaGecerli: boolean;
    schematronGecerli: boolean;
    mesaj: string;
    html: string | null;
  }> {
    const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
    const { xml, uuid, satirSayisi } = buildDespatchAdviceXml({ ...girdi, gonderici });

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const sonuc = await despatchAdviceCheckValidate(config, toBase64(xml), {
      html: onizleme,
      pdf: false,
    });

    const semaGecerli = String(sonuc?.shema_validate).toLowerCase() === "true";
    const schematronGecerli = String(sonuc?.shematron_validate).toLowerCase() === "true";

    await EbelgeSqlRepository.writeLog(
      {
        metod: "despatchadvice_check_validate",
        yon: "GIDEN",
        basarili: semaGecerli && schematronGecerli,
        kullanici,
        ilgiliUuid: uuid,
        istekOzet: `belgeNo=${girdi.belgeNo} satır=${satirSayisi}`,
        cevapOzet: `sema=${semaGecerli} schematron=${schematronGecerli} ${sonuc?.response_message || ""}`.trim(),
      },
      dbContext
    );

    return {
      uuid,
      xml,
      satirSayisi,
      semaGecerli,
      schematronGecerli,
      mesaj: sonuc?.response_message?.trim() || "",
      html: onizleme && sonuc?.despatchadvice_html ? String(sonuc.despatchadvice_html) : null,
    };
  }

  /**
   * e-İrsaliyeyi GİB'e gönderir.
   *
   * ⚠️ **GERİ ALINAMAZ.** e-Fatura ile aynı disiplin:
   * numara ön kontrolü → UBL üret → `despatchadvice_check_validate` →
   * alıcının **e-İrsaliye** posta kutusu (e-Fatura mükellefiyetinden ayrıdır) →
   * ICE son sıra → kontör → **SQL rezervasyonu** → gönderim → belge bazında doğrulama.
   */
  public static async irsaliyeGonder(
    girdi: IrsaliyeGirdi & { aliciAlias?: string },
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{
    uuid: string;
    belgeNo: string;
    durum: string;
    mesaj: string;
    satirSayisi: number;
    kontorKalan: number | null;
    kontorUyari: string | null;
  }> {
    const belgeNo = girdi.belgeNo.trim().toUpperCase();
    const tarih =
      girdi.tarih || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    girdi = { ...girdi, belgeNo, tarih };

    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, dbContext)) {
      throw ApiError.conflict(
        `${belgeNo} numaralı belge daha önce oluşturulmuş. Aynı numara ikinci kez kullanılamaz.`
      );
    }

    const ayar = await EbelgeSqlRepository.getAyar(dbContext);
    // Boşsa from_alias gönderilmez; ICE hesabın gönderici etiketini kullanır (WSDL minOccurs=0)
    const fromAlias = ayar?.firmaAlias?.trim() || "";

    const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
    const { xml, uuid, satirSayisi } = buildDespatchAdviceXml({ ...girdi, belgeNo, gonderici });
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);

    // 1) Doğrulama — geçmezse GİB'e hiç gitmesin
    const dogrulama = await despatchAdviceCheckValidate(config, toBase64(xml), {
      html: false,
      pdf: false,
    });
    const semaGecerli = String(dogrulama?.shema_validate).toLowerCase() === "true";
    const schematronGecerli = String(dogrulama?.shematron_validate).toLowerCase() === "true";
    if (!semaGecerli || !schematronGecerli) {
      throw ApiError.unprocessable(
        dogrulama?.response_message?.trim() ||
          "İrsaliye şema/schematron doğrulamasından geçemedi; gönderilmedi."
      );
    }

    // 2) Alıcının e-İrsaliye posta kutusu — e-Fatura mükellefiyetinden AYRI sorgulanır
    let aliciAlias = girdi.aliciAlias?.trim() || "";
    if (!aliciAlias) {
      const mukellef = await getUserListDespatchAdvice(config, girdi.alici.vknTckn);
      if (!mukellef.basarili) {
        throw ApiError.unprocessable(
          mukellef.mesaj || "Alıcının e-İrsaliye mükellefiyeti doğrulanamadı; gönderim durduruldu."
        );
      }
      aliciAlias = mukellef.kullanicilar[0]?.Alias?.trim() || "";
      if (!aliciAlias) {
        throw ApiError.badRequest(
          "Alıcı e-İrsaliye mükellefi görünmüyor (posta kutusu etiketi bulunamadı). " +
            "Bu alıcıya kâğıt irsaliye düzenlenmelidir."
        );
      }
    }

    // 3) ICE'deki son sıra
    const son = await getSonBelgeId(
      config,
      belgeNo.slice(0, 3),
      "EIrsaliye",
      Number(belgeNo.slice(3, 7))
    );
    const sonSira = Number(son?.Son_Belge_ID);
    if (
      son?.Son_Belge_ID == null ||
      String(son.Son_Belge_ID).trim() === "" ||
      !Number.isInteger(sonSira) ||
      sonSira < 0
    ) {
      throw ApiError.unprocessable("ICE son belge numarası doğrulanamadı; gönderim durduruldu.");
    }
    if (Number(belgeNo.slice(7)) <= sonSira) {
      throw ApiError.conflict("İrsaliye numarası ICE'de kullanılan son sıradan büyük olmalıdır.");
    }

    // 4) Kontör
    const kontor = await this.kontorOnKontrol(config, dbContext, kullanici);

    // 5) Numarayı kalıcı olarak tut, gönderimi kuyruğa al (docs/EBELGE_KUYRUK_YOL_HARITASI.md)
    await EbelgeSqlRepository.insertGiden(
      {
        uuid,
        belgeNo,
        belgeTuru: "EIrsaliye",
        profil: girdi.senaryo || "TEMELIRSALIYE",
        faturaTipi: girdi.irsaliyeTipi,
        taslakMi: false,
        aliciVkn: girdi.alici.vknTckn,
        aliciAlias,
        aliciUnvan:
          girdi.alici.unvan || [girdi.alici.ad, girdi.alici.soyad].filter(Boolean).join(" ") || null,
        duzenlemeTarihi: new Date(tarih),
        // İrsaliyede tutar yoktur
        tutar: null,
        paraBirimi: null,
        gonderimDurumu: "KUYRUKTA",
        semaGecerli,
        schematronGecerli,
        iceResponseMesaj: "Gönderim kuyruğunda.",
        xmlIcerik: xml,
        olusturan: kullanici,
        gonderen: kullanici,
        gonderimTarihi: new Date(),
      },
      dbContext
    );

    // 6) Gönder — sonuç arka planda kesinleşir
    await EbelgeKuyrukService.kuyrugaAl(
      {
        uuid,
        belgeTuru: "EIrsaliye",
        islem: "GONDER",
        kullanici,
        veri: { fromVkn: gonderici.vknTckn, fromAlias, toVkn: girdi.alici.vknTckn, toAlias: aliciAlias },
      },
      dbContext
    );
    const sonuc = await this.kuyrukSonucu(uuid, "e-İrsaliye gönderimi reddedildi.", dbContext);

    return {
      uuid,
      belgeNo,
      durum: sonuc.durum,
      mesaj: sonuc.mesaj,
      satirSayisi,
      kontorKalan: kontor.kalan,
      kontorUyari: kontor.uyari,
    };
  }

  /** Alıcının e-İrsaliye mükellefiyeti */
  public static async irsaliyeMukellefSorgula(
    vknTckn: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ mukellefMi: boolean; kullanicilar: any[]; mesaj: string }> {
    if (!/^\d{10}$|^\d{11}$/.test(vknTckn.trim())) {
      throw ApiError.badRequest("VKN 10, TCKN 11 haneli rakam olmalıdır.");
    }
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const sonuc = await getUserListDespatchAdvice(config, vknTckn.trim());

    await EbelgeSqlRepository.writeLog(
      {
        metod: "getUserList_DespatchAdvice",
        yon: "GIDEN",
        basarili: sonuc.basarili,
        kullanici,
        istekOzet: `vkn=${vknTckn}`,
        cevapOzet: `${sonuc.kullanicilar.length} etiket`,
      },
      dbContext
    );

    return {
      mukellefMi: sonuc.kullanicilar.length > 0,
      kullanicilar: sonuc.kullanicilar,
      mesaj: sonuc.mesaj,
    };
  }

  /** Gelen/giden irsaliye listesi (ICE'den doğrudan) */
  public static async irsaliyeListe(
    filtre: { gunSayisi?: number; limit?: number; yon?: "IN" | "OUT" },
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ kayitlar: any[]; limitDoldu: boolean }> {
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const gunSayisi = Math.min(Math.max(filtre.gunSayisi ?? 30, 1), 365);
    const limit = Math.min(Math.max(filtre.limit ?? 100, 1), 500);
    const bitis = new Date();
    const baslangic = new Date(bitis.getTime() - gunSayisi * 24 * 60 * 60 * 1000);

    const kayitlar = await getDespatchAdvices(
      config,
      {
        limit,
        baslangicTarihi: baslangic,
        bitisTarihi: bitis,
        okunmuslarDahil: true,
        islenmislerDahil: true,
        yon: filtre.yon || "IN",
      },
      true
    );

    await EbelgeSqlRepository.writeLog(
      {
        metod: "GetDespatchadvice",
        yon: filtre.yon === "OUT" ? "GIDEN" : "GELEN",
        basarili: true,
        kullanici,
        istekOzet: `gun=${gunSayisi} limit=${limit} yon=${filtre.yon || "IN"}`,
        cevapOzet: `${kayitlar.length} kayıt`,
      },
      dbContext
    );

    return { kayitlar, limitDoldu: kayitlar.length >= limit };
  }

  /** İrsaliyenin GİB statüsü */
  public static async irsaliyeStatu(
    uuidler: string[],
    yon: "IN" | "OUT",
    kullanici: string,
    dbContext?: DbContext
  ): Promise<any[]> {
    if (!uuidler.length) throw ApiError.badRequest("En az bir UUID gereklidir.");
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const sonuc = await getDespatchAdviceStatus(config, uuidler, yon);

    await EbelgeSqlRepository.writeLog(
      {
        metod: "Get_DespatchAdvice_Status",
        yon: "GIDEN",
        basarili: true,
        kullanici,
        istekOzet: `${uuidler.length} belge yon=${yon}`,
      },
      dbContext
    );

    return sonuc;
  }

  /** İrsaliyenin PDF çıktısı */
  public static async irsaliyePdf(
    ettn: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<Buffer> {
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const { pdf } = await getDespatchAdviceCikti(config, ettn, { pdf: true });

    await EbelgeSqlRepository.writeLog(
      {
        metod: "GetDespatchadvice_HTML_PDF",
        yon: "GIDEN",
        basarili: Boolean(pdf?.length),
        kullanici,
        ilgiliUuid: ettn,
        cevapOzet: `${pdf?.length ?? 0} bayt`,
      },
      dbContext
    );

    if (!pdf?.length) throw ApiError.notFound("İrsaliyenin PDF çıktısı alınamadı.");
    return pdf;
  }

  /* ======================================================================
     e-Fatura gerçek gönderimi (Faz 7)
     ====================================================================== */

  /**
   * Alıcının GİB posta kutusu etiketini (alias) çözer.
   * e-Fatura gönderimi için alıcının **mükellef olması zorunludur**.
   */
  /**
   * Gönderici (kendi) etiketimiz — docs/GIRIS_VE_EBELGE_DUZENLEME.md R1. Ayarda varsa o kullanılır; yoksa firma VKN'si
   * GİB e-Fatura kullanıcı listesinde sorgulanır, gönderici birim (GB) etiketi bulunursa ayara yazılır.
   * Bulunamazsa BOŞ döner ve istek `from_alias` olmadan gider: ICE WSDL'inde alan isteğe bağlı (minOccurs=0) ve ICE'nin
   * kendi örnek isteği bu alanı hiç göndermiyor — gönderici, oturum açan ICE hesabından belirlenir (28.09.2026).
   * GİB listesi çoğu hesapta yalnız PK (alıcı) etiketlerini döndürür; GB etiketi entegratör hesabına tanımlıdır.
   */
  private static async gondericiAliasCoz(
    config: Awaited<ReturnType<typeof EbelgeSqlRepository.getConnectionConfig>>,
    ayardaki: string | null | undefined,
    gondericiVkn: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<string> {
    const mevcut = ayardaki?.trim();
    if (mevcut) return mevcut;

    let liste: Awaited<ReturnType<typeof getUserListEFatura>>;
    try {
      liste = await getUserListEFatura(config, gondericiVkn);
    } catch (err) {
      logger.warn("Gönderici etiketi GİB listesinden sorgulanamadı; from_alias gönderilmeyecek:", err);
      return "";
    }
    if (!liste.basarili) {
      logger.warn(`Gönderici etiketi sorgusu başarısız (${liste.mesaj}); from_alias gönderilmeyecek.`);
      return "";
    }
    const etiketler = liste.kullanicilar.map((k) => ({ alias: String(k.Alias || "").trim(), birim: String(k.Unit || "").trim() }))
      .filter((k) => k.alias);
    const gb = etiketler.find((k) => k.birim.toUpperCase() === "GB")
      || etiketler.find((k) => /(^|[:._-])gb|defaultgb/i.test(k.alias));
    if (!gb) {
      logger.info(`GİB listesinde GB etiketi yok (bulunan: ${etiketler.map((k) => k.alias).join(", ") || "-"}); `
        + "from_alias gönderilmeyecek, ICE hesabın etiketini kullanacak.");
      return "";
    }
    await EbelgeSqlRepository.firmaAliasYaz(gb.alias, kullanici, dbContext);
    logger.info(`Gönderici etiketi GİB'den bulundu ve ayara yazıldı: ${gb.alias}`);
    return gb.alias;
  }

  private static async aliciAliasCoz(
    config: Awaited<ReturnType<typeof EbelgeSqlRepository.getConnectionConfig>>,
    aliciVkn: string,
    verilenAlias?: string
  ): Promise<string> {
    const verilen = verilenAlias?.trim();
    if (verilen) return verilen;

    const mukellef = await getUserListEFatura(config, aliciVkn);
    // Başarısız sorgu "mükellef değil" anlamına gelmez — gönderim durur
    if (!mukellef.basarili) {
      throw ApiError.unprocessable(
        mukellef.mesaj || "Alıcının mükellef durumu doğrulanamadı; gönderim durduruldu."
      );
    }
    const alias = pkEtiketiSec(mukellef.kullanicilar);
    if (!alias) {
      throw ApiError.badRequest(
        "Alıcı e-Fatura mükellefi görünmüyor (GİB posta kutusu etiketi bulunamadı). " +
          "Bu alıcıya e-Arşiv fatura kesilmelidir."
      );
    }
    return alias;
  }

  /**
   * e-Faturayı **doğrudan GİB'e** gönderir.
   *
   * ⚠️⚠️ **GERİ ALINAMAZ.** Taslak değildir. Fatura numarası ve kontör kalıcı olarak yanar.
   * Düzeltmenin tek yolu alıcının red cevabı (ticari fatura, 8 gün) veya iade faturasıdır.
   *
   * Akış e-Arşiv ile aynı disiplinde — **ICE çağrısından önce SQL rezervasyonu**:
   * numara ön kontrolü → UBL üret → `invoice_check_validate` → alias çöz →
   * ICE son sıra kontrolü → kontör → **rezervasyon** → `send_invoice` →
   * sonucu belge bazında doğrula → durum geçişi.
   */
  public static async faturaGonder(
    girdi: UblFaturaGirdi & { aliciAlias?: string },
    kullanici: string,
    dbContext?: DbContext,
    secenek: { kaynakFisId?: string } = {}
  ): Promise<{
    uuid: string;
    belgeNo: string;
    ettn: string | null;
    durum: string;
    mesaj: string;
    tutar: number;
    kontorKalan: number | null;
    kontorUyari: string | null;
  }> {
    const belgeNo = girdi.belgeNo.trim().toUpperCase();
    const tarih =
      girdi.tarih || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    girdi = { ...girdi, belgeNo, tarih };

    if (girdi.senaryo === "EARSIVFATURA") {
      throw ApiError.badRequest(
        "e-Arşiv senaryosu bu uçtan gönderilemez; e-Arşiv gönderimi için /earsiv/gonder kullanılır."
      );
    }
    if (girdi.faturaTipi === "IHRACKAYITLI") {
      throw ApiError.unprocessable(
        `${girdi.faturaTipi} tipi bu üreteçte henüz desteklenmiyor; yapısı doğrulanmış örnekle eklenecektir.`
      );
    }

    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, dbContext)) {
      throw ApiError.conflict(
        `${belgeNo} numaralı belge daha önce oluşturulmuş. Aynı numara ikinci kez kullanılamaz.`
      );
    }

    const ayar = await EbelgeSqlRepository.getAyar(dbContext);

    const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
    const { xml, uuid, ozet } = buildInvoiceXml({ ...girdi, belgeNo, gonderici });
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    // Ayarda boşsa GİB listesinden bulunur ve ayara yazılır (R1)
    const fromAlias = await this.gondericiAliasCoz(config, ayar?.firmaAlias, gonderici.vknTckn, kullanici, dbContext);

    // 1) Doğrulama — geçmezse GİB'e hiç gitmesin
    const dogrulama = await invoiceCheckValidate(config, toBase64(xml), { html: false, pdf: false });
    const semaGecerli = String(dogrulama?.shema_validate).toLowerCase() === "true";
    const schematronGecerli = String(dogrulama?.shematron_validate).toLowerCase() === "true";
    if (!semaGecerli || !schematronGecerli) {
      throw ApiError.unprocessable(
        dogrulama?.response_message?.trim() ||
          "Belge şema/schematron doğrulamasından geçemedi; fatura gönderilmedi."
      );
    }

    // 2) Alıcı etiketi
    const aliciAlias = await this.aliciAliasCoz(config, girdi.alici.vknTckn, girdi.aliciAlias);

    // 3) Serinin son sırası — e-Fatura + e-Arşiv + yerel kayıt ortak (aynı seri iki türde kullanılabilir)
    const sonSira = await this.seriSonSira(config, belgeNo.slice(0, 3), Number(belgeNo.slice(3, 7)), dbContext, false);
    if (Number(belgeNo.slice(7)) <= sonSira) {
      throw ApiError.conflict(
        `Fatura numarası ${belgeNo.slice(0, 3)} serisinde kullanılan son sıradan (${sonSira}) büyük olmalıdır; numarayı yenileyin.`
      );
    }

    // 4) Kontör
    const kontor = await this.kontorOnKontrol(config, dbContext, kullanici);

    // 5) Numarayı kalıcı olarak tut, gönderimi kuyruğa al (docs/EBELGE_KUYRUK_YOL_HARITASI.md)
    await EbelgeSqlRepository.insertGiden(
      {
        uuid,
        belgeNo,
        belgeTuru: "EFatura",
        profil: girdi.senaryo,
        faturaTipi: girdi.faturaTipi,
        taslakMi: false,
        aliciVkn: girdi.alici.vknTckn,
        aliciAlias,
        aliciUnvan:
          girdi.alici.unvan || [girdi.alici.ad, girdi.alici.soyad].filter(Boolean).join(" ") || null,
        duzenlemeTarihi: new Date(tarih),
        tutar: ozet.odenecekTutar,
        paraBirimi: girdi.paraBirimi || "TRY",
        gonderimDurumu: "KUYRUKTA",
        semaGecerli,
        schematronGecerli,
        iceResponseMesaj: "Gönderim kuyruğunda.",
        kaynakFisId: secenek.kaynakFisId ?? null,
        xmlIcerik: xml,
        olusturan: kullanici,
        gonderen: kullanici,
        gonderimTarihi: new Date(),
      },
      dbContext
    );

    // 6) Gönder — sonuç arka planda kesinleşir
    await EbelgeKuyrukService.kuyrugaAl(
      {
        uuid,
        belgeTuru: "EFatura",
        islem: "GONDER",
        kullanici,
        veri: { fromVkn: gonderici.vknTckn, fromAlias, toVkn: girdi.alici.vknTckn, toAlias: aliciAlias },
      },
      dbContext
    );
    const sonuc = await this.kuyrukSonucu(uuid, "e-Fatura gönderimi reddedildi.", dbContext);

    return {
      uuid,
      belgeNo,
      ettn: uuid,
      durum: sonuc.durum,
      mesaj: sonuc.mesaj,
      tutar: ozet.odenecekTutar,
      kontorKalan: kontor.kalan,
      kontorUyari: kontor.uyari,
    };
  }

  /**
   * Kuyruğa alınan gönderimin kullanıcıya dönen sonucu (docs/EBELGE_KUYRUK_YOL_HARITASI.md Q1): ICE kısa
   * bekleme içinde açıkça reddettiyse hata; aksi halde "Gönderildi" — sonuç arka planda kesinleşir,
   * gönderilemezse giden kutusunda "Gönderilemedi" görünür.
   */
  private static async kuyrukSonucu(
    uuid: string,
    redMesaji: string,
    dbContext?: DbContext
  ): Promise<{ durum: "GONDERILDI"; mesaj: string }> {
    const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
    if (kayit?.gonderimDurumu === "HATA") {
      throw ApiError.conflict(String(kayit.ICE_RESPONSE_MESAJ || "").trim() || redMesaji);
    }
    return {
      durum: "GONDERILDI",
      mesaj: kayit?.gonderimDurumu === "GONDERILDI" ? String(kayit.ICE_RESPONSE_MESAJ || "").trim() : "Gönderildi.",
    };
  }

  /**
   * İptal kuyruğu (Q5): iptal isteği kuyruğa alınır ve kısa süre sonucu beklenir; ICE yetişmezse
   * arka planda tamamlanır. Açık ret belgeyi GONDERILDI'ye geri çeker ve hata olarak döner.
   */
  public static async iptalKuyrugu(
    kayit: any,
    iptalTarihi: Date,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ uuid: string; durum: string; mesaj: string }> {
    await EbelgeSqlRepository.earsivDurumGecir(
      kayit.uuid, "GONDERILDI", "IPTAL_EDILIYOR", { mesaj: "İptal ediliyor." }, dbContext, kayit.belgeTuru
    );
    await EbelgeKuyrukService.kuyrugaAl(
      { uuid: kayit.uuid, belgeTuru: kayit.belgeTuru, islem: "IPTAL", kullanici, veri: { iptalTarihi: iptalTarihi.toISOString() } },
      dbContext
    );
    const son = await EbelgeSqlRepository.getGiden(kayit.uuid, dbContext);
    if (son?.gonderimDurumu === "GONDERILDI") {
      throw ApiError.badRequest(String(son.ICE_RESPONSE_MESAJ || "").trim() || "İptal bildirimi kabul edilmedi.");
    }
    return {
      uuid: kayit.uuid,
      durum: "IPTAL",
      mesaj: son?.gonderimDurumu === "IPTAL" ? String(son.ICE_RESPONSE_MESAJ || "").trim() || "İptal edildi." : "İptal edildi.",
    };
  }

  /**
   * Taslağı onaylayıp **GİB'e gönderir** (`DraftApproval`).
   *
   * ⚠️⚠️ **GERİ ALINAMAZ.** Taslak artık iptal edilemez; belge GİB'e iletilir.
   *
   * `TASLAK → ONAYLANIYOR` geçişi **ICE çağrısından önce** ve atomik yapılır;
   * bağlantı koparsa `BELIRSIZ` kalır, ikinci onay engellenir.
   */
  public static async taslakOnayla(
    uuid: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ uuid: string; belgeNo: string; durum: string; mesaj: string }> {
    const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
    if (!kayit) throw ApiError.notFound("Giden belge kaydı bulunamadı.");
    if (kayit.belgeTuru !== "EFatura") {
      throw ApiError.badRequest("Taslak onayı yalnızca e-Fatura belgeleri içindir.");
    }
    if (kayit.gonderimDurumu !== "TASLAK") {
      throw ApiError.badRequest(
        `Yalnızca taslak durumundaki belgeler onaylanabilir. Bu belgenin durumu: ${kayit.gonderimDurumu}`
      );
    }

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const kontor = await this.kontorOnKontrol(config, dbContext, kullanici);

    // Atomik geçiş — ikinci istek buradan geçemez; onay çağrısı kuyrukta (docs/EBELGE_KUYRUK_YOL_HARITASI.md)
    await EbelgeSqlRepository.earsivDurumGecir(
      uuid,
      "TASLAK",
      "ONAYLANIYOR",
      { mesaj: "Onay kuyruğunda." },
      dbContext, "EFatura"
    );
    await EbelgeKuyrukService.kuyrugaAl({ uuid, belgeTuru: "EFatura", islem: "ONAY", kullanici }, dbContext);

    const son = await EbelgeSqlRepository.getGiden(uuid, dbContext);
    if (son?.gonderimDurumu === "TASLAK") {
      throw ApiError.badRequest(
        String(son.ICE_RESPONSE_MESAJ || "").trim() || "Taslak onaylanamadı; belge taslak olarak kaldı."
      );
    }

    return {
      uuid,
      belgeNo: kayit.belgeNo,
      durum: "GONDERILDI",
      mesaj: "Taslak onaylandı ve GİB'e gönderildi." + (kontor.uyari ? ` (${kontor.uyari})` : ""),
    };
  }

  /**
   * Giden belgenin güncel GİB statüsünü ICE'den çeker ve yerel kaydı günceller.
   */
  public static async gidenStatuYenile(
    uuid: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ uuid: string; statu: string | null; aciklama: string | null; portalStatu: string | null }> {
    const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
    if (!kayit) throw ApiError.notFound("Giden belge kaydı bulunamadı.");

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const detay = await getInvoiceStatusDetail(config, uuid);

    await EbelgeSqlRepository.writeLog(
      {
        metod: "Get_Invoice_Status_Detail",
        yon: "GIDEN",
        basarili: true,
        kullanici,
        ilgiliUuid: uuid,
        cevapOzet: `${detay.STATUS ?? ""} ${detay.STATUS_DESCRIPTION ?? ""}`.trim(),
      },
      dbContext
    );

    return {
      uuid,
      statu: detay.STATUS ? String(detay.STATUS) : null,
      aciklama: detay.STATUS_DESCRIPTION ? String(detay.STATUS_DESCRIPTION) : null,
      portalStatu: detay.PORTAL_STATUS ? String(detay.PORTAL_STATUS) : null,
    };
  }

  public static async taslakGonder(
    girdi: UblFaturaGirdi & { aliciAlias?: string },
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{
    uuid: string;
    belgeNo: string;
    ettn: string | null;
    durum: string;
    semaGecerli: boolean;
    schematronGecerli: boolean;
    mesaj: string;
    tutar: number;
  }> {
    // Aynı fatura numarası daha önce kullanılmış mı?
    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo.trim().toUpperCase(), dbContext)) {
      throw ApiError.conflict(
        `${girdi.belgeNo} numaralı belge daha önce oluşturulmuş. Aynı numara ikinci kez kullanılamaz.`
      );
    }

    const ayar = await EbelgeSqlRepository.getAyar(dbContext);
    const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
    const { xml, uuid, ozet } = buildInvoiceXml({ ...girdi, gonderici });
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);

    // 1) Önce doğrula — geçmezse ICE'ye taslak bile göndermeyelim
    const dogrulama = await invoiceCheckValidate(config, toBase64(xml), { html: false, pdf: false });
    const semaGecerli = String(dogrulama?.shema_validate).toLowerCase() === "true";
    const schematronGecerli = String(dogrulama?.shematron_validate).toLowerCase() === "true";

    if (!semaGecerli || !schematronGecerli) {
      await EbelgeSqlRepository.writeLog(
        {
          metod: "invoice_check_validate",
          yon: "GIDEN",
          basarili: false,
          kullanici,
          ilgiliUuid: uuid,
          istekOzet: `belgeNo=${girdi.belgeNo} (taslak öncesi doğrulama)`,
          hataMesaji: dogrulama?.response_message || "Doğrulamadan geçemedi",
        },
        dbContext
      );
      throw ApiError.unprocessable(
        dogrulama?.response_message?.trim() ||
          "Belge şema/schematron doğrulamasından geçemedi; taslak oluşturulmadı."
      );
    }

    // 2) Alıcı etiketi (alias) — verilmemişse mükellef sorgusundan ilkini al
    let aliciAlias = girdi.aliciAlias?.trim() || "";
    if (!aliciAlias) {
      const mukellef = await getUserListEFatura(config, girdi.alici.vknTckn);
      aliciAlias = pkEtiketiSec(mukellef.kullanicilar);
      if (!aliciAlias) {
        throw ApiError.badRequest(
          "Alıcı e-Fatura mükellefi görünmüyor (GİB posta kutusu etiketi bulunamadı). " +
            "Bu alıcıya e-Arşiv fatura kesilmelidir."
        );
      }
    }

    const fromAlias = await this.gondericiAliasCoz(config, ayar?.firmaAlias, gonderici.vknTckn, kullanici, dbContext);

    // 3) Taslak gönder — GİB'e gitmez
    const sonuc = await sendInvoiceTaslak(config, {
      fromVknTckn: gonderici.vknTckn,
      fromAlias,
      toVknTckn: girdi.alici.vknTckn,
      toAlias: aliciAlias,
      invoicesBase64: [toBase64(xml)],
    });

    const satirlar = gonderimSatirlari(sonuc);
    const ilk = satirlar[0] || {};
    const basarili = String(sonuc?.success).toLowerCase() === "true";
    const ettn = ilk.ettn ? String(ilk.ettn) : null;

    await EbelgeSqlRepository.writeLog(
      {
        metod: "send_invoice_taslak",
        yon: "GIDEN",
        basarili,
        kullanici,
        ilgiliUuid: ettn || uuid,
        istekOzet: `belgeNo=${girdi.belgeNo} alici=${girdi.alici.vknTckn} tutar=${ozet.odenecekTutar}`,
        cevapOzet: `${sonuc?.response_code ?? ""} ${sonuc?.response_message ?? ""}`.trim(),
      },
      dbContext
    );

    // 4) Sonucu ne olursa olsun kaydet — başarısız denemenin de izi kalsın
    await EbelgeSqlRepository.insertGiden(
      {
        uuid: ettn || uuid,
        belgeNo: girdi.belgeNo.trim().toUpperCase(),
        belgeTuru: "EFatura",
        profil: girdi.senaryo,
        faturaTipi: girdi.faturaTipi,
        taslakMi: true,
        aliciVkn: girdi.alici.vknTckn,
        aliciAlias,
        aliciUnvan:
          girdi.alici.unvan ||
          [girdi.alici.ad, girdi.alici.soyad].filter(Boolean).join(" ") ||
          null,
        duzenlemeTarihi: girdi.tarih ? new Date(girdi.tarih) : new Date(),
        tutar: ozet.odenecekTutar,
        paraBirimi: girdi.paraBirimi || "TRY",
        gonderimDurumu: basarili ? "TASLAK" : "HATA",
        semaGecerli,
        schematronGecerli,
        iceResponseCode: sonuc?.response_code != null ? String(sonuc.response_code) : null,
        iceResponseMesaj: ilk.response_message || sonuc?.response_message || null,
        xmlIcerik: xml,
        olusturan: kullanici,
        gonderen: kullanici,
        gonderimTarihi: new Date(),
      },
      dbContext
    );

    if (!basarili) {
      throw ApiError.badRequest(
        ilk.response_message?.trim() || sonuc?.response_message?.trim() || "Taslak oluşturulamadı."
      );
    }

    return {
      uuid: ettn || uuid,
      belgeNo: girdi.belgeNo.trim().toUpperCase(),
      ettn,
      durum: "TASLAK",
      semaGecerli,
      schematronGecerli,
      mesaj: sonuc?.response_message?.trim() || "",
      tutar: ozet.odenecekTutar,
    };
  }

  /* ======================================================================
     e-Arşiv (Faz 8a)
     ====================================================================== */

  /**
   * e-Arşiv faturası gönderir.
   *
   * ⚠️ **Mali sonuç doğurur.** e-Arşiv, e-Fatura mükellefi olmayan alıcıya kesilir;
   * GİB'e rapor olarak bildirilir ve iptali ancak "iptal bildirimi" ile yapılır.
   *
   * Akış e-Fatura taslağıyla aynı disiplinde:
   * numara tekilliği → UBL üret → `invoice_check_validate` → geçtiyse gönder.
   */
  /* ======================================================================
     Gönderim öncesi kontör kontrolü
     ====================================================================== */

  /**
   * `Get_Credit` cevabından kalan kontörü **ihtiyatlı** biçimde okur.
   *
   * ICE bu ucu dinamik bir DataSet olarak döndürüyor; kolon adları sözleşmede
   * sabit değil. Bu yüzden rastgele bir kolona güvenmek yerine:
   *
   *  - Kolon adı `kalan` / `kontor` / `bakiye` / `adet` / `miktar` kalıplarından
   *    birine uyan **ve** sayısal olan alanlar aranır.
   *  - Birden çok aday varsa **en küçüğü** esas alınır (en kısıtlayıcı olan).
   *  - Hiçbir aday bulunamazsa `okunabildi: false` döner — **uydurma yapılmaz**.
   *
   * Bu bir tahmin katmanıdır; gerçek kolon adları canlı örnekle teyit edilene
   * kadar sonucu **engelleyici** değil **uyarıcı** olarak kullanıyoruz (aşağıya bkz.).
   */
  public static kontorOku(satirlar: IceKontorSatiri[]): {
    okunabildi: boolean;
    kalan: number | null;
    kaynakAlan: string | null;
  } {
    const kalip = /(kalan|kontor|kontör|bakiye|adet|miktar|credit|remain)/i;
    const adaylar: { alan: string; deger: number }[] = [];

    for (const satir of satirlar || []) {
      if (!satir || typeof satir !== "object") continue;
      for (const [alan, ham] of Object.entries(satir)) {
        if (!kalip.test(alan)) continue;
        const sayi = Number(String(ham ?? "").replace(",", "."));
        if (Number.isFinite(sayi)) adaylar.push({ alan, deger: sayi });
      }
    }

    if (!adaylar.length) return { okunabildi: false, kalan: null, kaynakAlan: null };

    const enKisitlayici = adaylar.reduce((a, b) => (b.deger < a.deger ? b : a));
    return { okunabildi: true, kalan: enKisitlayici.deger, kaynakAlan: enKisitlayici.alan };
  }

  /**
   * Gönderim öncesi kontör kontrolü.
   *
   * **Tasarım kararı — neden engellemiyor:** kontör gerçekten bittiyse ICE zaten
   * gönderimi reddeder; asıl risk, kolon adını yanlış okuyup **geçerli bir gönderimi
   * boş yere durdurmaktır**. Bu yüzden yalnızca kontör *güvenle* okunabildiyse ve
   * sıfır/negatifse durdurulur. Okunamazsa gönderim sürer, sonuç `uyari` ile bildirilir.
   */
  public static async kontorOnKontrol(
    config: Awaited<ReturnType<typeof EbelgeSqlRepository.getConnectionConfig>>,
    dbContext: DbContext | undefined,
    kullanici: string
  ): Promise<{ kalan: number | null; uyari: string | null }> {
    let satirlar: IceKontorSatiri[] = [];
    try {
      satirlar = await this.fetchKontor(config, dbContext, kullanici);
    } catch (err: any) {
      logger.warn("Gönderim öncesi kontör sorgusu başarısız:", err);
      return { kalan: null, uyari: "Kontör bilgisi okunamadı; gönderim kontör kontrolü olmadan sürdürüldü." };
    }

    const { okunabildi, kalan, kaynakAlan } = this.kontorOku(satirlar);

    if (!okunabildi) {
      return {
        kalan: null,
        uyari:
          "Kontör cevabında tanınan bir 'kalan' alanı bulunamadı; gönderim kontör kontrolü olmadan sürdürüldü.",
      };
    }

    if (kalan !== null && kalan <= 0) {
      throw ApiError.unprocessable(
        `Entegratör kontörünüz tükenmiş görünüyor (${kaynakAlan}: ${kalan}). ` +
          `Belge gönderilmedi; ICE ile kontör yükleyip tekrar deneyiniz.`
      );
    }

    return { kalan, uyari: null };
  }

  /* ======================================================================
     e-Gider Pusulası (Faz 8d)
     ====================================================================== */

  /**
   * e-Gider Pusulası gönderir.
   *
   * ⚠️ **Mali sonuç doğurur ve ön doğrulaması yoktur.**
   * Canlı WSDL'de gider pusulası için `*_check_validate` ucu bulunmuyor
   * (yalnızca invoice / despatchadvice / producerreceipt var). Bu yüzden
   * e-Arşiv akışındaki "önce ICE'ye doğrulat" adımı burada uygulanamıyor;
   * yerel UBL doğrulaması tek savunma hattıdır.
   *
   * Akış: yerel numara ön kontrolü → UBL üret (yerel doğrulama) →
   * karşı taraf mükellef mi? → ICE son sıra kontrolü → **SQL rezervasyonu** →
   * gönderim → sonucu belge bazında doğrula.
   */
  public static async giderPusulasiOnizle(girdi: GiderPusulasiGirdi, dbContext?: DbContext) {
    if ((girdi.paraBirimi || "TRY") !== "TRY") throw ApiError.badRequest("Yalnızca TRY destekleniyor.");
    const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
    const { ozet } = buildGiderPusulasiXml({ ...girdi, gonderici });
    return { ozet, iceDogrulamasiYapildi: false };
  }

  public static async giderPusulasiGonder(
    girdi: GiderPusulasiGirdi,
    kullanici: string,
    dbContext?: DbContext,
    secenek: { kaynakFisId?: string } = {}
  ): Promise<{
    uuid: string;
    belgeNo: string;
    durum: string;
    mesaj: string;
    tutar: number;
    onDogrulamaYapildi: false;
    kontorKalan: number | null;
    kontorUyari: string | null;
  }> {
    const belgeNo = girdi.belgeNo.trim().toUpperCase();
    const tarih =
      girdi.tarih || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
    girdi = { ...girdi, belgeNo, tarih };

    if ((girdi.paraBirimi || "TRY").toUpperCase() !== "TRY") {
      throw ApiError.unprocessable(
        "Gider pusulası gönderimi şu anda yalnızca TRY cinsinden destekleniyor; döviz kuru alanları henüz uygulanmadı."
      );
    }

    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, dbContext)) {
      throw ApiError.conflict(
        `${belgeNo} numaralı belge daha önce oluşturulmuş. Aynı numara ikinci kez kullanılamaz.`
      );
    }

    const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
    const { xml, uuid, ozet } = buildGiderPusulasiXml({ ...girdi, belgeNo, gonderici });

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);

    // Karşı taraf e-Fatura mükellefi ise gider pusulası düzenlenmemelidir.
    const mukellef = await getUserListEFatura(config, girdi.alici.vknTckn);
    if (!mukellef.basarili) {
      throw ApiError.unprocessable(
        mukellef.mesaj || "Karşı tarafın mükellef durumu doğrulanamadı; gönderim durduruldu."
      );
    }
    if (mukellef.kullanicilar.length) {
      throw ApiError.unprocessable(
        "Karşı taraf e-Fatura mükellefi görünüyor. Mükelleften alımda gider pusulası değil fatura düzenlenmelidir."
      );
    }

    const son = await getSonBelgeId(
      config,
      belgeNo.slice(0, 3),
      "EGiderPusulasi",
      Number(belgeNo.slice(3, 7))
    );
    const sonSira = Number(son?.Son_Belge_ID);
    if (
      son?.Son_Belge_ID == null ||
      String(son.Son_Belge_ID).trim() === "" ||
      !Number.isInteger(sonSira) ||
      sonSira < 0
    ) {
      throw ApiError.unprocessable("ICE son belge numarası doğrulanamadı; gönderim durduruldu.");
    }
    if (Number(belgeNo.slice(7)) <= sonSira) {
      throw ApiError.conflict("Belge numarası ICE'de kullanılan son sıradan büyük olmalıdır.");
    }

    // Kontör tükenmişse belge numarasını yakmadan dur
    const kontor = await this.kontorOnKontrol(config, dbContext, kullanici);

    // Numarayı kalıcı olarak tut, gönderimi kuyruğa al (docs/EBELGE_KUYRUK_YOL_HARITASI.md)
    await EbelgeSqlRepository.insertGiden(
      {
        uuid,
        belgeNo,
        belgeTuru: "EGiderPusulasi",
        profil: "GIDERPUSULASI",
        faturaTipi: girdi.belgeTipi,
        taslakMi: false,
        aliciVkn: girdi.alici.vknTckn,
        aliciAlias: null,
        aliciUnvan:
          girdi.alici.unvan ||
          [girdi.alici.ad, girdi.alici.soyad].filter(Boolean).join(" ") ||
          null,
        duzenlemeTarihi: new Date(tarih),
        tutar: ozet.odenecekTutar,
        paraBirimi: girdi.paraBirimi || "TRY",
        gonderimDurumu: "KUYRUKTA",
        // Ön doğrulama ucu olmadığı için bu bayraklar bilinmiyor — false değil, NULL
        semaGecerli: null,
        schematronGecerli: null,
        iceResponseMesaj: "Gönderim kuyruğunda.",
        // Kaynak anahtarı (Perakende alış fişi): kuyruk sonucu kaynağa ve fişe de işlenir
        kaynakFisId: secenek.kaynakFisId ?? null,
        xmlIcerik: xml,
        olusturan: kullanici,
        gonderen: kullanici,
        gonderimTarihi: new Date(),
      },
      dbContext
    );

    await EbelgeKuyrukService.kuyrugaAl({ uuid, belgeTuru: "EGiderPusulasi", islem: "GONDER", kullanici }, dbContext);
    const sonuc = await this.kuyrukSonucu(uuid, "Gider pusulası gönderimi reddedildi.", dbContext);

    return {
      uuid,
      belgeNo,
      durum: sonuc.durum,
      mesaj: sonuc.mesaj,
      tutar: ozet.odenecekTutar,
      onDogrulamaYapildi: false,
      kontorKalan: kontor.kalan,
      kontorUyari: kontor.uyari,
    };
  }

  /** Gönderilmiş gider pusulasının PDF çıktısı */
  public static async giderPusulasiPdf(
    uuid: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<Buffer> {
    const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
    if (!kayit) throw ApiError.notFound("Giden belge kaydı bulunamadı.");
    if (kayit.belgeTuru !== "EGiderPusulasi") {
      throw ApiError.badRequest("Bu işlem yalnızca e-Gider Pusulası belgeleri içindir.");
    }
    if (kayit.gonderimDurumu !== "GONDERILDI") {
      throw ApiError.badRequest(
        `Yalnızca gönderimi kesinleşmiş belgelerin çıktısı alınabilir. Durum: ${kayit.gonderimDurumu}`
      );
    }

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const { pdf } = await getGiderPusulasiCikti(config, uuid, { pdf: true });

    await EbelgeSqlRepository.writeLog(
      {
        metod: "Get_EGiderPusulasi_HTML_PDF",
        yon: "GIDEN",
        basarili: Boolean(pdf?.length),
        kullanici,
        ilgiliUuid: uuid,
        cevapOzet: `${pdf?.length ?? 0} bayt`,
      },
      dbContext
    );

    if (!pdf?.length) throw ApiError.notFound("Belgenin PDF çıktısı alınamadı.");
    return pdf;
  }

  public static async mustahsilDogrula(girdi: MustahsilGirdi, dbContext?: DbContext) {
    const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
    const {xml,uuid,ozet}=buildMustahsilXml({...girdi,gonderici});
    const sonuc=await validateMustahsil(await EbelgeSqlRepository.getConnectionConfig(dbContext),toBase64(xml),true);
    const sema=String(sonuc.shema_validate).toLowerCase()==="true", schematron=String(sonuc.shematron_validate).toLowerCase()==="true";
    if(!sema||!schematron) throw ApiError.unprocessable(sonuc.response_message||"e-Müstahsil şema/schematron doğrulamasından geçemedi.");
    return {uuid,belgeNo:girdi.belgeNo.toUpperCase(),semaGecerli:sema,schematronGecerli:schematron,html:sonuc.producerreceipt_html||null,ozet};
  }

  public static async mustahsilGonder(girdi:MustahsilGirdi,kullanici:string,dbContext?:DbContext) {
    const belgeNo=girdi.belgeNo.trim().toUpperCase();
    if(await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo,dbContext)) throw ApiError.conflict("Bu müstahsil makbuzu numarası daha önce kullanılmış.");
    const gonderici=await this.goncericiTamamla(girdi.gonderici,dbContext), uretilen=buildMustahsilXml({...girdi,belgeNo,gonderici});
    const config=await EbelgeSqlRepository.getConnectionConfig(dbContext), kontrol=await validateMustahsil(config,toBase64(uretilen.xml),false);
    if(String(kontrol.shema_validate).toLowerCase()!=="true"||String(kontrol.shematron_validate).toLowerCase()!=="true") throw ApiError.unprocessable(kontrol.response_message||"e-Müstahsil doğrulanamadı; gönderilmedi.");
    // XML saklanır: kuyruk belirsiz sonuçta aynı belgeyi yeniden gönderebilsin (docs/EBELGE_KUYRUK_YOL_HARITASI.md)
    await EbelgeSqlRepository.insertGiden({uuid:uretilen.uuid,belgeNo,belgeTuru:"EMustahsil",profil:"EARSIVBELGE",faturaTipi:"MUSTAHSILMAKBUZ",taslakMi:false,
      aliciVkn:girdi.uretici.vknTckn,aliciUnvan:girdi.uretici.unvan||[girdi.uretici.ad,girdi.uretici.soyad].filter(Boolean).join(" "),duzenlemeTarihi:new Date(girdi.tarih||new Date()),
      tutar:uretilen.ozet.netOdenecek,paraBirimi:"TRY",gonderimDurumu:"KUYRUKTA",iceResponseMesaj:"Gönderim kuyruğunda.",xmlIcerik:uretilen.xml,olusturan:kullanici,gonderen:kullanici,gonderimTarihi:new Date()} as any,dbContext);
    await EbelgeKuyrukService.kuyrugaAl({uuid:uretilen.uuid,belgeTuru:"EMustahsil",islem:"GONDER",kullanici},dbContext);
    const sonuc=await this.kuyrukSonucu(uretilen.uuid,"e-Müstahsil reddedildi.",dbContext);
    return {uuid:uretilen.uuid,belgeNo,durum:sonuc.durum,mesaj:sonuc.mesaj,ozet:uretilen.ozet};
  }

  public static async mustahsilIptal(uuid:string,tarih:Date,kullanici:string,dbContext?:DbContext) {
    const k=await EbelgeSqlRepository.getGiden(uuid,dbContext); if(!k||k.belgeTuru!=="EMustahsil") throw ApiError.notFound("e-Müstahsil bulunamadı.");
    if(k.gonderimDurumu!=="GONDERILDI") throw ApiError.conflict("Yalnız gönderilmiş e-Müstahsil iptal edilebilir.");
    // İptal kuyruktan geçer (Q5)
    return this.iptalKuyrugu(k,tarih,kullanici,dbContext);
  }
  public static async mustahsilGelen(f:any,kullanici:string,dbContext?:DbContext){const x=await getProducerReceipts(await EbelgeSqlRepository.getConnectionConfig(dbContext),f); await EbelgeSqlRepository.writeLog({metod:"GetProducerReceipt",yon:"GELEN",basarili:true,kullanici,cevapOzet:`adet=${x.length}`} as any,dbContext); return x;}
  public static async mustahsilGelenStatu(uuid:string,statu:"Okunmadı"|"Okundu"|"Islendi"|"Islenmedi",kullanici:string,dbContext?:DbContext){const ok=await setProducerReceiptStatus(await EbelgeSqlRepository.getConnectionConfig(dbContext),uuid,statu); if(!ok)throw ApiError.unprocessable("ICE durum değişikliğini kabul etmedi."); await EbelgeSqlRepository.writeLog({metod:"Set_ProducerReceipt_Status",yon:"GELEN",basarili:true,kullanici,ilgiliUuid:uuid,istekOzet:`statu=${statu}`} as any,dbContext); return {uuid,statu};}

  public static async earsivGonder(
    girdi: UblFaturaGirdi,
    kullanici: string,
    dbContext?: DbContext,
    secenek: { kaynakFisId?: string } = {}
  ): Promise<{
    uuid: string;
    belgeNo: string;
    ettn: string | null;
    durum: string;
    mesaj: string;
    tutar: number;
    kontorKalan: number | null;
    kontorUyari: string | null;
  }> {
    const belgeNo = girdi.belgeNo.trim().toUpperCase();
    girdi = { ...girdi, belgeNo, tarih: girdi.tarih || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" }) };

    // Üreteç istisna, tevkifat, iade referansı, döviz kuru ve özel matrahı destekliyor (docs/ebelge-revizyon.md K4).
    // TEVKIFATIADE ICE portalinde yalnızca e-Fatura tiplerinde yer alır; e-Arşiv'de kesilmez.
    if (girdi.faturaTipi === "TEVKIFATIADE") {
      throw ApiError.unprocessable("Tevkifat iade tipi e-Arşiv faturada kullanılamaz.");
    }
    if (girdi.faturaTipi === "IHRACKAYITLI") {
      throw ApiError.unprocessable(
        "İhraç kayıtlı fatura bu üreteçte henüz desteklenmiyor; e-Arşiv akışında da beklenen bir tip değildir."
      );
    }

    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, dbContext)) {
      throw ApiError.conflict(
        `${belgeNo} numaralı belge daha önce oluşturulmuş. Aynı numara ikinci kez kullanılamaz.`
      );
    }

    // e-Arşiv senaryosu zorunlu — yanlış profille gönderim engellenir
    const gonderici = await this.goncericiTamamla(girdi.gonderici, dbContext);
    const { xml, uuid, ozet } = buildInvoiceXml({
      ...girdi,
      belgeNo,
      gonderici,
      senaryo: "EARSIVFATURA",
    });

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);

    // 1) Doğrulama — geçmezse gönderim yok
    const dogrulama = await invoiceCheckValidate(config, toBase64(xml), { html: false, pdf: false });
    const semaGecerli = String(dogrulama?.shema_validate).toLowerCase() === "true";
    const schematronGecerli = String(dogrulama?.shematron_validate).toLowerCase() === "true";

    if (!semaGecerli || !schematronGecerli) {
      throw ApiError.unprocessable(
        dogrulama?.response_message?.trim() ||
          "Belge şema/schematron doğrulamasından geçemedi; e-Arşiv gönderilmedi."
      );
    }

    // Başarısız mükellef sorgusu, "mükellef değil" anlamına gelmez.
    const mukellef = await getUserListEFatura(config, girdi.alici.vknTckn);
    if (!mukellef.basarili) {
      throw ApiError.unprocessable(mukellef.mesaj || "Alıcının mükellef durumu doğrulanamadı; gönderim durduruldu.");
    }
    if (mukellef.kullanicilar.length) {
      throw ApiError.unprocessable("Alıcı e-Fatura mükellefi; bu akıştan e-Arşiv gönderilemez.");
    }
    // Serinin son sırası — e-Fatura + e-Arşiv + yerel kayıt ortak (aynı seri iki türde kullanılabilir)
    const sonSira = await this.seriSonSira(config, belgeNo.slice(0, 3), Number(belgeNo.slice(3, 7)), dbContext, false);
    if (Number(belgeNo.slice(7)) <= sonSira) {
      throw ApiError.conflict(
        `Fatura numarası ${belgeNo.slice(0, 3)} serisinde kullanılan son sıradan (${sonSira}) büyük olmalıdır; numarayı yenileyin.`
      );
    }

    // Kontör tükenmişse belge numarasını yakmadan dur
    const kontor = await this.kontorOnKontrol(config, dbContext, kullanici);

    // Numarayı kalıcı olarak tut (UNIQUE indeks yarışan isteği durdurur), gönderimi kuyruğa al
    await EbelgeSqlRepository.insertGiden(
      {
        uuid,
        belgeNo,
        belgeTuru: "EArsiv",
        profil: "EARSIVFATURA",
        faturaTipi: girdi.faturaTipi,
        taslakMi: false,
        aliciVkn: girdi.alici.vknTckn,
        aliciAlias: null,
        aliciUnvan:
          girdi.alici.unvan || [girdi.alici.ad, girdi.alici.soyad].filter(Boolean).join(" ") || null,
        duzenlemeTarihi: girdi.tarih ? new Date(girdi.tarih) : new Date(),
        tutar: ozet.odenecekTutar,
        paraBirimi: girdi.paraBirimi || "TRY",
        gonderimDurumu: "KUYRUKTA",
        semaGecerli,
        schematronGecerli,
        iceResponseMesaj: "Gönderim kuyruğunda.",
        kaynakFisId: secenek.kaynakFisId ?? null,
        xmlIcerik: xml,
        olusturan: kullanici,
        gonderen: kullanici,
        gonderimTarihi: new Date(),
      },
      dbContext
    );

    await EbelgeKuyrukService.kuyrugaAl({ uuid, belgeTuru: "EArsiv", islem: "GONDER", kullanici }, dbContext);
    const sonuc = await this.kuyrukSonucu(uuid, "e-Arşiv gönderimi reddedildi.", dbContext);

    return {
      uuid,
      belgeNo,
      ettn: uuid,
      durum: sonuc.durum,
      mesaj: sonuc.mesaj,
      tutar: ozet.odenecekTutar,
      kontorKalan: kontor.kalan,
      kontorUyari: kontor.uyari,
    };
  }

  /**
   * e-Arşiv faturası için GİB'e iptal bildirimi gönderir.
   * ⚠️ Belgeyi silmez; iptal edildiğini raporlar. Geri alınamaz.
   */
  public static async earsivIptal(
    uuid: string,
    iptalTarihi: Date,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ uuid: string; durum: string; mesaj: string }> {
    const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
    if (!kayit) throw ApiError.notFound("Giden belge kaydı bulunamadı.");
    if (kayit.belgeTuru !== "EArsiv") {
      throw ApiError.badRequest("Bu işlem yalnızca e-Arşiv faturaları içindir.");
    }
    if (kayit.gonderimDurumu === "IPTAL") {
      throw ApiError.conflict("Bu belge için iptal bildirimi zaten gönderilmiş.");
    }
    if (kayit.gonderimDurumu !== "GONDERILDI") {
      throw ApiError.badRequest(
        `Yalnızca gönderilmiş e-Arşiv faturaları iptal edilebilir. Durum: ${kayit.gonderimDurumu}`
      );
    }

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const duzenleme = new Date(kayit.DUZENLEME_TARIHI);
    if (!Number.isFinite(iptalTarihi.getTime()) || !Number.isFinite(duzenleme.getTime()) ||
        iptalTarihi.toISOString().slice(0, 10) < duzenleme.toISOString().slice(0, 10) ||
        iptalTarihi.toISOString().slice(0, 10) > new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" })) {
      throw ApiError.badRequest("İptal tarihi düzenleme tarihinden önce veya bugünden sonra olamaz.");
    }
    // İptal kuyruktan geçer (Q5)
    return this.iptalKuyrugu(kayit, iptalTarihi, kullanici, dbContext);
  }

  /**
   * e-Arşiv raporlanma ve e-posta durumunu sorgular.
   * e-Arşiv'de belgenin GİB'e ulaşması **rapora** bağlıdır.
   */
  public static async earsivDurum(
    ettnler: string[],
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ rapor: any[]; mail: any[]; hatalar: string[] }> {
    if (!ettnler.length) throw ApiError.badRequest("En az bir ETTN gereklidir.");
    if (ettnler.length > 100) throw ApiError.badRequest("Bir seferde en fazla 100 belge sorgulanabilir.");
    for (const ettn of ettnler) {
      const kayit = await EbelgeSqlRepository.getGiden(ettn, dbContext);
      if (!kayit || kayit.belgeTuru !== "EArsiv") throw ApiError.notFound("e-Arşiv kaydı bulunamadı.");
    }

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const hatalar: string[] = [];
    const [rapor, mail] = await Promise.all([
      getEarsivRaporStatu(config, ettnler).catch((err) => {
        logger.warn("GetInvoice_Rapor_Statu başarısız:", err);
        hatalar.push("Rapor durumu alınamadı. Tekrar sorgulayınız.");
        return [] as any[];
      }),
      getEarsivMailStatu(config, ettnler).catch((err) => {
        logger.warn("GetInvoice_EMail_Statu başarısız:", err);
        hatalar.push("E-posta durumu alınamadı. Tekrar sorgulayınız.");
        return [] as any[];
      }),
    ]);

    await EbelgeSqlRepository.writeLog(
      {
        metod: "EARSIV_DURUM",
        yon: "GIDEN",
        basarili: hatalar.length === 0,
        kullanici,
        istekOzet: `${ettnler.length} belge`,
      },
      dbContext
    );

    if (hatalar.length === 2) throw ApiError.unprocessable(hatalar.join(" "));
    return { rapor, mail, hatalar };
  }

  public static async senkronizeEarsivArsiv(
    filtre: { baslangic: Date; bitis: Date; limit: number }, kullanici: string, dbContext?: DbContext
  ) {
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const belgeler = await getEArchive(config, filtre);
    let yazilan = 0;
    let atlanan = 0;
    for (const belge of belgeler) {
      const h = belge.HEADER;
      const uuid = String(belge.UUID || "").trim();
      const no = String(belge.ID || "").trim();
      const tarih = parseIceDate(h?.ISSUE_DATE);
      const tutar = parseAmount(h?.PAYABLE_AMOUNT);
      if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(uuid) || !no || no.length > 40 ||
          !h || !tarih || (tutar !== null && !Number.isFinite(tutar))) {
        atlanan++;
        continue;
      }
      await EbelgeSqlRepository.upsertEarsivArsiv({
        uuid, belgeNo: no, tarih, tutar,
        aliciVkn: h.CUSTOMER || null, aliciUnvan: h.CUSTOMER_TITLE || null,
        gondericiVkn: h.SUPPLIER || null, gondericiUnvan: h.SUPPLIER_TITLE || null,
        paraBirimi: parseCurrency(h.PAYABLE_AMOUNT), profil: h.PROFILEID || null,
        iceStatuKodu: belge.STATUS_CODE == null ? null : String(belge.STATUS_CODE),
        iceStatuAciklama: belge.STATUS_DESCRIPTION || null,
      }, dbContext);
      yazilan++;
    }
    const siniraUlasildi = belgeler.length >= filtre.limit;
    await EbelgeSqlRepository.writeLog({ metod: "GetEArchive", yon: "GELEN", kullanici,
      basarili: atlanan === 0, cevapOzet: `cekilen=${belgeler.length} yazilan=${yazilan} atlanan=${atlanan} limit=${siniraUlasildi}`,
    }, dbContext);
    return { cekilen: belgeler.length, yazilan, atlanan, siniraUlasildi,
      uyari: siniraUlasildi ? "ICE sorgu sınırına ulaşıldı. Tüm belgeler alınmış olmayabilir; tarih aralığını daraltınız." : null };
  }

  public static async earsivArsivIsaretle(uuid: string, statu: IceBelgeStatu, kullanici: string, dbContext?: DbContext) {
    if (!await EbelgeSqlRepository.earsivArsivVarMi(uuid, dbContext)) throw ApiError.notFound("Arşiv kaydı bulunamadı; önce senkronize ediniz.");
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const basarili = await setEArchiveStatus(config, uuid, statu);
    await EbelgeSqlRepository.writeLog({ metod: "Set_EArchive_Status", yon: "GIDEN", basarili,
      kullanici, ilgiliUuid: uuid, istekOzet: `statu=${statu}` }, dbContext);
    if (!basarili) throw ApiError.unprocessable("ICE arşiv işaretini kabul etmedi.");
    await EbelgeSqlRepository.setEarsivArsivIsaret(uuid, statu, kullanici, dbContext);
    return { uuid, statu };
  }

  /**
   * Gönderilmiş belgeyi alıcıya **e-posta ile gönderir**.
   *
   * `GetInvoice_EMail_Statu` mail *durumunu okur*; bu metot gerçekten **mail gönderir**.
   * Tekrar tekrar çağrılırsa alıcıya birden çok mail gider — bu yüzden ICE çağrısında
   * otomatik yeniden deneme kapalıdır ve ekran iki adımlı onay ister.
   */
  public static async belgeMailGonder(
    uuid: string,
    alicilar: { unvan?: string; eposta: string }[],
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ uuid: string; gonderilen: number; basarisiz: number; sonuclar: any[] }> {
    const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
    if (!kayit) throw ApiError.notFound("Giden belge kaydı bulunamadı.");
    // Gönderimi henüz kesinleşmemiş belgede mail kuyruğa alınır, belge kesinleşince gider (Q4)
    const askida = ASKIDAKI_DURUMLAR.includes(String(kayit.gonderimDurumu));
    if (kayit.gonderimDurumu !== "GONDERILDI" && !askida) {
      throw ApiError.badRequest(
        `Yalnızca gönderilmiş belgeler için mail gönderilebilir. Durum: ${kayit.gonderimDurumu}`
      );
    }

    const temizAlicilar = (alicilar || [])
      .map((a) => ({ unvan: a.unvan?.trim(), eposta: a.eposta?.trim() || "" }))
      .filter((a) => a.eposta);
    if (!temizAlicilar.length) {
      throw ApiError.badRequest("En az bir e-posta adresi gereklidir.");
    }
    const gecersiz = temizAlicilar.find((a) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.eposta));
    if (gecersiz) {
      throw ApiError.badRequest(`Geçersiz e-posta adresi: ${gecersiz.eposta}`);
    }
    if (askida) {
      await EbelgeKuyrukService.kuyrugaAl(
        { uuid, belgeTuru: kayit.belgeTuru as BelgeTuru, islem: "MAIL", kullanici, veri: { alicilar: temizAlicilar } },
        dbContext,
        0
      );
      return { uuid, gonderilen: temizAlicilar.length, basarisiz: 0, sonuclar: [] };
    }

    // Belge türünü ICE'nin mail enum'una eşle
    const belgeTuru: EmailBelgeTuru =
      kayit.belgeTuru === "EArsiv"
        ? "EArsiv"
        : kayit.belgeTuru === "EFatura"
          ? "EFatura_Giden"
          : kayit.belgeTuru === "EIrsaliye"
            ? "EIrsaliye_Giden"
            : kayit.belgeTuru === "EGiderPusulasi"
              ? "EGiderPusulasi"
              : "Diger";

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const sonuclar = await sendDocumentEmail(config, [
      { belgeNo: kayit.belgeNo, uuid, belgeTuru, alicilar: temizAlicilar },
    ]);

    const basarili = sonuclar.filter((r) => String(r.Result).toLowerCase() === "true");
    const basarisiz = sonuclar.filter((r) => String(r.Result).toLowerCase() !== "true");

    await EbelgeSqlRepository.writeLog(
      {
        metod: "Send_Document_Email",
        yon: "GIDEN",
        basarili: basarisiz.length === 0 && basarili.length > 0,
        kullanici,
        ilgiliUuid: uuid,
        istekOzet: `belgeNo=${kayit.belgeNo} tur=${belgeTuru} alici=${temizAlicilar.length}`,
        cevapOzet: `basarili=${basarili.length} basarisiz=${basarisiz.length}`,
      },
      dbContext
    );

    // ICE hiç sonuç döndürmediyse "gitti" sayılmaz
    if (!sonuclar.length) {
      throw ApiError.unprocessable(
        "ICE mail gönderimi için sonuç döndürmedi; gönderildiği doğrulanamadı."
      );
    }
    if (!basarili.length) {
      throw ApiError.badRequest(
        basarisiz[0]?.ResultMessage?.trim() || "Mail gönderilemedi."
      );
    }

    return {
      uuid,
      gonderilen: basarili.length,
      basarisiz: basarisiz.length,
      sonuclar,
    };
  }

  /** Kesilmiş e-Arşiv faturasının görüntüsü (ICE PDF ya da HTML döndürebilir) */
  public static async earsivPdf(
    uuid: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<IceGoruntu> {
    const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
    if (!kayit) throw ApiError.notFound("Giden belge kaydı bulunamadı.");

    if (kayit.belgeTuru !== "EArsiv" || !["GONDERILDI", "IPTAL"].includes(kayit.gonderimDurumu)) {
      throw ApiError.badRequest("PDF yalnızca gönderimi kesinleşmiş e-Arşiv belgelerinde alınabilir.");
    }
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const goruntu = await previewInvoice(config, {
      vknTckn: kayit.ALICI_VKN || kayit.aliciVkn || "",
      faturaNo: kayit.belgeNo,
      duzenlenmeTarihi: kayit.DUZENLEME_TARIHI ? new Date(kayit.DUZENLEME_TARIHI) : new Date(),
      odenecekTutar: Number(kayit.TUTAR ?? kayit.tutar ?? 0),
    });

    await EbelgeSqlRepository.writeLog(
      {
        metod: "preview_invoice",
        yon: "GIDEN",
        basarili: goruntu.veri.length > 0,
        kullanici,
        ilgiliUuid: uuid,
        cevapOzet: `${goruntu.tur} · ${goruntu.veri.length} bayt`,
      },
      dbContext
    );

    if (!goruntu.veri.length) throw ApiError.notFound("Belgenin görüntüsü alınamadı.");
    return goruntu;
  }

  /**
   * Giden belgenin önizlemesi (Q6: tarihe basınca). Kendi sakladığımız XML'den ICE'nin doğrulama ucu
   * ile üretilir — belge kuyruktayken de açılır, hiçbir şey göndermez. XML'i olmayanlarda ICE çıktısı.
   */
  public static async gidenOnizleme(uuid: string, kullanici: string, dbContext?: DbContext): Promise<IceGoruntu> {
    const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
    if (!kayit) throw ApiError.notFound("Giden belge kaydı bulunamadı.");
    const xml = String(kayit.XML_ICERIK || "");
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const b64Goruntu = (pdf?: string, html?: string): IceGoruntu | null => {
      const temiz = typeof pdf === "string" ? pdf.replace(/\s/g, "") : "";
      if (temiz) return goruntuCoz(Buffer.from(temiz, "base64"));
      if (typeof html === "string" && html.trim()) return { tur: "html", veri: Buffer.from(html, "utf8") };
      return null;
    };

    let goruntu: IceGoruntu | null = null;
    const tur = kayit.belgeTuru as string;
    if (xml && (tur === "EFatura" || tur === "EArsiv")) {
      const d = await invoiceCheckValidate(config, toBase64(xml), { html: true, pdf: true });
      goruntu = b64Goruntu(d?.invoice_pdf, d?.invoice_html);
    } else if (xml && tur === "EIrsaliye") {
      const d = await despatchAdviceCheckValidate(config, toBase64(xml), { html: true, pdf: true });
      goruntu = b64Goruntu(d?.despatchadvice_pdf, d?.despatchadvice_html);
    } else if (xml && tur === "EMustahsil") {
      const d = await validateMustahsil(config, toBase64(xml), true);
      goruntu = b64Goruntu(undefined, d?.producerreceipt_html);
    } else if (tur === "EGiderPusulasi") {
      if (kayit.gonderimDurumu !== "GONDERILDI" && kayit.gonderimDurumu !== "IPTAL") {
        throw ApiError.badRequest("Gider pusulası görüntüsü birkaç dakika içinde hazır olur; tekrar deneyiniz.");
      }
      const c = await getGiderPusulasiCikti(config, uuid, { pdf: true, html: true });
      goruntu = c.pdf ? { tur: "pdf", veri: c.pdf } : b64Goruntu(undefined, c.html ?? undefined);
    }

    await EbelgeSqlRepository.writeLog(
      {
        metod: "GIDEN_ONIZLEME",
        yon: "GIDEN",
        basarili: !!goruntu?.veri.length,
        kullanici,
        ilgiliUuid: uuid,
        cevapOzet: goruntu ? `${goruntu.tur} · ${goruntu.veri.length} bayt` : "görüntü yok",
      },
      dbContext
    );
    if (!goruntu?.veri.length) throw ApiError.notFound("Belgenin önizlemesi alınamadı.");
    return goruntu;
  }

  /**
   * Taslağı iptal eder (`DraftCancel`).
   * Bu çağrı GİB'e bir şey göndermez; ICE'deki taslağı siler.
   */
  public static async taslakIptal(
    uuid: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<{ uuid: string; durum: string; mesaj: string }> {
    const kayit = await EbelgeSqlRepository.getGiden(uuid, dbContext);
    if (!kayit) throw ApiError.notFound("Giden belge kaydı bulunamadı.");

    if (kayit.gonderimDurumu !== "TASLAK") {
      throw ApiError.badRequest(
        `Yalnızca taslak durumundaki belgeler iptal edilebilir. Bu belgenin durumu: ${kayit.gonderimDurumu}`
      );
    }

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const sonuc = await sendDraftDocumentApproval(config, kayit.belgeNo, "EFatura", "DraftCancel");
    const basarili = String(sonuc?.success).toLowerCase() === "true";

    await EbelgeSqlRepository.writeLog(
      {
        metod: "send_draft_document_approval",
        yon: "GIDEN",
        basarili,
        kullanici,
        ilgiliUuid: uuid,
        istekOzet: `processType=DraftCancel belgeNo=${kayit.belgeNo}`,
        cevapOzet: `${sonuc?.response_message ?? ""} ${sonuc?.response_message_detail ?? ""}`.trim(),
      },
      dbContext
    );

    if (!basarili) {
      throw ApiError.badRequest(
        sonuc?.response_message?.trim() || "Taslak iptal edilemedi."
      );
    }

    await EbelgeSqlRepository.setGidenIptal(uuid, kullanici, dbContext);

    return { uuid, durum: "IPTAL", mesaj: sonuc?.response_message?.trim() || "Taslak iptal edildi." };
  }

  /** Giden belge listesi */
  public static async listGiden(
    filtre: { sayfa?: number; boyut?: number; arama?: string; durum?: string; belgeTuru?: string; baslangicTarihi?: string; bitisTarihi?: string },
    dbContext?: DbContext
  ) {
    return EbelgeSqlRepository.listGiden(filtre, dbContext);
  }

  /**
   * ICE'den seri bulma — yalnızca E-Belge Ayarları'ndaki "ICE'den serileri bul" düğmesi için (R3). Seriler bu hesaptan
   * daha önce kesilmiş belgelerden bulunur: yerel giden kaydı + ICE'deki gönderilmiş belgeler (e-Fatura: GetInvoice OUT,
   * e-Arşiv: GetEArchive, son iki yıl).
   */
  public static async iceSerileriBul(belgeTuru: SeriBelgeTuru, dbContext?: DbContext): Promise<string[]> {
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const seriler = new Set<string>();
    const seriEkle = (no: unknown) => {
      const s = String(no || "").trim().toUpperCase();
      if (FATURA_NO_BICIMI.test(s)) seriler.add(s.slice(0, 3));
    };
    (await EbelgeSqlRepository.gidenSerileri(belgeTuru, dbContext).catch(() => [])).forEach((s) => seriler.add(s));

    const yil = new Date().getFullYear();
    const baslangic = new Date(yil - 1, 0, 1);
    const bitis = new Date();
    try {
      if (belgeTuru === "EFatura") {
        const { faturalar } = await getInvoices(
          config,
          { yon: "OUT", baslangicTarihi: baslangic, bitisTarihi: bitis, limit: 500, okunmuslarDahil: true, islenmislerDahil: true },
          true
        );
        faturalar.forEach((f) => seriEkle(f.ID));
      } else {
        (await getEArchive(config, { baslangic, bitis, limit: 500 })).forEach((k) => seriEkle(k.ID));
      }
    } catch (err: any) {
      if (!seriler.size) throw ApiError.unprocessable(`ICE'den ${belgeTuru} belgeleri alınamadı: ${err?.message || err}`);
      logger.warn(`Seri bulma: ICE ${belgeTuru} listesi alınamadı, yerel kayıtlarla devam ediliyor:`, err);
    }
    return [...seriler].sort();
  }

  /**
   * Fatura no önerileri (R3): YALNIZCA E-Belge Ayarları'nda bu tür için tanımlı seriler. Her seri için ICE'deki son sıra
   * (`Get_Son_Belge_ID`) alınır ve bir fazlası önerilir; varsayılan seri işaretlenir. Tanımlı seri yoksa boş liste.
   */
  public static async faturaNoOnerileri(
    belgeTuru: SeriBelgeTuru,
    yil: number,
    dbContext?: DbContext
  ): Promise<{ seri: string; sonSira: number; onerilenNo: string; varsayilan: boolean }[]> {
    const tanimli = await EbelgeSeriRepository.listele(belgeTuru, dbContext);
    if (!tanimli.length) return [];
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);

    const sonuc: { seri: string; sonSira: number; onerilenNo: string; varsayilan: boolean }[] = [];
    for (const { seri, varsayilan } of tanimli) {
      const sonSira = await this.seriSonSira(config, seri, yil, dbContext);
      sonuc.push({ seri, sonSira, onerilenNo: faturaNoUret(seri, yil, sonSira + 1), varsayilan });
    }
    return sonuc;
  }

  /**
   * Bir serinin o yıldaki son sırası (28.09.2026): ICE son numarayı belge türüne göre AYRI tutar (Get_Son_Belge_ID
   * EFatura / EArsiv); aynı seri iki türde kullanılınca biri ilerlerken diğeri geride kalıp kullanılmış numarayı
   * önerir. Fatura numarası firma içinde türden bağımsız tek olmalı → e-Fatura, e-Arşiv ve yerel giden kaydının en büyüğü.
   */
  private static async seriSonSira(
    config: Awaited<ReturnType<typeof EbelgeSqlRepository.getConnectionConfig>>,
    seri: string,
    yil: number,
    dbContext?: DbContext,
    perakendeDahil = true
  ): Promise<number> {
    const iceSon = async (tur: "EFatura" | "EArsiv") => {
      const son = await getSonBelgeId(config, seri, tur, yil);
      const sira = Number(son?.Son_Belge_ID);
      if (son?.Son_Belge_ID == null || String(son.Son_Belge_ID).trim() === "" || !Number.isInteger(sira) || sira < 0) {
        throw ApiError.unprocessable(`ICE'den ${seri} serisinin ${tur} son numarası alınamadı; işlem durduruldu.`);
      }
      return sira;
    };
    const [efatura, earsiv, yerel] = await Promise.all([
      iceSon("EFatura"),
      iceSon("EArsiv"),
      EbelgeSqlRepository.seriYerelSonSira(seri, yil, dbContext, perakendeDahil),
    ]);
    return Math.max(efatura, earsiv, yerel);
  }

  /**
   * ICE tarafındaki son belge numarasını sorar.
   * Kendi numaratörümüzle karşılaştırıp çakışmayı gönderimden önce yakalamak için.
   */
  public static async getSonBelgeNo(
    seri: string,
    belgeTuru: string,
    yil: number,
    dbContext?: DbContext
  ): Promise<any> {
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    return getSonBelgeId(config, seri, belgeTuru, yil);
  }

  /* ======================================================================
     Gelen kutusu — cevap ve statü (Faz 4)
     ====================================================================== */

  /**
   * Gelen ticari faturaya **kabul veya red** cevabı gönderir.
   *
   * GERİ ALINAMAZ bir işlemdir. Çift gönderime karşı üç katman:
   *  1. Süreç içi kilit — aynı anda gelen ikinci istek beklemez, reddedilir.
   *  2. Veritabanı "yer tutma" — `RED_KABUL IS NULL` koşuluyla güncelleme;
   *     satır zaten cevaplanmışsa 0 satır etkilenir ve işlem 409 ile durur.
   *  3. ICE çağrısında otomatik yeniden deneme **kapalı**.
   *
   * ICE çağrısı başarısız olursa yerel yer tutma kaydı geri alınır ki
   * kullanıcı işlemi tekrar deneyebilsin.
   */
  public static async cevapVer(
    uuid: string,
    redKabul: "Red" | "Kabul",
    aciklama: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<GelenBelgeSatiri> {
    const kilitAnahtari = `${dbContext?.dbServer || "-"}:${dbContext?.dbName || "-"}:${uuid}`;

    if (cevapKilitleri.has(kilitAnahtari)) {
      throw ApiError.conflict("Bu belge için bir cevap işlemi zaten sürüyor. Lütfen bekleyiniz.");
    }
    cevapKilitleri.add(kilitAnahtari);

    try {
      const kayit = await EbelgeSqlRepository.getGelen(uuid, dbContext);
      if (!kayit) {
        throw ApiError.notFound("Belge yerel kayıtlarda bulunamadı. Önce senkronize ediniz.");
      }

      if (kayit.redKabul) {
        throw ApiError.conflict(
          `Bu belgeye zaten "${kayit.redKabul}" cevabı verilmiş` +
            (kayit.redKabulKullanici ? ` (${kayit.redKabulKullanici})` : "") +
            ". Cevap geri alınamaz."
        );
      }

      // Temel faturaya kabul/red cevabı verilmez; yalnızca ticari faturaya verilir.
      const profil = String(kayit.profil || "").toUpperCase();
      if (profil.includes("TEMEL")) {
        throw ApiError.badRequest(
          "Temel senaryo faturasına kabul/red cevabı verilemez. Bu işlem yalnızca ticari faturalar içindir."
        );
      }

      if (redKabul === "Red" && !aciklama.trim()) {
        throw ApiError.badRequest("Red cevabı için açıklama zorunludur.");
      }

      // Bağlantı yapılandırmasını ICE çağrısından ÖNCE al; ayar eksikse
      // yerel kayda hiç dokunmadan hata verelim.
      const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);

      // 1) Yerelde yer tut — aynı anda ikinci istek buradan geçemez
      const yerTutuldu = await EbelgeSqlRepository.setGelenRedKabul(
        uuid,
        redKabul,
        aciklama,
        kullanici,
        dbContext
      );
      if (!yerTutuldu) {
        throw ApiError.conflict("Bu belgeye bu sırada başka bir kullanıcı cevap verdi.");
      }

      // 2) ICE'ye gönder — başarısız olursa yer tutmayı geri al
      try {
        const sonuc = await invoiceRedKabul(config, uuid, redKabul, aciklama);

        const basarili = String(sonuc?.success).toLowerCase() === "true";
        if (!basarili) {
          throw ApiError.badRequest(
            sonuc?.response_message?.trim() || "Entegratör cevabı reddetti."
          );
        }

        await EbelgeSqlRepository.writeLog(
          {
            metod: "invoice_Red_Kabul",
            yon: "GIDEN",
            basarili: true,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `redKabul=${redKabul}`,
            cevapOzet: sonuc?.response_message || undefined,
          },
          dbContext
        );
      } catch (err: any) {
        await EbelgeSqlRepository.clearGelenRedKabul(uuid, dbContext).catch(() => undefined);
        await EbelgeSqlRepository.writeLog(
          {
            metod: "invoice_Red_Kabul",
            yon: "GIDEN",
            basarili: false,
            kullanici,
            ilgiliUuid: uuid,
            istekOzet: `redKabul=${redKabul}`,
            hataMesaji: err?.message || "Bilinmeyen hata",
          },
          dbContext
        );
        throw err;
      }

      return (await EbelgeSqlRepository.getGelen(uuid, dbContext))!;
    } finally {
      cevapKilitleri.delete(kilitAnahtari);
    }
  }

  /**
   * Belgenin okundu / işlendi statüsünü ICE tarafında işaretler.
   */
  public static async statuIsle(
    uuid: string,
    statu: IceBelgeStatu,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<GelenBelgeSatiri> {
    const kayit = await EbelgeSqlRepository.getGelen(uuid, dbContext);
    if (!kayit) {
      throw ApiError.notFound("Belge yerel kayıtlarda bulunamadı.");
    }

    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const basarili = await setInvoiceStatus(config, uuid, statu);

    await EbelgeSqlRepository.writeLog(
      {
        metod: "Set_Invoice_Status",
        yon: "GIDEN",
        basarili,
        kullanici,
        ilgiliUuid: uuid,
        istekOzet: `statu=${statu}`,
      },
      dbContext
    );

    if (!basarili) {
      throw ApiError.badRequest("Entegratör statü güncellemesini kabul etmedi.");
    }

    await EbelgeSqlRepository.setGelenOkunmaDurumu(
      uuid,
      {
        okunduMu: statu === "Okundu" ? true : statu === "Okunmadı" ? false : undefined,
        islendiMi: statu === "Islendi" ? true : statu === "Islenmedi" ? false : undefined,
      },
      dbContext
    );

    return (await EbelgeSqlRepository.getGelen(uuid, dbContext))!;
  }

  /**
   * Belgenin HTML çıktısı.
   *
   * DİKKAT: Bu HTML'i ICE üretiyor, yani bizim denetimimizde değil.
   * Frontend onu ASLA dangerouslySetInnerHTML ile basmaz; sandbox'lı iframe'e
   * srcdoc olarak verir (docs/ice-baglanti.md §11.1 S5).
   */
  public static async getGelenHtml(
    uuid: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<string> {
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const html = await getInvoiceHtml(config, uuid);

    await EbelgeSqlRepository.writeLog(
      { metod: "GetInvoice_HTML", yon: "GELEN", basarili: true, kullanici, ilgiliUuid: uuid },
      dbContext
    );

    if (!html.trim()) {
      throw ApiError.notFound("Belgenin HTML çıktısı entegratörden alınamadı.");
    }
    return html;
  }

  /**
   * Belgenin PDF çıktısı. Base64 gövde JSON içinde taşınmaz;
   * denetleyici bunu doğrudan application/pdf olarak akıtır (§11.1 S10).
   */
  public static async getGelenPdf(
    uuid: string,
    kullanici: string,
    dbContext?: DbContext
  ): Promise<Buffer> {
    const config = await EbelgeSqlRepository.getConnectionConfig(dbContext);
    const pdf = await getInvoicePdf(config, uuid);

    await EbelgeSqlRepository.writeLog(
      {
        metod: "GetInvoice_PDF",
        yon: "GELEN",
        basarili: pdf.length > 0,
        kullanici,
        ilgiliUuid: uuid,
        cevapOzet: `${pdf.length} bayt`,
      },
      dbContext
    );

    if (!pdf.length) {
      throw ApiError.notFound("Belgenin PDF çıktısı entegratörden alınamadı.");
    }
    return pdf;
  }
}

/**
 * .NET DataSet (diffgram) cevabından satırları çıkarır.
 * Yapı sürüme göre değişebildiği için, içindeki ilk nesne dizisi aranır.
 */
export const extractDataSetRows = (node: any): IceKontorSatiri[] => {
  if (!node) return [];

  const aday = node?.diffgram?.NewDataSet?.Table ?? node?.NewDataSet?.Table ?? node?.Table;
  if (aday) {
    return Array.isArray(aday) ? aday : [aday];
  }

  // Yapı beklenenden farklıysa özyinelemeli ara
  const gez = (deger: any, derinlik: number): IceKontorSatiri[] | null => {
    if (derinlik > 6 || !deger || typeof deger !== "object") return null;
    if (Array.isArray(deger)) {
      return deger.every((x) => x && typeof x === "object") ? (deger as IceKontorSatiri[]) : null;
    }
    for (const value of Object.values(deger)) {
      const bulunan = gez(value, derinlik + 1);
      if (bulunan && bulunan.length) return bulunan;
    }
    return null;
  };

  const bulunan = gez(node, 0);
  if (bulunan) return bulunan;

  logger.warn("Get_Credit cevabı beklenen DataSet yapısında değil.");
  return [];
};

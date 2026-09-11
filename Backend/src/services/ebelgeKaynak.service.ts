import { createHash, randomUUID } from "node:crypto";
import { EbelgeKaynakRepository, KaynakKimlik, dovizMi, kaynakAnahtar } from "../models/ebelgeKaynak.repository.js";
import { EDovizGirdi, getEDovizCikti, getEDovizStatus, previewEDoviz, sendEDoviz, sendEDovizIptal } from "./ice/ice.edoviz.js";
import { DbContext, EbelgeSqlRepository } from "../models/ebelgeSql.repository.js";
import { EbelgeService } from "./ebelge.service.js";
import { hesapla, UblFaturaGirdi } from "./ice/ubl/invoiceBuilder.js";
import { ApiError } from "../utils/ApiError.js";
import { KaynakFisDetay, kaynakFisPdf } from './ebelgeKaynakPdf.js';

const temiz = (v: unknown) => String(v ?? "").trim();
export const kaynakParmakizi = (kaynak: unknown) => createHash("sha256").update(JSON.stringify(kaynak)).digest("hex");

/** Uses the ERP's invoice-line view; never derives gold tax bases from raw gram/currency rows. */
export function kaynakFaturaGirdisi(kaynak: { baslik: any; satirlar: any[] }): Omit<UblFaturaGirdi, "gonderici"> {
  const b = kaynak.baslik;
  if (![0,1].includes(Number(b.BELGE_TURU))) throw ApiError.badRequest("Bu kaynak fatura değil. e-Gider veya e-İrsaliye oluşturma ekranını kullanın.");
  if (Number(b.E_BELGE_DURUMU || 0) !== 0 || temiz(b.ETTN)) {
    throw ApiError.conflict("Eski sistemde işlem/ETTN kaydı var. ICE sonucunu doğrulamadan yeniden gönderilemez.");
  }
  if (temiz(b.E_BELGE_HATA_ACIKLAMASI)) throw ApiError.conflict("Eski sistem hata kaydı var; gönderim sonucu kontrol edilmelidir.");
  const belgeNo = temiz(b.BELGE_NO).toUpperCase();
  if (!/^[A-Z]{3}\d{13}$/.test(belgeNo)) throw ApiError.badRequest("Kaynak fatura numarası 3 harf ve 13 rakam olmalıdır; kaynak kayıt düzeltilmelidir.");
  const para = temiz(b.PARA_KODU);
  if (!["TL","TRY"].includes(para)) throw ApiError.badRequest("Kaynak dövizli fatura için kur eşlemesi doğrulanmadan otomatik gönderim yapılamaz.");
  if (!kaynak.satirlar.length) throw ApiError.badRequest("Kaynak faturanın satırları bulunamadı.");
  const satirlar = kaynak.satirlar.map((s, i) => {
    const miktar = Number(s.MIKTAR), matrah = Number(s.TUTAR), kdvOrani = Number(s.KDV_ORANI);
    if (![s.MIKTAR,s.TUTAR,s.KDV_ORANI,s.KDV].every(v => v !== null && v !== undefined && Number.isFinite(Number(v))) || miktar <= 0 || matrah < 0) {
      throw ApiError.badRequest(`${i + 1}. kaynak satırında miktar/tutar/vergi eksik veya geçersiz.`);
    }
    const birimKodu = temiz(s.BIRIM_ADI);
    if (!/^[A-Z0-9]{2,5}$/.test(birimKodu)) throw ApiError.badRequest(`${i + 1}. satırın birim kodu doğrulanamadı.`);
    const birimFiyat = Math.round(matrah / miktar * 100) / 100;
    if (Math.abs(Math.round(miktar * birimFiyat * 100) / 100 - matrah) > 0.011 ||
      Math.abs(Math.round(matrah * kdvOrani) / 100 - Number(s.KDV)) > 0.011) {
      throw ApiError.badRequest(`${i + 1}. kaynak satırındaki tutar/KDV yeniden hesaplamayla uyuşmuyor; gönderim durduruldu.`);
    }
    return { ad: temiz(s.PARA_ADI), miktar, birimKodu, birimFiyat, kdvOrani,
      ...(kdvOrani === 0 ? { istisnaKodu: temiz(b.E_FATURA_KDV_MUAFIYET_KODU), istisnaGerekcesi: temiz(b.E_FATURA_KDV_MUAFIYET_ADI) } : {}) };
  });
  const ozet = hesapla(satirlar);
  if (b.MIKTAR == null || !Number.isFinite(Number(b.MIKTAR)) || Math.abs(ozet.odenecekTutar - Number(b.MIKTAR)) > 0.011) {
    throw ApiError.badRequest("Kaynak fatura toplamı ile satır toplamları uyuşmuyor; gönderim durduruldu.");
  }
  const adlar = temiz(b.UNVAN).split(/\s+/);
  const soyad = adlar.length > 1 ? adlar.pop()! : "";
  return { belgeNo, tarih: new Date(b.TARIH).toISOString().slice(0,10), paraBirimi: "TRY", senaryo: "TICARIFATURA",
    faturaTipi: satirlar.some(s => s.kdvOrani === 0) ? "ISTISNA" : "SATIS",
    alici: { vknTckn: temiz(b.VERGI_KIMLIK_NO), unvan: temiz(b.UNVAN), ad: adlar.join(" "), soyad,
      il: temiz(b.IL_ADI), ilce: temiz(b.ILCE_ADI), adres: temiz(b.ADRES), vergiDairesi: temiz(b.VERGI_DAIRESI_ADI) }, satirlar };
}

export class EbelgeKaynakService {
  static async detay(k: KaynakKimlik, ctx?: DbContext): Promise<KaynakFisDetay> {
    const kaynak = dovizMi(k) ? await EbelgeKaynakRepository.dovizDetay(k, ctx) : await EbelgeKaynakRepository.detay(k, ctx);
    const b = kaynak.baslik;
    const paraBirimi = temiz(dovizMi(k) ? b.PayableAmountCurrency || b.PARA_KODU : b.PARA_KODU).replace(/^TL$/, 'TRY');
    return { belgeNo: temiz(b.BELGE_NO), tarih: new Date(b.TARIH).toISOString(), unvan: temiz(b.UNVAN),
      tur: dovizMi(k) ? 'e-Döviz' : ({ 0: 'Fatura', 1: 'Fatura', 2: 'e-İrsaliye', 3: 'e-Gider' }[k.belgeTuru] || 'Belge'),
      paraBirimi, tutar: Number(dovizMi(k) ? b.PayableAmount : b.MIKTAR), ettn: temiz(b.ETTN), durum: Number(b.E_BELGE_DURUMU || 0),
      firma: temiz(b.Supplier_PartyName), vergiKimlikNo: temiz(b.Customer_PartyIdentification_ID || b.VERGI_KIMLIK_NO),
      satirlar: dovizMi(k) ? [{ ad: temiz(b.PARA_ADI || b.PARA_KODU), miktar: Number(b.MIKTAR), kur: Number(b.KUR), tutar: Number(b.PayableAmount) }]
        : kaynak.satirlar.map(s => ({ ad: temiz(s.PARA_ADI), miktar: Number(s.MIKTAR), tutar: Number(s.TUTAR), kdv: Number(s.KDV) })),
    };
  }

  static async pdf(k: KaynakKimlik, ctx?: DbContext) {
    return kaynakFisPdf(await this.detay(k, ctx));
  }

  private static async dovizIceKontrol(girdi: EDovizGirdi, kaynak: { baslik: any }, ctx?: DbContext) {
    const config = await EbelgeSqlRepository.getConnectionConfig(ctx);
    if (temiz(kaynak.baslik.ETTN)) {
      const durumlar = await getEDovizStatus(config, [girdi.uuid]);
      if (durumlar.length) {
        const mesaj = durumlar.map(d => temiz(d.STATUS_DESCRIPTION || d.STATUS)).filter(Boolean).join('; ');
        throw ApiError.conflict(`ETTN için ICE kaydı veya kontrol yanıtı mevcut${mesaj ? ': ' + mesaj : ''}. Yeniden gönderilmedi; ICE durumunu kontrol edin.`);
      }
    }
    return config;
  }
  private static async dovizGiden(uuid: string, ctx?: DbContext) {
    const kayit = await EbelgeSqlRepository.getGiden(uuid, ctx);
    if (!kayit || kayit.belgeTuru !== "EDoviz") throw ApiError.notFound("e-Döviz belgesi bulunamadı.");
    return kayit;
  }

  static async dovizDurum(uuid: string, kullanici: string, ctx?: DbContext) {
    await this.dovizGiden(uuid, ctx);
    const config = await EbelgeSqlRepository.getConnectionConfig(ctx);
    const kayitlar = await getEDovizStatus(config, [uuid]);
    const sonuc = kayitlar.find((r) => String(r.UUID || "").toLowerCase() === uuid.toLowerCase()) || kayitlar[0] || null;
    await EbelgeSqlRepository.writeLog({ metod: "Get_EDoviz_Status", yon: "GIDEN", basarili: !!sonuc,
      kullanici, ilgiliUuid: uuid, cevapOzet: sonuc ? `STATUS=${sonuc.STATUS || ""}` : "Kayıt dönmedi" } as any, ctx);
    return sonuc;
  }

  static async dovizPdf(uuid: string, kullanici: string, ctx?: DbContext) {
    await this.dovizGiden(uuid, ctx);
    const config = await EbelgeSqlRepository.getConnectionConfig(ctx);
    const sonuc = await getEDovizCikti(config, uuid, { pdf: true, xml: false });
    await EbelgeSqlRepository.writeLog({ metod: "GetEDoviz_XML_PDF", yon: "GIDEN", basarili: !!sonuc.pdf?.length,
      kullanici, ilgiliUuid: uuid, cevapOzet: `${sonuc.pdf?.length || 0} bayt` } as any, ctx);
    if (!sonuc.pdf?.length) throw ApiError.notFound("e-Döviz PDF çıktısı alınamadı.");
    return sonuc.pdf;
  }

  static async dovizIptal(uuid: string, iptalTarihi: Date, kullanici: string, ctx?: DbContext) {
    const kayit = await this.dovizGiden(uuid, ctx);
    if (kayit.gonderimDurumu !== "GONDERILDI") throw ApiError.conflict("Yalnız gönderilmiş e-Döviz belgesi iptal edilebilir.");
    const gun = iptalTarihi.toISOString().slice(0, 10);
    const config = await EbelgeSqlRepository.getConnectionConfig(ctx);
    let sonuc;
    try { sonuc = await sendEDovizIptal(config, kayit.belgeNo, iptalTarihi.toISOString()); }
    catch { throw ApiError.conflict("İptal sonucu belirsiz; ICE portalinden kontrol ediniz. Tekrar iptal göndermeyiniz."); }
    await EbelgeSqlRepository.writeLog({ metod: "send_edoviz_iptal", yon: "GIDEN", basarili: sonuc.basarili,
      kullanici, ilgiliUuid: uuid, istekOzet: `belgeNo=${kayit.belgeNo} iptalTarihi=${gun}`, cevapOzet: sonuc.mesaj } as any, ctx);
    if (!sonuc.basarili) throw ApiError.conflict(sonuc.mesaj || "e-Döviz iptali reddedildi.");
    await EbelgeSqlRepository.earsivDurumGecir(uuid, "GONDERILDI", "IPTAL", { mesaj: sonuc.mesaj, kullanici, iptalTarihi }, ctx);
    return { uuid, durum: "IPTAL", mesaj: sonuc.mesaj };
  }

  static async hazirla(k: KaynakKimlik, kullanici: string, ctx?: DbContext) {
    if (dovizMi(k)) return this.dovizHazirla(k, ctx);
    const kaynak = await EbelgeKaynakRepository.detay(k, ctx);
    const girdi = kaynakFaturaGirdisi(kaynak);
    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo, ctx)) throw ApiError.conflict("Bu belge giden kutusunda zaten mevcut.");
    const mukellef = await EbelgeService.mukellefSorgula(girdi.alici.vknTckn, kullanici, ctx);
    girdi.senaryo = mukellef.mukellefMi ? "TICARIFATURA" : "EARSIVFATURA";
    const sonuc = await EbelgeService.dogrulaGidenBelge(girdi as UblFaturaGirdi, kullanici, false, ctx);
    if (!sonuc.semaGecerli || !sonuc.schematronGecerli) throw ApiError.unprocessable(sonuc.mesaj || "Kaynak belge ICE doğrulamasından geçmedi.");
    return { ...k, belgeNo: girdi.belgeNo, unvan: girdi.alici.unvan, belgeTuruAdi: mukellef.mukellefMi ? "e-Fatura" : "e-Arşiv",
      parmakizi: kaynakParmakizi(kaynak), senaryo: girdi.senaryo, tutar: sonuc.ozet.odenecekTutar, durum: "HAZIR" };
  }
  static async gonder(k: KaynakKimlik, parmakizi: string, senaryo: string, kullanici: string, ctx?: DbContext) {
    if (dovizMi(k)) return this.dovizGonder(k, parmakizi, kullanici, ctx);
    const kaynak = await EbelgeKaynakRepository.detay(k, ctx);
    if (kaynakParmakizi(kaynak) !== parmakizi) throw ApiError.conflict("Kaynak belge değişmiş. Yeniden hazırlayın ve onaylayın.");
    const girdi = kaynakFaturaGirdisi(kaynak);
    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo, ctx)) throw ApiError.conflict("Belge giden kutusunda zaten mevcut; yeniden gönderilmedi.");
    await EbelgeKaynakRepository.reserve(k, girdi.belgeNo, ctx);
    try {
      const mukellef = await EbelgeService.mukellefSorgula(girdi.alici.vknTckn, kullanici, ctx);
      girdi.senaryo = mukellef.mukellefMi ? "TICARIFATURA" : "EARSIVFATURA";
      if (girdi.senaryo !== senaryo) throw ApiError.conflict("Alıcının mükellefiyeti değişmiş. Yeniden hazırlayın.");
      const guncel = await EbelgeKaynakRepository.detay(k,ctx);
      if (kaynakParmakizi(guncel) !== parmakizi) throw ApiError.conflict("Kaynak belge değişmiş; gönderim durduruldu.");
      const sonuc = mukellef.mukellefMi
        ? await EbelgeService.faturaGonder(girdi as UblFaturaGirdi, kullanici, ctx)
        : await EbelgeService.earsivGonder(girdi as UblFaturaGirdi, kullanici, ctx);
      await EbelgeKaynakRepository.sonuc(k,"GONDERILDI",sonuc.mesaj,ctx);
      return sonuc;
    } catch (e: any) {
      // A persisted giden row means ICE may already have seen the document. Do not reopen the claim.
      const mevcut = await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo,ctx).catch(() => true);
      await EbelgeKaynakRepository.sonuc(k,mevcut ? "KONTROL_GEREKLI" : "HATA",e.message || "İşlem tamamlanamadı.",ctx).catch(() => undefined);
      throw e;
    }
  }

  /**
   * e-Döviz hazırlama: `preview_edoviz_basic` ile **mali sonuç doğurmadan** doğrular.
   * Fatura akışındaki `invoice_check_validate` güvencesinin döviz karşılığıdır.
   */
  static async dovizHazirla(k: KaynakKimlik, ctx?: DbContext) {
    const kaynak = await EbelgeKaynakRepository.dovizDetay(k, ctx);
    const ayar = await EbelgeSqlRepository.getAyar(ctx);
    const girdi = dovizGirdisi(kaynak, { vknTckn: ayar?.firmaVkn });
    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo, ctx)) {
      throw ApiError.conflict("Bu belge giden kutusunda zaten mevcut.");
    }
    const config = await this.dovizIceKontrol(girdi, kaynak, ctx);
    await previewEDoviz(config, girdi);
    const adSoyad = [girdi.musteri.ad, girdi.musteri.soyad].filter(Boolean).join(" ");
    return {
      ...k,
      belgeNo: girdi.belgeNo,
      unvan: girdi.musteri.unvan || adSoyad || "-",
      belgeTuruAdi: "e-Döviz",
      parmakizi: kaynakParmakizi(kaynak),
      senaryo: girdi.creditNoteTypeCode,
      tutar: girdi.tutar.payableAmount,
      paraBirimi: temiz(kaynak.baslik.PayableAmountCurrency) || girdi.tutar.kod,
      durum: "HAZIR",
    };
  }

  /**
   * e-Döviz gönderimi. Fatura akışıyla aynı güvenlik sırası:
   * kaynak değişmedi mi → kaynak kaydını yer tut → giden kaydını ICE'den ÖNCE yaz →
   * gönder → sonucu kesinleştir. Belirsiz sonuçta yeniden gönderim yapılmaz.
   */
  static async dovizGonder(k: KaynakKimlik, parmakizi: string, kullanici: string, ctx?: DbContext) {
    const kaynak = await EbelgeKaynakRepository.dovizDetay(k, ctx);
    if (kaynakParmakizi(kaynak) !== parmakizi) {
      throw ApiError.conflict("Kaynak döviz fişi değişmiş. Yeniden hazırlayın ve onaylayın.");
    }
    const ayar = await EbelgeSqlRepository.getAyar(ctx);
    const girdi = dovizGirdisi(kaynak, { vknTckn: ayar?.firmaVkn });
    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo, ctx)) {
      throw ApiError.conflict("Belge giden kutusunda zaten mevcut; yeniden gönderilmedi.");
    }
    const config = await this.dovizIceKontrol(girdi, kaynak, ctx);
    await EbelgeKaynakRepository.reserve(k, girdi.belgeNo, ctx);
    try {
      // Gönderimden hemen önce son bir doğrulama: reddedilecek belge numarayı yakmasın.
      await previewEDoviz(config, girdi);
      const guncel = await EbelgeKaynakRepository.dovizDetay(k, ctx);
      if (kaynakParmakizi(guncel) !== parmakizi) throw ApiError.conflict('Kaynak döviz fişi değişmiş; yeniden hazırlayın.');
      await EbelgeSqlRepository.insertGiden({
        uuid: girdi.uuid,
        belgeNo: girdi.belgeNo,
        belgeTuru: "EDoviz",
        profil: girdi.profileId,
        faturaTipi: girdi.creditNoteTypeCode,
        taslakMi: false,
        aliciVkn: girdi.musteri.vknTckn || null,
        aliciUnvan:
          girdi.musteri.unvan || [girdi.musteri.ad, girdi.musteri.soyad].filter(Boolean).join(" ") || null,
        duzenlemeTarihi: new Date(girdi.duzenlemeTarihi),
        tutar: girdi.tutar.payableAmount,
        paraBirimi: temiz(kaynak.baslik.PayableAmountCurrency) || girdi.tutar.kod,
        gonderimDurumu: "GONDERILIYOR",
        iceResponseMesaj: "Gönderim başlatıldı. Sonuç kesinleşmeden yeniden göndermeyiniz.",
        kaynakFisId: kaynakAnahtar(k),
        olusturan: kullanici,
        gonderen: kullanici,
        gonderimTarihi: new Date(),
      } as any, ctx);

      let sonuc;
      try {
        sonuc = await sendEDoviz(config, girdi);
      } catch {
        await EbelgeSqlRepository.earsivDurumGecir(girdi.uuid, "GONDERILIYOR", "BELIRSIZ", {
          mesaj: "ICE gönderim sonucu alınamadı. Yeniden göndermeyiniz; ICE portalinden ETTN ile kontrol ediniz.",
        }, ctx).catch(() => undefined);
        throw ApiError.conflict(
          `Gönderim sonucu belirsiz (ETTN: ${girdi.uuid}). Giden kutusunu ve ICE portalini kontrol ediniz; yeniden göndermeyiniz.`
        );
      }

      const dogru = (v: unknown) => String(v).toLowerCase() === "true";
      const satirlar = (() => {
        const ham = sonuc.CreditNoteType_responseTypes?.CreditNoteType_responseType;
        return Array.isArray(ham) ? ham : ham ? [ham] : [];
      })();
      const ilk = satirlar.length === 1 ? satirlar[0] : undefined;
      const basarili = dogru(sonuc.success) && !!ilk && dogru(ilk.success) &&
        dogru(ilk.shema_is_validate) && dogru(ilk.schematron_is_validate) &&
        String(ilk.ettn || "").toLowerCase() === girdi.uuid.toLowerCase() && ilk.ID === girdi.belgeNo;
      const acikRed = String(sonuc.success).toLowerCase() === "false" ||
        (!!ilk && String(ilk.success).toLowerCase() === "false");
      const durum = basarili ? "GONDERILDI" : acikRed ? "HATA" : "BELIRSIZ";

      await EbelgeSqlRepository.earsivDurumGecir(girdi.uuid, "GONDERILIYOR", durum, {
        kod: String(sonuc.response_code ?? ""),
        mesaj: durum === "BELIRSIZ"
          ? "ICE cevabı belgeyi kesin olarak doğrulamıyor; portalden ETTN ile kontrol ediniz."
          : ilk?.response_message || sonuc.response_message || durum,
      }, ctx);
      await EbelgeSqlRepository.writeLog({
        metod: "send_edoviz_basic", yon: "GIDEN", basarili, kullanici, ilgiliUuid: girdi.uuid,
        istekOzet: `belgeNo=${girdi.belgeNo} tutar=${girdi.tutar.payableAmount}`,
        cevapOzet: `durum=${durum} ${sonuc.response_message || ""}`,
      } as any, ctx);

      if (!basarili) {
        throw ApiError.conflict(durum === "BELIRSIZ"
          ? "Gönderim sonucu belirsiz; ICE portalinden kontrol ediniz. Yeniden göndermeyiniz."
          : ilk?.response_message || sonuc.response_message || "e-Döviz gönderimi reddedildi.");
      }

      await EbelgeKaynakRepository.sonuc(k, "GONDERILDI", sonuc.response_message || "Gönderildi", ctx);
      return { uuid: girdi.uuid, belgeNo: girdi.belgeNo, durum: "GONDERILDI", mesaj: sonuc.response_message || "" };
    } catch (e: any) {
      // Giden kaydı oluştuysa ICE belgeyi görmüş olabilir; hak talebini yeniden açma.
      const mevcut = await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo, ctx).catch(() => true);
      await EbelgeKaynakRepository.sonuc(k, mevcut ? "KONTROL_GEREKLI" : "HATA",
        e.message || "İşlem tamamlanamadı.", ctx).catch(() => undefined);
      throw e;
    }
  }
}

/* ==========================================================================
   e-Döviz (Döviz Alım/Satım Belgesi)
   ========================================================================== */

const sayi = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const zorunluSayi = (v: unknown, ad: string): number => {
  const n = sayi(v);
  if (n === undefined) throw ApiError.badRequest(`${ad} kaynak fişte okunamadı; gönderim durduruldu.`);
  return n;
};
const isoTarih = (v: unknown, ad: string): string => {
  const d = new Date(v as any);
  if (Number.isNaN(d.getTime())) throw ApiError.badRequest(`${ad} kaynak fişte geçersiz.`);
  return d.toISOString();
};

/**
 * ERP döviz fişini ICE `eDoviz_Belge` girdisine çevirir.
 *
 * Kaynak `VODVZ_E_DOVIZ_BELGESI_XSLT` görünümüdür; alan adları GİB'in CreditNote
 * sözleşmesiyle zaten hizalı olduğu için eşleme birebire yakındır.
 * Tutarlar ERP'de hazır hesaplanmış olduğundan `TutarHesaplanmasin=true` gönderilir;
 * böylece ICE kendi hesabını dayatıp fişle uyumsuz belge üretmez.
 */
export function dovizGirdisi(kaynak: { baslik: any }, gonderici?: { vknTckn?: string }): EDovizGirdi {
  const b = kaynak.baslik;
  // Fatura akışıyla aynı öncelik (goncericiTamamla): E-Belge ayarındaki Firma VKN
  // öncelikli, yoksa görünümdeki firma. ICE hesabı ile belgedeki yetkili müessese
  // aynı mükellef olmalı; ayar bu eşleşmenin tek yönetilebilir noktası.
  const yetkiliVkn = temiz(gonderici?.vknTckn) || temiz(b.Supplier_PartyIdentification);
  if (Number(b.IPTAL || 0) !== 0) throw ApiError.conflict("Bu döviz fişi iptal edilmiş; gönderilemez.");
  if (Number(b.E_BELGE_DURUMU || 0) !== 0) {
    throw ApiError.conflict("Eski sistemde işlem/ETTN kaydı var. ICE sonucunu doğrulamadan yeniden gönderilemez.");
  }
  const kaynakEttn = temiz(b.ETTN);
  if (kaynakEttn && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(kaynakEttn)) {
    throw ApiError.badRequest('Kaynak ETTN geçersiz. Fişin ETTN alanını kontrol edin.');
  }
  if (kaynakEttn && temiz(b.UUID) && kaynakEttn.toLowerCase() !== temiz(b.UUID).toLowerCase()) {
    throw ApiError.conflict('Kaynak ETTN ile döviz belgesinin UUID alanı uyuşmuyor.');
  }
  if (temiz(b.E_BELGE_HATA_ACIKLAMASI)) {
    throw ApiError.conflict("Eski sistem hata kaydı var; gönderim sonucu kontrol edilmelidir.");
  }
  const belgeNo = temiz(b.BELGE_NO || b.ID).toUpperCase();
  if (!/^[A-Z]{3}\d{13}$/.test(belgeNo)) {
    throw ApiError.badRequest("Döviz belge numarası 3 harf ve 13 rakam olmalıdır; kaynak kayıt düzeltilmelidir.");
  }
  const dovizKodu = temiz(b.PARA_KODU || b.CurrencyCode);
  if (!/^[A-Z]{3}$/.test(dovizKodu)) throw ApiError.badRequest("Döviz kodu okunamadı.");

  const payable = zorunluSayi(b.PayableAmount, "Ödenecek tutar");
  const lineExt = sayi(b.LineExtensionAmount) ?? payable;
  const taxExcl = sayi(b.TaxExclusiveAmount) ?? lineExt;
  const taxIncl = sayi(b.TaxInclusiveAmount) ?? payable;
  const miktar = zorunluSayi(b.MIKTAR, "Döviz miktarı");
  if (miktar <= 0) throw ApiError.badRequest("Döviz miktarı sıfır veya negatif olamaz.");
  const tlKarsilikKuru = zorunluSayi(b.TL_KARSILIK_KURU ?? b.KUR, "TL karşılık kuru");
  if (tlKarsilikKuru <= 0) throw ApiError.badRequest("TL karşılık kuru sıfır veya negatif olamaz.");
  const dolarKarsilikKuru = sayi(b.DOLAR_KARSILIK_KURU ?? b.DOLAR_KURU ?? b.PricingExchangeRate) ?? 0;
  const vergiOrani = sayi(b.TaxPercent) ?? 0;
  const vergiTutari = sayi(b.TaxAmount) ?? 0;
  const vergiMatrah = sayi(b.TaxableAmount) ?? 0;

  // Ek_Bilgiler WSDL'de opsiyonel bir bloktur; fakat blok açılırsa bayrak ve üç tarih
  // zorunludur. Eksik veriden yarım/şemaya aykırı blok üretmek yerine tamamı yok sayılır.
  const gumrukBeyanTarihi = b.GUMRUK_BEYAN_TARIHI ?? b.GM_BEYANNAME_TARIHI;
  const dbtTarihi = b.DBT_TARIHI ?? b.GM_DOVIZ_TARIHI;
  const gmtyTarihi = b.GMTY_TARIHI ?? b.GM_TEYIT_TARIHI;
  const ekBilgiler = gumrukBeyanTarihi && dbtTarihi && gmtyTarihi ? {
    istatistikNo: temiz(b.ISTATISTIK_NO),
    geldigiUlke: temiz(b.GELDIGI_ULKE),
    gelisNedeni: temiz(b.GELIS_NEDENI),
    ihracatYabanciSermaye: Boolean(b.IHRACAT_YABANCI_SERMAYE),
    gumrukBeyanTarihi: isoTarih(gumrukBeyanTarihi, "Gümrük beyan tarihi"),
    gumrukBeyanNo: temiz(b.GM_BEYANNAME_NO),
    dbtTarihi: isoTarih(dbtTarihi, "DBT tarihi"),
    dbtSayi: temiz(b.GM_DOVIZ_SAYI),
    gmtyTarihi: isoTarih(gmtyTarihi, "GMTY tarihi"),
    gmtySayi: temiz(b.GM_TEYIT_SAYI),
    vezne: temiz(b.VEZNE_KODU),
  } : undefined;

  // Görünüm, müşteri kimliği yokken kimlik kolonuna tür etiketi (GERCEKKISI /
  // TUZELKISI) yazıyor. Bu bir TCKN/VKN değildir; ICE'ye kimlik diye gitmemeli,
  // Musteri_Turu alanına taşınmalı.
  const kimlikHam = temiz(b.Customer_PartyIdentification_ID || b.Customer_PartyIdentification);
  const turEtiketi = /^(GERCEK_?KISI|TUZEL_?KISI)$/i.test(kimlikHam) ? kimlikHam.toUpperCase().replace("_", "") : "";
  const musteriVkn = turEtiketi ? "" : kimlikHam;
  const pasaport = temiz(b.Customer_PartyIdentification_PassportID);
  if (!musteriVkn && !pasaport) {
    throw ApiError.badRequest(
      "Müşteri TCKN/VKN veya pasaport numarası kaynak fişte yok; gönderim durduruldu. " +
        "Fişte müşteri kimliği beyan edilmemiş; e-Döviz belgesi kimliksiz müşteriye kesilemez."
    );
  }
  // Tür belirtilmemişse kimlikten türetilir: 10 hane VKN tüzel kişi, TCKN/pasaport gerçek kişi.
  const musteriTuru = turEtiketi || (musteriVkn.length === 10 ? "TUZELKISI" : "GERCEKKISI");

  return {
    belgeNo,
    uuid: kaynakEttn || temiz(b.UUID) || randomUUID(),
    profileId: temiz(b.ProfileId) || "TEMELDOVIZ",
    // ICE'nin kabul ettiği belge tipi kodları yalnızca DOVIZALIMBELGESI ve
    // DOVIZSATIMBELGESI (dokuman.iceteknoloji.com.tr, send_edoviz_basic
    // parametreleri). Görünümdeki "DOVIZALIM" değeri ICE'de eşleşmeyip null
    // referans hatasına yol açıyordu; bu yüzden kod, fişin kendi tipinden
    // türetilir. FIS_TIPI=1 satış (DIS/YSS serisi), diğerleri alış (DIA/YAB).
    creditNoteTypeCode: Number(b.FIS_TIPI) === 1 ? "DOVIZSATIMBELGESI" : "DOVIZALIMBELGESI",
    duzenlemeTarihi: isoTarih(b.IssueDate || b.TARIH, "Düzenleme tarihi"),
    duzenlemeSaati: isoTarih(b.IssueTime || b.TARIH, "Düzenleme saati"),
    yetkiliMuessese: {
      vknTckn: yetkiliVkn,
      unvan: temiz(b.Supplier_PartyName),
      adres: temiz(b.Supplier_StreetName),
      ulke: temiz(b.Supplier_CountryName),
      sehir: temiz(b.Supplier_CityName),
      ilce: temiz(b.Supplier_CitySubdivisionName),
      vergiDairesi: temiz(b.Supplier_TaxSchemeName),
      telefon: temiz(b.Supplier_Telephone),
      eposta: temiz(b.Supplier_EMail),
      ticaretSicilNo: temiz(b.TICARET_SICIL_NO),
    },
    musteri: {
      vknTckn: musteriVkn,
      pasaportNo: pasaport,
      musteriTuru,
      unvan: temiz(b.Customer_PartyName),
      ad: temiz(b.Customer_Person_FirstName),
      soyad: temiz(b.Customer_Person_FamilyName),
      adres: temiz(b.Customer_StreetName),
      ulke: temiz(b.Customer_CountryName),
      sehir: temiz(b.Customer_CityName),
      ilce: temiz(b.Customer_CitySubdivisionName),
      vergiDairesi: temiz(b.Customer_TaxSchemeName),
      telefon: temiz(b.Customer_Telephone),
      eposta: temiz(b.Customer_ElectronicMail),
    },
    alisSatis: {
      dovizKodu,
      dolarKarsilikKuru,
      tlKarsilikKuru,
      vergiOrani,
      vergiTutari,
      vergiMatrah,
      dovizMiktar: miktar,
    },
    // Döviz alım/satımı vezneden nakit yapılır; bedel işlem anında ödenir.
    odeme: { yontemi: 'NAKIT', sonOdemeTarihi: isoTarih(b.IssueDate || b.TARIH, 'Son ödeme tarihi') },
    ekBilgiler,
    komisyon: sayi(b.KOMISYON) === undefined ? undefined : {
      vergiHaric: sayi(b.KOMISYON),
      vergi: sayi(b.BMV),
      dahilToplam: (sayi(b.KOMISYON) ?? 0) + (sayi(b.BMV) ?? 0),
    },
    tutar: {
      miktar,
      kod: dovizKodu,
      tlKarsilikKuru,
      dolarKarsilikKuru,
      safAltinKarsiligi: sayi(b.SAF_ALTIN_KARSILIGI) ?? 0,
      lineExtensionAmount: lineExt,
      taxExclusiveAmount: taxExcl,
      taxInclusiveAmount: taxIncl,
      payableAmount: payable,
      vergiOrani,
      vergiMatrahi: vergiMatrah,
      vergiTutari,
    },
    // ERP tutarları zaten hesaplanmış; ICE yeniden hesaplayıp fişten sapmasın.
    tutarHesaplanmasin: true,
  };
}

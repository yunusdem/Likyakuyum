import { createHash } from "node:crypto";
import { EbelgeKaynakRepository, KaynakKimlik } from "../models/ebelgeKaynak.repository.js";
import { DbContext, EbelgeSqlRepository } from "../models/ebelgeSql.repository.js";
import { EbelgeService } from "./ebelge.service.js";
import { hesapla, UblFaturaGirdi } from "./ice/ubl/invoiceBuilder.js";
import { ApiError } from "../utils/ApiError.js";

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
  static async hazirla(k: KaynakKimlik, kullanici: string, ctx?: DbContext) {
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
}

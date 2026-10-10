import { createHash, randomUUID } from "node:crypto";
import { EbelgeKaynakRepository, KaynakKimlik, dovizMi, kaynakAnahtar, kaynakKimlikCoz, perakendeMi, sarrafMi } from "../models/ebelgeKaynak.repository.js";
import { NIHAI_TUKETICI, perakendeFaturaGirdisi, perakendeGiderGirdisi } from "./ebelgePerakende.js";
import { sarrafAliciVkn, sarrafFaturaGirdisi, sarrafGiderGirdisi, sarrafKaynakTuru, sarrafPerakendeBicimi, sarrafSatirKdvleri, sarrafToplam } from "./ebelgeSarraf.js";
import { EDovizGirdi, getEDovizCikti, getEDovizStatus, previewEDoviz } from "./ice/ice.edoviz.js";
import { EbelgeKuyrukService } from "./ebelgeKuyruk.service.js";
import { DbContext, EbelgeSqlRepository } from "../models/ebelgeSql.repository.js";
import { EbelgeService } from "./ebelge.service.js";
import { hesapla, UblFaturaGirdi } from "./ice/ubl/invoiceBuilder.js";
import { ApiError } from "../utils/ApiError.js";
import { KaynakFisDetay, kaynakFisPdf, eDovizBelgePdf } from './ebelgeKaynakPdf.js';

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
    if (perakendeMi(k)) {
      const { baslik: b, satirlar } = await EbelgeKaynakRepository.perakendeDetay(k, ctx);
      return { belgeNo: temiz(b.FATURA_NO), tarih: new Date(b.TARIH).toISOString(), unvan: temiz(b.ALICI_UNVAN),
        tur: ({ 0: 'Perakende Alış (e-Gider)', 1: 'Perakende Satış', 2: 'Perakende İade' } as Record<number, string>)[Number(b.FATURA_TIPI)] || 'Perakende',
        paraBirimi: 'TRY', tutar: Number(b.GENEL_TOPLAM) || 0, ettn: temiz(b.ETTN), durum: Number(b.E_BELGE_DURUMU || 0), firma: '', vergiKimlikNo: temiz(b.ALICI_VKN_TCKN),
        satirlar: satirlar.map((s: any) => ({ ad: [temiz(s.URUN_ADI), temiz(s.AYAR) ? `${temiz(s.AYAR)} ayar` : ''].filter(Boolean).join(' '), miktar: Number(s.MIKTAR) || 0, tutar: Number(s.TUTAR) || 0, kdv: Number(s.KDV_TUTARI) || 0 })) };
    }
    if (sarrafMi(k)) {
      const { baslik: b, satirlar } = await EbelgeKaynakRepository.detay(k, ctx);
      const kdvler = sarrafSatirKdvleri(b, satirlar);
      // Önizleme faturaya gidecek satırları gösterir (ad gramla, adet / gram, KDV hariç tutar); dönüşüm kuralına
      // takılan fişte (eksi tutar vb.) fişin ham satırları gösterilir
      let fatura: { URUN_ADI?: string | null; MIKTAR?: number | null; TUTAR?: number | null; KDV_TUTARI?: number | null }[] | null = null;
      try { fatura = sarrafPerakendeBicimi({ baslik: b, satirlar }, '').satirlar; } catch { fatura = null; }
      return { belgeNo: temiz(b.FIS_NO), tarih: new Date(b.TARIH).toISOString(), unvan: temiz(b.UNVAN),
        tur: ({ 1: 'Sarraf Satış', 2: 'Sarraf Satış (e-İrsaliye)', 3: 'Sarraf Alış (e-Gider)' } as Record<number, string>)[sarrafKaynakTuru(b.TIP, b.BELGE_TURU)],
        paraBirimi: 'TRY', tutar: sarrafToplam(satirlar), ettn: '', durum: Number(b.E_FATURA_DURUMU || 0), firma: '', vergiKimlikNo: sarrafAliciVkn(b),
        satirlar: fatura
          ? fatura.map((s) => ({ ad: temiz(s.URUN_ADI) || 'Ürün', miktar: Number(s.MIKTAR) || 0, tutar: Number(s.TUTAR) || 0, kdv: Number(s.KDV_TUTARI) || 0 }))
          : satirlar.map((s: any, i: number) => ({ ad: temiz(s.URUN_ADI) || 'Ürün', miktar: Number(s.ADET) > 0 ? Number(s.ADET) : Number(s.MIKTAR) || 0,
            tutar: Math.round(((Number(s.TUTAR) || 0) - kdvler[i]) * 100) / 100, kdv: kdvler[i] })) };
    }
    const kaynak = await EbelgeKaynakRepository.dovizDetay(k, ctx);
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
    if (!dovizMi(k)) return kaynakFisPdf(await this.detay(k, ctx));
    // e-Döviz: ICE'nin resmî çıktısıyla aynı düzen ve ICE'ye giden girdiyle aynı veri.
    // Fiş henüz gönderilebilir durumda değilse (kimlik/istatistik/dosya no eksik)
    // ayrıntılı belge kurulamaz; sade önizlemeye düşülür, kullanıcı yine bir çıktı görür.
    const kaynak = await EbelgeKaynakRepository.dovizDetay(k, ctx);
    const [ayar, firma] = await Promise.all([EbelgeSqlRepository.getAyar(ctx), EbelgeSqlRepository.getFirmaBilgisi(ctx)]);
    let girdi: EDovizGirdi;
    try {
      girdi = dovizGirdisi(kaynak, { vknTckn: ayar?.firmaVkn, dosyaNo: firma.dosyaNo });
    } catch (e) {
      if (e instanceof ApiError) return kaynakFisPdf(await this.detay(k, ctx));
      throw e;
    }
    const giden = await EbelgeSqlRepository.getGiden(girdi.uuid, ctx).catch(() => null);
    return eDovizBelgePdf(girdi, {
      hesapVkn: temiz(ayar?.firmaVkn) || girdi.yetkiliMuessese.vknTckn,
      onizleme: String(giden?.gonderimDurumu || "") !== "GONDERILDI",
    });
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
    const giden = await this.dovizGiden(uuid, ctx);
    const config = await EbelgeSqlRepository.getConnectionConfig(ctx);
    const kayitlar = await getEDovizStatus(config, [uuid]);
    const sonuc = kayitlar.find((r) => String(r.UUID || "").toLowerCase() === uuid.toLowerCase()) || kayitlar[0] || null;
    await EbelgeSqlRepository.writeLog({ metod: "Get_EDoviz_Status", yon: "GIDEN", basarili: !!sonuc,
      kullanici, ilgiliUuid: uuid, cevapOzet: sonuc ? `STATUS=${sonuc.STATUS || ""}` : "Kayıt dönmedi" } as any, ctx);

    // Gönderim sonucu kesinleşmemiş (GONDERILIYOR/BELIRSIZ) kayıtlar için ICE'nin
    // belgeyi tanıması sonucun kendisidir: belge ICE'de kayıtlı → GONDERILDI.
    // Kaynak fişin durumu da aynı şekilde kapatılır ki liste bir daha göstermesin.
    const askida = ["KUYRUKTA", "GONDERILIYOR", "BELIRSIZ"].includes(String(giden.gonderimDurumu || ""));
    if (askida && sonuc) {
      const mesaj = temiz(sonuc.STATUS_DESCRIPTION || sonuc.STATUS) || "ICE durum sorgusu belgeyi doğruladı.";
      await EbelgeSqlRepository.earsivDurumGecir(uuid, giden.gonderimDurumu, "GONDERILDI",
        { mesaj, kod: temiz(sonuc.STATUS) || undefined }, ctx, "EDoviz");
      const k = kaynakKimlikCoz(temiz(giden.KAYNAK_FIS_ID || giden.kaynakFisId));
      if (k) await EbelgeKaynakRepository.sonuc(k, "GONDERILDI", mesaj, ctx).catch(() => undefined);
      return sonuc;
    }

    // ICE ETTN'yi henüz tanımıyorsa karar gönderim kuyruğundadır (docs/EBELGE_KUYRUK_YOL_HARITASI.md):
    // kuyruk yeniden dener, olmazsa "Gönderilemedi" yapar. Buradan HATA'ya çekmek denemeleri keserdi.
    if (askida && !sonuc) {
      return { isSuccecss: false, UUID: uuid, STATUS: "BEKLIYOR", STATUS_DESCRIPTION: "Gönderildi; ICE kaydı birkaç dakika içinde oluşur." };
    }
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
    // İptal kuyruktan geçer (docs/EBELGE_KUYRUK_YOL_HARITASI.md Q5)
    return EbelgeService.iptalKuyrugu(kayit, iptalTarihi, kullanici, ctx);
  }

  /**
   * Kuyruktaki gönderimin kaynağa yazılacak durumu: kuyruk sonucu kaynağa kendisi işler; burada yalnızca
   * o arada kesinleşmiş HATA'nın "Gönderildi" ile ezilmemesi sağlanır.
   */
  private static async kuyrukKaynakDurumu(uuid: string, ctx?: DbContext): Promise<string> {
    const g = await EbelgeSqlRepository.getGiden(uuid, ctx).catch(() => null);
    return g?.gonderimDurumu === "HATA" ? "HATA" : "GONDERILDI";
  }

  /** Perakende satışta senaryo: nihai tüketici → e-Arşiv (P9); diğerinde ICE mükellef sorgusu */
  private static async perakendeSenaryo(vkn: string, kullanici: string, ctx?: DbContext): Promise<"TICARIFATURA" | "EARSIVFATURA"> {
    if (vkn === NIHAI_TUKETICI) return "EARSIVFATURA";
    const m = await EbelgeService.mukellefSorgulaCanli(vkn, kullanici, ctx);
    return m.mukellefMi ? "TICARIFATURA" : "EARSIVFATURA";
  }

  /**
   * UBL-TR alıcı adresinde il ve ilçe ister; Perakende'de nihai tüketicinin adresi çoğu zaman boştur.
   * Boşsa firmanın kendi il / ilçesi (E-Belge Bağlantı Ayarları) yazılır, adres satırı "Belirtilmemiş" olur.
   */
  private static async aliciAdresiniTamamla<T extends { alici: { il?: string; ilce?: string; adres?: string } }>(girdi: T, ctx?: DbContext): Promise<T> {
    const a = girdi.alici;
    if (temiz(a.il) && temiz(a.ilce)) return girdi;
    const ayar = await EbelgeSqlRepository.getAyar(ctx);
    const il = temiz(a.il) || temiz(ayar?.firmaIl);
    const ilce = temiz(a.ilce) || temiz(ayar?.firmaIlce);
    if (!il || !ilce) {
      throw ApiError.badRequest("Alıcı adresinde il / ilçe yok ve E-Belge Bağlantı Ayarları'nda firma il / ilçesi tanımlı değil; biri doldurulmalı.");
    }
    return { ...girdi, alici: { ...a, il, ilce, adres: temiz(a.adres) || "Belirtilmemiş" } };
  }

  /** Perakende fişi hazırlama (P4): satış → fatura doğrulaması, alış → gider pusulası ön izleme. Hiçbir şey gönderilmez. */
  private static async perakendeHazirla(k: KaynakKimlik, kullanici: string, ctx?: DbContext) {
    const kaynak = await EbelgeKaynakRepository.perakendeDetay(k, ctx);
    if (Number(kaynak.baslik.FATURA_TIPI) === 0) {
      const girdi = await this.aliciAdresiniTamamla(perakendeGiderGirdisi(kaynak), ctx);
      if (await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo, ctx)) throw ApiError.conflict("Bu belge giden kutusunda zaten mevcut.");
      const { ozet } = await EbelgeService.giderPusulasiOnizle(girdi as any, ctx);
      return { ...k, belgeNo: girdi.belgeNo, unvan: girdi.alici.unvan || "", belgeTuruAdi: "e-Gider pusulası", parmakizi: kaynakParmakizi(kaynak), senaryo: "GIDERPUSULASI", tutar: ozet.odenecekTutar, durum: "HAZIR" };
    }
    const girdi = await this.aliciAdresiniTamamla(perakendeFaturaGirdisi(kaynak), ctx);
    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo, ctx)) throw ApiError.conflict("Bu belge giden kutusunda zaten mevcut.");
    girdi.senaryo = await this.perakendeSenaryo(girdi.alici.vknTckn, kullanici, ctx);
    const sonuc = await EbelgeService.dogrulaGidenBelge(girdi as UblFaturaGirdi, kullanici, false, ctx);
    if (!sonuc.semaGecerli || !sonuc.schematronGecerli) throw ApiError.unprocessable(sonuc.mesaj || "Perakende fişi ICE doğrulamasından geçmedi.");
    return { ...k, belgeNo: girdi.belgeNo, unvan: girdi.alici.unvan, belgeTuruAdi: girdi.senaryo === "TICARIFATURA" ? "e-Fatura" : "e-Arşiv",
      parmakizi: kaynakParmakizi(kaynak), senaryo: girdi.senaryo, tutar: sonuc.ozet.odenecekTutar, durum: "HAZIR" };
  }

  /** Perakende fişi gönderimi (P4, P5): Sarraf akışıyla aynı güvenlik sırası; sonuç kaynak kaydına ve fişe yazılır. */
  private static async perakendeGonder(k: KaynakKimlik, parmakizi: string, senaryo: string, kullanici: string, ctx?: DbContext) {
    const kaynak = await EbelgeKaynakRepository.perakendeDetay(k, ctx);
    if (kaynakParmakizi(kaynak) !== parmakizi) throw ApiError.conflict("Fiş değişmiş. Yeniden hazırlayın ve onaylayın.");
    const alis = Number(kaynak.baslik.FATURA_TIPI) === 0;
    const belgeNo = alis ? perakendeGiderGirdisi(kaynak).belgeNo : perakendeFaturaGirdisi(kaynak).belgeNo;
    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, ctx)) throw ApiError.conflict("Belge giden kutusunda zaten mevcut; yeniden gönderilmedi.");
    await EbelgeKaynakRepository.reserve(k, belgeNo, ctx);
    try {
      const guncel = await EbelgeKaynakRepository.perakendeDetay(k, ctx);
      if (kaynakParmakizi(guncel) !== parmakizi) throw ApiError.conflict("Fiş değişmiş; gönderim durduruldu.");
      const secenek = { kaynakFisId: kaynakAnahtar(k) };
      let sonuc: { uuid: string; mesaj: string };
      if (alis) {
        if (senaryo !== "GIDERPUSULASI") throw ApiError.conflict("Belge türü değişmiş. Yeniden hazırlayın.");
        sonuc = await EbelgeService.giderPusulasiGonder((await this.aliciAdresiniTamamla(perakendeGiderGirdisi(guncel), ctx)) as any, kullanici, ctx, secenek);
      } else {
        const girdi = await this.aliciAdresiniTamamla(perakendeFaturaGirdisi(guncel), ctx);
        girdi.senaryo = await this.perakendeSenaryo(girdi.alici.vknTckn, kullanici, ctx);
        if (girdi.senaryo !== senaryo) throw ApiError.conflict("Alıcının mükellefiyeti değişmiş. Yeniden hazırlayın.");
        sonuc = girdi.senaryo === "TICARIFATURA"
          ? await EbelgeService.faturaGonder(girdi as UblFaturaGirdi, kullanici, ctx, secenek)
          : await EbelgeService.earsivGonder(girdi as UblFaturaGirdi, kullanici, ctx, secenek);
      }
      await EbelgeKaynakRepository.sonuc(k, await this.kuyrukKaynakDurumu(sonuc.uuid, ctx), sonuc.mesaj, ctx);
      return sonuc;
    } catch (e: any) {
      const mevcut = await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, ctx).catch(() => true);
      await EbelgeKaynakRepository.sonuc(k, mevcut ? "KONTROL_GEREKLI" : "HATA", e.message || "İşlem tamamlanamadı.", ctx).catch(() => undefined);
      throw e;
    }
  }

  /**
   * Sarraf fişi okunur ve listedeki kimlikle (belge türü) hâlâ uyuştuğu doğrulanır. Numara fişten alınmaz:
   * gönderim anında e-Belge Ayarları'ndaki seriden verilir (fiş numarası biçimi firmadan firmaya değişebilir).
   */
  private static async sarrafOku(k: KaynakKimlik, ctx?: DbContext) {
    const kaynak = await EbelgeKaynakRepository.detay(k, ctx);
    const tur = sarrafKaynakTuru(kaynak.baslik.TIP, kaynak.baslik.BELGE_TURU);
    if (tur !== k.belgeTuru) throw ApiError.conflict("Fişin türü değişmiş. Listeyi yenileyin.");
    if (tur === 2) throw ApiError.badRequest("Fişte belge türü e-İrsaliye seçili; e-İrsaliye ekranından gönderin.");
    if (Number(kaynak.baslik.E_FATURA_DURUMU || 0) !== 0) throw ApiError.conflict("Fiş e-belge olarak gönderilmiş görünüyor; giden kutusunu kontrol edin.");
    const tarih = new Date(kaynak.baslik.TARIH);
    if (Number.isNaN(tarih.getTime())) throw ApiError.badRequest("Fiş tarihi okunamadı.");
    return { kaynak, alis: tur === 3, yil: Number(tarih.toISOString().slice(0, 4)) };
  }

  /** Sarraf satışında senaryo: Perakende ile aynı (nihai tüketici → e-Arşiv, diğerinde ICE mükellef sorgusu) */
  private static async sarrafGirdisi(k: KaynakKimlik, kullanici: string, ctx?: DbContext) {
    const { kaynak, alis, yil } = await this.sarrafOku(k, ctx);
    if (alis) {
      const belgeNo = await EbelgeService.siradakiBelgeNo("EGider", yil, ctx);
      return { kaynak, alis, girdi: await this.aliciAdresiniTamamla(sarrafGiderGirdisi(kaynak, belgeNo), ctx), senaryo: "GIDERPUSULASI" };
    }
    const senaryo = await this.perakendeSenaryo(sarrafAliciVkn(kaynak.baslik), kullanici, ctx);
    const belgeNo = await EbelgeService.siradakiBelgeNo(senaryo === "TICARIFATURA" ? "EFatura" : "EArsiv", yil, ctx);
    const girdi = await this.aliciAdresiniTamamla(sarrafFaturaGirdisi(kaynak, belgeNo), ctx);
    girdi.senaryo = senaryo;
    return { kaynak, alis, girdi, senaryo };
  }

  /** Sarraf hazırlama: satış → ICE doğrulaması, alış → gider pusulası ön izleme. Hiçbir şey gönderilmez. */
  private static async sarrafHazirla(k: KaynakKimlik, kullanici: string, ctx?: DbContext) {
    const { kaynak, alis, girdi, senaryo } = await this.sarrafGirdisi(k, kullanici, ctx);
    if (alis) {
      const { ozet } = await EbelgeService.giderPusulasiOnizle(girdi as any, ctx);
      return { ...k, belgeNo: girdi.belgeNo, unvan: girdi.alici.unvan || "", belgeTuruAdi: "e-Gider pusulası", parmakizi: kaynakParmakizi(kaynak), senaryo, tutar: ozet.odenecekTutar, durum: "HAZIR" };
    }
    const sonuc = await EbelgeService.dogrulaGidenBelge(girdi as UblFaturaGirdi, kullanici, false, ctx);
    if (!sonuc.semaGecerli || !sonuc.schematronGecerli) throw ApiError.unprocessable(sonuc.mesaj || "Sarraf fişi ICE doğrulamasından geçmedi.");
    return { ...k, belgeNo: girdi.belgeNo, unvan: girdi.alici.unvan, belgeTuruAdi: senaryo === "TICARIFATURA" ? "e-Fatura" : "e-Arşiv",
      parmakizi: kaynakParmakizi(kaynak), senaryo, tutar: sonuc.ozet.odenecekTutar, durum: "HAZIR" };
  }

  /**
   * Sarraf gönderimi: Perakende ile aynı güvenlik sırası. Numara burada yeniden alınır (hazırlamadan beri seri
   * ilerlemiş olabilir); kaynak kaydı bu numarayla yer tutulur, sonuç kaynak kaydına ve fişe yazılır.
   */
  private static async sarrafGonder(k: KaynakKimlik, parmakizi: string, senaryo: string, kullanici: string, ctx?: DbContext) {
    const ilk = await this.sarrafGirdisi(k, kullanici, ctx);
    if (kaynakParmakizi(ilk.kaynak) !== parmakizi) throw ApiError.conflict("Fiş değişmiş. Yeniden hazırlayın ve onaylayın.");
    if (ilk.senaryo !== senaryo) throw ApiError.conflict(ilk.alis ? "Belge türü değişmiş. Yeniden hazırlayın." : "Alıcının mükellefiyeti değişmiş. Yeniden hazırlayın.");
    const belgeNo = ilk.girdi.belgeNo;
    if (await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, ctx)) throw ApiError.conflict(`${belgeNo} numarası giden kutusunda zaten var; yeniden deneyin.`);
    await EbelgeKaynakRepository.reserve(k, belgeNo, ctx);
    try {
      const guncel = await EbelgeKaynakRepository.detay(k, ctx);
      if (kaynakParmakizi(guncel) !== parmakizi) throw ApiError.conflict("Fiş değişmiş; gönderim durduruldu.");
      const secenek = { kaynakFisId: kaynakAnahtar(k) };
      const sonuc = ilk.alis
        ? await EbelgeService.giderPusulasiGonder(ilk.girdi as any, kullanici, ctx, secenek)
        : ilk.senaryo === "TICARIFATURA"
          ? await EbelgeService.faturaGonder(ilk.girdi as UblFaturaGirdi, kullanici, ctx, secenek)
          : await EbelgeService.earsivGonder(ilk.girdi as UblFaturaGirdi, kullanici, ctx, secenek);
      await EbelgeKaynakRepository.sonuc(k, await this.kuyrukKaynakDurumu(sonuc.uuid, ctx), sonuc.mesaj, ctx);
      return sonuc;
    } catch (e: any) {
      const mevcut = await EbelgeSqlRepository.gidenBelgeNoVarMi(belgeNo, ctx).catch(() => true);
      await EbelgeKaynakRepository.sonuc(k, mevcut ? "KONTROL_GEREKLI" : "HATA", e.message || "İşlem tamamlanamadı.", ctx).catch(() => undefined);
      throw e;
    }
  }

  static async hazirla(k: KaynakKimlik, kullanici: string, ctx?: DbContext) {
    if (dovizMi(k)) return this.dovizHazirla(k, ctx);
    if (perakendeMi(k)) return this.perakendeHazirla(k, kullanici, ctx);
    if (sarrafMi(k)) return this.sarrafHazirla(k, kullanici, ctx);
    throw ApiError.badRequest("Bilinmeyen kaynak belge türü.");
  }
  static async gonder(k: KaynakKimlik, parmakizi: string, senaryo: string, kullanici: string, ctx?: DbContext) {
    if (dovizMi(k)) return this.dovizGonder(k, parmakizi, kullanici, ctx);
    if (perakendeMi(k)) return this.perakendeGonder(k, parmakizi, senaryo, kullanici, ctx);
    if (sarrafMi(k)) return this.sarrafGonder(k, parmakizi, senaryo, kullanici, ctx);
    throw ApiError.badRequest("Bilinmeyen kaynak belge türü.");
  }

  /**
   * e-Döviz hazırlama: `preview_edoviz_basic` ile **mali sonuç doğurmadan** doğrular.
   * Fatura akışındaki `invoice_check_validate` güvencesinin döviz karşılığıdır.
   */
  static async dovizHazirla(k: KaynakKimlik, ctx?: DbContext) {
    const kaynak = await EbelgeKaynakRepository.dovizDetay(k, ctx);
    const ayar = await EbelgeSqlRepository.getAyar(ctx);
    const firma = await EbelgeSqlRepository.getFirmaBilgisi(ctx);
    const girdi = dovizGirdisi(kaynak, { vknTckn: ayar?.firmaVkn, dosyaNo: firma.dosyaNo });
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
    const firma = await EbelgeSqlRepository.getFirmaBilgisi(ctx);
    const girdi = dovizGirdisi(kaynak, { vknTckn: ayar?.firmaVkn, dosyaNo: firma.dosyaNo });
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
        gonderimDurumu: "KUYRUKTA",
        iceResponseMesaj: "Gönderim kuyruğunda.",
        kaynakFisId: kaynakAnahtar(k),
        olusturan: kullanici,
        gonderen: kullanici,
        gonderimTarihi: new Date(),
      } as any, ctx);

      // Gönderim ve sonucun kesinleşmesi kuyrukta (docs/EBELGE_KUYRUK_YOL_HARITASI.md). XML saklanmadığı için
      // yeniden gönderimde aynı girdi kullanılır.
      await EbelgeKuyrukService.kuyrugaAl(
        { uuid: girdi.uuid, belgeTuru: "EDoviz", islem: "GONDER", kullanici, veri: { dovizGirdi: girdi } },
        ctx
      );
      const son = await EbelgeSqlRepository.getGiden(girdi.uuid, ctx);
      if (son?.gonderimDurumu === "HATA") {
        throw ApiError.conflict(String(son.ICE_RESPONSE_MESAJ || "").trim() || "e-Döviz gönderimi reddedildi.");
      }
      await EbelgeKaynakRepository.sonuc(k, "GONDERILDI", "Gönderildi", ctx);
      return { uuid: girdi.uuid, belgeNo: girdi.belgeNo, durum: "GONDERILDI", mesaj: "Gönderildi." };
    } catch (e: any) {
      // Giden kaydı oluştuysa ICE belgeyi görmüş olabilir; hak talebini yeniden açma.
      // Kuyruğun kesinleştirdiği ret (HATA) ise kaynağa HATA yazılır.
      const g = await EbelgeSqlRepository.getGiden(girdi.uuid, ctx).catch(() => null);
      const mevcut = g ? true : await EbelgeSqlRepository.gidenBelgeNoVarMi(girdi.belgeNo, ctx).catch(() => true);
      await EbelgeKaynakRepository.sonuc(k, g?.gonderimDurumu === "HATA" ? "HATA" : mevcut ? "KONTROL_GEREKLI" : "HATA",
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
export function dovizGirdisi(kaynak: { baslik: any }, gonderici?: { vknTckn?: string; dosyaNo?: string }): EDovizGirdi {
  const b = kaynak.baslik;
  // ICE: "Yetkili Müessese Dosya Numarası gönderilmek zorundadır." Firma tanımından
  // gelir; gönderici bilgisi verilmiş ama dosya no boşsa ICE'ye gitmeden durdurulur,
  // çünkü ret kesindir ve belge numarası boşa yakılmasın.
  const dosyaNo = temiz(gonderici?.dosyaNo);
  // Kontrol, çağıran dosya numarasını iletmeyi üstlendiğinde (anahtar mevcut) çalışır;
  // salt eşleme amaçlı çağrılar (yalnız VKN verilen) ICE kuralına takılmaz.
  if (gonderici && "dosyaNo" in gonderici && !dosyaNo) {
    throw ApiError.badRequest(
      "Yetkili Müessese Dosya Numarası boş. Firma tanımındaki 'Dosya No' alanını doldurun; ICE e-Döviz belgesinde zorunlu tutuyor."
    );
  }
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

  // ICE'nin gözlenen kuralı: Istatistik_No her iki belge türünde de bekleniyor ve
  // kodun türü belge türüyle eşleşmeli ("ISTATISTIKNO ile Belge türü uyumsuzluğu").
  // ICE reddedince belge numarası yanıyor; bu yüzden hem kodun varlığı hem de türü
  // ICE'ye gitmeden fişin istatistik tanımından (TODVZ_ISTATISTIK.FIS_TIPI) doğrulanır.
  const fisTipi = Number(b.FIS_TIPI) === 1 ? 1 : 0;
  const istatistikNo = temiz(b.ISTATISTIK_NO || b.ISTATISTIK_KOD);
  const turAdi = (t: number) => (t === 1 ? "satış" : "alış");
  if (!istatistikNo) {
    throw ApiError.badRequest(
      `Döviz ${turAdi(fisTipi)} fişinde istatistik kodu yok. Fişte ${turAdi(fisTipi)} türüne uygun bir istatistik seçin; ICE e-Döviz belgesinde zorunlu tutuyor.`
    );
  }
  const istatistikTipi = b.ISTATISTIK_FIS_TIPI === undefined || b.ISTATISTIK_FIS_TIPI === null ? null : Number(b.ISTATISTIK_FIS_TIPI);
  if (istatistikTipi !== null && istatistikTipi !== fisTipi) {
    throw ApiError.badRequest(
      `Fişin istatistik kodu (${istatistikNo}) ${turAdi(istatistikTipi)} türüne ait; bu bir ${turAdi(fisTipi)} fişi. ` +
        `ICE bunu "ISTATISTIKNO ile Belge türü uyumsuzluğu" diye reddeder ve belge numarası yanar. Fişte ${turAdi(fisTipi)} istatistiği seçin.`
    );
  }

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
    odeme: { yontemi: 'NAKIT', sonOdemeTarihi: isoTarih(b.IssueDate || b.TARIH, 'Son ödeme tarihi'), yetkiliMuesseseDosyaNo: dosyaNo },
    // Her iki türde gönderilir; türü yukarıda fişin istatistik tanımıyla doğrulandı.
    istatistikNo,
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
      // Döviz alım/satımında vergi BSMV'dir (GİB vergi kodu 0021). Görünüm kod
      // taşıyorsa o kullanılır; alımda oran ve tutar sıfır olsa da kod gönderilir,
      // çünkü ICE vergi kodunu tabloda arıyor ve boş/eksik kodda null referans veriyor.
      vergiAdi: temiz(b.TaxTypeName || b.VERGI_ADI) || "BSMV",
      vergiKodu: temiz(b.TaxTypeCode || b.VERGI_KODU) || "0021",
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

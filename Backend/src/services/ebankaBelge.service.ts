import { z } from "zod";
import { DbContext } from "../models/ebankaSql.repository.js";
import { EBankaMutabakatSqlRepository, MutabakatHareketi, belgeAnahtari } from "../models/ebankaMutabakatSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { EBankaAktarimService, planla } from "./ebankaAktarim.service.js";
import { EbelgeService } from "./ebelge.service.js";
import { EbelgeKaynakService } from "./ebelgeKaynak.service.js";
import { NIHAI_TUKETICI } from "./ebelgePerakende.js";
import { UblFaturaGirdi, UblTaraf } from "./ice/ubl/invoiceBuilder.js";
import { GiderPusulasiGirdi, hesaplaGiderPusulasi } from "./ice/ubl/giderPusulasiBuilder.js";
import { KuyumCozum, ebankaGiderGirdisi, ebankaSatisGirdisi } from "./kuyumFatura.js";
import { kuyumKoduBul } from "./kuyumKodlari.js";

/**
 * Kuyum e-Banka Faturalandırma (docs/EBANKA_FATURALANDIRMA_YOL_HARITASI.md EF4–EF15, EF21–EF25, U1): banka hareketinden fiş
 * açılmadan doğrudan belge. Gelen para → kuyum satış faturası (e-Fatura / e-Arşiv, mükellef sorgusuyla), giden para →
 * kuyum e-Gider pusulası. Tutar, yön ve hesap sunucuda hareketten okunur; istemcinin toplamına güvenilmez. Belge giden
 * kutusuna KAYNAK_FIS_ID = 'EB:<VOMSIS_ID>' ile yazılır, liste bağı oradan kurar.
 */

const altinSema = z.object({
  ad: z.string().trim().min(1, "Altın adı girilmeli.").max(200),
  miktar: z.number().positive("Gram / adet sıfırdan büyük olmalı."),
  birimKodu: z.enum(["GRM", "C62"]),
  birimFiyat: z.number().positive("Fiyat sıfırdan büyük olmalı."),
  gumus: z.boolean().optional(),
  milyem: z.number().nonnegative().nullable().optional(),
  /** GİB kodu (kuyumKodlari.ts); boşsa altın 805, gümüş 808 (EF29–EF34) */
  kod: z.string().trim().max(10).nullable().optional().refine((k) => !k || !!kuyumKoduBul(k), "Kod kuyumculuk kodlarından seçilmeli (805, 808, 230, 231, 232, 301)."),
});

export const ebankaBelgeSemasi = z.object({
  vomsisId: z.number().int().positive(),
  /** Döviz hesapta TL karşılığı kuru (EF23) */
  kur: z.number().positive().nullable().optional(),
  alici: z.object({
    vknTckn: z.string().trim().regex(/^\d{10}$|^\d{11}$/, "Alıcının TC kimlik no (11 hane) ya da VKN'si (10 hane) girilmeli."),
    unvan: z.string().trim().max(300).optional().default(""),
    ad: z.string().trim().max(100).optional().default(""),
    soyad: z.string().trim().max(100).optional().default(""),
    vergiDairesi: z.string().trim().max(100).optional().default(""),
    il: z.string().trim().max(60).optional().default(""),
    ilce: z.string().trim().max(60).optional().default(""),
    adres: z.string().trim().max(400).optional().default(""),
    eposta: z.string().trim().max(150).optional().default(""),
    telefon: z.string().trim().max(30).optional().default(""),
  }),
  satis: z.object({ altinlar: z.array(altinSema).min(1).max(20), iscilikKdvOrani: z.number().min(0).max(100) }).optional(),
  gider: z.object({ altin: altinSema, iscilik: z.number().nonnegative().nullable().optional() }).optional(),
});

export type EbankaBelgeIstegi = z.infer<typeof ebankaBelgeSemasi>;

const yuvarla = (n: number) => Math.round(n * 100) / 100;
const bugun = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
const tlMi = (h: Pick<MutabakatHareketi, "doviz">) => ["TL", "TRY", ""].includes((h.doviz || "").trim().toUpperCase());

/** Gerçek kişide ad / soyad unvandan ayrılır (TCKN'li alıcıda UBL ikisini de ister) */
const taraf = (a: EbankaBelgeIstegi["alici"]): UblTaraf => {
  let ad = a.ad;
  let soyad = a.soyad;
  if (a.vknTckn.length === 11 && !(ad && soyad)) {
    const parcalar = a.unvan.split(/\s+/).filter(Boolean);
    soyad = parcalar.length > 1 ? parcalar.pop()! : "";
    ad = parcalar.join(" ");
  }
  if (a.vknTckn.length === 11 && !(ad && soyad)) throw ApiError.badRequest("Alıcının adı ve soyadı girilmeli.");
  if (a.vknTckn.length === 10 && !a.unvan) throw ApiError.badRequest("Alıcının unvanı girilmeli.");
  const unvan = a.unvan || [ad, soyad].filter(Boolean).join(" ");
  return {
    vknTckn: a.vknTckn,
    unvan,
    ad: a.vknTckn.length === 11 ? ad : "",
    soyad: a.vknTckn.length === 11 ? soyad : "",
    vergiDairesi: a.vergiDairesi || undefined,
    il: a.il || undefined,
    ilce: a.ilce || undefined,
    adres: a.adres || undefined,
    eposta: a.eposta || undefined,
    telefon: a.telefon || undefined,
  };
};

export interface EbankaBelgeHazir {
  vomsisId: number;
  tur: "fatura" | "gider";
  /** EARSIVFATURA · TICARIFATURA · GIDERPUSULASI */
  senaryo: string;
  belgeTuruAdi: string;
  /** Önerilen numara (gönderimde seriden yeniden alınır) */
  belgeNo: string;
  tarih: string;
  hedef: number;
  satirlar: { ad: string; miktar: number; birim: string; birimFiyat: number; kdvOrani: number; tutar: number; kdv: number; iskonto?: number }[];
  toplam: number;
  fiyatKaydi: KuyumCozum["fiyatKaydi"];
  uyarilar: string[];
  /** ICE'nin HTML önizlemesi (fatura); gider pusulasında yok */
  onizlemeHtml: string | null;
}

export class EBankaBelgeService {
  /** Hareket okunur, belge kesilebilir mi denetlenir, hedef (TL) tutar bulunur */
  private static async hareketHedefi(istek: EbankaBelgeIstegi, dbContext?: DbContext) {
    const h = await EBankaMutabakatSqlRepository.hareketGetir(istek.vomsisId, dbContext);
    if (!h) throw ApiError.notFound("Banka hareketi bulunamadı.");
    const gelen = h.tutar > 0;
    if (gelen && !istek.satis) throw ApiError.badRequest("Gelen paradan satış faturası kesilir; altın satırları girilmeli.");
    if (!gelen && !istek.gider) throw ApiError.badRequest("Giden paradan gider pusulası kesilir; altın satırı girilmeli.");
    const s = await EBankaAktarimService.sozlukler(dbContext);
    if (planla(h, s).virman) throw ApiError.badRequest("Hesaplar arası virmana belge kesilmez.");
    const kaldirilan = new Set(h.kaldirilanBelgeler);
    const mevcut = (await EBankaMutabakatSqlRepository.belgeler([h.vomsisId], dbContext)).filter((b) => !kaldirilan.has(b.uuid.toLowerCase()));
    if (mevcut.length) throw ApiError.conflict(`Bu hareket için ${mevcut[0].belgeNo} numaralı belge zaten kesilmiş (EF24: bir hareket bir belge).`);
    let hedef: number;
    if (tlMi(h)) hedef = yuvarla(Math.abs(h.tutar));
    else {
      if (!istek.kur || !(istek.kur > 0)) throw ApiError.badRequest(`Hesap ${h.doviz} cinsinden; TL karşılığı için kur girilmeli.`);
      hedef = yuvarla(Math.abs(h.tutar) * istek.kur);
    }
    return { h, gelen, hedef };
  }

  /** Belge girdisi; numara seriden (gönderimde yeniden alınır) */
  private static async girdiKur(istek: EbankaBelgeIstegi, kullanici: string, dbContext?: DbContext) {
    const { h, gelen, hedef } = await this.hareketHedefi(istek, dbContext);
    const tarih = bugun();
    const yil = Number(tarih.slice(0, 4));
    const alici = taraf(istek.alici);
    if (gelen) {
      const senaryo: "TICARIFATURA" | "EARSIVFATURA" =
        alici.vknTckn === NIHAI_TUKETICI ? "EARSIVFATURA" : (await EbelgeService.mukellefSorgulaCanli(alici.vknTckn, kullanici, dbContext)).mukellefMi ? "TICARIFATURA" : "EARSIVFATURA";
      const belgeNo = await EbelgeService.siradakiBelgeNo(senaryo === "TICARIFATURA" ? "EFatura" : "EArsiv", yil, dbContext);
      const { girdi, cozum } = ebankaSatisGirdisi(istek.satis!, hedef, { belgeNo, tarih, alici, odemeNotu: h.bankaAdi || null });
      const tam = await EbelgeKaynakService.aliciAdresiniTamamla({ ...girdi, senaryo } as UblFaturaGirdi, dbContext);
      return { tur: "fatura" as const, h, hedef, senaryo, fatura: tam, cozum };
    }
    const belgeNo = await EbelgeService.siradakiBelgeNo("EGider", yil, dbContext);
    const gider = ebankaGiderGirdisi(istek.gider!, hedef, { belgeNo, tarih, alici, not: h.bankaAdi ? `Ödeme: ${h.bankaAdi}` : null });
    const tam = await EbelgeKaynakService.aliciAdresiniTamamla(gider as GiderPusulasiGirdi, dbContext);
    return { tur: "gider" as const, h, hedef, senaryo: "GIDERPUSULASI", gider: tam };
  }

  /** Hazırlama: hesap + ICE doğrulaması (fatura) / tutar özeti (gider). Hiçbir şey gönderilmez. */
  public static async hazirla(govde: unknown, kullanici: string, dbContext?: DbContext): Promise<EbankaBelgeHazir> {
    const istek = this.coz(govde);
    const k = await this.girdiKur(istek, kullanici, dbContext);
    if (k.tur === "fatura") {
      const d = await EbelgeService.dogrulaGidenBelge(k.fatura, kullanici, true, dbContext);
      if (!d.semaGecerli || !d.schematronGecerli) throw ApiError.unprocessable(d.mesaj || "Belge ICE doğrulamasından geçmedi.");
      return {
        vomsisId: istek.vomsisId,
        tur: "fatura",
        senaryo: k.senaryo,
        belgeTuruAdi: k.senaryo === "TICARIFATURA" ? "e-Fatura" : "e-Arşiv",
        belgeNo: k.fatura.belgeNo,
        tarih: k.fatura.tarih!,
        hedef: k.hedef,
        satirlar: k.fatura.satirlar.map((s, i) => ({
          ad: s.ad, miktar: s.miktar, birim: s.birimKodu === "GRM" ? "Gram" : "Adet", birimFiyat: s.birimFiyat, kdvOrani: s.kdvOrani,
          tutar: d.ozet.satirlar[i].matrah, kdv: d.ozet.satirlar[i].kdvTutari, ...(s.iskontoTutari ? { iskonto: s.iskontoTutari } : {}),
        })),
        toplam: d.ozet.odenecekTutar,
        fiyatKaydi: k.cozum.fiyatKaydi,
        uyarilar: k.cozum.fiyatKaydi
          ? [`Toplamın ${k.hedef.toFixed(2)} TL'ye kuruşu kuruşuna eşit olması için son altının fiyatı ${k.cozum.fiyatKaydi.eski} → ${k.cozum.fiyatKaydi.yeni} yapıldı.`]
          : [],
        onizlemeHtml: d.html,
      };
    }
    const { ozet, uyarilar } = await EbelgeService.giderPusulasiOnizle(k.gider, dbContext);
    const hesap = hesaplaGiderPusulasi(k.gider.satirlar, k.gider.vergiTuruKodu);
    if (Math.abs(ozet.odenecekTutar - k.hedef) > 0.001) throw ApiError.internal("Gider pusulası toplamı banka tutarıyla aynı çıkmadı; gönderilmedi.");
    return {
      vomsisId: istek.vomsisId,
      tur: "gider",
      senaryo: "GIDERPUSULASI",
      belgeTuruAdi: "e-Gider pusulası",
      belgeNo: k.gider.belgeNo,
      tarih: k.gider.tarih!,
      hedef: k.hedef,
      satirlar: k.gider.satirlar.map((s, i) => ({
        ad: s.ad, miktar: s.miktar, birim: s.birimKodu === "GRM" ? "Gram" : "Adet", birimFiyat: s.birimFiyat, kdvOrani: s.vergiOrani,
        tutar: hesap.satirlar[i].matrah, kdv: hesap.satirlar[i].vergiTutari,
      })),
      toplam: ozet.odenecekTutar,
      fiyatKaydi: null,
      uyarilar,
      onizlemeHtml: null,
    };
  }

  /**
   * Gönderim: numara seriden yeniden alınır, belge giden kutusuna 'EB:<hareket>' anahtarıyla yazılır (U1). Fatura
   * gönderimi kendi içinde yeniden doğrular; gider pusulasında karşı tarafın mükellefiyeti ICE'den sorulur.
   */
  public static async gonder(govde: unknown, kullanici: string, dbContext?: DbContext) {
    const istek = this.coz(govde);
    const k = await this.girdiKur(istek, kullanici, dbContext);
    const secenek = { kaynakFisId: belgeAnahtari(istek.vomsisId) };
    const sonuc =
      k.tur === "gider"
        ? await EbelgeService.giderPusulasiGonder(k.gider, kullanici, dbContext, secenek)
        : k.senaryo === "TICARIFATURA"
          ? await EbelgeService.faturaGonder(k.fatura, kullanici, dbContext, secenek)
          : await EbelgeService.earsivGonder(k.fatura, kullanici, dbContext, secenek);
    return { ...sonuc, tur: k.tur, belgeTuruAdi: k.tur === "gider" ? "e-Gider pusulası" : k.senaryo === "TICARIFATURA" ? "e-Fatura" : "e-Arşiv" };
  }

  /** Belgenin hareketle bağını kaldırır (U2); belge giden kutusunda kalır */
  public static async bagKaldir(govde: { vomsisId?: unknown; uuid?: unknown }, kullaniciId?: number, dbContext?: DbContext) {
    const vomsisId = Number(govde.vomsisId);
    const uuid = String(govde.uuid ?? "").trim();
    if (!Number.isSafeInteger(vomsisId) || vomsisId <= 0 || !/^[0-9a-f-]{36}$/i.test(uuid)) throw ApiError.badRequest("Geçersiz hareket ya da belge.");
    if (!(await EBankaMutabakatSqlRepository.belgeBaginiKaldir(vomsisId, uuid, kullaniciId, dbContext))) throw ApiError.notFound("Hareket bulunamadı.");
    return { kaldirildi: true };
  }

  private static coz(govde: unknown): EbankaBelgeIstegi {
    const p = ebankaBelgeSemasi.safeParse(govde);
    if (!p.success) throw ApiError.badRequest(p.error.issues[0]?.message || "Belge bilgisi geçersiz.");
    return p.data;
  }
}

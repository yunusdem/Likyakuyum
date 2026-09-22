import { AktarimAdayi, CariOzeti, EBankaAktarimSqlRepository, TipKurali } from "../models/ebankaAktarimSql.repository.js";
import { DbContext, EBankaSqlRepository } from "../models/ebankaSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { BankaService } from "./banka.service.js";

// F- e-Banka Faz 2 — Vomsis hareketinin banka fişine aktarımı (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E5–E8, E13–E17, E19, E23, E26–E30)
//  - alacaklı hareket → "0- Havale Alma", borçlu hareket → "1- Havale/EFT Gönderme"
//  - kendi hesaplarımız arası virman: her bacak kendi hesabına carisiz fiş olur (mevcut "4- Virman" fişi bakiyelere yansımadığı için)
//  - Test (örnek veri) modunda hiçbir zaman fiş kesilmez; yalnızca ne yapılacağı gösterilir

const HAVALE_ALMA = 0;
const HAVALE_GONDERME = 1;

export type AktarimKarari = "aktar" | "bekle" | "aktarma";

export interface AktarimPlani {
  karar: AktarimKarari;
  neden: string;
  islemTipi: 0 | 1;
  cari: CariOzeti | null;
  virman: boolean;
  paraId: number | null;
  tlMi: boolean;
}

export interface AktarimSozlukleri {
  bizimIbanlar: Map<string, string>;
  vknSozlugu: Map<string, CariOzeti[]>;
  ibanSozlugu: Map<string, CariOzeti>;
  tipCarileri: Map<number, CariOzeti>;
  paraKodlari: Map<string, number>;
  tlId: number | null;
}

const benzersiz = <T>(liste: (T | null | undefined)[]): T[] => [...new Set(liste.filter((x): x is T => x !== null && x !== undefined && x !== ""))];

/**
 * Bir hareketin otomatik aktarımda ne olacağına karar verir. Veritabanına dokunmaz (kur hariç her şey sözlüklerden gelir).
 * Sıra önemlidir: önce "aktarma" kuralı, sonra aktarımı engelleyen eksikler, en son cari eşleşmesi.
 */
export const planla = (h: AktarimAdayi, s: AktarimSozlukleri): AktarimPlani => {
  const islemTipi = h.tutar >= 0 ? HAVALE_ALMA : HAVALE_GONDERME;
  const paraId = s.paraKodlari.get((h.doviz || "TL").toUpperCase()) ?? null;
  const taban = { islemTipi, cari: null, virman: false, paraId, tlMi: paraId !== null && paraId === s.tlId } as const;

  if (h.tipKurali === 2) return { ...taban, karar: "aktarma", neden: "Bu hareket tipi aktarılmıyor" };
  if (!h.bankaId) return { ...taban, karar: "bekle", neden: "Hesap bir Banka Hesap Kartı ile eşleşmedi" };
  if (paraId === null) return { ...taban, karar: "bekle", neden: `"${h.doviz}" döviz cinsi para tanımlarında yok` };
  if (!h.tutar) return { ...taban, karar: "bekle", neden: "Tutar sıfır" };
  if (h.tipKurali === 1) return { ...taban, karar: "bekle", neden: "Bu hareket tipi elle aktarılır" };

  // Tipin varsayılan carisi (masraf, faiz, vergi…)
  if (h.tipCariId) {
    const cari = s.tipCarileri.get(h.tipCariId);
    if (cari) return { ...taban, karar: "aktar", neden: "Hareket tipinin varsayılan carisi", cari };
  }

  // Karşı taraf bizim başka bir hesabımızsa cari aranmaz
  const karsiIbanlar = benzersiz([h.karsiIban, islemTipi === HAVALE_ALMA ? h.gonderenIban : h.aliciIban]);
  const bizimHesap = karsiIbanlar.map((i) => s.bizimIbanlar.get(i)).find(Boolean);
  if (bizimHesap) return { ...taban, karar: "aktar", neden: `Hesaplar arası virman (${bizimHesap})`, virman: true };

  // Vergi / TC kimlik no
  const numaralar = benzersiz([h.karsiVkn, h.gonderenVkn, h.gonderenTckn, h.odeyenVkn].map((n) => (n || "").trim()));
  const vknAdaylari = new Map<number, CariOzeti>();
  for (const n of numaralar) for (const c of s.vknSozlugu.get(n) || []) vknAdaylari.set(c.cariKartId, c);
  if (vknAdaylari.size === 1) return { ...taban, karar: "aktar", neden: "Vergi / TC kimlik no ile eşleşti", cari: [...vknAdaylari.values()][0] };
  if (vknAdaylari.size > 1) return { ...taban, karar: "bekle", neden: `Aynı vergi / TC kimlik no ${vknAdaylari.size} caride var` };

  // Daha önce elle aktarımda öğrenilen IBAN
  for (const i of karsiIbanlar) {
    const cari = s.ibanSozlugu.get(i);
    if (cari) return { ...taban, karar: "aktar", neden: "Karşı IBAN daha önce bu cariyle eşlenmişti", cari };
  }

  return { ...taban, karar: "bekle", neden: numaralar.length || karsiIbanlar.length ? "Cari bulunamadı" : "Karşı taraf bilgisi yok" };
};

const gun = (h: AktarimAdayi): string => (h.sistemTarihi || "").slice(0, 10);

export class EBankaAktarimService {
  private static async sozlukler(dbContext?: DbContext): Promise<AktarimSozlukleri> {
    const [bizimIbanlar, vknSozlugu, ibanSozlugu, para, kurallar] = await Promise.all([
      EBankaAktarimSqlRepository.bizimIbanlar(dbContext),
      EBankaAktarimSqlRepository.vknSozlugu(dbContext),
      EBankaAktarimSqlRepository.ibanSozlugu(dbContext),
      EBankaAktarimSqlRepository.paraSozlugu(dbContext),
      EBankaAktarimSqlRepository.tipKurallari(dbContext),
    ]);
    const tipCarileri = new Map<number, CariOzeti>();
    for (const k of kurallar) if (k.cariKartId && k.cariAdi !== null) tipCarileri.set(k.cariKartId, { cariKartId: k.cariKartId, kod: k.cariKod || "", ad: k.cariAdi });
    return { bizimIbanlar, vknSozlugu, ibanSozlugu, tipCarileri, paraKodlari: para.kodlar, tlId: para.tlId };
  }

  /** Bekleyenler ekranı: karara bağlanmamış hareketler + otomatik aktarımda her birine ne olacağı. */
  public static async bekleyenler(dbContext?: DbContext) {
    const ayar = await EBankaSqlRepository.ayarGetir(dbContext);
    const mod = ayar?.mod ?? "sahte";
    const baslangic = ayar?.aktarimBaslangic ?? null;
    if (!baslangic) return { mod, aktarimBaslangic: null, satirlar: [] };

    const [adaylar, s] = await Promise.all([EBankaAktarimSqlRepository.bekleyenler(baslangic, dbContext), this.sozlukler(dbContext)]);
    return {
      mod,
      aktarimBaslangic: baslangic,
      satirlar: adaylar.map((h) => {
        const p = planla(h, s);
        return { ...h, plan: { karar: p.karar, neden: p.neden, islemTipi: p.islemTipi, virman: p.virman, tlMi: p.tlMi, cari: p.cari } };
      }),
    };
  }

  private static async canliMi(dbContext?: DbContext): Promise<{ baslangic: string }> {
    const ayar = await EBankaSqlRepository.ayarGetir(dbContext);
    if ((ayar?.mod ?? "sahte") !== "canli") throw ApiError.badRequest("Test (örnek veri) modunda fiş kesilmez. Aktarım yalnızca Canlı modda çalışır.");
    if (!ayar?.aktarimBaslangic) throw ApiError.badRequest("Aktarım başlangıç tarihi girilmemiş (F- e-Banka > Ayarlar).");
    return { baslangic: ayar.aktarimBaslangic };
  }

  /** Fişi keser ve hareketi işaretler. Hareket önce kilitlenir; fiş kesilemezse kilit bırakılır. */
  private static async fisKes(
    h: AktarimAdayi,
    p: { islemTipi: 0 | 1; cariKartId: number | null; paraId: number; kur: number; aciklamaOneki?: string },
    kullaniciId?: number,
    dbContext?: DbContext
  ): Promise<number> {
    if (!(await EBankaAktarimSqlRepository.talepEt(h.vomsisId, dbContext))) throw ApiError.conflict("Bu hareket zaten aktarılmış ya da aktarılmayacak olarak işaretli.");
    try {
      const meblag = Math.abs(h.tutar);
      const aciklama = `${p.aciklamaOneki || ""}${h.aciklama || h.tipAdi || ""}`.trim().slice(0, 250) || null;
      const fis = await BankaService.saveHareket(
        {
          islemTipi: p.islemTipi,
          bankaId: h.bankaId as number,
          cariKartId: p.cariKartId,
          // Yalnızca gün yazılır (saat 00:00), elle girilen banka fişleri gibi. Saat de yazılsaydı mevcut banka ekranı listede tarihi
          // tarayıcı saat dilimine çevirdiği için 21:00 sonrası hareketler ertesi güne kaymış görünürdü. Saat e-Banka kaydında durur.
          tarih: `${gun(h)}T00:00:00Z`,
          belgeNo: (h.fisNo || h.evrakNo || "").slice(0, 50) || null,
          aciklama,
          satirlar: [{ satirNo: 1, paraId: p.paraId, meblag, kur: p.kur, giseKuru: p.kur, tutarTl: Math.round(meblag * p.kur * 100) / 100, aciklama }],
        },
        kullaniciId,
        dbContext
      );
      await EBankaAktarimSqlRepository.aktarildiYaz(h.vomsisId, fis.bankaHareketId, p.cariKartId, dbContext);
      return fis.bankaHareketId;
    } catch (err) {
      await EBankaAktarimSqlRepository.talebiBirak(h.vomsisId, dbContext).catch(() => undefined);
      throw err;
    }
  }

  /** Otomatik aktarım: eşitlemeden sonra ve Bekleyenler ekranındaki butonla çalışır. */
  public static async calistir(kullaniciId?: number, dbContext?: DbContext): Promise<{ aktarilan: number; aktarilmayacak: number; bekleyen: number; hatali: number }> {
    const { baslangic } = await this.canliMi(dbContext);
    const aktarilmayacak = await EBankaAktarimSqlRepository.aktarilmayacaklariKapat(baslangic, dbContext);
    const [adaylar, s] = await Promise.all([EBankaAktarimSqlRepository.bekleyenler(baslangic, dbContext), this.sozlukler(dbContext)]);

    let aktarilan = 0;
    let hatali = 0;
    let bekleyen = 0;
    const kurlar = new Map<string, number>();

    for (const h of adaylar) {
      const p = planla(h, s);
      if (p.karar !== "aktar" || p.paraId === null) {
        bekleyen++;
        continue;
      }
      let kur = 1;
      if (!p.tlMi) {
        const anahtar = `${p.paraId}|${gun(h)}|${p.islemTipi}`;
        if (!kurlar.has(anahtar)) kurlar.set(anahtar, await EBankaAktarimSqlRepository.kurGetir(p.paraId, gun(h), p.islemTipi === HAVALE_ALMA, dbContext));
        kur = kurlar.get(anahtar) || 0;
        // Kur tablosunda karşılığı yoksa TL tutar yanlış olur; kullanıcı kuru elle girsin
        if (kur <= 0) {
          bekleyen++;
          continue;
        }
      }
      try {
        await this.fisKes(h, { islemTipi: p.islemTipi, cariKartId: p.cari?.cariKartId ?? null, paraId: p.paraId, kur, aciklamaOneki: p.virman ? "Virman: " : "" }, kullaniciId, dbContext);
        aktarilan++;
      } catch {
        hatali++;
      }
    }

    const sonuc = { aktarilan, aktarilmayacak, bekleyen, hatali };
    await EBankaSqlRepository.logYaz(
      {
        islem: "aktarim",
        mod: "canli",
        basarili: hatali === 0,
        adet: aktarilan,
        mesaj: `${aktarilan} fiş kesildi, ${aktarilmayacak} hareket aktarılmayacak olarak kapatıldı, ${bekleyen} bekliyor${hatali ? `, ${hatali} hata` : ""}`,
        kullaniciId,
      },
      dbContext
    );
    return sonuc;
  }

  /** Bekleyenler'den elle aktarım: cariyi (isteğe bağlı) ve döviz hesabında kuru kullanıcı verir. */
  public static async elleAktar(vomsisId: number, girdi: { cariKartId?: number | null; kur?: number | null }, kullaniciId?: number, dbContext?: DbContext): Promise<{ bankaHareketId: number }> {
    await this.canliMi(dbContext);
    const h = await EBankaAktarimSqlRepository.adayGetir(vomsisId, dbContext);
    if (!h) throw ApiError.notFound("Hareket bulunamadı.");
    if (h.aktarimDurumu !== 0) throw ApiError.conflict("Bu hareket bekleyenlerde değil.");
    if (!h.bankaId) throw ApiError.badRequest("Hesap bir Banka Hesap Kartı ile eşleşmedi. Önce F- e-Banka > Hesaplar ekranından eşleyin.");
    if (!h.tutar) throw ApiError.badRequest("Tutarı sıfır olan hareket aktarılamaz.");

    const para = await EBankaAktarimSqlRepository.paraSozlugu(dbContext);
    const paraId = para.kodlar.get((h.doviz || "TL").toUpperCase());
    if (!paraId) throw ApiError.badRequest(`"${h.doviz}" döviz cinsi para tanımlarında yok.`);

    const cariKartId = girdi.cariKartId ? Number(girdi.cariKartId) : null;
    if (cariKartId && !(await EBankaAktarimSqlRepository.cariGetir(cariKartId, dbContext))) throw ApiError.badRequest("Seçilen cari bulunamadı.");

    const islemTipi = h.tutar >= 0 ? HAVALE_ALMA : HAVALE_GONDERME;
    let kur = 1;
    if (paraId !== para.tlId) {
      kur = Number(girdi.kur) > 0 ? Number(girdi.kur) : await EBankaAktarimSqlRepository.kurGetir(paraId, gun(h), islemTipi === HAVALE_ALMA, dbContext);
      if (!(kur > 0)) throw ApiError.badRequest("Bu tarih için kur bulunamadı; kuru elle girin.");
    }

    const bankaHareketId = await this.fisKes(h, { islemTipi, cariKartId, paraId, kur }, kullaniciId, dbContext);

    // Sonraki hareket kendiliğinden eşleşsin (E17). Kendi hesabımızın IBAN'ı cariye bağlanmaz.
    const karsiIban = h.karsiIban || (islemTipi === HAVALE_ALMA ? h.gonderenIban : h.aliciIban);
    if (cariKartId && karsiIban && !(await EBankaAktarimSqlRepository.bizimIbanlar(dbContext)).has(karsiIban)) {
      await EBankaAktarimSqlRepository.ibanOgren(karsiIban, cariKartId, dbContext).catch(() => undefined);
    }
    return { bankaHareketId };
  }

  /** Bekliyor ↔ aktarılmayacak. */
  public static async durumDegistir(vomsisIdler: unknown, aktarilmayacak: boolean, dbContext?: DbContext): Promise<{ degisen: number }> {
    const idler = Array.isArray(vomsisIdler) ? vomsisIdler.map(Number) : [];
    if (!idler.length) throw ApiError.badRequest("Hareket seçilmedi.");
    return { degisen: await EBankaAktarimSqlRepository.durumYaz(idler, aktarilmayacak ? 2 : 0, dbContext) };
  }

  public static async tipKurallari(dbContext?: DbContext) {
    return EBankaAktarimSqlRepository.tipKurallari(dbContext);
  }

  public static async tipKuraliKaydet(tipKodu: string, girdi: { kural?: number; cariKartId?: number | null }, dbContext?: DbContext) {
    const kural = Number(girdi.kural);
    if (![0, 1, 2].includes(kural)) throw ApiError.badRequest("Geçersiz kural.");
    const cariKartId = girdi.cariKartId ? Number(girdi.cariKartId) : null;
    if (cariKartId && !(await EBankaAktarimSqlRepository.cariGetir(cariKartId, dbContext))) throw ApiError.badRequest("Seçilen cari bulunamadı.");
    if (!(await EBankaAktarimSqlRepository.tipKuraliYaz(tipKodu, kural as TipKurali, cariKartId, dbContext))) throw ApiError.notFound("Hareket tipi bulunamadı.");
    return EBankaAktarimSqlRepository.tipKurallari(dbContext);
  }

  public static async cariAra(arama: string, dbContext?: DbContext) {
    if (!arama || arama.trim().length < 2) return [];
    return EBankaAktarimSqlRepository.cariAra(arama, dbContext);
  }
}

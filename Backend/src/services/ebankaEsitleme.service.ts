import { HttpStatus } from "../constants/httpStatusCodes.js";
import { DbContext, EBankaSqlRepository } from "../models/ebankaSql.repository.js";
import { EBankaVeriSqlRepository, VomsisBanka, VomsisHareket, VomsisHesap } from "../models/ebankaVeriSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { EBankaAktarimService } from "./ebankaAktarim.service.js";
import { VomsisClient } from "./vomsis/vomsis.client.js";

// F- e-Banka Faz 1 — elle eşitleme (docs/EBANKA_VOMSIS_YOL_HARITASI.md, E3/E4). Arka plan işi yoktur; kullanıcı "Güncelle"ye basar.

const BES_DAKIKA_SN = 5 * 60;
const EN_UZUN_ARALIK_GUN = 366;

export interface EsitlemeSonucu {
  mod: "sahte" | "canli";
  baslangic: string;
  bitis: string;
  bankaAdedi: number;
  hesapAdedi: number;
  yeniEslesenHesap: number;
  yeniHareket: number;
  guncellenenHareket: number;
  /** Otomatik aktarım çalışmadıysa (test modu / başlangıç tarihi yok / hata) null */
  aktarim: { aktarilan: number; aktarilmayacak: number; bekleyen: number; hatali: number } | null;
}

// Aynı firmada iki kişi aynı anda eşitleme başlatamaz
const calisanlar = new Set<string>();
const firmaAnahtari = (c?: DbContext) => `${(c?.dbServer || "").toLowerCase()}|${(c?.dbName || "").toLowerCase()}`;

const gunMu = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** "YYYY-AA-GG" → Vomsis'in beklediği "GG-AA-YYYY SS:DD:ss" */
const vomsisTarihi = (gun: string, saat: string) => `${gun.slice(8, 10)}-${gun.slice(5, 7)}-${gun.slice(0, 4)} ${saat}`;

const dizi = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export class EBankaEsitlemeService {
  public static async esitle(girdi: { baslangic?: string; bitis?: string }, kullaniciId?: number, dbContext?: DbContext): Promise<EsitlemeSonucu> {
    const { baslangic, bitis } = girdi;
    if (!gunMu(baslangic) || !gunMu(bitis)) throw ApiError.badRequest("Başlangıç ve bitiş tarihi zorunludur.");
    if (baslangic > bitis) throw ApiError.badRequest("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    if ((Date.parse(bitis) - Date.parse(baslangic)) / 86_400_000 > EN_UZUN_ARALIK_GUN) {
      throw ApiError.badRequest("Tek seferde en fazla bir yıllık aralık eşitlenebilir.");
    }

    const ayar = await EBankaSqlRepository.ayarGetir(dbContext);
    const mod = ayar?.mod ?? "sahte";

    // Vomsis servisleri 5 dakikada bir çağrılabilir; sahte modda sınır yoktur
    if (mod === "canli") {
      const gecen = await EBankaVeriSqlRepository.sonEsitlemedenBeriSaniye(dbContext);
      if (gecen !== null && gecen >= 0 && gecen < BES_DAKIKA_SN) {
        throw new ApiError(HttpStatus.TOO_MANY_REQUESTS, `Banka servisi 5 dakikada bir sorgulanabilir. ${BES_DAKIKA_SN - gecen} saniye sonra yeniden deneyin.`);
      }
    }

    const anahtar = firmaAnahtari(dbContext);
    if (calisanlar.has(anahtar)) throw ApiError.conflict("Şu anda başka bir eşitleme sürüyor. Bitmesini bekleyin.");
    calisanlar.add(anahtar);

    try {
      const bankalar = dizi<VomsisBanka>((await VomsisClient.istek("banka", "/banks", {}, dbContext))?.banks);
      const hesaplar = dizi<VomsisHesap>((await VomsisClient.istek("banka", "/accounts", {}, dbContext))?.accounts);
      const tipler = dizi<{ type_no: string; type_name: string }>((await VomsisClient.istek("banka", "/transaction_types", {}, dbContext))?.transaction_types);
      const yanit = await VomsisClient.istek(
        "banka",
        "/transactions",
        { sorgu: { beginDate: vomsisTarihi(baslangic, "00:00:00"), endDate: vomsisTarihi(bitis, "23:59:59") } },
        dbContext
      );
      if (yanit?.status && yanit.status !== "success") throw new ApiError(HttpStatus.BAD_GATEWAY, `Banka servisi hareketleri vermedi: ${yanit.message || yanit.status}`);
      const hareketler = dizi<VomsisHareket>(yanit?.transactions);

      await EBankaVeriSqlRepository.bankalariYaz(bankalar, dbContext);
      await EBankaVeriSqlRepository.hesaplariYaz(hesaplar, dbContext);
      const yeniEslesenHesap = await EBankaVeriSqlRepository.ibanIleEsle(dbContext);
      await EBankaVeriSqlRepository.hareketTipleriniYaz(tipler, dbContext);
      const { yeni, guncellenen } = await EBankaVeriSqlRepository.hareketleriYaz(hareketler, dbContext);
      await EBankaVeriSqlRepository.sonEsitlemeyiYaz(dbContext);

      // E5: eşitleme biter bitmez otomatik aktarım. Test modunda ya da başlangıç tarihi yokken çalışmaz; hatası eşitlemeyi başarısız saymaz.
      let aktarim: EsitlemeSonucu["aktarim"] = null;
      if (mod === "canli" && ayar?.aktarimBaslangic) {
        aktarim = await EBankaAktarimService.calistir(kullaniciId, dbContext).catch(() => null);
      }

      const sonuc: EsitlemeSonucu = {
        mod,
        baslangic,
        bitis,
        bankaAdedi: bankalar.length,
        hesapAdedi: hesaplar.length,
        yeniEslesenHesap,
        yeniHareket: yeni,
        guncellenenHareket: guncellenen,
        aktarim,
      };
      await EBankaSqlRepository.logYaz(
        {
          islem: "esitleme",
          mod,
          basarili: true,
          adet: yeni,
          mesaj: `${baslangic} – ${bitis}: ${hesaplar.length} hesap, ${yeni} yeni / ${guncellenen} güncellenen hareket`,
          kullaniciId,
        },
        dbContext
      );
      return sonuc;
    } catch (err: any) {
      await EBankaSqlRepository.logYaz({ islem: "esitleme", mod, basarili: false, mesaj: `${baslangic} – ${bitis}: ${err?.message}`, kullaniciId }, dbContext);
      throw err;
    } finally {
      calisanlar.delete(anahtar);
    }
  }
}

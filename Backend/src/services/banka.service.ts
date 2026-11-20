import type { KendiKayit } from "../utils/kendiKayit.js";
import {
  BankaSqlRepository,
  BankaHesapModel,
  SaveBankaHesapDto,
  BankaHareketModel,
  SaveBankaHareketDto,
} from "../models/bankaSql.repository.js";
import { ApiError } from "../utils/ApiError.js";
import { FisDurbunFiltre, bellekteSuz, durbunFiltresiVar } from "../utils/fisDurbunFiltre.js";

export class BankaService {
  // ─── Banka Hesap Kartları ──────────────────────────────────────────────────
  public static async listBankalar(
    filter?: { search?: string; aktif?: boolean },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHesapModel[]> {
    return BankaSqlRepository.listBankalar(filter, dbContext);
  }

  public static async getBankaById(
    bankaId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHesapModel> {
    const item = await BankaSqlRepository.getBankaById(bankaId, dbContext);
    if (!item) throw ApiError.notFound("Banka hesabı bulunamadı.");
    return item;
  }

  public static async getNextHesapNo(
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<string> {
    return BankaSqlRepository.getNextHesapNo(dbContext);
  }

  public static async saveBanka(
    dto: SaveBankaHesapDto,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHesapModel> {
    if (!dto.hesapNo || !dto.hesapNo.trim()) {
      throw ApiError.badRequest("Hesap numarası zorunludur.");
    }
    if (!dto.hesapAdi || !dto.hesapAdi.trim()) {
      throw ApiError.badRequest("Hesap adı zorunludur.");
    }
    return BankaSqlRepository.saveBanka(dto, kullaniciId, dbContext);
  }

  public static async deleteBanka(
    bankaId: number,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    return BankaSqlRepository.deleteBanka(bankaId, kullaniciId, dbContext);
  }

  // ─── Banka Hesap Hareketleri ───────────────────────────────────────────────
  public static async listHareketler(
    filter?: {
      bankaId?: number;
      cariKartId?: number;
      vezneId?: number;
      islemTipi?: number;
      baslangicTarihi?: string;
      bitisTarihi?: string;
      search?: string;
      limit?: number;
      /** Fişlerin Hesap (banka) satırları da gelsin (salt okunur; docs/EBANKA_MUHASEBELESTIRME_YOL_HARITASI.md M17) */
      fisSatirlari?: boolean;
      /** Dürbün gelişmiş filtresi (docs/FIS_TARIH_VE_DURBUN_YOL_HARITASI.md D1–D4, §5) */
      durbun?: FisDurbunFiltre;
      /** Kendi kayıtları yetkisi (ortak alan denetimi 19.11.2026) */
      kendi?: KendiKayit | null;
    },
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHareketModel[]> {
    if (filter?.durbun && durbunFiltresiVar(filter.durbun)) return BankaService.durbunListesi(filter, filter.durbun, dbContext);
    const hareketler = await BankaSqlRepository.listHareketler(filter, dbContext);
    // Cari / vezne / işlem tipi / arama süzgeci olan çağrılar banka fişine özgü; fiş satırları yalnız istenince ve bu süzgeçler yokken eklenir
    // Kendi kayıtları yetkisinde fişlerin banka satırları eklenmez (ekleyenleri fiş tablolarında; liste yalnız kendi banka fişleri) (ortak alan denetimi 19.11.2026)
    if (!filter?.fisSatirlari || filter.kendi || filter.cariKartId || filter.vezneId || filter.islemTipi !== undefined || filter.search) return hareketler;
    const fisSatirlari = await BankaSqlRepository.listFisBankaSatirlari(
      { bankaId: filter.bankaId, baslangicTarihi: filter.baslangicTarihi, bitisTarihi: filter.bitisTarihi, limit: filter.limit },
      dbContext
    );
    return [...hareketler, ...fisSatirlari].sort((a, b) => a.tarih.localeCompare(b.tarih) || a.bankaHareketId - b.bankaHareketId);
  }

  /**
   * Dürbün: banka hareketleri SQL'de filtrelenir (en yeni N); fiş satırları (sarraf / perakende / ticari Hesap satırı) aynı tarih ve
   * banka hesabıyla çekilip bellekte aynı filtreden geçer. Vezne filtresi bu ekranda banka hesabıdır.
   */
  private static async durbunListesi(
    filter: { bankaId?: number; baslangicTarihi?: string; limit?: number; fisSatirlari?: boolean; kendi?: KendiKayit | null },
    durbun: FisDurbunFiltre,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHareketModel[]> {
    const hareketler = await BankaSqlRepository.listHareketler({ bankaId: filter.bankaId, baslangicTarihi: filter.baslangicTarihi, limit: filter.limit, durbun, kendi: filter.kendi }, dbContext);
    let fisSatirlari: BankaHareketModel[] = [];
    if (filter.fisSatirlari && !filter.kendi) {
      // Gün sınırı (baslangicTarihi) ile dürbün başlangıcından sonraki geçerli; tarihler duvar saati, sürücü UTC gönderir
      const bas = [filter.baslangicTarihi?.slice(0, 10), durbun.tarihBas].filter(Boolean).sort().pop();
      const ham = await BankaSqlRepository.listFisBankaSatirlari(
        {
          bankaId: durbun.vezneId || filter.bankaId,
          baslangicTarihi: bas ? `${bas}T00:00:00.000Z` : undefined,
          bitisTarihi: durbun.tarihBit ? `${durbun.tarihBit}T23:59:59.000Z` : undefined,
          limit: filter.limit,
        },
        dbContext
      );
      fisSatirlari = bellekteSuz(ham, durbun, {
        tarih: (x) => x.tarih,
        vezne: (x) => [x.bankaId],
        urunler: (x) => x.satirlar.map((s) => s.paraId),
        tip: (x) => x.islemTipi,
        cari: (x) => [x.cariUnvan, x.cariKod],
        tutarlar: (x) => [Number(x.toplamTutarTl) || 0],
        belgeNo: (x) => [x.belgeNo],
      });
    }
    return [...hareketler, ...fisSatirlari].sort((a, b) => a.tarih.localeCompare(b.tarih) || a.bankaHareketId - b.bankaHareketId);
  }

  public static async getHareketById(
    bankaHareketId: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHareketModel> {
    const item = await BankaSqlRepository.getHareketById(bankaHareketId, dbContext);
    if (!item) throw ApiError.notFound("Banka hareketi bulunamadı.");
    return item;
  }

  public static async saveHareket(
    dto: SaveBankaHareketDto,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<BankaHareketModel> {
    if (!dto.bankaId || Number(dto.bankaId) <= 0) {
      throw ApiError.badRequest("Banka hesabı seçilmelidir.");
    }
    if (!dto.satirlar || dto.satirlar.length === 0) {
      throw ApiError.badRequest("En az bir hareket satırı (meblağ / para birimi) girilmelidir.");
    }
    return BankaSqlRepository.saveHareket(dto, kullaniciId, dbContext);
  }

  public static async deleteHareket(
    bankaHareketId: number,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    return BankaSqlRepository.deleteHareket(bankaHareketId, kullaniciId, dbContext);
  }

  public static async toggleIptalHareket(
    bankaHareketId: number,
    iptal: boolean,
    kullaniciId?: number,
    dbContext?: { dbServer?: string; dbName?: string }
  ): Promise<boolean> {
    return BankaSqlRepository.toggleIptalHareket(bankaHareketId, iptal, kullaniciId, dbContext);
  }

  // ─── Lookups ───────────────────────────────────────────────────────────────
  public static async getLookups(dbContext?: { dbServer?: string; dbName?: string }) {
    return BankaSqlRepository.getLookups(dbContext);
  }
}

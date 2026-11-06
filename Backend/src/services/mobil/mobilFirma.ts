import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { MobilSqlRepository } from "../../models/admin/mobilSql.repository.js";
import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { FirmaDto } from "../../types/admin.types.js";
import { SureliOnbellek } from "../../utils/sureliOnbellek.js";
import { firmaDbContextHazirla } from "../admin/firmaBaglanti.service.js";
import { acikcaAcikMi } from "../admin/modulAgaci.js";
import { firmaEngeli } from "../merkezGiris.service.js";
import { MOBIL_MODUL, kisaAdUret } from "./mobilKural.js";

/**
 * Mobil oturumunun firması (veritabanı): kullanılabilir mi (çalışır durumda, bulut, Mobil modülü açık) ve bağlantı
 * bağlamı. Her istekte sorulduğu için kısa süreli önbellekte tutulur (durum 30 sn, bağlantı 60 sn).
 */

export interface MobilFirmaDurumu {
  firma: FirmaDto;
  kullanilabilir: boolean;
  neden: string | null;
  kisaAd: string;
  /** Kısa ad panelde elle verilmiş mi (giriş ekranı markası için öncelik) */
  elleKisaAd: boolean;
}

const durumOnbellegi = new SureliOnbellek<MobilFirmaDurumu | null>(30_000, 500);
const baglamOnbellegi = new SureliOnbellek<{ dbServer: string; dbName: string }>(60_000, 500);

export const mobilFirmaDurumu = (firmaId: number): Promise<MobilFirmaDurumu | null> =>
  durumOnbellegi.al(
    String(firmaId),
    async () => {
      const firma = await FirmaSqlRepository.idIleBul(firmaId);
      if (!firma) return null;
      const ayar = await MobilSqlRepository.firmaAyari(firmaId);
      const kisaAd = kisaAdUret(firma.unvan, ayar.kisaAd);
      let neden: string | null = null;
      if (firmaEngeli(firma)) neden = "Firma hesabı şu an kullanımda değil.";
      else if (firma.baglantiModu === "setup") neden = "Bu firma mobil erişime açık değil.";
      else if (!acikcaAcikMi(await ModulSqlRepository.firmaAcikModulleri(firmaId), MOBIL_MODUL)) neden = "Firmanın mobil erişimi kapalı.";
      return { firma, kullanilabilir: !neden, neden, kisaAd, elleKisaAd: !!ayar.kisaAd };
    },
    () => true
  );

export const mobilFirmaBaglami = (firmaId: number): Promise<{ dbServer: string; dbName: string }> =>
  baglamOnbellegi.al(String(firmaId), () => firmaDbContextHazirla(firmaId), () => true);

/** Testler ve panel değişiklikleri için */
export const mobilFirmaOnbelleginiTemizle = (): void => {
  durumOnbellegi.temizle();
  baglamOnbellegi.temizle();
};

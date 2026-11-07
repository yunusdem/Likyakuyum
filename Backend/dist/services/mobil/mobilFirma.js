import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { MobilSqlRepository } from "../../models/admin/mobilSql.repository.js";
import { ModulSqlRepository } from "../../models/admin/modulSql.repository.js";
import { SureliOnbellek } from "../../utils/sureliOnbellek.js";
import { firmaDbContextHazirla } from "../admin/firmaBaglanti.service.js";
import { acikcaAcikMi } from "../admin/modulAgaci.js";
import { firmaEngeli } from "../merkezGiris.service.js";
import { MOBIL_MODUL, kisaAdUret } from "./mobilKural.js";
const durumOnbellegi = new SureliOnbellek(30_000, 500);
const baglamOnbellegi = new SureliOnbellek(60_000, 500);
export const mobilFirmaDurumu = (firmaId) => durumOnbellegi.al(String(firmaId), async () => {
    const firma = await FirmaSqlRepository.idIleBul(firmaId);
    if (!firma)
        return null;
    const ayar = await MobilSqlRepository.firmaAyari(firmaId);
    const kisaAd = kisaAdUret(firma.unvan, ayar.kisaAd);
    let neden = null;
    if (firmaEngeli(firma))
        neden = "Firma hesabı şu an kullanımda değil.";
    else if (firma.baglantiModu === "setup")
        neden = "Bu firma mobil erişime açık değil.";
    else if (!acikcaAcikMi(await ModulSqlRepository.firmaAcikModulleri(firmaId), MOBIL_MODUL))
        neden = "Firmanın mobil erişimi kapalı.";
    return { firma, kullanilabilir: !neden, neden, kisaAd, elleKisaAd: !!ayar.kisaAd };
}, () => true);
export const mobilFirmaBaglami = (firmaId) => baglamOnbellegi.al(String(firmaId), () => firmaDbContextHazirla(firmaId), () => true);
/** Testler ve panel değişiklikleri için */
export const mobilFirmaOnbelleginiTemizle = () => {
    durumOnbellegi.temizle();
    baglamOnbellegi.temizle();
};

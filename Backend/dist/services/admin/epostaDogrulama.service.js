import crypto from "crypto";
import { env } from "../../config/env.config.js";
import { FirmaSqlRepository } from "../../models/admin/firmaSql.repository.js";
import { AdminLogSqlRepository } from "../../models/admin/adminLogSql.repository.js";
import { ApiError } from "../../utils/ApiError.js";
import { mailGonder, mailGonderenAdresi, mailYapilandirildiMi } from "../mail.service.js";
/**
 * Firma e-posta adresinin doğrulanması: admin panelden doğrulama maili gönderir, firma maildeki tek kullanımlık
 * bağlantıyı açıp düğmeye basınca adres "doğrulandı" olur. Firma kimlik onayından (VKN / unvan, elle) AYRIDIR;
 * admin e-posta doğrulamasına da elle müdahale edebilir.
 *
 * Bağlantıdaki anahtar veritabanında yalnızca SHA-256 özeti olarak durur: veritabanını okuyan biri geçerli bağlantı üretemez.
 */
export const BAGLANTI_GECERLILIK_SAAT = 48;
const YENIDEN_GONDERME_BEKLEME_SN = 60;
const ozet = (anahtar) => crypto.createHash("sha256").update(anahtar, "utf8").digest("hex");
const htmlKacis = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const mailIcerigi = (firma, baglanti) => {
    const unvan = htmlKacis(firma.unvan);
    return {
        konu: "Likya Kuyum — e-posta adresinizi doğrulayın",
        metin: `Merhaba,\n\n${firma.unvan} firması için bu e-posta adresi Likya Kuyum sistemine kaydedildi.\n` +
            `Adresin size ait olduğunu doğrulamak için aşağıdaki bağlantıyı açın ve "E-posta adresimi doğrula" düğmesine basın:\n\n` +
            `${baglanti}\n\nBağlantı ${BAGLANTI_GECERLILIK_SAAT} saat geçerlidir ve yalnızca bir kez kullanılabilir.\n` +
            `Bu işlemi siz başlatmadıysanız bu maili dikkate almayın.\n\nLikya Kuyum`,
        html: `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#1f2937;max-width:520px">` +
            `<p>Merhaba,</p>` +
            `<p><strong>${unvan}</strong> firması için bu e-posta adresi Likya Kuyum sistemine kaydedildi. ` +
            `Adresin size ait olduğunu doğrulamak için aşağıdaki düğmeye basın.</p>` +
            `<p style="margin:24px 0"><a href="${htmlKacis(baglanti)}" ` +
            `style="background:#8a1538;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block">` +
            `E-posta adresimi doğrula</a></p>` +
            `<p style="font-size:13px;color:#6b7280">Düğme çalışmazsa bu bağlantıyı tarayıcınıza yapıştırın:<br>${htmlKacis(baglanti)}</p>` +
            `<p style="font-size:13px;color:#6b7280">Bağlantı ${BAGLANTI_GECERLILIK_SAAT} saat geçerlidir ve yalnızca bir kez kullanılabilir. ` +
            `Bu işlemi siz başlatmadıysanız bu maili dikkate almayın.</p>` +
            `<p>Likya Kuyum</p></div>`,
    };
};
export class EpostaDogrulamaService {
    /** Panel: mail özelliği kullanılabilir mi, hangi adresten gidecek. */
    static mailDurumu() {
        return { yapilandirildi: mailYapilandirildiMi(), gonderen: mailGonderenAdresi(), gecerlilikSaat: BAGLANTI_GECERLILIK_SAAT };
    }
    /** Firmanın kayıtlı e-postasına doğrulama bağlantısı gönderir. Önceki bağlantı geçersiz olur. */
    static async gonder(yapan, firmaId) {
        const firma = await FirmaSqlRepository.idIleBul(firmaId);
        if (!firma)
            throw ApiError.notFound("Firma bulunamadı.");
        if (!firma.eposta)
            throw ApiError.badRequest("Firmanın e-posta adresi tanımlı değil. Önce Bilgi & Bağlantı sekmesinden girin.");
        if (firma.epostaDogrulandi)
            throw ApiError.badRequest("Bu e-posta adresi zaten doğrulanmış.");
        if (firma.epostaSonGonderim) {
            const gecenSn = await FirmaSqlRepository.epostaSonGonderimdenBeriSn(firmaId);
            if (gecenSn !== null && gecenSn < YENIDEN_GONDERME_BEKLEME_SN) {
                throw ApiError.badRequest(`Az önce gönderildi. ${YENIDEN_GONDERME_BEKLEME_SN - gecenSn} saniye sonra tekrar deneyin.`);
            }
        }
        const anahtar = crypto.randomBytes(32).toString("base64url");
        const baglanti = `${env.ADMIN_PANEL_URL.replace(/\/+$/, "")}/eposta-dogrula?t=${anahtar}`;
        // Önce mail: gönderilemezse veritabanına bağlantı yazılmaz, eski bağlantı (varsa) geçerli kalır
        await mailGonder({ kime: firma.eposta, ...mailIcerigi(firma, baglanti) });
        await FirmaSqlRepository.epostaAnahtariYaz(firmaId, ozet(anahtar), BAGLANTI_GECERLILIK_SAAT);
        await AdminLogSqlRepository.islemLogu({
            adminId: yapan.adminId,
            islem: "EPOSTA_DOGRULAMA_GONDERILDI",
            hedefTur: "FIRMA",
            hedefId: firmaId,
            yeni: { eposta: firma.eposta },
        });
        return (await FirmaSqlRepository.idIleBul(firmaId));
    }
    /**
     * Herkese açık uç: maildeki bağlantıyı açan kişi düğmeye basınca çağrılır. Anahtar geçerliyse (süresi dolmamış,
     * kullanılmamış ve firma e-postası değişmemiş) adres doğrulanır. Başarısızlıkta neden söylenmez.
     */
    static async onayla(anahtar) {
        const sonuc = await FirmaSqlRepository.epostaAnahtariylaDogrula(ozet(anahtar));
        if (!sonuc)
            throw ApiError.badRequest("Bağlantı geçersiz ya da süresi dolmuş. Hizmet sağlayıcınızdan yeni bir doğrulama maili isteyin.");
        await AdminLogSqlRepository.islemLogu({
            adminId: null,
            islem: "EPOSTA_DOGRULANDI",
            hedefTur: "FIRMA",
            hedefId: sonuc.firmaId,
            yeni: { eposta: sonuc.eposta, kaynak: "MAIL" },
        });
        return { unvan: sonuc.unvan, eposta: sonuc.eposta };
    }
    /** Admin müdahalesi: e-postayı elle doğrulanmış işaretle ya da doğrulamayı kaldır. Bekleyen bağlantı iptal olur. */
    static async elleAyarla(yapan, firmaId, dogrulandi) {
        const firma = await FirmaSqlRepository.idIleBul(firmaId);
        if (!firma)
            throw ApiError.notFound("Firma bulunamadı.");
        if (dogrulandi && !firma.eposta)
            throw ApiError.badRequest("Firmanın e-posta adresi tanımlı değil.");
        await FirmaSqlRepository.epostaDogrulamaElleYaz(firmaId, dogrulandi);
        await AdminLogSqlRepository.islemLogu({
            adminId: yapan.adminId,
            islem: dogrulandi ? "EPOSTA_DOGRULANDI" : "EPOSTA_DOGRULAMA_KALDIRILDI",
            hedefTur: "FIRMA",
            hedefId: firmaId,
            eski: { epostaDogrulandi: firma.epostaDogrulandi },
            yeni: { eposta: firma.eposta, kaynak: "ADMIN" },
        });
        return (await FirmaSqlRepository.idIleBul(firmaId));
    }
}

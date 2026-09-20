import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env.config.js";
import { logger } from "../utils/logger.js";
import { ApiError } from "../utils/ApiError.js";
import { HttpStatus } from "../constants/httpStatusCodes.js";

/**
 * E-posta gönderimi (SMTP). Ayarlar sunucudaki Backend/.env.local dosyasından gelir:
 * SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM.
 * SMTP_HOST ya da SMTP_FROM boşsa mail özelliği kapalıdır; panel bunu "mail ayarı yapılmamış" olarak gösterir.
 */

let tasiyici: Transporter | null = null;

export const mailYapilandirildiMi = (): boolean => !!env.SMTP_HOST && !!env.SMTP_FROM;

/** Panelde gösterilen gönderen adresi (şifre vb. asla dönmez). */
export const mailGonderenAdresi = (): string | null => (mailYapilandirildiMi() ? env.SMTP_FROM : null);

const tasiyiciAl = (): Transporter => {
  if (!mailYapilandirildiMi()) {
    throw new ApiError(
      HttpStatus.SERVICE_UNAVAILABLE,
      "Mail ayarı yapılmamış. Sunucudaki Backend/.env.local dosyasına SMTP bilgilerini girin."
    );
  }
  if (!tasiyici) {
    tasiyici = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // 465 = doğrudan TLS; 587/25 = STARTTLS
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER && { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }),
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return tasiyici;
};

export const mailGonder = async (mail: { kime: string; konu: string; html: string; metin: string }): Promise<void> => {
  const t = tasiyiciAl();
  try {
    await t.sendMail({ from: env.SMTP_FROM, to: mail.kime, subject: mail.konu, html: mail.html, text: mail.metin });
  } catch (err: any) {
    // Sunucunun ham yanıtı (kullanıcı adı, sunucu adı içerebilir) istemciye gitmez; log'a yazılır
    logger.error(`[MAIL] Gönderilemedi (${mail.kime}): ${err?.message}`);
    const kod = String(err?.code || "");
    const neden =
      kod === "EAUTH"
        ? "SMTP kullanıcı adı veya şifresi hatalı."
        : kod === "ECONNECTION" || kod === "ETIMEDOUT" || kod === "ESOCKET" || kod === "EDNS"
          ? "Mail sunucusuna ulaşılamadı (SMTP_HOST / SMTP_PORT / güvenlik duvarı)."
          : kod === "EENVELOPE"
            ? "Alıcı ya da gönderen adresi mail sunucusu tarafından reddedildi."
            : "Mail sunucusu gönderimi reddetti.";
    throw new ApiError(HttpStatus.BAD_GATEWAY, `Mail gönderilemedi: ${neden}`);
  }
};

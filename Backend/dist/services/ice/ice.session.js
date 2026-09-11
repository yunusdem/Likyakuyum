import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { buildLoginHeaderXml, callSoap, escapeXml, READ_TIMEOUT_MS, } from "./ice.client.js";
/** Oturumun bellekte tutulacağı azami süre; sonrasında yeniden giriş yapılır */
const SESSION_TTL_MS = 20 * 60 * 1000;
const sessions = new Map();
const inFlightLogins = new Map();
const blockedAccounts = new Map();
/** Çok kiracılı ayrım: aynı süreçte farklı firma / farklı ICE kullanıcısı olabilir */
export const buildSessionKey = (config) => `${config.dbServer || "-"}:${config.dbName || "-"}:${config.kullaniciAdi}`.toLowerCase();
/**
 * `Health` — parametresiz, oturum GEREKTİRMEZ.
 * Servis ayakta mı sorusunu, boşuna Login denemeden cevaplar.
 */
export const health = async (servisUrl) => {
    const { data } = await callSoap({
        url: servisUrl,
        method: "Health",
        innerXml: "",
        timeoutMs: 10_000,
    });
    return typeof data === "string" ? data : JSON.stringify(data ?? "");
};
const doLogin = async (config) => {
    const innerXml = `<_Login_Request>` +
        `<UserName>${escapeXml(config.kullaniciAdi)}</UserName>` +
        `<Password>${escapeXml(config.sifre)}</Password>` +
        `<Application_Name>${escapeXml(config.uygulamaAdi)}</Application_Name>` +
        `<Application_Version>${escapeXml(config.uygulamaSurum)}</Application_Version>` +
        `</_Login_Request>`;
    const { data } = await callSoap({
        url: config.servisUrl,
        method: "Login",
        innerXml,
        timeoutMs: READ_TIMEOUT_MS,
    });
    const basarili = String(data?.isSuccecss).toLowerCase() === "true";
    const hataliDeneme = Number(data?.Exception_Type?.Number_Of_Incorrect ?? 0);
    const key = buildSessionKey(config);
    if (!basarili || !data?.Login_Request_Header?.Session_ID) {
        const mesaj = data?.Exception_Type?.Message?.trim() || "Entegratör girişi başarısız.";
        // Hesabın kilitlenmemesi için otomatik denemeleri durdur
        if (hataliDeneme > 0) {
            blockedAccounts.set(key, `${mesaj} (hatalı deneme sayısı: ${hataliDeneme}). ` +
                `Hesabın kilitlenmemesi için otomatik denemeler durduruldu; ayarlardan şifreyi güncelleyin.`);
            logger.warn(`ICE Login: hatalı deneme ${hataliDeneme} — otomatik denemeler durduruldu (${key})`);
        }
        throw ApiError.unauthorized(hataliDeneme > 0 ? `${mesaj} (hatalı deneme sayısı: ${hataliDeneme})` : mesaj);
    }
    blockedAccounts.delete(key);
    const header = {
        Session_ID: String(data.Login_Request_Header.Session_ID),
        IP_Number: String(data.Login_Request_Header.IP_Number ?? ""),
        Security_Key: String(data.Login_Request_Header.Security_Key ?? ""),
    };
    logger.info(`ICE Login başarılı (${config.kullaniciAdi})`);
    return { header, servisUrl: config.servisUrl, olusturma: Date.now() };
};
/**
 * Geçerli oturumu döndürür; yoksa (veya süresi dolduysa) yeni oturum açar.
 * Eşzamanlı çağrılarda yalnızca tek Login yapılır.
 */
export const getSession = async (config, forceYeniden = false) => {
    const key = buildSessionKey(config);
    const blocked = blockedAccounts.get(key);
    if (blocked) {
        throw ApiError.unauthorized(blocked);
    }
    if (!forceYeniden) {
        const mevcut = sessions.get(key);
        if (mevcut &&
            mevcut.servisUrl === config.servisUrl &&
            Date.now() - mevcut.olusturma < SESSION_TTL_MS) {
            return mevcut.header;
        }
    }
    else {
        sessions.delete(key);
    }
    const beklenen = inFlightLogins.get(key);
    if (beklenen) {
        return (await beklenen).header;
    }
    const promise = doLogin(config)
        .then((session) => {
        sessions.set(key, session);
        return session;
    })
        .finally(() => {
        inFlightLogins.delete(key);
    });
    inFlightLogins.set(key, promise);
    return (await promise).header;
};
/**
 * Oturumu ICE tarafında kapatır ve önbellekten siler.
 */
export const logout = async (config) => {
    const key = buildSessionKey(config);
    const mevcut = sessions.get(key);
    sessions.delete(key);
    if (!mevcut)
        return;
    try {
        await callSoap({
            url: mevcut.servisUrl,
            method: "Logout",
            innerXml: buildLoginHeaderXml(mevcut.header),
            timeoutMs: 10_000,
        });
    }
    catch (err) {
        // Oturum kapatma hatası işlemi bozmaz; yalnızca kaydedilir
        logger.warn("ICE Logout sırasında hata (yok sayıldı):", err);
    }
};
/** Önbellekteki oturumu ICE'ye çıkmadan siler (ayar değişince kullanılır) */
export const clearSession = (config) => {
    const key = buildSessionKey(config);
    sessions.delete(key);
    blockedAccounts.delete(key);
};
/**
 * Oturumlu çağrı sarmalayıcısı.
 */
export const callWithSession = async (config, options) => {
    const { method, buildInnerXml, timeoutMs, authHatasindaTekrarla } = options;
    const header = await getSession(config);
    try {
        return await callSoap({
            url: config.servisUrl,
            method,
            innerXml: buildInnerXml(buildLoginHeaderXml(header)),
            timeoutMs,
        });
    }
    catch (err) {
        const yetkiHatasi = err instanceof ApiError && err.statusCode === 401;
        if (!yetkiHatasi || !authHatasindaTekrarla) {
            throw err;
        }
        logger.info(`ICE ${method}: oturum düşmüş, bir kez yeniden giriş yapılıyor.`);
        const yeniHeader = await getSession(config, true);
        return await callSoap({
            url: config.servisUrl,
            method,
            innerXml: buildInnerXml(buildLoginHeaderXml(yeniHeader)),
            timeoutMs,
        });
    }
};
/**
 * Süreç kapanırken açık oturumları kapatmayı dener.
 * server.ts'e dokunmamak için kendi dinleyicimizi kuruyoruz.
 */
let shutdownKurulu = false;
export const registerSessionShutdown = () => {
    if (shutdownKurulu)
        return;
    shutdownKurulu = true;
    const kapat = () => {
        for (const [key, session] of sessions.entries()) {
            sessions.delete(key);
            callSoap({
                url: session.servisUrl,
                method: "Logout",
                innerXml: buildLoginHeaderXml(session.header),
                timeoutMs: 3_000,
            }).catch(() => undefined);
        }
    };
    process.once("SIGTERM", kapat);
    process.once("SIGINT", kapat);
};

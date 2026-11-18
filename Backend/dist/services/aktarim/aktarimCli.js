import crypto from "crypto";
import fs from "fs";
import sql from "mssql";
import { aktar } from "./aktarimMotoru.js";
import { dogrula, veritabanlariniDogrula } from "./aktarimDogrulama.js";
import { geciciAc, geciciSil, incele, setSec, sunucuAnaSurumu, yedekBasligi, yedekEngelleri } from "./aktarimInceleme.js";
import { ciftAdimlari, ciftKontrolleri, digerVeritabaniKurali, eDovizIsaretle } from "./aktarimCift.js";
/** Tek bağlantılı, zaman aşımsız havuz (aktarım tek işlemde ve uzun sürebilir). */
export const cliHavuzu = async (b) => new sql.ConnectionPool({
    server: b.server,
    port: b.port || 1433,
    database: "master",
    user: b.user,
    password: b.password,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true },
    pool: { max: 1, min: 0, idleTimeoutMillis: 5000 },
    connectionTimeout: 15000,
    requestTimeout: 0,
}).connect();
export class IncelemeEngeli extends Error {
    engeller;
    constructor(engeller) {
        super(`Yedek aktarılamaz: ${engeller.filter((e) => e.seviye === "ENGEL").map((e) => e.mesaj).join(" | ")}`);
        this.engeller = engeller;
    }
}
/** Yedeği geçici adla açar, inceler; iş bitince (hata olsa da) geçici veritabanını siler. */
export const yedekleCalis = async (pool, yedekYolu, is, geciciAd = `LKY_AKTARIM_CLI_${crypto.randomBytes(6).toString("hex")}`) => {
    const setler = await yedekBasligi(pool, yedekYolu);
    const engeller = yedekEngelleri(setler, await sunucuAnaSurumu(pool));
    if (engeller.some((e) => e.seviye === "ENGEL"))
        throw new IncelemeEngeli(engeller);
    const set = setSec(setler);
    await geciciAc(pool, yedekYolu, geciciAd, set.position);
    try {
        const ozet = await incele(pool, geciciAd, set);
        ozet.engeller.unshift(...engeller);
        if (ozet.engeller.some((e) => e.seviye === "ENGEL"))
            throw new IncelemeEngeli(ozet.engeller);
        return await is(geciciAd, ozet);
    }
    finally {
        await geciciSil(pool, geciciAd).catch(() => undefined);
    }
};
/** Çift seçeneklerini incelemeden tamamlar (eşin eski adı, rol). */
export const ciftSecenekleri = (ozet, kaynakDb, hedefDb, c) => {
    const esEskiAdi = c.esEskiAdi || (ozet.bagliVeritabanlari.length === 1 ? ozet.bagliVeritabanlari[0].db : null);
    if (!esEskiAdi) {
        throw new Error(ozet.bagliVeritabanlari.length
            ? `Yedek birden çok veritabanına bağlı (${ozet.bagliVeritabanlari.map((b) => b.db).join(", ")}); eşin eski adı seçilmeli.`
            : "Yedek başka bir veritabanına bağlı değil; çift olarak aktarılamaz.");
    }
    // Rol: eski programın "fişleri aktarılacak alan" işareti (1 = çalışma), yoksa e-Döviz günlüğü dolu taraf resmî
    const rol = c.rol || (ozet.alan.fisleriAktarilacak === true ? "CALISMA" : ozet.alan.fisleriAktarilacak === false ? "RESMI" : ozet.eDoviz.logVar ? "RESMI" : "CALISMA");
    return { kaynakDb, hedefDb, esHedefDb: c.esHedefDb, esEskiAdi, rol, hedefGirisi: c.hedefGirisi ?? null, esGirisi: c.esGirisi ?? null };
};
/** Aktarımın ek adımları: e-Döviz işaretleme (her zaman) + çift (verildiyse). Aynı işlemde, kopyadan sonra. */
export const standartEkAdimlar = async (tx, kaynakDb, hedefDb, cift) => {
    const notlar = [];
    const e = await eDovizIsaretle(tx, kaynakDb, hedefDb);
    if (e.beklenen > 0) {
        if (e.isaretlenen !== e.beklenen)
            throw new Error(`e-Döviz işaretleme eksik: ${e.beklenen} belgeden ${e.isaretlenen} işaretlendi.`);
        notlar.push(`Eski programla gönderilmiş ${e.isaretlenen} e-Döviz belgesi "Gönderildi" işaretlendi (yeniden gönderilmez).`);
    }
    if (cift)
        notlar.push(...(await ciftAdimlari(tx, cift)));
    return notlar;
};
export const veriAktarKomutu = async (pool, g) => {
    if (!fs.existsSync(g.yedek))
        throw new Error(`Yedek dosyası yok: ${g.yedek}`);
    const sonuc = await yedekleCalis(pool, g.yedek, async (geciciDb, ozet) => {
        let rapor = null;
        const cift = g.cift ? ciftSecenekleri(ozet, geciciDb, g.hedefDb, g.cift) : null;
        const aktarim = await aktar({
            pool,
            kaynakDb: geciciDb,
            hedefDb: g.hedefDb,
            onYedekYolu: g.onYedek ?? null,
            ilerleme: g.ilerleme,
            planSecenekleri: { degerKurallari: [digerVeritabaniKurali(cift)], taslakOnay: !!g.taslakOnay },
            ekAdimlar: async (tx, plan) => [
                ...(await standartEkAdimlar(tx, geciciDb, g.hedefDb, cift)),
                ...(g.ekAdimlar ? await g.ekAdimlar(tx, plan, ozet) : []),
            ],
            dogrula: async (tx, plan) => {
                rapor = await dogrula(tx, plan, { ekKontroller: (b) => ciftKontrolleri(b, { kaynakDb: geciciDb, hedefDb: g.hedefDb, cift }) });
                return rapor;
            },
        });
        return { inceleme: ozet, aktarim, dogrulama: rapor, cift };
    });
    if (g.rapor)
        fs.writeFileSync(g.rapor, JSON.stringify(sonuc, null, 2), "utf8");
    return sonuc;
};
export const dogrulaKomutu = async (pool, g) => {
    if (!g.kaynakYedek && !g.kaynakDb)
        throw new Error("Kaynak gerekli: --kaynak-yedek <dosya.bak> ya da --kaynak-db <ad>.");
    const calis = (kaynakDb) => veritabanlariniDogrula(pool, kaynakDb, g.hedefDb, { ekKontroller: (b) => ciftKontrolleri(b, { kaynakDb, hedefDb: g.hedefDb, cift: null }) });
    const rapor = g.kaynakYedek ? await yedekleCalis(pool, g.kaynakYedek, (geciciDb) => calis(geciciDb)) : await calis(g.kaynakDb);
    if (g.rapor)
        fs.writeFileSync(g.rapor, JSON.stringify(rapor, null, 2), "utf8");
    return rapor;
};
/** --ad deger biçimindeki argümanlar */
export const argumanlar = (argv) => {
    const a = {};
    for (let i = 0; i < argv.length; i++) {
        if (!argv[i].startsWith("--"))
            continue;
        const ad = argv[i].slice(2);
        const sonraki = argv[i + 1];
        if (sonraki === undefined || sonraki.startsWith("--"))
            a[ad] = "1";
        else {
            a[ad] = sonraki;
            i++;
        }
    }
    return a;
};

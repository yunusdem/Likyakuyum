import sql from "mssql";
import { env } from "../../config/env.config.js";
import { logger } from "../../utils/logger.js";
import { mailGonder, mailYapilandirildiMi } from "../mail.service.js";
import { veritabanlariniDogrula } from "./aktarimDogrulama.js";
import { ciftKontrolleri } from "./aktarimCift.js";
import { n, q, tamAd } from "./aktarimSema.js";
const rakam = (v) => String(v ?? "").replace(/\D/g, "");
const duz = (v) => String(v ?? "").trim();
const coklu = async (b, sorgu) => (await new sql.Request(b).query(sorgu)).recordset;
/** "Doğru yere gitti mi" kontrolleri (grup YER). */
export const yerKontrolleri = async (pool, g) => {
    const k = [];
    // 1) Hedef veritabanının durumu
    const [db] = await coklu(pool, `SELECT state_desc AS D, CAST(is_read_only AS int) AS RO, user_access_desc AS U FROM sys.databases WHERE name = ${n(g.hedefDb)}`);
    const dbTamam = !!db && String(db.D) === "ONLINE" && Number(db.RO) === 0 && String(db.U) === "MULTI_USER";
    k.push({
        grup: "YER",
        tablo: null,
        ad: `Hedef veritabanı (${g.hedefDb}) çevrimiçi ve kullanılabilir`,
        durum: dbTamam ? "TAMAM" : "FARK",
        hedef: db ? `${db.D}${Number(db.RO) ? ", salt okunur" : ""}, ${db.U}` : "yok",
    });
    // 2) Firma kimliği: yedekteki = firma veritabanındaki (= merkezdeki)
    const kimlik = async (dbAd) => {
        const kolon = async (ad) => ((await coklu(pool, `SELECT COL_LENGTH(${n(`${dbAd}.dbo.TODVZ_TANIM`)}, ${n(ad)}) AS L`))[0].L !== null ? `RTRIM(CAST(${q(ad)} AS nvarchar(300)))` : "CAST(NULL AS nvarchar(300))");
        const [r] = await coklu(pool, `SELECT TOP 1 ${await kolon("FIRMA_ADI")} AS AD, ${await kolon("VERGI_KIMLIK_NO")} AS VKN FROM ${tamAd(dbAd, "TODVZ_TANIM")}`);
        return { ad: duz(r?.AD), vkn: rakam(r?.VKN) };
    };
    const kk = await kimlik(g.kaynakDb), hk = await kimlik(g.hedefDb);
    k.push({
        grup: "YER",
        tablo: "TODVZ_TANIM",
        ad: "Firma veritabanındaki firma kimliği yedektekiyle aynı (ad + VKN)",
        durum: kk.ad === hk.ad && kk.vkn === hk.vkn ? "TAMAM" : "FARK",
        kaynak: `${kk.ad || "-"} · ${kk.vkn || "VKN yok"}`,
        hedef: `${hk.ad || "-"} · ${hk.vkn || "VKN yok"}`,
    });
    if (g.firma) {
        const merkez = rakam(g.firma.vknTckn);
        k.push({
            grup: "YER",
            tablo: null,
            ad: `Paneldeki firma kaydı (${g.firma.firmaKodu}) ile yedeğin VKN'si`,
            // VKN'si boş yedek / firma kaydı karşılaştırılamaz: bilgi (yanlış firma koruması aktarımdan önce ayrıca onay ister)
            durum: !merkez || !kk.vkn ? "BILGI" : merkez === kk.vkn ? "TAMAM" : "FARK",
            kaynak: kk.vkn || "yedekte VKN yok",
            hedef: merkez || "firma kaydında VKN yok",
            ayrinti: merkez && kk.vkn && merkez !== kk.vkn ? "Yedek başka bir firmaya ait olabilir; aktarım öncesi onayla geçildi." : undefined,
        });
    }
    // 3) Firmanın kendi girişiyle: bağlanılan veritabanı ve her tablodaki satır sayısı
    if (g.firmaIleOku) {
        try {
            const tablolar = (await coklu(pool, `
        SELECT t.name AS T FROM ${q(g.kaynakDb)}.sys.tables t JOIN ${q(g.kaynakDb)}.sys.schemas s ON s.schema_id = t.schema_id
        WHERE s.name = 'dbo' AND t.is_ms_shipped = 0 AND OBJECT_ID(${n(g.hedefDb)} + N'.dbo.' + QUOTENAME(t.name), 'U') IS NOT NULL ORDER BY t.name`)).map((x) => String(x.T));
            const say = async (b, onEk) => {
                const m = new Map();
                for (let i = 0; i < tablolar.length; i += 40) {
                    const r = await coklu(b, tablolar.slice(i, i + 40).map((t) => `SELECT ${n(t)} AS T, COUNT_BIG(*) AS N FROM ${onEk}${q(t)}`).join(" UNION ALL "));
                    for (const x of r)
                        m.set(String(x.T), Number(x.N));
                }
                return m;
            };
            const kaynakSayi = await say(pool, `${q(g.kaynakDb)}.[dbo].`);
            const okunan = await g.firmaIleOku(async (fp) => ({
                db: String((await coklu(fp, `SELECT DB_NAME() AS D, SUSER_SNAME() AS G`))[0].D),
                giris: String((await coklu(fp, `SELECT SUSER_SNAME() AS G`))[0].G),
                sayi: await say(fp, "[dbo]."),
            }));
            // Firma açılışındaki kullanıcı(lar) korunur: kullanıcı tablosunda hedef, kaynaktan fazla olabilir
            const farkli = tablolar.filter((t) => (t.toUpperCase() === "TODVZ_KULLANICI" ? (okunan.sayi.get(t) ?? -1) < (kaynakSayi.get(t) ?? 0) : okunan.sayi.get(t) !== kaynakSayi.get(t)));
            const toplam = tablolar.reduce((x, t) => x + (kaynakSayi.get(t) || 0), 0);
            k.push({
                grup: "YER",
                tablo: null,
                ad: `Firmanın kendi girişiyle (${okunan.giris}) bağlanılan veritabanı`,
                durum: okunan.db.toUpperCase() === g.hedefDb.toUpperCase() ? "TAMAM" : "FARK",
                kaynak: g.hedefDb,
                hedef: okunan.db,
            });
            k.push({
                grup: "YER",
                tablo: null,
                ad: `Firmanın kendi girişiyle okunan satır sayıları yedekle aynı (${tablolar.length} tablo)`,
                durum: farkli.length ? "FARK" : "TAMAM",
                kaynak: toplam,
                hedef: tablolar.reduce((x, t) => x + (t.toUpperCase() === "TODVZ_KULLANICI" ? kaynakSayi.get(t) || 0 : okunan.sayi.get(t) || 0), 0),
                ornekler: farkli.slice(0, 8).map((t) => `${t}: yedek ${kaynakSayi.get(t)}, firma girişiyle ${okunan.sayi.get(t) ?? "-"}`),
            });
        }
        catch (err) {
            k.push({
                grup: "YER",
                tablo: null,
                ad: "Firmanın kendi girişiyle okuma yapılamadı",
                durum: "UYARI",
                ayrinti: `${String(err?.message || err).slice(0, 250)} — firma bağlantı bilgisini (Bilgi & Bağlantı) kontrol edin; veri klon hesabıyla doğrulandı.`,
            });
        }
    }
    return k;
};
/** Aktarım sonrası kontrol: tam yeniden karşılaştırma + çift / e-Döviz ek kontrolleri + doğru yer. */
export const sonKontrol = async (pool, g) => veritabanlariniDogrula(pool, g.kaynakDb, g.hedefDb, {
    ekKontroller: async (b) => [
        ...(await ciftKontrolleri(b, { kaynakDb: g.kaynakDb, hedefDb: g.hedefDb, cift: g.cift ?? null })),
        ...(await yerKontrolleri(pool, g)),
    ],
});
export const sonKontrolOzeti = (r) => {
    const sayilan = r.kontroller.filter((k) => k.durum === "TAMAM" || k.durum === "FARK");
    const tamam = sayilan.filter((k) => k.durum === "TAMAM").length;
    const yer = r.kontroller.filter((k) => k.grup === "YER");
    const dogruYer = yer.length > 0 && !yer.some((k) => k.durum === "FARK");
    const firmaGirisiyleOkundu = yer.some((k) => k.ad.startsWith("Firmanın kendi girişiyle okunan") && k.durum === "TAMAM");
    const yuzde = r.ozet.fark === 0 ? 100 : Math.min(99.99, Math.floor((tamam / Math.max(1, sayilan.length)) * 10000) / 100);
    const sayi = (x) => x.toLocaleString("tr-TR");
    const metin = r.basarili
        ? `%100 — ${sayi(r.ozet.tablo)} tablo, ${sayi(r.ozet.satir)} satır yedekle birebir aynı; ${dogruYer ? "doğru firmada" : "yer kontrolü yapılamadı"}` +
            (firmaGirisiyleOkundu ? ", firmanın kendi girişiyle okundu" : "") + (r.ozet.uyari ? ` (${r.ozet.uyari} uyarı)` : "")
        : `SORUN VAR — %${yuzde}: ${r.ozet.fark} kontrol farklı (${r.kontroller.filter((k) => k.durum === "FARK").slice(0, 3).map((k) => k.ad).join("; ")})`;
    return { basarili: r.basarili, yuzde, tablo: r.ozet.tablo, satir: r.ozet.satir, kontrol: sayilan.length, fark: r.ozet.fark, uyari: r.ozet.uyari, dogruYer, firmaGirisiyleOkundu, metin };
};
/** Gönderici (testte değiştirilebilir) */
export const bildirimAyar = { gonder: mailGonder };
/** Aktarım bildirimi (dağıtım bildirimiyle aynı alıcı: DAGITIM_EPOSTA, yoksa ILETISIM_ALICI). SMTP ayarlı değilse sessizce atlanır. */
export const aktarimBildirimi = async (g) => {
    if (!mailYapilandirildiMi())
        return false;
    const kime = env.DAGITIM_EPOSTA || env.ILETISIM_ALICI;
    if (!kime)
        return false;
    const iyi = !g.hata && !!g.ozet?.basarili;
    const konu = g.hata
        ? `VERİ AKTARIMI YAPILAMADI: ${g.firmaKodu} (firma değişmedi)`
        : iyi
            ? `Veri aktarımı tamam: ${g.firmaKodu} — %100 doğrulandı`
            : `VERİ AKTARIMI — KONTROL SORUNU: ${g.firmaKodu}`;
    const satirlar = [
        `Firma: ${g.unvan} (${g.firmaKodu})`,
        `Veritabanı: ${g.hedefDb}`,
        `Yedek: ${g.dosyaAdi}${g.eskiDb ? ` (eski veritabanı ${g.eskiDb})` : ""}`,
        `Yapan: ${g.yapan}`,
        g.hata ? `Hata: ${g.hata}` : null,
        g.hata ? "Aktarım tek işlemde yapılır; hata olduğu için hiçbir şey yazılmadı, firma aktarım öncesindeki hâlinde." : null,
        g.ozet ? `Aktarım sonrası kontrol: ${g.ozet.metin}` : null,
        g.ozet ? `Doğru firma: ${g.ozet.dogruYer ? "evet" : "DOĞRULANAMADI"}; firmanın kendi girişiyle okuma: ${g.ozet.firmaGirisiyleOkundu ? "evet" : "yapılamadı"}` : null,
        ...(g.farklar || []).map((f) => `FARK: ${f}`),
        ...(g.notlar || []).map((x) => `Not: ${x}`),
        `Panel: ${env.ADMIN_PANEL_URL}/firmalar/${g.firmaId}`,
    ].filter(Boolean);
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px"><h3 style="color:${iyi ? "#198754" : "#dc3545"}">${konu}</h3>${satirlar
        .map((s) => `<div>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`)
        .join("")}</div>`;
    try {
        await bildirimAyar.gonder({ kime, konu, html, metin: satirlar.join("\n") });
        return true;
    }
    catch (err) {
        logger.warn(`[AKTARIM] Bildirim maili gönderilemedi: ${err?.message}`);
        return false;
    }
};

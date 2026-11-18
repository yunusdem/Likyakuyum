/**
 * Veri aktarımı doğrulama — komut satırı (docs/VERITABANI_TASIMA_YOL_HARITASI.md, K10).
 * Eski programın yedeği (ya da açık veritabanı) ile firma veritabanını tablo tablo, satır satır karşılaştırır.
 *
 *   npm run aktarim:dogrula -- --kaynak-yedek C:\LikyaYedek\Aktarim\lr2026.bak --hedef-db DEMIRTAS_R [--rapor rapor.json] [--hepsi]
 *   npm run aktarim:dogrula -- --kaynak-db R2026_dvz --hedef-db DEMIRTAS_R
 *   (derlenmiş: node dist/scripts/aktarim-dogrula.js …)
 *
 * --hepsi: TAMAM kontrolleri de yazar. Bağlantı seçenekleri veri-aktar ile aynı. Çıkış kodu: 0 fark yok, 2 fark var, 1 hata.
 * Not: firma kullanılmaya başladıktan sonra yeni kayıtlar "hedefte fazla" görünür; doğrulama aktarımdan hemen sonra anlamlıdır.
 */
import { env } from "../config/env.config.js";
import { argumanlar, cliHavuzu, dogrulaKomutu, IncelemeEngeli } from "../services/aktarim/aktarimCli.js";
import { raporMetni } from "../services/aktarim/aktarimDogrulama.js";
const main = async () => {
    const a = argumanlar(process.argv.slice(2));
    if (!a["hedef-db"] || (!a["kaynak-yedek"] && !a["kaynak-db"])) {
        console.log("Kullanım: aktarim-dogrula (--kaynak-yedek <dosya.bak> | --kaynak-db <ad>) --hedef-db <firma veritabanı> [--rapor <dosya.json>] [--hepsi]");
        process.exitCode = 1;
        return;
    }
    const pool = await cliHavuzu({
        server: a.server || env.KLON_DB_SERVER || env.ADMIN_DB_SERVER || env.DB_SERVER,
        port: Number(a.port) || Number(env.KLON_DB_PORT) || undefined,
        user: a.user || env.KLON_DB_USER,
        password: a.password || env.KLON_DB_PASSWORD,
    });
    try {
        const r = await dogrulaKomutu(pool, { kaynakYedek: a["kaynak-yedek"] || null, kaynakDb: a["kaynak-db"] || null, hedefDb: a["hedef-db"], rapor: a.rapor || null });
        console.log(raporMetni(r, !a.hepsi));
        if (!r.basarili)
            process.exitCode = 2;
    }
    catch (err) {
        if (err instanceof IncelemeEngeli) {
            for (const e of err.engeller)
                console.error(`  [${e.seviye}] ${e.mesaj}`);
            process.exitCode = 2;
        }
        else {
            console.error(`  HATA: ${err?.message || err}`);
            process.exitCode = 1;
        }
    }
    finally {
        await pool.close().catch(() => undefined);
    }
};
main().finally(() => setTimeout(() => process.exit(), 300));

/**
 * Manuel veya CI/CD üzerinden veritabanı şema göçlerini (migrations) çalıştırma betiği.
 *
 * Kullanım:
 *   npm run sema:goc
 *
 * Backend/migrations altındaki tüm uygulanmamış göçleri sırayla çalıştırır
 * ve LKY_SEMA_SURUMU tablosuna işler.
 */
import { getDbPool } from "../config/mssql.config.js";
import { semaGocUygula, semaSurumu } from "../services/semaGoc.service.js";
const arg = (ad) => {
    const i = process.argv.indexOf(ad);
    return i >= 0 ? process.argv[i + 1] ?? "" : null;
};
async function main() {
    console.log("\n=======================================================");
    console.log("  Likya Kuyumculuk - Veritabanı Şema Göçü (Migration)");
    console.log("=======================================================\n");
    const serverArg = arg("--server") || process.env.DB_SERVER || "127.0.0.1";
    const dbArg = arg("--db") || process.env.DB_NAME || "R2016_dvz";
    const userArg = arg("--user") || process.env.DB_USER || "sa";
    const passArg = arg("--password") || process.env.DB_PASSWORD || "";
    console.log(`  Sunucu: ${serverArg} | Veritabanı: ${dbArg}`);
    const pool = await getDbPool(serverArg, dbArg, userArg, passArg);
    const oncekiSurum = await semaSurumu(pool);
    console.log(`  Mevcut Veritabanı Sürümü: ${oncekiSurum}`);
    const sonuc = await semaGocUygula(pool);
    if (sonuc.uygulanan.length === 0) {
        console.log("  ✅ Veritabanı zaten en güncel sürümde, uygulanacak yeni göç yok.\n");
    }
    else {
        console.log(`  🚀 Uygulanan Göçler (${sonuc.uygulanan.length} adet):`);
        for (const ad of sonuc.uygulanan) {
            console.log(`     -> ${ad}`);
        }
        console.log(`\n  ✅ Veritabanı yeni sürüme yükseltildi: ${sonuc.sonraki}\n`);
    }
}
main()
    .catch((err) => {
    console.error("\n❌ Şema göçü sırasında hata oluştu:\n", err);
    process.exitCode = 1;
})
    .finally(() => {
    setTimeout(() => process.exit(), 500);
});

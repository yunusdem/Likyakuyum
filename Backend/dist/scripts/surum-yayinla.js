/**
 * Sürüm yayınlama — merkez sunucuda her deploy'dan sonra (Backend ve kök npm run build'den SONRA):
 *
 *   npm run surum:yayinla -- --not "Kısa açıklama"
 *
 * Seçenekler: --mevcut-moduller (npm ci yerine mevcut node_modules), --sema-atla, --kuru (veritabanına yazmaz)
 *             --yalniz-sema: paket üretmez, yalnızca şema göçlerini (şablon, bulut firmaları, LIKYA_ADMIN) uygular
 *             (test ortamı ve dağıtım betiği; docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md)
 * docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 6.6
 */
import path from "path";
import { closeAdminPool } from "../config/adminDb.config.js";
import { semaYay, surumYayinla } from "../services/surum/surumYayinla.js";
const arg = (ad) => {
    const i = process.argv.indexOf(ad);
    return i >= 0 ? process.argv[i + 1] ?? "" : null;
};
const var_ = (ad) => process.argv.includes(ad);
const main = async () => {
    const backendKok = process.cwd();
    if (var_("--yalniz-sema")) {
        const sema = await semaYay((m) => console.log("  " + m));
        console.log("");
        console.log(`  TAMAM: şema hedef ${sema.hedef}; şablon ${sema.sablon ?? "-"}; yönetim ${sema.yonetim ?? "-"}`);
        for (const f of sema.firmalar)
            console.log(`          ${f.firmaKodu}: ${f.sonuc}`);
        if (sema.firmalar.some((f) => f.sonuc.startsWith("HATA")) || String(sema.yonetim || "").startsWith("HATA"))
            process.exitCode = 2;
        console.log("");
        return;
    }
    const sonuc = await surumYayinla({
        backendKok,
        webKok: path.resolve(backendKok, "..", "dist"),
        not: arg("--not"),
        mevcutModuller: var_("--mevcut-moduller"),
        semaAtla: var_("--sema-atla"),
        kuru: var_("--kuru"),
        log: (m) => console.log("  " + m),
    });
    console.log("");
    console.log(`  TAMAM: sürüm ${sonuc.surum}`);
    console.log(`  Paket : ${sonuc.zip} (${(sonuc.boyut / 1024 / 1024).toFixed(1)} MB, ${sonuc.dosyaSayisi} dosya)`);
    console.log(`  Şema  : hedef ${sonuc.sema.hedef}; şablon ${sonuc.sema.sablon ?? "-"}; yönetim ${sonuc.sema.yonetim ?? "-"}`);
    for (const f of sonuc.sema.firmalar)
        console.log(`          ${f.firmaKodu}: ${f.sonuc}`);
    console.log("");
};
main()
    .catch((err) => {
    console.error("\n  HATA: " + (err?.message || err) + "\n");
    process.exitCode = 1;
})
    .finally(() => closeAdminPool().finally(() => setTimeout(() => process.exit(), 200)));

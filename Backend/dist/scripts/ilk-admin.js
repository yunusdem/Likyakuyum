/**
 * Ana admin paneli — sunucuda elle çalıştırılan tek seferlik komut.
 *
 *   İlk admini oluştur (yalnızca hiç admin yokken çalışır):
 *     npm run ilk-admin -- <kullaniciAdi> "<Ad Soyad>"
 *
 *   Kurtarma: bir adminin şifresini sıfırla ve hesabını aktife al (panele kimse giremiyorsa):
 *     npm run ilk-admin -- --sifirla <kullaniciAdi>
 *
 * Geçici şifre yalnızca bu konsola, bir kez yazılır; admin ilk girişte kendi şifresini belirler.
 * Derlenmiş hali: node dist/scripts/ilk-admin.js ...
 */
import { adminYapilandirildiMi, closeAdminPool } from "../config/adminDb.config.js";
import { AdminSqlRepository } from "../models/admin/adminSql.repository.js";
import { AdminOturumSqlRepository } from "../models/admin/adminOturumSql.repository.js";
import { AdminLogSqlRepository } from "../models/admin/adminLogSql.repository.js";
import { geciciSifreUret, sifreHashle } from "../utils/sifre.utils.js";
const KULLANICI_ADI_KURALI = /^[a-zA-Z0-9._-]{3,50}$/;
const sifreyiYaz = (kullaniciAdi, geciciSifre) => {
    console.log("");
    console.log("  Kullanıcı adı : " + kullaniciAdi);
    console.log("  Geçici şifre  : " + geciciSifre);
    console.log("");
    console.log("  Bu şifre bir daha gösterilmez. İlk girişte yeni şifre belirlemeniz istenecek.");
    console.log("");
};
const olustur = async (kullaniciAdi, adSoyad) => {
    const { toplam } = await AdminSqlRepository.sayilar();
    if (toplam > 0) {
        throw new Error("Sistemde zaten admin var. Yeni adminler panelden eklenir; kurtarma için: --sifirla <kullaniciAdi>");
    }
    const geciciSifre = geciciSifreUret();
    const adminId = await AdminSqlRepository.ekle({
        kullaniciAdi,
        adSoyad,
        sifreHash: await sifreHashle(geciciSifre),
        olusturanAdminId: null,
    });
    if (adminId === null)
        throw new Error("Admin oluşturulamadı.");
    await AdminLogSqlRepository.islemLogu({
        adminId: null,
        islem: "ADMIN_EKLENDI",
        hedefTur: "ADMIN",
        hedefId: adminId,
        yeni: { kullaniciAdi, adSoyad, kaynak: "ilk-admin komutu" },
    });
    console.log("İlk admin oluşturuldu.");
    sifreyiYaz(kullaniciAdi, geciciSifre);
};
const sifirla = async (kullaniciAdi) => {
    const admin = await AdminSqlRepository.kullaniciAdiIleBul(kullaniciAdi);
    if (!admin)
        throw new Error(`'${kullaniciAdi}' adında bir admin yok.`);
    if (admin.durum !== "AKTIF") {
        const sonuc = await AdminSqlRepository.durumDegistir(admin.adminId, "AKTIF");
        if (sonuc === "LIMIT") {
            throw new Error("Aktif admin sınırı dolu; bu hesap aktife alınamadı. Önce panelden birini pasife alın.");
        }
    }
    const geciciSifre = geciciSifreUret();
    await AdminSqlRepository.sifreGuncelle(admin.adminId, await sifreHashle(geciciSifre), true);
    await AdminOturumSqlRepository.adminOturumlariniIptalEt(admin.adminId, null);
    await AdminLogSqlRepository.islemLogu({
        adminId: null,
        islem: "ADMIN_SIFRE_SIFIRLANDI",
        hedefTur: "ADMIN",
        hedefId: admin.adminId,
        yeni: { kaynak: "ilk-admin komutu" },
    });
    console.log("Admin şifresi sıfırlandı.");
    sifreyiYaz(admin.kullaniciAdi, geciciSifre);
};
const calistir = async () => {
    if (!adminYapilandirildiMi()) {
        throw new Error("Backend/.env içinde ADMIN_DB_USER, ADMIN_DB_PASSWORD ve en az 32 karakterlik ADMIN_JWT_SECRET ile ADMIN_DB_ENC_KEY tanımlı olmalı.");
    }
    const args = process.argv.slice(2);
    if (args[0] === "--sifirla") {
        if (!args[1])
            throw new Error("Kullanım: npm run ilk-admin -- --sifirla <kullaniciAdi>");
        return sifirla(args[1].trim().toLowerCase());
    }
    const [kullaniciAdi, ...adParcalari] = args;
    const adSoyad = adParcalari.join(" ").trim();
    if (!kullaniciAdi || !adSoyad) {
        throw new Error('Kullanım: npm run ilk-admin -- <kullaniciAdi> "<Ad Soyad>"');
    }
    if (!KULLANICI_ADI_KURALI.test(kullaniciAdi)) {
        throw new Error("Kullanıcı adı 3-50 karakter olmalı; yalnızca harf, rakam, nokta, alt çizgi ve tire içerebilir.");
    }
    return olustur(kullaniciAdi.trim().toLowerCase(), adSoyad);
};
calistir()
    .then(async () => {
    await closeAdminPool();
    process.exit(0);
})
    .catch(async (err) => {
    console.error("HATA: " + (err?.message || err));
    await closeAdminPool();
    process.exit(1);
});

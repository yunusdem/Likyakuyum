/**
 * Eski programdan veri aktarımı — komut satırı (docs/VERITABANI_TASIMA_YOL_HARITASI.md, K10).
 *
 *   npm run veri:aktar -- --yedek C:\LikyaYedek\Aktarim\lr2026.bak --hedef-db DEMIRTAS_R [--on-yedek C:\LikyaYedek\Aktarim\once.bak] [--rapor rapor.json]
 *   (derlenmiş: node dist/scripts/veri-aktar.js …)
 *
 * R/A çifti (eski programda tetiklerle bağlı iki veritabanı): her yedek kendi firmasına, eşin firma veritabanı verilerek aktarılır:
 *   --cift-db <eşin firma veritabanı> [--cift-eski-ad A2026_dvz] [--rol RESMI|CALISMA] [--giris <bu firmanın SQL girişi>] [--cift-giris <eşin girişi>]
 *   Eşin eski adı ve rol verilmezse yedekten bulunur (e-Döviz günlüğü dolu taraf RESMI).
 * Sarraf fişi olan (kuyum) yedeklerde eşleme taslaktır: önce deneme veritabanına aktarıp kontrol edin, sonra --taslak-onay ile.
 *
 * Bağlantı (varsayılan .env / .env.local): --server (KLON_DB_SERVER | DB_SERVER), --user (KLON_DB_USER), --password (KLON_DB_PASSWORD).
 * Hesap RESTORE yapabilmeli ve hedef firma veritabanının sahibi olmalı (sunucuda likya_klon). Hedef, şablondan açılmış firma veritabanıdır.
 * Yedek geçici adla açılır, aktarım tek işlemde yapılır ve COMMIT'ten önce doğrulanır; fark varsa hiçbir şey yazılmaz.
 * Çıkış kodu: 0 başarılı, 1 hata, 2 engel / doğrulama farkı.
 */
import { env } from "../config/env.config.js";
import { argumanlar, cliHavuzu, IncelemeEngeli, veriAktarKomutu } from "../services/aktarim/aktarimCli.js";
import { AktarimDogrulamaHatasi, AktarimEngeli } from "../services/aktarim/aktarimMotoru.js";
import { raporMetni } from "../services/aktarim/aktarimDogrulama.js";

const main = async () => {
  const a = argumanlar(process.argv.slice(2));
  if (!a.yedek || !a["hedef-db"]) {
    console.log("Kullanım: veri-aktar --yedek <dosya.bak> --hedef-db <firma veritabanı> [--on-yedek <dosya.bak>] [--rapor <dosya.json>] [--server --user --password]");
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
    const s = await veriAktarKomutu(pool, {
      yedek: a.yedek,
      hedefDb: a["hedef-db"],
      onYedek: a["on-yedek"] || null,
      rapor: a.rapor || null,
      taslakOnay: a["taslak-onay"] === "1",
      ilerleme: (x) => console.log(`  [%${String(x.yuzde).padStart(3)}] ${x.mesaj}`),
      cift: a["cift-db"]
        ? {
            esHedefDb: a["cift-db"],
            esEskiAdi: a["cift-eski-ad"] || null,
            rol: a.rol === "RESMI" || a.rol === "CALISMA" ? a.rol : null,
            hedefGirisi: a.giris || null,
            esGirisi: a["cift-giris"] || null,
          }
        : null,
    });
    console.log("");
    console.log(`  Kaynak: ${s.inceleme.yedek.dbAdi} (${s.inceleme.yedek.sqlSurumu}, eski program ${s.inceleme.programSurumu ?? "?"}) — ${s.inceleme.firma.ad ?? ""}`);
    console.log(`  Aktarılan: ${s.aktarim.tablolar.filter((t) => t.islem === "KOPYALA").length} tablo, ${s.aktarim.tablolar.reduce((x, t) => x + t.yazilan, 0)} satır (${Math.round(s.aktarim.sureMs / 1000)} sn)`);
    if (s.aktarim.korunanKullanicilar.length) console.log(`  Korunan kullanıcı: ${s.aktarim.korunanKullanicilar.join(", ")}`);
    for (const n of s.aktarim.notlar) console.log(`  Not: ${n}`);
    console.log("");
    console.log(raporMetni(s.dogrulama));
  } catch (err: any) {
    if (err instanceof IncelemeEngeli || err instanceof AktarimEngeli) {
      console.error("\n  AKTARIM BAŞLAMADI:");
      for (const e of err.engeller) console.error(`   [${e.seviye}] ${e.mesaj}`);
      process.exitCode = 2;
    } else if (err instanceof AktarimDogrulamaHatasi) {
      console.error("\n  DOĞRULAMA TUTMADI, aktarım geri alındı:");
      console.error(raporMetni(err.dogrulama as any));
      process.exitCode = 2;
    } else {
      console.error(`\n  HATA: ${err?.message || err}`);
      process.exitCode = 1;
    }
  } finally {
    await pool.close().catch(() => undefined);
  }
};

main().finally(() => setTimeout(() => process.exit(), 300));

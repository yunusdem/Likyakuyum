/**
 * Kurulum exe'si üretimi — merkez sunucuda, surum:yayinla'dan SONRA (Inno Setup 6 kurulu olmalı):
 *
 *   npm run kurulum:paketi -- --sql "C:\LikyaYedek\Surumler\araclar\SQLEXPR_x64_ENU.exe"
 *
 * Seçenekler: --surum <sürüm> (varsayılan: yayındaki en son), --iscc <ISCC.exe yolu>, --sqlsiz (SQL Express gömülmez),
 *             --sadece-hazirla (ISCC çalıştırılmaz; deneme)
 * Çıktı: <SURUM_KLASORU>\kurulum\LikyaKuyumKurulum.exe (panelin firmaya özel indirme bağlantısı bunu verir)
 * docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, bölüm 10
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import sql from "mssql";
import { closeAdminPool, getAdminPool } from "../config/adminDb.config.js";
import { AyarSqlRepository } from "../models/admin/ayarSql.repository.js";

const arg = (ad: string): string | null => {
  const i = process.argv.indexOf(ad);
  return i >= 0 ? process.argv[i + 1] ?? "" : null;
};
const var_ = (ad: string): boolean => process.argv.includes(ad);

const ISCC_ADAYLARI = ["C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe", "C:\\Program Files\\Inno Setup 6\\ISCC.exe"];

export const kurulumPaketiHazirla = async (s: {
  backendKok: string;
  surumKlasoru: string;
  surum?: string | null;
  zip?: string | null;
  sablon: string;
  sqlMedya?: string | null;
  nodeExe?: string;
  log?: (m: string) => void;
}): Promise<{ hazirlik: string; surum: string }> => {
  const log = s.log ?? (() => undefined);
  let surum = s.surum ?? null;
  let zip = s.zip ?? null;
  if (!zip) {
    const pool = await getAdminPool();
    const r = (
      await pool
        .request()
        .input("s", sql.VarChar(30), surum)
        .query(`SELECT TOP 1 SURUM, DOSYA_YOLU FROM dbo.ADM_SURUM WHERE (@s IS NULL AND AKTIF = 1) OR SURUM = @s ORDER BY YAYIN_TARIHI DESC, SURUM DESC`)
    ).recordset[0];
    if (!r) throw new Error("Yayında sürüm yok: önce npm run surum:yayinla.");
    surum = r.SURUM;
    zip = r.DOSYA_YOLU;
  }
  if (!zip || !fs.existsSync(zip)) throw new Error(`Sürüm paketi bulunamadı: ${zip}`);
  if (!fs.existsSync(s.sablon)) throw new Error(`Şablon yedeği bulunamadı: ${s.sablon}`);
  const betikler = path.resolve(s.backendKok, "..", "kurulum", "betikler");
  if (!fs.existsSync(path.join(betikler, "kur-sonrasi.ps1"))) throw new Error(`Kurulum betikleri bulunamadı: ${betikler}`);

  const hazirlik = path.join(s.surumKlasoru, "kurulum-hazirlik");
  fs.rmSync(hazirlik, { recursive: true, force: true });
  for (const k of ["node", "uygulama", "araclar", "sablon", "sql"]) fs.mkdirSync(path.join(hazirlik, k), { recursive: true });

  log(`Sürüm ${surum} paketi açılıyor…`);
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${path.join(hazirlik, "uygulama").replace(/'/g, "''")}' -Force`],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  );
  if (r.status !== 0) throw new Error(`Paket açılamadı: ${r.stderr || r.stdout}`);
  if (!fs.existsSync(path.join(hazirlik, "uygulama", "backend", "BUTUNLUK.json"))) throw new Error("Paket eksik: backend\\BUTUNLUK.json yok.");

  fs.copyFileSync(s.nodeExe || process.execPath, path.join(hazirlik, "node", "node.exe"));
  for (const f of fs.readdirSync(betikler)) fs.copyFileSync(path.join(betikler, f), path.join(hazirlik, "araclar", f));
  fs.copyFileSync(s.sablon, path.join(hazirlik, "sablon", "sablon.bak"));
  if (s.sqlMedya) {
    if (!fs.existsSync(s.sqlMedya)) throw new Error(`SQL Server Express kurulum dosyası bulunamadı: ${s.sqlMedya}`);
    fs.copyFileSync(s.sqlMedya, path.join(hazirlik, "sql", "SQLEXPR_x64_ENU.exe"));
  }
  return { hazirlik, surum: surum! };
};

const main = async () => {
  const backendKok = process.cwd();
  const surumKlasoru = await AyarSqlRepository.oku("SURUM_KLASORU");
  const sqlMedya = var_("--sqlsiz") ? null : arg("--sql") || path.join(surumKlasoru, "araclar", "SQLEXPR_x64_ENU.exe");
  const { hazirlik, surum } = await kurulumPaketiHazirla({
    backendKok,
    surumKlasoru,
    surum: arg("--surum"),
    sablon: await AyarSqlRepository.oku("SABLON_YEDEK_DOSYASI"),
    sqlMedya,
    log: (m) => console.log("  " + m),
  });
  if (var_("--sadece-hazirla")) {
    console.log(`\n  Hazırlık klasörü: ${hazirlik}\n`);
    return;
  }
  const iscc = arg("--iscc") || ISCC_ADAYLARI.find((a) => fs.existsSync(a));
  if (!iscc) throw new Error("Inno Setup 6 bulunamadı (ISCC.exe). Kurun: winget install JRSoftware.InnoSetup");
  const cikti = path.join(surumKlasoru, "kurulum");
  fs.mkdirSync(cikti, { recursive: true });
  console.log("  Kurulum exe'si derleniyor (birkaç dakika)…");
  const iss = path.resolve(backendKok, "..", "kurulum", "LikyaKuyum.iss");
  // /Q: yalnız uyarı ve hatalar yazılır (her dosya için "Compressing:" satırı varsayılan 1 MB tamponu taşırıp süreci öldürüyordu)
  const r = spawnSync(iscc, ["/Q", `/DSurum=${surum}`, `/DKaynak=${hazirlik}`, `/DCikti=${cikti}`, iss], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) throw new Error(`ISCC çalıştırılamadı: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ISCC başarısız (kod ${r.status}): ${(r.stderr || "").slice(-2000)} ${(r.stdout || "").slice(-2000)}`);
  fs.writeFileSync(path.join(cikti, "SURUM"), surum, "utf8");
  fs.rmSync(hazirlik, { recursive: true, force: true });
  console.log(`\n  TAMAM: ${path.join(cikti, "LikyaKuyumKurulum.exe")} (sürüm ${surum})\n`);
};

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("scripts/kurulum-paketi.ts")) {
  main()
    .catch((err) => {
      console.error("\n  HATA: " + (err?.message || err) + "\n");
      process.exitCode = 1;
    })
    .finally(() => closeAdminPool().finally(() => setTimeout(() => process.exit(), 200)));
}

import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { env } from "../../config/env.config.js";
import { logger } from "../../utils/logger.js";
import { calisanSurum } from "../../utils/surum.js";
import { paketImzasiDogru, sha256Dosya } from "../surum/paketImza.js";
import { GuncellemeBilgisi, KurulumBildirim } from "./kurulumBildirim.js";
import { kurulumFirmasi, veriYolu } from "./firmaDosyasi.js";
import { uygulamaKoku } from "./butunluk.js";

/**
 * Kurulumun kendini güncellemesi (docs/BULUT_VE_EXE_LISANS_YOL_HARITASI.md, 6.6 · K10):
 * bildirim yeni sürüm söylerse paket indirilir, özeti ve merkez imzası doğrulanır, gece 03:00'e (ya da "şimdi")
 * güncelleme görevi planlanır. Görev (araclar\guncelle.ps1, SYSTEM) programı durdurur, yeni sürümü açar, sağlık
 * denetimi tutmazsa eski sürüme döner ve sonucu guncelleme\sonuc.json'a yazar.
 */

export interface BekleyenGuncelleme {
  surum: string;
  dosya: string;
  sha256: string;
  zaman: string;
}

const klasor = () => veriYolu("guncelleme");
const bekleyenYolu = () => path.join(klasor(), "bekleyen.json");

/** Kurulum kökü: {app}\uygulama\backend → {app} */
export const kurulumKoku = (): string => process.env.KURULUM_KOKU || path.resolve(uygulamaKoku(), "..", "..");

let suruyor = false;
let planlayici: (zip: string, surum: string, hemen: boolean) => Promise<void> = async (zip, surum, hemen) => {
  const betik = path.join(kurulumKoku(), "araclar", "guncelleme-planla.ps1");
  await new Promise<void>((tamam, hata) => {
    const p = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", betik, "-Zip", zip, "-Surum", surum, ...(hemen ? ["-Hemen"] : [])], {
      windowsHide: true,
    });
    let cikti = "";
    p.stdout.on("data", (d) => (cikti += d));
    p.stderr.on("data", (d) => (cikti += d));
    p.on("error", hata);
    p.on("close", (kod) => (kod === 0 ? tamam() : hata(new Error(`Güncelleme planlanamadı (${kod}): ${cikti.slice(-400)}`))));
  });
};

/** Yalnız testler: planlama adımını değiştirir (Görev Zamanlayıcı yerine). */
export const guncelleyiciTestKancasi = (fn: typeof planlayici) => {
  planlayici = fn;
};

export const bekleyenGuncelleme = (): BekleyenGuncelleme | null => {
  try {
    const b = JSON.parse(fs.readFileSync(bekleyenYolu(), "utf8")) as BekleyenGuncelleme;
    return fs.existsSync(b.dosya) ? b : null;
  } catch {
    return null;
  }
};

export const sonGuncellemeSonucu = (): { surum: string; basarili: boolean; mesaj: string; zaman: string } | null => {
  try {
    return JSON.parse(fs.readFileSync(path.join(klasor(), "sonuc.json"), "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
};

export class Guncelleyici {
  /** Yeni sürümü indirir, doğrular ve gece güncellemesini planlar. Aynı sürüm zaten bekliyorsa yalnız planı yeniler. */
  public static async hazirla(g: GuncellemeBilgisi, merkez: string, fetchFn: typeof fetch = fetch): Promise<BekleyenGuncelleme | null> {
    if (!g?.surum || g.surum === calisanSurum()) return null;
    if (suruyor) return null;
    suruyor = true;
    try {
      fs.mkdirSync(klasor(), { recursive: true });
      const mevcut = bekleyenGuncelleme();
      if (mevcut && mevcut.surum === g.surum && mevcut.sha256 === g.sha256) {
        await planlayici(mevcut.dosya, mevcut.surum, false);
        return mevcut;
      }
      if (!paketImzasiDogru(g.surum, g.sha256, g.imza)) throw new Error("Güncelleme bilgisinin imzası tutmuyor.");

      const firma = kurulumFirmasi();
      if (!firma) throw new Error("firma.lky yok.");
      const gecici = path.join(klasor(), "indiriliyor.zip");
      const r = await fetchFn(`${merkez.replace(/\/+$/, "")}/api/v1${g.yol}`, {
        headers: { "x-likya-firma": firma.firmaKodu, "x-likya-anahtar": firma.kurulumAnahtari },
      });
      if (!r.ok || !r.body) throw new Error(`Paket indirilemedi (HTTP ${r.status}).`);
      const yaz = fs.createWriteStream(gecici);
      for await (const parca of r.body as any) {
        if (!yaz.write(Buffer.from(parca))) await new Promise<void>((t) => yaz.once("drain", () => t()));
      }
      await new Promise<void>((t, h) => yaz.end((e: any) => (e ? h(e) : t())));

      const sha = await sha256Dosya(gecici);
      if (sha !== g.sha256 || fs.statSync(gecici).size !== g.boyut) {
        fs.rmSync(gecici, { force: true });
        throw new Error("İndirilen paketin özeti tutmuyor.");
      }
      const dosya = path.join(klasor(), `${g.surum.replace(/[^A-Za-z0-9.+-]/g, "_")}.zip`);
      for (const f of fs.readdirSync(klasor())) if (f.endsWith(".zip") && path.join(klasor(), f) !== gecici) fs.rmSync(path.join(klasor(), f), { force: true });
      fs.renameSync(gecici, dosya);
      const b: BekleyenGuncelleme = { surum: g.surum, dosya, sha256: sha, zaman: new Date().toISOString() };
      fs.writeFileSync(bekleyenYolu(), JSON.stringify(b), "utf8");
      await planlayici(dosya, g.surum, false);
      logger.info(`[GUNCELLEME] ${g.surum} indirildi; gece 03:00'te uygulanacak.`);
      return b;
    } catch (err: any) {
      logger.error(`[GUNCELLEME] ${g?.surum} hazırlanamadı: ${err?.message}`);
      throw err;
    } finally {
      suruyor = false;
    }
  }

  /** Bekleyen güncellemeyi hemen uygular (program yeniden başlar). */
  public static async simdiUygula(): Promise<BekleyenGuncelleme> {
    const b = bekleyenGuncelleme();
    if (!b) throw new Error("Bekleyen güncelleme yok.");
    await planlayici(b.dosya, b.surum, true);
    return b;
  }

  public static baslat(): void {
    if (!env.KURULUM_MODU) return;
    KurulumBildirim.guncellemeDinle((g, merkez) => void this.hazirla(g, merkez).catch(() => undefined));
    const s = sonGuncellemeSonucu();
    if (s) logger.info(`[GUNCELLEME] Son güncelleme: ${s.surum} ${s.basarili ? "başarılı" : "BAŞARISIZ"} — ${s.mesaj}`);
  }
}

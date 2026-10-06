import fs from "fs";
import path from "path";
import { env } from "../../config/env.config.js";
import { imzaliMetinCoz, imzaliMetinUret } from "../lisans/lisansKodu.js";

/**
 * firma.lky: kurulum paketine firmaya özel konan, merkezin imzaladığı kimlik dosyası (K14, K21).
 * Kurulum hangi firmaya ait olduğunu, merkez adresini ve merkeze kendini tanıtacağı anahtarı buradan öğrenir.
 * İmzalı olduğu için müşteri başka bir firmanın koduna çeviremez.
 */

export const FIRMA_DOSYASI_ONEKI = "LKYF";

export interface FirmaDosyasi {
  v: 1;
  firmaId: number;
  firmaKodu: string;
  musteriNo: string;
  unvan: string;
  /** Merkez sunucu adresi (https://likyakuyum.com) */
  merkez: string;
  /** Merkeze bildirimde kimlik: merkez yalnız SHA-256 özetini saklar */
  kurulumAnahtari: string;
  verilme: string;
}

export const firmaDosyasiUret = (veri: FirmaDosyasi, ozelB64: string): string =>
  imzaliMetinUret(FIRMA_DOSYASI_ONEKI, veri, ozelB64);

export const firmaDosyasiCoz = (metin: string, acikB64?: string): FirmaDosyasi => {
  const v = imzaliMetinCoz<FirmaDosyasi>(FIRMA_DOSYASI_ONEKI, metin, acikB64);
  if (!v || v.v !== 1 || !v.firmaKodu || !Number.isInteger(v.firmaId) || !v.kurulumAnahtari) {
    throw new Error("firma.lky içeriği hatalı.");
  }
  return v;
};

export const veriYolu = (dosya: string): string => path.join(env.VERI_KLASORU, dosya);

let onbellek: { zaman: number; veri: FirmaDosyasi | null; hata: string | null } | null = null;

/** Kurulumun firma bilgisi; dosya yoksa veya imzası tutmuyorsa null (hata nedeni `firmaDosyasiHatasi`). */
export const kurulumFirmasi = (): FirmaDosyasi | null => {
  if (onbellek && Date.now() - onbellek.zaman < 60_000) return onbellek.veri;
  let veri: FirmaDosyasi | null = null;
  let hata: string | null = null;
  try {
    veri = firmaDosyasiCoz(fs.readFileSync(veriYolu("firma.lky"), "utf8"));
  } catch (err: any) {
    hata = err?.code === "ENOENT" ? "firma.lky bulunamadı" : String(err?.message || err);
  }
  onbellek = { zaman: Date.now(), veri, hata };
  return veri;
};

export const firmaDosyasiHatasi = (): string | null => {
  kurulumFirmasi();
  return onbellek?.hata ?? null;
};

export const firmaDosyasiOnbelleginiTemizle = (): void => {
  onbellek = null;
};

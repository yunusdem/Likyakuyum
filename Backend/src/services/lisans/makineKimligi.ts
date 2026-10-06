import crypto from "crypto";
import { execFileSync } from "child_process";

/**
 * Makine kimliği: anakart UUID'si + Windows MachineGuid + sistem diskinin seri numarası → SHA-256 → XXXX-XXXX-XXXX-XXXX.
 * Lisans bu kimliğe bağlanır; dosyalar başka bilgisayara kopyalanınca lisans çalışmaz (K14, K16).
 * Bileşenlerden biri okunamazsa kalanlarla hesaplanır; hiçbiri okunamazsa hata verir.
 */

let onbellek: string | null = null;

const ps = (komut: string): string => {
  try {
    return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", komut], {
      encoding: "utf8",
      timeout: 15000,
      windowsHide: true,
    }).trim();
  } catch {
    return "";
  }
};

export const makineBilesenleri = (): { uuid: string; machineGuid: string; diskSeri: string } => ({
  uuid: ps("(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID"),
  machineGuid: ps("(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid"),
  diskSeri: ps("(Get-CimInstance -ClassName Win32_LogicalDisk -Filter \"DeviceID='$env:SystemDrive'\").VolumeSerialNumber"),
});

export const kimligiBicimle = (ozet: string): string =>
  ozet
    .slice(0, 16)
    .toUpperCase()
    .match(/.{4}/g)!
    .join("-");

export const makineKimligiHesapla = (b: { uuid: string; machineGuid: string; diskSeri: string }): string => {
  const parcalar = [b.uuid, b.machineGuid, b.diskSeri].map((x) => (x || "").trim().toUpperCase());
  if (parcalar.every((x) => !x)) throw new Error("Makine kimliği okunamadı.");
  return kimligiBicimle(crypto.createHash("sha256").update(`likya|${parcalar.join("|")}`).digest("hex"));
};

export const makineKimligi = (): string => {
  if (!onbellek) onbellek = makineKimligiHesapla(makineBilesenleri());
  return onbellek;
};

export const MAKINE_KIMLIGI_KURALI = /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

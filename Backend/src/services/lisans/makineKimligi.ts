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

type Bilesenler = { uuid: string; machineGuid: string; diskSeri: string };

const OKUYUCU: Record<keyof Bilesenler, () => string> = {
  uuid: () => ps("(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID"),
  machineGuid: () => ps("(Get-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid"),
  diskSeri: () => ps("(Get-CimInstance -ClassName Win32_LogicalDisk -Filter \"DeviceID='$env:SystemDrive'\").VolumeSerialNumber"),
};

export const makineBilesenleri = (): Bilesenler => ({ uuid: OKUYUCU.uuid(), machineGuid: OKUYUCU.machineGuid(), diskSeri: OKUYUCU.diskSeri() });

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

/** Eksik bileşenle hesaplanan kimlik: kalıcı önbelleğe alınmadan önce aralıklarla yeniden okunur */
let kismi: { kimlik: string; tekrar: number; zaman: number } | null = null;
/** Hiçbir bileşen okunamadıysa 5 dk yeniden okunmaz (her lisans hesabında PowerShell çalışıp sunucu donuyordu, E25) */
let okunamadi = 0;
const KISMI_YENIDEN_OKUMA_MS = 5 * 60 * 1000;
const KISMI_KALICI_TEKRAR = 3;

const tamMi = (b: Bilesenler) => !!(b.uuid && b.machineGuid && b.diskSeri);

/**
 * Bilgisayarın kimliği. Bir bileşen okunamazsa (açılıştaki yoğunlukta PowerShell zaman aşımı) hemen bir kez daha denenir;
 * yine eksikse kimlik kalıcı önbelleğe alınmaz, 5 dakikada bir yeniden okunur. Önceden eksik bileşenle hesaplanan farklı
 * kimlik süreç boyunca önbellekte kalıyor, program yeniden başlatılana kadar "lisans başka bilgisayarın" kilidi veriyordu.
 * Aynı eksik kimlik 3 kez üst üste çıkarsa bileşen bu bilgisayarda yok sayılır ve kalıcı olur.
 */
export const makineKimligi = (): string => {
  if (onbellek) return onbellek;
  const simdi = Date.now();
  if (kismi && simdi - kismi.zaman < KISMI_YENIDEN_OKUMA_MS) return kismi.kimlik;
  if (okunamadi && simdi - okunamadi < KISMI_YENIDEN_OKUMA_MS && simdi >= okunamadi) throw new Error("Makine kimliği okunamadı.");
  const b = makineBilesenleri();
  // Yalnız okunamayan bileşen bir kez daha okunur (önceden üçü birden yeniden okunuyor, bekleme ikiye katlanıyordu)
  for (const k of Object.keys(OKUYUCU) as (keyof Bilesenler)[]) if (!b[k]) b[k] = OKUYUCU[k]();
  let kimlik: string;
  try {
    kimlik = makineKimligiHesapla(b);
  } catch (err) {
    okunamadi = simdi;
    throw err;
  }
  okunamadi = 0;
  if (tamMi(b)) {
    onbellek = kimlik;
    kismi = null;
    return kimlik;
  }
  kismi = { kimlik, tekrar: kismi?.kimlik === kimlik ? kismi.tekrar + 1 : 1, zaman: simdi };
  if (kismi.tekrar >= KISMI_KALICI_TEKRAR) onbellek = kimlik;
  return kimlik;
};

export const MAKINE_KIMLIGI_KURALI = /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

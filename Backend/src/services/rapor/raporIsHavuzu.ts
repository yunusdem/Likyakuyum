import { Worker } from "node:worker_threads";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ApiError } from "../../utils/ApiError.js";

/**
 * Rapor PDF / Excel üretimi için küçük iş parçacığı havuzu.
 * pdfkit ve exceljs senkron çalışır; 5.000 satırlık rapor ana süreçte saniyelerce tüm istekleri bekletiyordu.
 * En çok 2 iş parçacığı aynı anda çalışır, fazlası sırada bekler. Boştaki iş parçacığı süreci açık tutmaz.
 * Derlenmiş `dist` içinde `raporIsci.js` kullanılır; geliştirmede (tsx, .ts kaynağı) iş aynı süreçte yapılır.
 */

export type RaporIsTuru = "pdf" | "excel";

const EN_COK_ISCI = 2;
const isciDosyasi = fileURLToPath(new URL("./raporIsci.js", import.meta.url));
const isciVar = !import.meta.url.endsWith(".ts") && existsSync(isciDosyasi);

interface Is { tur: RaporIsTuru; girdi: unknown; coz: (b: Buffer) => void; reddet: (e: unknown) => void }
interface Isci { w: Worker; is?: Is }

const iscilar: Isci[] = [];
const sira: Is[] = [];

/** Aynı süreçte üretim (geliştirme ortamı ya da iş parçacığına aktarılamayan veri). */
async function burada(tur: RaporIsTuru, girdi: any): Promise<Buffer> {
  if (tur === "pdf") return (await import("./raporMotor.js")).raporPdfUret(girdi);
  return (await import("./raporExcel.js")).raporExcelUret(girdi);
}

function isciKur(): Isci {
  const i: Isci = { w: new Worker(isciDosyasi) };
  i.w.unref();
  i.w.on("message", (m: { tamam: true; veri: Uint8Array } | { tamam: false; mesaj: string; durum?: number }) => {
    const is = i.is; i.is = undefined; i.w.unref();
    if (is) {
      if (m.tamam) is.coz(Buffer.from(m.veri.buffer, m.veri.byteOffset, m.veri.byteLength));
      else is.reddet(m.durum ? new ApiError(m.durum as any, m.mesaj) : new Error(m.mesaj));
    }
    dagit();
  });
  const dusur = (e: unknown) => {
    const k = iscilar.indexOf(i); if (k >= 0) iscilar.splice(k, 1);
    const is = i.is; i.is = undefined;
    is?.reddet(e instanceof Error ? e : new Error("Rapor iş parçacığı beklenmedik biçimde kapandı"));
    dagit();
  };
  i.w.on("error", dusur);
  i.w.on("exit", kod => dusur(new Error(`Rapor iş parçacığı kapandı (kod ${kod})`)));
  iscilar.push(i);
  return i;
}

function dagit() {
  while (sira.length) {
    const bos = iscilar.find(i => !i.is) ?? (iscilar.length < EN_COK_ISCI ? isciKur() : undefined);
    if (!bos) return;
    const is = sira.shift()!;
    bos.is = is;
    try {
      bos.w.ref();
      bos.w.postMessage({ tur: is.tur, girdi: is.girdi });
    } catch (e) {
      // Satırlarda aktarılamayan değer (ör. fonksiyon) varsa aynı süreçte üretilir
      bos.is = undefined; bos.w.unref();
      burada(is.tur, is.girdi).then(is.coz, is.reddet);
    }
  }
}

export function raporIsiCalistir(tur: RaporIsTuru, girdi: unknown): Promise<Buffer> {
  if (!isciVar) return burada(tur, girdi);
  return new Promise((coz, reddet) => { sira.push({ tur, girdi, coz, reddet }); dagit(); });
}

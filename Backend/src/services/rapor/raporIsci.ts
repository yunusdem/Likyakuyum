import { parentPort } from "node:worker_threads";
import { raporPdfUret } from "./raporMotor.js";
import { raporExcelUret } from "./raporExcel.js";

/** Rapor iş parçacığı: raporIsHavuzu'ndan gelen PDF / Excel işini üretir, sonucu aktararak geri yollar. */
parentPort?.on("message", async (m: { tur: "pdf" | "excel"; girdi: any }) => {
  try {
    const b = m.tur === "pdf" ? await raporPdfUret(m.girdi) : await raporExcelUret(m.girdi);
    const veri = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    // Buffer havuzdan geliyorsa (küçük çıktı) aktarılamaz; o durumda kopyalanır
    if (b.byteOffset === 0 && b.byteLength === b.buffer.byteLength) parentPort!.postMessage({ tamam: true, veri }, [b.buffer as ArrayBuffer]);
    else parentPort!.postMessage({ tamam: true, veri });
  } catch (e: any) {
    parentPort!.postMessage({ tamam: false, mesaj: String(e?.message || e), durum: e?.statusCode });
  }
});

import { Worker } from "node:worker_threads";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ApiError } from "../../utils/ApiError.js";
const EN_COK_ISCI = 2;
const isciDosyasi = fileURLToPath(new URL("./raporIsci.js", import.meta.url));
const isciVar = !import.meta.url.endsWith(".ts") && existsSync(isciDosyasi);
const iscilar = [];
const sira = [];
/** Aynı süreçte üretim (geliştirme ortamı ya da iş parçacığına aktarılamayan veri). */
async function burada(tur, girdi) {
    if (tur === "pdf")
        return (await import("./raporMotor.js")).raporPdfUret(girdi);
    return (await import("./raporExcel.js")).raporExcelUret(girdi);
}
function isciKur() {
    const i = { w: new Worker(isciDosyasi) };
    i.w.unref();
    i.w.on("message", (m) => {
        const is = i.is;
        i.is = undefined;
        i.w.unref();
        if (is) {
            if (m.tamam)
                is.coz(Buffer.from(m.veri.buffer, m.veri.byteOffset, m.veri.byteLength));
            else
                is.reddet(m.durum ? new ApiError(m.durum, m.mesaj) : new Error(m.mesaj));
        }
        dagit();
    });
    const dusur = (e) => {
        const k = iscilar.indexOf(i);
        if (k >= 0)
            iscilar.splice(k, 1);
        const is = i.is;
        i.is = undefined;
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
        if (!bos)
            return;
        const is = sira.shift();
        bos.is = is;
        try {
            bos.w.ref();
            bos.w.postMessage({ tur: is.tur, girdi: is.girdi });
        }
        catch (e) {
            // Satırlarda aktarılamayan değer (ör. fonksiyon) varsa aynı süreçte üretilir
            bos.is = undefined;
            bos.w.unref();
            burada(is.tur, is.girdi).then(is.coz, is.reddet);
        }
    }
}
export function raporIsiCalistir(tur, girdi) {
    if (!isciVar)
        return burada(tur, girdi);
    return new Promise((coz, reddet) => { sira.push({ tur, girdi, coz, reddet }); dagit(); });
}

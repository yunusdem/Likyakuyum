import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Çalışan programın sürümü. Sürüm paketi (npm run surum:yayinla) uygulama köküne SURUM dosyası yazar
 * (ör. 1.0.0+20261006.1530); yoksa Backend/package.json sürümü kullanılır.
 */
let onbellek: string | null = null;

export const calisanSurum = (): string => {
  if (onbellek) return onbellek;
  const burasi = path.dirname(fileURLToPath(import.meta.url));
  for (const aday of [path.resolve(burasi, "../../SURUM"), path.resolve(burasi, "../../../SURUM"), path.resolve(process.cwd(), "SURUM")]) {
    try {
      const v = fs.readFileSync(aday, "utf8").trim();
      if (v) return (onbellek = v);
    } catch {
      /* sonraki aday */
    }
  }
  for (const aday of [path.resolve(burasi, "../../package.json"), path.resolve(process.cwd(), "package.json")]) {
    try {
      const v = JSON.parse(fs.readFileSync(aday, "utf8")).version;
      if (v) return (onbellek = String(v));
    } catch {
      /* sonraki aday */
    }
  }
  return (onbellek = "0.0.0");
};

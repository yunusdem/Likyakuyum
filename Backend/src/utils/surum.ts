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

/**
 * Çalışan kodun git commit'i (.git/HEAD okunur; git programı gerekmez). Kopya .git içermiyorsa null.
 * Test / canlı ayrımında panel ve sağlık ucu bunu gösterir (docs/CANLI_TEST_AYRIMI_YOL_HARITASI.md).
 */
export const depoKoku = (): string => {
  const burasi = path.dirname(fileURLToPath(import.meta.url));
  // Backend/src/utils ya da Backend/dist/utils → depo kökü
  return path.resolve(burasi, "../../..");
};

export const gitCommit = (kok: string): string | null => {
  try {
    const git = path.join(kok, ".git");
    const head = fs.readFileSync(path.join(git, "HEAD"), "utf8").trim();
    if (!head.startsWith("ref:")) return head || null;
    const ref = head.slice(4).trim();
    try {
      return fs.readFileSync(path.join(git, ref), "utf8").trim() || null;
    } catch {
      const packed = fs.readFileSync(path.join(git, "packed-refs"), "utf8");
      const satir = packed
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.endsWith(" " + ref));
      return satir ? satir.split(" ")[0] : null;
    }
  } catch {
    return null;
  }
};

let commitOnbellek: string | null | undefined;
export const calisanCommit = (): string | null => {
  if (commitOnbellek !== undefined) return commitOnbellek;
  return (commitOnbellek = gitCommit(depoKoku()));
};

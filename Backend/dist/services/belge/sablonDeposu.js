import { readFile, readdir, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import { firmaKlasoru, firmaKoku, guvenliBirlestir, zamanDamgasi } from "../firmaKlasoru.js";
import { sablonOku } from "./belgeMotor.js";
import { FIS_TURLERI } from "./belgeTurleri.js";
import { sablonDenetle } from "./sablonDenetim.js";
/**
 * Firmanın fiş şablonları (docs/FIS_TASARIM_YOL_HARITASI.md, K5–K6): firma klasöründe `Sablonlar\{TUR}.json`,
 * önceki sürümler `Sablonlar\eski\{TUR}_{zaman}.json`. Firma şablonu yoksa (ya da bozulmuşsa) bizim varsayılanımız
 * kullanılır. Firma klasörü her firmaya ayrı olduğundan şablon başka firmaya geçmez.
 */
export const SURUM_AZAMI = 30;
/** Okuma yolları klasör oluşturmaz (her fiş basımında okunur); yazma yolları oluşturur. */
const okunanYol = async (ctx, ...parca) => guvenliBirlestir((await firmaKoku(ctx)).yol, "Sablonlar", ...parca);
const etkinYol = (ctx, tur) => okunanYol(ctx, `${tur}.json`);
const eskiKlasor = (ctx) => okunanYol(ctx, "eski");
const yazilanEtkinYol = async (ctx, tur) => guvenliBirlestir(await firmaKlasoru(ctx, "Sablonlar"), `${tur}.json`);
const yazilanEskiKlasor = (ctx) => firmaKlasoru(ctx, "Sablonlar", "eski");
export const varsayilanSablon = (tur) => sablonOku(FIS_TURLERI[tur].varsayilan);
async function dosyaOku(yol) {
    try {
        return await readFile(yol, "utf8");
    }
    catch (e) {
        if (e?.code === "ENOENT")
            return null;
        throw e;
    }
}
/** Etkin şablon: firma şablonu geçerliyse o, değilse varsayılan. Bozuk firma dosyası fişi durdurmaz (günlüğe yazılır). */
export async function etkinSablon(tur, ctx) {
    const varsayilan = varsayilanSablon(tur);
    let ham = null;
    try {
        ham = await dosyaOku(await etkinYol(ctx, tur));
    }
    catch (e) {
        logger.warn(`Şablon: ${tur} firma şablonu okunamadı, varsayılan kullanılıyor. ${e?.message || e}`);
    }
    if (ham === null)
        return { sablon: varsayilan, kaynak: "VARSAYILAN" };
    const d = sablonDenetle(ham, tur, varsayilan);
    if (!d.gecerli || !d.sablon) {
        const uyari = `Firma şablonu geçersiz, varsayılan kullanıldı: ${d.hatalar.slice(0, 3).map(h => h.mesaj).join(" · ")}`;
        logger.warn(`Şablon: ${tur} ${uyari}`);
        return { sablon: varsayilan, kaynak: "VARSAYILAN", uyari };
    }
    return { sablon: d.sablon, kaynak: "FIRMA" };
}
/** Etkin firma şablonunu sürüm klasörüne taşır (yoksa bir şey yapmaz); en eski sürümler silinir. */
async function surumle(tur, ctx) {
    const etkin = await etkinYol(ctx, tur);
    try {
        await stat(etkin);
    }
    catch {
        return null;
    }
    const klasor = await yazilanEskiKlasor(ctx);
    let ad = `${tur}_${zamanDamgasi()}.json`;
    for (let i = 2; await stat(path.join(klasor, ad)).then(() => true, () => false); i++)
        ad = `${tur}_${zamanDamgasi()}_${i}.json`;
    await rename(etkin, guvenliBirlestir(klasor, ad));
    const fazla = (await surumler(tur, ctx)).slice(SURUM_AZAMI);
    for (const s of fazla)
        await unlink(guvenliBirlestir(klasor, s.ad)).catch(() => undefined);
    return ad;
}
/** Firmanın şablonunu kaydeder (önceki sürüm saklanır). Şablon önceden denetlenmiş olmalı. */
export async function sablonKaydet(tur, sablon, ctx) {
    const oncekiSurum = await surumle(tur, ctx);
    await writeFile(await yazilanEtkinYol(ctx, tur), JSON.stringify(sablon, null, 2), "utf8");
    return { oncekiSurum };
}
/** Varsayılana döner: firma şablonu sürüme taşınır, etkin dosya kalmaz. */
export async function varsayilanaDon(tur, ctx) {
    return { oncekiSurum: await surumle(tur, ctx) };
}
/** Sürümler, yeniden eskiye. */
export async function surumler(tur, ctx) {
    const klasor = await eskiKlasor(ctx);
    const adlar = (await readdir(klasor).catch(() => [])).filter(a => a.startsWith(`${tur}_`) && a.endsWith(".json"));
    const liste = [];
    for (const ad of adlar) {
        try {
            const st = await stat(path.join(klasor, ad));
            liste.push({ ad, tarih: st.mtime.toISOString(), boyut: st.size });
        }
        catch { /* atla */ }
    }
    return liste.sort((a, b) => b.ad.localeCompare(a.ad));
}
/**
 * Önceki sürüme döner: verilen sürüm (yoksa en yenisi) etkin olur, şu anki etkin şablon sürümlere taşınır.
 * Geri alınan sürüm de denetlenir (eski kuralla kaydedilmiş geçersiz sürüm etkinleşmez).
 */
export async function surumeDon(tur, surumAdi, ctx) {
    const liste = await surumler(tur, ctx);
    const hedef = surumAdi ? liste.find(s => s.ad === surumAdi) : liste[0];
    if (!hedef)
        throw ApiError.notFound(surumAdi ? `Sürüm bulunamadı: ${surumAdi}` : "Önceki sürüm yok.");
    const klasor = await eskiKlasor(ctx);
    const ham = await readFile(guvenliBirlestir(klasor, hedef.ad), "utf8");
    const d = sablonDenetle(ham, tur, varsayilanSablon(tur));
    if (!d.gecerli || !d.sablon)
        throw ApiError.badRequest(`Bu sürüm geçerli değil: ${d.hatalar.slice(0, 3).map(h => h.mesaj).join(" · ")}`);
    await sablonKaydet(tur, d.sablon, ctx);
    await unlink(guvenliBirlestir(klasor, hedef.ad)).catch(() => undefined);
    return { surum: hedef.ad };
}
export async function sablonVarMi(tur, ctx) {
    try {
        const st = await stat(await etkinYol(ctx, tur));
        return { var: true, tarih: st.mtime.toISOString() };
    }
    catch {
        return { var: false, tarih: null };
    }
}

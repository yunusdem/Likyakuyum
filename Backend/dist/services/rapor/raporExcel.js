import ExcelJS from "exceljs";
import { bicimle, bolumlereAyir, baslikMetni, etkinGruplar, genelToplamVar, netMetni, veriSatirlari } from "./raporMotor.js";
import { raporIsiCalistir } from "./raporIsHavuzu.js";
/** Excel'i ayrı iş parçacığında üretir (büyük raporda ana süreci bekletmesin). */
export async function raporExcel(p) {
    return raporIsiCalistir("excel", p);
}
/** Asıl Excel üretimi (iş parçacığında ya da yedek olarak aynı süreçte çalışır). */
export async function raporExcelUret(p) {
    const wb = new ExcelJS.Workbook();
    wb.creator = p.firma.ad || "Kuyumcu ERP";
    const ws = wb.addWorksheet(p.tanim.ad.replace(/[*?:\/\[\]]/g, "-").slice(0, 31), { views: [{ state: "frozen", ySplit: 4 }] });
    const kolonlar = p.tanim.kolonlar;
    ws.mergeCells(1, 1, 1, kolonlar.length);
    ws.getCell(1, 1).value = `${p.firma.ad}${p.firma.vkn ? " · VKN " + p.firma.vkn : ""} — ${p.tanim.ad}`;
    ws.getCell(1, 1).font = { bold: true, size: 13 };
    ws.mergeCells(2, 1, 2, kolonlar.length);
    ws.getCell(2, 1).value = p.filtreOzeti || "";
    ws.getCell(2, 1).font = { italic: true, color: { argb: "FF555555" } };
    const baslikSatiri = ws.getRow(4);
    kolonlar.forEach((k, i) => {
        const c = baslikSatiri.getCell(i + 1);
        c.value = k.baslik;
        c.font = { bold: true };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9ECEF" } };
        c.border = { bottom: { style: "thin" } };
        ws.getColumn(i + 1).width = Math.max(10, Math.min(45, (k.g || 1) * 6));
        const sayisal = ["sayi", "sayi4", "kur", "tam"].includes(k.bicim || "");
        if (sayisal)
            ws.getColumn(i + 1).numFmt = k.bicim === "sayi4" ? "#,##0.0000" : k.bicim === "kur" ? "#,##0.00###" : k.bicim === "tam" ? "#,##0" : "#,##0.00";
        if (k.bicim === "tarih")
            ws.getColumn(i + 1).numFmt = "dd.mm.yyyy";
        if (k.bicim === "tarihSaat")
            ws.getColumn(i + 1).numFmt = "dd.mm.yyyy hh:mm";
        ws.getColumn(i + 1).alignment = { horizontal: k.hiza || (sayisal ? "right" : "left") };
    });
    let r = 5;
    const yaz = (satir, kalin = false) => {
        const row = ws.getRow(r++);
        kolonlar.forEach((k, i) => {
            const v = satir[k.anahtar];
            const c = row.getCell(i + 1);
            if (["sayi", "sayi4", "kur", "tam"].includes(k.bicim || ""))
                c.value = v === null || v === undefined || v === "" ? null : Number(v);
            else if (k.bicim === "tarih" || k.bicim === "tarihSaat") {
                const d = v ? new Date(v) : null;
                c.value = d && !Number.isNaN(d.getTime()) ? d : (v ? String(v) : null);
            }
            else if (k.bicim === "saat")
                c.value = bicimle(v, "saat");
            else
                c.value = v === null || v === undefined ? "" : (typeof v === "string" ? v : bicimle(v, k.bicim));
            if (kalin)
                c.font = { bold: true };
        });
    };
    const SAYISAL = ["sayi", "sayi4", "kur", "tam"];
    const sayiBicimi = (b) => (b === "sayi4" ? "#,##0.0000" : b === "kur" ? "#,##0.00###" : b === "tam" ? "#,##0" : "#,##0.00");
    const toplam = (satirlar, etiket) => {
        const t = {};
        let etiketli = false;
        for (const k of kolonlar) {
            if (k.toplam)
                t[k.anahtar] = satirlar.reduce((s, x) => s + (Number(x[k.anahtar]) || 0), 0);
            else if (!etiketli && ![...SAYISAL, "tarih", "tarihSaat", "saat"].includes(k.bicim || "")) {
                t[k.anahtar] = etiket;
                etiketli = true;
            }
        }
        if (!etiketli)
            t[kolonlar[0].anahtar] = etiket;
        yaz(t, true);
    };
    /** Tüm kolonlara yayılan tek hücreli satır (grup başlığı, alt başlık, net satırı) */
    const tamSatir = (metin, o = {}) => {
        const row = ws.getRow(r++);
        ws.mergeCells(row.number, 1, row.number, kolonlar.length);
        const c = row.getCell(1);
        c.value = metin;
        c.font = { bold: o.kalin !== false, italic: !!o.italik, ...(o.boyut ? { size: o.boyut } : {}), ...(o.renk ? { color: { argb: o.renk } } : {}) };
        c.alignment = { horizontal: o.hiza || "left" };
        if (o.zemin)
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: o.zemin } };
    };
    /** Alt tablo (Crystal alt raporu): ikinci sütundan başlayarak kendi başlıkları ve satırlarıyla; hücre biçimi tek tek verilir (sütun biçimini devralmasın) */
    const altTablo = (alt, altSatirlar) => {
        const ks = alt.kolonlar;
        if (!ks.length || !altSatirlar.length)
            return;
        const hucreYaz = (c, v, k, kalin) => {
            if (SAYISAL.includes(k.bicim || "")) {
                c.value = v === null || v === undefined || v === "" ? null : Number(v);
                c.numFmt = sayiBicimi(k.bicim);
                c.alignment = { horizontal: k.hiza || "right" };
            }
            else {
                c.value = v === null || v === undefined ? "" : bicimle(v, k.bicim);
                c.numFmt = "@";
                c.alignment = { horizontal: k.hiza || "left" };
            }
            c.font = { size: 9, bold: kalin, color: { argb: "FF333333" } };
        };
        if (alt.baslik) {
            const row = ws.getRow(r++);
            const c = row.getCell(2);
            c.value = alt.baslik;
            c.numFmt = "@";
            c.font = { size: 9, bold: true, italic: true };
            c.alignment = { horizontal: "left" };
        }
        const bas = ws.getRow(r++);
        ks.forEach((k, i) => {
            const c = bas.getCell(i + 2);
            c.value = k.baslik;
            c.numFmt = "@";
            c.font = { size: 9, bold: true, color: { argb: "FF555555" } };
            c.alignment = { horizontal: k.hiza || (SAYISAL.includes(k.bicim || "") ? "right" : "left") };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
        });
        for (const s of altSatirlar) {
            const row = ws.getRow(r++);
            // Alt başlık satırı (Döviz / Kuyum): kalın, bantlı, yalnız ilk hücrede metin
            if (s._stil === "baslik") {
                ks.forEach((_k, i) => {
                    const c = row.getCell(i + 2);
                    c.value = i === 0 ? baslikMetni(s, ks) : "";
                    c.numFmt = "@";
                    c.font = { size: 9, bold: true };
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4E8EE" } };
                });
                continue;
            }
            ks.forEach((k, i) => hucreYaz(row.getCell(i + 2), s[k.anahtar], k, false));
        }
        altSatirlar = veriSatirlari(altSatirlar);
        if (ks.some(k => k.toplam)) {
            const row = ws.getRow(r++);
            let etiketli = false;
            ks.forEach((k, i) => {
                const c = row.getCell(i + 2);
                if (k.toplam)
                    hucreYaz(c, altSatirlar.reduce((t, s) => t + (Number(s[k.anahtar]) || 0), 0), k, true);
                else if (!etiketli && !SAYISAL.includes(k.bicim || "")) {
                    c.value = alt.toplamEtiketi || "Toplam";
                    c.numFmt = "@";
                    c.font = { size: 9, bold: true };
                    c.alignment = { horizontal: "left" };
                    etiketli = true;
                }
            });
        }
    };
    const doldur = (sablon, satir) => sablon.replace(/\{\{\s*([\w.]+)\s*(?:\|\w+)?\s*\}\}/g, (_m, yol) => String(satir[yol] ?? ""));
    /** Ana tablo satırı: alt başlık / veri satırı (+ satır altı tablo) */
    const veriSatiri = (s) => {
        if (s._stil === "baslik") {
            tamSatir(baslikMetni(s, kolonlar), { zemin: "FFE4E8EE" });
            return;
        }
        yaz(s);
        if (p.tanim.altTablo && Array.isArray(s._alt) && s._alt.length)
            altTablo(p.tanim.altTablo, s._alt);
    };
    const gruplar = etkinGruplar(p.tanim, p.gruplar);
    const toplamVar = kolonlar.some(k => k.toplam);
    /** Gövde: gruplar iç içe (dıştan içe); her seviyede başlık + alt seviye + ara toplam (+ net satırı) — PDF ile aynı kural */
    const govde = (satirlar, seviye = 0) => {
        const grup = gruplar[seviye];
        if (!grup) {
            for (const s of satirlar)
                veriSatiri(s);
            return;
        }
        let i = 0;
        while (i < satirlar.length) {
            const anahtar = satirlar[i][grup.anahtar];
            const uyeler = [];
            while (i < satirlar.length && satirlar[i][grup.anahtar] === anahtar)
                uyeler.push(satirlar[i++]);
            const ornek = uyeler.find(s => s._stil !== "baslik") || uyeler[0];
            tamSatir(`${"   ".repeat(seviye)}${doldur(grup.baslik, ornek)}`, { zemin: seviye === 0 ? "FFF3F4F6" : "FFF8F9FA" });
            if (grup.altBaslik) {
                const alt = doldur(grup.altBaslik, ornek).trim();
                if (alt)
                    tamSatir(alt, { kalin: false, italik: true, boyut: 9, renk: "FF555555" });
            }
            govde(uyeler, seviye + 1);
            const gat = p.tanim.grupAltTablo;
            if (gat && (gat.seviye ?? 0) === seviye) {
                const alt = p.grupAltSatirlar?.[String(anahtar)];
                if (alt?.length)
                    altTablo(gat, alt);
            }
            if (grup.altToplam !== false && toplamVar) {
                const e = doldur(grup.toplamEtiketi || "Ara toplam", ornek);
                toplam(uyeler, /\(\d/.test(e) ? e : `${e} (${veriSatirlari(uyeler).length})`);
            } // etiket sayı taşıyorsa ("(1 fiş)") satır sayısı eklenmez
            if (grup.net)
                tamSatir(netMetni(grup.net, uyeler), { hiza: "right" });
        }
    };
    // Bölümler (sektör / para grubu): birden fazla bölüm varsa başlık satırı + gövde + bölüm toplamı (PDF ile aynı kural)
    for (const b of bolumlereAyir(p.tanim, p.satirlar)) {
        if (b.baslik)
            tamSatir(b.baslik, { boyut: 12, zemin: "FFDDE3EA" });
        govde(b.satirlar);
        if (b.baslik && p.tanim.bolum?.altToplam !== false && toplamVar)
            toplam(b.satirlar, `${b.baslik} toplamı`);
    }
    const veri = veriSatirlari(p.satirlar);
    if (genelToplamVar(p.tanim, gruplar) && toplamVar)
        toplam(veri, `GENEL TOPLAM (${veri.length} kayıt)`);
    if (p.tanim.net && veri.length)
        tamSatir(netMetni(p.tanim.net, veri), { hiza: "right" });
    // Özet bölümü ayrı sayfada (kolonları farklı olduğu için ana sayfanın sütun biçimlerini bozmaz)
    if (p.tanim.ozet && p.ozetSatirlar?.length) {
        const oz = p.tanim.ozet, ws2 = wb.addWorksheet("Özet", { views: [{ state: "frozen", ySplit: 3 }] });
        const say = (b) => ["sayi", "sayi4", "kur", "tam"].includes(b || "");
        ws2.mergeCells(1, 1, 1, oz.kolonlar.length);
        ws2.getCell(1, 1).value = `${p.tanim.ad} — ${oz.baslik}`;
        ws2.getCell(1, 1).font = { bold: true, size: 12 };
        oz.kolonlar.forEach((k, i) => {
            const c = ws2.getRow(3).getCell(i + 1);
            c.value = k.baslik;
            c.font = { bold: true };
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9ECEF" } };
            c.border = { bottom: { style: "thin" } };
            ws2.getColumn(i + 1).width = Math.max(10, Math.min(45, (k.g || 1) * 6));
            if (say(k.bicim))
                ws2.getColumn(i + 1).numFmt = k.bicim === "sayi4" ? "#,##0.0000" : k.bicim === "kur" ? "#,##0.00###" : k.bicim === "tam" ? "#,##0" : "#,##0.00";
            ws2.getColumn(i + 1).alignment = { horizontal: k.hiza || (say(k.bicim) ? "right" : "left") };
        });
        let r2 = 4;
        const yaz2 = (satir, kalin = false) => {
            const row = ws2.getRow(r2++);
            oz.kolonlar.forEach((k, i) => {
                const v = satir[k.anahtar], c = row.getCell(i + 1);
                c.value = say(k.bicim) ? (v === null || v === undefined || v === "" ? null : Number(v)) : (v === null || v === undefined ? "" : String(v));
                if (kalin)
                    c.font = { bold: true };
            });
        };
        for (const s of p.ozetSatirlar) {
            if (s._stil !== "baslik") {
                yaz2(s);
                continue;
            }
            const row = ws2.getRow(r2++);
            ws2.mergeCells(row.number, 1, row.number, oz.kolonlar.length);
            row.getCell(1).value = baslikMetni(s, oz.kolonlar);
            row.getCell(1).font = { bold: true };
            row.getCell(1).alignment = { horizontal: "left" };
            row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4E8EE" } };
        }
        if (oz.kolonlar.some(k => k.toplam)) {
            const t = { [oz.kolonlar[0].anahtar]: "TOPLAM" };
            for (const k of oz.kolonlar)
                if (k.toplam)
                    t[k.anahtar] = p.ozetSatirlar.reduce((a, x) => a + (Number(x[k.anahtar]) || 0), 0);
            yaz2(t, true);
        }
    }
    const dipnot = [p.tanim.dipnot, p.ekDipnot].filter(Boolean).join("\n");
    r++;
    if (dipnot) {
        ws.mergeCells(r, 1, r, kolonlar.length);
        ws.getCell(r, 1).value = dipnot;
        ws.getCell(r, 1).alignment = { wrapText: true };
        ws.getCell(r, 1).font = { size: 9, color: { argb: "FF555555" } };
        r++;
    }
    ws.mergeCells(r, 1, r, kolonlar.length);
    ws.getCell(r, 1).value = `Yazdıran: ${p.kullanici} · ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false })}`;
    ws.getCell(r, 1).font = { size: 9, color: { argb: "FF777777" } };
    return Buffer.from(await wb.xlsx.writeBuffer());
}

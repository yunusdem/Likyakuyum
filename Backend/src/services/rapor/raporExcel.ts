import ExcelJS from "exceljs";
import type { RaporTanim, RaporFirma } from "./raporTanim.js";
import { bicimle } from "./raporMotor.js";

/**
 * Aynı rapor tanımı ve satırlardan Excel (.xlsx) üretir (yönetici kararı F1).
 * Sayısal kolonlar sayı olarak yazılır (Excel'de toplanabilir); tarih kolonları tarih olarak.
 */
export async function raporExcel(p: { tanim: RaporTanim; satirlar: Record<string, any>[]; filtreOzeti: string; firma: RaporFirma; kullanici: string; ekDipnot?: string }): Promise<Buffer> {
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
    c.value = k.baslik; c.font = { bold: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9ECEF" } };
    c.border = { bottom: { style: "thin" } };
    ws.getColumn(i + 1).width = Math.max(10, Math.min(45, (k.g || 1) * 6));
    const sayisal = ["sayi", "sayi4", "kur", "tam"].includes(k.bicim || "");
    if (sayisal) ws.getColumn(i + 1).numFmt = k.bicim === "sayi4" ? "#,##0.0000" : k.bicim === "kur" ? "#,##0.00###" : k.bicim === "tam" ? "#,##0" : "#,##0.00";
    if (k.bicim === "tarih") ws.getColumn(i + 1).numFmt = "dd.mm.yyyy";
    if (k.bicim === "tarihSaat") ws.getColumn(i + 1).numFmt = "dd.mm.yyyy hh:mm";
    ws.getColumn(i + 1).alignment = { horizontal: k.hiza || (sayisal ? "right" : "left") };
  });

  let r = 5;
  const yaz = (satir: Record<string, any>, kalin = false) => {
    const row = ws.getRow(r++);
    kolonlar.forEach((k, i) => {
      const v = satir[k.anahtar];
      const c = row.getCell(i + 1);
      if (["sayi", "sayi4", "kur", "tam"].includes(k.bicim || "")) c.value = v === null || v === undefined || v === "" ? null : Number(v);
      else if (k.bicim === "tarih" || k.bicim === "tarihSaat") { const d = v ? new Date(v) : null; c.value = d && !Number.isNaN(d.getTime()) ? d : (v ? String(v) : null); }
      else c.value = v === null || v === undefined ? "" : (typeof v === "string" ? v : bicimle(v, k.bicim));
      if (kalin) c.font = { bold: true };
    });
  };
  const toplam = (satirlar: Record<string, any>[], etiket: string) => {
    const t: Record<string, any> = {}; let etiketli = false;
    for (const k of kolonlar) {
      if (k.toplam) t[k.anahtar] = satirlar.reduce((s, x) => s + (Number(x[k.anahtar]) || 0), 0);
      else if (!etiketli && !["sayi", "sayi4", "kur", "tam", "tarih", "tarihSaat"].includes(k.bicim || "")) { t[k.anahtar] = etiket; etiketli = true; }
    }
    if (!etiketli) t[kolonlar[0].anahtar] = etiket;
    yaz(t, true);
  };

  if (p.tanim.grup) {
    const grup = p.tanim.grup; let i = 0;
    while (i < p.satirlar.length) {
      const anahtar = p.satirlar[i][grup.anahtar]; const uyeler: Record<string, any>[] = [];
      while (i < p.satirlar.length && p.satirlar[i][grup.anahtar] === anahtar) uyeler.push(p.satirlar[i++]);
      const row = ws.getRow(r++); ws.mergeCells(row.number, 1, row.number, kolonlar.length);
      row.getCell(1).value = grup.baslik.replace(/\{\{\s*([\w.]+)\s*(?:\|\w+)?\s*\}\}/g, (_m, yol) => String(uyeler[0][yol] ?? ""));
      row.getCell(1).font = { bold: true }; row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
      for (const s of uyeler) yaz(s);
      if (grup.altToplam !== false && kolonlar.some(k => k.toplam)) toplam(uyeler, `Ara toplam (${uyeler.length})`);
    }
  } else for (const s of p.satirlar) yaz(s);
  if (kolonlar.some(k => k.toplam)) toplam(p.satirlar, `GENEL TOPLAM (${p.satirlar.length} kayıt)`);

  const dipnot = [p.tanim.dipnot, p.ekDipnot].filter(Boolean).join("\n");
  r++;
  if (dipnot) { ws.mergeCells(r, 1, r, kolonlar.length); ws.getCell(r, 1).value = dipnot; ws.getCell(r, 1).alignment = { wrapText: true }; ws.getCell(r, 1).font = { size: 9, color: { argb: "FF555555" } }; r++; }
  ws.mergeCells(r, 1, r, kolonlar.length);
  ws.getCell(r, 1).value = `Yazdıran: ${p.kullanici} · ${new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", hour12: false })}`;
  ws.getCell(r, 1).font = { size: 9, color: { argb: "FF777777" } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

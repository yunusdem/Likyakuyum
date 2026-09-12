import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ApiError } from '../utils/ApiError.js';
import type { EDovizGirdi, EDovizTaraf } from './ice/ice.edoviz.js';

/** Türkçe destekli TTF yazı tipi; kalın varyant yoksa normal kullanılır. */
function yaziTipleri(): { normal: string; kalin: string } {
  const adaylar = [process.env.EBELGE_PDF_FONT,
    path.join(process.env.WINDIR || 'C:/Windows', 'Fonts', 'arial.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'];
  const normal = adaylar.find((f): f is string => !!f && existsSync(f));
  if (!normal) throw ApiError.badRequest('PDF yazı tipi bulunamadı. Sunucuda EBELGE_PDF_FONT ile Türkçe destekli bir TTF yazı tipi tanımlayın.');
  const kalinAday = [process.env.EBELGE_PDF_FONT_BOLD,
    path.join(process.env.WINDIR || 'C:/Windows', 'Fonts', 'arialbd.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf'].find((f): f is string => !!f && existsSync(f));
  return { normal, kalin: kalinAday || normal };
}

const trSayi = (n: number, basamak = 2) => n.toLocaleString('tr-TR', { minimumFractionDigits: basamak, maximumFractionDigits: basamak });

/** Tutarı ICE belgesindeki gibi yazıyla verir: "YÜZKIRKBEŞ TL ELLİİKİ KR." */
export function tutarYaziyla(tutar: number, paraAdi = 'TL', kurusAdi = 'KR.'): string {
  const birler = ['', 'BİR', 'İKİ', 'ÜÇ', 'DÖRT', 'BEŞ', 'ALTI', 'YEDİ', 'SEKİZ', 'DOKUZ'];
  const onlar = ['', 'ON', 'YİRMİ', 'OTUZ', 'KIRK', 'ELLİ', 'ALTMIŞ', 'YETMİŞ', 'SEKSEN', 'DOKSAN'];
  const uclu = (n: number): string => {
    const y = Math.floor(n / 100), o = Math.floor((n % 100) / 10), b = n % 10;
    return (y ? (y === 1 ? 'YÜZ' : birler[y] + 'YÜZ') : '') + onlar[o] + birler[b];
  };
  const tam = (n: number): string => {
    if (n === 0) return 'SIFIR';
    const gruplar = ['', 'BİN', 'MİLYON', 'MİLYAR', 'TRİLYON'];
    let s = '', i = 0;
    while (n > 0 && i < gruplar.length) {
      const k = n % 1000;
      if (k) s = (k === 1 && i === 1 ? '' : uclu(k)) + gruplar[i] + s;
      n = Math.floor(n / 1000); i++;
    }
    return s;
  };
  const lira = Math.floor(Math.abs(tutar));
  const kurus = Math.round((Math.abs(tutar) - lira) * 100);
  return `${tam(lira)} ${paraAdi}${kurus ? ` ${tam(kurus)} ${kurusAdi}` : ''}`;
}

export interface EDovizBelgePdfEk {
  /** ICE hesabının VKN'si; erişim adresi (ebelge.iceteknoloji.com.tr/edoviz/ettn/{vkn}/{ettn}) için. */
  hesapVkn?: string;
  /** ICE'ye gönderilmemiş fişte önizleme olduğu belirtilir. */
  onizleme?: boolean;
}

/**
 * e-Döviz belgesini ICE'nin resmî çıktısıyla aynı düzende üretir:
 * üstte Alan Kişi / Düzenleyen Yetkili / Belge Bilgileri kutuları, başlık ve ETTN,
 * "satılan/satın alınan dövize ait bilgiler" tablosu, yazıyla tutar, vezne/uyruk ve
 * ICE erişim adresi. Veri, ICE'ye gönderilen girdiyle birebir aynıdır.
 */
export function eDovizBelgePdf(g: EDovizGirdi, ek: EDovizBelgePdfEk = {}): Promise<Buffer> {
  const font = yaziTipleri();
  const satim = g.creditNoteTypeCode === 'DOVIZSATIMBELGESI';
  const tipAdi = satim ? 'SATIM' : 'ALIM';
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 28, info: { Title: `${g.belgeNo} - e-Döviz ${tipAdi} belgesi` } });
    const chunks: Buffer[] = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const sol = doc.page.margins.left, genislik = doc.page.width - sol - doc.page.margins.right;
    const kutuG = (genislik - 16) / 3, kutuY = 28, kutuH = 190;
    const N = () => doc.font(font.normal), K = () => doc.font(font.kalin);

    const kutu = (x: number, baslik: string, satirlar: string[]) => {
      doc.rect(x, kutuY, kutuG, kutuH).lineWidth(0.6).strokeColor('#333').stroke();
      K().fontSize(8).fillColor('#000').text(baslik, x + 5, kutuY + 5, { width: kutuG - 10 });
      N().fontSize(7.2);
      let y = kutuY + 18;
      for (const s of satirlar) {
        doc.text(s, x + 5, y, { width: kutuG - 10, lineBreak: true });
        y += doc.heightOfString(s, { width: kutuG - 10 }) + 1.5;
        if (y > kutuY + kutuH - 8) break;
      }
    };
    const taraf = (t: EDovizTaraf, musteri: boolean): string[] => {
      const adSoyad = [t.ad, t.soyad].filter(Boolean).join(' ');
      return [
        t.unvan || adSoyad || '-',
        ...(musteri && adSoyad && adSoyad !== t.unvan ? [adSoyad] : []),
        `${t.adres || ''}`,
        `${t.ilce || ''}/ ${t.sehir || ''}`,
        `Tel: ${t.telefon || ''}   Fax:`,
        ...(musteri ? [] : ['Web Sitesi:']),
        `E-Posta: ${t.eposta || ''}`,
        `Vergi Dairesi: ${t.vergiDairesi || ''}`,
        ...(t.vknTckn ? [`${t.vknTckn.length === 11 ? 'TCKN' : 'VKN'}: ${t.vknTckn}`] : []),
        ...(musteri && t.pasaportNo ? [`Pasaport No: ${t.pasaportNo}`] : []),
        ...(musteri && t.musteriTuru ? [`MUSTERITURU: ${t.musteriTuru}`] : []),
        ...(!musteri && t.ticaretSicilNo ? [`TICARETSICILNO: ${t.ticaretSicilNo}`] : []),
      ];
    };
    const saat = (() => { const d = new Date(g.duzenlemeSaati); return Number.isNaN(d.getTime()) ? '' :
      d.toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour12: false }); })();
    const tarih = (() => { const d = new Date(g.duzenlemeTarihi); return Number.isNaN(d.getTime()) ? '' :
      d.toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }); })();

    kutu(sol, 'ALAN KİŞİ/KURULUŞ', taraf(g.musteri, true));
    kutu(sol + kutuG + 8, 'DÜZENLEYEN YETKİLİ', taraf(g.yetkiliMuessese, false));
    kutu(sol + 2 * (kutuG + 8), 'BELGE BİLGİLERİ', [
      `Belge No: ${g.belgeNo}`,
      `Oluşturma Tarihi: ${tarih}`,
      `Oluşturma Zamanı: ${saat}`,
      `Dosya/Şube: ${g.odeme.yetkiliMuesseseDosyaNo || ''}`,
      `İstatistik No: ${g.istatistikNo || ''}`,
      `Senaryo: ${g.profileId}`,
      `Tip: ${tipAdi}`,
    ]);

    let y = kutuY + kutuH + 14;
    K().fontSize(11).fillColor('#000').text(`e-DÖVİZ ve KIYMETLİ MADEN ${tipAdi} BELGESİ`, sol, y, { width: genislik, align: 'center' });
    y += 16;
    N().fontSize(8).text(`ETTN: ${g.uuid}`, sol, y, { width: genislik, align: 'center' });
    if (ek.onizleme) { y += 12; doc.fillColor('#8a1c1c').text('ÖNİZLEME — ICE onaylı belge değildir', sol, y, { width: genislik, align: 'center' }); doc.fillColor('#000'); }
    y += 20;

    // Tablo: ICE çıktısındaki satır sırası birebir.
    const t = g.tutar;
    const usdKarsiligi = t.miktar * (t.dolarKarsilikKuru || 0);
    const satirlar: [string, string][] = [
      [satim ? 'Satılan Ürün' : 'Satın Alınan Ürün', `${t.kod} — ${satim ? 'DÖVİZ SATIŞ' : 'DÖVİZ ALIŞ'}`],
      ['Döviz/Kıymetli Maden Miktarı', trSayi(t.miktar)],
      ['Döviz/Kıymetli Maden Cinsi', t.kod],
      ['Uygulanan Kur', trSayi(t.tlKarsilikKuru, 4)],
      ['ABD Doları Karşılığı', `${trSayi(usdKarsiligi)} USD`],
      ['TL Karşılığı', `${trSayi(t.lineExtensionAmount)} TL`],
      ['BSMV', `${trSayi(t.vergiTutari)} TL`],
      ['NET TUTAR', `${trSayi(t.taxInclusiveAmount)} TL`],
    ];
    K().fontSize(8.5).text(`${satim ? 'SATILAN' : 'SATIN ALINAN'} DÖVİZE/KIYMETLİ MADENE AİT BİLGİLER`, sol, y, { width: genislik });
    y += 14;
    const etiketG = 200, satirH = 15;
    for (const [etiket, deger] of satirlar) {
      doc.rect(sol, y, genislik, satirH).lineWidth(0.4).strokeColor('#555').stroke();
      doc.moveTo(sol + etiketG, y).lineTo(sol + etiketG, y + satirH).stroke();
      (etiket === 'NET TUTAR' ? K() : N()).fontSize(8).fillColor('#000').text(etiket, sol + 4, y + 3.5, { width: etiketG - 8 });
      (etiket === 'NET TUTAR' ? K() : N()).text(deger, sol + etiketG + 4, y + 3.5, { width: genislik - etiketG - 8, align: 'right' });
      y += satirH;
    }
    y += 10;
    N().fontSize(8).text(`Yalnız: ${tutarYaziyla(t.taxInclusiveAmount)}`, sol, y, { width: genislik }); y += 12;
    doc.text(`VEZNE : ${g.ekBilgiler?.vezne || ''}`, sol, y, { width: genislik }); y += 12;
    doc.text(`Uyruk : ${g.musteri.ulke || ''}`, sol, y, { width: genislik }); y += 16;
    if (ek.hesapVkn && g.uuid) {
      doc.fillColor('#333').text(
        `e-Döviz ve Kıymetli Maden belgesine http://ebelge.iceteknoloji.com.tr/edoviz/ettn/${ek.hesapVkn}/${g.uuid} adresinden erişebilirsiniz.`,
        sol, y, { width: genislik });
    }
    doc.end();
  });
}

export interface KaynakFisDetay {
  belgeNo: string; tarih: string; unvan: string; tur: string; paraBirimi: string; tutar: number;
  ettn: string; durum: number; firma: string; vergiKimlikNo: string;
  satirlar: { ad: string; miktar: number; kur?: number; tutar: number; kdv?: number }[];
}

/** Kaydedilmiş fişin PDF önizlemesi. ICE doğrulaması veya gönderimi yapmaz. */
export function kaynakFisPdf(fis: KaynakFisDetay): Promise<Buffer> {
  const font = [process.env.EBELGE_PDF_FONT,
    path.join(process.env.WINDIR || 'C:/Windows', 'Fonts', 'arial.ttf'),
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
  ].find((f): f is string => !!f && existsSync(f));
  if (!font) throw ApiError.badRequest('PDF yazı tipi bulunamadı. Sunucuda EBELGE_PDF_FONT ile Türkçe destekli bir TTF yazı tipi tanımlayın.');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: `${fis.belgeNo} - Fiş önizlemesi` } });
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font(font);
    const para = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${fis.paraBirimi}`;
    doc.fontSize(17).fillColor('#31333a').text(fis.firma || fis.tur);
    doc.moveDown(0.5).fontSize(12).text(`${fis.tur} — Fiş önizlemesi`);
    doc.moveDown().fontSize(10).text(`Belge no: ${fis.belgeNo}`);
    doc.text(`Tarih: ${fis.tarih.slice(0, 10).split('-').reverse().join('.')}`);
    doc.text(`Ünvan: ${fis.unvan || '-'}`);
    if (fis.vergiKimlikNo) doc.text(`VKN / TCKN: ${fis.vergiKimlikNo}`);
    if (fis.ettn) doc.text(`ETTN: ${fis.ettn}`);
    doc.moveDown();
    for (const [i, s] of fis.satirlar.entries()) {
      if (doc.y > 690) doc.addPage();
      const metin = `${i + 1}. ${s.ad}\nMiktar: ${s.miktar.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}` +
        (s.kur !== undefined ? `    Kur: ${s.kur.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}` : '') +
        `\nTutar: ${para(s.tutar)}` + (s.kdv !== undefined ? `    KDV: ${para(s.kdv)}` : '');
      doc.fontSize(10).text(metin).moveDown();
    }
    if (doc.y > 700) doc.addPage();
    doc.moveDown().fontSize(13).text(`Toplam: ${para(fis.tutar)}`, { align: 'right' });
    doc.moveDown().fontSize(9).fillColor('#626773').text('Kaynak fişten oluşturulmuş önizlemedir. ICE onaylı belge yerine geçmez.');
    doc.end();
  });
}

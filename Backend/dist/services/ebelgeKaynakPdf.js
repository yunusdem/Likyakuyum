import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { ApiError } from '../utils/ApiError.js';
/** Kaydedilmiş fişin PDF önizlemesi. ICE doğrulaması veya gönderimi yapmaz. */
export function kaynakFisPdf(fis) {
    const font = [process.env.EBELGE_PDF_FONT,
        path.join(process.env.WINDIR || 'C:/Windows', 'Fonts', 'arial.ttf'),
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    ].find((f) => !!f && existsSync(f));
    if (!font)
        throw ApiError.badRequest('PDF yazı tipi bulunamadı. Sunucuda EBELGE_PDF_FONT ile Türkçe destekli bir TTF yazı tipi tanımlayın.');
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: `${fis.belgeNo} - Fiş önizlemesi` } });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.font(font);
        const para = (n) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${fis.paraBirimi}`;
        doc.fontSize(17).fillColor('#31333a').text(fis.firma || fis.tur);
        doc.moveDown(0.5).fontSize(12).text(`${fis.tur} — Fiş önizlemesi`);
        doc.moveDown().fontSize(10).text(`Belge no: ${fis.belgeNo}`);
        doc.text(`Tarih: ${fis.tarih.slice(0, 10).split('-').reverse().join('.')}`);
        doc.text(`Ünvan: ${fis.unvan || '-'}`);
        if (fis.vergiKimlikNo)
            doc.text(`VKN / TCKN: ${fis.vergiKimlikNo}`);
        if (fis.ettn)
            doc.text(`ETTN: ${fis.ettn}`);
        doc.moveDown();
        for (const [i, s] of fis.satirlar.entries()) {
            if (doc.y > 690)
                doc.addPage();
            const metin = `${i + 1}. ${s.ad}\nMiktar: ${s.miktar.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}` +
                (s.kur !== undefined ? `    Kur: ${s.kur.toLocaleString('tr-TR', { maximumFractionDigits: 6 })}` : '') +
                `\nTutar: ${para(s.tutar)}` + (s.kdv !== undefined ? `    KDV: ${para(s.kdv)}` : '');
            doc.fontSize(10).text(metin).moveDown();
        }
        if (doc.y > 700)
            doc.addPage();
        doc.moveDown().fontSize(13).text(`Toplam: ${para(fis.tutar)}`, { align: 'right' });
        doc.moveDown().fontSize(9).fillColor('#626773').text('Kaynak fişten oluşturulmuş önizlemedir. ICE onaylı belge yerine geçmez.');
        doc.end();
    });
}

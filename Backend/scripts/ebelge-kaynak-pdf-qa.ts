import { kaynakFisPdf } from '../src/services/ebelgeKaynakPdf.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const dir = path.resolve('../tmp/ebelge-kaynak-qa'); mkdirSync(dir, { recursive: true });
const pdf = await kaynakFisPdf({ belgeNo: 'DIA2026000000001', tarih: '2026-09-11', unvan: 'İsim beyan edilmemiştir', firma: 'Likya Kuyum', vergiKimlikNo: '', tur: 'e-Döviz', paraBirimi: 'USD', tutar: 200, ettn: 'B005795E-B8A8-4142-9FD4-A096F32BCBCC', durum: 0, satirlar: [{ ad: 'Amerikan doları', miktar: 200, kur: 50, tutar: 200 }] });
writeFileSync(path.join(dir, 'fis.pdf'), pdf);
console.log(`PDF: ${pdf.length} bayt`);

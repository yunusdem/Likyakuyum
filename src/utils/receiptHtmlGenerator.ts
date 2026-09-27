/**
 * Likya Kuyumcu ERP - Fiş, Fatura ve Etiket HTML Çıktı Üreticisi
 * 
 * F10 kısayolu tetiklendiğinde modal veya önizleme açılmadan
 * anında yazıcıya gönderilecek tam HTML çıktısını üretir.
 */

export function generatePerakendeReceiptHtml(options: {
  fatura: any;
  company?: any;
  isPos?: boolean;
}): string {
  const { fatura, company, isPos = true } = options;
  if (!fatura) return "";

  const satirlar = fatura.satirlar || [];
  const odemeler = fatura.odemeler || [];
  const firmaAdi = company?.FIRMA_ADI || "LİKYA KUYUMCULUK";
  const adres = company?.ADRES || "Kuyumcular Çarşısı";
  const sube = company?.SUBE_ADI || "Merkez";
  const vkn = company?.VERGI_KIMLIK_NO || "";
  const tel = company?.TELEFON || "";

  const tarihStr = fatura.tarih ? new Date(fatura.tarih).toLocaleString("tr-TR") : new Date().toLocaleString("tr-TR");

  if (isPos) {
    return `
      <div style="font-family: 'Courier New', monospace; font-size: 11px; width: 100%; max-width: 78mm; margin: 0 auto; color: #000;">
        <div style="text-align: center; margin-bottom: 8px;">
          <div style="font-weight: bold; font-size: 13px;">${firmaAdi}</div>
          <div style="font-size: 10px;">${adres}</div>
          <div style="font-size: 10px;">${sube}</div>
          ${vkn ? `<div style="font-size: 10px;">VKN: ${vkn} ${tel ? `| Tel: ${tel}` : ""}</div>` : ""}
          <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 6px 0; padding: 4px 0; font-weight: bold;">
            PERAKENDE SATIŞ BİLGİ FİŞİ
          </div>
        </div>

        <div style="font-size: 10px; margin-bottom: 6px;">
          <div><strong>Fatura No:</strong> ${fatura.faturaNo || "-"}</div>
          <div><strong>Tarih:</strong> ${tarihStr}</div>
          <div><strong>Müşteri:</strong> ${fatura.aliciUnvan || "NİHAİ TÜKETİCİ"}</div>
          ${fatura.aliciVknTckn ? `<div><strong>TCKN/VKN:</strong> ${fatura.aliciVknTckn}</div>` : ""}
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 6px;">
          <thead>
            <tr style="border-bottom: 1px solid #000;">
              <th style="text-align: left; padding: 2px 0;">Ürün</th>
              <th style="text-align: right; padding: 2px 0;">Gr/Fyt</th>
              <th style="text-align: right; padding: 2px 0;">Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${satirlar
              .map(
                (s: any) => `
              <tr>
                <td style="text-align: left; padding: 2px 0;">
                  <div>${s.urunAdi || "Altın Ürün"}</div>
                  <div style="font-size: 9px; color: #444;">${s.barkod || ""} ${s.ayar ? `| ${s.ayar}` : ""}</div>
                </td>
                <td style="text-align: right; padding: 2px 0;">
                  <div>${Number(s.gram || 0).toFixed(2)}g</div>
                  <div style="font-size: 9px;">${Number(s.birimFiyat || 0).toLocaleString("tr-TR")}</div>
                </td>
                <td style="text-align: right; font-weight: bold; padding: 2px 0;">
                  ${Number(s.toplamTutar || s.tutar || (s.gram * s.birimFiyat) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div style="border-top: 1px dashed #000; padding-top: 4px; text-align: right; font-size: 11px;">
          <div>Ara Toplam: ${Number(fatura.araToplam || fatura.genelToplam || 0).toFixed(2)} ₺</div>
          ${Number(fatura.toplamKdv || 0) > 0 ? `<div>KDV: ${Number(fatura.toplamKdv).toFixed(2)} ₺</div>` : ""}
          ${Number(fatura.iskontoTutari || 0) > 0 ? `<div>İskonto: -${Number(fatura.iskontoTutari).toFixed(2)} ₺</div>` : ""}
          <div style="font-weight: bold; font-size: 13px; border-top: 1px solid #000; margin-top: 4px; padding-top: 4px;">
            GENEL TOPLAM: ${Number(fatura.genelToplam || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
          </div>
        </div>

        ${
          odemeler.length > 0
            ? `
          <div style="border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px; font-size: 10px;">
            <div style="font-weight: bold; margin-bottom: 2px;">Ödeme Dökümü:</div>
            ${odemeler
              .map(
                (o: any) => `
              <div style="display: flex; justify-content: space-between;">
                <span>${o.paraAdi || o.paraKodu || "Nakit"}:</span>
                <span>${Number(o.tutar || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }

        <div style="text-align: center; font-size: 9px; color: #555; margin-top: 10px; border-top: 1px dashed #000; padding-top: 6px;">
          İyi günlerde kullanmanız dileğiyle.<br />
          Mali değeri yoktur, bilgi fişidir.
        </div>
      </div>
    `;
  } else {
    // A4 Format
    return `
      <div style="font-family: Arial, sans-serif; font-size: 12px; width: 210mm; margin: 0 auto; color: #000; padding: 10mm;">
        <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
          <div>
            <h2 style="margin: 0; font-size: 18px;">${firmaAdi}</h2>
            <div style="font-size: 11px; color: #444;">${adres} - ${sube}</div>
            <div style="font-size: 11px; color: #444;">VKN: ${vkn} | Tel: ${tel}</div>
          </div>
          <div style="text-align: right;">
            <h3 style="margin: 0; color: #d97706;">SATIŞ BİLGİ FİŞİ</h3>
            <div><strong>Fatura No:</strong> ${fatura.faturaNo || "-"}</div>
            <div><strong>Tarih:</strong> ${tarihStr}</div>
          </div>
        </div>

        <div style="border: 1px solid #ddd; padding: 10px; border-radius: 4px; margin-bottom: 15px;">
          <strong>Sayın:</strong> ${fatura.aliciUnvan || "NİHAİ TÜKETİCİ"}<br />
          <strong>TCKN / VKN:</strong> ${fatura.aliciVknTckn || "-"}<br />
          <strong>Adres:</strong> ${fatura.adres || "-"} ${fatura.ilce || ""} ${fatura.il || ""}
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1px solid #ccc;">
              <th style="padding: 6px; text-align: left;">Sıra</th>
              <th style="padding: 6px; text-align: left;">Ürün Adı / Açıklama</th>
              <th style="padding: 6px; text-align: left;">Barkod / Ayar</th>
              <th style="padding: 6px; text-align: right;">Gramaj</th>
              <th style="padding: 6px; text-align: right;">Birim Fiyat</th>
              <th style="padding: 6px; text-align: right;">Toplam Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${satirlar
              .map(
                (s: any, idx: number) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 6px;">${idx + 1}</td>
                <td style="padding: 6px; font-weight: bold;">${s.urunAdi || "Altın Ürün"}</td>
                <td style="padding: 6px;">${s.barkod || ""} (${s.ayar || "-"})</td>
                <td style="padding: 6px; text-align: right;">${Number(s.gram || 0).toFixed(2)} gr</td>
                <td style="padding: 6px; text-align: right;">${Number(s.birimFiyat || 0).toLocaleString("tr-TR")} ₺</td>
                <td style="padding: 6px; text-align: right; font-weight: bold;">${Number(s.toplamTutar || (s.gram * s.birimFiyat) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>

        <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
          <table style="width: 260px; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px;">Ara Toplam:</td>
              <td style="padding: 4px; text-align: right;">${Number(fatura.araToplam || fatura.genelToplam || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
            </tr>
            ${Number(fatura.toplamKdv || 0) > 0 ? `
              <tr>
                <td style="padding: 4px;">KDV:</td>
                <td style="padding: 4px; text-align: right;">${Number(fatura.toplamKdv).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
              </tr>
            ` : ""}
            <tr style="border-top: 2px solid #000; font-size: 14px; font-weight: bold;">
              <td style="padding: 6px 4px;">GENEL TOPLAM:</td>
              <td style="padding: 6px 4px; text-align: right; color: #d97706;">${Number(fatura.genelToplam || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
            </tr>
          </table>
        </div>
      </div>
    `;
  }
}

export function generateSarrafReceiptHtml(options: {
  fis: any;
  company?: any;
}): string {
  const { fis, company } = options;
  if (!fis) return "";

  const firmaAdi = company?.FIRMA_ADI || "LİKYA SARRAFİYE & KUYUMCULUK";
  const tarihStr = fis.tarih ? new Date(fis.tarih).toLocaleString("tr-TR") : new Date().toLocaleString("tr-TR");
  const tipLabel = fis.tip === 0 ? "SARRAF ALIŞ BİLGİ FİŞİ" : "SARRAF SATIŞ BİLGİ FİŞİ";
  const satirlar = fis.satirlar || [];
  const odemeler = fis.odemeSatirlari || [];

  return `
    <div style="font-family: 'Courier New', monospace; font-size: 11px; width: 100%; max-width: 78mm; margin: 0 auto; color: #000;">
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 13px;">${firmaAdi}</div>
        <div style="font-size: 10px;">${company?.ADRES || ""}</div>
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 6px 0; padding: 4px 0; font-weight: bold;">
          ${tipLabel}
        </div>
      </div>

      <div style="font-size: 10px; margin-bottom: 6px;">
        <div><strong>Fiş No:</strong> ${fis.fisNo || fis.belgeNo || "-"}</div>
        <div><strong>Tarih:</strong> ${tarihStr}</div>
        <div><strong>Müşteri:</strong> ${fis.unvan || fis.detayUnvan || "NİHAİ TÜKETİCİ"}</div>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 6px;">
        <thead>
          <tr style="border-bottom: 1px solid #000;">
            <th style="text-align: left; padding: 2px 0;">Ürün</th>
            <th style="text-align: right; padding: 2px 0;">Miktar/Milyem</th>
            <th style="text-align: right; padding: 2px 0;">Tutar</th>
          </tr>
        </thead>
        <tbody>
          ${satirlar
            .map(
              (s: any) => `
            <tr>
              <td style="text-align: left; padding: 2px 0;">
                <div>${s.urunAdi || s.urunKodu || "Sarraf Ürün"}</div>
              </td>
              <td style="text-align: right; padding: 2px 0;">
                <div>${Number(s.miktar || 0).toFixed(2)}g (${s.milyem || ""})</div>
              </td>
              <td style="text-align: right; font-weight: bold; padding: 2px 0;">
                ${Number(s.tutar || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
              </td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>

      <div style="border-top: 1px dashed #000; padding-top: 4px; text-align: right; font-size: 11px;">
        <div style="font-weight: bold; font-size: 13px;">
          GENEL TOPLAM: ${Number(fis.toplamTutar || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        </div>
        ${fis.toplamHas ? `<div>Toplam Has: ${Number(fis.toplamHas).toFixed(3)} gr</div>` : ""}
      </div>

      ${
        odemeler.length > 0
          ? `
        <div style="border-top: 1px dashed #000; margin-top: 6px; padding-top: 4px; font-size: 10px;">
          <div style="font-weight: bold; margin-bottom: 2px;">Ödeme Dökümü:</div>
          ${odemeler
            .map(
              (o: any) => `
            <div style="display: flex; justify-content: space-between;">
              <span>${o.paraAdi || o.paraKodu || "Ödeme"}:</span>
              <span>${Number(o.tutar || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
            </div>
          `
            )
            .join("")}
        </div>
      `
          : ""
      }

      <div style="text-align: center; font-size: 9px; color: #555; margin-top: 8px; border-top: 1px dashed #000; padding-top: 4px;">
        Bizi tercih ettiğiniz için teşekkür ederiz.
      </div>
    </div>
  `;
}

export function generateDovizReceiptHtml(options: {
  fis: any;
  company?: any;
}): string {
  const { fis, company } = options;
  if (!fis) return "";

  const firmaAdi = company?.FIRMA_ADI || "LİKYA DÖVİZ & KUYUMCULUK";
  const tarihStr = fis.tarih ? new Date(fis.tarih).toLocaleString("tr-TR") : new Date().toLocaleString("tr-TR");
  const islemTipi = fis.islemTipi === "ALIS" || fis.islemTipi === "ALIM" || fis.tip === 0 ? "DÖVİZ ALIM BORDROSU" : "DÖVİZ SATIM BORDROSU";

  return `
    <div style="font-family: 'Courier New', monospace; font-size: 11px; width: 100%; max-width: 78mm; margin: 0 auto; color: #000;">
      <div style="text-align: center; margin-bottom: 8px;">
        <div style="font-weight: bold; font-size: 13px;">${firmaAdi}</div>
        <div style="font-size: 10px;">${company?.ADRES || ""}</div>
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; margin: 6px 0; padding: 4px 0; font-weight: bold;">
          ${islemTipi}
        </div>
      </div>

      <div style="font-size: 10px; margin-bottom: 6px;">
        <div><strong>Fiş No:</strong> ${fis.fisNo || fis.faturaNo || fis.belgeNo || "-"}</div>
        <div><strong>Tarih:</strong> ${tarihStr}</div>
        <div><strong>Müşteri:</strong> ${fis.musteriAdi || fis.aliciUnvan || fis.unvan || "NİHAİ TÜKETİCİ"}</div>
      </div>

      <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin-bottom: 6px;">
        <div style="display: flex; justify-content: space-between;">
          <span>Döviz Tutarı:</span>
          <strong>${Number(fis.dovizTutari || fis.miktar || (fis.lines?.[0]?.miktar) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${fis.dovizCinsi || fis.paraKodu || (fis.lines?.[0]?.paraKodu) || "USD"}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span>İşlem Kuru:</span>
          <span>${Number(fis.kur || (fis.lines?.[0]?.kur) || 1).toFixed(4)} ₺</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 12px; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px;">
          <span>TL Karşılığı:</span>
          <span>${Number(fis.tlTutari || fis.odemeTutari || fis.toplamTutar || fis.genelToplam || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
        </div>
      </div>

      <div style="text-align: center; font-size: 9px; color: #555; margin-top: 8px;">
        Bizi tercih ettiğiniz için teşekkür ederiz.
      </div>
    </div>
  `;
}

export function generateBarcodeLabelHtml(options: {
  barkod: string;
  grupKodu?: string;
  urunNo?: string | number;
  ayar?: string;
  miktar?: string | number;
  hasGram?: string | number;
  satisFiyati?: string | number;
  satisParaKodu?: string;
  model?: string;
  ureticiFirma?: string;
  tarih?: string;
  barcodeSvg?: string;
}): string {
  const {
    barkod,
    grupKodu = "",
    urunNo = "",
    ayar = "",
    miktar = "",
    hasGram = "",
    satisFiyati = "",
    satisParaKodu = "TL",
    model = "",
    ureticiFirma = "",
    tarih = "",
    barcodeSvg = "",
  } = options;

  const formattedTarih = tarih
    ? new Date(tarih).toLocaleDateString("tr-TR")
    : new Date().toLocaleDateString("tr-TR");

  return `
    <div style="width: 58mm; margin: 0 auto; padding: 2.5mm 2.5mm; font-size: 8pt; line-height: 1.25; font-family: Arial, sans-serif; background: #ffffff; color: #000;">
      <div style="text-align: center; border-bottom: 0.5pt dashed #222; padding-bottom: 1.5mm; margin-bottom: 2mm;">
        <div style="font-size: 9.5pt; font-weight: bold; letter-spacing: 0.5px;">ÜRÜN BARKOD ETİKETİ</div>
        <div style="font-size: 7pt; color: #444;">${formattedTarih}</div>
      </div>
      <div style="text-align: center; margin: 2mm 0;">
        ${barcodeSvg || `<div style="font-size:11px;font-weight:bold;text-align:center;font-family:monospace;">${barkod}</div>`}
      </div>
      <table style="width: 100%; border-collapse: collapse; margin: 1.5mm 0; font-size: 8pt;">
        ${grupKodu || urunNo ? `<tr><td style="color: #333; font-weight: 500; width: 45%; padding: 1mm 0;">Ürün Kodu:</td><td style="font-weight: bold; text-align: right; font-family: monospace;">${grupKodu}${urunNo ? `-${urunNo}` : ""}</td></tr>` : ""}
        ${ayar ? `<tr><td style="color: #333; font-weight: 500; padding: 1mm 0;">Ayar:</td><td style="font-weight: bold; text-align: right; font-family: monospace;">${ayar} Ayar</td></tr>` : ""}
        ${miktar ? `<tr><td style="color: #333; font-weight: 500; padding: 1mm 0;">Gramaj:</td><td style="font-weight: bold; text-align: right; font-family: monospace;">${Number(miktar).toFixed(2)} Gr</td></tr>` : ""}
        ${hasGram ? `<tr><td style="color: #333; font-weight: 500; padding: 1mm 0;">Has Gram:</td><td style="font-weight: bold; text-align: right; font-family: monospace;">${Number(hasGram).toFixed(3)} Gr</td></tr>` : ""}
        ${satisFiyati ? `<tr><td style="color: #333; font-weight: 500; padding: 1mm 0;">Satış Fiyatı:</td><td style="font-weight: bold; text-align: right; font-family: monospace;">${Number(satisFiyati).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${satisParaKodu}</td></tr>` : ""}
        ${model ? `<tr><td style="color: #333; font-weight: 500; padding: 1mm 0;">Model:</td><td style="font-weight: bold; text-align: right;">${model}</td></tr>` : ""}
        ${ureticiFirma ? `<tr><td style="color: #333; font-weight: 500; padding: 1mm 0;">Üretici:</td><td style="font-weight: bold; text-align: right;">${ureticiFirma}</td></tr>` : ""}
      </table>
      <div style="text-align: center; border-top: 0.5pt dashed #222; padding-top: 1.5mm; margin-top: 2mm; font-size: 7pt; color: #555;">
        Likya Kuyumculuk ERP
      </div>
    </div>
  `;
}



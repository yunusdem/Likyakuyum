export interface PrintColumn<T> {
  header: string;
  key?: keyof T;
  render?: (item: T, index: number) => string | number | null | undefined;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface PrintReportOptions<T> {
  title: string;
  subtitle?: string;
  data: T[];
  columns: PrintColumn<T>[];
  companyName?: string;
  dbName?: string;
  summaryInfo?: string;
}

/**
 * Generates an official, beautifully formatted ERP printable report table in A4 format.
 */
export function printReportTable<T>(options: PrintReportOptions<T>) {
  const {
    title,
    subtitle = "ERP Sistem Dökümü",
    data,
    columns,
    companyName = "KUYUMCU ERP SAAS SİSTEMİ",
    dbName = localStorage.getItem("kuyumcu_erp_active_db") || "R2016_dvz",
    summaryInfo,
  } = options;

  const activeServer = localStorage.getItem("kuyumcu_erp_active_server") || "localhost";
  const now = new Date();
  const printDateStr = now.toLocaleDateString("tr-TR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rowsHtml = data
    .map((item, index) => {
      const cells = columns
        .map((col) => {
          let val: any = "";
          if (col.render) {
            val = col.render(item, index);
          } else if (col.key) {
            val = item[col.key];
          }

          if (val === null || val === undefined || val === "") {
            val = "-";
          } else if (typeof val === "boolean") {
            val = val ? "Evet" : "Hayır";
          }

          const align = col.align || "left";
          return `<td style="text-align: ${align}; padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 11px; word-break: break-word;">${val}</td>`;
        })
        .join("");

      const bg = index % 2 === 0 ? "#ffffff" : "#f8fafc";
      return `<tr style="background-color: ${bg};">${cells}</tr>`;
    })
    .join("");

  const headersHtml = columns
    .map((col) => {
      const align = col.align || "left";
      const widthStyle = col.width ? `width: ${col.width};` : "";
      return `<th style="text-align: ${align}; padding: 8px 8px; background-color: #0f172a; color: #ffffff; border: 1px solid #0f172a; font-size: 11px; font-weight: 700; ${widthStyle}">${col.header}</th>`;
    })
    .join("");

  const printWindow = window.open("", "_blank", "width=1000,height=750");
  if (!printWindow) {
    alert("Yazdırma penceresi açılamadı. Lütfen tarayıcınızın açılır pencere (popup) engelleyicisini kontrol ediniz.");
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${title} - Yazdırma Raporu</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 12mm;
        }
        * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        body {
          margin: 0;
          padding: 10px;
          color: #0f172a;
          background: #ffffff;
          font-size: 12px;
        }
        .report-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 8px;
          margin-bottom: 12px;
        }
        .company-title {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.5px;
        }
        .report-title {
          font-size: 14px;
          font-weight: 700;
          color: #2563eb;
          margin-top: 2px;
        }
        .meta-box {
          text-align: right;
          font-size: 11px;
          color: #475569;
          line-height: 1.4;
        }
        .meta-badge {
          display: inline-block;
          padding: 2px 6px;
          background: #e2e8f0;
          border-radius: 4px;
          font-weight: 600;
          font-size: 10px;
          color: #1e293b;
        }
        table.report-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .report-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid #cbd5e1;
          padding-top: 10px;
          margin-top: 20px;
          font-size: 11px;
          color: #64748b;
        }
        .signature-block {
          display: flex;
          gap: 60px;
        }
        .signature-box {
          border-top: 1px dashed #94a3b8;
          width: 140px;
          text-align: center;
          padding-top: 4px;
          font-size: 10px;
          font-weight: 600;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          table { page-break-inside: auto; }
          tr    { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div>
          <div class="company-title">${companyName}</div>
          <div class="report-title">${title}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${subtitle}</div>
        </div>
        <div class="meta-box">
          <div><strong>Tarih:</strong> ${printDateStr}</div>
          <div><strong>Veritabanı:</strong> <span class="meta-badge">${dbName}</span> (${activeServer})</div>
          <div><strong>Toplam Kayıt:</strong> <span class="meta-badge">${data.length} Adet</span></div>
        </div>
      </div>

      <table class="report-table">
        <thead>
          <tr>
            ${headersHtml}
          </tr>
        </thead>
        <tbody>
          ${
            data.length > 0
              ? rowsHtml
              : `<tr><td colspan="${columns.length}" style="text-align:center; padding: 20px; color:#94a3b8; font-style:italic;">Yazdırılacak kayıt bulunamadı.</td></tr>`
          }
        </tbody>
      </table>

      <div class="report-footer">
        <div>
          ${summaryInfo ? `<span>${summaryInfo} | </span>` : ""}
          <span style="display: inline-flex; align-items: center; gap: 4px;">
            <img src="${window.location.origin}/images/logo/logo.svg" alt="Logo" style="height: 14px; width: 14px; vertical-align: middle; object-fit: contain;" />
            Likya Kuyumcu ERP Raporlama Modülü
          </span>
        </div>
        <div class="signature-block">
          <div class="signature-box">Raporu Alan</div>
          <div class="signature-box">Yetkili / Onay</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.focus();
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

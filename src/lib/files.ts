import { LGU_PROFILE } from '@/lib/mock-data';

// Returns false when the browser could not start the download, so callers can show an error.
export const saveFile = (fileName: string, content: string, type: string): boolean => {
  try {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
};

export const downloadUrl = (url: string, fileName: string): boolean => {
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  } catch {
    return false;
  }
};

// Prints a PDF through an off-screen frame so no pop-up is needed. The frame must have a real size or the PDF viewer never loads.
export const printPdfUrl = (url: string): boolean => {
  try {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0;';
    frame.src = url;
    frame.onload = () => {
      setTimeout(() => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      }, 300);
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
    return true;
  } catch {
    return false;
  }
};

const csvCell =(value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export const saveCsv = (fileName: string, header: string[], rows: (string | number)[][]): boolean => {
  const content = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  return saveFile(fileName, content, 'text/csv;charset=utf-8');
};

// Opens a printable page with the SB letterhead; the browser's print dialog can also save it as PDF.
// Returns false when the browser blocked the new window.
export const openPrintWindow = (title: string, bodyHtml: string): boolean => {
  const content = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 24px; color: #212121; }
          .head { text-align: center; margin-bottom: 16px; }
          .head img { width: 64px; height: 64px; border-radius: 50%; }
          .head .rp { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #555; }
          .head .sb { font-size: 18px; font-weight: 800; color: #1a237e; }
          .card { border: 1px solid #ddd; padding: 16px; position: relative; }
          .watermark {
            position: absolute; inset: 0; display:flex; align-items:center; justify-content:center;
            font-size: 48px; font-weight: 800; color: rgba(26, 35, 126, 0.10);
            transform: rotate(-18deg); pointer-events:none; user-select:none;
          }
          .rows { font-size: 12px; line-height: 1.6; }
          .title { font-size: 18px; font-weight: 800; margin: 12px 0; }
          .body { white-space: pre-wrap; margin-top: 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
          th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { background: #f1f5f9; }
          ol { line-height: 1.8; }
        </style>
      </head>
      <body>
        <div class="head">
          <img src="${window.location.origin}/capas-logo.jpg" alt="" />
          <div class="rp">Republic of the Philippines · Province of Tarlac</div>
          <div class="sb">${LGU_PROFILE.legislature.toUpperCase()}</div>
        </div>
        ${bodyHtml}
      </body>
    </html>
  `.trim();

  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(content);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
};

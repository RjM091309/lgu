// Minimal PDF writer for system-generated session documents (agenda, order of business).
// Produces a real A4 PDF with Helvetica text, automatic wrapping, page breaks and an optional diagonal watermark.

export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  spaceBefore?: number;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;

// PDF base fonts use WinAnsi (Latin-1); map common typographic characters and drop anything outside it.
const toWinAnsi = (text: string) =>
  text
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

const escapePdfText = (text: string) => toWinAnsi(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const wrap = (text: string, maxChars: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
};

export function createPdf(lines: PdfLine[], watermark?: string): Blob {
  const pages: string[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;

  for (const line of lines) {
    const size = line.size ?? 11;
    const leading = size * 1.45;
    // Helvetica averages roughly half an em per character.
    const maxChars = Math.floor((PAGE_WIDTH - MARGIN * 2) / (size * 0.5));
    y -= line.spaceBefore ?? 0;
    for (const chunk of wrap(line.text, maxChars)) {
      if (y - leading < MARGIN) {
        pages.push([]);
        y = PAGE_HEIGHT - MARGIN;
      }
      y -= leading;
      pages[pages.length - 1].push(`BT /${line.bold ? 'F2' : 'F1'} ${size} Tf ${MARGIN} ${y.toFixed(1)} Td (${escapePdfText(chunk)}) Tj ET`);
    }
  }

  const watermarkOps = watermark
    ? `q 0.9 g BT /F2 44 Tf 0.707 0.707 -0.707 0.707 150 240 Tm (${escapePdfText(watermark)}) Tj ET Q\n`
    : '';

  const objects: string[] = [];
  // push() returns the new length, which is this object's 1-based PDF object number.
  const add = (body: string) => objects.push(body);
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // Pages, filled once the page object numbers are known.
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const pageRefs: string[] = [];
  for (const ops of pages) {
    const content = `${watermarkOps}${ops.join('\n')}`;
    const contentNumber = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    const pageNumber = add(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`
    );
    pageRefs.push(`${pageNumber} 0 R`);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pageRefs.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  // Every character is Latin-1 at this point, so one char is one byte and the xref offsets above are byte offsets.
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
  return new Blob([bytes], { type: 'application/pdf' });
}

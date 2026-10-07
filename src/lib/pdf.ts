// Minimal PDF writer for system-generated session documents (agenda, order of business, e-session records).
// Produces a real A4 PDF with Helvetica text, wrapping by real character widths, simple ruled tables, page breaks,
// an optional page footer ("Page 1 of 2"), and an optional diagonal watermark centred on every page.

export interface PdfLine {
  text: string;
  size?: number;
  bold?: boolean;
  spaceBefore?: number;
  /** 0 is black, 1 is white. */
  gray?: number;
  /** A heading: starts a new page rather than sit alone at the bottom of one. */
  keepWithNext?: boolean;
}

export interface PdfTableColumn {
  title: string;
  /** Share of the line width, relative to the other columns. */
  width: number;
  align?: 'left' | 'right';
}

export interface PdfTable {
  columns: PdfTableColumn[];
  rows: string[][];
  size?: number;
  spaceBefore?: number;
}

export type PdfBlock = PdfLine | { table: PdfTable };

export interface PdfOptions {
  /** Diagonal text behind every page, sized to fit and centred. */
  watermark?: string;
  /** Small text at the bottom of every page, next to "Page x of y". */
  footer?: string;
}

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = 30;
const CELL_PAD_X = 4;
const CELL_PAD_Y = 3;

// Advance widths (per 1000 units of font size) of the standard Helvetica fonts for the printable ASCII range 32-126,
// from Adobe's font metrics. Other Latin-1 characters use an average width.
const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584,
  556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278,
  469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260,
  334, 584,
];
const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584,
  611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333,
  584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280,
  389, 584,
];

// PDF base fonts use WinAnsi (Latin-1); map common typographic characters and drop anything outside it.
const toWinAnsi = (text: string) =>
  text
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

const escapePdfText = (text: string) => toWinAnsi(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/** Width of `text` in points at `size`. */
export const textWidth = (text: string, size: number, bold = false) => {
  const widths = bold ? HELVETICA_BOLD : HELVETICA;
  let units = 0;
  for (const char of toWinAnsi(text)) {
    const code = char.charCodeAt(0);
    units += code >= 32 && code <= 126 ? widths[code - 32] : code === 0xb7 ? 278 : 556;
  }
  return (units * size) / 1000;
};

/** Breaks `text` into lines no wider than `maxWidth`; a word longer than a line is split. */
const wrap = (text: string, size: number, bold: boolean, maxWidth: number) => {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size, bold) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    while (textWidth(current, size, bold) > maxWidth && current.length > 1) {
      let cut = current.length - 1;
      while (cut > 1 && textWidth(current.slice(0, cut), size, bold) > maxWidth) cut -= 1;
      lines.push(current.slice(0, cut));
      current = current.slice(cut);
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
};

const textOp = (text: string, x: number, y: number, size: number, bold: boolean, gray = 0) =>
  `${gray ? `${gray} g ` : ''}BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${escapePdfText(text)}) Tj ET${gray ? ' 0 g' : ''}`;
const ruleOp = (x1: number, x2: number, y: number, gray: number, width: number) => `q ${gray} G ${width} w ${x1.toFixed(1)} ${y.toFixed(1)} m ${x2.toFixed(1)} ${y.toFixed(1)} l S Q`;
const fillOp = (x: number, y: number, w: number, h: number, gray: number) => `q ${gray} g ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f Q`;

/** The watermark along the page's diagonal, as large as fits in 70% of it, with its middle on the page's middle. */
const watermarkOp = (text: string) => {
  const angle = Math.atan2(PAGE_HEIGHT, PAGE_WIDTH);
  const diagonal = Math.hypot(PAGE_WIDTH, PAGE_HEIGHT);
  const size = Math.min(60, (diagonal * 0.7) / textWidth(text, 1, true));
  const width = textWidth(text, size, true);
  const capHeight = size * 0.718; // Helvetica's capital height
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Step back half the text's length along the slant, and half its height across it, from the centre.
  const x = PAGE_WIDTH / 2 - (width / 2) * cos + (capHeight / 2) * sin;
  const y = PAGE_HEIGHT / 2 - (width / 2) * sin - (capHeight / 2) * cos;
  return `q 0.9 g BT /F2 ${size.toFixed(1)} Tf ${cos.toFixed(4)} ${sin.toFixed(4)} ${(-sin).toFixed(4)} ${cos.toFixed(4)} ${x.toFixed(1)} ${y.toFixed(1)} Tm (${escapePdfText(text)}) Tj ET Q`;
};

export function createPdf(blocks: PdfBlock[], options: PdfOptions | string = {}): Blob {
  const { watermark, footer } = typeof options === 'string' ? { watermark: options, footer: undefined } : options;
  const pages: string[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;
  const draw = (op: string) => pages[pages.length - 1].push(op);
  const newPage = () => {
    pages.push([]);
    y = PAGE_HEIGHT - MARGIN;
  };
  const fits = (height: number) => y - height >= MARGIN;

  for (const block of blocks) {
    if ('table' in block) {
      const { columns, rows, size = 9, spaceBefore = 0 } = block.table;
      const leading = size * 1.35;
      const total = columns.reduce((sum, column) => sum + column.width, 0);
      const widths = columns.map((column) => (column.width / total) * CONTENT_WIDTH);
      const lefts = widths.map((_, index) => MARGIN + widths.slice(0, index).reduce((sum, width) => sum + width, 0));
      const layout = (cells: string[], bold: boolean) => {
        const lines = cells.map((cell, index) => wrap(cell, size, bold, widths[index] - CELL_PAD_X * 2));
        return { lines, height: Math.max(...lines.map((cell) => cell.length)) * leading + CELL_PAD_Y * 2 };
      };
      const drawRow = (row: ReturnType<typeof layout>, bold: boolean) => {
        row.lines.forEach((cellLines, index) => {
          cellLines.forEach((text, line) => {
            const baseline = y - CELL_PAD_Y - leading * (line + 1) + size * 0.3;
            const x = columns[index].align === 'right' ? lefts[index] + widths[index] - CELL_PAD_X - textWidth(text, size, bold) : lefts[index] + CELL_PAD_X;
            draw(textOp(text, x, baseline, size, bold));
          });
        });
        y -= row.height;
      };
      const header = layout(
        columns.map((column) => column.title),
        true
      );
      const drawHeader = () => {
        draw(fillOp(MARGIN, y - header.height, CONTENT_WIDTH, header.height, 0.93));
        drawRow(header, true);
        draw(ruleOp(MARGIN, MARGIN + CONTENT_WIDTH, y, 0.35, 0.6));
      };
      y -= spaceBefore;
      const first = rows.length ? layout(rows[0], false) : null;
      // Keep the header with at least the first row.
      if (!fits(header.height + (first?.height ?? 0))) newPage();
      drawHeader();
      rows.forEach((cells) => {
        const row = layout(cells, false);
        if (!fits(row.height)) {
          newPage();
          drawHeader();
        }
        drawRow(row, false);
        draw(ruleOp(MARGIN, MARGIN + CONTENT_WIDTH, y, 0.8, 0.4));
      });
      continue;
    }
    const size = block.size ?? 11;
    const bold = block.bold ?? false;
    const leading = size * 1.45;
    y -= block.spaceBefore ?? 0;
    // Room for the heading and a few lines (or a table's header and first rows) under it.
    if (block.keepWithNext && !fits(leading + 80)) newPage();
    for (const chunk of wrap(block.text, size, bold, CONTENT_WIDTH)) {
      if (!fits(leading)) newPage();
      y -= leading;
      draw(textOp(chunk, MARGIN, y, size, bold, block.gray));
    }
  }

  // Footer: the given text on the left (shortened to fit), the page count on the right.
  if (footer) {
    pages.forEach((ops, index) => {
      const label = `Page ${index + 1} of ${pages.length}`;
      const room = CONTENT_WIDTH - textWidth(label, 8) - 16;
      let text = footer;
      if (textWidth(text, 8) > room) {
        while (text.length > 1 && textWidth(`${text}...`, 8) > room) text = text.slice(0, -1);
        text = `${text.trimEnd()}...`;
      }
      ops.push(ruleOp(MARGIN, MARGIN + CONTENT_WIDTH, FOOTER_Y + 12, 0.8, 0.4));
      ops.push(textOp(text, MARGIN, FOOTER_Y, 8, false, 0.4));
      ops.push(textOp(label, PAGE_WIDTH - MARGIN - textWidth(label, 8), FOOTER_Y, 8, false, 0.4));
    });
  }

  const watermarkOps = watermark ? `${watermarkOp(watermark)}\n` : '';

  const objects: string[] = [];
  // push() returns the new length, which is this object's 1-based PDF object number.
  const add = (body: string) => objects.push(body);
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add(''); // Pages, filled once the page object numbers are known.
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

  const pageRefs: string[] = [];
  for (const ops of pages) {
    // The watermark goes first, so everything else is drawn over it.
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

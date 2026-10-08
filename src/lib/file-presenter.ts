// Presenting a file in an e-session: a PDF or an image is drawn on a canvas, and the canvas is sent to everyone
// as the presenter's "screen", through the same path as a screen share. Phones and tablets cannot share their
// screen from a browser, but every device can present a file this way. pdf.js loads only when a PDF is presented.

/** Long side of the picture sent: sharp enough to read a page, light enough for a room full of tablets. */
const MAX_SIDE = 1600;
/** Frames per second sent. A page only changes on a page turn, but new arrivals need a fresh frame to start from. */
const FPS = 5;

type PdfDocument = { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => Promise<void> };
type PdfPage = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
  cleanup: () => void;
};

const loadPdf = async (data: ArrayBuffer): Promise<PdfDocument> => {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return (await pdfjs.getDocument({ data, isEvalSupported: false }).promise) as unknown as PdfDocument;
};

export const isPresentable = (name: string, type = '') => /\.(pdf|png|jpe?g|gif|webp)$/i.test(name) || /^(application\/pdf|image\/)/.test(type);

export class FilePresenter {
  readonly track: MediaStreamTrack;
  readonly name: string;
  pages = 1;
  page = 1;
  private readonly canvas = document.createElement('canvas');
  private readonly ctx: CanvasRenderingContext2D;
  private pdf: PdfDocument | null = null;
  private image: ImageBitmap | null = null;
  private timer: number;
  private rendering = Promise.resolve();

  private constructor(name: string) {
    this.name = name;
    this.canvas.width = 1280;
    this.canvas.height = 720;
    const ctx = this.canvas.getContext('2d');
    if (!ctx || typeof this.canvas.captureStream !== 'function') throw new Error('This browser cannot present files.');
    this.ctx = ctx;
    this.track = this.canvas.captureStream(FPS).getVideoTracks()[0];
    this.track.contentHint = 'detail';
    // Repaint now and then so the stream keeps producing frames while a page is shown (see FPS).
    this.timer = window.setInterval(() => this.repaint(), 1000);
  }

  /** Opens a PDF or an image for presenting, at its first page. */
  static async open(file: Blob, name: string): Promise<FilePresenter> {
    const presenter = new FilePresenter(name);
    try {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(name)) {
        presenter.pdf = await loadPdf(await file.arrayBuffer());
        presenter.pages = presenter.pdf.numPages;
      } else {
        presenter.image = await createImageBitmap(file);
      }
      await presenter.show(1);
      return presenter;
    } catch (error) {
      presenter.stop();
      throw error instanceof Error && error.message === 'This browser cannot present files.' ? error : new Error(`${name} could not be opened. It may be damaged or not a PDF or picture.`);
    }
  }

  /** Shows a page (1-based); out-of-range pages are ignored. */
  show(page: number) {
    if (page < 1 || page > this.pages) return this.rendering;
    this.page = page;
    this.rendering = this.rendering.then(() => this.draw(page)).catch(() => undefined);
    return this.rendering;
  }

  private size(width: number, height: number) {
    const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    const w = Math.max(2, Math.round((width * scale) / 2) * 2);
    const h = Math.max(2, Math.round((height * scale) / 2) * 2);
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
    return { w, h };
  }

  private snapshot: HTMLCanvasElement | null = null;

  private async draw(page: number) {
    if (this.image) {
      const { w, h } = this.size(this.image.width, this.image.height);
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(0, 0, w, h);
      this.ctx.drawImage(this.image, 0, 0, w, h);
    } else if (this.pdf) {
      const pdfPage = await this.pdf.getPage(page);
      const base = pdfPage.getViewport({ scale: 1 });
      const scale = MAX_SIDE / Math.max(base.width, base.height);
      const viewport = pdfPage.getViewport({ scale });
      // Drawn off screen first, so viewers never see a half-drawn page.
      const off = document.createElement('canvas');
      off.width = Math.round(viewport.width);
      off.height = Math.round(viewport.height);
      const offCtx = off.getContext('2d');
      if (!offCtx) return;
      offCtx.fillStyle = '#fff';
      offCtx.fillRect(0, 0, off.width, off.height);
      await pdfPage.render({ canvasContext: offCtx, viewport }).promise;
      pdfPage.cleanup();
      if (this.page !== page) return;
      const { w, h } = this.size(off.width, off.height);
      this.ctx.drawImage(off, 0, 0, w, h);
      this.snapshot = off;
    }
  }

  private repaint() {
    if (this.image) this.ctx.drawImage(this.image, 0, 0, this.canvas.width, this.canvas.height);
    else if (this.snapshot) this.ctx.drawImage(this.snapshot, 0, 0, this.canvas.width, this.canvas.height);
  }

  stop() {
    window.clearInterval(this.timer);
    this.track.stop();
    this.image?.close();
    void this.pdf?.destroy();
    this.pdf = null;
    this.image = null;
    this.snapshot = null;
  }
}

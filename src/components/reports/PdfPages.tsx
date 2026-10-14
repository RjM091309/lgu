import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { loadPdf, type PdfDocument } from '@/lib/file-presenter';

// A PDF's pages drawn one under another with pdf.js, the same on every device: Chrome on Android, for one, shows
// no PDF inside a page. `zoom` 1 fits the page to the width available; above 1 the pages scroll sideways too.

export function PdfPages({ blob, zoom, title }: { blob: Blob; zoom: number; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let opened: PdfDocument | null = null;
    setDoc(null);
    setFailed(false);
    // Another file's pages never show under this one's title.
    pagesRef.current?.replaceChildren();
    void blob
      .arrayBuffer()
      .then(loadPdf)
      .then((loaded) => {
        opened = loaded;
        if (cancelled) void loaded.destroy();
        else setDoc(loaded);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
  }, [blob]);

  // The width the pages fit, settled for a moment so a resize does not redraw on every frame.
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    let timer = 0;
    const observer = new ResizeObserver(([entry]) => {
      window.clearTimeout(timer);
      const next = Math.floor(entry.contentRect.width);
      timer = window.setTimeout(() => setWidth(next), width ? 150 : 0);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [width]);

  useEffect(() => {
    const host = pagesRef.current;
    if (!doc || !host || !width) return;
    let cancelled = false;
    const draw = async () => {
      const canvases: HTMLCanvasElement[] = [];
      const ratio = window.devicePixelRatio || 1;
      for (let n = 1; n <= doc.numPages && !cancelled; n += 1) {
        const page = await doc.getPage(n);
        const cssWidth = width * zoom;
        const scale = cssWidth / page.getViewport({ scale: 1 }).width;
        const viewport = page.getViewport({ scale: scale * ratio });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        canvas.style.width = `${cssWidth}px`;
        canvas.className = 'block bg-white shadow-md ring-1 ring-black/10';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${title}, page ${n} of ${doc.numPages}`);
        const ctx = canvas.getContext('2d');
        if (ctx) await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();
        canvases.push(canvas);
      }
      // Swapped in at once, so the old pages stay up until the new ones are ready.
      if (!cancelled) host.replaceChildren(...canvases);
    };
    void draw().catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [doc, width, zoom, title]);

  return (
    <div ref={box} className="relative w-full">
      {failed ? (
        <p className="py-16 text-center text-sm text-text-muted">This file could not be shown. Download it to open it on this device.</p>
      ) : (
        <>
          {!doc ? (
            <p className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening the record…
            </p>
          ) : null}
          <div ref={pagesRef} className="flex flex-col items-start gap-4" />
        </>
      )}
    </div>
  );
}

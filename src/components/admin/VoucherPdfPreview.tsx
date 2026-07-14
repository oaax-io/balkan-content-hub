import { useEffect, useRef, useState } from "react";

// Render a PDF (given as raw bytes) into canvases using pdfjs. Avoids the
// browser's built-in PDF viewer, which Edge blocks inside preview iframes.
export function VoucherPdfPreview({ bytes }: { bytes: Uint8Array }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        // Use the ESM worker shipped with pdfjs-dist v6.
        const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        // Clone into a fresh buffer — pdfjs takes ownership of the ArrayBuffer.
        const copy = new Uint8Array(bytes);
        const loadingTask = pdfjs.getDocument({ data: copy });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1 });
          const targetWidth = Math.min(container.clientWidth - 24, 1400);
          const scale = targetWidth / viewport.width;
          const scaled = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          const dpr = window.devicePixelRatio || 1;
          canvas.width = Math.floor(scaled.width * dpr);
          canvas.height = Math.floor(scaled.height * dpr);
          canvas.style.width = `${scaled.width}px`;
          canvas.style.height = `${scaled.height}px`;
          canvas.style.display = "block";
          canvas.style.margin = "12px auto";
          canvas.style.boxShadow = "0 4px 24px rgba(0,0,0,0.3)";

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.scale(dpr, dpr);
          await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise;
          if (cancelled) return;
          container.appendChild(canvas);
        }
      } catch (e) {
        console.error("[voucher-preview] render error", e);
        if (!cancelled) setError(e instanceof Error ? e.message : "Fehler beim Rendern");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bytes]);

  return (
    <div className="w-full h-full overflow-auto bg-neutral-900">
      {error ? <div className="p-6 text-sm text-red-400">{error}</div> : null}
      <div ref={containerRef} className="w-full" />
    </div>
  );
}

// Auto-Reload bei "Failed to fetch dynamically imported module" nach Deploy.
// Nach einem neuen Publish zeigen alte Chunk-Hashes ins Leere. Wir laden die Seite
// einmalig neu (mit sessionStorage-Flag, um Endlosschleifen zu verhindern).

const FLAG = "__chunk_reload_at";
const COOLDOWN_MS = 10_000;

function isChunkLoadError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("importing a module script failed") ||
    m.includes("error loading dynamically imported module") ||
    (m.includes("chunkloaderror") || m.includes("loading chunk"))
  );
}

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(FLAG) ?? "0");
    if (Date.now() - last < COOLDOWN_MS) return; // schon versucht, nicht loopen
    sessionStorage.setItem(FLAG, String(Date.now()));
  } catch {
    /* sessionStorage evtl. blockiert – dann trotzdem reload */
  }
  window.location.reload();
}

export function installChunkReload() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    const msg = event.message ?? String(event.error ?? "");
    if (isChunkLoadError(msg)) reloadOnce();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const msg =
      (reason && typeof reason === "object" && "message" in reason
        ? String((reason as { message?: unknown }).message ?? "")
        : String(reason ?? ""));
    if (isChunkLoadError(msg)) reloadOnce();
  });
}

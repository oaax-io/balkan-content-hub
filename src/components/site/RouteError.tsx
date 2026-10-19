// Gemeinsame Fehleranzeige für Routen: error ist laut Router-Typ `unknown`.
export function RouteError({ error }: { error: unknown }) {
  return <div className="p-10">Fehler: {error instanceof Error ? error.message : String(error)}</div>;
}

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { BackToTop } from "@/components/site/BackToTop";
import { PageViewTracker } from "@/components/site/PageViewTracker";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display text-gold">404</h1>
        <h2 className="mt-4 text-xl">Seite nicht gefunden</h2>
        <p className="mt-2 text-sm text-muted-foreground">Die Seite existiert nicht oder wurde verschoben.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-full bg-gold px-5 py-2.5 text-sm uppercase tracking-widest text-gold-foreground hover:opacity-90">
            Zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl">Diese Seite lädt nicht.</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full bg-gold px-5 py-2.5 text-sm uppercase tracking-widest text-gold-foreground hover:opacity-90">
            Neu versuchen
          </button>
          <a href="/" className="rounded-full border border-border px-5 py-2.5 text-sm uppercase tracking-widest hover:border-gold">Startseite</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Balkaneros — Homemade Cuisine" },
      { name: "description", content: "Balkaneros — Köstlichkeiten aus dem Herzen des Balkans." },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "Balkaneros — Homemade Cuisine" },
      { name: "twitter:title", content: "Balkaneros — Homemade Cuisine" },
      { property: "og:description", content: "Balkaneros — Köstlichkeiten aus dem Herzen des Balkans." },
      { name: "twitter:description", content: "Balkaneros — Köstlichkeiten aus dem Herzen des Balkans." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/69803e05-673c-4c8e-85c7-b633526dbec7" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/69803e05-673c-4c8e-85c7-b633526dbec7" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Inter:wght@300;400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    // Bei "Failed to fetch dynamically imported module" (alter Chunk nach Deploy)
    // die Seite automatisch einmal neu laden.
    void import("../lib/chunk-reload").then((m) => m.installChunkReload());
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <PageViewTracker />
      <Outlet />
      <BackToTop />
      <Toaster theme="dark" position="top-right" richColors />
    </QueryClientProvider>

  );
}

function AuthSync() {
  const qc = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [qc, router]);
  return null;
}

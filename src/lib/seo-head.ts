import type { SeoRow } from "./public.functions";

type LoaderShape = { seo?: Record<string, SeoRow> } | undefined;

export function buildSeoMeta(
  loaderData: LoaderShape,
  path: string,
  fallback: { title: string; description: string },
) {
  const row = loaderData?.seo?.[path];
  const title = row?.title || fallback.title;
  const description = row?.description || fallback.description;
  const ogImage = row?.og_image || "";
  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
  if (ogImage) {
    meta.push({ property: "og:image", content: ogImage });
    meta.push({ name: "twitter:image", content: ogImage });
    meta.push({ name: "twitter:card", content: "summary_large_image" });
  }
  return meta;
}

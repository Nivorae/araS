import { siteUrl } from "@/lib/site-url";

// A hand-built robots.txt instead of Next's `MetadataRoute.Robots` helper so we
// can emit a `Content-Signal` line (contentsignals.org / Cloudflare) — the
// helper only supports the standard directives.
export const dynamic = "force-static";

// Private, authenticated app routes. Everything else (marketing pages) is open
// to every crawler, AI included — araS wants maximum AI-search visibility.
const DISALLOW = ["/api/", "/assets", "/transactions", "/retirement", "/more", "/sso-callback"];

export function GET() {
  const body = [
    "# araS — search engines and AI crawlers welcome on the public pages.",
    "User-agent: *",
    // Explicit opt-in: allow use in search results, as AI answer-engine input,
    // and for AI training.
    "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
    "Allow: /",
    ...DISALLOW.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

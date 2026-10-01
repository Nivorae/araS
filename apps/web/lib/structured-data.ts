import { siteUrl } from "./site-url";

/**
 * The founder's own profiles, for the Person node (`/#founder`) on both the
 * homepage graph and /about. Personal accounts go here, not in the
 * Organization's SAME_AS. The Medium byline is "Max", hence the alternateName.
 */
export const FOUNDER_ALTERNATE_NAME = "Max";
export const FOUNDER_SAME_AS = ["https://medium.com/@dearno.3"];

interface Crumb {
  /** Visible label. */
  name: string;
  /** Path from the site root, e.g. "/support". Use "/" for the home crumb. */
  path: string;
}

/**
 * BreadcrumbList JSON-LD for a sub-page. Pass the trail *after* the home page —
 * the "首頁" crumb is prepended automatically.
 */
export function breadcrumbJsonLd(trail: Crumb[]) {
  const items: Crumb[] = [{ name: "首頁", path: "/" }, ...trail];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${siteUrl}${c.path === "/" ? "" : c.path}`,
    })),
  };
}

/**
 * FAQPage JSON-LD from a list of question/answer pairs. Answers must be the same
 * plain text shown on the page (Google requires markup to match visible content).
 */
export function faqPageJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

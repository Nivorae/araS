/**
 * The site's canonical origin, with any trailing slash removed.
 *
 * `robots.ts` and `sitemap.ts` build URLs by string concatenation, so a
 * `NEXT_PUBLIC_APP_URL` that ends in "/" (which Vercel's env editor happily
 * accepts) would emit `https://arasasset.com//sitemap.xml`. Normalising once
 * here keeps that impossible rather than relying on whoever edits the env var.
 */
export const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  ""
);

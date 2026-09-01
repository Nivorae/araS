import Script from "next/script";

/**
 * GA4 (gtag.js) loader. Renders nothing unless `NEXT_PUBLIC_GA_ID` is set — keep
 * it defined ONLY in Vercel's Production environment so dev and preview
 * deployments never send hits.
 *
 * Deliberately a hand-rolled `next/script` snippet rather than
 * `@next/third-parties/google`: adding that package forces a full reserialize of
 * `pnpm-lock.yaml` under the repo's pinned pnpm, which isn't worth it for two
 * script tags. `www.googletagmanager.com` is allow-listed in the CSP
 * (`script-src` + `connect-src`) in `next.config.ts`.
 */
export function GoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}

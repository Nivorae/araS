import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: false,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/[^/]+\/api\/(loans|transactions|entries|portfolio|recurrences).*/,
        handler: "NetworkOnly",
      },
      {
        urlPattern: /^https?:\/\/[^/]+\/api\/(stocks|exchange-rate|cathaylife-rates).*/,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "public-data", expiration: { maxAgeSeconds: 300 } },
      },
    ],
  },
});

const nextConfig = {
  experimental: {
    taint: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              process.env.NODE_ENV === "development"
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk-telemetry.com https://*.clerk.accounts.dev https://challenges.cloudflare.com"
                : "script-src 'self' 'unsafe-inline' https://clerk-telemetry.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' ws: wss: https://openapi.twse.com.tw https://clerk.com https://*.clerk.accounts.dev https://clerk-telemetry.com https://img.clerk.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io",
              "frame-src https://challenges.cloudflare.com",
              "worker-src blob: 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        source: "/api/(loans|transactions|entries|portfolio|recurrences)/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "Vary", value: "Cookie, Authorization" },
        ],
      },
    ];
  },
};

// No-ops (with a console warning) when org/project/authToken are unset — safe
// to deploy before Sentry is configured.
export default withSentryConfig(withPWA(nextConfig), {
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
  ...(process.env.SENTRY_AUTH_TOKEN ? { authToken: process.env.SENTRY_AUTH_TOKEN } : {}),
  silent: true,
  webpack: { treeshake: { removeDebugLogging: true } },
});

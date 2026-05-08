import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  disable: process.env.NODE_ENV === "development",
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
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Next.js dev mode needs 'unsafe-eval' for React Fast Refresh
              process.env.NODE_ENV === "development"
                ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk-telemetry.com https://*.clerk.accounts.dev https://challenges.cloudflare.com"
                : "script-src 'self' 'unsafe-inline' https://clerk-telemetry.com https://*.clerk.accounts.dev https://challenges.cloudflare.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self' ws: wss: https://openapi.twse.com.tw https://clerk.com https://*.clerk.accounts.dev https://clerk-telemetry.com https://img.clerk.com",
              "frame-src https://challenges.cloudflare.com",
              "worker-src blob: 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);

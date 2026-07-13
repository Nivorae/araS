import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: { default: "araS", template: "%s｜araS" },
  description: "個人資產管理工具",
  manifest: "/manifest.json",
  // Deny-by-default: most routes are private, authenticated finance data.
  // Public marketing pages explicitly override this with { index: true }.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="zh-TW">
        <head>
          <meta name="theme-color" content="#f2f2f7" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="資產管理工具" />
          <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
          <link rel="apple-touch-icon" href="/icons/app-icon.png" />
        </head>
        <body suppressHydrationWarning>
          <NextTopLoader color="#374254" height={3} showSpinner={false} shadow={false} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

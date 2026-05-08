import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

export const metadata: Metadata = {
  title: "araS",
  description: "個人財務管理工具",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="zh-TW">
        <head>
          <meta name="theme-color" content="#f2f2f7" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="財務管家" />
          <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        </head>
        <body suppressHydrationWarning>
          <NextTopLoader color="#374254" height={3} showSpinner={false} shadow={false} />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

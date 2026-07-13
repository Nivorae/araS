import type { Metadata } from "next";
import { LandingContent } from "./landing-content";

const TITLE = "araS｜把資產、負債、投資都管在一個 App";
const DESCRIPTION =
  "araS 個人資產管理工具，將資產、負債、投資、保險與退休規劃整合在一個乾淨俐落的介面，即時掌握你的淨值全貌。";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    siteName: "araS",
    images: [{ url: "/landing/og-image.png", width: 1200, height: 630 }],
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/landing/og-image.png"],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "araS",
  description: DESCRIPTION,
  applicationCategory: "FinanceApplication",
  operatingSystem: "iOS",
  offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" },
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger -- Next.js's documented pattern for JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingContent />
    </>
  );
}

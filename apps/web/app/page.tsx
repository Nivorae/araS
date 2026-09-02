import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { siteUrl } from "@/lib/site-url";
import { LANDING_FAQ } from "./landing-faq";
import { LandingContent } from "./landing-content";

const CONTACT_EMAIL = "milk88084@gmail.com";

const TITLE = "araS｜把資產、負債、投資都管在一個 App";
const DESCRIPTION =
  "araS 個人資產管理工具，將資產、負債、投資、保險與退休規劃整合在一個乾淨俐落的介面，即時掌握你的淨值全貌。";

// External profiles for entity disambiguation ("araS" collides with Aras Corp /
// 艾瑞斯資訊 in search). Add the Play Store + any social profiles here as they
// go live — keep them in sync with the download links in landing-content.tsx.
const SAME_AS = ["https://apps.apple.com/tw/app/id6785747999"];

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "araS",
    "araS 資產",
    "資產管理",
    "個人資產管理",
    "淨值",
    "記帳 App",
    "資產負債表",
    "投資組合追蹤",
    "退休規劃",
  ],
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
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "araS",
      alternateName: ["araS 資產", "araS 資產管理工具", "arasasset"],
      description: DESCRIPTION,
      url: siteUrl,
      logo: `${siteUrl}/icons/app-icon.png`,
      email: CONTACT_EMAIL,
      foundingDate: "2026",
      founder: {
        "@type": "Person",
        "@id": `${siteUrl}/#founder`,
        name: "KO CHUAN LI",
        jobTitle: "前端工程師",
      },
      sameAs: SAME_AS,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "araS",
      url: siteUrl,
      inLanguage: "zh-TW",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      name: "araS",
      description: DESCRIPTION,
      applicationCategory: "FinanceApplication",
      operatingSystem: "iOS, Android, Web",
      softwareVersion: "1.4",
      url: siteUrl,
      publisher: { "@id": `${siteUrl}/#organization` },
      offers: { "@type": "Offer", price: "0", priceCurrency: "TWD" },
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/#faq`,
      mainEntity: LANDING_FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <JsonLd data={jsonLd} />
      <LandingContent />
    </>
  );
}

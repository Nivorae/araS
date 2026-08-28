import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/assets", "/transactions", "/retirement", "/more", "/sso-callback"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

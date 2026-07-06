import type { Metadata } from "next";
import { LandingContent } from "./landing-content";

export const metadata: Metadata = {
  title: "araS｜把資產、負債、投資都管在一個 App",
  description:
    "araS 個人資產管理工具，將資產、負債、投資、保險與退休規劃整合在一個乾淨俐落的介面，即時掌握你的淨值全貌。",
};

export default function LandingPage() {
  return <LandingContent />;
}

import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { siteUrl } from "@/lib/site-url";
import { breadcrumbJsonLd } from "@/lib/structured-data";

const CONTACT_EMAIL = "milk88084@gmail.com";

const founderJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${siteUrl}/#founder`,
  name: "KO CHUAN LI",
  jobTitle: "前端工程師",
  description:
    "前端工程師，對 UI/UX 有強烈的設計美感，喜歡把介面質感往上提，目前獨力開發網頁與 App。",
  worksFor: { "@id": `${siteUrl}/#organization` },
};

export const metadata: Metadata = {
  title: "關於 araS",
  description:
    "araS 是一款由獨立開發者打造的個人資產管理工具，把資產、負債、投資、保險與退休規劃整合在同一個介面，即時計算新台幣淨值。提供 iOS、Android 與網頁版。",
  alternates: { canonical: "/about" },
  robots: { index: true, follow: true },
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[#1c1c1e] md:px-10 md:py-16">
      <JsonLd data={breadcrumbJsonLd([{ name: "關於 araS", path: "/about" }])} />
      <JsonLd data={founderJsonLd} />

      <h1 className="text-3xl font-bold tracking-tight">關於 araS</h1>

      <Section title="araS 是什麼">
        <p>
          araS 是一款個人資產管理工具，把現金、股票、基金、加密貨幣、貴金屬、不動產、
          貸款與保單，連同日常收支交易，整合在同一個介面，即時計算並呈現你的新台幣淨值。
          美股、加密貨幣與貴金屬等非台幣資產，會在顯示時自動換算成新台幣。
        </p>
        <p>
          araS 同時提供 iOS App、Android App 與網頁版，三者共用同一個帳號與同一份資料，
          在任一裝置登入後即時同步。你透過 Google 或 LINE 帳號登入，不需要另外設定密碼。
        </p>
      </Section>

      <Section title="為什麼做 araS">
        <p>
          araS 是一個由獨立開發者維護的個人專案。它最初是為了解決自己的
          需求：資產分散在銀行、券商、保單和不同 App 裡，沒有一個地方能一眼看清「現在
          到底有多少淨值」。市面上的工具不是綁定特定券商、就是把記帳和資產管理混在一起，
          所以決定自己做一個乾淨、專注在「淨值全貌」的版本。
        </p>
      </Section>

      <Section title="開發者">
        <p>
          araS 由前端工程師 <strong>KO CHUAN LI</strong> 獨力開發與維護。他對 UI/UX
          有強烈的設計美感，喜歡把介面質感往上提，目前獨自開發網頁與 App。araS
          就是這個取向下的作品：功能專注、介面乾淨。
        </p>
      </Section>

      <Section title="收費方式">
        <p>
          araS 可以免費使用，免費版可建立最多 20 筆資產或負債項目。需要更多額度與進階 功能時，可訂閱
          Premium 方案，目前透過 Apple App Store 內購，提供月繳與年繳， 實際價格以 App
          內顯示為準。訂閱可隨時在「App Store 帳戶設定」中關閉自動續訂。
        </p>
      </Section>

      <Section title="資料與隱私">
        <p>
          你的財務資料以 HTTPS 加密連線傳輸，僅與你的帳號關聯，只有你本人能存取。araS
          不會販售你的個人資料，也不會用於廣告追蹤。你可以隨時在 App 內的「設定」→
          「刪除帳號」永久刪除帳號與所有相關資料。詳見{" "}
          <Link className="text-[#374254] underline" href="/privacy">
            隱私權政策
          </Link>{" "}
          與{" "}
          <Link className="text-[#374254] underline" href="/terms">
            使用條款
          </Link>
          。
        </p>
      </Section>

      <Section title="聯絡">
        <p>對 araS 有任何問題、建議或合作提案，歡迎來信：</p>
        <p className="mt-2">
          <a className="font-medium text-[#374254] underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}

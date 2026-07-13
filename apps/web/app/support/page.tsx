import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "支援與聯絡",
  description: "araS 個人資產管理工具的使用支援與聯絡方式",
  alternates: { canonical: "/support" },
  robots: { index: true, follow: true },
};

const CONTACT_EMAIL = "milk88084@gmail.com";

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[#1c1c1e]">
      <h1 className="text-3xl font-bold tracking-tight">支援與聯絡</h1>
      <p className="mt-2 text-neutral-600">
        感謝你使用 araS。若你在使用上遇到問題、有功能建議，或需要協助，歡迎透過以下方式與我們聯繫。
      </p>

      <Section title="聯絡我們">
        <p>我們會儘快回覆你的來信。請寄信至：</p>
        <p className="mt-2">
          <a className="font-medium text-[#374254] underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </Section>

      <Section title="常見問題">
        <h3 className="mt-4 font-semibold">如何登入？</h3>
        <p>araS 透過 Google 或 LINE 帳號一鍵登入，你不需要另外設定密碼。</p>

        <h3 className="mt-4 font-semibold">我的資料安全嗎？</h3>
        <p>
          你的資料以加密連線（HTTPS）傳輸，並僅與你的帳號關聯，只有你本人能存取。我們不會販售你的個人資料，
          也不會用於廣告追蹤。詳見我們的
          <a className="text-[#374254] underline" href="/privacy">
            {" "}
            隱私權政策
          </a>
          。
        </p>

        <h3 className="mt-4 font-semibold">如何刪除我的帳號與資料？</h3>
        <p>
          你可以隨時刪除你在 App 中建立的財務資料。若你希望刪除整個帳號及其所有關聯資料，
          請寄信至上方電子郵件，主旨註明「刪除帳號」，並使用你註冊時的電子郵件來信。我們會在收到請求後的合理期間內，
          永久刪除你的帳號與所有相關資料。
        </p>
      </Section>

      <Section title="回報問題">
        <p>
          回報問題時，若能提供你使用的裝置型號、iOS
          版本，以及問題發生的步驟與畫面截圖，將有助於我們更快協助你。
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

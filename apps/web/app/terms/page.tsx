import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "使用條款",
  description: "araS 個人資產管理工具的使用條款與訂閱條款（EULA）",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

const LAST_UPDATED = "2026 年 7 月 27 日";
const CONTACT_EMAIL = "milk88084@gmail.com";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[#1c1c1e] md:px-10 md:py-16">
      <h1 className="text-3xl font-bold tracking-tight">使用條款</h1>
      <p className="mt-2 text-sm text-neutral-500">最後更新日期：{LAST_UPDATED}</p>

      <Section title="1. 條款的接受">
        <p>
          araS（以下稱「本服務」或「本 App」）是一款個人資產管理工具。當您下載、安裝或使用本服務時，
          即表示您已閱讀、理解並同意接受本使用條款（以下稱「本條款」）之全部內容。
          若您不同意本條款，請勿使用本服務。
        </p>
      </Section>

      <Section title="2. 服務說明">
        <p>
          本服務協助您記錄與檢視個人的資產、負債、收支、投資組合、保險與退休規劃等財務資訊。
          本服務所提供的任何數據、圖表或試算結果僅供您個人記錄與參考之用，
          <strong>不構成任何投資、稅務、法律或財務建議</strong>。您應對自己的財務決策負完全責任。
        </p>
      </Section>

      <Section title="3. 帳號與使用者責任">
        <p>
          您需透過第三方帳號（Google／LINE）登入本服務。您應對於在您帳號下發生的所有活動負責，
          並確保您輸入的資料正確。您同意不從事任何違法、破壞服務運作或侵害他人權益的行為。
        </p>
      </Section>

      <Section title="4. 訂閱條款（自動續訂）">
        <p>
          本服務提供付費訂閱方案（Premium），以解鎖進階功能。訂閱透過 Apple App Store 內購買進行，
          並適用以下條款：
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>方案與價格</strong>：提供月繳與年繳方案，實際價格、計費週期與方案內容以 App
            內付費牆及 App Store 顯示者為準。
          </li>
          <li>
            <strong>付款</strong>：確認購買後，費用將由您的 Apple ID 帳戶支付。
          </li>
          <li>
            <strong>自動續訂</strong>：訂閱會自動續訂，除非您在當期結束前至少 24
            小時關閉自動續訂。系統將於當期結束前 24 小時內，向您的 Apple ID 帳戶收取續訂費用。
          </li>
          <li>
            <strong>管理與取消</strong>：您可隨時於裝置的「App Store
            帳戶設定」中管理或關閉自動續訂。
            取消將於當期結束後生效，當期已支付的費用不予退還（法律另有規定者除外）。
          </li>
          <li>
            <strong>退款</strong>：透過 App Store 購買的款項，其退款依 Apple
            的政策辦理，本服務無法直接處理退款。
          </li>
        </ul>
      </Section>

      <Section title="5. 智慧財產權">
        <p>
          本服務及其介面、程式碼、設計與商標等，均為本服務提供者所有，受相關法律保護。
          未經授權，您不得重製、修改、散布或以其他方式利用本服務的任何部分。您輸入的財務資料仍屬於您本人。
        </p>
      </Section>

      <Section title="6. 免責聲明">
        <p>
          本服務以「現狀」及「現有」基礎提供，不對其可用性、正確性、及時性或不中斷運作作任何明示或默示之保證。
          市場資料（如股價、匯率）來自第三方公開來源，可能有延遲或誤差，僅供參考。
          您應自行備份重要資料。
        </p>
      </Section>

      <Section title="7. 責任限制">
        <p>
          在適用法律允許的最大範圍內，對於因使用或無法使用本服務所導致的任何直接、間接、附帶或衍生之損害
          （包括但不限於財務損失或資料遺失），本服務提供者不負賠償責任。
        </p>
      </Section>

      <Section title="8. 條款變更">
        <p>
          我們可能不時修訂本條款。任何變更將於本頁面公布，並更新上方的「最後更新日期」。
          變更後您繼續使用本服務，即視為接受修訂後的條款。
        </p>
      </Section>

      <Section title="9. 聯絡我們">
        <p>若您對本使用條款有任何疑問，歡迎透過電子郵件與我們聯繫：</p>
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

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隱私權政策 | araS",
  description: "araS 個人資產管理工具的隱私權政策",
};

const LAST_UPDATED = "2026 年 6 月 30 日";
const CONTACT_EMAIL = "milk88084@gmail.com";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-[#1c1c1e]">
      <h1 className="text-3xl font-bold tracking-tight">隱私權政策</h1>
      <p className="mt-2 text-sm text-neutral-500">最後更新日期：{LAST_UPDATED}</p>

      <Section title="1. 前言">
        <p>
          araS（以下稱「本服務」）是一款個人資產管理工具，協助您記錄與檢視自己的資產、負債、收支、投資與退休規劃。
          我們重視您的隱私，本政策說明我們蒐集哪些資料、如何使用與保護這些資料，以及您擁有的權利。
          使用本服務即表示您同意本政策所述的做法。
        </p>
      </Section>

      <Section title="2. 我們蒐集的資料">
        <h3 className="mt-4 font-semibold">2.1 帳號與身分資料</h3>
        <p>
          本服務使用第三方驗證服務 Clerk 進行登入。當您透過 Google 或 LINE
          登入時，我們會接收並儲存您的
          電子郵件地址、顯示名稱與帳號識別碼，用以建立並識別您的帳號。我們<strong>不會</strong>
          取得或儲存您的 第三方帳號密碼。
        </p>
        <h3 className="mt-4 font-semibold">2.2 您建立的財務資料</h3>
        <p>
          您主動輸入的內容，例如資產與負債項目、交易紀錄、投資組合、保險與退休規劃參數等。這些資料由您自行輸入，
          僅與您的帳號關聯，並只供您本人檢視。
        </p>
        <h3 className="mt-4 font-semibold">2.3 技術資料</h3>
        <p>
          為維持服務運作與安全，系統可能記錄必要的技術資訊，例如連線時間與基本的錯誤／安全事件紀錄。
          我們<strong>不會</strong>將這些資料用於廣告追蹤。
        </p>
      </Section>

      <Section title="3. 我們如何使用資料">
        <ul className="list-disc space-y-1 pl-5">
          <li>提供、維護並改善本服務的核心功能（記錄與顯示您的個人財務資料）。</li>
          <li>驗證您的身分並保護您的帳號安全。</li>
          <li>回應您的詢問與提供必要的客戶支援。</li>
          <li>遵循適用的法律義務。</li>
        </ul>
        <p className="mt-3">
          我們<strong>不會</strong>將您的資料用於投放廣告，<strong>不會</strong>
          販售或出租您的個人資料給任何第三方。
        </p>
      </Section>

      <Section title="4. 第三方服務">
        <p>本服務仰賴下列第三方服務以維持運作：</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Clerk</strong>：提供身分驗證與帳號管理（Google／LINE 登入）。
          </li>
          <li>
            <strong>Supabase</strong>：提供資料庫，安全儲存您的帳號與財務資料。
          </li>
          <li>
            <strong>市場資料來源</strong>
            ：為顯示股價、匯率等資訊，本服務會向公開的市場資料供應商查詢， 此類查詢
            <strong>不包含</strong>您的個人身分資料。
          </li>
        </ul>
        <p className="mt-3">
          這些服務各自的資料處理受其隱私權政策規範。我們僅在提供本服務所必要的範圍內與其交換資料。
        </p>
      </Section>

      <Section title="5. 資料儲存與安全">
        <p>
          您的資料儲存於受存取控制保護的雲端資料庫，傳輸過程以 HTTPS
          加密。每一筆查詢都以您的帳號識別碼進行隔離，
          確保您只能存取自己的資料。儘管我們採取合理的技術與管理措施保護您的資料，但沒有任何網路傳輸或儲存方式能保證
          百分之百安全。
        </p>
      </Section>

      <Section title="6. 資料保留與刪除">
        <p>
          我們在您使用本服務期間保留您的資料。您可以隨時刪除您在本服務中建立的財務資料。
          若您希望刪除整個帳號及其關聯的所有資料，請透過下方電子郵件與我們聯繫，我們將在合理期間內處理。
        </p>
      </Section>

      <Section title="7. 您的權利">
        <p>在適用法律允許的範圍內，您有權：</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>存取並檢視我們持有的、關於您的個人資料。</li>
          <li>更正不正確的資料。</li>
          <li>要求刪除您的資料與帳號。</li>
        </ul>
        <p className="mt-3">如需行使上述權利，請透過下方聯絡方式與我們聯繫。</p>
      </Section>

      <Section title="8. 兒童隱私">
        <p>
          本服務並非針對未滿 13 歲之兒童設計，我們不會在知情的情況下蒐集兒童的個人資料。
          若您認為兒童向我們提供了個人資料，請與我們聯繫，我們將儘速移除。
        </p>
      </Section>

      <Section title="9. 政策變更">
        <p>
          我們可能不時更新本政策。任何變更將於本頁面公布，並更新上方的「最後更新日期」。
          建議您定期查閱本頁面以了解最新內容。
        </p>
      </Section>

      <Section title="10. 聯絡我們">
        <p>若您對本隱私權政策有任何疑問，或希望行使您的資料權利，歡迎透過電子郵件與我們聯繫：</p>
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

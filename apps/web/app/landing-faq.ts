/**
 * Landing-page FAQ. Single source shared by the visible `<Faq>` section
 * (landing-content.tsx) and the `FAQPage` JSON-LD (page.tsx) so the structured
 * data always matches the rendered text — a Google requirement for FAQ rich
 * results. Answers are plain text (no markup): the JSON-LD needs them raw and
 * the UI renders them as-is.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const LANDING_FAQ: FaqItem[] = [
  {
    q: "araS 是什麼？",
    a: "araS 是一款個人資產管理工具，把資產、負債、收支交易、投資組合、保險與退休規劃整合在同一個介面，即時計算並呈現你的淨值全貌。提供 iOS、Android 與網頁版。",
  },
  {
    q: "araS 免費嗎？",
    a: "是，araS 可以免費使用。免費版可建立最多 20 筆資產或負債項目；需要更多額度與進階功能時，可訂閱 Premium 方案。",
  },
  {
    q: "Premium 訂閱包含什麼？如何取消？",
    a: "Premium 解除項目數量上限並開啟進階功能，目前透過 Apple App Store 內購訂閱，可選擇月繳或年繳，實際價格以 App 內顯示為準。訂閱會自動續訂，你可以隨時在裝置的「App Store 帳戶設定」中關閉自動續訂，於當期結束後生效。",
  },
  {
    q: "要怎麼登入？需要設定密碼嗎？",
    a: "araS 透過 Google 或 LINE 帳號一鍵登入，不需要另外設定或記憶密碼。",
  },
  {
    q: "我的財務資料安全嗎？",
    a: "你的資料以 HTTPS 加密連線傳輸，並且僅與你的帳號關聯，只有你本人能存取。我們不會販售你的個人資料，也不會用於廣告追蹤。",
  },
  {
    q: "可以管理哪些類型的資產？",
    a: "現金存款、股票與基金、加密貨幣、貴金屬、不動產、貸款與負債、保單，以及日常收支交易都能記錄。美股、加密貨幣與貴金屬等非台幣資產，會在顯示時自動換算成新台幣。",
  },
  {
    q: "網頁版和手機 App 的資料會同步嗎？",
    a: "會。網頁版與 iOS、Android App 共用同一個帳號與同一份資料，在任一裝置登入後都會即時同步。",
  },
  {
    q: "要怎麼刪除我的帳號與資料？",
    a: "登入後在 App 內點選「設定」→「刪除帳號」並確認，帳號與所有相關資料會立即永久刪除、無法復原。若你無法登入 App，也可以寄信到 milk88084@gmail.com，主旨註明「刪除帳號」，並使用註冊時的電子郵件來信。",
  },
];

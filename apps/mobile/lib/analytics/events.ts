/**
 * 行為分析事件的唯一定義來源。
 *
 * 規則：**任何地方都不准寫事件名稱的字串字面量**，一律從這裡 import。
 * 事件名稱一旦送進 PostHog 就等於歷史資料的 key —— 打錯字或兩處寫法不一致，
 * 漏斗會靜靜地少算一段而不會報錯，所以名稱只存在於這一個檔案裡。
 *
 * 命名一律 snake_case（PostHog 慣例，也讓後台事件列表排序穩定）。
 */

export const ANALYTICS_EVENTS = {
  /** App 進入前景：冷啟動與從背景喚醒都算。 */
  APP_OPEN: "app_open",
  /** 新手引導最後一步完成（略過不算 —— 略過是流失，用「沒有這個事件」來量測）。 */
  ONBOARDING_COMPLETE: "onboarding_complete",
  /** 生涯第一筆資產紀錄寫入成功。每台裝置只會有一次。 */
  FIRST_RECORD_CREATED: "first_record_created",
  /** 每一次成功新增資產／負債紀錄。 */
  RECORD_CREATED: "record_created",
  /** 訂閱頁真的顯示在畫面上。 */
  PAYWALL_VIEWED: "paywall_viewed",
  /** 點擊訂閱 CTA，不論後續成功、取消或失敗。 */
  SUBSCRIBE_CLICKED: "subscribe_clicked",
  /** 金流回報購買成功。 */
  SUBSCRIBE_SUCCESS: "subscribe_success",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/**
 * 每個事件允許帶的參數。
 *
 * 這份型別是「不要送出個資」的第一道防線：`track()` 的簽章綁在這張表上，
 * 所以想多送一個 email、姓名、帳目名稱或金額，會是 **編譯錯誤**，而不是
 * 上線之後才在 PostHog 後台被發現。
 */
export interface AnalyticsEventProperties {
  [ANALYTICS_EVENTS.APP_OPEN]: { is_first_open: boolean };
  [ANALYTICS_EVENTS.ONBOARDING_COMPLETE]: { steps_completed: number };
  [ANALYTICS_EVENTS.FIRST_RECORD_CREATED]: { seconds_since_first_open: number };
  /** `record_type` 只帶頂層分類（流動資金／投資／不動產／負債…），不帶名稱或金額。 */
  [ANALYTICS_EVENTS.RECORD_CREATED]: { record_type: string };
  [ANALYTICS_EVENTS.PAYWALL_VIEWED]: { trigger_source: PaywallSource };
  [ANALYTICS_EVENTS.SUBSCRIBE_CLICKED]: { plan: string };
  [ANALYTICS_EVENTS.SUBSCRIBE_SUCCESS]: { plan: string; is_trial: boolean };
}

/**
 * 訂閱頁的入口。App 裡每一個 `router.push("/paywall")` 都要帶其中一個值，
 * 這樣「哪個入口最會帶來付費」才答得出來。
 *
 * `unknown` 是防呆用的：萬一將來有人新增入口卻忘了帶 source，事件不會消失，
 * 只會落在 `unknown` 這一格，在後台一眼就看得出來有漏。
 */
export const PAYWALL_SOURCES = {
  /** 資產損益頁的「配置」分頁（Premium 功能）。 */
  ALLOCATION_TAB: "allocation_tab",
  /** 資產損益頁的「股息」分頁（Premium 功能）。 */
  DIVIDEND_TAB: "dividend_tab",
  /** 設定頁的「升級 Premium」卡片。 */
  SETTINGS_CARD: "settings_card",
  /** 新增資產時撞到免費版 20 筆上限的 Alert。 */
  ENTRY_LIMIT: "entry_limit",
  /** 新增／編輯保單時的 Premium 提示。 */
  INSURANCE_FORM: "insurance_form",
  /** 新增股利紀錄時的 Premium 提示。 */
  DIVIDEND_FORM: "dividend_form",
  /** 股利再投資時的 Premium 提示。 */
  DIVIDEND_REINVEST: "dividend_reinvest",
  /** 沒帶 source 就進到訂閱頁（例如深連結，或未來新增入口時漏帶）。 */
  UNKNOWN: "unknown",
} as const;

export type PaywallSource = (typeof PAYWALL_SOURCES)[keyof typeof PAYWALL_SOURCES];

const PAYWALL_SOURCE_VALUES: readonly string[] = Object.values(PAYWALL_SOURCES);

/** 把路由參數（`string | string[] | undefined`）收斂成一個合法的 source。 */
export function toPaywallSource(raw: unknown): PaywallSource {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === "string" && PAYWALL_SOURCE_VALUES.includes(value)
    ? (value as PaywallSource)
    : PAYWALL_SOURCES.UNKNOWN;
}

import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 漏斗需要「跨啟動記得」的兩件事：這台裝置第一次開啟 App 是什麼時候，
 * 以及生涯第一筆紀錄的事件送出去了沒有。
 *
 * 存 AsyncStorage（App 內已在用的同一套持久化），不存後端 —— 這兩個旗標是
 * 裝置層級的，跟帳號無關，也不該讓一個分析需求多開一張表。
 *
 * 所有讀寫都吞掉例外：AsyncStorage 讀不到只代表「這次量不到」，
 * 不可以讓新增資產的流程失敗。
 */

const FIRST_OPEN_AT_KEY = "analytics.firstOpenAt";
const FIRST_RECORD_TRACKED_KEY = "analytics.firstRecordTracked";

export interface FirstOpenState {
  /** 這次啟動是不是這台裝置的第一次開啟。 */
  isFirstOpen: boolean;
  /** 第一次開啟的時間戳（ms）。讀取失敗時退回「現在」。 */
  firstOpenAt: number;
}

/**
 * 讀出第一次開啟的時間；沒有紀錄就把「現在」寫進去並回報 isFirstOpen = true。
 *
 * 「先讀再寫」而不是每次啟動都寫：`is_first_open` 是安裝後只會為真一次的值，
 * 重寫會讓每次冷啟動都看起來像新安裝，啟用率的分母就整個壞掉。
 */
export async function readOrCreateFirstOpen(): Promise<FirstOpenState> {
  const now = Date.now();
  try {
    const stored = await AsyncStorage.getItem(FIRST_OPEN_AT_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if (Number.isFinite(parsed)) return { isFirstOpen: false, firstOpenAt: parsed };

    await AsyncStorage.setItem(FIRST_OPEN_AT_KEY, String(now));
    return { isFirstOpen: true, firstOpenAt: now };
  } catch {
    // 存取失敗時當成「不是第一次」——寧可少算一個首開，也不要把每次啟動
    // 都灌成新使用者、把啟用率的分母灌水。
    return { isFirstOpen: false, firstOpenAt: now };
  }
}

/** 從第一次開啟到現在經過幾秒；量不到時回 null（呼叫端就不帶這個參數）。 */
export async function secondsSinceFirstOpen(): Promise<number | null> {
  try {
    const stored = await AsyncStorage.getItem(FIRST_OPEN_AT_KEY);
    const parsed = stored ? Number(stored) : NaN;
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.round((Date.now() - parsed) / 1000));
  } catch {
    return null;
  }
}

/** `first_record_created` 是否已經送過。讀取失敗時回 true = 不重送。 */
export async function hasTrackedFirstRecord(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(FIRST_RECORD_TRACKED_KEY)) === "1";
  } catch {
    // 失效方向刻意選「已送過」：重複送出的假 activation 會讓啟用率虛高，
    // 比漏送一筆更難察覺、也更難修。
    return true;
  }
}

/** 標記 `first_record_created` 已送出。 */
export async function markFirstRecordTracked(): Promise<void> {
  try {
    await AsyncStorage.setItem(FIRST_RECORD_TRACKED_KEY, "1");
  } catch {
    // 寫入失敗只會讓下一次新增再送一次事件，可以接受。
  }
}

/** 只給 dev 驗證用：清掉旗標，讓下次啟動重演「首次開啟 + 第一筆」。 */
export async function resetFunnelStateForTesting(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([FIRST_OPEN_AT_KEY, FIRST_RECORD_TRACKED_KEY]);
  } catch {
    // 測試用途，失敗不需要處理。
  }
}

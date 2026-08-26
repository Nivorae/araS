import { ANALYTICS_EVENTS } from "./events";
import { track } from "./track";
import {
  hasTrackedFirstRecord,
  markFirstRecordTracked,
  readOrCreateFirstOpen,
  secondsSinceFirstOpen,
} from "./funnelState";

/**
 * 需要讀寫持久化旗標的兩個事件，包成非同步的 helper。
 *
 * 放在這裡而不是元件裡，是為了讓「什麼時候算第一次」這個判斷只有一份實作：
 * 散在畫面各處的話，第二個呼叫點很容易忘了檢查旗標。
 *
 * 兩個函式都不會 throw、也不回傳值 —— 呼叫端 `void` 掉即可，不需要 await，
 * 更不需要因為它們而讓儲存流程多等一次 AsyncStorage。
 */

/** `app_open`：冷啟動與從背景喚醒都呼叫這一個。 */
export async function trackAppOpen(): Promise<void> {
  try {
    const { isFirstOpen } = await readOrCreateFirstOpen();
    track(ANALYTICS_EVENTS.APP_OPEN, { is_first_open: isFirstOpen });
  } catch {
    // readOrCreateFirstOpen 自己已經吞過例外，這裡是最後一道保險。
  }
}

/**
 * `record_created`（每次都送）＋ `first_record_created`（生涯只送一次）。
 *
 * 順序刻意是「先送 record_created」：即使旗標讀寫出問題，每筆新增的計數
 * 也不會受影響。
 */
export async function trackRecordCreated(recordType: string): Promise<void> {
  track(ANALYTICS_EVENTS.RECORD_CREATED, { record_type: recordType });

  try {
    if (await hasTrackedFirstRecord()) return;
    const seconds = await secondsSinceFirstOpen();
    track(ANALYTICS_EVENTS.FIRST_RECORD_CREATED, {
      seconds_since_first_open: seconds ?? 0,
    });
    await markFirstRecordTracked();
  } catch {
    // 同上：量不到就算了，不能影響已經成功的儲存。
  }
}

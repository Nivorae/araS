import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";

const STORAGE_KEY = "settings.appLockEnabled";

/**
 * 從背景回來時，離開超過這麼久才重新要求解鎖。短暫切出去（回個訊息、複製
 * 帳號）不打擾；真的放下手機一段時間才鎖。冷啟動一律要解鎖，不看這個值。
 */
export const RELOCK_AFTER_MS = 60_000;

export async function isAppLockEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(next: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, next ? "1" : "0");
}

export type LockAvailability =
  | { ok: true; label: string }
  | { ok: false; reason: "no-hardware" | "not-enrolled" };

/**
 * 手機有沒有可用的生物辨識，以及要怎麼稱呼它。沒有硬體或沒註冊時不開放開啟 ——
 * 否則開關打開後唯一的解鎖方式只剩手機密碼，名不副實。
 */
export async function getLockAvailability(): Promise<LockAvailability> {
  const [hasHardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  if (!hasHardware) return { ok: false, reason: "no-hardware" };
  if (!enrolled) return { ok: false, reason: "not-enrolled" };
  return { ok: true, label: biometricLabel(types) };
}

function biometricLabel(types: LocalAuthentication.AuthenticationType[]): string {
  const T = LocalAuthentication.AuthenticationType;
  if (types.includes(T.FACIAL_RECOGNITION)) return "臉部辨識";
  if (types.includes(T.FINGERPRINT)) return "指紋";
  if (types.includes(T.IRIS)) return "虹膜辨識";
  return "生物辨識";
}

/** 跳出系統的生物辨識視窗；辨識失敗可改用手機密碼。 */
export async function authenticate(promptMessage = "解鎖 araS"): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "取消",
      fallbackLabel: "使用密碼",
    });
    return result.success;
  } catch {
    return false;
  }
}

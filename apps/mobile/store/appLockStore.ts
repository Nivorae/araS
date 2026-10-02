import { create } from "zustand";

export type AppLockStatus = "checking" | "locked" | "unlocked";

interface AppLockState {
  status: AppLockStatus;
  /** 鎖定畫面上顯示的解鎖方式名稱（Face ID、Touch ID…）。 */
  label: string;
  unlock: () => void;
  set: (patch: Partial<Omit<AppLockState, "set">>) => void;
}

// AppLockGate 寫、LockScreen 讀。鎖定畫面要同時畫在主畫面和每個開著的 Modal
// 裡（見 components/Modal.tsx），所以狀態放在 store 而不是 AppLockGate 的 state。
// 預設 unlocked：沒登入時 AppLockGate 不存在，Modal 裡也就不該出現鎖定畫面。
export const useAppLockStore = create<AppLockState>()((set) => ({
  status: "unlocked",
  label: "生物辨識",
  unlock: () => {},
  set: (patch) => set(patch),
}));

import { create } from "zustand";
import { DemoEngine } from "@/lib/demo/engine";
import type { DemoNav } from "@/lib/demo/types";

interface DemoStoreState {
  /** 有值 = 示範模式中。它同時就是示範資料本身，離開時整個丟掉。 */
  engine: DemoEngine | null;
  /**
   * 每次進出示範就加一。兩個用途：(app)/_layout 拿它當 Stack 的 key 讓畫面樹
   * 重新掛載；會寫進 financeStore 的讀取拿它判斷回應是不是屬於上一個狀態的。
   */
  generation: number;
  enteredAt: number | null;
  /** 進出示範後要導去的畫面，由 (app)/_layout 的 DemoNavigator 消化。 */
  pendingNav: DemoNav | null;

  start: (nav: DemoNav) => void;
  stop: (nav: DemoNav | null) => void;
  clearPendingNav: () => void;
}

export const useDemoStore = create<DemoStoreState>()((set) => ({
  engine: null,
  generation: 0,
  enteredAt: null,
  pendingNav: null,

  start: (nav) =>
    set((s) => ({
      engine: new DemoEngine(),
      generation: s.generation + 1,
      enteredAt: Date.now(),
      pendingNav: nav,
    })),

  stop: (nav) =>
    set((s) => ({ engine: null, generation: s.generation + 1, enteredAt: null, pendingNav: nav })),

  clearPendingNav: () => set({ pendingNav: null }),
}));

/** 給 hook 以外的地方（分析、session）讀目前是否在示範中。 */
export function isDemoActive(): boolean {
  return useDemoStore.getState().engine !== null;
}

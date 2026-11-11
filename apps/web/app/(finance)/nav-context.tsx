"use client";

import { createContext, useContext, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface NavContextValue {
  addAction: (() => void) | null;
  setAddAction: (fn: (() => void) | null) => void;
  /** The finance tab shown before the current one (for directional tab transitions). */
  previousPath: string | null;
}

export const NavContext = createContext<NavContextValue>({
  addAction: null,
  setAddAction: () => {},
  previousPath: null,
});

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [addAction, setAddAction] = useState<(() => void) | null>(null);
  const pathname = usePathname();
  // The layout persists across tab navigations, so a ref here sees each change.
  const last = useRef(pathname);
  const previous = useRef<string | null>(null);
  if (last.current !== pathname) {
    previous.current = last.current;
    last.current = pathname;
  }
  return (
    <NavContext.Provider value={{ addAction, setAddAction, previousPath: previous.current }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNavContext() {
  return useContext(NavContext);
}

const TAB_ORDER = ["/assets", "/transactions", "/retirement", "/more"];

/**
 * +1 when arriving from a tab to the left (enter from the right), −1 from the
 * right, 0 on a direct load — read once on mount.
 */
export function useTabEnterDirection(current: string): number {
  const { previousPath } = useNavContext();
  const [dir] = useState(() => {
    const from = previousPath ? TAB_ORDER.indexOf(previousPath) : -1;
    const to = TAB_ORDER.indexOf(current);
    if (from === -1 || to === -1 || from === to) return 0;
    return from < to ? 1 : -1;
  });
  return dir;
}

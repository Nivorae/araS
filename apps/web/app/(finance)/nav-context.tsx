"use client";

import { createContext, useContext, useState } from "react";

interface NavContextValue {
  addAction: (() => void) | null;
  setAddAction: (fn: (() => void) | null) => void;
}

export const NavContext = createContext<NavContextValue>({
  addAction: null,
  setAddAction: () => {},
});

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [addAction, setAddAction] = useState<(() => void) | null>(null);
  return <NavContext.Provider value={{ addAction, setAddAction }}>{children}</NavContext.Provider>;
}

export function useNavContext() {
  return useContext(NavContext);
}

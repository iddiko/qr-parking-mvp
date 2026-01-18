"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

type RightPanelState = {
  content: ReactNode | null;
  setContent: (node: ReactNode | null) => void;
};

const RightPanelContext = createContext<RightPanelState | null>(null);

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const value = useMemo(() => ({ content, setContent }), [content]);
  return <RightPanelContext.Provider value={value}>{children}</RightPanelContext.Provider>;
}

export function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) {
    return { content: null, setContent: () => {} };
  }
  return ctx;
}

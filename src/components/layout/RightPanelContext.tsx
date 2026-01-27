"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

type RightPanelState = {
  content: ReactNode | null;
  setContent: (node: ReactNode | null) => void;
  visible: boolean;
  setVisible: (next: boolean) => void;
};

const RightPanelContext = createContext<RightPanelState | null>(null);

export function RightPanelProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode | null>(null);
  const [visible, setVisible] = useState(true);
  const value = useMemo(
    () => ({ content, setContent, visible, setVisible }),
    [content, visible]
  );
  return <RightPanelContext.Provider value={value}>{children}</RightPanelContext.Provider>;
}

export function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) {
    return { content: null, setContent: () => {}, visible: true, setVisible: () => {} };
  }
  return ctx;
}

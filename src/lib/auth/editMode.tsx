"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type EditModeContextValue = {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
};

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function EditModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("edit-mode");
    if (stored === "true") {
      setEnabled(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("edit-mode", enabled ? "true" : "false");
  }, [enabled]);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled]);

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx) {
    throw new Error("EditModeProvider is missing");
  }
  return ctx;
}

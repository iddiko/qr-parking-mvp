"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";
import { Footer } from "./Footer";
import { BodyGrid } from "./BodyGrid";
import { EditModeProvider } from "@/lib/auth/editMode";
import { RightPanelProvider } from "./RightPanelContext";

type AppFrameProps = {
  children: ReactNode;
  complexName?: string;
  showEditToggle?: boolean;
};

export function AppFrame({ children, complexName, showEditToggle }: AppFrameProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <EditModeProvider>
      <RightPanelProvider>
        <div className="app-frame">
          <Header
            complexName={complexName}
            showEditToggle={showEditToggle}
            onMenuToggle={() => setSidebarOpen((prev) => !prev)}
          />
          <BodyGrid>
            <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            <main className="content">{children}</main>
            <RightPanel />
          </BodyGrid>
          <Footer />
        </div>
      </RightPanelProvider>
    </EditModeProvider>
  );
}

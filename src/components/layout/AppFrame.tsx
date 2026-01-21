"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { RightPanel } from "@/components/layout/RightPanel";
import { Footer } from "@/components/layout/Footer";
import { BodyGrid } from "@/components/layout/BodyGrid";
import { EditModeProvider } from "@/lib/auth/editMode";
import { RightPanelProvider } from "@/components/layout/RightPanelContext";

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
          <Footer onMenuToggle={() => setSidebarOpen((prev) => !prev)} />
        </div>
      </RightPanelProvider>
    </EditModeProvider>
  );
}

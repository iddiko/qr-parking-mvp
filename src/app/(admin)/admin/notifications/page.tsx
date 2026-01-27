"use client";

import { useEffect } from "react";
import { NotificationsList } from "@/components/layout/NotificationsList";
import { AdminRoleGuard } from "@/components/layout/AdminRoleGuard";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { useRightPanel } from "@/components/layout/RightPanelContext";

export default function Page() {
  const { setContent, setVisible } = useRightPanel();

  useEffect(() => {
    setContent(null);
    setVisible(false);
    return () => setVisible(true);
  }, [setContent, setVisible]);

  return (
    <AdminRoleGuard>
      <MenuGuard roleGroup="sub" toggleKey="notifications">
        <div>
          <h1 className="page-title">알림</h1>
          <NotificationsList />
        </div>
      </MenuGuard>
    </AdminRoleGuard>
  );
}

import type { ReactNode } from "react";
import { AppFrame } from "../../components/layout/AppFrame";
import { RoleGuard } from "../../components/layout/RoleGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={["SUPER", "MAIN", "SUB"]} message="관리자 전용 화면입니다.">
      <AppFrame showEditToggle>{children}</AppFrame>
    </RoleGuard>
  );
}

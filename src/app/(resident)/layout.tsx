import type { ReactNode } from "react";
import { AppFrame } from "../../components/layout/AppFrame";
import { RoleGuard } from "../../components/layout/RoleGuard";

export default function ResidentLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={["RESIDENT"]} message="입주민 전용 화면입니다.">
      <AppFrame showEditToggle={false}>{children}</AppFrame>
    </RoleGuard>
  );
}

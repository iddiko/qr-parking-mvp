import type { ReactNode } from "react";
import { AppFrame } from "../../components/layout/AppFrame";
import { RoleGuard } from "../../components/layout/RoleGuard";

export default function GuardLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGuard allowedRoles={["GUARD"]} message="경비 전용 화면입니다.">
      <AppFrame showEditToggle={false}>{children}</AppFrame>
    </RoleGuard>
  );
}

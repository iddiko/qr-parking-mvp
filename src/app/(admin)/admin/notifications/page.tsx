import { NotificationsList } from "@/components/layout/NotificationsList";
import { AdminRoleGuard } from "@/components/layout/AdminRoleGuard";
import { MenuGuard } from "@/components/layout/MenuGuard";

export default function Page() {
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

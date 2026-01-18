import { NotificationsList } from "@/components/layout/NotificationsList";
import { MenuGuard } from "@/components/layout/MenuGuard";

export default function Page() {
  return (
    <MenuGuard roleGroup="resident" toggleKey="alerts">
      <div>
        <h1 className="page-title">알림</h1>
        <NotificationsList />
      </div>
    </MenuGuard>
  );
}

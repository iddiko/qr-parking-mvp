import { MenuGuard } from "@/components/layout/MenuGuard";
import { NotificationsList } from "@/components/layout/NotificationsList";

export default function Page() {
  return (
    <MenuGuard roleGroup="resident" toggleKey="notifications">
      <div>
        <h1 className="page-title">알림 내역</h1>
        <NotificationsList />
      </div>
    </MenuGuard>
  );
}

import { MenuGuard } from "@/components/layout/MenuGuard";
import { NotificationsList } from "@/components/layout/NotificationsList";

export default function Page() {
  return (
    <MenuGuard roleGroup="guard" toggleKey="notifications">
      <div>
        <h1 className="page-title">알림</h1>
        <NotificationsList />
      </div>
    </MenuGuard>
  );
}

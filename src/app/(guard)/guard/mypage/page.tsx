import { MenuGuard } from "@/components/layout/MenuGuard";
import { UserProfileCard } from "@/components/layout/UserProfileCard";

export default function Page() {
  return (
    <MenuGuard roleGroup="guard" toggleKey="mypage">
      <div>
        <h1 className="page-title">?????</h1>
        <UserProfileCard />
      </div>
    </MenuGuard>
  );
}

import { MenuGuard } from "@/components/layout/MenuGuard";
import { UserProfileCard } from "@/components/layout/UserProfileCard";
import { ResidentQrPanel } from "@/components/layout/ResidentQrPanel";

export default function Page() {
  return (
    <MenuGuard roleGroup="resident" toggleKey="mypage">
      <div>
        <h1 className="page-title">?????</h1>
        <UserProfileCard />
        <div style={{ marginTop: "12px" }}>
          <ResidentQrPanel />
        </div>
      </div>
    </MenuGuard>
  );
}

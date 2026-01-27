import { MenuGuard } from "@/components/layout/MenuGuard";
import { NoticesList } from "@/components/layout/NoticesList";

export default function Page() {
  return (
    <MenuGuard roleGroup="guard" toggleKey="notices">
      <div>
        <h1 className="page-title">공지사항</h1>
        <NoticesList />
      </div>
    </MenuGuard>
  );
}

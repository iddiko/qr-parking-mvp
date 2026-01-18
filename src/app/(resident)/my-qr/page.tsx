import { MenuGuard } from "@/components/layout/MenuGuard";
import { ResidentQrPanel } from "@/components/layout/ResidentQrPanel";

export default function Page() {
  return (
    <MenuGuard roleGroup="resident" toggleKey="myQr">
      <div>
        <h1 className="page-title">내 QR</h1>
        <ResidentQrPanel />
      </div>
    </MenuGuard>
  );
}

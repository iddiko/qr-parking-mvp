import { Suspense } from "react";
import InviteClient from "./InviteClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="muted">초대 정보를 불러오는 중...</div>}>
      <InviteClient />
    </Suspense>
  );
}

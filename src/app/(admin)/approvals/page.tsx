"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { useEditMode } from "@/lib/auth/editMode";
import { MenuGuard } from "@/components/layout/MenuGuard";

type ApprovalRow = {
  id: string;
  status: string;
  vehicles?: {
    plate: string;
    vehicle_type: string;
    profiles?: { email: string };
  };
};

export default function Page() {
  const { enabled } = useEditMode();
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [status, setStatus] = useState("");

  const load = async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/approvals", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setApprovals(data.approvals ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (qrId: string) => {
    setStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/approvals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({ qr_id: qrId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "승인에 실패했습니다.");
      return;
    }
    setStatus("승인이 완료되었습니다.");
    load();
  };

  return (
    <MenuGuard roleGroup="sub" toggleKey="approvals">
      <div>
        <h1 className="page-title">승인 목록</h1>
        {status ? <div className="muted">{status}</div> : null}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">입주민 이메일</th>
              <th align="left">차량 번호</th>
              <th align="left">차량 타입</th>
              <th align="left">승인</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((row) => (
              <tr key={row.id}>
                <td>{row.vehicles?.profiles?.email ?? "-"}</td>
                <td>{row.vehicles?.plate ?? "-"}</td>
                <td>{row.vehicles?.vehicle_type ?? "-"}</td>
                <td>
                  <button onClick={() => approve(row.id)}>승인</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MenuGuard>
  );
}

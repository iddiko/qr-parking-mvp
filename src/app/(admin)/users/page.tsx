"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { useEditMode } from "@/lib/auth/editMode";
import { parseInviteCsv, type InviteCsvRow } from "@/lib/import/csv";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { useRightPanel } from "@/components/layout/RightPanelContext";

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  sent_at: string | null;
  accepted_at: string | null;
  has_vehicle: boolean;
  plate: string | null;
  vehicle_type: string | null;
  created_at: string;
};

type BulkRow = InviteCsvRow & {
  id?: string;
  status?: string;
  selected?: boolean;
};

const roleLabel = (role?: string) => {
  switch (role) {
    case "SUPER":
      return "슈퍼관리자";
    case "MAIN":
      return "메인관리자";
    case "SUB":
      return "서브관리자";
    case "GUARD":
      return "경비";
    case "RESIDENT":
      return "입주민";
    default:
      return role ?? "-";
  }
};

const inviteStatusLabel = (status?: string | null) => {
  switch (status) {
    case "PENDING":
      return "대기";
    case "SENT":
      return "발송";
    case "ACCEPTED":
      return "가입 완료";
    case "EXPIRED":
      return "만료";
    default:
      return status ?? "-";
  }
};

const hasVehicleLabel = (value?: string | null) => {
  if (value === "true") {
    return "있음";
  }
  if (value === "false") {
    return "없음";
  }
  return value ?? "-";
};

export default function Page() {
  const { enabled } = useEditMode();
  const { setContent } = useRightPanel();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [form, setForm] = useState({
    email: "",
    role: "RESIDENT",
    building_code: "",
    unit_code: "",
  });
  const [status, setStatus] = useState("");
  const [unitStatus, setUnitStatus] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkBatchId, setBulkBatchId] = useState<string>("");
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [now, setNow] = useState<number>(() => Date.now());

  const loadInvites = async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/invites", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setInvites(data.invites ?? []);
  };

  useEffect(() => {
    loadInvites();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const inviteCountdown = (invite: InviteRow) => {
    const baseTime = invite.sent_at ?? invite.created_at;
    if (!baseTime || invite.status === "ACCEPTED") {
      return "-";
    }
    const expiresAt = new Date(baseTime).getTime() + 24 * 60 * 60 * 1000;
    const diff = expiresAt - now;
    if (diff <= 0) {
      return "만료";
    }
    const totalSeconds = Math.floor(diff / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  };

  const onInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    setUnitStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/invites", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({
        action: "create",
        ...form,
        building_code: form.building_code || null,
        unit_code: form.unit_code || null,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "초대 생성에 실패했습니다.");
      return;
    }
    setStatus("초대가 생성되었습니다.");
    setForm({ email: "", role: "RESIDENT", building_code: "", unit_code: "" });
    loadInvites();
  };

  const createUnit = async () => {
    setUnitStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/units", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({
        building_code: form.building_code,
        unit_code: form.unit_code,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setUnitStatus(data.error ?? "호수 생성에 실패했습니다.");
      return;
    }
    setUnitStatus("호수가 생성되었습니다.");
  };

  const onBulkFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    const parsed = parseInviteCsv(text).map((row) => ({ ...row, selected: !row.error }));
    setBulkRows(parsed);
    setBulkBatchId("");
    setBulkStatus("");

    const validRows = parsed.filter((row) => !row.error);
    if (validRows.length === 0) {
      return;
    }
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/invites/bulk", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({ action: "upload", rows: validRows }),
    });
    if (!response.ok) {
      setBulkStatus("일괄 업로드에 실패했습니다.");
      return;
    }
    const data = await response.json();
    setBulkBatchId(data.batch_id);
    const listResponse = await fetch(`/api/invites?batch_id=${data.batch_id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (listResponse.ok) {
      const listData = await listResponse.json();
      const inviteMap = new Map<string, InviteRow>();
      for (const invite of listData.invites ?? []) {
        inviteMap.set(invite.email, invite);
      }
      setBulkRows((prev) =>
        prev.map((row) => {
          const match = inviteMap.get(row.email);
          return { ...row, id: match?.id, status: match?.status ?? row.status };
        })
      );
    }
  };

  const sendBulk = async (ids: string[]) => {
    if (ids.length === 0) {
      setBulkStatus("선택된 초대가 없습니다.");
      return;
    }
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/invites/bulk", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({ action: "send", ids }),
    });
    if (!response.ok) {
      setBulkStatus("발송에 실패했습니다.");
      return;
    }
    setBulkStatus("발송이 완료되었습니다.");
    if (bulkBatchId) {
      const listResponse = await fetch(`/api/invites?batch_id=${bulkBatchId}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (listResponse.ok) {
        const listData = await listResponse.json();
        const inviteMap = new Map<string, InviteRow>();
        for (const invite of listData.invites ?? []) {
          inviteMap.set(invite.email, invite);
        }
        setBulkRows((prev) =>
          prev.map((row) => {
            const match = inviteMap.get(row.email);
            return { ...row, status: match?.status ?? row.status };
          })
        );
      }
    }
  };

  useEffect(() => {
    const panel = (
      <div style={{ display: "grid", gap: "12px" }}>
        <div className="page-title">개별 초대</div>
        <form onSubmit={onInvite} style={{ display: "grid", gap: "8px" }}>
          <label>
            이메일
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            역할
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="MAIN">메인관리자</option>
              <option value="SUB">서브관리자</option>
              <option value="GUARD">경비</option>
              <option value="RESIDENT">입주민</option>
            </select>
          </label>
          <label>
            동 코드
            <input
              value={form.building_code}
              onChange={(e) => setForm({ ...form, building_code: e.target.value })}
            />
          </label>
          <label>
            호수 코드
            <input value={form.unit_code} onChange={(e) => setForm({ ...form, unit_code: e.target.value })} />
          </label>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button type="button" onClick={createUnit}>
              호수 생성
            </button>
            {unitStatus ? <div className="muted">{unitStatus}</div> : null}
          </div>
          <button type="submit">초대 보내기</button>
          {status ? <div className="muted">{status}</div> : null}
        </form>
      </div>
    );

    setContent(panel);
    return () => setContent(null);
  }, [form, setContent, status, unitStatus]);

  return (
    <MenuGuard roleGroup="sub" toggleKey="users">
      <div>
        <h1 className="page-title">관리자 사용자</h1>

        <section>
          <h2 className="page-title">초대 목록</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">이메일</th>
                <th align="left">역할</th>
                <th align="left">상태</th>
                <th align="left">발송일</th>
                <th align="left">남은시간</th>
                <th align="left">승인일</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.email}</td>
                  <td>{roleLabel(invite.role)}</td>
                  <td>{inviteStatusLabel(invite.status)}</td>
                  <td>{invite.sent_at ?? "-"}</td>
                  <td>{inviteCountdown(invite)}</td>
                  <td>{invite.accepted_at ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={{ marginTop: "24px" }}>
          <h2 className="page-title">일괄 초대</h2>
          <div style={{ display: "grid", gap: "8px", maxWidth: "640px" }}>
            <a href="/templates/invites_template.csv" download>
              CSV 양식 다운로드
            </a>
            <input type="file" accept=".csv" onChange={onBulkFile} />
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => sendBulk(bulkRows.map((row) => row.id).filter(Boolean) as string[])}>
                전체 발송
              </button>
              <button
                onClick={() =>
                  sendBulk(
                    bulkRows
                      .filter((row) => row.selected && row.id)
                      .map((row) => row.id as string)
                  )
                }
              >
                선택 발송
              </button>
            </div>
            {bulkStatus ? <div className="muted">{bulkStatus}</div> : null}
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
            <thead>
              <tr>
                <th align="left">선택</th>
                <th align="left">이메일</th>
                <th align="left">역할</th>
                <th align="left">동</th>
                <th align="left">호수</th>
                <th align="left">차량 유무</th>
                <th align="left">차량번호</th>
                <th align="left">차종</th>
                <th align="left">상태</th>
                <th align="left">오류</th>
                <th align="left">발송</th>
              </tr>
            </thead>
            <tbody>
              {bulkRows.map((row, index) => (
                <tr key={`${row.email}-${index}`} className={row.error ? "row-error" : ""}>
                  <td>
                    <input
                      type="checkbox"
                      checked={Boolean(row.selected)}
                      disabled={Boolean(row.error)}
                      onChange={(e) =>
                        setBulkRows((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, selected: e.target.checked } : item))
                        )
                      }
                    />
                  </td>
                  <td>{row.email}</td>
                  <td>{roleLabel(row.role)}</td>
                  <td>{row.building_code ?? "-"}</td>
                  <td>{row.unit_code ?? "-"}</td>
                  <td>{hasVehicleLabel(row.has_vehicle)}</td>
                  <td>{row.plate ?? "-"}</td>
                  <td>{row.vehicle_type ?? "-"}</td>
                  <td>{inviteStatusLabel(row.status ?? "PENDING")}</td>
                  <td>{row.error ?? "-"}</td>
                  <td>
                    <button disabled={!row.id || Boolean(row.error)} onClick={() => sendBulk([row.id as string])}>
                      발송
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </MenuGuard>
  );
}

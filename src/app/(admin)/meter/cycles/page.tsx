"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { useEditMode } from "@/lib/auth/editMode";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { useRightPanel } from "@/components/layout/RightPanelContext";

type CycleRow = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
};

const cycleStatusLabel = (value?: string) => {
  if (value === "OPEN") {
    return "진행중";
  }
  if (value === "CLOSED") {
    return "마감";
  }
  return value ?? "-";
};

type CycleFormProps = {
  enabled: boolean;
  title: string;
  startDate: string;
  endDate: string;
  statusText: string;
  setTitle: (value: string) => void;
  setStartDate: (value: string) => void;
  setEndDate: (value: string) => void;
  onSubmit: (event: React.FormEvent) => Promise<void>;
};

function CycleFormPanel({
  enabled,
  title,
  startDate,
  endDate,
  statusText,
  setTitle,
  setStartDate,
  setEndDate,
  onSubmit,
}: CycleFormProps) {
  return (
    <div className="panel-card">
      <h3 className="panel-title">검침 주기 등록</h3>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "8px" }}>
        <label>
          주기 제목
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label>
          시작일
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          종료일
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button type="submit" disabled={!enabled}>
          검침 주기 저장
        </button>
        {statusText ? <div className="muted">{statusText}</div> : null}
      </form>
    </div>
  );
}

export default function Page() {
  const { enabled } = useEditMode();
  const { setContent } = useRightPanel();
  const [cycles, setCycles] = useState<CycleRow[]>([]);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusText, setStatusText] = useState("");

  const load = async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/meter?type=cycles", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setCycles(data.cycles ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const createCycle = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatusText("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/meter", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({
        action: "create_cycle",
        title,
        start_date: startDate || null,
        end_date: endDate || null,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatusText(data.error ?? "검침 주기 등록에 실패했습니다.");
      return;
    }
    setTitle("");
    setStartDate("");
    setEndDate("");
    setStatusText("검침 주기가 저장되었습니다.");
    load();
  };

  useEffect(() => {
    setContent(
      <CycleFormPanel
        enabled={enabled}
        title={title}
        startDate={startDate}
        endDate={endDate}
        statusText={statusText}
        setTitle={setTitle}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        onSubmit={createCycle}
      />
    );
    return () => setContent(null);
  }, [enabled, title, startDate, endDate, statusText, setContent]);

  return (
    <MenuGuard roleGroup="sub" toggleKey="meter.cycles">
      <div>
        <h1 className="page-title">검침 주기</h1>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">제목</th>
              <th align="left">시작일</th>
              <th align="left">종료일</th>
              <th align="left">상태</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((cycle) => (
              <tr key={cycle.id}>
                <td>{cycle.title}</td>
                <td>{cycle.start_date ?? "-"}</td>
                <td>{cycle.end_date ?? "-"}</td>
                <td>{cycleStatusLabel(cycle.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MenuGuard>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
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

type Role = "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";

const cycleStatusLabel = (value?: string) => {
  if (value === "OPEN") {
    return "진행 중";
  }
  if (value === "CLOSED") {
    return "종료";
  }
  return value ?? "-";
};

type CycleFormProps = {
  enabled: boolean;
  role: Role | null;
  complexId: string;
  onCreated: () => void;
};

function CycleFormPanel({ enabled, role, complexId, onCreated }: CycleFormProps) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusText, setStatusText] = useState("");
  const [isComposing, setIsComposing] = useState(false);

  const createCycle = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatusText("");
    if (role === "SUPER" && !complexId) {
      setStatusText("단지를 선택해야 등록할 수 있습니다.");
      return;
    }
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
        complex_id: role === "SUPER" ? complexId : undefined,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatusText(data.error ?? "검침 주기를 등록하지 못했습니다.");
      return;
    }
    setTitle("");
    setStartDate("");
    setEndDate("");
    setStatusText("검침 주기가 등록되었습니다.");
    onCreated();
  };

  return (
    <div className="panel-card">
      <h3 className="panel-title">검침 주기 등록</h3>
      <form onSubmit={createCycle} style={{ display: "grid", gap: "8px" }}>
        <label>
          제목 입력
          <input
            type="text"
            inputMode="text"
            value={title}
            onChange={(e) => {
              if (!isComposing) {
                setTitle(e.target.value);
              }
            }}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(e) => {
              setIsComposing(false);
              setTitle(e.currentTarget.value);
            }}
          />
        </label>
        <label>
          시작 날짜
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          종료 날짜
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <button type="submit" disabled={!enabled}>
          검침 주기 등록
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
  const [role, setRole] = useState<Role | null>(null);
  const [selectedComplexId, setSelectedComplexId] = useState("");

  const loadProfile = useCallback(async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      return;
    }
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("role, complex_id")
      .eq("id", userId)
      .single();
    if (!profileData) {
      return;
    }
    setRole(profileData.role as Role);
    if (profileData.role === "SUPER") {
      const storedId = localStorage.getItem("selectedComplexId") ?? "";
      setSelectedComplexId(storedId || profileData.complex_id || "");
    } else {
      setSelectedComplexId(profileData.complex_id ?? "");
    }
  }, []);

  const loadCycles = useCallback(async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const params = new URLSearchParams({ type: "cycles" });
    if (role === "SUPER" && selectedComplexId) {
      params.set("complex_id", selectedComplexId);
    }
    const response = await fetch(`/api/meter?${params.toString()}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setCycles(data.cycles ?? []);
  }, [role, selectedComplexId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  useEffect(() => {
    if (role !== "SUPER") {
      return;
    }
    const handleSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      setSelectedComplexId(detail?.id ?? "");
    };
    window.addEventListener("complexSelectionChanged", handleSelection as EventListener);
    return () => window.removeEventListener("complexSelectionChanged", handleSelection as EventListener);
  }, [role]);

  useEffect(() => {
    setContent(
      <CycleFormPanel enabled={enabled} role={role} complexId={selectedComplexId} onCreated={loadCycles} />
    );
    return () => setContent(null);
  }, [enabled, role, selectedComplexId, loadCycles, setContent]);

  return (
    <MenuGuard roleGroup="sub" toggleKey="meter.cycles">
      <div>
        <h1 className="page-title">검침 주기</h1>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">제목</th>
              <th align="left">시작 날짜</th>
              <th align="left">종료 날짜</th>
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

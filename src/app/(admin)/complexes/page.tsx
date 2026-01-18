"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { useEditMode } from "@/lib/auth/editMode";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { useRightPanel } from "@/components/layout/RightPanelContext";

type ComplexRow = {
  id: string;
  name: string;
  created_at?: string;
};

export default function Page() {
  const { enabled } = useEditMode();
  const { setContent } = useRightPanel();
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [selectedComplexId, setSelectedComplexId] = useState("");

  const loadComplexes = async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/complexes", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const list = (data.complexes ?? []) as ComplexRow[];
    setComplexes(list);
    if (!selectedComplexId && list.length > 0) {
      const stored = localStorage.getItem("selectedComplexId") ?? "";
      const nextId = stored && list.some((item) => item.id === stored) ? stored : list[0].id;
      setSelectedComplexId(nextId);
    }
  };

  useEffect(() => {
    loadComplexes();
  }, []);

  const createComplex = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/complexes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "단지 생성에 실패했습니다.");
      return;
    }
    setName("");
    setStatus("단지가 생성되었습니다.");
    loadComplexes();
  };

  const inviteMain = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteStatus("");
    if (!selectedComplexId) {
      setInviteStatus("단지를 선택해 주세요.");
      return;
    }
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
        email: inviteEmail,
        role: "MAIN",
        complex_id: selectedComplexId,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setInviteStatus(data.error ?? "메인관리자 초대에 실패했습니다.");
      return;
    }
    setInviteEmail("");
    setInviteStatus("메인관리자 초대를 발송했습니다.");
  };

  useEffect(() => {
    const panel = (
      <div style={{ display: "grid", gap: "16px" }}>
        <div style={{ display: "grid", gap: "8px" }}>
          <div className="page-title">단지 생성</div>
          <form onSubmit={createComplex} style={{ display: "grid", gap: "8px" }}>
            <label>
              단지 이름
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <button type="submit">단지 생성</button>
            {status ? <div className="muted">{status}</div> : null}
          </form>
        </div>
        <div style={{ display: "grid", gap: "8px" }}>
          <div className="page-title">단지 관리자 생성/임명</div>
          <form onSubmit={inviteMain} style={{ display: "grid", gap: "8px" }}>
            <label>
              단지 선택
              <select value={selectedComplexId} onChange={(event) => setSelectedComplexId(event.target.value)}>
                <option value="">선택</option>
                {complexes.map((complex) => (
                  <option key={complex.id} value={complex.id}>
                    {complex.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              메인관리자 이메일
              <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
            </label>
            <button type="submit">초대 보내기</button>
            {inviteStatus ? <div className="muted">{inviteStatus}</div> : null}
          </form>
        </div>
      </div>
    );

    setContent(panel);
    return () => setContent(null);
  }, [complexes, inviteEmail, inviteStatus, name, selectedComplexId, setContent, status]);

  return (
    <RoleGuard allowedRoles={["SUPER"]} message="슈퍼관리자 전용 화면입니다.">
      <MenuGuard roleGroup="sub" toggleKey="complexes">
        <div>
          <h1 className="page-title">단지 관리</h1>
          <p className="muted">단지를 생성하고 단지 관리자를 초대합니다.</p>

          <section style={{ marginTop: "16px" }}>
            <h2 className="page-title">단지 목록</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">단지 이름</th>
                  <th align="left">생성일</th>
                </tr>
              </thead>
              <tbody>
                {complexes.map((complex) => (
                  <tr key={complex.id}>
                    <td>{complex.name}</td>
                    <td>{complex.created_at ? new Date(complex.created_at).toLocaleString() : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </MenuGuard>
    </RoleGuard>
  );
}

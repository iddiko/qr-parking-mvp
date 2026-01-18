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
};

type BuildingRow = {
  id: string;
  code: string;
  name: string;
  complex_id: string;
  complexes?: { name: string };
};

export default function Page() {
  const { enabled } = useEditMode();
  const { setContent } = useRightPanel();
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [complexId, setComplexId] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBuildingCode, setInviteBuildingCode] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [isSuper, setIsSuper] = useState(false);

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
    setComplexes(data.complexes ?? []);
    if (!complexId && data.complexes?.length) {
      setComplexId(data.complexes[0].id);
    }
  };

  const loadBuildings = async (targetComplexId?: string) => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const query = targetComplexId ? `?complex_id=${targetComplexId}` : "";
    const response = await fetch(`/api/buildings${query}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    setBuildings(data.buildings ?? []);
  };

  useEffect(() => {
    const loadRole = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }
      const { data } = await supabaseClient.from("profiles").select("role").eq("id", userId).single();
      setIsSuper(data?.role === "SUPER");
    };
    loadRole();
    loadComplexes();
  }, []);

  useEffect(() => {
    loadBuildings(complexId || undefined);
  }, [complexId]);

  const createBuilding = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/buildings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({
        code,
        name,
        complex_id: isSuper ? complexId : null,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "동 생성에 실패했습니다.");
      return;
    }
    setCode("");
    setName("");
    setStatus("동이 생성되었습니다.");
    loadBuildings(complexId || undefined);
  };

  const inviteSub = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteStatus("");
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
        role: "SUB",
        building_code: inviteBuildingCode,
        complex_id: isSuper ? complexId : null,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setInviteStatus(data.error ?? "동 관리자 초대에 실패했습니다.");
      return;
    }
    setInviteEmail("");
    setInviteStatus("동 관리자 초대를 보냈습니다.");
  };

  useEffect(() => {
    const panel = (
      <div style={{ display: "grid", gap: "16px" }}>
        <div style={{ display: "grid", gap: "8px" }}>
          <div className="page-title">동 생성</div>
          {isSuper ? (
            <label>
              단지 선택
              <select value={complexId} onChange={(event) => setComplexId(event.target.value)}>
                {complexes.map((complex) => (
                  <option key={complex.id} value={complex.id}>
                    {complex.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <form onSubmit={createBuilding} style={{ display: "grid", gap: "8px" }}>
            <label>
              동 코드
              <input value={code} onChange={(event) => setCode(event.target.value)} />
            </label>
            <label>
              동 이름
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <button type="submit">동 생성</button>
            {status ? <div className="muted">{status}</div> : null}
          </form>
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          <div className="page-title">동 관리자 생성/임명</div>
          <form onSubmit={inviteSub} style={{ display: "grid", gap: "8px" }}>
            <label>
              관리자 이메일
              <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
            </label>
            <label>
              동 선택
              <select value={inviteBuildingCode} onChange={(event) => setInviteBuildingCode(event.target.value)}>
                <option value="">선택</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.code}>
                    {building.code} ({building.name})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">초대 보내기</button>
            {inviteStatus ? <div className="muted">{inviteStatus}</div> : null}
          </form>
        </div>
      </div>
    );

    setContent(panel);
    return () => setContent(null);
  }, [
    buildings,
    code,
    complexes,
    complexId,
    inviteBuildingCode,
    inviteEmail,
    inviteStatus,
    isSuper,
    name,
    setContent,
    status,
  ]);

  return (
    <RoleGuard allowedRoles={["SUPER", "MAIN"]} message="관리자 전용 화면입니다.">
      <MenuGuard roleGroup="sub" toggleKey="buildings">
        <div>
          <h1 className="page-title">동 관리</h1>
          <p className="muted">단지 내 동을 생성하고 관리합니다.</p>

          <section style={{ marginTop: "16px" }}>
            <h2 className="page-title">동 목록</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">동 코드</th>
                  <th align="left">동 이름</th>
                  <th align="left">단지</th>
                </tr>
              </thead>
              <tbody>
                {buildings.map((building) => (
                  <tr key={building.id}>
                    <td>{building.code}</td>
                    <td>{building.name}</td>
                    <td>{building.complexes?.name ?? "-"}</td>
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

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const { setVisible, setContent } = useRightPanel();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [complexId, setComplexId] = useState(() => searchParams.get("complexId") ?? "");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBuildingCode, setInviteBuildingCode] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [isSuper, setIsSuper] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [isComposingCode, setIsComposingCode] = useState(false);
  const [isComposingName, setIsComposingName] = useState(false);
  const [isComposingEditCode, setIsComposingEditCode] = useState(false);
  const [isComposingEditName, setIsComposingEditName] = useState(false);

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
    if (!data.complexes?.length) {
      return;
    }
    if (!complexId) {
      setComplexId(data.complexes[0].id);
      return;
    }
    const stillValid = data.complexes.some((complex: ComplexRow) => complex.id === complexId);
    if (!stillValid) {
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
    setVisible(false);
    setContent(null);
    return () => {
      setVisible(true);
    };
  }, [setContent, setVisible]);

  useEffect(() => {
    const param = searchParams.get("complexId") ?? "";
    if (param && param !== complexId) {
      setComplexId(param);
    }
  }, [complexId, searchParams]);

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
    setStatus("동이 추가되었습니다.");
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
      setInviteStatus(data.error ?? "초대 생성에 실패했습니다.");
      return;
    }
    setInviteEmail("");
    setInviteStatus("초대 링크가 생성되었습니다.");
  };

  const startEdit = (building: BuildingRow) => {
    setEditingId(building.id);
    setEditCode(building.code);
    setEditName(building.name);
    setEditStatus("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditCode("");
    setEditName("");
    setEditStatus("");
  };

  const saveEdit = async () => {
    if (!editingId) {
      return;
    }
    setEditStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/buildings", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({
        id: editingId,
        code: editCode,
        name: editName,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setEditStatus(data.error ?? "수정에 실패했습니다.");
      return;
    }
    cancelEdit();
    loadBuildings(complexId || undefined);
  };

  const removeBuilding = async (id: string) => {
    if (!confirm("동을 삭제하시겠습니다?")) {
      return;
    }
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/buildings", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({ id }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setEditStatus(data.error ?? "삭제에 실패했습니다.");
      return;
    }
    if (editingId === id) {
      cancelEdit();
    }
    loadBuildings(complexId || undefined);
  };

  return (
    <RoleGuard allowedRoles={["SUPER", "MAIN"]} message="권한이 없는 화면입니다.">
      <MenuGuard roleGroup="sub" toggleKey="buildings">
        <div>
          <h1 className="page-title">동 관리</h1>
          <p className="muted">단지 내 동을 생성하고 관리자 초대를 관리합니다.</p>

          <section className="panel-card" style={{ marginTop: "16px" }}>
            <div
              style={{
                display: "grid",
                gap: "16px",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                alignItems: "start",
              }}
            >
              <div style={{ display: "grid", gap: "8px" }}>
                <div className="page-title">동 생성</div>
                {isSuper ? (
                  <label className="field-label">
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
                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                      gridTemplateColumns: "1fr 1fr auto",
                      alignItems: "end",
                    }}
                  >
                    <label className="field-label" style={{ display: "grid", gap: "6px" }}>
                      동 코드
                      <input
                        value={code}
                        onChange={(event) => {
                          if (!isComposingCode) {
                            setCode(event.target.value);
                          }
                        }}
                        onCompositionStart={() => setIsComposingCode(true)}
                        onCompositionEnd={(event) => {
                          setIsComposingCode(false);
                          setCode(event.currentTarget.value);
                        }}
                      />
                    </label>
                    <label className="field-label" style={{ display: "grid", gap: "6px" }}>
                      동 이름
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        onCompositionStart={() => setIsComposingName(true)}
                        onCompositionEnd={(event) => {
                          setIsComposingName(false);
                          setName(event.currentTarget.value);
                        }}
                      />
                    </label>
                    <button type="submit" className="btn-primary" disabled={!enabled}>
                      동 추가
                    </button>
                  </div>
                  {status ? <div className="muted">{status}</div> : null}
                </form>
              </div>

              <div style={{ display: "grid", gap: "8px" }}>
                <div className="page-title">동 관리자 초대/임명</div>
                <form onSubmit={inviteSub} style={{ display: "grid", gap: "8px" }}>
                  <div
                    style={{
                      display: "grid",
                      gap: "8px",
                      gridTemplateColumns: "1.2fr 1fr auto auto",
                      alignItems: "end",
                    }}
                  >
                    <label className="field-label" style={{ display: "grid", gap: "6px" }}>
                      관리자 이메일
                      <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
                    </label>
                    <label className="field-label" style={{ display: "grid", gap: "6px" }}>
                      동 선택
                      <select value={inviteBuildingCode} onChange={(event) => setInviteBuildingCode(event.target.value)}>
                        <option value="">동 선택</option>
                        {buildings.map((building) => (
                          <option key={building.id} value={building.code}>
                            {building.code} ({building.name})
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => router.push("/users")}
                      disabled={!enabled}
                    >
                      초대 보기
                    </button>
                    <button type="submit" className="btn-primary" disabled={!enabled}>
                      초대 보내기
                    </button>
                  </div>
                  {inviteStatus ? <div className="muted">{inviteStatus}</div> : null}
                </form>
              </div>
            </div>
          </section>

          <section style={{ marginTop: "16px" }}>
            <h2 className="page-title">동 목록</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">동 코드</th>
                  <th align="left">동 이름</th>
                  <th align="left">단지</th>
                  <th align="left">관리</th>
                </tr>
              </thead>
              <tbody>
                {buildings.map((building) => (
                  <tr key={building.id}>
                    <td>
                      {editingId === building.id ? (
                        <input
                          value={editCode}
                          onChange={(event) => {
                            if (!isComposingEditCode) {
                              setEditCode(event.target.value);
                            }
                          }}
                          onCompositionStart={() => setIsComposingEditCode(true)}
                          onCompositionEnd={(event) => {
                            setIsComposingEditCode(false);
                            setEditCode(event.currentTarget.value);
                          }}
                        />
                      ) : (
                        building.code
                      )}
                    </td>
                    <td>
                      {editingId === building.id ? (
                        <input
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                          onCompositionStart={() => setIsComposingEditName(true)}
                          onCompositionEnd={(event) => {
                            setIsComposingEditName(false);
                            setEditName(event.currentTarget.value);
                          }}
                        />
                      ) : (
                        building.name
                      )}
                    </td>
                    <td>{building.complexes?.name ?? "-"}</td>
                    <td>
                      {editingId === building.id ? (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button type="button" className="btn-primary" onClick={saveEdit} disabled={!enabled}>
                            저장
                          </button>
                          <button type="button" className="btn-secondary" onClick={cancelEdit}>
                            취소
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => startEdit(building)}
                            disabled={!enabled}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="btn-danger"
                            onClick={() => removeBuilding(building.id)}
                            disabled={!enabled}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {editStatus ? <div className="muted" style={{ marginTop: "8px" }}>{editStatus}</div> : null}
          </section>
        </div>
      </MenuGuard>
    </RoleGuard>
  );
}

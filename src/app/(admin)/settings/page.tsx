"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { resolveMenuToggles } from "@/lib/settings/resolve";
import { defaultMenuToggles } from "@/lib/settings/defaults";
import { useEditMode } from "@/lib/auth/editMode";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { menuConfig } from "@/components/nav/menu.config";

type MenuToggles = typeof defaultMenuToggles;

type RoleKey = "main" | "sub" | "guard" | "resident";

type MenuRow = {
  key: string;
  label: string;
  roles: RoleKey[];
  hrefs: Partial<Record<RoleKey, string>>;
};

type MenuHelp = {
  title: string;
  description: string;
};

const roleLabels: Record<RoleKey, string> = {
  main: "메인관리자",
  sub: "서브관리자",
  guard: "경비",
  resident: "입주민",
};

const menuDescriptions: Record<string, MenuHelp> = {
  dashboard: { title: "대시보드", description: "역할별 현황과 통계를 확인합니다." },
  complexes: { title: "단지 관리", description: "단지 생성과 관리자 지정을 관리합니다." },
  buildings: { title: "동 관리", description: "동 생성과 관리자 지정을 관리합니다." },
  members: { title: "회원관리", description: "회원 조회와 QR 정보를 관리합니다." },
  users: { title: "사용자", description: "관리자/입주민 초대를 관리합니다." },
  approvals: { title: "승인", description: "가입 승인 및 QR 활성화를 처리합니다." },
  "parking.qrs": { title: "주차 QR", description: "QR 발행 및 상태를 확인합니다." },
  "parking.scans": { title: "경비 스캔 리스트", description: "경비 스캔 이력을 확인합니다." },
  "meter.cycles": { title: "검침 주기", description: "검침 주기를 등록합니다." },
  "meter.submissions": { title: "검침 제출", description: "검침 제출 내역을 확인합니다." },
  notices: { title: "공지", description: "공지사항을 관리합니다." },
  settings: { title: "설정", description: "역할별 메뉴 표시를 설정합니다." },
  mypage: { title: "마이페이지", description: "내 정보 및 QR 정보를 확인합니다." },
  notifications: { title: "알림", description: "알림 내역을 확인합니다." },
  scan: { title: "스캔", description: "QR 스캔 기능을 사용합니다." },
  history: { title: "이력", description: "스캔 이력을 확인합니다." },
  alerts: { title: "스캔 알림", description: "스캔 알림을 확인합니다." },
  meter: { title: "검침", description: "검침을 직접 제출합니다." },
  myQr: { title: "내 QR", description: "내 QR을 확인합니다." },
};

export default function Page() {
  const [toggles, setToggles] = useState<MenuToggles>(defaultMenuToggles);
  const [status, setStatus] = useState<string>("");
  const [role, setRole] = useState<string>("MAIN");
  const [token, setToken] = useState<string>("");
  const [profileComplexId, setProfileComplexId] = useState<string | null>(null);
  const [targetComplexId, setTargetComplexId] = useState<string>("");
  const [complexes, setComplexes] = useState<Array<{ id: string; name: string }>>([]);
  const [openHelp, setOpenHelp] = useState<MenuHelp | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoStatus, setLogoStatus] = useState<string>("");
  const { enabled } = useEditMode();

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const sessionToken = sessionData.session?.access_token ?? "";
      setToken(sessionToken);
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("role, complex_id")
        .eq("id", userId)
        .single();
      if (!profileData?.role) {
        return;
      }
      setRole(profileData.role);
      setProfileComplexId(profileData.complex_id ?? null);
      if (profileData.role === "SUPER") {
        const response = await fetch("/api/complexes", {
          headers: { authorization: `Bearer ${sessionToken}` },
        });
        if (response.ok) {
          const data = await response.json();
          setComplexes(data.complexes ?? []);
          const defaultId = profileData.complex_id ?? data.complexes?.[0]?.id ?? "";
          setTargetComplexId(defaultId);
        }
        return;
      }
      if (profileData.complex_id) {
        setTargetComplexId(profileData.complex_id);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!targetComplexId || !token) {
      return;
    }
    const loadSettings = async () => {
      const query = role === "SUPER" ? `?complex_id=${targetComplexId}` : "";
      const response = await fetch(`/api/settings${query}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setToggles(resolveMenuToggles(data.menu_toggles));
      }
    };
    loadSettings();
  }, [role, targetComplexId, token]);

  useEffect(() => {
    if (!targetComplexId) {
      return;
    }
    const loadLogo = async () => {
      const response = await fetch(`/api/branding?complex_id=${targetComplexId}`);
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setLogoUrl(data?.logo_url ?? null);
    };
    loadLogo();
  }, [targetComplexId]);

  const menuRows = useMemo<MenuRow[]>(() => {
    const rows: Record<string, MenuRow> = {};
    for (const item of menuConfig.admin) {
      rows[item.key] = {
        key: item.key,
        label: item.label,
        roles: ["main", "sub"],
        hrefs: { main: item.href, sub: item.href },
      };
    }
    for (const item of menuConfig.guard) {
      const existing = rows[item.key];
      if (existing) {
        if (!existing.roles.includes("guard")) {
          existing.roles.push("guard");
          existing.hrefs.guard = item.href;
        }
      } else {
        rows[item.key] = {
          key: item.key,
          label: item.label,
          roles: ["guard"],
          hrefs: { guard: item.href },
        };
      }
    }
    for (const item of menuConfig.resident) {
      const existing = rows[item.key];
      if (existing) {
        if (!existing.roles.includes("resident")) {
          existing.roles.push("resident");
          existing.hrefs.resident = item.href;
        }
      } else {
        rows[item.key] = {
          key: item.key,
          label: item.label,
          roles: ["resident"],
          hrefs: { resident: item.href },
        };
      }
    }
    return Object.values(rows);
  }, []);

  const updateToggle = (group: RoleKey, key: string, value: boolean) => {
    setToggles((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: value,
      },
    }));
  };

  const canEdit = (group: RoleKey) => {
    if (role === "SUPER") {
      return true;
    }
    if (role === "MAIN") {
      return group === "sub" || group === "guard" || group === "resident";
    }
    if (role === "SUB") {
      return group === "guard" || group === "resident";
    }
    return false;
  };

  const onSave = async () => {
    setStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const sessionToken = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({
        menu_toggles: toggles,
        complex_id: role === "SUPER" ? targetComplexId : undefined,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      setStatus(errorData.error ?? "설정 저장에 실패했습니다.");
      return;
    }
    setStatus("설정이 저장되었습니다.");
  };

  const onUploadLogo = async () => {
    if (!logoFile || !targetComplexId || !token) {
      return;
    }
    setLogoStatus("로고 업로드 중...");
    const formData = new FormData();
    formData.append("file", logoFile);
    formData.append("complex_id", targetComplexId);
    const response = await fetch("/api/branding", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: formData,
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      setLogoStatus(errorData.error ?? "로고 업로드에 실패했습니다.");
      return;
    }
    const data = await response.json();
    setLogoUrl(data.logo_url ?? null);
    setLogoFile(null);
    setLogoStatus("로고가 저장되었습니다.");
  };

  const visibleColumns = useMemo<RoleKey[]>(() => {
    if (role === "SUPER") {
      return ["main", "sub", "guard", "resident"];
    }
    if (role === "MAIN") {
      return ["sub", "guard", "resident"];
    }
    if (role === "SUB") {
      return ["guard", "resident"];
    }
    return [];
  }, [role]);

  const residentAddress = (row: MenuRow) => row.hrefs.resident ?? row.hrefs.guard ?? row.hrefs.sub ?? "";

  return (
    <MenuGuard roleGroup="sub" toggleKey="settings">
      <div>
        <h1 className="page-title">관리자 설정</h1>
        <p className="muted">각 역할의 메뉴를 토글로 관리합니다. OFF이면 메뉴가 숨겨집니다.</p>
        <p className="muted">
          상위 관리자가 하위 메뉴를 관리합니다. SUPER는 모든 역할, MAIN은 서브/경비/입주민,
          SUB는 경비/입주민만 변경 가능합니다.
        </p>

        {role === "SUPER" ? (
          <div className="branding-card">
            <div className="branding-title">로고 이미지</div>
            <div className="branding-row">
              <div className="branding-preview">
                {logoUrl ? <img src={logoUrl} alt="로고 이미지" /> : <span className="muted">로고 없음</span>}
              </div>
              <div className="branding-actions">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                />
                <button type="button" onClick={onUploadLogo} disabled={!logoFile}>
                  로고 저장
                </button>
                {logoStatus ? <div className="muted">{logoStatus}</div> : null}
                <div className="muted" style={{ fontSize: "12px" }}>
                  업로드된 로고는 로그인/헤더/파비콘에 사용됩니다.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "end", gap: "12px", marginTop: "12px" }}>
          {role === "SUPER" ? (
            <label style={{ display: "grid", gap: "4px", maxWidth: "320px" }}>
              단지 선택
              <select value={targetComplexId} onChange={(event) => setTargetComplexId(event.target.value)}>
                {complexes.map((complex) => (
                  <option key={complex.id} value={complex.id}>
                    {complex.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="muted">내 단지: {profileComplexId ?? "-"}</div>
          )}
          <button style={{ marginLeft: "auto" }} onClick={onSave}>
            저장
          </button>
        </div>
        {status ? (
          <div className="muted" style={{ marginTop: "8px" }}>
            {status}
          </div>
        ) : null}

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
          <thead>
            <tr>
              <th align="left">메뉴</th>
              {visibleColumns.map((group) => (
                <th key={group} align="center">
                  {roleLabels[group]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {menuRows.map((row) => (
              <tr key={row.key}>
                <td>
                  <button
                    type="button"
                    className="menu-help-button"
                    onClick={() =>
                      setOpenHelp(
                        menuDescriptions[row.key] ?? {
                          title: row.label,
                          description: "메뉴 설명이 준비되어 있습니다.",
                        }
                      )
                    }
                  >
                    {row.label}
                  </button>
                </td>
                {visibleColumns.map((group) => {
                  const applicable = row.roles.includes(group);
                  const disabled = !applicable || !canEdit(group);
                  const checked = toggles[group]?.[row.key] !== false;
                  return (
                    <td key={`${row.key}-${group}`} align="center">
                      {applicable ? (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={(event) => updateToggle(group, row.key, event.target.checked)}
                          />
                          {group === "resident" ? (
                            <span className="muted" style={{ fontSize: "12px" }}>
                              {residentAddress(row)}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {openHelp ? (
          <div className="menu-help-overlay" onClick={() => setOpenHelp(null)}>
            <div className="menu-help-modal" onClick={(event) => event.stopPropagation()}>
              <div className="menu-help-title">{openHelp.title}</div>
              <div className="menu-help-body">{openHelp.description}</div>
              <button type="button" onClick={() => setOpenHelp(null)}>
                닫기
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </MenuGuard>
  );
}

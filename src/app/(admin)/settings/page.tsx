"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { resolveMenuLabels, resolveMenuOrder, resolveMenuToggles } from "@/lib/settings/resolve";
import { defaultMenuLabels, defaultMenuOrder, defaultMenuToggles } from "@/lib/settings/defaults";
import { useEditMode } from "@/lib/auth/editMode";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { menuConfig } from "@/components/nav/menu.config";
import { useRightPanel } from "@/components/layout/RightPanelContext";

type MenuToggles = typeof defaultMenuToggles;
type MenuOrder = typeof defaultMenuOrder;
type MenuLabels = typeof defaultMenuLabels;

type RoleKey = "main" | "sub" | "guard" | "resident";
type OrderRoleKey = "super" | RoleKey;

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

const roleLabels: Record<OrderRoleKey, string> = {
  super: "?????",
  main: "?????",
  sub: "?????",
  guard: "??",
  resident: "???",
};

const menuDescriptions: Record<string, MenuHelp> = {
  dashboard: { title: "????", description: "??/??/??? ??? ?????." },
  complexes: { title: "?? ??", description: "?? ?? ? ???? ?????." },
  buildings: { title: "? ??", description: "? ?? ? ? ???? ?????." },
  members: { title: "????", description: "??/QR ??? ???? ?????." },
  users: { title: "???", description: "??/??? ??? ?????." },
  approvals: { title: "??", description: "?? ??? QR ???? ?????." },
  "parking.qrs": { title: "?? QR", description: "QR ?? ??? ?????." },
  "parking.scans": { title: "?? ?? ???(log)", description: "?? ??? ?????." },
  "meter.cycles": { title: "?? ??", description: "?? ??? ?????." },
  "meter.submissions": { title: "?? ??", description: "?? ?? ??? ?????." },
  notices: { title: "??", description: "????? ?????." },
  settings: { title: "??", description: "?? ??/?? ?? ?????." },
  mypage: { title: "?????", description: "? ??? QR ??? ?????." },
  notifications: { title: "??", description: "?? ??? ?????." },
  scan: { title: "??", description: "QR ??? ?????." },
  history: { title: "??", description: "?? ??? ?????." },
  alerts: { title: "?? ??", description: "??? ??? ?????." },
  meter: { title: "??", description: "??? ?????." },
  myQr: { title: "? QR", description: "? QR? ?????." },
};

const roleMenuItems: Record<OrderRoleKey, { key: string; label: string; href: string }[]> = {
  super: menuConfig.admin,
  main: menuConfig.admin,
  sub: menuConfig.admin,
  guard: menuConfig.guard,
  resident: menuConfig.resident,
};

const normalizeOrder = (order: string[], items: { key: string }[]) => {
  const keys = items.map((item) => item.key);
  const filtered = order.filter((key) => keys.includes(key));
  const missing = keys.filter((key) => !filtered.includes(key));
  return [...filtered, ...missing];
};

const applyOrder = (items: { key: string; label: string; href: string }[], order: string[]) => {
  const map = new Map(items.map((item) => [item.key, item] as const));
  const sorted = order.map((key) => map.get(key)).filter(Boolean) as typeof items;
  const remaining = items.filter((item) => !order.includes(item.key));
  return [...sorted, ...remaining];
};

export default function Page() {
  const [toggles, setToggles] = useState<MenuToggles>(defaultMenuToggles);
  const [menuOrder, setMenuOrder] = useState<MenuOrder>(defaultMenuOrder);
  const [menuLabels, setMenuLabels] = useState<MenuLabels>(defaultMenuLabels);
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
  const { setContent, setVisible } = useRightPanel();

  useEffect(() => {
    setContent(null);
    setVisible(false);
    return () => setVisible(true);
  }, [setContent, setVisible]);

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
        setMenuOrder(resolveMenuOrder(data.menu_order));
        setMenuLabels(resolveMenuLabels(data.menu_labels));
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

  const updateLabel = (group: OrderRoleKey, key: string, value: string) => {
    setMenuLabels((prev) => ({
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

  const canEditOrder = role === "SUPER";
  const canEditLabels = role === "SUPER";

  const moveMenuItem = (group: OrderRoleKey, key: string, direction: -1 | 1) => {
    setMenuOrder((prev) => {
      const items = roleMenuItems[group];
      const normalized = normalizeOrder(prev[group], items);
      const index = normalized.indexOf(key);
      const nextIndex = index + direction;
      if (index === -1 || nextIndex < 0 || nextIndex >= normalized.length) {
        return prev;
      }
      const next = [...normalized];
      const temp = next[index];
      next[index] = next[nextIndex];
      next[nextIndex] = temp;
      return { ...prev, [group]: next };
    });
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
        menu_order: menuOrder,
        menu_labels: menuLabels,
        complex_id: role === "SUPER" ? targetComplexId : undefined,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      setStatus(errorData.error ?? "??? ???? ?????.");
      return;
    }
    setStatus("??? ???????.");
  };

  const onUploadLogo = async () => {
    if (!logoFile || !targetComplexId || !token) {
      return;
    }
    setLogoStatus("?? ???? ????? ????...");
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
      setLogoStatus(errorData.error ?? "?? ???? ??????.");
      return;
    }
    const data = await response.json();
    setLogoUrl(data.logo_url ?? null);
    setLogoFile(null);
    setLogoStatus("??? ???????.");
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

  const orderColumns = useMemo<OrderRoleKey[]>(() => {
    if (role === "SUPER") {
      return ["super", "main", "sub", "guard", "resident"];
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

  const orderedMenuByRole = useMemo(() => {
    const next: Record<OrderRoleKey, { key: string; label: string; href: string }[]> = {
      super: [],
      main: [],
      sub: [],
      guard: [],
      resident: [],
    };
    (Object.keys(roleMenuItems) as OrderRoleKey[]).forEach((key) => {
      const normalized = normalizeOrder(menuOrder[key], roleMenuItems[key]);
      next[key] = applyOrder(roleMenuItems[key], normalized);
    });
    return next;
  }, [menuOrder]);

  return (
    <MenuGuard roleGroup="sub" toggleKey="settings">
      <div>
        <h1 className="page-title">??? ??</h1>
        <p className="muted">? ??? ??? ??? ?????. OFF? ??? ?????.</p>
        <p className="muted">
          ?? ???? ?? ??? ?????. SUPER? ?? ??, MAIN? ??/??/???, SUB? ??/???? ??? ?
          ????.
        </p>

        {role === "SUPER" ? (
          <div className="branding-card">
            <div className="branding-title">?? ???</div>
            <div className="branding-row">
              <div className="branding-preview">
                {logoUrl ? <img src={logoUrl} alt="?? ???" /> : <span className="muted">?? ??</span>}
              </div>
              <div className="branding-actions">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
                />
                <button type="button" onClick={onUploadLogo} disabled={!logoFile}>
                  ?? ??
                </button>
                {logoStatus ? <div className="muted">{logoStatus}</div> : null}
                <div className="muted" style={{ fontSize: "12px" }}>
                  ???? ??? ???/?? ???? ?????.
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", alignItems: "end", gap: "12px", marginTop: "12px" }}>
          {role === "SUPER" ? (
            <label style={{ display: "grid", gap: "4px", maxWidth: "320px" }}>
              ?? ??
              <select value={targetComplexId} onChange={(event) => setTargetComplexId(event.target.value)}>
                {complexes.map((complex) => (
                  <option key={complex.id} value={complex.id}>
                    {complex.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="muted">? ??: {profileComplexId ?? "-"}</div>
          )}
          <button style={{ marginLeft: "auto" }} onClick={onSave}>
            ??
          </button>
        </div>
        {status ? (
          <div className="muted" style={{ marginTop: "8px" }}>
            {status}
          </div>
        ) : null}

        <div className="panel-card" style={{ marginTop: "16px" }}>
          <div className="panel-title">?? ?? (??)</div>
          <div className="menu-order-grid menu-order-grid--row">
            {orderColumns.map((group) => (
              <div key={group} className="menu-order-group">
                <div className="menu-order-title">{roleLabels[group]}</div>
                <div className="menu-order-list">
                  {orderedMenuByRole[group].map((item, index) => (
                    <div key={item.key} className="menu-order-item">
                      <input
                        className="menu-order-label"
                        value={menuLabels[group][item.key] ?? item.label}
                        onChange={(event) => updateLabel(group, item.key, event.target.value)}
                        disabled={!canEditLabels}
                      />
                      <div className="menu-order-actions">
                        <button
                          type="button"
                          onClick={() => moveMenuItem(group, item.key, -1)}
                          disabled={!canEditOrder || index === 0}
                        >
                          ?
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMenuItem(group, item.key, 1)}
                          disabled={!canEditOrder || index === orderedMenuByRole[group].length - 1}
                        >
                          ?
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!canEditOrder ? <div className="muted">?? ??? ?????? ??? ? ????.</div> : null}
          {!canEditLabels ? <div className="muted">?? ?? ??? ?????? ?????.</div> : null}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px" }}>
          <thead>
            <tr>
              <th align="left">??</th>
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
                          description: "?? ?? ??? ?????.",
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
                ??
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </MenuGuard>
  );
}

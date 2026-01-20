"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabaseClient } from "@/lib/supabase/client";
import { menuConfig, type MenuItem } from "../nav/menu.config";
import { resolveMenuLabels, resolveMenuOrder, resolveMenuToggles } from "@/lib/settings/resolve";

type ProfileRow = {
  id: string;
  role: "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";
  complex_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  email: string | null;
};

type SettingsRow = {
  menu_toggles: Record<string, Record<string, boolean>>;
  menu_order?: Record<string, string[]>;
  menu_labels?: Record<string, Record<string, string>>;
};

type ComplexRow = {
  id: string;
  name: string;
};

type BuildingRow = {
  id: string;
  code: string;
  name: string;
  complex_id?: string | null;
};

type UnitRow = {
  id: string;
  code: string;
};

type VehicleRow = {
  id: string;
  plate: string | null;
  qrs?: { id: string; status: string; code: string; created_at?: string }[];
};

type ProfileMenuContentProps = {
  variant?: "sidebar" | "popover";
  onNavigate?: () => void;
};

type ComplexSelectionDetail = {
  complexId?: string;
  complexName?: string;
};

const roleTitle: Record<ProfileRow["role"], string> = {
  SUPER: "슈퍼관리자",
  MAIN: "메인관리자",
  SUB: "서브관리자",
  GUARD: "경비",
  RESIDENT: "입주민",
};

function filterAdminMenu(items: MenuItem[], toggles: Record<string, boolean>) {
  return items.filter((item) => toggles[item.key] !== false);
}

function dropMyPage(items: MenuItem[]) {
  return items.filter((item) => item.key !== "mypage");
}

const buildQrUrl = (code: string) => {
  if (typeof window === "undefined") {
    return code;
  }
  return `${window.location.origin}/q/${code}`;
};

const menuIcons: Record<string, JSX.Element> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  ),
  complexes: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <rect x="7" y="7" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="14" y="7" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="7" y="12" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="14" y="12" width="3" height="3" fill="currentColor" stroke="none" />
    </svg>
  ),
  buildings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 20v-5h6v5" />
    </svg>
  ),
  members: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="8" r="3" />
      <path d="M3 20c1-4 4-6 5-6" />
      <path d="M21 20c-1-4-4-6-5-6" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3" />
      <path d="M4 20c1.5-4 6-6 8-6s6.5 2 8 6" />
    </svg>
  ),
  approvals: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 12l4 4 10-10" />
    </svg>
  ),
  "parking.qrs": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M15 15h5v5h-5z" fill="currentColor" stroke="none" />
    </svg>
  ),
  "parking.scans": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  ),
  "meter.cycles": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </svg>
  ),
  "meter.submissions": (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 7h10" />
      <path d="M7 12h10" />
      <path d="M7 17h6" />
      <rect x="4" y="3" width="16" height="18" rx="2" />
    </svg>
  ),
  notices: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.2-1.6l2-1.4-2-3.5-2.4.8a7 7 0 0 0-2.8-1.6L11 2h-4l-.6 2.7a7 7 0 0 0-2.8 1.6l-2.4-.8-2 3.5 2 1.4A7 7 0 0 0 5 12a7 7 0 0 0 .2 1.6l-2 1.4 2 3.5 2.4-.8a7 7 0 0 0 2.8 1.6L7 22h4l.6-2.7a7 7 0 0 0 2.8-1.6l2.4.8 2-3.5-2-1.4c.1-.5.2-1 .2-1.6Z" />
    </svg>
  ),
  notifications: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 9a6 6 0 1 1 12 0c0 6 2 6 2 6H4s2 0 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  ),
  scan: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7V4h3" />
      <path d="M20 7V4h-3" />
      <path d="M4 17v3h3" />
      <path d="M20 17v3h-3" />
      <path d="M7 12h10" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  myQr: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="6" height="6" rx="1" />
      <rect x="14" y="4" width="6" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <path d="M14 14h6v6h-6z" fill="currentColor" stroke="none" />
    </svg>
  ),
  alerts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v10" />
      <path d="M7 8l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  ),
  meter: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="5" y="3" width="14" height="18" rx="3" />
      <path d="M8 10h8" />
      <path d="M8 14h5" />
    </svg>
  ),
  mypage: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="3" />
      <path d="M4 20c1.5-4 6-6 8-6s6.5 2 8 6" />
    </svg>
  ),
};

const MenuIcon = ({ iconKey }: { iconKey: string }) => {
  return menuIcons[iconKey] ?? menuIcons.dashboard;
};

const orderMenuItems = (items: MenuItem[], order: string[], labels: Record<string, string>) => {
  const map = new Map(items.map((item) => [item.key, item] as const));
  const sorted = order.map((key) => map.get(key)).filter(Boolean) as MenuItem[];
  const remaining = items.filter((item) => !order.includes(item.key));
  return [...sorted, ...remaining].map((item) => ({
    ...item,
    label: labels[item.key] ?? item.label,
  }));
};

export function ProfileMenuContent({ variant = "sidebar", onNavigate }: ProfileMenuContentProps) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [settings, setSettings] = useState<SettingsRow | null>(null);
  const [complexName, setComplexName] = useState<string>("");
  const [buildingLabel, setBuildingLabel] = useState<string>("");
  const [unitLabel, setUnitLabel] = useState<string>("");
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [selectedComplexId, setSelectedComplexId] = useState<string>("all");
  const [email, setEmail] = useState<string>("");
  const [qrStatus, setQrStatus] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [plate, setPlate] = useState<string>("");

  const load = async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      setProfile(null);
      return;
    }

    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("id, role, complex_id, building_id, unit_id, email")
      .eq("id", userId)
      .single();
    if (!profileData) {
      setProfile(null);
      return;
    }

    setProfile(profileData as ProfileRow);
    setEmail(profileData.email ?? sessionData.session?.user.email ?? "");

    if (profileData.complex_id) {
      const { data: complexData } = await supabaseClient
        .from("complexes")
        .select("id, name")
        .eq("id", profileData.complex_id)
        .single();
      setComplexName(complexData?.name ?? "");
    } else {
      setComplexName("");
    }

    if (profileData.building_id) {
      const { data: buildingData } = await supabaseClient
        .from("buildings")
        .select("id, code, name, complex_id")
        .eq("id", profileData.building_id)
        .single();
      const building = buildingData as BuildingRow | null;
      if (building) {
        setBuildingLabel(`${building.code}동${building.name ? ` ${building.name}` : ""}`.trim());
        if (!profileData.complex_id && building.complex_id) {
          const { data: complexFromBuilding } = await supabaseClient
            .from("complexes")
            .select("name")
            .eq("id", building.complex_id)
            .single();
          if (complexFromBuilding?.name) {
            setComplexName(complexFromBuilding.name);
          }
        }
      }
    } else {
      setBuildingLabel("");
    }

    if (profileData.unit_id) {
      const { data: unitData } = await supabaseClient.from("units").select("id, code").eq("id", profileData.unit_id).single();
      const unit = unitData as UnitRow | null;
      setUnitLabel(unit?.code ? `${unit.code}호` : "");
    } else {
      setUnitLabel("");
    }

    const { data: vehicleData } = await supabaseClient
      .from("vehicles")
      .select("id, plate, qrs(id, status, code, created_at)")
      .eq("owner_profile_id", userId)
      .limit(1)
      .maybeSingle();
    const vehicle = vehicleData as VehicleRow | null;
    if (vehicle?.plate) {
      setPlate(vehicle.plate ?? "");
    } else {
      setPlate("");
    }

    if (vehicle?.qrs && vehicle.qrs.length > 0) {
      const sorted = [...vehicle.qrs].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      });
      const qr = sorted[0];
      setQrStatus(qr.status);
      try {
        const url = await QRCode.toDataURL(buildQrUrl(qr.code));
        setQrDataUrl(url);
      } catch {
        setQrDataUrl(null);
      }
    } else {
      setQrStatus(null);
      setQrDataUrl(null);
    }

    if (profileData.role === "SUPER") {
      const token = sessionData.session?.access_token ?? "";
      const responseComplexes = await fetch("/api/complexes", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (responseComplexes.ok) {
        const complexData = await responseComplexes.json();
        const list = complexData.complexes ?? [];
        setComplexes(list);
        const storedId = localStorage.getItem("selectedComplexId") ?? "all";
        const hasStored = storedId !== "all" && list.some((item: ComplexRow) => item.id === storedId);
        const nextId = hasStored ? storedId : "all";
        setSelectedComplexId(nextId);
        if (nextId !== "all") {
          const selected = list.find((item: ComplexRow) => item.id === nextId);
          if (selected?.name) {
            setComplexName(selected.name);
          }
        } else {
          setComplexName("");
        }
      }
    }

    if (profileData.role !== "SUPER" && profileData.complex_id) {
      setSelectedComplexId(profileData.complex_id);
      const token = sessionData.session?.access_token ?? "";
      if (token) {
        const responseSettings = await fetch("/api/settings", {
          headers: { authorization: `Bearer ${token}` },
        });
        if (responseSettings.ok) {
          const settingsData = await responseSettings.json();
          if (settingsData?.menu_toggles) {
            setSettings({
              menu_toggles: settingsData.menu_toggles,
              menu_order: settingsData.menu_order,
              menu_labels: settingsData.menu_labels,
            });
            return;
          }
        }
      }
      const { data: settingsData } = await supabaseClient
        .from("settings")
        .select("menu_toggles, menu_order, menu_labels")
        .eq("complex_id", profileData.complex_id)
        .single();
      if (settingsData) {
        setSettings(settingsData as SettingsRow);
      }
    }
  };

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("profileUpdated", handler);
    return () => window.removeEventListener("profileUpdated", handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { complexId?: string; complexName?: string } | undefined;
      if (!detail?.complexId) {
        return;
      }
      setSelectedComplexId(detail.complexId);
      if (detail.complexName !== undefined) {
        setComplexName(detail.complexName);
      } else if (detail.complexId === "all") {
        setComplexName("");
      }
    };
    window.addEventListener("complexSelectionChanged", handler as EventListener);
    return () => window.removeEventListener("complexSelectionChanged", handler as EventListener);
  }, []);

  const items = useMemo(() => {
    if (!profile) {
      return [];
    }
    const orders = resolveMenuOrder(settings?.menu_order as any);
    const labels = resolveMenuLabels(settings?.menu_labels as any);
    if (profile.role === "GUARD") {
      const toggles = resolveMenuToggles(settings?.menu_toggles as any).guard;
      const ordered = orderMenuItems(menuConfig.guard, orders.guard, labels.guard);
      return dropMyPage(ordered.filter((item) => toggles[item.key] !== false));
    }
    if (profile.role === "RESIDENT") {
      const toggles = resolveMenuToggles(settings?.menu_toggles as any).resident;
      const ordered = orderMenuItems(menuConfig.resident, orders.resident, labels.resident);
      return dropMyPage(ordered.filter((item) => toggles[item.key] !== false));
    }
    const adminItems = menuConfig.admin;
    if (profile.role === "MAIN") {
      const toggles = resolveMenuToggles(settings?.menu_toggles as any).main;
      const ordered = orderMenuItems(adminItems, orders.main, labels.main);
      return dropMyPage(filterAdminMenu(ordered, toggles));
    }
    if (profile.role === "SUB") {
      const toggles = resolveMenuToggles(settings?.menu_toggles as any).sub;
      const ordered = orderMenuItems(adminItems, orders.sub, labels.sub);
      return dropMyPage(filterAdminMenu(ordered, toggles));
    }
    const ordered = orderMenuItems(adminItems, orders.super, labels.super);
    return dropMyPage(ordered);
  }, [profile, settings]);

  const mypageHref =
    profile?.role === "GUARD"
      ? "/guard/mypage"
      : profile?.role === "RESIDENT"
      ? "/resident/mypage"
      : "/admin/mypage";
  const notificationsHref =
    profile?.role === "GUARD"
      ? "/guard/notifications"
      : profile?.role === "RESIDENT"
      ? "/resident/notifications"
      : "/admin/notifications";

  const qrStatusLabel = (() => {
    if (qrStatus) {
      if (qrStatus === "ACTIVE" || qrStatus === "active") {
        return "활성";
      }
      if (qrStatus === "INACTIVE" || qrStatus === "inactive") {
        return "비활성";
      }
      return qrStatus;
    }
    if (profile?.role === "RESIDENT") {
      return "없음";
    }
    return "-";
  })();

  const qrHint = qrDataUrl
    ? null
    : profile?.role === "RESIDENT"
    ? "QR 이미지가 없습니다."
    : "QR 정보가 없습니다.";

  const onLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push("/auth/login");
  };

  const handleComplexChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = event.target.value;
    setSelectedComplexId(nextId);
    if (!nextId || nextId === "all") {
      localStorage.removeItem("selectedComplexId");
      localStorage.removeItem("selectedComplexName");
      window.dispatchEvent(
        new CustomEvent("complexSelectionChanged", { detail: { complexId: "all", complexName: "" } })
      );
      return;
    }
    const selected = complexes.find((item) => item.id === nextId);
    const name = selected?.name ?? "";
    localStorage.setItem("selectedComplexId", nextId);
    if (name) {
      localStorage.setItem("selectedComplexName", name);
    }
    window.dispatchEvent(
      new CustomEvent<ComplexSelectionDetail>("complexSelectionChanged", {
        detail: { complexId: nextId, complexName: name },
      })
    );
  };

  const roleLabel = profile ? roleTitle[profile.role] : "역할 없음";

  return (
    <div className={variant === "popover" ? "profile-menu-content" : ""}>
      <div className={`page-title role-title role-${profile?.role?.toLowerCase() ?? "guest"}`}>{roleLabel}</div>
      {profile?.role === "SUPER" ? (
        <label style={{ marginBottom: "12px" }}>
          단지 선택
          <select value={selectedComplexId} onChange={handleComplexChange}>
            <option value="all">전체 단지</option>
            {complexes.map((complex) => (
              <option key={complex.id} value={complex.id}>
                {complex.name}
              </option>
            ))}
          </select>
        </label>
      ) : profile?.role === "MAIN" ? (
        <div className="muted" style={{ marginBottom: "12px" }}>
          {complexName || "-"} / {buildingLabel || "-"}
        </div>
      ) : profile?.role === "SUB" ? (
        <div className="muted" style={{ marginBottom: "12px" }}>
          {complexName || "-"} / {buildingLabel || "-"}
        </div>
      ) : profile?.role === "GUARD" ? (
        <div className="muted" style={{ marginBottom: "12px" }}>
          {complexName || "-"} / {buildingLabel || "-"}
        </div>
      ) : profile?.role === "RESIDENT" ? (
        <div className="muted" style={{ marginBottom: "12px" }}>
          {complexName || "-"} / {buildingLabel || "-"} / {unitLabel || "-"}
        </div>
      ) : null}

      {variant === "popover" ? (
        <div className="profile-menu__section">
          <div className="profile-menu__heading">내 정보</div>
          <div className="profile-menu__row">
            <span className="profile-menu__label">내 레벨</span>
            <span>{roleLabel}</span>
          </div>
          <div className="profile-menu__row">
            <span className="profile-menu__label">내 이메일</span>
            <span>{email || "-"}</span>
          </div>
          <div className="profile-menu__row">
            <span className="profile-menu__label">차량 번호</span>
            <span>{plate || "-"}</span>
          </div>
          <div className="profile-menu__row">
            <span className="profile-menu__label">QR 상태</span>
            <span>{qrStatusLabel}</span>
          </div>
          <div className="profile-menu__qr">
            {qrDataUrl ? <img className="profile-qr" src={qrDataUrl} alt="내 QR" /> : null}
            {qrHint ? <div className="muted">{qrHint}</div> : null}
          </div>
          <Link className="profile-menu__edit" href={mypageHref} onClick={onNavigate}>
            내 정보 수정
          </Link>
          <Link className="profile-menu__edit" href={notificationsHref} onClick={onNavigate}>
            <span className="profile-menu__icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 9a6 6 0 1 1 12 0c0 6 2 6 2 6H4s2 0 2-6Z" />
                <path d="M10 19a2 2 0 0 0 4 0" />
              </svg>
            </span>
            알림
          </Link>
        </div>
      ) : null}

      {variant === "sidebar" ? (
        items.length === 0 ? (
          <div className="muted">표시할 메뉴가 없습니다.</div>
        ) : (
          <div className="menu-list">
            {items.map((item) => (
              <Link key={item.key} href={item.href} onClick={onNavigate}>
                <span className="menu-icon" aria-hidden>
                  <MenuIcon iconKey={item.key} />
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        )
      ) : null}

      {variant === "popover" ? (
        <button className="profile-menu__logout" type="button" onClick={onLogout}>
          로그아웃
        </button>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";
import { Forbidden } from "@/components/layout/Forbidden";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { useEditMode } from "@/lib/auth/editMode";

type Profile = {
  id: string;
  email: string;
  role: "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";
  complex_id: string | null;
  building_id: string | null;
  unit?: string | null;
  avatar_url?: string | null;
};

type ComplexRow = {
  id: string;
  name: string;
};

type BuildingRow = {
  id: string;
  complex_id: string;
  code: string;
  name: string;
};

type VehicleRow = {
  id: string;
  owner_profile_id: string;
  plate?: string | null;
  plate_number?: string | null;
};

type QrRow = {
  id: string;
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "REVOKED";
  vehicle_id: string;
};

type ScanRow = {
  id: string;
  created_at: string;
  complex_id: string | null;
  qr_id: string | null;
  result: string | null;
  location_label: string | null;
};

type ApprovalRow = {
  id: string;
  status: string | null;
};

const roleLabel: Record<Profile["role"], string> = {
  SUPER: "슈퍼관리자",
  MAIN: "메인관리자",
  SUB: "서브관리자",
  GUARD: "경비",
  RESIDENT: "입주민",
};

const resultLabel: Record<string, string> = {
  resident: "입주민 차량",
  target: "단속 대상",
  invalid: "유효하지 않은 QR",
};

function toResultKey(value: string | null) {
  if (!value) return "invalid";
  const key = value.toLowerCase();
  if (key === "resident" || key === "target" || key === "invalid") {
    return key;
  }
  return "invalid";
}

export default function Page() {
  const router = useRouter();
  const { enabled, setEnabled } = useEditMode();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [qrs, setQrs] = useState<QrRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [selectedComplexId, setSelectedComplexId] = useState<string>("all");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");

  useEffect(() => {
    const saved = localStorage.getItem("selectedComplexId");
    if (saved) {
      setSelectedComplexId(saved);
    }
    const handleSelection = (event: Event) => {
      const detail = (event as CustomEvent).detail as { complexId?: string } | undefined;
      if (detail?.complexId) {
        setSelectedComplexId(detail.complexId);
      }
    };
    window.addEventListener("complexSelectionChanged", handleSelection as EventListener);
    return () => window.removeEventListener("complexSelectionChanged", handleSelection as EventListener);
  }, []);

  const handleComplexChange = (value: string) => {
    setSelectedComplexId(value);
    if (value === "all") {
      localStorage.removeItem("selectedComplexId");
      localStorage.removeItem("selectedComplexName");
    } else {
      localStorage.setItem("selectedComplexId", value);
      const name = complexes.find((complex) => complex.id === value)?.name;
      if (name) {
        localStorage.setItem("selectedComplexName", name);
      }
    }
    const name = value === "all" ? "" : complexes.find((complex) => complex.id === value)?.name ?? "";
    window.dispatchEvent(
      new CustomEvent("complexSelectionChanged", { detail: { complexId: value, complexName: name } })
    );
  };

  useEffect(() => {
    document.body.classList.add("dashboard-super");
    return () => document.body.classList.remove("dashboard-super");
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }
      const { data } = await supabaseClient
        .from("profiles")
        .select("id, email, role, complex_id, building_id, avatar_url")
        .eq("id", userId)
        .single();
      if (data) {
        const row = data as Profile;
        setProfile(row);
        setAvatarUrl(row.avatar_url ?? null);
        setAllowed(row.role === "SUPER");
      }
    };
    load();
  }, []);

  useEffect(() => {
    const refreshAvatar = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }
      const { data } = await supabaseClient
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();
      if (data) {
        setAvatarUrl((data as { avatar_url: string | null }).avatar_url ?? null);
      }
    };
    const handleProfileUpdated = () => {
      void refreshAvatar();
    };
    window.addEventListener("profileUpdated", handleProfileUpdated);
    return () => window.removeEventListener("profileUpdated", handleProfileUpdated);
  }, []);

  useEffect(() => {
    if (!allowed) {
      return;
    }
    let active = true;
    const load = async () => {
      const [
        { data: complexData },
        { data: buildingData },
        { data: profileData },
        { data: vehicleData },
        { data: qrData },
        { data: scanData },
        { data: approvalData },
      ] = await Promise.all([
        supabaseClient.from("complexes").select("id, name").order("name"),
        supabaseClient.from("buildings").select("id, complex_id, code, name").order("code"),
        supabaseClient
          .from("profiles")
          .select("id, email, role, complex_id, building_id")
          .order("created_at", { ascending: false }),
        supabaseClient
          .from("vehicles")
          .select("id, owner_profile_id, plate")
          .order("created_at", { ascending: false }),
        supabaseClient.from("qrs").select("id, status, vehicle_id").order("created_at", { ascending: false }),
        supabaseClient
          .from("scans")
          .select("id, created_at, complex_id, qr_id, result, location_label")
          .order("created_at", { ascending: false }),
        supabaseClient.from("approvals").select("id, status").order("requested_at", { ascending: false }),
      ]);

      if (!active) {
        return;
      }
      setComplexes((complexData ?? []) as ComplexRow[]);
      setBuildings((buildingData ?? []) as BuildingRow[]);
      setProfiles((profileData ?? []) as Profile[]);
      setVehicles((vehicleData ?? []) as VehicleRow[]);
      setQrs((qrData ?? []) as QrRow[]);
      setScans((scanData ?? []) as ScanRow[]);
      setApprovals((approvalData ?? []) as ApprovalRow[]);
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [allowed]);

  useEffect(() => {
    if (selectedComplexId === "all") {
      return;
    }
    if (complexes.some((complex) => complex.id === selectedComplexId)) {
      return;
    }
    setSelectedComplexId("all");
    localStorage.removeItem("selectedComplexId");
    localStorage.removeItem("selectedComplexName");
  }, [complexes, selectedComplexId]);

  useEffect(() => {
    if (selectedComplexId === "all") {
      setSelectedBuildingId("all");
      return;
    }
    if (selectedBuildingId === "all") {
      return;
    }
    const belongs = buildings.some(
      (building) => building.id === selectedBuildingId && building.complex_id === selectedComplexId
    );
    if (!belongs) {
      setSelectedBuildingId("all");
    }
  }, [selectedComplexId, selectedBuildingId, buildings]);

  const buildingOptions = useMemo(() => {
    if (selectedComplexId === "all") {
      return buildings;
    }
    return buildings.filter((building) => building.complex_id === selectedComplexId);
  }, [buildings, selectedComplexId]);

  const complexNameById = useMemo(() => {
    return new Map(complexes.map((complex) => [complex.id, complex.name]));
  }, [complexes]);

  const buildingNameById = useMemo(() => {
    return new Map(buildings.map((building) => [building.id, `${building.code}동`]));
  }, [buildings]);

  const buildingComplexMap = useMemo(() => {
    return new Map(buildings.map((building) => [building.id, building.complex_id]));
  }, [buildings]);

  const profileMap = useMemo(() => {
    return new Map(profiles.map((p) => [p.id, p]));
  }, [profiles]);

  const vehicleMap = useMemo(() => {
    return new Map(vehicles.map((v) => [v.id, v]));
  }, [vehicles]);

  const qrMap = useMemo(() => {
    return new Map(qrs.map((q) => [q.id, q]));
  }, [qrs]);

  const filteredProfiles = useMemo(() => {
    return profiles.filter((item) => {
      const effectiveComplexId = item.complex_id ?? (item.building_id ? buildingComplexMap.get(item.building_id) : null);
      const complexMatch = selectedComplexId === "all" || effectiveComplexId === selectedComplexId;
      const buildingMatch = selectedBuildingId === "all" || item.building_id === selectedBuildingId;
      return complexMatch && buildingMatch;
    });
  }, [profiles, selectedComplexId, selectedBuildingId, buildingComplexMap]);

  const filteredProfileIds = useMemo(() => new Set(filteredProfiles.map((p) => p.id)), [filteredProfiles]);

  const filteredVehicles = useMemo(
    () => vehicles.filter((v) => filteredProfileIds.has(v.owner_profile_id)),
    [vehicles, filteredProfileIds]
  );

  const filteredVehicleIds = useMemo(() => new Set(filteredVehicles.map((v) => v.id)), [filteredVehicles]);

  const filteredQrs = useMemo(
    () => qrs.filter((q) => filteredVehicleIds.has(q.vehicle_id)),
    [qrs, filteredVehicleIds]
  );

  const filteredScans = useMemo(() => {
    return scans.filter((scan) => {
      if (selectedComplexId !== "all" && scan.complex_id !== selectedComplexId) {
        return false;
      }
      if (selectedBuildingId === "all") {
        return true;
      }
      const qr = scan.qr_id ? qrMap.get(scan.qr_id) : null;
      const vehicle = qr ? vehicleMap.get(qr.vehicle_id) : null;
      const owner = vehicle ? profileMap.get(vehicle.owner_profile_id) : null;
      return owner?.building_id === selectedBuildingId;
    });
  }, [scans, selectedComplexId, selectedBuildingId, qrMap, vehicleMap, profileMap]);

  const filteredApprovals = useMemo(() => {
    return approvals.filter((item) => {
      const status = item.status ? item.status.toLowerCase() : "";
      return status === "pending";
    });
  }, [approvals]);

  const metrics = useMemo(() => {
    const residentCount = filteredProfiles.filter((p) => p.role === "RESIDENT").length;
    const guardCount = filteredProfiles.filter((p) => p.role === "GUARD").length;
    const adminCount = filteredProfiles.filter((p) => p.role === "MAIN" || p.role === "SUB").length;
    const activeQr = filteredQrs.filter((q) => q.status === "ACTIVE").length;
    const inactiveQr = filteredQrs.filter((q) => q.status === "INACTIVE").length;

    return {
      complexes: selectedComplexId === "all" ? complexes.length : 1,
      buildings: selectedBuildingId === "all" ? buildingOptions.length : 1,
      residents: residentCount,
      guards: guardCount,
      admins: adminCount,
      vehicles: filteredVehicles.length,
      scans: filteredScans.length,
      qrActive: activeQr,
      qrInactive: inactiveQr,
      approvals: filteredApprovals.length,
      totalMembers: filteredProfiles.length,
    };
  }, [
    filteredProfiles,
    filteredVehicles,
    filteredQrs,
    filteredScans,
    filteredApprovals.length,
    complexes.length,
    buildingOptions.length,
    selectedComplexId,
    selectedBuildingId,
  ]);

  const roleStats = useMemo(() => {
    const base = { SUPER: 0, MAIN: 0, SUB: 0, GUARD: 0, RESIDENT: 0 } as Record<Profile["role"], number>;
    filteredProfiles.forEach((item) => {
      base[item.role] += 1;
    });
    return base;
  }, [filteredProfiles]);

  const scanTrend = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return {
        key,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        resident: 0,
        target: 0,
      };
    });
    const indexMap = new Map(days.map((d, idx) => [d.key, idx]));
    filteredScans.forEach((scan) => {
      const key = new Date(scan.created_at).toISOString().slice(0, 10);
      const idx = indexMap.get(key);
      if (idx !== undefined) {
        const resultKey = toResultKey(scan.result);
        if (resultKey === "resident") {
          days[idx].resident += 1;
        } else if (resultKey === "target") {
          days[idx].target += 1;
        }
      }
    });
    return days;
  }, [filteredScans]);

  const residentDistribution = useMemo(() => {
    if (selectedComplexId === "all") {
      const map = new Map<string, number>();
      filteredProfiles
        .filter((p) => p.role === "RESIDENT")
        .forEach((p) => {
          const complexId = p.complex_id ?? (p.building_id ? buildingComplexMap.get(p.building_id) : null);
          if (!complexId) {
            return;
          }
          map.set(complexId, (map.get(complexId) ?? 0) + 1);
        });
      return Array.from(map.entries()).map(([id, value]) => ({
        label: complexNameById.get(id) ?? "-",
        value,
      }));
    }

    const map = new Map<string, number>();
    filteredProfiles
      .filter((p) => p.role === "RESIDENT")
      .forEach((p) => {
        if (!p.building_id) {
          return;
        }
        map.set(p.building_id, (map.get(p.building_id) ?? 0) + 1);
      });
    return Array.from(map.entries()).map(([id, value]) => ({
      label: buildingNameById.get(id) ?? "-",
      value,
    }));
  }, [filteredProfiles, selectedComplexId, complexNameById, buildingNameById, buildingComplexMap]);

  const scanMax = Math.max(
    1,
    ...scanTrend.flatMap((item) => [item.resident, item.target])
  );
  const maxResident = Math.max(...residentDistribution.map((item) => item.value), 1);
  const maxRole = Math.max(...Object.values(roleStats), 1);

  const todayKey = new Date().toISOString().slice(0, 10);
  const dailyScans = filteredScans.filter((scan) => scan.created_at.slice(0, 10) === todayKey).length;

  const recentScans = useMemo(() => {
    return filteredScans.slice(0, 5).map((scan) => {
      const qr = scan.qr_id ? qrMap.get(scan.qr_id) : null;
      const vehicle = qr ? vehicleMap.get(qr.vehicle_id) : null;
      const profile = vehicle ? profileMap.get(vehicle.owner_profile_id) : null;
      const plate = vehicle?.plate ?? vehicle?.plate_number ?? "-";
      return {
        id: scan.id,
        time: new Date(scan.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }),
        result: toResultKey(scan.result),
        plate,
        location: scan.location_label || "위치 미지정",
        unit: profile?.building_id
          ? `${buildingNameById.get(profile.building_id) ?? "-"} ${profile.unit ?? ""}`.trim()
          : "-",
      };
    });
  }, [filteredScans, qrMap, vehicleMap, profileMap, buildingNameById]);

  const getLinePath = (values: number[], height = 60) => {
    if (values.length === 0) return "";
    const step = values.length === 1 ? 0 : 100 / (values.length - 1);
    return values
      .map((value, index) => {
        const x = step * index;
        const y = height - (value / scanMax) * height;
        return `${index === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");
  };

  const getAreaPath = (values: number[], height = 60) => {
    if (values.length === 0) return "";
    const step = values.length === 1 ? 0 : 100 / (values.length - 1);
    const points = values.map((value, index) => {
      const x = step * index;
      const y = height - (value / scanMax) * height;
      return `${x},${y}`;
    });
    const lastX = step * (values.length - 1);
    return `M0,${height} L${points.join(" L")} L${lastX},${height} Z`;
  };

  if (allowed === null) {
    return <div className="muted">로딩 중입니다.</div>;
  }
  if (!allowed) {
    return <Forbidden message="접근 권한이 없습니다." />;
  }

  return (
    <MenuGuard roleGroup="sub" toggleKey="dashboard">
      <div className="dashboard dashboard--super">
        <div className="dashboard-desktop">
          <div className="dashboard-header">
            <div>
              <h1 className="page-title">슈퍼관리자 대시보드</h1>
              <div className="muted">데이터 통계와 입주민 통계를 한눈에 확인하세요.</div>
            </div>
            <div className="dashboard-filters">
              <label>
                단지
                <select value={selectedComplexId} onChange={(event) => handleComplexChange(event.target.value)}>
                  <option value="all">전체</option>
                  {complexes.map((complex) => (
                    <option key={complex.id} value={complex.id}>
                      {complex.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                동
                <select value={selectedBuildingId} onChange={(event) => setSelectedBuildingId(event.target.value)}>
                  <option value="all">전체</option>
                  {buildingOptions.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.code}동
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

            <div className="dashboard-grid">
            <div className="stat-card">
              <span className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="4" y="3" width="16" height="18" rx="2" />
                  <rect x="7" y="7" width="3" height="3" fill="currentColor" stroke="none" />
                  <rect x="14" y="7" width="3" height="3" fill="currentColor" stroke="none" />
                  <rect x="7" y="12" width="3" height="3" fill="currentColor" stroke="none" />
                  <rect x="14" y="12" width="3" height="3" fill="currentColor" stroke="none" />
                </svg>
              </span>
              <div className="stat-label">단지 수</div>
              <div className="stat-value">{metrics.complexes}</div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="5" y="4" width="14" height="16" rx="2" />
                  <path d="M9 20v-5h6v5" />
                </svg>
              </span>
              <div className="stat-label">동 수</div>
              <div className="stat-value">{metrics.buildings}</div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="8" r="3" />
                  <path d="M4 20c1.5-4 6-6 8-6s6.5 2 8 6" />
                </svg>
              </span>
              <div className="stat-label">입주민 수</div>
              <div className="stat-value">{metrics.residents}</div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3z" />
                </svg>
              </span>
              <div className="stat-label">관리자/경비</div>
              <div className="stat-value">{metrics.admins + metrics.guards}</div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 13l2-5h12l2 5" />
                  <path d="M5 13h14v5H5z" />
                  <circle cx="8" cy="18" r="1.5" />
                  <circle cx="16" cy="18" r="1.5" />
                </svg>
              </span>
              <div className="stat-label">차량 등록</div>
              <div className="stat-value">{metrics.vehicles}</div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <rect x="4" y="4" width="16" height="16" rx="3" />
                  <path d="M8 12h8" />
                  <path d="M12 8v8" />
                </svg>
              </span>
              <div className="stat-label">스캔 누적</div>
              <div className="stat-value">{metrics.scans}</div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M4 12l4 4 12-12" />
                </svg>
              </span>
              <div className="stat-label">QR 활성</div>
              <div className="stat-value">{metrics.qrActive}?</div>
            </div>
            <div className="stat-card">
              <span className="stat-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M6 6l12 12" />
                  <path d="M18 6l-12 12" />
                </svg>
              </span>
              <div className="stat-label">QR 비활성</div>
              <div className="stat-value">{metrics.qrInactive}</div>
            </div>
          </div>

          <div className="dashboard-charts">
            <section className="chart-card">
              <div className="chart-title">최근 7일 스캔 추이</div>
              <div className="chart-bars">
                {scanTrend.map((item) => (
                  <div key={item.key} className="chart-bar">
                    <div className="chart-bar__fill" style={{ width: `${((item.resident + item.target) / scanMax) * 100}%` }} />
                    <div className="chart-bar__label">
                      {item.label} ({item.resident + item.target})
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="chart-card">
              <div className="chart-title">역할 분포</div>
              <div className="chart-bars">
                {Object.entries(roleStats).map(([role, value]) => (
                  <div key={role} className="chart-bar">
                    <div className="chart-bar__fill" style={{ width: `${(value / maxRole) * 100}%` }} />
                    <div className="chart-bar__label">
                      {roleLabel[role as Profile["role"]]} ({value})
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="chart-card">
              <div className="chart-title">
                {selectedComplexId === "all" ? "단지별 입주민 분포" : "동별 입주민 분포"}
              </div>
              <div className="chart-bars">
                {residentDistribution.length === 0 ? (
                  <div className="muted">표시할 데이터가 없습니다.</div>
                ) : (
                  residentDistribution.map((item) => (
                    <div key={item.label} className="chart-bar">
                      <div className="chart-bar__fill" style={{ width: `${(item.value / maxResident) * 100}%` }} />
                      <div className="chart-bar__label">
                        {item.label} ({item.value})
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="dashboard-mobile">
          <div className="mobile-appbar">
            <button type="button" className="mobile-appbar__back" onClick={() => router.back()} aria-label="뒤로가기">
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="mobile-appbar__title">QR Parking MVP</div>
            <button
              type="button"
              className="mobile-appbar__profile"
              onClick={() => router.push("/admin/mypage")}
              aria-label="마이페이지"
            >
              {avatarUrl ? (
                <img className="mobile-appbar__avatar" src={avatarUrl} alt="프로필 이미지" />
              ) : (
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M7 18c1.4-2.2 3.8-3.5 5-3.5s3.6 1.3 5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              )}
            </button>
          </div>

          <div className="mobile-filterbar">
            <label className="mobile-filterbar__select">
              
              <select value={selectedComplexId} onChange={(event) => handleComplexChange(event.target.value)}>
                <option value="all">전체 단지</option>
                {complexes.map((complex) => (
                  <option key={complex.id} value={complex.id}>
                    {complex.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mobile-filterbar__toggle">
              <span>편집 모드</span>
              <label className="toggle-switch">
                <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          <div className="mobile-scroll">
            <div className="mobile-kpi-grid">
              <div className="mobile-kpi-card">
                <div className="mobile-kpi-icon mobile-kpi-icon--members" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M4 20c1.6-4.2 6.3-6 8-6s6.4 1.8 8 6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </div>
                <div className="mobile-kpi-title">총 회원</div>
                <div className="mobile-kpi-value">{metrics.totalMembers}?</div>
                <div className="mobile-kpi-spark mobile-kpi-spark--rose" />
              </div>
              <div className="mobile-kpi-card">
                <div className="mobile-kpi-icon mobile-kpi-icon--qr" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="4" y="4" width="7" height="7" rx="1" />
                    <rect x="13" y="4" width="7" height="7" rx="1" />
                    <rect x="4" y="13" width="7" height="7" rx="1" />
                    <path d="M13 13h3v3h-3zM16 16h4v4h-4z" />
                  </svg>
                </div>
                <div className="mobile-kpi-title">활성 QR</div>
                <div className="mobile-kpi-value">{metrics.qrActive}?</div>
                <div className="mobile-kpi-spark mobile-kpi-spark--amber" />
              </div>
              <div className="mobile-kpi-card">
                <div className="mobile-kpi-icon mobile-kpi-icon--scan" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8 12h8" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </div>
                <div className="mobile-kpi-title">일반 스캔</div>
                <div className="mobile-kpi-value">{dailyScans}?</div>
                <div className="mobile-kpi-spark mobile-kpi-spark--blue" />
              </div>
              <div className="mobile-kpi-card">
                <div className="mobile-kpi-icon mobile-kpi-icon--approval" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M8 12l2.5 2.5L16 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="mobile-kpi-title">승인 대기</div>
                <div className="mobile-kpi-value">{metrics.approvals}?</div>
                <div className="mobile-kpi-spark mobile-kpi-spark--red" />
              </div>
            </div>

            <div className="mobile-card">
              <div className="mobile-card__title">스캔 통계</div>
              <svg viewBox="0 0 100 60" className="mobile-linechart" aria-hidden="true">
                <defs>
                  <linearGradient id="residentArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="targetArea" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 20 H100" className="chart-grid" />
                <path d="M0 40 H100" className="chart-grid" />
                <path d={getAreaPath(scanTrend.map((item) => item.resident))} className="line-area line-area--resident" />
                <path d={getAreaPath(scanTrend.map((item) => item.target))} className="line-area line-area--target" />
                <path d={getLinePath(scanTrend.map((item) => item.resident))} className="line-resident" />
                <path d={getLinePath(scanTrend.map((item) => item.target))} className="line-target" />
              </svg>
              <div className="mobile-linechart-legend">
                <span className="legend-dot legend-dot--resident">입주민 차량</span>
                <span className="legend-dot legend-dot--target">단속 차량</span>
              </div>
            </div>

            <div className="mobile-card">
              <div className="mobile-card__title">최근 스캔</div>
              <div className="mobile-scan-list">
                {recentScans.length === 0 ? (
                  <div className="muted">최근 스캔이 없습니다.</div>
                ) : (
                  recentScans.map((scan) => (
                    <div key={scan.id} className="mobile-scan-row">
                      <div className="mobile-scan-time">{scan.time}</div>
                      <div className={`mobile-scan-badge mobile-scan-badge--${scan.result}`}>
                        {resultLabel[scan.result]}
                      </div>
                      <div className="mobile-scan-plate">{scan.plate}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
<div className="mobile-tabbar">
            <button type="button" className="mobile-tabbar__item is-active" aria-current="page">
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M7 8h10M7 12h10M7 16h6" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>대시보드</span>
            </button>
            <button type="button" className="mobile-tabbar__item" onClick={() => router.push("/complexes")}> 
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10 21v-4h4v4" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>단지 관리</span>
            </button>
            <button type="button" className="mobile-tabbar__item" onClick={() => router.push("/members")}> 
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <circle cx="12" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M5 20c1.2-3 4.2-5 7-5s5.8 2 7 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>회원관리</span>
            </button>
            <button type="button" className="mobile-tabbar__item mobile-tabbar__item--settings" onClick={() => router.push("/settings")}> 
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>설정</span>
            </button>
          </div>
        </div>
      </div>
    </MenuGuard>
  );
}

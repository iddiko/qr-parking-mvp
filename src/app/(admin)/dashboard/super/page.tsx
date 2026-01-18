"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { Forbidden } from "@/components/layout/Forbidden";
import { MenuGuard } from "@/components/layout/MenuGuard";

type Profile = {
  id: string;
  email: string;
  role: "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";
  complex_id: string | null;
  building_id: string | null;
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
};

type QrRow = {
  id: string;
  status: "ACTIVE" | "INACTIVE";
  vehicle_id: string;
};

type ScanRow = {
  id: string;
  created_at: string;
  complex_id: string | null;
  qr_id: string | null;
};

const roleLabel: Record<Profile["role"], string> = {
  SUPER: "슈퍼관리자",
  MAIN: "메인관리자",
  SUB: "서브관리자",
  GUARD: "경비",
  RESIDENT: "입주민",
};

export default function Page() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [qrs, setQrs] = useState<QrRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [selectedComplexId, setSelectedComplexId] = useState<string>("all");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }
      const { data } = await supabaseClient
        .from("profiles")
        .select("id, email, role, complex_id, building_id")
        .eq("id", userId)
        .single();
      if (data) {
        const row = data as Profile;
        setProfile(row);
        setAllowed(row.role === "SUPER");
      }
    };
    load();
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
      ] = await Promise.all([
        supabaseClient.from("complexes").select("id, name").order("name"),
        supabaseClient.from("buildings").select("id, complex_id, code, name").order("code"),
        supabaseClient
          .from("profiles")
          .select("id, email, role, complex_id, building_id")
          .order("created_at", { ascending: false }),
        supabaseClient.from("vehicles").select("id, owner_profile_id").order("created_at", { ascending: false }),
        supabaseClient.from("qrs").select("id, status, vehicle_id").order("created_at", { ascending: false }),
        supabaseClient.from("scans").select("id, created_at, complex_id, qr_id").order("created_at", { ascending: false }),
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
    };
  }, [
    filteredProfiles,
    filteredVehicles,
    filteredQrs,
    filteredScans,
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
      return { key, label: `${date.getMonth() + 1}/${date.getDate()}`, value: 0 };
    });
    const indexMap = new Map(days.map((d, idx) => [d.key, idx]));
    filteredScans.forEach((scan) => {
      const key = new Date(scan.created_at).toISOString().slice(0, 10);
      const idx = indexMap.get(key);
      if (idx !== undefined) {
        days[idx].value += 1;
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

  const maxScan = Math.max(...scanTrend.map((item) => item.value), 1);
  const maxResident = Math.max(...residentDistribution.map((item) => item.value), 1);
  const maxRole = Math.max(...Object.values(roleStats), 1);

  if (allowed === null) {
    return <div className="muted">권한 확인 중...</div>;
  }
  if (!allowed) {
    return <Forbidden message="슈퍼관리자 전용 화면입니다." />;
  }

  return (
    <MenuGuard roleGroup="sub" toggleKey="dashboard">
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="page-title">슈퍼관리자 대시보드</h1>
            <div className="muted">모든 단지의 통계를 한눈에 확인하세요.</div>
          </div>
          <div className="dashboard-filters">
            <label>
              단지
              <select value={selectedComplexId} onChange={(event) => setSelectedComplexId(event.target.value)}>
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
            <div className="stat-value">{metrics.qrActive}</div>
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
                  <div className="chart-bar__fill" style={{ width: `${(item.value / maxScan) * 100}%` }} />
                  <div className="chart-bar__label">
                    {item.label} ({item.value})
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
    </MenuGuard>
  );
}

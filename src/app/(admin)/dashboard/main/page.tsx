"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";

type ProfileRow = {
  id: string;
  email: string;
  role: "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";
  complex_id: string | null;
  building_id: string | null;
};

type BuildingRow = {
  id: string;
  code: string;
  name: string;
  complex_id: string;
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

type ComplexRow = {
  id: string;
  name: string;
};

const roleLabel: Record<ProfileRow["role"], string> = {
  SUPER: "슈퍼관리자",
  MAIN: "메인관리자",
  SUB: "서브관리자",
  GUARD: "경비",
  RESIDENT: "입주민",
};

export default function Page() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [complex, setComplex] = useState<ComplexRow | null>(null);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [qrs, setQrs] = useState<QrRow[]>([]);
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const userId = sessionData.session?.user.id;
    if (!userId) {
      return null;
    }
    const { data } = await supabaseClient
      .from("profiles")
      .select("id, email, role, complex_id, building_id")
      .eq("id", userId)
      .single();
    if (data) {
      const row = data as ProfileRow;
      setProfile(row);
      return row;
    }
    return null;
  };

  const loadData = async (currentProfile: ProfileRow) => {
    if (!currentProfile.complex_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const complexId = currentProfile.complex_id;

    const [{ data: complexData }, { data: buildingData }, { data: profileData }, { data: scanData }] =
      await Promise.all([
        supabaseClient.from("complexes").select("id, name").eq("id", complexId).single(),
        supabaseClient.from("buildings").select("id, code, name, complex_id").eq("complex_id", complexId),
        supabaseClient
          .from("profiles")
          .select("id, email, role, complex_id, building_id")
          .eq("complex_id", complexId),
        supabaseClient
          .from("scans")
          .select("id, created_at, complex_id, qr_id")
          .eq("complex_id", complexId)
          .order("created_at", { ascending: false }),
      ]);

    setComplex((complexData ?? null) as ComplexRow | null);
    setBuildings((buildingData ?? []) as BuildingRow[]);
    setProfiles((profileData ?? []) as ProfileRow[]);
    setScans((scanData ?? []) as ScanRow[]);

    const profileIds = (profileData ?? []).map((item) => item.id);
    if (profileIds.length === 0) {
      setVehicles([]);
      setQrs([]);
      setLoading(false);
      return;
    }
    const { data: vehicleData } = await supabaseClient
      .from("vehicles")
      .select("id, owner_profile_id")
      .in("owner_profile_id", profileIds);
    const vehiclesList = (vehicleData ?? []) as VehicleRow[];
    setVehicles(vehiclesList);

    const vehicleIds = vehiclesList.map((item) => item.id);
    if (vehicleIds.length === 0) {
      setQrs([]);
      setLoading(false);
      return;
    }

    const { data: qrData } = await supabaseClient
      .from("qrs")
      .select("id, status, vehicle_id")
      .in("vehicle_id", vehicleIds);
    setQrs((qrData ?? []) as QrRow[]);
    setLoading(false);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const boot = async () => {
      const current = await loadProfile();
      if (!current || current.role !== "MAIN") {
        setLoading(false);
        return;
      }
      await loadData(current);
      interval = setInterval(() => loadData(current), 15000);
    };
    boot();
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);

  const roleStats = useMemo(() => {
    const base = { SUPER: 0, MAIN: 0, SUB: 0, GUARD: 0, RESIDENT: 0 } as Record<ProfileRow["role"], number>;
    profiles.forEach((item) => {
      base[item.role] += 1;
    });
    return base;
  }, [profiles]);

  const scanTrend = useMemo(() => {
    const today = new Date();
    const days = Array.from({ length: 7 }).map((_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() - (6 - index));
      const key = date.toISOString().slice(0, 10);
      return { key, label: `${date.getMonth() + 1}/${date.getDate()}`, value: 0 };
    });
    const indexMap = new Map(days.map((d, idx) => [d.key, idx]));
    scans.forEach((scan) => {
      const key = new Date(scan.created_at).toISOString().slice(0, 10);
      const idx = indexMap.get(key);
      if (idx !== undefined) {
        days[idx].value += 1;
      }
    });
    return days;
  }, [scans]);

  const residentByBuilding = useMemo(() => {
    const map = new Map<string, number>();
    profiles
      .filter((p) => p.role === "RESIDENT")
      .forEach((p) => {
        if (!p.building_id) {
          return;
        }
        map.set(p.building_id, (map.get(p.building_id) ?? 0) + 1);
      });
    return buildings.map((building) => ({
      label: `${building.code}동`,
      value: map.get(building.id) ?? 0,
    }));
  }, [profiles, buildings]);

  const metrics = useMemo(() => {
    const residentCount = profiles.filter((p) => p.role === "RESIDENT").length;
    const guardCount = profiles.filter((p) => p.role === "GUARD").length;
    const subCount = profiles.filter((p) => p.role === "SUB").length;
    const activeQr = qrs.filter((q) => q.status === "ACTIVE").length;
    const inactiveQr = qrs.filter((q) => q.status === "INACTIVE").length;

    return {
      buildings: buildings.length,
      residents: residentCount,
      subs: subCount,
      guards: guardCount,
      vehicles: vehicles.length,
      scans: scans.length,
      qrActive: activeQr,
      qrInactive: inactiveQr,
    };
  }, [profiles, buildings.length, vehicles.length, scans.length, qrs]);

  const maxScan = Math.max(...scanTrend.map((item) => item.value), 1);
  const maxRole = Math.max(...Object.values(roleStats), 1);
  const maxResident = Math.max(...residentByBuilding.map((item) => item.value), 1);

  if (loading && !profile) {
    return <div className="muted">데이터 로딩 중...</div>;
  }
  if (profile && profile.role !== "MAIN") {
    return <div className="muted">메인관리자 전용 화면입니다.</div>;
  }

  return (
    <MenuGuard roleGroup="sub" toggleKey="dashboard">
      <div className="dashboard">
        <div className="dashboard-header">
          <div>
            <h1 className="page-title">메인관리자 대시보드</h1>
            <div className="muted">{complex?.name ?? "단지"} 내 통계를 확인하세요.</div>
          </div>
          <div className="dashboard-filters">
            <div className="muted">실시간 갱신 (15초)</div>
          </div>
        </div>

        <div className="dashboard-grid">
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
            <div className="stat-label">서브관리자</div>
            <div className="stat-value">{metrics.subs}</div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 3l8 3v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3z" />
              </svg>
            </span>
            <div className="stat-label">경비</div>
            <div className="stat-value">{metrics.guards}</div>
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
                    {roleLabel[role as ProfileRow["role"]]} ({value})
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="chart-card">
            <div className="chart-title">동별 입주민 분포</div>
            <div className="chart-bars">
              {residentByBuilding.length === 0 ? (
                <div className="muted">표시할 데이터가 없습니다.</div>
              ) : (
                residentByBuilding.map((item) => (
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

          <section className="chart-card">
            <div className="chart-title">3D 스캔 그래프</div>
            <div className="chart-3d">
              {scanTrend.map((item) => (
                <div key={item.key} className="chart-3d__bar" style={{ height: `${(item.value / maxScan) * 100}%` }}>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </MenuGuard>
  );
}

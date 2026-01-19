"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";

type Role = "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";

type ProfileRow = {
  email: string | null;
  building_id: string | null;
  unit_id: string | null;
  complexes?: { name: string | null }[] | { name: string | null } | null;
  buildings?: { code: string | null }[] | { code: string | null } | null;
  units?: { code: string | null }[] | { code: string | null } | null;
};

type QrRow = {
  id: string;
  status: string;
  code: string;
  created_at: string;
  expires_at: string | null;
  vehicles?: {
    plate: string | null;
    vehicle_type: string | null;
    owner_profile_id: string | null;
    profiles?: ProfileRow[];
  }[];
};

type VehicleRow = {
  id: string;
  plate: string | null;
  vehicle_type: string | null;
  owner_profile_id: string | null;
  profiles?: ProfileRow[] | ProfileRow | null;
  qrs?: { id: string; status: string; code: string; created_at: string; expires_at: string | null }[];
};

type BuildingRow = {
  id: string;
  code: string | null;
  name: string | null;
};

const qrStatusLabel = (status?: string) => {
  if (status === "ACTIVE") {
    return "활성";
  }
  if (status === "INACTIVE") {
    return "비활성";
  }
  return status ?? "-";
};

const vehicleTypeLabel = (value?: string | null) => {
  if (value === "EV") {
    return "전기";
  }
  if (value === "ICE") {
    return "내연";
  }
  return value ?? "-";
};

const ddayLabel = (value?: string | null) => {
  if (!value) {
    return "D-day 없음";
  }
  const expiresAt = new Date(value);
  if (Number.isNaN(expiresAt.getTime())) {
    return "D-day 없음";
  }
  const diffMs = expiresAt.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return "만료";
  }
  return `D-${diffDays}`;
};

const formatDateTime = (value?: string) => {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const pickFirst = <T,>(value?: T | T[] | null) => {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
};

export default function Page() {
  const [rows, setRows] = useState<QrRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [primaryPhones, setPrimaryPhones] = useState<Record<string, string>>({});
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [role, setRole] = useState<Role | null>(null);
  const [selectedComplexId, setSelectedComplexId] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("role, complex_id")
        .eq("id", userId)
        .single();
      if (!profile) {
        return;
      }
      setRole(profile.role as Role);
      if (profile.role === "SUPER") {
        const storedId = localStorage.getItem("selectedComplexId") ?? "";
        setSelectedComplexId(storedId || profile.complex_id || "");
      } else {
        setSelectedComplexId(profile.complex_id ?? "");
      }
    };
    loadProfile();
  }, []);

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
    const load = async () => {
      let vehicleQuery = supabaseClient
        .from("vehicles")
        .select(
          "id, plate, vehicle_type, owner_profile_id, profiles(email, building_id, unit_id, complexes(name), buildings(code), units(code)), qrs(id, status, code, created_at, expires_at)"
        );

      if (role === "SUPER" && selectedComplexId) {
        vehicleQuery = vehicleQuery.eq("profiles.complex_id", selectedComplexId);
      }

      const { data: vehicleData } = await vehicleQuery;
      const vehicles = (vehicleData ?? []) as VehicleRow[];
      const nextRows: QrRow[] = [];
      vehicles.forEach((vehicle) => {
        const profiles = vehicle.profiles
          ? Array.isArray(vehicle.profiles)
            ? vehicle.profiles
            : [vehicle.profiles]
          : [];
        (vehicle.qrs ?? []).forEach((qr) => {
          nextRows.push({
            id: qr.id,
            status: qr.status,
            code: qr.code,
            created_at: qr.created_at,
            expires_at: qr.expires_at,
            vehicles: [
              {
                plate: vehicle.plate,
                vehicle_type: vehicle.vehicle_type,
                owner_profile_id: vehicle.owner_profile_id,
                profiles,
              },
            ],
          });
        });
      });

      nextRows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setRows(nextRows);

      let buildingQuery = supabaseClient.from("buildings").select("id, code, name").order("code", { ascending: true });
      if (role === "SUPER" && selectedComplexId) {
        buildingQuery = buildingQuery.eq("complex_id", selectedComplexId);
      }
      const { data: buildingData } = await buildingQuery;
      setBuildings((buildingData ?? []) as BuildingRow[]);

      const ownerIds = Array.from(
        new Set(
          nextRows
            .map((row) => row.vehicles?.[0]?.owner_profile_id ?? null)
            .filter((value): value is string => Boolean(value))
        )
      );
      if (ownerIds.length) {
        const { data: phoneData } = await supabaseClient
          .from("profile_phones")
          .select("profile_id, phone")
          .eq("is_primary", true)
          .in("profile_id", ownerIds);
        const phoneMap: Record<string, string> = {};
        (phoneData ?? []).forEach((row) => {
          if (row.profile_id && row.phone) {
            phoneMap[row.profile_id] = row.phone;
          }
        });
        setPrimaryPhones(phoneMap);
      } else {
        setPrimaryPhones({});
      }
    };
    load();
  }, [role, selectedComplexId]);

  const qrCountMap = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const ownerId = row.vehicles?.[0]?.owner_profile_id;
      if (!ownerId) {
        return;
      }
      map.set(ownerId, (map.get(ownerId) ?? 0) + 1);
    });
    return map;
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (buildingFilter === "all") {
      return rows;
    }
    return rows.filter((row) => {
      const profile = row.vehicles?.[0]?.profiles?.[0];
      return profile?.building_id === buildingFilter;
    });
  }, [rows, buildingFilter]);

  return (
    <MenuGuard roleGroup="sub" toggleKey="parking.qrs">
      <div>
        <h1 className="page-title">주차 QR</h1>
        <div style={{ maxWidth: "280px", marginBottom: "12px" }}>
          <label>
            동 필터
            <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
              <option value="all">전체</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {(building.code ?? building.name ?? "-") + "동"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">입주민 이메일</th>
              <th align="left">전화번호(대표)</th>
              <th align="left">동</th>
              <th align="left">호수</th>
              <th align="left">차종</th>
              <th align="left">차량번호</th>
              <th align="left">QR 상태</th>
              <th align="left">QR 보유수</th>
              <th align="left">발행일</th>
              <th align="left">D-day</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const vehicle = row.vehicles?.[0];
              const profile = vehicle?.profiles?.[0];
              const ownerId = vehicle?.owner_profile_id ?? "";
              const building = pickFirst(profile?.buildings);
              const unit = pickFirst(profile?.units);
              const email = profile?.email ?? "-";
              const plate = vehicle?.plate ?? "-";
              const phone = ownerId ? primaryPhones[ownerId] ?? "-" : "-";
              const qrCount = ownerId ? qrCountMap.get(ownerId) ?? 0 : 0;
              return (
                <tr key={row.id}>
                  <td>{email}</td>
                  <td>{phone}</td>
                  <td>{building?.code ? `${building.code}동` : "-"}</td>
                  <td>{unit?.code ? `${unit.code}호` : "-"}</td>
                  <td>{vehicleTypeLabel(vehicle?.vehicle_type)}</td>
                  <td>{plate}</td>
                  <td>{qrStatusLabel(row.status)}</td>
                  <td>{qrCount}</td>
                  <td>{formatDateTime(row.created_at)}</td>
                  <td>{ddayLabel(row.expires_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MenuGuard>
  );
}

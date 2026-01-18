"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";

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
    profiles?: {
      email: string | null;
      building_id: string | null;
      unit_id: string | null;
      buildings?: { code: string | null }[] | null;
      units?: { code: string | null }[] | null;
    }[];
  }[];
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
    return "전기차";
  }
  if (value === "ICE") {
    return "내연차";
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

export default function Page() {
  const [rows, setRows] = useState<QrRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [primaryPhones, setPrimaryPhones] = useState<Record<string, string>>({});
  const [buildingFilter, setBuildingFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      const { data } = await supabaseClient
        .from("qrs")
        .select(
          "id, status, code, created_at, expires_at, vehicles(plate, vehicle_type, owner_profile_id, profiles(email, building_id, unit_id, buildings(code), units(code)))"
        )
        .order("created_at", { ascending: false });
      if (data) {
        setRows(data as unknown as QrRow[]);
      }

      const { data: buildingData } = await supabaseClient
        .from("buildings")
        .select("id, code, name")
        .order("code", { ascending: true });
      setBuildings((buildingData ?? []) as BuildingRow[]);

      const ownerIds = Array.from(
        new Set(
          (data ?? [])
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
      }
    };
    load();
  }, []);

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
            동 선택
            <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
              <option value="all">전체</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {(building.code ?? building.name ?? "동") + "동"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">입주민 이메일</th>
              <th align="left">전화번호(대표번호)</th>
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
              const buildingCode = profile?.buildings?.[0]?.code ?? "-";
              const unitCode = profile?.units?.[0]?.code ?? "-";
              const email = profile?.email ?? "-";
              const plate = vehicle?.plate ?? "-";
              const phone = ownerId ? primaryPhones[ownerId] ?? "-" : "-";
              const qrCount = ownerId ? qrCountMap.get(ownerId) ?? 0 : 0;
              return (
                <tr key={row.id}>
                  <td>{email}</td>
                  <td>{phone}</td>
                  <td>{buildingCode}</td>
                  <td>{unitCode}</td>
                  <td>{vehicleTypeLabel(vehicle?.vehicle_type)}</td>
                  <td>{plate}</td>
                  <td>{qrStatusLabel(row.status)}</td>
                  <td>{qrCount}</td>
                  <td>{new Date(row.created_at).toLocaleString("ko-KR")}</td>
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

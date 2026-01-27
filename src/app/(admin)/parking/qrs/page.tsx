"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";

type Role = "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";

type ComplexRow = {
  id: string;
  name: string;
};

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

const buildQrUrl = (code: string) => {
  if (!code) {
    return "";
  }
  if (typeof window === "undefined") {
    return `/q/${code}`;
  }
  return `${window.location.origin}/q/${code}`;
};

const qrStatusLabel = (status?: string) => {
  if (status === "ACTIVE") {
    return "활성";
  }
  if (status === "INACTIVE") {
    return "비활성";
  }
  if (status === "EXPIRED") {
    return "만료";
  }
  return status ?? "-";
};

const vehicleTypeLabel = (value?: string | null) => {
  if (value === "EV") {
    return "전기차";
  }
  if (value === "ICE") {
    return "내연기관";
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
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [primaryPhones, setPrimaryPhones] = useState<Record<string, string>>({});
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [role, setRole] = useState<Role | null>(null);
  const [selectedComplexId, setSelectedComplexId] = useState("all");
  const [qrThumbs, setQrThumbs] = useState<Record<string, string>>({});

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
        const storedId = localStorage.getItem("selectedComplexId") ?? "all";
        setSelectedComplexId(storedId || "all");
      } else {
        setSelectedComplexId(profile.complex_id ?? "all");
      }
    };
    loadProfile();
  }, []);

  useEffect(() => {
    if (role !== "SUPER") {
      return;
    }
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
      setComplexes((data.complexes ?? []) as ComplexRow[]);
    };
    loadComplexes();
  }, [role]);

  useEffect(() => {
    if (role !== "SUPER") {
      return;
    }
    const handleSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      const nextId = detail?.id ?? "all";
      setSelectedComplexId(nextId || "all");
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

      if (role === "SUPER" && selectedComplexId && selectedComplexId !== "all") {
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
      if (role === "SUPER" && selectedComplexId && selectedComplexId !== "all") {
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

  useEffect(() => {
    const build = async () => {
      const nextThumbs: Record<string, string> = {};
      for (const row of rows) {
        if (!row.code) {
          continue;
        }
        try {
          nextThumbs[row.id] = await QRCode.toDataURL(buildQrUrl(row.code));
        } catch {
          nextThumbs[row.id] = "";
        }
      }
      setQrThumbs(nextThumbs);
    };
    build();
  }, [rows]);

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
      <div className="parking-qrs">
        <h1 className="page-title">주차 QR</h1>
        <div className="qr-filters">
          {role === "SUPER" ? (
            <label className="qr-filter">
              단지
              <select value={selectedComplexId} onChange={(event) => setSelectedComplexId(event.target.value)}>
                <option value="all">전체 단지</option>
                {complexes.map((complex) => (
                  <option key={complex.id} value={complex.id}>
                    {complex.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="qr-filter">
            동
            <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
              <option value="all">전체 동</option>
              {buildings.map((building) => (
                <option key={building.id} value={building.id}>
                  {(building.code ?? building.name ?? "-") + "동"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="qr-cards">
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
            const thumb = qrThumbs[row.id];
            return (
              <article key={row.id} className="qr-card">
                <div className="qr-card__header">
                  <div>
                    <div className="qr-card__email">{email}</div>
                    <div className="qr-card__meta">
                      {building?.code ? `${building.code}동` : "-"} {unit?.code ? `${unit.code}호` : ""}
                    </div>
                  </div>
                  <span className="qr-card__status">{qrStatusLabel(row.status)}</span>
                </div>
                <div className="qr-card__body">
                  <div className="qr-card__info">
                    <div>전화번호: {phone}</div>
                    <div>차종: {vehicleTypeLabel(vehicle?.vehicle_type)}</div>
                    <div>차량번호: {plate}</div>
                    <div>QR 보유수: {qrCount}</div>
                    <div>발행일: {formatDateTime(row.created_at)}</div>
                    <div>D-day: {ddayLabel(row.expires_at)}</div>
                  </div>
                  <div className="qr-card__qr">
                    {thumb ? <img src={thumb} alt="QR" /> : <div className="qr-card__qr-empty">QR 생성 중</div>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </MenuGuard>
  );
}

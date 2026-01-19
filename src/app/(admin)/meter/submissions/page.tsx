"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { useRightPanel } from "@/components/layout/RightPanelContext";

type SubmissionRow = {
  id: string;
  reading_value: number;
  submitted_at: string;
  profile_id: string;
  meter_cycles?: { title: string };
  profiles?: {
    buildings?: { code: string | null } | null;
    units?: { code: string | null } | null;
  } | null;
};

type MissingUnitRow = {
  profile_id: string;
  building_code: string | null;
  unit_code: string | null;
};

type BuildingOption = {
  id: string;
  code: string | null;
  name: string | null;
};

function MissingUnitsPanel() {
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [missingUnits, setMissingUnits] = useState<MissingUnitRow[]>([]);
  const [buildingId, setBuildingId] = useState<string>("all");

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const query = new URLSearchParams({ type: "missing" });
      if (buildingId !== "all") {
        query.set("building_id", buildingId);
      }
      const response = await fetch(`/api/meter?${query.toString()}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setBuildings(data.buildings ?? []);
      setMissingUnits(data.missingUnits ?? []);
    };
    load();
  }, [buildingId]);

  return (
    <div className="panel-card">
      <h3 className="panel-title">??? ??</h3>
      <label className="field-label" htmlFor="missing-building">
        ? ??
      </label>
      <select
        id="missing-building"
        className="input"
        value={buildingId}
        onChange={(event) => setBuildingId(event.target.value)}
      >
        <option value="all">??</option>
        {buildings.map((building) => (
          <option key={building.id} value={building.id}>
            {(building.code ?? building.name ?? "?") + "?"}
          </option>
        ))}
      </select>
      <div className="chip-row">
        {missingUnits.length === 0 ? (
          <span className="muted">??? ??? ????.</span>
        ) : (
          missingUnits.map((unit) => (
            <span key={unit.profile_id} className="chip">
              {unit.building_code ? `${unit.building_code}? ` : ""}
              {unit.unit_code ? `${unit.unit_code}?` : "?? ???"}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

export default function Page() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const { setContent } = useRightPanel();

  useEffect(() => {
    setContent(<MissingUnitsPanel />);
    return () => setContent(null);
  }, [setContent]);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const response = await fetch("/api/meter?type=submissions", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setSubmissions(data.submissions ?? []);
    };
    load();
  }, []);

  const formatSubmittedAt = useMemo(() => {
    return (value: string) => {
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
      });
    };
  }, []);

  const formatUnitLabel = (row: SubmissionRow) => {
    const buildingCode = row.profiles?.buildings?.code ?? null;
    const unitCode = row.profiles?.units?.code ?? null;
    if (!buildingCode && !unitCode) {
      return "-";
    }
    if (buildingCode && unitCode) {
      return `${buildingCode}? ${unitCode}?`;
    }
    if (buildingCode) {
      return `${buildingCode}?`;
    }
    return `${unitCode}?`;
  };

  return (
    <MenuGuard roleGroup="sub" toggleKey="meter.submissions">
      <div>
        <h1 className="page-title">?? ??</h1>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">?? ??</th>
                <th align="left">?? ?</th>
                <th align="left">???</th>
                <th align="left">?/??</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((row) => (
                <tr key={row.id}>
                  <td>{row.meter_cycles?.title ?? "-"}</td>
                  <td>{row.reading_value}</td>
                  <td>{formatSubmittedAt(row.submitted_at)}</td>
                  <td>{formatUnitLabel(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MenuGuard>
  );
}

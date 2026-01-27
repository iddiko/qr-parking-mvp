"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { useRightPanel } from "@/components/layout/RightPanelContext";

type ScanRow = {
  id: string;
  created_at: string;
  location_label: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  result: string;
  profiles?: { name: string | null; email: string | null } | { name: string | null; email: string | null }[];
  qrs?: { vehicles?: { plate: string | null }[] }[];
};

const resultLabel = (result?: string) => {
  if (result === "RESIDENT") {
    return "입주민 차량";
  }
  if (result === "ENFORCEMENT") {
    return "단속 대상";
  }
  if (result === "INVALID") {
    return "유효하지 않은 QR";
  }
  return result ?? "-";
};

export default function Page() {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [regionFilter, setRegionFilter] = useState("all");
  const [complexFilter, setComplexFilter] = useState("all");
  const [buildingFilter, setBuildingFilter] = useState("all");
  const [scannerFilter, setScannerFilter] = useState("all");
  const { setVisible } = useRightPanel();

  useEffect(() => {
    setVisible(false);
    return () => setVisible(true);
  }, [setVisible]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabaseClient
        .from("scans")
        .select(
          "id, created_at, location_label, location_lat, location_lng, result, profiles(name, email), qrs(vehicles(plate))"
        )
        .order("created_at", { ascending: false });
      if (data) {
        setRows(data as ScanRow[]);
      }
    };
    load();
  }, []);

  return (
    <MenuGuard roleGroup="sub" toggleKey="parking.scans">
      <div>
        <h1 className="page-title">경비 스캔 리스트(log)</h1>
        <div className="scan-filters">
          <label className="scan-filter">
            <span>지역</span>
            <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
              <option value="all">전체 지역</option>
            </select>
          </label>
          <label className="scan-filter">
            <span>단지</span>
            <select value={complexFilter} onChange={(event) => setComplexFilter(event.target.value)}>
              <option value="all">전체 단지</option>
            </select>
          </label>
          <label className="scan-filter">
            <span>동</span>
            <select value={buildingFilter} onChange={(event) => setBuildingFilter(event.target.value)}>
              <option value="all">전체 동</option>
            </select>
          </label>
          <label className="scan-filter">
            <span>누가 찍었지</span>
            <select value={scannerFilter} onChange={(event) => setScannerFilter(event.target.value)}>
              <option value="all">전체</option>
            </select>
          </label>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">시간</th>
              <th align="left">위치</th>
              <th align="left">결과</th>
              <th align="left">차량번호</th>
              <th align="left">스캔자</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const profile =
                Array.isArray(row.profiles) ? row.profiles[0] : row.profiles ?? null;
              const profileLabel = profile?.name || profile?.email || "-";
              const plate = row.qrs?.[0]?.vehicles?.[0]?.plate ?? "-";
              const hasGps =
                typeof row.location_lat === "number" && typeof row.location_lng === "number";
              const mapHref = hasGps
                ? `https://www.google.com/maps?q=${row.location_lat},${row.location_lng}`
                : "";
              return (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("ko-KR")}</td>
                  <td>
                    {hasGps ? (
                      <a href={mapHref} target="_blank" rel="noreferrer">
                        {row.location_label ?? "GPS 위치"}
                      </a>
                    ) : (
                      row.location_label ?? "-"
                    )}
                  </td>
                  <td>{resultLabel(row.result)}</td>
                  <td>{plate}</td>
                  <td>{profileLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MenuGuard>
  );
}

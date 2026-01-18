"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";

type ScanRow = {
  id: string;
  location_label: string;
  result: string;
  vehicle_plate: string | null;
  created_at: string;
  guard_profile_id: string;
};

const resultLabel = (value?: string) => {
  if (value === "RESIDENT") {
    return "입주민";
  }
  if (value === "ENFORCEMENT") {
    return "단속대상";
  }
  return value ?? "-";
};

export default function Page() {
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const response = await fetch("/api/guard/scans", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus(data.error ?? "스캔 이력을 불러올 수 없습니다.");
        return;
      }
      const data = await response.json();
      setScans(data.scans ?? []);
    };
    load();
  }, []);

  return (
    <MenuGuard roleGroup="guard" toggleKey="history">
      <div>
        <h1 className="page-title">경비 스캔 이력</h1>
        {status ? <div className="muted">{status}</div> : null}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">시간</th>
              <th align="left">위치</th>
              <th align="left">결과</th>
              <th align="left">차량번호</th>
            </tr>
          </thead>
          <tbody>
            {scans.map((scan) => (
              <tr key={scan.id}>
                <td>{new Date(scan.created_at).toLocaleString()}</td>
                <td>{scan.location_label}</td>
                <td>{resultLabel(scan.result)}</td>
                <td>{scan.vehicle_plate ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </MenuGuard>
  );
}

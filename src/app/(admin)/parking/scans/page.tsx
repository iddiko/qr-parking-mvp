"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";

type ScanRow = {
  id: string;
  created_at: string;
  location_label: string | null;
  result: string;
  profiles?: { email: string | null }[];
  qrs?: { vehicles?: { plate: string | null }[] }[];
};

const resultLabel = (result?: string) => {
  if (result === "RESIDENT") {
    return "입주민";
  }
  if (result === "TARGET") {
    return "단속대상";
  }
  return result ?? "-";
};

export default function Page() {
  const [rows, setRows] = useState<ScanRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabaseClient
        .from("scans")
        .select("id, created_at, location_label, result, profiles(email), qrs(vehicles(plate))")
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
        <h1 className="page-title">경비 스캔 리스트</h1>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">시간</th>
              <th align="left">위치</th>
              <th align="left">결과</th>
              <th align="left">차량번호</th>
              <th align="left">이메일</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const profileEmail = row.profiles?.[0]?.email ?? "-";
              const plate = row.qrs?.[0]?.vehicles?.[0]?.plate ?? "-";
              return (
                <tr key={row.id}>
                  <td>{new Date(row.created_at).toLocaleString("ko-KR")}</td>
                  <td>{row.location_label ?? "-"}</td>
                  <td>{resultLabel(row.result)}</td>
                  <td>{plate}</td>
                  <td>{profileEmail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </MenuGuard>
  );
}

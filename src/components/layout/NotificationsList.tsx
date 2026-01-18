"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  type: string;
  payload: { [key: string]: string | number | null };
  created_at: string;
};

const notificationTypeLabel = (value?: string) => {
  if (value === "scan") {
    return "스캔";
  }
  return value ?? "-";
};

const formatTimestamp = (value?: string) => {
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

export function NotificationsList() {
  const [items, setItems] = useState<NotificationRow[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const response = await fetch("/api/notifications", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setItems(data.notifications ?? []);
    };
    load();
  }, []);

  if (items.length === 0) {
    return <div className="muted">알림 내역이 없습니다.</div>;
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th align="left">시간</th>
          <th align="left">유형</th>
          <th align="left">위치</th>
          <th align="left">결과</th>
          <th align="left">차량번호</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const timestamp = item.payload?.timestamp ?? item.created_at;
          const resultLabel =
            item.payload?.result === "RESIDENT"
              ? "입주민"
              : item.payload?.result === "ENFORCEMENT"
              ? "단속대상"
              : "-";
          const location = item.payload?.location ?? "-";
          const lat = item.payload?.location_lat;
          const lng = item.payload?.location_lng;
          const hasCoords = typeof lat === "number" && typeof lng === "number";
          const locationUrl = hasCoords
            ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
            : location && location !== "-"
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(location))}`
            : "";
          return (
            <tr key={item.id}>
              <td>{formatTimestamp(String(timestamp))}</td>
              <td>{notificationTypeLabel(item.type)}</td>
              <td>
                {locationUrl ? (
                  <a href={locationUrl} target="_blank" rel="noreferrer">
                    {location}
                  </a>
                ) : (
                  location
                )}
              </td>
              <td>{resultLabel}</td>
              <td>{item.payload?.vehicle_plate ?? "-"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

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
    <div className="notifications-list">
      {items.map((item) => {
        const timestamp = item.payload?.timestamp ?? item.created_at;
        const isResident = item.payload?.result === "RESIDENT";
        const resultLabel = isResident ? "입주민" : item.payload?.result === "ENFORCEMENT" ? "단속 대상" : "-";
        const location = item.payload?.location ?? "-";
        const lat = item.payload?.location_lat;
        const lng = item.payload?.location_lng;
        const hasCoords = typeof lat === "number" && typeof lng === "number";
        const locationUrl = hasCoords
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          : location && location !== "-"
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(location))}`
          : "";
        const plate = item.payload?.vehicle_plate ?? "-";
        return (
          <div key={item.id} className="notification-card">
            <div className="notification-card__header">
              <span className="notification-card__time">{formatTimestamp(String(timestamp))}</span>
              <span className={`notification-card__result ${isResident ? "is-ok" : "is-warn"}`}>
                <span className="notification-card__icon" aria-hidden>
                  {isResident ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M5 12l4 4 10-10" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 8v5" />
                      <path d="M12 17h.01" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  )}
                </span>
                {resultLabel}
              </span>
            </div>
            <div className="notification-card__body">
              <div className="notification-card__row">
                <span className="notification-card__icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 21s-6-5.1-6-11a6 6 0 0 1 12 0c0 5.9-6 11-6 11Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </span>
                {locationUrl ? (
                  <a href={locationUrl} target="_blank" rel="noreferrer">
                    {location}
                  </a>
                ) : (
                  <span>{location}</span>
                )}
              </div>
              <div className="notification-card__row">
                <span className="notification-card__icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="5" y="6" width="14" height="12" rx="2" />
                    <path d="M9 18v2" />
                    <path d="M15 18v2" />
                    <path d="M7 10h10" />
                  </svg>
                </span>
                <span>차량번호: {plate}</span>
              </div>
            </div>
            <div className="notification-card__footer muted">{notificationTypeLabel(item.type)}</div>
          </div>
        );
      })}
    </div>
  );
}

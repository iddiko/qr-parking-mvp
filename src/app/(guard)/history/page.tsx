"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { useRightPanel } from "@/components/layout/RightPanelContext";

type ScanRow = {
  id: string;
  location_label: string;
  result: string;
  vehicle_plate: string | null;
  created_at: string;
  guard_profile_id: string;
  qrs?: {
    vehicles?: {
      profiles?: { email: string | null } | null;
    } | null;
  } | null;
};

const resultLabel = (value?: string) => {
  if (value === "RESIDENT") {
    return "입주민 차량";
  }
  if (value === "ENFORCEMENT") {
    return "단속 대상";
  }
  return value ?? "-";
};

export default function Page() {
  const [scans, setScans] = useState<ScanRow[]>([]);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<ScanRow | null>(null);
  const { setVisible } = useRightPanel();

  const formatTime = (value: string) => {
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
      hour12: false,
    });
  };

  useEffect(() => {
    setVisible(false);
    return () => setVisible(true);
  }, [setVisible]);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const response = await fetch("/api/guard/scans", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus(data.error ?? "스캔 목록을 불러오는 데 실패했습니다.");
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
        <h1 className="page-title">경비 스캔 리스트(log)</h1>
        {status ? <div className="muted">{status}</div> : null}
        <div className="scan-list">
          {scans.map((scan) => (
            <button key={scan.id} className="scan-item" type="button" onClick={() => setSelected(scan)}>
              <span className="scan-item__time">{formatTime(scan.created_at)}</span>
              <span className="scan-item__location">
                <span className="scan-item__icon" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M12 21s-6-5.1-6-11a6 6 0 0 1 12 0c0 5.9-6 11-6 11Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </span>
                {scan.location_label}
              </span>
            </button>
          ))}
        </div>
        {selected ? (
          <>
            <button type="button" className="scan-modal-overlay" onClick={() => setSelected(null)} aria-label="닫기" />
            <div className="scan-modal" role="dialog" aria-modal="true">
              <div className="scan-modal__title">스캔 상세</div>
              <div className="scan-modal__row">
                <span className="muted">스캔 시간</span>
                <span>{formatTime(selected.created_at)}</span>
              </div>
              <div className="scan-modal__row">
                <span className="muted">스캔 위치</span>
                <span>{selected.location_label}</span>
              </div>
              <div className="scan-modal__row">
                <span className="muted">판정 결과</span>
                <span>{resultLabel(selected.result)}</span>
              </div>
              <div className="scan-modal__row">
                <span className="muted">차량번호</span>
                <span>{selected.vehicle_plate ?? "-"}</span>
              </div>
              <div className="scan-modal__row">
                <span className="muted">알림 수신자</span>
                <span>{selected.qrs?.vehicles?.profiles?.email ?? "-"}</span>
              </div>
              <button type="button" className="scan-modal__close" onClick={() => setSelected(null)}>
                닫기
              </button>
            </div>
          </>
        ) : null}
      </div>
    </MenuGuard>
  );
}

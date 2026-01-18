"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type ScanResident = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
};

type ScanResult = {
  result: "RESIDENT" | "ENFORCEMENT";
  vehicle_plate: string | null;
  resident: ScanResident | null;
};

export default function Page() {
  const params = useParams();
  const codeParam = typeof params?.code === "string" ? params.code : "";
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState("QR를 확인하는 중...");

  useEffect(() => {
    if (!codeParam) {
      setStatus("QR 코드가 없습니다.");
      return;
    }

    const submit = async (coords: { lat: number; lng: number } | null) => {
      const response = await fetch("/api/scan/public", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: codeParam,
          location_label: "휴대폰 카메라 스캔",
          location_lat: coords?.lat ?? null,
          location_lng: coords?.lng ?? null,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus(data.error ?? "스캔 결과를 불러오지 못했습니다.");
        return;
      }
      const data = await response.json();
      setResult(data as ScanResult);
      setStatus("");
    };

    if (!navigator.geolocation) {
      void submit(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        void submit({ lat, lng });
      },
      () => {
        void submit(null);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [codeParam]);

  const ownerPhone = result?.resident?.phone ?? "";
  const ownerEmail = result?.resident?.email ?? "";
  const vehiclePlate = result?.vehicle_plate ?? "-";
  const resultLabel = result?.result === "RESIDENT" ? "입주민" : "단속 대상";

  const onNotify = () => {
    if (!ownerEmail) {
      return;
    }
    const subject = encodeURIComponent("QR 스캔 알림");
    const body = encodeURIComponent("QR 스캔이 완료되었습니다. 확인 부탁드립니다.");
    window.location.href = `mailto:${ownerEmail}?subject=${subject}&body=${body}`;
  };

  const onCall = () => {
    if (!ownerPhone) {
      return;
    }
    window.location.href = `tel:${ownerPhone}`;
  };

  const onMessage = () => {
    if (!ownerPhone) {
      return;
    }
    window.location.href = `sms:${ownerPhone}`;
  };

  const resultBadge = useMemo(() => {
    if (!result) {
      return null;
    }
    const badgeClass = resultLabel === "입주민" ? "scan-result-badge--ok" : "scan-result-badge--warn";
    return <span className={`scan-result-badge ${badgeClass}`}>{resultLabel}</span>;
  }, [result, resultLabel]);

  return (
    <div className="scan-page scan-page--public">
      <div className="scan-header">
        <h1 className="page-title">QR 스캔 결과</h1>
        <div className="muted">일반 카메라로 스캔한 결과를 안내합니다.</div>
      </div>

      <div className="scan-card scan-card--public">
        {result ? (
          <>
            <div className="scan-result">
              {resultBadge}
              <div className="scan-result__desc">스캔 결과</div>
            </div>
            <div className="scan-meta">
              <span className="muted">차량번호</span>
              <strong>{vehiclePlate}</strong>
            </div>
            <div className="scan-actions scan-actions--public">
              <button
                type="button"
                className="scan-action-button"
                onClick={onNotify}
                disabled={!ownerEmail}
                aria-label="알림 보내기"
                title="알림 보내기"
              >
                <span className="scan-action-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img">
                    <path
                      d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
              </button>
              <button
                type="button"
                className="scan-action-button"
                onClick={onCall}
                disabled={!ownerPhone}
                aria-label="전화 걸기"
                title="전화 걸기"
              >
                <span className="scan-action-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img">
                    <path
                      d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24c1.1.36 2.3.56 3.6.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.4 21 3 13.6 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.2.2 2.4.56 3.6a1 1 0 0 1-.24 1l-2.22 2.2Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
              </button>
              <button
                type="button"
                className="scan-action-button"
                onClick={onMessage}
                disabled={!ownerPhone}
                aria-label="메시지 보내기"
                title="메시지 보내기"
              >
                <span className="scan-action-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img">
                    <path
                      d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
              </button>
            </div>
            <div className="scan-holo">
              <div className="scan-holo__frame" aria-hidden="true">
                <svg viewBox="0 0 120 120" className="scan-holo__svg" role="img">
                  <defs>
                    <linearGradient id="qrHoloGradient" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="50%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                  <rect width="120" height="120" rx="16" fill="url(#qrHoloGradient)" opacity="0.18" />
                  <g fill="url(#qrHoloGradient)">
                    <rect x="10" y="10" width="26" height="26" rx="4" />
                    <rect x="84" y="10" width="26" height="26" rx="4" />
                    <rect x="10" y="84" width="26" height="26" rx="4" />
                    <rect x="46" y="18" width="10" height="10" />
                    <rect x="60" y="18" width="10" height="10" />
                    <rect x="46" y="32" width="10" height="10" />
                    <rect x="60" y="32" width="10" height="10" />
                    <rect x="44" y="48" width="8" height="8" />
                    <rect x="58" y="48" width="8" height="8" />
                    <rect x="72" y="48" width="8" height="8" />
                    <rect x="36" y="62" width="8" height="8" />
                    <rect x="50" y="62" width="8" height="8" />
                    <rect x="64" y="62" width="8" height="8" />
                    <rect x="78" y="62" width="8" height="8" />
                    <rect x="44" y="76" width="8" height="8" />
                    <rect x="58" y="76" width="8" height="8" />
                    <rect x="72" y="76" width="8" height="8" />
                  </g>
                </svg>
                <span className="scan-holo__glow" />
              </div>
              <div className="scan-holo__caption">QR 홀로그램</div>
            </div>
          </>
        ) : (
          <div className="muted">{status}</div>
        )}
      </div>
    </div>
  );
}

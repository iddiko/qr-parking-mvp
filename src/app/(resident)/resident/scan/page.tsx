"use client";

import { BrowserQRCodeReader } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { MenuGuard } from "@/components/layout/MenuGuard";

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

const FALLBACK_LOCATION = "위치 미지정";

const extractQrCode = (rawValue: string) => {
  if (!rawValue) {
    return rawValue;
  }
  if (rawValue.includes("/q/")) {
    const parts = rawValue.split("/q/");
    const tail = parts[1] ?? "";
    return tail.split(/[?#]/)[0] ?? rawValue;
  }
  try {
    const url = new URL(rawValue);
    const code = url.searchParams.get("code");
    return code ?? rawValue;
  } catch {
    return rawValue;
  }
};

export default function Page() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const zxingRef = useRef<BrowserQRCodeReader | null>(null);
  const zxingStopRef = useRef<(() => void) | null>(null);

  const [locationLabel, setLocationLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [status, setStatus] = useState("");
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const loadLocation = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setLocationLabel(FALLBACK_LOCATION);
        return;
      }

      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("complex_id, building_id")
        .eq("id", userId)
        .single();

      let baseLabel = "";
      if (profileData?.complex_id) {
        const { data: complexData } = await supabaseClient
          .from("complexes")
          .select("name")
          .eq("id", profileData.complex_id)
          .single();
        const complexName = complexData?.name ?? "";
        if (profileData.building_id) {
          const { data: buildingData } = await supabaseClient
            .from("buildings")
            .select("code, name")
            .eq("id", profileData.building_id)
            .single();
          const buildingLabel = buildingData ? `${buildingData.code}동 ${buildingData.name}`.trim() : "";
          baseLabel = buildingLabel ? `${complexName} ${buildingLabel}`.trim() : complexName;
        } else {
          baseLabel = complexName || "";
        }
      }

      if (!baseLabel) {
        baseLabel = FALLBACK_LOCATION;
      }
      setLocationLabel(baseLabel);

      if (!navigator.geolocation) {
        setStatus("위치 정보를 가져올 수 없습니다.");
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = Number(position.coords.latitude.toFixed(6));
          const lng = Number(position.coords.longitude.toFixed(6));
          setCoords({ lat, lng });
        },
        () => {
          setStatus("위치 정보를 가져올 수 없습니다.");
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    };
    loadLocation();
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      scanningRef.current = false;
    };
  }, []);

  const submitScan = async (code: string) => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const finalLocation =
      coords ? `위치 (${coords.lat}, ${coords.lng})` : locationLabel || FALLBACK_LOCATION;
    const response = await fetch("/api/scan", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        code,
        location_label: finalLocation,
        location_lat: coords?.lat ?? null,
        location_lng: coords?.lng ?? null,
        vehicle_plate: null,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "스캔 결과를 불러올 수 없습니다.");
      return;
    }
    const data = await response.json();
    setResult(data as ScanResult);
  };

  const stopCamera = () => {
    if (zxingStopRef.current) {
      zxingStopRef.current();
      zxingStopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    scanningRef.current = false;
    setScanning(false);
  };

  const startScan = async () => {
    setStatus("");
    setResult(null);

    if ("BarcodeDetector" in window) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScanning(true);
        scanningRef.current = true;

        const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          if (!videoRef.current || !scanningRef.current) {
            return;
          }
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const value = extractQrCode(barcodes[0].rawValue);
              stopCamera();
              await submitScan(value);
              return;
            }
          } catch {
            setStatus("QR 스캔을 시작할 수 없습니다.");
            stopCamera();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (message.toLowerCase().includes("permission") || message.toLowerCase().includes("denied")) {
          setStatus("브라우저 설정에서 카메라 권한을 허용해 주세요.");
        } else {
          setStatus("카메라를 켤 수 없습니다.");
        }
        stopCamera();
      }
      return;
    }

    try {
      if (!videoRef.current) {
        setStatus("카메라를 준비할 수 없습니다.");
        return;
      }
      const reader = zxingRef.current ?? new BrowserQRCodeReader();
      zxingRef.current = reader;
      setScanning(true);
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, async (scanResult) => {
        if (scanResult) {
          controls.stop();
          zxingStopRef.current = null;
          setScanning(false);
          await submitScan(extractQrCode(scanResult.getText()));
        }
      });
      zxingStopRef.current = () => controls.stop();
    } catch {
      setStatus("QR 스캔을 시작할 수 없습니다.");
      stopCamera();
    }
  };

  const ownerPhone = result?.resident?.phone ?? "";
  const resultLabel = result?.result === "RESIDENT" ? "입주민" : "단속대상";

  const onNotify = () => {
    if (!result?.resident?.email) {
      return;
    }
    const subject = encodeURIComponent("QR 스캔 알림");
    const body = encodeURIComponent(`위치: ${locationLabel || FALLBACK_LOCATION}`);
    window.location.href = `mailto:${result.resident.email}?subject=${subject}&body=${body}`;
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

  return (
    <MenuGuard roleGroup="resident" toggleKey="scan">
      <div className="scan-page">
        <div className="scan-header">
          <h1 className="page-title">입주민 QR 스캔</h1>
          <div className="muted">현재 위치: {locationLabel || FALLBACK_LOCATION}</div>
        </div>

        {result ? (
          <div className="scan-card">
            <div className="scan-result">
              <span className={`scan-result-badge ${resultLabel === "입주민" ? "scan-result-badge--ok" : "scan-result-badge--warn"}`}>
                {resultLabel}
              </span>
              <div className="scan-result__desc">스캔 결과</div>
            </div>
            <div className="scan-actions">
              <button
                type="button"
                className="scan-action-button"
                onClick={onNotify}
                disabled={!result.resident?.email}
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
          </div>
        ) : (
          <div className="scan-card scan-card--empty">
            <div className="muted">QR을 스캔하면 결과가 표시됩니다.</div>
          </div>
        )}

        <div className="scan-video-card">
          <video ref={videoRef} className="scan-video" playsInline muted />
          <div className="scan-controls">
            <button type="button" onClick={startScan} disabled={scanning}>
              카메라 켜기
            </button>
            <button type="button" onClick={stopCamera} disabled={!scanning}>
              카메라 끄기
            </button>
          </div>
        </div>
        {status ? <div className="muted">{status}</div> : null}
      </div>
    </MenuGuard>
  );
}

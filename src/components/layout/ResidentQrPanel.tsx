"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { supabaseClient } from "@/lib/supabase/client";

type VehicleRow = {
  id: string;
  plate: string;
  vehicle_type: string;
  qrs?: { id: string; status: string; code: string }[];
};

const buildQrUrl = (code: string) => {
  if (typeof window === "undefined") {
    return code;
  }
  return `${window.location.origin}/q/${code}`;
};

export function ResidentQrPanel() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("INACTIVE");
  const [plate, setPlate] = useState<string>("");
  const [hasQr, setHasQr] = useState<boolean | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setHasQr(false);
        return;
      }
      const { data } = await supabaseClient
        .from("vehicles")
        .select("id, plate, vehicle_type, qrs(id, status, code)")
        .eq("owner_profile_id", userId)
        .single();
      const vehicle = data as VehicleRow | null;
      if (!vehicle || !vehicle.qrs || vehicle.qrs.length === 0) {
        setHasQr(false);
        return;
      }
      const qr = vehicle.qrs[0];
      setStatus(qr.status);
      setPlate(vehicle.plate);
      const url = await QRCode.toDataURL(buildQrUrl(qr.code));
      setDataUrl(url);
      setHasQr(true);
    };
    load();
  }, []);

  if (hasQr === false) {
    return <div className="muted">발급된 QR이 없습니다.</div>;
  }

  if (!dataUrl) {
    return <div className="muted">QR 정보를 불러오는 중...</div>;
  }

  const statusLabel = status === "ACTIVE" ? "활성" : status === "INACTIVE" ? "비활성" : status;

  return (
    <div className="resident-qr-panel">
      <div className="resident-qr-card">
        <div>
          <div className="resident-qr-title">내 QR 카드</div>
          <div className="resident-qr-sub">출입 확인 시 이 QR을 사용합니다.</div>
        </div>
        <div className="resident-qr-meta">
          <span className={`resident-qr-badge ${status === "ACTIVE" ? "ok" : "warn"}`}>{statusLabel}</span>
          <div className="resident-qr-plate">차량 번호: {plate}</div>
        </div>
      </div>
      <div className="resident-qr-code">
        <img src={dataUrl} alt="내 QR" />
      </div>
    </div>
  );
}

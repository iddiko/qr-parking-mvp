"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type InviteInfo = {
  email: string;
  role: string;
  status: string;
};

export default function InviteClient() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState("");
  const [hasVehicleChoice, setHasVehicleChoice] = useState("");
  const [plate, setPlate] = useState("");
  const [vehicleType, setVehicleType] = useState("EV");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        setError("초대 링크가 없습니다.");
        return;
      }
      const response = await fetch(`/api/invites?token=${token}`);
      if (!response.ok) {
        setError("초대 정보를 불러올 수 없습니다.");
        return;
      }
      const data = await response.json();
      setInvite(data.invite);
      setInviteStatus(data.invite?.status ?? null);
    };
    load();
  }, [token]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setStatus("");
    if (!invite) {
      setError("초대 정보를 찾을 수 없습니다.");
      return;
    }
    if (invite.status === "ACCEPTED") {
      setError("이미 가입이 완료되었습니다.");
      return;
    }
    if (invite.status === "EXPIRED") {
      setError("초대가 만료되었습니다.");
      return;
    }
    if (!hasVehicleChoice) {
      setError("차량 유무를 선택해주세요.");
      return;
    }
    const hasVehicle = hasVehicleChoice === "yes";
    if (hasVehicle && (!plate || !vehicleType)) {
      setError("차량 정보를 입력해주세요.");
      return;
    }
    const response = await fetch("/api/invites", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "accept",
        token,
        password,
        has_vehicle: hasVehicle,
        plate: hasVehicle ? plate : null,
        vehicle_type: hasVehicle ? vehicleType : null,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "가입 처리에 실패했습니다.");
      return;
    }
    setStatus("가입이 완료되었습니다. 로그인 페이지로 이동합니다.");
    router.push("/auth/login");
  };

  const inviteStatusLabel =
    inviteStatus === "ACCEPTED"
      ? "가입 완료"
      : inviteStatus === "SENT"
      ? "발송됨"
      : inviteStatus === "PENDING"
      ? "대기"
      : inviteStatus === "EXPIRED"
      ? "만료"
      : inviteStatus ?? "-";

  const disableForm = inviteStatus === "ACCEPTED" || inviteStatus === "EXPIRED";

  return (
    <div>
      <h1 className="page-title">초대 가입</h1>
      {invite ? (
        <div className="muted" style={{ marginBottom: "12px" }}>
          {invite.email} ({invite.role}) 상태: {inviteStatusLabel}
        </div>
      ) : (
        <div className="muted">초대 정보를 불러오는 중...</div>
      )}
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "12px", maxWidth: "360px" }}>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={disableForm}
          />
        </label>
        <label>
          차량 유무
          <select
            value={hasVehicleChoice}
            onChange={(event) => setHasVehicleChoice(event.target.value)}
            disabled={disableForm}
          >
            <option value="">선택</option>
            <option value="yes">있음</option>
            <option value="no">없음</option>
          </select>
        </label>
        {hasVehicleChoice === "yes" ? (
          <>
            <label>
              차량 번호
              <input value={plate} onChange={(event) => setPlate(event.target.value)} disabled={disableForm} />
            </label>
            <label>
              차량 타입
              <select
                value={vehicleType}
                onChange={(event) => setVehicleType(event.target.value)}
                disabled={disableForm}
              >
                <option value="EV">EV</option>
                <option value="ICE">ICE</option>
              </select>
            </label>
          </>
        ) : null}
        <button type="submit" disabled={disableForm}>
          가입 완료
        </button>
        {error ? <div className="muted">{error}</div> : null}
        {status ? <div className="muted">{status}</div> : null}
      </form>
    </div>
  );
}


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
        setError("?? ??? ????.");
        return;
      }
      const response = await fetch(`/api/invites?token=${token}`);
      if (!response.ok) {
        setError("?? ??? ??? ? ????.");
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
      setError("?? ??? ?? ? ????.");
      return;
    }
    if (invite.status === "ACCEPTED") {
      setError("?? ??? ???????.");
      return;
    }
    if (invite.status === "EXPIRED") {
      setError("??? ???????.");
      return;
    }
    if (!hasVehicleChoice) {
      setError("?? ??? ??????.");
      return;
    }
    const hasVehicle = hasVehicleChoice === "yes";
    if (hasVehicle && (!plate || !vehicleType)) {
      setError("?? ??? ??????.");
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
      setError(data.error ?? "?? ??? ??????.");
      return;
    }
    setStatus("??? ???????. ??? ???? ?????.");
    router.push("/auth/login");
  };

  const inviteStatusLabel =
    inviteStatus === "ACCEPTED"
      ? "?? ??"
      : inviteStatus === "SENT"
      ? "???"
      : inviteStatus === "PENDING"
      ? "??"
      : inviteStatus === "EXPIRED"
      ? "??"
      : inviteStatus ?? "-";

  const disableForm = inviteStatus === "ACCEPTED" || inviteStatus === "EXPIRED";

  return (
    <div>
      <h1 className="page-title">?? ??</h1>
      {invite ? (
        <div className="muted" style={{ marginBottom: "12px" }}>
          {invite.email} ({invite.role}) ??: {inviteStatusLabel}
        </div>
      ) : (
        <div className="muted">?? ??? ???? ?...</div>
      )}
      <form onSubmit={onSubmit} style={{ display: "grid", gap: "12px", maxWidth: "360px" }}>
        <label>
          ????
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={disableForm}
          />
        </label>
        <label>
          ?? ??
          <select
            value={hasVehicleChoice}
            onChange={(event) => setHasVehicleChoice(event.target.value)}
            disabled={disableForm}
          >
            <option value="">??</option>
            <option value="yes">??</option>
            <option value="no">??</option>
          </select>
        </label>
        {hasVehicleChoice === "yes" ? (
          <>
            <label>
              ?? ??
              <input value={plate} onChange={(event) => setPlate(event.target.value)} disabled={disableForm} />
            </label>
            <label>
              ?? ??
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
          ?? ??
        </button>
        {error ? <div className="muted">{error}</div> : null}
        {status ? <div className="muted">{status}</div> : null}
      </form>
    </div>
  );
}


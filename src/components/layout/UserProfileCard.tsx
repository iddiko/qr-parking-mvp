"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabaseClient } from "@/lib/supabase/client";

type PhoneRow = {
  id: string;
  phone: string;
  is_primary: boolean;
};

type ProfileRow = {
  email: string;
  role: "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";
  name: string | null;
  phone: string | null;
  complex_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  has_vehicle: boolean | null;
  avatar_url: string | null;
};

type ComplexRow = {
  id: string;
  name: string;
} | null;

type BuildingRow = {
  id: string;
  code: string;
  name: string;
} | null;

type UnitRow = {
  id: string;
  code: string;
} | null;

type VehicleRow = {
  id: string;
  plate: string;
  vehicle_type: string;
} | null;

type QrRow = {
  id: string;
  status: string;
  code: string;
  expires_at: string | null;
  created_at: string;
};

type ApiResponse = {
  profile: ProfileRow;
  phones: PhoneRow[];
  complex: ComplexRow;
  building: BuildingRow;
  unit: UnitRow;
  vehicle: VehicleRow;
  qrs: QrRow[];
};

const roleLabel: Record<ProfileRow["role"], string> = {
  SUPER: "슈퍼관리자",
  MAIN: "메인관리자",
  SUB: "서브관리자",
  GUARD: "경비",
  RESIDENT: "입주민",
};

const buildQrUrl = (code: string) => {
  if (typeof window === "undefined") {
    return code;
  }
  return `${window.location.origin}/q/${code}`;
};

export function UserProfileCard({ showLogout = true }: { showLogout?: boolean }) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [phones, setPhones] = useState<PhoneRow[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [complex, setComplex] = useState<ComplexRow>(null);
  const [building, setBuilding] = useState<BuildingRow>(null);
  const [unit, setUnit] = useState<UnitRow>(null);
  const [hasVehicle, setHasVehicle] = useState(false);
  const [plate, setPlate] = useState("");
  const [vehicleType, setVehicleType] = useState("EV");
  const [qrs, setQrs] = useState<QrRow[]>([]);
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const load = async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/profile", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as ApiResponse;
    setProfile(data.profile);
    setAvatarUrl(data.profile.avatar_url ?? null);
    setName(data.profile.name ?? "");
    setEmail(data.profile.email ?? "");
    setPhones(
      data.phones && data.phones.length > 0
        ? data.phones
        : data.profile.phone
        ? [{ id: "primary", phone: data.profile.phone, is_primary: true }]
        : []
    );
    setComplex(data.complex);
    setBuilding(data.building);
    setUnit(data.unit);
    const profileHasVehicle = data.profile.has_vehicle ?? Boolean(data.vehicle);
    setHasVehicle(profileHasVehicle);
    setPlate(data.vehicle?.plate ?? "");
    setVehicleType(data.vehicle?.vehicle_type ?? "EV");
    setQrs(data.qrs ?? []);
    if (data.qrs && data.qrs.length > 0) {
      const nextImages: Record<string, string> = {};
      await Promise.all(
        data.qrs.map(async (qr) => {
          try {
            const url = await QRCode.toDataURL(buildQrUrl(qr.code));
            nextImages[qr.id] = url;
          } catch {
            nextImages[qr.id] = "";
          }
        })
      );
      setQrImages(nextImages);
    } else {
      setQrImages({});
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const primaryPhone = useMemo(() => phones.find((item) => item.is_primary)?.phone ?? "", [phones]);

  const onLogout = async () => {
    await supabaseClient.auth.signOut();
    router.push("/auth/login");
  };

  const addPhone = () => {
    setPhones((prev) => [...prev, { id: `tmp-${Date.now()}`, phone: "", is_primary: prev.length === 0 }]);
  };

  const updatePhone = (id: string, value: string) => {
    setPhones((prev) => prev.map((item) => (item.id === id ? { ...item, phone: value } : item)));
  };

  const setPrimary = (id: string) => {
    setPhones((prev) => prev.map((item) => ({ ...item, is_primary: item.id === id })));
  };

  const removePhone = (id: string) => {
    setPhones((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (next.length > 0 && !next.some((item) => item.is_primary)) {
        next[0].is_primary = true;
      }
      return [...next];
    });
  };

  const onAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setAvatarStatus("");
    setAvatarUploading(true);
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/profile/avatar", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setAvatarStatus(data.error ?? "프로필 이미지 업로드에 실패했습니다.");
      setAvatarUploading(false);
      return;
    }
    const data = await response.json().catch(() => ({}));
    setAvatarUrl(data.avatar_url ?? null);
    setAvatarStatus("프로필 이미지가 변경되었습니다.");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("profileUpdated"));
    }
    setAvatarUploading(false);
  };

  const onSave = async () => {
    if (!profile) {
      return;
    }
    setStatus("");
    setSaving(true);
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name,
        email,
        phones: phones.map((item) => ({ phone: item.phone, is_primary: item.is_primary })),
        vehicle: {
          has_vehicle: hasVehicle,
          plate,
          vehicle_type: vehicleType,
        },
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "내 정보 저장에 실패했습니다.");
      setSaving(false);
      return;
    }
    setStatus("내 정보가 저장되었습니다.");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("profileUpdated"));
    }
    setSaving(false);
    await load();
  };

  const requestQr = async (type: "REISSUE" | "EXTRA_REQUEST") => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/qr/requests", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ type }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "요청 처리에 실패했습니다.");
      return;
    }
    setStatus(
      type === "REISSUE" ? "QR 재발행 요청이 접수되었습니다." : "QR 추가 발행 요청이 접수되었습니다."
    );
    await load();
  };

  const addExtraQr = async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/qrs/extra", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "QR 추가 발행에 실패했습니다.");
      return;
    }
    setStatus("QR 추가 발행이 완료되었습니다.");
    await load();
  };

  const printQr = (qrId: string) => {
    const url = qrImages[qrId];
    if (!url) {
      return;
    }
    const printWindow = window.open("", "_blank", "width=480,height=600");
    if (!printWindow) {
      return;
    }
    printWindow.document.write(
      `<!doctype html><html><head><title>QR 인쇄</title></head><body style="margin:0;padding:24px;font-family:sans-serif;">` +
        `<img src="${url}" style="width:240px;height:240px;display:block;margin:0 auto;" />` +
        `</body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const ddayLabel = (expiresAt: string | null) => {
    if (!expiresAt) {
      return "D-day 없음";
    }
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / 86400000);
    if (diffDays < 0) {
      return "만료";
    }
    if (diffDays === 0) {
      return "D-day";
    }
    return `D-${diffDays}`;
  };

  return (
    <div className="profile-card">
      <div className="profile-section">
        <div className="profile-row">
          <span className="profile-label">내 이메일</span>
          <span>{profile?.email ?? "-"}</span>
        </div>
        <div className="profile-row">
          <span className="profile-label">내 레벨</span>
          <span>{profile?.role ? roleLabel[profile.role] : "-"}</span>
        </div>
        <div className="profile-row">
          <span className="profile-label">단지</span>
          <span>{complex?.name ?? "-"}</span>
        </div>
        <div className="profile-row">
          <span className="profile-label">동</span>
          <span>{building ? `${building.code}동 (${building.name})` : "-"}</span>
        </div>
        <div className="profile-row">
          <span className="profile-label">호수</span>
          <span>{unit?.code ? `${unit.code}호` : "-"}</span>
        </div>
      </div>

      <div className="profile-section profile-avatar">
        <div className="profile-section__title">프로필 사진</div>
        <div className="profile-avatar__preview">
          {avatarUrl ? (
            <img className="profile-avatar__image" src={avatarUrl} alt="프로필" />
          ) : (
            <div className="muted">등록된 프로필 이미지가 없습니다.</div>
          )}
        </div>
        <input
          className="profile-avatar__input"
          type="file"
          accept="image/*"
          onChange={onAvatarChange}
          disabled={avatarUploading}
        />
        {avatarStatus ? <div className="muted profile-avatar__status">{avatarStatus}</div> : null}
      </div>

      <div className="profile-section">
        <label>
          이름
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          이메일
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
      </div>

      <div className="profile-section">
        <div className="profile-row">
          <span className="profile-label">차량 유무</span>
          <label className="profile-checkbox">
            <input
              type="checkbox"
              checked={hasVehicle}
              onChange={(event) => setHasVehicle(event.target.checked)}
            />
            <span style={{ whiteSpace: "nowrap" }}>차량 정보를 입력합니다</span>
          </label>
        </div>
        {hasVehicle ? (
          <div className="profile-vehicle">
            <label>
              차량 번호
              <input value={plate} onChange={(event) => setPlate(event.target.value)} />
            </label>
            <label>
              차량 타입
              <select value={vehicleType} onChange={(event) => setVehicleType(event.target.value)}>
                <option value="EV">전기</option>
                <option value="ICE">내연</option>
              </select>
            </label>
          </div>
        ) : (
          <div className="muted">차량이 없으면 QR 비활성 상태로 유지됩니다.</div>
        )}
      </div>

      <div className="profile-section">
        <div className="profile-section__title">전화번호</div>
        {phones.length === 0 ? <div className="muted">등록된 전화번호가 없습니다.</div> : null}
        {phones.map((item) => (
          <div key={item.id} className="profile-phone-row">
            <input type="radio" checked={item.is_primary} onChange={() => setPrimary(item.id)} aria-label="대표번호" />
            <input
              value={item.phone}
              onChange={(event) => updatePhone(item.id, event.target.value)}
              placeholder="010-0000-0000"
            />
            <button type="button" onClick={() => removePhone(item.id)}>
              삭제
            </button>
          </div>
        ))}
        <button type="button" onClick={addPhone}>
          전화번호 추가
        </button>
        <div className="muted">대표번호: {primaryPhone || "-"}</div>
      </div>

      <div className="profile-section">
        <div className="profile-section__title">QR 관리</div>
        <div className="muted">보유 QR: {qrs.length} / 2</div>
        {qrs.length === 0 ? <div className="muted">발급된 QR이 없습니다.</div> : null}
        {qrs.map((qr) => (
          <div key={qr.id} className="qr-row">
            <div className="qr-preview">
              {qrImages[qr.id] ? <img src={qrImages[qr.id]} alt="QR" /> : <div className="muted">QR 생성 중</div>}
            </div>
            <div className="qr-info">
              <div>상태: {qr.status === "ACTIVE" ? "활성" : "비활성"}</div>
              <div>D-day: {ddayLabel(qr.expires_at)}</div>
              <div className="muted">발행일: {new Date(qr.created_at).toLocaleString()}</div>
              <button type="button" onClick={() => printQr(qr.id)} disabled={!qrImages[qr.id]}>
                QR 인쇄
              </button>
            </div>
          </div>
        ))}
        <div className="qr-actions">
          <button type="button" onClick={() => requestQr("REISSUE")}>
            QR 재발행 요청
          </button>
          <button type="button" onClick={() => requestQr("EXTRA_REQUEST")}>
            QR 추가 발행 요청
          </button>
          <button type="button" onClick={addExtraQr} disabled={!hasVehicle || qrs.length >= 2}>
            QR +추가
          </button>
        </div>
      </div>

      <button type="button" onClick={onSave} disabled={saving}>
        내 정보 저장
      </button>
      {status ? <div className="muted">{status}</div> : null}
      {showLogout ? (
        <button type="button" onClick={onLogout}>
          로그아웃
        </button>
      ) : null}
    </div>
  );
}

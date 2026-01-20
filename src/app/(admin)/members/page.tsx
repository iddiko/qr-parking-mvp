"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { supabaseClient } from "@/lib/supabase/client";
import { useEditMode } from "@/lib/auth/editMode";
import { MenuGuard } from "@/components/layout/MenuGuard";

type QrRow = {
  id: string;
  status: string;
  code: string;
  created_at: string;
  expires_at: string | null;
};

type VehicleRow = {
  id: string;
  qrs?: QrRow[];
};

type MemberRow = {
  id: string;
  email: string;
  role: string;
  name?: string | null;
  phone?: string | null;
  complex_id?: string | null;
  building_id?: string | null;
  unit_id?: string | null;
  complexes?: { name: string } | { name: string }[] | null;
  buildings?: { code: string; name: string } | { code: string; name: string }[] | null;
  units?: { code: string } | { code: string }[] | null;
  profile_phones?: { phone: string; is_primary: boolean }[] | null;
  vehicles?: VehicleRow[];
};

type ComplexRow = {
  id: string;
  name: string;
};

type BuildingRow = {
  id: string;
  code: string;
  name: string;
};

type UnitRow = {
  id: string;
  code: string;
};

type ProfileRow = {
  avatar_url: string | null;
};

const roleLabel = (role?: string) => {
  switch (role) {
    case "SUPER":
      return "슈퍼관리자";
    case "MAIN":
      return "메인관리자";
    case "SUB":
      return "서브관리자";
    case "GUARD":
      return "경비";
    case "RESIDENT":
      return "입주민";
    default:
      return role ?? "-";
  }
};

const roleClassName = (role?: string) => {
  switch (role) {
    case "SUPER":
      return "role-super";
    case "MAIN":
      return "role-main";
    case "SUB":
      return "role-sub";
    case "GUARD":
      return "role-guard";
    case "RESIDENT":
      return "role-resident";
    default:
      return "";
  }
};

const qrStatusLabel = (status?: string) => {
  if (status === "ACTIVE") {
    return "활성";
  }
  if (status === "INACTIVE") {
    return "비활성";
  }
  return status ?? "-";
};

const formatDateTime = (value?: string) => {
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

const pickField = <T,>(value?: T | T[] | null) => {
  if (!value) {
    return null;
  }
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value;
};

const buildQrUrl = (code: string) => {
  if (typeof window === "undefined") {
    return code;
  }
  return `${window.location.origin}/q/${code}`;
};

export default function Page() {
  const router = useRouter();
  const { enabled } = useEditMode();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    role: "RESIDENT",
    qrId: "",
    qrExpiresAt: "",
    complexId: "",
    buildingId: "",
    unitId: "",
  });
  const [status, setStatus] = useState("");
  const [profileRole, setProfileRole] = useState<string>("");
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [filterComplexId, setFilterComplexId] = useState("");
  const [filterBuildingId, setFilterBuildingId] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);
  const [qrThumbs, setQrThumbs] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const loadProfile = async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const userId = sessionData.session?.user.id;
    if (!userId) {
      return;
    }
    const { data: profileData } = await supabaseClient
      .from("profiles")
      .select("role, complex_id, building_id")
      .eq("id", userId)
      .single();
    if (!profileData) {
      return;
    }
    setProfileRole(profileData.role ?? "");

    const storedComplexId = localStorage.getItem("selectedComplexId") ?? "";
    if (profileData.role === "SUPER") {
      setFilterComplexId(storedComplexId);
      setShowAll(storedComplexId === "");
    } else {
      setShowAll(false);
      if (profileData.complex_id) {
        setFilterComplexId(profileData.complex_id);
      }
    }
    if (profileData.building_id) {
      setFilterBuildingId(profileData.building_id);
    }

    const complexesResponse = await fetch("/api/complexes", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (complexesResponse.ok) {
      const data = await complexesResponse.json();
      setComplexes((data.complexes ?? []) as ComplexRow[]);
    }
  };

  const loadBuildings = async (complexId: string) => {
    if (!complexId) {
      setBuildings([]);
      return;
    }
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch(`/api/buildings?complex_id=${complexId}` , {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setBuildings([]);
      return;
    }
    const data = await response.json();
    setBuildings((data.buildings ?? []) as BuildingRow[]);
  };

  const loadUnits = async (buildingId: string) => {
    if (!buildingId) {
      setUnits([]);
      return;
    }
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch(`/api/units?building_id=${buildingId}` , {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      setUnits([]);
      return;
    }
    const data = await response.json();
    setUnits((data.units ?? []) as UnitRow[]);
  };

  const loadMembers = async () => {
    setLoading(true);
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const params = new URLSearchParams();
    if (showAll) {
      params.set("all", "true");
    }
    if (filterComplexId) {
      params.set("complex_id", filterComplexId);
    }
    if (filterBuildingId) {
      params.set("building_id", filterBuildingId);
    }
    if (filterRole) {
      params.set("role", filterRole);
    }
    const query = params.toString();
    const response = await fetch(`/api/members${query ? `?${query}` : ""}` , {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      setStatus(errorData.error ?? "회원 정보를 불러오지 못했습니다.");
      setMembers([]);
      setLoading(false);
      return;
    }
    const data = await response.json();
    setMembers(data.members ?? []);
    setStatus("");
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
  }, []);

  useLayoutEffect(() => {
    const applyClass = () => {
      const isMobile = window.matchMedia("(max-width: 768px)").matches;
      document.body.classList.toggle("members-mobile", isMobile);
      document.documentElement.classList.toggle("members-mobile", isMobile);
    };
    applyClass();
    window.addEventListener("resize", applyClass);
    return () => {
      window.removeEventListener("resize", applyClass);
      document.body.classList.remove("members-mobile");
      document.documentElement.classList.remove("members-mobile");
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadAvatar = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }
      const { data } = await supabaseClient.from("profiles").select("avatar_url").eq("id", userId).single();
      if (!active) {
        return;
      }
      const row = data as ProfileRow | null;
      setAvatarUrl(row?.avatar_url ?? null);
    };
    loadAvatar();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      void supabaseClient.auth.getSession().then(({ data }) => {
        const userId = data.session?.user.id;
        if (!userId) {
          return;
        }
        supabaseClient
          .from("profiles")
          .select("avatar_url")
          .eq("id", userId)
          .single()
          .then(({ data: row }) => {
            setAvatarUrl((row as ProfileRow | null)?.avatar_url ?? null);
          });
      });
    };
    window.addEventListener("profileUpdated", handler);
    return () => window.removeEventListener("profileUpdated", handler);
  }, []);

  useEffect(() => {
    const handleSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (profileRole === "SUPER") {
        setFilterComplexId(detail?.id ?? "");
        setShowAll((detail?.id ?? "") === "");
      }
    };
    window.addEventListener("complexSelectionChanged", handleSelection as EventListener);
    return () => window.removeEventListener("complexSelectionChanged", handleSelection as EventListener);
  }, [profileRole]);

  useEffect(() => {
    loadBuildings(filterComplexId);
    if (profileRole !== "SUB") {
      setFilterBuildingId("");
    }
  }, [filterComplexId, profileRole]);

  useEffect(() => {
    loadMembers();
  }, [filterComplexId, filterBuildingId, filterRole, showAll]);

  useEffect(() => {
    if (editingId) {
      loadUnits(form.buildingId);
    }
  }, [editingId, form.buildingId]);

  const rows = useMemo(() => {
    return members.map((member) => {
      const qrs = member.vehicles?.flatMap((vehicle) => vehicle.qrs ?? []) ?? [];
      const latestQr = qrs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      const complex = pickField(member.complexes);
      const building = pickField(member.buildings);
      const unit = pickField(member.units);
      const phones = member.profile_phones ?? [];
      const primaryPhone =
        phones.find((item) => item.is_primary)?.phone ?? phones[0]?.phone ?? member.phone ?? "-";
      return {
        member,
        complexName: complex?.name ?? "-",
        buildingLabel: building ? `${building.code}동` : "-",
        unitLabel: unit?.code ? `${unit.code}호` : "-",
        displayPhone: primaryPhone,
        hasQr: qrs.length > 0,
        qrCount: qrs.length,
        qrIssuedAt: latestQr?.created_at ?? "",
        qrExpiresAt: latestQr?.expires_at ?? null,
        qrStatus: latestQr?.status ?? "-",
        qrCode: latestQr?.code ?? "",
        nameLabel: member.name ?? "-",
      };
    });
  }, [members]);

  const mobileRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => {
      const terms = [
        row.member.email,
        row.nameLabel,
        row.displayPhone,
        row.complexName,
        row.buildingLabel,
        row.unitLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.includes(query);
    });
  }, [rows, searchQuery]);

  const mobileActiveCount = useMemo(() => {
    return rows.filter((row) => row.qrStatus === "ACTIVE").length;
  }, [rows]);

  useEffect(() => {
    const loadThumbs = async () => {
      const nextThumbs: Record<string, string> = {};
      await Promise.all(
        rows.map(async (row) => {
          if (!row.qrCode) {
            return;
          }
          try {
            nextThumbs[row.member.id] = await QRCode.toDataURL(buildQrUrl(row.qrCode));
          } catch {
            nextThumbs[row.member.id] = "";
          }
        })
      );
      setQrThumbs(nextThumbs);
    };
    if (rows.length > 0 && typeof window !== "undefined") {
      void loadThumbs();
    } else {
      setQrThumbs({});
    }
  }, [rows]);

  const selectedRow = rows.find((row) => row.member.id === selectedMemberId) ?? null;

  const openModal = (member: MemberRow, shouldEdit = false) => {
    const qrs = member.vehicles?.flatMap((vehicle) => vehicle.qrs ?? []) ?? [];
    const latestQr = qrs.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    setSelectedMemberId(member.id);
    setShowModal(true);
    setEditingId(shouldEdit ? member.id : null);
    setForm({
      name: member.name ?? "",
      phone: member.phone ?? "",
      email: member.email ?? "",
      role: member.role ?? "RESIDENT",
      qrId: latestQr?.id ?? "",
      qrExpiresAt: "",
      complexId: member.complex_id ?? "",
      buildingId: member.building_id ?? "",
      unitId: member.unit_id ?? "",
    });
    setStatus("");
  };

  const closeModal = () => {
    setEditingId(null);
    setSelectedMemberId(null);
    setShowModal(false);
    setStatus("");
  };

  const save = async () => {
    if (!editingId) {
      return;
    }
    setStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/members", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({
        id: editingId,
        name: form.name || null,
        phone: form.phone || null,
        email: form.email || null,
        role: form.role,
        qr_id: form.qrId || null,
        qr_expires_at: form.qrExpiresAt || null,
        complex_id: form.complexId || null,
        building_id: form.buildingId || null,
        unit_id: form.unitId || null,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "회원 정보를 저장하지 못했습니다.");
      return;
    }
    setStatus("회원 정보가 저장되었습니다.");
    setEditingId(null);
    loadMembers();
  };

  const remove = async (memberId: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) {
      return;
    }
    setStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/members", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({ id: memberId }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "회원 정보를 삭제하지 못했습니다.");
      return;
    }
    setStatus("회원 정보가 삭제되었습니다.");
    loadMembers();
  };

  return (
    <MenuGuard roleGroup="sub" toggleKey="members">
      <div>
        <div className="members-desktop">
          <h1 className="page-title">회원관리</h1>
          <p className="muted">모든 계정을 조회하고 역할/정보/QR 상태를 관리합니다.</p>

          <div className="panel-card members-filters">
            <div className="panel-title">회원 필터</div>
            <label>
              단지 필터
              <select
                value={filterComplexId}
                onChange={(event) => {
                  const next = event.target.value;
                  setFilterComplexId(next);
                  if (profileRole === "SUPER") {
                    setShowAll(next === "");
                  }
                }}
                disabled={profileRole === "MAIN" || profileRole === "SUB"}
              >
                <option value="">전체</option>
                {complexes.map((complex) => (
                  <option key={complex.id} value={complex.id}>
                    {complex.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              동 필터
              <select
                value={filterBuildingId}
                onChange={(event) => setFilterBuildingId(event.target.value)}
                disabled={profileRole === "SUB"}
              >
                <option value="">전체</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.code}동 ({building.name})
                  </option>
                ))}
              </select>
            </label>
            <label>
              역할 필터
              <select value={filterRole} onChange={(event) => setFilterRole(event.target.value)}>
                <option value="">전체</option>
                <option value="SUPER">슈퍼관리자</option>
                <option value="MAIN">메인관리자</option>
                <option value="SUB">서브관리자</option>
                <option value="GUARD">경비</option>
                <option value="RESIDENT">입주민</option>
              </select>
            </label>
            {profileRole === "SUPER" ? (
              <label className="filter-inline">
                <input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} />
                전체 보기
              </label>
            ) : null}
          </div>

          {status ? <div className="muted">{status}</div> : null}
          {!loading && members.length === 0 ? <div className="muted">조회된 회원이 없습니다.</div> : null}

          <table className="members-table" style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
            <thead>
              <tr>
                <th align="left">레벨</th>
                <th align="left">이름</th>
                <th align="left">전화</th>
                <th align="left">이메일</th>
                <th align="left">단지</th>
                <th align="left">동</th>
                <th align="left">호수</th>
                <th align="left">수정</th>
                <th align="left">삭제</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, qrStatus, complexName, buildingLabel, unitLabel, displayPhone }) => {
                const canEdit = member.role === "RESIDENT" ? qrStatus === "ACTIVE" : true;
                return (
                  <tr key={member.id} onClick={() => openModal(member)} style={{ cursor: "pointer" }}>
                    <td className="members-role">
                      <span className={`role-badge ${roleClassName(member.role)}`}>{roleLabel(member.role)}</span>
                    </td>
                    <td>{member.name ?? "-"}</td>
                    <td>{displayPhone}</td>
                    <td className="members-email">{member.email}</td>
                    <td>{complexName}</td>
                    <td>{buildingLabel}</td>
                    <td>{unitLabel}</td>
                    <td>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          openModal(member, true);
                        }}
                        disabled={!canEdit}
                      >
                        수정
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          remove(member.id);
                        }}
                        disabled={!enabled}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="members-mobile">
          <div className="mobile-appbar">
            <button type="button" className="mobile-appbar__back" onClick={() => router.back()} aria-label="뒤로가기">
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
              </svg>
            </button>
            <div className="mobile-appbar__title">QR Parking MVP</div>
            <button
              type="button"
              className="mobile-appbar__profile"
              onClick={() => router.push("/admin/mypage")}
              aria-label="마이페이지"
            >
              {avatarUrl ? (
                <img className="mobile-appbar__avatar" src={avatarUrl} alt="마이페이지" />
              ) : (
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M7 18c1.4-2.2 3.8-3.5 5-3.5s3.6 1.3 5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              )}
            </button>
          </div>

          <div className="members-filterbar">
            <div className="members-filterbar__title">
              <span>회원관리</span>
              <div className="members-filterbar__select members-filterbar__select--inline">
                <select
                  value={filterComplexId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setFilterComplexId(next);
                    if (profileRole === "SUPER") {
                      setShowAll(next === "");
                    }
                  }}
                  disabled={profileRole === "MAIN" || profileRole === "SUB"}
                >
                  <option value="">전체 단지</option>
                  {complexes.map((complex) => (
                    <option key={complex.id} value={complex.id}>
                      {complex.name}
                    </option>
                  ))}
                </select>
                <span className="members-filterbar__caret" aria-hidden="true" />
              </div>
            </div>
            <div className="members-filterbar__row">
              <div className="members-search">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="이메일, 전화번호..."
                />
              </div>
              <div className="members-filterbar__select">
                <select value={filterRole} onChange={(event) => setFilterRole(event.target.value)}>
                  <option value="">모든 역할</option>
                  <option value="SUPER">슈퍼관리자</option>
                  <option value="MAIN">메인관리자</option>
                  <option value="SUB">서브관리자</option>
                  <option value="GUARD">경비</option>
                  <option value="RESIDENT">입주민</option>
                </select>
                <span className="members-filterbar__caret" aria-hidden="true" />
              </div>
            </div>
            <div className="members-filterbar__row members-filterbar__row--compact">
              <div className="members-filterbar__select">
                <select
                  value={filterComplexId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setFilterComplexId(next);
                    if (profileRole === "SUPER") {
                      setShowAll(next === "");
                    }
                  }}
                  disabled={profileRole === "MAIN" || profileRole === "SUB"}
                >
                  <option value="">전체 지역</option>
                  {complexes.map((complex) => (
                    <option key={complex.id} value={complex.id}>
                      {complex.name}
                    </option>
                  ))}
                </select>
                <span className="members-filterbar__caret" aria-hidden="true" />
              </div>
              <div className="members-filterbar__select">
                <select value={filterBuildingId} onChange={(event) => setFilterBuildingId(event.target.value)}>
                  <option value="">전체 동</option>
                  {buildings.map((building) => (
                    <option key={building.id} value={building.id}>
                      {building.code}동
                    </option>
                  ))}
                </select>
                <span className="members-filterbar__caret" aria-hidden="true" />
              </div>
            </div>
          </div>

          <div className="members-mobile-scroll">
            <div className="members-card-list">
              <div className="members-filterbar__summary">
                전체 {rows.length}명 / 활성 {mobileActiveCount}명
              </div>
              {mobileRows.length === 0 ? (
                <div className="muted">조회된 회원이 없습니다.</div>
              ) : (
                mobileRows.map((row) => {
                  const statusLabel = qrStatusLabel(row.qrStatus);
                  return (
                    <button
                      key={row.member.id}
                      type="button"
                      className="members-card"
                      onClick={() => openModal(row.member)}
                    >
                      <div className="members-card__avatar">
                        <span>{row.nameLabel.slice(0, 1)}</span>
                      </div>
                      <div className="members-card__info">
                        <div className="members-card__name">
                          <span className="members-card__name-text">{row.nameLabel}</span>
                          <span className={`role-badge ${roleClassName(row.member.role)}`}>
                            {roleLabel(row.member.role)}
                          </span>
                        </div>
                        <div className="members-card__meta">{row.member.email}</div>
                        <div className="members-card__meta">
                          {row.complexName} {row.buildingLabel} {row.unitLabel}
                        </div>
                      </div>
                      <div className="members-card__status">
                        <span className="members-card__status-badge">{statusLabel}</span>
                        <span className="members-card__phone">{row.displayPhone}</span>
                        <svg className="members-card__chevron" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M9 6l6 6-6 6"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="mobile-tabbar">
            <button type="button" className="mobile-tabbar__item" onClick={() => router.push("/dashboard/super")}>
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M7 8h10M7 12h10M7 16h6" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>대시보드</span>
            </button>
            <button type="button" className="mobile-tabbar__item" onClick={() => router.push("/complexes")}>
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M10 21v-4h4v4" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>단지관리</span>
            </button>
            <button type="button" className="mobile-tabbar__item is-active" aria-current="page">
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <circle cx="12" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M5 20c1.2-3 4.2-5 7-5s5.8 2 7 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>회원관리</span>
            </button>
            <button
              type="button"
              className="mobile-tabbar__item mobile-tabbar__item--settings"
              onClick={() => router.push("/settings")}
            >
              <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              <span>설정</span>
            </button>
          </div>
        </div>

        {showModal && selectedRow ? (
          <>
            <button className="members-modal-overlay" type="button" onClick={closeModal} aria-label="닫기" />
            <div className="members-modal" role="dialog" aria-modal="true">
              <div className="members-modal__header">
                <h2 className="members-modal__title">회원 상세</h2>
                <button type="button" className="members-modal__close" onClick={closeModal}>
                  닫기
                </button>
              </div>
              <div className="members-modal__body">
                <div className="members-modal__section">
                  <div className="members-modal__section-title">회원 정보</div>
                  <label>
                    레벨
                    {editingId ? (
                      <select
                        value={form.role}
                        onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
                      >
                        <option value="SUPER">슈퍼관리자</option>
                        <option value="MAIN">메인관리자</option>
                        <option value="SUB">서브관리자</option>
                        <option value="GUARD">경비</option>
                        <option value="RESIDENT">입주민</option>
                      </select>
                    ) : (
                      <div className="members-modal__value">{roleLabel(selectedRow.member.role)}</div>
                    )}
                  </label>
                  <label>
                    이름
                    {editingId ? (
                      <input
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    ) : (
                      <div className="members-modal__value">{selectedRow.member.name ?? "-"}</div>
                    )}
                  </label>
                  <label>
                    이메일
                    {editingId ? (
                      <input
                        value={form.email}
                        onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    ) : (
                      <div className="members-modal__value">{selectedRow.member.email}</div>
                    )}
                  </label>
                  <label>
                    전화번호
                    {editingId ? (
                      <input
                        value={form.phone}
                        onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                      />
                    ) : (
                      <div className="members-modal__value">{selectedRow.displayPhone}</div>
                    )}
                  </label>
                  <label>
                    단지
                    {editingId && profileRole === "SUPER" ? (
                      <select
                        value={form.complexId}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            complexId: event.target.value,
                            buildingId: "",
                            unitId: "",
                          }))
                        }
                      >
                        <option value="">전체</option>
                        {complexes.map((complex) => (
                          <option key={complex.id} value={complex.id}>
                            {complex.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="members-modal__value">{selectedRow.complexName}</div>
                    )}
                  </label>
                  <label>
                    동
                    {editingId ? (
                      <select
                        value={form.buildingId}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            buildingId: event.target.value,
                            unitId: "",
                          }))
                        }
                        disabled={profileRole === "SUB"}
                      >
                        <option value="">전체</option>
                        {buildings.map((building) => (
                          <option key={building.id} value={building.id}>
                            {building.code}동 ({building.name})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="members-modal__value">{selectedRow.buildingLabel}</div>
                    )}
                  </label>
                  <label>
                    호수
                    {editingId ? (
                      <select
                        value={form.unitId}
                        onChange={(event) => setForm((prev) => ({ ...prev, unitId: event.target.value }))}
                      >
                        <option value="">전체</option>
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.code}호
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="members-modal__value">{selectedRow.unitLabel}</div>
                    )}
                  </label>
                </div>

                <div className="members-modal__section">
                  <div className="members-modal__section-title">QR 정보</div>
                  <div className="panel-kv">
                    <span className="panel-kv__label">QR 유무</span>
                    <span className="panel-kv__value">{selectedRow.hasQr ? "있음" : "없음"}</span>
                  </div>
                  <div className="panel-kv">
                    <span className="panel-kv__label">QR 발행수</span>
                    <span className="panel-kv__value">{selectedRow.qrCount}</span>
                  </div>
                  <div className="panel-kv">
                    <span className="panel-kv__label">QR 발행일</span>
                    <span className="panel-kv__value">
                      {selectedRow.qrIssuedAt ? formatDateTime(selectedRow.qrIssuedAt) : "-"}
                    </span>
                  </div>
                  <div className="panel-kv">
                    <span className="panel-kv__label">QR 만료일</span>
                    <span className="panel-kv__value">{ddayLabel(selectedRow.qrExpiresAt)}</span>
                  </div>
                  <div className="panel-kv">
                    <span className="panel-kv__label">QR 상태</span>
                    <span className="panel-kv__value">{qrStatusLabel(selectedRow.qrStatus)}</span>
                  </div>
                  <div className="panel-qr__thumb">
                    {selectedRow.hasQr ? (
                      qrThumbs[selectedRow.member.id] ? (
                        <img src={qrThumbs[selectedRow.member.id]} alt="QR" />
                      ) : (
                        <span className="muted">QR 이미지를 불러올 수 없습니다.</span>
                      )
                    ) : (
                      <span className="muted">QR 없음</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="members-modal__actions">
                {editingId ? (
                  <>
                    <button type="button" onClick={save} disabled={!enabled}>
                      저장
                    </button>
                    <button type="button" onClick={closeModal}>
                      닫기
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => openModal(selectedRow.member, true)}>
                    수정 열기
                  </button>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </MenuGuard>
  );
}

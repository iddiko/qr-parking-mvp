"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";
import { useEditMode } from "@/lib/auth/editMode";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { ProfileMenuContent } from "@/components/layout/ProfileMenu";
import { useRightPanel } from "@/components/layout/RightPanelContext";

type ComplexRow = {
  id: string;
  name: string;
  created_at?: string;
  building_count?: number;
  unit_count?: number;
};

type ProfileRow = {
  avatar_url: string | null;
};

export default function Page() {
  const router = useRouter();
  const { enabled } = useEditMode();
  const { setContent, setVisible } = useRightPanel();
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [selectedComplexId, setSelectedComplexId] = useState("all");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [searchMode, setSearchMode] = useState("name");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [isComposingName, setIsComposingName] = useState(false);
  const [editingComplex, setEditingComplex] = useState<ComplexRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [isComposingEditName, setIsComposingEditName] = useState(false);

  const loadComplexes = async () => {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/complexes", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const list = (data.complexes ?? []) as ComplexRow[];
    setComplexes(list);
    const savedId = localStorage.getItem("selectedComplexId");
    const valid =
      savedId &&
      (savedId === "all" || list.some((complex) => complex.id === savedId));
    setSelectedComplexId(valid ? savedId : "all");
  };

  useEffect(() => {
    let active = true;
    const loadProfile = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }
      const { data } = await supabaseClient
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .single();
      if (!active) {
        return;
      }
      const row = data as ProfileRow | null;
      setAvatarUrl(row?.avatar_url ?? null);
    };
    loadProfile();
    loadComplexes();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setVisible(false);
    setContent(null);
    return () => {
      setVisible(true);
      setContent(null);
    };
  }, [setContent, setVisible]);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".profile-menu")) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [profileMenuOpen]);

  const handleComplexSelect = (value: string) => {
    setSelectedComplexId(value);
    if (!value || value === "all") {
      localStorage.removeItem("selectedComplexId");
      localStorage.removeItem("selectedComplexName");
      window.dispatchEvent(
        new CustomEvent("complexSelectionChanged", {
          detail: { complexId: "all", complexName: "" },
        })
      );
      return;
    }
    const complex = complexes.find((item) => item.id === value);
    const complexName = complex?.name ?? "";
    localStorage.setItem("selectedComplexId", value);
    if (complexName) {
      localStorage.setItem("selectedComplexName", complexName);
    }
    window.dispatchEvent(
      new CustomEvent("complexSelectionChanged", {
        detail: { complexId: value, complexName },
      })
    );
  };

  const handleNameChange = (value: string) => {
    setName(value);
  };

  const handleEditNameChange = (value: string) => {
    setEditName(value);
  };

  const createComplex = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isComposingName) {
      return;
    }
    setStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/complexes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setStatus(data.error ?? "단지 생성에 실패했습니다.");
      return;
    }
    setStatus("단지 생성이 완료되었습니다.");
    setName("");
    loadComplexes();
  };

  const inviteMain = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteStatus("");
    if (!selectedComplexId || selectedComplexId === "all") {
      setInviteStatus("단지를 먼저 선택해주세요.");
      return;
    }
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/invites", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({
        action: "create",
        email: inviteEmail,
        role: "MAIN",
        complex_id: selectedComplexId,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setInviteStatus(data.error ?? "초대 전송에 실패했습니다.");
      return;
    }
    setInviteStatus("초대가 전송되었습니다.");
    setInviteEmail("");
  };

  const openEdit = (complex: ComplexRow) => {
    setEditingComplex(complex);
    setEditName(complex.name);
    setEditStatus("");
    setEditOpen(true);
  };

  const updateComplex = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingComplex || isComposingEditName) {
      return;
    }
    setEditStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/complexes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
      body: JSON.stringify({
        action: "update",
        id: editingComplex.id,
        name: editName,
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setEditStatus(data.error ?? "단지 수정에 실패했습니다.");
      return;
    }
    setEditStatus("단지 수정이 완료되었습니다.");
    setEditOpen(false);
    setEditingComplex(null);
    loadComplexes();
  };

  const deleteComplex = async (complex: ComplexRow) => {
    if (!enabled) {
      window.alert("편집 모드에서만 삭제할 수 있습니다.");
      return;
    }
    const confirmed = window.confirm("선택한 단지를 삭제하시겠습니까?");
    if (!confirmed) {
      return;
    }
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/complexes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        "x-edit-mode": "true",
      },
      body: JSON.stringify({
        action: "delete",
        id: complex.id,
      }),
    });
    if (!response.ok) {
      window.alert("단지 삭제에 실패했습니다.");
      return;
    }
    if (selectedComplexId === complex.id) {
      handleComplexSelect("all");
    }
    loadComplexes();
  };

  const handleComplexClick = (complexId: string) => {
    handleComplexSelect(complexId);
    router.push(`/buildings?complexId=${encodeURIComponent(complexId)}`);
  };

  const filteredComplexes = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let list = complexes.slice();
    if (selectedComplexId && selectedComplexId !== "all") {
      list = list.filter((complex) => complex.id === selectedComplexId);
    }
    if (query) {
      list = list.filter((complex) => complex.name.toLowerCase().includes(query));
    }
    if (searchMode === "recent") {
      list.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [complexes, searchTerm, selectedComplexId, searchMode]);

  const formatDate = (value?: string) => {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString("ko-KR");
  };

  const createPanel = (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "grid", gap: "8px" }}>
        <div className="page-title">단지 생성</div>
        <form onSubmit={createComplex} style={{ display: "grid", gap: "8px" }}>
          <label>
            단지명
            <input
              value={name}
              onChange={(event) => handleNameChange(event.currentTarget.value)}
              onCompositionStart={() => setIsComposingName(true)}
              onCompositionEnd={(event) => {
                setIsComposingName(false);
                handleNameChange(event.currentTarget.value);
              }}
            />
          </label>
          <button type="submit" disabled={!enabled}>
            단지 추가
          </button>
          {status ? <div className="muted">{status}</div> : null}
        </form>
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        <div className="page-title">단지 관리자 초대</div>
        <form onSubmit={inviteMain} style={{ display: "grid", gap: "8px" }}>
          <label>
            단지 선택
            <select value={selectedComplexId} onChange={(event) => handleComplexSelect(event.target.value)}>
              <option value="all">전체 단지</option>
              {complexes.map((complex) => (
                <option key={complex.id} value={complex.id}>
                  {complex.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            관리자 이메일
            <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} />
          </label>
          <button type="submit" disabled={!enabled}>
            초대 보내기
          </button>
          {inviteStatus ? <div className="muted">{inviteStatus}</div> : null}
        </form>
      </div>
    </div>
  );

  return (
    <RoleGuard allowedRoles={["SUPER"]} message="슈퍼관리자 전용 화면입니다.">
      <MenuGuard roleGroup="sub" toggleKey="complexes">
        <div className="complexes-page">
          <div className="complexes-mobile">
            <div className="mobile-appbar">
              <button
                type="button"
                className="mobile-appbar__back"
                onClick={() => router.back()}
                aria-label="뒤로가기"
              >
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                </svg>
              </button>
              <div className="mobile-appbar__title">QR Parking MVP</div>
              <div className="profile-menu">
  <button
    type="button"
    className="mobile-appbar__profile"
    onClick={() => setProfileMenuOpen((prev) => !prev)}
    aria-label="?????"
  >
    {avatarUrl ? (
      <img className="mobile-appbar__avatar" src={avatarUrl} alt="?????" />
    ) : (
      <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M7 18c1.4-2.2 3.8-3.5 5-3.5s3.6 1.3 5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    )}
  </button>
  {profileMenuOpen ? (
    <div className="profile-menu__panel">
      <ProfileMenuContent variant="popover" onNavigate={() => setProfileMenuOpen(false)} />
    </div>
  ) : null}
</div>
            </div>

            <div className="complexes-header">
              <div className="complexes-header-row">
                <span className="complexes-title">단지 관리</span>
                <label className="complexes-inline-select">
                  <select value={selectedComplexId} onChange={(event) => handleComplexSelect(event.target.value)}>
                    <option value="all">전체 단지</option>
                    {complexes.map((complex) => (
                      <option key={complex.id} value={complex.id}>
                        {complex.name}
                      </option>
                    ))}
                  </select>
                  <span className="complexes-caret" aria-hidden="true" />
                </label>
              </div>
              <div className="complexes-divider" aria-hidden="true" />
            </div>

            <div className="complexes-toolbar">
              <div className="complexes-search">
                <span className="complexes-search-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                    <path
                      d="M11 4a7 7 0 1 1 4.95 11.95l3.3 3.3a1 1 0 0 1-1.42 1.42l-3.3-3.3A7 7 0 0 1 11 4Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"
                      fill="currentColor"
                    />
                  </svg>
                </span>
                <input
                  placeholder="단지명 검색..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>

            <div className="complexes-filters">
              <label className="complexes-select">
                <select value={regionFilter} onChange={(event) => setRegionFilter(event.target.value)}>
                  <option value="all">전체 지역</option>
                </select>
              </label>
              <label className="complexes-select">
                <select value={searchMode} onChange={(event) => setSearchMode(event.target.value)}>
                  <option value="name">이름순</option>
                  <option value="recent">최신순</option>
                </select>
              </label>
            </div>

            <div style={{ margin: "12px 0 16px" }}>{createPanel}</div>

            <div className="complexes-list">
              <div className="complexes-divider" aria-hidden="true" />
              {filteredComplexes.map((complex) => (
                <div key={complex.id} className="complexes-card">
                  <button type="button" onClick={() => handleComplexClick(complex.id)} className="complexes-card__main">
                    <div>
                      <div className="complexes-card-title">{complex.name}</div>
                      <div className="complexes-card-sub">{formatDate(complex.created_at)}</div>
                    </div>
                    <div className="complexes-card-badges">
                      <span className="complexes-pill complexes-pill--blue">{complex.building_count ?? 0}동</span>
                      <span className="complexes-pill complexes-pill--yellow">{complex.unit_count ?? 0}세대</span>
                      <span className="complexes-chevron">›</span>
                    </div>
                  </button>
                  <div className="complexes-card__actions">
                    <button type="button" onClick={() => openEdit(complex)} disabled={!enabled}>
                      수정
                    </button>
                    <button type="button" onClick={() => deleteComplex(complex)} disabled={!enabled}>
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {editOpen && editingComplex ? (
              <div className="complexes-modal" role="dialog" aria-modal="true">
                <div className="complexes-modal__card">
                  <div className="complexes-modal__header">
                    <div>단지 수정</div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditOpen(false);
                        setEditingComplex(null);
                      }}
                    >
                      닫기
                    </button>
                  </div>
                  <form onSubmit={updateComplex} className="complexes-modal__section">
                    <label>
                      단지명
                      <input
                        value={editName}
                        onChange={(event) => handleEditNameChange(event.currentTarget.value)}
                        onCompositionStart={() => setIsComposingEditName(true)}
                        onCompositionEnd={(event) => {
                          setIsComposingEditName(false);
                          handleEditNameChange(event.currentTarget.value);
                        }}
                      />
                    </label>
                    <button type="submit" disabled={!enabled}>
                      수정 저장
                    </button>
                    {editStatus ? <div className="muted">{editStatus}</div> : null}
                  </form>
                </div>
              </div>
            ) : null}

            <nav className="mobile-tabbar" aria-label="모바일 탭 메뉴">
              <button type="button" className="mobile-tabbar__item" onClick={() => router.push("/dashboard/super")}>
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M7 8h10M7 12h10M7 16h6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                <span>대시보드</span>
              </button>
              <button type="button" className="mobile-tabbar__item is-active">
                <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
                  <rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M10 21v-4h4v4" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                <span>단지 관리</span>
              </button>
              <button type="button" className="mobile-tabbar__item" onClick={() => router.push("/members")}>
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
                  <path
                    d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
                </svg>
                <span>설정</span>
              </button>
            </nav>
          </div>

          <div className="complexes-desktop">
            <h1 className="page-title">단지 관리</h1>
            <p className="muted">단지 생성과 목록 관리를 할 수 있습니다.</p>
            <div style={{ margin: "16px 0" }}>{createPanel}</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">단지명</th>
                  <th align="left">생성일</th>
                  <th align="left">수정</th>
                  <th align="left">삭제</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplexes.map((complex) => (
                  <tr key={complex.id}>
                    <td>{complex.name}</td>
                    <td>{formatDate(complex.created_at)}</td>
                    <td>
                      <button type="button" onClick={() => openEdit(complex)} disabled={!enabled}>
                        수정
                      </button>
                    </td>
                    <td>
                      <button type="button" onClick={() => deleteComplex(complex)} disabled={!enabled}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </MenuGuard>
    </RoleGuard>
  );
}

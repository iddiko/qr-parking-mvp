"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";
import { useEditMode } from "@/lib/auth/editMode";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { MenuGuard } from "@/components/layout/MenuGuard";
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
  const { enabled } = useEditMode();
  const { setContent } = useRightPanel();
  const router = useRouter();
  const [complexes, setComplexes] = useState<ComplexRow[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [selectedComplexId, setSelectedComplexId] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [searchMode, setSearchMode] = useState("name");
  const [mobileModalOpen, setMobileModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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
    if (list.length > 0) {
      const savedId = localStorage.getItem("selectedComplexId");
      const valid =
        savedId &&
        (savedId === "all" || list.some((complex) => complex.id === savedId));
      setSelectedComplexId(valid ? savedId : "all");
    }
  };

  useLayoutEffect(() => {
    const body = document.body;
    const root = document.documentElement;
    const media = window.matchMedia("(max-width: 768px)");
    const applyMode = (isMobile: boolean) => {
      if (isMobile) {
        body.classList.add("complexes-mobile");
        root.classList.add("complexes-mobile");
      } else {
        body.classList.remove("complexes-mobile");
        root.classList.remove("complexes-mobile");
      }
    };
    applyMode(media.matches);
    const handleChange = (event: MediaQueryListEvent) => applyMode(event.matches);
    media.addEventListener("change", handleChange);
    loadComplexes();
    return () => {
      media.removeEventListener("change", handleChange);
      body.classList.remove("complexes-mobile");
      root.classList.remove("complexes-mobile");
    };
  }, []);

  useEffect(() => {
    document.body.classList.add("dashboard-super");
    return () => document.body.classList.remove("dashboard-super");
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
      const detail = (event as CustomEvent).detail as { complexId?: string } | undefined;
      if (detail?.complexId) {
        setSelectedComplexId(detail.complexId);
      }
    };
    window.addEventListener("complexSelectionChanged", handleSelection as EventListener);
    return () => window.removeEventListener("complexSelectionChanged", handleSelection as EventListener);
  }, []);

  const createComplex = async (event: React.FormEvent) => {
    event.preventDefault();
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
    setName("");
    setStatus("단지가 생성되었습니다.");
    loadComplexes();
  };

  const inviteMain = async (event: React.FormEvent) => {
    event.preventDefault();
    setInviteStatus("");
    if (!selectedComplexId) {
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
      setInviteStatus(data.error ?? "초대 발송에 실패했습니다.");
      return;
    }
    setInviteEmail("");
    setInviteStatus("초대 메일이 발송되었습니다.");
  };

  const filteredComplexes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const baseList =
      selectedComplexId !== "all"
        ? complexes.filter((complex) => complex.id === selectedComplexId)
        : complexes;
    const list = term ? baseList.filter((complex) => complex.name.toLowerCase().includes(term)) : baseList;

    if (searchMode === "recent") {
      return [...list].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    }

    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [complexes, searchMode, searchTerm, selectedComplexId]);

  const formatDate = (value?: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("ko-KR");
  };

  const handleComplexSelect = (complexId: string) => {
    const next = complexId === "all" ? "all" : complexId;
    const nextName = complexes.find((complex) => complex.id === next)?.name;
    setSelectedComplexId(next);
    if (next === "all") {
      localStorage.removeItem("selectedComplexId");
      localStorage.removeItem("selectedComplexName");
    } else {
      localStorage.setItem("selectedComplexId", next);
      if (nextName) {
        localStorage.setItem("selectedComplexName", nextName);
      }
    }
    window.dispatchEvent(
      new CustomEvent("complexSelectionChanged", { detail: { complexId: next, complexName: nextName } })
    );
  };

  const handleComplexClick = (complexId: string) => {
    handleComplexSelect(complexId);
    router.push("/buildings");
  };

  useEffect(() => {
    const panel = (
      <div style={{ display: "grid", gap: "16px" }}>
        <div style={{ display: "grid", gap: "8px" }}>
          <div className="page-title">단지 생성</div>
          <form onSubmit={createComplex} style={{ display: "grid", gap: "8px" }}>
            <label>
              단지명
              <input value={name} onChange={(event) => setName(event.target.value)} />
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
                <option value="">선택</option>
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
              관리자 초대
            </button>
            {inviteStatus ? <div className="muted">{inviteStatus}</div> : null}
          </form>
        </div>
      </div>
    );

    setContent(panel);
    return () => setContent(null);
  }, [complexes, inviteEmail, inviteStatus, name, selectedComplexId, setContent, status, enabled]);

  return (
    <RoleGuard allowedRoles={["SUPER"]} message="슈퍼관리자 전용 화면입니다.">
      <MenuGuard roleGroup="sub" toggleKey="complexes">
        <>
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
              <button type="button" className="complexes-add" onClick={() => setMobileModalOpen(true)} disabled={!enabled}>
                + 단지 추가
              </button>
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
                  <option value="recent">최근 등록순</option>
                </select>
              </label>
            </div>

            <div className="complexes-list">
              <div className="complexes-divider" aria-hidden="true" />
              {filteredComplexes.map((complex) => (
                <button
                  key={complex.id}
                  type="button"
                  className="complexes-card"
                  onClick={() => handleComplexClick(complex.id)}
                >
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
              ))}
            </div>

            {mobileModalOpen ? (
              <div className="complexes-modal" role="dialog" aria-modal="true">
                <div className="complexes-modal__card">
                  <div className="complexes-modal__header">
                    <div>단지 추가/관리자 초대</div>
                    <button type="button" onClick={() => setMobileModalOpen(false)}>
                      닫기
                    </button>
                  </div>
                  <form onSubmit={createComplex} className="complexes-modal__section">
                    <label>
                      단지명
                      <input value={name} onChange={(event) => setName(event.target.value)} />
                    </label>
                    <button type="submit" disabled={!enabled}>
                      단지 추가
                    </button>
                    {status ? <div className="muted">{status}</div> : null}
                  </form>
                  <form onSubmit={inviteMain} className="complexes-modal__section">
                    <label>
                      단지 선택
                      <select value={selectedComplexId} onChange={(event) => handleComplexSelect(event.target.value)}>
                        <option value="">선택</option>
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
                      관리자 초대
                    </button>
                    {inviteStatus ? <div className="muted">{inviteStatus}</div> : null}
                  </form>
                </div>
              </div>
            ) : null}

            <nav className="mobile-tabbar" aria-label="하단 탭 메뉴">
              <button type="button" className="mobile-tabbar__item" onClick={() => router.push("/dashboard/super")}
>
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
                  <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                <span>설정</span>
              </button>
            </nav>
          </div>

          <div className="complexes-desktop">
            <h1 className="page-title">단지 관리</h1>
            <p className="muted">단지를 생성하고 관리자 초대를 진행합니다.</p>

            <section style={{ marginTop: "16px" }}>
              <h2 className="page-title">단지 목록</h2>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left">단지명</th>
                    <th align="left">등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {complexes.map((complex) => (
                    <tr key={complex.id}>
                      <td>{complex.name}</td>
                      <td>{formatDate(complex.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      </MenuGuard>
    </RoleGuard>
  );
}

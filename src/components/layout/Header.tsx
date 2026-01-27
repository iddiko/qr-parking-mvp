"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";
import { ProfileMenuContent } from "./ProfileMenu";
import { useEditMode } from "@/lib/auth/editMode";

type HeaderProps = {
  complexName?: string;
  showEditToggle?: boolean;
  onMenuToggle: () => void;
};

type ProfileRow = {
  avatar_url: string | null;
};

export function Header({ complexName, showEditToggle, onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { enabled, setEnabled } = useEditMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
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
    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const loadBranding = async (complexId?: string | null) => {
      const query =
        complexId && complexId !== "all"
          ? `?complex_id=${encodeURIComponent(complexId)}`
          : "";
      const res = await fetch(`/api/branding${query}`, { cache: "no-store" });
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      setLogoUrl(data?.logo_url ?? null);
    };

    const readSelection = () => {
      const stored = window.localStorage.getItem("selectedComplexId") ?? "";
      void loadBranding(stored || null);
    };

    readSelection();

    const handleComplexChange = () => readSelection();
    window.addEventListener("complexSelectionChanged", handleComplexChange);
    window.addEventListener("storage", handleComplexChange);
    return () => {
      window.removeEventListener("complexSelectionChanged", handleComplexChange);
      window.removeEventListener("storage", handleComplexChange);
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
    if (!menuOpen) {
      return;
    }
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest(".profile-menu")) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <button
          className="menu-toggle menu-toggle--header"
          type="button"
          aria-label="메뉴 열기"
          onClick={onMenuToggle}
        >
          <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className={`app-logo${logoUrl ? " app-logo--image" : ""}`}
          type="button"
          onClick={() => router.push("/")}
        >
          {logoUrl ? <img src={logoUrl} alt="로고" /> : "QR"}
        </button>
        <div className="app-header__titles">
          <div className="app-title">QR Parking MVP</div>
        </div>
      </div>
      <div className="app-header__right">
        {showEditToggle ? (
          <label className="edit-toggle">
            <span>편집 모드</span>
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
          </label>
        ) : null}
        <div className="profile-menu">
          <button
            type="button"
            className="icon-button icon-button--profile"
            aria-label="마이페이지 열기"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            {avatarUrl ? (
              <img className="header-avatar" src={avatarUrl} alt="마이페이지" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c1.5-4 6-6 8-6s6.5 2 8 6" />
              </svg>
            )}
          </button>
          {menuOpen ? (
            <div className="profile-menu__panel">
              <ProfileMenuContent variant="popover" onNavigate={() => setMenuOpen(false)} />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

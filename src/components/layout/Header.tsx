"use client";

import { useEffect, useRef, useState } from "react";
import { UserIcon } from "../icons/UserIcon";
import { useEditMode } from "@/lib/auth/editMode";
import { supabaseClient } from "@/lib/supabase/client";
import { ProfileMenuContent } from "./ProfileMenu";

type HeaderProps = {
  complexName?: string;
  showEditToggle?: boolean;
  onMenuToggle?: () => void;
};

type Role = "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";

type ComplexSelectionDetail = {
  id?: string;
  name?: string;
};

export function Header({ complexName = "??", showEditToggle = true, onMenuToggle }: HeaderProps) {
  const { enabled, setEnabled } = useEditMode();
  const [name, setName] = useState(complexName);
  const [showToggle, setShowToggle] = useState(showEditToggle);
  const [role, setRole] = useState<Role | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoComplexId, setLogoComplexId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }
      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("complex_id, role")
        .eq("id", userId)
        .single();
      if (profile?.role) {
        setRole(profile.role as Role);
      }
      if (profile?.role === "SUPER") {
        setShowToggle(true);
      } else {
        setShowToggle(false);
      }
      if (profile?.complex_id) {
        setLogoComplexId(profile.complex_id);
        const { data: complex } = await supabaseClient
          .from("complexes")
          .select("name")
          .eq("id", profile.complex_id)
          .single();
        if (complex?.name) {
          setName(complex.name);
        }
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (role !== "SUPER") {
      return;
    }
    const storedName = localStorage.getItem("selectedComplexName");
    if (storedName) {
      setName(storedName);
    }
    const storedId = localStorage.getItem("selectedComplexId");
    if (storedId) {
      setLogoComplexId(storedId);
    }
    const handleSelection = (event: Event) => {
      const detail = (event as CustomEvent<ComplexSelectionDetail>).detail;
      if (detail?.name) {
        setName(detail.name);
      }
      if (detail?.id) {
        setLogoComplexId(detail.id);
      }
    };
    window.addEventListener("complexSelectionChanged", handleSelection as EventListener);
    return () => {
      window.removeEventListener("complexSelectionChanged", handleSelection as EventListener);
    };
  }, [role]);

  useEffect(() => {
    const loadLogo = async () => {
      if (!logoComplexId) {
        setLogoUrl(null);
        return;
      }
      const response = await fetch(`/api/branding?complex_id=${logoComplexId}`);
      if (!response.ok) {
        setLogoUrl(null);
        return;
      }
      const data = await response.json();
      setLogoUrl(data?.logo_url ?? null);
    };
    loadLogo();
  }, [logoComplexId]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <button className="menu-toggle menu-toggle--header" type="button" aria-label="?? ??" onClick={onMenuToggle}>
          <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <div className={`app-logo ${logoUrl ? "app-logo--image" : ""}`}>
          {logoUrl ? <img src={logoUrl} alt="??" /> : "QR"}
        </div>
        <div className="app-header__titles">
          <div className="app-title">QR ?? MVP</div>
          <div className="app-subtitle">{name || "?? ??"}</div>
        </div>
      </div>
      <div className="app-header__right">
        {showToggle ? (
          <label className="edit-toggle">
            <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            ?? ??
          </label>
        ) : null}
        <div className="profile-menu" ref={menuRef}>
          <button
            className="icon-button"
            type="button"
            aria-label="?????"
            aria-expanded={menuOpen}
            aria-controls="profile-menu-panel"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <UserIcon />
          </button>
          {menuOpen ? (
            <div id="profile-menu-panel" className="profile-menu__panel" role="menu">
              <ProfileMenuContent variant="popover" onNavigate={() => setMenuOpen(false)} />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}


"use client";

import { ProfileMenuContent } from "./ProfileMenu";

type SidebarProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <>
      <aside className={`sidebar ${isOpen ? "sidebar--open" : ""}`}>
        <button type="button" className="sidebar-close" aria-label="사이드바 닫기" onClick={onClose}>
          <svg viewBox="0 0 24 24" role="img" aria-hidden="true">
            <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <ProfileMenuContent onNavigate={onClose} />
      </aside>
      <button
        type="button"
        className={`sidebar-overlay ${isOpen ? "sidebar-overlay--open" : ""}`}
        aria-label="사이드바 닫기"
        onClick={onClose}
      />
    </>
  );
}

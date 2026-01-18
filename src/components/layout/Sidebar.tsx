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
        <ProfileMenuContent onNavigate={onClose} />
      </aside>
      <button
        type="button"
        className={`sidebar-overlay ${isOpen ? "sidebar-overlay--open" : ""}`}
        aria-label="메뉴 닫기"
        onClick={onClose}
      />
    </>
  );
}

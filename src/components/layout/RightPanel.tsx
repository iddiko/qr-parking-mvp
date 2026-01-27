"use client";

import { useRightPanel } from "./RightPanelContext";

export function RightPanel() {
  const { content, visible } = useRightPanel();

  if (!visible) {
    return null;
  }

  return (
    <aside className="right-panel">
      {content ?? (
        <>
          <div className="page-title">우측 패널</div>
          <div className="muted">페이지에서 선택한 요약 또는 입력이 표시됩니다.</div>
        </>
      )}
    </aside>
  );
}

"use client";

import { useRightPanel } from "./RightPanelContext";

export function RightPanel() {
  const { content } = useRightPanel();

  return (
    <aside className="right-panel">
      {content ?? (
        <>
          <div className="page-title">요약 패널</div>
          <div className="muted">오른쪽 패널에 필요한 내용을 배치하세요.</div>
        </>
      )}
    </aside>
  );
}

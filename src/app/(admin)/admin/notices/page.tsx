"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { useEditMode } from "@/lib/auth/editMode";
import { NoticesList } from "@/components/layout/NoticesList";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { AdminRoleGuard } from "@/components/layout/AdminRoleGuard";
import { useRightPanel } from "@/components/layout/RightPanelContext";

export default function Page() {
  const { enabled } = useEditMode();
  const { setContent } = useRightPanel();
  const [title, setTitle] = useState("");
  const [content, setNoticeContent] = useState("");
  const [status, setStatus] = useState("");
  const [selectedComplexId, setSelectedComplexId] = useState<string>("");

  useEffect(() => {
    const stored = localStorage.getItem("selectedComplexId") ?? "";
    setSelectedComplexId(stored);
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string }>).detail;
      setSelectedComplexId(detail?.id ?? "");
    };
    window.addEventListener("complexSelectionChanged", handle as EventListener);
    return () => {
      window.removeEventListener("complexSelectionChanged", handle as EventListener);
    };
  }, []);

  const createNotice = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setStatus("");
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const response = await fetch("/api/notices", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-edit-mode": enabled ? "true" : "false",
        },
        body: JSON.stringify({ title, content, complex_id: selectedComplexId || undefined }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus(data.error ?? "공지 등록에 실패했습니다.");
        return;
      }
      setTitle("");
      setNoticeContent("");
      setStatus("공지사항이 등록되었습니다.");
    },
    [enabled, title, content, selectedComplexId]
  );

  const panel = useMemo(() => {
    return (
      <div style={{ display: "grid", gap: "12px" }}>
        <div className="page-title">공지 등록</div>
        <form onSubmit={createNotice} style={{ display: "grid", gap: "8px" }}>
          <label>
            제목
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            내용
            <textarea value={content} onChange={(e) => setNoticeContent(e.target.value)} />
          </label>
          <button type="submit">공지 등록</button>
          {status ? <div className="muted">{status}</div> : null}
        </form>
      </div>
    );
  }, [content, createNotice, status, title]);

  useEffect(() => {
    setContent(panel);
    return () => setContent(null);
  }, [panel, setContent]);

  return (
    <AdminRoleGuard>
      <MenuGuard roleGroup="sub" toggleKey="notices">
        <div>
          <h1 className="page-title">공지사항</h1>
          <div style={{ marginTop: "16px" }}>
            {selectedComplexId ? (
              <NoticesList complexId={selectedComplexId} />
            ) : (
              <div className="muted">단지를 선택하면 공지사항이 표시됩니다.</div>
            )}
          </div>
        </div>
      </MenuGuard>
    </AdminRoleGuard>
  );
}

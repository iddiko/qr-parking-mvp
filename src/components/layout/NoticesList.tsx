"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";

type NoticeRow = {
  id: string;
  title: string;
  content: string;
  created_at: string;
  profiles?: {
    email: string | null;
    role: string | null;
  } | null;
};

type NoticesListProps = {
  complexId?: string;
};

export function NoticesList({ complexId }: NoticesListProps) {
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      const query = complexId ? `?complex_id=${encodeURIComponent(complexId)}` : "";
      const response = await fetch(`/api/notices${query}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setLoaded(true);
        return;
      }
      const data = await response.json();
      setNotices(data.notices ?? []);
      setLoaded(true);
    };
    load();
  }, [complexId]);

  if (!loaded) {
    return <div className="muted">공지사항을 불러오는 중...</div>;
  }

  if (notices.length === 0) {
    return <div className="muted">공지사항이 없습니다.</div>;
  }

  return (
    <div className="notice-list">
      {notices.map((notice) => (
        <div key={notice.id} className="notice-item">
          <div className="notice-item__title">{notice.title}</div>
          <div className="notice-item__meta">
            <span>{new Date(notice.created_at).toLocaleString()}</span>
            <span>
              작성자:{" "}
              {notice.profiles?.email
                ? `${notice.profiles.email}${notice.profiles.role ? ` (${notice.profiles.role})` : ""}`
                : "알 수 없음"}
            </span>
          </div>
          <div className="notice-item__content">{notice.content}</div>
        </div>
      ))}
    </div>
  );
}

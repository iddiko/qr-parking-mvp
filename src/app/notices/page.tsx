"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const route = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        router.replace("/auth/login");
        return;
      }
      const { data } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      const role = data?.role;
      if (role === "GUARD") {
        router.replace("/guard/notices");
        return;
      }
      if (role === "RESIDENT") {
        router.replace("/resident/notices");
        return;
      }
      router.replace("/admin/notices");
    };
    route();
  }, [router]);

  return <div className="muted">공지 페이지로 이동 중...</div>;
}

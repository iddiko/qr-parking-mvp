"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { Forbidden } from "./Forbidden";

type Role = "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";

export function AdminRoleGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        setAllowed(false);
        return;
      }
      const { data: profileData } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      const role = profileData?.role as Role | undefined;
      if (!role) {
        setAllowed(false);
        return;
      }
      setAllowed(role === "SUPER" || role === "MAIN" || role === "SUB");
    };
    check();
  }, []);

  if (allowed === null) {
    return <div className="muted">권한 확인 중...</div>;
  }
  if (!allowed) {
    return <Forbidden message="관리자 전용 화면입니다." />;
  }
  return <>{children}</>;
}

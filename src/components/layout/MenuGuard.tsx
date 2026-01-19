"use client";

import { useEffect, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { resolveMenuToggles } from "@/lib/settings/resolve";
import { Forbidden } from "./Forbidden";

type Role = "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";

type Props = {
  roleGroup: "guard" | "resident" | "sub" | "main";
  toggleKey: string;
  children: React.ReactNode;
};

export function MenuGuard({ roleGroup, toggleKey, children }: Props) {
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
        .select("role, complex_id")
        .eq("id", userId)
        .single();
      const role = profileData?.role as Role | undefined;
      if (!role) {
        setAllowed(false);
        return;
      }
      if (role === "SUPER") {
        setAllowed(true);
        return;
      }

      const token = sessionData.session?.access_token ?? "";
      let menuToggles: Record<string, Record<string, boolean>> | null = null;
      if (token) {
        const response = await fetch("/api/settings", {
          headers: { authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          if (data?.menu_toggles) {
            menuToggles = data.menu_toggles as Record<string, Record<string, boolean>>;
          }
        }
      }
      if (!menuToggles) {
        const { data: settingsData } = await supabaseClient
          .from("settings")
          .select("menu_toggles")
          .eq("complex_id", profileData?.complex_id)
          .single();
        menuToggles = (settingsData?.menu_toggles as Record<string, Record<string, boolean>>) ?? null;
      }

      const toggles = resolveMenuToggles(menuToggles as any);
      const groupKey =
        role === "MAIN"
          ? "main"
          : role === "SUB"
          ? "sub"
          : role === "GUARD"
          ? "guard"
          : role === "RESIDENT"
          ? "resident"
          : roleGroup;
      const group = toggles[groupKey];
      setAllowed(group?.[toggleKey] !== false);
    };
    check();
  }, [roleGroup, toggleKey]);

  if (allowed === null) {
    return <div className="muted">메뉴 설정을 불러오는 중입니다.</div>;
  }
  if (!allowed) {
    return <Forbidden />;
  }
  return <>{children}</>;
}


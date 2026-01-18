"use client";

import { useEffect } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { MenuGuard } from "@/components/layout/MenuGuard";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) {
        return;
      }
      const { data } = await supabaseClient
        .from("profiles")
        .select("email, role")
        .eq("id", userId)
        .single();
      const role = data?.role;
      if (role === "SUPER") {
        router.replace("/dashboard/super");
        return;
      }
      if (role === "MAIN") {
        router.replace("/dashboard/main");
        return;
      }
      if (role === "SUB") {
        router.replace("/dashboard/sub");
        return;
      }
    };
    load();
  }, [router]);

  return (
    <MenuGuard roleGroup="sub" toggleKey="dashboard">
      <div>
        <h1 className="page-title">관리자 대시보드</h1>
        <p className="muted">역할에 맞는 대시보드로 이동 중입니다.</p>
      </div>
    </MenuGuard>
  );
}

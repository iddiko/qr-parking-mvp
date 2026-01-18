"use client";

import { useEffect, useState } from "react";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { UserProfileCard } from "@/components/layout/UserProfileCard";
import { supabaseClient } from "@/lib/supabase/client";
import { useEditMode } from "@/lib/auth/editMode";

type ProfileRow = {
  role: "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";
};

export default function Page() {
  const { enabled } = useEditMode();
  const [role, setRole] = useState<ProfileRow["role"] | null>(null);
  const [deployStatus, setDeployStatus] = useState("");
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      if (!token) {
        return;
      }
      const response = await fetch("/api/profile", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        return;
      }
      const data = (await response.json()) as { profile: ProfileRow };
      setRole(data.profile.role);
    };
    void loadProfile();
  }, []);

  const onDeploy = async () => {
    if (!enabled) {
      setDeployStatus("Edit Mode를 켜야 배포할 수 있습니다.");
      return;
    }
    const confirmed = window.confirm("진짜 배포 할거야?");
    if (!confirmed) {
      return;
    }
    setDeploying(true);
    setDeployStatus("");
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData.session?.access_token ?? "";
    const response = await fetch("/api/deploy", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "x-edit-mode": enabled ? "true" : "false",
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setDeployStatus(data.error ?? "배포 요청에 실패했습니다.");
      setDeploying(false);
      return;
    }
    setDeployStatus("배포 요청을 보냈습니다.");
    setDeploying(false);
  };

  return (
    <MenuGuard roleGroup="sub" toggleKey="mypage">
      <div>
        <h1 className="page-title">마이페이지</h1>
        {role === "SUPER" ? (
          <div className="panel-card" style={{ marginBottom: 16 }}>
            <div className="panel-card__title">배포</div>
            <p className="muted">배포는 슈퍼관리자만 가능합니다. Edit Mode를 켠 뒤 진행하세요.</p>
            <button type="button" onClick={onDeploy} disabled={deploying}>
              {deploying ? "배포 중..." : "배포"}
            </button>
            {deployStatus ? <div className="muted">{deployStatus}</div> : null}
          </div>
        ) : null}
        <UserProfileCard />
      </div>
    </MenuGuard>
  );
}

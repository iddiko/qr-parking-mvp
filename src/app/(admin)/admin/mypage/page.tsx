"use client";

import { useEffect, useState } from "react";
import { MenuGuard } from "@/components/layout/MenuGuard";
import { UserProfileCard } from "@/components/layout/UserProfileCard";
import { supabaseClient } from "@/lib/supabase/client";
import { useEditMode } from "@/lib/auth/editMode";
import { useRightPanel } from "@/components/layout/RightPanelContext";

type ProfileRow = {
  role: "SUPER" | "MAIN" | "SUB" | "GUARD" | "RESIDENT";
};

export default function Page() {
  const { enabled } = useEditMode();
  const { setContent } = useRightPanel();
  const [role, setRole] = useState<ProfileRow["role"] | null>(null);
  const [deployStatus, setDeployStatus] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [profileError, setProfileError] = useState("");
  const canDeploy = role === "SUPER";

  useEffect(() => {
    const loadProfile = async () => {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token ?? "";
      setProfileError("");
      if (token) {
        const response = await fetch("/api/profile", {
          headers: { authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = (await response.json()) as { profile: ProfileRow };
          setRole(data.profile.role);
          return;
        }
      }
      const { data: userData } = await supabaseClient.auth.getUser();
      const userId = userData.user?.id ?? "";
      if (!userId) {
        setProfileError("로그인 정보를 확인할 수 없습니다.");
        return;
      }
      const { data: profileRow, error } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();
      if (error || !profileRow) {
        setProfileError("프로필 정보를 불러오지 못했습니다.");
        return;
      }
      setRole(profileRow.role as ProfileRow["role"]);
    };
    void loadProfile();
  }, []);

  const onDeploy = async () => {
    if (!enabled) {
      setDeployStatus("수정 모드를 켜야 배포할 수 있습니다.");
      return;
    }
    const confirmed = window.confirm("정말 배포할까요?");
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
    setDeployStatus("배포가 시작되었습니다.");
    setDeploying(false);
  };

  useEffect(() => {
    const panel = (
      <div className="panel-card">
        <div className="panel-card__title">배포</div>
        {profileError ? <p className="muted">{profileError}</p> : null}
        {!profileError && role === null ? <p className="muted">권한 정보를 불러오는 중입니다.</p> : null}
        {!profileError && role !== null && !canDeploy ? (
          <p className="muted">슈퍼관리자만 배포할 수 있습니다.</p>
        ) : null}
        <p className="muted">수정 모드가 켜진 상태에서만 배포됩니다.</p>
        <button type="button" onClick={onDeploy} disabled={deploying || !canDeploy || !enabled}>
          {deploying ? "배포 중..." : "배포"}
        </button>
        {deployStatus ? <div className="muted">{deployStatus}</div> : null}
      </div>
    );
    setContent(panel);
    return () => setContent(null);
  }, [role, enabled, deploying, deployStatus, profileError, canDeploy, setContent]);

  return (
    <MenuGuard roleGroup="sub" toggleKey="mypage">
      <div>
        <h1 className="page-title">마이페이지</h1>
        <UserProfileCard />
      </div>
    </MenuGuard>
  );
}

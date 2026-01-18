import { NextResponse } from "next/server";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireEditMode } from "@/lib/auth/guards";

export async function POST(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  if (!profile || profile.role !== "SUPER") {
    return NextResponse.json({ error: "슈퍼관리자만 배포할 수 있습니다." }, { status: 403 });
  }
  const editModeCheck = requireEditMode(profile, req);
  if (!editModeCheck.ok) {
    return NextResponse.json({ error: editModeCheck.message }, { status: editModeCheck.status });
  }

  const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL ?? "";
  if (!hookUrl) {
    return NextResponse.json({ error: "배포 훅이 설정되지 않았습니다." }, { status: 400 });
  }

  try {
    const response = await fetch(hookUrl, { method: "POST" });
    if (!response.ok) {
      return NextResponse.json({ error: "배포 요청에 실패했습니다." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "배포 요청에 실패했습니다." }, { status: 502 });
  }
}

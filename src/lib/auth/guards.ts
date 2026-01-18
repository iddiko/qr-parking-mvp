import { isAdmin } from "./roles";
import type { Profile } from "./session";

export function requireAuth(profile: Profile | null) {
  if (!profile) {
    return { ok: false, status: 401, message: "인증이 필요합니다." };
  }
  return { ok: true };
}

export function requireAdminRole(profile: Profile | null) {
  if (!profile || !isAdmin(profile.role)) {
    return { ok: false, status: 403, message: "관리자 권한이 필요합니다." };
  }
  return { ok: true };
}

export function requireComplexScope(profile: Profile, complexId: string) {
  if (profile.role === "SUPER") {
    return { ok: true };
  }
  if (profile.complex_id !== complexId) {
    return { ok: false, status: 403, message: "단지 범위를 벗어난 요청입니다." };
  }
  return { ok: true };
}

export function requireEditMode(profile: Profile, req: Request) {
  if (profile.role !== "SUPER") {
    return { ok: true };
  }
  const editMode = req.headers.get("x-edit-mode");
  if (editMode !== "true") {
    return { ok: false, status: 403, message: "Edit Mode가 필요합니다." };
  }
  return { ok: true };
}

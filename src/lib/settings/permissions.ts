import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveMenuToggles } from "./resolve";
import type { Profile } from "@/lib/auth/session";

export async function requireMenuToggle(
  profile: Profile,
  group: "guard" | "resident" | "sub" | "main",
  key: string
) {
  if (profile.role === "SUPER") {
    return { ok: true };
  }
  if (!profile.complex_id) {
    return { ok: false, status: 403, message: "?? ??? ???? ?????." };
  }
  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("menu_toggles")
    .eq("complex_id", profile.complex_id)
    .single();
  const toggles = resolveMenuToggles(settings?.menu_toggles);
  if (toggles[group]?.[key] === false) {
    return { ok: false, status: 403, message: "?? ??? ?????? ????." };
  }
  return { ok: true };
}

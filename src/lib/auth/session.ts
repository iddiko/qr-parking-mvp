import { supabaseAdmin } from "../supabase/admin";
import type { Role } from "./roles";

export type Profile = {
  id: string;
  role: Role;
  complex_id: string | null;
  building_id: string | null;
  unit_id: string | null;
  email: string;
};

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const [, token] = authHeader.split(" ");
  return token || null;
}

export async function getProfileFromRequest(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return { profile: null, token: null };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData.user) {
    return { profile: null, token: null };
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, complex_id, building_id, unit_id, email")
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    return { profile: null, token: null };
  }

  return { profile: profile as Profile, token };
}

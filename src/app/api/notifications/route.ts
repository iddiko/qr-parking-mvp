import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/guards";
import { requireMenuToggle } from "@/lib/settings/permissions";

export async function GET(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }

  if (profile!.role === "MAIN") {
    const toggleCheck = await requireMenuToggle(profile!, "main", "notifications");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "notifications");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "GUARD") {
    const toggleCheck = await requireMenuToggle(profile!, "guard", "notifications");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "RESIDENT") {
    const toggleCheck = await requireMenuToggle(profile!, "resident", "notifications");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }

  const isAdmin = profile!.role === "MAIN" || profile!.role === "SUB";
  let query = supabaseAdmin
    .from("notifications")
    .select("id, type, payload, created_at")
    .order("created_at", { ascending: false });
  if (profile!.role === "SUPER") {
    query = supabaseAdmin
      .from("notifications")
      .select("id, type, payload, created_at, profiles(id, email, role)")
      .order("created_at", { ascending: false });
  } else if (isAdmin) {
    if (!profile!.complex_id) {
      return NextResponse.json({ error: "No complex scope" }, { status: 400 });
    }
    query = supabaseAdmin
      .from("notifications")
      .select("id, type, payload, created_at, profiles!inner(id, email, role)")
      .eq("profiles.complex_id", profile!.complex_id)
      .order("created_at", { ascending: false });
  } else {
    query = query.eq("profile_id", profile!.id);
  }
  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ notifications: data });
}

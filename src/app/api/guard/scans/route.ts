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
  if (profile!.role !== "GUARD") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const toggleCheck = await requireMenuToggle(profile!, "guard", "history");
  if (!toggleCheck.ok) {
    return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
  }

  const { data, error } = await supabaseAdmin
    .from("scans")
    .select(
      "id, location_label, result, vehicle_plate, created_at, guard_profile_id, qr_id, qrs(vehicles(owner_profile_id, profiles(email)))"
    )
    .eq("guard_profile_id", profile!.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ scans: data ?? [] });
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/guards";

export async function POST(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }

  const { data: vehicle } = await supabaseAdmin
    .from("vehicles")
    .select("id")
    .eq("owner_profile_id", profile!.id)
    .maybeSingle();

  if (!vehicle?.id) {
    return NextResponse.json({ error: "차량 정보가 없습니다." }, { status: 400 });
  }

  const { data: qrs } = await supabaseAdmin
    .from("qrs")
    .select("id")
    .eq("vehicle_id", vehicle.id);

  if ((qrs?.length ?? 0) >= 2) {
    return NextResponse.json({ error: "QR은 최대 2개까지 발행 가능합니다." }, { status: 400 });
  }

  const { data: created, error } = await supabaseAdmin
    .from("qrs")
    .insert({
      vehicle_id: vehicle.id,
      status: "ACTIVE",
      code: crypto.randomUUID(),
    })
    .select("id, status, code, expires_at, created_at")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "QR 발행 실패" }, { status: 400 });
  }

  return NextResponse.json({ qr: created });
}

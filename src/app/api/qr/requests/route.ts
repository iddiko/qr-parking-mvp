import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/guards";

type RequestBody = {
  type?: "REISSUE" | "EXTRA_REQUEST";
};

type QrRow = {
  id: string;
  status: string;
  code: string;
  expires_at: string | null;
  created_at: string;
};

export async function POST(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const requestType = body.type ?? "REISSUE";

  const { data: vehicle } = await supabaseAdmin
    .from("vehicles")
    .select("id")
    .eq("owner_profile_id", profile!.id)
    .maybeSingle();

  if (!vehicle?.id) {
    return NextResponse.json({ error: "차량 정보가 없습니다." }, { status: 400 });
  }

  const { data: existingQrs } = await supabaseAdmin
    .from("qrs")
    .select("id, status")
    .eq("vehicle_id", vehicle.id);

  let createdQr: QrRow | null = null;

  if (requestType === "REISSUE") {
    await supabaseAdmin.from("qrs").update({ status: "INACTIVE" }).eq("vehicle_id", vehicle.id);
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
      return NextResponse.json({ error: error?.message ?? "QR 재발행에 실패했습니다." }, { status: 400 });
    }
    createdQr = created as QrRow;
  }

  if (requestType === "EXTRA_REQUEST") {
    if ((existingQrs?.length ?? 0) >= 2) {
      return NextResponse.json({ error: "QR은 최대 2개까지만 가능합니다." }, { status: 400 });
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
      return NextResponse.json({ error: error?.message ?? "QR 추가 발행에 실패했습니다." }, { status: 400 });
    }
    createdQr = created as QrRow;
  }

  const { data: adminProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, role, complex_id")
    .eq("complex_id", profile!.complex_id)
    .in("role", ["MAIN", "SUB"]);

  const { data: superProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("role", "SUPER");

  const notifyTargets = [...(adminProfiles ?? []), ...(superProfiles ?? [])]
    .filter((admin) => admin.id !== profile!.id)
    .filter((admin, index, list) => list.findIndex((item) => item.id === admin.id) === index);

  if (notifyTargets.length > 0) {
    await supabaseAdmin.from("notifications").insert(
      notifyTargets.map((admin) => ({
          profile_id: admin.id,
          type: "qr_request",
          payload: {
            request_type: requestType,
            profile_id: profile!.id,
            email: profile!.email,
            created_at: new Date().toISOString(),
          },
        }))
    );
  }

  return NextResponse.json({ success: true, qr: createdQr });
}

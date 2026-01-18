import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAdminRole, requireAuth, requireEditMode, requireComplexScope } from "@/lib/auth/guards";
import { requireMenuToggle } from "@/lib/settings/permissions";
import { sendInviteEmail } from "@/lib/notify/email";

const AllowedRoles = ["MAIN", "SUB", "GUARD", "RESIDENT"] as const;

async function resolveBuildingUnit(complexId: string, buildingCode?: string, unitCode?: string) {
  let buildingId: string | null = null;
  let unitId: string | null = null;

  if (buildingCode) {
    const { data: building } = await supabaseAdmin
      .from("buildings")
      .select("id")
      .eq("complex_id", complexId)
      .eq("code", buildingCode)
      .single();
    buildingId = building?.id ?? null;
  }

  if (buildingId && unitCode) {
    const { data: unit } = await supabaseAdmin
      .from("units")
      .select("id")
      .eq("building_id", buildingId)
      .eq("code", unitCode)
      .single();
    unitId = unit?.id ?? null;
  }

  return { buildingId, unitId };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  if (token) {
    const { data, error } = await supabaseAdmin
      .from("invites")
      .select("id, email, role, status, sent_at, created_at")
      .eq("token", token)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    }
    const baseTime = data.sent_at ?? data.created_at;
    if (baseTime && data.status !== "ACCEPTED") {
      const isExpired = new Date(baseTime).getTime() <= Date.now() - 24 * 60 * 60 * 1000;
      if (isExpired) {
        await supabaseAdmin.from("invites").delete().eq("id", data.id);
        return NextResponse.json({ error: "초대가 만료되었습니다." }, { status: 410 });
      }
    }
    return NextResponse.json({ invite: data });
  }

  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }
  const adminCheck = requireAdminRole(profile);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.message }, { status: adminCheck.status });
  }
  if (profile!.role === "MAIN") {
    const toggleCheck = await requireMenuToggle(profile!, "main", "users");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "users");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }

  await supabaseAdmin
    .from("invites")
    .delete()
    .eq("complex_id", profile!.complex_id)
    .in("status", ["PENDING", "SENT"])
    .not("sent_at", "is", null)
    .lt("sent_at", cutoff);
  await supabaseAdmin
    .from("invites")
    .delete()
    .eq("complex_id", profile!.complex_id)
    .in("status", ["PENDING", "SENT"])
    .is("sent_at", null)
    .lt("created_at", cutoff);

  const batchId = url.searchParams.get("batch_id");
  let query = supabaseAdmin
    .from("invites")
    .select(
      "id, email, role, status, sent_at, accepted_at, has_vehicle, plate, vehicle_type, batch_id, created_at"
    )
    .eq("complex_id", profile!.complex_id)
    .order("created_at", { ascending: false });

  if (batchId) {
    query = query.eq("batch_id", batchId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ invites: data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const action = body.action ?? "create";

  if (action === "accept") {
    const token = body.token as string;
    const password = body.password as string;
    const hasVehicle = body.has_vehicle ?? null;
    const plate = body.plate as string | undefined;
    const vehicleType = body.vehicle_type as string | undefined;

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("invites")
      .select("id, email, role, complex_id, building_id, unit_id, status, has_vehicle, plate, vehicle_type")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    }
    if (invite.status === "ACCEPTED") {
      return NextResponse.json({ error: "이미 가입된 초대입니다." }, { status: 400 });
    }
    if (invite.status === "EXPIRED") {
      return NextResponse.json({ error: "만료된 초대입니다." }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });
    }

    const finalHasVehicle = hasVehicle === null ? invite.has_vehicle : Boolean(hasVehicle);
    const finalPlate = plate ?? invite.plate ?? null;
    const finalVehicleType = vehicleType ?? invite.vehicle_type ?? null;

    if (finalHasVehicle && (!finalPlate || !finalVehicleType)) {
      return NextResponse.json({ error: "차량번호/차량타입을 입력해 주세요." }, { status: 400 });
    }

    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    });

    if (userError || !userData.user) {
      return NextResponse.json({ error: userError?.message ?? "계정 생성 실패" }, { status: 400 });
    }

    const profileInsert = await supabaseAdmin.from("profiles").insert({
      id: userData.user.id,
      role: invite.role,
      complex_id: invite.complex_id,
      building_id: invite.building_id,
      unit_id: invite.unit_id,
      email: invite.email,
    });

    if (profileInsert.error) {
      return NextResponse.json({ error: profileInsert.error.message }, { status: 400 });
    }

    let qrId: string | null = null;
    if (finalHasVehicle) {
      const { data: vehicle } = await supabaseAdmin
        .from("vehicles")
        .insert({
          owner_profile_id: userData.user.id,
          plate: finalPlate!,
          vehicle_type: finalVehicleType!,
        })
        .select("id")
        .single();
      if (vehicle?.id) {
        const { data: qr } = await supabaseAdmin
          .from("qrs")
          .insert({
            vehicle_id: vehicle.id,
            status: "INACTIVE",
            code: crypto.randomUUID(),
          })
          .select("id")
          .single();
        qrId = qr?.id ?? null;
      }
    }

    await supabaseAdmin
      .from("invites")
      .update({
        status: "ACCEPTED",
        accepted_at: new Date().toISOString(),
        has_vehicle: finalHasVehicle,
        plate: finalPlate,
        vehicle_type: finalVehicleType,
      })
      .eq("id", invite.id);

    return NextResponse.json({ success: true, qr_id: qrId });
  }

  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }
  const adminCheck = requireAdminRole(profile);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.message }, { status: adminCheck.status });
  }
  if (profile!.role === "MAIN") {
    const toggleCheck = await requireMenuToggle(profile!, "main", "users");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "users");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  const editCheck = requireEditMode(profile!, req);
  if (!editCheck.ok) {
    return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
  }

  const email = body.email as string;
  const role = body.role as (typeof AllowedRoles)[number];
  const buildingCode = body.building_code as string | undefined;
  const unitCode = body.unit_code as string | undefined;
  const locationLabelDefault = body.location_label_default as string | undefined;
  const targetComplexId = body.complex_id as string | undefined;

  if (!email || !role || !AllowedRoles.includes(role)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (role === "SUB" && !buildingCode) {
    return NextResponse.json({ error: "building_code required for SUB" }, { status: 400 });
  }
  if (role === "RESIDENT" && (!buildingCode || !unitCode)) {
    return NextResponse.json({ error: "building_code and unit_code required for RESIDENT" }, { status: 400 });
  }

  const complexId =
    profile!.role === "SUPER" ? targetComplexId ?? profile!.complex_id ?? null : profile!.complex_id ?? null;
  if (!complexId) {
    return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
  }

  const { buildingId, unitId } = await resolveBuildingUnit(complexId, buildingCode, unitCode);
  if (buildingCode && !buildingId) {
    return NextResponse.json({ error: "Invalid building_code" }, { status: 400 });
  }
  if (unitCode && !unitId) {
    return NextResponse.json({ error: "Invalid unit_code" }, { status: 400 });
  }

  const { data: invite, error } = await supabaseAdmin
    .from("invites")
    .insert({
      email,
      role,
      complex_id: complexId,
      building_id: buildingId,
      unit_id: unitId,
      status: "PENDING",
      location_label_default: locationLabelDefault ?? null,
    })
    .select("token, id")
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: error?.message ?? "Invite create failed" }, { status: 400 });
  }

  const emailResult = await sendInviteEmail({ email, token: invite.token });
  if (!emailResult.ok) {
    return NextResponse.json({ error: emailResult.error ?? "초대 메일 발송 실패" }, { status: 502 });
  }

  await supabaseAdmin
    .from("invites")
    .update({ status: "SENT", sent_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ success: true });
}

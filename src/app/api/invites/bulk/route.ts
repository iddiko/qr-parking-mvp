import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAdminRole, requireAuth, requireEditMode } from "@/lib/auth/guards";
import { requireMenuToggle } from "@/lib/settings/permissions";
import { sendInviteEmail } from "@/lib/notify/email";

const AllowedRoles = ["MAIN", "SUB", "GUARD", "RESIDENT"] as const;

function parseBoolean(value: string | undefined) {
  return value?.toLowerCase() === "true";
}

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

export async function POST(req: Request) {
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

  const body = await req.json();
  const action = body.action ?? "upload";

  if (action === "upload") {
    const rows = body.rows as Array<Record<string, string>>;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "No rows" }, { status: 400 });
    }
    const batchId = crypto.randomUUID();
    const inserts = [];

    for (const row of rows) {
      const role = row.role as (typeof AllowedRoles)[number];
      if (!AllowedRoles.includes(role) || !row.email || row.has_vehicle === undefined || row.has_vehicle === "") {
        continue;
      }
      if (role === "SUB" && !row.building_code) {
        continue;
      }
      if (role === "RESIDENT" && (!row.building_code || !row.unit_code)) {
        continue;
      }
      const { buildingId, unitId } = await resolveBuildingUnit(
        profile!.complex_id!,
        row.building_code,
        row.unit_code
      );
      inserts.push({
        email: row.email,
        role,
        complex_id: profile!.complex_id,
        building_id: buildingId,
        unit_id: unitId,
        status: "PENDING",
        batch_id: batchId,
        has_vehicle: parseBoolean(row.has_vehicle),
        plate: row.plate ?? null,
        vehicle_type: row.vehicle_type ?? null,
        location_label_default: row.location_label_default ?? null,
      });
    }

    const { data, error } = await supabaseAdmin
      .from("invites")
      .insert(inserts)
      .select("id, email, status");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ batch_id: batchId, inserted: data ?? [] });
  }

  if (action === "send") {
    const ids = (body.ids as string[]) ?? [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "No ids to send" }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("invites")
      .select("id, email, token")
      .in("id", ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await supabaseAdmin
      .from("invites")
      .update({ status: "SENT", sent_at: new Date().toISOString() })
      .in("id", ids);

    for (const invite of data ?? []) {
      await sendInviteEmail({ email: invite.email, token: invite.token });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

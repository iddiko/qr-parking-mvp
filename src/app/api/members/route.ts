import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAdminRole, requireAuth, requireEditMode } from "@/lib/auth/guards";
import { requireMenuToggle } from "@/lib/settings/permissions";

export async function GET(req: Request) {
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
    const toggleCheck = await requireMenuToggle(profile!, "main", "members");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "members");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }

  let query = supabaseAdmin
    .from("profiles")
    .select(
      "id, email, role, name, phone, complex_id, building_id, unit_id, complexes(name), buildings(code,name), units(code), profile_phones(phone,is_primary), vehicles(id, qrs(id, status, code, created_at, expires_at))"
    )
    .order("created_at", { ascending: false });

  const url = new URL(req.url);
  const showAll = url.searchParams.get("all") === "true";
  const filterComplexId = url.searchParams.get("complex_id");
  const filterBuildingId = url.searchParams.get("building_id");
  const filterRole = url.searchParams.get("role");

  if (filterRole) {
    query = query.eq("role", filterRole);
  }

  const isSuper = profile!.role === "SUPER";
  const isSub = profile!.role === "SUB";

  if (isSuper) {
    if (!showAll) {
      const scopedComplexId = filterComplexId ?? profile!.complex_id;
      if (scopedComplexId) {
        query = query.eq("complex_id", scopedComplexId);
      }
    }
    if (filterBuildingId) {
      query = query.eq("building_id", filterBuildingId);
    }
  } else {
    if (!profile!.complex_id) {
      return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
    }
    query = query.eq("complex_id", profile!.complex_id);
    if (isSub) {
      if (!profile!.building_id) {
        return NextResponse.json({ error: "동 정보가 없습니다." }, { status: 400 });
      }
      query = query.eq("building_id", profile!.building_id);
    } else if (filterBuildingId) {
      query = query.eq("building_id", filterBuildingId);
    }
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ members: data ?? [] });
}

export async function PUT(req: Request) {
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
    const toggleCheck = await requireMenuToggle(profile!, "main", "members");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "members");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  const editCheck = requireEditMode(profile!, req);
  if (!editCheck.ok) {
    return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
  }

  const body = await req.json();
  const memberId = body.id as string;
  const role = body.role as string | undefined;
  const name = body.name as string | undefined;
  const phone = body.phone as string | undefined;
  const email = body.email as string | undefined;
  const qrId = body.qr_id as string | undefined;
  const qrExpiresAt = body.qr_expires_at as string | null | undefined;
  const complexId = body.complex_id as string | null | undefined;
  const buildingId = body.building_id as string | null | undefined;
  const unitId = body.unit_id as string | null | undefined;

  if (!memberId) {
    return NextResponse.json({ error: "회원 ID가 필요합니다." }, { status: 400 });
  }

  if (profile!.role !== "SUPER") {
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("complex_id, building_id")
      .eq("id", memberId)
      .single();
    if (!target?.complex_id || target.complex_id !== profile!.complex_id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }
    if (profile!.role === "SUB" && profile!.building_id && target.building_id !== profile!.building_id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }
    if (complexId && complexId !== profile!.complex_id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }
  }

  if (email) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(memberId, { email });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  let nextComplexId = complexId ?? undefined;
  let nextBuildingId = buildingId ?? undefined;
  let nextUnitId = unitId ?? undefined;

  if (profile!.role !== "SUPER") {
    nextComplexId = undefined;
    if (profile!.role === "SUB") {
      nextBuildingId = undefined;
    }
  }

  if (nextBuildingId && (nextComplexId || profile!.complex_id)) {
    const scopeComplexId = nextComplexId ?? profile!.complex_id;
    const { data: buildingRow } = await supabaseAdmin
      .from("buildings")
      .select("id, complex_id")
      .eq("id", nextBuildingId)
      .single();
    if (!buildingRow || buildingRow.complex_id !== scopeComplexId) {
      return NextResponse.json({ error: "단지 정보가 일치하지 않습니다." }, { status: 400 });
    }
  }

  if (nextUnitId && nextBuildingId) {
    const { data: unitRow } = await supabaseAdmin
      .from("units")
      .select("id, building_id")
      .eq("id", nextUnitId)
      .single();
    if (!unitRow || unitRow.building_id !== nextBuildingId) {
      return NextResponse.json({ error: "동 정보가 일치하지 않습니다." }, { status: 400 });
    }
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      role: role ?? undefined,
      name: name ?? undefined,
      phone: phone ?? undefined,
      email: email ?? undefined,
      complex_id: nextComplexId ?? undefined,
      building_id: nextBuildingId ?? undefined,
      unit_id: nextUnitId ?? undefined,
    })
    .eq("id", memberId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (qrId) {
    if (profile!.role !== "SUPER") {
      const { data: qrRow } = await supabaseAdmin
        .from("qrs")
        .select("id, vehicles(owner_profile_id, profiles(complex_id))")
        .eq("id", qrId)
        .single();
      const qrComplexId = qrRow?.vehicles?.[0]?.profiles?.[0]?.complex_id ?? null;
      if (!qrComplexId || qrComplexId !== profile!.complex_id) {
        return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
      }
    }
    const expiresAtValue = qrExpiresAt ? new Date(qrExpiresAt).toISOString() : null;
    const { error: qrError } = await supabaseAdmin
      .from("qrs")
      .update({ expires_at: expiresAtValue })
      .eq("id", qrId);
    if (qrError) {
      return NextResponse.json({ error: qrError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
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
    const toggleCheck = await requireMenuToggle(profile!, "main", "members");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "members");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  const editCheck = requireEditMode(profile!, req);
  if (!editCheck.ok) {
    return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
  }

  const body = await req.json();
  const memberId = body.id as string;
  if (!memberId) {
    return NextResponse.json({ error: "회원 ID가 필요합니다." }, { status: 400 });
  }

  if (profile!.role !== "SUPER") {
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("complex_id")
      .eq("id", memberId)
      .single();
    if (!target?.complex_id || target.complex_id !== profile!.complex_id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(memberId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

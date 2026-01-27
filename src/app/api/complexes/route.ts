import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAdminRole, requireAuth, requireEditMode } from "@/lib/auth/guards";
import { defaultMenuToggles } from "@/lib/settings/defaults";

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

  let query = supabaseAdmin.from("complexes").select("id, name, created_at").order("created_at", {
    ascending: false,
  });
  if (profile!.role !== "SUPER") {
    if (!profile!.complex_id) {
      return NextResponse.json({ error: "단지 정보가 없는 계정입니다." }, { status: 400 });
    }
    query = query.eq("id", profile!.complex_id);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const complexes = data ?? [];
  if (complexes.length === 0) {
    return NextResponse.json({ complexes });
  }

  const complexIds = complexes.map((complex) => complex.id);
  const { data: buildings, error: buildingsError } = await supabaseAdmin
    .from("buildings")
    .select("id, complex_id")
    .in("complex_id", complexIds);

  if (buildingsError) {
    return NextResponse.json({ error: buildingsError.message }, { status: 400 });
  }

  const buildingCounts = new Map<string, number>();
  const buildingComplexMap = new Map<string, string>();
  const buildingIds: string[] = [];

  (buildings ?? []).forEach((building) => {
    buildingIds.push(building.id);
    buildingComplexMap.set(building.id, building.complex_id);
    buildingCounts.set(building.complex_id, (buildingCounts.get(building.complex_id) || 0) + 1);
  });

  let unitCounts = new Map<string, number>();
  if (buildingIds.length > 0) {
    const { data: units, error: unitsError } = await supabaseAdmin
      .from("units")
      .select("id, building_id")
      .in("building_id", buildingIds);

    if (unitsError) {
      return NextResponse.json({ error: unitsError.message }, { status: 400 });
    }

    unitCounts = new Map<string, number>();
    (units ?? []).forEach((unit) => {
      const complexId = buildingComplexMap.get(unit.building_id);
      if (!complexId) return;
      unitCounts.set(complexId, (unitCounts.get(complexId) || 0) + 1);
    });
  }

  const enriched = complexes.map((complex) => ({
    ...complex,
    building_count: buildingCounts.get(complex.id) || 0,
    unit_count: unitCounts.get(complex.id) || 0,
  }));

  return NextResponse.json({ complexes: enriched });
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
  if (profile!.role !== "SUPER") {
    return NextResponse.json({ error: "슈퍼관리자만 단지를 생성할 수 있습니다." }, { status: 403 });
  }
  const editCheck = requireEditMode(profile!, req);
  if (!editCheck.ok) {
    return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
  }

  const body = await req.json();
  const action = body.action as string | undefined;

  if (action === "update") {
    const id = body.id as string;
    const name = body.name as string;
    if (!id || !name) {
      return NextResponse.json({ error: "단지 정보를 확인해주세요." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("complexes")
      .update({ name })
      .eq("id", id)
      .select("id, name, created_at")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ complex: data });
  }

  if (action === "delete") {
    const id = body.id as string;
    if (!id) {
      return NextResponse.json({ error: "단지 정보를 확인해주세요." }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from("complexes").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const name = body.name as string;
  if (!name) {
    return NextResponse.json({ error: "단지명을 입력해주세요." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("complexes")
    .insert({ name })
    .select("id, name, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await supabaseAdmin.from("settings").insert({
    complex_id: data.id,
    menu_toggles: defaultMenuToggles,
  });
  return NextResponse.json({ complex: data });
}

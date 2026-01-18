import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAdminRole, requireAuth, requireEditMode } from "@/lib/auth/guards";

async function resolveBuildingId(complexId: string, buildingCode: string) {
  const { data } = await supabaseAdmin
    .from("buildings")
    .select("id")
    .eq("complex_id", complexId)
    .eq("code", buildingCode)
    .single();
  return data?.id ?? null;
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
  const editCheck = requireEditMode(profile!, req);
  if (!editCheck.ok) {
    return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
  }

  const body = await req.json();
  const buildingCode = body.building_code as string;
  const unitCode = body.unit_code as string;

  if (!buildingCode || !unitCode) {
    return NextResponse.json({ error: "동 코드와 호수 코드가 필요합니다." }, { status: 400 });
  }
  if (!profile!.complex_id) {
    return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
  }

  const buildingId = await resolveBuildingId(profile!.complex_id, buildingCode);
  if (!buildingId) {
    return NextResponse.json({ error: "동 코드가 올바르지 않습니다." }, { status: 400 });
  }

  if (profile!.role === "SUB" && profile!.building_id && profile!.building_id !== buildingId) {
    return NextResponse.json({ error: "동 범위를 벗어난 요청입니다." }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from("units")
    .insert({ building_id: buildingId, code: unitCode })
    .select("id, code, building_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ unit: data });
}

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

  const url = new URL(req.url);
  const buildingId = url.searchParams.get("building_id");
  if (!buildingId) {
    return NextResponse.json({ error: "building_id required" }, { status: 400 });
  }

  if (profile!.role !== "SUPER") {
    const { data: building } = await supabaseAdmin
      .from("buildings")
      .select("id, complex_id")
      .eq("id", buildingId)
      .single();
    if (!building || building.complex_id !== profile!.complex_id) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    if (profile!.role === "SUB" && profile!.building_id && profile!.building_id !== buildingId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("units")
    .select("id, code")
    .eq("building_id", buildingId)
    .order("code", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ units: data ?? [] });
}

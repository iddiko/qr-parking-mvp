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
    const toggleCheck = await requireMenuToggle(profile!, "main", "buildings");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "buildings");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }

  const url = new URL(req.url);
  const requestedComplexId = url.searchParams.get("complex_id");
  const complexId =
    profile!.role === "SUPER" ? requestedComplexId ?? profile!.complex_id : profile!.complex_id;
  if (!complexId) {
    return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("buildings")
    .select("id, code, name, complex_id, complexes(name)")
    .eq("complex_id", complexId)
    .order("code", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ buildings: data });
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
    const toggleCheck = await requireMenuToggle(profile!, "main", "buildings");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "buildings");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUPER") {
    const editCheck = requireEditMode(profile!, req);
    if (!editCheck.ok) {
      return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
    }
  }

  const body = await req.json();
  const code = body.code as string;
  const name = body.name as string;
  const complexId =
    profile!.role === "SUPER" ? (body.complex_id as string | undefined) ?? profile!.complex_id : profile!.complex_id;

  if (!complexId) {
    return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
  }
  if (!code || !name) {
    return NextResponse.json({ error: "동 코드와 이름이 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("buildings")
    .insert({ complex_id: complexId, code, name })
    .select("id, code, name, complex_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ building: data });
}

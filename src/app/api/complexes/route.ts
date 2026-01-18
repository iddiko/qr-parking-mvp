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
      return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
    }
    query = query.eq("id", profile!.complex_id);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ complexes: data });
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
  const name = body.name as string;
  if (!name) {
    return NextResponse.json({ error: "단지 이름이 필요합니다." }, { status: 400 });
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

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAdminRole, requireAuth, requireEditMode } from "@/lib/auth/guards";
import { resolveMenuToggles } from "@/lib/settings/resolve";
import { requireMenuToggle } from "@/lib/settings/permissions";
import { defaultMenuToggles } from "@/lib/settings/defaults";

export async function GET(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }
  const currentProfile = profile!;

  const url = new URL(req.url);
  const targetComplexId =
    currentProfile.role === "SUPER"
      ? url.searchParams.get("complex_id") ?? currentProfile.complex_id
      : currentProfile.complex_id;
  if (!targetComplexId) {
    return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("complex_id, menu_toggles")
    .eq("complex_id", targetComplexId)
    .single();

  if (error || !data) {
    const { data: created } = await supabaseAdmin
      .from("settings")
      .insert({ complex_id: targetComplexId, menu_toggles: defaultMenuToggles })
      .select("complex_id, menu_toggles")
      .single();
    return NextResponse.json({
      complex_id: created?.complex_id ?? targetComplexId,
      menu_toggles: resolveMenuToggles(created?.menu_toggles ?? defaultMenuToggles),
    });
  }

  return NextResponse.json({
    complex_id: data.complex_id,
    menu_toggles: resolveMenuToggles(data.menu_toggles),
  });
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
    const toggleCheck = await requireMenuToggle(profile!, "main", "settings");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "settings");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  const body = await req.json();
  const targetComplexId =
    profile!.role === "SUPER" ? (body.complex_id as string | undefined) ?? profile!.complex_id : profile!.complex_id;
  if (!targetComplexId) {
    return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
  }
  const editCheck = requireEditMode(profile!, req);
  if (!editCheck.ok) {
    return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
  }

  const inputToggles = resolveMenuToggles(body.menu_toggles ?? {});
  const { data: existingSettings } = await supabaseAdmin
    .from("settings")
    .select("menu_toggles")
    .eq("complex_id", targetComplexId)
    .single();
  const currentToggles = resolveMenuToggles(existingSettings?.menu_toggles);
  const menu_toggles =
    profile!.role === "MAIN"
      ? { ...inputToggles, main: currentToggles.main }
      : profile!.role === "SUB"
      ? { ...inputToggles, main: currentToggles.main, sub: currentToggles.sub }
      : inputToggles;

  const { data, error } = await supabaseAdmin
    .from("settings")
    .upsert(
      {
        complex_id: targetComplexId,
        menu_toggles,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "complex_id" }
    )
    .select("complex_id, menu_toggles")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ complex_id: data.complex_id, menu_toggles: data.menu_toggles });
}


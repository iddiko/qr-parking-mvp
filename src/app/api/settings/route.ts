import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAdminRole, requireAuth, requireEditMode } from "@/lib/auth/guards";
import { resolveMenuLabels, resolveMenuOrder, resolveMenuToggles } from "@/lib/settings/resolve";
import { requireMenuToggle } from "@/lib/settings/permissions";
import { defaultMenuLabels, defaultMenuOrder, defaultMenuToggles } from "@/lib/settings/defaults";

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
    return NextResponse.json({ error: "?? ??? ????." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("complex_id, menu_toggles, menu_order, menu_labels")
    .eq("complex_id", targetComplexId)
    .single();

  if (error || !data) {
    const { data: created } = await supabaseAdmin
      .from("settings")
      .insert({
        complex_id: targetComplexId,
        menu_toggles: defaultMenuToggles,
        menu_order: defaultMenuOrder,
        menu_labels: defaultMenuLabels,
      })
      .select("complex_id, menu_toggles, menu_order, menu_labels")
      .single();
    return NextResponse.json({
      complex_id: created?.complex_id ?? targetComplexId,
      menu_toggles: resolveMenuToggles(created?.menu_toggles ?? defaultMenuToggles),
      menu_order: resolveMenuOrder(created?.menu_order ?? defaultMenuOrder),
      menu_labels: resolveMenuLabels(created?.menu_labels ?? defaultMenuLabels),
    });
  }

  return NextResponse.json({
    complex_id: data.complex_id,
    menu_toggles: resolveMenuToggles(data.menu_toggles),
    menu_order: resolveMenuOrder(data.menu_order ?? defaultMenuOrder),
    menu_labels: resolveMenuLabels(data.menu_labels ?? defaultMenuLabels),
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
    return NextResponse.json({ error: "?? ??? ????." }, { status: 400 });
  }
  const editCheck = requireEditMode(profile!, req);
  if (!editCheck.ok) {
    return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
  }

  const inputToggles = resolveMenuToggles(body.menu_toggles ?? {});
  const inputOrder = resolveMenuOrder(body.menu_order ?? {});
  const inputLabels = resolveMenuLabels(body.menu_labels ?? {});
  const { data: existingSettings } = await supabaseAdmin
    .from("settings")
    .select("menu_toggles, menu_order, menu_labels")
    .eq("complex_id", targetComplexId)
    .single();
  const currentToggles = resolveMenuToggles(existingSettings?.menu_toggles);
  const currentOrder = resolveMenuOrder(existingSettings?.menu_order ?? defaultMenuOrder);
  const currentLabels = resolveMenuLabels(existingSettings?.menu_labels ?? defaultMenuLabels);
  const menu_toggles =
    profile!.role === "MAIN"
      ? { ...inputToggles, main: currentToggles.main }
      : profile!.role === "SUB"
      ? { ...inputToggles, main: currentToggles.main, sub: currentToggles.sub }
      : inputToggles;
  const menu_order = profile!.role === "SUPER" ? inputOrder : currentOrder;
  const menu_labels = profile!.role === "SUPER" ? inputLabels : currentLabels;

  const { data, error } = await supabaseAdmin
    .from("settings")
    .upsert(
      {
        complex_id: targetComplexId,
        menu_toggles,
        menu_order,
        menu_labels,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "complex_id" }
    )
    .select("complex_id, menu_toggles, menu_order, menu_labels")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    complex_id: data.complex_id,
    menu_toggles: data.menu_toggles,
    menu_order: data.menu_order,
    menu_labels: data.menu_labels,
  });
}

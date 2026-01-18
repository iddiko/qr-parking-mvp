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
  if (profile!.role === "MAIN") {
    const toggleCheck = await requireMenuToggle(profile!, "main", "notices");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "notices");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "GUARD") {
    const toggleCheck = await requireMenuToggle(profile!, "guard", "notices");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "RESIDENT") {
    const toggleCheck = await requireMenuToggle(profile!, "resident", "notices");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }

  const url = new URL(req.url);
  const requestedComplexId = url.searchParams.get("complex_id");
  const query = supabaseAdmin
    .from("notices")
    .select("id, title, content, created_at, created_by, complex_id, profiles:created_by(id, email, role)")
    .order("created_at", { ascending: false });

  if (profile!.role === "SUPER") {
    if (requestedComplexId) {
      query.eq("complex_id", requestedComplexId);
    }
  } else {
    query.eq("complex_id", profile!.complex_id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ notices: data });
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
    const toggleCheck = await requireMenuToggle(profile!, "main", "notices");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "notices");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  const editCheck = requireEditMode(profile!, req);
  if (!editCheck.ok) {
    return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
  }

  const body = await req.json();
  const title = body.title as string;
  const content = body.content as string;
  const targetComplexId =
    profile!.role === "SUPER" ? (body.complex_id as string | undefined) : profile!.complex_id ?? undefined;

  if (!title || !content) {
    return NextResponse.json({ error: "title and content required" }, { status: 400 });
  }
  if (!targetComplexId) {
    return NextResponse.json({ error: "complex_id required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("notices").insert({
    complex_id: targetComplexId,
    title,
    content,
    created_by: profile!.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

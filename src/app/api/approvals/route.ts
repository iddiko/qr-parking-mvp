import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAdminRole, requireAuth, requireComplexScope, requireEditMode } from "@/lib/auth/guards";
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
    const toggleCheck = await requireMenuToggle(profile!, "main", "approvals");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "approvals");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("qrs")
    .select("id, status, vehicles(id, plate, vehicle_type, owner_profile_id, profiles(id, email, role, complex_id))")
    .eq("status", "INACTIVE");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const filtered = (data ?? []).filter((row) => {
    const complexId = row.vehicles?.[0]?.profiles?.[0]?.complex_id;
    const scopeCheck = requireComplexScope(profile!, complexId);
    return scopeCheck.ok;
  });

  return NextResponse.json({ approvals: filtered });
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
    const toggleCheck = await requireMenuToggle(profile!, "main", "approvals");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  if (profile!.role === "SUB") {
    const toggleCheck = await requireMenuToggle(profile!, "sub", "approvals");
    if (!toggleCheck.ok) {
      return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
    }
  }
  const editCheck = requireEditMode(profile!, req);
  if (!editCheck.ok) {
    return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
  }

  const body = await req.json();
  const qrId = body.qr_id as string;
  if (!qrId) {
    return NextResponse.json({ error: "qr_id required" }, { status: 400 });
  }

  const { data: qrData, error: qrError } = await supabaseAdmin
    .from("qrs")
    .select("id, vehicles(id, owner_profile_id, profiles(id, complex_id))")
    .eq("id", qrId)
    .single();

  if (qrError || !qrData) {
    return NextResponse.json({ error: "QR not found" }, { status: 404 });
  }

  const complexId = qrData.vehicles?.[0]?.profiles?.[0]?.complex_id;
  if (complexId) {
    const scopeCheck = requireComplexScope(profile!, complexId);
    if (!scopeCheck.ok) {
      return NextResponse.json({ error: scopeCheck.message }, { status: scopeCheck.status });
    }
  }

  const { error } = await supabaseAdmin.from("qrs").update({ status: "ACTIVE" }).eq("id", qrId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

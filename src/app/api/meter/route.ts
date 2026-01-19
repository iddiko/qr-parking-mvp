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
  const url = new URL(req.url);
  const type = url.searchParams.get("type");

  if (type === "cycles") {
    if (profile!.role === "MAIN") {
      const toggleCheck = await requireMenuToggle(profile!, "main", "meter.cycles");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    if (profile!.role === "SUB") {
      const toggleCheck = await requireMenuToggle(profile!, "sub", "meter.cycles");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    if (profile!.role === "RESIDENT") {
      const toggleCheck = await requireMenuToggle(profile!, "resident", "meter");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    const targetComplexId =
      profile!.role === "SUPER"
        ? url.searchParams.get("complex_id") ?? profile!.complex_id
        : profile!.complex_id;
    if (!targetComplexId) {
      return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("meter_cycles")
      .select("id, title, start_date, end_date, status, created_at")
      .eq("complex_id", targetComplexId)
      .order("created_at", { ascending: false });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ cycles: data });
  }

  if (type === "submissions") {
    if (profile!.role === "MAIN") {
      const toggleCheck = await requireMenuToggle(profile!, "main", "meter.submissions");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    if (profile!.role === "SUB") {
      const toggleCheck = await requireMenuToggle(profile!, "sub", "meter.submissions");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    if (profile!.role === "RESIDENT") {
      const toggleCheck = await requireMenuToggle(profile!, "resident", "meter");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    let query = supabaseAdmin
      .from("meter_submissions")
      .select(
        "id, reading_value, submitted_at, profile_id, meter_cycles(id, title), profiles(building_id, unit_id, buildings(code), units(code))"
      )
      .order("submitted_at", { ascending: false });
    if (profile!.role !== "SUPER" && profile!.role !== "MAIN" && profile!.role !== "SUB") {
      query = query.eq("profile_id", profile!.id);
    }
    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ submissions: data });
  }

  if (type === "missing") {
    if (profile!.role === "MAIN") {
      const toggleCheck = await requireMenuToggle(profile!, "main", "meter.submissions");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    if (profile!.role === "SUB") {
      const toggleCheck = await requireMenuToggle(profile!, "sub", "meter.submissions");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    const buildingId = url.searchParams.get("building_id");
    const { data: cycleData } = await supabaseAdmin
      .from("meter_cycles")
      .select("id")
      .eq("complex_id", profile!.complex_id)
      .eq("status", "OPEN")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!cycleData?.id) {
      return NextResponse.json({ missingUnits: [], buildings: [] });
    }

    const { data: buildingsData } = await supabaseAdmin
      .from("buildings")
      .select("id, code, name")
      .eq("complex_id", profile!.complex_id)
      .order("code", { ascending: true });

    let residentQuery = supabaseAdmin
      .from("profiles")
      .select("id, unit_id, building_id, units(code, buildings(code))")
      .eq("complex_id", profile!.complex_id)
      .eq("role", "RESIDENT");
    if (buildingId) {
      residentQuery = residentQuery.eq("building_id", buildingId);
    }
    const { data: residents, error: residentError } = await residentQuery;
    if (residentError) {
      return NextResponse.json({ error: residentError.message }, { status: 400 });
    }

    const { data: submissionRows, error: submissionError } = await supabaseAdmin
      .from("meter_submissions")
      .select("profile_id")
      .eq("cycle_id", cycleData.id);
    if (submissionError) {
      return NextResponse.json({ error: submissionError.message }, { status: 400 });
    }
    const submittedIds = new Set((submissionRows ?? []).map((row) => row.profile_id));
    const missingUnits = (residents ?? [])
      .filter((row) => row.unit_id && !submittedIds.has(row.id))
      .map((row) => ({
        profile_id: row.id,
        building_code: row.units?.[0]?.buildings?.[0]?.code ?? null,
        unit_code: row.units?.[0]?.code ?? null,
      }));

    return NextResponse.json({ missingUnits, buildings: buildingsData ?? [] });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

export async function POST(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }
  const body = await req.json();
  const action = body.action;

  if (action === "create_cycle") {
    const adminCheck = requireAdminRole(profile);
    if (!adminCheck.ok) {
      return NextResponse.json({ error: adminCheck.message }, { status: adminCheck.status });
    }
    if (profile!.role === "SUB") {
      const toggleCheck = await requireMenuToggle(profile!, "sub", "meter.cycles");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    if (profile!.role === "MAIN") {
      const toggleCheck = await requireMenuToggle(profile!, "main", "meter.cycles");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    const editCheck = requireEditMode(profile!, req);
    if (!editCheck.ok) {
      return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
    }
    const title = body.title as string;
    const startDate = body.start_date as string | null;
    const endDate = body.end_date as string | null;
    const targetComplexId =
      profile!.role === "SUPER" ? (body.complex_id as string | undefined) ?? profile!.complex_id : profile!.complex_id;
    if (!targetComplexId) {
      return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
    }
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from("meter_cycles").insert({
      complex_id: targetComplexId,
      title,
      start_date: startDate,
      end_date: endDate,
      status: "OPEN",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  if (action === "submit") {
    if (profile!.role === "RESIDENT") {
      const toggleCheck = await requireMenuToggle(profile!, "resident", "meter");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    if (profile!.role === "SUB") {
      const toggleCheck = await requireMenuToggle(profile!, "sub", "meter.submissions");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    if (profile!.role === "MAIN") {
      const toggleCheck = await requireMenuToggle(profile!, "main", "meter.submissions");
      if (!toggleCheck.ok) {
        return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
      }
    }
    const cycleId = body.cycle_id as string;
    const readingValue = body.reading_value as number;
    const photoUrl = (body.photo_url as string | undefined) ?? null;
    if (!cycleId || readingValue === undefined) {
      return NextResponse.json({ error: "cycle_id and reading_value required" }, { status: 400 });
    }
    const { error } = await supabaseAdmin.from("meter_submissions").insert({
      cycle_id: cycleId,
      profile_id: profile!.id,
      reading_value: readingValue,
      photo_url: photoUrl,
      submitted_at: new Date().toISOString(),
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

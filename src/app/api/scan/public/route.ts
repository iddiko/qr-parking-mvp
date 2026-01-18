import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendScanEmail } from "@/lib/notify/email";

export async function POST(req: Request) {
  const body = await req.json();
  const code = body.code as string;
  const fallbackLocationLabel = "?? ???";
  const locationLabel = (body.location_label as string | undefined) ?? fallbackLocationLabel;
  const locationLat = body.location_lat as number | null | undefined;
  const locationLng = body.location_lng as number | null | undefined;

  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const { data: qr } = await supabaseAdmin
    .from("qrs")
    .select("id, status, vehicle_id, vehicles(plate, owner_profile_id)")
    .eq("code", code)
    .single();

  const result = qr && qr.status === "ACTIVE" ? "RESIDENT" : "ENFORCEMENT";
  let vehicle = qr?.vehicles?.[0] ?? null;
  if (!vehicle && qr?.vehicle_id) {
    const { data: vehicleData } = await supabaseAdmin
      .from("vehicles")
      .select("plate, owner_profile_id")
      .eq("id", qr.vehicle_id)
      .single();
    vehicle = vehicleData ?? null;
  }

  let residentProfile: {
    id: string;
    email: string;
    role: string;
    name: string | null;
    phone: string | null;
    complex_id: string | null;
  } | null = null;

  if (vehicle?.owner_profile_id) {
    const { data: profileData } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role, name, phone, complex_id")
      .eq("id", vehicle.owner_profile_id)
      .single();
    residentProfile = profileData ?? null;
  }

  const { data: primaryPhoneRow } = residentProfile
    ? await supabaseAdmin
        .from("profile_phones")
        .select("phone")
        .eq("profile_id", residentProfile.id)
        .eq("is_primary", true)
        .maybeSingle()
    : { data: null };

  const effectivePhone = primaryPhoneRow?.phone ?? residentProfile?.phone ?? null;
  const scanComplexId = residentProfile?.complex_id ?? null;

  await supabaseAdmin.from("scans").insert({
    qr_id: qr?.id ?? null,
    guard_profile_id: null,
    complex_id: scanComplexId,
    location_label: locationLabel || fallbackLocationLabel,
    result,
    vehicle_plate: vehicle?.plate ?? null,
  });

  if (residentProfile) {
    const timestamp = new Date().toISOString();
    await supabaseAdmin.from("notifications").insert({
      profile_id: residentProfile.id,
      type: "scan",
      payload: {
        timestamp,
        location: locationLabel || fallbackLocationLabel,
        location_lat: locationLat ?? null,
        location_lng: locationLng ?? null,
        result,
        vehicle_plate: vehicle?.plate ?? null,
      },
    });

    await sendScanEmail({
      email: residentProfile.email,
      timestamp,
      location: locationLabel || fallbackLocationLabel,
      result,
      vehiclePlate: vehicle?.plate ?? null,
    });
  }

  const { data: adminProfiles } =
    scanComplexId
      ? await supabaseAdmin
          .from("profiles")
          .select("id, role, complex_id")
          .eq("complex_id", scanComplexId)
          .in("role", ["MAIN", "SUB"])
      : { data: [] };
  const { data: superProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("role", "SUPER");

  const adminTargets = [...(adminProfiles ?? []), ...(superProfiles ?? [])].filter(
    (admin, index, list) => list.findIndex((item) => item.id === admin.id) === index
  );

  if (adminTargets.length > 0) {
    const timestamp = new Date().toISOString();
    await supabaseAdmin.from("notifications").insert(
      adminTargets.map((admin) => ({
        profile_id: admin.id,
        type: "scan",
        payload: {
          timestamp,
          location: locationLabel || fallbackLocationLabel,
          location_lat: locationLat ?? null,
          location_lng: locationLng ?? null,
          result,
          vehicle_plate: vehicle?.plate ?? null,
        },
      }))
    );
  }

  return NextResponse.json({
    result,
    vehicle_plate: vehicle?.plate ?? null,
    resident: residentProfile
      ? {
          id: residentProfile.id,
          email: residentProfile.email,
          name: residentProfile.name ?? null,
          phone: effectivePhone,
        }
      : null,
  });
}

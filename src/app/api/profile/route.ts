import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/guards";

type PhoneInput = {
  id?: string;
  phone: string;
  is_primary?: boolean;
};

type VehicleInput = {
  has_vehicle?: boolean;
  plate?: string;
  vehicle_type?: string;
};

type QrRow = {
  id: string;
  status: string;
  code: string;
  expires_at: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }

  const { data: profileRow, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, name, phone, complex_id, building_id, unit_id, has_vehicle, avatar_url")
    .eq("id", profile!.id)
    .single();

  if (error || !profileRow) {
    return NextResponse.json({ error: error?.message ?? "Profile not found" }, { status: 404 });
  }

  const { data: phones } = await supabaseAdmin
    .from("profile_phones")
    .select("id, phone, is_primary")
    .eq("profile_id", profile!.id)
    .order("created_at", { ascending: true });

  const complex = profileRow.complex_id
    ? await supabaseAdmin.from("complexes").select("id, name").eq("id", profileRow.complex_id).single()
    : { data: null };
  const building = profileRow.building_id
    ? await supabaseAdmin
        .from("buildings")
        .select("id, code, name")
        .eq("id", profileRow.building_id)
        .single()
    : { data: null };
  const unit = profileRow.unit_id
    ? await supabaseAdmin.from("units").select("id, code").eq("id", profileRow.unit_id).single()
    : { data: null };

  const { data: vehicle } = await supabaseAdmin
    .from("vehicles")
    .select("id, plate, vehicle_type")
    .eq("owner_profile_id", profile!.id)
    .maybeSingle();

  const { data: qrs } = vehicle?.id
    ? await supabaseAdmin
        .from("qrs")
        .select("id, status, code, expires_at, created_at")
        .eq("vehicle_id", vehicle.id)
        .order("created_at", { ascending: true })
    : { data: [] as QrRow[] };

  return NextResponse.json({
    profile: profileRow,
    phones: phones ?? [],
    complex: complex.data ?? null,
    building: building.data ?? null,
    unit: unit.data ?? null,
    vehicle: vehicle ?? null,
    qrs: qrs ?? [],
  });
}

export async function PUT(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }

  const body = await req.json();
  const name = body.name as string | undefined;
  const email = body.email as string | undefined;
  const phones = (body.phones ?? []) as PhoneInput[];
  const vehicleInput = (body.vehicle ?? {}) as VehicleInput;
  const hasVehicle = vehicleInput.has_vehicle !== false;

  const normalizedPhones = phones
    .map((item) => ({
      id: item.id,
      phone: String(item.phone ?? "").trim(),
      is_primary: Boolean(item.is_primary),
    }))
    .filter((item) => item.phone.length > 0);

  const primaryPhone =
    normalizedPhones.find((item) => item.is_primary)?.phone ?? normalizedPhones[0]?.phone ?? null;

  if (email) {
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(profile!.id, { email });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      name: name ?? undefined,
      email: email ?? undefined,
      phone: primaryPhone ?? undefined,
      has_vehicle: hasVehicle,
    })
    .eq("id", profile!.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  await supabaseAdmin.from("profile_phones").delete().eq("profile_id", profile!.id);
  if (normalizedPhones.length > 0) {
    await supabaseAdmin.from("profile_phones").insert(
      normalizedPhones.map((item) => ({
        profile_id: profile!.id,
        phone: item.phone,
        is_primary: item.phone === primaryPhone,
      }))
    );
  }

  const { data: existingVehicle } = await supabaseAdmin
    .from("vehicles")
    .select("id, plate, vehicle_type")
    .eq("owner_profile_id", profile!.id)
    .maybeSingle();

  if (!hasVehicle && existingVehicle?.id) {
    await supabaseAdmin
      .from("qrs")
      .update({ status: "INACTIVE" })
      .eq("vehicle_id", existingVehicle.id);
  }

  if (hasVehicle) {
    const plate = (vehicleInput.plate ?? existingVehicle?.plate ?? "").trim();
    const vehicleType = vehicleInput.vehicle_type ?? existingVehicle?.vehicle_type ?? null;
    if (plate && vehicleType) {
      if (existingVehicle?.id) {
        await supabaseAdmin
          .from("vehicles")
          .update({ plate, vehicle_type: vehicleType })
          .eq("id", existingVehicle.id);
      } else {
        const { data: newVehicle } = await supabaseAdmin
          .from("vehicles")
          .insert({ owner_profile_id: profile!.id, plate, vehicle_type: vehicleType })
          .select("id")
          .single();
        if (newVehicle?.id) {
          await supabaseAdmin.from("qrs").insert({
            vehicle_id: newVehicle.id,
            status: "ACTIVE",
            code: crypto.randomUUID(),
          });
        }
      }
    }
  }

  const { data: adminProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, role, email, complex_id")
    .eq("complex_id", profile!.complex_id)
    .in("role", ["MAIN", "SUB"]);

  const notificationPayload = {
    profile_id: profile!.id,
    email: email ?? profile!.email,
    name: name ?? null,
    primary_phone: primaryPhone,
    updated_at: new Date().toISOString(),
  };

  if (adminProfiles && adminProfiles.length > 0) {
    await supabaseAdmin.from("notifications").insert(
      adminProfiles
        .filter((admin) => admin.id !== profile!.id)
        .map((admin) => ({
          profile_id: admin.id,
          type: "profile_update",
          payload: notificationPayload,
        }))
    );
  }

  return NextResponse.json({ success: true });
}

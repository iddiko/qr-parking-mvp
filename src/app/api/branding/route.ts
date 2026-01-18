import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAuth, requireEditMode } from "@/lib/auth/guards";
import { defaultMenuToggles } from "@/lib/settings/defaults";

const BUCKET_NAME = "branding";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const complexId = url.searchParams.get("complex_id");

  if (complexId) {
    const { data } = await supabaseAdmin
      .from("settings")
      .select("logo_url")
      .eq("complex_id", complexId)
      .maybeSingle();
    return NextResponse.json({ logo_url: data?.logo_url ?? null });
  }

  const { data } = await supabaseAdmin
    .from("settings")
    .select("logo_url, updated_at")
    .not("logo_url", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ logo_url: data?.logo_url ?? null });
}

export async function POST(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }
  if (profile?.role !== "SUPER") {
    return NextResponse.json({ error: "슈퍼관리자만 업로드할 수 있습니다." }, { status: 403 });
  }
  const editCheck = requireEditMode(profile!, req);
  if (!editCheck.ok) {
    return NextResponse.json({ error: editCheck.message }, { status: editCheck.status });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "업로드할 파일이 없습니다." }, { status: 400 });
  }
  const complexId = (form.get("complex_id")?.toString() ?? profile!.complex_id) as string | undefined;
  if (!complexId) {
    return NextResponse.json({ error: "단지 정보가 없습니다." }, { status: 400 });
  }

  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const hasBucket = buckets?.some((bucket) => bucket.name === BUCKET_NAME);
  if (!hasBucket) {
    await supabaseAdmin.storage.createBucket(BUCKET_NAME, { public: true });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const filePath = `logo/${complexId}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, { contentType: file.type, upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: publicData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  const logoUrl = publicData.publicUrl;

  const { data: existing } = await supabaseAdmin
    .from("settings")
    .select("menu_toggles")
    .eq("complex_id", complexId)
    .maybeSingle();

  const menuToggles = existing?.menu_toggles ?? defaultMenuToggles;

  const { error: settingsError } = await supabaseAdmin
    .from("settings")
    .upsert(
      {
        complex_id: complexId,
        menu_toggles: menuToggles,
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "complex_id" }
    );
  if (settingsError) {
    return NextResponse.json({ error: settingsError.message }, { status: 400 });
  }

  return NextResponse.json({ logo_url: logoUrl });
}

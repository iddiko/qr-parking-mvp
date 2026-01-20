import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/guards";

const BUCKET = "avatars";

function getExtension(file: File) {
  const name = file.name?.trim();
  if (name && name.includes(".")) {
    return name.split(".").pop()?.toLowerCase() ?? "png";
  }
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  return "png";
}

export async function POST(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "이미지 파일이 필요합니다." }, { status: 400 });
  }

  const ext = getExtension(file);
  const filePath = `profile/${profile!.id}.${ext}`;
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const { data: bucket } = await supabaseAdmin.storage.getBucket(BUCKET);
  if (!bucket) {
    await supabaseAdmin.storage.createBucket(BUCKET, { public: true });
  }

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type || "image/png",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);
  const avatarUrl = publicData.publicUrl;

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", profile!.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ avatar_url: avatarUrl });
}

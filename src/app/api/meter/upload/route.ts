import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getProfileFromRequest } from "@/lib/auth/session";
import { requireAuth } from "@/lib/auth/guards";
import { requireMenuToggle } from "@/lib/settings/permissions";

const BUCKET_NAME = "meter-photos";

export async function POST(req: Request) {
  const { profile } = await getProfileFromRequest(req);
  const authCheck = requireAuth(profile);
  if (!authCheck.ok) {
    return NextResponse.json({ error: authCheck.message }, { status: authCheck.status });
  }
  if (profile!.role !== "RESIDENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const toggleCheck = await requireMenuToggle(profile!, "resident", "meter");
  if (!toggleCheck.ok) {
    return NextResponse.json({ error: toggleCheck.message }, { status: toggleCheck.status });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const contentType = file.type || "image/jpeg";
  const extension = file.name.split(".").pop() || "jpg";
  const filePath = `${profile!.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  await supabaseAdmin.storage.createBucket(BUCKET_NAME, { public: true }).catch(() => null);

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, { contentType, upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  return NextResponse.json({ url: data.publicUrl });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { validatePrefix } from "@/lib/validation";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const { prefix, error } = validatePrefix(searchParams.get("prefix") || "");

  if (error) {
    return NextResponse.json({ available: false, error }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error: lookupError } = await admin
    .from("aliases")
    .select("id")
    .eq("prefix", prefix)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  return NextResponse.json({ prefix, available: !data });
}

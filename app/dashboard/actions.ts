"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ALIAS_DOMAIN } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { validatePrefix } from "@/lib/validation";

export async function claimAlias(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { prefix, error } = validatePrefix(String(formData.get("prefix") || ""));

  if (error) {
    redirect(`/dashboard?error=${encodeURIComponent(error)}`);
  }

  const { error: insertError } = await supabase.from("aliases").insert({
    prefix,
    user_id: user.id
  });

  if (insertError) {
    const message = insertError.code === "23505" ? "That alias is already claimed." : insertError.message;
    redirect(`/dashboard?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?success=${encodeURIComponent(`${prefix}@${ALIAS_DOMAIN} is yours.`)}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

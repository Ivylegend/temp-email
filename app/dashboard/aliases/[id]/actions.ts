"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function deleteMessage(formData: FormData) {
  const messageId = String(formData.get("message_id") || "");
  const aliasId = String(formData.get("alias_id") || "");
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase.from("messages").delete().eq("id", messageId);

  if (error) {
    redirect(`/dashboard/aliases/${aliasId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/dashboard/aliases/${aliasId}`);
  redirect(`/dashboard/aliases/${aliasId}?success=${encodeURIComponent("Message deleted.")}`);
}

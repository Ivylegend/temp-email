import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { APP_NAME, ALIAS_DOMAIN } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Alias } from "@/lib/types";
import { signOut } from "./actions";
import { ClaimAliasForm } from "./claim-alias-form";
import { AliasSidebar } from "./alias-sidebar";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: aliases, error } = await supabase
    .from("aliases")
    .select("id,prefix,user_id,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="split-shell">
      {/* ── Left sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">{APP_NAME}</div>
          <form action={signOut}>
            <SubmitButton className="icon-btn-ghost" title="Sign out" pendingText="">
              <LogOut size={16} />
            </SubmitButton>
          </form>
        </div>

        <div className="sidebar-user">{user.email}</div>

        {/* Collapsed claim-alias form */}
        <ClaimAliasForm collapsed />

        {/* Alias list */}
        <AliasSidebar aliases={aliases as Alias[]} domain={ALIAS_DOMAIN} />
      </aside>

      {/* ── Right content pane ── */}
      <main className="mail-pane">{children}</main>
    </div>
  );
}

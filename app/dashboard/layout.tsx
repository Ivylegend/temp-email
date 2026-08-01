import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { APP_NAME, ALIAS_DOMAIN } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Alias, Group } from "@/lib/types";
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

  const [{ data: aliases, error: aliasError }, { data: groups, error: groupError }] =
    await Promise.all([
      supabase
        .from("aliases")
        .select("id,prefix,user_id,created_at,group_id")
        .order("created_at", { ascending: false }),
      supabase
        .from("groups")
        .select("id,name,user_id,created_at")
        .order("created_at", { ascending: true })
    ]);

  if (aliasError) throw new Error(aliasError.message);
  if (groupError) throw new Error(groupError.message);

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

        {/* Alias + Group list — fills remaining space */}
        <AliasSidebar
          aliases={aliases as Alias[]}
          groups={groups as Group[]}
          domain={ALIAS_DOMAIN}
        />
      </aside>

      {/* ── Right content pane ── */}
      <main className="mail-pane">{children}</main>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, LogOut } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { RefreshLink } from "@/components/refresh-link";
import { ALIAS_DOMAIN, APP_NAME } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Alias } from "@/lib/types";
import { signOut } from "./actions";
import { ClaimAliasForm } from "./claim-alias-form";

export default async function DashboardPage({
  searchParams
}: {
  searchParams: { error?: string; success?: string };
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
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">{APP_NAME}</div>
          <div className="muted">{user.email}</div>
        </div>
        <form action={signOut}>
          <SubmitButton className="button secondary" title="Sign out" pendingText="Signing out">
            <LogOut size={18} />
            Sign out
          </SubmitButton>
        </form>
      </header>

      <section className="page">
        <div className="button-row">
          <div>
            <h1>Your aliases</h1>
            <p className="muted">Claim prefixes and inspect mail received at each address.</p>
          </div>
          <RefreshLink label="Refresh" />
        </div>

        {searchParams.error ? <div className="status error">{searchParams.error}</div> : null}
        {searchParams.success ? <div className="status success">{searchParams.success}</div> : null}

        <section className="section">
          <ClaimAliasForm />
        </section>

        <section className="section alias-list">
          {(aliases as Alias[] | null)?.length ? (
            (aliases as Alias[]).map((alias) => (
              <article className="alias-item" key={alias.id}>
                <div>
                  <div className="alias-address">{alias.prefix}@{ALIAS_DOMAIN}</div>
                  <div className="muted">Created {new Date(alias.created_at).toLocaleString()}</div>
                </div>
                <Link className="button secondary" href={`/dashboard/aliases/${alias.id}`} title="Open alias">
                  <Inbox size={18} />
                  Open
                </Link>
              </article>
            ))
          ) : (
            <div className="empty">No aliases yet.</div>
          )}
        </section>
      </section>
    </main>
  );
}

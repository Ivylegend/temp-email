"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AtSign, Gauge, Inbox, LogOut, RefreshCw, ShieldCheck, UserPlus, Users } from "lucide-react";
import { ClipLoader } from "react-spinners";
import { PasswordField } from "@/components/password-field";
import { APP_NAME } from "@/lib/config";
import { createClient } from "@/lib/supabase/browser";

type AdminUser = {
  id: string;
  email: string;
  displayName: string | null;
  emailConfirmed: boolean;
  createdAt: string;
  maxAliases: number | null;
  aliasesUsed: number;
  aliasesRemaining: number | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat([], {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [adminEmail, setAdminEmail] = useState("");
  const [email, setEmail] = useState("");
  const [maxAliases, setMaxAliases] = useState(100);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);

  const authorizedFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Your session has expired. Sign in again.");
      }

      return fetch(input, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${session.access_token}`
        }
      });
    },
    [supabase]
  );

  const loadUsers = useCallback(async () => {
    const response = await authorizedFetch("/api/admin/users", { cache: "no-store" });
    const payload = (await response.json()) as { users?: AdminUser[]; error?: string };

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        router.replace("/dashboard");
      }
      throw new Error(payload.error ?? "Could not load accounts.");
    }

    setUsers(payload.users ?? []);
  }, [authorizedFetch, router]);

  useEffect(() => {
    let active = true;

    async function boot() {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      if (user.app_metadata?.is_admin !== true) {
        router.replace("/dashboard");
        return;
      }

      setAdminEmail(user.email ?? "");

      try {
        await loadUsers();
      } catch (error) {
        if (active) {
          setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not load accounts." });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    boot();

    return () => {
      active = false;
    };
  }, [loadUsers, router, supabase]);

  const totals = useMemo(
    () => ({
      accounts: users.length,
      aliases: users.reduce((sum, user) => sum + user.aliasesUsed, 0),
      capacity: users.reduce((sum, user) => sum + (user.maxAliases ?? 0), 0)
    }),
    [users]
  );

  async function refreshUsers() {
    setRefreshing(true);
    setStatus(null);
    try {
      await loadUsers();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not refresh accounts." });
    } finally {
      setRefreshing(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") || "");

    setCreating(true);
    setStatus(null);

    try {
      const response = await authorizedFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, maxAliases })
      });
      const payload = (await response.json()) as { user?: AdminUser; error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create account.");
      }

      setEmail("");
      setMaxAliases(100);
      form.reset();
      setStatus({ type: "success", message: `${payload.user?.email ?? email} can now sign in with ${maxAliases} aliases.` });
      await loadUsers();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not create account." });
    } finally {
      setCreating(false);
    }
  }

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="loading-panel admin-loading">
        <ClipLoader color="currentColor" size={18} />
        Loading admin dashboard
      </main>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand-block">
          <span className="admin-brand-icon"><ShieldCheck size={18} /></span>
          <div>
            <div className="brand">{APP_NAME}</div>
            <div className="admin-kicker">Admin dashboard</div>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <span className="admin-email">{adminEmail}</span>
          <Link className="button secondary" href="/dashboard">
            <Inbox size={16} /> Email view
          </Link>
          <button className="button secondary" type="button" onClick={signOut} disabled={signingOut}>
            {signingOut ? <ClipLoader color="currentColor" size={15} /> : <LogOut size={15} />}
            Sign out
          </button>
        </div>
      </header>

      <main className="admin-main">
        <section className="admin-intro">
          <div>
            <p className="admin-eyebrow">Account control</p>
            <h1>Create and monitor access</h1>
            <p className="muted">Create confirmed user accounts, assign login passwords, and control each account&apos;s email alias capacity.</p>
          </div>
          <button className="button secondary" type="button" onClick={refreshUsers} disabled={refreshing}>
            {refreshing ? <ClipLoader color="currentColor" size={15} /> : <RefreshCw size={15} />}
            Refresh
          </button>
        </section>

        {status ? <div className={`status admin-status ${status.type}`}>{status.message}</div> : null}

        <section className="admin-stats" aria-label="Account summary">
          <article className="admin-stat-card">
            <span className="admin-stat-icon"><Users size={18} /></span>
            <div><strong>{totals.accounts}</strong><span>User accounts</span></div>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-icon"><AtSign size={18} /></span>
            <div><strong>{totals.aliases}</strong><span>Aliases claimed</span></div>
          </article>
          <article className="admin-stat-card">
            <span className="admin-stat-icon"><Gauge size={18} /></span>
            <div><strong>{totals.capacity}</strong><span>Total capacity</span></div>
          </article>
        </section>

        <section className="admin-grid">
          <article className="admin-card admin-create-card">
            <div className="admin-card-heading">
              <span className="admin-card-icon"><UserPlus size={18} /></span>
              <div><h2>New user account</h2><p>Create ready-to-use access in one step.</p></div>
            </div>

            <form className="admin-create-form" onSubmit={createUser}>
              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  autoComplete="off"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <PasswordField autoComplete="new-password" minLength={8} />
              <label>
                Email alias limit
                <input
                  type="number"
                  name="maxAliases"
                  min={1}
                  max={100000}
                  step={1}
                  value={maxAliases}
                  onChange={(event) => setMaxAliases(Number(event.target.value))}
                  required
                />
              </label>
              <p className="admin-form-note">Email confirmation is enabled automatically. Passwords are sent securely to Supabase and are never displayed again.</p>
              <button className="button admin-create-submit" type="submit" disabled={creating}>
                {creating ? <ClipLoader color="currentColor" size={16} /> : <UserPlus size={16} />}
                {creating ? "Creating account" : "Create account"}
              </button>
            </form>
          </article>

          <article className="admin-card admin-accounts-card">
            <div className="admin-card-heading admin-accounts-heading">
              <div><h2>Accounts</h2><p>Current access and alias usage.</p></div>
              <span className="admin-count-badge">{users.length}</span>
            </div>

            {users.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Account</th><th>Alias usage</th><th>Remaining</th><th>Created</th></tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const percentage = user.maxAliases ? Math.min((user.aliasesUsed / user.maxAliases) * 100, 100) : 0;
                      return (
                        <tr key={user.id}>
                          <td>
                            <div className="admin-account-cell">
                              <span className="admin-avatar">{user.email.slice(0, 1).toUpperCase()}</span>
                              <div><strong>{user.email}</strong><span>{user.emailConfirmed ? "Confirmed" : "Pending confirmation"}</span></div>
                            </div>
                          </td>
                          <td>
                            {user.maxAliases === null ? <span className="admin-no-limit">No limit assigned</span> : (
                              <div className="admin-usage-cell">
                                <span>{user.aliasesUsed} of {user.maxAliases}</span>
                                <span className="admin-progress"><span style={{ width: `${percentage}%` }} /></span>
                              </div>
                            )}
                          </td>
                          <td><strong>{user.aliasesRemaining ?? "—"}</strong></td>
                          <td><span className="admin-date">{formatDate(user.createdAt)}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div className="empty">No user accounts found.</div>}
          </article>
        </section>
      </main>
    </div>
  );
}

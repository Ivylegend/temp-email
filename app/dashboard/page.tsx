"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Inbox, LogOut } from "lucide-react";
import { ClipLoader } from "react-spinners";
import { RefreshLink } from "@/components/refresh-link";
import { ALIAS_DOMAIN, APP_NAME } from "@/lib/config";
import { createClient } from "@/lib/supabase/browser";
import type { Alias, Message } from "@/lib/types";
import { validatePrefix } from "@/lib/validation";
import { AliasSidebar } from "./alias-sidebar";
import { ClaimAliasForm } from "./claim-alias-form";
import { MessageList } from "./aliases/[id]/message-list";

type UserAliasLimit = {
  max_aliases: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedAliasId, setSelectedAliasId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [maxAliases, setMaxAliases] = useState<number | undefined>();
  const [status, setStatus] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAliasId, setDeletingAliasId] = useState<string | null>(null);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);

  const selectedAlias = aliases.find((alias) => alias.id === selectedAliasId) ?? null;
  const selectedIndex = selectedAliasId ? aliases.findIndex((alias) => alias.id === selectedAliasId) : -1;
  const prevAlias = selectedIndex > 0 ? aliases[selectedIndex - 1] : null;
  const nextAlias = selectedIndex >= 0 && selectedIndex < aliases.length - 1 ? aliases[selectedIndex + 1] : null;

  const loadAliases = useCallback(async () => {
    const { data, error } = await supabase
      .from("aliases")
      .select("id,prefix,user_id,created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const nextAliases = (data ?? []) as Alias[];
    setAliases(nextAliases);
    setSelectedAliasId((current) => {
      if (current && nextAliases.some((alias) => alias.id === current)) {
        return current;
      }
      return nextAliases[0]?.id ?? null;
    });
  }, [supabase]);

  const loadAliasLimit = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase
        .from("user_alias_limits")
        .select("max_aliases")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setMaxAliases((data as UserAliasLimit | null)?.max_aliases);
    },
    [supabase]
  );

  const loadMessages = useCallback(
    async (aliasId: string | null) => {
      if (!aliasId) {
        setMessages([]);
        return;
      }

      const { data, error } = await supabase
        .from("messages")
        .select(
          "id,alias_id,to_address,from_address,subject,body_text,body_html,spam_verdict,spam_score,received_at,created_at"
        )
        .eq("alias_id", aliasId)
        .order("received_at", { ascending: false });

      if (error) {
        throw error;
      }

      setMessages((data ?? []) as Message[]);
    },
    [supabase]
  );

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    setStatus(null);
    try {
      await loadAliases();
      await loadMessages(selectedAliasId);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not refresh." });
    } finally {
      setRefreshing(false);
    }
  }, [loadAliases, loadMessages, selectedAliasId]);

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

      setUserEmail(user.email ?? "");
      try {
        await Promise.all([loadAliases(), loadAliasLimit(user.id)]);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not load dashboard." });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    boot();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace("/login");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadAliasLimit, loadAliases, router, supabase]);

  useEffect(() => {
    loadMessages(selectedAliasId).catch((error) => {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not load messages." });
    });
  }, [loadMessages, selectedAliasId]);

  const checkAvailability = useCallback(
    async (rawPrefix: string) => {
      const { prefix, error } = validatePrefix(rawPrefix);

      if (error) {
        return { available: false, error };
      }

      const { data, error: rpcError } = await supabase.rpc("is_alias_available", {
        candidate_prefix: prefix
      });

      if (rpcError) {
        return { available: false, error: rpcError.message };
      }

      return { available: Boolean(data) };
    },
    [supabase]
  );

  async function claimAlias(rawPrefix: string) {
    const { prefix, error } = validatePrefix(rawPrefix);

    if (error) {
      setStatus({ type: "error", message: error });
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data, error: insertError } = await supabase
      .from("aliases")
      .insert({ prefix, user_id: user.id })
      .select("id,prefix,user_id,created_at")
      .single();

    if (insertError) {
      const message =
        insertError.code === "23505"
          ? "That alias is already claimed."
          : insertError.message.includes("Alias limit reached")
            ? "This account has reached its 100 alias limit."
            : insertError.message;
      setStatus({ type: "error", message });
      return;
    }

    const newAlias = data as Alias;
    setAliases((current) => [newAlias, ...current]);
    setSelectedAliasId(newAlias.id);
    setStatus({ type: "success", message: `${prefix}@${ALIAS_DOMAIN} is yours.` });
  }

  async function deleteAlias(aliasId: string) {
    setDeletingAliasId(aliasId);
    setStatus(null);
    const { error } = await supabase.from("aliases").delete().eq("id", aliasId);
    setDeletingAliasId(null);

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }

    setAliases((current) => current.filter((alias) => alias.id !== aliasId));
    setMessages([]);
    setSelectedAliasId((current) => (current === aliasId ? null : current));
    setStatus({ type: "success", message: "Alias deleted." });
  }

  async function deleteMessage(messageId: string) {
    setDeletingMessageId(messageId);
    setStatus(null);
    const { error } = await supabase.from("messages").delete().eq("id", messageId);
    setDeletingMessageId(null);

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }

    setMessages((current) => current.filter((message) => message.id !== messageId));
    setStatus({ type: "success", message: "Message deleted." });
  }

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="loading-panel">
        <ClipLoader color="currentColor" size={18} />
        Loading dashboard
      </main>
    );
  }

  return (
    <div className="split-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">{APP_NAME}</div>
          <button className="icon-btn-ghost" title="Sign out" type="button" disabled={signingOut} onClick={signOut}>
            {signingOut ? <ClipLoader color="currentColor" size={16} /> : <LogOut size={16} />}
          </button>
        </div>

        <div className="sidebar-user">{userEmail}</div>

        <ClaimAliasForm collapsed checkAvailability={checkAvailability} onClaim={claimAlias} />

        <AliasSidebar
          aliases={aliases}
          deletingAliasId={deletingAliasId}
          domain={ALIAS_DOMAIN}
          maxAliases={maxAliases}
          selectedAliasId={selectedAliasId}
          onDeleteAlias={deleteAlias}
          onSelectAlias={setSelectedAliasId}
        />
      </aside>

      <main className="mail-pane">
        {status ? <div className={`status ${status.type}`}>{status.message}</div> : null}
        {selectedAlias ? (
          <div className="mail-pane-content">
            <div className="pane-header">
              <div className="pane-header-left">
                <div className="alias-nav">
                  {prevAlias ? (
                    <button
                      type="button"
                      className="alias-nav-btn"
                      title={`Previous: ${prevAlias.prefix}@${ALIAS_DOMAIN}`}
                      onClick={() => setSelectedAliasId(prevAlias.id)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                  ) : (
                    <span className="alias-nav-btn disabled">
                      <ChevronLeft size={16} />
                    </span>
                  )}
                  {nextAlias ? (
                    <button
                      type="button"
                      className="alias-nav-btn"
                      title={`Next: ${nextAlias.prefix}@${ALIAS_DOMAIN}`}
                      onClick={() => setSelectedAliasId(nextAlias.id)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <span className="alias-nav-btn disabled">
                      <ChevronRight size={16} />
                    </span>
                  )}
                </div>

                <div>
                  <div className="pane-alias-address">
                    {selectedAlias.prefix}@{ALIAS_DOMAIN}
                  </div>
                  <div className="pane-alias-sub muted">
                    {messages.length} message{messages.length !== 1 ? "s" : ""}
                    {aliases.length > 1 && (
                      <span className="alias-nav-position">
                        {" "}· {selectedIndex + 1} of {aliases.length}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <RefreshLink label={refreshing ? "Refreshing" : "Refresh"} onRefresh={refreshDashboard} pending={refreshing} />
            </div>

            <div className="message-list">
              <MessageList
                deletingMessageId={deletingMessageId}
                messages={messages}
                onDeleteMessage={deleteMessage}
              />
            </div>
          </div>
        ) : (
          <div className="mail-pane-empty">
            <div className="mail-pane-placeholder">
              <Inbox size={48} className="placeholder-icon" />
              <p className="placeholder-title">Select an alias</p>
              <p className="placeholder-sub">Choose an alias from the left panel to view its messages.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

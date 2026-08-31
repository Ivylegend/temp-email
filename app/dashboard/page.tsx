"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Filter, Inbox, LogOut, Search, X } from "lucide-react";
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

type SearchFilter = "all" | "free-bonus" | "first-move-today" | "deposit-bonus-open";

const SEARCH_FILTERS: Array<{ key: SearchFilter; label: string }> = [
  { key: "all", label: "All mail" },
  { key: "free-bonus", label: "Free bonus" },
  { key: "first-move-today", label: "First move today" },
  { key: "deposit-bonus-open", label: "$10 no withdrawal" }
];

const FREE_BONUS_PHRASE = "claim your free bonus & start playing";
const FIRST_MOVE_PHRASE = "your first move starts here";
const DEPOSIT_BONUS_PHRASE = "free $10 deposit bonus for you!";

function messageText(message: Message, alias?: Alias) {
  return [
    alias ? `${alias.prefix}@${ALIAS_DOMAIN}` : "",
    message.to_address,
    message.from_address,
    message.subject,
    message.body_text,
    message.body_html?.replace(/<[^>]*>/g, " ")
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function messageSnippet(message: Message, maxLen = 130) {
  const raw =
    message.body_text?.trim() ||
    message.body_html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ||
    "";
  return raw.length > maxLen ? raw.slice(0, maxLen) + "..." : raw || "(No content)";
}

function isReceivedToday(message: Message) {
  const received = new Date(message.received_at);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return received >= start && received < end;
}

function formatSearchDate(iso: string) {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [selectedAliasId, setSelectedAliasId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
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
  const aliasById = useMemo(() => new Map(aliases.map((alias) => [alias.id, alias])), [aliases]);
  const selectedMessages = useMemo(
    () =>
      allMessages
        .filter((message) => message.alias_id === selectedAliasId)
        .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()),
    [allMessages, selectedAliasId]
  );

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
    return nextAliases;
  }, [supabase]);

  const loadMessagesForAliases = useCallback(
    async (nextAliases: Alias[]) => {
      const aliasIds = nextAliases.map((alias) => alias.id);

      if (!aliasIds.length) {
        setAllMessages([]);
        return [];
      }

      const nextMessages: Message[] = [];

      for (let index = 0; index < aliasIds.length; index += 100) {
        const { data, error } = await supabase
          .from("messages")
          .select(
            "id,alias_id,to_address,from_address,subject,body_text,body_html,spam_verdict,spam_score,read_at,archived_at,received_at,created_at"
          )
          .in("alias_id", aliasIds.slice(index, index + 100))
          .order("received_at", { ascending: false });

        if (error) {
          throw error;
        }

        nextMessages.push(...((data ?? []) as Message[]));
      }

      nextMessages.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
      setAllMessages(nextMessages);
      return nextMessages;
    },
    [supabase]
  );

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

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    setStatus(null);
    try {
      const nextAliases = await loadAliases();
      await loadMessagesForAliases(nextAliases);
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not refresh." });
    } finally {
      setRefreshing(false);
    }
  }, [loadAliases, loadMessagesForAliases]);

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
        const [nextAliases] = await Promise.all([loadAliases(), loadAliasLimit(user.id)]);
        await loadMessagesForAliases(nextAliases);
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
  }, [loadAliasLimit, loadAliases, loadMessagesForAliases, router, supabase]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const byAlias = new Map<string, Message[]>();

    for (const message of allMessages) {
      if (!byAlias.has(message.alias_id)) {
        byAlias.set(message.alias_id, []);
      }
      byAlias.get(message.alias_id)!.push(message);
    }

    return allMessages.filter((message) => {
      const alias = aliasById.get(message.alias_id);
      const text = messageText(message, alias);

      if (query && !text.includes(query)) {
        return false;
      }

      if (searchFilter === "free-bonus") {
        return text.includes(FREE_BONUS_PHRASE);
      }

      if (searchFilter === "first-move-today") {
        return text.includes(FIRST_MOVE_PHRASE) && isReceivedToday(message);
      }

      if (searchFilter === "deposit-bonus-open") {
        if (!text.includes(DEPOSIT_BONUS_PHRASE)) {
          return false;
        }

        const receivedAt = new Date(message.received_at).getTime();
        const hasWithdrawalAfter = (byAlias.get(message.alias_id) ?? []).some((candidate) => {
          return (
            new Date(candidate.received_at).getTime() > receivedAt &&
            messageText(candidate, alias).includes("withdrawal")
          );
        });

        return isReceivedToday(message) || !hasWithdrawalAfter;
      }

      return Boolean(query);
    });
  }, [aliasById, allMessages, searchFilter, searchQuery]);

  const searchAliasCount = useMemo(
    () => new Set(searchResults.map((message) => message.alias_id)).size,
    [searchResults]
  );
  const searchActive = Boolean(searchQuery.trim()) || searchFilter !== "all";

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
    setAllMessages((current) => current.filter((message) => message.alias_id !== aliasId));
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

    setAllMessages((current) => current.filter((message) => message.id !== messageId));
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
        <section className="search-panel" aria-label="Search messages">
          <div className="search-input-wrap">
            <Search size={16} className="search-input-icon" />
            <input
              className="search-input"
              placeholder="Search all email, aliases, senders, subjects, or body text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                className="search-clear-btn"
                title="Clear search"
                onClick={() => setSearchQuery("")}
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <div className="filter-row" aria-label="Quick filters">
            <span className="filter-label">
              <Filter size={14} />
              Filters
            </span>
            {SEARCH_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`filter-chip${searchFilter === filter.key ? " active" : ""}`}
                onClick={() => setSearchFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {searchActive ? (
            <div className="search-results">
              <div className="search-results-summary">
                {searchResults.length
                  ? `${searchResults.length} match${searchResults.length === 1 ? "" : "es"} across ${searchAliasCount} alias${searchAliasCount === 1 ? "" : "es"}`
                  : "No matching emails found"}
              </div>
              {searchResults.length ? (
                <ul className="search-results-list">
                  {searchResults.map((message) => {
                    const alias = aliasById.get(message.alias_id);
                    const address = alias ? `${alias.prefix}@${ALIAS_DOMAIN}` : message.to_address || "Unknown alias";
                    return (
                      <li key={message.id}>
                        <button
                          type="button"
                          className="search-result-row"
                          onClick={() => setSelectedAliasId(message.alias_id)}
                        >
                          <div className="search-result-meta">
                            <span className="search-result-address">{address}</span>
                            <span className="search-result-date">{formatSearchDate(message.received_at)}</span>
                          </div>
                          <div className="search-result-subject">{message.subject || "(No subject)"}</div>
                          <div className="search-result-snippet">{messageSnippet(message)}</div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>

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
                    {selectedMessages.length} message{selectedMessages.length !== 1 ? "s" : ""}
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
                messages={selectedMessages}
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

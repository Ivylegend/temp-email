import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { RefreshLink } from "@/components/refresh-link";
import { ALIAS_DOMAIN } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Alias, Message } from "@/lib/types";
import { MessageList } from "./message-list";

export default async function AliasPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch current alias
  const { data: alias, error: aliasError } = await supabase
    .from("aliases")
    .select("id,prefix,user_id,created_at")
    .eq("id", id)
    .single();

  if (aliasError || !alias) {
    notFound();
  }

  // Fetch all aliases (for prev/next nav)
  const { data: allAliases } = await supabase
    .from("aliases")
    .select("id,prefix")
    .order("created_at", { ascending: false });

  const aliases = (allAliases ?? []) as Pick<Alias, "id" | "prefix">[];
  const currentIndex = aliases.findIndex((a) => a.id === id);
  const prevAlias = currentIndex > 0 ? aliases[currentIndex - 1] : null;
  const nextAlias = currentIndex < aliases.length - 1 ? aliases[currentIndex + 1] : null;

  // Fetch messages for this alias
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select(
      "id,alias_id,to_address,from_address,subject,body_text,body_html,spam_verdict,spam_score,received_at,created_at"
    )
    .eq("alias_id", id)
    .order("received_at", { ascending: false });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const currentAlias = alias as Alias;
  const messageList = (messages ?? []) as Message[];

  return (
    <div className="mail-pane-content">
      {/* ── Pane header ── */}
      <div className="pane-header">
        <div className="pane-header-left">
          {/* Prev / Next alias navigation */}
          <div className="alias-nav">
            {prevAlias ? (
              <Link
                href={`/dashboard/aliases/${prevAlias.id}`}
                className="alias-nav-btn"
                title={`Previous: ${prevAlias.prefix}@${ALIAS_DOMAIN}`}
              >
                <ChevronLeft size={16} />
              </Link>
            ) : (
              <span className="alias-nav-btn disabled">
                <ChevronLeft size={16} />
              </span>
            )}
            {nextAlias ? (
              <Link
                href={`/dashboard/aliases/${nextAlias.id}`}
                className="alias-nav-btn"
                title={`Next: ${nextAlias.prefix}@${ALIAS_DOMAIN}`}
              >
                <ChevronRight size={16} />
              </Link>
            ) : (
              <span className="alias-nav-btn disabled">
                <ChevronRight size={16} />
              </span>
            )}
          </div>

          <div>
            <div className="pane-alias-address">
              {currentAlias.prefix}@{ALIAS_DOMAIN}
            </div>
            <div className="pane-alias-sub muted">
              {messageList.length} message{messageList.length !== 1 ? "s" : ""}
              {aliases.length > 1 && (
                <span className="alias-nav-position">
                  {" "}· {currentIndex + 1} of {aliases.length}
                </span>
              )}
            </div>
          </div>
        </div>

        <RefreshLink label="Refresh" />
      </div>

      {query.error ? <div className="status error">{query.error}</div> : null}
      {query.success ? <div className="status success">{query.success}</div> : null}

      {/* ── Message list (preview → full view handled client-side) ── */}
      <div className="message-list">
        <MessageList messages={messageList} aliasId={id} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ShieldAlert, Trash2 } from "lucide-react";
import { RefreshLink } from "@/components/refresh-link";
import { SubmitButton } from "@/components/submit-button";
import { ALIAS_DOMAIN } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Alias, Message } from "@/lib/types";
import { deleteMessage } from "./actions";
import { MessageBody } from "./message-body";

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

  // Fetch all aliases (for prev/next nav) — same query as layout, will be cache-hit
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
          {/* Prev/Next nav — always visible, especially useful on mobile */}
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

      {/* ── Message list ── */}
      <div className="message-list">
        {messageList.length ? (
          messageList.map((message) => (
            <article className="message-item" key={message.id}>
              <div className="message-meta">
                <span>From: {message.from_address || "Unknown"}</span>
                {message.to_address ? <span>To: {message.to_address}</span> : null}
                <span>{new Date(message.received_at).toLocaleString()}</span>
                {isSpam(message) ? (
                  <span className="spam-badge">
                    <ShieldAlert size={14} />
                    Spam flagged{message.spam_score ? ` (${message.spam_score})` : ""}
                  </span>
                ) : null}
              </div>
              <div className="message-subject">{message.subject || "(No subject)"}</div>

              {/* Renders HTML in sandboxed iframe, plain text otherwise */}
              <MessageBody html={message.body_html} text={message.body_text} />

              <form action={deleteMessage} className="button-row section">
                <input type="hidden" name="message_id" value={message.id} />
                <input type="hidden" name="alias_id" value={id} />
                <SubmitButton className="button danger" title="Delete message" pendingText="Deleting">
                  <Trash2 size={18} />
                  Delete
                </SubmitButton>
              </form>
            </article>
          ))
        ) : (
          <div className="empty">No messages received yet.</div>
        )}
      </div>
    </div>
  );
}

function isSpam(message: Message) {
  return /spam|yes|fail/i.test(`${message.spam_verdict || ""} ${message.spam_score || ""}`);
}

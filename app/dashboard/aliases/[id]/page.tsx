import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert, Trash2 } from "lucide-react";
import { RefreshLink } from "@/components/refresh-link";
import { SubmitButton } from "@/components/submit-button";
import { ALIAS_DOMAIN } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Alias, Message } from "@/lib/types";
import { deleteMessage } from "./actions";

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

  const { data: alias, error: aliasError } = await supabase
    .from("aliases")
    .select("id,prefix,user_id,created_at")
    .eq("id", id)
    .single();

  if (aliasError || !alias) {
    notFound();
  }

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id,alias_id,to_address,from_address,subject,body_text,body_html,spam_verdict,spam_score,received_at,created_at")
    .eq("alias_id", id)
    .order("received_at", { ascending: false });

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  const currentAlias = alias as Alias;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="brand">{currentAlias.prefix}@{ALIAS_DOMAIN}</div>
          <div className="muted">{user.email}</div>
        </div>
        <div className="button-row">
          <Link className="button secondary" href="/dashboard" title="Back to dashboard">
            <ArrowLeft size={18} />
            Back
          </Link>
          <RefreshLink label="Refresh" />
        </div>
      </header>

      <section className="page">
        <h1>Messages</h1>
        <p className="muted">Mail captured for this alias.</p>
        {query.error ? <div className="status error">{query.error}</div> : null}
        {query.success ? <div className="status success">{query.success}</div> : null}

        <section className="section message-list">
          {(messages as Message[] | null)?.length ? (
            (messages as Message[]).map((message) => (
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
                <div className="message-body">
                  {message.body_text || stripHtml(message.body_html) || "(No readable body)"}
                </div>
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
        </section>
      </section>
    </main>
  );
}

function stripHtml(value: string | null) {
  return value?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isSpam(message: Message) {
  return /spam|yes|fail/i.test(`${message.spam_verdict || ""} ${message.spam_score || ""}`);
}

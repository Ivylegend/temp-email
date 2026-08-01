"use client";

import { useState } from "react";
import { ArrowLeft, ShieldAlert, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import type { Message } from "@/lib/types";
import { deleteMessage } from "./actions";
import { MessageBody } from "./message-body";

interface Props {
  messages: Message[];
  aliasId: string;
}

/** Returns a plain-text snippet of the email body for preview rows */
function snippet(message: Message, maxLen = 120): string {
  const raw =
    message.body_text?.trim() ||
    message.body_html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() ||
    "";
  return raw.length > maxLen ? raw.slice(0, maxLen) + "…" : raw || "(No content)";
}

function isSpam(message: Message) {
  return /spam|yes|fail/i.test(
    `${message.spam_verdict || ""} ${message.spam_score || ""}`
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  return isToday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function MessageList({ messages, aliasId }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openMessage = messages.find((m) => m.id === openId) ?? null;

  /* ── Full email view ── */
  if (openMessage) {
    return (
      <div className="msg-viewer">
        {/* Back to inbox */}
        <button
          type="button"
          className="msg-back-btn"
          onClick={() => setOpenId(null)}
        >
          <ArrowLeft size={15} />
          Back to inbox
        </button>

        {/* Header */}
        <div className="msg-viewer-header">
          <div className="msg-viewer-subject">
            {openMessage.subject || "(No subject)"}
          </div>
          <div className="msg-viewer-meta">
            <span>
              <span className="msg-viewer-meta-label">From</span>{" "}
              {openMessage.from_address || "Unknown"}
            </span>
            {openMessage.to_address && (
              <span>
                <span className="msg-viewer-meta-label">To</span>{" "}
                {openMessage.to_address}
              </span>
            )}
            <span>{new Date(openMessage.received_at).toLocaleString()}</span>
            {isSpam(openMessage) && (
              <span className="spam-badge">
                <ShieldAlert size={13} />
                Spam{openMessage.spam_score ? ` (${openMessage.spam_score})` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="msg-viewer-body">
          <MessageBody html={openMessage.body_html} text={openMessage.body_text} />
        </div>

        {/* Delete */}
        <form action={deleteMessage} className="msg-viewer-actions">
          <input type="hidden" name="message_id" value={openMessage.id} />
          <input type="hidden" name="alias_id" value={aliasId} />
          <SubmitButton
            className="button danger"
            title="Delete message"
            pendingText="Deleting…"
          >
            <Trash2 size={15} />
            Delete
          </SubmitButton>
        </form>
      </div>
    );
  }

  /* ── Preview list ── */
  if (!messages.length) {
    return <div className="empty">No messages received yet.</div>;
  }

  return (
    <ul className="msg-preview-list">
      {messages.map((msg) => (
        <li key={msg.id}>
          <button
            type="button"
            className="msg-preview-row"
            onClick={() => setOpenId(msg.id)}
          >
            {/* Sender */}
            <div className="msg-preview-top">
              <span className="msg-preview-from">
                {msg.from_address || "Unknown sender"}
              </span>
              <span className="msg-preview-date">{formatDate(msg.received_at)}</span>
            </div>

            {/* Subject */}
            <div className="msg-preview-subject">
              {msg.subject || "(No subject)"}
              {isSpam(msg) && (
                <span className="spam-badge" style={{ marginLeft: 8, fontSize: 11 }}>
                  <ShieldAlert size={12} /> Spam
                </span>
              )}
            </div>

            {/* Body snippet */}
            <div className="msg-preview-snippet">{snippet(msg)}</div>
          </button>
        </li>
      ))}
    </ul>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { ALIAS_DOMAIN } from "@/lib/config";
import { claimAlias } from "./actions";

interface Props {
  /** When true, the form hides behind a + button and slides open on click */
  collapsed?: boolean;
}

export function ClaimAliasForm({ collapsed = false }: Props) {
  const [open, setOpen] = useState(!collapsed);
  const [prefix, setPrefix] = useState("");
  const formRef = React.useRef<HTMLFormElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && state === "available") {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }
  const [state, setState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [message, setMessage] = useState("");

  const normalized = useMemo(() => prefix.trim().toLowerCase(), [prefix]);

  useEffect(() => {
    if (!normalized) {
      setState("idle");
      setMessage("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("checking");
      try {
        const response = await fetch(`/api/aliases/check?prefix=${encodeURIComponent(normalized)}`, {
          signal: controller.signal
        });
        const payload = await response.json();

        if (!response.ok) {
          setState("invalid");
          setMessage(payload.error || "Could not check that prefix.");
          return;
        }

        setState(payload.available ? "available" : "taken");
        setMessage(
          payload.available
            ? `${payload.prefix}@${ALIAS_DOMAIN} is available.`
            : "That alias is already claimed."
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setState("invalid");
          setMessage("Could not check that prefix.");
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [normalized]);

  if (collapsed) {
    return (
      <div className="claim-collapsed">
        {!open ? (
          <button
            type="button"
            className="claim-toggle-btn"
            title="Claim new alias"
            onClick={() => setOpen(true)}
          >
            <Plus size={15} />
            New alias
          </button>
        ) : (
          <div className="claim-drawer">
            <div className="claim-drawer-header">
              <span className="claim-drawer-title">New alias</span>
              <button
                type="button"
                className="icon-btn-ghost"
                title="Close"
                onClick={() => {
                  setOpen(false);
                  setPrefix("");
                }}
              >
                <X size={15} />
              </button>
            </div>
            <form ref={formRef} action={claimAlias} className="claim-form-inline">
              <input
                name="prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="alice123"
                autoComplete="off"
                required
                className="claim-input"
              />
              <div className="claim-domain-label">@{ALIAS_DOMAIN}</div>
              {message ? (
                <span className={`hint ${state}`}>
                  {iconForState(state)} {message}
                </span>
              ) : null}
              <SubmitButton
                disabled={state === "checking" || state === "taken" || state === "invalid"}
                title="Claim alias"
                pendingText="Claiming…"
                className="button claim-submit-btn"
              >
                <Plus size={15} />
                Claim
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Original non-collapsed layout (kept for backwards compat)
  return (
    <form action={claimAlias} className="claim-form">
      <label>
        New prefix
        <input
          name="prefix"
          value={prefix}
          onChange={(event) => setPrefix(event.target.value)}
          placeholder="alice123"
          autoComplete="off"
          required
        />
        {message ? <span className={`hint ${state}`}>{iconForState(state)} {message}</span> : null}
      </label>
      <SubmitButton
        disabled={state === "checking" || state === "taken" || state === "invalid"}
        title="Claim alias"
        pendingText="Claiming"
      >
        <Plus size={18} />
        Claim
      </SubmitButton>
    </form>
  );
}

function iconForState(state: string) {
  if (state === "checking") return <Loader2 size={14} />;
  if (state === "available") return <Check size={14} />;
  if (state === "taken" || state === "invalid") return <X size={14} />;
  return null;
}

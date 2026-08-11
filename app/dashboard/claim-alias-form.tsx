"use client";

import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { ClipLoader } from "react-spinners";
import { ALIAS_DOMAIN } from "@/lib/config";

interface Props {
  collapsed?: boolean;
  onClaim: (prefix: string) => Promise<void>;
  checkAvailability: (prefix: string) => Promise<{ available: boolean; error?: string }>;
}

export function ClaimAliasForm({ collapsed = false, onClaim, checkAvailability }: Props) {
  const [open, setOpen] = useState(!collapsed);
  const prefixInputRef = useRef<HTMLInputElement>(null);
  const [prefix, setPrefix] = useState("");
  const [state, setState] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-focus the prefix input when the drawer opens
  useEffect(() => {
    if (open && collapsed) {
      const t = setTimeout(() => prefixInputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open, collapsed]);

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
        const payload = await checkAvailability(normalized);

        if (controller.signal.aborted) {
          return;
        }

        if (payload.error) {
          setState("invalid");
          setMessage(payload.error);
          return;
        }

        setState(payload.available ? "available" : "taken");
        setMessage(
          payload.available
            ? `${normalized}@${ALIAS_DOMAIN} is available.`
            : "That alias is already claimed."
        );
      } catch {
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
  }, [checkAvailability, normalized]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (state !== "available") {
      return;
    }

    setSubmitting(true);
    try {
      await onClaim(normalized);
      setPrefix("");
      setState("idle");
      setMessage("");
      if (collapsed) {
        setOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

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
            <AliasFormBody
              handleSubmit={handleSubmit}
              message={message}
              prefixInputRef={prefixInputRef}
              prefix={prefix}
              setPrefix={setPrefix}
              state={state}
              submitting={submitting}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="claim-form">
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
      <SubmitAliasButton state={state} submitting={submitting} />
    </form>
  );
}

function AliasFormBody({
  handleSubmit,
  message,
  prefix,
  prefixInputRef,
  setPrefix,
  state,
  submitting
}: {
  handleSubmit: (event: FormEvent<HTMLFormElement>) => void;
  message: string;
  prefix: string;
  prefixInputRef?: RefObject<HTMLInputElement | null>;
  setPrefix: (value: string) => void;
  state: "idle" | "checking" | "available" | "taken" | "invalid";
  submitting: boolean;
}) {
  return (
    <form onSubmit={handleSubmit} className="claim-form-inline">
      <input
        ref={prefixInputRef}
        name="prefix"
        value={prefix}
        onChange={(event) => setPrefix(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && state === "available") {
            (event.currentTarget.form as HTMLFormElement).requestSubmit();
          }
        }}
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
      <SubmitAliasButton className="button claim-submit-btn" state={state} submitting={submitting} />
    </form>
  );
}

function SubmitAliasButton({
  className = "button",
  state,
  submitting
}: {
  className?: string;
  state: string;
  submitting: boolean;
}) {
  return (
    <button
      disabled={submitting || state === "checking" || state === "taken" || state === "invalid"}
      title="Claim alias"
      type="submit"
      className={className}
    >
      {submitting ? (
        <>
          <ClipLoader color="currentColor" size={15} />
          Claiming
        </>
      ) : (
        <>
          <Plus size={15} />
          Claim
        </>
      )}
    </button>
  );
}

function iconForState(state: string) {
  if (state === "checking") return <Loader2 size={14} />;
  if (state === "available") return <Check size={14} />;
  if (state === "taken" || state === "invalid") return <X size={14} />;
  return null;
}

"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogIn } from "lucide-react";
import { ClipLoader } from "react-spinners";
import { PasswordField } from "@/components/password-field";
import { APP_NAME } from "@/lib/config";
import { createClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        router.replace("/dashboard");
        return;
      }
      setCheckingSession(false);
    });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") || "");
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/dashboard");
  }

  if (checkingSession) {
    return (
      <main className="loading-panel">
        <ClipLoader color="currentColor" size={18} />
        Loading
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand">{APP_NAME}</div>
        <h1>Sign in</h1>
        <p className="muted">Invite-only access for the friend group.</p>
        <form onSubmit={handleSubmit} className="form-grid">
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <PasswordField />
          <button className="button" type="submit" title="Sign in" disabled={submitting}>
            {submitting ? (
              <>
                <ClipLoader color="currentColor" size={16} />
                Signing in
              </>
            ) : (
              <>
                <LogIn size={18} />
                Sign in
              </>
            )}
          </button>
        </form>
        {error ? (
          <div className="status error">
            <KeyRound size={16} /> {error}
          </div>
        ) : null}
      </section>
    </main>
  );
}

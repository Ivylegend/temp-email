import { redirect } from "next/navigation";
import { KeyRound, LogIn } from "lucide-react";
import { PasswordField } from "@/components/password-field";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand">icha.ng aliases</div>
        <h1>Sign in</h1>
        <p className="muted">Invite-only access for the friend group.</p>
        <form action={signIn} className="form-grid">
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <PasswordField />
          <SubmitButton title="Sign in" pendingText="Signing in">
            <LogIn size={18} />
            Sign in
          </SubmitButton>
        </form>
        {searchParams.error ? (
          <div className="status error">
            <KeyRound size={16} /> {searchParams.error}
          </div>
        ) : null}
      </section>
    </main>
  );
}

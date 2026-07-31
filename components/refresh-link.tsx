"use client";

import { useRouter } from "next/navigation";
import { ClipLoader } from "react-spinners";
import { RefreshCw } from "lucide-react";
import { useTransition } from "react";

export function RefreshLink({ label = "Refresh" }: { href?: string; label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="button secondary"
      onClick={() => startTransition(() => router.refresh())}
      title={label}
      type="button"
      disabled={pending}
    >
      {pending ? <ClipLoader color="currentColor" size={16} /> : <RefreshCw size={18} />}
      {pending ? "Refreshing" : label}
    </button>
  );
}

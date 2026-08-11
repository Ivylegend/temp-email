"use client";

import { ClipLoader } from "react-spinners";
import { RefreshCw } from "lucide-react";
import { useTransition } from "react";

export function RefreshLink({
  label = "Refresh",
  onRefresh,
  pending: controlledPending
}: {
  href?: string;
  label?: string;
  onRefresh?: () => Promise<void> | void;
  pending?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const isPending = controlledPending ?? pending;

  return (
    <button
      className="button secondary"
      onClick={() => {
        if (onRefresh) {
          startTransition(() => {
            void onRefresh();
          });
        } else {
          window.location.reload();
        }
      }}
      title={label}
      type="button"
      disabled={isPending}
    >
      {isPending ? <ClipLoader color="currentColor" size={16} /> : <RefreshCw size={18} />}
      {isPending ? "Refreshing" : label}
    </button>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  /** How often to silently refresh server data, in ms. Default: 15 000 (15s) */
  intervalMs?: number;
}

/**
 * Invisible component that calls router.refresh() on an interval.
 * This re-fetches all server component data on the page (messages, etc.)
 * without a full page reload, so new emails appear automatically.
 */
export function AutoRefresh({ intervalMs = 15000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}

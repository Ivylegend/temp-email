"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipLoader } from "react-spinners";
import { createClient } from "@/lib/supabase/browser";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      router.replace(data.user ? "/dashboard" : "/login");
    });
  }, [router]);

  return (
    <main className="loading-panel">
      <ClipLoader color="currentColor" size={18} />
      Loading
    </main>
  );
}

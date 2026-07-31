"use client";

import { ClipLoader } from "react-spinners";

export default function Loading() {
  return (
    <main className="shell">
      <section className="page loading-panel">
        <ClipLoader color="#1f7a5a" size={24} />
        <span>Loading</span>
      </section>
    </main>
  );
}

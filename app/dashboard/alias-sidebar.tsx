"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Inbox } from "lucide-react";
import type { Alias } from "@/lib/types";

interface Props {
  aliases: Alias[];
  domain: string;
}

export function AliasSidebar({ aliases, domain }: Props) {
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;

  if (!aliases?.length) {
    return <div className="sidebar-empty">No aliases yet.</div>;
  }

  return (
    <nav className="sidebar-alias-list">
      {aliases.map((alias) => {
        const isActive = alias.id === activeId;
        return (
          <Link
            key={alias.id}
            href={`/dashboard/aliases/${alias.id}`}
            className={`sidebar-alias-item${isActive ? " active" : ""}`}
            title={`${alias.prefix}@${domain}`}
          >
            <Inbox size={15} className="sidebar-alias-icon" />
            <div className="sidebar-alias-info">
              <div className="sidebar-alias-prefix">{alias.prefix}</div>
              <div className="sidebar-alias-domain">@{domain}</div>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, FolderOpen, Inbox, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Alias, Group } from "@/lib/types";
import { AliasMenu } from "./alias-menu";
import { createGroup, deleteGroup } from "./actions";

interface Props {
  aliases: Alias[];
  groups: Group[];
  domain: string;
}

function AliasRow({
  alias,
  domain,
  activeId,
  groups
}: {
  alias: Alias;
  domain: string;
  activeId: string | undefined;
  groups: Group[];
}) {
  const isActive = alias.id === activeId;
  return (
    <div className={`sidebar-alias-item${isActive ? " active" : ""}`}>
      <Link
        href={`/dashboard/aliases/${alias.id}`}
        className="sidebar-alias-link"
        title={`${alias.prefix}@${domain}`}
      >
        <Inbox size={14} className="sidebar-alias-icon" />
        <div className="sidebar-alias-info">
          <div className="sidebar-alias-prefix">{alias.prefix}</div>
          <div className="sidebar-alias-domain">@{domain}</div>
        </div>
      </Link>
      <AliasMenu alias={alias} groups={groups} />
    </div>
  );
}

export function AliasSidebar({ aliases, groups, domain }: Props) {
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;

  // New group form state
  const [showNewGroup, setShowNewGroup] = useState(false);

  const ungrouped = aliases.filter((a) => !a.group_id);

  return (
    <>
      {/* Scrollable list fills remaining height */}
      <nav className="sidebar-alias-list">
        {/* ── Ungrouped aliases ── */}
        {ungrouped.length === 0 && groups.length === 0 && (
          <div className="sidebar-empty">No aliases yet.</div>
        )}

        {ungrouped.map((alias) => (
          <AliasRow
            key={alias.id}
            alias={alias}
            domain={domain}
            activeId={activeId}
            groups={groups}
          />
        ))}

        {/* ── Groups ── */}
        {groups.map((group) => {
          const groupAliases = aliases.filter((a) => a.group_id === group.id);
          return (
            <details key={group.id} className="sidebar-group" open>
              <summary className="sidebar-group-header">
                <ChevronRight size={13} className="sidebar-group-chevron" />
                <FolderOpen size={14} className="sidebar-group-icon" />
                <span className="sidebar-group-name">{group.name}</span>
                <span className="sidebar-group-count">{groupAliases.length}</span>

                {/* Delete group */}
                <form
                  action={deleteGroup}
                  onClick={(e) => e.stopPropagation()}
                  className="sidebar-group-delete-form"
                >
                  <input type="hidden" name="group_id" value={group.id} />
                  <button
                    type="submit"
                    className="sidebar-group-delete-btn"
                    title="Delete group"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 size={12} />
                  </button>
                </form>
              </summary>

              <div className="sidebar-group-body">
                {groupAliases.length === 0 ? (
                  <div className="sidebar-group-empty">No aliases in this group.</div>
                ) : (
                  groupAliases.map((alias) => (
                    <AliasRow
                      key={alias.id}
                      alias={alias}
                      domain={domain}
                      activeId={activeId}
                      groups={groups}
                    />
                  ))
                )}
              </div>
            </details>
          );
        })}
      </nav>

      {/* ── Floating footer — always pinned to sidebar bottom ── */}
      <div className="sidebar-footer">
        {showNewGroup ? (
          <form
            action={async (fd) => {
              await createGroup(fd);
              setShowNewGroup(false);
            }}
            className="new-group-form"
          >
            <input
              name="name"
              placeholder="Group name…"
              autoFocus
              className="new-group-input"
              required
              onKeyDown={(e) => e.key === "Escape" && setShowNewGroup(false)}
            />
            <div className="new-group-actions">
              <button type="submit" className="new-group-submit">Create</button>
              <button
                type="button"
                className="new-group-cancel"
                onClick={() => setShowNewGroup(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="new-group-btn"
            onClick={() => setShowNewGroup(true)}
          >
            <FolderOpen size={14} />
            New group
          </button>
        )}
      </div>
    </>
  );
}

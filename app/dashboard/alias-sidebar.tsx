"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChevronRight,
  FolderOpen,
  Inbox,
  MoreHorizontal,
  Plus,
  Trash2,
  X
} from "lucide-react";
import type { Alias } from "@/lib/types";
import { deleteAlias } from "./actions";

/* ── Local group type (stored in localStorage) ─────────────── */
interface LocalGroup {
  id: string;
  name: string;
  aliasIds: string[];
}

const STORAGE_KEY = "alias-groups-v1";

function loadGroups(): LocalGroup[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveGroups(groups: LocalGroup[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
}

/* ── Portal context menu ───────────────────────────────────── */
interface CtxMenuProps {
  alias: Alias;
  groups: LocalGroup[];
  aliasGroup: LocalGroup | null;
  anchorRect: DOMRect;
  onAssign: (groupId: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

function CtxMenu({
  alias,
  groups,
  aliasGroup,
  anchorRect,
  onAssign,
  onRemove,
  onClose
}: CtxMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="alias-ctx-menu"
      style={{ position: "fixed", top: anchorRect.bottom + 4, left: anchorRect.left, zIndex: 9999 }}
    >
      {groups.length > 0 && (
        <>
          <div className="alias-ctx-section">Move to group</div>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`alias-ctx-item${aliasGroup?.id === g.id ? " current" : ""}`}
              onClick={() => { onAssign(g.id); onClose(); }}
            >
              <FolderOpen size={13} />
              {g.name}
            </button>
          ))}
          {aliasGroup && (
            <button
              type="button"
              className="alias-ctx-item"
              onClick={() => { onRemove(); onClose(); }}
            >
              <X size={13} />
              Remove from group
            </button>
          )}
          <div className="alias-ctx-divider" />
        </>
      )}
      <form action={deleteAlias}>
        <input type="hidden" name="alias_id" value={alias.id} />
        <button type="submit" className="alias-ctx-item danger">
          <Trash2 size={13} />
          Delete alias
        </button>
      </form>
    </div>,
    document.body
  );
}

/* ── Main sidebar ──────────────────────────────────────────── */
interface Props {
  aliases: Alias[];
  domain: string;
}

export function AliasSidebar({ aliases, domain }: Props) {
  const params = useParams<{ id?: string }>();
  const activeId = params?.id;

  const [groups, setGroups] = useState<LocalGroup[]>([]);
  const [mounted, setMounted] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ aliasId: string; rect: DOMRect } | null>(null);

  const newGroupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setGroups(loadGroups());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (newGroupOpen) {
      const t = setTimeout(() => newGroupInputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [newGroupOpen]);

  /* ── Group mutations ── */
  const updateGroups = useCallback((next: LocalGroup[]) => {
    setGroups(next);
    saveGroups(next);
  }, []);

  function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    updateGroups([...groups, { id: crypto.randomUUID(), name, aliasIds: [] }]);
    setNewGroupName("");
    setNewGroupOpen(false);
  }

  function deleteGroup(group: LocalGroup) {
    if (!confirm(`Delete group "${group.name}"? Aliases will become ungrouped.`)) return;
    updateGroups(groups.filter((g) => g.id !== group.id));
  }

  function assignToGroup(aliasId: string, groupId: string) {
    updateGroups(
      groups.map((g) => ({
        ...g,
        aliasIds:
          g.id === groupId
            ? [...g.aliasIds.filter((id) => id !== aliasId), aliasId]
            : g.aliasIds.filter((id) => id !== aliasId)
      }))
    );
  }

  function removeFromGroup(aliasId: string) {
    updateGroups(groups.map((g) => ({ ...g, aliasIds: g.aliasIds.filter((id) => id !== aliasId) })));
  }

  /* ── Derived data ── */
  const groupedIds = new Set(mounted ? groups.flatMap((g) => g.aliasIds) : []);
  const ungrouped = aliases.filter((a) => !groupedIds.has(a.id));

  function getGroupAliases(g: LocalGroup) {
    return g.aliasIds.map((id) => aliases.find((a) => a.id === id)).filter(Boolean) as Alias[];
  }

  function getAliasGroup(aliasId: string) {
    return (mounted ? groups.find((g) => g.aliasIds.includes(aliasId)) : undefined) ?? null;
  }

  /* ── Context menu state ── */
  const ctxAlias = ctxMenu ? (aliases.find((a) => a.id === ctxMenu.aliasId) ?? null) : null;
  const ctxGroup = ctxAlias ? getAliasGroup(ctxAlias.id) : null;

  /* ── Alias row ── */
  function AliasRow({ alias, indented = false }: { alias: Alias; indented?: boolean }) {
    const isActive = alias.id === activeId;
    return (
      <div className={`alias-row-wrap${indented ? " indented" : ""}`}>
        <Link
          href={`/dashboard/aliases/${alias.id}`}
          className={`sidebar-alias-item${isActive ? " active" : ""}`}
          title={`${alias.prefix}@${domain}`}
        >
          <Inbox size={14} className="sidebar-alias-icon" />
          <div className="sidebar-alias-info">
            <div className="sidebar-alias-prefix">{alias.prefix}</div>
            <div className="sidebar-alias-domain">@{domain}</div>
          </div>
        </Link>
        <button
          type="button"
          className="alias-more-btn"
          title="Options"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            setCtxMenu((prev) => (prev?.aliasId === alias.id ? null : { aliasId: alias.id, rect }));
          }}
        >
          <MoreHorizontal size={13} />
        </button>
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="sidebar-body">
      {/* Scrollable area */}
      <nav className="sidebar-scroll-area">
        {!aliases?.length && <div className="sidebar-empty">No aliases yet.</div>}

        {/* Ungrouped aliases */}
        {ungrouped.map((alias) => (
          <AliasRow key={alias.id} alias={alias} />
        ))}

        {/* Groups */}
        {mounted &&
          groups.map((group) => {
            const groupAliases = getGroupAliases(group);
            return (
              <details key={group.id} className="sidebar-group">
                <summary className="sidebar-group-header">
                  <ChevronRight size={12} className="group-chevron" />
                  <FolderOpen size={13} className="group-folder-icon" />
                  <span className="sidebar-group-name">{group.name}</span>
                  <span className="sidebar-group-count">{groupAliases.length}</span>
                  <button
                    type="button"
                    className="group-delete-btn"
                    title="Delete group"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteGroup(group);
                    }}
                  >
                    <X size={11} />
                  </button>
                </summary>
                <div className="sidebar-group-body">
                  {groupAliases.length ? (
                    groupAliases.map((alias) => <AliasRow key={alias.id} alias={alias} indented />)
                  ) : (
                    <div className="sidebar-group-empty">Use ··· on an alias to add it here</div>
                  )}
                </div>
              </details>
            );
          })}
      </nav>

      {/* Floating footer — always visible, never scrolls away */}
      <div className="sidebar-footer">
        {newGroupOpen ? (
          <div className="new-group-form">
            <input
              ref={newGroupInputRef}
              type="text"
              className="new-group-input"
              placeholder="Group name…"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createGroup();
                if (e.key === "Escape") {
                  setNewGroupOpen(false);
                  setNewGroupName("");
                }
              }}
            />
            <div className="new-group-btns">
              <button type="button" className="button new-group-save-btn" onClick={createGroup}>
                Create
              </button>
              <button
                type="button"
                className="icon-btn-ghost"
                onClick={() => {
                  setNewGroupOpen(false);
                  setNewGroupName("");
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="new-group-btn" onClick={() => setNewGroupOpen(true)}>
            <Plus size={13} />
            New group
          </button>
        )}
      </div>

      {/* Portal context menu (rendered outside scroll area to avoid clipping) */}
      {ctxMenu && ctxAlias && (
        <CtxMenu
          alias={ctxAlias}
          groups={groups}
          aliasGroup={ctxGroup}
          anchorRect={ctxMenu.rect}
          onAssign={(groupId) => assignToGroup(ctxAlias.id, groupId)}
          onRemove={() => removeFromGroup(ctxAlias.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

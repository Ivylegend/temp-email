"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  ChevronRight,
  FolderOpen,
  Inbox,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  X
} from "lucide-react";
import type { Alias } from "@/lib/types";

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
  deletingAliasId?: string | null;
  onAssign: (groupId: string) => void;
  onDeleteAlias: (aliasId: string) => Promise<void>;
  onRemove: () => void;
  onClose: () => void;
}

function CtxMenu({
  alias,
  groups,
  aliasGroup,
  anchorRect,
  deletingAliasId,
  onAssign,
  onDeleteAlias,
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

  // Position: try to open to the right of the button, fall back left if near edge
  const left = Math.min(anchorRect.left, window.innerWidth - 196);

  return createPortal(
    <div
      ref={ref}
      className="alias-ctx-menu"
      style={{ position: "fixed", top: anchorRect.bottom + 4, left, zIndex: 9999 }}
    >
      {/* ── Group assignment ── */}
      {groups.length > 0 && (
        <>
          <div className="alias-ctx-section">
            {aliasGroup ? "Move to group" : "Add to group"}
          </div>
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              className={`alias-ctx-item${aliasGroup?.id === g.id ? " current" : ""}`}
              onClick={() => { onAssign(g.id); onClose(); }}
            >
              <FolderOpen size={13} />
              {g.name}
              {aliasGroup?.id === g.id && (
                <span style={{ marginLeft: "auto", fontSize: 10, opacity: 0.6 }}>current</span>
              )}
            </button>
          ))}
          <div className="alias-ctx-divider" />
        </>
      )}
      {/* ── Remove from group ── */}
      {aliasGroup && (
        <button
          type="button"
          className="alias-ctx-item"
          onClick={() => { onRemove(); onClose(); }}
        >
          <X size={13} />
          Remove from &ldquo;{aliasGroup.name}&rdquo;
        </button>
      )}

      {/* ── Delete alias ── */}
      {aliasGroup && <div className="alias-ctx-divider" />}
      <button
        type="button"
        className="alias-ctx-item danger"
        disabled={deletingAliasId === alias.id}
        onClick={async () => {
          await onDeleteAlias(alias.id);
          onClose();
        }}
      >
        <Trash2 size={13} />
        {deletingAliasId === alias.id ? "Deleting" : "Delete alias"}
      </button>
    </div>,
    document.body
  );
}

/* ── Main sidebar ──────────────────────────────────────────── */
interface Props {
  aliases: Alias[];
  deletingAliasId?: string | null;
  domain: string;
  maxAliases?: number;
  selectedAliasId?: string | null;
  onDeleteAlias: (aliasId: string) => Promise<void>;
  onSelectAlias: (aliasId: string) => void;
}

export function AliasSidebar({
  aliases,
  deletingAliasId,
  domain,
  maxAliases,
  selectedAliasId,
  onDeleteAlias,
  onSelectAlias
}: Props) {
  const [groups, setGroups] = useState<LocalGroup[]>([]);
  const [mounted, setMounted] = useState(false);

  // Which groups are expanded (controlled, so we don't rely on <details>)
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(new Set());

  // New group form
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const newGroupInputRef = useRef<HTMLInputElement>(null);

  // Inline rename
  const [renameGroupId, setRenameGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ aliasId: string; rect: DOMRect } | null>(null);

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

  useEffect(() => {
    if (renameGroupId) {
      const t = setTimeout(() => {
        const input = renameInputRef.current;
        if (input) { input.focus(); input.select(); }
      }, 30);
      return () => clearTimeout(t);
    }
  }, [renameGroupId]);

  /* ── Group mutations ── */
  const updateGroups = useCallback((next: LocalGroup[]) => {
    setGroups(next);
    saveGroups(next);
  }, []);

  function createGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    const newGroup: LocalGroup = { id: crypto.randomUUID(), name, aliasIds: [] };
    updateGroups([...groups, newGroup]);
    // Auto-open the new group
    setOpenGroupIds((prev) => new Set([...prev, newGroup.id]));
    setNewGroupName("");
    setNewGroupOpen(false);
  }

  function startRename(group: LocalGroup) {
    setRenameGroupId(group.id);
    setRenameValue(group.name);
  }

  function saveRename() {
    if (!renameGroupId) return;
    const name = renameValue.trim();
    if (name) {
      updateGroups(groups.map((g) => (g.id === renameGroupId ? { ...g, name } : g)));
    }
    setRenameGroupId(null);
    setRenameValue("");
  }

  function cancelRename() {
    setRenameGroupId(null);
    setRenameValue("");
  }

  function deleteGroup(group: LocalGroup) {
    if (!confirm(`Delete group "${group.name}"? Aliases will become ungrouped.`)) return;
    updateGroups(groups.filter((g) => g.id !== group.id));
    setOpenGroupIds((prev) => { const next = new Set(prev); next.delete(group.id); return next; });
  }

  function toggleGroup(groupId: string) {
    setOpenGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
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

  const ctxAlias = ctxMenu ? (aliases.find((a) => a.id === ctxMenu.aliasId) ?? null) : null;
  const ctxGroup = ctxAlias ? getAliasGroup(ctxAlias.id) : null;

  /* ── Alias row ── */
  function AliasRow({ alias, indented = false }: { alias: Alias; indented?: boolean }) {
    const isActive = alias.id === selectedAliasId;
    return (
      <div className={`alias-row-wrap${indented ? " indented" : ""}`}>
        <button
          type="button"
          className={`sidebar-alias-item${isActive ? " active" : ""}`}
          title={`${alias.prefix}@${domain}`}
          onClick={() => onSelectAlias(alias.id)}
        >
          <Inbox size={14} className="sidebar-alias-icon" />
          <div className="sidebar-alias-info">
            <div className="sidebar-alias-prefix">{alias.prefix}</div>
            <div className="sidebar-alias-domain">@{domain}</div>
          </div>
        </button>
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

  /* ── Group row ── */
  function GroupRow({ group }: { group: LocalGroup }) {
    const isOpen = openGroupIds.has(group.id);
    const isRenaming = renameGroupId === group.id;
    const groupAliases = getGroupAliases(group);

    return (
      <div className="sidebar-group">
        {/* Header */}
        <div
          className="sidebar-group-header"
          onClick={() => !isRenaming && toggleGroup(group.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleGroup(group.id); }}
        >
          <ChevronRight
            size={12}
            className={`group-chevron${isOpen ? " open" : ""}`}
          />
          <FolderOpen size={13} className="group-folder-icon" />

          {/* Inline rename input OR group name */}
          {isRenaming ? (
            <input
              ref={renameInputRef}
              className="group-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") saveRename();
                if (e.key === "Escape") cancelRename();
              }}
              onBlur={saveRename}
            />
          ) : (
            <span className="sidebar-group-name">{group.name}</span>
          )}

          <span className="sidebar-group-count">{groupAliases.length}</span>

          {/* Action buttons — shown on hover */}
          {!isRenaming && (
            <>
              <button
                type="button"
                className="group-action-btn"
                title="Rename group"
                onClick={(e) => { e.stopPropagation(); startRename(group); }}
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                className="group-action-btn group-delete-btn"
                title="Delete group"
                onClick={(e) => { e.stopPropagation(); deleteGroup(group); }}
              >
                <X size={11} />
              </button>
            </>
          )}
        </div>

        {/* Aliases under this group (collapsible) */}
        {isOpen && (
          <div className="sidebar-group-body">
            {groupAliases.length ? (
              groupAliases.map((alias) => <AliasRow key={alias.id} alias={alias} indented />)
            ) : (
              <div className="sidebar-group-empty">Use ··· on an alias to add it here</div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="sidebar-body">
      {maxAliases ? (
        <div className="sidebar-limit">
          {aliases.length} of {maxAliases} aliases used
        </div>
      ) : null}

      {/* Scrollable area */}
      <nav className="sidebar-scroll-area">
        {!aliases?.length && <div className="sidebar-empty">No aliases yet.</div>}

        {/* Ungrouped aliases */}
        {ungrouped.map((alias) => (
          <AliasRow key={alias.id} alias={alias} />
        ))}

        {/* Groups */}
        {mounted && groups.map((group) => <GroupRow key={group.id} group={group} />)}
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
                if (e.key === "Escape") { setNewGroupOpen(false); setNewGroupName(""); }
              }}
            />
            <div className="new-group-btns">
              <button type="button" className="button new-group-save-btn" onClick={createGroup}>
                Create
              </button>
              <button
                type="button"
                className="icon-btn-ghost"
                onClick={() => { setNewGroupOpen(false); setNewGroupName(""); }}
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
          deletingAliasId={deletingAliasId}
          onAssign={(groupId) => assignToGroup(ctxAlias.id, groupId)}
          onDeleteAlias={onDeleteAlias}
          onRemove={() => removeFromGroup(ctxAlias.id)}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

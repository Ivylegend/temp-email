"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Trash2, FolderInput, FolderMinus } from "lucide-react";
import type { Alias, Group } from "@/lib/types";
import { assignAliasToGroup, deleteAlias } from "./actions";

interface Props {
  alias: Alias;
  groups: Group[];
}

export function AliasMenu({ alias, groups }: Props) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function openMenu() {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 4, left: rect.left });
    setOpen(true);
  }

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  const inGroup = Boolean(alias.group_id);
  const otherGroups = groups.filter((g) => g.id !== alias.group_id);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="alias-menu-btn"
        title="Alias options"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          open ? setOpen(false) : openMenu();
        }}
      >
        <MoreHorizontal size={14} />
      </button>

      {open && dropPos && (
        <div
          ref={menuRef}
          className="alias-dropdown"
          style={{ top: dropPos.top, left: dropPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Assign to group */}
          {otherGroups.length > 0 && (
            <>
              <div className="alias-dropdown-label">Move to group</div>
              {otherGroups.map((g) => (
                <form key={g.id} action={assignAliasToGroup}>
                  <input type="hidden" name="alias_id" value={alias.id} />
                  <input type="hidden" name="group_id" value={g.id} />
                  <button type="submit" className="alias-dropdown-item">
                    <FolderInput size={13} />
                    {g.name}
                  </button>
                </form>
              ))}
            </>
          )}

          {/* Remove from group */}
          {inGroup && (
            <form action={assignAliasToGroup}>
              <input type="hidden" name="alias_id" value={alias.id} />
              <input type="hidden" name="group_id" value="" />
              <button type="submit" className="alias-dropdown-item">
                <FolderMinus size={13} />
                Remove from group
              </button>
            </form>
          )}

          {(otherGroups.length > 0 || inGroup) && (
            <div className="alias-dropdown-separator" />
          )}

          {/* Delete alias */}
          <form action={deleteAlias}>
            <input type="hidden" name="alias_id" value={alias.id} />
            <button type="submit" className="alias-dropdown-item danger">
              <Trash2 size={13} />
              Delete alias
            </button>
          </form>
        </div>
      )}
    </>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { TreeNode as TreeNodeData, NodeId } from "@/lib/tree";
import styles from "./TreeNode.module.css";

interface TreeNodeProps {
  node: TreeNodeData;
  prefix: string;
  selected: boolean;
  editing: boolean;
  /** True while this node is being edited and was only just created. */
  isNew: boolean;
  hasChildren: boolean;
  onSelect: (id: NodeId) => void;
  onRename: (id: NodeId, name: string) => void;
  onStartEdit: (id: NodeId) => void;
  onFinishEdit: () => void;
  onCancelEdit: () => void;
  onDragStart: (id: NodeId) => void;
  onDropNode: (targetId: NodeId, asChild: boolean) => void;
}

export default function TreeNode({
  node,
  prefix,
  selected,
  editing,
  isNew,
  hasChildren,
  onSelect,
  onRename,
  onStartEdit,
  onFinishEdit,
  onCancelEdit,
  onDragStart,
  onDropNode,
}: TreeNodeProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const rowClass = [styles.row, selected ? styles.selected : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role="treeitem"
      aria-selected={selected}
      className={rowClass}
      draggable={!editing}
      onClick={() => onSelect(node.id)}
      onDoubleClick={() => onStartEdit(node.id)}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(node.id);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onDropNode(node.id, e.altKey);
      }}
    >
      <span className={styles.prefix} aria-hidden="true">
        {prefix}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          className={styles.input}
          value={node.name}
          placeholder="name"
          onChange={(e) => onRename(node.id, e.target.value)}
          onBlur={onFinishEdit}
          onKeyDown={(e) => {
            // Keep editing keys away from the editor-level handler.
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              onFinishEdit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancelEdit();
            } else if (e.key === "ArrowLeft" && isNew && node.name === "") {
              // Backing out of a just-created, still-unnamed node discards it
              // (cancelEdit aborts a new node and reselects its parent).
              e.preventDefault();
              onCancelEdit();
            }
          }}
        />
      ) : (
        <span className={styles.name}>
          {node.name ? (
            <span className={styles.label}>{node.name}</span>
          ) : (
            <span className={styles.empty}>untitled</span>
          )}
          {hasChildren ? <span className={styles.slash}>/</span> : null}
        </span>
      )}
    </div>
  );
}

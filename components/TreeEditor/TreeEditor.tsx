"use client";

import { useRef, useMemo, Dispatch } from "react";
import { TreeState, NodeId, getChildren, getVisualOrder } from "@/lib/tree";
import { Action } from "@/lib/treeStore";
import { getTreePrefixes } from "@/lib/render";
import TreeNode from "../TreeNode/TreeNode";
import styles from "./TreeEditor.module.css";

interface TreeEditorProps {
  state: TreeState;
  editingId: NodeId | null;
  dispatch: Dispatch<Action>;
}

export default function TreeEditor({
  state,
  editingId,
  dispatch,
}: TreeEditorProps) {
  const draggedId = useRef<NodeId | null>(null);

  const visual = useMemo(() => getVisualOrder(state.nodes), [state.nodes]);
  const prefixes = useMemo(() => getTreePrefixes(state.nodes), [state.nodes]);

  const childCount = useMemo(() => {
    const counts = new Map<NodeId, number>();
    for (const n of state.nodes) {
      if (n.parentId !== null) {
        counts.set(n.parentId, (counts.get(n.parentId) ?? 0) + 1);
      }
    }
    return counts;
  }, [state.nodes]);

  function handleDrop(targetId: NodeId, asChild: boolean) {
    const dragged = draggedId.current;
    draggedId.current = null;
    if (!dragged || dragged === targetId) return;

    const target = state.nodes.find((n) => n.id === targetId);
    if (!target) return;

    if (asChild) {
      const order = getChildren(state.nodes, targetId).length;
      dispatch({ type: "move", id: dragged, newParentId: targetId, newOrder: order });
    } else {
      dispatch({
        type: "move",
        id: dragged,
        newParentId: target.parentId,
        newOrder: target.order + 1,
      });
    }
  }

  return (
    <div
      role="tree"
      className={styles.editor}
      aria-label="Directory tree editor"
    >
      {visual.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          prefix={prefixes.get(node.id) ?? ""}
          selected={node.id === state.selectedId}
          editing={node.id === editingId}
          hasChildren={(childCount.get(node.id) ?? 0) > 0}
          onSelect={(id) => dispatch({ type: "select", id })}
          onRename={(id, name) => dispatch({ type: "renameLive", id, name })}
          onStartEdit={(id) => dispatch({ type: "startEdit", id, isNew: false })}
          onFinishEdit={() => dispatch({ type: "finishEdit" })}
          onCancelEdit={() => dispatch({ type: "cancelEdit" })}
          onDragStart={(id) => {
            draggedId.current = id;
          }}
          onDropNode={handleDrop}
        />
      ))}
    </div>
  );
}

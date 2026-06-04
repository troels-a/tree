import {
  TreeState,
  NodeId,
  addNode,
  removeNode,
  indentNode,
  outdentNode,
  renameNode,
  moveNode,
  reorderSibling,
  selectNext,
  selectPrev,
  selectParent,
  getChildren,
} from "./tree";

/**
 * Wraps a TreeState with undo/redo history and the current rename-edit
 * session. `present` is the live tree; `past`/`future` are full snapshots.
 */
export interface AppState {
  present: TreeState;
  past: TreeState[];
  future: TreeState[];
  editingId: NodeId | null;
  /** Snapshot captured when an edit session began (for rename undo). */
  editSnapshot: TreeState | null;
  /** True while editing a node that was just created (add+name = one step). */
  editIsNew: boolean;
  /** The node's name when the edit session began. */
  editOriginalName: string;
}

export type Action =
  | { type: "load"; tree: TreeState }
  | { type: "select"; id: NodeId | null }
  | { type: "selectNext" }
  | { type: "selectPrev" }
  | { type: "descend" }
  | { type: "ascend" }
  | { type: "add" }
  | { type: "remove" }
  | { type: "removeId"; id: NodeId }
  | { type: "indent" }
  | { type: "outdent" }
  | { type: "moveUp" }
  | { type: "moveDown" }
  | { type: "move"; id: NodeId; newParentId: NodeId | null; newOrder: number }
  | { type: "renameLive"; id: NodeId; name: string }
  | { type: "startEdit"; id: NodeId; isNew: boolean }
  | { type: "finishEdit" }
  | { type: "cancelEdit" }
  | { type: "undo" }
  | { type: "redo" };

const NO_EDIT = {
  editingId: null,
  editSnapshot: null,
  editIsNew: false,
  editOriginalName: "",
} as const;

export function initStore(tree: TreeState): AppState {
  return { present: tree, past: [], future: [], ...NO_EDIT };
}

/** Root nodes (top level) may be renamed but never deleted. */
function isRootNode(tree: TreeState, id: NodeId): boolean {
  const node = tree.nodes.find((n) => n.id === id);
  return !!node && node.parentId === null;
}

/** Applies a structural change, pushing history unless it was a no-op. */
function commit(state: AppState, next: TreeState): AppState {
  if (next === state.present) return state; // pure no-op, nothing to record
  return {
    ...state,
    present: next,
    past: [...state.past, state.present],
    future: [],
    ...NO_EDIT,
  };
}

/** Changes the present without recording history (selection, live typing). */
function transient(state: AppState, next: TreeState): AppState {
  return { ...state, present: next };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "load":
      return initStore(action.tree);

    case "select":
      return transient(state, { ...state.present, selectedId: action.id });
    case "selectNext":
      return transient(state, selectNext(state.present));
    case "selectPrev":
      return transient(state, selectPrev(state.present));

    case "descend": {
      const id = state.present.selectedId;
      // Nothing selected: drop the cursor onto the first root.
      if (!id) return transient(state, selectNext(state.present));

      const children = getChildren(state.present.nodes, id);
      // Has children: step into the folder by selecting its first child.
      if (children.length > 0) {
        return transient(state, { ...state.present, selectedId: children[0].id });
      }
      // Empty: create a first child under it and open it for renaming
      // (same add+name-in-one-step semantics as the 'add' action).
      const next = addNode(state.present, id);
      const committed = commit(state, next);
      return {
        ...committed,
        editingId: next.selectedId,
        editIsNew: true,
        editSnapshot: next,
        editOriginalName: "",
      };
    }
    case "ascend":
      return transient(state, selectParent(state.present));

    case "add": {
      const selected = state.present.nodes.find(
        (n) => n.id === state.present.selectedId
      );
      const parentId = selected ? selected.parentId : null;
      const next = addNode(state.present, parentId);
      const committed = commit(state, next);
      return {
        ...committed,
        editingId: next.selectedId,
        editIsNew: true,
        editSnapshot: next,
        editOriginalName: "",
      };
    }

    case "remove":
      if (!state.present.selectedId) return state;
      if (isRootNode(state.present, state.present.selectedId)) return state;
      return commit(state, removeNode(state.present, state.present.selectedId));
    case "removeId":
      if (isRootNode(state.present, action.id)) return state;
      return commit(state, removeNode(state.present, action.id));

    case "indent":
      if (!state.present.selectedId) return state;
      return commit(state, indentNode(state.present, state.present.selectedId));
    case "outdent":
      if (!state.present.selectedId) return state;
      return commit(state, outdentNode(state.present, state.present.selectedId));

    case "moveUp":
      if (!state.present.selectedId) return state;
      return commit(state, reorderSibling(state.present, state.present.selectedId, -1));
    case "moveDown":
      if (!state.present.selectedId) return state;
      return commit(state, reorderSibling(state.present, state.present.selectedId, 1));

    case "move":
      return commit(
        state,
        moveNode(state.present, action.id, action.newParentId, action.newOrder)
      );

    case "renameLive":
      return transient(
        state,
        renameNode(state.present, action.id, action.name)
      );

    case "startEdit": {
      const node = state.present.nodes.find((n) => n.id === action.id);
      if (!node) return state;
      return {
        ...state,
        editingId: action.id,
        editIsNew: action.isNew,
        editSnapshot: state.present,
        editOriginalName: node.name,
      };
    }

    case "finishEdit": {
      const id = state.editingId;
      if (!id) return state;
      const node = state.present.nodes.find((n) => n.id === id);
      const cleared = { ...state, ...NO_EDIT };
      if (!node) return cleared;

      const empty = node.name.trim() === "";

      if (state.editIsNew) {
        if (empty) return abortNew(state);
        return cleared; // the 'add' already created the undo boundary
      }

      // Existing node.
      if (empty) {
        // A root must keep a name — revert rather than delete it.
        if (isRootNode(state.present, id)) {
          return {
            ...cleared,
            present: renameNode(state.present, id, state.editOriginalName),
          };
        }
        return {
          ...cleared,
          present: removeNode(state.present, id),
          past: [...state.past, state.editSnapshot ?? state.present],
          future: [],
        };
      }
      if (node.name !== state.editOriginalName) {
        return {
          ...cleared,
          past: [...state.past, state.editSnapshot ?? state.present],
          future: [],
        };
      }
      return cleared; // no change
    }

    case "cancelEdit": {
      const id = state.editingId;
      if (!id) return state;
      const cleared = { ...state, ...NO_EDIT };
      if (state.editIsNew) return abortNew(state);
      // Revert to the name the edit started with.
      return {
        ...cleared,
        present: renameNode(state.present, id, state.editOriginalName),
      };
    }

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        present: previous,
        past: state.past.slice(0, -1),
        future: [state.present, ...state.future],
        ...NO_EDIT,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        ...state,
        present: next,
        past: [...state.past, state.present],
        future: state.future.slice(1),
        ...NO_EDIT,
      };
    }

    default:
      return state;
  }
}

/** Undoes a just-created node that was left empty, with no dangling history. */
function abortNew(state: AppState): AppState {
  const previous = state.past[state.past.length - 1] ?? state.present;
  return {
    ...state,
    present: previous,
    past: state.past.slice(0, -1),
    ...NO_EDIT,
  };
}

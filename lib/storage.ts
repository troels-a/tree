import { TreeState, TreeNode, generateId } from "./tree";

export const STORAGE_KEY = "tree-state";

/** Persists the tree state to localStorage. Never throws. */
export function saveTree(state: TreeState): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage may be unavailable, full, or blocked — ignore.
  }
}

/** Loads the tree state from localStorage, or null if absent/corrupt. */
export function loadTree(): TreeState | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isTreeState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isTreeState(value: unknown): value is TreeState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.nodes) &&
    (v.selectedId === null || typeof v.selectedId === "string")
  );
}

/**
 * Builds the default tree shown on first load:
 *
 *   my-project/
 *   ├── src/
 *   │   └── index.ts
 *   ├── package.json
 *   └── README.md
 */
export function createDefaultState(): TreeState {
  const rootId = generateId();
  const srcId = generateId();
  const nodes: TreeNode[] = [
    { id: rootId, name: "my-project", parentId: null, order: 0 },
    { id: srcId, name: "src", parentId: rootId, order: 0 },
    { id: generateId(), name: "index.ts", parentId: srcId, order: 0 },
    { id: generateId(), name: "package.json", parentId: rootId, order: 1 },
    { id: generateId(), name: "README.md", parentId: rootId, order: 2 },
  ];
  return { nodes, selectedId: rootId };
}

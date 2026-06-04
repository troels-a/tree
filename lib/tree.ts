export type NodeId = string;

/** Small collision-resistant id generator (no external dependency). */
let idCounter = 0;
export function generateId(): NodeId {
  idCounter += 1;
  return `n${Date.now().toString(36)}${idCounter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export interface TreeNode {
  id: NodeId;
  name: string;
  parentId: NodeId | null; // null = root
  order: number; // sort order among siblings
}

export interface TreeState {
  nodes: TreeNode[];
  selectedId: NodeId | null;
}

export const DEFAULT_NODE_NAME = "untitled";

/** Returns direct children of `parentId`, sorted by their order field. */
export function getChildren(
  nodes: TreeNode[],
  parentId: NodeId | null
): TreeNode[] {
  return nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

/** Returns all descendants of `id` recursively (excluding the node itself). */
export function getDescendants(nodes: TreeNode[], id: NodeId): TreeNode[] {
  const result: TreeNode[] = [];
  for (const child of getChildren(nodes, id)) {
    result.push(child);
    result.push(...getDescendants(nodes, child.id));
  }
  return result;
}

/** Returns every node in depth-first visual order (roots, then their subtrees). */
export function getVisualOrder(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  const walk = (parentId: NodeId | null) => {
    for (const node of getChildren(nodes, parentId)) {
      result.push(node);
      walk(node.id);
    }
  };
  walk(null);
  return result;
}

/** Re-numbers a parent's children to contiguous 0..n-1 based on current order. */
function normalizeOrders(nodes: TreeNode[], parentId: NodeId | null): TreeNode[] {
  const siblings = getChildren(nodes, parentId);
  const orderById = new Map<NodeId, number>();
  siblings.forEach((n, i) => orderById.set(n.id, i));
  return nodes.map((n) =>
    n.parentId === parentId && orderById.has(n.id)
      ? { ...n, order: orderById.get(n.id)! }
      : n
  );
}

/**
 * Inserts a new node under `parentId`. If the currently selected node is a
 * child of `parentId`, the new node is placed directly after it; otherwise it
 * is appended to the end. The new node becomes selected.
 */
export function addNode(state: TreeState, parentId: NodeId | null): TreeState {
  const id = generateId();
  const siblings = getChildren(state.nodes, parentId);
  const selected = state.nodes.find((n) => n.id === state.selectedId);

  const insertOrder =
    selected && selected.parentId === parentId
      ? selected.order + 1
      : siblings.length;

  const shifted = state.nodes.map((n) =>
    n.parentId === parentId && n.order >= insertOrder
      ? { ...n, order: n.order + 1 }
      : n
  );

  const newNode: TreeNode = {
    id,
    name: "",
    parentId,
    order: insertOrder,
  };

  return {
    nodes: [...shifted, newNode],
    selectedId: id,
  };
}

/** Removes the node and all of its descendants. */
export function removeNode(state: TreeState, id: NodeId): TreeState {
  const target = state.nodes.find((n) => n.id === id);
  if (!target) return state;

  const doomed = new Set<NodeId>([
    id,
    ...getDescendants(state.nodes, id).map((n) => n.id),
  ]);

  let nodes = state.nodes.filter((n) => !doomed.has(n.id));
  nodes = normalizeOrders(nodes, target.parentId);

  let selectedId = state.selectedId;
  if (selectedId !== null && doomed.has(selectedId)) {
    // Select the nearest surviving node in the original visual order.
    const visual = getVisualOrder(state.nodes);
    const removedIndex = visual.findIndex((n) => n.id === id);
    selectedId = null;
    for (let i = removedIndex + 1; i < visual.length; i++) {
      if (!doomed.has(visual[i].id)) {
        selectedId = visual[i].id;
        break;
      }
    }
    if (selectedId === null) {
      for (let i = removedIndex - 1; i >= 0; i--) {
        if (!doomed.has(visual[i].id)) {
          selectedId = visual[i].id;
          break;
        }
      }
    }
  }

  return { nodes, selectedId };
}

/** Updates the name field of a node. */
export function renameNode(
  state: TreeState,
  id: NodeId,
  name: string
): TreeState {
  return {
    ...state,
    nodes: state.nodes.map((n) => (n.id === id ? { ...n, name } : n)),
  };
}

/**
 * Reparents `id` under `newParentId` and inserts it at `newOrder` among the
 * new parent's children, re-numbering both the old and new sibling sets.
 */
export function moveNode(
  state: TreeState,
  id: NodeId,
  newParentId: NodeId | null,
  newOrder: number
): TreeState {
  const target = state.nodes.find((n) => n.id === id);
  if (!target) return state;

  // Guard against moving a node into itself or one of its descendants.
  if (newParentId !== null) {
    const subtree = new Set<NodeId>([
      id,
      ...getDescendants(state.nodes, id).map((n) => n.id),
    ]);
    if (subtree.has(newParentId)) return state;
  }

  const oldParentId = target.parentId;

  // Make room in the destination sibling set.
  let nodes = state.nodes.map((n) =>
    n.id === id
      ? { ...n, parentId: newParentId, order: newOrder - 0.5 }
      : n.parentId === newParentId && n.order >= newOrder
        ? { ...n, order: n.order + 1 }
        : n
  );

  nodes = normalizeOrders(nodes, newParentId);
  if (oldParentId !== newParentId) {
    nodes = normalizeOrders(nodes, oldParentId);
  }

  return { ...state, nodes };
}

/** Makes the node a child of its previous sibling (Tab). No-op if first child. */
export function indentNode(state: TreeState, id: NodeId): TreeState {
  const target = state.nodes.find((n) => n.id === id);
  if (!target) return state;

  const siblings = getChildren(state.nodes, target.parentId);
  const idx = siblings.findIndex((n) => n.id === id);
  if (idx <= 0) return state; // no previous sibling

  const prev = siblings[idx - 1];
  const newOrder = getChildren(state.nodes, prev.id).length;
  return moveNode(state, id, prev.id, newOrder);
}

/** Moves the node up to its grandparent, just after its old parent (Shift+Tab). */
export function outdentNode(state: TreeState, id: NodeId): TreeState {
  const target = state.nodes.find((n) => n.id === id);
  if (!target || target.parentId === null) return state; // already at root

  const parent = state.nodes.find((n) => n.id === target.parentId);
  if (!parent) return state;

  return moveNode(state, id, parent.parentId, parent.order + 1);
}

/**
 * Reorders a node among its siblings by swapping positions with the neighbour
 * in `direction` (-1 = up, +1 = down). No-op at the ends of the sibling list.
 */
export function reorderSibling(
  state: TreeState,
  id: NodeId,
  direction: -1 | 1
): TreeState {
  const node = state.nodes.find((n) => n.id === id);
  if (!node) return state;

  const siblings = getChildren(state.nodes, node.parentId);
  const idx = siblings.findIndex((n) => n.id === id);
  const swapIdx = idx + direction;
  if (swapIdx < 0 || swapIdx >= siblings.length) return state;

  const other = siblings[swapIdx];
  return {
    ...state,
    nodes: state.nodes.map((n) => {
      if (n.id === node.id) return { ...n, order: other.order };
      if (n.id === other.id) return { ...n, order: node.order };
      return n;
    }),
  };
}

/** Moves selection down one row in visual order, clamping at the last node. */
export function selectNext(state: TreeState): TreeState {
  const visual = getVisualOrder(state.nodes);
  if (visual.length === 0) return state;

  const idx = visual.findIndex((n) => n.id === state.selectedId);
  if (idx === -1) return { ...state, selectedId: visual[0].id };

  const nextIdx = Math.min(idx + 1, visual.length - 1);
  return { ...state, selectedId: visual[nextIdx].id };
}

/** Moves selection up one row in visual order, clamping at the first node. */
export function selectPrev(state: TreeState): TreeState {
  const visual = getVisualOrder(state.nodes);
  if (visual.length === 0) return state;

  const idx = visual.findIndex((n) => n.id === state.selectedId);
  if (idx === -1) return { ...state, selectedId: visual[0].id };

  const prevIdx = Math.max(idx - 1, 0);
  return { ...state, selectedId: visual[prevIdx].id };
}

/** Selects the parent of the selected node. No-op at root or with no selection. */
export function selectParent(state: TreeState): TreeState {
  if (state.selectedId === null) return state;
  const node = state.nodes.find((n) => n.id === state.selectedId);
  if (!node || node.parentId === null) return state;
  return { ...state, selectedId: node.parentId };
}

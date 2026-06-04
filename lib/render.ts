import { TreeNode, NodeId, getChildren } from "./tree";

/** True when the node has at least one child. */
function hasChildren(nodes: TreeNode[], id: NodeId): boolean {
  return nodes.some((n) => n.parentId === id);
}

/**
 * Computes the inline tree-connector prefix (everything before the node's
 * label) for every node, keyed by id. Root nodes map to "".
 *
 *   my-project/        -> ""
 *   ├── src/           -> "├── "
 *   │   └── index.ts   -> "│   └── "
 */
export function getTreePrefixes(nodes: TreeNode[]): Map<NodeId, string> {
  const prefixes = new Map<NodeId, string>();

  const walk = (parentId: NodeId | null, ancestorPrefix: string, isRoot: boolean) => {
    const children = getChildren(nodes, parentId);
    children.forEach((node, i) => {
      const isLast = i === children.length - 1;
      if (isRoot) {
        prefixes.set(node.id, "");
        walk(node.id, "", false);
      } else {
        prefixes.set(node.id, `${ancestorPrefix}${isLast ? "└── " : "├── "}`);
        walk(node.id, `${ancestorPrefix}${isLast ? "    " : "│   "}`, false);
      }
    });
  };

  walk(null, "", true);
  return prefixes;
}

/**
 * Converts the flat node array into standard Unix `tree`-style ASCII output.
 *
 *   my-project/
 *   ├── src/
 *   │   └── index.ts
 *   └── README.md
 *
 * - Nodes that have children render with a trailing `/`.
 * - Children use `├── ` except the last, which uses `└── `.
 * - Continuation uses `│   `, or four spaces where the ancestor was last.
 * - Root nodes appear with no prefix.
 */
export function renderTree(nodes: TreeNode[]): string {
  const prefixes = getTreePrefixes(nodes);

  const label = (node: TreeNode): string =>
    hasChildren(nodes, node.id) ? `${node.name}/` : node.name;

  // Walk in visual order so siblings keep their order and depth nesting holds.
  const lines: string[] = [];
  const walk = (parentId: NodeId | null) => {
    for (const node of getChildren(nodes, parentId)) {
      lines.push(`${prefixes.get(node.id) ?? ""}${label(node)}`);
      walk(node.id);
    }
  };
  walk(null);

  return lines.join("\n");
}

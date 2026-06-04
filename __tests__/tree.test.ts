import {
  TreeNode,
  TreeState,
  addNode,
  removeNode,
  moveNode,
  indentNode,
  outdentNode,
  renameNode,
  reorderSibling,
  selectNext,
  selectPrev,
  getChildren,
  getDescendants,
  getVisualOrder,
} from "@/lib/tree";

// Build a known sample tree:
//
// my-project/        (root)
// ├── src/           (src)
// │   └── index.ts   (index)
// ├── package.json   (pkg)
// └── README.md      (readme)
function sampleState(selectedId: string | null = null): TreeState {
  const nodes: TreeNode[] = [
    { id: "root", name: "my-project", parentId: null, order: 0 },
    { id: "src", name: "src", parentId: "root", order: 0 },
    { id: "index", name: "index.ts", parentId: "src", order: 0 },
    { id: "pkg", name: "package.json", parentId: "root", order: 1 },
    { id: "readme", name: "README.md", parentId: "root", order: 2 },
  ];
  return { nodes, selectedId };
}

describe("getChildren", () => {
  it("returns direct children sorted by order", () => {
    const { nodes } = sampleState();
    const children = getChildren(nodes, "root");
    expect(children.map((n) => n.id)).toEqual(["src", "pkg", "readme"]);
  });

  it("returns children even when stored out of order", () => {
    const nodes: TreeNode[] = [
      { id: "a", name: "a", parentId: null, order: 2 },
      { id: "b", name: "b", parentId: null, order: 0 },
      { id: "c", name: "c", parentId: null, order: 1 },
    ];
    expect(getChildren(nodes, null).map((n) => n.id)).toEqual(["b", "c", "a"]);
  });
});

describe("getDescendants", () => {
  it("returns all descendants recursively", () => {
    const { nodes } = sampleState();
    const desc = getDescendants(nodes, "root").map((n) => n.id).sort();
    expect(desc).toEqual(["index", "pkg", "readme", "src"]);
  });

  it("returns empty array for a leaf node", () => {
    const { nodes } = sampleState();
    expect(getDescendants(nodes, "index")).toEqual([]);
  });
});

describe("getVisualOrder", () => {
  it("returns nodes in depth-first visual order", () => {
    const { nodes } = sampleState();
    expect(getVisualOrder(nodes).map((n) => n.id)).toEqual([
      "root",
      "src",
      "index",
      "pkg",
      "readme",
    ]);
  });
});

describe("addNode", () => {
  it("appends to root when nothing is selected", () => {
    const state = sampleState(null);
    const next = addNode(state, null);
    const roots = getChildren(next.nodes, null);
    // existing root "my-project" plus the new node, appended last
    expect(roots[roots.length - 1].id).toBe(next.selectedId);
    expect(roots).toHaveLength(2);
  });

  it("inserts a new node directly after the selected sibling at the same depth", () => {
    const state = sampleState("pkg");
    const next = addNode(state, "root");
    const children = getChildren(next.nodes, "root");
    const ids = children.map((n) => n.id);
    // new node sits between pkg and readme
    expect(ids).toEqual(["src", "pkg", next.selectedId, "readme"]);
  });

  it("selects the newly added node", () => {
    const state = sampleState("pkg");
    const next = addNode(state, "root");
    expect(next.selectedId).not.toBe("pkg");
    expect(next.nodes.find((n) => n.id === next.selectedId)).toBeDefined();
  });

  it("does not mutate the original state", () => {
    const state = sampleState("pkg");
    addNode(state, "root");
    expect(state.nodes).toHaveLength(5);
  });
});

describe("removeNode", () => {
  it("removes the node and all its descendants", () => {
    const state = sampleState();
    const next = removeNode(state, "src");
    expect(next.nodes.map((n) => n.id).sort()).toEqual([
      "pkg",
      "readme",
      "root",
    ]);
  });

  it("clears selection when the selected node is removed", () => {
    const state = sampleState("index");
    const next = removeNode(state, "src");
    expect(next.selectedId).not.toBe("index");
    // selection, if set, must point to a surviving node
    if (next.selectedId !== null) {
      expect(next.nodes.find((n) => n.id === next.selectedId)).toBeDefined();
    }
  });
});

describe("renameNode", () => {
  it("updates the name field", () => {
    const state = sampleState();
    const next = renameNode(state, "readme", "CHANGELOG.md");
    expect(next.nodes.find((n) => n.id === "readme")!.name).toBe(
      "CHANGELOG.md"
    );
  });
});

describe("indentNode", () => {
  it("makes the node a child of its previous sibling", () => {
    const state = sampleState();
    // indent "pkg" -> becomes child of "src"
    const next = indentNode(state, "pkg");
    const pkg = next.nodes.find((n) => n.id === "pkg")!;
    expect(pkg.parentId).toBe("src");
    // appended after src's existing children
    expect(getChildren(next.nodes, "src").map((n) => n.id)).toEqual([
      "index",
      "pkg",
    ]);
  });

  it("does nothing when there is no previous sibling", () => {
    const state = sampleState();
    // "src" is the first child of root -> no previous sibling
    const next = indentNode(state, "src");
    expect(next.nodes.find((n) => n.id === "src")!.parentId).toBe("root");
  });
});

describe("outdentNode", () => {
  it("moves the node up to its grandparent, just after its old parent", () => {
    const state = sampleState();
    // outdent "index" -> from "src" up to "root", placed right after "src"
    const next = outdentNode(state, "index");
    const index = next.nodes.find((n) => n.id === "index")!;
    expect(index.parentId).toBe("root");
    expect(getChildren(next.nodes, "root").map((n) => n.id)).toEqual([
      "src",
      "index",
      "pkg",
      "readme",
    ]);
  });

  it("promotes a depth-1 node to the root level", () => {
    const state = sampleState();
    // outdent "src" -> its grandparent is null (root level)
    const next = outdentNode(state, "src");
    expect(next.nodes.find((n) => n.id === "src")!.parentId).toBeNull();
  });

  it("does nothing for a node already at the root level", () => {
    const state = sampleState();
    // "root" has parentId null -> no grandparent to move to
    const next = outdentNode(state, "root");
    expect(next.nodes.find((n) => n.id === "root")!.parentId).toBeNull();
  });
});

describe("moveNode", () => {
  it("reparents a node and updates order", () => {
    const state = sampleState();
    const next = moveNode(state, "readme", "src", 0);
    const readme = next.nodes.find((n) => n.id === "readme")!;
    expect(readme.parentId).toBe("src");
    expect(getChildren(next.nodes, "src").map((n) => n.id)).toEqual([
      "readme",
      "index",
    ]);
    // removed from root
    expect(getChildren(next.nodes, "root").map((n) => n.id)).toEqual([
      "src",
      "pkg",
    ]);
  });
});

describe("reorderSibling", () => {
  it("moves a node up among its siblings", () => {
    const next = reorderSibling(sampleState(), "pkg", -1);
    expect(getChildren(next.nodes, "root").map((n) => n.id)).toEqual([
      "pkg",
      "src",
      "readme",
    ]);
  });

  it("moves a node down among its siblings", () => {
    const next = reorderSibling(sampleState(), "src", 1);
    expect(getChildren(next.nodes, "root").map((n) => n.id)).toEqual([
      "pkg",
      "src",
      "readme",
    ]);
  });

  it("is a no-op at the top of its sibling list", () => {
    const state = sampleState();
    expect(reorderSibling(state, "src", -1)).toBe(state);
  });

  it("is a no-op at the bottom of its sibling list", () => {
    const state = sampleState();
    expect(reorderSibling(state, "readme", 1)).toBe(state);
  });

  it("does not disturb other branches", () => {
    const next = reorderSibling(sampleState(), "pkg", -1);
    expect(getChildren(next.nodes, "src").map((n) => n.id)).toEqual(["index"]);
  });
});

describe("selectNext / selectPrev", () => {
  it("selectNext moves selection down in visual order", () => {
    const state = sampleState("src");
    expect(selectNext(state).selectedId).toBe("index");
  });

  it("selectPrev moves selection up in visual order", () => {
    const state = sampleState("index");
    expect(selectPrev(state).selectedId).toBe("src");
  });

  it("selectNext on the last node keeps it selected", () => {
    const state = sampleState("readme");
    expect(selectNext(state).selectedId).toBe("readme");
  });

  it("selectPrev on the first node keeps it selected", () => {
    const state = sampleState("root");
    expect(selectPrev(state).selectedId).toBe("root");
  });

  it("selectNext selects the first node when nothing is selected", () => {
    const state = sampleState(null);
    expect(selectNext(state).selectedId).toBe("root");
  });
});

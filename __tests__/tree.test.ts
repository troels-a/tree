import {
  TreeNode,
  TreeState,
  addNode,
  removeNode,
  moveNode,
  indentNode,
  outdentNode,
  renameNode,
  moveVertical,
  selectNext,
  selectPrev,
  selectParent,
  selectFirstChild,
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
  it("inserts at the top when there is no selected sibling", () => {
    const state = sampleState(null);
    const next = addNode(state, null);
    const roots = getChildren(next.nodes, null);
    // new node goes to the top, ahead of the existing "my-project"
    expect(roots[0].id).toBe(next.selectedId);
    expect(roots).toHaveLength(2);
  });

  it("inserts a new child at the top of the directory's existing children", () => {
    const state = sampleState("src"); // src already contains "index"
    const next = addNode(state, "src");
    const children = getChildren(next.nodes, "src");
    expect(children.map((n) => n.id)).toEqual([next.selectedId, "index"]);
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
  it("moves the node up to its grandparent, just above its old parent", () => {
    const state = sampleState();
    // outdent "index" -> from "src" up to "root", placed right before "src"
    const next = outdentNode(state, "index");
    const index = next.nodes.find((n) => n.id === "index")!;
    expect(index.parentId).toBe("root");
    expect(getChildren(next.nodes, "root").map((n) => n.id)).toEqual([
      "index",
      "src",
      "pkg",
      "readme",
    ]);
  });

  it("does not promote a depth-1 node to the root (no second top-level node)", () => {
    const state = sampleState();
    // outdenting "src" would make it a top-level sibling of root -> not allowed
    expect(outdentNode(state, "src")).toBe(state);
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

describe("moveVertical: move a node one row up/down the whole tree", () => {
  // visual order: my-project, src, index.ts, package.json, README.md
  it("moves a node down one row among siblings", () => {
    const next = moveVertical(sampleState("pkg"), "pkg", 1);
    // package.json drops below README.md (the next row)
    expect(getChildren(next.nodes, "root").map((n) => n.id)).toEqual([
      "src",
      "readme",
      "pkg",
    ]);
  });

  it("moving up dives into a previous sibling folder (the row above)", () => {
    const next = moveVertical(sampleState("pkg"), "pkg", -1);
    // the row above package.json is index.ts (inside src), so it lands there
    expect(getChildren(next.nodes, "src").map((n) => n.id)).toEqual([
      "pkg",
      "index",
    ]);
    expect(getChildren(next.nodes, "root").map((n) => n.id)).toEqual([
      "src",
      "readme",
    ]);
  });

  it("carries the node's whole subtree", () => {
    const next = moveVertical(sampleState("src"), "src", 1); // src has index
    expect(getChildren(next.nodes, "root").map((n) => n.id)).toEqual([
      "pkg",
      "src",
      "readme",
    ]);
    expect(getChildren(next.nodes, "src").map((n) => n.id)).toEqual(["index"]);
  });

  it("is a no-op at the very top (just under the root)", () => {
    const state = sampleState("src");
    expect(moveVertical(state, "src", -1)).toBe(state);
  });

  it("is a no-op at the very bottom", () => {
    const state = sampleState("readme");
    expect(moveVertical(state, "readme", 1)).toBe(state);
  });

  it("does not move the root", () => {
    const state = sampleState("root");
    expect(moveVertical(state, "root", 1)).toBe(state);
  });
});

describe("selectNext / selectPrev: traverse the whole tree in visual order", () => {
  it("selectNext descends into a child (in/out of subnodes)", () => {
    expect(selectNext(sampleState("src")).selectedId).toBe("index");
  });

  it("selectNext steps out to the next branch after a subtree ends", () => {
    expect(selectNext(sampleState("index")).selectedId).toBe("pkg");
  });

  it("selectPrev moves up in visual order", () => {
    expect(selectPrev(sampleState("index")).selectedId).toBe("src");
  });

  it("selectNext clamps at the last node", () => {
    expect(selectNext(sampleState("readme")).selectedId).toBe("readme");
  });

  it("selectPrev clamps at the root", () => {
    expect(selectPrev(sampleState("root")).selectedId).toBe("root");
  });

  it("selects the first node when nothing is selected", () => {
    expect(selectNext(sampleState(null)).selectedId).toBe("root");
    expect(selectPrev(sampleState(null)).selectedId).toBe("root");
  });
});

describe("selectFirstChild: go into a node", () => {
  it("selects the first child of the selected node", () => {
    expect(selectFirstChild(sampleState("src")).selectedId).toBe("index");
    expect(selectFirstChild(sampleState("root")).selectedId).toBe("src");
  });

  it("is a no-op on a leaf with no children", () => {
    expect(selectFirstChild(sampleState("index")).selectedId).toBe("index");
  });

  it("is a no-op when nothing is selected", () => {
    expect(selectFirstChild(sampleState(null)).selectedId).toBeNull();
  });
});

describe("selectParent", () => {
  it("selects the parent of the selected node", () => {
    expect(selectParent(sampleState("index")).selectedId).toBe("src");
  });

  it("keeps selection at the root level (root has no parent)", () => {
    expect(selectParent(sampleState("root")).selectedId).toBe("root");
  });

  it("is a no-op when nothing is selected", () => {
    expect(selectParent(sampleState(null)).selectedId).toBeNull();
  });
});

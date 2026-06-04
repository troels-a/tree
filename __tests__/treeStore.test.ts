import { initStore, reducer, AppState } from "@/lib/treeStore";
import { TreeNode, TreeState, getChildren } from "@/lib/tree";

function sampleTree(selectedId: string | null = "root"): TreeState {
  const nodes: TreeNode[] = [
    { id: "root", name: "my-project", parentId: null, order: 0 },
    { id: "src", name: "src", parentId: "root", order: 0 },
    { id: "index", name: "index.ts", parentId: "src", order: 0 },
    { id: "pkg", name: "package.json", parentId: "root", order: 1 },
    { id: "readme", name: "README.md", parentId: "root", order: 2 },
  ];
  return { nodes, selectedId };
}

function store(selectedId: string | null = "root"): AppState {
  return initStore(sampleTree(selectedId));
}

describe("initStore", () => {
  it("starts with empty history and no edit", () => {
    const s = store();
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.editingId).toBeNull();
    expect(s.present.nodes).toHaveLength(5);
  });
});

describe("selection is not undoable", () => {
  it("'select' changes selection without touching history", () => {
    const s = reducer(store(), { type: "select", id: "pkg" });
    expect(s.present.selectedId).toBe("pkg");
    expect(s.past).toEqual([]);
  });

  it("'selectNext' traverses into subnodes without pushing history", () => {
    const s = reducer(store("src"), { type: "selectNext" });
    expect(s.present.selectedId).toBe("index"); // descends into src's child
    expect(s.past).toEqual([]);
  });
});

describe("'add' (right arrow) creates a child inside the selected node", () => {
  it("adds the new node as a child of the selected node (never a top-level sibling)", () => {
    const s = reducer(store("root"), { type: "add" });
    const newId = s.editingId!;
    const child = s.present.nodes.find((n) => n.id === newId)!;
    expect(child.parentId).toBe("root"); // inside root, not a sibling of root
    // No new node ever ends up at the top level.
    expect(getChildren(s.present.nodes, null)).toHaveLength(1);
  });

  it("adds a child of a non-root selected node too", () => {
    const s = reducer(store("pkg"), { type: "add" });
    const newId = s.editingId!;
    expect(s.present.nodes.find((n) => n.id === newId)!.parentId).toBe("pkg");
  });

  it("does nothing when no node is selected", () => {
    const s = reducer(store(null), { type: "add" });
    expect(s.present.nodes).toHaveLength(5);
    expect(s.past).toHaveLength(0);
    expect(s.editingId).toBeNull();
  });
});

describe("structural ops are undoable", () => {
  it("'add' pushes history and undo restores the prior tree", () => {
    const s0 = store();
    const s1 = reducer(s0, { type: "add" });
    expect(s1.present.nodes.length).toBe(6);
    expect(s1.past).toHaveLength(1);

    const s2 = reducer(s1, { type: "undo" });
    expect(s2.present.nodes.length).toBe(5);
    expect(s2.present).toEqual(s0.present);
    expect(s2.future).toHaveLength(1);
  });

  it("redo reapplies an undone change", () => {
    const s1 = reducer(store(), { type: "remove" }); // removes root => empties tree
    const undone = reducer(s1, { type: "undo" });
    const redone = reducer(undone, { type: "redo" });
    expect(redone.present).toEqual(s1.present);
    expect(redone.future).toHaveLength(0);
  });

  it("a new change clears the redo stack", () => {
    const s1 = reducer(store("pkg"), { type: "remove" });
    const undone = reducer(s1, { type: "undo" });
    expect(undone.future.length).toBe(1);
    const s2 = reducer(undone, { type: "selectNext" });
    const s3 = reducer(s2, { type: "remove" });
    expect(s3.future).toHaveLength(0);
  });

  it("a no-op structural change does not create a history entry", () => {
    // outdent of root is a no-op
    const s = reducer(store("root"), { type: "outdent" });
    expect(s.past).toHaveLength(0);
  });
});

describe("undo/redo guards", () => {
  it("undo with empty history is a no-op", () => {
    const s = store();
    expect(reducer(s, { type: "undo" })).toBe(s);
  });

  it("redo with empty future is a no-op", () => {
    const s = store();
    expect(reducer(s, { type: "redo" })).toBe(s);
  });
});

describe("rename history", () => {
  it("renaming an existing node is a single undoable step", () => {
    let s = store("readme");
    s = reducer(s, { type: "startEdit", id: "readme", isNew: false });
    s = reducer(s, { type: "renameLive", id: "readme", name: "CHANGE" });
    s = reducer(s, { type: "renameLive", id: "readme", name: "CHANGELOG.md" });
    expect(s.past).toHaveLength(0); // live typing doesn't push
    s = reducer(s, { type: "finishEdit" });
    expect(s.past).toHaveLength(1); // one entry for the whole rename
    expect(s.editingId).toBeNull();

    const undone = reducer(s, { type: "undo" });
    expect(
      undone.present.nodes.find((n) => n.id === "readme")!.name
    ).toBe("README.md");
  });

  it("finishing an unchanged edit pushes no history", () => {
    let s = store("readme");
    s = reducer(s, { type: "startEdit", id: "readme", isNew: false });
    s = reducer(s, { type: "finishEdit" });
    expect(s.past).toHaveLength(0);
  });

  it("escape reverts the name without a history entry", () => {
    let s = store("readme");
    s = reducer(s, { type: "startEdit", id: "readme", isNew: false });
    s = reducer(s, { type: "renameLive", id: "readme", name: "oops" });
    s = reducer(s, { type: "cancelEdit" });
    expect(s.present.nodes.find((n) => n.id === "readme")!.name).toBe(
      "README.md"
    );
    expect(s.past).toHaveLength(0);
  });
});

describe("add-then-name is one undo step", () => {
  it("undo after add+rename removes the new node entirely", () => {
    let s = store("pkg");
    s = reducer(s, { type: "add" }); // new child inside pkg, editing, isNew
    const newId = s.editingId!;
    expect(s.editIsNew).toBe(true);
    s = reducer(s, { type: "renameLive", id: newId, name: "LICENSE" });
    s = reducer(s, { type: "finishEdit" });
    expect(s.past).toHaveLength(1); // only the add boundary

    const undone = reducer(s, { type: "undo" });
    expect(undone.present.nodes.find((n) => n.id === newId)).toBeUndefined();
    expect(undone.present.nodes).toHaveLength(5);
  });

  it("aborting a brand-new empty node leaves no trace and no dangling undo", () => {
    let s = store("pkg");
    s = reducer(s, { type: "add" });
    const newId = s.editingId!;
    s = reducer(s, { type: "cancelEdit" }); // empty -> abort
    expect(s.present.nodes.find((n) => n.id === newId)).toBeUndefined();
    expect(s.present.nodes).toHaveLength(5);
    expect(s.past).toHaveLength(0);
    expect(s.editingId).toBeNull();
  });
});

describe("the root cannot be deleted, only renamed", () => {
  it("'remove' on a root node is a no-op", () => {
    const s = reducer(store("root"), { type: "remove" });
    expect(s.present.nodes).toHaveLength(5);
    expect(s.past).toHaveLength(0);
  });

  it("'removeId' refuses to remove a root node", () => {
    const s = reducer(store(), { type: "removeId", id: "root" });
    expect(s.present.nodes.find((n) => n.id === "root")).toBeDefined();
    expect(s.past).toHaveLength(0);
  });

  it("clearing the root's name on finishEdit reverts instead of deleting it", () => {
    let s = store("root");
    s = reducer(s, { type: "startEdit", id: "root", isNew: false });
    s = reducer(s, { type: "renameLive", id: "root", name: "" });
    s = reducer(s, { type: "finishEdit" });
    const root = s.present.nodes.find((n) => n.id === "root");
    expect(root).toBeDefined();
    expect(root!.name).toBe("my-project"); // reverted, not removed
    expect(s.past).toHaveLength(0);
  });

  it("still allows renaming the root", () => {
    let s = store("root");
    s = reducer(s, { type: "startEdit", id: "root", isNew: false });
    s = reducer(s, { type: "renameLive", id: "root", name: "renamed" });
    s = reducer(s, { type: "finishEdit" });
    expect(s.present.nodes.find((n) => n.id === "root")!.name).toBe("renamed");
    expect(s.past).toHaveLength(1);
  });

  it("still allows deleting a non-root node", () => {
    const s = reducer(store("src"), { type: "remove" });
    expect(s.present.nodes.find((n) => n.id === "src")).toBeUndefined();
    expect(s.past).toHaveLength(1);
  });
});

describe("moveUp / moveDown reorder the selected node", () => {
  it("'moveDown' moves the selected node past its next sibling and is undoable", () => {
    let s = reducer(store("src"), { type: "moveDown" });
    expect(getChildren(s.present.nodes, "root").map((n) => n.id)).toEqual([
      "pkg",
      "src",
      "readme",
    ]);
    expect(s.past).toHaveLength(1);
    const undone = reducer(s, { type: "undo" });
    expect(getChildren(undone.present.nodes, "root").map((n) => n.id)).toEqual([
      "src",
      "pkg",
      "readme",
    ]);
  });

  it("'moveUp' moves the selected node above its previous sibling", () => {
    const s = reducer(store("pkg"), { type: "moveUp" });
    expect(getChildren(s.present.nodes, "root").map((n) => n.id)).toEqual([
      "pkg",
      "src",
      "readme",
    ]);
  });

  it("a no-op reorder records no history", () => {
    const s = reducer(store("src"), { type: "moveUp" }); // src is already first
    expect(s.past).toHaveLength(0);
  });

  it("does nothing when nothing is selected", () => {
    const s = reducer(store(null), { type: "moveDown" });
    expect(s.past).toHaveLength(0);
  });
});

describe("move", () => {
  it("'move' is undoable", () => {
    let s = store();
    s = reducer(s, { type: "move", id: "readme", newParentId: "src", newOrder: 0 });
    expect(getChildren(s.present.nodes, "src").map((n) => n.id)).toEqual([
      "readme",
      "index",
    ]);
    expect(s.past).toHaveLength(1);
    const undone = reducer(s, { type: "undo" });
    expect(getChildren(undone.present.nodes, "root").map((n) => n.id)).toEqual([
      "src",
      "pkg",
      "readme",
    ]);
  });
});

describe("addSibling (space): create a sibling at the current level", () => {
  it("creates a sibling right after the selected node", () => {
    const s = reducer(store("pkg"), { type: "addSibling" });
    const newId = s.editingId!;
    const node = s.present.nodes.find((n) => n.id === newId)!;
    expect(node.parentId).toBe("root"); // same level as pkg
    expect(s.editIsNew).toBe(true);
    // inserted directly after pkg among root's children
    const order = getChildren(s.present.nodes, "root").map((n) => n.id);
    expect(order).toEqual(["src", "pkg", newId, "readme"]);
  });

  it("falls back to a child when the root is selected (no top-level siblings)", () => {
    const s = reducer(store("root"), { type: "addSibling" });
    const newId = s.editingId!;
    expect(s.present.nodes.find((n) => n.id === newId)!.parentId).toBe("root");
    expect(getChildren(s.present.nodes, null)).toHaveLength(1); // still one root
  });

  it("does nothing when no node is selected", () => {
    const s = reducer(store(null), { type: "addSibling" });
    expect(s.present.nodes).toHaveLength(5);
    expect(s.past).toHaveLength(0);
    expect(s.editingId).toBeNull();
  });

  it("add-then-abort leaves no trace", () => {
    let s = reducer(store("pkg"), { type: "addSibling" });
    s = reducer(s, { type: "cancelEdit" });
    expect(s.present.nodes).toHaveLength(5);
    expect(s.past).toHaveLength(0);
    expect(s.editingId).toBeNull();
  });
});

describe("ascend (left arrow): go back out to the parent", () => {
  it("selects the parent of the selected node", () => {
    const s = reducer(store("index"), { type: "ascend" });
    expect(s.present.selectedId).toBe("src");
    expect(s.past).toHaveLength(0);
  });

  it("keeps selection at the root level", () => {
    const s = reducer(store("root"), { type: "ascend" });
    expect(s.present.selectedId).toBe("root");
    expect(s.past).toHaveLength(0);
  });
});

describe("load resets history", () => {
  it("'load' installs a fresh tree with empty history", () => {
    let s = reducer(store(), { type: "add" });
    s = reducer(s, { type: "load", tree: sampleTree("src") });
    expect(s.past).toEqual([]);
    expect(s.future).toEqual([]);
    expect(s.present.selectedId).toBe("src");
  });
});

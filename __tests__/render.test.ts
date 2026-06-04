import { renderTree, getTreePrefixes } from "@/lib/render";
import { TreeNode } from "@/lib/tree";

describe("renderTree", () => {
  it("renders the root line with no ├──/└── prefix", () => {
    const nodes: TreeNode[] = [
      { id: "root", name: "my-project", parentId: null, order: 0 },
      { id: "child", name: "child.ts", parentId: "root", order: 0 },
    ];
    expect(renderTree(nodes).split("\n")[0]).toBe("my-project/");
  });

  it("renders a leaf root (no children) without a trailing slash", () => {
    const nodes: TreeNode[] = [
      { id: "a", name: "file.txt", parentId: null, order: 0 },
    ];
    expect(renderTree(nodes)).toBe("file.txt");
  });

  it("uses a trailing slash only for directories (nodes with children)", () => {
    const nodes: TreeNode[] = [
      { id: "root", name: "my-project", parentId: null, order: 0 },
      { id: "src", name: "src", parentId: "root", order: 0 },
      { id: "index", name: "index.ts", parentId: "src", order: 0 },
    ];
    const out = renderTree(nodes).split("\n");
    expect(out[0]).toBe("my-project/");
    expect(out[1]).toBe("└── src/");
    expect(out[2]).toBe("    └── index.ts");
  });

  it("uses ├── for all children except the last, which uses └──", () => {
    const nodes: TreeNode[] = [
      { id: "root", name: "my-project", parentId: null, order: 0 },
      { id: "a", name: "a.ts", parentId: "root", order: 0 },
      { id: "b", name: "b.ts", parentId: "root", order: 1 },
      { id: "c", name: "c.ts", parentId: "root", order: 2 },
    ];
    expect(renderTree(nodes)).toBe(
      ["my-project/", "├── a.ts", "├── b.ts", "└── c.ts"].join("\n")
    );
  });

  it("renders the canonical nested example with correct continuation lines", () => {
    // my-project/
    // ├── src/
    // │   ├── components/
    // │   │   └── Button.jsx
    // │   └── app.js
    // └── README.md
    const nodes: TreeNode[] = [
      { id: "root", name: "my-project", parentId: null, order: 0 },
      { id: "src", name: "src", parentId: "root", order: 0 },
      { id: "comp", name: "components", parentId: "src", order: 0 },
      { id: "btn", name: "Button.jsx", parentId: "comp", order: 0 },
      { id: "app", name: "app.js", parentId: "src", order: 1 },
      { id: "readme", name: "README.md", parentId: "root", order: 1 },
    ];
    expect(renderTree(nodes)).toBe(
      [
        "my-project/",
        "├── src/",
        "│   ├── components/",
        "│   │   └── Button.jsx",
        "│   └── app.js",
        "└── README.md",
      ].join("\n")
    );
  });

  it("uses 4 spaces of indentation under a last-child directory", () => {
    // root/
    // └── dir/
    //     ├── one
    //     └── two
    const nodes: TreeNode[] = [
      { id: "root", name: "root", parentId: null, order: 0 },
      { id: "dir", name: "dir", parentId: "root", order: 0 },
      { id: "one", name: "one", parentId: "dir", order: 0 },
      { id: "two", name: "two", parentId: "dir", order: 1 },
    ];
    expect(renderTree(nodes)).toBe(
      ["root/", "└── dir/", "    ├── one", "    └── two"].join("\n")
    );
  });

  it("renders multiple root nodes", () => {
    const nodes: TreeNode[] = [
      { id: "a", name: "first", parentId: null, order: 0 },
      { id: "b", name: "second", parentId: null, order: 1 },
    ];
    expect(renderTree(nodes)).toBe(["first", "second"].join("\n"));
  });

  it("returns an empty string for an empty tree", () => {
    expect(renderTree([])).toBe("");
  });
});

describe("getTreePrefixes", () => {
  it("computes the inline connector prefix for each node", () => {
    // my-project/
    // ├── src/
    // │   ├── components/
    // │   │   └── Button.jsx
    // │   └── app.js
    // └── README.md
    const nodes: TreeNode[] = [
      { id: "root", name: "my-project", parentId: null, order: 0 },
      { id: "src", name: "src", parentId: "root", order: 0 },
      { id: "comp", name: "components", parentId: "src", order: 0 },
      { id: "btn", name: "Button.jsx", parentId: "comp", order: 0 },
      { id: "app", name: "app.js", parentId: "src", order: 1 },
      { id: "readme", name: "README.md", parentId: "root", order: 1 },
    ];
    const p = getTreePrefixes(nodes);
    expect(p.get("root")).toBe("");
    expect(p.get("src")).toBe("├── ");
    expect(p.get("comp")).toBe("│   ├── ");
    expect(p.get("btn")).toBe("│   │   └── ");
    expect(p.get("app")).toBe("│   └── ");
    expect(p.get("readme")).toBe("└── ");
  });

  it("stays consistent with renderTree (prefix + label per line)", () => {
    const nodes: TreeNode[] = [
      { id: "root", name: "root", parentId: null, order: 0 },
      { id: "a", name: "a", parentId: "root", order: 0 },
      { id: "b", name: "b", parentId: "root", order: 1 },
    ];
    const prefixes = getTreePrefixes(nodes);
    const lines = renderTree(nodes).split("\n");
    expect(`${prefixes.get("a")}a`).toBe(lines[1]);
    expect(`${prefixes.get("b")}b`).toBe(lines[2]);
  });
});

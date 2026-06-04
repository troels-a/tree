import {
  STORAGE_KEY,
  saveTree,
  loadTree,
  createDefaultState,
} from "@/lib/storage";
import { TreeState } from "@/lib/tree";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("round-trips a tree through localStorage", () => {
    const state: TreeState = {
      nodes: [{ id: "a", name: "a", parentId: null, order: 0 }],
      selectedId: "a",
    };
    saveTree(state);
    expect(loadTree()).toEqual(state);
  });

  it("returns null when nothing is stored", () => {
    expect(loadTree()).toBeNull();
  });

  it("returns null and does not throw on corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not valid json");
    expect(() => loadTree()).not.toThrow();
    expect(loadTree()).toBeNull();
  });

  it("returns null when stored data is missing the nodes array", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ selectedId: null }));
    expect(loadTree()).toBeNull();
  });

  it("does not throw if saving fails (e.g. quota / unavailable)", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() =>
      saveTree({ nodes: [], selectedId: null })
    ).not.toThrow();
  });

  it("createDefaultState produces the documented default tree", () => {
    const state = createDefaultState();
    const names = state.nodes.map((n) => n.name).sort();
    expect(names).toEqual(
      ["README.md", "index.ts", "my-project", "package.json", "src"].sort()
    );
    // root is selected by default
    const root = state.nodes.find((n) => n.parentId === null)!;
    expect(state.selectedId).toBe(root.id);
  });
});

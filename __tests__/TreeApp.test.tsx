import { render, screen, fireEvent, act } from "@testing-library/react";
import TreeApp from "@/components/TreeApp/TreeApp";
import { STORAGE_KEY } from "@/lib/storage";
import { TreeState } from "@/lib/tree";

function getRows() {
  return screen.queryAllByRole("treeitem");
}

function getEditor() {
  return screen.getByRole("tree");
}

beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  act(() => {
    jest.runOnlyPendingTimers();
  });
  jest.useRealTimers();
});

describe("TreeApp", () => {
  it("loads the default tree when localStorage is empty", () => {
    render(<TreeApp />);
    expect(screen.getByText("my-project")).toBeInTheDocument();
    expect(getRows().length).toBe(5);
  });

  it("loads existing state from localStorage on mount", () => {
    const stored: TreeState = {
      nodes: [
        { id: "x", name: "restored-root", parentId: null, order: 0 },
        { id: "y", name: "restored-child", parentId: "x", order: 0 },
      ],
      selectedId: "x",
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    render(<TreeApp />);
    expect(screen.getByText("restored-root")).toBeInTheDocument();
    expect(screen.getByText("restored-child")).toBeInTheDocument();
    expect(getRows().length).toBe(2);
  });

  it("adds a node when Space is pressed", () => {
    render(<TreeApp />);
    const before = getRows().length;
    fireEvent.keyDown(getEditor(), { key: " " });
    expect(getRows().length).toBe(before + 1);
  });

  it("removes the selected node when Delete is pressed", () => {
    render(<TreeApp />);
    // root is selected by default; traverse down to the "index.ts" leaf
    fireEvent.keyDown(getEditor(), { key: "ArrowDown" }); // src
    fireEvent.keyDown(getEditor(), { key: "ArrowDown" }); // index.ts
    expect(screen.getByText("index.ts")).toBeInTheDocument();

    fireEvent.keyDown(getEditor(), { key: "Delete" });
    expect(screen.queryByText("index.ts")).not.toBeInTheDocument();
  });

  it("saves to localStorage after a change (debounced)", () => {
    render(<TreeApp />);
    localStorage.removeItem(STORAGE_KEY);

    fireEvent.keyDown(getEditor(), { key: " " });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull(); // not yet (debounced)

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("copies the rendered tree to the clipboard", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<TreeApp />);
    const button = screen.getByRole("button", { name: /copy/i });

    await act(async () => {
      fireEvent.click(button);
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("my-project/");
    expect(copied).toContain("└── README.md");
  });

  describe("global keyboard", () => {
    it("handles keys fired anywhere on the document, not just the editor", () => {
      render(<TreeApp />);
      const before = getRows().length;
      // Fire on document.body — user never clicked the tree.
      fireEvent.keyDown(document.body, { key: " " });
      expect(getRows().length).toBe(before + 1);
    });

    it("copies the tree on Cmd/Ctrl+C from anywhere", async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      render(<TreeApp />);
      await act(async () => {
        fireEvent.keyDown(document.body, { key: "c", ctrlKey: true });
      });

      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText.mock.calls[0][0]).toContain("my-project/");
    });
  });

  describe("move node with modifier + arrows", () => {
    it("Ctrl/Cmd+ArrowDown moves the selected node down among its siblings", () => {
      render(<TreeApp />);
      fireEvent.keyDown(document.body, { key: "ArrowDown" }); // select src
      fireEvent.keyDown(document.body, { key: "ArrowDown", ctrlKey: true }); // move src down
      const rows = getRows().map((r) => r.textContent ?? "");
      // order under root is now package.json, then src
      expect(rows[1]).toContain("package.json");
      expect(rows[2]).toContain("src");
    });

    it("plain ArrowDown still only moves the selection", () => {
      render(<TreeApp />);
      const before = getRows().map((r) => r.textContent ?? "");
      fireEvent.keyDown(document.body, { key: "ArrowDown" });
      const after = getRows().map((r) => r.textContent ?? "");
      expect(after).toEqual(before); // structure unchanged
    });
  });

  describe("arrow-key create and navigate", () => {
    it("ArrowDown traverses the whole tree, descending into subnodes", () => {
      render(<TreeApp />); // root selected
      fireEvent.keyDown(document.body, { key: "ArrowDown" }); // src
      fireEvent.keyDown(document.body, { key: "ArrowDown" }); // index.ts (child of src)
      const selected = screen.getByRole("treeitem", { selected: true });
      expect(selected.textContent).toContain("index.ts");
    });

    it("ArrowRight creates a child inside the selected node and edits it", () => {
      render(<TreeApp />); // root selected
      const before = getRows().length;
      fireEvent.keyDown(document.body, { key: "ArrowRight" });
      expect(getRows().length).toBe(before + 1);
      expect(screen.getByRole("textbox")).toBeInTheDocument(); // new node is editing
    });

    it("ArrowLeft selects the parent", () => {
      render(<TreeApp />);
      fireEvent.keyDown(document.body, { key: "ArrowDown" }); // src
      fireEvent.keyDown(document.body, { key: "ArrowDown" }); // index.ts
      fireEvent.keyDown(document.body, { key: "ArrowLeft" }); // back out to src
      const selected = screen.getByRole("treeitem", { selected: true });
      expect(selected.textContent).toContain("src");
    });

    it("ArrowLeft on a freshly-created, unnamed node discards it", () => {
      render(<TreeApp />);
      const before = getRows().length;
      fireEvent.keyDown(document.body, { key: " " }); // create empty child, editing
      expect(getRows().length).toBe(before + 1);

      fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowLeft" });
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument(); // edit ended
      expect(getRows().length).toBe(before); // the empty node is gone
    });

    it("ArrowLeft keeps a new node that already has a name (cursor movement)", () => {
      render(<TreeApp />);
      const before = getRows().length;
      fireEvent.keyDown(document.body, { key: " " });
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });

      fireEvent.keyDown(screen.getByRole("textbox"), { key: "ArrowLeft" });
      expect(screen.getByRole("textbox")).toBeInTheDocument(); // still editing
      expect(getRows().length).toBe(before + 1);
    });

    it("ArrowLeft while renaming an existing node does not discard it", () => {
      render(<TreeApp />); // root is selected and is an existing, named node
      fireEvent.keyDown(document.body, { key: "Enter" }); // rename root
      const input = screen.getByRole("textbox");
      fireEvent.keyDown(input, { key: "ArrowLeft" });
      expect(screen.getByRole("textbox")).toBeInTheDocument(); // still editing, not aborted
    });
  });

  describe("undo / redo", () => {
    it("undoes and redoes a removal via the keyboard", () => {
      render(<TreeApp />);
      fireEvent.keyDown(document.body, { key: "ArrowDown" }); // src
      fireEvent.keyDown(document.body, { key: "ArrowDown" }); // index.ts
      fireEvent.keyDown(document.body, { key: "Delete" });
      expect(screen.queryByText("index.ts")).not.toBeInTheDocument();

      fireEvent.keyDown(document.body, { key: "z", ctrlKey: true }); // undo
      expect(screen.getByText("index.ts")).toBeInTheDocument();

      fireEvent.keyDown(document.body, {
        key: "z",
        ctrlKey: true,
        shiftKey: true,
      }); // redo
      expect(screen.queryByText("index.ts")).not.toBeInTheDocument();
    });
  });
});

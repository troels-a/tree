"use client";

import { useReducer, useEffect, useRef, useState, useCallback } from "react";
import { loadTree, saveTree, createDefaultState } from "@/lib/storage";
import { reducer, initStore, AppState } from "@/lib/treeStore";
import { renderTree } from "@/lib/render";
import TreeEditor from "../TreeEditor/TreeEditor";
import CopyButton from "../CopyButton/CopyButton";
import ClearButton from "../ClearButton/ClearButton";
import styles from "./TreeApp.module.css";

interface TreeAppProps {
  /** Optional override for the ASCII-tree logo asset. */
  logoSrc?: string;
}

const SAVE_DEBOUNCE_MS = 300;

/** True when keyboard focus is in a control that owns its own key handling. */
function focusIsInteractive(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    tag === "BUTTON" ||
    tag === "A" ||
    (el as HTMLElement).isContentEditable
  );
}

export default function TreeApp({ logoSrc = "/logo.png" }: TreeAppProps) {
  const [state, dispatch] = useReducer(
    reducer,
    undefined,
    (): AppState => initStore(createDefaultState())
  );
  const [copied, setCopied] = useState(false);

  // Keep a live snapshot for the window listener and the copy handler.
  const stateRef = useRef(state);
  stateRef.current = state;

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    const text = renderTree(stateRef.current.present.nodes);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard may be blocked (insecure context) — fail silently.
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  // Load persisted state once, after mount (localStorage is client-only).
  useEffect(() => {
    const loaded = loadTree();
    if (loaded) dispatch({ type: "load", tree: loaded });
  }, []);

  // Persist the present tree on every change, debounced.
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => saveTree(state.present),
      SAVE_DEBOUNCE_MS
    );
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.present]);

  // Global keyboard handling — works anywhere on the page.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Editing a name or focused in a control: let that element own ALL keys,
      // so native text copy/undo work while typing.
      if (stateRef.current.editingId || focusIsInteractive()) return;

      const mod = e.metaKey || e.ctrlKey;

      // Copy: Cmd/Ctrl+C. Respect an active text selection if one exists.
      if (mod && (e.key === "c" || e.key === "C")) {
        const selection = window.getSelection()?.toString() ?? "";
        if (selection.trim() === "") {
          e.preventDefault();
          void handleCopy();
        }
        return;
      }

      // Undo / redo: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z (or Ctrl+Y).
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        dispatch({ type: "redo" });
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          dispatch({ type: e.shiftKey ? "moveDown" : "selectNext" });
          break;
        case "ArrowUp":
          e.preventDefault();
          dispatch({ type: e.shiftKey ? "moveUp" : "selectPrev" });
          break;
        case "ArrowRight":
          e.preventDefault();
          dispatch({ type: "descend" });
          break;
        case "ArrowLeft":
          e.preventDefault();
          dispatch({ type: "ascend" });
          break;
        case " ":
          e.preventDefault();
          dispatch({ type: e.shiftKey ? "addChild" : "addSibling" });
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          dispatch({ type: "remove" });
          break;
        case "Tab":
          e.preventDefault();
          dispatch({ type: e.shiftKey ? "outdent" : "indent" });
          break;
        case "Enter": {
          e.preventDefault();
          const id = stateRef.current.present.selectedId;
          if (id) dispatch({ type: "startEdit", id, isNew: false });
          break;
        }
        default:
          break;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCopy]);

  return (
    <main className={styles.app}>
      <header className={styles.header}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.logo}
          src={logoSrc}
          alt="tree"
          width={123}
          height={138}
        />
        <p className={styles.description}>
          Build ASCII directory structures quickly.
          <br />
          Arrows to move · Space to add a sibling · Shift+Space to add a child
          · Enter to rename · Delete to remove · hold Shift + ↑/↓ to move the
          node.
        </p>
      </header>

      <section className={styles.box}>
        <TreeEditor
          state={state.present}
          editingId={state.editingId}
          editingIsNew={state.editIsNew}
          dispatch={dispatch}
        />
      </section>

      <div className={styles.actions}>
        <ClearButton onClear={() => dispatch({ type: "clear" })} />
        <CopyButton copied={copied} onCopy={handleCopy} />
      </div>

      <a
        className={styles.footer}
        href="https://continuous.supply"
        target="_blank"
        rel="noopener noreferrer"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.continuousMark}
          src="/continuous.png"
          alt=""
          width={16}
          height={16}
        />
        A Continuous product :)
      </a>
    </main>
  );
}
